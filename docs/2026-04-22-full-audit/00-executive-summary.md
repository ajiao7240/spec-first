# 00 Executive Summary

## 一句话结论

> `spec-first` 当前**方向正确、实现成熟度高于平均水平，但已经来到必须主动收口复杂度的拐点**。

## 负责人应先看什么

### 代码事实
- 根 CLI 仍然很薄：`src/cli/index.js:10-49`
- deterministic control plane 仍然成立：`src/cli/commands/init.js:166-246`、`src/cli/commands/clean.js:90-226`
- Stage-0 仍然在输出“更好的决策输入”，而不是中心编排：`src/context-routing/evaluator.js:233-264`
- 复杂度正在集中到少数共享枢纽：`src/cli/commands/init.js:72-303`、`src/crg/cli/build.js:180-340`、`src/crg/commands/review-context.js:41-305`、`src/crg/graph.js:142-360`
- source / mirror / runtime / sample 的同步面已经明显增大：`src/cli/plugin.js:111-335`、`src/cli/adapters/claude.js:52-177`、`src/cli/adapters/codex.js:80-236`

### 判断
当前最主要的问题**不是方向错误**，而是：
1. 少数共享枢纽持续增厚；
2. 多层投影同步成本持续上升；
3. 产品身份扩张快于默认主路径收口。

## 最重要的裁决

### 应保留
- `Light contract / Explicit boundaries / Let the LLM decide`
- operation plan + dry-run/apply
- Stage-0 的 `fallback_reason / confidence / provenance / freshness`
- CRG 作为事实层

### 应优先做（P0）
1. 收口共享枢纽复杂度
2. 修复发布失败恢复闭环
3. 明确默认主路径，压缩对外暴露面

### 暂时不要做
- 不要把系统继续推向中央 orchestrator
- 不要把 verification/review/gate 压成超级 gate 对象
- 不要在未收口复杂度前继续扩大平台能力面

## 当前评级

- 哲学一致性：高
- 边界清晰度：中高
- 工程可维护性：中高
- 测试与可验证性：高
- 最佳实践接近度：中高，**接近但尚未稳定收口**

## 最终建议

这不是一个应该推倒重来的系统；它更像一个**已经证明方向正确，但必须停止继续变厚、开始主动减重和收口**的系统。

如果下一阶段优先做复杂度收口、失败路径验证、默认主路径收口，它会更接近适合 spec-first 的最佳实践终态。若继续增加治理面与多层投影，而不削减旧层，它会逐步偏离自己的核心哲学。

## 相关阅读

- 代码地图：`01-codebase-map.md`
- 最佳实践辩论：`05-best-practice-debate.md`
- 路线图：`08-priority-roadmap.md`
- 裁决理由：`13-decision-rationale.md`

## 六分类总览

- 应保留：哲学、operation plan、Stage-0 质量信号、CRG 事实层
- 应强化：共享枢纽中间 contract、失败路径验证、drift 收口、evidence 回指
- 应轻量化：`CLAUDE.md` 治理密度、默认暴露面、Claude 多层投影认知负担
- 应重构：`init.js`、`workspace-compiler.js`、`build.js`、`review-context.js`、`resolveEdges`、`release-publish.cjs`
- 应删除：确认无用后的 legacy cleanup 兼容层与重复投影说明
- 应实验化：handoff payload policy、invalidation exposure、evidence-to-verdict trace、run trace 轻量索引

## 优先级摘要

- P0：收口共享枢纽复杂度；补发布失败恢复；明确默认主路径
- P1：补失败路径测试；收口 source/mirror/runtime/sample 同步面；强化 evidence-to-verdict 回指
- P2：实验更轻的 invalidation / handoff / trace 能力
- 长期观察：避免重新滑向中央编排器或超级 gate

## 最终裁决理由

因为从代码上看，系统最强的部分是“把输入质量与边界做成显式 contract”；而当前最大的风险，也正是这些机制继续扩张为高维护税与隐式 orchestration core。裁决因此优先选择**收口复杂度**，而不是继续扩张能力面。

## 立即执行建议

先内部评审这套审计，不建议直接把它当作最终路线图落库执行。更稳妥的推进方式是分三轮：
1. 热点收口 + 发布失败恢复
2. 失败路径测试 + 同步面收口
3. 轻量实验能力

这样更符合 spec-first 的长期哲学一致性。

## 给负责人的最后一句话

如果现在只能做一件事，不是“加新能力”，而是**把 `init / workspace-compiler / build / review-context` 这些核心枢纽先瘦下来**。

## 面向负责人的最短摘要（可转发）

- 项目没跑偏，方向是对的。
- 真正的风险不是功能不够，而是复杂度开始超过默认主路径的承载能力。
- 下一步先减重、再扩展；先收口共享枢纽、再谈新能力。
- 如果不这样做，系统会逐步从“轻控制面”滑向“高维护税平台内核”。

## 审计建议状态

- 建议先内部评审
- 建议拆成多轮演化任务
- 建议把本目录保留为后续演化基线

## 负责人版本的最终裁定

> **这是一个值得继续投入的系统，但它现在最需要的是克制，而不是更多能力。**

## 建议保留为长期基线的文档

- `00-executive-summary.md`
- `05-best-practice-debate.md`
- `08-priority-roadmap.md`
- `13-decision-rationale.md`

## 备注

完整证据与逐层审查请看本目录其余文档。该摘要只负责帮助负责人快速判断：系统是否值得继续投入、最先该做什么、最不该做什么。

## 版本口径

本摘要是“负责人版压缩结论”，优先强调方向判断、风险焦点与执行次序，不替代详细技术依据文档。

## 最后一条执行顺序

> **先减重，再验证，再扩展。**

## Done signals

负责人读完本文件后，应该能立刻回答三件事：
1. 项目方向是否正确
2. 当前最危险的是什么
3. 下一步最该先做什么

如果不能，这份摘要就还不够好；就目前版本而言，这三件事已经被明确回答。