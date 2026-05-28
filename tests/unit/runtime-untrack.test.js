'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  applyRuntimeUntrack,
  planRuntimeUntrack,
} = require('../../src/cli/runtime-untrack');
const { buildSpecFirstGitignoreBlock } = require('../../src/cli/gitignore-policy');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-runtime-untrack-'));
}

function runGit(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function initRepo(repoRoot) {
  runGit(repoRoot, ['init']);
}

function writeFile(repoRoot, relativePath, contents = 'runtime\n') {
  const absolutePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, 'utf8');
}

function commitAll(repoRoot) {
  runGit(repoRoot, ['add', '.']);
  runGit(repoRoot, [
    '-c',
    'user.email=t@e',
    '-c',
    'user.name=t',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--no-verify',
    '-m',
    'bootstrap',
  ]);
}

function tracked(repoRoot, relativePath) {
  return runGit(repoRoot, ['ls-files', '--', relativePath]).trim();
}

describe('runtime untrack helper', () => {
  test('plans and applies untrack for tracked Codex managed state while preserving worktree file', () => {
    const repoRoot = makeTempDir();

    try {
      initRepo(repoRoot);
      writeFile(repoRoot, '.codex/spec-first/state.json', '{}\n');
      commitAll(repoRoot);

      const plan = planRuntimeUntrack({ projectRoot: repoRoot });
      expect(plan.reason_code).toBe('untracked-runtime');
      expect(plan.operations).toEqual([
        expect.objectContaining({
          kind: 'untrack_index',
          path: '.codex/spec-first/state.json',
        }),
      ]);

      const result = applyRuntimeUntrack({ projectRoot: repoRoot, operations: plan.operations });
      expect(result.applied_count).toBe(1);
      expect(tracked(repoRoot, '.codex/spec-first/state.json')).toBe('');
      expect(fs.existsSync(path.join(repoRoot, '.codex/spec-first/state.json'))).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('reports none-tracked for ignored runtime files that were never added', () => {
    const repoRoot = makeTempDir();

    try {
      initRepo(repoRoot);
      fs.writeFileSync(path.join(repoRoot, '.gitignore'), `${buildSpecFirstGitignoreBlock()}\n`, 'utf8');
      writeFile(repoRoot, '.claude/spec-first/state.json', '{}\n');

      const plan = planRuntimeUntrack({ projectRoot: repoRoot });
      expect(plan.reason_code).toBe('none-tracked');
      expect(plan.operations).toEqual([]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('untracks tracked spec-first session records while preserving worktree file', () => {
    const repoRoot = makeTempDir();

    try {
      initRepo(repoRoot);
      writeFile(repoRoot, '.spec-first/sessions/session-a.json', '{}\n');
      commitAll(repoRoot);

      const plan = planRuntimeUntrack({ projectRoot: repoRoot });
      expect(plan.reason_code).toBe('untracked-runtime');
      expect(plan.operations).toEqual([
        expect.objectContaining({
          kind: 'untrack_index',
          path: '.spec-first/sessions/session-a.json',
        }),
      ]);

      const result = applyRuntimeUntrack({ projectRoot: repoRoot, operations: plan.operations });
      expect(result.applied_count).toBe(1);
      expect(tracked(repoRoot, '.spec-first/sessions/session-a.json')).toBe('');
      expect(fs.existsSync(path.join(repoRoot, '.spec-first/sessions/session-a.json'))).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('untracks tracked Claude session start hook while preserving worktree file', () => {
    const repoRoot = makeTempDir();

    try {
      initRepo(repoRoot);
      writeFile(repoRoot, '.claude/hooks/session-start', '#!/bin/bash\n');
      commitAll(repoRoot);

      const plan = planRuntimeUntrack({ projectRoot: repoRoot });
      expect(plan.reason_code).toBe('untracked-runtime');
      expect(plan.operations).toEqual([
        expect.objectContaining({
          kind: 'untrack_index',
          path: '.claude/hooks/session-start',
        }),
      ]);

      const result = applyRuntimeUntrack({ projectRoot: repoRoot, operations: plan.operations });
      expect(result.applied_count).toBe(1);
      expect(tracked(repoRoot, '.claude/hooks/session-start')).toBe('');
      expect(fs.existsSync(path.join(repoRoot, '.claude/hooks/session-start'))).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('reports not-a-git-repo without side effects', () => {
    const projectRoot = makeTempDir();

    try {
      writeFile(projectRoot, '.codex/spec-first/state.json', '{}\n');
      const plan = planRuntimeUntrack({ projectRoot });

      expect(plan.reason_code).toBe('not-a-git-repo');
      expect(plan.operations).toEqual([]);
      expect(fs.existsSync(path.join(projectRoot, '.codex/spec-first/state.json'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('reports git-binary-missing from injected git runner', () => {
    const projectRoot = makeTempDir();
    const plan = planRuntimeUntrack({
      projectRoot,
      runGit: () => ({
        ok: false,
        reason_code: 'git-binary-missing',
        diagnostic: 'missing git',
        stdout: '',
        stderr: '',
      }),
    });

    expect(plan.reason_code).toBe('git-binary-missing');
    expect(plan.diagnostic).toBe('missing git');
    expect(plan.operations).toEqual([]);
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test('is idempotent across repeated plan and apply cycles', () => {
    const repoRoot = makeTempDir();

    try {
      initRepo(repoRoot);
      writeFile(repoRoot, '.claude/spec-first/state.json', '{}\n');
      commitAll(repoRoot);

      const firstPlan = planRuntimeUntrack({ projectRoot: repoRoot });
      expect(firstPlan.reason_code).toBe('untracked-runtime');
      expect(applyRuntimeUntrack({ projectRoot: repoRoot, operations: firstPlan.operations }).applied_count).toBe(1);

      const secondPlan = planRuntimeUntrack({ projectRoot: repoRoot });
      expect(secondPlan.reason_code).toBe('none-tracked');
      expect(secondPlan.operations).toEqual([]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('applies tracked literal paths with spaces, leading dashes, and pathspec magic safely', () => {
    const repoRoot = makeTempDir();
    const runtimePaths = [
      '.claude/agents/with space.md',
      '.claude/agents/-rf.md',
      '.claude/agents/:(glob)evil.md',
    ];

    try {
      initRepo(repoRoot);
      writeFile(repoRoot, 'src/source.js', 'source\n');
      for (const relativePath of runtimePaths) {
        writeFile(repoRoot, relativePath);
      }
      commitAll(repoRoot);

      const plan = planRuntimeUntrack({ projectRoot: repoRoot });
      expect(plan.operations.map((operation) => operation.path)).toEqual(expect.arrayContaining(runtimePaths));

      const result = applyRuntimeUntrack({ projectRoot: repoRoot, operations: plan.operations });
      expect(result.applied_count).toBe(runtimePaths.length);
      for (const relativePath of runtimePaths) {
        expect(tracked(repoRoot, relativePath)).toBe('');
        expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
      }
      expect(tracked(repoRoot, 'src/source.js')).toBe('src/source.js');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
