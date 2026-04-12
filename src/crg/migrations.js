'use strict';

/**
 * CRG SQLite schema 初始化与版本管理
 *
 * 调用方式：
 *   const { initDatabase } = require('./migrations');
 *   const db = initDatabase('/path/to/graph.db');
 *
 * 注意：better-sqlite3 在 Unit 2 阶段尚未 npm install，
 * require('better-sqlite3') 是运行时行为，编写阶段不需要可运行。
 */

const SCHEMA_VERSION = 'crg-cli/v1';

/**
 * 所有 DDL 语句（按依赖顺序排列）
 * communities 须先于 nodes 创建（nodes 外键引用 communities.id）
 */
const DDL_STATEMENTS = [
  // PRAGMA 设置
  `PRAGMA foreign_keys = ON`,
  `PRAGMA journal_mode = WAL`,

  // communities 表（先建，供 nodes 外键引用）
  `CREATE TABLE IF NOT EXISTS communities (
    id TEXT PRIMARY KEY,
    label TEXT,
    file_count INTEGER DEFAULT 0,
    health_status TEXT CHECK (health_status IN ('healthy', 'isolated', 'fragmented', 'scattered') OR health_status IS NULL),
    health_density REAL,
    health_independence REAL
  )`,

  // nodes 表
  `CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    line_start INTEGER,
    line_end INTEGER,
    is_test INTEGER DEFAULT 0,
    community_id TEXT,
    confidence TEXT DEFAULT 'Observed',
    source_tier TEXT DEFAULT 'crg_ast',
    evidence TEXT DEFAULT '[]',
    inference_reason TEXT,
    FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL
  )`,

  // edges 表
  `CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
  )`,

  // flows 表
  `CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    entry_node_id TEXT,
    name TEXT,
    criticality REAL DEFAULT 0.0,
    node_count INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    FOREIGN KEY (entry_node_id) REFERENCES nodes(id) ON DELETE SET NULL
  )`,

  // flow_nodes 表（flow 和 node 的多对多）
  `CREATE TABLE IF NOT EXISTS flow_nodes (
    flow_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (flow_id, node_id),
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  )`,

  // graph_meta 表（单行，强制 id=1）
  `CREATE TABLE IF NOT EXISTS graph_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version TEXT DEFAULT 'crg-cli/v1',
    last_built TEXT,
    analyzer_version TEXT,
    unresolved_edge_count INTEGER DEFAULT 0
  )`,

  // fingerprints 表（文件 SHA 增量检测）
  `CREATE TABLE IF NOT EXISTS fingerprints (
    file_path TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // unresolved_edges 表（最近一次 build 的 unresolved 明细，便于审计和治理）
  `CREATE TABLE IF NOT EXISTS unresolved_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    source_file TEXT NOT NULL,
    edge_kind TEXT NOT NULL,
    target_name TEXT,
    target_path_raw TEXT
  )`,

  // FTS5 虚表（全文搜索，独立存储，不使用 content= 外部内容表）
  // 注意：content=nodes 方案要求 FTS 列名与 nodes 表列名严格对应；
  //       独立 FTS 更简单，rebuildFTS 负责全量重建保持一致。
  `CREATE VIRTUAL TABLE IF NOT EXISTS fts_nodes USING fts5(
    node_id UNINDEXED,
    name,
    file_path UNINDEXED,
    kind UNINDEXED
  )`,

  // 索引
  `CREATE INDEX IF NOT EXISTS idx_nodes_file_path ON nodes(file_path)`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind)`,
  // Pass5 community 传播：WHERE file_path = ? AND kind = 'module' → 覆盖索引，避免全表扫描
  `CREATE INDEX IF NOT EXISTS idx_nodes_file_path_kind ON nodes(file_path, kind)`,
  // F3 测试覆盖：JOIN nodes ON is_test = 1 → 过滤测试节点
  `CREATE INDEX IF NOT EXISTS idx_nodes_is_test ON nodes(is_test)`,
  `CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)`,
  `CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)`,
  // F3/F5 assessNodeRisk：edges WHERE kind IN ('calls','imports_from') 过滤
  `CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind)`,
  `CREATE INDEX IF NOT EXISTS idx_unresolved_edges_source_file ON unresolved_edges(source_file)`,
  `CREATE INDEX IF NOT EXISTS idx_unresolved_edges_kind ON unresolved_edges(edge_kind)`,
];

/**
 * 初始化 CRG SQLite 数据库
 *
 * @param {string} dbPath  数据库文件路径（不存在时自动创建）
 * @returns {import('better-sqlite3').Database} better-sqlite3 db 实例
 */
function initDatabase(dbPath) {
  // 延迟 require，运行时才加载原生模块
  const Database = require('better-sqlite3');

  const db = new Database(dbPath);

  // 执行所有 DDL 语句
  for (const sql of DDL_STATEMENTS) {
    db.exec(sql);
  }

  // 迁移：检测旧版 content=nodes 的 fts_nodes（列名 node_id 与 nodes.id 不匹配）
  // 若 SQL 定义含 content=nodes，则 DROP 重建为独立 FTS5 表
  const ftsMeta = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='fts_nodes'")
    .get();
  if (ftsMeta && ftsMeta.sql && ftsMeta.sql.includes('content=nodes')) {
    db.exec('DROP TABLE IF EXISTS fts_nodes');
    db.exec(`CREATE VIRTUAL TABLE fts_nodes USING fts5(
      node_id UNINDEXED,
      name,
      file_path UNINDEXED,
      kind UNINDEXED
    )`);
  }

  // 迁移：flows 表若缺 name/depth 列，则补列（ADD COLUMN，不破坏现有数据）
  const flowsMeta = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='flows'")
    .get();
  if (flowsMeta && flowsMeta.sql) {
    if (!flowsMeta.sql.includes('"name"') && !flowsMeta.sql.includes(' name ')) {
      db.exec('ALTER TABLE flows ADD COLUMN name TEXT');
    }
    if (!flowsMeta.sql.includes('"depth"') && !flowsMeta.sql.includes(' depth ')) {
      db.exec('ALTER TABLE flows ADD COLUMN depth INTEGER DEFAULT 0');
    }
  }

  // 迁移：communities 表若无 CHECK 约束，则重建以添加 health_status CHECK
  const commMeta = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='communities'")
    .get();
  if (commMeta && commMeta.sql && !commMeta.sql.includes('CHECK')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS communities_new (
        id TEXT PRIMARY KEY,
        label TEXT,
        file_count INTEGER DEFAULT 0,
        health_status TEXT CHECK (health_status IN ('healthy', 'isolated', 'fragmented', 'scattered') OR health_status IS NULL),
        health_density REAL,
        health_independence REAL
      )
    `);
    db.exec(`INSERT OR IGNORE INTO communities_new SELECT * FROM communities`);
    db.exec(`DROP TABLE communities`);
    db.exec(`ALTER TABLE communities_new RENAME TO communities`);
  }

  // 确保 graph_meta 单行存在（schema 版本写入）
  db.prepare(
    `INSERT OR IGNORE INTO graph_meta (id, schema_version) VALUES (1, ?)`
  ).run(SCHEMA_VERSION);

  return db;
}

module.exports = { initDatabase, SCHEMA_VERSION };
