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
        workflow: 'spec-review',
        slug: 'demo',
        evaluation: {
          selected_assets: ['minimal-context/review.json'],
          skipped_rules: ['fact.foo'],
          fallback_reason: 'minimal_context_missing',
          freshness_status: 'stale',
        },
      });

      expect(fs.existsSync(result.filePath)).toBe(true);
      expect(result.record.workflow).toBe('spec-review');
      expect(result.record.stage).toBe('review');
      expect(result.record.profile).toBe('review-default');
      expect(result.record.skipped_rules).toContain('fact.foo');
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
