# Spec ID Traceability Contract

`spec_id` is a lightweight artifact identity field for the same spec chain across requirements, plans, and derived task packs.

It improves LLM decision input by making related artifacts easy to join without asking the model to infer identity from filenames or prose. It is not a workflow state, approval marker, progress database, freshness check, or central registry key.

It is part of the Execution Harness described in `docs/contracts/ai-coding-harness.md`: it carries identity across Spec -> Plan -> Tasks -> Code without becoming workflow state.

## Field Responsibilities

| Field | Owner | Responsibility |
| --- | --- | --- |
| `spec_id` | requirements / plan / task pack frontmatter | Identifies the artifact chain |
| `origin` | plan frontmatter | Points to the upstream requirements document or source input |
| `source_plan` | task pack frontmatter | Points to the single source plan |
| `source_plan_hash` | task pack frontmatter | Proves task-pack freshness against task-relevant plan sections |
| R/A/F/AE IDs | requirements and plan trace | Preserve product intent and acceptance examples |
| U-IDs | plan and work trace | Preserve plan-local implementation-unit identity |
| `task_id` | task pack | Identifies a derived execution slice |

## Generation Rules

- New requirements documents use `docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md`.
- Their `spec_id` is `YYYY-MM-DD-NNN-<slug>`.
- `NNN` is chosen by scanning same-day sequenced requirements files; legacy non-sequenced requirements do not consume a sequence number.
- Plans inherit `spec_id` from origin requirements when present.
- Direct-entry plans without an origin generate a plan-local `spec_id` from the plan filename sequence and slug.
- Task packs copy `spec_id` from the source plan and pair it with `source_plan_hash`.

Before minting a new `spec_id`, workflows should scan `docs/brainstorms/`, `docs/plans/`, and `docs/tasks/` frontmatter. If the same `spec_id` already exists and `origin` / `source_plan` links do not prove the same chain, choose the next local sequence value or ask the user to confirm. This is a local deterministic check, not a central registry.

## Legacy Behavior

Legacy requirements without `spec_id` do not block planning. A new plan may generate a plan-local `spec_id`, but the plan should say that origin identity was not inherited and trace confidence is weaker.

Legacy plans without `spec_id` are not valid sources for executable task packs. `spec-write-tasks` should return to `spec-plan` to add plan frontmatter, or produce only a draft/transient task pack that is not valid `spec-work` input.

## Chain Boundaries

Keep the same `spec_id` for:

- ordinary plan edits,
- plan deepening,
- task pack regeneration from the same source plan,
- work/review handoffs for the same source plan.

Create or explicitly consider a new spec chain for:

- alternative implementation plans from the same requirements,
- independent delivery chains,
- abandon-and-replace work,
- mutually exclusive exploration branches.

The LLM decides whether those cases inherit or create a new chain and records the reason in the plan. Scripts may check format, path existence, and obvious collisions; they should not decide semantic equivalence.

## Source Contracts

The normative workflow contracts live in:

- `skills/spec-brainstorm/references/requirements-capture.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-write-tasks/SKILL.md`
- `skills/spec-write-tasks/references/task-pack-schema.md`
- `skills/spec-work/SKILL.md`

This document is a map of the contract, not a second source of truth.
