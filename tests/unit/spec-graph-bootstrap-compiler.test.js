'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  compileBootstrapArtifacts,
} = require('../../src/bootstrap-compiler/orchestrator');
const {
  compileMachineArtifacts,
} = require('../../src/bootstrap-compiler/compile-machine-artifacts');
const {
  compileHumanAssets,
} = require('../../src/bootstrap-compiler/compile-human-assets');
const {
  compileRouting,
} = require('../../src/bootstrap-compiler/compile-routing');
const {
  buildArtifactManifestSample,
  buildVerificationProfileSample,
} = require('../../src/bootstrap-compiler/sample-generator');
const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');
const { buildChildSlug } = require('../../src/bootstrap-compiler/workspace-registry');
const { evaluateContextForRepo } = require('../../src/context-routing/evaluator');
const { buildWorkspaceControlPlanePaths } = require('../../src/context-routing/entry-resolver');
const {
  FACT_INVENTORY_SAMPLE,
  RISK_SIGNALS_SAMPLE,
  TEST_SURFACE_SAMPLE,
} = require('../fixtures/bootstrap/spec-first-bootstrap-sample');

function readTree(rootDir) {
  const files = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      files.push(path.relative(rootDir, absolutePath));
    }
  }

  walk(rootDir);
  files.sort();

  return files.reduce((memo, relativePath) => {
    memo[relativePath] = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    return memo;
  }, {});
}

describe('spec-graph-bootstrap compiler modules', () => {
  test('orchestrator 按固定顺序编排 machine -> human -> routing，并输出结构化结果', () => {
    const result = compileBootstrapArtifacts({
      generatedAt: '2026-04-15T00:00:00.000Z',
      contextAssets: [
        'architecture/module-map.md',
        'code-facts/test-map.md',
        'README.md',
        'injection-index.yaml',
      ],
    });

    expect(result.status).toBe('complete');
    expect(result.stages.map((stage) => stage.name)).toEqual([
      'machine-artifacts',
      'human-assets',
      'routing',
    ]);
    expect(result.stages.every((stage) => stage.status === 'success')).toBe(true);
    expect(result.machine_artifacts.verification_profile.schema_version).toBe('v1');
    expect(result.machine_artifacts.minimal_context.review.stage).toBe('review');
    expect(result.human_assets.docs_assets).toContain('architecture/module-map.md');
    expect(result.routing.artifact_manifest.outputs['minimal-context/review.json']).toBeDefined();
    expect(result.routing.artifact_manifest.outputs['verification-profile.json']).toBeDefined();
  });

  test('orchestrator 遇到子阶段失败时返回结构化错误且不误报成功', () => {
    const result = compileBootstrapArtifacts({
      compilers: {
        routing() {
          throw new Error('routing failed');
        },
      },
    });

    expect(result.status).toBe('failed');
    expect(result.error).toEqual({
      stage: 'routing',
      message: 'routing failed',
    });
    expect(result.stages).toEqual([
      { name: 'machine-artifacts', status: 'success' },
      { name: 'human-assets', status: 'success' },
      { name: 'routing', status: 'failed' },
    ]);
    expect(result.routing).toBeUndefined();
  });

  test('compiler 能独立生成 machine artifacts', () => {
    const manifest = buildArtifactManifestSample();
    const expectedVerificationProfile = buildVerificationProfileSample();
    const result = compileMachineArtifacts({
      repoRoot: path.join(__dirname, '..', '..'),
      factInventory: FACT_INVENTORY_SAMPLE,
      riskSignals: RISK_SIGNALS_SAMPLE,
      testSurface: TEST_SURFACE_SAMPLE,
      manifest,
      actualAssets: Object.keys(manifest.outputs),
    });

    expect(result.fact_inventory).toEqual(FACT_INVENTORY_SAMPLE);
    expect(result.risk_signals).toEqual(RISK_SIGNALS_SAMPLE);
    expect(result.test_surface).toEqual(TEST_SURFACE_SAMPLE);
    expect(result.verification_profile).toEqual(expectedVerificationProfile);
    expect(result.minimal_context.plan.platform_focus).toEqual(['cli']);
    expect(result.minimal_context.plan.required_verifications).toContain('unit-tests');
    expect(result.minimal_context.work.optional_verifications).toContain('release-tests');
    expect(result.minimal_context.review.verification_gaps_to_check).toContain('confirm smoke-tests');
    expect(result.minimal_context.review.stage).toBe('review');
    expect(result.freshness.schema_version).toBe('v1');
    expect(result.lint_report.status).toBe('ok');
  });

  test('compiler 在未显式提供 inputs 时会从 repo 文件系统推导 machine artifacts', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-derived-inputs-'));

    try {
      fs.mkdirSync(path.join(repoRoot, 'src', 'cli'), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, 'tests', 'unit'), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, 'docs', 'contracts'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({
        name: 'derived-bootstrap-app',
        bin: {
          'derived-app': './bin/derived-app.js',
        },
        scripts: {
          test: 'jest',
        },
        dependencies: {
          'better-sqlite3': '^1.0.0',
          'simple-git': '^1.0.0',
          'tree-sitter': '^1.0.0',
        },
        devDependencies: {
          jest: '^29.0.0',
        },
      }, null, 2));
      fs.mkdirSync(path.join(repoRoot, 'bin'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'bin', 'derived-app.js'), '#!/usr/bin/env node\n');
      fs.writeFileSync(path.join(repoRoot, 'src', 'cli', 'index.js'), 'module.exports = {};\n');
      fs.writeFileSync(path.join(repoRoot, 'src', 'feature.js'), `${Array.from({ length: 240 }, (_, index) => `const line${index} = ${index};`).join('\n')}\n`);
      fs.writeFileSync(path.join(repoRoot, 'tests', 'unit', 'feature.test.js'), 'test("feature", () => expect(true).toBe(true));\n');
      fs.writeFileSync(path.join(repoRoot, 'docs', 'contracts', 'feature.schema.json'), '{}\n');

      const result = compileMachineArtifacts({
        generatedAt: '2026-04-15T00:00:00.000Z',
        repoRoot,
        actualAssets: [
          'fact-inventory.json',
          'risk-signals.json',
          'test-surface.json',
          'context-routing.json',
          'artifact-manifest.json',
          'minimal-context/review.json',
          'verification-profile.json',
        ],
      });

      expect(result.fact_inventory.project_identity.name).toBe('derived-bootstrap-app');
      expect(result.fact_inventory.project_identity.primary_frameworks).toEqual(
        expect.arrayContaining(['Node.js CLI', 'Jest', 'tree-sitter', 'better-sqlite3'])
      );
      expect(result.fact_inventory.entrypoints).toEqual(
        expect.arrayContaining([
          { path: 'bin/derived-app.js' },
          { path: 'src/cli/index.js' },
        ])
      );
      expect(result.risk_signals.signals[0]).toEqual(expect.objectContaining({
        path: 'src/feature.js',
        severity: 'high',
      }));
      expect(result.test_surface.test_files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'tests/unit/feature.test.js',
            kind: 'unit',
            target_path: 'src/feature.js',
          }),
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('compiler 能独立组织 docs assets', () => {
    const result = compileHumanAssets({
      factInventory: FACT_INVENTORY_SAMPLE,
      riskSignals: RISK_SIGNALS_SAMPLE,
      testSurface: TEST_SURFACE_SAMPLE,
      verificationProfile: buildVerificationProfileSample(),
    });

    expect(result.generated_assets).toContain('README.md');
    expect(result.docs_assets).toContain('architecture/module-map.md');
    expect(result.context_docs['00-summary.md']).toContain('主语言：JavaScript');
    expect(result.context_docs['architecture/module-map.md']).toContain('src/crg/');
  });

  test('routing compiler 输出真实 control-plane contract', () => {
    const result = compileRouting({
      generatedAt: '2026-04-15T00:00:00.000Z',
      repoRoot: path.join(__dirname, '..', '..'),
      factInventory: FACT_INVENTORY_SAMPLE,
      riskSignals: RISK_SIGNALS_SAMPLE,
      testSurface: TEST_SURFACE_SAMPLE,
    });

    expect(result.context_routing.schema_version).toBe('v1');
    expect(result.artifact_manifest.outputs['fact-inventory.json']).toBeDefined();
    expect(result.artifact_manifest.outputs['risk-signals.json']).toBeDefined();
    expect(result.artifact_manifest.outputs['test-surface.json']).toBeDefined();
    expect(result.artifact_manifest.outputs['minimal-context/work.json']).toBeDefined();
    expect(result.artifact_manifest.outputs['verification-profile.json']).toBeDefined();
    expect(result.injection_index.stages.work).toContain('code-facts/high-risk-modules.md');
  });

  test('runBootstrap 写出可被 evaluator 消费的主链产物', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-mainline-'));

    try {
      const result = runBootstrap({
        repoRoot,
        generatedAt: '2026-04-15T00:00:00.000Z',
        factInventory: FACT_INVENTORY_SAMPLE,
        riskSignals: RISK_SIGNALS_SAMPLE,
        testSurface: TEST_SURFACE_SAMPLE,
      });

      expect(result.controlPlaneDir).toContain(path.join('.spec-first', 'workflows', 'bootstrap'));
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'fact-inventory.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'risk-signals.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'test-surface.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'context-routing.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'minimal-context', 'review.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'verification-profile.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.contextDir, 'architecture', 'module-map.md'))).toBe(true);
      expect(fs.readFileSync(path.join(result.contextDir, 'README.md'), 'utf8')).toContain('source_of_truth');

      const evaluation = evaluateContextForRepo({
        repoRoot,
        slug: result.slug,
        stage: 'review',
      });
      expect(evaluation.level).toBe('L0');
      expect(evaluation.fallback_reason).toBe(null);
      expect(evaluation.selected_assets[0]).toBe('minimal-context/review.json');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('runBootstrap 在写入中途失败时回滚 docs context', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-rollback-'));
    const slug = path.basename(repoRoot);
    const contextDir = path.join(repoRoot, 'docs', 'contexts', slug);

    try {
      fs.mkdirSync(contextDir, { recursive: true });
      fs.writeFileSync(path.join(contextDir, 'README.md'), '# old readme\n');

      expect(() => {
        runBootstrap({
          repoRoot,
          generatedAt: '2026-04-15T00:00:00.000Z',
          hooks: {
            afterContextWrite() {
              throw new Error('simulated write failure');
            },
          },
        });
      }).toThrow('simulated write failure');

      expect(fs.readFileSync(path.join(contextDir, 'README.md'), 'utf8')).toBe('# old readme\n');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('workspace bootstrap 生成 workspace 与 child control-plane，并记录 telemetry', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-bootstrap-'));
    const childRepoRoot = path.join(workspaceRoot, 'packages', 'repo-a');
    fs.mkdirSync(path.join(childRepoRoot, '.git'), { recursive: true });

    try {
      const result = runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-15T00:00:00.000Z',
        repoRoots: [childRepoRoot],
      });

      const workspacePaths = buildWorkspaceControlPlanePaths(workspaceRoot);
      expect(result.mode).toBe('workspace');
      expect(fs.existsSync(workspacePaths.registryPath)).toBe(true);
      expect(fs.existsSync(workspacePaths.routingPath)).toBe(true);
      expect(fs.existsSync(path.join(workspacePaths.contextDir, 'workspace', 'routing-overview.md'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', 'workspace-bootstrap-', '2026-04-15T00-00-00-000Z.json'))).toBe(false);

      const registry = JSON.parse(fs.readFileSync(workspacePaths.registryPath, 'utf8'));
      const childSlug = registry.children[0].childSlug;
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', childSlug, 'context-routing.json'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, 'docs', 'contexts', childSlug, 'README.md'))).toBe(true);
      const wsTelemetryDir = path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', registry.workspaceSlug);
      const wsTelemetryFile = fs.readdirSync(wsTelemetryDir).find((f) => f.startsWith('2026-04-15T00-00-00-000Z'));
      expect(wsTelemetryFile).toBeDefined();

      const workspaceTelemetry = JSON.parse(fs.readFileSync(path.join(wsTelemetryDir, wsTelemetryFile), 'utf8'));
      expect(workspaceTelemetry.matched_child_slugs).toEqual([childSlug]);
      // 空仓库 bootstrap 产出 data_quality=empty，child 评估为 L1，workspace 正确报告 partial degraded
      expect(workspaceTelemetry.fallback_reason).toBe('workspace_child_partial_degraded');
      expect(workspaceTelemetry.freshness_status).toBe('healthy');
      expect(workspaceTelemetry.selected_assets).toContain(`${childSlug}:architecture/module-map.md`);

      const childTelemetryDir = path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', childSlug);
      const childTelemetryFile = fs.readdirSync(childTelemetryDir).find((f) => f.startsWith('2026-04-15T00-00-00-000Z'));
      expect(childTelemetryFile).toBeDefined();
      const childTelemetry = JSON.parse(fs.readFileSync(path.join(childTelemetryDir, childTelemetryFile), 'utf8'));
      expect(childTelemetry.selected_assets).toContain('architecture/module-map.md');
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('workspace bootstrap rerun 会 prune 已移除 child 的 control-plane 与 context', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-bootstrap-prune-'));
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');
    fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });

    try {
      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-15T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      const childSlugA = buildChildSlug(workspaceRoot, repoA);
      const childSlugB = buildChildSlug(workspaceRoot, repoB);

      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', childSlugB))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, 'docs', 'contexts', childSlugB))).toBe(true);

      const rerun = runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-15T00:00:01.000Z',
        repoRoots: [repoA],
      });

      expect(rerun.prunedChildSlugs).toEqual([childSlugB]);
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', childSlugA))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, 'docs', 'contexts', childSlugA))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', childSlugB))).toBe(false);
      expect(fs.existsSync(path.join(workspaceRoot, 'docs', 'contexts', childSlugB))).toBe(false);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('workspace bootstrap 失败时回滚 workspace 与 child 发布内容', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-bootstrap-rollback-'));
    const childRepoRoot = path.join(workspaceRoot, 'packages', 'repo-a');
    fs.mkdirSync(path.join(childRepoRoot, '.git'), { recursive: true });

    try {
      const initial = runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-15T00:00:00.000Z',
        repoRoots: [childRepoRoot],
      });
      const baseline = {
        control: readTree(initial.controlPlaneDir),
        context: readTree(initial.contextDir),
        childControl: readTree(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', initial.registry.children[0].childSlug)),
        childContext: readTree(path.join(workspaceRoot, 'docs', 'contexts', initial.registry.children[0].childSlug)),
      };

      expect(() => {
        runBootstrap({
          repoRoot: workspaceRoot,
          generatedAt: '2026-04-15T00:00:01.000Z',
          repoRoots: [childRepoRoot],
          hooks: {
            beforeWorkspacePublish() {
              throw new Error('workspace publish failure');
            },
          },
        });
      }).toThrow('workspace publish failure');

      expect(readTree(initial.controlPlaneDir)).toEqual(baseline.control);
      expect(readTree(initial.contextDir)).toEqual(baseline.context);
      expect(readTree(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', initial.registry.children[0].childSlug))).toEqual(baseline.childControl);
      expect(readTree(path.join(workspaceRoot, 'docs', 'contexts', initial.registry.children[0].childSlug))).toEqual(baseline.childContext);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('workspace bootstrap 首次发布失败时不留下空目录', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-bootstrap-first-failure-'));
    const childRepoRoot = path.join(workspaceRoot, 'packages', 'repo-a');
    const workspaceSlug = path.basename(workspaceRoot);
    const childSlug = buildChildSlug(workspaceRoot, childRepoRoot);
    fs.mkdirSync(path.join(childRepoRoot, '.git'), { recursive: true });

    const workspaceControlDir = path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', workspaceSlug);
    const workspaceContextDir = path.join(workspaceRoot, 'docs', 'contexts', workspaceSlug);
    const childControlDir = path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', childSlug);
    const childContextDir = path.join(workspaceRoot, 'docs', 'contexts', childSlug);

    try {
      expect(() => {
        runBootstrap({
          repoRoot: workspaceRoot,
          generatedAt: '2026-04-15T00:00:00.000Z',
          repoRoots: [childRepoRoot],
          hooks: {
            beforeWorkspacePublish() {
              throw new Error('workspace initial publish failure');
            },
          },
        });
      }).toThrow('workspace initial publish failure');

      expect(fs.existsSync(workspaceControlDir)).toBe(false);
      expect(fs.existsSync(workspaceContextDir)).toBe(false);
      expect(fs.existsSync(childControlDir)).toBe(false);
      expect(fs.existsSync(childContextDir)).toBe(false);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('restoreBootstrapBackup: contextDir 不存在时 restore 仍成功（ENOENT 容忍）', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-enoent-'));
    const { restoreBootstrapBackup } = require('../../src/bootstrap-compiler/rollback');
    const backupDir = path.join(repoRoot, 'backup');
    const contextDir = path.join(repoRoot, 'context');
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, 'README.md'), '# backup\n');

    try {
      const result = restoreBootstrapBackup({ backupDir, contextDir });
      expect(result).toBe(true);
      expect(fs.existsSync(path.join(contextDir, 'README.md'))).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('restoreBatchBackup: sourceDir 不存在时 entry 正常跳过（ENOENT 容忍）', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-batch-enoent-'));
    const { restoreBatchBackup } = require('../../src/bootstrap-compiler/rollback');
    const backupDir = path.join(repoRoot, 'bk');
    const sourceDir = path.join(repoRoot, 'nonexistent-source');
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, 'file.txt'), 'content\n');

    try {
      const result = restoreBatchBackup({
        manifest: [{ key: 'k', sourceDir, backupDir, sourceExisted: true }],
      });
      expect(result).toBe(true);
      expect(fs.existsSync(path.join(sourceDir, 'file.txt'))).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('runBootstrap 对相同输入保持确定性输出', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-determinism-'));

    try {
      const first = runBootstrap({
        repoRoot,
        generatedAt: '2026-04-15T00:00:00.000Z',
      });
      const firstSnapshot = {
        control: readTree(first.controlPlaneDir),
        context: readTree(first.contextDir),
      };

      const second = runBootstrap({
        repoRoot,
        generatedAt: '2026-04-15T00:00:00.000Z',
      });
      const secondSnapshot = {
        control: readTree(second.controlPlaneDir),
        context: readTree(second.contextDir),
      };

      expect(secondSnapshot).toEqual(firstSnapshot);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
