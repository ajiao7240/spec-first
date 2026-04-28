'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runDoctor } = require('../../src/cli/commands/doctor');
const { runInit } = require('../../src/cli/commands/init');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-doctor-runtime-tools-'));
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

describe('doctor runtime tools boundary', () => {
  test('does not require a global runtime tools block after init', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);
      const agents = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
      expect(agents).not.toContain('spec-first:runtime-tools:start');

      const result = captureCommand(projectRoot, runDoctor, ['--codex', '--json']);
      const payload = JSON.parse(result.stdout);
      const platformChecks = payload.platform_checks.codex;
      const checkNames = platformChecks.map((check) => check.name);
      const checkText = platformChecks
        .map((check) => [check.name, check.message, check.fix].filter(Boolean).join('\n'))
        .join('\n');

      expect(result.exitCode).toBe(0);
      expect(checkNames).not.toContain('AGENTS.md runtime tools index');
      expect(checkText).not.toContain('managed runtime-tools block');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
