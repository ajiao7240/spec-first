'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/document-review/SKILL.md');
const SUBAGENT_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'skills/document-review/references/subagent-template.md'
);
const SYNTHESIS_PATH = path.join(
  REPO_ROOT,
  'skills/document-review/references/synthesis-and-presentation.md'
);
const FINDINGS_SCHEMA_PATH = path.join(
  REPO_ROOT,
  'skills/document-review/references/findings-schema.json'
);
const REVIEW_OUTPUT_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'skills/document-review/references/review-output-template.md'
);
const PRODUCT_LENS_AGENT_PATH = path.join(
  REPO_ROOT,
  'agents/document-review/product-lens-reviewer.md'
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function expectRuntimeContracts(runtimeSkill) {
  expect(runtimeSkill).toContain('mode:headless');
  expect(runtimeSkill).toContain('headless mode requires a document path');
  expect(runtimeSkill).toContain('Omit the `mode` parameter');
  expect(runtimeSkill).toContain('product-lens');
  expect(runtimeSkill).not.toContain('spec-first:document-review:coherence-reviewer');
  expect(runtimeSkill).not.toContain('spec-first:document-review:feasibility-reviewer');
}

describe('document-review contracts', () => {
  test('source skill restores headless mode and stronger product-lens selection while keeping spec-first dispatch conventions', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('argument-hint: "[mode:headless] [path/to/document.md]"');
    expect(skill).toContain('## Phase 0: Detect Mode');
    expect(skill).toContain('mode:headless');
    expect(skill).toContain('Review failed: headless mode requires a document path.');
    expect(skill).toContain('The system\'s users may be end users, developers, operators, maintainers, or any other audience.');
    expect(skill).toContain('Opportunity cost implications, where building this means not building something else');
    expect(skill).toContain('Omit the `mode` parameter so the user\'s configured permission settings apply.');
    expect(skill).toContain('spec-first:document-review:adversarial-document-reviewer');
  });

  test('product-lens reviewer preserves product-context framing and strategic consequences analysis', () => {
    const agent = read(PRODUCT_LENS_AGENT_PATH);

    expect(agent).toContain('## Product context');
    expect(agent).toContain('Many products are hybrid');
    expect(agent).toContain('### 2. Strategic consequences');
    expect(agent).toContain('**Identity impact**');
    expect(agent).toContain('**Adoption dynamics**');
    expect(agent).toContain('**Opportunity cost**');
    expect(agent).toContain('**Compounding direction**');
  });

  test('references preserve headless delivery while keeping batch_confirm enhancement', () => {
    const subagentTemplate = read(SUBAGENT_TEMPLATE_PATH);
    const synthesis = read(SYNTHESIS_PATH);
    const findingsSchema = read(FINDINGS_SCHEMA_PATH);
    const reviewOutputTemplate = read(REVIEW_OUTPUT_TEMPLATE_PATH);

    expect(subagentTemplate).toContain('Set `autofix_class` based on determinism, not severity.');
    expect(subagentTemplate).toContain('`batch_confirm`');
    expect(subagentTemplate).toContain('One clear correct answer, but it authors new content where exact wording needs verification.');

    expect(synthesis).toContain('Document review complete (headless mode).');
    expect(synthesis).toContain('Batch-confirm findings:');
    expect(synthesis).toContain('Return `Review complete` immediately.');
    expect(synthesis).toContain('Create technical plan with spec:plan');
    expect(synthesis).toContain('Implement with spec:work');
    expect(synthesis).toContain('Batch Confirm');

    expect(findingsSchema).toContain('"batch_confirm"');
    expect(findingsSchema).toContain('"auto"');
    expect(findingsSchema).toContain('"present"');

    expect(reviewOutputTemplate).toContain('### Batch Confirm');
    expect(reviewOutputTemplate).toContain('Applied 3 auto-fixes. Batched 2 fixes for approval.');
    expect(reviewOutputTemplate).toContain('| Persona | Status | Findings | Auto | Batch | Present | Residual |');
  });

  test('runtime transforms keep headless contract while adapting canonical reviewer names per host', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'document-review' });

    expect(claudeRuntime).toContain('`coherence-reviewer`');
    expect(claudeRuntime).toContain('`feasibility-reviewer`');
    expectRuntimeContracts(claudeRuntime);

    expect(codexRuntime).toContain('`.codex/agents/document-review/coherence-reviewer.md`');
    expect(codexRuntime).toContain('`.codex/agents/document-review/feasibility-reviewer.md`');
    expectRuntimeContracts(codexRuntime);
  });
});
