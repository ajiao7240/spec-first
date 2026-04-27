'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');
const { runClean } = require('../../src/cli/commands/clean');

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
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

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
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

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
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);
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
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);
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
});
