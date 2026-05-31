---
name: spec-prd
description: "Create, refine, or validate brownfield PRD-grade requirements for existing systems before implementation planning."
argument-hint: "[increment request, existing PRD path, or validation target]"
---

# Brownfield PRD Requirements

**Note: The current year is 2026.** Use this when dating PRD requirements documents.

`spec-prd` turns an existing-system increment, rough product note, or low-quality PRD into PRD-grade requirements that the current host's plan workflow can consume without inventing WHAT.

The default durable output is a Markdown requirements document under `docs/brainstorms/*-requirements.md` with `artifact_kind: prd-requirements`. Do not create `docs/prds/`. Do not implement code or write implementation plans.

All file references in generated documents must use repo-relative paths. Absolute local paths make artifacts non-portable.

## Workflow Contract Summary

### When To Use

Use for brownfield increment PRD authoring, existing PRD refinement, and code-aware PRD validation when the product owner already knows the existing product/system surface being changed.

### When Not To Use

Do not use for 0-1 product exploration, unresolved product shape, implementation planning, task execution, debugging, PRD/Figma/source audit, or requests that only need a lightweight direct fix.

### Inputs

An increment request, existing PRD or requirements draft, rough Markdown notes, source/docs evidence, current-system context, domain terms, and product-owner decisions.

### Outputs

A PRD-grade requirements artifact, a compact PRD bypass/handoff, a split-decision summary pending owner confirmation, or a validation/refine report with minimal blocking questions.

### Artifacts

Requirements artifacts under `docs/brainstorms/` using `artifact_kind: prd-requirements`, optional split summary and child PRDs for owner-confirmed oversized initial PRDs, and no generated runtime mirror edits.

### Failure Modes

Missing target surface, unresolved product identity, current-state claims without evidence, owner decisions that would change scope, stale graph evidence presented as confirmed truth, or PRD readiness gaps that would force planning to invent WHAT.

### Workflow

Classify intent and input mode, gather current-state evidence, confirm the change delta, ask the smallest blocking product questions, draft or refine the PRD, run readiness, then hand off to refine, doc review, plan, or done.

### Downstream Consumers

`spec-plan`, `spec-doc-review`, product owners, implementation reviewers, and future work/review flows that need stable PRD-grade WHAT/WHY context.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

## Invocation Boundary

This is a workflow orchestrator, not an agent type. Use the current host's PRD workflow entrypoint when routing into it. Do not expose helper reviewers or readiness checks as separate public entrypoints.

## Core Principles

1. **Brownfield first** - Establish the current system snapshot before writing new behavior.
2. **WHAT not HOW** - Product behavior, acceptance, scope, evidence, and business constraints belong here. Implementation units, database tables, exact API fields, and task breakdown belong in planning.
3. **Evidence-tag current-state claims** - A current-state assertion is confirmed only when source, tests, docs, contracts, or user confirmation supports it.
4. **Minimize blocking** - Ask the one current question that most affects scope, behavior, or acceptance. Combine only a few tightly related questions when separating them would waste a turn.
5. **Right-size output** - Small increments may get a compact PRD. Oversized initial PRDs get split advice first; child PRDs are written only after owner confirmation.
6. **No second artifact topology** - Keep the spec-first chain: `docs/brainstorms/*-requirements.md` -> plan -> tasks -> work -> review -> knowledge.

## Reference Loading

Load these references only when the phase needs them:

- `references/intent-routing.md` for input classification, create/refine/validate intent, route-outs, and split-decision rules.
- `references/current-state-analysis.md` before writing current-state or Change Delta claims.
- `references/domain-language-and-decision-ledger.md` when terminology, domain boundaries, or source/user contradictions matter.
- `docs/contracts/domain-glossary.md` when it exists — the project-level canonical glossary, read before introducing or naming domain terms so prior-PRD canonical terms are reused, not reinvented. Optional and opt-in; absence is fine for a single small increment.
- `references/prd-output-template.md` before drafting or materially rewriting a PRD artifact.
- `references/domain-lenses.md` when selecting App, H5/PC, Admin, Backend/Java, CLI/DevTool, Mixed, or project-local industry overlays.
- `references/prd-readiness-lens.md` before final handoff to planning or doc review.
- `templates/standard/README.md` and the one relevant `templates/standard/*.md` file when a concrete PRD template is needed. These templates are bundled with the workflow assets so packaged installs do not depend on this repository's `docs/` tree.

## Input

<prd_input> #$ARGUMENTS </prd_input>

If the input is empty, ask for the target increment or existing PRD path before proceeding.

## Execution Flow

### Phase 0: Classify Intent And Input Mode

Read `references/intent-routing.md`.

Classify the run as:

- `create` - turn a brownfield increment into PRD-grade requirements.
- `refine` - improve an existing PRD or requirements draft.
- `validate` - check whether an existing PRD can be handed to planning.

`code-align` is not a fourth public intent. Treat it as validation posture: code/source evidence can reveal mismatch, but the output remains a PRD validation/refine report or PRD update.

Handle input modes explicitly:

- Existing `artifact_kind: prd-requirements` draft: resume it, preserve `spec_id`, preserve existing R/AE/BR/NFR IDs, and append new IDs after the current maximum.
- Other Markdown: treat it as reference material, not as an already valid PRD.
- Plan/design/task document: route or hand off instead of pretending it is PRD source.
- Pure text increment: create a new PRD-grade requirements artifact when durable handoff is valuable.
- Clear bugfix, small script, or already-settled technical approach: offer compact PRD, plan, or work handoff instead of forcing full PRD ceremony.

### Phase 1: Current-State Analysis

Read `references/current-state-analysis.md`.

Gather scope-appropriate evidence:

- User-stated facts and decisions.
- Repo source, docs, tests, contracts, templates, and prior requirements/plans.
- GitNexus only as session-local orientation or `gitnexus-pointer` when stale, dirty, or impact-unavailable.
- External research only when explicitly requested or required, with source/date.
- Assumptions only when labeled and safe to carry.

Write or update `Current System Snapshot` only for claims that affect the PRD. Unsupported current-state claims go to `Evidence And Assumptions` or `Outstanding Questions`.

### Phase 2: Change Delta And Domain Language

Confirm the increment as `keep`, `extend`, `replace`, `remove`, or `unknown`. Do not let current-state discovery expand the product scope silently.

When domain terminology is ambiguous, read `references/domain-language-and-decision-ledger.md`. Prefer source-first questioning: if existing docs/code can answer a terminology or behavior question, inspect them before asking the owner. When `docs/contracts/domain-glossary.md` exists, read it first so canonical terms established by prior PRDs are reused; if a new term conflicts with a canonical entry, surface the contradiction rather than drifting. If user wording conflicts with confirmed source, record the contradiction, source tag, recommended default, and one minimal owner confirmation question. When a domain-specific term has been sharpened across two or more PRDs, propose promoting it to the project glossary preview-first (owner-confirmed write only).

### Phase 3: Draft, Refine, Or Split

Read `references/prd-output-template.md` and `references/domain-lenses.md`. When drafting from a concrete template, read `templates/standard/README.md` and then the smallest relevant template:

- `templates/standard/00-通用增量需求模板.md` for the default generic skeleton.
- `templates/standard/10-App客户端需求模板.md` for App/client PRDs.
- `templates/standard/20-Admin中后台需求模板.md` for Admin/back-office PRDs.
- `templates/standard/30-Backend中台服务需求模板.md` for Backend/Java PRDs.
- Project-local overlay docs when the owner or project context calls for industry/team/compliance checks.

Use core sections for every normal PRD:

- Summary
- Change Delta
- Requirements
- Acceptance Examples
- Scope Boundaries
- Evidence And Assumptions

Include conditional sections only when they reduce planning invention: Problem Frame, Current System Snapshot, Goals / Success Metrics, Glossary, Decision Notes, Actors, Use Cases, Interaction Requirements, Exception Handling, Data / Compliance Boundaries, Release / Operation Readiness, and Outstanding Questions.

For oversized initial PRDs, produce a split-decision recommendation first. Write split summary and child PRDs only when the owner confirms module boundaries, priorities, and release sequencing. Keep the original PRD or source input by reference; do not introduce packet manifests or trace-ledgers in v1.

### Phase 4: Readiness And Handoff

Read `references/prd-readiness-lens.md`.

Run the readiness lens before recommending planning:

- If ready, hand off to the current host's plan workflow.
- If gaps are narrow, ask the smallest blocking question or revise with clearly labeled assumptions.
- If the document needs independent critique, hand off to the current host's document-review workflow.
- If the input is better served by brainstorm, app consistency audit, debug, plan, or work, route out with a short reason.

Close with a PRD summary: included sections, requirement count, acceptance example count, priority distribution, NFR/assumption/outstanding count, trace gaps, and whether planning would still have to invent WHAT.
