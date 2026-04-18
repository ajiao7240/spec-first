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
} = require('../../src/bootstrap-compiler/sample-generator');
const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');
const { buildChildSlug } = require('../../src/bootstrap-compiler/workspace-registry');
const { evaluateContextForRepo } = require('../../src/context-routing/evaluator');
const { buildWorkspaceControlPlanePaths } = require('../../src/context-routing/entry-resolver');

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
    expect(result.machine_artifacts.minimal_context.review.stage).toBe('review');
    expect(result.human_assets.docs_assets).toContain('architecture/module-map.md');
    expect(result.routing.artifact_manifest.outputs['minimal-context/review.json']).toBeDefined();
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
    const result = compileMachineArtifacts({
      manifest,
      actualAssets: Object.keys(manifest.outputs),
    });

    expect(result.minimal_context.review.stage).toBe('review');
    expect(result.freshness.schema_version).toBe('v1');
    expect(result.lint_report.status).toBe('ok');
  });

  test('compiler 能独立组织 docs assets', () => {
    const result = compileHumanAssets({
      contextAssets: [
        'architecture/module-map.md',
        'code-facts/test-map.md',
        'README.md',
        'injection-index.yaml',
      ],
    });

    expect(result.generated_assets).toContain('README.md');
    expect(result.docs_assets).toContain('architecture/module-map.md');
  });

  test('routing compiler 输出 contract 与 sample generator 一致', () => {
    const result = compileRouting();

    expect(result.context_routing.schema_version).toBe('v1');
    expect(result.artifact_manifest.outputs['minimal-context/work.json']).toBeDefined();
    expect(result.injection_index.stages.work).toContain('code-facts/high-risk-modules.md');
  });

  test('runBootstrap 写出可被 evaluator 消费的主链产物', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-mainline-'));

    try {
      const result = runBootstrap({
        repoRoot,
        generatedAt: '2026-04-15T00:00:00.000Z',
      });

      expect(result.controlPlaneDir).toContain(path.join('.spec-first', 'workflows', 'bootstrap'));
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'context-routing.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.controlPlaneDir, 'minimal-context', 'review.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.contextDir, 'architecture', 'module-map.md'))).toBe(true);

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
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', registry.workspaceSlug, '2026-04-15T00-00-00-000Z.json'))).toBe(true);

      const workspaceTelemetry = JSON.parse(fs.readFileSync(
        path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', registry.workspaceSlug, '2026-04-15T00-00-00-000Z.json'),
        'utf8'
      ));
      expect(workspaceTelemetry.matched_child_slugs).toEqual([childSlug]);
      expect(workspaceTelemetry.fallback_reason).toBe(null);
      expect(workspaceTelemetry.selected_assets).toContain(`${childSlug}:architecture/module-map.md`);

      const childTelemetry = JSON.parse(fs.readFileSync(
        path.join(workspaceRoot, '.spec-first', 'workflows', 'bootstrap', childSlug, '2026-04-15T00-00-00-000Z.json'),
        'utf8'
      ));
      expect(childTelemetry.selected_assets).toContain('architecture/module-map.md');
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
