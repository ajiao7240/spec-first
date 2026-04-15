'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { runReviewBenchmark } = require('../review/run-review-benchmark');
const { runRepoQaBenchmark } = require('../repo-qa/run-repo-qa');
const { runContextEfficiencyBenchmark } = require('../context-efficiency/run-context-efficiency');

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
  const failures = compareAgainstBaselines(metrics, baselines);

  return {
    generated_at: new Date().toISOString(),
    metrics,
    baselines,
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
  loadBaselines,
  runRegression,
};
