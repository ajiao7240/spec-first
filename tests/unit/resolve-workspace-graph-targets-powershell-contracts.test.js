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
      expect(source).toContain('git_root_topology');
      expect(source).toContain('single-repo');
      expect(source).toContain('multi-repo-workspace');
      expect(source).toContain('refresh_eligibility');
      expect(source).toContain('index_snapshot');
      expect(source).toContain('query_usability');
      expect(source).toContain('working_tree_overlay');
      expect(source).toContain('query_usability_counts');
      expect(source).toContain('fresh-primary');
      expect(source).toContain('stale-advisory');
      expect(source).toContain('definitions-pointer');
      expect(source).toContain('last_indexed_commit');
      expect(source).toContain('requires_clean_full_refresh');
      expect(source).not.toContain('development_mode');
    }
  });

  test('keeps blocked parent-workspace target resolution explicit', () => {
    const powershell = fs.readFileSync(PS_RESOLVER_PATH, 'utf8');

    expect(powershell).toContain('workspace-no-git-candidates');
    expect(powershell).toContain('reason_code');
    expect(powershell).toContain('next_action');
    expect(powershell).toContain('git_root_topology = $gitRootTopology');
    expect(powershell).toContain('parent_writes_repo_local_artifacts');
    expect(powershell).toContain('.spec-first/workspace');
    expect(powershell).toContain('graph-targets.json');
  });
});
