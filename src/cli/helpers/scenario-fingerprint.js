'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SETUP_SCHEMA_VERSION = 'developer-scenario-fingerprint-setup.v1';
const BOOTSTRAP_SCHEMA_VERSION = 'developer-scenario-fingerprint.v1';
const PENDING_BUILD_TARGET_SCAN_REASON = 'pending-build-target-scan-p4';
const PROVISIONAL_SCENARIO_CLASSES = [
  'clean-single-repo',
  'dirty-single-repo',
  'first-time-git-repo',
  'multi-repo-workspace',
  'multi-repo-dirty-workspace',
  'foreign-residual-workspace',
  'non-git-folder',
  'non-git-build-workspace',
  'provider-degraded',
];
const GENERATED_RUNTIME_SEGMENTS = new Set([
  '.git',
  'node_modules',
  'vendor',
  '.claude',
  '.codex',
  '.agents',
  '.spec-first',
  'build',
  'dist',
  'coverage',
]);
const BUILD_MANIFEST_NAMES = new Set([
  'settings.gradle',
  'settings.gradle.kts',
  'build.gradle',
  'build.gradle.kts',
  'package.json',
  'pnpm-workspace.yaml',
]);
const REPO_LOCAL_ARTIFACT_PATHS = [
  '.spec-first/graph/graph-facts.json',
  '.spec-first/providers/gitnexus/status.json',
  '.spec-first/config/runtime-capabilities.json',
  '.gitnexus/meta.json',
];

function runScenarioFingerprint(argv, env = {}) {
  const io = {
    cwd: env.cwd || process.cwd(),
    stdout: env.stdout || process.stdout,
    stderr: env.stderr || process.stderr,
  };
  const parsed = parseArgs(argv);
  if (parsed.error) {
    writeJson(io.stdout, errorPayload(parsed.error.code, parsed.error.message));
    return parsed.error.code === 'help' ? 0 : 2;
  }
  if (!['setup', 'bootstrap'].includes(parsed.options.layer)) {
    writeJson(io.stdout, errorPayload('unsupported-layer', 'supported layers: setup, bootstrap'));
    return 2;
  }

  try {
    const result = parsed.options.layer === 'setup'
      ? computeSetupLayer({
        cwd: io.cwd,
        workspaceRoot: parsed.options.workspaceRoot,
        targetFactsPath: parsed.options.targetFacts,
        ledgerPath: parsed.options.ledger,
        maxBuildScanDepth: parsed.options.maxBuildScanDepth,
      })
      : computeBootstrapLayer({
        cwd: io.cwd,
        workspaceRoot: parsed.options.workspaceRoot,
        setupFingerprintPath: parsed.options.setupFingerprint,
        graphFactsPath: parsed.options.graphFacts,
        providerStatusPath: parsed.options.providerStatus,
        graphBootstrapSummaryPath: parsed.options.graphBootstrapSummary,
      });
    if (!result.fingerprint_setup_missing && (parsed.options.writeArtifact || parsed.options.output)) {
      if (!parsed.options.output) {
        throw reasonError('missing-required-option', '--output is required when writing a scenario fingerprint artifact');
      }
      atomicWriteJson(validateOutputPath(result.workspace_root, parsed.options.output), result);
    }
    writeJson(io.stdout, result);
    return 0;
  } catch (error) {
    const code = error && error.reason_code ? error.reason_code : 'scenario-fingerprint-internal-error';
    writeJson(io.stdout, errorPayload(code, error instanceof Error ? error.message : String(error)));
    return 2;
  }
}

function computeSetupLayer(input = {}) {
  const cwd = path.resolve(input.cwd || process.cwd());
  const ledger = input.ledger || readOptionalJson(input.ledgerPath, 'invalid-readiness-ledger');
  const targetFacts = input.targetFacts || readOptionalJson(input.targetFactsPath, 'invalid-target-facts') || ledger || {};
  const target = targetFacts.target && typeof targetFacts.target === 'object' ? targetFacts.target : targetFacts;
  const workspaceRoot = path.resolve(
    input.workspaceRoot
      || targetFacts.workspace_root
      || target.workspace_root
      || targetFacts.repo_root
      || target.invocation_cwd
      || cwd,
  );
  const targetRoot = path.resolve(
    targetFacts.target_root
      || targetFacts.selected_repo_root
      || targetFacts.selected_folder_root
      || target.target_root
      || target.selected_repo_root
      || target.selected_folder_root
      || targetFacts.repo_root
      || workspaceRoot,
  );
  const targetKind = targetFacts.target_kind || target.target_kind || (isGitRepo(targetRoot) ? 'git-repo' : 'non-git-folder');
  const topologyMode = targetFacts.target_mode || targetFacts.mode || target.mode || (targetKind === 'git-repo' ? 'git-repo' : 'non-git-folder');
  const candidates = normalizeCandidates(targetFacts.target_candidates || target.candidates || [], workspaceRoot);
  const childRepos = topologyMode === 'multi-repo-workspace' || candidates.length > 0
    ? candidates
    : [];
  const gitDirty = targetKind === 'git-repo'
    ? getGitDirtyFacts(targetRoot)
    : { dirty: false, paths: [], status_hash: null, head: null };
  const childDirtyCount = childRepos.filter(repo => repo.git && repo.git.current_worktree_dirty === true).length;
  const parentRepoLocalArtifactsPresent = topologyMode !== 'git-repo' && hasParentRepoLocalArtifacts(workspaceRoot);
  const foreignResidualIndicators = collectForeignResidualIndicators(workspaceRoot);
  const buildTargets = scanBuildManifests(workspaceRoot, {
    maxDepth: input.maxBuildScanDepth == null ? 4 : input.maxBuildScanDepth,
    childRepos,
    targetRoot,
  });
  const coverageGap = targetFacts.coverage_gap || target.coverage_gap || null;
  const nonGitBuildTargetsPresent = buildTargets.non_git_build_targets_present || Boolean(coverageGap && (
    Number(coverageGap.uncovered_count || 0) > 0
    || Number(coverageGap.uncovered_build_modules || 0) > 0
  ));
  const providerQueryDegraded = providerIsDegraded(targetFacts);
  const firstTimeGitRepo = targetKind === 'git-repo' && !hasPriorSpecFirstArtifacts(targetRoot);
  const multiRepoWorkspace = topologyMode === 'multi-repo-workspace' || childRepos.length > 0;
  const worktreeDirtyGraphAffecting = multiRepoWorkspace ? childDirtyCount > 0 : gitDirty.dirty;
  const complexityDimensions = {
    multi_repo_workspace: multiRepoWorkspace,
    non_git_folder_target: targetKind === 'non-git-folder',
    non_git_build_targets_present: nonGitBuildTargetsPresent,
    git_alignment_broken: Boolean(coverageGap && Number(coverageGap.uncovered_count || coverageGap.uncovered_build_modules || 0) > 0),
    parent_repo_local_artifacts_present: parentRepoLocalArtifactsPresent,
    worktree_dirty_graph_affecting: worktreeDirtyGraphAffecting,
    provider_query_degraded: providerQueryDegraded,
  };
  const stateClass = classifyState({
    targetKind,
    multiRepoWorkspace,
    firstTimeGitRepo,
    nonGitBuildTargetsPresent,
    worktreeDirtyGraphAffecting,
    providerQueryDegraded,
    foreignResidualIndicators,
  });

  return {
    schema_version: SETUP_SCHEMA_VERSION,
    advisory: true,
    layer: 'setup',
    generated_at: new Date().toISOString(),
    producer: 'spec-first internal compute-scenario-fingerprint --layer setup',
    state_class: stateClass,
    scenario_class_provisional: true,
    scenario_class_source: 'docs/plans/2026-05-28-002-PA-pre-calibration-notes.md',
    workspace_root: toPosixPath(workspaceRoot),
    target_root: toPosixPath(targetRoot),
    topology: {
      target_kind: targetKind,
      repo_topology: multiRepoWorkspace ? 'multi-repo-workspace' : (targetKind === 'git-repo' ? 'single-repo' : 'non-git-folder'),
      selection_source: targetFacts.selection_source || target.selection_source || null,
      repo_label: targetFacts.repo_label || target.repo_label || path.basename(targetRoot),
      child_repo_count: childRepos.length,
      child_repos: childRepos.map(repo => ({
        repo_label: repo.repo_label,
        workspace_relative_path: repo.workspace_relative_path,
        git_root: repo.git_root,
        head: repo.git && repo.git.head ? repo.git.head : null,
        dirty: Boolean(repo.git && repo.git.current_worktree_dirty),
      })),
      non_git_build_targets_present: nonGitBuildTargetsPresent,
      build_manifest_sample: buildTargets.sample,
    },
    worktree: {
      dirty: worktreeDirtyGraphAffecting,
      dirty_paths_sample: gitDirty.paths.slice(0, 30).map(pathValue => ({
        path: toPosixPath(pathValue),
        graph_affecting: isGraphAffectingPath(pathValue),
      })),
      status_hash: gitDirty.status_hash,
      head: gitDirty.head,
      dirty_child_count: childDirtyCount,
    },
    complexity_dimensions: complexityDimensions,
    providers_status_refs: {
      gitnexus: providerStatusRef(targetFacts),
    },
    foreign_residual_indicators: foreignResidualIndicators,
    freshness: {
      setup_generated_at: new Date().toISOString(),
      source_revision: gitDirty.head,
    },
    tags: buildTags(stateClass, complexityDimensions),
    limitations: buildLimitations({
      targetKind,
      firstTimeGitRepo,
      buildTargets,
      foreignResidualIndicators,
    }),
    generated_from: {
      readiness_ledger: input.ledgerPath ? toPosixPath(path.resolve(input.ledgerPath)) : null,
      target_facts: input.targetFactsPath ? toPosixPath(path.resolve(input.targetFactsPath)) : null,
    },
  };
}

function computeBootstrapLayer(input = {}) {
  const cwd = path.resolve(input.cwd || process.cwd());
  const provisionalWorkspaceRoot = path.resolve(input.workspaceRoot || cwd);
  const setupFingerprintPath = path.resolve(
    input.setupFingerprintPath
      || path.join(provisionalWorkspaceRoot, '.spec-first', 'workspace', 'scenario-fingerprint-setup.json'),
  );
  if (!fs.existsSync(setupFingerprintPath)) {
    return {
      ok: true,
      advisory: true,
      layer: 'bootstrap',
      fingerprint_setup_missing: true,
      reason_code: 'fingerprint-setup-missing',
      setup_fingerprint_path: toPosixPath(setupFingerprintPath),
      next_action: 'Run spec-first mcp setup before graph bootstrap to create .spec-first/workspace/scenario-fingerprint-setup.json.',
    };
  }

  const setup = readOptionalJson(setupFingerprintPath, 'invalid-setup-scenario-fingerprint');
  const workspaceRoot = path.resolve(input.workspaceRoot || setup.workspace_root || provisionalWorkspaceRoot);
  const targetRoot = path.resolve(setup.target_root || workspaceRoot);
  const graphFactsPath = path.resolve(input.graphFactsPath || path.join(workspaceRoot, '.spec-first', 'graph', 'graph-facts.json'));
  const providerStatusPath = path.resolve(input.providerStatusPath || path.join(workspaceRoot, '.spec-first', 'graph', 'provider-status.json'));
  const graphBootstrapSummaryPath = input.graphBootstrapSummaryPath
    ? path.resolve(input.graphBootstrapSummaryPath)
    : path.join(workspaceRoot, '.spec-first', 'workspace', 'graph-bootstrap-summary.json');
  const graphFacts = readJsonIfExists(graphFactsPath, 'invalid-graph-facts') || {};
  const providerStatus = readJsonIfExists(providerStatusPath, 'invalid-provider-status') || {};
  const graphBootstrapSummary = readJsonIfExists(graphBootstrapSummaryPath, 'invalid-graph-bootstrap-summary') || {};
  const gitnexusStatus = extractGitNexusStatus(providerStatus);
  const currentRevision = graphFacts.source_revision
    || (gitnexusStatus.repo_snapshot && gitnexusStatus.repo_snapshot.source_revision)
    || (isGitRepo(targetRoot) ? getGitDirtyFacts(targetRoot).head : null);
  const staleSetup = computeSetupLayerStaleness({
    setup,
    currentRevision,
    graphBootstrapSummary,
  });
  const dirtyChildCount = deriveDirtyChildCount({
    setup,
    graphFacts,
    graphBootstrapSummary,
  });
  const bootstrapGeneratedAt = new Date().toISOString();
  const setupRefs = setup.providers_status_refs && typeof setup.providers_status_refs === 'object'
    ? setup.providers_status_refs
    : {};

  return {
    ...setup,
    schema_version: BOOTSTRAP_SCHEMA_VERSION,
    advisory: true,
    layer: 'bootstrap',
    generated_at: bootstrapGeneratedAt,
    producer: 'spec-first internal compute-scenario-fingerprint --layer bootstrap',
    workspace_root: toPosixPath(workspaceRoot),
    target_root: toPosixPath(targetRoot),
    topology: {
      ...(setup.topology || {}),
      git_misaligned_build_targets: null,
      build_target_coverage_ratio: null,
      build_target_coverage_reason_code: PENDING_BUILD_TARGET_SCAN_REASON,
    },
    worktree: {
      ...(setup.worktree || {}),
      dirty: graphFacts.worktree_dirty == null ? Boolean(setup.worktree && setup.worktree.dirty) : Boolean(graphFacts.worktree_dirty),
      dirty_paths_sample: Array.isArray(graphFacts.dirty_paths_sample)
        ? graphFacts.dirty_paths_sample.map(item => ({
          ...item,
          path: toPosixPath(item.path),
        }))
        : (setup.worktree && Array.isArray(setup.worktree.dirty_paths_sample) ? setup.worktree.dirty_paths_sample : []),
      status_hash: graphFacts.worktree_status_hash || (setup.worktree && setup.worktree.status_hash) || null,
      head: currentRevision || (setup.worktree && setup.worktree.head) || null,
      dirty_child_count: dirtyChildCount,
    },
    providers_status_refs: {
      ...setupRefs,
      gitnexus: buildBootstrapGitNexusRef({
        setupRef: setupRefs.gitnexus || null,
        gitnexusStatus,
        providerStatusPath,
        graphFactsPath,
      }),
    },
    freshness: {
      ...(setup.freshness || {}),
      setup_layer: {
        path: toWorkspaceRelative(workspaceRoot, setupFingerprintPath),
        schema_version: setup.schema_version || null,
        generated_at: setup.generated_at || (setup.freshness && setup.freshness.setup_generated_at) || null,
        source_revision: (setup.freshness && setup.freshness.source_revision) || (setup.worktree && setup.worktree.head) || null,
      },
      stale_setup_layer: staleSetup.stale,
      stale_setup_layer_reasons: staleSetup.reasons,
      bootstrap_generated_at: bootstrapGeneratedAt,
      bootstrap_source_revision: currentRevision,
      graph_facts_freshness_state: graphFacts.freshness_state || null,
    },
    generated_from: {
      ...(setup.generated_from || {}),
      setup_fingerprint: toWorkspaceRelative(workspaceRoot, setupFingerprintPath),
      graph_facts: fs.existsSync(graphFactsPath) ? toWorkspaceRelative(workspaceRoot, graphFactsPath) : null,
      provider_status: fs.existsSync(providerStatusPath) ? toWorkspaceRelative(workspaceRoot, providerStatusPath) : null,
      graph_bootstrap_summary: fs.existsSync(graphBootstrapSummaryPath) ? toWorkspaceRelative(workspaceRoot, graphBootstrapSummaryPath) : null,
    },
    tags: Array.from(new Set([
      ...((setup.tags && Array.isArray(setup.tags)) ? setup.tags : []),
      'bootstrap-layer',
      ...(staleSetup.stale ? ['stale-setup-layer'] : []),
    ])),
    limitations: Array.from(new Set([
      ...((setup.limitations && Array.isArray(setup.limitations)) ? setup.limitations : []),
      'build-target coverage fields are null until P4 build-target scan fills them',
    ])),
  };
}

function classifyState(facts) {
  if (facts.foreignResidualIndicators.length > 0) return 'foreign-residual-workspace';
  if (facts.targetKind === 'non-git-folder') return facts.nonGitBuildTargetsPresent ? 'non-git-build-workspace' : 'non-git-folder';
  if (facts.multiRepoWorkspace) return facts.worktreeDirtyGraphAffecting ? 'multi-repo-dirty-workspace' : 'multi-repo-workspace';
  if (facts.providerQueryDegraded) return 'provider-degraded';
  if (facts.firstTimeGitRepo) return 'first-time-git-repo';
  if (facts.worktreeDirtyGraphAffecting) return 'dirty-single-repo';
  return 'clean-single-repo';
}

function providerIsDegraded(facts) {
  const provider = facts.graph_providers && facts.graph_providers.gitnexus
    ? facts.graph_providers.gitnexus
    : facts.tools && facts.tools.gitnexus
      ? facts.tools.gitnexus
      : null;
  if (!provider) return false;
  if (provider.dependency_status && provider.dependency_status !== 'ready') return true;
  if (provider.host_config_status && !['ready', 'not-required', 'fallback-active'].includes(provider.host_config_status)) return true;
  if (provider.project_status && !['ready', 'not-applicable', 'workspace-target-required'].includes(provider.project_status)) return true;
  return false;
}

function providerStatusRef(facts) {
  const provider = facts.graph_providers && facts.graph_providers.gitnexus
    ? facts.graph_providers.gitnexus
    : facts.tools && facts.tools.gitnexus
      ? facts.tools.gitnexus
      : null;
  if (!provider) {
    return {
      configured: false,
      query_ready: null,
      bootstrap_required: null,
      status_path: null,
      reason_code: 'provider-not-present-in-setup-facts',
    };
  }
  return {
    configured: Boolean(provider.configured),
    query_ready: provider.query_ready == null ? null : Boolean(provider.query_ready),
    bootstrap_required: provider.bootstrap_required == null ? null : Boolean(provider.bootstrap_required),
    status_path: '.spec-first/graph/provider-status.json',
    reason_code: null,
  };
}

function normalizeCandidates(candidates, workspaceRoot) {
  if (!Array.isArray(candidates)) return [];
  return candidates.map((candidate) => {
    const gitRoot = candidate.git_root || candidate.target_root || candidate.absolute_path || null;
    const absoluteRoot = gitRoot
      ? path.resolve(workspaceRoot, gitRoot)
      : null;
    const gitFacts = absoluteRoot && isGitRepo(absoluteRoot)
      ? getGitDirtyFacts(absoluteRoot)
      : {
        dirty: Boolean(candidate.current_worktree_dirty),
        paths: [],
        status_hash: candidate.current_worktree_status_hash || null,
        head: candidate.source_revision || null,
      };
    return {
      repo_label: candidate.repo_label || candidate.target_repo || candidate.workspace_relative_path || (absoluteRoot ? path.basename(absoluteRoot) : null),
      workspace_relative_path: toPosixPath(candidate.workspace_relative_path || (absoluteRoot ? path.relative(workspaceRoot, absoluteRoot) : '')),
      git_root: absoluteRoot ? toPosixPath(absoluteRoot) : null,
      git: {
        head: gitFacts.head,
        current_worktree_dirty: Boolean(gitFacts.dirty),
        current_worktree_status_hash: gitFacts.status_hash,
      },
    };
  });
}

function getGitDirtyFacts(repoRoot) {
  const status = spawnGit(repoRoot, ['status', '--porcelain']);
  const paths = status.ok
    ? status.stdout.split('\n')
      .map(line => line.slice(3).trim())
      .filter(Boolean)
      .map(line => line.includes(' -> ') ? line.split(' -> ').pop() : line)
    : [];
  const head = spawnGit(repoRoot, ['rev-parse', 'HEAD']);
  return {
    dirty: paths.some(isGraphAffectingPath),
    paths,
    status_hash: status.ok ? `sha256:${sha256(status.stdout)}` : null,
    head: head.ok ? head.stdout.trim() : null,
  };
}

function spawnGit(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function sha256(text) {
  return require('node:crypto').createHash('sha256').update(text || '').digest('hex');
}

function isGitRepo(candidate) {
  return spawnGit(candidate, ['rev-parse', '--is-inside-work-tree']).ok;
}

function isGraphAffectingPath(pathValue) {
  if (!pathValue) return false;
  const normalized = toPosixPath(pathValue);
  return !(
    normalized.startsWith('.spec-first/config/')
    || normalized.startsWith('.spec-first/graph/')
    || normalized.startsWith('.spec-first/providers/')
    || normalized.startsWith('.spec-first/impact/')
    || normalized.startsWith('.spec-first/workspace/')
    || normalized.startsWith('.spec-first/workflows/')
    || normalized.startsWith('.spec-first/sessions/')
    || normalized === 'AGENTS.md'
    || normalized === 'CLAUDE.md'
  );
}

function hasParentRepoLocalArtifacts(workspaceRoot) {
  return ['.spec-first/graph', '.spec-first/providers', '.spec-first/impact', '.gitnexus']
    .some(relativePath => fs.existsSync(path.join(workspaceRoot, relativePath)));
}

function hasPriorSpecFirstArtifacts(targetRoot) {
  return [
    '.spec-first/config/graph-providers.json',
    '.spec-first/config/runtime-capabilities.json',
    '.spec-first/config/provider-artifacts.json',
    '.spec-first/graph/graph-facts.json',
    '.spec-first/providers/gitnexus/status.json',
  ].some(relativePath => fs.existsSync(path.join(targetRoot, relativePath)));
}

function collectForeignResidualIndicators(workspaceRoot) {
  const indicators = [];
  for (const relativePath of REPO_LOCAL_ARTIFACT_PATHS) {
    const artifactPath = path.join(workspaceRoot, relativePath);
    if (!fs.existsSync(artifactPath)) continue;
    let artifact;
    try {
      artifact = readOptionalJson(artifactPath, 'invalid-residual-artifact');
    } catch {
      continue;
    }
    if (!artifact) continue;
    const absolutePaths = collectAbsolutePaths(artifact);
    for (const candidatePath of absolutePaths) {
      const statFailed = !fs.existsSync(candidatePath.path);
      const prefixMismatch = isForeignPrefix(candidatePath.path, workspaceRoot);
      if (statFailed && prefixMismatch) {
        indicators.push({
          artifact_path: toPosixPath(artifactPath),
          field_path: candidatePath.field_path,
          path: toPosixPath(candidatePath.path),
          reason_code: 'stat-failed-and-foreign-prefix-mismatch',
        });
      }
    }
  }
  return dedupeIndicators(indicators);
}

function collectAbsolutePaths(value, fieldPath = '$') {
  const paths = [];
  if (typeof value === 'string' && looksAbsolute(value)) {
    paths.push({ field_path: fieldPath, path: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectAbsolutePaths(item, `${fieldPath}[${index}]`));
    });
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      paths.push(...collectAbsolutePaths(child, `${fieldPath}.${key}`));
    }
  }
  return paths;
}

function looksAbsolute(value) {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
}

function isForeignPrefix(candidate, workspaceRoot) {
  const normalized = toPosixPath(candidate);
  const root = toPosixPath(workspaceRoot);
  const home = toPosixPath(os.homedir());
  return !isSubpath(root, normalized) && !isSubpath(home, normalized);
}

function scanBuildManifests(workspaceRoot, options = {}) {
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 4;
  const childRoots = new Set((options.childRepos || []).map(repo => toPosixPath(repo.git_root || '')));
  const sample = [];
  let nonGitBuildTargetsPresent = false;

  walk(workspaceRoot, 0);
  return {
    non_git_build_targets_present: nonGitBuildTargetsPresent,
    sample,
  };

  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relative = toPosixPath(path.relative(workspaceRoot, fullPath));
      if (entry.isDirectory()) {
        if (GENERATED_RUNTIME_SEGMENTS.has(entry.name)) continue;
        if (childRoots.has(toPosixPath(fullPath))) continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && BUILD_MANIFEST_NAMES.has(entry.name)) {
        const coveredByTargetRoot = isSubpath(toPosixPath(options.targetRoot || workspaceRoot), toPosixPath(fullPath));
        const coveredByChildRepo = Array.from(childRoots).some(root => isSubpath(root, toPosixPath(fullPath)));
        const record = {
          path: relative || entry.name,
          manifest: entry.name,
          covered_by_child_repo: coveredByChildRepo,
        };
        if (sample.length < 20) sample.push(record);
        if (!coveredByTargetRoot && !coveredByChildRepo) {
          nonGitBuildTargetsPresent = true;
        }
      }
    }
  }
}

function buildTags(stateClass, dimensions) {
  return [
    stateClass,
    ...Object.entries(dimensions)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
  ];
}

function buildLimitations({ targetKind, firstTimeGitRepo, buildTargets, foreignResidualIndicators }) {
  const limitations = [];
  if (targetKind === 'non-git-folder') {
    limitations.push('non-git folder facts are setup-time orientation only; GitNexus indexing is not implied');
  }
  if (firstTimeGitRepo) {
    limitations.push('first-time git repo has no prior setup or graph readiness artifacts');
  }
  if (buildTargets.sample.length > 0) {
    limitations.push('build manifest scan is bounded setup-time evidence; build-target coverage is finalized by P4');
  }
  if (foreignResidualIndicators.length > 0) {
    limitations.push('foreign residual classification requires both stat failure and foreign prefix mismatch');
  }
  return limitations;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--layer') {
      options.layer = argv[++i];
    } else if (arg === '--out' || arg === '--output') {
      options.output = argv[++i];
      options.writeArtifact = true;
    } else if (arg === '--write-artifact') {
      options.writeArtifact = true;
    } else if (arg === '--target-facts') {
      options.targetFacts = argv[++i];
    } else if (arg === '--ledger') {
      options.ledger = argv[++i];
    } else if (arg === '--setup-fingerprint') {
      options.setupFingerprint = argv[++i];
    } else if (arg === '--graph-facts') {
      options.graphFacts = argv[++i];
    } else if (arg === '--provider-status') {
      options.providerStatus = argv[++i];
    } else if (arg === '--graph-bootstrap-summary') {
      options.graphBootstrapSummary = argv[++i];
    } else if (arg === '--workspace-root') {
      options.workspaceRoot = argv[++i];
    } else if (arg === '--max-build-scan-depth') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 0) {
        return { error: { code: 'invalid-option', message: '--max-build-scan-depth must be a non-negative integer' } };
      }
      options.maxBuildScanDepth = value;
    } else if (arg === '--help' || arg === '-h') {
      return { error: { code: 'help', message: usage() } };
    } else {
      return { error: { code: 'unknown-option', message: `unknown option: ${arg}` } };
    }
  }
  if (!options.layer) {
    return { error: { code: 'missing-required-option', message: '--layer is required' } };
  }
  return { options };
}

function usage() {
  return [
    'Usage: spec-first internal compute-scenario-fingerprint --layer setup|bootstrap [options]',
    'Options:',
    '  --ledger <json>           Read setup readiness ledger facts',
    '  --target-facts <json>     Read project target facts',
    '  --setup-fingerprint <json> Read setup scenario fingerprint for bootstrap layer',
    '  --graph-facts <json>      Read graph facts for bootstrap layer',
    '  --provider-status <json>  Read provider status for bootstrap layer',
    '  --graph-bootstrap-summary <json> Read parent graph-bootstrap summary for bootstrap layer',
    '  --workspace-root <path>   Override workspace root',
    '  --out <path>              Write fingerprint artifact',
    '  --max-build-scan-depth N  Bounded build manifest scan depth (default: 4)',
  ].join('\n');
}

function validateOutputPath(workspaceRoot, outputPath) {
  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(outputPath);
  if (!isSubpath(toPosixPath(root), toPosixPath(candidate))) {
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
  if (!isSubpath(toPosixPath(realRoot), toPosixPath(realAncestor))) {
    throw reasonError('artifact-output-symlink-escape', `artifact output ancestor escapes workspace root: ${existingAncestor}`);
  }
  return candidate;
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

function readOptionalJson(filePath, reasonCode) {
  if (!filePath) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw reasonError(reasonCode, `failed to read JSON ${filePath}: ${error.message}`);
  }
}

function readJsonIfExists(filePath, reasonCode) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return readOptionalJson(filePath, reasonCode);
}

function extractGitNexusStatus(providerStatus) {
  if (!providerStatus || typeof providerStatus !== 'object') return {};
  if (providerStatus.provider === 'gitnexus') return providerStatus;
  if (Array.isArray(providerStatus.providers)) {
    return providerStatus.providers.find(provider => provider && provider.provider === 'gitnexus') || {};
  }
  if (Array.isArray(providerStatus.results)) {
    return providerStatus.results.find(provider => provider && provider.provider === 'gitnexus') || {};
  }
  return {};
}

function buildBootstrapGitNexusRef({ setupRef, gitnexusStatus, providerStatusPath, graphFactsPath }) {
  return {
    ...(setupRef || {}),
    configured: gitnexusStatus.configured == null ? (setupRef && setupRef.configured) || false : Boolean(gitnexusStatus.configured),
    graph_ready: gitnexusStatus.graph_ready == null ? null : Boolean(gitnexusStatus.graph_ready),
    query_ready: gitnexusStatus.query_ready == null ? (setupRef ? setupRef.query_ready : null) : Boolean(gitnexusStatus.query_ready),
    status: gitnexusStatus.status || null,
    status_path: toPosixPath(providerStatusPath),
    graph_facts_path: toPosixPath(graphFactsPath),
    repo_label_resolution_path: `${toPosixPath(providerStatusPath)}#repo_label_resolution`,
    reason_code: gitnexusStatus.reason_code || (setupRef && setupRef.reason_code) || null,
  };
}

function computeSetupLayerStaleness({ setup, currentRevision, graphBootstrapSummary }) {
  const reasons = [];
  const setupRevision = setup && setup.freshness
    ? setup.freshness.source_revision
    : null;
  if (setupRevision && currentRevision && setupRevision !== currentRevision) {
    reasons.push({
      reason_code: 'setup-source-revision-mismatch',
      setup_source_revision: setupRevision,
      bootstrap_source_revision: currentRevision,
    });
  }

  const currentChildRevisions = collectSummaryChildRevisions(graphBootstrapSummary);
  const childRepos = setup && setup.topology && Array.isArray(setup.topology.child_repos)
    ? setup.topology.child_repos
    : [];
  for (const child of childRepos) {
    const key = child.workspace_relative_path || child.repo_label || child.git_root;
    if (!key || !child.head || !currentChildRevisions.has(key)) continue;
    const current = currentChildRevisions.get(key);
    if (current && current !== child.head) {
      reasons.push({
        reason_code: 'setup-child-revision-mismatch',
        workspace_relative_path: child.workspace_relative_path || null,
        repo_label: child.repo_label || null,
        setup_source_revision: child.head,
        bootstrap_source_revision: current,
      });
    }
  }
  return {
    stale: reasons.length > 0,
    reasons,
  };
}

function collectSummaryChildRevisions(summary) {
  const revisions = new Map();
  const rows = summary && Array.isArray(summary.results) ? summary.results : [];
  for (const row of rows) {
    const revision = childRevisionFromSummaryRow(row);
    if (!revision) continue;
    for (const key of [row.workspace_relative_path, row.repo_label]) {
      if (key) revisions.set(key, revision);
    }
  }
  return revisions;
}

function childRevisionFromSummaryRow(row) {
  const providers = row && row.result && Array.isArray(row.result.results)
    ? row.result.results
    : [];
  for (const provider of providers) {
    if (provider && provider.repo_snapshot && provider.repo_snapshot.source_revision) {
      return provider.repo_snapshot.source_revision;
    }
  }
  return row && row.result ? row.result.source_revision || null : null;
}

function deriveDirtyChildCount({ setup, graphFacts, graphBootstrapSummary }) {
  const qualitySignals = graphBootstrapSummary && graphBootstrapSummary.quality_signals
    ? graphBootstrapSummary.quality_signals
    : null;
  if (qualitySignals && Number.isFinite(Number(qualitySignals.child_count)) && Number.isFinite(Number(qualitySignals.dirty_advisory_child_rate))) {
    return Math.round(Number(qualitySignals.child_count) * Number(qualitySignals.dirty_advisory_child_rate));
  }
  if (setup && setup.worktree && Number.isFinite(Number(setup.worktree.dirty_child_count))) {
    return Number(setup.worktree.dirty_child_count);
  }
  return graphFacts && graphFacts.source_revision_dirty ? 1 : 0;
}

function toWorkspaceRelative(workspaceRoot, filePath) {
  const absoluteRoot = path.resolve(workspaceRoot);
  const absolutePath = path.resolve(filePath);
  if (!isSubpath(toPosixPath(absoluteRoot), toPosixPath(absolutePath))) {
    return toPosixPath(absolutePath);
  }
  const relative = path.relative(absoluteRoot, absolutePath);
  return toPosixPath(relative || '.');
}

function atomicWriteJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tmp, filePath);
}

function writeJson(stream, payload) {
  stream.write(`${JSON.stringify(payload, null, 2)}\n`);
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

function reasonError(reasonCode, message) {
  const error = new Error(message);
  error.reason_code = reasonCode;
  return error;
}

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isSubpath(root, candidate) {
  const normalizedRoot = toPosixPath(root).replace(/\/+$/, '');
  const normalizedCandidate = toPosixPath(candidate).replace(/\/+$/, '');
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function dedupeIndicators(indicators) {
  const seen = new Set();
  const result = [];
  for (const indicator of indicators) {
    const key = `${indicator.artifact_path}|${indicator.field_path}|${indicator.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(indicator);
  }
  return result;
}

if (require.main === module) {
  process.exitCode = runScenarioFingerprint(process.argv.slice(2));
}

module.exports = {
  BOOTSTRAP_SCHEMA_VERSION,
  PROVISIONAL_SCENARIO_CLASSES,
  PENDING_BUILD_TARGET_SCAN_REASON,
  SETUP_SCHEMA_VERSION,
  classifyState,
  computeBootstrapLayer,
  computeSetupLayer,
  runScenarioFingerprint,
  toPosixPath,
};
