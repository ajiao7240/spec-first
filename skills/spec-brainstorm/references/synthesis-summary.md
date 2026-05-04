# Synthesis Summary

**Synthesis is not the requirements doc.** The synthesis is a scope checkpoint that Phase 3 consumes as input. The requirements doc is written only after the synthesis is confirmed, or after headless routing records unconfirmed inferences as assumptions. Both artifacts stay scope-only: implementation details such as file paths, schemas, exact error wording, and method names belong in planning.

**Three-bucket structure is a chat-time artifact only.** It helps the user correct scope in dialogue, then dissolves into the document body. The requirements doc does not get a parallel `## Synthesis` section. Only the prose summary embeds as `## Summary`.

This reference is loaded when Phase 2.5 fires, after approaches are selected and before requirements capture. It gives the user a final chance to correct the agent's interpretation before a durable artifact lands. It fires for all software tiers, including Lightweight. Skip it only for the non-software universal brainstorming route.

---

## Three-Bucket Structure

Every synthesis uses three labeled buckets:

- **Stated** — what the user said directly in the original prompt, prior conversation, dialogue answers, or approach selection.
- **Inferred** — assumptions the agent made to fill gaps: scope boundaries, success criteria, actor priorities, or other bets the user has not explicitly confirmed.
- **Out of scope** — deliberately excluded adjacent work, refactors, nice-to-haves, or future-work items.

Items may appear in two buckets only when the inclusion/exclusion distinction matters; mark that as an inference so the user can correct the bet.

## Output Shape

Lightweight work gets one short prose summary plus brief lists. Standard, Deep-feature, and Deep-product work get a few paragraphs with explicit lists per bucket.

Start with a 1-3 line prose summary in plain language describing what the requirements doc will propose. The summary is forward-looking, not a recap of the dialogue. It exists so the user can reject the overall framing before reading bullets.

Use this shape, adjusted to the context:

```text
Based on our dialogue and approach selection, here's the scope I'm proposing for the requirements doc:

[1-3 line prose summary — what is being proposed in plain language.]

**Stated** (from your input and our dialogue):
- [item]

**Inferred** (gaps I filled with assumptions — flag anything I got wrong):
- [item]

**Out of scope** (deliberately excluded):
- [item]

Does this match your intent? Tell me what to add, remove, redirect, or that I got wrong — or just confirm to proceed.
```

Use prose for the user's response, not a multiple-choice menu. Option sets bias correction by signaling which dimensions matter.

## Granularity

Each bullet must be affirmable or rejectable without reading code. Name the scope decision, not the implementation.

Do not include:

- implementation paths, file names, method names, or class names
- exact JSON, schema, API, or response shapes
- HTTP status codes or wire formats
- exact UI labels, CLI output strings, or error messages
- SQL syntax, query bodies, or column-level details

When a bullet starts to name those details, move it to the future plan body or omit it from the synthesis.

## Revision Loop

A revision is not a confirmation. After any user revision, integrate the change and re-present the revised synthesis. Write the requirements doc only after explicit confirmation or after the soft-cut proceed option below.

If the same item is revised twice, or a third-round revision targets an item already revised in round two, use the platform's blocking question tool with two options:

- `Proceed with the current revised synthesis`
- `Stop and redirect — discuss further before writing the doc`

Fall back to a numbered list only when no blocking question tool is available.

## Headless Mode

In pipeline or `disable-model-invocation` contexts:

- Compose the synthesis as usual.
- Do not ask for confirmation.
- Route content into the doc with audit visibility:
  - **Stated** → `## Requirements` and relevant narrative context
  - **Inferred** → `## Assumptions`, explicitly labeled as unvalidated agent bets
  - **Out of scope** → `## Scope Boundaries`

Do not route unconfirmed inferences into Key Decisions or Requirements. That would make agent assumptions indistinguishable from user-confirmed scope.

## Self-Redirect

If the user indicates they want a different workflow, stop the brainstorm and offer the relevant current-host entrypoint. Examples include switching to planning, debugging, or work execution. Do not argue with the redirect; the synthesis did its job by surfacing that the workflow choice was wrong.

## Doc Shape After Confirmation

After confirmation, Phase 3 writes the requirements doc:

| Chat-time element | Requirements doc destination |
|---|---|
| Prose summary | `## Summary` |
| Stated bullets | `## Requirements` and relevant `## Problem Frame` context |
| Inferred bullets | `## Key Decisions` in interactive mode; `## Assumptions` in headless mode |
| Out-of-scope bullets | `## Scope Boundaries` |

The doc's `## Summary` and `## Problem Frame` must remain distinct. Summary states what the doc proposes; Problem Frame explains why the proposal exists.
