'use strict';

/**
 * spec-first crg surprising-connections --repo=<path>
 *
 * 识别图中出人意料的跨社区/异常调用边（4 因子评分，score 0-100）。
 * R7：每项含 score 整数 和 reasons string[]。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');
  const { surprisingConnections } = require('../analyze');

  const { db, repoRoot } = openDb(argv);

  const items = surprisingConnections(db);

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, { items })) + '\n'
  );
}

module.exports = { run };
