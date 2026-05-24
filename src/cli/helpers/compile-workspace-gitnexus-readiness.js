'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 'workspace-gitnexus-readiness.v1';
const SCRIPT_QUERY_KEYS = ['fresh-primary', 'stale-advisory', 'definitions-pointer', 'unavailable'];
const REFRESH_ELIGIBILITY_KEYS = [
  'eligible',
  'eligible-after-refresh',
  'blocked-dirty-source',
  'setup-required',
];
const INDEX_SNAPSHOT_KEYS = [
  'current-clean',
  'current-with-dirty-overlay',
  'stale-commit',
  'missing',
];
const OVERLAY_QUERY_KEYS = [
  'fresh-primary',
  'stale-advisory',
  'registry-present-query-unverified',
  'registry-fanout-advisory',
  'definitions-pointer',
  'unavailable',
];
const GROUP_STATUSES = new Set([
  'group-ready',
  'group-missing',
  'group-sync-required',
  'unavailable',
  'not-evaluated-no-mcp-input',
]);

function runWorkspaceGitNexusReadiness(argv, env = {}) {
  const io = {
    cwd: env.cwd || process.cwd(),
    stdout: env.stdout || process.stdout,
    stderr: env.stderr || process.stderr,
  };
  const parsed = parseArgs(argv);
  if (parsed.error) {
    writeJson(io.stdout, errorPayload(parsed.error.code, parsed.error.message));
    return 2;
  }

  try {
    const result = compileWorkspaceGitNexusReadiness(parsed.options, io.cwd);
    if (result.write_path) {
      atomicWriteJson(result.write_path, result.payload);
    }
    writeJson(io.stdout, result.payload);
    return 0;
  } catch (error) {
    const code = error && error.reason_code ? error.reason_code : 'workspace-gitnexus-readiness-internal-error';
    writeJson(io.stdout, errorPayload(code, error instanceof Error ? error.message : String(error)));
    return code === 'invalid-registry-snapshot' ? 1 : 2;
  }
}

function compileWorkspaceGitNexusReadiness(options, cwd = process.cwd()) {
  const mode = options.mode || 'script';
  if (!['script', 'skill-prose'].includes(mode)) {
    throw reasonError('invalid-mode', `unsupported mode: ${mode}`);
  }
  if (!options.workspaceTargets) {
    throw reasonError('missing-required-option', '--workspace-targets is required');
  }
  if (mode === 'script' && (options.registryList || options.groupList)) {
    throw reasonError('script-mode-mcp-input-forbidden', 'script mode does not accept list_repos or group_list snapshots');
  }
  if (mode === 'skill-prose' && options.writeArtifact) {
    throw reasonError('skill-prose-mode-cannot-persist', 'skill-prose mode is session-local and cannot write artifacts');
  }
  if (mode === 'skill-prose' && !options.registryList) {
    throw reasonError('missing-required-option', '--registry-list is required in skill-prose mode');
  }

  const workspaceTargets = readJsonFile(options.workspaceTargets, 'invalid-workspace-targets');
  if (containsDevelopmentMode(workspaceTargets)) {
    throw reasonError('unsupported-input', 'development_mode is not a classifier input or output field');
  }
  validateWorkspaceTargets(workspaceTargets);

  const topology = workspaceTargets.git_root_topology ?? null;
  if (topology !== null && topology !== 'single-repo' && topology !== 'multi-repo-workspace') {
    throw reasonError('unsupported-input', `unsupported git_root_topology: ${topology}`);
  }

  if (topology !== 'multi-repo-workspace') {
    return compileNotApplicable({
      mode,
      workspaceTargets,
      topology,
      cwd,
      writeArtifact: options.writeArtifact,
    });
  }

  const registryState = mode === 'skill-prose'
    ? normalizeRegistrySnapshot(readJsonFile(options.registryList, 'invalid-registry-snapshot'))
    : notEvaluatedRegistryState();
  const groupState = mode === 'skill-prose'
    ? normalizeGroupSnapshot(options.groupList ? readJsonFile(options.groupList, 'invalid-registry-snapshot') : null)
    : notEvaluatedGroupState();

  const repos = (workspaceTargets.repos || []).map((repo) => classifyRepo(repo, registryState, mode));
  const groupClassification = classifyGroup(groupState, repos);
  const group = groupClassification.group;
  const queryKeys = mode === 'skill-prose' ? OVERLAY_QUERY_KEYS : SCRIPT_QUERY_KEYS;
  const queryUsabilityCounts = countQueryUsability(repos, queryKeys);
  const recommendedQueryPath = chooseRecommendedQueryPath({ mode, group, registryState, repos });
  const payload = {
    schema_version: SCHEMA_VERSION,
    advisory: true,
    git_root_topology: topology,
    parent_writes_repo_local_artifacts: false,
    invocation_mode: mode,
    generated_from: {
      workspace_targets: options.workspaceTargets,
      registry_list: mode === 'skill-prose' ? (options.registryList || null) : null,
      group_list: mode === 'skill-prose' ? (options.groupList || null) : null,
    },
    recommended_query_path: recommendedQueryPath,
    group,
    group_reason_code: groupClassification.reason_code,
    repos,
    query_usability_counts: queryUsabilityCounts,
    limitations: buildLimitations({ mode, registryState, groupState, repos }),
  };

  if (mode === 'skill-prose') {
    payload.runtime_mcp_overlay = {
      status: classifyRuntimeMcpOverlayStatus(registryState, groupState),
    };
  }

  const writePath = mode === 'script' && options.writeArtifact
    ? resolveArtifactPath(options.output, workspaceTargets, cwd)
    : null;

  return {
    payload,
    write_path: writePath,
  };
}

function compileNotApplicable({ mode, workspaceTargets, topology, cwd, writeArtifact }) {
  const reasonCode = topology === null ? (workspaceTargets.reason_code || 'workspace-target-required') : 'repo-local-gitnexus';
  const payload = {
    schema_version: SCHEMA_VERSION,
    advisory: true,
    git_root_topology: topology,
    parent_writes_repo_local_artifacts: false,
    invocation_mode: mode,
    status: 'not-applicable',
    reason_code: reasonCode,
    recommended_query_path: 'direct-read-fallback',
    group: {
      name: null,
      status: 'not-evaluated-no-mcp-input',
      query_selector: null,
    },
    group_reason_code: 'not-applicable',
    repos: [],
    query_usability_counts: countQueryUsability([], mode === 'skill-prose' ? OVERLAY_QUERY_KEYS : SCRIPT_QUERY_KEYS),
    limitations: topology === 'single-repo'
      ? ['single Git root uses repo-local GitNexus evidence; workspace group readiness is not applicable']
      : ['target resolution is blocked; select a child repo or run from a multi-repo parent workspace'],
  };

  return {
    payload,
    write_path: null,
    would_write_path: writeArtifact ? path.join(path.resolve(cwd, workspaceTargets.workspace_root || workspaceTargets.invocation_cwd || cwd), '.spec-first', 'workspace', 'gitnexus-readiness.json') : null,
  };
}

function classifyRepo(repo, registryState, mode) {
  const registryMatch = matchRegistryRepo(repo, registryState);
  const baseUsability = normalizeQueryUsability(repo.query_usability, mode === 'skill-prose' ? OVERLAY_QUERY_KEYS : SCRIPT_QUERY_KEYS);
  const gitnexusProvider = repo.providers && repo.providers.gitnexus ? repo.providers.gitnexus : {};
  const requiresCleanFullRefresh = gitnexusProvider.requires_clean_full_refresh === true;
  const hasPriorQueryProof = Boolean(gitnexusProvider.last_indexed_commit) && !requiresCleanFullRefresh;
  const queryReady = Boolean(gitnexusProvider.query_ready) && !requiresCleanFullRefresh;
  let queryUsability = baseUsability;

  if (mode === 'skill-prose') {
    if (registryState.status !== 'available') {
      queryUsability = baseUsability === 'fresh-primary' || baseUsability === 'stale-advisory' || baseUsability === 'definitions-pointer'
        ? baseUsability
        : 'unavailable';
    } else if (!registryMatch) {
      queryUsability = 'unavailable';
    } else if (queryReady && baseUsability === 'fresh-primary') {
      queryUsability = 'registry-fanout-advisory';
    } else if (hasPriorQueryProof || (baseUsability === 'stale-advisory' && !requiresCleanFullRefresh)) {
      queryUsability = 'stale-advisory';
    } else if (baseUsability === 'definitions-pointer') {
      queryUsability = 'definitions-pointer';
    } else {
      queryUsability = 'registry-present-query-unverified';
    }
  }

  return {
    target_repo: repo.target_repo || repo.repo_label || repo.workspace_relative_path || null,
    repo_boundary: 'child-git-root',
    workspace_relative_path: repo.workspace_relative_path || null,
    git_root: repo.git_root || null,
    gitnexus_repo: registryMatch ? registryMatch.name : (repo.providers && repo.providers.gitnexus ? repo.providers.gitnexus.repo || null : null),
    registry_match: registryMatch ? {
      status: 'matched',
      confidence: registryMatch.confidence,
      name: registryMatch.name,
    } : {
      status: registryState.status === 'available' ? 'missing' : 'not-evaluated',
      confidence: 'none',
      name: null,
    },
    refresh_eligibility: normalizeEnum(repo.refresh_eligibility, REFRESH_ELIGIBILITY_KEYS, 'setup-required'),
    index_snapshot: normalizeEnum(repo.index_snapshot, INDEX_SNAPSHOT_KEYS, 'missing'),
    query_usability: queryUsability,
    working_tree_overlay: repo.working_tree_overlay || {
      dirty: Boolean(repo.git && repo.git.current_worktree_dirty),
      status_hash: repo.git ? repo.git.current_worktree_status_hash || null : null,
      indexed_status_hash: repo.freshness ? repo.freshness.worktree_status_hash || null : null,
      limitation: null,
    },
    limitations: buildRepoLimitations(repo, queryUsability, registryState, registryMatch),
  };
}

function buildRepoLimitations(repo, queryUsability, registryState, registryMatch) {
  const limitations = Array.isArray(repo.limitations) ? [...repo.limitations] : [];
  if (queryUsability === 'stale-advisory') {
    limitations.push('GitNexus index is stale/advisory; verify dirty or stale paths with direct source reads');
  }
  if (queryUsability === 'registry-present-query-unverified') {
    limitations.push('GitNexus registry contains the repo, but current provider status has no prior query-ready proof');
  }
  if (registryState.status === 'available' && !registryMatch) {
    limitations.push('repo is missing from GitNexus registry snapshot');
  }
  return uniqueStrings(limitations);
}

function classifyGroup(groupState, repos) {
  if (groupState.status !== 'available') {
    return {
      group: {
        name: null,
        status: groupState.status === 'not-evaluated' ? 'not-evaluated-no-mcp-input' : 'unavailable',
        query_selector: null,
      },
      reason_code: groupState.reason_code,
    };
  }
  if (groupState.groups.length === 0) {
    return {
      group: {
        name: null,
        status: 'group-missing',
        query_selector: null,
      },
      reason_code: 'group-list-empty',
    };
  }

  const repoNames = new Set(repos.map((repo) => repo.gitnexus_repo).filter(Boolean));
  const matchingGroups = groupState.groups.filter((group) => (
    group.members.length > 0 && group.members.some((member) => repoNames.has(member))
  ));
  if (matchingGroups.length === 0) {
    return {
      group: {
        name: null,
        status: 'group-missing',
        query_selector: null,
      },
      reason_code: 'group-list-no-workspace-match',
    };
  }

  const unsupported = matchingGroups.find((group) => !GROUP_STATUSES.has(group.status));
  if (unsupported) {
    return {
      group: {
        name: unsupported.name,
        status: 'unavailable',
        query_selector: null,
      },
      reason_code: `group-status-unsupported:${unsupported.status}`,
    };
  }

  const ready = matchingGroups.find((group) => group.status === 'group-ready') || matchingGroups[0];
  const querySelector = ready.status === 'group-ready'
    ? (ready.query_selector || (ready.name ? `@${ready.name}` : null))
    : null;

  return {
    group: {
      name: ready.name,
      status: ready.status,
      query_selector: querySelector,
    },
    reason_code: ready.status === 'group-ready' ? null : ready.status,
  };
}

function classifyRuntimeMcpOverlayStatus(registryState, groupState) {
  if (registryState.status === 'available' && groupState.status === 'available') return 'evaluated';
  if (registryState.status === 'available' || groupState.status === 'available') return 'partial';
  return 'unavailable';
}

function chooseRecommendedQueryPath({ mode, group, registryState, repos }) {
  if (mode === 'skill-prose' && group.status === 'group-ready') return 'group-query';
  if (mode === 'skill-prose' && registryState.status === 'available' && repos.some((repo) => repo.registry_match.status === 'matched')) {
    return 'bounded-registry-fanout';
  }
  return 'direct-read-fallback';
}

function buildLimitations({ mode, registryState, groupState, repos }) {
  const limitations = [];
  if (mode === 'script') {
    limitations.push('script mode did not evaluate live GitNexus list_repos/group_list MCP evidence');
  }
  if (registryState.reason_code) limitations.push(`registry snapshot: ${registryState.reason_code}`);
  if (groupState.reason_code) limitations.push(`group snapshot: ${groupState.reason_code}`);
  if (repos.some((repo) => repo.query_usability === 'stale-advisory')) {
    limitations.push('one or more repos only have stale/advisory GitNexus query evidence');
  }
  if (repos.some((repo) => repo.query_usability === 'registry-present-query-unverified')) {
    limitations.push('one or more registry repos lack prior query-ready proof');
  }
  return uniqueStrings(limitations);
}

function normalizeRegistrySnapshot(snapshot) {
  if (snapshot === null || Array.isArray(snapshot) || typeof snapshot !== 'object') {
    throw reasonError('invalid-registry-snapshot', 'list_repos snapshot root must be an object');
  }
  const rawRepos = snapshot.repos || snapshot.repositories || snapshot.items;
  if (!Array.isArray(rawRepos)) {
    return {
      status: 'unavailable',
      reason_code: 'unknown-payload-shape',
      repos: [],
    };
  }
  const repos = [];
  for (const item of rawRepos) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || item.name.trim() === '') {
      return {
        status: 'unavailable',
        reason_code: 'unknown-payload-shape',
        repos: [],
      };
    }
    repos.push({
      name: item.name,
      path: typeof item.path === 'string' ? item.path : (typeof item.repo_root === 'string' ? item.repo_root : null),
    });
  }
  return {
    status: 'available',
    reason_code: null,
    repos,
  };
}

function normalizeGroupSnapshot(snapshot) {
  if (snapshot === null || snapshot === undefined) {
    return {
      status: 'unavailable',
      reason_code: 'group-list-not-provided',
      groups: [],
    };
  }
  if (Array.isArray(snapshot) || typeof snapshot !== 'object') {
    return {
      status: 'unavailable',
      reason_code: 'unknown-payload-shape',
      groups: [],
    };
  }
  const rawGroups = snapshot.groups || snapshot.items || [];
  if (!Array.isArray(rawGroups)) {
    return {
      status: 'unavailable',
      reason_code: 'unknown-payload-shape',
      groups: [],
    };
  }
  const groups = [];
  for (const item of rawGroups) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || item.name.trim() === '') {
      return {
        status: 'unavailable',
        reason_code: 'unknown-payload-shape',
        groups: [],
      };
    }
    groups.push({
      name: item.name,
      status: typeof item.status === 'string' ? item.status : 'group-ready',
      query_selector: typeof item.query_selector === 'string' ? item.query_selector : null,
      members: normalizeGroupMembers(item),
    });
  }
  return {
    status: 'available',
    reason_code: null,
    groups,
  };
}

function normalizeGroupMembers(item) {
  const rawMembers = item.members || item.repos || item.repositories || [];
  if (!Array.isArray(rawMembers)) return [];
  return rawMembers.map((member) => {
    if (typeof member === 'string') return member;
    if (member && typeof member === 'object' && typeof member.name === 'string') return member.name;
    if (member && typeof member === 'object' && typeof member.repo === 'string') return member.repo;
    return null;
  }).filter(Boolean);
}

function notEvaluatedRegistryState() {
  return {
    status: 'not-evaluated',
    reason_code: 'script-mode-no-mcp',
    repos: [],
  };
}

function notEvaluatedGroupState() {
  return {
    status: 'not-evaluated',
    reason_code: 'script-mode-no-mcp',
    groups: [],
  };
}

function matchRegistryRepo(repo, registryState) {
  if (registryState.status !== 'available') return null;
  const explicit = repo.providers && repo.providers.gitnexus ? repo.providers.gitnexus.repo : null;
  const registryRepos = registryState.repos.filter((item) => registryPathMatchesRepo(repo, item));
  const candidates = [
    explicit,
    repo.target_repo,
    repo.repo_label,
    repo.workspace_relative_path,
    repo.git_root ? path.basename(repo.git_root) : null,
  ].filter(Boolean).map(String);

  for (const candidate of candidates) {
    const exact = registryRepos.find((item) => item.name === candidate);
    if (exact) return { ...exact, confidence: candidate === explicit ? 'high' : 'medium' };
  }
  for (const candidate of candidates) {
    const base = path.basename(candidate);
    const basenameMatch = registryRepos.find((item) => path.basename(item.name) === base || (item.path && path.basename(item.path) === base));
    if (basenameMatch) return { ...basenameMatch, confidence: 'low' };
  }
  return null;
}

function registryPathMatchesRepo(repo, registryRepo) {
  if (!registryRepo || !registryRepo.path || !repo.git_root) return true;
  const repoRoot = normalizeComparablePath(repo.git_root);
  const registryPath = normalizeComparablePath(registryRepo.path);
  return repoRoot === registryPath;
}

function normalizeComparablePath(value) {
  return path.resolve(String(value)).replace(/\\/g, '/');
}

function validateWorkspaceTargets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw reasonError('invalid-workspace-targets', 'workspace targets root must be an object');
  }
  if (value.schema_version !== 'workspace-graph-targets.v1') {
    throw reasonError('invalid-workspace-targets', 'workspace targets schema_version must be workspace-graph-targets.v1');
  }
  if (!Array.isArray(value.repos)) {
    throw reasonError('invalid-workspace-targets', 'workspace targets repos must be an array');
  }
}

function containsDevelopmentMode(value) {
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'development_mode')) return true;
  return Array.isArray(value.repos) && value.repos.some((repo) => repo && typeof repo === 'object' && Object.prototype.hasOwnProperty.call(repo, 'development_mode'));
}

function normalizeQueryUsability(value, allowedKeys = OVERLAY_QUERY_KEYS) {
  if (allowedKeys.includes(value)) return value;
  return 'unavailable';
}

function normalizeEnum(value, allowedKeys, fallback) {
  if (allowedKeys.includes(value)) return value;
  return fallback;
}

function countQueryUsability(repos, keys) {
  const counts = {};
  for (const key of keys) counts[key] = 0;
  for (const repo of repos) {
    if (Object.prototype.hasOwnProperty.call(counts, repo.query_usability)) {
      counts[repo.query_usability] += 1;
    }
  }
  return counts;
}

function resolveArtifactPath(output, workspaceTargets, cwd) {
  const workspaceRoot = workspaceTargets.workspace_root || workspaceTargets.invocation_cwd || cwd;
  const baseRoot = path.resolve(cwd, workspaceRoot);
  const artifactPath = output
    ? path.resolve(cwd, output)
    : path.join(baseRoot, '.spec-first', 'workspace', 'gitnexus-readiness.json');
  validateArtifactOutputPath(baseRoot, artifactPath);
  return artifactPath;
}

function validateArtifactOutputPath(workspaceRoot, artifactPath) {
  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(artifactPath);
  if (!isSubpath(root, candidate)) {
    throw reasonError('artifact-output-outside-workspace', `artifact output must stay under workspace root: ${candidate}`);
  }

  let realRoot;
  try {
    realRoot = fs.realpathSync.native(root);
  } catch (error) {
    throw reasonError('artifact-output-root-unavailable', `workspace root realpath failed: ${error.message}`);
  }

  const existingAncestor = findExistingAncestor(path.dirname(candidate), root);
  let realAncestor;
  try {
    realAncestor = fs.realpathSync.native(existingAncestor);
  } catch (error) {
    throw reasonError('artifact-output-symlink-escape', `artifact output ancestor realpath failed: ${error.message}`);
  }
  if (!isSubpath(realRoot, realAncestor)) {
    throw reasonError('artifact-output-symlink-escape', `artifact output ancestor escapes workspace root: ${existingAncestor}`);
  }
}

function findExistingAncestor(candidate, root) {
  let current = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  while (!fs.existsSync(current)) {
    if (current === resolvedRoot || path.dirname(current) === current) return current;
    current = path.dirname(current);
  }
  return current;
}

function isSubpath(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      options.mode = argv[++i];
    } else if (arg === '--workspace-targets') {
      options.workspaceTargets = argv[++i];
    } else if (arg === '--registry-list') {
      options.registryList = argv[++i];
    } else if (arg === '--group-list') {
      options.groupList = argv[++i];
    } else if (arg === '--output') {
      options.output = argv[++i];
    } else if (arg === '--write-artifact') {
      options.writeArtifact = true;
    } else if (arg === '--help' || arg === '-h') {
      return { error: { code: 'help', message: usage() } };
    } else {
      return { error: { code: 'unknown-option', message: `unknown option: ${arg}` } };
    }
  }
  return { options };
}

function usage() {
  return [
    'Usage: compile-workspace-gitnexus-readiness --mode script|skill-prose --workspace-targets <json> [options]',
    'Options:',
    '  --registry-list <json>   Sanitized GitNexus list_repos snapshot (skill-prose mode)',
    '  --group-list <json>      Sanitized GitNexus group_list snapshot (skill-prose mode)',
    '  --write-artifact         Write script-mode artifact',
    '  --output <path>          Artifact output path',
  ].join('\n');
}

function readJsonFile(filePath, reasonCode) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw reasonError(reasonCode, `failed to read JSON ${filePath}: ${error.message}`);
  }
}

function atomicWriteJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tmp, filePath);
}

function reasonError(reasonCode, message) {
  const error = new Error(message);
  error.reason_code = reasonCode;
  return error;
}

function errorPayload(code, message) {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function writeJson(stream, payload) {
  stream.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

if (require.main === module) {
  process.exitCode = runWorkspaceGitNexusReadiness(process.argv.slice(2));
}

module.exports = {
  OVERLAY_QUERY_KEYS,
  SCHEMA_VERSION,
  SCRIPT_QUERY_KEYS,
  compileWorkspaceGitNexusReadiness,
  normalizeGroupSnapshot,
  normalizeRegistrySnapshot,
  runWorkspaceGitNexusReadiness,
};
