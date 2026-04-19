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
    data_quality: 'fact-backed',
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
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'minimal-context', 'work.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    stage: 'work',
    profile: 'work-default',
    selected_assets: ['code-facts/test-map.md'],
    platform_focus: ['web'],
    required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
    optional_verifications: ['browser-evidence'],
    fallback_reason: null,
    advice: 'work',
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'minimal-context', 'review.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    stage: 'review',
    profile: 'review-default',
    selected_assets: ['code-facts/high-risk-modules.md'],
    platform_focus: ['web'],
    verification_gaps_to_check: ['confirm unit-tests', 'confirm integration-tests', 'confirm browser-smoke'],
    fallback_reason: null,
    advice: 'review',
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'verification-profile.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    profile_id: 'web+jest',
    platforms: ['web'],
    languages: ['typescript'],
    detected_test_frameworks: ['jest'],
    required_gates: [
      { id: 'unit-tests', scope: 'repository' },
      { id: 'integration-tests', scope: 'cross-module' },
      { id: 'browser-smoke', scope: 'web-surface' },
    ],
    optional_gates: [
      { id: 'browser-evidence', scope: 'web-surface' },
    ],
    verifier_hints: [],
    environment_prerequisites: [],
    fallback_reason: null,
  }, null, 2));
  return repoRoot;
}

function writeVerificationEvidence(repoRoot, slug, evidenceItems) {
  const artifactDir = path.join(repoRoot, '.spec-first', 'workflows', 'verification', slug);
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, 'verification-evidence.json'), JSON.stringify({
    schema_version: 'v1',
    evidence_items: evidenceItems,
  }, null, 2));
}

function writeAiDevQualityGateResult(repoRoot, gateResult) {
  const artifactDir = path.join(repoRoot, '.spec-first', 'workflows', 'quality-gates', 'ai-dev-quality-gate');
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, 'ai-dev-quality-gate-result.json'), JSON.stringify(gateResult, null, 2));
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
      expect(compiled.workspace_slug).toBe(path.basename(tmpDir));
      expect(compiled.matched_child_slugs).toEqual(['repo-a', 'repo-b']);
      expect(compiled.selection_subject).toMatchObject({
        kind: 'repo',
        owner_slug: path.basename(tmpDir),
        subject_slug: 'repo-a',
      });
      expect(compiled.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'repo',
          slug: 'repo-a',
          asset_path: 'minimal-context/plan.json',
        }),
      ]));
      expect(compiled.level).toBe('L0');
      expect(compiled.fallback_reason).toBe(null);
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
      expect(workspace.selection_subject).toMatchObject({
        kind: 'project',
        subject_slug: 'repo-a',
      });
      expect(workspace.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'project',
          slug: 'repo-a',
          asset_path: 'minimal-context/plan.json',
        }),
      ]));
      expect(workspace.selected_assets).toEqual(direct.selected_assets);
      expect(workspace.repo_count).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('非 git 聚合目录即使只有一个 child repo，也保持 workspace 语义而不是静默塌缩为 single-repo', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-single-child-'));
    const workspaceRoot = path.join(tmpDir, 'workspace-root');

    try {
      fs.mkdirSync(workspaceRoot, { recursive: true });
      const repoA = createRepoFixture(path.join(workspaceRoot, 'packages'), 'repo-a');
      const workspace = compileWorkspaceContext({
        repoRoots: [repoA],
        stage: 'plan',
        cwd: workspaceRoot,
        target: workspaceRoot,
      });

      expect(workspace.mode).toBe('workspace');
      expect(workspace.workspace_slug).toBe('workspace-root');
      expect(workspace.selection_subject).toMatchObject({
        kind: 'repo',
        owner_slug: 'workspace-root',
        subject_slug: 'repo-a',
      });
      expect(workspace.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'repo',
          slug: 'repo-a',
          asset_path: 'minimal-context/plan.json',
        }),
      ]));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('single repo work compile 会产出 diff-aware verification_summary', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-work-verification-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      const workspace = compileWorkspaceContext({
        repoRoots: [repoA],
        stage: 'work',
        changedFiles: ['src/app/home/page.tsx'],
      });

      expect(workspace.mode).toBe('single-repo');
      expect(workspace.verification_summary).toMatchObject({
        stage: 'work',
        source: 'change-surface',
        platform_focus: ['web'],
        impacted_modules: ['src/app/'],
        impacted_languages: ['typescript'],
        impacted_platforms: ['web'],
        required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
        optional_verifications: ['browser-evidence'],
        recommended_required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
        recommended_optional_verifications: ['browser-evidence'],
        repo_required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
        repo_optional_verifications: ['browser-evidence'],
        confidence: 'high',
        fallback_reason: null,
      });
      expect(workspace.verifier_dispatch).toMatchObject({
        handoff_posture: 'manual-only',
        dispatch_candidates: expect.arrayContaining([
          expect.objectContaining({
            verifier: 'test-browser',
            posture: 'manual-handoff',
          }),
        ]),
        manual_required_verifications: ['unit-tests', 'integration-tests'],
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('single repo review compile 会优先用 diff-aware verification gaps，而不是 repo 级固定 gaps', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-review-verification-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      const workspace = compileWorkspaceContext({
        repoRoots: [repoA],
        stage: 'review',
        changedFiles: ['docs/guide.md'],
      });

      expect(workspace.mode).toBe('single-repo');
      expect(workspace.verification_summary).toMatchObject({
        stage: 'review',
        source: 'change-surface',
        platform_focus: [],
        impacted_modules: ['docs/'],
        impacted_languages: ['markdown'],
        impacted_platforms: [],
        recommended_required_verifications: [],
        recommended_optional_verifications: [],
        verification_gaps_to_check: [],
        repo_verification_gaps_to_check: ['confirm unit-tests', 'confirm integration-tests', 'confirm browser-smoke'],
        confidence: 'low',
        fallback_reason: null,
      });
      expect(workspace.verifier_dispatch).toMatchObject({
        handoff_posture: 'not-needed',
        dispatch_candidates: [],
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('single repo work compile 会把 verification evidence 合并进独立 contract 与 gate state', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-evidence-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      writeVerificationEvidence(repoA, 'repo-a', [
        {
          evidence_ref: 'evidence://browser-smoke/1',
          verifier: 'test-browser',
          gate_ids: ['browser-smoke', 'browser-evidence'],
          evidence_type: 'browser-snapshot',
          status: 'captured',
          artifact_path: '.spec-first/workflows/verification/repo-a/browser-smoke.png',
          captured_at: '2026-04-18T22:10:00.000Z',
          stage: 'work',
        },
      ]);

      const workspace = compileWorkspaceContext({
        repoRoots: [repoA],
        stage: 'work',
        changedFiles: ['src/app/home/page.tsx'],
      });

      expect(workspace.verification_evidence).toEqual({
        schema_version: 'v1',
        evidence_source: 'workflow-artifacts',
        evidence_items: [
          expect.objectContaining({
            evidence_ref: 'evidence://browser-smoke/1',
            verifier: 'test-browser',
          }),
        ],
      });
      expect(workspace.verification_gate_state).toMatchObject({
        overall_status: 'pending',
        evidence_locations: ['evidence://browser-smoke/1'],
        required_gates: expect.arrayContaining([
          expect.objectContaining({
            gate_id: 'browser-smoke',
            status: 'satisfied',
          }),
        ]),
        ci_gate: {
          status: 'pending',
          satisfied_required_gate_count: 1,
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('single repo compile 会暴露 ai-dev quality gate result，多 repo workspace 保持 null 以避免发明聚合语义', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-ai-dev-gate-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      const repoB = createRepoFixture(tmpDir, 'repo-b');
      writeAiDevQualityGateResult(repoA, {
        schema_version: 'v1',
        generated_at: '2026-04-18T13:20:00.000Z',
        gate_id: 'ai-dev-quality-gate',
        passed: true,
        checks: [],
        failures: [],
      });

      const singleRepo = compileWorkspaceContext({
        repoRoots: [repoA],
        stage: 'work',
        changedFiles: ['src/app/home/page.tsx'],
      });
      const workspace = compileWorkspaceContext({
        repoRoots: [repoA, repoB],
        stage: 'work',
        cwd: tmpDir,
        target: tmpDir,
        changedFiles: ['repo-a/src/app/home/page.tsx'],
      });

      expect(singleRepo.ai_dev_quality_gate_result).toEqual({
        schema_version: 'v1',
        generated_at: '2026-04-18T13:20:00.000Z',
        gate_id: 'ai-dev-quality-gate',
        passed: true,
        checks: [],
        failures: [],
      });
      expect(workspace.ai_dev_quality_gate_result).toBe(null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('multi repo work compile 在 docs-only 改动下保持 effective verification 为空，不回填 repo baseline', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-workspace-verification-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      const repoB = createRepoFixture(tmpDir, 'repo-b');
      const workspace = compileWorkspaceContext({
        repoRoots: [repoA, repoB],
        stage: 'work',
        changedFiles: [path.join(repoA, 'docs', 'guide.md')],
      });

      expect(workspace.mode).toBe('workspace');
      expect(workspace.verification_summary).toMatchObject({
        stage: 'work',
        source: 'change-surface',
        impacted_modules: ['docs/'],
        impacted_languages: ['markdown'],
        impacted_platforms: [],
        required_verifications: [],
        optional_verifications: [],
        recommended_required_verifications: [],
        recommended_optional_verifications: [],
        repo_required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
        repo_optional_verifications: ['browser-evidence'],
        confidence: 'low',
      });
      expect(workspace.verifier_dispatch).toMatchObject({
        handoff_posture: 'not-needed',
        dispatch_candidates: [],
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('workspace bootstrap 锚定 child 产物时仍能产出 diff-aware verification summary', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-anchored-verification-'));
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');

    try {
      fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repoA, 'src', 'app', 'home'), { recursive: true });
      fs.writeFileSync(path.join(repoA, 'package.json'), JSON.stringify({
        name: 'repo-a',
        scripts: {
          'test:unit': 'jest',
          'test:integration': 'jest',
        },
      }, null, 2));
      fs.writeFileSync(path.join(repoA, 'src', 'app', 'home', 'page.tsx'), 'export default function Page() { return null; }\n');
      fs.writeFileSync(path.join(repoB, 'package.json'), JSON.stringify({ name: 'repo-b' }, null, 2));

      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      const compiled = compileWorkspaceContext({
        repoRoots: [repoA, repoB],
        stage: 'work',
        cwd: workspaceRoot,
        target: path.join(repoA, 'src', 'app', 'home', 'page.tsx'),
        changedFiles: [path.join(repoA, 'src', 'app', 'home', 'page.tsx')],
      });

      expect(compiled.mode).toBe('workspace');
      expect(compiled.verification_summary.required_verifications).toEqual(
        expect.arrayContaining(['unit-tests', 'integration-tests'])
      );
      expect(compiled.verification_summary.repo_required_verifications).toEqual(
        expect.arrayContaining(['unit-tests', 'integration-tests'])
      );
      expect(compiled.verification_summary).toMatchObject({
        stage: 'work',
        source: 'change-surface',
        platform_focus: ['web'],
        impacted_modules: ['src/app/'],
        impacted_languages: ['typescript'],
        impacted_platforms: ['web'],
      });
      expect(compiled.verifier_dispatch).toMatchObject({
        handoff_posture: 'manual-only',
        manual_required_verifications: ['unit-tests', 'integration-tests'],
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('registered workspace 中显式单 child repo 仍保持 workspace shape，并使用 child 的 runtime contract', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-single-child-'));
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');

    try {
      fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repoA, 'src', 'app', 'home'), { recursive: true });
      fs.writeFileSync(path.join(repoA, 'package.json'), JSON.stringify({
        name: 'repo-a',
        scripts: {
          'test:unit': 'jest',
          'test:integration': 'jest',
        },
      }, null, 2));
      fs.writeFileSync(path.join(repoA, 'src', 'app', 'home', 'page.tsx'), 'export default function Page() { return null; }\n');
      fs.writeFileSync(path.join(repoB, 'package.json'), JSON.stringify({ name: 'repo-b' }, null, 2));

      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      const compiled = compileWorkspaceContext({
        repoRoots: [repoA],
        stage: 'work',
        cwd: workspaceRoot,
        target: repoA,
        changedFiles: [path.join(repoA, 'src', 'app', 'home', 'page.tsx')],
      });

      expect(compiled.mode).toBe('workspace');
      expect(compiled.workspace_slug).toBe(path.basename(workspaceRoot));
      expect(compiled.matched_child_slugs).toEqual(['packages-repo-a']);
      expect(compiled.selected_assets).toContain('packages-repo-a:minimal-context/work.json');
      expect(compiled.selected_assets).not.toContain('pitfalls/index.md');
      expect(compiled.verification_summary).toMatchObject({
        stage: 'work',
        source: 'change-surface',
        platform_focus: ['web'],
        impacted_modules: ['src/app/'],
        impacted_languages: ['typescript'],
        impacted_platforms: ['web'],
        required_verifications: ['unit-tests', 'integration-tests'],
        repo_required_verifications: ['unit-tests', 'integration-tests'],
      });
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

  test('workspace root 未命中 child repo 时不会把 idle child baseline 合并进 verification_summary', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-root-verification-'));
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');

    try {
      fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });
      fs.writeFileSync(path.join(repoA, 'package.json'), JSON.stringify({
        name: 'repo-a',
        scripts: {
          'test:unit': 'jest',
          'test:integration': 'jest',
          'test:smoke': 'jest',
        },
        bin: 'bin/repo-a.js',
        dependencies: {
          jest: '^29.0.0',
        },
      }, null, 2));
      fs.writeFileSync(path.join(repoB, 'package.json'), JSON.stringify({ name: 'repo-b' }, null, 2));

      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      const compiled = compileWorkspaceContext({
        stage: 'work',
        cwd: workspaceRoot,
        target: workspaceRoot,
      });

      expect(compiled.mode).toBe('workspace');
      expect(compiled.matched_child_slugs).toEqual([]);
      expect(compiled.selected_assets).toEqual([
        `${path.basename(workspaceRoot)}:workspace/routing-overview.md`,
        `${path.basename(workspaceRoot)}:00-summary.md`,
      ]);
      expect(compiled.verification_summary).toBe(null);
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
      // 空仓库 bootstrap 产出 data_quality=empty，child 评估为 L1，workspace 正确报告 partial degraded
      expect(loaded[0].evaluation.fallback_reason).toBe('workspace_child_partial_degraded');
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
