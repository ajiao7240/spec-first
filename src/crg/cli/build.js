'use strict';

/**
 * CRG build 子命令：全量/增量构建代码图
 * CRG stats 子命令：查看已构建代码图的统计信息
 *
 * 均在本文件中实现，分别导出 run（build）和 runStats（stats）。
 *
 * 注意：better-sqlite3 为可选原生模块，未安装时 exit 2 给出清晰提示。
 */

const path = require('path');
const fs = require('fs');
const { makeEnvelope } = require('./envelope');

// ---------------------------------------------------------------------------
// 共用：尝试加载 better-sqlite3
// ---------------------------------------------------------------------------

/**
 * 加载 better-sqlite3，失败时打印提示并 exit 2
 *
 * @returns {Function} better-sqlite3 构造函数（仅用于验证是否可加载）
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

// ---------------------------------------------------------------------------
// 后处理占位调用（Unit 7 实现，此处仅安全 try/catch）
// ---------------------------------------------------------------------------

/**
 * 尝试调用 Unit 7 的后处理逻辑（社区检测、PageRank、flows 等）。
 * MODULE_NOT_FOUND 时静默跳过，其他错误继续上抛。
 *
 * @param {object} db - better-sqlite3 db 实例
 */
function tryPostprocess(db) {
  try {
    const { runPostprocess } = require('./postprocess');
    runPostprocess(db);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
    // Unit 7 尚未实现，跳过
  }
}

// ---------------------------------------------------------------------------
// build 子命令
// ---------------------------------------------------------------------------

/**
 * 解析 build 所需参数
 *
 * @param {string[]} argv
 * @returns {{ repo: string|null, force: boolean }}
 */
function parseBuildArgs(argv) {
  let repo = null;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--repo=')) {
      repo = argv[i].slice('--repo='.length);
    } else if (argv[i] === '--repo' && i + 1 < argv.length) {
      repo = argv[++i];
    } else if (argv[i] === '--force') {
      force = true;
    }
  }

  return { repo, force };
}

/**
 * build 子命令核心逻辑（async，由 run 入口驱动）
 *
 * @param {string[]} argv - router.js 传入的参数（不含子命令名本身）
 */
async function runBuildAsync(argv) {
  const startTime = Date.now();

  const { repo: repoRaw, force } = parseBuildArgs(argv);

  // --repo 是必填参数
  if (!repoRaw) {
    process.stderr.write('error: --repo=<path> is required for crg build\n');
    process.exit(1);
  }

  // 解析并验证目录（router.js 已处理，但 build.js 独立保持可测）
  const repoRoot = path.resolve(repoRaw);
  try {
    const stat = fs.statSync(repoRoot);
    if (!stat.isDirectory()) {
      process.stderr.write(`error: --repo path is not a directory: ${repoRoot}\n`);
      process.exit(1);
    }
  } catch (_) {
    process.stderr.write(`error: --repo path does not exist: ${repoRoot}\n`);
    process.exit(1);
  }

  // 延迟加载 better-sqlite3（未安装时 exit 2）
  requireSqlite();

  // 延迟加载内部模块（确保原生包已可用）
  const { initDatabase } = require('../migrations');
  const { collectInputFiles } = require('../input-convergence');
  const { parseFile } = require('../parser');
  const { detectChangedFiles, updateFingerprints } = require('../incremental');
  const {
    upsertNodes,
    upsertEdges,
    deleteStaleNodes,
    resolveEdges,
    setUnresolvedEdgeCount,
  } = require('../graph');

  // 确保 .spec-first-graph/ 目录存在
  const graphDir = path.join(repoRoot, '.spec-first-graph');
  if (!fs.existsSync(graphDir)) {
    fs.mkdirSync(graphDir, { recursive: true });
  }

  const dbPath = path.join(graphDir, 'graph.db');
  const db = initDatabase(dbPath);

  try {
    // 收集输入文件（async）
    const { finalInputs } = await collectInputFiles(repoRoot);

    // --force 时清空 fingerprints，强制全量重建
    if (force) {
      db.prepare('DELETE FROM fingerprints').run();
    }

    // 增量检测
    const { changed, deleted } = detectChangedFiles(db, finalInputs, repoRoot);

    // 处理已删除文件：移除节点 + 更新 fingerprints
    deleteStaleNodes(db, deleted);
    updateFingerprints(db, [], deleted, repoRoot);

    // 解析变更文件，收集节点和原始边
    const allRawEdges = [];
    for (const file of changed) {
      const result = parseFile(file, repoRoot);
      if (!result.skipped) {
        upsertNodes(db, result.nodes);
        allRawEdges.push(...result.rawEdges);
      }
    }

    // 批量解析边并写入
    const { resolved, unresolvedCount } = resolveEdges(db, allRawEdges, repoRoot);
    upsertEdges(db, resolved);
    setUnresolvedEdgeCount(db, unresolvedCount);

    // 更新 fingerprints
    updateFingerprints(db, changed, [], repoRoot);

    // 更新 graph_meta.last_built
    db.prepare(`UPDATE graph_meta SET last_built = datetime('now') WHERE id = 1`).run();

    // 后处理占位（Unit 7）
    tryPostprocess(db);

    // 写入 fingerprints.json（Unit 9）
    writeFingerprintsJson(db, repoRoot);

    // 统计计数
    const nodeCount = db.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
    const edgeCount = db.prepare('SELECT COUNT(*) as c FROM edges').get().c;
    const durationMs = Date.now() - startTime;

    const envelope = makeEnvelope(repoRoot, {
      node_count: nodeCount,
      edge_count: edgeCount,
      changed_files: changed.length,
      duration_ms: durationMs,
    });

    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } finally {
    try { db.close(); } catch (_) {}
  }
}

/**
 * build 子命令入口（由 router.js 调用）
 *
 * @param {string[]} argv
 */
function run(argv) {
  runBuildAsync(argv).catch((err) => {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  });
}

// ---------------------------------------------------------------------------
// stats 子命令
// ---------------------------------------------------------------------------

/**
 * stats 子命令入口（由 router.js 调用）
 *
 * @param {string[]} argv - router.js 传入的参数
 */
function runStats(argv) {
  // 解析 --repo
  let repoRaw = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--repo=')) {
      repoRaw = argv[i].slice('--repo='.length);
    } else if (argv[i] === '--repo' && i + 1 < argv.length) {
      repoRaw = argv[++i];
    }
  }

  if (!repoRaw) {
    process.stderr.write('error: --repo=<path> is required for crg stats\n');
    process.exit(1);
  }

  const repoRoot = path.resolve(repoRaw);
  const dbPath = path.join(repoRoot, '.spec-first-graph', 'graph.db');

  // 检查图是否已构建
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
    const db = initDatabase(dbPath);

    const nodeCount = db.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
    const edgeCount = db.prepare('SELECT COUNT(*) as c FROM edges').get().c;

    // corpus_health：统计非 module 节点行数之和
    const locRow = db
      .prepare(`SELECT SUM(line_end - line_start) as total FROM nodes WHERE kind != 'module'`)
      .get();
    const totalLoc = locRow.total || 0;

    let healthStatus;
    if (totalLoc < 30000) {
      healthStatus = 'small';
    } else if (totalLoc <= 500000) {
      healthStatus = 'optimal';
    } else {
      healthStatus = 'large';
    }

    const metaRow = db
      .prepare('SELECT last_built, unresolved_edge_count FROM graph_meta WHERE id = 1')
      .get();
    const lastBuilt = metaRow ? metaRow.last_built : null;
    const unresolvedEdgeCount = metaRow ? (metaRow.unresolved_edge_count || 0) : 0;

    const envelope = makeEnvelope(repoRoot, {
      node_count: nodeCount,
      edge_count: edgeCount,
      corpus_health: {
        status: healthStatus,
        total_loc: totalLoc,
      },
      last_built: lastBuilt,
      unresolved_edge_count: unresolvedEdgeCount,
    });

    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  } finally {
    try { db.close(); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// fingerprints.json 产物管理（Unit 9）
// ---------------------------------------------------------------------------

/**
 * 写入 .spec-first-graph/fingerprints.json
 *
 * 记录当次构建的输入文件指纹（SHA-256）和输出产物，供增量刷新稳定性验证使用。
 *
 * @param {object} db - better-sqlite3 db 实例
 * @param {string} repoRoot - 仓库根目录
 */
function writeFingerprintsJson(db, repoRoot) {
  const fingerprints = db.prepare('SELECT file_path, sha256 FROM fingerprints').all();
  const meta = db.prepare('SELECT * FROM graph_meta WHERE id = 1').get();

  const pkg = (() => {
    try { return require('../../../package.json'); } catch { return { version: 'unknown' }; }
  })();

  const data = {
    schema_version: meta?.schema_version || 'crg-cli/v1',
    analyzer_version: pkg.version,
    generated_at: new Date().toISOString(),
    inputs: Object.fromEntries(fingerprints.map(f => [f.file_path, f.sha256])),
    outputs: {
      'graph.db': 'sqlite-database',
    },
  };

  const outPath = path.join(repoRoot, '.spec-first-graph', 'fingerprints.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
}

module.exports = { run, runStats };
