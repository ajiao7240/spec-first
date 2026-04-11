'use strict';

/**
 * spec-first crg god-nodes --repo=<path>
 *
 * 识别图中过度中心化的节点（in_degree 排名前 5%，排除 module 节点）。
 * 结果以 FactItem[] 格式输出。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');
  const { godNodes } = require('../analyze');

  const { db, repoRoot } = openDb(argv);

  const items = godNodes(db);

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, { items })) + '\n'
  );
}

module.exports = { run };
