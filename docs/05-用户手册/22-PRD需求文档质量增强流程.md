# PRD 需求文档质量增强流程

本页总结 `$spec-prd` 面向粗 PRD、超大需求文档和多来源材料时的目标工作方式。它对应当前 `spec-prd` 需求质量增强方案：把 `grill-with-docs` 的 source-first、术语校准、场景压力测试、代码矛盾核对和决策闭环能力前置到需求文档阶段，让后续 `spec-plan`、task pack 和 `spec-work` 消费更稳定的 WHAT/WHY 输入。

> 注意：本页描述的是用户手册层面的流程意图和设计边界。具体可用行为以当前版本的 `skills/spec-prd/` source、生成后的宿主 runtime 和 release notes 为准。

## 设计思想与思路

这套流程的出发点是：研发质量很大程度取决于输入质量。一个 PRD 如果在用户、目标、范围、术语、现有系统行为、异常、验收和决策后果上含糊，后续 plan、task 和实现就会被迫补 WHAT，导致返工、误实现或 review 时才发现需求不稳。

设计上遵循五个原则。

### 1. 模拟资深 PM / 架构师理解需求的过程

人类理解复杂需求时，通常不是读完就写方案，而是先判断材料质量，再抽事实、查证据、归类冲突、确认关键问题，最后重写成稳定需求。流程中的 `Sanitization`、`Preliminary Diagnosis`、`Map-Reduce`、`Deep Requirements Grill` 和 `Final Readiness Diagnosis` 对应的就是这个过程。

它关注的不是“摘要得更短”，而是“能不能让后续研发不再猜”。

### 2. 渐进明细，而不是固定大模板

PRD 输入有大小和风险差异。小而清晰的系统增量不应该被重流程拖慢；超大、多来源、冲突多的需求文档也不能靠一句 summary 糊过去。因此流程使用 Progressive Detail Ladder：

- 小需求停在 L0 compact PRD。
- 有少量不确定性时进入 shared understanding map。
- 超大或多来源材料才进入 Map-Reduce。
- 只有影响 planning invention 的问题才触发 P0/P1 packs。
- 超过 3 个 load-bearing gaps 时输出 blocker cluster，而不是长访谈。

这让流程按风险展开，而不是按模板展开。

### 3. 证据优先，owner 只裁决真正需要人的问题

`grill-with-docs` 的重要思想是：能从代码库回答的问题，就不要问用户。`spec-prd` 继承这个原则，把 source/docs/tests/contracts/prior PRDs/context/ADR 都当作 evidence candidates。

代码负责回答“当前系统是什么”；owner 负责回答“目标行为应该是什么”。LLM 负责判断差异是否会影响 PRD 和 planning readiness。这个分工避免让脚本做语义裁决，也避免让用户回答已经能从仓库确认的事实。

### 4. Deep Grill 前置到需求阶段

`grill-with-docs` 原本用于 stress-test plan 和领域语言。这里把它前置到需求文档阶段，因为术语、场景、代码矛盾和 owner 决策如果等到 planning 或实现阶段才发现，成本更高。

深度集成保留方法，不复制节点：

- 一次只问一个问题。
- 每个问题给 recommended answer 和后果。
- 挑战 glossary 冲突和模糊词。
- 用具体场景压测边界。
- 对照代码暴露矛盾。
- 把决议落回 PRD section。

这样做的目标是把需求文档“烤熟”，再交给后续流程。

### 5. PRD-local closure 优先，知识晋升 preview-first

`CONTEXT.md` 和 ADR 很适合沉淀稳定术语与难逆决策，但如果把它们变成每个 PRD 的默认输出，会制造第二真相源和不必要的写入副作用。

所以这里采用 adapter 思路：

- 已有 `CONTEXT.md` / `CONTEXT-MAP.md` / ADR 先作为 evidence。
- 本轮 PRD 的术语和决策先在 PRD-local sections 闭环。
- 只有稳定术语或 hard decision 满足晋升条件时，才生成 preview-first promotion candidate。
- 不 silent write，不把 context/ADR 设为 readiness 前置条件。

这兼顾了短期 PRD 质量和长期知识沉淀。

## 解决什么问题

很多研发返工不是因为 plan 不会拆任务，而是因为 PRD 还没把关键 WHAT 说清楚：

- 谁是目标用户、操作者、受益方和下游消费者不清楚。
- 需求描述和现有代码、文档、测试或历史 PRD 矛盾。
- 超大文档里同一个功能散落在多个章节，重复、冲突和例外被摘要丢掉。
- 术语模糊，例如“账户”“订单”“取消”“审批”在不同上下文里含义不同。
- 权限、状态、异常、负向验收、发布切片和 owner 决策没有闭环。

目标是在需求文档阶段把这些 load-bearing gaps 解决或显式暴露，而不是让 `spec-plan` 或实现阶段替 PRD 发明产品行为。

## 完整流程

```text
粗 PRD / draft / 会议记录 / 截图 / PDF / 多来源材料
  -> PRD Sanitization
  -> Problem / Outcome Framing
  -> Source-first Evidence Calibration
  -> Preliminary Diagnosis
  -> Progressive Detail Ladder
  -> optional Large-input Map-Reduce
  -> Deep Requirements Grill
  -> Context / ADR Topology Adapter
  -> PRD Rewrite
  -> Final Readiness Diagnosis
  -> Handoff
```

### 1. PRD Sanitization

先把输入里的内容分开：

- 产品事实、目标、范围和验收。
- 技术建议和实现 HOW。
- 未确认 claim、临时结论、冲突说法。
- 嵌入在文档里的 agent 指令、shell 命令或 workflow 指令。

PRD 只承载产品 WHAT/WHY、current-state evidence、acceptance 和 scope boundary。实现 HOW 进入后续 plan/work。

### 2. Problem / Outcome Framing

确认需求不是一串功能清单，而是能回答：

- 哪类用户或角色遇到什么问题？
- 期望产生什么可观察结果？
- 哪些行为、权限、状态或验收会因此变化？

如果缺少目标用户、产品问题、系统锚点或核心场景，应该路由回 `$spec-brainstorm`，而不是硬写 PRD。

### 3. Source-first Evidence Calibration

在问 owner 之前，先查可验证证据：

- 代码、测试、contracts、README、docs。
- 既有 PRD、历史 plan、domain glossary、ADR 或类似决策记录。
- 当前系统入口、权限模型、状态机、异常处理和已存在限制。

代码和文档提供 current-state evidence，不自动决定目标行为。目标行为仍由 owner/PRD 决定。

### 4. Preliminary Diagnosis

Preliminary Diagnosis 只决定“要展开到哪一层”，不等于最终 `ready-for-planning`。

它判断：

- 是否已有产品/系统锚点。
- 是否是小而清晰的 compact PRD。
- 是否需要超大文档 Map-Reduce。
- 哪些 P0/P1 packs 被触发。
- 是否要 route-out 或输出 blocker cluster。

最终能否进入 planning，只能在 rewrite 后由 Final Readiness Diagnosis 判断。

## Progressive Detail Ladder

流程按风险渐进展开，避免所有 PRD 都走最重路径。

| Level | 触发 | 停止条件 | 输出 |
| --- | --- | --- | --- |
| L0 compact PRD | 输入小、锚点清楚、证据足够 | 不会让 planning 发明 WHAT | compact PRD |
| L1 shared understanding map | claim 需要对齐 evidence/gap/write target | gap 已解决、假设化或升级 | run-local shared understanding |
| L2 large-input Map-Reduce | 超大、多来源或无法整体可靠判断 | reduced candidates 保留 source refs 和 conflicts | run-local Map/Reduce 结果 |
| L3 P0 packs | problem/outcome、metric、NFR、trace、owner closure 会影响 planning | P0 gap 已闭环或显式阻塞 | PRD-local core sections |
| L4 P1 packs | actor/design/release/change-management 信号明确且有后果 | conditional detail 被捕获或延后 | PRD-local conditional sections |
| L5 blocker cluster / route-out | 超过 3 个 load-bearing gaps 或缺系统/产品锚点 | route 明确且不输出 ready | blockers、assumptions、affected write targets |

## 超大文档的 Map-Reduce

超大需求文档不能只做“分段摘要再拼接”。摘要容易丢掉 source refs、例外、矛盾和术语漂移。Map-Reduce 用来先把证据归约成可判断输入，再进入深度澄清。

```text
Map row:
  source_ref / claim / actor / flow / state / gap /
  confidence / write_target_candidate

Reduce output:
  canonical_requirement / supporting_refs / conflicts /
  assumptions / load_bearing_gap / owner_question_candidate /
  affected_write_targets
```

Map 负责从 chunk 里抽取需求原子并保留来源。Shuffle 按 actor、flow、feature、data、state、permission、exception、PRD section 和 source contradiction 聚组。Reduce 合并重复、保留冲突，并输出 blockers、assumptions、owner questions 和 PRD write targets。

这些都是 run-local scratch，不是持久 schema、JSON contract 或新 artifact。

## Deep Requirements Grill

Deep Requirements Grill 是 `grill-with-docs` 思想在需求文档阶段的适配。它不是 PRD 写完后的 review，而是 rewrite 前确认 shared understanding。

核心动作：

- source/code-first：能从代码、docs、tests、contracts 回答的问题，不问 owner。
- one question at a time：一次只问一个 load-bearing 问题。
- recommended answer：每个问题都尽量给推荐答案、理由和后果。
- glossary challenge：发现术语与现有 glossary 或代码用法冲突时立即指出。
- fuzzy term sharpening：把“账户”“订单”“审批”等模糊词锐化为 canonical term。
- scenario stress：用具体 actor、flow、state、exception、permission 场景压测边界。
- code contradiction：用户说法和现有代码冲突时，要求明确以哪个为准。
- decision closure：owner answer 必须落回 PRD section，而不是停留在聊天里。

正常 PRD run 的 owner 问题上限是 1-3 个。超过 3 个 load-bearing gaps 时，输出 prioritized blocker cluster、推荐下一 route、accepted assumptions 和 affected write targets，不标记 `ready-for-planning`。

## Context / ADR Topology Adapter

`grill-with-docs` 默认会围绕 `CONTEXT.md`、`CONTEXT-MAP.md` 和 `docs/adr/` 沉淀领域语言与决策。`spec-prd` 可以集成这套拓扑，但不是把它变成每个 PRD 的必填产物。

集成方式：

- 已存在 `CONTEXT.md`、`CONTEXT-MAP.md` 或 `docs/adr/**` 时，作为 source-first evidence 读取。
- PRD 内先闭环：术语写入 `Glossary`，决策写入 `Decision Notes` / `Evidence And Assumptions` / `Scope Boundaries`。
- 稳定项目术语满足条件时，生成 preview-first context promotion candidate。
- hard decision 同时满足 hard-to-reverse、surprising without context、real trade-off 时，生成 preview-first ADR promotion candidate。
- 不 silent write，不把 `CONTEXT.md`/ADR 创建设为 PRD readiness 前置条件。

如果 topology 不存在，PRD 仍然可以完成；缺 topology 是 degraded/no-op，不是失败。

## Final Readiness Diagnosis

PRD rewrite 后再判断是否可以进入 planning：

- actor、flow、state、exception、permission、scope、acceptance 是否闭环。
- load-bearing questions 是否由 source、owner answer、accepted assumption、Outstanding Question 或 blocker cluster 处理。
- planning 是否仍需要发明 WHAT。
- P0/P1 触发项是否已解决、假设化或显式阻塞。

只有当 `spec-plan` 不再需要补产品行为时，才能 `ready-for-planning`。

## 使用建议

- 小而清晰的需求：停在 L0 compact PRD，不强制重流程。
- 多来源或超大文档：先做 Map-Reduce，再做 Deep Requirements Grill。
- source 能回答的问题：不要问 owner。
- owner 问题超过 3 个：不要继续长访谈，输出 blocker cluster。
- 术语或决策可沉淀时：先 PRD-local closure，再 preview-first 提出 context/ADR promotion。

这套流程的价值是让需求文档先“变硬”：证据来源、术语、场景、冲突、假设和决策后果都进入 PRD，再交给 planning 和实现。它提升的不是单个 PRD 的字数，而是后续研发链路的输入质量。
