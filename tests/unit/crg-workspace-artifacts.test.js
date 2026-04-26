'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  resolveWorkspaceConfig,
  resolveWorkspaceDir,
  resolveWorkspaceIndex,
  resolveWorkspaceOperationsLog,
  resolveWorkspaceStatus,
} = require('../../src/crg/artifact-paths');
const {
  makeChildSlug,
  resolveWorkspaceArtifacts,
  sanitizeSlugPart,
} = require('../../src/crg/workspace/artifacts');
const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const { buildWorkspaceContext } = require('../../src/crg/workspace/context');
const { buildWorkspaceStatus } = require('../../src/crg/workspace/status');

const REPO_ROOT = path.join(__dirname, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function makeTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-workspace-artifacts-'));
}

function makeGitRepo(repoRoot) {
  fs.mkdirSync(repoRoot, { recursive: true });
  execFileSync('git', ['init', '-q', repoRoot], { stdio: 'ignore' });
}

describe('crg workspace artifacts', () => {
  test('resolves workspace artifacts under .spec-first/workspace', () => {
    expect(resolveWorkspaceDir('/workspace')).toBe('/workspace/.spec-first/workspace');
    expect(resolveWorkspaceConfig('/workspace')).toBe('/workspace/.spec-first/workspace/workspace-config.json');
    expect(resolveWorkspaceIndex('/workspace')).toBe('/workspace/.spec-first/workspace/workspace-index.json');
    expect(resolveWorkspaceStatus('/workspace')).toBe('/workspace/.spec-first/workspace/workspace-status.json');
    expect(resolveWorkspaceOperationsLog('/workspace')).toBe('/workspace/.spec-first/workspace/workspace-operations.jsonl');

    const artifacts = resolveWorkspaceArtifacts('/workspace');
    expect(artifacts.index_path).toBe('/workspace/.spec-first/workspace/workspace-index.json');
    expect(artifacts.status_path).not.toContain('/.spec-first/graph/');
  });

  test('child slug normalization is deterministic and collision-safe', () => {
    const used = new Set();
    const first = makeChildSlug('/workspace', '/workspace/apps/api', used);
    const second = makeChildSlug('/workspace', '/workspace/services/api', used);

    expect(first.slug).toBe('api');
    expect(second.slug).toMatch(/^api-[a-f0-9]{8}$/);
    expect(second.collision_resolved).toBe(true);
    expect(sanitizeSlugPart('../My Repo!')).toBe('..-my-repo');
  });

  test('workspace schemas validate representative payloads', () => {
    const configSchema = readJson('docs/contracts/crg/workspace-config.schema.json');
    const indexSchema = readJson('docs/contracts/crg/workspace-index.schema.json');
    const statusSchema = readJson('docs/contracts/crg/workspace-status.schema.json');
    const contextSchema = readJson('docs/contracts/crg/workspace-context.schema.json');
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));

    const config = {
      schema_version: 'workspace-config/v1',
      include_roots: ['repo-a'],
      exclude_globs: ['vendor/**'],
      max_depth: 2,
    };
    const index = {
      schema_version: 'workspace-index/v1',
      workspace_root: '/workspace',
      generated_at: '2026-04-26T00:00:00.000Z',
      scope: {
        source: 'workspace_config',
        include_roots: ['repo-a'],
        exclude_globs: ['vendor/**'],
        max_depth: 2,
      },
      root_fingerprint: {
        algorithm: 'workspace-discovery/v1',
        value: 'abc123',
      },
      children: [
        {
          slug: 'repo-a',
          repo_root: '/workspace/repo-a',
          git_root: '/workspace/repo-a',
          relative_path: 'repo-a',
          relationship: 'nested_independent_repo',
          candidate: true,
          signals: ['scope_config_applied', 'git_root_verified', 'nested_repo_detected'],
          limitations: [],
        },
      ],
      ignored_candidates: [],
      stale_entries: [
        {
          slug: 'old',
          repo_root: '/workspace/old',
          signals: ['stale_child_path'],
          limitations: [{ code: 'stale_child_path', message: 'missing' }],
        },
      ],
      limitations: [],
    };
    const status = buildWorkspaceStatus(root, { write: false });
    const context = buildWorkspaceContext(root, {
      task: 'change repo-a',
      write: false,
    });

    expect(validateAgainstSchema(configSchema, config).errors).toEqual([]);
    expect(validateAgainstSchema(indexSchema, index).errors).toEqual([]);
    expect(validateAgainstSchema(statusSchema, status).errors).toEqual([]);
    expect(validateAgainstSchema(contextSchema, context).errors).toEqual([]);
    expect(JSON.stringify(context)).not.toContain('selected_repo');
    expect(JSON.stringify(context)).not.toContain('target_repo');
    expect(JSON.stringify(context)).not.toContain('final_repo');
  });
});
