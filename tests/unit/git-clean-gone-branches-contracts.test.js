'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/git-clean-gone-branches/SKILL.md');
const SCRIPT_PATH = path.join(REPO_ROOT, 'skills/git-clean-gone-branches/scripts/clean-gone');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('git-clean-gone-branches contracts', () => {
  test('source skill preserves identity and two-phase cleanup workflow', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: git-clean-gone-branches');
    expect(skill).toContain('### Step 1: Discover gone branches');
    expect(skill).toContain('bash scripts/clean-gone');
    expect(skill).toContain('If the script outputs `__NONE__`, report that no stale branches were found and stop.');
    expect(skill).toContain('### Step 2: Present branches and ask for confirmation');
    expect(skill).toContain('yes-or-no decision on the entire list');
    expect(skill).toContain('### Step 3: Delete confirmed branches');
  });

  test('skill preserves worktree deletion guardrail and decline contract', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('git worktree list | grep "\\\\[$branch\\\\]"');
    expect(skill).toContain('is not the main repo root');
    expect(skill).toContain('git worktree remove --force "$worktree_path"');
    expect(skill).toContain('git branch -D "$branch"');
    expect(skill).toContain('If the user declines, acknowledge and stop without deleting anything.');
  });

  test('clean-gone script preserves discovery-only behavior and branch safety guardrails', () => {
    const script = read(SCRIPT_PATH);

    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('git fetch --prune');
    expect(script).toContain('git branch -vv');
    expect(script).toContain("grep ': gone]'");
    expect(script).toContain('if [[ "$line" =~ ^\\* ]]; then');
    expect(script).toContain('branch_name=$(echo "$line" | sed');
    expect(script).toContain('[[ "$branch_name" =~ ^[0-9a-f]{7,}$ ]]');
    expect(script).toContain('[[ "$branch_name" == "HEAD" ]]');
    expect(script).toContain('echo "__NONE__"');
    expect(script).not.toContain('git branch -D "$branch"');
    expect(script).not.toContain('git worktree remove --force');
  });
});
