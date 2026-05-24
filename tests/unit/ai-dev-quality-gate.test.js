'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const {
  GATE_ID,
  QUALITY_FEEDBACK_FILE,
  WORKFLOW_RUNTIME_CONTRACT_TESTS,
  buildBenchmarkFixturesCheck,
  buildGateResult,
} = require('../../scripts/run-ai-dev-quality-gate');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'quality-gates',
  'ai-dev-quality-gate-result.schema.json'
);

describe('ai dev quality gate contract', () => {
  test('schema validates lightweight gate result without workflow state-machine semantics', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const result = buildGateResult({
      generatedAt: '2026-04-18T13:20:00.000Z',
      workflowRuntimeContracts: {
        check_id: 'workflow-runtime-contracts',
        kind: 'unit-suite',
        passed: true,
        summary: {
          test_suites_total: 13,
          test_suites_failed: 0,
          tests_total: 76,
          tests_failed: 0,
        },
        artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/workflow-runtime-contracts.junit.json',
      },
    });

    expect(validateAgainstSchema(schema, result).errors).toEqual([]);
    expect(result).toEqual({
      schema_version: 'v1',
      generated_at: '2026-04-18T13:20:00.000Z',
      gate_id: GATE_ID,
      passed: true,
      checks: [
        expect.objectContaining({
          check_id: 'workflow-runtime-contracts',
          kind: 'unit-suite',
          passed: true,
        }),
      ],
      failures: [],
      advisory_failures: [],
    });
  });

  test('benchmark fixture failures remain advisory in the aggregate gate result', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const benchmarkFixtures = {
      schema_version: 'v1',
      generated_at: '2026-04-18T13:20:00.000Z',
      suite_id: 'ai-dev-benchmark-fixtures',
      passed: false,
      advisory: true,
      fixtures: [
        {
          fixture_id: 'unsafe-path',
          status: 'failed',
          reason_code: 'unsafe-path',
          artifact_paths: ['tests/fixtures/ai-dev-benchmarks/unsafe-path/manifest.json'],
          advisory: true,
          validation_commands_status: 'declared_only',
          validation_commands: ['node definitely-not-executed.js'],
        },
      ],
      failures: [
        {
          fixture_id: 'unsafe-path',
          reason_code: 'unsafe-path',
          message: 'prompt_path must be a safe POSIX repo-relative path.',
          artifact_paths: ['tests/fixtures/ai-dev-benchmarks/unsafe-path/manifest.json'],
        },
      ],
      artifact_path: '.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json',
    };
    const result = buildGateResult({
      generatedAt: '2026-04-18T13:20:00.000Z',
      workflowRuntimeContracts: {
        check_id: 'workflow-runtime-contracts',
        kind: 'unit-suite',
        passed: true,
        summary: {
          test_suites_total: 13,
          test_suites_failed: 0,
          tests_total: 76,
          tests_failed: 0,
        },
        artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/workflow-runtime-contracts.junit.json',
      },
      benchmarkFixtures,
    });

    expect(validateAgainstSchema(schema, result).errors).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.checks).toContainEqual(expect.objectContaining({
      check_id: 'ai-dev-benchmark-fixtures',
      kind: 'benchmark',
      passed: false,
      advisory: true,
    }));
    expect(result.advisory_failures).toEqual([
      {
        check_id: 'ai-dev-benchmark-fixtures',
        reason_code: 'unsafe-path',
        artifact_paths: [
          '.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json',
          'tests/fixtures/ai-dev-benchmarks/unsafe-path/manifest.json',
        ],
      },
    ]);
  });

  test('benchmark check summary keeps fixture drift visible without score semantics', () => {
    expect(buildBenchmarkFixturesCheck({
      passed: false,
      fixtures: [
        { status: 'passed' },
        { status: 'failed' },
      ],
      failures: [
        { reason_code: 'unsafe-path' },
      ],
      artifact_path: '.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json',
    })).toEqual({
      check_id: 'ai-dev-benchmark-fixtures',
      kind: 'benchmark',
      passed: false,
      advisory: true,
      summary: {
        fixtures_total: 2,
        fixtures_failed: 1,
        failures_total: 1,
      },
      artifact_path: '.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json',
    });
  });

  test('benchmark check summary reflects the five-fixture suite while staying advisory', () => {
    expect(buildBenchmarkFixturesCheck({
      passed: true,
      fixtures: [
        {
          fixture_id: 'api-contract',
          status: 'passed',
          semantic_review: {
            artifact_path: 'expected/semantic-review.md',
            review_mode: 'llm-review-pass',
            status: 'recorded',
          },
        },
        { fixture_id: 'cli-bugfix', status: 'passed' },
        { fixture_id: 'docs-only', status: 'passed' },
        { fixture_id: 'graph-degraded-fallback', status: 'passed' },
        { fixture_id: 'multi-module-refactor', status: 'passed' },
      ],
      failures: [],
      artifact_path: '.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json',
    })).toEqual({
      check_id: 'ai-dev-benchmark-fixtures',
      kind: 'benchmark',
      passed: true,
      advisory: true,
      summary: {
        fixtures_total: 5,
        fixtures_failed: 0,
        failures_total: 0,
      },
      artifact_path: '.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json',
    });
  });

  test('runner keeps a bounded explicit test list instead of inferring checks from workflow state', () => {
    expect(WORKFLOW_RUNTIME_CONTRACT_TESTS).toEqual([
      'tests/unit/branch-protection-policy.test.js',
      'tests/unit/no-crg-runtime-contracts.test.js',
      'tests/unit/package-install-contracts.test.js',
      'tests/unit/ai-dev-quality-gate.test.js',
      'tests/unit/ai-dev-benchmark-fixtures.test.js',
      'tests/unit/spec-plan-contracts.test.js',
      'tests/unit/task-pack-command.test.js',
      'tests/unit/spec-write-tasks-contracts.test.js',
      'tests/unit/spec-work-contracts.test.js',
      'tests/unit/spec-doc-review-contracts.test.js',
      'tests/unit/spec-code-review-contracts.test.js',
    ]);
    expect(QUALITY_FEEDBACK_FILE).toBe('quality-feedback-topics.json');
  });

  test('workflow path filters cover governance contracts and workflow self-updates', () => {
    const aiWorkflow = fs.readFileSync(path.join(REPO_ROOT, '.github', 'workflows', 'ai-dev-quality-gate.yml'), 'utf8');
    const retiredSource = 'src/' + 'crg/**';
    const retiredContracts = 'docs/contracts/' + 'crg/**';

    expect(aiWorkflow).toContain("src/cli/contracts/quality-gates/**");
    expect(aiWorkflow).not.toContain(retiredSource);
    expect(aiWorkflow).toContain("src/contracts/**");
    expect(aiWorkflow).toContain("docs/contracts/quality-gates/**");
    expect(aiWorkflow).toContain("scripts/run-ai-dev-benchmark-fixtures.js");
    expect(aiWorkflow).toContain("scripts/run-ai-dev-quality-gate.js");
    expect(aiWorkflow).toContain(".github/workflows/ai-dev-quality-gate.yml");
    expect(aiWorkflow).toContain("tests/unit/branch-protection-policy.test.js");
    expect(aiWorkflow).toContain("tests/unit/no-crg-runtime-contracts.test.js");
    expect(aiWorkflow).toContain("tests/unit/package-install-contracts.test.js");
    expect(aiWorkflow).toContain("tests/unit/ai-dev-quality-gate.test.js");
    expect(aiWorkflow).toContain("tests/unit/ai-dev-benchmark-fixtures.test.js");
    expect(aiWorkflow).toContain("tests/fixtures/ai-dev-benchmarks/**");
    expect(aiWorkflow).not.toContain(retiredContracts);
    expect(aiWorkflow).not.toContain("src/bootstrap-compiler/**");
    expect(aiWorkflow).not.toContain("docs/contracts/spec-" + "graph" + "-bootstrap/**");
    expect(aiWorkflow).not.toContain("src/context-routing/**");
    expect(aiWorkflow).not.toContain("src/cli/commands/stage0-context.js");
  });
});
