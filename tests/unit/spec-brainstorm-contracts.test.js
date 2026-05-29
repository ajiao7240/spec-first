'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-brainstorm', 'SKILL.md');
const UNIVERSAL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'universal-brainstorming.md',
);
const REQUIREMENTS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'requirements-capture.md',
);
const HANDOFF_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'handoff.md',
);
const SYNTHESIS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'synthesis-summary.md',
);

describe('spec-brainstorm host entrypoint contract', () => {
  test('consumes domain context before questions without fixed ADR directory mandates', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('Domain Language And Decision Ledger');
    expect(skill).toContain('consume existing context before asking questions that repo/docs can answer');
    expect(skill).toContain('already-loaded project standards and host instructions, `docs/contracts/`, existing brainstorms/plans/solutions');
    expect(skill).toContain('Read `AGENTS.md` / `CLAUDE.md` source only under `docs/contracts/context-governance.md`\'s Host Instruction Reuse Policy');
    expect(skill).toContain('repo-local glossary or ADR-like artifacts that actually exist');
    expect(skill).toContain('Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory.');
    expect(skill).toContain('If those artifacts are absent, record the gap as advisory context and continue');
    expect(skill).toContain('`question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`');
    expect(skill).toContain('`confirmed`, `advisory`, `session-local`, `stale`, or `user`');
    expect(skill).toContain('hard to reverse, would be surprising without context, and reflects a real tradeoff');
    expect(skill).not.toContain('must use `CONTEXT.md`');
    expect(skill).not.toContain('must use `docs/adr/`');
  });

  test('constraint check reuses loaded host instructions before reading instruction source', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('*Constraint Check*');
    expect(skill).toContain('Use already-loaded host/project instructions first');
    expect(skill).toContain('Read `AGENTS.md` / `CLAUDE.md` source only when `docs/contracts/context-governance.md`\'s Host Instruction Reuse Policy allows it');
    expect(skill).toContain('If a source read is needed, record the reason briefly');
    expect(skill).not.toContain('Check project instruction files (`AGENTS.md`');
  });

  test('GitNexus context stays lightweight and cannot back-drive requirements', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('GitNexus / graph context');
    expect(skill).toContain('use only lightweight `query` / `context` / read-only resource evidence as session-local pointers');
    expect(skill).toContain('confirm important claims with direct source reads before writing them into requirements');
    expect(skill).toContain('Do not route `impact`, `detect_changes`, route/API/shape/tool/Cypher, provider refresh, `group_sync`, or `rename` through brainstorm by default');
    expect(skill).toContain('Graph evidence must not expand product scope or let implementation details back-drive user-facing requirements.');
  });

  test('planning handoffs use current-host entrypoint wording', () => {
    const combined = [
      fs.readFileSync(SKILL_PATH, 'utf8'),
      fs.readFileSync(UNIVERSAL_PATH, 'utf8'),
      fs.readFileSync(REQUIREMENTS_PATH, 'utf8'),
      fs.readFileSync(HANDOFF_PATH, 'utf8'),
      fs.readFileSync(SYNTHESIS_PATH, 'utf8'),
    ].join('\n');

    expect(combined).toContain('current host\'s plan entrypoint');
    expect(combined).toContain('current host\'s brainstorm entrypoint');
    expect(combined).not.toContain('precedes `/spec:plan`');
    expect(combined).not.toContain('hand off to `/spec:plan`');
    expect(combined).not.toContain('`-> /spec:plan`');
    expect(combined).not.toContain('`-> Resume /spec:brainstorm`');
    expect(combined).not.toContain('/spec:plan` on Claude Code');
    expect(combined).not.toContain('$spec-plan` on Codex');
    expect(combined).not.toContain('/spec:brainstorm on Claude Code');
    expect(combined).not.toContain('$spec-brainstorm on Codex');
  });

  test('synthesis checkpoint is required before requirements capture', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const synthesis = fs.readFileSync(SYNTHESIS_PATH, 'utf8');

    expect(skill).toContain('### Phase 2.5: Synthesis Summary');
    expect(skill).toContain('read `references/synthesis-summary.md`');
    expect(skill).toContain('announce-mode');
    expect(skill).toContain('Do not write the requirements doc in the same turn');
    expect(synthesis).toContain('Three-Bucket Structure');
    expect(synthesis).toContain('**Stated**');
    expect(synthesis).toContain('**Inferred**');
    expect(synthesis).toContain('**Out of scope**');
    expect(synthesis).toContain('## Assumptions');
    expect(synthesis).not.toContain('STRATEGY.md');
    expect(synthesis).not.toContain('/ce-');
  });

  test('requirements template uses Summary and Assumptions without durable Next Steps', () => {
    const text = fs.readFileSync(REQUIREMENTS_PATH, 'utf8');

    expect(text).toContain('| Summary |');
    expect(text).toContain('## Summary');
    expect(text).toContain('## Summary vs Problem Frame discipline');
    expect(text).toContain('## Assumptions');
    expect(text).toContain('behavioral-conditional requirements');
    expect(text).not.toContain('## Next Steps');
    expect(text).not.toContain('`-> current host');
  });

  test('chat handoff uses absolute paths while docs stay portable', () => {
    const text = fs.readFileSync(HANDOFF_PATH, 'utf8');

    expect(text).toContain('Use absolute paths for chat-output file references');
    expect(text).toContain('<absolute path to requirements doc>');
    expect(text).toContain('Generated requirements documents themselves must still use repo-relative file references');
  });

  test('requirements readiness gate replaces the flat finalization checklist with six dimensions', () => {
    const text = fs.readFileSync(REQUIREMENTS_PATH, 'utf8');

    expect(text).toContain('## Requirements Readiness Gate');
    expect(text).toContain('**Clarity & Non-ambiguity**');
    expect(text).toContain('**Evidence & Inference provenance**');
    expect(text).toContain('**Traceability & Coverage**');
    expect(text).toContain('**Testability**');
    expect(text).toContain('**Boundary integrity**');
    expect(text).toContain('**Planning-invention & Handoff readiness**');
    // Lightweight pre-scan absorbed from the predecessor preflight self-check.
    expect(text).toContain('Placeholder scan');
    expect(text).toContain('Contradiction scan');
    // The old flat name must be gone, not duplicated alongside the gate.
    expect(text).not.toContain('## Finalization checklist');
  });

  test('gate preserves load-bearing checks so the refactor loses nothing', () => {
    const text = fs.readFileSync(REQUIREMENTS_PATH, 'utf8');

    // Imperative clauses, not just headers — these are the behavior, locked against silent drift.
    expect(text).toContain('Do Success Criteria cover both human outcome');
    expect(text).toContain('infrastructure is absent');
    expect(text).toContain('invent product behavior');
    // Improvement prompts demoted to a named non-blocking subsection, not dropped.
    expect(text).toContain('Beyond pass/fail');
  });

  test('gate carries provenance and handoff checks', () => {
    const text = fs.readFileSync(REQUIREMENTS_PATH, 'utf8');

    expect(text).toContain('references/synthesis-summary.md');
    expect(text).toContain('must not be presented as a user-confirmed requirement');
    expect(text).toContain('Is `Resolve Before Planning` empty?');
  });

  test('acceptance examples carry triggered EARS-style guidance', () => {
    const text = fs.readFileSync(REQUIREMENTS_PATH, 'utf8');

    expect(text).toContain('EARS-style phrasing');
    expect(text).toContain('When <trigger>, then <observable result>');
    expect(text).toContain('Always-on behavior');
    expect(text).toContain('Structural / governance rule');
    // Triggered, not mandatory — the gate must not force fixed syntax onto every requirement.
    expect(text).toContain('triggered, not mandatory');
  });

  test('gate excludes decomposition and points at the existing size heuristic', () => {
    const text = fs.readFileSync(REQUIREMENTS_PATH, 'utf8');

    expect(text).toContain('decomposed');
    expect(text).toContain('## Size heuristics');
    expect(text).toContain('the gate flags, it does not decide the split');
  });

  test('constraint check scans docs/solutions without back-driving implementation', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('docs/solutions/');
    expect(skill).toContain('prior problem framing and decision rationale');
    expect(skill).toContain('must not let implementation details back-drive user-facing requirements');
  });

  test('pressure test scopes evidence/counterfactual gaps to product-discovery, not engineering evolution', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    // Engineering-evolution brainstorms must not be forced through product-validation probes.
    expect(skill).toContain('For engineering evolution of an existing product or system');
    expect(skill).toContain('this gap is N/A by default');
    expect(skill).toContain('Same N/A-by-default rule for engineering-evolution brainstorms');
    // The 1.3 mandatory-probe clause must stay consistent with the 1.2 N/A carve-out.
    expect(skill).toContain('for engineering-evolution work, evidence and counterfactual are N/A by default');
  });
});
