# spec-plan 执行就绪度改造方案

> 目标：将 `spec-plan` 从“高质量技术计划器”进一步升级为“高质量技术计划器 + agent-execution handoff optimizer”，在不打穿 planning / execution 边界的前提下，系统吸收 `writing-plans` 在低上下文执行友好性上的优势。

## 1. 改造目标

本次改造不追求把 `spec-plan` 回退成 `writing-plans` 那种执行脚本式 plan，也不把 implementation unit 退化成 RED/GREEN/REFACTOR 微步。

本次改造的目标是：

1. 提升 implementation plan 的 **Execution Readiness**
2. 降低低上下文 implementer / delegate agent 的误读与误起手概率
3. 让 deepening 与 handoff 更显式地面向执行失败模式建模
4. 保持 `spec-plan` 当前的 artifact-first / decisions-first / review-first 边界

一句话说：

> 改造后的 `spec-plan` 仍然写“决策工件”，但会更强地外显那些最容易在执行阶段被误解的隐含判断。

---

## 2. 不改什么

为了避免把 `spec-plan` 做坏，本次改造明确不做以下事情：

- 不把实现代码写进主 plan
- 不把 shell / git choreography 写进主 plan
- 不把 implementation unit 降级为 2–5 分钟微步脚本
- 不把 `spec-plan` 改造成 TDD choreography compiler
- 不让 deepening 变成“把 plan 补成可直接 copy-paste 执行的脚本”

本次改造的核心约束是：

> 增强执行友好性，但不污染主 plan 的 durable artifact 属性。

---

## 3. 涉及文件

本次改造建议分 3 个文件落地：

1. `skills/spec-plan/SKILL.md`
2. `skills/spec-plan/references/deepening-workflow.md`
3. `skills/spec-plan/references/plan-handoff.md`

三者分工如下：

| 文件 | 改造职责 |
|---|---|
| `SKILL.md` | 定义主 contract：质量维度、implementation unit 写法、review before writing 规则 |
| `deepening-workflow.md` | 定义“什么时候判定 plan 执行就绪度不足，以及如何有边界地补强” |
| `plan-handoff.md` | 定义 plan 写完后的执行侧派生层与 handoff contract |

---

## 4. `SKILL.md` 改造方案

## 4.1 在 `Plan Quality Bar` 中新增 `Execution Readiness`

位置：`skills/spec-plan/SKILL.md` 中 `## Plan Quality Bar`

建议新增一个独立质量维度：

### Execution Readiness
- Each implementation unit minimizes unstated implementer decisions
- Concrete pattern anchors are named when the plan relies on an existing pattern
- Test scenarios are specific enough to become tests without inventing coverage shape
- Verification distinguishes partial completion from done
- Dependency order is explicit enough to avoid incorrect execution reordering

### 改造意图
当前 `spec-plan` 更偏重：
- 是否合理
- 是否完整
- 是否 grounded
- 是否可 review

新增 `Execution Readiness` 后，质量 bar 会显式覆盖：
- implementer 是否还要大量补脑
- 单元是否“看起来清楚，执行时其实含糊”
- 测试与验证是否足够支撑低上下文 handoff

---

## 4.2 在 `Core Principles` 中引入低上下文执行者原则

位置：`skills/spec-plan/SKILL.md` 中 `## Core Principles`

建议新增原则：

> Write plans as if the implementer understands code, but not your unstated assumptions.

### 改造意图
这条原则不会把 `spec-plan` 改成保姆式脚本，但会要求作者在以下问题上更克制含糊表达：

- 不能只写 “follow existing patterns”
- 不能只写 “update tests accordingly”
- 不能只写 “validate integration”
- 不能把关键排序与 done signal 留给执行者自己发明

---

## 4.3 收紧 `Execution note` 为受控姿态标签

位置：
- `skills/spec-plan/SKILL.md` 中 `#### 3.3 Break Work into Implementation Units`
- `## Implementation Units` 模板

当前 `Execution note` 是自由文本为主。建议收紧为：

- `Execution note: test-first`
- `Execution note: characterization-first`
- `Execution note: integration-first`
- `Execution note: contract-first`
- `Execution note: migration-safety-first`
- `Execution note: external-delegate`

必要时允许补一小句说明，例如：

- `Execution note: contract-first — start by proving request/response boundary behavior`

### 改造意图
这样做有 4 个收益：

1. 降低 posture 表达漂移
2. 让 `spec:work` 更容易稳定消费这些信号
3. 为 reviewer / executor routing 留出结构化接口
4. 保留 `Execution note` 的轻量性质，不退化成 choreographed steps

---

## 4.4 为 implementation unit 增加可选 `Starting point`

位置：`skills/spec-plan/SKILL.md` 中 `## Implementation Units`

建议新增字段：

- **Starting point** - optional, used when a unit spans multiple files, is easy to mis-start, or touches a legacy / integration-heavy area

示例：

- `Starting point: Inspect src/cli/plugin.js and the existing asset sync tests before introducing the new manifest rewrite.`
- `Starting point: Add the failing contract test in tests/unit/spec-plan-contracts.test.js before editing the workflow copy.`

### 使用条件
不是每个 unit 都要写。建议仅在以下情况使用：

- unit 跨多个文件
- unit 容易误起手
- unit 位于 legacy 区域
- unit 是 integration-heavy / contract-heavy 变更

### 改造意图
这个字段吸收的是 `writing-plans` 的“第一步清晰度”，而不是其“全微步 choreography”。

---

## 4.5 收紧 `Patterns to follow` / `Test scenarios` / `Verification`

位置：`skills/spec-plan/SKILL.md` 中 implementation unit 字段说明

建议做如下收紧：

### `Patterns to follow`
要求：
- 不允许只写泛化表达
- 当 plan 依赖已有模式时，必须点名具体文件、模块、组件或测试

坏例子：
- `Follow existing patterns.`

好例子：
- `Mirror the Stage-0 preload ordering used in skills/spec-work/SKILL.md and its contract test coverage in tests/unit/spec-work-contracts.test.js.`

### `Test scenarios`
要求：
- 必须写输入、动作、预期结果
- feature-bearing unit 不允许空泛测试描述
- 不要求写 test code，但不能把 coverage 形状丢给 implementer 现场发明

### `Verification`
要求：
- 必须写 observable outcomes
- 必须能区分 partial / done
- 不允许用 “looks right” / “appears correct” / “validated” 这种不可判定描述

---

## 4.6 强化 `5.1 Review Before Writing`

位置：`skills/spec-plan/SKILL.md` 中 `#### 5.1 Review Before Writing`

建议新增 4 组 execution-focused 检查。

### A. Execution placeholder scan
新增坏味道模式：

- “follow existing patterns” but no concrete pattern named
- “handle edge cases appropriately” with no edge cases named
- “update tests accordingly” with no test file path or scenario shape
- “validate integration” with no specific integration boundary named
- “if needed” / “as appropriate” / “where relevant” without narrowing condition

### B. First-move clarity check
隐式检查每个 implementation unit 是否能回答：

1. 实现者第一步会去哪个文件？
2. 它先验证什么行为或 contract？
3. 哪个测试文件承接这个 unit？
4. 它依赖哪个上游 unit？
5. 做完后什么 observable outcome 证明完成？

不要求把 5 问都显式写进正文，但 plan 本身应足以回答。

### C. Done / not-done clarity check
新增要求：

- Verification must make it possible to distinguish incomplete work from completed work.

### D. Execution posture consistency
新增要求：

- If a unit obviously benefits from test-first, characterization-first, integration-first, or contract-first posture, the plan should signal that posture explicitly rather than leaving it implicit.

---

## 5. `deepening-workflow.md` 改造方案

## 5.1 扩充 `Implementation Units` checklist

位置：`skills/spec-plan/references/deepening-workflow.md` 中 `**Implementation Units**`

建议新增以下 trigger：

- Starting ambiguity is high — an implementer would not know where to begin
- The unit relies on an existing pattern but does not name the actual anchor file or module
- Test scenarios require the implementer to invent coverage shape
- Verification cannot distinguish partial completion from done
- Execution posture is implied by the work but not signaled

### 改造意图
让 deepening 不只修“完整性”，也修“执行起手摩擦”。

---

## 5.2 明确 deepening 可补哪些 execution-readiness 信息

位置：`skills/spec-plan/references/deepening-workflow.md` 中 `Allowed changes`

建议明确允许 deepening：

- add or tighten `Starting point`
- convert vague `Execution note` prose into a controlled posture label
- add concrete pattern anchors
- rewrite verification into observable done signals
- strengthen test scenarios to reduce coverage invention

### 改造意图
这会让 deepening 更像“补执行就绪度缺口”，而不是“把 plan 重写一遍”。

---

## 5.3 增加边界声明：补执行友好性，不补成执行脚本

建议在 synthesize/update rule 附近新增原则：

> Deepening may strengthen execution readiness, but must not turn the plan into implementation code, shell choreography, or RED/GREEN/REFACTOR micro-steps.

### 改造意图
这是防止 `spec-plan` drift 回 `writing-plans` 的关键边界句。

---

## 6. `plan-handoff.md` 改造方案

## 6.1 新增 execution-facing derived artifact 概念

位置：
- `skills/spec-plan/references/plan-handoff.md`
- 建议放在 `Final Checks and Cleanup` 之后，或 `Post-Generation Options` 之前

建议新增规则：

- For plans likely to be handed to a low-context implementer, generate or prepare an execution-facing summary layer derived from the plan.
- This summary does not replace the plan and must not introduce new decisions.

### 改造意图
把“主 plan 保持干净”和“执行 handoff 足够低摩擦”这两个目标分层解决。

---

## 6.2 定义 execution brief 的最小内容

建议派生 brief 至少包含每个 implementation unit 的：

- Goal
- Dependencies
- Starting point
- Concrete pattern anchors
- Test landing hints
- Execution note
- Done signal
- Common misread / caution when warranted

### 改造意图
brief 的职责不是替代计划，而是降低低上下文执行者的重新规划成本。

---

## 6.3 明确主从关系

建议在 handoff contract 中明确：

- 主 plan 仍是 source of truth
- execution brief 是 derived artifact
- `spec:work` 后续应优先消费 `plan + brief`，而不是从正文重新萃取全部执行意图

### 改造意图
这保证：
- durable artifact 仍是主文档
- execution-facing 优化在派生层演进
- 后续 contract tests 有稳定锚点

---

## 7. 推荐实施顺序

## Phase 1：低风险高收益

建议先做：

1. `Plan Quality Bar` 增加 `Execution Readiness`
2. `5.1 Review Before Writing` 增加 execution placeholder scan
3. `deepening-workflow.md` 增加起手清晰度 / pattern anchor / done-not-done 检查
4. `Execution note` 改为受控姿态标签

### 原因
- 不改变主 plan 结构
- 不引入新文件依赖
- 对当前 workflow 的侵入最小
- 对低上下文 handoff 的收益最大

---

## Phase 2：中风险高价值

建议第二步做：

1. `Implementation Units` 增加可选 `Starting point`
2. 收紧 `Patterns to follow` / `Test scenarios` / `Verification` 的字段 contract
3. `plan-handoff.md` 引入 execution brief 的派生层定义

### 原因
- 需要轻度改模板与 handoff 语言
- 但仍属于文档 contract 层，不需要先动 `spec:work`

---

## Phase 3：与下游联动实现

建议最后做：

1. 让 `spec:work` 消费 `Execution note` 的结构化标签
2. 让 handoff 真正生成 `execution brief`
3. 用 contract tests 守护新增字段与 posture 信号

### 原因
这是产品级增强，不应在主 contract 尚未稳定前直接实现。

---

## 8. 最终建议

如果只选最值得先落地的一批，我建议优先收口这 5 项：

1. 新增 `Execution Readiness`
2. 新增 `Execution Placeholder Scan`
3. 强化 implementation unit 的起手清晰度检查
4. 强化 verification 的 done/not-done 区分能力
5. 把 `Execution note` 结构化为姿态标签

这 5 项几乎不改变 `spec-plan` 的哲学，却能显著降低：

- implementer 误读
- delegate agent 再次做 planning
- 测试 coverage 现场发明
- plan 看似完整但执行时漂移

一句话总结：

> `spec-plan` 下一阶段最值得做的，不是把 plan 写得更像脚本，而是把“会让执行者走偏的隐含判断”更稳定地外显出来。