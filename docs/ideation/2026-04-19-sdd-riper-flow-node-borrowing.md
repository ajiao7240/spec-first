---
date: 2026-04-19
topic: sdd-riper-flow-node-borrowing
source: docs/ideation/2026-04-19-sdd-riper-integration-ideation.md
status: draft
---

# sdd-riper 对 spec-first 的流程与节点实现借鉴

## 1. 背景

`sdd-riper` 和 `spec-first` 都在解决 AI 编程中的同一类核心问题：模型容易误读任务、长会话中上下文腐烂、执行和计划脱节、完成缺少证据、经验无法复用。

但两者的系统形态不同：

- `sdd-riper` 更像一套轻量方法论与 Skill 协作纪律，核心是 `Spec + RIPER + checkpoint`。
- `spec-first` 已经是工程化 workflow CLI，核心是 `Stage-0 决策输入 + Ideate/Brainstorm/Plan/Work/Review/Compound + 双宿主治理 + CRG/AST 事实底座`。

因此，集成策略不是照搬 `sdd-riper` 的完整状态机，而是分两层借鉴：

1. **流程中借鉴的点**：提升 spec-first 整条交付链的阶段边界、门禁和闭环质量。
2. **已有流程节点内部实现借鉴的点**：让每个已有 workflow 节点产出更清晰、更可验证、更可复用的决策输入。

集成原则仍然是：

```text
轻 contract + 明确边界 + 让 LLM 决策
```

## 2. 流程中借鉴的点

`spec-first` 不需要新增一条 `Research -> Innovate -> Plan -> Execute -> Review` workflow，因为现有主链已经覆盖端到端交付：

```text
Ideate -> Brainstorm -> Plan -> Work -> Review -> Compound
```

更合理的方式是把 `sdd-riper` 的流程纪律映射到现有链路。

| sdd-riper 点 | spec-first 中的对应集成 | 价值 |
|---|---|---|
| `Pre-Research` | 强化 `spec-graph-bootstrap` / `compound` 作为 Stage-0 输入准备层 | 明确“先准备事实和上下文，再让 LLM 决策” |
| `No Spec, No Code` | 强化 `brainstorm -> plan -> work` 的 artifact gate | 避免从口头需求直接裸改 |
| `No Approval, No Execute` | 在 `spec-work` 中保留“执行前 checkpoint + 明确继续信号” | 防止计划还没确认就开始改代码 |
| `Plan -> Execute` 分离 | 继续坚持 `spec-plan` 只做 HOW，`spec-work` 才执行 | 保持计划和执行职责边界 |
| `Review` 阶段 | 在 `spec-review` 中增加三轴 verdict | 让 review 不只是 findings 列表，还能判断是否真正完成 |
| `Archive` 阶段 | 并入 `spec-compound` | 把任务结果沉淀成可复用知识，而不是停在 PR 结束 |
| `DEBUG` 旁路 | 强化 `spec-debug` 的“只定位，不直接修”边界 | 避免 debug 过程失控变成无计划修改 |
| `Multi-project` 边界 | 映射到 spec-first workspace / cross-repo 机制 | 提升跨仓任务的作用域可控性 |
| `Light checkpoint flow` | 作为小任务/强模型场景的轻量锚点，而不是新流程 | 降低流程成本，同时保留关键门禁 |

### 2.1 Stage-0 对应 Pre-Research

`sdd-riper` 的 Pre-Research 包括：

- `create_codemap`
- `build_context_bundle`
- `sdd_bootstrap`

`spec-first` 已有更强的事实底座：

- `spec-graph-bootstrap`
- CRG / AST / SQLite 分析
- `minimal-context/*.json`
- `verification_summary`
- `verifier_dispatch`
- `freshness`
- `fallback_reason`

因此，借鉴点不是新增手写 codemap，而是把 Pre-Research 的精神表达为：

```text
先暴露事实来源、质量等级、降级原因、上下文新鲜度，再让 LLM 做计划或执行判断。
```

### 2.2 Plan 与 Work 的边界继续保持硬分离

`sdd-riper` 中 `Plan Approved` 是讨论和执行的边界。

`spec-first` 中对应关系是：

- `spec-plan`：形成 HOW，输出 plan artifact。
- `spec-work`：消费 plan，执行代码修改。

建议不引入精确短语 `Plan Approved` 作为全局硬规则，因为 spec-first 面向 Claude / Codex 双宿主，过度依赖精确短语会降低易用性。

更合适的集成方式是：

- `spec-work` 启动时必须读取 plan。
- 执行前输出短 checkpoint。
- checkpoint 中明确当前理解、核心目标、允许改动面、验证方式。
- 用户给出明确继续信号后再执行。

### 2.3 Review 后接 Compound / Archive

`sdd-riper` 的 Archive 强调任务结束后要把中间产物沉淀成复用知识。

`spec-first` 已有 `spec-compound` 和 `docs/solutions/`，因此不需要新增 `archive` workflow。更好的方向是：

- `spec-review` 输出是否值得沉淀的建议。
- `spec-compound` 支持 human-facing 与 LLM-facing 两类总结。
- 结论必须保留 trace 到来源计划、diff、验证命令或 review finding。

### 2.4 Debug 作为旁路，不直接改代码

`sdd-riper` 的 Debug 模式强调“日志 + spec + 代码”的三角定位，并且 debug 本身不直接改代码。

这可以强化 `spec-debug` 的边界：

- debug 阶段只负责复现、定位、形成根因假设和证据。
- 需要修复时，转入 `spec-plan` / `spec-work`，或在极小范围内走明确的小修通道。
- 避免从“定位问题”漂移成“顺手改一堆相关代码”。

## 3. 已有流程节点内部实现借鉴的点

这一层不新增 workflow，而是增强每个已有节点内部的 contract。

| spec-first 节点 | 可借鉴点 | 具体改法 |
|---|---|---|
| `using-spec-first` | sdd-riper 的入口分流意识 | 保持当前 routing，不增加 RIPER 入口；只补充“高风险/长链路任务需要 checkpoint”提示 |
| `spec-ideate` | 轻量目标锚定 | ideation 输出中增加“核心目标 / 不处理项 / 成功证据”字段，避免想法发散过头 |
| `spec-brainstorm` | `Restate First`、`Done Contract` | 在需求文档中更稳定地产出“我理解的问题”“完成定义”“由什么证明完成” |
| `spec-plan` | `Plan as Contract` | 已有 implementation units 可增强为：文件、签名、测试场景、风险、验证证据一一可追踪 |
| `spec-work` | `Checkpoint Before Execute`、`Reverse Sync`、`Resume Ready` | 执行前短 checkpoint；执行后写 closure summary；暂停时写下一步唯一动作 |
| `spec-review` | 三轴 review | 顶层增加 `Requirement Completion / Plan-Diff Fidelity / Code Intrinsic Quality` verdict |
| `spec-debug` | 日志 + spec + 代码三角定位 | 明确 debug 本身不改代码；修复必须转入 plan/work 或小范围 fast path |
| `spec-compound` | human / LLM 双视角 archive | human 版用于汇报，LLM 版用于后续检索和复用，并保留 Trace to Sources |
| `spec-graph-bootstrap` | `create_codemap` / `context_bundle` 的思想 | 不手写 codemap，而是用 CRG/Stage-0 产物表达代码地图、上下文包、质量等级 |
| `stage0-context` 消费侧 | `Reload Before Act` | 当 `freshness_stale`、`partial`、`fallback_reason` 出现时，workflow 要求关键动作前补读源文件 |
| `doctor` / `init` / `update` | 显式边界 | 借鉴 “Spec is Truth” 思想，继续强化 source-of-truth 与 runtime artifact 的区别 |

## 4. 优先落地的内部实现点

### 4.1 `spec-work` 增加 Closure Summary

建议 `spec-work` 完成后必须留下 closure summary，记录：

- 实际改动
- 与 plan 的偏差
- 验证命令和结果
- 剩余风险
- 下一轮恢复锚点

推荐先写入 workflow run artifact，例如：

```text
.spec-first/workflows/spec-work/<run-id>/closure-summary.md
```

后续再决定是否同步回 `docs/plans/*.md`。

这样可以避免直接改 plan 时和用户手写内容产生冲突，同时保留可追溯闭环。

### 4.2 `spec-review` 增加三轴总评

当前 `spec-review` 的 persona review 很强，但最终输出可以增加一个顶层 verdict：

| Axis | 问题 | Verdict |
|---|---|---|
| Requirement Completion | 需求是否完成，是否有证据证明 | PASS / PARTIAL / FAIL |
| Plan-Diff Fidelity | 实现是否忠实于 plan 和允许改动面 | PASS / PARTIAL / FAIL |
| Code Intrinsic Quality | 代码自身质量、测试、风险是否可接受 | PASS / PARTIAL / FAIL |

这个 verdict 不应替代 persona findings，也不应变成 CLI 强阻塞。它只是更好的合并视图，帮助用户判断是否继续修、是否可合并、是否需要 compound。

### 4.3 `spec-plan` 增加更明确的 Done Contract

每个 feature-bearing implementation unit 不只写“做什么”，还应写：

- 什么算完成
- 哪个测试、日志、review 或人工验收能证明完成
- 哪些情况仍算未完成

这能减少 `spec-work` 阶段的实现者自由发挥，也能让 `spec-review` 更容易做 requirements trace。

### 4.4 Stage-0 freshness 与 workflow 行为打通

当前 `stage0-context` 已经能输出类似：

```json
{
  "fallback_reason": "freshness_stale",
  "level": "L0"
}
```

下一步应让 `spec-plan`、`spec-work`、`spec-review` 明确消费它：

- 不把 stale 当成硬阻塞。
- 降低对旧 context 的信任。
- 关键动作前补读相关源文件、计划或 Stage-0 artifact。
- 在响应中说明当前判断基于 fresh 事实还是 stale/partial context。

这就是把 sdd-riper 的 `Reload Before Act` 转译成 spec-first 的决策输入消费规则。

## 5. 不建议集成的点

| 不建议项 | 原因 |
|---|---|
| 直接新增 `sdd-riper-one` workflow | 与现有主链重复，且容易引入强状态机 |
| 全局强制精确短语 `Plan Approved` | 降低双宿主易用性，也不符合轻 contract 原则 |
| 复制 `archive_builder.py` | 该脚本是启发式抽取，质量低于 spec-first compound 应有标准 |
| 新增 `mydocs/` 目录 | 与现有 `docs/brainstorms`、`docs/plans`、`docs/solutions`、`.spec-first/workflows` 体系冲突 |
| 用人工 codemap 替代 CRG / Stage-0 | 当前项目已有更强的 AST/CRG 事实底座 |
| 引入 `zero spec` 通道 | 容易绕过当前治理、验证和 changelog 纪律 |
| 在 README 里再维护一套 skill/entrypoint 矩阵 | 违反 dual-host governance 的 source-of-truth 边界 |
| 将 Review FAIL 变成 CLI 硬阻塞 | 与“让 LLM 决策”和现有 routing/severity 模型冲突 |

## 6. 推荐实施顺序

### 第一阶段：轻量锚点与 checkpoint

范围：

- `spec-brainstorm`
- `spec-plan`
- `spec-work`
- `spec-debug`

目标：

- 加入 `Restated Understanding`
- 加入 `Core Goal`
- 加入 `Done Contract`
- 加入执行前 checkpoint
- 加入 freshness 降级后的补读要求

这个阶段只改 skill contract 和对应 contract tests，成本最低。

### 第二阶段：Work Closure / Reverse Sync

范围：

- `spec-work`
- `.spec-first/workflows/spec-work/<run-id>/`
- 相关 contract tests

目标：

- 执行后产出 closure summary。
- 记录实际改动、偏差、验证、风险和恢复锚点。
- 为 `spec-review` 和 `spec-compound` 提供更好的输入。

### 第三阶段：Review 三轴总评

范围：

- `spec-review`
- review synthesis / output contract
- 相关 contract tests

目标：

- persona findings 后增加三轴 verdict。
- verdict 作为决策输入，不作为硬阻塞。

### 第四阶段：Compound 双视角沉淀

范围：

- `spec-compound`
- `docs/solutions/` 写入规范
- learnings researcher 消费规则

目标：

- 支持 human-facing summary。
- 支持 LLM-facing reusable context。
- 保持 `Trace to Sources`。

### 第五阶段：Workspace / Multi-project 边界增强

范围：

- workspace context
- `spec-plan`
- `spec-work`
- cross-repo plan 结构

目标：

- 显式表达 active repo / change scope / contract interfaces。
- 映射到已有 workspace contract，不新增第二套 registry。

## 7. 一句话结论

流程层借鉴 sdd-riper 的门禁和闭环，节点内部借鉴它的 checkpoint、Done Contract、Reverse Sync、三轴 Review 和 Archive 结构。

所有集成都应服务于 spec-first 的核心方向：提供更好的 LLM 决策输入，而不是新增一套重状态机。
