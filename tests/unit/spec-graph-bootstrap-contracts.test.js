'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md');
const PROMPT_MIRROR_PATH = path.join(
  REPO_ROOT,
  'docs',
  '10-prompt',
  'skills',
  'spec-graph-bootstrap',
  'SKILL.md',
);

describe('spec-graph-bootstrap live MCP probe contract', () => {
  test('keeps CLI readiness separate from session-local MCP evidence', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const mirror = fs.readFileSync(PROMPT_MIRROR_PATH, 'utf8');

    expect(skill).toContain('## Live MCP Probe');
    expect(skill).toContain('The deterministic bootstrap script cannot call host MCP tools.');
    expect(skill).toContain('After the script finishes, the LLM should run a bounded live MCP probe');
    expect(skill).toContain('It means the bootstrap CLI query probe failed.');
    expect(skill).toContain('gitnexus_query');
    expect(skill).toContain('gitnexus_context');
    expect(skill).toContain('gitnexus_impact');
    expect(skill).toContain('try exactly one concrete live MCP call');
    expect(skill).toContain('Do not loop, retry broadly');
    expect(skill).toContain('session-local evidence only');
    expect(skill).toContain('Do not rewrite `.spec-first/graph/*`');
    expect(skill).toContain('do not set compiled `query_ready=true`');
    expect(skill).toContain('code-review-graph and bounded direct repo reads');
    expect(skill).toContain('needs a restart or a new session');

    expect(mirror).toContain('bootstrap CLI query probe');
    expect(mirror).toContain('不等于 live GitNexus MCP 一定不可用');
    expect(mirror).toContain('LLM 应在脚本完成后做一次 bounded live MCP probe');
    expect(mirror).toContain('live MCP probe 只尝试一个具体调用');
    expect(mirror).toContain('live MCP 成功只作为 session-local evidence');
    expect(mirror).toContain('不把 compiled `query_ready` 改成 true');
  });
});
