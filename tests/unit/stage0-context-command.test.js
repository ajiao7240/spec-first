'use strict';

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'spec-first.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

describe('stage0-context retired CLI surface', () => {
  test('root help no longer advertises stage0-context and points to CRG', () => {
    const help = execFileSync(process.execPath, [BIN_PATH, '--help'], {
      encoding: 'utf8',
    });

    expect(help).not.toContain('stage0-context');
    expect(help).toContain('crg <subcommand>');
  });

  test('stage0-context is not kept as a hidden compatibility alias', () => {
    const result = runCli(['stage0-context', '--stage', 'work']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command: stage0-context');
    expect(result.stdout).not.toContain('selected_assets');
  });

  test('planning entrypoint is CRG hook with direct-read fallback when graph is unavailable', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-before-plan-'));

    try {
      const result = runCli([
        'crg',
        'hook',
        'before-plan',
        `--repo=${repoRoot}`,
        '--task=add review context',
      ]);

      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.data.hook_id).toBe('before_plan');
      expect(payload.data.workflow_context.fallback).toMatchObject({
        mode: 'direct_repo_reads',
      });
      expect(JSON.stringify(payload)).not.toContain('selected_assets');
      expect(JSON.stringify(payload)).not.toContain('minimal-context');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
