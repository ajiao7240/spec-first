---
date: 2026-05-30
author: leokuang
topic: spec-prd-owner-final
spec_id: 2026-05-30-003-spec-prd-owner-final
artifact_kind: prd-requirements
status: ready-for-planning
supersedes_analysis_inputs:
  - docs/brainstorms/2026-05-30-001-prd-skill-requirements.md
  - docs/brainstorms/2026-05-30-002-prd-iteration-skill-requirements.md
  - docs/业界分析/14.prd-skill-竞品分析-2026-05-30.md
source_basis:
  - external-local: claude-skills/prd-generator/SKILL.md
  - external-local: claude-skills/competitive-analysis/SKILL.md
  - docs/10-prompt/结构化项目角色契约.md
  - skills/spec-brainstorm/SKILL.md
  - skills/spec-brainstorm/references/requirements-capture.md
  - skills/spec-app-consistency-audit/SKILL.md
  - skills/spec-plan/references/graph-evidence-posture.md
  - docs/contracts/graph-evidence-policy.md
  - docs/02-架构设计/需求拆分/大需求拆分.md
graph_evidence_note: "GitNexus 可用于 query/context orientation；其 evidence 强度按 docs/contracts/graph-evidence-policy.md 分级,stale/dirty-advisory/impact-unavailable 时不得当 fresh impact evidence。(本文撰写时 graph-facts 实测为 dirty-advisory + impact_context=false,但该状态会随 graph 刷新变化,需求约束以 policy 为准,不钉死此快照值。)"
---

# `spec-prd` 增量需求迭代 PRD Skill Owner 最终需求文档

## Summary

最终决策：新增 1 个公开 workflow skill：`spec-prd`。

`spec-brainstorm` 保持 0-1 想法探索、问题定义和 WHAT shaping；`spec-prd` 聚焦已有系统上的增量需求迭代 PRD 输出。它的核心体验是：产品 owner 说出想法后，skill 先结合现有代码和 GitNexus orientation 分析涉及的流程与系统现状，再帮助产品确认增量，最后输出高质量 Markdown PRD。

首版不拆多个 PRD skill，不新增独立 agent。`create`、`refine`、`validate` 是 `spec-prd` 内部 intent；`code-align` 不是平行 intent，而是贯穿全部 intent 的 evidence posture，只有在用户明确要求“先对齐代码现状、暂不输出完整 PRD”时作为子模式运行。首版用 references + fresh-source eval + focused contract tests 控制质量；只有实际 eval 证明单一 orchestrator 稳定失效时，才新增内部 reviewer agent。

---

## Owner Decision

| Question | Decision |
| --- | --- |
| 扩展 `spec-brainstorm` 还是新增 skill | 新增 `spec-prd`；`spec-brainstorm` 保持 0-1 边界 |
| 新增几个公开 skill | 1 个：`spec-prd` |
| 是否拆 create/refine/validate/code-align | 不拆；create/refine/validate 为内部 intent，code-align 为 evidence posture / 子模式 |
| 是否新增 agent | v1 不新增 |
| PRD artifact 放哪里 | 继续放 `docs/brainstorms/*-requirements.md` |
| 是否新增 `docs/prds/` | 不新增 |
| 是否新建 evidence 词表 | 不新建；映射到既有 graph evidence policy |
| 是否默认联网做竞品 | 不默认；仅用户显式要求时启用 |

### Why This Decision

`001/002` 的 Claude 分析指出了真实风险：新增 `spec-prd` 可能带来入口增殖、多真相源、重复 gate、证据词表分叉。最终仍选择新增 `spec-prd`，原因是用户目标已经不是“把 brainstorm 做得更强”，而是“让产品在已有系统上更低成本地产出高质量增量 PRD”。

这是不同产品心智：

- `spec-brainstorm`: 我还不知道要做什么，帮我一起想清楚。
- `spec-prd`: 我已经有增量方向或已有 PRD，帮我结合系统现状写成研发可用 PRD。

风险不通过取消 `spec-prd` 解决，而通过严格边界解决：单入口、共享 artifact、复用 gate、复用 evidence policy、v1 不新增 agent。

**外部一手证据(来自 `001` 的 curl 核验,支撑本决策)**：CodeStable `cs-req`(★868)把"现状档案层"与"模糊想法讨论层 `cs-brainstorm`"显式拆成不同入口——这是 `spec-prd`(增量/现状)与 `spec-brainstorm`(0-1)分入口的真实业界先例；Sourcegraph / CodeScene 已出 MCP code-graph server，印证 code-grounding 是业界方向，但均未明文化"现状证据分级 + 现状不反向扩 scope"治理(R11-R13/R40 的差异化点);testany-agent-skills 的 writer+reviewer 门禁印证 readiness lens 方向，但其十余个公开入口是反例，佐证 D1 单入口。Tessl 经核验为 Agent Enablement Platform(skill 治理)，与本需求无直接竞争，不引为论据。

---

## Decision Closure From `002`

`002` 提出的 7 个硬问题是有效的，本稿不把它们留给 planning 猜，而在 owner 需求阶段直接裁决。

| Issue | Final decision | Consequence |
| --- | --- | --- |
| H1. 与 `spec-app-consistency-audit` 重叠 | `spec-prd` 负责 App PRD 作者期的 current-state、Change Delta、异常/交互/验收补齐；`spec-app-consistency-audit` 负责 PRD/Figma/source/route/analytics/i18n 的静态一致性审计 | App lens 不复用 app-audit artifact spine，不自动触发 app-audit；用户显式要求 App 一致性审计时 handoff |
| H2. Requirements Readiness Gate 如何复用 | Planning 必须把共享核心抽到 `docs/contracts/workflows/requirements-readiness-gate.md`，`spec-brainstorm` 与 `spec-prd` 都引用它；`spec-prd` 只追加 PRD-specific lens | 不跨读另一个 skill 的私有 reference，不复制 gate 文案制造 drift |
| H3. 与 `spec-brainstorm` 路由冲突 | 同时像 feature idea 和 brownfield PRD 时，若用户给出现有系统锚点且目标是 PRD/需求文档，优先 `spec-prd`；若产品形态、actor、核心 outcome 未定，优先 `spec-brainstorm` | `using-spec-first` 和 skill description 必须加 tie-break fixture |
| H4. `code-align` 分类错误 | `code-align` 降级为 evidence posture / report-only 子模式，不作为第四个平行 intent | intent model 只保留 create/refine/validate |
| H5. Requirement 过多 | PRD 产品需求保留用户可见行为、artifact、quality/handoff；实现纪律下沉 Implementation Direction / Architecture Guardrails | Planning 要瘦身 R 列表，不把 source 注册点当产品需求 |
| H6. 外部一手证据未吸收 | 采用 `001` / 竞品分析结论：业界有 PRD writer、spec workflow、code graph trend，但缺 spec-first 的证据治理和 current-state 不反向扩 scope | 竞品只作为 advisory product-shape evidence，不默认进入每次 PRD run |
| H7. 成功标准不可度量 | 用 handoff quality、doc-review gap、fresh-source eval 和 routing fixture 衡量 `spec-prd` 是否比 brainstorm 更适合增量 PRD | 不编造业务增长指标，度量 workflow 质量 |

---

## 20-Round Analysis Summary

| Round | Question | Decision impact |
| --- | --- | --- |
| 01 | 差异化来自模板还是代码现状？ | 选择 current-state analysis，而不是更长 PRD 模板 |
| 02 | 是否继续扩 `spec-brainstorm`？ | 新增 `spec-prd`，避免 brainstorm 职责膨胀 |
| 03 | 与 App 一致性审计如何分工？ | PRD authoring vs consistency audit 分层 |
| 04 | Readiness Gate 是否复制？ | 抽共享 gate contract，避免 drift |
| 05 | 路由冲突如何判定？ | brownfield PRD tie-break 写入路由 |
| 06 | `code-align` 是否是 intent？ | 改为 posture / 子模式 |
| 07 | 40+ R 是否过度？ | 规划时瘦身，把实现纪律移出产品 R |
| 08 | 竞品研究是否默认联网？ | opt-in，默认只用用户材料和本地证据 |
| 09 | GitNexus 能否当事实？ | dirty-advisory 只作 pointer，关键 claim 要 source confirmation |
| 10 | Artifact 是否新建 `docs/prds/`？ | 不新增，沿用 `docs/brainstorms/*-requirements.md` |
| 11 | 多端是否拆 skill？ | 不拆，使用 domain lens references |
| 12 | 是否新增 agent？ | v1 不新增，除非 eval 证明需要 |
| 13 | PRD 是否写 HOW？ | 禁止 implementation units / schema / file plan |
| 14 | 首屏交互怎样最小？ | 现状对齐 + 一个关键 scope 问题 |
| 15 | 已有 PRD refine 如何避免重写目标？ | 保留原意，输出 mismatch/gap 与 addendum |
| 16 | Readiness fail 怎么收尾？ | 最小补齐问题或带 assumptions 风险，不进 `spec-work` |
| 17 | 成功指标怎么设？ | 衡量 handoff quality，不编造业务指标 |
| 18 | 新 workflow 落地成本包括什么？ | 双宿主治理、注册、README、tests、eval、runtime init |
| 19 | `003` 能否 ready for planning？ | 能，但必须吸收 H1-H3 作为显式决策 |
| 20 | 最终 owner 决策是什么？ | 1 个 `spec-prd`，0 新 agent，3 intent + code posture，shared gate |

---

## Problem Frame

真实研发中的增量需求通常不是从零开始。产品 owner 说“一句话需求”或给一份已有 PRD 时，最难的不是把文档写长，而是准确理解现有系统：

- 当前有哪些流程、页面、API、权限、状态和异常路径？
- 这次需求是新增、扩展、替换、删除，还是只是补充交互/异常？
- 哪些现状是 confirmed source，哪些只是 GitNexus pointer 或 agent assumption？
- App、H5、Admin、Backend/Java、CLI 等不同端分别容易漏掉什么？

当前 `spec-brainstorm` 的轻量 repo scan 能帮助需求成型，但没有正式产出 current-state snapshot、change delta、code alignment、PRD gap report 和多端 lens。没有历史需求知识库时，代码和图谱就是最可靠的 current-state 输入。`spec-prd` 要补的就是这个 PRD-grade current-state layer。

---

## Goals

- G1. 帮产品 owner 从想法、短需求或已有 PRD 出发，输出 Markdown PRD-grade requirements。
- G2. 在写 PRD 前，结合代码、文档、测试和 GitNexus orientation 分析当前系统现状。
- G3. 让产品先看懂现状，再确认增量，最后拿到 PRD。
- G4. 自动补齐名词解释、产品用例、异常处理、交互设计约束、验收样例、风险、依赖和开放问题。
- G5. 按不同 surface 加载差异化需求关注点：App、H5/PC、Admin、Backend/Java、CLI/DevTool、Mixed。
- G6. 保持 PRD artifact 与 `spec-plan`、`spec-doc-review`、`spec-write-tasks`、`spec-work` 的现有链路兼容。
- G7. 用 source confirmation 和 evidence tags 防止把猜测、过期图谱或行业常识写成系统事实。

## Non-Goals

- NG1. 不替代 `spec-brainstorm` 的 0-1 探索。
- NG2. 不替代 `spec-plan` 做技术设计、文件改动计划、schema、接口字段或任务拆解。
- NG3. 不新增多个公开 PRD skill。
- NG4. v1 不新增独立 agent、长期需求数据库、复杂状态机或中心化 PRD 知识库。
- NG5. 不默认联网做市场/竞品/客户研究。
- NG6. 不新增 `docs/prds/` 作为第二需求真相源。
- NG7. 不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime。

---

## Product Shape

`spec-prd` 是一个 PRD-grade requirements workflow，不是普通 PRD 模板生成器。

| Scenario | Input | `spec-prd` behavior | Output |
| --- | --- | --- | --- |
| 已有 PRD 完善 | PRD/requirements path 或粘贴内容 | 保留原意，做 current-state scan，输出 gap report 和修订稿 | PRD addendum 或修订版 requirements |
| 一句话增量需求 | “后台增加批量导入” | 判断 surface 和现有流程，问最少阻塞问题，补齐 PRD | Markdown PRD |
| 想法但依附现有系统 | “让订单异常更清楚” | 先对齐现有流程和异常路径，再确认增量 | Current-state + Change Delta + PRD |
| 0-1 模糊想法 | “想做一个社区产品” | 转 `spec-brainstorm`，不生成伪完整 PRD | Brainstorm handoff |
| PRD 可规划性检查 | 已有 PRD | 执行 readiness lens 和 codebase fit 检查 | Gap report / 修订建议 |

### Interaction Model

首屏不做长问卷。推荐 opening move：

```text
我会先把这个想法和当前代码里的相关流程对齐，再输出可交给 plan 的 PRD。
先确认一个点：这是要改现有流程，还是新增一条独立流程？
```

体验闭环：

1. **Scope confirmation:** 确认 surface、目标流程、是否改现有能力。
2. **Current-state reveal:** 展示现状摘要、证据来源、不确定点。
3. **Delta confirmation:** 确认 keep / extend / replace / remove / unknown。
4. **Focused gap questions:** 只问会改变产品行为、范围或验收的问题。
5. **Draft PRD:** 输出 Markdown PRD 或 patch-style addendum。
6. **Readiness and handoff:** 标风险，推荐 `spec-doc-review` 或 `spec-plan`。

---

## Actors

- A1. 产品/业务 owner：提供需求意图、业务目标、优先级、已有 PRD 和决策口径。
- A2. `spec-prd` orchestrator：判断 intent、组织现状扫描、写 PRD、执行 readiness lens、完成 handoff。
- A3. Evidence provider：GitNexus、源码、测试、文档、contracts、README、历史 requirements/plans/solutions。
- A4. Downstream planner：消费 PRD artifact，输出 implementation plan。
- A5. Reviewer：通过 `spec-doc-review` 检查 PRD 完整性、一致性和可规划性。

---

## Key Flows

- F1. Existing PRD refinement
  - **Trigger:** 用户提供已有 PRD/requirements，要求细化、完善、优化或补充。
  - **Steps:** 读取原文 -> 抽取已有主张 -> 做 current-state scan -> 输出 mismatch/gap -> 补齐名词、用例、异常、交互、验收 -> 保存 PRD。
  - **Outcome:** 已有 PRD 升级为证据明确、可规划、可验收的 PRD-grade requirements。
  - **Covered by:** R1, R3, R8, R11, R17, R22

- F2. One-line increment to PRD
  - **Trigger:** 用户给一句话增量需求。
  - **Steps:** 判断 surface 和流程 -> 问一个最关键问题 -> current-state scan -> Change Delta -> PRD synthesis -> readiness lens。
  - **Outcome:** 短需求变成可交给 `spec-plan` 的 Markdown PRD。
  - **Covered by:** R2, R4, R7, R9, R18, R23

- F3. Idea routing
  - **Trigger:** 用户只有想法，未说明是 0-1 还是现有系统迭代。
  - **Steps:** 判断是否依附现有系统和目标流程 -> 0-1 转 `spec-brainstorm` -> 增量进入 `spec-prd`。
  - **Outcome:** 不把 0-1 想法伪装成 PRD，也不把增量需求拉回过度 brainstorm。
  - **Covered by:** R5, R6

- F4. Code-aware validation
  - **Trigger:** 用户已有 PRD，但不确定是否能进入研发规划。
  - **Steps:** 检查 current-state accuracy、change delta、异常、交互、验收、scope、evidence provenance -> 输出 gap report。
  - **Outcome:** 产品 owner 知道 PRD 是否 ready，以及最小补齐项。
  - **Covered by:** R7-R13, R31-R33

- F5. Plan handoff
  - **Trigger:** PRD ready 或用户确认带 assumptions 继续。
  - **Steps:** 保存 `docs/brainstorms/*-requirements.md` -> 保留 `spec_id` / R/A/F/AE IDs / evidence section -> 推荐下一步。
  - **Outcome:** PRD 成为 Spec 节点 artifact。
  - **Covered by:** R14, R15, R34, R35

---

## Requirements

**Workflow Entry**

- R1. 必须新增 1 个公开 workflow skill：`spec-prd`。
- R2. `spec-prd` 必须定位为已有系统上的增量需求迭代 PRD 输出，不得成为 `spec-brainstorm` 的换名版。
- R3. `spec-prd` 必须支持三个内部 intent：`create`、`refine`、`validate`。
- R4. `code-align` 必须作为 evidence posture / 子模式处理，不得作为第四个平行 intent；create/refine/validate/code-align 均不得拆成多个公开 skill。
- R5. 0-1 产品探索、目标用户/核心流程未定、产品形态未定时，必须推荐 `spec-brainstorm`。
- R6. `using-spec-first` 后续路由必须区分：0-1 探索走 `spec-brainstorm`；已有系统增量 PRD、已有 PRD 完善、code-aware PRD 检查走 `spec-prd`。当输入同时像 feature idea 和 brownfield PRD 时，若用户给出现有系统锚点且目标是 PRD/需求文档，优先 `spec-prd`；若产品形态、actor、核心 outcome 未定，优先 `spec-brainstorm`。

**Current-State Analysis**

- R7. 生成或完善 PRD 前，必须执行 scope-appropriate current-state analysis。
- R8. Current-state analysis 必须覆盖相关现有能力、业务流程、页面/路由/API、权限/角色、状态/异常、配置/后台任务、测试和现有文档。
- R9. Current-state analysis 必须输出 `Current System Snapshot` 和 `Change Delta`。
- R10. Change Delta 必须区分 keep、extend、replace、remove、unknown。
- R11. GitNexus 只能作为 orientation、candidate pointer 或 session-local evidence；关键结论必须由源码、测试、文档、contracts 或用户确认支撑。
- R12. 当 graph facts 为 stale / dirty-advisory，或 impact context 不可用时，不得声称 fresh graph impact evidence；evidence 强度一律按 `docs/contracts/graph-evidence-policy.md` 分级判定，不依赖任何写死的快照值。
- R13. Current-state facts 只能约束需求、提示复用机会和暴露风险，不得自动扩大产品范围。

**PRD Authoring**

- R14. PRD 输出必须是 Markdown 文档，默认路径为 `docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md`。
- R15. PRD frontmatter 必须包含 `spec_id`，并可包含 `artifact_kind: prd-requirements`、`target_surface`、`evidence_grade`。
- R16. PRD 必须包含 Summary、Problem Frame、Current System Snapshot、Change Delta、Goals/Non-Goals、Glossary、Actors、Use Cases、Requirements、Acceptance Examples、Scope Boundaries、Evidence And Assumptions、Outstanding Questions。
- R17. PRD 必须补齐名词解释，并标明术语来源。
- R18. 核心产品用例必须包含 actor、trigger、precondition、main path、alternative/error path、outcome、covered requirements。
- R19. PRD 必须覆盖异常处理：权限异常、输入异常、状态冲突、弱网/超时、重复提交、部分成功、撤销/回滚、兼容/降级。
- R20. PRD 必须覆盖交互设计约束：入口、状态、反馈文案、确认/取消、空态、加载态、错误态、可访问性或国际化需求。
- R21. 条件型行为必须有 Given/When/Then 或 EARS 等价验收样例。
- R22. 无证据的 metrics、客户反馈、业务规则、交互文案必须进入 Assumptions 或 Outstanding Questions，不得编造。
- R23. PRD 不得包含 implementation units、文件改动计划、数据库 schema、接口字段设计或任务拆解。

**Domain Lenses**

- R24. `spec-prd` 必须按 target surface 加载差异化 lens，而不是用单一模板覆盖所有系统；这些 lens 是 PRD 作者期 lens，不替代 `spec-app-consistency-audit` 的 App PRD/Figma/source 一致性审计。
- R25. App lens 必须关注页面栈、导航、权限弹窗、弱网/离线、前后台切换、状态恢复、埋点、i18n/accessibility。
- R26. H5/PC lens 必须关注路由、表单、响应式、浏览器返回、登录态、刷新、SEO/分享、多视口行为。
- R27. Admin lens 必须关注 RBAC、列表筛选、批量操作、导入导出、审核/回滚、审计日志、危险操作确认。
- R28. Backend/Java lens 必须关注 API contract、状态机、幂等、事务、错误码、安全、性能、迁移、观测性、向后兼容。
- R29. CLI/DevTool lens 必须关注命令入口、参数、配置、dry-run/preview-first、日志、跨平台、失败恢复、升级路径。
- R30. Mixed lens 必须关注 source-of-truth、跨端一致性、接口契约、异步同步、降级策略和集成验收。

**Quality And Handoff**

- R31. `spec-prd` 必须复用 Requirements Readiness Gate；复用方式必须是抽取共享核心到 `docs/contracts/workflows/requirements-readiness-gate.md`，再由 `spec-brainstorm` 和 `spec-prd` 引用，`spec-prd` 只增加 PRD-specific lens。**Fallback（见 Risks 段）**：若 planning 评估物理抽取对 `spec-brainstorm` 回归风险过高，v1 可降级为 `spec-prd` by-reference 引用 gate 维度清单、物理抽取推迟到 v2；无论哪条都必须有 contract test 断言两处 gate 维度不 drift。
- R32. PRD-specific lens 必须检查 current-state accuracy、change delta clarity、exception coverage、interaction readiness、evidence provenance、planning invention risk。
- R33. Readiness 失败时，必须输出最小补齐问题或修订建议；用户选择带 assumptions 继续时，文档必须记录风险。
- R34. 完成后必须推荐下一步：继续 refine、`spec-doc-review`、`spec-plan` 或 done for now；不得直接进入 `spec-work`。
- R35. `spec-plan` 必须能把 `artifact_kind: prd-requirements` 的 `docs/brainstorms/*-requirements.md` 当普通 requirements artifact 消费。

**Skill And Agent Architecture**

- R36. `skills/spec-prd/SKILL.md` 必须保持精简，只保留触发、边界、核心 workflow、reference load 条件和 handoff。
- R37. 详细 current-state contract、PRD template、domain lenses、readiness lens 必须放入 references。
- R38. v1 不得新增独立 agent。
- R39. 后续新增 agent 必须是内部 reviewer/helper，不得作为用户公开入口，且必须有 eval 失败证据。
- R40. 不得新增第二套 evidence enum；PRD evidence tags 必须映射到 `docs/contracts/graph-evidence-policy.md`。
- R41. 不得新增 `docs/prds/` 作为默认真相源。

> **R 分层落地（H5 收口）**：上组 **Skill And Agent Architecture（R36-R41）是架构约束/实现纪律，不是用户可见的产品需求**。Decision Closure H5 裁决"实现纪律下沉"——本文不重排 R 编号以保持 AE/flow 引用稳定，但 planning 应把 R36-R41（及 R4 的"不拆公开 skill"、R23 的 HOW 禁令）当作 **Architecture Guardrails** 对待，不作为对等产品行为去逐条设计验收。真·产品行为需求是 R5-R22、R24-R35。这样 41 条里真正驱动 PRD 内容的约 ~25 条，落在 size 合理区间。

---

## PRD Quality Bar

高质量 PRD 不是章节填满，而是下游不需要发明 WHAT。

| Dimension | Pass signal | Fail signal |
| --- | --- | --- |
| 产品意图 | 用户目标、业务目标、target surface、增量范围明确 | 只有“优化/完善/支持” |
| 现状证据 | 关键 current-state claim 有 confirmed source、user-stated 或明确 assumption | GitNexus pointer 或猜测写成事实 |
| 增量边界 | Change Delta 区分 keep/extend/replace/remove/unknown | 新需求和现有能力混在一起 |
| 用例完整 | 核心 actor、trigger、precondition、main path、exception path、outcome 完整 | 只有功能列表 |
| 异常处理 | 关键异常有 expected behavior 和反馈 | 只写“提示错误” |
| 交互约束 | 入口、状态、反馈、确认/取消、空态/加载/错误态明确 | UI/交互靠实现者猜 |
| 验收样例 | 条件行为有 Given/When/Then 或 EARS 等价样例 | 无法判断实现是否满足 |
| Handoff | `spec-plan` 只需决定 HOW | 产品行为仍留给 planning 发明 |

---

## Evidence Contract

PRD evidence tags 是文档层便捷标签，不是新的 graph evidence contract。

| PRD tag | Meaning | Existing policy mapping |
| --- | --- | --- |
| `confirmed-source` | 已直接读源码、测试、文档或合同 | `confirmed` / plan `evidence_grade=primary` when source confirmed |
| `user-stated` | 用户明确表达的产品意图或业务规则 | confirmed for intent; not graph evidence |
| `gitnexus-pointer` | GitNexus query/context 等 session-local 或 advisory 线索 | `session-local` / `advisory` / `stale`; never primary without source confirmation |
| `external-research` | 用户显式要求的外部资料 | advisory unless directly sourced and dated |
| `assumption` | 未确认推断 | must stay in Assumptions or Outstanding Questions |

---

## Success Signals

这些是首版质量评估信号，不是业务增长指标，也不要求脚本在 v1 自动统计。

- S1. `spec-prd` fresh-source eval 中，brownfield PRD fixtures 不需要 `spec-plan` 发明新的产品行为、scope boundary 或 acceptance example。
- S2. `spec-doc-review` 对 `spec-prd` 产物的 P1/P2 product-gap finding 明显低于同输入直接走普通 `spec-brainstorm` 的对照产物。
- S3. routing fixtures 能稳定区分 0-1 idea、brownfield increment、existing PRD refine、App consistency audit request。
- S4. stale / dirty-advisory GitNexus pointer fixtures 中，PRD 把 provider claim 降级为 pointer 或 assumption，并要求 source confirmation。
- S5. 首版实现不新增 `docs/prds/`、不新增独立 evidence enum、不新增 public PRD 子 skill、不手改 generated runtime mirrors。

---

## Acceptance Examples

- AE1. **Covers R1-R4.** Given 用户要求完善已有 PRD，when `spec-prd` 运行，then workflow 以原 PRD 为 primary input，保留核心意图，并输出补强后的 PRD 或 addendum。
- AE2. **Covers R5-R6.** Given 用户提出 0-1 新产品想法，when 产品形态和核心流程未定，then workflow 推荐 `spec-brainstorm`，不得生成伪完整 PRD。
- AE3. **Covers R7-R13.** Given 用户只说“后台用户列表增加批量导入”，when 当前系统已有 Admin 列表与权限模式，then PRD 必须输出 Current System Snapshot、Change Delta、权限、导入校验、失败行反馈、审计日志和回滚问题。
- AE4. **Covers R11-R12, R40.** Given GitNexus 指向某 route 但源码读取发现 route 已重命名，when 写现状分析，then GitNexus claim 必须降级为 stale/advisory pointer，不得写成 confirmed fact。
- AE5. **Covers R17-R23.** Given PRD 草稿缺少术语、用例、异常和交互，when refine 完成，then PRD 必须包含 Glossary、Use Cases、Exception Handling、Interaction Requirements 和 Acceptance Examples。
- AE6. **Covers R24-R30.** Given target surface 是 Backend/Java，when 生成 PRD，then 输出必须关注 API contract、幂等、事务、错误码、兼容和观测性，而不是套用 App 页面模板。
- AE7. **Covers R31-R35.** Given readiness lens 发现产品行为仍未决，when workflow 收尾，then 输出最小补齐问题或记录带 assumptions 继续的风险，并推荐 `spec-doc-review` 或 `spec-plan`。
- AE8. **Covers R36-R41.** Given 规划 `spec-prd` v1，when implementation plan 编写，then 不新增 agent、不新增 `docs/prds/`、不新增 evidence enum，并把详细模板放入 references。
- AE9. **Covers R6, R24, R31.** Given 用户说“App 订单页增加异常提示，帮我完善 PRD”，when 路由判断，then 进入 `spec-prd` 写 PRD；given 用户说“拿这份 PRD、Figma、源码做一致性审计”，then 推荐 `spec-app-consistency-audit`。
- AE10. **Covers R31.** Given planning 抽取共享 readiness gate，when 实现 `spec-prd`，then `spec-brainstorm` 与 `spec-prd` 引用同一个 `docs/contracts/workflows/requirements-readiness-gate.md` 核心，不复制两份 gate 文案。

---

## Implementation Direction

- U1. 抽取共享 `docs/contracts/workflows/requirements-readiness-gate.md`，并把 `spec-brainstorm` 的 gate 引用迁移到该共享核心。
- U2. 新增 `skills/spec-prd/SKILL.md`，保持精简，只写触发、边界、workflow、reference load 条件和 handoff。
- U3. 新增 `skills/spec-prd/references/current-state-analysis.md`。
- U4. 新增 `skills/spec-prd/references/prd-output-template.md`。
- U5. 新增 `skills/spec-prd/references/domain-lenses.md`，明确 App lens 与 `spec-app-consistency-audit` 的边界。
- U6. 新增 `skills/spec-prd/references/prd-readiness-lens.md`，引用共享 gate 并追加 PRD-specific lens。
- U7. 新增 `skills/spec-prd/references/intent-routing.md`，固化 create/refine/validate、code-align posture 和 `spec-brainstorm` tie-break。
- U8. 新增 host command template 与 dual-host governance 注册。
- U9. 更新 `using-spec-first` 路由规则，区分 `spec-brainstorm`、`spec-prd`、`spec-app-consistency-audit`。
- U10. 更新 `spec-plan` intake 文档，确认 `artifact_kind: prd-requirements` 等价消费。
- U11. 补 focused tests：skill entrypoint lint、public workflow registration、routing tie-break、shared gate drift、spec-plan intake、no generated runtime manual edit。
- U12. 增加 fresh-source eval fixtures。
- U13. 更新 README / README.zh-CN / 用户手册 artifact map / CHANGELOG。

---

## Evaluation Plan

| Fixture | Input | Expected behavior |
| --- | --- | --- |
| Existing PRD refine | 已有 PRD path，要求“完善” | 保留原意，输出 gap report、current-state snapshot、补齐后的 PRD |
| One-line Admin iteration | “后台用户列表增加批量导入” | 触发 Admin lens，补权限、导入校验、失败行反馈、审计/回滚问题 |
| 0-1 idea | “想做一个新社区产品” | 推荐 `spec-brainstorm`，不生成伪 PRD |
| Backend/Java change | “给现有订单状态增加取消原因” | 关注状态机、错误码、幂等、兼容、观测性 |
| Stale GitNexus pointer | GitNexus 与源码不一致 | 降级 GitNexus pointer，以源码为准 |
| No-agent v1 boundary | 用户问是否要多个 agent | 回答 v1 不新增 agent，除非 eval 证明需要内部 reviewer |
| PRD readiness fail | PRD 缺异常和验收 | 输出最小补齐问题或修订建议，不进入 `spec-work` |
| Claude-risk regression | 实现新增 `docs/prds/` 或独立 evidence enum | eval / contract test 失败，要求回到 shared artifact 与 existing evidence policy |
| App audit boundary | “App PRD + Figma + source 一致性审计” | 推荐 `spec-app-consistency-audit`，不把 `spec-prd` 当审计 workflow |
| Brownfield tie-break | “现有后台用户列表增加导入，帮我写 PRD” | 优先 `spec-prd`，不回到泛化 brainstorm |
| Shared gate drift | `spec-brainstorm` 和 `spec-prd` gate wording 不一致 | contract test 失败，要求回到 shared readiness gate |

---

## Risks And Mitigations

> `002` 有 Risks 段，`003` 精简时遗漏。补回，并新增 `003` 特有的 shared-gate 抽取风险——它是本稿唯一会改动 `spec-brainstorm` 既有 source 的决策。

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **R31/U1 抽取共享 readiness gate 会动 `spec-brainstorm` source** | 把 gate 从 `requirements-capture.md` 抽到 `docs/contracts/workflows/requirements-readiness-gate.md` 需改 brainstorm 引用 + 双宿主回归，并可能触动已 completed 的 `2026-05-29-001` Requirements Readiness Gate plan | Planning 先评估抽取成本；**fallback**：若抽取对 brainstorm 回归风险过高，v1 允许 `spec-prd` 在自己的 `prd-readiness-lens.md` 内**引用 gate 的维度清单(by reference,不复制全文)**，把物理抽取降级为 v2 重构。无论哪条，contract test 必须断言两处 gate 维度不 drift |
| `spec-prd` 与 `spec-brainstorm` 路由冲突 | 用户不知走哪个入口 | D12 tie-break + routing fixtures（Evaluation Plan 中 Brownfield tie-break / 0-1 idea 两条） |
| `spec-prd` 与 `spec-app-consistency-audit` 边界混淆 | App 场景重复或漏审 | D11 边界 + AE9 + App audit boundary fixture；两 skill 的 When-Not-To-Use 互相点名 |
| PRD 变成实现方案 | 绕过 `spec-plan` source-of-truth | R23 + PRD-specific lens 的 planning invention risk 检查 |
| GitNexus pointer 被写成事实 | 现状不准 | R11/R12/R40 evidence tags + source confirmation；Stale GitNexus pointer fixture |
| 模板过重拖累小需求 | 小需求负担上升 | right-sized section inclusion + references 按需加载 |
| 过早新增 agent | 维护成本与上下文膨胀 | R38 v1 禁止；R39 要求 eval 失败证据 |
| 多端 lens 关注点混用 | App/Admin/Backend 需求串味 | R24-R30 lens matrix + 各 surface acceptance fixture |

---

## Key Decisions

- D1. 新增 1 个公开 skill：`spec-prd`。
- D2. `spec-brainstorm` 继续负责 0-1 / WHAT shaping。
- D3. `spec-prd` 负责已有系统上的增量需求迭代 PRD 输出。
- D4. create/refine/validate 是内部 intent；code-align 是 evidence posture / 子模式，不拆公开入口。
- D5. v1 不新增 agent。
- D6. PRD artifact 默认仍写 `docs/brainstorms/*-requirements.md`。
- D7. Requirements Readiness Gate 共享核心抽到 `docs/contracts/workflows/requirements-readiness-gate.md`；`spec-prd` 仅增加 PRD-specific lens。
- D8. 复用 graph evidence policy，不新增 evidence 权威体系。
- D9. Current-state analysis 是核心差异化，但不得反向驱动 HOW。
- D10. `001/002` 作为 Claude 侧分析输入；本 `003` 是 owner 当前 planning source。
- D11. `spec-prd` 的 App lens 是 PRD 作者期 lens；PRD/Figma/source 一致性审计继续归 `spec-app-consistency-audit`。
- D12. 路由 tie-break：现有系统锚点 + PRD/需求文档目标优先 `spec-prd`；产品形态/actor/core outcome 未定优先 `spec-brainstorm`。
- D13. 外部竞品研究是 opt-in advisory evidence，不进入默认 PRD run。

---

## Outstanding Questions

### Resolve Before Planning

- None. 产品形态、skill 数量、agent 策略、artifact 策略、evidence 策略、App audit 边界、shared readiness gate 复用方式和 `spec-brainstorm` / `spec-prd` 路由 tie-break 均已收敛。

### Deferred to Planning

- [Affects R31/U1][Architecture] **shared readiness gate 的落地路径二选一**：物理抽取到 `docs/contracts/workflows/requirements-readiness-gate.md`(改动 brainstorm,需双宿主回归)vs v1 先 by-reference 引用、抽取推迟 v2(见 Risks 段 fallback)。plan 第一步应先评估抽取对 `spec-brainstorm` 的回归成本再定，两条都要 contract test 断言 gate 不 drift。
- [Affects U8][Technical] Claude/Codex command template、dual-host governance 注册点由 `spec-plan` 根据当前 source generator 确认。
- [Affects U10][Technical] `spec-plan` intake 是否需要 contract test fixture 覆盖 `artifact_kind: prd-requirements`。
- [Affects U12][Evaluation] fresh-source eval 用现有 reviewer 机制还是最小 read-only fixture prompt 执行。

---

## 审查校准注记（2026-05-30 全面审查）

本文已作为 planning 唯一 source。全面审查后修复/标注的点，供 plan 阶段注意：

- **结构修复**：上一轮插入 Risks 段时误吞了 `## Key Decisions` 标题与 D1，已还原。
- **Traceability 校准（建议 plan 收口，未逐条改以免再动结构）**：Key Flows 的 `Covered by` 与 AE 的 `Covers` 把 **meta requirement 误当 flow/AE 覆盖项**——R1(新增 skill 存在性)、R2(定位)、R4(code-align posture)是架构 meta，不是某条 Given/When/Then 能验收的行为。F1 应覆盖 R3+R7-R10+R16-R20(而非 R1/R22)；AE 的范围式 `Covers R1-R4` 应收窄到真正验收的行为 R。这不改变需求实质，只是覆盖映射的精度，plan 生成 traceability 时按此校准。
- **事实时效**：R12 与 frontmatter graph note 已从"钉死当前 dirty-advisory 快照"改为"按 graph-evidence-policy 条件判定"，避免 graph 刷新后文档过期。
- **冗余**：Owner Decision 表、Decision Closure、20-Round、Key Decisions(D1-D13)、Risks 之间有内容重复(单入口/无 agent/shared gate/tie-break 各说多遍)。owner-final 保留以自洽，plan 引用时认 Key Decisions(D1-D13)与 Requirements(R)为准，其余为论证过程。
