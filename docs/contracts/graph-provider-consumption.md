# Graph Provider Consumption Contract

## 目标

本文是下游 workflow 消费 graph/provider/impact readiness artifacts 的速查契约。它补充 `docs/contracts/graph-evidence-policy.md`：本文件回答“读哪个 artifact、读哪个字段、哪些旧字段或旧路径不能再读”，证据可信度与冲突处理仍按 graph evidence policy 执行。

核心边界：

- `spec-mcp-setup` 只准备 provider 配置、host/tool readiness 和 setup-owned projection。
- `spec-graph-bootstrap` 产出 canonical graph readiness facts 与 provider diagnostics。
- 下游 workflow 读取 canonical artifacts 做输入判断，LLM 仍决定证据是否与当前任务语义相关。
- live MCP 查询成功只算 `session-local` evidence，不能回写 compiled readiness，也不能把 `query_ready` 改成 true。

## Canonical Artifacts

| Artifact | Producer | 主要用途 | Canonical fields | 不要读取或推断 |
| --- | --- | --- | --- | --- |
| `.spec-first/graph/provider-status.json` | `spec-graph-bootstrap` | 判断 provider 聚合 readiness 与追溯 per-provider status | `schema_version=graph-provider-status.v1`, `workflow_mode`, `ready_primary_providers[]`, `failed_primary_providers[]`, `not_applicable_providers[]`, `skipped_primary_providers[]`, `partial_primary_available`, `providers[].status`, `providers[].graph_ready`, `providers[].query_ready`, `providers[].reason_code`, `providers[].failure_class`, `providers[].recommended_action`, `providers[].confidence`, `providers[].limitations`, `providers[].normalized_artifacts` | 不要用 artifact 是否存在替代 readiness；不要只看 provider 名是否出现；不要把 `status=ready` 与 `query_ready=true` 拆开后单独解释 |
| `.spec-first/graph/graph-facts.json` | `spec-graph-bootstrap` | 给 plan/work/review 等下游提供项目级 graph facts 与 freshness hint | `schema_version=graph-facts.v1`, `workflow_mode`, `provider_summary.ready_primary_providers[]`, `provider_summary.degraded_providers[]`, `provider_summary.not_applicable_providers[]`, `provider_summary.skipped_primary_providers[]`, `provider_summary.partial_primary_available`, `capabilities.query_global_graph`, `capabilities.impact_context`, `source_revision`, `worktree_dirty`, `worktree_status_hash`, `staleness_hints.*`, `canonical_artifacts.provider_status`, `canonical_artifacts.impact_capabilities` | 不要读取顶层 `query_ready`；该字段不属于 `graph-facts.v1`。不要把 `provider_summary.ready_primary_providers[]` 等同于“当前任务一定需要 graph evidence” |
| `.spec-first/impact/bootstrap-impact-capabilities.json` | `spec-graph-bootstrap` | 判断 context selection、impact radius、review support 是否有 primary 或 fallback 支持 | `schema_version=bootstrap-impact-capabilities.v1`, `workflow_mode`, `capabilities.context_selection.support_level`, `capabilities.context_selection.primary_providers[]`, `capabilities.context_selection.fallback_support`, `capabilities.context_selection.confidence`, `capabilities.context_selection.limitations[]`, `capabilities.impact_radius.*`, `capabilities.review_support.*`, `downstream_guidance.canonical_graph_facts`, `downstream_guidance.provider_status`, `downstream_guidance.limitations_required` | 不要读取旧路径 `.spec-first/graph/bootstrap-impact-capabilities.json`；不要把 `review_support.support_level=partial` 写成完整 review 通过 |
| `.spec-first/providers/<provider>/status.json` | `spec-graph-bootstrap` | provider 级诊断、raw log 追溯和 query probe 解释 | `schema_version=provider-status.v1`, `provider`, `status`, `graph_ready`, `query_ready`, `reason_code`, `command_results[]`, `raw_logs`, `repo_snapshot`, `normalized_artifacts`, GitNexus 的 `query_probe_attempts[]` | 不要让下游 workflow 直接耦合 provider 内部 raw log shape；raw log 用于诊断，不是新的 canonical readiness contract |
| `.spec-first/providers/*/normalized/*.json` | provider adapter | provider-specific normalized facts，例如 GitNexus architecture/reuse facts 或 code-review-graph impact capabilities | 通过 `provider-status.json` 中对应 `providers[].normalized_artifacts` 指针进入 | 不要读取旧路径 `.spec-first/graph/architecture-facts.json` 或 `.spec-first/graph/reuse-candidates.json` 作为当前 canonical artifacts |

## Readiness Truth Table

| 情况 | 判定字段 | 下游行为 |
| --- | --- | --- |
| Primary graph 可用 | `provider-status.workflow_mode=primary`，目标 provider 的 `providers[].query_ready=true`，`graph-facts.capabilities.*=true` | 可以优先使用 graph provider evidence；仍要说明 evidence 与当前任务的语义相关性 |
| 部分 provider 可用 | `provider-status.partial_primary_available=true` 且 `failed_primary_providers[]` 或 `provider_summary.degraded_providers[]` 非空 | 可使用 ready provider 的事实；必须披露 degraded provider、`reason_code`、fallback 与 limitations |
| fallback-only | `workflow_mode=degraded-fallback` 或 impact capability `support_level=partial` | 只能作为 degraded/advisory 或 bounded fallback evidence；不能写成 full graph-backed |
| no-source / not-applicable | `workflow_mode=no-source` 或 provider `status=query-not-applicable` | 这不是 provider 故障。跳过 GitNexus process routing，必要时使用 bounded direct repo reads |
| blocked / action-required | `workflow_mode=blocked`、无 `query_ready=true` provider 且 fallback 不足，或 provider `recommended_action` 要求修复 | 不要消费 graph evidence。先执行 setup/bootstrap/repair 或走 direct repo fallback，并明确 action-required |
| stale / dirty-uncertain | `graph-facts.source_revision` 与当前 `HEAD` 不一致，或 `worktree_status_hash` 与当前 dirty hash 不一致 | 降级为 stale/advisory pointer；可补一次 bounded live MCP probe，但不能更新 compiled readiness |

## Consumer Rules

1. 先读 `.spec-first/graph/provider-status.json` 和 `.spec-first/graph/graph-facts.json`，再按 `normalized_artifacts` 指针读取 provider-specific normalized facts。
2. 需要 context、impact 或 review 支持时，读 `.spec-first/impact/bootstrap-impact-capabilities.json` 的 per-capability `support_level`，而不是用 provider 是否 ready 推断所有能力都 full。
3. 比较 freshness 时同时检查 `source_revision`、`worktree_dirty` 和 `worktree_status_hash`；只检查 dirty boolean 不够。
4. `runtime-capabilities.json.project_graph_readiness` 与 `graph-providers.json.derived_readiness` 是 setup-owned projection，只能作为指向 canonical artifacts 的提示；下游 readiness 判断以 canonical graph artifacts 为准。
5. provider raw logs、diagnostics 和 live MCP 输出用于解释或补充本轮判断，不能替代 canonical fields。

## Forbidden Compatibility Reads

下游 active workflow、script 或 contract test 不应新增以下读取：

- `.spec-first/graph/bootstrap-impact-capabilities.json`
- `.spec-first/graph/architecture-facts.json`
- `.spec-first/graph/reuse-candidates.json`
- `.spec-first/graph/graph-facts.json` 顶层 `query_ready`
- `.spec-first/graph/graph-facts.json` 顶层 `ready_primary_providers`
- 单纯用 `.spec-first/providers/<provider>/status.json` 是否存在判断 provider 可用

如果为了读取历史 artifact 做迁移，必须显式标记为 legacy/stale input，并在同一处指向当前 canonical artifact。
