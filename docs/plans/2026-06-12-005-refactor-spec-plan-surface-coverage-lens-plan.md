---
title: "refactor: Add a conditional surface-coverage lens to spec-plan"
type: refactor
status: completed
date: 2026-06-12
spec_id: 2026-06-12-005-spec-plan-surface-coverage-lens
plan_depth: standard
---

# refactor: Add a conditional surface-coverage lens to spec-plan

> **COMPLETED VIA USER OVERRIDE (2026-06-13).** This plan was originally deferred behind the U1 Gate below. U1 was run and recorded `gate-not-met` / `insufficient-primary-evidence` in `docs/validation/spec-plan/surface-coverage-lens-u1-gate-2026-06-13.md`; the user then explicitly confirmed: "确认覆盖 U1 Gate，按 override 直接实现 U2-U4。" The implementation therefore does **not** claim U1 passed. It records a user override and lands the smallest reference-resident enrichment of existing `## System-Wide Impact`, plus deepening guidance that reuses existing specialists and adds no new agent.

## Summary

When and only when evidence shows it is needed, add a **conditional** surface-coverage lens to `spec-plan` so Standard/Deep plans touching multiple clients, contracts, or runtime surfaces make an explicit in-scope / out-of-scope / deferred decision for each materially-considered surface (irrelevant surfaces are simply omitted, not marked not-applicable) — borrowing the **form** of spec-kit's conditional `[REMOVE IF UNUSED]` pattern (conditional, delete-unused, non-exhaustive), while the per-surface decision **semantics** are a spec-first design choice the U1 Gate must justify. Kept reference-resident and omittable, with no spine bloat and no new agents by default.

---

## Problem Frame

Multi-end work (App, H5, PC web, Admin, backend, data, API, events, observability) can silently miss a surface during planning: a surface omitted because it is irrelevant is fine, but a surface omitted because nobody checked it is a planning gap. This is a **core scenario** for spec-first, an AI coding tool whose users develop requirements across multiple ends — a developer planning "user login" can easily cover App + backend but forget the H5 share page, the Admin ban console, or the analytics events. The open question is not whether the scenario matters (it is central) but whether `spec-plan`'s existing `## Summary` + `## System-Wide Impact` + current deepening specialists already catch the misses, or whether an explicit conditional lens earns its place.

The original Track B asserted the gap rather than observing it (flagged in 001's review) and answered with a heavy controlled-ablation gate. Industry research (see below) shows the mainstream does not gate a checklist's value with controlled experiments — it just makes coverage **conditional, omittable, and delete-unused**. This redraft follows that: a light gate (try it on real plans), a light mechanism (a conditional lens, not a double table), and no agent sprawl.

---

## Requirements

- R1. The lens must be conditional and omittable: lightweight and single-surface plans omit it cleanly; it appears only when a plan touches more than one client, backend surface, API/schema/event contract, data lifecycle, operational concern, or rollout path.
- R2. The lens must not grow the `SKILL.md` spine: all guidance is reference-resident (`plan-sections.md`, optionally a dedicated reference), with at most one conditional pointer in the spine (preserving 004's constraint-budget and 003's handoff gate).
- R3. The lens must use a single conditional surface list with a derivation rule (enumerate the surfaces that actually exist in the target repo/product), not two overlapping tables, and not a closed exhaustive set.
- R4. Coverage breadth (is every relevant surface accounted for?) is owned by the orchestrator via the lens structure; coverage depth (is the H5 interface good, is the migration safe?) is owned by existing specialist agents during deepening — no new agent by default.
- R5. Canonical Markdown, stable IDs, Direct Evidence, implementation units, and downstream consumer contracts remain unchanged; protect with focused contract tests, not a broad rewrite.
- R6. User-visible workflow output change requires a `CHANGELOG.md` entry; runtime mirrors refresh only via `spec-first init`.

---

## Scope Boundaries

- Do not add a fixed exhaustive multi-surface table that every plan must fill — conditional only.
- Do not add a separate 17-module "technical module model" table alongside the surface list; the surface list with a derivation rule is sufficient (the two original tables overlapped heavily).
- Do not add the guidance body to the `SKILL.md` spine; reference-resident only.
- Do not use `governance-boundaries.md` as the carrier — that is context-intake governance, not plan output structure. The lens belongs with the section/template contract.
- Do not add per-surface specialist agents. Do not create a new `spec-surface-coverage-reviewer` unless the U3 new-agent gate proves a semantic (not merely enumerative) coverage miss that existing specialists do not catch.
- Do not build a controlled-ablation evaluation regime to justify the lens (the dropped over-built approach).

---

## Gate (replaces the dropped ablation gate)

This plan stays deferred until **both** hold:

1. **001 has shipped** the decision brief, and ≥2 genuine recent Standard/Deep *multi-surface* plans exist to inspect. ("Multi-surface" follows R1's definition — >1 client, backend surface, API/schema/event contract, data lifecycle, operational concern, or rollout path. For spec-first's own plans this includes the Claude/Codex dual-host split, CLI, skills/agents, contracts, and runtime mirrors; it is **not** limited to App/H5/PC-web/Admin clients, which are illustrative of downstream consumer products.) **Primary source: real downstream multi-end requirement plans** that `spec-plan` generated when used to develop App/H5/PC-web/Admin/backend work — this is the lens's core scenario, since spec-first is an AI coding tool for multi-end product development. Spec-first's own `docs/plans/` (dual-host/CLI/skills/contracts per R1's definition) are an **admissible secondary source** but not the main one — they rarely exercise the multi-end client surfaces the lens primarily targets. **`001 has shipped` is a provenance prerequisite (so post-001 plans reflect the decision-brief output), not a source of the multi-surface samples themselves.** Prefer plans generated after 001 landed; record each sample's repo, path, and pre-/post-001 provenance. Fewer than 2 genuine multi-surface samples means the Gate **cannot pass** (insufficient evidence) — it does not default to "primitives already cover".
2. **A cheap real-plan check shows a gap:** review those real multi-surface samples (or observe normal use) and ask whether existing primitives — `## Summary`, the existing `## System-Wide Impact` section (its `API surface parity` / `Integration coverage` bullets already prompt cross-surface consequences), and current deepening specialists — already surfaced the relevant surfaces, or demonstrably missed an in-scope one. The miss must be one those existing primitives — especially the `## System-Wide Impact` bullets — do **not** already cover; if they do, the gap is a usage/prompting problem, not a missing section, and this plan stays Deferred. If they missed an in-scope surface, the lens is authorized to land. (This is a review-for-misses check, not an application of a not-yet-built lens.)

**What this gate can and cannot detect.** It reliably catches *enumerative* misses — a surface that is visible in hindsight once the plan is read against the repo's real surfaces. It is weak for the *unknown-unknown* surface (the one nobody thought to enumerate — e.g., an embedded SDK), which can surface as a false "null = primitives already cover." That residual risk is **not** owned by this gate; it routes to U3's deterministic surface-enumeration script path, not to relaxing the gate.

This is the symmetric, affordable version of the evidence discipline 001 imposed on new agents — applied to the inline lens, without a controlled experiment. If dispatch/tooling for the check is unavailable, record the reason and keep this plan deferred; do not claim the gate passed.

**Override record (2026-06-13):** U1 did not pass; implementation proceeded only after explicit user override. Closeout and changelog must use `gate-overridden`, not `gate-passed`.

---

## Completion Criteria

Normal gate path: this is an **execution-locked, deferred plan** until either the U1 Gate passes or the user explicitly overrides it. Before a passed Gate or explicit override, `status: active` is the only legal value (the repo status taxonomy has no `deferred`; see `tests/unit/plan-status-taxonomy.test.js`), so the lock lives in prose, not frontmatter:

- **Execution lock:** do not enter U2–U4 until **both** Gate conditions hold or an explicit user override is recorded. `spec-work` (or any executor) handed this plan path must verify the Gate first; if it is not met and no override exists, stop and report `gate-not-met` without implementing. U1 is the only unit runnable before the Gate opens.
- **Null gate stays deferred:** if U1 returns null (existing primitives already cover) or insufficient evidence (<2 genuine multi-surface samples), record the result and keep `status: active` with the DEFERRED banner intact unless an explicit override authorizes implementation. Do **not** mark `status: completed` for a null or insufficient-evidence gate without that override.
- **Completion path:** move to `status: completed` only after U2–U4 actually land behind a passed Gate or an explicit user override — never silently completed.
- **Bounded deferral with an action bias (no indefinite limbo, but not a default cut either):** review by **2026-09-12** (one quarter post-001). Because multi-end planning is a core spec-first scenario, the default at the review date is **to actively collect at least one real multi-end requirement sample and run the gate check** — not to passively close. Concretely:
  - If by the review date the gate check has run on ≥2 real multi-end samples and found **no** in-scope miss existing primitives didn't already cover, close as `status: superseded` with a `docs/solutions/` pointer (the need was tested and not confirmed).
  - If the gate check found a real miss, the lens is authorized — proceed to U2.
  - If no one has yet run the check on a real multi-end sample, the correct action is **to run it**, not to close on a technicality. Only fall back to `superseded` if, after a genuine attempt, multi-end samples truly cannot be obtained.
  - `superseded` is also the right close if a later plan subsumes this work. Do not leave the plan as `active` + DEFERRED past the review date without an explicit, recorded decision.

**Completion override:** The user explicitly overrode the U1 Gate on 2026-06-13 and authorized U2-U4. This is the only reason `status` may be `completed` without a `gate-passed` record.

---

## Direct Evidence Readiness

- target_repo: `spec-first`
- evidence_sources: direct source reads, prior plan `2026-06-11-001`, prior plan `2026-06-11-004`, verified industry research (deep-research run `wf_d7587d4a-88f`)
- source_refs: `skills/spec-plan/references/plan-sections.md`, `skills/spec-plan/references/plan-template.md`, `skills/spec-plan/references/markdown-rendering.md`, `skills/spec-plan/references/deepening-workflow.md`, `skills/spec-plan/SKILL.md`, `tests/unit/spec-plan-contracts.test.js`, `docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md`, `docs/10-prompt/结构化项目角色契约.md`
- external_refs: `https://github.com/github/spec-kit/blob/main/templates/plan-template.md`, `https://docs.anthropic.com/en/docs/claude-code/sub-agents`, `https://www.anthropic.com/engineering/building-effective-agents`
- confidence: high that the conditional pattern has industry precedent and the lighter shape is correct; high that the multi-end planning scenario is central to spec-first's purpose; medium that existing primitives (`## Summary` + `## System-Wide Impact` + deepening specialists) actually miss in-scope surfaces in practice — that residual question is exactly what the Gate tests before landing
- limitations: the multi-end scenario is central, but the specific "gap" (existing primitives demonstrably missing an in-scope end) is not yet observed on a real multi-end requirement plan; this plan deliberately does not assert it and tests it via the Gate, with active sample collection preferred over passive waiting. Industry precedent (spec-kit) validates the conditional / delete-unused / non-exhaustive **form** (R1/R3), not the per-surface in-scope/out-of-scope/deferred **decision semantics** (the `out-of-scope: <reason>` state) — that semantics is a spec-first design choice justified by the U1 Gate, not by the spec-kit citation. spec-kit's own block is project-directory-structure scaffolding, a related but distinct mechanism.

---

## Direct Evidence

- repo_scope: `spec-first` (this repo); source files under `skills/spec-plan/`, `tests/unit/`, and `docs/plans/`.
- source_reads_completed:
  - `docs/plans/2026-06-11-001-refactor-spec-plan-decision-surface-coverage-plan.md` — `status: completed`; recalibrated to "Track A only"; the surface-coverage lens was split out to this plan (005) and deferred. Its U2 closeout generates **one** representative decision-brief sample that "seeds the deferred Track B baseline" — **not** ≥2 multi-surface samples.
  - `docs/plans/2026-06-11-004-refactor-spec-plan-skill-slimming-plan.md` — `status: completed`; `skills/spec-plan/SKILL.md:64` is now a `STOP. read references/governance-boundaries.md` pointer; contract tests use a `combined = spine + governance reference` capability-binding posture.
  - `docs/plans/2026-06-11-003-refactor-spec-plan-plan-mode-hardening-plan.md` — `status: completed`; the handoff-gate prerequisite referenced by R2.
  - `skills/spec-plan/references/plan-sections.md` and `plan-template.md` — both already ship a `## System-Wide Impact` section whose bullets include `API surface parity` and `Integration coverage`; this is the closest existing primitive to the proposed lens (drives U2's new-vs-enrich reconciliation and Gate condition 2).
  - `skills/spec-plan/references/deepening-workflow.md` — section-to-agent mapping currently lists `spec-architecture-strategist`, `spec-spec-flow-analyzer`, `spec-security-sentinel`, `spec-data-integrity-guardian`, `spec-performance-oracle`, `spec-deployment-verification-agent`. It does **not** list `spec-api-contract-reviewer` or `spec-design-lens-reviewer`, though both exist as agent assets under `agents/` (drives U3's two-group framing).
- commands_or_tools_used: `grep -c` over `deepening-workflow.md` for each specialist name (api-contract-reviewer → 0, design-lens-reviewer → 0); `grep -nE "^plan_depth:"` over `docs/plans/*` (every spec-first plan is CLI/skill/governance/runtime work — none are multi-client App/H5/PC/Admin plans); `npx jest tests/unit/plan-status-taxonomy.test.js` (PLAN_STATUSES = `active | partially-shipped | completed | superseded`; no `deferred` value — confirms the prose-lock rationale).
- key_findings:
  - The repo status taxonomy has no `deferred` state, so a deferred plan must hold the lock in prose under `status: active` — the plan's Completion Criteria is correct on this.
  - spec-first's own `docs/plans/` cannot organically supply ≥2 multi-client multi-surface samples; the Gate's primary evidence source must be real downstream multi-end requirement plans (already reflected in the Gate / U1).
  - The proposed lens partially overlaps the existing `## System-Wide Impact` section (consequence-framing vs per-surface decision-framing); U2 must reconcile new-vs-enrich and Gate condition 2 must test against that primitive (already reflected).
- impact_on_plan: confirms the Gate/U1 evidence-source wording, the U2 reconciliation against System-Wide Impact, and the U3 specialist-mapping correction. No finding changed the plan's deferred posture or scope.
- limitations: the multi-end planning "gap" itself remains unobserved on a real plan; these reads establish the plan's structural and provenance facts, not the gap's existence — that is what the U1 Gate tests before any guidance lands.

---

## Context & Research (industry, deep-research run `wf_d7587d4a-88f`, adversarially verified)

- **Conditional surface coverage has direct precedent** (high, unanimous): spec-kit's `plan-template.md` "Source Code" section gives conditional options (single project / web frontend+backend / mobile+API) marked `[REMOVE IF UNUSED]`, with the instruction to delete unused options, expand the chosen one to real paths, and leave no Option labels in the delivered plan. → Validates R1/R3 (conditional, delete-unused, not exhaustive). Note: spec-kit ships only ~3 options; this plan should stay similarly small and repo-derived, not expand to a 9-row matrix.
- **Module coverage = advisory structure + conditional options + checklist, not a fixed full-section template** (high, unanimous): spec-kit marks its structure "advisory", allows `NEEDS CLARIFICATION`, and uses embedded checklists. → Supports a lens, not mandatory headings.
- **New-agent threshold** (high, unanimous): Anthropic's standard is "define a custom subagent when you keep spawning the same kind of worker with the same instructions"; Claude Code's built-in Plan subagent is read-only context gathering, not structured plan generation. → Grounds R4: reuse existing specialists; create an agent only on a proven, repeated, same-instruction need.
- `docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md`: evidence and existing-primitive gates before heavy borrowed mechanisms.

---

## Key Technical Decisions

These are the load-bearing choices that constrain implementation; the Requirements (R1–R6) state *what must hold*, while this section records *why each path was chosen and what was rejected*.

- **Conditional lens, not a mandatory section** — the coverage check appears only when a plan touches >1 surface; single-surface/lightweight plans omit it cleanly. *Why:* a mandatory section would create empty-row padding and lengthen every plan, working against 001's R1 (shorter human first pass) and 004's constraint-budget. *Rejected:* a fixed exhaustive multi-surface table every plan must fill.
- **Reference-resident, not spine-resident** — guidance lives in `plan-sections.md` (and optionally a dedicated reference); `SKILL.md` carries at most one conditional pointer near Phase 4. *Why:* preserves the post-004 spine slimming and the two-class capability-binding posture. *Rejected:* placing the guidance body in the SKILL spine, or using `governance-boundaries.md` as the carrier (that is context-intake governance, not plan output structure).
- **Single list + derivation rule, not two overlapping tables** — one representative surface list with the rule "enumerate the surfaces that actually exist in the target repo/product". *Why:* the original Track B had a 17-module model **and** a 9-surface matrix that overlapped heavily. *Rejected:* the dual-table design and any closed exhaustive set.
- **Enrich the existing `## System-Wide Impact` by default, not a new parallel section** — U2 must explicitly decide new-vs-enrich and default to enrich unless the per-surface decision matrix is demonstrably distinct from System-Wide Impact's consequence-framing. *Why:* the existing section already prompts cross-surface consequences (API surface parity / integration coverage); a parallel section would duplicate it — the same capability-borrowing discipline the plan applies elsewhere. *Rejected:* adding `## Surface Coverage` as a top-level section without reconciliation.
- **No new agent by default; prefer reusing existing specialists or a deterministic script** — deepening depth routes through existing reviewer agents; a new agent is justified only by a repeated, same-instruction *semantic* coverage miss. *Why:* Anthropic's "custom subagent only for repeated same-instruction work" standard, and the role contract's "file discovery is script-owned". *Rejected:* per-surface specialist agents, or a new `spec-surface-coverage-reviewer` on enumerative (not semantic) grounds.
- **Gate-first: observe before landing, with active sample collection** — U1 verifies the gap on real multi-end plans before any guidance lands; insufficient evidence keeps the plan deferred rather than defaulting to "primitives already cover". *Why:* 001's review flagged that the original Track B asserted the gap rather than observing it; industry shows checklists are not validated by controlled ablation. *Rejected:* the dropped controlled-ablation evaluation regime.

---

## Implementation Units

Order: U1 (gate check) → U2 (lens) → U3 (deepening/agent boundary) → U4 (closeout). U-IDs are local to this plan.

### U1. Run the cheap real-plan gate check

**Goal:** Decide whether the lens is needed using real plan samples, not assertion.

**Requirements:** Gate

**Dependencies:** 001 shipped (provenance prerequisite). Collecting and inspecting the ≥2 multi-surface samples is U1's own work, not a precondition for starting it — the ≥2 threshold is U1's **pass criterion** (too few → `insufficient-evidence`, stay deferred), not a launch dependency.

**Files:**
- Inspect: ≥2 genuine recent Standard/Deep multi-surface samples — **primarily** real downstream multi-end requirement plans `spec-plan` produced for App/H5/PC-web/Admin/backend development; spec-first's own `docs/plans/*` (per R1's surface definition) are admissible secondary samples (prefer post-001 for provenance). 001's closeout seeds only a single decision-brief baseline sample, **not** multi-surface ones, so it is not where the ≥2 samples are located.
- Record: a short finding in this plan's closeout or a `docs/validation/spec-plan/` note

**Approach:**
- **Active verification is preferred over passively waiting for samples to accumulate.** Because multi-end planning is a core spec-first scenario (not an edge case), the cheapest path to gate evidence is to deliberately run the review-for-misses check on the next genuine multi-end requirement plan: when a real App/H5/PC-web/Admin/backend requirement is planned with `spec-plan`, inspect whether the generated plan accounted for every in-scope end. This produces real evidence in days, not an indefinite wait.
- Gather ≥2 genuine recent Standard/Deep multi-surface plan samples (per R1's surface definition), **primarily** real downstream multi-end requirement plans, secondarily spec-first's own `docs/plans/`. Prefer samples generated after 001 shipped for provenance, but do not treat 001's closeout as their source — it seeds only one decision-brief baseline sample. Record each sample's repo, path, and pre-/post-001 provenance.
- If fewer than 2 genuine multi-surface samples exist, the Gate does **not** pass: record `insufficient-evidence`, keep this plan deferred, and do not treat sparse evidence as "primitives already cover". (Given the multi-end core scenario, insufficient evidence signals "go actively collect a sample", not "the need is unreal".)
- Check whether existing `## Summary` + the existing `## System-Wide Impact` section + current deepening specialists already surfaced the relevant surfaces, or demonstrably missed an in-scope one. This is a review-for-misses pass against the real surfaces, not application of a lens (the lens does not exist until U2).
- Scope honestly: this pass catches enumerative misses (visible in hindsight), not unknown-unknown surfaces; record that limitation. A persistent unknown-unknown gap routes to U3's enumeration-script path, not to this gate.
- If no miss: stop; keep this plan Deferred and record why. If miss: proceed to U2.

**Verification:**
- A recorded, honest gate result (pass → proceed; null → stay deferred). No controlled experiment required.

---

### U2. Add the conditional surface-coverage lens (reference-resident)

**Goal:** Add a small, conditional, omittable surface list with a derivation rule — only if U1 passed.

**Requirements:** R1, R2, R3, R5

**Dependencies:** U1 (passed)

**Files:**
- Modify: `skills/spec-plan/references/plan-sections.md` (the lens lives here, under "Include When Material")
- Modify if needed: `skills/spec-plan/references/plan-template.md` (one optional conditional section in the skeleton)
- Create only if guidance volume warrants: `skills/spec-plan/references/surface-coverage.md` (loaded on demand; never spine-resident)
- Spine pointer only (no guidance body): `skills/spec-plan/SKILL.md` (≤1 conditional `read references/...` line near Phase 4)
- Test: `tests/unit/spec-plan-contracts.test.js`

**Approach:**
- **First, reconcile against the existing `## System-Wide Impact` section** (present in both `plan-sections.md` and `plan-template.md`, with `API surface parity` and `Integration coverage` bullets). Decide explicitly whether `Surface Coverage` is a **new** section or an **enrichment** of `## System-Wide Impact`. Default to enriching `## System-Wide Impact` unless a per-surface in-scope/out-of-scope/deferred **decision** matrix is demonstrably distinct from that section's **consequence-framed** prose ("what else is impacted / which other interfaces need the same change"). The two answer different questions — coverage enumeration vs impact propagation — but the plan must not add a parallel section that silently duplicates the existing one. Record the chosen shape (new vs enrich) and the one-line reason in U2 closeout.
- Add a conditional `Surface Coverage` lens: when the plan touches >1 client/contract/runtime/data/ops surface, the writer marks each **materially-considered** surface in-scope / out-of-scope / deferred.
- **Single list + derivation rule:** list representative surfaces (App, H5, PC web, Admin, backend, data/API, events/jobs, observability, testing) as *examples*, and state the rule: enumerate the surfaces that actually exist in the target repo/product; extend or drop rows accordingly. No second "module model" table.
- Adopt spec-kit's delete-unused discipline: irrelevant surfaces are omitted, not carried as empty rows. There is **no `not-applicable` state** — an N/A surface is irrelevant and is simply omitted; a surface that was considered but deliberately left unchanged uses `out-of-scope: <reason>` so the consideration stays visible.
- Keep it visible Markdown; no hidden schema.
- Bind the **capability** (the lens is offered, described, and omittable) per 004's two-class rule; keep heading-order / `### U1.` / projection-path assertions exact.

**Test scenarios:**
- Happy path: `plan-sections.md` describes the conditional lens for Standard/Deep multi-surface plans.
- Edge case: lightweight/single-surface plans omit it cleanly and still pass capability binding.
- Error path: tests fail if guidance implies every plan must include App/H5/Admin/backend rows regardless of relevance.
- Error path: tests fail if the lens body lands in the `SKILL.md` spine instead of a reference (spine may carry only a conditional pointer).
- Integration path: `Summary`, `Direct Evidence`, `Requirements`, and implementation-unit contracts still hold.

**Verification:**
- A plan touching App + H5 + backend + Admin generates explicit per-surface coverage decisions; a backend-only plan stays compact. Guidance is reference-resident; spine carries at most a pointer.

---

### U3. Keep deepening on existing specialists; gate any new agent

**Goal:** Route multi-surface depth through existing specialists; do not add an agent without proven need.

**Requirements:** R4

**Dependencies:** U2

**Files:**
- Modify: `skills/spec-plan/references/deepening-workflow.md`
- Do not create unless the evidence gate below passes: `agents/spec-surface-coverage-reviewer.agent.md`
- Test: `tests/unit/spec-plan-contracts.test.js`; `tests/unit/agent-support-contracts.test.js` only if an agent is added

**Approach:**
- Update deepening guidance so multi-surface depth first reuses existing specialist **agent assets** as domain lenses at plan time. These split into two groups, and the plan must not blur them:
  - **Already in `deepening-workflow.md`'s section-to-agent mapping** (pure reuse, no wiring): `spec-architecture-strategist`, `spec-spec-flow-analyzer`, `spec-security-sentinel`, `spec-data-integrity-guardian`, `spec-performance-oracle`, `spec-deployment-verification-agent`.
  - **Exist as agents under `agents/` but NOT yet in the deepening mapping** (this unit wires them in — a real edit + contract-test update, inside U3's already-declared "Modify: `deepening-workflow.md`" scope, not pure reuse): `spec-api-contract-reviewer`, `spec-design-lens-reviewer`. For `spec-design-lens-reviewer` specifically, justify its fit as a plan-time deepening lens before adding it (it is currently a doc-review lens agent); do not assume it is deepening-eligible.
- **New-agent gate (compressed):** create a new agent only if a *repeated, same-instruction* need appears that existing specialists do not cover — i.e., a **semantic** coverage miss (surfaces are enumerable but their coverage judgment is consistently wrong), not an enumerative one. Per Anthropic's standard, a custom subagent is justified only when you keep spawning the same kind of worker with the same instructions. Context isolation alone is not a justification (existing deepening dispatch already isolates).
- If enumeration (not judgment) is the gap, prefer a deterministic surface-discovery script (scan `ios/`, `android/`, `admin/`, `migrations/`, etc.) over an agent — file discovery is script-owned per the role contract.
- Any agent added must be read-only, conditional, internal to documented deepening phases, and not a public workflow entry.

**Test scenarios:**
- Happy path: deepening routes multi-surface gaps through existing specialists first.
- Error path: tests fail if the workflow suggests unconditional per-surface agent dispatch or public skill-node proliferation.
- If an agent is added: tests confirm it is an internal reviewer asset, not a standalone user entrypoint.

**Verification:**
- Closeout states whether an agent was added and what repeated, same-instruction evidence justified it; if none, existing primitives suffice. It also discloses any change to `deepening-workflow.md`'s section-to-agent mapping — including wiring in `spec-api-contract-reviewer` / `spec-design-lens-reviewer` — distinctly from net-new agent creation, so "reuse existing" is not conflated with new wiring.

---

### U4. Changelog, validate, refresh runtime

**Goal:** Honest closeout for whatever U2/U3 actually landed.

**Requirements:** R5, R6

**Dependencies:** U2, U3

**Files:**
- Modify: `CHANGELOG.md`
- Test: `tests/unit/spec-plan-contracts.test.js`

**Approach:**
- Add a `(user-visible)` CHANGELOG entry with the configured developer author.
- Run focused spec-plan contract tests + `npm run lint:skill-entrypoints`.
- Run `spec-first init` only if runtime regeneration is in scope; never patch mirrors directly.
- Fresh-source eval for skill prose if dispatch is available; otherwise record the reason.

**Verification:**
- Closeout lists commands run, runtime refresh status, eval status, and residual limitations.

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Lens becomes boilerplate that lengthens every plan | Medium | Medium | Conditional + omittable + delete-unused (spec-kit pattern); only when >1 surface. |
| Works against 001's R1 (shorter first pass) | Medium | Medium | Reference-resident; appears only for genuinely multi-surface plans; never spine-resident. |
| Existing primitives already cover the misses (no real gap) | Medium | Medium | U1 gate actively tests it on a real multi-end requirement plan before any guidance lands; a tested-and-not-confirmed result closes the plan as superseded rather than shipping an unneeded lens. |
| New-agent sprawl | Low | High | Reuse existing specialists; agent only on proven repeated same-instruction semantic miss; prefer a script for enumeration gaps. |
| Single list grows back into a 9-row exhaustive matrix | Medium | Medium | Derivation rule (enumerate repo-real surfaces) + delete-unused; representative examples, not a closed set. |

---

## Open Questions

### Deferred to Implementation

- Final placement: inline in `plan-sections.md` vs a dedicated `surface-coverage.md` — decide by guidance volume at U2 time.
- Whether `spec-doc-review`/`spec-write-tasks`/`spec-work` need any prose update for the conditional section — inspect at U2 time.

---

## Sources & References

- Parent / source plan: `docs/plans/2026-06-11-001-refactor-spec-plan-decision-surface-coverage-plan.md`
- Constraint-budget prerequisite: `docs/plans/2026-06-11-004-refactor-spec-plan-skill-slimming-plan.md`
- Handoff-gate prerequisite: `docs/plans/2026-06-11-003-refactor-spec-plan-plan-mode-hardening-plan.md`
- Plan sections contract: `skills/spec-plan/references/plan-sections.md`
- Plan template: `skills/spec-plan/references/plan-template.md`
- Deepening workflow: `skills/spec-plan/references/deepening-workflow.md`
- Plan contract tests: `tests/unit/spec-plan-contracts.test.js`
- U1 gate record: `docs/validation/spec-plan/surface-coverage-lens-u1-gate-2026-06-13.md`
- Capability-borrowing gate pattern: `docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md`
- Project role contract: `docs/10-prompt/结构化项目角色契约.md`
- Industry: spec-kit conditional plan template `https://github.com/github/spec-kit/blob/main/templates/plan-template.md`; Anthropic subagents `https://docs.anthropic.com/en/docs/claude-code/sub-agents`; building effective agents `https://www.anthropic.com/engineering/building-effective-agents`

## Completion Evidence

Implemented by user override after U1 recorded `gate-not-met`. U2 landed as a conditional enrichment of `## System-Wide Impact` in `skills/spec-plan/references/plan-sections.md` and `skills/spec-plan/references/plan-template.md`; it remains reference-resident and omittable, with no new top-level `## Surface Coverage` section and no `SKILL.md` spine body. U3 landed in `skills/spec-plan/references/deepening-workflow.md` by routing multi-surface depth through existing specialists (`spec-api-contract-reviewer` and conditional `spec-design-lens-reviewer`) without creating `spec-surface-coverage-reviewer`. U4 updated `CHANGELOG.md`, recorded the override in the U1 validation note, and used focused contract tests to guard the new prose. Runtime mirrors were refreshed from the current checkout with `node bin/spec-first.js init --codex -y`; generated mirrors were not hand-edited as source.
