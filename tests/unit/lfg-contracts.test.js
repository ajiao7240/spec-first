'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/lfg/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('lfg contracts', () => {
  test('source skill preserves upstream software-only gate and spec-first workflow upgrades', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: lfg');
    expect(skill).toContain('disable-model-invocation: true');

    // Upstream parity: pipeline must stop for non-software work instead of retry-looping plan generation.
    expect(skill).toContain('If `spec:plan` reported the task is non-software and cannot be processed in pipeline mode');
    expect(skill).toContain('LFG requires software tasks');

    // Core ordered pipeline remains intact after ce -> spec migration.
    expect(skill).toContain('/spec:plan $ARGUMENTS');
    expect(skill).toContain('/spec:work <plan-path-from-step-2>');
    expect(skill).toContain('/spec:review mode:autofix plan:<plan-path-from-step-2>');
    expect(skill).toContain('Load the `todo-resolve` skill');
    expect(skill).toContain('Load the `test-browser` skill');

    // Local enhancement retained.
    expect(skill).toContain('Load the `feature-video` skill');
    expect(skill).toContain('Output `<promise>DONE</promise>` when video is in PR');

    // No stale upstream command names.
    expect(skill).not.toContain('/ce:plan');
    expect(skill).not.toContain('/ce:work');
    expect(skill).not.toContain('/ce:review');
    expect(skill).not.toContain('/compound-engineering:todo-resolve');
    expect(skill).not.toContain('/compound-engineering:test-browser');
    expect(skill).not.toContain('/todo-resolve');
    expect(skill).not.toContain('/test-browser');
    expect(skill).not.toContain('/feature-video');
  });

  test('runtime transforms preserve lfg name and avoid stale upstream commands', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'lfg' });

    expect(claudeRuntime).toContain('name: lfg');
    expect(codexRuntime).toContain('name: lfg');

    expect(claudeRuntime).not.toContain('/ce:plan');
    expect(codexRuntime).not.toContain('/ce:plan');
  });
});
