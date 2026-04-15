'use strict';

const path = require('node:path');

// ---------------------------------------------------------------------------
// Filename constants (R4: unambiguous names for graph vs bootstrap artifacts)
// ---------------------------------------------------------------------------

/** SHA/content fingerprint file for CRG graph incremental build */
const GRAPH_INPUT_FINGERPRINTS_FILE = 'input-fingerprints.json';
const GRAPH_DB_FILE = 'graph.db';
const GRAPH_CURRENT_FILE = 'current.json';
const GRAPH_LAST_KNOWN_GOOD_FILE = 'last-known-good.json';
const GRAPH_GENERATIONS_SUBDIR = 'generations';

/** Artifact manifest written by the bootstrap workflow control-plane */
const BOOTSTRAP_ARTIFACT_MANIFEST_FILE = 'artifact-manifest.json';

/** Per-repo ignore rules for CRG input collection */
const GRAPH_IGNORE_FILE = '.spec-firstignore';

// ---------------------------------------------------------------------------
// Base directory segments
// ---------------------------------------------------------------------------

const SPEC_FIRST_DIR = '.spec-first';
const GRAPH_SUBDIR   = 'graph';
const WORKFLOWS_SUBDIR = 'workflows';
const DOCS_CONTEXTS_SUBDIR = path.join('docs', 'contexts');

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
 * Returns the absolute path to a workflow-scoped artifact directory.
 *
 * Layout: <repoRoot>/.spec-first/workflows/<workflow>/<slug>/
 *
 * @param {string} repoRoot  Absolute path to the repository root.
 * @param {string} workflow  Workflow name (e.g. 'bootstrap'). Must be non-empty.
 * @param {string} slug      Project/context slug. Must be non-empty.
 * @returns {string}
 * @throws {Error} If workflow or slug is empty.
 */
function resolveWorkflowArtifactDir(repoRoot, workflow, slug) {
  if (!workflow || typeof workflow !== 'string') {
    throw new Error('resolveWorkflowArtifactDir: workflow must be a non-empty string');
  }
  if (!slug || typeof slug !== 'string') {
    throw new Error('resolveWorkflowArtifactDir: slug must be a non-empty string');
  }
  return path.join(repoRoot, SPEC_FIRST_DIR, WORKFLOWS_SUBDIR, workflow, slug);
}

/**
 * Returns the absolute path to the long-term human-readable context docs directory.
 *
 * Layout: <repoRoot>/docs/contexts/<slug>/
 *
 * @param {string} repoRoot  Absolute path to the repository root.
 * @param {string} slug      Project/context slug.
 * @returns {string}
 */
function resolveContextDocsDir(repoRoot, slug) {
  return path.join(repoRoot, DOCS_CONTEXTS_SUBDIR, slug);
}

// ---------------------------------------------------------------------------

module.exports = {
  // Filename constants
  GRAPH_INPUT_FINGERPRINTS_FILE,
  GRAPH_DB_FILE,
  GRAPH_CURRENT_FILE,
  GRAPH_LAST_KNOWN_GOOD_FILE,
  GRAPH_GENERATIONS_SUBDIR,
  BOOTSTRAP_ARTIFACT_MANIFEST_FILE,
  GRAPH_IGNORE_FILE,
  // Path resolvers
  resolveGraphDir,
  resolveGraphDb,
  resolveGraphInputFingerprints,
  resolveWorkflowArtifactDir,
  resolveContextDocsDir,
};
