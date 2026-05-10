'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const BIN_PATH = path.join(REPO_ROOT, 'bin', 'spec-first.js');
const PACKAGE_JSON = require('../../package.json');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd: options.cwd || REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    shell: false,
    windowsHide: true,
  });
}

describe('CLI entry contract', () => {
  test('help exits successfully and advertises supported package commands', () => {
    const result = runCli(['--help']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('doctor');
    expect(result.stdout).toContain('init (--claude|--codex)');
    expect(result.stdout).toContain('clean (--claude|--codex)');
    expect(result.stdout).toContain('tasks <subcommand>');
    expect(result.stdout).toContain('gitnexus-instruction');
    expect(result.stdout).not.toContain('crg <subcommand>');
  });

  test('version exits successfully and keeps workflow names out of package CLI output', () => {
    const result = runCli(['-v']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`Spec-First v${PACKAGE_JSON.version}`);
    expect(result.stdout).toContain('Claude Code & Codex');
    expect(result.stdout).not.toContain('graph-bootstrap');
  });

  test('unknown command exits with usage-error code and actionable help', () => {
    const result = runCli(['unknown-command']);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/Unknown command: unknown-command/i);
    expect(result.stderr).toContain('Run `spec-first --help`');
    expect(result.stderr).toContain('Usage:');
    expect(result.stderr).not.toContain('src/crg');
    expect(result.stderr).not.toContain('crg <subcommand>');
  });

  test('CI and NO_COLOR mode does not emit ANSI escape sequences', () => {
    const result = runCli(['--help'], {
      env: {
        CI: 'true',
        NO_COLOR: '1',
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(/\x1B\[[0-?]*[ -/]*[@-~]/);
  });
});
