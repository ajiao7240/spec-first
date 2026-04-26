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

### 1.1 审查后修订结论

本次复审后，方案的优先级需要从“先有 task pack 文档”调整为“先保证 task pack 能作为结构可信的执行输入候选”。最佳路线不是增加更多流程，而是补齐五个最小闭环：

1. **结构化返回闭环**：`spec-write-tasks` 必须返回明确的 `compile / skip / return-to-plan / draft-only / validate-only` 决策 envelope，供 `spec-plan` handoff 和 `spec-work` 稳定消费。
2. **确定性校验闭环**：`source_plan_hash` 已经是 deterministic handoff 的 freshness contract，MVP 必须有最小 deterministic hash / validate tooling；否则只能生成 draft/transient task pack。
3. **CRG 消费闭环**：结构可信 handoff MVP 必须包含 `before-work --task-pack=<tasks.md>` 的最小校验消费：先复用 validator，再从 repo root 解析 `source_plan`，回到 source plan 的 planned surface；task pack 只能作为 execution focus，不能成为第二份 planned surface。
4. **真实样本闭环**：在进入更大范围推广前，至少要有 valid / stale / wrong-chain / missing-identity 四类 fixture 证明 task pack 可以被生成、校验、拒绝和消费；在 plan-path 自动分流推广前，再用一份中等复杂真实计划验证上下文压缩是否真实发生。
5. **源码定向闭环**：生成 task pack 前可以读取源码，但必须采用 bounded source orientation。MVP 优先使用 CRG 产物，CRG 不可用时降级为 targeted direct repo reads；Serena/LSP 作为 Phase 2 orientation provider，不进入 MVP。

这五点都是“脚本准备事实、LLM 做判断”的延伸：脚本只证明 identity / freshness / structure 是否可信，CRG/direct reads 只提供候选源码证据，LLM 仍判断是否需要 task pack、怎么拆任务、何时回到 plan。

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

### 2.4 本次深度审查发现的问题

当前 `spec-write-tasks` 的方向成立，但存在七个影响研发质量目标的缺口：

| 问题 | 级别 | 现象 | 最佳处理方向 |
| --- | --- | --- | --- |
| `source_plan_hash` 缺少确定性工具 | P1 | skill / schema / work 都要求 hash，但代码层没有 hash / validate helper | 新增最小 `tasks hash` / `tasks validate` 能力，脚本只做确定性校验 |
| CRG `before-work --task-pack` 与 schema 不一致 | P1 | task pack schema 说 `source_plan` 是 repo-relative，但 hook 当前容易按 task pack 所在目录解析；frontmatter 解析也过浅 | 让 hook 复用 task pack validator，并按 repo root 解析 source plan |
| bounded source orientation 降级链不明确 | P2 | 复杂 plan 需要源码候选证据提升 task 边界，但 CRG 不可用时容易退化成完整读源码或纯 plan 猜测 | MVP 建立 `CRG -> targeted direct repo reads` 降级链；Serena/LSP 延后到 Phase 2 |
| `spec-write-tasks` 返回形态不稳定 | P2 | `spec-plan` handoff 需要知道 task pack 是否结构可信且语义姿态允许执行，但 skill 没有统一返回 envelope | 增加标准决策 envelope，避免靠散文判断下一步 |
| 缺少真实 task pack fixture / dogfood | P2 | 现有测试主要验证 prompt 文本，不证明 stale / wrong-chain 能被拒绝 | 增加 fixture 和行为测试，先证明最小闭环 |
| 何时生成 task pack 的启发式不够明确 | P3 | “large enough / low value”对团队落地不够稳定 | 提供轻量阈值和反向条件，但最终仍由 LLM 判断 |
| `spec-work <plan-path>` 的早期分流边界不清 | P2 | 大 plan 需要可选分流，但它不是 MVP 结构可信 handoff 的前置 | 收口为 M2+ enhancement，先证明 explicit task-pack 消费闭环 |

这几个问题不能靠继续加 prompt 解决。hash、路径、frontmatter、依赖引用、文件 overlap 属于确定性事实，应交给脚本；任务拆分质量、并行合理性、scope 是否需要回到 plan，仍属于 LLM 语义判断。

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
- CRG 和 targeted direct repo reads 负责提供 MVP 阶段 bounded source orientation 的候选证据；Serena/LSP 作为 Phase 2 orientation provider
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

### 6.5 是否生成 task pack 的轻量启发式

`spec-write-tasks` 仍由 LLM 做最终判断，但需要给团队一个稳定起点。

倾向 `compile` 的信号：

- `3+` 个 implementation units，或 unit 内含多个可独立验证 story slice
- 预期修改跨 `2+` 个模块、adapter、runtime surface 或 contract
- 核心文件数预计 `6+`，或测试面横跨 unit / smoke / integration
- 存在 foundation task，例如 schema、CLI surface、shared helper、fixture、validator
- 存在真实并行机会，需要提前标记 wave / dependency / file overlap
- 涉及 public API、CLI command、runtime asset、durable state 或 governance contract

倾向 `skip` 的信号：

- `1-2` 个文件，单一模块，单一验证面
- 没有共享 foundation，也没有并行收益
- plan 的 implementation unit 已经足够小，`spec-work` 可直接消费
- 生成 task pack 会比执行本身引入更多 carrying cost

倾向 `return-to-plan` 的信号：

- task pack 需要新增 plan 未声明的 scope、acceptance criteria、public contract 或 non-goal 例外
- test_focus / done_signal 无法从 plan 的 Verification 或 Test Scenarios 中推出
- 文件边界、风险边界或 execution posture 会影响技术方案本身

这些阈值不是 gate。它们只帮助 LLM 降低判断随机性，避免小任务过度流程化，也避免大计划直接进入执行后临场拆解。

---

## 7. Artifact 设计

### 7.1 推荐落点

task pack 有两种合法形态：

| 形态 | 落点 | 适用情况 |
| --- | --- | --- |
| `transient` | 不要求进入 `docs/tasks/`，可以只作为本次编译 envelope 或临时草稿输出 | 方案讨论、校验工具不可用、task pack 只用于判断是否值得继续 |
| `derived` / executable | `docs/tasks/YYYY-MM-DD-NNN-<type>-<slug>-tasks.md` | 需要 review、复用、并行 handoff，或明确交给 `spec-work <task-pack-path>` 执行 |

默认不应为了“看起来完整”把每个 plan 都持久化成 `docs/tasks/`。持久化会制造 stale artifact surface，只有当 review / 复用 / 并行交接收益超过维护成本时才值得落盘。

`draft-only` 只作为 `spec-write-tasks` envelope 的 `decision`，不是 task pack 的持久 `mode`。如果非 executable 草稿被落盘，统一使用 `mode: transient`，并且不能交给 `spec-work` 执行。

选择持久 task pack 的理由：

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
spec_id: YYYY-MM-DD-NNN-<slug>
source_plan: docs/plans/YYYY-MM-DD-NNN-<type>-<slug>-plan.md
source_plan_hash: sha256:<64-hex>
generated_by: spec-write-tasks
mode: derived
source_sections:
  - Requirements Trace
  - Scope Boundaries
  - Technical Approach
  - Implementation Units
  - Files
  - Test Scenarios
  - Verification
---
```

`source_plan` 必须是 repo-relative path，并且消费方必须从 repo root 解析它。不要按 `docs/tasks/` 所在目录解析，否则 `docs/plans/...` 会被错误解析成 `docs/tasks/docs/plans/...`。

### 7.4 建议的正文结构

- Overview
- Source Summary
- Traceability Matrix
- Task Graph
- Execution Waves
- Task Pack Contract
- Task Cards
- Validation Notes
- Regeneration Rules

---

## 8. Task Pack Schema

### 8.1 顶层字段

| 字段 | 作用 |
| --- | --- |
| `spec_id` | 复制 source plan 的 spec chain identity，只做链路识别，不做 freshness |
| `source_plan` | 指向唯一来源 plan |
| `source_plan_hash` | 防 stale，MVP 使用 source plan canonical body 的 `sha256:<64-hex>` |
| `generated_by` | 记录生成 skill |
| `mode` | `derived` / `transient` |
| `source_sections` | 记录本 task pack 消费了 plan 的哪些章节 |
| `orientation_evidence` | 记录本轮 bounded source orientation 的 provider、候选证据和 limitation；只用于审计和质量提升，不证明语义正确 |
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

### 8.2.1 字段分层

为了避免 MVP 过度 contract 化，task pack schema 需要区分“可执行必填”和“质量增强”。

| 层级 | 字段 | 规则 |
| --- | --- | --- |
| MVP required | `spec_id`、`source_plan`、`source_plan_hash`、`task_id`、`source_unit` 或 `requirement_refs`、`dependencies`、`files`、`goal`、`test_focus`、`done_signal`、`wave` | 缺失则不能成为 deterministic handoff |
| M2 recommended | `context_refs`、`parallelizable`、`stop_if`、`execution_waves`、`orientation_evidence` | 缺失时可以降级，但应返回 limitation，提示执行者可能需要读更多 source plan 或源码 |
| M3 quality fields | `entry_hint`、`risk_note`、`validation_rules`、`regeneration_rules`、更细的 `source_sections` | 用于提升执行质量和 review 质量，不作为 MVP executable 的硬门槛 |

`files` 在 executable task pack 中必须可被脚本确定性校验。MVP 只允许具体 repo-relative file path；`src/cli/...` 这类省略写法只允许出现在 `draft-only` / `transient` 输出中。若后续需要目录或 glob，必须显式引入 `path_kind: file | directory | glob`，并定义 overlap 规则。

### 8.2.2 MVP 可解析 Task Cards 语法

MVP 不让 validator 解析自由 Markdown。executable task pack 必须在 `## Task Pack Contract` 下提供唯一机器来源：

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    {
      "wave": 1,
      "tasks": ["T001"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "requirement_refs": ["R1"],
      "goal": "建立核心数据结构和边界",
      "dependencies": [],
      "files": ["src/cli/commands/tasks.js"],
      "test_focus": "核心行为的最小 happy path",
      "done_signal": "相关测试通过，边界稳定",
      "wave": 1
    }
  ]
}
```

规则：

- validator 只解析 frontmatter 和这个 fenced JSON block；`Task Cards` 章节中的散文只做人读展示。
- JSON block 中必须包含 `schema_version: task-pack/v1`、`tasks` 和 `execution_waves`。
- task 字段只接受 schema 声明的 key；未知 key 返回 limitation 或 validation error，不静默忽略。
- `dependencies`、`files`、`requirement_refs` 必须是数组；`wave` 必须能在 `execution_waves` 中找到。
- 如果 JSON block 缺失、重复、无法 parse，或与人读 `Task Cards` 明显冲突，task pack 不能成为 deterministic handoff。

### 8.3 一个最小示例

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    {
      "wave": 1,
      "tasks": ["T001"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "goal": "建立核心数据结构和边界",
      "dependencies": [],
      "files": [
        "src/cli/commands/tasks.js",
        "tests/unit/spec-write-tasks-validate.test.js"
      ],
      "requirement_refs": ["R1"],
      "context_refs": [
        "docs/plans/...#Implementation-Units",
        "skills/spec-work/SKILL.md"
      ],
      "entry_hint": "先读取 plan 的 Requirements Trace 和 Scope Boundaries",
      "test_focus": "核心行为的最小 happy path",
      "done_signal": "相关测试通过，边界稳定",
      "parallelizable": false,
      "stop_if": "需要新增 plan 未声明的公开入口、配置项或长期状态文件",
      "wave": 1
    }
  ]
}
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

`spec-work` 消费 task pack 时应采用 first-pass reading policy：

1. 首轮只读 task pack frontmatter、Task Pack Contract、Task Graph、当前 wave 的 Task Cards、当前 task 的 `context_refs`。
2. 只在 validator 报 limitation、task card 与代码事实冲突、或 `context_refs` 不足以解释边界时，扩展读取 source plan 的相关章节。
3. 不应为了“确认一下”同时完整读取 source plan 和完整 task pack；这会抵消 task pack 的上下文压缩价值。

这借鉴了 Trellis 的 `implement.jsonl` / `check.jsonl` 注入上下文机制，但只吸收“给执行者注入最小上下文”的部分，不吸收完整 current-task 状态系统。

### 8.5.1 Bounded Source Orientation 的 MVP 降级边界

`spec-write-tasks` 可以看源码，但只能看到“任务边界足够准确”为止。最佳实践不是在任务编译阶段做 deep implementation analysis，而是做 bounded source orientation：为每个 task 找到足够的候选文件、共享面、测试入口和风险限制，让后续 `spec-work` 能更快进入正确代码区域。

MVP 推荐降级链：

```text
source plan
  -> CRG ready?
      yes: workflow-context + graph-quality/search/query + locate + explain + optional impact/review-context/god-nodes
      no: targeted direct repo reads
  -> LLM prunes evidence
  -> task pack files/context_refs/risk_note/waves/limitations
```

MVP 各层职责：

- CRG 优先：CRG 是 spec-first 的项目事实层，用 architecture、search、query、impact、review-context、god-nodes 等结构化证据，帮助 LLM 定位候选文件、测试入口、共享面、影响面和并行风险。
- targeted direct repo reads 兜底：当 CRG missing、degraded、stale 或 coverage 不足时，只读取 plan 指向的候选文件、目录索引、测试入口和局部实现模式。
- Serena/LSP 不进入 MVP：它可以作为 Phase 2 orientation provider，用于 CRG 不可用时的符号索引降级，但不应成为 MVP 的工具编排义务。

停止条件：

- 每个 task 的 `files` 足够具体，至少能让执行者知道第一批要读的 repo-relative paths。
- `context_refs` 能解释为什么这些文件与 source unit / requirement 相关。
- 共享 schema、CLI surface、fixtures、generated assets、package metadata 等并行风险已经进入 `risk_note` 或 wave 串行化。
- 继续阅读源码只会进入实现细节，而不会显著改变 task 边界。

必须避免：

- 把 CRG 返回的第一个候选当成最终修改点。
- 把 CRG 展示的现状直接升级为 task。
- 用 CRG 替代必要的源码阅读。
- 在 task pack 阶段写逐步 patch 策略。
- 用源码发现的新需求改写 plan 范围；发现 plan 缺 scope / contract / acceptance 时，应返回 `return-to-plan` 或生成 `draft-only`。

`orientation_evidence` 可以记录 provider 和 limitation，但不应成为 executable handoff 的硬门槛。CRG 不可用时，MVP 正确行为是记录 `provider: direct-repo-reads` 与 limitation；只有当 plan 本身也不足以确定 task 边界时，才停止回到 plan。

### 8.6 `spec-write-tasks` 的返回 envelope

为了让 `spec-plan` handoff、人工审查和后续 `spec-work` 都能稳定判断下一步，`spec-write-tasks` 最终必须输出一个简短决策 envelope。它不是状态机，只是本次编译/校验结果的摘要。

```yaml
decision: compile | skip | return-to-plan | draft-only | validate-only
source_plan: docs/plans/...
task_pack: docs/tasks/... | null
task_pack_validity: valid | draft | stale | wrong-chain | invalid | unverifiable | not-applicable
deterministic_handoff: true | false
validity_scope: identity-freshness-structure-only
semantic_posture: generated-this-run | reviewed-existing | unchecked-existing | not-applicable
reason: <one-sentence reason>
validation:
  spec_id: matched | missing | mismatch | not_checked
  source_plan_hash: matched | missing | mismatch | unavailable | not_checked
  hash_tool: available | unavailable
  source_plan_path: resolved | missing | invalid
orientation:
  provider: crg | direct-repo-reads | serena-lsp | mixed | skipped
  posture: bounded | degraded | skipped-small-plan | unavailable
  limitations: []
next_action: spec-work-task-pack | review-task-pack | spec-work-plan | revise-plan | stop
```

约束：

- `deterministic_handoff: true` 只能在 `decision: compile | validate-only`、`task_pack_validity: valid`、`spec_id: matched`、`source_plan_hash: matched`、`hash_tool: available` 时出现。
- `deterministic_handoff` 只表示 identity / freshness / structure 可信，不表示 task 拆分语义一定充分。
- `decision: compile` 生成的新 task pack 可设置 `semantic_posture: generated-this-run`；`decision: validate-only` 对已有 task pack 默认是 `unchecked-existing`，除非本轮 LLM review 明确确认其仍派生自 source plan。
- `next_action: spec-work-task-pack` 只有在 `deterministic_handoff: true` 且 `semantic_posture: generated-this-run | reviewed-existing` 时出现；否则应返回 `review-task-pack` 或 `revise-plan`。
- `skip` 必须推荐直接 `spec-work <plan-path>`，不能生成伪 executable task pack。
- `return-to-plan` 必须指出缺的是 scope、architecture、contract、verification 还是 acceptance decision。
- `draft-only` 必须明确不可交给 `spec-work` 执行。
- `validate-only` 用于检查已有 task pack；只报告 deterministic validity 和 semantic posture，不顺手改写语义。
- `orientation.provider` 只说明本轮源码定向证据来源；它不证明 task 拆分语义正确，也不替代后续执行时的源码读取。

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
- bounded source orientation 产生的候选源码证据：MVP 来自 CRG 或 targeted direct repo reads；Phase 2 可来自 Serena/LSP 的文件、符号、测试入口和 limitation

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
- 若存在共享文件，自动降级为串行，这是确定性硬拒绝
- 若 task 之间存在隐式依赖，不允许放进同一 wave
- 即使文件不重叠，只要共享 CLI surface、schema / contract、fixtures、generated assets、package metadata 或全局测试套件，也必须写出 LLM-reviewed `risk_note`
- 存在上述共享风险时，同 wave 必须串行化，或在 task pack 中显式说明为什么仍可并行

这和 `spec-work` 的并行安全检查应保持一致。

---

## 10. 脚本与 LLM 的分工

### 10.1 脚本负责

- 读取 plan 文件
- 计算 source plan canonical hash
- 归一化路径
- 检查 file overlap
- 校验 tasks schema
- 检查 tasks 与 plan 的对应关系
- 判断 tasks 是否过期
- 探测 CRG readiness，并在可用时返回 query-first 候选证据和 limitation
- 从 readiness ledger 或工具调用结果暴露 CRG 是否可用；Serena/LSP readiness 只作为 Phase 2 orientation provider 信号
- 返回机器可读 validation result，供 `spec-write-tasks`、`spec-work` 和 CRG hook 共用

### 10.2 LLM 负责

- 判断要不要生成 tasks
- 按 MVP 的 `CRG -> targeted direct repo reads` 降级链选择和剪裁 bounded source orientation 证据；Phase 2 再引入 Serena/LSP provider
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

`source_plan_hash` 不能含糊，否则 drift 防护会变成装饰。MVP 建议采用保守 hash：

- hash 算法：`sha256`
- hash 输入：source plan 的 canonical body
- 输入编码：按 UTF-8 文本读取；`CRLF` / `CR` 统一归一化为 `LF`
- frontmatter：如果文件首行是 `---`，必须找到独占一行的 closing `---`；找不到则 fail closed，返回 `source-plan-frontmatter-invalid`
- canonical body：移除完整 frontmatter block 后的 Markdown body；body 内容按原顺序保留，不做 heading 抽取，不折叠空白
- MVP 排除字段：frontmatter 整体不进入 hash；`spec_id` 等 identity 字段由独立校验负责，不靠 hash 承载
- 不在 MVP 阶段做“只 hash 影响执行语义章节”的 section extraction

这样做的原因是：`spec-work` 完成后可能把 plan `status: active` 改成 `completed`，如果 hash 包含状态字段，会导致任务包在交付收尾时无意义地过期。

MVP 不应依赖复杂 Markdown AST 解析，也不应让 section heading 成为隐式 contract。更稳的路径是：

1. LLM 语义读取 plan 并生成 task pack。
2. 轻量脚本对 source plan canonical body 计算 hash，并检查文件存在、frontmatter 字段完整、`source_plan` 路径有效、hash 匹配、task_id 唯一、dependencies 指向存在 task、MVP required fields 完整。
3. 第二阶段如果要做 task-relevant section hash，必须先定义 required section anchors，并用 renamed / missing / duplicate / reordered sections fixtures 证明 extractor 会 fail closed。

不要让脚本尝试判断“这个 task 拆得是否合理”。这是语义决策，应留给 LLM 和文档 review。

复审后建议把 hash / validate 作为最小工具优先级，而不是 M2 以后才做。因为当前 deterministic handoff contract 已经要求 hash，如果没有工具，正确行为只能生成 draft task pack，无法证明 `spec-work` handoff。

建议最小命令面：

```bash
spec-first tasks hash <plan-path>
spec-first tasks validate <task-pack-path> --json
```

其中：

- `tasks` 是根 CLI 子命令，不放在 `crg` 子命令下。MVP 落点应明确为 `src/cli/commands/tasks.js`，在 `src/cli/index.js` 注册，并补 CLI help / smoke 断言；`bin/spec-first.js` 只保留现有 `crg` 特殊分发，不拦截 `tasks`。
- `hash` 输出 canonical `sha256:<64-hex>`、canonicalization version 和是否移除了 frontmatter。
- `validate` 检查 frontmatter、`spec_id`、repo-root 解析的 `source_plan`、`source_plan_hash`、`Task Pack Contract` JSON block、task card MVP 必填字段、dependency 引用、repo-relative concrete files、same-wave file overlap。
- `validate` 不判断 task 拆分质量，不判断 business scope 是否合理，不决定是否需要 task pack。

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
  -> resolve source_plan from repo root
  -> compare canonical source_plan_hash
  -> reject missing identity / wrong-chain / stale / draft / transient / unverifiable handoff
  -> confirm semantic_posture is generated-this-run or reviewed-existing
  -> build execution tracker from Task Cards / Execution Waves

plan path provided
  -> read plan metadata / implementation units / files / verification
  -> if M2+ plan-path diversion is enabled, run task-pack suitability check before before-work and before internal task tracker
  -> if strong task-pack signals and no valid task pack exists, offer one optional diversion to spec-write-tasks
  -> if user chooses task pack, compile task pack and re-enter as spec-work <task-pack-path>
  -> if user chooses direct execution, run before-work --plan=<plan.md> and create internal task tracker
  -> if plan is small, execute directly with internal task tracker

bare prompt provided
  -> keep current spec-work triage
```

task pack 不应替代 `spec-work` 的执行判断。`spec-work` 仍然需要在实际改代码前读取相关文件、发现测试、识别冲突，并在发现 task pack 漏掉关键事实时停止执行。

MVP 只要求 `spec-work <task-pack-path>` 能显式 validate/consume 结构可信的 task pack；`spec-work <plan-path>` 的早期可选分流属于 M2+ 的体验优化，必须等 validator、CRG task-pack 消费和真实 dogfood 信号稳定后再推广。

### 11.2 Plan Path 的早期可选分流（M2+）

当用户显式调用 `spec-work <plan-path>` 时，用户的直接意图是“执行计划”。因此 `spec-work` 不应该默认强制进入 `spec-write-tasks`，但应该在真正执行前识别明显适合 task pack 的大计划，并给一次可选分流。

最佳位置：

```text
Read plan
  -> Task-pack suitability check
  -> Optional diversion if strong signals exist
  -> CRG before-work hook
  -> Internal task tracker
  -> Execute
```

这个检查必须发生在 `before-work` hook、work-run 创建和内部 task tracker 创建之前。否则如果已经 `before-work --plan` 并创建了 execution tasks，再转 task pack，会产生两个执行入口和多余 work-run 噪音。

只在强信号下提示：

- `3+` implementation units，或 plan 内有多个 phase / unit / verification slice
- 跨多个模块、runtime surface、CLI、schema、contract 或 governance 文件
- 有真实 dependency chain、foundation task 或 parallel wave
- 预期触碰 `6+` 核心文件，或测试面跨 unit / smoke / integration
- 需要明确 file ownership 才能降低并行/串行冲突

不要提示：

- `1-2` 个文件、单模块、单验证面
- 用户明确说“直接执行”
- plan units 已经足够小，`spec-work` 内部 tracker 就能表达清楚
- bugfix / docs-only / config-only 等窄任务

推荐文案：

```text
这份 plan 有多个 implementation units、跨模块文件边界和独立验证面。直接执行也可以，但先用 spec-write-tasks 生成 docs/tasks/*-tasks.md 能降低上下文负担并明确依赖/并行边界。要先编译 task pack，还是直接按 plan 执行？
```

推荐选项：

1. 先编译 task pack（推荐）
2. 直接执行 plan

选择 task pack 时，`spec-work` 应暂停当前 plan execution，运行 `spec-write-tasks <plan-path>`。只有得到 deterministic handoff 且 `semantic_posture` 允许执行后，才重新以 `spec-work <task-pack-path>` 进入执行。不要在同一轮里混用 plan 内部 task tracker 和持久 task pack。

进入 M2+ 前必须满足两个前置条件：

- `before-work --task-pack` 已经复用 task pack validator，并能拒绝 stale / wrong-chain / unverifiable handoff。
- 至少完成一次中等复杂 plan 的 dogfood 对照，证明 task pack 路径确实减少首次执行前的无关 plan 阅读，而不是让 `spec-work` 同时读完整 plan 和完整 task pack。

### 11.3 `spec-work` 内部仍保留临时拆分

这条不应删除，因为：

- 小任务仍然没必要生成长期 tasks
- 某些边界简单的 work 直接执行更轻
- tasks 应该是“加速层”，不是“必经层”

### 11.4 `spec-work` 应避免的行为

`spec-work` 不应该：

- 在执行时重新发明一套与 `spec-write-tasks` 不同的 task 口径
- 把 plan 再拆成另一份长期 plan
- 在 tasks 与 plan 冲突时静默选择旧内容
- 在 task pack 未覆盖新发现事实时继续脑补执行
- 在已创建 `before-work --plan` work-run 和内部 task tracker 后，再半途切到 task pack 执行

---

### 11.5 越界回退规则

结合 CodeStable 的 implement 阶段经验，`spec-work` 消费 task pack 时应有明确的停止信号：

- 需要修改 task pack 未声明的核心文件
- 需要新增 plan 未声明的公开 API、CLI command、配置项、数据库表或长期状态文件
- 需要引入新的术语、长期抽象或对外契约
- task 的 `done_signal` 无法通过当前测试或验证方式证明
- 执行中发现 source plan 的 scope boundary 与真实代码冲突

触发这些信号时，正确动作不是现场发挥，而是回到 `spec-plan` 修正方案，或重新运行 `spec-write-tasks`。

### 11.6 CRG `before-work --task-pack` 对齐

`spec-write-tasks` 不新增自己的 CRG hook；这是正确边界。但 `spec-work` 通过 `before-work --task-pack=<tasks.md>` 进入 CRG 时，hook 必须把 task pack 当作派生 execution focus，而不是计划真相源。

最佳消费逻辑：

```text
before-work --task-pack=docs/tasks/foo-tasks.md
  -> run tasks validate --json
  -> resolve source_plan from repo root
  -> validate spec_id and source_plan_hash
  -> read planned_change_surface from source plan or explicit sidecar
  -> expose task cards as execution_focus only
```

拒绝或降级规则：

- `source_plan` 缺失或路径无效：返回 `task-pack-invalid`
- `spec_id` mismatch：返回 `task-pack-wrong-chain`
- `source_plan_hash` mismatch：返回 `task-pack-stale`
- hash tooling unavailable：返回 `task-pack-unverifiable`
- planned surface 缺失：继续返回 planned-surface limitation，但不能用 task cards 反推 planned surface

这样能保持两条边界：plan 是唯一 planned surface 真源；task pack 只压缩执行切片。

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

手工编辑规则：

- executable task pack 的机器来源是 `Task Pack Contract` JSON block；手工改这个 block 后，默认降级为 `mode: transient` 或 `decision: draft-only`。
- 如果确实需要保留手工修订，必须重新运行 `spec-write-tasks`，或经过 LLM review 后把 `semantic_posture` 标为 `reviewed-existing`。
- validator 只证明 source plan hash 和 task pack 结构一致；它不承诺检测所有未声明的人工语义改写。

### 12.2 冲突处理

如果 tasks 与 plan hash 不一致：

- 不允许继续执行
- 明确提示 tasks 过期
- 要求重新生成

### 12.3 为什么 hash 很关键

因为 tasks 是派生工件，不是第二真相源。  
没有 hash，task pack 很容易悄悄过期，然后在执行阶段制造非常隐蔽的漂移。

---

## 13. 逐项问题优化与落地实施顺序

本节把复审发现的问题逐个转成最佳方案。排序依据不是“功能完整度”，而是先补会影响 deterministic handoff 可信度的缺口。

### 13.1 问题一：hash contract 没有工具闭环

**最佳方案：新增最小 deterministic validator，而不是继续强化 prompt。**

推荐改动：

1. 新增 `spec-first tasks hash <plan-path>`：按 10.4 的 canonicalization 规则计算 `sha256:<64-hex>`，输出 canonicalization version、是否移除 frontmatter 和 hash 输入摘要。
2. 新增 `spec-first tasks validate <task-pack-path> --json`：校验 frontmatter、`spec_id`、repo-root 解析的 `source_plan`、`source_plan_hash`、`Task Pack Contract` JSON block、task id、dependencies、MVP required fields、concrete repo-relative files、wave overlap。
3. 将 `tasks` 作为根 CLI 子命令接入：新增 `src/cli/commands/tasks.js`，在 `src/cli/index.js` 注册，补 help / smoke / unit 测试；`bin/spec-first.js` 不新增 `tasks` 特殊分发。
4. `spec-write-tasks` 生成 executable task pack 前必须调用 hash 工具；工具不可用时只能输出 draft/transient。
5. `spec-work` 和 CRG `before-work --task-pack` 复用 validate 结果，不各自模拟一套校验。

为什么这是最佳方案：

- hash 是 deterministic fact，不能让 LLM 估算。
- 一套 helper 被三个消费者共用，能避免 prompt drift。
- helper 不判断任务切分质量，不会滑向规则引擎。

验收信号：

- valid task pack 返回 `task_pack_validity: valid` 和 `deterministic_handoff: true`
- stale hash 返回 `task-pack-stale`
- missing hash tooling 返回 `task-pack-unverifiable`
- wrong-chain `spec_id` 返回 `task-pack-wrong-chain`

### 13.2 问题二：CRG hook 对 task pack 的解析边界不稳

**最佳方案：把 task pack 解析收敛为 repo-root 相对路径 + validator result。**

推荐改动：

1. `source_plan` 只按 repo root 解析，不按 task pack 文件所在目录解析。
2. CRG hook 不直接信任 task pack frontmatter；先调用 validator。
3. task cards 只进入 `execution_focus`，不能覆盖 `planned_change_surface`。
4. planned surface 缺失时返回 limitation，不能从 markdown prose 或 task cards 反推。

为什么这是最佳方案：

- repo-relative path 是当前 plan / task pack schema 的共同边界。
- CRG 是决策输入层，不是 task pack 语义解释器。
- 保留 plan 作为唯一 planned surface 真源，防止 task pack 变成第二 plan。

验收信号：

- `before-work --task-pack=docs/tasks/x-tasks.md` 能正确读取 `docs/plans/x-plan.md`
- hash mismatch 时 hook 返回 limitation，而不是继续输出 stale execution focus
- task pack 缺 `source_plan` 时不会静默 fallback 到无 plan 模式

### 13.3 问题三：`spec-write-tasks` 返回形态不稳定

**最佳方案：新增短 envelope，不新增 workflow state。**

推荐改动：

1. `spec-write-tasks` final output 必须包含 `decision`、`source_plan`、`task_pack`、`task_pack_validity`、`deterministic_handoff`、`semantic_posture`、`validation`、`orientation`、`next_action`。
2. `spec-plan` handoff 只在 `deterministic_handoff: true` 且 `semantic_posture: generated-this-run | reviewed-existing` 时提供 `spec-work <task-pack-path>`。
3. `skip`、`return-to-plan`、`draft-only` 分别返回明确下一步，不让用户从散文中判断。

为什么这是最佳方案：

- 它让 handoff 变稳定，但不记录长期状态。
- 它不替 LLM 决策，只把本次决策结果结构化。
- 它能被 contract tests 捕捉，不依赖人工记忆。

验收信号：

- `skip` 不生成 executable task pack
- `return-to-plan` 明确指出缺失的是 scope / architecture / contract / verification
- `draft-only` 不会被 `spec-plan` 菜单推荐给 `spec-work`

### 13.4 问题四：缺少真实 fixture / dogfood

**最佳方案：先用 fixture 建最小闭环，再 dogfood 一个真实计划。**

推荐改动：

1. 新增 `tests/fixtures/spec-write-tasks/valid/`：一份 source plan、一份 valid task pack。
2. 新增 stale、wrong-chain、missing-identity、bad-source-plan-path 四类 fixture。
3. 单测覆盖 `tasks hash`、`tasks validate`、CRG `before-work --task-pack`。
4. MVP 退出前做一次轻量 context-compression check：对一份中等复杂 plan 比较 direct plan 与 task-pack 路径的首轮阅读范围。
5. 行为闭环稳定后，再选一份中等复杂 plan 生成真实 `docs/tasks/*-tasks.md` 作为 dogfood 样本。

为什么这是最佳方案：

- fixture 先证明 contract，不污染长期 docs。
- dogfood 后验证可读性和执行压缩收益。
- 避免只靠 `SKILL.md` 文本锚点假装已经可执行。

验收信号：

- stale / wrong-chain fixture 必须被拒绝
- valid fixture 能进入 `spec-work` task list 创建前的 validated state
- 轻量 dogfood 能证明 task pack 没有增加首轮阅读负担；如果没有减负，MVP 只能保持 validator / draft 能力，不推广到 handoff 推荐

### 13.5 问题五：任务包生成启发式不够稳定

**最佳方案：加入轻量阈值，但保留 LLM 最终判断。**

推荐改动：

1. 在 `spec-write-tasks` 的 Task-Ready Check 中加入 compile / skip / return-to-plan 信号。
2. 在 `task-quality-guide.md` 补充“什么时候 task pack 是 carrying cost”的反例。
3. 在 `spec-plan` handoff 中把 task pack 选项描述为“large / dependency-heavy / explicit waves”，而不是通用推荐。

为什么这是最佳方案：

- 阈值能降低团队落地时的随机性。
- 不把阈值做成硬 gate，避免状态机化。
- 小任务仍保持 plan -> work 直通，符合渐进式复杂度原则。

验收信号：

- 小 plan 会清楚返回 `skip`
- 大 plan 会清楚返回 `compile`
- plan 缺 verification / files / scope boundary 时返回 `return-to-plan`

### 13.6 问题六：`spec-work <plan-path>` 不会主动考虑 task pack

**最佳方案：在 M2+ 为 plan-path 输入路径增加早期可选分流，而不是把 task pack 变成默认 gate。**

推荐改动：

1. `spec-work` 读到 plan path 后，先快速读取 plan metadata、implementation units、files、verification、dependencies。
2. 在 `before-work` hook 和内部 task tracker 创建前，运行 task-pack suitability check。
3. 只有强信号存在时提示一次：先编译 task pack，或直接执行 plan。
4. 用户选择 task pack 时，暂停当前 work path，运行 `spec-write-tasks <plan-path>`；拿到 deterministic handoff 且语义姿态允许执行后重新以 `spec-work <task-pack-path>` 执行。
5. 用户选择直接执行，或计划不适合 task pack 时，继续现有 `before-work --plan` + 内部 task tracker。

为什么这是最佳方案：

- 它解决了大 plan 直接进入执行后临场拆解的问题。
- 它尊重用户显式调用 `spec-work` 的执行意图，不强制改道。
- 它把选择点放在 work-run 创建前，避免同一次执行中混用 plan tracker 和 task pack。
- 它符合渐进式复杂度：小任务保持快，大计划获得执行压缩层。
- 它不应进入 MVP；否则 MVP 会同时承担 validator、CRG 消费、work skill 改造和体验分流，范围过大。

验收信号：

- 大 plan 在执行前会出现一次可选分流提示
- 小 plan / docs-only / narrow bugfix 不提示
- 选择 task pack 后不会创建 `before-work --plan` work-run
- 选择直接执行后不会再反复提示 task pack

### 13.7 问题七：bounded source orientation 降级链不明确

**最佳方案：MVP 采用 CRG-first、direct-read-fallback；Serena/LSP 延后到 Phase 2。**

推荐改动：

1. `spec-write-tasks` 生成 task pack 前，先根据 source plan 的 units、files、APIs、CLI surface、schemas 和 tests 生成少量 orientation queries。
2. 若 CRG ready，优先使用 `workflow-context`、graph-quality、search/query、`locate`、`explain`，必要时补 `impact`、`review-context`、god-nodes，只收集候选文件、符号、测试入口、共享面、影响面和并行风险。
3. 若 CRG unavailable / degraded / stale，MVP 退回 targeted direct repo reads，只读 plan 已指向或少量 query 发现的候选路径。
4. Serena/LSP 作为 Phase 2 orientation provider：等 MVP handoff 闭环稳定后，再允许自动 `activate_project(<repo>)`，等待 LSP 快速索引后使用 symbol overview、symbol lookup、references 和局部 pattern search 做降级定位。
5. 在 final envelope 和 task pack 的 `orientation_evidence` / Validation Notes 中记录 provider、coverage 和 limitation；不把 provider 可用性当作 executable handoff 的硬条件。

为什么这是最佳方案：

- CRG 是本项目的首选代码事实层，能给出比纯 LSP 更好的 workflow-native graph evidence。
- targeted direct repo reads 兜底能保证工具缺失时仍可工作，不把 MVP 绑定到某个 MCP 或 LSP 索引生命周期。
- Serena/LSP 有价值，但会引入 project activation、索引耗时、语言覆盖和工具 readiness 复杂度，适合作为 Phase 2 quality enhancement。
- CRG 和 direct reads 都只提升输入质量，不替代 LLM 的任务拆分和范围判断；CRG 不能直接把现状升级为 task，也不能替代源码阅读。

验收信号：

- CRG ready 时，task pack 的 `context_refs` 和 `files` 能引用 CRG 辅助发现的候选代码面。
- CRG 不可用时，MVP 输出明确 `provider: direct-repo-reads`，不会假装有 graph 证据。
- Phase 2 才允许在 CRG 不可用但 Serena 可用时生成带 LSP limitation 的 bounded orientation evidence。
- 只有当 plan 和降级证据都不足以确定 task 边界时，才返回 `return-to-plan` 或 `draft-only`。

### 13.8 修订后的分阶段路线

### MVP：结构可信 handoff MVP

目标：证明 task pack 可以作为 identity / freshness / structure 可信的执行输入候选，而不是证明语义拆分一定正确。

- 更新 `spec-write-tasks` final output envelope
- 更新 `task-pack-schema.md`，明确 `spec_id`、repo-relative `source_plan`、canonical `source_plan_hash`、MVP required fields 和 executable `files` 语义
- 新增最小 `tasks hash` / `tasks validate` helper，并接入根 CLI
- 修正 `before-work --task-pack` 的 repo-root source plan 解析
- CRG hook 复用 task pack validate result
- task cards 只作为 `execution_focus`，planned surface 只来自 source plan / sidecar
- 更新 `spec-plan` handoff，只在 deterministic handoff 且语义姿态允许执行时推荐 task pack execution
- 更新 `spec-work`，支持显式 `spec-work <task-pack-path>` validate/consume
- `spec-write-tasks` 生成时支持 MVP bounded source orientation：CRG 优先，CRG 不可用时 targeted direct repo reads，并记录 provider 与 limitation
- 增加 valid / stale / wrong-chain / missing-identity / bad-source-plan-path fixtures
- 完成一次轻量 context-compression check，证明 task pack 路径没有增加首轮阅读负担
- 暂不要求 `spec-work-beta` 同步，也暂不做 `spec-work <plan-path>` 自动分流

退出标准：

- valid / stale / wrong-chain / missing-identity fixture 全部有测试
- `before-work --task-pack` 不会把 stale task cards 当 planned surface
- source plan sentinel / sidecar 仍是 planned surface 唯一来源
- 没有 validator 时只能 draft，不会生成 executable task pack
- 小 plan 仍能直达 `spec-work <plan-path>`
- executable task pack 的 `files` 不允许出现 `...` 省略路径
- `deterministic_handoff` 不被描述为语义正确性证明；语义充分性由 `semantic_posture` 和 LLM review 承担
- 轻量 dogfood 至少记录 direct plan 与 task-pack 两条路径的首次阅读范围；若无减负信号，不进入 handoff 推荐

### M2：plan-path 分流与 beta 同步

目标：在 MVP 的结构校验消费闭环稳定后，让大 plan 可以在进入 work-run 前选择 task pack 路径。

- 更新 `spec-work <plan-path>` 输入路径，在强信号下提供一次性 task-pack 可选分流
- 引入 Serena/LSP 作为 Phase 2 orientation provider：CRG 不可用时可用 `activate_project` + LSP 快速索引补充 symbol/file evidence
- 用户选择 task pack 时，暂停当前 plan execution，编译 deterministic handoff 且语义姿态允许执行后重新进入 `spec-work <task-pack-path>`
- 用户选择直接执行时，继续 `before-work --plan` + 内部 task tracker，且本轮不重复提示
- 同步 `spec-work-beta` 的 task pack validate/consume 口径
- dogfood 至少一份中等复杂 plan，对比 direct plan execution 与 task-pack execution；该样本只作为初始信号，不作为所有 plan shape 的推广证明

退出标准：

- 大 plan 在 work-run 创建前出现一次可选分流提示
- 小 plan / docs-only / narrow bugfix 不提示
- 选择 task pack 后不会创建 `before-work --plan` work-run
- dogfood 证明已测试 plan shape 下 task pack 路径减少首次编辑前的无关 plan 阅读
- M2 rollout 仅覆盖已验证的 plan shape；扩大到新 shape 前需要补充代表性样本

### M3：质量压缩与 review 支持

目标：让 task pack 不只是可执行，还能真正提升复杂计划交付质量。

- 完善 `context_refs`、`entry_hint`、`test_focus`、`done_signal`、`stop_if` 写作指南
- 支持 foundation/story/unit 三类组织视角的示例
- 让 doc review 检查 task pack 是否派生、完整、一致
- 将 M2 dogfood 结果沉淀成 task quality guide 和 review checklist，后续只在 contract / validator / consumption 语义变化时重跑

退出标准：

- `spec-work` 首轮阅读上下文明显下降
- 并行任务 dispatch 的文件冲突率下降
- review 能稳定追踪 task -> requirement -> plan unit

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
| hash 粒度错误 | 无意义过期或漏检漂移 | MVP 使用 canonical source plan body hash，只排除明确非语义状态字段；section hash 延后 |
| hash canonicalization 不确定 | 同一 plan 在生成端和消费端算出不同 hash | 固定 UTF-8、换行、frontmatter 移除和 fail-closed 规则，共用 helper |
| hash contract 没有工具闭环 | deterministic handoff 只是软承诺 | 新增最小 `tasks hash` / `tasks validate`，没有工具只能 draft |
| Task Cards grammar 未定义 | validator 需要猜 Markdown 结构 | MVP 使用 `Task Pack Contract` fenced JSON block 作为唯一机器来源 |
| executable `files` 使用省略路径 | validator 无法判断 repo-relative 文件和 wave overlap | MVP executable task pack 只允许 concrete file path；目录/glob 后续用显式 `path_kind` |
| 手工改 task pack 仍可能 hash fresh | source plan hash 不能证明 task card 仍忠实派生 | 手工改机器 block 默认降级为 transient/draft，除非重新编译或 LLM review |
| CRG 按 task pack 目录解析 `source_plan` | 找错 source plan，planned surface 丢失 | 所有 `source_plan` 都从 repo root 解析 |
| task pack 被 CRG 当作 planned surface | 派生工件变第二真相源 | task cards 只进入 `execution_focus`，planned surface 只来自 source plan / sidecar |
| CRG 不可用时源码定向退化成猜测 | `files`、`context_refs` 和 wave 判断质量下降 | MVP 降级到 targeted direct repo reads，并记录 provider limitation；Serena/LSP 延后到 Phase 2 |
| handoff 返回散文化 | `spec-plan` 无法稳定判断下一步 | `spec-write-tasks` 输出统一 decision envelope |
| 只有文本 contract、无 fixture | stale / wrong-chain 无法被真实证明会拒绝 | 增加 valid / stale / wrong-chain / missing-identity fixtures |
| `spec-work <plan>` 直接临场拆大 plan | 执行上下文被拆解工作消耗，容易漏依赖和文件边界 | M2+ 在 work-run 创建前做 task-pack suitability check，并提供一次性可选分流 |
| task-pack 分流提示过多 | 用户每次执行都被流程打断 | 只在强信号下提示；小计划和用户明确直接执行时不提示 |
| task pack 没有真实压缩上下文 | 新增工件但没有提升执行质量 | M2 dogfood 对比 direct plan 与 task-pack 路径的首次阅读范围、边界纠偏和返工信号 |
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

- canonical source plan hash 的具体语义
- Task Pack Contract 的可解析语法
- hash / validate 的确定性工具闭环
- `spec-write-tasks` 的 final decision envelope、`deterministic_handoff` 和 `semantic_posture`
- CRG `before-work --task-pack` 的 repo-root source plan 解析和 validation posture
- bounded source orientation 的 MVP `CRG -> targeted direct repo reads` 降级链，以及 Phase 2 Serena/LSP provider 边界
- valid / stale / wrong-chain / missing-identity fixture
- executable `files` 的 concrete path 语义
- 手工编辑 task pack 后的降级或 review 规则
- `spec-work <plan-path>` 的 M2+ 早期 task-pack suitability check 和一次性可选分流
- foundation/story/unit 三类拆分视角
- 每 task 的上下文锚点和停止信号
- task pack lint 的确定性边界
- `spec-plan` handoff 与 `spec-work` 消费路径的渐进改造

补上这些后，方案才适合进入结构可信 handoff MVP；否则只能作为 draft task pack 方案使用。

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
- stale / wrong-chain / missing-identity task pack 会被 deterministic validator 拒绝
- `tasks hash` 在生成端和消费端使用同一 canonicalization helper，不会因换行/frontmatter 处理差异产生漂移
- `before-work --task-pack` 能正确回到 source plan planned surface
- `spec-plan` handoff 能根据 decision envelope 稳定决定下一步
- `deterministic_handoff` 明确只覆盖 identity / freshness / structure，语义充分性由 `semantic_posture` 承接
- `spec-work <task-pack-path>` 首轮只读 task pack 与必要 `context_refs`，不会默认完整读取 source plan
- MVP 轻量 dogfood 能证明 task pack 路径没有增加首轮阅读负担
- M2 dogfood 能记录 direct plan 与 task-pack 两条路径的差异：首次编辑前读取章节数、无关章节跳过数、边界纠偏次数、返工次数，并限制 rollout 到已验证 plan shape
- M2+ 的 `spec-work <plan-path>` 对明显复杂 plan 会在执行前提供一次 task-pack 分流，而不是进入执行后临场拆解
- 小任务仍能保持轻量直达

---

## 16. 结论

最终建议非常明确：

1. **新增 `spec-write-tasks`**
2. **把它定义成派生型任务编译 skill**
3. **保持 `spec-plan` 为唯一技术方案 SoT**
4. **用 decision envelope 稳定 plan -> task pack -> work handoff**
5. **用最小 hash / validate 工具证明 task pack freshness 和 identity**
6. **在 M2+ 让 `spec-work <plan-path>` 在强信号下先提供 task-pack 可选分流**
7. **让 `spec-work` 同时支持 `plan` 和结构可信的 `tasks` 输入**
8. **保留小任务直达 work 的路径**

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
- [OpenSpec workflow](https://thedocs.io/openspec/concepts/workflow/)
- [Trellis workflow](https://github.com/kuang/xiaobu/Trellis-0.5.0-beta.8/packages/cli/src/templates/trellis/workflow.md)
- [Trellis start session](https://github.com/kuang/xiaobu/Trellis-0.5.0-beta.8/packages/cli/src/templates/common/commands/start.md)
- CodeStable 的 roadmap / feat-design 体系
