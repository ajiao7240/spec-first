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
const BRAINSTORM_SECTIONS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'brainstorm-sections.md',
);
const MARKDOWN_RENDERING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'markdown-rendering.md',
);
const HTML_RENDERING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'html-rendering.md',
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
    expect(skill).toContain('If `CONCEPTS.md` exists, treat it as repo-local advisory vocabulary for naming consistency only');
    expect(skill).toContain('it is not a PRD, ADR, workflow contract, source-of-truth override, or setup requirement');
    expect(skill).toContain('Do not require a fixed `CONTEXT.md`, `CONCEPTS.md`, `docs/adr/`, or glossary directory.');
    expect(skill).toContain('If those artifacts are absent, record the gap as advisory context and continue');
    expect(skill).toContain('`question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`');
    expect(skill).toContain('`confirmed`, `advisory`, `session-local`, `stale`, or `user`');
    expect(skill).toContain('hard to reverse, would be surprising without context, and reflects a real tradeoff');
    expect(skill).not.toContain('must use `CONTEXT.md`');
    expect(skill).not.toContain('must use `CONCEPTS.md`');
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

  test('external-tool context stays lightweight and cannot back-drive requirements', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('External-Tool Context');
    expect(skill).toContain('Use only lightweight read-only evidence as session-local pointers');
    expect(skill).toContain('Confirm important claims with direct source reads before writing them into requirements');
    expect(skill).toContain('Do not route mutation, refresh, broad impact, or maintenance operations through brainstorm by default');
    expect(skill).toContain('External-tool evidence must not expand product scope or let implementation details back-drive user-facing requirements.');
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
    expect(synthesis).toContain('Two-stage shape: internal draft, then chat-time scoping synthesis');
    expect(synthesis).toContain('Three-Bucket Structure');
    expect(synthesis).toContain('Do not paste this draft verbatim into chat');
    expect(synthesis).toContain('Stage 2: Chat-Time Scoping Synthesis');
    expect(synthesis).toContain('**What we\'re building**');
    expect(synthesis).toContain('**Key trade-offs**');
    expect(synthesis).toContain('**What\'s not in scope**');
    expect(synthesis).toContain('**Call outs**');
    expect(synthesis).toContain('Path A / Path B Gate');
    expect(synthesis).toContain('Path A — no blocking questions fired and tier is Lightweight');
    expect(synthesis).toContain('Path B — any blocking question fired, or tier is Standard / Deep-feature / Deep-product');
    expect(synthesis).toContain('Follow the local `SKILL.md` announce-mode rule');
    expect(synthesis).toContain('do not write the requirements doc in the same turn');
    expect(skill).toContain('internal three-bucket draft, chat-time scoping shape');
    expect(skill).toContain('compose the internal Stated / Inferred / Out-of-scope draft');
    expect(skill).toContain('emit only the compressed Path A "What we\'re building" / "Proposing" shape');
    expect(synthesis).toContain('Affirmability test');
    expect(synthesis).toContain('Detail test');
    expect(synthesis).toContain('implementation paths, file names, method names, or class names');
    expect(synthesis).toContain('No open scope decisions to weigh in on');
    expect(synthesis).toContain('**Stated**');
    expect(synthesis).toContain('**Inferred**');
    expect(synthesis).toContain('**Out of scope**');
    expect(synthesis).toContain('## Assumptions');
    expect(synthesis).toContain('current-host entrypoint');
    expect(synthesis).not.toContain('STRATEGY.md');
    expect(synthesis).not.toContain('/ce-');
    expect(synthesis).not.toContain('write the requirements doc now');
    expect(synthesis).not.toContain('proceed to Phase 3 doc-write in the same turn');
    expect(skill).not.toContain('emit the Stated / Inferred / Out-of-scope synthesis');
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

  test('requirements section and rendering references keep markdown canonical with optional HTML sidecar only', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const sections = fs.readFileSync(BRAINSTORM_SECTIONS_PATH, 'utf8');
    const markdown = fs.readFileSync(MARKDOWN_RENDERING_PATH, 'utf8');
    const html = fs.readFileSync(HTML_RENDERING_PATH, 'utf8');

    expect(skill).toContain('Read `references/brainstorm-sections.md` for the format-independent content contract');
    expect(skill).toContain('then read `references/requirements-capture.md` for the concrete canonical markdown template and readiness gate.');
    expect(skill).toContain('Read `references/markdown-rendering.md` before writing the canonical markdown requirements document.');
    expect(skill).toContain('Markdown remains the source artifact for `spec-plan`, document review, and future handoff.');
    expect(skill).toContain('optional sidecar only');
    expect(skill).toContain('do not replace the markdown requirements document without focused downstream consumer tests');
    expect(sections).toContain('Markdown requirements documents remain canonical');
    expect(sections).toContain('`requirements-capture.md` remains the concrete markdown template and readiness gate');
    expect(sections).toContain('Brainstorm artifacts have no `active` to `completed` status lifecycle.');
    expect(sections).toContain('optional HTML sidecar');
    expect(markdown).toContain('YAML frontmatter appears at the top');
    expect(markdown).toContain('Markdown stays markdown.');
    expect(markdown).toContain('behavioral-conditional requirements covered by acceptance examples');
    expect(html).toContain('optional HTML sidecar');
    expect(html).toContain('not an exclusive output mode');
    expect(html).toContain('write the markdown requirements document first');
    expect(html).toContain('not add or omit load-bearing content');
    for (const text of [sections, markdown, html]) {
      expect(text).not.toContain('.compound-engineering');
      expect(text).not.toMatch(/\bce-[a-z]/);
      expect(text).not.toContain('output mode is exclusive');
    }
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
