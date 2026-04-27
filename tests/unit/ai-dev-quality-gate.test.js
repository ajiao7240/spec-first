'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const {
  GATE_ID,
  QUALITY_FEEDBACK_FILE,
  WORKFLOW_RUNTIME_CONTRACT_TESTS,
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
    });
  });

  test('runner keeps a bounded explicit test list instead of inferring checks from workflow state', () => {
    expect(WORKFLOW_RUNTIME_CONTRACT_TESTS).toEqual([
      'tests/unit/branch-protection-policy.test.js',
      'tests/unit/no-crg-runtime-contracts.test.js',
      'tests/unit/package-install-contracts.test.js',
      'tests/unit/spec-plan-contracts.test.js',
      'tests/unit/task-pack-command.test.js',
      'tests/unit/spec-write-tasks-contracts.test.js',
      'tests/unit/spec-work-contracts.test.js',
      'tests/unit/spec-work-beta-contracts.test.js',
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
    expect(aiWorkflow).toContain(".github/workflows/ai-dev-quality-gate.yml");
    expect(aiWorkflow).toContain("tests/unit/branch-protection-policy.test.js");
    expect(aiWorkflow).toContain("tests/unit/no-crg-runtime-contracts.test.js");
    expect(aiWorkflow).toContain("tests/unit/package-install-contracts.test.js");
    expect(aiWorkflow).not.toContain(retiredContracts);
    expect(aiWorkflow).not.toContain("src/bootstrap-compiler/**");
    expect(aiWorkflow).not.toContain("docs/contracts/spec-" + "graph" + "-bootstrap/**");
    expect(aiWorkflow).not.toContain("src/context-routing/**");
    expect(aiWorkflow).not.toContain("src/cli/commands/stage0-context.js");
  });
});
