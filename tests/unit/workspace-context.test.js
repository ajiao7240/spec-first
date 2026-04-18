'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadWorkspaceContext,
  resolveWorkspaceSlug,
} = require('../../src/context-routing/workspace-loader');
const { compileWorkspaceContext } = require('../../src/bootstrap-compiler/workspace-compiler');
const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');
const { evaluateContextForRepo } = require('../../src/context-routing/evaluator');

function createRepoFixture(root, slug) {
  const repoRoot = path.join(root, slug);
  fs.mkdirSync(path.join(repoRoot, 'docs', 'contexts', slug, 'architecture'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'minimal-context'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'docs', 'contexts', slug, '00-summary.md'), '# summary\n');
  fs.writeFileSync(path.join(repoRoot, 'docs', 'contexts', slug, 'README.md'), '# readme\n');
  fs.writeFileSync(path.join(repoRoot, 'docs', 'contexts', slug, 'architecture', 'module-map.md'), '# modules\n');
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'artifact-manifest.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    updated_at: '2026-04-15T00:00:00.000Z',
    status: 'complete',
    outputs: {
      'minimal-context/plan.json': { depends_on: [] },
      'architecture/module-map.md': { depends_on: [] },
    },
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'context-routing.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    always: ['00-summary.md', 'README.md'],
    stages: { plan: ['architecture/module-map.md'], work: [], review: [], unknown: ['README.md'] },
    selection_rules: [],
    advice: { plan: 'plan', work: 'work', review: 'review' },
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'minimal-context', 'plan.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    stage: 'plan',
    profile: 'plan-default',
    selected_assets: ['architecture/module-map.md'],
    fallback_reason: null,
    advice: 'plan',
  }, null, 2));
  return repoRoot;
}

describe('workspace context', () => {
  test('Windows 与 Unix 风格路径都能稳定解析 repo slug', () => {
    expect(resolveWorkspaceSlug('/tmp/repo-a')).toBe('repo-a');
    expect(resolveWorkspaceSlug('C:\\work\\repo-a')).toBe('repo-a');
    expect(resolveWorkspaceSlug('C:/work/repo-a')).toBe('repo-a');
  });

  test('多 repo 场景能合并 context，单 repo 行为不变，缺 repo 时优雅降级', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      const repoB = createRepoFixture(tmpDir, 'repo-b');
      const loaded = loadWorkspaceContext({
        repoRoots: [repoA, repoB, path.join(tmpDir, 'missing-repo')],
        stage: 'plan',
      });
      const compiled = compileWorkspaceContext({
        repoRoots: [repoA, repoB],
        stage: 'plan',
        cwd: tmpDir,
        target: tmpDir,
      });

      expect(loaded.filter((item) => item.status === 'ok')).toHaveLength(2);
      expect(loaded.some((item) => item.status === 'degraded')).toBe(true);
      expect(compiled.selected_assets).toContain('repo-a:minimal-context/plan.json');
      expect(compiled.selected_assets).toContain('repo-b:architecture/module-map.md');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('single repo workspace compile 不改变原有 selected_assets 顺序', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      const direct = evaluateContextForRepo({ repoRoot: repoA, slug: 'repo-a', stage: 'plan' });
      const workspace = compileWorkspaceContext({ repoRoots: [repoA], stage: 'plan' });

      expect(workspace.mode).toBe('single-repo');
      expect(workspace.selected_assets).toEqual(direct.selected_assets);
      expect(workspace.repo_count).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('workspace root 未命中 child repo 时只返回 workspace overview', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-root-'));
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');
    fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });

    try {
      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      const loaded = loadWorkspaceContext({
        stage: 'plan',
        cwd: workspaceRoot,
        target: workspaceRoot,
      });

      expect(loaded).toHaveLength(1);
      expect(loaded[0].evaluation.matched_child_slugs).toEqual([]);
      expect(loaded[0].evaluation.fallback_reason).toBe('workspace_child_unresolved');
      expect(loaded[0].evaluation.selected_assets).toEqual([
        `${path.basename(workspaceRoot)}:workspace/routing-overview.md`,
        `${path.basename(workspaceRoot)}:00-summary.md`,
      ]);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
