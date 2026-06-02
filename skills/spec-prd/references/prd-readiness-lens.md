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

Run checks by pack. Always run the core pack; run conditional packs only when their trigger is present. This is a prompt economy rule, not a weaker quality bar.

### Always Gate

- `current-state accuracy` - material current-system claims have evidence tags and no stale pointer is presented as confirmed.
- `change delta clarity` - keep/extend/replace/remove/unknown is explicit for material changes.
- `evidence provenance` - user-stated, confirmed-source, source-candidate, external-research, and assumptions are not blended.
- `planning invention risk` - planning would not need to invent actors, flows, acceptance, scope, priority, or current behavior.
- `vague-wording` - words such as "等", "相关", "合适的", "更好", and "优化体验" are replaced by verifiable behavior.
- `priority-completeness` - core requirements have priority and, when relevant, degrade/block-release semantics.
- `exception coverage` - important failure, empty, permission, retry, partial-success, and cancellation cases are represented or intentionally out of scope when relevant.
- `interaction readiness` - user-visible flows specify entry, state, feedback, confirmation, and cancellation when relevant.

### Topology Pack

Run this pack for medium/large/mixed-surface, workflow, contract, migration, replace, remove, source-of-truth, generated-runtime, artifact/schema/report, or active-surface changes.

- `change-topology fit` - when the increment changes capability identity, source-of-truth, workflow handoff, artifacts, contracts, runtime generation, or active product surface, the PRD names the primary topology from `references/change-topology-lens.md` and applies the relevant topology-specific gates.
- `surface-map completeness` - medium/large/mixed-surface changes identify affected user entry, CLI/API/UI, skill/agent/workflow, config, runtime generation, artifact/schema/report, docs/onboarding, tests/fixtures/package, and release/ops/support surfaces or explicitly rule them out when relevant.
- `producer-consumer closure` - any changed artifact, schema, report, config, setup fact, generated asset, or workflow handoff identifies its producer, authority/freshness, consumers, and change effect.
- `source-of-truth clarity` - current and target source-of-truth, generated mirrors, non-authoritative refs, and conflict rules are explicit when source/runtime, docs/contracts, config/artifact, or template mirrors are involved.
- `negative-acceptance coverage` - high-risk, mixed-surface, workflow, contract, migration, replace, or remove changes include negative examples for what must not be generated, exposed, consumed, widened, or treated as current truth.
- `framing-evidence alignment` - when the Framing Gate identified topology, source-of-truth, producer/consumer, active-surface, or negative-space risk, the final PRD either covers that risk with confirmed/user-stated evidence or records it as an assumption, Outstanding Question, or explicit non-goal.

### Domain And Decision Pack

Run this pack when terminology, domain boundary, source/user contradiction, ownership, permission/state/exception scenario, source-of-truth, or hard product-boundary ambiguity could change WHAT, acceptance, scope, or downstream planning.

- `terminology ambiguity` - canonical terms are defined or unresolved terms are in Outstanding Questions. When `docs/contracts/domain-glossary.md` exists, `skills/spec-prd/scripts/check-glossary-drift.js <prd-path>` reports deterministic `avoid_term_used` findings (script-owned facts). Treat each finding as advisory, not a hard failure: confirm whether the PRD genuinely uses a non-canonical term versus quoting, defining, or discussing the term itself, then fix or record the decision. Absent/empty glossary yields no findings and is not a gap.
- `code-claim contradiction` - user/source mismatches are recorded as contradictions, not silently resolved.
- `hard-decision unresolved` - scope-changing or hard-to-reverse product decisions are decided, assumed with risk, or blocked.
- `owner-question minimality` - unresolved owner questions are limited to decisions that change WHAT, acceptance, source-of-truth, or scope; repo-discoverable facts are not asked as product questions, and broad question clusters route to refine/doc-review instead of being hidden in planning.
- `domain-grill coverage` - load-bearing terminology, domain boundary, source/user contradiction, ownership, permission/state/exception scenario, or hard product-boundary ambiguity has either been resolved through source-first evidence plus a bounded scenario grill, recorded as a labeled assumption, or moved to `Outstanding Questions`; planning must not invent the unresolved meaning.
- `decision-note adequacy` - material decisions that affect WHAT, acceptance, scope, source-of-truth, or downstream planning use PRD-local `Decision Notes` with the existing fields `question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason` when applicable. ADR-like artifacts are only a future suggestion when hard to reverse, surprising without context, and a real tradeoff; readiness must not require `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/`.

### Metrics And Overlay Pack

Run this pack only when the PRD includes goals/metrics or applies a project-local industry/team/legal/compliance/privacy/safety overlay.

- `goal-measurability` - when the PRD includes `Goals / Success Metrics`, each goal is measurable: it has a metric and target value, plus current baseline and measurement window when available, and vague verbs (提升/改善/优化/更好) are replaced with observable口径. This is a standard for what a *stated* goal must look like, not a demand to manufacture metrics — when no credible metric source exists, the correct move is to downgrade to an observable口径 or move the unproven metric into Assumptions / Outstanding Questions (consistent with `success-metrics-without-evidence`'s no-invention rule), never to fabricate target values. A small increment with no goal-justification need omits this section, and its absence is not a gap.

## Project-Local Overlay Check

When a local industry/team overlay is applied, check that triggered legal, compliance, money, trading, data, audit, safety, or privacy boundaries are explicit. If they are not confirmed, keep them in `Evidence And Assumptions` or `Outstanding Questions`.

## Outcomes

- `ready-for-planning` - planning can consume the PRD without inventing WHAT.
- `revise-prd` - fix concrete PRD gaps before planning.
- `ask-owner` - ask the smallest blocking question.
- `doc-review` - request independent document review when risk is broad or subtle.
- `route-out` - use brainstorm, app consistency audit, plan, debug, or work instead.

If the user chooses to continue with assumptions, record the accepted risk in the PRD. Do not hide readiness gaps in the closeout.

Before declaring `ready-for-planning`, run a handoff entropy check: list any remaining WHAT decisions that planning would otherwise have to invent across behavior, scope, affected surfaces, artifact consumers, source-of-truth, negative boundaries, and unresolved framing risks. If any load-bearing item remains unresolved, the outcome is `revise-prd` or `ask-owner`, not ready.
