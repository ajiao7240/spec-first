'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-ideate/SKILL.md');
const POST_IDEATION_PATH = path.join(
  REPO_ROOT,
  'skills/spec-ideate/references/post-ideation-workflow.md'
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function expectCoreContracts(runtimeSkill) {
  expect(runtimeSkill).toContain("Grounding in v1 relies on repo-owned research agents only.");
  expect(runtimeSkill).toContain('With 4-6 agents this yields about 28-48 raw ideas');
  expect(runtimeSkill).toContain('Dispatch ideation sub-agents on the inherited model.');
  expect(runtimeSkill).toContain('Omit the `mode` parameter');
}

describe('spec-ideate contracts', () => {
  test('source skill keeps internal naming and non-Slack ideation contracts', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: ideate-workflow');
    expect(skill).toContain('spec-first:research:learnings-researcher');
    expect(skill).toContain('spec-first:research:issue-intelligence-analyst');
    expect(skill).toContain("Grounding in v1 relies on repo-owned research agents only.");
    expect(skill).toContain('With 4-6 agents this yields about 28-48 raw ideas');
    expect(skill).toContain('Dispatch ideation sub-agents on the inherited model.');
    expect(skill).toContain('Do not tier down');
    expect(skill).toContain('Omit the `mode` parameter');
    expect(skill).toContain("the platform's cheapest capable model");
    expect(skill).toContain('Cap at 6 total frames');
    expect(skill).toContain('Synthesize cross-cutting combinations');
    expect(skill).not.toContain('slack-researcher');
    expect(skill).not.toContain('Slack context');
  });

  test('post-ideation reference preserves the explicit two-layer quality gate', () => {
    const reference = read(POST_IDEATION_PATH);

    expect(reference).toContain('Prefer a two-layer critique');
    expect(reference).toContain('skeptical sub-agents attack the merged list from distinct angles');
    expect(reference).toContain("final scoring authority belongs to the orchestrator");
    expect(reference).toContain('explicit quality gate');
    expect(reference).toContain("orchestrator's global judgment");
  });

  test('runtime transforms preserve host-specific ideate naming and agent adaptation', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-ideate' });

    expect(claudeRuntime).toContain('name: ideate-workflow');
    expect(claudeRuntime).toContain('`learnings-researcher`');
    expect(claudeRuntime).toContain('`issue-intelligence-analyst`');
    expect(claudeRuntime).not.toContain('spec-first:research:learnings-researcher');
    expect(claudeRuntime).not.toContain('spec-first:research:issue-intelligence-analyst');
    expectCoreContracts(claudeRuntime);

    expect(codexRuntime).toContain('name: spec-ideate');
    expect(codexRuntime).toContain('`.codex/agents/research/learnings-researcher.md`');
    expect(codexRuntime).toContain('`.codex/agents/research/issue-intelligence-analyst.md`');
    expect(codexRuntime).not.toContain('spec-first:research:learnings-researcher');
    expect(codexRuntime).not.toContain('spec-first:research:issue-intelligence-analyst');
    expectCoreContracts(codexRuntime);
  });
});
