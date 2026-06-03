# SCALE 与 spec-first 治理术语说明

更新日期：2026-06-02

本文解释下面这组对比里的关键名词：

```text
SCALE 倾向用 Artifact + Event + FSM + Gate + Hook 建立更硬的运行时约束。
spec-first 倾向用 Light contract + Explicit boundaries + Scripts prepare, LLM decides 保持轻量可维护边界。
```

这不是在判断哪一种绝对更好，而是在区分两类 AI engineering governance 设计：

- SCALE 更像运行时治理引擎：把 Agent 行为纳入系统约束、状态、事件和门禁。
- spec-first 更像 workflow harness：用轻量事实、边界、文档和可验证证据提高 LLM 判断质量。

## 一句话对比

| 系统 | 核心姿态 | 典型问题 |
| --- | --- | --- |
| SCALE | 让系统在运行时约束 Agent，尽量让 Agent 物理上跳不过关键步骤。 | “Agent 有没有真的探索、验证、审查、交付？” |
| spec-first | 给 LLM 更好的事实、上下文和边界，让语义判断更可靠、可复用、可审查。 | “这个需求、计划、改动、评审和学习有没有留下可信工程证据？” |

## SCALE 术语

### Artifact

`Artifact` 是工件，也是 SCALE 管理 AI 工作生命周期的基本对象。

它把原本容易散落在聊天里的东西变成可追踪实体，例如：

- `Need`：用户原始诉求。
- `Spec`：需求契约。
- `Plan`：技术方案。
- `Task`：原子执行单元。
- `Change`：实际代码或文档变更。
- `Evidence`：验证证据。
- `Defect`：缺陷。
- `Lesson`：经验沉淀。
- `Release`：发布单。

Artifact 通常带有 ID、类型、状态、父子关系、payload、gate、创建者和更新时间。它解决的问题是：AI 工作不能只是一段对话，而应该有可引用、可追踪、可检查的对象。

例子：

```text
ART-spec-20260602-0001
  type: Spec
  status: FROZEN
  parents: [ART-need-20260602-0001]
  children: [ART-plan-20260602-0001]
```

边界：Artifact 越完整，治理能力越强，但 schema、迁移和维护成本也越高。

### Event

`Event` 是事件，用来记录系统里发生过的动作。

典型事件包括：

- `artifact.created`
- `artifact.updated`
- `artifact.transitioned`
- `tool.called`
- `tool.blocked`
- `gate.passed`
- `gate.failed`
- `session.started`
- `lesson.proposed`

SCALE 的设计里，事件流通常比当前状态更接近真相源。当前状态可以理解为事件重放之后的投影。

例子：

```json
{"type":"artifact.transitioned","artifactId":"ART-spec-20260602-0001","payload":{"from":"REVIEWING","to":"FROZEN"}}
```

它解决的问题是：Agent 不能只在最后声称“我做过了”，系统要能回答“什么时候、谁、对哪个对象、做了什么、结果如何”。

边界：Event sourcing 能带来审计和回放能力，但也会引入存储、重放、投影一致性和查询复杂度。

### FSM

`FSM` 是有限状态机，Finite State Machine。

它规定一个 Artifact 可以处在哪些状态，以及只能通过哪些动作迁移到下一个状态。

例子：

```text
Spec:
DRAFT -> REVIEWING -> FROZEN
FROZEN -> REVISING -> REVIEWING
FROZEN -> OBSOLETED
```

FSM 的关键价值是把流程顺序变成系统约束，而不是提示词建议。

例如：

- 只有 `FROZEN` 的 Spec 才能派生 Plan。
- Spec 进入 `REVISING` 后，下游 Plan 需要失效。
- Change 未进入 `VERIFIED` 前，不能进入 Release。

边界：FSM 适合明确、可枚举、可验证的生命周期。对语义模糊、需要权衡的工程判断，FSM 容易变成过度状态机。

### Gate

`Gate` 是门禁，是某个动作、状态迁移或交付声明前必须检查的条件。

Gate 可以是软门禁，也可以是硬门禁：

- 软门禁：提示缺少证据，但允许继续。
- 硬门禁：条件不满足时直接阻断。

例子：

```text
before-stop gate:
  如果本会话修改了代码，但没有运行 test/lint，则阻断 Agent 声称完成。
```

常见 Gate：

- 计划必须包含 scope、rollback、verification。
- 行为代码改动必须有测试。
- 发布前不能有未关闭 Defect。
- 安全相关改动必须有 security review。

边界：Gate 越强，越能减少幻觉式合规；但如果 Gate 过多或判断条件不准，会增加摩擦，甚至阻断合理工作。

### Hook

`Hook` 是钩子，接在 Agent 工具调用或会话生命周期上的自动执行点。

常见 Hook 位置：

- `SessionStart`：会话开始时注入上下文或初始化状态。
- `PreToolUse`：工具调用前检查。
- `PostToolUse`：工具调用后记录结果或触发验证。
- `Stop`：Agent 想结束时检查是否满足完成条件。
- `SessionEnd`：会话结束后汇总、分析、沉淀。

例子：

```text
Agent 调用 Bash("rm -rf /")
  -> PreToolUse Hook
  -> DangerousCommandDetector 命中
  -> 返回 block
```

Hook 是 SCALE 硬运行时约束的入口。它让规则不只是写在文档里，而是在 Agent 实际行动前后执行。

边界：Hook 依赖 host 支持和运行时集成。不同 Agent host 的 hook 能力不同，强依赖 Hook 会提高跨宿主维护成本。

### 更硬的运行时约束

“更硬”指的是 SCALE 倾向把治理落到运行时系统里：

- 不是只要求 Agent 说“我会验证”，而是在 Stop 时检查有没有验证证据。
- 不是只提醒 Agent 不要危险命令，而是在 PreToolUse 阶段拦截危险命令。
- 不是只要求先 Spec 后 Plan，而是用 FSM 阻止非法状态迁移。

它的优势是反幻觉、反惰性、可审计。

它的代价是系统复杂度、集成成本和维护成本更高。

## spec-first 术语

### Light contract

`Light contract` 是轻量契约。

它不是没有契约，而是只为高价值、高频、需要确定性的地方定义最小必要结构。

适合使用严格 contract 的对象：

- task-pack：因为执行 handoff 需要校验来源、hash、任务边界。
- provider readiness facts：因为 graph/MCP 可用性必须由脚本确认。
- review facts：因为评审证据需要区分 confirmed、advisory、stale、degraded。
- run artifact：因为 resume、handoff、closeout 需要可机器读取的摘要。

不适合重 contract 的对象：

- 每一次需求讨论的所有中间想法。
- 每一个计划段落的状态。
- 每一个 LLM 语义判断。
- 每一次 workflow 的完整状态机。

Light contract 的目标是可维护、可验证、可降级，而不是把所有过程都数据库化或状态机化。

### Explicit boundaries

`Explicit boundaries` 是显式边界。

它要求系统清楚区分不同对象的职责和权威级别。

常见边界：

| 边界 | 含义 |
| --- | --- |
| source vs runtime | source 是真相源；runtime mirror 是生成物。 |
| script vs LLM | 脚本负责确定性事实；LLM 负责语义判断。 |
| confirmed vs advisory | confirmed 是验证过的事实；advisory 只是提示线索。 |
| provider vs consumer | GitNexus/MCP/browser 提供证据；workflow 消费证据但不依赖 provider 内部实现。 |
| artifact vs progress state | 文档和 run artifact 是证据，不等同于全局执行状态。 |

例子：

```text
skills/、agents/、templates/、src/cli/ 是 source。
.claude/、.codex/、.agents/skills/ 是 generated runtime。
修复 runtime drift 时应改 source 或 generator，再运行 init，而不是手改 runtime mirror。
```

Explicit boundaries 解决的问题是避免多真相源、避免 provider 内部细节泄漏成 workflow contract、避免 LLM 把线索当事实。

### Scripts prepare

`Scripts prepare` 指脚本准备确定性事实。

脚本适合做：

- 文件发现。
- git 状态读取。
- schema 校验。
- hash 计算。
- runtime drift 检测。
- provider readiness 检查。
- 输出 JSON facts、reason_code、artifact path、exit code。

脚本不适合做：

- 架构取舍。
- 需求优先级判断。
- review 结论。
- “这个计划是否足够好”的语义判断。
- 自动决定 scope 是否应该扩大。

例子：

```text
脚本可以输出：
  graph.query_ready = false
  reason_code = provider-unavailable

脚本不应该输出：
  这个功能不值得做
  这个 review finding 一定成立
```

Scripts prepare 的目标是把事实准备好，让 LLM 不用猜确定性状态。

### LLM decides

`LLM decides` 指 LLM 负责语义判断。

LLM 适合做：

- 理解用户真实意图。
- 判断需求边界。
- 解释架构权衡。
- 选择实现方案。
- 判断 review finding 是否有足够证据。
- 解释 degraded mode 对当前任务的影响。
- 决定下一步是 brainstorm、plan、work、debug、review 还是 compound。

LLM 不应该做：

- 假装运行过测试。
- 编造 shell 命令输出。
- 把 stale graph evidence 当作 confirmed truth。
- 在没有 source 依据时声称某个 provider 可用。

例子：

```text
脚本事实：
  task-pack hash mismatch

LLM 判断：
  这个 task-pack 不能作为执行真相源，应返回 spec-write-tasks 或 spec-plan，而不是继续实现。
```

LLM decides 的关键是：模型做语义判断，但必须基于明确证据，并说明证据等级。

### 轻量可维护边界

“轻量可维护边界”指 `spec-first` 不追求把所有事情变成强运行时控制，而是追求：

- source-of-truth 清楚。
- generated runtime 可重建。
- provider facts 可降级。
- workflow artifact 可复用。
- LLM 判断有证据输入。
- 用户能看懂为什么继续、停止或降级。

它的优势是跨 Claude Code / Codex 更容易维护，workflow 不容易变成中心化复杂引擎。

它的代价是没有 SCALE 那么强的运行时阻断能力，需要依赖 workflow contract、review、closeout 和用户协作来保持质量。

## 设计取舍对照

| 维度 | SCALE | spec-first |
| --- | --- | --- |
| 基本对象 | Artifact | Requirements、plan、task-pack、review、solution 等 repo-local artifacts |
| 真相机制 | Event sourcing + projection | Source docs + deterministic facts + workflow artifacts |
| 流程约束 | FSM/Gate/Hook | Workflow contract + routing + validation facts |
| 自动化强度 | 更强，偏运行时阻断 | 更轻，偏证据增强和语义判断 |
| 降级方式 | Gate soft/warn/block | confirmed/advisory/stale/degraded reason_code |
| 主要风险 | 过度状态机、host 集成复杂 | 约束不够硬、依赖 LLM 自觉解释证据 |
| 最适合场景 | 需要强执行纪律、强审计、多会话 runtime control | 需要跨 host、轻量文档化、可复用工程闭环 |

## 给 spec-first 的落点

SCALE 的概念可以给 `spec-first` 提供启发，但落点应保持轻量：

- 借鉴 Artifact：统一说明每类 workflow artifact 的 producer、consumer、freshness、authority。
- 借鉴 Event：记录关键 handoff 和 closeout facts，但不必做完整 event sourcing。
- 借鉴 FSM：只在 task-pack、provider readiness、run artifact 这类机器事实上使用严格 schema。
- 借鉴 Gate：形成 advisory gate catalog，用 reason_code 告诉 LLM 缺什么证据。
- 借鉴 Hook：用于 setup/update/runtime drift 等明确运行时任务，不作为所有 workflow 的核心约束。

最终原则：

```text
能用轻 contract 解决的，不上强状态机。
能用 confirmed facts 说明的，不让 LLM 猜。
需要语义权衡的，不让脚本替 LLM 下结论。
```

## 参考文件

- `docs/01-ARCHITECTURE.md`
- `docs/02-DATA-MODEL.md`
- `docs/workflow/WORKFLOW_COMPARISON_SCALE_CONFIGS.md`
- `/Users/kuang/xiaobu/spec-first/docs/10-prompt/结构化项目角色契约.md`
