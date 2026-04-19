'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  evaluateContext,
  evaluateContextForRepo,
  toOutputExistsKey,
} = require('../../src/context-routing/evaluator');
const {
  buildArtifactManifestSample,
  buildContextRoutingSample,
} = require('../../src/bootstrap-compiler/sample-generator');

function makeRuntimeFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'context-routing-'));
  const slug = path.basename(repoRoot);
  const contextDir = path.join(repoRoot, 'docs', 'contexts', slug);
  const controlPlaneDir = path.join(repoRoot, '.spec-first', 'workflows', 'bootstrap', slug);

  fs.mkdirSync(path.join(contextDir, 'architecture'), { recursive: true });
  fs.mkdirSync(path.join(contextDir, 'code-facts'), { recursive: true });
  fs.mkdirSync(path.join(contextDir, 'pitfalls'), { recursive: true });
  fs.mkdirSync(path.join(contextDir, 'context-packs'), { recursive: true });
  fs.mkdirSync(path.join(controlPlaneDir, 'minimal-context'), { recursive: true });

  const docs = {
    '00-summary.md': '# summary\n',
    'README.md': '# readme\n',
    'architecture/module-map.md': '# module-map\n',
    'code-facts/public-entrypoints.md': '# entrypoints\n',
    'code-facts/test-map.md': '# test-map\n',
    'code-facts/high-risk-modules.md': '# high-risk\n',
    'pitfalls/index.md': '# pitfalls\n',
    'context-packs/review-change.md': '# review-change\n',
  };

  for (const [relativePath, content] of Object.entries(docs)) {
    const absolutePath = path.join(contextDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  return { repoRoot, slug, contextDir, controlPlaneDir };
}

describe('context-routing evaluator', () => {
  test('toOutputExistsKey normalizes output paths for output_exists rules', () => {
    expect(toOutputExistsKey('code-facts/public-entrypoints.md')).toBe('code_facts_public_entrypoints');
  });

  test('manifest missing -> L3 + manifest_incomplete', () => {
    const fixture = makeRuntimeFixture();

    try {
      const result = evaluateContext({
        stage: 'review',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: null,
        manifest: null,
      });

      expect(result.level).toBe('L3');
      expect(result.fallback_reason).toBe('manifest_incomplete');
      expect(result.selected_assets).toEqual(['00-summary.md', 'README.md']);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('routing missing -> L2 + routing_missing', () => {
    const fixture = makeRuntimeFixture();

    try {
      const result = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: null,
        manifest: buildArtifactManifestSample(),
      });

      expect(result.level).toBe('L2');
      expect(result.fallback_reason).toBe('routing_missing');
      expect(result.selected_assets).toContain('code-facts/test-map.md');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('损坏的 bootstrap JSON 按缺失处理并走 fallback，而不是整体抛错', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'artifact-manifest.json'),
        JSON.stringify(buildArtifactManifestSample(), null, 2)
      );
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'context-routing.json'),
        '{ invalid-json'
      );

      const result = evaluateContextForRepo({
        repoRoot: fixture.repoRoot,
        slug: fixture.slug,
        stage: 'review',
      });

      expect(result.level).toBe('L2');
      expect(result.fallback_reason).toBe('routing_missing');
      expect(result.selected_assets).toContain('code-facts/test-map.md');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('minimal-context missing -> L1 + minimal_context_missing', () => {
    const fixture = makeRuntimeFixture();

    try {
      const result = evaluateContext({
        stage: 'review',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: buildArtifactManifestSample(),
      });

      expect(result.level).toBe('L1');
      expect(result.fallback_reason).toBe('minimal_context_missing');
      expect(result.selected_assets).toContain('code-facts/high-risk-modules.md');
      expect(result.selected_assets).not.toContain('minimal-context/review.json');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('review/work/plan return different selected assets', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'review.json'),
        JSON.stringify({
          schema_version: 'v1',
          generated_at: '2026-04-15T00:00:00.000Z',
          stage: 'review',
          profile: 'review-default',
          selected_assets: ['code-facts/high-risk-modules.md'],
          fallback_reason: null,
          advice: 'review',
        }, null, 2)
      );
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'work.json'),
        JSON.stringify({
          schema_version: 'v1',
          generated_at: '2026-04-15T00:00:00.000Z',
          stage: 'work',
          profile: 'work-default',
          selected_assets: ['code-facts/test-map.md'],
          fallback_reason: null,
          advice: 'work',
        }, null, 2)
      );
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'plan.json'),
        JSON.stringify({
          schema_version: 'v1',
          generated_at: '2026-04-15T00:00:00.000Z',
          stage: 'plan',
          profile: 'plan-default',
          selected_assets: ['architecture/module-map.md'],
          fallback_reason: null,
          advice: 'plan',
        }, null, 2)
      );

      const routing = buildContextRoutingSample();
      const manifest = buildArtifactManifestSample();
      const review = evaluateContext({
        stage: 'review',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      });
      const work = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      });
      const plan = evaluateContext({
        stage: 'plan',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      });

      expect(review.selected_assets).toContain('minimal-context/review.json');
      expect(work.selected_assets[0]).toBe('minimal-context/work.json');
      expect(plan.selected_assets[0]).toBe('minimal-context/plan.json');
      expect(work.selected_assets).toContain('code-facts/test-map.md');
      expect(plan.selected_assets).toContain('architecture/module-map.md');
      expect(review.selected_assets).not.toEqual(work.selected_assets);
      expect(work.selected_assets).not.toEqual(plan.selected_assets);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('characterization: plan/work/review selected_assets 顺序保持稳定', () => {
    const fixture = makeRuntimeFixture();

    try {
      for (const stage of ['plan', 'work', 'review']) {
        fs.writeFileSync(
          path.join(fixture.controlPlaneDir, 'minimal-context', `${stage}.json`),
          JSON.stringify({
            schema_version: 'v1',
            generated_at: '2026-04-15T00:00:00.000Z',
            stage,
            profile: `${stage}-default`,
            selected_assets: [],
            fallback_reason: null,
            advice: stage,
          }, null, 2)
        );
      }

      const routing = buildContextRoutingSample();
      const manifest = buildArtifactManifestSample();

      expect(evaluateContext({
        stage: 'plan',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      }).selected_assets).toEqual([
        'minimal-context/plan.json',
        'code-facts/high-risk-modules.md',
        'code-facts/public-entrypoints.md',
        'architecture/module-map.md',
        '00-summary.md',
        'README.md',
        'context-packs/review-change.md',
      ]);

      expect(evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      }).selected_assets).toEqual([
        'minimal-context/work.json',
        'code-facts/high-risk-modules.md',
        'code-facts/public-entrypoints.md',
        'code-facts/test-map.md',
        '00-summary.md',
        'README.md',
        'context-packs/review-change.md',
      ]);

      expect(evaluateContext({
        stage: 'review',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      }).selected_assets).toEqual([
        'minimal-context/review.json',
        'code-facts/high-risk-modules.md',
        'code-facts/public-entrypoints.md',
        'code-facts/test-map.md',
        '00-summary.md',
        'README.md',
        'context-packs/review-change.md',
        'pitfalls/index.md',
      ]);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('freshness stale sets fallback reason without aborting selection', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'plan.json'),
        JSON.stringify({
          schema_version: 'v1',
          generated_at: '2026-04-15T00:00:00.000Z',
          stage: 'plan',
          profile: 'plan-default',
          selected_assets: ['architecture/module-map.md'],
          fallback_reason: null,
          advice: 'plan',
        }, null, 2)
      );

      const result = evaluateContext({
        stage: 'plan',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: buildArtifactManifestSample(),
        freshness: { status: 'stale' },
      });

      expect(result.fallback_reason).toBe('freshness_stale');
      expect(result.selected_assets).toContain('architecture/module-map.md');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('budget trimming keeps higher-priority machine assets before narrative docs', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'review.json'),
        JSON.stringify({
          schema_version: 'v1',
          generated_at: '2026-04-15T00:00:00.000Z',
          stage: 'review',
          profile: 'review-default',
          selected_assets: ['code-facts/high-risk-modules.md'],
          fallback_reason: null,
          advice: 'review',
        }, null, 2)
      );

      const result = evaluateContext({
        stage: 'review',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: buildArtifactManifestSample(),
        maxTokens: 700,
      });

      expect(result.selected_assets).toEqual([
        'minimal-context/review.json',
        'code-facts/high-risk-modules.md',
      ]);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('plan/work minimal-context 缺失时回退到 machine facts 和核心 docs', () => {
    const fixture = makeRuntimeFixture();

    try {
      const routing = buildContextRoutingSample();
      const manifest = buildArtifactManifestSample();

      const plan = evaluateContext({
        stage: 'plan',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      });
      const work = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing,
        manifest,
      });

      expect(plan.fallback_reason).toBe('minimal_context_missing');
      expect(plan.selected_assets).toContain('architecture/module-map.md');
      expect(plan.selected_assets).toContain('00-summary.md');
      expect(work.fallback_reason).toBe('minimal_context_missing');
      expect(work.selected_assets).toContain('code-facts/test-map.md');
      expect(work.selected_assets).toContain('context-packs/review-change.md');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('data_quality empty -> L2 + empty_fact_inventory（即便 minimal-context 存在）', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'work.json'),
        JSON.stringify({ schema_version: 'v1', stage: 'work', fallback_reason: null }, null, 2)
      );

      const emptyManifest = { ...buildArtifactManifestSample(), data_quality: 'empty' };
      const result = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: emptyManifest,
      });

      expect(result.level).toBe('L2');
      expect(result.fallback_reason).toBe('empty_fact_inventory');
      expect(result.data_quality).toBe('empty');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('data_quality fact-backed -> L0 并暴露质量信号（minimal-context 存在时）', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'work.json'),
        JSON.stringify({ schema_version: 'v1', stage: 'work', fallback_reason: null }, null, 2)
      );

      const result = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: buildArtifactManifestSample(), // data_quality: 'fact-backed'
      });

      expect(result.level).toBe('L0');
      expect(result.fallback_reason).toBeNull();
      expect(result.data_quality).toBe('fact-backed');
      expect(result.confidence).toBe('unknown');
      expect(result.provenance).toBe('unknown');
      expect(result.coverage_gaps).toEqual([]);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('data_quality partial -> L1 + data_quality_partial，不再通过 L0 门控', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'work.json'),
        JSON.stringify({ schema_version: 'v1', stage: 'work', fallback_reason: null }, null, 2)
      );

      const partialManifest = { ...buildArtifactManifestSample(), data_quality: 'partial' };
      const result = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: partialManifest,
      });

      expect(result.level).toBe('L1');
      expect(result.fallback_reason).toBe('data_quality_partial');
      expect(result.data_quality).toBe('partial');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('sample-backed manifest -> L2 + data_quality_sample_backed，不伪装成高可信事实', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'work.json'),
        JSON.stringify({ schema_version: 'v1', stage: 'work', fallback_reason: null }, null, 2)
      );

      const sampleManifest = { ...buildArtifactManifestSample(), data_quality: 'sample-backed' };

      const result = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: sampleManifest,
      });

      expect(result.level).toBe('L2');
      expect(result.fallback_reason).toBe('data_quality_sample_backed');
      expect(result.data_quality).toBe('sample-backed');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('旧 manifest（缺少 data_quality 字段）向后兼容为 L1，并显式标出 legacy fallback', () => {
    const fixture = makeRuntimeFixture();

    try {
      fs.writeFileSync(
        path.join(fixture.controlPlaneDir, 'minimal-context', 'work.json'),
        JSON.stringify({ schema_version: 'v1', stage: 'work', fallback_reason: null }, null, 2)
      );

      const legacyManifest = { ...buildArtifactManifestSample() };
      delete legacyManifest.data_quality;

      const result = evaluateContext({
        stage: 'work',
        contextDir: fixture.contextDir,
        controlPlaneDir: fixture.controlPlaneDir,
        routing: buildContextRoutingSample(),
        manifest: legacyManifest,
      });

      expect(result.level).toBe('L1');
      expect(result.fallback_reason).toBe('legacy_manifest_missing_quality_fields');
      expect(result.data_quality).toBe('unknown');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });
});
