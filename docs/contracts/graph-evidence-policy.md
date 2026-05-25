# Graph Evidence Policy

## 目标

本政策定义 spec-first 如何消费 GitNexus、ast-grep 和直接源码读取等代码证据。它是 workflow prose 与 host instruction block 的 source of truth；脚本负责产出确定性 readiness facts，LLM 负责基于事实做语义判断。

下游 workflow 读取 graph/provider/impact readiness artifacts 时，字段级速查契约见 `docs/contracts/graph-provider-consumption.md`。GitNexus native capability baseline、source tags 和 read-only MCP resource provenance 边界见 `docs/contracts/gitnexus-capability-catalog.md`。本政策定义证据等级与冲突处理；消费契约定义 canonical artifact、字段层级和禁止读取的旧路径/旧字段。

## Downstream Workflow Consumption

`$spec-work`、`$spec-code-review` 和 `$spec-debug` 消费 Plan envelope 或 `$spec-work` run artifact 中 graph evidence 摘要时，遵循 `docs/contracts/downstream-graph-evidence-consumption.md`。下游消费沿用本文的四轴枚举和 Plan envelope validity matrix；不得引入第二套 downstream 合法性 enum，也不得把 GitNexus 发现的额外影响面自动变成 implementation scope。

## 证据等级

- `confirmed`: 来自源码、测试、schema 校验、命令 exit code、compiled readiness facts 或 provider raw log 的可复验事实。
- `session-local`: 当前会话中 live MCP / CLI 查询成功返回的事实；可用于本轮判断，但不回写 compiled readiness。
- `advisory`: workspace candidate、fallback summary、definitions-only result、低置信 graph pointer 等辅助线索。
- `stale`: source revision、worktree dirty 状态、provider package projection 或 query proof 与当前上下文不一致。

> **Plan evidence envelope（供 `$spec-plan` 输出使用）：**
> - `capability_status=available|partial|unavailable|mutation-gated` 表示 GitNexus native capability 对当前计划问题的可用性。
> - `evidence_grade=primary|session-local|advisory|stale` 表示事实可信度；其中 `primary` 是 `confirmed` 的 Plan 层别名，强调来源为已验证的 durable bootstrap、源码、测试或 schema/命令事实。
> - `evidence_posture=primary|fallback` 表示本轮 Plan 选择继续使用 GitNexus native capability，还是切到 direct source reads / ast-grep / git diff。`fallback` 是 posture，不是 evidence grade。
> - `freshness_state=fresh|stale|dirty-advisory|query-unverified` 表示索引/查询证明相对当前 checkout 的新鲜度。
> - `source_tags[]` 只使用 `docs/contracts/gitnexus-capability-catalog.md` 定义的 GitNexus catalog 词表；checked-in baseline、setup projection、provider pin、live MCP tool/resource 和 session-local inference 必须分开标注，不能折叠成一个 `available` fact。
>
> `evidence_grade` 与 `evidence_posture` 是正交 axis。`evidence_posture=fallback` 可以与任意 `evidence_grade` 共存；当 fallback 来源是当前源码、测试或 schema 校验时，仍可写 `evidence_grade=primary`，因为 posture 不降低事实本身的可信度。

### Plan envelope validity matrix

`$spec-plan` 的 Graph / GitNexus Evidence block 是 Plan 层 envelope，不是 canonical readiness truth。它可以从 canonical graph/provider artifacts、setup-owned projection pointers（例如 `runtime-capabilities.json.project_graph_readiness` / `graph-providers.json.derived_readiness`）、workspace advisory facts 和 session-local MCP evidence 派生，但不得写回 readiness artifacts，也不得替代 `Graph Readiness.status`、provider `query_ready` 或 workspace `query_usability`。

下列组合必须被解释为非法、降级或显式限制：

- `capability_status=unavailable` 时，`evidence_grade` 不得为 `primary` / `session-local`，必须收敛到 `advisory` 或 `stale`；`evidence_posture` 必须为 `fallback`，且 `freshness_state` 不得为 `fresh`。
- `capability_status=mutation-gated` 表示 capability 需要 explicit user action / preview-first 路径；不得自动产出 mutation implementation unit。此时 `evidence_grade` 仅可为 `session-local` / `advisory` / `stale`，`freshness_state` 不得用于声称 mutation safety 已验证。
- `freshness_state=fresh` 仅能来自当前 fingerprint 匹配的 canonical facts 或 query-ready provider；不能与 `capability_status=unavailable` 共存。
- `freshness_state=stale` 或 `freshness_state=dirty-advisory` 时，graph/provider 证据信心必须降低，拒绝 `evidence_grade=primary`。
- `freshness_state=query-unverified` 必须配合 `evidence_grade=advisory` 或 `stale`，不得与 `primary` 共存。
- `evidence_posture=primary` 与 `capability_status=unavailable` 互斥；不能既声明 GitNexus unavailable，又声明继续走 GitNexus primary posture。
- `evidence_posture=fallback + evidence_grade=primary` 是合法组合，专门表达“GitNexus posture 已 fallback，但当前源码/测试事实本身是 confirmed/primary”。

## Refresh Trigger Policy

spec-first 默认采用 “automatic check, explicit refresh” 模型。便宜、确定性的 freshness check 可以由所有 graph consumer 自动执行；会写入 provider 或 graph readiness artifact 的刷新动作只属于显式 bootstrap / repair 路径。

| 操作 | 触发节点 | 写入边界 |
| --- | --- | --- |
| `freshness-check` | plan、work、debug、review 等 graph consumer 在声明 compiled graph evidence 为 primary 前执行 | 只读取 canonical artifacts 和当前 repo/provider snapshot；不写 `.spec-first/graph/*`、`.spec-first/providers/*` 或 `.spec-first/impact/*` |
| `refresh-handoff` | consumer 发现 graph stale / dirty-uncertain / provider projection stale，且当前任务是 graph-heavy | 给出 `$spec-graph-bootstrap` handoff；consumer 不运行 provider analyze、build、repair 或 index rebuild |
| `bootstrap-refresh` | 用户显式进入 `$spec-graph-bootstrap`，或 parent maintenance path 显式运行 graph-bootstrap all-repos | 可写 canonical graph readiness artifacts、provider diagnostics 和 impact capability artifacts |
| `repair-preview` | GitNexus storage、provider projection 或 query proof 需要恢复时 | 先输出 preview / confirm 边界；普通 workflow 不静默删除 `.gitnexus`、provider raw artifacts 或 canonical readiness artifacts |

branch switch、pull、rebase、merge、`source_revision` mismatch、`worktree_status_hash` mismatch、dirty worktree 变化和 provider fingerprint mismatch 都是 invalidation signals，不是自动 rebuild triggers。consumer 可把旧 graph facts 降级为 `stale` / `advisory`，graph-heavy 工作再明确建议 `$spec-graph-bootstrap`。

commit / merge 之后 canonical `graph-facts.json` 可能 stale；consumer 可自动检测并 handoff。**clean single-repo** operator 在需要 query / review 且接受 diagnostic / validation-only expert 边界时可显式运行 `$spec-graph-bootstrap --incremental`，对齐 GitNexus notify-only stale detection + explicit `analyze` 模型；当前 validation 尚未证明它是 correctness-backed acceleration path。`--all-repos` 仍走 full 默认，显式 `--all-repos --incremental` 与父级 workspace 隐式 all-repos `--incremental` 都 unsupported；graph-affecting dirty worktree refresh 会标记 `dirty-advisory`，增量请求降级为 full，并以 warn-and-continue 运行 provider commands；普通 workflow 不静默 rebuild provider index。

## GitNexus 使用边界

- 当 GitNexus index 新鲜且 `query_ready=true` 时，优先用于仓库级代码理解、execution flow 查询、symbol relationship、blast radius 和 change detection。
- 当 GitNexus 返回 stale、degraded、definitions-only、query-unverified 或 unavailable 时，只能作为有限证据；Plan/Work/Debug 必须结合源码读取、测试、日志、ast-grep 或 git diff 交叉确认。Code Review 使用 GitNexus 作为 diff impact / review evidence source；candidate-only related-test evidence 必须在 Coverage 中披露，并由 diff、源码、tests、contracts 或 logs 交叉确认。
- Parent workspace 下 GitNexus group/registry evidence 只是一种 read-only query surface；消费规则见 `docs/contracts/workspace-gitnexus-consumption.md`。`group_missing` 不是 provider failure，dirty-advisory 或 legacy dirty refresh blocked 也不等于 query unusable。
- GitNexus capability catalog 是 candidate source input：`checked-in-baseline`、`setup-projection` 和 `provider-pin` 不能替代当前 live MCP tool/resource verification，也不能单独证明 `query_ready=true`。
- GitNexus 不能替代 spec-first workflow 判断、需求/计划范围判断、测试结果或直接源码事实。
- `gitnexus_detect_changes` 是 review / commit 前的 evidence，不是无解释的硬阻断器。发现超出预期影响面时，应说明 affected flows、风险与下一步验证。
- `gitnexus_detect_changes` 和 impact 查询不触发 provider rebuild；需要 current graph evidence 时，先通过 `$spec-graph-bootstrap` 刷新 readiness。

## GitNexus Review Evidence

GitNexus review-impact evidence 的 related-test parity 必须由 source-owned `impact_probe` 证明，不能从 `query_ready=true` 推断。`spec-mcp-setup` projection 为 Git repo target 写入 `gitnexus impact <probe_token> --repo <repo> --include-tests --depth 2`；`spec-graph-bootstrap` 运行该 probe，并只在 raw output 中出现 test provenance 时标记 supported。

Supported 是完整 readiness 状态：

- producer 在 `providers/gitnexus/status.json.review_support` 写 `related_tests_status="supported"` 和 `impact_probe_raw_log`。
- producer 在 `providers/gitnexus/normalized/impact-capabilities.json` 写 `review_support.related_tests="supported"`，不写 `related_tests_unverified`。
- producer 在 `bootstrap-impact-capabilities.capabilities.review_support` 写 `support_level="full"`、`related_tests_status="supported"`，并保持 `graph-facts.capabilities.impact_context=true`、`impact_context_status="supported"`。

当 GitNexus query-ready 但 `impact_probe` 未证明 related-test provenance 时，GitNexus review-impact evidence 必须标记为 candidate-only。candidate-only 是公开 readiness 状态，不是完整 parity：

- producer 在 `providers/gitnexus/normalized/impact-capabilities.json` 写 `review_support.related_tests="candidate-only"` 和 limitation `related_tests_unverified`。
- producer 在 `bootstrap-impact-capabilities.capabilities.review_support` 写 `related_tests_status="candidate-only"`，并保持 `graph-facts.capabilities.impact_context=false`、`impact_context_status="limited"`。
- `$spec-code-review` final Coverage 必须写 `related_tests=candidate-only (provider-unverified)`；finding 仍必须由 diff、源码、tests、contracts 或 logs 支撑，不能只引用 provider candidate。
- Plan/Work/Debug 遇到 candidate-only 时按 bounded direct reads / git diff / tests fallback 处理，不得声称 graph-fresh impact parity，也不得自动扩大 implementation/autofix scope。

## Provider 职责

- GitNexus：仓库级架构事实、execution flows、symbol relationships、自然语言代码查询、change detection、变更集影响面、review context、相关测试候选和 blast-radius pointers。
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
