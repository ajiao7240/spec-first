'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { evaluateContextForRepo } = require('./evaluator');

function resolveWorkspaceSlug(repoRoot) {
  if (typeof repoRoot !== 'string') return '';
  const normalized = repoRoot.replace(/[\\/]+$/, '');
  if (!normalized) return '';
  return path.win32.basename(normalized);
}

function loadWorkspaceContext({ repoRoots = [], stage = 'plan' } = {}) {
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

module.exports = {
  loadWorkspaceContext,
  resolveWorkspaceSlug,
};
