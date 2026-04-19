'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-debug/SKILL.md');
const COMMAND_PATH = path.join(REPO_ROOT, 'templates/claude/commands/spec/debug.md');
const ANTI_PATTERNS_PATH = path.join(
  REPO_ROOT,
  'skills/spec-debug/references/anti-patterns.md',
);
const INVESTIGATION_TECHNIQUES_PATH = path.join(
  REPO_ROOT,
  'skills/spec-debug/references/investigation-techniques.md',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-debug contracts', () => {
  test('source skill preserves debug workflow, causal-chain gate, and spec-first handoffs', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: debug-workflow');
    expect(skill).toContain('Investigate before fixing.');
    expect(skill).toContain('Predictions for uncertain links.');
    expect(skill).toContain('One change at a time.');
    expect(skill).toContain('Causal chain gate');
    expect(skill).toContain('3 failed fix attempts = smart escalation.');
    expect(skill).toContain('/spec:brainstorm');
    expect(skill).toContain('/spec:compound');
    expect(skill).toContain('load the `proof` skill');
    expect(skill).toContain('agent-browser');
    expect(skill).toContain('Restated Understanding');
    expect(skill).toContain('Current Core Goal');
    expect(skill).toContain('Scope / Non-goals');
    expect(skill).toContain('Verification-as-Done');
    expect(skill).not.toContain('/ce:brainstorm');
    expect(skill).not.toContain('/ce:compound');
    expect(skill).not.toContain('/proof');
  });

  test('command template and references are bundled', () => {
    const command = read(COMMAND_PATH);
    const antiPatterns = read(ANTI_PATTERNS_PATH);
    const investigationTechniques = read(INVESTIGATION_TECHNIQUES_PATH);

    expect(command).toContain('Spec-First Debug');
    expect(command).toContain('.claude/spec-first/workflows/spec-debug/SKILL.md');
    expect(antiPatterns).toContain('Shotgun Debugging');
    expect(investigationTechniques).toContain('Intermittent Bug Techniques');
  });

  test('runtime transforms preserve host-specific skill naming', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-debug' });

    expect(claudeRuntime).toContain('name: debug-workflow');
    expect(claudeRuntime).not.toContain('/ce:brainstorm');
    expect(claudeRuntime).not.toContain('/ce:compound');

    expect(codexRuntime).toContain('name: spec-debug');
    expect(codexRuntime).not.toContain('/ce:brainstorm');
    expect(codexRuntime).not.toContain('/ce:compound');
  });
});
