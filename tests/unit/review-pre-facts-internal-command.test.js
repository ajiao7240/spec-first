'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { runCli } = require('../../src/cli');

const REPO_ROOT = path.join(__dirname, '..', '..');

function captureRunCli(args) {
  let stdout = '';
  let stderr = '';
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  const logSpy = jest.spyOn(console, 'log').mockImplementation((chunk = '') => {
    stdout += `${String(chunk)}\n`;
  });
  const errorSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
  return runCli(args)
    .then((code) => ({ code, stdout, stderr }))
    .finally(() => {
      logSpy.mockRestore();
      outputSpy.mockRestore();
      errorSpy.mockRestore();
    });
}

function tempRun() {
  const runId = `internal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dir = path.join(os.tmpdir(), 'spec-first', 'review-pre-facts', runId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return { runId, dir };
}

describe('hidden review-pre-facts internal command', () => {
  test('public help does not expose the internal command', async () => {
    const result = await captureRunCli(['--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('spec-first <command> [options]');
    expect(result.stdout).not.toContain('internal review-pre-facts');
    expect(result.stdout).not.toContain('review-pre-facts');
  });

  test('source checkout command invokes review-pre-facts through internal CLI boundary', () => {
    const { runId, dir } = tempRun();
    const output = path.join(dir, 'codebase-facts.txt');
    const result = spawnSync(process.execPath, [
      path.join(REPO_ROOT, 'bin', 'spec-first.js'),
      'internal',
      'review-pre-facts',
      '--mode', 'one-shot',
      '--workflow', 'doc-review',
      '--document', 'docs/plans/2026-05-11-007-feat-review-pre-facts-injection-plan.md',
      '--repo', REPO_ROOT,
      '--run-id', runId,
      '--summary-dir', dir,
      '--output', output,
    ], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
    expect(fs.readFileSync(output, 'utf8')).toContain('<codebase-facts');
    expect(fs.existsSync(path.join(dir, 'run-summary.json'))).toBe(true);
  });

  test('normalize-provider-results flag contract reports missing raw-result deterministically', async () => {
    const { runId, dir } = tempRun();
    const output = path.join(dir, 'provider-results.json');
    const queryPlan = path.join(dir, 'query-plan.json');
    fs.writeFileSync(queryPlan, '{}\n', 'utf8');

    const result = await captureRunCli([
      'internal',
      'review-pre-facts',
      '--mode', 'normalize-provider-results',
      '--workflow', 'doc-review',
      '--repo', REPO_ROOT,
      '--query-plan', queryPlan,
      '--source', 'live-mcp',
      '--output', output,
      '--run-id', runId,
      '--summary-dir', dir,
    ]);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout).error.code).toBe('missing_required_option');
  });

  test('contract prose names source checkout and installed runtime commands consistently', () => {
    const contract = fs.readFileSync(
      path.join(REPO_ROOT, 'docs/contracts/workflows/review-pre-facts-extraction.md'),
      'utf8',
    );
    const docReference = fs.readFileSync(
      path.join(REPO_ROOT, 'skills/spec-doc-review/references/pre-facts-extraction.md'),
      'utf8',
    );

    for (const text of [contract, docReference]) {
      expect(text).toContain('node bin/spec-first.js internal review-pre-facts');
      expect(text).toContain('spec-first internal review-pre-facts');
      expect(text).toContain('must not call files under `src/cli/helpers/review-pre-facts/` directly');
    }
    expect(contract).toContain('There is no v1 `query-provider` mode.');
    expect(contract).toContain('shell:false');
    expect(contract).toContain('unsupported_provider_adapter_command');
  });
});
