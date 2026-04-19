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

function writeWorkVerificationContext(projectRoot, requiredVerifications = ['browser-smoke']) {
  const slug = path.basename(projectRoot);
  const bootstrapDir = path.join(projectRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'minimal-context');
  fs.mkdirSync(bootstrapDir, { recursive: true });
  fs.writeFileSync(
    path.join(bootstrapDir, 'work.json'),
    `${JSON.stringify({
      schema_version: 'v1',
      generated_at: '2026-04-19T00:00:00.000Z',
      stage: 'work',
      profile: 'work-default',
      platform_focus: ['web'],
      required_verifications: requiredVerifications,
      optional_verifications: [],
      fallback_reason: null,
      advice: 'work',
    }, null, 2)}\n`,
    'utf8',
  );
  return slug;
}

function writeVerificationEvidence(projectRoot, slug, evidenceItems) {
  const verificationDir = path.join(projectRoot, '.spec-first', 'workflows', 'verification', slug);
  fs.mkdirSync(verificationDir, { recursive: true });
  fs.writeFileSync(
    path.join(verificationDir, 'verification-evidence.json'),
    `${JSON.stringify({
      schema_version: 'v1',
      evidence_source: 'workflow-artifacts',
      evidence_items: evidenceItems,
    }, null, 2)}\n`,
    'utf8',
  );
}

function relativeCapturedAt({ daysAgo = 0, minutesAgo = 0 } = {}) {
  const capturedMs = Date.now() - (daysAgo * 24 * 60 * 60 * 1000) - (minutesAgo * 60 * 1000);
  return new Date(capturedMs).toISOString();
}

function expectMissingEvidenceAgeSummary(summary) {
  expect(summary).toEqual({
    oldest_captured_at: null,
    oldest_age_ms: null,
    newest_captured_at: null,
    newest_age_ms: null,
    max_age_ms: 7 * 24 * 60 * 60 * 1000,
  });
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
      expectMissingEvidenceAgeSummary(payload.workflow_runnability_basis.evidence_age_summary);
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
      expectMissingEvidenceAgeSummary(payload.workflow_runnability_basis.evidence_age_summary);
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
      expectMissingEvidenceAgeSummary(payload.workflow_runnability_basis.evidence_age_summary);
      expect(payload.platform_checks.claude).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'CLAUDE.md coding guidelines',
            level: 'PASS',
          }),
        ])
      );
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('reports warning when the managed coding-guidelines block is missing', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-guidelines-missing-'));
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const initExitCode = withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']));
      expect(initExitCode).toBe(0);

      const instructionPath = path.join(projectRoot, 'CLAUDE.md');
      const stripped = fs.readFileSync(instructionPath, 'utf8')
        .replace(/<!-- spec-first:coding-guidelines:start -->[\s\S]*?<!-- spec-first:coding-guidelines:end -->\n?/g, '');
      fs.writeFileSync(instructionPath, stripped, 'utf8');

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.platform_checks.claude).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'CLAUDE.md coding guidelines',
            level: 'WARNING',
            fix: expect.stringContaining('spec-first init --claude'),
          }),
        ])
      );
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('reports warning when Claude and Codex project developer names drift apart', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-developer-drift-'));
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const initExitCode = withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']));
      expect(initExitCode).toBe(0);

      fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, '.codex', 'spec-first', '.developer'),
        'name=codex-user\nlang=zh\ninitialized_at=2026-04-20T00:00:00.000Z\nversion=1.5.4\n',
        'utf8',
      );

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.common_checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'project developer identity',
            level: 'WARNING',
            message: expect.stringContaining('claude=reviewer'),
            fix: expect.stringContaining('spec-first init --claude'),
          }),
        ]),
      );
      expect(payload.common_checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'project developer identity',
            message: expect.stringContaining('codex=codex-user'),
          }),
        ]),
      );
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
      const slug = writeWorkVerificationContext(projectRoot);
      writeVerificationEvidence(projectRoot, slug, [
        {
          evidence_ref: 'evidence://browser-smoke/1',
          verifier: 'test-browser',
          gate_ids: ['browser-smoke'],
          evidence_type: 'browser-snapshot',
          status: 'captured',
          artifact_path: `.spec-first/workflows/verification/${slug}/browser-smoke.png`,
          captured_at: relativeCapturedAt({ minutesAgo: 5 }),
          stage: 'work',
        },
      ]);

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
      expect(payload.workflow_runnability_basis.evidence_age_summary).toMatchObject({
        oldest_captured_at: expect.any(String),
        newest_captured_at: expect.any(String),
        max_age_ms: 7 * 24 * 60 * 60 * 1000,
      });
      expect(payload.workflow_runnability_basis.evidence_age_summary.oldest_captured_at)
        .toBe(payload.workflow_runnability_basis.evidence_age_summary.newest_captured_at);
      expect(payload.workflow_runnability_basis.evidence_age_summary.oldest_age_ms)
        .toBeGreaterThanOrEqual(0);
      expect(payload.workflow_runnability_basis.evidence_age_summary.oldest_age_ms)
        .toBeLessThan(payload.workflow_runnability_basis.evidence_age_summary.max_age_ms);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('does not report verified when workflow evidence is stale', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-stale-'));
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const initExitCode = withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']));
      expect(initExitCode).toBe(0);

      const slug = writeWorkVerificationContext(projectRoot);
      writeVerificationEvidence(projectRoot, slug, [
        {
          evidence_ref: 'evidence://browser-smoke/1',
          verifier: 'test-browser',
          gate_ids: ['browser-smoke'],
          evidence_type: 'browser-snapshot',
          status: 'captured',
          artifact_path: `.spec-first/workflows/verification/${slug}/browser-smoke.png`,
          captured_at: relativeCapturedAt({ daysAgo: 30 }),
          stage: 'work',
        },
        {
          evidence_ref: 'evidence://browser-smoke/2',
          verifier: 'test-browser',
          gate_ids: ['browser-smoke'],
          evidence_type: 'browser-snapshot',
          status: 'captured',
          artifact_path: `.spec-first/workflows/verification/${slug}/browser-smoke-2.png`,
          captured_at: relativeCapturedAt({ minutesAgo: 5 }),
          stage: 'work',
        },
      ]);

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.workflow_runnability).toBe('simulated');
      expect(payload.workflow_runnability_basis).toMatchObject({
        execution_evidence_present: true,
        evidence_schema_valid: true,
        evidence_freshness: 'stale',
        fallback_reason: 'verification_evidence_stale',
      });
      expect(payload.workflow_runnability_basis.evidence_age_summary).toMatchObject({
        oldest_captured_at: expect.any(String),
        newest_captured_at: expect.any(String),
        max_age_ms: 7 * 24 * 60 * 60 * 1000,
      });
      expect(payload.workflow_runnability_basis.evidence_age_summary.oldest_captured_at)
        .not.toBe(payload.workflow_runnability_basis.evidence_age_summary.newest_captured_at);
      expect(payload.workflow_runnability_basis.evidence_age_summary.oldest_age_ms)
        .toBeGreaterThan(payload.workflow_runnability_basis.evidence_age_summary.max_age_ms);
      expect(payload.workflow_runnability_basis.evidence_age_summary.newest_age_ms)
        .toBeLessThan(payload.workflow_runnability_basis.evidence_age_summary.max_age_ms);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('does not report verified when workflow evidence schema is invalid', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-json-invalid-evidence-'));
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const initExitCode = withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']));
      expect(initExitCode).toBe(0);

      const slug = writeWorkVerificationContext(projectRoot);
      const verificationDir = path.join(projectRoot, '.spec-first', 'workflows', 'verification', slug);
      fs.mkdirSync(verificationDir, { recursive: true });
      fs.writeFileSync(
        path.join(verificationDir, 'verification-evidence.json'),
        `${JSON.stringify({
          schema_version: 'v1',
          evidence_source: 'workflow-artifacts',
          evidence_items: [
            {
              evidence_ref: 'evidence://browser-smoke/1',
              verifier: 'test-browser',
              gate_ids: ['browser-smoke'],
              status: 'captured',
              artifact_path: `.spec-first/workflows/verification/${slug}/browser-smoke.png`,
              captured_at: relativeCapturedAt({ minutesAgo: 5 }),
              stage: 'work',
            },
          ],
        }, null, 2)}\n`,
        'utf8',
      );

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.workflow_runnability).toBe('simulated');
      expect(payload.workflow_runnability_basis).toMatchObject({
        execution_evidence_present: false,
        evidence_schema_valid: false,
        fallback_reason: 'verification_evidence_schema_invalid',
      });
      expectMissingEvidenceAgeSummary(payload.workflow_runnability_basis.evidence_age_summary);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
