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
const BUILD_TARGET_COMPILER_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'compile-gradle-build-targets.js',
);
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
    expect(skill).toContain('stopping at the first query-ready result');
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
    expect(skill).toContain('`definitions-only` proves query/context orientation only');
    expect(skill).toContain('The script must not decide that a repo is a documentation library');
    expect(skill).toContain('accept it as compiled `query_ready=true` for query/context orientation');
    expect(skill).toContain('must not claim `execution_flow`, `impact_radius`, or review-impact support');
    expect(skill).toContain('downstream LLM workflows decide whether it satisfies a documentation-library or file-location task');
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
    expect(skill).toContain('P5-full `quality_signals`');
    expect(skill).toContain('quality_signals.{child_count, process_results_rate, command_failed_rate, dirty_advisory_child_rate, build_target_coverage_ratio, impact_probe_with_test_provenance_rate, host_instruction_drift_rate}');
    expect(skill).toContain('These quality signals are deterministic evaluation inputs only');
    expect(skill).toContain('- Host instruction drift detected (advisory). Run: spec-first init to refresh AGENTS.md / CLAUDE.md GitNexus blocks.');
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
    expect(skill).toContain('bounded direct repo reads, git diff, ast-grep, tests, and logs');
    expect(skill).toContain('reason_code=stale-provider-projection');
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
    expect(bashScript).toContain('quality_signals:{');
    expect(bashScript).toContain('child_count:($results | length)');
    expect(bashScript).toContain('process_results_rate');
    expect(bashScript).toContain('command_failed_rate');
    expect(bashScript).toContain('dirty_advisory_child_rate');
    expect(bashScript).toContain('build_target_coverage_ratio');
    expect(bashScript).toContain('impact_probe_with_test_provenance_rate');
    expect(bashScript).toContain('host_instruction_drift_rate');
    expect(bashScript).toContain('"script-mode-no-mcp"');
    expect(bashScript).toContain('"classifier-not-invoked"');
    expect(bashScript).toContain('"classifier-failed"');
    expect(bashScript).not.toContain('select(.query_usability == "stale-advisory")');

    expect(powershellScript).toContain('Compile-WorkspaceGitNexusReadinessForAllRepos');
    expect(powershellScript).toContain("'internal', 'workspace-gitnexus-readiness'");
    expect(powershellScript).toContain('workspace_gitnexus_readiness_pointer = $workspaceGitNexusReadiness.workspace_gitnexus_readiness_pointer');
    expect(powershellScript).toContain('query_usability_counts = $workspaceGitNexusReadiness.query_usability_counts');
    expect(powershellScript).toContain('group = $workspaceGitNexusReadiness.group');
    expect(powershellScript).toContain('New-WorkspaceQualitySignals');
    expect(powershellScript).toContain('quality_signals = $qualitySignals');
    expect(powershellScript).toContain('process_results_rate');
    expect(powershellScript).toContain('command_failed_rate');
    expect(powershellScript).toContain('dirty_advisory_child_rate');
    expect(powershellScript).toContain('build_target_coverage_ratio');
    expect(powershellScript).toContain('impact_probe_with_test_provenance_rate');
    expect(powershellScript).toContain('host_instruction_drift_rate');
    expect(powershellScript).toContain("'script-mode-no-mcp'");
    expect(powershellScript).toContain("'classifier-not-invoked'");
    expect(powershellScript).toContain("'classifier-failed'");
  });

  test('build-target awareness covers Gradle and npm workspace manifests additively', () => {
    const bashResolver = fs.readFileSync(
      path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'resolve-workspace-graph-targets.sh'),
      'utf8',
    );
    const powershellResolver = fs.readFileSync(
      path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'resolve-workspace-graph-targets.ps1'),
      'utf8',
    );
    const compiler = fs.readFileSync(BUILD_TARGET_COMPILER_PATH, 'utf8');

    expect(bashResolver).toContain('compile-gradle-build-targets.js');
    expect(powershellResolver).toContain('compile-gradle-build-targets.js');
    expect(compiler).toContain('collectGradleBuildTargets');
    expect(compiler).toContain('collectNpmWorkspaceTargets');
    expect(compiler).toContain('package.json');
    expect(compiler).toContain('pnpm-workspace.yaml');
    expect(compiler).toContain('npm-workspace');
    expect(compiler).toContain('parsePnpmWorkspacePackages');
    expect(compiler).toContain('workspace_pattern');
    expect(compiler).toContain('in_package_workspace');
    expect(compiler).toContain('npm-parse-error');
  });

  test('npm workspace compiler accepts package.json array and object forms', () => {
    const { compileGradleBuildTargets } = require(BUILD_TARGET_COMPILER_PATH);

    for (const workspaceShape of ['array', 'object']) {
      const tempRoot = fs.mkdtempSync(path.join('/tmp', `spec-first-npm-${workspaceShape}-`));
      try {
        const appDir = path.join(tempRoot, 'packages', 'app');
        const uiDir = path.join(tempRoot, 'packages', 'ui');
        fs.mkdirSync(appDir, { recursive: true });
        fs.mkdirSync(uiDir, { recursive: true });
        fs.writeFileSync(
          path.join(tempRoot, 'package.json'),
          JSON.stringify({
            private: true,
            workspaces: workspaceShape === 'array' ? ['packages/*'] : { packages: ['packages/*'] },
          }),
        );
        fs.writeFileSync(path.join(appDir, 'package.json'), '{"name":"app"}');
        fs.writeFileSync(path.join(uiDir, 'package.json'), '{"name":"ui"}');
        const targetsPath = path.join(tempRoot, 'targets.json');
        fs.writeFileSync(targetsPath, JSON.stringify([{
          target_kind: 'git-repo',
          repo_label: 'app',
          git_root: appDir,
          workspace_relative_path: 'packages/app',
        }]));

        const result = compileGradleBuildTargets({ workspaceRoot: tempRoot, targetsPath, scanDepth: 3 });
        expect(result.coverage_inference).toBe('computed');
        expect(result.ecosystem).toBe('npm');
        expect(result.coverage_summary).toEqual({
          total_build_targets: 2,
          covered_by_git_children: 1,
          uncovered_build_modules: 1,
          coverage_ratio: 0.5,
        });
        expect(result.non_git_build_modules.map(item => `${item.path}:${item.kind}:${item.covered_by_child_repo}`).sort()).toEqual([
          'packages/app:npm-workspace:true',
          'packages/ui:npm-workspace:false',
        ]);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
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
    expect(skill).not.toContain('__SPEC_FIRST_LAST_INDEXED_COMMIT__');

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
      expect(source).not.toContain('__SPEC_FIRST_LAST_INDEXED_COMMIT__');
    }

    expect(bashScript).toContain('DEFAULT_REFRESH_MODE_SINGLE_REPO=full');
    expect(bashScript).toContain('DEFAULT_REFRESH_MODE_ALL_REPOS=full');
    expect(bashScript).toContain('ALL_REPOS_CHILD_REFRESH_ARGS+=(--full)');
    expect(bashScript).toContain('child_output="$(bash "$0" --repo "$child_path" "${ALL_REPOS_CHILD_REFRESH_ARGS[@]}")"');
    expect(bashScript).toContain('--incremental');
    expect(bashScript).toContain('--full|--force');
    expect(bashScript).toContain('provider_incremental_command_json');
    expect(bashScript).not.toContain('.[length - 1] = $sha');

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
    expect(powershellScript).not.toContain('$command[$sentinelIndex] = $LastIndexedCommit');
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

  test('exposes U2/U3 repo label and dirty path facts additively across shell hosts', () => {
    const bashScript = fs.readFileSync(BASH_SCRIPT_PATH, 'utf8');
    const powershellScript = fs.readFileSync(POWERSHELL_SCRIPT_PATH, 'utf8');

    for (const source of [bashScript, powershellScript]) {
      expect(source).toContain('repo_label_resolution');
      expect(source).toContain('gitnexus_meta_remote_url_basename');
      expect(source).toContain('git_remote_url_basename');
      expect(source).toContain('directory_basename');
      expect(source).toContain('dirty_paths_sample');
      expect(source).toContain('dirty_paths_sample_truncated');
      expect(source).not.toContain('dirty_paths_sample_truncated = $null');
      expect(source).not.toContain('build_module');
    }

    expect(bashScript).toContain('build_repo_label_resolution_json');
    expect(bashScript).toContain('build_dirty_paths_sample_json');
    expect(bashScript).toContain('sort_by([(if .classification == "graph-affecting" then 0 else 1 end), .path])');
    expect(bashScript).toContain('repo_label_conflict_lines');
    expect(bashScript).toContain('Repo label conflict detected for ');

    expect(powershellScript).toContain('New-RepoLabelResolution');
    expect(powershellScript).toContain('Set-DirtyPathsSample');
    expect(powershellScript).toContain('Sort-Object @{ Expression = { if ($_.classification -eq');
    expect(powershellScript).toContain('if ($provider -eq');
    expect(powershellScript).toContain('Repo label conflict detected for ');
    // R6 cross-platform invariant: dirty_paths_sample[] must sort by Unicode codepoint
    // (ordinal) so Bash jq sort_by(.path) and PowerShell parity stay aligned even on
    // non-ASCII paths.
    expect(powershellScript).toContain('function ConvertTo-OrdinalSortKey');
    expect(powershellScript).toContain('ConvertTo-OrdinalSortKey ([string]$_.path)');
  });

  test('locks Capability Matrix prose in bootstrap-report.md (R7/R15b)', () => {
    const bashScript = fs.readFileSync(BASH_SCRIPT_PATH, 'utf8');
    const powershellScript = fs.readFileSync(POWERSHELL_SCRIPT_PATH, 'utf8');

    // sh: capture jq output to impact_capabilities_json + read-back path + matrix derivation
    expect(bashScript).toContain('impact_capabilities_json="$(jq -n');
    expect(bashScript).toContain('printf \'%s\\n\' "$impact_capabilities_json" | write_file_atomic "$IMPACT_DIR/bootstrap-impact-capabilities.json"');
    expect(bashScript).toContain('impact_capabilities_json="$(cat "$IMPACT_DIR/bootstrap-impact-capabilities.json"');
    expect(bashScript).toContain('capability_matrix_rows=""');
    expect(bashScript).toContain('## Capability Matrix');
    expect(bashScript).toContain('| Capability | Support Level | Confidence | Note |');
    expect(bashScript).toMatch(/fmt\("query\/context"; \$caps\.context_selection \/\/ \{\}\)/);
    expect(bashScript).toMatch(/fmt\("impact_radius"; \$caps\.impact_radius \/\/ \{\}\)/);
    expect(bashScript).toMatch(/fmt\("review_support"; \$caps\.review_support \/\/ \{\}\)/);

    // ps1: read-back + helper functions + matrix section assembly
    expect(powershellScript).toContain('Get-Content -LiteralPath $impactCapabilitiesPath -Raw');
    expect(powershellScript).toContain('function Get-CapField');
    expect(powershellScript).toContain('function Format-CapabilityMatrixRow');
    expect(powershellScript).toContain("Format-CapabilityMatrixRow -Name 'query/context'");
    expect(powershellScript).toContain("Format-CapabilityMatrixRow -Name 'impact_radius'");
    expect(powershellScript).toContain("Format-CapabilityMatrixRow -Name 'review_support'");
    expect(powershellScript).toContain('## Capability Matrix');
    expect(powershellScript).toContain('| Capability | Support Level | Confidence | Note |');

    // blocked path (write_blocked_report) does not render matrix
    const blockedReport = bashScript.match(/write_blocked_report\(\)\s*\{[^}]*\}/s);
    expect(blockedReport).not.toBeNull();
    expect(blockedReport[0]).not.toContain('## Capability Matrix');

    // dirty-advisory wording survives next to matrix prose (AE3)
    expect(bashScript).toContain('echo dirty-advisory');
    expect(powershellScript).toContain("'dirty-advisory'");
  });

  test('locks definitions-only result_class enum and downstream gating contract (R15a)', () => {
    const fixtureRoot = path.join(REPO_ROOT, 'tests', 'fixtures', 'review-pre-facts');
    const definitionsOnly = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'providers/gitnexus/normalized/impact-capabilities.definitions-only.json'), 'utf8'),
    );
    const processResults = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'providers/gitnexus/normalized/impact-capabilities.process-results.json'), 'utf8'),
    );

    expect(definitionsOnly.available_query_surfaces).toEqual(['query', 'context']);
    expect(definitionsOnly.available_query_surfaces).not.toContain('impact');
    expect(definitionsOnly.available_query_surfaces).not.toContain('detect_changes');

    expect(processResults.available_query_surfaces).toContain('query');
    expect(processResults.available_query_surfaces).toContain('context');
    expect(processResults.available_query_surfaces).toContain('impact');
    expect(processResults.available_query_surfaces).toContain('detect_changes');

    const providerStatusFixture = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'provider-status.definitions-only.json'), 'utf8'),
    );
    const probe = providerStatusFixture.providers[0].query_probe_attempts[0];
    expect(probe.result_class).toBe('definitions-only');
    expect(typeof probe.verification_reason).toBe('string');
    expect(probe.verification_reason.length).toBeGreaterThan(0);
  });
});
