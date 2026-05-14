'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md');
const BASH_SCRIPT_PATH = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.sh');
const POWERSHELL_SCRIPT_PATH = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.ps1');
const RETIRED_PROMPT_MIRROR_PATH = path.join(
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

    expect(fs.existsSync(RETIRED_PROMPT_MIRROR_PATH)).toBe(false);
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
    expect(skill).toContain('Do not compile standards or glue baselines here.');
    expect(skill).toContain('no-argument parent workspace runs batch child-local `.spec-first/standards/` baselines');
    expect(skill).toContain('`spec-standards --workspace` owns parent advisory standards artifacts');
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
    expect(skill).toContain('reason_code=gitnexus-query-provider-projection-stale');
    expect(skill).toContain('reason_code=gitnexus-query-fts-readonly');
    expect(skill).toContain('recommended_action');
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

  test('keeps incremental refresh contract source-parity across shell hosts', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const bashScript = fs.readFileSync(BASH_SCRIPT_PATH, 'utf8');
    const powershellScript = fs.readFileSync(POWERSHELL_SCRIPT_PATH, 'utf8');

    expect(skill).toContain('## Refresh Modes');
    expect(skill).toContain('`--incremental` / `-Incremental`');
    expect(skill).toContain('`--full` / `--force`');
    expect(skill).toContain('`--all-repos --incremental` / `-AllRepos -Incremental` is unsupported');
    expect(skill).toContain('parent workspace would otherwise enter the default all-repos path');
    expect(skill).toContain('readiness_source=incremental-update');
    expect(skill).toContain('readiness_source=incremental-fallback-full');
    expect(skill).toContain('reason_code=dirty-refresh-non-canonical');
    expect(skill).toContain('graph-facts.v1` does not expose refresh-mode convenience fields');
    expect(skill).toContain('__SPEC_FIRST_LAST_INDEXED_COMMIT__');

    for (const source of [bashScript, powershellScript]) {
      expect(source).toContain('incremental-all-repos-unsupported');
      expect(source).toContain('dirty-refresh-non-canonical');
      expect(source).toContain('incremental-command-unavailable');
      expect(source).toContain('incremental-base-ref-invalid-format');
      expect(source).toContain('incremental-base-status-untrusted');
      expect(source).toContain('incremental-base-ref-not-ancestor');
      expect(source).toContain('incremental-refresh-failed-fallback-full');
      expect(source).toContain('incremental-and-full-failed');
      expect(source).toContain('last_indexed_commit');
      expect(source).toContain('requires_clean_full_refresh');
      expect(source).toContain('refresh_mode');
      expect(source).toContain('fallback_from_incremental');
      expect(source).toContain('__SPEC_FIRST_LAST_INDEXED_COMMIT__');
    }

    expect(bashScript).toContain('DEFAULT_REFRESH_MODE_SINGLE_REPO=full');
    expect(bashScript).toContain('DEFAULT_REFRESH_MODE_ALL_REPOS=full');
    expect(bashScript).toContain('ALL_REPOS_CHILD_REFRESH_ARGS+=(--full)');
    expect(bashScript).toContain('child_output="$(bash "$0" --repo "$child_path" "${ALL_REPOS_CHILD_REFRESH_ARGS[@]}")"');
    expect(bashScript).toContain('--incremental');
    expect(bashScript).toContain('--full|--force');
    expect(bashScript).toContain('provider_incremental_command_json');
    expect(bashScript).toContain('.[length - 1] = $sha');

    expect(powershellScript).toContain("$script:DefaultRefreshModeSingleRepo = 'full'");
    expect(powershellScript).toContain("$script:DefaultRefreshModeAllRepos = 'full'");
    expect(powershellScript).toContain('$targetDefaultAllRepos = (-not $AllRepos');
    expect(powershellScript).toContain('if (($AllRepos -or $targetDefaultAllRepos) -and $Incremental)');
    expect(powershellScript).toContain('$childRefreshArgs.Full = $true');
    expect(powershellScript).toContain('$childArgs[$entry.Key] = $entry.Value');
    expect(powershellScript).toContain('[switch]$Incremental');
    expect(powershellScript).toContain('[switch]$Full');
    expect(powershellScript).toContain('[switch]$Force');
    expect(powershellScript).toContain('Get-ProviderIncrementalCommand');
    expect(powershellScript).toContain('$command[$sentinelIndex] = $LastIndexedCommit');
    expect(powershellScript).toContain('Resolve-ProviderRefreshMode');
    expect(powershellScript).toContain('$bootstrapRawLogsForStatus');
    expect(powershellScript).toContain('raw_logs = $providerRawLogs');
  });
});
