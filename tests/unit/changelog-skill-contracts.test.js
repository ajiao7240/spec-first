'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/changelog/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('changelog skill contracts', () => {
  test('skill preserves identity, headless mode, and EVERY_WRITE_STYLE runtime dependency', () => {
    const skill = read(SKILL_PATH);

    // Skill identity
    expect(skill).toContain('name: changelog');

    // Headless mode prevents token burn on skill load
    expect(skill).toContain('disable-model-invocation: true');

    // Runtime dependency on every-style-editor — must remain for style review step
    // File lives at .claude/skills/every-style-editor/references/EVERY_WRITE_STYLE.md
    expect(skill).toContain('EVERY_WRITE_STYLE.md');

    // Core behavioral contract — changelog generation purpose
    expect(skill).toContain('merges to main branch');
    expect(skill).toContain('change_log');

    // Time period handling — argument-hint exposes these to skill discovery
    expect(skill).toContain('daily');
    expect(skill).toContain('weekly');

    // PR lookup mechanism — gh cli is how the skill fetches PR descriptions and labels
    // If upstream removes this, the skill can no longer analyze PR context
    expect(skill).toContain('gh cli');
  });
});
