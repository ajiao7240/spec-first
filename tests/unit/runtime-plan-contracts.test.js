'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-runtime-plan-'));
}

describe('runtime plan contracts', () => {
  test('Claude runtime sync plan writes the managed session-start hook with executable mode', () => {
    const projectRoot = makeTempDir();

    try {
      const adapter = getAdapter('claude');
      const plan = adapter.planRuntimeFilesSync(projectRoot);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0]).toMatchObject({
        kind: 'write_file',
        path: '.claude/hooks/session-start',
        reason: 'managed_runtime_hook',
        mode: 0o755,
      });
      expect(typeof plan.operations[0].contents).toBe('string');
      expect(plan.operations[0].contents).toContain('using-spec-first SessionStart injection');
      expect(plan.summary).toEqual({ write_file: 1 });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude runtime sync plan switches to update_file when the hook already exists', () => {
    const projectRoot = makeTempDir();
    const hookPath = path.join(projectRoot, '.claude', 'hooks', 'session-start');

    try {
      fs.mkdirSync(path.dirname(hookPath), { recursive: true });
      fs.writeFileSync(hookPath, '#!/bin/bash\n', 'utf8');

      const adapter = getAdapter('claude');
      const plan = adapter.planRuntimeFilesSync(projectRoot);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0].kind).toBe('update_file');
      expect(plan.summary).toEqual({ update_file: 1 });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude runtime removal plan removes only the managed session-start hook', () => {
    const adapter = getAdapter('claude');
    const plan = adapter.planRuntimeFilesRemoval('/tmp/unused');

    expect(plan.operations).toEqual([
      {
        kind: 'remove_file',
        path: '.claude/hooks/session-start',
        reason: 'managed_runtime_hook',
      },
    ]);
    expect(plan.summary).toEqual({ remove_file: 1 });
  });

  test('Codex runtime plans remove the full legacy runtime cleanup set', () => {
    const adapter = getAdapter('codex');
    const expectedPaths = [
      '.codex/commands/spec',
      '.codex/spec-first/commands',
      '.codex/skills',
      '.agents/plugins',
      'plugins/spec',
      'plugins/spec-first',
    ];

    for (const plan of [
      adapter.planRuntimeFilesSync('/tmp/unused'),
      adapter.planRuntimeFilesRemoval('/tmp/unused'),
    ]) {
      expect(plan.operations.map((entry) => entry.path)).toEqual(expectedPaths);
      expect(plan.operations.every((entry) => entry.kind === 'remove_dir')).toBe(true);
      expect(plan.summary).toEqual({ remove_dir: expectedPaths.length });
    }
  });
});
