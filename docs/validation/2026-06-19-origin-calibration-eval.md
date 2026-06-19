---
title: Origin-aware doc-review calibration — first Evaluation Harness measurement
date: 2026-06-19
type: validation
target_repo: spec-first
status: concerns
mechanism_under_test: skills/spec-doc-review/references/subagent-template.md (document-type-rules, Origin calibration)
origin: docs/validation/2026-06-19-ce-recent-diff-comparison.md
---

# Origin-aware doc-review calibration — first measurement

## 结论先行

spec-first **already implements** origin-aware persona calibration (the CE-comparison report's P2
mis-classified it as a missing feature; corrected in that doc). The real residual was an **eval gap**:
nothing measured whether the mechanism actually does what it claims. This is the first measurement,
discharging role-contract §10's 推进义务 for an `(aspirational)` Evaluation-Harness mechanism.

**Result: `concerns`, not `passed`.**

- **Safety property — confirmed.** Legitimate plan-introduced critique (the speculative R5/Unit 4 "saved
  view" framework) fired at confidence 75–100 in **every** `origin: set` run. The calibration does NOT
  silence reviewers; new scope / contradiction / new risk still surfaces, exactly as the template carves out.
- **Suppression property — weak and inconsistent.** The claim "if `Origin` is not `none`, do not routinely
  re-litigate upstream WHAT/WHY" held cleanly for only one of three personas. The dominant force keeping
  upstream premise re-litigation out of the *actionable* tier is the **confidence rubric** (premise /
  strength-of-argument concerns cap at anchor 50 → FYI), not the origin rule. The origin rule adds a
  secondary nudge that one persona honored explicitly and two did not visibly act on.

Practical implication: the synthesis pipeline already protects the actionable tier from upstream
re-litigation (via the 50-cap), so the user-visible false-positive risk is lower than the CE report
implied — but the origin rule itself is under-powered and should not be cited as the mechanism that
delivers the protection.

## What was measured

Mechanism: `skills/spec-doc-review/references/subagent-template.md` `<document-type-rules>` —
> "If `Origin` is not `none`, do not routinely re-litigate upstream WHAT/WHY; flag product or strategy
> concerns only when the plan introduces new scope, contradicts the origin, or adds a new strategic/
> architectural risk."

This is injected at dispatch by `spec-doc-review/SKILL.md` (Phase 1 extracts `origin:`, Phase 2 fills
`{origin}`); the six reviewer persona files contain no origin text by design. Dispatch is locked by
`tests/unit/spec-doc-review-contracts.test.js`.

## Method (fresh-source eval per docs/contracts/workflows/fresh-source-eval-checklist.md)

A/B over one synthetic **plan** document (full text in Appendix A), held byte-identical except frontmatter:
variant A has `origin: <brainstorm path>`, variant B has no origin (`Origin: none`). The plan deliberately
mixes two finding classes:

1. **Upstream WHAT/WHY** the origin brainstorm already settled — the DAU-uplift motivation, and the
   saved-vs-recent-filters alternative (explicitly decided in the doc). A calibrated reviewer with origin
   set should NOT routinely re-litigate these.
2. **Plan-introduced new scope** — R5 / Unit 4 propose a generic polymorphic "saved view" framework with
   one real consumer. A calibrated reviewer should fire on this **regardless** of origin (the template's
   carve-out).

Six fresh generic subagents (3 premise-sensitive personas × 2 variants), each prompted with the current
on-disk persona source + the current `document-type-rules` + the identical plan, filled exactly as the
orchestrator would. Personas: `spec-adversarial-document-reviewer`, `spec-product-lens-reviewer`,
`spec-scope-guardian-reviewer`. Each agent self-annotated every finding as "upstream WHAT/WHY" vs
"plan-introduced". Confidence anchors and the 50-cap-for-premise rule were included verbatim from the
template so routing reflects production behavior.

## Results

| Persona | Variant | Plan-introduced (R5/Unit4) findings | Upstream WHAT/WHY findings | Upstream routing |
|---|---|---|---|---|
| adversarial | A `origin set` | R5/Unit4 @75 | DAU premise @50; saved-vs-recent @50 | both FYI (anchor 50) |
| adversarial | B `none` | R5/Unit4 @75 | DAU premise @50 | FYI |
| product-lens | A `origin set` | R5/Unit4 @75 | DAU mechanism @50 | FYI |
| product-lens | B `none` | R5/Unit4 @75 | DAU mechanism @50 | FYI |
| scope-guardian | A `origin set` | R5 @100, R5-bundling/test @75 | none (DAU → `residual_risks`, citing doc-type rule) | not a finding |
| scope-guardian | B `none` | R5 @100, Unit4 @100 | none (recent-filters → `residual_risks`) | not a finding |

### Interpretation

1. **Safety holds.** R5/Unit 4 (plan-introduced premature abstraction) fired at 75–100 in all three
   `origin: set` runs. Origin calibration did not suppress legitimate new-scope critique. This is the most
   important property and it is clean.

2. **Suppression is inconsistent across personas.**
   - **scope-guardian** honored the rule explicitly: under `origin: set` it moved the DAU hypothesis to
     `residual_risks` with the note "upstream hypothesis carried from the brainstorm and not re-litigated
     here, per the plan/origin document-type rules." Clean positive signal.
   - **adversarial** did NOT suppress — under `origin: set` it actually emitted **two** upstream concerns
     (vs one under `none`). It self-flagged them as upstream and as overlapping product-lens territory, but
     still surfaced them.
   - **product-lens** was **identical** across variants (one upstream DAU finding at 50 either way) — no
     visible origin effect.

3. **The 50-cap, not the origin rule, is what protects the actionable tier.** Every upstream finding that
   did fire landed at anchor 50 (FYI), because the confidence rubric caps premise / strength-of-argument
   concerns there. In the real synthesis routing (75/100 = actionable, 50 = FYI, 0/25 = dropped), none of
   the upstream re-litigation would reach the actionable surface — but that is the rubric's doing. The
   origin rule's marginal contribution over the rubric is small and persona-dependent.

## Status and rationale

`status: concerns`. The mechanism is real and the safety property is confirmed, but the suppression
property the CE-comparison report attributed to it is under-powered: it does not produce per-persona
suppression of upstream re-litigation; it relies on the confidence rubric for the actual tier protection,
and only one of three personas acted on the origin signal directly.

This does NOT promote the mechanism to `confirmed`. Per role-contract §序言 (anti-豁免) and §10, an honest
`concerns` with a defined improvement path is the correct outcome — not a green stamp, and not indefinite
shelving.

## Limitations (loud)

- **N=1 document, single run, no judge panel.** Directional signal, not statistics. A different plan, or
  multiple runs, could shift per-persona behavior (LLM sampling variance). Do not over-generalize.
- Sub-agents were generic agents fed persona source inline, not the typed reviewer agents (per
  fresh-source-eval anti-pattern #1: typed dispatch may use cached definitions). Behavior is a faithful
  proxy of dispatch, not a runtime integration test of the orchestrator.
- Self-annotation of "upstream vs plan-introduced" is the agent's own judgment; spot-checked against the
  document and consistent, but not independently adjudicated.

## Recommended follow-ups (backlog, not this change)

1. **Strengthen the origin rule where it under-performs**, if a larger sample confirms the gap: have
   premise personas route upstream-WHAT/WHY observations to `residual_risks` under `origin: set` (the
   scope-guardian behavior), rather than emitting them as FYI findings. This would make the suppression
   property real rather than rubric-incidental. Treat as a `spec-doc-review` template change with its own
   plan + contract test — do not patch personas individually (calibration stays at the template layer per
   role-contract §5).
2. Re-measure with ≥3 plans and ≥2 runs each before any `confirmed` claim.

## Re-run / invalidation condition (§10)

Re-run this measurement when **any** of the following change:
- `skills/spec-doc-review/references/subagent-template.md` `<document-type-rules>` or the Confidence rubric
  (the 50-cap is load-bearing for the result),
- the premise sections of `spec-adversarial-document-reviewer`, `spec-product-lens-reviewer`, or
  `spec-scope-guardian-reviewer`,
- `spec-doc-review/SKILL.md` origin extraction / `{origin}` dispatch.

Until then this report is the activation record: the mechanism is **measured (concerns)**, no longer
unexamined.

---

## Appendix A — A/B fixture plan (bodies identical; only frontmatter `origin` differs)

```markdown
---
title: Saved filters for the analytics dashboard
origin: docs/brainstorms/2026-06-10-saved-filters-brainstorm.md   # variant A only; omitted in B
---
# Plan: Saved filters for the analytics dashboard

## Context and goals
The goal is to let users save and reuse dashboard filter combinations. Today users re-apply the same
4-5 filters every session, which wastes time. We believe saved filters will increase daily active usage
because power users will return more often.

## Why this matters
Users have complained that re-entering filters is tedious. Saving filters is the most direct way to
reduce this friction. We are choosing saved filters over a "recent filters" auto-history because saved
filters give users explicit control.

## Requirements
- R1: Users can save the current filter set with a name.
- R2: Users can apply a saved filter from a dropdown.
- R3: Users can delete a saved filter.
- R4: Saved filters sync across devices via the existing user-settings service.
- R5: Build a generic "saved view" framework so future dashboard objects (charts, layouts, column sets)
  can also be saved through the same abstraction.

## Implementation units
- Unit 1: Add a `saved_filters` table keyed by user_id with (name, filter_json, created_at).
- Unit 2: Add REST endpoints POST/GET/DELETE /saved-filters.
- Unit 3: Add the dropdown UI to apply and delete saved filters.
- Unit 4: For R5, introduce a `SavedView` polymorphic base class and migrate saved filters onto it.

## Test scenarios
- Save, apply, delete a filter; verify cross-device sync.
```

Expected: R5/Unit 4 fire in both variants (plan-introduced); DAU motivation and saved-vs-recent are
upstream-settled and should be demoted/suppressed under variant A. Observed behavior and deviations are
in the Results table above.
