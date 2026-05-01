'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildAuditContext } = require('../../skills/spec-app-consistency-audit/scripts/build-audit-context');
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
      'codebase-contract.schema.json',
      'component-contract.schema.json',
      'engineering-quality-contract.schema.json',
      'figma-design-contract.schema.json',
      'i18n-contract.schema.json',
      'industry-profile.schema.json',
      'kmp-architecture-contract.schema.json',
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

  test('rejects confirmed script artifact unless explicitly allowed', () => {
    const artifact = validBase({ contract_status: 'confirmed' });

    expect(validateArtifact(artifact).errors.map((entry) => entry.code)).toContain('script_artifact_must_be_candidate');
    expect(validateArtifact(artifact, { requireCandidate: false }).valid).toBe(true);
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
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [],
    });

    expect(validateArtifact(report).valid).toBe(true);
    expect(validateArtifact({ ...report, issues: undefined }).errors.map((entry) => entry.code)).toContain('issues_array_required');
  });

  test('validates audit report issue protocol fields', () => {
    const report = validBase({
      schema_version: 'spec-app-consistency-audit-report.v1',
      artifact_id: 'audit-report',
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-001',
        title: 'Complete issue',
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
        impact: 'Route behavior may drift.',
        recommendation: 'Align route behavior.',
        related_rule_packs: ['common-app'],
        runtime_verification: { required: false },
        data_sensitivity: 'internal',
      }],
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
      summary: { blocker_count: 0 },
      scope_and_degraded_modes: [],
      issues: [{
        id: 'APP-AUDIT-003',
        title: 'Normalized issue',
        severity: 'medium',
        category: 'analytics',
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
        data_sensitivity: 'internal',
      }],
    });

    expect(validateArtifact(report).valid).toBe(true);
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
