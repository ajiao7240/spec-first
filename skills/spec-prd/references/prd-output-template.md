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
