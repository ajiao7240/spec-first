'use strict';

const { runUpdate } = require('../../src/cli/commands/update');

// 注入假 runInstall,避免单测触发真实 `npm install -g` 或联网。
function makeInstaller(outcome) {
  const calls = [];
  const runInstall = () => {
    calls.push(true);
    return outcome;
  };
  return { runInstall, calls };
}

async function captureUpdate(args, deps) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = await runUpdate(args, deps);
    return { exitCode, stdout: logs.join('\n'), stderr: errors.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

describe('spec-first update command', () => {
  test('successful npm install: calls installer once and points to spec-first init', async () => {
    const { runInstall, calls } = makeInstaller({ status: 0, errorCode: null });
    const { exitCode, stdout } = await captureUpdate([], { runInstall });
    expect(exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(stdout).toContain('npm install -g spec-first@latest');
    expect(stdout).toContain('spec-first init');
  });

  test('failed npm install (non-zero): surfaces manual command, no init prompt, exit non-zero', async () => {
    const { runInstall } = makeInstaller({ status: 1, errorCode: null });
    const { exitCode, stdout, stderr } = await captureUpdate([], { runInstall });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Upgrade failed');
    expect(stderr).toContain('npm install -g spec-first@latest');
    expect(stdout).not.toContain('spec-first init');
  });

  test('npm not found (ENOENT): explains npm is missing, exit non-zero', async () => {
    const { runInstall } = makeInstaller({ status: null, errorCode: 'ENOENT' });
    const { exitCode, stderr } = await captureUpdate([], { runInstall });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('npm');
    expect(stderr.toLowerCase()).toContain('not found');
  });

  test('legacy --json flag is no longer supported: exit 2, installer not called', async () => {
    const { runInstall, calls } = makeInstaller({ status: 0, errorCode: null });
    const { exitCode, stderr } = await captureUpdate(['--json'], { runInstall });
    expect(exitCode).toBe(2);
    expect(stderr).toContain('Usage: spec-first update');
    expect(calls).toHaveLength(0);
  });

  test('unknown flag: exit 2, installer not called', async () => {
    const { runInstall, calls } = makeInstaller({ status: 0, errorCode: null });
    const { exitCode } = await captureUpdate(['--bogus'], { runInstall });
    expect(exitCode).toBe(2);
    expect(calls).toHaveLength(0);
  });

  test('--help documents the upgrade semantics and does not claim check-only', async () => {
    const { runInstall, calls } = makeInstaller({ status: 0, errorCode: null });
    const { exitCode, stdout } = await captureUpdate(['--help'], { runInstall });
    expect(exitCode).toBe(0);
    expect(calls).toHaveLength(0);
    expect(stdout).not.toContain('check-only');
    expect(stdout).not.toContain('NEVER');
    expect(stdout).toContain('npm install -g spec-first@latest');
    expect(stdout).toContain('spec-first init');
    expect(stdout).toContain('Exit codes:');
  });
});
