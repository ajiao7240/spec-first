'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'spec-first.js');
const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');
const { buildChildSlug } = require('../../src/bootstrap-compiler/workspace-registry');

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
      'minimal-context/work.json': { depends_on: [] },
      'minimal-context/review.json': { depends_on: [] },
      'architecture/module-map.md': { depends_on: [] },
    },
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'context-routing.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    always: ['00-summary.md', 'README.md'],
    stages: {
      plan: ['architecture/module-map.md'],
      work: ['code-facts/test-map.md'],
      review: ['code-facts/high-risk-modules.md'],
      unknown: ['README.md'],
    },
    selection_rules: [],
    advice: { plan: 'plan', work: 'work', review: 'review' },
  }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug, 'minimal-context', 'plan.json'), JSON.stringify({
    schema_version: 'v1',
    generated_at: '2026-04-15T00:00:00.000Z',
    stage: 'plan',
    profile: 'plan-default',
    selected_assets: ['architecture/module-map.md'],
    platform_focus: ['web'],
    required_verifications: ['unit-tests', 'integration-tests'],
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

function runStage0Context(args, options = {}) {
  const output = execFileSync(process.execPath, [BIN_PATH, 'stage0-context', ...args], {
    encoding: 'utf8',
    ...options,
  });
  return JSON.parse(output);
}

function latestTelemetryRecord(rootDir) {
  const files = fs.readdirSync(rootDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  if (files.length === 0) return null;
  const filePath = path.join(rootDir, files[files.length - 1]);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('stage0-context command', () => {
  test('显式 workflow 时输出 diff-aware work summary，并把 telemetry 记到对应 workflow 目录', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-command-'));

    try {
      const repoRoot = createRepoFixture(tmpDir, 'repo-a');
      const result = runStage0Context([
        '--stage', 'work',
        '--workflow', 'spec-work-beta',
        '--repo-root', repoRoot,
        '--changed-file', 'src/app/home/page.tsx',
        '--cwd', repoRoot,
        '--target', repoRoot,
      ], { cwd: repoRoot });

      expect(result.stage).toBe('work');
      expect(result.mode).toBe('single-repo');
      expect(result.selection_subject).toMatchObject({
        kind: 'project',
        subject_slug: 'repo-a',
      });
      expect(result.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'project',
          slug: 'repo-a',
          asset_path: 'minimal-context/work.json',
        }),
      ]));
      expect(result.selected_assets).toContain('minimal-context/work.json');
      expect(result.verification_summary).toMatchObject({
        source: 'change-surface',
        impacted_modules: ['src/app/'],
        impacted_languages: ['typescript'],
        impacted_platforms: ['web'],
        required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
        optional_verifications: ['browser-evidence'],
      });
      expect(result.verifier_dispatch).toMatchObject({
        handoff_posture: 'manual-only',
        dispatch_candidates: expect.arrayContaining([
          expect.objectContaining({
            verifier: 'test-browser',
            posture: 'manual-handoff',
          }),
        ]),
        manual_required_verifications: ['unit-tests', 'integration-tests'],
      });
      expect(result.verification_gate_state).toMatchObject({
        overall_status: expect.any(String),
        required_gates: expect.arrayContaining([
          expect.objectContaining({ gate_id: 'unit-tests' }),
          expect.objectContaining({ gate_id: 'browser-smoke' }),
        ]),
      });

      const telemetryDir = path.join(repoRoot, '.spec-first', 'workflows', 'spec-work-beta', 'repo-a');
      expect(fs.existsSync(telemetryDir)).toBe(true);
      expect(latestTelemetryRecord(telemetryDir)).toMatchObject({
        workflow: 'spec-work-beta',
        stage: 'work',
        verification_summary: {
          source: 'change-surface',
          required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
          optional_verifications: ['browser-evidence'],
        },
        verifier_dispatch: {
          handoff_posture: 'manual-only',
          manual_required_verifications: ['unit-tests', 'integration-tests'],
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('默认 git diff 推断会把 branch docs-only 改动转成空 effective checklist，并按 stage 默认 workflow 写 telemetry', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-git-diff-'));

    try {
      const repoRoot = createRepoFixture(tmpDir, 'repo-a');
      execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['checkout', '-b', 'main'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'spec-first'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'spec-first@example.com'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'baseline'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['checkout', '-b', 'feature/docs-only'], { cwd: repoRoot, stdio: 'ignore' });
      fs.writeFileSync(path.join(repoRoot, 'docs', 'guide.md'), '# guide\n');
      execFileSync('git', ['add', 'docs/guide.md'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'docs only'], { cwd: repoRoot, stdio: 'ignore' });

      const result = runStage0Context(['--stage', 'work'], { cwd: repoRoot });

      expect(result.stage).toBe('work');
      expect(result.mode).toBe('single-repo');
      expect(result.verification_summary).toMatchObject({
        source: 'change-surface',
        impacted_modules: ['docs/'],
        impacted_languages: ['markdown'],
        impacted_platforms: [],
        required_verifications: [],
        optional_verifications: [],
        repo_required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
        repo_optional_verifications: ['browser-evidence'],
      });
      expect(result.verifier_dispatch).toMatchObject({
        handoff_posture: 'not-needed',
        dispatch_candidates: [],
        manual_required_verifications: [],
      });
      expect(result.verification_gate_state).toMatchObject({
        overall_status: 'not-needed',
        required_gates: [],
      });

      const telemetryDir = path.join(repoRoot, '.spec-first', 'workflows', 'spec-work', 'repo-a');
      expect(fs.existsSync(telemetryDir)).toBe(true);
      expect(latestTelemetryRecord(telemetryDir)).toMatchObject({
        workflow: 'spec-work',
        stage: 'work',
        verification_summary: {
          source: 'change-surface',
          required_verifications: [],
          optional_verifications: [],
          repo_required_verifications: ['unit-tests', 'integration-tests', 'browser-smoke'],
          repo_optional_verifications: ['browser-evidence'],
        },
        verifier_dispatch: {
          handoff_posture: 'not-needed',
          dispatch_candidates: [],
          manual_required_verifications: [],
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('legacy bootstrap mixed state 会在 stage0-context 中显式标记为 bootstrap_contract_outdated', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-legacy-bootstrap-'));

    try {
      const repoRoot = createRepoFixture(tmpDir, 'repo-a');
      const slug = 'repo-a';
      const controlPlaneDir = path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug);
      fs.writeFileSync(path.join(controlPlaneDir, 'artifact-manifest.json'), JSON.stringify({
        schema_version: 'v1',
        generated_at: '2026-04-15T00:00:00.000Z',
        updated_at: '2026-04-15T00:00:00.000Z',
        status: 'complete',
        data_quality: 'fact-backed',
        outputs: {
          '00-summary.md': { depends_on: [] },
          'README.md': { depends_on: [] },
        },
      }, null, 2));
      fs.rmSync(path.join(controlPlaneDir, 'context-routing.json'), { force: true });
      fs.rmSync(path.join(controlPlaneDir, 'minimal-context'), { recursive: true, force: true });

      const result = runStage0Context(['--stage', 'work', '--repo-root', repoRoot], { cwd: repoRoot });

      expect(result.selection_subject).toMatchObject({
        kind: 'project',
        subject_slug: 'repo-a',
      });
      expect(result.level).toBe('L2');
      expect(result.fallback_reason).toBe('bootstrap_contract_outdated');
      expect(result.selected_assets).toEqual(expect.arrayContaining([
        '00-summary.md',
        'pitfalls/index.md',
        'code-facts/public-entrypoints.md',
        'code-facts/test-map.md',
      ]));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('存在 verification evidence 时，stage0-context 会输出独立 evidence contract 并把 gate state 标成 satisfied', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-evidence-'));

    try {
      const repoRoot = createRepoFixture(tmpDir, 'repo-a');
      writeVerificationEvidence(repoRoot, 'repo-a', [
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

      const result = runStage0Context([
        '--stage', 'work',
        '--workflow', 'spec-work',
        '--repo-root', repoRoot,
        '--changed-file', 'src/app/home/page.tsx',
        '--cwd', repoRoot,
        '--target', repoRoot,
      ], { cwd: repoRoot });

      expect(result.verification_evidence).toEqual({
        schema_version: 'v1',
        evidence_source: 'workflow-artifacts',
        evidence_items: [
          expect.objectContaining({
            evidence_ref: 'evidence://browser-smoke/1',
            verifier: 'test-browser',
          }),
        ],
      });
      expect(result.verification_gate_state).toMatchObject({
        overall_status: 'pending',
        evidence_locations: ['evidence://browser-smoke/1'],
        required_gates: expect.arrayContaining([
          expect.objectContaining({
            gate_id: 'browser-smoke',
            status: 'satisfied',
            evidence_locations: ['evidence://browser-smoke/1'],
          }),
        ]),
        ci_gate: {
          status: 'pending',
          satisfied_required_gate_count: 1,
        },
      });

      const telemetryDir = path.join(repoRoot, '.spec-first', 'workflows', 'spec-work', 'repo-a');
      expect(latestTelemetryRecord(telemetryDir)).toMatchObject({
        verification_evidence: {
          evidence_items: [
            expect.objectContaining({
              evidence_ref: 'evidence://browser-smoke/1',
            }),
          ],
        },
        verification_gate_state: {
          overall_status: 'pending',
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('存在 ai-dev quality gate result 时，stage0-context 会暴露最近一次 gate facts 但不改变 dispatch 语义', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-ai-dev-gate-'));

    try {
      const repoRoot = createRepoFixture(tmpDir, 'repo-a');
      writeAiDevQualityGateResult(repoRoot, {
        schema_version: 'v1',
        generated_at: '2026-04-18T13:20:00.000Z',
        gate_id: 'ai-dev-quality-gate',
        passed: true,
        checks: [
          {
            check_id: 'stage0-contracts',
            kind: 'unit-suite',
            passed: true,
            summary: {
              test_suites_total: 13,
              tests_total: 76,
            },
            artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/stage0-contracts.junit.json',
          },
        ],
        failures: [],
      });

      const result = runStage0Context([
        '--stage', 'work',
        '--workflow', 'spec-work',
        '--repo-root', repoRoot,
        '--changed-file', 'src/app/home/page.tsx',
        '--cwd', repoRoot,
        '--target', repoRoot,
      ], { cwd: repoRoot });

      expect(result.ai_dev_quality_gate_result).toEqual({
        schema_version: 'v1',
        generated_at: '2026-04-18T13:20:00.000Z',
        gate_id: 'ai-dev-quality-gate',
        passed: true,
        checks: [
          expect.objectContaining({
            check_id: 'stage0-contracts',
            kind: 'unit-suite',
            passed: true,
          }),
        ],
        failures: [],
      });
      expect(result.verifier_dispatch).toMatchObject({
        handoff_posture: 'manual-only',
      });

      const telemetryDir = path.join(repoRoot, '.spec-first', 'workflows', 'spec-work', 'repo-a');
      expect(latestTelemetryRecord(telemetryDir)).toMatchObject({
        ai_dev_quality_gate_result: {
          gate_id: 'ai-dev-quality-gate',
          passed: true,
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('workspace 显式 repo-root 聚合时，telemetry 落到 workspace 目录并记录 matched_child_slugs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-workspace-'));

    try {
      const repoA = createRepoFixture(tmpDir, 'repo-a');
      const repoB = createRepoFixture(tmpDir, 'repo-b');
      const workspaceSlug = path.basename(tmpDir);
      const result = runStage0Context([
        '--stage', 'plan',
        '--cwd', tmpDir,
        '--target', tmpDir,
        '--repo-root', repoA,
        '--repo-root', repoB,
      ], { cwd: tmpDir });

      expect(result.mode).toBe('workspace');
      expect(result.workspace_slug).toBe(workspaceSlug);
      expect(result.matched_child_slugs).toEqual(['repo-a', 'repo-b']);
      expect(result.selection_subject).toMatchObject({
        kind: 'repo',
        owner_slug: workspaceSlug,
      });
      expect(result.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'repo',
          slug: 'repo-a',
          asset_path: 'minimal-context/plan.json',
        }),
      ]));
      expect(result.level).toBe('L0');
      expect(result.fallback_reason).toBe(null);
      expect(result.selected_assets).toContain('repo-a:minimal-context/plan.json');
      expect(result.selected_assets).toContain('repo-b:architecture/module-map.md');
      expect(result.verification_summary).toMatchObject({
        stage: 'plan',
        source: 'minimal-context',
        platform_focus: ['web'],
        required_verifications: ['unit-tests', 'integration-tests'],
      });
      expect(result.verifier_dispatch).toMatchObject({
        stage: 'plan',
        handoff_posture: 'plan-matrix',
        manual_required_verifications: ['unit-tests', 'integration-tests'],
      });
      expect(result.verification_gate_state).toMatchObject({
        stage: 'plan',
        overall_status: 'planned',
        ci_gate: expect.objectContaining({
          status: 'planned',
        }),
      });

      const telemetryDir = path.join(tmpDir, '.spec-first', 'workflows', 'spec-plan', workspaceSlug);
      expect(fs.existsSync(telemetryDir)).toBe(true);
      expect(latestTelemetryRecord(telemetryDir)).toMatchObject({
        workflow: 'spec-plan',
        mode: 'workspace',
        workspace_slug: workspaceSlug,
        matched_child_slugs: ['repo-a', 'repo-b'],
        selected_assets: expect.arrayContaining([
          'repo-a:minimal-context/plan.json',
          'repo-b:minimal-context/plan.json',
        ]),
        verification_summary: {
          stage: 'plan',
          source: 'minimal-context',
          required_verifications: ['unit-tests', 'integration-tests'],
        },
        verifier_dispatch: {
          stage: 'plan',
          handoff_posture: 'plan-matrix',
          manual_required_verifications: ['unit-tests', 'integration-tests'],
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('child git repo cwd 命中 workspace child 时不会退化成 single-repo fallback', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-child-workspace-'));
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');

    try {
      for (const repoRoot of [repoA, repoB]) {
        fs.mkdirSync(repoRoot, { recursive: true });
        execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' });
        execFileSync('git', ['config', 'user.name', 'spec-first'], { cwd: repoRoot, stdio: 'ignore' });
        execFileSync('git', ['config', 'user.email', 'spec-first@example.com'], { cwd: repoRoot, stdio: 'ignore' });
      }

      fs.writeFileSync(path.join(repoA, 'package.json'), JSON.stringify({
        name: 'repo-a',
        bin: {
          'repo-a': './bin/repo-a.js',
        },
        scripts: {
          'test:unit': 'jest',
          'test:integration': 'jest',
        },
        dependencies: {
          jest: '^29.0.0',
        },
      }, null, 2));
      fs.mkdirSync(path.join(repoA, 'bin'), { recursive: true });
      fs.writeFileSync(path.join(repoA, 'bin', 'repo-a.js'), '#!/usr/bin/env node\n');
      fs.mkdirSync(path.join(repoA, 'src', 'app', 'home'), { recursive: true });
      fs.writeFileSync(path.join(repoA, 'src', 'app', 'home', 'page.tsx'), 'export default function Page() { return null; }\n');
      fs.writeFileSync(path.join(repoB, 'package.json'), JSON.stringify({ name: 'repo-b' }, null, 2));

      for (const repoRoot of [repoA, repoB]) {
        execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
        execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'baseline'], {
          cwd: repoRoot,
          stdio: 'ignore',
        });
      }

      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      const childSlug = buildChildSlug(workspaceRoot, repoA);
      const result = runStage0Context(['--stage', 'work'], { cwd: repoA });

      expect(result.mode).toBe('workspace');
      expect(result.workspace_slug).toBe(path.basename(workspaceRoot));
      expect(result.matched_child_slugs).toEqual([childSlug]);
      expect(result.selection_subject).toMatchObject({
        kind: 'repo',
        owner_slug: path.basename(workspaceRoot),
        subject_slug: childSlug,
      });
      expect(result.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'workspace',
          slug: path.basename(workspaceRoot),
          asset_path: 'workspace/routing-overview.md',
        }),
        expect.objectContaining({
          scope: 'repo',
          slug: childSlug,
          asset_path: 'minimal-context/work.json',
        }),
      ]));
      // workspace routing 正常命中 child，level 最高为 L1（无 CRG 的程序化 bootstrap data_quality=partial）
      expect(['L0', 'L1']).toContain(result.level);
      // data_quality_partial = single-repo 质量降级；workspace_child_partial_degraded = workspace 聚合降级；null = L0
      expect(['data_quality_partial', 'workspace_child_partial_degraded', null]).toContain(result.fallback_reason);
      expect(result.selected_assets).toEqual(expect.arrayContaining([
        `${path.basename(workspaceRoot)}:workspace/routing-overview.md`,
        `${childSlug}:minimal-context/work.json`,
      ]));
      expect(result.verification_summary).toMatchObject({
        source: 'minimal-context',
        platform_focus: expect.arrayContaining(['web']),
        required_verifications: ['unit-tests', 'integration-tests'],
        repo_required_verifications: ['unit-tests', 'integration-tests'],
      });
      expect(result.verifier_dispatch).toMatchObject({
        handoff_posture: 'manual-only',
        manual_required_verifications: ['unit-tests', 'integration-tests'],
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
