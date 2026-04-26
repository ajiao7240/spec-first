'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  resolveWorkspaceConfig,
  resolveWorkspaceIndex,
} = require('../artifact-paths');
const {
  isInsideWorkspace,
  makeChildSlug,
  normalizeWorkspaceRoot,
  stableHash,
} = require('./artifacts');

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_EXCLUDE_GLOBS = [
  '.spec-first/**',
  '.git/**',
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  'vendor/**',
  '.claude/**',
  '.codex/**',
  '.agents/**',
];

const GENERATED_DIR_NAMES = new Set([
  '.spec-first',
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'vendor',
  '.claude',
  '.codex',
  '.agents',
]);

function toPosixPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function makeLimitation(code, message, extra = {}) {
  return { code, message, ...extra };
}

function normalizeConfig(workspaceRoot) {
  const configPath = resolveWorkspaceConfig(workspaceRoot);
  if (!fs.existsSync(configPath)) {
    return {
      config: null,
      limitations: [],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const includeRoots = Array.isArray(parsed.include_roots) ? parsed.include_roots : [];
    const excludeGlobs = Array.isArray(parsed.exclude_globs) ? parsed.exclude_globs : [];
    const maxDepth = Number.isInteger(parsed.max_depth) && parsed.max_depth >= 0
      ? parsed.max_depth
      : DEFAULT_MAX_DEPTH;
    return {
      config: {
        schema_version: parsed.schema_version || 'workspace-config/v1',
        include_roots: includeRoots,
        exclude_globs: excludeGlobs,
        max_depth: maxDepth,
      },
      limitations: [],
    };
  } catch (error) {
    return {
      config: null,
      limitations: [
        makeLimitation('workspace_config_malformed', 'workspace-config.json could not be parsed.', {
          path: configPath,
          detail: error && error.message ? error.message : String(error),
        }),
      ],
    };
  }
}

function globToRegex(pattern) {
  const normalized = toPosixPath(pattern).replace(/^\/+/, '').replace(/\/+$/, '');
  let body = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        body += '.*';
        i++;
      } else {
        body += '[^/]*';
      }
    } else if (ch === '?') {
      body += '[^/]';
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      body += `\\${ch}`;
    } else {
      body += ch;
    }
  }
  return new RegExp(`^${body}(/.*)?$`);
}

function matchesGlob(relativePath, globs) {
  const rel = toPosixPath(relativePath).replace(/^\/+/, '');
  return globs.some((glob) => {
    const normalized = toPosixPath(glob).replace(/^\/+/, '');
    if (!normalized) return false;
    if (!normalized.includes('/')) {
      return rel.split('/').includes(normalized);
    }
    if (normalized.endsWith('/**')) {
      const prefix = normalized.slice(0, -3);
      return rel === prefix || rel.startsWith(`${prefix}/`);
    }
    try {
      return globToRegex(normalized).test(rel);
    } catch (_) {
      return false;
    }
  });
}

function shouldIgnoreDirectory(workspaceRoot, dirPath, excludeGlobs) {
  const name = path.basename(dirPath);
  if (GENERATED_DIR_NAMES.has(name)) return true;
  const relativePath = toPosixPath(path.relative(workspaceRoot, dirPath));
  return relativePath ? matchesGlob(relativePath, excludeGlobs) : false;
}

function hasGitMarker(dirPath) {
  try {
    const marker = path.join(dirPath, '.git');
    return fs.existsSync(marker);
  } catch (_) {
    return false;
  }
}

function getGitMarkerKind(repoRoot) {
  const marker = path.join(repoRoot, '.git');
  try {
    const stat = fs.statSync(marker);
    if (stat.isFile()) return 'file';
    if (stat.isDirectory()) return 'directory';
  } catch (_) {}
  return 'missing';
}

function readGitFile(repoRoot) {
  const marker = path.join(repoRoot, '.git');
  try {
    const stat = fs.statSync(marker);
    if (!stat.isFile()) return '';
    return fs.readFileSync(marker, 'utf8');
  } catch (_) {
    return '';
  }
}

function isListedSubmodule(workspaceRoot, repoRoot) {
  const gitmodulesPath = path.join(workspaceRoot, '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) return false;
  const relativePath = toPosixPath(path.relative(workspaceRoot, repoRoot));
  try {
    const content = fs.readFileSync(gitmodulesPath, 'utf8');
    return content.includes(`path = ${relativePath}`) || content.includes(`path=${relativePath}`);
  } catch (_) {
    return false;
  }
}

function classifyRelationship(workspaceRoot, repoRoot) {
  if (path.resolve(workspaceRoot) === path.resolve(repoRoot)) {
    return 'root_repo';
  }

  const markerKind = getGitMarkerKind(repoRoot);
  if (markerKind === 'file') {
    const gitFile = readGitFile(repoRoot);
    if (isListedSubmodule(workspaceRoot, repoRoot) || /(^|[/.])\.git\/modules\//.test(gitFile)) {
      return 'submodule';
    }
    return 'worktree';
  }

  return 'nested_independent_repo';
}

function relationshipSignal(relationship) {
  if (relationship === 'root_repo') return 'root_repo_detected';
  if (relationship === 'submodule') return 'submodule_detected';
  if (relationship === 'worktree') return 'worktree_detected';
  return 'nested_repo_detected';
}

function validateGitRoot(candidatePath) {
  try {
    const output = execFileSync(
      'git',
      ['-C', candidatePath, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const gitRoot = path.resolve(output.trim());
    return { ok: true, gitRoot };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error),
    };
  }
}

function collectFallbackCandidates(workspaceRoot, scope, limitations, ignoredCandidates) {
  const candidates = new Set();
  const excludeGlobs = [
    ...DEFAULT_EXCLUDE_GLOBS,
    ...scope.exclude_globs,
  ];

  function scan(dirPath, depth) {
    if (hasGitMarker(dirPath)) {
      candidates.add(dirPath);
    }
    if (depth >= scope.max_depth) return;

    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (error) {
      limitations.push(makeLimitation('child_unreadable', 'Directory could not be read during workspace scan.', {
        path: dirPath,
        detail: error && error.message ? error.message : String(error),
      }));
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const nextPath = path.join(dirPath, entry.name);
      const relativePath = toPosixPath(path.relative(workspaceRoot, nextPath));
      if (shouldIgnoreDirectory(workspaceRoot, nextPath, excludeGlobs)) {
        if (ignoredCandidates.length < 100) {
          ignoredCandidates.push({
            path: nextPath,
            relative_path: relativePath,
            signals: ['ignored_generated_directory'],
          });
        }
        continue;
      }
      scan(nextPath, depth + 1);
    }
  }

  scan(workspaceRoot, 0);
  return [...candidates];
}

function collectExplicitCandidates(workspaceRoot, scope, limitations) {
  const candidates = [];
  for (const includeRoot of scope.include_roots) {
    const candidatePath = path.resolve(workspaceRoot, includeRoot);
    const relativePath = toPosixPath(path.relative(workspaceRoot, candidatePath));
    if (!isInsideWorkspace(workspaceRoot, candidatePath)) {
      limitations.push(makeLimitation('git_root_invalid', 'Configured workspace root escapes the workspace boundary.', {
        path: candidatePath,
      }));
      continue;
    }
    if (matchesGlob(relativePath, scope.exclude_globs)) {
      limitations.push(makeLimitation('scope_excluded', 'Configured include root was excluded by workspace exclude_globs.', {
        path: candidatePath,
      }));
      continue;
    }
    candidates.push(candidatePath);
  }
  return candidates;
}

function loadPreviousIndex(workspaceRoot) {
  const indexPath = resolveWorkspaceIndex(workspaceRoot);
  const index = readJsonIfExists(indexPath);
  if (!index || !Array.isArray(index.children)) return null;
  return index;
}

function buildStaleEntries(previousIndex, currentChildren) {
  if (!previousIndex) return [];
  const currentRoots = new Set(currentChildren.map((child) => path.resolve(child.repo_root)));
  return previousIndex.children
    .filter((child) => child && child.repo_root && !currentRoots.has(path.resolve(child.repo_root)))
    .map((child) => ({
      slug: child.slug || path.basename(child.repo_root),
      repo_root: child.repo_root,
      signals: ['stale_child_path'],
      limitations: [
        makeLimitation('stale_child_path', 'Previously discovered child repo is no longer a validated git root.', {
          path: child.repo_root,
        }),
      ],
    }));
}

function buildFingerprint(workspaceRoot, scope, children, limitations) {
  const material = {
    workspace_root: workspaceRoot,
    scope,
    children: children.map((child) => ({
      repo_root: child.repo_root,
      relationship: child.relationship,
      candidate: child.candidate,
    })),
    limitations: limitations.map((item) => ({
      code: item.code,
      path: item.path || null,
    })),
  };
  return {
    algorithm: 'workspace-discovery/v1',
    value: stableHash(JSON.stringify(material), 16),
  };
}

function discoverWorkspace(workspaceRootInput, options = {}) {
  const workspaceRoot = normalizeWorkspaceRoot(workspaceRootInput || process.cwd());
  const write = options.write !== false;
  const { config, limitations: configLimitations } = normalizeConfig(workspaceRoot);
  const limitations = [...configLimitations];
  const ignoredCandidates = [];
  const configApplied = Boolean(config);
  const explicitInclude = Boolean(config && config.include_roots.length > 0);
  const scope = {
    source: configApplied ? 'workspace_config' : 'fallback_bounded_scan',
    include_roots: config ? config.include_roots : [],
    exclude_globs: config ? config.exclude_globs : [],
    max_depth: config ? config.max_depth : DEFAULT_MAX_DEPTH,
  };

  const rawCandidatePaths = explicitInclude
    ? collectExplicitCandidates(workspaceRoot, scope, limitations)
    : collectFallbackCandidates(workspaceRoot, scope, limitations, ignoredCandidates);

  const candidateGitRoots = new Map();
  for (const candidatePath of rawCandidatePaths) {
    const validation = validateGitRoot(candidatePath);
    if (!validation.ok) {
      limitations.push(makeLimitation('git_root_invalid', 'Candidate path is not a validated git root.', {
        path: candidatePath,
        detail: validation.error,
      }));
      continue;
    }
    if (!isInsideWorkspace(workspaceRoot, validation.gitRoot)) {
      limitations.push(makeLimitation('git_root_invalid', 'Validated git root is outside the workspace boundary.', {
        path: validation.gitRoot,
      }));
      continue;
    }
    candidateGitRoots.set(validation.gitRoot, validation.gitRoot);
  }

  const usedSlugs = new Set();
  const children = [...candidateGitRoots.values()]
    .sort((a, b) => a.localeCompare(b))
    .map((repoRoot) => {
      const { slug, collision_resolved: collisionResolved } = makeChildSlug(workspaceRoot, repoRoot, usedSlugs);
      const relationship = classifyRelationship(workspaceRoot, repoRoot);
      const markerKind = getGitMarkerKind(repoRoot);
      const signals = [
        configApplied ? 'scope_config_applied' : 'scope_fallback_bounded_scan',
        'git_root_verified',
        relationshipSignal(relationship),
      ];
      if (markerKind === 'file') signals.push('git_file_detected');
      if (collisionResolved) signals.push('slug_collision_resolved');

      const candidate = explicitInclude || relationship === 'root_repo' || relationship === 'nested_independent_repo';
      return {
        slug,
        repo_root: repoRoot,
        git_root: repoRoot,
        relative_path: toPosixPath(path.relative(workspaceRoot, repoRoot)) || '.',
        relationship,
        candidate,
        signals,
        limitations: candidate ? [] : [
          makeLimitation(relationshipSignal(relationship), 'Relationship is advisory by default; explicitly choose it before repo-local CRG execution.', {
            relationship,
          }),
        ],
      };
    });

  const previousIndex = loadPreviousIndex(workspaceRoot);
  const staleEntries = buildStaleEntries(previousIndex, children);
  const index = {
    schema_version: 'workspace-index/v1',
    workspace_root: workspaceRoot,
    generated_at: new Date().toISOString(),
    scope,
    root_fingerprint: buildFingerprint(workspaceRoot, scope, children, limitations),
    children,
    ignored_candidates: ignoredCandidates,
    stale_entries: staleEntries,
    limitations,
  };

  if (write) {
    writeJson(resolveWorkspaceIndex(workspaceRoot), index);
  }

  return index;
}

module.exports = {
  DEFAULT_EXCLUDE_GLOBS,
  DEFAULT_MAX_DEPTH,
  discoverWorkspace,
  matchesGlob,
  validateGitRoot,
};
