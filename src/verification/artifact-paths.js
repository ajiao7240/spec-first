'use strict';

const path = require('node:path');

const SPEC_FIRST_DIR = '.spec-first';
const WORKFLOWS_SUBDIR = 'workflows';

/**
 * Returns the absolute path to a workflow-scoped artifact directory.
 *
 * Layout: <repoRoot>/.spec-first/workflows/<workflow>/<slug>/
 *
 * @param {string} repoRoot Absolute path to the repository root.
 * @param {string} workflow Workflow name. Must be non-empty.
 * @param {string} slug Project/context slug. Must be non-empty.
 * @param {{ artifactAnchorRoot?: string }} [options]
 * @returns {string}
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

module.exports = {
  resolveWorkflowArtifactDir,
};
