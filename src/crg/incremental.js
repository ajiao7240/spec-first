'use strict';

/**
 * CRG 增量检测层
 *
 * 功能：
 *   - 基于 SHA256 批量检测文件是否发生变更
 *   - 对比 fingerprints 表中的历史记录，分类 changed / unchanged / deleted
 *   - 批量 UPSERT + DELETE 更新 fingerprints 表（单事务）
 *
 * 注意：
 *   - better-sqlite3 由调用方（build.js）负责加载和传入，本模块不处理 db=undefined
 *   - SQLite 变量数上限默认 999，大批量查询按 CHUNK_SIZE=900 分片
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** SQLite IN 子句分片大小（低于默认 SQLITE_MAX_VARIABLE_NUMBER=999） */
const CHUNK_SIZE = 900;

/**
 * 计算文件 SHA256
 *
 * @param {string} absolutePath - 文件绝对路径
 * @returns {{ sha: string, bytes: Buffer }|null} - null 表示读取失败（如 ENOENT）
 */
function computeFileSHA(absolutePath) {
  try {
    const bytes = fs.readFileSync(absolutePath);
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    return { sha, bytes };
  } catch {
    return null;
  }
}

/**
 * 批量检测文件变更（基于 SHA256 对比 fingerprints 表）
 *
 * 分类规则：
 *   - filePaths 中无 DB 记录，或 SHA 变化 → changed（含新文件）
 *   - filePaths 中有 DB 记录且 SHA 未变 → unchanged
 *   - DB 中有记录但不在 filePaths 中 → deleted
 *   - 文件读取失败（ENOENT）→ 从 filePaths 移出，归入 deleted
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 数据库实例
 * @param {string[]} filePaths - 相对于 repoRoot 的文件路径数组
 * @param {string} repoRoot - 仓库根目录绝对路径
 * @returns {{ changed: string[], unchanged: string[], deleted: string[], changedShas: Map<string, string> }}
 *   changedShas 供 updateFingerprints 复用，避免对同一文件进行二次 SHA 计算
 */
function detectChangedFiles(db, filePaths, repoRoot) {
  // -----------------------------------------------------------------------
  // 步骤 1：批量 SELECT 现有 fingerprints（分片避免变量数限制）
  // -----------------------------------------------------------------------
  const existingMap = {}; // file_path → sha256

  if (filePaths.length > 0) {
    for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
      const chunk = filePaths.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT file_path, sha256 FROM fingerprints WHERE file_path IN (${placeholders})`
        )
        .all(...chunk);
      for (const row of rows) {
        existingMap[row.file_path] = row.sha256;
      }
    }
  }

  // -----------------------------------------------------------------------
  // 步骤 2：获取 DB 中所有被追踪的文件路径（用于计算 deleted）
  // -----------------------------------------------------------------------
  const allTracked = new Set(
    db
      .prepare('SELECT file_path FROM fingerprints')
      .all()
      .map((r) => r.file_path)
  );

  // filePathSet 用于最终计算 deleted；文件读取失败时从中移除
  const filePathSet = new Set(filePaths);

  const changed = [];
  const unchanged = [];
  /** 本次计算的 SHA 缓存，供 updateFingerprints 复用（避免重复读取文件） */
  const changedShas = new Map();

  // -----------------------------------------------------------------------
  // 步骤 3：逐文件计算 SHA256，与 DB 记录对比
  // -----------------------------------------------------------------------
  for (const filePath of filePaths) {
    const absPath = path.join(repoRoot, filePath);
    const result = computeFileSHA(absPath);

    if (result === null) {
      // 文件读取失败（ENOENT 等）→ 视为已删除
      // 确保该路径能出现在 deleted 计算结果中
      allTracked.add(filePath);
      filePathSet.delete(filePath);
      continue;
    }

    const { sha } = result;
    if (existingMap[filePath] === sha) {
      unchanged.push(filePath);
    } else {
      // DB 无记录（新文件）或 SHA 变化（已修改文件）→ changed
      changed.push(filePath);
      changedShas.set(filePath, sha);
    }
  }

  // -----------------------------------------------------------------------
  // 步骤 4：deleted = DB 中有记录 但 不在 filePathSet 中
  // -----------------------------------------------------------------------
  const deleted = [...allTracked].filter((fp) => !filePathSet.has(fp));

  return { changed, unchanged, deleted, changedShas };
}

/**
 * 批量更新 fingerprints 表（单事务：UPSERT changed + DELETE deleted）
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} changedFiles - 需要 UPSERT 的文件路径（相对路径）
 * @param {string[]} deletedFiles - 需要 DELETE 的文件路径（相对路径）
 * @param {string} repoRoot - 仓库根目录绝对路径
 * @param {Map<string, string>} [changedShas] - detectChangedFiles 返回的 SHA 缓存（可选）
 *   提供时直接复用，避免对同一文件进行二次 SHA 计算
 */
function updateFingerprints(db, changedFiles, deletedFiles, repoRoot, changedShas) {
  const upsert = db.prepare(
    `INSERT INTO fingerprints (file_path, sha256, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(file_path) DO UPDATE SET
       sha256     = excluded.sha256,
       updated_at = excluded.updated_at`
  );

  const del = db.prepare(`DELETE FROM fingerprints WHERE file_path = ?`);

  const doAll = db.transaction(() => {
    // UPSERT changed 文件（优先复用传入的 SHA 缓存，避免重复读取）
    for (const filePath of changedFiles) {
      let sha;
      if (changedShas && changedShas.has(filePath)) {
        sha = changedShas.get(filePath);
      } else {
        const absPath = path.join(repoRoot, filePath);
        const result = computeFileSHA(absPath);
        if (!result) continue; // 读取失败时跳过，等待下次增量检测归入 deleted
        sha = result.sha;
      }
      upsert.run(filePath, sha);
    }

    // DELETE deleted 文件
    for (const filePath of deletedFiles) {
      del.run(filePath);
    }
  });

  doAll();
}

module.exports = { detectChangedFiles, computeFileSHA, updateFingerprints };
