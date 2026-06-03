# Synthesis Summary

**Synthesis is not the requirements doc.** The synthesis is a scope checkpoint that Phase 3 consumes as input. The requirements doc is written only after the synthesis is confirmed, or after headless routing records unconfirmed inferences as assumptions. Both artifacts stay scope-only: implementation details such as file paths, schemas, exact error wording, and method names belong in planning.

**Two-stage shape: internal draft, then chat-time scoping synthesis.** First compose an internal three-bucket draft so scope thinking stays complete. Then derive the user-facing scoping synthesis from that draft. The user sees the compressed stage 2, not the full three-bucket draft. This prevents a comprehensive audit shape from becoming too detailed for correction.

**Three-Bucket Structure is internal.** The Stated / Inferred / Out-of-scope buckets help the agent reason, then dissolve into the requirements document body. The requirements doc does not get a parallel `## Synthesis` section. Only the stage-2 "What we're building" prose embeds as `## Summary`.

This reference is loaded when Phase 2.5 fires, after approaches are selected and before requirements capture. It gives the user a final chance to correct the agent's interpretation before a durable artifact lands. It fires for all software tiers, including Lightweight. Skip it only for the non-software universal brainstorming route.

---

## Stage 1: Internal Three-Bucket Draft

Use three labeled buckets internally:

- **Stated** — what the user said directly in the original prompt, prior conversation, dialogue answers, or approach selection.
- **Inferred** — assumptions the agent made to fill gaps: scope boundaries, success criteria, actor priorities, or other bets the user has not explicitly confirmed.
- **Out of scope** — deliberately excluded adjacent work, refactors, nice-to-haves, or future-work items.

Items may appear in two buckets only when the inclusion/exclusion distinction matters; mark that as an inference so the reasoning is explicit.

Do not paste this draft verbatim into chat. Compose it as the thinking surface, then compress it into stage 2.

## Stage 2: Chat-Time Scoping Synthesis

The user-facing synthesis should read like two product collaborators confirming scope before writing a PRD: "we are doing X, chose Y trade-off, deferred Z, and W is the one place you might redirect." It is not a requirements-doc preview.

Render up to four sections. Empty conditional sections are omitted, not padded.

1. **What we're building** (always present) — 1-3 forward-looking sentences describing the shape that will go into the doc.
2. **Key trade-offs** (conditional) — 1-3 bullets when real choices were made or would surprise the user if unsurfaced.
3. **What's not in scope** (conditional) — 1-3 bullets, or one sentence, when deferred items would surprise a downstream reader.
4. **Call outs** (conditional) — 0-3 bullets for residual scope forks, silent inferences, or consequences of combining user answers.

Call outs are not missed interview questions. If a call out reads like "we should have asked this earlier," pause and resolve the question before presenting the synthesis.

## Path A / Path B Gate

Phase 2.5 chooses between two presentation paths using two signals: whether any blocking question fired before Phase 2.5, and the Phase 0.3 tier.

- **Path A — no blocking questions fired and tier is Lightweight.** Use announce-mode. Emit only "What we're building" prose, no conditional sections and no confirmation question. Follow the local `SKILL.md` announce-mode rule: end the turn after the synthesis and do not write the requirements doc in the same turn.
- **Path B — any blocking question fired, or tier is Standard / Deep-feature / Deep-product.** Present the full tier-aware scoping synthesis and ask for open-ended confirmation. Path B fires even when zero call outs survive; substantive scope earns a real checkpoint.

Do not collapse this back to "no questions fired means auto-continue." A richly preloaded Standard or Deep prompt can need no dialogue but still deserve a full synthesis.

## Keep Tests

Each conditional section has its own keep test:

- **Trade-offs:** would the user be surprised if this choice was not acknowledged?
- **Deferred items:** would a reasonable downstream reader ask why the item is absent?
- **Call outs:** would the user need to read code to evaluate it? If yes, cut it. If no, keep only real scope forks, non-obvious inclusions/exclusions, cheap-now-expensive-later corrections, or non-obvious consequences of multi-turn answers.

Cut mechanical items, implementation choices for planning, transcript-style Q&A restatements, restatements of the already selected approach, and anything already implied by "What we're building."

Typical total bullet budgets across Key trade-offs + What's not in scope + Call outs:

| Tier | Typical total | Hard ceiling |
|---|---:|---:|
| Lightweight | 0-1 | 2 |
| Standard | 2-4 | 5 |
| Deep-feature | 3-5 | 7 |
| Deep-product | 4-7 | 9 |

If the hard ceiling is exceeded, re-cut at a higher level of abstraction instead of raising the cap.

## Granularity

Every user-facing bullet must pass both tests:

- **Affirmability test:** the user can affirm or redirect without reading code.
- **Detail test:** one line ideally, two lines maximum; conversational rather than documentary.

Do not include:

- implementation paths, file names, method names, or class names
- exact JSON, schema, API, or response shapes
- HTTP status codes or wire formats
- exact UI labels, CLI output strings, or error messages
- SQL syntax, query bodies, or column-level details

When a bullet starts naming those details, move it to the future plan body or omit it from the synthesis.

## Output Shapes

Use Path B shape when confirmation is required:

```text
Based on our dialogue, here's the scope I'm proposing for the requirements doc:

**What we're building:** [1-3 forward-looking sentences in plain language.]

**Key trade-offs:** [render only when real trade-offs exist]
- [choice + brief why]

**What's not in scope:** [render only when deferred items matter]
- [deferred item]

**Call outs:** [render only when one or more survived the keep test]
- [scope fork or non-obvious consequence the user can affirm or redirect]

Confirm and I'll write the requirements doc next, drawing on our dialogue and this synthesis. Or tell me what to change.
```

Use Path A announce-mode shape only for Lightweight with no blocking questions:

```text
Proposing: [1-3 line shape — what the doc will say in plain words].

No open scope decisions to weigh in on. I'll wait for your next message before writing the requirements doc.
```

Use prose for the user's response, not a multiple-choice menu. Option sets bias correction by signaling which dimensions matter.

## Revision Loop

A revision is not a confirmation. After any user revision, integrate the change and re-present the revised scoping synthesis. Write the requirements doc only after explicit confirmation or after the soft-cut proceed option below.

Track revised items by decision dimension, not by surface wording or section. If the same item is revised twice, or a third-round revision targets an item already revised in round two, use the platform's blocking question tool with two options:

- `Proceed and write the requirements doc`
- `Hold off — keep discussing before the doc`

Fall back to a numbered list only when no blocking question tool is available.

## Headless Mode

In pipeline or `disable-model-invocation` contexts:

- Compose the internal three-bucket draft.
- Do not prompt for confirmation and do not emit stage 2.
- Route content into the doc with audit visibility:
  - **Stated** -> `## Requirements` and relevant narrative context
  - **Inferred** -> `## Assumptions`, explicitly labeled as unvalidated agent bets
  - **Out of scope** -> `## Scope Boundaries`

Do not route unconfirmed inferences into Key Decisions or Requirements. That would make agent assumptions indistinguishable from user-confirmed scope.

## Self-Redirect

If the user indicates they want a different workflow, stop the brainstorm and offer the relevant current-host entrypoint. Examples include switching to planning, debugging, or work execution. Do not argue with the redirect; the synthesis did its job by surfacing that the workflow choice was wrong.

## Doc Shape After Confirmation

After confirmation, Phase 3 writes the requirements doc:

| Synthesis element | Requirements doc destination |
|---|---|
| "What we're building" prose | `## Summary` |
| Stated draft content | `## Requirements` and relevant `## Problem Frame` context |
| Inferred draft content | `## Key Decisions` in interactive mode; `## Assumptions` in headless mode |
| Out-of-scope draft content | `## Scope Boundaries` |
| Key trade-offs | `## Key Decisions` |

The doc's `## Summary` and `## Problem Frame` must remain distinct. Summary states what the doc proposes; Problem Frame explains why the proposal exists.
