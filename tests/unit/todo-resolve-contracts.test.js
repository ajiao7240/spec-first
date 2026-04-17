'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/todo-resolve/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('todo-resolve contracts', () => {
  test('skill preserves spec-first todo paths and downstream workflow integrations', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Scan `docs/todos/*.md` (canonical), `.context/spec-first/todos/*.md` (legacy-v2), and `todos/*.md` (legacy-v1).');
    expect(skill).toContain('Residual actionable work from `spec:review mode:autofix`');
    expect(skill).toContain('Spawn a `spec-first:workflow:pr-comment-resolver` agent per item.');
    expect(skill).toContain('Load the `spec:compound` workflow');
    expect(skill).toContain('Delete completed/resolved todo files from all three paths.');
    expect(skill).toContain('load the `todo-triage` skill to approve');

    expect(skill).not.toContain('.context/compound-engineering/todos/');
    expect(skill).not.toContain('compound-engineering:workflow:pr-comment-resolver');
    expect(skill).not.toContain('`ce:review mode:autofix`');
    expect(skill).not.toContain('`ce:compound`');
    expect(skill).not.toContain('/todo-triage');
  });
});
