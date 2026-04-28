'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');
const { buildManagedBlock } = require('../../src/cli/lang-policy');
const {
  applyManagedBootstrapBlock,
  buildBootstrapBlock,
} = require('../../src/cli/instruction-bootstrap');
const {
  applyManagedCodingGuidelinesBlock,
  buildCodingGuidelinesBlock,
} = require('../../src/cli/coding-guidelines');
const {
  RUNTIME_TOOLS_END,
  RUNTIME_TOOLS_START,
  applyManagedRuntimeToolsBlock,
  buildRuntimeToolsBlock,
  inspectRuntimeToolsIndexBlock,
  removeManagedRuntimeToolsBlock,
  writeRuntimeToolsIndexBlock,
} = require('../../src/cli/runtime-tools-index');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-runtime-tools-'));
}

function buildExistingManagedContent(adapter, lang = 'zh') {
  const withLang = buildManagedBlock(lang);
  const withBootstrap = applyManagedBootstrapBlock(withLang, buildBootstrapBlock(adapter, lang));
  return applyManagedCodingGuidelinesBlock(withBootstrap, buildCodingGuidelinesBlock(lang));
}

describe('runtime tools instruction block', () => {
  test('writes the managed block into an empty instruction file', () => {
    const block = buildRuntimeToolsBlock('codex', 'zh');

    expect(applyManagedRuntimeToolsBlock('', block)).toBe(block);
  });

  test('builds host-specific Chinese runtime tool guidance', () => {
    const codexBlock = buildRuntimeToolsBlock('codex', 'zh');
    const claudeBlock = buildRuntimeToolsBlock('claude', 'zh');

    expect(codexBlock).toContain('## 代码智能与运行时工具（由 spec-first 管理）');
    expect(codexBlock).toContain('.agents/skills/spec-mcp-setup/references/supported-mcp-tools.md');
    expect(codexBlock).toContain('$spec-graph-bootstrap');
    expect(codexBlock).toContain('canonical graph facts / provider readiness');
    expect(codexBlock).toContain('blocked、stale 或未 ready');
    expect(codexBlock).toContain('若本文件存在 `<!-- gitnexus:start -->` 管理块，优先遵守该块的强制规则');

    expect(claudeBlock).toContain('.claude/skills/spec-mcp-setup/references/supported-mcp-tools.md');
    expect(claudeBlock).toContain('/spec:graph-bootstrap');
    expect(claudeBlock).not.toContain('$spec-graph-bootstrap');
  });

  test('builds English runtime tool guidance without translating technical identifiers', () => {
    const block = buildRuntimeToolsBlock('codex', 'en');

    expect(block).toContain('## Runtime Code Intelligence Tools (managed by spec-first)');
    expect(block).toContain('GitNexus');
    expect(block).toContain('code-review-graph');
    expect(block).toContain('Serena MCP');
    expect(block).toContain('ast-grep');
    expect(block).toContain('.agents/skills/spec-mcp-setup/references/supported-mcp-tools.md');
    expect(block).toContain('$spec-graph-bootstrap');
    expect(block).toContain('canonical graph facts / provider readiness');
    expect(block).toContain('blocked, stale, or not ready');
  });

  test('does not duplicate install commands or dynamic readiness facts', () => {
    const block = buildRuntimeToolsBlock('codex', 'zh');

    expect(block).not.toContain('npx -y gitnexus@latest analyze');
    expect(block).not.toContain('uvx code-review-graph build');
    expect(block).not.toContain('brew install');
    expect(block).not.toContain('cargo install');
    expect(block).not.toContain('symbol count');
    expect(block).not.toContain('relationship count');
    expect(block).not.toContain('query_ready=true');
  });

  test('is idempotent and follows existing spec-first managed blocks', () => {
    const adapter = getAdapter('codex');
    const existing = buildExistingManagedContent(adapter, 'zh');
    const block = buildRuntimeToolsBlock(adapter, 'zh');
    const once = applyManagedRuntimeToolsBlock(existing, block);
    const twice = applyManagedRuntimeToolsBlock(once, block);

    expect(twice).toBe(once);
    expect(twice.indexOf('<!-- spec-first:lang:start -->')).toBeLessThan(twice.indexOf('<!-- spec-first:bootstrap:start -->'));
    expect(twice.indexOf('<!-- spec-first:bootstrap:start -->')).toBeLessThan(twice.indexOf('<!-- spec-first:coding-guidelines:start -->'));
    expect(twice.indexOf('<!-- spec-first:coding-guidelines:start -->')).toBeLessThan(twice.indexOf(RUNTIME_TOOLS_START));
    expect(twice.match(/<!-- spec-first:runtime-tools:start -->/g)).toHaveLength(1);
  });

  test('inserts before external GitNexus block without changing it', () => {
    const gitnexusBlock = [
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      '',
      'External managed content.',
      '<!-- gitnexus:end -->',
      '',
    ].join('\n');
    const existing = ['# Repo', '', gitnexusBlock].join('\n');
    const block = buildRuntimeToolsBlock('codex', 'zh');

    const updated = applyManagedRuntimeToolsBlock(existing, block);
    const gitnexusStart = updated.lastIndexOf('<!-- gitnexus:start -->');

    expect(updated.indexOf(RUNTIME_TOOLS_START)).toBeLessThan(gitnexusStart);
    expect(updated.slice(gitnexusStart)).toBe(gitnexusBlock);
  });

  test('repairs corrupted markers by removing stale runtime tools body', () => {
    const corrupted = [
      '# Header',
      '',
      RUNTIME_TOOLS_START,
      buildRuntimeToolsBlock('claude', 'en')
        .replace(`${RUNTIME_TOOLS_START}\n`, '')
        .replace(`\n${RUNTIME_TOOLS_END}`, '')
        .replace('Runtime Code Intelligence Tools', 'Runtime Tool Drift'),
      '',
      '# Tail',
    ].join('\n');

    const updated = applyManagedRuntimeToolsBlock(corrupted, buildRuntimeToolsBlock('codex', 'zh'));

    expect(updated).toContain('# Header');
    expect(updated).toContain('# Tail');
    expect(updated).toContain('## 代码智能与运行时工具（由 spec-first 管理）');
    expect(updated).not.toContain('Runtime Tool Drift');
    expect(updated.match(/<!-- spec-first:runtime-tools:start -->/g)).toHaveLength(1);
    expect(updated.match(/<!-- spec-first:runtime-tools:end -->/g)).toHaveLength(1);
  });

  test('removes only the managed block and preserves surrounding content', () => {
    const content = [
      '# Header',
      '',
      buildRuntimeToolsBlock('codex', 'zh'),
      '',
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      '<!-- gitnexus:end -->',
      '',
    ].join('\n');

    const updated = removeManagedRuntimeToolsBlock(content);

    expect(updated).toContain('# Header');
    expect(updated).toContain('<!-- gitnexus:start -->');
    expect(updated).toContain('# GitNexus — Code Intelligence');
    expect(updated).not.toContain(RUNTIME_TOOLS_START);
    expect(updated).not.toContain(RUNTIME_TOOLS_END);
  });

  test('inspects installed, missing, partial, and drifted runtime tools blocks', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('codex');
    const filePath = path.join(projectRoot, adapter.instructionFile);

    try {
      expect(inspectRuntimeToolsIndexBlock(projectRoot, adapter)).toEqual({
        status: 'missing',
        message: 'AGENTS.md is missing',
      });

      fs.writeFileSync(filePath, '# Repo\n', 'utf8');
      expect(inspectRuntimeToolsIndexBlock(projectRoot, adapter)).toEqual({
        status: 'missing',
        message: 'managed runtime-tools block missing',
      });

      fs.writeFileSync(filePath, `${RUNTIME_TOOLS_START}\npartial\n`, 'utf8');
      expect(inspectRuntimeToolsIndexBlock(projectRoot, adapter)).toEqual({
        status: 'partial',
        message: 'managed runtime-tools markers are incomplete',
      });

      writeRuntimeToolsIndexBlock(projectRoot, adapter, 'zh');
      expect(inspectRuntimeToolsIndexBlock(projectRoot, adapter)).toEqual({
        status: 'installed',
        message: 'managed runtime-tools block present',
      });

      const drifted = fs.readFileSync(filePath, 'utf8').replace('代码智能与运行时工具', '运行时工具');
      fs.writeFileSync(filePath, drifted, 'utf8');
      expect(inspectRuntimeToolsIndexBlock(projectRoot, adapter)).toEqual({
        status: 'drifted',
        message: 'managed runtime-tools block drifted from the bundled template',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
