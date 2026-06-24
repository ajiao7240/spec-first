---
spec_id: spec-prd-clarification-evidence-2026-06-24-003
status: completed
plan_type: refactor
plan_depth: standard
created: 2026-06-24
target_repo: spec-first
origin: none
origin_note: "无 requirements doc 来源;WHAT 由 owner 在会话内闭合,诊断证据为 hsglobal 仓 docs/brainstorms/2026-06-24-001-kaz-market-page-prd-execution-log.md(只读引用)。本 plan 使用 plan-local spec_id,未继承 origin identity。"
---

# refactor: spec-prd clarification-evidence 韧性修复

## Summary

`spec-prd` 的「default deep clarification」是软意图,但「成型输入不重问 + Outstanding Question 记录即合法闭合 + revise-prd 即完成 + headless 静默跳过」等出口,再叠加写前无门槛和设计证据缺口,会在结构化多文档输入下塌向**零 owner 问答直出 PRD**;在 Codex 非 blocking-question 环境里,这个问题还会被误解释为 headless 降级。

本次改造的唯一主线:**把「能否写 PRD」前置为显式 `write_mode` 判定,再用 `clarification_evidence` 记录本次 clarification 证据**。写入前先判断最高风险 gap 是否应先问 owner;能问则 `ask-owner-first` 并停止,多源长链才允许 `checkpoint-prd`,全部 load-bearing WHAT 已闭合才允许 `final-prd`。同时让 `clarification_evidence` 可被 readiness 消费(skipped/缺失 → 不得 ready)、可被 checker 输出 advisory facts、可被 eval 锁定(回归 fixture)。

owner 决策的配套副线(U9):把上述「写前先判定」收敛为 `reason-then-act / 先规划后执行` 的轻量副作用前纪律——**在提问、写 PRD、readiness 裁决和 handoff 这类会改变用户可见结果的动作前,先定下对应的 Decision Card 字段或一行 reason,再执行**。主线的 `write_mode` 写前门槛正是该纪律在 PRD 写入前的实例;U9 不新增阶段状态枚举、不追求证明全流程时间顺序,只把可验证重点放在 Phase 3/4。

这是 prompt/workflow prose + eval + contract test + advisory checker facts 的协同改动,不引入硬性「必须问 N 个问题」gate、不建状态机/transcript/新产物 topology、不让脚本判语义。脚本只报告「section 存在、计数、合法声明是否在场、声明缺失 finding」等 deterministic facts,LLM 判「是否问透、能否 ready」,eval 兜回归。

---

## Problem Frame

### 根因(已闭合,作为输入)

诊断证据(hsglobal 仓 execution log,只读引用):一次 `$spec-prd --codex` 执行,输入 7 文档 / 2250 行结构化多源材料,全程 **0 次 owner 交互**,却产出 26 条需求 PRD,两次通过 `check-prd-artifact.js`,readiness 标 `revise-prd`(诚实但无痛)。即:零问答 + 一堆未决(6 Outstanding + 6 Planning Recheck)+ revise-prd = 一次「成功」的 spec-prd 执行,无任何机制提示「这次根本没 grill」。

六个根因/出口叠加:

1. **Structured Input Synthesis 旁路过宽**(`product-expert-lens.md:73`「do not re-ask settled WHAT by default」)——「输入看起来成型」被当成「WHAT 已确认」的通行证,12 处未决被一次性 settle。
2. **Outstanding Question 记录即合法闭合**——SKILL 把 gap「recorded as Outstanding Question」列为合法闭合态,模型走阻力最小路径:不追问,直接列进文档,偷换掉「确认」这一步。
3. **revise-prd 即完成**——非 ready 的诚实兜底,但让「没问透」也算一次完成的执行。
4. **headless / no blocking-question 混淆**——Codex 当前模式可能没有 `request_user_input`,但普通 chat 仍可 fallback 问一题并等待。SKILL 虽禁「silently skip」,但缺一个「普通交互必须 chat fallback,只有 true headless 才可降级」的可验证落点,导致既没问也没声明降级。
5. **写前无门槛**——当前流程允许先写 PRD,再用 `revise-prd` 或 `Outstanding Questions` 表示未 ready;这只能事后诚实,不能阻止“直接生成 PRD”。
6. **设计证据缺口被 Planning Recheck 合法化**——同一失败链路里,Figma 只读取了主市场页、模块加载态、整体失败态,二级列表页、模块级失败态、详情页与其它细分节点未逐一读取,却被放进 `Planning Recheck` 后仍接近 `ready-for-planning` 口径。只要设计节点会改变页面结构、状态、交互、验收或范围,它就是 PRD 输出阶段必须读取和校准的 WHAT 证据,不能后移给 plan。

### 单一衡量判据

改造后,一次「结构化多文档 + 无 owner 交互 + 未决塞 Outstanding」的运行:
- 必须先产生 `write_mode`;若最高风险 gap 可由 owner 回答关闭,优先 `ask-owner-first` 并停止,不得直接写 final PRD;
- 若因多源/长链需要保留上下文,只能写 `checkpoint-prd`,且必须声明 `can_enter_spec-plan: no` 与 `next_owner_question`;
- 必须显式声明 `clarification_evidence`,且不能合法落到 `ready-for-planning`;
- 若声明 `skipped` 或缺失,readiness 必须标注「clarification 未发生」并最低 `revise-prd`;
- 若存在影响 UI 结构/状态/交互/验收/范围的 Figma/design-source 节点,必须在 PRD 输出过程中读取并映射到 PRD write target;未读取完整时不得 `ready-for-planning`;
- 若确为 true headless / report-only / 上游禁止交互,必须 closeout 写明降级原因与被降级问题清单;普通 Codex 交互模式必须 chat fallback,不得静默降级。

---

## Scope Boundaries

### In scope

- `skills/spec-prd/SKILL.md`:Run-Local Decision Card 新增 `write_mode`、`highest_risk_gap`、`next_owner_question`、`question_delivery`、`clarification_evidence` 五个字段(含枚举值→场景映射);Interaction Method 补 chat fallback / true headless 边界;Execution Flow 新增 Pre-Write Closure Gate;Phase 4 消费 checker finding;Core Principles 增 `reason-then-act / 先规划后执行` 轻量原则,只覆盖提问、写 PRD、readiness 裁决和 handoff 等副作用动作(U9)。
- `skills/spec-prd/references/product-expert-lens.md`:收窄 Structured Input Synthesis「不重问」旁路。
- `skills/spec-prd/references/design-source-evidence.md`:明确 Figma/design-source 读取、节点覆盖、provider_untrusted 校准与 readiness 阻塞边界。
- `skills/spec-prd/references/large-input-checkpoint.md`:明确 checkpoint PRD 是恢复点/中间态,不是完成态或 planning-ready。
- `skills/spec-prd/references/prd-output-template.md`:收紧 `Decision Notes` / closeout 字段,禁止无 owner 证据的 `accepted-assumption`。
- `skills/spec-prd/references/prd-readiness-lens.md`:新增 readiness 规则消费 `write_mode` + `clarification_evidence`。
- `skills/spec-prd/evals/examples.json` + `tests/unit/spec-prd-contracts.test.js`:回归 fixture + 字段/规则锚点锁。
- `skills/spec-prd/scripts/check-prd-artifact.js`:advisory facts / finding。
- `CHANGELOG.md`、`docs/05-用户手册/22-PRD需求文档质量增强流程.md`(用户可见行为变化,必须同步)、fresh-source eval closeout 报告。

### Non-goals(明确不做,防过度设计)

- ❌ 不加「每次必须问 ≥N 个问题」硬 gate——会让 source-proven 的简单增量被迫表演问答。
- ❌ 不建 clarification **持久状态机** / transcript / 新产物 topology / 阶段状态枚举——违反「无第二 PRD 拓扑」。**边界澄清(因 U9 引入 reason-then-act 纪律)**:禁止的是「为每个阶段新增 phase-status 枚举、持久化进度文件、跨轮 transcript」;**允许**的是「在提问、写 PRD、readiness 裁决和 handoff 前,把当前动作的理由或对应已有 Decision Card 字段写清楚」——后者复用既有字段、不新增 schema、不跨轮持久化,属运行态纪律而非状态机。二者的判别线:是否新增了需要持久化/跨轮读取的状态结构。
- ❌ 不让脚本判「问透没有」——语义判断归 LLM 与 eval;脚本只查「声明在不在」。
- ❌ 不回写已 completed 的 spec/plan(`2026-06-23-005`、`2026-06-24-002` 等)。
- ❌ 不手改 generated runtime mirror(`.claude/`、`.codex/`、`.agents/skills/`);runtime drift 由 `spec-first init` 修复。

### Deferred to Follow-Up Work

- **host/CI pre-handoff hard gate**:本 plan 不实现宿主级硬拦截。后续由 release owner / runtime-governance owner 评估是否把 `check-prd-artifact.js` 接入 pre-handoff/CI,触发条件为 PRD artifact 准备输出 `ready-for-planning` 或进入 `$spec-plan`;验收口径为缺少核心 readiness 声明时运行层阻断或强制降级,而不是仅由模型 closeout 自觉消费 finding。该项是 follow-up,不是本 plan Completion Criteria 的已完成内容。

---

## Direct Evidence

- target_repo: spec-first
- source_refs:
  - skills/spec-prd/SKILL.md(Run-Local Decision Card :104-119、Interaction Method :61-67、Execution Flow Phase 1 :152-160)
  - skills/spec-prd/references/product-expert-lens.md(Structured Input Synthesis :71-79)
  - skills/spec-prd/references/design-source-evidence.md(design-source provider_untrusted / unresolved design claims boundary)
  - skills/spec-prd/references/large-input-checkpoint.md(Checkpoint Write-In / Write-Timing Boundary)
  - skills/spec-prd/references/prd-output-template.md(Decision Notes / Readiness Self-Check)
  - skills/spec-prd/references/prd-readiness-lens.md(Core Pack :40-49、Outcomes :118-135)
  - skills/spec-prd/scripts/check-prd-artifact.js(buildReport facts :245-267)
  - skills/spec-prd/evals/examples.json(case_contract / sentinel_cases / cases / source_refs)
  - tests/unit/spec-prd-contracts.test.js(Decision Card 锚点 :281-282、Structured Input Synthesis 锚点 :756、eval case 断言 :949+)
- planning_snapshot_revision: leo-2026-06-20-yao-gate @ caa41dd8(spec-prd 三段重构已提交,未 push)
- planning_snapshot_worktree_dirty: 初始为否;本计划文件当前作为未跟踪/编辑中 source 草案存在,落改前需 tight re-read 并只触碰本计划声明 files
- discovery_methods: 本会话全文 Read + grep 行号定位 + node 解析 examples.json 结构
- tests_or_logs: `npx jest tests/unit/spec-prd-contracts.test.js`(基线 24 passed)、`node skills/spec-prd/scripts/run-evals.js --json`(基线 eval_fixture_passed)
- confidence: high(落点行号与字段结构已逐一核对)
- limitations: 诊断 execution log 在 hsglobal 仓,只读引用,不在本 plan 写范围;`write_mode` / `clarification_evidence` 为模型自填字段,naming-only 谎填风险由写前门槛、readiness 规则、checker advisory facts 与 fresh-source eval 行为验证兜底,非脚本可证

---

## Requirements Trace(plan-local)

本 plan 无上游 requirements origin,以下 P-level ID 是 plan-local trace,只用于 U1-U9 覆盖检查:

| ID | 定义 | Covered by |
| --- | --- | --- |
| P1-A | 写 PRD 前必须有 `write_mode` 门槛,可一题关闭的最高风险 gap 必须先问 owner。 | U1,U2,U3,U6 |
| P1-B | readiness 必须消费 `write_mode`、`clarification_evidence` 和未闭合 PRD-owned/design-source residue,不得把未问透 PRD 标为 ready。 | U3,U8 |
| P1-C | Structured Input Synthesis 只能跳过 source/owner 已闭合 WHAT,不能跳过最终落进 Outstanding/Planning Recheck 的 gap。 | U4,U6 |
| P1-D | Codex 无 blocking question tool 不等于 true headless;普通交互必须 chat fallback。 | U1,U2,U6 |
| P1-E | checkpoint PRD 与 output template 必须防止完成态误读,并提供 evidence-backed assumption 边界。 | U5 |
| P1-F | design-source(Figma 等)横切需求:影响 UI 结构/状态/交互/验收/范围的设计节点必须在 PRD 输出阶段建立 inventory、读取、校准为 provider_untrusted 证据并映射 write target;未读完整时阻塞 readiness;checker 输出 design-source coverage 缺失信号;eval 覆盖未读/省略。 | U3,U5,U6,U7 |
| P1-G | checker finding 必须被 readiness/closeout 消费;本计划只实现 prose 强约束 + deterministic finding + eval 观测,不声称宿主级硬 gate。 | U7,U8 |
| P1-H | reason-then-act 作为轻量副作用前纪律,只覆盖提问、写 PRD、readiness 裁决和 handoff,不新增状态机或证明全流程时间顺序。 | U9 |
| P2-E | eval/sentinel/fresh-source eval 必须覆盖零交互、headless 滥用、large-input 优先级、PRD-owned nonblocking、Figma 未读/省略和核心声明缺失。 | U6 |
| P2-F | checker 必须提供 deterministic facts/finding,包括合法声明解析、section 存在/计数和 design-source coverage 缺失信号。 | U7 |

---

## Context & Research

`spec-prd` 已于 `2026-06-24-002` 完成三段重构(Product Expert Lens 成为默认热路径 canonical 产品判断层)。本次执行日志正是对该重构的真实压测,暴露的是重构没补上的两块:**Product Expert Lens 是 default hot path,但没有写前 `write_mode` 门槛;没有「本次运行必须产生 owner 交互,或显式记录为何零交互」的可见信号与 readiness 消费点。**

现有同类 mechanism 可复用(§7 借鉴 mechanism 不牺牲边界):
- Run-Local Decision Card 已有 `output_shape` / `pre_prd_clarification_status` / `owner_question_progress` 等枚举字段(SKILL :111、:116-117),`write_mode` 与 `clarification_evidence` 与其同构、平级新增:前者记录写入许可,后者记录整轮 clarification 证据。
- readiness lens 已有「Outcomes 之前的 handoff entropy check」(:134)与 Core Pack `pre-prd clarification closure`(:46),新规则挂靠其上,不新建 pack。
- examples.json 已有 `sentinel_cases` 机制(naming-only 防回归先例),P2-E 复用该形态。
- contract test 已用 `expectContainsAll` 锁 Decision Card 整行字符串(:281-282)与 prose 锚点,新增锚点同构追加。

---

## Key Technical Decisions

1. **`write_mode` 是写前门槛,`clarification_evidence` 是运行态证据。** `write_mode` 决定本轮能不能写:可问 owner 的最高风险 gap 先 `ask-owner-first`;多源长链才 `checkpoint-prd`;全部 load-bearing WHAT 闭合才 `final-prd`;wrong-stage 或无 durable PRD 价值则 `route-out`。`clarification_evidence` 记录本轮 clarification 证据,两者都属于 Run-Local Decision Card,不是产物 frontmatter schema。

2. **牙齿分两层:写前门槛挡 final PRD,readiness 规则挡 ready-for-planning。** 字段可被谎填(naming-only),所以 `SKILL.md` 必须要求 Pre-Write Closure Gate 先选 `write_mode`;`prd-readiness-lens.md` 再把「`write_mode=checkpoint-prd|ask-owner-first`、`clarification_evidence=skipped` 或缺失,且存在 Outstanding/Planning Recheck」判为不得 `ready-for-planning`。fresh-source eval 做行为验证兜底谎填。

3. **Structured Input Synthesis 收窄锚定「只对未决 gap 强制一轮」,不退化成「成型输入从头重问」。** 豁免只适用于「有 source/owner 支撑的 settled WHAT」;任何最终落进 Outstanding/Planning Recheck 的 gap,按定义就不是 settled,必须先尝试一轮 grill 或显式记录为何无法澄清。措辞必须保留 `:73` 既有 test 锚点 `'Structured Input Synthesis'`。

4. **普通 Codex no-question-tool 走 chat fallback,true headless 才能降级。** Interaction Method 已有「Never silently skip an owner question」(:65),本次补的是「blocking question tool 不可用不等于 headless」:普通交互模式必须在 chat 中提出当前最高风险 owner question 并等待;只有 `mode:headless`、report-only、上游禁止交互或运行时不能等待用户时,才可 `headless-degraded-logged`,且必须 closeout 写明降级路径 + 被降级问题清单。

5. **脚本 advisory facts 必做,但不 gate、不判语义。** 脚本只能查「声明在不在、Outstanding / Planning Recheck 数量、是否存在明显阻塞列」,查不出「问得够不够」。但本次失败里 `findings: []` 是误导源之一,所以 checker 必须输出 advisory 提示,让 orchestrator 看见结构通过之外的风险。

6. **`accepted-assumption` 必须有证据,否则只叫 recommended default。** PRD 可以给推荐默认值,但无 owner 明确接受或无安全 source 支撑时,不得把 `Decision Notes.chosen_answer` 写成 `accepted-assumption`;未确认默认值进入 `Outstanding Questions` / `Planning Recheck` 并影响 readiness。

7. **PRD-owned 问题必须在 PRD 输出过程中逐一确认或阻塞,不能丢给 planning。** `Outstanding Questions` / `Planning Recheck` 不是未问 owner 的停车场。凡会改变 App 用户行为、范围、验收、数据权威、接口可用性、降级展示、埋点验收口径或 source-of-truth 的问题,都属于 PRD-owned closure:能问 owner 就必须 one-question-at-a-time grill;不能问则 `write_mode=ask-owner-first`、必要时 `write_mode=checkpoint-prd` 且 `readiness_outcome=revise-prd|ask-owner`,不得标 `blocks planning? no` 后输出 `ready-for-planning`。`Planning Recheck` 只承载规划/联调前复核的 HOW 或证据刷新项,例如网关前缀、环境、代码落点、实现方案读取,前提是 PRD 已给出不需要规划发明 WHAT 的产品默认与验收边界。

8. **Figma/design-source 是 PRD 阶段证据,不是 plan 阶段补课。** 只要设计输入影响页面信息架构、模块状态、二级页/详情页入口、错误/空/加载态、交互触发、验收或范围,`spec-prd` 必须先建立 `design_source_inventory` 分母,再读取相应 Figma/design-source 节点并校准成 `source-candidate/provider_untrusted` 证据。inventory 至少覆盖用户输入显式提供的 design refs、Figma 文件/page/frame 中可发现的节点、以及需求/交互文案引用到的设计状态;每项必须记录 source/node、read_status、影响的 PRD write target、未读原因、evidence level 和 readiness consequence。未读设计节点仍会改变 WHAT 时,不得写成 non-blocking `Planning Recheck`,不得从 coverage 表中省略,也不得输出 `ready-for-planning`。

9. **reason-then-act / 先规划后执行作为轻量副作用前纪律(owner-decided,U9)。** 本 plan 不把它扩展为 Phase 0-4 全流程状态机,也不声称能证明真实时间顺序。实现范围只覆盖会改变用户可见结果的动作:提问前说明当前最高风险 gap 与 `question_delivery`,写 PRD 前定 `write_mode`,readiness 裁决前消费 checker finding,hand off 前说明 `readiness_outcome` / `can_enter_spec-plan`。route-out / bypass / source-proven 等轻量路径只需一行 reason,不套完整 ceremony。验证口径是输出中存在这些轻量决策记录和 fresh-source eval 行为抽验,不是 transcript 级 temporal proof。

---

## Implementation Units

### U1. Run-Local Decision Card 新增写前门槛与澄清证据字段

**Goal** 在 SKILL Run-Local Decision Card 增加 `write_mode`、`highest_risk_gap`、`next_owner_question`、`question_delivery`、`clarification_evidence` 五个字段,使「本次能不能写 PRD」「最高风险 gap 是什么」「下一题是什么」「用什么交互路径提问」和「本次有没有真正发生 clarification」都可见。

**Requirements** P1-A

**Dependencies** 无(基础单元,U2/U3/U5 依赖它)

**Files**
- `skills/spec-prd/SKILL.md`(Run-Local Decision Card :104-119,在 `output_shape` / `owner_question_progress` 附近新增字段)

**Approach**
新增 5 个字段(与现有枚举字段同构):
```text
write_mode: ask-owner-first | checkpoint-prd | final-prd | route-out | not-run
highest_risk_gap:
next_owner_question:
question_delivery: blocking-tool | chat-fallback | true-headless-unavailable | not-needed
clarification_evidence: asked-owner | source-proven-no-ask | headless-degraded-logged | skipped
```
并在字段下方补完整的枚举值→运行场景映射(doc-review coherence F3/F7:四个值都须有赋值规则):
- `write_mode`:`final-prd` 只在 load-bearing WHAT 已闭合时可用;`checkpoint-prd` 是中间态(见 U2 优先级);`ask-owner-first` 为最高风险 gap 可一题关闭时;`route-out` 为 wrong-stage/无 durable PRD 价值;`not-run` 为未进入写判定。
- `question_delivery`:`blocking-tool` = 平台 blocking question 工具可用且已用于提问;`chat-fallback` = 无 blocking 工具但仍能 chat 等待用户;`true-headless-unavailable` = 真正不能等待用户(true headless/report-only/上游禁止);`not-needed` = 本轮 source-proven 无需 owner 提问。
- `clarification_evidence`:`asked-owner` = 实际向 owner 提问并获答(经 blocking-tool 或 chat-fallback);`source-proven-no-ask` = 未提问但有 source ref 闭合(须可指向 ref);`headless-degraded-logged` = true headless 下已 closeout 写明降级原因与被降级问题清单;`skipped` = 违规态(零交互且无 source/headless 支撑)。Execution Flow Phase 1(:152-160)「Before asking owner questions, run Product Expert Lens」段落补一句:写入前按最高风险 gap 置 `write_mode`,运行结束时按实际交互结果置 `clarification_evidence`。

**Patterns to follow** 紧邻的 `pre_prd_clarification_status` / `owner_question_progress` 字段写法(同为 `name: a | b | c` 单行枚举);Decision Card 顶部「not a persistent artifact, schema, gate」免责声明覆盖新字段。

**Test scenarios**
- Covers(锚定 P2-E 锚点)contract test 断言 SKILL 含整行 `write_mode: ask-owner-first | checkpoint-prd | final-prd | route-out | not-run`、`highest_risk_gap:`、`next_owner_question:`、`question_delivery: blocking-tool | chat-fallback | true-headless-unavailable | not-needed` 与 `clarification_evidence: asked-owner | source-proven-no-ask | headless-degraded-logged | skipped`(`expectContainsAll`,同 :281-282 形态)。
- contract test 断言四个枚举值各自作为子串在 SKILL 出现(防止枚举被删值)。

**Verification** `npx jest tests/unit/spec-prd-contracts.test.js` 中新增/既有 Decision Card 断言通过;字段语义可被 readiness 单元(U3)引用。

---

### U2. Pre-Write Closure Gate 与交互 fallback 边界

**Goal** 把「可问不问直接写」堵成写前 `ask-owner-first`;把「blocking question tool 不可用」和 true headless 降级区分开。

**Requirements** P1-A(Pre-Write Closure Gate 写前门槛)+ P1-D(chat-fallback / true-headless 边界)。本单元承载两个 P1 关注点,work 落地时建议拆成两个 commit 便于回溯(写前门槛改 Execution Flow,fallback 边界改 Interaction Method)。

**Dependencies** U1(引用 `write_mode` 与 `clarification_evidence=headless-degraded-logged`)

**Files**
- `skills/spec-prd/SKILL.md`(Interaction Method :61-67; Execution Flow Phase 1 / Phase 3 之间新增 Pre-Write Closure Gate)

**Approach**
在现有 fallback 段补一句:当 blocking question tool 不可用但当前运行仍能通过 chat 等待用户时,必须 `question_delivery=chat-fallback`,提出一个 source-backed owner question 并停止等待;不得把它记为 headless 降级。只有 true headless / report-only / 上游禁止交互 / 运行时不能等待用户时,才允许 `question_delivery=true-headless-unavailable`,并必须在 PRD closeout(或 Outstanding Questions 区)写明:降级路径、因何不可交互、被降级为 Outstanding 的问题清单,并置 `clarification_evidence=headless-degraded-logged`;无此留痕则视为 `skipped` 违规态,不构成合法 fallback。

新增 `Pre-Write Closure Gate`:在 Phase 1 source/current-state + Product Expert Lens 之后、Phase 3 Draft 之前运行。判定顺序固定、优先级不可被输入规模翻转:
1. 若 `highest_risk_gap` 可由一题 owner question 关闭 → `write_mode=ask-owner-first`,发起一题并停止。**此优先级最高,即使输入是 large-input(多源/长链)也不得跳过**——大输入不是直接 checkpoint 的理由。
2. 仅当最高风险 gap 已尝试闭合(或已发起 owner question)但运行时确实无法等待用户(true headless / report-only / 上游禁止交互),且存在上下文丢失风险 → `write_mode=checkpoint-prd`,并按 U5 标明非完成态。
3. 只有全部 load-bearing WHAT 已闭合到 source evidence / owner answer / evidence-backed `accepted-assumption` → `write_mode=final-prd`。`Outstanding Questions` / `Planning Recheck` / blocker cluster 仍在场时不得进入 `final-prd`;wrong-stage 或无 durable PRD 价值必须 `route-out`,不得伪装成 final PRD。

(不再引入 `pre_write_closure` 独立字段:`write_mode=final-prd` 本身即代表 load-bearing WHAT 已闭合,二者语义重叠;闭合明细由 readiness closeout 与 `owner_question_progress` 既有字段承载——见 doc-review scope F1。)

**Patterns to follow** Interaction Method 既有 fallback 三段式措辞;`large-input-checkpoint.md` 的 degraded reason 留痕语气(provider 不可用时 loud degrade)。

**Test scenarios**
- contract test 断言 Interaction Method 含 `chat-fallback`、`true-headless-unavailable`、`headless-degraded-logged` 与「无留痕=违规/非合法 fallback」语义短语(`expectContainsAll`)。
- contract test 断言 SKILL 含 `Pre-Write Closure Gate`、`write_mode=ask-owner-first`、`checkpoint-prd`、`final-prd` 的写前门槛语义。

**Verification** contract test 通过;措辞不与既有「Never silently skip」断言冲突(grep 既有锚点仍在)。

---

### U3. readiness lens 消费 write_mode 与 clarification_evidence

**Goal** 给字段装牙齿:写前未闭合、skipped/缺失 + 有未决 → 不得 ready-for-planning。

**Requirements** P1-B + P1-F(design-source residue 阻塞 readiness 部分)

**Dependencies** U1(消费字段)

**Files**
- `skills/spec-prd/references/prd-readiness-lens.md`(Core Pack `pre-prd clarification closure` :46 扩写,或 Outcomes handoff entropy check :134 前补一条规则)

**Approach**
在 Core Pack `pre-prd clarification closure` 项内补一条子规则(优先此处,避免新建 pack):
- 当 `write_mode=ask-owner-first` 或 `write_mode=checkpoint-prd` 时,readiness 不得返回 `ready-for-planning`;checkpoint closeout 必须写 `can_enter_spec-plan: no` 与 `next_owner_question`。
- 当 `clarification_evidence = skipped` 或字段缺失,且 PRD 存在 `Outstanding Questions` 或 `Planning Recheck` 条目时,readiness **不得**返回 `ready-for-planning`,最低 `revise-prd`,并在 closeout 显式标注「clarification 未发生(零 owner 交互且无 source/headless 支撑)」。
- 当 `Outstanding Questions` / `Planning Recheck` 中存在 PRD-owned owner question(影响产品行为、范围、验收、数据权威、接口可用性、降级展示、埋点验收口径或 source-of-truth)时,无论表格里是否写 `blocks planning? no`,readiness 都不得返回 `ready-for-planning`;必须继续问 owner,或将 readiness 降级为 `ask-owner` / `revise-prd`;若需要保留可恢复上下文,另设 `write_mode=checkpoint-prd` 与 `can_enter_spec-plan: no`。只有纯规划/联调复核项且 PRD 已给出产品默认与验收边界时,才可作为 non-blocking Planning Recheck。
- 当 PRD 输入包含 Figma/design-source 节点,且未读取节点会影响页面结构、状态、交互、验收或范围时,readiness 不得返回 `ready-for-planning`;必须继续读取设计源、问 owner 确认设计权威/默认值,或将 readiness 降级为 `revise-prd` / `ask-owner`;若需要保留可恢复上下文,另设 `write_mode=checkpoint-prd` 与 `can_enter_spec-plan: no`。只有已读设计证据覆盖 PRD write target,或未读节点被证明只影响 HOW/实现复核且不改变产品 WHAT 时,才可进入 non-blocking Planning Recheck。
- 当 `clarification_evidence = headless-degraded-logged` 时,该状态合法,但 readiness 结论必须复述降级原因与被降级问题清单。
- 当 `clarification_evidence = source-proven-no-ask` 时,readiness 检查其是否真带 source ref;无 source ref 则降级按 `skipped` 处理。
在 Outcomes handoff entropy check(:134)补一句:entropy check 须把 `write_mode` 与 `clarification_evidence` 纳入 handoff 残留判断。

**Patterns to follow** Core Pack 既有项的「条件 - 后果」措辞;:38 carve-out 对「advisory fact 不应反转成 coercive gate」的边界把握(本规则是 readiness 语义裁决,不是脚本 gate,符合此边界)。

**Test scenarios**
- contract test 断言 readiness lens 含「`write_mode` / `clarification_evidence`」与「ask-owner-first/checkpoint-prd/skipped/缺失 + Outstanding/Planning Recheck → 非 ready」的规则短语。
- contract test 断言 readiness lens 含「PRD-owned owner question 即使标 `blocks planning? no` 也不得 ready-for-planning」与「Planning Recheck 只承载 HOW/联调复核项」的边界短语。
- contract test 断言 readiness lens 含「Figma/design-source 未读取且影响页面结构/状态/交互/验收/范围时不得 ready-for-planning」的边界短语。
- contract test 断言 `headless-degraded-logged` 在 readiness 中作为合法但须复述原因的状态出现。
- 既有 readiness 断言(:777「compound packs」、:870 negative 断言)不被破坏。

**Verification** contract test 通过;readiness 不引入「Always Gate」字样(:870 negative 断言仍过)。

---

### U4. 收窄 Structured Input Synthesis 不重问旁路

**Goal** 堵本次主因出口:成型输入不再豁免「落进 Outstanding/Planning Recheck 的未决 gap」。

**Requirements** P1-C

**Dependencies** 无(可与 U1 并行)

**Files**
- `skills/spec-prd/references/product-expert-lens.md`(Structured Input Synthesis :71-79)

**Approach**
将 `:73`「do not re-ask settled WHAT by default」收窄:豁免仅适用于**有 source/owner 支撑的 settled WHAT**;明确「任何最终落进 `Outstanding Questions` / `Planning Recheck` 的 gap,按定义不是 settled,必须先尝试一轮 grill,或显式记录为何这一轮无法澄清(headless / 缺 source / owner 不在场)」。措辞锚定「只对未决 gap 强制一轮」,显式声明不要求成型输入从头重问已 source/owner 闭合的部分。保留段落标题 `Structured Input Synthesis`(test :756 锚点)与既有「separate settled WHAT / HOW / reference-claims」三分结构。

**Patterns to follow** 同文件 Design-Source / Large-Input Interface 的「advisory until confirmed」措辞;§7 借鉴 mechanism 不牺牲边界(收窄而非推翻该旁路)。

**Test scenarios**
- contract test 断言 product-expert-lens 仍含 `Structured Input Synthesis`(既有 :756 锚点不破)。
- contract test 断言含「落进 Outstanding/Planning Recheck 的 gap 非 settled / 须先尝试一轮 grill」的收窄语义短语。

**Verification** contract test 通过;:756 既有断言仍过。

---

### U5. checkpoint PRD 与 output template 收口

**Goal** 防止 `checkpoint-prd` 被误读为完成态,并防止无 owner 证据的默认值被写成 `accepted-assumption`。

**Requirements** P1-E + P1-F(design-source inventory/coverage 写入 template 部分)

**Dependencies** U1、U2、U3(引用 `write_mode` 与 readiness 规则)

**Files**
- `skills/spec-prd/references/large-input-checkpoint.md`(Checkpoint Write-In / Write-Timing Boundary)
- `skills/spec-prd/references/design-source-evidence.md`(Figma/design-source 读取覆盖、节点证据、未读阻塞边界)
- `skills/spec-prd/references/prd-output-template.md`(Decision Notes / Readiness Self-Check / closeout)

**Approach**
在 `large-input-checkpoint.md` 明确:checkpoint write-in 是恢复点,不是完成态;`checkpoint-prd` 必须在 PRD closeout 或 Readiness Self-Check 写明 `can_enter_spec-plan: no`、`next_owner_question`、未闭合的 owner/source gap;不得把 `Outstanding Questions` 包装成完成态。

在 `prd-output-template.md` 收紧:
- `Decision Notes.chosen_answer` 只有 owner 明确接受或 source 证明安全时才能写 `accepted-assumption`;
- 未确认但推荐的默认值写为 `recommended default`,并同步进入 `Outstanding Questions` / `Planning Recheck`;
- `design-source-evidence.md` 与 `prd-output-template.md` 必须要求 PRD 输出先列 `design_source_inventory`,再列 `design_sources_read`、`design_sources_unread`。inventory 分母至少覆盖:① 用户输入显式提供的 Figma/design refs;② Figma 文件/page/frame 中可发现的节点;③ PRD 需求、交互、状态文案引用到的二级页/详情页/模块失败态/加载态/空态等 design-dependent 节点。每项记录 `source_or_node`、`read_status`、PRD write target、证据等级(`source-candidate/provider_untrusted` 或 confirmed owner/source)、未读原因和 readiness 后果;未读节点影响 WHAT 时必须阻塞 readiness,不得从 coverage 表中省略。
- `Outstanding Questions` / `Planning Recheck` 模板旁补边界说明:PRD-owned owner question 不得通过 `blocks planning? no` 绕过 grill;只有不改变产品行为/范围/验收且 planning 可通过 source/code/API 文档复核的 HOW/联调项,才可标为 non-blocking Planning Recheck。
- `Readiness Self-Check` 固定包含 `write_mode`、`clarification_evidence`、`design_source_coverage`、`first_unclosed_owner_question`、`can_enter_spec-plan`、`why_not`,避免按模板生成的 PRD 默认触发 U7/U8 的 `clarification_evidence_undeclared` finding,并让未读 Figma/design-source 节点无法静默进入 ready。

**Patterns to follow** `large-input-checkpoint.md` 现有「PRD sections act as checkpoints」而非新 artifact 的边界;`prd-output-template.md` 现有 `Decision Notes` 与 `Planning Recheck` 章节,不新增 schema。

**Test scenarios**
- contract test 断言 large-input checkpoint 含 `checkpoint-prd`、`not a final PRD` 或等价「不是完成态」、`can_enter_spec-plan: no`。
- contract test 断言 output template 禁止无 owner/source 支撑的 `accepted-assumption`,并要求 `recommended default` 进入 Outstanding/Planning Recheck。
- contract test 断言 design-source evidence/output template 要求列出 `design_source_inventory`、已读/未读 Figma 节点、PRD write target、证据等级、readiness 后果,并声明 inventory 必须覆盖用户输入 refs、Figma 可发现节点和需求/交互引用节点。
- contract test 断言 output template 明确禁止把 PRD-owned owner question 标成 non-blocking Planning Recheck 来跳过 grill。
- contract test 断言 Readiness Self-Check 模板包含 `write_mode`、`clarification_evidence`、`design_source_coverage`、`first_unclosed_owner_question`、`can_enter_spec-plan`、`why_not`。

**Verification** `npx jest tests/unit/spec-prd-contracts.test.js` 通过;不新增 artifact topology。

---

### U6. eval 回归 fixture + 锚点锁

**Goal** 把「结构化多文档 + 零交互 + 未决塞 Outstanding → 期望 not ready」这一失败模式显式建模,防回归。

**Requirements** P2-E

**Dependencies** U1、U2、U3、U5(fixture 期望引用字段、写前门槛、readiness 与 checkpoint 规则)

**Files**
- `skills/spec-prd/evals/examples.json`(cases 数组新增 7 条 case;`sentinel_cases` **必须**同步增对应 sentinel,非可选——见 doc-review feasibility F3)
- `tests/unit/spec-prd-contracts.test.js`(eval case 断言区 :949+ 新增 `expectEvalCase`;字段/规则锚点断言已在 U1–U5/U7/U8 各单元落)

**Approach**
新增 eval case(复用既有 case 结构 + sentinel 形态):
```text
id: clarification-skipped-structured-input-rejected
intent: create
case_type: failure
quality_buckets: ["failure", "readiness-fail"]
input_shape: structured multi-doc input, zero owner interaction
coverage_tags: ["readiness"]   # 默认复用既有 tag;仅在 contract test 强制区分时才换成新 tag clarification-evidence
expected: [
  "write_mode must be ask-owner-first or checkpoint-prd before final PRD write",
  "clarification_evidence must be declared",
  "skipped or missing with Outstanding/Planning Recheck blocks ready-for-planning",
  "readiness emits revise-prd or ask-owner with clarification-not-performed note"
]
must_not: ["must not return ready-for-planning with zero owner interaction and unresolved Outstanding", "must not treat checkpoint-prd as final-prd"]
```
**另加两条 sentinel case 堵 doc-review 暴露的两条新旁路:**

```text
id: headless-degraded-abuse-rejected           # adversarial F2:换名不换行为
case_type: failure
quality_buckets: ["failure", "readiness-fail"]
input_shape: Codex with chat capability but claims true-headless to skip questions
coverage_tags: ["readiness"]
expected: ["chat-fallback required when chat can wait", "must declare question_delivery=chat-fallback not true-headless-unavailable"]
must_not: ["must not claim true-headless-unavailable when chat fallback is possible", "must not direct-write large checkpoint-prd to bypass owner interaction"]
```

```text
id: large-input-ask-owner-priority             # adversarial F4:优先级不被输入规模翻转
case_type: boundary
quality_buckets: ["refine"]
input_shape: large multi-doc input AND highest_risk_gap closable by one owner question
coverage_tags: ["readiness", "boundary"]
expected: ["write_mode=ask-owner-first even for large input when gap is closable by one question"]
must_not: ["must not jump to checkpoint-prd merely because input is large"]
```

**再加一条 sentinel case 锁定 owner 观点:PRD-owned 问题必须在需求输出过程中确认修复完善,不能停车到 planning。**

```text
id: prd-owned-question-nonblocking-ready-rejected
case_type: failure
quality_buckets: ["failure", "readiness-fail"]
input_shape: PRD marks product/data-source/interface/analytics owner questions as blocks planning=no and returns ready-for-planning
coverage_tags: ["readiness", "owner-question-avoidance"]
expected: ["PRD-owned owner questions must be grilled or block readiness", "Planning Recheck only carries HOW or integration recheck after product default and acceptance are closed"]
must_not: ["must not mark ready-for-planning when unresolved owner questions can change WHAT, acceptance, data authority, interface availability, fallback display, analytics acceptance, or source-of-truth"]
```

**再加一条 sentinel case 锁定设计证据观点:Figma/design-source 影响 PRD WHAT 时必须读取校准,不能停车到 planning。**

```text
id: figma-unread-prd-ready-rejected
case_type: failure
quality_buckets: ["failure", "readiness-fail"]
input_shape: PRD has Figma/design-dependent page or state nodes not read, places them in Planning Recheck, and returns ready-for-planning
coverage_tags: ["readiness", "owner-question-avoidance"]
expected: ["Figma/design-source nodes affecting UI structure, state, interaction, acceptance, or scope must be read during PRD output or block readiness", "unread design nodes must map to PRD write targets with source/node id, unread reason, evidence level, and readiness consequence"]
must_not: ["must not mark ready-for-planning when unread Figma/design nodes can change WHAT or acceptance", "must not use Planning Recheck as a parking lot for unread design pages, module failure states, detail states, or secondary list states that affect PRD requirements"]
```

**再加两条 sentinel case 锁定省略路径:模型不能靠不写未决区或不列未读设计节点来规避 checker/readiness。**

```text
id: core-declarations-omitted-ready-rejected
case_type: failure
quality_buckets: ["failure", "readiness-fail"]
input_shape: PRD has unresolved load-bearing WHAT but omits Outstanding/Planning Recheck, omits write_mode/clarification_evidence/can_enter_spec-plan, and returns ready-for-planning
coverage_tags: ["readiness", "owner-question-avoidance"]
expected: ["core readiness declarations are required for PRD artifacts or ready-for-planning outputs", "checker reports missing declaration findings even when Outstanding/Planning Recheck sections are absent"]
must_not: ["must not avoid checker findings by omitting Outstanding Questions and Planning Recheck", "must not mark ready-for-planning without valid write_mode, clarification_evidence, and can_enter_spec-plan declarations"]
```

```text
id: figma-omitted-from-coverage-ready-rejected
case_type: failure
quality_buckets: ["failure", "readiness-fail"]
input_shape: PRD input has Figma secondary/detail/error-state refs, but output only lists already-read homepage nodes in design_source_coverage and returns ready-for-planning
coverage_tags: ["readiness", "owner-question-avoidance"]
expected: ["design_source_inventory must include explicit input refs, Figma-discoverable nodes, and design-dependent states referenced by requirements", "unread design nodes omitted from coverage block readiness"]
must_not: ["must not mark ready-for-planning when unread design nodes are omitted from design_source_coverage", "must not treat a self-reported read-only list as full design coverage"]
```

七条 case 均**必须**在 `case_contract.sentinel_cases` 增对应 sentinel(对齐 `product-judgment-naming-only-rejected` 写法),非可选。**默认只复用既有 `readiness-fail` / `failure` / `refine` bucket 与既有 `readiness` / `boundary` / `owner-question-avoidance` tag,不新增 bucket、不新增 coverage tag**——bucket 与 tag 集合在 `examples.json` 与 contract test 两处都有断言,新增任一都触发连锁同步。仅当 contract test 强制要求 tag 维度区分本 case 时,才新增 `clarification-evidence` tag,并同步两处断言。

**行为验证边界:** U6 sentinel / `run-evals.js` 只证明 examples 结构、bucket/tag 和 must-fail 文案在场,不执行 PRD 生成,也不自行判定真实运行违规。所有“模型实际拒绝/降级”的行为结论必须由 fresh-source eval 或后续可执行 output-validation fixture 承载。

**Patterns to follow** `product-judgment-naming-only-rejected` sentinel(本仓既有 naming-only 防回归先例);`expectEvalCase` helper 断言形态(:1015、:1119)。

**Test scenarios**
- `expectEvalCase(examples, 'clarification-skipped-structured-input-rejected', {...})`、`expectEvalCase(examples, 'headless-degraded-abuse-rejected', {...})`、`expectEvalCase(examples, 'large-input-ask-owner-priority', {...})`、`expectEvalCase(examples, 'prd-owned-question-nonblocking-ready-rejected', {...})`、`expectEvalCase(examples, 'figma-unread-prd-ready-rejected', {...})`、`expectEvalCase(examples, 'core-declarations-omitted-ready-rejected', {...})`、`expectEvalCase(examples, 'figma-omitted-from-coverage-ready-rejected', {...})` 分别断言 case_type/quality_buckets/expected/must_not 在场。
- contract test 断言 `case_contract.sentinel_cases` 同步包含七条新增 id,且每条 sentinel 的 `requires` 覆盖对应 case 的关键 `case_type`、`quality_buckets`、`coverage_tags`、`expected`、`must_not`。
- `node skills/spec-prd/scripts/run-evals.js --json` 仍 `eval_fixture_passed`(新 case 结构合法、buckets 合规)。
- contract test 既有 `required_quality_buckets` / `must_not_required_quality_buckets` 断言不被破坏。

**Verification** `npx jest tests/unit/spec-prd-contracts.test.js`(全绿,case 数 +7)、`node skills/spec-prd/scripts/run-evals.js --json`(passed);行为违规是否真正被拒绝由 fresh-source eval / output-validation fixture 验证,不得只凭 sentinel 在场声称通过。

---

### U7. check-prd-artifact.js 确定性 facts / finding(orchestrator 消费信号)

**Goal** 确定性补网:PRD artifact 或 `ready-for-planning` 输出缺少合法 readiness 声明、或 design-source coverage 缺失时,产出**确定性、不依赖模型自觉**的 finding,既消除 `findings: []` 被误读成「已问透」,又为 U8 的 readiness/closeout 消费提供客观触发信号。

**Requirements** P2-F + P1-F(design-source coverage 缺失信号部分)

**Dependencies** U1、U5(依赖字段声明与 closeout 模板成型)

**Files**
- `skills/spec-prd/scripts/check-prd-artifact.js`(buildReport :196-267)
- `tests/unit/spec-prd-contracts.test.js`(脚本 facts 断言区)

**Approach**
在 `buildReport` 增确定性 facts(全部纯计数/存在性/合法声明解析,不含语义判断):
```json
{
  "planning_recheck_present": false,
  "planning_recheck_count": 0,
  "outstanding_questions_present": false,
  "outstanding_questions_count": 0,
  "write_mode_declared_valid": false,
  "clarification_evidence_declared_valid": false,
  "can_enter_spec_plan_declared_valid": false,
  "design_source_refs_present": false,
  "design_source_inventory_declared": false,
  "design_source_coverage_declared": false,
  "design_sources_read_present": false,
  "design_sources_unread_present": false
}
```

不增 `*_blocks_planning_count` 这类 fact:「某条 Outstanding / Planning Recheck 是否阻塞 planning」是语义判断,归 readiness lens(U3)与 fresh-source eval,脚本只数行数与查声明在不在,符合 KTD5 与 Non-goals「不让脚本判语义」。

**A4 修复(section-存在触发,不依赖表格计数):** 现有 `countSectionRows` 经 `tableRows` 只数 Markdown 表格行(`check-prd-artifact.js:143-146`),而 Outstanding / Planning Recheck 常用 bullet list 填写,此时 count=0、finding 永不触发,U7 价值落空。因此 finding 触发条件改为 **section 标题存在(`sectionRange` 非 null)即触发**,而非 `count > 0`:新增 `outstanding_questions_present` / `planning_recheck_present` 两个存在性 fact,触发条件用它们;`*_count` 仍保留作 advisory 计数,但不作触发判据。

**A5 修复(核心声明缺失不依赖未决区):** 对所有 PRD artifact 或任何声明 `ready-for-planning` 的输出,检查核心 readiness 声明是否为合法 key-value,而不是仅在 Outstanding / Planning Recheck 存在时触发。合法声明必须出现在 `Readiness Self-Check` 或 closeout 附近,并匹配枚举值;仅出现字段名、模板占位、代码块、说明文字或空值不算声明。示例解析规则:
```text
write_mode: ask-owner-first | checkpoint-prd | final-prd | route-out | not-run
clarification_evidence: asked-owner | source-proven-no-ask | headless-degraded-logged | skipped
can_enter_spec-plan: yes | no
```

当核心声明缺失或不合法时,push findings:
```json
{ "reason_code": "clarification_evidence_undeclared" }
{ "reason_code": "write_mode_undeclared" }
{ "reason_code": "can_enter_spec_plan_undeclared" }
```

**A6 修复(design-source coverage 缺失信号):** 当正文含 Figma URL、Figma node id、`design-source`、`design_source`、`design_sources_*`、`design_source_coverage` 或 Design / UX Evidence Hook 等设计源信号时,检查 `design_source_inventory` 与 `design_source_coverage` 是否声明,并检查 coverage 至少包含 read/unread/status 词面。脚本不判断某个未读设计节点是否改变 WHAT;只报告 coverage 是否存在且可解析。缺失时 push:
```json
{ "reason_code": "design_source_coverage_undeclared" }
{ "reason_code": "design_source_inventory_undeclared" }
```

**不改 exit code、不 gate**,脚本仍只产 deterministic facts,与脚本顶部「是否构成 readiness blocker 由 lens 语义裁决」注释一致。**这些 finding 不由脚本裁决阻塞,而由 U8 的 orchestrator/readiness 消费**——脚本提供客观在场的触发信号,LLM 负责 readiness 语义降级。

**Patterns to follow** 既有 `feature_slice_missing_acceptance_trace` advisory finding 写法;`countSectionRows` / `sectionRange` / `tableRows` 的 section 取数方式。

**Test scenarios**
- 单测:无 Outstanding / Planning Recheck 但直接声明 `ready-for-planning` 且缺核心声明的 fixture → findings 含 `write_mode_undeclared`、`clarification_evidence_undeclared`、`can_enter_spec_plan_undeclared`。
- 单测:含 Outstanding 或 Planning Recheck(表格格式)但无合法 `clarification_evidence` / `write_mode` 声明的 fixture → findings 含对应 reason_code。
- 单测(A4 关键):含 Outstanding 或 Planning Recheck(**bullet list 格式**)但无合法声明的 fixture → 仍触发 finding(证明 section-存在触发,不依赖表格计数)。
- 单测:字段名只出现在说明文字、代码块、模板占位或空值中 → 仍报 undeclared finding。
- 单测:已声明合法 `write_mode`、`clarification_evidence`、`can_enter_spec-plan` 的 fixture → 不报该 finding。
- 单测:含 Figma URL/node/design-source refs 但缺 `design_source_inventory` / `design_source_coverage` 的 fixture → findings 含 `design_source_inventory_undeclared` / `design_source_coverage_undeclared`。
- 单测:含 design refs 且 coverage 有 read/unread/status 词面的 fixture → 不报 design coverage 缺失 finding。
- 单测:无 PRD readiness claim、无 PRD artifact kind、无 Outstanding / Planning Recheck 的普通 Markdown 简单 fixture → 不报该 finding(避免对非 PRD 文档噪声)。
- 单测:facts 含 `outstanding_questions_present` / `outstanding_questions_count` / `planning_recheck_present` / `planning_recheck_count` / design-source facts 且值正确。

**Verification** `npx jest tests/unit/spec-prd-contracts.test.js`;脚本对既有 PRD 产物运行不产生 gate 行为变化(exit 0 不变)。

---

### U8. orchestrator 消费 checker 信号(prose 强约束 + eval 观测)

**Goal** 回应 doc-review 根因质疑:write_mode / readiness 都是 prose 软约束,与失效的旧约束同层、运行时可绕过。本单元把 U7 checker finding 从「多打两行 advisory」升级为 **readiness/closeout 必须复述并据此降级的 workflow 约束**,并用 fresh-source eval 观测是否真的消费。它不是宿主级硬 gate,不声称具备宿主级强制执行。

**Requirements** P1-G(根因决策:prose 强约束 + deterministic finding + fresh-source eval 观测,非宿主级 hard gate)

**Dependencies** U3、U7(消费 readiness 规则与 checker 确定性 finding)

**Files**
- `skills/spec-prd/references/prd-readiness-lens.md`(Outcomes / handoff entropy check 区)
- `skills/spec-prd/SKILL.md`(Phase 4 Readiness And Handoff)

**Approach**
在 readiness lens 与 SKILL Phase 4 写明一条 **workflow 强约束**(不是脚本 gate,也不是建议):

- 当 `check-prd-artifact.js` 返回 `clarification_evidence_undeclared`、`write_mode_undeclared`、`can_enter_spec_plan_undeclared`、`design_source_inventory_undeclared` 或 `design_source_coverage_undeclared` finding 时,readiness **必须**:① 不得输出 `ready-for-planning`;② 在 closeout 显式回填合法声明,或据实将 `readiness_outcome` 降级为 `revise-prd` / `ask-owner` / `route-out`;若要保留可恢复上下文,只能另设 `write_mode=checkpoint-prd`;③ 把该 finding 复述进 closeout,不得静默吞掉。
- 这条规则的价值来自:它绑定的是 checker 的确定性 finding,而非模型对「我问透了吗」的自我评估。**诚实边界**:Phase 4 跑 checker 仍由 SKILL prose 要求触发,脚本保持 exit 0 advisory;若模型完全跳过 checker,本 plan 只能通过 fresh-source eval 暴露该违规,不能在宿主层阻断。真正不可绕过的 pre-handoff/CI gate 已列入 Deferred to Follow-Up Work。

**诚实边界(必须写进 plan,不假装已硬修复):** 这仍不是宿主级硬 gate——脚本不改 exit code,host 不强制拦截。本单元能做到的是:当 checker 被按 Phase 4 要求运行时,让「绕过」从「无痕静默」变成「必须主动无视一条客观在场的 deterministic finding」,并让 eval 能抓到说谎。若要把绕过成本提升到运行层不可绕过,必须做 Deferred to Follow-Up Work 的 host/CI pre-handoff hard gate。

**Patterns to follow** readiness lens 既有「条件→后果」措辞;Phase 4 既有 `check-prd-artifact.js` 调用句;:38 carve-out 对 advisory fact 不反转成 coercive gate 的边界(本规则是 readiness 语义消费 deterministic finding,不是脚本自身 gate)。

**Test scenarios**
- contract test 断言 readiness lens 含「checker 返回 clarification_evidence_undeclared / write_mode_undeclared / can_enter_spec_plan_undeclared / design_source_*_undeclared 时不得 ready-for-planning」的消费规则。
- contract test 断言 SKILL Phase 4 含「checker finding 必须复述进 closeout、不得静默吞掉」语义。
- fresh-source eval(closeout)验证:零交互结构化输入跑完后,模型实际运行 checker、finding 在场且 closeout 据此降级而非 ready;若 checker 未运行,eval 记为 concern/fail,不得声称 U8 行为通过。

**Verification** `npx jest tests/unit/spec-prd-contracts.test.js`;fresh-source eval 行为验证 finding 被消费。

---

### U9. reason-then-act 轻量副作用前纪律(owner-decided)

**Goal** 落实 owner 决策:prd workflow 的关键副作用动作遵循「思考→规划→执行、先规划后执行」。把它做成轻量显式纪律,复用已有 Decision Card 字段或一行 reason,不新增阶段状态枚举/状态机,不声称可证明全流程真实时间顺序。

**Requirements** P1-H(owner-decided workflow 纪律)

**Dependencies** U1(规划记录依赖 Decision Card 字段);与 U2/U3/U7/U8 协同(写入和 readiness 阶段的可观察信号已在那里)

**Files**
- `skills/spec-prd/SKILL.md`(Core Principles 区加一条 `reason-then-act`;Execution Flow 在 owner question、Pre-Write Closure Gate、Phase 4 readiness/handoff 附近补轻量提示)

**Approach**
在 SKILL Core Principles 增第 7 条 `reason-then-act / 先规划后执行`:在产生用户可见副作用前,先写明当前动作的 reason 和对应 run-local 字段,再执行。只覆盖:
- owner question 前 → `highest_risk_gap` / `next_owner_question` / `question_delivery`
- PRD 写入前 → `write_mode`(经 U2 Pre-Write Closure Gate)
- readiness 裁决前 → 消费 U7 checker findings,再写 `readiness_outcome` / `can_enter_spec-plan`
- handoff 前 → 简短说明 `readiness_outcome` 与 next action

**显式写明**:① 复用既有字段,不新增阶段状态枚举/进度文件/transcript(守 Non-goal 调和边界);② route-out/bypass/source-proven 轻量路径只需一行 reason,不套完整 ceremony(守本文件 Non-goals / 80-20 最小可维护边界);③ 这是运行态纪律,prose 层为主,只通过 fresh-source eval 抽验「输出中是否先呈现关键决策」,不声称证明真实 temporal order。

**Patterns to follow** SKILL 既有 Core Principles 1-6 的措辞密度;Run-Local Decision Card 既有字段定义(不重复定义,只引用)。

**Test scenarios**
- contract test 断言 SKILL Core Principles 含 `reason-then-act` / `先规划后执行` 原则项。
- contract test 断言 SKILL 含「owner question / PRD write / readiness / handoff → 对应 Decision Card 字段」与「复用既有字段、不新增阶段状态枚举」的边界声明(防止后续退化成状态机)。
- contract test 断言显式排除句在场(route-out/bypass/source-proven 不套 ceremony),防仪式化退化。
- fresh-source eval(closeout)抽验:一次正常 PRD 运行中,模型输出是否在 PRD 写入前呈现 `write_mode`、readiness 裁决前消费 checker finding(与 U8 共用验证);不把最终字段存在当作 temporal order 证明。

**Verification** `npx jest tests/unit/spec-prd-contracts.test.js`;fresh-source eval 行为抽验;`node --check` 不涉及(纯 prose)。

---

## System-Wide Impact

- **双宿主 runtime**:改的是 `skills/spec-prd/**` source,Claude 与 Codex 两宿主的 runtime mirror 均需 `spec-first init` 重生成(本 plan 不手改 mirror;由 release owner 在 closeout 后执行)。
- **下游 consumer**:`spec-plan` 从 PRD 继承 readiness 结论;本次让「零问答 PRD」更难拿到 `ready-for-planning`,对下游是更强的「不补产品决策」保障,无破坏性接口变更。
- **用户手册**:`docs/05-用户手册/22-PRD需求文档质量增强流程.md` 必须同步用户可见行为:何时先问 owner、`checkpoint-prd` 与 `final-prd` 差异、Figma/design-source 未读如何影响 readiness、Codex chat fallback 的预期表现。

---

## Risks & Mitigations

| 风险 | 缓解 |
| --- | --- |
| `write_mode` / `clarification_evidence` 被模型 naming-only 谎填(填 final-prd/asked-owner 实则没闭合) | 字段非唯一牙齿;牙齿是 U2 写前门槛 + U3 readiness 规则 + U6/U7 fixture/checker facts + fresh-source eval 行为验证;脚本无法证 owner 交互真实性,plan 明确记录为 limitation |
| **根因残余风险:纯 prose 层无法硬性关闭「prose 不被遵守」**(doc-review adversarial F1)| **接受为残余风险,不假装已硬修复。** 本 plan 的牙齿(write_mode/readiness/Pre-Write Gate)仍主要在 prose + eval 层。U7+U8 把确定性 checker finding 变成 readiness 必须消费的客观信号,使「绕过」从「无痕静默」变成「必须主动跳过 checker 或无视 finding」,并让 fresh-source eval 能抓到说谎。真正不可绕过的 host/CI hard gate 已列入 Deferred to Follow-Up Work,不算本 plan 完成项。 |
| `headless-degraded-logged` 被滥用成「合法 checkpoint」旁路:零交互直出大 PRD 从 skipped 改名为合法降级(doc-review adversarial F2)| U2 明确 blocking question tool 不可用不等于 true headless;普通交互必须 chat fallback 并等待;只有 report-only/true headless/上游禁止交互才可降级。U6 新增 must-fail sentinel 记录该负例;fresh-source eval / output-validation fixture 验证模型实际拒绝该行为,避免把静态 fixture 误当行为裁决。 |
| **checkpoint-prd 优先级被 large-input 触发翻转**(doc-review adversarial F4):large-input 触发条件与 checkpoint 许可几乎同义,模型只要判「大输入」就跳过 ask-owner-first | U2 写死优先级:**即使 large-input,只要 highest_risk_gap 可一题关闭,仍必须先 ask-owner-first**;checkpoint-prd 合法前提是「最高风险 gap 已尝试闭合/已发起 owner question 但运行时确实无法等待」,而非「输入大所以直接 checkpoint」;U6 加对应 fixture |
| **PRD-owned 问题被伪装成 non-blocking Planning Recheck**:模型把会改变产品行为/验收/数据权威/接口可用性的 owner question 写成 `blocks planning? no`,然后宣称 `planning_would_invent_what: no` | KTD7 + U3/U5 明确 PRD-owned 问题必须在需求输出过程中逐一 grill 或阻塞 readiness;U6 新增 `prd-owned-question-nonblocking-ready-rejected` sentinel 防回归。 |
| **Figma/design-source 未读节点被伪装成 non-blocking Planning Recheck**:模型只读取首页/少数状态,把二级页、模块失败态、详情页等未读设计节点放进 Planning Recheck,但仍宣称 ready | KTD8 + U3/U5 明确影响 UI 结构/状态/交互/验收/范围的设计节点必须在 PRD 输出阶段读取并映射 write target;未读取完整时阻塞 readiness;U6 新增 `figma-unread-prd-ready-rejected` sentinel 防回归。 |
| **Figma/design-source 未读节点被直接省略**:模型只列已读节点,不把二级页/详情页/模块失败态纳入 unread 或 coverage,从而绕过 readiness | KTD8 + U5 增 `design_source_inventory` 分母;U7 增 design-source coverage finding;U6 增 `figma-omitted-from-coverage-ready-rejected` must-fail case;fresh-source eval 验证不能靠省略 coverage 项 ready。 |
| U4 收窄措辞过头,退化成「成型输入从头重问」,损伤体验 | 措辞硬锚定「只对落进 Outstanding/Planning Recheck 的未决 gap 强制一轮」,显式声明豁免 source/owner 已闭合部分;fresh-source eval 用一个「成型输入已 source-resolved」正向 case 验证不退化 |
| U6 新增 bucket 触发 run-evals.js 与多处 bucket 断言连锁失败 | 优先复用既有 `readiness-fail` bucket,不新增 bucket;若必须新增 coverage tag,同步所有 tag 断言点 |
| U7 checker finding 在 bullet-list 格式产物上静默失效(doc-review feasibility F2)| finding 触发改为 section-存在(`sectionRange` 非 null)而非表格 count>0;新增 `outstanding_questions_present`/`planning_recheck_present` 存在性 fact;fixture 含 bullet-list case |
| 并发 session 改动回滚未暂存编辑 | 每个 U 落改前 tight re-read,改完即跑最窄 test;必要时分单元 stage |
| prose 改完未做行为验证 = 空话 | closeout 强制 fresh-source eval(注入当前磁盘 source 到全新 subagent),不信会话缓存的 skill 行为;若 fresh-source eval `not_run`,行为类 Completion Criteria 不得宣称满足 |

---

## Verification Plan

最窄优先,按单元递增:

1. 每个 U 落改后:`npx jest tests/unit/spec-prd-contracts.test.js`(锚点断言)。
2. U6 后:`node skills/spec-prd/scripts/run-evals.js --json`(`eval_fixture_passed`,case 数 +7)。
3. U7 后:`node --check skills/spec-prd/scripts/check-prd-artifact.js` 与 `npx jest tests/unit/spec-prd-contracts.test.js --runInBand`。
4. 全量后:`npm run typecheck`、`npx jest tests/unit/changelog-format.test.js`(CHANGELOG 格式)、`git diff --check`。
5. **fresh-source eval(强制 closeout)**:把当前磁盘上 `skills/spec-prd/SKILL.md` + 改动的 references 注入全新通用 subagent,验证至少八条行为——(a) 结构化多文档零交互输入下,模型是否先给 `write_mode=ask-owner-first` 或 `checkpoint-prd`,且 readiness 不返回 ready;(b) 普通 Codex no blocking-question 工具场景是否 chat fallback 而非 true-headless 降级;(c) 成型输入已 source-resolved 时是否不被迫重问;(d) large-input 且最高风险 gap 可一题关闭时是否仍先 ask-owner-first;(e) PRD-owned owner question 被写成 nonblocking Planning Recheck 时是否阻塞 ready;(f) checker 返回 `clarification_evidence_undeclared` / `write_mode_undeclared` / design-source coverage finding 时,模型是否在 closeout 据此降级而非静默 ready;(g) Figma/design-source 未读节点影响页面结构/状态/交互/验收/范围时,模型是否继续读取设计源或阻塞 readiness,而非放进 non-blocking Planning Recheck 或从 coverage 中省略后 ready;(h) 小型 source-proven PRD 是否不新增 owner 提问且可直接 `final-prd`,单个高风险 gap 是否只问当前最高风险一题并停止,用户 closeout 是否压缩为简短 readiness 元数据。结果写入 `docs/validation/spec-prd/fresh-source-eval-2026-06-24-clarification-evidence.md`。
6. **fresh-source closeout policy**:`fresh_source_eval.status=passed|concerns` 才能满足行为验证类 Completion Criteria;`not_run` 只能完成代码/contract/docs 静态部分,并必须把未验证行为列为 residual risk 或 follow-up。宿主缺 dispatch primitive 时按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 记录未执行原因,不得声称通过。
7. **eval 报告配 contract 断言(doc-review feasibility F4):** 在 `tests/unit/spec-prd-contracts.test.js` 新增 `FRESH_SOURCE_EVAL_CLARIFICATION_EVIDENCE_PATH` 路径常量 + 断言其 `schema_version` / `producer` / `authority_level` / `reason_code` / `status` / 关键 `source_paths`,与既有 5 份 fresh-source eval 报告断言模式一致,防止报告日后静默漂移或被删。
8. CHANGELOG 按仓库格式追加条目(作者读 `~/.spec-first/.developer`,user-visible 追加标记);`docs/05-用户手册/22-PRD需求文档质量增强流程.md` 必须同步用户可见行为说明。

---

## Sequencing

```text
U1(字段) ─┬─> U2(写前门槛 + fallback,依赖字段)
          ├─> U3(readiness 消费,依赖字段) ──┐
          └─> U5(checkpoint/template 收口,依赖 U1/U2/U3)
U4(收窄旁路,独立,可与 U1 并行)
U7(checker 确定性 facts,依赖 U1/U5) ──┬─> U8(readiness/closeout 消费,依赖 U3/U7)
U6(eval 锁,依赖 U1/U2/U3/U5) ────────┘(U6 可与 U7/U8 后并行,锁全部新行为)
```

最小落地集:U1 → U2 → U4 → U3 → U5 → U7 → U8 → U9 → U6。U7 不改 exit code,但不再可选——它产出 U8 消费的确定性触发信号;U8 是 prose 强约束 + checker finding + fresh-source eval 观测,不是宿主级 hard gate;U9 是 owner 决策的轻量 reason-then-act 纪律(纯 prose,复用既有字段,依赖 U1,与 U2/U7/U8 协同),放在 U6 锁定前落地;U6 最后锁住全部新行为(含 headless 滥用、large-input 优先级翻转、PRD-owned nonblocking、Figma unread/omitted、核心声明省略、reason-then-act 抽验)。

---

## Completion Criteria

- U1–U9 落地,contract test 全绿(case 数 +7),`run-evals.js` passed,checker 新确定性 facts 有单测覆盖(含 bullet-list、核心声明省略、term-only/空值、design-source coverage 缺失触发 case)。
- **U9 reason-then-act 纪律成立**:SKILL Core Principles 含 `先规划后执行` 轻量原则 + owner question / PRD write / readiness / handoff 对应字段映射 + 「复用既有字段、不新增阶段状态枚举」边界声明 + route-out/bypass/source-proven 不套 ceremony 的排除句;contract test 锁这些锚点,fresh-source eval 抽验输出中是否先呈现关键决策。不得声称已证明真实 temporal order。
- readiness lens 对「零交互 + 未决」输入不再返回 ready-for-planning(fresh-source eval 行为验证),且写前门槛优先输出 `ask-owner-first` 或 `checkpoint-prd`。
- **U8 checker 消费成立**:checker 返回 `clarification_evidence_undeclared` / `write_mode_undeclared` / `can_enter_spec_plan_undeclared` / `design_source_*_undeclared` finding 时,readiness 不 ready 并复述 finding,fresh-source eval 验证模型据此降级而非静默 ready;若 fresh-source eval 未运行,只能记录 residual risk,不得声称行为通过。
- 普通 Codex no blocking-question 工具场景不被当作 true headless;必须 chat fallback 或记录真正不可交互原因;U6 记录 must-fail 示例,fresh-source eval / output-validation fixture 验证模型实际拒绝该行为。
- **large-input 不翻转 ask-owner-first 优先级**:highest_risk_gap 可一题关闭时仍先 ask-owner-first,U6 fixture 验证。
- **PRD-owned 问题不被 non-blocking 化**:会改变 WHAT/验收/数据权威/接口可用性/降级展示/埋点验收/source-of-truth 的 owner question 必须在 PRD 输出中逐一确认、修复完善或阻塞 readiness;不得写进 `Planning Recheck` 后宣称 ready。
- **Figma/design-source 不被 non-blocking 化或省略**:涉及 Figma 的 UI 结构、状态、交互、验收或范围必须在 PRD 输出过程中建立 `design_source_inventory`,读取、校准、映射 write target 并记录 `design_source_coverage`;未读完整时阻塞 readiness,不得把二级页、模块失败态、详情页等未读设计节点写进 `Planning Recheck` 后宣称 ready,也不得从 coverage 中省略后 ready。
- Structured Input Synthesis 收窄不退化(fresh-source eval 正向 case)。
- **反仪式化验收成立**:小型 source-proven PRD 不新增 owner 提问且可直接 `final-prd`;单个高风险 gap 只提出当前最高风险一题并停止;用户 closeout 中内部 Decision Card 字段压缩为简短 readiness 元数据,不把普通 PRD 变成冗长字段填报。
- CHANGELOG 已更新;用户手册已同步;fresh-source eval 报告归档**并配 contract test 断言**(新增 `FRESH_SOURCE_EVAL_CLARIFICATION_EVIDENCE_PATH` 常量 + schema/status/reason_code/source_ref 断言,与既有 5 份报告模式一致)。
- 未手改 generated runtime mirror;closeout 注明需 `spec-first init` 重生成。
- **残余风险已记录并转入 follow-up**:host/CI 级 hard gate(把 checker 接进 pre-handoff/CI)列入 Deferred to Follow-Up Work,带 owner、触发条件和验收口径;本 plan 不假装已硬修复 prose-不被遵守根因。

## Completion Evidence

Completed on 2026-06-24 for `target_repo: spec-first`.

Implemented scope:
- `skills/spec-prd/**` now distinguishes `write_mode`, `question_delivery`, and `clarification_evidence`; adds Pre-Write Closure Gate; consumes checker findings in readiness; tightens source-proven anti-ceremony, checkpoint PRD, PRD-owned owner question, and Figma/design-source coverage boundaries.
- `skills/spec-prd/scripts/check-prd-artifact.js` now reports missing readiness declarations and design-source inventory/read/unread/coverage findings as advisory script-owned facts without changing exit-code semantics.
- `tests/unit/spec-prd-contracts.test.js` and `skills/spec-prd/evals/examples.json` cover clarification skipped, headless abuse, large-input ask-owner priority, PRD-owned nonblocking, Figma unread/omitted coverage, core declaration omission, and thin design-source declarations.
- `docs/05-用户手册/22-PRD需求文档质量增强流程.md`, `CHANGELOG.md`, and `docs/validation/spec-prd/fresh-source-eval-2026-06-24-clarification-evidence.md` were updated.

Verification:
- `node --check skills/spec-prd/scripts/check-prd-artifact.js` passed.
- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand` passed, 26 tests.
- `node skills/spec-prd/scripts/run-evals.js --json` passed, 92 cases.
- `npm run typecheck` passed, 126 files checked.
- `npx jest tests/unit/changelog-format.test.js --runInBand` passed, 2 tests.
- `git diff --check` passed.

Review:
- Multi-agent read-only review was run with Anscombe and Cicero.
- First-pass P1/P2 findings were fixed one by one.
- Final Galileo review reported no P0/P1 and one P2; fixed by keeping `checkpoint-prd` as `write_mode` rather than a `readiness_outcome`.
- Final Chandrasekhar review reported no P0/P1 and one P2; fixed by expanding the fresh-source eval report to eight plan-required behavior checks and locking them in contract tests.

Generated runtime:
- Generated runtime mirrors were not edited.
- Release/runtime refresh, if needed, should use `spec-first init`.
