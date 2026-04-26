'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { resolveWorkspaceConfig, resolveWorkspaceIndex } = require('../../src/crg/artifact-paths');
const { discoverWorkspace } = require('../../src/crg/workspace/discovery');
const { buildWorkspaceContext } = require('../../src/crg/workspace/context');
const { buildWorkspaceStatus } = require('../../src/crg/workspace/status');

function makeTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-workspace-'));
}

function makeGitRepo(repoRoot) {
  fs.mkdirSync(repoRoot, { recursive: true });
  execFileSync('git', ['init', '-q', repoRoot], { stdio: 'ignore' });
}

describe('crg workspace discovery', () => {
  test('fallback scan discovers multiple child git repos deterministically', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-b'));
    makeGitRepo(path.join(root, 'repo-a'));

    const index = discoverWorkspace(root, { write: true });

    expect(index.schema_version).toBe('workspace-index/v1');
    expect(index.scope.source).toBe('fallback_bounded_scan');
    expect(index.children.map((child) => child.slug)).toEqual(['repo-a', 'repo-b']);
    expect(index.children.every((child) => child.signals.includes('git_root_verified'))).toBe(true);
    expect(index.children.every((child) => child.signals.includes('scope_fallback_bounded_scan'))).toBe(true);
    expect(fs.existsSync(resolveWorkspaceIndex(root))).toBe(true);
  });

  test('workspace config limits discovery to configured include roots', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));
    makeGitRepo(path.join(root, 'repo-b'));
    fs.mkdirSync(path.dirname(resolveWorkspaceConfig(root)), { recursive: true });
    fs.writeFileSync(resolveWorkspaceConfig(root), JSON.stringify({
      schema_version: 'workspace-config/v1',
      include_roots: ['repo-b'],
      exclude_globs: [],
      max_depth: 1,
    }));

    const index = discoverWorkspace(root, { write: false });

    expect(index.scope.source).toBe('workspace_config');
    expect(index.children.map((child) => child.slug)).toEqual(['repo-b']);
    expect(index.children[0].signals).toContain('scope_config_applied');
  });

  test('workspace config without include roots still labels scoped bounded scan as config-applied', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));
    makeGitRepo(path.join(root, 'vendor', 'repo-vendor'));
    fs.mkdirSync(path.dirname(resolveWorkspaceConfig(root)), { recursive: true });
    fs.writeFileSync(resolveWorkspaceConfig(root), JSON.stringify({
      schema_version: 'workspace-config/v1',
      exclude_globs: ['vendor/**'],
      max_depth: 2,
    }));

    const index = discoverWorkspace(root, { write: false });

    expect(index.scope.source).toBe('workspace_config');
    expect(index.children.map((child) => child.slug)).toEqual(['repo-a']);
    expect(index.children[0].signals).toContain('scope_config_applied');
    expect(index.children[0].signals).not.toContain('scope_fallback_bounded_scan');
  });

  test('workspace config exclude_globs apply to explicit include roots', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));
    makeGitRepo(path.join(root, 'repo-b'));
    fs.mkdirSync(path.dirname(resolveWorkspaceConfig(root)), { recursive: true });
    fs.writeFileSync(resolveWorkspaceConfig(root), JSON.stringify({
      schema_version: 'workspace-config/v1',
      include_roots: ['repo-a', 'repo-b'],
      exclude_globs: ['repo-b/**'],
      max_depth: 1,
    }));

    const index = discoverWorkspace(root, { write: false });

    expect(index.children.map((child) => child.slug)).toEqual(['repo-a']);
    expect(index.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'scope_excluded' }),
    ]));
  });

  test('root repo plus nested independent repos are both surfaced as candidates', () => {
    const root = makeTempWorkspace();
    makeGitRepo(root);
    makeGitRepo(path.join(root, 'services', 'api'));

    const index = discoverWorkspace(root, { write: false });

    expect(index.children.map((child) => child.relationship)).toEqual([
      'root_repo',
      'nested_independent_repo',
    ]);
    expect(index.children.map((child) => child.slug)).toEqual(['root', 'api']);
  });

  test('generated directories are ignored during fallback scan', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));
    makeGitRepo(path.join(root, 'node_modules', 'pkg'));

    const index = discoverWorkspace(root, { write: false });

    expect(index.children.map((child) => child.slug)).toEqual(['repo-a']);
    expect(index.ignored_candidates.some((item) => item.relative_path === 'node_modules')).toBe(true);
  });

  test('slug collisions are resolved with a stable signal', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'apps', 'api'));
    makeGitRepo(path.join(root, 'services', 'api'));

    const index = discoverWorkspace(root, { write: false });
    const slugs = index.children.map((child) => child.slug);

    expect(slugs).toHaveLength(2);
    expect(new Set(slugs).size).toBe(2);
    expect(index.children.some((child) => child.signals.includes('slug_collision_resolved'))).toBe(true);
  });

  test('status reports per-child missing graph without parent graph build', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));

    const status = buildWorkspaceStatus(root, { write: true });

    expect(status.schema_version).toBe('workspace-status/v1');
    expect(status.children[0].readiness).toBe('missing');
    expect(status.children[0].signals).toContain('graph_missing');
    expect(fs.existsSync(path.join(root, '.spec-first', 'graph', 'graph.db'))).toBe(false);
  });

  test('context ranks candidates by task path and does not select a semantic target', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));
    makeGitRepo(path.join(root, 'repo-b'));

    const context = buildWorkspaceContext(root, { task: 'change repo-b/src/api.js' });
    const serialized = JSON.stringify(context);

    expect(context.candidates[0].slug).toBe('repo-b');
    expect(context.candidates[0].signals).toContain('task_path_signal');
    expect(serialized).not.toContain('selected_repo');
    expect(serialized).not.toContain('target_repo');
    expect(serialized).not.toContain('final_repo');
  });

  test('context scores root repo changed files without swallowing nested repo files', () => {
    const root = makeTempWorkspace();
    makeGitRepo(root);
    makeGitRepo(path.join(root, 'nested'));

    const rootContext = buildWorkspaceContext(root, {
      changedFiles: ['src/index.js'],
      write: false,
    });
    const nestedContext = buildWorkspaceContext(root, {
      changedFiles: ['nested/src/index.js'],
      write: false,
    });

    expect(rootContext.candidates[0].slug).toBe('root');
    expect(rootContext.candidates[0].signals).toContain('changed_files_under_repo');
    expect(nestedContext.candidates[0].slug).toBe('nested');
    expect(nestedContext.candidates[0].signals).toContain('changed_files_under_repo');
  });
});
