'use strict';

/**
 * spec-first crg flow --id=<flow_id> --repo=<path>
 *
 * 返回单个执行流的详情，包含关联节点列表（FactItem 格式）。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');

  // --id 参数是必填项
  const idArg = argv.find(a => a.startsWith('--id='));
  if (!idArg) {
    process.stderr.write('error: --id=<flow_id> is required\n');
    process.exit(1);
  }
  const flowId = idArg.slice('--id='.length);

  const { db, repoRoot } = openDb(argv);

  // 查询 flow 基本信息
  const flow = db.prepare(
    'SELECT id, entry_node_id, criticality, node_count FROM flows WHERE id = ?'
  ).get(flowId);

  if (!flow) {
    process.stderr.write(`error: flow not found: ${flowId}\n`);
    db.close();
    process.exit(1);
  }

  // 查询该 flow 的所有关联节点（按 position 排序）
  const rows = db.prepare(`
    SELECT n.id, n.name, n.file_path, n.kind, fn.position
    FROM flow_nodes fn
    JOIN nodes n ON fn.node_id = n.id
    WHERE fn.flow_id = ?
    ORDER BY fn.position ASC
  `).all(flowId);

  // 映射为 FactItem 格式
  const nodes = rows.map(row => ({
    id: row.id,
    name: row.name,
    file_path: row.file_path,
    kind: row.kind,
    position: row.position,
    confidence: 'Inferred',
    source_tier: 'crg_ast',
    inference_reason: 'call_graph_traversal',
  }));

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, {
      flow_id: flow.id,
      entry_node: flow.entry_node_id,
      criticality: flow.criticality,
      nodes,
    })) + '\n'
  );
}

module.exports = { run };
