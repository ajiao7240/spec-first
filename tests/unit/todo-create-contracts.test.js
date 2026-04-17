'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/todo-create/SKILL.md');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'skills/todo-create/assets/todo-template.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('todo-create contracts', () => {
  test('skill preserves spec-first todo path migration consistently across all workflow steps', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('`docs/todos/` (canonical), `.context/spec-first/todos/` (legacy-v2), and `todos/` (legacy-v1)');
    expect(skill).toContain('Search all three paths for `[0-9]*-*.md`');
    expect(skill).toContain('Glob `*-pending-*.md` in all three paths.');
    expect(skill).toContain('search for `{dep_id}-complete-*.md` in all three paths');
    expect(skill).toContain('/spec:review');
    expect(skill).toContain('`todo-triage` skill');

    expect(skill).not.toContain('.context/compound-engineering/todos/');
    expect(skill).not.toContain('/ce:review');
    expect(skill).not.toContain('/todo-triage');
    expect(skill).not.toContain('/todo-resolve');
  });

  test('todo template remains present for durable file-based workflow', () => {
    const template = read(TEMPLATE_PATH);

    expect(template).toContain('## Problem Statement');
    expect(template).toContain('## Acceptance Criteria');
    expect(template).toContain('## Work Log');
  });
});
