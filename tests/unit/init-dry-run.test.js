'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-dry-run-'));
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

function captureInit(cwd, args) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = withCwd(cwd, () => runInit(args));
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

describe('init --dry-run', () => {
  test('Claude init --dry-run previews prune/write actions without mutating the project', () => {
    const projectRoot = makeTempDir();

    try {
      fs.mkdirSync(path.join(projectRoot, '.claude', 'commands', 'spec'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, '.claude', 'commands', 'spec', 'custom.md'),
        'custom command\n',
        'utf8',
      );

      const before = snapshotTree(projectRoot);
      const result = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);
      const after = snapshotTree(projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(after).toEqual(before);
      expect(result.stdout).toContain('Dry run: spec-first init (claude)');
      expect(result.stdout).toContain('Would prune 1 unmanaged command file(s)');
      expect(result.stdout).toContain('.claude/commands/spec/custom.md');
      expect(result.stdout).toContain('Would ensure');
      expect(result.stdout).toContain('Would write/update');
      expect(result.stdout).toContain('.claude/commands/spec/work.md');
      expect(result.stdout).toContain('.claude/spec-first/workflows/spec-work/SKILL.md');
      expect(result.stdout).toContain('.claude/agents/review/security-reviewer.md');
      expect(result.stdout).toContain('CLAUDE.md');
      expect(result.stdout).toContain('.claude/hooks/session-start');
      expect(result.stdout).toContain('.claude/spec-first/state.json');
      expect(result.stdout).toContain('.spec-first/specs/repo-profile.yaml');
      expect(result.stdout).toContain('.spec-first/specs/README.md');
      expect(result.stdout).toContain('No files were changed.');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude init apply materializes the high-value paths promised by dry-run', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const dryRun = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);
      expect(dryRun.exitCode).toBe(0);

      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      for (const relativePath of [
        '.claude/commands/spec/work.md',
        '.claude/spec-first/workflows/spec-work/SKILL.md',
        '.claude/agents/review/security-reviewer.md',
        '.claude/hooks/session-start',
        '.claude/settings.json',
        '.claude/spec-first/state.json',
        '.spec-first/specs/repo-profile.yaml',
        '.spec-first/specs/README.md',
        'CLAUDE.md',
      ]) {
        expect(dryRun.stdout).toContain(relativePath);
        expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(true);
      }

      const profileContents = fs.readFileSync(path.join(projectRoot, '.spec-first/specs/repo-profile.yaml'), 'utf8');
      expect(profileContents).toContain('schema_version: 1');
      expect(profileContents).toContain('repo_id: "');
      expect(profileContents).toContain('languages: ');
      expect(profileContents).toContain('project_type: "');
      expect(profileContents).toContain('project_intent:');
      expect(profileContents).toContain('principles: []');
      expect(profileContents).toContain('non_negotiables: []');
      expect(profileContents).toContain('review_defaults: []');
      expect(profileContents).not.toContain('unknown');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('current runtime drift switches dry-run into managed hard reset preview', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      fs.mkdirSync(path.join(projectRoot, '.claude', 'commands', 'spec'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, '.claude', 'commands', 'spec', 'custom.md'),
        'custom command\n',
        'utf8',
      );

      const commandPath = path.join(projectRoot, '.claude', 'commands', 'spec', 'work.md');
      const drifted = fs.readFileSync(commandPath, 'utf8')
        .replace(
          'stage0-context --stage work --workflow spec-work --format json',
          'stage0-context --stage work --workflow spec-plan --format json',
        );
      fs.writeFileSync(commandPath, drifted, 'utf8');

      const result = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Would perform a managed hard reset before regenerating runtime assets');
      expect(result.stdout).toContain('current runtime drift detected');
      expect(result.stdout).toContain('.claude/commands/spec/work.md');
      expect(result.stdout).toContain('Would prune 1 unmanaged command file(s)');
      expect(result.stdout).toContain('.claude/commands/spec/custom.md');
      expect(result.stdout).toContain('.claude/spec-first/workflows/spec-work/SKILL.md');
    } finally {
      warnSpy.mockRestore();
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
