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
const {
  buildWorkspaceControlPlanePaths,
  chooseMatchedChildren,
} = require('../../src/context-routing/entry-resolver');

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

  test('workspace 场景将相对 changedFiles 视为相对 workspaceRoot 解析', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-anchor-'));
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');

    try {
      const matched = chooseMatchedChildren({
        registry: {
          children: [
            {
              childSlug: 'repo-a',
              repoRoot: repoA,
            },
          ],
        },
        routing: {
          childMatchSignalPriority: ['changedFiles', 'default'],
        },
        changedFiles: ['packages/repo-a/src/index.js'],
        workspaceRoot,
      });

      expect(matched).toEqual({
        matchedChildSlugs: ['repo-a'],
        matchReason: 'changedFiles',
      });
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('workspace 选中 healthy child 时聚合 freshness_status=healthy', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-freshness-'));
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });

    try {
      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA],
      });

      const registry = JSON.parse(fs.readFileSync(
        buildWorkspaceControlPlanePaths(workspaceRoot).registryPath,
        'utf8'
      ));
      const childSlug = registry.children[0].childSlug;
      const loaded = loadWorkspaceContext({
        stage: 'plan',
        cwd: workspaceRoot,
        changedFiles: ['packages/repo-a/src/index.js'],
      });

      expect(loaded).toHaveLength(1);
      expect(loaded[0].evaluation.matched_child_slugs).toEqual([childSlug]);
      expect(loaded[0].evaluation.freshness_status).toBe('healthy');
      expect(loaded[0].evaluation.fallback_reason).toBe(null);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('workspace rerun 去掉 child 后会 prune 旧 child 产物', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-prune-'));
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');
    fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });

    try {
      // 第一次：[repoA, repoB]
      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      const registry1 = JSON.parse(fs.readFileSync(
        buildWorkspaceControlPlanePaths(workspaceRoot).registryPath,
        'utf8'
      ));
      const slugA = registry1.children.find((c) => c.repoRoot.endsWith('repo-a')).childSlug;
      const slugB = registry1.children.find((c) => c.repoRoot.endsWith('repo-b')).childSlug;

      // 第一次产物都存在
      const ctxBPath = path.join(workspaceRoot, 'docs', 'contexts', slugB);
      const cpBPath = path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', slugB);
      expect(fs.existsSync(ctxBPath)).toBe(true);
      expect(fs.existsSync(cpBPath)).toBe(true);

      // 第二次：只保留 repoA
      const result = runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T01:00:00.000Z',
        repoRoots: [repoA],
      });

      // repoB 产物应被 prune
      expect(fs.existsSync(ctxBPath)).toBe(false);
      expect(fs.existsSync(cpBPath)).toBe(false);
      // repoA 产物仍在
      expect(fs.existsSync(path.join(workspaceRoot, 'docs', 'contexts', slugA))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', slugA))).toBe(true);
      // 返回值记录了 prune 结果
      expect(Array.isArray(result.prunedChildSlugs)).toBe(true);
      expect(result.prunedChildSlugs).toContain(slugB);
      // failedPrunes 字段在 happy path 应为空数组（契约向后兼容审计）
      expect(Array.isArray(result.failedPrunes)).toBe(true);
      expect(result.failedPrunes).toHaveLength(0);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('chooseMatchedChildren 无 workspaceRoot 时按 process.cwd 解析（向后兼容）', () => {
    // 修复保留了"无 anchor 时 fallback 到 path.resolve(candidate)"向后兼容分支。
    // 该路径若未来被简化或反转，此测试会首先失败，避免悄悄破坏旧调用方。
    // 注：macOS 下 os.tmpdir() 是 /var/... → /private/var/... 符号链接，
    //   process.cwd() 会返回 canonical 路径，因此 expectedRepoRoot 必须走 realpathSync 归一化。
    const tmpCwdRaw = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-cwd-fallback-'));
    const tmpCwd = fs.realpathSync(tmpCwdRaw);
    const originalCwd = process.cwd();

    try {
      process.chdir(tmpCwd);

      const expectedRepoRoot = path.resolve(tmpCwd, 'packages/repo-a');
      const matched = chooseMatchedChildren({
        registry: {
          children: [{ childSlug: 'repo-a', repoRoot: expectedRepoRoot }],
        },
        routing: {
          childMatchSignalPriority: ['changedFiles', 'default'],
        },
        changedFiles: ['packages/repo-a/src/x.js'],
        // 故意不传 workspaceRoot：应按 process.cwd() 解析相对路径
      });

      expect(matched).toEqual({
        matchedChildSlugs: ['repo-a'],
        matchReason: 'changedFiles',
      });
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tmpCwdRaw, { recursive: true, force: true });
    }
  });

  test('workspace rerun prune 中单 child rm 失败只收集 failedPrunes 不拖累主产出', () => {
    // 验证 P2-1 修复：rmSync 失败被 try/catch 隔离，其他 child prune 继续，
    // bootstrap 主产出仍 status=complete
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-failed-prune-'));
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');
    const repoC = path.join(workspaceRoot, 'packages', 'repo-c');
    fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repoC, '.git'), { recursive: true });

    const originalRmSync = fs.rmSync;
    try {
      // 第一次建三个 child
      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB, repoC],
      });

      const registry = JSON.parse(fs.readFileSync(
        buildWorkspaceControlPlanePaths(workspaceRoot).registryPath,
        'utf8'
      ));
      const slugB = registry.children.find((c) => c.repoRoot.endsWith('repo-b')).childSlug;
      const slugC = registry.children.find((c) => c.repoRoot.endsWith('repo-c')).childSlug;

      // 拦截对 repo-b context dir 的 rm，模拟失败；其他路径正常
      const ctxBPath = path.join(workspaceRoot, 'docs', 'contexts', slugB);
      fs.rmSync = function patchedRmSync(target, options) {
        if (typeof target === 'string' && target === ctxBPath) {
          const err = new Error('EBUSY: resource busy');
          err.code = 'EBUSY';
          throw err;
        }
        return originalRmSync.call(fs, target, options);
      };

      // 第二次：只保留 repoA，应 prune repoB/repoC
      const result = runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T01:00:00.000Z',
        repoRoots: [repoA],
      });

      // bootstrap 主体仍 complete
      expect(result.status).toBe('complete');
      // repoC 正常 prune，repoB 因 mock 失败
      expect(result.prunedChildSlugs).toContain(slugC);
      expect(result.prunedChildSlugs).not.toContain(slugB);
      expect(result.failedPrunes).toHaveLength(1);
      expect(result.failedPrunes[0].childSlug).toBe(slugB);
      expect(result.failedPrunes[0].error).toMatch(/EBUSY/);
    } finally {
      fs.rmSync = originalRmSync;
      originalRmSync.call(fs, workspaceRoot, { recursive: true, force: true });
    }
  });
});
