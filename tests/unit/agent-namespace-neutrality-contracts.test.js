'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('agent namespace neutrality contracts', () => {
  test('git-history-analyzer protects long-lived workflow artifacts without hard-coding command names', () => {
    const agent = read('agents/research/git-history-analyzer.md');

    expect(agent).toContain("long-lived planning and knowledge artifacts maintained by the project's workflow");
    expect(agent).not.toContain('/spec:plan');
    expect(agent).not.toContain('/ce:plan');
  });

  test('issue-intelligence-analyst uses workflow-neutral ideation handoff wording', () => {
    const agent = read('agents/research/issue-intelligence-analyst.md');

    expect(agent).toContain("The project's ideation workflow");
    expect(agent).not.toContain('spec:ideate');
    expect(agent).not.toContain('ce:ideate');
  });

  test('session-historian describes compound enrichment without hard-coded command names', () => {
    const agent = read('agents/research/session-historian.md');

    expect(agent).toContain("the project's compound workflow");
    expect(agent).toContain("The project's compound documentation workflow");
    expect(agent).not.toContain('/spec:compound');
    expect(agent).not.toContain('/ce:compound');
  });

  test('code-simplicity-reviewer protects workflow artifacts with neutral wording', () => {
    const agent = read('agents/review/code-simplicity-reviewer.md');

    expect(agent).toContain("long-lived planning and knowledge artifacts maintained by the project's workflow as living documents");
    expect(agent).not.toContain('/spec:plan');
    expect(agent).not.toContain('/spec:work');
    expect(agent).not.toContain('/ce:plan');
    expect(agent).not.toContain('/ce:work');
  });

  test('project-standards-reviewer uses subtree and fully-qualified-name examples without hard-coded product namespace', () => {
    const agent = read('agents/review/project-standards-reviewer.md');

    expect(agent).toContain('A standards file in a parent directory governs all changes under that subtree.');
    expect(agent).toContain("the project's fully qualified agent name");
    expect(agent).not.toContain('plugins/spec-first/AGENTS.md');
    expect(agent).not.toContain('plugins/compound-engineering/AGENTS.md');
    expect(agent).not.toContain('spec-first:research:learnings-researcher');
    expect(agent).not.toContain('compound-engineering:research:learnings-researcher');
  });

  test('learnings-researcher keeps schema and planning references workflow-neutral while preserving current schema support', () => {
    const agent = read('agents/research/learnings-researcher.md');

    expect(agent).toContain("the current project's compound documentation schema references");
    expect(agent).toContain("The project's planning workflow");
    expect(agent).not.toContain('../../skills/spec-compound/references/yaml-schema.md');
    expect(agent).not.toContain('../../skills/ce-compound/references/yaml-schema.md');
    expect(agent).not.toContain('/spec:plan');
    expect(agent).not.toContain('/ce:plan');
  });
});
