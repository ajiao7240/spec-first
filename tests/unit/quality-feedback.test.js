'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const { buildQualityFeedbackTopics } = require('../../src/verification/quality-feedback');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'quality-gates',
  'quality-feedback-topics.schema.json'
);

describe('quality feedback topics contract', () => {
  test('failed CRG gate checks become passive compound inputs', () => {
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
            check_id: 'crg-runtime-contracts',
            kind: 'unit-suite',
            passed: false,
            artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/crg-runtime-contracts.junit.json',
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
        topic_id: 'gate-check:crg-runtime-contracts',
        kind: 'failed-check',
        topic_key: 'crg-runtime-contracts',
        summary: 'Latest AI Dev Quality Gate failed check "crg-runtime-contracts".',
        scope_hint: 'crg-runtime-contracts',
        artifact_paths: ['.spec-first/workflows/quality-gates/ai-dev-quality-gate/crg-runtime-contracts.junit.json'],
        evidence_refs: [],
        tags: ['quality-gate', 'crg-runtime-contracts', 'unit-suite'],
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
            check_id: 'crg-runtime-contracts',
            kind: 'unit-suite',
            passed: true,
            artifact_path: '.spec-first/workflows/quality-gates/ai-dev-quality-gate/crg-runtime-contracts.junit.json',
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
