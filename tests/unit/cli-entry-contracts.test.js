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
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('Interactively install workflows');
    expect(result.stdout).toContain('clean (--claude|--codex)');
    expect(result.stdout).toContain('Upgrade the spec-first CLI package');
    expect(result.stdout).toContain('refresh runtime assets with `spec-first init`');
    expect(result.stdout).not.toContain('check-only; never auto-upgrades');
    expect(result.stdout).not.toContain('[--claude|--codex] Check version and runtime freshness');
    expect(result.stdout).toContain('tasks <subcommand>');
    expect(result.stdout).toContain('session <subcommand>');
  });

  test('version exits successfully and keeps package CLI guidance visible', () => {
    const result = runCli(['-v']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`Spec-First v${PACKAGE_JSON.version}`);
    expect(result.stdout).toContain('Claude Code & Codex');
  });

  test('doctor help names the current setup entrypoint and deferred runtime-setup alias', () => {
    const result = runCli(['doctor', '--help']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('MCP/helper setup is handled by $spec-mcp-setup or /spec:mcp-setup');
    expect(result.stdout).toContain('target name: spec-runtime-setup, pending host alias contract');
    expect(result.stdout).not.toContain('legacy alias: spec-mcp-setup');
    expect(result.stdout).not.toContain('$spec-runtime-setup or /spec:runtime-setup');
  });

  test('unknown command exits with usage-error code and actionable help', () => {
    const result = runCli(['unknown-command']);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/Unknown command: unknown-command/i);
    expect(result.stderr).toContain('Run `spec-first --help`');
    expect(result.stderr).toContain('Usage:');
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
