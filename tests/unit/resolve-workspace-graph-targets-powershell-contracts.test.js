'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PS_RESOLVER_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'resolve-workspace-graph-targets.ps1',
);
const BASH_RESOLVER_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'resolve-workspace-graph-targets.sh',
);

describe('PowerShell workspace graph target resolver contract', () => {
  test('keeps topology and GitNexus query usability fields aligned with Bash', () => {
    const powershell = fs.readFileSync(PS_RESOLVER_PATH, 'utf8');
    const bash = fs.readFileSync(BASH_RESOLVER_PATH, 'utf8');

    for (const source of [powershell, bash]) {
      expect(source).toContain('workspace-graph-targets.v1');
      expect(source).toContain('non-git-folder');
      expect(source).toContain('folder_snapshot');
      expect(source).toContain('content_fingerprint');
      expect(source).toContain('non_git_support');
      expect(source).toContain('git_only_limitations');
      expect(source).toContain('git_root_topology');
      expect(source).toContain('single-repo');
      expect(source).toContain('multi-repo-workspace');
      expect(source).toContain('refresh_eligibility');
      expect(source).toContain('index_snapshot');
      expect(source).toContain('query_usability');
      expect(source).toContain('working_tree_overlay');
      expect(source).toContain('parent_repo_local_artifact_advisory');
      expect(source).toContain('parent-workspace-repo-local-artifacts-ignored');
      expect(source).toContain('legacy_provider_advisories');
      expect(source).toContain('child-on-legacy-spec-first-version');
      expect(source).toContain('crg-residue-ignored');
      expect(source).toContain('query_usability_counts');
      expect(source).toContain('compile-gradle-build-targets.js');
      expect(source).toContain('non_git_build_modules');
      expect(source).toContain('coverage_summary');
      expect(source).toContain('graph_coverage_class');
      expect(source).toContain('fresh-primary');
      expect(source).toContain('stale-advisory');
      expect(source).toContain('definitions-pointer');
      expect(source).toContain('last_indexed_commit');
      expect(source).toContain('requires_clean_full_refresh');
      expect(source).not.toContain('"code-review-graph":{');
      expect(source).not.toContain("'code-review-graph' = [ordered]@{");
      expect(source).not.toContain('development_mode');
    }

    expect(powershell).toContain('ConvertTo-Json -InputObject @($Targets) -Depth 30');
    expect(powershell).not.toContain('@($Targets) | ConvertTo-Json -Depth 30');
  });

  test('keeps blocked parent-workspace target resolution explicit', () => {
    const powershell = fs.readFileSync(PS_RESOLVER_PATH, 'utf8');

    expect(powershell).toContain('workspace-no-git-candidates');
    expect(powershell).toContain("[string]$Folder = ''");
    expect(powershell).toContain('explicit_non_git_folder');
    expect(powershell).toContain('Get-FolderContentFingerprint');
    expect(powershell).toContain('query_context_architecture = $true');
    expect(powershell).toContain('git_diff_review_impact = $false');
    expect(powershell).toContain('commit_freshness = $false');
    expect(powershell).toContain('incremental = $false');
    expect(powershell).toContain('reason_code');
    expect(powershell).toContain('next_action');
    expect(powershell).toContain('git_root_topology = $gitRootTopology');
    expect(powershell).toContain('parent_writes_repo_local_artifacts');
    expect(powershell).toContain('.spec-first/workspace');
    expect(powershell).toContain('graph-targets.json');
  });
});
