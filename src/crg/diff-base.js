'use strict';

const { execFileSync } = require('node:child_process');

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function resolveHead(repoRoot) {
  try {
    return git(repoRoot, ['rev-parse', 'HEAD']);
  } catch (_) {
    return null;
  }
}

function resolveAutoBase(repoRoot) {
  try {
    const defaultBranch = git(repoRoot, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
      .replace(/^refs\/remotes\/origin\//, '');
    return git(repoRoot, ['merge-base', `origin/${defaultBranch}`, 'HEAD']);
  } catch (_) {
    try {
      return git(repoRoot, ['merge-base', 'origin/main', 'HEAD']);
    } catch (__) {
      return null;
    }
  }
}

function resolveDiffBase(repoRoot, options = {}) {
  if (options.since) {
    return {
      base: options.since,
      source: 'explicit-since',
      limitation: null,
    };
  }
  if (options.workStartRef) {
    return {
      base: options.workStartRef,
      source: 'work-start-ref',
      limitation: null,
    };
  }
  if (options.autoBase) {
    const base = resolveAutoBase(repoRoot);
    if (base) {
      return { base, source: 'auto-merge-base', limitation: null };
    }
  }
  return {
    base: null,
    source: 'unresolved',
    limitation: {
      code: 'diff-base-unresolved',
      message: 'Could not resolve a diff base; use --since, --work-run, --work-start-ref, or --auto-base.',
    },
  };
}

module.exports = {
  resolveAutoBase,
  resolveDiffBase,
  resolveHead,
};
