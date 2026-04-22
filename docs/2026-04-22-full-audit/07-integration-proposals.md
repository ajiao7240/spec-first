# 07 Integration Proposals

## 提案 1：共享枢纽阶段化重构

### A. 当前问题判断
- `src/cli/commands/init.js:72-303`、`src/bootstrap-compiler/workspace-compiler.js`、`src/crg/cli/build.js:180-340`、`src/crg/commands/review-context.js:41-305`、`src/crg/graph.js:142-360` 是高复杂度汇聚点。
- 其中 `init.js` 当前同时协调 adapter/manifest/governance/state/drift/plan/apply/rollback；`build.js` 当前同时协调 collect/parse/persist/resolve/postprocess；`review-context.js` 当前同时串联 detect/risk/expand/retrieve/summarize。

### B. 启发来源
- 来自当前代码事实，而不是外部 feature copy。
- 外部优秀实践支持“plan/execute 分层”“small composable modules”，反对大 orchestrator。

### C. 对 spec-first 的启发
- 保持 deterministic execution，但把阶段边界显式化。

### D. 集成方案
- 为热点模块引入更明确的阶段 helper 或中间 contract：
  - init: inspect -> assess -> plan -> apply -> persist
  - workspace-compiler: resolve -> load -> evaluate -> merge -> summarize
  - build: collect -> parse -> persist -> resolve -> postprocess -> summarize
  - review-context: detect -> expand -> retrieve -> summarize
  - resolveEdges: direct-id -> module-path -> basename -> symbol -> same-file-disambiguation -> unresolved

### E. 自我辩论
- 支持：降低理解成本，减缓热点膨胀
- 反对：可能引入过度抽象
- 最小实现派：先拆阶段 helper，不引入新的大型框架

### F. 最终裁决
- 立即做，优先级高
- 进入核心

## 提案 2：evidence-to-verdict 轻量可回指

### A. 当前问题判断
- 现有 verification signals 已分层，但 evidence 与最终 verdict 的回指链还不够强。
- 代码上已经存在可利用的事实层：`src/context-routing/evaluator.js:233-264` 暴露 `fallback_reason/confidence/provenance/coverage_gaps`，`src/context-routing/verification-summary.js:196-253` 暴露 summary/dispatch posture 聚合，说明系统已有“信号分层”，但还缺少“判定回指 evidence”的轻量索引。

### B. 启发来源
- 外部 tracing/guardrails/review 解耦实践

### C. 对 spec-first 的启发
- 不做超级 gate，而做“哪条判断来自哪些 evidence”的轻量关联。

### D. 集成方案
- 在 run artifact / diagnostics 中追加：
  - summary field -> evidence item ids
  - dispatch blocker -> supporting evidence refs
  - review verdict -> upstream verification/evidence refs

### E. 自我辩论
- 支持：提升可解释性与审计性
- 反对：若做太重，会变 tracing platform
- 最小实现派：先做 run artifact 索引，不做统一 UI

### F. 最终裁决
- 作为实验做
- 暂不进入核心重机制

## 提案 3：失效暴露而非自动重规划

### A. 当前问题判断
- source/plan/context/runtime 演化后，哪些下游输入已失效，目前缺少统一暴露面。
- 从代码看，系统已经具备暴露失效所需的原材料：`src/context-routing/evaluator.js:233-247` 已把 `freshness_stale`、`minimal_context_missing`、`legacy_manifest_missing_quality_fields` 等退化原因显式化；`src/context-routing/workspace-loader.js:225-276` 已在 workspace 聚合中暴露 `workspace_child_partial_degraded` 等 fallback reason，但尚未把这些信号进一步组织成统一的 invalidation hint 面。

### B. 启发来源
- 外部高质量实践强调 invalidation / reload hint，而不是自动 orchestration。

### C. 对 spec-first 的启发
- spec-first 应继续做输入质量系统，而非中央流程引擎。

### D. 集成方案
- 在 Stage-0 或 doctor/report 中补充：
  - stale because ...
  - changed source invalidates ...
  - recommended reload targets ...

### E. 自我辩论
- 支持：提升输入质量，符合哲学
- 反对：若变成自动重算树，会滑向强编排
- 最小实现派：只输出 invalidation hints，不做自动执行

### F. 最终裁决
- 作为实验做

## 提案 4：发布链路原子性收口

### A. 当前问题判断
- `scripts/release-publish.cjs` 先写 version，再做后续动作，失败时不够原子。
- 工程事实依据来自已读发布链路：发布脚本会先修改 `package.json.version`，再执行 `test:release -> npm pack -> npm publish`，当前报告已在 `03-critical-flow-review.md` 与 `04-test-and-quality-review.md` 中将其识别为最主要的工程闭环缺口之一。

### B. 启发来源
- 当前代码审计，而非外部 feature copy

### C. 对 spec-first 的启发
- 工程成熟度应覆盖失败路径，而不仅是发布主路径。

### D. 集成方案
- 将 release publish 改成：
  - preflight
  - staged version mutation
  - publish attempt
  - fail-safe restore / finalization

### E. 自我辩论
- 支持：减少半收口状态
- 反对：实现更复杂
- 最小实现派：先补恢复逻辑与 failure tests

### F. 最终裁决
- 立即做，优先级高
