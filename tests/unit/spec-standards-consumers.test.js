'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  buildDownstreamConsumers,
} = require('../../skills/spec-standards/scripts/prepare-baseline');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONSUMPTION_MAP_PATH = path.join(REPO_ROOT, 'tests/fixtures/spec-standards/downstream-consumption-map/consumption-map.json');
const SPEC_PLAN_PATH = path.join(REPO_ROOT, 'skills/spec-plan/SKILL.md');
const SPEC_WRITE_TASKS_PATH = path.join(REPO_ROOT, 'skills/spec-write-tasks/SKILL.md');
const SPEC_WORK_PATH = path.join(REPO_ROOT, 'skills/spec-work/SKILL.md');
const SPEC_CODE_REVIEW_PATH = path.join(REPO_ROOT, 'skills/spec-code-review/SKILL.md');
const CONSUMPTION_EXAMPLES_PATH = path.join(REPO_ROOT, 'docs/examples/standards-glue-consumption-examples.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-standards downstream consumer contract', () => {
  test('central consumption examples document status modes and forbidden upgrades', () => {
    const examples = read(CONSUMPTION_EXAMPLES_PATH);

    expect(examples).toContain('人读示例，不是新的 schema、producer、规则引擎或 workflow state machine');
    expect(examples).toContain('| `confirmed` | hard context |');
    expect(examples).toContain('| `observed` | advisory context |');
    expect(examples).toContain('| `imported` | advisory context |');
    expect(examples).toContain('| `suggested` | advisory context |');
    expect(examples).toContain('| `conflict` | risk context |');
    expect(examples).toContain('| `deprecated` | risk context |');
    expect(examples).toContain('| `drifted` | risk context |');
    expect(examples).toContain('| `unknown` | question context |');
    expect(examples).toContain('| validator fail | degraded/advisory only |');
    expect(examples).toContain('| missing validation result | degraded/advisory only |');
    expect(examples).toContain('| `trust_level=degraded` | degraded/advisory only |');
    expect(examples).toContain('| `consumption_boundary=advisory_only` | degraded/advisory only |');
    expect(examples).toContain('| `workspace-advisory-only` | degraded/advisory only |');
    expect(examples).toContain('`advisory` 不是 candidate status');
    expect(examples).toContain('### `spec-plan`');
    expect(examples).toContain('### `spec-write-tasks`');
    expect(examples).toContain('### `spec-work`');
    expect(examples).toContain('### `spec-code-review`');
    expect(examples).toContain('不能升级为 hard rule，不能扩大 source scope');
    expect(examples).toContain('父 workspace advisory baseline 不能当作 child repo confirmed standards');
    expect(examples).toContain('建议运行 `$spec-standards --repo <child>`');
    expect(examples).toContain('`glue-map.json` 只支持 reuse-first 判断');
    expect(examples).toContain('不可以：');
    expect(examples).toContain('作为 workflow state machine');
    expect(examples).toContain('覆盖 plan、task pack、work scope 或 review judgment');
  });

  test('fixture consumption map keeps candidate status separate from consumption mode', () => {
    const consumptionMap = JSON.parse(read(CONSUMPTION_MAP_PATH));

    expect(consumptionMap).toEqual(expect.objectContaining({
      confirmed: 'hard',
      observed: 'advisory',
      imported: 'advisory',
      suggested: 'advisory',
      conflict: 'risk',
      unknown: 'question',
      deprecated: 'risk',
      drifted: 'risk',
      validator_fail: 'degraded/advisory',
      trust_level_degraded: 'degraded/advisory',
      missing_validation_result: 'degraded/advisory',
      consumption_boundary_advisory_only: 'degraded/advisory',
      workspace_advisory_only: 'degraded/advisory',
    }));
    expect(Object.keys(consumptionMap)).not.toContain('advisory_status');
  });

  test('prepare-baseline publishes explicit downstream consumption modes', () => {
    const consumers = buildDownstreamConsumers();

    expect(consumers.map((consumer) => consumer.workflow)).toEqual(expect.arrayContaining([
      'spec-plan',
      'spec-write-tasks',
      'spec-work',
      'spec-code-review',
    ]));

    for (const consumer of consumers) {
      expect(consumer.hard_context).toEqual(['confirmed']);
      expect(consumer.advisory_context).toEqual(['observed', 'imported', 'suggested']);
      expect(consumer.risk_context).toEqual(['conflict', 'deprecated', 'drifted']);
      expect(consumer.question_context).toEqual(['unknown']);
      expect(consumer.degraded_context).toEqual([
        'validator_fail',
        'trust_level=degraded',
        'missing_validation_result',
        'consumption_boundary=advisory_only',
        'workspace-advisory-only',
      ]);
      expect(consumer.consumption_modes).toEqual(expect.objectContaining({
        confirmed: 'hard',
        observed: 'advisory',
        imported: 'advisory',
        suggested: 'advisory',
        conflict: 'risk',
        unknown: 'question',
        validator_fail: 'degraded/advisory',
        trust_level_degraded: 'degraded/advisory',
        missing_validation_result: 'degraded/advisory',
        consumption_boundary_advisory_only: 'degraded/advisory',
        workspace_advisory_only: 'degraded/advisory',
      }));
      expect(consumer.glue_map_boundary).toContain('reuse-first');
      expect(consumer.glue_map_boundary).toContain('not a workflow state machine');
    }
  });

  test('standards handoff facts do not replace LLM workflow recommendation judgment', () => {
    const skill = read(path.join(REPO_ROOT, 'skills/spec-standards/SKILL.md'));

    expect(skill).toContain('next-action-candidates.json');
    expect(skill).toContain('Scripts may write candidate facts, reason codes, source fact refs, evidence paths, and possible public entrypoint sets');
    expect(skill).toContain('scripts must not write a single `target_entrypoint`, ranking, blocking policy, or final workflow recommendation');
    expect(skill).toContain('The LLM consumes the facts and chooses any human recommendation.');
  });

  test('planning workflow consumes standards with trusted degraded and glue boundaries', () => {
    const skill = read(SPEC_PLAN_PATH);

    expect(skill).toContain('`confirmed` -> hard project context');
    expect(skill).toContain('`observed` / `imported` / `suggested` -> advisory context');
    expect(skill).toContain('`conflict` -> risk context');
    expect(skill).toContain('`unknown` -> question context');
    expect(skill).toContain('`trust_level=degraded`');
    expect(skill).toContain('`consumption_boundary=advisory_only`');
    expect(skill).toContain('`workspace-advisory-only`');
    expect(skill).toContain('degraded/advisory only');
    expect(skill).toContain('Use `glue-map.json` for reuse-first implementation boundaries, not as a workflow state machine.');
  });

  test('task derivation workflow cannot upgrade unconfirmed standards into task constraints', () => {
    const skill = read(SPEC_WRITE_TASKS_PATH);

    expect(skill).toContain('`confirmed` -> hard task constraint only when consistent with the source plan');
    expect(skill).toContain('`observed` / `imported` / `suggested` -> advisory context refs');
    expect(skill).toContain('`conflict` -> risk context');
    expect(skill).toContain('`unknown` -> question context');
    expect(skill).toContain('Validator fail, missing validator result, `trust_level=degraded`, `consumption_boundary=advisory_only`, or `workspace-advisory-only` means standards artifacts are degraded/advisory only.');
    expect(skill).toContain('must not become a workflow state machine or expand source-plan scope');
  });

  test('work execution uses confirmed standards and glue map without upgrading soft candidates', () => {
    const skill = read(SPEC_WORK_PATH);

    expect(skill).toContain('treat `confirmed` standards as hard context');
    expect(skill).toContain('treat `observed` / `imported` / `suggested` as advisory context');
    expect(skill).toContain('carry `conflict` as risk context and `unknown` as question context');
    expect(skill).toContain('If standards validation failed, is missing, reports `trust_level=degraded`, reports `consumption_boundary=advisory_only`, or carries `workspace-advisory-only`, consume standards artifacts as degraded/advisory only.');
    expect(skill).toContain('`glue-map.json` is reuse-first context, not a workflow state machine.');
  });

  test('code review only turns confirmed standards into hard findings', () => {
    const skill = read(SPEC_CODE_REVIEW_PATH);

    expect(skill).toContain('only `confirmed` standards may become hard review criteria and hard findings');
    expect(skill).toContain('`observed` / `imported` / `suggested` remain advisory context');
    expect(skill).toContain('`conflict` remains risk context');
    expect(skill).toContain('`unknown` remains question context');
    expect(skill).toContain('`consumption_boundary=advisory_only`');
    expect(skill).toContain('`workspace-advisory-only`');
    expect(skill).toContain('the baseline is degraded/advisory only and must not produce hard project-standards findings');
    expect(skill).toContain('`glue-map.json` may support reuse-first review questions but is not a workflow state machine.');
  });
});
