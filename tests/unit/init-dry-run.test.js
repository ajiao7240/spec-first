'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');

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

describe('init --dry-run', () => {
  test('init help includes concise post-init setup guidance', () => {
    const projectRoot = makeTempDir();

    try {
      const result = captureInit(projectRoot, ['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('After successful init');
      expect(result.stdout).toContain('/spec:mcp-setup');
      expect(result.stdout).toContain('/spec:graph-bootstrap');
      expect(result.stdout).toContain('$spec-mcp-setup');
      expect(result.stdout).toContain('$spec-graph-bootstrap');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init rejects unsupported force flag instead of silently accepting it', () => {
    const projectRoot = makeTempDir();

    try {
      const result = captureInit(projectRoot, ['--claude', '--force', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);

      expect(result.exitCode).toBe(1);
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
      expect(result.stdout).toContain('.claude/hooks/session-start');
      expect(result.stdout).toContain('.claude/spec-first/state.json');
      expect(result.stdout).toContain('No files were changed.');
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
        'CLAUDE.md',
      ]) {
        expect(dryRun.stdout).toContain(relativePath);
        expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(true);
      }

      const claudeInstruction = fs.readFileSync(path.join(projectRoot, 'CLAUDE.md'), 'utf8');
      expect(claudeInstruction).toContain('不要默认进入 `spec-brainstorm`');
      expect(claudeInstruction).toContain('/spec:optimize');
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

  test('Codex init does not write global runtime tool guidance into AGENTS.md', () => {
    const projectRoot = makeTempDir();
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const codexInstruction = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
      expect(codexInstruction).toContain('不要默认进入 `spec-brainstorm`');
      expect(codexInstruction).toContain('$spec-optimize');
      expect(codexInstruction).toContain('spec-first startup-reminder --codex');
      expect(codexInstruction).toContain('$spec-update');
      expect(codexInstruction).toContain('不阻塞路由');
      expect(codexInstruction).toContain('bounded subagents、leaf reviewers、worker agents 不运行该检查');
      expect(codexInstruction).not.toContain('<!-- spec-first:runtime-tools:start -->');
      expect(codexInstruction).not.toContain('代码智能与运行时工具');
      expect(codexInstruction).not.toContain('/spec:graph-bootstrap');

      const codexMcpSetupSkill = fs.readFileSync(
        path.join(projectRoot, '.agents', 'skills', 'spec-mcp-setup', 'SKILL.md'),
        'utf8',
      );
      const codexGraphBootstrapScript = path.join(projectRoot, '.agents', 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.sh');
      expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills', 'spec-mcp-setup', 'scripts', 'check-health'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills', 'spec-mcp-setup', 'scripts', 'resolve-project-target.sh'))).toBe(true);
      expect(fs.existsSync(codexGraphBootstrapScript)).toBe(true);
      expect(fs.readFileSync(codexGraphBootstrapScript, 'utf8')).toContain('../../spec-mcp-setup/scripts/resolve-project-target.sh');
      expect(codexMcpSetupSkill).toContain('bash .agents/skills/spec-mcp-setup/scripts/check-health');
      expect(codexMcpSetupSkill).not.toContain('bash skills/spec-mcp-setup/scripts/check-health');
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init removes legacy runtime tool guidance while preserving external GitNexus blocks', () => {
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
    } finally {
      initLogSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('init apply prints host-aware setup guidance after installing runtime assets', () => {
    const claudeProjectRoot = makeTempDir();
    const codexProjectRoot = makeTempDir();

    try {
      const claude = captureInit(claudeProjectRoot, ['--claude', '-u', 'reviewer', '--lang', 'zh']);
      expect(claude.exitCode).toBe(0);
      expect(claude.stderr).toBe('');
      expect(claude.stdout).toContain('下一步:');
      expect(claude.stdout).toContain('重启 Claude Code 或新开会话');
      expect(claude.stdout).toContain('/spec:mcp-setup');
      expect(claude.stdout).toContain('/spec:graph-bootstrap');

      const codex = captureInit(codexProjectRoot, ['--codex', '-u', 'reviewer', '--lang', 'zh']);
      expect(codex.exitCode).toBe(0);
      expect(codex.stderr).toBe('');
      expect(codex.stdout).toContain('下一步:');
      expect(codex.stdout).toContain('重启 Codex 或新开会话');
      expect(codex.stdout).toContain('$spec-mcp-setup');
      expect(codex.stdout).toContain('$spec-graph-bootstrap');
    } finally {
      fs.rmSync(claudeProjectRoot, { recursive: true, force: true });
      fs.rmSync(codexProjectRoot, { recursive: true, force: true });
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
