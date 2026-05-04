# Synthesis Summary

**Synthesis is not the plan doc.** The synthesis is the scope and decision checkpoint that plan-write consumes. The plan body expands confirmed decisions into directional implementation units, file paths, test scenarios, and risk treatment, but the synthesis itself stays at decision level. Do not include implementation code, exact method signatures, framework syntax, JSON shapes, exact error wording, or line-level call flow.

**Three-bucket structure is a chat-time artifact only.** It helps the user correct the agent's interpretation, then dissolves into the plan body. The plan does not get a parallel `## Synthesis` section. Only the prose summary embeds as `## Summary`.

There are two variants:

- **Solo variant (Phase 0.7)** — fires after the brief planning bootstrap and before Phase 1 research. It catches wrong scope before research or sub-agent work is spent.
- **Brainstorm-sourced variant (Phase 5.1.5)** — fires after research and before plan-write. It surfaces plan-time decisions for HOW the already-validated WHAT will be implemented.

In headless mode both variants compose the synthesis but skip user confirmation. Inferred bets route to `## Assumptions` in the plan.

---

## Shared Structure

Every synthesis uses three labeled buckets:

- **Stated** — user-stated constraints, dialogue answers, upstream brainstorm content, or concrete research findings.
- **Inferred** — agent bets made to fill gaps, such as scope boundaries, test scope, module ownership, or pattern-selection assumptions.
- **Out of scope** — deliberate exclusions, follow-up work, adjacent refactors, or untested surfaces intentionally left alone.

Start with a 1-3 line prose summary. It is forward-looking and describes what the plan will target, not what has already been discussed.

## Solo Variant

Fires only when:

- no upstream brainstorm requirements doc was found
- the Phase 0.4 bootstrap stayed in `spec-plan`
- there are no unresolved planning blockers
- the run is not a resume-normal or deepen-intent fast path

Content focus: full-breadth scope. Since Phase 0.4 is intentionally brief, the Inferred bucket is load-bearing and should expose the agent's bets.

Use this shape:

```text
Based on your request and our brief planning bootstrap, here's the scope I'm proposing to plan against:

[1-3 line prose summary — what scope the plan will target.]

**Stated** (from your input and our dialogue):
- [item]

**Inferred** (gaps I filled with assumptions — flag anything I got wrong):
- [problem frame inference]
- [success criteria inference]
- [scope boundary inference]

**Out of scope** (deliberately excluded):
- [adjacent work]

Does this match your intent? Tell me what to add, remove, redirect, or that I got wrong — or just confirm to proceed.
```

## Brainstorm-Sourced Variant

Fires only when the plan was sourced from an upstream brainstorm requirements doc and not on a resume/deepen fast path.

Content focus: plan-time decisions only. The brainstorm validated WHAT to build; this synthesis surfaces HOW the plan will execute that work:

- files or modules to touch, and intentionally not touch
- existing patterns extended versus new patterns introduced
- test scope and adjacent untested surfaces left out
- refactor scope routed to current work versus follow-up
- cross-cutting impact such as auth, migrations, shared types, runtime delivery, or docs

Use this shape:

```text
Based on the upstream brainstorm and Phase 1 research, here's the implementation scope I'm proposing for the plan:

[1-3 line prose summary — how the implementation approaches the work.]

**Stated** (from the brainstorm and research findings):
- [files/modules or patterns directly grounded in source material]

**Inferred** (plan-time decisions filling gaps the brainstorm did not resolve):
- [pattern extension vs. new abstraction choice]
- [test scope addition]

**Out of scope** (deliberately excluded):
- [tangential refactor]

Does this match your intent for HOW to implement? Tell me what to add, remove, or redirect — or just confirm to proceed.
```

## Granularity

Each Inferred bullet should be affirmable or rejectable without reading code. The line differs by variant:

- **Solo** stays higher-level because product WHAT has not been validated.
- **Brainstorm-sourced** may name files, modules, or patterns when those are the actual plan-time decisions, but still avoids implementation flow specifics.

Allowed when they are the decision: module names, pattern names, source of truth, test scope, and approach posture.

Not allowed: line numbers, exact method signatures, exact call flow, exact JSON/response shapes, HTTP status codes, event names, error text, SQL, or copy-paste-ready code.

## Revision Loop

A revision is not a confirmation. After any user revision, integrate it and re-present the revised synthesis. Plan-write fires only on explicit confirmation or after a soft-cut proceed decision.

If the same item is revised twice, use the platform's blocking question tool with:

- `Proceed with the current revised synthesis`
- `Stop and redirect — discuss further before research / plan-write`

Fall back to a numbered list only when no blocking question tool is available.

## Headless Mode

In pipeline or `disable-model-invocation` contexts:

- Compose the synthesis but do not prompt.
- Continue to the next phase for solo mode, or proceed to plan-write for brainstorm-sourced mode.
- Route content into the plan with audit visibility:
  - **Stated** → `## Requirements` and relevant narrative context
  - **Inferred** → `## Assumptions`
  - **Out of scope** → `## Scope Boundaries`

Do not route unconfirmed inferences into Key Technical Decisions or Implementation Units.

## Doc Shape After Confirmation

| Chat-time element | Plan destination |
|---|---|
| Prose summary | `## Summary` |
| Stated bullets | `## Requirements` and relevant `## Problem Frame` context |
| Inferred bullets | `## Key Technical Decisions` and Implementation Units in interactive mode; `## Assumptions` in headless mode |
| Out-of-scope bullets | `## Scope Boundaries`, including `### Deferred to Follow-Up Work` when relevant |

`## Summary` and `## Problem Frame` serve different roles. Summary answers what this plan proposes; Problem Frame explains why the work exists.
