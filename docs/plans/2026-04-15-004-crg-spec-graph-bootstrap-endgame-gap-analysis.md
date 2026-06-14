---
title: "CRG + spec-graph-bootstrap 终局级差距清单"
type: archive
status: superseded
created: 2026-04-15
archived_at: 2026-06-14
archive_reason: "legacy plan-status backfill; retained as historical evidence only, not an active implementation plan"
---
# CRG + spec-graph-bootstrap 终局级差距清单

> Lifecycle: historical plan archive. This document is retained as historical evidence only and is not an active implementation plan.

## 1. 文档目标

本文档回答的不是“当前有没有代码”，而是：

> 以终局级、业界高标准的代码库理解与上下文分发系统为目标，当前 `CRG + spec-graph-bootstrap` 还差什么？

本文件是：

- 终局差距盘点文档
- 下一轮 `P4` 规划的架构基线

本文件不是：

- 直接可执行的实施计划
- 对当前实现价值的否定
- 无边界的研究愿望清单

审视范围以当前代码为准，重点覆盖：

- `src/crg/`
- `skills/spec-graph-bootstrap/`
- `src/bootstrap-compiler/`
- `src/context-routing/`
- `benchmarks/`

---

## 2. 判定口径

本文件统一使用四层完成度口径，避免把“模块存在”误说成“系统完成”。

### 2.1 四层完成度口径

#### Level 1：模块实现

定义：

- 代码文件已存在
- 单元测试或样例已存在
- 模块可被直接调用

但不代表：

- 已进入默认执行路径
- 已形成系统闭环

#### Level 2：主链接入

定义：

- 已被真实主执行链调用
- 不依赖测试专用入口
- 能在默认运行路径中产出结果

#### Level 3：质量门接入

定义：

- 已被 benchmark / regression / CI gate 约束
- 演进时有可度量的回归保护

#### Level 4：终局级能力

定义：

- 不仅进入主链和质量门
- 还具备足够的算法强度、治理闭环、可观测性和长期演进能力

### 2.2 关键结论

对当前系统，必须明确区分三句话：

1. `P1-P3` 相关代码资产已基本覆盖
2. `P1-P3` 相关能力并未全部进入系统主链
3. 当前系统距离终局级仍有明显差距

如果不区分这三句话，后续 `P4` 会持续把“补模块”和“补系统”混在一起。

---

## 3. 当前代码状态总览

### 3.1 分层判断

| 能力域 | 模块实现 | 主链接入 | 质量门接入 | 当前判断 |
|---|---|---|---|---|
| Stage-0 contract + evaluator | 是 | 是 | 仅 unit 守卫 | 已形成当前稳定底座 |
| `plan/work/review` minimal-context | 是 | 是 | 仅 unit 守卫 | 已形成消费闭环 |
| CRG generation + retrieval + chunk persistence | 是 | 是 | 否 | 已接主链，但算法仍弱 |
| bootstrap compiler 三层拆分 | 是 | 否 | 否 | 还是模块，不是统一 pipeline |
| freshness / lint / contradictions | 是 | 否 | 否 | 还是编译子模块，不是默认产物链 |
| workflow telemetry | 是 | 否 | 否 | 还是 helper，不是默认运行行为 |
| repo QA / context efficiency / regression | 是 | 否 | 否 | 还是脚本，不是 gate |
| workspace context | 是 | 否 | 否 | 还是聚合 helper，不是 workspace-native 主链 |
| ownership / review-queue | 是 | 否 | 否 | 还是治理骨架，不是治理流程 |

### 3.2 当前更准确的总体判断

当前系统已经不再只是 `P0`，但也不能简单说“P1-P3 在系统层完全完成”。

更准确的表达是：

> 当前 `P1-P3` 的代码资产已基本覆盖；其中一部分能力已进入当前主链，另一部分仍停留在模块级或脚本级；质量门与治理闭环尚未完成。

### 3.3 当前已经进入主链的关键能力

当前已进入主链的关键能力主要包括：

- Stage-0 contract + deterministic evaluator
- `plan/work/review` 的 minimal-context 选择与消费
- `CRG` 构建中的 chunk 持久化
- `crg context` / `review-context` 对 retrieval API 的调用

对应代码：

- [evaluator.js](/Users/kuang/xiaobu/spec-first/src/context-routing/evaluator.js)
- [build.js](/Users/kuang/xiaobu/spec-first/src/crg/cli/build.js)
- [context.js](/Users/kuang/xiaobu/spec-first/src/crg/cli/context.js)
- [review-context.js](/Users/kuang/xiaobu/spec-first/src/crg/commands/review-context.js)
- [api.js](/Users/kuang/xiaobu/spec-first/src/crg/retrieval/api.js)

### 3.4 当前还没有进入主链的关键能力

当前虽然已经存在模块，但尚未系统接入默认执行链的能力包括：

- compiler 三层编排
- freshness / lint / contradictions
- workflow telemetry
- workspace context
- ownership / review-queue
- repo QA / context efficiency / regression gate

这些能力当前更像：

- 模块库
- 工具脚本
- 后续接入点

还不是：

- 系统默认行为
- 强制质量门
- 长期治理流程

---

## 4. 为什么当前还不能称为终局级系统

当前系统已经具备：

- 能运行
- 能测试
- 能演进

但还不具备：

- 完整主链
- 强算法
- 强评测
- 强治理
- 强运行闭环

因此当前状态的正确定位应是：

> 已完成计划内的最小闭环建设，但尚未完成终局级系统化强化。

---

## 5. 第一类差距：已接主链，但强度仍然偏弱

这类能力不是“没有”，而是“已经在用，但还不够强”。

### 5.1 Retrieval 仍然只是 heuristic v1

当前实现：

- [api.js](/Users/kuang/xiaobu/spec-first/src/crg/retrieval/api.js)
- [seed.js](/Users/kuang/xiaobu/spec-first/src/crg/retrieval/seed.js)
- [expand.js](/Users/kuang/xiaobu/spec-first/src/crg/retrieval/expand.js)
- [rerank.js](/Users/kuang/xiaobu/spec-first/src/crg/retrieval/rerank.js)
- [pack.js](/Users/kuang/xiaobu/spec-first/src/crg/retrieval/pack.js)

当前能力：

- lexical seed
- changed-file seed
- candidate-test seed
- graph expansion
- heuristic rerank
- 简单 token budget pack

主要不足：

- 没有 query intent classification
- 没有 task-aware retrieval planning
- 没有 lexical / graph / semantic 的统一 score fusion
- 没有 profile-aware learned ranking
- 没有 retrieval feedback loop

结论：

> 当前是可运行的 retrieval v1，不是终局级 retrieval system。

### 5.2 Semantic rerank 还只是 placeholder enhancement

当前实现：

- [semantic-rerank.js](/Users/kuang/xiaobu/spec-first/src/crg/retrieval/semantic-rerank.js)

当前本质：

- query token overlap 加分

主要不足：

- 没有 embedding recall
- 没有 vector index
- 没有 cross-encoder rerank
- 没有 semantic cache
- 没有 model fallback 策略

结论：

> 当前是 semantic placeholder，不是语义检索层。

### 5.3 Chunking 仍然只是 symbol-split v1

当前实现：

- [chunking.js](/Users/kuang/xiaobu/spec-first/src/crg/chunking.js)

当前本质：

- 先按 symbol
- 超长 symbol 再按固定行数切块

主要不足：

- 没有 block-aware chunking
- 没有 statement-aware chunking
- 没有 language-aware chunking
- 没有 chunk overlap / merge policy
- 没有 parent-child retrieval packing 策略

结论：

> 当前是可用的 chunking v1，不是高质量代码理解 chunker。

---

## 6. 第二类差距：模块已实现，但没有进入系统主链

这类能力是下一阶段必须优先收口的对象，因为它们最容易造成“看起来很多，系统里却没真正生效”的假完成状态。

### 6.1 Compiler 三层拆分还没有收口成统一 bootstrap pipeline

当前实现：

- [compile-machine-artifacts.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/compile-machine-artifacts.js)
- [compile-human-assets.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/compile-human-assets.js)
- [compile-routing.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/compile-routing.js)

当前状态：

- 模块存在
- 单测存在
- contract 可对齐

但当前不是：

- 统一 orchestrator
- 默认 bootstrap 执行路径
- deterministic end-to-end pipeline

缺失的系统动作包括：

- machine artifacts 编译
- human assets 编译
- routing 编译
- manifest 回写
- freshness/lint/contradictions 回写
- backup / restore / rollback
- telemetry / audit 输出

### 6.2 Freshness / Lint / Contradictions 还不是默认编译产物链

当前实现：

- [freshness.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/freshness.js)
- [lint.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/lint.js)
- [contradictions.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/contradictions.js)

问题不在于“没有模块”，而在于：

- 没有被统一 bootstrap 主链默认产出
- 没有被 workflow 消费链显式使用
- 没有进入 CI / regression gate

### 6.3 Telemetry 还不是默认 workflow 行为

当前实现：

- [telemetry.js](/Users/kuang/xiaobu/spec-first/src/context-routing/telemetry.js)

当前状态：

- 能写 telemetry 文件
- 有最小测试

但当前缺失：

- 默认接入 `spec-plan`
- 默认接入 `spec-work`
- 默认接入 `spec-code-review`
- 聚合分析与趋势统计

结论：

> 当前有 telemetry 模块，不等于已有 telemetry 闭环。

### 6.4 Workspace context 还是 helper，不是 workspace-native 主链

当前实现：

- [workspace-loader.js](/Users/kuang/xiaobu/spec-first/src/context-routing/workspace-loader.js)
- [workspace-compiler.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/workspace-compiler.js)

当前状态：

- 能加载多个 repo 的 Stage-0 结果
- 能做基础聚合

但当前缺失：

- 默认 workflow 使用
- workspace-level retrieval profile
- workspace-level benchmark
- workspace-level regression gate

### 6.5 Ownership / Review Queue 还是治理骨架，不是治理流程

当前实现：

- [ownership.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/ownership.js)
- [review-queue.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/review-queue.js)

当前状态：

- 能附加 owner / reviewer / last_verified
- 能生成 review queue 条目

但当前缺失：

- owner registry
- SLA
- queue lifecycle
- triage workflow
- resolution write-back

### 6.6 Benchmark / Regression 还是脚本，不是 gate

当前实现：

- [run-review-benchmark.js](/Users/kuang/xiaobu/spec-first/benchmarks/review/run-review-benchmark.js)
- [run-repo-qa.js](/Users/kuang/xiaobu/spec-first/benchmarks/repo-qa/run-repo-qa.js)
- [run-context-efficiency.js](/Users/kuang/xiaobu/spec-first/benchmarks/context-efficiency/run-context-efficiency.js)
- [run-regression.js](/Users/kuang/xiaobu/spec-first/benchmarks/regression/run-regression.js)

当前问题：

- 未进入 `package.json` 的标准 gate
- 未进入 pre-merge
- 未进入 release gate
- baseline 还没有治理流程

结论：

> 当前是“可运行脚本”，不是“强制质量门”。

---

## 7. 第三类差距：必须做的 P4 能力与后续研究能力没有切开

这一类问题不是“缺模块”，而是“缺范围边界”。如果不切开，P4 会无限膨胀。

### 7.1 P4 必做项

以下能力应进入 `P4`，因为它们是把“模块集合”变成“系统”的必要条件：

- 统一 bootstrap compiler pipeline
- 将 freshness / lint / contradictions 接入默认编译链
- 将 telemetry 接入默认 workflow 链
- 将 benchmark / regression 接入标准 gate
- 建立真实 e2e 闭环
- 建立治理最小流程
- 明确 `verify` 是否进入范围

### 7.2 H2 / H3 研究项

以下能力重要，但不应在 `P4` 里与主链收口抢优先级：

- vector recall
- cross-encoder rerank
- query understanding / query rewrite / retrieval planning
- durable repo memory
- fact-level provenance graph
- historical knowledge memory
- 真正的 cross-repo symbol graph
- production-grade observability platform

结论：

> P4 必须先解决“系统化落地”，而不是先进入“大而全的研究路线”。

---

## 8. `verify` 的范围决策

`verify` 当前仍然只是 reserved contract，不应默认进入本轮 `P4`。

当前仅有：

- [profiles.js](/Users/kuang/xiaobu/spec-first/src/context-routing/profiles.js) 中的 `verify-default` 占位

当前仍缺：

- `minimal-context/verify.json`
- verify workflow consumer
- verify-specific benchmark
- verify-specific routing policy
- verify-specific regression threshold

### 8.1 当前建议

在 `P4` 中：

- 保持 `verify` contract 占位
- 不进入默认交付范围

### 8.2 未来进入实现范围的前提

只有同时满足以下条件，`verify` 才应进入单独 implementation unit：

1. 已定义 verify workflow consumer
2. 已定义 verify 需要的 selected assets
3. 已定义 verify benchmark cases
4. 已定义 verify regression threshold

---

## 9. 终局成功指标

当前文档如果不补量化指标，就无法判断“P4 是否完成”。因此这里先定义一版 `P4` 的最低成功指标。

| 指标 | 当前状态 | P4 最低目标 | 证明方式 |
|---|---|---|---|
| bootstrap 主链编排覆盖率 | compiler 模块存在，但未统一接主链 | `100%` 由统一 bootstrap pipeline 产出 machine artifacts / human assets / routing | integration / e2e |
| workflow telemetry 覆盖率 | 有模块，无默认接入 | `plan/work/review` 三条默认路径 `100%` 产 telemetry artifact | integration |
| benchmark gate 覆盖率 | 有脚本，无 gate | 对触达 `src/crg/`、`src/context-routing/`、`src/bootstrap-compiler/`、`skills/spec-graph-bootstrap/`、`skills/spec-plan/`、`skills/spec-work/`、`skills/spec-code-review/` 的 PR，`100%` 触发 repo QA + context efficiency + regression | CI |
| review benchmark average hit rate | smoke 级，仍偏低基线 | `>= 0.75` | benchmark runner |
| repo QA average hit rate | smoke 级，样本太少 | `>= 0.70` | benchmark runner |
| context efficiency average irrelevant ratio | 仍未形成 gate | `<= 0.35` | benchmark runner |
| fallback rate | 当前未形成系统观测 | 在 reference integration fixtures 中 `<= 0.10` | telemetry + integration |
| e2e 主链闭环 | 当前主要依赖 unit tests | 至少覆盖 `bootstrap -> workflow consumption -> benchmark/regression` 的真实链路 | e2e |

说明：

- 以上不是终局最终值，而是 `P4` 的最低可接受门槛
- 若达不到这些门槛，不应宣称 `P4` 完成

---

## 10. P4 阶段排序原则

### 10.1 正确排序

下一阶段不应继续沿用“先做更强检索，再补更强评测”的顺序。

更合理的顺序应是：

1. `P4-A 主链收口`
2. `P4-B Eval & Gate`
3. `P4-C Retrieval v2`
4. `P4-D Governance & Workspace`

### 10.2 排序理由

#### 先主链收口

如果主链不收口，新增能力会继续停留在“模块存在但系统不使用”的状态。

#### 再做 Eval & Gate

如果没有足够可靠的 benchmark / regression gate，就没有资格推进 Retrieval v2，因为根本无法证明“更复杂的算法真的更好”。

#### 然后才做 Retrieval v2

Retrieval v2 是高不确定度项，必须在已有 gate 保护下推进。

#### 最后做 Governance & Workspace

治理和跨仓能力需要建立在单仓主链和质量门已经稳定的前提下，否则会把系统复杂度过早抬高。

---

## 11. P4 阶段合同

### 11.1 P4-A 主链收口

**目标**

- 把 compiler / freshness / lint / contradictions / telemetry 接入默认主链

**范围**

- 统一 bootstrap compiler orchestrator
- default output contract 收口
- workflow 默认 telemetry 接入
- 失败路径与恢复路径明确化

**必须接入的位置**

- `skills/spec-graph-bootstrap/`
- `.spec-first/workflows/bootstrap/<slug>/`
- `docs/contexts/<slug>/`
- `spec-plan / spec-work / spec-code-review` 默认预载链

**必须新增的测试**

- bootstrap integration
- output determinism
- telemetry integration
- failure / rollback integration

**退出条件**

- 单次真实 bootstrap 运行能稳定生成统一产物链
- workflow 默认运行会产 telemetry
- 缺失 asset / stale / contradictions 都能进入标准产物链

**非目标**

- vector retrieval
- cross-repo graph
- 高阶 observability 平台

### 11.2 P4-B Eval & Gate

**目标**

- 把 benchmark / regression 从脚本提升为质量门

**范围**

- 扩 review / repo QA / context efficiency 数据集
- 接入标准 script
- 接入 CI / pre-merge / release gate
- baseline 治理流程化

**必须接入的位置**

- `package.json`
- CI pipeline
- regression baseline 管理路径

**必须新增的测试**

- benchmark smoke + integration
- gate wiring tests
- baseline drift tests

**退出条件**

- 相关 PR 默认触发 gate
- baseline 有明确更新规则
- 第 9 节中的最低指标达到

**非目标**

- 新算法本身
- workspace 扩展

### 11.3 P4-C Retrieval v2

**目标**

- 在 gate 保护下升级检索强度

**范围**

- 更强 lexical + graph fusion
- query planning
- language-aware chunking
- optional semantic enhancement

**必须接入的位置**

- `crg context`
- `crg review-context`
- 后续 workflow 共享 retrieval API

**必须新增的测试**

- retrieval benchmark delta
- no-regression checks
- chunk quality tests
- query planning tests

**退出条件**

- 至少一个核心 benchmark 显著优于 `P4-B` 基线
- 不允许 context efficiency 明显恶化
- 不允许 regression gate 失守

**非目标**

- durable repo memory
- full vector platform
- production observability service

### 11.4 P4-D Governance & Workspace

**目标**

- 在单仓主链稳定后，补齐最小治理流程与 workspace 扩展

**范围**

- ownership registry 最小形态
- review queue lifecycle 最小形态
- stale / contradiction triage 流程
- two-repo workspace integration
- workspace benchmark

**必须接入的位置**

- bootstrap outputs
- governance queue artifacts
- workspace compiler / loader

**必须新增的测试**

- governance integration
- queue lifecycle tests
- workspace integration
- workspace benchmark smoke

**退出条件**

- stale / contradiction 能进入可处理队列
- two-repo workspace 可运行且单仓行为不退化
- workspace benchmark 达到最低阈值

**非目标**

- 真实 cross-repo symbol graph
- 多团队生产级协作平台

---

## 12. 最关键的终局缺口

综合来看，当前最关键的差距不是“少某个算法点”，而是以下四项：

1. 主链没有完全收口
2. 质量门没有形成
3. 检索能力虽已接入，但仍然偏弱
4. 治理与 workspace 还停留在骨架阶段

换句话说，下一阶段的核心任务不是“继续多写模块”，而是：

> 把已有能力接成系统，并让系统能够被测量、被约束、被治理。

---

## 13. 结论

当前系统不是“没做完”。

当前系统真正的问题是：

> 计划内的最小闭环已经做完，但终局级系统化强化还没做完。

因此后续不应继续沿用“零散扩模块”的方式推进，而应明确进入：

> `P4：主链收口 -> Eval & Gate -> Retrieval v2 -> Governance & Workspace`

只有完成这四步，系统才会从：

- 有模块
- 有测试
- 能运行

真正进入：

- 有强主链
- 有强质量门
- 有强检索能力
- 有强治理闭环
