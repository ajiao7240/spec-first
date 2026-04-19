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

function expectStage0RuntimeContract(content, { stage, minimalContextPath }) {
  expect(content).toContain('context-routing.json');
  expect(content).toContain('artifact-manifest.json');
  expect(content).toContain(minimalContextPath);
  expect(content).toContain('selection_subject / selected_contexts');
  expect(content).toContain('selected_assets / fallback_reason / level / skipped_rules');
  expect(content).toContain('compatibility view');
  expect(content).toContain('injection-index.yaml');
  expect(content).toContain('仅作为人类视图');
  expect(content).toContain('stage0-context --stage');
  expect(content).toContain(`--stage ${stage}`);
  expect(content).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
  expect(content).not.toContain('按 yaml 路由加载文件');
}

describe('using-spec-first runtime contracts', () => {
  test('Claude init installs using-spec-first runtime skill, bootstrap block, hook, and managed SessionStart matcher', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);

      const adapter = getAdapter('claude');
      const runtimeSkillPath = path.join(projectRoot, '.claude/skills/using-spec-first/SKILL.md');
      const hookPath = path.join(projectRoot, '.claude/hooks/session-start');
      const settingsPath = path.join(projectRoot, '.claude/settings.json');
      const state = readState(projectRoot, adapter);

      expect(fs.existsSync(runtimeSkillPath)).toBe(true);
      expect(fs.existsSync(hookPath)).toBe(true);
      const instruction = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8');
      expect(instruction).toContain('<!-- spec-first:bootstrap:start -->');
      expect(instruction).toContain('<!-- spec-first:coding-guidelines:start -->');
      expect(instruction.indexOf('<!-- spec-first:lang:start -->'))
        .toBeLessThan(instruction.indexOf('<!-- spec-first:bootstrap:start -->'));
      expect(instruction.indexOf('<!-- spec-first:bootstrap:start -->'))
        .toBeLessThan(instruction.indexOf('<!-- spec-first:coding-guidelines:start -->'));
      expect(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))).toEqual({
        hooks: {
          SessionStart: [
            {
              matcher: 'startup|resume|clear|compact',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start',
                },
              ],
            },
          ],
        },
      });
      expect(state.skills).toContain('using-spec-first');
      expect(fs.readFileSync(runtimeSkillPath, 'utf8')).toContain('name: using-spec-first');
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init installs using-spec-first runtime skill and bootstrap block without inventing hook assets', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--codex', '-u', 'reviewer', '--lang', 'en'])).toBe(0);

      const adapter = getAdapter('codex');
      const runtimeSkillPath = path.join(projectRoot, '.agents/skills/using-spec-first/SKILL.md');
      const state = readState(projectRoot, adapter);
      const instruction = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');

      expect(fs.existsSync(runtimeSkillPath)).toBe(true);
      expect(instruction).toContain('<!-- spec-first:bootstrap:start -->');
      expect(instruction).toContain('<!-- spec-first:coding-guidelines:start -->');
      expect(instruction.indexOf('<!-- spec-first:lang:start -->'))
        .toBeLessThan(instruction.indexOf('<!-- spec-first:bootstrap:start -->'));
      expect(instruction.indexOf('<!-- spec-first:bootstrap:start -->'))
        .toBeLessThan(instruction.indexOf('<!-- spec-first:coding-guidelines:start -->'));
      expect(fs.existsSync(path.join(projectRoot, '.codex/hooks'))).toBe(false);
      expect(state.skills).toContain('using-spec-first');
      expect(fs.readFileSync(runtimeSkillPath, 'utf8')).toContain('name: using-spec-first');
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude init 生成的 plan/work/review runtime skills 保持 Stage-0 control-plane 真源口径', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);

      const planSkill = fs.readFileSync(
        path.join(projectRoot, '.claude/spec-first/workflows/spec-plan/SKILL.md'),
        'utf8'
      );
      const workSkill = fs.readFileSync(
        path.join(projectRoot, '.claude/spec-first/workflows/spec-work/SKILL.md'),
        'utf8'
      );
      const reviewSkill = fs.readFileSync(
        path.join(projectRoot, '.claude/spec-first/workflows/spec-review/SKILL.md'),
        'utf8'
      );

      expectStage0RuntimeContract(planSkill, {
        stage: 'plan',
        minimalContextPath: 'minimal-context/plan.json',
      });
      expectStage0RuntimeContract(workSkill, {
        stage: 'work',
        minimalContextPath: 'minimal-context/work.json',
      });
      expectStage0RuntimeContract(reviewSkill, {
        stage: 'review',
        minimalContextPath: 'minimal-context/review.json',
      });
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init 生成的 plan/work/review runtime skills 保持 Stage-0 control-plane 真源口径', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--codex', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);

      const planSkill = fs.readFileSync(
        path.join(projectRoot, '.agents/skills/spec-plan/SKILL.md'),
        'utf8'
      );
      const workSkill = fs.readFileSync(
        path.join(projectRoot, '.agents/skills/spec-work/SKILL.md'),
        'utf8'
      );
      const reviewSkill = fs.readFileSync(
        path.join(projectRoot, '.agents/skills/spec-review/SKILL.md'),
        'utf8'
      );

      expectStage0RuntimeContract(planSkill, {
        stage: 'plan',
        minimalContextPath: 'minimal-context/plan.json',
      });
      expectStage0RuntimeContract(workSkill, {
        stage: 'work',
        minimalContextPath: 'minimal-context/work.json',
      });
      expectStage0RuntimeContract(reviewSkill, {
        stage: 'review',
        minimalContextPath: 'minimal-context/review.json',
      });
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('clean removes managed using-spec-first assets for Claude without touching custom hooks, settings, or skills', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);

      const customSkillPath = path.join(projectRoot, '.claude/skills/custom-skill/SKILL.md');
      const customHookPath = path.join(projectRoot, '.claude/hooks/custom-start');
      const settingsPath = path.join(projectRoot, '.claude/settings.json');
      fs.mkdirSync(path.dirname(customSkillPath), { recursive: true });
      fs.writeFileSync(customSkillPath, 'name: custom-skill\n', 'utf8');
      fs.writeFileSync(customHookPath, '#!/bin/bash\n', 'utf8');
      fs.writeFileSync(settingsPath, `${JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: 'startup|resume|clear|compact',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start',
                },
              ],
            },
            {
              matcher: 'startup',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/custom-start',
                },
              ],
            },
          ],
        },
      }, null, 2)}\n`, 'utf8');

      expect(runClean(['--claude'])).toBe(0);

      expect(fs.existsSync(path.join(projectRoot, '.claude/skills/using-spec-first'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, '.claude/hooks/session-start'))).toBe(false);
      expect(fs.existsSync(customSkillPath)).toBe(true);
      expect(fs.existsSync(customHookPath)).toBe(true);
      const instruction = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8');
      expect(instruction).not.toContain('<!-- spec-first:bootstrap:start -->');
      expect(instruction).not.toContain('<!-- spec-first:coding-guidelines:start -->');
      expect(instruction).toContain('<!-- spec-first:lang:start -->');
      expect(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))).toEqual({
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/custom-start',
                },
              ],
            },
          ],
        },
      });
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude init appends managed instruction blocks to existing user content instead of overwriting it', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      fs.writeFileSync(
        path.join(projectRoot, 'CLAUDE.md'),
        '# Existing Notes\n\nProject-specific guidance.\n',
        'utf8',
      );

      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);

      const instruction = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8');
      expect(instruction).toContain('# Existing Notes');
      expect(instruction).toContain('Project-specific guidance.');
      expect(instruction.indexOf('# Existing Notes')).toBeLessThan(instruction.indexOf('<!-- spec-first:lang:start -->'));
      expect(instruction.indexOf('<!-- spec-first:lang:start -->'))
        .toBeLessThan(instruction.indexOf('<!-- spec-first:bootstrap:start -->'));
      expect(instruction.indexOf('<!-- spec-first:bootstrap:start -->'))
        .toBeLessThan(instruction.indexOf('<!-- spec-first:coding-guidelines:start -->'));
      expect(instruction.trim().endsWith('<!-- spec-first:coding-guidelines:end -->')).toBe(true);
    } finally {
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude init fails before side effects when .claude/settings.json is invalid', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, '.claude/settings.json'), '{"hooks":', 'utf8');

      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(1);

      expect(fs.existsSync(path.join(projectRoot, '.claude/spec-first/state.json'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, '.claude/commands/spec'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, '.claude/hooks/session-start'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, '.claude/spec-first/.developer'))).toBe(false);
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude re-init fails before destructive managed cleanup when .claude/settings.json is invalid', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);
      const runtimeSkillPath = path.join(projectRoot, '.claude/skills/using-spec-first/SKILL.md');
      const hookPath = path.join(projectRoot, '.claude/hooks/session-start');
      const statePath = path.join(projectRoot, '.claude/spec-first/state.json');
      fs.writeFileSync(path.join(projectRoot, '.claude/settings.json'), '{"hooks":', 'utf8');

      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(1);

      expect(fs.existsSync(runtimeSkillPath)).toBe(true);
      expect(fs.existsSync(hookPath)).toBe(true);
      expect(fs.existsSync(statePath)).toBe(true);
      expect(fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8')).toContain('<!-- spec-first:bootstrap:start -->');
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude clean fails before removals when .claude/settings.json is invalid', () => {
    const projectRoot = makeTempDir();
    const previousCwd = process.cwd();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.chdir(projectRoot);
      expect(runInit(['--claude', '-u', 'reviewer', '--lang', 'zh'])).toBe(0);
      fs.writeFileSync(path.join(projectRoot, '.claude/settings.json'), '{"hooks":', 'utf8');

      expect(runClean(['--claude'])).toBe(1);

      expect(fs.existsSync(path.join(projectRoot, '.claude/skills/using-spec-first/SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.claude/hooks/session-start'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.claude/spec-first/state.json'))).toBe(true);
      expect(fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8')).toContain('<!-- spec-first:bootstrap:start -->');
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
