---
title: "CRG + spec-graph-bootstrap 终局研究项 Backlog"
type: archive
status: superseded
created: 2026-04-15
archived_at: 2026-06-14
archive_reason: "legacy plan-status backfill; retained as historical evidence only, not an active implementation plan"
---
# CRG + spec-graph-bootstrap 终局研究项 Backlog

> Lifecycle: historical plan archive. This document is retained as historical evidence only and is not an active implementation plan.

## 1. 文档定位

本文档回答的问题不是：

- `005` 计划内任务有没有做完
- 当前代码能不能继续演进
- 还要不要再补一些零散 feature

本文档回答的问题是：

> 如果标准不是“本轮计划交付完成”，而是“是否已经达到终局级、业界高标准、长期可演进的代码库理解与上下文分发系统”，那么还缺哪些真正值得单独立项的研究项？

因此，本文档是：

- `004` 的终局差距清单在“研究 backlog”层的收口版
- `005` 完成之后的下一阶段候选路线图
- 后续是否继续进入更高阶算法与系统治理建设的决策基线

本文档不是：

- 本轮 `P4` 的继续开发清单
- 可以立即无条件开工的实现计划
- 为了显得先进而堆砌概念的愿望单

---

## 2. 当前系统的准确定位

基于当前代码实现，系统的状态应当表述为：

> `CRG + spec-graph-bootstrap` 已完成本轮必须完成的主链收口、最小质量门、Retrieval v2 最小增强、治理最小闭环与 e2e 验证；但距离“终局级、业界强系统”仍有一批高不确定度、高投入、需要单独评测与数据闭环支撑的研究项尚未进入实现。

这句话很重要，因为它把三件事分开了：

1. 本轮计划交付是否完成
2. 当前系统是否可用、可维护、可迭代
3. 当前系统是否已经达到终局级

当前结论是：

- `005` 计划内 must-have 基本已完成
- 当前系统已经具备工程闭环，不再只是“模块存在”
- 但还没有达到终局级

未达到终局级，不是因为基础工程没做，而是因为以下几类能力仍停留在“下一阶段研究项”。

---

## 3. 什么才算“终局研究项”

不是所有没做的事情，都有资格被称为“终局研究项”。

只有同时满足以下条件的缺口，才进入本文档：

1. 不是简单补漏，而是会改变系统能力上限。
2. 不是只改一个模块，而是会影响 retrieval、routing、benchmark、governance 或 workspace 的系统设计。
3. 不能只靠直觉上线，必须先定义数据、评测口径和回归保护。
4. 做得对，会显著提升代码库理解质量、上下文命中率、长期可维护性或跨仓扩展能力。
5. 做得不对，会明显引入过度设计、复杂度爆炸或“看起来高级但无法验证”的风险。
6. 必须能被默认 workflow 稳定消费，而不是只在额外命令、演示入口或专家模式下存在。
7. 必须能以可维护、可增量更新、可回滚的方式落地，而不是依赖全量重建或一次性离线计算。

因此，本文档中的项都不应被混入日常修补或本轮增量开发中。

---

## 4. 总体判断

终局研究项可以归为七大主研究方向，外加一个平台补全项：

1. 精确索引与结构化导航升级：从当前最小图与启发式结构理解，升级到更稳定的 symbol / reference / dependency navigation 基座。
2. 检索召回层升级：从 heuristic / hybrid v2，升级到真正的 semantic-hybrid retrieval。
3. 排序决策层升级：从规则型 rerank，升级到 cross-encoder / learned ranking。
4. 任务理解与检索规划升级：从最小 query-plan，升级到 task-aware retrieval policy。
5. 长期记忆与证据图升级：从单次构建产物，升级到 durable memory 与 fact provenance。
6. 跨仓与工作区理解升级：从 workspace v1，升级到真正的 cross-repo symbol graph。
7. 反馈闭环升级：从离线 benchmark + 最小 telemetry，升级到可归因的评测追踪与最终的 production-grade observability。
8. 平台能力补全：把 `verify` 从 reserved contract 升级为正式主链能力。

其中，第一类决定“结构理解底座”，第二三类决定“检索质量上限”，中间两类决定“系统理解深度”，其后两类决定“长期演进上限”，最后一类决定“平台能力边界是否完整”。

---

## 5. 终局研究项总表

| 研究项 | 当前状态 | 为什么不是本轮 must-have | 终局目标 | 建议优先级 |
|---|---|---|---|---|
| R0 精确索引与结构化导航 | 已有 CRG / chunk / retrieval 最小闭环，但 symbol/reference/navigation 仍偏轻量 | 当前主链刚收口，仍缺更强结构索引 contract 与回归集 | 形成稳定 symbol identity、definition/reference、dependency/navigation 基座 | 极高 |
| R1 语义召回与向量索引 | 仅 lexical + graph + heuristic fusion | 缺数据、缺指标、缺召回质量基线 | 形成 semantic-hybrid retrieval 主召回层 | 高 |
| R2 Cross-encoder / Learned Ranking | 仅 score breakdown + heuristic rerank | 缺训练/标注集，直接做风险高 | 排序结果显著优于启发式规则 | 高 |
| R3 Task-aware Query Planning | 仅最小 intent classification | 还没有足够稳定的 profile/任务数据 | 根据 plan/work/review/qa 自动决定检索策略 | 中高 |
| R4 Durable Repo Memory | 当前只保留当前构建期产物 | 时序记忆很容易膨胀和漂移 | 形成跨构建、跨变更周期的长期知识记忆 | 中 |
| R5 Fact-level Provenance Graph | 当前是 artifact 级/文件级 contract | 事实粒度会显著放大复杂度 | 任一结论都能追溯到事实来源与时间版本 | 中高 |
| R6 True Cross-repo Symbol Graph | 当前 workspace v1 仍以单仓不退化为先 | 多仓图若过早做，会先把单仓系统拖垮 | 实现跨仓依赖、调用、 ownership 和上下文联合推理 | 中高 |
| R7a Eval & Traceability | 当前仅有 benchmark gate + 最小 telemetry | 还不能稳定区分召回、排序、routing、pack 的责任边界 | 形成可归因、可比较、可回退的实验级评测追踪系统 | 极高 |
| R7b Production-grade Observability | 当前缺长期 drift、在线反馈和运行态观测 | 线上观测体系成本高、边界复杂，本轮不应直接建设 | 形成“能观测、能解释、能优化”的运行系统 | 中高 |
| R8 Verify 主链化 | 当前保留 reserved contract | consumer、benchmark、routing 尚未齐备 | 让 verify 成为正式消费链的一部分 | 中 |

---

## 6. 逐项说明

### R0. 精确索引与结构化导航

#### 6.0 当前状态

当前系统已经具备：

- CRG build 与 retrieval 最小主链
- changed-files / graph expansion / chunking 的基本能力
- fact inventory / risk signals / test surface 等机器产物

但当前仍不应被视为“精确索引系统”。

它更接近：

- 面向 workflow 的最小结构理解层
- 能支撑当前 retrieval v2 的轻量图底座

而不是：

- 稳定的 symbol identity 层
- 精确的 definition / reference / dependency navigation 层
- 可长期演进的跨工具统一索引层

#### 6.1 终局能力目标

终局应做到：

- 稳定 symbol identity，不因路径、名称变化轻易漂移
- 提供 definition / reference / import / call / dependency 的更精确导航
- 支持 retrieval、review、impact、workspace 共用同一结构索引底座
- freshness、增量更新、fallback 和 contract 长期稳定
- 小改动只触发局部索引更新，而不是每次全仓重建

换句话说，终局不是“图更多”，而是：

> 让结构索引成为 retrieval、routing、review 和 workspace 的可靠真源之一。

#### 6.2 为什么比 R1 更早

因为如果结构索引层不稳，后续很多高级能力都会建立在不稳底座上：

- semantic recall 很难知道该召回到哪一层粒度
- rerank 很难利用稳定的结构特征
- cross-repo symbol graph 会过早复杂化
- provenance 会因为底层 identity 漂移而失真

业界更稳的路径普遍是：

- 先建立稳定的代码结构与导航索引
- 再叠加 semantic recall、ranking 与 agent orchestration

#### 6.3 开工前置条件

- 明确 symbol / module / file 三层 identity contract
- 明确 definition/reference/import/call 的最小准确性要求
- 为结构索引建立 regression fixtures 与 freshness 口径
- 明确索引缺失时 retrieval / review 的保守 fallback
- 明确局部文件变更时的增量更新路径、失效范围和 rebuild 边界

#### 6.4 建议顺序

这是最应该优先补齐的研究项之一，优先级不低于任何 semantic 强化。

---

### R1. 语义召回与向量索引

#### 6.1 当前状态

当前 `src/crg/retrieval/` 已具备：

- lexical seed
- changed-file seed
- graph expansion
- heuristic rerank
- 最小 query_plan

这使系统已经从“纯静态规则检索”升级为“可运行的 hybrid v2 最小版”，但本质仍然偏规则驱动。

#### 6.2 终局能力目标

终局应达到：

- 支持 embedding-based recall
- 支持 lexical / graph / semantic 三路召回融合
- 支持不同任务类型的召回权重切换
- 对长尾描述性问题、抽象问题、跨文件语义问题有更稳定召回

换句话说，终局目标不是“加一个 embedding 字段”，而是：

> semantic recall 成为系统主召回层之一，而不是点缀性加分项。

#### 6.3 为什么不在本轮做

原因很明确：

- 当前 benchmark 仍偏小，不足以稳妥衡量 semantic recall 的真实收益
- 没有 embedding index 生命周期治理方案
- 没有 chunk 粒度、更新频率、索引回收、成本控制的系统设计
- 在没有召回基线前直接做向量化，极易出现“复杂度上升，但收益不可证”的情况

#### 6.4 开工前置条件

- 扩充 repo QA / review benchmark，增加语义型问题集
- 明确 chunk 粒度策略与 embedding 更新策略
- 明确单仓与 workspace 的索引隔离策略
- 为 recall 命中率、漏召率、成本引入指标
- 明确 embedding / chunk 索引的增量刷新与过期回收策略

#### 6.5 建议顺序

应在 R0 与 R7a 之后推进，而不是脱离底座单独起飞。

---

### R2. Cross-encoder / Learned Ranking

#### 6.1 当前状态

当前 rerank 已有：

- 启发式 score fusion
- score_breakdown 可审计输出
- 最小解释性

但这仍然不是“强排序系统”，只能算“可解释的规则排序系统”。

#### 6.2 终局能力目标

终局应达到：

- 候选集先经粗召回
- 再经更强的 pairwise / listwise rerank
- 能对 query 与 chunk / symbol / fact 的匹配做更深层判断
- 能根据 profile、任务类型、代码变更语境进行排序修正

#### 6.3 为什么不在本轮做

主要不是技术做不到，而是工程前提不成立：

- 没有足够的排序标注集
- 没有稳定的 offline relevance labels
- 没有线上反馈闭环
- 没有区分“召回问题”和“排序问题”的评测框架

如果直接做，最后很容易变成：

- 模型更复杂
- 可解释性更差
- 结果未必更稳

#### 6.4 开工前置条件

- 对 benchmark 增加 top-k relevance 标注
- 明确候选集固定策略，避免召回与 rerank 混淆
- 增加 NDCG / MRR / Recall@K 等指标
- 建立可回退的 A/B 或 offline compare 机制
- 明确 rerank 模型替换时的版本管理、回滚与兼容策略

#### 6.5 建议顺序

应排在 R1 之后紧接推进，因为没有更强召回层，强 rerank 价值会被上游瓶颈限制。

---

### R3. Task-aware Query Planning

#### 6.1 当前状态

当前已经有最小版 `query-plan.js`，能做基本 intent classification，并把结果暴露给 retrieval。

这已经比“完全无任务规划”更进一步，但仍然非常保守，更多是：

- 分类
- 打标签
- 轻量影响策略

还不是“任务级检索规划器”。

#### 6.2 终局能力目标

终局应做到：

- 对 `plan / work / review / repo-qa / debug / onboarding` 等任务做差异化检索规划
- 决定 seed 策略、扩图深度、rerank 配置、pack 策略
- 对 query 不完整、变更范围很大、问题描述偏抽象时进行 query rewrite / decomposition
- 输出稳定、可验证的 retrieval policy

#### 6.3 为什么不在本轮做

因为现在还缺：

- 足够大的任务类型 benchmark
- 不同 profile 的真实失败样本
- query planner 自己的评测标准

在这些前提不足时，把 planner 做复杂，只会把系统调试难度显著拉高。

#### 6.4 开工前置条件

- 扩充带任务标签的数据集
- 增加 retrieval policy 对结果的影响评估
- 定义 planner 的 contract 与 fallback 规则
- 明确 planner 出错时的保守降级路径
- 明确 planner 策略更新时如何避免对既有 workflow 造成大面积行为漂移

#### 6.5 建议顺序

放在 R1/R2 之后更合理，因为 planner 的价值建立在召回和排序的可调性之上。

---

### R4. Durable Repo Memory

#### 6.1 当前状态

当前系统的强项是：

- 当前仓库构建期产物稳定
- 当前 bootstrap / CRG / context routing 链路已闭环

但它还不是长期记忆系统。当前更接近：

- 当前快照理解
- 当前产物消费
- 当前构建期上下文分发

#### 6.2 终局能力目标

终局应做到：

- 记住过去构建得到的高价值稳定事实
- 记住历史问题、常见坑、长期 ownership 变化
- 记住“哪些结论经常被用到、哪些结论经常失效”
- 让下一轮 bootstrap / retrieval 能利用历史积累，而不是每次只看当前快照

#### 6.3 为什么不在本轮做

因为 repo memory 是最容易过度设计的区域之一。

它的典型风险是：

- 什么都存，最后全是噪音
- 没有失效机制，旧事实污染新判断
- 没有优先级模型，记忆越多越不准

#### 6.4 开工前置条件

- 明确 memory 的对象边界：存 symbol、fact、decision 还是 incident
- 明确 TTL / freshness / invalidation 策略
- 明确 memory 对 retrieval 和 routing 的接入点
- 为记忆命中率、错误记忆率、失效记忆率定义指标
- 明确 memory 写入、压缩、清理与迁移策略，避免长期维护失控

#### 6.5 建议顺序

不建议过早推进。优先级低于 R1/R2/R7。

---

### R5. Fact-level Provenance Graph

#### 6.1 当前状态

当前系统已经有：

- fact inventory
- risk signals
- test surface
- artifact manifest
- context routing contract

但当前结论大多还是“产物级可解释”，不是“事实级可追溯”。

#### 6.2 终局能力目标

终局应做到：

- 任意一个风险判断、上下文选择、review 建议，都能回溯到具体 fact
- fact 带有来源、提取时间、版本、置信度
- 多来源 fact 之间可做冲突处理与证据合并
- 系统能回答“为什么你得出这个结论”

#### 6.3 为什么不在本轮做

这类能力会显著放大数据模型复杂度：

- schema 层级会变深
- 事实数量会暴涨
- 更新、去重、冲突解决会变得复杂
- 消费端也要相应升级

如果没有明确的 explainability 需求与基准问题集，过早引入非常容易失控。

#### 6.4 开工前置条件

- 明确 provenance 最小粒度
- 明确哪些消费路径必须使用 provenance
- 定义冲突归并规则
- 明确 storage / query / update 成本预算
- 明确 provenance 数据在 schema 演进时的兼容与迁移策略

#### 6.5 建议顺序

应作为中后期研究项，不建议早于 R1/R2/R7。

---

### R6. True Cross-repo Symbol Graph

#### 6.1 当前状态

当前 workspace v1 的方向是正确的，但其设计边界也非常明确：

- 先保证单仓不退化
- 先交付 workspace 最小闭环
- 不在本轮提前引入复杂多仓图联邦

这说明当前 workspace 还只是“为未来跨仓能力打底”，不是“真正的跨仓图理解系统”。

#### 6.2 终局能力目标

终局应做到：

- 多仓符号、依赖、接口、调用关系可联合检索
- ownership、review queue、dependency boundary 可跨仓联动
- 能识别“改动仓 A，会影响仓 B/C 的哪些接口与测试面”
- 多仓上下文能被 plan / review / debug 统一消费

#### 6.3 为什么不在本轮做

因为多仓系统复杂度极高，且非常容易先伤害单仓系统：

- repo identity 与 slug 管理会复杂化
- graph merge / namespace / symbol collision 要处理
- 更新成本和索引一致性会显著变难
- 一旦主链不稳，问题排查成本会直线上升

#### 6.4 开工前置条件

- 单仓 benchmark 与 gate 长期稳定
- workspace v1 在多个样例仓上被验证
- 明确 cross-repo identity / symbol namespace / dependency schema
- 明确跨仓检索的预算与上限
- 明确多仓局部变更时的增量同步模型，避免任一仓变更触发全局重算

#### 6.5 建议顺序

优先级高于 durable memory，但应晚于 R1/R2/R7。

---

### R7a. Eval & Traceability

#### 6.1 当前状态

当前已经有：

- workflow telemetry
- review / repo-qa / context-efficiency / regression gate
- baseline update script
- CI quality gate

这已经构成“离线质量门 + 最小观测”的闭环，但还没有形成真正可归因的实验系统。

但它还不是生产级 observability。当前还缺：

- 更细粒度的 query / retrieval / routing / pack 事件观测
- 长期 drift 归因
- benchmark 结果与真实运行场景的关联分析
- 反馈回流机制

#### 6.2 终局能力目标

终局应做到：

- 任一失败都能分层定位：召回问题、排序问题、pack 问题还是 routing 问题
- 能对不同 profile、query 类型、repo 类型输出可比较实验结果
- 能支撑 retrieval / ranking / planning 的小步实验与快速回退
- benchmark、telemetry、回归 gate 口径统一

#### 6.3 为什么应该先于 R1/R2 明确

因为如果没有可归因的评测追踪系统：

- 你无法知道问题在召回、排序还是 pack
- 你无法知道某次 semantic 强化是否真的提升
- 你无法知道不同 repo / workflow 的退化发生在哪一层

所以它不是“大平台建设”，而是：

> 后续所有终局能力能否被理性推进的实验底座。

#### 6.4 开工前置条件

- 定义 retrieval / ranking / routing / pack 的事件模型
- 为 query 类型、profile、repo 类型建立最小分层指标
- 明确 offline benchmark 与 telemetry 的映射关系
- 明确 traceability 的最小输出 contract 与数据保留边界
- 明确 trace 数据的采样、裁剪与保留策略，保证长期维护成本可控

#### 6.5 建议顺序

这是最应该优先启动的研究项之一，应和 R0 同一优先级看待。

---

### R7b. Production-grade Observability

#### 6.1 当前状态

当前仍缺：

- 长期 drift 观测
- 真实运行态反馈回流
- 长周期性能 / 成本 / 退化趋势分析
- 更接近平台运行层的观测设施

#### 6.2 终局能力目标

终局应做到：

- 能看见随时间变化的 drift
- 能识别某类 query、某类仓库、某类工作流的系统性退化
- 能将观测结果回流到 benchmark、planner、ranking、memory 的优化闭环

#### 6.3 为什么不在本轮做

因为 production observability 不是“多记几行日志”。

它需要：

- 事件模型
- 采样策略
- 指标设计
- 成本约束
- 异常归因方法

如果没有清晰边界，很容易把系统变成日志堆场。

#### 6.4 开工前置条件

- 明确核心观测对象与事件层级
- 明确离线与在线指标的映射关系
- 明确日志保留策略与敏感信息边界
- 为 drift / regression / failure attribution 定义统一模型
- 明确 observability 基础设施的运维成本边界，避免平台化过早失控

#### 6.5 建议顺序

它应晚于 R0、R7a、R1、R2。当前阶段不应先做大平台。

---

### R8. Verify 主链化

#### 6.1 当前状态

当前 `verify` 仍然是 reserved contract，不纳入本轮默认 consumer、routing、benchmark 和 regression。

#### 6.2 终局能力目标

终局应做到：

- `verify` 成为正式 workflow profile
- evaluator、selected assets、telemetry、benchmark、gate 全链路识别 `verify`
- 对验证型任务有独立的 context selection 与质量目标

#### 6.3 为什么不在本轮做

这不是因为 verify 不重要，而是因为：

- 当前 verify 的消费语义还未冻结
- 没有 verify benchmark
- 没有 verify profile 的 selected assets 合约

如果现在直接接入，只会让主链复杂化，而验证价值仍不可度量。

#### 6.4 开工前置条件

- 明确定义 verify 的任务边界
- 明确定义 verify 需要的资产集合
- 增加 verify 质量评测样本
- 把 verify 纳入 regression baseline
- 明确 verify profile 新增后对既有 consumer、routing、telemetry 的兼容策略

#### 6.5 建议顺序

中优先级。它更像“平台能力补全项”，而不是算法上限项。

---

## 7. 正确的优先级顺序

如果以后继续向终局推进，建议顺序不是“哪里看起来先进就先做哪里”，而是：

1. `R0 精确索引与结构化导航`
2. `R7a Eval & Traceability`
3. `R1 语义召回与向量索引`
4. `R2 Cross-encoder / Learned Ranking`
5. `R3 Task-aware Query Planning`
6. `R6 True Cross-repo Symbol Graph`
7. `R5 Fact-level Provenance Graph`
8. `R8 Verify 主链化`
9. `R4 Durable Repo Memory`
10. `R7b Production-grade Observability`

这个顺序的逻辑是：

- 先解决“结构理解底座是否稳定”
- 再解决“怎么验证提升”
- 再解决“怎么真正提升检索质量”
- 再解决“怎么把提升扩展到跨任务、跨仓与更深解释”
- 最后再处理最容易失控的长期记忆与生产级大平台

---

## 8. 什么不该现在做

为了避免过度设计，以下做法当前都不合理：

1. 在没有更强 benchmark 和观测系统前，直接引入复杂 embedding / rerank 栈。
2. 在没有更强结构索引 contract 前，直接把 semantic retrieval 当成第一优先级。
3. 在单仓主链还刚收口时，直接做多仓图联邦与全局 symbol graph。
4. 在没有失效机制前，先做大而全 repo memory。
5. 在没有 provenance 真实消费方前，先把事实模型复杂化到不可维护。
6. 在没有 verify benchmark 前，把 verify 接入默认主链并声称完成。

这些都属于“看起来更强”，但不一定“工程上更正确”。

---

## 9. 对当前团队的实际建议

如果目标是“继续稳步走向终局”，而不是“继续堆功能”，更合理的策略是：

1. 先把当前 `005` 已交付能力继续稳定一段时间，观察 benchmark 与 regression 是否持续稳定。
2. 下一轮应优先立 `R0 + R7a` 的研究计划，先把结构索引与实验归因底座做强。
3. 在 `R0 + R7a` 稳定后，再进入 `R1 + R2`，而不是直接上大而全 semantic 栈。
4. 不要把 `R3-R7b` 一起并入下一轮开发计划，应按前置条件成熟度拆分立项。
5. 所有研究项都必须先定义“成功怎么量化”，再开始实现。

---

## 10. 研究项统一准入门槛

为了避免“研究项越做越大，最后脱离默认工作流”，后续任何新研究项进入实现前，都必须同时满足以下准入门槛：

1. `workflow fit`：必须说明将接入哪个默认 workflow，以及如何被默认消费。
2. `fallback safety`：必须说明能力缺失、索引失败、结果异常时如何保守降级。
3. `latency / token / cost budget`：必须给出预算上限，不能无限扩张。
4. `eval contract`：必须给出成功指标、回归指标和 failure attribution 口径。
5. `adoption simplicity`：不能要求用户新增高频复杂命令，复杂性应优先藏在系统内部。
6. `incremental update`：必须说明哪些数据支持局部更新、哪些场景必须全量重建，以及对应触发条件。
7. `maintainability`：必须说明 schema 演进、版本兼容、数据迁移、索引清理和回滚方案。

---

## 11. 最终结论

“终局研究项”不是指当前系统还有一些小缺陷没补，而是指：

> 那些会显著提高 `CRG + spec-graph-bootstrap` 能力上限，但也会显著提升系统复杂度，因此必须在数据、评测、治理和主链稳定的前提下，单独作为下一阶段研究计划推进的能力域。

结合当前代码实现，终局研究项主要就是十类：

- `R0` 精确索引与结构化导航
- `R1` 语义召回与向量索引
- `R2` Cross-encoder / Learned Ranking
- `R3` Task-aware Query Planning
- `R4` Durable Repo Memory
- `R5` Fact-level Provenance Graph
- `R6` True Cross-repo Symbol Graph
- `R7a` Eval & Traceability
- `R7b` Production-grade Observability
- `R8` Verify 主链化

其中真正最值得优先投入的，不是“记忆”或“多仓炫技”，而是：

- 更强的结构索引底座
- 更强的实验评测与归因闭环
- 更强的召回层
- 更强的排序层

这三项决定后续所有终局能力是不是有真实收益。
