'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { resolveWorkflowArtifactDir } = require('../src/crg/artifact-paths');
const { buildQualityFeedbackTopics } = require('../src/verification/quality-feedback');

const GATE_ID = 'ai-dev-quality-gate';
const QUALITY_FEEDBACK_FILE = 'quality-feedback-topics.json';
const CRG_RUNTIME_CONTRACT_TESTS = [
  'tests/unit/branch-protection-policy.test.js',
  'tests/unit/crg-control-plane-contracts.test.js',
  'tests/unit/crg-router.test.js',
  'tests/unit/crg-workflow-context-hooks.test.js',
  'tests/unit/crg-review-context-hunks.test.js',
  'tests/unit/spec-plan-contracts.test.js',
  'tests/unit/spec-write-tasks-contracts.test.js',
  'tests/unit/spec-work-contracts.test.js',
  'tests/unit/spec-work-beta-contracts.test.js',
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

function buildGateResult({ generatedAt, crgRuntimeContracts }) {
  const checks = [crgRuntimeContracts];
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    gate_id: GATE_ID,
    passed: checks.every((check) => check.passed),
    checks,
    failures: checks.filter((check) => !check.passed).map((check) => check.check_id),
  };
}

function runCrgRuntimeContractsSuite({ repoRoot, artifactDir }) {
  const jestBin = require.resolve('jest/bin/jest');
  const outputPath = path.join(artifactDir, 'crg-runtime-contracts.junit.json');
  const result = spawnSync(process.execPath, [
    jestBin,
    ...CRG_RUNTIME_CONTRACT_TESTS,
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
    check_id: 'crg-runtime-contracts',
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

  const crgRuntimeContracts = runCrgRuntimeContractsSuite({ repoRoot, artifactDir });
  const gateResult = buildGateResult({ generatedAt, crgRuntimeContracts });
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
  CRG_RUNTIME_CONTRACT_TESTS,
  buildGateResult,
  runAiDevQualityGate,
};
