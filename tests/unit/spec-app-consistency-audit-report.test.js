'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildAuditReport } = require('../../skills/spec-app-consistency-audit/scripts/merge-contracts');
const { validateArtifact } = require('../../skills/spec-app-consistency-audit/scripts/validate-artifacts');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function artifact(artifactId, schemaVersion, extra = {}) {
  return {
    schema_version: schemaVersion,
    artifact_id: artifactId,
    generated_at: '2026-05-01T00:00:00.000Z',
    source_inputs: [{
      type: 'code',
      path: '.',
      source_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      freshness: 'current-worktree',
    }],
    consumers: ['expert-agents'],
    contract_status: 'candidate',
    data_sensitivity: 'internal',
    degraded_modes: [],
    ...extra,
  };
}

function issue(overrides = {}) {
  return {
    id: 'APP-AUDIT-ISSUE',
    title: 'Issue',
    severity: 'medium',
    category: 'page_route',
    expert: 'page-route-expert',
    static_confirmed: true,
    requires_runtime_verification: false,
    requires_real_device: false,
    contract_status: 'confirmed',
    confidence: 'high',
    provenance: [{ source: 'route', file: 'Routes.kt', summary: 'Route evidence.' }],
    evidence: { route: [{ file: 'Routes.kt', summary: 'Route evidence.' }] },
    impact: 'User-visible App consistency may drift.',
    recommendation: 'Align route behavior with the product contract.',
    related_rule_packs: ['common-app'],
    runtime_verification: { required: false, reason: 'Static evidence is sufficient.' },
    data_sensitivity: 'internal',
    ...overrides,
  };
}

describe('spec-app-consistency-audit report generation', () => {
  test('builds report with sorted issues, section coverage, regression suggestions, and preview writeback', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-report-'));
    try {
      const routePath = write(root, 'route.json', JSON.stringify(artifact('page-route-contract', 'page-route-contract.v1')));
      const eqPath = write(root, 'eq.json', JSON.stringify(artifact('engineering-quality-contract', 'engineering-quality-contract.v1')));
      const pilotPath = write(root, 'pilot.json', JSON.stringify({
        sample_type: 'historical_app',
        confirmed_issue_count: 1,
        rejected_issue_count: 0,
        advisory_issue_count: 1,
        manual_confirmation_rate: 1,
        false_positive_reasons: [],
        pre_runtime_fixable_count: 1,
        rule_pack_only_hits_downgraded: true,
      }));
      const issuesPath = write(root, 'issues.json', JSON.stringify({
        issues: [
          issue({
            id: 'APP-AUDIT-LOW',
            title: 'Low issue',
            severity: 'low',
            category: 'i18n',
            expert: 'i18n-expert',
            provenance: [
              { source: 'prd', file: 'prd.md', summary: 'copy required' },
              { source: 'figma', file: 'figma.json', summary: 'frame uses copy' },
              { source: 'i18n', file: 'strings.xml', summary: 'key mismatch' },
            ],
            evidence: {
              prd: [{ file: 'prd.md', summary: 'copy required' }],
              figma: [{ file: 'figma.json', summary: 'frame uses copy' }],
              i18n: [{ file: 'strings.xml', summary: 'key mismatch' }],
            },
          }),
          issue({
            id: 'APP-AUDIT-HIGH',
            title: 'High issue',
            severity: 'high',
            category: 'page_route',
            evidence: { route: [{ file: 'Routes.kt', summary: 'missing guard' }] },
          }),
        ],
      }));

      const report = buildAuditReport({
        repoRoot: root,
        artifacts: [routePath, eqPath],
        issues: [issuesPath],
        pilotValidation: pilotPath,
      });

      expect(report.schema_version).toBe('spec-app-consistency-audit-report.v1');
      expect(report.issues.map((issue) => issue.id)).toEqual(['APP-AUDIT-HIGH', 'APP-AUDIT-LOW']);
      expect(report.section_coverage.page_routes).toBe(true);
      expect(report.section_coverage.engineering_quality).toBe(true);
      expect(report.regression_suggestions).toHaveLength(2);
      expect(report.writeback_preview).toEqual(expect.objectContaining({
        mode: 'preview_only',
        auto_apply: false,
      }));
      expect(report.mvp_validation.pilot_validation.pilot_recorded).toBe(true);
      expect(validateArtifact(report).valid).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
