'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'spec-first.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

describe('workspace nested topology Stage-0 retirement', () => {
  test('nested workspace no longer exposes stage0-context as runtime router', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-nested-retired-'));
    const childRepoRoot = path.join(tmpDir, 'crm-workspace', 'services', 'crm-service');

    try {
      fs.mkdirSync(path.join(childRepoRoot, 'member-center'), { recursive: true });
      const result = runCli([
        'stage0-context',
        '--stage',
        'work',
        '--cwd',
        childRepoRoot,
        '--target',
        childRepoRoot,
      ], { cwd: childRepoRoot });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Unknown command: stage0-context');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('review uses direct CLI routing without hidden compatibility entrypoints', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'before-review-'));

    try {
      const result = runCli([
        'hook',
        'before-review',
        `--repo=${repoRoot}`,
        '--since=HEAD~1',
      ]);

      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/unknown command|unknown|unsupported|invalid/i);
      expect(result.stdout).not.toContain('context-routing');
      expect(result.stdout).not.toContain('minimal-context');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
