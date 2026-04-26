'use strict';

/**
 * spec-first crg search <keyword> [--kind=function] --repo=<path>
 *
 * 通过 FTS5 全文索引搜索代码节点。
 * 若 FTS5 不可用或索引表不存在，exit 2 并提示。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');
  const { searchNodes } = require('../search');
  const { scoreRetrievalResult } = require('../eval/scorer');

  // keyword：argv 中第一个非 flag 参数
  const keyword = argv.find(a => !a.startsWith('--'));

  if (!keyword) {
    process.stderr.write('error: <keyword> is required\n');
    process.stderr.write('Usage: spec-first crg search <keyword> [--kind=<kind>] --repo=<path>\n');
    process.exit(1);
  }

  // --kind 过滤（可选）
  const kindArg = argv.find(a => a.startsWith('--kind='));
  const kind = kindArg ? kindArg.slice('--kind='.length) : undefined;

  // --limit 参数（可选，默认 20）
  const limitArg = argv.find(a => a.startsWith('--limit='));
  let limit = 20;
  if (limitArg) {
    const parsed = parseInt(limitArg.slice('--limit='.length), 10);
    if (!isNaN(parsed) && parsed > 0) limit = parsed;
  }

  const { db, repoRoot } = openDb(argv);
  const relevantArg = argv.find(a => a.startsWith('--relevant='));
  const relevantIds = relevantArg
    ? relevantArg.slice('--relevant='.length).split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  // 检查 fts_nodes 表是否存在
  const ftsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='fts_nodes'"
  ).get();

  if (!ftsExists) {
    process.stderr.write(
      'error: FTS5 index not built. Run: spec-first crg postprocess --repo=<path>\n'
    );
    db.close();
    process.exit(2);
  }

  let results;
  try {
    results = searchNodes(db, keyword, { kind, limit });
  } catch (err) {
    // FTS5 模块不可用（SQLite 编译时未启用 fts5）
    if (err.message && (err.message.includes('fts5') || err.message.includes('no such module'))) {
      process.stderr.write(
        'error: FTS5 not available in this SQLite build. CRG requires SQLite with FTS5 support.\n'
      );
      db.close();
      process.exit(2);
    }
    throw err;
  }

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, {
      keyword,
      kind: kind || null,
      results,
      eval: relevantIds.length > 0
        ? scoreRetrievalResult({
          ranked_context: results.map((item) => ({ ...item, id: item.node_id })),
        }, { id: 'adhoc-search', relevant_ids: relevantIds }, { k: limit })
        : null,
    })) + '\n'
  );
}

module.exports = { run };
