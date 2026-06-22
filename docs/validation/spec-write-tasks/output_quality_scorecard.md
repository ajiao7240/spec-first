# spec-write-tasks 输出质量评分卡

- generated_at: 2026-06-22T19:19:20.104Z
- command: `node scripts/spec-write-tasks/run-output-evals.js`
- rerun_command: `node scripts/spec-write-tasks/run-output-evals.js`
- source_revision: `4d47b125`
- owner: spec-first maintainers
- review_cadence: 在有意义的 spec-write-tasks behavior、packaging、eval 或 handoff contract 变更前重跑。
- output_contract: 执行 deterministic assertions，校验 recorded output 的 source/output hashes，并记录缺失的 provider/human evidence；semantic quality 不成为 hard validator gate。
- score_is_signal_not_gate: true
- rollback_boundary: 重新生成 docs/validation/spec-write-tasks/output_quality_scorecard.{json,md}；不要 patch generated runtime mirrors。

## 摘要

- cases: 5
- deterministic_assertions: 13/13 通过
- structural_errors: 0
- recorded_outputs: 1
- adjudicated_outputs: 1
- pending_or_unknown_adjudications: 0

## 用例

| 用例 | Deterministic | Evidence | 预期记录 | 缺失证据项数 |
| --- | --- | --- | --- | --- |
| file-backed-valid-task-pack-handoff | 4/4 | fixture-backed | 已记录 | 0 |
| small-plan-skip-preserves-context-budget | 2/2 | fixture-backed, missing-evidence | 已记录 | 2 |
| high-risk-pack-review-handoff-needs-authorization | 3/3 | fixture-backed, missing-evidence | 已记录 | 2 |
| deep-plan-large-unit-fanout | 2/2 | fixture-backed, missing-evidence | 已记录 | 2 |
| degraded-helper-signal-does-not-downgrade-deep-plan | 2/2 | fixture-backed, missing-evidence | 已记录 | 2 |

## 记录输出

- valid-task-pack-recorded-output: model-adjudicated; hash_status=matched; source_plan_hash_status=matched; output=docs/validation/spec-write-tasks/recorded-output/valid-task-pack-output.md

## 缺失证据

- 人工裁决
- 模型执行证据
- provider telemetry 证据
