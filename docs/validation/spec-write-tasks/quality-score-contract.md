# spec-write-tasks 质量评分契约

本文记录 `spec-write-tasks` 的维护者侧证据契约。它是 review 证据，不是用户运行时说明，也不是发布硬门禁。

## 范围

- target skill: `skills/spec-write-tasks`
- score posture: `score_is_signal_not_gate`
- quality target: `quality_evidence_closure`
- target audit 下的确定性评分上限：约 92，而不是机械 100
- owner: spec-first maintainers
- review cadence: 在有意义的 `spec-write-tasks` 行为、package、eval 或 handoff contract 变更前重跑

## 维度台账

| Dimension | 当前 scorer 行为 | 闭环证据 | 残余原因 |
| --- | --- | --- | --- |
| `input_contract` | 存在 `## Inputs` 时最高计 4 | `SKILL.md`、`task-quality-guide.md`、output eval fixtures、本文 | `audit-tool-gap`: 语义完整性仍需要 reviewer 判断 |
| `output_contract` | 存在 `## Outputs` 时最高计 4 | `execution-handoff-contract.md`、output scorecard、recorded output adjudication | `audit-tool-gap`: output quality 不能完全确定性打分 |
| `workflow_explicitness` | 存在 `## Workflow` 或 `## Execution` 时最高计 4 | branch decision tree、failure reason codes、high-risk review handoff cases | `audit-tool-gap`: branch 质量需要语义审查 |
| `progressive_disclosure` | estimated tokens `<= 3000` 且存在 references/scripts 时计 5 | 瘦身后的 `SKILL.md` 与 package-local references | token budget 通过时无残余 |
| `eval_readiness` | 存在含 negative cases 的 eval fixtures 时最高计 4 | `run-output-evals.js`、scorecard、deterministic assertions、recorded output | `audit-tool-gap`: scorer 不检查 runner 本体 |
| `runtime_governance` | `--target` audit 中为 `null`，因为该 audit 跳过 governance | package 与 runtime sync smoke tests | target audit 中记录为 `not-scored-with-reason` |
| `cross_host_portability` | `--target` audit 中为 `null`，因为该 audit 跳过 governance | Codex projection smoke、official `.skill` package smoke、unchecked-host notes | target audit 中记录为 `not-scored-with-reason` |

## 状态词汇

- `evidence-complete`: 必需的确定性报告、记录输出和 reviewer 可读契约均存在。
- `runner-backed`: 本地确定性 runner 已执行结构化断言并写入报告。
- `adjudication-pending`: recorded output 存在，但还没有 human/model judgment。
- `model-adjudicated`: 模型 reviewer 已基于 source evidence 判断 recorded output。
- `human-adjudicated`: 人类 reviewer 已基于 source evidence 判断 recorded output。
- `not-scored-with-reason`: target audit 设计上排除该维度。
- `audit-tool-gap`: 目标证据存在，但当前 scorer 不能把语义证据提升为 5 分。
- `not_checked_with_reason`: 环境缺少可执行 provider 或 package smoke 工具时，必须显式记录未检查原因。

## 报告 Metadata Contract

`docs/validation/spec-write-tasks/**` 下的报告必须按报告类型声明字段，不把所有报告强行压成同一 schema。

### `output_quality_scorecard.{json,md}`

必须包含：

- `schema_version`
- `generated_at`
- `command`
- `rerun_command`
- `source_revision`
- `source_cases`
- `recorded_output_dir`
- `rollback_boundary`
- `owner`
- `review_cadence`
- `output_contract`
- `score_is_signal_not_gate`
- `summary`
- `recorded_outputs[]`，且含 source plan hash 与 output hash 校验状态
- `cases[]`
- `structural_errors[]`

### `task_pack_quality_analysis.{json,md}`

必须包含：

- `schema_version`
- `generated_at`
- `command`
- `rerun_command`
- `source_revision`
- `rollback_boundary`
- `score_is_signal_not_gate`
- `advisory_only`
- `input_readiness`
- `validator_boundary`
- `task_pack`
- `findings[]`
- `disabled_checks[]`

### `downstream_consumer_outcome.{json,md}`

必须包含：

- `schema_version`
- `generated_at`
- `command_evidence[]`
- `rerun_command`
- `source_revision`
- `rollback_boundary`
- `score_is_signal_not_gate`
- `outcomes[]`
- `limitations[]`

它回答代表性 task-pack handoff 对 `spec-work` 和 high-risk document-review consumer 是否无阻断歧义；它不声称未来所有任务包都语义正确。

### `recorded-output/*.adjudication.json`

必须包含：

- `schema_version`
- `id`
- `source_plan`
- `source_plan_hash`
- `recorded_output`
- `output_hash`
- `generation_context`
- `adjudication.status`
- reviewer notes 与 residual missing evidence

## Runtime 与 Host 证据

Official `.skill` package 只能包含 runtime 需要的 skill 文件。repo-level scripts、validation reports、historical plans 与 `.spec-first/audits/**` 是维护者证据，不能成为 runtime dependency。

`official_package_smoke` 在存在官方 package script 时必须执行；脚本不可用时，本文与相关测试必须记录 `not_checked_with_reason`，不能静默 skip 或声称通过。

Codex projection 通过 source sync 到临时 runtime 检查。Claude delivery 只有在当前 repo 存在 source adapter/generator 路径时才检查；否则记录 `not_checked_with_reason`，不能声称 pass。

## Fresh-Source Eval 状态

本轮 source prose 变更需要 fresh-source 或等价独立审查记录。状态记录在 `docs/validation/spec-write-tasks/fresh-source-eval-2026-06-23-quality-evidence-closure.md`；该记录必须说明 source refs、review lens、已修复 findings、未覆盖限制，以及 generated runtime mirrors 未手改。

## 回滚边界

回滚或重生成只应触碰 `docs/validation/spec-write-tasks/**` 报告与维护者脚本输出，然后重跑对应 maintainer scripts。不要 patch generated runtime mirrors 来让证据通过。

## Large Plan Follow-Up 边界

大型 source plan 处理仍然 deferred。本次 evidence-closure pass 不新增 large-plan threshold 的 analyzer finding 或 entrypoint 规则。未来行为变更需要先提供代表性 large-plan fixture 或 recorded output，证明 threshold、intermediate artifact shape 与 requirement-to-task coverage matrix 确实提升 task-pack 质量。
