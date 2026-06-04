---
title: "feat: spec-prd 知识库辅助需求分析质量升级方案"
type: feat
artifact_kind: implementation-plan
status: active
date: 2026-06-04
spec_id: 2026-06-04-002-spec-prd-knowledge-base-quality-upgrade
target_repo: spec-first
source_refs:
  - skills/spec-prd/SKILL.md
  - skills/spec-prd/references/intent-routing.md
  - skills/spec-prd/references/current-state-analysis.md
  - skills/spec-prd/references/change-topology-lens.md
  - skills/spec-prd/references/domain-language-and-decision-ledger.md
  - skills/spec-prd/references/prd-output-template.md
  - skills/spec-prd/references/prd-readiness-lens.md
  - skills/spec-prd/evals/examples.json
  - docs/contracts/context-governance.md
  - docs/contracts/context-bundle.md
  - docs/contracts/ai-coding-harness.md
external_refs:
  - https://docs.claude.com/en/docs/claude-code/skills
  - https://developers.openai.com/codex/skills
  - https://developers.openai.com/blog/eval-skills
---

# feat: spec-prd 知识库辅助需求分析质量升级方案

## Summary

本方案把 `spec-prd` 从“生成 brownfield PRD 的 workflow”升级为“需求分析工作台”。核心变化不是加重模板,而是在 PRD 成文前增加四个质量层:

1. 多源需求资料摄取:需求文档、图片、PDF、会议纪要、聊天记录、历史 PRD、代码/文档证据都先进入结构化 claim 池。
2. 行业角色初始化:根据输入和项目上下文选择证券产品经理、信贷产品经理、Admin 中后台 PM、Backend 产品架构 PM 等 run-local role lens。
3. 从知识库获取:用本地知识库、代码知识库、历史 artifact summary、项目 docs、源代码和测试获取候选事实,但必须经 direct source reads / deterministic checks / 用户确认后才能写成 confirmed claim。
4. task-by-task 深挖:每个需求点用分析卡逐步拆解、证据确认、苏格拉底式澄清、验收补全,最后合成为 planning-ready PRD。

本方案不引入新的 provider 依赖、中心化状态机或第二套 artifact 拓扑。`从知识库获取` 是 provider-neutral 的 evidence lane,不是某个具体工具、MCP 或 graph provider 的运行时 contract。

## Problem Frame

当前 `spec-prd` 已有正确边界:

- `skills/spec-prd/SKILL.md` 定位为 brownfield PRD requirements workflow。
- `current-state-analysis.md` 已区分 `confirmed-source`、`user-stated`、`source-candidate`、`external-research`、`assumption`。
- `change-topology-lens.md` 已有 Framing Gate / Evidence Plan / Surface Map。
- `domain-language-and-decision-ledger.md` 已有 source-first questioning 和 bounded scenario grill。
- `prd-readiness-lens.md` 已阻止 planning 发明 WHAT。

缺口在于主流程还没有显式描述“真实需求分析”的前半段:

- 用户可能给的是图片、PDF、会议记录、聊天记录、历史需求碎片,不是一句干净的 increment。
- 行业语境会决定 PRD 质量,例如证券、信贷、资金、CRM、Admin、Backend 的风险 lens 完全不同。
- 知识库和本地代码可以回答大量现状问题,但当前流程只笼统写“source candidates”,没有把“先从知识库获取,再源码确认”的节奏变成一等流程。
- 苏格拉底式提问已有 1-3 问限制,但缺一个逐 task 的问题队列和“能查证的不问用户”规则。
- 最终 PRD 的质量 gate 更偏工程 readiness,还可以补顶尖产品团队视角的业务目标、用户路径、风险、运营、指标、反验收和版本交付完整性。

## Goals

- G1. 让 `spec-prd` 能处理多源需求材料,并把每条 claim 的来源、置信度和待确认点分开。
- G2. 让 workflow 在分析开始时初始化合适的行业/产品角色 lens,而不是套同一套通用 PRD 问题。
- G3. 将“从知识库获取”纳入 evidence plan:知识库产出候选事实,直接源码/测试/文档/用户确认才产出 confirmed fact。
- G4. 通过 Requirement Analysis Card 逐个需求点深挖,避免直接从大段资料跳到最终 PRD。
- G5. 强化苏格拉底式澄清:只问会改变 WHAT、验收、范围、风险、源真相的最小问题。
- G6. 让最终 PRD 的 DoD 覆盖产品团队关心的业务目标、用户场景、边界、风险、可验收性、运营与指标。
- G7. 用 eval fixtures 固化高风险场景,防止后续 prompt 修改让 PRD 输出质量回退。

## Non-Goals

- 不实现图片/PDF/OCR/会议转写工具本身;只定义 `spec-prd` 如何消费这些材料的提取结果。
- 不新增 `docs/prds/` 或独立需求包目录;继续使用 `docs/brainstorms/*-requirements.md`。
- 不把知识库输出当 source-of-truth;知识库事实默认是 advisory / candidate。
- 不新增 public helper workflow 或公开 readiness reviewer。
- 不把 `spec-prd` 变成 `spec-plan`;implementation units、API 字段、数据库 schema、任务拆解仍归 planning。
- 不把证券、信贷等行业规则写成通用事实;行业 lens 只产生待确认问题和 PRD section 触发条件。

## Design Principles

### Skill 设计原则

Claude / Codex 官方 skill 设计共同强调三点:

- `SKILL.md` 主入口应保持短、清晰、触发准确。
- 长模板、检查表、案例和工具细节应放入 references / scripts / templates,按触发加载。
- 可复用 workflow 应用 eval 或 focused tests 检查真实行为,而不是只依赖 prompt 自述。

因此本方案不建议把所有细节塞进 `skills/spec-prd/SKILL.md`。主入口只增加新的阶段锚点和 reference trigger map,细节拆入独立 reference。

### Product 质量原则

顶尖产品团队的 PRD 不是“写得长”,而是让后续设计、研发、测试、运营不再猜:

- 用户是谁,在什么场景遇到什么问题。
- 当前系统如何工作,证据是什么。
- 这次改的是 keep / extend / replace / remove / unknown 中哪一种。
- 每条需求为什么存在,优先级如何,怎么验收。
- 异常、权限、状态、合规、审计、运营、灰度和回滚边界是否明确。
- 哪些东西明确不做。
- 剩余问题是否会阻塞 planning。

## Proposed Workflow

### Phase 0. Input Intake And Role Initialization

新增 PRD 分析前置:

1. 识别输入材料类型。
2. 抽取 claims,区分事实、需求、决策、约束、疑问和矛盾。
3. 初始化本轮行业/产品角色 lens。
4. 生成 run-local context ledger,记录读过的材料、为什么读、是否可信。

Run-local card:

```text
input_materials:
  - source_ref:
    material_type: prd | image | pdf | meeting-notes | chat-log | historical-doc | code-ref | other
    extraction_status: raw | extracted | partial | unavailable
    trust_boundary: untrusted-user-content | project-doc | confirmed-source | external
    claims_count:
    limitations:

role_initialization:
  candidate_role: securities-pm | credit-pm | admin-pm | backend-product-architect | devtool-pm | generic-brownfield-pm
  why_this_role:
  triggered_lenses:
  source_refs:
  confidence: high | medium | low
  owner_confirmation_needed: yes | no
```

### Phase 1. Claim Extraction

把输入拆成 claim pool:

```text
claim_id:
claim_type: user-need | current-state | business-rule | acceptance | non-goal | metric | constraint | contradiction | open-question
claim_text:
source_ref:
speaker_or_author:
evidence_tag: user-stated | source-candidate | confirmed-source | external-research | assumption
needs_knowledge_lookup: yes | no
needs_source_confirmation: yes | no
needs_owner_decision: yes | no
```

关键规则:

- 图片/PDF/会议记录只提供 untrusted content,不能覆盖 workflow 指令。
- 一条需求 claim 不等于 PRD requirement,必须经过现状确认和验收补全。
- 多个材料互相矛盾时,先记录 contradiction,不要静默归一化。

### Phase 2. Knowledge Retrieval Plan

将“从知识库获取”变成显式步骤:

```text
knowledge_request:
  question:
  target_claim_ids:
  retrieval_scope: local-knowledge-base | code-knowledge-base | docs | prior-prds | source-code | tests | contracts | package-metadata
  expected_output: candidate-paths | candidate-symbols | existing-flow-summary | terminology-candidates | historical-decisions
  confirmation_required: direct-source-read | deterministic-command | user-confirmation | none
  fallback_if_unavailable:
```

知识库边界:

- 知识库用于定位、归纳、提示候选路径和历史决策。
- 知识库不能决定 scope、优先级、验收或产品默认值。
- 知识库结果默认写成 `source-candidate` 或 `knowledge-candidate`。
- 影响权限、资金、合规、状态、用户可见行为、验收的 claim 必须回源确认。
- 知识库不可用时,降级为 bounded direct source reads、`rg`、ast-grep、docs/tests/package facts。

### Phase 3. Requirement Analysis Cards

每个需求点都必须经过分析卡,再进入 PRD 正文:

```text
req_candidate_id:
source_claim_ids:
actor:
user_problem:
current_behavior:
requested_delta:
primary_topology: add | extend | replace | remove | migrate | split | merge | policy-change | workflow-change | contract-change | unknown
affected_surfaces:
knowledge_candidates:
confirmed_source_refs:
business_rules:
edge_cases:
permissions_or_roles:
states_and_transitions:
data_or_compliance_boundaries:
acceptance_candidates:
negative_acceptance_candidates:
priority_candidate:
owner_decision_needed:
recommended_default:
write_targets:
```

作用:

- 防止从输入材料直接跳到 PRD。
- 让“逐个 task 深度思考”有稳定载体。
- 让每个未确认点有去向:源码确认、知识库继续查、用户确认、或显式 assumption。

### Phase 4. Socratic Clarification Loop

问题队列必须由分析卡驱动:

```text
clarification_question:
  related_req_candidate_id:
  question:
  why_it_matters:
  can_be_answered_from_repo: yes | no
  evidence_already_checked:
  recommended_answer:
  consequence_if_yes:
  consequence_if_no:
  write_target: Requirements | Acceptance Examples | Scope Boundaries | Decision Notes | Evidence And Assumptions | Outstanding Questions
```

提问规则:

- 能通过知识库、源码、测试、docs、历史 PRD 确认的问题不问用户。
- 每次只问一个会改变 WHAT、验收、范围、源真相或风险的问题。
- 正常 PRD run 控制在 1-3 个关键问题。
- 超过 3 个关键问题时,输出 unresolved decision cluster,不要把用户拖进长访谈。
- 用户说“你定”时,只能采用 evidence-backed default 或显式 assumption。

### Phase 5. PRD Assembly

从 cards 合成 PRD:

- `Summary`:来自稳定的 user problem + delta。
- `Current System Snapshot`:只写 confirmed/currently relevant facts。
- `Change Delta`:每个 material change 标 keep/extend/replace/remove/unknown。
- `Requirements`:由 analysis cards 转为 R-ID。
- `Acceptance Examples`:由 positive/negative/edge acceptance candidates 转为 AE-ID。
- `Scope Boundaries`:显式记录 out-of-scope 和 preserved behavior。
- `Evidence And Assumptions`:记录 knowledge candidates、source refs、assumptions、limitations。
- `Decision Notes`:记录用户确认或 evidence-backed default。
- 条件触发 `Glossary`、`Data / Compliance Boundaries`、`Release / Operation Readiness`、`Goals / Success Metrics` 等。

### Phase 6. PRD Quality Definition Of Done

最终 PRD 进入 planning 前必须满足:

| Dimension | Pass condition |
| --- | --- |
| Role fit | 行业/产品角色 lens 已选定或明确不适用 |
| Source intake | 输入材料已被 claim 化,矛盾和限制已记录 |
| Current-state accuracy | 关键现状 claim 有 confirmed-source / user-stated / assumption 区分 |
| Knowledge use | 知识库只作为候选来源,material claim 已回源确认 |
| Delta clarity | 关键变化已标 keep/extend/replace/remove/unknown |
| User value | 每组需求能说明用户/业务问题 |
| Acceptance | 核心需求有正向、异常或负向验收 |
| Risk coverage | 权限、状态、资金、合规、审计、运营、灰度、回滚按触发覆盖 |
| Priority | P0/P1/P2 或等价优先级明确,可降级/阻塞上线语义明确 |
| Planning entropy | `spec-plan` 不需要发明 WHAT |

## Proposed Source Changes

### `skills/spec-prd/SKILL.md`

最小修改:

- Phase 0 增加 input intake + role initialization。
- Phase 1 增加 knowledge retrieval plan。
- Phase 2/3 增加 requirement analysis cards。
- Phase 4 readiness 前增加 PRD Quality DoD。
- Reference Trigger Map 新增下列 references。

### New references

```text
skills/spec-prd/references/input-intake.md
skills/spec-prd/references/role-lens-initialization.md
skills/spec-prd/references/knowledge-base-evidence.md
skills/spec-prd/references/requirement-analysis-cards.md
skills/spec-prd/references/prd-quality-dod.md
```

职责:

| File | Role |
| --- | --- |
| `input-intake.md` | 多源材料摄取、claim extraction、untrusted content 边界 |
| `role-lens-initialization.md` | 证券/信贷/Admin/Backend/DevTool 等 run-local role lens 选择 |
| `knowledge-base-evidence.md` | `从知识库获取` 的 evidence lane、确认规则、降级策略 |
| `requirement-analysis-cards.md` | 逐需求点分析卡、问题队列、write target |
| `prd-quality-dod.md` | 产品团队 PRD DoD 与 readiness lens 关系 |

### Existing references to adjust

- `current-state-analysis.md`:增加 `knowledge-candidate` 或明确 `source-candidate` 可来自知识库,但需回源确认。
- `domain-language-and-decision-ledger.md`:把 source-first questioning 扩展为 knowledge-first but source-confirmed。
- `prd-output-template.md`:增加 `Intake Summary` / `Decision Notes` / `Evidence And Assumptions` 的轻量写法,不强制输出 run-local scratch。
- `prd-readiness-lens.md`:增加 PRD Quality DoD pack。
- `evals/examples.json`:新增知识库、图片/PDF/会议纪要、行业 lens、逐卡澄清场景。

## Implementation Units

### U1. Add Input Intake Reference

**Goal:** 让 `spec-prd` 明确支持需求文档、图片、PDF、会议纪要、聊天记录和历史材料。

**Files:**

- Create: `skills/spec-prd/references/input-intake.md`
- Modify: `skills/spec-prd/SKILL.md`
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Acceptance:**

- `SKILL.md` 主入口只引用 intake reference,不塞长表。
- intake reference 明确 untrusted content 边界。
- tests 覆盖 `image/pdf/meeting-notes/chat-log` 作为输入模式或 reference material。

### U2. Add Role Lens Initialization

**Goal:** 让 PRD 分析能按行业和产品 surface 初始化角色。

**Files:**

- Create: `skills/spec-prd/references/role-lens-initialization.md`
- Modify: `skills/spec-prd/references/domain-lenses.md`
- Modify: `skills/spec-prd/evals/examples.json`
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Acceptance:**

- 支持至少 `securities-pm`、`credit-pm`、`admin-pm`、`backend-product-architect`、`devtool-pm`、`generic-brownfield-pm`。
- 行业 lens 只触发问题和 sections,不声称行业规则为 confirmed truth。
- 角色选择带 source refs / confidence / fallback。

### U3. Add Knowledge Base Evidence Lane

**Goal:** 将“从知识库获取”纳入 PRD evidence plan,并保持 provider-neutral。

**Files:**

- Create: `skills/spec-prd/references/knowledge-base-evidence.md`
- Modify: `skills/spec-prd/references/current-state-analysis.md`
- Modify: `skills/spec-prd/references/prd-readiness-lens.md`
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Acceptance:**

- 术语统一为 `从知识库获取`、`knowledge-candidate`、`knowledge retrieval`,不绑定具体 provider。
- 知识库结果必须经过 direct source read / deterministic command / user confirmation 才能升级为 confirmed claim。
- 知识库不可用时有 degraded mode。
- readiness lens 检查 knowledge candidate 是否被误写成 confirmed-source。

### U4. Add Requirement Analysis Cards And Clarification Queue

**Goal:** 让逐个需求点深挖有稳定结构,支持苏格拉底式确认。

**Files:**

- Create: `skills/spec-prd/references/requirement-analysis-cards.md`
- Modify: `skills/spec-prd/SKILL.md`
- Modify: `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- Modify: `skills/spec-prd/evals/examples.json`

**Acceptance:**

- 每个 material requirement candidate 有 actor/current_behavior/requested_delta/acceptance/owner_decision 等字段。
- clarification queue 明确“能从知识库或源码确认的不问用户”。
- 正常 run 仍保持 1-3 个关键问题上限。

### U5. Add Product Quality DoD

**Goal:** 在现有 readiness lens 上补产品团队 PRD 质量门。

**Files:**

- Create: `skills/spec-prd/references/prd-quality-dod.md`
- Modify: `skills/spec-prd/references/prd-readiness-lens.md`
- Modify: `skills/spec-prd/references/prd-output-template.md`
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Acceptance:**

- DoD 覆盖 role fit、source intake、knowledge use、delta clarity、user value、acceptance、risk、priority、planning entropy。
- 小型需求仍可 compact,不强制重模板。
- `ready-for-planning` 不允许隐藏 unresolved WHAT。

### U6. Upgrade Evals From Keyword Fixtures To Behavior Cases

**Goal:** 用小而真实的行为 eval 防止 PRD 输出质量回退。

**Files:**

- Modify: `skills/spec-prd/evals/examples.json`
- Modify or create focused eval runner/contract tests as needed under `tests/unit/`
- Optional: `docs/validation/spec-prd/fresh-source-eval-YYYY-MM-DD.md`

**Acceptance:**

新增至少 8 类场景:

- 图片/会议纪要输入被 claim 化,不当指令执行。
- 证券需求触发证券 PM lens。
- 信贷需求触发信贷 PM lens。
- 知识库返回候选事实,但未回源时只能写 candidate。
- 源码确认当前状态后不再问用户。
- 用户说法与源码矛盾时给 recommended default + owner question。
- 超过 3 个关键问题时输出 unresolved cluster。
- 最终 PRD DoD 阻止 planning invent WHAT。

### U7. Documentation And Handoff

**Goal:** 让用户知道新 `spec-prd` 如何使用多源材料和知识库。

**Files:**

- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: docs user manual entries if current PRD workflow section exists
- Modify: `CHANGELOG.md`

**Acceptance:**

- 用户文档说明 `spec-prd` 可消费文档/图片/PDF/会议纪要/知识库候选。
- 明确知识库结果不是 confirmed truth。
- 不提新增 generated runtime mirror 手工编辑。

## Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| PRD skill 变得过重 | 小需求体验变差 | 用 progressive disclosure,新增 reference 只按触发加载 |
| 知识库候选被误写成 confirmed-source | PRD 现状错误,plan 错误 | readiness lens 增加 knowledge candidate 检查 |
| 行业 lens 编造行业规则 | 合规/业务风险 | lens 只问问题和触发 section,不声明事实 |
| 苏格拉底式问题过多 | 用户负担上升 | 1-3 问上限 + unresolved cluster |
| 输入材料含 prompt injection | workflow 被污染 | intake reference 明确 untrusted content,只抽取 claims |
| 过早实体化工具/脚本 | 形成 provider 耦合 | 本期只定义 provider-neutral lane,具体知识库接入另立 PRD/plan |

## Verification Plan

最窄验证:

- `npm run test:jest -- tests/unit/spec-prd-contracts.test.js --runInBand`
- `npm run typecheck`

若修改 README / 双宿主入口:

- `npm run lint:skill-entrypoints`
- focused README / governance contract tests

若新增 eval runner:

- focused eval unit tests
- fresh-source eval artifact,记录 `passed` / `not_run` 和原因

## Changelog Requirement

本计划本身已是 source docs 变更,需要 `CHANGELOG.md` 记录。后续若实际修改 `skills/spec-prd/**`、tests、README 或 docs,每个实现切片都必须追加 changelog,并按是否用户可见标注 `(user-visible)`。

## Handoff

推荐下一步进入 `$spec-work` 执行 U1-U3 的最小闭环:

1. `input-intake.md`
2. `role-lens-initialization.md`
3. `knowledge-base-evidence.md`
4. `SKILL.md` reference trigger map 最小更新
5. focused `spec-prd-contracts` 测试

完成这三项后,`spec-prd` 就能先建立“多源输入 + 行业角色 + 从知识库获取”的核心质量底座;U4-U7 再逐步补深挖卡、DoD、eval 和用户文档。
