'use strict';

const path = require('node:path');

const SPEC_FIRST_DIR = '.spec-first';
const WORKFLOWS_SUBDIR = 'workflows';
const WINDOWS_RESERVED_BASENAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);
const WINDOWS_ILLEGAL_FILENAME_CHARS = /[<>:"|?*\x00-\x1F]/;

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
  validateArtifactPathSegment('workflow', workflow);
  validateArtifactPathSegment('slug', slug);
  const artifactAnchorRoot = options.artifactAnchorRoot || repoRoot;
  return path.join(artifactAnchorRoot, SPEC_FIRST_DIR, WORKFLOWS_SUBDIR, workflow, slug);
}

function validateArtifactPathSegment(name, value) {
  if (!value || typeof value !== 'string') {
    throw new Error(`resolveWorkflowArtifactDir: ${name} must be a non-empty string`);
  }

  if (
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  ) {
    throw new Error(`resolveWorkflowArtifactDir: ${name} must be a safe path segment`);
  }

  if (
    WINDOWS_ILLEGAL_FILENAME_CHARS.test(value) ||
    /[ .]$/.test(value) ||
    WINDOWS_RESERVED_BASENAMES.has(value.split('.')[0].toUpperCase())
  ) {
    throw new Error(`resolveWorkflowArtifactDir: ${name} must be Windows-compatible`);
  }
}

module.exports = {
  resolveWorkflowArtifactDir,
};
