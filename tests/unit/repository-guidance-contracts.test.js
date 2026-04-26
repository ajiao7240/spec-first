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
});
