# spec-write-tasks 任务包质量分析

- generated_at: 2026-06-22T19:19:20.204Z
- command: `node scripts/spec-write-tasks/analyze-task-pack-quality.js tests/fixtures/spec-write-tasks/valid/task-pack.md`
- rerun_command: `node scripts/spec-write-tasks/analyze-task-pack-quality.js tests/fixtures/spec-write-tasks/valid/task-pack.md`
- source_revision: `4d47b125`
- rollback_boundary: 重新生成 docs/validation/spec-write-tasks/task_pack_quality_analysis.{json,md}；不要 patch generated runtime mirrors。
- advisory_only: true
- input_readiness: readable (task-pack-readable)
- deterministic_handoff: true
- task_pack_validity: valid

## 发现

- 无

## 已禁用检查

- large-plan-threshold-deferred: large-plan 与 wide-source-unit findings 进入 analyzer behavior 前，需要先有 follow-up fixture 或 recorded output。
