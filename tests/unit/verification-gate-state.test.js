'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/bootstrap-compiler/schema-loader');
const { buildVerificationGateState } = require('../../src/context-routing/verification-gate-state');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'verifiers',
  'verification-gate-state.schema.json'
);

describe('verification gate state contract', () => {
  test('schema validates runtime-inferred work state with dispatch blockers', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const gateState = buildVerificationGateState({
      stage: 'work',
      verificationSummary: {
        stage: 'work',
        required_verifications: ['unit-tests', 'browser-smoke'],
        optional_verifications: ['browser-evidence'],
      },
      verifierDispatch: {
        handoff_posture: 'blocked',
        dispatch_candidates: [
          {
            verifier: 'test-browser',
            posture: 'blocked',
            target_required_verifications: ['browser-smoke'],
            target_optional_verifications: ['browser-evidence'],
            evidence_outputs: ['browser-snapshot', 'console-errors'],
          },
        ],
        manual_required_verifications: ['unit-tests'],
        manual_optional_verifications: [],
        dispatch_blockers: [
          {
            verifier: 'test-browser',
            target_verifications: ['browser-smoke', 'browser-evidence'],
            setup_hint: 'spec:mcp-setup',
            prerequisite: 'agent-browser',
            kind: 'missing-command',
            reason: 'command-not-found-in-path',
            detail: 'agent-browser is not available in PATH.',
          },
        ],
      },
    });

    expect(validateAgainstSchema(schema, gateState).errors).toEqual([]);
    expect(gateState).toMatchObject({
      overall_status: 'blocked',
      required_gates: [
        expect.objectContaining({
          gate_id: 'unit-tests',
          status: 'pending',
          fulfillment_mode: 'repo-command',
        }),
        expect.objectContaining({
          gate_id: 'browser-smoke',
          status: 'blocked',
          fulfillment_mode: 'verifier-skill',
          verifier: 'test-browser',
        }),
      ],
      optional_evidence: [
        expect.objectContaining({
          gate_id: 'browser-evidence',
          status: 'blocked',
        }),
      ],
      ci_gate: {
        status: 'blocked',
        required_gate_count: 2,
        blocked_required_gate_count: 1,
        satisfied_required_gate_count: 0,
      },
    });
  });

  test('review stage keeps evidence state as pending until proof is attached', () => {
    const gateState = buildVerificationGateState({
      stage: 'review',
      verificationSummary: {
        stage: 'review',
        recommended_required_verifications: ['browser-smoke'],
        recommended_optional_verifications: ['browser-evidence'],
      },
      verifierDispatch: {
        handoff_posture: 'dispatch-ready',
        dispatch_candidates: [
          {
            verifier: 'test-browser',
            posture: 'dispatch-ready',
            target_required_verifications: ['browser-smoke'],
            target_optional_verifications: ['browser-evidence'],
            evidence_outputs: ['browser-snapshot', 'console-errors'],
          },
        ],
        manual_required_verifications: [],
        manual_optional_verifications: [],
        dispatch_blockers: [],
      },
    });

    expect(gateState).toMatchObject({
      overall_status: 'pending',
      required_gates: [
        expect.objectContaining({
          gate_id: 'browser-smoke',
          status: 'pending',
          fulfillment_mode: 'verifier-skill',
          verifier: 'test-browser',
        }),
      ],
      optional_evidence: [
        expect.objectContaining({
          gate_id: 'browser-evidence',
          status: 'pending',
        }),
      ],
      ci_gate: {
        status: 'pending',
        required_gate_count: 1,
        blocked_required_gate_count: 0,
        satisfied_required_gate_count: 0,
      },
    });
  });

  test('captured evidence satisfies required gates and fills evidence locations', () => {
    const gateState = buildVerificationGateState({
      stage: 'work',
      verificationSummary: {
        stage: 'work',
        required_verifications: ['browser-smoke'],
        optional_verifications: ['browser-evidence'],
      },
      verifierDispatch: {
        handoff_posture: 'dispatch-ready',
        dispatch_candidates: [
          {
            verifier: 'test-browser',
            posture: 'dispatch-ready',
            target_required_verifications: ['browser-smoke'],
            target_optional_verifications: ['browser-evidence'],
            evidence_outputs: ['browser-snapshot', 'console-errors'],
          },
        ],
        manual_required_verifications: [],
        manual_optional_verifications: [],
        dispatch_blockers: [],
      },
      verificationEvidence: {
        schema_version: 'v1',
        evidence_source: 'workflow-artifacts',
        evidence_items: [
          {
            evidence_ref: 'evidence://browser-smoke/1',
            verifier: 'test-browser',
            gate_ids: ['browser-smoke', 'browser-evidence'],
            evidence_type: 'browser-snapshot',
            status: 'captured',
            artifact_path: '.spec-first/workflows/verification/demo/browser-smoke.png',
            captured_at: '2026-04-18T22:10:00.000Z',
            stage: 'work',
          },
        ],
      },
    });

    expect(gateState).toMatchObject({
      overall_status: 'satisfied',
      required_gates: [
        expect.objectContaining({
          gate_id: 'browser-smoke',
          status: 'satisfied',
          evidence_locations: ['evidence://browser-smoke/1'],
        }),
      ],
      optional_evidence: [
        expect.objectContaining({
          gate_id: 'browser-evidence',
          status: 'satisfied',
          evidence_locations: ['evidence://browser-smoke/1'],
        }),
      ],
      evidence_locations: ['evidence://browser-smoke/1'],
      ci_gate: {
        status: 'satisfied',
        required_gate_count: 1,
        blocked_required_gate_count: 0,
        satisfied_required_gate_count: 1,
      },
    });
  });
});
