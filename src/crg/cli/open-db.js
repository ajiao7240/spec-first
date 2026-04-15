'use strict';

const fs = require('fs');
const path = require('path');
const { resolveActiveGraphDb } = require('../generations/paths');

/**
 * 解析 --repo 参数并以只读模式打开 SQLite DB
 *
 * @param {string[]} argv - handler 接收到的参数列表（已归一化为 --repo=<abs>）
 * @returns {{ db: import('better-sqlite3').Database, repoRoot: string }}
 */
function openDb(argv) {
  // 1. 找 --repo 参数
  const repoArg = argv.find(a => a.startsWith('--repo='));
  if (!repoArg) {
    process.stderr.write('error: --repo=<path> is required\n');
    process.exit(1);
  }
  const repoRoot = path.resolve(repoArg.slice('--repo='.length));

  // 2. 验证目录（router.js 已做一次验证，这里做防御性二次校验）
  try {
    fs.statSync(repoRoot);
  } catch {
    process.stderr.write(`error: directory not found: ${repoRoot}\n`);
    process.exit(1);
  }

  // 3. 检查 DB 文件
  const dbPath = resolveActiveGraphDb(repoRoot);
  if (!fs.existsSync(dbPath)) {
    process.stderr.write(
      `error: CRG graph not built. Run: spec-first crg build --repo=${repoRoot}\n`
    );
    process.exit(2);
  }

  // 4. 加载 better-sqlite3（原生模块）
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    process.stderr.write(
      'error: CRG native module (better-sqlite3) not installed. Run: npm install\n'
    );
    process.exit(2);
  }

  // 5. 以只读模式打开，启用外键约束
  const db = new Database(dbPath, { readonly: true });
  db.pragma('foreign_keys = ON');

  return { db, repoRoot };
}

module.exports = { openDb };
