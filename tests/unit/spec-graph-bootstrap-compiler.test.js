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
const { evaluateContextForRepo } = require('../../src/context-routing/evaluator');

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
