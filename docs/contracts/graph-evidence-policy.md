# Graph Evidence Policy

## 目标

本政策定义 spec-first 如何消费 GitNexus、code-review-graph、Serena、ast-grep 和直接源码读取等代码证据。它是 workflow prose 与 host instruction block 的 source of truth；脚本负责产出确定性 readiness facts，LLM 负责基于事实做语义判断。

下游 workflow 读取 graph/provider/impact readiness artifacts 时，字段级速查契约见 `docs/contracts/graph-provider-consumption.md`。本政策定义证据等级与冲突处理；消费契约定义 canonical artifact、字段层级和禁止读取的旧路径/旧字段。

## 证据等级

- `confirmed`: 来自源码、测试、schema 校验、命令 exit code、compiled readiness facts 或 provider raw log 的可复验事实。
- `session-local`: 当前会话中 live MCP / CLI 查询成功返回的事实；可用于本轮判断，但不回写 compiled readiness。
- `advisory`: workspace candidate、fallback summary、definitions-only result、低置信 graph pointer 等辅助线索。
- `stale`: source revision、worktree dirty 状态、provider package projection 或 query proof 与当前上下文不一致。

## Refresh Trigger Policy

spec-first 默认采用 “automatic check, explicit refresh” 模型。便宜、确定性的 freshness check 可以由所有 graph consumer 自动执行；会写入 provider 或 graph readiness artifact 的刷新动作只属于显式 bootstrap / repair 路径。

| 操作 | 触发节点 | 写入边界 |
| --- | --- | --- |
| `freshness-check` | plan、work、debug、review 等 graph consumer 在声明 compiled graph evidence 为 primary 前执行 | 只读取 canonical artifacts 和当前 repo/provider snapshot；不写 `.spec-first/graph/*`、`.spec-first/providers/*` 或 `.spec-first/impact/*` |
| `refresh-handoff` | consumer 发现 graph stale / dirty-uncertain / provider projection stale，且当前任务是 graph-heavy | 给出 `$spec-graph-bootstrap` handoff；consumer 不运行 provider analyze、build、repair 或 index rebuild |
| `bootstrap-refresh` | 用户显式进入 `$spec-graph-bootstrap`，或 parent maintenance path 显式运行 graph-bootstrap all-repos | 可写 canonical graph readiness artifacts、provider diagnostics 和 impact capability artifacts |
| `repair-preview` | GitNexus storage、provider projection 或 query proof 需要恢复时 | 先输出 preview / confirm 边界；普通 workflow 不静默删除 `.gitnexus`、provider raw artifacts 或 canonical readiness artifacts |

branch switch、pull、rebase、merge、`source_revision` mismatch、`worktree_status_hash` mismatch、dirty worktree 变化和 provider fingerprint mismatch 都是 invalidation signals，不是自动 rebuild triggers。consumer 可把旧 graph facts 降级为 `stale` / `advisory`，graph-heavy 工作再明确建议 `$spec-graph-bootstrap`。

## GitNexus 使用边界

- 当 GitNexus index 新鲜且 `query_ready=true` 时，优先用于仓库级代码理解、execution flow 查询、symbol relationship、blast radius 和 change detection。
- 当 GitNexus 返回 stale、degraded、definitions-only、query-unverified 或 unavailable 时，只能作为有限证据；必须结合源码读取、测试或其他 provider 交叉确认。
- GitNexus 不能替代 spec-first workflow 判断、需求/计划范围判断、测试结果或直接源码事实。
- `gitnexus_detect_changes` 是 review / commit 前的 evidence，不是无解释的硬阻断器。发现超出预期影响面时，应说明 affected flows、风险与下一步验证。
- `gitnexus_detect_changes` 和 impact 查询不触发 provider rebuild；需要 current graph evidence 时，先通过 `$spec-graph-bootstrap` 刷新 readiness。

## Provider 职责

- GitNexus：仓库级架构事实、execution flows、symbol relationships、自然语言代码查询和 change detection。
- code-review-graph：变更集影响面、review context、相关测试和 graph stats。
- Serena：LSP / symbol 级精确定位、references、overview 和局部编辑辅助。
- ast-grep：结构化代码搜索和机械 rewrite 辅助。
- 直接源码与测试：冲突时的最终确认事实来源。

## 冲突处理

当 provider 证据互相冲突，或与源码、测试、compiled readiness facts 冲突时：

1. 明确指出冲突来源和 freshness 状态。
2. 优先采用可复验源码、测试和 compiled readiness facts。
3. 把 provider 结果降级为 pointer 或 advisory evidence。
4. 给出最窄的下一步验证命令或源码检查点。

## Host Instruction Block

`AGENTS.md` / `CLAUDE.md` 中的 `<!-- gitnexus:start -->` block 只保留轻量、自包含的使用边界，不写指向目标仓库本地 `docs/contracts/` 文件的相对链接，不写动态索引计数、不写 host-specific runtime skill 路径、不写绝对 `MUST` / `NEVER` provider 规则。GitNexus provider 可刷新该 block；spec-first `gitnexus-instruction` normalizer 负责把最终 source 收敛回稳定 evidence contract。
