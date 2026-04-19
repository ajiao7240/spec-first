'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-review/SKILL.md');
const PROMPT_MIRROR_SKILL_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-review/SKILL.md');
const PERSONA_CATALOG_PATH = path.join(
  REPO_ROOT,
  'skills/spec-review/references/persona-catalog.md'
);
const SUBAGENT_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'skills/spec-review/references/subagent-template.md'
);
const REVIEW_OUTPUT_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'skills/spec-review/references/review-output-template.md'
);
const PROMPT_MIRROR_REVIEW_OUTPUT_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'docs/10-prompt/skills/spec-review/references/review-output-template.md'
);
const FINDINGS_SCHEMA_PATH = path.join(
  REPO_ROOT,
  'skills/spec-review/references/findings-schema.json'
);
const CLI_READINESS_AGENT_PATH = path.join(
  REPO_ROOT,
  'agents/review/cli-readiness-reviewer.md'
);
const PREVIOUS_COMMENTS_AGENT_PATH = path.join(
  REPO_ROOT,
  'agents/review/previous-comments-reviewer.md'
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function validateFindingSample(schema, finding) {
  for (const field of schema.required) {
    if (!(field in finding)) {
      return false;
    }
  }

  if ('dimension_tag' in finding) {
    const allowed = schema.properties.dimension_tag.enum;
    if (!allowed.includes(finding.dimension_tag)) {
      return false;
    }
  }

  return true;
}

function expectCoreContracts(runtimeSkill) {
  expect(runtimeSkill).toContain('Review failed. Reason: conflicting mode flags');
  expect(runtimeSkill).toContain('apply `safe_auto` fixes automatically');
  expect(runtimeSkill).toContain('cli-readiness-reviewer');
  expect(runtimeSkill).toContain('previous-comments-reviewer');
  expect(runtimeSkill).toContain('Cross-reviewer agreement');
  expect(runtimeSkill).toContain('Resolve disagreements');
  expect(runtimeSkill).toContain('Safe fixes have been applied.');
  expect(runtimeSkill).toContain('dimension_tag');
  expect(runtimeSkill).toContain('change-discipline');
  expect(runtimeSkill).not.toContain('mode:headless');
}

describe('spec-review contracts', () => {
  test('source skill keeps Stage-0, non-headless review routing, and restored ce-review contracts', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: review-workflow');
    expect(skill).toContain('context-routing.json');
    expect(skill).toContain('artifact-manifest.json');
    expect(skill).toContain('minimal-context/review.json');
    expect(skill).toContain('platform_focus');
    expect(skill).toContain('verification_gaps_to_check');
    expect(skill).toContain('recommended_required_verifications');
    expect(skill).toContain('repo_verification_gaps_to_check');
    expect(skill).toContain('verifier_dispatch');
    expect(skill).toContain('handoff_posture');
    expect(skill).toContain('dispatch_candidates');
    expect(skill).toContain('manual_required_verifications');
    expect(skill).toContain('dispatch_blockers');
    expect(skill).toContain('ai_dev_quality_gate_result');
    expect(skill).toContain('verification_evidence');
    expect(skill).toContain('verification_gate_state');
    expect(skill).toContain('overall_status / required_gates / optional_evidence / blockers / ci_gate');
    expect(skill).toContain('verification summary');
    expect(skill).toContain('effective gap checklist');
    expect(skill).toContain('change-surface');
    expect(skill).toContain('### Reload Before Act');
    expect(skill).toContain('freshness_stale');
    expect(skill).toContain('Do not present `freshness_stale` as `L0`');
    expect(skill).toContain('work_run:<run-id>');
    expect(skill).toContain('work_artifact_dir:<path>');
    expect(skill).toContain('### Optional Upstream Work Handoff');
    expect(skill).toContain('artifact_dir/run.json');
    expect(skill).toContain('plan_deviations');
    expect(skill).toContain('resume_anchor');
    expect(skill).toContain('Three-Axis Verdict');
    expect(skill).toContain('Requirement Completion');
    expect(skill).toContain('Plan-Diff Fidelity');
    expect(skill).toContain('Code Intrinsic Quality');
    expect(skill).toContain('`missing` plan source:');
    expect(skill).toContain('show only `Code Intrinsic Quality`');
    expect(skill).toContain('stage0-context --stage review --workflow spec-review --format json');
    expect(skill).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
    expect(skill).toContain('selection_subject / selected_contexts');
    expect(skill).toContain('selected_assets / fallback_reason / level / skipped_rules');
    expect(skill).toContain('compatibility view');
    expect(skill).toContain('selection_subject.kind = workspace');
    expect(skill).toContain('Review failed. Reason: conflicting mode flags');
    expect(skill).toContain('apply `safe_auto` fixes automatically');
    expect(skill).toContain('17 reviewer personas');
    expect(skill).toContain('spec-first:review:cli-readiness-reviewer');
    expect(skill).toContain('spec-first:review:previous-comments-reviewer');
    expect(skill).toContain('`previous-comments` is PR-only.');
    expect(skill).toContain('In `mode:autofix`, do not stop to ask');
    expect(skill).toContain('Use the platform\'s mid-tier model for all persona and CE sub-agents.');
    expect(skill).toContain('model: "sonnet"');
    expect(skill).toContain('Passed in a `<pr-context>` block');
    expect(skill).toContain('Cross-reviewer agreement');
    expect(skill).toContain('Resolve disagreements');
    expect(skill).toContain('dimension_tag');
    expect(skill).toContain('change-discipline');
    expect(skill).toContain('using the platform\'s blocking question tool');
    expect(skill).toContain('.spec-first/workflows/spec-review/<run-id>/');
    expect(skill).not.toContain('mode:headless');
  });

  test('references and reviewer agents preserve restored catalog, merge-tier, and PR-memory contracts', () => {
    const personaCatalog = read(PERSONA_CATALOG_PATH);
    const subagentTemplate = read(SUBAGENT_TEMPLATE_PATH);
    const outputTemplate = read(REVIEW_OUTPUT_TEMPLATE_PATH);
    const findingsSchema = read(FINDINGS_SCHEMA_PATH);
    const findingsSchemaJson = readJson(FINDINGS_SCHEMA_PATH);
    const cliReadinessAgent = read(CLI_READINESS_AGENT_PATH);
    const previousCommentsAgent = read(PREVIOUS_COMMENTS_AGENT_PATH);

    expect(personaCatalog).toContain('17 reviewer personas');
    expect(personaCatalog).toContain('`cli-readiness`');
    expect(personaCatalog).toContain('`previous-comments`');
    expect(personaCatalog).toContain('**PR-only.**');

    expect(subagentTemplate).toContain('Compact return (always).');
    expect(subagentTemplate).toContain('review-fixer');
    expect(subagentTemplate).toContain('downstream-resolver');
    expect(subagentTemplate).toContain('<pr-context>');
    expect(subagentTemplate).toContain('Intent verification');
    expect(subagentTemplate).toContain('dimension_tag');
    expect(subagentTemplate).toContain('orthogonal_edits');
    expect(subagentTemplate).toContain('over_engineering');
    expect(subagentTemplate).toContain('assumption_leak');
    expect(subagentTemplate).toContain('confidence too low for actionable review');
    expect(subagentTemplate).not.toContain('too speculative for actionable review');

    expect(outputTemplate).toContain('## Code Review Results');
    expect(outputTemplate).toContain('**Mode:** autofix');
    expect(outputTemplate).toContain('### Requirements Completeness');
    expect(outputTemplate).toContain('### Three-Axis Verdict');
    expect(outputTemplate).toContain('| Axis | Status | Basis |');
    expect(outputTemplate).toContain('Requirement Completion');
    expect(outputTemplate).toContain('Plan-Diff Fidelity');
    expect(outputTemplate).toContain('Code Intrinsic Quality');
    expect(outputTemplate).toContain('`missing` plan means only `Code Intrinsic Quality`');
    expect(outputTemplate).toContain('`safe_auto -> review-fixer`');
    expect(outputTemplate).toContain('[change-discipline:<dimension_tag>]');
    expect(outputTemplate).not.toContain('headless');

    expect(findingsSchema).toContain('"safe_auto"');
    expect(findingsSchema).toContain('"review-fixer"');
    expect(findingsSchema).toContain('"return_tiers"');
    expect(findingsSchema).toContain('"detail_tier"');
    expect(findingsSchema).toContain('"dimension_tag"');
    expect(findingsSchema).not.toContain('headless');

    const findingItemSchema = findingsSchemaJson.properties.findings.items;
    expect(findingItemSchema.properties.dimension_tag).toEqual({
      type: ['string', 'null'],
      enum: ['orthogonal_edits', 'over_engineering', 'assumption_leak', null],
      default: null,
      description: 'Optional primary tag for change-discipline findings. Use null or omit when not applicable.',
    });
    expect(findingItemSchema.required).not.toContain('dimension_tag');

    const baseFinding = {
      title: 'Example finding',
      severity: 'P2',
      file: 'foo.js',
      line: 12,
      why_it_matters: 'Breaks behavior',
      autofix_class: 'manual',
      owner: 'downstream-resolver',
      requires_verification: true,
      confidence: 0.75,
      evidence: ['observed in diff'],
      pre_existing: false,
      suggested_fix: null,
    };
    expect(validateFindingSample(findingItemSchema, { ...baseFinding, dimension_tag: null })).toBe(true);
    expect(
      validateFindingSample(findingItemSchema, { ...baseFinding, dimension_tag: 'orthogonal_edits' })
    ).toBe(true);
    expect(validateFindingSample(findingItemSchema, { ...baseFinding, dimension_tag: 'garbage' })).toBe(false);

    expect(cliReadinessAgent).toContain('name: cli-readiness-reviewer');
    expect(cliReadinessAgent).toContain('CLI readiness findings never reach P0');
    expect(cliReadinessAgent).toContain('"reviewer": "cli-readiness"');

    expect(previousCommentsAgent).toContain('name: previous-comments-reviewer');
    expect(previousCommentsAgent).toContain('Pre-condition: PR context required');
    expect(previousCommentsAgent).toContain('gh pr view <PR_NUMBER> --json reviews,comments');
    expect(previousCommentsAgent).toContain('"reviewer": "previous-comments"');
  });

  test('docs mirror review output template preserves three-axis verdict structure', () => {
    const mirrorTemplate = read(PROMPT_MIRROR_REVIEW_OUTPUT_TEMPLATE_PATH);

    expect(mirrorTemplate).toContain('### Requirements Completeness');
    expect(mirrorTemplate).toContain('### Three-Axis Verdict');
    expect(mirrorTemplate).toContain('| Axis | Status | Basis |');
    expect(mirrorTemplate).toContain('Requirement Completion');
    expect(mirrorTemplate).toContain('Plan-Diff Fidelity');
    expect(mirrorTemplate).toContain('Code Intrinsic Quality');
    expect(mirrorTemplate).toContain('`missing` plan means only `Code Intrinsic Quality`');
  });

  test('runtime transforms preserve host-specific review naming and agent adaptation', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-review' });

    expect(claudeRuntime).toContain('name: review-workflow');
    expect(claudeRuntime).toContain('`cli-readiness-reviewer`');
    expect(claudeRuntime).toContain('`previous-comments-reviewer`');
    expect(claudeRuntime).not.toContain('spec-first:review:cli-readiness-reviewer');
    expect(claudeRuntime).not.toContain('spec-first:review:previous-comments-reviewer');
    expectCoreContracts(claudeRuntime);

    expect(codexRuntime).toContain('name: spec-review');
    expect(codexRuntime).toContain('`.codex/agents/review/cli-readiness-reviewer.md`');
    expect(codexRuntime).toContain('`.codex/agents/review/previous-comments-reviewer.md`');
    expect(codexRuntime).not.toContain('spec-first:review:cli-readiness-reviewer');
    expect(codexRuntime).not.toContain('spec-first:review:previous-comments-reviewer');
    expectCoreContracts(codexRuntime);
  });

  test('docs mirror stays aligned on verification summary Stage-0 contract', () => {
    const mirror = read(PROMPT_MIRROR_SKILL_PATH);

    expect(mirror).toContain('platform_focus');
    expect(mirror).toContain('verification_gaps_to_check');
    expect(mirror).toContain('recommended_required_verifications');
    expect(mirror).toContain('repo_verification_gaps_to_check');
    expect(mirror).toContain('verifier_dispatch');
    expect(mirror).toContain('handoff_posture');
    expect(mirror).toContain('dispatch_candidates');
    expect(mirror).toContain('manual_required_verifications');
    expect(mirror).toContain('dispatch_blockers');
    expect(mirror).toContain('ai_dev_quality_gate_result');
    expect(mirror).toContain('verification_evidence');
    expect(mirror).toContain('verification_gate_state');
    expect(mirror).toContain('overall_status / required_gates / optional_evidence / blockers / ci_gate');
    expect(mirror).toContain('verification summary');
    expect(mirror).toContain('effective gap checklist');
    expect(mirror).toContain('change-surface');
    expect(mirror).toContain('### Reload Before Act');
    expect(mirror).toContain('freshness_stale');
    expect(mirror).toContain('Do not present `freshness_stale` as `L0`');
    expect(mirror).toContain('work_run:<run-id>');
    expect(mirror).toContain('work_artifact_dir:<path>');
    expect(mirror).toContain('### Optional Upstream Work Handoff');
    expect(mirror).toContain('artifact_dir/run.json');
    expect(mirror).toContain('plan_deviations');
    expect(mirror).toContain('resume_anchor');
    expect(mirror).toContain('Three-Axis Verdict');
    expect(mirror).toContain('Requirement Completion');
    expect(mirror).toContain('Plan-Diff Fidelity');
    expect(mirror).toContain('Code Intrinsic Quality');
    expect(mirror).toContain('`missing` plan source:');
    expect(mirror).toContain('show only `Code Intrinsic Quality`');
    expect(mirror).toContain('stage0-context --stage review --workflow spec-review --format json');
    expect(mirror).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
    expect(mirror).toContain('selection_subject / selected_contexts');
    expect(mirror).toContain('selected_assets / fallback_reason / level / skipped_rules');
    expect(mirror).toContain('compatibility view');
  });
});
