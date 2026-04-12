'use strict';

/**
 * CRG 执行流检测与 criticality 评分
 *
 * 功能：
 *   - loadAdjacency: 从 edges 表加载整图邻接表和反向邻接表
 *   - computeFlowCriticality: 5因子加权评分
 *   - detectFlows: 找入口节点 → BFS 展开 → 写入 flows/flow_nodes 表
 *
 * 简化策略（防止指数爆炸）：
 *   - BFS 最大深度 5
 *   - 最多 100 个 flows
 *   - 每个 flow 最多 20 个节点
 */

const { SECURITY_KEYWORDS } = require('./constants');

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
  const flowNodes = [entryId];
  let reachedDepth = 0;

  while (queue.length > 0 && flowNodes.length < maxNodes) {
    const [cur, depth] = queue.shift();

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
 * 计算单个 flow 的 5因子 criticality 评分（0.0 - 1.0）
 *
 * F1 file_spread  (0.30)：flow 涉及文件数，1 file→0.0，5+→1.0
 * F2 depth_score  (0.20)：BFS 节点数近似深度，0→0.0，20+→1.0
 * F3 security_score (0.25)：flow 节点名含安全关键词的占比
 * F4 test_gap     (0.15)：1 - flow 内 is_test 节点占比（无测试覆盖则高）
 * F5 external_score (0.10)：flow 节点中有出向 unresolved 边的节点占比（外部调用估算）
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
      `SELECT id, name, file_path, is_test FROM nodes WHERE id IN (${ph})`
    ).all(...chunk);
    nodeRows.push(...rows);
  }

  // F1: file_spread（涉及文件数，上限 5）
  const fileCount = new Set(nodeRows.map(n => n.file_path)).size;
  const fileSpread = Math.min((fileCount - 1) / 4, 1.0); // 1→0, 5+→1

  // F2: depth_score（节点数近似深度，上限 20）
  const depthScore = Math.min(flowNodeIds.length / 20, 1.0);

  // F3: security_score（含安全关键词节点占比）
  const secCount = nodeRows.filter(n =>
    n.name && [...SECURITY_KEYWORDS].some(kw => n.name.toLowerCase().includes(kw))
  ).length;
  const securityScore = nodeRows.length > 0 ? secCount / nodeRows.length : 0;

  // F4: test_gap（1 - 测试节点占比；无测试则高）
  const testCount = nodeRows.filter(n => n.is_test).length;
  const testGap = 1 - (nodeRows.length > 0 ? testCount / nodeRows.length : 0);

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
    fileSpread   * 0.30 +
    depthScore   * 0.20 +
    securityScore * 0.25 +
    testGap      * 0.15 +
    externalScore * 0.10,
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
  const entryNodes = db.prepare(`
    SELECT id, name FROM nodes
    WHERE kind != 'module'
      AND id NOT IN (
        SELECT target_id FROM edges WHERE kind = 'calls'
      )
  `).all();

  // 清空旧 flows 数据（先 flow_nodes，再 flows，CASCADE 会自动处理）
  db.prepare('DELETE FROM flows').run();

  const insertFlow = db.prepare(`
    INSERT INTO flows (id, entry_node_id, name, criticality, node_count, depth)
    VALUES (?, ?, ?, ?, ?, ?)
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

      // 过滤掉只有入口节点自身且无出边的 flow（无实际意义）
      if (flowNodeIds.length <= 1) {
        const hasOutEdges = adjacency.has(entry.id) && adjacency.get(entry.id).length > 0;
        if (!hasOutEdges) continue;
      }

      const flowId = `flow:${entry.id}:${flowIndex}`;
      const criticality = computeFlowCriticality(flowNodeIds, db);

      insertFlow.run(flowId, entry.id, entry.name || null, criticality, flowNodeIds.length, depth);

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

module.exports = { loadAdjacency, detectFlows };
