---
title: 记录的有效任务包输出
type: task-pack
status: derived
date: 2026-06-23
spec_id: 2026-04-26-999-task-pack-fixture
source_plan: tests/fixtures/spec-write-tasks/valid/source-plan.md
source_plan_hash: sha256:7337f3e94d0a592de139bf13e1364de47c9e193f9ebffac9c91b2c6cfe43b388
generated_by: spec-write-tasks
mode: derived
---

# 记录的有效任务包输出

## 概览

这是用于 quality evidence closure 的代表性 executable output 记录。

## 源摘要

- source plan: `tests/fixtures/spec-write-tasks/valid/source-plan.md`
- branch: `compile`
- evidence posture: 带 model adjudication 的 recorded fixture

## 可追踪矩阵

| Source | Requirement | Task(s) | Validation |
| --- | --- | --- | --- |
| U1 | R1 | T001 | task-pack validator tests |

## 任务图

T001 没有 dependencies。

## 执行波次

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
      "review_gate": "required",
      "review_focus": "Check validator compatibility and source-plan boundary.",
      "stop_if": "Validation requires judging task splitting quality."
    }
  ]
}
```

## 任务卡

### T001

验证 deterministic task-pack handoff。

## 定向证据

- provider: direct-repo-reads
- posture: bounded
- evidence_refs:
  - `tests/fixtures/spec-write-tasks/valid/source-plan.md`
  - `src/cli/task-pack.js`
- limitations:
  - 记录型 fixture evidence 不能证明 provider-backed model execution。

## 验证说明

这个 recorded output 是 runner/adjudication plumbing 的 load-bearing evidence，不替代未来的 provider-backed evals。

## 重生成规则

当 source plan、task-pack schema、validator contract 或 quality evidence closure contract 变化时，需要重新生成。
