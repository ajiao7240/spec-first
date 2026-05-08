#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_WORKSPACE_SCAN_DEPTH = 3;

function normalizeTargetKind(value) {
  const normalized = String(value || 'auto').trim();
  if (!['auto', 'repo', 'workspace'].includes(normalized)) {
    throw new Error(`Unsupported standards target kind: ${value}`);
  }
  return normalized;
}

function normalizeRepoSelector(repo) {
  if (!repo) return null;
  const raw = String(repo).trim().replace(/\\/g, '/').replace(/\/+$/g, '');
  if (!raw) return null;
  if (path.isAbsolute(raw)) {
    throw new Error(`--repo must be a workspace-relative child repo path: ${repo}`);
  }
  if (raw.split('/').includes('..')) {
    throw new Error(`--repo must not traverse outside the workspace root: ${repo}`);
  }
  const normalized = path.posix.normalize(raw).replace(/^\.\/+/u, '');
  if (!normalized || normalized === '.') {
    throw new Error(`--repo must select a child Git repo path, not the workspace root: ${repo}`);
  }
  if (normalized.startsWith('../') || normalized.split('/').includes('..')) {
    throw new Error(`--repo must not traverse outside the workspace root: ${repo}`);
  }
  return normalized;
}

function resolveStandardsTarget({
  workspaceRoot,
  requestedRoot,
  repo,
  targetKind,
}) {
  const displayWorkspaceRoot = path.resolve(workspaceRoot);
  if (repo) {
    const canonicalWorkspaceRoot = canonicalizeExistingPath(displayWorkspaceRoot);
    const selectedRoot = path.resolve(displayWorkspaceRoot, repo);
    if (!fs.existsSync(selectedRoot)) {
      throw new Error(`--repo target does not exist: ${repo}`);
    }
    const canonicalSelectedRoot = canonicalizeExistingPath(selectedRoot);
    if (!isPathWithin(canonicalSelectedRoot, canonicalWorkspaceRoot)) {
      throw new Error(`--repo target must stay inside the workspace root after resolving symlinks: ${repo}`);
    }
    if (!hasGitMarker(canonicalSelectedRoot)) {
      throw new Error(`--repo must select a child Git repo root: ${repo}`);
    }
    return {
      kind: 'workspace_child_repo',
      reasonCode: 'explicit-child-repo',
      workspaceRoot: displayWorkspaceRoot,
      root: selectedRoot,
      repo,
      workspaceChildren: [],
    };
  }

  const root = path.resolve(requestedRoot);
  const gitRoot = findGitRoot(root);
  if (targetKind === 'repo') {
    return {
      kind: 'repo',
      reasonCode: gitRoot ? 'explicit-repo-target' : 'explicit-directory-target',
      workspaceRoot: root,
      root,
      repo: null,
      workspaceChildren: [],
    };
  }

  // 显式 --workspace 时始终发现子仓，即使 root 本身也是 git repo
  const workspaceChildren = (targetKind === 'workspace' || !gitRoot) ? discoverChildGitRepos(root) : [];
  if (targetKind === 'workspace' || workspaceChildren.length > 0) {
    return {
      kind: 'workspace',
      reasonCode: workspaceChildren.length > 0
        ? 'workspace-child-repos-detected'
        : 'explicit-workspace-target',
      workspaceRoot: root,
      root,
      repo: null,
      workspaceChildren,
    };
  }

  return {
    kind: 'repo',
    reasonCode: gitRoot ? 'cwd-git-root' : 'directory-without-child-repos',
    workspaceRoot: root,
    root,
    repo: null,
    workspaceChildren: [],
  };
}

function discoverChildGitRepos(workspaceRoot, maxDepth = DEFAULT_WORKSPACE_SCAN_DEPTH) {
  const root = canonicalizeExistingPath(workspaceRoot);
  // workspace root 本身不可读时快速失败，提供明确错误
  try {
    fs.accessSync(root, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Cannot read workspace root: ${root} (${error.code || error.message})`);
  }
  const candidates = [];
  const queue = [{ dir: root, depth: 0 }];
  const skipNames = new Set([
    '.agents',
    '.cache',
    '.claude',
    '.codex',
    '.direnv',
    '.git',
    '.gitnexus',
    '.serena',
    '.spec-first',
    '.venv',
    '.worktrees',
    'coverage',
    'dist',
    'node_modules',
    'temp',
    'tmp',
    'vendor',
  ]);

  while (queue.length > 0) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch (error) {
      continue;
    }

    for (const entry of entries) {
      if (skipNames.has(entry.name)) continue;
      const childPath = path.join(current.dir, entry.name);
      if (hasGitMarker(childPath)) {
        addChildRepoCandidate(candidates, childPath, root);
        continue;
      }
      if (current.depth < maxDepth) {
        queue.push({ dir: childPath, depth: current.depth + 1 });
      }
    }
  }

  return candidates.sort((left, right) =>
    left.workspace_relative_path.localeCompare(right.workspace_relative_path)
  );
}

function addChildRepoCandidate(candidates, candidateRoot, workspaceRoot) {
  const gitRoot = canonicalizeExistingPath(candidateRoot);
  if (!isPathWithin(gitRoot, workspaceRoot)) return;
  if (candidates.some((candidate) => (
    gitRoot === candidate.git_root || isPathWithin(gitRoot, candidate.git_root)
  ))) {
    return;
  }

  const workspaceRelativePath = toWorkspaceRelativePath(gitRoot, workspaceRoot);
  candidates.push({
    repo_label: workspaceRelativePath,
    git_root: gitRoot,
    workspace_relative_path: workspaceRelativePath,
    relationship: 'child_git_repo',
  });
}

function findGitRoot(startPath) {
  let current = canonicalizeExistingPath(startPath);
  try {
    const stat = fs.statSync(current);
    if (!stat.isDirectory()) {
      current = path.dirname(current);
    }
  } catch (error) {
    return '';
  }

  while (true) {
    if (hasGitMarker(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return '';
    }
    current = parent;
  }
}

function hasGitMarker(dirPath) {
  try {
    const st = fs.lstatSync(path.join(dirPath, '.git'));
    return st.isFile() || st.isDirectory();
  } catch {
    return false;
  }
}

function canonicalizeExistingPath(targetPath) {
  const resolved = path.resolve(targetPath);
  try {
    return fs.realpathSync.native(resolved);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return resolved;
    }
    throw error; // ELOOP, EPERM: re-throw; circular symlinks and permission errors must not be silently ignored
  }
}

function isPathWithin(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toWorkspaceRelativePath(childPath, workspaceRoot) {
  const relative = path.relative(workspaceRoot, childPath);
  return relative === '' ? '.' : relative.split(path.sep).join('/');
}

module.exports = {
  canonicalizeExistingPath,
  discoverChildGitRepos,
  hasGitMarker,
  isPathWithin,
  normalizeRepoSelector,
  normalizeTargetKind,
  resolveStandardsTarget,
};
