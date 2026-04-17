'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/git-worktree/SKILL.md');
const SCRIPT_PATH = path.join(REPO_ROOT, 'skills/git-worktree/scripts/worktree-manager.sh');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('git-worktree contracts', () => {
  test('skill keeps spec-first workflow wiring and avoids stale ce command names', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('/spec:review');
    expect(skill).toContain('/spec:work');
    expect(skill).toContain('NEVER call `git worktree add` directly');
    expect(skill).toContain('worktree-manager.sh');
    expect(skill).toContain('loaded `git-worktree` skill context');
    expect(skill).toContain('bash scripts/worktree-manager.sh create feature-name');

    expect(skill).not.toContain('/ce:review');
    expect(skill).not.toContain('/ce:work');
    expect(skill).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    expect(skill).not.toContain('.claude/skills/');
    expect(skill).not.toContain('.agents/skills/');
  });

  test('manager script preserves env copy and trust guardrail contracts', () => {
    const script = read(SCRIPT_PATH);

    expect(script).toContain('ensure_gitignore()');
    expect(script).toContain('copy_env_files()');
    expect(script).toContain('trust_dev_tools()');
    expect(script).toContain('is_trusted_base_branch()');
    expect(script).toContain('get_default_branch()');
    expect(script).toContain('auto-allow is disabled for non-trusted base branches');
    expect(script).toContain('Skipping dev tool trust -- origin/$trust_branch not found locally');
  });
});
