# 06 Evolution Opportunities

## 1. 收口共享枢纽复杂度

### 代码事实
高热点文件包括：
- `src/cli/commands/init.js:72-303`
- `src/cli/commands/doctor.js:30-103,105-217,219-360`
- `src/bootstrap-compiler/workspace-compiler.js`
- `src/crg/cli/build.js:180-340`
- `src/crg/commands/review-context.js:41-305`
- `src/crg/graph.js:142-360`

### 判断
这些文件不是“写得差”，而是产品复杂度真实汇聚的结果。下一阶段演化收益最高的不是新增功能，而是降低这些热点的理解负担与耦合密度。

### 建议分类
- 应强化：中间 contract、阶段 helper、热点边界注释
- 应重构：上述热点模块

## 2. 收口多层投影的维护税

### 代码事实
- source assets：`skills/`、`agents/`、`templates/`
- mirror：`docs/10-prompt/`
- runtime copy：`.claude/`、`.codex/`、`.agents/skills/`
- sample/generated baseline：`docs/contexts/spec-first/`

### 判断
这不是简单的“多几份文档”，而是多层语义载体共存。它们目前被测试守住，但维护税已经很明显。

### 建议分类
- 应轻量化：历史兼容说明与重复投影
- 应强化：drift evidence 与收口路径
- 应删除：确认无用的 legacy 兼容层

## 3. 强化故障路径验证

### 代码事实
- release 链路先写 version 再执行测试/打包/发布
- postinstall repair 有多分支
- bootstrap/workspace 有 rollback 与 prune failure contract

### 判断
当前主路径质量较高，下一阶段最值钱的是失败路径验证，不是继续堆 happy-path contract。

### 建议分类
- 应强化：release failure / rollback failure / postinstall repair / prune failure tests
- 应重构：`scripts/release-publish.cjs`

## 4. 强化 evidence-to-verdict 追踪

### 外部输入观察
外部高质量实践普遍支持：verification、tracing、guardrails、review 需要解耦，但 verdict 仍应能回指 evidence。

### 判断
spec-first 现在已经有 verification summary / dispatch / gate state / evidence；下一步更适合做轻量可回指，而不是造中央 gate 引擎。

### 建议分类
- 应实验化：evidence-to-verdict trace、run trace 索引
- 应保留：verification signals 解耦原则

## 5. 失效暴露能力

### 外部输入观察
高质量 workflow/agent 系统的真正价值不是自动编排，而是能暴露“哪里失效了、为什么要 reload”。

### 判断
spec-first 很适合补“spec/plan/context 变更后哪些下游 artifact 失效”的轻量机制。

### 建议分类
- 应实验化：invalidation exposure、reload hints
- 不应做：自动重规划 / 超级 orchestrator

## 6. 默认主路径收口

### 判断
项目能力越来越宽，但默认主路径仍需更鲜明，否则 adoption 叙事会变重。

### 建议分类
- 应轻量化：默认对外暴露面
- 应强化：面向用户的默认主路径叙事
