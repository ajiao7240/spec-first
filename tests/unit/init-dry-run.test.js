'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { buildInitWritePlan, runInit } = require('../../src/cli/commands/init');
const { getAdapter } = require('../../src/cli/adapters');
const {
  SPEC_FIRST_GITIGNORE_START,
  buildSpecFirstGitignoreBlock,
} = require('../../src/cli/gitignore-policy');
const { buildEmptyOperationPlan } = require('../../src/cli/state');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-dry-run-'));
}

function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function captureInit(cwd, args) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = withCwd(cwd, () => runInit(args));
    return {
      exitCode,
      stdout: logs.join('\n'),
      stderr: errors.join('\n'),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function snapshotTree(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath);
      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        walk(absolutePath);
        continue;
      }

      const content = fs.readFileSync(absolutePath, 'utf8');
      results.push(`${relativePath}:${content}`);
    }
  }

  walk(rootDir);
  return results.sort();
}

function countGitignoreMarkers(content) {
  return (content.match(new RegExp(SPEC_FIRST_GITIGNORE_START, 'g')) || []).length;
}

function countLiteral(content, literal) {
  return content.split(literal).length - 1;
}

function runGit(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function initGitRepo(repoRoot) {
  runGit(repoRoot, ['init']);
}

function writeFile(repoRoot, relativePath, contents = 'runtime\n') {
  const absolutePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, 'utf8');
}

function commitAll(repoRoot) {
  runGit(repoRoot, ['add', '.']);
  runGit(repoRoot, [
    '-c',
    'user.email=t@e',
    '-c',
    'user.name=t',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--no-verify',
    '-m',
    'bootstrap',
  ]);
}

function tracked(repoRoot, relativePath) {
  return runGit(repoRoot, ['ls-files', '--', relativePath]).trim();
}

function buildMinimalInitWritePlan(projectRoot) {
  const adapter = getAdapter('codex');
  return buildInitWritePlan({
    projectRoot,
    adapter,
    developer: {
      name: 'reviewer',
      lang: 'zh',
      initializedAt: '2026-05-19T00:00:00.000Z',
      version: '1.8.2',
    },
    nextState: {
      manifestVersion: '1.8.2',
      platform: 'codex',
      developer: null,
      commands: [],
      skills: [],
      workflowSkills: [],
      agents: [],
      agentSupportFiles: [],
    },
    platform: 'codex',
    assetPlan: buildEmptyOperationPlan(),
    runtimePlan: buildEmptyOperationPlan(),
  });
}

describe('init --dry-run', () => {
  test('init help includes concise post-init setup guidance', () => {
    const projectRoot = makeTempDir();

    try {
      const result = captureInit(projectRoot, ['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('After successful init');
      expect(result.stdout).toContain('For lightweight work, start the matching /spec:* workflow');
      expect(result.stdout).toContain('For lightweight work, start the matching $spec-* workflow');
      expect(result.stdout).toContain('init refreshes parent host runtime assets');
      expect(result.stdout).toContain('/spec:mcp-setup');
      expect(result.stdout).toContain('/spec:graph-bootstrap');
      expect(result.stdout).not.toContain('/spec:' + 'standards');
      expect(result.stdout).toContain('$spec-mcp-setup');
      expect(result.stdout).toContain('$spec-graph-bootstrap');
      expect(result.stdout).not.toContain('$spec-' + 'standards');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init rejects unsupported force flag instead of silently accepting it', () => {
    const projectRoot = makeTempDir();

    try {
      const result = captureInit(projectRoot, ['--claude', '--force', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Usage: spec-first init');
      expect(result.stdout).toBe('');
      expect(snapshotTree(projectRoot)).toEqual([]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude init --dry-run previews prune/write actions without mutating the project', () => {
    const projectRoot = makeTempDir();

    try {
      fs.mkdirSync(path.join(projectRoot, '.claude', 'commands', 'spec'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, '.claude', 'commands', 'spec', 'custom.md'),
        'custom command\n',
        'utf8',
      );

      const before = snapshotTree(projectRoot);
      const result = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);
      const after = snapshotTree(projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(after).toEqual(before);
      expect(result.stdout).toContain('Dry run: spec-first init (claude)');
      expect(result.stdout).toContain('Would prune 1 unmanaged command file(s)');
      expect(result.stdout).toContain('.claude/commands/spec/custom.md');
      expect(result.stdout).toContain('Would ensure');
      expect(result.stdout).toContain('Would write/update');
      expect(result.stdout).toContain('.claude/commands/spec/work.md');
      expect(result.stdout).toContain('.claude/spec-first/workflows/spec-mcp-setup/scripts/check-health');
      expect(result.stdout).toContain('.claude/agents/spec-security-reviewer.agent.md');
      expect(result.stdout).toContain('CLAUDE.md');
      expect(result.stdout).toContain('.gitignore');
      expect(result.stdout).toContain('.claude/hooks/session-start');
      expect(result.stdout).toContain('.claude/spec-first/state.json');
      expect(result.stdout).toContain('No files were changed.');
      expect(fs.existsSync(path.join(projectRoot, '.gitignore'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude init apply materializes the high-value paths promised by dry-run', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const dryRun = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);
      expect(dryRun.exitCode).toBe(0);

      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      for (const relativePath of [
        '.claude/commands/spec/work.md',
        '.claude/agents/spec-security-reviewer.agent.md',
        '.claude/hooks/session-start',
        '.claude/spec-first/workflows/spec-mcp-setup/scripts/check-health',
        '.claude/settings.json',
        '.claude/spec-first/state.json',
        '.gitignore',
        'CLAUDE.md',
      ]) {
        expect(dryRun.stdout).toContain(relativePath);
        expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(true);
      }

      const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
      expect(gitignore).toContain(buildSpecFirstGitignoreBlock());
      expect(gitignore).toContain('.claude/commands/spec/');
      expect(gitignore).not.toContain('.spec-first/' + 'standards/');

      const claudeInstruction = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8');
      expect(claudeInstruction).toContain('不要默认进入 `spec-brainstorm`');
      expect(claudeInstruction).toContain('workspace-graph-targets.v1');
      expect(claudeInstruction).toContain('完整路由策略在 `skills/using-spec-first/SKILL.md`');
      expect(claudeInstruction).toContain('target_repo');
      expect(claudeInstruction).toContain('/spec:optimize');
      expect(claudeInstruction).not.toContain('spec-' + 'standards` 无参数运行默认为每个 discovered child repo');
      expect(claudeInstruction).not.toContain('startup-reminder --codex');
      expect(claudeInstruction).not.toContain('<!-- spec-first:runtime-tools:start -->');
      expect(claudeInstruction).not.toContain('代码智能与运行时工具');
      expect(claudeInstruction).not.toContain('$spec-graph-bootstrap');

      const claudeMcpSetupCommand = fs.readFileSync(
        path.join(projectRoot, '.claude', 'commands', 'spec', 'mcp-setup.md'),
        'utf8',
      );
      expect(claudeMcpSetupCommand).toContain('bash .claude/spec-first/workflows/spec-mcp-setup/scripts/check-health');
      expect(claudeMcpSetupCommand).not.toContain('bash skills/spec-mcp-setup/scripts/check-health');

      const claudeState = JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'spec-first', 'state.json'), 'utf8'));
      expect(claudeState.workflowSkills).toContain('spec-mcp-setup');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init prunes no-state retired standards runtime mirrors for both hosts', () => {
    const cases = [
      {
        platform: 'claude',
        args: ['--claude', '-u', 'reviewer', '--lang', 'zh'],
        retiredPaths: [
          '.claude/commands/spec/standards.md',
          '.claude/spec-first/workflows/spec-standards/SKILL.md',
          '.claude/skills/spec-standards/SKILL.md',
        ],
        currentPath: '.claude/spec-first/workflows/spec-plan/SKILL.md',
      },
      {
        platform: 'codex',
        args: ['--codex', '-u', 'reviewer', '--lang', 'zh'],
        retiredPaths: [
          '.agents/skills/spec-standards/SKILL.md',
          '.codex/commands/spec/standards.md',
        ],
        currentPath: '.agents/skills/spec-plan/SKILL.md',
      },
    ];

    for (const testCase of cases) {
      const projectRoot = makeTempDir();

      try {
        for (const retiredPath of testCase.retiredPaths) {
          writeFile(projectRoot, retiredPath, `old ${testCase.platform} standards runtime\n`);
          expect(fs.existsSync(path.join(projectRoot, retiredPath))).toBe(true);
        }

        const result = captureInit(projectRoot, testCase.args);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        for (const retiredPath of testCase.retiredPaths) {
          expect(fs.existsSync(path.join(projectRoot, retiredPath))).toBe(false);
        }
        expect(fs.existsSync(path.join(projectRoot, testCase.currentPath))).toBe(true);
      } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
      }
    }
  });

  test('init prunes retired standards artifact root before gitignore exposes it', () => {
    const cases = [
      ['claude', ['--claude', '-u', 'reviewer', '--lang', 'zh']],
      ['codex', ['--codex', '-u', 'reviewer', '--lang', 'zh']],
    ];

    for (const [platform, args] of cases) {
      const projectRoot = makeTempDir();
      const retiredArtifactRoot = '.spec-first/standards';

      try {
        initGitRepo(projectRoot);
        writeFile(
          projectRoot,
          `${retiredArtifactRoot}/standards-preview.md`,
          `old ${platform} standards artifact\n`,
        );
        expect(fs.existsSync(path.join(projectRoot, retiredArtifactRoot))).toBe(true);

        const result = captureInit(projectRoot, args);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        expect(fs.existsSync(path.join(projectRoot, retiredArtifactRoot))).toBe(false);
        expect(runGit(projectRoot, ['status', '--short', '--', retiredArtifactRoot]).trim()).toBe('');
      } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
      }
    }
  });

  test('Claude init preserves existing CRLF instruction content while adding managed blocks once', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      fs.writeFileSync(
        path.join(projectRoot, 'CLAUDE.md'),
        '# Existing Windows Notes\r\n\r\nUser note with CRLF.\r\n',
        'utf8',
      );

      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const claudeInstruction = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8');
      expect(claudeInstruction).toContain('# Existing Windows Notes');
      expect(claudeInstruction).toContain('User note with CRLF.');
      expect(claudeInstruction).toContain('<!-- spec-first:lang:start -->');
      expect(claudeInstruction).toContain('<!-- spec-first:bootstrap:start -->');
      expect(claudeInstruction).toContain('<!-- spec-first:coding-guidelines:start -->');
      expect(countLiteral(claudeInstruction, '<!-- spec-first:lang:start -->')).toBe(1);
      expect(countLiteral(claudeInstruction, '<!-- spec-first:bootstrap:start -->')).toBe(1);
      expect(countLiteral(claudeInstruction, '<!-- spec-first:coding-guidelines:start -->')).toBe(1);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init does not write global runtime tool guidance into AGENTS.md', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const codexInstruction = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
      const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
      expect(gitignore).toContain(buildSpecFirstGitignoreBlock());
      expect(gitignore).toContain('.agents/skills/');
      expect(gitignore).not.toContain('.agents/\n');
      expect(codexInstruction).toContain('不要默认进入 `spec-brainstorm`');
      expect(codexInstruction).toContain('workspace-graph-targets.v1');
      expect(codexInstruction).toContain('完整路由策略在 `skills/using-spec-first/SKILL.md`');
      expect(codexInstruction).toContain('target_repo');
      expect(codexInstruction).toContain('$spec-optimize');
      expect(codexInstruction).toContain('spec-first startup-reminder --codex');
      expect(codexInstruction).toContain('$spec-update');
      expect(codexInstruction).toContain('失败/空输出不阻塞');
      expect(codexInstruction).toContain('bounded subagents、leaf reviewers、worker agents 不运行');
      expect(codexInstruction).not.toContain('spec-' + 'standards` 无参数运行默认为每个 discovered child repo');
      expect(codexInstruction).not.toContain('<!-- spec-first:runtime-tools:start -->');
      expect(codexInstruction).not.toContain('代码智能与运行时工具');
      expect(codexInstruction).not.toContain('/spec:graph-bootstrap');

      const codexMcpSetupSkill = fs.readFileSync(
        path.join(projectRoot, '.agents', 'skills', 'spec-mcp-setup', 'SKILL.md'),
        'utf8',
      );
      const codexPlanSkill = fs.readFileSync(
        path.join(projectRoot, '.agents', 'skills', 'spec-plan', 'SKILL.md'),
        'utf8',
      );
      const codexGraphBootstrapScript = path.join(projectRoot, '.agents', 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.sh');
      expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills', 'spec-mcp-setup', 'scripts', 'check-health'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills', 'spec-mcp-setup', 'scripts', 'resolve-project-target.sh'))).toBe(true);
      expect(fs.existsSync(codexGraphBootstrapScript)).toBe(true);
      expect(fs.readFileSync(codexGraphBootstrapScript, 'utf8')).toContain('../../spec-mcp-setup/scripts/resolve-project-target.sh');
      expect(codexMcpSetupSkill).toContain('bash .agents/skills/spec-mcp-setup/scripts/check-health');
      expect(codexMcpSetupSkill).not.toContain('bash skills/spec-mcp-setup/scripts/check-health');
      expect(codexPlanSkill).toContain('including `spawn_agent` where provided');
      expect(codexPlanSkill).toContain('applying it inline as an explicit fallback');
      expect(codexPlanSkill).toContain('`.codex/agents/spec-repo-research-analyst.agent.md`');
      expect(codexPlanSkill).not.toContain('Read `.codex/agents/spec-repo-research-analyst.agent.md` and apply that agent profile to');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init preserves CRLF AGENTS.md content in unicode and bracketed paths', () => {
    const tempRoot = makeTempDir();
    const projectRoot = path.join(tempRoot, 'codex workspace 中文 [win64]');
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      fs.mkdirSync(projectRoot, { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, 'AGENTS.md'),
        '# Existing Codex Notes\r\n\r\nUser note from Windows editor.\r\n',
        'utf8',
      );

      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const codexInstruction = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
      expect(codexInstruction).toContain('# Existing Codex Notes');
      expect(codexInstruction).toContain('User note from Windows editor.');
      expect(countLiteral(codexInstruction, '<!-- spec-first:lang:start -->')).toBe(1);
      expect(countLiteral(codexInstruction, '<!-- spec-first:bootstrap:start -->')).toBe(1);
      expect(countLiteral(codexInstruction, '<!-- spec-first:coding-guidelines:start -->')).toBe(1);
      expect(fs.existsSync(path.join(projectRoot, '.codex', 'spec-first', 'state.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.codex', 'spec-first', '.developer'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills', 'using-spec-first', 'SKILL.md'))).toBe(true);
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('init removes legacy runtime tool guidance and normalizes GitNexus blocks', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const legacyRuntimeToolsBlock = [
      '<!-- spec-first:runtime-tools:start -->',
      '## 代码智能与运行时工具（由 spec-first 管理）',
      '',
      '### 使用边界',
      '- `GitNexus`：旧全局提示。',
      '- `code-review-graph`：旧全局提示。',
      '- `Serena MCP`：旧全局提示。',
      '- `ast-grep`：旧全局提示。',
      '',
      '### 不要做',
      '- 不要复制旧提示。',
      '<!-- spec-first:runtime-tools:end -->',
    ].join('\n');
    const gitnexusBlock = [
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      'This project is indexed by GitNexus as **legacy-repo** (1 symbols, 2 relationships, 3 execution flows).',
      '<!-- gitnexus:end -->',
    ].join('\n');

    try {
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);
      const agentsPath = path.join(projectRoot, 'AGENTS.md');
      fs.appendFileSync(agentsPath, `\n\n${legacyRuntimeToolsBlock}\n\n${gitnexusBlock}\n`, 'utf8');

      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const codexInstruction = fs.readFileSync(agentsPath, 'utf8');
      expect(codexInstruction).not.toContain('spec-first:runtime-tools:start');
      expect(codexInstruction).not.toContain('代码智能与运行时工具');
      expect(codexInstruction).toContain('<!-- gitnexus:start -->');
      expect(codexInstruction).toContain('# GitNexus — Code Intelligence');
      expect(codexInstruction).toContain('仓库标识：**legacy-repo**');
      expect(codexInstruction).not.toContain('1 symbols');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('repeated init keeps a single gitignore managed block', () => {
    const projectRoot = makeTempDir();

    try {
      expect(captureInit(projectRoot, ['--codex', '-u', 'reviewer', '--lang', 'zh']).exitCode).toBe(0);
      expect(captureInit(projectRoot, ['--codex', '-u', 'reviewer', '--lang', 'zh']).exitCode).toBe(0);

      const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
      expect(countGitignoreMarkers(gitignore)).toBe(1);
      expect(gitignore).toContain('.spec-first/*.local.yaml');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init --dry-run previews managed runtime untrack without mutating git index', () => {
    const projectRoot = makeTempDir();

    try {
      initGitRepo(projectRoot);
      writeFile(projectRoot, '.codex/spec-first/.developer');
      commitAll(projectRoot);

      const result = captureInit(projectRoot, ['--codex', '--dry-run', '-u', 't', '--lang', 'zh']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Would untrack 1 managed runtime path(s):');
      expect(result.stdout).toContain('.codex/spec-first/.developer');
      expect(tracked(projectRoot, '.codex/spec-first/.developer')).toBe('.codex/spec-first/.developer');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init apply untracks managed runtime index entries while preserving worktree files', () => {
    const projectRoot = makeTempDir();

    try {
      initGitRepo(projectRoot);
      writeFile(projectRoot, '.codex/spec-first/.developer');
      commitAll(projectRoot);

      const result = captureInit(projectRoot, ['--codex', '-u', 't', '--lang', 'zh']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('🧯 Untracked 1 managed runtime path(s) from git index (work tree files preserved).');
      expect(tracked(projectRoot, '.codex/spec-first/.developer')).toBe('');
      expect(fs.existsSync(path.join(projectRoot, '.codex/spec-first/.developer'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init apply reports advisory runtime untrack skip outside git repos', () => {
    const projectRoot = makeTempDir();

    try {
      const result = captureInit(projectRoot, ['--codex', '-u', 't', '--lang', 'zh']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('🧯 Runtime untrack skipped: not-a-git-repo');
      expect(result.stdout).not.toContain('🧯 Untracked');
      expect(result.stdout).not.toContain('🧯 No managed runtime paths require untracking.');
      expect(fs.existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init write plan keeps runtime untrack operations after gitignore writes', () => {
    const projectRoot = makeTempDir();

    try {
      initGitRepo(projectRoot);
      writeFile(projectRoot, '.codex/spec-first/.developer');
      commitAll(projectRoot);

      const initWritePlan = buildMinimalInitWritePlan(projectRoot);
      const operations = initWritePlan.plan.operations;
      const gitignoreIndexes = operations
        .map((operation, index) => ({ operation, index }))
        .filter((entry) => entry.operation.path === '.gitignore' && entry.operation.reason === 'managed_gitignore_policy')
        .map((entry) => entry.index);
      const firstUntrackIndex = operations.findIndex((operation) => operation.kind === 'untrack_index');

      expect(gitignoreIndexes.length).toBeGreaterThan(0);
      expect(firstUntrackIndex).toBeGreaterThan(Math.max(...gitignoreIndexes));
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init preserves existing user gitignore content around the managed block', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, '.gitignore'), 'node_modules/\n.env\n', 'utf8');

      expect(captureInit(projectRoot, ['--codex', '-u', 'reviewer', '--lang', 'zh']).exitCode).toBe(0);

      const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
      expect(gitignore.startsWith('node_modules/\n.env\n\n')).toBe(true);
      expect(gitignore).toContain(buildSpecFirstGitignoreBlock());
      expect(countGitignoreMarkers(gitignore)).toBe(1);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init preserves single repo behavior and auto-batches parent workspaces into child repos', () => {
    const monorepoRoot = makeTempDir();
    const workspaceRoot = makeTempDir();

    try {
      fs.mkdirSync(path.join(monorepoRoot, 'packages', 'app'), { recursive: true });
      fs.mkdirSync(path.join(monorepoRoot, 'packages', 'lib'), { recursive: true });

      expect(captureInit(monorepoRoot, ['--codex', '-u', 'reviewer', '--lang', 'zh']).exitCode).toBe(0);
      expect(fs.existsSync(path.join(monorepoRoot, '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(monorepoRoot, 'packages', 'app', '.gitignore'))).toBe(false);
      expect(fs.existsSync(path.join(monorepoRoot, 'packages', 'lib', '.gitignore'))).toBe(false);

      fs.mkdirSync(path.join(workspaceRoot, 'project-a', '.git'), { recursive: true });
      fs.mkdirSync(path.join(workspaceRoot, 'project-b', '.git'), { recursive: true });

      expect(captureInit(workspaceRoot, ['--codex', '-u', 'reviewer', '--lang', 'zh']).exitCode).toBe(0);
      expect(fs.existsSync(path.join(workspaceRoot, '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, '.agents', 'skills', 'spec-mcp-setup', 'mcp-tools.json'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, '.codex'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workspace', 'init-summary.json'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'config'))).toBe(false);
      expect(fs.existsSync(path.join(workspaceRoot, 'project-a', '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, 'project-b', '.gitignore'))).toBe(true);
      expect(fs.readFileSync(path.join(workspaceRoot, 'AGENTS.md'), 'utf8')).toContain('workspace-graph-targets.v1');
      expect(fs.readFileSync(path.join(workspaceRoot, 'AGENTS.md'), 'utf8')).toContain('target_repo');
      expect(fs.readFileSync(path.join(workspaceRoot, 'project-a', '.gitignore'), 'utf8')).toContain(buildSpecFirstGitignoreBlock());
      expect(fs.readFileSync(path.join(workspaceRoot, 'project-b', '.gitignore'), 'utf8')).toContain(buildSpecFirstGitignoreBlock());

      const summary = JSON.parse(fs.readFileSync(path.join(workspaceRoot, '.spec-first', 'workspace', 'init-summary.json'), 'utf8'));
      expect(summary.schema_version).toBe('workspace-init-summary.v1');
      expect(summary.selection_source).toBe('workspace-default-all-repos');
      expect(summary.parent_writes_repo_local_artifacts).toBe(false);
      expect(summary.parent_writes_host_runtime_assets).toBe(true);
      expect(summary.parent_host_runtime.overall_status).toBe('ready');
      expect(summary.counts).toMatchObject({ total: 2, ready: 2, action_required: 0 });
      expect(summary.counts.parent_runtime_ready).toBe(1);

      fs.rmSync(path.join(workspaceRoot, 'project-a', '.gitignore'), { force: true });
      fs.rmSync(path.join(workspaceRoot, 'project-b', '.gitignore'), { force: true });
      fs.rmSync(path.join(workspaceRoot, '.spec-first'), { recursive: true, force: true });

      expect(captureInit(workspaceRoot, ['--codex', '--repo', 'project-a', '-u', 'reviewer', '--lang', 'zh']).exitCode).toBe(0);
      expect(fs.existsSync(path.join(workspaceRoot, 'project-a', '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, 'project-b', '.gitignore'))).toBe(false);
      expect(fs.existsSync(path.join(workspaceRoot, '.gitignore'))).toBe(true);
    } finally {
      fs.rmSync(monorepoRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('init --all-repos dry-run previews child repos without writing parent or child files', () => {
    const workspaceRoot = makeTempDir();

    try {
      fs.mkdirSync(path.join(workspaceRoot, 'project-a', '.git'), { recursive: true });
      fs.mkdirSync(path.join(workspaceRoot, 'project-b', '.git'), { recursive: true });
      const before = snapshotTree(workspaceRoot);

      const result = captureInit(workspaceRoot, ['--codex', '--all-repos', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Workspace init: spec-first init (codex)');
      expect(result.stdout).toContain('selection_source: explicit-all-repos');
      expect(result.stdout).toContain('▶ Refresh parent host runtime assets');
      expect(result.stdout).toContain('Dry run: no parent advisory summary was written.');
      expect(snapshotTree(workspaceRoot)).toEqual(before);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('workspace init summary includes child runtime untrack evidence', () => {
    const workspaceRoot = makeTempDir();
    const childRoot = path.join(workspaceRoot, 'project-a');

    try {
      fs.mkdirSync(childRoot, { recursive: true });
      initGitRepo(childRoot);
      writeFile(childRoot, '.codex/spec-first/.developer');
      commitAll(childRoot);

      const result = captureInit(workspaceRoot, ['--codex', '--all-repos', '-u', 'reviewer', '--lang', 'zh']);

      expect(result.exitCode).toBe(0);
      expect(tracked(childRoot, '.codex/spec-first/.developer')).toBe('');
      expect(fs.existsSync(path.join(childRoot, '.codex/spec-first/.developer'))).toBe(true);

      const summary = JSON.parse(fs.readFileSync(
        path.join(workspaceRoot, '.spec-first', 'workspace', 'init-summary.json'),
        'utf8',
      ));
      expect(summary.counts.runtime_untrack_total).toBe(1);
      expect(summary.results[0].runtime_untrack).toMatchObject({
        count: 1,
        reason_code: 'untracked-runtime',
      });
      expect(summary.parent_host_runtime.runtime_untrack).toBeDefined();
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('init rejects invalid workspace target flag combinations', () => {
    const projectRoot = makeTempDir();
    const workspaceRoot = makeTempDir();

    try {
      fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
      fs.mkdirSync(path.join(workspaceRoot, 'project-a', '.git'), { recursive: true });

      const allReposInsideGit = captureInit(projectRoot, ['--codex', '--all-repos', '-u', 'reviewer', '--lang', 'zh']);
      expect(allReposInsideGit.exitCode).toBe(2);
      expect(allReposInsideGit.stderr).toContain('--all-repos must be run from a parent workspace');
      expect(fs.existsSync(path.join(projectRoot, '.gitignore'))).toBe(false);

      const conflicting = captureInit(workspaceRoot, ['--codex', '--all-repos', '--repo', 'project-a', '-u', 'reviewer', '--lang', 'zh']);
      expect(conflicting.exitCode).toBe(2);
      expect(conflicting.stderr).toContain('Cannot combine --repo and --all-repos');
      expect(fs.existsSync(path.join(workspaceRoot, '.gitignore'))).toBe(false);
      expect(fs.existsSync(path.join(workspaceRoot, 'project-a', '.gitignore'))).toBe(false);

      const emptyRepoEquals = captureInit(workspaceRoot, ['--codex', '--repo=', '-u', 'reviewer', '--lang', 'zh']);
      expect(emptyRepoEquals.exitCode).toBe(2);
      expect(emptyRepoEquals.stderr).toContain('Usage: spec-first init');
      expect(fs.existsSync(path.join(workspaceRoot, 'project-a', '.gitignore'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('init --repo rejects symlink targets that escape the parent workspace', () => {
    const workspaceRoot = makeTempDir();
    const outsideRepo = makeTempDir();

    try {
      fs.mkdirSync(path.join(outsideRepo, '.git'), { recursive: true });
      const linkedRepo = path.join(workspaceRoot, 'linked-outside');
      try {
        fs.symlinkSync(outsideRepo, linkedRepo, 'dir');
      } catch (_error) {
        return;
      }

      const result = captureInit(workspaceRoot, ['--codex', '--repo', 'linked-outside', '-u', 'reviewer', '--lang', 'zh']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('--repo target must be inside the current workspace');
      expect(fs.existsSync(path.join(outsideRepo, '.gitignore'))).toBe(false);
      expect(fs.existsSync(path.join(outsideRepo, 'AGENTS.md'))).toBe(false);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
      fs.rmSync(outsideRepo, { recursive: true, force: true });
    }
  });

  test('init apply prints host-aware setup guidance after installing runtime assets', () => {
    const claudeProjectRoot = makeTempDir();
    const codexProjectRoot = makeTempDir();
    const englishProjectRoot = makeTempDir();

    try {
      const claude = captureInit(claudeProjectRoot, ['--claude', '-u', 'reviewer', '--lang', 'zh']);
      expect(claude.exitCode).toBe(0);
      expect(claude.stderr).toBe('');
      expect(claude.stdout).toContain('下一步:');
      expect(claude.stdout).toContain('重启 Claude Code 或新开会话');
      expect(claude.stdout).toContain('对 docs、小修复、首次试用或轻量 plan/work/review');
      expect(claude.stdout).toContain('需要增强 readiness 时');
      expect(claude.stdout).toContain('/spec:mcp-setup');
      expect(claude.stdout).toContain('/spec:graph-bootstrap');
      expect(claude.stdout).not.toContain('/spec:' + 'standards');
      expect(claude.stdout).toContain('graph readiness 就绪后');
      expect(claude.stdout).toContain('按用户意图进入 brainstorm/plan/work/review/debug 等 workflow');
      expect(claude.stdout).toContain('项目指导来自 AGENTS.md、CLAUDE.md、docs/contracts');
      expect(claude.stdout).not.toContain('child-local baselines');

      const codex = captureInit(codexProjectRoot, ['--codex', '-u', 'reviewer', '--lang', 'zh']);
      expect(codex.exitCode).toBe(0);
      expect(codex.stderr).toBe('');
      expect(codex.stdout).toContain('下一步:');
      expect(codex.stdout).toContain('重启 Codex 或新开会话');
      expect(codex.stdout).toContain('对 docs、小修复、首次试用或轻量 plan/work/review');
      expect(codex.stdout).toContain('需要增强 readiness 时');
      expect(codex.stdout).toContain('$spec-mcp-setup');
      expect(codex.stdout).toContain('$spec-graph-bootstrap');
      expect(codex.stdout).not.toContain('$spec-' + 'standards');
      expect(codex.stdout).toContain('graph readiness 就绪后');
      expect(codex.stdout).toContain('按用户意图进入 brainstorm/plan/work/review/debug 等 workflow');
      expect(codex.stdout).toContain('项目指导来自 AGENTS.md、CLAUDE.md、docs/contracts');
      expect(codex.stdout).not.toContain('child-local baselines');

      const english = captureInit(englishProjectRoot, ['--codex', '-u', 'reviewer', '--lang', 'en']);
      expect(english.exitCode).toBe(0);
      expect(english.stderr).toBe('');
      expect(english.stdout).toContain('Next steps:');
      expect(english.stdout).toContain('Restart Codex or open a new session');
      expect(english.stdout).toContain('For lightweight docs, small fixes, first trials, or lightweight plan/work/review');
      expect(english.stdout).toContain('For enhanced readiness');
      expect(english.stdout).toContain('$spec-mcp-setup');
      expect(english.stdout).toContain('$spec-graph-bootstrap');
      expect(english.stdout).not.toContain('$spec-' + 'standards');
      expect(english.stdout).toContain('After graph readiness is ready');
      expect(english.stdout).toContain('choose the next workflow by user intent');
      expect(english.stdout).toContain('Project guidance comes from AGENTS.md, CLAUDE.md, docs/contracts');
      expect(english.stdout).not.toContain('child-local baselines');
      expect(english.stdout).not.toContain('下一步:');
    } finally {
      fs.rmSync(claudeProjectRoot, { recursive: true, force: true });
      fs.rmSync(codexProjectRoot, { recursive: true, force: true });
      fs.rmSync(englishProjectRoot, { recursive: true, force: true });
    }
  });

  test('current runtime drift switches dry-run into managed hard reset preview', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      fs.mkdirSync(path.join(projectRoot, '.claude', 'commands', 'spec'), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, '.claude', 'commands', 'spec', 'custom.md'),
        'custom command\n',
        'utf8',
      );

      const commandPath = path.join(projectRoot, '.claude', 'commands', 'spec', 'work.md');
      const drifted = fs.readFileSync(commandPath, 'utf8')
        .replace(
          "Derive tasks from the plan's implementation units",
          'Derive tasks from an unrelated source',
        );
      fs.writeFileSync(commandPath, drifted, 'utf8');

      const result = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Would perform a managed hard reset before regenerating runtime assets');
      expect(result.stdout).toContain('current runtime drift detected');
      expect(result.stdout).toContain('.claude/commands/spec/work.md');
      expect(result.stdout).toContain('Would prune 1 unmanaged command file(s)');
      expect(result.stdout).toContain('.claude/commands/spec/custom.md');
      expect(result.stdout).toContain('.claude/spec-first/workflows/spec-mcp-setup/scripts/check-health');
    } finally {
      warnSpy.mockRestore();
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init keeps external graph-bootstrap command as an active managed command', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const graphBootstrapFile = ['graph', 'bootstrap'].join('-') + '.md';
    const graphBootstrapPath = path.join(projectRoot, '.claude', 'commands', 'spec', graphBootstrapFile);

    try {
      expect(withCwd(projectRoot, () => runInit(['--claude', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);
      const statePath = path.join(projectRoot, '.claude', 'spec-first', 'state.json');
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

      expect(state.commands).toContain(graphBootstrapFile);
      expect(fs.existsSync(graphBootstrapPath)).toBe(true);
      expect(fs.readFileSync(graphBootstrapPath, 'utf8')).toContain('spec-graph-bootstrap');

      const dryRun = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.stdout).toContain(path.posix.join('.claude/commands/spec', graphBootstrapFile));
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
