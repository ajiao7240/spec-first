'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-brainstorm/SKILL.md');
const REQUIREMENTS_CAPTURE_PATH = path.join(
  REPO_ROOT,
  'skills/spec-brainstorm/references/requirements-capture.md'
);
const DECOMPOSITION_CAPTURE_PATH = path.join(
  REPO_ROOT,
  'skills/spec-brainstorm/references/decomposition-capture.md'
);
const HANDOFF_PATH = path.join(
  REPO_ROOT,
  'skills/spec-brainstorm/references/handoff.md'
);
const UNIVERSAL_BRAINSTORMING_PATH = path.join(
  REPO_ROOT,
  'skills/spec-brainstorm/references/universal-brainstorming.md'
);
const VISUAL_COMMUNICATION_PATH = path.join(
  REPO_ROOT,
  'skills/spec-brainstorm/references/visual-communication.md'
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-brainstorm contracts', () => {
  test('source skill keeps internal naming and upstream brainstorm guardrails', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: brainstorm-workflow');
    expect(skill).toContain('<HARD-GATE>');
    expect(skill).toContain('This Is Too Simple To Need Alignment');
    expect(skill).toContain('## Process Flow');
    expect(skill).toContain('#### 0.1a Current Work Pulse');
    expect(skill).toContain('#### 0.1b Classify Task Domain');
    expect(skill).toContain('#### 0.3a Scope Decomposition');
    expect(skill).toContain('references/decomposition-capture.md');
    expect(skill).toContain('Restated Understanding');
    expect(skill).toContain('Current Core Goal');
    expect(skill).toContain('Scope / Non-goals');
    expect(skill).toContain('Verification-as-Done');
    expect(skill).toContain('#### 3.4 Preflight Self-Check');
    expect(skill).toContain('#### 3.6 User Review Gate');
    expect(skill).toContain('### Phase 4: Handoff and Terminal State Lock');
    expect(skill).toContain('single-exit superpowers model');
    expect(skill).toContain('Ask what the user is already thinking before offering your own ideas.');
    expect(skill).toContain('Use at least one non-obvious angle');
    expect(skill).toContain('Present approaches first, then evaluate.');
    expect(skill).toContain('visual aid guidance');
  });

  test('source skill freezes supplemental context routing and digest contract', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('#### 1.1 Existing and Supplemental Context Scan');
    expect(skill).toContain('opt-in / source-driven');
    expect(skill).toContain('external readers never auto-dispatch from topic alone');
    expect(skill).toContain('Task spec-first:research:local-doc-reader(');
    expect(skill).toContain('Task spec-first:research:learnings-researcher(');
    expect(skill).toContain('Task spec-first:research:github-context-reader(');
    expect(skill).toContain('Task spec-first:research:docs-context-reader(');
    expect(skill).toContain('Task spec-first:research:web-context-reader(');
    expect(skill).toContain('`success | no-result | tool-unavailable | permission-denied | source-unparseable | executor-unavailable`');
    expect(skill).toContain('Never assume it is repo-bundled.');
    expect(skill).toContain('`executor-unavailable`');
  });

  test('requirements and handoff references preserve decomposition, preflight, and terminal lock contracts', () => {
    const requirementsCapture = read(REQUIREMENTS_CAPTURE_PATH);
    const decompositionCapture = read(DECOMPOSITION_CAPTURE_PATH);
    const handoff = read(HANDOFF_PATH);
    const universalBrainstorming = read(UNIVERSAL_BRAINSTORMING_PATH);
    const visualCommunication = read(VISUAL_COMMUNICATION_PATH);

    expect(requirementsCapture).toContain('references/visual-communication.md');
    expect(requirementsCapture).toContain('epic: <epic-slug>');
    expect(requirementsCapture).toContain('Section-by-section confirmation for Standard and Deep work');
    expect(requirementsCapture).toContain('Design for isolation');
    expect(requirementsCapture).toContain('Targeted improvements in existing codebases');
    expect(requirementsCapture).toContain('Preflight Self-Check');
    expect(requirementsCapture).toContain('Would a visual aid');
    expect(decompositionCapture).toContain('type: epic-decomposition');
    expect(decompositionCapture).toContain('## Sub-projects');
    expect(decompositionCapture).toContain('Frontmatter `epic`');
    expect(handoff).toContain('#### 4.0 Terminal State Lock');
    expect(handoff).toContain('Allowlist-Workflow');
    expect(handoff).toContain('Allowlist-SideEffect');
    expect(handoff).toContain('skip future gates');
    expect(handoff).toContain('Share to Proof');
    expect(universalBrainstorming).toContain('/spec:plan');
    expect(universalBrainstorming).toContain('Share to Proof');
    expect(visualCommunication).toContain('The visual describes implementation architecture');
    expect(visualCommunication).toContain('Markdown tables');
  });

  test('runtime transforms preserve host-specific naming and task adaptation', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-brainstorm' });

    expect(claudeRuntime).toContain('name: brainstorm-workflow');
    // All 5 canonical Task names must be rewritten to bare names
    expect(claudeRuntime).toContain('Task local-doc-reader(');
    expect(claudeRuntime).toContain('Task learnings-researcher(');
    expect(claudeRuntime).toContain('Task github-context-reader(');
    expect(claudeRuntime).toContain('Task docs-context-reader(');
    expect(claudeRuntime).toContain('Task web-context-reader(');
    // No canonical namespace must survive in Claude runtime
    expect(claudeRuntime).not.toContain('Task spec-first:research:local-doc-reader(');
    expect(claudeRuntime).not.toContain('Task spec-first:research:learnings-researcher(');
    expect(claudeRuntime).not.toContain('Task spec-first:research:github-context-reader(');
    expect(claudeRuntime).not.toContain('Task spec-first:research:docs-context-reader(');
    expect(claudeRuntime).not.toContain('Task spec-first:research:web-context-reader(');

    expect(codexRuntime).toContain('name: spec-brainstorm');
    // All 5 canonical Task names must be rewritten to Codex path format
    expect(codexRuntime).toContain('`.codex/agents/research/local-doc-reader.md`');
    expect(codexRuntime).toContain('`.codex/agents/research/learnings-researcher.md`');
    expect(codexRuntime).toContain('`.codex/agents/research/github-context-reader.md`');
    expect(codexRuntime).toContain('`.codex/agents/research/docs-context-reader.md`');
    expect(codexRuntime).toContain('`.codex/agents/research/web-context-reader.md`');
    expect(codexRuntime).toContain('Read the explicit local document path(s) relevant to this brainstorm.');
    // No canonical namespace must survive in Codex runtime
    expect(codexRuntime).not.toContain('Task spec-first:research:local-doc-reader(');
    expect(codexRuntime).not.toContain('Task spec-first:research:learnings-researcher(');
    expect(codexRuntime).not.toContain('Task spec-first:research:github-context-reader(');
    expect(codexRuntime).not.toContain('Task spec-first:research:docs-context-reader(');
    expect(codexRuntime).not.toContain('Task spec-first:research:web-context-reader(');
  });
});
