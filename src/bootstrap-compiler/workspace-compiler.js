'use strict';

const path = require('node:path');
const { evaluateContextForRepo } = require('../context-routing/evaluator');
const { loadBootstrapRuntimeState } = require('../context-routing/loader');
const { loadWorkspaceContext } = require('../context-routing/workspace-loader');
const {
  normalizeAbsolutePath,
  resolveStage0Entry,
} = require('../context-routing/entry-resolver');
const {
  buildSelectedContextsFromAssets,
  buildSelectionSubject,
} = require('../context-routing/selection-context');
const { matchTopologyUnitsForFiles } = require('./topology');
const {
  buildRuntimeVerificationBundleForRepo,
  mergeVerificationSummaries,
  mergeVerifierDispatches,
} = require('../context-routing/verification-summary');
const { buildVerificationGateState } = require('../context-routing/verification-gate-state');
const {
  loadVerificationEvidence,
  mergeVerificationEvidence,
} = require('../context-routing/verification-evidence');
const { loadAiDevQualityGateResult } = require('../context-routing/quality-gate-result');

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeChangedFilePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function summarizeExplicitWorkspaceStatus(repos = []) {
  const healthyRepos = repos.filter((repo) => repo && repo.evaluation);
  if (healthyRepos.length === 0) {
    return {
      level: 'L2',
      fallback_reason: 'workspace_children_unavailable',
    };
  }
  if (healthyRepos.length < repos.length) {
    return {
      level: 'L1',
      fallback_reason: 'workspace_child_partial_degraded',
    };
  }
  return {
    level: 'L0',
    fallback_reason: null,
  };
}

function resolveArtifactAnchorRootForRepo(entry, repoRoot) {
  if (!entry || !repoRoot) return repoRoot || null;
  if (entry.mode === 'workspace-registered') {
    return entry.artifactAnchorRoot || repoRoot;
  }
  return repoRoot;
}

function selectEffectiveDispatches(verificationBundles = []) {
  const availableBundles = verificationBundles.filter(Boolean);
  if (availableBundles.length === 0) return [];

  const hasChangeSurface = availableBundles.some((bundle) =>
    bundle.verificationSummary && bundle.verificationSummary.source === 'change-surface'
  );

  if (!hasChangeSurface) {
    return availableBundles.map((bundle) => bundle.verifierDispatch);
  }

  return availableBundles
    .filter((bundle) => bundle.verificationSummary && bundle.verificationSummary.source === 'change-surface')
    .map((bundle) => bundle.verifierDispatch);
}

function compileWorkspaceContext({
  repoRoots = [],
  stage = 'plan',
  cwd,
  target,
  changedFiles = [],
} = {}) {
  const entry = resolveStage0Entry({ cwd, target, repoRoots, changedFiles, stage });

  if (entry.mode === 'single-repo') {
    const singleRepo = evaluateContextForRepo({
      repoRoot: entry.repoRoots[0],
      slug: entry.workspaceSlug,
      stage,
      artifactAnchorRoot: entry.artifactAnchorRoot,
    });
    const verificationBundle = buildRuntimeVerificationBundleForRepo({
      repoRoot: entry.repoRoots[0],
      slug: entry.workspaceSlug,
      stage,
      changedFiles,
      artifactAnchorRoot: entry.artifactAnchorRoot,
    });
    const verificationSummary = verificationBundle.verificationSummary;
    const verifierDispatch = verificationBundle.verifierDispatch;
    const aiDevQualityGateResult = loadAiDevQualityGateResult({
      repoRoot: entry.repoRoots[0],
      artifactAnchorRoot: entry.artifactAnchorRoot,
    });
    const verificationEvidence = loadVerificationEvidence({
      repoRoot: entry.repoRoots[0],
      slug: entry.workspaceSlug,
      stage,
      verificationSummary,
      artifactAnchorRoot: entry.artifactAnchorRoot,
    });
    const verificationGateState = buildVerificationGateState({
      stage,
      verificationSummary,
      verifierDispatch,
      verificationEvidence,
    });
    const repoSelection = buildRepoSelectionContext({
      repoRoot: entry.repoRoots[0],
      slug: entry.workspaceSlug,
      stage,
      changedFiles,
      matchReason: 'cwd',
      artifactAnchorRoot: entry.artifactAnchorRoot,
      selectedAssets: singleRepo.selected_assets,
    });
    return {
      schema_version: 'v1',
      stage,
      mode: 'single-repo',
      repo_count: 1,
      repos: [{ repo_root: entry.repoRoots[0], slug: entry.workspaceSlug, evaluation: singleRepo }],
      selection_subject: repoSelection.selectionSubject,
      selected_contexts: repoSelection.selectedContexts,
      selected_assets: singleRepo.selected_assets,
      verification_summary: verificationSummary,
      verifier_dispatch: verifierDispatch,
      ai_dev_quality_gate_result: aiDevQualityGateResult,
      verification_evidence: verificationEvidence,
      verification_gate_state: verificationGateState,
    };
  }

  const repos = loadWorkspaceContext({ repoRoots, stage, cwd, target, changedFiles });
  if (shouldCollapseToSingleRepo({ entry, repoRoots, repos })) {
    const singleRepo = evaluateContextForRepo({
      repoRoot: repoRoots[0],
      slug: repos[0].slug,
      stage,
      artifactAnchorRoot: resolveArtifactAnchorRootForRepo(entry, repoRoots[0]),
    });
    const verificationBundle = buildRuntimeVerificationBundleForRepo({
      repoRoot: repoRoots[0],
      slug: repos[0].slug,
      stage,
      changedFiles,
      artifactAnchorRoot: resolveArtifactAnchorRootForRepo(entry, repoRoots[0]),
    });
    const verificationSummary = verificationBundle.verificationSummary;
    const verifierDispatch = verificationBundle.verifierDispatch;
    const aiDevQualityGateResult = loadAiDevQualityGateResult({
      repoRoot: repoRoots[0],
      artifactAnchorRoot: resolveArtifactAnchorRootForRepo(entry, repoRoots[0]),
    });
    const verificationEvidence = loadVerificationEvidence({
      repoRoot: repoRoots[0],
      slug: repos[0].slug,
      stage,
      verificationSummary,
      artifactAnchorRoot: resolveArtifactAnchorRootForRepo(entry, repoRoots[0]),
    });
    const verificationGateState = buildVerificationGateState({
      stage,
      verificationSummary,
      verifierDispatch,
      verificationEvidence,
    });
    const repoSelection = buildRepoSelectionContext({
      repoRoot: repoRoots[0],
      slug: repos[0].slug,
      stage,
      changedFiles,
      matchReason: 'repoRoots',
      artifactAnchorRoot: resolveArtifactAnchorRootForRepo(entry, repoRoots[0]),
      selectedAssets: singleRepo.selected_assets,
    });
    return {
      schema_version: 'v1',
      stage,
      mode: 'single-repo',
      repo_count: 1,
      repos,
      selection_subject: repoSelection.selectionSubject,
      selected_contexts: repoSelection.selectedContexts,
      selected_assets: singleRepo.selected_assets,
      verification_summary: verificationSummary,
      verifier_dispatch: verifierDispatch,
      ai_dev_quality_gate_result: aiDevQualityGateResult,
      verification_evidence: verificationEvidence,
      verification_gate_state: verificationGateState,
    };
  }

  if (repos.length === 1 && repos[0].evaluation && repos[0].evaluation.mode === 'workspace') {
    const evaluation = repos[0].evaluation;
    const selectedChildren = (repos[0].children || []).filter((child) => child.status === 'selected');
    const verificationBundles = selectedChildren.map((child) =>
      buildRuntimeVerificationBundleForRepo({
        repoRoot: child.repo_root,
        slug: child.slug,
        stage,
        changedFiles,
        artifactAnchorRoot: entry.artifactAnchorRoot,
        workspaceRoot: entry.workspaceRoot,
        childRelativePath: entry.workspace
          && entry.workspace.registry
          && Array.isArray(entry.workspace.registry.children)
          ? entry.workspace.registry.children.find((item) => item.childSlug === child.slug)?.relativePath || null
          : null,
      })
    );
    const verificationSummary = mergeVerificationSummaries(
      stage,
      verificationBundles.map((item) => item.verificationSummary)
    );
    const verificationEvidence = mergeVerificationEvidence(selectedChildren.map((child, index) =>
      loadVerificationEvidence({
        repoRoot: child.repo_root,
        slug: child.slug,
        stage,
        verificationSummary: verificationBundles[index].verificationSummary,
        artifactAnchorRoot: entry.artifactAnchorRoot,
      })
    ));
    const verifierDispatch = mergeVerifierDispatches(
      stage,
      selectEffectiveDispatches(verificationBundles)
    );
    const verificationGateState = buildVerificationGateState({
      stage,
      verificationSummary,
      verifierDispatch,
      verificationEvidence,
    });
    const workspaceSelection = deriveWorkspaceSelectionContext({
      entry,
      evaluation,
      selectedChildren,
      stage,
      changedFiles,
    });
    return {
      schema_version: 'v2',
      stage,
      mode: 'workspace',
      workspace_slug: evaluation.workspace_slug,
      repo_count: Array.isArray(repos[0].children) ? repos[0].children.length : 0,
      repos,
      matched_child_slugs: evaluation.matched_child_slugs,
      selection_subject: workspaceSelection.selectionSubject,
      selected_contexts: workspaceSelection.selectedContexts,
      selected_assets: evaluation.selected_assets,
      fallback_reason: evaluation.fallback_reason,
      level: evaluation.level,
      verification_summary: verificationSummary,
      verifier_dispatch: verifierDispatch,
      ai_dev_quality_gate_result: null,
      verification_evidence: verificationEvidence,
      verification_gate_state: verificationGateState,
    };
  }

  const selectedAssets = [];
  const selectedContexts = [];
  const verificationBundles = [];
  for (const repo of repos) {
    if (!repo.evaluation) continue;
    const repoSelectedContexts = buildSelectedContextsFromAssets({
      scope: 'repo',
      slug: repo.slug,
      repoRoot: repo.repo_root,
      selectedAssets: repo.evaluation.selected_assets,
      reason: 'repoRoots',
      startPriority: 100,
    });
    selectedContexts.push(...repoSelectedContexts);
    for (const assetPath of repo.evaluation.selected_assets) {
      selectedAssets.push(`${repo.slug}:${assetPath}`);
    }
    verificationBundles.push(buildRuntimeVerificationBundleForRepo({
      repoRoot: repo.repo_root,
      slug: repo.slug,
      stage,
      changedFiles,
      artifactAnchorRoot: resolveArtifactAnchorRootForRepo(entry, repo.repo_root),
      workspaceRoot: entry.workspaceRoot,
      childRelativePath: repo.repo_root && entry.workspaceRoot
        ? require('node:path').relative(entry.workspaceRoot, repo.repo_root)
        : null,
    }));
  }
  const verificationSummary = mergeVerificationSummaries(
    stage,
    verificationBundles.map((item) => item.verificationSummary)
  );
  const verificationEvidence = mergeVerificationEvidence(repos
    .filter((repo) => repo.evaluation)
    .map((repo, index) =>
      loadVerificationEvidence({
        repoRoot: repo.repo_root,
        slug: repo.slug,
        stage,
        verificationSummary: verificationBundles[index].verificationSummary,
        artifactAnchorRoot: resolveArtifactAnchorRootForRepo(entry, repo.repo_root),
      })
    ));
  const verifierDispatch = mergeVerifierDispatches(
    stage,
    selectEffectiveDispatches(verificationBundles)
  );
  const verificationGateState = buildVerificationGateState({
    stage,
    verificationSummary,
    verifierDispatch,
    verificationEvidence,
  });
  const workspaceStatus = summarizeExplicitWorkspaceStatus(repos);
  return {
    schema_version: 'v1',
    stage,
    mode: 'workspace',
    workspace_slug: entry.workspaceSlug || null,
    repo_count: repos.length,
    repos,
    matched_child_slugs: entry.matchedChildSlugs || [],
    selection_subject: buildSelectionSubject({
      kind: 'repo',
      ownerSlug: entry.workspaceSlug || null,
      subjectSlug: repos[0] ? repos[0].slug : null,
      targetPath: repos[0] && entry.workspaceRoot
        ? normalizeRelativePath(entry.workspaceRoot, repos[0].repo_root)
        : null,
      matchReason: entry.matchReason || 'repoRoots',
      provenance: entry.mode === 'workspace-explicit' ? 'workspace-explicit' : 'workspace-routing',
    }),
    selected_contexts: selectedContexts,
    selected_assets: selectedAssets,
    fallback_reason: workspaceStatus.fallback_reason,
    level: workspaceStatus.level,
    verification_summary: verificationSummary,
    verifier_dispatch: verifierDispatch,
    ai_dev_quality_gate_result: null,
    verification_evidence: verificationEvidence,
    verification_gate_state: verificationGateState,
  };
}

function normalizeRelativePath(rootPath, absolutePath) {
  if (!rootPath || !absolutePath) return null;
  const relativePath = path.relative(rootPath, absolutePath);
  if (!relativePath || relativePath === '') return '.';
  return relativePath.replace(/\\/g, '/');
}

function repoRelativeChangedFiles({
  changedFiles = [],
  repoRoot,
  workspaceRoot = null,
  childRelativePath = null,
} = {}) {
  const normalizedRepoRoot = normalizeAbsolutePath(repoRoot);
  const normalizedChildPrefix = childRelativePath
    ? normalizeChangedFilePath(childRelativePath).replace(/\/+$/g, '')
    : null;

  return unique((changedFiles || []).map((filePath) => {
    if (typeof filePath !== 'string' || filePath.trim() === '') return null;

    if (path.isAbsolute(filePath)) {
      const absolutePath = normalizeAbsolutePath(filePath);
      if (
        normalizedRepoRoot
        && absolutePath
        && (absolutePath === normalizedRepoRoot || absolutePath.startsWith(`${normalizedRepoRoot}${path.sep}`))
      ) {
        return normalizeChangedFilePath(path.relative(normalizedRepoRoot, absolutePath));
      }
      return null;
    }

    const normalized = normalizeChangedFilePath(filePath);
    if (!normalized) return null;

    if (
      workspaceRoot
      && normalizedChildPrefix
      && (normalized === normalizedChildPrefix || normalized.startsWith(`${normalizedChildPrefix}/`))
    ) {
      const sliced = normalized.slice(normalizedChildPrefix.length).replace(/^\/+/, '');
      return sliced || null;
    }

    return normalized;
  }));
}

function shouldCollapseToSingleRepo({ entry, repoRoots = [], repos = [] } = {}) {
  if (entry.mode === 'workspace-registered') return false;
  if (repoRoots.length !== 1 || !repos[0] || !repos[0].evaluation) return false;

  const normalizedWorkspaceRoot = normalizeAbsolutePath(entry.workspaceRoot);
  const normalizedRepoRoot = normalizeAbsolutePath(repoRoots[0]);
  return Boolean(normalizedWorkspaceRoot && normalizedRepoRoot && normalizedWorkspaceRoot === normalizedRepoRoot);
}

function buildRepoSelectionContext({
  repoRoot,
  slug,
  changedFiles = [],
  matchReason,
  artifactAnchorRoot = repoRoot,
  selectedAssets = [],
} = {}) {
  const runtimeState = loadBootstrapRuntimeState({ repoRoot, slug, artifactAnchorRoot });
  const topology = runtimeState && runtimeState.factInventory ? runtimeState.factInventory.topology : null;
  const matchedUnits = matchTopologyUnitsForFiles(topology, changedFiles);
  if (topology && topology.kind === 'monorepo_multi_module' && matchedUnits.length === 1) {
    const moduleUnit = (topology.units || []).find((item) => item.id === matchedUnits[0]);
    const effectiveMatchReason = changedFiles.length > 0 ? 'changedFiles' : matchReason;
    return {
      selectionSubject: buildSelectionSubject({
        kind: 'module',
        ownerSlug: slug,
        subjectSlug: slug,
        unitId: moduleUnit ? moduleUnit.id : matchedUnits[0],
        targetPath: moduleUnit ? moduleUnit.path : matchedUnits[0],
        matchReason: effectiveMatchReason,
        provenance: 'topology.units',
      }),
      selectedContexts: buildSelectedContextsFromAssets({
        scope: 'module',
        slug,
        repoRoot,
        unitId: moduleUnit ? moduleUnit.id : matchedUnits[0],
        selectedAssets,
        reason: 'stage-default',
        startPriority: 100,
      }),
    };
  }

  return {
    selectionSubject: buildSelectionSubject({
      kind: 'project',
      ownerSlug: slug,
      subjectSlug: slug,
      targetPath: '.',
      matchReason,
      provenance: 'single-repo-default',
    }),
    selectedContexts: buildSelectedContextsFromAssets({
      scope: 'project',
      slug,
      repoRoot,
      selectedAssets,
      reason: 'stage-default',
      startPriority: 100,
    }),
  };
}

function deriveWorkspaceSelectionContext({
  entry,
  evaluation,
  selectedChildren = [],
  stage,
  changedFiles = [],
} = {}) {
  const defaultSelection = {
    selectionSubject: evaluation.selection_subject || null,
    selectedContexts: Array.isArray(evaluation.selected_contexts) ? evaluation.selected_contexts : [],
  };

  if (selectedChildren.length !== 1) return defaultSelection;

  const selectedChild = selectedChildren[0];
  const childRecord = entry.workspace
    && entry.workspace.registry
    && Array.isArray(entry.workspace.registry.children)
    ? entry.workspace.registry.children.find((item) => item.childSlug === selectedChild.slug)
    : null;
  const childEvaluation = evaluateContextForRepo({
    repoRoot: selectedChild.repo_root,
    slug: selectedChild.slug,
    stage,
    artifactAnchorRoot: entry.artifactAnchorRoot,
  });
  const repoSelection = buildRepoSelectionContext({
    repoRoot: selectedChild.repo_root,
    slug: selectedChild.slug,
    changedFiles: repoRelativeChangedFiles({
      changedFiles,
      repoRoot: selectedChild.repo_root,
      workspaceRoot: entry.workspaceRoot,
      childRelativePath: childRecord ? childRecord.relativePath : null,
    }),
    matchReason: entry.matchReason || 'default',
    artifactAnchorRoot: entry.artifactAnchorRoot,
    selectedAssets: childEvaluation.selected_assets,
  });

  if (!repoSelection.selectionSubject || repoSelection.selectionSubject.kind !== 'module') {
    return defaultSelection;
  }

  const workspaceContexts = defaultSelection.selectedContexts.filter((item) => item.scope === 'workspace');
  return {
    selectionSubject: repoSelection.selectionSubject,
    selectedContexts: [...workspaceContexts, ...repoSelection.selectedContexts],
  };
}

module.exports = {
  compileWorkspaceContext,
};
