'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildTelemetryRecord, recordWorkflowTelemetry } = require('../../src/context-routing/telemetry');

describe('workflow telemetry', () => {
  test('每个 workflow 至少能写一条最小 telemetry', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-telemetry-'));

    try {
      const result = recordWorkflowTelemetry({
        repoRoot: tmpDir,
        workflow: 'spec-code-review',
        slug: 'demo',
        evaluation: {
          level: 'L1',
          selected_assets: ['minimal-context/review.json'],
          skipped_rules: ['fact.foo'],
          fallback_reason: 'minimal_context_missing',
          freshness_status: 'stale',
          verification_summary: {
            source: 'minimal-context',
            verification_gaps_to_check: ['confirm unit-tests'],
          },
          verifier_dispatch: {
            handoff_posture: 'manual-only',
            dispatch_candidates: [],
            manual_required_verifications: ['unit-tests'],
            manual_optional_verifications: [],
            dispatch_blockers: [],
          },
          ai_dev_quality_gate_result: {
            schema_version: 'v1',
            generated_at: '2026-04-18T13:20:00.000Z',
            gate_id: 'ai-dev-quality-gate',
            passed: true,
            checks: [],
            failures: [],
          },
          verification_evidence: {
            schema_version: 'v1',
            evidence_source: 'workflow-artifacts',
            evidence_items: [
              {
                evidence_ref: 'evidence://unit-tests/1',
                verifier: 'repo-test-command',
                gate_ids: ['unit-tests'],
                evidence_type: 'command-output',
                status: 'captured',
                artifact_path: '.spec-first/workflows/verification/demo/unit-tests.txt',
                captured_at: '2026-04-18T22:10:00.000Z',
                stage: 'review',
              },
            ],
          },
          verification_gate_state: {
            overall_status: 'satisfied',
          },
        },
      });

      expect(fs.existsSync(result.filePath)).toBe(true);
      expect(result.record.workflow).toBe('spec-code-review');
      expect(result.record.stage).toBe('review');
      expect(result.record.profile).toBe('review-default');
      expect(result.record.level).toBe('L1');
      expect(result.record.skipped_rules).toContain('fact.foo');
      expect(result.record.verification_summary).toEqual({
        source: 'minimal-context',
        verification_gaps_to_check: ['confirm unit-tests'],
      });
      expect(result.record.verifier_dispatch).toEqual({
        handoff_posture: 'manual-only',
        dispatch_candidates: [],
        manual_required_verifications: ['unit-tests'],
        manual_optional_verifications: [],
        dispatch_blockers: [],
      });
      expect(result.record.ai_dev_quality_gate_result).toEqual({
        schema_version: 'v1',
        generated_at: '2026-04-18T13:20:00.000Z',
        gate_id: 'ai-dev-quality-gate',
        passed: true,
        checks: [],
        failures: [],
      });
      expect(result.record.verification_evidence).toEqual({
        schema_version: 'v1',
        evidence_source: 'workflow-artifacts',
        evidence_items: [
          {
            evidence_ref: 'evidence://unit-tests/1',
            verifier: 'repo-test-command',
            gate_ids: ['unit-tests'],
            evidence_type: 'command-output',
            status: 'captured',
            artifact_path: '.spec-first/workflows/verification/demo/unit-tests.txt',
            captured_at: '2026-04-18T22:10:00.000Z',
            stage: 'review',
          },
        ],
      });
      expect(result.record.verification_gate_state).toEqual({
        overall_status: 'satisfied',
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('写入目录不可写时 recordWorkflowTelemetry 不抛出，返回 filePath: null', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-fail-'));
    try {
      const result = recordWorkflowTelemetry({
        repoRoot: '/nonexistent/path/that/cannot/be/created',
        workflow: 'spec-plan',
        slug: 'demo',
        evaluation: { selected_assets: [] },
      });
      expect(result.filePath).toBeNull();
      expect(result.record).toBeDefined();
      expect(result.record.workflow).toBe('spec-plan');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('不同 generatedAt 的两次调用写入不同文件名', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-multi-'));
    try {
      const r1 = recordWorkflowTelemetry({
        repoRoot: tmpDir,
        workflow: 'spec-work',
        slug: 'repo',
        evaluation: { selected_assets: [] },
        generatedAt: '2026-04-18T10:00:00.000Z',
      });
      const r2 = recordWorkflowTelemetry({
        repoRoot: tmpDir,
        workflow: 'spec-work',
        slug: 'repo',
        evaluation: { selected_assets: [] },
        generatedAt: '2026-04-18T10:00:01.000Z',
      });
      expect(r1.filePath).not.toBeNull();
      expect(r2.filePath).not.toBeNull();
      expect(r1.filePath).not.toBe(r2.filePath);
      expect(fs.existsSync(r1.filePath)).toBe(true);
      expect(fs.existsSync(r2.filePath)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('fallback 与 skipped reason 会进入 telemetry record', () => {
    const record = buildTelemetryRecord({
      workflow: 'spec-plan',
      slug: 'demo',
      evaluation: {
        stage: 'plan',
        profile: 'plan-default',
        selected_assets: [],
        skipped_rules: ['fact.bar'],
        fallback_reason: 'routing_missing',
      },
      freshnessStatus: 'unknown',
    });

    expect(record.stage).toBe('plan');
    expect(record.profile).toBe('plan-default');
    expect(record.fallback_reason).toBe('routing_missing');
    expect(record.skipped_rules).toContain('fact.bar');
  });
});
