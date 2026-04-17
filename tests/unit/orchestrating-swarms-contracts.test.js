'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/orchestrating-swarms/SKILL.md');
const SPEC_WORK_PATH = path.join(REPO_ROOT, 'skills/spec-work/SKILL.md');
const SPEC_WORK_BETA_PATH = path.join(REPO_ROOT, 'skills/spec-work-beta/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('orchestrating-swarms contracts', () => {
  test('source skill preserves Claude-host-specific orchestration boundary', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: orchestrating-swarms');
    expect(skill).toContain('disable-model-invocation: true');
    expect(skill).toContain("Claude Code's TeammateTool and Task system");
    expect(skill).toContain('`~/.claude/teams/{name}/config.json`');
    expect(skill).toContain('Claude Code host-specific orchestration skill');
    expect(skill).toContain('stay in `spec-work` or `spec-work-beta` and use standard subagent dispatch');
    expect(skill).toContain('not** a replacement for `spec-work`, `spec-work-beta`, or `lfg`');
  });

  test('runtime transforms keep agent references host-appropriate', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, {
      skillName: 'orchestrating-swarms',
    });

    expect(claudeRuntime).toContain('subagent_type: "security-sentinel"');
    expect(claudeRuntime).not.toContain('subagent_type: "spec-first:review:security-sentinel"');

    expect(codexRuntime).toContain('`.codex/agents/review/security-sentinel.md`');
    expect(codexRuntime).not.toContain('spec-first:review:security-sentinel');
  });

  test('spec-work workflows keep swarm mode opt-in and route Claude team mechanics here', () => {
    const specWork = read(SPEC_WORK_PATH);
    const specWorkBeta = read(SPEC_WORK_BETA_PATH);

    expect(specWork).toContain('Agent teams are typically experimental and require opt-in.');
    expect(specWork).toContain('route to `orchestrating-swarms`');

    expect(specWorkBeta).toContain('Agent teams are typically experimental and require opt-in.');
    expect(specWorkBeta).toContain('route to `orchestrating-swarms`');
  });
});
