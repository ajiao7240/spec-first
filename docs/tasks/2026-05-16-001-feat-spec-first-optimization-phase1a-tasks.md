---
title: "feat: spec-first optimization Phase 1A task pack"
type: task-pack
status: derived
date: 2026-05-16
spec_id: 2026-05-11-002-spec-first-project-optimization-upgrade
source_plan: docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md
source_plan_hash: sha256:5f7f1cffbb1622cb01a1175658a55e9cdf50fbc4fe35312fc09bbe8230598d02
generated_by: spec-write-tasks
mode: derived
source_sections:
  - "过度设计防线与 Phase 1 MVP"
  - "U2. Task-pack source-plan 聚焦回查"
  - "U11. Cross-cutting closeout checklist"
  - "U12. Token economy guardrails 与 progressive disclosure"
  - "分阶段交付"
---

# feat: spec-first optimization Phase 1A task pack

## Overview

This task pack is the executable Phase 1A handoff for the source plan. It intentionally covers only the plan-approved tracer bullet: U2 task-pack source-plan focused read, `spec-write-tasks` `context_refs` guidance, `spec-work` source-plan focused read, Phase 1A fresh-source eval hard gate, and U11 closeout.

It does not execute Phase 1B/1C/1D and does not claim full U1-U12 completion.

## Source Summary

- Source plan: `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`
- Task-ready branch: `compile`
- Consumed source sections: Phase 1 MVP, U2, U11, U12, and Phase 1 delivery gates.
- Scope boundaries that shaped this split: no whole-plan execution, no Phase 1B durable run evidence producer, no Phase 1C standards next-action artifact, no Phase 1D core summary cleanup, no generated runtime mirror edits.
- Implementation-time unknowns: exact prose/test shape should follow current local contract-test patterns; if a new schema, public workflow, runtime mirror edit, or durable run evidence producer becomes necessary, stop and return to the plan.

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U2 | R3, R4; task-pack source-plan focused read | T001 | Contract tests for `spec-work`, `spec-write-tasks`, and task-pack validation |
| U11 | R17, R26; closeout checklist | T001 | Changelog format test and final closeout evidence |
| U12 | R19, R20; minimal sufficient context and phase task pack | T001 | Contract tests and this task pack validation |
| Phase 1A gate | Fresh-source eval hard gate | T001 | `docs/validation/2026-05-16-phase1a-fresh-source-eval.md` |

## Task Graph

T001 is a single vertical tracer bullet because Phase 1A must prove one closed handoff loop before any later gate begins. It has no dependency on Phase 1B/1C/1D.

## Execution Waves

- Wave 1: T001

## Task Pack Contract

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    {
      "wave": 1,
      "tasks": ["T001"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U2",
      "requirement_refs": ["R3", "R4", "R17", "R19", "R20", "R26"],
      "goal": "Deliver Phase 1A task-pack handoff tracer bullet so spec-work task-pack mode must read source-plan focused sections and spec-write-tasks emits granular context_refs guidance.",
      "dependencies": [],
      "files": [
        "skills/spec-write-tasks/SKILL.md",
        "skills/spec-write-tasks/references/task-pack-schema.md",
        "skills/spec-write-tasks/references/task-quality-guide.md",
        "skills/spec-work/SKILL.md",
        "src/cli/task-pack.js",
        "src/cli/commands/tasks.js",
        "tests/unit/spec-write-tasks-contracts.test.js",
        "tests/unit/spec-work-contracts.test.js",
        "tests/unit/task-pack-command.test.js",
        "docs/validation/2026-05-16-phase1a-fresh-source-eval.md",
        "CHANGELOG.md"
      ],
      "context_refs": [
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#过度设计防线与 Phase 1 MVP",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U2. Task-pack source-plan 聚焦回查",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U11. Cross-cutting closeout checklist",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U12. Token economy guardrails 与 progressive disclosure",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#分阶段交付",
        "skills/spec-write-tasks/references/task-pack-schema.md#Task Pack Contract",
        "tests/fixtures/spec-write-tasks/valid/task-pack.md"
      ],
      "entry_hint": "Start by reading the source plan Phase 1A gate and U2 acceptance, then update prose and tests in the smallest closed loop.",
      "parallelizable": false,
      "test_focus": "Task-pack hash/spec-id/path-safety validation plus prose contract tests proving focused source-plan reads and granular context_refs guidance.",
      "done_signal": "Targeted unit tests pass, Phase 1A fresh-source eval artifact exists, changelog is updated, and no Phase 1B/1C/1D scope is implemented.",
      "wave": 1,
      "review_gate": "required",
      "review_focus": "Check source-plan authority, Phase 1A-only scope, context_refs granularity, fresh-source eval hard gate, and generated runtime mirror avoidance.",
      "risk_note": "The main risk is expanding into later Phase 1 gates or treating task-pack context as scope authority.",
      "stop_if": "A new durable evidence producer, standards next-action artifact, core summary sweep, generated runtime mirror edit, or public workflow entrypoint change becomes necessary."
    }
  ]
}
```

## Task Cards

### T001

- source_unit: U2
- requirement_refs: R3, R4, R17, R19, R20, R26
- goal: Deliver the Phase 1A handoff tracer bullet.
- dependencies: none
- files:
  - `skills/spec-write-tasks/SKILL.md`
  - `skills/spec-write-tasks/references/task-pack-schema.md`
  - `skills/spec-write-tasks/references/task-quality-guide.md`
  - `skills/spec-work/SKILL.md`
  - `src/cli/task-pack.js`
  - `src/cli/commands/tasks.js`
  - `tests/unit/spec-write-tasks-contracts.test.js`
  - `tests/unit/spec-work-contracts.test.js`
  - `tests/unit/task-pack-command.test.js`
  - `docs/validation/2026-05-16-phase1a-fresh-source-eval.md`
  - `CHANGELOG.md`
- context_refs:
  - `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U2. Task-pack source-plan 聚焦回查`
  - `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#分阶段交付`
  - `skills/spec-write-tasks/references/task-pack-schema.md#Task Pack Contract`
- entry_hint: Start with the plan's Phase 1A gate and U2 acceptance.
- test_focus: Focused contract and task-pack validator tests.
- done_signal: Tests pass, eval artifact exists, changelog is updated, and later gates remain untouched.
- parallelizable: false
- review_gate: required
- review_focus: Source-plan authority, Phase 1A scope, context ref granularity, eval gate, and runtime mirror boundary.
- stop_if: Later Phase 1 gates or generated runtime mirror edits become necessary.
- wave: 1

## Orientation Evidence

- provider: direct-repo-reads
- posture: bounded
- evidence_refs:
  - `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`
  - `skills/spec-write-tasks/SKILL.md`
  - `skills/spec-write-tasks/references/task-pack-schema.md`
  - `src/cli/task-pack.js`
  - `src/cli/commands/tasks.js`
  - `tests/fixtures/spec-write-tasks/valid/task-pack.md`
- limitations:
  - Graph facts were read for readiness context, but task-pack compilation only needed direct source reads.
  - Deterministic validation checks identity, freshness, and structure only; semantic task quality remains this handoff review's responsibility.

## Validation Notes

- Source plan hash was produced with `spec-first tasks hash docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md --json`.
- This task pack must pass `spec-first tasks validate docs/tasks/2026-05-16-001-feat-spec-first-optimization-phase1a-tasks.md --json`.
- This pack is executable only for Phase 1A. Later gates require new task packs after Phase 1A closeout.

## Regeneration Rules

- Regenerate from the source plan if `source_plan_hash` changes.
- Regenerate if Phase 1A scope changes, especially if the source plan adds or removes required files, tests, or gates.
- Do not hand-edit this task pack to include Phase 1B/1C/1D work; derive a new phase task pack after Phase 1A is complete.
