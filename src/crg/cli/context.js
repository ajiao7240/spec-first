'use strict';

/**
 * CRG context 子命令：返回代码图紧凑概览
 *
 * 输出 top_hubs（高连通节点）、top_communities（主要社区）、
 * top_flows（关键流程）以及 summary 摘要字符串。
 *
 * 注意：Unit 7 尚未实现 PageRank，top_hubs 暂以 rowid 降序作为占位。
 */

const path = require('path');
const fs = require('fs');
const { makeEnvelope } = require('./envelope');
const { resolveGraphDb } = require('../artifact-paths');

/**
 * 加载 better-sqlite3，失败时 exit 2
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
 * context 子命令入口（由 router.js 调用）
 *
 * @param {string[]} argv - router.js 传入的参数
 */
function run(argv) {
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
    process.stderr.write('error: --repo=<path> is required for crg context\n');
    process.exit(1);
  }

  const repoRoot = path.resolve(repoRaw);
  const dbPath = resolveGraphDb(repoRoot);

  // 检查图是否已构建
  if (!fs.existsSync(dbPath)) {
    process.stderr.write(
      `error: CRG graph not built. Run: spec-first crg build --repo=${repoRoot}\n`
    );
    process.exit(2);
  }

  // 延迟加载 better-sqlite3
  requireSqlite();

  const { initDatabase } = require('../migrations');

  try {
    db = initDatabase(dbPath);

    // top_hubs：按入度（incoming edges 数量）降序，取前 5 个非 module 节点
    const topHubs = db
      .prepare(
        `SELECT n.id, n.name, n.file_path, n.kind, n.line_start, n.line_end, n.is_test,
                COUNT(e.id) AS in_degree
         FROM nodes n
         LEFT JOIN edges e ON e.target_id = n.id
         WHERE n.kind != 'module'
         GROUP BY n.id
         ORDER BY in_degree DESC
         LIMIT 5`
      )
      .all()
      .map(row => ({
        id: row.id,
        name: row.name,
        file_path: row.file_path,
        kind: row.kind,
        line_start: row.line_start,
        line_end: row.line_end,
        is_test: row.is_test,
        confidence: 'Inferred',
        source_tier: 'crg_ast',
        evidence: [`context top_hub in_degree=${row.in_degree}`],
        inference_reason: 'call_graph_traversal',
      }));

    // top_communities：按 file_count 降序，取前 3；alias id → community_id（schema 要求）
    const topCommunities = db
      .prepare(
        `SELECT id AS community_id, label, file_count
         FROM communities
         ORDER BY file_count DESC
         LIMIT 3`
      )
      .all();

    // top_flows：按 criticality 降序，取前 3；alias 字段匹配 FlowBrief schema
    const topFlows = db
      .prepare(
        `SELECT id AS flow_id, entry_node_id AS entry_node, criticality, node_count
         FROM flows
         ORDER BY criticality DESC
         LIMIT 3`
      )
      .all();

    // summary：图规模摘要，供 AI 消费者快速建立仓库全局视角
    const stats = db.prepare(
      'SELECT (SELECT COUNT(*) FROM nodes) AS node_count,' +
      '       (SELECT COUNT(*) FROM edges) AS edge_count,' +
      '       (SELECT COUNT(*) FROM communities) AS community_count,' +
      '       (SELECT COUNT(*) FROM flows) AS flow_count'
    ).get();
    const summary = `${stats.node_count} nodes, ${stats.edge_count} edges, ` +
      `${stats.community_count} communities, ${stats.flow_count} flows`;

    const envelope = makeEnvelope(repoRoot, {
      top_hubs: topHubs,
      top_communities: topCommunities,
      top_flows: topFlows,
      summary,
    });

    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  } finally {
    // 确保 WAL checkpoint 并释放文件句柄
    try { if (db) db.close(); } catch (_) {}
  }
}

module.exports = { run };
