'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');
const { runProgrammaticInit, useIsolatedDeveloperHome } = require('./helpers/init-plan');

useIsolatedDeveloperHome();

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-hook-perms-'));
}

function withProject(projectRoot, fn) {
  const previous = process.cwd();
  process.chdir(projectRoot);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function isExecutable(mode) {
  return (mode & 0o111) === 0o111;
}

describe('Claude runtime hook permissions', () => {
  test('init writes the managed session-start hook with template content and execute bits', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withProject(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'claude' }))).toBe(0);

      const hookPath = path.join(projectRoot, '.claude', 'hooks', 'session-start');
      const expected = getAdapter('claude').planRuntimeFilesSync(projectRoot).operations[0].contents;
      const actual = fs.readFileSync(hookPath, 'utf8');
      const mode = fs.statSync(hookPath).mode & 0o777;

      expect(actual).toBe(expected);
      expect(mode).toBe(0o755);
      expect(isExecutable(mode)).toBe(true);
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('re-running init restores execute bits if the managed hook permissions drift', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withProject(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'claude' }))).toBe(0);

      const hookPath = path.join(projectRoot, '.claude', 'hooks', 'session-start');
      fs.chmodSync(hookPath, 0o644);

      const driftedMode = fs.statSync(hookPath).mode & 0o777;
      expect(driftedMode).toBe(0o644);
      expect(isExecutable(driftedMode)).toBe(false);

      expect(withProject(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'claude' }))).toBe(0);

      const restoredMode = fs.statSync(hookPath).mode & 0o777;
      expect(restoredMode).toBe(0o755);
      expect(isExecutable(restoredMode)).toBe(true);
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
