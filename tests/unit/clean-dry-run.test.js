'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runClean } = require('../../src/cli/commands/clean');
const { getAdapter } = require('../../src/cli/adapters');
const { readState } = require('../../src/cli/state');
const { runProgrammaticInit } = require('./helpers/init-plan');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-clean-dry-run-'));
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

function snapshotTree(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath);
      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        walk(absolutePath);
        continue;
      }

      const content = fs.readFileSync(absolutePath, 'utf8');
      results.push(`${relativePath}:${content}`);
    }
  }

  walk(rootDir);
  return results.sort();
}

describe('clean --dry-run', () => {
  test('Claude clean --dry-run previews managed deletions without touching custom assets', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'claude' }))).toBe(0);

      const customSkillPath = path.join(projectRoot, '.claude', 'skills', 'custom-skill', 'SKILL.md');
      const customHookPath = path.join(projectRoot, '.claude', 'hooks', 'custom-hook');
      fs.mkdirSync(path.dirname(customSkillPath), { recursive: true });
      fs.writeFileSync(customSkillPath, 'name: custom-skill\n', 'utf8');
      fs.writeFileSync(customHookPath, '#!/bin/bash\n', 'utf8');

      const before = snapshotTree(projectRoot);
      const result = captureCommand(projectRoot, runClean, ['--claude', '--dry-run']);
      const after = snapshotTree(projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(after).toEqual(before);
      expect(result.stdout).toContain('Dry run: spec-first clean (claude)');
      expect(result.stdout).toContain('Would remove');
      expect(result.stdout).toContain('.claude/spec-first/state.json');
      expect(result.stdout).toContain('.claude/hooks/session-start');
      expect(result.stdout).toContain('.claude/settings.json');
      expect(result.stdout).toContain('CLAUDE.md');
      expect(result.stdout).toContain('Custom assets outside the spec-first managed set would remain untouched.');
      expect(result.stdout).toContain('No files were changed.');
      expect(fs.existsSync(customSkillPath)).toBe(true);
      expect(fs.existsSync(customHookPath)).toBe(true);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude clean apply matches the high-value paths promised by dry-run', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'claude' }))).toBe(0);

      const dryRun = captureCommand(projectRoot, runClean, ['--claude', '--dry-run']);
      expect(dryRun.exitCode).toBe(0);

      const claudeInstructionPath = path.join(projectRoot, 'CLAUDE.md');
      fs.appendFileSync(
        claudeInstructionPath,
        [
          '',
          '<!-- gitnexus:start -->',
          '# GitNexus — Code Intelligence',
          '<!-- gitnexus:end -->',
          '',
        ].join('\n'),
        'utf8',
      );

      const cleanResult = captureCommand(projectRoot, runClean, ['--claude']);
      expect(cleanResult.exitCode).toBe(0);

      const removedPaths = [
        '.claude/spec-first/state.json',
        '.claude/hooks/session-start',
        '.claude/settings.json',
      ];
      for (const relativePath of removedPaths) {
        expect(dryRun.stdout).toContain(relativePath);
        expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(false);
      }

      expect(dryRun.stdout).toContain('CLAUDE.md');
      expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(true);
      const claudeInstruction = fs.readFileSync(claudeInstructionPath, 'utf8');
      expect(claudeInstruction).not.toContain('spec-first:bootstrap:start');
      expect(claudeInstruction).not.toContain('spec-first:coding-guidelines:start');
      expect(claudeInstruction).not.toContain('spec-first:runtime-tools:start');
      expect(claudeInstruction).toContain('<!-- gitnexus:start -->');
      expect(claudeInstruction).toContain('# GitNexus — Code Intelligence');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex clean --dry-run previews legacy runtime cleanup paths and apply removes them', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const legacyPaths = [
      '.codex/commands/spec',
      '.codex/spec-first/commands',
      '.codex/skills',
      '.agents/plugins',
      'plugins/spec',
      'plugins/spec-first',
    ];

    try {
      expect(withCwd(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'codex' }))).toBe(0);
      for (const relativePath of legacyPaths) {
        fs.mkdirSync(path.join(projectRoot, relativePath), { recursive: true });
      }

      const dryRun = captureCommand(projectRoot, runClean, ['--codex', '--dry-run']);
      expect(dryRun.exitCode).toBe(0);

      const cleanResult = captureCommand(projectRoot, runClean, ['--codex']);
      expect(cleanResult.exitCode).toBe(0);

      for (const relativePath of legacyPaths) {
        expect(dryRun.stdout).toContain(relativePath);
        expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(false);
      }

    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('clean removes obsolete managed graph workflow assets recorded in state', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const retiredCommandFile = ['graph', 'bootstrap'].join('-') + '.md';
    const retiredSkillName = ['spec', 'graph', 'bootstrap'].join('-');

    try {
      expect(withCwd(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'claude' }))).toBe(0);
      const statePath = path.join(projectRoot, '.claude', 'spec-first', 'state.json');
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.commands.push(retiredCommandFile);
      state.workflowSkills.push(retiredSkillName);
      state.commands.sort();
      state.workflowSkills.sort();
      fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

      const retiredCommandPath = path.join(projectRoot, '.claude', 'commands', 'spec', retiredCommandFile);
      const retiredWorkflowPath = path.join(projectRoot, '.claude', 'spec-first', 'workflows', retiredSkillName);
      fs.writeFileSync(retiredCommandPath, 'old managed command\n', 'utf8');
      fs.mkdirSync(retiredWorkflowPath, { recursive: true });
      fs.writeFileSync(path.join(retiredWorkflowPath, 'SKILL.md'), 'old managed skill\n', 'utf8');

      const dryRun = captureCommand(projectRoot, runClean, ['--claude', '--dry-run']);
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.stdout).toContain(path.posix.join('.claude/commands/spec', retiredCommandFile));
      expect(dryRun.stdout).toContain(path.posix.join('.claude/spec-first/workflows', retiredSkillName));

      const cleanResult = captureCommand(projectRoot, runClean, ['--claude']);
      expect(cleanResult.exitCode).toBe(0);
      expect(fs.existsSync(retiredCommandPath)).toBe(false);
      expect(fs.existsSync(retiredWorkflowPath)).toBe(false);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('clean rejects unsafe managed state paths before deleting assets', () => {
    const tempRoot = makeTempDir();
    const projectRoot = path.join(tempRoot, 'project');
    const victimPath = path.join(tempRoot, 'victim.txt');
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      fs.mkdirSync(projectRoot, { recursive: true });
      fs.writeFileSync(victimPath, 'do not remove\n', 'utf8');
      expect(withCwd(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'codex' }))).toBe(0);

      const adapter = getAdapter('codex');
      const statePath = path.join(projectRoot, adapter.stateFile);
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.skills.push('../../../../victim.txt');
      fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

      expect(() => readState(projectRoot, adapter)).toThrow(/unsafe path entry/);
      const cleanResult = captureCommand(projectRoot, runClean, ['--codex']);
      expect(cleanResult.exitCode).toBe(1);
      expect(cleanResult.stderr).toContain('unsafe path entry');
      expect(fs.readFileSync(victimPath, 'utf8')).toBe('do not remove\n');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('managed state ignores legacy developer fields when present', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'codex' }))).toBe(0);

      const adapter = getAdapter('codex');
      const statePath = path.join(projectRoot, adapter.stateFile);
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.developer = { path: '.codex/spec-first/.developer', name: 'legacy', lang: 'zh' };
      fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

      const reread = readState(projectRoot, adapter);
      expect(reread).not.toHaveProperty('developer');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('clean --workspace-orphans', () => {
  test('lists parent quarantine entries without deleting files', () => {
    const projectRoot = makeTempDir();
    try {
      const workspaceDir = path.join(projectRoot, '.spec-first', 'workspace');
      const graphFactsPath = path.join(projectRoot, '.spec-first', 'graph', 'graph-facts.json');
      fs.mkdirSync(path.dirname(graphFactsPath), { recursive: true });
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(graphFactsPath, '{"schema_version":"graph-facts.v1"}\n', 'utf8');
      fs.writeFileSync(
        path.join(workspaceDir, 'parent-artifact-quarantine.json'),
        `${JSON.stringify({
          schema_version: 'parent-artifact-quarantine.v1',
          topology: 'multi-repo-workspace',
          advisory: true,
          authority_level: 'advisory',
          freshness: 'generated',
          generated_at: '2026-05-28T00:00:00Z',
          generated_by: 'spec-mcp-setup',
          consumers: ['spec-first clean --workspace-orphans'],
          quarantined_paths: [
            {
              path: '.spec-first/graph/graph-facts.json',
              reason_code: 'parent-workspace-must-not-have-repo-local-graph',
              stale_indicator: 'parent-workspace-repo-local-artifact-present',
              last_generated_at: '2026-05-28T00:00:00Z',
              fingerprint_origin: '/tmp/project-a',
            },
          ],
        }, null, 2)}\n`,
        'utf8',
      );

      const before = snapshotTree(projectRoot);
      const result = captureCommand(projectRoot, runClean, ['--workspace-orphans']);
      const after = snapshotTree(projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(after).toEqual(before);
      expect(result.stdout).toContain('Parent workspace orphan artifact preview:');
      expect(result.stdout).toContain('.spec-first/graph/graph-facts.json (parent-workspace-must-not-have-repo-local-graph)');
      expect(result.stdout).toContain('Run `spec-first clean --workspace-orphans --confirm` to delete listed paths.');
      expect(result.stdout).toContain('No files were changed.');
      expect(fs.existsSync(graphFactsPath)).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('deletes supported quarantined paths only with explicit confirmation', () => {
    const projectRoot = makeTempDir();
    try {
      const workspaceDir = path.join(projectRoot, '.spec-first', 'workspace');
      const graphFactsPath = path.join(projectRoot, '.spec-first', 'graph', 'graph-facts.json');
      const graphIndexPath = path.join(projectRoot, '.gitnexus');
      const retiredProviderPath = path.join(projectRoot, '.spec-first', 'providers', 'code-review-graph');
      fs.mkdirSync(path.dirname(graphFactsPath), { recursive: true });
      fs.mkdirSync(graphIndexPath, { recursive: true });
      fs.mkdirSync(retiredProviderPath, { recursive: true });
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(graphFactsPath, '{"schema_version":"graph-facts.v1"}\n', 'utf8');
      fs.writeFileSync(path.join(graphIndexPath, 'meta.json'), '{"repoPath":"/tmp/old"}\n', 'utf8');
      fs.writeFileSync(path.join(retiredProviderPath, 'state.json'), '{}\n', 'utf8');
      fs.writeFileSync(
        path.join(workspaceDir, 'parent-artifact-quarantine.json'),
        `${JSON.stringify({
          schema_version: 'parent-artifact-quarantine.v1',
          topology: 'multi-repo-workspace',
          advisory: true,
          authority_level: 'advisory',
          freshness: 'generated',
          generated_at: '2026-05-28T00:00:00Z',
          generated_by: 'spec-mcp-setup',
          consumers: ['spec-first clean --workspace-orphans'],
          quarantined_paths: [
            {
              path: '.spec-first/graph/graph-facts.json',
              reason_code: 'foreign-absolute-path-stat-failed',
              stale_indicator: '/Users/old/project',
              last_generated_at: '2026-05-28T00:00:00Z',
              fingerprint_origin: '/Users/old/project',
            },
            {
              path: '.gitnexus/',
              reason_code: 'parent-workspace-must-not-have-graph-index',
              stale_indicator: 'parent-workspace-graph-index-present',
              last_generated_at: '2026-05-28T00:00:01Z',
              fingerprint_origin: '/tmp/old',
            },
            {
              path: '.spec-first/providers/code-review-graph/',
              reason_code: 'retired-provider-residue',
              stale_indicator: 'retired-code-review-graph-provider-directory-present',
              last_generated_at: null,
              fingerprint_origin: 'code-review-graph',
            },
          ],
        }, null, 2)}\n`,
        'utf8',
      );

      const result = captureCommand(projectRoot, runClean, ['--workspace-orphans', '--confirm']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Parent workspace orphan artifact preview:');
      expect(result.stdout).toContain('Deleted 3 workspace orphan path(s).');
      expect(result.stdout).not.toContain('No files were changed.');
      expect(fs.existsSync(graphFactsPath)).toBe(false);
      expect(fs.existsSync(graphIndexPath)).toBe(false);
      expect(fs.existsSync(retiredProviderPath)).toBe(false);
      expect(fs.existsSync(path.join(workspaceDir, 'parent-artifact-quarantine.json'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('fails closed when mixed with runtime clean mode or unsafe deletion target', () => {
    const projectRoot = makeTempDir();
    try {
      const mixed = captureCommand(projectRoot, runClean, ['--workspace-orphans', '--claude']);
      expect(mixed.exitCode).toBe(2);
      expect(mixed.stderr).toContain('--workspace-orphans cannot be combined with --claude or --codex');

      const invalidConfirm = captureCommand(projectRoot, runClean, ['--confirm']);
      expect(invalidConfirm.exitCode).toBe(2);
      expect(invalidConfirm.stderr).toContain('--confirm is only valid with --workspace-orphans');

      const sourcePath = path.join(projectRoot, 'src', 'index.js');
      const workspaceDir = path.join(projectRoot, '.spec-first', 'workspace');
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(sourcePath, 'module.exports = 1;\n', 'utf8');
      fs.writeFileSync(
        path.join(workspaceDir, 'parent-artifact-quarantine.json'),
        `${JSON.stringify({
          schema_version: 'parent-artifact-quarantine.v1',
          topology: 'multi-repo-workspace',
          advisory: true,
          authority_level: 'advisory',
          freshness: 'generated',
          generated_at: '2026-05-28T00:00:00Z',
          generated_by: 'spec-mcp-setup',
          consumers: ['spec-first clean --workspace-orphans'],
          quarantined_paths: [
            {
              path: 'src/index.js',
              reason_code: 'parent-workspace-must-not-have-repo-local-graph',
              stale_indicator: 'malformed-test-fixture',
              last_generated_at: null,
              fingerprint_origin: null,
            },
          ],
        }, null, 2)}\n`,
        'utf8',
      );
      const unsafe = captureCommand(projectRoot, runClean, ['--workspace-orphans', '--confirm']);
      expect(unsafe.exitCode).toBe(1);
      expect(unsafe.stderr).toContain('outside supported workspace orphan cleanup targets');
      expect(fs.existsSync(sourcePath)).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('requires a valid parent quarantine artifact', () => {
    const projectRoot = makeTempDir();
    try {
      const missing = captureCommand(projectRoot, runClean, ['--workspace-orphans']);
      expect(missing.exitCode).toBe(1);
      expect(missing.stderr).toContain('No parent artifact quarantine found.');

      const workspaceDir = path.join(projectRoot, '.spec-first', 'workspace');
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'parent-artifact-quarantine.json'),
        '{"schema_version":"wrong","quarantined_paths":[]}\n',
        'utf8',
      );
      const invalid = captureCommand(projectRoot, runClean, ['--workspace-orphans']);
      expect(invalid.exitCode).toBe(1);
      expect(invalid.stderr).toContain('schema_version must be parent-artifact-quarantine.v1');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
