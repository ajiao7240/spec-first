'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  WORKSPACE_MATCH_SIGNAL_PRIORITY,
  detectGitRoot,
  normalizeAbsolutePath,
} = require('../context-routing/entry-resolver');

const DEFAULT_DISCOVERY_EXCLUDES = new Set([
  '.git',
  '.spec-first',
  'node_modules',
  'docs',
  'dist',
  'build',
  'coverage',
]);

function slugifySegment(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function buildChildSlug(workspaceRoot, repoRoot, used = new Set()) {
  const relativePath = path.relative(workspaceRoot, repoRoot) || path.basename(repoRoot);
  const baseSlug = relativePath
    .split(path.sep)
    .filter(Boolean)
    .map(slugifySegment)
    .filter(Boolean)
    .join('-') || slugifySegment(path.basename(repoRoot)) || 'child-repo';

  let slug = baseSlug;
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }

  const suffix = Buffer.from(relativePath).toString('hex').slice(0, 4);
  slug = `${baseSlug}-${suffix}`;
  used.add(slug);
  return slug;
}

function detectHeadCommit(repoRoot) {
  try {
    return execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch (_error) {
    return null;
  }
}

function discoverChildGitRepos(target, { maxDepth = 3 } = {}) {
  const workspaceRoot = normalizeAbsolutePath(target);
  if (!workspaceRoot || detectGitRoot(workspaceRoot) === workspaceRoot) {
    return [];
  }

  const discovered = [];
  const seenRepoRoots = new Set();
  const queue = [{ dir: workspaceRoot, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current.dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (DEFAULT_DISCOVERY_EXCLUDES.has(entry.name)) continue;

      const candidate = path.join(current.dir, entry.name);
      const gitRoot = detectGitRoot(candidate);
      if (gitRoot && gitRoot !== workspaceRoot && gitRoot.startsWith(`${workspaceRoot}${path.sep}`)) {
        if (!seenRepoRoots.has(gitRoot)) {
          seenRepoRoots.add(gitRoot);
          discovered.push(gitRoot);
        }
        continue;
      }

      if (current.depth + 1 < maxDepth) {
        queue.push({ dir: candidate, depth: current.depth + 1 });
      }
    }
  }

  return discovered.sort();
}

function buildWorkspaceRegistry({
  workspaceRoot,
  repoRoots = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const normalizedWorkspaceRoot = normalizeAbsolutePath(workspaceRoot);
  const usedSlugs = new Set();
  const children = repoRoots.map((repoRoot) => {
    const normalizedRepoRoot = normalizeAbsolutePath(repoRoot);
    return {
      childSlug: buildChildSlug(normalizedWorkspaceRoot, normalizedRepoRoot, usedSlugs),
      repoRoot: normalizedRepoRoot,
      relativePath: path.relative(normalizedWorkspaceRoot, normalizedRepoRoot) || path.basename(normalizedRepoRoot),
      headCommit: detectHeadCommit(normalizedRepoRoot),
      languageHints: [],
      status: 'ready',
    };
  });

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    workspaceSlug: path.basename(normalizedWorkspaceRoot),
    workspaceRoot: normalizedWorkspaceRoot,
    mode: 'workspace',
    children,
  };
}

function buildWorkspaceRouting({ workspaceSlug, generatedAt = new Date().toISOString() } = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    workspaceSlug,
    defaultSelectionMode: 'child-first',
    childMatchSignalPriority: WORKSPACE_MATCH_SIGNAL_PRIORITY,
    fallback: {
      whenNoChildMatched: 'workspace-overview-only',
    },
    workspaceOverviewAssets: [
      'workspace/routing-overview.md',
      '00-summary.md',
    ],
  };
}

module.exports = {
  buildChildSlug,
  buildWorkspaceRegistry,
  buildWorkspaceRouting,
  discoverChildGitRepos,
};
