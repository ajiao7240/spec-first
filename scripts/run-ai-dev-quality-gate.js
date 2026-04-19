'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { runRegression } = require('../benchmarks/regression/run-regression');
const { resolveWorkflowArtifactDir } = require('../src/crg/artifact-paths');
const { buildQualityFeedbackTopics } = require('../src/context-routing/quality-feedback');

const GATE_ID = 'ai-dev-quality-gate';
const QUALITY_FEEDBACK_FILE = 'quality-feedback-topics.json';
const STAGE0_CONTRACT_TESTS = [
  'tests/unit/branch-protection-policy.test.js',
  'tests/unit/crg-benchmark-evidence.test.js',
  'tests/unit/spec-graph-bootstrap-contracts.test.js',
  'tests/unit/spec-graph-bootstrap-compiler.test.js',
  'tests/unit/quality-feedback.test.js',
  'tests/unit/verifier-registry.test.js',
  'tests/unit/stage0-context-command.test.js',
  'tests/unit/verification-evidence.test.js',
  'tests/unit/verification-gate-state.test.js',
  'tests/unit/workflow-stage0-consumption.test.js',
  'tests/unit/spec-plan-contracts.test.js',
  'tests/unit/spec-work-contracts.test.js',
  'tests/unit/spec-work-beta-contracts.test.js',
  'tests/unit/spec-review-contracts.test.js',
  'tests/unit/workflow-telemetry.test.js',
  'tests/unit/workspace-context.test.js',
];

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

function buildGateResult({ generatedAt, stage0Contracts, regression }) {
  const checks = [stage0Contracts, regression];
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    gate_id: GATE_ID,
    passed: checks.every((check) => check.passed),
    checks,
    failures: checks.filter((check) => !check.passed).map((check) => check.check_id),
  };
}

function runStage0ContractsSuite({ repoRoot, artifactDir }) {
  const jestBin = require.resolve('jest/bin/jest');
  const outputPath = path.join(artifactDir, 'stage0-contracts.junit.json');
  const result = spawnSync(process.execPath, [
    jestBin,
    ...STAGE0_CONTRACT_TESTS,
    '--runInBand',
    '--json',
    `--outputFile=${outputPath}`,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    : null;

  return {
    check_id: 'stage0-contracts',
    kind: 'unit-suite',
    passed: result.status === 0 && output && output.success === true,
    summary: {
      test_suites_total: output ? output.numTotalTestSuites : null,
      test_suites_failed: output ? output.numFailedTestSuites : null,
      tests_total: output ? output.numTotalTests : null,
      tests_failed: output ? output.numFailedTests : null,
    },
    artifact_path: fs.existsSync(outputPath) ? relativeArtifactPath(repoRoot, outputPath) : null,
  };
}

function runCrgRegressionBenchmark({ repoRoot, artifactDir }) {
  const baselinePath = path.join(repoRoot, 'benchmarks', 'regression', 'baselines.json');
  const outputPath = path.join(artifactDir, 'crg-regression.json');
  const result = runRegression({ repoRoot, baselinePath });
  writeJson(outputPath, result);

  return {
    check_id: 'crg-regression',
    kind: 'benchmark',
    passed: result.passed === true,
    summary: {
      failure_count: Array.isArray(result.failures) ? result.failures.length : 0,
      failures: result.failures || [],
      benchmark_contract_version: result.benchmark_contract_version,
      analyzer_revision: result.analyzer_revision,
      compatibility: result.compatibility,
      review_average_hit_rate: result.metrics.review_average_hit_rate,
      repo_qa_average_hit_rate: result.metrics.repo_qa_average_hit_rate,
      context_efficiency_irrelevant_ratio: result.metrics.context_efficiency_irrelevant_ratio,
      fallback_rate: result.metrics.fallback_rate,
    },
    artifact_path: relativeArtifactPath(repoRoot, outputPath),
  };
}

function runAiDevQualityGate({ repoRoot = process.cwd() } = {}) {
  const generatedAt = new Date().toISOString();
  const artifactDir = resolveWorkflowArtifactDir(repoRoot, 'quality-gates', GATE_ID);
  ensureDir(artifactDir);

  const stage0Contracts = runStage0ContractsSuite({ repoRoot, artifactDir });
  const regression = runCrgRegressionBenchmark({ repoRoot, artifactDir });
  const gateResult = buildGateResult({ generatedAt, stage0Contracts, regression });
  const resultPath = path.join(artifactDir, 'ai-dev-quality-gate-result.json');
  writeJson(resultPath, gateResult);
  const feedbackTopics = buildQualityFeedbackTopics({
    generatedAt,
    aiDevQualityGateResult: gateResult,
    gateArtifactPath: relativeArtifactPath(repoRoot, resultPath),
  });
  const feedbackPath = path.join(artifactDir, QUALITY_FEEDBACK_FILE);
  writeJson(feedbackPath, feedbackTopics);

  return {
    ...gateResult,
    artifact_path: relativeArtifactPath(repoRoot, resultPath),
    feedback_artifact_path: relativeArtifactPath(repoRoot, feedbackPath),
  };
}

if (require.main === module) {
  const result = runAiDevQualityGate({ repoRoot: process.cwd() });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) {
    process.exitCode = 1;
  }
}

module.exports = {
  GATE_ID,
  QUALITY_FEEDBACK_FILE,
  STAGE0_CONTRACT_TESTS,
  buildGateResult,
  runAiDevQualityGate,
};
