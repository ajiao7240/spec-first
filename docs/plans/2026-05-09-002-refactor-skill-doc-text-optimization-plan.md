---
title: "技术方案：spec-plan 与 spec-code-review 执行质量优化"
type: archive
status: superseded
created: 2026-05-09
archived_at: 2026-06-14
archive_reason: "legacy plan-status backfill; retained as historical evidence only, not an active implementation plan"
---
# 技术方案：spec-plan 与 spec-code-review 执行质量优化

> Lifecycle: historical plan archive. This document is retained as historical evidence only and is not an active implementation plan.

Created: 2026-05-09
Revised: 2026-05-09

## 背景与分析

### 当前质量评估（7/10）

两个 skill 的核心架构正确：Phase/Stage 编号系统、表格枚举规则、STOP 指令、references/ 按需加载模式都属于业界最佳实践。

主要问题不是"太长"，而是"关键信号不够突出"：

| 维度 | 评分 | 瓶颈 |
|------|------|------|
| 结构有效性 | 8/10 | 良好 |
| 信噪比 | 6/10 | 低频规则与高频规则视觉权重相同 |
| 跨宿主兼容性 | 7/10 | Claude-first 描述增加 Codex 噪声 |
| 防御性规则有效性 | 5/10 | 缺少 negative examples，信号不够强 |

### 为什么不做纯文案压缩

1. LLM 对结构化 workflow prompt 的遵循率取决于指令信号强度，而非绝对长度
2. 从 960 行减到 880 行（8%）不会改变执行行为
3. 重复关键规则是 prompt engineering 推荐做法（reinforcement）
4. 压缩解释性文字可能降低 LLM 对规则意图的理解
5. Shell 脚本去重和 routing 描述压缩有引入回归的风险

### Claude 与 Codex 特性差异

| 特性 | Claude | Codex |
|------|--------|-------|
| 强信号响应 | STOP/CRITICAL/NEVER 效果好 | 结构化格式（decision tree）效果更好 |
| 条件分支 | 自然语言条件遵循率较高 | 需要 if/else 或 decision tree 格式 |
| 长 prompt 注意力 | 中间部分衰减较轻 | 对结构化标记依赖更强 |
| Tool use | ToolSearch pre-load 是 Claude-specific | spawn_agent 无需 pre-load |
| 解释性文字 | 帮助理解意图，不需要删除 | 同样有帮助，但更依赖结构 |

### 真正影响执行质量的因素（按影响力排序）

1. 关键指令的信号强度（STOP/CRITICAL/decision tree）
2. 流程结构的清晰度（phase 边界、编号系统）
3. 判断规则的无歧义性（decision tree > prose 条件）
4. Negative examples 的具体性（具体错误示例 > 抽象禁止）
5. 低频规则的条件前缀（让 LLM 在不相关场景快速跳过）
6. Prompt 长度（影响最小）

## 目标

通过强化信号、增加 negative examples、增加 self-check、结构化路由逻辑来提升执行质量。

衡量标准：
- 关键判断点的遵循率提升
- 常见错误模式的发生率降低
- Phase 间转换的完整性提升

## 约束

- 不拆分文件、不新建 references/
- 不改变 phase 路由逻辑和判断条件
- 不改变 skill 的外部调用接口
- 可以增加少量行数
- 不去重 reinforcement（重复是有意的）

---

## 优化清单

### 类别 A：增加 Negative Examples（最高 ROI）

#### A1. spec-plan Phase 0.1 deepen intent 误判（+6 行）

最高频错误：LLM 把普通编辑请求误判为 deepening。

在 Phase 0.1 deepen intent 段落后新增：
```
**Routing mistakes to avoid:**
- X "strengthen the risk section" -> triggers deepening
  Correct: names specific section -> normal resume flow
- X "plan the auth feature" -> triggers deepening
  Correct: new planning request -> Phase 0.2
- X "deepen the requirements doc" -> enters plan deepening
  Correct: targets requirements not plan -> clarify with user
```

#### A2. spec-plan Phase 0.1b domain classification 误路由（+5 行）

高频错误：LLM 把 software 任务误路由到 universal-planning。

在 Phase 0.1b 后新增：
```
**Routing mistakes to avoid:**
- X "Plan a database migration" -> universal-planning
  Correct: references database/code -> software, Phase 0.2
- X "Plan the API redesign" -> universal-planning
  Correct: references API/architecture -> software
- OK "Plan a team offsite" -> genuinely non-software -> universal-planning
```

#### A3. spec-code-review Stage 2 intent quality（+8 行）

高频错误：intent summary 过于泛化或过于具体。

在 Stage 2 intent discovery 的 "write a 2-3 line intent summary" 后新增：
```
**Intent quality — mistakes to avoid:**
- X "Various improvements to the authentication module" (too vague, reviewers can't calibrate)
- X "Add line 42 to orders_controller.rb calling Account.find" (restates diff, no goal)
- OK "Simplify tax calculation by replacing multi-tier rate lookup with flat-rate.
     Must not regress tax-exempt edge cases." (goal + constraint)
- OK "Add IDOR protection to account endpoints. All lookups must verify ownership
     before returning data." (security goal + success criterion)
```

#### A4. spec-code-review After-Review Step 5 无变更时问 push（+7 行）

最明显的执行错误：LLM 在没有 fix 时仍然问 "push fixes?"。

在 Step 5 "The gate is total fixes applied" 段落前新增：
```
**CRITICAL — Step 5 gate (decision tree):**

  fixes_applied_count > 0?
  |-- YES -> offer next steps (push/PR/exit)
  |-- NO  -> STOP here. Do not ask "push fixes?" Nothing changed. Exit after report.

Mistake to avoid: asking "push these changes?" after user chose option D (Report only)
and no safe_auto fixes were applied. There are no changes to push.
```

---

### 类别 B：结构化路由逻辑（对 Codex 特别有效）

#### B1. spec-plan Phase 0 路由改为 decision tree（+10 行，替换现有 prose）

当前 Phase 0 的路由逻辑散布在 0.1/0.1b/0.4/0.5/0.6/0.7 各段中，LLM 需要读完所有段落才能确定路由。对 Codex 来说，一个集中的 decision tree 比分散的 prose 条件更容易遵循。

在 Phase 0 标题后、0.1 之前新增路由概览：
```
**Phase 0 routing (read this first, then execute the matching branch):**

  User references existing plan?
  |-- YES + "deepen" keyword -> 5.3 Confidence-first (interactive mode)
  |-- YES + normal edit -> read plan, revise in place
  |-- NO -> continue below

  Task domain?
  |-- Non-software -> references/universal-planning.md (skip all phases)
  |-- Ambiguous -> ask user
  |-- Software -> continue to 0.2

  Upstream requirements doc found?
  |-- YES -> 0.3 (use as primary input)
  |-- NO -> 0.4 (planning bootstrap)

  Blocking questions remain?
  |-- YES -> 0.5 (resolve or assume)
  |-- NO -> 0.6 (assess depth) -> 0.7 (scope summary if guards pass) -> Phase 1
```

这不替换现有的详细描述——它是一个"先读概览再执行细节"的导航层。

#### B2. spec-code-review Mode 行为约束改为 decision matrix（+0 行，重组现有内容）

当前 4 种 mode 的核心约束散布在 Mode Detection 段落的各个子节中。将核心约束集中为一个 matrix，放在 Mode Detection 表格之后：

```
**Mode behavior matrix (quick reference):**

| Constraint | interactive | autofix | report-only | headless |
|-----------|-------------|---------|-------------|----------|
| Ask user questions | YES | NO | NO | NO |
| Switch checkout | YES | YES | NEVER | NEVER |
| Write files | YES | YES (safe_auto only) | NEVER | YES (safe_auto only) |
| Write run artifacts | YES | YES | NEVER | YES |
| Commit/push/PR | after Step 5 | NEVER | NEVER | NEVER |
| Re-review rounds | YES (bounded) | YES (bounded) | NO | NO (single pass) |
```

这不删除现有的详细 mode rules——它是一个快速参考层，帮助 LLM 在执行任何 stage 时快速确认当前 mode 的约束。

---

### 类别 C：Self-Check 和 Checkpoint（减少跳步）

#### C1. spec-plan Phase 1 到 Phase 2 研究完整性 checkpoint（+6 行）

高频问题：LLM 研究不充分就开始写 plan。

在 Phase 1.4 Consolidate Research 末尾新增：
```
**CHECKPOINT before Phase 2:**
- Can you name 2+ existing files/patterns the plan will follow? If not, research incomplete.
- Do you know test file paths for the affected area? If not, search now.
- If external research was skipped, can you justify why local patterns suffice?
Do not proceed to Phase 2 until the first two checks pass.
```

#### C2. spec-code-review Stage 6 format pre-render gate（+4 行）

高频问题：findings 渲染为 prose 而非 table。当前检查在 Stage 6 末尾（Quality Gates），但 LLM 已经渲染完毕。移到 Stage 6 开头作为 pre-render gate。

在 Stage 6 "Assemble the final report" 之前新增：
```
**STOP — verify format before rendering:**
Findings MUST use pipe-delimited tables: | # | File | Issue | Reviewer | Confidence | Route |
Freeform text blocks, numbered lists, or HR-separated sections are WRONG. Reformat.
```

---

### 类别 D：信号强度强化（CRITICAL 标记）

#### D1. spec-plan Phase 5.1 最常跳过的检查项（+0 行，修改现有内容）

在现有 checklist 的 3 项前增加 CRITICAL 前缀：

```
- **CRITICAL:** Each feature-bearing unit has test scenarios. Blank = incomplete.
- **CRITICAL:** If from requirements doc, scan every origin section — nothing silently dropped.
- **CRITICAL:** U-IDs unique, stable, no renumbering across edits.
```

#### D2. spec-code-review Stage 5 step 7 和 step 9（+0 行，修改现有内容）

```
7. **CRITICAL — Confidence-first gate.** Suppress below anchor 75. P0 at 50+ survives.
   Runs AFTER steps 2-3 (dedup + promotion). Do not gate before promotion.

9. **CRITICAL — Sort and number.** Monotonic # across FULL primary set. Stable across
   all sections. NEVER restart numbering per severity table.
```

#### D3. spec-code-review Headless termination contract（+4 行）

```
**CRITICAL — Headless termination:**
- LAST line MUST be exactly: `Review complete`
- Nothing follows. Callers parse programmatically. Deviation breaks contract.
- Degraded: emit reason line, then `Review complete` on next line.
```

---

### 类别 E：低频规则条件前缀（减少噪声）

#### E1. spec-plan Graph Readiness 段落增加条件前缀（+1 行）

当前 Phase 1.1a 的 40 行 Graph Readiness 规则对 95% 的调用无关。增加条件前缀让 LLM 快速判断是否需要执行：

在 Phase 1.1a 标题后第一行新增：
```
**Skip this section if:** the project is a single Git repo with no `.spec-first/graph/` directory.
```

#### E2. 两个 skill 的 workspace/multi-repo 规则增加条件前缀（+2 行）

在 Context Orientation Anchor 的 workspace 段落前新增：
```
**The following workspace rules apply only when cwd is a non-Git parent containing child repos:**
```

#### E3. spec-plan Core Principles 增加优先级标记（+0 行，修改现有内容）

标记最常被违反的 3 条原则：

```
1. **[HIGH PRIORITY] Use requirements as the source of truth** - ...
2. **Decisions, not code** - ...
3. **Research before structuring** - ...
4. **Right-size the artifact** - ...
5. **[HIGH PRIORITY] Separate planning from execution discovery** - ...
6. **Keep the plan portable** - ...
7. **[HIGH PRIORITY] Carry execution posture lightly** - Do not turn the plan into
   step-by-step execution choreography...
8. **Honor user-named resources** - ...
```

---

### 类别 F：Scope Summary 输出格式约束

#### F1. spec-plan Phase 0.7 和 5.1.5 输出格式（+5 行）

高频问题：scope summary 过长或格式不一致。

在 Phase 0.7 的 "Surface a synthesis" 前新增：
```
**Scope summary output format (strict):**
- Maximum 8 lines total
- Structure: 1-2 lines problem + 2-3 lines scope (in/out) + 1-2 lines key bet
- End with: "Proceed with planning?" or a specific clarifying question
- Do NOT produce a bulleted requirements list — that belongs in the plan
```

---

## 预期收益

| 类别 | 优化项数 | 行数变化 | 预期效果 |
|------|----------|----------|----------|
| A: Negative Examples | 4 项 | +26 | 减少最高频的路由/格式错误 |
| B: Decision Tree | 2 项 | +10 | 提升 Codex 路由遵循率 |
| C: Self-Check | 2 项 | +10 | 减少跳步和格式违规 |
| D: CRITICAL 标记 | 3 项 | +4 | 强化最常跳过的步骤 |
| E: 条件前缀 | 3 项 | +3 | 减少低频规则的噪声 |
| F: 输出格式约束 | 1 项 | +5 | scope summary 更一致 |
| **合计** | **15 项** | **+58** | |

spec-plan: 959 -> ~985 行（+26）
spec-code-review: 920 -> ~952 行（+32）

行数增加但每一行都针对一个具体的、可验证的执行错误模式。

---

## 实施顺序

### 第一批（最高 ROI，1-2 小时）

| # | 项目 | 理由 |
|---|------|------|
| 1 | A1 | 解决 spec-plan 最高频误路由 |
| 2 | A4 | 解决 spec-code-review 最明显执行错误 |
| 3 | B1 | Phase 0 decision tree 对两个宿主都有效 |
| 4 | C2 | format gate 移到 Stage 6 开头 |

### 第二批（高价值，1-2 小时）

| # | 项目 | 理由 |
|---|------|------|
| 5 | A2 | domain classification 误路由 |
| 6 | A3 | intent quality 提升 |
| 7 | C1 | 研究完整性 checkpoint |
| 8 | B2 | mode behavior matrix |

### 第三批（收尾，1 小时）

| # | 项目 | 理由 |
|---|------|------|
| 9 | D1-D3 | CRITICAL 标记（纯修改，无新增内容） |
| 10 | E1-E3 | 条件前缀（1-2 行新增） |
| 11 | F1 | scope summary 格式约束 |

---

## 验证方法

每批完成后在新会话中针对性验证：

| 优化项 | 验证场景 | 预期行为 |
|--------|----------|----------|
| A1 | 用 "strengthen the risk section" 调用 spec-plan | 不触发 deepening，走 normal resume |
| A2 | 用 "plan a database migration" 调用 spec-plan | 走 software planning，不路由到 universal |
| A4 | 在无 diff 分支运行 code-review | 不问 "push fixes?" |
| B1 | 用 bare prompt 调用 spec-plan | Phase 0 路由正确，不跳步 |
| C1 | 用简单 prompt 调用 spec-plan | Phase 1 后出现 checkpoint 验证 |
| C2 | 运行 code-review | findings 使用 table 格式 |

辅助验证：`npm run lint:skill-entrypoints`

---

## 风险评估

| 风险 | 缓解 |
|------|------|
| Negative examples 过于具体限制泛化 | 示例覆盖不同类型错误，非同类多变体 |
| Decision tree 与详细描述不一致 | tree 是导航层，详细描述是执行层，明确标注关系 |
| CRITICAL 过多导致信号稀释 | 每个 skill 最多 5 个 CRITICAL |
| Self-check 导致过度谨慎 | 设计为 pass/fail gate，不是交互式问题 |
| 条件前缀导致 LLM 错误跳过 | 条件明确且可验证（如"无 .spec-first/graph/ 目录"） |

---

## 工作量

| 批次 | 时间 | 说明 |
|------|------|------|
| 第一批 | 1-2 小时 | 4 项最高 ROI |
| 第二批 | 1-2 小时 | 4 项高价值 |
| 第三批 | 1 小时 | 7 项收尾 |
| **合计** | **3-5 小时** | 1 个 session 可完成 |

---

## 不做的事情

- 不做纯文案压缩（ROI 不足）
- 不去重 Interaction Method（重复是 reinforcement）
- 不压缩 shell 脚本（LLM 需要完整命令）
- 不压缩 After-Review routing（详细行为是正确路由的关键输入）
- 不新建 reference 文件
- 不改变 phase/stage 编号或路由条件
