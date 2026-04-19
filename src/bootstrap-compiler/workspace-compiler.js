'use strict';

const { evaluateContextForRepo } = require('../context-routing/evaluator');
const { loadWorkspaceContext } = require('../context-routing/workspace-loader');
const { resolveStage0Entry } = require('../context-routing/entry-resolver');
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
    return {
      schema_version: 'v1',
      stage,
      mode: 'single-repo',
      repo_count: 1,
      repos: [{ repo_root: entry.repoRoots[0], slug: entry.workspaceSlug, evaluation: singleRepo }],
      selected_assets: singleRepo.selected_assets,
      verification_summary: verificationSummary,
      verifier_dispatch: verifierDispatch,
      ai_dev_quality_gate_result: aiDevQualityGateResult,
      verification_evidence: verificationEvidence,
      verification_gate_state: verificationGateState,
    };
  }

  const repos = loadWorkspaceContext({ repoRoots, stage, cwd, target, changedFiles });
  if (entry.mode !== 'workspace-registered' && repoRoots.length === 1 && repos[0] && repos[0].evaluation) {
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
    return {
      schema_version: 'v1',
      stage,
      mode: 'single-repo',
      repo_count: 1,
      repos,
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
    return {
      schema_version: 'v2',
      stage,
      mode: 'workspace',
      workspace_slug: evaluation.workspace_slug,
      repo_count: Array.isArray(repos[0].children) ? repos[0].children.length : 0,
      repos,
      matched_child_slugs: evaluation.matched_child_slugs,
      selected_contexts: evaluation.selected_contexts,
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
  const verificationBundles = [];
  for (const repo of repos) {
    if (!repo.evaluation) continue;
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

module.exports = {
  compileWorkspaceContext,
};
