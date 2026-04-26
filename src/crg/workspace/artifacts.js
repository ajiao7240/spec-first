'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveWorkspaceConfig,
  resolveWorkspaceDir,
  resolveWorkspaceIndex,
  resolveWorkspaceOperationsLog,
  resolveWorkspaceStatus,
} = require('../artifact-paths');

function assertNonEmptyPath(value, label) {
  if (!value || typeof value !== 'string') {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function normalizeWorkspaceRoot(workspaceRoot) {
  assertNonEmptyPath(workspaceRoot, 'workspaceRoot');
  const resolved = path.resolve(workspaceRoot);
  try {
    return fs.realpathSync.native(resolved);
  } catch (_) {
    return resolved;
  }
}

function normalizeExistingPath(targetPath) {
  const resolved = path.resolve(targetPath);
  try {
    return fs.realpathSync.native(resolved);
  } catch (_) {
    return resolved;
  }
}

function resolveWorkspaceArtifacts(workspaceRoot) {
  const root = normalizeWorkspaceRoot(workspaceRoot);
  return {
    workspace_root: root,
    workspace_dir: resolveWorkspaceDir(root),
    config_path: resolveWorkspaceConfig(root),
    index_path: resolveWorkspaceIndex(root),
    status_path: resolveWorkspaceStatus(root),
    operations_log_path: resolveWorkspaceOperationsLog(root),
  };
}

function sanitizeSlugPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function stableHash(value, length = 12) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}

function makeChildSlug(workspaceRoot, repoRoot, usedSlugs = new Set()) {
  const root = normalizeWorkspaceRoot(workspaceRoot);
  const repo = normalizeExistingPath(repoRoot);
  const relativePath = path.relative(root, repo);
  const baseName = relativePath && !relativePath.startsWith('..')
    ? path.basename(relativePath)
    : path.basename(repo);
  const base = sanitizeSlugPart(relativePath === '' ? 'root' : baseName) || 'repo';

  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return { slug: base, collision_resolved: false };
  }

  const hash = stableHash(relativePath || repo, 8);
  let candidate = `${base}-${hash}`;
  let counter = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${hash}-${counter}`;
    counter++;
  }
  usedSlugs.add(candidate);
  return { slug: candidate, collision_resolved: true };
}

function isInsideWorkspace(workspaceRoot, targetPath) {
  const root = normalizeWorkspaceRoot(workspaceRoot);
  const target = normalizeExistingPath(targetPath);
  const relativePath = path.relative(root, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

module.exports = {
  assertNonEmptyPath,
  isInsideWorkspace,
  makeChildSlug,
  normalizeWorkspaceRoot,
  normalizeExistingPath,
  resolveWorkspaceArtifacts,
  sanitizeSlugPart,
  stableHash,
};
