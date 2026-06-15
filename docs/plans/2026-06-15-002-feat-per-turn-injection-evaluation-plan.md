---
title: "feat: per-turn 状态注入(对标 Trellis)可行性评估与方向决策"
type: feat
status: completed
date: 2026-06-15
target_repo: spec-first
spec_id: 2026-06-15-002-per-turn-injection-evaluation
plan_depth: standard
origin: docs/项目审查/2026-06-15-行业对标研究档案.md
referenced_reviews:
  - path: docs/项目审查/2026-06-15-行业对标研究档案.md
    role: origin
    scope: deferred
    deferred_findings: ["BENCH-borrow-per-turn-injection"]
  - path: docs/项目审查/2026-06-15-项目Review与优化方案.md
    role: origin
    scope: deferred
    deferred_findings: ["P1-per-turn-injection"]
---

# feat: per-turn 状态注入(对标 Trellis)可行性评估与方向决策

> **本 plan 是「决策/评估 plan」,不是直接 build plan。** 它的目标是诚实评估对标 Trellis 的 per-turn 状态注入是否该借、怎么借,并给出方向决策,把 P1 闭环收口为「带理由的决策」而非「硬塞一个借鉴」。这正是角色契约 §7「借鉴对标项目时是否同时引入它牺牲的边界」的一次实地应用。

> **决策结论:DEFERRED(reasoned defer,2026-06-15)。** U1-U4 评估完成。U2 痛点证据检索为空(`docs/solutions/` + `docs/12-bug分析/` 对 context 压缩漂移零命中;origin 自标 advisory),按 U2 证据门与角色契约 §10「能力↔采纳平衡 + aspirational 推进义务」,**不进入开发**。Trellis 式有状态 per-turn 注入因撞 no-state-machine 红线 + Codex 无 per-turn hook 事件,明确**不采纳**;轻量 native 变体(U3)因痛点无证据**暂缓**,非否决。两 origin finding 在 `referenced_reviews` 转 `deferred_findings`。**重启条件:** spec-first 侧累计出现 ≥3 条 confirmed context-drift / workflow-phase 漂移失败记录(落 `docs/solutions/` 或 `docs/12-bug分析/`,标 context-drift 关键词)时重启本评估。这是合法闭环,不是无限期搁置。

## Summary

行业对标档案 §12 把 **per-turn / attention hook 状态注入**(对标 Trellis / pro-workflow / planning-with-files)列为 P1 借鉴项:用 host hook 每轮重注当前 task/phase breadcrumb,抗 context 压缩漂移。规划阶段取证后发现,**直接照搬 Trellis 版本撞两堵墙**:

1. **双宿主不对称(confirmed):** `templates/codex/hooks/hooks.json` 只声明 `SessionStart`;Codex 无 per-turn(UserPromptSubmit)hook。Claude 有。直接做会变成 Claude-only / Codex 降级能力。
2. **与 no-state-machine 哲学冲突(confirmed):** Trellis 的每轮面包屑能工作,是因为它有 `task.json` 状态机存「当前 phase」。spec-first **刻意不存 per-unit 进度**(spec-plan skill 自述「Plans do not carry per-unit progress state — progress is derived from git by spec-work」;角色契约 §3「不画死状态图、进度由 git 派生」)。要每轮注入「当前 phase」,要么逼 spec-first 引入它拒绝的状态机,要么每轮从 git 模糊推断。

**关键正面发现:** spec-first **已有此机制的右尺寸 native 版本**,且不止一处——(a)`templates/claude/hooks/spec-plan-guard` 用 Claude `UserPromptExpansion` 事件,在 `/spec:plan` 展开时注入 best-effort 注意力提醒,**显式声明无硬保护、无状态**(`spec-plan-guard:21` 原文 "best-effort attention reminder only; this hook provides no hard write protection.");(b)`templates/claude/hooks/session-start:50-57` 已有 `startup-reminder --claude` CLI 注入路径,每会话喂 workflow-entry 注意力上下文。这说明 spec-first-native 的「抗漂移注入」形态是:**按命令展开 / 按会话启动注入、无状态、best-effort、诚实降级**——而不是 Trellis 的有状态每轮注入。

**初步推荐(待 U1-U4 评估确认):** 不采纳 Trellis 式有状态 per-turn 注入。**鉴于规划期检索证实痛点证据为空(详见 Direct Evidence / U2)**,按 U2 门与 §10,默认结局是 **带重启条件的 reasoned defer**——而非"倾向采纳变体"。仅当 U2 翻出 confirmed 痛点证据,才触发轻量 native 变体(扩展既有 `UserPromptExpansion` guard 模式到更多 workflow,Claude-only,Codex 经 SessionStart 降级 + 响亮声明)。让排序服从证据门控,不让变体的优雅压过门控——优雅恰是 §10 警惕的 rationalization。

---

## Direct Evidence

- target_repo: spec-first
- source_refs: `templates/codex/hooks/hooks.json`、`templates/claude/hooks/spec-plan-guard`、`templates/claude/hooks/session-start`、`src/cli/claude-settings.js`(hook 注册)、`docs/项目审查/2026-06-15-行业对标研究档案.md`(§3 Trellis、§8 pro-workflow mechanism)、`docs/10-prompt/结构化项目角色契约.md`(§3 no-state-machine、§7 借鉴边界)
- current_revision: leo-2026-06-15-review-all 分支
- worktree_dirty: true
- discovery_methods: 读 hooks.json/spec-plan-guard/session-start source、`grep UserPromptSubmit/UserPromptExpansion/SessionStart`、对标档案
- tests_or_logs: 未跑(评估阶段)
- confidence: 高(两堵墙均 confirmed source 实证;native 先例 confirmed)
- limitations: 「抗 context 压缩漂移」痛点证据**为空,非仅薄**——规划期检索 `docs/solutions/`(约 13 文件)与 `docs/12-bug分析/`(2 文件)对 context 压缩漂移 / attention 漂移 / 忘记 phase / per-turn **零命中**;且 origin 自身把「spec-first 抗 context 压缩弱」判断标为 **(advisory)**(对标档案 §3 Trellis 领先项),「双宿主 hook 支持差异需验证」列为已知未决风险(对标档案 §12 P1 行)。即此痛点从一开始是对标推断假设,非 spec-first 侧实证。Codex 未来是否新增 per-turn hook 事件未知(advisory:当前 hooks.json 仅 SessionStart)

---

## Context & Research

**对标机制(see origin §3/§8):**
- Trellis:UserPromptSubmit hook 每条用户消息触发,解析 active task status(来自 `.trellis/.runtime/sessions/<key>.json` + task.json)注入 phase 指令。**hook 是 enforcer,不靠 AI 记忆。** 依赖显式 task 状态机。
- pro-workflow:session-start replay + 37 hook,UserPromptSubmit 自动注入 top-3 wiki hit。同样有持久 store。
- planning-with-files:PreToolUse hook 每次工具调用前 `cat task_plan.md | head -30` 进窗口。依赖单一 active plan 文件。

**三者共性:** 每轮/每工具注入都**依赖一个显式的「当前状态」真相源**(task.json / session 文件 / 单一 active plan)。这正是 spec-first 没有、且刻意不要的东西。

**spec-first 现状(confirmed):**
- hook 基建已有:Claude `session-start`(注入 using-spec-first bootstrap + `startup-reminder --claude` 每会话注意力上下文,见 `session-start:50-57`)+ `spec-plan-guard`(`UserPromptExpansion`,/spec:plan 展开时 best-effort 注意力提醒);Codex `session-start`(hooks.json 仅 SessionStart)。
- 无「当前 active workflow/phase」持久状态;进度由 git 派生。
- `spec-plan-guard` + `session-start` 的 `startup-reminder` 是 native 右尺寸先例:无状态、按命令展开 / 按会话启动、显式 best-effort、no hard protection。

**§7 边界判断:** 直接借 Trellis 版会同时借入它牺牲的边界(必须有 task 状态机)。这是教科书级的「借能力连边界一起借进来」。轻量 native 变体(扩展 UserPromptExpansion guard)不引入状态机,因此不牺牲边界。

---

## Goals / Non-Goals

**Goals:**
- 给出明确方向决策:采纳轻量 native 变体 / 带理由 defer(以证据决定,不预设)。
- 把决策与理由落盘,使 P1 finding 闭环可追踪(addresses_findings)。
- 若决策为「做」,给出轻量变体的 implementation units(条件性)。

**Non-Goals:**
- 不引入 task/phase 持久状态机(角色契约红线)。
- 不做 Codex 端 per-turn 注入(当前 host 能力不支持;不为对称性伪造)。
- 不在本 plan 内实现(评估 plan;实现待决策为「做」后由 spec-work 承接)。
- 不照搬 Trellis/pro-workflow 的持久 store / 多 hook 体系。

---

## 评估单元(Evaluation Units)

> 这些是**评估/决策**单元,不是 build 单元。每个单元产出一个判断,汇总成 U4 的方向决策。

### U1. 确认双宿主能力边界与降级形态

**Goal:** 钉死「per-turn 注入在双宿主上各能做到什么」。
**Files(只读):** `templates/codex/hooks/hooks.json`、`templates/claude/hooks/*`、`src/cli/claude-settings.js`、`src/cli/adapters/codex.js`
**Approach:** 确认 Claude 可用事件(UserPromptSubmit / UserPromptExpansion)、Codex 当前仅 SessionStart。产出:能力矩阵 + 若做轻量变体的 Codex 降级声明文案(响亮约定,不静默)。
**Verification:** 能力矩阵有 source 依据;降级形态明确。

### U2. 判定「抗漂移」痛点是否被证据支持

**Goal:** 回答「spec-first 是否真有 context 压缩导致 workflow phase 漂移的高频痛点」。
**Approach:** 检索 docs/solutions、docs/项目审查、docs/12-bug分析 是否有相关失败记录;评估 session-start bootstrap + `startup-reminder`(已每会话注入)是否已大部分覆盖。**若无证据支持痛点,按角色契约 §10 aspirational 推进义务,倾向 defer 而非造能力。**
**规划期已得结论(待 U4 复核):** 证据 = **空**。`docs/solutions/`(约 13 文件)+ `docs/12-bug分析/`(2 文件)对 context 压缩漂移 / attention 漂移 / 忘记 phase / per-turn **零命中**;origin 把痛点标 **(advisory)**。故痛点分级 = **无证据(对标推断假设)**。据此默认走 defer,并设**重启阈值**:当 spec-first 侧出现 **≥3 条** context-drift / workflow-phase 漂移的 confirmed 失败记录(落在 docs/solutions 或 docs/12-bug分析)时,重启本评估。
**覆盖度验证产物(支撑「已覆盖」判断,不可空口断言):** 列出 `session-start` + `startup-reminder` 实际每会话注入的内容 vs Trellis 每轮面包屑覆盖的内容,给出"现有注入已覆盖 X / 未覆盖 Y"的对照,作为 defer 的实证理由之一。
**Verification:** 给出 痛点 confirmed / advisory / 无证据 的分级结论 + 覆盖度对照表 + 重启阈值。

### U3. 设计轻量 native 变体(条件性,仅当 U2 支持)

**Goal:** 若痛点成立,设计不引入状态机的 Claude-only 变体。
**Approach:** 候选 = 扩展 `UserPromptExpansion` guard 模式:在更多公开 workflow 命令展开时,注入该 workflow 的关键边界提醒(无状态,从 SKILL.md/契约静态取,不读「当前进度」)。复用 spec-plan-guard 的 best-effort 声明体例。明确:这是 attention 提醒,非 enforcer,非 gate。
**Files(若实现):** `templates/claude/hooks/`(新增/扩展 guard)、`src/cli/claude-settings.js`(注册)、对应 contract test。
**Verification:** 设计不含任何 per-unit/phase 状态读取;Codex 降级声明就位。

### U4. 方向决策

**Goal:** 汇总 U1-U3,给出 采纳轻量变体 / defer 的最终决策 + 理由,并据此更新本 plan status 与 origin 闭环(addresses_findings 或转 deferred_findings)。
**Approach:** 决策矩阵:痛点证据 × 双宿主代价 × 边界契合度。若 defer,在 review-closure 中把 finding 标 deferred_findings + 重估条件(≥3 条 context-drift 失败记录时重启)。
**§10 推进义务(防 defer 退化为永久免责声明):** defer 不是终点。U4 闭环必须显式回答「痛点证据如何从空变 confirmed」——给出**数据采集路径**:context-drift / workflow-phase 漂移的失败一旦发生,由 `/spec:debug` 或 `/spec:compound` 落盘到 `docs/12-bug分析/` 或 `docs/solutions/`(标注 context-drift 关键词);累计 ≥3 条即触发本评估重启。无此路径,defer 即 §10 警告的「机制就位永久搁置」,不合法。
**Verification:** 决策落盘,P1 闭环状态明确,且 defer 分支带可执行的数据采集路径 + 重启阈值。

**最终决策(2026-06-15):DEFERRED — reasoned defer。**

| 决策维度 | 结论 | 依据 |
|----------|------|------|
| 痛点证据(U2) | **无证据** | `docs/solutions/`(~13 文件)+ `docs/12-bug分析/`(2 文件)对 context 压缩漂移 / attention 漂移 / 忘记 phase / per-turn 零命中;origin 自标 (advisory) |
| Trellis 式有状态注入 | **不采纳(否决)** | 撞 no-state-machine 红线(契约 §3);Codex `hooks.json` 仅 SessionStart,无 per-turn 事件槽(U1) |
| 轻量 native 变体(U3) | **暂缓(非否决)** | 设计成立(扩展 `UserPromptExpansion` guard,无状态),但 U2 痛点无证据,按 §10「无证据则 defer」不进开发 |
| origin 闭环 | **转 deferred_findings** | `referenced_reviews` 两 origin entry `scope: deferred` + `deferred_findings`,plan `status: completed` |

**重启条件:** spec-first 侧累计出现 **≥3 条** confirmed context-drift / workflow-phase 漂移失败记录(经 `/spec:debug` 或 `/spec:compound` 落 `docs/solutions/` 或 `docs/12-bug分析/`,标 context-drift 关键词)时,重启本评估并重跑 U2→U4。届时若证据成立,U3 设计可直接承接 spec-work 实现。

**为何 `status: completed` 而非 `active`:** 本 plan 是评估 plan,其交付物是 U4 决策本身——决策已产出(defer),评估即完成。实现是条件性后续,由重启条件门控,不挂在本 plan 的 active 状态上。

---

## 初步决策倾向(待 U1-U4 确认)

基于规划期已得证据(痛点证据为空),倾向(排序服从 U2 证据门):
1. **不采纳 Trellis 式有状态 per-turn 注入**(撞 no-state-machine 红线 + Codex 不支持)。
2. **默认结局:带重启条件的 reasoned defer**。规划期检索证实抗漂移痛点**无 spec-first 侧证据**(详见 U2),按 §10 aspirational 推进义务,诚实默认是 defer + 记重估条件(≥3 条 confirmed context-drift 失败记录时重启)。这是合法闭环,不是搁置。
3. **仅当 U2 翻出 confirmed 痛点证据** → 才走 U3 轻量 native 变体(扩展 UserPromptExpansion guard,Claude-only + Codex 响亮降级)。这是条件性分支,不是默认。

---

## System-Wide Impact

- **双宿主:** 本质不对称(Codex 无 per-turn hook)。任何实现必须响亮声明降级,不伪造对称。
- **runtime 边界:** 若实现,改 `templates/` + CLI 注册 source,经 `spec-first init` 生成,不手改 mirror。
- **角色契约:** 本 plan 是 §7 借鉴边界判断 + §10 aspirational 推进义务的实地应用,结论须可回链。
- **CHANGELOG:** 决策落盘时需条目(治理决策,docs 层)。

---

## Risks & Anti-Patterns

| 风险 | 缓解 |
|------|------|
| 为「对标有就要补」而引入 task 状态机 | U4 红线:no-state-machine 优先于功能对齐(§3) |
| 为双宿主对称在 Codex 伪造 per-turn | U1 明确降级,响亮声明,不伪造 |
| 痛点无证据仍硬做(造 aspirational 空能力) | U2 痛点门 + §10 推进义务:无证据则 defer |
| 轻量变体悄悄长成 enforcer/gate | U3 复用 spec-plan-guard best-effort 体例,显式非 gate |

---

## 落地顺序

U1(能力边界)→ U2(痛点证据)→ U3(条件性设计)→ U4(决策)。决策为「做」则由 spec-work 承接 U3 实现;为「defer」则更新 review-closure 为 deferred_findings + 重估条件。

## 验证计划

- 评估阶段:source 只读核对(U1-U3)。
- 若实现轻量变体:新增 hook contract test + `spec-first init` 双宿主投射验证 + claude-settings hook 注册测试。

## 闭环

以行业对标档案 + review 报告为 origin。U4 决策后:采纳则推进实现并标 RESOLVED;defer 则在 referenced_reviews 转 deferred_findings 并记重估条件——二者皆为合法闭环。
