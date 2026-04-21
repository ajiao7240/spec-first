'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');
const { runDoctor } = require('../../src/cli/commands/doctor');
const { runInit } = require('../../src/cli/commands/init');
const { inspectInstalledAssets } = require('../../src/cli/plugin');

function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-asset-integrity-'));
}

function captureDoctor(args) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = runDoctor(args);
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

describe('runtime asset integrity inspection', () => {
  test('Claude command wrapper drift is reported and downgrades doctor runtime asset health', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const commandPath = path.join(projectRoot, '.claude', 'commands', 'spec', 'work.md');
      const drifted = fs.readFileSync(commandPath, 'utf8')
        .split('stage0-context --stage work --workflow spec-work --format json')
        .join('stage0-context --stage work --workflow spec-plan --format json');
      fs.writeFileSync(commandPath, drifted, 'utf8');

      const adapter = getAdapter('claude');
      const installed = inspectInstalledAssets(projectRoot, adapter);

      expect(installed.commands.drifted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'work.md',
            issues: expect.arrayContaining([
              'missing_command_anchor:stage0-context --stage work --workflow spec-work --format json',
            ]),
          }),
        ]),
      );

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.runtime_asset_health).toBe('warn');
      expect(payload.platform_checks.claude).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '.claude/commands/spec',
            level: 'WARNING',
            message: expect.stringContaining('missing_command_anchor:stage0-context --stage work --workflow spec-work --format json'),
          }),
        ]),
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude workflow skill drift reports missing Stage-0 anchors', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const skillPath = path.join(projectRoot, '.claude', 'spec-first', 'workflows', 'spec-work', 'SKILL.md');
      const drifted = fs.readFileSync(skillPath, 'utf8')
        .split('stage0-context --stage work --workflow spec-work --format json')
        .join('stage0-context --stage work --workflow spec-plan --format json');
      fs.writeFileSync(skillPath, drifted, 'utf8');

      const adapter = getAdapter('claude');
      const installed = inspectInstalledAssets(projectRoot, adapter);

      expect(installed.skills.drifted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillName: 'spec-work',
            issues: expect.arrayContaining([
              'missing_anchor:stage0-context --stage work --workflow spec-work --format json',
            ]),
          }),
        ]),
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude graph-bootstrap command drift reports missing boundary semantics and warns in doctor', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const commandPath = path.join(projectRoot, '.claude', 'commands', 'spec', 'graph-bootstrap.md');
      const drifted = fs.readFileSync(commandPath, 'utf8')
        .split('package CLI surfaces')
        .join('package runtime summary')
        .split('不要在 target repo 中查找 source repo 内部路径来判断 workflow 是否可用')
        .join('可根据需要检查源码仓库路径');
      fs.writeFileSync(commandPath, drifted, 'utf8');

      const adapter = getAdapter('claude');
      const installed = inspectInstalledAssets(projectRoot, adapter);

      expect(installed.commands.drifted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'graph-bootstrap.md',
            issues: expect.arrayContaining([
              'missing_command_anchor:package CLI surfaces',
              'missing_command_anchor:不要在 target repo 中查找 source repo 内部路径来判断 workflow 是否可用',
            ]),
          }),
        ]),
      );

      const result = withCwd(projectRoot, () => captureDoctor(['--claude', '--json']));
      const payload = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(payload.runtime_asset_health).toBe('warn');
      expect(payload.platform_checks.claude).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '.claude/commands/spec',
            level: 'WARNING',
            message: expect.stringContaining('missing_command_anchor:package CLI surfaces'),
          }),
        ]),
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex runtime skill drift reports unre-written host paths', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const skillPath = path.join(projectRoot, '.agents', 'skills', 'spec-work', 'SKILL.md');
      const drifted = `${fs.readFileSync(skillPath, 'utf8')}\nReference legacy path: .claude/spec-first/workflows/spec-work/SKILL.md\n`;
      fs.writeFileSync(skillPath, drifted, 'utf8');

      const adapter = getAdapter('codex');
      const installed = inspectInstalledAssets(projectRoot, adapter);

      expect(installed.skills.drifted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillName: 'spec-work',
            issues: expect.arrayContaining(['codex_path_rewrite_drift']),
          }),
        ]),
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex graph-bootstrap runtime skill drift reports missing boundary semantics', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const skillPath = path.join(projectRoot, '.agents', 'skills', 'spec-graph-bootstrap', 'SKILL.md');
      const drifted = fs.readFileSync(skillPath, 'utf8')
        .split('package CLI surfaces')
        .join('package runtime summary')
        .split('不要在 target repo 中查找 source repo 内部路径来判断 workflow 是否可用')
        .join('可根据需要检查源码仓库路径');
      fs.writeFileSync(skillPath, drifted, 'utf8');

      const adapter = getAdapter('codex');
      const installed = inspectInstalledAssets(projectRoot, adapter);

      expect(installed.skills.drifted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillName: 'spec-graph-bootstrap',
            issues: expect.arrayContaining([
              'missing_anchor:package CLI surfaces',
              'missing_anchor:不要在 target repo 中查找 source repo 内部路径来判断 workflow 是否可用',
            ]),
          }),
        ]),
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
