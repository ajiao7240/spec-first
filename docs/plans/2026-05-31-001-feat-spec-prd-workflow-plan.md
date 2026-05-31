---
title: "feat: spec-prd 增量 PRD workflow 落地计划"
type: feat
artifact_kind: implementation-plan
status: active
date: 2026-05-31
spec_id: 2026-05-30-003-spec-prd-owner-final
origin: docs/brainstorms/2026-05-30-003-spec-prd-owner-final-requirements.md
target_repo: spec-first
---

# feat: spec-prd 增量 PRD workflow 落地计划

## Summary

新增公开 workflow `spec-prd`，用于已有系统上的增量需求迭代 PRD 生成、完善与可规划性检查。v1 采用单入口、单文件 PRD、current-state evidence、core+conditional 模板、surface lens + 证券行业 overlay，并把 `docs/需求文档模版/标准模版/` 的人用模板库与 `skills/spec-prd/references/*` 的 runtime authoring contract 建成可审查的同源关系。

---

## Problem Frame

origin 文档已经裁决：`spec-brainstorm` 继续负责 0-1 WHAT shaping，`spec-prd` 负责产品 owner 在已有系统上把一句话增量、低质量碎片或已有 PRD 转成可交给 `spec-plan` 的 PRD-grade requirements。当前还缺一条可实施路径，把新增 workflow、双宿主入口、current-state analysis、证券行业模板 overlay、readiness gate、routing tie-break、eval 与 docs/test 一次性收敛到 source-of-truth，而不手改 generated runtime mirror。

本计划把用户提出的“双向优化”作为硬边界：模板库不是孤立文档，必须反向塑造 `spec-prd` 的 output template 和 domain lenses；`spec-prd` runtime reference 也必须约束模板库后续演化，避免人用模板与 skill 输出模板各自漂移。

---

## Requirements

> **ID 命名空间约定**：本节及各 Implementation Unit 的 `Requirements: Rx` 指**本计划内的 plan-R**（R1-R10），括号内 `（origin …）` 才是 origin 需求文档的 R/AE/F/U ID。二者命名空间不同，plan R8 ≠ origin R8。

- R1. 新增单一公开 workflow `spec-prd`，支持内部 `create`、`refine`、`validate` intent；`code-align` 只作为 evidence posture / report-only 子模式，不拆公开入口。（origin R1-R6c, R36-R37, AE1-AE2b, AE5c, AE9）
- R2. 在 PRD 生成前执行 scope-appropriate current-state analysis，输出 `Current System Snapshot` 与 `Change Delta`，所有 current-state claim 必须带 evidence tag，GitNexus 只能作为 pointer 或 session-local orientation。（origin R7-R13, R23c, R40, AE3-AE4）
- R3. 产物仍写 `docs/brainstorms/*-requirements.md`，frontmatter 保留 `spec_id` / `artifact_kind: prd-requirements`，PRD 采用 core+conditional 模板并保留 requirement↔acceptance trace、Success Metrics conditional、语言策略和 WHAT-not-HOW 边界。（origin R14-R23d, R35, AE5-AE5f）
- R4. `spec-prd` 必须组合 surface lens 与 industry overlay；证券行业 overlay 是首个行业示例，覆盖监管辖区、客户/账户/产品范围、适当性、AML/KYC、行情、交易、资金清结算、风控、审计、精度与时区。（origin R22b-R22c, R24-R30c, R32, AE5d, AE6-AE6b）
- R5. `docs/需求文档模版/标准模版/` 是 human-facing 标准模板库；`skills/spec-prd/references/prd-output-template.md` 与 `domain-lenses.md` 是 runtime authoring contract。实现必须声明 derive / reference / intentionally diverge 关系，并提供 drift 暴露机制。（origin R16d, R30c, AE11）
- R6. v1 以 by-reference 复用既有 Requirements Readiness Gate，不物理抽共享 contract；`prd-readiness-lens.md` 追加 PRD-specific lens，readiness 失败时输出最小补齐问题或风险记录，完成后只 handoff 到 refine / doc-review / plan / done。（origin R31-R35, AE7, AE10）
- R7. readiness reviewer 是 eval-gated 内部 helper：v1 默认由 orchestrator 自执行 readiness lens；只有 fresh-source eval 证明自审稳定失效时，才实体化 `agents/spec-requirements-readiness-reviewer.agent.md` 并同步 doc-review persona 契约。（origin R38-R39, AE8）
- R8. v1 不新增 `docs/prds/`、不新增 evidence enum、不实现 packet / multi-surface / parent-child 拆分完整能力；复杂度识别闸只输出 split-decision 建议与 handoff。（origin NG6-NG8, R6b, R41, AE2b）
- R9. 完整落地必须覆盖 dual-host governance、Claude command template、Codex workflow skill delivery、routing、spec-plan intake、focused tests、fresh-source eval fixtures、README / README.zh-CN / 用户手册 / CHANGELOG。（origin U8-U13）
- R10. 对 PM 初版超大 PRD，v1 必须支持轻量多文档拓扑：原始 PRD/source input by-reference、split summary requirements 文档、多个 child PRD requirements 文档；同一大需求共享 base `spec_id` / slug，child PRD 通过 `document_role: child-prd` + 唯一 `child_id` 区分模块，并回链 `parent_spec_id` / `source_prd` / `split_summary`，且只能在 owner 确认拆分后落盘。（origin R6d, F1c, AE2c, U7b）

**Origin actors:** A1 产品/业务 owner；A2 `spec-prd` orchestrator；A3 Evidence provider；A4 Downstream planner；A5 Reviewer；A6 内部 readiness reviewer helper。

**Origin flows:** F1 Create PRD from increment；F1b Existing PRD refinement；F1c Oversized initial PRD split-decision；F2 One-line increment to PRD；F3 Idea routing；F4 Code-aware validation；F5 Plan handoff。

**Origin acceptance examples:** AE1-AE11（含 AE2c）全部影响实现或验证；本计划在 Implementation Units 中按主要覆盖关系引用，不逐条复制验收正文。

---

## Assumptions

- A1. 当前工作树中的 `docs/需求文档模版/标准模版/` 计划作为 source docs 一并进入这条 spec chain；如果实施前该目录被移除，U3 必须退回 origin R16d/R22c/R30c 的抽象要求重新建立模板 seed。
- A2. v1 不要求默认联网检索证券监管资料。行业 overlay 只提供 PRD 作者期待确认清单；真实规则必须来自用户、合规确认、source docs 或显式外部研究并带 evidence tag。
- A3. 当前 Codex 会话没有用户显式授权 subagents；因此本计划不依赖本轮多 agent research 输出。实施阶段若需要 fresh-source eval，应按 host dispatch 授权边界执行或明确记录未运行原因。

---

## Scope Boundaries

- 不把 `spec-prd` 做成 `spec-brainstorm` 的换名版，也不把 0-1 产品探索拉进 PRD 模板生成。
- 不新增多个公开 PRD workflow，不公开 readiness reviewer，不把 internal helper 写成 `$spec-*` 或 `/spec:*` 入口。
- 不新增 `docs/prds/`，不改变 `docs/brainstorms/*-requirements.md` 作为需求 artifact 的现有链路。
- 不抽取 shared readiness gate 到 `docs/contracts/workflows/requirements-readiness-gate.md`；这是 v2 重构项。
- 不把证券行业常识写成合规事实，不替代法务/合规/牌照主体确认。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors；source 修改后如需 runtime 对齐由 `spec-first init` 生成。

### Deferred to Follow-Up Work

- v2 Requirements Packet、Multi-Surface Packet、Parent/Child 拆分、manifest / trace-ledger / integration-contracts 结构。
- shared readiness gate 的物理抽取与 `spec-brainstorm` source 重构。
- 如果 fresh-source eval 证明 orchestrator 自审足够稳定，则 readiness reviewer agent 实体化与 `spec-doc-review` persona 复用继续 deferred。

---

## Completion Criteria

- `spec-prd` source skill、references、workflow command template、governance registration 均存在并通过 focused contract tests。
- `using-spec-first` 能区分 0-1 brainstorm、brownfield PRD、existing PRD refine、App consistency audit request。
- `spec-plan` 明确把 `artifact_kind: prd-requirements` 当普通 requirements artifact 消费。
- PRD output template 与标准模板库的 core sections、surface lenses、证券 overlay 有 drift 暴露测试或等价 reviewer checklist。
- readiness reviewer 是否实体化有 fresh-source eval 记录；未运行或未实体化时不能声称内部 agent 已验证。
- README / README.zh-CN / 用户手册 artifact map / CHANGELOG 更新完成；generated runtime mirrors 未被手工修改。

---

## Graph Readiness

- target_repo: spec-first
- status: stale
- source_revision: fc3d0ca649ee6739d16302608858e1ef4165fc9f
- current_revision: 4dba212d80f52f73509926603b5b1bde28ce00c0
- stale: true
- primary_providers: gitnexus
- degraded_providers: none
- fallback_capabilities: bounded direct repo reads
- runtime_mcp_evidence: session-local GitNexus query used for orientation only
- confidence: high
- limitations: canonical graph facts are dirty-advisory and impact_context=false; worktree status hash differs from compiled graph facts, so GitNexus results are pointers only and all implementation claims require source reads.

## Graph / GitNexus Evidence

- provider: GitNexus
- native_tool_or_resource: `mcp__gitnexus.query`
- repo_scope: spec-first
- capability_status: partial
- evidence_grade: stale
- evidence_posture: fallback
- freshness_state: dirty-advisory
- source_tags: [live-mcp-tool, session-local-inference]
- source_contract_fields: `capabilities.query_global_graph=true`, `provider_summary.ready_primary_providers=["gitnexus"]`, `capabilities.impact_context=false`
- source_reads_required: mandatory for every file/path decision
- impact_on_plan: GitNexus pointed to `src/cli/plugin.js`, runtime capability catalog, governance tests, and workflow boundary tests; direct source reads confirmed the actual implementation surfaces.
- capabilities_used: query orientation only
- key_findings: workflow commands are generated from `src/cli/contracts/dual-host-governance/skills-governance.json` plus `templates/claude/commands/spec/*.md`; Codex delivers workflow skills through `.agents/skills` generated from source; public workflow contract summaries and invocation boundary tests provide existing guardrails for a new workflow.
- limitations: no fresh graph impact, no process graph reliance, no generated runtime inspection.

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-brainstorm/SKILL.md` and `skills/spec-brainstorm/references/requirements-capture.md`: existing WHAT-shaping boundary, lightweight GitNexus posture, Requirements Readiness Gate dimensions, `docs/brainstorms/*-requirements.md` artifact pattern.
- `skills/spec-plan/SKILL.md` and `skills/spec-plan/references/plan-template.md`: requirements intake, `spec_id` inheritance, Graph Readiness block, implementation-unit format, repo-relative path rule.
- `skills/using-spec-first/SKILL.md`: current public workflow routing table and entry-governor source of truth.
- `skills/spec-doc-review/SKILL.md`: persona dispatch gate and conditional persona list; relevant only if readiness reviewer becomes reusable by doc-review.
- `src/cli/plugin.js`: workflow manifest generation from governance and command template frontmatter.
- `src/cli/contracts/dual-host-governance/skills-governance.json`: source of truth for workflow exposure and dual-host delivery.
- `templates/claude/commands/spec/brainstorm.md`: minimal Claude command template pattern.
- `tests/unit/public-workflow-contract-summary.test.js`, `tests/unit/workflow-invocation-boundary.test.js`, `tests/unit/dual-host-governance-contracts.test.js`, `tests/unit/lint-skill-entrypoints.test.js`, `tests/unit/spec-brainstorm-contracts.test.js`, `tests/unit/spec-plan-contracts.test.js`: existing focused guardrails to extend or mirror.
- `docs/需求文档模版/标准模版/README.md`, `00-通用增量需求模板.md`, `10-App客户端需求模板.md`, `20-Admin中后台需求模板.md`, `30-Backend中台服务需求模板.md`, `90-证券行业需求关注点与参考附录.md`: human-facing template library and securities overlay seed.

### Institutional Learnings

- `docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md`: adding a public workflow requires source skill, command template, and dual-host governance alignment.
- `docs/solutions/workflow-issues/host-entrypoint-mapping-source-boundary-2026-04-29.md`: ordinary workflow prose should use current-host wording; concrete Claude/Codex mappings belong to init/governance/README tables.
- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`: fix source-of-truth, regenerate runtime; do not patch generated mirrors.
- `docs/solutions/workflow-issues/owner-driven-spec-iteration-methodology-2026-05-29.md`: prefer smallest durable mechanism, owner decision, and source-backed review over additive architecture.

### External References

- None used in this planning run. The origin document carries prior external/local competitive and PRD-template analysis as advisory context; this plan relies on current repo source and template docs.

---

## Key Technical Decisions

- **Single workflow, multiple internal intents:** `spec-prd` owns create/refine/validate routing internally. Public entrypoint proliferation is the main risk, so command/governance adds only `prd`.
- **Runtime references derive from templates, not vice versa:** human-facing templates stay readable and domain-rich; runtime references extract the execution contract. Drift is exposed by tests/checklists instead of a generator in v1.
- **By-reference readiness gate in v1:** duplicating the entire brainstorm gate would create drift; physical extraction would touch a completed workflow and raise dual-host risk. v1 references gate dimensions and tests for drift.
- **No default readiness reviewer file:** adding an agent before eval evidence is agent-collection creep. The planned default is orchestrator-owned readiness; agent creation is conditional on fresh-source eval findings.
- **Securities overlay is product constraint, not legal authority:** the overlay asks what must be confirmed and where to record uncertainty; it does not assert current regulatory facts.
- **Spec-plan remains HOW owner:** `spec-prd` may describe product-level contract expectations such as idempotency or audit needs, but must not write implementation units, schema, exact API fields, database tables, or task decomposition.

---

## Open Questions

### Resolved During Planning

- 是否创建 `docs/prds/`：否，继续写 `docs/brainstorms/*-requirements.md`。
- 是否在 v1 抽 shared readiness contract：否，by-reference + drift test；抽取推迟 v2。
- 是否新增公开 PRD 子 skill：否，create/refine/validate 是内部 intent。
- 是否现在实体化 readiness reviewer：否，先实现 orchestrator readiness lens 和 eval fixtures；是否实体化由 fresh-source eval 证据决定。
- 是否把证券模板作为 runtime source：不直接把人用模板当 runtime；runtime references 明确 derive/reference/diverge 关系。

### Deferred to Implementation

- `skills/spec-prd/references/*` 最终章节措辞：实现时按 origin R/AE 与标准模板库提炼，保持简洁。
- drift test 的实现形态：可用 focused unit test 锁定 core section / lens 关键短语，也可用 reviewer checklist；优先最小可维护测试。
- fresh-source eval 的运行方式：若 host 没有授权 dispatch，记录 `fresh_source_eval: not_run` 与原因，不能伪造 reviewer pass。

---

## Output Structure

```text
skills/spec-prd/
  SKILL.md
  references/
    current-state-analysis.md
    domain-lenses.md
    intent-routing.md
    prd-output-template.md
    prd-readiness-lens.md
  evals/
    examples.json
templates/claude/commands/spec/prd.md
tests/unit/spec-prd-contracts.test.js
```

Optional only if eval proves necessary:

```text
agents/spec-requirements-readiness-reviewer.agent.md
```

---

## High-Level Technical Design

> This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.

```mermaid
flowchart TD
  UserInput[User idea / existing PRD / PRD validation request]
  Route[using-spec-first routing]
  Prd[spec-prd workflow]
  CurrentState[current-state analysis]
  Delta[Change Delta confirmation]
  Template[core + conditional PRD template]
  Lens[surface lens + industry overlay]
  Ready[PRD readiness lens]
  Artifact[docs/brainstorms/*-requirements.md]
  Plan[spec-plan]
  DocReview[spec-doc-review]

  UserInput --> Route
  Route -->|0-1 unclear| Brainstorm[spec-brainstorm]
  Route -->|brownfield PRD| Prd
  Route -->|PRD/Figma/source audit| AppAudit[spec-app-consistency-audit]
  Prd --> CurrentState --> Delta --> Template
  Lens --> Template
  Template --> Ready
  Ready -->|pass or assumption accepted| Artifact --> Plan
  Ready -->|gap remains| DocReview
```

---

## Implementation Units

### U1. 新增 `spec-prd` workflow source 与 reference load skeleton

**Goal:** 创建精简的 `spec-prd` workflow 入口，声明触发、边界、输入输出、phase 流程、reference load 条件和 handoff，不在 `SKILL.md` 中堆完整模板。

**Requirements:** R1, R8, R9; Covers AE1, AE2, AE5c, AE8, AE9

**Dependencies:** None

**Files:**
- Create: `skills/spec-prd/SKILL.md`
- Create: `skills/spec-prd/references/intent-routing.md`
- Modify: `src/cli/contracts/dual-host-governance/skills-governance.json`（与 skill 目录同一原子提交登记 governance 记录——见 Approach 的 red-light 说明）
- Test: `tests/unit/spec-prd-contracts.test.js`
- Modify: `tests/unit/public-workflow-contract-summary.test.js` if needed to assert workflow summary coverage

**Approach:**
- `SKILL.md` 前 120 行必须包含 workflow contract summary，匹配现有 public workflow guardrail。
- 主流程按 Scope confirmation -> Complexity gate -> Current-state reveal -> Delta confirmation -> Focused gap questions -> Draft PRD / Split summary -> Readiness and handoff 编排。
- `intent-routing.md` 固化 create/refine/validate、低质量 refine 输入处理、code-align posture、complexity split-decision gate、brainstorm/app-audit tie-break。
- `intent-routing.md` 明确 LLM 可给出语义拆分建议，但 owner/PM 确认拆分边界后才落盘 split summary 和 child PRDs；工具与代码分析只提供事实输入。
- 共享 prose 只写 current-host entrypoint，不复制 Claude/Codex 双宿主命令映射。
- **必须在创建 `skills/spec-prd/` 目录的同一提交内登记 governance 条目**：`src/cli/plugin.js` 的 `validateSkillsGovernance()`（约 L425）对任何缺 governance 记录的 `skills/<dir>` 抛 `missing skills`，该校验被大量 unit test 间接调用。若 skill 目录先落地、governance 留到 U5，Phase 1 结束后整个 unit 套件（含本单元 tests）会变红。U1 只登记 governance 记录本身（字段清单见 U5）；Claude command template、manifest/README 计数等剩余暴露面仍由 U5/U8 完成。

**Patterns to follow:**
- `skills/spec-brainstorm/SKILL.md` 的 WHAT/HOW 边界和 repo scan evidence posture。
- `skills/spec-doc-review/SKILL.md` 的 invocation boundary 表达方式。

**Test scenarios:**
- Happy path: `spec-prd` SKILL 前 120 行含 Contract Summary 八字段。
- Happy path: `intent-routing.md` 明确 create/refine/validate，且 `code-align` 不作为第四个 intent。
- Edge case: low-quality refine input 必须结构化为主张与缺口，不假装完整 PRD。
- Edge case: complexity gate 命中跨端/大需求信号时输出 split-decision 建议，不生成 packet 目录。
- Edge case: oversized initial PRD 只有在 owner 确认拆分后，才生成 split summary + child PRDs；原始 PRD by-reference 保留。
- Error path: 0-1 product idea 路由到 current host's brainstorm entrypoint，而不是生成伪 PRD。

**Verification:**
- 新 workflow source 可被 source tests 发现；runtime-facing prose 不违反 workflow invocation boundary 和 host entrypoint mapping 规则。

---

### U2. 落地 current-state analysis 与 PRD evidence contract

**Goal:** 让 `spec-prd` 在写 PRD 前能用 bounded source reads + GitNexus orientation 建立现状快照，并把 evidence tag 写入 PRD 输出约束。

**Requirements:** R2, R3; Covers AE3, AE4, AE5b, AE5e

**Dependencies:** U1

**Files:**
- Create: `skills/spec-prd/references/current-state-analysis.md`
- Modify: `skills/spec-prd/SKILL.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- 定义 source priority：用户陈述、repo source/docs/tests/contracts、GitNexus pointer、external research、assumption。
- 规定 GitNexus dirty/stale/impact-unavailable 时只能作为 candidate pointer；关键 current-state claim 要 source-confirm 或进入 assumption/outstanding question。
- Current System Snapshot 覆盖现有能力、业务流程、页面/路由/API、权限/角色、状态/异常、配置/后台任务、测试和文档；小需求可 compact，但不能省略会改变 scope 的不确定点。
- Change Delta 固定 keep / extend / replace / remove / unknown。
- 映射 PRD tags 到既有 graph evidence policy，不新增 evidence enum。

**Patterns to follow:**
- `docs/contracts/graph-evidence-policy.md`
- `skills/spec-brainstorm/SKILL.md` 的 GitNexus lightweight pointer 纪律。
- `skills/spec-plan/references/graph-evidence-posture.md` 的 stale / session-local 边界。

**Test scenarios:**
- Happy path: reference 文档包含 Current System Snapshot、Change Delta、keep/extend/replace/remove/unknown。
- Edge case: stale GitNexus pointer 不得写成 confirmed fact。
- Edge case: current-state facts 不得自动扩大产品范围。
- Error path: 未带 evidence tag 的现状主张不得作为 confirmed-source 写入 PRD 主体。

**Verification:**
- `spec-prd` tests 锁定 evidence tags、GitNexus downgrade、Change Delta 词表和 no-new-evidence-enum 边界。

---

### U3. 建立 PRD output template 与标准模板库 drift 守护

**Goal:** 把人用标准模板库提炼为 runtime authoring contract，让 PRD 输出 right-sized、可规划、符合证券行业模板边界，并防止模板库与 skill reference 分叉。

**Requirements:** R3, R4, R5; Covers AE5-AE6b, AE11

**Dependencies:** U1, U2

**Files:**
- Create: `skills/spec-prd/references/prd-output-template.md`
- Create: `skills/spec-prd/references/domain-lenses.md`
- Modify: `skills/spec-prd/SKILL.md`
- Test: `tests/unit/spec-prd-contracts.test.js`
- Reference: `docs/需求文档模版/标准模版/README.md`
- Reference: `docs/需求文档模版/标准模版/00-通用增量需求模板.md`
- Reference: `docs/需求文档模版/标准模版/10-App客户端需求模板.md`
- Reference: `docs/需求文档模版/标准模版/20-Admin中后台需求模板.md`
- Reference: `docs/需求文档模版/标准模版/30-Backend中台服务需求模板.md`
- Reference: `docs/需求文档模版/标准模版/90-证券行业需求关注点与参考附录.md`

**Approach:**
- `prd-output-template.md` 固定 core sections：Summary、Change Delta、Requirements、Acceptance Examples、Scope Boundaries、Evidence And Assumptions；支持 conditional sections：Problem Frame、Current System Snapshot、Goals / Success Metrics、Glossary、Actors、Use Cases、Interaction Requirements、Exception Handling、Data / Compliance Boundaries、Release / Operation Readiness、Outstanding Questions。
- 明确 PRD frontmatter 和默认路径，确保 `artifact_kind: prd-requirements` 能被 `spec-plan` 直接消费。
- 定义 split summary 与 child PRD 的轻量 frontmatter：同组文档共享 base `spec_id` / slug；split summary 使用 `artifact_kind: prd-requirements` + `document_role: split-summary`；child PRD 使用 `artifact_kind: prd-requirements` + `document_role: child-prd` + 唯一 `child_id`，并带 `parent_spec_id`、`source_prd`、`split_summary` 回链。该设计不新增 manifest / trace-ledger。
- `domain-lenses.md` 定义 App、H5/PC、Admin、Backend/Java、CLI/DevTool、Mixed surface lens，并允许叠加 industry overlay。
- 证券 overlay 以 `90-证券行业需求关注点与参考附录.md` 为 seed，提炼 C1-C12 横切关注点；明确这些是待确认清单，不是合规事实。
- drift 守护优先采用 focused unit test：锁定 runtime template 至少包含 core section 清单、surface lens 清单、securities overlay 清单，并引用标准模板库路径；不要求全文一致。

**Patterns to follow:**
- `docs/需求文档模版/标准模版/README.md` 的 human-facing / runtime contract 关系说明。
- `skills/spec-brainstorm/references/requirements-capture.md` 的 right-sized requirements artifact 风格。

**Test scenarios:**
- Happy path: core sections 与 origin R16 一致，且 Success Metrics 是 conditional，不编造数值目标。
- Happy path: Backend/Java lens 关注状态机、幂等、事务、错误语义、兼容和观测性。
- Happy path: securities App order fixture 同时触发 App lens 与 securities overlay。
- Happy path: oversized PRD split fixture 产出 split summary 结构和 child PRD 回链规则。
- Edge case: H5/PC、CLI/DevTool、Mixed 没有人用专属模板时，runtime lens 仍可从通用模板叠加关注点，不臆造完整人用模板。
- Error path: template reference 包含 implementation units、schema、接口字段设计、数据库表设计等 HOW 内容时测试失败或 reviewer checklist 标红。

**Verification:**
- `tests/unit/spec-prd-contracts.test.js` 能暴露 runtime references 与标准模板库 core/lens 语义漂移。

---

### U4. 实现 PRD readiness lens 与 by-reference gate drift check

**Goal:** 复用既有 Requirements Readiness Gate，同时追加 PRD-specific readiness 检查，避免 `spec-prd` 产物让 `spec-plan` 发明 WHAT。

**Requirements:** R6, R7, R8; Covers AE7, AE8, AE10

**Dependencies:** U1, U2, U3

**Files:**
- Create: `skills/spec-prd/references/prd-readiness-lens.md`
- Modify: `skills/spec-prd/SKILL.md`
- Test: `tests/unit/spec-prd-contracts.test.js`
- Test: `tests/unit/spec-brainstorm-contracts.test.js` only if existing gate assertions need a reusable exported fixture pattern

**Approach:**
- `prd-readiness-lens.md` 引用既有 Requirements Readiness Gate 的维度清单，不复制全文、不跨读 `spec-brainstorm` 私有 reference 作为 runtime dependency。
- 追加 PRD-specific lens：current-state accuracy、change delta clarity、exception coverage、interaction readiness、evidence provenance、planning invention risk。
- 当 securities overlay 命中时，额外检查监管/资金/交易/数据/审计边界是否显式标注。
- Readiness fail 输出最小补齐问题或修订建议；用户选择带 assumptions 继续时，PRD 必须记录风险。
- Contract test 锁定两处 gate dimension 不 drift。v1 不抽 shared contract 文件。

**Patterns to follow:**
- `skills/spec-brainstorm/references/requirements-capture.md` 的 `## Requirements Readiness Gate`。
- `docs/contracts/workflows/fresh-source-eval-checklist.md` 的 source-only eval 纪律。

**Test scenarios:**
- Happy path: `prd-readiness-lens.md` 包含 brainstorm gate 六维名，并追加 PRD-specific 六项检查。
- Edge case: PRD 缺异常/交互/验收时 readiness 不推荐进入 work，输出补齐问题。
- Edge case: securities overlay 命中但未标资金/交易/审计边界时 readiness fail。
- Error path: 实现复制整段 brainstorm gate 或新增第二套 evidence enum 时测试失败。

**Verification:**
- Readiness lens 自包含 PRD-specific 判断，且 gate 复用姿态保持 by-reference。

---

### U5. 注册 public workflow command 与 dual-host delivery

**Goal:** 让 Claude 通过 `/spec:prd`、Codex 通过 `$spec-prd` 暴露同一个 source workflow，同时保持 command manifest、governance 和 runtime adapter 边界一致。

**Requirements:** R1, R8, R9; Covers AE8

**Dependencies:** U1

**Files:**
- Create: `templates/claude/commands/spec/prd.md`
- Modify: `src/cli/contracts/dual-host-governance/skills-governance.json`
- Test: `tests/unit/dual-host-governance-contracts.test.js`
- Test: `tests/unit/workflow-invocation-boundary.test.js`
- Test: `tests/unit/lint-skill-entrypoints.test.js`

**Approach:**
- governance 记录的完整字段（schema `additionalProperties:false`，`required: [skill_name, entry_surface, command_name, host_scope, owner_host, host_delivery]`）：`skill_name: spec-prd`、`entry_surface: workflow_command`、`command_name: prd`、`host_scope: dual_host`、`owner_host: null`、`host_delivery: { claude: command, codex: skill }`。**注意 `host_scope` 与 `owner_host` 是 schema 必填字段**，遗漏会被 governance 校验拒绝（对照现有 `spec-brainstorm` / `spec-plan` 记录）。
- 该 governance 记录已在 U1 与 skill 目录同提交登记；本单元负责补齐 Claude command template、manifest 暴露与 filtered-asset 一致性，不重复登记。
- 新增 Claude command template 只放 frontmatter 与简短说明，正文由 `skills/spec-prd/SKILL.md` 合成。
- 不新增 `.codex/commands/spec/prd.md`，不手改 `.agents/skills/spec-prd/SKILL.md`。
- 若 existing tests 对 public workflow list 有 hard-coded expectations，按新增 workflow 更新 expected manifest。

**Patterns to follow:**
- `templates/claude/commands/spec/brainstorm.md`
- `src/cli/plugin.js` 的 `buildPluginManifestFromSources()`
- `docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md`

**Test scenarios:**
- Happy path: generated manifest 包含 command `prd` -> skill `spec-prd`。
- Happy path: Claude filtered assets 包含 command + workflow skill，Codex filtered assets 包含 workflow skill 且不包含 command file。
- Edge case: runtime-facing prose 不把 `spec-prd` 描述为 agent type 或 standalone helper skill。
- Error path: readiness reviewer 若存在，不得作为 workflow command 暴露。

**Verification:**
- Dual-host governance tests 证明新增 workflow 暴露策略与现有 adapter 边界一致。

---

### U6. 更新 routing、spec-plan intake 与 downstream handoff

**Goal:** 把 `spec-prd` 接入 entry governor 和 downstream plan intake，让 brownfield PRD 请求走新 workflow，产物能被 plan 当 requirements artifact 消费。

**Requirements:** R1, R3, R8, R9; Covers AE1, AE2, AE7, AE9

**Dependencies:** U1, U3, U5

**Files:**
- Modify: `skills/using-spec-first/SKILL.md`
- Modify: `skills/spec-plan/SKILL.md`
- Test: `tests/unit/spec-prd-contracts.test.js`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/lint-skill-entrypoints.test.js`

**Approach:**
- `using-spec-first` Route Map 增加 PRD authoring / existing PRD refine / code-aware PRD validation -> current host's PRD workflow entrypoint。
- 保留 `spec-brainstorm` 对 0-1 idea、产品形态未定、actor/core outcome 未定的优先权。
- 明确 `spec-app-consistency-audit` 继续负责 PRD/Figma/source/route/analytics/i18n 一致性审计，`spec-prd` 不替代 audit。
- `spec-plan` intake 增加 `artifact_kind: prd-requirements`，并说明它等价于 requirements origin，继承 `spec_id`、R/F/AE、Scope Boundaries 与 Evidence And Assumptions。
- 对 split summary，`spec-plan` 应把它当导航/边界 artifact，不默认直接规划；实施计划默认从具体 child PRD 进入，并保留 parent/source/summary trace。
- 普通 prose 使用 current-host wording；具体 `/spec:prd` / `$spec-prd` 映射只在 routing table 或 README 集中表中出现。

**Patterns to follow:**
- `skills/using-spec-first/SKILL.md` Route Map 和 explicit route normalization 风格。
- `skills/spec-plan/SKILL.md` Phase 0.3 source document intake。

**Test scenarios:**
- Happy path: “现有后台用户列表增加导入，帮我写 PRD” 路由到 `spec-prd`。
- Happy path: existing PRD path + “完善/优化/补齐” 路由到 `spec-prd` refine。
- Edge case: 0-1 新社区产品想法仍路由到 `spec-brainstorm`。
- Edge case: PRD + Figma + source consistency audit 路由到 `spec-app-consistency-audit`。
- Integration: `spec-plan` 对 `artifact_kind: prd-requirements` 不生成新 spec_id，而继承 origin spec chain。
- Integration: child PRD 作为 plan origin 时继承共享 base `spec_id`，并在 plan frontmatter 或 Context / Sources 中保留 `child_id`、`parent_spec_id`、`source_prd`、`split_summary` trace；split summary 不被当作 implementation plan 的直接 WHAT 来源。

**Verification:**
- Routing prose 与 plan intake tests 覆盖 tie-break，不引入 standalone command alias 或双宿主 prose drift。

---

### U7. 增加 eval fixtures 并执行 readiness reviewer 实体化门槛

**Goal:** 用 fresh-source eval 事实决定是否需要内部 readiness reviewer agent，而不是预先新增 agent。

**Requirements:** R6, R7, R9; Covers AE7, AE8

**Dependencies:** U1, U4

**Files:**
- Create: `skills/spec-prd/evals/examples.json`
- Optional Create: `agents/spec-requirements-readiness-reviewer.agent.md`
- Optional Modify: `skills/spec-doc-review/SKILL.md`
- Optional Test: `tests/unit/spec-doc-review-contracts.test.js`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- `examples.json` 覆盖 brownfield PRD refine、one-line Admin iteration、0-1 idea route-out、Backend/Java change、low-quality refine input、security-sensitive export、securities App order、success metrics without evidence、template drift、stale GitNexus pointer、readiness fail。
- 默认实现不创建 agent 文件；先把 eval fixtures 用作 source-read reviewer context。
- Fresh-source eval 若证明 orchestrator 自审稳定漏判，才创建 `agents/spec-requirements-readiness-reviewer.agent.md`，并明确它是 internal helper / reviewer persona，不是 public workflow。
- 只有当 agent 实体化且确实要被 doc-review 复用时，才更新 `skills/spec-doc-review/SKILL.md` conditional persona 与 dispatch gate，并补 persona-selection contract test。
- 如果 host 无授权 dispatch，记录 not_run reason；不能声称 eval passed。

**Patterns to follow:**
- `skills/spec-doc-review/evals/examples.json`
- `docs/contracts/workflows/fresh-source-eval-checklist.md`
- `skills/spec-doc-review/SKILL.md` 的 Dispatch Capability Gate。

**Test scenarios:**
- Happy path: eval examples include readiness reviewer gate and public agent entry boundary cases.
- Edge case: no agent file exists by default but readiness lens still works through orchestrator.
- Error path: optional agent, if created, must not appear in workflow governance as `workflow_command` or standalone public entry.
- Error path: doc-review reuse text must not claim reviewer exists unless file and persona contract are updated.

**Verification:**
- Fresh-source eval output or explicit not-run record is available in implementation closeout; optional agent path is either absent by design or fully governed.

---

### U8. 更新用户文档、artifact map 与 release-facing说明

**Goal:** 让用户知道何时用 `spec-prd`、它产出什么、如何与模板库和下游 plan/review 衔接，同时记录 changelog。

**Requirements:** R3, R4, R5, R8, R9

**Dependencies:** U1-U6

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/05-用户手册/04-workflows-artifacts-map.md`
- Modify: `docs/05-用户手册/10-产物目录.md` if artifact routing docs need update
- Modify: `CHANGELOG.md`
- Test: `tests/unit/dual-host-governance-contracts.test.js` if README workflow table assertions are present
- Test: `tests/unit/workflow-artifact-paths.test.js` if artifact path contract is updated

**Approach:**
- README 集中 workflow entry table 可列 `/spec:prd` / `$spec-prd`，普通 workflow prose 继续用 current-host wording。
- **更新 README.md 与 README.zh-CN.md 中内嵌的 bundled-asset 计数**：`tests/unit/dual-host-governance-contracts.test.js`（约 L370「README runtime counts stay aligned」）按 `listBundledSkills().length`、`claudeAssets.commands.length`、`codexAssets.workflowSkills.length` 等动态值断言 README 字面数字。新增 `spec-prd` 会令 bundled skill 数、Claude command 数（含「Generated N command file(s)」行）、Codex workflow skill 数各 +1（若 U7 实体化 reviewer agent 则 agent 数另 +1）。两个 README 的对应数字必须同步更新，否则该测试失败。
- 用户文档说明 `spec-prd` 输出仍在 `docs/brainstorms/*-requirements.md`，不是 `docs/prds/`。
- Artifact map 标明 `artifact_kind: prd-requirements` 是 PRD-grade requirements，可进入 `spec-plan`，也可先走 `spec-doc-review`。
- 文档提及模板库时定位为 human-facing authoring reference；runtime skill references 是执行 contract。
- CHANGELOG 使用 `~/.spec-first/.developer` 中的作者，并标注 user-visible。

**Patterns to follow:**
- 现有 README workflow entrypoint 表。
- `docs/05-用户手册/04-workflows-artifacts-map.md` 的 artifact map 结构。
- `CHANGELOG.md` 现行记录格式。

**Test scenarios:**
- Happy path: docs 说明 PRD artifact path 仍是 `docs/brainstorms/*-requirements.md`。
- Happy path: README.md 与 README.zh-CN.md 的 bundled-asset 计数与 `listBundledSkills()` / filtered-asset 实际值一致（`dual-host-governance-contracts` README-count 断言通过）。
- Edge case: docs 不推荐直接进入 `spec-work`，而是 refine / doc-review / plan / done。
- Error path: docs 不声称 `docs/prds/` 存在，不让用户手改 generated runtime。

**Verification:**
- Documentation tests 或 focused grep 证明新增入口、artifact_kind 和 no-`docs/prds` 边界被覆盖。

---

## Phased Delivery

| Phase | Units | Intent |
| --- | --- | --- |
| Phase 1 | U1-U4 | 先把 workflow behavior、PRD template、evidence 和 readiness contract 写成 source truth |
| Phase 2 | U5-U6 | 再接入双宿主入口与 routing/downstream intake |
| Phase 3 | U7 | 用 fresh-source eval 决定是否需要内部 reviewer agent |
| Phase 4 | U8 | 补用户文档、artifact map、changelog 与最终验证 |

---

## System-Wide Impact

- **Interaction graph:** 新增 public workflow entrypoint；`using-spec-first` routing、README entry table、dual-host governance、plugin manifest generation、Codex/Claude runtime sync 都会感知该 workflow。
- **Error propagation:** PRD readiness fail 应回到最小补齐问题或 doc-review/plan handoff，不直接进入 implementation。
- **State lifecycle risks:** 不写 runtime mirrors；若 `spec-first init` 后 runtime 未刷新，属于 generated asset drift，不是 source 修复点。
- **API surface parity:** Claude `/spec:prd` 与 Codex `$spec-prd` 必须由同一 `skills/spec-prd/SKILL.md` source 生成，不能形成宿主分叉。
- **Integration coverage:** Unit tests 需覆盖 workflow registration、routing tie-break、spec-plan intake、template drift、readiness gate drift；fresh-source eval 补语义置信。
- **Unchanged invariants:** `spec-brainstorm` 仍是 0-1 WHAT shaping；`spec-plan` 仍是 HOW owner；`spec-app-consistency-audit` 仍是 App PRD/Figma/source 一致性审计 owner；`docs/brainstorms/*-requirements.md` 仍是 requirements artifact 路径。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `spec-prd` 与 `spec-brainstorm` 入口边界混淆 | U6 routing tie-break + examples: brownfield PRD 优先 `spec-prd`，0-1 shape 未定优先 `spec-brainstorm` |
| 人用模板库与 runtime references 漂移 | U3 drift test/checklist 锁 core sections、surface lens 和 securities overlay 关键语义 |
| by-reference readiness gate 仍有 drift 风险 | U4 用 focused contract test 锁两处 gate dimensions；物理抽取 deferred v2 |
| 证券 overlay 被误读成合规事实 | U3/U4 明确 evidence tag、Outstanding Questions 和合规确认边界 |
| 过早新增 readiness reviewer agent | U7 默认不创建 agent；只有 fresh-source eval 证明 orchestrator 自审失效才实体化 |
| 新 workflow 注册漏某一宿主 | U5 覆盖 governance + command template + filtered asset tests |
| 工作树已有大量无关改动 | 实施时只改本计划列出的 source paths；不得 revert unrelated changes；必要时先读目标文件当前内容再 patch |

---

## Alternative Approaches Considered

- **继续扩 `spec-brainstorm` 而不新增 workflow:** 拒绝。origin 已裁决增量 PRD 与 0-1 brainstorm 是不同产品心智；继续扩会让 brainstorm 职责膨胀。
- **新增 `docs/prds/` 作为 PRD 目录:** 拒绝。会新增需求 artifact 第二真相源，破坏 `docs/brainstorms/*-requirements.md` 到 `spec-plan` 的现有链路。
- **v1 直接抽 shared readiness contract:** 拒绝。会触动已完成的 brainstorm gate 与双宿主 runtime，边际成本高于 v1 价值。
- **v1 直接创建 readiness reviewer agent:** 拒绝作为默认。没有 eval 证据前新增 agent 是维护成本和入口治理风险。
- **把标准模板库变成生成 runtime references 的脚本源:** 暂不采用。v1 用 reference + drift test 即可解决 80% 问题，脚本生成会增加 contract/schema 和维护成本。

---

## Documentation / Operational Notes

- 实施完成后如果需要刷新本机宿主 runtime，使用 `spec-first init`；这不是 source validation proof，也不应替代 tests/fresh-source eval。
- PRD 模板中出现证券市场、交易时段、交收周期、客户分类等示例时，必须标为示例或待确认，不写成通用事实。
- 新增 `spec-prd` 后，后续 `$spec-plan` 可直接消费 `artifact_kind: prd-requirements` 的 origin 文档，不需要新目录或新 artifact kind pipeline。

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-30-003-spec-prd-owner-final-requirements.md`
- Related design: `docs/02-架构设计/需求拆分/大需求拆分.md`
- Template library: `docs/需求文档模版/标准模版/README.md`
- Template library: `docs/需求文档模版/标准模版/00-通用增量需求模板.md`
- Template library: `docs/需求文档模版/标准模版/10-App客户端需求模板.md`
- Template library: `docs/需求文档模版/标准模版/20-Admin中后台需求模板.md`
- Template library: `docs/需求文档模版/标准模版/30-Backend中台服务需求模板.md`
- Template library: `docs/需求文档模版/标准模版/90-证券行业需求关注点与参考附录.md`
- Runtime governance: `src/cli/contracts/dual-host-governance/skills-governance.json`
- Manifest generator: `src/cli/plugin.js`
- Routing source: `skills/using-spec-first/SKILL.md`
- Plan intake source: `skills/spec-plan/SKILL.md`
- Fresh-source eval contract: `docs/contracts/workflows/fresh-source-eval-checklist.md`
