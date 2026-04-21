'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-plan/SKILL.md');
const PROMPT_MIRROR_SKILL_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-plan/SKILL.md');
const PLAN_HANDOFF_PATH = path.join(
  REPO_ROOT,
  'skills/spec-plan/references/plan-handoff.md'
);
const DEEPENING_WORKFLOW_PATH = path.join(
  REPO_ROOT,
  'skills/spec-plan/references/deepening-workflow.md'
);
const UNIVERSAL_PLANNING_PATH = path.join(
  REPO_ROOT,
  'skills/spec-plan/references/universal-planning.md'
);
const VISUAL_COMMUNICATION_PATH = path.join(
  REPO_ROOT,
  'skills/spec-plan/references/visual-communication.md'
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-plan contracts', () => {
  test('source skill keeps internal naming, Stage-0 contract, non-software routing, and spec-first plan upgrades', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: plan-workflow');
    expect(skill).toContain('non-software multi-step tasks');
    expect(skill).toContain("[feature description, requirements doc path, plan path to deepen, or task to plan]");
    expect(skill).toContain('feature, bug fix, or multi-step task');
    expect(skill).toContain('context-routing.json');
    expect(skill).toContain('artifact-manifest.json');
    expect(skill).toContain('minimal-context/plan.json');
    expect(skill).toContain('platform_focus');
    expect(skill).toContain('required_verifications');
    expect(skill).toContain('verifier_dispatch');
    expect(skill).toContain('ai_dev_quality_gate_result');
    expect(skill).toContain('verification_evidence');
    expect(skill).toContain('verification_gate_state');
    expect(skill).toContain('planned / blocked / not-needed');
    expect(skill).toContain('verification summary');
    expect(skill).toContain('Verification-as-Done');
    expect(skill).toContain('### Lightweight Planning Anchor');
    expect(skill).toContain('### Reload Before Act');
    expect(skill).toContain('## Optional Repo Profile Input');
    expect(skill).toContain('.spec-first/specs/repo-profile.yaml');
    expect(skill).toContain('repo-level normative hints');
    expect(skill).toContain('empty strings, empty arrays, and missing fields as absent input');
    expect(skill).toContain('Do not expand it into a rules engine');
    expect(skill).toContain('freshness_stale');
    expect(skill).toContain('Do not present `freshness_stale` as `L0`');
    expect(skill).toContain('stage0-context --stage plan --workflow spec-plan --format json');
    expect(skill).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
    expect(skill).toContain('selection_subject / selected_contexts');
    expect(skill).toContain('selected_assets / fallback_reason / level / skipped_rules');
    expect(skill).toContain('compatibility view');
    expect(skill).toContain('selection_subject.kind = workspace');
    expect(skill).toContain('#### 0.1b Classify Task Domain');
    expect(skill).toContain('#### 0.3a Load Epic Decomposition Context When Declared');
    expect(skill).toContain('frontmatter `epic: <epic-slug>`');
    expect(skill).toContain('docs/brainstorms/*-<epic-slug>-decomposition.md');
    expect(skill).toContain('warn and continue planning without epic context');
    expect(skill).toContain('Do **not** infer structured epic metadata from Key Decisions');
    expect(skill).toContain('not a requirement to create a dedicated runtime helper');
    expect(skill).toContain('references/universal-planning.md');
    expect(skill).toContain('Execution target: external-delegate');
    expect(skill).toContain('in **interactive mode**');
    expect(skill).toContain('Phase 5.3.8 (Document Review)');
    expect(skill).toContain('Task spec-first:research:repo-research-analyst(');
    expect(skill).toContain('Task spec-first:workflow:spec-flow-analyzer(');
    expect(skill).toContain('Auto mode');
    expect(skill).toContain('Interactive mode');
    expect(skill).toContain('references/visual-communication.md');
    expect(skill).toContain('Would a visual aid');
    expect(skill).not.toContain('Use bare agent names inside Task calls.');
  });

  test('supporting references preserve deepening, handoff, non-software, and visual guidance contracts', () => {
    const handoff = read(PLAN_HANDOFF_PATH);
    const deepening = read(DEEPENING_WORKFLOW_PATH);
    const universalPlanning = read(UNIVERSAL_PLANNING_PATH);
    const visualCommunication = read(VISUAL_COMMUNICATION_PATH);

    expect(handoff).toContain('do not request `mode:headless`');
    expect(handoff).toContain('Interactive document-review still required before execution handoff.');
    expect(handoff).toContain('it is mandatory');

    expect(deepening).toContain('spec-first:review:architecture-strategist');
    expect(deepening).toContain('spec-first:review:pattern-recognition-specialist');
    expect(deepening).toContain('.spec-first/workflows/spec-plan/deepen/');

    expect(universalPlanning).toContain('/spec:plan');
    expect(universalPlanning).toContain('/spec:work');
    expect(universalPlanning).toContain('Do not offer `/spec:work`');
    expect(universalPlanning).toContain('Load the `proof` skill');

    expect(visualCommunication).toContain('Markdown tables');
    expect(visualCommunication).toContain('The visual describes code-level detail');
  });

  test('runtime transforms preserve host-specific plan naming and agent adaptation', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-plan' });

    expect(claudeRuntime).toContain('name: plan-workflow');
    expect(claudeRuntime).toContain('Task repo-research-analyst(');
    expect(claudeRuntime).toContain('Task spec-flow-analyzer(');
    expect(claudeRuntime).not.toContain('Task spec-first:research:repo-research-analyst(');
    expect(claudeRuntime).not.toContain('Task spec-first:workflow:spec-flow-analyzer(');

    expect(codexRuntime).toContain('name: spec-plan');
    expect(codexRuntime).toContain('`.codex/agents/research/repo-research-analyst.md`');
    expect(codexRuntime).toContain('`.codex/agents/workflow/spec-flow-analyzer.md`');
    expect(codexRuntime).toContain('references/universal-planning.md');
    expect(codexRuntime).toContain('references/visual-communication.md');
    expect(codexRuntime).not.toContain('Task spec-first:research:repo-research-analyst(');
    expect(codexRuntime).not.toContain('Task spec-first:workflow:spec-flow-analyzer(');
  });

  test('docs mirror stays aligned on verification summary Stage-0 contract', () => {
    const mirror = read(PROMPT_MIRROR_SKILL_PATH);

    expect(mirror).toContain('platform_focus');
    expect(mirror).toContain('required_verifications');
    expect(mirror).toContain('verifier_dispatch');
    expect(mirror).toContain('ai_dev_quality_gate_result');
    expect(mirror).toContain('verification_evidence');
    expect(mirror).toContain('verification_gate_state');
    expect(mirror).toContain('planned / blocked / not-needed');
    expect(mirror).toContain('verification summary');
    expect(mirror).toContain('Verification-as-Done');
    expect(mirror).toContain('### Lightweight Planning Anchor');
    expect(mirror).toContain('### Reload Before Act');
    expect(mirror).toContain('## Optional Repo Profile Input');
    expect(mirror).toContain('.spec-first/specs/repo-profile.yaml');
    expect(mirror).toContain('repo-level normative hints');
    expect(mirror).toContain('empty strings, empty arrays, and missing fields as absent input');
    expect(mirror).toContain('freshness_stale');
    expect(mirror).toContain('Do not present `freshness_stale` as `L0`');
    expect(mirror).toContain('stage0-context --stage plan --workflow spec-plan --format json');
    expect(mirror).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
    expect(mirror).toContain('selection_subject / selected_contexts');
    expect(mirror).toContain('selected_assets / fallback_reason / level / skipped_rules');
    expect(mirror).toContain('compatibility view');
  });
});
