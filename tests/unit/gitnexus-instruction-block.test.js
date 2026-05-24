'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  normalizeGitNexusInstructionBlock,
  normalizeGitNexusInstructionFiles,
  renderGitNexusInstructionBlock,
  runGitNexusInstructionBlockCommand,
  summarizeGitNexusInstructionResults,
} = require('../../src/cli/gitnexus-instruction-block');

describe('GitNexus instruction block governance', () => {
  test('normalizes legacy provider prose into the stable evidence contract', () => {
    const existing = [
      '# Instructions',
      '',
      '<!-- spec-first:lang:start -->',
      '## 语言与治理策略（由 spec-first 管理）',
      '**语言设置：** `Chinese / 中文`',
      '<!-- spec-first:lang:end -->',
      '',
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      '',
      'This project is indexed by GitNexus as **spec-first** (26859 symbols, 31088 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.',
      '',
      '## Always Do',
      '- **MUST run impact analysis before editing any symbol.**',
      '',
      '## CLI',
      '| Understand architecture | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |',
      '',
      '<!-- gitnexus:end -->',
    ].join('\n');

    const result = normalizeGitNexusInstructionBlock(existing, {
      defaultRepoName: 'fallback',
    });

    expect(result.status).toBe('updated');
    expect(result.repoName).toBe('spec-first');
    expect(result.content).toContain('本项目已配置 GitNexus 图谱支持，仓库标识：**spec-first**');
    expect(result.content).toContain('**必须先**读取 `.spec-first/graph/graph-facts.json`');
    expect(result.content).toContain('`capabilities.query_global_graph`');
    expect(result.content).toContain('**使用 GitNexus 作为首选工具**');
    expect(result.content).toContain('fallback 到 grep/Read');
    expect(result.content).not.toContain('docs/contracts/graph-evidence-policy.md');
    expect(result.content).not.toContain('边界：');
    expect(result.content).not.toContain('26859 symbols');
    expect(result.content).not.toContain('MUST run impact');
    expect(result.content).not.toContain('.claude/skills/gitnexus');
  });

  test('renders English when the instruction language is English', () => {
    const existing = [
      '<!-- spec-first:lang:start -->',
      '## Language and Governance Policy',
      '**Language setting:** `English / 英文`',
      '<!-- spec-first:lang:end -->',
      '',
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      'This project is indexed by GitNexus as **docs-repo** (1 symbols, 2 relationships, 3 execution flows).',
      '<!-- gitnexus:end -->',
    ].join('\n');

    const result = normalizeGitNexusInstructionBlock(existing);

    expect(result.content).toContain('This project has GitNexus graph support for **docs-repo**');
    expect(result.content).toContain('**first** read `.spec-first/graph/graph-facts.json`');
    expect(result.content).toContain('`capabilities.query_global_graph`');
    expect(result.content).toContain('**use GitNexus as the preferred tool**');
    expect(result.content).toContain('fall back to grep/Read');
    expect(result.content).not.toContain('docs/contracts/graph-evidence-policy.md');
    expect(result.content).not.toContain('Boundaries:');
    expect(result.content).not.toContain('1 symbols');
  });

  test('normalizes both checked-in host instruction files when a block exists', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-instruction-'));
    try {
      for (const fileName of ['AGENTS.md', 'CLAUDE.md']) {
        fs.writeFileSync(
          path.join(projectRoot, fileName),
          [
            '# Host',
            '',
            '<!-- gitnexus:start -->',
            '# GitNexus — Code Intelligence',
            'This project is indexed by GitNexus as **sample-repo** (10 symbols, 20 relationships, 30 execution flows).',
            '<!-- gitnexus:end -->',
          ].join('\n'),
          'utf8',
        );
      }

      const results = normalizeGitNexusInstructionFiles(projectRoot, {
        write: true,
        defaultRepoName: 'sample-repo',
        lang: 'zh',
      });

      expect(results.map((result) => result.status)).toEqual(['updated', 'updated']);
      for (const fileName of ['AGENTS.md', 'CLAUDE.md']) {
        const content = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
        expect(content).toContain('仓库标识：**sample-repo**');
        expect(content).not.toContain('symbols');
      }
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('does not create a missing block unless creation is requested', () => {
    const existing = [
      '# Instructions',
      '',
      '<!-- spec-first:lang:start -->',
      '## 语言与治理策略',
      '**语言设置：** `Chinese / 中文`',
      '<!-- spec-first:lang:end -->',
    ].join('\n');

    const result = normalizeGitNexusInstructionBlock(existing, {
      defaultRepoName: 'sample-repo',
    });

    expect(result.status).toBe('missing');
    expect(result.changed).toBe(false);
    expect(result.content).toBe(existing);
  });

  test('creates a stable block when creation is requested', () => {
    const existing = [
      '# Instructions',
      '',
      '<!-- spec-first:lang:start -->',
      '## Language and Governance Policy',
      '**Language setting:** `English / 英文`',
      '<!-- spec-first:lang:end -->',
    ].join('\n');

    const result = normalizeGitNexusInstructionBlock(existing, {
      createMissing: true,
      defaultRepoName: 'sample-repo',
    });

    expect(result.status).toBe('created');
    expect(result.changed).toBe(true);
    expect(result.repoName).toBe('sample-repo');
    expect(result.content).toContain('<!-- gitnexus:start -->');
    expect(result.content).toContain('This project has GitNexus graph support for **sample-repo**');
    expect(result.content).toContain('**first** read `.spec-first/graph/graph-facts.json`');
    expect(result.content).not.toContain('docs/contracts/graph-evidence-policy.md');
    expect(result.content).toContain('<!-- gitnexus:end -->');
  });

  test('renders single-repo GitNexus block with graph-facts readiness check', () => {
    const block = renderGitNexusInstructionBlock({
      repoName: 'sample-repo',
      lang: 'zh',
      gitRootTopology: 'single-repo',
    });

    expect(block).toContain('`.spec-first/graph/graph-facts.json`');
    expect(block).toContain('`capabilities.query_global_graph`');
    expect(block).not.toContain('`.spec-first/workspace/graph-targets.json`');
    expect(block).not.toContain('`.spec-first/workspace/gitnexus-readiness.json`');
  });

  test('renders parent workspace GitNexus block with workspace advisory paths', () => {
    const block = renderGitNexusInstructionBlock({
      repoName: 'sample-repo',
      lang: 'zh',
      gitRootTopology: 'multi-repo-workspace',
    });

    expect(block).toContain('`.spec-first/workspace/graph-targets.json`');
    expect(block).toContain('`.spec-first/workspace/gitnexus-readiness.json`');
    expect(block).not.toContain('`.spec-first/graph/graph-facts.json`');
  });

  test('CLI creates missing blocks in existing host instruction files', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-instruction-create-'));
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const fileName of ['AGENTS.md', 'CLAUDE.md']) {
        fs.writeFileSync(path.join(projectRoot, fileName), '# Host\n', 'utf8');
      }

      const exitCode = runGitNexusInstructionBlockCommand([
        'normalize',
        '--repo-root',
        projectRoot,
        '--repo-name',
        'sample-repo',
        '--write',
        '--json',
      ]);
      const payload = JSON.parse(stdoutSpy.mock.calls.map((call) => call[0]).join(''));

      expect(exitCode).toBe(0);
      expect(payload.overall_status).toBe('normalized');
      expect(payload.reason_code).toBeNull();
      expect(payload.results).toEqual([
        expect.objectContaining({ file: 'AGENTS.md', status: 'created', changed: true, wouldChange: true, written: true, action: 'created', repoName: 'sample-repo' }),
        expect.objectContaining({ file: 'CLAUDE.md', status: 'created', changed: true, wouldChange: true, written: true, action: 'created', repoName: 'sample-repo' }),
      ]);
      for (const fileName of ['AGENTS.md', 'CLAUDE.md']) {
        const content = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
        expect(content).toContain('仓库标识：**sample-repo**');
        expect(content).toContain('**必须先**读取 `.spec-first/graph/graph-facts.json`');
        expect(content).not.toContain('docs/contracts/graph-evidence-policy.md');
      }
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('CLI dry-run distinguishes would-change from written state', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-instruction-dry-run-'));
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# Host\n', 'utf8');
      fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), '# Host\n', 'utf8');

      const exitCode = runGitNexusInstructionBlockCommand([
        'normalize',
        '--repo-root',
        projectRoot,
        '--repo-name',
        'sample-repo',
        '--json',
      ]);
      const payload = JSON.parse(stdoutSpy.mock.calls.map((call) => call[0]).join(''));

      expect(exitCode).toBe(0);
      expect(payload.write).toBe(false);
      expect(payload.results).toEqual([
        expect.objectContaining({ file: 'AGENTS.md', status: 'created', changed: true, wouldChange: true, written: false, action: 'would-create' }),
        expect.objectContaining({ file: 'CLAUDE.md', status: 'created', changed: true, wouldChange: true, written: false, action: 'would-create' }),
      ]);
      expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toBe('# Host\n');
    } finally {
      stdoutSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('CLI text output marks dry-run operations as would create or would normalize', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-instruction-text-'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# Host\n', 'utf8');
      fs.writeFileSync(
        path.join(projectRoot, 'CLAUDE.md'),
        [
          '# Host',
          '',
          '<!-- gitnexus:start -->',
          '# GitNexus — Code Intelligence',
          'This project is indexed by GitNexus as **sample-repo** (1 symbols, 2 relationships, 3 execution flows).',
          '<!-- gitnexus:end -->',
        ].join('\n'),
        'utf8',
      );

      const exitCode = runGitNexusInstructionBlockCommand([
        'normalize',
        '--repo-root',
        projectRoot,
        '--repo-name',
        'sample-repo',
      ]);
      const output = logSpy.mock.calls.map((call) => call[0]).join('\n');

      expect(exitCode).toBe(0);
      expect(output).toContain('would create AGENTS.md');
      expect(output).toContain('would normalize CLAUDE.md');
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('stable render output contains no dynamic index counts', () => {
    const block = renderGitNexusInstructionBlock({ repoName: 'spec-first', lang: 'zh' });

    expect(block).toContain('<!-- gitnexus:start -->');
    expect(block).toContain('<!-- gitnexus:end -->');
    expect(block).not.toMatch(/\d+ symbols/u);
    expect(block).not.toContain('MUST');
    expect(block).not.toContain('NEVER');
  });

  test('renders multi-repo workspace instructions with workspace artifact pointers only', () => {
    const block = renderGitNexusInstructionBlock({
      repoName: 'workspace-parent',
      lang: 'zh',
      gitRootTopology: 'multi-repo-workspace',
    });

    expect(block).toContain('本工作区包含多个 child Git repo');
    expect(block).toContain('`.spec-first/workspace/graph-targets.json`');
    expect(block).toContain('`.spec-first/workspace/gitnexus-readiness.json`');
    expect(block).toContain('Parent workspace 不拥有 child repo 的 `.spec-first/graph/*` canonical artifacts');
    expect(block).not.toContain('`.spec-first/graph/graph-facts.json`');
    expect(block).not.toContain('仓库标识：**workspace-parent**');
  });

  test('CLI passes multi-repo topology into JSON summary and rendered files', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-instruction-topology-'));
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# Host\n', 'utf8');
      fs.writeFileSync(path.join(projectRoot, 'CLAUDE.md'), '# Host\n', 'utf8');

      const exitCode = runGitNexusInstructionBlockCommand([
        'normalize',
        '--repo-root',
        projectRoot,
        '--repo-name',
        'workspace-parent',
        '--git-root-topology',
        'multi-repo-workspace',
        '--write',
        '--json',
      ]);
      const payload = JSON.parse(stdoutSpy.mock.calls.map((call) => call[0]).join(''));

      expect(exitCode).toBe(0);
      expect(payload.git_root_topology).toBe('multi-repo-workspace');
      expect(payload.results).toEqual([
        expect.objectContaining({ file: 'AGENTS.md', gitRootTopology: 'multi-repo-workspace' }),
        expect.objectContaining({ file: 'CLAUDE.md', gitRootTopology: 'multi-repo-workspace' }),
      ]);
      const content = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
      expect(content).toContain('`.spec-first/workspace/graph-targets.json`');
      expect(content).not.toContain('`.spec-first/graph/graph-facts.json`');
    } finally {
      stdoutSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('CLI rejects invalid git root topology values', () => {
    const stderrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const exitCode = runGitNexusInstructionBlockCommand([
        'normalize',
        '--git-root-topology',
        'single-repo-multi-module',
      ]);

      expect(exitCode).toBe(2);
      expect(stderrSpy).toHaveBeenCalledWith('gitnexus-instruction: --git-root-topology must be single-repo or multi-repo-workspace');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  test('summarizes partial blocks as actionable failures', () => {
    const summary = summarizeGitNexusInstructionResults([
      {
        file: 'AGENTS.md',
        status: 'partial',
        changed: false,
        repoName: '',
      },
    ]);

    expect(summary).toEqual({
      overallStatus: 'partial',
      reasonCode: 'gitnexus-instruction-block-partial',
      exitCode: 3,
    });
  });

  test('CLI JSON reports partial blocks with a non-zero exit code', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-instruction-partial-'));
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      fs.writeFileSync(
        path.join(projectRoot, 'AGENTS.md'),
        [
          '# Host',
          '',
          '<!-- gitnexus:start -->',
          '# GitNexus — Code Intelligence',
        ].join('\n'),
        'utf8',
      );

      const exitCode = runGitNexusInstructionBlockCommand(['normalize', '--repo-root', projectRoot, '--write', '--json']);
      const payload = JSON.parse(stdoutSpy.mock.calls.map((call) => call[0]).join(''));

      expect(exitCode).toBe(3);
      expect(payload.overall_status).toBe('partial');
      expect(payload.reason_code).toBe('gitnexus-instruction-block-partial');
      expect(payload.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          file: 'AGENTS.md',
          status: 'partial',
        }),
      ]));
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
