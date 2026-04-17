'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/git-commit/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('git-commit contracts', () => {
  test('skill preserves context-preload and fallback contracts from upstream', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('## Context');
    expect(skill).toContain('If you are Claude Code');
    expect(skill).toContain('**Git status:**');
    expect(skill).toContain("!`git status`");
    expect(skill).toContain("!`git diff HEAD`");
    expect(skill).toContain("!`git branch --show-current`");
    expect(skill).toContain("!`git log --oneline -10`");
    expect(skill).toContain('__DEFAULT_BRANCH_UNRESOLVED__');
    expect(skill).toContain('### Context fallback');
    expect(skill).toContain("printf '=== STATUS ===\\n'; git status;");
    expect(skill).toContain('All data needed for this step is already available -- do not re-run those commands.');
  });

  test('skill keeps safe staging guidance for logical commit grouping', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('For each commit group, stage and commit in a single call.');
    expect(skill).toContain('Prefer staging specific files by name over `git add -A` or `git add .`');
    expect(skill).toContain('git add file1 file2 file3 && git commit -m "$(cat <<\'EOF\'');

    expect(skill).not.toContain('Run these commands to understand the current state.');
  });
});
