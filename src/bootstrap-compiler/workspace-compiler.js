'use strict';

const { evaluateContextForRepo } = require('../context-routing/evaluator');
const { loadWorkspaceContext } = require('../context-routing/workspace-loader');
const { resolveStage0Entry } = require('../context-routing/entry-resolver');

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
    return {
      schema_version: 'v1',
      stage,
      mode: 'single-repo',
      repo_count: 1,
      repos: [{ repo_root: entry.repoRoots[0], slug: entry.workspaceSlug, evaluation: singleRepo }],
      selected_assets: singleRepo.selected_assets,
    };
  }

  const repos = loadWorkspaceContext({ repoRoots, stage, cwd, target, changedFiles });
  if (repoRoots.length === 1 && repos[0] && repos[0].evaluation) {
    const singleRepo = evaluateContextForRepo({
      repoRoot: repoRoots[0],
      slug: repos[0].slug,
      stage,
      artifactAnchorRoot: entry.artifactAnchorRoot,
    });
    return {
      schema_version: 'v1',
      stage,
      mode: 'single-repo',
      repo_count: 1,
      repos,
      selected_assets: singleRepo.selected_assets,
    };
  }

  if (repos.length === 1 && repos[0].evaluation && repos[0].evaluation.mode === 'workspace') {
    const evaluation = repos[0].evaluation;
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
    };
  }

  const selectedAssets = [];
  for (const repo of repos) {
    if (!repo.evaluation) continue;
    for (const assetPath of repo.evaluation.selected_assets) {
      selectedAssets.push(`${repo.slug}:${assetPath}`);
    }
  }
  return {
    schema_version: 'v1',
    stage,
    mode: 'workspace',
    repo_count: repos.length,
    repos,
    selected_assets: selectedAssets,
  };
}

module.exports = {
  compileWorkspaceContext,
};
