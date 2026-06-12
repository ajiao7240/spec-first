# Scoping Synthesis

**Scoping synthesis is not the plan doc.** The synthesis is the scope and decision checkpoint that plan-write consumes. It surfaces decisions the agent can make before plan-write: scope coverage, posture, test approach, refactor boundary, and other affirm-or-redirect choices. It does not surface plan-write outputs such as PR count, branch sequencing, effort estimates, Implementation Units, exact file paths, or test command recipes.

**Two-stage shape: internal draft, then chat-time synthesis.** First compose an internal three-bucket draft (Stated / Inferred / Out of scope) so scope reasoning is complete. Then compress it into the user-facing stage 2: a tier-shaped summary plus zero or more Call outs. The user sees stage 2, not the full internal draft.

**Three-bucket structure is internal.** It does its scope-thinking job during stage 1 and dissolves when Phase 5.2 writes the plan. The plan does not get a parallel `## Synthesis` section. Only the stage-2 summary embeds as `## Summary`.

**Decision Brief is a reading aid, not a routing destination.** When a Standard or Deep plan includes `## Decision Brief`, keep it immediately after `## Summary`. It may summarize the recommended approach, load-bearing decisions, validation focus, and largest risks for a first human pass, but synthesis content still routes to the destinations below. Do not dump the internal draft or Call outs into the brief, and do not let the brief duplicate or replace `## Summary`, `## Key Technical Decisions`, `## Scope Boundaries`, Direct Evidence, or Implementation Units.

There are two variants:

- **Solo variant (Phase 0.7)** — fires after the brief planning bootstrap and before Phase 1 research. It catches wrong scope before research or sub-agent work is spent.
- **Brainstorm-sourced variant (Phase 5.1.5)** — fires after research and before plan-write. It surfaces plan-time decisions for HOW the already-validated WHAT will be implemented.

In headless mode both variants compose the internal draft but skip user confirmation and stage 2. Inferred bets route to `## Assumptions` in the plan.

---

## Stage 1: Internal Three-Bucket Draft

Use three labeled buckets internally:

- **Stated** — user-stated constraints, dialogue answers, upstream brainstorm content, or concrete research findings.
- **Inferred** — agent bets made to fill gaps, such as scope boundaries, test scope, module ownership, or pattern-selection assumptions.
- **Out of scope** — deliberate exclusions, follow-up work, adjacent refactors, or untested surfaces intentionally left alone.

Do not paste this draft verbatim into chat. Compose it as the thinking surface, then derive stage 2.

## Stage 2: Chat-Time Scoping Synthesis

Stage 2 is what the user sees. It differs by variant:

- **Solo:** a scope claim plus Call outs.
- **Brainstorm-sourced:** a short brainstorm-scope orientation, plan-specific scoping decisions, and Call outs.

No user-facing **Stated** or **Out of scope** bucket appears in chat. Non-obvious exclusions become Call outs only when they survive the keep test.

## Solo Variant

Fires only when:

- no upstream brainstorm requirements doc was found
- the Phase 0.4 bootstrap stayed in `spec-plan`
- there are no unresolved planning blockers
- the run is not a resume-normal or deepen-intent fast path

Content focus: full-breadth scope. Since Phase 0.4 is intentionally brief, the Inferred bucket is load-bearing and should expose the agent's bets internally. Stage 2 should surface only the forks the user can redirect.

Use this shape when confirmation is required:

```text
Based on your request and our brief planning bootstrap, here's the scope I'm proposing to plan against:

[scope claim — what the plan will target, what it will not; affirm-or-redirect level; not an Implementation Units list]

**Call outs:** [omit when zero forks survived the keep test]
- [decision-level fork in 1-2 lines]

Confirm and I'll proceed to research, drawing on this scope. You can also redirect to the current host's brainstorm entrypoint if this is bigger than it first looked.
```

## Brainstorm-Sourced Variant

Fires only when the plan was sourced from an upstream brainstorm requirements doc and not on a resume/deepen fast path.

Content focus: plan-time decisions only. The brainstorm validated WHAT to build; this synthesis surfaces HOW the plan will execute that work:

- files or modules to touch, and intentionally not touch
- existing patterns extended versus new patterns introduced
- test scope and adjacent untested surfaces left out
- refactor scope routed to current work versus follow-up
- cross-cutting impact such as auth, migrations, shared types, runtime delivery, or docs

Most of these should not survive as separate Call outs. Surface only real forks where another reasonable agent might choose differently and the user can correct cheaply now.

Use this shape when confirmation is required:

```text
The brainstorm scopes [1-2 sentence restatement of the brainstorm's scope as orientation, in its own vocabulary].

This plan [plan-specific scoping: what is covered, deferred, expanded, or tested relative to the brainstorm].

**Call outs:** [omit when zero forks survived the keep test]
- [plan-time fork in 1-2 lines]

Confirm and I'll write the plan next, drawing on the brainstorm, research, and this synthesis.
```

## When To Auto-Proceed

Auto-proceed is allowed only when plan depth is Lightweight and zero Call outs survive the keep test. It still emits a short announcement; silent proceeding is not allowed.

Solo:

```text
Planning: [1-3 line scope claim]

No open decisions to weigh in on — proceeding to research. Interrupt if I have the scope wrong.
```

Brainstorm-sourced:

```text
Planning [brief brainstorm-scope restatement] — [plan-specific shape in one clause].

No open decisions to weigh in on — proceeding to plan-write. Interrupt if I have the scope wrong.
```

For Standard or Deep plans, always fire the confirmation gate even when zero Call outs survive. Substance earns the checkpoint, not interaction history.

## Keep And Detail Tests

Each Call out must pass the **affirmability test**: the user can affirm or redirect without reading code.

Keep only:

- real forks where another reasonable agent might choose differently
- non-obvious behavioral or scope choices
- non-obvious exclusions the user might want to add back
- cheap-now-expensive-later corrections

Cut:

- mechanical items with no real alternative
- implementation choices that belong to plan-write or work execution
- items already implied by the summary
- numerical attestations such as "all nine requirements covered"

Every surviving summary bullet or Call out must also pass the **detail test**: one or two conversational lines, not a documentary paragraph. If a Call out runs long, re-cut at a higher level of abstraction.

Typical Call out budgets:

| Plan depth | Typical | Cap |
|---|---:|---:|
| Lightweight | 0-2 | 3 |
| Standard | 1-3 | 4 |
| Deep | 2-5 | 6 |

Do not raise the cap. Collapse related sub-decisions into the larger decision the user can actually weigh in on.

## Granularity

Name the decision; do not expand it into plan body. The line differs by variant:

- **Solo** stays higher-level because product WHAT has not been validated.
- **Brainstorm-sourced** may name files, modules, patterns, source of truth, test scope, or approach posture when those are the plan-time decisions.

Not allowed in either variant:

- Implementation Units, PR count, branch sequencing, effort estimates, or test command recipes
- line numbers, exact method signatures, exact call flow, or copy-paste-ready code
- exact JSON or response shapes
- HTTP status codes, event names, or error text
- SQL syntax or query bodies
- bare origin IDs such as `R1`, `AE2`, `F3`, or `U4` without plain names

## Revision Loop

A revision is not a confirmation. After any user revision, integrate it and re-present the revised stage 2. Plan-write fires only on explicit confirmation or after a soft-cut proceed decision.

Track revised Call outs by decision dimension, not by surface wording. If the same decision is revised twice, use the platform's blocking question tool with:

- `Proceed and continue to research / plan-write`
- `Hold off — keep discussing before continuing`

Fall back to a numbered list only when no blocking question tool is available.

## Headless Mode

In pipeline or `disable-model-invocation` contexts:

- Compose the internal draft.
- Do not prompt, emit stage 2, or auto-proceed announce.
- Continue to the next phase for solo mode, or proceed to plan-write for brainstorm-sourced mode.
- Route content into the plan with audit visibility:
  - **Stated** -> `## Requirements` and relevant narrative context
  - **Inferred** -> `## Assumptions`
  - **Out of scope** -> `## Scope Boundaries`

Do not route unconfirmed inferences into Key Technical Decisions or Implementation Units.

## Self-Redirect

If the user response indicates they are in the wrong workflow, stop planning and suggest the relevant current-host entrypoint. Common redirects include current host's brainstorm entrypoint for unclear WHAT, debug for investigation, or work for a small ready-to-execute fix.

## Doc Shape After Confirmation

After user confirmation or soft-cut proceed, Phase 5.2 writes the plan:

| Synthesis element | Plan destination |
|---|---|
| Stage-2 summary | `## Summary` |
| First-pass decision/risk/validation orientation, when material | `## Decision Brief` as a short summary that points to detailed destinations; not a second synthesis section |
| Stated draft content | `## Requirements` and relevant `## Problem Frame` context |
| Inferred draft content | `## Key Technical Decisions` and Implementation Units in interactive mode; `## Assumptions` in headless mode |
| Out-of-scope draft content | `## Scope Boundaries`, including `### Deferred to Follow-Up Work` when relevant |

`## Summary` and `## Problem Frame` serve different roles. Summary answers what this plan proposes; Problem Frame explains why the work exists.
