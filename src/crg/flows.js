'use strict';

/**
 * CRG 执行流检测与 PageRank 评分
 *
 * 功能：
 *   - loadAdjacency: 从 edges 表加载整图邻接表和反向邻接表
 *   - computePageRank: 标准 PageRank 迭代（20 次，阻尼系数 0.85）
 *   - detectFlows: 找入口节点 → BFS 展开 → 写入 flows/flow_nodes 表
 *
 * 简化策略（防止指数爆炸）：
 *   - BFS 最大深度 5
 *   - 最多 100 个 flows
 *   - 每个 flow 最多 20 个节点
 */

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
 * PageRank 计算（迭代式，阻尼系数 0.85，最多 20 次迭代）
 *
 * @param {Map<string, string[]>} adjacency - nodeId → 出边 nodeId 数组
 * @param {number} [dampingFactor=0.85]
 * @param {number} [maxIterations=20]
 * @returns {Map<string, number>} nodeId → PageRank 分数
 */
function computePageRank(adjacency, reverseAdjacency, dampingFactor = 0.85, maxIterations = 20) {
  // 收集所有节点（包括只有 in-edges 无 out-edges 的节点）
  const allNodes = new Set(adjacency.keys());
  for (const targets of adjacency.values()) {
    for (const t of targets) {
      allNodes.add(t);
    }
  }

  const N = allNodes.size;
  if (N === 0) return new Map();

  // 初始化：每个节点分数 = 1 / N
  let scores = new Map();
  for (const nodeId of allNodes) {
    scores.set(nodeId, 1 / N);
  }

  const baseScore = (1 - dampingFactor) / N;

  for (let iter = 0; iter < maxIterations; iter++) {
    const newScores = new Map();
    let maxDelta = 0;

    for (const nodeId of allNodes) {
      // 通过反向邻接表直接获取入边节点，O(in-degree) 而非 O(N×E)
      let incomingSum = 0;
      const incomingNodes = reverseAdjacency.get(nodeId) || [];
      for (const srcId of incomingNodes) {
        const outDegree = (adjacency.get(srcId) || []).length;
        if (outDegree > 0) {
          incomingSum += (scores.get(srcId) || 0) / outDegree;
        }
      }

      const newScore = baseScore + dampingFactor * incomingSum;
      newScores.set(nodeId, newScore);

      const delta = Math.abs(newScore - (scores.get(nodeId) || 0));
      if (delta > maxDelta) maxDelta = delta;
    }

    scores = newScores;

    // 收敛检测
    if (maxDelta < 1e-6) break;
  }

  return scores;
}

/**
 * BFS 从入口节点展开，最大深度 5，最多 20 个节点
 *
 * @param {string} entryId - 入口节点 ID
 * @param {Map<string, string[]>} adjacency - 正向邻接表
 * @param {number} [maxDepth=5]
 * @param {number} [maxNodes=20]
 * @returns {string[]} 遍历到的节点 ID 列表（含入口）
 */
function bfsFlow(entryId, adjacency, maxDepth = 5, maxNodes = 20) {
  const visited = new Set([entryId]);
  // 队列元素：[nodeId, depth]
  const queue = [[entryId, 0]];
  const flowNodes = [entryId];

  while (queue.length > 0 && flowNodes.length < maxNodes) {
    const [cur, depth] = queue.shift();

    if (depth >= maxDepth) continue;

    const neighbors = adjacency.get(cur) || [];
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        flowNodes.push(nb);
        queue.push([nb, depth + 1]);

        if (flowNodes.length >= maxNodes) break;
      }
    }
  }

  return flowNodes;
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
  // 加载邻接表（含反向邻接表，用于 O(E) PageRank 计算）
  const { adjacency, reverseAdjacency } = loadAdjacency(db);

  // 计算 PageRank（用于 criticality 评分）
  const pageRankScores = computePageRank(adjacency, reverseAdjacency);

  // 找入口点：kind != 'module' 且不在任何 calls 边的 target_id 中
  const entryNodes = db.prepare(`
    SELECT id FROM nodes
    WHERE kind != 'module'
      AND id NOT IN (
        SELECT target_id FROM edges WHERE kind = 'calls'
      )
  `).all();

  // 清空旧 flows 数据（先 flow_nodes，再 flows，CASCADE 会自动处理）
  db.prepare('DELETE FROM flows').run();

  const insertFlow = db.prepare(`
    INSERT INTO flows (id, entry_node_id, criticality, node_count)
    VALUES (?, ?, ?, ?)
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

      const flowNodeIds = bfsFlow(entry.id, adjacency, 5, 20);

      // 过滤掉只有入口节点自身的 flow（无实际意义）
      if (flowNodeIds.length <= 1) {
        // 检查是否有 out-edges
        const hasOutEdges = adjacency.has(entry.id) && adjacency.get(entry.id).length > 0;
        if (!hasOutEdges) continue;
      }

      const flowId = `flow:${entry.id}:${flowIndex}`;
      const criticality = pageRankScores.get(entry.id) || 0;

      insertFlow.run(flowId, entry.id, criticality, flowNodeIds.length);

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

module.exports = { loadAdjacency, computePageRank, detectFlows };
