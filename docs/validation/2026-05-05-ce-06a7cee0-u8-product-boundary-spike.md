---
title: CE 06a7cee0 U8 new skill product boundary spike
date: 2026-05-05
type: validation
source_plan: docs/plans/2026-05-04-001-sync-ce-06a7cee0-workflow-updates-plan.md
ce_range: 4b5f28da..06a7cee0
status: completed
---

# CE 06a7cee0 U8 新 skill 产品边界 spike

## 结论

本轮不把 CE 新增的 `ce-strategy`、`ce-product-pulse`、`ce-simplify-code` 直接同步为 `spec-first` public skills。

原因不是这些能力没有价值，而是它们会改变 spec-first 当前产品身份和 artifact 边界。spec-first 的核心链路仍是：

```text
Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge
```

U8 保持为独立产品决策，不混入 CE workflow sync patch。

## CE source facts

| CE skill | CE artifact / behavior | Product boundary signal |
|---|---|---|
| `ce-strategy` | 写 repo-root `STRATEGY.md`，作为 `ce-ideate`、`ce-brainstorm`、`ce-plan` 的上游 grounding | 引入新的 canonical product strategy artifact，且会改变 ideate/brainstorm/plan 的输入优先级 |
| `ce-product-pulse` | 读 `.compound-engineering/config.local.yaml`，写 `docs/pulse-reports/`，查询 analytics / tracing / payments / read-only DB | 引入外部产品数据源、PII 风险、data-source config、周期性 report timeline，不属于当前 spec/plan/code/review 主链路 |
| `ce-simplify-code` | 默认基于当前分支 diff，派发 reuse / quality / efficiency reviewers，并直接修复、验证 | 与 `spec-work` 的 simplify-as-you-go、`spec-code-review` 的 maintainability/performance reviewers、`spec-optimize` 的度量优化存在重叠；还要求 subagent dispatch 作为核心机制 |

## 决策

### `spec-strategy`

暂不落地。

`STRATEGY.md` 可以成为某些产品仓库的有用上下文，但对 spec-first 自身来说，它会新增一个和 `docs/10-prompt/结构化项目角色契约.md`、`README.md`、`docs/01-需求分析/`、`docs/plans/` 并列的 source-of-truth。没有明确优先级前，把它接入 `spec-ideate` / `spec-brainstorm` / `spec-plan` 会制造 grounding 冲突。

后续如要接受，应先单独计划：

- 明确 strategy artifact 是否属于 spec-first source-of-truth。
- 明确它和角色契约、README、requirements、plans 的优先级。
- 不默认使用 CE 的 repo-root `STRATEGY.md` 路径；应先判断 spec-first 是否需要 `docs/` 下的受管策略 artifact。
- 补双宿主 governance、README、tests 和 runtime generation contract。

### `spec-product-pulse`

暂不落地。

Pulse 是产品运营/observability 能力，不是当前 spec-first workflow harness 的核心节点。它需要外部数据源、read-only DB 凭据、PII 处理、report retention、config schema 和 scheduling 边界。直接同步会把 spec-first 从工程 workflow harness 扩展成产品 telemetry harness。

后续如要接受，应先单独计划：

- 明确数据源 provider contract 和 read-only enforcement。
- 明确 `.spec-first/config.local.yaml` 或其他本地配置路径，不复用 CE `.compound-engineering/config.local.yaml`。
- 明确 `docs/pulse-reports/` 的生命周期、PII 守卫、git 提交策略。
- 明确 pulse report 是否被 `spec-ideate` / `spec-plan` 消费，还是只作为 standalone operational report。

### `spec-simplify-code`

暂不作为 standalone public skill 落地。

代码简化是有价值的，但当前 spec-first 已有三处相关机制：

- `spec-work`：执行中每 2-3 个单元做 simplify-as-you-go。
- `spec-code-review`：maintainability / performance reviewers 捕捉复杂度、重复、效率问题。
- `spec-optimize`：处理有度量目标的优化循环。

CE 的 `ce-simplify-code` 还把 3 个 subagents 作为核心执行机制。Codex 当前 developer policy 只有用户明确要求 subagents/delegation/parallel agent work 时才允许派发；把它做成默认 public workflow 容易和 host 边界冲突。

后续如要接受，优先考虑把“简化检查”作为 `spec-work` shipping 前的可选 gate 或 `spec-code-review` 的 targeted mode，而不是立即新增 standalone public skill。

## 本轮不变项

- 不新增 `skills/spec-strategy/`。
- 不新增 `skills/spec-product-pulse/`。
- 不新增 `skills/spec-simplify-code/`。
- 不更新 skill governance counts、README runtime counts 或 public entrypoint tables。
- 不引入 `STRATEGY.md`、`docs/pulse-reports/`、`pulse_*` config 或 CE `.compound-engineering/config.local.yaml` 语义。

## 验证建议

本轮验证只需 source scan：

```bash
rg -n "spec-strategy|spec-product-pulse|spec-simplify-code|STRATEGY\\.md|docs/pulse-reports|pulse_" skills agents templates src README.md README.zh-CN.md tests
```

预期结果：除计划、ledger、spike、方法论或 negative contract 文档外，不存在新 runtime/public skill 引用。
