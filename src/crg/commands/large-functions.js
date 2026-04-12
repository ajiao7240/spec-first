'use strict';

/**
 * spec-first crg large-functions [--min-lines=50] [--limit=20] --repo=<path>
 *
 * 列出行数最多的函数/方法，按 loc 降序排列。
 * 依赖 nodes 表中 line_start 和 line_end 字段。
 */

const DEFAULT_MIN_LINES = 50;
const DEFAULT_LIMIT = 50;

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');

  // 解析 --min-lines 参数
  const minLinesArg = argv.find(a => a.startsWith('--min-lines='));
  let minLines = DEFAULT_MIN_LINES;
  if (minLinesArg) {
    const parsed = parseInt(minLinesArg.slice('--min-lines='.length), 10);
    if (!isNaN(parsed) && parsed > 0) minLines = parsed;
  }

  // 解析 --limit 参数
  const limitArg = argv.find(a => a.startsWith('--limit='));
  let limit = DEFAULT_LIMIT;
  if (limitArg) {
    const parsed = parseInt(limitArg.slice('--limit='.length), 10);
    if (!isNaN(parsed) && parsed > 0) limit = parsed;
  }

  const { db, repoRoot } = openDb(argv);

  // 解析 --kind 参数（可多值，逗号分隔）
  const kindArg = argv.find(a => a.startsWith('--kind='));
  const kinds = kindArg
    ? kindArg.slice('--kind='.length).split(',').map(s => s.trim()).filter(Boolean)
    : ['function', 'method'];

  const placeholders = kinds.map(() => '?').join(', ');

  // 查询指定 kind 节点，计算行数（含首尾两端：+1）
  const rows = db.prepare(`
    SELECT id, name, file_path, kind,
           (line_end - line_start + 1) AS loc
    FROM nodes
    WHERE kind IN (${placeholders})
      AND line_start IS NOT NULL
      AND line_end IS NOT NULL
      AND (line_end - line_start + 1) >= ?
    ORDER BY loc DESC
    LIMIT ?
  `).all(...kinds, minLines, limit);

  db.close();

  const items = rows.map(row => ({
    id: row.id,
    name: row.name,
    file_path: row.file_path,
    kind: row.kind,
    loc: row.loc,
  }));

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, {
      items,
      query: { min_lines: minLines, limit },
    })) + '\n'
  );
}

module.exports = { run };
