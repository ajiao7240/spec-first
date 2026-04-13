# 3A 验证记录：spec-review Stage-0 消费

- task_name: `spec-review` 消费 `spec-graph-bootstrap` Stage-0 产物，审查阶段 3B 方案与接入改动的风险点
- task_goal: 验证 `review` 阶段是否能依靠 `always + stages.review + output_exists.*` 在 reviewer 召唤前扩展风险感知范围，并保持非阻断降级
- stage: `review`
- task_type: `unknown`
- context_slug: `spec-first`
- expected_inputs:
  - `docs/contexts/spec-first/00-summary.md`
  - `docs/contexts/spec-first/README.md`
  - `docs/contexts/spec-first/code-facts/high-risk-modules.md`
  - `docs/contexts/spec-first/pitfalls/index.md`
  - `docs/contexts/spec-first/context-packs/review-change.md`
  - `docs/contexts/spec-first/code-facts/test-map.md`
  - `docs/contexts/spec-first/code-facts/public-entrypoints.md`
- actual_inputs:
  - `docs/contexts/spec-first/00-summary.md`
  - `docs/contexts/spec-first/README.md`
  - `docs/contexts/spec-first/code-facts/high-risk-modules.md`
  - `docs/contexts/spec-first/pitfalls/index.md`
  - `docs/contexts/spec-first/context-packs/review-change.md`
  - `docs/contexts/spec-first/code-facts/test-map.md`
  - `docs/contexts/spec-first/code-facts/public-entrypoints.md`
- fallback_triggered: `no`
- fallback_reason: `none`
- degrade_level: `none`
- missing_outputs: `[]`
- misleading_points:
  - `review-change.md` 当前更像 repo 级 review pack，而非一次具体 diff 的变更包；它适合扩大风险感知，但不能替代真实 diff scope
  - v1 仍跳过 `fact.graph_support_state`，因此不会因为本地图状态不同而自动增删高风险上下文；这是已知延期，不影响当前最小闭环
- useful_outputs:
  - `code-facts/high-risk-modules.md` 让 reviewer 能先关注 `src/crg/communities.js`、`src/crg/cli/build.js`、`src/crg/cli/envelope.js` 这类高风险模块
  - `context-packs/review-change.md` 把 review 首看模块、测试薄弱区和关键入口聚合在一处，适合 review 阶段
  - `code-facts/test-map.md` 让 reviewer 能判断本次 Stage-0 接入改动更需要文本契约校验与运行时同步验证
  - `code-facts/public-entrypoints.md` 让 reviewer 能确认消费逻辑不会误导到非入口模块
- verdict: `pass`
- allow_enter_3b: `yes`
- gate_reason: `review` 阶段主路径可工作，且专属 pack 与 risk/code-facts 组合能明显提升审查聚焦度；剩余问题都属于已知 v1 边界，不构成关键误导，允许固化到 3B

## 验证结论

本次验证证明 `spec-review` 是 v1 中 Stage-0 消费收益最高的场景，具备进入 3B 固化的充分证据。
