'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { collectGitDiffSignals, parseNumstat } = require('../../src/cli/helpers/git-diff-signals');

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-diff-signals-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Spec First Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'spec-first-test@example.invalid'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '--no-verify', '-m', 'initial', '-q'], { cwd: repo });
  return repo;
}

describe('git diff signals', () => {
  test('parses numstat lines instead of insertion/deletion prose', () => {
    expect(parseNumstat('3\t2\tsrc/a.js\n-\t-\tassets/image.png\n')).toEqual([
      { added: 3, deleted: 2, path: 'src/a.js' },
      { added: 0, deleted: 0, path: 'assets/image.png' },
    ]);
  });

  test('collects file count and line delta from git diff --numstat', () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'one\ntwo\n');
      fs.writeFileSync(path.join(repo, 'README.md'), 'base\nchanged\n');
      execFileSync('git', ['add', '-N', 'src/a.js'], { cwd: repo });

      const result = collectGitDiffSignals({ targetRepo: repo });

      expect(result.ok).toBe(true);
      expect(result.file_count).toBe(2);
      expect(result.line_delta).toBeGreaterThanOrEqual(3);
      expect(result.paths).toEqual(expect.arrayContaining(['README.md', 'src/a.js']));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('reports empty diff and non git repo with reason codes', () => {
    const repo = makeRepo();
    const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
    try {
      expect(collectGitDiffSignals({ targetRepo: repo })).toEqual(expect.objectContaining({
        ok: true,
        reason_code: 'empty-diff',
        file_count: 0,
        line_delta: 0,
      }));
      expect(collectGitDiffSignals({ targetRepo: notRepo })).toEqual(expect.objectContaining({
        ok: false,
        reason_code: 'not-a-repo',
      }));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(notRepo, { recursive: true, force: true });
    }
  });

  test('unresolvable base ref returns no-diff-base without throwing', () => {
    const repo = makeRepo();
    try {
      const result = collectGitDiffSignals({ targetRepo: repo, baseRef: 'no-such-ref-xyz' });
      expect(result.ok).toBe(false);
      expect(result.reason_code).toBe('no-diff-base');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('a base ref shaped like a git option does not write an arbitrary file', () => {
    const repo = makeRepo();
    const sentinel = path.join(os.tmpdir(), `git-diff-eot-${Date.now()}.txt`);
    try {
      const result = collectGitDiffSignals({ targetRepo: repo, baseRef: `--output=${sentinel}` });
      expect(result.ok).toBe(false);
      expect(fs.existsSync(sentinel)).toBe(false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(sentinel, { force: true });
    }
  });
});
