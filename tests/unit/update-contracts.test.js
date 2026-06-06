'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runUpdate } = require('../../src/cli/commands/update');
const { runProgrammaticInit, useIsolatedDeveloperHome } = require('./helpers/init-plan');

useIsolatedDeveloperHome();

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-update-'));
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

async function captureUpdate(cwd, args, env = {}) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  const restoreEnv = {};
  for (const [key, value] of Object.entries(env)) {
    restoreEnv[key] = process.env[key];
    process.env[key] = value;
  }
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const previousCwd = process.cwd();
    process.chdir(cwd);
    let exitCode;
    try {
      exitCode = await runUpdate(args);
    } finally {
      process.chdir(previousCwd);
    }
    return { exitCode, stdout: logs.join('\n'), stderr: errors.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    for (const [key, value] of Object.entries(restoreEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function parseJsonStdout(stdout) {
  return JSON.parse(stdout);
}

describe('spec-first update command', () => {
  // Force an offline-stable "latest" so version comparison is deterministic and
  // no network lookup is attempted during the test.
  const STALE_ENV = { SPEC_FIRST_VERSION_REMINDER_LATEST: '999.0.0' };

  test('--help documents check-only semantics and the available flags', async () => {
    const dir = makeTempDir();
    try {
      const { exitCode, stdout } = await captureUpdate(dir, ['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('check-only');
      expect(stdout).toContain('NEVER');
      expect(stdout).toContain('Exit codes:');
      expect(stdout).toContain('--claude');
      expect(stdout).toContain('--codex');
      expect(stdout).toContain('--json');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects unknown flags with exit code 2', async () => {
    const dir = makeTempDir();
    try {
      const { exitCode, stderr } = await captureUpdate(dir, ['--bogus']);
      expect(exitCode).toBe(2);
      expect(stderr).toContain('Usage: spec-first update');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--json reports no_runtime_detected in an uninitialized project', async () => {
    const dir = makeTempDir();
    try {
      // No stale env: keep version_status out of the picture so exit code reflects
      // only the no-runtime state. Lookup will fail offline -> version_status unknown -> exit 0.
      const { exitCode, stdout } = await captureUpdate(dir, ['--json'], { SPEC_FIRST_VERSION_REMINDER_TIMEOUT_MS: '50' });
      expect(exitCode).toBe(0);
      const report = parseJsonStdout(stdout);
      expect(report.schema_version).toBe('spec-first-update-report.v1');
      expect(report.mode).toBe('check-only');
      expect(report.no_runtime_detected).toBe(true);
      expect(report.platforms).toEqual([]);
      // Version check is package-level (top-level), not per-platform.
      expect(report).toHaveProperty('cli_version');
      expect(report).toHaveProperty('version_status');
      expect(report).toHaveProperty('lookup_status');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('stale CLI package: top-level status + npm recommendation, exit code 1', async () => {
    const dir = makeTempDir();
    try {
      runProgrammaticInit({ projectRoot: dir, platform: 'codex', name: 'tester', lang: 'en' });
      const { exitCode, stdout } = await captureUpdate(dir, ['--codex', '--json'], STALE_ENV);
      // Exit 1 = actionable (newer version available).
      expect(exitCode).toBe(1);
      const report = parseJsonStdout(stdout);
      expect(report.version_status).toBe('stale');
      expect(report.lookup_status).toBe('ok');
      expect(report.package_recommendation).toBe('npm install -g spec-first@latest');
      const codex = report.platforms.find((p) => p.platform === 'codex');
      expect(codex).toBeDefined();
      // Codex runtime entry carries no plugin note.
      expect(codex.plugin_note).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('Claude runtime: per-platform plugin note with a machine-readable reason code', async () => {
    const dir = makeTempDir();
    try {
      runProgrammaticInit({ projectRoot: dir, platform: 'claude', name: 'tester', lang: 'en' });
      const { exitCode, stdout } = await captureUpdate(dir, ['--claude', '--json'], STALE_ENV);
      expect(exitCode).toBe(1);
      const report = parseJsonStdout(stdout);
      const claude = report.platforms.find((p) => p.platform === 'claude');
      expect(claude).toBeDefined();
      expect(claude.plugin_note_reason_code).toBe('claude_marketplace_cache_unavailable');
      // The plugin note explains the marketplace limitation and points to the right command,
      // without fabricating a resolved marketplace name.
      expect(claude.plugin_note).toContain('claude plugin update');
      expect(claude.plugin_note).toContain('not visible to this CLI');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('human output states the command does not apply upgrades', async () => {
    const dir = makeTempDir();
    try {
      runProgrammaticInit({ projectRoot: dir, platform: 'codex', name: 'tester', lang: 'en' });
      const { exitCode, stdout } = await captureUpdate(dir, ['--codex'], STALE_ENV);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('check-only');
      expect(stdout).toContain('this command does not apply it');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
