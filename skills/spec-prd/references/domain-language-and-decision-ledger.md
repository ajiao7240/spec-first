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

> `spec-prd/SKILL.md` Phase 2 也把这套机制称为 run-local Domain Grill Gate,readiness lens 用 `domain-grill coverage` 指代同一覆盖检查。三者是同一流程,不是独立概念。本文件是 trigger / cadence / question format / no-artifact 规则的权威定义;SKILL.md 只做摘要引用。

Use 1-3 concrete scenarios to stress-test domain boundaries only when the PRD would otherwise be ambiguous. Examples:

- a normal happy path
- a permission/role boundary
- an exception or contradiction that changes acceptance

Keep the grill bounded. It is a source-backed precision tool, not a coaching script or a long interview.

Trigger only when one of these is true:

- a domain term has multiple plausible meanings and the wrong choice would change requirements or acceptance
- user-stated current behavior conflicts with source, docs, tests, or contracts
- a source-of-truth, ownership, or artifact authority decision affects downstream planning
- a concrete scenario reveals ambiguity in actor, permission, state transition, exception handling, or negative acceptance
- a hard-to-reverse product or architecture boundary is being decided and would be surprising without context

Do not trigger when:

- the question is an implementation detail that `spec-plan` owns
- the fact is cheap to confirm from source, docs, tests, glossary, or ADR-like artifacts
- the term is a general engineering concept rather than a project/domain concept
- the decision is easy to reverse, obvious, or not the result of a real tradeoff
- the PRD can safely carry a labeled, non-load-bearing assumption

Question cadence:

- Ask at most one question at a time.
- Ask no more than 1-3 grill questions in a normal PRD run.
- If more than 3 load-bearing questions appear necessary, record blockers, route to PRD refine/doc-review, or ask the owner to choose assumptions instead of continuing a long interview.
- Always give a `recommended_answer` unless there is no defensible default.
- If the owner says "you decide", use the recommended answer only when evidence supports it or it is safely labeled as an assumption.

Run-local question format:

```text
question:
recommended_answer:
why_recommended:
source_tag:
consequence_if_chosen:
consequence_if_not_chosen:
write_target: Glossary | Decision Notes | Evidence And Assumptions | Outstanding Questions
```

This format is for asking the owner, not a third persistent field set. Persist the result into existing PRD-local sections. If it lands in `Decision Notes`, map it back to the existing fields: `question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`. Fold `why_recommended`, `consequence_if_chosen`, and `consequence_if_not_chosen` into `consequence` prose when useful. If it lands in `Glossary`, `Evidence And Assumptions`, or `Outstanding Questions`, compress it into that section's existing fields and do not add new fields. Do not create `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` by default.

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
