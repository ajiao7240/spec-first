---
title: High Risk Review Task Pack
type: task-pack
status: derived
date: 2026-04-26
spec_id: 2026-04-26-997-high-risk-review-fixture
source_plan: tests/fixtures/spec-write-tasks/high-risk-review/source-plan.md
source_plan_hash: sha256:01520950e177e001f23836e1ffd4f5ef13ad690911ed807cd64d1951974a0227
generated_by: spec-write-tasks
mode: derived
---

# High Risk Review Task Pack

## Overview

Derived execution input for high-risk review handoff tests.

## Source Summary

- source plan: `tests/fixtures/spec-write-tasks/high-risk-review/source-plan.md`
- task-ready branch: `compile`
- risk driver: public workflow prose and source/runtime boundary guidance

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U1 | Source/runtime boundary handoff | T001 | contract tests |
| U2 | Review handoff authorization | T002 | boundary fixture tests |

## Task Graph

T001 must land before T002 because the review fixture depends on the handoff contract wording.

## Execution Waves

- Wave 1: T001
- Wave 2: T002

## Task Pack Contract

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    {
      "wave": 1,
      "tasks": ["T001"]
    },
    {
      "wave": 2,
      "tasks": ["T002"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "requirement_refs": ["source-runtime-boundary"],
      "goal": "Refine task-pack handoff rules for source/runtime boundary work.",
      "dependencies": [],
      "files": [
        "skills/spec-write-tasks/SKILL.md",
        "skills/spec-write-tasks/references/execution-handoff-contract.md"
      ],
      "test_focus": "Skill contract points to the handoff reference and preserves validator boundaries.",
      "done_signal": "Spec-write-tasks contract tests pass for handoff reference coverage.",
      "wave": 1,
      "review_gate": "required",
      "review_focus": "Check source/runtime boundary and deterministic handoff claims.",
      "stop_if": "The task requires editing generated runtime mirrors or changing spec-work execution scope."
    },
    {
      "task_id": "T002",
      "source_unit": "U2",
      "requirement_refs": ["review-handoff-authorization"],
      "goal": "Preserve high-risk review intent without silently chaining workflows.",
      "dependencies": ["T001"],
      "files": [
        "skills/spec-write-tasks/evals/boundary-cases.json",
        "tests/unit/spec-write-tasks-contracts.test.js"
      ],
      "test_focus": "Boundary fixture expects review-task-pack with missing dispatch authorization unless explicitly authorized.",
      "done_signal": "Boundary fixture and contract tests preserve the high-risk review handoff.",
      "wave": 2,
      "review_gate": "required",
      "review_focus": "Check dispatch authorization and copy-ready doc-review handoff wording.",
      "stop_if": "The task requires automatic workflow chaining without explicit bounded continuation authorization."
    }
  ]
}
```

## Task Cards

### T001

Refine source/runtime boundary handoff rules.

### T002

Preserve review handoff authorization boundaries.

## Orientation Evidence

- provider: direct-repo-reads
- posture: bounded
- evidence_refs:
  - `skills/spec-write-tasks/SKILL.md`
  - `skills/spec-write-tasks/references/execution-handoff-contract.md`
- limitations:
  - Fixture evidence does not prove model output quality or human adjudication.

## Validation Notes

This fixture is valid only when `source_plan_hash` matches the current source plan body hash.

Expected final envelope posture for standalone skill trigger:

- `next_action: review-task-pack`
- `dispatch_authorization: missing`
- copy-ready current-host doc-review invocation is surfaced but not auto-dispatched

## Regeneration Rules

Rebuild when source plan scope, implementation units, files, verification, or task pack semantics change.
