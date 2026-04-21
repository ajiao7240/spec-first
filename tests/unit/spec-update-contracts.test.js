'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-update/SKILL.md');
const COMMAND_PATH = path.join(REPO_ROOT, 'templates/claude/commands/spec/update.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-update contracts', () => {
  test('source skill preserves npm version check plus project runtime repair matrix', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: update-workflow');
    expect(skill).toContain('Current CLI version');
    expect(skill).toContain('Latest released version');
    expect(skill).toContain('Claude runtime state');
    expect(skill).toContain('Codex runtime state');
    expect(skill).toContain('spec-first init --claude');
    expect(skill).toContain('spec-first init --codex');
    expect(skill).toContain('spec-first clean --claude');
    expect(skill).toContain('spec-first clean --codex');
    expect(skill).toContain('spec-first doctor');
    expect(skill).not.toContain('CLAUDE_PLUGIN_ROOT');
    expect(skill).not.toContain('compound-engineering');
  });

  test('source skill can inspect repo-local source checkout before declaring CLI unavailable', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('spec-first --version');
    expect(skill).toContain('bin/spec-first.js --version');
    expect(skill).toContain('"$repo/package.json"');
    expect(skill).toContain('repo-local source checkout');
    expect(skill).toContain('both PATH-based CLI inspection and repo-local source checkout inspection failed');
  });

  test('command template points at the paired source skill', () => {
    const command = read(COMMAND_PATH);

    expect(command).toContain('Spec-First Update');
    expect(command).toContain('skills/spec-update/SKILL.md');
    expect(command).not.toContain('.claude/spec-first/workflows/spec-update/SKILL.md');
  });

  test('runtime transforms preserve host-specific skill naming', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-update' });

    expect(claudeRuntime).toContain('name: update-workflow');
    expect(codexRuntime).toContain('name: spec-update');
    expect(claudeRuntime).not.toContain('compound-engineering');
    expect(codexRuntime).not.toContain('compound-engineering');
  });
});
