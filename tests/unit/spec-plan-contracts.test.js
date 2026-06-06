'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const { planBundledAssetSync } = require('../../src/cli/plugin');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-plan', 'SKILL.md');
const REQUIREMENTS_CAPTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'requirements-capture.md',
);
const DEEPENING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'deepening-workflow.md',
);
const PLAN_HANDOFF_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'plan-handoff.md',
);
const PLAN_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'plan-template.md',
);
const PLAN_SECTIONS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'plan-sections.md',
);
const MARKDOWN_RENDERING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'markdown-rendering.md',
);
const HTML_RENDERING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'html-rendering.md',
);
const SYNTHESIS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'synthesis-summary.md',
);
const VISUAL_COMMUNICATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'visual-communication.md',
);

function plannedRuntimeContent(adapter, targetPath) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-plan-runtime-'));

  try {
    const { plan } = planBundledAssetSync(projectRoot, adapter);
    const operation = plan.operations.find((entry) => entry.path === targetPath);
    if (!operation) {
      throw new Error(`Missing planned runtime operation for ${targetPath}`);
    }
    return operation.contents;
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}
const UNIVERSAL_PLANNING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'universal-planning.md',
);
describe('spec-plan context orientation contract', () => {
  test('uses direct repo context and preserves LLM decision boundary', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('current user request or requirement');
    expect(text).toContain('package manifests and command registries');
    expect(text).toContain('nearby implementation files');
    expect(text).toContain('nearby tests');
    expect(text).toContain('External tools may prioritize inspection, but they do not define scope authority');
    expect(text).toContain('The LLM still chooses the candidate change surface');
    expect(text).toContain('explicit repo context and source-plan constraints');
    expect(text).toContain('already-loaded host/project instructions');
    expect(text).toContain('`docs/contracts/`, existing brainstorms/plans/solutions');
    expect(text).toContain('not automatic re-read targets for every planning run');
    expect(text).toContain('Written project standards from loaded host instructions, directory-scoped equivalents, or precisely read source files');
    expect(text).toContain('Host Instruction Reuse Policy allows it');
    expect(text).toContain('Maintain a run-local context ledger for this workflow');
    expect(text).toContain('Reuse loaded summaries within the same workflow run');
    expect(text).toContain('Re-read only when exact wording is needed');
    expect(text).not.toContain('`AGENTS.md` / `CLAUDE.md` / project role docs');
    expect(text).not.toContain('docs/examples/standards-glue-consumption-examples.md');
    expect(text).not.toContain('.spec-first/standards/');
    expect(text).not.toContain('glue-map.json');
    expect(text).toContain('target_repo');
    expect(text).toContain('bounded direct reads');
    expect(text).toContain('use bounded direct reads, `rg`, ast-grep, git diff, tests/logs, and user evidence');
    expect(text).toContain('do not let scripts or setup facts choose semantically between child repos');
    expect(text).toContain('A cross-repo plan must name `target_repo` per implementation unit');
    expect(text).not.toContain('stage0-context');
    expect(text).not.toContain('selected_assets');
  });

  test('research and handoff tracker detection avoid full instruction-file reloads', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const handoff = fs.readFileSync(PLAN_HANDOFF_PATH, 'utf8');

    expect(text).toContain('Already-loaded project guidance that materially affects the plan');
    expect(text).toContain('pass only the relevant compact summary to research agents');
    expect(text).not.toContain('AGENTS.md guidance that materially affects the plan');
    expect(handoff).toContain('Check already-loaded project guidance for `project_tracker: github` or `project_tracker: linear`');
    expect(handoff).toContain('perform a precise lookup for `project_tracker:`');
    expect(handoff).toContain('do not read the full instruction file just to detect the tracker');
    expect(handoff).not.toContain('Read `AGENTS.md` (or `CLAUDE.md` for compatibility)');
  });

  test('consumes domain context before planning questions without fixed ADR directory mandates', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Domain Language And Decision Ledger');
    expect(text).toContain('consume existing context before asking questions that repo/docs can answer');
    expect(text).toContain('already-loaded project standards and host instructions, `docs/contracts/`, existing brainstorms/plans/solutions');
    expect(text).toContain('Read `AGENTS.md` / `CLAUDE.md` source only under the Host Instruction Reuse Policy');
    expect(text).toContain('repo-local glossary or ADR-like artifacts that actually exist');
    expect(text).toContain('If `CONCEPTS.md` exists, treat it as repo-local advisory vocabulary for naming consistency only');
    expect(text).toContain('it is not a PRD, ADR, workflow contract, source-of-truth override, or setup requirement');
    expect(text).toContain('Do not require a fixed `CONTEXT.md`, `CONCEPTS.md`, `docs/adr/`, or glossary directory.');
    expect(text).toContain('If those artifacts are absent, record the gap as advisory context and continue');
    expect(text).toContain('`question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`');
    expect(text).toContain('`confirmed`, `advisory`, `session-local`, `stale`, or `user`');
    expect(text).toContain('hard to reverse, would be surprising without context, and reflects a real tradeoff');
    expect(text).not.toContain('must use `CONTEXT.md`');
    expect(text).not.toContain('must use `CONCEPTS.md`');
    expect(text).not.toContain('must use `docs/adr/`');
  });

  test('prd-grade handoff entropy check routes unresolved WHAT gaps back to PRD', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('PRD handoff entropy check');
    expect(text).toContain('canonical term');
    expect(text).toContain('source-of-truth');
    expect(text).toContain('domain ownership');
    expect(text).toContain('hard decision consequence');
    expect(text).toContain('`## Feature Slices`');
    expect(text).toContain('preserve feature IDs');
    expect(text).toContain('requirement refs');
    expect(text).toContain('acceptance refs');
    expect(text).toContain('source/evidence pointers');
    expect(text).toContain('PRD-origin trace, not a new planning-owned artifact class');
    expect(text).toContain('missing slice acceptance');
    expect(text).toContain('missing slice source');
    expect(text).toContain('missing slice scope');
    expect(text).toContain('route to PRD refine or emit an inline PRD feedback candidate');
    expect(text).toContain('do not run a separate grill workflow in `spec-plan`');
    expect(text).toContain('do not copy the full `spec-prd` readiness lens or Feature Slice Pack');
    expect(text).toContain('do not generate program slices or task packs during planning');
    expect(text).toContain('do not auto-write back to the PRD');
    expect(text).not.toContain('Domain Grill workflow');
  });

  test('uses Direct Evidence Readiness without hidden evidence gates', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const template = fs.readFileSync(PLAN_TEMPLATE_PATH, 'utf8');
    const combined = `${text}\n${template}`;

    expect(text).toContain('#### 1.1a Direct Evidence Readiness');
    expect(text).toContain('collect bounded direct evidence');
    expect(text).toContain('Use this block to disclose what was actually read or verified.');
    expect(text).toContain('Do not claim repository-wide impact coverage from a narrow search.');
    expect(text).toContain('Do not add hidden pre-facts or external-tool evidence envelopes.');
    expect(combined).toContain('## Direct Evidence Readiness');
    expect(combined).toContain('## Direct Evidence');
    const readinessHeadingIndex = template.search(/^## Direct Evidence Readiness$/m);
    const directEvidenceHeadingIndex = template.search(/^## Direct Evidence$/m);
    const contextHeadingIndex = template.search(/^## Context & Research$/m);
    expect(readinessHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(directEvidenceHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(contextHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(readinessHeadingIndex).toBeLessThan(directEvidenceHeadingIndex);
    expect(directEvidenceHeadingIndex).toBeLessThan(contextHeadingIndex);
    for (const field of [
      '- target_repo:',
      '- evidence_sources:',
      '- source_refs:',
      '- current_revision:',
      '- worktree_status:',
      '- confidence:',
      '- limitations:',
      '- repo_scope:',
      '- source_reads_completed:',
      '- impact_on_plan:',
      '- source_reads_required:',
      '- commands_or_tools_used:',
      '- key_findings:',
    ]) {
      expect(combined).toContain(field);
    }
    expect(text).toContain('Do not create a hidden reviewer facts pipeline');
    expect(text).toContain('use bounded direct reads, `rg`, ast-grep, git diff, tests/logs, and user evidence');
    expect(text).toContain('do not turn rejected rationale into active workflow state');
  });
  test('planning research dispatch is host-neutral with explicit inline fallback', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Planning research agents are read-only.');
    expect(text).toContain('A direct plan workflow invocation authorizes this documented research phase when host capability exists');
    expect(text).toContain('do not ask for a second subagent confirmation');
    expect(text).toContain('including `spawn_agent` where provided');
    expect(text).toContain('Do not downgrade solely because the host is Codex.');
    expect(text).toContain('run the same research sequentially in the current agent');
    expect(text).toContain('applying it inline as an explicit fallback');
    expect(text).toContain('Plan generation must still complete when research dispatch is unavailable');
    expect(text).toContain('Dispatch these read-only research agents in parallel when available');
    expect(text).toContain('`spec-repo-research-analyst`');
    expect(text).toContain('`spec-learnings-researcher`');
    expect(text).toContain('`spec-best-practices-researcher`');
    expect(text).toContain('`spec-framework-docs-researcher`');
    expect(text).toContain('`spec-spec-flow-analyzer`');
    expect(text).not.toContain('Task spec-repo-research-analyst');
    expect(text).not.toContain('Task spec-learnings-researcher');
    expect(text).not.toContain('Task spec-best-practices-researcher');
    expect(text).not.toContain('Task spec-framework-docs-researcher');
    expect(text).not.toContain('Task spec-spec-flow-analyzer');
    expect(text).not.toContain('`Task` / `Agent` on Claude Code, or `spawn_agent` on Codex');
  });

  test('deepening research fallback distinguishes sequential dispatch from inline current-agent fallback', () => {
    const text = fs.readFileSync(DEEPENING_PATH, 'utf8');

    expect(text).toContain('supports dispatch but not parallel dispatch');
    expect(text).toContain('run the same selected agents sequentially through the host dispatch primitive');
    expect(text).toContain('If dispatch is unavailable, explicitly disabled, or unsafe');
    expect(text).toContain('perform the selected research sequentially in the current agent');
    expect(text).toContain('dispatch_fallback: inline-current-agent');
  });

  test('planning can recommend workers only behind a suitability gate', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Implementation Worker Suitability Gate');
    expect(text).toContain('Planning may recommend later worker delegation, but it must not dispatch implementation workers or create a hidden implement/check lifecycle.');
    expect(text).toContain('A worker is suitable only when the scope is clear, the write set can be bounded, verification commands are known, no product/architecture blocker remains, and no sensitive/security-critical ambiguity is unresolved.');
    expect(text).toContain('If any condition is missing, keep the task local to `spec-work`, return to planning, or require a smaller task pack slice.');
    expect(text).toContain('Review autofix and mutation are off unless a documented workflow mode or explicit user choice authorizes them.');
    expect(text).not.toContain('always dispatch implementation workers');
    expect(text).not.toContain('hidden implement/check lifecycle for every plan');
  });
});

describe('spec_id planning contract', () => {
  test('requirements capture creates a local spec chain identity without a registry', () => {
    const text = fs.readFileSync(REQUIREMENTS_CAPTURE_PATH, 'utf8');

    expect(text).toContain('spec_id: YYYY-MM-DD-NNN-<kebab-case-topic>');
    expect(text).toContain('docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md');
    expect(text).toContain('Ignore legacy non-sequenced files when choosing the next number');
    expect(text).toContain('not a central registry');
    expect(text).toContain('frontmatter is the machine-readable contract');
  });

  test('plan inherits spec_id, handles legacy origins, and preserves chain boundaries', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const template = fs.readFileSync(PLAN_TEMPLATE_PATH, 'utf8');
    const combined = `${text}\n${template}`;

    expect(text).toContain('Preserve it exactly in the plan frontmatter');
    expect(text).toContain('Generate a new plan-local `spec_id`');
    expect(text).toContain('origin identity was not inherited');
    expect(text).toContain('scan `docs/brainstorms/`, `docs/plans/`, and `docs/tasks/` frontmatter');
    expect(text).toContain('If the same `spec_id` already exists');
    expect(text).toContain('alternative implementation plans, independent delivery chains, or abandon-and-replace work');
    expect(text).toContain('`artifact_kind: prd-requirements`');
    expect(text).toContain('PRD-grade requirements origin');
    expect(text).toContain('R/F/AE');
    expect(text).toContain('trace self-check summary');
    expect(text).toContain('`document_role: split-summary`');
    expect(text).toContain('`document_role: child-prd`');
    expect(combined).toContain('spec_id: YYYY-MM-DD-NNN-<slug>');
    expect(combined).toContain('origin: docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md');
  });

  test('deepening preserves spec_id rather than creating a new chain', () => {
    const text = fs.readFileSync(DEEPENING_PATH, 'utf8');

    expect(text).toContain('deepening strengthens the same plan and must preserve it');
    expect(text).toContain('Preserve the existing `spec_id` frontmatter value');
    expect(text).toContain('Use a new `spec_id` only when deliberately creating a new spec chain outside the deepening path');
  });

  test('handoff work entrypoint remains host-neutral', () => {
    const text = fs.readFileSync(PLAN_HANDOFF_PATH, 'utf8');
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s work entrypoint');
    expect(text).toContain('`Start work`, `Compile task pack`, or `Create Issue`');
    expect(text).toContain('Invoke the current host\'s work entrypoint');
    expect(text).toContain('<absolute path to plan>');
    expect(skill).toContain('Act on the user\'s selection');
    expect(skill).toContain('routed action has executed or been explicitly declined');
    expect(text).not.toContain('`Start /spec:work`, `Compile task pack`, or `Create Issue`');
    expect(skill).toContain('**Start work** (recommended)');
    expect(skill).toContain('current host\'s work entrypoint');
    expect(skill).not.toContain('**Start `/spec:work`** (recommended)');
    expect(text).not.toContain('/spec:work <plan-path>` on Claude Code');
    expect(text).not.toContain('$spec-work <plan-path>` on Codex');
    expect(text).not.toContain('/spec:work <task-pack-path>` on Claude Code');
    expect(text).not.toContain('$spec-work <task-pack-path>` on Codex');
    expect(text).not.toContain('`/spec:work` on Claude Code, `$spec-work` on Codex');
  });

  test('task-pack handoff recommendation is decisive while staying user-confirmed', () => {
    const handoff = fs.readFileSync(PLAN_HANDOFF_PATH, 'utf8');
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const combined = `${handoff}\n${skill}`;

    expect(combined).toContain('**Compile task pack with `spec-write-tasks`** - Recommended when source plan structure shows high execution complexity');
    expect(combined).toContain('many implementation units, declared `Files`, dependency chains, cross-module surfaces, broad verification spread, or `plan_depth: deep`');
    expect(combined).toContain('this reduces single-run context load, broad review scope, and coupled rollback cost');
    expect(handoff).toContain('Load the standalone `spec-write-tasks` skill with the plan path.');
    expect(handoff).toContain('If it writes an executable task pack with matching `spec_id` and verifiable `source_plan_hash`');
    expect(handoff).not.toContain('Use the standalone skill when the plan is large, dependency-heavy');
    expect(skill).not.toContain('Use the standalone skill when the plan is large, dependency-heavy');
    expect(combined).not.toContain('automatically run `spec-write-tasks`');
    expect(combined).not.toContain('$spec-write-tasks');
    expect(combined).not.toContain('/spec:write-tasks');
  });

  test('plan synthesis checkpoints and template naming are in place', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const planTemplate = fs.readFileSync(PLAN_TEMPLATE_PATH, 'utf8');
    const planSections = fs.readFileSync(PLAN_SECTIONS_PATH, 'utf8');
    const markdownRendering = fs.readFileSync(MARKDOWN_RENDERING_PATH, 'utf8');
    const htmlRendering = fs.readFileSync(HTML_RENDERING_PATH, 'utf8');
    const synthesis = fs.readFileSync(SYNTHESIS_PATH, 'utf8');
    const deepening = fs.readFileSync(DEEPENING_PATH, 'utf8');
    const visual = fs.readFileSync(VISUAL_COMMUNICATION_PATH, 'utf8');

    expect(skill).toContain('#### 0.7 Solo-Mode Scope Summary');
    expect(skill).toContain('#### 5.1.5 Brainstorm-Sourced Scope Summary');
    expect(skill).toContain('read `references/synthesis-summary.md`');
    expect(planTemplate).toContain('## Summary');
    expect(planTemplate).toContain('## Requirements');
    expect(planTemplate).toContain('treat `## Overview` as the legacy name');
    expect(planTemplate).toContain('legacy `## Requirements Trace`');
    expect(planTemplate).toContain('## Assumptions');
    expect(planTemplate).toContain('Include only for unconfirmed inferred bets');
    expect(planTemplate).toContain('Keep these out of Key Technical Decisions and Implementation Units');
    expect(skill).toContain('Read `skills/spec-plan/references/plan-sections.md` before writing the plan.');
    expect(skill).toContain('Read `skills/spec-plan/references/markdown-rendering.md` before writing the canonical markdown plan.');
    expect(skill).toContain('Read `skills/spec-plan/references/plan-template.md` before writing the plan.');
    expect(skill).toContain('Do not reconstruct the template from memory and do not inline the full template in this skill.');
    expect(skill).toContain('Markdown remains the source artifact for `spec-work`, `spec-write-tasks`, `spec-doc-review`, and plan deepening.');
    expect(skill).toContain('optional sidecar only');
    expect(skill).toContain('do not replace the markdown plan without focused downstream consumer tests');
    expect(planSections).toContain('Markdown remains the canonical plan artifact.');
    expect(planSections).toContain('`plan-template.md` is still the concrete markdown skeleton');
    expect(planSections).toContain('`spec-work`, `spec-write-tasks`, and `spec-doc-review` can consume');
    expect(planSections).toContain('optional HTML sidecar');
    expect(planSections).toContain('not an exclusive output mode');
    expect(markdownRendering).toContain('YAML frontmatter appears at the top of the file');
    expect(markdownRendering).toContain('Markdown stays markdown');
    expect(markdownRendering).toContain('Use H3 headings for implementation units: `### U1. [Name]`');
    expect(htmlRendering).toContain('optional HTML sidecar');
    expect(htmlRendering).toContain('not an exclusive output mode');
    expect(htmlRendering).toContain('write the markdown plan first');
    expect(htmlRendering).toContain('not add or omit load-bearing content');
    for (const text of [planSections, markdownRendering, htmlRendering]) {
      expect(text).not.toContain('.compound-engineering');
      expect(text).not.toMatch(/\bce-[a-z]/);
      expect(text).not.toContain('output mode is exclusive');
    }
    const template = fs.readFileSync(PLAN_TEMPLATE_PATH, 'utf8');
    expect(template.indexOf('## Requirements')).toBeLessThan(template.indexOf('## Assumptions'));
    expect(template.indexOf('## Assumptions')).toBeLessThan(template.indexOf('## Scope Boundaries'));
    expect(template).toContain('### U1. [Name]');
    expect(template).not.toContain('- U1. **[Name]**');
    expect(skill).toContain('Use `### U1. [Name]` heading-style implementation units for new plans.');
    expect(skill).toContain('continue to recognize legacy `- U1. **[Name]**` list-item units as valid anchors.');
    expect(synthesis).toContain('Solo variant (Phase 0.7)');
    expect(synthesis).toContain('Brainstorm-sourced variant (Phase 5.1.5)');
    expect(synthesis).toContain('Two-stage shape: internal draft, then chat-time synthesis');
    expect(synthesis).toContain('Do not paste this draft verbatim into chat');
    expect(synthesis).toContain('Stage 2: Chat-Time Scoping Synthesis');
    expect(synthesis).toContain('No user-facing **Stated** or **Out of scope** bucket appears in chat');
    expect(synthesis).toContain('Call outs');
    expect(synthesis).toContain('Auto-proceed is allowed only when plan depth is Lightweight and zero Call outs survive the keep test');
    expect(synthesis).toContain('For Standard or Deep plans, always fire the confirmation gate even when zero Call outs survive');
    expect(synthesis).toContain('affirmability test');
    expect(synthesis).toContain('detail test');
    expect(synthesis).toContain('Implementation Units, PR count, branch sequencing, effort estimates, or test command recipes');
    expect(synthesis).toContain('exact JSON or response shapes');
    expect(synthesis).toContain('bare origin IDs such as `R1`, `AE2`, `F3`, or `U4` without plain names');
    expect(synthesis).toContain('Do not route unconfirmed inferences into Key Technical Decisions or Implementation Units');
    expect(synthesis).toContain('current host\'s brainstorm entrypoint');
    expect(synthesis).toContain('## Assumptions');
    expect(deepening).toContain('**Requirements**');
    expect(deepening).toContain('Requirements / Open Questions classification');
    expect(visual).toContain('Summary or Problem Frame');
    expect([skill, synthesis].join('\n')).not.toContain('STRATEGY.md');
    expect([skill, synthesis].join('\n')).not.toContain('/ce-');
    expect(synthesis).not.toContain('/ce-brainstorm');
    expect(synthesis).not.toContain('/ce-plan');
  });

  test('Claude command projection points plan template reference at the workflow runtime copy', () => {
    const command = plannedRuntimeContent(new ClaudeAdapter(), '.claude/commands/spec/plan.md');

    expect(command).toContain('Read `.claude/spec-first/workflows/spec-plan/references/plan-sections.md` before writing the plan.');
    expect(command).toContain('Read `.claude/spec-first/workflows/spec-plan/references/markdown-rendering.md` before writing the canonical markdown plan.');
    expect(command).toContain('Read `.claude/spec-first/workflows/spec-plan/references/plan-template.md` before writing the plan.');
    expect(plannedRuntimeContent(new ClaudeAdapter(), '.claude/spec-first/workflows/spec-plan/references/plan-sections.md')).toContain('Markdown remains the canonical plan artifact.');
    expect(plannedRuntimeContent(new ClaudeAdapter(), '.claude/spec-first/workflows/spec-plan/references/markdown-rendering.md')).toContain('Markdown stays markdown');
    expect(plannedRuntimeContent(new ClaudeAdapter(), '.claude/spec-first/workflows/spec-plan/references/html-rendering.md')).toContain('optional HTML sidecar');
    expect(command).not.toContain('Read `references/plan-template.md` before writing the plan.');
    expect(command).not.toContain('Read `skills/spec-plan/references/plan-template.md` before writing the plan.');
  });

  test('universal planning avoids slash-only handoff wording', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const text = fs.readFileSync(UNIVERSAL_PLANNING_PATH, 'utf8');

    expect(skill).toContain('For software and plan-seeking tasks, this workflow produces a durable implementation or structured plan.');
    expect(skill).toContain('For non-software answer-seeking tasks routed through `references/universal-planning.md`, it uses planning as the working scaffold and answers in chat without writing a plan file by default.');
    expect(skill).toContain('for non-software answer-seeking tasks, an evidence-grounded chat answer with no plan artifact by default');
    expect(skill).toContain('Non-software answer-seeking tasks create no durable artifact unless the user asks to save the result.');
    expect(text).toContain('current host\'s plan entrypoint');
    expect(text).toContain('software work entrypoint');
    expect(text).toContain('The user invoked the plan workflow');
    expect(text).toContain('Disposition: Plan-Seeking vs. Answer-Seeking');
    expect(text).toContain('**Plan-seeking**');
    expect(text).toContain('**Answer-seeking**');
    expect(text).toContain('state a brief plan of attack in chat, execute it, then deliver the answer');
    expect(text).toContain('No plan file is written unless the user asks to save the result');
    expect(text).toContain('Ground answers about the user\'s own code, repo, CLI, service, or named artifact in direct source reads, not memory');
    expect(text).toContain('Code changes belong in the software work entrypoint');
    expect(text).toContain('Do not write a plan file and do not run the Step 3 save/share menu by default');
    expect(text).toContain('Veil Of Value');
    expect(text).not.toContain('Use `/spec:plan` directly');
    expect(text).not.toContain('The user invoked `/spec:plan`');
    expect(text).not.toContain('Do not offer `/spec:work`');
    expect(text).not.toContain('/ce-plan');
    expect(text).not.toContain('/ce-work');
    expect(text).not.toContain('/spec:plan` on Claude Code');
    expect(text).not.toContain('$spec-plan` on Codex');
    expect(text).not.toContain('/spec:work` on Claude Code');
    expect(text).not.toContain('$spec-work` on Codex');
  });
});
