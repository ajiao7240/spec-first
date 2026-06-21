# Requirements Capture

This content is loaded when Phase 3 begins — after the collaborative dialogue (Phases 0-2) has produced durable decisions worth preserving.

---

This document should behave like a lightweight PRD without PRD ceremony. Include what planning needs to execute well, and skip sections that add no value for the scope.

The requirements document is for product definition and scope control. Do **not** include implementation details such as libraries, schemas, endpoints, file layouts, or code structure unless the brainstorm is inherently technical and those details are themselves the subject of the decision.

## Section matrix

| Section | Lightweight | Standard / Deep-feature | Deep-product |
|---|---|---|---|
| Summary | Required (1-3 line prose; skip only for truly trivial cases) | Required (1-3 line prose) | Required (1-3 line prose) |
| Problem Frame | Required | Required | Required |
| Assumptions | Non-interactive only, when Inferred bets exist | Non-interactive only, when Inferred bets exist | Non-interactive only, when Inferred bets exist |
| Actors | Omit unless triggered | Triggered (see below) | Triggered (see below) |
| Key Flows | Omit unless triggered | Triggered (see below) | Expected by default |
| Requirements | Required | Required (with R-IDs) | Required (with R-IDs) |
| Acceptance Examples | Required for behavioral-conditional requirements; otherwise omit unless triggered | Required for behavioral-conditional requirements; otherwise triggered (see below) | Required for behavioral-conditional requirements; otherwise triggered (see below) |
| Success Criteria | Required | Required | Required |
| Scope Boundaries | Required (single list) | Required (single list) | Required (split into "Deferred for later" and "Outside this product's identity") |
| Key Decisions | Include when material | Include when material | Include when material |
| Dependencies / Assumptions | Include when material | Include when material | Include when material |
| Outstanding Questions | Include when material | Include when material | Include when material |

## Summary vs Problem Frame discipline

Both sections describe the work, but they answer different questions:

| Section | Question it answers | Time direction | Length |
|---|---|---|---|
| `## Summary` | What is this doc proposing? | Forward-looking | 1-3 lines |
| `## Problem Frame` | Why does this proposal exist? | Backward-looking / situational | Paragraphs |

Disciplines:
- **Summary does not need problem context.** A reader scanning Summary gets the proposal at a glance without first reading motivation.
- **Problem Frame does not restate the proposal.** It establishes the situation, pain, and cost shape. The remedy lives in Summary.

For truly trivial Lightweight cases where Summary is skipped, Problem Frame may absorb the situational and remedy framing in a tighter form. In all other cases, keep both sections and keep their roles separate.

## Triggered sections — when to include

**Actors** — include when multiple humans, agents, or systems are meaningfully involved, or when decisions change based on whose perspective is optimized for. Covers both end-user actors (for product work) and pipeline-agent actors (for agent-workflow work, such as changes to CE's own review or planning flows).

**Key Flows** — include when the work involves multi-step interaction or coordinates across existing flows. At Deep-product tier, include 2-4 primary flows by default; omit only when the product is not meaningfully flow-shaped (e.g., pure API, policy, or artifact output) and Actors, Requirements, Scope Boundaries, and Acceptance Examples already prevent downstream invention of user/agent paths. When omitting at product tier, note the reason in the doc.

**Acceptance Examples** — include when a requirement's behavior is hard to pin down without a concrete scenario. Always include Acceptance Examples covering behavioral-conditional requirements — any requirement framed as "When X, Y" or "If X, Y" — because conditional behavior is where prose often leaves implicit ambiguity. Each example disambiguates one or more requirements via a `Covers: R-IDs` back-reference. Examples are definitive for what they describe but the section is not exhaustive.

*EARS-style phrasing (triggered, not mandatory).* When an example or requirement is hard to pin down, lean on these forms to remove ambiguity — but do not rewrite every requirement into fixed syntax; the goal is clarity, not a grammar drill:

- **Conditional behavior** → `When <trigger>, then <observable result>` or `If <state>, then <observable result>` (Given/When/Then is equivalent). Fix both the condition and the result.
- **Always-on behavior** → a concise observable statement of what must always hold (no trigger needed).
- **Structural / governance rule** → a non-behavioral statement is allowed, but say *why* it is structural rather than behavioral.

## Template

Use this template and omit sections per the matrix above. At Deep-product tier, keep the Scope Boundaries split. At other tiers, use the single Scope Boundaries list.

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
spec_id: YYYY-MM-DD-NNN-<kebab-case-topic>
---

# <Topic Title>

## Summary

[1-3 line prose summary — what is being proposed, in plain language. Forward-looking, not retrospective. Required for Standard / Deep-feature / Deep-product. Skip for Lightweight only when the Requirements bullets are already the summary.]

---

## Problem Frame

[Who is affected, what is changing, and why it matters. Backward-looking / situational. Establishes the pain that motivates the work; does not restate the proposal.]

---

<!-- Include ONLY in non-interactive/headless mode when the agent had Inferred bets that
     were not user-confirmed in chat. Omit in interactive mode. -->
## Assumptions

*This requirements doc was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input — unvalidated bets that should be reviewed before planning proceeds.*

- [Inferred scope item the agent chose without user confirmation]

---

## Actors

[Include when triggered. Each actor gets a stable A-ID and a one-line role description.]

- A1. [Name or role]: [What they do in this context]
- A2. [Name or role]: [What they do in this context]

---

## Key Flows

[Include when triggered. Each flow has trigger, actors, steps, outcome, and a Covered by back-reference.]

- F1. [Flow name]
  - **Trigger:** [What initiates the flow]
  - **Actors:** A1, A2
  - **Steps:** [3-7 steps, prose or short list]
  - **Outcome:** [What is true after the flow completes]
  - **Covered by:** R1, R2, R5

---

## Requirements

[Group under bold inline headers when requirements span distinct concerns. Keep R-IDs sequential across groups — numbering does not restart per group.]

**[Group header, e.g., "Brainstorming workflow"]**
- R1. [Concrete requirement]
- R2. [Concrete requirement]

**[Group header, e.g., "Output document"]**
- R3. [Concrete requirement]

---

## Acceptance Examples

[Include when triggered. Each example is a definitive scenario; the list is not exhaustive.]

- AE1. **Covers R1, R2.** Given [state], when [action], [outcome].
- AE2. **Covers R4.** Given [state], when [action], [outcome].

---

## Success Criteria

- [How we will know this solved the right problem — human outcome.]
- [How a downstream agent or implementer can tell the handoff was clean.]

---

## Scope Boundaries

[At Lightweight, Standard, and Deep-feature tiers, use a single list.]

- [Deliberate non-goal or exclusion]

[At Deep-product tier, split into two subsections:]

### Deferred for later

- [Work that will be done eventually but not in v1]

### Outside this product's identity

- [Adjacent product we could build but are rejecting — positioning decision, not a deferral]

---

## Key Decisions

- [Decision]: [Rationale]

---

## Dependencies / Assumptions

- [Material dependency or assumption]

---

## Outstanding Questions

### Resolve Before Planning

- [Affects R1][User decision] [Question that must be answered before planning can proceed]

### Deferred to Planning

- [Affects R2][Technical] [Question answered during planning or codebase exploration]
- [Affects R2][Needs research] [Question likely requiring research during planning]
```

## ID and layout rules

**Stable IDs.** Standard and Deep scope always assign R-IDs to requirements. Triggered sections use their own prefixes: `A` for Actors, `F` for Key Flows, `AE` for Acceptance Examples. No other ID namespaces.

**ID format.** Use `R1.`, `A1.`, `F1.`, `AE1.` as a plain prefix at the start of the bullet — do not bold the ID. The prefix is visually distinctive on its own.

**Bold leader labels** inside Flows and Acceptance Examples (e.g., `**Trigger:**`, `**Covers R4, R8.**`) give the bullet structure without needing tables or deeper heading levels.

**Horizontal rules (`---`)** between top-level sections in Standard and Deep docs. Omit for Lightweight.

**Grouping within Requirements.** When Standard or Deep requirements span distinct concerns, group them under bold inline headers (not H3s) within the Requirements section. The trigger is distinct logical areas, not item count — even four requirements benefit from headers if they cover three different topics. Group by capability or concern (e.g., "Packaging", "Migration and compatibility", "Contributor workflow"), not by the order they were discussed. Skip grouping only when all requirements are about the same thing.

**Tables** — only for genuinely comparative info. Bullets are cheaper and more portable for content lists.

## Size heuristics

- If a capability-named group has only one requirement, ungroup it.
- If total requirements exceed ~15-20, stop and ask whether this is one brainstorm or several.
- If a requirement can be fully described in a single short bullet with no sub-items, it probably doesn't need grouping at all.
- For Lightweight docs with only 1-3 simple requirements, plain bullets without R-IDs are acceptable.

## Visual communication

Include a visual aid when the requirements would be significantly easier to understand with one. Read `references/visual-communication.md` for the decision criteria, format selection, and placement rules.

## When a document is warranted

- **Lightweight** — keep the document compact. Skip document creation when the user only needs brief alignment and no durable decisions need to be preserved.
- **Standard and Deep (feature or product)** — a requirements document is usually warranted. When the work is simple, combine sections rather than padding them. A short requirements document is better than a bloated one.

## Requirements Readiness Gate

This gate replaces the older flat finalization checklist. Before finalizing, run a lightweight pre-scan, then walk the six readiness dimensions. The gate assesses whether requirements are **ready to hand to planning** — it is LLM-owned judgment, not a script.

**Materiality calibration (what blocks readiness):**

Treat an issue as readiness-blocking only when it would force `spec-plan` to invent WHAT, misunderstand scope/non-goals/success, confuse `Stated` vs `Inferred`, allow opposite implementations, or leave a user/product decision unresolved.

Do not block finalization for style polish, uneven detail that does not affect planning, technical HOW unknowns that naturally belong in planning, or wording improvements that do not change behavior or scope. Capture those as polish, `Deferred to Planning`, or a brief note instead of stretching the brainstorm.

When uncertain, ask: would two competent planners produce materially different product outcomes because of this gap? If yes, clarify before handoff. If no, do not delay planning for it.

**Pre-scan (cheap, do first):**

- **Placeholder scan** — no `TODO`, `TBD`, leftover placeholders, or unfinished sections remain.
- **Contradiction scan** — no *literal* in-document conflict (e.g., a requirement that directly contradicts a Scope Boundary, Success Criterion, or Key Decision in the same doc). This is a same-document consistency check, not a judgment about whether the requirements *should* exist.
- **Prose economy scan** — apply `references/brainstorm-sections.md` `Prose Economy`: one idea per sentence, one requirement intent plus necessary qualifier, unresolved forks moved to `Outstanding Questions`, superseded text resolved in place. Precision is not padding; keep exact IDs, thresholds, actor names, domain terms, and conditions that affect planning.

**Clarity & Non-ambiguity**

- Could any core requirement be read by a downstream planner as two contradictory implementations? If a requirement is ambiguous enough to support opposite builds, sharpen it or record the open question.

**Evidence & Inference provenance**

- Does the doc keep the synthesis `Stated` / `Inferred` / `Out of scope` distinction honest (see `references/synthesis-summary.md`)? Any unconfirmed agent inference must not be presented as a user-confirmed requirement — label it as an assumption or open question.
- Do any requirements claim that infrastructure is absent without that claim having been verified against the codebase? If so, verify now or label as an unverified assumption.

**Traceability & Coverage**

- If Actors are named, is each actor mentioned in the problem represented in at least one requirement, flow, or scope boundary?
- If Key Flows are present, does each flow identify actor, trigger, outcome, and a failure or escape path when relevant?

**Testability**

- Does every Standard/Deep requirement have either an observable behavior or a stated reason it is structural?
- Do Success Criteria cover both human outcome and downstream-agent handoff quality?
- For behavioral-conditional requirements, is there an Acceptance Example that fixes the condition and the result? (See the EARS-style guidance under Acceptance Examples.)

**Boundary integrity**

- Did implementation details leak in when they shouldn't have?
- Do any requirements depend on something claimed to be out of scope?
- At Deep-product tier: if Key Flows are omitted, is the reason stated in the doc, and do Actors, Requirements, Scope Boundaries, and Acceptance Examples together prevent downstream invention of user/agent paths?
- At Deep-product tier: does Scope Boundaries distinguish "Deferred for later" from "Outside this product's identity"?

**Planning-invention & Handoff readiness**

- What would `spec-plan` still have to invent if this brainstorm ended now?
- Are any unresolved items actually product decisions rather than planning questions?
- Is `Resolve Before Planning` empty? If not, keep working those questions, convert each into an explicit decision/assumption/`Deferred to Planning` question, or record that the user chose to proceed at risk.

**Scope note (out of this gate's range):** Whether requirements should be **decomposed** into sub-epics or split across multiple plans is *not* this gate's job. Lightweight size-sanity already lives in `## Size heuristics` above ("exceed ~15-20, stop and ask whether this is one brainstorm or several"); heavyweight decomposition decision-making awaits the separate process-safety line. If a doc trips the size heuristic, route it there — the gate flags, it does not decide the split.

**Beyond pass/fail (improvement prompts, not readiness blockers):**

- Is there a low-cost change that would make this materially more useful?
- Would a visual aid (flow diagram, comparison table, relationship diagram) help a reader grasp the requirements faster than prose alone? (See `## Visual communication` above.)

If planning would need to invent product behavior, scope boundaries, or success criteria, the brainstorm is not complete yet.

Ensure `docs/brainstorms/` directory exists before writing.

## Spec ID rules

Every new requirements document must carry a `spec_id` in YAML frontmatter. `spec_id` is an identity field that links requirements, plans, and derived task packs for the same spec chain. It is not a status, approval marker, progress field, freshness check, or replacement for R/A/F/AE IDs.

Use this format:

`YYYY-MM-DD-NNN-<slug>`

For new requirements documents, use the filename:

`docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md`

Choose `NNN` by scanning same-day brainstorm requirements files that already use the sequenced pattern above. Ignore legacy non-sequenced files when choosing the next number. If a same `spec_id` appears in existing requirements, plan, or task-pack frontmatter and the files are not part of the same origin/source chain, choose the next local sequence value or ask the user to confirm the intended chain. This is a local deterministic check, not a central registry.

The frontmatter is the machine-readable contract. The filename should match when the document is generated, but a later rename or move does not change the document's identity.

## Outstanding questions guidance

If a document contains outstanding questions:

- Use `Resolve Before Planning` only for questions that truly block planning.
- If `Resolve Before Planning` is non-empty, keep working those questions during the brainstorm by default.
- If the user explicitly wants to proceed anyway, convert each remaining item into an explicit decision, assumption, or `Deferred to Planning` question before proceeding.
- Do not force resolution of technical questions during brainstorming just to remove uncertainty.
- Put technical questions, or questions that require validation or research, under `Deferred to Planning` when they are better answered there.
- Use tags like `[Needs research]` when the planner should likely investigate the question rather than answer it from repo context alone.
- Carry deferred questions forward explicitly rather than treating them as a failure to finish the requirements doc.
