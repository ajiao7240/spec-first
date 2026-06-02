'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  PROVISIONAL_SCENARIO_CLASSES,
  SETUP_SCHEMA_VERSION,
  computeSetupLayer,
  toPosixPath,
} = require('../../src/cli/helpers/scenario-fingerprint');

const REPO_ROOT = path.join(__dirname, '..', '..');
const BIN = path.join(REPO_ROOT, 'bin', 'spec-first.js');
const BASH_VERIFY = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'scripts', 'verify-tools.sh');
const POWERSHELL_VERIFY = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'scripts', 'verify-tools.ps1');
const SKILL = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'SKILL.md');
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
  const repo = makeTempDir('scenario-fingerprint-repo-');
  git(repo, ['init']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'Test User']);
  git(repo, ['config', 'core.hooksPath', '/dev/null']);
  fs.appendFileSync(path.join(repo, '.git', 'info', 'exclude'), '\n.spec-first/\nledger.json\n');
  fs.writeFileSync(path.join(repo, 'README.md'), '# Fixture\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-m', 'init']);
  return repo;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe('setup scenario fingerprint contract', () => {
  test('internal CLI writes advisory setup fingerprint for a clean single repo', () => {
    const repo = initCommittedRepo();
    writeJson(path.join(repo, '.spec-first', 'config', 'tool-facts.json'), { schema_version: 'fixture' });
    const ledger = path.join(repo, 'ledger.json');
    writeJson(ledger, {
      target_kind: 'git-repo',
      target_mode: 'git-repo',
      target_root: repo,
      workspace_root: repo,
      repo_label: 'fixture',
      setup_facts: {
        tool_facts_path: '.spec-first/config/tool-facts.json',
        runtime_capabilities_path: '.spec-first/config/runtime-capabilities.json',
      },
    });
    const output = path.join(repo, '.spec-first', 'workspace', 'scenario-fingerprint-setup.json');

    const result = spawnSync(process.execPath, [
      BIN,
      'internal',
      'compute-scenario-fingerprint',
      '--layer', 'setup',
      '--ledger', ledger,
      '--out', output,
    ], { cwd: repo, encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(fs.existsSync(output)).toBe(true);
    const payload = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(payload.schema_version).toBe(SETUP_SCHEMA_VERSION);
    expect(payload.advisory).toBe(true);
    expect(payload.layer).toBe('setup');
    expect(payload.state_class).toBe('clean-single-repo');
    expect(payload.complexity_dimensions).toMatchObject({
      multi_repo_workspace: false,
      non_git_folder_target: false,
      non_git_build_targets_present: false,
      git_alignment_broken: false,
      parent_repo_local_artifacts_present: false,
      worktree_dirty_source_affecting: false,
    });
  });

  test('classifies normal first-time clones without artifacts separately from foreign residuals', () => {
    const repo = initCommittedRepo();
    const homeMissingPath = path.join(os.homedir(), 'definitely-missing-spec-first-fixture');
    writeJson(path.join(repo, '.spec-first', 'config', 'tool-facts.json'), {
      repo_root: homeMissingPath,
    });
    fs.rmSync(path.join(repo, '.spec-first'), { recursive: true, force: true });

    const payload = computeSetupLayer({
      cwd: repo,
      workspaceRoot: repo,
      targetFacts: {
        target_kind: 'git-repo',
        target_mode: 'git-repo',
        target_root: repo,
        workspace_root: repo,
      },
    });

    expect(payload.state_class).toBe('first-time-git-repo');
    expect(payload.foreign_residual_indicators).toEqual([]);
  });

  test('foreign residual requires stat failure and foreign prefix mismatch', () => {
    const repo = initCommittedRepo();
    writeJson(path.join(repo, '.spec-first', 'config', 'tool-facts.json'), {
      repo_root: '/private/var/spec-first-foreign-missing/repo',
    });

    const payload = computeSetupLayer({
      cwd: repo,
      workspaceRoot: repo,
      targetFacts: {
        target_kind: 'git-repo',
        target_mode: 'git-repo',
        target_root: repo,
        workspace_root: repo,
      },
    });

    expect(payload.state_class).toBe('foreign-residual-workspace');
    expect(payload.foreign_residual_indicators).toEqual([
      expect.objectContaining({
        path: '/private/var/spec-first-foreign-missing/repo',
        reason_code: 'stat-failed-and-foreign-prefix-mismatch',
      }),
    ]);
  });

  test('artifact writes fail closed outside workspace or through symlinked workspace dir', () => {
    const repo = initCommittedRepo();
    const outside = makeTempDir('scenario-fingerprint-outside-');
    const outsideOutput = path.join(outside, 'fingerprint.json');

    const outsideResult = spawnSync(process.execPath, [
      BIN,
      'internal',
      'compute-scenario-fingerprint',
      '--layer', 'setup',
      '--workspace-root', repo,
      '--out', outsideOutput,
    ], { cwd: repo, encoding: 'utf8' });

    expect(outsideResult.status).toBe(2);
    expect(JSON.parse(outsideResult.stdout).error.code).toBe('artifact-output-outside-workspace');

    fs.mkdirSync(path.join(repo, '.spec-first'), { recursive: true });
    fs.symlinkSync(outside, path.join(repo, '.spec-first', 'workspace'), 'dir');
    const symlinkResult = spawnSync(process.execPath, [
      BIN,
      'internal',
      'compute-scenario-fingerprint',
      '--layer', 'setup',
      '--workspace-root', repo,
      '--out', path.join(repo, '.spec-first', 'workspace', 'scenario-fingerprint-setup.json'),
    ], { cwd: repo, encoding: 'utf8' });

    expect(symlinkResult.status).toBe(2);
    expect(JSON.parse(symlinkResult.stdout).error.code).toBe('artifact-output-symlink-escape');
  });

  test('keeps scenario classes and dimensions documented as provisional contract', () => {
    const contract = fs.readFileSync(CONTRACT, 'utf8');
    for (const scenarioClass of PROVISIONAL_SCENARIO_CLASSES) {
      expect(contract).toContain(`\`${scenarioClass}\``);
    }
    for (const dimension of [
      'multi_repo_workspace',
      'non_git_folder_target',
      'non_git_build_targets_present',
      'git_alignment_broken',
      'parent_repo_local_artifacts_present',
      'worktree_dirty_source_affecting',
    ]) {
      expect(contract).toContain(`\`${dimension}\``);
    }
    expect(contract).toContain('No script may compute an aggregate risk score');
  });

  test('verify-tools wrappers call the Node helper and record warn-and-continue status', () => {
    const bash = fs.readFileSync(BASH_VERIFY, 'utf8');
    const powershell = fs.readFileSync(POWERSHELL_VERIFY, 'utf8');
    const skill = fs.readFileSync(SKILL, 'utf8');

    expect(bash).toContain('write_setup_scenario_fingerprint');
    expect(bash).toContain('internal compute-scenario-fingerprint --layer setup');
    expect(bash).toContain('scenario_fingerprint_setup');
    expect(powershell).toContain('Write-SetupScenarioFingerprint');
    expect(powershell).toContain('internal compute-scenario-fingerprint --layer setup');
    expect(powershell).toContain('scenario_fingerprint_setup');
    expect(skill).toContain('.spec-first/workspace/scenario-fingerprint-setup.json');
    expect(skill).toContain('wrapper failures are warn-and-continue');
  });

  test('path normalization uses POSIX separators', () => {
    expect(toPosixPath('C:\\Users\\dev\\repo\\.spec-first')).toBe('C:/Users/dev/repo/.spec-first');
  });
});
