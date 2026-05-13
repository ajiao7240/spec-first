'use strict';

const { spawnSync } = require('node:child_process');
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
const SCRIPT_PATH = path.join(REPO_ROOT, 'skills', 'git-worktree', 'scripts', 'worktree-manager.sh');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-git-worktree-'));
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with status ${result.status}`,
      `stdout:\n${result.stdout}`,
      `stderr:\n${result.stderr}`,
    ].join('\n'));
  }
  return result;
}

function initGitRepo(options = {}) {
  const repo = makeTempDir();
  run('git', ['init', '-b', 'main'], repo);
  fs.writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
  if (options.trackEnv) {
    fs.writeFileSync(path.join(repo, '.env'), 'tracked_secret=do-not-print\n');
  }
  run('git', ['add', '.'], repo);
  run('git', [
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'user.name=Spec Test',
    '-c', 'user.email=spec@example.test',
    'commit',
    '-m', 'init',
  ], repo);
  return repo;
}

function runWorktreeManager(repo, args) {
  return spawnSync('bash', [SCRIPT_PATH, 'create', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
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
    expect(skill).toContain("' _ create [--copy-env] <branch-name> [from-branch]");
    expect(skill).toContain("' _ create feat/login");
    expect(skill).toContain("' _ create --copy-env feat/local-env");
    expect(skill).not.toContain('\nif [ -n "${CLAUDE_SKILL_DIR:-}" ]; then');
    expect(skill).not.toContain('bash "${CLAUDE_SKILL_DIR}/scripts/worktree-manager.sh"');
    expect(skill).not.toContain('bash scripts/worktree-manager.sh create');
  });

  test('env file copying is explicit opt-in and audited without contents', () => {
    const skill = read(SKILL_PATH);
    const script = read(SCRIPT_PATH);

    expect(skill).toContain('Does not copy `.env*` files by default');
    expect(skill).toContain('Use `--copy-env` only when the workflow explicitly needs local environment files');
    expect(skill).toContain('except `.env.example`, `.env.template`, and `.env.sample`');
    expect(skill).toContain('appends `.env-copy.log` with timestamp, source path, destination path, byte size, and an 8-character content fingerprint');
    expect(skill).toContain('The log does not include file contents');
    expect(skill).toContain('Even when env files were copied intentionally, downstream staging must still treat them as denied by default');
    expect(skill).not.toContain('Copies `.env`, `.env.local`, `.env.test`, etc. from the main repo');
    expect(skill).not.toContain('for env_file in .env .env.*');

    expect(script).toContain('Usage: worktree-manager.sh create [--copy-env] <branch-name> [from-branch]');
    expect(script).toContain('local copy_env="false"');
    expect(script).toContain('if [[ "${1:-}" == "--copy-env" ]]');
    expect(script).toContain('Not copied by default. Re-run create with --copy-env to opt in.');
    expect(script).toContain('.env.example|.env.template|.env.sample');
    expect(script).toContain('ensure_env_copy_log_excluded');
    expect(script).toContain('.env-copy.log');
    expect(script).toContain('git -C "$worktree_path" rev-parse --git-path info/exclude');
    expect(script).toContain('shasum -a 256 "$source"');
    expect(script).toContain('sha256sum "$source"');
    expect(script).toContain('timestamp=%s source_path=%s destination_path=%s size_bytes=%s sha256_8=%s');
    expect(script).toContain('>> "$log_file"');
    expect(script).not.toContain('cat "$source"');
  });

  test('default create does not copy untracked env files', () => {
    const repo = initGitRepo();
    try {
      fs.writeFileSync(path.join(repo, '.env'), 'secret=not-copied\n');
      fs.writeFileSync(path.join(repo, '.env.local'), 'local_secret=not-copied\n');
      fs.writeFileSync(path.join(repo, '.env.example'), 'example=not-secret\n');

      const result = runWorktreeManager(repo, ['no-env-copy', 'main']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Not copied by default. Re-run create with --copy-env to opt in.');
      const worktreePath = path.join(repo, '.worktrees', 'no-env-copy');
      expect(fs.existsSync(path.join(worktreePath, '.env'))).toBe(false);
      expect(fs.existsSync(path.join(worktreePath, '.env.local'))).toBe(false);
      expect(fs.existsSync(path.join(worktreePath, '.env-copy.log'))).toBe(false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('--copy-env copies only real env files and keeps audit log out of git', () => {
    const repo = initGitRepo();
    try {
      fs.writeFileSync(path.join(repo, '.env'), 'secret=super-secret-value\n');
      fs.writeFileSync(path.join(repo, '.env.local'), 'local_secret=another-secret\n');
      fs.writeFileSync(path.join(repo, '.env.example'), 'example=not-secret\n');
      fs.writeFileSync(path.join(repo, '.env.template'), 'template=not-secret\n');
      fs.writeFileSync(path.join(repo, '.env.sample'), 'sample=not-secret\n');

      const result = runWorktreeManager(repo, ['--copy-env', 'with-env-copy', 'main']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Copying env files by explicit --copy-env opt-in:');
      expect(result.stdout).toContain('- .env');
      expect(result.stdout).toContain('- .env.local');
      expect(result.stdout).not.toContain('.env.example');
      expect(result.stdout).not.toContain('.env.template');
      expect(result.stdout).not.toContain('.env.sample');
      expect(result.stdout).not.toContain('super-secret-value');

      const worktreePath = path.join(repo, '.worktrees', 'with-env-copy');
      expect(fs.readFileSync(path.join(worktreePath, '.env'), 'utf8')).toBe('secret=super-secret-value\n');
      expect(fs.readFileSync(path.join(worktreePath, '.env.local'), 'utf8')).toBe('local_secret=another-secret\n');
      expect(fs.existsSync(path.join(worktreePath, '.env.example'))).toBe(false);
      expect(fs.existsSync(path.join(worktreePath, '.env.template'))).toBe(false);
      expect(fs.existsSync(path.join(worktreePath, '.env.sample'))).toBe(false);

      const logPath = path.join(worktreePath, '.env-copy.log');
      const log = fs.readFileSync(logPath, 'utf8');
      expect(log).toContain('source_path=');
      expect(log).toContain('destination_path=');
      expect(log).toContain('size_bytes=');
      expect(log).toMatch(/sha256_8=[a-f0-9]{8}/);
      expect(log).not.toContain('super-secret-value');
      expect(log).not.toContain('another-secret');

      run('git', ['-C', worktreePath, 'check-ignore', '.env-copy.log'], repo);
      const status = run('git', ['-C', worktreePath, 'status', '--short', '--', '.env-copy.log'], repo);
      expect(status.stdout).toBe('');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('destination env backups only happen on explicit opt-in path', () => {
    const repo = initGitRepo({ trackEnv: true });
    try {
      const defaultResult = runWorktreeManager(repo, ['tracked-default', 'main']);
      expect(defaultResult.status).toBe(0);
      expect(fs.existsSync(path.join(repo, '.worktrees', 'tracked-default', '.env.backup'))).toBe(false);

      const optInResult = runWorktreeManager(repo, ['--copy-env', 'tracked-opt-in', 'main']);
      expect(optInResult.status).toBe(0);
      expect(fs.existsSync(path.join(repo, '.worktrees', 'tracked-opt-in', '.env.backup'))).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
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
