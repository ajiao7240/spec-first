'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildAuditContext } = require('../../skills/spec-app-consistency-audit/scripts/build-audit-context');
const { sourceInputFromFile } = require('../../skills/spec-app-consistency-audit/scripts/lib/audit-utils');
const { runPreflight } = require('../../skills/spec-app-consistency-audit/scripts/preflight');
const {
  validateArtifact,
  validateArtifactFile,
} = require('../../skills/spec-app-consistency-audit/scripts/validate-artifacts');

function validBase(overrides = {}) {
  return {
    schema_version: 'example-artifact.v1',
    artifact_id: 'example',
    generated_at: '2026-05-01T00:00:00.000Z',
    source_inputs: [
      {
        type: 'code',
        path: '.',
        source_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        freshness: 'current-worktree',
      },
    ],
    consumers: ['expert-agents'],
    contract_status: 'candidate',
    data_sensitivity: 'internal',
    ...overrides,
  };
}

function makeRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-validate-'));
  fs.mkdirSync(path.join(repoRoot, 'shared/src/commonMain/kotlin'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'shared/src/commonMain/kotlin/App.kt'), 'class App');
  fs.writeFileSync(path.join(repoRoot, 'prd.md'), '# PRD\n');
  return repoRoot;
}

describe('spec-app-consistency-audit artifact validation', () => {
  test('ships schemas for app-audit contract artifacts consumed by validators', () => {
    const schemaDir = path.join(__dirname, '../../skills/spec-app-consistency-audit/schemas');
    const expected = [
      'analytics-contract.schema.json',
      'app-audit-context.schema.json',
      'artifact-manifest.schema.json',
      'audit-report.schema.json',
      'audit-plan.schema.json',
      'codebase-contract.schema.json',
      'component-contract.schema.json',
      'engineering-quality-contract.schema.json',
      'figma-design-contract.schema.json',
      'i18n-contract.schema.json',
      'impact-facts.schema.json',
      'industry-profile.schema.json',
      'issues.schema.json',
      'kmp-architecture-contract.schema.json',
      'metadata.schema.json',
      'merged-app-audit-context.schema.json',
      'module-contract.schema.json',
      'page-route-contract.schema.json',
      'product-contract.schema.json',
      'rule-pack-selection.schema.json',
    ];

    for (const fileName of expected) {
      const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, fileName), 'utf8'));

      expect(schema.$schema).toContain('json-schema.org');
      expect(schema.required).toEqual(expect.arrayContaining(['schema_version', 'artifact_id']));
    }
    const issueSchema = JSON.parse(fs.readFileSync(path.join(schemaDir, 'issue.schema.json'), 'utf8'));
    const reportSchema = JSON.parse(fs.readFileSync(path.join(schemaDir, 'audit-report.schema.json'), 'utf8'));
    const manifestSchema = JSON.parse(fs.readFileSync(path.join(schemaDir, 'artifact-manifest.schema.json'), 'utf8'));
    expect(issueSchema.$schema).toContain('json-schema.org');
    expect(issueSchema.required).toEqual(expect.arrayContaining([
      'claim_family',
      'claim_type',
      'affected_surface',
      'validation_status',
      'review_lifecycle',
    ]));
    expect(issueSchema.allOf).toEqual(expect.arrayContaining([
      expect.objectContaining({
        if: expect.objectContaining({
          properties: { contract_status: { const: 'confirmed' } },
        }),
      }),
      expect.objectContaining({
        if: expect.objectContaining({
          properties: { contract_status: { enum: ['candidate', 'rejected'] } },
        }),
      }),
    ]));
    expect(issueSchema.$defs.evidence_entry.anyOf).toEqual(expect.arrayContaining([
      { required: ['file'] },
      { required: ['artifact_id'] },
      { required: ['route'] },
    ]));
    expect(reportSchema.$defs.audit_issue.allOf).toHaveLength(2);
    expect(reportSchema.$defs.evidence_entry.anyOf).toEqual(expect.arrayContaining([
      { required: ['file'] },
      { required: ['artifact_id'] },
      { required: ['route'] },
    ]));
    const metadataSchema = JSON.parse(fs.readFileSync(path.join(schemaDir, 'metadata.schema.json'), 'utf8'));
    expect(metadataSchema.required).toEqual(expect.arrayContaining([
      'status',
      'status_reason_codes',
      'started_at',
    ]));
    expect(metadataSchema.properties.status.enum).toEqual(['started', 'complete', 'degraded', 'failed']);
    expect(manifestSchema.properties.artifacts.items.required).toEqual(expect.arrayContaining([
      'schema_version',
      'artifact_id',
      'consumers',
      'data_sensitivity',
    ]));
  });

  test('accepts valid metadata-only candidate artifact', () => {
    const result = validateArtifact(validBase());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects missing source freshness metadata', () => {
    const result = validateArtifact(validBase({
      source_inputs: [{ type: 'code', path: '.', freshness: 'current-worktree' }],
    }));

    expect(result.valid).toBe(false);
    expect(result.errors.map((entry) => entry.code)).toContain('source_hash_or_reason_required');
  });

  test('rejects unsafe source input provenance paths', () => {
    for (const unsafePath of [
      '../outside-secret.txt',
      '/tmp/outside.txt',
      'C:/tmp/outside.txt',
      '.env',
      'certs/prod.pem',
      '.spec-first/app-audit/runs/run/code.json',
      '.claude/agents/reviewer.md',
      '.git/config',
    ]) {
      const result = validateArtifact(validBase({
        source_inputs: [{
          type: 'code',
          path: unsafePath,
          source_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          freshness: 'current-worktree',
        }],
      }));

      expect(result.valid).toBe(false);
      expect(result.errors.map((entry) => entry.code)).toContain('unsafe_source_path');
    }

    expect(validateArtifact(validBase({
      source_inputs: [{
        type: 'code',
        path: '<outside-repo-file:abcdef123456>',
        source_hash_unavailable_reason: 'outside_repo',
        freshness: 'unavailable',
      }],
    })).valid).toBe(true);
  });

  test('redacts generated control paths when scripts create source provenance', () => {
    const repoRoot = makeRepo();
    try {
      const rawIssuesPath = path.join(repoRoot, '.spec-first/app-audit/runs/run/input/raw-issues.json');
      fs.mkdirSync(path.dirname(rawIssuesPath), { recursive: true });
      fs.writeFileSync(rawIssuesPath, '{"issues":[]}');

      const sourceInput = sourceInputFromFile('issues', rawIssuesPath, repoRoot);
      const result = validateArtifact(validBase({ source_inputs: [sourceInput] }));

      expect(sourceInput.path).toMatch(/^<issues:[a-f0-9]{12}>$/);
      expect(result.valid).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('rejects confirmed script artifact unless explicitly allowed', () => {
    const artifact = validBase({ contract_status: 'confirmed' });

    expect(validateArtifact(artifact).errors.map((entry) => entry.code)).toContain('script_artifact_must_be_candidate');
    expect(validateArtifact(artifact, { requireCandidate: false }).valid).toBe(true);
  });

  test('validates metadata lifecycle status fields', () => {
    const metadata = validBase({
      schema_version: 'spec-app-consistency-audit-metadata.v1',
      artifact_id: 'metadata',
      run_id: 'run',
      host: 'codex',
      mode: 'headless',
      head_sha: 'abc123',
      diff_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      diff_scope_kind: 'git_diff',
      worktree_fingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      audit_verdict_scope: 'source_only_app_static_audit',
      run_dir: '.spec-first/app-audit/runs/run',
      summary_path: '.spec-first/app-audit/runs/run/app-consistency-audit.summary.md',
      issues_path: '.spec-first/app-audit/runs/run/issues.json',
      status: 'started',
      status_reason_codes: [],
      started_at: '2026-05-03T00:00:00.000Z',
      coverage_capabilities: {},
      input_expectations: {},
    });
    const missingStatus = { ...metadata, status: undefined };
    const invalidStatus = { ...metadata, status: 'done' };

    expect(validateArtifact(metadata).valid).toBe(true);
    expect(validateArtifact(missingStatus).errors.map((entry) => entry.path)).toContain('status');
    expect(validateArtifact(invalidStatus).errors.map((entry) => entry.code)).toContain('invalid_metadata_status');
  });

  test('validates preflight-specific fields', () => {
    const repoRoot = makeRepo();
    try {
      const preflight = runPreflight({ repoRoot, source: repoRoot, prd: path.join(repoRoot, 'prd.md') });
      const result = validateArtifact(preflight);

      expect(result.valid).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('validates audit report-specific fields', () => {
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      issue_synthesis_status: 'not_run',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [],
      rejected_issues: [],
    });

    expect(validateArtifact(report).valid).toBe(true);
    expect(validateArtifact({ ...report, issues: undefined }).errors.map((entry) => entry.code)).toContain('issues_array_required');
    expect(validateArtifact({ ...report, issue_synthesis_status: undefined }).errors.map((entry) => entry.code))
      .toContain('issue_synthesis_status_required');
    expect(validateArtifact({ ...report, issue_synthesis_status: 'bogus_state' }).errors.map((entry) => entry.code))
      .toContain('invalid_issue_synthesis_status');
    const issuesArtifact = validBase({
      schema_version: 'spec-app-consistency-audit-issues.v1',
      artifact_id: 'issues',
      issue_synthesis_status: 'not_run',
      issues: [],
      rejected_issues: [],
      summary: { issue_count: 0, rejected_count: 0 },
    });
    expect(validateArtifact(issuesArtifact).valid).toBe(true);
    expect(validateArtifact({ ...issuesArtifact, issue_synthesis_status: undefined }).errors.map((entry) => entry.code))
      .toContain('issue_synthesis_status_required');
    expect(validateArtifact({ ...issuesArtifact, issue_synthesis_status: 'bogus_state' }).errors.map((entry) => entry.code))
      .toContain('invalid_issue_synthesis_status');
  });

  test('validates audit report issue protocol fields', () => {
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      issue_synthesis_status: 'fixture_provided',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-001',
        title: 'Complete issue',
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
        confidence: 0.85,
        provenance: [{ source: 'route', file: 'Routes.kt', summary: 'Route evidence.' }],
        evidence: { route: [{ file: 'Routes.kt', summary: 'Route evidence.' }] },
        impact: ['Route behavior may drift.'],
        recommendation: ['Align route behavior.'],
        related_rule_packs: ['common-app'],
        runtime_verification: { required: false },
        validation_status: 'not_required',
        review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
        data_sensitivity: 'internal',
      }],
      rejected_issues: [],
    });
    const broken = {
      ...report,
      issues: [{ id: 'APP-AUDIT-002', title: 'Broken issue', severity: 'medium' }],
    };

    expect(validateArtifact(report).valid).toBe(true);
    expect(validateArtifact(broken).errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'provenance_required',
      'evidence_required',
      'runtime_verification_required',
      'related_rule_packs_array_required',
    ]));
  });

  test('accepts normalized issue protocol with numeric confidence and array fields', () => {
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      issue_synthesis_status: 'fixture_provided',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-003',
        title: 'Normalized issue',
        severity: 'medium',
        category: 'analytics',
        claim_family: 'analytics_static',
        claim_type: 'missing_event',
        affected_surface: { type: 'event', id: 'trade_submit', file: 'Analytics.kt' },
        expert: 'analytics-expert',
        static_confirmed: true,
        requires_runtime_verification: false,
        requires_real_device: false,
        contract_status: 'confirmed',
        confidence: 0.91,
        provenance: [{ source: 'analytics', file: 'Analytics.kt', summary: 'Event evidence.' }],
        evidence: { analytics: [{ file: 'Analytics.kt', summary: 'Event evidence.' }] },
        impact: ['Critical funnel coverage may drift.'],
        recommendation: ['Align analytics event coverage with the product contract.'],
        related_rule_packs: ['analytics'],
        runtime_verification: { required: false },
        validation_status: 'not_required',
        review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
        data_sensitivity: 'internal',
      }],
      rejected_issues: [],
    });

    expect(validateArtifact(report).valid).toBe(true);
  });

  test('strict issue mode requires hardened issue protocol fields', () => {
    const strictReport = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      issue_synthesis_status: 'fixture_provided',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-004',
        title: 'Strict issue',
        severity: 'medium',
        category: 'analytics',
        claim_family: 'analytics_static',
        claim_type: 'missing_event',
        affected_surface: { type: 'event', id: 'trade_submit', file: 'Analytics.kt' },
        expert: 'analytics-expert',
        static_confirmed: true,
        requires_runtime_verification: false,
        requires_real_device: false,
        contract_status: 'confirmed',
        confidence: 0.91,
        provenance: [{ source: 'analytics', file: 'Analytics.kt', summary: 'Event evidence.' }],
        evidence: { analytics: [{ file: 'Analytics.kt', summary: 'Event evidence.' }] },
        impact: ['Critical funnel coverage may drift.'],
        recommendation: ['Align analytics event coverage with the product contract.'],
        related_rule_packs: ['analytics'],
        runtime_verification: { required: false },
        validation_status: 'not_required',
        review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
        data_sensitivity: 'internal',
      }],
      rejected_issues: [],
    });
    const broken = {
      ...strictReport,
      issues: [{ ...strictReport.issues[0], claim_family: undefined }],
    };

    expect(validateArtifact(strictReport, { strictIssues: true }).valid).toBe(true);
    expect(validateArtifact(broken, { strictIssues: true }).errors.map((entry) => entry.code)).toContain('string_required');
  });

  test('rejects static_confirmed and contract_status mismatches', () => {
    const baseIssue = {
      id: 'APP-AUDIT-STATUS-MISMATCH',
      title: 'Status mismatch',
      severity: 'medium',
      category: 'analytics',
      claim_family: 'analytics_static',
      claim_type: 'missing_event',
      affected_surface: { type: 'event', id: 'trade_submit', file: 'Analytics.kt' },
      expert: 'analytics-expert',
      static_confirmed: true,
      requires_runtime_verification: false,
      requires_real_device: false,
      contract_status: 'candidate',
      confidence: 0.6,
      provenance: [{ source: 'analytics', file: 'Analytics.kt', summary: 'Event evidence.' }],
      evidence: { analytics: [{ file: 'Analytics.kt', summary: 'Event evidence.' }] },
      impact: ['Candidate impact.'],
      recommendation: ['Review the candidate.'],
      related_rule_packs: ['analytics'],
      runtime_verification: { required: false },
      validation_status: 'not_required',
      review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
      data_sensitivity: 'internal',
    };
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      issue_synthesis_status: 'fixture_provided',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [baseIssue],
      rejected_issues: [{ ...baseIssue, id: 'APP-AUDIT-REJECTED-MISMATCH', contract_status: 'rejected' }],
    });
    const errors = validateArtifact(report).errors;

    expect(errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'static_confirmed_contract_status_mismatch',
    ]));
    expect(errors.filter((entry) => entry.code === 'static_confirmed_contract_status_mismatch')).toHaveLength(2);
  });

  test('strict issue mode rejects empty evidence and provenance entries without traceable fields', () => {
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      issue_synthesis_status: 'fixture_provided',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-EMPTY-EVIDENCE',
        title: 'Empty evidence issue',
        severity: 'medium',
        category: 'analytics',
        claim_family: 'analytics_static',
        claim_type: 'missing_event',
        affected_surface: { type: 'event', id: 'trade_submit', file: 'Analytics.kt' },
        expert: 'analytics-expert',
        static_confirmed: true,
        requires_runtime_verification: false,
        requires_real_device: false,
        contract_status: 'confirmed',
        confidence: 0.91,
        provenance: [{}],
        evidence: { analytics: [{}] },
        impact: ['Critical funnel coverage may drift.'],
        recommendation: ['Align analytics event coverage with the product contract.'],
        related_rule_packs: ['analytics'],
        runtime_verification: { required: false },
        validation_status: 'not_required',
        review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
        data_sensitivity: 'internal',
      }],
      rejected_issues: [],
    });
    const result = validateArtifact(report);

    expect(result.valid).toBe(false);
    expect(result.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'evidence_source_required',
      'evidence_trace_required',
    ]));
    expect(result.errors.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'issues[0].provenance[0]',
      'issues[0].provenance[0].source',
      'issues[0].evidence.analytics[0]',
    ]));
  });

  test('validates rejected issues in report and issues artifacts with strict issue fields', () => {
    const validIssue = {
      id: 'APP-AUDIT-REJECTED',
      title: 'Rejected issue',
      severity: 'medium',
      category: 'analytics',
      claim_family: 'analytics_static',
      claim_type: 'missing_event',
      affected_surface: { type: 'event', id: 'trade_submit', file: 'Analytics.kt' },
      expert: 'analytics-expert',
      static_confirmed: false,
      requires_runtime_verification: false,
      requires_real_device: false,
      contract_status: 'rejected',
      confidence: 0.4,
      provenance: [{ source: 'analytics', file: 'Analytics.kt', summary: 'Event evidence.' }],
      evidence: { analytics: [{ file: 'Analytics.kt', summary: 'Event evidence.' }] },
      impact: ['Rejected impact.'],
      recommendation: ['Rejected recommendation.'],
      related_rule_packs: ['analytics'],
      runtime_verification: { required: false },
      validation_status: 'not_required',
      review_lifecycle: [{ stage: 'deterministic_evidence_gate', action: 'rejected', reason_code: 'fixture' }],
      data_sensitivity: 'internal',
    };
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      issue_synthesis_status: 'fixture_provided',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [],
      rejected_issues: [validIssue],
    });
    const issuesArtifact = validBase({
      schema_version: 'spec-app-consistency-audit-issues.v1',
      artifact_id: 'issues',
      issues: [],
      rejected_issues: [{ id: 'broken' }],
      summary: { rejected_count: 1 },
    });

    expect(validateArtifact(report).valid).toBe(true);
    expect(validateArtifact(issuesArtifact).errors.map((entry) => entry.path)).toContain('rejected_issues[0].title');
  });

  test('rejects unredacted strict issue text in final report artifacts', () => {
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-SECRET',
        title: 'Secret issue',
        severity: 'medium',
        category: 'analytics',
        claim_family: 'analytics_static',
        claim_type: 'missing_event',
        affected_surface: { type: 'event', id: 'trade_submit', file: 'Analytics.kt' },
        expert: 'analytics-expert',
        static_confirmed: true,
        requires_runtime_verification: false,
        requires_real_device: false,
        contract_status: 'confirmed',
        confidence: 0.8,
        provenance: [{ source: 'analytics', file: 'Analytics.kt', summary: 'Event evidence.' }],
        evidence: { analytics: [{ file: 'Analytics.kt', summary: 'Event evidence.' }] },
        impact: ['Calls https://internal.example.test/path?token=secret'],
        recommendation: ['Authorization: Bearer abc.def.ghi'],
        related_rule_packs: ['analytics'],
        runtime_verification: { required: false },
        validation_status: 'not_required',
        review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
        data_sensitivity: 'internal',
      }],
      rejected_issues: [],
    });
    const errors = validateArtifact(report).errors.map((entry) => entry.code);

    expect(errors).toEqual(expect.arrayContaining([
      'artifact_text_not_redacted',
    ]));
  });

  test('rejects unredacted strict issue evidence, provenance, runtime reason, and absolute paths', () => {
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-EVIDENCE-SECRET',
        title: 'Evidence secret issue',
        severity: 'medium',
        category: 'analytics',
        claim_family: 'analytics_static',
        claim_type: 'missing_event',
        affected_surface: { type: 'event', id: 'trade_submit', file: '/Users/example/private/Analytics.kt' },
        expert: 'analytics-expert',
        static_confirmed: true,
        requires_runtime_verification: true,
        requires_real_device: false,
        contract_status: 'confirmed',
        confidence: 0.8,
        provenance: [{ source: 'analytics', file: '/Users/example/private/Analytics.kt', summary: 'See https://internal.example.test/path' }],
        evidence: { analytics: [{ file: '/Users/example/private/Analytics.kt', summary: 'Cookie: session=secret' }] },
        impact: ['Critical funnel coverage may drift.'],
        recommendation: ['Align analytics event coverage with the product contract.'],
        related_rule_packs: ['analytics'],
        runtime_verification: { required: true, level: 'simulator', reason: 'Authorization: Bearer abc.def.ghi' },
        validation_status: 'not_required',
        review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
        data_sensitivity: 'internal',
      }],
      rejected_issues: [],
    });
    const result = validateArtifact(report);

    expect(result.valid).toBe(false);
    expect(result.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'artifact_text_not_redacted',
      'artifact_path_not_public',
    ]));
    expect(result.errors.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'issues[0].affected_surface.file',
      'issues[0].provenance[0].summary',
      'issues[0].evidence.analytics[0].summary',
      'issues[0].runtime_verification.reason',
    ]));
  });

  test('validates known app-audit contract fields by artifact_id', () => {
    const figma = validBase({
      schema_version: 'figma-design-contract.v1',
      artifact_id: 'figma-design-contract',
      raw_label_policy: 'internal',
      screens: [],
      components: [],
    });
    const broken = {
      ...figma,
      screens: undefined,
    };

    expect(validateArtifact(figma).valid).toBe(true);
    expect(validateArtifact(broken).errors.map((entry) => entry.code)).toContain('array_required');
  });

  test('rejects manifest and audit context artifact_count drift', () => {
    const manifest = validBase({
      schema_version: 'spec-app-consistency-audit-artifact-manifest.v1',
      artifact_id: 'artifact-manifest',
      run_id: 'run',
      run_dir: '.spec-first/app-audit/runs/run',
      artifact_count: 2,
      artifacts: [{
        path: 'metadata.json',
        schema_version: 'spec-app-consistency-audit-metadata.v1',
        artifact_id: 'metadata',
        producer: 'build-run-metadata.js',
        consumers: ['parent-workflow'],
        sha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        freshness: 'current-worktree',
        data_sensitivity: 'internal',
        contract_status: 'candidate',
      }],
    });
    const context = validBase({
      schema_version: 'spec-app-consistency-audit-context.v1',
      artifact_id: 'app-audit-context',
      artifacts_dir: '.spec-first/app-audit/runs/run',
      artifact_count: 2,
      valid: true,
      artifacts: [{ artifact_id: 'metadata' }],
      validation: [],
    });

    expect(validateArtifact(manifest).errors.map((entry) => entry.code)).toContain('artifact_count_mismatch');
    expect(validateArtifact(context).errors.map((entry) => entry.code)).toContain('artifact_count_mismatch');
  });

  test('requires manifest entries to include consumer-facing contract metadata', () => {
    const manifest = validBase({
      schema_version: 'spec-app-consistency-audit-artifact-manifest.v1',
      artifact_id: 'artifact-manifest',
      run_id: 'run',
      run_dir: '.spec-first/app-audit/runs/run',
      artifact_count: 1,
      artifacts: [{
        path: 'metadata.json',
        producer: 'build-run-metadata.js',
        sha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        freshness: 'current-worktree',
        contract_status: 'candidate',
      }],
    });

    expect(validateArtifact(manifest).errors.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'artifacts[0].schema_version',
      'artifacts[0].artifact_id',
      'artifacts[0].consumers',
      'artifacts[0].data_sensitivity',
    ]));
  });

  test('rejects unredacted sensitive Figma raw labels and text in contract artifacts', () => {
    const figma = validBase({
      schema_version: 'figma-design-contract.v1',
      artifact_id: 'figma-design-contract',
      raw_label_policy: 'internal',
      screens: [{
        id: 'screen',
        name: 'https://internal.example.test/design',
        texts: [{ text: 'Authorization: Bearer abc.def.ghi' }],
        components: [{ raw_label: 'Cookie: session=secret' }],
      }],
      components: [],
    });
    const result = validateArtifact(figma);

    expect(result.valid).toBe(false);
    expect(result.errors.map((entry) => entry.code)).toContain('artifact_text_not_redacted');
    expect(result.errors.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'screens[0].name',
      'screens[0].texts[0].text',
      'screens[0].components[0].raw_label',
    ]));
  });

  test('validates artifact files and builds context from artifact directory', () => {
    const repoRoot = makeRepo();
    const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-artifacts-'));
    try {
      const preflight = runPreflight({ repoRoot, source: repoRoot, prd: path.join(repoRoot, 'prd.md') });
      const preflightPath = path.join(artifactsDir, 'preflight.json');
      fs.writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`);
      fs.writeFileSync(path.join(artifactsDir, 'broken.json'), '{"artifact_id":');

      expect(validateArtifactFile(preflightPath).valid).toBe(true);

      const context = buildAuditContext({ artifactsDir });

      expect(context.schema_version).toBe('spec-app-consistency-audit-context.v1');
      expect(context.artifact_id).toBe('app-audit-context');
      expect(context.artifact_count).toBe(1);
      expect(context.valid).toBe(false);
      expect(context.artifacts[0]).toEqual(expect.objectContaining({
        artifact_id: 'preflight',
        file: 'preflight.json',
      }));
      expect(context.degraded_modes[0]).toEqual(expect.objectContaining({
        code: 'invalid_artifact',
        path: 'broken.json',
      }));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  });
});
