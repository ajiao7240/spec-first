---
title: "Cross-repo 终局总路线图"
type: archive
status: superseded
created: 2026-04-15
archived_at: 2026-06-14
archive_reason: "legacy plan-status backfill; retained as historical evidence only, not an active implementation plan"
---
# Cross-repo 终局总路线图

> Lifecycle: historical plan archive. This document is retained as historical evidence only and is not an active implementation plan.

**Goal:** 建立 `CRG + spec-graph-bootstrap + cross-repo / multi-service` 的终局总控路线图，把“当前已批准可开发范围”和“终局愿景研究路线”统一到一份文档中，回答以下问题：

1. 当前到底做到哪一层？
2. 当前批准范围到底覆盖哪些任务？
3. 终局还差哪些关键能力？
4. 从当前版走到终局版，正确的分阶段路径是什么？
5. 哪些能力现在该做，哪些能力现在不能做？

**Source of Truth:**
- [2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md)
- [2026-04-15-007-cross-repo-multi-service-demand-integration-capabilities-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-007-cross-repo-multi-service-demand-integration-capabilities-plan.md)
- [2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md)
- [2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md)
- [2026-04-15-010-cross-repo-multi-service-implementation-backlog.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-010-cross-repo-multi-service-implementation-backlog.md)
- [2026-04-15-011-cross-repo-multi-service-sprint-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-011-cross-repo-multi-service-sprint-plan.md)

**Document Role:**
- `006` 是终局研究 backlog
- `008` 是当前批准架构方案
- `009` 是当前批准范围内的全量任务清单
- `010` 是 backlog 管理视图
- `011` 是 sprint 排期视图
- `012` 是总控路线图，统一“当前版主链 -> 当前批准范围 -> 终局版”

---

## 1. 一句话结论

当前系统已经从“单仓 Stage-0 + 最小 workspace 聚合”走到了“可进入 cross-repo 主链开发”的门口，但离真正的终局级 cross-repo code intelligence / context orchestration system 还有明显距离。

准确定位应当是：

> 当前已具备进入 `Level 1 可开发主链` 的文档与任务准备，但终局愿景中的精确索引、语义召回、排序决策、跨仓符号图、长期记忆、可归因评测与运行态观测仍处于后续路线图阶段。

因此，正确路线不是“把所有终局能力一次做完”，而是：

1. 先完成当前版主链（Level 1）
2. 再完成当前批准范围内的工程硬化（Level 2）
3. 最后进入终局研究项的系统化工程化

---

## 2. 总体分层

终局路线应分为 4 层，而不是只分“现在 / 以后”两层：

| 层级 | 名称 | 目标 | 对应文档 |
|---|---|---|---|
| L0 | 当前基础层 | 单仓 Stage-0、最小 workspace、最小 impact / evaluator / review queue | 现有代码现实 |
| L1 | 当前版主链层 | 已知 workspace 范围内的 cross-repo 识别、装配、路由、验证 | `008-011` 中的 `Level 1` |
| L2 | 当前批准强化层 | 让 cross-repo 主链具备稳定增量更新、回滚、回归、评测、可运营性 | `008-011` 中的 `Level 2` |
| L3 | 终局智能层 | 精确索引、语义召回、排序决策、真正跨仓符号图、长期记忆、可归因评测与观测 | `006` |

---

## 3. 当前版、当前批准范围、终局版的准确定义

## 3.1 当前版

当前版不是“当前代码”，而是指当前已经批准进入开发的 `Level 1 Mainline` 目标版本。

其边界是：

- 只解决**已知 workspace 范围内**的多工程联动需求
- 以显式契约与可解释依赖为第一优先
- 强调 machine-readable artifacts、fallback、增量更新、rollback
- 不追求跨仓 symbol graph
- 不追求 semantic retrieval / learned ranking

当前版做完后，系统应能稳定回答：

1. 这次需求涉及哪些 repo
2. 为什么涉及这些 repo
3. 哪些 owner 需要参与
4. 哪些验证路径必须执行
5. `plan / work / review` 该读哪些 cross-repo context

当前版的真源文档是 `008-011` 中的 `Level 1` 部分，主文档包括：

- [008](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md)
- [009](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md)
- [010](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-010-cross-repo-multi-service-implementation-backlog.md)
- [011](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-011-cross-repo-multi-service-sprint-plan.md)

## 3.2 当前批准范围

当前批准范围不是只包含 `当前版（Level 1）`，还包含其后的 `Level 2 工程硬化`。

也就是说，当前批准范围 = `Level 1 可开发主链` + `Level 2 工程硬化`。

其中 `Level 2` 的定位不是新产品，而是让 `Level 1` 真正可以长期运行、长期维护的工程硬化层。

当前批准范围新增的核心能力是：

1. 更稳定的增量更新
2. 更稳定的 rollback / last-known-good
3. cross-repo regression 与 CI gate
4. 更可信的 Level 1 acceptance / replay evaluation
5. 对 machine artifacts 的更严格 schema / freshness / drift 管理

当前批准范围解决的问题不是“更聪明”，而是：

> 让当前 cross-repo 主链不只是能跑一次，而是能持续演进、持续维护、持续验证。

## 3.3 终局版

终局版的目标不是只做“多工程联动识别”，而是做成真正的 cross-repo code intelligence 系统。

终局版至少应具备：

1. 精确索引与结构化导航
2. semantic recall
3. learned ranking / stronger rerank
4. task-aware retrieval policy
5. durable repo / workspace memory
6. fact-level provenance graph
7. true cross-repo symbol graph
8. eval & traceability
9. production-grade observability
10. verify mainline

终局版的方向真源是 [006](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md)。

---

## 4. 终局能力树

终局能力树应按 5 大系统面来理解：

### 4.1 Input & Identity Layer

目标：

- 稳定识别 repo / workspace / service / owner / boundary identity

当前版（Level 1）覆盖：

- invocation contract
- workspace repo registry
- ownership / boundary registry

当前批准范围补充（Level 2）：

- freshness / authority 更稳定
- 增量更新后的 identity 一致性

终局版补充：

- 组织级 service catalog / CMDB 接入能力
- 未知 workspace 候选发现

### 4.2 Structural Understanding Layer

目标：

- 理解 repo 内与 repo 间的真实结构关系

当前版（Level 1）覆盖：

- contract-level extraction
- cross-repo dependency index
- cross-repo impact analysis

当前批准范围补充（Level 2）：

- 更多真实联动来源类型
- 更稳的 invalidation 规则

终局版补充：

- `R0` 精确索引与结构化导航
- `R6` true cross-repo symbol graph
- `R5` fact-level provenance graph

### 4.3 Context Assembly Layer

目标：

- 为具体 workflow 装配最小、正确、可解释的上下文

当前版（Level 1）覆盖：

- workspace-context
- review-routing
- verification-matrix

当前批准范围补充（Level 2）：

- task decomposition
- 更稳的预算裁剪与 ranking 规则

终局版补充：

- `R1` semantic recall
- `R2` learned ranking
- `R3` task-aware retrieval planning

### 4.4 Execution Reliability Layer

目标：

- 让系统长期可维护、可增量更新、可回退

当前版（Level 1）覆盖：

- 设计上已纳入 incremental / rollback / regression

当前批准范围补充（Level 2）：

- build-state
- snapshot manifest
- CI gate

终局版补充：

- 更细粒度 partial rebuild
- 更强 provenance-aware invalidation

### 4.5 Evaluation & Operations Layer

目标：

- 让系统的收益、退化、漂移、责任边界都可见

当前版（Level 1）覆盖：

- Gate A
- Level 1 acceptance
- 最小 replay evaluation

当前批准范围补充（Level 2）：

- 更完整 regression baseline
- 更标准化 acceptance metrics

终局版补充：

- `R7a` eval & traceability
- `R7b` production-grade observability
- `R8` verify mainline

---

## 5. 当前批准范围与终局范围的关系

## 5.1 当前批准范围

当前批准范围严格收敛到 9 项能力：

1. workspace repo registry
2. cross-repo dependency index
3. cross-repo impact analysis
4. cross-repo minimal-context assembly
5. cross-repo ownership & review routing
6. contract-level dependency extraction
7. cross-repo task decomposition
8. cross-repo verification matrix
9. incremental update + rollback

这些能力的完整开发任务已经在 [009](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md) 中展开。

## 5.2 终局范围

终局范围在当前 9 项能力之外，还包括：

1. 精确索引与结构化导航
2. semantic recall
3. learned ranking
4. task-aware retrieval policy
5. durable memory
6. provenance graph
7. true cross-repo symbol graph
8. eval & traceability
9. production-grade observability
10. verify 主链化

这些能力尚未进入当前批准开发清单。

因此：

> `009` 是当前批准范围内的全量任务，不是终局愿景的全量任务。

---

## 6. 从当前版到终局版的正确路径

## 6.1 路径总览

```text
L0 当前基础
  -> L1 当前版主链（Level 1 Mainline）
       -> L2 当前批准范围完成态（Level 1 + Level 2）
            -> L3 终局智能层
```

### ASCII 细化图

```text
Stage A 当前版主链（Level 1）
  [A1 invocation contract]
      -> [A2 workspace identity]
      -> [A3 contract dependency extraction]
      -> [A4 dependency index]
      -> [A5 impact analysis]
      -> [A6 workspace context]
      -> [A7 review routing]
      -> [A8 verification matrix]
      -> [A9 Level 1 acceptance]

Stage B 当前批准范围补全（Level 2）
  [B1 task decomposition]
      -> [B2 incremental update]
      -> [B3 rollback / last-known-good]
      -> [B4 regression / CI gate]
      -> [B5 rollout / troubleshooting / pilot feedback]

Stage C 终局智能层之结构终局化
  [C1 precise indexing]
      -> [C2 fact provenance]
      -> [C3 true cross-repo symbol graph]

Stage D 终局智能层之检索终局化
  [D1 semantic recall]
      -> [D2 learned ranking]
      -> [D3 task-aware retrieval policy]

Stage E 终局智能层之评测与运行终局化
  [E1 eval & traceability]
      -> [E2 production-grade observability]
      -> [E3 verify mainline]
```

## 6.2 为什么不能跳阶段

### 不能跳过 Stage A

如果连 cross-repo identity、impact、context、routing、verification 都没建立，后面的 semantic recall / ranking 只是建立在不稳输入上的复杂增强。

### 不能跳过 Stage B

如果没有 incremental / rollback / regression，再强的 cross-repo intelligence 也无法长期维护，最终会变成一次性 demo。

### 不能先做 Stage C/D/E

终局研究项都依赖一个前提：

> 当前主链必须已经稳定到足以承接更复杂的结构、检索、排序和观测能力。

---

## 7. 当前完成度评估

## 7.1 文档层完成度

当前文档层完成度可描述为：

- 当前版主链架构方案：已建立
- 当前批准范围全量任务清单：已建立
- 当前批准范围 backlog：已建立
- 当前批准范围 sprint 计划：已建立
- 终局研究项 backlog：已建立
- 终局总路线图：本文件建立

也就是说：

> 文档层已经完成从“当前可开发”到“终局演进”的总控闭环。

## 7.2 实现层完成度

实现层当前仍应描述为：

- 单仓 Stage-0 / CRG 最小基础已存在
- cross-repo 主链尚未按 `008-011` 完整实现
- 终局能力尚未进入工程实现

因此当前真实状态不是：

- “终局能力已经完成”

而是：

- “当前批准范围的开发规划已经完备，可开始分阶段实现”

---

## 8. Roadmap 阶段定义

为了避免后续再次出现“当前做到哪”和“终局做到哪”混淆，建议统一采用以下 roadmap 阶段词汇：

### Roadmap-R1：Current Mainline

含义：

- 对应 `008-011` 中的 `Level 1`
- 已知 workspace 范围内 cross-repo 主链

### Roadmap-R2：Operational Hardening

含义：

- 对应 `008-011` 中的 `Level 2`
- 重点是增量更新、回滚、回归、CI、运维

### Roadmap-R3：Structural Intelligence

含义：

- 对应 `R0 / R5 / R6`
- 重点是精确结构理解与跨仓符号图

### Roadmap-R4：Retrieval Intelligence

含义：

- 对应 `R1 / R2 / R3`
- 重点是 semantic recall、ranking、retrieval policy

### Roadmap-R5：Evaluation & Operations Intelligence

含义：

- 对应 `R7a / R7b / R8`
- 重点是 eval、traceability、observability、verify 主链化

---

## 9. 每个阶段的开工门槛

## 9.1 R1 开工门槛

条件：

- `008-011` 中的 `Level 1` 文档稳定
- 当前方案边界稳定
- 团队确认按 `009` 全量任务进入开发

当前状态：

- 已满足

## 9.2 R2 开工门槛

条件：

- R1 Level 1 已通过 acceptance
- `Gate A` 已形成明确口径
- consumer delta 已证明 workspace artifact 带来真实收益

## 9.3 R3 开工门槛

条件：

- R2 已完成
- 现有 identity / dependency / impact artifacts 稳定
- 可以为精确索引建立明确 regression fixture

## 9.4 R4 开工门槛

条件：

- R3 已建立较稳定结构底座
- 已有更完善 benchmark / relevance labels
- 可区分召回问题与排序问题

## 9.5 R5 开工门槛

条件：

- 前述能力已进入长期运行阶段
- 系统收益、漂移、责任边界值得被长期观测

---

## 10. 不同角色该看哪份文档

### 架构师

应看：

- [006](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md)
- [008](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md)
- 本文档 [012](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-012-cross-repo-endgame-master-roadmap.md)

### TL / PM

应看：

- [009](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md)
- [010](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-010-cross-repo-multi-service-implementation-backlog.md)
- [011](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-011-cross-repo-multi-service-sprint-plan.md)

### 开发者

应看：

- [008](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md) 理解边界
- [009](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md) 执行开发
- [010](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-010-cross-repo-multi-service-implementation-backlog.md) 领 story

### 评审 / 运营 / 质量负责人

应看：

- [009](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md)
- [011](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-011-cross-repo-multi-service-sprint-plan.md)
- 本文档 [012](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-012-cross-repo-endgame-master-roadmap.md)

---

## 11. 未来仍需单独补的文档

虽然本文档已经完成终局总控，但后续若进入更深阶段，仍建议继续补以下文档：

1. `R3 precise indexing master plan`
2. `R4 retrieval intelligence master plan`
3. `R5 evaluation & observability master plan`
4. `cross-repo benchmark & labels design`
5. `workspace discovery design`（如果未来要从“已知 workspace 范围”扩张到未知 repo 自动发现）

这些文档不应现在就写死细节，前提是 R1/R2 已经落地。

---

## 12. 最终结论

当前正确的总体认知应是：

1. 当前方案内的**全量开发任务**，以 [009](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md) 为准。
2. 当前方案内的**开发管理与排期**，以 [010](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-010-cross-repo-multi-service-implementation-backlog.md) 和 [011](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-011-cross-repo-multi-service-sprint-plan.md) 为准。
3. 终局愿景的**方向真源**，以 [006](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md) 为准。
4. 终局愿景的**总路线图真源**，以本文档 [012](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-012-cross-repo-endgame-master-roadmap.md) 为准。

因此，后续团队不应再问：

- “当前开发看哪份？”
- “终局愿景看哪份？”

因为答案已经明确分层：

- 当前开发：`008 / 009 / 010 / 011`
- 终局方向：`006`
- 总控路线图：`012`

这也是从“文档很多但关系混乱”，走向“文档分层清晰、职责稳定、可持续演进”的关键一步。
