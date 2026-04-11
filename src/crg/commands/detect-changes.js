'use strict';

/**
 * CRG detect-changes 子命令
 *
 * 用法：spec-first crg detect-changes --since=<git-ref> --repo=<path>
 *
 * 输出：JSON envelope，包含变更文件列表及每个文件的风险等级和受影响函数。
 * --since 缺失 → exit 1
 * --since 为无效 git ref → exit 1
 * graph.db 不存在或 better-sqlite3 未安装 → exit 2
 */

const { openDb } = require('../cli/open-db');
const { makeEnvelope } = require('../cli/envelope');
const { detectChanges } = require('../changes');

/**
 * detect-changes 子命令入口（由 router.js 调用）
 *
 * @param {string[]} argv - router.js 传入的参数（不含子命令名本身）
 */
function run(argv) {
  // 解析 --since=<git-ref>，缺失时 exit 1
  const sinceArg = argv.find(a => a.startsWith('--since='));
  if (!sinceArg) {
    process.stderr.write('error: --since=<git-ref> is required\n');
    process.exit(1);
  }
  const since = sinceArg.slice('--since='.length);

  // openDb 内部：graph.db 不存在或 better-sqlite3 未安装时 exit 2
  const { db, repoRoot } = openDb(argv);

  try {
    const items = detectChanges(repoRoot, since, db);
    process.stdout.write(
      JSON.stringify(makeEnvelope(repoRoot, { since, items })) + '\n'
    );
  } catch (e) {
    if (e.isUserError) {
      // 无效 git ref 等用户错误 → exit 1
      process.stderr.write(`error: ${e.message}\n`);
      process.exit(1);
    }
    // 其他意外错误 → exit 2
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  } finally {
    try { db.close(); } catch (_) {}
  }
}

module.exports = { run };
