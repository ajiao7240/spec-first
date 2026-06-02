# PRD Output Template

Load this reference before drafting or materially rewriting a PRD artifact.

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

Core sections derive from the bundled packaged template set under `templates/standard/`. The repository-local `docs/需求文档模版/标准模版/` directory is a human-facing mirror and design reference, not a required runtime dependency after packaging.

## Conditional Sections

Include these when they reduce planning invention:

- `## Problem Frame`
- `## Current System Snapshot`
- `## Change Topology`
- `## Surface Map`
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

Success Metrics are conditional. When present, each goal should be measurable: metric, target value, and — when available — current baseline and measurement window, with leading/lagging type for core goals. If there is no credible metric source, write an observable measurement口径 or record the assumption; do not invent target values.

## Authoring Discipline

Use brownfield increment examples, not 0-1 expansion examples:

- vague original -> improved concrete wording -> reason
- replace "等", "相关", "合适的", "更好", and "优化体验" with observable scope, state, quantity, trigger, or acceptance
- product constraints are allowed; implementation units, schemas, exact API fields, database tables, and task breakdown are not
- run the Framing Gate and Evidence Plan from `change-topology-lens.md` when the input signals removal, migration, workflow/contract change, source-of-truth movement, generated/runtime mirrors, package/docs/test cleanup, or cross-surface scope
- do not print the run-local Framing Gate by default; promote only the parts that reduce planning invention into Current System Snapshot, Change Topology, Surface Map, Source-Of-Truth Resolution, Negative Acceptance, Evidence And Assumptions, or Outstanding Questions

For medium, large, mixed-surface, workflow, contract, migration, replace, or remove changes, include topology-driven sections only as needed:

````markdown
## Change Topology

Primary topology: add | extend | replace | remove | migrate | split | merge | policy-change | workflow-change | contract-change

Why this topology matters:

## Surface Map

| surface | current behavior | owner/source | artifact/contract | consumer | delta | evidence |
| --- | --- | --- | --- | --- | --- | --- |

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
