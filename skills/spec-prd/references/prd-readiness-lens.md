# PRD Readiness Lens

Load this reference before handing a PRD to planning, document review, or done.

## Base Gate

Reuse the existing Requirements Readiness Gate by reference. Do not copy its full prose and do not introduce a second evidence enum.

The base dimensions are:

- Clarity & Non-ambiguity
- Evidence & Inference provenance
- Traceability & Coverage
- Testability
- Boundary integrity
- Planning-invention & Handoff readiness

## PRD-Specific Lens

Run these additional checks:

1. `current-state accuracy` - material current-system claims have evidence tags and no stale pointer is presented as confirmed.
2. `change delta clarity` - keep/extend/replace/remove/unknown is explicit for material changes.
3. `exception coverage` - important failure, empty, permission, retry, partial-success, and cancellation cases are represented or intentionally out of scope.
4. `interaction readiness` - user-visible flows specify entry, state, feedback, confirmation, and cancellation when relevant.
5. `evidence provenance` - user-stated, confirmed-source, external-research, GitNexus pointer, and assumptions are not blended.
6. `planning invention risk` - planning would not need to invent actors, flows, acceptance, scope, priority, or current behavior.
7. `terminology ambiguity` - canonical terms are defined or unresolved terms are in Outstanding Questions.
8. `code-claim contradiction` - user/source mismatches are recorded as contradictions, not silently resolved.
9. `hard-decision unresolved` - scope-changing or hard-to-reverse product decisions are decided, assumed with risk, or blocked.
10. `vague-wording` - words such as "等", "相关", "合适的", "更好", and "优化体验" are replaced by verifiable behavior.
11. `priority-completeness` - core requirements have priority and, when relevant, degrade/block-release semantics.

## Project-Local Overlay Check

When a local industry/team overlay is applied, check that triggered legal, compliance, money, trading, data, audit, safety, or privacy boundaries are explicit. If they are not confirmed, keep them in `Evidence And Assumptions` or `Outstanding Questions`.

## Outcomes

- `ready-for-planning` - planning can consume the PRD without inventing WHAT.
- `revise-prd` - fix concrete PRD gaps before planning.
- `ask-owner` - ask the smallest blocking question.
- `doc-review` - request independent document review when risk is broad or subtle.
- `route-out` - use brainstorm, app consistency audit, plan, debug, or work instead.

If the user chooses to continue with assumptions, record the accepted risk in the PRD. Do not hide readiness gaps in the closeout.
