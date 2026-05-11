---
title: "feat: AI dev benchmark fixture suite v1"
type: feat
status: active
date: 2026-05-11
spec_id: 2026-05-11-003-ai-dev-benchmark-fixtures
origin: docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md
origin_issue: P2-003
---

# feat: AI dev benchmark fixture suite v1

## 摘要

本计划解决 `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md` 中的 `P2-003 benchmark/eval fixture suite 仍偏弱`。第一版只建立 3 个可重复 benchmark fixtures 和确定性校验入口，用来证明 spec-first 的 workflow 改动是否改善真实 AI coding 闭环输入，而不是把 prompt 变长。

设计保持 light contract：脚本只验证 fixture 结构、路径、expected artifacts、baseline metadata 和 runner 输出；LLM 仍负责判断某次 workflow 输出是否语义上满足需求。第一版不引入长期 benchmark 平台、不运行真实 agent 自动修代码、不把 benchmark 分数作为 release hard gate。

## 问题框架

当前仓库已有 contract/unit/smoke/integration 测试，也有 `npm run test:ai-dev:gate`，但该 gate 主要验证 workflow runtime contract 单测是否通过。它不能回答这些问题：

- 一个 docs-only 需求是否能沿着 spec-plan/spec-work/spec-code-review 形成正确的 artifact 边界。
- 一个 CLI bugfix 需求是否能表达 expected verification，而不是只看 prose 是否完整。
- graph provider degraded 时，workflow 是否能回退到 bounded direct reads 和明确的 degraded evidence。

没有 fixture suite 时，后续 workflow 改动只能靠人工读长文档判断“质量更好”。P2-003 的目标是先把最小可重复场景固定下来，给后续 P2-002、P2-006、P2-007 和 task-pack/run-evidence 改动提供稳定验证基线。

## 目标

- G1. 建立第一版 3 个 repo-like benchmark fixtures：docs-only、CLI bugfix、graph-degraded fallback。
- G2. 为每个 fixture 定义 machine-readable manifest，包含 prompt、expected workflows、expected changed paths、expected artifacts、required validation 和 degraded-mode expectations。
- G3. 增加 deterministic fixture validator/runner，输出稳定 JSON summary，供 `test:ai-dev:gate` 和后续 release evidence 消费。
- G4. 将 benchmark fixture suite 接入现有 AI dev quality gate 的 artifact 输出，但第一版只作为 `advisory` check。
- G5. 文档化“脚本产出 facts，LLM 判断 workflow 输出质量”的边界，避免把 benchmark runner 设计成语义评分器。

## 非目标

- 不在第一版执行真实 AI agent、真实 `$spec-work` 或真实 code review pipeline。
- 不引入集中 leaderboard、分数排名、长期历史数据库或外部 telemetry。
- 不把 fixture 通过率直接变成 release hard gate。
- 不复制外部项目代码或 prompt；fixture 内容必须 repo-local、可发布、无敏感信息。
- 不把 fixture manifest 当作任务状态、审批状态或 workflow progress store。
- 不实现 `spec-work` planned `run.json` producer；本计划只消费已有 artifact 边界。

## 需求

- R1. Fixtures 必须位于 repo 内可打包/可测试的路径，建议 `tests/fixtures/ai-dev-benchmarks/<fixture-id>/`。
- R2. 每个 fixture 必须有 `manifest.json`，字段至少包含 `schema_version`、`fixture_id`、`scenario_type`、`prompt_path`、`repo_path`、`expected_workflows`、`expected_changed_paths`、`expected_artifacts`、`validation_commands`、`quality_signals`。
- R3. `scenario_type` 第一版只允许 `docs-only`、`cli-bugfix`、`graph-degraded-fallback`。
- R4. Fixture 路径必须是 POSIX repo-relative path，不能包含绝对路径、`..` 或 host-specific home path。
- R5. Validator 只校验结构、路径存在性、枚举值、expected artifact contract 和 baseline completeness。
- R6. Runner 输出 `.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json`，包含每个 fixture 的 `status`、`reason_code`、`artifact_paths`、`advisory` 标记。
- R7. `test:ai-dev:gate` 可以聚合 benchmark fixture summary，但第一版失败分类应是 advisory unless fixture manifest 本身无效。
- R8. Tests 必须覆盖 valid fixtures、invalid path、missing artifact expectation、unknown scenario type 和 advisory aggregation。
- R9. README 或 docs catalog 必须说明 benchmark fixture suite 验证的是 workflow evidence shape，不是 LLM 语义正确率。
- R10. 更新 `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`，在实现后把 P2-003 标为已修复并记录验证。

## 设计决策

- D1. 使用 in-repo repo-like fixtures，而不是真实 Git 子仓库。理由：第一版重点是稳定输入/预期 artifact，不引入 worktree、remote、submodule 或 package install 噪音。
- D2. 新增独立 benchmark fixture runner，再由 AI dev quality gate 聚合。理由：保持 `run-ai-dev-quality-gate.js` 窄职责，避免 gate 脚本膨胀。
- D3. Manifest schema 放在 `docs/contracts/quality-gates/`。理由：fixture suite 是 quality gate evidence 的一部分，不属于 runtime workflow producer。
- D4. Runner 产出 advisory check。理由：fixture suite 初期用于防 drift，不应阻塞所有 release；当覆盖面稳定后再考虑提升为 blocking。
- D5. Expected artifacts 用路径/类型/owner 表达，不写 LLM 答案。理由：脚本校验确定性事实，LLM 判断语义质量。

## 文件计划

新增：

- `docs/contracts/quality-gates/ai-dev-benchmark-fixture.schema.json`
- `scripts/run-ai-dev-benchmark-fixtures.js`
- `tests/unit/ai-dev-benchmark-fixtures.test.js`
- `tests/fixtures/ai-dev-benchmarks/docs-only/manifest.json`
- `tests/fixtures/ai-dev-benchmarks/docs-only/prompt.md`
- `tests/fixtures/ai-dev-benchmarks/docs-only/repo/`
- `tests/fixtures/ai-dev-benchmarks/cli-bugfix/manifest.json`
- `tests/fixtures/ai-dev-benchmarks/cli-bugfix/prompt.md`
- `tests/fixtures/ai-dev-benchmarks/cli-bugfix/repo/`
- `tests/fixtures/ai-dev-benchmarks/graph-degraded-fallback/manifest.json`
- `tests/fixtures/ai-dev-benchmarks/graph-degraded-fallback/prompt.md`
- `tests/fixtures/ai-dev-benchmarks/graph-degraded-fallback/repo/`

修改：

- `package.json`
- `scripts/run-ai-dev-quality-gate.js`
- `tests/unit/ai-dev-quality-gate.test.js`
- `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`
- `CHANGELOG.md`

## 实施单元

### U1. 定义 benchmark fixture contract

- 目标：固定 fixture manifest 的 light contract。
- 修改：`docs/contracts/quality-gates/ai-dev-benchmark-fixture.schema.json`、`tests/unit/ai-dev-benchmark-fixtures.test.js`。
- Approach：沿用现有 `schema-validator` 测试模式，覆盖 valid sample 和 invalid sample。Schema 只描述结构，不表达语义评分。
- Patterns to follow：`tests/unit/ai-dev-quality-gate.test.js`、`docs/contracts/quality-gates/ai-dev-quality-gate-result.schema.json`。
- Test scenarios：
  - valid manifest 通过 schema。
  - unknown `scenario_type` 被拒绝。
  - absolute path / `../` path 被 validator helper 拒绝。
  - missing `expected_artifacts` 被拒绝。
- Verification：`npx jest tests/unit/ai-dev-benchmark-fixtures.test.js --runInBand`。

### U2. 添加 3 个 v1 fixtures

- 目标：建立最小可重复 benchmark 输入集。
- 修改：`tests/fixtures/ai-dev-benchmarks/**`。
- Approach：每个 fixture 包含 `manifest.json`、`prompt.md` 和 `repo/` 样本。`repo/` 是 repo-like snapshot，不要求可独立 npm install，除非该 fixture 的验证场景需要。
- Fixture scope：
  - `docs-only`：模拟用户要求更新一份 docs contract，expected changed paths 只允许 docs/CHANGELOG/test docs。
  - `cli-bugfix`：模拟一个 CLI 参数或 JSON 输出 bug，expected validation 包含 targeted unit test。
  - `graph-degraded-fallback`：模拟 graph readiness unavailable/degraded，expected artifact 要求 workflow summary 中出现 degraded reason 和 bounded direct read fallback。
- Test scenarios：
  - runner 能列出全部 3 个 fixtures。
  - 每个 fixture 的 prompt/repo/expected path 都存在。
  - 每个 fixture 至少声明一个 expected artifact 和一个 validation command。
- Verification：`npx jest tests/unit/ai-dev-benchmark-fixtures.test.js --runInBand`。

### U3. 增加 deterministic benchmark fixture runner

- 目标：让 fixture suite 可在本地和 CI 中重复运行。
- 新增：`scripts/run-ai-dev-benchmark-fixtures.js`。
- Approach：读取 `tests/fixtures/ai-dev-benchmarks/*/manifest.json`，校验 schema、路径、枚举和 expected artifacts，输出 result JSON 到 `.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json`。
- Output shape：`schema_version`、`generated_at`、`suite_id`、`passed`、`advisory`、`fixtures[]`、`failures[]`。
- Boundary：runner 不调用 LLM、不改 fixture repo、不执行工作流；它只验证 benchmark inputs 和 expected evidence shape 是否可消费。
- Test scenarios：
  - valid fixtures 输出 `passed: true`。
  - 临时 invalid fixture 输出 reason_code，例如 `invalid-manifest`、`missing-prompt`、`unsafe-path`。
  - result artifact path 使用 `resolveWorkflowArtifactDir`。
- Verification：`node --check scripts/run-ai-dev-benchmark-fixtures.js`、`npx jest tests/unit/ai-dev-benchmark-fixtures.test.js --runInBand`。

### U4. 聚合到 AI dev quality gate

- 目标：让 `npm run test:ai-dev:gate` 产出 benchmark fixture summary。
- 修改：`scripts/run-ai-dev-quality-gate.js`、`tests/unit/ai-dev-quality-gate.test.js`、`package.json`。
- Approach：新增 `test:ai-dev:benchmarks` 脚本；`run-ai-dev-quality-gate.js` 调用 benchmark runner 并把结果作为 `checks[]` 中的 advisory check。Manifest/schema 错误可以让 check failed，但 gate 总体第一版不因 advisory benchmark 失败而阻塞，除非 implementation 明确选择先阻塞结构错误。
- Test scenarios：
  - `buildGateResult` 能包含 workflow runtime contracts 和 benchmark fixture check。
  - benchmark check 标注 `advisory: true`。
  - failures 列表不把 advisory benchmark drift 当 release blocking failure。
- Verification：`npx jest tests/unit/ai-dev-quality-gate.test.js tests/unit/ai-dev-benchmark-fixtures.test.js --runInBand`、`npm run test:ai-dev:gate`。

### U5. 文档与状态校准

- 目标：让维护者知道 fixture suite 的能力边界。
- 修改：`docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`、`CHANGELOG.md`，可选补充 `README.md` / `README.zh-CN.md` 的 test command 表。
- Approach：实现完成后把 `P2-003` 标为已修复，并注明 v1 只有 3 个 fixtures、advisory gate、非语义评分器。
- Test scenarios：
  - `CHANGELOG.md` 格式通过。
  - 如果 README command 表更新，运行对应 README drift/command tests。
- Verification：`npx jest tests/unit/changelog-format.test.js --runInBand`、`git diff --check`。

## 验证计划

最小验证：

- `node --check scripts/run-ai-dev-benchmark-fixtures.js`
- `npx jest tests/unit/ai-dev-benchmark-fixtures.test.js tests/unit/ai-dev-quality-gate.test.js tests/unit/changelog-format.test.js --runInBand`
- `npm run test:ai-dev:gate`
- `git diff --check`

扩展验证：

- `npm run typecheck`
- `npm run test:unit`，仅当 `run-ai-dev-quality-gate.js` 或 shared verification helper 影响面扩大时运行。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| fixture suite 被误解为 LLM 质量评分 | 在 schema、runner、docs 中明确只验证 evidence shape 和 deterministic facts。 |
| runner 变成隐形 workflow engine | 禁止 runner 调用 agent/workflow；只读 manifest 和 fixture files。 |
| fixture repo 太重，拖慢 CI | v1 只放 3 个小 repo-like snapshots；不跑 npm install，不跑真实修复。 |
| advisory check 被长期忽略 | result JSON 保留 reason_code 和 artifact path，后续 P2-007 release evidence 可消费。 |
| package 发布漏掉 runner | 若新增 npm script 或 package file，需要同步 package install contract tests。 |

## Handoff

推荐下一步执行：

```text
$spec-work docs/plans/2026-05-11-003-feat-ai-dev-benchmark-fixtures-plan.md
```

如果实施前想进一步压缩执行上下文，可先运行 `spec-write-tasks` 生成 U1-U5 task pack；但本计划范围较窄，可直接进入 `$spec-work`。
