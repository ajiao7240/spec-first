# PRD Output Template

Load this reference before drafting or materially rewriting a PRD artifact.

This file owns the output shape, section skeleton, surface lenses, and embedded standard template cues. Do not create a second packaged template tree for the same rules.

## Default Frontmatter

```yaml
---
spec_id: YYYY-MM-DD-NNN-<slug>
artifact_kind: prd-requirements
target_surface: generic
status: draft
evidence_grade: mixed
created: YYYY-MM-DD
---
```

Default path: `docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md`.

`artifact_kind: prd-requirements` marks a PRD-grade requirements origin that the current host's plan workflow can consume as requirements. Do not create `docs/prds/`.

## Output Shape

Choose the lightest output that prevents downstream planning from inventing WHAT:

| Shape | Use when | Default content |
| --- | --- | --- |
| `bypass` | The request is a clear bugfix, tiny script/docs edit, or implementation-ready task where PRD ceremony adds no durable value. | No PRD artifact; provide a compact plan/work handoff. |
| `compact-prd` | A small brownfield increment needs durable WHAT trace but no broad surface or topology risk. | Core sections only, plus minimal evidence and assumptions. |
| `normal-prd` | An ordinary product/system increment needs planning-ready requirements, acceptance, and scope. | Core sections plus triggered surface/domain sections. |
| `topology-heavy-prd` | Workflow, contract, migration, replace, remove, source-of-truth, or mixed-surface changes could leave active surfaces or consumers ambiguous. | Core sections plus topology, surface map, producer/consumer, source-of-truth, negative acceptance, and decision notes as needed. |

The selected shape is run-local authoring posture, not frontmatter, schema, or a second artifact taxonomy.

## Core Sections

Every normal PRD includes:

- `## Summary`
- `## Change Delta`
- `## Requirements`
- `## Acceptance Examples`
- `## Scope Boundaries`
- `## Evidence And Assumptions`

Compact PRDs may omit non-load-bearing detail but still need enough acceptance and scope boundary for planning. Bypass output writes no PRD artifact.

## Conditional Sections

Include these only when they reduce planning invention:

- `## Problem Frame`
- `## Current System Snapshot`
- `## Change Topology`
- `## Surface Map`
- `## Producer / Artifact / Consumer`
- `## Source-Of-Truth Resolution`
- `## Negative Acceptance`
- `## Goals / Success Metrics`
- `## Glossary`
- `## Decision Notes`
- `## Actors`
- `## Use Cases`
- `## Interaction Requirements`
- `## Exception Handling`
- `## Data / Compliance Boundaries`
- `## Release / Operation Readiness`
- `## Outstanding Questions`
- `## Feature Slices`

Success Metrics are conditional. When present, each goal should be measurable: metric, target value, and when available, current baseline and measurement window, with leading/lagging type for core goals. If there is no credible metric source, write an observable measurement口径 or record the assumption; do not invent target values.

## Surface Lenses

Select one primary lens, then add secondary lenses only for real mixed-surface changes.

| Surface | Add these product questions |
| --- | --- |
| App | entry point, navigation, state, copy, loading/empty/error, permissions, release/gray rollout, accessibility, i18n, risk or confirmation steps |
| H5/PC | routes, form behavior, browser back/refresh, responsive viewports, login/session state, sharing/SEO if relevant |
| Admin | menu placement, roles/permissions, list/search/filter/export, form validation, review flow, audit trail, bulk action, four-eyes/maker-checker when relevant |
| Backend/Java | product-level state semantics, idempotency expectations, compatibility, transaction-visible outcomes, error semantics, observability expectations, operational readiness |
| CLI/DevTool | command entry, arguments/config, dry-run or preview-first behavior, logs, cross-platform behavior, failure recovery, upgrade/migration path |
| Mixed | source-of-truth, cross-surface consistency, contract expectation, async sync, degradation, end-to-end acceptance, ownership boundary |

These are surface lenses, not role taxonomies. They ask PRD questions; they do not prescribe implementation units.

## Project-Local Overlays

When a project has local templates, standards, glossary, compliance docs, or industry appendices:

1. Read only the relevant section.
2. Treat it as a project-local overlay.
3. Record which overlay was applied.
4. Ask for confirmation when the overlay suggests legal, compliance, money movement, privacy, or safety implications.

Missing local overlay docs are a graceful absence, not an error and not permission to invent industry rules. Do not treat template industry facts as confirmed project rules; local templates raise questions until source or owner confirmation resolves them.

## Industry Overlay Triggers

When the increment's industry context is clear from input or project docs, layer an industry overlay on top of the surface lens. The overlay only raises questions and triggers conditional sections; it never asserts an industry rule as confirmed truth.

| Industry context | Raise these questions |
| --- | --- |
| Securities / trading | order/position state semantics, trading-window and market rules, risk control, clearing/settlement, audit trail, regulatory disclosure |
| Credit / lending | approval flow and limits, risk/anti-fraud gates, interest/fee rules, repayment and overdue states, compliance and data-retention boundaries |
| Admin / mid-back-office | data scope isolation, review and maker-checker flow, bulk action, export, audit log |
| Backend / platform service | state semantics, idempotency, compatibility/versioning, transaction-visible outcomes, observability and operational readiness |

If no industry context is detectable, skip this section and use the generic surface lens only.

## Adaptive Product Expert Lens

Use this run-local lens for existing PRD refinement, validation, or any input asking for product-expert critique. It is not an agent type, persona taxonomy, scoring schema, or separate reviewer workflow.

Infer the lens from the current surface, industry context, business objective, affected code/docs/tests, and owner-stated constraints. Then inspect the PRD against these dimensions:

- user/problem/outcome clarity, including who benefits and what changes in observable behavior
- current-state and code alignment, including confirmed source, source-candidate limits, contradictions, and missing active surfaces; this confirms current WHAT and evidence pointers, not HOW to change implementation
- requirement quality: atomic, necessary, prioritized, testable, implementation-free, and traceable to evidence; use INVEST as an explanatory anchor when it clarifies quality, not as a scoring rubric
- acceptance coverage: happy path, exception path, negative acceptance, permissions, empty/loading/error, and cross-surface effects when relevant; use EARS or Gherkin-style wording only when it reduces ambiguity
- goals and metrics: measurable口径, baseline/window when available, no invented target values
- industry/domain overlay: compliance, money movement, privacy, safety, audit, and operational questions only when triggered
- scope and handoff entropy: non-goals, dependencies, rollout/ops boundaries, and remaining WHAT decisions

This lens adapts the questions; it does not relax the evidence rules or replace owner confirmation for scope-changing product decisions.

This lens is the canonical PRD quality-dimension list. Entrypoint and readiness prose should reference it by name and add only meta-checks such as lens fit, suggestion closure, rewrite integrity, or handoff entropy.

## Embedded Standard Skeleton

Use this skeleton as the packaged runtime template. It replaces the former separate template tree.

```markdown
## Summary

<One paragraph: actor, increment, intended outcome, and current system anchor.>

## Change Delta

| item | current | target | delta | evidence |
| --- | --- | --- | --- | --- |

## Requirements

| id | priority | requirement | rationale/source |
| --- | --- | --- | --- |
| R-01 | P0 | <observable product behavior> | <evidence tag/path> |

## Acceptance Examples

AE-01（对应 R-01）
Given <current or initial state>
When <actor action or system event>
Then <observable outcome>

AE-02（对应 R-01，异常）
Given <exception or boundary state>
When <actor action or system event>
Then <observable outcome or explicit non-goal>

## Scope Boundaries

### In Scope

### Out Of Scope

## Evidence And Assumptions

| claim | tag | source / owner | note |
| --- | --- | --- | --- |

## Outstanding Questions

| question | blocks planning? | recommended default | owner |
| --- | --- | --- | --- |
```

Use the surface lens and project-local overlay to add only the conditional sections the increment needs.

## Authoring Discipline

Use brownfield increment examples, not 0-1 expansion examples:

- vague original -> improved concrete wording -> reason
- replace "等", "相关", "合适的", "更好", and "优化体验" with observable scope, state, quantity, trigger, or acceptance
- product constraints are allowed; implementation units, schemas, exact API fields, database tables, and task breakdown are not
- run the Framing Gate and Evidence Plan from `evidence-and-topology.md` when the input signals removal, migration, workflow/contract change, source-of-truth movement, generated/runtime mirrors, package/docs/test cleanup, or cross-surface scope
- do not print the run-local Framing Gate by default; promote only the parts that reduce planning invention into Current System Snapshot, Change Topology, Surface Map, Producer / Artifact / Consumer, Source-Of-Truth Resolution, Negative Acceptance, Evidence And Assumptions, or Outstanding Questions

## PRD Quality Diagnosis And Optimization

For refine or validate mode, diagnose before rewriting and keep the diagnosis compact:

```text
quality_diagnosis: ready | minor-gaps | material-gaps | blockers
evidence_depth:
top_gaps:
rewrite_strategy:
```

Give optimization suggestions as `original -> recommendation -> reason -> write target`. Prioritize suggestions that reduce planning invention: missing current-state evidence, unclear delta, untestable wording, missing priority, missing acceptance, industry/compliance uncertainty, source/user contradiction, or scope creep.

Then produce the final rewritten PRD using the standard skeleton and triggered sections. Ensure there is no standalone quality report artifact unless the user explicitly asks; put persistent decisions into `Decision Notes`, assumptions into `Evidence And Assumptions`, and unresolved blockers into `Outstanding Questions`.

`not-run` is a run-local decision-card state only; do not emit it in the diagnosis block because an emitted refine/validate diagnosis has run by definition. Do not create numeric PRD scorecards, 0-100 quality ratings, or industry hard-threshold rubrics.

## Feature Slices

Add `## Feature Slices` when the PRD is large, mixed-surface, multi-feature, refine/validate with multiple goals, or otherwise likely to make planning infer feature boundaries. Feature Slices are context and handoff units, not execution units, task packs, program slices, or sub-agent dispatch units.

Use business capability/outcome boundaries rather than code-layer partitions such as Controller/Service/DAO files. Each slice should preserve original PRD text or source claim when available:

```text
feature_id:
title:
summary:
requirement_refs:
acceptance_refs:
source_excerpt_or_claim:
evidence:
candidate_modules_or_source_refs:
risk_signals:
```

Rules:

- no slice without acceptance refs or an explicit trace gap;
- candidate modules/source refs are evidence pointers, not scope authority;
- cross-cutting concerns belong in risk signals or cross-cutting notes, not fake feature slices;
- 3-7 slices is a common healthy range, not a hard rule;
- more than 10 slices should trigger split recommendation or owner confirmation before silent expansion.

For medium, large, mixed-surface, workflow, contract, migration, replace, or remove changes, include topology-driven sections only as needed:

````markdown
## Change Topology

Primary topology: add | extend | replace | remove | migrate | split | merge | policy-change | workflow-change | contract-change

Why this topology matters:

## Surface Map

| surface | current behavior | owner/source | artifact/contract | consumer | delta | evidence |
| --- | --- | --- | --- | --- | --- | --- |

## Producer / Artifact / Consumer

| producer | artifact/schema/path | freshness/authority | consumers | change effect | evidence |
| --- | --- | --- | --- | --- | --- |

## Source-Of-Truth Resolution

| item | current source-of-truth | target source-of-truth | generated mirrors / non-authoritative refs | conflict rule |
| --- | --- | --- | --- | --- |

## Negative Acceptance

```text
NA-01
Given <current or future state>
When <implementation or workflow runs>
Then <must not happen>
```
````

These sections are not implementation planning. They define WHAT boundaries so planning does not invent affected surfaces, consumers, or source-of-truth decisions.

## Stable Trace Rules

Preserve existing IDs when refining a draft:

- R / AE / BR / NFR IDs are not reused.
- New IDs continue from the maximum current number.
- Project-local IDs such as `US-*`, `FEAT-*`, or `NFR-*` may be kept as auxiliary trace, but they must map back to spec-first requirements, acceptance examples, scope boundaries, or assumptions.

## Closeout Summary

Every PRD handoff should report:

- sections included
- requirement count
- acceptance example count
- priority distribution
- NFR count
- assumption count
- outstanding question count
- uncovered requirements
- feature items without acceptance examples
- current-state claims without confirmed evidence

When `## Feature Slices` is present, or when PRD complexity was explicitly evaluated for slice need, additionally report:

- feature slice count and feature IDs
- feature-to-R/AE trace gaps
- cross-cutting risk count
- split recommendation / owner confirmation status when slice count, cross-owner scope, or cross-release risk suggests program or execution slicing

If gaps remain, do not silently recommend planning. Ask the minimal blocking question, record accepted assumptions, or route to document review/refine.

## Lightweight Split Topology

For owner-confirmed oversized initial PRDs, use shared base identity without adding packet infrastructure:

Split summary frontmatter:

```yaml
---
spec_id: YYYY-MM-DD-NNN-<base-slug>
artifact_kind: prd-requirements
document_role: split-summary
source_prd: docs/brainstorms/<source-or-original>.md
---
```

Child PRD frontmatter:

```yaml
---
spec_id: YYYY-MM-DD-NNN-<base-slug>
artifact_kind: prd-requirements
document_role: child-prd
child_id: <module-slug>
parent_spec_id: YYYY-MM-DD-NNN-<base-slug>
source_prd: docs/brainstorms/<source-or-original>.md
split_summary: docs/brainstorms/<split-summary>.md
---
```

The split summary is navigation and boundary context. Implementation planning should normally start from a concrete child PRD, preserving `child_id`, `parent_spec_id`, `source_prd`, and `split_summary` trace.
