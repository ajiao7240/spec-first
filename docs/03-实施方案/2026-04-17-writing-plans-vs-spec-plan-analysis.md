# writing-plans vs spec-plan 深度对比分析

> 对比对象：
> - Superpowers：`/Users/kuang/xiaobu/superpowers/skills/writing-plans/SKILL.md`
> - spec-first：`/Users/kuang/xiaobu/spec-first/skills/spec-plan/SKILL.md`
>
> 目标：回答 `spec-plan` 是不是“实现类型”的功能、它与 `writing-plans` 的本质差异、当前 `spec-plan` 是否更强，以及两者的优劣势与适用边界。

## 1. 先给结论

### 1.1 `spec-plan` 不是实现型 skill

`spec-plan` 的核心职责是 **planning**，不是 implementation。

它明确写了：

- `spec:brainstorm` 定义 **WHAT** to build
- `spec:plan` 定义 **HOW** to build
- `spec:work` executes the plan

并且正文直接强调：

- 这个 workflow **produces a durable implementation plan**
- 它 **does not implement code, run tests, or learn from execution-time results**
- 如果答案依赖“改代码看看会发生什么”，那应该去 `spec:work`，不是 `spec:plan`

所以从 contract 上看，`spec-plan` 非常明确地把自己定位为：

> 一个负责研究、决策、结构化方案、生成 durable plan 的 planning skill。

它可以规划实现，但自己不负责实现。

### 1.2 `writing-plans` 也不是实现型 skill

`writing-plans` 同样不是实现型 skill。它是一个更偏“执行前编排”的 planning skill。

它负责把一个已批准 spec 转成：

- 低上下文执行者也能照着做的计划
- task-by-task 的 bite-sized 执行单元
- 带 TDD、命令、代码片段、commit 节拍的执行脚本式文档

所以两者都不是 implementation 本身，但它们靠 implementation 的距离不同：

- `writing-plans`：**更靠近执行层**
- `spec-plan`：**更靠近决策/设计/研究层**

### 1.3 如果问“当前 skill 是否比 writing-plans 更强”

如果当前 skill 指的是 **`spec-plan`**，结论是：

- **在“通用技术规划 / repo-grounded research / durable plan quality / 边界控制”上，`spec-plan` 更强。**
- **在“为 agent 直接执行而写、压缩实现自由度、TDD 微步拆解”上，`writing-plans` 更强。**

也就是说，不是简单的谁全面碾压谁，而是二者优化目标不同。

如果硬要给一句总评：

> `spec-plan` 更像高级技术规划器；`writing-plans` 更像执行前工单编译器。

---

## 2. 两个 skill 的本体定位

## 2.1 writing-plans 的定位

`writing-plans` 的核心句可以概括成：

> 把已批准的 spec 写成低上下文工程师也能执行的 implementation plan。

它的关键词是：

- zero context engineer
- bite-sized tasks
- exact file paths
- complete code in steps
- exact commands with expected output
- DRY / YAGNI / TDD / frequent commits

因此它的计划本质上不是“决策文档”，而是“执行说明书”。

## 2.2 spec-plan 的定位

`spec-plan` 的核心句可以概括成：

> 基于 requirements、repo patterns、institutional learnings 和必要的外部研究，生成 durable、portable、可 review 的技术计划。

它的关键词是：

- decisions, not code
- research before structuring
- right-size the artifact
- separate planning from execution discovery
- durable implementation plan
- repo-relative paths
- implementation units
- confidence check
- spec-doc-review

因此 `spec-plan` 的计划本质更接近：

- 技术方案文档
- 交付与协作工件
- 实施设计蓝图
- 可持续维护的 planning artifact

---

## 3. 两者最根本的分歧：plan 是“执行脚本”还是“决策工件”

这是两个 skill 最大的哲学分叉。

### 3.1 writing-plans：plan = 面向执行者的详细脚本

在 `writing-plans` 里，一份 plan 应该包含：

- 精确文件路径
- 具体测试代码
- 最小实现代码
- 测试命令
- 预期 FAIL/PASS
- commit 命令

这代表它认为：

- 好计划应该尽量减少执行者自由发挥
- 执行者不应自己发明步骤
- TDD 节奏应该在 plan 阶段就固化
- 代码片段直接写在 plan 里有助于高成功率执行

因此它更像“面向 agent 的操作手册”。

### 3.2 spec-plan：plan = 面向实现/评审/协作的技术设计工件

在 `spec-plan` 里，计划应该包含：

- Problem Frame
- Requirements Trace
- Scope Boundaries
- Context & Research
- Key Technical Decisions
- Open Questions
- Implementation Units
- System-Wide Impact
- Risks & Dependencies
- Documentation / Operational Notes
- Sources & References

同时它明确禁止：

- 直接写 implementation code
- 写 git commands
- 写 exact test command recipes
- 展开成 micro-step 的 RED/GREEN/REFACTOR choreography

这代表它认为：

- 计划应保留“设计与约束”，而不是预写实现
- 实现细节应由 `spec:work` 或实现阶段处理
- 计划要能作为文档、review artifact、issue body、handoff artifact 存在
- 计划必须可移植、可复审、可迭代，而不是只服务单个执行 agent

所以两者不是同一种 plan，只是都叫 plan。

---

## 4. spec-plan 是不是“实现类型功能”

严格说，不是。

但它和实现关系很近，可以称为：

- **实现前规划功能**
- **implementation-oriented planning**
- **execution-adjacent planning**

更准确的分类方式：

| 分类 | writing-plans | spec-plan |
|---|---|---|
| 是否直接实现代码 | 否 | 否 |
| 是否执行测试 | 否 | 否 |
| 是否依赖 execution-time discovery | 否 | 否 |
| 是否为实现做准备 | 是 | 是 |
| 离实现层的距离 | 更近 | 中等 |
| 产物定位 | 执行手册 | 技术计划/实施设计 |

所以如果用户问“它是不是实现类型的功能”，最准确回答是：

> 它不是 implementation skill，但它是 implementation-facing 的 planning skill。

---

## 5. 执行流程对比

## 5.1 writing-plans 的流程

可以简化为：

1. 接收已批准 spec
2. 做 scope check
3. 先锁文件结构
4. 拆成 bite-sized tasks
5. 每个 task 写出测试/实现/命令/提交步骤
6. 做 self-review
7. 保存计划
8. 交给 `subagent-driven-development` 或 `executing-plans`

这个流程的特点是：

- 研究成分低
- repo grounding 要求相对弱
- planning 与 execution 紧耦合
- handoff 非常直接

## 5.2 spec-plan 的流程

`spec-plan` 的流程明显更长、更重：

1. Resume/source/scope
2. 判断软件/非软件域
3. 查找 upstream requirements doc
4. 必要时做 planning bootstrap
5. 评估 plan depth
6. 本地 research（repo patterns、learnings）
7. 按需 external research
8. flow / edge-case analysis
9. resolve planning questions
10. 结构化 plan
11. 写 plan file
12. confidence check / deepening
13. mandatory `spec-doc-review`
14. post-generation handoff options

它的特点是：

- planning 前研究更多
- 对 source document / repo / learnings 的依赖更强
- 计划质量控制链更完整
- 文档作为长期工件的属性更强

---

## 6. 依赖关系与工作流位置对比

## 6.1 writing-plans 的上下游

上游：
- `brainstorming`

下游：
- `subagent-driven-development`（推荐）
- `executing-plans`
- 最终收敛 `finishing-a-development-branch`

说明：
- 它是典型的“设计 → 可执行计划 → 实施”三段式中间环节
- 非常偏 agent execution workflow

## 6.2 spec-plan 的上下游

上游：
- `spec:brainstorm`（优先，但非必须）
- 用户直接输入 / requirements doc
- docs/brainstorms/ 中的 origin document
- Stage-0 bootstrap context

横向依赖：
- repo-research-analyst
- learnings-researcher
- framework-docs-researcher
- best-practices-researcher
- spec-flow-analyzer
- architecture-strategist 等 deepening agents

下游：
- `spec:work`
- `spec-doc-review`
- issue creation / plan share / editor open 等后续协作动作

说明：
- `spec-plan` 已经不是单一 skill，而是一个规划 orchestration workflow
- 它连接研究、规划、评审、交付多个阶段

---

## 7. 当前 spec-plan 是否比 writing-plans 强

结论：**在“planning 能力”这个维度上，当前 `spec-plan` 更强、更成熟、更完整。**

但如果把“强”定义成“更能直接驱动 agent 自动把活干掉”，那不一定。

所以必须分维度比较。

## 7.1 spec-plan 更强的地方

### A. 问题分类与路由能力更强

`spec-plan` 能判断：

- 软件 vs 非软件任务
- 直接 planning vs 先去 brainstorm
- 新建 plan vs 恢复旧 plan
- 普通编辑 vs deepening fast path
- lightweight / standard / deep depth

`writing-plans` 基本假设输入已经是稳定的、批准过的 spec，路由能力弱很多。

### B. 研究能力更强

`spec-plan` 强调：

- local research always runs
- institutional learnings
- conditional external research
- flow analysis
- deepening targeted agents

而 `writing-plans` 几乎没有成熟的 research pipeline，它更像接过 spec 后直接编排任务。

### C. 文档质量控制更强

`spec-plan` 有：

- review before writing
- confidence check
- deepening workflow
- mandatory spec-doc-review
- post-generation options

`writing-plans` 只有一个轻量 self-review，虽然高效，但质量守门的层次更浅。

### D. 计划工件更 durable、更 portable

`spec-plan` 明确强调：

- repo-relative paths
- portable artifact
- 可以作为 issue body / review artifact / living document
- planning 与 execution boundary 分离

而 `writing-plans` 的文档更偏 harness-specific 执行文档，跨平台和跨协作角色的通用性较弱。

### E. 边界控制更清晰

`spec-plan` 反复强调：

- Decisions, not code
- Separate planning from execution discovery
- Never code
- 不要用 fake certainty 掩盖 implementation-time unknowns

这使它在“规划不越界”上更稳健。

## 7.2 writing-plans 更强的地方

### A. 对 agent 执行更友好

`writing-plans` 的计划几乎可以直接拿去执行：

- 路径有了
- 测试有了
- 实现骨架有了
- 命令有了
- 提交节奏有了

如果目标是让 agent 少判断、快开工，它比 `spec-plan` 更直接。

### B. TDD 执行姿势更强

`writing-plans` 不是轻描淡写地说“建议测试优先”，而是直接把：

- failing test
- verify fail
- minimal implementation
- verify pass
- commit

写进任务模板里。

相比之下，`spec-plan` 只会在必要时用 `Execution note` 轻量携带 test-first / characterization-first posture，不会把 plan 写成 TDD choreography。

### C. 对低上下文执行者更“保姆式”

`writing-plans` 明确假设执行者：

- 几乎没有上下文
- 不擅长测试设计
- 会偷懒或过度发挥

因此它会更彻底地消灭执行歧义。

`spec-plan` 的前提是“实现者应当能根据计划做出合理工程判断”，所以保姆程度低一些。

### D. 执行 handoff 更短

`writing-plans` 写完后直接二选一：

- subagent-driven
- executing-plans

流程非常短。

`spec-plan` 写完之后还要 confidence check、spec-doc-review、post-options，节奏更重。

---

## 8. 优劣势总表

| 维度 | writing-plans | spec-plan |
|---|---|---|
| 核心定位 | 执行前工单编译器 | 高级技术规划工作流 |
| 是否实现型 | 否 | 否 |
| 离实现距离 | 很近 | 中等 |
| 计划形态 | 执行脚本式 | 决策工件式 |
| 是否写代码到 plan | 是，明确允许且要求 | 否，明确禁止 |
| 是否写命令 choreography | 是 | 否 |
| 是否支持 repo/institutional/external research | 弱 | 强 |
| 是否支持 plan depth 分层 | 弱 | 强 |
| 是否支持 resume/deepen | 基本没有 | 强 |
| 是否支持非软件 planning | 否 | 是 |
| 是否适合 issue / review artifact | 一般 | 强 |
| 是否适合 agent 直接执行 | 很强 | 中等 |
| TDD 执行约束 | 强 | 中等（轻量 signal） |
| 质量门禁 | 自检为主 | confidence check + spec-doc-review |
| 可移植性 | 较弱 | 强 |
| 上手速度 | 快 | 较慢 |
| token / orchestration 成本 | 低 | 高 |

---

## 9. 从 spec-first 项目视角看：为什么 spec-plan 更适合当前仓库

如果把场景拉回 `spec-first` 仓库，`spec-plan` 更适合作为主 planning workflow，原因主要有 5 点。

### 9.1 spec-first 本身就是“规划-执行-评审”链路产品

`spec-first` 仓库不是单纯写业务代码，而是在构建 workflow assets、contract、research、bootstrap、review 流水线。

这种仓库天然需要：

- planning artifact 可复审
- 能引用上游 brainstorm 文档
- 能连到 downstream review/work
- 能处理研究与上下文注入

这正是 `spec-plan` 的强项。

### 9.2 当前仓库非常强调 contract 与文档治理

从 `spec-plan` 自己的设计也能看出，spec-first 更看重：

- repo-relative path portability
- origin traceability
- confidence check
- spec-doc-review gate
- deepening 和 contract consistency

这类仓库不适合把 plan 写成含大量命令和实现代码的 harness-specific 脚本。

### 9.3 spec-first 需要兼容更多 planning 场景

`spec-plan` 不只处理软件 feature，还能处理：

- 非软件 multi-step 任务
- 已有 plan 的 deepen/update
- 从 requirements 文档继续推进

这使它比 `writing-plans` 的适用面更广。

### 9.4 spec-first 更重视“planning 与 execution 分离”

`spec-plan` 把：

- 规划时能确定的
- 需要执行时才能确定的

分得很开。

这和 spec-first 的方法论更一致。

### 9.5 spec-first 已经把 planning 做成一个 orchestration workflow

`spec-plan` 不是简单移植一个 planning prompt，而是把 planning 变成：

- 可分层
- 可研究
- 可 deepening
- 可 spec-doc-review
- 可 handoff

的完整工作流。这个成熟度显著高于 `writing-plans`。

---

## 10. 但 spec-plan 也不是无条件更好

这里要避免一个误区：`spec-plan` 更强，不等于在任何场景都更优。

以下场景，`writing-plans` 反而可能更有效：

### 10.1 任务已经非常明确，只差快速执行

如果需求明确、repo 熟悉、实现模式成熟，用户要的是：

- 快点拆步骤
- 快点交给 agent 干
- 不想花太多 token 在研究、review、deepening 上

那 `writing-plans` 更直接。

### 10.2 执行者极度低上下文

如果下游执行者非常弱，或者你希望把每一步都尽量锁死，那么 `writing-plans` 的微步与代码片段优势会明显体现。

### 10.3 你想强推 TDD choreography

如果目标是用 plan 强制执行者以 RED/GREEN/REFACTOR 节奏工作，`writing-plans` 的风格更合适。

---

## 11. 如果只保留一个，应该保留哪个

站在当前 `spec-first` 仓库的角度，我会建议：

> **保留 `spec-plan` 作为主 planning workflow，不要回退到 `writing-plans` 模式。**

原因是：

- `spec-plan` 更贴合本仓库的 contract-first / artifact-first / review-first 风格
- `spec-plan` 的 planning 边界更健康
- `spec-plan` 更适合长期维护和多种输入来源
- `spec-plan` 已经形成与 `spec:brainstorm` / `spec:work` / `spec-doc-review` 的完整协同链路

但也可以明确吸收 `writing-plans` 的部分优点，而不是整套回退：

### 可借鉴点 1：提高 implementation units 的执行可操作性
现在 `spec-plan` 的 unit 已经不错，但还可以继续吸收 `writing-plans` 的优点：
- 对 feature-bearing 单元，把 verification / test scenarios 写得更像可落地的执行提示
- 减少“实现者自己补 coverage”的空间

### 可借鉴点 2：在特定场景强化 test-first posture
对高风险或行为改动明显的 unit，可以更明确地要求：
- 先写 failing test
- 或至少用 characterization-first

但保持为轻量 execution note，而不是把 plan 退化成 choreography。

### 可借鉴点 3：对低上下文委派场景增加“执行提示层”
如果未来 `spec:work` 常被外部 delegate agent 执行，可以考虑在不污染主 plan 的前提下，生成一个附属 execution brief，而不是把代码和命令塞回 plan 正文。

---

## 12. 最终判断

### 判断 1：`spec-plan` 是不是实现类型功能？
不是。它是 planning workflow，不负责实现代码。

### 判断 2：它和 `writing-plans` 是不是同类？
同属 planning 类，但不是同一种 planning。

- `writing-plans`：execution-script-oriented planning
- `spec-plan`：decision-and-artifact-oriented planning

### 判断 3：当前 `spec-plan` 是否比 `writing-plans` 强？
从 `spec-first` 当前目标和仓库治理方式看，**是，更强。**

但这个“更强”主要体现在：
- 规划完整度
- 研究能力
- 文档质量控制
- artifact durability
- 边界清晰度
- 与本仓库 workflow 的耦合质量

不是体现在“更适合直接拿去让 agent 无脑执行”。

### 判断 4：两者谁更适合当前仓库？
`spec-plan` 更适合当前 `spec-first`。

---

## 13. 源文件依据

- `superpowers/skills/writing-plans/SKILL.md`
- `spec-first/skills/spec-plan/SKILL.md`
- `spec-first/skills/spec-plan/references/deepening-workflow.md`
- `spec-first/skills/spec-plan/references/plan-handoff.md`
- `spec-first/CHANGELOG.md`

## 14. 一句话总结

`writing-plans` 解决的是“怎么把任务写得足够细，让 agent 立刻开干”；`spec-plan` 解决的是“怎么把一个需求规划成可研究、可评审、可维护、可持续深化的实施方案”。

如果目标是 **高质量规划体系**，`spec-plan` 更强；如果目标是 **最短路径驱动执行**，`writing-plans` 更猛。