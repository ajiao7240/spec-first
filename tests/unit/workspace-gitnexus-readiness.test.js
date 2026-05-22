'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  OVERLAY_QUERY_KEYS,
  SCRIPT_QUERY_KEYS,
  compileWorkspaceGitNexusReadiness,
} = require('../../src/cli/helpers/compile-workspace-gitnexus-readiness');

const REPO_ROOT = path.join(__dirname, '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'gitnexus-workspace');
const HELPER = path.join(REPO_ROOT, 'src', 'cli', 'helpers', 'compile-workspace-gitnexus-readiness.js');

function fixture(name) {
  return path.join(FIXTURES, name);
}

function readFixture(name) {
  return JSON.parse(fs.readFileSync(fixture(name), 'utf8'));
}

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function runHelper(args, cwd = REPO_ROOT) {
  const result = spawnSync(process.execPath, [HELPER, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return {
    ...result,
    json: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

function expectExactKeys(value, keys) {
  expect(Object.keys(value).sort()).toEqual([...keys].sort());
}

describe('workspace GitNexus readiness classifier', () => {
  test('script mode writes durable readiness with deterministic four-key query counts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const output = path.join(tmp, '.spec-first', 'workspace', 'gitnexus-readiness.json');

    const result = runHelper([
      '--mode', 'script',
      '--workspace-targets', fixture('workspace-graph-targets.dirty-overlay.example.json'),
      '--write-artifact',
      '--output', output,
    ], tmp);

    expect(result.status).toBe(0);
    expect(fs.existsSync(output)).toBe(true);
    const written = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(written).toEqual(result.json);
    expect(result.json.schema_version).toBe('workspace-gitnexus-readiness.v1');
    expect(result.json.git_root_topology).toBe('multi-repo-workspace');
    expect(result.json.invocation_mode).toBe('script');
    expect(result.json.group).toMatchObject({
      name: null,
      status: 'not-evaluated-no-mcp-input',
      query_selector: null,
    });
    expect(result.json.runtime_mcp_overlay).toBeUndefined();
    expect(result.json.group_reason_code).toBe('script-mode-no-mcp');
    expectExactKeys(result.json.query_usability_counts, SCRIPT_QUERY_KEYS);
    expect(result.json.query_usability_counts).toMatchObject({
      'fresh-primary': 1,
      'stale-advisory': 7,
      'definitions-pointer': 0,
      unavailable: 0,
    });
    expect(result.json.query_usability_counts['registry-present-query-unverified']).toBeUndefined();
    expect(result.json.query_usability_counts['registry-fanout-advisory']).toBeUndefined();
  });

  test('script mode writes only parent workspace advisory path, not child canonical graph paths', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const output = path.join(tmp, '.spec-first', 'workspace', 'gitnexus-readiness.json');

    const result = runHelper([
      '--mode', 'script',
      '--workspace-targets', fixture('topology-multi-repo-workspace.example.json'),
      '--write-artifact',
      '--output', output,
    ], tmp);

    expect(result.status).toBe(0);
    expect(fs.existsSync(output)).toBe(true);
    for (const blockedPath of [
      '.spec-first/graph',
      '.spec-first/providers',
      '.spec-first/impact',
      '.spec-first/config',
    ]) {
      expect(fs.existsSync(path.join(tmp, blockedPath))).toBe(false);
    }
  });

  test('skill-prose mode with ready group recommends group query and stays stdout-only', () => {
    const output = path.join(os.tmpdir(), 'should-not-write-gitnexus-readiness.json');
    const result = compileWorkspaceGitNexusReadiness({
      mode: 'skill-prose',
      workspaceTargets: fixture('workspace-graph-targets.dirty-overlay.example.json'),
      registryList: fixture('registry-list.kaz.gitnexus-1.6.4.captured-2026-05-22.example.json'),
      groupList: fixture('group-list.ready.gitnexus-1.6.4.captured-2026-05-22.example.json'),
      output,
    }, REPO_ROOT);

    expect(result.write_path).toBeNull();
    expect(result.payload.recommended_query_path).toBe('group-query');
    expect(result.payload.group).toMatchObject({
      name: 'kaz-workspace',
      status: 'group-ready',
      query_selector: '@kaz-workspace',
    });
    expectExactKeys(result.payload.group, ['name', 'status', 'query_selector']);
    expect(result.payload.group_reason_code).toBeNull();
    expect(result.payload.runtime_mcp_overlay).toEqual({ status: 'evaluated' });
    expectExactKeys(result.payload.query_usability_counts, OVERLAY_QUERY_KEYS);
    expect(result.payload.query_usability_counts).toMatchObject({
      'stale-advisory': 7,
      'registry-fanout-advisory': 1,
      'registry-present-query-unverified': 0,
    });
    expect(fs.existsSync(output)).toBe(false);
  });

  test('skill-prose mode with empty group recommends bounded registry fanout', () => {
    const result = compileWorkspaceGitNexusReadiness({
      mode: 'skill-prose',
      workspaceTargets: fixture('workspace-graph-targets.dirty-overlay.example.json'),
      registryList: fixture('registry-list.kaz.gitnexus-1.6.4.captured-2026-05-22.example.json'),
      groupList: fixture('group-list.empty.gitnexus-1.6.4.captured-2026-05-22.example.json'),
    }, REPO_ROOT);

    expect(result.payload.recommended_query_path).toBe('bounded-registry-fanout');
    expect(result.payload.group).toMatchObject({
      name: null,
      status: 'group-missing',
      query_selector: null,
    });
    expectExactKeys(result.payload.group, ['name', 'status', 'query_selector']);
    expect(result.payload.group_reason_code).toBe('group-list-empty');
  });

  test.each([
    ['single repo', 'topology-single-repo.example.json'],
    ['monorepo', 'topology-monorepo.example.json'],
  ])('%s topology returns not-applicable and does not write an artifact', (_label, fileName) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const output = path.join(tmp, 'readiness.json');
    const result = runHelper([
      '--mode', 'script',
      '--workspace-targets', fixture(fileName),
      '--write-artifact',
      '--output', output,
    ], tmp);

    expect(result.status).toBe(0);
    expect(result.json.status).toBe('not-applicable');
    expect(result.json.git_root_topology).toBe('single-repo');
    expect(result.json.recommended_query_path).toBe('direct-read-fallback');
    expect(result.json.group.status).toBe('not-evaluated-no-mcp-input');
    expect(fs.existsSync(output)).toBe(false);
  });

  test('development_mode input is rejected as unsupported classifier input', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const value = readFixture('topology-multi-repo-workspace.example.json');
    value.development_mode = 'multi-repo-workspace';
    const input = writeJson(tmp, 'with-development-mode.json', value);
    const result = runHelper(['--mode', 'script', '--workspace-targets', input], tmp);

    expect(result.status).toBe(2);
    expect(result.json.error.code).toBe('unsupported-input');
  });

  test('invalid registry root shape fails closed', () => {
    const result = runHelper([
      '--mode', 'skill-prose',
      '--workspace-targets', fixture('workspace-graph-targets.dirty-overlay.example.json'),
      '--registry-list', fixture('registry-list.invalid-shape.example.json'),
    ]);

    expect(result.status).toBe(1);
    expect(result.json.error.code).toBe('invalid-registry-snapshot');
  });

  test('missing required registry fields degrade registry evidence without global failure', () => {
    const result = compileWorkspaceGitNexusReadiness({
      mode: 'skill-prose',
      workspaceTargets: fixture('workspace-graph-targets.dirty-overlay.example.json'),
      registryList: fixture('registry-list.missing-required-field.example.json'),
      groupList: fixture('group-list.ready.gitnexus-1.6.4.captured-2026-05-22.example.json'),
    }, REPO_ROOT);

    expect(result.payload.runtime_mcp_overlay).toEqual({ status: 'partial' });
    expect(result.payload.limitations).toContain('registry snapshot: unknown-payload-shape');
    expect(result.payload.group.status).toBe('group-ready');
    expect(result.payload.repos.every((repo) => repo.registry_match.status === 'not-evaluated')).toBe(true);
  });

  test('invalid group snapshot degrades group evidence but keeps registry fanout available', () => {
    const result = compileWorkspaceGitNexusReadiness({
      mode: 'skill-prose',
      workspaceTargets: fixture('workspace-graph-targets.dirty-overlay.example.json'),
      registryList: fixture('registry-list.kaz.gitnexus-1.6.4.captured-2026-05-22.example.json'),
      groupList: fixture('group-list.invalid-shape.example.json'),
    }, REPO_ROOT);

    expect(result.payload.runtime_mcp_overlay).toEqual({ status: 'partial' });
    expect(result.payload.group).toEqual({
      name: null,
      status: 'unavailable',
      query_selector: null,
    });
    expect(result.payload.group_reason_code).toBe('unknown-payload-shape');
    expect(result.payload.recommended_query_path).toBe('bounded-registry-fanout');
    expect(result.payload.limitations).toContain('group snapshot: unknown-payload-shape');
  });

  test('unknown future registry fields are ignored', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const registryPath = writeJson(tmp, 'registry-with-extra-fields.json', {
      future_provider_field: {
        ignored: true,
      },
      repos: [
        {
          name: 'service-a',
          path: '/workspace/simple/service-a',
          future_repo_field: 'ignored',
        },
      ],
    });
    const result = compileWorkspaceGitNexusReadiness({
      mode: 'skill-prose',
      workspaceTargets: fixture('topology-multi-repo-workspace.example.json'),
      registryList: registryPath,
      groupList: fixture('group-list.empty.gitnexus-1.6.4.captured-2026-05-22.example.json'),
    }, REPO_ROOT);

    expect(result.payload.recommended_query_path).toBe('bounded-registry-fanout');
    expect(result.payload.repos).toHaveLength(1);
    expect(result.payload.repos[0].registry_match.status).toBe('matched');
  });

  test('registry-present repo without current or prior query proof is query-unverified, not stale advisory', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const targets = readFixture('topology-multi-repo-workspace.example.json');
    targets.repos[0].query_usability = 'unavailable';
    targets.repos[0].providers.gitnexus.query_ready = false;
    targets.repos[0].providers.gitnexus.last_indexed_commit = null;
    const targetsPath = writeJson(tmp, 'query-unverified-targets.json', targets);
    const registryPath = writeJson(tmp, 'registry-service-a.json', {
      repos: [
        { name: 'service-a', path: '/workspace/simple/service-a' },
      ],
    });

    const result = compileWorkspaceGitNexusReadiness({
      mode: 'skill-prose',
      workspaceTargets: targetsPath,
      registryList: registryPath,
      groupList: fixture('group-list.empty.gitnexus-1.6.4.captured-2026-05-22.example.json'),
    }, tmp);

    expect(result.payload.repos[0].query_usability).toBe('registry-present-query-unverified');
    expect(result.payload.query_usability_counts['registry-present-query-unverified']).toBe(1);
    expect(result.payload.query_usability_counts['stale-advisory']).toBe(0);
  });

  test('registry-present repo requiring clean full refresh is query-unverified despite carried commit', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const registryPath = writeJson(tmp, 'registry-service-a.json', {
      repos: [
        { name: 'service-a', path: '/workspace/simple/service-a' },
      ],
    });

    const result = compileWorkspaceGitNexusReadiness({
      mode: 'skill-prose',
      workspaceTargets: fixture('workspace-graph-targets.carry-forward-broken.example.json'),
      registryList: registryPath,
      groupList: fixture('group-list.empty.gitnexus-1.6.4.captured-2026-05-22.example.json'),
    }, tmp);

    expect(result.payload.repos[0].query_usability).toBe('registry-present-query-unverified');
    expect(result.payload.query_usability_counts['registry-present-query-unverified']).toBe(1);
    expect(result.payload.query_usability_counts['stale-advisory']).toBe(0);
  });

  test('script mode rejects overlay-only query usability values before counting', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-gitnexus-readiness-'));
    const targets = readFixture('topology-multi-repo-workspace.example.json');
    targets.repos[0].query_usability = 'registry-present-query-unverified';
    const targetsPath = writeJson(tmp, 'script-overlay-value-targets.json', targets);

    const result = compileWorkspaceGitNexusReadiness({
      mode: 'script',
      workspaceTargets: targetsPath,
    }, tmp);

    expect(result.payload.repos[0].query_usability).toBe('unavailable');
    expect(result.payload.query_usability_counts).toEqual({
      'fresh-primary': 0,
      'stale-advisory': 0,
      'definitions-pointer': 0,
      unavailable: 1,
    });
    expect(Object.values(result.payload.query_usability_counts).reduce((sum, value) => sum + value, 0)).toBe(result.payload.repos.length);
  });

  test('skill-prose mode rejects artifact persistence', () => {
    const result = runHelper([
      '--mode', 'skill-prose',
      '--workspace-targets', fixture('workspace-graph-targets.dirty-overlay.example.json'),
      '--registry-list', fixture('registry-list.kaz.gitnexus-1.6.4.captured-2026-05-22.example.json'),
      '--write-artifact',
    ]);

    expect(result.status).toBe(2);
    expect(result.json.error.code).toBe('skill-prose-mode-cannot-persist');
  });
});
