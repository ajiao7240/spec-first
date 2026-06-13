---
title: "refactor: Add a conditional surface-coverage lens to spec-plan (deferred)"
type: refactor
status: active
date: 2026-06-12
spec_id: 2026-06-12-005-spec-plan-surface-coverage-lens
plan_depth: standard
---

# refactor: Add a conditional surface-coverage lens to spec-plan (deferred)

> **DEFERRED — do not start until the gate below opens.** This plan was split out of `docs/plans/2026-06-11-001-refactor-spec-plan-decision-surface-coverage-plan.md` (the former "Track B"). It is a separate delivery chain with its own `spec_id`. Two reasons it is not active: (1) it grows Standard/Deep plan length, working against 001's R1 (a shorter human first pass), so it must not bundle with 001's decision-brief work; (2) the original Track B design was over-built (a 17-module model + 9-surface matrix gated behind a controlled ablation experiment). This redraft adopts a lighter, industry-validated shape and a cheaper gate. **Start condition:** 001 (decision brief) has shipped and ≥2 genuine Standard/Deep *multi-surface* plan samples exist (prefer post-001), AND those samples (or normal use) show existing primitives actually miss surfaces — see Gate below.

## Summary

When and only when evidence shows it is needed, add a **conditional** surface-coverage lens to `spec-plan` so Standard/Deep plans touching multiple clients, contracts, or runtime surfaces make an explicit in-scope / out-of-scope / deferred decision for each materially-considered surface (irrelevant surfaces are simply omitted, not marked not-applicable) — borrowing the **form** of spec-kit's conditional `[REMOVE IF UNUSED]` pattern (conditional, delete-unused, non-exhaustive), while the per-surface decision **semantics** are a spec-first design choice the U1 Gate must justify. Kept reference-resident and omittable, with no spine bloat and no new agents by default.

---

## Problem Frame

Multi-end work (App, H5, PC web, Admin, backend, data, API, events, observability) can silently miss a surface during planning: a surface omitted because it is irrelevant is fine, but a surface omitted because nobody checked it is a planning gap. The open question is whether `spec-plan`'s existing `## Summary` plus current deepening specialists already catch this, or whether an explicit conditional lens earns its place.

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

1. **001 has shipped** the decision brief, and ≥2 genuine recent Standard/Deep *multi-surface* plans exist to inspect. ("Multi-surface" follows R1's definition — >1 client, backend surface, API/schema/event contract, data lifecycle, operational concern, or rollout path. For spec-first's own plans this includes the Claude/Codex dual-host split, CLI, skills/agents, contracts, and runtime mirrors; it is **not** limited to App/H5/PC-web/Admin clients, which are illustrative of downstream consumer products.) Samples may be drawn from spec-first's own `docs/plans/` **or** from a genuine multi-surface plan that `spec-plan` generated when applied to a downstream multi-client repo — the latter matches the lens's actual beneficiary population. **`001 has shipped` is a provenance prerequisite (so post-001 plans reflect the decision-brief output), not a source of the multi-surface samples themselves.** Prefer plans generated after 001 landed; record each sample's repo, path, and pre-/post-001 provenance. Fewer than 2 genuine multi-surface samples means the Gate **cannot pass** (insufficient evidence) — it does not default to "primitives already cover".
2. **A cheap real-plan check shows a gap:** review those real multi-surface samples (or observe normal use) and ask whether existing primitives — `## Summary`, the existing `## System-Wide Impact` section (its `API surface parity` / `Integration coverage` bullets already prompt cross-surface consequences), and current deepening specialists — already surfaced the relevant surfaces, or demonstrably missed an in-scope one. The miss must be one those existing primitives — especially the `## System-Wide Impact` bullets — do **not** already cover; if they do, the gap is a usage/prompting problem, not a missing section, and this plan stays Deferred. If they missed an in-scope surface, the lens is authorized to land. (This is a review-for-misses check, not an application of a not-yet-built lens.)

**What this gate can and cannot detect.** It reliably catches *enumerative* misses — a surface that is visible in hindsight once the plan is read against the repo's real surfaces. It is weak for the *unknown-unknown* surface (the one nobody thought to enumerate — e.g., an embedded SDK), which can surface as a false "null = primitives already cover." That residual risk is **not** owned by this gate; it routes to U3's deterministic surface-enumeration script path, not to relaxing the gate.

This is the symmetric, affordable version of the evidence discipline 001 imposed on new agents — applied to the inline lens, without a controlled experiment. If dispatch/tooling for the check is unavailable, record the reason and keep this plan deferred; do not claim the gate passed.

---

## Completion Criteria

This is an **execution-locked, deferred plan**. `status: active` is the only legal value (the repo status taxonomy has no `deferred`; see `tests/unit/plan-status-taxonomy.test.js`), so the lock lives in prose, not frontmatter:

- **Execution lock:** do not enter U2–U4 until **both** Gate conditions hold. `spec-work` (or any executor) handed this plan path must verify the Gate first; if it is not met, stop and report `gate-not-met` without implementing. U1 is the only unit runnable before the Gate opens.
- **Null gate stays deferred:** if U1 returns null (existing primitives already cover) or insufficient evidence (<2 genuine multi-surface samples), record the result and keep `status: active` with the DEFERRED banner intact. Do **not** mark `status: completed` for a null or insufficient-evidence gate.
- **Completion path:** move to `status: completed` only after U2–U4 actually land behind a passed Gate — never silently completed.
- **Bounded deferral (no indefinite limbo):** review by **2026-09-12** (one quarter post-001). If by then no qualifying multi-surface sample has appeared (from spec-first's own plans or a downstream multi-client repo) and the Gate has not opened — or after 2 recorded `gate-not-met` / insufficient-evidence checks — close as `status: superseded` with a one-line rationale and a `docs/solutions/` pointer recording the idea, the dropped over-built Track B version, and the trigger to revisit. `superseded` is also the right close if a later plan subsumes this work. Do not leave the plan as `active` + DEFERRED past the review date without an explicit decision.

---

## Direct Evidence Readiness

- target_repo: `spec-first`
- evidence_sources: direct source reads, prior plan `2026-06-11-001`, prior plan `2026-06-11-004`, verified industry research (deep-research run `wf_d7587d4a-88f`)
- source_refs: `skills/spec-plan/references/plan-sections.md`, `skills/spec-plan/references/plan-template.md`, `skills/spec-plan/references/markdown-rendering.md`, `skills/spec-plan/references/deepening-workflow.md`, `skills/spec-plan/SKILL.md`, `tests/unit/spec-plan-contracts.test.js`, `docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md`, `docs/10-prompt/结构化项目角色契约.md`
- external_refs: `https://github.com/github/spec-kit/blob/main/templates/plan-template.md`, `https://docs.anthropic.com/en/docs/claude-code/sub-agents`, `https://www.anthropic.com/engineering/building-effective-agents`
- confidence: high that the conditional pattern has industry precedent and the lighter shape is correct; medium that the gap exists at all (that is exactly what the Gate tests before landing)
- limitations: the "gap" is not yet observed in real `spec-first` plans; this plan deliberately does not assert it. Industry precedent (spec-kit) validates the conditional / delete-unused / non-exhaustive **form** (R1/R3), not the per-surface in-scope/out-of-scope/deferred **decision semantics** (the `out-of-scope: <reason>` state) — that semantics is a spec-first design choice justified by the U1 Gate, not by the spec-kit citation. spec-kit's own block is project-directory-structure scaffolding, a related but distinct mechanism.

---

## Context & Research (industry, deep-research run `wf_d7587d4a-88f`, adversarially verified)

- **Conditional surface coverage has direct precedent** (high, unanimous): spec-kit's `plan-template.md` "Source Code" section gives conditional options (single project / web frontend+backend / mobile+API) marked `[REMOVE IF UNUSED]`, with the instruction to delete unused options, expand the chosen one to real paths, and leave no Option labels in the delivered plan. → Validates R1/R3 (conditional, delete-unused, not exhaustive). Note: spec-kit ships only ~3 options; this plan should stay similarly small and repo-derived, not expand to a 9-row matrix.
- **Module coverage = advisory structure + conditional options + checklist, not a fixed full-section template** (high, unanimous): spec-kit marks its structure "advisory", allows `NEEDS CLARIFICATION`, and uses embedded checklists. → Supports a lens, not mandatory headings.
- **New-agent threshold** (high, unanimous): Anthropic's standard is "define a custom subagent when you keep spawning the same kind of worker with the same instructions"; Claude Code's built-in Plan subagent is read-only context gathering, not structured plan generation. → Grounds R4: reuse existing specialists; create an agent only on a proven, repeated, same-instruction need.
- `docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md`: evidence and existing-primitive gates before heavy borrowed mechanisms.

---

## Implementation Units

Order: U1 (gate check) → U2 (lens) → U3 (deepening/agent boundary) → U4 (closeout). U-IDs are local to this plan.

### U1. Run the cheap real-plan gate check

**Goal:** Decide whether the lens is needed using real plan samples, not assertion.

**Requirements:** Gate

**Dependencies:** 001 shipped; ≥2 genuine recent Standard/Deep multi-surface samples available

**Files:**
- Inspect only: ≥2 genuine recent Standard/Deep multi-surface samples — from spec-first's own `docs/plans/*` (per R1's surface definition) and/or downstream multi-client repos `spec-plan` was used on (prefer post-001 for provenance). 001's closeout seeds only a single decision-brief baseline sample, **not** multi-surface ones, so it is not where the ≥2 samples are located.
- Record: a short finding in this plan's closeout or a `docs/validation/spec-plan/` note

**Approach:**
- Gather ≥2 genuine recent Standard/Deep multi-surface plan samples (per R1's surface definition), drawn from spec-first's own `docs/plans/` and/or downstream multi-client repos `spec-plan` was applied to. Prefer samples generated after 001 shipped for provenance, but do not treat 001's closeout as their source — it seeds only one decision-brief baseline sample. Record each sample's repo, path, and pre-/post-001 provenance.
- If fewer than 2 genuine multi-surface samples exist, the Gate does **not** pass: record `insufficient-evidence`, keep this plan deferred, and do not treat sparse evidence as "primitives already cover".
- Check whether existing `## Summary` + current deepening specialists already surfaced the relevant surfaces, or demonstrably missed an in-scope one. This is a review-for-misses pass against the repo's real surfaces, not application of a lens (the lens does not exist until U2).
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
| The asserted gap does not exist | Medium | Medium | U1 gate tests it on real plans before any guidance lands; null result keeps plan deferred. |
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
- Capability-borrowing gate pattern: `docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md`
- Project role contract: `docs/10-prompt/结构化项目角色契约.md`
- Industry: spec-kit conditional plan template `https://github.com/github/spec-kit/blob/main/templates/plan-template.md`; Anthropic subagents `https://docs.anthropic.com/en/docs/claude-code/sub-agents`; building effective agents `https://www.anthropic.com/engineering/building-effective-agents`
