---
title: Fixture Task Pack
type: task-pack
status: derived
date: 2026-04-26
spec_id: 2026-04-26-999-task-pack-fixture
source_plan: tests/fixtures/spec-write-tasks/valid/source-plan.md
source_plan_hash: sha256:7337f3e94d0a592de139bf13e1364de47c9e193f9ebffac9c91b2c6cfe43b388
generated_by: spec-write-tasks
mode: derived
---

# Fixture Task Pack

## Overview

Derived execution input for validator tests.

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
      "source_unit": "U1",
      "requirement_refs": ["R1"],
      "goal": "Validate task pack identity, freshness, and structure.",
      "dependencies": [],
      "files": [
        "src/cli/task-pack.js",
        "tests/unit/task-pack-command.test.js"
      ],
      "test_focus": "Valid, stale, and wrong-chain task pack validation.",
      "done_signal": "Validator tests pass.",
      "wave": 1,
      "stop_if": "Validation requires judging task splitting quality."
    }
  ]
}
```

## Task Cards

### T001

Validate deterministic task-pack handoff.
