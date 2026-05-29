---
title: "feat: spec-brainstorm Requirements Readiness Gate（合并去重落地）"
type: feat
status: completed
date: 2026-05-29
spec_id: 2026-05-29-001-requirements-readiness-gate
---

# feat: spec-brainstorm Requirements Readiness Gate（合并去重落地）

## Summary

把 `spec-brainstorm` 现有 finalization checklist 升级为一个命名的 **Requirements Readiness Gate**（六维 + 轻量预检），同时吸收 2026-05-29 竞品报告的 U2(coverage/inference/handoff)、U3(EARS acceptance 写法)、U4(docs/solutions 触发) 和 4-17 升级方案的 P1.6 preflight 语义,消除"两个落盘前自检机制"撞车,并用 contract test 锁定行为。纯 skill prose + 测试 + CHANGELOG,零脚本、零新文件、零新 schema。

---

## Problem Frame

`spec-brainstorm` 当前的落盘前质量保障散落在三处且存在重复:
- `requirements-capture.md` 的 finalization checklist(**13 条 bullet**,line 213-225;另有引导句与 2 条收口句,prose 形式,无命名、无维度结构);
- `synthesis-summary.md` 的 Stated/Inferred/Out-of-scope 分流(有 inference 纪律,但 checklist 不回指);
- `references/handoff.md` + outstanding-questions guidance 的 `Resolve Before Planning`(有 handoff 阻塞,但 checklist 不列入)。

两份独立优化文档进一步制造了机制重复:2026-05-29 竞品报告提议新增 `requirements-quality-gate.md`(U1),而 2026-04-17 升级方案提议新增 `Phase 3.4 Preflight Self-Check`(P1.6)——二者本质都是 Phase 3 落盘前自检,时序相同;真正的差异是 P1.6 额外捆绑了 scope-sanity,而本 gate 刻意不含。因此合并姿态是 **"P1.6 minus scope-sanity,并入 U1"**,不是纯等价;若各自立项会造出两个并存的自检机制。

本次工作的目标:**用单一命名 gate 收敛这些重复语义,把真空缺(Evidence/Inference provenance、Handoff readiness、Contradiction/Placeholder 预检、EARS 写法、docs/solutions 触发)补齐,且不越界承担 decomposition 判断。**

本计划是 solo `spec-plan` 调用,无 upstream requirements doc;scope 已由本会话的合并去重分析确定并经用户显式确认("先合并去重再做")。origin identity 未继承,使用 plan-local `spec_id`。

---

## Requirements

**Gate 收敛(核心)**
- R1. 将 `requirements-capture.md` 的 `## Finalization checklist`(当前 209-227 行,13 条 bullet)重构为命名的 `## Requirements Readiness Gate`,组织为六个维度;现有 13 条必须逐条可追溯到某维度或显式 `Beyond pass/fail` 子段,不得静默丢弃或语义稀释(见 U1 disposition 表)。
- R2. 六维必须覆盖:Clarity & Non-ambiguity、Evidence & Inference provenance、Traceability & Coverage、Testability、Boundary integrity、Planning-invention & Handoff readiness。
- R3. Gate 顶部包含一个轻量预检段(Placeholder scan + Contradiction scan),吸收 4-17 P1.6 的两条低成本检查。

**真空缺补齐**
- R4. Evidence & Inference provenance 维度显式回指 `synthesis-summary.md` 的 Stated/Inferred/Out-of-scope 分流,要求"未确认 inference 不得伪装成 user-confirmed requirement"。
- R5. Planning-invention & Handoff readiness 维度显式纳入"`Resolve Before Planning` 是否为空"的 handoff check。
- R6. 在 `## Acceptance Examples` 段(当前 49 行/121 行)补 EARS-style 写法触发规则:conditional 用 `When/If ... then ...` 固定条件+结果、always-on 用 observable statement、structural rule 允许非行为句但须写明为何 structural。触发而非强制。

**边界纪律**
- R7. Gate 显式声明 **重量级 decomposition 决策**(是否拆成多个 sub-epic / 多个 plan)不在本 gate 范围,仅保留一行指针。但指针必须指向**现存**的 `## Size heuristics`(requirements-capture.md:196 "If total requirements exceed ~15-20, stop and ask whether this is one brainstorm or several"),而非未落地的 4-17 流程安全线;即:轻量 size-sanity 由现存 Size heuristics 承接,重量级 decomposition 待 4-17 线落地。gate 不做拆分决策,只在 size 异常时提示走 size-sanity。

**Phase 1.1 触发**
- R8. `SKILL.md` Phase 1.1 **Constraint Check** pass(而非 Topic Scan 的"读最相关 artifact"pass)补 `docs/solutions/` 为 Standard/Deep 的检索触发点,范围限定为"prior problem framing 与 decision rationale,不是 implementation steps";复用 SKILL.md 既有 GitNexus 段的护栏措辞"must not let implementation details back-drive user-facing requirements",不另造弱 caveat。

**命名一致性**
- R9.(验证注,非编辑)`SKILL.md` Phase 3(275 行)实际措辞为 "completeness checks",经核实**不含** `finalization checklist` 字面量(`grep finalization` 零命中)。因此 R9 不需要改名编辑;执行时仅确认 Phase 3 措辞与新 gate 名不冲突即可,R10 不为 R9 写断言。

**验证锁定**
- R10. `tests/unit/spec-brainstorm-contracts.test.js` 新增断言。锁定对象优先选 **load-bearing imperative 子句**,而非仅维度 header(header 易被重写而断言仍绿):至少覆盖 gate 标题、六维 header、R4 的"inference 不得伪装 user-confirmed"子句、R5 的"Resolve Before Planning 是否为空"子句、Success-Criteria-coverage 检查仍存在、EARS 三类写法、decomposition 排除声明、`docs/solutions` 触发;并加一条**负面断言**确认旧名 `## Finalization checklist` 已不残留。

**治理**
- R11. `CHANGELOG.md` 追加一条 (user-visible) 记录,作者读 `~/.spec-first/.developer`(当前 `reviewer`)。

---

## Scope Boundaries

- 不新增 reference 文件(U1 的 `requirements-quality-gate.md` 改为升级现有 checklist,避免第 6 个 reference 制造重复)。
- 不实现 U5 technique palette。软件 brainstorm 流的"非显然角度"要求**已存在于 `SKILL.md:235` Phase 2**(inversion / constraint removal / analogy);`universal-brainstorming.md:37-39` 是**非软件**路由的平行证据,不是软件 gate 的主覆盖来源(纠正初版 plan 的引用错误)。
- 不改 `synthesis-summary.md` 与 `handoff.md` 的现有机制(gate 只回指,不重写它们)。
- 不碰 `.claude/`、`.codex/`、`.agents/skills/` runtime mirror(需要 runtime 同步时用 `spec-first init`,不手改)。
- 不引入脚本、schema、状态机;gate 全部是 LLM-owned judgment,由 prose + contract test 守护。

### Deferred to Follow-Up Work

- 4-17 升级方案完整的流程安全线(decomposition 早检测、user review gate、terminal state lock、context pulse):需用户单独决策是否启动,本计划只在 R7 留排除指针,不实现。**若该线未来落地并重新引入 Phase 3.4 Preflight Self-Check,其 Placeholder/Contradiction scan 必须消费本 gate 的预检段,不得重复造第二个自检**(否则重现本计划要消除的撞车)。
- 竞品报告 U7(`spec-plan` downstream consumer prompt/test):跨 workflow contract,等本 gate 形态稳定后再单列。
- fresh-source eval(按 `docs/contracts/workflows/fresh-source-eval-checklist.md`):本计划用 contract test 做静态锁定;行为语义 eval 在 `spec-work` closeout 按宿主能力执行或记录未执行原因。

---

## Graph Readiness

- target_repo: spec-first（当前仓库根）
- status: unavailable
- source_revision: n/a
- current_revision: n/a
- stale: n/a
- primary_providers: none
- degraded_providers: none
- fallback_capabilities: bounded direct repo reads
- runtime_mcp_evidence: unavailable
- confidence: high
- limitations: 纯 skill-prose + 测试 + docs 变更,不涉及 code/architecture/cross-module impact,无需 graph 证据;本会话已直接读取全部 4 个编辑目标 source 与 plan-template,证据来自 source reads。

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-brainstorm/references/requirements-capture.md`(编辑目标①):209-227 行 finalization checklist(13 条 bullet);49/121 行 Acceptance Examples;196 行 Size heuristics;200-202 行 visual guidance。
- `skills/spec-brainstorm/SKILL.md`(编辑目标②):158 行 Constraint Check pass(R8 落点);160 行 Topic Scan;275 行 Phase 3(措辞为 "completeness checks",**不含** finalization checklist 字面量)。
- `skills/spec-brainstorm/references/synthesis-summary.md`:Stated/Inferred/Out-of-scope 三桶 + headless 路由(R4 回指目标,不修改)。
- `skills/spec-brainstorm/references/handoff.md`:`Resolve Before Planning` 阻塞逻辑(R5 回指目标,不修改)。
- `tests/unit/spec-brainstorm-contracts.test.js`(编辑目标③):现有 8 个 grep-assertion 断言,新断言严格 mirror 此 `expect(text).toContain(...)` 风格(含既有 `.not.toContain` 负面断言)。
- `skills/spec-brainstorm/SKILL.md:235`:Phase 2 已要求"非显然角度"(inversion/constraint removal/analogy)——软件流技法覆盖来源(证明 U5 重复,不实现)。
- `skills/spec-brainstorm/references/requirements-capture.md:196`:既有 `## Size heuristics` 含 "exceed ~15-20, stop and ask" 轻量 size-sanity(R7 指针目标)。

### Institutional Learnings

- `docs/solutions/` 存在(R8 触发点真实)。本计划把它接入 brainstorm 的 Constraint Check pass,形成自洽。
- **4-17 升级方案的落地状态有记录与源码冲突**:`docs/plans/2026-04-17-001-feat-spec-brainstorm-capability-upgrade-plan.md` 标 `status: completed` 且带 Completion Note,但当前 source 已核实**完全无其特性**(SKILL.md 无 decomposition/preflight/terminal-lock 锚点、无 `decomposition-capture.md`、contract test 仅 8 条通用断言)→ 说明 4-17 之后发生过未记录的 revert/rebuild。本计划据此把该特性线视为 **"源码中不存在"**,而非"从未尝试";R7 的排除指针因此指向**现存**的 Size heuristics(line 196),不指向已 revert 的 4-17 vapor。

### External References

- 不使用。本工作是仓库内 skill 治理,有强本地 pattern(现有 checklist + 测试断言风格),无 high-risk 层,无需外部研究。

---

## Key Technical Decisions

- **升级而非新建文件**:U1 提议的 `requirements-quality-gate.md` 改为重构现有 checklist。理由:新文件会与现有 13 条 checklist 内容重叠,违背 Light contract;命名 gate 的价值在"维度结构 + 回指",不在"独立文件"。
- **U1 = P1.6 minus scope-sanity 合并**:两者都是 Phase 3 落盘前自检,时序相同;唯一实质差异是 P1.6 捆绑了 scope-sanity 而本 gate 刻意不含。合并为单一 gate,吸收 P1.6 的 Placeholder/Contradiction 轻量预检,排除其 scope-sanity(见 R7)。措辞上不宣称"同一机制两个名字",以保留这一可审计的 delta。
- **decomposition 排除出 gate**:重量级拆分判断放进 readiness gate 会让 gate 同时承担"需求是否就绪"和"需求是否该拆"两种正交判断,违背单一职责。gate 只留指针,且指针指向**现存** Size heuristics(line 196)承接轻量 size-sanity——避免 dual exclusion+deferral 造成 size-sanity 无 owner。
- **U3 落在 Testability 维度**:EARS 写法本质是"行为可测性"约束,自然归入 Testability,不单列章节,降低 prose 膨胀。
- **U6 收窄为 contract 断言,且锁短语不等于锁行为**:不建 fixtures harness;static grep-assertion 只能锁定**关键短语的存在性**,不证明语义未漂移(故 R10 优先锁 imperative 子句而非 header,并加负面断言)。行为级置信依赖 deferred 的 fresh-source eval,不被静态断言替代。符合 80/20。
- **author=reviewer**:读 `~/.spec-first/.developer`,非硬编码。

---

## Open Questions

### Resolved During Planning

- 是否新开 reference 文件? → 否,升级现有 checklist(见 Key Technical Decisions)。
- decomposition 是否进 gate? → 否,排除 + 留指针(R7)。
- EARS 是否强制? → 否,触发规则(R6)。

### Deferred to Implementation

- gate 六维的最终中文措辞与排序:执行时按现有 13 条 checklist 逐条归维(见 U1 disposition 表),确保可追溯后定稿;属 prose 细节,不影响计划结构。
- 新增 contract 断言的精确 `toContain` 字符串:执行顺序硬约束——**必须先完成 U1-U3 prose 落盘并在文件上确认目标短语,再写断言**,不允许在 prose 未定稿前写非占位断言(避免断言锁到未定稿文本)。
- tier-conditional 检查(现有 #5/#6/#7/#9 带 "At Deep-product tier" / "If Actors are named" 前缀)归维时保留其条件修饰语原文,以 sub-bullet 或 inline 条件存放,不拍平成无条件断言。

---

## Implementation Units

### U1. 重构 finalization checklist 为命名 Requirements Readiness Gate(六维 + 预检)

**Goal:** 把 `requirements-capture.md` 209-227 行的 finalization checklist(13 条 bullet)升级为 `## Requirements Readiness Gate`,六维结构,现有 13 条逐条可追溯,不静默丢弃或语义稀释。

**Requirements:** R1, R2, R3, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-brainstorm/references/requirements-capture.md`

**Approach:**
- 将 `## Finalization checklist` 标题改为 `## Requirements Readiness Gate`,保留 `Before finalizing:` 引导语义。
- **13 条 → 六维 disposition 表(执行时逐条对照,确保无孤儿):**

  | # | 现有 checklist item(line) | 归宿 |
  |---|---|---|
  | 1 | spec-plan 还要 invent 什么(213) | Planning-invention & Handoff readiness |
  | 2 | observable behavior 或 structural 理由(214) | Testability |
  | 3 | Success Criteria 覆盖 human + downstream handoff(215) | **Testability**(作为"成功标准可观测/可交接"独立项,保留原句,不并入 R5 handoff) |
  | 4 | Actors 都被某 R/flow/boundary 引用(216) | Traceability & Coverage |
  | 5 | Key Flows 有 actor/trigger/outcome/escape(217,tier-cond) | Traceability & Coverage(保留条件修饰) |
  | 6 | Deep-product Flows 省略写理由(218,tier-cond) | Boundary integrity(保留条件修饰) |
  | 7 | Deep-product Scope 三类拆分(219,tier-cond) | Boundary integrity(保留条件修饰) |
  | 8 | R 依赖 out-of-scope(220) | Boundary integrity |
  | 9 | 未决项是 product decision 还是 planning question(221) | Planning-invention & Handoff readiness(条件修饰) |
  | 10 | implementation detail leak(222) | Boundary integrity |
  | 11 | infra-absent 必须 verify(223) | Boundary integrity(兼 Evidence) |
  | 12 | 低成本改进(224) | **`Beyond pass/fail` 子段**(改进机会,非 pass/fail 维度) |
  | 13 | visual aid 是否有帮助(225) | **`Beyond pass/fail` 子段**(建议触发;注意 line 200-202 已有 visual guidance,避免重复指针) |

  - Clarity & Non-ambiguity 维度吸收"是否存在足以让 plan 做出两种相反实现的模糊"(原 checklist 未显式,新增,来自 P1.6 Ambiguity 语义)。
- 顶部加轻量预检小段:Placeholder scan(TODO/TBD/占位)、Contradiction scan——**范围限定为"同文档内字面矛盾"**(如某 R 与同文档 Scope Boundary 直接冲突),不做"这组需求是否该存在"的 scope-sanity 判断,以与 R7 边界清晰。
- 末尾保留 `If planning would need to invent product behavior...` 收口句 + `Ensure docs/brainstorms/ directory exists`。
- 加一行 R7 排除声明,指针指向现存 Size heuristics:例如 *"Whether requirements should be **decomposed** into sub-epics/multiple plans is out of this gate's scope; lightweight size-sanity lives in `## Size heuristics` above, and heavyweight decomposition awaits the separate process-safety line."*

**Patterns to follow:**
- 现有 checklist 的 bullet + 问句风格;维度用 bold inline header(与 requirements-capture.md 现有 `**Group header**` 风格一致)。

**Test scenarios:**
- Happy path: gate 标题 `## Requirements Readiness Gate` 存在;六维 header 字符串各自存在。
- Edge case: 现有关键检查不丢失——`infrastructure is absent` verify 句、`invent product behavior` 收口句、Success-Criteria-coverage 句、visual-aid 句仍存在。
- Edge case: R7 排除声明字符串存在且含 `Size heuristics` 指针;`decomposition` 关键词存在。
- 由 U4 统一实现断言。

**Verification:**
- `requirements-capture.md` 含命名 gate 与六维 + `Beyond pass/fail` 子段;旧 `## Finalization checklist` 标题不再残留(U4 负面断言守护);13 条逐条可追溯到 disposition 表归宿。

---

### U2. 补 Evidence/Inference provenance 与 Handoff readiness 真空缺(回指现有机制)

**Goal:** 在 gate 内补两条此前缺失的检查:inference 分流回指、handoff 空检查。

**Requirements:** R4, R5

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-brainstorm/references/requirements-capture.md`

**Approach:**
- Evidence & Inference provenance 维度:加一句回指 `synthesis-summary.md` 的 Stated/Inferred/Out-of-scope,显式要求"未确认 inference 不得伪装成 user-confirmed requirement"。
- Planning-invention & Handoff readiness 维度:加一条"`Resolve Before Planning` 是否为空;非空则继续 brainstorm、转 assumption,或显式记录用户带风险继续"(回指 handoff/outstanding-questions guidance,不重写它们)。

**Patterns to follow:**
- 现有 outstanding-questions guidance(requirements-capture.md 末段)的措辞;synthesis-summary.md 的三桶命名。

**Test scenarios:**
- Happy path: gate 含 `synthesis` 回指 + `Resolve Before Planning` handoff check 字符串。
- 由 U4 统一实现断言。

**Verification:**
- gate 的 provenance 维度提及 inference 不得伪装 user-confirmed;handoff 维度提及 Resolve Before Planning 空检查。

---

### U3. Acceptance Examples 段补 EARS-style 写法触发规则

**Goal:** 在 `## Acceptance Examples`(121 行)与其触发说明(49 行)补 EARS 写法纪律,落在 Testability 维度的可测性约束下。

**Requirements:** R6

**Dependencies:** None(与 U1/U2 同文件,执行时合并编辑)

**Files:**
- Modify: `skills/spec-brainstorm/references/requirements-capture.md`

**Approach:**
- 在 Acceptance Examples 段补三类触发规则:
  - conditional behavior → `When/If ... then ...` 或 Given/When/Then,固定条件与结果;
  - always-on behavior → 简洁 observable statement;
  - structural/governance rule → 允许非行为句,但须写明为何 structural。
- 明确"目标是减少歧义,不是把中文需求改造成英文语法练习";触发而非强制。
- 与现有 49 行"behavioral-conditional requirements...When X,Y/If X,Y"衔接,不重复。

**Patterns to follow:**
- 现有 49 行 behavioral-conditional 措辞;触发式(非强制)风格与 skill 其余 optional 规则一致。

**Test scenarios:**
- Happy path: 文本含 `When/If` then 写法 + always-on observable + structural 三类提示。
- 由 U4 统一实现断言。

**Verification:**
- Acceptance Examples 段含 EARS 三类写法触发规则,且明示非强制。

---

### U4. SKILL.md 接入 docs/solutions 触发 + gate 命名一致 + 新增 contract 断言

**Goal:** Phase 1.1 Constraint Check pass 补 `docs/solutions/` 触发;确认 Phase 3 措辞不与新 gate 名冲突(R9 验证注,非编辑);`spec-brainstorm-contracts.test.js` 新增断言锁定 U1-U3 + R8。

**Requirements:** R8, R9, R10

**Dependencies:** U1, U2, U3(断言必须匹配最终落盘 prose;先 prose 定稿再写断言)

**Files:**
- Modify: `skills/spec-brainstorm/SKILL.md`
- Modify: `tests/unit/spec-brainstorm-contracts.test.js`
- Test: `tests/unit/spec-brainstorm-contracts.test.js`

**Approach:**
- SKILL.md Phase 1.1 **Constraint Check** pass(158 行一带,非 160 行 Topic Scan 的"读 artifact"pass)补 `docs/solutions/`:范围限定"prior problem framing 与 decision rationale,不是 implementation steps";复用既有 GitNexus 段护栏措辞 "must not let implementation details back-drive user-facing requirements"。
- SKILL.md Phase 3(275 行)**经核实不含 `finalization checklist` 字面量(grep 零命中)**,故 R9 无改名编辑;仅确认 "completeness checks" 措辞与新 gate 名不冲突即可,**不为 R9 写断言**。
- 测试新增 test(锁 imperative 子句优先于 header,降低脆性):
  - `requirements readiness gate exists with six dimensions`:断言 gate 标题 + 六维 header 字符串。
  - `gate preserves load-bearing checks`:断言 `Success Criteria cover both human outcome`、`infrastructure is absent`、`invent product behavior`、visual-aid 句仍存在(F2 防静默丢失)。
  - `gate carries provenance and handoff checks`:断言 R4 imperative 子句(`inference` 不得伪装 user-confirmed)+ `Resolve Before Planning` handoff check。
  - `acceptance examples carry EARS guidance`:断言 When/If-then + always-on observable + structural 三类。
  - `gate excludes decomposition with size-heuristic pointer`:断言含 `decomposition` 排除 + `Size heuristics` 指针。
  - `gate replaces old finalization checklist name`:**负面断言** `expect(text).not.toContain('## Finalization checklist')`(F6)。
  - `constraint check triggers docs/solutions`:断言 SKILL.md 含 `docs/solutions`。
- 断言字符串以 U1-U3 最终落盘的稳定短语为准;优先锁 imperative 子句,不只锁 header。

**Patterns to follow:**
- 测试文件现有 `const X = fs.readFileSync(PATH,'utf8'); expect(X).toContain(...)` 与 `.not.toContain(...)` 风格,严格 mirror;复用已定义的 `REQUIREMENTS_PATH` / `SKILL_PATH` 常量。

**Test scenarios:**
- Happy path: `npm run test:unit` 通过,新断言全绿。
- Edge case: 断言短语与落盘 prose 完全一致(执行时若不一致,改 prose 锚点或断言至匹配,不放宽断言到无意义 substring)。
- Edge case: 负面断言确认旧 `## Finalization checklist` 名已不残留。
- Integration: 现有 8 个断言不回归(尤其 `requirements template uses Summary and Assumptions` 的 `.not.toContain('-> current host')` 仍绿——gate 排除声明不得引入 backtick 命令短语)。

**Verification:**
- `npm run test:unit` 全绿;SKILL.md Constraint Check 含 docs/solutions;新断言确实读取磁盘 source(非缓存);旧 gate 名负面断言通过。

---

### U5. CHANGELOG 与文档治理

**Goal:** 按仓库格式追加 CHANGELOG (user-visible) 记录;评估 README/docs 是否需同步。

**Requirements:** R11

**Dependencies:** U1, U2, U3, U4

**Files:**
- Modify: `CHANGELOG.md`

**Approach:**
- 顶部追加一条:`- v1.8.2 YYYY-MM-DD HH:MM:SS reviewer: feat(brainstorm): 将 spec-brainstorm finalization checklist 升级为命名 Requirements Readiness Gate(六维+预检),合并 5-29 报告 U1 与 4-17 P1.6 落盘前自检,补 Evidence/Inference provenance、Resolve-Before-Planning handoff check、EARS acceptance 写法与 Placeholder/Contradiction 预检,排除 decomposition 越界判断,Phase 1.1 Topic Scan 接入 docs/solutions,新增 contract 断言锁定 (user-visible)`
- 作者读 `~/.spec-first/.developer`(reviewer);时间戳执行时生成。
- README 评估:本变更是 skill 内部质量纪律,非用户直接可见 CLI 行为变化 → README 大概率无需改;执行时确认,若需则补 `docs/`。

**Patterns to follow:**
- CHANGELOG 现有 `- v版本号 YYYY-MM-DD HH:MM:SS 作者: 摘要 (user-visible)` 格式。

**Test scenarios:**
- Test expectation: none -- CHANGELOG/docs 治理变更,无行为可测;由 review 人读确认格式。

**Verification:**
- CHANGELOG 顶部有新记录,格式与现行一致,作者=reviewer,带 (user-visible)。

---

## System-Wide Impact

- **Interaction graph:** 仅影响 `spec-brainstorm` 自身 Phase 3 落盘行为;synthesis/handoff 机制被回指但不改动。
- **Error propagation:** 无运行时;prose 变更不引入失败路径。
- **State lifecycle risks:** 无状态;不写 runtime mirror。
- **API surface parity:** 双宿主——source 在 `skills/`,Claude/Codex runtime 由 `spec-first init` 从 source 生成;本计划不手改 mirror,无 parity 风险。
- **Integration coverage:** contract test 锁定 prose;现有 8 断言防回归。
- **Unchanged invariants:** WHAT-before-HOW 边界、one-question-at-a-time、Light contract、source/runtime 边界全部不变;gate 是 LLM-owned judgment,不引入脚本语义判断。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 重构 13 条 checklist 时静默丢失/稀释检查项(尤其 Success-Criteria-coverage、低成本改进、visual-aid 三条无自然维度归宿) | U1 disposition 表逐条归维 + `Beyond pass/fail` 子段承接非 pass/fail 项 + U4 断言 infra-verify、invent-product、Success-Criteria-coverage、visual-aid 四句仍存在 |
| "锁短语 ≠ 锁行为":header 被重写而断言仍绿,governance intent 漂移 | R10 优先锁 imperative 子句而非 header + 旧名负面断言;行为级置信归 deferred fresh-source eval,plan 不过度宣称静态锁能证明语义 |
| 新断言字符串与落盘 prose 不一致致测试脆 | U4 硬序:先 prose 落盘确认目标短语再写断言;不放宽到无意义 substring |
| gate 越界承担 decomposition;或 dual exclusion+deferral 致 size-sanity 无 owner | R7 排除重量级 decomposition 但指针指向**现存** Size heuristics(line 196)承接轻量 size-sanity;Contradiction scan 限"同文档字面矛盾" |
| 误判 4-17 方案状态(记录 completed 但源码已 revert) | 本会话核实源码无其特性 → 视为"源码不存在";Institutional Learnings 记录 revert 事实;Deferred 注明未来 re-land 必须消费本 gate 预检,不重复造自检 |
| 手改 runtime mirror | Scope Boundaries 明令禁止;需同步用 `spec-first init` |

---

## Documentation / Operational Notes

- `CHANGELOG.md` 必改(R11)。
- README/README.zh-CN:预判无需改(内部质量纪律,非 CLI 行为),执行时确认。
- runtime 同步:source 改后如需刷新 `.claude/`/`.codex/`,用 `spec-first init`,不在本计划范围手动执行。
- 验证命令(执行时):`npm run test:unit`(必跑)、`npm run lint:skill-entrypoints`(确认 entrypoint governance 未漂移)。

---

## Sources & References

- Origin document: 无(solo plan);scope 源自本会话合并去重分析 + 2026-05-29 竞品报告 `docs/01-需求分析/brainstorm优化/2026-05-29-spec-brainstorm-竞品调研与质量提升报告.md` 与 2026-04-17 `docs/01-需求分析/brainstorm优化/spec-brainstorm-能力升级方案.md`
- Related code: `skills/spec-brainstorm/references/requirements-capture.md`、`skills/spec-brainstorm/SKILL.md`、`tests/unit/spec-brainstorm-contracts.test.js`
- Template: `skills/spec-plan/references/plan-template.md`
