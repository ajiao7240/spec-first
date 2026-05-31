# Domain Language And Decision Ledger

Load this reference when terminology, product-domain boundaries, or source/user contradictions affect the PRD.

## Source-First Questioning

Before asking the owner about terminology or current behavior, inspect context that can answer cheaply:

- already-loaded host/project instructions
- `docs/contracts/`, existing brainstorms/plans/solutions, and project docs
- the project domain glossary at `docs/contracts/domain-glossary.md` when it exists — read it first so canonical terms already established by prior PRDs are reused, not reinvented
- repo-local glossary or ADR-like artifacts that actually exist
- source, tests, templates, and product-facing strings in the affected area

Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory. The project domain glossary is optional and opt-in: if `docs/contracts/domain-glossary.md` does not exist, record that as advisory context and continue with available evidence — do not create it for a single small increment.

## Canonical Term Handling

When the same concept has multiple names:

- propose a `canonical term`
- list `avoid terms` or aliases that could confuse planning
- attach a source tag: `confirmed`, `advisory`, `session-local`, `stale`, or `user`
- write the decision into PRD `Glossary`, `Evidence And Assumptions`, `Decision Notes`, or `Outstanding Questions`

Two discipline rules keep glossary entries useful and prevent them from decaying into a spec:

- **Only capture domain-specific terms.** Before recording a term, ask: is this a concept unique to this product/domain, or a general engineering concept? Only the former belongs. General concepts (timeout, retry, error type, cache, pagination) stay out even when the system uses them heavily — capturing them dilutes the glossary and adds maintenance with no disambiguation value.
- **Define what a term IS, not what it DOES.** A glossary definition states the concept's identity in one or two tight sentences, not its behavior, workflow, or implementation. This is `WHAT not HOW` (Core Principle 2) at term granularity. "An Invoice is a request for payment issued after delivery" belongs; "the Invoice service retries failed charges three times" does not.

Do not create a permanent glossary or ADR by default.

## Cross-PRD Glossary Promotion

A term lives in a single PRD's `## Glossary` by default (session-local, draft layer). Promote it to the project-level canonical glossary at `docs/contracts/domain-glossary.md` only when both hold:

- the same domain-specific concept has been sharpened across **two or more PRDs**, and
- it passes the two discipline rules above (domain-specific, defined as IS not DOES).

Promotion is **preview-first**: propose the canonical entry to the owner, and write it to `docs/contracts/domain-glossary.md` only after confirmation. Never silent-write. Follow the field contract and entry format defined in that file. A single small increment never needs promotion — keep its terms in the PRD only.

When a new PRD's term conflicts with an existing canonical entry, surface it immediately as a contradiction (see `current-state-analysis.md` Contradiction Handling) rather than letting the language drift.

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
