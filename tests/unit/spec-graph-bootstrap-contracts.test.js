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
    expect(skill).toContain('## Purpose');
    expect(skill).toContain('## When To Use');
    expect(skill).toContain('## When Not To Use');
    expect(skill).toContain('## Inputs');
    expect(skill).toContain('## Workflow');
    expect(skill).toContain('## Failure Modes');
    expect(skill).toContain('The deterministic bootstrap script cannot call host MCP tools.');
    expect(skill).toContain('After the script finishes, the LLM should run a bounded live MCP probe');
    expect(skill).toContain('query_probe_policy.candidates[]');
    expect(skill).toContain('query_probe_attempts[]');
    expect(skill).toContain('query_probe_candidate_limit=5');
    expect(skill).toContain('query_probe_candidates_truncated=true');
    expect(skill).toContain('winning_query_probe_log');
    expect(skill).toContain('query-2.log');
    expect(skill).toContain('stopping at the first process result');
    expect(skill).toContain('first `query_probe_attempts[]` token whose `result_class` is `process-results`');
    expect(skill).toContain('It means the bootstrap CLI query probe failed.');
    expect(skill).toContain('gitnexus_query');
    expect(skill).toContain('gitnexus_context');
    expect(skill).toContain('gitnexus_impact');
    expect(skill).toContain('try exactly one concrete live MCP call');
    expect(skill).toContain('Do not loop, retry broadly');
    expect(skill).toContain('session-local evidence only');
    expect(skill).toContain('partial-definitions-only');
    expect(skill).toContain('Definitions-only evidence can help locate files or symbols');
    expect(skill).toContain('Do not rewrite `.spec-first/graph/*`');
    expect(skill).toContain('do not set compiled `query_ready=true`');
    expect(skill).toContain('update the final user-facing result table');
    expect(skill).toContain('CLI graph_ready');
    expect(skill).toContain('CLI query_ready');
    expect(skill).toContain('Probe Token');
    expect(skill).toContain('CLI Evidence');
    expect(skill).toContain('Live MCP Probe');
    expect(skill).toContain('Do not collapse `Live MCP Probe=passed` into `CLI query_ready=true`');
    expect(skill).toContain('code-review-graph and bounded direct repo reads');
    expect(skill).toContain('needs a restart or a new session');

    expect(mirror).toContain('bootstrap CLI query probe');
    expect(mirror).toContain('bounded multi-candidate probe');
    expect(mirror).toContain('Android 只是平台信号之一');
    expect(mirror).toContain('`query_probe_attempts[]`');
    expect(mirror).toContain('`query_probe_candidate_limit=5`');
    expect(mirror).toContain('`query_probe_candidates_truncated=true`');
    expect(mirror).toContain('`winning_query_probe_log`');
    expect(mirror).toContain('第一个 `process-results` attempt');
    expect(mirror).toContain('不等于 live GitNexus MCP 一定不可用');
    expect(mirror).toContain('LLM 应在脚本完成后做一次 bounded live MCP probe');
    expect(mirror).toContain('live MCP probe 只尝试一个具体调用');
    expect(mirror).toContain('live MCP 成功只作为 session-local evidence');
    expect(mirror).toContain('标记为 `partial-definitions-only`');
    expect(mirror).toContain('不证明 BM25/process query surface 健康');
    expect(mirror).toContain('最终用户可见结果表格必须拆分 compiled CLI readiness 与 session-local MCP evidence');
    expect(mirror).toContain('`Probe Token`');
    expect(mirror).toContain('`CLI Evidence`');
    expect(mirror).toContain('`Live MCP Probe=passed` 不能折叠成 `CLI query_ready=true`');
    expect(mirror).toContain('不把 compiled `query_ready` 改成 true');
  });
});
