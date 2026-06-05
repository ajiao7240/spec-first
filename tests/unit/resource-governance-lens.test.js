'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runInternal } = require('../../src/cli/commands/internal');
const {
  collectResourceGovernanceLens,
  validateOutput,
} = require('../../src/cli/helpers/resource-governance-lens');

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-governance-lens-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Spec First Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'spec-first-test@example.invalid'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '--no-verify', '-m', 'initial', '-q'], { cwd: repo });
  return repo;
}

function captureStdout(fn) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    const code = fn();
    const stdout = outputSpy.mock.calls.map((call) => String(call[0])).join('');
    return { code, stdout };
  } finally {
    outputSpy.mockRestore();
  }
}

describe('resource governance lens', () => {
  test('detects staged generated runtime without using it as evidence_ref', () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, '.claude', 'commands'), { recursive: true });
      fs.writeFileSync(path.join(repo, '.claude', 'commands', 'work.md'), 'generated\n');
      execFileSync('git', ['add', '.claude/commands/work.md'], { cwd: repo });

      const output = collectResourceGovernanceLens({ targetRepo: repo });
      const generated = output.items.find((item) => item.dimension === 'generated-output');
      const staging = output.items.find((item) => item.reason_code === 'staged-generated-runtime');

      expect(validateOutput(output).errors).toEqual([]);
      expect(output.status).toBe('advisory');
      expect(generated).toEqual(expect.objectContaining({
        subject_path: '.claude/commands/work.md',
        evidence_ref: 'git-diff:cached',
      }));
      expect(staging).toEqual(expect.objectContaining({
        subject_path: '.claude/commands/work.md',
        evidence_ref: 'git-diff:cached',
      }));
      expect(output.items.map((item) => item.evidence_ref)).not.toContain('.claude/commands/work.md');

      const gitAddDot = output.items.find((item) => item.reason_code === 'git-add-dot-risk-inferred');
      expect(gitAddDot).toEqual(expect.objectContaining({
        dimension: 'staging-scope',
        subject_path: '.',
        evidence_ref: 'git-status:porcelain',
      }));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('does not follow symlinks when measuring file size', () => {
    const repo = makeRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-lens-outside-'));
    try {
      const target = path.join(outside, 'huge.bin');
      fs.writeFileSync(target, Buffer.alloc(5 * 1024 * 1024 + 1));
      fs.symlinkSync(target, path.join(repo, 'link.bin'));
      execFileSync('git', ['add', '-N', 'link.bin'], { cwd: repo });

      const output = collectResourceGovernanceLens({ targetRepo: repo });
      const largeFile = output.items.find((item) => item.dimension === 'large-file');
      expect(largeFile).toBeUndefined();
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('detects large files, raw logs, and owner hints', () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, 'docs', 'contracts'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'docs', 'contracts', 'notes.md'), 'contract\n');
      fs.writeFileSync(path.join(repo, 'big.bin'), Buffer.alloc(5 * 1024 * 1024 + 1));
      fs.mkdirSync(path.join(repo, 'logs'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'logs', 'debug.log'), Buffer.alloc(512 * 1024 + 1));

      const output = collectResourceGovernanceLens({ targetRepo: repo });

      expect(validateOutput(output).errors).toEqual([]);
      expect(output.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ dimension: 'large-file', reason_code: 'large-file-added', subject_path: 'big.bin' }),
        expect.objectContaining({ dimension: 'raw-log', reason_code: 'raw-log-large', subject_path: 'logs/debug.log' }),
        expect.objectContaining({
          dimension: 'owner-hint',
          reason_code: 'owner-path-hint',
          subject_path: 'docs/contracts/notes.md',
          details: { owner: 'contracts', match: 'docs/contracts' },
        }),
      ]));
      expect(output.items.every((item) => item.severity === 'advisory')).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('internal subcommand emits JSON', () => {
    const repo = makeRepo();
    try {
      const result = captureStdout(() => runInternal([
        'resource-governance-lens',
        '--target-repo',
        repo,
        '--json',
      ]));
      const output = JSON.parse(result.stdout);

      expect(result.code).toBe(0);
      expect(output.schema_version).toBe('resource-governance-lens.v1');
      expect(output.status).toBe('ok');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('non-git target is unavailable but exits 0 (advisory, never-blocking)', () => {
    const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-lens-not-repo-'));
    try {
      const result = captureStdout(() => runInternal([
        'resource-governance-lens', '--target-repo', notRepo, '--json',
      ]));
      const output = JSON.parse(result.stdout);
      expect(result.code).toBe(0);
      expect(output.status).toBe('unavailable');
      expect(output.reason_codes).toContain('not-a-repo');
    } finally {
      fs.rmSync(notRepo, { recursive: true, force: true });
    }
  });

  test('retained directory suppresses raw-log advisory (live whitelist branch)', () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, 'coverage'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'coverage', 'lcov.log'), Buffer.alloc(512 * 1024 + 1));
      fs.mkdirSync(path.join(repo, 'logs'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'logs', 'debug.log'), Buffer.alloc(512 * 1024 + 1));

      const output = collectResourceGovernanceLens({ targetRepo: repo });
      const rawLogs = output.items.filter((item) => item.dimension === 'raw-log');

      expect(rawLogs.map((item) => item.subject_path)).toContain('logs/debug.log');
      expect(rawLogs.map((item) => item.subject_path)).not.toContain('coverage/lcov.log');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
