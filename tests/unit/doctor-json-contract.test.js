'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');
const { runDoctor } = require('../../src/cli/commands/doctor');

function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function captureDoctor(args) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = runDoctor(args);
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

describe('doctor --json contract', () => {
  test('reports no-platform projects as install-only facts without claiming workflow runnability', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-empty-'));

    try {
      const result = withCwd(projectRoot, () => captureDoctor(['--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(payload).toMatchObject({
        schema_version: 'v1',
        platforms: [],
        install_health: expect.stringMatching(/^(pass|warn|error)$/),
        runtime_asset_health: 'not_applicable',
        host_readiness: 'not_applicable',
        decision_input_health: 'not_checked',
        workflow_runnability: 'not_verified',
      });
      expect(payload.workflow_runnability_basis).toMatchObject({
        runtime_assets_ready: false,
        managed_state_present: false,
        workflow_surface_resolved: false,
        execution_evidence_present: false,
      });
      expect(Array.isArray(payload.checks)).toBe(true);
      expect(Array.isArray(payload.warnings)).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('includes platform-scoped runtime and host layers for explicit platform checks', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-claude-'));

    try {
      fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true });
      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(payload.platforms).toEqual(['claude']);
      expect(payload.workflow_runnability).toBe('not_verified');
      expect(payload.workflow_runnability_basis).toMatchObject({
        runtime_assets_ready: false,
        managed_state_present: false,
        workflow_surface_resolved: false,
        execution_evidence_present: false,
      });
      expect(payload.runtime_asset_health).toMatch(/^(pass|warn|error)$/);
      expect(payload.host_readiness).toMatch(/^(pass|warn|error)$/);
      expect(payload.platform_checks.claude).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('.claude'),
            level: expect.stringMatching(/^(PASS|WARNING|ERROR)$/),
          }),
        ])
      );
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('reports initialized platforms as simulated when runtime surfaces are ready but no evidence is recorded', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-simulated-'));
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const initExitCode = withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']));
      expect(initExitCode).toBe(0);

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.workflow_runnability).toBe('simulated');
      expect(payload.workflow_runnability_basis).toMatchObject({
        runtime_assets_ready: true,
        managed_state_present: true,
        workflow_surface_resolved: true,
        execution_evidence_present: false,
      });
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('reports verified when execution evidence is present and runtime surfaces are ready', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-verified-'));
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const initExitCode = withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']));
      expect(initExitCode).toBe(0);

      fs.mkdirSync(path.join(projectRoot, '.spec-first', 'runtime'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, '.spec-first', 'runtime', 'verification-evidence.json'),
        `${JSON.stringify({
          schema_version: 'v1',
          evidence_items: [
            {
              verifier: 'doctor-fixture',
              recorded_at: '2026-04-19T00:00:00.000Z',
              artifact_path: '.spec-first/runtime/verification-evidence.json',
            },
          ],
        }, null, 2)}\n`,
        'utf8',
      );

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.workflow_runnability).toBe('verified');
      expect(payload.workflow_runnability_basis).toMatchObject({
        runtime_assets_ready: true,
        managed_state_present: true,
        workflow_surface_resolved: true,
        execution_evidence_present: true,
      });
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
