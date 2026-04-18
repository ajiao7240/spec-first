'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadBootstrapRuntimeState, safeReadJson } = require('./loader');

const WORKSPACE_REGISTRY_SCHEMA_VERSION = 'v1';
const WORKSPACE_ROUTING_SCHEMA_VERSION = 'v1';
const WORKSPACE_MATCH_SIGNAL_PRIORITY = [
  'repoRoots',
  'targetPath',
  'cwd',
  'changedFiles',
  'default',
];

function normalizeAbsolutePath(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return path.resolve(value);
}

function detectGitRoot(startPath) {
  const resolved = normalizeAbsolutePath(startPath);
  if (!resolved) return null;

  try {
    return execFileSync('git', ['-C', resolved, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch (_error) {
    return null;
  }
}

function listAncestorDirs(startPath) {
  const resolved = normalizeAbsolutePath(startPath);
  if (!resolved) return [];

  const ancestors = [];
  let current = resolved;
  while (true) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return ancestors;
}

function buildWorkspaceControlPlanePaths(workspaceRoot, workspaceSlug = path.basename(workspaceRoot)) {
  const controlPlaneDir = path.join(
    workspaceRoot,
    '.spec-first',
    'workflows',
    'bootstrap',
    workspaceSlug
  );

  return {
    controlPlaneDir,
    registryPath: path.join(controlPlaneDir, 'workspace-registry.json'),
    routingPath: path.join(controlPlaneDir, 'workspace-routing.json'),
    contextDir: path.join(workspaceRoot, 'docs', 'contexts', workspaceSlug),
  };
}

function validateWorkspaceRegistry(registry) {
  if (!registry || typeof registry !== 'object') {
    return { ok: false, code: 'workspace_registry_invalid' };
  }
  if (registry.schema_version !== WORKSPACE_REGISTRY_SCHEMA_VERSION) {
    return { ok: false, code: 'workspace_registry_schema_unsupported' };
  }
  if (!registry.workspaceSlug || !Array.isArray(registry.children)) {
    return { ok: false, code: 'workspace_registry_invalid' };
  }
  return { ok: true };
}

function validateWorkspaceRouting(routing) {
  if (!routing || typeof routing !== 'object') {
    return { ok: false, code: 'workspace_routing_missing' };
  }
  if (routing.schema_version !== WORKSPACE_ROUTING_SCHEMA_VERSION) {
    return { ok: false, code: 'workspace_routing_schema_unsupported' };
  }
  if (!Array.isArray(routing.workspaceOverviewAssets) || !Array.isArray(routing.childMatchSignalPriority)) {
    return { ok: false, code: 'workspace_routing_missing' };
  }
  return { ok: true };
}

function findWorkspaceCandidate(startPath) {
  for (const candidateDir of listAncestorDirs(startPath)) {
    const workspaceSlug = path.basename(candidateDir);
    const paths = buildWorkspaceControlPlanePaths(candidateDir, workspaceSlug);
    if (fs.existsSync(paths.registryPath)) {
      return { workspaceRoot: candidateDir, workspaceSlug, ...paths };
    }
  }
  return null;
}

function chooseMatchedChildren({ registry, routing, repoRoots = [], targetPath, cwd, changedFiles = [], workspaceRoot }) {
  const normalizedChildren = registry.children.map((child) => ({
    ...child,
    repoRoot: normalizeAbsolutePath(child.repoRoot),
  }));

  const byRepoRoot = new Map(normalizedChildren.map((child) => [child.repoRoot, child]));
  const byPrefix = normalizedChildren.slice().sort((a, b) => b.repoRoot.length - a.repoRoot.length);

  // workspace 场景下，targetPath/cwd/changedFiles 允许是相对路径。
  // 如果直接用 path.resolve() 会按进程当前目录解析，导致 cwd=workspaceRoot
  // 且 changedFiles=['packages/repo-a/src/x.js'] 这类情况静默 miss。
  // 这里显式以 workspaceRoot 作为锚点：path.resolve(anchor, candidate) 在
  // candidate 为绝对路径时忽略 anchor，为相对路径时相对 anchor 解析。
  const anchor = normalizeAbsolutePath(workspaceRoot);

  function matchPath(candidate) {
    if (typeof candidate !== 'string' || candidate.trim() === '') return [];
    const resolved = anchor
      ? path.resolve(anchor, candidate)
      : path.resolve(candidate);
    for (const child of byPrefix) {
      if (resolved === child.repoRoot || resolved.startsWith(`${child.repoRoot}${path.sep}`)) {
        return [child.childSlug];
      }
    }
    return [];
  }

  const signals = {
    repoRoots: repoRoots
      .map((repoRoot) => byRepoRoot.get(normalizeAbsolutePath(repoRoot)))
      .filter(Boolean)
      .map((child) => child.childSlug),
    targetPath: matchPath(targetPath),
    cwd: matchPath(cwd),
    changedFiles: changedFiles.flatMap((filePath) => matchPath(filePath)),
    default: [],
  };

  for (const signal of routing.childMatchSignalPriority) {
    const matches = [...new Set(signals[signal] || [])];
    if (matches.length > 0) {
      return { matchedChildSlugs: matches, matchReason: signal };
    }
  }

  return { matchedChildSlugs: [], matchReason: 'default' };
}

function resolveStage0Entry({ cwd, target, repoRoots = [], changedFiles = [] } = {}) {
  const normalizedRepoRoots = repoRoots.map(normalizeAbsolutePath).filter(Boolean);
  if (normalizedRepoRoots.length > 0) {
    const workspaceRoot = normalizeAbsolutePath(cwd || target || normalizedRepoRoots[0]);
    return {
      mode: 'workspace-explicit',
      reason: 'explicit-repo-roots',
      workspaceRoot,
      workspaceSlug: workspaceRoot ? path.basename(workspaceRoot) : null,
      artifactAnchorRoot: workspaceRoot,
      repoRoots: normalizedRepoRoots,
      matchedChildSlugs: normalizedRepoRoots.map((repoRoot) => path.basename(repoRoot)),
      fallbackReason: null,
      workspace: null,
    };
  }

  const probeRoot = normalizeAbsolutePath(target || cwd);
  const gitRoot = detectGitRoot(probeRoot);
  if (gitRoot) {
    return {
      mode: 'single-repo',
      reason: 'git-root',
      workspaceRoot: gitRoot,
      workspaceSlug: path.basename(gitRoot),
      artifactAnchorRoot: gitRoot,
      repoRoots: [gitRoot],
      matchedChildSlugs: [path.basename(gitRoot)],
      fallbackReason: null,
      workspace: null,
    };
  }

  const workspaceCandidate = findWorkspaceCandidate(probeRoot);
  if (!workspaceCandidate) {
    return {
      mode: 'fallback',
      reason: 'fallback',
      workspaceRoot: probeRoot,
      workspaceSlug: probeRoot ? path.basename(probeRoot) : null,
      artifactAnchorRoot: probeRoot,
      repoRoots: [],
      matchedChildSlugs: [],
      fallbackReason: 'context_dir_missing',
      workspace: null,
    };
  }

  const registry = safeReadJson(workspaceCandidate.registryPath);
  const registryState = validateWorkspaceRegistry(registry);
  const routing = safeReadJson(workspaceCandidate.routingPath);
  const routingState = validateWorkspaceRouting(routing);
  const workspace = {
    ...workspaceCandidate,
    registry,
    routing,
  };

  if (!registryState.ok) {
    return {
      mode: 'workspace-registered',
      reason: 'workspace-registry',
      workspaceRoot: workspaceCandidate.workspaceRoot,
      workspaceSlug: workspaceCandidate.workspaceSlug,
      artifactAnchorRoot: workspaceCandidate.workspaceRoot,
      repoRoots: [],
      matchedChildSlugs: [],
      fallbackReason: registryState.code,
      workspace,
    };
  }

  if (!routingState.ok) {
    return {
      mode: 'workspace-registered',
      reason: 'workspace-registry',
      workspaceRoot: workspaceCandidate.workspaceRoot,
      workspaceSlug: workspaceCandidate.workspaceSlug,
      artifactAnchorRoot: workspaceCandidate.workspaceRoot,
      repoRoots: [],
      matchedChildSlugs: [],
      fallbackReason: routingState.code,
      workspace,
    };
  }

  const matched = chooseMatchedChildren({
    registry,
    routing,
    repoRoots: normalizedRepoRoots,
    targetPath: target,
    cwd,
    changedFiles,
    workspaceRoot: workspaceCandidate.workspaceRoot,
  });

  return {
    mode: 'workspace-registered',
    reason: 'workspace-registry',
    workspaceRoot: workspaceCandidate.workspaceRoot,
    workspaceSlug: registry.workspaceSlug,
    artifactAnchorRoot: workspaceCandidate.workspaceRoot,
    repoRoots: registry.children.map((child) => child.repoRoot),
    matchedChildSlugs: matched.matchedChildSlugs,
    matchReason: matched.matchReason,
    fallbackReason: null,
    workspace,
  };
}

function loadChildRuntimeStates({ workspaceRoot, matchedChildSlugs = [], registry } = {}) {
  if (!workspaceRoot || !registry || !Array.isArray(registry.children)) return [];
  const wanted = new Set(matchedChildSlugs);
  return registry.children
    .filter((child) => wanted.has(child.childSlug))
    .map((child) => ({
      child,
      state: loadBootstrapRuntimeState({
        repoRoot: child.repoRoot,
        slug: child.childSlug,
        artifactAnchorRoot: workspaceRoot,
      }),
    }));
}

module.exports = {
  WORKSPACE_MATCH_SIGNAL_PRIORITY,
  WORKSPACE_REGISTRY_SCHEMA_VERSION,
  WORKSPACE_ROUTING_SCHEMA_VERSION,
  buildWorkspaceControlPlanePaths,
  chooseMatchedChildren,
  detectGitRoot,
  findWorkspaceCandidate,
  listAncestorDirs,
  loadChildRuntimeStates,
  normalizeAbsolutePath,
  resolveStage0Entry,
  validateWorkspaceRegistry,
  validateWorkspaceRouting,
};
