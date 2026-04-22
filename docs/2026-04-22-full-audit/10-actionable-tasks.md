# 10 Actionable Tasks

## 应保留

1. 保留 `light contract / explicit boundaries / let the LLM decide` 的总哲学
2. 保留 CLI 的 operation plan + dry-run/apply 模式
3. 保留 Stage-0 的显式质量信号：`fallback_reason / confidence / provenance / freshness`
4. 保留 CRG 作为事实层，而不是流程编排器

## 应强化

1. 强化共享枢纽的中间 contract 与阶段 helper
2. 强化 release failure / rollback failure / postinstall repair / prune failure tests
3. 强化 source / mirror / runtime / sample 漂移解释与收口路径
4. 强化 verification evidence 与 verdict 的轻量回指

## 应轻量化

1. 轻量化 `CLAUDE.md` 中的历史治理汇编密度
2. 轻量化默认对外暴露的 workspace / verification / gate 能力面
3. 轻量化 Claude 侧多层 command/template/workflow/runtime 投影的认知负担

## 应重构

1. `src/cli/commands/init.js` —— 当前承担 adapter/manifest/state/drift/plan/apply/rollback 的高密度协调职责
2. `src/bootstrap-compiler/workspace-compiler.js` —— 当前承担 Stage-0 workspace 级的模式聚合、verification 汇总与输出组装
3. `src/crg/cli/build.js` —— 当前承担 collect/parse/persist/resolve/postprocess 的大 orchestration
4. `src/crg/commands/review-context.js` —— 当前同时承载 detect/risk/expand/retrieve/summarize
5. `src/crg/graph.js#resolveEdges` —— 当前承担多阶段 target resolution 与大量启发式分支
6. `scripts/release-publish.cjs` —— 当前存在发布原子性与失败恢复短板

## 应删除

1. 已确认迁移完成后，可删除不再必要的 legacy runtime cleanup 兼容层
2. 删除仅为解释历史存在、但已不再承担真实治理职责的重复说明投影

## 应实验化

1. handoff payload policy
2. invalidation exposure / reload hints
3. evidence-to-verdict trace index
4. run trace 轻量索引

## 任务优先级与理由

| 优先级 | 任务 | 理由 |
|---|---|---|
| P0 | 重构共享枢纽 | 直接降低后续所有演化成本 |
| P0 | 发布失败恢复 | 当前工程闭环最大缺口 |
| P0 | 默认主路径收口 | 避免产品身份持续扩张 |
| P1 | 强化失败路径测试 | 提升工程可信度 |
| P1 | 收口同步面 | 降低维护税 |
| P2 | 实验 invalidation / handoff / trace | 提升输入质量，但不应抢占核心重构优先级 |
