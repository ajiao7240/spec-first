'use strict';

/**
 * spec-first crg flows [--sort=criticality] --repo=<path>
 *
 * 列出所有已检测到的执行流，默认按 criticality 降序排列。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');
  const { annotateFlowOutput } = require('../flows');

  const { db, repoRoot } = openDb(argv);

  // 解析可选 --sort 参数
  const sortArg = argv.find(a => a.startsWith('--sort='));
  const sort = sortArg ? sortArg.slice('--sort='.length) : 'criticality';

  // 查询 flows 表（id AS flow_id 与 FlowBrief schema 对齐）
  let sql = 'SELECT id AS flow_id, entry_node_id AS entry_node, criticality, node_count FROM flows';
  if (sort === 'criticality') {
    sql += ' ORDER BY criticality DESC';
  } else if (sort === 'node_count') {
    sql += ' ORDER BY node_count DESC';
  }

  const items = db.prepare(sql).all().map((row) => annotateFlowOutput(row));

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, { items })) + '\n'
  );
}

module.exports = { run };
