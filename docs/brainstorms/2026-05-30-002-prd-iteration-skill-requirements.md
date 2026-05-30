---
date: 2026-05-30
author: leokuang
topic: prd-iteration-skill
spec_id: 2026-05-30-002-prd-iteration-skill
artifact_kind: prd-requirements
status: superseded
superseded_by: docs/brainstorms/2026-05-30-003-spec-prd-owner-final-requirements.md
superseded_note: "本文是决策稿 + H1-H7 夯实输入。最终需求以 003 为准；003 已落地全部 H1-H7 裁决(code-align 降级、shared gate 抽取、tie-break、App audit 边界、瘦身至 R1-R41)。仅作历史决策证据,不再作为 planning source。"
source_inputs:
  - docs/brainstorms/2026-05-30-001-prd-skill-requirements.md
  - docs/业界分析/14.prd-skill-竞品分析-2026-05-30.md
  - external-local: claude-skills/prd-generator/SKILL.md
  - external-local: claude-skills/competitive-analysis/SKILL.md
  - skills/spec-brainstorm/SKILL.md
  - skills/spec-brainstorm/references/requirements-capture.md
  - skills/spec-plan/references/graph-evidence-posture.md
  - docs/contracts/graph-evidence-policy.md
  - docs/02-架构设计/需求拆分/大需求拆分.md
---

# 增量需求迭代 PRD Skill 最终需求文档

## Summary

最终决策：新增 1 个公开 workflow skill，命名为 `spec-prd`。`spec-brainstorm` 继续定位为 0-1 想法探索、问题定义和 WHAT shaping；`spec-prd` 定位为已有系统上的增量需求迭代 PRD 输出，负责把一句话增量需求、已有 PRD 或产品想法，结合当前代码和业务流程现状，整理成可交给 `spec-plan` 的 Markdown PRD-grade requirements。

首版不新增多个 PRD skill，不新增独立 agent。`create`、`refine`、`validate`、`code-align` 作为 `spec-prd` 内部 intent；Current-state analysis、domain lenses、PRD 模板、readiness gate 扩展放在 `references/` 中按需加载。后续只有当实际 eval 证明某类判断反复失真时，才新增内部 reviewer agent。

### Decision Snapshot

| Decision | Final answer |
| --- | --- |
| 是否扩展 `spec-brainstorm` | 不作为主方案；`spec-brainstorm` 保持 0-1 / WHAT shaping |
| 是否新增 skill | 是，新增 `spec-prd` |
| 新增几个公开 skill | 1 个 |
| 是否拆 create/refine/validate | 不拆，作为 `spec-prd` 内部 intent |
| 是否新增 agent | v1 不新增 |
| 最终 PRD artifact 放哪里 | 继续放 `docs/brainstorms/*-requirements.md`，用 `artifact_kind: prd-requirements` 标识 |

### Synthesis With Claude Analysis

`docs/brainstorms/2026-05-30-001-prd-skill-requirements.md` 给出的最强反方结论是：`spec-brainstorm` 已覆盖 create/refine 的基础链路，新增 `spec-prd` 可能引入入口治理成本、多真相源、重复 readiness gate 和证据词表分叉。这个判断成立，必须被吸收为 `spec-prd` 的边界约束。

本最终稿仍决策新增 `spec-prd`，原因是用户目标已经从“通用 brainstorm 能力增强”收敛为“已有系统上的增量需求迭代 PRD 输出”。这不是 0-1 产品探索，也不是简单需求捕获，而是一个面向产品 owner 的独立体验：先结合代码看懂现状，再确认增量，最后交付 Markdown PRD。若继续把它压进 `spec-brainstorm`，短期少一个入口，长期会让 brainstorm 同时承担 0-1 探索、PRD 写作、代码现状复原和 PRD 质量检查四类职责，边界更隐蔽。

对 Claude 分析指出的四个风险，`spec-prd` v1 的约束如下：

| Claude 风险 | 本稿吸收方式 |
| --- | --- |
| 多真相源 | 不新增 `docs/prds/`，继续产出 `docs/brainstorms/*-requirements.md`；`artifact_kind: prd-requirements` 只是 additive 标识 |
| 重复 readiness gate | 复用 `requirements-capture.md` 的 Requirements Readiness Gate，只增加 PRD-specific lens |
| 证据词表分叉 | PRD evidence tags 必须映射到 `graph-evidence-policy.md` 的 confirmed/session-local/advisory/stale 与 spec-plan 四轴，不另造独立权威体系 |
| 入口增殖 | 只新增 1 个公开 skill；create/refine/validate/code-align 只是内部 intent，不再拆分 |

---

## 本轮夯实（2026-05-30，决策不翻，只收紧）

> **立场**：owner 已在本文 §Synthesis 中看过 `001` 的反方分析、选定候选 1（新增 `spec-prd`）、并给出收敛理由（用户目标已从"增强 brainstorm"转为"已有系统上的增量需求迭代 PRD"）。本轮**不重开 candidate 1 vs 2**。下列 7 点是对**选定方向**的对抗性夯实——挖出 `002` 自身尚未解决的硬问题，把被 `Resolve Before Planning: None` 掩盖的真决策翻出来。

| # | 弱点 | 性质 | 处置 |
|---|---|---|---|
| H1 | **与 `spec-app-consistency-audit` 的边界未解决**。该 skill 已吃 `prd:<path>` + source root，对 App 的 PRD↔Figma↔源码做一致性 lens(架构/组件/analytics/i18n)。`spec-prd` 的 App lens(R23)与它有真实重叠面。`002` 只说"不复用其重型 artifact spine",回避了"App PRD 现状对齐到底走哪个"。 | 产品边界决策，非 planning 细节 | **升级为 Resolve Before Planning（见下）** |
| H2 | **R29 "复用 Requirements Readiness Gate" 未定复用方式**。该 gate 物理位于 `spec-brainstorm/references/requirements-capture.md`。`spec-prd` 复用有三条互斥路径(跨 skill 读 / 抽到 `docs/contracts/` 共享 / 复制一份)，每条对 source/runtime 边界、是否改动 brainstorm、是否多真相源影响不同。`002` 标"复用"但没选路径。 | 架构决策，非 planning 细节 | **升级为 Resolve Before Planning（见下）** |
| H3 | **路由 tie-break 缺失**。brainstorm 的 `description` 当前泛化命中 "feature ideas / what should we build / vague feature request"。"给订单加取消功能"这类输入**同时**像 brownfield 增量(→spec-prd)和 feature idea(→brainstorm)。`002` 的 R6/AE2 假设边界清晰，但没给二者都像时的 tie-break，撞 `using-spec-first` 硬规则 1(不靠关键词路由、routing 冲突)。 | 路由决策 + 可能改 brainstorm description | **升级为 Resolve Before Planning（见下）** |
| H4 | **`code-align` 是分类错误**。create/refine/validate 是"输入状态"维度；code-align 是"是否结合代码"维度。而 R7 已规定 current-state analysis **对所有场景无条件必做**——所以 code-grounding 是贯穿全部 intent 的 **posture，不是并列的第四 intent**。并列会让 LLM 困惑"何时选 code-align vs create"。 | 结构修正 | Intent Model 表已加注（见该表） |
| H5 | **40 条 requirement 触发 size 红线**。`requirements-capture.md` size heuristic 明写"超过 ~15-20 要停下来问是不是多个需求"。`002` 有 R1-R40。其中 R33-R36(SKILL.md 精简/用 references/v1 不加 agent)是**实现纪律，不是产品 requirement**，应下沉 Implementation Direction，不占 R 号；R22-R28 七条 lens 可合并表述。 | 过度规格化，违 light contract | §Requirement 分层说明（见下）给出瘦身映射，交 plan 执行 |
| H6 | **External Research 未吸收 `001` 的 curl 一手证据**。`001` 已 curl 核验出强支撑本决策的外部事实，`002` 的 External Research 仍是老四样。 | 增强（强化本决策） | §外部证据补强（见下） |
| H7 | **无可度量成功标准**。Success Criteria 全定性，模板里有 Success Metrics 但本文自身没有可观测指标证明 `spec-prd` 真比 brainstorm 强。 | 补缺 | §Success Criteria 补一条 advisory metric |

---

## 20 轮调研与决策收敛

| 轮次 | 调研问题 | 证据输入 | 决策影响 |
| --- | --- | --- | --- |
| 01 | 用户真实需求是 PRD 写作，还是需求探索？ | 用户明确区分 `spec-brainstorm` 0-1 与新增增量需求迭代 PRD skill | 拆出 `spec-prd`，不继续把 `spec-brainstorm` 做重 |
| 02 | 三个输入场景是否同属一个产品形态？ | 已有 PRD 完善、一句话增量需求、想法澄清后输出 PRD | 同属 PRD-grade output，一个 workflow 内部多 intent |
| 03 | 是否需要多个公开 skill？ | BMAD 类 workflow 倾向一个入口内处理 Create/Update/Validate | 首版只新增 1 个公开 skill |
| 04 | `spec-brainstorm` 现状边界是什么？ | `skills/spec-brainstorm/SKILL.md` 明确其回答 WHAT、轻量 repo scan | 保持 brainstorm 轻量，避免职责膨胀 |
| 05 | 现有 requirements 模板是否足够？ | `requirements-capture.md` 已有 R/A/F/AE、readiness gate | 复用 requirements spine，只加 PRD-specific sections |
| 06 | 差异化是否来自 PRD 模板？ | PRD generator、ChatPRD、Nimbalyst、Aha、Productboard 都有模板/问答 | 差异化不做“更长模板”，做 code-aware current-state |
| 07 | 没有历史需求库时如何补上下文？ | GitNexus facts、direct source reads、docs/solutions、代码路径 | 用代码和图谱重建当前系统逻辑 |
| 08 | GitNexus 可以当 confirmed truth 吗？ | `graph-evidence-policy.md` 与当前 graph facts 为 dirty-advisory | 只能作为 pointer，关键 claim 必须 source read 确认 |
| 09 | PRD 是否应写实现方案？ | spec-first 链路中 `spec-plan` 负责 HOW | PRD 禁止 implementation units、文件计划、schema 设计 |
| 10 | 增量 PRD 与计划拆分的关系？ | `docs/02-架构设计/需求拆分/大需求拆分.md` 提出 PRD Iteration + Code-aware Mode | `spec-prd` 产出 Standard PRD / Delta / Code Alignment，后续由 `spec-plan` 消费 |
| 11 | 是否新建 `docs/prds/`？ | 当前链路消费 `docs/brainstorms/*-requirements.md` | 首版仍写 `docs/brainstorms/`，用 `artifact_kind` 标识 PRD |
| 12 | 端类型是否需要独立 skill？ | App/Admin/Backend/CLI 关注点差异明显，但入口拆分会增加选择负担 | 用 domain lens reference，不拆多个 skill |
| 13 | 是否需要 agent？ | `skill-creator` 原则要求 SKILL.md 精简，复杂内容放 references；agent 有维护成本 | v1 不新增 agent，先用 references + eval |
| 14 | 是否需要竞品分析能力内置？ | `competitive-analysis` skill 要求先确认分析范围，竞品资料有时效性 | 外部竞品研究只做 opt-in，不默认联网 |
| 15 | 用户体验的关键闭环是什么？ | 用户强调“辅助产品输出高质量需求” | 固化为：看懂现状 -> 确认增量 -> 拿到文档 |
| 16 | PRD 质量门该新建还是复用？ | requirements readiness gate 已存在 | 复用既有 gate，加 PRD-specific lens，不新增独立 gate schema |
| 17 | 输出文档需要覆盖哪些细节？ | 用户明确点名名词、用例、异常、交互设计 | PRD template 必含 Glossary、Use Cases、Exception Handling、Interaction Requirements |
| 18 | 一句话需求如何避免编造？ | Productboard/Aha 强在组织上下文，但 spec-first 没有客户库 | 无证据内容进入 Assumptions / Open Questions |
| 19 | 大 PRD 是否首版 packet 化？ | 需求拆分文档已有 packet 终态，但首版目标是新增 skill | v1 先单文档 PRD；packet 作为 planning/future scope |
| 20 | 最终 owner 决策是什么？ | 上述本地代码、Claude 调研稿、竞品、spec-first 角色契约 | 新增 1 个 `spec-prd`，不拆多 skill，v1 不新增 agent |

---

## External Research Findings

- GitHub Spec Kit 的核心启发是“每个阶段产出 Markdown artifact 喂给下一阶段”，并把 requirements clarity、cross-artifact analysis 和 checklist 作为质量机制。`spec-prd` 应强化 Spec 节点输入质量，而不是跳到 Plan/Tasks。
- BMAD 的核心启发是 PRD lifecycle 可以是一个入口内的 Create / Update / Validate，而不是拆多个公开入口。`spec-prd` 应吸收这个 intent model，但保持 spec-first 的 source/runtime 和 graph evidence 边界。
- Task Master 的核心启发是 PRD 质量直接影响任务拆分质量；它强调 objective、context、constraints 和 reasoning。`spec-prd` 应把 current-state context 和 change delta 写扎实，让后续 plan/tasks 不重新发明需求。
- PM SaaS / PRD generator 的核心启发是交互式写作、模块 review、术语/用例/异常/指标补齐能降低产品人工成本；但 spec-first 没有客户反馈库、战略库或路线图库，不能自动编造这些材料。

### 外部证据补强（来自 `001` 的 2026-05-30 curl 一手核验，H6）

`001` 用 curl(GitHub API + 官网原文)核验了竞品,以下三条**正面支撑本文新增 `spec-prd` 的决策**，应纳入本文论据：

- **CodeStable `cs-req`（★868，一手 README 核验）= 本决策最强外部佐证。** CodeStable 以软件要素为中心，把"现状档案层"(`cs-req`，只记现状)与"模糊想法讨论层"(`cs-brainstorm`，做分诊)**显式拆成不同入口**。这正是 `002` 的核心主张——现状/增量迭代(spec-prd)与 0-1 探索(spec-brainstorm)应是**不同姿态、可分入口**——的真实业界先例。`001` 曾把它当作候选 2 的反证，但它其实更支持候选 1 的"拆入口"取向。
- **Sourcegraph / CodeScene 已出 MCP code-graph server。** "用 code graph 给 agent 提供系统现状理解"是业界明确方向，印证 `spec-prd` 的 current-state grounding 不是臆想。但二者均未见明文化"现状证据分级 + 现状不反向扩 scope"的治理——这正是 `spec-prd` 复用 `graph-evidence-posture.md` 四轴的差异化点(对应 R10-R12、R38)。
- **testany-agent-skills（★73）的 writer+reviewer 双门禁 + TRACEABILITY-METADATA** 印证 R29 readiness lens 方向正确；但其十余个 `*-writer/*-reviewer` 公开入口是反面教材——`002` 守住"1 个公开 skill + 内部 references"(D1/D2)是对的。
- **修正**：`001` 旧称 Tessl 为 Spec Registry 对照——curl 核验 Tessl 实为 Agent Enablement Platform(skill 治理)，与本需求无直接竞争，本文不引为论据。

---

## Problem Frame

`spec-first` 当前已经有 `spec-brainstorm` 帮用户把模糊想法整理成 right-sized requirements。它适合 0-1 阶段：问题还没定义清楚、目标用户还不明确、方案方向需要一起探索、WHAT 还需要推敲。

但真实研发里还有另一类高频场景：产品不是从空白开始，而是在已有系统上做增量迭代。此时用户需要的不是泛化 brainstorm，而是一个能读懂当前系统、识别现有流程、发现 PRD 与代码现状差异、补齐名词/用例/异常/交互/验收，并输出 Markdown PRD 的协作 workflow。

当前缺口是：`spec-brainstorm` 没有正式的代码/业务流程/current-state 输入分析层。它会轻量搜索上下文，但不会把现有页面、路由、API、权限、状态、异常路径、后台任务、测试和业务约束组织成 PRD 的证据输入。没有历史需求文档知识库时，代码和图谱就是最可靠的现状来源。`spec-prd` 要补的就是这个增量需求迭代层。

---

## Goals

- 新增 `spec-prd` 公开 workflow skill，服务已有系统上的增量需求迭代 PRD 输出。
- 支持已有 PRD 完善、一句话增量需求到 PRD、想法经澄清后输出 PRD、已有 PRD 质量检查四类场景。
- 在写 PRD 前执行 scope-appropriate current-state analysis，重建当前系统逻辑、业务流程、页面/API/权限/状态/异常和约束。
- 输出高质量 Markdown PRD，包含名词解释、产品用例、异常处理、交互设计约束、验收样例、风险、依赖和开放问题。
- 区分用户陈述、源码确认、GitNexus pointer、外部研究、agent assumption，避免把猜测写成事实。
- 按 App、H5/PC、Admin、Backend/Java、CLI/DevTool、Mixed surface 加载差异化关注点。
- 保持与 `spec-plan`、`spec-doc-review`、`spec-write-tasks`、`spec-work` 的链路衔接，不创建第二套需求真相源。

## Non-Goals

- 不把 `spec-brainstorm` 替换掉；0-1 想法探索仍归 `spec-brainstorm`。
- 不新增多个公开 PRD skill；首版只有 `spec-prd`。
- 不在首版新增独立 agent、复杂状态机、需求数据库或长期 PRD 知识库。
- 不默认联网做竞品、市场或客户研究；除非用户明确要求。
- 不写实现方案、文件改动计划、数据库 schema、接口设计细节或任务拆解。
- 不把 GitNexus 结果当 confirmed truth；关键事实仍需源码、测试、文档或用户确认。
- 不手改 generated runtime mirrors：`.claude/`、`.codex/`、`.agents/skills/`。

---

## Product Positioning

### Workflow Boundary

| Workflow | 核心定位 | 典型输入 | 典型输出 |
| --- | --- | --- | --- |
| `spec-brainstorm` | 0-1 WHAT shaping | 模糊想法、问题探索、产品方向不清楚 | right-sized requirements |
| `spec-prd` | 增量需求迭代 PRD 输出 | 已有 PRD、一句话增量需求、现有系统上的产品改动 | PRD-grade requirements |
| `spec-plan` | HOW planning | requirements / PRD artifact | implementation plan |
| `spec-doc-review` | 文档审查 | PRD / requirements / plan | findings / gap report |

### Skill Count Decision

首版新增 1 个 skill：`skills/spec-prd/SKILL.md`。

不新增：

- `spec-prd-create`
- `spec-prd-refine`
- `spec-prd-validate`
- `spec-admin-prd`
- `spec-backend-prd`
- `spec-app-prd`

原因：这些是同一个 PRD workflow 的 intent 或 lens，不应让用户在多个入口之间先做工作流分类。公开入口越多，越容易产生 routing 冲突和多真相源。

### Agent Decision

首版不新增 agent。`spec-prd` 的复杂度先通过 references 和 eval 控制：

- `references/current-state-analysis.md`
- `references/prd-output-template.md`
- `references/domain-lenses.md`
- `references/prd-readiness-lens.md`
- `references/intent-routing.md`

后续只有满足以下条件之一，才新增内部 agent：

- current-state analysis 在 eval 中反复漏掉关键现状；
- domain lens 判断经常错把 App/Admin/Backend 关注点混用；
- PRD readiness review 的问题密度高，且单一 orchestrator 难以稳定发现；
- 多端/多系统 PRD 需要并行 reviewer，且 dispatch 成本被实际收益证明。

可选后续 agent 名称只作为 v2 候选，不进入 v1 scope：

- `prd-current-state-reviewer`
- `prd-scope-guardian`
- `prd-domain-lens-reviewer`

### Intent Model

| Intent | 适用输入 | 行为边界 |
| --- | --- | --- |
| `create` | 用户给一句话或短 issue，但目标是已有系统上的增量需求 | 从现状扫描开始生成 PRD；不是 0-1 新产品创建 |
| `refine` | 用户给已有 PRD/requirements | 保留原意，补齐 gaps、现状、异常、交互和验收 |
| `validate` | 用户已有 PRD，但想确认是否可交给研发 | 输出 readiness/gap report，可附修订建议 |
| `code-align` | 用户强调结合代码理解当前系统逻辑 | 输出 current-state snapshot、change delta、mismatch/open gaps，并沉淀到 PRD |

> **H4 修正**：`code-align` 与前三者不在同一维度。`create/refine/validate` 是"输入状态"维度（从零 / 已有文档 / 检查）；而 R7 规定 current-state analysis 对所有场景**无条件必做**，所以 code-grounding 是**贯穿全部 intent 的 posture，不是并列第四 intent**。落地建议：保留 `create/refine/validate` 三个 intent，把 code-align 降级为"当用户显式要求只产现状对齐报告、暂不写完整 PRD"时的 refine/create 子模式（一个 modifier flag），避免 LLM 在 create 与 code-align 间误判。最终取舍交 planning，但不应把它当独立 intent 实现。

### Interaction Experience

`spec-prd` 的首屏体验不是长问卷，也不是直接写最终文档。推荐 opening move 是一句 scope summary 加一个最关键问题：

```text
我会先把这个想法和当前代码里的相关流程对齐，再输出可交给 plan 的 PRD。
先确认一个点：这是要改现有流程，还是新增一条独立流程？
```

标准体验闭环：

1. **Scope confirmation:** 确认目标 surface、目标流程、是否改现有能力。
2. **Current-state reveal:** 先展示现状摘要、证据来源和不确定点。
3. **Delta confirmation:** 让产品 owner 确认 keep/extend/replace/remove/unknown。
4. **Focused gap questions:** 只问会改变产品行为、范围或验收的阻塞问题。
5. **Draft PRD:** 输出 Markdown PRD 或 patch-style addendum。
6. **Readiness and handoff:** 标出风险，推荐 `spec-doc-review` 或 `spec-plan`。

---

## Actors

- A1. 产品/业务 owner：提供需求意图、业务目标、优先级、已有 PRD 和决策口径。
- A2. `spec-prd` orchestrator：负责 intent 判断、现状扫描、PRD 写作、质量门和 handoff。
- A3. GitNexus / code evidence provider：提供代码结构、符号、流程、route/API/tool 等 orientation。
- A4. Source confirmer：通过源码、测试、docs、contracts 或用户确认把关键现状 claim 升级为 confirmed。
- A5. Downstream planner：消费 PRD-grade requirements，生成技术方案。
- A6. PRD reviewer：通过 `spec-doc-review` 或后续 review lens 检查完整性、一致性和可规划性。

---

## Key Flows

- F1. Existing PRD refinement
  - **Trigger:** 用户提供已有 PRD/requirements 文档，并要求细化、完善、优化或补充。
  - **Actors:** A1, A2, A3, A4, A6
  - **Steps:** 读取原文 -> 提取已有结构和主张 -> 扫描当前系统现状 -> 对齐 PRD 与代码事实 -> 补齐名词、用例、异常、交互和验收 -> 输出修订版或 addendum。
  - **Outcome:** 原 PRD 被升级为证据来源明确、可规划、可验收的 PRD-grade requirements。
  - **Covered by:** R1, R3, R8, R9, R17

- F2. One-line incremental requirement to PRD
  - **Trigger:** 用户只给一句话，例如“给后台加批量导入”“App 订单页增加异常提示”。
  - **Actors:** A1, A2, A3, A4
  - **Steps:** 判断是否是现有系统增量 -> 确认目标 surface 和流程 -> 做 current-state scan -> 输出 Change Delta -> 生成 PRD -> 标记 assumptions/open questions。
  - **Outcome:** 一句话增量需求变成可交给 `spec-plan` 的 Markdown PRD。
  - **Covered by:** R2, R4, R7, R12, R18

- F3. Idea routing between brainstorm and PRD
  - **Trigger:** 用户只有想法，但不确定是 0-1 还是已有系统迭代。
  - **Actors:** A1, A2
  - **Steps:** 判断产品形态是否明确、是否依附现有系统、是否已有目标流程 -> 若方向未成型，路由到 `spec-brainstorm` -> 若是现有系统增量，进入 `spec-prd`。
  - **Outcome:** 不把 0-1 想法强行包装成 PRD，也不把增量需求拉回过度 brainstorm。
  - **Covered by:** R5, R6, R31

- F4. PRD quality validation
  - **Trigger:** 用户已有 PRD，但不确定是否能交给研发规划。
  - **Actors:** A1, A2, A6
  - **Steps:** 执行 PRD readiness lens -> 检查 current-state accuracy、requirement clarity、exception coverage、interaction readiness、acceptance examples、scope boundary -> 输出 gap report 或修订建议。
  - **Outcome:** 用户获得清晰的“能否进入 plan”的判断和最小补齐建议。
  - **Covered by:** R20, R24, R25, R28

- F5. PRD handoff to plan
  - **Trigger:** PRD ready 或用户确认带 assumptions 继续。
  - **Actors:** A2, A5
  - **Steps:** 保存 `docs/brainstorms/*-requirements.md` -> 保留 `spec_id`、artifact_kind、R/A/F/AE IDs、Evidence And Assumptions -> 推荐 `spec-doc-review` 或 `spec-plan`。
  - **Outcome:** PRD 成为 Spec 节点 artifact，而不是孤立文档。
  - **Covered by:** R21, R26, R29, R30

---

## Requirements

**Workflow Entry**

- R1. 系统必须新增 1 个公开 workflow skill：`spec-prd`。
- R2. `spec-prd` 必须定位为“已有系统上的增量需求迭代 PRD 输出”，而不是 0-1 brainstorm 的换名版本。
- R3. `spec-prd` 必须支持 `create`、`refine`、`validate`、`code-align` 四种内部 intent，但不得拆成多个公开 skill。
- R4. 当用户输入是“一句话增量需求”时，`spec-prd` 必须能在最少澄清问题后输出 PRD 草稿，不要求用户先填完整问卷。
- R5. 当输入是 0-1 想法、产品方向不清或目标用户/核心流程未定时，`spec-prd` 必须推荐或转交 `spec-brainstorm`，不得生成伪完整 PRD。
- R6. `using-spec-first` 后续路由必须明确区分：0-1 探索走 `spec-brainstorm`；已有系统增量 PRD、已有 PRD 完善、code-aware PRD 检查走 `spec-prd`。

**Current-State Analysis**

- R7. `spec-prd` 在生成或完善 PRD 前，必须执行 scope-appropriate current-state analysis。
- R8. Current-state analysis 必须覆盖相关现有能力、业务流程、页面/路由/API、权限/角色、状态/异常、配置/后台任务、测试和现有文档。
- R9. Current-state analysis 必须输出 `Current System Snapshot` 和 `Change Delta`，区分 keep、extend、replace、remove、unknown。
- R10. GitNexus evidence 必须只作为 orientation、candidate pointer 或 session-local evidence；关键结论必须通过源码、测试、docs、contracts 或用户确认支撑。
- R11. 当 GitNexus 与源码/测试/用户确认冲突时，PRD 必须采用 confirmed source，并把 GitNexus 降级为 stale/advisory pointer。
- R12. Current-state facts 只能约束需求、提示复用机会和暴露风险，不得自动扩大产品范围。

**PRD Authoring**

- R13. PRD 输出必须是 Markdown 文档，默认路径为 `docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md`。
- R14. PRD frontmatter 必须包含 `spec_id`，并应包含 `artifact_kind: prd-requirements`、`target_surface`、`evidence_grade`。
- R15. PRD 必须包含 Summary、Problem Frame、Current System Snapshot、Goals/Non-Goals、Glossary、Actors、Key Flows/Use Cases、Requirements、Acceptance Examples、Scope Boundaries、Evidence And Assumptions、Outstanding Questions。
- R16. PRD 必须补齐名词解释，术语来源必须标明来自用户、源码、现有文档、UI/API 命名或 assumption。
- R17. PRD 必须补齐产品用例；核心用例至少包含 actor、trigger、precondition、main path、alternative/error path、outcome、covered requirements。
- R18. PRD 必须覆盖异常处理，包括权限异常、输入异常、状态冲突、弱网/超时、重复提交、部分成功、回滚/撤销、兼容/降级，并按 surface 裁剪。
- R19. PRD 必须覆盖交互设计约束，包括入口、信息架构、关键状态、反馈文案、确认/取消、空态、加载态、错误态、可访问性或国际化需求；不产出高保真 UI 设计。
- R20. PRD 必须使用可验收表述；条件型行为应使用 Given/When/Then 或 EARS 等价表达，避免“优化、完善、支持、相关”等不可验收动词孤立出现。
- R21. PRD 不得包含 implementation units、文件改动计划、数据库 schema、接口字段设计或任务拆解，除非需求本身就是面向开发者的技术产品行为。

**Domain Lenses**

- R22. `spec-prd` 必须按目标 surface 加载差异化关注点，而不是用一套固定模板覆盖所有需求。
- R23. App lens 必须关注页面栈、导航、权限弹窗、弱网/离线、前后台切换、状态恢复、埋点、i18n/accessibility。
- R24. H5/PC lens 必须关注路由、表单、响应式、浏览器返回、登录态、刷新、SEO/分享和多视口行为。
- R25. Admin lens 必须关注 RBAC、列表筛选、批量操作、导入导出、审核/回滚、审计日志、危险操作确认。
- R26. Backend/Java lens 必须关注 API contract、状态机、幂等、事务、错误码、安全、性能、迁移、观测性和向后兼容。
- R27. CLI/DevTool lens 必须关注命令入口、参数、配置、dry-run/preview-first、日志、跨平台、失败恢复和升级路径。
- R28. Mixed/multi-surface lens 必须关注 source-of-truth、跨端一致性、接口契约、异步同步、降级策略和集成验收。

**Quality And Handoff**

- R29. `spec-prd` 必须复用现有 Requirements Readiness Gate，并增加 PRD-specific lens：current-state accuracy、change delta clarity、exception coverage、interaction readiness、evidence provenance、planning invention risk。
- R30. Readiness gate 失败时，`spec-prd` 必须输出最小补齐问题或修订建议；用户选择带 assumptions 继续时，文档必须记录风险。
- R31. 完成后必须给出下一步建议：继续 refine、`spec-doc-review`、`spec-plan` 或 done for now；不得直接进入 `spec-work`。
- R32. `spec-plan` 应能把 `artifact_kind: prd-requirements` 的 `docs/brainstorms/*-requirements.md` 按普通 requirements artifact 消费。

**Skill And Agent Architecture**

- R33. `skills/spec-prd/SKILL.md` 必须保持精简，只保留触发、边界、核心 workflow、reference load 条件和 handoff；详细模板与 lens 放入 references。
- R34. 首版必须新增 references，而不是把全部模板堆进 SKILL.md。
- R35. 首版不得新增独立 agent；必须先用 fresh-source eval 和 focused contract tests 验证 skill 行为。
- R36. 若后续新增 agent，必须是内部 reviewer/helper，不得作为用户公开入口。
- R37. `spec-prd` 必须显式回应与 `spec-brainstorm` 的边界：0-1 产品探索不进入 `spec-prd`；已有系统增量迭代不被强行拉回 brainstorm。
- R38. `spec-prd` 的 evidence tags 必须映射到项目既有 graph evidence policy，不得创建第二套互相冲突的证据权威。
- R39. `spec-prd` 必须复用现有 `docs/brainstorms/*-requirements.md` artifact chain，不得新增 `docs/prds/` 作为默认真相源。
- R40. `spec-prd` 首屏交互必须遵循“看懂现状 -> 确认增量 -> 拿到文档”，不得以完整 PRD 字段问卷开场。

### Requirement 分层说明（H5，交 planning 瘦身）

40 条 requirement 触发了 `requirements-capture.md` 的 size 红线（"超过 ~15-20 要停下来"）。本文不删 owner 内容，但标注分层供 planning 瘦身——`spec-plan` 应据此压缩，不必把 40 条都当对等产品 requirement 实现：

- **真·产品 requirement（保留 R 号）**：R1-R21（workflow 入口 + current-state + PRD authoring）、R29-R32（质量门与 handoff）。这些定义"产物必须是什么"。
- **可合并**：R22-R28（七条 domain lens）本质是一条 requirement"按 surface 加载差异化关注点"+ 一张 lens matrix。建议合并为 1 条 R + 引用 §Domain Lens Matrix，不占 7 个 R 号。
- **应下沉为实现纪律（移出 Requirements，进 Implementation Direction）**：R33-R36（SKILL.md 精简 / 用 references / v1 不新增 agent / 后续 agent 仅内部）——这是"怎么实现 skill"的工程纪律，不是"产物是什么"的产品需求。R37-R39（边界声明 / evidence 映射 / 不新建 docs/prds）属约束声明，可降为 Scope Boundaries 条目。
- 瘦身后核心产品 requirement 约 ~22 条，落在合理区间。

---

## Current-State Analysis Contract

### Inputs

- User input：一句话需求、已有 PRD、issue、会议纪要、截图描述、目标模块、产品决策。
- Repo evidence：源码、测试、docs、contracts、README、现有 requirements/plans/solutions。
- GitNexus evidence：query/context/route/API/tool 等 read-only orientation。
- External evidence：仅当用户要求竞品、行业或市场研究时使用。

### Output Shape

```markdown
## Current System Snapshot

### Existing flows
- CS1. [流程名]
  - Current behavior:
  - Entry points:
  - Actors / permissions:
  - States / errors:
  - Evidence: confirmed-source | user-stated | gitnexus-pointer | external-research | assumption

### Change delta
- D1. Keep:
- D2. Extend:
- D3. Replace:
- D4. Remove:
- D5. Unknown:

### Existing constraints
- [业务、技术、合规、数据、性能、运营、兼容约束]
```

### Evidence Rules

| Evidence tag | 强度 | 规则 |
| --- | --- | --- |
| `confirmed-source` | confirmed | 已直接读取源码、测试、文档或合同 |
| `user-stated` | confirmed for intent | 用户明确表达的产品意图或业务规则 |
| `gitnexus-pointer` | advisory/session-local | 只能指向候选代码/流程，关键结论需源码确认 |
| `external-research` | advisory 或 sourced | 需标注来源和日期，不替代本地事实 |
| `assumption` | unconfirmed | 只能进入 Assumptions 或 Open Questions |

### Evidence Mapping To Existing Policy

PRD evidence tags 是面向文档读者的轻量标签，不是新的 graph evidence contract。落地时必须映射到既有证据政策：

| PRD tag | Graph evidence policy grade | Plan envelope posture |
| --- | --- | --- |
| `confirmed-source` | `confirmed` | `evidence_grade=primary`, `evidence_posture=fallback` when source reads are used |
| `user-stated` | `confirmed` for intent only | user decision / requirement source, not graph evidence |
| `gitnexus-pointer` | `session-local` or `advisory`; stale when graph facts are dirty/stale | `evidence_grade=session-local/advisory/stale`, never `primary` without source confirmation |
| `external-research` | advisory unless directly sourced and dated | external context, never local product fact |
| `assumption` | unconfirmed | must remain in Assumptions or Open Questions |

当前仓库 `.spec-first/graph/graph-facts.json` 为 `dirty-advisory` 且 `impact_context=false`，因此本需求文档只把 GitNexus 作为能力设计和 orientation 输入，不声称已有新鲜 graph impact evidence。

---

## PRD Markdown Template

```markdown
---
date: YYYY-MM-DD
topic: <slug>
spec_id: YYYY-MM-DD-NNN-<slug>
artifact_kind: prd-requirements
source_prd: <optional repo-relative path>
target_surface: app | h5 | pc | admin | backend | cli | mixed
evidence_grade: confirmed | mixed | assumption-heavy
---

# <需求标题>

## Summary

[1-3 行说明本次增量能力。]

## Problem Frame

[当前用户/业务/系统痛点。]

## Current System Snapshot

[当前流程、入口、角色、状态、约束和证据。]

## Change Delta

[Keep / Extend / Replace / Remove / Unknown。]

## Goals / Non-Goals

[目标与明确不做。]

## Glossary

| Term | Meaning | Source | Confirmation |
| --- | --- | --- | --- |

## Actors

- A1. [角色]: [职责与权限]

## Key Flows / Use Cases

- F1. [用例名]
  - Trigger:
  - Actor:
  - Preconditions:
  - Main path:
  - Alternative / error path:
  - Outcome:
  - Covered by:

## Requirements

- R1. [可验收需求]

## Interaction / UX Requirements

- [入口、状态、反馈、文案、确认、空态、错误态、可访问性/i18n]

## Exception Handling

| Case | Trigger | Expected behavior | User/system feedback | Covers |
| --- | --- | --- | --- | --- |

## Acceptance Examples

- AE1. Covers R1. Given ..., when ..., then ...

## Success Metrics

- [有证据则写；无证据则进入 Open Questions]

## Risks / Dependencies

- [业务、技术、合规、运营、数据、交付依赖]

## Scope Boundaries

- [不做内容和后续迭代]

## Evidence And Assumptions

- Confirmed:
- GitNexus pointers:
- External:
- Assumptions:

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [技术方案或实现细节问题]
```

---

## Domain Lens Matrix

| Lens | 必看现状 | PRD 必补细节 | 常见异常 | 典型验收 |
| --- | --- | --- | --- | --- |
| App | 页面栈、导航、权限、弱网、离线、埋点、i18n | 空态/加载/错误态、权限弹窗、前后台切换、多端一致性 | 弱网、权限拒绝、重复点击、状态恢复 | 给定网络/权限状态，用户能看到正确反馈 |
| H5/PC | 路由、表单、响应式、浏览器兼容、登录态 | 表单校验、跳转、浏览器返回、SEO/分享、埋点 | 表单半填、登录过期、刷新、跨端尺寸 | 不同视口和登录态下流程一致 |
| Admin | RBAC、筛选、批量操作、审核链路、审计 | 权限矩阵、批量规则、导入导出、危险操作确认 | 部分成功、权限不足、并发编辑、撤销/回滚 | 操作可追踪、可恢复、权限正确 |
| Backend/Java | API、数据模型、状态机、幂等、事务、错误码 | API 行为、数据一致性、兼容、性能、观测性 | 重试、超时、重复提交、并发、部分失败 | 契约稳定，错误码和状态转移可验证 |
| CLI/DevTool | 命令、配置、文件写入、跨平台、dry-run | 参数、预览、确认、日志、回滚、升级路径 | 路径非法、权限不足、中断、非 TTY | dry-run 可预览，失败可恢复 |
| Mixed | 多端/多服务边界、共享状态、事件链路 | source-of-truth、同步策略、降级、数据流 | 一端成功一端失败、延迟一致性 | 跨端行为和状态一致性可解释 |

---

## Acceptance Examples

- AE1. **Covers R1, R3.** Given 用户要求“完善已有 PRD”，when `spec-prd` 运行，then workflow 以原 PRD 为 primary input，保留核心意图，并输出补强后的 PRD 或 addendum。
- AE2. **Covers R2, R5.** Given 用户只有“我想做一个面向新用户的社区产品”这类 0-1 想法，when 产品形态和目标流程不清楚，then `spec-prd` 应推荐 `spec-brainstorm`，不得生成伪完整 PRD。
- AE3. **Covers R4, R7, R9.** Given 用户只说“后台用户列表增加批量导入”，when 代码中存在 Admin 列表与权限模式，then PRD 必须输出 Current System Snapshot、Change Delta 和 Admin lens 下的权限、导入校验、失败行反馈、审计日志、回滚问题。
- AE4. **Covers R10, R11.** Given GitNexus 指向某 route，但源码读取发现 route 已重命名，when 写现状分析，then GitNexus 结果必须降级为 stale/advisory pointer，不能写成 confirmed fact。
- AE5. **Covers R16, R17.** Given PRD 草稿缺少业务术语和用例，when `spec-prd` refine，then 输出必须包含 Glossary 和核心 Use Cases，并标注术语来源。
- AE6. **Covers R18.** Given 需求涉及 App 弱网或 Backend 超时，when 输出异常处理，then PRD 必须说明用户反馈、系统行为、重试/降级策略或 open question。
- AE7. **Covers R19.** Given 需求涉及用户操作流程，when 输出 PRD，then 必须说明入口、状态、反馈、确认/取消、空态/加载/错误态，不要求高保真 UI。
- AE8. **Covers R20.** Given requirement 使用“优化体验”这类模糊表述，when readiness lens 执行，then workflow 必须改写为可观察行为或放入 Open Questions。
- AE9. **Covers R22-R28.** Given 目标 surface 是 Backend/Java，when 生成 PRD，then 输出必须关注 API contract、幂等、事务、错误码、兼容、观测性，而不是套用 App 页面模板。
- AE10. **Covers R29, R30.** Given PRD readiness gate 发现产品行为仍未决，when 收尾，then workflow 输出最小澄清问题或记录带 assumptions 继续的风险。
- AE11. **Covers R31, R32.** Given PRD ready，when workflow 完成，then artifact 保存到 `docs/brainstorms/*-requirements.md`，保留 `spec_id` 和 `artifact_kind: prd-requirements`，并推荐 `spec-plan` 或 `spec-doc-review`。
- AE12. **Covers R35, R36.** Given 首版实现 `spec-prd`，when 规划实现范围，then 不新增独立 agent；若 future agent 被提出，必须有 eval 失败证据和内部 helper 边界。
- AE13. **Covers R37, R40.** Given 用户提出已有系统上的增量需求，when `spec-prd` 开场，then workflow 先展示将进行现状对齐的 scope summary，并只问一个最关键增量确认问题。
- AE14. **Covers R38.** Given PRD 写入 `gitnexus-pointer` evidence，when 进入 handoff，then 文档必须说明该 pointer 是 session-local/advisory/stale 中哪一种，并要求源码确认后才能作为 confirmed current-state fact。
- AE15. **Covers R39.** Given `spec-prd` 生成 PRD artifact，when 保存文档，then 默认路径仍是 `docs/brainstorms/*-requirements.md`，不得新建 `docs/prds/`。

---

## Success Criteria

- 产品 owner 能从一句话增量需求或已有 PRD 得到结构完整、证据来源明确、可交付研发规划的 Markdown PRD。
- 下游 `spec-plan` 不需要发明产品行为、交互状态、异常路径、验收样例或 scope boundary。
- 没有历史需求知识库时，workflow 仍能通过代码、GitNexus orientation 和 bounded source reads 提升 PRD 准确度。
- PRD 中的 current-state claim 可追溯到 confirmed source、user-stated、GitNexus pointer、external research 或 assumption。
- `spec-brainstorm` 的 0-1 探索边界保持清晰，`spec-prd` 不把 brainstorm 职责吞并。
- 首版只有一个新增 skill，不产生多入口、多 artifact store 或多 schema 的维护负担。

**可度量成功标准（H7，advisory——当前无 baseline，落地后才能取数）：**

- `spec-plan` 消费 `spec-prd` 产物时，因"产品行为/范围/验收未定"而回问 owner 的次数，应低于消费同类原始需求时——呼应版本规划 Evaluation Harness 的"plan 不需发明 WHAT"。
- `spec-prd` 产出的 PRD 中，current-state claim 带 `confirmed-source`/`user-stated` 证据标签的比例可观测（对抗"把 pointer/猜测写成事实"）。
- 标 advisory：spec-first 尚无真实用户 telemetry（版本规划 §20 决策 6 / P0-23），此处不得自述为"用户痛点驱动"，仅作落地后自检方向。

---

## Scope Boundaries

- `spec-prd` 是 Spec 节点 workflow，不是 Plan、Tasks、Code 或 Review 节点。
- `spec-prd` 输出 PRD-grade requirements，不输出 implementation plan。
- `spec-brainstorm` 继续服务 0-1、模糊想法和开放式 WHAT shaping。
- `spec-plan` 继续负责技术方案、implementation units、测试策略和落地风险。
- `spec-doc-review` 继续负责文档审查；`spec-prd` 可推荐它，但不替代它。
- `spec-app-consistency-audit` 继续负责移动 App 的 PRD/Figma/source 一致性审查；`spec-prd` 不复用其重型 artifact spine。
- Requirements Packet、Multi-Surface Packet、Plan Packet、Lane Task Packs 是后续高级能力，不进入 `spec-prd` v1。

---

## PRD Quality Definition

`spec-prd` 交付的“高质量 PRD”必须满足以下判断，而不是只满足章节完整：

| Quality dimension | Pass signal | Fail signal |
| --- | --- | --- |
| 产品意图清楚 | 用户目标、业务目标、目标 surface 和增量范围可被唯一理解 | 只写“优化/完善/支持”，没有可观察结果 |
| 现状可追溯 | 关键 current-state claim 有源码、测试、文档、用户或明确 assumption 来源 | 把 GitNexus pointer、猜测或行业常识写成事实 |
| 增量边界明确 | Change Delta 区分 keep/extend/replace/remove/unknown | 新需求与现有能力混在一起，下游不知道改哪里 |
| 用例可执行 | 核心 actor、trigger、precondition、main path、exception path、outcome 完整 | 只有功能列表，没有用户/系统路径 |
| 异常可处理 | 权限、状态冲突、输入异常、超时/弱网、重复提交、部分成功等有 expected behavior | 异常只写“提示错误” |
| 交互可理解 | 入口、状态、反馈、确认/取消、空态/加载/错误态明确 | UI/交互需要实现者自行发明 |
| 验收可判断 | 条件行为有 Given/When/Then 或 EARS 等价样例 | 无法判断实现是否满足需求 |
| 下游可规划 | `spec-plan` 只需决定 HOW，不需补 WHAT | 仍有产品行为问题留给 planner 猜 |

---

## Key Decisions

- D1. 新增 1 个公开 skill：`spec-prd`。
- D2. 不把 `spec-prd` 拆成多个公开 skill；intent 内部路由。
- D3. `spec-brainstorm` 保持 0-1 和 WHAT shaping，`spec-prd` 承担增量需求迭代 PRD 输出。
- D4. 首版不新增 agent；先用 references、eval 和 contract tests 验证。
- D5. PRD artifact 默认仍写入 `docs/brainstorms/*-requirements.md`，避免 `docs/prds/` 成为第二真相源。
- D6. Current-state analysis 是 `spec-prd` 的核心差异化，不是实现范围扩张器。
- D7. GitNexus 是 orientation/pointer，不是 confirmed truth。
- D8. Domain lenses 是 references，不是独立 skill。
- D9. 外部竞品/市场研究 opt-in，不默认联网。
- D10. 用户体验闭环固定为：看懂现状 -> 确认增量 -> 拿到文档。
- D11. Claude `001` 调研中“增强 `spec-brainstorm`”的建议被吸收为风险约束，而不是最终产品形态；最终形态仍为新增 `spec-prd`。
- D12. PRD evidence tags 只是文档层便捷标签，权威语义仍以 `docs/contracts/graph-evidence-policy.md` 和 `spec-plan` graph evidence posture 为准。

---

## Implementation Direction

- U1. 新增 `skills/spec-prd/SKILL.md`，定义触发、边界、intent routing、core workflow、reference load 条件、handoff。
- U2. 新增 `skills/spec-prd/references/current-state-analysis.md`，承载 scan order、evidence tags、GitNexus/source read 规则。
- U3. 新增 `skills/spec-prd/references/prd-output-template.md`，承载 Markdown 模板和 section inclusion rules。
- U4. 新增 `skills/spec-prd/references/domain-lenses.md`，承载 App/H5/PC/Admin/Backend/CLI/Mixed lens。
- U5. 新增 `skills/spec-prd/references/prd-readiness-lens.md`，复用 Requirements Readiness Gate 并补 PRD-specific checks。
- U6. 新增 host command template 与 dual-host governance 注册，使 Claude/Codex 均能发现 `spec-prd`。
- U7. 更新 `using-spec-first` 路由规则，明确 `spec-brainstorm` 与 `spec-prd` 分工。
- U8. 更新 `spec-plan` intake 文档，确认 `artifact_kind: prd-requirements` 与普通 requirements artifact 等价消费。
- U9. 补 focused tests：skill entrypoint lint、public workflow registration、using-spec-first routing、spec-plan PRD artifact intake、no generated runtime manual edit。
- U10. 增加 fresh-source eval fixtures：已有 PRD refine、一句话 Admin 增量、0-1 想法转 brainstorm、Backend lens、GitNexus stale pointer 降级、无 agent v1 边界。
- U11. 更新 README / README.zh-CN / 用户手册 artifact map / CHANGELOG。

---

## Evaluation Plan

首版实现完成后，至少用以下 fixture 验证行为。所有 eval 都应读取当前 source skill 文件，不能依赖会话缓存的旧 skill。

| Fixture | Input | Expected behavior |
| --- | --- | --- |
| Existing PRD refine | 一个已有 PRD path，要求“完善” | 保留原文意图，输出 gap report、current-state snapshot、补齐后的 PRD |
| One-line Admin iteration | “后台用户列表增加批量导入” | 触发 Admin lens，补权限、导入校验、失败行反馈、审计/回滚 open questions |
| 0-1 idea | “想做一个新社区产品” | 推荐 `spec-brainstorm`，不生成伪 PRD |
| Backend/Java change | “给现有订单状态增加取消原因” | 触发 Backend lens，关注状态机、错误码、幂等、兼容、观测性 |
| Stale GitNexus pointer | GitNexus 与源码不一致 | 降级 GitNexus pointer，以源码为准 |
| No-agent v1 boundary | 用户问是否要多个 agent | 回答 v1 不新增 agent，除非 eval 证明需要内部 reviewer |
| PRD readiness fail | PRD 缺异常和验收 | 输出最小补齐问题或修订建议，不进入 `spec-work` |
| Claude-risk regression | 新实现新增 `docs/prds/` 或独立 evidence enum | eval / contract test 必须失败，要求回到 shared artifact 和 existing evidence policy |

---

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| `spec-prd` 与 `spec-brainstorm` 边界混淆 | 用户不知道走哪个入口 | `using-spec-first` 明确 0-1 vs 增量迭代 routing |
| PRD 变成实现方案 | `spec-plan` source-of-truth 被绕过 | PRD readiness lens 检查 HOW leakage |
| GitNexus pointer 被写成事实 | PRD 现状不准确 | evidence tags + source confirmation rule |
| 模板过重 | 小需求负担变大 | right-sized section inclusion，按需加载 references |
| 过早新增 agent | 维护成本上升、上下文膨胀 | v1 禁止新增 agent，用 eval 验证后再决定 |
| 多端 lens 过度泛化 | App/Admin/Backend 需求关注点混用 | domain lens matrix + acceptance fixtures |
| PRD artifact 多真相源 | downstream plan 不知道消费哪个 | v1 不新增 `docs/prds/`，继续 `docs/brainstorms/` |

---

## External References

- GitHub Spec Kit: https://github.com/github/spec-kit
- Spec Kit Documentation: https://github.github.io/spec-kit/
- Kiro Specs: https://kiro.dev/docs/specs/
- BMAD Method: https://docs.bmad-method.org/
- Task Master AI: https://github.com/eyaltoledano/claude-task-master
- Productboard Spark: https://www.productboard.com/product/spark/
- Aha Product requirements document AI agent: https://support.aha.io/aha-software/ai-assistant/ai-prompt-library/ai-agents/product-requirements-document
- Nimbalyst `/prd`: https://nimbalyst.com/skills/prd
- ChatPRD: https://www.chatprd.ai/

---

## Outstanding Questions

### Resolve Before Planning

> 产品形态决策（新增 `spec-prd`）已定且不在此重开。但以下 3 个**架构/边界决策**被原稿误置于"无"或"Deferred"——它们会改变 skill 的实现结构与边界，必须在 planning 前由 owner 拍板，否则 plan 会临场做架构判断。

- **[H1][Boundary] `spec-prd` 与 `spec-app-consistency-audit` 的 App 场景边界。** 后者已接受 `prd:<path>` + source root，对 App 做 PRD↔Figma↔源码一致性审查。当用户"在 App 上做增量需求 + 想对齐现状"时走哪个？候选：(a) spec-prd 只产 PRD-grade requirements，App 的 PRD↔源码一致性审查仍归 app-consistency-audit，spec-prd 在 handoff 推荐它；(b) spec-prd App lens 仅做需求层现状摘要，不做组件/analytics/i18n 静态审查。推荐 (a)+(b) 组合并在两个 skill 的 When-Not-To-Use 互相点名。**owner 需确认分工。**
- **[H2][Architecture] R29 复用 Requirements Readiness Gate 的方式。** 该 gate 在 `spec-brainstorm/references/requirements-capture.md`。三条互斥路径：(a) spec-prd 运行时跨 skill 读 brainstorm 的 reference——需确认 runtime mirror(`.claude`/`.codex`/`.agents/skills`)如何为两个 skill 同步同一份 reference；(b) 把 gate 抽到 `docs/contracts/` 共享 source，两 skill 都引——更干净但改动 brainstorm，扩大 scope 并需双宿主回归;(c) spec-prd 复制一份——违背反多真相源。推荐 (b) 若可接受改 brainstorm，否则 (a) 并明确 runtime 同步机制。**owner 需选路径。**
- **[H3][Routing] brainstorm ↔ spec-prd 的 tie-break 规则。** 真实输入(如"给订单加取消功能")会同时命中两者 description。需要一条明确 tie-break：建议默认"已依附现有系统/已有目标流程 → spec-prd；产品形态、目标用户或核心流程未定 → brainstorm"，并据此**收窄 brainstorm 的 description**(去掉会与增量场景重叠的措辞)。后者是改 brainstorm source，需 owner 同意扩大 scope。**owner 需确认 tie-break 文案与是否动 brainstorm description。**

### Deferred to Planning

- [Affects U6][Technical] Codex 与 Claude 的 command/template/governance 注册文件清单由 `spec-plan` 根据现有双宿主生成机制确认。
- [Affects U9][Technical] `artifact_kind: prd-requirements` 是否需要新增 contract test fixture，还是只用 prose intake test 覆盖。
- [Affects U10][Evaluation] fresh-source eval 是否使用现有通用 reviewer 机制，或只通过 read-only fixture prompt 手动执行。
- [Affects 全文][Scope] 按 §Requirement 分层说明(H5)，R22-R28 合并、R33-R39 下沉为实现纪律/Scope Boundaries 的瘦身在 plan 阶段执行。
