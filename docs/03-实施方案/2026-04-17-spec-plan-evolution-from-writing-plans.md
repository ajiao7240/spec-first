# spec-plan 可从 writing-plans 吸收哪些能力

> 目标：站在顶尖 AI 效能研发与 workflow 设计的视角，分析 `spec-plan` 不应回退成 `writing-plans`，但可以吸收哪些高价值能力，以进一步提升 `spec-plan` 在 agent execution、handoff 质量、计划可执行性与低上下文委派成功率上的表现。

## 1. 核心判断

先给结论：

> `spec-plan` 不应该退化成 `writing-plans` 那种“把实现代码、命令、提交步骤直接写进计划正文”的执行脚本模式；但它非常值得吸收 `writing-plans` 在 **执行摩擦最小化**、**低上下文代理适配**、**task 粒度校准**、**计划可执行性自检** 这几个方向的精华。

更具体地说：

- `spec-plan` 的强项是：研究、决策、边界、durable artifact、review-quality、deepening、跨场景 planning
- `writing-plans` 的强项是：让下游 agent 少判断、快开工、少跑偏、少补脑、少漏测

所以最优演进方向不是二选一，而是：

> 保持 `spec-plan` 的 artifact-first / decisions-first 边界，同时内嵌一层更强的 **execution-readiness intelligence**。

也就是让 `spec-plan` 从“高质量技术计划器”升级成：

> **高质量技术计划器 + agent-execution handoff optimizer**

---

## 2. 不能照搬的部分：spec-plan 必须守住哪些边界

在讨论“吸收什么”之前，先明确 **不能吸收什么**，否则很容易把 `spec-plan` 做坏。

## 2.1 不要把实现代码写回 plan 正文

`writing-plans` 会直接把：

- test code
- minimal implementation code
- shell commands
- commit message / git choreography

写进计划里。

这对 Superpowers 那种“plan 直接喂 agent 执行”的形态很有效，但对 `spec-plan` 来说会损害这些核心优势：

- 文档可移植性下降
- review artifact 属性变差
- planning / execution 边界被打穿
- 计划变成 harness-specific，而不是 repo-stable artifact
- 计划在实现 drift 后更容易快速过时

所以：

> **不要把 `spec-plan` 变成带代码和命令的执行脚本。**

## 2.2 不要把 implementation unit 退化成 micro-step choreography

`writing-plans` 的 2–5 分钟微步拆解适合强约束执行，但不适合 `spec-plan` 当前的 implementation unit 哲学。

`spec-plan` 当前的 unit 设计是：

- 一个 meaningful change
- 通常能落成 atomic commit
- 足够具体，但不预写实现

如果把它退回成：

- Step 1: write failing test
- Step 2: run test to fail
- Step 3: write implementation
- Step 4: run test to pass
- Step 5: commit

那么会损害：

- 计划的可读性
- 计划的 review 信噪比
- 计划的 durable 性
- 中大型计划的压缩表达能力

所以：

> **不要把 implementation units 重新降级成任务脚本。**

## 2.3 不要削弱 deepening / document-review / planning boundary

`writing-plans` 的质量控制偏轻，适合快速 handoff；而 `spec-plan` 的真正优势恰恰来自：

- confidence check
- targeted deepening
- mandatory document-review
- planning-time vs execution-time unknowns separation

这些不能因为要“更好执行”而被弱化。

---

## 3. spec-plan 真正应该吸收的 8 类能力

## 3.1 吸收能力一：显式引入“执行就绪度”质量维度

这是最重要的一条。

`spec-plan` 现在很强，但它的质量 bar 更偏：

- 是否合理
- 是否完整
- 是否 grounded
- 是否可 review

它还可以再加一个明确维度：

> **执行就绪度（Execution Readiness）**

也就是：

- implementer 是否还需要自己发明太多内容？
- unit 是否过大，以至于执行时会漂移？
- test scenarios 是否具体到足以直接写测试？
- verification 是否具体到能看出 done/not-done？
- 下游 agent 是否会因为上下文缺口而重新做 planning？

### 建议做法
在 `Plan Quality Bar` 与 `5.1 Review Before Writing` 中新增一组 execution-readiness 检查项，例如：

- Each implementation unit leaves minimal unplanned decision-making to the implementer
- Test scenarios are specific enough to translate into tests without inventing coverage shape
- Verification statements can distinguish partial completion from done
- Dependencies between units are explicit enough that the implementer will not reorder work incorrectly
- The plan does not rely on “similar to previous unit”, “follow existing pattern” without naming the actual pattern/file

### 为什么重要
因为 AI 执行失败，大多数不是“完全没计划”，而是：

- 计划看起来对，但执行时仍有过多隐含判断
- implementer 在空白处自己补脑，结果补歪了

`writing-plans` 最强的地方，就是它默认这些隐含判断都会出问题。`spec-plan` 可以吸收这种悲观而现实的视角。

---

## 3.2 吸收能力二：把“低上下文执行者”设为显式对手模型

`writing-plans` 有一个极强的设计假设：

> 下游执行者几乎没有上下文，而且不擅长测试设计，甚至可能有 questionable taste。

这个假设很残酷，但对 AI planning 极其有效。

`spec-plan` 虽然已经有 implementation-unit、patterns-to-follow、test scenarios，但它默认 implementer 仍然具备比较健康的工程判断。

这在很多场景成立，但在以下场景不够：

- 外部 delegate agent
- 新会话执行
- token 受限子 agent
- 多次 handoff 后的实现
- 对该代码区域不熟悉的模型/工程师

### 建议做法
不要改整体哲学，但可以在 `Implementation Units` 章节引入一个轻量提醒：

> Write units as if the implementer understands code, but not your unstated assumptions.

并把这条原则具体化为：

- pattern 必须点名具体文件/组件，而不是泛指“follow existing patterns”
- verification 必须能让人判断 done/not-done，而不是“looks right”
- dependencies 必须说明“为什么先做这个”
- 当某个 unit 极易引发误判时，要补足 `Execution note` 或 `Technical design`

### 为什么重要
这不会把 `spec-plan` 变成保姆式脚本，但能显著减少下游 agent 把 plan 重新解释成另一个方案的概率。

---

## 3.3 吸收能力三：强化 implementation unit 的“可着手性”标准

`spec-plan` 目前强调：

- unit 不能太大
- 不能太 vague
- 应能落成 atomic commit

这已经不错，但还可以更进一步吸收 `writing-plans` 的经验：

> 一个好的 unit，不只是“边界对”，还应该“让实现者一看就知道怎么起手”。

这不是要求写代码，而是要求 unit 具备更高的启动清晰度。

### 建议增加的检查问题
每个 implementation unit 都可以隐式通过下面 5 个问题：

1. 实现者第一步会去哪个文件？
2. 它先验证什么行为或 contract？
3. 哪个测试文件承接这个 unit？
4. 它依赖哪个上游 unit 的结果？
5. 做完后什么 observable outcome 证明它完成了？

### 建议做法
不用把这 5 问写进计划正文，但可以把它们加入：

- 5.1 Review Before Writing
- 5.3 deepening 的 `Implementation Units` 检查项

或者加入 `Execution Readiness` 子节作为内部 rubric。

### 为什么重要
很多计划“看起来细”，但 implementer 仍然不知道第一锹土该从哪挖。这正是 `writing-plans` 最擅长解决的问题。

---

## 3.4 吸收能力四：把 placeholder 检查从“文本占位”升级为“执行占位”检查

`writing-plans` 的 “No Placeholders” 很强，因为它不仅防 `TODO/TBD`，更防这种伪完成表达：

- add appropriate error handling
- write tests for above
- similar to task N
- handle edge cases

`spec-plan` 现在已经防很多泛化表达，但还可以再升级成：

> **Execution Placeholder Scan**

也就是不仅查文本占位，还查“把真正的 planning decision 偷偷丢给执行阶段”的表述。

### 建议新增的坏味道模式
在 `5.1 Review Before Writing` 或 `deepening-workflow.md` 中加入这类红旗：

- “follow existing patterns” but no concrete pattern named
- “handle edge cases appropriately” with no named edge cases
- “validate integration” with no specific integration scenario
- “update tests accordingly” with no test file path or scenario shape
- “make any required refactors” with no trigger condition or boundary
- “if needed” / “as appropriate” / “where relevant” used in unit-level approach without a narrowing condition

### 为什么重要
对于 AI 来说，这类模糊话和 `TODO` 本质上没有差别，只是更像完成品。

---

## 3.5 吸收能力五：升级 Execution note，让它从“可选提醒”变成“受控姿态标签”

目前 `spec-plan` 已有 `Execution note`，但它还是偏自由文本。可以从 `writing-plans` 吸收一种更强的执行姿态表达能力。

### 建议方向
把 `Execution note` 逐步演进为一个受控枚举 + 可选说明，例如：

- `Execution note: test-first`
- `Execution note: characterization-first`
- `Execution note: integration-first`
- `Execution note: external-delegate`
- `Execution note: contract-first`
- `Execution note: migration-safety-first`

必要时可带补充说明：

- `Execution note: integration-first — start by proving request/response contract against the existing boundary`

### 为什么这样更好
相比自由文本：

- 下游 `spec:work` 更容易稳定消费
- contract test 更容易守护
- 后续可以按姿态标签做 execution routing 或 reviewer routing
- plan 仍然不需要写成微步 choreography

这相当于从 `writing-plans` 吸收“执行节拍意识”，但以更现代、更结构化的方式落地。

---

## 3.6 吸收能力六：增加“低上下文 handoff 附件层”，而不是污染主 plan

这是我认为最值得做的产品级增强。

`writing-plans` 的巨大优势是：写完后非常容易直接交给 agent 干。

`spec-plan` 的巨大优势是：plan 本身是 durable artifact。

最优做法不是混成一份文档，而是做 **双层输出**：

### 主文档层
继续保持当前 `spec-plan` 正文：
- decisions-first
- artifact-first
- reviewable
- durable

### 附件层 / 派生层（可选）
由 `spec-plan` 或后续 `spec:work` 生成一个轻量 handoff brief，例如：

- 每个 unit 的起手文件
- 要跟随的具体 pattern 文件
- 测试落点提示
- execution posture
- 常见误解提醒
- 本 unit 完成信号

这个 brief 可以是：
- plan 内部附录
- 侧车文件（如 `docs/plans/...-execution-brief.md`）
- 只在 `spec:work` 读取 plan 后即时生成的执行摘要

### 为什么这是高级解法
因为这样既保住了 `spec-plan` 的主文档质量，又吸收了 `writing-plans` 的直接执行优势。

我的判断是：

> **`spec-plan` 最不该做的是把主 plan 写脏；最该做的是增加一个 execution-facing derived artifact。**

---

## 3.7 吸收能力七：引入“起手提示（starting move hint）”而不是微步

`writing-plans` 强在它让执行者知道“第一步干什么”。

`spec-plan` 不需要改成微步，但可以给每个 unit 一个极轻量字段：

- `Starting point:`
- 或 `First move:`
- 或 `Implementation entry:`

例如：

- `Starting point: Inspect src/cli/plugin.js and existing asset sync tests before introducing the new manifest transform.`
- `Starting point: Add the failing contract test in tests/unit/spec-plan-contracts.test.js for the missing route first.`

### 好处
- 帮 implementer 快速进入状态
- 显著减少“第一步该看哪里”的成本
- 不会把 plan 膨胀成 choreography

### 风险控制
只对以下情况启用：
- unit 跨多个文件
- unit 容易误起手
- unit 是 legacy area
- unit 是 contract-heavy / integration-heavy 改动

这相当于吸收 `writing-plans` 的“第一步清晰度”，但不复制它的所有微步。

---

## 3.8 吸收能力八：把 self-review 中的 3 个硬问题移植进 spec-plan 的 final review

`writing-plans` 的 self-review 很朴素，但非常实用：

- spec coverage
- placeholder scan
- type consistency

`spec-plan` 现在的检查更全面，但未必总像这三条一样“直戳执行失败根源”。

### 建议做法
把这三条以 `execution-focused sanity check` 的形式并入 `5.1 Review Before Writing`：

1. **Coverage sanity check**
   - 每个 requirement 是否都能映射到至少一个 implementation unit？

2. **Placeholder sanity check**
   - 是否存在看似完整、实则把关键判断丢给实现阶段的表达？

3. **Naming / type consistency sanity check**
   - unit 间的概念、接口名、模块名、状态名是否前后一致？

### 为什么值得
因为这 3 条非常便宜，但对 execution success 的影响巨大，属于高 ROI 检查项。

---

## 4. 推荐的演进路线：分三层推进

如果从产品演进角度看，我建议不要一次性大改，而是分三层推进。

## Layer 1：低风险高收益增强（建议立刻做）

这些几乎不改变 `spec-plan` 哲学，但能明显提升执行友好度：

1. 在 `Plan Quality Bar` 加入 **Execution Readiness** 维度
2. 在 `5.1 Review Before Writing` 增加：
   - execution placeholder scan
   - first-move clarity check
   - unit-level done/not-done clarity check
3. 在 `deepening-workflow.md` 的 `Implementation Units` checklist 里加入：
   - implementer starting ambiguity
   - missing concrete pattern anchors
   - weak verification outcomes
4. 将 `Execution note` 收紧为受控姿态标签

### 预期收益
- 计划更容易被下游 agent 正确启动
- 不需要改变文档主形态
- 合同测试也更容易补齐

## Layer 2：中风险高价值增强（建议下一步做）

1. 为 implementation unit 增加可选字段：`Starting point` / `First move`
2. 明确要求 feature-bearing unit 说明“完成信号”足以区分 partial/done
3. 为高风险 unit 增加更明确的 test posture routing（如 contract-first / migration-safety-first）

### 预期收益
- 降低低上下文委派失败率
- 降低 `spec:work` 再次做 planning 的概率

## Layer 3：架构级增强（最值得，但要设计好）

1. 引入 execution-facing 派生工件：`execution brief`
2. 让 `spec:work` 优先消费 plan + brief，而不是从 plan 正文里自行萃取所有执行意图
3. 根据 `Execution note` 标签做 reviewer / executor routing 优化

### 预期收益
- 同时保留 durable plan 与 direct execution 两大优势
- 为未来 external delegate / low-context subagent 执行奠定基础

---

## 5. 一个顶尖 AI workflow 设计者会怎么取舍

如果用一句更“AI效能研发”视角的话说：

> 最优 planning 系统，不是把所有执行细节硬编码进计划，而是把“会让执行者犯错的隐含决策”识别出来，并以最小、最稳定、最可维护的方式外显化。

`writing-plans` 的价值，不在于它写了代码和命令；真正的价值在于它提醒我们：

- 执行者会缺上下文
- 执行者会在模糊处自行发明
- 执行者会漏掉测试与验证
- 执行者会在第一步就走偏

`spec-plan` 下一阶段该吸收的，正是这套“对执行失败模式的现实主义建模”。

换句话说：

> `spec-plan` 不需要变成 `writing-plans`，但必须比现在更懂“为什么执行 agent 会失败”。

---

## 6. 最终建议清单

### 必做
- 新增 Execution Readiness 质量维度
- 新增 execution placeholder scan
- 强化 unit 的起手清晰度检查
- 强化 verification 的 done/not-done 区分能力
- 把 `Execution note` 结构化为姿态标签

### 应做
- 增加可选 `Starting point` 字段
- 在 deepening workflow 中加入 implementer ambiguity scoring
- 对高风险 unit 加强 test posture / contract posture 信号

### 值得长期投入
- 设计 plan 的 execution brief 派生层
- 让 `spec:work` 与 reviewer routing 消费这些 execution posture signals

### 不要做
- 不要往 plan 正文塞实现代码
- 不要写 git / shell choreography
- 不要把 implementation unit 退化成 2–5 分钟微步脚本
- 不要为了“更易执行”而打穿 planning / execution 边界

---

## 7. 一句话总结

`writing-plans` 最值得 `spec-plan` 学的，不是“写代码到计划里”，而是：

> **把低上下文执行者当成真实约束，把执行失败模式当成 planning 输入，把执行摩擦最小化当成独立质量目标。**

一旦 `spec-plan` 吸收这一点，它会从“高质量计划生成器”进一步进化成“真正为 AI 执行优化的 planning control plane”。
