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

### Core Pack

- `current-state provenance` - material current-system claims have evidence tags; user-stated, confirmed-source, source-candidate, external-research, and assumptions are not blended; stale pointers are not presented as confirmed.
- `change delta and boundary clarity` - keep/extend/replace/remove/unknown is explicit for material changes, scope boundaries are visible, and priority/degrade/block-release semantics are present when relevant.
- `planning-invention and trace risk` - planning would not need to invent actors, flows, acceptance, scope, priority, or current behavior; core requirements have acceptance coverage or an explicit trace gap.
- `wording and testability` - vague words such as "等", "相关", "合适的", "更好", and "优化体验" are replaced by verifiable behavior, state, trigger, quantity, or acceptance. INVEST, EARS, and Gherkin-style wording are optional clarity anchors, not scoring rubrics.
- `interaction and exception readiness` - important user-visible entries, state, feedback, confirmation, cancellation, failure, empty, permission, retry, and partial-success cases are covered or intentionally out of scope when relevant.

### Quality Diagnosis Pack

Run this pack when the input is an existing PRD, requirements draft, rough notes being refined/validated as PRD input, or the user asks for deep PRD quality analysis or optimization suggestions.

- `adaptive product lens fit` - the applied surface/industry/product lens follows the actual target surface, current source evidence, and owner-stated objective; generic checklists are not applied as confirmed project facts.
- `canonical lens reuse` - the diagnosis uses `prd-output-template.md`'s Adaptive Product Expert Lens as the quality-dimension source instead of copying a second near-duplicate dimension list.
- `optimization suggestion closure` - major PRD gaps are expressed as `original -> recommendation -> reason -> write target`, prioritized by planning-invention risk, and either incorporated into the rewritten PRD or left as visible blockers.
- `rewrite integrity` - the final PRD preserves stable IDs where applicable, separates critique from durable requirements, keeps HOW out of requirements, and does not drop confirmed source evidence, owner decisions, assumptions, or unresolved questions during cleanup.

### Feature Slice Pack

Run this pack when `## Feature Slices` is present or when PRD complexity suggests slices should exist.

- `slice identity and trace` - each slice has a stable feature ID, business-readable title, source/evidence, requirement refs, acceptance refs or an explicit trace gap, and a visible mapping to Change Delta or core requirements.
- `business capability boundary` - slices are grouped by product capability/outcome rather than Controller/Service/DAO files, screens alone, or code module partitions.
- `source excerpt preservation` - original PRD text, user claim, or source claim remains visible enough for planning and review to trace why the slice exists.
- `cross-cutting risk visibility` - permissions, rollout, compliance, operational, shared-source, and cross-surface concerns are visible as risk signals or cross-cutting notes, not hidden inside fake feature slices.
- `program-slice boundary` - large slice count, cross-owner scope, or cross-release risk leads to split recommendation or owner confirmation; the PRD does not silently decide program/execution slices.

### Topology Pack

Run this pack for medium/large/mixed-surface, workflow, contract, migration, replace, remove, source-of-truth, generated-runtime, artifact/schema/report, or active-surface changes.

- `topology and surface fit` - when the increment changes capability identity, source-of-truth, workflow handoff, artifacts, contracts, runtime generation, or active product surface, the PRD names the primary topology from `references/evidence-and-topology.md`, applies relevant topology-specific gates, and identifies affected surfaces or explicitly rules them out.
- `producer-consumer and source-of-truth closure` - any changed artifact, schema, report, config, setup fact, generated asset, workflow handoff, template, or mirrored doc identifies producer, authority/freshness, consumers, change effect, current/target source-of-truth, generated mirrors, non-authoritative refs, and conflict rule as needed.
- `negative-space coverage` - high-risk, mixed-surface, workflow, contract, migration, replace, or remove changes include negative examples for what must not be generated, exposed, consumed, widened, or treated as current truth.
- `framing-evidence alignment` - when the Framing Gate identified topology, source-of-truth, producer/consumer, active-surface, or negative-space risk, the final PRD either covers that risk with confirmed/user-stated evidence or records it as an assumption, Outstanding Question, or explicit non-goal.

### Domain And Decision Pack

Run this pack when terminology, domain boundary, source/user contradiction, ownership, permission/state/exception scenario, source-of-truth, or hard product-boundary ambiguity could change WHAT, acceptance, scope, or downstream planning.

- `terminology and contradiction handling` - canonical terms are defined or unresolved terms are in Outstanding Questions; source/user/glossary mismatches are recorded as contradictions, not silently resolved. When `docs/contracts/domain-glossary.md` exists, `skills/spec-prd/scripts/check-glossary-drift.js <prd-path>` reports deterministic `avoid_term_used` facts; treat findings as advisory, then fix or record the decision. Hits that land in the PRD's own `Glossary` avoid/alias column or in Evidence/Decision-Note provenance references are expected advisory noise: record the rationale, do not delete the avoid declaration or drift trace to silence the script.
- `owner-question minimality` - unresolved owner questions are limited to decisions that change WHAT, acceptance, source-of-truth, or scope; repo-discoverable facts are not asked as product questions, and broad question clusters route to refine/doc-review instead of being hidden in planning.
- `domain-grill and decision-note adequacy` - load-bearing terminology, domain boundary, contradiction, ownership, permission/state/exception scenario, or hard product-boundary ambiguity has either been resolved through source-first evidence plus a bounded scenario grill, recorded as a labeled assumption, or moved to `Outstanding Questions`; material decisions use PRD-local `Decision Notes` with `question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason` when applicable.
- `no context-artifact inflation` - ADR-like artifacts are only a future suggestion when hard to reverse, surprising without context, and a real tradeoff; readiness must not require `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/`.

### Metrics And Overlay Pack

Run this pack only when the PRD includes goals/metrics or applies a project-local industry/team/legal/compliance/privacy/safety overlay.

- `goal-measurability` - when the PRD includes `Goals / Success Metrics`, each goal is measurable: it has a metric and target value, plus current baseline and measurement window when available, and vague verbs are replaced with observable口径. This is a standard for stated goals, not a demand to manufacture metrics. When no credible metric source exists, downgrade to an observable口径 or move the unproven metric into Assumptions / Outstanding Questions; never fabricate target values.
- `project-local overlay check` - triggered legal, compliance, money, trading, data, audit, safety, or privacy boundaries are explicit. If they are not confirmed, keep them in `Evidence And Assumptions` or `Outstanding Questions`.

## Outcomes

- `ready-for-planning` - planning can consume the PRD without inventing WHAT.
- `revise-prd` - fix concrete PRD gaps before planning.
- `ask-owner` - ask the smallest blocking question.
- `doc-review` - request independent document review when risk is broad or subtle.
- `route-out` - use brainstorm, app consistency audit, plan, debug, or work instead.

If the user chooses to continue with assumptions, record the accepted risk in the PRD. Do not hide readiness gaps in the closeout.

Before declaring `ready-for-planning`, run a handoff entropy check: list any remaining WHAT decisions that planning would otherwise have to invent across behavior, scope, affected surfaces, artifact consumers, source-of-truth, negative boundaries, and unresolved framing risks. If any load-bearing item remains unresolved, the outcome is `revise-prd` or `ask-owner`, not ready.
