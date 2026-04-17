'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-bootstrap/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-bootstrap contracts', () => {
  test('skill keeps Stage-0 supporting-workflow narrative and does not claim automatic main-workflow injection', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('This is a **Stage-0 supporting workflow**');
    expect(skill).toContain('It is not a sixth stage of the main workflow');
    expect(skill).toContain('Automatic injection into the five-stage workflow is a future capability.');
    expect(skill).toContain('**Claude entry point:** `/spec:bootstrap [target-repo-path-or-slug]`');
    expect(skill).toContain('**Codex entry point:** `$spec-bootstrap [target-repo-path-or-slug]`');

    expect(skill).not.toContain('已自动注入主工作流');
  });
});
