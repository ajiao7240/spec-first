# spec-plan Governance Header Slimming Verification(2026-06-11)

Plan: `docs/plans/2026-06-11-004-refactor-spec-plan-skill-slimming-plan.md`
Implementation status: U1-U6 complete, extract-only/no-remove.

## Summary

`spec-plan` now keeps the three consumer-owned governance sections inline and moves the seven no-consumer governance sections into the runtime-copied reference `skills/spec-plan/references/governance-boundaries.md`. The spine keeps one mandatory `STOP` pointer before broad context gathering. No governance meaning was deleted.

## Before / After Metrics

| Metric | Before | After | Evidence |
|---|---:|---:|---|
| `skills/spec-plan/SKILL.md` lines | 775 | 739 | `wc` before plan evidence; current `wc -l` |
| `skills/spec-plan/SKILL.md` bytes | 70.7KB | 64,228 | current `wc -c` |
| Governance header lines | 85 | 49 | block from `## Plan-Only Safety Contract` to `## Interaction Method` |
| Governance header bytes | 10.6KB | 4,123 | current byte count |
| Runtime-copied governance reference | 0 | 1 | `skills/spec-plan/references/governance-boundaries.md` |
| Runtime-copied reference lines / bytes | 0 | 41 / 7,118 | current `wc -l -c` |
| Consumer-owned sections | 3 | 3 | `Plan-Only Safety Contract`, `Workflow Contract Summary`, `Scenario Capability` remain inline |
| No-consumer sections inline in `spec-plan` | 7 | 0 | seven headings moved to reference |
| Confirmed remove sections | 0 | 0 | R5 deletion gate not met |

Cross-node duplicate headings remaining after this spec-plan-only pilot:

| Heading | Remaining `SKILL.md` count | Remaining skills |
|---|---:|---|
| Context Orientation Anchor | 3/37 | `spec-code-review`, `spec-debug`, `spec-work` |
| Domain Language And Decision Ledger | 5/37 | `spec-brainstorm`, `spec-code-review`, `spec-debug`, `spec-doc-review`, `spec-work` |
| Runtime Context Exclusion | 6/37 | `spec-code-review`, `spec-compound`, `spec-debug`, `spec-doc-review`, `spec-optimize`, `spec-work` |
| Cache-Friendly Context Layout | 2/37 | `spec-code-review`, `spec-work` |
| Summary-First Handoff | 3/37 | `spec-code-review`, `spec-compound`, `spec-work` |
| Recall Trust Boundary | 2/37 | `spec-debug`, `spec-work` |
| Capability-Class Evidence Boundary | 2/37 | `spec-code-review`, `spec-debug` |

This is expected: the plan explicitly scoped cross-node rollout as follow-up.

## Projection Evidence

`node bin/spec-first.js init -y` was run after source edits. It detected managed runtime drift and regenerated Claude/Codex runtime assets from the current working tree source.

Confirmed runtime paths:

- `.claude/spec-first/workflows/spec-plan/references/governance-boundaries.md`
- `.agents/skills/spec-plan/references/governance-boundaries.md`

Confirmed runtime pointers:

- `.claude/spec-first/workflows/spec-plan/SKILL.md` points to `.claude/spec-first/workflows/spec-plan/references/governance-boundaries.md`
- `.agents/skills/spec-plan/SKILL.md` points to `.agents/skills/spec-plan/references/governance-boundaries.md`
- `.claude/commands/spec/plan.md` points to `.claude/spec-first/workflows/spec-plan/references/governance-boundaries.md`

Generated runtime files are ignored mirrors and were not edited as source.

## Fresh-Source Eval

### Spine-Only Scannability

Status: passed.

Fresh no-tool reviewer evaluated current `skills/spec-plan/SKILL.md` snippets only. Verdict: the spine still makes these mandatory behaviors discoverable without reading `governance-boundaries.md`:

- planning-only/no implementation before handoff
- blocking question tool and loud fallback
- governance reference load before broad context gathering
- mandatory doc-review
- mandatory `plan-handoff.md` load and routed action execution
- completion requires routed action executed or explicitly declined

Reviewer limitation: spine-only scanning proves discoverability of mandates, not sufficiency to execute referenced details.

### Spine + Handoff Behavioral Trace

Status: passed.

Fresh no-tool reviewer evaluated `skills/spec-plan/SKILL.md` tail plus `skills/spec-plan/references/plan-handoff.md` excerpts. Behavior trace:

1. plan written
2. confidence-first check passes
3. load `references/plan-handoff.md`
4. execute `5.3.8 -> 5.3.9 -> 5.4`
5. run mandatory `spec-doc-review`
6. present blocking menu
7. act on the selected branch
8. completion only after routed action executes or is explicitly declined

Reviewer concern was low: full issue-creation details were not included in the snippet, but the visible behavioral contract passed.

## Verification Commands

Focused checks run during implementation:

- `npx jest tests/unit/spec-plan-contracts.test.js`
- `npx jest tests/unit/capability-aware-provider-contracts.test.js tests/unit/knowledge-harness-contracts.test.js tests/unit/context-governance-contracts.test.js tests/unit/context-bundle-contracts.test.js`
- `node bin/spec-first.js init -y`

Broader checks are recorded in the final work closeout.

## R6/R10 Gate Evidence

- `Workflow Contract Summary` remains inline with `When To Use`, `When Not To Use`, `Inputs`, `Outputs`, `Failure Modes`, and `Workflow`, preserving `lint-skill-structure.js` consumption.
- `Plan-Only Safety Contract` remains inline and `templates/claude/hooks/spec-plan-guard` continues to own the runtime attention guard.
- `Scenario Capability` remains inline and points to `docs/contracts/workflows/scenario-capability-matrix.md`.
- Handoff, document review, blocking question, and completion checks remain in the spine and are additionally protected by `tests/unit/spec-plan-contracts.test.js`.
