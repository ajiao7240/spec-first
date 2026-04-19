'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  aggregateBenchmarkResults,
  compareAgainstBaselines,
  compareMetadataAgainstBaselines,
  buildRegressionMetadata,
  loadBaselines,
  runRegression,
} = require('../../benchmarks/regression/run-regression');
const {
  buildBaselineUpdate,
} = require('../../scripts/update-crg-baselines');

describe('regression gate', () => {
  test('baseline 缺失时显式失败', () => {
    expect(() => loadBaselines('/tmp/non-existent-baseline.json')).toThrow(/baseline missing/);
  });

  test('runner 能聚合 benchmark 结果并通过基线', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const baselinePath = path.join(repoRoot, 'benchmarks', 'regression', 'baselines.json');
    const result = runRegression({ repoRoot, baselinePath });

    expect(result.metrics.review_average_hit_rate).toBeGreaterThanOrEqual(0);
    expect(result.metrics.fallback_rate).toBeGreaterThanOrEqual(0);
    expect(typeof result.benchmark_contract_version).toBe('string');
    expect(typeof result.analyzer_revision).toBe('string');
    expect(result.inputs).toEqual(expect.objectContaining({
      review_input_digest: expect.any(String),
      repo_qa_input_digest: expect.any(String),
      context_efficiency_input_digest: expect.any(String),
    }));
    expect(Array.isArray(result.failures)).toBe(true);
  });

  test('阈值触发时 regression 失败', () => {
    const failures = compareAgainstBaselines(
      aggregateBenchmarkResults({
        review: { average_hit_rate: 0.1 },
        repoQa: { average_hit_rate: 0.1, fallback_rate: 0.9 },
        contextEfficiency: { average_irrelevant_context_ratio: 0.9, fallback_rate: 0.9 },
      }),
      {
        review_average_hit_rate_min: 0.5,
        repo_qa_average_hit_rate_min: 0.5,
        context_efficiency_irrelevant_ratio_max: 0.5,
        fallback_rate_max: 0.5,
      }
    );

    expect(failures).toContain('review_average_hit_rate');
    expect(failures).toContain('repo_qa_average_hit_rate');
    expect(failures).toContain('context_efficiency_irrelevant_ratio');
    expect(failures).toContain('fallback_rate');
  });

  test('baseline update builder 输出与 regression metrics 对齐的字段', () => {
    const baseline = buildBaselineUpdate({
      metrics: {
        benchmark_contract_version: 'v1',
        analyzer_revision: 'context-routing-evaluator:demo',
        review_input_digest: 'review-digest',
        repo_qa_input_digest: 'repoqa-digest',
        context_efficiency_input_digest: 'context-digest',
        review_average_hit_rate: 0.8,
        repo_qa_average_hit_rate: 0.7,
        context_efficiency_irrelevant_ratio: 0.4,
        fallback_rate: 0.1,
      },
    });

    expect(baseline).toEqual({
      schema_version: 'v2',
      benchmark_contract_version: 'v1',
      analyzer_revision: 'context-routing-evaluator:demo',
      review_input_digest: 'review-digest',
      repo_qa_input_digest: 'repoqa-digest',
      context_efficiency_input_digest: 'context-digest',
      review_average_hit_rate_min: 0.8,
      repo_qa_average_hit_rate_min: 0.7,
      context_efficiency_irrelevant_ratio_max: 0.4,
      fallback_rate_max: 0.1,
    });
  });

  test('metadata mismatch 时显式标记 baseline 不可比', () => {
    expect(compareMetadataAgainstBaselines(
      {
        benchmark_contract_version: 'v1',
        analyzer_revision: 'context-routing-evaluator:new',
        review_input_digest: 'a',
        repo_qa_input_digest: 'b',
        context_efficiency_input_digest: 'c',
      },
      {
        benchmark_contract_version: 'v1',
        analyzer_revision: 'context-routing-evaluator:old',
        review_input_digest: 'a',
        repo_qa_input_digest: 'x',
        context_efficiency_input_digest: 'c',
      }
    )).toEqual({
      comparable: false,
      mismatches: ['analyzer_revision', 'repo_qa_input_digest'],
    });
  });

  test('metadata builder 收敛三个 benchmark 的可比对输入', () => {
    expect(buildRegressionMetadata({
      review: {
        analyzer_revision: 'context-routing-evaluator:demo',
        input_digest: 'review-digest',
      },
      repoQa: {
        analyzer_revision: 'context-routing-evaluator:demo',
        input_digest: 'repoqa-digest',
      },
      contextEfficiency: {
        analyzer_revision: 'context-routing-evaluator:demo',
        input_digest: 'context-digest',
      },
    })).toEqual({
      benchmark_contract_version: 'v1',
      analyzer_revision: 'context-routing-evaluator:demo',
      review_input_digest: 'review-digest',
      repo_qa_input_digest: 'repoqa-digest',
      context_efficiency_input_digest: 'context-digest',
    });
  });
});
