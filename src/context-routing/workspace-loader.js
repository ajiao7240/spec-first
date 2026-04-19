'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { evaluateContextForRepo } = require('./evaluator');
const {
  WORKSPACE_MATCH_SIGNAL_PRIORITY,
  loadChildRuntimeStates,
  resolveStage0Entry,
} = require('./entry-resolver');
const {
  buildSelectionSubject,
  toSelectedContext,
} = require('./selection-context');

function resolveWorkspaceSlug(repoRoot) {
  if (typeof repoRoot !== 'string') return '';
  const normalized = repoRoot.replace(/[\\/]+$/, '');
  if (!normalized) return '';
  return path.win32.basename(normalized);
}

function resolveWorkspaceFallback({ entry, workspaceOverviewAssets = [] }) {
  const hasOverview = workspaceOverviewAssets.length > 0;
  if (
    entry.fallbackReason === 'workspace_registry_invalid' ||
    entry.fallbackReason === 'workspace_registry_schema_unsupported'
  ) {
    return {
      level: hasOverview ? 'L2' : 'L3',
      fallback_reason: entry.fallbackReason,
    };
  }
  if (
    entry.fallbackReason === 'workspace_routing_missing' ||
    entry.fallbackReason === 'workspace_routing_schema_unsupported'
  ) {
    return {
      level: 'L2',
      fallback_reason: entry.fallbackReason,
    };
  }
  return {
    level: hasOverview ? 'L1' : 'L3',
    fallback_reason: entry.fallbackReason || 'workspace_child_unresolved',
  };
}

function projectSelectedAssets(selectedContexts) {
  return selectedContexts.map((item) => `${item.slug}:${item.asset_path}`);
}

function loadWorkspaceContext({
  repoRoots = [],
  stage = 'plan',
  cwd,
  target,
  changedFiles = [],
} = {}) {
  const entry = resolveStage0Entry({ cwd, target, repoRoots, changedFiles, stage });

  if (repoRoots.length > 0 && entry.mode !== 'workspace-registered') {
    return repoRoots.map((repoRoot) => {
      const slug = resolveWorkspaceSlug(repoRoot);
      try {
        if (!fs.existsSync(repoRoot)) {
          return {
            repo_root: repoRoot,
            slug,
            status: 'degraded',
            error: 'repo_missing',
          };
        }
        const evaluation = evaluateContextForRepo({ repoRoot, slug, stage });
        return {
          repo_root: repoRoot,
          slug,
          status: evaluation.level === 'L0' ? 'ok' : 'degraded',
          evaluation,
        };
      } catch (error) {
        return {
          repo_root: repoRoot,
          slug,
          status: 'degraded',
          error: error.message,
        };
      }
    });
  }
  if (entry.mode !== 'workspace-registered' || !entry.workspace) {
    return [];
  }

  const workspaceRouting = entry.workspace.routing || {};
  const workspaceOverviewAssets = Array.isArray(workspaceRouting.workspaceOverviewAssets)
    ? workspaceRouting.workspaceOverviewAssets
    : [];
  const selectedContexts = workspaceOverviewAssets.map((assetPath, index) =>
    toSelectedContext({
      scope: 'workspace',
      slug: entry.workspaceSlug,
      assetPath,
      reason: 'workspace-overview-default',
      priority: 10 + index,
    })
  );

  if (entry.fallbackReason) {
    const fallback = resolveWorkspaceFallback({ entry, workspaceOverviewAssets });
    return [{
      scope: 'workspace',
      workspace_root: entry.workspaceRoot,
      slug: entry.workspaceSlug,
      status: fallback.level === 'L3' ? 'degraded' : 'partial',
      evaluation: {
        schema_version: 'v2',
        mode: 'workspace',
        stage,
        workspace_slug: entry.workspaceSlug,
        workspace_root: entry.workspaceRoot,
        child_match_signal_priority: WORKSPACE_MATCH_SIGNAL_PRIORITY,
        matched_child_slugs: [],
        selected_contexts: selectedContexts,
        selection_subject: buildSelectionSubject({
          kind: 'workspace',
          ownerSlug: entry.workspaceSlug,
          subjectSlug: entry.workspaceSlug,
          targetPath: '.',
          matchReason: entry.matchReason || 'default',
          provenance: 'workspace-routing',
        }),
        selected_assets: projectSelectedAssets(selectedContexts),
        selected_context_count: selectedContexts.length,
        level: fallback.level,
        fallback_reason: fallback.fallback_reason,
        skipped_rules: [],
        freshness_status: 'unknown',
      },
    }];
  }

  if (entry.matchedChildSlugs.length === 0) {
    return [{
      scope: 'workspace',
      workspace_root: entry.workspaceRoot,
      slug: entry.workspaceSlug,
      status: 'degraded',
      evaluation: {
        schema_version: 'v2',
        mode: 'workspace',
        stage,
        workspace_slug: entry.workspaceSlug,
        workspace_root: entry.workspaceRoot,
        child_match_signal_priority: WORKSPACE_MATCH_SIGNAL_PRIORITY,
        matched_child_slugs: [],
        selected_contexts: selectedContexts,
        selection_subject: buildSelectionSubject({
          kind: 'workspace',
          ownerSlug: entry.workspaceSlug,
          subjectSlug: entry.workspaceSlug,
          targetPath: '.',
          matchReason: entry.matchReason || 'default',
          provenance: 'workspace-routing',
        }),
        selected_assets: projectSelectedAssets(selectedContexts),
        selected_context_count: selectedContexts.length,
        level: 'L1',
        fallback_reason: 'workspace_child_unresolved',
        skipped_rules: [],
        freshness_status: 'unknown',
      },
      children: entry.workspace.registry.children.map((child) => ({
        repo_root: child.repoRoot,
        slug: child.childSlug,
        status: 'idle',
      })),
    }];
  }

  const childStates = loadChildRuntimeStates({
    workspaceRoot: entry.workspaceRoot,
    matchedChildSlugs: entry.matchedChildSlugs,
    registry: entry.workspace.registry,
  });

  let hasDegradedChild = false;
  let freshnessStatus = 'unknown';
  let sawFreshChild = false;
  for (const { child, state } of childStates) {
    const evaluation = evaluateContextForRepo({
      repoRoot: child.repoRoot,
      slug: child.childSlug,
      stage,
      artifactAnchorRoot: entry.workspaceRoot,
    });

    if (evaluation.level !== 'L0') hasDegradedChild = true;
    // freshness 聚合与 buildWorkspaceBootstrapTelemetryEvaluation 保持一致：
    //   任一 stale → 全局 stale
    //   非 stale 且至少一个 healthy → 全局 healthy
    //   其余 → unknown
    if (evaluation.freshness_status === 'stale') {
      freshnessStatus = 'stale';
    } else if (evaluation.freshness_status === 'healthy' && freshnessStatus !== 'stale') {
      sawFreshChild = true;
    }

    for (const [index, assetPath] of evaluation.selected_assets.entries()) {
      selectedContexts.push(toSelectedContext({
        scope: 'repo',
        slug: child.childSlug,
        repoRoot: child.repoRoot,
        assetPath,
        reason: entry.matchReason || 'repoRoots',
        priority: 100 + index,
      }));
    }
  }

  if (freshnessStatus !== 'stale' && sawFreshChild) {
    freshnessStatus = 'healthy';
  }

  let fallbackReason = null;
  let level = 'L0';
  if (childStates.length === 0) {
    level = 'L2';
    fallbackReason = 'workspace_children_unavailable';
  } else if (hasDegradedChild) {
    level = 'L1';
    fallbackReason = 'workspace_child_partial_degraded';
  } else if (freshnessStatus === 'stale') {
    fallbackReason = 'freshness_stale';
  }

  return [{
    scope: 'workspace',
    workspace_root: entry.workspaceRoot,
    slug: entry.workspaceSlug,
    status: level === 'L0' ? 'ok' : 'degraded',
    evaluation: {
      schema_version: 'v2',
      mode: 'workspace',
      stage,
      workspace_slug: entry.workspaceSlug,
      workspace_root: entry.workspaceRoot,
      child_match_signal_priority: WORKSPACE_MATCH_SIGNAL_PRIORITY,
      matched_child_slugs: entry.matchedChildSlugs,
      selected_contexts: selectedContexts,
      selection_subject: buildSelectionSubject({
        kind: 'repo',
        ownerSlug: entry.workspaceSlug,
        subjectSlug: entry.matchedChildSlugs[0] || null,
        targetPath: entry.workspace && entry.workspace.registry && Array.isArray(entry.workspace.registry.children)
          ? (() => {
            const matchedChild = entry.workspace.registry.children.find((child) => child.childSlug === entry.matchedChildSlugs[0]);
            return matchedChild ? matchedChild.relativePath : null;
          })()
          : null,
        matchReason: entry.matchReason || 'default',
        provenance: 'workspace-routing',
      }),
      selected_assets: projectSelectedAssets(selectedContexts),
      selected_context_count: selectedContexts.length,
      level,
      fallback_reason: fallbackReason,
      skipped_rules: [],
      freshness_status: freshnessStatus,
    },
    children: childStates.map(({ child }) => ({
      repo_root: child.repoRoot,
      slug: child.childSlug,
      status: entry.matchedChildSlugs.includes(child.childSlug) ? 'selected' : 'idle',
    })),
  }];
}

module.exports = {
  loadWorkspaceContext,
  resolveWorkspaceSlug,
};
