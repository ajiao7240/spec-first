'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  GRAPH_CODE_NAVIGATION_FILE,
  GRAPH_INDEX_STATUS_FILE,
  resolveGraphDir,
} = require('../artifact-paths');
const { resolveActiveGraphDb } = require('../generations/paths');

function loadNativeSqlite() {
  try {
    return { Database: require('better-sqlite3'), error: null };
  } catch (error) {
    return { Database: null, error };
  }
}

function safeCount(db, table) {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
    return row ? row.count || 0 : 0;
  } catch (_) {
    return 0;
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function buildGraphStatus(repoRoot) {
  const normalizedRepoRoot = path.resolve(repoRoot || process.cwd());
  const graphDir = resolveGraphDir(normalizedRepoRoot);
  const dbPath = resolveActiveGraphDb(normalizedRepoRoot);
  const statusPath = path.join(graphDir, GRAPH_INDEX_STATUS_FILE);
  const navigationPath = path.join(graphDir, GRAPH_CODE_NAVIGATION_FILE);
  const persistedStatus = readJsonIfExists(statusPath);
  const limitations = [];

  const base = {
    schema_version: 'graph-index-status/v1',
    repo_root: normalizedRepoRoot,
    graph_dir: graphDir,
    active_db_path: dbPath,
    status_path: statusPath,
    navigation_path: navigationPath,
    state: 'missing',
    capabilities: {
      locate: false,
      path: false,
      explain: false,
      impact: false,
      review_context: false,
      workflow_context: true,
      hook: true,
    },
    freshness: {
      state: 'unknown',
      checked_at: new Date().toISOString(),
    },
    stats: {
      node_count: 0,
      edge_count: 0,
      community_count: 0,
      flow_count: 0,
    },
    limitations,
  };

  if (!fs.existsSync(dbPath)) {
    limitations.push({
      code: 'graph-db-missing',
      message: 'CRG graph.db is not available; use direct repo reads or run spec-first crg build.',
    });
    return { ...base, persisted_status: persistedStatus || null };
  }

  const { Database, error } = loadNativeSqlite();
  if (!Database) {
    limitations.push({
      code: 'native-sqlite-unavailable',
      message: 'better-sqlite3 is unavailable; CRG query commands cannot open graph.db.',
      detail: error && error.message ? error.message : String(error || ''),
    });
    return {
      ...base,
      state: 'unavailable',
      persisted_status: persistedStatus || null,
    };
  }

  let db = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const stats = {
      node_count: safeCount(db, 'nodes'),
      edge_count: safeCount(db, 'edges'),
      community_count: safeCount(db, 'communities'),
      flow_count: safeCount(db, 'flows'),
    };
    const hasGraph = stats.node_count > 0;
    return {
      ...base,
      state: hasGraph ? 'ready' : 'degraded',
      capabilities: {
        locate: hasGraph,
        path: hasGraph,
        explain: hasGraph,
        impact: hasGraph,
        review_context: hasGraph,
        workflow_context: true,
        hook: true,
      },
      freshness: {
        state: 'not_checked',
        checked_at: new Date().toISOString(),
      },
      stats,
      persisted_status: persistedStatus || null,
      limitations: hasGraph
        ? limitations
        : [{
            code: 'graph-empty',
            message: 'CRG graph exists but contains no nodes.',
          }],
    };
  } catch (error) {
    limitations.push({
      code: 'graph-open-failed',
      message: error && error.message ? error.message : String(error),
    });
    return {
      ...base,
      state: 'unavailable',
      persisted_status: persistedStatus || null,
    };
  } finally {
    try { if (db) db.close(); } catch (_) {}
  }
}

module.exports = {
  buildGraphStatus,
};
