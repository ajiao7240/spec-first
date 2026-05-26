'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');
const {
  BOOTSTRAP_END,
  BOOTSTRAP_START,
  buildBootstrapBlock,
} = require('../../src/cli/instruction-bootstrap');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GUIDANCE_FILES = ['AGENTS.md', 'CLAUDE.md'];

function extractBootstrapBlock(text) {
  const startIndex = text.indexOf(BOOTSTRAP_START);
  const endIndex = text.indexOf(BOOTSTRAP_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }
  return text.slice(startIndex, endIndex + BOOTSTRAP_END.length);
}

describe('repository guidance contracts', () => {
  test.each(GUIDANCE_FILES)('%s explains source/runtime validation for agent and skill changes', (fileName) => {
    const text = fs.readFileSync(path.join(REPO_ROOT, fileName), 'utf8');

    expect(text).toContain('Agent 与 Skill 变更验证');
    expect(text).toContain('优先验证源码真相源');
    expect(text).toContain('fresh-source eval');
    expect(text).toContain('全新通用 subagent');
    expect(text).toContain('不要依赖当前会话已缓存的 typed-agent / skill 调用');
    expect(text).toContain('不要手改 `.claude/`、`.codex/`、`.agents/skills/`');
    expect(text).toContain('spec-first init');
    expect(text).toContain('同一会话内的 typed-agent / skill 调用');
    expect(text).toContain('脚本类资产不受会话缓存限制');
  });

  test.each(GUIDANCE_FILES)('%s has a stable GitNexus evidence contract inside the managed block', (fileName) => {
    const text = fs.readFileSync(path.join(REPO_ROOT, fileName), 'utf8');
    const blockMatch = text.match(/<!-- gitnexus:start -->[\s\S]*?<!-- gitnexus:end -->/u);

    expect(blockMatch).not.toBeNull();
    const block = blockMatch[0];
    const summaries = block.match(/本项目已配置 GitNexus 图谱支持，仓库标识：\*\*spec-first\*\*/gu) || [];
    expect(summaries).toHaveLength(1);
    expect(block).toContain('**必须先**读取 `.spec-first/graph/graph-facts.json`');
    expect(block).toContain('`capabilities.query_global_graph`');
    expect(block).toContain('**使用 GitNexus 作为首选工具**');
    expect(block).not.toContain('docs/contracts/graph-evidence-policy.md');
    expect(block).not.toContain('边界：');
    expect(block).not.toMatch(/\([0-9,]+ symbols, [0-9,]+ relationships, [0-9,]+ execution flows\)/u);
    expect(block).not.toContain('MUST run impact analysis');
    expect(block).not.toContain('NEVER edit');
    expect(block).not.toContain('.claude/skills/gitnexus');
  });

  test.each([
    ['AGENTS.md', 'codex'],
    ['CLAUDE.md', 'claude'],
  ])('%s managed bootstrap matches the zh generator output', (fileName, adapterId) => {
    const text = fs.readFileSync(path.join(REPO_ROOT, fileName), 'utf8');
    const startMarkers = text.match(new RegExp(BOOTSTRAP_START, 'g')) || [];

    expect(startMarkers).toHaveLength(1);
    expect(extractBootstrapBlock(text)).toBe(buildBootstrapBlock(getAdapter(adapterId), 'zh'));
  });
});
