'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-repo-profile-refresh/SKILL.md');
const MIRROR_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-repo-profile-refresh/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-repo-profile-refresh contracts', () => {
  test('source skill keeps standalone preview-first repo-profile refresh boundary', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: spec-repo-profile-refresh');
    expect(skill).toContain('.spec-first/specs/repo-profile.yaml');
    expect(skill).toContain('This is a standalone skill, not a `/spec:*` workflow command.');
    expect(skill).toContain('`spec-graph-bootstrap` is recommended upstream context, not a hard prerequisite.');
    expect(skill).toContain('Default mode is `preview`');
    expect(skill).toContain('`apply` is allowed only after preview or explicit user confirmation');
    expect(skill).toContain('project_intent.summary');
    expect(skill).toContain('principles');
    expect(skill).toContain('non_negotiables');
    expect(skill).toContain('review_defaults');
    expect(skill).toContain('repo_id');
    expect(skill).toContain('languages');
    expect(skill).toContain('project_type');
    expect(skill).toContain('runtime state');
    expect(skill).toContain('workflow state');
    expect(skill).toContain('gate state');
    expect(skill).toContain('verifier dispatch');
    expect(skill).toContain('task-specific requirements');
    expect(skill).toContain('This skill does not auto-trigger from `init`, `spec-plan`, `spec-work`, or `spec-review`');
    expect(skill).toContain('do not block execution just because `spec-graph-bootstrap` has not run yet');
    expect(skill).toContain('`spec-plan` may consume `.spec-first/specs/repo-profile.yaml` as optional repo-level planning input');

    expect(skill).not.toContain('/spec:repo-profile-refresh');
  });

  test('runtime transforms preserve host-specific standalone naming without inventing commands', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-repo-profile-refresh' });

    expect(claudeRuntime).toContain('name: spec-repo-profile-refresh');
    expect(codexRuntime).toContain('name: spec-repo-profile-refresh');
    expect(claudeRuntime).not.toContain('/spec:repo-profile-refresh');
    expect(codexRuntime).not.toContain('/spec:repo-profile-refresh');
  });

  test('prompt mirror keeps preview/apply and protected-field contracts aligned', () => {
    const mirror = read(MIRROR_PATH);

    expect(mirror).toContain('Default mode is `preview`');
    expect(mirror).toContain('`apply` is allowed only after preview or explicit user confirmation');
    expect(mirror).toContain('`spec-graph-bootstrap` is recommended upstream context, not a hard prerequisite.');
    expect(mirror).toContain('project_intent.summary');
    expect(mirror).toContain('principles');
    expect(mirror).toContain('non_negotiables');
    expect(mirror).toContain('review_defaults');
    expect(mirror).toContain('repo_id');
    expect(mirror).toContain('languages');
    expect(mirror).toContain('project_type');
    expect(mirror).toContain('runtime state');
    expect(mirror).toContain('workflow state');
    expect(mirror).toContain('gate state');
    expect(mirror).toContain('This is a standalone skill, not a `/spec:*` workflow command.');
  });
});
