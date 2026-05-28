'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  BOOTSTRAP_SCHEMA_VERSION,
  PENDING_BUILD_TARGET_SCAN_REASON,
  SETUP_SCHEMA_VERSION,
  computeBootstrapLayer,
} = require('../../src/cli/helpers/scenario-fingerprint');

const REPO_ROOT = path.join(__dirname, '..', '..');
const BIN = path.join(REPO_ROOT, 'bin', 'spec-first.js');
const BASH_BOOTSTRAP = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.sh');
const POWERSHELL_BOOTSTRAP = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'scripts', 'bootstrap-providers.ps1');
const SKILL = path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md');
const CONTRACT = path.join(REPO_ROOT, 'docs', 'contracts', 'developer-scenario-fingerprint.md');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function initCommittedRepo() {
  const repo = makeTempDir('scenario-fingerprint-bootstrap-');
  git(repo, ['init']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'Test User']);
  git(repo, ['config', 'core.hooksPath', '/dev/null']);
  fs.writeFileSync(path.join(repo, 'README.md'), '# Fixture\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-m', 'init']);
  return repo;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeSetupFingerprint(repo, revision) {
  const setupPath = path.join(repo, '.spec-first', 'workspace', 'scenario-fingerprint-setup.json');
  writeJson(setupPath, {
    schema_version: SETUP_SCHEMA_VERSION,
    advisory: true,
    layer: 'setup',
    generated_at: '2026-05-28T00:00:00.000Z',
    state_class: 'clean-single-repo',
    scenario_class_provisional: true,
    workspace_root: repo,
    target_root: repo,
    topology: {
      target_kind: 'git-repo',
      repo_topology: 'single-repo',
      child_repo_count: 0,
      child_repos: [],
      non_git_build_targets_present: false,
      build_manifest_sample: [],
    },
    worktree: {
      dirty: false,
      dirty_paths_sample: [],
      status_hash: 'sha256:setup',
      head: revision,
      dirty_child_count: 0,
    },
    complexity_dimensions: {
      multi_repo_workspace: false,
      non_git_folder_target: false,
      non_git_build_targets_present: false,
      git_alignment_broken: false,
      parent_repo_local_artifacts_present: false,
      worktree_dirty_graph_affecting: false,
      provider_query_degraded: false,
    },
    providers_status_refs: {
      gitnexus: {
        configured: true,
        query_ready: true,
        bootstrap_required: false,
        status_path: '.spec-first/graph/provider-status.json',
        reason_code: null,
      },
    },
    foreign_residual_indicators: [],
    freshness: {
      setup_generated_at: '2026-05-28T00:00:00.000Z',
      source_revision: revision,
    },
    tags: ['clean-single-repo'],
    limitations: [],
  });
  return setupPath;
}

function writeBootstrapInputs(repo, revision) {
  const graphFactsPath = path.join(repo, '.spec-first', 'graph', 'graph-facts.json');
  const providerStatusPath = path.join(repo, '.spec-first', 'graph', 'provider-status.json');
  const summaryPath = path.join(repo, '.spec-first', 'workspace', 'graph-bootstrap-summary.json');
  writeJson(graphFactsPath, {
    schema_version: 'graph-facts.v1',
    repo_root: repo,
    source_revision: revision,
    worktree_dirty: false,
    worktree_status_hash: 'sha256:bootstrap',
    source_revision_dirty: false,
    freshness_state: 'fresh',
    dirty_paths_sample: [],
  });
  writeJson(providerStatusPath, {
    schema_version: 'graph-provider-status.v1',
    providers: [{
      provider: 'gitnexus',
      configured: true,
      graph_ready: true,
      query_ready: true,
      status: 'ready',
      repo_snapshot: {
        source_revision: revision,
      },
      repo_label_resolution: {
        selected: 'fixture',
        selected_source: 'directory_basename',
        conflict: false,
      },
    }],
  });
  writeJson(summaryPath, {
    schema_version: 'workspace-graph-bootstrap-summary.v1',
    quality_signals: {
      child_count: 2,
      process_results_rate: 1,
      command_failed_rate: 0,
      dirty_advisory_child_rate: 0.5,
    },
    results: [],
  });
  return { graphFactsPath, providerStatusPath, summaryPath };
}

describe('bootstrap scenario fingerprint contract', () => {
  test('internal CLI writes bootstrap fingerprint and preserves P4 null placeholders', () => {
    const repo = initCommittedRepo();
    const revision = git(repo, ['rev-parse', 'HEAD']);
    const setupPath = writeSetupFingerprint(repo, revision);
    const { graphFactsPath, providerStatusPath, summaryPath } = writeBootstrapInputs(repo, revision);
    const output = path.join(repo, '.spec-first', 'workspace', 'scenario-fingerprint.json');

    const result = spawnSync(process.execPath, [
      BIN,
      'internal',
      'compute-scenario-fingerprint',
      '--layer', 'bootstrap',
      '--workspace-root', repo,
      '--setup-fingerprint', setupPath,
      '--graph-facts', graphFactsPath,
      '--provider-status', providerStatusPath,
      '--graph-bootstrap-summary', summaryPath,
      '--out', output,
    ], { cwd: repo, encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(fs.existsSync(output)).toBe(true);
    const payload = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(payload.schema_version).toBe(BOOTSTRAP_SCHEMA_VERSION);
    expect(payload.layer).toBe('bootstrap');
    expect(payload.advisory).toBe(true);
    expect(payload.topology.git_misaligned_build_targets).toBeNull();
    expect(payload.topology.build_target_coverage_ratio).toBeNull();
    expect(payload.topology.build_target_coverage_reason_code).toBe(PENDING_BUILD_TARGET_SCAN_REASON);
    expect(payload.worktree.dirty_child_count).toBe(1);
    expect(payload.providers_status_refs.gitnexus).toMatchObject({
      graph_ready: true,
      query_ready: true,
      status: 'ready',
    });
    expect(payload.providers_status_refs.gitnexus.status_path).not.toContain('\\');
    expect(payload.freshness.stale_setup_layer).toBe(false);
    expect(payload.freshness.setup_layer.path).toBe('.spec-first/workspace/scenario-fingerprint-setup.json');
  });

  test('marks stale setup layer when bootstrap revision differs', () => {
    const repo = initCommittedRepo();
    const revision = git(repo, ['rev-parse', 'HEAD']);
    const setupPath = writeSetupFingerprint(repo, '1111111111111111111111111111111111111111');
    const { graphFactsPath, providerStatusPath } = writeBootstrapInputs(repo, revision);

    const payload = computeBootstrapLayer({
      cwd: repo,
      workspaceRoot: repo,
      setupFingerprintPath: setupPath,
      graphFactsPath,
      providerStatusPath,
    });

    expect(payload.freshness.stale_setup_layer).toBe(true);
    expect(payload.freshness.stale_setup_layer_reasons).toEqual([
      expect.objectContaining({
        reason_code: 'setup-source-revision-mismatch',
        bootstrap_source_revision: revision,
      }),
    ]);
  });

  test('recomputes state_class / complexity_dimensions / tags when bootstrap discovers dirty graph facts', () => {
    // 回归场景：setup 层仍是 clean，但 graph-bootstrap 已经写入 dirty-graph facts。
    const repo = initCommittedRepo();
    const revision = git(repo, ['rev-parse', 'HEAD']);
    const setupPath = writeSetupFingerprint(repo, revision);
    const graphFactsPath = path.join(repo, '.spec-first', 'graph', 'graph-facts.json');
    const providerStatusPath = path.join(repo, '.spec-first', 'graph', 'provider-status.json');
    writeJson(graphFactsPath, {
      schema_version: 'graph-facts.v1',
      repo_root: repo,
      source_revision: revision,
      worktree_dirty: true,
      worktree_status_hash: 'sha256:dirty',
      source_revision_dirty: true,
      freshness_state: 'dirty-advisory',
      dirty_classification: 'graph-affecting-blocked',
      dirty_paths_sample: [{ path: 'src/app.js', graph_affecting: true }],
    });
    writeJson(providerStatusPath, {
      schema_version: 'graph-provider-status.v1',
      providers: [{
        provider: 'gitnexus',
        configured: true,
        graph_ready: true,
        query_ready: true,
        status: 'ready',
      }],
    });

    const payload = computeBootstrapLayer({
      cwd: repo,
      workspaceRoot: repo,
      setupFingerprintPath: setupPath,
      graphFactsPath,
      providerStatusPath,
    });

    expect(payload.state_class).toBe('dirty-single-repo');
    expect(payload.worktree.dirty).toBe(true);
    expect(payload.complexity_dimensions.worktree_dirty_graph_affecting).toBe(true);
    expect(payload.complexity_dimensions.provider_query_degraded).toBe(false);
    expect(payload.tags).toEqual(expect.arrayContaining([
      'dirty-single-repo',
      'worktree_dirty_graph_affecting',
      'bootstrap-layer',
    ]));
    expect(payload.tags).not.toContain('clean-single-repo');
  });

  test('does not mark provider degraded when bootstrap provider status is absent', () => {
    const repo = initCommittedRepo();
    const revision = git(repo, ['rev-parse', 'HEAD']);
    const setupPath = writeSetupFingerprint(repo, revision);
    const graphFactsPath = path.join(repo, '.spec-first', 'graph', 'graph-facts.json');
    writeJson(graphFactsPath, {
      schema_version: 'graph-facts.v1',
      repo_root: repo,
      source_revision: revision,
      worktree_dirty: false,
      worktree_status_hash: 'sha256:clean',
      freshness_state: 'fresh',
      dirty_paths_sample: [],
    });

    const payload = computeBootstrapLayer({
      cwd: repo,
      workspaceRoot: repo,
      setupFingerprintPath: setupPath,
      graphFactsPath,
      providerStatusPath: path.join(repo, '.spec-first', 'graph', 'missing-provider-status.json'),
    });

    expect(payload.state_class).toBe('clean-single-repo');
    expect(payload.complexity_dimensions.provider_query_degraded).toBe(false);
    expect(payload.tags).toEqual(expect.arrayContaining(['clean-single-repo', 'bootstrap-layer']));
  });

  test('missing setup layer skips artifact generation without failing bootstrap helper', () => {
    const repo = initCommittedRepo();
    const output = path.join(repo, '.spec-first', 'workspace', 'scenario-fingerprint.json');

    const result = spawnSync(process.execPath, [
      BIN,
      'internal',
      'compute-scenario-fingerprint',
      '--layer', 'bootstrap',
      '--workspace-root', repo,
      '--out', output,
    ], { cwd: repo, encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(fs.existsSync(output)).toBe(false);
    expect(JSON.parse(result.stdout)).toMatchObject({
      layer: 'bootstrap',
      fingerprint_setup_missing: true,
      reason_code: 'fingerprint-setup-missing',
    });
  });

  test('graph-bootstrap wrappers call bootstrap helper and document setup-missing handoff', () => {
    const bash = fs.readFileSync(BASH_BOOTSTRAP, 'utf8');
    const powershell = fs.readFileSync(POWERSHELL_BOOTSTRAP, 'utf8');
    const skill = fs.readFileSync(SKILL, 'utf8');
    const contract = fs.readFileSync(CONTRACT, 'utf8');

    expect(bash).toContain('write_bootstrap_scenario_fingerprint');
    expect(bash).toContain('--layer bootstrap');
    expect(bash).toContain('fingerprint_setup_missing');
    expect(powershell).toContain('Write-BootstrapScenarioFingerprint');
    expect(powershell).toContain("'--layer', 'bootstrap'");
    expect(powershell).toContain('fingerprint_setup_missing');
    expect(skill).toContain('.spec-first/workspace/scenario-fingerprint.json');
    expect(contract).toContain('developer-scenario-fingerprint.v1');
    expect(contract).toContain('pending-build-target-scan-p4');
  });
});
