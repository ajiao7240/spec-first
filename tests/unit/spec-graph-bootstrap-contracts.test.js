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
    expect(skill).toContain('## Final Response Contract');
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
    expect(skill).toContain('ready/degraded/not-applicable/action-required counts');
    expect(skill).toContain('.spec-first/workspace/graph-bootstrap-summary.json');
    expect(skill).toContain('.spec-first/workspace/graph-targets.json');
    expect(skill).toContain('They do not replace child repo canonical graph facts.');
    expect(skill).toContain('reason_code=workspace-graph-targets-no-source');
    expect(skill).toContain('worktree_status_hash');
    expect(skill).toContain('dirty fingerprints become `dirty-uncertain`');
    expect(skill).toContain('CLI graph_ready');
    expect(skill).toContain('CLI query_ready');
    expect(skill).toContain('Probe Token');
    expect(skill).toContain('CLI Evidence');
    expect(skill).toContain('Live MCP Probe');
    expect(skill).toContain('Do not collapse `Live MCP Probe=passed` into `CLI query_ready=true`');
    expect(skill).toContain('summarize `run_id`, total child count, ready/degraded/not-applicable/action-required counts');
    expect(skill).toContain('every `results[]` child row carries the same `parent_run_id`');
    expect(skill).toContain('Always report the compiled artifacts first, then any session-local live MCP evidence');
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
    expect(mirror).toContain('summary 必须包含 `run_id`');
    expect(mirror).toContain('child row 必须包含对应 `parent_run_id`');
    expect(mirror).toContain('最终回复必须先报告 compiled artifacts，再报告 session-local MCP evidence');
    expect(mirror).toContain('多仓输出 `run_id`、child 总数、ready/degraded/not-applicable/action-required 计数和逐仓状态');
    expect(mirror).toContain('不把 compiled `query_ready` 改成 true');
    expect(mirror).toContain('`reason_code=workspace-graph-targets-no-source`');
    expect(mirror).toContain('`worktree_status_hash` freshness fingerprint');
    expect(mirror).toContain('fingerprint 缺失或不匹配时才输出 `dirty-uncertain`');
  });

  test('ships review fixtures for trigger, boundary, failure, and expected behavior cases', () => {
    const evalDir = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'evals');
    const expectedFiles = [
      'README.md',
      'trigger-cases.json',
      'boundary-cases.json',
      'failure-cases.json',
      'expected-behavior-cases.json',
    ];

    for (const fileName of expectedFiles) {
      expect(fs.existsSync(path.join(evalDir, fileName))).toBe(true);
    }

    const readCases = fileName => JSON.parse(fs.readFileSync(path.join(evalDir, fileName), 'utf8')).cases;
    expect(readCases('trigger-cases.json').map(item => item.expected_decision)).toContain('run-all-repos');
    expect(readCases('boundary-cases.json').map(item => item.expected_decision)).toContain('do-not-write-parent-canonical-artifacts');
    expect(readCases('failure-cases.json').map(item => item.expected_failure)).toContain('unsupported-provider-command');
    expect(readCases('expected-behavior-cases.json').map(item => item.expected_output)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('counts.not_applicable'),
        expect.stringContaining('worktree_status_hash'),
      ]),
    );
  });
});
