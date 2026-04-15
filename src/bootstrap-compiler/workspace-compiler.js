'use strict';

const { evaluateContextForRepo } = require('../context-routing/evaluator');
const { loadWorkspaceContext } = require('../context-routing/workspace-loader');

function compileWorkspaceContext({ repoRoots = [], stage = 'plan' } = {}) {
  const repos = loadWorkspaceContext({ repoRoots, stage });
  if (repoRoots.length === 1 && repos[0] && repos[0].evaluation) {
    const singleRepo = evaluateContextForRepo({
      repoRoot: repoRoots[0],
      slug: repos[0].slug,
      stage,
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
