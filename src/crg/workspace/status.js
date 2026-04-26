'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolveWorkspaceStatus } = require('../artifact-paths');
const { buildGraphStatus } = require('../workflow-context/status');
const { normalizeWorkspaceRoot } = require('./artifacts');
const { discoverWorkspace } = require('./discovery');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function graphSignal(state) {
  if (state === 'ready') return 'graph_ready';
  if (state === 'degraded' || state === 'unavailable') return 'graph_degraded';
  return 'graph_missing';
}

function readinessFromGraphState(state) {
  if (state === 'ready') return 'ready';
  if (state === 'degraded') return 'degraded';
  if (state === 'unavailable') return 'unavailable';
  return 'missing';
}

function summarize(children) {
  return {
    child_count: children.length,
    candidate_count: children.filter((child) => child.candidate).length,
    ready_count: children.filter((child) => child.readiness === 'ready').length,
    missing_count: children.filter((child) => child.readiness === 'missing').length,
    degraded_count: children.filter((child) => child.readiness === 'degraded' || child.readiness === 'unavailable').length,
  };
}

function buildWorkspaceStatus(workspaceRootInput, options = {}) {
  const workspaceRoot = normalizeWorkspaceRoot(workspaceRootInput || process.cwd());
  const index = discoverWorkspace(workspaceRoot, { write: options.writeIndex !== false });
  const children = index.children.map((child) => {
    const graphStatus = buildGraphStatus(child.repo_root);
    const readiness = readinessFromGraphState(graphStatus.state);
    const signal = graphSignal(graphStatus.state);
    return {
      slug: child.slug,
      repo_root: child.repo_root,
      git_root: child.git_root,
      relative_path: child.relative_path,
      relationship: child.relationship,
      candidate: child.candidate,
      readiness,
      graph: {
        state: graphStatus.state,
        active_db_path: graphStatus.active_db_path,
        stats: graphStatus.stats,
        freshness: graphStatus.freshness,
        capabilities: graphStatus.capabilities,
      },
      signals: [...new Set([...child.signals, signal])],
      limitations: [
        ...child.limitations,
        ...graphStatus.limitations.map((limitation) => ({
          code: limitation.code || signal,
          message: limitation.message || String(limitation),
          detail: limitation.detail,
        })),
      ],
    };
  });

  const status = {
    schema_version: 'workspace-status/v1',
    workspace_root: workspaceRoot,
    generated_at: new Date().toISOString(),
    scope: index.scope,
    source_index_path: path.join(workspaceRoot, '.spec-first', 'workspace', 'workspace-index.json'),
    summary: summarize(children),
    children,
    stale_entries: index.stale_entries,
    limitations: index.limitations,
  };

  if (options.write !== false) {
    writeJson(resolveWorkspaceStatus(workspaceRoot), status);
  }

  return status;
}

module.exports = {
  buildWorkspaceStatus,
  graphSignal,
  readinessFromGraphState,
};
