'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');
const {
  buildFilteredAssetSet,
  inspectInstalledAssets,
  planBundledAssetSync,
  syncBundledAssets,
} = require('../../src/cli/plugin');
const {
  planObsoleteManagedAssetRemoval,
} = require('../../src/cli/state');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'git-worktree', 'SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-git-worktree-'));
}

function plannedRuntimeContent(platform, targetPath) {
  const projectRoot = makeTempDir();

  try {
    const adapter = platform === 'claude' ? new ClaudeAdapter() : new CodexAdapter();
    const { plan } = planBundledAssetSync(projectRoot, adapter);
    const operation = plan.operations.find((entry) => entry.path === targetPath);
    if (!operation) {
      throw new Error(`Missing planned runtime operation for ${targetPath}`);
    }
    return operation.contents;
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

describe('git-worktree runtime delivery contracts', () => {
  test('source uses a narrow Bash allow pattern and no bare bundled script path', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('allowed-tools: Bash(bash *worktree-manager.sh*)');
    expect(skill).toContain('user-invocable: false');
    expect(skill).toContain('Internal helper for public workflows');
    expect(skill).not.toContain('allowed-tools: Bash(bash *)');
    expect(skill).toContain('`bash -c` wrapper whose command text includes `exec bash ...worktree-manager.sh`');
    expect(skill).toContain('exec bash "$CLAUDE_SKILL_DIR/scripts/worktree-manager.sh" "$@"');
    expect(skill).toContain('exec bash "$(git rev-parse --show-toplevel)"/"skills/git-worktree/scripts/worktree-manager.sh" "$@"');
    expect(skill).toContain("' _ create <branch-name> [from-branch]");
    expect(skill).toContain("' _ create feat/login");
    expect(skill).not.toContain('\nif [ -n "${CLAUDE_SKILL_DIR:-}" ]; then');
    expect(skill).not.toContain('bash "${CLAUDE_SKILL_DIR}/scripts/worktree-manager.sh"');
    expect(skill).not.toContain('bash scripts/worktree-manager.sh create');
  });

  test('git-worktree is the only delivered agent-facing internal skill', () => {
    for (const platform of ['claude', 'codex']) {
      const assets = buildFilteredAssetSet(platform);

      expect(assets.internalSkills).toEqual(['git-worktree']);
      expect(assets.skills).not.toContain('git-worktree');
      expect(assets.workflowSkills).not.toContain('git-worktree');
    }
  });

  test('runtime sync rewrites internal skill source paths and inspect sees no drift', () => {
    for (const [adapter, runtimeSkillPath, rewrittenScriptPath] of [
      [new ClaudeAdapter(), '.claude/skills/git-worktree/SKILL.md', '.claude/skills/git-worktree/scripts/worktree-manager.sh'],
      [new CodexAdapter(), '.agents/skills/git-worktree/SKILL.md', '.agents/skills/git-worktree/scripts/worktree-manager.sh'],
    ]) {
      const projectRoot = makeTempDir();

      try {
        syncBundledAssets(projectRoot, adapter);

        const content = read(path.join(projectRoot, runtimeSkillPath));
        expect(content).toContain('user-invocable: false');
        expect(content).toContain(rewrittenScriptPath);
        expect(content).toContain(`exec bash "$(git rev-parse --show-toplevel)"/"${path.dirname(rewrittenScriptPath)}/worktree-manager.sh" "$@"`);
        expect(content).not.toContain('bash skills/git-worktree/scripts/worktree-manager.sh');
        expect(content).not.toContain('bash scripts/worktree-manager.sh create');
        expect(fs.existsSync(path.join(projectRoot, path.dirname(runtimeSkillPath), 'scripts', 'worktree-manager.sh'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, adapter.skillsRoot, 'spec-session-inventory'))).toBe(false);
        expect(fs.existsSync(path.join(projectRoot, adapter.skillsRoot, 'spec-session-extract'))).toBe(false);

        const status = inspectInstalledAssets(projectRoot, adapter).skills;
        const gitWorktreeDrift = status.drifted.find((entry) => entry.skillName === 'git-worktree');
        expect(gitWorktreeDrift).toBeUndefined();
      } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
      }
    }
  });

  test('dry-run projection uses the same internal skill runtime paths as sync', () => {
    expect(plannedRuntimeContent('claude', '.claude/skills/git-worktree/SKILL.md')).toContain(
      '.claude/skills/git-worktree/scripts/worktree-manager.sh',
    );
    expect(plannedRuntimeContent('codex', '.agents/skills/git-worktree/SKILL.md')).toContain(
      '.agents/skills/git-worktree/scripts/worktree-manager.sh',
    );
  });

  test('obsolete managed session primitive runtime skills are removed on next init', () => {
    for (const [adapter, prefix] of [
      [new ClaudeAdapter(), '.claude/skills'],
      [new CodexAdapter(), '.agents/skills'],
    ]) {
      const projectRoot = makeTempDir();
      const previousState = {
        manifestVersion: '1.8.1',
        platform: adapter.id,
        developer: null,
        commands: [],
        skills: ['spec-session-extract', 'spec-session-inventory', 'using-spec-first'],
        workflowSkills: ['spec-sessions'],
        agents: [],
        agentSupportFiles: [],
      };
      const nextState = {
        ...previousState,
        skills: ['git-worktree', 'using-spec-first'],
      };

      try {
        const removal = planObsoleteManagedAssetRemoval(projectRoot, previousState, nextState, adapter);
        const paths = removal.operations.map((operation) => operation.path);

        expect(paths).toEqual(expect.arrayContaining([
          `${prefix}/spec-session-extract`,
          `${prefix}/spec-session-inventory`,
        ]));
        expect(paths).not.toContain(`${prefix}/git-worktree`);
      } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
      }
    }
  });
});
