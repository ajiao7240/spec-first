'use strict';

const path = require('node:path');

// ---------------------------------------------------------------------------
// Filename constants for CRG graph artifacts
// ---------------------------------------------------------------------------

/** SHA/content fingerprint file for CRG graph incremental build */
const GRAPH_INPUT_FINGERPRINTS_FILE = 'input-fingerprints.json';
const GRAPH_DB_FILE = 'graph.db';
const GRAPH_CURRENT_FILE = 'current.json';
const GRAPH_LAST_KNOWN_GOOD_FILE = 'last-known-good.json';
const GRAPH_GENERATIONS_SUBDIR = 'generations';
const GRAPH_INDEX_STATUS_FILE = 'graph-index-status.json';
const GRAPH_CODE_NAVIGATION_FILE = 'code-navigation.json';
const GRAPH_OPERATIONS_LOG_FILE = 'graph-operations.jsonl';
const GRAPH_WORK_RUNS_SUBDIR = 'work-runs';
const REPO_TOPOLOGY_FILE = 'repo-topology.json';

const WORKSPACE_CONFIG_FILE = 'workspace-config.json';
const WORKSPACE_INDEX_FILE = 'workspace-index.json';
const WORKSPACE_STATUS_FILE = 'workspace-status.json';
const WORKSPACE_OPERATIONS_LOG_FILE = 'workspace-operations.jsonl';

/** Per-repo ignore rules for CRG input collection */
const GRAPH_IGNORE_FILE = '.spec-firstignore';

// ---------------------------------------------------------------------------
// Base directory segments
// ---------------------------------------------------------------------------

const SPEC_FIRST_DIR = '.spec-first';
const GRAPH_SUBDIR   = 'graph';
const WORKSPACE_SUBDIR = 'workspace';
const WORKFLOWS_SUBDIR = 'workflows';

// ---------------------------------------------------------------------------
// Pure path resolver functions — no I/O, no side effects
// ---------------------------------------------------------------------------

/**
 * Returns the CRG graph directory absolute path.
 * @param {string} repoRoot  Absolute path to the repository root.
 * @returns {string}
 */
function resolveGraphDir(repoRoot) {
  return path.join(repoRoot, SPEC_FIRST_DIR, GRAPH_SUBDIR);
}

/**
 * Returns the absolute path to the CRG SQLite database file.
 * @param {string} repoRoot  Absolute path to the repository root.
 * @returns {string}
 */
function resolveGraphDb(repoRoot) {
  return path.join(resolveGraphDir(repoRoot), GRAPH_DB_FILE);
}

/**
 * Returns the absolute path to the CRG input-fingerprints JSON file.
 * @param {string} repoRoot  Absolute path to the repository root.
 * @returns {string}
 */
function resolveGraphInputFingerprints(repoRoot) {
  return path.join(resolveGraphDir(repoRoot), GRAPH_INPUT_FINGERPRINTS_FILE);
}

/**
 * Returns the repo-local topology artifact path under the graph control plane.
 * @param {string} repoRoot Absolute path to the repository root.
 * @returns {string}
 */
function resolveRepoTopology(repoRoot) {
  return path.join(resolveGraphDir(repoRoot), REPO_TOPOLOGY_FILE);
}

/**
 * Returns the parent workspace control-plane directory absolute path.
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {string}
 */
function resolveWorkspaceDir(workspaceRoot) {
  return path.join(workspaceRoot, SPEC_FIRST_DIR, WORKSPACE_SUBDIR);
}

/**
 * Returns the optional workspace scope config path.
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {string}
 */
function resolveWorkspaceConfig(workspaceRoot) {
  return path.join(resolveWorkspaceDir(workspaceRoot), WORKSPACE_CONFIG_FILE);
}

/**
 * Returns the workspace discovery index path.
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {string}
 */
function resolveWorkspaceIndex(workspaceRoot) {
  return path.join(resolveWorkspaceDir(workspaceRoot), WORKSPACE_INDEX_FILE);
}

/**
 * Returns the workspace readiness status path.
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {string}
 */
function resolveWorkspaceStatus(workspaceRoot) {
  return path.join(resolveWorkspaceDir(workspaceRoot), WORKSPACE_STATUS_FILE);
}

/**
 * Returns the optional workspace operation log path.
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {string}
 */
function resolveWorkspaceOperationsLog(workspaceRoot) {
  return path.join(resolveWorkspaceDir(workspaceRoot), WORKSPACE_OPERATIONS_LOG_FILE);
}

/**
 * Returns the absolute path to a workflow-scoped artifact directory.
 *
 * Layout: <repoRoot>/.spec-first/workflows/<workflow>/<slug>/
 *
 * @param {string} repoRoot  Absolute path to the repository root.
 * @param {string} workflow  Workflow name. Must be non-empty.
 * @param {string} slug      Project/context slug. Must be non-empty.
 * @returns {string}
 * @throws {Error} If workflow or slug is empty.
 */
function resolveWorkflowArtifactDir(repoRoot, workflow, slug, options = {}) {
  if (!workflow || typeof workflow !== 'string') {
    throw new Error('resolveWorkflowArtifactDir: workflow must be a non-empty string');
  }
  if (!slug || typeof slug !== 'string') {
    throw new Error('resolveWorkflowArtifactDir: slug must be a non-empty string');
  }
  const artifactAnchorRoot = options.artifactAnchorRoot || repoRoot;
  return path.join(artifactAnchorRoot, SPEC_FIRST_DIR, WORKFLOWS_SUBDIR, workflow, slug);
}

// ---------------------------------------------------------------------------

module.exports = {
  // Filename constants
  GRAPH_INPUT_FINGERPRINTS_FILE,
  GRAPH_DB_FILE,
  GRAPH_CURRENT_FILE,
  GRAPH_LAST_KNOWN_GOOD_FILE,
  GRAPH_GENERATIONS_SUBDIR,
  GRAPH_INDEX_STATUS_FILE,
  GRAPH_CODE_NAVIGATION_FILE,
  GRAPH_OPERATIONS_LOG_FILE,
  GRAPH_WORK_RUNS_SUBDIR,
  REPO_TOPOLOGY_FILE,
  GRAPH_IGNORE_FILE,
  WORKSPACE_CONFIG_FILE,
  WORKSPACE_INDEX_FILE,
  WORKSPACE_STATUS_FILE,
  WORKSPACE_OPERATIONS_LOG_FILE,
  // Path resolvers
  resolveGraphDir,
  resolveGraphDb,
  resolveGraphInputFingerprints,
  resolveRepoTopology,
  resolveWorkspaceDir,
  resolveWorkspaceConfig,
  resolveWorkspaceIndex,
  resolveWorkspaceStatus,
  resolveWorkspaceOperationsLog,
  resolveWorkflowArtifactDir,
};
