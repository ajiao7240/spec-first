---
title: "refactor: Slim the spec-plan SKILL spine via rebar structure"
type: refactor
status: active
date: 2026-06-11
spec_id: 2026-06-11-004-spec-plan-skill-slimming
plan_depth: deep
---

# refactor: Slim the spec-plan SKILL spine via rebar structure

## Summary

把 68KB / 765 行的 `skills/spec-plan/SKILL.md` 按既有「钢筋结构」方法论收束为一个更可扫描的 workflow spine：先显式化承重判断轴并做删除前的边界迁移映射，再把 fresh-run 多数不走的 resume / deepen fast-path 分支外置为按需加载的 reference，最后按承重轴收束 references。核心约束是先把 contract test 从「绑头部精确短语」改造为「绑语义能力」，再动任何内容——否则外置会撞断言、且无法证明「少字节 ≠ 少能力」。本计划不做跨 37 个 skill 的治理头部去重（横切，单独立项），也不做逐句 prose 压缩（高漂移、低收益）。

---

## Problem Frame

`spec-plan` 的入口 `SKILL.md` 已膨胀到 68449 字节 / 765 行，是全仓 37 个 SKILL.md 中第二大（仅次于 spec-code-review 的 114KB）。膨胀本身不是病——真正的症状是 load-bearing 步骤被埋没导致执行不全：SKILL.md L748 自己写着 "agents can render the menu, capture a selection, and **stop without firing the routed action**"，这是作者在为「spine 太长、关键步骤被跳过」打补丁。

**必须区分两类成本，避免把动机与机制混为一谈：**

- **(a) 无条件上下文成本** —— 每次运行都加载、但 fresh run 多数不走的分支（Phase 0 的 resume/deepen fast-path）。这是 R3/U3 externalize 的**直接目标**。
- **(b) load-bearing 步骤被埋没** —— L748 那类位于 **Phase 5 后段**、必经却易被跳过的 routed action。这是 R8 要守住的**不变量**，不是 R3 能直接改善的产出。

本计划主攻 (a)，把 (b) 作为外置时不得削弱的约束。L748 证据用于说明「长 spine 会埋没关键步骤」这一普遍风险，论证收束的价值；它**不**意味着 externalize Phase 0.1 就能消除 Phase 5 那处具体埋没。若未来要直接改善 (b)，应是针对 Phase 5 handoff 区域的单独工作（与 003 的执行 gate 加固相邻），不在本计划范围。

实测字节分布显示，每次运行无条件支付的成本集中在两块：

- 头部治理小节（L17-135，约 13KB）：其中多数是跨 skill 复制的同款 prose（`## Scenario Capability` 出现在 18/37 个 skill，`## Runtime Context Exclusion` 7 个，`## Domain Language And Decision Ledger` 6 个）。
- Phase 0（L137-285，约 13KB / 147 行）：最大的单节，其中 resume / deepen-intent fast-path 分支逻辑多数 fresh run 根本不走，却每次装进上下文。

references 外置机制已经成熟（9 个 reference、11 处 `STOP. read references/...`），便宜的外置红利已部分吃掉。剩余可治理空间需要按 `docs/solutions/architecture-patterns/rebar-structure-skill-simplification-pattern-2026-06-04.md`（spec-prd 已实操过的同类方法论）来做，而不是另起一套简化哲学或机械按字节切。

一个关键风险已在证据中确认：`tests/unit/spec-plan-contracts.test.js` 大量使用 `toContain('Context Orientation Anchor')` 这类**头部精确短语**断言（rebar 原则 7 明确警告的「绑文件形状而非能力」反模式）。任何外置或合并都会撞这些断言，因此 test 改造必须前置。

---

## Requirements

- R1. 在删除或迁移任何 SKILL.md 内容前，产出一份 spec-plan 承重判断轴清单与「旧内容 → 新承重结构」的边界迁移映射；找不到迁移位置的内容不得删除（rebar 原则 1、6）。
- R2. 把 `tests/unit/spec-plan-contracts.test.js` 中绑定头部精确短语的断言改造为绑定语义能力的断言，使「内容位置变化但能力仍在」时测试仍通过，「能力丢失」时测试失败（rebar 原则 7）。
- R3. 把 fresh-run 多数不走的 resume / deepen fast-path 分支逻辑外置为按需加载的 reference，spine 只保留「判断是否进入该分支 → 是则加载该 reference」的路由骨架，使无条件上下文成本变为条件成本。
- R4. 仅在 U1 承重轴分析证明 references 之间存在同类边界重复时，才按承重轴收束 references；不为「减文件数」而合并面向不同 consumer 的边界。
- R5. 保持 source/runtime 边界：source 改 `skills/spec-plan/**` 与 `templates/claude/commands/spec/plan.md`，不手改 `.claude/`、`.codex/`、`.agents/skills/` 镜像；runtime 漂移用 `spec-first init` 修复。
- R6. command projection（`skills/spec-plan/references/*` → `.claude/spec-first/workflows/spec-plan/references/*` 的路径重写）与双宿主（Claude / Codex）投影在任何新增/重命名 reference 后仍正确。
- R7. 任何 user-visible 行为变化按仓库格式更新 `CHANGELOG.md`（含 `(user-visible)` 标注与配置的 developer author）。
- R8. spine 收束后，原有的 load-bearing 执行步骤（post-plan handoff menu 必须触发 routed action、document review 强制、blocking question 规则）不得因外置而更易被跳过——外置应降低埋没风险，不得制造新的「读不到关键步骤」缺口。

---

## Assumptions

- A1. 收束目标是「可扫描的 spine + 更强的 references」，不是某个具体行数/字节 KPI。行数断言（若加入 test）应是宽松上界防回膨胀，而非精确目标。
- A2. fresh-run 上下文节省主要来自分支外置（R3）；头部治理小节去重收益更大但属横切，本计划不认领。
- A3. 现有 9 个 reference 中是否存在可合并的同类边界，需 U1 实证后才能确定；R4/U4 是条件性的，可能结论为「不合并」。

---

## Scope Boundaries

- 不做跨 37 个 skill 的治理头部去重（`## Scenario Capability` 等共享样板抽取到 `docs/contracts/`）。这是横切重构，blast radius 覆盖十几个 skill，会把聚焦优化变成大重构。
- 不做逐句 prose 压缩。rebar 方法论明确反对，收益低且语义漂移风险高，违反 CLAUDE.md「避免无关重构、精准修改」。
- 不改变 `spec-plan` 的任何对外行为契约：Phase 顺序的语义、handoff menu 选项、Direct Evidence 块、U-ID 规则、blocking question 规则均保持。
- 不触碰 `docs/plans/2026-06-11-003-*-plan-mode-hardening-plan.md` 认领的 plan-only 执行 gate / hook 加固工作；本计划是文档结构收束，与其 harness 加固正交。

### Deferred to Follow-Up Work

- 跨 skill 治理头部去重：单独立项的横切任务，需先盘点 37 个 SKILL.md 的共享小节、设计 `docs/contracts/` 共享 contract 与引用机制、评估对每个 skill 的 test 影响。本计划在 U1 输出中标注哪些头部小节是横切候选，作为后续立项的输入。

---

## Completion Criteria

- 本计划标记为 `completed` 前必须满足：R2 的 test 改造已合入且通过（绑能力断言到位、旧绑短语断言已替换、projection 路径断言保留并为新 reference 新增）；R3 的分支外置已落地且 spine 路由骨架可独立读懂；U1 迁移映射文档已沉淀；command/双宿主 projection 经 `npm run test:mcp-setup` 或等价 contract test 验证；`spec-first init` 已运行且记录 runtime 是否变化。
- **R8 行为门槛（非审美门槛）**：closeout 必须确认改造后 spine 中每个 load-bearing 步骤（handoff menu 必须触发 routed action、document review 强制、blocking question 规则）在不进入任何外置 reference 的前提下仍可定位到；U5 必须拆成两类 fresh-source eval：`spine-only scannability eval` 验证仅凭 spine 能识别强制 doc-review、blocking question、handoff reference load 和 completion check；`spine + plan-handoff behavioral trace` 验证加载 `plan-handoff.md` 后 fresh run 能到达并触发 Phase 5 routed handoff action。仅"路由骨架可独立读懂"不足以判定 R8 通过。
- 若 U4（references 收束）经 U1 分析判定不执行，closeout 必须显式说明「无可合并的同类边界」，而非静默跳过。
- closeout 必须附 before/after 质量度量表：`SKILL.md bytes/lines`、`fresh-run unconditional bytes`、`conditional resume/deepen bytes`、`always-load reference count`、`load-bearing spine gates count`。这些是观测口径，不是硬 KPI；要求趋势解释和不变量保持证据。

---

## Direct Evidence Readiness

- target_repo: spec-first（当前仓库根）
- evidence_sources: bounded direct reads、`wc`、`grep -rl` 跨 skill 计数、本会话已读 rebar solution / plan-template / contract test 全文
- source_refs: skills/spec-plan/SKILL.md、tests/unit/spec-plan-contracts.test.js、docs/solutions/architecture-patterns/rebar-structure-skill-simplification-pattern-2026-06-04.md、templates/claude/commands/spec/plan.md
- current_revision: 387abe4a
- worktree_status: dirty（CHANGELOG.md 等既有改动，与本计划无关）
- confidence: high（体量、重复度、test 断言面、runtime 路径均已实测）
- limitations: 未 dispatch research agent，用 inline bounded reads 等价替代；未实测 `spec-first init` 投影 diff（属实现期 U5 工作）

---

## Direct Evidence

- repo_scope: skills/spec-plan/、tests/unit/、templates/claude/commands/spec/、docs/solutions/architecture-patterns/
- source_reads_completed: SKILL.md 标题结构与逐节字节、references/* 体量、spec-plan-contracts.test.js 断言面（含 heading-order `toBeLessThan` 与头部短语 `toContain`）、rebar solution 全文、plan-template.md 全文、command stub（12 行 / 399 字节）
- source_reads_required: U1 期需逐节精读 SKILL.md Phase 0-5 以产出迁移映射；U5 期需读 command projection 生成逻辑与 codex 投影
- commands_or_tools_used: `wc -c -l`、`grep -n/-rl`、`awk` 分节字节统计、`git rev-parse`
- impact_on_plan: 实测把策略从「按字节切」修正为「rebar 承重轴优先 + test 前置」；确认头部去重必须剥离为横切；确认分支外置是低风险首选
- key_findings: SKILL.md 68KB/765 行；头部小节跨 skill 高重复（Scenario Capability 18/37）；Phase 0 是最大单节且含 fresh-run 不走的 fast-path 分支；test 大量绑头部短语（反模式）；command projection 做 `skills/ → .claude/spec-first/workflows/` 路径重写
- limitations: 同上 Readiness 的 limitations

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-plan/SKILL.md` — 收束目标，当前 workflow spine。
- `skills/spec-plan/references/` — 已外置的 9 个 reference（deepening-workflow 17KB、plan-handoff 10KB、universal-planning 12KB、synthesis-summary 9KB 等）。
- `tests/unit/spec-plan-contracts.test.js` — 493 行，承重 contract 测试网；含路径常量、heading-order 断言、头部短语断言。
- `templates/claude/commands/spec/plan.md` — 12 行薄 command stub；实际内容在 SKILL，投影时做 reference 路径重写。

### Institutional Learnings

- `docs/solutions/architecture-patterns/rebar-structure-skill-simplification-pattern-2026-06-04.md` — 本计划的主方法论。spec-prd 已实操：300 行 + 多 reference 收束为可扫描 spine + 主钢筋 reference，并用 contract test 绑能力。七条原则直接对应本计划 U1-U5。
- `docs/solutions/architecture-patterns/competitor-skill-borrowing-judgment-2026-06-01.md` — 借功底不借形态（rebar Related 引用）。

### External References

- 无需外部研究：这是仓库内 prompt 架构收束，本地已有成熟方法论与可对照的 spec-prd 实操先例。

---

## Key Technical Decisions

- **test 改造前置于内容外置**：rebar 原则 7 的硬约束。先让测试绑能力，再动内容，否则外置必撞头部短语断言，且无法证明能力守恒。这决定了 U2 必须在 U3/U4 之前。
- **承重轴分析驱动收束，而非字节目标**：rebar 原则 1「先找承重轴，不先删文件」。U1 的迁移映射是 U3/U4 的前置依据，没有它就删/合并等于盲切。
- **头部去重剥离为横切**：实测它是 37-skill 系统性问题；在 spec-plan 单点动它既治不了根，又会让 spec-plan 头部与其余 36 个不一致。
- **分支外置沿用既有 `STOP. read references/...` 模式**：不发明新机制；只把 fresh-run 不走的分支从 spine 移到按需 reference，使无条件成本变条件成本。
- **只有分支专属内容才外置**：fresh run 必经的 Phase 0.2/0.3/0.4/0.7 不外置，避免「外置但每次都读回」导致总 token 不降反升。

---

## Open Questions

### Resolved During Planning

- 是否做头部治理去重：不在本计划，剥离为横切 follow-up（已记入 Scope Boundaries / Deferred）。
- 是否逐句压 prose：否（rebar 反对，已记入 Scope Boundaries）。

### Deferred to Implementation

- references 是否真有可合并同类边界（U4 是否执行）：取决于 U1 承重轴分析结论。
- test 是否加入行数上界断言防回膨胀：U2 期决定；若加，是宽松上界而非精确 KPI（见 A1）。
- 外置后 spine 是否仍可能埋没 handoff 步骤（R8）：U3 期需验证路由骨架本身不被新分支稀释。

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
执行依赖（非数字顺序，以各单元 Dependencies 字段为准）：
  U1 承重轴 + 迁移映射 + capability matrix
    └─► U2 test 绑能力改造
          └─► U3 分支外置
                └─► U4 references 收束（条件性；若执行，基于 U3 后的实际结构）
                      └─► U5 projection 同步 + 验证 + CHANGELOG（最后）

承重轴（U1 待确认的候选，源自 rebar 对 spec-prd 的轴划分）：
  入口路由（直接计划 / resume / deepen / universal / 路由出去）
  source 解析（origin requirements 继承、spec_id 身份）
  depth 判定（lightweight/standard/deep + governance-signals）
  证据契约（Direct Evidence 块）
  结构化（implementation units / U-ID 稳定性）
  产物契约（plan-template / markdown 为 canonical / HTML sidecar）
  深化与 handoff（confidence-first / doc-review / post-plan menu）

外置候选（R3，fresh run 多数不走）：
  Phase 0.1  Resume Existing Plan Work
  Phase 0.1  Deepen intent fast-path
  → references/resume-and-fast-paths.md（新建，spine 留路由骨架）
```

---

## Implementation Units

执行顺序遵循各单元 `Dependencies`，非 U-ID 数字序：先 U1，再 U2，再 U3，然后 U4（条件性）基于 U3 后的实际结构判断是否执行，U5 最后。U3/U4 不并行修改同一批 source/test 文件，避免迁移映射与能力断言互相覆盖。

### U1. 显式化承重轴并产出删除前迁移映射

**Goal:** 在动任何内容前，确定 spec-plan 不可丢失的判断轴，并为每一类待外置/待合并内容建立「迁移到哪」的映射，作为 U3/U4 的前置依据。

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `docs/solutions/architecture-patterns/spec-plan-skill-slimming-load-bearing-axes-2026-06-11.md`
- Test: 无（分析产物，非代码改动）

**Approach:**
- 逐节精读 SKILL.md Phase 0-5，参照 rebar 对 spec-prd 的轴划分，列出 spec-plan 的承重判断轴。
- 对头部治理小节逐条标注：是 spec-plan 专属，还是跨 skill 横切候选（用已测的跨 skill 出现计数支撑）。
- 对 Phase 0 的 resume / deepen fast-path 分支，给出「迁到 references/resume-and-fast-paths.md」的映射；对 fresh-run 必经节标注「保留在 spine」。
- **枚举所有 in-spine 对 Phase 0.1 fast-path 概念的交叉引用**（已知至少 Phase 0.7 guard `The run is not on a Phase 0.1 fast path...`、Phase 5.1.5 guard、Phase 5.3 interactive mode `activated by the re-deepen fast path in Phase 0.1`）。这些段是 fresh-run 必经或路由关键、不外置。迁移映射必须要求 spine 保留一处**自包含的 fast-path / resume-normal / deepen-intent 状态定义**，使被保留的 guard 不必加载外置 reference 也能被读懂；否则外置会制造孤儿引用。
- 划清新建 `resume-and-fast-paths.md`（入口触发 / 路由）与既有 `deepening-workflow.md`（深化执行）之间的 deepen 内容边界，避免 U2 的 deepen 断言指向错误文件。
- 对 9 个现有 reference 做同类边界分析：是否存在多个 reference 承担同一组判断（rebar 原则 3 的合并信号）。
- 输出一张 `capability matrix`，作为 U2 test 改造的 source of truth。每行至少包含：`capability_id`、`owner_surface`（spine / reference / projection / template）、`must_remain_in_spine`、`positive_invariants`、`forbidden_regressions`、`consumer`、`test_name`。projection 精确路径、heading order 这类「phrase 即 contract」的能力必须显式标成不可 rebind。
- 输出格式参照 rebar solution 的「旧文件 → 新承重结构」迁移映射块。

**Patterns to follow:**
- `docs/solutions/architecture-patterns/rebar-structure-skill-simplification-pattern-2026-06-04.md` 的迁移映射与轴划分。

**Test scenarios:**
- Test expectation: none — 本单元产出分析文档，无行为变化。

**Verification:**
- 每一类计划外置/合并的内容都有明确迁移目标；找不到目标的内容被标注为「不可删除，保留」。横切候选小节被单独列出供 follow-up。`capability matrix` 覆盖 R1/R2/R6/R8 的所有承重能力，且没有 orphan capability（无 owner/test）或 orphan prose（有待删除/迁移内容但无 capability 归属）。

---

### U2. 把 contract test 从绑短语改造为绑能力

**Goal:** 让 `spec-plan-contracts.test.js` 在「内容位置变化但能力仍在」时通过、在「能力丢失」时失败，为 U3/U4 的内容移动提供安全网。

**Requirements:** R2, R8

**Dependencies:** U1

**Files:**
- Modify: `tests/unit/spec-plan-contracts.test.js`
- Test: 同上（自验证）

**Approach:**
- 识别绑头部精确短语的断言（如 `toContain('Context Orientation Anchor')`、`toContain('Cache-Friendly Context Layout')` 等），改为断言「该能力的语义约束存在于 spine 或其指定 reference 之中」——允许内容落在 spine 或被外置的 reference。
- 按 U1 的 `capability matrix` 改造测试，不凭实现者临场判断随意放宽断言。每个改造后的测试应能追溯到一个 `capability_id`；测试名或注释标明其保护的 consumer 与 owner surface。
- 对 R8 涉及的 load-bearing 步骤（handoff menu 必须触发 routed action、document review 强制、blocking question 规则）补「能力仍被某文件约束」的断言，确保外置不削弱它们。
- 保留 heading-order 等真正反映产物契约的断言（如 plan-template 的 `## Requirements` < `## Assumptions`）。
- **把 command/projection 路径断言显式划为「不可 rebind」类**，与 heading-order 并列。这类断言（如 `toContain('.claude/spec-first/workflows/spec-plan/references/plan-sections.md')` 及对应负向 `not.toContain` 断言）保护的正是下游 projection 重写依赖的精确路径——此处 capability 就是 phrase，松绑会丢掉它要保护的契约。对新建 `resume-and-fast-paths.md`，应**新增** projection 路径断言验证它被正确重写；且必须**同时覆盖 Claude 与 Codex 两宿主**（Claude 侧 `.claude/spec-first/workflows/spec-plan/references/`，Codex 侧用 `CodexAdapter` 与对应 workflowsRoot 路径），而非只断言 Claude 侧——现有 test 只断言 Claude 侧，仅按 Claude 写会留下 Codex projection drift 不被捕获（R6 要求双宿主）。
- 决定是否加入宽松行数上界断言防回膨胀（A1）；若加，注释说明它是上界非 KPI。
- 改造遵循 rebar 原则 7：测试判断「能力是否仍在」，不是「短语/文件名是否还在」。

**Patterns to follow:**
- `tests/unit/spec-prd-contracts.test.js` 的「绑能力不绑文件形状」断言风格（rebar solution 记录其形态）。
- 现有 `spec-plan-contracts.test.js` 的路径常量与 `readFileSync` 跨文件断言模式（允许断言指向 reference）。

**Test scenarios:**
- Happy path: 当前 SKILL.md/references 内容下，改造后的 test 全绿。
- Edge case: 把某能力的 prose 从 spine 挪到 reference（模拟 U3 外置），test 仍通过。
- Error path: 删除某 load-bearing 能力的约束 prose，test 失败并指出缺失能力。
- Integration path: 与 command projection 断言（指向 `.claude/spec-first/workflows/...` 路径）共存，不破坏既有 projection 测试。

**Verification:**
- `npx jest tests/unit/spec-plan-contracts.test.js` 全绿；人为移除一条能力 prose 能触发预期失败（手工反向验证一次并在 closeout 记录）。抽查至少一个 rebind-allowed 能力（spine → reference 后仍通过）和一个不可 rebind 能力（projection 精确路径或 heading order 被改动必须失败）。

---

### U3. 外置 resume / deepen fast-path 分支，spine 留路由骨架

**Goal:** 把 fresh-run 多数不走的分支逻辑从 SKILL.md 移到按需加载的 reference，降低无条件上下文成本；并作为 R8 的主 owner，保证外置不让 load-bearing 步骤更易被跳过。

**Requirements:** R3, R5, R8（R8 主 owner——U3 是实际移动内容的单元，承担 R8 的行为验证；U2 只提供 R8 的 test 安全网）

**Dependencies:** U1, U2

**Files:**
- Create: `skills/spec-plan/references/resume-and-fast-paths.md`
- Modify: `skills/spec-plan/SKILL.md`
- Test: `tests/unit/spec-plan-contracts.test.js`

**Approach:**
- 按 U1 迁移映射，把 Phase 0.1 Resume Existing Plan Work、Deepen intent fast-path、相关 short-circuit 规则移入新 reference。
- spine 的 Phase 0.1 收为路由骨架：判断是否 resume/deepen → 是则 `STOP. read references/resume-and-fast-paths.md`，否则继续 Phase 0.1b。
- 沿用既有 `STOP. read references/...` 措辞与强加载语气（参照 L273/L748 的 STOP 模式），确保外置不让分支步骤更易被跳过（R8）。
- 不外置 fresh-run 必经的 0.2/0.3/0.4/0.5/0.7。
- 保持 source/runtime 边界（R5）：只改 source，不碰 mirror。

**Patterns to follow:**
- SKILL.md 现有 11 处 `STOP. read references/` 外置模式（如 synthesis-summary、plan-handoff 的强加载）。

**Test scenarios:**
- Happy path: spine 含 resume/deepen 的路由骨架与对新 reference 的强加载指令；新 reference 含完整分支逻辑。
- Edge case: 普通编辑请求（非 deepen）仍走标准 resume 流，不误触发 fast-path（语义保留）。
- Error path: test 失败若 resume/deepen 能力既不在 spine 也不在 reference（能力丢失）。
- Integration path: 新 reference 纳入 command projection 路径重写，`.claude` 投影路径正确。

**Verification:**
- spine 的 Phase 0.1 可独立读懂为路由骨架；resume/deepen 能力经 U2 改造后的 test 验证仍在；SKILL.md 字节较改造前下降且分支成本变为条件加载。
- **R8 行为验证**：通读改造后 spine，确认 handoff-must-fire、document-review 强制、blocking-question 三个 load-bearing 步骤无需进入任何外置 reference 即可读到；被保留的 Phase 0.7 / 5.1.5 / 5.3 guard 对 fast-path 概念的引用仍可在 spine 内被理解（不产生孤儿引用）。最终行为由 U5 fresh-source eval 实测。

---

### U4. 按承重轴收束 references（条件性）

**Goal:** 仅当 U1 证明存在同类边界重复时，把多个承担同一组判断的 reference 收束为更少更强的承重 reference。

**Requirements:** R4, R5

**Dependencies:** U1, U2, U3（U4 与 U3 同改 `SKILL.md`、references 与 `spec-plan-contracts.test.js`，不得并行；必须基于 U3 后的实际 spine/reference 结构重新判断是否存在同类边界重复）

**Files:**
- Modify: `skills/spec-plan/references/*`（具体文件由 U1 结论确定）
- Modify: `skills/spec-plan/SKILL.md`（更新 reference trigger map）
- Test: `tests/unit/spec-plan-contracts.test.js`

**Approach:**
- 若 U1 结论为「无可合并同类边界」，本单元不执行，closeout 显式说明（见 Completion Criteria）。若 U3 外置后改变 reference 边界，先复核 U1 的同类边界判断是否仍成立。
- 若存在重复，按 rebar 原则 3 合并为主承重 reference，并更新 SKILL.md 的 reference 加载点与 test 路径常量。
- 不合并面向不同 consumer 的边界（rebar「When to Apply」反例）。
- 删除任何旧 reference 前，确认 U1 迁移映射已覆盖其语义边界。
- 若执行合并，必须重跑 orphan 检查：所有被删除/重命名 reference 的旧能力都能在 `capability matrix` 中找到新 owner，并由测试覆盖。

**Patterns to follow:**
- rebar solution 的 `evidence-and-topology.md` 主钢筋合并范例与删除前迁移检查。

**Test scenarios:**
- Happy path（若执行）: 合并后 test 路径常量与能力断言更新且全绿。
- Edge case（若不执行）: 无文件变化，closeout 记录「无可合并边界」。
- Error path: test 失败若某 reference 的能力在合并中丢失。

**Verification:**
- 执行则：reference 数下降且每条能力仍被 test 约束，并记录 U1 orphan 检查结果；不执行则：closeout 显式说明判定理由。

---

### U5. 同步 projection、双宿主、验证与 CHANGELOG

**Goal:** 在所有 source 改动落地后，确保 command/双宿主 runtime 投影正确，跑聚焦验证，并留痕 user-visible 文档。

**Requirements:** R5, R6, R7

**Dependencies:** U1, U2, U3, U4（若 U4 经 U1/U3 后复核判定不执行，U5 在 U3 完成并记录 U4 缺席理由后即可开始）

**Files:**
- Modify: `CHANGELOG.md`
- Inspect: `templates/claude/commands/spec/plan.md`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: command/projection 与 mcp-setup contract（经 `npm run test:mcp-setup`）

**Approach:**
- 确认新增/重命名的 reference 在 command projection 中被正确重写为 `.claude/spec-first/workflows/spec-plan/references/*`，必要时更新 test 中的 projection 路径断言。无需注册 projection manifest：generator（`src/cli/plugin.js` 的 `copyDirectoryWithTransform`/`planDirectoryWithTransform`）递归遍历 `skills/spec-plan/`，新 reference 文件自动被发现并由 `rewriteSourceSkillRuntimePaths` 重写路径；U5 的 `spec-first init` 是修 runtime drift，不是注册新文件。但 test 断言不会自动生成——为新 reference 加双宿主 projection 断言（见 U2）仍是必须的手工步骤。
- 运行 `spec-first init` 重新生成 runtime mirror（不手改），记录 Claude 与 Codex 两侧生成产物是否变化。
- 验证顺序由窄到宽：先 `npx jest tests/unit/spec-plan-contracts.test.js`，再 `npm run lint:skill-entrypoints`（改了 workflow prose/references），再 `npm run test:mcp-setup`，按影响面决定是否 `npm run test:unit`。
- 加 `CHANGELOG.md` 条目，标 `(user-visible)`（spine 结构变化影响调用者阅读路径），用配置的 developer author。
- **before/after 质量度量为必需证据**：用同一脚本或同一组 shell 统计改造前后 `SKILL.md bytes/lines`、`fresh-run unconditional bytes`、`conditional resume/deepen bytes`、`always-load reference count`、`load-bearing spine gates count`。结果写入 closeout；若某项不降或上升，必须解释为什么没有降低质量或上下文经济性。
- **fresh-source eval 为必需行为门槛（非 optional）**：拆成两轮并沉淀到 `docs/validation/spec-plan/fresh-source-eval-2026-06-11-skill-slimming.md` 或同类路径。第一轮 `spine-only scannability eval` 只注入改造后的 `SKILL.md`，验证 fresh 通用 reviewer 能正确指出强制 doc-review、blocking question、handoff reference load、completion check，并识别具体 routed action 需要继续加载 `plan-handoff.md`；第二轮 `spine + plan-handoff behavioral trace` 同时注入 `SKILL.md` 与 `references/plan-handoff.md`，模拟 fresh run 能到达并触发 Phase 5 routed handoff action。仅当 host dispatch 确实不可用时才允许跳过，且必须记录未执行原因——不可因为 eval 不便而默认跳过，也不得在未实测时声称 R8 / scannability 通过。
- **003 sequencing**：U1 迁移映射基于 `current_revision: 387abe4a` 的行号/结构。若 003（plan-mode-hardening，同改 SKILL.md 且触及 Phase 5 handoff 区域）先合入，必须对 HEAD 重跑 U1 迁移映射再继续 U3，而非依赖末端手检发现冲突。

**Patterns to follow:**
- `docs/contracts/source-runtime-customization-boundary.md` 的 source-first / runtime-generated 边界。
- rebar solution 记录的验证链路（jest → typecheck → lint:skill-entrypoints → build → test:unit）。

**Test scenarios:**
- Happy path: 聚焦 spec-plan contract test 与 projection/mcp-setup test 全绿。
- Integration path: `spec-first init` 后 runtime mirror 与 source 一致，无漂移。
- Error path: closeout 捕获任何「声称已验证但实际未跑」的缺口，未跑项显式标注。
- Regression path: fresh-source eval 若只能在加载 `plan-handoff.md` 后识别具体 routed action，属于预期；若仅凭 spine 不能识别必须加载 handoff reference、强制 doc-review 或 completion check，则 R8 失败。

**Verification:**
- closeout 列出实际跑过的命令、是否运行 `spec-first init`、生成产物是否变化、before/after 质量度量、两轮 fresh-source eval 是否执行及结论，以及残余 limitation。

---

## System-Wide Impact

- **Interaction graph:** SKILL.md 是 source，经 command projection 与 `spec-first init` 投影到 `.claude/`、`.codex/`。downstream（spec-work / spec-write-tasks / spec-doc-review）消费的是生成的 plan 产物，不直接消费 SKILL spine，故 spine 收束不改下游产物契约——但调用 `/spec:plan` 的运行时阅读路径会变。
- **Error propagation:** 外置若让 load-bearing 步骤更易跳过（R8 风险），表现为 handoff menu 不触发 routed action 之类回归。U2 的能力断言 + U3 的强加载措辞共同兜底。
- **State lifecycle risks:** 无新状态。plan 仍是决策产物，进度仍由 git/spec-work 派生。
- **API surface parity:** Claude 与 Codex 双宿主投影必须同步（R6），source 改动须 host-neutral。
- **Integration coverage:** projection 路径重写、mcp-setup contract、skill-entrypoints lint 是单测之外必须覆盖的集成面。
- **Unchanged invariants:** Phase 语义顺序、handoff menu 选项、Direct Evidence 块、U-ID 规则、blocking question 规则、markdown canonical / HTML sidecar 边界均不变。

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 外置后 spine 把 load-bearing 步骤埋得更深，handoff 步骤被跳过 | Medium | High | U2 先补能力断言；U3 沿用强加载 STOP 措辞；R8 显式为验收项 |
| test 改造把绑短语换成过松断言，失去回归保护 | Medium | High | U1 先产出 `capability matrix`；U2 每个测试追溯到 `capability_id`；反向验证（删能力须触发失败）；保留 heading-order / projection path 等不可 rebind 契约断言 |
| 为减文件数强行合并不同 consumer 的 reference | Low | Medium | U4 条件性执行，遵守 rebar「不合并不同 consumer 边界」 |
| 外置但 fresh run 仍每次读回，总 token 不降反升 | Medium | Medium | 只外置 fresh-run 不走的分支；必经节保留在 spine |
| runtime mirror 与 source 漂移 | Low | Medium | 只改 source，`spec-first init` 重生成，projection test 验证 |
| 与 003 plan-mode-hardening 改动冲突 | Low | Medium | 两者正交（结构收束 vs 执行 gate）；若 003 先合入，对 HEAD 重跑 U1 迁移映射；U4 不与 U3 并行，避免同文件结构变更互相覆盖 |

---

## Alternative Approaches Considered

- **按字节直接切大节到 references**：拒绝。rebar 原则 1 明确「不先删文件、先找承重轴」；盲切会把不同判断轴混进一个 reference，降低 LLM 判断质量。
- **先做跨 skill 头部去重再收 spec-plan**：拒绝作为本计划范围。收益更大但 blast radius 覆盖 37 个 skill，应独立立项；混入会让聚焦优化变大重构。
- **逐句压缩 prose**：拒绝。低收益、高漂移，违反 rebar 与 CLAUDE.md 精准修改原则。
- **不动 test、直接外置**：拒绝。会撞头部短语断言，且无法证明能力守恒；rebar 原则 7 要求 test 绑能力先行。

---

## Success Metrics

- 改造后 SKILL.md 可被一次性扫描理解为 workflow spine（入口路由 + Phase 高层顺序 + reference 加载点），无需读完 765 行才知道关键步骤。
- fresh run（无 resume/deepen）的无条件上下文成本下降（分支移入按需 reference）。
- contract test 在内容位置变化时不误报、在能力丢失时必报。
- 双宿主与 command projection 在新增/重命名 reference 后仍正确，无 source/runtime 漂移。
- U1 迁移映射可作为后续头部去重横切立项的直接输入。
- closeout 用同一口径给出 before/after 表，而不是只用主观描述证明提升：`SKILL.md bytes/lines` 下降或有合理解释；`fresh-run unconditional bytes` 下降；`conditional resume/deepen bytes` 转为按需加载；`always-load reference count` 不增加或有明确收益；`load-bearing spine gates count` 保持且测试/fresh-source eval 覆盖。

---

## Documentation / Operational Notes

- `CHANGELOG.md` 必须有 `(user-visible)` 条目（调用者运行时阅读路径变化）。
- README 大概率无需改（不改对外 workflow 指令，只改 spine 内部结构）。
- U1 产出的承重轴/迁移映射文档沉淀在 `docs/solutions/architecture-patterns/`，并在 closeout 指向它。
- U5 的 fresh-source eval 结果沉淀在 `docs/validation/spec-plan/`，并在 closeout 指向它；若无法执行，记录具体 runtime/dispatch 原因，不把未执行写成通过。
- 若 `spec-first init` 刷新了 mirror，closeout 须说明用了 init 且生成产物是否变化。
- 头部去重横切 follow-up 的盘点结论附在 U1 文档，供单独立项引用。

---

## Sources & References

- Project role contract: `docs/10-prompt/结构化项目角色契约.md`
- 主方法论: `docs/solutions/architecture-patterns/rebar-structure-skill-simplification-pattern-2026-06-04.md`
- 收束目标: `skills/spec-plan/SKILL.md`
- contract 测试网: `tests/unit/spec-plan-contracts.test.js`
- command stub: `templates/claude/commands/spec/plan.md`
- source/runtime 边界: `docs/contracts/source-runtime-customization-boundary.md`
- 既有 references: `skills/spec-plan/references/`（deepening-workflow、plan-handoff、universal-planning、synthesis-summary、plan-sections、plan-template、markdown-rendering、html-rendering、visual-communication）
- 正交计划: `docs/plans/2026-06-11-003-refactor-spec-plan-plan-mode-hardening-plan.md`
