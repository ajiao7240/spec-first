---
title: "feat: spec-prd 前置需求澄清循环"
type: feat
status: active
date: 2026-06-22
spec_id: 2026-06-22-003-spec-prd-requirements-grill
plan_depth: deep
method_source: external local grill-with-docs skill, advisory method input only
---

# feat: spec-prd 前置需求澄清循环

## Summary

本计划把外部 `grill-with-docs` 深度集成到 `spec-prd` 的需求文档阶段：当用户输入粗颗粒度、不完整、会迫使后续 planning 发明 WHAT 的初版 PRD 时，`spec-prd` 先做 PRD sanitization、problem/outcome framing 和 source-first evidence calibration，再用 `Preliminary Diagnosis` 决定是否需要 shared understanding map、Map-Reduce、P0/P1 packs 或 route-out。对超大或多来源 PRD 输入，前置澄清显式采用 run-local Map-Reduce 证据归约纪律：chunk-level Map 保留 source refs 和原子需求，semantic Shuffle 按 actor/flow/data/state/permission/PRD section 聚组，Reduce 合并重复、暴露冲突并产出 blockers、assumptions、write targets 和 owner questions。随后用 `grill-with-docs` 式 Deep Requirements Grill 逐一压测术语、场景、代码矛盾和决策依赖，用 1-3 个经 load-bearing triage 排序的高价值 owner 问题补齐 actor、flow、state、exception、acceptance、scope 和 decision intersection，rewrite 后再由 `Final Readiness Diagnosis` 判断是否可进入 planning。方案同时把 `CONTEXT.md` / `CONTEXT-MAP.md` / `docs/adr/` 拓扑作为可选 evidence and promotion adapter：先读取现有 topology 作 source evidence，PRD 内先闭环，满足稳定术语或 hard-decision promotion criteria 时再 preview-first 生成 glossary/ADR 候选更新。PRD 质量基线收敛为只在 planning-invention risk 命中时展开的 P0/P1 conditional packs：P0 覆盖问题/结果、指标口径、NFR/约束、traceability、owner closure；P1 覆盖角色对齐、设计证据、release slice 和多轮变更治理。所有补充仍先落入既有 PRD sections，不新增公开 workflow 节点，不改变 `docs/brainstorms/*-requirements.md` 的 PRD artifact 拓扑。

---

## Decision Brief

- **Recommended approach:** 采用“深度方法集成，不复制节点”的方案：在 `spec-prd` intake/sanitization 之后、正式 PRD rewrite/readiness 之前加入 PRD-local `Deep Requirements Grill`，把 `grill-with-docs` 的 source-first、one-question-at-a-time、recommended answer、glossary challenge、scenario stress、code cross-reference、sparse decision capture 和 context/ADR topology awareness 全部前置到需求文档阶段；再用 P0/P1 PRD-quality packs 补齐与 planning-invention risk 直接相关的 PRD 基线缺口。复用当前五个 reference 文件、eval fixtures 和 contract tests，不把 `grill-with-docs` 拷贝为独立 executable node。
- **Key decisions:** `Deep Requirements Grill` 负责把粗 PRD 的声明、证据、缺口、问题/假设、术语决议、场景压力结果、代码矛盾和 PRD 写入目标串成 shared understanding；`Context / ADR Topology Adapter` 负责读取现有 `CONTEXT.md` / `CONTEXT-MAP.md` / ADR 作为 evidence，并在 PRD closure 后提出 preview-first promotion candidates；large-input Map-Reduce 只作为 run-local evidence reduction，不升级为持久 schema 或脚本语义 gate；diagnosis 分成 preliminary 和 final 两段，前者决定展开层级，后者决定 planning readiness；P0/P1 packs 只在触发时展开。`Domain Grill` 继续专治术语、矛盾、source-of-truth 和硬边界。
- **Validation focus:** 锁定前置 trigger/non-trigger、shared understanding map、large-input Map-Reduce source refs、cross-chunk dedupe/conflict merge、context/ADR topology adapter、P0/P1 pack trigger、问题上限、推荐答案格式、write-target 映射、trace/closure readiness、eval fixtures、source topology 不增文件、script/LLM ownership 不漂移，以及 generated runtime mirror 不被当 source。
- **Largest risks / boundaries:** 最大风险是把前置澄清做成长访谈、brainstorm replacement 或第二套 PRD 平台。本计划要求只处理已有粗 PRD/已有系统锚点；P0/P1 packs 是 conditional authoring discipline，不是强状态机、完整 PRD 平台或固定长模板。

---

## Problem Frame

当前 `spec-prd` 已能处理 brownfield PRD create/refine/validate：它先做 PRD Sanitization 和 current-state evidence，再确认 Change Delta、Domain Grill、Feature Slices、readiness 和 handoff。现有 `Domain Grill` 已吸收一部分 `grill-with-docs` 思想，但主要覆盖领域语言、术语矛盾、source-of-truth、权限/状态/异常边界和 hard decision。用户现在描述的真实输入形态更宽：用户给的是初版 PRD 需求文档，颗粒度粗、需求不完整，需要先理解需求、补齐语义和共同认知，再写出可交给 planning 的 PRD。

上一版方案把这个能力主要表达为 `Requirements Grill Pass`，容易被实现成 PRD rewrite 之前的一个质量诊断后置步骤。这里需要收紧：`grill-with-docs` 的精髓不是“多问几个问题”，而是对 shared understanding 做 pressure loop。它应该前置到粗 PRD 进入正式 PRD artifact 之前，先把初版 PRD 中的 claim、source/evidence、gap、question/assumption 和 PRD write target 连起来，再决定哪些内容能写入 PRD、哪些必须问 owner、哪些只能作为 assumption 或 blocker。

这个缺口不能交给 `spec-plan`。`spec-plan` 定义 HOW，如果 PRD 仍缺 actor、key flow、exception、scope、acceptance 或 unresolved decision intersection，planning 会被迫发明 WHAT，破坏 `Spec -> Plan` 的职责边界。

同时，直接拷贝 `grill-with-docs` 作为 `spec-prd` workflow 的一个节点也不合适：

- 外部 skill 默认会创建或维护 `CONTEXT.md`、`CONTEXT-MAP.md` 和 `docs/adr/`，会给 `spec-prd` 引入第二套 truth source。
- “Interview me relentlessly” 与 `spec-prd` 的 minimize blocking、1-3 owner questions 和 PRD authoring flow 冲突。
- 它是 plan/domain language stress-test 工具，不是 PRD artifact producer；直接作为节点会混淆 `docs/brainstorms/*-requirements.md` 的 producer/consumer contract。
- 它的 glossary/ADR 拓扑有价值，但必须以 adapter 方式接入：读现有 topology 做 evidence，PRD-local closure 先完成，再按 promotion criteria 产出可审查的 context/ADR candidate，不能把 `CONTEXT.md`/ADR 变成每个 PRD run 的必填输出。

因此，本计划的核心是把 `grill-with-docs` 的提问架构重述为 `spec-prd` 原生前置澄清纪律：shared understanding first, source first, one decision at a time, recommended answer, concrete consequence, PRD-local persistence。

深度集成的含义不是“在 PRD 写完后再审一遍”，而是在需求文档阶段完成对后续研发最有影响的问题确认：术语是否与既有 glossary/代码一致、用户所说的系统行为是否与当前代码一致、场景是否覆盖入口/状态/异常/权限、每个 owner answer 是否带推荐答案和后果、每个决议是否落回 PRD-local section。若项目已有 `CONTEXT.md`、`CONTEXT-MAP.md` 或 `docs/adr/`，它们应成为 source-first evidence；若本轮 PRD 产生了稳定项目术语或难逆的真实取舍，则输出 context/ADR promotion candidate。这样后续 `spec-plan`、task pack 和 `spec-work` 消费的是质量更高的需求输入，而不是把 WHAT 缺口延迟到研发阶段。

对超大需求文档，还需要把 shared understanding map 前面的“读入”显式化。不能把 100 页 PRD 简单切块摘要后拼接，因为摘要会丢掉 source refs、局部例外、跨段冲突和术语漂移。更合适的是 Map-Reduce authoring discipline：Map 阶段从每个 chunk 抽取 claim/evidence/source/gap/write-target candidate；Shuffle 阶段按 actor、flow、feature、data object、state、permission、exception、PRD section 和 source contradiction 聚组；Reduce 阶段合并重复 claim、保留冲突证据、归约 load-bearing gaps，并只把会影响 planning invention 的 blockers、assumptions、owner questions 和 PRD write targets 送入后续 Pre-PRD Clarification Loop。这个 Map-Reduce 是 LLM-owned run-local 推理脚手架，不是新脚本、持久 extraction schema、向量索引、分段摘要 artifact 或 `spec-plan` 前置节点。

进一步对照业界 PRD 基线后，本计划只吸收与 planning-invention risk 直接相关的 P0/P1 质量闭环。P0 负责防止 PRD 只变成“功能清单”：在信号命中时确认问题/结果、指标口径、产品级 NFR/约束、R->AE->evidence trace 和 owner closure。P1 负责在复杂 surface 明确命中时增强 PRD：角色/利益相关方、设计/UX 证据、release slice 和多轮 refine change management。它们都必须是轻量 packs，而不是新增 artifact、schema 或公开 workflow。

P0/P1 pack basis 是本仓现有 `spec-prd` gaps 与通用 PRD authoring lens 的交集，不是外部行业事实真相源：只保留能减少 `spec-plan` 发明 WHAT 的问题/结果、metrics、NFR、trace、closure、actor/design/release/change-management 信号；排除完整市场分析、商业审批流、法务模板、路线图治理和实现架构字段。若后续真实 rough PRD 样本显示某 pack 低频、重复既有 lens、或增加 ceremony 大于减少 planning entropy，应在后续计划中降级、合并或删除该 pack。

---

## Requirements

- R1. 当 `intent=create|refine|validate` 且 `input_posture=reference-claims|resume-prd|pure-text`，输入是粗 PRD/draft/reference claims/会议/聊天/截图/PDF 提取文本、且已有产品或系统锚点足以进行 PRD refinement，并且 `quality_diagnosis=material-gaps|blockers` 或 planning 会发明 WHAT 时，`spec-prd` 必须在正式 PRD rewrite/output 前触发 `Pre-PRD Clarification Loop`。若缺少目标用户、产品问题、系统锚点或核心场景，先路由到 `spec-brainstorm`，不得新增 `create-from-draft` intent 或把 0-1 product discovery 塞进 `create/refine`。
- R2. `Pre-PRD Clarification Loop` 必须维护 run-local shared understanding map：`claim -> evidence/source -> gap -> question_or_assumption -> PRD write target`。它是推理脚手架，不是持久 schema、report 或新 artifact。
- R3. 前置澄清必须先查可回答的 source/docs/tests/contracts/glossary/prior PRDs，再问 owner；可由 source 解决的问题不得包装成 owner 决策。
- R4. 每个 owner 问题必须一次只问一个，并携带 `recommended_answer`、`why_recommended`、`source_tag`、`consequence_if_chosen`、`consequence_if_not_chosen` 和 `write_target`。
- R5. 普通 PRD run 的前置澄清问题上限为 1-3 个；提问前必须按 acceptance impact、behavior/scope irreversibility、影响的 PRD section 数量、source contradiction、release/planning consequence 对 load-bearing gaps 排序。超过 3 个 load-bearing gaps 时必须输出 prioritized blocker cluster、推荐下一 route、可接受 assumptions 和受影响 PRD write targets，而不是长访谈；该状态不得标记 `ready-for-planning`。
- R6. 结果只能写入 `prd-output-template.md` 已有 core/conditional PRD-local sections，例如 `Summary`、`Problem Frame`、`Current System Snapshot`、`Change Delta`、`Requirements`、`Acceptance Examples`、`Scope Boundaries`、`Evidence And Assumptions`、`Outstanding Questions`、`Glossary`、`Decision Notes`、`Actors`、`Use Cases`、`Interaction Requirements`、`Exception Handling`、`Negative Acceptance`、`Data / Compliance Boundaries`、`Release / Operation Readiness`、`Goals / Success Metrics` 和 `Feature Slices`。`write_target` 是 section 指针，不是新字段集；不得默认创建 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/`、新 PRD report 或第二套 topology。
- R7. `Domain Grill` 与前置需求澄清必须分工清晰：前者处理术语/矛盾/source-of-truth/硬边界，后者处理粗 PRD 的行为完整性、场景覆盖、验收和 scope completeness；二者共享问法纪律但不互相替代。
- R8. Readiness lens 必须检查前置澄清 closure：load-bearing rough-PRD gaps 已经通过 source、owner answer、明确 assumption、Outstanding Question 或 revise/doc-review route 处理，planning 不再需要补 WHAT。
- R9. Eval fixtures 和 contract tests 必须覆盖 rough PRD trigger、shared understanding map、source-first resolution、recommended-answer discipline、1-3 问题上限、no context artifact、PRD-local write target、script/LLM boundary 和 `spec-plan` 不复制 readiness。
- R10. 实现不得新增公开 skill/agent 入口，不手改 generated runtime mirrors，不改变 `artifact_kind: prd-requirements` 和 `docs/brainstorms/*-requirements.md`。
- R11. Scripts 只能产 deterministic facts、counts、trace gaps、literal drift 或 structure warnings；是否触发前置澄清、问题是否 load-bearing、是否 ready-for-planning 仍归 LLM/readiness judgment。
- R12. P0 `Problem / Outcome Framing Gate` 在 draft 只描述功能、缺少目标用户/问题/期望可观察结果、或 planning 会因此发明价值判断时触发；缺任一 load-bearing 项时，要么问一个 owner 问题，要么写入 `Outstanding Questions` / `Evidence And Assumptions`，0-1 机会探索仍路由 `spec-brainstorm`。
- R13. P0 `Success Metrics / Measurement Readiness` 在 PRD 使用“提升/优化/减少/改善/加速/降低成本”等目标词且该目标会影响验收或优先级时触发：有可信来源时写 metric/target/window，没有可信来源时写 observable signal、assumption 或 Outstanding Question，禁止编造目标值。
- R14. P0 `NFR / Constraint Pack` 在安全、权限、隐私、合规、支付/交易、外部 API、CLI/runtime、migration、批量/异步/数据同步或用户可见失败场景命中且会影响 WHAT/acceptance/release boundary 时触发，提取产品级约束、负向验收、运营/发布边界和异常语义；不得把数据库、API 字段或实现架构写成 PRD requirement。
- R15. P0 `Traceability Matrix` 在核心 requirement 会被 planning 消费时触发，让 requirement 能追到 acceptance example、evidence/source 或显式 trace gap；可用轻量 `R -> AE -> evidence/source -> open question` 规则，不新增 schema。
- R16. P0 `Review / Approval Closure` 在 closeout/readiness 前汇总实际存在的 owner answers applied、accepted assumptions、blocking questions、ready-for-planning 和 planning_would_invent_what；compact PRD 无对应信号时记录 none/zero，不强制新增重型 section。该 summary 可进入最终回复或 PRD-local sections，不创建新 artifact。
- R17. P1 `Stakeholder / Actor Alignment` 在 Admin、Backend、CLI/DevTool、Mixed surface、权限/审批、producer/consumer 或下游消费信号命中时，必须区分 beneficiary、operator、admin、downstream consumer 和 owner。
- R18. P1 `Design / UX Evidence Hook` 在 App/H5/PC/Admin、截图、Figma、页面描述或交互状态输入命中时，必须只抽取 PRD 相关事实：入口、状态、文案、空/错/加载态、权限、i18n/accessibility；不得替代 `spec-app-consistency-audit`。
- R19. P1 `Prioritization / Release Slice` 在 requirement 数量大、目标多、多端/mixed-surface 或 release order 影响范围/验收时，必须明确 P0/P1/deferred、owner-confirmed split 或 Feature Slices；Feature Slice 仍是 PRD handoff unit，不是 task 或 implementation unit。
- R20. P1 `Change Management` 在 `resume-prd`、existing PRD path、多轮 refine 或新增会议/截图/评审结论输入时，必须保持 stable R/AE IDs，并记录新增、替换、废弃或仍待确认的 PRD delta，不得静默改写旧 requirement。
- R21. 当输入为超大 PRD、多个文档/会议/截图/PDF 混合输入、或单次上下文无法可靠整体判断时，`Pre-PRD Clarification Loop` 必须采用 run-local Map-Reduce 证据归约：Map chunk-level 需求原子并保留 `source_ref`、confidence、write-target candidate；Shuffle 按 actor/flow/feature/data/state/permission/exception/PRD section/source contradiction 聚组；Reduce 输出 canonical requirement candidates、deduped assumptions、conflict set、load-bearing gaps、prioritized blocker cluster 和最多 1-3 个 owner questions。不得把 chunk summary 当 source-of-truth、不得丢失 source refs、不得新增持久 extraction artifact/schema 或让脚本裁决语义 completeness。
- R22. PRD 执行必须拆分为 `Preliminary Diagnosis` 和 `Final Readiness Diagnosis`：前者只决定输入规模、系统锚点、是否需要 Map-Reduce、哪些 P0/P1 packs 触发、是否 route-out；后者只在 PRD rewrite 后判断 unresolved gaps 是否仍会让 planning 发明 WHAT。不得把 preliminary diagnosis 的 `ready/minor/material/blockers` 当最终 `ready-for-planning`。
- R23. 前置澄清必须遵守 Progressive Detail Ladder：L0 compact PRD、L1 shared understanding map、L2 large-input Map-Reduce、L3 P0 packs、L4 P1 packs、L5 blocker cluster / route-out。每层必须有 trigger 与 stop condition；未触发的层不得展开，避免小 PRD 被重流程拖慢。
- R24. Map-Reduce 与 shared understanding 的 scratch output 可以在 prompt/reference 中给出形状，但只能是 run-local shape：`Map row = source_ref / claim / actor / flow / state / gap / confidence / write_target_candidate`，`Reduce output = canonical_requirement / supporting_refs / conflicts / assumptions / load_bearing_gap / owner_question_candidate / affected_write_targets`。这些不是 schema、artifact、JSON contract 或持久字段。
- R25. `Deep Requirements Grill` 必须覆盖 `grill-with-docs` 的七个核心动作并适配到 PRD 阶段：一问一答推进、每问提供 recommended answer、先查 code/docs/tests/contracts 再问 owner、挑战既有 glossary 冲突、锐化 fuzzy/overloaded terms、用具体场景压测边界、对照代码暴露矛盾。每个动作只处理会影响 PRD WHAT 或 planning readiness 的 load-bearing 问题。
- R26. 需求文档阶段必须关闭所有 load-bearing grill questions：要么由 source evidence 解决，要么由 owner answer 解决，要么写入 accepted assumption，要么进入 `Outstanding Questions` / blocker cluster / route-out。只要仍存在会影响 actor、flow、state、exception、scope、acceptance、permission、release slice 或 decision intersection 的未决问题，就不得 `ready-for-planning`。
- R27. `grill-with-docs` 的 `CONTEXT.md` 与 ADR 持久化模型必须改写为 PRD-local persistence first：术语决议优先写入 `Glossary`，避免词可写入 `_Avoid_`/说明性 prose；硬决策、取舍和后果写入 `Decision Notes`、`Evidence And Assumptions` 或 `Scope Boundaries`。PRD-local closure 是 planning handoff 的必要条件；project-level promotion 是独立的可审查候选，不替代 PRD closure。
- R28. `Context / ADR Topology Adapter` 必须在 source-first evidence 阶段读取已有 `CONTEXT.md`、`CONTEXT-MAP.md`、context-specific `CONTEXT.md` 和 `docs/adr/**`，并把匹配结果标记为 evidence source。若 topology 不存在，不得自动创建为前置条件；若存在多 context 且当前 topic 归属不清，最多提出一个 owner/context routing question 或把归属写入 blocker。
- R29. 当 PRD 中产生稳定项目术语时，必须判断是否生成 `CONTEXT.md` promotion candidate：只有当术语 project-specific、owner accepted、在当前 PRD/source 中重复出现或影响跨团队理解、且有明确 avoid terms / definition 时，才建议更新现有 context 或创建 lazy context；候选必须 preview-first，不能 silent write。
- R30. 当 PRD 中产生 hard decision 时，必须判断是否生成 ADR promotion candidate：只有当决策同时满足 hard-to-reverse、surprising without context、real trade-off 三条件时，才建议 ADR；候选需包含 context、decision、why、considered alternatives/consequences only when useful，并保留 PRD source refs。未满足三条件的决议留在 PRD `Decision Notes`。

---

## Assumptions

- A1. 本计划不从现有 brainstorm requirements 继承 `spec_id`。它直接来自当前用户请求和外部本地方法输入，属于新的 plan-local spec chain。
- A2. 现有 `skills/spec-prd/references/domain-language-and-decision-ledger.md` 可以继续作为 question format 和 decision note discipline 的承载文件；为保持 source topology 不扩张，首选修改既有 reference，而不是新增 `requirements-grill.md`。若实现时发现单一 reference 会混合两个以上 ownership domains、造成同一锚点重复、使 Pre-PRD loop 无法独立解释，或 reference prose 明显超过可维护阅读预算，可新增第六个 reference，但必须同时更新 topology tests、changelog 和 source/runtime 边界说明。具体复核点：`prd-output-template.md`(当前约 337 行)在 U3、U8、U13 三个单元都会被追加内容，落地每个单元时必须按上述阈值显式判断它是否应拆出第六个 reference，而不是默认继续堆叠。
- A3. `Pre-PRD Clarification Loop` 不需要新脚本。现有 `check-prd-artifact.js` 仍只报告结构/trace facts；新的完整性判断先通过 prompt/eval/contract test 锁定。
- A4. `tests/unit/spec-prd-contracts.test.js` no longer asserts a hard `SKILL.md` line/char ceiling (the former `<=170` lines / `<=15000` chars assertions were removed). Keeping `SKILL.md` a compact orchestrator is now prose discipline, not an automated gate: if anchor text grows, push detail down into existing references rather than re-adding a numeric ceiling or a new runtime template. U6 may add a structural assertion (entrypoint keeps only anchors, detailed rules live in references) as a replacement guardrail if implementation wants automated backstop. Bloat likelihood is treated as Low because the plan already routes every detailed rule into references and the entrypoint only gains compact anchors; the structural assertion stays optional rather than mandatory, so no automated backstop is required for this plan to be safe.
- A5. PRD 最佳实践在本计划中只作为 authoring lens 和 readiness prompts，不升级为外部事实真相源；项目 source、owner decision 和 confirmed evidence 仍优先。P0/P1 pack 集合的 recheck condition 是：真实 rough PRD 样本或后续 doc-review 显示某 pack 与既有 Adaptive Product Expert Lens 重复、低频、或增加 owner ceremony 大于减少 planning invention。

---

## Scope Boundaries

- 不把 `grill-with-docs` 目录整体拷贝进 `skills/spec-prd/`。
- 不创建一个名为 `grill-with-docs`、`requirements-grill` 或类似名称的新公开 workflow/skill/agent。
- 不把 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/` 作为 `spec-prd` 默认 artifact、source-of-truth 或 readiness 前置条件。
- 不禁止读取或建议更新 existing `CONTEXT.md` / `CONTEXT-MAP.md` / `docs/adr/**`；它们作为 evidence/promotion topology 参与，但不得替代 PRD-local closure。
- 不把前置澄清循环做成强状态机、numeric PRD scorecard、长问卷或固定 checklist gate。
- 不把 P0/P1 packs 做成所有 PRD 必填的长模板；它们按触发条件展开，未触发时保持 compact PRD。
- 不让 `spec-plan` 运行自己的 grill workflow；`spec-plan` 只消费 PRD，发现 WHAT 缺口时反馈给 PRD refine。
- 不修改 `.claude/`、`.codex/`、`.agents/skills/` generated mirrors。source 变更后的 runtime sync 属于后续 setup/update 动作。
- 不把技术 HOW 补成 PRD requirement；API 字段、数据库、函数、任务拆分和实现单元仍归 `spec-plan` / `spec-work`。

---

## Completion Criteria

- `skills/spec-prd/SKILL.md` 在 Phase 1/2/3 之间明确说明 rough PRD refine 的前置澄清 trigger、shared understanding map、source-first resolution、问题上限、write-target 和 no artifact inflation。
- `skills/spec-prd/references/domain-language-and-decision-ledger.md` 或既有相邻 reference 明确承载前置澄清循环的 question format、trigger/non-trigger、Domain Grill 分工和 PRD-local persistence rules。
- `skills/spec-prd/references/prd-output-template.md` 明确 rough PRD quality diagnosis 到前置澄清循环的衔接，以及每类 gap 的 write target 映射。
- `skills/spec-prd/references/prd-readiness-lens.md` 在 Quality Diagnosis Pack / Core Pack / Domain And Decision Pack 中检查前置澄清 closure，不新增第二 evidence enum。
- 既有 references 明确 large-input Map-Reduce 是 run-local authoring discipline：chunk-level extraction 保留 source refs，semantic Shuffle 负责归组，Reduce 负责 dedupe/conflict/load-bearing gap 归约，且不得产生新 artifact/schema 或把摘要当真相源。
- 既有 references 明确 `Preliminary Diagnosis` 与 `Final Readiness Diagnosis` 分工，并提供 Progressive Detail Ladder 的 trigger/stop conditions，确保 compact PRD 不会被强制展开到 Map-Reduce 或 P0/P1 全量 packs。
- 既有 references 给出 Map row / Reduce output 的 scratch shape，同时明确这些 shape 不是 schema、artifact、JSON contract 或持久 PRD 字段。
- 既有 references 明确 `Deep Requirements Grill` 的七个核心动作、PRD-local persistence 适配、load-bearing closure 规则和 `CONTEXT.md`/ADR follow-up suggestion 边界。
- 既有 references 明确 `Context / ADR Topology Adapter`：发现 existing topology、context routing、glossary promotion criteria、ADR promotion criteria、preview-first candidate 输出和 no-silent-write 边界。
- `skills/spec-prd/references/prd-output-template.md` 增加 P0/P1 pack triggers 和 write targets，覆盖 problem/outcome、metrics、NFR constraints、traceability、closure、actor alignment、design evidence、release slice 和 change management。
- `skills/spec-prd/references/prd-readiness-lens.md` 增加 pack closure 检查，确保 unresolved P0 gaps 不会被标记为 `ready-for-planning`。
- `skills/spec-prd/evals/examples.json` 增加正反 fixtures，覆盖 trigger、bounded questions、recommended answer、source-first、no `CONTEXT.md`/ADR、write target 和 planning-invention failure。
- `skills/spec-prd/evals/examples.json` 增加 pack fixtures，覆盖 invented metrics rejection、NFR HOW boundary、trace gap closure、owner approval closure、design evidence hook、release slice 和 resume-prd change management。
- `skills/spec-prd/evals/examples.json` 增加 large-input fixture，覆盖 cross-chunk dedupe、contradiction preservation、source_ref carry-forward、section reducer 和 over-cap blocker cluster。
- `skills/spec-prd/evals/examples.json` 增加 progressive-detail fixtures，至少覆盖 `small-clear-prd-stays-compact`、`source-answerable-no-owner-question` 和 `huge-prd-cross-chunk-conflict`。
- `skills/spec-prd/evals/examples.json` 增加 deep-grill fixtures，覆盖 glossary conflict、fuzzy term sharpening、scenario stress、code contradiction、decision note closure 和 ADR follow-up suggestion boundary。
- `skills/spec-prd/evals/examples.json` 增加 topology adapter fixtures，覆盖 existing `CONTEXT-MAP.md` routing、context glossary conflict、lazy context candidate、ADR three-condition candidate 和 no topology required fallback。
- `tests/unit/spec-prd-contracts.test.js` 扩展 contract assertions，保证 source topology 仍为 8 个 source files、5 个 references，不新增 template tree 或 runtime mirror source。
- fresh-source eval 或等价 validation artifact 诚实记录当前 host 是否能做语义 eval；不能执行时记录 `not_run` 和原因，不声称 pass。
- `CHANGELOG.md` 记录 source 变更、用户可见影响、验证命令和 generated runtime mirrors 未手改状态。

---

## Direct Evidence Readiness

- target_repo: `spec-first`
- evidence_sources: direct source reads, `rg`, codegraph orientation, task-governance-signals advisory output, prior plans/requirements, current git status
- source_refs:
  - `skills/spec-prd/SKILL.md`
  - `skills/spec-prd/references/domain-language-and-decision-ledger.md`
  - `skills/spec-prd/references/prd-output-template.md`
  - `skills/spec-prd/references/prd-readiness-lens.md`
  - `skills/spec-prd/references/evidence-and-topology.md`
  - `skills/spec-prd/evals/examples.json`
  - `tests/unit/spec-prd-contracts.test.js`
  - `docs/validation/spec-prd/2026-06-22-spec-prd-execution-flow-ascii.md`
  - `docs/brainstorms/2026-05-30-003-spec-prd-owner-final-requirements.md`
  - `docs/plans/2026-06-03-001-feat-spec-prd-domain-grill-quality-loop-plan.md`
  - `docs/brainstorms/2026-06-02-002-spec-prd-quality-feedback-loop-requirements.md`
  - `docs/plans/2026-06-05-002-feat-spec-prd-sanitization-feature-slices-plan.md`
- current_revision: `9cee1af1` (plan authored against `58aca78b`; snapshot refreshed during doc-review follow-up. Re-read source refs before implementation since HEAD has advanced.)
- worktree_status: dirty before this plan; existing unrelated/prior-session changes include `CHANGELOG.md`, prior plans, solutions docs, `skills/spec-write-tasks/**`, and a deleted task pack. The hard `SKILL.md` line/char ceiling assertions in `tests/unit/spec-prd-contracts.test.js` were already removed and committed upstream. Implementation must not revert these.
- confidence: high for source topology and current `spec-prd` behavior; medium-high for fusion direction; medium for exact prose placement until implementation rechecks line/token limits.
- limitations: external local `grill-with-docs` was read as method input only and is outside the target repo; this plan intentionally omits its absolute path for portability. No runtime mirror regeneration or fresh-source semantic eval was performed during planning.

---

## Direct Evidence

- repo_scope: single repo, current working tree under `spec-first`
- source_reads_completed:
  - `skills/spec-prd/SKILL.md` shows Phase 0-4, default `docs/brainstorms/*-requirements.md` artifact invariant, no `docs/prds/`, no runtime mirror edits, current Domain Grill summary, and `owner_question_count` scratch field.
  - `skills/spec-prd/references/domain-language-and-decision-ledger.md` already contains Source-First Questioning, Bounded Scenario Grill, one-question cadence, recommended answer discipline, PRD-local write targets, and no default `CONTEXT.md`/ADR rule.
  - `skills/spec-prd/references/prd-output-template.md` already contains PRD Quality Diagnosis, `original -> recommendation -> reason -> write target`, Adaptive Product Expert Lens, core/conditional sections, and rough note sanitization.
  - `skills/spec-prd/references/prd-readiness-lens.md` already checks Quality Diagnosis Pack, Domain And Decision Pack, no context-artifact inflation, interaction/exception readiness, and handoff entropy.
  - `tests/unit/spec-prd-contracts.test.js` locks source topology to 8 files, references to 5 files, no template tree, no `CONTEXT.md` default, eval fixture IDs, and fresh-source eval artifacts. It no longer asserts a `SKILL.md` line/char ceiling.
  - External local `grill-with-docs` method docs define relentless one-at-a-time questioning, source/codebase lookup before asking, recommended answers, glossary sharpening, scenario stress tests, inline `CONTEXT.md` updates, and sparse ADR criteria.
- source_reads_required:
  - Re-read `skills/spec-prd/SKILL.md` immediately before editing to keep it a compact orchestrator and avoid disturbing the existing Phase 0-4 flow; there is no longer a hard line ceiling, so favor pushing detail into references over inflating the entrypoint.
  - Re-read all modified references before writing tests because current contract tests assert exact snippets and source topology.
  - Re-read `skills/spec-plan/SKILL.md` only if implementation changes PRD handoff wording; current plan does not require `spec-plan` source edits.
- commands_or_tools_used:
  - codegraph orientation over `spec-prd`, plan taxonomy, changelog, and tests.
  - focused `rg` for `Domain Grill`, `Bounded Scenario Grill`, `grill-with-docs`, `CONTEXT.md`, and prior plan references.
  - `spec-first internal task-governance-signals` with an input file; result was `candidate_level: deep`, `risk_domains: contract, workflow`, and `reason_codes: cross-module, critical-path-hit, candidate-deep`.
  - An earlier stdin attempt returned `planning-context-unreadable`; it is degraded advisory noise and not used for depth selection.
- impact_on_plan:
  - The helper-confirmed Deep classification matches the user request and source impact: this touches workflow prose, PRD readiness, eval fixtures, tests, and artifact boundaries.
  - Existing source already solved domain-language grill; new work must be narrower than copying the external skill and broader than terminology-only refinement.
- key_findings:
  - Current `spec-prd` has the right artifact spine and source/runtime boundaries.
  - Current `Domain Grill` does not explicitly name rough PRD shared-understanding completeness as a first-class pre-output loop.
  - External `grill-with-docs` is strongest as a questioning method, weakest as a direct artifact topology donor.
- limitations:
  - Planning did not implement or run new fixtures; those belong to the implementation plan execution.

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-prd/SKILL.md` should remain a compact orchestrator. It can name the `Pre-PRD Clarification Loop`, but detailed triggers and question format belong in references.
- `domain-language-and-decision-ledger.md` already owns the shared question format and decision note mapping, making it the lowest-cost place to add cross-cutting grill discipline without adding a sixth reference.
- `prd-output-template.md` already owns PRD Quality Diagnosis and write-target mapping, so rough PRD completeness gaps should connect there before final rewrite instead of becoming a standalone critique report.
- `prd-readiness-lens.md` already owns handoff entropy and readiness outcomes, so pre-PRD clarification closure belongs in existing packs.
- `tests/unit/spec-prd-contracts.test.js` is the right contract test surface because it already locks topology, entrypoint snippets, readiness snippets and eval fixture coverage.

### Related Prior Work

- `docs/plans/2026-06-03-001-feat-spec-prd-domain-grill-quality-loop-plan.md` already integrated a bounded Domain Grill inspired by `grill-with-docs`, explicitly rejecting `CONTEXT.md`/ADR defaults.
- `docs/brainstorms/2026-06-02-002-spec-prd-quality-feedback-loop-requirements.md` established that `spec-plan` should not invent PRD misses and should feed unresolved WHAT gaps back to PRD refine.
- `docs/plans/2026-06-05-002-feat-spec-prd-sanitization-feature-slices-plan.md` established PRD Sanitization and Feature Slices for mixed/raw drafts. Pre-PRD clarification should sit after sanitization and before formal rewrite, not replace either step.
- `docs/validation/spec-prd/2026-06-22-spec-prd-execution-flow-ascii.md` records the current Phase 0-4 execution flow and confirms the main remaining gap for this task is rough PRD completeness.

### External Method Input

- `grill-with-docs` contributes these reusable ideas: one question at a time, recommended answer, source/codebase lookup before owner questions, fuzzy term sharpening, concrete scenario stress tests, contradiction surfacing, and sparse decision records.
- The essence to carry into `spec-prd` is four pressure loops: claim-to-evidence pressure (do we know this or only assume it), language pressure (does the same term mean the same thing), scenario pressure (does the PRD survive real actor/flow/state/exception cases), and decision-closure pressure (does every owner answer land in a durable PRD section with consequences).
- Its default persistence model is not reused as a mandatory PRD output: root/context-specific `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/` are adapted as optional evidence and promotion topology, with PRD-local closure first and preview-first candidates only when criteria are met.

---

## Key Technical Decisions

- KTD1. **Fuse the method, not the node.** Do not copy `grill-with-docs` as an executable `spec-prd` workflow node. Re-express its questioning discipline inside `spec-prd` references to preserve one public PRD workflow and one PRD artifact chain.
- KTD2. **Add Pre-PRD Clarification as a loop, not a new artifact.** The loop is run-local authoring discipline. It maintains a temporary shared understanding map, but does not create a schema, report, lifecycle state, or second PRD topology. Context/ADR changes, when warranted, are preview-first promotion candidates rather than hidden PRD side effects.
- KTD3. **Trigger on planning-invention risk.** The decisive trigger is not “PRD is imperfect”; it is “without resolving this gap, `spec-plan` must invent WHAT”. Minor wording polish can stay in normal optimization suggestions.
- KTD4. **Keep Domain Grill distinct.** Terminology/source contradiction/source-of-truth ambiguity stays in Domain Grill; actor/flow/acceptance/scope completeness gaps are handled by Pre-PRD Clarification. If a question touches both, classify by the consequence: term precision if it changes naming only; requirements clarification if it changes behavior or acceptance.
- KTD5. **Source-first before owner-first.** Repo/docs/tests/contracts/glossary/prior PRDs are checked before asking. The owner should adjudicate product decisions, not facts already available from source.
- KTD6. **Recommended answers are mandatory when defensible.** The loop should reduce owner cognitive load. A question without a recommended answer is allowed only when all available evidence is genuinely ambiguous and any default would invent product scope.
- KTD7. **Questions have write targets.** Every question points to a PRD section before it is asked, preventing detached interview notes and making the final rewrite deterministic enough to review.
- KTD8. **Cap normal clarification runs at 1-3 questions.** More than 3 load-bearing questions means the PRD is not ready for a normal refine rewrite; route to blocker cluster, assumptions, doc-review, or a fuller PRD refinement session.
- KTD9. **Script boundary remains narrow.** No script decides “this question is load-bearing” or “planning would invent WHAT”. Scripts may report missing sections, trace gaps, placeholders, or literal glossary drift; LLM/readiness decides the semantic consequence.
- KTD10. **No `spec-plan` clarification copy.** `spec-plan` may identify PRD handoff entropy and point back to `spec-prd`; it must not host its own requirements grill loop or copy the full PRD readiness lens.
- KTD11. **Use P0/P1 packs, not a full PRD platform.** P0 packs cover only the PRD quality floor that prevents planning from inventing WHAT; P1 packs activate only on surface/complexity/refine signals. Do not make every PRD fill every section.
- KTD12. **Metrics and NFRs stay evidence-bound.** A metric without baseline/source becomes observable signal, assumption, or Outstanding Question. A product-level NFR/constraint may shape acceptance, but implementation mechanics stay out of PRD requirements.
- KTD13. **Traceability and owner closure are exit checks.** `R -> AE -> evidence/source -> open question` and owner closure protect planning handoff; they are not a new schema, scorecard, or artifact.
- KTD14. **Design and release evidence remain conditional.** Figma/screenshots/design notes and release slicing improve PRD quality only when they reduce planning invention; App/Figma/source consistency audits remain out-of-scope and route to `spec-app-consistency-audit`.
- KTD15. **Use Map-Reduce for large inputs, not summaries.** For oversized or multi-source rough PRDs, chunking is only an intake tactic. The durable judgment comes from source-ref preserving Map facts, semantic Shuffle groups, and Reduce outputs that expose deduped requirements, contradictions, blockers, assumptions, write targets and owner questions. Do not persist chunk summaries as truth and do not script semantic reducers.
- KTD16. **Diagnosis is two-stage.** Preliminary diagnosis chooses the smallest sufficient detail level; final readiness diagnosis decides whether the rewritten PRD can hand off to planning. This prevents early quality labels from being mistaken for `ready-for-planning`.
- KTD17. **Progressive detail is stop-driven.** Each layer needs both a trigger and a stop condition. Small, source-supported PRDs should stay compact; large, contradictory or high-impact PRDs should expand only until the remaining planning-invention risk is explicit.
- KTD18. **Deep integration means method parity plus topology adapter, not node copying.** `spec-prd` should preserve `grill-with-docs`' questioning rigor and source/code contradiction checks, read existing `CONTEXT.md`/ADR topology as evidence, and translate durable outcomes into PRD-local `Glossary`, `Decision Notes`, `Evidence And Assumptions`, `Scope Boundaries` plus preview-first promotion candidates.
- KTD19. **Close grill questions before downstream planning.** The requirements document is the last responsible moment to resolve load-bearing WHAT uncertainty. `spec-plan` may report residual entropy, but it must not be where actor, flow, scope, acceptance, terminology or owner-decision questions are first resolved.
- KTD20. **Promotion is evidence-gated and preview-first.** Stable project terms may be promoted to context docs, and hard decisions may be promoted to ADRs, only after PRD-local closure and only when criteria are met. Missing topology is degraded/no-op, not a blocker.

---

## Open Questions

### Resolved During Planning

- Should `grill-with-docs` be copied into `spec-prd` as a workflow node? No. It creates artifact topology and interaction-intensity conflicts; only the questioning method is reused.
- Should `CONTEXT.md` become the default PRD glossary target? No. PRD-local `Glossary` is the first target; project glossary promotion remains preview-first after repeated PRD evidence.
- Should ADRs be written during PRD refinement? No. PRD-local `Decision Notes` are the default; ADR-like artifacts remain optional future suggestions when hard to reverse, surprising, and a real tradeoff.
- Should Pre-PRD Clarification run for every PRD? No. It runs only when rough/incomplete PRD gaps would force planning to invent WHAT.

### Deferred to Implementation

- Exact prose placement inside `SKILL.md`: likely Phase 1/2 boundary plus Phase 3 refine wording. No hard line ceiling remains, but compact-orchestrator discipline still favors concise anchor text with detail in references.
- Exact eval IDs: choose concise IDs consistent with the existing `examples.json` style during implementation.
- Whether to add a fresh-source eval artifact with `passed` or `not_run`: depends on available dispatch/eval capability at implementation time; do not fabricate pass status.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
USER INPUT
  rough PRD / draft / reference claims / extracted notes
        |
        v
+-------------------------------+
| Phase 1: PRD Sanitization     |
| - product facts               |
| - goals / scope / acceptance  |
| - technical suggestions       |
| - unconfirmed claims          |
+---------------+---------------+
                |
                v
+-------------------------------+
| Problem / Outcome Framing    |
| - target user / actor         |
| - problem / desired outcome   |
| - value / observable signal   |
+---------------+---------------+
                |
                v
+-------------------------------+
| Current-state and evidence    |
| - source/docs/tests/contracts |
| - glossary / prior PRDs       |
| - evidence tags               |
+---------------+---------------+
                |
                v
+-------------------------------+
| Preliminary Diagnosis         |
| - compact vs expanded         |
| - system anchor present?      |
| - trigger ladder / route-out  |
+---------------+---------------+
                |
                v
+-------------------------------+
| Large-input Map-Reduce        |
| - Map chunk facts + refs      |
| - Shuffle by semantic group   |
| - Reduce conflicts / blockers |
+---------------+---------------+
                |
                v
+-------------------------------+
| Shared understanding map      |
| - claim                       |
| - evidence/source             |
| - gap                         |
| - question or assumption      |
| - PRD write target            |
+---------------+---------------+
                |
                v
+-------------------------------+
| Conditional PRD quality packs |
| P0: outcome/metrics/NFR/trace |
|     closure                   |
| P1: actors/design/release/    |
|     change management         |
+---------------+---------------+
                |
                v
+-------------------------------+
| Deep Requirements Grill       |
| 1. rank load-bearing gaps     |
| 2. resolve source/code first  |
| 3. challenge glossary/terms   |
| 4. stress concrete scenarios  |
| 5. ask 1 question at a time   |
| 6. include recommended answer |
| 7. close to PRD write target  |
+---------------+---------------+
                |
       +--------+---------+
       |                  |
       v                  v
+--------------+   +------------------+
| <=3 questions|   | >3 questions     |
| answer/write |   | prioritized      |
| PRD rewrite  |   | blockers + route |
| and readiness|   | no ready state   |
+------+-------+   +---------+--------+
       |                     |
       v                     v
+-------------------------------------+
| Context / ADR Topology Adapter      |
| - read existing topology evidence   |
| - propose glossary/ADR candidates   |
| - preview-first, no silent write    |
+----------------+--------------------+
                 |
                 v
+-------------------------------------+
| Final Readiness Diagnosis           |
| ready-for-planning only if planning |
| no longer invents WHAT              |
+-------------------------------------+
```

Progressive Detail Ladder:

| Level | Trigger | Stop condition | Output |
| --- | --- | --- | --- |
| L0 compact PRD | Input is small, anchored, low ambiguity and source-supported | PRD can be rewritten without planning inventing WHAT | Compact PRD plus explicit none/zero closure where relevant |
| L1 shared understanding map | Any rough PRD claim needs source/gap/write-target alignment | Load-bearing gaps are resolved, assumed, or escalated | Run-local `claim -> evidence/source -> gap -> question_or_assumption -> write target` |
| L2 large-input Map-Reduce | Input is oversized, multi-source, or too large for reliable whole-document judgment | Reduced candidates preserve source refs and conflicts | Run-local Map rows and Reduce outputs |
| L3 P0 packs | Problem/outcome, metric, NFR, trace, or owner closure signal affects planning invention | P0 gap is resolved, assumed, questioned, or blocked | PRD-local core/conditional section updates |
| L4 P1 packs | Actor/design/release/change-management signal is present and consequential | Conditional detail is captured or explicitly deferred | PRD-local conditional section updates |
| L5 blocker cluster / route-out | More than 3 load-bearing gaps, missing product/system anchor, or unresolved owner decision set | Route recommendation is explicit and no `ready-for-planning` is emitted | Prioritized blocker cluster, assumptions and affected write targets |

Run-local scratch shapes:

```text
Map row:
  source_ref / claim / actor / flow / state / gap /
  confidence / write_target_candidate

Reduce output:
  canonical_requirement / supporting_refs / conflicts /
  assumptions / load_bearing_gap / owner_question_candidate /
  affected_write_targets
```

Stop rules:

| Condition | Action |
| --- | --- |
| Source/docs/tests/contracts can answer the gap | Resolve source-first; do not ask owner |
| Clear compact PRD with no planning-invention risk | Stay at L0; do not run Map-Reduce or P0/P1 ceremony |
| One to three load-bearing gaps remain | Ask owner one at a time with recommended answer and write target |
| More than three load-bearing gaps remain | Emit blocker cluster / route-out; do not mark ready |
| Missing target user, product problem, system anchor or core scenario | Route to `spec-brainstorm` instead of PRD refinement |
| Question turns into implementation HOW | Defer to `spec-plan` / `spec-work`, not PRD requirement |
| Resolved term or hard decision needs persistence | Write PRD-local `Glossary` / `Decision Notes`; only suggest project glossary or ADR follow-up when promotion criteria are met |

Gap-to-target mapping:

| Gap type | Example planning invention risk | First resolution path | PRD write target |
| --- | --- | --- | --- |
| Actor / beneficiary unclear | Plan invents who uses the feature | Prior PRD/source-facing entry, then owner | `Actors`, `Requirements`, `Outstanding Questions` |
| Flow missing | Plan invents user journey or trigger | Current routes/commands/docs, then owner | `Use Cases`, `Interaction Requirements`, `Acceptance Examples` |
| State / permission missing | Plan invents allowed/blocked behavior | Source/tests/roles/contracts, then owner | `Requirements`, `Acceptance Examples`, `Negative Acceptance` |
| Exception / failure missing | Plan invents fallback behavior | Existing error/empty/retry patterns, then owner | `Exception Handling`, `Acceptance Examples`, `Scope Boundaries` |
| Scope boundary fuzzy | Plan expands adjacent features | Existing non-goals/prior plans, then owner | `Scope Boundaries`, `Decision Notes` |
| Decision intersection unresolved | Plan picks behavior where two owner decisions meet | Ratified decisions/docs/source, then owner | `Decision Notes`, `Outstanding Questions` |
| Term/source contradiction | Plan uses wrong concept or truth source | Domain Grill source-first lookup | `Glossary`, `Decision Notes`, `Evidence And Assumptions` |
| Problem / outcome unclear | Plan implements a feature without knowing why or for whom | Owner, prior PRD, product docs | `Problem Frame`, `Summary`, `Goals / Success Metrics`, `Outstanding Questions` |
| Metric claim ungrounded | Plan treats vague improvement as measurable success | Source/baseline lookup, then owner | `Goals / Success Metrics`, `Evidence And Assumptions`, `Outstanding Questions` |
| NFR / constraint missing | Plan misses security, privacy, compatibility, rollout, ops, or failure constraints | Surface/industry/project overlay, then owner | `Data / Compliance Boundaries`, `Release / Operation Readiness`, `Exception Handling`, `Negative Acceptance` |
| Trace gap | Plan cannot connect requirement to acceptance/evidence | PRD rewrite or explicit trace gap | `Requirements`, `Acceptance Examples`, `Evidence And Assumptions`, `Outstanding Questions` |
| Cross-chunk duplication or contradiction | Plan chooses one version of a requirement and loses the competing source | Map-Reduce semantic Shuffle and conflict-preserving Reduce, then owner if unresolved | `Requirements`, `Decision Notes`, `Evidence And Assumptions`, `Outstanding Questions` |
| Owner closure missing | Plan cannot tell which assumptions or owner answers are accepted | Closeout summary and Decision Notes | `Decision Notes`, `Evidence And Assumptions`, `Outstanding Questions` |
| Design / UX evidence present | Plan guesses interaction details from screenshots/Figma/notes | Extract PRD facts only; app audit remains separate | `Interaction Requirements`, `Use Cases`, `Acceptance Examples`, `Evidence And Assumptions` |
| Release or slice ambiguity | Plan invents release order or feature boundary | Owner-confirmed priority/split | `Feature Slices`, `Scope Boundaries`, `Release / Operation Readiness` |
| Existing PRD changed | Plan loses delta across refine rounds | Stable IDs plus add/replace/deprecate notes | `Change Delta`, `Decision Notes`, `Evidence And Assumptions` |

---

## Implementation Units

> Unit numbering note: `U7` does not exist. It was the original closeout unit and was renumbered to `U12` when the P0/P1 quality packs (`U8`-`U11`) were inserted; the gap is intentional, not a missing unit. `U12` is deliberately placed last (after `U13`) because it is the closeout unit and depends on every other unit; the label order `U12` < `U13` therefore does not match physical order by design.

### U1. Add Pre-PRD Clarification Orchestration To spec-prd

**Goal:** Make `spec-prd` visibly route rough PRD `create|refine|validate` inputs with `reference-claims|resume-prd|pure-text` posture through a Pre-PRD Clarification Loop after sanitization and before formal PRD rewrite/readiness when planning-invention risk exists.

**Requirements:** R1, R2, R3, R5, R7, R10, R22, R23

**Dependencies:** None

**Files:**
- Modify: `skills/spec-prd/SKILL.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a compact Phase 1/2/3 anchor that says rough PRD quality gaps should trigger Pre-PRD Clarification after sanitization/current-state evidence and before final rewrite/readiness.
- Name the two-stage diagnosis in the orchestrator: preliminary diagnosis before expansion, final readiness after PRD rewrite.
- Point the orchestrator to the Progressive Detail Ladder so ordinary small PRDs can stay compact.
- Extend the run-local decision card only if necessary with a small state such as `pre_prd_clarification_status`; avoid expanding it into a schema.
- Keep `SKILL.md` a compact orchestrator by linking detailed rules to existing references; the former hard line/char ceiling is gone, so the constraint is prose discipline plus the optional U6 structural assertion, not a numeric gate.
- Preserve current Domain Grill wording and clarify that Pre-PRD Clarification is broader completeness/shared-understanding checking, not a replacement.

**Patterns to follow:**
- `skills/spec-prd/SKILL.md` Phase 1 PRD Sanitization
- `skills/spec-prd/SKILL.md` Phase 2 Bounded Scenario Grill / Domain Grill Gate
- `skills/spec-prd/SKILL.md` Phase 4 readiness and handoff wording

**Test scenarios:**
- Trigger: a vague PRD draft with missing actor/acceptance and `quality_diagnosis=material-gaps` routes through Pre-PRD Clarification before final rewrite.
- Non-trigger: a clear small bugfix still uses bypass/compact PRD and does not force grill ceremony.
- Boundary: preliminary diagnosis can trigger L0/L1/L2/L3/L4/L5 behavior but cannot itself emit final `ready-for-planning`.
- Boundary: `SKILL.md` still says no standalone context, ADR, or runtime artifacts.
- Regression: first 120 lines retain workflow contract summary and source topology references.

**Verification:**
- The entrypoint communicates the loop while staying a compact orchestrator (detail in references); no numeric line/char limit is enforced.
- Contract tests prove the orchestrator names Pre-PRD Clarification and still keeps generated mirrors out of source fixes.

---

### U2. Define Shared-Understanding Pressure Rules In Existing References

**Goal:** Put the detailed trigger, non-trigger, shared understanding map, question cadence, source-first rule, Deep Requirements Grill seven actions, load-bearing closure rule and write-target mapping into the existing reference surface without adding a sixth reference file.

**Requirements:** R2, R3, R4, R5, R6, R7, R11, R21, R22, R23, R24, R25, R26

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a subsection under the current Bounded Scenario Grill / decision ledger area for `Pre-PRD Clarification Loop`.
- Define the run-local shared understanding map as `claim -> evidence/source -> gap -> question_or_assumption -> PRD write target`, and explicitly say it is not persisted as schema.
- Define the large-input Map-Reduce scratch discipline before the shared understanding map: Map chunk-level requirement atoms with `source_ref` and confidence; Shuffle by actor/flow/feature/data/state/permission/exception/PRD section/source contradiction; Reduce duplicates and conflicts into canonical candidates, assumptions, blockers and write targets.
- Provide the run-local scratch shapes for `Map row` and `Reduce output`, explicitly marking them as prompt/reference guidance rather than schema or JSON artifact.
- Add stop rules for source-answerable gaps, compact PRDs, one-to-three load-bearing gaps, over-cap blockers, missing system/product anchor, and implementation-HOW drift.
- Define trigger conditions around rough PRD completeness: missing actor, observable behavior, flow, state, permission, exception, negative acceptance, scope boundary, priority/degrade semantics, or decision intersections.
- Define the Progressive Detail Ladder so the reference can explain why a small PRD stays compact while a large contradictory PRD expands.
- Define the load-bearing gap triage order before applying the 1-3 question cap: acceptance impact, behavior/scope irreversibility, affected PRD section count, source contradiction, and release/planning consequence.
- Define non-triggers: implementation details, source-answerable facts, minor wording polish, planning-ready PRDs, pure terminology already covered by Domain Grill, low-risk assumptions, 0-1 product discovery, and drafts without enough product/system anchor.
- Reuse the existing run-local question format, adding `write_target` values for PRD core sections while explicitly saying this is not a persistent field set.
- Define the `Deep Requirements Grill` seven core actions adapted to the PRD stage (R25): one-question-at-a-time progression, recommended answer per question, source/code/docs/tests/contracts lookup before owner questions, existing-glossary conflict challenge, fuzzy/overloaded term sharpening, concrete-scenario boundary stress, and code-contradiction surfacing; each action handles only load-bearing WHAT / planning-readiness questions.
- Define the load-bearing closure rule (R26): every load-bearing grill question must close via source evidence, owner answer, accepted assumption, `Outstanding Questions`, blocker cluster or route-out; unresolved actor/flow/state/exception/scope/acceptance/permission/release-slice/decision-intersection questions block `ready-for-planning`. The matching readiness check lives in U4.
- Keep the `CONTEXT.md`, `CONTEXT-MAP.md`, and ADR prohibition in the same reference.

**Patterns to follow:**
- `Source-First Questioning`
- `Bounded Scenario Grill`
- `Decision Notes`

**Test scenarios:**
- Happy path: a rough PRD gap is first placed in the shared understanding map, then produces one owner question with recommended answer, source tag, consequences and write target.
- Compact path: a clear anchored PRD with no load-bearing gaps remains at L0 and does not run Map-Reduce or P0/P1 packs.
- Large-input path: two chunks describe the same requirement with different exception behavior; Reduce preserves both source refs and emits a conflict or owner question rather than picking one silently.
- Edge case: if source/docs/tests answer the gap, no owner question is asked.
- Error path: more than 3 load-bearing questions routes to prioritized blocker cluster with recommended route, accepted assumptions if any, affected write targets, and no `ready-for-planning`.
- Regression: reference does not say to create `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` by default.

**Verification:**
- Reference prose can be read independently and tells a future implementer exactly when to ask, when not to ask, and where the answer lands.
- Existing no-artifact tests remain true.

---

### U3. Connect Clarification Outputs To Final PRD Rewrite

**Goal:** Ensure PRD quality diagnosis and shared-understanding clarification outputs feed the final PRD artifact rather than leaving a detached critique or post-hoc interview note.

**Requirements:** R1, R2, R6, R8, R21, R22, R23, R24

**Dependencies:** U2

**Files:**
- Modify: `skills/spec-prd/references/prd-output-template.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Split `PRD Quality Diagnosis And Optimization` guidance into preliminary diagnosis before expansion and final readiness diagnosis after rewrite.
- In preliminary diagnosis, decide input scale, system anchor, Progressive Detail Ladder level, P0/P1 triggers and route-out conditions.
- In final readiness diagnosis, decide whether unresolved gaps still force planning to invent WHAT.
- Add a compact gap-to-write-target mapping for rough PRD completeness dimensions.
- Add a large-input note that Map-Reduce outputs must feed final PRD rewrite through section-level reducers, not through a detached chunk summary or standalone analysis report.
- Preserve the current `original -> recommendation -> reason -> write target` optimization suggestion format.
- Clarify that final durable output remains the rewritten PRD-grade document under `docs/brainstorms/`, not a standalone grill report.

**Patterns to follow:**
- `Adaptive Product Expert Lens`
- `PRD Quality Diagnosis And Optimization`
- `Core Sections` and `Conditional Sections`

**Test scenarios:**
- Happy path: optimization suggestions include write targets that map to PRD sections and are incorporated into final rewrite.
- Compact path: preliminary diagnosis chooses L0 and the output template keeps the PRD compact.
- Large-input path: cross-chunk duplicates collapse into one requirement candidate while contradictions remain visible in `Decision Notes`, `Evidence And Assumptions` or `Outstanding Questions`.
- Edge case: a stated metric without evidence remains assumption or Outstanding Question, not invented target.
- Regression: no numeric PRD scorecard and no standalone quality report artifact.

**Verification:**
- The template gives enough authoring guidance for rough PRD refinement without duplicating the readiness lens or treating clarification as a durable artifact.

---

### U4. Add Readiness Closure For Pre-PRD Clarification

**Goal:** Prevent `ready-for-planning` when rough PRD gaps remain unresolved and would force `spec-plan` to invent WHAT.

**Requirements:** R8, R11, R22, R23, R26

**Dependencies:** U2, U3

**Files:**
- Modify: `skills/spec-prd/references/prd-readiness-lens.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Extend existing packs rather than adding a new readiness pack unless implementation proves the wording becomes clearer with a named sub-bullet.
- Add closure checks in Quality Diagnosis Pack and Core Pack for Pre-PRD Clarification outcomes: resolved by source, owner answer, assumption, explicit trace gap, Outstanding Question, or route-out.
- Enforce the Deep Requirements Grill load-bearing closure rule (R26) at readiness: no `ready-for-planning` while any actor/flow/state/exception/scope/acceptance/permission/release-slice/decision-intersection grill question stays unresolved.
- Make final readiness explicitly post-rewrite: preliminary diagnosis can mark a route or detail level, but only final readiness can emit `ready-for-planning`.
- Ensure Domain And Decision Pack still owns terminology/source-of-truth grill adequacy.
- Re-state no context-artifact inflation for Pre-PRD Clarification as well as Domain Grill.

**Patterns to follow:**
- `Quality Diagnosis Pack`
- `Core Pack`
- `Domain And Decision Pack`
- `handoff entropy check`

**Test scenarios:**
- Happy path: rough PRD gaps closed by accepted owner answer can be ready-for-planning.
- Failure path: a preliminary L0/L1 classification cannot be reused as final readiness without PRD rewrite and closure checks.
- Failure path: missing actor/acceptance/scope remains unresolved and readiness returns revise-prd or ask-owner.
- Boundary: readiness does not require `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/`.

**Verification:**
- Readiness prose distinguishes deterministic `check-prd-artifact.js` facts from LLM-owned semantic completeness judgment.

---

### U5. Add Pre-PRD Clarification Eval Fixtures

**Goal:** Add examples-as-context that make the new pre-PRD clarification behavior reviewable and prevent regression to long interviews, context-artifact creation, or planning invention.

**Requirements:** R9, R21, R22, R23, R24, R25, R26

**Dependencies:** U1, U2, U3, U4

**Files:**
- Modify: `skills/spec-prd/evals/examples.json`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a small set of focused cases instead of a large taxonomy.
- Before adding a fixture, check whether an existing case already covers the concept (`no-context-artifact-topology`, `decision-note-not-adr`, `hard-decision-unresolved`, `bounded-scenario-grill-permission-edge` overlap with the new clarification/grill cases); prefer extending an existing case's `coverage_tags` over adding a near-duplicate so the 47-case fixture set does not bloat.
- Use existing fixture style: `id`, `intent`, `input_shape`, `expected`, `coverage_tags`.
- Include negative/near-neighbor cases so the trigger does not widen to every PRD.

**Candidate fixture coverage:**
- `pre-prd-clarification-loop-trigger`: vague PRD fragment missing actor, acceptance and scope triggers clarification before rewrite.
- `shared-understanding-pressure-map`: rough claims are mapped to evidence, gap, question/assumption and PRD write target.
- `requirements-grill-source-first`: source/docs answer current behavior, so no owner question.
- `requirements-grill-recommended-answer`: owner question includes recommended answer, rationale, source tag, consequences and write target.
- `requirements-grill-question-cap`: more than 3 load-bearing gaps becomes blocker cluster or doc-review/refine.
- `requirements-grill-no-context-artifact`: user asks to use `grill-with-docs` style context docs; output stays PRD-local.
- `planning-invention-readiness-fail`: unresolved rough PRD gaps block ready-for-planning.
- `large-prd-map-reduce-source-refs`: oversized multi-section PRD input uses chunk-level Map facts, semantic Shuffle, conflict-preserving Reduce and source_ref carry-forward before owner questions.
- `small-clear-prd-stays-compact`: source-supported small PRD remains at L0 and does not trigger Map-Reduce or all packs.
- `source-answerable-no-owner-question`: current behavior is knowable from source/docs/tests, so the loop records evidence and asks no owner question.
- `huge-prd-cross-chunk-conflict`: multiple chunks disagree on scope or exception behavior, so Reduce preserves conflict refs and emits affected write targets.
- `deep-grill-seven-actions`: a load-bearing gap drives one-question-at-a-time progression with recommended answer, source-first lookup, glossary/term challenge, scenario stress and code-contradiction surfacing (R25).
- `deep-grill-closure-blocks-readiness`: an unresolved load-bearing grill question keeps the PRD out of `ready-for-planning` until it closes via source, owner answer, assumption, Outstanding Question or route-out (R26).

**Test scenarios:**
- Fixture IDs are present.
- Serialized fixture text includes required behavior and forbidden artifact boundaries.
- Large-input fixture rejects lossy chunk summaries and requires source refs on reduced conflicts.
- Progressive-detail fixtures prove L0 compact path, source-first stop rule and L2 conflict handling.
- Fixture text does not imply executed eval runner or hard state machine.

**Verification:**
- Eval fixture contract remains `spec-prd-evals.v1` and current eval tests pass.

---

### U6. Extend Contract Tests Without Expanding Source Topology

**Goal:** Lock the fusion as a light contract and prevent accidental file/topology expansion.

**Requirements:** R9, R10, R11, R21, R22, R23, R24

**Dependencies:** U1, U2, U3, U4, U5

**Files:**
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Extend existing tests rather than creating a new large suite unless readability requires it.
- Assert source topology still equals the current 8 source files and 5 references.
- Do not re-add a hard `SKILL.md` line/char ceiling (the former `<=170` / `<=15000` assertions were intentionally removed). If an automated backstop is still wanted, assert structurally that the entrypoint keeps only anchors and detailed Pre-PRD Clarification rules live in references, instead of a numeric limit.
- Assert references include Pre-PRD Clarification trigger/non-trigger, shared understanding map, source-first resolution, question format, write targets, cap, no context artifact, and readiness closure.
- Assert references include large-input Map-Reduce as run-local authoring discipline, with `source_ref` preservation, semantic Shuffle groups, conflict-preserving Reduce and no persistent extraction artifact.
- Assert references distinguish preliminary diagnosis from final readiness and include Progressive Detail Ladder stop rules.
- Assert scratch output shapes are named as run-local prompt/reference guidance, not durable schema or required JSON.
- Assert scripts remain advisory and do not decide semantic readiness.

**Test scenarios:**
- Topology: adding `skills/spec-prd/references/requirements-grill.md` fails unless the source topology test is intentionally updated with justification.
- Boundary: `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/` remain forbidden as defaults.
- Ownership: `check-prd-artifact.js` is described as script-owned deterministic facts only; Pre-PRD Clarification remains LLM-owned.
- Large input: contract tests reject wording that treats chunk summaries as source-of-truth or makes a deterministic script decide requirement completeness.
- Progressive detail: contract tests reject wording that forces Map-Reduce/P0/P1 packs for every PRD or lets preliminary diagnosis emit `ready-for-planning`.
- Handoff: no contract test expects `spec-plan` to run a grill workflow.

**Verification:**
- Focused PRD contract tests fail if the implementation copies the external skill topology or erodes source/runtime boundaries.

---

### U8. Add Planning-Invention P0 PRD Quality Packs To Output Template

**Goal:** Add only the P0 PRD quality deltas that prevent `spec-plan` from inventing WHAT, without turning every PRD into a heavy template.

**Requirements:** R12, R13, R14, R15, R16

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `skills/spec-prd/references/prd-output-template.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a compact `P0 PRD Quality Packs` section to `prd-output-template.md` with a one-line existing-source gap for each retained pack.
- Define `Problem / Outcome Framing Gate` after sanitization and before rewrite: target user, problem, desired observable outcome, and value.
- Define `Success Metrics / Measurement Readiness` trigger for vague improvement verbs; require metric/target/window only when evidence exists, otherwise observable signal, assumption, or Outstanding Question.
- Define `NFR / Constraint Pack` as product-level constraints only: permissions, privacy, compliance, compatibility, rollout, operational readiness, failure semantics, and negative acceptance. Explicitly exclude database/API-field/implementation architecture.
- Define lightweight traceability as `R -> AE -> evidence/source -> open question`; no schema, no scorecard.
- Define `Review / Approval Closure` as closeout/PRD-local summary fields: owner answers applied, assumptions accepted, blocking questions, ready-for-planning, and whether planning would invent WHAT.
- State the compact-path behavior for each pack when its trigger is absent, so the implementation does not force all-section PRDs.

**Patterns to follow:**
- `Adaptive Product Expert Lens`
- `Core Sections` and `Conditional Sections`
- `PRD Quality Diagnosis And Optimization`
- `Embedded Standard Skeleton`

**Test scenarios:**
- Problem/outcome: a feature-only draft triggers one owner question or `Outstanding Questions` instead of producing a behavior-only PRD.
- Metrics: “提升体验” without baseline becomes observable signal/assumption, not fabricated target value.
- NFR: a permission/privacy/rollout signal lands in PRD-local sections without HOW details.
- Traceability: a core requirement without AE/evidence is represented as an explicit trace gap.
- Closure: final closeout distinguishes accepted assumptions from blocking questions.
- Compact path: a small PRD with no metrics/NFR/trace/owner-answer signal remains compact and records none/zero rather than adding heavy sections.

**Verification:**
- The output template tells implementers where each P0 pack lands and preserves compact PRD behavior for simple increments.

---

### U9. Add Conditional P1 Enrichment Packs

**Goal:** Add actor/stakeholder, design evidence, release slicing, and change-management improvements only when the input surface warrants them.

**Requirements:** R17, R18, R19, R20

**Dependencies:** U8

**Files:**
- Modify: `skills/spec-prd/references/prd-output-template.md`
- Modify: `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add `Stakeholder / Actor Alignment` triggers for Admin, Backend, CLI/DevTool, Mixed, permission, approval, producer/consumer, or downstream-consumer signals.
- Add `Design / UX Evidence Hook` triggers for App/H5/PC/Admin, screenshots, Figma, page descriptions, or interaction-state input. Extract only PRD facts: entry, state, copy, loading/empty/error, permissions, i18n/accessibility.
- Add `Prioritization / Release Slice` triggers for many requirements, multiple goals, mixed surfaces, or release order affecting scope/acceptance.
- Add `Change Management` triggers for `resume-prd`, existing PRD path, multi-round refine, or new meeting/screenshot/review conclusion input; preserve stable IDs and record added/replaced/deprecated/needs-confirmation deltas.
- Route App/Figma/source consistency checks to `spec-app-consistency-audit`; do not absorb that workflow into `spec-prd`.
- Keep Feature Slices as PRD handoff units only, never tasks or implementation units.

**Patterns to follow:**
- `Surface Lenses`
- `Feature Slices`
- `Project-Local Overlays`
- `Bounded Scenario Grill`

**Test scenarios:**
- Actor alignment: a backend/admin draft names “system/user/admin” ambiguously and gets beneficiary/operator/owner clarified.
- Design evidence: a screenshot/Figma note produces interaction requirements and acceptance examples without claiming source consistency.
- Release slice: a large multi-goal draft creates owner-confirmed feature slices or split recommendation.
- Boundary: app consistency audit language remains a route-out, not a hidden `spec-prd` responsibility.

**Verification:**
- P1 packs stay conditional and do not force extra sections in compact PRDs.

---

### U10. Extend Readiness Lens For Pack Closure

**Goal:** Ensure PRD readiness catches unresolved P0/P1 gaps that would still make planning invent WHAT.

**Requirements:** R12, R13, R14, R15, R16, R17, R18, R19, R20, R22, R23

**Dependencies:** U8, U9

**Files:**
- Modify: `skills/spec-prd/references/prd-readiness-lens.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Extend Core Pack or Quality Diagnosis Pack with P0 closure checks: problem/outcome, metrics readiness, NFR constraints, traceability, owner closure, and change delta integrity.
- Add conditional readiness bullets for P1 packs only when triggered: stakeholder/actor, design evidence, release slice, and change management.
- Align pack closure with the Progressive Detail Ladder: untriggered P0/P1 packs do not block compact PRDs, but triggered unresolved packs block final readiness when they would force planning to invent WHAT.
- Keep all readiness outcomes in the existing set: `ready-for-planning`, `revise-prd`, `ask-owner`, `doc-review`, `route-out`.
- Keep `check-prd-artifact.js` advisory. Scripts may report trace gaps or section presence, but LLM/readiness decides semantic closure.

**Patterns to follow:**
- `Core Pack`
- `Quality Diagnosis Pack`
- `Feature Slice Pack`
- `Metrics And Overlay Pack`
- `Outcomes`

**Test scenarios:**
- Failure: a PRD with unresolved problem/outcome cannot be ready-for-planning.
- Failure: a stated metric with fabricated target is rejected or moved to assumptions/questions.
- Failure: a requirement lacking AE/evidence/trace gap blocks readiness.
- Happy path: accepted owner answers and accepted assumptions can close readiness without adding new artifacts.
- Compact path: untriggered P0/P1 packs are not treated as missing required sections.
- Boundary: script facts remain advisory and no new evidence enum appears.

**Verification:**
- Readiness prose makes the P0 floor explicit while preserving conditional P1 behavior.

---

### U11. Add Best-Practice Pack Eval And Contract Coverage

**Goal:** Lock the new P0/P1 packs with examples-as-context and focused contract assertions.

**Requirements:** R9, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24

**Dependencies:** U8, U9, U10

**Files:**
- Modify: `skills/spec-prd/evals/examples.json`
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add focused fixtures for P0 gaps and P1 triggers without creating a large taxonomy; reuse or extend an existing case's `coverage_tags` when one already covers the concept rather than adding a near-duplicate.
- Extend contract assertions to pin no new topology, no schema, no scorecard, no invented metrics, and no app-consistency takeover.
- Assert the existing reference count remains stable unless intentionally changed with justification.

**Candidate fixture coverage:**
- `problem-outcome-framing-gate`: feature-only rough PRD needs target user/problem/outcome before rewrite.
- `success-metrics-no-invention`: vague improvement claim becomes observable signal/assumption/question, not invented target.
- `nfr-constraint-product-not-how`: privacy/permission/rollout signal becomes PRD constraint, not API/database design.
- `traceability-matrix-gap`: requirement without AE/evidence records trace gap and blocks readiness when load-bearing.
- `owner-closure-summary`: accepted assumptions and blocking questions are visible before planning handoff.
- `actor-alignment-conditional`: mixed/admin/backend actors are disambiguated only when triggered.
- `design-evidence-hook`: screenshot/Figma input extracts interaction facts and routes consistency audit out-of-scope.
- `release-slice-conditional`: large multi-goal PRD triggers feature slices or split recommendation.
- `resume-prd-change-management`: refine keeps stable IDs and records added/replaced/deprecated deltas.
- `large-prd-reducer-conflict`: two source chunks disagree on scope or exception behavior and the reducer emits a conflict set plus affected write targets.
- `preliminary-vs-final-diagnosis`: preliminary diagnosis selects expansion level, but final readiness is evaluated only after rewrite and closure.
- `progressive-detail-stop-rules`: small clear input stops at L0, source-answerable gap stops before owner question, over-cap gaps stop at blocker cluster.

Topology adapter fixtures (`context-map-routing`, `context-promotion-candidate`, `adr-promotion-three-conditions`) are owned by U13 and land in Phase 4, not here, because they assert reference text U13 writes.

**Test scenarios:**
- Fixture IDs are present and include P0/P1 coverage tags.
- Contract tests reject text that implies mandatory all-section PRDs, numeric scorecards, or generated topology.
- Contract tests keep `spec-plan` as consumer and prevent it from running these packs itself.

**Verification:**
- Focused PRD contract tests fail if best-practice packs drift into a heavy platform, script-owned semantic gate, or second artifact topology.

---

### U13. Add Context And ADR Topology Adapter

**Goal:** Integrate `grill-with-docs`' context and ADR topology as evidence and promotion paths while keeping PRD-local closure as the source of planning readiness.

**Requirements:** R27, R28, R29, R30

**Dependencies:** U2, U3, U4, U5, U6

**Files:**
- Modify: `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- Modify: `skills/spec-prd/references/prd-output-template.md`
- Modify: `skills/spec-prd/references/prd-readiness-lens.md`
- Modify: `skills/spec-prd/evals/examples.json`
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a `Context / ADR Topology Adapter` reference section that discovers existing `CONTEXT.md`, `CONTEXT-MAP.md`, context-specific `CONTEXT.md`, and `docs/adr/**` as advisory evidence.
- Define context routing: single context, multi-context via `CONTEXT-MAP.md`, unclear topic-to-context mapping, and no-topology fallback.
- Define glossary promotion criteria: project-specific term, owner accepted, repeated or cross-team relevant, clear definition and avoid terms.
- Define ADR promotion criteria: hard to reverse, surprising without context, real tradeoff; otherwise keep the decision in PRD-local `Decision Notes`.
- Require preview-first candidate output for context/ADR promotion. Do not silently create or edit `CONTEXT.md`, `CONTEXT-MAP.md`, or ADR files during ordinary `spec-prd` output.
- Keep PRD readiness tied to PRD-local closure. Missing context/ADR promotion does not block planning unless the underlying term or decision remains unresolved in the PRD.

**Patterns to follow:**
- External `grill-with-docs` `CONTEXT-FORMAT.md` term discipline: tight definitions, project-specific terms only, `_Avoid_` words where useful.
- External `grill-with-docs` `ADR-FORMAT.md` sparse ADR discipline: one-paragraph default, optional sections only when useful, three-condition gate.
- Existing `spec-prd` `Glossary`, `Decision Notes`, `Evidence And Assumptions`, and `Scope Boundaries` sections.

**Candidate fixture coverage:**
- `context-map-routing`: existing `CONTEXT-MAP.md` routes terms to the right context before glossary challenge.
- `context-promotion-candidate`: accepted project-specific term creates preview-first glossary candidate without silently writing a file.
- `adr-promotion-three-conditions`: hard decision creates ADR candidate only when hard-to-reverse, surprising and a real tradeoff.

These three fixtures and their contract assertions are owned by U13 and land in Phase 4 together with the reference text they check; they are intentionally not in U11.

**Test scenarios:**
- Existing root `CONTEXT.md`: conflicting term is surfaced and resolved into PRD `Glossary`, with an optional preview candidate if promotion criteria are met.
- Existing `CONTEXT-MAP.md`: PRD topic is routed to the right context, or one owner/context routing question is raised if ambiguous.
- No topology: PRD still completes with PRD-local glossary/decision notes and records no-topology fallback, without creating files.
- ADR candidate: a hard-to-reverse, surprising real tradeoff produces a preview candidate; a routine decision stays in `Decision Notes`.
- Boundary: contract tests reject any wording that makes `CONTEXT.md` or ADR creation mandatory for PRD readiness.

**Verification:**
- Topology integration improves source evidence and durable knowledge promotion without creating a second truth source or hidden write side effect.

---

### U12. Record Validation And Runtime Boundary Evidence

**Goal:** Close the implementation with honest validation evidence, changelog, and fresh-source eval posture.

**Requirements:** R9, R10

**Dependencies:** U1, U2, U3, U4, U5, U6, U8, U9, U10, U11, U13

**Files:**
- Create or modify: `docs/validation/spec-prd/fresh-source-eval-2026-06-22-requirements-grill.md`
- Modify: `CHANGELOG.md`

**Approach:**
- Record fresh-source eval status honestly: `passed` only if a fresh-source reviewer actually evaluates current disk source; otherwise `not_run` with reason.
- Run one representative rough PRD sample or prior PRD-to-plan gap through the updated source and record whether missing-WHAT feedback decreases; if unavailable, record `not_measured` with reason and recheck condition.
- Include source refs, runtime paths checked as empty, and generated mirror boundary.
- Update changelog with source surfaces, user-visible behavior, validation commands, and runtime mirror status.

**Test scenarios:**
- Validation artifact uses existing fresh-source eval record conventions when present.
- Sample validation records baseline vs updated behavior, or explicitly records `not_measured` plus the future trigger to recheck.
- Changelog latest entry matches timestamped format.
- No validation text claims generated runtime was refreshed unless `spec-first init` actually ran.

**Verification:**
- Changelog and plan/status taxonomy tests pass.
- Scoped git diff review confirms only expected files changed; pre-existing unrelated worktree changes are preserved and worktree cleanliness is not required unless the user asks for a commit.

---

## System-Wide Impact

- **Public workflow behavior:** `spec-prd` becomes more capable for rough/incomplete PRD refinement because it clarifies shared understanding before writing the final PRD, but remains the same public workflow entrypoint.
- **Artifact contract:** unchanged. Durable PRD output remains `docs/brainstorms/*-requirements.md` with `artifact_kind: prd-requirements`.
- **Downstream planning:** `spec-plan` receives more complete WHAT and less unresolved entropy; it still does not own the pre-PRD clarification loop.
- **Large PRD handling:** oversized or multi-source inputs gain a bounded Map-Reduce intake path that preserves evidence references and contradictions before reducing to PRD-local write targets.
- **Progressive detail:** small PRDs can remain compact; large or risky PRDs expand only through triggered ladder levels. Preliminary diagnosis controls expansion, final readiness controls planning handoff.
- **Context / ADR topology:** existing context and ADR docs become source evidence and optional promotion targets; PRD-local closure remains the handoff source of truth.
- **PRD quality floor:** P0 packs make problem/outcome, metrics readiness, product-level constraints, traceability, and owner closure explicit before planning only when those signals affect planning invention; P1 packs remain conditional to avoid heavy templates.
- **Skill packaging:** no new skill package, no new reference file by default, no generated runtime mirror edits.
- **Tests/evals:** focused additions to examples-as-context and contract tests; no new deterministic semantic gate.
- **Documentation:** changelog and optional validation artifact document the behavior. README updates are optional unless implementation changes user-visible command docs beyond `spec-prd` behavior.

Surface coverage:

| Surface | Status | Note |
| --- | --- | --- |
| `spec-prd` workflow | in-scope | Main behavior change |
| PRD artifact topology | in-scope unchanged | Must stay `docs/brainstorms/*-requirements.md` |
| `spec-plan` intake | out-of-scope | No source edit planned unless implementation finds stale handoff wording |
| Large-input Map-Reduce | in-scope as run-local discipline | No new script, schema, extraction artifact, vector index, or public workflow |
| Progressive Detail Ladder | in-scope as reference discipline | Trigger/stop conditions only; not a state machine |
| `CONTEXT.md` / ADR topology | in-scope as evidence and promotion adapter | Preview-first candidates only; not required PRD artifact or readiness gate |
| P0/P1 PRD quality packs | in-scope but narrowed | Added only as planning-invention authoring/readiness prompts inside existing references |
| Generated runtime mirrors | out-of-scope | Do not edit directly |
| External `grill-with-docs` source | out-of-scope | Method input only, not vendored |

---

## Alternative Approaches Considered

| Approach | Decision | Rationale |
| --- | --- | --- |
| Copy `grill-with-docs` into `spec-prd` as an executable node | Rejected | Imports default `CONTEXT.md`/ADR topology, increases public/internal node complexity, and conflicts with bounded PRD authoring. |
| Reuse `CONTEXT.md` / ADR topology through an adapter | Accepted | Keeps the valuable domain-language and decision-persistence model while preserving PRD-local closure and preview-first writes. |
| Add a new `requirements-grill` reference file | Defer by default with escape threshold | Cleaner naming, but current tests intentionally keep `spec-prd` to 5 references. Use existing reference first; add a file only if mixed ownership, duplicated anchors, unreadable prose density, or inability to explain the loop independently proves the sixth reference is more maintainable; update topology tests deliberately. |
| Put Pre-PRD Clarification into `spec-plan` | Rejected | It would let planning resolve WHAT and duplicate PRD readiness, breaking workflow ownership. |
| Route rough PRDs to `spec-brainstorm` by default | Rejected | The target input is an existing rough PRD for an anchored system increment, not 0-1 product discovery. Escalate only when the draft lacks enough product/system anchor to remain PRD refinement. |
| Add a script to detect rough PRD completeness | Rejected for v1 | Semantic completeness is LLM-owned. Scripts can report structure/trace facts but cannot decide material product gaps. |
| Use naive chunk summaries for huge PRDs | Rejected | Summaries drop source refs, exceptions and contradictions. Map-Reduce keeps chunk-level facts as evidence candidates and reduces by semantic groups before readiness judgment. |
| Add a persistent extraction schema or vector index | Rejected for v1 | It would add contract and runtime burden before evidence proves need. Current goal is a prompt/reference discipline inside existing `spec-prd` surfaces. |
| Use one quality diagnosis for both expansion and readiness | Rejected | It makes early classification look like final planning approval. Two-stage diagnosis keeps expansion decisions separate from `ready-for-planning`. |
| Use a full PRD scorecard or rubric | Rejected | The workflow already uses qualitative `quality_diagnosis`; numeric scoring would invite gaming and false precision. |
| Make all PRD best-practice sections mandatory | Rejected | Would overload compact PRDs and recreate a heavy template platform. P0/P1 packs trigger only when they reduce planning invention. |
| Create a separate PRD approval artifact | Rejected | Owner closure belongs in PRD-local sections and closeout summary; a new artifact would split the source of truth. |

---

## Success Metrics

- Rough PRD refine runs establish shared understanding before PRD rewrite: load-bearing claims are tied to source/evidence, gaps, owner questions or assumptions, and PRD write targets.
- Owner questions are fewer but better: each load-bearing question includes a recommended answer and write target.
- Preliminary diagnosis selects the smallest sufficient ladder level, while final readiness is evaluated only after PRD rewrite and closure checks.
- Small clear PRDs stay compact and do not trigger Map-Reduce or all P0/P1 packs.
- Oversized/multi-source rough PRDs preserve source refs through Map, expose cross-chunk contradictions during Shuffle/Reduce, and reduce repeated claims before the 1-3 question cap is applied.
- Existing `CONTEXT.md`/ADR evidence is used when present, and stable terms/hard decisions produce preview-first promotion candidates only when criteria are met.
- `ready-for-planning` is not emitted when actor/flow/acceptance/scope gaps remain unresolved.
- Triggered P0 gaps for problem/outcome, metrics, constraints, traceability, and owner closure are either resolved, explicitly assumed, or visible as blockers before handoff; untriggered packs do not expand compact PRDs.
- P1 packs add actor/design/release/change-management detail only when triggered, with compact PRDs staying compact.
- New eval fixtures and contract tests make no-context-artifact and question-cap regressions obvious.
- New eval fixtures and contract tests make invented-metric, NFR-HOW, missing-trace, missing-closure, design-audit takeover, and change-management regressions obvious.
- No new source topology, public entrypoint, runtime mirror edit, numeric scorecard, or standalone critique artifact is introduced.
- Future `spec-plan` artifacts from PRD origins carry fewer inline PRD feedback candidates for missing WHAT; U12 records at least one sample comparison or an explicit `not_measured` recheck condition.

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Pre-PRD Clarification becomes a long interview | Medium | High | Hard cap normal runs at 1-3 questions; route broader gaps to blockers/doc-review/refine. |
| Pre-PRD Clarification becomes brainstorm replacement | Medium | High | Trigger only for existing rough PRD / anchored system increment; route 0-1 product discovery, unclear audience, or missing product frame back to `spec-brainstorm`. |
| Source topology expands into another reference/template tree | Medium | Medium | Keep first implementation in existing references; contract test topology. |
| Domain Grill and Pre-PRD Clarification terminology confuses maintainers | Medium | Medium | Define clear division by consequence and use a mapping table. |
| Large-input Map-Reduce becomes lossy summary compression | Medium | High | Require source_ref preservation, semantic grouping, conflict-preserving Reduce and fixtures that reject chunk-summary-as-truth behavior. |
| Map-Reduce becomes a new hidden extraction platform | Low | Medium | State it is run-local LLM-owned authoring discipline; no schema, vector index, script reducer or standalone artifact in v1. |
| Progressive ladder is mistaken for a hard state machine | Medium | Medium | Frame levels as trigger/stop guidance, not required sequential states; tests reject mandatory expansion language. |
| Preliminary diagnosis is mistaken for final readiness | Medium | High | Explicit two-stage naming and fixtures that reject `ready-for-planning` before rewrite/closure. |
| Context/ADR adapter creates a second truth source | Medium | High | PRD-local closure remains required; context/ADR updates are preview-first promotion candidates with source refs, not readiness prerequisites. |
| Adapter silently creates or edits topology files | Low | High | Contract tests reject silent writes and mandatory `CONTEXT.md`/ADR creation. |
| Scripts start making semantic readiness decisions | Low | High | Explicit script/LLM boundary in readiness and contract tests. |
| External `grill-with-docs` artifact model leaks into `spec-prd` | Medium | High | Negative tests for `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/` defaults. |
| P0/P1 packs become mandatory heavy templates | Medium | High | Treat packs as triggered authoring/readiness prompts, not required sections; contract tests reject all-section mandate language and require compact-path behavior. |
| Metrics get fabricated to satisfy readiness | Medium | High | Require metric sources/baselines when targets are stated; otherwise downgrade to observable signal, assumption, or Outstanding Question. |
| NFR pack leaks into HOW | Medium | Medium | Keep NFR content product-level only; examples and tests reject API/database/architecture details as requirements. |
| Design evidence hook absorbs app consistency audit | Low | High | Extract only PRD facts; route PRD/Figma/source consistency to `spec-app-consistency-audit`. |
| `SKILL.md` entrypoint bloats now that the hard line/char ceiling is removed | Low | Medium | Keep orchestrator anchor compact and move details to references; optionally add the U6 structural assertion (anchors-only entrypoint, rules in references) as a replacement backstop. |

---

## Phased Delivery

### Phase 1

- Land U1-U4 together so trigger, shared understanding map, output mapping and readiness closure do not drift.
- Include the Map-Reduce large-input discipline in U2/U3 during this phase so oversized PRDs reduce into the same PRD-local write-target path.
- Include preliminary/final diagnosis split and Progressive Detail Ladder in the same phase so expansion decisions and readiness decisions cannot drift.
- Keep changes prose-only plus tests; no scripts or runtime generation.

### Phase 2

- Land U8-U10 to add P0/P1 quality packs and readiness closure.
- Keep the output-template/readiness changes in the same PR so pack triggers and readiness outcomes do not drift.

### Phase 3

- Land U5, U6, and U11 fixtures/contract tests for both the original clarification loop and the new P0/P1 packs.
- Include large-input fixtures in this phase to prove cross-chunk dedupe, conflict preservation and no chunk-summary source-of-truth behavior.
- Include progressive-detail fixtures for compact path, source-first stop, over-cap blocker cluster, and preliminary-vs-final readiness.
- Run focused validation and adjust prose only where tests expose ambiguity.

### Phase 4

- Land U13 context/ADR topology adapter fixtures and contract assertions.
- Validate no-topology fallback, existing topology evidence, preview-first promotion candidates and no silent writes.

### Phase 5

- Land U12 validation artifact and changelog.
- Optionally run fresh-source eval if the host capability is available and explicitly record status.

---

## Documentation / Operational Notes

- Changelog is required because this changes source docs/plan and future user-visible `spec-prd` behavior.
- README updates are not required by this plan alone; implementation should reconsider if `spec-prd` command docs or examples need to advertise rough PRD refinement.
- Runtime regeneration is not part of this plan. If implementation changes source skill files and runtime drift must be repaired, use `spec-first init` as a separate explicit step rather than hand-editing generated mirrors.
- Plan handoff should recommend `$spec-work` for implementation or a task pack if the implementer wants to split U1-U13, with U12 executed as the final closeout unit.

---

## Sources & References

- Current workflow source: `skills/spec-prd/SKILL.md`
- Current question/decision discipline: `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- Current PRD output and diagnosis source: `skills/spec-prd/references/prd-output-template.md`
- Current readiness source: `skills/spec-prd/references/prd-readiness-lens.md`
- Current evidence/topology source: `skills/spec-prd/references/evidence-and-topology.md`
- Current tests: `tests/unit/spec-prd-contracts.test.js`
- Current eval fixtures: `skills/spec-prd/evals/examples.json`
- Current execution flow note: `docs/validation/spec-prd/2026-06-22-spec-prd-execution-flow-ascii.md`
- Related Domain Grill plan: `docs/plans/2026-06-03-001-feat-spec-prd-domain-grill-quality-loop-plan.md`
- Related PRD quality feedback requirements: `docs/brainstorms/2026-06-02-002-spec-prd-quality-feedback-loop-requirements.md`
- Related owner requirements: `docs/brainstorms/2026-05-30-003-spec-prd-owner-final-requirements.md`
- External method input: user-named local `grill-with-docs` skill, read as advisory method input only and not vendored into this repo.
