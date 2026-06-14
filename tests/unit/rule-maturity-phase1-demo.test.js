'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInternal } = require('../../src/cli/commands/internal');
const {
  buildRuleMaturityPhase1GateFacts,
  renderRuleMaturityPhase1GateMarkdown,
} = require('../../src/cli/helpers/rule-maturity');
const { writeAuditArtifacts } = require('../../skills/spec-skill-audit/scripts/write-audit-artifacts');

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createFixtureRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-maturity-phase1-demo-'));
  write(path.join(repoRoot, 'package.json'), JSON.stringify({ name: 'spec-first' }));
  write(path.join(repoRoot, 'skills', 'good-skill', 'SKILL.md'), [
    '---',
    'name: good-skill',
    'description: Audit a local skill with clear trigger and boundary behavior.',
    '---',
    '',
    '# Good Skill',
    '',
    '## Purpose',
    '',
    'Audit a local skill.',
    '',
    '## When To Use',
    '',
    '- review local skill quality',
    '',
    '## When Not To Use',
    '',
    '- install third-party skills',
    '',
    '## Inputs',
    '',
    '- `skills/good-skill/SKILL.md`',
    '',
    '## Outputs',
    '',
    '- `.spec-first/audits/skill-audit/latest/skill-source-inventory.json`',
    '',
    '## Workflow',
    '',
    'Collect facts and let the LLM decide.',
    '',
    '## Failure Modes',
    '',
    'Report missing inputs.',
    '',
  ].join('\n'));
  return repoRoot;
}

function captureStdout(fn) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    const code = fn();
    const stdout = outputSpy.mock.calls.map((call) => String(call[0])).join('');
    return { code, json: JSON.parse(stdout) };
  } finally {
    outputSpy.mockRestore();
  }
}

function runInternalJson(args) {
  return captureStdout(() => runInternal(args));
}

describe('rule maturity phase 1 minimal demo', () => {
  let repoRoot;

  beforeEach(() => {
    repoRoot = createFixtureRepo();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test('records, lists, writes audit observations, and derives a phase gate decision', () => {
    const firstRecord = runInternalJson([
      'rule-maturity',
      'record',
      '--repo', repoRoot,
      '--rule-id', 'review-missing-contract-test',
      '--workflow', 'spec-code-review',
      '--evidence-ref', 'docs/validation/review.md#F1',
      '--reason-code', 'missing-contract-test',
      '--json',
    ]);
    const secondRecord = runInternalJson([
      'rule-maturity',
      'record',
      '--repo', repoRoot,
      '--rule-id', 'review-missing-contract-test',
      '--workflow', 'spec-plan',
      '--evidence-ref', 'docs/plans/example.md#depth',
      '--reason-code', 'planning-depth-override',
      '--json',
    ]);

    expect(firstRecord.code).toBe(0);
    expect(secondRecord.code).toBe(0);

    const list = runInternalJson([
      'rule-maturity',
      'list',
      '--repo', repoRoot,
      '--json',
    ]);
    expect(list.code).toBe(0);
    expect(list.json).toEqual(expect.objectContaining({
      schema_version: 'rule-maturity-list.v1',
      status: 'ok',
      reason_code: 'rule-maturity-collected',
    }));

    const auditRun = writeAuditArtifacts({
      repoRoot,
      includeGovernance: false,
      includeRuntime: false,
      runId: 'rule-maturity-phase1-demo',
    });
    const observationsRef = path.join(auditRun.run_dir, 'rule-maturity-observations.json');
    const observations = JSON.parse(fs.readFileSync(path.join(repoRoot, observationsRef), 'utf8'));
    expect(observations).toEqual(expect.objectContaining({
      schema_version: 'rule-maturity-observations.v1',
      status: 'ok',
      rule_count: 1,
      shadow_hit_count: 2,
      workflow_distribution: {
        'spec-code-review': 1,
        'spec-plan': 1,
      },
    }));

    const gateWithoutOwner = buildRuleMaturityPhase1GateFacts({
      asOf: '2026-06-14T00:00:00.000Z',
      list: list.json,
      observations,
      sourceRefs: [
        'spec-first internal rule-maturity list --json',
        observationsRef,
      ],
    });
    expect(gateWithoutOwner).toEqual(expect.objectContaining({
      status_class: 'candidate_density',
      recommended_next_action: 'continue-phase1',
      reason_codes: ['phase1-owner-cadence-not-confirmed'],
    }));

    const gate = buildRuleMaturityPhase1GateFacts({
      asOf: '2026-06-14T00:00:00.000Z',
      list: list.json,
      observations,
      sourceRefs: [
        'spec-first internal rule-maturity list --json',
        observationsRef,
      ],
      ownerCadenceDecision: {
        status: 'confirmed',
        reviewer: 'repo-maintainer',
        cadence: 'weekly for two phase-gate reviews',
        trigger: 'phase 1 review checkpoint',
        minimum_sample: 2,
        fallback: 'continue-phase1',
      },
    });

    expect(gate).toEqual(expect.objectContaining({
      schema_version: 'rule-maturity-phase1-gate-facts.v1',
      as_of: '2026-06-14T00:00:00.000Z',
      source_refs: [
        'spec-first internal rule-maturity list --json',
        observationsRef,
      ],
      status_class: 'candidate_density',
      rule_count: 1,
      shadow_hit_count: 2,
      workflow_distribution: {
        'spec-code-review': 1,
        'spec-plan': 1,
      },
      consumer_status: 'ok',
      store_status: 'ok',
      recommended_next_action: 'open-phase2-plan',
      reason_codes: ['phase1-ready-for-phase2-plan'],
    }));
    expect(gate.candidate_density).toEqual({
      window_days: 14,
      shadow_hits_per_week: 1,
      rule_count: 1,
      workflow_count: 2,
    });

    const markdown = renderRuleMaturityPhase1GateMarkdown(gate);
    for (const requiredField of [
      'as_of',
      'source_refs',
      'status_class',
      'rule_count',
      'shadow_hit_count',
      'candidate_density',
      'workflow_distribution',
      'consumer_status',
      'store_status',
      'owner_cadence_decision',
      'recommended_next_action',
    ]) {
      expect(markdown).toContain(requiredField);
    }
  });

  test('routes degraded or missing consumer evidence to repair before phase 2 planning', () => {
    const gate = buildRuleMaturityPhase1GateFacts({
      asOf: '2026-06-14T00:00:00.000Z',
      list: {
        schema_version: 'rule-maturity-list.v1',
        status: 'degraded',
        reason_code: 'evidence-store-corrupt',
        rules: [],
      },
      observations: {
        schema_version: 'rule-maturity-observations.v1',
        status: 'degraded',
        reason_code: 'evidence-store-corrupt',
        rule_count: 0,
        shadow_hit_count: 0,
        workflow_distribution: {},
        rules: [],
      },
    });

    expect(gate).toEqual(expect.objectContaining({
      status_class: 'degraded/corrupt',
      consumer_status: 'degraded',
      store_status: 'degraded',
      recommended_next_action: 'repair-producer-consumer',
      reason_codes: ['phase1-evidence-degraded'],
    }));
  });
});
