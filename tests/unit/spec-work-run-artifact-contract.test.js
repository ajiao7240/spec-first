'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'workflows',
  'spec-work-run-artifact.schema.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validArtifact() {
  return {
    schema_version: 'spec-work-run-artifact/v1',
    generated_at: '2026-05-17T00:00:00.000Z',
    workflow: 'spec-work',
    run_id: 'phase1b-smoke',
    mode: 'interactive',
    workspace_slug: 'spec-first',
    producer: {
      producer_available: true,
      workflow_integrated: false,
      reason_code: 'producer-write-side-only',
    },
    plan_path: 'docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md',
    plan_source: 'explicit',
    task_pack_path: 'docs/tasks/2026-05-17-001-feat-spec-first-optimization-phase1b-tasks.md',
    source_refs: ['docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md'],
    script_confirmed: {
      validation: {
        status: 'passed',
        commands: [
          {
            command: 'npm run test:jest -- tests/unit/spec-work-run-artifact-producer.test.js --runInBand',
            exit_code: 0,
            summary: 'producer tests passed',
          },
        ],
      },
      changed_files: ['src/cli/helpers/spec-work-run-artifact.js'],
      artifact_refs: ['.spec-first/workflows/spec-work/spec-first/phase1b-smoke/run.json'],
      raw_log_ref: {
        kind: 'none',
        display_ref: '',
        secret_stripped: true,
        redaction_status: 'none-required',
        retention_status: 'lifecycle-deferred',
        access_boundary: 'none',
        reason_code: 'no-raw-log',
      },
      resume_evidence: {
        status: 'not-run',
        reason_code: 'first-write',
      },
    },
    llm_asserted: {
      summary: 'Phase 1B producer write-side foundation completed.',
      read_artifacts: ['docs/tasks/2026-05-17-001-feat-spec-first-optimization-phase1b-tasks.md'],
      key_decisions: ['Keep workflow_integrated false until workflow closeout calls the producer.'],
      deferred_follow_up: ['Phase 3 retention/prune lifecycle remains deferred.'],
      next_action: 'Run Phase 1B review.',
    },
    provider_untrusted: {
      readiness_status: 'degraded',
      summaries: ['graph facts not used as primary evidence'],
    },
    retention: {
      retention_status: 'lifecycle-deferred',
      artifact_category: 'spec-work-run-evidence',
      raw_log_retention_impact: 'none',
      redaction_status: 'none-required',
      owner: 'spec-work',
      expires_at: '2026-06-01T00:00:00.000Z',
    },
    artifact_path: '.spec-first/workflows/spec-work/spec-first/phase1b-smoke/run.json',
    warnings: [],
  };
}

describe('spec-work run artifact contract', () => {
  test('schema is producer-available while workflow integration remains explicit', () => {
    const schema = readJson(SCHEMA_PATH);

    expect(schema.title).toBe('spec-first spec-work run artifact producer-available contract');
    expect(schema.description).toContain('write-side contract');
    expect(schema['x-spec-first-contract-status']).toBe('producer_available');
    expect(schema['x-spec-first-producer']).toBe('internal spec-work-run-artifact write');
    expect(schema['x-spec-first-producer-available']).toBe(true);
    expect(schema['x-spec-first-workflow-integrated']).toBe(false);
    expect(schema['x-spec-first-runtime-path']).toBe(
      '.spec-first/workflows/spec-work/<workspace-slug>/<run-id>/run.json'
    );
    expect(schema['x-spec-first-boundary']).toContain('workflow integration false');
    expect(schema.properties.retention.properties.owner.type).toBe('string');
    expect(schema.properties.retention.properties.expires_at.type).toBe('string');
  });

  test('schema validates a Phase 1B producer-written run artifact sample', () => {
    const schema = readJson(SCHEMA_PATH);

    expect(validateAgainstSchema(schema, validArtifact()).errors).toEqual([]);
  });

  test('schema rejects artifacts that claim workflow integration before the workflow gate', () => {
    const schema = readJson(SCHEMA_PATH);
    const artifact = validArtifact();
    artifact.producer.workflow_integrated = true;

    expect(validateAgainstSchema(schema, artifact).errors).toContain(
      'root.producer.workflow_integrated: value true does not equal const false'
    );
  });

  test('schema caps persisted LLM prose fields to keep raw logs out of run evidence', () => {
    const schema = readJson(SCHEMA_PATH);
    const artifact = validArtifact();
    artifact.llm_asserted.summary = 'x'.repeat(1001);

    expect(validateAgainstSchema(schema, artifact).errors).toContain(
      'root.llm_asserted.summary: expected string length at most 1000, received 1001'
    );
  });

  test('schema rejects unknown LLM asserted fields', () => {
    const schema = readJson(SCHEMA_PATH);
    const artifact = validArtifact();
    artifact.llm_asserted.raw_log_dump = 'raw output';

    expect(validateAgainstSchema(schema, artifact).errors).toContain(
      'root.llm_asserted.raw_log_dump: unexpected additional key'
    );
  });

  test('schema rejects generated mirror and provider artifact path classes', () => {
    const schema = readJson(SCHEMA_PATH);
    const generatedMirrorArtifact = validArtifact();
    generatedMirrorArtifact.source_refs = ['.agents/skills/spec-work/SKILL.md'];
    const providerArtifact = validArtifact();
    providerArtifact.script_confirmed.artifact_refs = ['.spec-first/graph/provider-status.json'];

    expect(validateAgainstSchema(schema, generatedMirrorArtifact).errors.some((error) => (
      error.includes('root.source_refs[0]') && error.includes('does not match pattern')
    ))).toBe(true);
    expect(validateAgainstSchema(schema, providerArtifact).errors.some((error) => (
      error.includes('root.script_confirmed.artifact_refs[0]') && error.includes('does not match pattern')
    ))).toBe(true);
  });
});
