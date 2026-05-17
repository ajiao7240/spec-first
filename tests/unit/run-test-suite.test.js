'use strict';

const {
  DEFAULT_TEST_COMMAND_TIMEOUT_MS,
  resolveTestCommandTimeoutMs,
  run,
} = require('../../scripts/run-test-suite.cjs');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const TEST_RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'run-test-suite.cjs');

describe('run-test-suite command runner', () => {
  test('uses a bounded default command timeout with env override', () => {
    expect(resolveTestCommandTimeoutMs({})).toBe(DEFAULT_TEST_COMMAND_TIMEOUT_MS);
    expect(resolveTestCommandTimeoutMs({ SPEC_FIRST_TEST_COMMAND_TIMEOUT_MS: '50' })).toBe(50);
    expect(resolveTestCommandTimeoutMs({ SPEC_FIRST_TEST_COMMAND_TIMEOUT_MS: '0' })).toBe(DEFAULT_TEST_COMMAND_TIMEOUT_MS);
    expect(resolveTestCommandTimeoutMs({ SPEC_FIRST_TEST_COMMAND_TIMEOUT_MS: 'invalid' })).toBe(DEFAULT_TEST_COMMAND_TIMEOUT_MS);
  });

  test('maps timed out child commands to exit code 124', () => {
    try {
      run(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
        stdio: 'pipe',
        timeout: 50,
      });
      throw new Error('Expected run() to time out');
    } catch (error) {
      expect(error.message).toContain('timed out after 50ms');
      expect(error.status).toBe(124);
    }
  });

  test('release-governance runs release continuity guard before install smoke', () => {
    const runner = fs.readFileSync(TEST_RUNNER_PATH, 'utf8');
    const continuityIndex = runner.indexOf("runNode(['scripts/check-release-continuity.cjs'])");
    const smokeIndex = runner.indexOf("runBash('tests/smoke/release-dual-host-governance.sh')");

    expect(continuityIndex).toBeGreaterThan(-1);
    expect(smokeIndex).toBeGreaterThan(-1);
    expect(continuityIndex).toBeLessThan(smokeIndex);
  });
});
