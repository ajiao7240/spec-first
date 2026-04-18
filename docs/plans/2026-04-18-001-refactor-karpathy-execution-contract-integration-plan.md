---
title: refactor: Integrate Karpathy execution contract into core workflows
type: refactor
status: active
date: 2026-04-18
---

# refactor: Integrate Karpathy execution contract into core workflows

## Overview

把基于 Karpathy 四原则的横切执行 contract 嵌入 `spec-first` 主干 workflow，目标是减少静默假设、过度设计、越界改动和缺少可验证完成信号这四类高成本失误。实现方式不是新增一个并列 workflow 或 standalone governance layer，而是在现有 `spec-plan`、`spec-brainstorm`、`spec-work`、`spec-review`、`lfg` 内增加一组轻量但明确的行为约束。

## Problem Frame

当前 `spec-first` 已经在路由、研究、阶段化 handoff 和验证闭环上做得很强，但 Karpathy 方法论指向的几类问题仍主要依赖隐性工程判断，而不是显式 contract：

- `spec-work` 缺少一个统一的“最小可行变更 + 变更边界 + 完成信号”前置检查，容易让执行期在已有强流程下继续扩散到无关改动。
- `spec-review` 目前更擅长 correctness / testing / maintainability 等常规 review 维度，但对 speculative complexity、orthogonal edits、assumption leak 这类 agent 特有反模式还没有稳定的 synthesis 路由。
- `spec-plan` 和 `spec-brainstorm` 已经在多处强调 assumptions、YAGNI 与 right-sized artifact，但没有把 “explicit assumptions / simpler viable approach / change boundary” 抽成稳定的 plan-facing 结构。
- `lfg` 串起了 `plan -> work -> review` 的执行链，但目前没有把上述行为 contract 作为一条流水线级继承规则表达出来。

这次改造的目标不是提升产品面复杂度，而是把这些已经隐含存在的工程标准变成更可验证、可复用、可 review 的 prompt contract。

## Requirements Trace

- R1. 在不新增用户可见 workflow、slash command 或 `$spec-*` 入口的前提下，把 Karpathy 方法论嵌入核心 workflow。
- R2. 保持 `using-spec-first` 继续只负责 workflow entry / routing，不把它膨胀成新的执行治理层。
- R3. 强化 `spec-work`，让执行前必须显式确认 assumptions、simplest viable change、change boundary、verification signal。
- R4. 强化 `spec-review`，让 speculative complexity、orthogonal edits、assumption leak 能进入 finding/synthesis 体系，而不是只靠 reviewer 的隐性判断。
- R5. 强化 `spec-plan` 与 `spec-brainstorm`，让 assumptions、simpler alternative、boundary discipline 在 durable artifact 中更明确。
- R6. 保持 `lfg` 只做轻量继承，不新增新阶段，不改变 ordered pipeline。
- R7. 所有修改只落在 source-of-truth 与受管 mirror；不得直接编辑 `.agents/skills/`、`.claude/spec-first/workflows/` 等 runtime artifact。
- R8. 对所有受影响 workflow 的 contract tests、必要的 smoke / integration 守卫、`CHANGELOG.md`，以及显著 workflow 变更所需的发布文档同步给出明确落点。

## Scope Boundaries

- 不新增名为 `karpathy-*` 的新 workflow、slash command 或 command-backed skill。
- 不修改 `skills-governance.json`、dual-host governance contract、宿主入口命名规则或 `using-spec-first` 的 `entry_surface / host_scope / host_delivery`。
- 不把 `spec-optimize` 机械纳入“最小代码改动”约束；它的实验循环有不同目标函数。
- 不把 `using-spec-first` 改造成第二层执行 contract；它继续是 routing layer。
- 不直接编辑 runtime artifact 或 generated assets；只改 `skills/`、`docs/10-prompt/skills/`、引用 reference、tests 和必要文档。
- 本次不把 `spec-work-beta` 纳入 contract 注入范围：它是独立的 beta 实验线，有自己的 contract test (`tests/unit/spec-work-beta-contracts.test.js`)，其行为差异需要单独评估才能判断哪些 Karpathy contract 可以迁移过去。

### Deferred to Separate Tasks

- 如果后续证明 `spec-review` 需要新增专门 persona（例如 `change-discipline-reviewer`），作为后续迭代单独立项；本次优先走 synthesis rule 增强。
- 如果后续需要把这套 contract 抽成单独共享 skill，再单开设计；本次先验证嵌入式方案。
- `spec-work-beta` 是否继承本次 contract（全部 / 部分 / 不继承）作为后续独立任务评估；在该评估完成前，beta 线按现状保留，不做隐性同步。

## Context & Research

### Relevant Code and Patterns

- `skills/spec-work/SKILL.md`
- `skills/spec-review/SKILL.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-brainstorm/SKILL.md`
- `skills/lfg/SKILL.md`
- `skills/spec-review/references/findings-schema.json`
- `skills/spec-review/references/review-output-template.md`
- `docs/10-prompt/skills/spec-work/SKILL.md`
- `docs/10-prompt/skills/spec-review/SKILL.md`
- `docs/10-prompt/skills/spec-plan/SKILL.md`
- `docs/10-prompt/skills/spec-brainstorm/SKILL.md`
- `docs/10-prompt/skills/lfg/SKILL.md`
- `tests/unit/spec-work-contracts.test.js`
- `tests/unit/spec-review-contracts.test.js`
- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/spec-brainstorm-contracts.test.js`
- `tests/unit/lfg-contracts.test.js`

### Institutional Learnings

- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`
  这次改造涉及 workflow skill 真源、docs mirror、runtime artifact 三层；必须只修改 source-of-truth，避免把 runtime 副本误当源头修补。

### External References

- 无需额外 external research。该改造是 repo-internal prompt contract 调整，现有本地模式、测试和近期设计文档已足够提供强 grounding。

## Key Technical Decisions

- 不新增新 skill，直接把 Karpathy 方法论作为横切 contract 注入现有 workflow。
  理由：当前缺口不在“找不到入口”，而在“进入流程后执行姿势不够统一”。

- `spec-work` 是第一优先级，`spec-review` 是第二优先级，`spec-plan`/`spec-brainstorm`/`lfg` 是补强层。
  理由：最昂贵的失误首先发生在实施 diff 和 review 路由阶段。

- `spec-review` 先增强 reviewer-side signal generation 与 synthesis 规则，不先新增 persona，也不修改 reviewer 真源。
  理由：多数 ROI 来自把 change-discipline 问题稳定产出并升级为显式 finding；先用模板级 contract + merge/synthesis 收口，可以用最小成本验证价值，同时避免过早扩大到 reviewer taxonomy 改造。

- `spec-review` 本次不改 reviewer team 结构，也不新增 persona；change-discipline 由模板级 contract 要求**所有 reviewer 在分析阶段显式考虑三个维度（orthogonal edits / speculative complexity / assumption leak），有问题时作为 finding 输出，无问题时不需要为每个维度返回专门的空占位**——沿用现有单一 `findings` 数组 + `residual_risks` + `testing_gaps` 的 schema，不引入 per-dimension 分组。不对具体 reviewer ownership 做强承诺。
  理由：当前目标是最小闭环，不是重做 reviewer taxonomy，也不是扩 schema。"显式考虑" 保证信号不再藏进 maintainability 泛化评论或 residual_risks；允许无问题时静默避免 noisy 空结构。只有当模板级 contract 无法稳定产出信号时，才再升级到 schema 扩展或 reviewer 真源调整。

- 本次改造明确归类为 significant workflow contract update。
  理由：它横跨 `spec-plan`、`spec-brainstorm`、`spec-work`、`spec-review`、`lfg` 五条主干 workflow，不是局部文案修订。

- 每个受影响 workflow 的 docs mirror 与 contract tests 在同一实现单元内同步。
  理由：降低 source 与 mirror 漂移风险，避免 prompt contract 修改只停留在单一层。

- `using-spec-first` 只保留 routing 角色。
  理由：其边界已经很清晰，若把执行 contract 塞进去，会混淆 route layer 与 behavior layer。

## Alternative Approaches Considered

- 新建 standalone skill，例如 `karpathy-execution-guidelines`
  未选。这样会增加一个新的用户可见概念，且不能保证主干 workflow 默认继承，容易退化成“知道的人会用”的附加规范。

- 只在 `spec-review` 新增一个 reviewer persona
  未选。这样只能在事后兜底，不能前移到 planning / work 阶段阻断失误。

- 只改 `using-spec-first`
  未选。`using-spec-first` 的职责是 workflow entry / routing；把执行治理塞进去会破坏既有边界。

## Observational Goals

本次改造的验收不绑定量化 threshold，而是通过 contract tests + docs mirror 一致性 + smoke 守卫闭环（见 Unit 5）完成。以下指标仅作为**后续观察项**，用于判断 Karpathy contract 是否在真实使用中产生预期效果；它们不构成合入门槛，也不在本计划的 Implementation Units 中建立测量基础设施。

> Non-gating — 本节不对本次改造设置量化验收阈值。任何硬性 target threshold / acceptance rule 如需建立，须作为独立任务单独立项，包括基线采集、样本口径、测量责任人与时点。

### Candidate Observation Signals

- `unplanned_change_ratio`：实际修改文件中，不在 plan 预期范围或实现单元边界内的文件占比。
- `why_did_you_change_this_comment_rate`：review 中出现"这块为什么也改了""这个和当前任务有什么关系"类评论的任务占比。
- `review_rounds_per_task`：一个任务从第一次完整 review 到通过 review 的轮数。
- `change_discipline_finding_rate`：review 中显式出现 orthogonal edits / speculative complexity / assumption leak finding 的任务占比。
- `maintainability_noise_rate`：change-discipline 或 maintainability finding 中被认定为低价值、误报或不值得进入正式 finding 的比例。
- `merge_readiness_rate`：第一次完整 review 后即可 merge 或只需轻量修复即可 merge 的任务占比。
- `assumption_explicitness_rate`：执行前是否显式写出 assumptions、change boundary、verification signal。
- `verification_defined_rate`：plan 或 execution preflight 中是否存在明确的 done/not-done completion signal。

### Observation Guidance

- `change_discipline_finding_rate` 在改造初期允许上升，因为系统开始显式识别过去未被结构化报告的问题；长期看应与 `unplanned_change_ratio` 的下降一起收敛。
- 若后续需要把这些信号收敛为硬性验收门槛，请在独立任务中完成基线采集（改造前后各 10-20 样本）、人工判读口径统一、owner 与采样时点指定，再定义阈值。本计划不承担该基础设施建设。

## Open Questions

### Resolved During Planning

- 是否需要新增一个 command-backed workflow？
  不需要。本次是横切 contract 集成，不是产品面扩展。

- 是否需要修改双宿主治理 contract？
  不需要。本次没有新增用户可见入口，也不改变 skill host delivery。

- docs mirror 是否必须同步？
  需要。当前 `spec-work`、`spec-review`、`spec-plan`、`spec-brainstorm`、`lfg` 都存在 `docs/10-prompt/skills/` mirror。

- `spec-review` 是否必须改 `persona-catalog.md`？
  本次不改。先通过 `subagent-template` 的模板级 contract 要求 reviewer 在分析阶段显式考虑 change-discipline 三个维度，有问题时作为 finding 输出、无问题时保持静默，沿用现有单一 `findings` 数组 schema；不对具体 reviewer ownership 做强承诺。如果模板级 contract 仍不足以稳定产出，再单独立项调整 persona catalog、reviewer 真源或 schema。

### Deferred to Implementation

- `spec-review` 的 change-discipline finding 是否只靠现有字段表达，还是需要在 `findings-schema.json` 中增加更结构化的标签字段。
  需要在实现时结合当前 schema 和 reviewer compact return contract 判断；本次先不预设一定要扩 schema。

- 哪些新增 contract 需要上升到 `tests/smoke/cli.sh` 的 runtime 断言。
  取决于实现后哪些语句是“必须穿透 adapter transform 并在 runtime skill 中稳定可见”的核心守卫。

## Implementation Units

- [ ] **Unit 0: Governance preflight and release-note commitment**

**Goal:** 在任何 source-of-truth workflow contract 修改发生前，先完成仓库要求的治理落盘，消除“先改源码、后补 changelog”的顺序风险。

**Requirements:** R7, R8

**Dependencies:** None

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/08-版本更新/README.md`

**Approach:**
- 在第一个 workflow source 文件改动前，先写入 `CHANGELOG.md`，记录本次 workflow contract 改造。
- 按仓库现行 changelog 规则（`- v版本号 YYYY-MM-DD HH:MM:SS 作者: 变更摘要`），读取当前顶部版本并沿用当前发布节奏追加条目；**是否 bump minor 由实际 release cut 决定**，不在本计划中预判 semver 跳变。
- 把本次工作明确标记为 significant workflow contract update，因此 `docs/08-版本更新/README.md` 不是条件性更新，而是必改。
- 允许后续在 implementation 结束时细化文案，但不得把这两个治理文件推迟到所有源码修改之后。

**Patterns to follow:**
- `CHANGELOG.md`
- `docs/08-版本更新/README.md`

**Test scenarios:**
- Happy path: 在任何 `skills/...` 真源修改发生前，两个治理文档都已建立对应记录。

**Verification:**
- 实现者在进入 Unit 1 前已经完成治理层前置更新，不会违反仓库 changelog 铁律。

- [ ] **Unit 1: Strengthen planning-side contract surfaces**

**Goal:** 让 `spec-plan` 与 `spec-brainstorm` 把 assumptions、simpler viable approach、boundary discipline 从隐性 prose 提升为更稳定的 planning contract。

**Requirements:** R1, R5, R7

**Dependencies:** Unit 0

**Files:**
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-brainstorm/SKILL.md`
- Modify: `docs/10-prompt/skills/spec-plan/SKILL.md`
- Modify: `docs/10-prompt/skills/spec-brainstorm/SKILL.md`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/spec-brainstorm-contracts.test.js`

**Approach:**
- 在 `spec-plan` 的质量标准、core template 与 implementation unit guidance 中加入轻量但明确的结构，用于表达 `Explicit assumptions`、`Simplest viable approach`、`Change boundary`。
- 在 `spec-brainstorm` 的 collaborative dialogue / approaches 阶段明确：存在多个合理解释时不得静默选择；推荐更简单方案时要说明减少了什么 carrying cost。
- 保持现有 WHAT/HOW 分工，不把实现细节提前推回 brainstorm。

**Patterns to follow:**
- `docs/plans/2026-04-17-using-spec-first-host-split-integration-plan.md`
- `docs/plans/2026-04-14-009-feat-spec-brainstorm-supplemental-context-plan.md`
- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/spec-brainstorm-contracts.test.js`

**Test scenarios:**
- Happy path: `spec-plan` source contract 明确包含 assumptions / simplest viable approach / boundary 相关条款，且仍保留现有 Stage-0、interactive mode、deepening 合同。
- Happy path: `spec-brainstorm` source contract 明确要求多解释显式化与简化理由说明，且不破坏既有 Process Flow、Preflight Self-Check、User Review Gate 合同。
- Integration: Claude/Codex runtime transform 后不残留未适配内容，新增 contract 仍能正确穿透到 runtime skill。

**Verification:**
- `spec-plan` 与 `spec-brainstorm` 的 source contract 更明确，但仍维持当前 workflow 分工与 runtime adaptation 行为。
- 相关 unit tests 能直接断言新增 contract，而不是只靠人工阅读确认。

- [ ] **Unit 2: Enforce execution boundary discipline in spec-work**

**Goal:** 给 `spec-work` 增加最小可行变更、变更边界、完成信号的执行前 contract，并收敛 “Simplify as You Go” 的越界风险。

**Requirements:** R1, R3, R7

**Dependencies:** Unit 0, Unit 1

**Files:**
- Modify: `skills/spec-work/SKILL.md`
- Modify: `docs/10-prompt/skills/spec-work/SKILL.md`
- Test: `tests/unit/spec-work-contracts.test.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
- 在 `Read Plan and Clarify` 之后增加一个简短但硬性的 execution preflight：assumptions、simplest viable change、change boundary、verification signal。
- 将 `Simplify as You Go` 收敛为“只在当前改动边界内简化”，把跨边界 cleanup 明确降级为 follow-up。
- 在 `Key Principles` 中加入 “every changed line should trace back to the request, plan, or verified dependency” 一类的边界语义。

**Execution note:** contract-first

**Starting point:** 先从 `skills/spec-work/SKILL.md` 的 `Read Plan and Clarify`、`Simplify as You Go`、`Key Principles` 三个锚点段落下手，避免把 contract 分散插入到低价值位置。

**Patterns to follow:**
- `tests/unit/spec-work-contracts.test.js`
- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`

**Test scenarios:**
- Happy path: source skill 明确包含 execution preflight 相关 contract，且不破坏 plan-driven input boundary。
- Edge case: 新 contract 不把 `spec-work` 重新拉回 bare prompt triage，也不引入新的 workflow entry confusion。
- Integration: 生成到 Claude/Codex runtime 的 skill 仍保留新增 contract，必要的 smoke 断言能捕获后续回退。

**Verification:**
- `spec-work` 在 prompt 级明确禁止“顺手重构/顺手整理”跨出当前任务边界。
- 新 contract 能被 unit test 和必要 smoke test 同时守住。

- [ ] **Unit 3: Add change-discipline signal generation and synthesis to spec-review**

**Goal:** 让 `spec-review` 允许 reviewer side 显式产出 orthogonal edits、speculative complexity、assumption leak 信号，并在 synthesis 中把这些信号提升为显式 finding，而不是停留在泛化 maintainability 建议层或 residual risks 中。

**Requirements:** R1, R4, R7

**Dependencies:** Unit 0, Unit 2

**Files:**
- Modify: `skills/spec-review/SKILL.md`
- Modify: `skills/spec-review/references/subagent-template.md`
- Modify: `skills/spec-review/references/review-output-template.md`
- Modify: `skills/spec-review/references/findings-schema.json`
- Modify: `docs/10-prompt/skills/spec-review/references/subagent-template.md`
- Modify: `docs/10-prompt/skills/spec-review/references/review-output-template.md`
- Modify: `docs/10-prompt/skills/spec-review/references/findings-schema.json`
- Modify: `docs/10-prompt/skills/spec-review/SKILL.md`
- Test: `tests/unit/spec-review-contracts.test.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
- 先在 `subagent-template` 中把 orthogonal edits、speculative complexity、assumption leak 列为**所有 reviewer 在分析阶段必须显式考虑的三个维度**：有问题时必须作为 finding 输出（禁止藏进泛化 maintainability 评论或 residual_risks），无问题时保持静默，不需要为每个维度返回专门空占位——沿用现有单一 `findings` 数组 schema。
- 再在 Stage 5 `Merge findings` 与 Stage 6 `Synthesize and present` 中新增 change-discipline 维度，把 reviewer 输出中关于越界改动、提前抽象、未声明假设的信号收敛成稳定 finding 路由。
- 本次不改 reviewer team 结构，也不引入新 persona；模板级 contract 对所有 reviewer 开放这三个维度，不承诺由哪类 reviewer 最先发现，synthesis 统一收口。
- 先尽量复用现有 severity / autofix_class / owner / requires_verification 字段；只有在表达力明显不够时才扩 schema。
- 报告层要能区分 “代码逻辑有错” 与 “diff discipline 失守” 两种问题，不让后者继续隐形。

**Execution note:** integration-first — 先确定 synthesis / output contract，再决定 schema 是否需要最小扩展

**Starting point:** 先读 `skills/spec-review/references/subagent-template.md`、`skills/spec-review/SKILL.md` 的 Stage 5/6 与 `findings-schema.json` 的当前字段边界（尤其是 `severity`、`autofix_class`、`owner`、`requires_verification` 的 enum 值），再决定是不是需要新增结构字段。若 change-discipline finding 无法用现有 `autofix_class` 枚举（通常属 manual / gated_auto）稳定表达，才考虑最小 schema 扩展。

**Patterns to follow:**
- `tests/unit/spec-review-contracts.test.js`
- `skills/spec-review/references/subagent-template.md`
- `skills/spec-review/references/review-output-template.md`
- `skills/spec-review/references/findings-schema.json`

**Test scenarios:**
- Happy path: reviewer contract 把 orthogonal edits / speculative complexity / assumption leak 列为分析阶段必须显式考虑的三个维度（有问题输出 finding、无问题静默、不需空占位），且 source skill 明确包含对应 synthesis guidance；unit test 能断言 `subagent-template` 中三个维度关键词同时出现。
- Edge case: change-discipline finding 不应误升级成 P0/P1 correctness finding，severity 仍需校准。
- Integration: source references 与 docs mirror references 同步更新，runtime transforms 后新增 review contract 仍可见；若 schema 扩展，unit test 能验证兼容 merge-tier / detail-tier 约束。

**Verification:**
- `spec-review` 可以稳定地让 reviewer 在分析阶段显式考虑三个维度（orthogonal edits / speculative complexity / assumption leak）并在 synthesis side 报告 change-discipline 问题（无问题时维度维持静默，不产生噪音），而不是散落在 residual risks 或泛化 maintainability 表述里。
- schema 与 output template 如有修改，能与主 skill contract 保持一致。
- 如决定扩展 `findings-schema.json`（新增字段或枚举值），`tests/unit/spec-review-contracts.test.js` 必须新增断言覆盖新字段的存在、类型与使用约束，不允许只改 schema 不改 test。
- source references 与 docs mirror references 不发生漂移。

- [ ] **Unit 4: Carry lightweight inheritance into lfg without adding stages**

**Goal:** 让 `lfg` 以最小增量继承这套行为 contract，但不改变其 `plan -> work -> review` ordered pipeline。

**Requirements:** R1, R6, R7

**Dependencies:** Unit 0, Unit 1, Unit 2, Unit 3

**Files:**
- Modify: `skills/lfg/SKILL.md`
- Modify: `docs/10-prompt/skills/lfg/SKILL.md`
- Test: `tests/unit/lfg-contracts.test.js`

**Approach:**
- 只增加轻量继承说明，强调 `spec:plan`、`spec:work`、`spec:review` 在当前 pipeline 中默认带上最小变更、显式假设、可验证完成的执行姿势。
- 不新增新步骤、不改变 gate 顺序、不在 `lfg` 内重写下游 contract。
- **落点**：继承说明放在首段 `CRITICAL:` 前置块之后、编号步骤 1 之前作为独立段落；**不得**插入到任何 GATE 文本内部，也不得改写 `disable-model-invocation: true` 或 8 个步骤的原有措辞，避免破坏 ordered pipeline 与 GATE 语义。

**Patterns to follow:**
- `tests/unit/lfg-contracts.test.js`
- `skills/lfg/SKILL.md`

**Test scenarios:**
- Happy path: `lfg` 仍保持既有 ordered pipeline、software-only gate、local enhancement，且新增说明不引入新阶段。
- Integration: runtime transforms 后 `lfg` 仍无陈旧命令名、无额外 workflow 分支。

**Verification:**
- `lfg` 对下游 contract 的继承表达更清晰，但 pipeline 结构、入口和 gate 不发生变化。

- [ ] **Unit 5: Sync governance-facing docs and validation guardrails**

**Goal:** 收口本次 workflow contract 改造的仓库治理要求，确保 source/mirror/test/changelog/release notes 同步，不留下“文档或运行时只更新一半”的尾巴。

**Requirements:** R7, R8

**Dependencies:** Unit 0, Unit 1, Unit 2, Unit 3, Unit 4

**Files:**
- Create: `tests/unit/workflow-doc-mirror-contracts.test.js`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/spec-brainstorm-contracts.test.js`
- Test: `tests/unit/spec-work-contracts.test.js`
- Test: `tests/unit/spec-review-contracts.test.js`
- Test: `tests/unit/lfg-contracts.test.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
- 对所有受影响 unit tests 补充关键词级守卫，确保新增 contract 不在后续 prompt refactor 中被无意移除。
- 新增一个专门的 docs mirror consistency test，采用**全量 glob 枚举**策略：扫描 `skills/**/SKILL.md` 与 `skills/**/references/**` 下本次声明为"有 docs mirror"的 skill（`spec-work`、`spec-review`、`spec-plan`、`spec-brainstorm`、`lfg`），对每个源文件在 `docs/10-prompt/skills/` 下定位对应 mirror 并做 byte-equal 断言；若 mirror 缺失或多余文件，测试应失败。避免手工维护白名单漂移。
- 仅在必要处扩充 smoke 断言，验证关键 contract 能穿透到 runtime skill；不做低价值、全文级重复断言。
- 收尾时对本 plan 文档本身跑一遍 markdownlint（MD032 列表空行、MD060 表格空格等），消除当前遗留的格式告警，避免留下 plan-vs-repo-standard 的治理尾巴。

**Patterns to follow:**
- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`
- `tests/smoke/cli.sh`
- `tests/unit/using-spec-first-contracts.test.js`

**Test scenarios:**
- Happy path: Unit 0 已完成 `CHANGELOG.md` 与版本说明文档更新，Unit 5 只验证其完整性而不再承担前置治理责任。
- Happy path: `tests/unit/workflow-doc-mirror-contracts.test.js` 对全量枚举的 5 条 workflow（`spec-plan`、`spec-brainstorm`、`spec-work`、`spec-review`、`lfg`）下的 `SKILL.md` 与 `references/**` 做 byte-equal 断言，并对缺失或多余 mirror 文件报错。
- Edge case: 只修改 source-of-truth 与 docs mirror，不触碰 runtime artifact；测试与验证能发现误改 artifact 的回归。
- Integration: `tests/smoke/cli.sh` 对关键 runtime contract 有足够守卫，但不会演变成低信噪比全文镜像测试。

**Verification:**
- 本次改造完成后，source skill、docs mirror、references mirror、contract tests、必要 smoke 守卫和前置治理文档同步闭环完整。
- docs mirror references 的一致性由明确测试落点守住，而不是停留在人工核对。
- 没有留下 runtime artifact 被手工修改但源头未改的治理缺口。

## System-Wide Impact

- **Interaction graph:** 影响 `spec-plan`、`spec-brainstorm`、`spec-work`、`spec-review`、`lfg` 五条主干 workflow，以及对应的 docs mirror、unit contract tests 和部分 runtime smoke 守卫。
- **Error propagation:** 若 `spec-review` synthesis 路由设计不当，可能造成 finding 过噪或 severity 漂移；若 `spec-work` 合同过重，可能拖慢简单任务执行。实现时需要保持 contract 短而硬，而不是冗长 checklist。
- **State lifecycle risks:** 本次不涉及 runtime state 结构变更；主要风险是 source/mirror/test 未同步导致 contract drift。
- **API surface parity:** 不改变 `/spec:*`、`$spec-*`、standalone skill 发现方式或双宿主产品面；运行时只体现 prompt 合同变化。
- **Integration coverage:** 需要同时覆盖 source contract、runtime transform、docs mirror 同步和关键 smoke 断言，避免只在一个层面验证。
- **Unchanged invariants:** `using-spec-first` 继续只负责 routing；dual-host governance contract 不变；`spec-optimize` 不被纳入本次最小变更约束。

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `spec-work` 新增 contract 过重，影响简单任务执行速度 | 把新增 contract 控制在执行前的短 preflight，避免演化成冗长模板 |
| `spec-review` 新 finding 维度造成噪音或错误升级 | 优先复用现有 severity / routing 体系，并在 unit tests 中明确 change-discipline 的校准边界 |
| source skill 与 docs mirror 漂移 | 每个实现单元同步更新 mirror，并在最终验证中把 mirror 一致性纳入检查 |
| 修改 prompt contract 却忘记 changelog / 发布说明 | 用 Unit 0 前置治理单元锁定顺序，避免靠最后人工补记 |
| 与当前 `feat/sync-compound-core-workflow-updates` 分支上 `skills/spec-brainstorm/`、`skills/spec-plan/` 等 in-flight 修改三方冲突 | Unit 1 启动前必须先落地或 rebase 当前分支上的 compound sync 变更；在分支状态 clean 之前不得修改这两个 skill 的 source |

## Documentation / Operational Notes

- 本次属于 workflow contract 的 source-level 变更，实施时应遵守仓库“先改 source-of-truth，再通过同步链路刷新 runtime”的治理规则。
- 本次实现已预先归类为 significant workflow contract update，必须同步更新 `docs/08-版本更新/README.md`，而不只记 `CHANGELOG.md`。
- 实施完成后应优先跑受影响的 contract tests 与关键 smoke 守卫，确认 Claude/Codex runtime skill 都消费到新合同。

## Sources & References

- Related code: `skills/spec-plan/SKILL.md`
- Related code: `skills/spec-brainstorm/SKILL.md`
- Related code: `skills/spec-work/SKILL.md`
- Related code: `skills/spec-review/SKILL.md`
- Related code: `skills/lfg/SKILL.md`
- Related tests: `tests/unit/spec-plan-contracts.test.js`
- Related tests: `tests/unit/spec-brainstorm-contracts.test.js`
- Related tests: `tests/unit/spec-work-contracts.test.js`
- Related tests: `tests/unit/spec-review-contracts.test.js`
- Related tests: `tests/unit/lfg-contracts.test.js`
- Supporting plan: `docs/plans/2026-04-17-using-spec-first-host-split-integration-plan.md`
- Supporting design: `docs/plans/2026-04-17-using-spec-first-technical-design.md`
- Institutional learning: `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`
