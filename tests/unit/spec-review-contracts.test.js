'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-review/SKILL.md');
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

function expectCoreContracts(runtimeSkill) {
  expect(runtimeSkill).toContain('Review failed. Reason: conflicting mode flags');
  expect(runtimeSkill).toContain('apply `safe_auto` fixes automatically');
  expect(runtimeSkill).toContain('cli-readiness-reviewer');
  expect(runtimeSkill).toContain('previous-comments-reviewer');
  expect(runtimeSkill).toContain('Cross-reviewer agreement');
  expect(runtimeSkill).toContain('Resolve disagreements');
  expect(runtimeSkill).toContain('Safe fixes have been applied.');
  expect(runtimeSkill).not.toContain('mode:headless');
}

describe('spec-review contracts', () => {
  test('source skill keeps Stage-0, non-headless review routing, and restored ce-review contracts', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: review-workflow');
    expect(skill).toContain('context-routing.json');
    expect(skill).toContain('artifact-manifest.json');
    expect(skill).toContain('minimal-context/review.json');
    expect(skill).toContain('selected_assets / fallback_reason / level / skipped_rules');
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
    expect(skill).toContain('using the platform\'s blocking question tool');
    expect(skill).toContain('.spec-first/workflows/spec-review/<run-id>/');
    expect(skill).not.toContain('mode:headless');
  });

  test('references and reviewer agents preserve restored catalog, merge-tier, and PR-memory contracts', () => {
    const personaCatalog = read(PERSONA_CATALOG_PATH);
    const subagentTemplate = read(SUBAGENT_TEMPLATE_PATH);
    const outputTemplate = read(REVIEW_OUTPUT_TEMPLATE_PATH);
    const findingsSchema = read(FINDINGS_SCHEMA_PATH);
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

    expect(outputTemplate).toContain('## Code Review Results');
    expect(outputTemplate).toContain('**Mode:** autofix');
    expect(outputTemplate).toContain('`safe_auto -> review-fixer`');
    expect(outputTemplate).not.toContain('headless');

    expect(findingsSchema).toContain('"safe_auto"');
    expect(findingsSchema).toContain('"review-fixer"');
    expect(findingsSchema).toContain('"return_tiers"');
    expect(findingsSchema).toContain('"detail_tier"');
    expect(findingsSchema).not.toContain('headless');

    expect(cliReadinessAgent).toContain('name: cli-readiness-reviewer');
    expect(cliReadinessAgent).toContain('CLI readiness findings never reach P0');
    expect(cliReadinessAgent).toContain('"reviewer": "cli-readiness"');

    expect(previousCommentsAgent).toContain('name: previous-comments-reviewer');
    expect(previousCommentsAgent).toContain('Pre-condition: PR context required');
    expect(previousCommentsAgent).toContain('gh pr view <PR_NUMBER> --json reviews,comments');
    expect(previousCommentsAgent).toContain('"reviewer": "previous-comments"');
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
});
