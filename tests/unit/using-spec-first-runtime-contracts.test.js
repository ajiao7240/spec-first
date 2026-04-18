'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');
const { runClean } = require('../../src/cli/commands/clean');
const { getAdapter } = require('../../src/cli/adapters');
const { readState } = require('../../src/cli/state');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-using-spec-first-'));
}

describe('using-spec-first runtime contracts', () => {
  test('Claude init installs using-spec-first as a managed standalone skill and tracks it in state', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);

      const adapter = getAdapter('claude');
      const runtimeSkillPath = path.join(projectRoot, '.claude/skills/using-spec-first/SKILL.md');
      const state = readState(projectRoot, adapter);

      expect(fs.existsSync(runtimeSkillPath)).toBe(true);
      expect(state.skills).toContain('using-spec-first');
      expect(fs.readFileSync(runtimeSkillPath, 'utf8')).toContain('name: using-spec-first');
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init installs using-spec-first as a managed standalone skill and tracks it in state', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--codex', '-u', 'reviewer', '--lang', 'en'])).toBe(0);

      const adapter = getAdapter('codex');
      const runtimeSkillPath = path.join(projectRoot, '.agents/skills/using-spec-first/SKILL.md');
      const state = readState(projectRoot, adapter);

      expect(fs.existsSync(runtimeSkillPath)).toBe(true);
      expect(state.skills).toContain('using-spec-first');
      expect(fs.readFileSync(runtimeSkillPath, 'utf8')).toContain('name: using-spec-first');
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('clean removes managed using-spec-first runtime skill for Claude without touching custom skills', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);

      const customSkillPath = path.join(projectRoot, '.claude/skills/custom-skill/SKILL.md');
      fs.mkdirSync(path.dirname(customSkillPath), { recursive: true });
      fs.writeFileSync(customSkillPath, 'name: custom-skill\n', 'utf8');

      expect(runClean(['--claude'])).toBe(0);

      expect(fs.existsSync(path.join(projectRoot, '.claude/skills/using-spec-first'))).toBe(false);
      expect(fs.existsSync(customSkillPath)).toBe(true);
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
