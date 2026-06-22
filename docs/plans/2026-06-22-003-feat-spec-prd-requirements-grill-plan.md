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

本计划把外部 `grill-with-docs` 的核心精髓吸收到 `spec-prd` 的前置澄清需求流程：当用户输入粗颗粒度、不完整、会迫使后续 planning 发明 WHAT 的初版 PRD 时，`spec-prd` 先做 PRD sanitization 和 source-first evidence calibration，再建立 run-local shared understanding map，用 1-3 个高价值 owner 问题补齐 actor、flow、state、exception、acceptance、scope 和 decision intersection，然后才进入正式 PRD rewrite/readiness。方案不复制外部 skill 的 `CONTEXT.md` / ADR 产物体系，不新增公开 workflow 节点，不改变 `docs/brainstorms/*-requirements.md` 的 PRD artifact 拓扑。

---

## Decision Brief

- **Recommended approach:** 采用“思想融合，不复制节点”的方案：在 `spec-prd` intake/sanitization 之后、正式 PRD rewrite/readiness 之前加入 PRD-local `Pre-PRD Clarification Loop`，用 `Requirements Grill` 问法纪律压测共同理解；复用当前五个 reference 文件、eval fixtures 和 contract tests，不把 `grill-with-docs` 拷贝为独立 executable node。
- **Key decisions:** `Pre-PRD Clarification Loop` 负责把粗 PRD 的声明、证据、缺口、问题/假设和 PRD 写入目标串成 shared understanding；`Domain Grill` 继续专治术语、矛盾、source-of-truth 和硬边界。两者共享 source-first、one-question-at-a-time、recommended-answer 和 PRD-local write target 纪律，但不共享外部 `CONTEXT.md` / ADR 写入机制。
- **Validation focus:** 锁定前置 trigger/non-trigger、shared understanding map、问题上限、推荐答案格式、write-target 映射、readiness closure、eval fixtures、source topology 不增文件、script/LLM ownership 不漂移，以及 generated runtime mirror 不被当 source。
- **Largest risks / boundaries:** 最大风险是把前置澄清做成长访谈、brainstorm replacement 或第二套 PRD 平台。本计划要求只处理已有粗 PRD/已有系统锚点，超过 3 个 load-bearing 问题时转为 blockers / assumptions / doc-review / refine，而不是继续拷问 owner。

---

## Problem Frame

当前 `spec-prd` 已能处理 brownfield PRD create/refine/validate：它先做 PRD Sanitization 和 current-state evidence，再确认 Change Delta、Domain Grill、Feature Slices、readiness 和 handoff。现有 `Domain Grill` 已吸收一部分 `grill-with-docs` 思想，但主要覆盖领域语言、术语矛盾、source-of-truth、权限/状态/异常边界和 hard decision。用户现在描述的真实输入形态更宽：用户给的是初版 PRD 需求文档，颗粒度粗、需求不完整，需要先理解需求、补齐语义和共同认知，再写出可交给 planning 的 PRD。

上一版方案把这个能力主要表达为 `Requirements Grill Pass`，容易被实现成 PRD rewrite 之前的一个质量诊断后置步骤。这里需要收紧：`grill-with-docs` 的精髓不是“多问几个问题”，而是对 shared understanding 做 pressure loop。它应该前置到粗 PRD 进入正式 PRD artifact 之前，先把初版 PRD 中的 claim、source/evidence、gap、question/assumption 和 PRD write target 连起来，再决定哪些内容能写入 PRD、哪些必须问 owner、哪些只能作为 assumption 或 blocker。

这个缺口不能交给 `spec-plan`。`spec-plan` 定义 HOW，如果 PRD 仍缺 actor、key flow、exception、scope、acceptance 或 unresolved decision intersection，planning 会被迫发明 WHAT，破坏 `Spec -> Plan` 的职责边界。

同时，直接拷贝 `grill-with-docs` 作为 `spec-prd` workflow 的一个节点也不合适：

- 外部 skill 默认会创建或维护 `CONTEXT.md`、`CONTEXT-MAP.md` 和 `docs/adr/`，会给 `spec-prd` 引入第二套 truth source。
- “Interview me relentlessly” 与 `spec-prd` 的 minimize blocking、1-3 owner questions 和 PRD authoring flow 冲突。
- 它是 plan/domain language stress-test 工具，不是 PRD artifact producer；直接作为节点会混淆 `docs/brainstorms/*-requirements.md` 的 producer/consumer contract。
- 它的 glossary/ADR 拓扑可以作为方法输入，但不能升级为 `spec-first` 的默认 source/runtime contract。

因此，本计划的核心是把 `grill-with-docs` 的提问架构重述为 `spec-prd` 原生前置澄清纪律：shared understanding first, source first, one decision at a time, recommended answer, concrete consequence, PRD-local persistence。

---

## Requirements

- R1. 当 `intent=create-from-draft|refine|validate`、输入是粗 PRD/draft/reference claims/会议/聊天/截图/PDF 提取文本、且已有产品或系统锚点足以进行 PRD refinement，并且 `quality_diagnosis=material-gaps|blockers` 或 planning 会发明 WHAT 时，`spec-prd` 必须在正式 PRD rewrite/output 前触发 `Pre-PRD Clarification Loop`。若缺少目标用户、产品问题、系统锚点或核心场景，先路由到 `spec-brainstorm`，不得把 0-1 product discovery 塞进 `create-from-draft`。
- R2. `Pre-PRD Clarification Loop` 必须维护 run-local shared understanding map：`claim -> evidence/source -> gap -> question_or_assumption -> PRD write target`。它是推理脚手架，不是持久 schema、report 或新 artifact。
- R3. 前置澄清必须先查可回答的 source/docs/tests/contracts/glossary/prior PRDs，再问 owner；可由 source 解决的问题不得包装成 owner 决策。
- R4. 每个 owner 问题必须一次只问一个，并携带 `recommended_answer`、`why_recommended`、`source_tag`、`consequence_if_chosen`、`consequence_if_not_chosen` 和 `write_target`。
- R5. 普通 PRD run 的前置澄清问题上限为 1-3 个；超过 3 个 load-bearing gaps 时必须转为 blocker cluster、explicit assumptions、doc-review 或 PRD refine，而不是长访谈。
- R6. 结果只能写入既有 PRD-local sections：`Requirements`、`Acceptance Examples`、`Scope Boundaries`、`Glossary`、`Decision Notes`、`Evidence And Assumptions`、`Outstanding Questions`。不得默认创建 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/`、新 PRD report 或第二套 topology。
- R7. `Domain Grill` 与前置需求澄清必须分工清晰：前者处理术语/矛盾/source-of-truth/硬边界，后者处理粗 PRD 的行为完整性、场景覆盖、验收和 scope completeness；二者共享问法纪律但不互相替代。
- R8. Readiness lens 必须检查前置澄清 closure：load-bearing rough-PRD gaps 已经通过 source、owner answer、明确 assumption、Outstanding Question 或 revise/doc-review route 处理，planning 不再需要补 WHAT。
- R9. Eval fixtures 和 contract tests 必须覆盖 rough PRD trigger、shared understanding map、source-first resolution、recommended-answer discipline、1-3 问题上限、no context artifact、PRD-local write target、script/LLM boundary 和 `spec-plan` 不复制 readiness。
- R10. 实现不得新增公开 skill/agent 入口，不手改 generated runtime mirrors，不改变 `artifact_kind: prd-requirements` 和 `docs/brainstorms/*-requirements.md`。
- R11. Scripts 只能产 deterministic facts、counts、trace gaps、literal drift 或 structure warnings；是否触发前置澄清、问题是否 load-bearing、是否 ready-for-planning 仍归 LLM/readiness judgment。

---

## Assumptions

- A1. 本计划不从现有 brainstorm requirements 继承 `spec_id`。它直接来自当前用户请求和外部本地方法输入，属于新的 plan-local spec chain。
- A2. 现有 `skills/spec-prd/references/domain-language-and-decision-ledger.md` 可以继续作为 question format 和 decision note discipline 的承载文件；为保持 source topology 不扩张，首选修改既有 reference，而不是新增 `requirements-grill.md`。
- A3. `Pre-PRD Clarification Loop` 不需要新脚本。现有 `check-prd-artifact.js` 仍只报告结构/trace facts；新的完整性判断先通过 prompt/eval/contract test 锁定。
- A4. 若后续实现发现 `SKILL.md` 170 行上限压力过大，应把细节下沉到既有 references，而不是提高上限或新增 runtime template。

---

## Scope Boundaries

- 不把 `grill-with-docs` 目录整体拷贝进 `skills/spec-prd/`。
- 不创建一个名为 `grill-with-docs`、`requirements-grill` 或类似名称的新公开 workflow/skill/agent。
- 不把 `CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/` 作为 `spec-prd` 默认 artifact、source-of-truth 或 readiness 前置条件。
- 不把前置澄清循环做成强状态机、numeric PRD scorecard、长问卷或固定 checklist gate。
- 不让 `spec-plan` 运行自己的 grill workflow；`spec-plan` 只消费 PRD，发现 WHAT 缺口时反馈给 PRD refine。
- 不修改 `.claude/`、`.codex/`、`.agents/skills/` generated mirrors。source 变更后的 runtime sync 属于后续 setup/update 动作。
- 不把技术 HOW 补成 PRD requirement；API 字段、数据库、函数、任务拆分和实现单元仍归 `spec-plan` / `spec-work`。

---

## Completion Criteria

- `skills/spec-prd/SKILL.md` 在 Phase 1/2/3 之间明确说明 rough PRD refine 的前置澄清 trigger、shared understanding map、source-first resolution、问题上限、write-target 和 no artifact inflation。
- `skills/spec-prd/references/domain-language-and-decision-ledger.md` 或既有相邻 reference 明确承载前置澄清循环的 question format、trigger/non-trigger、Domain Grill 分工和 PRD-local persistence rules。
- `skills/spec-prd/references/prd-output-template.md` 明确 rough PRD quality diagnosis 到前置澄清循环的衔接，以及每类 gap 的 write target 映射。
- `skills/spec-prd/references/prd-readiness-lens.md` 在 Quality Diagnosis Pack / Core Pack / Domain And Decision Pack 中检查前置澄清 closure，不新增第二 evidence enum。
- `skills/spec-prd/evals/examples.json` 增加正反 fixtures，覆盖 trigger、bounded questions、recommended answer、source-first、no `CONTEXT.md`/ADR、write target 和 planning-invention failure。
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
- current_revision: `58aca78b`
- worktree_status: dirty before this plan; existing unrelated/prior-session changes include `CHANGELOG.md`, several prior plans, solutions docs, and `docs/validation/spec-prd/2026-06-22-spec-prd-execution-flow-ascii.md`. Implementation must not revert them.
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
  - `tests/unit/spec-prd-contracts.test.js` locks source topology to 8 files, references to 5 files, `SKILL.md` line count, no template tree, no `CONTEXT.md` default, eval fixture IDs, and fresh-source eval artifacts.
  - External local `grill-with-docs` method docs define relentless one-at-a-time questioning, source/codebase lookup before asking, recommended answers, glossary sharpening, scenario stress tests, inline `CONTEXT.md` updates, and sparse ADR criteria.
- source_reads_required:
  - Re-read `skills/spec-prd/SKILL.md` immediately before editing to keep line count <=170 and avoid disturbing existing Phase 0-4 flow.
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
- Its default persistence model is intentionally not reused: root/context-specific `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/` remain project-specific optional artifacts, not `spec-prd` defaults.

---

## Key Technical Decisions

- KTD1. **Fuse the method, not the node.** Do not copy `grill-with-docs` as an executable `spec-prd` workflow node. Re-express its questioning discipline inside `spec-prd` references to preserve one public PRD workflow and one PRD artifact chain.
- KTD2. **Add Pre-PRD Clarification as a loop, not a new artifact.** The loop is run-local authoring discipline. It maintains a temporary shared understanding map, but does not create a schema, report, context file, ADR, lifecycle state, or second PRD topology.
- KTD3. **Trigger on planning-invention risk.** The decisive trigger is not “PRD is imperfect”; it is “without resolving this gap, `spec-plan` must invent WHAT”. Minor wording polish can stay in normal optimization suggestions.
- KTD4. **Keep Domain Grill distinct.** Terminology/source contradiction/source-of-truth ambiguity stays in Domain Grill; actor/flow/acceptance/scope completeness gaps are handled by Pre-PRD Clarification. If a question touches both, classify by the consequence: term precision if it changes naming only; requirements clarification if it changes behavior or acceptance.
- KTD5. **Source-first before owner-first.** Repo/docs/tests/contracts/glossary/prior PRDs are checked before asking. The owner should adjudicate product decisions, not facts already available from source.
- KTD6. **Recommended answers are mandatory when defensible.** The loop should reduce owner cognitive load. A question without a recommended answer is allowed only when all available evidence is genuinely ambiguous and any default would invent product scope.
- KTD7. **Questions have write targets.** Every question points to a PRD section before it is asked, preventing detached interview notes and making the final rewrite deterministic enough to review.
- KTD8. **Cap normal clarification runs at 1-3 questions.** More than 3 load-bearing questions means the PRD is not ready for a normal refine rewrite; route to blocker cluster, assumptions, doc-review, or a fuller PRD refinement session.
- KTD9. **Script boundary remains narrow.** No script decides “this question is load-bearing” or “planning would invent WHAT”. Scripts may report missing sections, trace gaps, placeholders, or literal glossary drift; LLM/readiness decides the semantic consequence.
- KTD10. **No `spec-plan` clarification copy.** `spec-plan` may identify PRD handoff entropy and point back to `spec-prd`; it must not host its own requirements grill loop or copy the full PRD readiness lens.

---

## Open Questions

### Resolved During Planning

- Should `grill-with-docs` be copied into `spec-prd` as a workflow node? No. It creates artifact topology and interaction-intensity conflicts; only the questioning method is reused.
- Should `CONTEXT.md` become the default PRD glossary target? No. PRD-local `Glossary` is the first target; project glossary promotion remains preview-first after repeated PRD evidence.
- Should ADRs be written during PRD refinement? No. PRD-local `Decision Notes` are the default; ADR-like artifacts remain optional future suggestions when hard to reverse, surprising, and a real tradeoff.
- Should Pre-PRD Clarification run for every PRD? No. It runs only when rough/incomplete PRD gaps would force planning to invent WHAT.

### Deferred to Implementation

- Exact prose placement inside `SKILL.md`: likely Phase 1/2 boundary plus Phase 3 refine wording, but line budget may require concise anchor text and reference detail.
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
| Current-state and evidence    |
| - source/docs/tests/contracts |
| - glossary / prior PRDs       |
| - evidence tags               |
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
| Quality diagnosis             |
| ready / minor / material /    |
| blockers                      |
+---------------+---------------+
                |
                | material WHAT gaps?
                v
+-------------------------------+
| Pre-PRD Clarification Loop    |
| 1. classify load-bearing gaps |
| 2. resolve source-first       |
| 3. ask 1 question at a time   |
| 4. include recommended answer |
| 5. map to PRD write target    |
+---------------+---------------+
                |
       +--------+---------+
       |                  |
       v                  v
+--------------+   +------------------+
| <=3 questions|   | >3 questions     |
| answer/write |   | blocker cluster  |
| PRD rewrite  |   | assumptions or   |
| and readiness|   | doc-review/refine|
+------+-------+   +---------+--------+
       |                     |
       v                     v
+-------------------------------------+
| Phase 4 readiness                   |
| ready-for-planning only if planning |
| no longer invents WHAT              |
+-------------------------------------+
```

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

---

## Implementation Units

### U1. Add Pre-PRD Clarification Orchestration To spec-prd

**Goal:** Make `spec-prd` visibly route rough PRD create-from-draft/refine/validate inputs through a Pre-PRD Clarification Loop after sanitization and before formal PRD rewrite/readiness when planning-invention risk exists.

**Requirements:** R1, R2, R3, R5, R7, R10

**Dependencies:** None

**Files:**
- Modify: `skills/spec-prd/SKILL.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a compact Phase 1/2/3 anchor that says rough PRD quality gaps should trigger Pre-PRD Clarification after sanitization/current-state evidence and before final rewrite/readiness.
- Extend the run-local decision card only if necessary with a small state such as `pre_prd_clarification_status`; avoid expanding it into a schema.
- Keep `SKILL.md` under the existing line and size constraints by linking detailed rules to existing references.
- Preserve current Domain Grill wording and clarify that Pre-PRD Clarification is broader completeness/shared-understanding checking, not a replacement.

**Patterns to follow:**
- `skills/spec-prd/SKILL.md` Phase 1 PRD Sanitization
- `skills/spec-prd/SKILL.md` Phase 2 Bounded Scenario Grill / Domain Grill Gate
- `skills/spec-prd/SKILL.md` Phase 4 readiness and handoff wording

**Test scenarios:**
- Trigger: a vague PRD draft with missing actor/acceptance and `quality_diagnosis=material-gaps` routes through Pre-PRD Clarification before final rewrite.
- Non-trigger: a clear small bugfix still uses bypass/compact PRD and does not force grill ceremony.
- Boundary: `SKILL.md` still says no standalone context, ADR, or runtime artifacts.
- Regression: first 120 lines retain workflow contract summary and source topology references.

**Verification:**
- The entrypoint communicates the loop without exceeding existing line/size limits.
- Contract tests prove the orchestrator names Pre-PRD Clarification and still keeps generated mirrors out of source fixes.

---

### U2. Define Shared-Understanding Pressure Rules In Existing References

**Goal:** Put the detailed trigger, non-trigger, shared understanding map, question cadence, source-first rule and write-target mapping into the existing reference surface without adding a sixth reference file.

**Requirements:** R2, R3, R4, R5, R6, R7, R11

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-prd/references/domain-language-and-decision-ledger.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a subsection under the current Bounded Scenario Grill / decision ledger area for `Pre-PRD Clarification Loop`.
- Define the run-local shared understanding map as `claim -> evidence/source -> gap -> question_or_assumption -> PRD write target`, and explicitly say it is not persisted as schema.
- Define trigger conditions around rough PRD completeness: missing actor, observable behavior, flow, state, permission, exception, negative acceptance, scope boundary, priority/degrade semantics, or decision intersections.
- Define non-triggers: implementation details, source-answerable facts, minor wording polish, planning-ready PRDs, pure terminology already covered by Domain Grill, low-risk assumptions, 0-1 product discovery, and drafts without enough product/system anchor.
- Reuse the existing run-local question format, adding `write_target` values for PRD core sections while explicitly saying this is not a persistent field set.
- Keep the `CONTEXT.md`, `CONTEXT-MAP.md`, and ADR prohibition in the same reference.

**Patterns to follow:**
- `Source-First Questioning`
- `Bounded Scenario Grill`
- `Decision Notes`

**Test scenarios:**
- Happy path: a rough PRD gap is first placed in the shared understanding map, then produces one owner question with recommended answer, source tag, consequences and write target.
- Edge case: if source/docs/tests answer the gap, no owner question is asked.
- Error path: more than 3 load-bearing questions routes to blocker cluster or doc-review/refine.
- Regression: reference does not say to create `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` by default.

**Verification:**
- Reference prose can be read independently and tells a future implementer exactly when to ask, when not to ask, and where the answer lands.
- Existing no-artifact tests remain true.

---

### U3. Connect Clarification Outputs To Final PRD Rewrite

**Goal:** Ensure PRD quality diagnosis and shared-understanding clarification outputs feed the final PRD artifact rather than leaving a detached critique or post-hoc interview note.

**Requirements:** R1, R2, R6, R8

**Dependencies:** U2

**Files:**
- Modify: `skills/spec-prd/references/prd-output-template.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Extend `PRD Quality Diagnosis And Optimization` with the rule: when top gaps are load-bearing WHAT gaps, run Pre-PRD Clarification before final rewrite or mark blockers.
- Add a compact gap-to-write-target mapping for rough PRD completeness dimensions.
- Preserve the current `original -> recommendation -> reason -> write target` optimization suggestion format.
- Clarify that final durable output remains the rewritten PRD-grade document under `docs/brainstorms/`, not a standalone grill report.

**Patterns to follow:**
- `Adaptive Product Expert Lens`
- `PRD Quality Diagnosis And Optimization`
- `Core Sections` and `Conditional Sections`

**Test scenarios:**
- Happy path: optimization suggestions include write targets that map to PRD sections and are incorporated into final rewrite.
- Edge case: a stated metric without evidence remains assumption or Outstanding Question, not invented target.
- Regression: no numeric PRD scorecard and no standalone quality report artifact.

**Verification:**
- The template gives enough authoring guidance for rough PRD refinement without duplicating the readiness lens or treating clarification as a durable artifact.

---

### U4. Add Readiness Closure For Pre-PRD Clarification

**Goal:** Prevent `ready-for-planning` when rough PRD gaps remain unresolved and would force `spec-plan` to invent WHAT.

**Requirements:** R8, R11

**Dependencies:** U2, U3

**Files:**
- Modify: `skills/spec-prd/references/prd-readiness-lens.md`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Extend existing packs rather than adding a new readiness pack unless implementation proves the wording becomes clearer with a named sub-bullet.
- Add closure checks in Quality Diagnosis Pack and Core Pack for Pre-PRD Clarification outcomes: resolved by source, owner answer, assumption, explicit trace gap, Outstanding Question, or route-out.
- Ensure Domain And Decision Pack still owns terminology/source-of-truth grill adequacy.
- Re-state no context-artifact inflation for Pre-PRD Clarification as well as Domain Grill.

**Patterns to follow:**
- `Quality Diagnosis Pack`
- `Core Pack`
- `Domain And Decision Pack`
- `handoff entropy check`

**Test scenarios:**
- Happy path: rough PRD gaps closed by accepted owner answer can be ready-for-planning.
- Failure path: missing actor/acceptance/scope remains unresolved and readiness returns revise-prd or ask-owner.
- Boundary: readiness does not require `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/`.

**Verification:**
- Readiness prose distinguishes deterministic `check-prd-artifact.js` facts from LLM-owned semantic completeness judgment.

---

### U5. Add Pre-PRD Clarification Eval Fixtures

**Goal:** Add examples-as-context that make the new pre-PRD clarification behavior reviewable and prevent regression to long interviews, context-artifact creation, or planning invention.

**Requirements:** R9

**Dependencies:** U1, U2, U3, U4

**Files:**
- Modify: `skills/spec-prd/evals/examples.json`
- Test: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Add a small set of focused cases instead of a large taxonomy.
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

**Test scenarios:**
- Fixture IDs are present.
- Serialized fixture text includes required behavior and forbidden artifact boundaries.
- Fixture text does not imply executed eval runner or hard state machine.

**Verification:**
- Eval fixture contract remains `spec-prd-evals.v1` and current eval tests pass.

---

### U6. Extend Contract Tests Without Expanding Source Topology

**Goal:** Lock the fusion as a light contract and prevent accidental file/topology expansion.

**Requirements:** R9, R10, R11

**Dependencies:** U1, U2, U3, U4, U5

**Files:**
- Modify: `tests/unit/spec-prd-contracts.test.js`

**Approach:**
- Extend existing tests rather than creating a new large suite unless readability requires it.
- Assert source topology still equals the current 8 source files and 5 references.
- Assert `SKILL.md` remains under existing line/size constraints.
- Assert references include Pre-PRD Clarification trigger/non-trigger, shared understanding map, source-first resolution, question format, write targets, cap, no context artifact, and readiness closure.
- Assert scripts remain advisory and do not decide semantic readiness.

**Test scenarios:**
- Topology: adding `skills/spec-prd/references/requirements-grill.md` fails unless the source topology test is intentionally updated with justification.
- Boundary: `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/` remain forbidden as defaults.
- Ownership: `check-prd-artifact.js` is described as script-owned deterministic facts only; Pre-PRD Clarification remains LLM-owned.
- Handoff: no contract test expects `spec-plan` to run a grill workflow.

**Verification:**
- Focused PRD contract tests fail if the implementation copies the external skill topology or erodes source/runtime boundaries.

---

### U7. Record Validation And Runtime Boundary Evidence

**Goal:** Close the implementation with honest validation evidence, changelog, and fresh-source eval posture.

**Requirements:** R9, R10

**Dependencies:** U1, U2, U3, U4, U5, U6

**Files:**
- Create or modify: `docs/validation/spec-prd/fresh-source-eval-2026-06-22-requirements-grill.md`
- Modify: `CHANGELOG.md`

**Approach:**
- Record fresh-source eval status honestly: `passed` only if a fresh-source reviewer actually evaluates current disk source; otherwise `not_run` with reason.
- Include source refs, runtime paths checked as empty, and generated mirror boundary.
- Update changelog with source surfaces, user-visible behavior, validation commands, and runtime mirror status.

**Test scenarios:**
- Validation artifact uses existing fresh-source eval record conventions when present.
- Changelog latest entry matches timestamped format.
- No validation text claims generated runtime was refreshed unless `spec-first init` actually ran.

**Verification:**
- Changelog and plan/status taxonomy tests pass.
- Git diff check is clean for changed plan/changelog/source files.

---

## System-Wide Impact

- **Public workflow behavior:** `spec-prd` becomes more capable for rough/incomplete PRD refinement because it clarifies shared understanding before writing the final PRD, but remains the same public workflow entrypoint.
- **Artifact contract:** unchanged. Durable PRD output remains `docs/brainstorms/*-requirements.md` with `artifact_kind: prd-requirements`.
- **Downstream planning:** `spec-plan` receives more complete WHAT and less unresolved entropy; it still does not own the pre-PRD clarification loop.
- **Skill packaging:** no new skill package, no new reference file by default, no generated runtime mirror edits.
- **Tests/evals:** focused additions to examples-as-context and contract tests; no new deterministic semantic gate.
- **Documentation:** changelog and optional validation artifact document the behavior. README updates are optional unless implementation changes user-visible command docs beyond `spec-prd` behavior.

Surface coverage:

| Surface | Status | Note |
| --- | --- | --- |
| `spec-prd` workflow | in-scope | Main behavior change |
| PRD artifact topology | in-scope unchanged | Must stay `docs/brainstorms/*-requirements.md` |
| `spec-plan` intake | out-of-scope | No source edit planned unless implementation finds stale handoff wording |
| Generated runtime mirrors | out-of-scope | Do not edit directly |
| External `grill-with-docs` source | out-of-scope | Method input only, not vendored |

---

## Alternative Approaches Considered

| Approach | Decision | Rationale |
| --- | --- | --- |
| Copy `grill-with-docs` into `spec-prd` as an executable node | Rejected | Imports default `CONTEXT.md`/ADR topology, increases public/internal node complexity, and conflicts with bounded PRD authoring. |
| Add a new `requirements-grill` reference file | Defer by default | Cleaner naming, but current tests intentionally keep `spec-prd` to 5 references. Use existing reference first; add a file only if implementation proves prose density becomes harmful and update topology tests deliberately. |
| Put Pre-PRD Clarification into `spec-plan` | Rejected | It would let planning resolve WHAT and duplicate PRD readiness, breaking workflow ownership. |
| Route rough PRDs to `spec-brainstorm` by default | Rejected | The target input is an existing rough PRD for an anchored system increment, not 0-1 product discovery. Escalate only when the draft lacks enough product/system anchor to remain PRD refinement. |
| Add a script to detect rough PRD completeness | Rejected for v1 | Semantic completeness is LLM-owned. Scripts can report structure/trace facts but cannot decide material product gaps. |
| Use a full PRD scorecard or rubric | Rejected | The workflow already uses qualitative `quality_diagnosis`; numeric scoring would invite gaming and false precision. |

---

## Success Metrics

- Rough PRD refine runs establish shared understanding before PRD rewrite: load-bearing claims are tied to source/evidence, gaps, owner questions or assumptions, and PRD write targets.
- Owner questions are fewer but better: each load-bearing question includes a recommended answer and write target.
- `ready-for-planning` is not emitted when actor/flow/acceptance/scope gaps remain unresolved.
- New eval fixtures and contract tests make no-context-artifact and question-cap regressions obvious.
- No new source topology, public entrypoint, runtime mirror edit, numeric scorecard, or standalone critique artifact is introduced.
- Future `spec-plan` artifacts from PRD origins carry fewer inline PRD feedback candidates for missing WHAT.

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Pre-PRD Clarification becomes a long interview | Medium | High | Hard cap normal runs at 1-3 questions; route broader gaps to blockers/doc-review/refine. |
| Pre-PRD Clarification becomes brainstorm replacement | Medium | High | Trigger only for existing rough PRD / anchored system increment; route 0-1 product discovery, unclear audience, or missing product frame back to `spec-brainstorm`. |
| Source topology expands into another reference/template tree | Medium | Medium | Keep first implementation in existing references; contract test topology. |
| Domain Grill and Pre-PRD Clarification terminology confuses maintainers | Medium | Medium | Define clear division by consequence and use a mapping table. |
| Scripts start making semantic readiness decisions | Low | High | Explicit script/LLM boundary in readiness and contract tests. |
| External `grill-with-docs` artifact model leaks into `spec-prd` | Medium | High | Negative tests for `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/` defaults. |
| `SKILL.md` line budget is exceeded | Medium | Medium | Keep orchestrator anchor compact and move details to references. |

---

## Phased Delivery

### Phase 1

- Land U1-U4 together so trigger, shared understanding map, output mapping and readiness closure do not drift.
- Keep changes prose-only plus tests; no scripts or runtime generation.

### Phase 2

- Land U5-U6 fixtures and contract tests.
- Run focused validation and adjust prose only where tests expose ambiguity.

### Phase 3

- Land U7 validation artifact and changelog.
- Optionally run fresh-source eval if the host capability is available and explicitly record status.

---

## Documentation / Operational Notes

- Changelog is required because this changes source docs/plan and future user-visible `spec-prd` behavior.
- README updates are not required by this plan alone; implementation should reconsider if `spec-prd` command docs or examples need to advertise rough PRD refinement.
- Runtime regeneration is not part of this plan. If implementation changes source skill files and runtime drift must be repaired, use `spec-first init` as a separate explicit step rather than hand-editing generated mirrors.
- Plan handoff should recommend `$spec-work` for implementation or a task pack if the implementer wants to split U1-U7.

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
