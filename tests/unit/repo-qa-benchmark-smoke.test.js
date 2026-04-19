'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadQuestions, runRepoQaBenchmark } = require('../../benchmarks/repo-qa/run-repo-qa');

describe('repo qa benchmark smoke', () => {
  test('questions.json 格式正确且 runner 可输出结果', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const questionsPath = path.join(repoRoot, 'benchmarks', 'repo-qa', 'questions.json');
    const result = runRepoQaBenchmark({ repoRoot, questionsPath });

    expect(result.question_count).toBeGreaterThanOrEqual(3);
    expect(result.results[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      hit_rate: expect.any(Number),
      evidence_quality: expect.any(String),
    }));
    expect(result.benchmark_contract_version).toBe('v1');
    expect(typeof result.analyzer_revision).toBe('string');
    expect(typeof result.input_digest).toBe('string');
    expect(result.average_missing_evidence_count).toEqual(expect.any(Number));
    expect(result.fallback_rate).toEqual(expect.any(Number));
  });

  test('格式错误时显式失败', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-qa-'));
    const filePath = path.join(tmpDir, 'questions.json');
    fs.writeFileSync(filePath, JSON.stringify([{ id: 'bad' }], null, 2));

    try {
      expect(() => loadQuestions(filePath)).toThrow(/invalid repo qa question/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('支持受控 external fixture repo question', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const questionsPath = path.join(repoRoot, 'benchmarks', 'repo-qa', 'questions.json');
    const result = runRepoQaBenchmark({ repoRoot, questionsPath });
    const fixtureQuestion = result.results.find((item) => item.id === 'demo-store-plan-entrypoints');
    const walletFixtureQuestion = result.results.find((item) => item.id === 'wallet-suite-work-verification');

    expect(fixtureQuestion).toEqual(expect.objectContaining({
      repo_slug: 'demo-store',
      hit_rate: 1,
      evidence_quality: 'high',
    }));
    expect(walletFixtureQuestion).toEqual(expect.objectContaining({
      repo_slug: 'wallet-suite',
      hit_rate: 1,
      evidence_quality: 'high',
      matched_evidence: expect.arrayContaining([
        'minimal-context/work.json',
        'code-facts/test-map.md',
      ]),
    }));
  });
});
