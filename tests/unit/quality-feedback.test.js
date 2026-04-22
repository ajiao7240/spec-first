'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/bootstrap-compiler/schema-loader');
const { buildQualityFeedbackTopics } = require('../../src/context-routing/quality-feedback');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'quality-gates',
  'quality-feedback-topics.schema.json'
);

describe('quality feedback topics contract', () => {
  test('failed gate checks and failed evidence become passive compound inputs', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const contract = buildQualityFeedbackTopics({
      generatedAt: '2026-04-18T22:30:00.000Z',
      aiDevQualityGateResult: {
        schema_version: 'v1',
        generated_at: '2026-04-18T22:30:00.000Z',
        gate_id: 'ai-dev-quality-gate',
        passed: false,
        checks: [
          {
            check_id: 'stage0-contracts',
            kind: 'unit-suite',
            passed: false,
            artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/stage0-contracts.junit.json',
          },
        ],
      },
      verificationEvidence: {
        schema_version: 'v1',
        evidence_source: 'workflow-artifacts',
        evidence_items: [
          {
            evidence_ref: 'evidence://browser-smoke/failed-1',
            verifier: 'test-browser',
            gate_ids: ['browser-smoke'],
            evidence_type: 'browser-snapshot',
            status: 'failed',
            artifact_path: '.spec-first/workflows/verification/demo/browser-smoke.png',
            captured_at: '2026-04-18T22:25:00.000Z',
            stage: 'work',
          },
          {
            evidence_ref: 'evidence://unit-tests/1',
            verifier: 'repo-test-command',
            gate_ids: ['unit-tests'],
            evidence_type: 'command-output',
            status: 'captured',
            artifact_path: '.spec-first/workflows/verification/demo/unit-tests.txt',
            captured_at: '2026-04-18T22:20:00.000Z',
            stage: 'work',
          },
        ],
      },
      gateArtifactPath: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/ai-dev-quality-gate-result.json',
    });

    expect(validateAgainstSchema(schema, contract).errors).toEqual([]);
    expect(contract.latest_gate).toEqual({
      gate_id: 'ai-dev-quality-gate',
      passed: false,
      generated_at: '2026-04-18T22:30:00.000Z',
      artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/ai-dev-quality-gate-result.json',
    });
    expect(contract.candidate_topics).toEqual([
      {
        topic_id: 'gate-check:stage0-contracts',
        kind: 'failed-check',
        topic_key: 'stage0-contracts',
        summary: 'Latest AI Dev Quality Gate failed check "stage0-contracts".',
        scope_hint: 'stage0-contracts',
        artifact_paths: ['.spec-first/workflows/quality-gates/ai-dev-quality-gate/stage0-contracts.junit.json'],
        evidence_refs: [],
        tags: ['quality-gate', 'stage0-contracts', 'unit-suite'],
      },
      {
        topic_id: 'failed-evidence:evidence://browser-smoke/failed-1',
        kind: 'failed-evidence',
        topic_key: 'browser-smoke',
        summary: 'Verification evidence "evidence://browser-smoke/failed-1" recorded a failed verifier outcome.',
        scope_hint: 'browser-smoke',
        artifact_paths: ['.spec-first/workflows/verification/demo/browser-smoke.png'],
        evidence_refs: ['evidence://browser-smoke/failed-1'],
        tags: ['verification-evidence', 'test-browser', 'browser-smoke'],
      },
    ]);
  });

  test('successful gate keeps an empty candidate list instead of inventing workflow states', () => {
    const contract = buildQualityFeedbackTopics({
      generatedAt: '2026-04-18T22:40:00.000Z',
      aiDevQualityGateResult: {
        schema_version: 'v1',
        generated_at: '2026-04-18T22:40:00.000Z',
        gate_id: 'ai-dev-quality-gate',
        passed: true,
        checks: [
          {
            check_id: 'stage0-contracts',
            kind: 'unit-suite',
            passed: true,
            artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/stage0-contracts.junit.json',
          },
        ],
      },
      gateArtifactPath: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/ai-dev-quality-gate-result.json',
    });

    expect(contract.latest_gate).toEqual({
      gate_id: 'ai-dev-quality-gate',
      passed: true,
      generated_at: '2026-04-18T22:40:00.000Z',
      artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/ai-dev-quality-gate-result.json',
    });
    expect(contract.candidate_topics).toEqual([]);
  });
});
