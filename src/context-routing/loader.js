'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  resolveContextDocsDir,
  resolveWorkflowArtifactDir,
} = require('../crg/artifact-paths');

function detectSlug(repoRoot) {
  return path.basename(repoRoot);
}

function resolveBootstrapRuntimePaths({
  repoRoot,
  slug = detectSlug(repoRoot),
  artifactAnchorRoot = repoRoot,
} = {}) {
  return {
    slug,
    artifactAnchorRoot,
    contextDir: resolveContextDocsDir(repoRoot, slug, { artifactAnchorRoot }),
    controlPlaneDir: resolveWorkflowArtifactDir(repoRoot, 'bootstrap', slug, { artifactAnchorRoot }),
  };
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function loadBootstrapRuntimeState({ repoRoot, slug, artifactAnchorRoot = repoRoot } = {}) {
  const paths = resolveBootstrapRuntimePaths({ repoRoot, slug, artifactAnchorRoot });
  const controlPlaneDir = paths.controlPlaneDir;

  return {
    ...paths,
    routing: safeReadJson(path.join(controlPlaneDir, 'context-routing.json')),
    manifest: safeReadJson(path.join(controlPlaneDir, 'artifact-manifest.json')),
    freshness: safeReadJson(path.join(controlPlaneDir, 'freshness.json')),
  };
}

function findExistingAsset(assetPath, { contextDir, controlPlaneDir }) {
  const controlPlanePath = path.join(controlPlaneDir, assetPath);
  if (fs.existsSync(controlPlanePath)) {
    return { exists: true, absolutePath: controlPlanePath, plane: 'control' };
  }

  const contextPath = path.join(contextDir, assetPath);
  if (fs.existsSync(contextPath)) {
    return { exists: true, absolutePath: contextPath, plane: 'context' };
  }

  return { exists: false, absolutePath: null, plane: null };
}

module.exports = {
  detectSlug,
  findExistingAsset,
  loadBootstrapRuntimeState,
  resolveBootstrapRuntimePaths,
  safeReadJson,
};
