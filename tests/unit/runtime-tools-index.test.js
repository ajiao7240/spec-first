'use strict';

const {
  RUNTIME_TOOLS_END,
  RUNTIME_TOOLS_START,
  removeManagedRuntimeToolsBlock,
} = require('../../src/cli/runtime-tools-index');

function legacyRuntimeToolsBlock() {
  return [
    RUNTIME_TOOLS_START,
    '## 代码智能与运行时工具（由 spec-first 管理）',
    '',
    '`spec-mcp-setup` 管理本项目推荐/必需的 MCP servers、graph-provider MCP servers 与 helper tooling。',
    '',
    '### 使用边界',
    '- `GitNexus`：用于全局代码知识图谱、架构理解、自然语言代码咨询/搜索、相似模块查找、执行流查询、影响分析和提交前变更检测。',
    '- `code-review-graph`：用于变更集影响分析、review context、相关测试和 graph stats。',
    '- `Serena MCP`：用于 symbol overview、symbol lookup、references、LSP 辅助定位和精确编辑。',
    '- `ast-grep`：用于结构化代码搜索和安全 rewrite。',
    '',
    '### 不要做',
    '- 不要把 helper tools 当成 MCP server 写入 `mcp-tools.json`。',
    '- 不要在本文件复制安装命令、版本号、完整工具表或动态 ready 状态。',
    '',
    RUNTIME_TOOLS_END,
  ].join('\n');
}

describe('legacy runtime tools instruction cleanup', () => {
  test('exports only marker constants and the legacy cleanup helper', () => {
    const runtimeToolsIndex = require('../../src/cli/runtime-tools-index');

    expect(runtimeToolsIndex).toEqual({
      RUNTIME_TOOLS_END,
      RUNTIME_TOOLS_START,
      removeManagedRuntimeToolsBlock,
    });
  });

  test('removes only the managed block and preserves surrounding content', () => {
    const content = [
      '# Header',
      '',
      legacyRuntimeToolsBlock(),
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
    expect(updated).not.toContain('代码智能与运行时工具');
  });

  test('repairs partial legacy markers by stripping the loose managed section', () => {
    const corrupted = [
      '# Header',
      '',
      RUNTIME_TOOLS_START,
      '## Runtime Code Intelligence Tools (managed by spec-first)',
      '',
      '`spec-mcp-setup` manages the MCP servers and helper tooling.',
      '',
      '### Usage Boundaries',
      '- `GitNexus`: Use for global code knowledge.',
      '- `code-review-graph`: Use for change-set impact analysis.',
      '- `Serena MCP`: Use for symbol lookup.',
      '- `ast-grep`: Use for structural code search.',
      '',
      '### Do Not',
      '- Do not write helper tools into `mcp-tools.json` as MCP servers.',
      '- Do not duplicate install commands.',
      '',
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      '<!-- gitnexus:end -->',
      '',
    ].join('\n');

    const updated = removeManagedRuntimeToolsBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('<!-- gitnexus:start -->');
    expect(updated).not.toContain(RUNTIME_TOOLS_START);
    expect(updated).not.toContain('Runtime Code Intelligence Tools');
  });

  test('repairs partial legacy markers when the visible heading is clean', () => {
    const corrupted = [
      '# Header',
      '',
      RUNTIME_TOOLS_START,
      '## Runtime Code Intelligence Tools',
      '',
      '`spec-mcp-setup` manages the MCP servers and helper tooling.',
      '',
      '### Usage Boundaries',
      '- `GitNexus`: Use for global code knowledge.',
      '- `code-review-graph`: Use for change-set impact analysis.',
      '- `Serena MCP`: Use for symbol lookup.',
      '- `ast-grep`: Use for structural code search.',
      '',
      '### Do Not',
      '- Do not write helper tools into `mcp-tools.json` as MCP servers.',
      '- Do not duplicate install commands.',
      '',
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      '<!-- gitnexus:end -->',
      '',
    ].join('\n');

    const updated = removeManagedRuntimeToolsBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('<!-- gitnexus:start -->');
    expect(updated).not.toContain(RUNTIME_TOOLS_START);
    expect(updated).not.toContain('Runtime Code Intelligence Tools');
  });

  test('leaves instruction files without legacy runtime tools unchanged except newline normalization', () => {
    const content = [
      '# Header',
      '',
      '<!-- gitnexus:start -->',
      '# GitNexus — Code Intelligence',
      '<!-- gitnexus:end -->',
      '',
    ].join('\n');

    expect(removeManagedRuntimeToolsBlock(content)).toBe(content);
  });
});
