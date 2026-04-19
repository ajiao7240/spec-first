'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runReviewBenchmark, loadCases } = require('../../benchmarks/review/run-review-benchmark');

describe('review benchmark smoke', () => {
  test('benchmark runner 能读取 fixture 并输出结果', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const casesPath = path.join(repoRoot, 'benchmarks', 'review', 'cases.json');
    const result = runReviewBenchmark({ repoRoot, casesPath });

    expect(result.case_count).toBeGreaterThanOrEqual(3);
    expect(result.results[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      hit_rate: expect.any(Number),
    }));
    expect(result.benchmark_contract_version).toBe('v1');
    expect(typeof result.analyzer_revision).toBe('string');
    expect(typeof result.input_digest).toBe('string');
    expect(result.fallback_rate).toEqual(expect.any(Number));
    expect(result.average_irrelevant_evidence_count).toEqual(expect.any(Number));
  });

  test('cases 格式错误时显式失败', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-benchmark-'));
    const invalidCasesPath = path.join(tmpDir, 'cases.json');
    fs.writeFileSync(invalidCasesPath, JSON.stringify([{ id: 'broken' }], null, 2));

    try {
      expect(() => loadCases(invalidCasesPath)).toThrow(/invalid review benchmark case/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('smoke case 至少命中一项预期资产', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const casesPath = path.join(repoRoot, 'benchmarks', 'review', 'cases.json');
    const result = runReviewBenchmark({ repoRoot, casesPath });

    expect(result.results[0].matched_assets.length).toBeGreaterThanOrEqual(1);
  });

  test('支持受控 external fixture repo benchmark case', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const casesPath = path.join(repoRoot, 'benchmarks', 'review', 'cases.json');
    const result = runReviewBenchmark({ repoRoot, casesPath });
    const fixtureCase = result.results.find((item) => item.id === 'demo-store-review-fixture');
    const walletFixtureCase = result.results.find((item) => item.id === 'wallet-suite-review-fixture');

    expect(fixtureCase).toEqual(expect.objectContaining({
      repo_slug: 'demo-store',
      hit_rate: 1,
      matched_assets: expect.arrayContaining([
        'minimal-context/review.json',
        'code-facts/high-risk-modules.md',
      ]),
    }));
    expect(walletFixtureCase).toEqual(expect.objectContaining({
      repo_slug: 'wallet-suite',
      hit_rate: 1,
      matched_assets: expect.arrayContaining([
        'minimal-context/review.json',
        'code-facts/high-risk-modules.md',
      ]),
    }));
  });
});
