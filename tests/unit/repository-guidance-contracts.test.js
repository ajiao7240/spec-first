'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GUIDANCE_FILES = ['AGENTS.md', 'CLAUDE.md'];

describe('repository guidance contracts', () => {
  test.each(GUIDANCE_FILES)('%s explains source/runtime validation for agent and skill changes', (fileName) => {
    const text = fs.readFileSync(path.join(REPO_ROOT, fileName), 'utf8');

    expect(text).toContain('Agent 与 Skill 变更验证');
    expect(text).toContain('优先验证源码真相源');
    expect(text).toContain('fresh-source eval');
    expect(text).toContain('全新通用 subagent');
    expect(text).toContain('不要依赖当前会话已缓存的 typed-agent / skill 调用');
    expect(text).toContain('不要手改 `.claude/`、`.codex/`、`.agents/skills/`');
    expect(text).toContain('spec-first init --claude|--codex');
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
    expect(block).toContain('当索引新鲜且 query-ready 时');
    expect(block).toContain('docs/contracts/graph-evidence-policy.md');
    expect(block).toContain('## 使用边界');
    expect(block).not.toMatch(/\([0-9,]+ symbols, [0-9,]+ relationships, [0-9,]+ execution flows\)/u);
    expect(block).not.toContain('MUST run impact analysis');
    expect(block).not.toContain('NEVER edit');
    expect(block).not.toContain('.claude/skills/gitnexus');
  });
});
