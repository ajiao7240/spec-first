# 13 Decision Rationale

## 一、最终裁决

### 结论

本次完整审计的最终裁决是：

> `spec-first` 当前处于 **方向正确、实现成熟度较高、明显高于平均水平，但复杂度已来到必须主动收口的拐点**。

它不是一个需要推倒重来的系统；相反，它已经拥有一套相当强的哲学基线、事实层、运行时治理与测试守护。真正需要警惕的是：

- 共享枢纽继续膨胀
- source / mirror / runtime / sample 的同步面继续增加
- 产品身份持续扩张而默认主路径不收口

## 二、为什么这样裁决

### 代码依据总览
- CLI 根入口薄：`src/cli/index.js:10-49`
- `init`/`clean` 的 plan 化执行：`src/cli/commands/init.js:166-246`、`src/cli/commands/clean.js:90-226`
- Stage-0 质量评估显式化：`src/context-routing/evaluator.js:233-264`
- workspace 级聚合复杂度上升：`src/context-routing/workspace-loader.js:181-276` 与 `src/context-routing/verification-summary.js:196-253`
- CRG build/review-context/resolveEdges 为明显热点：`src/crg/cli/build.js:180-340`、`src/crg/commands/review-context.js:167-305`、`src/crg/graph.js:142-360`
- 工程闭环短板集中在发布与故障路径：`scripts/release-publish.cjs`、`bin/postinstall.js`

### 1. 没有判成“最佳实践终态”

#### 理由
- 少数核心文件承担了过多聚合职责：`init.js`、`doctor.js`、`workspace-compiler.js`、`build.js`、`review-context.js`、`resolveEdges`
- 多层投影同步已经形成显著维护税
- 发布与失败恢复闭环仍不完整

#### 为什么不更乐观
- 因为“方向正确”不等于“复杂度已稳定收口”
- 最佳实践不仅要求功能、理念、测试正确，还要求系统可持续演化

### 2. 也没有判成“架构跑偏”

#### 理由
- CLI 根入口、context-routing evaluator、CRG 事实层都仍然尊重明确边界
- 项目没有把 verification / review / routing / evidence 压成一个中心化超级 gate
- deterministic execution 与 semantic decision 的边界仍大体成立

#### 为什么不更悲观
- 目前看到的是“高张力”，不是“已越线”
- 项目仍保有主动收口的空间

## 三、未采纳的更激进结论及原因

### 未采纳结论 A：应立即大规模删减平台能力

#### 原因
- 当前代码事实不能证明这些能力都是无效复杂度
- bootstrap/context-routing/CRG/dual-host 治理有真实产品价值
- 问题在于复杂度收口，而不是简单砍功能

### 未采纳结论 B：应立即构建统一 workflow runtime 平台

#### 原因
- 这会与仓库哲学冲突，强化中心 orchestration
- 当前更值得做的是输入质量增强与热点解耦，而非平台一体化

### 未采纳结论 C：应把所有 mirror/sample 都删掉，只保留源码

#### 原因
- 现有 mirror/sample 同时承担 prompt mirror、测试基线、自举样本职责
- 问题不是“全部删除”，而是“哪些保留、哪些轻量化、哪些去冗余”

## 四、优先级理由

### P0 为什么是“共享枢纽复杂度收口 + 发布失败恢复”
- 这是最能降低未来所有维护成本的动作
- 也是最能防止系统滑向隐式 orchestrator 的动作
- 与继续扩展治理面相比，收益更大、风险更低

### P1 为什么是“失败路径测试 + 同步面收口”
- 这些问题当前不是致命阻塞，但会显著影响工程可信度与维护税
- 它们需要建立在 P0 之后推进

### P2 为什么只做实验能力
- invalidation、handoff policy、trace index 都有价值
- 但如果过早核心化，会再次增加系统层次与默认复杂度

## 五、与仓库哲学的一致性解释

本次裁决优先选择“收口复杂度、强化输入质量、限制编排增长”，而不是“增加更多治理面”，原因在于这更符合：

- Light contract
- Explicit boundaries
- Let the LLM decide
- Scripts prepare, LLM decides

也就是说，本次裁决不是保守，而是**主动维护 spec-first 的长期方向一致性**。

## 六、后续建议

1. 先做 P0，再决定是否扩大实验能力面
2. 审计文档建议先内部评审，不建议直接视为已完成路线图
3. 后续更适合拆成 2-3 轮演化任务推进：
   - 第一轮：热点收口 + release failure
   - 第二轮：失败路径测试与同步面收口
   - 第三轮：轻量实验能力
