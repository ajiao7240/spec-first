'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md');
const BASH_SCRIPT_PATH = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.sh');
const BASH_WORKSPACE_GITNEXUS_WRAPPER_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'compile-workspace-gitnexus-readiness.sh',
);
const POWERSHELL_SCRIPT_PATH = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.ps1');
const CONSUMPTION_DOC_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'graph-provider-consumption.md');
const WORKSPACE_GITNEXUS_CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'workspace-gitnexus-consumption.md');
const RETIRED_PROMPT_MIRROR_PATH = path.join(
  REPO_ROOT,
  'docs',
  '10-prompt',
  'skills',
  'spec-graph-bootstrap',
  'SKILL.md',
);

function extractBashSetupOwnedPrefixes(source) {
  const match = source.match(/SETUP_OWNED_DIRTY_IGNORE_PREFIXES=\(\n([\s\S]*?)\n\)/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map(line => line.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function extractBashNonGraphMetadataPaths(source) {
  const match = source.match(/NON_GRAPH_METADATA_DIRTY_PATHS=\(\n([\s\S]*?)\n\)/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map(line => line.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function extractPowerShellSetupOwnedPrefixes(source) {
  const match = source.match(/\$script:SetupOwnedDirtyIgnorePrefixes = @\(\n([\s\S]*?)\n\)/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map(line => line.trim().replace(/,$/, '').replace(/^'|'$/g, ''))
    .filter(Boolean);
}

function extractPowerShellNonGraphMetadataPaths(source) {
  const match = source.match(/\$script:NonGraphMetadataDirtyPaths = @\(\n([\s\S]*?)\n\)/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map(line => line.trim().replace(/,$/, '').replace(/^'|'$/g, ''))
    .filter(Boolean);
}

function extractContractSetupOwnedPrefixes(source) {
  const section = source.match(/## setup-owned-dirty-ignore\.v1\n([\s\S]*?)\n## /);
  if (!section) return [];
  return Array.from(section[1].matchAll(/\| `([^`]+)` \|/g)).map(match => match[1]);
}

function extractContractNonGraphMetadataPaths(source) {
  const section = source.match(/## non-graph-metadata-dirty-ignore\.v1\n([\s\S]*?)\n## /);
  if (!section) return [];
  return Array.from(section[1].matchAll(/\| `([^`]+)` \|/g)).map(match => match[1]);
}

describe('spec-graph-bootstrap live MCP probe contract', () => {
  test('keeps CLI readiness separate from session-local MCP evidence', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const workspaceGitNexusContract = fs.readFileSync(WORKSPACE_GITNEXUS_CONTRACT_PATH, 'utf8');

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
    expect(skill).toContain('Do not infer semantic architecture conclusions or write project-guidance baselines here.');
    expect(skill).toContain('downstream workflows should use the readiness facts as advisory evidence');
    expect(skill).toContain('route by user intent into planning, work, debugging, review, or documentation workflows');
    expect(skill).toContain('records dry-run parent `AGENTS.md` / `CLAUDE.md` GitNexus instruction drift as advisory evidence');
    expect(skill).toContain('Parent host instruction writes remain owned by `spec-first init`');
    expect(skill).toContain('does not write parent host instruction files');
    expect(skill).not.toContain('refreshes existing parent `AGENTS.md` / `CLAUDE.md` GitNexus instruction blocks');
    expect(skill).not.toContain('Parent all-repos runs may also normalize existing parent `AGENTS.md` / `CLAUDE.md`');
    expect(skill).not.toContain('.spec-first/' + 'standards/');
    expect(skill).not.toContain('spec-' + 'standards');
    expect(skill).toContain('update the final user-facing result table');
    expect(skill).toContain('ready/degraded/not-applicable/action-required counts');
    expect(skill).toContain('.spec-first/workspace/graph-bootstrap-summary.json');
    expect(skill).toContain('.spec-first/workspace/graph-targets.json');
    expect(skill).toContain('They do not replace child repo canonical graph facts.');
    expect(skill).toContain('reason_code=workspace-graph-targets-no-source');
    expect(workspaceGitNexusContract).toContain('workspace-gitnexus-readiness.v1');
    expect(workspaceGitNexusContract).toContain('`workspace-graph-targets.v1.repos[].status` 保留为向后兼容字段');
    expect(workspaceGitNexusContract).toContain('新 GitNexus-aware consumer 必须优先读取 `refresh_eligibility`、`index_snapshot` 和 `query_usability`');
    expect(skill).toContain('worktree_status_hash');
    expect(skill).toContain('dirty fingerprints become `dirty-uncertain`');
    expect(skill).toContain('CLI graph_ready');
    expect(skill).toContain('CLI query_ready');
    expect(skill).toContain('Probe Token');
    expect(skill).toContain('CLI Evidence');
    expect(skill).toContain('Live MCP Probe');
    expect(skill).toContain('Do not collapse `Live MCP Probe=passed` into `CLI query_ready=true`');
    expect(skill).toContain('summarize `run_id`, total child count, ready/degraded/not-applicable/action-required counts');
    expect(skill).toContain('workspace_gitnexus_readiness_pointer.reason_code=script-mode-no-mcp');
    expect(skill).toContain('four-key `query_usability_counts`');
    expect(skill).toContain('`group.status="not-evaluated-no-mcp-input"`');
    expect(skill).toContain('call `list_repos` once and `group_list` once');
    expect(skill).toContain('session-local `runtime_mcp_overlay`');
    expect(skill).toContain('recommended_query_path="group-query"');
    expect(skill).toContain('recommended_query_path="bounded-registry-fanout"');
    expect(skill).toContain('Do not run `group_sync` automatically');
    expect(skill).toContain('every `results[]` child row carries the same `parent_run_id`');
    expect(skill).toContain('Always report the compiled artifacts first, then any session-local live MCP evidence');
    expect(skill).toContain('code-review-graph and bounded direct repo reads');
    expect(skill).toContain('needs a restart or a new session');
    expect(skill).toContain('reason_code=gitnexus-query-provider-projection-stale');
    expect(skill).toContain('reason_code=gitnexus-query-fts-readonly');
    expect(skill).toContain('recommended_action');
  });

  test('workspace GitNexus readiness summary is helper-owned across shell hosts', () => {
    const bashScript = fs.readFileSync(BASH_SCRIPT_PATH, 'utf8');
    const bashWrapper = fs.readFileSync(BASH_WORKSPACE_GITNEXUS_WRAPPER_PATH, 'utf8');
    const powershellScript = fs.readFileSync(POWERSHELL_SCRIPT_PATH, 'utf8');

    expect(bashScript).toContain('compile_workspace_gitnexus_readiness_for_all_repos');
    expect(bashScript).toContain('compile-workspace-gitnexus-readiness.sh');
    expect(bashWrapper).toContain('internal workspace-gitnexus-readiness');
    expect(bashScript).toContain('workspace_gitnexus_readiness_pointer:$workspace_gitnexus_readiness.workspace_gitnexus_readiness_pointer');
    expect(bashScript).toContain('query_usability_counts:$workspace_gitnexus_readiness.query_usability_counts');
    expect(bashScript).toContain('group:$workspace_gitnexus_readiness.group');
    expect(bashScript).toContain('"script-mode-no-mcp"');
    expect(bashScript).toContain('"classifier-not-invoked"');
    expect(bashScript).toContain('"classifier-failed"');
    expect(bashScript).not.toContain('select(.query_usability == "stale-advisory")');

    expect(powershellScript).toContain('Compile-WorkspaceGitNexusReadinessForAllRepos');
    expect(powershellScript).toContain("'internal', 'workspace-gitnexus-readiness'");
    expect(powershellScript).toContain('workspace_gitnexus_readiness_pointer = $workspaceGitNexusReadiness.workspace_gitnexus_readiness_pointer');
    expect(powershellScript).toContain('query_usability_counts = $workspaceGitNexusReadiness.query_usability_counts');
    expect(powershellScript).toContain('group = $workspaceGitNexusReadiness.group');
    expect(powershellScript).toContain("'script-mode-no-mcp'");
    expect(powershellScript).toContain("'classifier-not-invoked'");
    expect(powershellScript).toContain("'classifier-failed'");
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
        expect.stringContaining('query_usability_counts.stale-advisory>=7'),
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
    expect(skill).toContain('warn-and-continue');
    expect(skill).toContain('freshness_state=dirty-advisory');
    expect(skill).not.toContain('reason_code=dirty-source-blocked');
    expect(skill).toContain('dirty-refresh-non-canonical');
    expect(skill).toContain('graph-facts.v1` does not expose refresh-mode convenience fields');
    expect(skill).toContain('__SPEC_FIRST_LAST_INDEXED_COMMIT__');

    for (const source of [bashScript, powershellScript]) {
      expect(source).toContain('incremental-all-repos-unsupported');
      expect(source).not.toContain("'dirty-source-blocked'");
      expect(source).not.toContain('"dirty-source-blocked"');
      expect(source).not.toContain("ReasonCode 'dirty-refresh-non-canonical'");
      expect(source).not.toContain('dirty-refresh-non-canonical "Commit, stash');
      expect(source).toContain('freshness_state');
      expect(source).toContain('dirty-advisory');
      expect(source).toContain('ready-dirty-advisory');
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

  test('keeps setup-owned dirty classification contract equivalent across shell hosts', () => {
    const contract = fs.readFileSync(CONSUMPTION_DOC_PATH, 'utf8');
    const bashScript = fs.readFileSync(BASH_SCRIPT_PATH, 'utf8');
    const powershellScript = fs.readFileSync(POWERSHELL_SCRIPT_PATH, 'utf8');
    const expectedPrefixes = [
      '.spec-first/',
      '.gitnexus/',
      '.code-review-graph/',
      'AGENTS.md',
      'CLAUDE.md',
      '.gitignore',
      '.codex/spec-first/',
      '.claude/spec-first/',
      '.agents/skills/',
    ];
    const expectedNonGraphMetadataPaths = [
      'CHANGELOG.md',
      'docs/变更日志.md',
    ];

    expect(extractContractSetupOwnedPrefixes(contract).sort()).toEqual([...expectedPrefixes].sort());
    expect(extractBashSetupOwnedPrefixes(bashScript).sort()).toEqual([...expectedPrefixes].sort());
    expect(extractPowerShellSetupOwnedPrefixes(powershellScript).sort()).toEqual([...expectedPrefixes].sort());
    expect(extractContractNonGraphMetadataPaths(contract).sort()).toEqual([...expectedNonGraphMetadataPaths].sort());
    expect(extractBashNonGraphMetadataPaths(bashScript).sort()).toEqual([...expectedNonGraphMetadataPaths].sort());
    expect(extractPowerShellNonGraphMetadataPaths(powershellScript).sort()).toEqual([...expectedNonGraphMetadataPaths].sort());

    expect(bashScript).toContain('for prefix in "${SETUP_OWNED_DIRTY_IGNORE_PREFIXES[@]}"');
    expect(powershellScript).toContain('foreach ($prefix in $script:SetupOwnedDirtyIgnorePrefixes)');
    expect(bashScript).toContain('for metadata_path in "${NON_GRAPH_METADATA_DIRTY_PATHS[@]}"');
    expect(powershellScript).toContain('foreach ($metadataPath in $script:NonGraphMetadataDirtyPaths)');
    expect(bashScript).toContain('git -C "$REPO_ROOT" status --porcelain=v2 -z');
    expect(powershellScript).toContain("$psi.ArgumentList.Add('--porcelain=v2')");
    expect(powershellScript).toContain("$psi.ArgumentList.Add('-z')");
    expect(bashScript).toContain('DIRTY_CLASSIFICATION="graph-affecting-blocked"');
    expect(bashScript).toContain('DIRTY_CLASSIFICATION="non-graph-only"');
    expect(powershellScript).toContain("$script:DirtyClassification = 'graph-affecting-blocked'");
    expect(powershellScript).toContain("$script:DirtyClassification = 'non-graph-only'");
    expect(contract).toContain('graph-affecting-blocked` 只来自本轮 command result');
    expect(contract).toContain('`non-graph-only`');
    expect(contract).toContain('blank-only 分隔行');
    expect(fs.readFileSync(SKILL_PATH, 'utf8')).toContain('marker-adjacent blank-only separators');
  });

  test('keeps dirty gate list separate from concurrent-write fingerprint filters', () => {
    const bashScript = fs.readFileSync(BASH_SCRIPT_PATH, 'utf8');
    const powershellScript = fs.readFileSync(POWERSHELL_SCRIPT_PATH, 'utf8');

    const bashFingerprintMatch = bashScript.match(/EXTERNAL_ACTOR_FINGERPRINT_IGNORE_REGEX='([^']+)'/);
    const powershellFingerprintMatch = powershellScript.match(/\$script:ExternalActorFingerprintIgnorePattern = '([^']+)'/);
    expect(bashFingerprintMatch).not.toBeNull();
    expect(powershellFingerprintMatch).not.toBeNull();

    for (const forbidden of ['CHANGELOG.md', '.gitignore', '.codex/spec-first/', '.claude/spec-first/', '.agents/skills/']) {
      expect(bashFingerprintMatch[1]).not.toContain(forbidden);
      expect(powershellFingerprintMatch[1]).not.toContain(forbidden);
    }

    expect(bashScript).toContain('SETUP_OWNED_DIRTY_IGNORE_PREFIXES');
    expect(bashScript).toContain('EXTERNAL_ACTOR_FINGERPRINT_IGNORE_REGEX');
    expect(powershellScript).toContain('$script:SetupOwnedDirtyIgnorePrefixes');
    expect(powershellScript).toContain('$script:ExternalActorFingerprintIgnorePattern');
  });
});
