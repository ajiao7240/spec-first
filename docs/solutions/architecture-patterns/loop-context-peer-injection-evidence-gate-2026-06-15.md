---
title: Loop Context / peer-session 注入与 review→work gate 的借鉴边界（痛点证据门未达标 → reasoned defer）
date: 2026-06-15
category: docs/solutions/architecture-patterns
module: spec-sessions, spec-work, spec-code-review
problem_type: architecture_pattern
component: development_workflow
severity: medium
applies_when:
  - 有人提议把 TMA1 / Trellis / 观测层式「Loop Context」借进 spec-first（observe→inject→peer context）
  - 要给 spec-sessions 加结构化 peer 输出 schema，让 work/debug/compound 确定性消费历史会话
  - 要在 spec-work 启动加 review→work handoff gate，强制消费上一轮 review findings
  - 要做 per-turn / 活跃 peer 注入 / SessionStart 注入 handoff 摘要（P0-1 类）
domain: Loop Context 借鉴 / 跨会话 peer 上下文 / review→work 闭环
pattern: 痛点证据门 + 宿主商品化门 + 已有原语覆盖门（三门齐过才建）
rejected_alternatives:
  - "P1-3 先建 peer-session-summary.v1 结构化 schema 作地基（无接线消费者，主消费者 P0-1 已 defer，speculative generality）"
  - "P0-2 review→work handoff gate 当前落地（跨会话 finding 丢失痛点 0 confirmed 证据；同会话增量被既有 Summary-First Handoff 覆盖）"
  - "schema 含 last_heartbeat_at / status:active|closed（live-session 字段泄漏进历史综述，撞 P0-1 非目标边界）"
  - "verification_status: pass|fail 枚举（把 historian 的综述推断伪装成 confirmed 执行事实，advisory 当 confirmed）"
applicable_versions: v1.11.0+
source_refs:
  - docs/plans/2026-06-15-004-feat-peer-summary-schema-review-work-gate-plan.md
  - docs/plans/2026-06-15-002-feat-per-turn-injection-evaluation-plan.md
  - docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md
invalidation_condition: >
  累计 ≥3 条 confirmed 失败记录落 docs/solutions/ 或 docs/12-bug分析/，标
  review-finding-lost / peer-context-drift 关键词，证明「review findings 跨轮/跨会话丢失」
  或「peer 历史不可结构化消费导致重复踩坑」是真实高频痛点；届时重启 plan 004 评估，
  并先修 doc-review 暴露的 5 处设计硬伤（见 plan 004 frontmatter）。
---

## Context

源起 TMA1 v2「让 Coding Agent Loop 转起来」对标分析：是否给 spec-first 补一层
Loop Context（observe→attribute→inject→act），具体落为两项——
P1-3（spec-sessions 加结构化 peer 输出 schema `peer-session-summary.v1`）与
P0-2（spec-work 加 review→work handoff gate）。两项看似「接线非新建」、成本低、契约对齐。

## Guidance

经 5 reviewer 多视角 + 对抗 doc-review 与痛点证据门检索，结论 **DEFERRED**。三门只过一门：

1. **痛点证据门（未过，决定性）：** `docs/solutions/` + `docs/12-bug分析/` 对「review
   findings 跨轮/跨会话丢失」与「peer 历史不可结构化消费」**0 条 confirmed 失败记录**
   （≥3 阈值）。唯一邻近记录 `reviewer-dispatch-failure-2026-05-07.md` 反向证明
   「findings 没丢，只降级了交叉验证」。且 `ai-reviewer-capability-borrowing-gates-2026-06-09.md`
   已显式拒绝为本地单会话 CLI 借鉴「增量复审/carry findings forward」，判定痛点未证实。
2. **宿主商品化门（部分撞）：** P0-1（per-turn/活跃 peer 注入）依赖 per-turn hook，
   撞角色契约 §7「不重建宿主正在商品化的 primitive」，已 defer。P1-3 的活跃-peer 字段
   （`last_heartbeat_at`/`status:active`）是 P0-1 语义泄漏。
3. **已有原语覆盖门（部分撞）：** spec-work 已有 Summary-First Handoff 消费 review
   artifact；spec-sessions 已有 output_schema 透传机制。P0-2/P1-3 的真实增量比「填空白」小。

## Why This Matters

- **「接线非新建 + 成本低」不豁免证据门。** 廉价不等于该做；按 §10，证据不足时正确动作是
  带重启条件的 reasoned-defer，不是先建地基。便宜的 speculative infrastructure 仍是 latent
  capability，不是 clearer boundary。
- **地基先行陷阱：** P1-3 的主机器消费者是已 defer 的 P0-1。为「可能永不 ship 的消费者」
  建命名 schema = speculative generality。先建地基、再找用例，方向反了。
- **论证错位识别法：** P0-2 的 motivating 痛点是「跨会话丢失」，但其确定性牙齿只够到
  同会话/frontmatter 可发现源——**有牙齿处 finding 本就可见，真丢失处够不到**。当一个 gate
  的能力区与它宣称解决的问题区不重叠，是论证错位信号。
- **结构化抹掉对冲：** 把 LLM 的*综述推断*编码成 `pass|fail` 枚举，会被下游当 confirmed。
  advisory 数据结构化时，字段命名要保留「这是推断」的不确定性（如 `appeared-pass`）。
- **同日 plan 002 已立同类证据门**（per-turn 注入因痛点检索空而 defer，重启条件 ≥3 confirmed
  context-drift）。同类能力反复出现时，先查既有 defer 记录的重启条件，别重新规划。

## When to Apply

- 当某个 Loop Context、peer session、active peer 或 review→work gate 方案看似只需补一层 schema
  或接线时，先查痛点证据门，而不是先建通用地基。
- 当方案依赖宿主正在商品化的 per-turn / active-session primitive 时，先确认 spec-first 的真实增量是否
  在 source/runtime 边界之上，而不是重建宿主层能力。
- 当结构化字段会被下游当成 confirmed truth 时，用字段命名和消费者合同保留 advisory 边界。

## Examples

- P1-3 的 `peer-session-summary.v1` 看似是低成本地基，但主机器消费者 P0-1 已 defer，当前落地会变成
  speculative generality。
- P0-2 的 review→work gate 只能稳定约束同会话/frontmatter 可见 finding，无法覆盖它声称要解决的
  跨会话丢失痛点，因此应 reasoned-defer 而不是伪装成闭环修复。
