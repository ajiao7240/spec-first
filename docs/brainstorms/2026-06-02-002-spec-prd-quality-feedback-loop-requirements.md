---
spec_id: 2026-06-02-002-spec-prd-quality-feedback-loop
artifact_kind: prd-requirements
target_surface: workflow
status: ready-for-planning
evidence_grade: mixed
created: 2026-06-02
source_inputs:
  - user-provided external proposal "spec-prd Skill 深度优化技术方案" from the current session
  - skills/spec-prd/SKILL.md
  - skills/spec-prd/references/current-state-analysis.md
  - skills/spec-prd/references/change-topology-lens.md
  - skills/spec-prd/references/prd-readiness-lens.md
  - skills/spec-prd/references/domain-lenses.md
  - skills/spec-prd/evals/examples.json
  - skills/spec-plan/SKILL.md
  - tests/unit/spec-prd-contracts.test.js
  - tests/unit/spec-plan-contracts.test.js
  - docs/brainstorms/2026-06-02-001-refactor-remove-gitnexus-integration-requirements.md
  - docs/10-prompt/结构化项目角色契约.md
  - "external-research 2026-06-02: https://www.atlassian.com/software/confluence/templates/product-requirements"
  - "external-research 2026-06-02: https://www.aha.io/roadmapping/guide/requirements-management/what-is-a-good-product-requirements-document-template"
  - "external-research 2026-06-02: https://airc.nist.gov/AI_RMF_Knowledge_Base/AI_RMF"
  - "external-research 2026-06-02: https://www.microsoft.com/en-us/ai/responsible-ai"
---

# spec-prd 质量闭环优化需求

## Summary

本需求将用户提供的 `spec-prd Skill 深度优化技术方案` 收敛为一个更小、更可维护的 brownfield workflow 增量：增强 `spec-prd` 的质量反馈闭环，而不是把 `spec-prd` 扩展成 PRD 全生命周期管理平台。

目标是解决一类真实失败模式：当输入方案或历史文档包含过期 current-state、过重平台化建议、或把 HOW 当成 WHAT 时，`spec-prd` 应能更早识别并收敛，而下游 `spec-plan` 不应继续替 PRD 发明 WHAT。

本 PRD 的核心交付方向：

1. 让 `spec-plan` 消费 PRD 时显式检查 PRD handoff entropy，发现 topology/source-of-truth/producer-consumer 缺口时反馈给 `spec-prd` refine，而不是自行补全。
2. 给 `spec-prd` 增加最小可复用的 PRD miss feedback loop，用真实漏判案例驱动 eval 和 authoring discipline。
3. 收窄原方案中的 H5/PC、CLI/DevTool、Mixed、AI 产品、项目上下文能力为 conditional lens 和 advisory feedback，不新增平台化 artifact、公开 CLI 或自动语义归纳脚本。

## Problem Frame

用户提供的原方案方向有价值，但存在三类不适合直接进入 planning 的问题：

- 现状基线过期：仍使用 `gitnexus-pointer`、12 项 readiness、`specs/` 目录等旧口径。
- 演化方向过重：把 `spec-prd` 定位为 PRD 生命周期平台，要求新增 `business-context.md`、`convention-profile.md`、changelog/diff CLI、跨 PRD 冲突检测脚本。
- script/LLM 边界不清：让脚本归纳团队规范、判断跨 PRD 冲突、量化语义新鲜度，容易把 advisory facts 当 confirmed truth。

本次增量不否定“上下文质量”“AI 产品 lens”“跨 PRD 协同”这些主题，而是把它们收敛到 `spec-first` 当前架构能承受的最小形态：**现有 artifact 链路内的反馈闭环 + 条件 lens + eval 驱动迭代**。

## Goals / Success Metrics

| Goal | Metric / Target | Baseline | Measurement Window | Evidence |
| --- | --- | --- | --- | --- |
| G1 stale proposal 被校准而不是继承 | 至少 1 个 `spec-prd` eval fixture 或 contract assertion 覆盖 `gitnexus-pointer` / “12 项 readiness” / `specs/` 目录等 stale proposal 输入，并期望输出回到当前 source 口径 | 当前无专门 stale proposal fixture | 本增量验证阶段 | [confirmed-source] `skills/spec-prd/evals/examples.json` |
| G2 `spec-plan` 不再默默发明 load-bearing WHAT | 至少 1 个 `spec-plan` contract assertion 证明 PRD 缺少 load-bearing WHAT 时输出 `revise-prd` / handoff gap，而不是补 topology/source-of-truth/consumer 决策 | 当前 `spec-plan` 已继承 PRD trace，但没有 reciprocal handoff gap assertion | 本增量验证阶段 | [confirmed-source] `skills/spec-plan/SKILL.md` |
| G3 feedback loop 可消费但不成为新真相源 | `spec-plan` 可在 inline closeout / handoff 文本中产出非持久 advisory feedback candidate，且测试或 fixture 证明不会写 PRD、不会生成 feedback 文件/schema/registry | 当前无 PRD miss feedback candidate contract | 本增量验证阶段 | [user-stated] 多 agent doc-review findings |
| G4 防平台化边界可回归 | contract tests 或 text assertions 覆盖不新增 PRD lifecycle CLI、persistent context artifact、cross-workflow feedback collector、standalone template blocker、GitNexus-specific evidence tag | 当前 PRD 已有负向边界，但缺完整测试锚点 | 本增量验证阶段 | [confirmed-source] `docs/10-prompt/结构化项目角色契约.md` |
| G5 AI-enabled product lens 停留在 WHAT 层 | `domain-lenses.md` 增加 AI-enabled product overlay 后，fixture/assertion 覆盖透明度、反馈/升级、人工复核、上线后监控和风险降级，同时明确不默认要求模型/训练/推理方案 | 当前只有通用 WHAT/HOW 原则，无 AI-enabled overlay | 本增量验证阶段 | [external-research] NIST AI RMF / Microsoft Responsible AI, 2026-06-02 |

## Actors / Use Cases

| Actor | Need | Acceptance Signal |
| --- | --- | --- |
| PRD author | 从过期或平台化方案收敛出当前 source 对齐的 PRD，不继承 stale proposal 事实 | `spec-prd` 输出标注 stale proposal correction，并保持 `docs/brainstorms/*-requirements.md` artifact 拓扑 |
| Plan author | 消费 PRD 时能识别“还要发明 WHAT”的缺口，并把缺口退回 PRD refine | `spec-plan` 不复制 `spec-prd` readiness，只做 single handoff entropy check |
| Workflow maintainer | 用最少 source 变更改善 PRD 质量闭环，不新增平台、schema 或长期上下文真相源 | 变更集中在 `skills/spec-prd/**`、`skills/spec-plan/SKILL.md` 和对应 tests/evals |
| Reviewer | 能判断本次增量是否真的防止平台化、HOW 泄漏和 generated runtime 手改 | Negative Acceptance 与 tests 覆盖无 CLI、无 persistent context、无 generated mirror edits |

## Current System Snapshot

| Claim | Evidence |
| --- | --- |
| `spec-prd` 的 durable 输出是 `docs/brainstorms/*-requirements.md`，并使用 `artifact_kind: prd-requirements`，明确不创建 `docs/prds/`。 | [confirmed-source] `skills/spec-prd/SKILL.md` |
| `spec-prd` 当前 evidence tag 是 `confirmed-source`、`user-stated`、`source-candidate`、`external-research`、`assumption`，不是 `gitnexus-pointer`。 | [confirmed-source] `skills/spec-prd/references/current-state-analysis.md` |
| `spec-prd` 已引入 change topology / Framing Gate / Evidence Plan，用于 deletion、migration、workflow/contract/source-of-truth/runtime 等复杂变更。 | [confirmed-source] `skills/spec-prd/references/change-topology-lens.md` |
| `spec-prd` readiness 已包含 19 个 PRD-specific checks，覆盖 topology fit、surface map、producer-consumer closure、source-of-truth clarity、negative acceptance、handoff entropy。 | [confirmed-source] `skills/spec-prd/references/prd-readiness-lens.md` |
| `domain-lenses.md` 已支持 App、H5/PC、Admin、Backend/Java、CLI/DevTool、Mixed lens；标准模板文件只有 generic/App/Admin/Backend，并不等于其他 surface 不可写。 | [confirmed-source] `skills/spec-prd/references/domain-lenses.md` |
| `spec-plan` 已按 `docs/brainstorms/` requirements document 和 `artifact_kind: prd-requirements` 做 intake，并继承 PRD trace。 | [confirmed-source] `skills/spec-plan/SKILL.md` |
| `spec-prd/evals/examples.json` 是 examples-as-context / fixture source，不是自动执行的 runtime state machine；现有 contract tests 主要断言 fixture 内容和 source prose。 | [confirmed-source] `skills/spec-prd/evals/examples.json`, `tests/unit/spec-prd-contracts.test.js` |
| 项目角色契约要求 Light contract、Explicit boundaries、Scripts prepare, LLM decides，脚本不得做架构判断、语义决策或业务优先级判断。 | [confirmed-source] `docs/10-prompt/结构化项目角色契约.md` |
| 用户要求基于原方案收敛输出新的 PRD 文档。 | [user-stated] 当前会话输入 |

## Change Delta

| Surface | Delta Type | Current | Target |
| --- | --- | --- | --- |
| `spec-prd` current-source calibration | extend | 已有 source-first evidence tags 和 topology lens，但没有专门针对 stale proposal 的回归用例 | 增加 stale proposal correction authoring/eval/test 锚点 |
| `spec-plan` PRD intake | extend | 已继承 `artifact_kind: prd-requirements` 的 PRD trace | 增加 single handoff entropy check：若 planning 仍需发明 load-bearing WHAT，则返回 `revise-prd` / handoff gap |
| PRD miss feedback | add, non-durable | 无标准反馈候选 | 仅允许 `spec-plan` 在 inline closeout / handoff 文本中产出 advisory feedback candidate，不新增文件/schema/registry |
| H5/PC、CLI/DevTool、Mixed surface | keep + clarify | `domain-lenses.md` 已有这些 lens；缺 standalone template 不应阻塞 | 只补 no-template-blocker guardrail 和最小 eval/contract assertion，不重写现有 lens，不新增 standalone templates |
| AI-enabled product lens | add | 只有通用 WHAT/HOW 原则，无 AI-specific overlay | 增加 WHAT-level AI-enabled overlay，覆盖透明度、反馈、人工复核、安全/合规、上线后监控和风险降级 |
| Persistent context / lifecycle platform | keep out | 原方案建议新增 `business-context.md`、`convention-profile.md`、changelog/diff CLI、跨 PRD 冲突检测 | 本增量明确不做；未来若需要另立 PRD 和 artifact contract |
| Generated runtime mirrors | keep | `.claude/`、`.codex/`、`.agents/skills/` 由 source 生成 | 不手改；如需刷新走 `spec-first init` |

## Change Topology

Primary topology: `extend`

Secondary topology: `workflow-change`

Why this topology matters:

- 这不是新增 `spec-prd` 入口，也不是替换现有 artifact 拓扑。
- 这会扩展 `spec-prd` 与 `spec-plan` 的 handoff 行为，属于 workflow 协同增强。
- 这会新增或调整 eval、readiness wording、plan intake wording 等 source assets，需要保持 source/runtime 边界。
- 若实现时引入新的 CLI、schema、长期 profile、自动冲突检测平台，就会从 `extend` 漂移为 `contract-change` 或平台化重构，必须另立 PRD。

## Surface Map

| Surface | Current Behavior | Delta | Consumer | Evidence |
| --- | --- | --- | --- | --- |
| `skills/spec-prd/SKILL.md` | 负责 create/refine/validate brownfield PRD，Phase 4 运行 readiness 后 handoff。 | 增加对“下游发现 PRD miss 后如何回流”的 authoring discipline；强调过期方案必须先校准 current source。 | `spec-plan`、`spec-doc-review`、产品 owner | [confirmed-source] `skills/spec-prd/SKILL.md` |
| `skills/spec-prd/references/prd-readiness-lens.md` | 检查 19 项 PRD readiness，并做 handoff entropy check。 | 保持 19 项为主，不新增重 schema；可补“proposal staleness / PRD miss feedback”相关措辞或 eval trace。 | `spec-prd` orchestrator、`spec-plan` | [confirmed-source] `skills/spec-prd/references/prd-readiness-lens.md` |
| `skills/spec-prd/references/domain-lenses.md` | 提供 App、H5/PC、Admin、Backend/Java、CLI/DevTool、Mixed lens。 | 保持 H5/PC、CLI/DevTool、Mixed 现有 lens；新增 AI-enabled product overlay；补 no-template-blocker guardrail。 | `spec-prd` drafting | [confirmed-source] `skills/spec-prd/references/domain-lenses.md` |
| `skills/spec-prd/evals/examples.json` | 存放 spec-prd examples-as-context。 | 新增少量回归 fixture，覆盖 stale proposal、platform creep、inline feedback no-mutation，以及条件 AI/no-template blocker case。 | skill 维护者、fresh-source eval | [confirmed-source] `skills/spec-prd/evals/examples.json` |
| `skills/spec-plan/SKILL.md` | 消费 `artifact_kind: prd-requirements` 进入 planning。 | 增加 single handoff entropy check；不复制 `spec-prd` readiness，不新增第二套 gate。 | `spec-plan` users、implementation plan readers | [confirmed-source] `skills/spec-plan/SKILL.md` |
| `docs/contracts/domain-glossary.md` and project-local overlays | 术语 glossary 可选，存在时作为 canonical domain language source。 | 本增量不新增 `business-context.md` 或 `convention-profile.md`；未来 persistent context 必须另立 artifact contract。 | `spec-prd`、product owner | [confirmed-source] `skills/spec-prd/SKILL.md` |
| Generated runtime mirrors | `.claude/`、`.codex/`、`.agents/skills/` 由 generator 生成。 | 本 PRD 不允许手改 runtime mirror；source 变更后由 `spec-first init` 刷新。 | Claude/Codex hosts | [confirmed-source] `docs/10-prompt/结构化项目角色契约.md` |

## Producer / Artifact / Consumer Closure

| Producer | Artifact / Path | Authority / Freshness | Consumers | Change Effect |
| --- | --- | --- | --- | --- |
| `spec-plan` orchestrator | Inline `PRD feedback candidate` block in plan closeout or handoff text only | advisory, session-local, non-durable unless a human copies it into a PRD refine request | PRD author, `spec-prd` refine run, skill maintainer adding eval fixtures | Identifies missing WHAT without mutating PRD or creating a new feedback registry |
| `spec-prd` maintainer | `skills/spec-prd/evals/examples.json` and focused contract tests | source fixture / test evidence, not runtime truth | future `spec-prd` edits and fresh-source eval reviewers | Provides regression examples for stale proposal and platform creep |
| `spec-plan` maintainer | `skills/spec-plan/SKILL.md` and `tests/unit/spec-plan-contracts.test.js` | source / deterministic test evidence | plan workflow and downstream implementation plans | Adds the reciprocal handoff check without duplicating PRD readiness |

## Source-Of-Truth Resolution

| Item | Current Source-Of-Truth | Target Source-Of-Truth | Generated Mirrors / Non-Authoritative Refs | Conflict Rule |
| --- | --- | --- | --- | --- |
| `spec-prd` workflow behavior | `skills/spec-prd/**` | unchanged | `.claude/`、`.codex/`、`.agents/skills/` runtime mirrors | source wins; do not hand-edit runtime |
| PRD artifact path | `docs/brainstorms/*-requirements.md` | unchanged | proposal references to `specs/` or lifecycle platform paths | current source wins |
| Evidence tags | `skills/spec-prd/references/current-state-analysis.md` | unchanged | old proposal `gitnexus-pointer` wording | current source wins |
| Readiness dimensions | `skills/spec-prd/references/prd-readiness-lens.md` | unchanged plus possible wording/eval refinements | old proposal “12 checks” claim | current source wins |
| Persistent business/team context | none in v1 except optional glossary/project-local overlays | unchanged for this increment | proposed `business-context.md` and `convention-profile.md` | out of scope unless future PRD defines contract |
| External proposal | session input only | advisory input only | absolute local path from user environment | never durable source-of-truth |

## Implementation Candidate Boundaries

Candidate source files for planning:

- `skills/spec-prd/SKILL.md` — stale proposal calibration and handoff wording only if needed.
- `skills/spec-prd/references/prd-readiness-lens.md` — wording/eval trace only; do not add a second evidence enum or heavy schema.
- `skills/spec-prd/references/domain-lenses.md` — add AI-enabled product overlay and no-template-blocker guardrail.
- `skills/spec-prd/evals/examples.json` — add examples-as-context fixtures.
- `skills/spec-plan/SKILL.md` — add the single PRD handoff entropy check near PRD intake/final origin review.
- `tests/unit/spec-prd-contracts.test.js` and `tests/unit/spec-plan-contracts.test.js` — focused contract assertions.

Explicit non-targets:

- `src/cli/**`, `bin/**`, public command templates, or new CLI flags.
- New files for `business-context.md`, `convention-profile.md`, feedback registry, feedback schema, PRD diff, PRD changelog, or cross-PRD conflict detection.
- Standalone H5/PC、CLI/DevTool、Mixed templates.
- Generated runtime mirrors `.claude/**`、`.codex/**`、`.agents/skills/**`.

## Requirements

### R1 Current-Source Calibration [P0, blocking]

`spec-prd` optimization work must start from current checked-in source, not from generated runtime mirrors, old proposal prose, or external local files.

Acceptance:

- The workflow must not preserve stale claims such as `gitnexus-pointer`, “12 项 readiness”, `specs/` PRD directory, or “H5/PC/CLI/Mixed cannot work without standalone templates”.
- If a proposal conflicts with source, final PRD/refine output must record the correction as `confirmed-source` versus advisory input.

### R2 PRD-To-Plan Reciprocal Handoff Gate [P0, blocking]

When `spec-plan` consumes a PRD-grade requirements artifact, it must run one lightweight handoff entropy check: **would the plan need to invent a load-bearing WHAT decision that the PRD should own?**

Acceptance:

- The check may look at the PRD's own readiness summary, Change Topology, Surface Map, Source-Of-Truth Resolution, Negative Acceptance, and Outstanding Questions, but must not copy the full `spec-prd` readiness lens into `spec-plan`.
- If load-bearing WHAT is missing, `spec-plan` must return a visible `revise-prd` / handoff gap instead of silently deciding it.
- `accepted assumption` is allowed only when the owner/user explicitly accepts the risk, or when the assumption is non-load-bearing implementation planning detail. `spec-plan` must not create product WHAT assumptions by itself and continue.
- The gate must stay lightweight prose/checklist behavior, not a new centralized state machine or second PRD readiness gate.

### R3 PRD Miss Feedback Candidate [P0, blocking]

`spec-plan` may produce a compact inline advisory feedback candidate when it discovers a PRD quality gap that would force invention or re-interpretation.

Acceptance:

- The feedback candidate lives only in plan closeout / handoff text. It is not a new file, schema, registry, report, or durable artifact.
- Required fields: `prd_path`, `missing_what_decision`, `origin_requirement_or_acceptance_id` when available, `suggested_refine_target`, and `authority=advisory`.
- The note must not mutate PRD files automatically.
- Feedback must be suitable for a human to pass into a future `spec-prd` refine run or for a maintainer to convert into an eval fixture.
- Other downstream workflows (`spec-work`, `spec-doc-review`, `spec-code-review`, etc.) are out of scope for this increment unless a future PRD defines their producer/consumer contract.

### R4 Eval-Driven spec-prd Improvement [P0 core, P1 conditional]

Add focused examples-as-context and contract assertions for the failures surfaced by the reviewed proposal and the GitNexus removal PRD experience.

Required core fixtures/assertions:

- stale proposal current-state correction;
- platform creep rejection;
- `spec-plan` inline feedback candidate does not auto-mutate PRD or create a new artifact.

Conditional fixtures/assertions when affected source prose is changed:

- AI product WHAT/HOW boundary;
- H5/PC, CLI/DevTool, and Mixed support via lens rather than mandatory standalone templates.

Verification boundary:

- `skills/spec-prd/evals/examples.json` is examples-as-context, not a runtime state machine.
- Contract tests may assert fixture content and source prose.
- Fresh-source eval may be run as additional semantic validation, but if it is not run, implementation must not claim it passed.

### R5 Existing Surface Lens Guardrail [P1, conditional]

`spec-prd` must make clear that existing H5/PC、CLI/DevTool、Mixed lens support is usable without standalone templates.

Acceptance:

- Do not rewrite H5/PC、CLI/DevTool、Mixed question lists unless a concrete missed PRD case proves a specific gap.
- Add or strengthen wording that generic skeleton + surface lens is sufficient for these surfaces.
- Missing standalone templates for these surfaces are not readiness blockers.
- Standalone templates for these surfaces are optional future work and require a separate PRD or owner-confirmed scope.

### R6 AI-Enabled Product Lens Boundary [P1, conditional]

Add an AI-enabled product lens only as a WHAT-level product overlay.

Acceptance:

- In scope: user-visible AI value, quality acceptance, uncertainty handling, fallback/degradation, human review, content safety, data/compliance boundaries, measurable outcome口径, AI involvement transparency, user feedback/appeal path, human escalation triggers, post-launch quality/safety monitoring signals, and risk-based degrade/disable conditions.
- Out of scope: mandatory model selection, fine-tuning strategy, inference architecture, dataset size estimation, offline metric prescription, model training implementation details.
- Implementation details may appear only when the product owner states them as explicit `user-stated` acceptance boundaries or negative boundaries.
- `measurable outcome口径` must not be interpreted as mandatory offline ML metrics; observable product behavior and safety outcomes are acceptable when model metrics are not confirmed.

### R7 Project Context Without New Platform Artifacts [P0, blocking]

This increment must not introduce `business-context.md`, `convention-profile.md`, `--init-context`, or `--update-conventions`.

Acceptance:

- Existing optional `docs/contracts/domain-glossary.md` and project-local overlay reading remain the right extension point.
- If persistent business/team context is needed later, it must be specified in a separate PRD with artifact path, producer, consumer, freshness, authority level, update workflow, and preview-first write boundary.
- No script may infer team convention and silently make it authoritative.
- This increment must not add overlay discovery paths, overlay indexes, context summary artifacts, team convention scanners, or any mechanism that promotes project-local overlay conclusions to `confirmed-source` without direct source/owner evidence.
- Existing local overlay reads remain advisory/source-tagged and scoped to the current PRD run.

### R8 Evidence Freshness Without Provider Coupling [P0, blocking]

Evidence freshness handling must stay provider-neutral and aligned to existing tags.

Acceptance:

- Do not add `gitnexus-pointer` or GitNexus-specific timestamp syntax.
- `source-candidate` remains a pointer, never confirmed truth.
- External research must include date/source when used.
- Confirmed current-state claims must come from direct source/docs/tests/contracts or deterministic command output.

### R9 No PRD Lifecycle Platform In This Increment [P0, blocking]

This increment must not turn `spec-prd` into a PRD lifecycle management platform.

Explicitly out of scope:

- PRD version bump automation;
- PRD changelog arrays in frontmatter;
- PRD diff CLI;
- cross-PRD conflict detection engine;
- PRD aggregation/hub;
- `docs/prds/` or `specs/` artifact topology;
- public CLI commands for PRD context/lifecycle operations.

### R10 Tests, Docs, Changelog, And Runtime Boundary [P0, blocking]

Implementation must update only source assets needed for the above behavior and must include focused verification.

Acceptance:

- Update `skills/spec-prd/**` and `skills/spec-plan/**` only where needed.
- Update focused tests/evals for changed behavior.
- Update `CHANGELOG.md`.
- Do not hand-edit `.claude/`、`.codex/`、`.agents/skills/`.
- If runtime mirror refresh is needed after source changes, use `spec-first init` and record it separately.

## Priority / Release Boundary

| Requirement | Priority | Release Boundary |
| --- | --- | --- |
| R1 Current-Source Calibration | P0 | Blocks this increment; stale proposal facts must not survive into PRD/refine behavior. |
| R2 PRD-To-Plan Reciprocal Handoff Gate | P0 | Blocks this increment; `spec-plan` must have one handoff entropy check, but must not duplicate PRD readiness. |
| R3 PRD Miss Feedback Candidate | P0 | Blocks this increment; limited to `spec-plan` inline advisory candidate only. |
| R4 Eval-Driven spec-prd Improvement | P0 core / P1 conditional | Core stale/platform/feedback fixtures block this increment; AI/no-template fixtures are required only when related prose changes land. |
| R5 Existing Surface Lens Guardrail | P1 | Can ship as wording/test guardrail; standalone templates are explicitly future work. |
| R6 AI-Enabled Product Lens Boundary | P1 | Can ship as one conditional overlay row plus focused tests; no model implementation detail required. |
| R7 Project Context Without New Platform Artifacts | P0 | Blocks this increment; no persistent context, overlay index, or convention inference may be introduced. |
| R8 Evidence Freshness Without Provider Coupling | P0 | Blocks this increment; no provider-specific evidence tag returns. |
| R9 No PRD Lifecycle Platform In This Increment | P0 | Blocks this increment; no lifecycle CLI/schema/platform work. |
| R10 Tests, Docs, Changelog, And Runtime Boundary | P0 | Blocks this increment; source changes need focused tests/evals/changelog and no generated mirror edits. |

## Acceptance Examples

### AE1 Stale Proposal Calibration

Given a user provides a proposal claiming `spec-prd` uses `gitnexus-pointer` and 12 readiness checks  
When `spec-prd` refines the proposal into a PRD  
Then the output cites current source tags and 19 readiness checks  
And the stale proposal claims are recorded as corrected advisory input, not preserved requirements.

### AE2 Plan Does Not Invent Topology

Given a PRD changes workflow handoff but lacks affected consumers and source-of-truth boundaries  
When `spec-plan` attempts to create an implementation plan  
Then it reports a PRD handoff gap or asks for PRD refine  
And it does not silently decide the missing consumers or artifact authority  
And it does not copy the full `spec-prd` readiness lens into `spec-plan`.

### AE3 Advisory Feedback, No Auto-Mutation

Given `spec-plan` discovers that a requirement cannot be planned without inventing a missing acceptance boundary  
When it closes the plan or routes back  
Then it may emit an inline, non-durable PRD feedback candidate in the closeout / handoff text  
And it must not create a feedback file, schema, registry, or edit the PRD automatically.

### AE4 AI Lens Stays WHAT-Level

Given a user asks for a PRD for an AI recommendation feature  
When `spec-prd` applies the AI-enabled product lens  
Then it captures user-visible quality, AI involvement transparency, feedback/appeal path, fallback, human review/escalation, safety, data/compliance boundaries, and post-launch monitoring signals  
And it does not require a model choice, fine-tuning plan, or inference architecture unless the owner states those as product constraints.

### AE5 CLI Surface Is Not Blocked By Missing Template

Given a user asks for a CLI/DevTool PRD  
When no standalone CLI template exists  
Then `spec-prd` can still use the generic skeleton plus CLI/DevTool lens  
And the absence of a standalone template is not treated as a readiness blocker  
And implementation does not add standalone templates just to satisfy this PRD.

### AE6 Optional Project Context

Given a project has no `business-context.md` or `convention-profile.md`  
When `spec-prd` drafts a PRD  
Then their absence is not a gap.  

Given a project has a relevant local glossary or team overlay  
When `spec-prd` uses it  
Then it cites the source and treats semantic conclusions as LLM/owner judgment, not script-owned truth.

### AE7 No New Public CLI

Given the implementation finishes  
When users inspect public entrypoints  
Then no new `spec-prd --init-context`、`--update-conventions`、`--changelog`、`--diff` command exists as part of this increment.

### AE8 Runtime Mirrors Remain Generated

Given source assets are updated  
When runtime mirrors need refresh  
Then the implementation uses the existing generation path  
And does not hand-edit generated runtime files.

### AE9 Eval Boundary Is Honest

Given implementation adds `spec-prd` examples  
When verification is reported  
Then examples-as-context and contract assertions may be reported as checked  
And fresh-source eval may be reported only if it was actually run.

### AE10 Owner-Accepted Assumption Boundary

Given `spec-plan` finds a load-bearing WHAT gap  
When no owner/user has explicitly accepted a product assumption  
Then `spec-plan` must route to `revise-prd` / handoff gap  
And it must not continue by inventing an `accepted assumption`.

## Scope Boundaries

In scope:

- `spec-prd` authoring/readiness wording needed to prevent stale-proposal and platform-creep failures.
- `spec-plan` intake/handoff wording needed to route load-bearing PRD entropy gaps back to refine.
- `spec-plan` inline, non-durable advisory PRD feedback candidate.
- `spec-prd` examples-as-context and contract assertions for the failure modes above.
- No-template-blocker clarification for H5/PC、CLI/DevTool、Mixed.
- AI-enabled product WHAT-level lens clarification.
- Focused tests or fresh-source eval updates that prove the behavior.

Out of scope:

- New public workflow or CLI command.
- New persistent business/team context files.
- PRD lifecycle versioning platform.
- Cross-PRD semantic conflict detector.
- Automatic PRD mutation from plan/review/work.
- Cross-workflow feedback collector or durable feedback schema.
- Overlay discovery path, overlay index, context summary artifact, or convention scanner.
- Standalone H5/PC、CLI/DevTool、Mixed templates.
- GitNexus-specific evidence semantics.
- Generated runtime mirror edits.

## Negative Acceptance

```text
NA-01
Given this PRD is implemented
When spec-prd writes future PRDs
Then it must not create docs/prds/ or specs/ as a second PRD artifact topology.
```

```text
NA-02
Given downstream workflows detect PRD gaps
When they report feedback
Then they must not silently rewrite the PRD or make semantic conflict decisions by script.
```

```text
NA-03
Given a proposal contains stale provider-specific wording
When spec-prd refines it
Then GitNexus-specific evidence tags must not be reintroduced.
```

```text
NA-04
Given a future AI product PRD is drafted
When AI-specific questions are asked
Then spec-prd must not force model implementation decisions into PRD unless they are explicit product constraints.
```

```text
NA-05
Given H5/PC, CLI/DevTool, or Mixed surface is requested
When no standalone template exists
Then the workflow must not block solely because only a lens exists.
```

```text
NA-06
Given a team wants persistent business context or convention profiles
When this increment is implemented
Then those artifacts must remain out of scope until a separate PRD defines source-of-truth, producer, freshness, consumer, and preview-first rules.
```

```text
NA-07
Given spec-plan consumes a PRD-grade requirements artifact
When the reciprocal handoff check runs
Then spec-plan must not duplicate the full spec-prd readiness lens or become a second PRD readiness gate.
```

```text
NA-08
Given spec-plan emits a PRD feedback candidate
When the workflow completes
Then no feedback file, JSON schema, registry, durable report, or automatic PRD edit may be created.
```

```text
NA-09
Given project-local overlays exist
When this increment is implemented
Then no new overlay discovery/index/summary artifact or team convention inference mechanism may be added.
```

```text
NA-10
Given spec-prd examples are added
When verification is reported
Then examples-as-context must not be described as an executed eval pass unless a fresh-source eval actually ran.
```

## Evidence And Assumptions

| Item | Tag | Notes |
| --- | --- | --- |
| Current `spec-prd` artifact path and workflow contract | confirmed-source | `skills/spec-prd/SKILL.md` |
| Current evidence tags | confirmed-source | `skills/spec-prd/references/current-state-analysis.md` |
| Current topology/readiness behavior | confirmed-source | `skills/spec-prd/references/change-topology-lens.md` and `skills/spec-prd/references/prd-readiness-lens.md` |
| Existing surface lens coverage | confirmed-source | `skills/spec-prd/references/domain-lenses.md` |
| Existing examples-as-context fixtures | confirmed-source | `skills/spec-prd/evals/examples.json` |
| GitNexus removal PRD failure mode | confirmed-source | `docs/brainstorms/2026-06-02-001-refactor-remove-gitnexus-integration-requirements.md` |
| PRD template / goals / scope best-practice calibration | external-research | Atlassian PRD template and Aha PRD template guide, read 2026-06-02 |
| AI product risk / responsible AI calibration | external-research | NIST AI RMF and Microsoft Responsible AI, read 2026-06-02 |
| Light contract and script/LLM boundary | confirmed-source | `docs/10-prompt/结构化项目角色契约.md` |
| Original optimization proposal | user-stated | User-provided session input; useful as advisory material, not source-of-truth |
| Need for durable PRD document | user-stated | User explicitly requested a new converged PRD document |
| Exact source hunks to edit | source-candidate | Candidate files are bounded in `Implementation Candidate Boundaries`; implementation phase still chooses minimal hunks |

## Decision Notes

- D1: Do not implement the original proposal as written. It is rejected as too platform-heavy and current-state stale.
- D2: Keep `spec-prd` as a brownfield PRD-grade requirements workflow, not a lifecycle management platform.
- D3: Use eval and handoff feedback as the durable improvement mechanism.
- D4: Treat missing standalone H5/PC、CLI/DevTool、Mixed templates as a possible UX improvement, not a P0 correctness blocker.
- D5: Treat AI product support as a conditional WHAT-level lens, not an implementation template.
- D6: Any future persistent context system requires a separate PRD because it introduces new artifact authority and freshness concerns.
- D7: Limit the first PRD feedback producer to `spec-plan`; other workflow producers require a separate contract decision.
- D8: Treat `skills/spec-prd/evals/examples.json` as examples-as-context plus contract-test input, not as an executed eval runner.

## Implementation Verification

The implementation plan should include focused checks for:

- stale proposal claims are rejected in `spec-prd` evals;
- `spec-plan` intake can identify PRD handoff gaps without inventing WHAT or duplicating `spec-prd` readiness;
- `spec-plan` PRD feedback candidate is inline, non-durable, advisory, and does not mutate PRD files;
- H5/PC、CLI/DevTool、Mixed surfaces are not blocked by missing standalone templates;
- AI-enabled product lens stays at WHAT level and includes transparency, feedback/escalation, monitoring, and risk degrade/disable boundaries;
- examples-as-context / contract assertions are not reported as executed fresh-source eval unless fresh-source eval actually ran;
- no references to `gitnexus-pointer` are introduced;
- no `docs/prds/` or `specs/` PRD output path is introduced;
- no new public PRD lifecycle CLI command is introduced;
- no overlay index/discovery/context-summary artifact or convention scanner is introduced;
- generated runtime mirrors remain untouched unless regenerated through the official init path.

## Outstanding Questions

None for planning. The implementation plan may choose the smallest edit hunks inside the bounded candidate files listed above, but must not expand the consumer set, artifact topology, or workflow producer set without a new PRD.

## Readiness Summary

- Outcome: `ready-for-planning`
- Included sections: Summary, Problem Frame, Goals / Success Metrics, Actors / Use Cases, Current System Snapshot, Change Delta, Change Topology, Surface Map, Producer / Artifact / Consumer Closure, Source-Of-Truth Resolution, Implementation Candidate Boundaries, Requirements, Acceptance Examples, Scope Boundaries, Negative Acceptance, Evidence And Assumptions, Decision Notes, Implementation Verification, Outstanding Questions
- Requirement count: 10
- Acceptance example count: 10
- Priority distribution: R1/R2/R3/R7/R8/R9/R10 are P0 blocking; R4 core is P0 and conditional fixtures are P1; R5/R6 are P1 conditional lens guardrails
- NFR count: 4 implicit workflow NFRs: no automatic PRD mutation, no durable feedback artifact, low context/source churn, generated runtime not hand-edited
- Assumption count: 1 source-candidate implementation detail
- Outstanding question count: 0
- Trace gaps: exact edit hunks remain implementation detail, but candidate files and non-targets are bounded
- Handoff entropy: planning should not need to decide whether to build PRD lifecycle platform, persistent context files, cross-PRD conflict detection, standalone surface templates, cross-workflow feedback artifacts, or full PRD readiness duplication in `spec-plan`
