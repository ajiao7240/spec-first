'use strict';

/**
 * CRG changes.js — git diff 解析 + 风险评分
 *
 * 通过 git diff --name-only 获取变更文件，结合 nodes/edges 表计算 fan-in
 * 风险等级：High（fan-in >= 10）、Medium（fan-in >= 3）、Low（其他）。
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * 获取自 since 以来的变更文件列表（相对于 repoRoot 的路径）
 *
 * @param {string} repoRoot - 仓库根目录
 * @param {string} since - git SHA 或 HEAD~N
 * @returns {{ files: string[], error?: string }}
 */
function getChangedFilesFromGit(repoRoot, since) {
  try {
    const output = execSync(
      `git diff --name-only ${since} HEAD`,
      { cwd: repoRoot, encoding: 'utf8' }
    );
    const files = output.trim().split('\n').filter(Boolean);
    return { files };
  } catch (e) {
    return { files: [], error: e.message };
  }
}

/**
 * 计算单个文件的风险等级（基于 fan-in：有多少边指向该文件的 module 节点）
 *
 * @param {string} filePath - 文件路径（与 nodes.file_path 匹配的格式）
 * @param {object} db - better-sqlite3 db 实例
 * @returns {'High'|'Medium'|'Low'}
 */
function assessFileRisk(filePath, db) {
  try {
    const moduleNode = db.prepare(
      "SELECT id FROM nodes WHERE file_path = ? AND kind = 'module' LIMIT 1"
    ).get(filePath);

    if (!moduleNode) return 'Low';

    const fanIn = db.prepare(
      'SELECT COUNT(*) as cnt FROM edges WHERE target_id = ?'
    ).get(moduleNode.id)?.cnt || 0;

    if (fanIn >= 10) return 'High';
    if (fanIn >= 3) return 'Medium';
    return 'Low';
  } catch {
    return 'Low';
  }
}

/**
 * 获取变更文件中包含的函数/方法节点（风险等级继承文件级别）
 *
 * @param {string} filePath
 * @param {object} db
 * @returns {Array<{ name: string, kind: string, risk_level: string }>}
 */
function getAffectedFunctions(filePath, db) {
  try {
    const nodes = db.prepare(
      "SELECT name, kind FROM nodes WHERE file_path = ? AND kind IN ('function', 'method')"
    ).all(filePath);

    const risk = assessFileRisk(filePath, db);
    return nodes.map(n => ({
      name: n.name,
      kind: n.kind,
      risk_level: risk, // 函数级别暂继承文件级别风险
    }));
  } catch {
    return [];
  }
}

/**
 * 主入口：获取自 since 以来的变更分析结果
 *
 * @param {string} repoRoot - 仓库根目录
 * @param {string} since - git SHA 或 HEAD~N
 * @param {object|null} db - better-sqlite3 db 实例（null 时 risk_level='Unknown'）
 * @returns {Array<{ file: string, risk_level: string, functions: Array }>}
 * @throws {Error} since 为无效 git ref 时抛出，err.isUserError=true
 */
function detectChanges(repoRoot, since, db) {
  const { files, error } = getChangedFilesFromGit(repoRoot, since);

  if (error) {
    // 无效 git ref — 用户输错了，语义上是 exit 1
    if (
      error.includes('unknown revision') ||
      error.includes('bad revision') ||
      error.includes('Not a valid object name')
    ) {
      const err = new Error(`invalid git ref: ${since}`);
      err.isUserError = true;
      throw err;
    }
    // 其他错误（如不在 git 仓库中）继续返回空列表，由调用方决定处理
  }

  return files.map(file => ({
    file,
    risk_level: db ? assessFileRisk(file, db) : 'Unknown',
    functions: db ? getAffectedFunctions(file, db) : [],
  }));
}

module.exports = { detectChanges, getChangedFilesFromGit, assessFileRisk };
