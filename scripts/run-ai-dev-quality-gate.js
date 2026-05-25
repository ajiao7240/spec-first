'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { resolveWorkflowArtifactDir } = require('../src/verification/artifact-paths');
const { buildQualityFeedbackTopics } = require('../src/verification/quality-feedback');
const {
  BENCHMARK_SUITE_ID,
  runAiDevBenchmarkFixtures,
} = require('./run-ai-dev-benchmark-fixtures');

const GATE_ID = 'ai-dev-quality-gate';
const QUALITY_FEEDBACK_FILE = 'quality-feedback-topics.json';
const WORKFLOW_RUNTIME_CONTRACT_TESTS = [
  'tests/unit/branch-protection-policy.test.js',
  'tests/unit/no-crg-runtime-contracts.test.js',
  'tests/unit/graph-anchor-extraction-helper.test.js',
  'tests/unit/init-source-path-coverage.test.js',
  'tests/unit/package-install-contracts.test.js',
  'tests/unit/mcp-setup-powershell-contracts.test.js',
  'tests/unit/spec-graph-bootstrap-contracts.test.js',
  'tests/unit/bootstrap-providers-powershell-contracts.test.js',
  'tests/unit/graph-provider-consumption-contracts.test.js',
  'tests/unit/ai-dev-quality-gate.test.js',
  'tests/unit/ai-dev-benchmark-fixtures.test.js',
  'tests/unit/spec-plan-contracts.test.js',
  'tests/unit/task-pack-command.test.js',
  'tests/unit/spec-write-tasks-contracts.test.js',
  'tests/unit/spec-work-contracts.test.js',
  'tests/unit/spec-doc-review-contracts.test.js',
  'tests/unit/spec-code-review-contracts.test.js',
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

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildBenchmarkFixturesCheck(benchmarkFixtures) {
  return {
    check_id: BENCHMARK_SUITE_ID,
    kind: 'benchmark',
    passed: benchmarkFixtures.passed,
    advisory: true,
    summary: {
      fixtures_total: Array.isArray(benchmarkFixtures.fixtures) ? benchmarkFixtures.fixtures.length : 0,
      fixtures_failed: Array.isArray(benchmarkFixtures.fixtures)
        ? benchmarkFixtures.fixtures.filter((fixture) => fixture.status === 'failed').length
        : 0,
      failures_total: Array.isArray(benchmarkFixtures.failures) ? benchmarkFixtures.failures.length : 0,
    },
    artifact_path: benchmarkFixtures.artifact_path || null,
  };
}

function buildAdvisoryFailures(checks, benchmarkFixtures = null) {
  return checks
    .filter((check) => check.advisory === true && check.passed === false)
    .map((check) => {
      const benchmarkFailures = check.check_id === BENCHMARK_SUITE_ID && benchmarkFixtures
        ? benchmarkFixtures.failures || []
        : [];
      const reasonCode = benchmarkFailures.find((failure) => failure.reason_code)?.reason_code
        || 'advisory-check-failed';
      const artifactPaths = unique([
        check.artifact_path,
        ...benchmarkFailures.flatMap((failure) => failure.artifact_paths || []),
      ]);

      return {
        check_id: check.check_id,
        reason_code: reasonCode,
        artifact_paths: artifactPaths,
      };
    });
}

function buildGateResult({ generatedAt, workflowRuntimeContracts, benchmarkFixtures = null }) {
  const checks = [workflowRuntimeContracts];
  if (benchmarkFixtures) {
    checks.push(buildBenchmarkFixturesCheck(benchmarkFixtures));
  }
  const blockingChecks = checks.filter((check) => check.advisory !== true);
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    gate_id: GATE_ID,
    passed: blockingChecks.every((check) => check.passed),
    checks,
    failures: blockingChecks.filter((check) => !check.passed).map((check) => check.check_id),
    advisory_failures: buildAdvisoryFailures(checks, benchmarkFixtures),
  };
}

function runWorkflowRuntimeContractsSuite({ repoRoot, artifactDir }) {
  const jestBin = require.resolve('jest/bin/jest');
  const outputPath = path.join(artifactDir, 'workflow-runtime-contracts.junit.json');
  const result = spawnSync(process.execPath, [
    jestBin,
    ...WORKFLOW_RUNTIME_CONTRACT_TESTS,
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
    check_id: 'workflow-runtime-contracts',
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

function runAiDevQualityGate({ repoRoot = process.cwd() } = {}) {
  const generatedAt = new Date().toISOString();
  const artifactDir = resolveWorkflowArtifactDir(repoRoot, 'quality-gates', GATE_ID);
  ensureDir(artifactDir);

  const workflowRuntimeContracts = runWorkflowRuntimeContractsSuite({ repoRoot, artifactDir });
  const benchmarkFixtures = runAiDevBenchmarkFixtures({
    repoRoot,
    fixturesRoot: path.join(repoRoot, 'tests', 'fixtures', 'ai-dev-benchmarks'),
    generatedAt,
  });
  const gateResult = buildGateResult({ generatedAt, workflowRuntimeContracts, benchmarkFixtures });
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
  WORKFLOW_RUNTIME_CONTRACT_TESTS,
  buildAdvisoryFailures,
  buildBenchmarkFixturesCheck,
  buildGateResult,
  runAiDevQualityGate,
};
