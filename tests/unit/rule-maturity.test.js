'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runInternal } = require('../../src/cli/commands/internal');
const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const {
  buildRuleMaturityList,
  getRuleMaturityStorePath,
  recordShadowHit,
  runCli,
} = require('../../src/cli/helpers/rule-maturity');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RULE_MATURITY_SCHEMA = JSON.parse(fs.readFileSync(
  path.join(REPO_ROOT, 'docs', 'contracts', 'governance', 'rule-maturity.schema.json'),
  'utf8',
));

function createRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rule-maturity-'));
}

function readStore(repoRoot) {
  return JSON.parse(fs.readFileSync(getRuleMaturityStorePath(repoRoot), 'utf8'));
}

function writeStore(repoRoot, records) {
  const storePath = getRuleMaturityStorePath(repoRoot);
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

function runWithOutput(args) {
  let text = '';
  const exitCode = runCli(args, {
    stdout: {
      write(chunk) {
        text += chunk;
      },
    },
  });
  return { exitCode, json: JSON.parse(text) };
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

describe('rule-maturity helper', () => {
  let repoRoot;

  beforeEach(() => {
    repoRoot = createRepo();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test('records a first shadow hit with schema-valid defaults', () => {
    const result = recordShadowHit({
      repo: repoRoot,
      ruleId: 'review-missing-contract-test',
      workflow: 'spec-code-review',
      evidenceRef: 'docs/validation/review.md#F1',
      reasonCode: 'missing-contract-test',
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      reason_code: 'shadow-hit-recorded',
      store_path: '.spec-first/governance/rule-maturity.json',
      rule_id: 'review-missing-contract-test',
      stage: 'shadow',
      shadow_hit_count: 1,
    }));

    const records = readStore(repoRoot);
    expect(records).toHaveLength(1);
    const record = records[0];
    expect(validateAgainstSchema(RULE_MATURITY_SCHEMA, record).errors).toEqual([]);
    expect(record).toEqual(expect.objectContaining({
      schema_version: 'rule-maturity.v1',
      rule_id: 'review-missing-contract-test',
      stage: 'shadow',
      defect_evidence_refs: [],
      false_positive_refs: [],
      rollback: {
        available: true,
        notes: 'shadow observation only; nothing to roll back',
      },
      evidence_refs: ['docs/validation/review.md#F1'],
      reason_code: 'shadow-observation',
    }));
    const observedAt = record.shadow_hits[0].observed_at;
    expect(new Date(Date.parse(observedAt)).toISOString()).toBe(observedAt);
  });

  test('upserts an existing rule and keeps evidence refs as a shadow-hit projection', () => {
    recordShadowHit({
      repo: repoRoot,
      ruleId: 'summary-generated-output-staged',
      workflow: 'spec-code-review',
      evidenceRef: 'docs/validation/review.md#generated',
      reasonCode: 'generated-runtime-path',
    });
    recordShadowHit({
      repo: repoRoot,
      ruleId: 'summary-generated-output-staged',
      workflow: 'spec-plan',
      evidenceRef: 'docs/validation/review.md#generated-2',
      reasonCode: 'generated-runtime-path',
    });

    const [record] = readStore(repoRoot);
    expect(record.shadow_hits).toHaveLength(2);
    expect(record.evidence_refs).toEqual([
      'docs/validation/review.md#generated',
      'docs/validation/review.md#generated-2',
    ]);
  });

  test('resolves nested git working directories to the repository evidence store', () => {
    execFileSync('git', ['init', '-q'], { cwd: repoRoot });
    const nested = path.join(repoRoot, 'sub', 'dir');
    fs.mkdirSync(nested, { recursive: true });

    const result = recordShadowHit({
      repo: nested,
      ruleId: 'review-missing-contract-test',
      workflow: 'spec-code-review',
      evidenceRef: 'docs/validation/review.md#F1',
      reasonCode: 'missing-contract-test',
    });

    expect(result.status).toBe('ok');
    expect(fs.existsSync(path.join(nested, '.spec-first', 'governance', 'rule-maturity.json'))).toBe(false);
    expect(readStore(repoRoot)[0].shadow_hits).toHaveLength(1);
    expect(buildRuleMaturityList({ repo: repoRoot }).rules[0]).toEqual(expect.objectContaining({
      rule_id: 'review-missing-contract-test',
      shadow_hit_count: 1,
    }));
  });

  test('lists empty, ok, and max Date.parse last_observed_at projections', () => {
    expect(buildRuleMaturityList({ repo: repoRoot })).toEqual({
      schema_version: 'rule-maturity-list.v1',
      status: 'empty',
      reason_code: 'rule-maturity-store-empty',
      rules: [],
    });

    writeStore(repoRoot, [{
      schema_version: 'rule-maturity.v1',
      rule_id: 'planning-depth-underclassified',
      stage: 'shadow',
      shadow_hits: [
        {
          observed_at: '2026-06-12T01:00:00.000Z',
          workflow: 'spec-plan',
          evidence_ref: 'docs/plans/example.md#depth',
          reason_code: 'depth-override',
        },
        {
          observed_at: '2026-06-12T03:00:00.000Z',
          workflow: 'spec-code-review',
          evidence_ref: 'docs/validation/review.md#depth',
          reason_code: 'depth-override',
        },
      ],
      defect_evidence_refs: [],
      false_positive_refs: [],
      rollback: {
        available: true,
        notes: 'shadow observation only; nothing to roll back',
      },
      evidence_refs: ['docs/plans/example.md#depth', 'docs/validation/review.md#depth'],
      reason_code: 'shadow-observation',
    }]);

    expect(buildRuleMaturityList({ repo: repoRoot })).toEqual({
      schema_version: 'rule-maturity-list.v1',
      status: 'ok',
      reason_code: 'rule-maturity-collected',
      rules: [{
        rule_id: 'planning-depth-underclassified',
        stage: 'shadow',
        shadow_hit_count: 2,
        last_observed_at: '2026-06-12T03:00:00.000Z',
        workflows: ['spec-code-review', 'spec-plan'],
        reason_codes: ['depth-override'],
        evidence_refs: ['docs/plans/example.md#depth', 'docs/validation/review.md#depth'],
      }],
    });
  });

  test('rejects stage arguments and missing required record arguments', () => {
    const stageResult = runWithOutput([
      'record',
      '--repo', repoRoot,
      '--rule-id', 'review-missing-contract-test',
      '--workflow', 'spec-code-review',
      '--evidence-ref', 'docs/validation/review.md#F1',
      '--reason-code', 'missing-contract-test',
      '--stage', 'blocking',
      '--json',
    ]);
    expect(stageResult.exitCode).toBe(2);
    expect(stageResult.json.reason_code).toBe('invalid-arguments');
    expect(stageResult.json.errors).toContain('unknown argument: --stage');

    const missingResult = runWithOutput([
      'record',
      '--repo', repoRoot,
      '--rule-id', 'review-missing-contract-test',
      '--workflow', 'spec-code-review',
      '--json',
    ]);
    expect(missingResult.exitCode).toBe(2);
    expect(missingResult.json.errors).toEqual(expect.arrayContaining([
      '--evidence-ref is required',
      '--reason-code is required',
    ]));
  });

  test('internal dispatcher exposes rule-maturity record and list JSON', () => {
    const record = captureStdout(() => runInternal([
      'rule-maturity',
      'record',
      '--repo', repoRoot,
      '--rule-id', 'review-missing-contract-test',
      '--workflow', 'spec-code-review',
      '--evidence-ref', 'docs/validation/review.md#F1',
      '--reason-code', 'missing-contract-test',
      '--json',
    ]));
    expect(record.code).toBe(0);
    expect(record.json).toEqual(expect.objectContaining({
      status: 'ok',
      rule_id: 'review-missing-contract-test',
      shadow_hit_count: 1,
    }));

    const list = captureStdout(() => runInternal([
      'rule-maturity',
      'list',
      '--repo', repoRoot,
      '--json',
    ]));
    expect(list.code).toBe(0);
    expect(list.json.schema_version).toBe('rule-maturity-list.v1');
    expect(list.json.rules).toContainEqual(expect.objectContaining({
      rule_id: 'review-missing-contract-test',
      shadow_hit_count: 1,
    }));
  });

  test('refuses to append to a non-shadow target rule', () => {
    writeStore(repoRoot, [{
      schema_version: 'rule-maturity.v1',
      rule_id: 'review-missing-contract-test',
      stage: 'required-evidence',
      shadow_hits: [],
      defect_evidence_refs: [],
      false_positive_refs: [],
      rollback: {
        available: true,
        notes: 'manual fixture',
      },
      evidence_refs: [],
      reason_code: 'shadow-observation',
    }]);
    const before = fs.readFileSync(getRuleMaturityStorePath(repoRoot), 'utf8');

    const result = recordShadowHit({
      repo: repoRoot,
      ruleId: 'review-missing-contract-test',
      workflow: 'spec-code-review',
      evidenceRef: 'docs/validation/review.md#F1',
      reasonCode: 'missing-contract-test',
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_code).toBe('stage-not-recordable');
    expect(fs.readFileSync(getRuleMaturityStorePath(repoRoot), 'utf8')).toBe(before);
  });

  test('does not overwrite a corrupt evidence store and degrades list output for invalid observed_at', () => {
    const storePath = getRuleMaturityStorePath(repoRoot);
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, '{not json', 'utf8');

    const corruptResult = recordShadowHit({
      repo: repoRoot,
      ruleId: 'review-missing-contract-test',
      workflow: 'spec-code-review',
      evidenceRef: 'docs/validation/review.md#F1',
      reasonCode: 'missing-contract-test',
    });
    expect(corruptResult.status).toBe('rejected');
    expect(corruptResult.reason_code).toBe('evidence-store-corrupt');
    expect(fs.readFileSync(storePath, 'utf8')).toBe('{not json');

    writeStore(repoRoot, [{
      schema_version: 'rule-maturity.v1',
      rule_id: 'review-missing-contract-test',
      stage: 'shadow',
      shadow_hits: [{
        observed_at: 'not-a-date',
        workflow: 'spec-code-review',
        evidence_ref: 'docs/validation/review.md#F1',
        reason_code: 'missing-contract-test',
      }],
      defect_evidence_refs: [],
      false_positive_refs: [],
      rollback: {
        available: true,
        notes: 'shadow observation only; nothing to roll back',
      },
      evidence_refs: ['docs/validation/review.md#F1'],
      reason_code: 'shadow-observation',
    }]);

    const list = buildRuleMaturityList({ repo: repoRoot });
    expect(list.status).toBe('degraded');
    expect(list.reason_code).toBe('invalid-observed-at');
    expect(list.rules[0].last_observed_at).toBeNull();
  });

  test('rejects rule ids that exceed the schema maximum length', () => {
    const result = recordShadowHit({
      repo: repoRoot,
      ruleId: 'x'.repeat(121),
      workflow: 'spec-code-review',
      evidenceRef: 'docs/validation/review.md#F1',
      reasonCode: 'missing-contract-test',
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_code).toBe('schema-invalid');
    expect(fs.existsSync(getRuleMaturityStorePath(repoRoot))).toBe(false);
  });

  test('does not create a missing repo root', () => {
    const missingRepo = path.join(repoRoot, 'missing');

    const result = recordShadowHit({
      repo: missingRepo,
      ruleId: 'review-missing-contract-test',
      workflow: 'spec-code-review',
      evidenceRef: 'docs/validation/review.md#F1',
      reasonCode: 'missing-contract-test',
    });

    expect(result.status).toBe('rejected');
    expect(result.reason_code).toBe('repo-not-found');
    expect(fs.existsSync(missingRepo)).toBe(false);

    const list = buildRuleMaturityList({ repo: missingRepo });
    expect(list.status).toBe('degraded');
    expect(list.reason_code).toBe('repo-not-found');
  });
});
