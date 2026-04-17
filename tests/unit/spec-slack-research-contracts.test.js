'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-slack-research/SKILL.md');
const AGENT_PATH = path.join(REPO_ROOT, 'agents/research/slack-researcher.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-slack-research contracts', () => {
  test('source skill dispatches the spec-first Slack researcher', () => {
    const skill = read(SKILL_PATH);
    const agent = read(AGENT_PATH);

    expect(skill).toContain('name: spec-slack-research');
    expect(skill).toContain('spec-first:research:slack-researcher');
    expect(skill).not.toContain('compound-engineering:research:slack-researcher');
    expect(skill).not.toContain('/ce-slack-research');
    expect(agent).toContain('name: slack-researcher');
    expect(agent).toContain('model: inherit');
    expect(agent).toContain('slack_search_public_and_private');
  });

  test('runtime transforms preserve host-specific Slack researcher references', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-slack-research' });

    expect(claudeRuntime).toContain('slack-researcher');
    expect(claudeRuntime).not.toContain('spec-first:research:slack-researcher');
    expect(codexRuntime).toContain('.codex/agents/research/slack-researcher.md');
    expect(codexRuntime).not.toContain('spec-first:research:slack-researcher');
  });
});
