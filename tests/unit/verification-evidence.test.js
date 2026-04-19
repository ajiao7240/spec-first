'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/bootstrap-compiler/schema-loader');
const {
  loadVerificationEvidence,
  mergeVerificationEvidence,
} = require('../../src/context-routing/verification-evidence');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'verifiers',
  'verification-evidence.schema.json'
);

describe('verification evidence contract', () => {
  test('schema validates captured verifier evidence filtered to current effective gates', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verification-evidence-'));

    try {
      const artifactDir = path.join(tmpDir, '.spec-first', 'workflows', 'verification', 'demo');
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, 'verification-evidence.json'), JSON.stringify({
        schema_version: 'v1',
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
          {
            evidence_ref: 'evidence://unit-tests/1',
            verifier: 'repo-test-command',
            gate_ids: ['unit-tests'],
            evidence_type: 'command-output',
            status: 'captured',
            artifact_path: '.spec-first/workflows/verification/demo/unit-tests.txt',
            captured_at: '2026-04-18T22:11:00.000Z',
            stage: 'work',
          },
        ],
      }, null, 2));

      const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
      const evidence = loadVerificationEvidence({
        repoRoot: tmpDir,
        slug: 'demo',
        stage: 'work',
        verificationSummary: {
          stage: 'work',
          required_verifications: ['browser-smoke'],
          optional_verifications: ['browser-evidence'],
        },
      });

      expect(validateAgainstSchema(schema, evidence).errors).toEqual([]);
      expect(evidence).toEqual({
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
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('workspace merge keeps unique evidence references across repos', () => {
    const merged = mergeVerificationEvidence([
      {
        schema_version: 'v1',
        evidence_source: 'workflow-artifacts',
        evidence_items: [
          {
            evidence_ref: 'evidence://browser-smoke/1',
            verifier: 'test-browser',
            gate_ids: ['browser-smoke'],
            evidence_type: 'browser-snapshot',
            status: 'captured',
            artifact_path: 'a/browser-smoke.png',
            captured_at: '2026-04-18T22:10:00.000Z',
            stage: 'work',
          },
        ],
      },
      {
        schema_version: 'v1',
        evidence_source: 'workflow-artifacts',
        evidence_items: [
          {
            evidence_ref: 'evidence://browser-smoke/1',
            verifier: 'test-browser',
            gate_ids: ['browser-evidence'],
            evidence_type: 'browser-snapshot',
            status: 'captured',
            artifact_path: 'a/browser-smoke.png',
            captured_at: '2026-04-18T22:10:00.000Z',
            stage: 'review',
          },
        ],
      },
    ]);

    expect(merged).toEqual({
      schema_version: 'v1',
      evidence_source: 'workflow-artifacts',
      evidence_items: [
        {
          evidence_ref: 'evidence://browser-smoke/1',
          verifier: 'test-browser',
          gate_ids: ['browser-smoke', 'browser-evidence'],
          evidence_type: 'browser-snapshot',
          status: 'captured',
          artifact_path: 'a/browser-smoke.png',
          captured_at: '2026-04-18T22:10:00.000Z',
          stage: 'work',
        },
      ],
    });
  });
});
