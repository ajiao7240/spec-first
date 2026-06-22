# PRD Readiness Lens

Load this reference before handing a PRD to planning, document review, or done.

## Contents

- [Base Gate](#base-gate)
- [PRD-Specific Lens](#prd-specific-lens)
- [Core Pack](#core-pack)
- [Quality Diagnosis Pack](#quality-diagnosis-pack)
- [P0 Quality Floor Pack](#p0-quality-floor-pack)
- [Feature Slice Pack](#feature-slice-pack)
- [Topology Pack](#topology-pack)
- [Domain And Decision Pack](#domain-and-decision-pack)
- [P1 Conditional Pack](#p1-conditional-pack)
- [Metrics And Overlay Pack](#metrics-and-overlay-pack)
- [Outcomes](#outcomes)

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

When a PRD artifact path exists, `skills/spec-prd/scripts/check-prd-artifact.js <prd-path>` can report deterministic `spec-prd-artifact-check.v1` facts such as frontmatter, core-section presence, requirement/acceptance trace gaps, placeholder lines, forbidden `docs/prds/` path, and Feature Slice acceptance trace gaps. Treat those findings as advisory script-owned facts for this lens; they do not decide `ready-for-planning` by themselves.

`placeholder_or_todo_present` and `requirement_without_acceptance_ref` / `uncovered_requirements` hits that correspond to an intentional placeholder inside the embedded template skeleton, an explicitly recorded trace gap, or an item deliberately deferred to `Outstanding Questions` are expected advisory noise: record the rationale, do not fabricate an acceptance reference or delete a deliberate trace-gap marker to zero the findings array. The Core Pack already blesses "an explicit trace gap" as a valid readiness state, so silencing the script would invert it from an advisory fact into a coercive gate that drives the WHAT decision instead of informing it. Feature Slice trace gaps are already honored script-side, so this carve-out's load-bearing scope is the placeholder and uncovered-requirement paths plus the recorded-trace-gap state.

### Core Pack

- `current-state provenance` - material current-system claims have evidence tags; user-stated, confirmed-source, source-candidate, external-research, and assumptions are not blended; stale pointers are not presented as confirmed.
- `planning recheck visibility` - material source-candidate, local pattern, code-index pointer, prior artifact, or external/reference claim that planning must confirm before selecting HOW is visible in `Planning Recheck`, `Outstanding Questions`, or readiness closeout. It remains advisory until re-read or re-run.
- `change delta and boundary clarity` - keep/extend/replace/remove/unknown is explicit for material changes, scope boundaries are visible, and priority/degrade/block-release semantics are present when relevant.
- `planning-invention and trace risk` - planning would not need to invent actors, flows, acceptance, scope, priority, or current behavior; core requirements have acceptance coverage or an explicit trace gap.
- `pre-prd clarification closure` - when a rough PRD triggered Pre-PRD Clarification, each load-bearing gap is closed by source evidence, owner answer, accepted assumption, explicit trace gap, `Outstanding Questions`, blocker cluster, or route-out before planning. A run-local shared understanding map is not itself readiness evidence.
- `wording and testability` - vague words such as "等", "相关", "合适的", "更好", and "优化体验" are replaced by verifiable behavior, state, trigger, quantity, or acceptance. INVEST, EARS, and Gherkin-style wording are optional clarity anchors, not scoring rubrics.
- `interaction and exception readiness` - important user-visible entries, state, feedback, confirmation, cancellation, failure, empty, permission, retry, and partial-success cases are covered or intentionally out of scope when relevant.

### Quality Diagnosis Pack

Run this pack when the input is an existing PRD, requirements draft, rough notes being refined/validated as PRD input, or the user asks for deep PRD quality analysis or optimization suggestions.

- `adaptive product lens fit` - the applied surface/industry/product lens follows the actual target surface, current source evidence, and owner-stated objective; generic checklists are not applied as confirmed project facts.
- `canonical lens reuse` - the diagnosis uses `prd-output-template.md`'s Adaptive Product Expert Lens as the quality-dimension source instead of copying a second near-duplicate dimension list.
- `preliminary-vs-final diagnosis` - Preliminary Diagnosis may choose compact/L1/L2/L3/L4/L5 expansion, route-out, or blocker posture, but only Final Readiness Diagnosis after rewrite and closure may emit `ready-for-planning`.
- `optimization suggestion closure` - major PRD gaps are expressed as `original -> recommendation -> reason -> write target`, prioritized by planning-invention risk, and either incorporated into the rewritten PRD or left as visible blockers.
- `rewrite integrity` - the final PRD preserves stable IDs where applicable, separates critique from durable requirements, keeps HOW out of requirements, and does not drop confirmed source evidence, owner decisions, assumptions, or unresolved questions during cleanup.

### P0 Quality Floor Pack

Run this pack only when the corresponding P0 signal is triggered. Untriggered P0 packs are not missing sections and must not expand compact PRDs by default.

- `problem-outcome closure` - if target user, product problem, desired observable outcome, or value framing would affect planning, it is source/owner-confirmed, labeled as an accepted assumption, or visible in `Outstanding Questions`. Missing load-bearing framing blocks `ready-for-planning`.
- `metrics readiness` - improvement claims that affect acceptance, priority, or release confidence have metric/source/baseline/window when confirmed, or are downgraded to observable signal, assumption, or Outstanding Question. Trigger words include improve, optimize, reduce, accelerate, lower cost, stabilize, prove, preserve, avoid regression, reduce drift/load, and increase coverage. Fabricated target values block readiness.
- `nfr-constraint closure` - triggered security, permission, privacy, compliance, payment/transaction, external API, CLI/runtime, migration, bulk/async/sync, rollout, operational, or user-visible failure constraints are captured as product-level requirements, negative acceptance, data/compliance boundaries, or release/operation readiness. API/database/architecture HOW is not accepted as PRD closure.
- `workflow-skill-runtime quality closure` - when the PRD concerns a workflow, skill, prompt, CLI, eval fixture, contract, or runtime projection change, the `Workflow / Skill / Runtime Quality Signals` lens has been applied and planning-critical quality signals are visible as product-level outcomes: public workflow identity, near-neighbor routing, source/runtime boundary, generated runtime mirrors untouched, eval fixtures advisory-only, source/reference contract tests, runtime projection checks, fresh-source eval status, and downstream consumer compatibility. File edits, exact test code, and implementation sequencing remain HOW.
- `traceability closure` - planning-bound requirements trace to acceptance examples and evidence/source, or carry an explicit trace gap / open question. A load-bearing requirement without AE/evidence/trace-gap closure blocks readiness.
- `owner approval closure` - owner answers applied, accepted assumptions, blocking questions, `readiness_outcome`, `planning_would_invent_what`, and final readiness posture are visible in PRD-local sections or closeout summary. A separate approval artifact is not required.

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
- `domain-grill and decision-note adequacy` - load-bearing terminology, domain boundary, contradiction, ownership, permission/state/exception scenario, source/code contradiction, or hard product-boundary ambiguity has either been resolved through source-first evidence plus a bounded scenario grill, recorded as a labeled assumption, moved to `Outstanding Questions`, or escalated to `grill-with-docs` integration; material decisions use PRD-local `Decision Notes` with `question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason` when applicable.
- `deep requirements grill closure` - load-bearing actor, flow, state, exception, scope, acceptance, permission, release-slice, or decision-intersection questions from Pre-PRD Clarification or triggered `grill-with-docs` integration are closed by source evidence, owner answer, accepted assumption, Outstanding Question, blocker cluster, or route-out. Any unresolved load-bearing grill question blocks `ready-for-planning`.
- `context/adr topology adapter boundary` - existing `CONTEXT.md`, `CONTEXT-MAP.md`, context-specific `CONTEXT.md`, and `docs/adr/**` may provide advisory evidence in normal mode; in triggered `grill-with-docs` mode, resolved terms or ADR-worthy decisions may update those files inline. PRD-local Glossary / Decision Notes / Evidence And Assumptions / Scope Boundaries remain the planning handoff source.
- `context/adr artifact mode boundary` - readiness must not require `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` in normal PRD mode, and missing topology does not block planning if PRD-local closure is complete. When `grill-with-docs` mode is triggered, readiness checks that resolved context/ADR updates are reflected in the PRD closeout and that ADR creation still satisfies hard-to-reverse, surprising-without-context, real-tradeoff conditions.

### P1 Conditional Pack

Run this pack only for triggered conditional signals. It is not an all-section checklist.

- `stakeholder-actor closure` - when Admin, Backend, CLI/DevTool, Mixed surface, permission, approval, producer/consumer, or downstream-consumer signals are present, beneficiary, operator, admin, downstream consumer, and owner are distinguished enough that planning will not invent roles.
- `design-evidence closure` - when screenshot/Figma/page/interaction input is present, PRD-relevant facts such as entry, state, copy, empty/error/loading, permissions, i18n, and accessibility are captured or explicitly deferred. PRD/Figma/source consistency remains a route-out to `spec-app-consistency-audit`.
- `release-slice closure` - when requirement count, goals, mixed surfaces, or release order affect scope/acceptance, the PRD records P0/P1/deferred, owner-confirmed split, or Feature Slices. Feature Slices remain PRD handoff units, not task or implementation units.
- `change-management closure` - for `resume-prd`, existing PRD path, multi-round refine, or new meeting/screenshot/review conclusion input, stable R/AE IDs are preserved and added/replaced/deprecated/needs-confirmation deltas are visible.

### Metrics And Overlay Pack

Run this pack only when the PRD includes goals/metrics, internal workflow/skill/runtime quality signals, or applies a project-local industry/team/legal/compliance/privacy/safety overlay.

- `goal-measurability` - when the PRD includes `Goals / Success Metrics`, each goal is measurable: it has a metric and target value, plus current baseline and measurement window when available, and vague verbs are replaced with observable口径. This is a standard for stated goals, not a demand to manufacture metrics. When no credible metric source exists, downgrade to an observable口径 or move the unproven metric into Assumptions / Outstanding Questions; never fabricate target values.
- `internal-tool quality signals` - for workflow, skill, prompt, CLI, eval, contract, or runtime projection PRDs, observable signals may be behavioral or contract signals such as hot-path load/anchors, boundary drift cases, runtime projection checks, generated mirrors untouched, advisory fixture coverage, fresh-source eval status, and downstream consumer compatibility. They remain PRD outcomes, not task breakdown.
- `project-local overlay check` - triggered legal, compliance, money, trading, data, audit, safety, or privacy boundaries are explicit. If they are not confirmed, keep them in `Evidence And Assumptions` or `Outstanding Questions`.

## Outcomes

Frontmatter `status` is document lifecycle posture, not the planning-readiness verdict. A PRD may remain `status: draft` while the readiness lens returns `ready-for-planning` if no load-bearing WHAT remains unresolved. Conversely, a polished document can still return `revise-prd` or `ask-owner`.

When closing a PRD handoff or writing `Readiness Self-Check`, state `readiness_outcome` explicitly using exactly one of:

- `ready-for-planning` - planning can consume the PRD without inventing WHAT.
- `revise-prd` - fix concrete PRD gaps before planning.
- `ask-owner` - ask the smallest blocking question.
- `doc-review` - request independent document review when risk is broad or subtle.
- `route-out` - use brainstorm, app consistency audit, plan, debug, or work instead.

If the user chooses to continue with assumptions, record the accepted risk in the PRD. Do not hide readiness gaps in the closeout.

Before declaring `ready-for-planning`, run a handoff entropy check: list any remaining WHAT decisions that planning would otherwise have to invent across behavior, scope, affected surfaces, artifact consumers, source-of-truth, negative boundaries, and unresolved framing risks. If any load-bearing item remains unresolved, the outcome is `revise-prd` or `ask-owner`, not ready.
