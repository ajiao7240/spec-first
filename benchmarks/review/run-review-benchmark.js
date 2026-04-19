'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { evaluateContextForRepo } = require('../../src/context-routing/evaluator');
const {
  BENCHMARK_CONTRACT_VERSION,
  buildContextRoutingAnalyzerRevision,
  digestFile,
} = require('../shared/benchmark-metadata');

function loadCases(casesPath) {
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  if (!Array.isArray(cases)) {
    throw new Error('review benchmark cases must be an array');
  }
  for (const item of cases) {
    if (
      !item.id ||
      !item.repo_slug ||
      !item.stage ||
      !Array.isArray(item.expected_assets) ||
      (item.fixture_repo_root !== undefined && typeof item.fixture_repo_root !== 'string')
    ) {
      throw new Error(`invalid review benchmark case: ${JSON.stringify(item)}`);
    }
  }
  return cases;
}

function runReviewBenchmark({ repoRoot, casesPath }) {
  const cases = loadCases(casesPath);
  const results = cases.map((testCase) => {
    const targetRepoRoot = testCase.fixture_repo_root
      ? path.resolve(repoRoot, testCase.fixture_repo_root)
      : repoRoot;
    const evaluation = evaluateContextForRepo({
      repoRoot: targetRepoRoot,
      slug: testCase.repo_slug,
      stage: testCase.stage,
    });
    const actualAssets = evaluation.selected_assets;
    const matchedAssets = testCase.expected_assets.filter((assetPath) => actualAssets.includes(assetPath));

    return {
      id: testCase.id,
      repo_slug: testCase.repo_slug,
      stage: testCase.stage,
      level: evaluation.level,
      hit_rate: testCase.expected_assets.length === 0
        ? 1
        : matchedAssets.length / testCase.expected_assets.length,
      matched_assets: matchedAssets,
      missing_evidence: testCase.expected_assets.filter((assetPath) => !actualAssets.includes(assetPath)),
      irrelevant_evidence: actualAssets.filter((assetPath) => !testCase.expected_assets.includes(assetPath)),
      fallback_reason: evaluation.fallback_reason,
    };
  });

  return {
    benchmark_contract_version: BENCHMARK_CONTRACT_VERSION,
    analyzer_revision: buildContextRoutingAnalyzerRevision(repoRoot),
    input_digest: digestFile(casesPath),
    generated_at: new Date().toISOString(),
    case_count: results.length,
    average_hit_rate: results.length === 0
      ? 0
      : results.reduce((sum, item) => sum + item.hit_rate, 0) / results.length,
    average_irrelevant_evidence_count: results.length === 0
      ? 0
      : results.reduce((sum, item) => sum + item.irrelevant_evidence.length, 0) / results.length,
    fallback_rate: results.length === 0
      ? 0
      : results.filter((item) => item.level !== 'L0').length / results.length,
    results,
  };
}

if (require.main === module) {
  const repoRoot = process.cwd();
  const casesPath = path.join(repoRoot, 'benchmarks', 'review', 'cases.json');
  process.stdout.write(`${JSON.stringify(runReviewBenchmark({ repoRoot, casesPath }), null, 2)}\n`);
}

module.exports = {
  loadCases,
  runReviewBenchmark,
};
