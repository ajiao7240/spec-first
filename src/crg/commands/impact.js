'use strict';

/**
 * spec-first crg impact --symbol=<id> [--depth=N] --repo=<path>
 *
 * 反向 BFS：从指定符号出发，沿调用者方向（reverse edges）展开，
 * 找出所有潜在受影响的节点。
 *
 * depth 默认 3，最大 5（防止爆炸）。
 * 每个节点映射为 FactItem（confidence=Inferred, inference_reason=call_graph_traversal）。
 */

const MAX_DEPTH = 5;
const DEFAULT_DEPTH = 3;

/**
 * 反向 BFS：从 startId 出发，沿反向边（谁调用了我）展开
 *
 * @param {string} startId - 起始节点 ID
 * @param {Map<string, string[]>} reverseAdj - nodeId → 调用者 nodeId 列表
 * @param {number} maxDepth - 最大深度
 * @returns {Map<string, number>} nodeId → 发现深度
 */
function reverseBfs(startId, reverseAdj, maxDepth) {
  const visited = new Map(); // nodeId → depth
  const queue = [[startId, 0]];
  visited.set(startId, 0);

  while (queue.length > 0) {
    const [cur, depth] = queue.shift();
    if (depth >= maxDepth) continue;

    const callers = reverseAdj.get(cur) || [];
    for (const caller of callers) {
      if (!visited.has(caller)) {
        visited.set(caller, depth + 1);
        queue.push([caller, depth + 1]);
      }
    }
  }

  return visited;
}

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');

  // --symbol 参数是必填项
  const symbolArg = argv.find(a => a.startsWith('--symbol='));
  if (!symbolArg) {
    process.stderr.write('error: --symbol=<node_id> is required\n');
    process.exit(1);
  }
  const symbolId = symbolArg.slice('--symbol='.length);

  // --depth 参数（可选，默认 3，最大 5）
  const depthArg = argv.find(a => a.startsWith('--depth='));
  let depth = DEFAULT_DEPTH;
  if (depthArg) {
    const parsed = parseInt(depthArg.slice('--depth='.length), 10);
    if (!isNaN(parsed) && parsed > 0) {
      depth = Math.min(parsed, MAX_DEPTH);
    }
  }

  const { db, repoRoot } = openDb(argv);

  // 验证 symbol 节点是否存在
  const symbol = db.prepare(
    'SELECT id, name, file_path, kind FROM nodes WHERE id = ?'
  ).get(symbolId);

  if (!symbol) {
    process.stderr.write(`error: symbol not found: ${symbolId}\n`);
    db.close();
    process.exit(1);
  }

  // 加载反向邻接表（只加载 calls 类型的边，代表真实调用关系）
  const edgeRows = db.prepare(
    "SELECT source_id, target_id FROM edges WHERE kind = 'calls'"
  ).all();

  // reverseAdj: target → callers（谁调用了 target）
  const reverseAdj = new Map();
  for (const row of edgeRows) {
    if (!reverseAdj.has(row.target_id)) reverseAdj.set(row.target_id, []);
    reverseAdj.get(row.target_id).push(row.source_id);
  }

  // 反向 BFS，找到所有受影响节点
  const visitedMap = reverseBfs(symbolId, reverseAdj, depth);

  // 排除起始节点自身，只保留受影响的调用者
  const impactedIds = Array.from(visitedMap.keys()).filter(id => id !== symbolId);

  // 分块查询（避免超出 SQLite SQLITE_MAX_VARIABLE_NUMBER=999）
  const CHUNK_SIZE = 900;
  let impactedNodes = [];
  if (impactedIds.length > 0) {
    const nodeRows = [];
    for (let i = 0; i < impactedIds.length; i += CHUNK_SIZE) {
      const chunk = impactedIds.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = db.prepare(
        `SELECT id, name, file_path, kind FROM nodes WHERE id IN (${placeholders})`
      ).all(...chunk);
      nodeRows.push(...rows);
    }

    impactedNodes = nodeRows.map(row => ({
      id: row.id,
      name: row.name,
      file_path: row.file_path,
      kind: row.kind,
      depth: visitedMap.get(row.id),
      confidence: 'Inferred',
      source_tier: 'crg_ast',
      inference_reason: 'call_graph_traversal',
    }));

    // 按 depth 升序排列
    impactedNodes.sort((a, b) => a.depth - b.depth);
  }

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, {
      symbol: {
        id: symbol.id,
        name: symbol.name,
        file_path: symbol.file_path,
        kind: symbol.kind,
      },
      depth_used: depth,
      blast_radius: impactedNodes.length,
      impacted_nodes: impactedNodes,
    })) + '\n'
  );
}

module.exports = { run };
