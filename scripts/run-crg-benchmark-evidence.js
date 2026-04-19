'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { runReviewBenchmark } = require('../benchmarks/review/run-review-benchmark');
const { runRepoQaBenchmark } = require('../benchmarks/repo-qa/run-repo-qa');
const { runContextEfficiencyBenchmark } = require('../benchmarks/context-efficiency/run-context-efficiency');
const { resolveWorkflowArtifactDir } = require('../src/crg/artifact-paths');

const ARTIFACT_KIND = 'crg-benchmark-evidence';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relativeArtifactPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function collectBenchmarks({ repoRoot, artifactDir }) {
  const reviewPath = path.join(artifactDir, 'review-benchmark.json');
  const repoQaPath = path.join(artifactDir, 'repo-qa-benchmark.json');
  const contextEfficiencyPath = path.join(artifactDir, 'context-efficiency-benchmark.json');

  const review = runReviewBenchmark({
    repoRoot,
    casesPath: path.join(repoRoot, 'benchmarks', 'review', 'cases.json'),
  });
  writeJson(reviewPath, review);

  const repoQa = runRepoQaBenchmark({
    repoRoot,
    questionsPath: path.join(repoRoot, 'benchmarks', 'repo-qa', 'questions.json'),
  });
  writeJson(repoQaPath, repoQa);

  const contextEfficiency = runContextEfficiencyBenchmark({
    repoRoot,
    casesPath: path.join(repoRoot, 'benchmarks', 'context-efficiency', 'cases.json'),
  });
  writeJson(contextEfficiencyPath, contextEfficiency);

  return [
    {
      benchmark_id: 'review',
      benchmark_contract_version: review.benchmark_contract_version,
      analyzer_revision: review.analyzer_revision,
      input_digest: review.input_digest,
      artifact_path: relativeArtifactPath(repoRoot, reviewPath),
      summary: {
        case_count: review.case_count,
        average_hit_rate: review.average_hit_rate,
        average_irrelevant_evidence_count: review.average_irrelevant_evidence_count,
        fallback_rate: review.fallback_rate,
      },
    },
    {
      benchmark_id: 'repo-qa',
      benchmark_contract_version: repoQa.benchmark_contract_version,
      analyzer_revision: repoQa.analyzer_revision,
      input_digest: repoQa.input_digest,
      artifact_path: relativeArtifactPath(repoRoot, repoQaPath),
      summary: {
        question_count: repoQa.question_count,
        average_hit_rate: repoQa.average_hit_rate,
        average_missing_evidence_count: repoQa.average_missing_evidence_count,
        fallback_rate: repoQa.fallback_rate,
      },
    },
    {
      benchmark_id: 'context-efficiency',
      benchmark_contract_version: contextEfficiency.benchmark_contract_version,
      analyzer_revision: contextEfficiency.analyzer_revision,
      input_digest: contextEfficiency.input_digest,
      artifact_path: relativeArtifactPath(repoRoot, contextEfficiencyPath),
      summary: {
        case_count: contextEfficiency.case_count,
        average_irrelevant_context_ratio: contextEfficiency.average_irrelevant_context_ratio,
        fallback_rate: contextEfficiency.fallback_rate,
      },
    },
  ];
}

function runCrgBenchmarkEvidence({ repoRoot = process.cwd() } = {}) {
  const artifactDir = resolveWorkflowArtifactDir(repoRoot, 'quality-gates', ARTIFACT_KIND);
  ensureDir(artifactDir);

  const generatedAt = new Date().toISOString();
  const benchmarks = collectBenchmarks({ repoRoot, artifactDir });
  const result = {
    schema_version: 'v1',
    generated_at: generatedAt,
    artifact_kind: ARTIFACT_KIND,
    benchmarks,
  };
  const resultPath = path.join(artifactDir, 'crg-benchmark-evidence.json');
  writeJson(resultPath, result);

  return {
    ...result,
    artifact_path: relativeArtifactPath(repoRoot, resultPath),
  };
}

if (require.main === module) {
  const result = runCrgBenchmarkEvidence({ repoRoot: process.cwd() });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = {
  ARTIFACT_KIND,
  runCrgBenchmarkEvidence,
};
