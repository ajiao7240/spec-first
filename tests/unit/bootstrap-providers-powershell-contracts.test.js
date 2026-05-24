'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PS_BOOTSTRAP_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'bootstrap-providers.ps1',
);
const BASH_BOOTSTRAP_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'bootstrap-providers.sh',
);

describe('PowerShell graph bootstrap workspace GitNexus summary contract', () => {
  test('preserves helper-owned readiness fields and reason codes across shell hosts', () => {
    const powershell = fs.readFileSync(PS_BOOTSTRAP_PATH, 'utf8');
    const bash = fs.readFileSync(BASH_BOOTSTRAP_PATH, 'utf8');

    expect(powershell).toContain('Compile-WorkspaceGitNexusReadinessForAllRepos');
    expect(powershell).toContain('compile-workspace-gitnexus-readiness.js');
    expect(powershell).toContain('workspace_gitnexus_readiness_pointer = $workspaceGitNexusReadiness.workspace_gitnexus_readiness_pointer');
    expect(powershell).toContain('query_usability_counts = $workspaceGitNexusReadiness.query_usability_counts');
    expect(powershell).toContain('group = $workspaceGitNexusReadiness.group');
    expect(powershell).toContain('group_reason_code = $workspaceGitNexusReadiness.group_reason_code');
    expect(powershell).toContain("'script-mode-no-mcp'");
    expect(powershell).toContain("'classifier-not-invoked'");
    expect(powershell).toContain("'classifier-failed'");
    expect(powershell).toContain("'script-mode-degraded'");
    expect(powershell).toContain("'workspace-summary-symlink-escape'");

    expect(bash).toContain('compile_workspace_gitnexus_readiness_for_all_repos');
    expect(bash).toContain('compile-workspace-gitnexus-readiness.sh');
    expect(bash).toContain('workspace_gitnexus_readiness_pointer:$workspace_gitnexus_readiness.workspace_gitnexus_readiness_pointer');
    expect(bash).toContain('query_usability_counts:$workspace_gitnexus_readiness.query_usability_counts');
    expect(bash).toContain('group:$workspace_gitnexus_readiness.group');
    expect(bash).toContain('group_reason_code:($workspace_gitnexus_readiness.group_reason_code // null)');
    expect(bash).toContain('"script-mode-no-mcp"');
    expect(bash).toContain('"classifier-not-invoked"');
    expect(bash).toContain('"classifier-failed"');
    expect(bash).toContain('"script-mode-degraded"');
    expect(bash).toContain('"workspace-summary-symlink-escape"');
  });

  test('keeps default summary null and key semantics aligned across shell hosts', () => {
    const powershell = fs.readFileSync(PS_BOOTSTRAP_PATH, 'utf8');
    const bash = fs.readFileSync(BASH_BOOTSTRAP_PATH, 'utf8');

    for (const key of [
      'query_usability_counts',
      'workspace_gitnexus_readiness_pointer',
      'group',
      'group_reason_code',
      'fresh-primary',
      'stale-advisory',
      'definitions-pointer',
      'unavailable',
      'not-evaluated-no-mcp-input',
    ]) {
      expect(powershell).toContain(key);
      expect(bash).toContain(key);
    }

    expect(powershell).toContain('path = $null');
    expect(powershell).toContain('name = $null');
    expect(powershell).toContain('query_selector = $null');
    expect(bash).toContain('path:null');
    expect(bash).toContain('name:null');
    expect(bash).toContain('query_selector:null');
    expect(powershell).not.toContain("path = ''");
    expect(powershell).not.toContain("query_selector = ''");
    expect(bash).not.toContain('path:""');
    expect(bash).not.toContain('query_selector:""');
  });

  test('deserializes Bash and PowerShell default summaries with matching null/key semantics', () => {
    const powershell = fs.readFileSync(PS_BOOTSTRAP_PATH, 'utf8');
    const bash = fs.readFileSync(BASH_BOOTSTRAP_PATH, 'utf8');
    const psFunction = powershell.match(/function New-WorkspaceGitNexusReadinessDefaultSummary[\s\S]*?\n}\n\nfunction Compile-WorkspaceGitNexusReadinessForAllRepos/);
    const bashDefault = bash.match(/if \[ "\$topology" != "multi-repo-workspace" \][\s\S]*?jq -n '([\s\S]*?)'\n    return 0/);

    expect(psFunction).not.toBeNull();
    expect(bashDefault).not.toBeNull();

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-shell-parity-'));
    const psScript = path.join(tmp, 'default-summary.ps1');
    fs.writeFileSync(
      psScript,
      [
        psFunction[0].replace(/\nfunction Compile-WorkspaceGitNexusReadinessForAllRepos$/, ''),
        "New-WorkspaceGitNexusReadinessDefaultSummary -ReasonCode 'classifier-not-invoked' | ConvertTo-Json -Depth 20 -Compress",
      ].join('\n'),
      'utf8',
    );

    const psResult = spawnSync('pwsh', ['-NoProfile', '-File', psScript], { encoding: 'utf8' });
    const bashResult = spawnSync('jq', ['-n', bashDefault[1]], { encoding: 'utf8' });

    expect(psResult.status).toBe(0);
    expect(bashResult.status).toBe(0);

    const psSummary = JSON.parse(psResult.stdout);
    const bashSummary = JSON.parse(bashResult.stdout);
    expect(psSummary).toEqual(bashSummary);
    expect(Object.keys(psSummary).sort()).toEqual([
      'group',
      'group_reason_code',
      'query_usability_counts',
      'workspace_gitnexus_readiness_pointer',
    ].sort());
    expect(psSummary.workspace_gitnexus_readiness_pointer.path).toBeNull();
    expect(psSummary.group.name).toBeNull();
    expect(psSummary.group.query_selector).toBeNull();
  });

  test('keeps parent all-repos artifacts under workspace advisory paths', () => {
    const powershell = fs.readFileSync(PS_BOOTSTRAP_PATH, 'utf8');

    expect(powershell).toContain('.spec-first/workspace');
    expect(powershell).toContain('graph-targets.json');
    expect(powershell).toContain('gitnexus-readiness.json');
    expect(powershell).toContain('workspace_gitnexus_readiness_pointer');
    expect(powershell).toContain('git_root_topology');
    expect(powershell).toContain('multi-repo-workspace');
    expect(powershell).toContain('Write-WorkspaceSummaryJsonAtomic');
    expect(powershell).toContain('workspace-summary-symlink-escape');
    expect(powershell).not.toContain('.spec-first/workspace/graph-facts.json');
    expect(powershell).not.toContain('.spec-first/workspace/provider-status.json');
  });

  test('concurrent-write fingerprint does not ignore setup config inputs', () => {
    const powershell = fs.readFileSync(PS_BOOTSTRAP_PATH, 'utf8');
    const bash = fs.readFileSync(BASH_BOOTSTRAP_PATH, 'utf8');

    expect(powershell).toContain("'^(.spec-first/(providers|graph|impact|workspace)/|.gitnexus/|.code-review-graph/)'".replaceAll('.', '\\.'));
    expect(bash).toContain("'^(.spec-first/(providers|graph|impact|workspace)/|.gitnexus/|.code-review-graph/)'".replaceAll('.', '\\.'));
    expect(powershell).not.toContain("ExternalActorFingerprintIgnorePattern = '^(\\.spec-first/|");
    expect(bash).not.toContain("EXTERNAL_ACTOR_FINGERPRINT_IGNORE_REGEX='^(\\.spec-first/|");
  });
});
