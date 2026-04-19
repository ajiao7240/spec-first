'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');
const { runClean } = require('../../src/cli/commands/clean');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-clean-dry-run-'));
}

function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function captureCommand(cwd, runner, args) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = withCwd(cwd, () => runner(args));
    return {
      exitCode,
      stdout: logs.join('\n'),
      stderr: errors.join('\n'),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function snapshotTree(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath);
      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        walk(absolutePath);
        continue;
      }

      const content = fs.readFileSync(absolutePath, 'utf8');
      results.push(`${relativePath}:${content}`);
    }
  }

  walk(rootDir);
  return results.sort();
}

describe('clean --dry-run', () => {
  test('Claude clean --dry-run previews managed deletions without touching custom assets', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const customSkillPath = path.join(projectRoot, '.claude', 'skills', 'custom-skill', 'SKILL.md');
      const customHookPath = path.join(projectRoot, '.claude', 'hooks', 'custom-hook');
      fs.mkdirSync(path.dirname(customSkillPath), { recursive: true });
      fs.writeFileSync(customSkillPath, 'name: custom-skill\n', 'utf8');
      fs.writeFileSync(customHookPath, '#!/bin/bash\n', 'utf8');

      const before = snapshotTree(projectRoot);
      const result = captureCommand(projectRoot, runClean, ['--claude', '--dry-run']);
      const after = snapshotTree(projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(after).toEqual(before);
      expect(result.stdout).toContain('Dry run: spec-first clean (claude)');
      expect(result.stdout).toContain('Would remove');
      expect(result.stdout).toContain('.claude/spec-first/state.json');
      expect(result.stdout).toContain('Custom assets outside the spec-first managed set would remain untouched.');
      expect(result.stdout).toContain('No files were changed.');
      expect(fs.existsSync(customSkillPath)).toBe(true);
      expect(fs.existsSync(customHookPath)).toBe(true);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
