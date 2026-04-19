'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { runReviewBenchmark } = require('../review/run-review-benchmark');
const { runRepoQaBenchmark } = require('../repo-qa/run-repo-qa');
const { runContextEfficiencyBenchmark } = require('../context-efficiency/run-context-efficiency');
const { BENCHMARK_CONTRACT_VERSION } = require('../shared/benchmark-metadata');

function loadBaselines(baselinePath) {
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`baseline missing: ${baselinePath}`);
  }
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function aggregateBenchmarkResults({ review, repoQa, contextEfficiency }) {
  return {
    review_average_hit_rate: review.average_hit_rate,
    repo_qa_average_hit_rate: repoQa.average_hit_rate,
    context_efficiency_irrelevant_ratio: contextEfficiency.average_irrelevant_context_ratio,
    fallback_rate: (
      (review.fallback_rate || 0) +
      (repoQa.fallback_rate || 0) +
      (contextEfficiency.fallback_rate || 0)
    ) / 3,
  };
}

function buildRegressionMetadata({ review, repoQa, contextEfficiency }) {
  return {
    benchmark_contract_version: BENCHMARK_CONTRACT_VERSION,
    analyzer_revision: review.analyzer_revision || repoQa.analyzer_revision || contextEfficiency.analyzer_revision || 'unknown',
    review_input_digest: review.input_digest || null,
    repo_qa_input_digest: repoQa.input_digest || null,
    context_efficiency_input_digest: contextEfficiency.input_digest || null,
  };
}

function compareAgainstBaselines(metrics, baselines) {
  const failures = [];
  if (metrics.review_average_hit_rate < baselines.review_average_hit_rate_min) {
    failures.push('review_average_hit_rate');
  }
  if (metrics.repo_qa_average_hit_rate < baselines.repo_qa_average_hit_rate_min) {
    failures.push('repo_qa_average_hit_rate');
  }
  if (metrics.context_efficiency_irrelevant_ratio > baselines.context_efficiency_irrelevant_ratio_max) {
    failures.push('context_efficiency_irrelevant_ratio');
  }
  if (
    typeof baselines.fallback_rate_max === 'number' &&
    metrics.fallback_rate > baselines.fallback_rate_max
  ) {
    failures.push('fallback_rate');
  }
  return failures;
}

function compareMetadataAgainstBaselines(metadata, baselines) {
  const mismatches = [];
  if (!baselines || typeof baselines !== 'object') {
    return { comparable: false, mismatches: ['baseline_missing'] };
  }

  const keys = [
    'benchmark_contract_version',
    'analyzer_revision',
    'review_input_digest',
    'repo_qa_input_digest',
    'context_efficiency_input_digest',
  ];

  for (const key of keys) {
    if (baselines[key] === undefined || baselines[key] === null) continue;
    if (metadata[key] !== baselines[key]) {
      mismatches.push(key);
    }
  }

  return {
    comparable: mismatches.length === 0,
    mismatches,
  };
}

function runRegression({
  repoRoot,
  baselinePath,
  reviewCasesPath = path.join(repoRoot, 'benchmarks', 'review', 'cases.json'),
  repoQuestionsPath = path.join(repoRoot, 'benchmarks', 'repo-qa', 'questions.json'),
  contextCasesPath = path.join(repoRoot, 'benchmarks', 'context-efficiency', 'cases.json'),
} = {}) {
  const baselines = loadBaselines(baselinePath);
  const review = runReviewBenchmark({ repoRoot, casesPath: reviewCasesPath });
  const repoQa = runRepoQaBenchmark({ repoRoot, questionsPath: repoQuestionsPath });
  const contextEfficiency = runContextEfficiencyBenchmark({ repoRoot, casesPath: contextCasesPath });
  const metrics = aggregateBenchmarkResults({ review, repoQa, contextEfficiency });
  const metadata = buildRegressionMetadata({ review, repoQa, contextEfficiency });
  const compatibility = compareMetadataAgainstBaselines(metadata, baselines);
  const failures = compareAgainstBaselines(metrics, baselines);
  if (!compatibility.comparable) {
    failures.push('baseline_incompatible');
  }

  return {
    benchmark_contract_version: metadata.benchmark_contract_version,
    analyzer_revision: metadata.analyzer_revision,
    generated_at: new Date().toISOString(),
    inputs: {
      review_input_digest: metadata.review_input_digest,
      repo_qa_input_digest: metadata.repo_qa_input_digest,
      context_efficiency_input_digest: metadata.context_efficiency_input_digest,
    },
    metrics,
    baselines,
    compatibility,
    failures,
    passed: failures.length === 0,
  };
}

if (require.main === module) {
  const repoRoot = process.cwd();
  const baselinePath = path.join(repoRoot, 'benchmarks', 'regression', 'baselines.json');
  const result = runRegression({ repoRoot, baselinePath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) {
    process.exitCode = 1;
  }
}

module.exports = {
  aggregateBenchmarkResults,
  compareAgainstBaselines,
  compareMetadataAgainstBaselines,
  buildRegressionMetadata,
  loadBaselines,
  runRegression,
};
