'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildAuditReport, buildIssuesArtifact } = require('../../skills/spec-app-consistency-audit/scripts/merge-contracts');
const { renderHeadlessEnvelope } = require('../../skills/spec-app-consistency-audit/scripts/render-headless-envelope');
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
    claim_family: 'architecture_static',
    claim_type: 'route_guard_missing',
    affected_surface: { type: 'route', id: 'TradeRoute', file: 'Routes.kt' },
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
    validation_status: 'not_required',
    review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
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
            impact: 'Bearer bare.secret.token can leak in raw impact.',
            recommendation: 'Call https://internal.example.test/path?token=secret before proceeding.',
          }),
        ],
        rejected_issues: [
          issue({
            id: 'APP-AUDIT-REJECTED',
            title: 'Rejected issue',
            contract_status: 'rejected',
            static_confirmed: false,
            evidence_gate: {
              passed: false,
              reason: 'fixture_rejected',
              project_evidence_count: 0,
              rule_pack_evidence_count: 1,
            },
          }),
        ],
      }));

      const report = buildAuditReport({
        repoRoot: root,
        artifacts: [routePath, eqPath],
        issues: [issuesPath],
        pilotValidation: pilotPath,
        runId: '20260502-report-test',
      });

      expect(report.schema_version).toBe('spec-app-consistency-audit-report.v1');
      expect(report.issues.map((issue) => issue.id)).toEqual(['APP-AUDIT-HIGH', 'APP-AUDIT-LOW']);
      expect(report.section_coverage.page_routes).toBe(true);
      expect(report.section_coverage.engineering_quality).toBe(true);
      expect(report.regression_suggestions).toHaveLength(2);
      expect(report.rejected_issues.map((entry) => entry.id)).toContain('APP-AUDIT-REJECTED');
      expect(report.writeback_preview).toEqual(expect.objectContaining({
        mode: 'preview_only',
        auto_apply: false,
      }));
      expect(report.writeback_preview.paths).toEqual([
        '.spec-first/app-audit/runs/20260502-report-test/writeback-preview/repo-profile.patch.yaml',
        '.spec-first/app-audit/runs/20260502-report-test/writeback-preview/suggested-standards.md',
      ]);
      expect(JSON.stringify(report)).not.toContain('abc.def.ghi');
      expect(JSON.stringify(report)).not.toContain('bare.secret.token');
      expect(JSON.stringify(report)).not.toContain('token=secret');
      expect(JSON.stringify(report)).not.toContain('internal.example.test');
      expect(report.mvp_validation.pilot_validation.pilot_recorded).toBe(true);
      expect(validateArtifact(report).errors).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('headless envelope redacts absolute artifact paths from metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-headless-paths-'));
    try {
      const metadataPath = write(root, 'metadata.json', JSON.stringify({
        status: 'complete',
        run_id: 'headless-path-test',
        run_dir: path.join(root, '.spec-first/app-audit/runs/headless-path-test'),
        summary_path: path.join(root, '.spec-first/app-audit/runs/headless-path-test/app-consistency-audit.summary.md'),
        issues_path: path.join(root, '.spec-first/app-audit/runs/headless-path-test/issues.json'),
        audit_verdict_scope: 'source_only_app_static_audit',
      }));
      const reportPath = write(root, 'audit-report.json', JSON.stringify({
        issues: [],
        rejected_issues: [],
        scope_and_degraded_modes: [],
      }));

      const envelope = renderHeadlessEnvelope({ metadata: metadataPath, report: reportPath });

      expect(envelope).toContain('Artifact: <absolute-path:redacted>');
      expect(envelope).toContain('Summary: <absolute-path:redacted>');
      expect(envelope).toContain('Issues: <absolute-path:redacted>');
      expect(envelope).not.toContain(root);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('headless envelope does not mark degraded no-issue runs as ready', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-headless-degraded-'));
    try {
      const metadataPath = write(root, 'metadata.json', JSON.stringify({
        status: 'degraded',
        run_id: 'headless-degraded-test',
        run_dir: '.spec-first/app-audit/runs/headless-degraded-test',
        summary_path: '.spec-first/app-audit/runs/headless-degraded-test/app-consistency-audit.summary.md',
        issues_path: '.spec-first/app-audit/runs/headless-degraded-test/issues.json',
        audit_verdict_scope: 'source_only_app_static_audit',
      }));
      const reportPath = write(root, 'audit-report.json', JSON.stringify({
        issue_synthesis_status: 'not_run',
        issues: [],
        rejected_issues: [],
        scope_and_degraded_modes: [{ code: 'prd_and_figma_missing' }],
      }));

      const envelope = renderHeadlessEnvelope({ metadata: metadataPath, report: reportPath });

      expect(envelope).toContain('Issue synthesis status: not_run');
      expect(envelope).toContain('Verdict: Awaiting LLM audit');
      expect(envelope).toContain('Awaiting LLM audit:');
      expect(envelope).toContain('- Degraded modes: prd_and_figma_missing');
      expect(envelope).not.toContain('Verdict: Ready\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('normalizes issue path-like fields before report validation', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-report-paths-'));
    try {
      const routePath = write(root, 'route.json', JSON.stringify(artifact('page-route-contract', 'page-route-contract.v1')));
      const sourceFile = write(root, 'src/Analytics.kt', 'fun track() {}');
      const issuesPath = write(root, 'issues.json', JSON.stringify({
        issues: [issue({
          id: 'APP-AUDIT-PATHS',
          affected_surface: { type: 'event', id: 'trade_submit', file: sourceFile },
          provenance: [{ source: 'analytics', file: sourceFile, summary: 'See https://internal.example.test/path' }],
          evidence: { analytics: [{ file: sourceFile, summary: 'Cookie: session=secret' }] },
          runtime_verification: { required: true, level: 'simulator', reason: 'Authorization: Bearer abc.def.ghi' },
        })],
      }));

      const report = buildAuditReport({
        repoRoot: root,
        artifacts: [routePath],
        issues: [issuesPath],
      });
      const serialized = JSON.stringify(report);

      expect(validateArtifact(report).valid).toBe(true);
      expect(report.issues[0].affected_surface.file).toBe('src/Analytics.kt');
      expect(report.issues[0].evidence.analytics[0].file).toBe('src/Analytics.kt');
      expect(serialized).not.toContain(root);
      expect(serialized).not.toContain('internal.example.test');
      expect(serialized).not.toContain('Cookie: session');
      expect(serialized).not.toContain('abc.def.ghi');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('drops unknown raw issue fields before writing durable artifacts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-unknown-fields-'));
    try {
      const rawIssuesPath = write(root, 'issues.json', JSON.stringify({
        issues: [issue({
          id: 'APP-AUDIT-UNKNOWN-FIELDS',
          raw_log: 'Authorization: Bearer abc.def.ghi',
          debug_output: { url: 'https://internal.example.test/path?token=secret' },
          extra_notes: ['Cookie: session=secret'],
        })],
      }));

      const issuesArtifact = buildIssuesArtifact({
        repoRoot: root,
        issues: [rawIssuesPath],
      });
      const report = buildAuditReport({
        repoRoot: root,
        issues: [rawIssuesPath],
      });
      const serialized = JSON.stringify({ issuesArtifact, report });

      expect(validateArtifact(issuesArtifact).valid).toBe(true);
      expect(validateArtifact(report).valid).toBe(true);
      expect(issuesArtifact.issues[0]).not.toHaveProperty('raw_log');
      expect(issuesArtifact.issues[0]).not.toHaveProperty('debug_output');
      expect(issuesArtifact.issues[0]).not.toHaveProperty('extra_notes');
      expect(report.issues[0]).not.toHaveProperty('raw_log');
      expect(serialized).not.toContain('abc.def.ghi');
      expect(serialized).not.toContain('internal.example.test');
      expect(serialized).not.toContain('session=secret');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
