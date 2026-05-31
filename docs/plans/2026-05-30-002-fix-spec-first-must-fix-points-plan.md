---
title: "fix: spec-first 现在必须修复的三点(证据诚实性 / 核心 eval 安全网 / 消费 ledger MVP)"
type: fix
status: active
date: 2026-05-30
spec_id: 2026-05-30-002-spec-first-must-fix
---

# fix: spec-first 现在必须修复的三点

## Summary

将 150 轮审查收敛出的「现在最该先做」三点落为最小可维护改动:① 证据诚实性收敛——把已散落在多处的 graph 诚实性规则 wire 进下游 skill,并补一条**确为净新增**的「graph claim 必须引用具体字段」约束;② 给最高风险核心 skill(首批仅 code-review)补 eval 安全网(防 prose 盲改);③ 在 spec-work 一处接最小消费标注(复用既有 run-artifact 字段,只加 used/ignored 语义)。三项都保留,但每项砍到最小核心,不新建框架、不新建真相源、不引入状态机。

**经对抗性审查修正(见末尾 Review Findings):** ① 原稿把 ① 误定性为缺陷修复——经回源,blast-radius 禁令(`graph-provider-consumption.md` line 92)与 impact_context=false 处理(line 136)**已存在**,① 的真实价值是 wiring(skills 当前不引用该契约)+ 字段引用净新增,已据实降格定性;③ 与既有 `read_artifacts`/`graph_evidence_used` 去重,净新增收窄为 used/ignored 标注。

---

## Problem Frame

`docs/项目审查/2026-05-30-codex-100轮审查后当前优化点.md`(canonical-index)与 Claude 50 轮审查交叉印证出系统当前最尖锐的缺口:一个以「可验证」为信条的系统,却无法验证自身证据是否诚实、行为是否退化、artifact 是否被消费。本方案不覆盖全部 P0-P6,只取其中「不做就持续出错 / 无法验证」的硬约束子集,作为先行窄计划。

证据已核实(均回源 `docs/contracts/**`、`skills/**`、`src/cli/**`、`tests/**`):
- `impact_context=false → 按 stale 处理` 与 blast-radius 禁令已在 `docs/contracts/graph-provider-consumption.md`;本计划不新增该禁令,真实缺口是 downstream skill 与 scenario matrix 尚未统一 wiring 到 `impact_context=false / definitions-only` 口径,且缺少 graph claim 必须引用具体字段的 consumer 约束。
- `code-review`/`plan`/`debug`/`brainstorm`/`compound` 五个核心 skill **无 `evals/` 目录**;eval 有两种既有格式 + 两个硬编码 shape 测试。
- `spec-work-run-artifact` 基础设施(schema + producer + atomic-write + schema-validator + immutable/containment/prune)已齐备,`script_confirmed`/`llm_asserted`/`provider_untrusted` 三分已存在。

本计划本身不修代码,只产出可执行方案。

---

## Requirements

- R1. 消费 graph 证据的下游 skill,必须把既有 `impact_context=false`/definitions-only 诚实性规则 wire 到实际执行口径;graph-backed claim 必须引用具体字段。(证据诚实性收敛,wiring + 字段引用净新增)
- R2. 加固以「改一处共享契约 + 各 skill 加指针」实现,不在四处重写规则。
- R3. 为最高风险核心 skill(首批仅 `spec-code-review`)补最小 fresh-source eval fixture + 配套 shape 测试,防 prose 行为盲改。
- R4. 在 `spec-work` closeout 记录最小消费事实(读了哪些 artifact、是否用于决策),复用现有 run-artifact 基础设施,不新建 schema 体系。
- R5. 全过程不新增公开 workflow、不新建第二真相源、不引入状态机。**不手改 generated runtime mirrors(`.claude/`/`.codex/`/`.agents/skills/`);如需同步 runtime,只通过改 source/generator 后运行 `spec-first init` 重生成。**

---

## Scope Boundaries

- 不实现完整 Evaluation Harness / Workflow Outcome Ledger 全字段(那是 P1 完整体,独立大 plan)。
- 不做 current-state layer、review deterministic merge 脚本化、knowledge retrieval index、invariant matrix——均留 backlog,等本计划落地 + friction 数据再排序。
- 不改 GitNexus provider 实现,不把 definitions-only 升级为 impact。
- 不做 dashboard、KPI、telemetry 平台、OTel 接入。
- **不改 `spec-compound`/`spec-compound-refresh` 的 graph 消费 prose**:它们虽是契约声明的 consumer,但既有约束(`downstream-graph-evidence-consumption.md` line 35/72:只沉淀 source-confirmed graph learning、raw provider output 不进 durable)已覆盖本次诚实性目标,无字面 blast-radius 风险面;纳入只增改动面不增价值。
- **U1 不新增 scenario class**:只扩 `unavailable-provider` 行的触发条件覆盖 impact_context=false,避免 class 膨胀。

### Deferred to Follow-Up Work

- 为 `spec-plan`/`spec-debug`/`spec-brainstorm`/`spec-compound` 补 eval:本计划只做 `spec-code-review`(最高风险单点),验证模式后再逐个跟进。
- 消费 ledger 扩展到 `spec-code-review`/`spec-compound`:这两个 artifact 性质不同(temp / solutions doc),且 run-artifact `workflow` const 锁 `spec-work`,跨 workflow 复用需单独评估,留后续 CUD。

---

## Graph Readiness

- target_repo: spec-first(当前仓库)
- status: unavailable
- source_revision: n/a(规划任务自身不依赖图谱影响面)
- current_revision: n/a
- stale: n/a
- primary_providers: n/a
- degraded_providers: n/a
- fallback_capabilities: bounded direct repo reads(已用 subagent 完成落地锚点核查)
- runtime_mcp_evidence: unavailable
- confidence: high(本计划为 docs/contract/prose 改造,落地锚点已直接读源核实)
- limitations: 本计划改的是治理 prose 与契约,graph 影响面分析对规划本身 not-applicable;实现期由 spec-work 按需消费 graph。

---

## Context & Research

### Relevant Code and Patterns

- 共享 graph 消费契约(加固挂载点):`docs/contracts/downstream-graph-evidence-consumption.md`、`docs/contracts/graph-provider-consumption.md`、`docs/contracts/graph-evidence-policy.md`
- 已有 blast-radius 禁令范式(只覆盖 unavailable-provider,需扩展):`skills/spec-debug/SKILL.md`、`skills/spec-code-review/SKILL.md`
- eval 既有格式(四文件 case 格式 + 单文件 examples 格式):`skills/spec-write-tasks/evals/`、`skills/spec-graph-bootstrap/evals/`、`skills/using-spec-first/evals/examples.json`
- eval shape 测试(硬编码 skill 列表,补 skill 须同步):`tests/unit/prompt-examples-contracts.test.js`、`tests/unit/spec-write-tasks-contracts.test.js`
- run-artifact 基础设施(ledger 复用):`docs/contracts/workflows/spec-work-run-artifact.schema.json`、`src/cli/helpers/spec-work-run-artifact.js`、`src/cli/atomic-write.js`、`src/contracts/schema-validator.js`
- script-owned facts 风格先例:`skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`(`quality_signals`)
- closeout 挂载点:`skills/spec-work/references/shipping-workflow.md`(`Graph evidence used` mini-section 已是结构化 closeout 范例)

### Institutional Learnings

- `docs/项目审查/2026-05-30-codex-100轮审查后当前优化点.md`:P0 消费证明 / P3 semantic eval / 「先证明价值再增能力」「减少重复认知负担 > 新增能力」。
- 角色契约:Light contract · Explicit boundaries · Let the LLM decide;script-owned facts vs LLM-owned judgment;advisory ≠ confirmed;preview-first。

### External References

未做外部调研:三项均为内部 prose/契约/最小 schema 改造,本地已有强模式可循(见上)。

---

## Key Technical Decisions

- **加固走共享契约而非四处重写**:在 `downstream-graph-evidence-consumption.md` 补一条字段引用 consumer 约束,并扩展 `scenario-capability-matrix.md` 既有触发条件;各 skill 只加指针引用。理由:避免同一规则四份 prose drift(本就是审查发现的脆弱点)。
- **blast-radius 禁令的触发条件扩展,而非新增禁令**:复用 `spec-debug`/`spec-code-review` 已有措辞,把触发条件从 `unavailable-provider` 扩到含 `impact_context=false / definitions-only`。
- **eval 首批只做 code-review**:它是 1101 行、最复杂、最常改、最高风险的单点;先验证「补 eval」模式,其余 4 个 deferred。避免一次铺开 5 套 fixture + 5 个测试的过度投入。
- **ledger 复用 spec-work-run-artifact,只在 work 一处接**:schema/producer/atomic-write/validator 全齐,复用既有 `read_artifacts` / `graph_evidence_used`,只补 used/ignored 语义标注,并要求关联 `key_decisions` 或 validated evidence;不复制 artifact 字段、不新建分区。
- **消费 ledger 只记事实不判断成功**:脚本记录「读了/未读、是否用于决策」,「是否产生价值」由 LLM/人类解释,不脚本化。

---

## Open Questions

### Resolved During Planning

- 范围覆盖几项? → 用户确认全部 3 项,带依赖排序。
- 加固是改契约还是改四处 skill? → 改一处共享契约 + U2a 指针(ground truth 确认契约已存在且 skills 未引用)。
- ledger 新建还是复用? → 复用 run-artifact,且经审查去重为 used/ignored 净新增。
- eval 补几个 skill? → 首批仅 code-review,其余 deferred(避免过度设计)。
- ① 是不是新的缺陷修复? → **否**(对抗审查回源纠正):禁令已存在于 `graph-provider-consumption.md` line 92/136,① 真实价值是 wiring + 字段引用净新增,已据实降格。

### Deferred to Implementation

- U3 used/ignored 字段精确命名 / 放入 `llm_asserted` 既有 object 还是新 optional 子字段:实现期看 schema 现状定,保持最小、对齐既有三分。
- U2b 用四文件格式还是 examples 格式:按 code-review decision/failure 枚举清晰度定;用 examples 须同步 `prompt-examples-contracts.test.js` line 7-11 硬编码数组。
- U1 是否存在可挂的 contract-text 测试入口:实现期确认 `docs/contracts/**` 测试现状。

---

## Implementation Units

> 每个 unit 的提交都**同步更新 CHANGELOG**(仓库 atomic-changelog 规则),不把 changelog 推迟到收尾 unit。

### U1. Graph 字段引用约束 + scenario matrix 触发条件扩展

**Goal:** (a) 在 `downstream-graph-evidence-consumption.md` 补一条**确为净新增**的约束——graph-backed claim 必须在 evidence 段落点名所依据的具体字段(`query_global_graph`/`impact_context`/`freshness_state`),不得笼统 "based on graph";(b) **把 `scenario-capability-matrix.md` 现有 `unavailable-provider` 行的触发条件扩展到也覆盖 `impact_context=false / definitions-only`**——该矩阵是受 `scenario-capability-matrix-contracts.test.js` 守护的 source-of-truth,改 skill prose 却漏它会造成契约 drift。

**净新增 vs 既有(诚实标注):** 「禁止 blast-radius 断言」已存在于 `graph-provider-consumption.md` line 92、impact_context=false 按 stale 处理已存在于 line 136 —— U1 **不重写这些规则**,只补字段引用约束(grep 确认契约中无此要求)、扩 scenario matrix 触发条件。**不新增 scenario class**(避免 class 膨胀,审查反复警告),只扩现有行覆盖范围。

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `docs/contracts/downstream-graph-evidence-consumption.md`(补字段引用约束一条)
- Modify: `docs/contracts/workflows/scenario-capability-matrix.md`(扩 `unavailable-provider` 行触发条件含 `impact_context=false`/`definitions-only`,或在该行的 trigger 列补这两个 signal;不加新 class)
- Modify: `tests/unit/scenario-capability-matrix-contracts.test.js`(同步断言扩展后的触发条件)

**Approach:**
- 字段引用约束写成独立、可检索的一句(便于 contract-text 测试断言)。
- scenario matrix 只扩 trigger 列的 signal 枚举,fallback 行为(`fallback-only`)与守护字段不变。

**Patterns to follow:** `graph-provider-consumption.md` line 92/136 既有 definitions-only/impact_context 处理;`scenario-capability-matrix.md` line 69 现有行结构。

**Test scenarios:**
- Happy path:`scenario-capability-matrix-contracts.test.js` 断言扩展后的触发条件含 `impact_context=false`/`definitions-only` → 通过。
- Edge case:字段引用约束文本可被 contract 测试或 matrix 测试检索到(给 U1 净新增一个可执行验证锚点)。
- Error path:matrix 行缺扩展后的 signal → 测试失败(证明守护有效)。

**Verification:** `npm run test:unit` 含 scenario-matrix 断言通过;契约可检索到字段引用约束;matrix `unavailable-provider` 行覆盖 impact_context=false。

---

### U2a. 下游 skill 指针 + blast-radius 触发条件扩展

**Goal:** 在消费 graph 的下游 skill 中引用 U1 契约/matrix(指针,不复制规则),并把 `spec-debug`/`spec-code-review` 已有 blast-radius 禁令的触发条件从仅 `unavailable-provider` 扩到也覆盖 `impact_context=false / definitions-only` 的字面表述。**覆盖契约声明的全部 graph consumer**:work/code-review/debug/plan + `spec-write-tasks`,与 `downstream-graph-evidence-consumption.md` 目标行的 consumer 清单对齐(R1)。

**净新增 vs 既有(诚实标注):** code-review 已在 line 57/85 对 definitions-only 做 pointers-only 处理,缺的只是字面 "blast radius" 词的覆盖 —— 本 unit 是措辞补齐 + 指针 wiring,非新规则。

**Requirements:** R1, R5

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-code-review/SKILL.md`、`skills/spec-debug/SKILL.md`(扩展触发条件 + 指向 U1 契约)
- Modify: `skills/spec-plan/SKILL.md`、`skills/spec-work/SKILL.md`、`skills/spec-write-tasks/SKILL.md`(graph 消费段加最小指针)

**Approach:** 指针引用 U1 契约,不复制规则正文;触发条件扩展复用既有措辞。`spec-write-tasks` 加最小指针即可(它消费 graph evidence 调 task focus,需同样的诚实性约束)。

**Patterns to follow:** code-review line 52 / debug line 54 既有 fallback-only 禁令措辞。

**Test scenarios:**
- `Test expectation: none -- 纯 prose 指针/措辞扩展,行为效果由 U2b 对 code-review 的 fresh-source eval 部分验证;plan/work/debug/write-tasks 的行为效果属未验证(靠 LLM 读契约),已在 Risks 标注。`

**Verification:** 五个 graph-consumer skill 可检索到对 U1 契约的引用;code-review/debug 的 blast-radius 禁令触发条件含 definitions-only。

**Knowledge workflows 处置(claim 5):** `spec-compound`/`spec-compound-refresh` 也是契约声明的 consumer,但它们的既有约束(line 35/72:只沉淀 source-confirmed graph learning,raw provider output 不进 durable)**已覆盖**本次诚实性目标,无字面 blast-radius 风险面。本 unit **不改 compound**,在 Scope Boundaries 记录排除原因,不漏判。

---

### U2b. spec-code-review eval 安全网

**Goal:** 为最高风险的 `spec-code-review`(1101 行、最常改)补最小 fresh-source eval fixture + 配套 shape 测试,作为后续 prose 改动的回归网。

**Requirements:** R3, R5

**Dependencies:** None(可与 U1/U3 并行;不依赖 U2a)

**Files:**
- Create: `skills/spec-code-review/evals/`(按既有格式)
- Modify(若用 examples 格式): `tests/unit/prompt-examples-contracts.test.js`(line 7-11 硬编码数组加 `spec-code-review`)
- Create/Modify: 对应 eval shape 测试(参照 `tests/unit/spec-write-tasks-contracts.test.js`)

**Approach:**
- fixture 覆盖关键场景:provider-only finding rejection、`impact_context=false` 时不出 blast-radius、confidence anchor、report-only/no-agents fallback。
- **code-review 没有 spec-write-tasks 那种 Final Decision Envelope / decision 枚举**(仅有 `### Failure Modes`,line 33)——因此 eval **不追求全量枚举覆盖**,只覆盖上述关键场景,避免把 MVP 拖成 brittle eval 框架。
- 格式选择倾向 examples.json(场景驱动,贴合 code-review 无 decision 枚举的形态);若选 examples,同步 `prompt-examples-contracts.test.js` line 7-11 数组。

**Execution note:** 先写 fixture(确立期望行为),再让它成为 U2a prose 改动的回归网。

**Patterns to follow:** `skills/using-spec-first/evals/examples.json` 单文件场景结构(优先,贴合 code-review);`docs/contracts/workflows/fresh-source-eval-checklist.md`。

**Test scenarios:**
- Happy path:fixture 文件存在、schema_version/字段合法 → shape 测试通过。
- Edge case:若用 examples 格式,code-review SKILL.md 含 evals 引用句(prompt-examples 测试硬性要求该措辞)。
- Error path:fixture 缺必填字段 / 枚举非法 → shape 测试失败(证明测试有效)。
- 场景覆盖:上述 4 个关键场景各至少一个 case;**不要求** Final Decision Envelope 全量覆盖(code-review 无此枚举)。

**Verification:** `npm run test:unit` 通过;新增 shape 测试覆盖 code-review;fresh-source eval 对「impact 不可用」断言正确降级。

---

### U3. spec-work 最小消费标注(去重后)

**Goal:** 在 `spec-work` closeout 记录最小消费**语义**——某 artifact 是否用于决策(`used_for_decision`)、未用原因(`ignored_reason`)。**复用既有 `read_artifacts`(读了哪些)、`graph_evidence_used`(graph 消费),不重复造字段。**

**去重后的净新增(应对审查「多真相源」):** schema 已有 `llm_asserted.read_artifacts`/`key_decisions`(line 227 required)、`graph_evidence_used.graph_findings_applied/as_risk_only/source_reads_validated`(line 262+)。U3 **删掉** 原稿的 `artifact_ref`/`read_by_workflow`(与 `read_artifacts` 重复)与「graph 字段消费」类(已由 `graph_evidence_used` 承担)。净新增仅 used/ignored 标注,首批只覆盖 **solutions 命中**一类(最未被现有字段覆盖的)。

**Requirements:** R4, R5

**Dependencies:** None

**Files:**
- Modify: `docs/contracts/workflows/spec-work-run-artifact.schema.json`(在既有分区加最小 optional 字段;`additionalProperties:false` 下须同步 required/allowed set 的处理)
- Modify: `src/cli/helpers/spec-work-run-artifact.js`(producer 写入;同步 `ALLOWED_*_FIELDS`,否则被拒)
- Modify: `skills/spec-work/references/shipping-workflow.md`(closeout 记录,挂既有 `Graph evidence used` mini-section 旁)
- Modify: 对应 run-artifact contract/producer 测试

**Approach:**
- 字段全 optional、additive;明确「additive 不破坏」= 新 optional 字段 + 更新 allowed set，不动既有 required。
- script-owned(存在性/path/schema 合法)与 llm-owned(是否真用于决策、ignored 是否合理)对齐既有三分。
- **可证伪约束(应对自报无依据)**:`used_for_decision=true` 不得是孤立自报——schema 层要求它**关联具体证据**:指向既有 `key_decisions[]` 条目,或 validated source/read evidence(`read_artifacts`/`source_reads_validated`)。脚本可校验「关联引用存在」(script-owned),「关联是否合理」由 LLM 判断(llm-owned)。这把软标注绑到既有硬字段,落地 advisory≠confirmed。
- 严格不判断「是否成功/是否产生价值」。
- **字段 ownership/mapping 表(应对多真相源)**:U3 实现须在 schema 注释或契约里附一张表,明确 used/ignored 与既有 `read_artifacts`/`key_decisions`/`graph_evidence_used` 的关系——used/ignored 是**对既有字段的语义标注层**,不复制其内容。

**Patterns to follow:** schema 的 `graph_evidence_used` object;`bootstrap-providers.sh` 的 `quality_signals` script-owned facts 风格。

**Test scenarios:**
- Happy path:closeout 写入含 used/ignored 标注 + 关联引用的 run.json → schema 校验通过、字段持久化。
- Edge case:不提供新字段的旧式 payload → 仍校验通过(additive 向后兼容);`additionalProperties:false` 下未列入 allowed set 的字段 → 被拒(证明边界)。
- Error path:新字段类型非法 → schema 拒绝;**`used_for_decision=true` 但无关联 key_decision/source evidence → schema 或 producer 拒绝(证明可证伪约束生效)**。
- Integration:经 `writeFileAtomicIfAbsent` 写入,同 run-id 已存在返回 `artifact-already-exists` 不覆盖。

**Verification:** run-artifact contract/producer 测试通过(含 used 必须关联硬证据的断言);一次真实 closeout 产出含 used/ignored 标注的 run.json;`npm run test:unit` 绿。

---

### U4. 双宿主一致性核对(收尾)

**Goal:** 核对 U1-U3 的 prose/契约/schema 改动在 Claude 与 Codex 双宿主投影一致;README 按需更新。**CHANGELOG 不在此 unit——已折进 U1/U2a/U2b/U3 各自提交。**

**Requirements:** R5

**Dependencies:** U1, U2a, U2b, U3

**Files:**
- Modify(按需): `README.md` / `README.zh-CN.md`(仅当消费标注 / eval 构成用户可见行为变化)
- Modify(按需): `docs/contracts/**` 交叉引用

**Approach:** prose/契约改动核对双宿主投影;不手改 mirror,如需同步 runtime 只通过改 source/generator 后跑 `spec-first init` 重生成。

**Test scenarios:**
- `Test expectation: none -- 双宿主核对,由 npm run lint:skill-entrypoints + 既有投影测试覆盖。`

**Verification:** `npm run lint:skill-entrypoints` 通过;双宿主投影核对无 drift。

---

## System-Wide Impact

- **Interaction graph:** U1 契约被 plan/work/debug/code-review 四个下游消费,但 wiring 由 U2a 接线(当前 0 skill 引用);U2b 仅新增 code-review eval 资产;U3 仅影响 spec-work run-artifact 写入路径。
- **Error propagation:** U3 schema 为 additive optional 字段,旧 run.json 不受影响;U2b eval 失败给 drift evidence,不自动改 prose。
- **API surface parity:** run-artifact schema 是 downstream consumer(review/resume/compound)接口——additive 扩展,不破坏既有 reader。
- **Unchanged invariants:** 不改 GitNexus provider、不升级 definitions-only→impact、不新增公开 workflow、不动 generated mirrors、不引入状态机。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| **U1 行为效果仅 1/4 consumer 被验证**:影响 plan/work/debug/code-review,但 U2b eval 只覆盖 code-review | 诚实接受:U1 净新增(字段引用约束)由 contract-text 测试验证存在性;plan/work/debug 行为效果属未验证(靠 LLM 读契约),不伪称已覆盖;其余 skill eval deferred |
| **U3 首版可能无下游 consumer**:used/ignored 写入后当前无 workflow 读取 | 接受 U3 为 P0「消费证明」探针;实现期尽量让 resume/code-review 读 run.json 时展示,否则 verification 标注「首版无下游读取」 |
| 加固 prose 在四个下游再次 drift | U1 收敛到单一契约 + U2a 指针引用,正是为消除 drift |
| U3 与既有 `read_artifacts`/`graph_evidence_used` 多真相源 | 已去重:删 `artifact_ref`/`read_by_workflow`,graph 消费类移除,净新增仅 used/ignored |
| `additionalProperties:false` 下加字段被拒 | U3 明确同步 schema allowed set + producer `ALLOWED_*_FIELDS`;Edge 测试覆盖 |
| 双宿主投影不一致 | U4 显式核对;runtime 用 `spec-first init` 重生成 |
| 范围蔓延为完整 Evaluation Harness | Scope Boundaries 明确 deferred;U3 只记事实不判断成功 |

---

## Sources & References

- Origin index: `docs/项目审查/2026-05-30-codex-100轮审查后当前优化点.md`(canonical-index,P0/P3 来源)
- Claude 审查: `docs/项目审查/2026-05-30-全面审查-自我进化-result.md`(主题 E/G/H)
- 判断基线: `docs/10-prompt/结构化项目角色契约.md`
- 落地锚点: 见 Context & Research(均已回源核实)

---

## Review Findings(对抗性审查留痕 · 2026-05-30)

本方案经独立对抗性审查 + 回源核验。7 条事实声明:5 ✅ / 2 ⚠️(claim 1「共享挂载点」是设计意图非实际 wiring 且禁令已存在;claim 3 code-review 对 definitions-only 已部分覆盖,缺的只是字面词)。已据审查修正:

- **应修 1(U1 定性)**:删除「真正的 bug 修复」措辞,降格为「契约表述收敛 + 字段引用净新增 + wiring」。回源证据:`graph-provider-consumption.md` line 92 已禁 blast-radius、line 136 已规定 impact_context=false 按 stale 处理;字段引用约束 grep 无命中,确为唯一净新增。
- **应修 2(U1 验证缺口)**:U1 不再伪称由 U2 eval 覆盖;改为 contract-text 测试验证净新增存在性,并诚实标注 plan/work/debug 行为效果未验证(Risks 表)。
- **应修 3(U3 去重)**:删 `artifact_ref`/`read_by_workflow`(与 `read_artifacts` 重复)、移除 graph 字段消费类(已由 `graph_evidence_used` 覆盖);净新增收窄为 used/ignored 标注,首批仅 solutions 命中。
- **应修 4(U3 必须成色)**:承认 U3 是 P0 消费证明探针、首版可能无 consumer,写入 Risks,不再用「必须」过度包装。
- **应修 5(CHANGELOG)**:CHANGELOG 折进 U1/U2a/U2b/U3 各自提交(atomic-changelog 规则);U4 降级为双宿主核对收尾。
- **可选 1(拆 U2)**:原 U2 拆为 U2a(指针+触发条件,依赖 U1)与 U2b(code-review eval,独立可并行)。
- **可选 2(U1 死契约)**:U1 与 U2a 同批落地,避免无 consumer 的契约编辑。

未发现被错误降级的「必须」项;边界合规(script/LLM、advisory≠confirmed、反状态机、source-first、不动 mirror)无违规。

### 第二轮审查修正(2026-05-30,5 条全部回源核验成立)

- **必修 3(scenario matrix 漏改,最重要)**:回源确认 `scenario-capability-matrix.md` line 69 只有 `unavailable-provider` 行,且 `scenario-capability-matrix-contracts.test.js` 确实存在(受测守护的 source-of-truth)。原 U1/U2 改 skill prose 却漏此矩阵会造成契约 drift → U1 纳入矩阵触发条件扩展 + 同步其 contract test。**约束:不新增 scenario class**,只扩现有行覆盖。
- **必修 1(U2b eval 形状)**:回源确认 code-review 有 `### Failure Modes`(line 33)但**无** Final Decision Envelope(spec-write-tasks 才有)。原 U2b「Final Decision Envelope 每个 decision 覆盖」对 code-review 不适用、会拖成 brittle 框架 → 删除该断言,只覆盖 4 个关键场景,格式倾向 examples.json。
- **必修 5(consumer 覆盖不全)**:回源确认契约目标行声明 consumer = work/code-review/debug/**write-tasks**/**Knowledge(compound)**。原 U2a 漏 write-tasks 和 compound → U2a 加 `spec-write-tasks` 指针;compound 在 Scope Boundaries 明确排除并给原因(既有 source-confirmed 约束已覆盖)。
- **应修 2(U3 自报无依据)**:`used_for_decision=true` 须关联具体 `key_decisions[]` 或 validated source/read evidence,脚本校验关联存在(script-owned),合理性由 LLM 判断;附字段 ownership/mapping 表防多真相源。Error-path 测试覆盖「无关联即拒绝」。
- **应修 4(R5/U4 runtime 歧义)**:R5 改为「不手改 mirror;如需同步只通过改 source/generator 后跑 `spec-first init`」,消除「不动」与「重生成」的表面冲突。

两轮审查后:5 unit(U1/U2a/U2b/U3/U4),改动面更准更小(scenario matrix 纳入是补漏不是加料,compound 显式排除是减法),所有 ⚠️/必修项均回源坐实、非主观。
