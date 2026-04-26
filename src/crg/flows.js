'use strict';

/**
 * CRG 执行流检测与 criticality 评分
 *
 * 功能：
 *   - loadAdjacency: 从 edges 表加载整图邻接表和反向邻接表
 *   - computeFlowCriticality: 4因子加权评分
 *   - detectFlows: 找入口节点 → BFS 展开 → 写入 flows/flow_nodes 表
 *
 * 简化策略（防止指数爆炸）：
 *   - BFS 最大深度 5
 *   - 最多 100 个 flows
 *   - 每个 flow 最多 20 个节点
 */

const { scoreSecuritySignal } = require('./constants');
const { annotateEntryCandidates } = require('./flows/entrypoints');

const FLOW_ENTRY_CONFIDENCE = 'Inferred';
const FLOW_ENTRY_INFERENCE_REASON = 'zero_in_degree_calls';

/**
 * 加载整图邻接表和反向邻接表
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ adjacency: Map<string, string[]>, reverseAdjacency: Map<string, string[]> }}
 */
function loadAdjacency(db) {
  // 仅加载 calls 类型边：PageRank 评分和 BFS 流程展开均基于函数调用关系
  const rows = db.prepare("SELECT source_id, target_id FROM edges WHERE kind = 'calls'").all();
  const adjacency = new Map();
  const reverseAdjacency = new Map();

  for (const row of rows) {
    if (!adjacency.has(row.source_id)) adjacency.set(row.source_id, []);
    adjacency.get(row.source_id).push(row.target_id);

    if (!reverseAdjacency.has(row.target_id)) reverseAdjacency.set(row.target_id, []);
    reverseAdjacency.get(row.target_id).push(row.source_id);
  }

  return { adjacency, reverseAdjacency };
}

/**
 * BFS 从入口节点展开，最大深度 5，最多 20 个节点
 *
 * @param {string} entryId - 入口节点 ID
 * @param {Map<string, string[]>} adjacency - 正向邻接表
 * @param {number} [maxDepth=5]
 * @param {number} [maxNodes=20]
 * @returns {{ nodeIds: string[], depth: number }} 遍历到的节点 ID 列表（含入口）及实际最大 BFS 深度
 */
function bfsFlow(entryId, adjacency, maxDepth = 5, maxNodes = 20) {
  const visited = new Set([entryId]);
  // 队列元素：[nodeId, depth]
  const queue = [[entryId, 0]];
  let head = 0;
  const flowNodes = [entryId];
  let reachedDepth = 0;

  while (head < queue.length && flowNodes.length < maxNodes) {
    const [cur, depth] = queue[head++];

    if (depth >= maxDepth) continue;

    const neighbors = adjacency.get(cur) || [];
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        flowNodes.push(nb);
        const nbDepth = depth + 1;
        if (nbDepth > reachedDepth) reachedDepth = nbDepth;
        queue.push([nb, nbDepth]);

        if (flowNodes.length >= maxNodes) break;
      }
    }
  }

  return { nodeIds: flowNodes, depth: reachedDepth };
}

/**
 * 为 flow 输出补充入口启发式元数据。
 * entry 目前只是 calls 图上的零入度启发式推断，需要显式告诉消费方其边界。
 *
 * @param {object} row
 * @returns {object}
 */
function annotateFlowOutput(row) {
  return {
    ...row,
    entry_source: row.entry_source || FLOW_ENTRY_INFERENCE_REASON,
    entry_confidence: row.entry_confidence || FLOW_ENTRY_CONFIDENCE,
    entry_inference_reason: row.entry_inference_reason || FLOW_ENTRY_INFERENCE_REASON,
    truncated: Boolean(row.truncated),
    truncation_reason: row.truncation_reason || null,
  };
}

/**
 * 计算单个 flow 的 4因子 criticality 评分（0.0 - 1.0）
 *
 * F1 file_spread    (0.35)：flow 涉及文件数，1 file→0.0，5+→1.0
 * F2 depth_score    (0.25)：BFS 节点数近似深度，0→0.0，20+→1.0
 * F3 security_score (0.25)：flow 节点的安全信号强度占比
 * F4 external_score (0.15)：flow 节点中有出向 unresolved 边的节点占比（外部调用估算）
 *
 * 刻意不再纳入 `test_gap`：
 * - 当前 CRG 没有可靠的测试覆盖事实
 * - `flow 内 is_test 节点占比` 会把几乎所有业务 flow 都抬成“高缺口”
 * - 这是伪语义，不适合作为 LLM 决策输入
 *
 * @param {string[]} flowNodeIds - flow 的节点 ID 列表
 * @param {import('better-sqlite3').Database} db
 * @returns {number} 0.0 - 1.0
 */
function computeFlowCriticality(flowNodeIds, db) {
  if (flowNodeIds.length === 0) return 0;

  // 批量查节点信息（分块避免超 SQLITE_MAX_VARIABLE_NUMBER）
  const CHUNK = 900;
  const nodeRows = [];
  for (let i = 0; i < flowNodeIds.length; i += CHUNK) {
    const chunk = flowNodeIds.slice(i, i + CHUNK);
    const ph = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, name, file_path FROM nodes WHERE id IN (${ph})`
    ).all(...chunk);
    nodeRows.push(...rows);
  }

  // F1: file_spread（涉及文件数，上限 5）
  const fileCount = new Set(nodeRows.map(n => n.file_path)).size;
  const fileSpread = Math.min((fileCount - 1) / 4, 1.0); // 1→0, 5+→1

  // F2: depth_score（节点数近似深度，上限 20）
  const depthScore = Math.min(flowNodeIds.length / 20, 1.0);

  // F3: security_score（强信号=1，带上下文弱信号=0.5）
  const securityWeight = nodeRows.reduce(
    (sum, node) => sum + scoreSecuritySignal({ name: node.name, filePath: node.file_path }),
    0
  );
  const securityScore = nodeRows.length > 0 ? Math.min(securityWeight / nodeRows.length, 1.0) : 0;

  // F5: external_score（flow 节点中在 unresolved_edges 表有记录的节点占比，近似外部调用）
  // 注意：edges 表中 target_id NOT NULL，无法用 target_id IS NULL 表示 unresolved；
  //       unresolved_edges 表由 replaceUnresolvedEdges 在每次 build 后写入，是正确来源。
  let unresolvedSources = 0;
  for (let i = 0; i < flowNodeIds.length; i += CHUNK) {
    const chunk = flowNodeIds.slice(i, i + CHUNK);
    const ph = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT DISTINCT source_id FROM unresolved_edges WHERE source_id IN (${ph})`
    ).all(...chunk);
    unresolvedSources += rows.length;
  }
  const externalScore = flowNodeIds.length > 0 ? Math.min(unresolvedSources / flowNodeIds.length, 1.0) : 0;

  return Math.min(
    fileSpread   * 0.35 +
    depthScore   * 0.25 +
    securityScore * 0.25 +
    externalScore * 0.15,
    1.0
  );
}

/**
 * 检测执行流并写入 flows / flow_nodes 表
 *
 * 入口点定义：kind != 'module' 且没有 calls 类型的 incoming edges（fan-in=0）
 * 限制：最多 100 个 flows，每个 flow 最多 20 个节点
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ flow_count: number, node_count_total: number }}
 */
function detectFlows(db) {
  // 加载邻接表
  const { adjacency } = loadAdjacency(db);

  // 找入口点：kind != 'module' 且不在任何 calls 边的 target_id 中
  // ORDER BY id ASC 保证 100 条 flow 截断时的确定性——
  // 否则 SQLite 默认顺序实现定义，不同 build 选出的 top-100 会抖动，
  // 污染下游 SKILL B-Round2 的 top-5 criticality 选取稳定性。
  const entryNodes = annotateEntryCandidates(db.prepare(`
    SELECT id, name, file_path, is_test FROM nodes
    WHERE kind != 'module'
      AND id NOT IN (
        SELECT target_id FROM edges WHERE kind = 'calls'
      )
    ORDER BY id ASC
  `).all());

  // 清空旧 flows 数据（先 flow_nodes，再 flows，CASCADE 会自动处理）
  db.prepare('DELETE FROM flows').run();

  const insertFlow = db.prepare(`
    INSERT INTO flows (
      id, entry_node_id, name, criticality, node_count, depth,
      entry_source, entry_confidence, entry_evidence, entry_inference_reason,
      truncated, truncation_reason, max_depth, max_nodes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFlowNode = db.prepare(`
    INSERT OR IGNORE INTO flow_nodes (flow_id, node_id, position)
    VALUES (?, ?, ?)
  `);

  let flowIndex = 0;
  let totalNodeCount = 0;

  const writeFlows = db.transaction(() => {
    for (const entry of entryNodes) {
      if (flowIndex >= 100) break; // 最多 100 个 flows

      const { nodeIds: flowNodeIds, depth } = bfsFlow(entry.id, adjacency, 5, 20);
      const hasMoreDepth = depth >= 5 && flowNodeIds.length >= 20;

      // 过滤掉只有入口节点自身且无出边的 flow（无实际意义）
      if (flowNodeIds.length <= 1) {
        const hasOutEdges = adjacency.has(entry.id) && adjacency.get(entry.id).length > 0;
        if (!hasOutEdges) continue;
      }

      const flowId = `flow:${entry.id}:${flowIndex}`;
      const criticality = computeFlowCriticality(flowNodeIds, db);

      insertFlow.run(
        flowId,
        entry.id,
        entry.name || null,
        criticality,
        flowNodeIds.length,
        depth,
        entry.entry_source,
        entry.entry_confidence,
        JSON.stringify(entry.entry_evidence || []),
        entry.entry_inference_reason,
        hasMoreDepth ? 1 : 0,
        hasMoreDepth ? 'max_nodes_or_depth_reached' : null,
        5,
        20
      );

      for (let pos = 0; pos < flowNodeIds.length; pos++) {
        insertFlowNode.run(flowId, flowNodeIds[pos], pos);
      }

      totalNodeCount += flowNodeIds.length;
      flowIndex++;
    }
  });

  writeFlows();

  return {
    flow_count: flowIndex,
    node_count_total: totalNodeCount,
  };
}

module.exports = {
  FLOW_ENTRY_CONFIDENCE,
  FLOW_ENTRY_INFERENCE_REASON,
  annotateFlowOutput,
  computeFlowCriticality,
  loadAdjacency,
  detectFlows,
};
