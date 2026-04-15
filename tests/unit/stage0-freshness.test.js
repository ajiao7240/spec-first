'use strict';

const { buildFreshnessReport } = require('../../src/bootstrap-compiler/freshness');
const { buildLintReport } = require('../../src/bootstrap-compiler/lint');
const { buildContradictionsReport } = require('../../src/bootstrap-compiler/contradictions');
const {
  loadBootstrapSchemas,
  validateAgainstSchema,
} = require('../../src/bootstrap-compiler/schema-loader');
const {
  buildArtifactManifestSample,
  buildContextRoutingSample,
} = require('../../src/bootstrap-compiler/sample-generator');

describe('stage0 freshness and governance basics', () => {
  test('healthy freshness report 使用 schema 允许的状态值', () => {
    const schemas = loadBootstrapSchemas();
    const report = buildFreshnessReport({
      generatedAt: '2026-04-15T00:00:00.000Z',
      graphLastBuilt: '2026-04-15T00:00:00.000Z',
      outputUpdatedAt: '2026-04-15T00:00:00.000Z',
    });

    expect(report.status).toBe('healthy');
    expect(validateAgainstSchema(schemas.freshness, report).errors).toEqual([]);
  });

  test('stale graph / stale output 能被识别', () => {
    const report = buildFreshnessReport({
      generatedAt: '2026-04-15T00:00:00.000Z',
      graphLastBuilt: '2026-04-10T00:00:00.000Z',
      outputUpdatedAt: '2026-04-14T00:00:00.000Z',
    });

    expect(report.status).toBe('stale');
    expect(report.stale_reasons).toContain('graph_stale');
  });

  test('sample drift 和关键资产缺失会进入 lint 输出', () => {
    const manifest = buildArtifactManifestSample();
    const report = buildLintReport({
      generatedAt: '2026-04-15T00:00:00.000Z',
      manifest,
      actualAssets: ['context-routing.json'],
      contextAssets: ['notes/orphan.md'],
      schemaDrift: ['context-routing drift'],
      requiredAssets: ['context-routing.json', 'artifact-manifest.json'],
    });

    expect(report.status).toBe('error');
    expect(report.schema_drift).toContain('context-routing drift');
    expect(report.missing_assets).toContain('artifact-manifest.json');
    expect(report.orphan_pages).toContain('notes/orphan.md');
  });

  test('同一事实冲突时 contradictions 报警', () => {
    const report = buildContradictionsReport({
      assets: [
        { asset_path: 'a.json', content: { primary_language: 'JavaScript' } },
        { asset_path: 'b.json', content: { primary_language: 'TypeScript' } },
      ],
    });

    expect(report.status).toBe('warning');
    expect(report.contradictions[0].fact_key).toBe('primary_language');
  });

  test('routing 默认暴露 freshness/lint/contradictions 控制面资产', () => {
    const routing = buildContextRoutingSample();

    expect(routing.always).toContain('freshness.json');
    expect(routing.stages.work).toContain('lint-report.json');
    expect(routing.stages.review).toContain('contradictions.json');
  });

  test('artifact-manifest 为 freshness/lint/contradictions 标记控制面元数据', () => {
    const manifest = buildArtifactManifestSample();

    expect(manifest.outputs['freshness.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['lint-report.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['contradictions.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
  });
});
