'use strict';

/**
 * CRG postprocess 子命令
 *
 * 支持两种调用方式：
 * 1. CLI 入口：run(argv) — 解析 --repo，打开 DB，执行后处理，输出 envelope
 * 2. 内部调用：runPostprocess(db) — 直接接受 db 实例，由 build.js 调用
 *
 * 后处理步骤顺序（不可颠倒）：
 *   writeCommunities → detectFlows → analyzeGraph → rebuildFTS
 *
 * 原因：
 *   - writeCommunities：写入社区边界（analyzeGraph 中 surprising_connections 需要）
 *   - detectFlows：依赖 canonical edges，不依赖 communities
 *   - analyzeGraph：依赖 communities AND flows
 *   - rebuildFTS：依赖最终 nodes 状态（含 community_id 更新后）
 */

const path = require('path');
const fs = require('fs');
const { resolveActiveGraphDb } = require('../generations/paths');

/**
 * 尝试加载 better-sqlite3，失败时打印提示并 exit 2
 *
 * @returns {Function} better-sqlite3 构造函数
 */
function requireSqlite() {
  try {
    return require('better-sqlite3');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      process.stderr.write(
        'error: CRG native module (better-sqlite3) not installed. Run: npm install\n'
      );
      process.exit(2);
    }
    throw err;
  }
}

/**
 * 执行后处理步骤（核心逻辑，接受 db 对象）
 *
 * 供 build.js 内部调用，不解析 CLI 参数。
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 db 实例
 * @returns {{ community_count: number, flow_count: number, hub_count: number, fts_indexed: number }}
 */
function runPostprocess(db) {
  const { writeCommunities } = require('../communities');
  const { detectFlows } = require('../flows');
  const { analyzeGraph } = require('../analyze');
  const { rebuildFTS } = require('../search');

  // 步骤 1: 社区检测（必须最先执行，建立社区边界）
  const communityResult = writeCommunities(db);

  // 步骤 2: 执行流检测（依赖 edges，不依赖 communities）
  const flowResult = detectFlows(db);

  // 步骤 3: 图分析（依赖 communities + flows）
  const analyzeResult = analyzeGraph(db);

  // 步骤 4: 重建 FTS5 索引（依赖最终 nodes 状态）
  const ftsResult = rebuildFTS(db);

  return {
    community_count: communityResult.community_count,
    flow_count: flowResult.flow_count,
    hub_count: analyzeResult.hubs.length,
    surprising_count: analyzeResult.surprising.length,
    fts_indexed: ftsResult.indexed_count,
    fts_skipped: ftsResult.skipped_count,
  };
}

/**
 * postprocess CLI 子命令入口
 *
 * 解析 --repo 参数，打开 DB，调用 runPostprocess，输出 envelope。
 * DB 不存在时 exit 2 给出清晰提示。
 *
 * @param {string[]} argv - router.js 传入的参数（不含子命令名本身）
 */
function run(argv) {
  const { makeEnvelope } = require('./envelope');
  let db;

  // 解析 --repo 参数
  let repoRaw = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--repo=')) {
      repoRaw = argv[i].slice('--repo='.length);
    } else if (argv[i] === '--repo' && i + 1 < argv.length) {
      repoRaw = argv[++i];
    }
  }

  if (!repoRaw) {
    process.stderr.write('error: --repo=<path> is required for crg postprocess\n');
    process.exit(1);
  }

  const repoRoot = path.resolve(repoRaw);

  // 检查图是否已构建
  const dbPath = resolveActiveGraphDb(repoRoot);
  if (!fs.existsSync(dbPath)) {
    process.stderr.write(
      `error: CRG graph not built. Run: spec-first crg build --repo=${repoRoot}\n`
    );
    process.exit(2);
  }

  // 延迟加载 better-sqlite3（未安装时 exit 2）
  requireSqlite();

  const { initDatabase } = require('../migrations');

  try {
    db = initDatabase(dbPath);
    const stats = runPostprocess(db);

    const envelope = makeEnvelope(repoRoot, {
      community_count: stats.community_count,
      flow_count: stats.flow_count,
      hub_count: stats.hub_count,
      surprising_count: stats.surprising_count,
      fts_indexed: stats.fts_indexed,
      fts_skipped: stats.fts_skipped,
    });

    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  } finally {
    try { if (db) db.close(); } catch (_) {}
  }
}

module.exports = { run, runPostprocess };
