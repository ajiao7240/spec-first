---
title: "feat: spec-prd Domain Grill 质量闭环技术方案"
type: feat
artifact_kind: implementation-plan
status: active
date: 2026-06-03
spec_id: 2026-06-03-001-spec-prd-domain-grill
origin: none
related_spec: 2026-06-02-002-spec-prd-quality-feedback-loop
method_source: external local `grill-with-docs` skill (advisory method input only)
target_repo: spec-first
---

# feat: spec-prd Domain Grill 质量闭环技术方案

## Summary

本方案把外部 `grill-with-docs` skill 中最有价值的两类能力收敛进 `spec-prd` 的最小质量闭环：

- **问法纪律**：能由代码、文档、既有 glossary 或 ADR-like 材料回答的问题先查证；真正需要 owner 决策时，一次只问一个高影响问题，并给出推荐答案与后果。
- **决策筛选标准**：只有 hard to reverse、surprising without context、real tradeoff 三者同时成立时，才建议未来 ADR-like artifact；普通术语/边界/取舍只写入 PRD 的 `Glossary`、`Decision Notes`、`Evidence And Assumptions` 或 `Outstanding Questions`。

本方案不把 `grill-with-docs` 的 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/` 产物体系引入 `spec-first`。对 `spec-prd` 来说，正确吸收方式是增强 brownfield PRD authoring discipline，而不是新增第二套 source-of-truth 或 PRD 生命周期平台。

## Spec Chain Decision

本 plan 新建独立 spec chain `2026-06-03-001-spec-prd-domain-grill`，不继承 `2026-06-02-002-spec-prd-quality-feedback-loop` 的 spec_id。

理由：

- `2026-06-02-002` 的主题是 `spec-prd` ↔ `spec-plan` 的 handoff / feedback loop（stale-proposal 校准、reciprocal handoff gate、PRD miss feedback candidate、AI lens、anti-platform 边界），其 R1–R10 不涉及 Domain Grill 问法纪律。
- 本 plan 的主题是 `spec-prd` ↔ owner 的 questioning loop：把外部 `grill-with-docs` skill 的问法收敛成 bounded micro-loop。这是另一条质量线，不是 `2026-06-02-002` 的子集。
- 该工作由 plan 期引入的外部 `grill-with-docs` 输入驱动，没有对应的 brownfield PRD-grade requirements 文档；`2026-06-02-002-...-requirements.md` 仅作为相邻质量线参考（`related_spec`），不是本 plan 的需求来源。

因此本 plan 直接从用户请求与外部方法输入做技术规划（参见 `skills/spec-plan/SKILL.md`：无相关 requirements doc 时 planning 可直接从请求出发），并据 `skills/spec-plan/SKILL.md` 关于"从同一 origin 派生独立交付链须记录 inherit/new 决策"的约定，在此显式记录为 **new chain**。后续若需要 owner 级 WHAT 评审，可补一份 Domain Grill brainstorm 并回填 `origin`。

## Goals

- G1. 增强 `spec-prd` 在术语、领域边界、source/user 矛盾上的 PRD 精度，降低 `spec-plan` 继续发明 WHAT 的概率。
- G2. 将 `grill-with-docs` 的“relentless questioning”收敛为 bounded micro-loop：最多 1-3 个高价值 Domain Grill 问题，不变成长访谈、coaching script 或状态机。
- G3. 让 material decision 在 PRD 中有轻量、可审查的 `Decision Notes`，但不默认创建 ADR 或长期上下文文件。
- G4. 用 examples-as-context 和 focused contract tests 固化行为，避免未来回归成平台化产物、自动语义判断脚本或 generated runtime 手改。

## Requirements

- R1. `spec-prd` 必须在现有 `Bounded Scenario Grill` 语义内显式定义 Domain Grill trigger / non-trigger，且先查 source/docs/tests/glossary/ADR-like artifact，再问 owner。
- R2. Domain Grill owner 提问必须保持 bounded：一次一个问题，普通 PRD run 最多 1-3 个问题，并尽量提供 `recommended_answer`、推荐原因、后果和写入目标。
- R3. Domain Grill 的结果必须落入现有 PRD-local sections 与 `Decision Notes` 字段集，不创建 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/` 或第二套持久 artifact topology。
- R4. `spec-prd` readiness 必须能检查关键术语、领域边界、source/user 矛盾和 material decision 是否经过足够的 source-first grill 与 decision-note 记录。
- R5. examples-as-context 与 focused contract tests 必须覆盖 source-first grill、long interview 防护、no context/ADR default 等 failure modes，且不得把 examples 描述成已执行 eval runner。
- R6. `spec-plan` 只能识别 PRD handoff 中残留的 WHAT/domain 缺口并给出 revise-prd 或 inline advisory feedback candidate，不得复制 `spec-prd` readiness 或新增自己的 Domain Grill workflow。
- R7. 行为型 skill prose 变更完成时，必须更新 `CHANGELOG.md`，运行聚焦验证，并执行 fresh-source eval；若 fresh-source eval 未运行，必须记录具体 `not_run` 原因。

## Non-Goals

- 不创建 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/`、`business-context.md`、`convention-profile.md`。
- 不新增 PRD feedback schema、PRD diff/changelog CLI、cross-PRD conflict detector、overlay index 或 convention scanner。
- 不把 `spec-prd` 变成需求教练长访谈流程；Domain Grill 只在 PRD ambiguity 会影响 WHAT/acceptance/scope/source-of-truth 时触发。
- 不让脚本判断术语优先级、架构取舍、业务优先级或 ADR 是否成立；脚本只能提供确定性 facts，最终判断由 LLM/owner 完成。
- 不修改 generated runtime mirrors：`.claude/`、`.codex/`、`.agents/skills/`。

## Completion Criteria

- C1. U1-U4 的 `spec-prd` source、examples 和 focused contract tests 完成，且没有新增 CLI、schema、runtime generation 或 persistent context artifact。
- C2. U5 完成时必须二选一：re-read 后记录 `spec-plan` source 已足够、无需修改；或补最小 handoff wording 与对应 contract test。
- C3. `npm run typecheck` 与 `npx jest tests/unit/spec-prd-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand` 通过；若仓库已有无关失败，必须在 closeout 中明确隔离。
- C4. fresh-source eval 结果记录到 `docs/validation/spec-prd/`；若无法执行，只能记录 `not_run` 和具体 runtime/dispatch/user-disable 原因。
- C5. `CHANGELOG.md` 记录本 plan 修订与后续实现变更，handoff write set 包含 expected validation artifact。

## Direct Evidence Readiness

- direct_source_read: yes
- focused_search: yes
- tests_or_logs_checked: source test files read, no test execution for this plan-only artifact
- limitations: `.spec-first/graph/graph-facts.json` missing, so no GitNexus evidence was used; current worktree is already dirty from unrelated in-progress changes
- source_refs:
  - `docs/10-prompt/结构化项目角色契约.md`
  - `docs/brainstorms/2026-06-02-002-spec-prd-quality-feedback-loop-requirements.md`
  - `skills/spec-prd/SKILL.md`
  - `skills/spec-prd/references/domain-language-and-decision-ledger.md`
  - `skills/spec-prd/references/prd-readiness-lens.md`
  - `skills/spec-prd/references/domain-lenses.md`
  - `skills/spec-plan/SKILL.md`
  - `tests/unit/spec-prd-contracts.test.js`
  - `tests/unit/spec-plan-contracts.test.js`
- external_reference: user-named external local `grill-with-docs` skill, read as advisory method input only
- key_findings: current `spec-prd` already has source-first terminology handling, bounded scenario grill, decision notes, optional project glossary promotion, and readiness checks; the missing piece is stricter question cadence, recommended-answer discipline, and eval/test coverage for this behavior.
- impact_on_plan: implementation should be prose/test/eval focused; no CLI, schema, runtime generation, or new artifact topology is needed.
- source_reads_required: implementation must re-read exact target files before editing because the worktree already contains unrelated changes.

## Problem Frame

`spec-prd` 当前已经有 `Source-First Questioning`、`Canonical Term Handling`、`Bounded Scenario Grill`、`Decision Notes` 和 `hard to reverse / surprising / real tradeoff` 的 ADR-like suggestion threshold。问题不是能力缺失，而是这些纪律还不够显性：

- Domain Grill 何时触发、何时不触发还可以更清楚。
- “一次只问一个问题 + 推荐答案 + 后果”没有成为强约束。
- readiness 中还没有独立检查“术语/边界/决策是否经过 source-first grill”。
- eval/test 还没有专门防止 `CONTEXT.md` / ADR / long interview / platform artifact 回流。

本方案的核心设计是：**把 `grill-with-docs` 的问法抽象成 `Domain Grill micro-loop`，并把它限制在现有 PRD artifact 内。**

## Architecture

```text
User input / rough PRD / stale proposal
  -> spec-prd Phase 0 intent routing
  -> current-state evidence gathering
  -> Phase 2 Domain Language And Decision Ledger
      -> source-first terminology/current behavior lookup
      -> ambiguity/contradiction classification
      -> Domain Grill micro-loop when needed
      -> PRD-local Glossary / Decision Notes / Assumptions / Questions
  -> PRD draft/refine
  -> readiness lens
      -> domain-grill coverage
      -> decision-note adequacy
      -> no external artifact topology
  -> spec-plan handoff or revise-prd
```

### Domain Grill Micro-Loop

The loop is run-local authoring discipline, not a new workflow phase artifact.

**命名约定（避免术语增殖）：** `Domain Grill micro-loop` 不是新概念，而是现有 `skills/spec-prd/references/domain-language-and-decision-ledger.md` 中 `Bounded Scenario Grill` 的强化形态——把 trigger/non-trigger 规则、问法节奏和 recommended-answer 纪律显式化。实现时统一沿用现有 `Bounded Scenario Grill` 标题，本 plan 的 "Domain Grill micro-loop" 仅作 plan 内叙述别名，不在 source 中新增第二个 grill 小节标题。

Trigger only when one of these is true:

- A domain term has multiple plausible meanings and the wrong choice would change requirements or acceptance.
- User-stated current behavior conflicts with source/docs/tests.
- A source-of-truth, ownership, or artifact authority decision affects downstream planning.
- A concrete scenario reveals ambiguity in actor, permission, state transition, exception handling, or negative acceptance.
- A hard-to-reverse product/architecture boundary is being decided and would be surprising without context.

Do not trigger when:

- The question is about implementation details that `spec-plan` owns.
- The fact is cheap to confirm from source/docs/tests.
- The term is a general engineering concept rather than a project/domain concept.
- The decision is easy to reverse, obvious, or not the result of a real tradeoff.
- The PRD can safely carry a labeled, non-load-bearing assumption.

Question format:

```text
question:
recommended_answer:
why_recommended:
source_tag:
consequence_if_chosen:
consequence_if_not_chosen:
write_target: Glossary | Decision Notes | Evidence And Assumptions | Outstanding Questions
```

Rules:

- Ask at most one question at a time.
- Ask no more than 1-3 Domain Grill questions in a normal PRD run.
- If more than 3 questions appear necessary, route to PRD refine/doc-review or record blockers instead of continuing a long interview.
- Always give a recommended answer unless there is no defensible default.
- If the owner says “你定”, use the recommended answer only when it is supported by evidence or is safely labeled as an assumption.

**字段映射（避免三套字段漂移）：** 上面的 `Question format` 是 grill *提问期* 的字段,用于组织一次 owner 提问。它**不是** source 中的第三套字段集。落地到 PRD 时,结果写入现有 `Decision Notes` 字段集（`question / recommended_answer / source_tag / chosen_answer / consequence / deferred_reason`，见 `skills/spec-prd/references/domain-language-and-decision-ledger.md`）。映射关系：

- `question` → `question`
- `recommended_answer` → `recommended_answer`
- `why_recommended` → 并入 `consequence` 叙述或省略（非持久字段）
- `source_tag` → `source_tag`
- `consequence_if_chosen` / `consequence_if_not_chosen` → 收敛为 `consequence`
- owner 的选择 → `chosen_answer`；未决时填 `deferred_reason`
- `write_target` → 决定写入 `Glossary` / `Decision Notes` / `Evidence And Assumptions` / `Outstanding Questions` 的哪一节,本身不作为持久字段

U1 与 U3 的 test assertions 必须引用**同一套** `Decision Notes` 字段名,不得让 readiness 检查 `chosen_answer` 而 grill format 只产出 `consequence_if_chosen` 导致字段对不上。

## Source-Of-Truth And Artifact Boundaries

| Item | Source-of-truth | Target behavior | Non-authoritative / rejected |
| --- | --- | --- | --- |
| PRD workflow behavior | `skills/spec-prd/**` | Add authoring/readiness discipline only | generated runtime mirrors |
| PRD output artifact | `docs/brainstorms/*-requirements.md` | unchanged | `docs/prds/`, `specs/`, `CONTEXT.md` |
| Domain glossary | PRD-local `Glossary`; optional `docs/contracts/domain-glossary.md` promotion | preview-first promotion only after 2+ PRDs sharpen same domain term | silent creation of root `CONTEXT.md` |
| Decision record | PRD-local `Decision Notes` | suggest future ADR-like artifact only if threshold passes | default `docs/adr/` creation |
| Feedback loop | `spec-plan` inline advisory feedback candidate | non-durable and human/PRD-refine consumable | feedback schema/registry/report |

## Key Technical Decisions

| Decision | Recommended Answer | Rationale | Consequence |
| --- | --- | --- | --- |
| D1: 是否引入 `CONTEXT.md` | No | `spec-first` 已有 PRD artifact 与 optional `docs/contracts/domain-glossary.md`; 再引入 root context 会制造第二真相源。 | 术语先留在 PRD，跨 2+ PRD 稳定后 preview-first 提议进 project glossary。 |
| D2: 是否默认创建 ADR | No | `grill-with-docs` 自身也要求 ADR sparingly；`spec-prd` 是 WHAT 文档，不应写架构决策记录。 | PRD 只写 `Decision Notes`; 未来 ADR 作为 handoff 建议。 |
| D3: Domain Grill 是否长访谈 | No | `spec-prd` 的原则是 minimize blocking; 长访谈会把 PRD workflow 变成 coaching process。 | 最多 1-3 个高影响问题，超出则 route/refine。 |
| D4: 是否用脚本判断 glossary/ADR | No | 违反 Scripts prepare, LLM decides。 | 脚本可做 glossary drift facts；LLM/owner 判断是否冲突、是否记录。 |
| D5: 是否复制 `grill-with-docs` 产物拓扑 | No | 会突破 `No second artifact topology`。 | 只吸收问法与筛选标准，所有结果写入既有 PRD sections。 |

## Implementation Units

### U1. 强化 Domain Language And Decision Ledger

**Goal:** 把 `grill-with-docs` 的问法显式收敛为 `Domain Grill micro-loop`。

**Requirements:** R1, R2, R3, R5

**Dependencies:** None

**Files:**

- Modify: `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**

- 在 `Bounded Scenario Grill` 下补充 trigger / non-trigger 规则。
- 增加“一次只问一个问题”“推荐答案 + why + consequence”“最多 1-3 个问题”的约束。
- 强化 source-first rule：能由 source/docs/tests/glossary/ADR-like artifact 回答的问题不得问 owner。
- 明确结果只写 PRD-local sections，不创建 `CONTEXT.md` 或 ADR。
- 明确 term capture discipline 继续沿用“domain-specific only”和“define IS, not DOES”。

**Test scenarios:**

- Happy path: domain term ambiguity affects acceptance -> source-first lookup runs, then one owner question includes recommended answer and write target.
- Edge case: source/docs/tests can answer the fact -> no owner question is asked.
- Regression: user asks for `CONTEXT.md` / ADR-style output -> reference keeps the result PRD-local.

**Test assertions:**

标注哪些断言测**新行为**、哪些是**回归锚点**（防止恒真断言给出虚假绿灯）：

- [新行为] 文件包含 `one question at a time` 或等价中文约束。
- [新行为] 文件包含 `write_target`。
- [回归锚点] 文件包含 `recommended_answer`、`consequence`（当前已存在于 Decision Notes,断言确保不被改动删除）。
- [回归锚点] 文件包含 `1-3` / “最多 1-3 个” bounded grill 约束（当前 `Use 1-3 concrete scenarios` 已覆盖）。
- [回归锚点] 文件明确不默认创建 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/`。

**Verification:**

- `domain-language-and-decision-ledger.md` preserves the existing `Bounded Scenario Grill` heading and contains the new source-first, bounded-question, write-target, and no-external-artifact rules.

### U2. 在 spec-prd 主流程中接入 Domain Grill Gate

**Goal:** 让 orchestrator 在 Phase 2 中知道何时加载并应用 Domain Grill，而不是让 reference 成为孤立说明。

**Requirements:** R1, R2, R3

**Dependencies:** U1

**Files:**

- Modify: `skills/spec-prd/SKILL.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**

- 在 Phase 2 `Change Delta And Domain Language` 中增加 Domain Grill Gate 触发条件。
- 明确 gate 是 run-local authoring discipline，不输出独立 artifact。
- 明确当 grill 暴露超过 3 个 load-bearing questions 时，结果应是 `Outstanding Questions`、`revise-prd` 或 `doc-review` handoff，而不是继续长访谈。
- 强调 owner 问题必须影响 WHAT、acceptance、scope、source-of-truth 或 terminology；repo-discoverable facts 必须先查证。

**Test scenarios:**

- Integration: Phase 2 sees a source/user current-behavior contradiction -> it loads the domain-language reference and asks one load-bearing owner question.
- Edge case: more than 3 load-bearing questions are needed -> workflow records blockers or routes instead of continuing an interview.

**Test assertions:**

- `SKILL.md` Phase 2 提到 Domain Grill / Bounded Scenario Grill。
- `SKILL.md` 包含 source-first before asking owner 的约束。
- `SKILL.md` 不包含固定 `CONTEXT.md` / `docs/adr/` 要求。

**Verification:**

- `spec-prd/SKILL.md` wires the gate into existing Phase 2 prose without creating a new workflow phase, artifact, command, or runtime surface.

### U3. 强化 PRD readiness

**Goal:** 让 closeout 能发现术语/决策没有被问清的问题。

**Requirements:** R3, R4

**Dependencies:** U1, U2

**Files:**

- Modify: `skills/spec-prd/references/prd-readiness-lens.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**

- 增加或强化 `domain-grill coverage` 检查：关键术语、领域边界、source/user 矛盾是否经过 source-first + scenario stress-test。
- 增加或强化 `decision-note adequacy` 检查：material decision 是否记录 question、recommended_answer、source_tag、chosen_answer、consequence、deferred_reason。
- 保持现有 readiness lens 为单一 PRD readiness source；不新增第二 evidence enum 或 readiness schema。
- 明确 ADR-like suggestion 只在 hard to reverse / surprising / real tradeoff 三条件成立时出现，且不是本 workflow 默认产物。

**Test scenarios:**

- Happy path: PRD has material decision notes with the existing field set -> readiness can mark decision-note adequacy covered.
- Edge case: PRD has load-bearing domain ambiguity but no source-first grill evidence -> readiness flags planning invention risk.
- Regression: readiness must not require ADR/context artifact creation.

**Test assertions:**

标注新行为 vs 回归锚点：

- [新行为] readiness 文件包含 `domain-grill coverage` 或等价检查。
- [新行为] readiness 文件包含 `decision-note adequacy` 或等价检查,且引用与 U1 一致的 `Decision Notes` 字段名（`question / recommended_answer / source_tag / chosen_answer / consequence / deferred_reason`）。
- [回归锚点] readiness 文件继续包含 `owner-question minimality`、`planning invention risk`、`source-of-truth clarity`。
- [回归锚点] readiness 文件不要求创建 ADR 或 context 文件。

**Verification:**

- `prd-readiness-lens.md` remains the single PRD readiness reference and checks Domain Grill coverage through existing PRD-local evidence.

### U4. 增加 eval fixtures

**Goal:** 用 examples-as-context 锁定真实 failure modes。

**Requirements:** R1, R2, R3, R5

**Dependencies:** U1, U2, U3

**Files:**

- Modify: `skills/spec-prd/evals/examples.json`
- Test: `tests/unit/spec-prd-contracts.test.js`

**New fixture candidates:**

- `domain-term-conflict-source-first`: 用户使用 “account”，已有 glossary 或 docs 区分 `User` / `Customer`；期望先指出冲突、推荐 canonical term、记录 avoid terms。
- `source-user-current-behavior-contradiction`: 用户说支持 partial cancellation，源码/文档只支持 whole-order cancellation；期望记录 contradiction 和一个最小 owner question。
- `bounded-scenario-grill-permission-edge`: PRD 边界依赖角色/权限；期望提出一个具体 permission scenario，而不是泛问“权限怎么做”。
- `decision-note-not-adr`: 存在 hard-to-reverse boundary decision；期望写 PRD `Decision Notes` 并仅建议 future ADR-like artifact，不创建 ADR。
- `no-context-artifact-topology`: 用户要求“像 grill-with-docs 那样沉淀 CONTEXT.md”；期望拒绝默认创建，转为 PRD Glossary / project glossary preview-first。

**Approach:**

- Add compact examples-as-context entries that model desired reviewer/orchestrator behavior, not executable eval results.
- Keep fixtures focused on source-first question discipline, bounded scenario pressure, decision-note routing, and no external artifact topology.

**Test scenarios:**

- Regression: examples include at least one no-context/no-ADR-default case.
- Regression: examples include at least one source-first domain conflict case.
- Reporting: examples text does not claim the fixtures were executed as an eval runner.

**Test assertions:**

- eval examples 包含 source-first domain grill case。
- eval examples 包含 no `CONTEXT.md` / no ADR default case。
- eval examples 不被描述为 executed eval runner。

**Verification:**

- `examples.json` additions are valid JSON and focused contract tests distinguish examples-as-context from executed eval artifacts.

### U5. 对齐 spec-plan handoff

**Goal:** `spec-plan` 消费 PRD 时能识别 Domain Grill 相关 WHAT 缺口，但不复制 `spec-prd` readiness。

**Requirements:** R6

**Dependencies:** U1, U2, U3

**Files:**

- Conditional Modify: `skills/spec-plan/SKILL.md` only if current source lacks explicit enough wording after implementation re-read
- Conditional Test: `tests/unit/spec-plan-contracts.test.js` only if `skills/spec-plan/SKILL.md` is changed or current coverage cannot prove the no-op path
- No-op allowed: if re-read confirms existing PRD intake / handoff entropy wording already covers canonical term, source-of-truth, domain ownership, and hard decision consequence gaps

**Approach:**

- First re-read `skills/spec-plan/SKILL.md` and the relevant `tests/unit/spec-plan-contracts.test.js` assertions.
- If existing source already tells `spec-plan` to route unresolved PRD WHAT/domain/source-of-truth gaps back to PRD refine or inline advisory feedback, record U5 as no-op in implementation closeout and do not edit `spec-plan` or its tests.
- If source is insufficient, add only the minimum handoff wording and focused test coverage.
- 在 PRD intake / handoff entropy check 中提示：若 plan 需要决定 canonical term、source-of-truth、domain ownership、hard decision consequence，应 route to `revise-prd` or emit inline PRD feedback candidate。
- 不增加 `spec-plan` 自己的 Domain Grill workflow。
- 不自动回写 PRD。

**Test scenarios:**

- Conditional happy path: underspecified PRD requires choosing domain ownership -> `spec-plan` emits handoff gap or inline advisory feedback candidate.
- Conditional regression: `spec-plan` does not mention a Domain Grill workflow, copied readiness lens, `CONTEXT.md`, or ADR default.
- No-op path: implementation closeout cites the exact existing source/test lines that already satisfy R6.

**Test assertions:**

仅当修改 `spec-plan` source 或需要补现有覆盖时执行以下断言；no-op 路径必须改为 closeout evidence，不新增恒真测试：

- `spec-plan` 包含 PRD handoff gap / inline advisory candidate boundary。
- `spec-plan` 不要求 `CONTEXT.md` / ADR。
- `spec-plan` 不复制完整 `spec-prd` readiness lens。

**Verification:**

- U5 closeout states either `no-op with evidence` or `source/test updated`; both paths must preserve single-owner readiness under `spec-prd`.

### U6. 文档、Changelog、验证记录

**Goal:** 让变更可审查、可回归、可发布。

**Requirements:** R7

**Dependencies:** U1, U2, U3, U4, U5

**Files:**

- Modify: `CHANGELOG.md`
- Expected Modify: `docs/validation/spec-prd/fresh-source-eval-*.md` — 本增量核心是行为型 prose 变更（问法节奏、recommended-answer 纪律），contract tests 只能断言字符串存在,无法验证 `spec-prd` 的提问行为是否真的改变。因此 fresh-source eval 是 expected,不是 optional。仅当宿主缺少 dispatch primitive、runtime 无法调用,或用户显式禁用 helper agents 时才允许 `not_run`,并必须记录未执行原因（见 `docs/contracts/workflows/fresh-source-eval-checklist.md` 与项目 CLAUDE.md 的 Agent/Skill 变更验证约定）。

**Approach:**

- Update `CHANGELOG.md` for user-visible skill/plan behavior changes.
- Run the focused validation commands after source edits.
- Execute fresh-source eval for changed skill prose, or write an explicit `not_run` validation record only when runtime/dispatch/user-disable constraints prevent execution.
- Keep validation artifact writes under `docs/validation/spec-prd/`; do not write generated runtime mirrors.

**Test scenarios:**

- Reporting: closeout includes exact commands run and separates unrelated dirty-worktree/test failures from this change.
- Fresh-source eval: result is recorded under `docs/validation/spec-prd/`, or `not_run` explains the concrete dispatch/runtime/user-disable cause.

**Verification commands:**

- `npm run typecheck`
- `npx jest tests/unit/spec-prd-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand`
- Expected fresh-source eval following `docs/contracts/workflows/fresh-source-eval-checklist.md`（行为型 prose 变更必须验证语义,不能仅靠字符串断言宣告完成）

**Reporting rules:**

- fresh-source eval 默认 expected。仅在 runtime 无法 dispatch 或用户显式禁用时才报 `not_run`,且必须给出具体原因,不得以"字符串断言已过"替代语义验证。
- Do not claim examples-as-context were executed as evals.
- Disclose unrelated dirty worktree state if it affects verification confidence.

**Verification:**

- `CHANGELOG.md` has a current entry, validation results are reported truthfully, and expected validation artifacts are included in the handoff write set.

## Sequencing

1. Update `domain-language-and-decision-ledger.md` first. This is the core borrowed method contract.
2. Update `spec-prd/SKILL.md` to wire the gate into Phase 2 without expanding workflow topology.
3. Update `prd-readiness-lens.md` so final handoff checks the new discipline.
4. Add eval fixtures and focused tests.
5. Only then touch `spec-plan/SKILL.md`, and only for handoff wording that cannot already be satisfied by current source.
6. Run focused tests and typecheck; record fresh-source eval only if actually executed.
7. Update `CHANGELOG.md`.

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Long interview creep | Slows PRD workflow and violates minimize blocking | Hard cap 1-3 questions; route to refine/doc-review when more are needed |
| Artifact topology creep | Creates `CONTEXT.md` / ADR / lifecycle docs as new truth sources | Negative tests and explicit source prose: PRD-local only |
| Script-owned semantic judgment | Violates Scripts prepare, LLM decides | Scripts may expose glossary drift only; LLM/owner decides meaning |
| HOW leakage | PRD starts recording implementation choices | Gate questions must affect WHAT/acceptance/scope/source-of-truth; implementation details defer to `spec-plan` |
| `spec-plan` duplicates readiness | Creates second PRD readiness gate | Keep a single handoff entropy check; never copy full readiness lens |
| Existing dirty worktree conflicts | Patch may overwrite unrelated changes | Re-read target files immediately before edit; use `apply_patch`; do not revert unrelated work |

## Acceptance Mapping

本 plan 是 new spec chain，验收点是本 plan 自有的 Test Scenarios 与 implementation units，不映射、不冒领 `2026-06-02-002` 的 AE1–AE10（那是相邻质量线的验收）。

| Plan Acceptance | Covered By |
| --- | --- |
| Domain Grill micro-loop 有显式 trigger / non-trigger | U1（domain-language ref），U2（SKILL.md Phase 2 gate） |
| 一次只问一个问题 + recommended_answer + consequence + write_target | U1 test assertions（`one question at a time`、`write_target`） |
| 最多 1-3 个 Domain Grill 问题，超出则 route，不长访谈 | U1、U2 test assertions（`1-3` / 超限 route 措辞） |
| source-first：可由 source/docs/tests/glossary 回答的问题不问 owner | U1、U2 test assertions（source-first before asking owner） |
| readiness 能发现术语/决策未问清 | U3（`domain-grill coverage`、`decision-note adequacy`） |
| 不创建 `CONTEXT.md` / `docs/adr/` / 平台化产物 | U1、U3、U4 negative assertions |
| `spec-plan` 能识别 Domain Grill 相关 WHAT 缺口但不复制 readiness | U5（仅当现有 source 措辞不足时） |
| 行为以 examples-as-context 固化，且不谎称已执行 eval | U4、U6 reporting rules |

## Test Scenarios

- Given a PRD input uses a term that conflicts with `docs/contracts/domain-glossary.md`, when `spec-prd` drafts, then it surfaces the conflict, recommends a canonical term, and records unresolved choice in `Outstanding Questions` or `Decision Notes`.
- Given source confirms current behavior contradicts user wording, when `spec-prd` refines, then it records contradiction with source tag and asks one owner question instead of choosing silently.
- Given a decision is hard to reverse but obvious and not a real tradeoff, when `spec-prd` records it, then it stays in PRD `Decision Notes` and does not suggest ADR.
- Given a decision is hard to reverse, surprising, and a real tradeoff, when `spec-prd` records it, then it may suggest a future ADR-like artifact but does not create it.
- Given more than 3 Domain Grill questions are needed, when readiness runs, then the PRD is not marked ready-for-planning without explicit assumptions or owner resolution.
- Given `spec-plan` needs to choose domain ownership from an underspecified PRD, when planning starts, then it emits a handoff gap or inline advisory feedback candidate instead of inventing ownership.

## Validation Plan

Minimum validation for implementation:

```bash
npm run typecheck
npx jest tests/unit/spec-prd-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand
```

本增量改动 `spec-prd` 的问法行为 prose（trigger 规则、问法节奏、recommended-answer 纪律），属于 material skill prose change，因此 fresh-source eval 是 expected：

- Read `docs/contracts/workflows/fresh-source-eval-checklist.md`.
- Inject current disk source for `skills/spec-prd/SKILL.md` and changed references into a fresh read-only reviewer.
- Record result under `docs/validation/spec-prd/`. 仅当 runtime 无法 dispatch 或用户显式禁用 helper agents 时才记 `not_run` 并说明原因；不得以字符串断言替代语义验证。

## Handoff

This plan is ready for implementation by `$spec-work` once the implementer confirms the target write set is limited to:

- `skills/spec-prd/SKILL.md`
- `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- `skills/spec-prd/references/prd-readiness-lens.md`
- `skills/spec-prd/evals/examples.json`
- `skills/spec-plan/SKILL.md` if needed
- `tests/unit/spec-prd-contracts.test.js`
- `tests/unit/spec-plan-contracts.test.js`
- `docs/validation/spec-prd/fresh-source-eval-*.md` expected; may be `not_run` only with concrete runtime/dispatch/user-disable reason
- `CHANGELOG.md`

Planning should not expand into CLI, schema, runtime generation, generated mirrors, public workflow routing, or new persistent context artifacts without a new PRD.
