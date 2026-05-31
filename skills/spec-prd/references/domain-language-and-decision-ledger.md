# Domain Language And Decision Ledger

Load this reference when terminology, product-domain boundaries, or source/user contradictions affect the PRD.

## Source-First Questioning

Before asking the owner about terminology or current behavior, inspect context that can answer cheaply:

- already-loaded host/project instructions
- `docs/contracts/`, existing brainstorms/plans/solutions, and project docs
- repo-local glossary or ADR-like artifacts that actually exist
- source, tests, templates, and product-facing strings in the affected area

Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory. If no such artifact exists, record that as advisory context and continue with available evidence.

## Canonical Term Handling

When the same concept has multiple names:

- propose a `canonical term`
- list `avoid terms` or aliases that could confuse planning
- attach a source tag: `confirmed`, `advisory`, `session-local`, `stale`, or `user`
- write the decision into PRD `Glossary`, `Evidence And Assumptions`, `Decision Notes`, or `Outstanding Questions`

Do not create a permanent glossary or ADR by default.

## Bounded Scenario Grill

Use 1-3 concrete scenarios to stress-test domain boundaries only when the PRD would otherwise be ambiguous. Examples:

- a normal happy path
- a permission/role boundary
- an exception or contradiction that changes acceptance

Keep the grill bounded. It is a source-backed precision tool, not a coaching script or a long interview.

## Decision Notes

Use a lightweight note for material decisions:

```text
question:
recommended_answer:
source_tag:
chosen_answer:
consequence:
deferred_reason:
```

Suggest a future ADR-like artifact only when all three conditions hold:

- hard to reverse
- surprising without context
- reflects a real tradeoff

Otherwise, keep the decision local to the PRD.
