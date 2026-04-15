'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  aggregateBenchmarkResults,
  compareAgainstBaselines,
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
        review_average_hit_rate: 0.8,
        repo_qa_average_hit_rate: 0.7,
        context_efficiency_irrelevant_ratio: 0.4,
        fallback_rate: 0.1,
      },
    });

    expect(baseline).toEqual({
      review_average_hit_rate_min: 0.8,
      repo_qa_average_hit_rate_min: 0.7,
      context_efficiency_irrelevant_ratio_max: 0.4,
      fallback_rate_max: 0.1,
    });
  });
});
