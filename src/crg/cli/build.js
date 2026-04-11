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
 * 尝试调用后处理逻辑（社区检测、PageRank、flows 等）。
 * postprocess 模块自身不存在时静默跳过；传递依赖缺失等错误正常上抛。
 *
 * @param {object} db - better-sqlite3 db 实例
 */
function tryPostprocess(db) {
  // 先用 require.resolve 检查 postprocess 模块是否存在（不执行）
  // 若模块自身缺失（MODULE_NOT_FOUND），静默跳过
  try {
    require.resolve('./postprocess');
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') return;
    throw e;
  }
  // 模块存在，正常加载并执行（传递依赖缺失等错误允许上抛）
  const { runPostprocess } = require('./postprocess');
  runPostprocess(db);
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
    // 收集输入文件（async）；collectInputFiles 在收集层已通过语言过滤保证 finalInputs 为纯代码文件
    const { finalInputs, stats: inputStats } = await collectInputFiles(repoRoot);
    const inputSet = new Set(finalInputs);

    // 当前输入集之外的历史图路径也必须清理：
    // 仅依赖 fingerprints 会遗漏”已从输入规则中排除、但旧节点仍残留”的路径。
    const existingGraphPaths = db
      .prepare(`
        SELECT file_path FROM nodes
        UNION
        SELECT file_path FROM fingerprints
      `)
      .all()
      .map((row) => row.file_path);
    const prunedPaths = existingGraphPaths.filter((filePath) => !inputSet.has(filePath));

    // --force 时清空 fingerprints，强制全量重建
    if (force) {
      db.prepare('DELETE FROM fingerprints').run();
    }

    // 增量检测（changedShas 供后续 updateFingerprints 复用，避免二次读取）
    const { changed, deleted, changedShas } = detectChangedFiles(db, finalInputs, repoRoot);
    const deletedPaths = [...new Set([...deleted, ...prunedPaths])];

    // 处理已删除文件：移除节点 + 更新 fingerprints
    deleteStaleNodes(db, deletedPaths);
    updateFingerprints(db, [], deletedPaths, repoRoot);

    // 解析变更文件，收集节点和原始边
    const allRawEdges = [];
    const skippedChanged = [];
    const parsedChanged = [];
    for (const file of changed) {
      const result = parseFile(file, repoRoot);
      if (result.skipped) {
        skippedChanged.push(file);
        continue;
      }
      parsedChanged.push(file);
      upsertNodes(db, result.nodes);
      allRawEdges.push(...result.rawEdges);
    }

    // 批量解析边并写入
    const { resolved, unresolvedCount } = resolveEdges(db, allRawEdges, repoRoot);
    upsertEdges(db, resolved);
    // 仅在实际处理了文件时更新 unresolved_edge_count：
    //   增量构建 0 变更时 unresolvedCount=0，不代表真实情况，保留上一次全量构建的值
    if (parsedChanged.length > 0 || force) {
      setUnresolvedEdgeCount(db, unresolvedCount);
    }

    // 更新 fingerprints：
    //   - 仅为真正入图的变更文件 upsert
    //   - 对解析阶段 skipped 的文件做 delete，避免留下无效指纹
    updateFingerprints(db, parsedChanged, skippedChanged, repoRoot, changedShas);

    // 更新 graph_meta.last_built
    db.prepare(`UPDATE graph_meta SET last_built = ? WHERE id = 1`).run(new Date().toISOString());

    // 后处理占位（Unit 7）
    tryPostprocess(db);

    // 写入 fingerprints.json（Unit 9）
    writeFingerprintsJson(db, repoRoot);

    // 统计计数
    const nodeCount = db.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
    const edgeCount = db.prepare('SELECT COUNT(*) as c FROM edges').get().c;
    const durationMs = Date.now() - startTime;
    const skippedSensitive = inputStats.ignored_files_by_rule.sensitive_pattern || 0;
    const warnings = [];
    const unresolvedRate = allRawEdges.length > 0 ? unresolvedCount / allRawEdges.length : 0;

    if (skippedSensitive > 0) {
      process.stderr.write(`warning: skipped_sensitive: ${skippedSensitive}\n`);
      warnings.push({
        type: 'skipped_sensitive',
        count: skippedSensitive,
      });
    }

    if (unresolvedRate > 0.1) {
      warnings.push({
        type: 'high_unresolved_edge_rate',
        rate: unresolvedRate,
        unresolved_count: unresolvedCount,
      });
    }

    const envelope = makeEnvelope(repoRoot, {
      node_count: nodeCount,
      edge_count: edgeCount,
      changed_files: parsedChanged.length,
      duration_ms: durationMs,
      skipped_sensitive: skippedSensitive,
      unresolved_edge_count: unresolvedCount,
    }, { warnings });

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
  let db;
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
    db = initDatabase(dbPath);

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
    const fingerprintRows = db
      .prepare('SELECT file_path, sha256 FROM fingerprints')
      .all();
    const { computeFileSHA } = require('../incremental');
    const staleFiles = [];
    for (const row of fingerprintRows) {
      const absPath = path.join(repoRoot, row.file_path);
      const current = computeFileSHA(absPath);
      if (!current || current.sha !== row.sha256) {
        staleFiles.push(row.file_path);
      }
    }

    const warnings = [];
    if (staleFiles.length > 0) {
      warnings.push({
        type: 'stale',
        stale_files: staleFiles,
      });
    }

    const envelope = makeEnvelope(repoRoot, {
      node_count: nodeCount,
      edge_count: edgeCount,
      corpus_health: {
        status: healthStatus,
        total_loc: totalLoc,
      },
      last_built: lastBuilt,
      unresolved_edge_count: unresolvedEdgeCount,
    }, { warnings });

    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  } finally {
    try { if (db) db.close(); } catch (_) {}
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
