# `spec-write-tasks` 技术方案

> 文档角色：`任务编译层 / plan-work 之间的可选派生工件`
>
> 日期：`2026-04-26`
>
> 范围：定义 `spec-write-tasks` 的定位、输入输出、任务文档结构、路由规则、与 `spec-plan` / `spec-work` 的联动边界，以及落地顺序
>
> 参考基线：[项目角色](../10-prompt/项目角色.md)

## 1. 结论先行

`spec-write-tasks` 应该被设计成一个**可选的、派生型的任务编译层**，位于 `spec-plan` 和 `spec-work` 之间。

它解决的问题不是“有没有 task list”，而是：

- 大 plan 在执行时上下文太重
- 执行 agent 需要边理解方案边拆任务，容易脑补
- plan 和 work 之间缺少显式的执行压缩层

因此，`spec-write-tasks` 的职责只应是：

1. 读取已经收敛的 plan
2. 把 plan 编译成 task pack
3. 显式表达依赖、并行、文件边界、测试焦点、完成信号
4. 为 `spec-work` 提供更低上下文、更稳定的执行输入

它**不应该**变成：

- 第二份 plan
- 新的状态机
- 进度数据库
- 审批 gate
- 执行器

---

## 2. 背景与问题

### 2.1 当前链路的真实形态

当前 `spec-first` 的主链路是：

```text
spec-brainstorm -> spec-plan -> spec-work -> spec-code-review -> spec-compound
```

其中：

- `spec-plan` 负责把 WHAT 收敛成 HOW
- `spec-work` 负责执行
- `spec-work` 内部已经会根据 plan 生成 task list

这意味着当前系统并不是“没有 task”，而是“task 生成发生得太晚，且不是独立工件”。

### 2.2 为什么大方案会出问题

当 plan 足够大时，执行 agent 需要同时做四件事：

1. 读懂技术方案
2. 识别 implementation units
3. 重建依赖顺序
4. 决定第一步从哪里下手

这个组合很容易把上下文消耗在“临场拆解”上，而不是消耗在“正确实现”上。

对大任务而言，风险不是“写代码慢”，而是：

- 任务边界漂移
- 文件职责扩张
- 并行机会没被提前识别
- 执行者开始补脑 plan 没写清的内容

### 2.3 当前仓库已经有的相关能力

`spec-plan` 已经有：

- `Requirements Trace`
- `Scope Boundaries`
- `Implementation Units`
- `Test scenarios`
- `Verification`

`spec-work` 已经有：

- 输入 triage
- task list 构建
- inline / serial / parallel 三种执行模式
- `Execution note` 的姿态识别

这说明系统缺的不是“执行能力”，而是**执行前的任务编译能力**。

---

## 3. 设计目标

### 3.1 必须达到的目标

- 降低大 plan 进入 work 的上下文压力
- 提前外显依赖、并行性、文件边界和验证焦点
- 保持 `spec-plan` 作为唯一技术方案 SoT
- 让 `spec-work` 能稳定消费 `plan` 或 `tasks`
- 保留小任务直达 `spec-work` 的简路径

### 3.2 明确不做的事

- 不把 `tasks` 做成第二份 plan
- 不把 `tasks` 做成唯一入口
- 不把 `spec-write-tasks` 做成计划审批 gate
- 不把 `spec-write-tasks` 做成执行状态机
- 不把 `spec-work` 改成只认 task 文档的硬编排器

### 3.3 对 spec-first 哲学的对齐

这个方案必须符合项目角色文档里的三条底线：

- deterministic execution belongs to scripts
- semantic analysis belongs to LLM
- scripts prepare, LLM decides

所以：

- 脚本负责准备结构化输入、hash、路径、schema 校验
- LLM 负责任务拆分、合并、并行判断、边界决策
- 不让脚本模拟语义判断
- 不让 LLM 模拟确定性工具

---

## 4. 与业界最佳实践的关系

### 4.1 Spec Kit 的启发

GitHub `spec-kit` 把链路清楚拆成：

```text
specify -> plan -> tasks -> implement
```

它最重要的启发不是某个命名，而是：

- `tasks` 是独立工件
- `tasks` 不是执行时临时心算出来的列表
- `tasks` 可以表达并行关系和依赖关系

这正好对应 `spec-first` 当前缺口。

### 4.2 Trellis 的启发

Trellis 把任务中心化做得更强：

- 任务目录
- 任务 PRD
- 实现上下文
- 检查上下文
- 生命周期 hooks

Trellis 证明了任务中心化是有价值的，但 `spec-first` 不应照搬其强状态化方式。

我们要吸收的是：

- 显式任务边界
- 可追踪依赖
- 可并行执行
- 可复用执行上下文

不要吸收的是：

- 任务文档变成状态数据库
- 任务目录成为新的长期真相源
- 任务生命周期变成中心 gate 系统

### 4.3 CodeStable 的启发

CodeStable 的 `roadmap -> items -> design -> apply` 说明：

- 规划层与执行条目层分离是有效的
- 条目级依赖比“大一统计划”更适合 agent 执行
- 任务条目应该可独立验证

但 `spec-first` 仍应比 CodeStable 更克制：

- `tasks` 是派生层，不是另一套主规划层
- plan 仍然是唯一技术方案记录

---

## 5. 总体架构

### 5.1 推荐工作流

```text
spec-brainstorm
  -> spec-plan
    -> [可选] spec-write-tasks
      -> spec-work
        -> spec-code-review
        -> spec-compound
```

### 5.2 三种合法入口

#### 入口 A：plan 直接进 work

适用：

- 1 到 2 个 implementation units
- 单文件或单模块变更
- 边界清晰
- 没有明显并行收益

#### 入口 B：plan 先进入 write-tasks，再进 work

适用：

- plan 较大
- 多个 implementation units
- 依赖关系复杂
- 存在并行机会
- 低上下文执行者容易误起手

#### 入口 C：work 直接消费 tasks

适用：

- 已有 tasks 工件
- tasks 与 source plan 对应
- hash 校验通过
- tasks 未过期

---

## 6. 路由规则

### 6.1 `spec-plan` 之后的路由

`spec-plan` 完成后，不应该强制跳进 `spec-write-tasks`。

推荐路由：

1. 先看 plan 规模
2. 再看 implementation units 数量和依赖复杂度
3. 再看文件 overlap 和并行机会
4. 再决定是否需要 task 编译

### 6.2 `spec-work` 的输入优先级

建议 `spec-work` 使用以下优先级：

1. `tasks` 存在且与 plan 对应
2. `plan` 很小，直接执行
3. `plan` 很大但没有 tasks，临时生成 task list
4. `tasks` 与 plan 冲突，拒绝执行并要求重建

### 6.3 何时应直接跳过 tasks

可以跳过 `spec-write-tasks` 的情况：

- 改动小
- 文件少
- 依赖浅
- 测试单一
- 一个 task 很容易自己拆干净

这条很重要，否则 `spec-first` 会滑向“为了完整性而完整性”。

---

### 6.4 可行性复审：路由不是线性状态机

进一步对照 `spec-kit`、Trellis、CodeStable 后，`spec-write-tasks` 的可行性成立，但前提是把它设计成**派生型执行压缩器**，而不是新的 workflow mandatory stage。

最小可行路由应该是：

```text
plan -> work
plan -> write-tasks -> work
tasks -> work
```

这三条路径必须并存。原因是：

- `spec-kit` 的 `tasks` 阶段适合明确 specification / plan / contracts / research 已经成形后的执行拆分，但它默认流程较完整，不适合作为所有小改动的硬门槛。
- Trellis 证明了 task directory / current task / injected context 对 agent 执行质量有价值，但它也引入了更重的任务生命周期和状态面。
- CodeStable 的 roadmap / checklist 体系说明“大需求先拆成可独立推进条目”是有效的，但它的强阶段退出条件更适合完整 feature 流，不应原样移植到 spec-first 的轻 contract 体系。

因此，`spec-first` 的最佳实践不是新增一个强制 `tasks` 阶段，而是在 plan 已经足够大时生成一个**可丢弃、可重建、可校验的执行输入**。

---

## 7. Artifact 设计

### 7.1 推荐落点

建议将 task pack 作为独立文件落盘：

- `docs/tasks/YYYY-MM-DD-NNN-<type>-<slug>-tasks.md`

理由：

- 与 `docs/plans/` 明确分层
- 便于 review
- 便于复用
- 便于后续 work / review 直接读取
- 不会污染 plan 主文档

### 7.2 不推荐的落点

不推荐把 tasks 直接塞回 plan 里作为大段附录，因为那会导致：

- plan 变重
- plan 和 tasks 边界混淆
- 任务编译结果不再可独立审查
- 执行器难以判断当前读到的是“决策”还是“切片”

### 7.3 建议的 frontmatter

```yaml
---
title: <Task Pack Title>
type: task-pack
status: derived
date: 2026-04-26
source_plan: docs/plans/YYYY-MM-DD-NNN-<type>-<slug>-plan.md
source_plan_hash: <hash>
generated_by: spec-write-tasks
mode: derived
---
```

### 7.4 建议的正文结构

- Overview
- Task Graph
- Execution Waves
- Task Cards
- Validation Notes
- Regeneration Rules

---

## 8. Task Pack Schema

### 8.1 顶层字段

| 字段 | 作用 |
| --- | --- |
| `source_plan` | 指向唯一来源 plan |
| `source_plan_hash` | 防 drift |
| `generated_by` | 记录生成 skill |
| `mode` | `derived` / `transient` |
| `source_sections` | 记录本 task pack 消费了 plan 的哪些章节 |
| `execution_waves` | 串行/并行波次 |
| `tasks` | 任务列表 |
| `validation_rules` | 完成前验证规则 |
| `regeneration_rules` | 何时重建 |

### 8.2 单个 task 字段

| 字段 | 作用 |
| --- | --- |
| `task_id` | 稳定编号，例如 `T001` |
| `source_unit` | 对应 plan 中的 U-ID |
| `requirement_refs` | 对应 Requirements Trace / acceptance refs |
| `goal` | 任务目标 |
| `dependencies` | 前置 task |
| `files` | 允许触达的文件 |
| `context_refs` | 该 task 必读的 plan 章节、代码模式、contracts 或 research |
| `entry_hint` | 建议从哪里开始读，不是实现步骤 |
| `test_focus` | 重点测试对象 |
| `done_signal` | 可观测完成信号 |
| `parallelizable` | 是否可并行 |
| `risk_note` | 主要风险 |
| `stop_if` | 触发回到 plan 或用户确认的越界信号 |
| `wave` | 所属执行波次 |

### 8.3 一个最小示例

```md
- T001
  source_unit: U1
  goal: 建立核心数据结构和边界
  dependencies: []
  files:
    - src/cli/...
    - tests/unit/...
  requirement_refs:
    - R1
  context_refs:
    - docs/plans/...#Implementation-Units
    - skills/spec-work/SKILL.md
  entry_hint: 先读取 plan 的 Requirements Trace 和 Scope Boundaries
  test_focus: 核心行为的最小 happy path
  done_signal: 相关测试通过，边界稳定
  parallelizable: false
  stop_if: 需要新增 plan 未声明的公开入口、配置项或长期状态文件
  wave: 1
```

---

### 8.4 任务组织粒度：不只按 implementation unit

原方案按 `Implementation Units` 生成 tasks 是合理默认，但还不够完整。结合 `spec-kit` 的 task list 组织方式和 CodeStable 的 roadmap / checklist 经验，task pack 至少应支持三种组织视角：

| 组织视角 | 适用情况 | 目标 |
| --- | --- | --- |
| Unit-first | plan 已有清晰 implementation units | 保持和 plan 的 U-ID traceability |
| Story-first | plan 明确了用户故事、acceptance examples 或端到端行为 | 每个 story 可独立实现和验证 |
| Foundation-first | 存在共享 schema、contract、adapter、测试基础设施 | 先铺最小基础，再进入可并行 feature slices |

推荐默认顺序：

1. 先识别 Foundation tasks：测试夹具、schema、contract、CLI surface、共享 helper。
2. 再按用户可验证 slice 或 implementation unit 生成 feature tasks。
3. 最后生成 integration / polish / docs / release-surface tasks。

如果只机械地把每个 implementation unit 转成一个 task，会漏掉两个关键场景：

- 一个 implementation unit 内部包含多个可独立验证的用户故事，应拆成多个 story-first tasks。
- 多个 implementation units 共享同一个前置基础设施，应提取 foundation task，避免并行执行时重复搭脚手架。

### 8.5 Task Pack 的上下文压缩边界

task pack 的价值不是“把 plan 再写一遍”，而是把执行者真正需要的上下文变成小块索引。

每个 task 应携带：

- `context_refs`：该任务必须读的 plan 章节、代码文件、contracts、research、pattern docs
- `requirement_refs`：它覆盖哪些 requirement / acceptance refs
- `forbidden_scope` 或 `stop_if`：遇到哪些情况必须停止并回到 plan 或用户确认
- `done_signal`：能被测试、diff、CLI 输出或 review 明确验证的完成信号

这借鉴了 Trellis 的 `implement.jsonl` / `check.jsonl` 注入上下文机制，但只吸收“给执行者注入最小上下文”的部分，不吸收完整 current-task 状态系统。

---

## 9. 编译规则

### 9.1 输入源

`spec-write-tasks` 的主要输入应来自：

- `Requirements Trace`
- `Scope Boundaries`
- `Implementation Units`
- `Files`
- `Test scenarios`
- `Verification`
- `Deferred to Implementation`
- 相关 research / contracts / data-model 文档

### 9.2 任务切分原则

- 一个 task 只解决一个清楚的子问题
- 一个 task 只对应一组高度相关文件
- 一个 task 只承担一种主验证目标
- 一个 task 不应同时背负无关的架构重构和功能实现
- 如果一个 task 不能用一句话说清 completion signal，通常说明它太大

### 9.3 合并规则

可以合并的情况：

- 同一模块的连续修改
- 同一测试面上的相关修改
- 一个小闭环里的实现与验证

### 9.4 拆分规则

必须拆分的情况：

- 文件集合明显过大
- 存在独立验证点
- 依赖链清晰
- 可并行
- 风险隔离需要

### 9.5 并行波次

建议在生成 tasks 时就计算波次：

- 同一 wave 内的 task 尽量不共享文件
- 若存在共享文件，自动降级为串行
- 若 task 之间存在隐式依赖，不允许放进同一 wave

这和 `spec-work` 的并行安全检查应保持一致。

---

## 10. 脚本与 LLM 的分工

### 10.1 脚本负责

- 读取 plan 文件
- 计算 task-relevant plan hash
- 归一化路径
- 检查 file overlap
- 校验 tasks schema
- 检查 tasks 与 plan 的对应关系
- 判断 tasks 是否过期

### 10.2 LLM 负责

- 判断要不要生成 tasks
- 合并或拆分 task
- 识别任务波次
- 标记 parallelizable
- 压缩 task 语言
- 判断哪些边界信息还不够，需要回到 plan 补决策

### 10.3 明确禁止

- 脚本直接决定语义拆分
- LLM 直接模拟 hash 校验
- LLM 直接充当状态机
- 脚本把 tasks 变成硬编码步骤编译器

---

### 10.4 Hash 与 schema 的最小确定性实现

`source_plan_hash` 不能含糊，否则 drift 防护会变成装饰。建议采用：

- hash 算法：`sha256`
- hash 输入：plan 中影响执行语义的章节
- 建议纳入：`Requirements Trace`、`Scope Boundaries`、`Technical Approach`、`Implementation Units`、`Files`、`Test Scenarios`、`Verification`、`Deferred to Implementation`
- 建议排除：frontmatter 的 `status`、纯格式变化、review 菜单、完成态更新时间

这样做的原因是：`spec-work` 完成后可能把 plan `status: active` 改成 `completed`，如果 hash 包含状态字段，会导致任务包在交付收尾时无意义地过期。

MVP 阶段可以不做复杂 Markdown AST 解析。更稳的路径是：

1. LLM 语义读取 plan 并生成 task pack。
2. 轻量脚本只做确定性检查：文件存在、frontmatter 字段完整、`source_plan` 路径有效、hash 存在、task_id 唯一、dependencies 指向存在 task。
3. 第二阶段再增加 task-relevant section hash 与 file overlap 检查。

不要让脚本尝试判断“这个 task 拆得是否合理”。这是语义决策，应留给 LLM 和文档 review。

---

## 11. 与 `spec-work` 的联动

### 11.1 `spec-work` 的消费逻辑

`spec-work` 应该具备下面的能力：

1. 识别是否存在 tasks
2. 校验 tasks 是否对应当前 plan
3. 如果对应，优先消费 tasks
4. 如果不对应，拒绝使用旧 tasks
5. 如果没有 tasks，再回退到 plan

更准确的消费顺序应是：

```text
task pack path provided
  -> validate task pack frontmatter and source_plan
  -> compare task-relevant hash
  -> build execution tracker from Task Cards / Execution Waves

plan path provided
  -> if plan is small, execute directly
  -> if plan is large and no task pack provided, ask whether to generate task pack or proceed with transient task list

bare prompt provided
  -> keep current spec-work triage
```

task pack 不应替代 `spec-work` 的执行判断。`spec-work` 仍然需要在实际改代码前读取相关文件、发现测试、识别冲突，并在发现 task pack 漏掉关键事实时停止执行。

### 11.2 `spec-work` 内部仍保留临时拆分

这条不应删除，因为：

- 小任务仍然没必要生成长期 tasks
- 某些边界简单的 work 直接执行更轻
- tasks 应该是“加速层”，不是“必经层”

### 11.3 `spec-work` 应避免的行为

`spec-work` 不应该：

- 在执行时重新发明一套与 `spec-write-tasks` 不同的 task 口径
- 把 plan 再拆成另一份长期 plan
- 在 tasks 与 plan 冲突时静默选择旧内容
- 在 task pack 未覆盖新发现事实时继续脑补执行

---

### 11.4 越界回退规则

结合 CodeStable 的 implement 阶段经验，`spec-work` 消费 task pack 时应有明确的停止信号：

- 需要修改 task pack 未声明的核心文件
- 需要新增 plan 未声明的公开 API、CLI command、配置项、数据库表或长期状态文件
- 需要引入新的术语、长期抽象或对外契约
- task 的 `done_signal` 无法通过当前测试或验证方式证明
- 执行中发现 source plan 的 scope boundary 与真实代码冲突

触发这些信号时，正确动作不是现场发挥，而是回到 `spec-plan` 修正方案，或重新运行 `spec-write-tasks`。

---

## 12. Drift 与重建规则

### 12.1 需要重建 tasks 的情况

只要出现以下任一情况，tasks 就应重建：

- plan 变了
- scope 变了
- implementation units 变了
- files 变了
- verification 变了
- tasks 被手工修改后与 plan 语义不一致

### 12.2 冲突处理

如果 tasks 与 plan hash 不一致：

- 不允许继续执行
- 明确提示 tasks 过期
- 要求重新生成

### 12.3 为什么 hash 很关键

因为 tasks 是派生工件，不是第二真相源。  
没有 hash，task pack 很容易悄悄过期，然后在执行阶段制造非常隐蔽的漂移。

---

## 13. 落地实施顺序

### 第 1 步：先定义 skill contract

新增：

- `skills/spec-write-tasks/SKILL.md`
- `skills/spec-write-tasks/references/task-pack-schema.md`

先把：

- 输入
- 输出
- 路由
- 跳过条件
- drift 规则

写清楚。

### 第 2 步：定义 task pack schema

让 tasks 既能人工读，也能脚本校验。

### 第 3 步：改 `spec-work` 的输入路由

让 `spec-work` 支持：

- tasks 优先
- plan fallback
- hash mismatch 拒绝执行

### 第 4 步：补 review / deepening

让 `spec-doc-review` 可以审 tasks 是否仍然保持派生性和边界清晰。

### 第 5 步：补 task pack lint

只做确定性 lint：

- frontmatter 字段完整
- `source_plan` 存在
- `source_plan_hash` 格式正确
- `task_id` 唯一
- dependencies 指向存在 task
- files 使用 repo-relative 路径
- 同一 wave 内显式文件 overlap 被标注或降级为串行

不做语义 lint，不判断任务拆分质量。

### 第 6 步：补 `spec-plan` handoff

`spec-plan` 完成后不应只给 `spec-work` 一个选项。更合理的 handoff 是：

- 小 plan：推荐直接 `spec-work`
- 大 plan：推荐先 `spec-write-tasks`
- 用户已有 task pack：可直接 `spec-work <tasks-path>`

这一步是交互文案改造，不应引入强制 gate。

---

### 13.1 MVP / M2 / M3 分阶段可行路线

### MVP：纯 skill + schema

目标：先证明 task pack 作为执行输入有价值。

- 新增 `spec-write-tasks` skill
- 新增 `task-pack-schema.md`
- `spec-work` 文案识别 task pack
- 通过人工 review 保证 task pack 质量

退出标准：

- 大 plan 能生成 `docs/tasks/*-tasks.md`
- task pack 能被 `spec-work` 直接消费
- 小 plan 仍然能直达 `spec-work`

### M2：确定性校验

目标：防止 stale task pack 和格式漂移。

- 增加 task pack lint
- 增加 task-relevant hash
- 增加 dependency / wave / file overlap 检查
- `spec-work` 在 hash mismatch 时拒绝执行 task pack

退出标准：

- stale task pack 不会被静默执行
- 同 wave 共享文件能被发现并降级

### M3：上下文压缩优化

目标：提升复杂 plan 的执行质量。

- 每个 task 支持 `context_refs`
- 支持 foundation/story/unit 三类组织视角
- 支持从 plan handoff 菜单进入 `spec-write-tasks`
- 支持 doc review 检查 task pack 是否派生、完整、一致

退出标准：

- task pack 能明显减少 `spec-work` 首轮阅读上下文
- 并行任务 dispatch 的文件冲突率下降
- review 中能稳定追踪 task -> requirement -> plan unit

---

## 14. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| tasks 变成第二份 plan | 双真相源、语义漂移 | 明确 tasks 只能派生，不可改范围 |
| 任务拆得过碎 | 执行开销上升 | 设合并规则和最小闭环标准 |
| 任务拆得过大 | 幻觉风险仍在 | 用依赖图、文件图、验证面拆分 |
| plan/tasks 漂移 | 执行错误 | 加 `source_plan_hash`，不匹配即重建 |
| 过度流程化 | 小任务被迫走重路径 | 保留 plan -> work 直通道 |
| 任务文档变进度表 | 维护成本上升 | 进度仍由 git diff 和 `spec-work` 跟踪 |
| 只按 implementation unit 拆分 | 用户故事和最小闭环被打散 | 支持 foundation/story/unit 三种组织视角 |
| `first_move` 退化成微步骤脚本 | task pack 变成执行脚本 | 改为 `entry_hint` / `context_refs`，只提示读什么 |
| hash 粒度错误 | 无意义过期或漏检漂移 | 使用 task-relevant section hash，排除 plan status |
| 脚本尝试做语义拆分 | 规则引擎替代 LLM 判断 | 脚本只做 schema/path/hash/dependency 等确定性检查 |
| task pack 缺少停止信号 | 执行阶段继续脑补 | 每个 task 加 `stop_if`，`spec-work` 触发时回到 plan |

---

### 14.1 最终技术评估

### 可行性

高。当前 `spec-plan` 已经有足够结构化的输入，`spec-work` 也已有 task tracker 和执行策略。新增 `spec-write-tasks` 不需要重写主链路，只需要增加一个可选派生工件和轻量消费规则。

真正的实现难点不在生成 Markdown，而在三件事：

- 如何防止 task pack 变成第二份 plan
- 如何发现 stale task pack
- 如何让 `spec-work` 消费 task pack 时不丢掉执行期发现

这些都可以用 light contract 解决，不需要状态机。

### 完整性

原方案已经覆盖定位、路由、schema、drift 和落地顺序，但需要补强：

- task-relevant hash 的具体语义
- foundation/story/unit 三类拆分视角
- 每 task 的上下文锚点和停止信号
- task pack lint 的确定性边界
- `spec-plan` handoff 与 `spec-work` 消费路径的渐进改造

补上这些后，方案可以进入 MVP 实施。

### 一致性

与 `docs/10-prompt/项目角色.md` 一致。方案的关键是提升执行输入质量，而不是新增控制状态。

与当前项目一致：

- `spec-plan` 仍是唯一技术方案 SoT
- `spec-work` 仍是执行器
- task pack 是可重建派生工件
- 进度仍由 git diff、task tracker、commits 和验证结果承载

与业界实践一致：

- 吸收 `spec-kit` 的 specify / plan / tasks / implement 分层
- 吸收 Trellis 的持久化上下文和任务注入思想
- 吸收 CodeStable 的 roadmap items、design checklist、implement 停止信号
- 不照搬它们的强状态生命周期

---

## 15. 成功指标

如果这个方案是有效的，应该能观察到：

- 大 plan 在进入 work 前，上下文明显下降
- `spec-work` 对复杂 plan 的首次执行失误率下降
- 并行任务识别更稳定
- plan 和 tasks 的 drift 更容易发现
- 小任务仍能保持轻量直达

---

## 16. 结论

最终建议非常明确：

1. **新增 `spec-write-tasks`**
2. **把它定义成派生型任务编译 skill**
3. **保持 `spec-plan` 为唯一技术方案 SoT**
4. **让 `spec-work` 同时支持 `plan` 和 `tasks` 输入**
5. **保留小任务直达 work 的路径**

这条路线既符合 `spec-first` 的 light contract / explicit boundaries / let the LLM decide 哲学，也和 GitHub `spec-kit`、Trellis、CodeStable 的成熟实践方向一致。

---

## 17. 参考资料

### 当前仓库内

- [项目角色](../10-prompt/项目角色.md)
- [spec-first skill 研发体系与产物映射](../项目审查/2026-04-26-spec-first-skill-delivery-artifact-map.md)
- [spec-plan](../../skills/spec-plan/SKILL.md)
- [spec-work](../../skills/spec-work/SKILL.md)
- [spec-work-beta](../../skills/spec-work-beta/SKILL.md)
- [五阶段工作流详解](../01-需求分析/base/4.五阶段工作流详解.md)
- [流程门禁与状态流转分析](../业界分析/0.流程门禁与状态流转分析.md)
- [各阶段稳定产物与交接机制分析](../业界分析/2.各阶段稳定产物与交接机制分析.md)

### 业界参考

- [GitHub/spec-kit](https://github.com/github/spec-kit)
- [spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md)
- [Trellis workflow](https://github.com/kuang/xiaobu/Trellis-0.5.0-beta.8/packages/cli/src/templates/trellis/workflow.md)
- [Trellis start session](https://github.com/kuang/xiaobu/Trellis-0.5.0-beta.8/packages/cli/src/templates/common/commands/start.md)
- CodeStable 的 roadmap / feat-design 体系
