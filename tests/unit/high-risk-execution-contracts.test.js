'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('high-risk execution safety contracts', () => {
  test('worktree helpers do not propagate env files by default', () => {
    const worktreeManager = read('skills/git-worktree/scripts/worktree-manager.sh');
    const optimizeWorktree = read('skills/spec-optimize/scripts/experiment-worktree.sh');
    const gitWorktreeSkill = read('skills/git-worktree/SKILL.md');

    expect(worktreeManager).toContain('local copy_env="false"');
    expect(worktreeManager).toContain('if [[ "$copy_env" == "true" ]]');
    expect(worktreeManager).toContain('Not copied by default. Re-run create with --copy-env to opt in.');

    expect(optimizeWorktree).toContain('local copy_env="false"');
    expect(optimizeWorktree).toContain('if [[ "$copy_env" == "true" ]]');
    expect(optimizeWorktree).toContain('Environment files not copied by default. Pass --copy-env to opt in.');
    expect(optimizeWorktree).not.toContain('# Copy .env files from main repo');

    expect(gitWorktreeSkill).toContain('Does not copy `.env*` files by default');
    expect(gitWorktreeSkill).toContain('downstream staging must still treat them as denied by default');
    expect(gitWorktreeSkill).not.toContain('Copies `.env`, `.env.local`, `.env.test`, etc. from the main repo');
  });

  test('delegation staging is bounded by batch files, side effects, and secret deny patterns', () => {
    const delegation = read('skills/spec-work-beta/references/codex-delegation-workflow.md');
    const taskPackSchema = read('skills/spec-write-tasks/references/task-pack-schema.md');

    expect(delegation).not.toContain('git add $(git diff --name-only HEAD; git ls-files --others --exclude-standard)');
    expect(delegation).toContain('batch-owned set');
    expect(delegation).toContain('expected_side_effects');
    expect(delegation).toContain('extend-batch');
    expect(delegation).toContain('drop-stray');
    expect(delegation).toContain('abort');
    expect(delegation).toContain('src/cli/contracts/security/secret-deny-patterns.json');
    expect(delegation).toContain('Env files remain denied by default even when a worktree was created with `--copy-env`');
    expect(delegation).toContain('git add --pathspec-from-file "$batch_stage_paths" --pathspec-file-nul');

    expect(taskPackSchema).toContain('`expected_side_effects`');
    expect(taskPackSchema).toContain('must not use `**` whole-repo globs');
  });
});
