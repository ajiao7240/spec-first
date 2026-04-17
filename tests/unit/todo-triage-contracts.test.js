'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/todo-triage/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('todo-triage contracts', () => {
  test('skill preserves spec-first multi-path todo discovery and resolve handoff', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Read all pending todos from `docs/todos/` (canonical), `.context/spec-first/todos/` (legacy-v2), and `todos/` (legacy-v1) directories');
    expect(skill).toContain('implementation happens in the `todo-resolve` skill');
    expect(skill).toContain("current host's fast/low-cost model");
    expect(skill).toContain('load the `todo-resolve` skill to resolve the todos');

    expect(skill).not.toContain('.context/compound-engineering/todos/');
    expect(skill).not.toContain('/ce:');
    expect(skill).not.toContain('/model');
    expect(skill).not.toContain('Haiku');
    expect(skill).not.toContain('/todo-resolve');
  });
});
