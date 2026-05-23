# Graph Provider Consumption Contract

## 目标

本文是下游 workflow 消费 graph/provider/impact readiness artifacts 的速查契约。它补充 `docs/contracts/graph-evidence-policy.md`：本文件回答“读哪个 artifact、读哪个字段、哪些旧字段或旧路径不能再读”，证据可信度与冲突处理仍按 graph evidence policy 执行。

Parent workspace 下 GitNexus registry / group evidence 的消费边界见 `docs/contracts/workspace-gitnexus-consumption.md`。该 contract 定义 `workspace-gitnexus-readiness.v1`、`git_root_topology` gate、`group.status` 嵌套形态，以及 `refresh_eligibility` / `index_snapshot` / `query_usability` 三层拆分。

核心边界：

- `spec-mcp-setup` 只准备 provider 配置、host/tool readiness 和 setup-owned projection。
- `spec-graph-bootstrap` 产出 canonical graph readiness facts 与 provider diagnostics。
- 下游 workflow 读取 canonical artifacts 做输入判断，LLM 仍决定证据是否与当前任务语义相关。
- live MCP 查询成功只算 `session-local` evidence，不能回写 compiled readiness，也不能把 `query_ready` 改成 true。

## Plan Evidence Envelope Boundary

`$spec-plan` 可以在 `## Graph Readiness` 之后输出 `## Graph / GitNexus Evidence`，但该 block 是任务相关 evidence envelope，不是新的 readiness artifact。它必须保留四个独立 axis：`capability_status=available|partial|unavailable|mutation-gated`、`evidence_grade=primary|session-local|advisory|stale`、`evidence_posture=primary|fallback`、`freshness_state=fresh|stale|dirty-advisory|query-unverified`。

Plan envelope 的输入可以来自：

- canonical `.spec-first/graph/*`、`.spec-first/providers/*` 和 `.spec-first/impact/*` artifacts；
- setup-owned projection pointers，例如 `runtime-capabilities.json.project_graph_readiness`、`graph-providers.json.derived_readiness`、`graph-providers.json.providers.gitnexus.native_capabilities` 或 `runtime-capabilities.json.gitnexus_capability_discovery`，但这些只是 setup-inferred availability / pointer inputs，不是独立 readiness truth；
- parent workspace advisory facts，包括 `workspace-gitnexus-readiness.v1` 的 nested `group.status`、per-child `query_usability` 和 limitations；
- 当前会话 live MCP / CLI evidence，标记为 `session-local`，不回写 compiled readiness。

该 envelope 不得替代 `Graph Readiness.status`、provider `query_ready`、workspace `query_usability` 或 impact capability support level。`definitions-only` 仍是 limitation / query-usability condition，不是新的 `freshness_state`。当 compiled graph facts stale、dirty-advisory、query-unverified 或 unavailable 时，Plan 必须披露 limitations，并用直接源码读取、测试、ast-grep、git diff 或 code-review-graph fallback 验证关键结论。

## Setup-Inferred GitNexus Capability Discovery

`spec-mcp-setup` 可以在 setup-owned projection 中写入 GitNexus 原生能力可发现性：

- `.spec-first/config/graph-providers.json.providers.gitnexus.native_capabilities`
- `.spec-first/config/runtime-capabilities.json.gitnexus_capability_discovery`

这些字段只表达 setup-inferred availability。它们可以帮助 `$spec-plan` 选择候选 `native_tool_or_resource`、设置 Plan envelope 的 `capability_status`、补充 `capabilities_used` 和 limitations，但不得让 consumer 推断 `query_ready=true`、不得改变 `Graph Readiness.status`、不得替代 workspace `query_usability`，也不得成为 GitNexus task-level query 结果。`status=available` 或 `status=mutation-gated` 与 `runtime-capabilities.json.project_graph_readiness.status=not-bootstrapped` 可以同时成立：前者表示 setup-inferred native surface 可发现，后者表示 durable graph evidence 尚未 ready。

Plan consumer 的 status mapping 固定为：setup `available` -> Plan `capability_status=available`；setup `unavailable` -> `unavailable`；setup `mutation-gated` -> `mutation-gated`；setup `unknown` -> `partial`，并且 limitations 中必须包含 `setup-inferred unknown`。Plan 不得从 setup `unknown` 发明 `available`。

`source_provenance=registry-only|configured-not-verified|inherited-prior-run` 在任何 current live-surface claim 前都需要 live MCP probe。`configured-and-detected|observed-this-run` 只帮助选择候选 surface，仍不是 graph-backed evidence 或 query success。`mutation_boundary=policy-blocked` 是 setup/Plan 的硬边界：consumer 不得在当前 workflow 中请求批准后执行该 surface；只能记录 limitation、选择 read-only alternatives，或在用户明确要求维护动作时另起 preview-first maintenance plan。不要新增 TTL、aging window 或 `capability_metadata_freshness` 字段；consumer 继续复用 provider projection / fingerprint freshness。

## Refresh Ownership

| 节点 | 默认行为 | Canonical graph artifact 写入 |
| --- | --- | --- |
| consumer freshness-check | plan/work/debug/review 读取 canonical artifacts，比较 `source_revision`、`worktree_dirty`、`worktree_status_hash`、provider `query_ready` 和 provider projection/fingerprint freshness | no |
| branch switch / pull / rebase / merge 后的下一次 consumer check | 将 `source_revision` mismatch 或 dirty hash mismatch 解释为 stale / dirty-uncertain | no |
| stale + lightweight work | 披露 graph limitations，使用 bounded direct reads、ast-grep、code-review-graph、prior GitNexus evidence 或 session-local live MCP pointer | no |
| stale + graph-heavy work | 明确建议 `$spec-graph-bootstrap`，在刷新前不声称 primary graph-backed impact evidence | no |
| `$spec-graph-bootstrap` | reuse 或 rebuild provider readiness，并写入 graph/provider/impact canonical artifacts | yes |
| fresh graph before review / commit | 可运行 impact / detect changes 作为 review evidence | no rebuild |
| repair-preview | 对 GitNexus storage 或 provider artifact 恢复先 preview / confirm | only after explicit repair/bootstrap |

Graph-heavy 至少包括 shared helper/API/route/provider contract/core workflow/cross-module changes、review-pre-facts changes、高风险 review，以及依赖 execution flows 或 blast radius 的 planning/review。docs-only、窄 typo、小型本地 bug 和首次试用属于 lightweight counterexamples；这些场景不能被 stale graph 升级成硬阻断。

## Canonical Artifacts

| Artifact | Producer | 主要用途 | Canonical fields | 不要读取或推断 |
| --- | --- | --- | --- | --- |
| `.spec-first/graph/provider-status.json` | `spec-graph-bootstrap` | 判断 provider 聚合 readiness 与追溯 per-provider status | `schema_version=graph-provider-status.v1`, `workflow_mode`, `ready_primary_providers[]`, `failed_primary_providers[]`, `not_applicable_providers[]`, `skipped_primary_providers[]`, `partial_primary_available`, `providers[].status`, `providers[].graph_ready`, `providers[].query_ready`, `providers[].readiness_source`, `providers[].refresh_mode`, `providers[].fallback_from_incremental`, `providers[].last_indexed_commit`, `providers[].requires_clean_full_refresh`, `providers[].reason_code`, `providers[].failure_class`, `providers[].recommended_action`, `providers[].confidence`, `providers[].limitations`, `providers[].normalized_artifacts` | 不要用 artifact 是否存在替代 readiness；不要只看 provider 名是否出现；不要把 `status=ready` 与 `query_ready=true` 拆开后单独解释；不要把 `readiness_source=incremental-update` 当成 readiness success |
| `.spec-first/graph/graph-facts.json` | `spec-graph-bootstrap` | 给 plan/work/review 等下游提供项目级 graph facts 与 freshness hint | `schema_version=graph-facts.v1`, `workflow_mode`, `provider_summary.ready_primary_providers[]`, `provider_summary.degraded_providers[]`, `provider_summary.not_applicable_providers[]`, `provider_summary.skipped_primary_providers[]`, `provider_summary.partial_primary_available`, `capabilities.query_global_graph`, `capabilities.impact_context`, `source_revision`, `worktree_dirty`, `worktree_status_hash`, `dirty_classification`, `dirty_paths_breakdown`, `staleness_hints.*`, `canonical_artifacts.provider_status`, `canonical_artifacts.impact_capabilities` | 不要读取顶层 `query_ready`；该字段不属于 `graph-facts.v1`。不要读取顶层 `refresh_mode`、`refresh_modes_by_provider` 或 `refresh_mode_summary`；refresh-mode truth 在 per-provider status。不要把 `provider_summary.ready_primary_providers[]` 等同于“当前任务一定需要 graph evidence”。不要从 preserved canonical artifact 推断本轮 blocked 分类；`graph-affecting-blocked` 只来自本轮 command result |
| `.spec-first/impact/bootstrap-impact-capabilities.json` | `spec-graph-bootstrap` | 判断 context selection、impact radius、review support 是否有 primary 或 fallback 支持 | `schema_version=bootstrap-impact-capabilities.v1`, `workflow_mode`, `capabilities.context_selection.support_level`, `capabilities.context_selection.primary_providers[]`, `capabilities.context_selection.fallback_support`, `capabilities.context_selection.confidence`, `capabilities.context_selection.limitations[]`, `capabilities.impact_radius.*`, `capabilities.review_support.*`, `downstream_guidance.canonical_graph_facts`, `downstream_guidance.provider_status`, `downstream_guidance.limitations_required` | 不要读取旧路径 `.spec-first/graph/bootstrap-impact-capabilities.json`；不要把 `review_support.support_level=partial` 写成完整 review 通过 |
| `.spec-first/providers/<provider>/status.json` | `spec-graph-bootstrap` | provider 级诊断、raw log 追溯和 query probe 解释 | `schema_version=provider-status.v1`, `provider`, `status`, `graph_ready`, `query_ready`, `readiness_source`, `refresh_mode`, `fallback_from_incremental`, `last_indexed_commit`, `requires_clean_full_refresh`, `reason_code`, `command_results[]`, `command_results[].refresh_mode`, `command_results[].attempt_role`, `raw_logs`, `repo_snapshot`, `normalized_artifacts`, GitNexus 的 `query_probe_attempts[]` | 不要让下游 workflow 直接耦合 provider 内部 raw log shape；raw log 用于诊断，不是新的 canonical readiness contract；`last_indexed_commit` 来自 provider status，不来自 aggregate graph-facts |
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
| branch / pull / rebase equivalent stale | branch switch、pull、rebase 或 merge 后的当前 `HEAD` 与 compiled `source_revision` 不一致 | 视为 stale detection event；不自动运行 GitNexus analyze、provider build 或 index rebuild |
| provider projection / fingerprint stale | setup-owned projection stale、provider package identity 不可验证，或 provider fingerprint mismatch | 标记 bootstrap-required；先刷新 setup projection 或进入 `$spec-graph-bootstrap`，普通 consumer 不运行 provider commands |
| stale + graph-heavy | stale graph facts 且当前任务需要 shared contract、cross-module、route/API/provider、review-pre-facts、impact 或 blast radius evidence | 建议 `$spec-graph-bootstrap` 后再声明 primary graph evidence；若继续执行，只能披露 limitations 并使用 fallback evidence |
| fresh graph before review / commit | freshness-check 通过且 provider `query_ready=true` | 可以运行 impact / detect changes 作为 evidence；detect changes 不触发 rebuild |

## Refresh Mode Truth Table

`readiness_source` 的完整值域是 `cold-run`、`skipped`、`preflight-blocked`、`incremental-update`、`incremental-fallback-full`。`refresh_mode` 的完整值域是 `full`、`incremental`、`incremental-fallback-full`、`failed`。

| 情况 | Canonical 字段 | 下游行为 |
| --- | --- | --- |
| 默认或显式 full | provider `readiness_source=cold-run`, `refresh_mode=full` | 这是默认路径。仍用 `status=ready && query_ready=true` 判断可消费 readiness |
| 显式 incremental 成功 | provider `readiness_source=incremental-update`, `refresh_mode=incremental`, `fallback_from_incremental=false` | 只表示本次调用了 provider-native incremental command；不能推断 provider 内部只处理 diff，也不能跳过 `query_ready` 判断 |
| incremental preflight 降级 full | provider `readiness_source=cold-run`, `refresh_mode=full`, `reason_code` 为 `incremental-command-unavailable`、`fingerprint-spec-first-changed`、`fingerprint-projection-changed`、`fingerprint-provider-changed`、`clean-full-refresh-required`、`incremental-base-ref-unset`、`incremental-base-ref-invalid-format`、`incremental-base-status-untrusted`、`incremental-base-ref-missing` 或 `incremental-base-ref-not-ancestor` | 视为 full refresh attempt；把 `reason_code` 当过程审计字段，不把降级写成 provider 故障 |
| incremental 失败后 fallback full 成功 | provider `readiness_source=incremental-fallback-full`, `refresh_mode=incremental-fallback-full`, `fallback_from_incremental=true`, `reason_code=incremental-refresh-failed-fallback-full`, `requires_clean_full_refresh=false` | 可在 ready/query-ready 时消费 readiness，但应披露发生过 fallback；operator 应调查后再继续依赖 incremental |
| incremental 和 fallback full 都失败 | top-level result `reason_code=incremental-and-full-failed`; provider `refresh_mode=failed`, `graph_ready=false`, `query_ready=false`, `requires_clean_full_refresh=true`; prior `last_indexed_commit` carry-forward | 不消费该 provider 的本轮 readiness。上一轮 aggregate canonical freshness artifacts 会在存在时保留；本轮 stdout/report 才表示 degraded/action context |
| dirty worktree refresh request: graph-affecting | GitNexus provider commands 运行，索引当前磁盘文件；command result `workflow_mode=primary`（providers ready 时）或 `degraded`，`overall_status=ready-dirty-advisory`，`dirty_classification=graph-affecting-blocked`，`freshness_state=dirty-advisory`，`source_revision_dirty=true`；canonical artifacts 写入 `freshness_state=dirty-advisory`；legacy `dirty-source-blocked` reason code 不再写出，兼容读取时视同 dirty-uncertain | 可消费本轮 canonical artifacts，但必须标注 `evidence_grade=advisory`；下游必须结合当前源码直读验证关键结论；不把 `dirty-advisory` 结果当作 `fresh` 证据；历史 `dirty-source-blocked` command result 兼容读取为 legacy dirty-uncertain |
| dirty worktree refresh request: setup-owned-only | command result `workflow_mode` 按 provider readiness 正常计算，`reason_code=null`, `dirty_classification=setup-owned-only`; provider commands 正常运行；`graph-facts.v1` 写入 `worktree_dirty=true`、`worktree_status_hash`、`dirty_classification=setup-owned-only` 和 `dirty_paths_breakdown` | 可消费本轮 canonical artifacts，但下游仍必须把 `worktree_status_hash` 纳入 freshness 比较；setup-owned dirty 不等于 clean，只表示 dirty 路径未命中 graph-affecting 输入 |
| dirty worktree refresh request: non-graph metadata only | command result `workflow_mode` 按 provider readiness 正常计算，`reason_code=null`, `dirty_classification=non-graph-only`; provider commands 正常运行；`graph-facts.v1` 写入 `dirty_paths_breakdown.non_graph_metadata_count` | 仅适用于窄名单变更日志元数据；下游仍必须按 `worktree_status_hash` 比较 freshness，且不得把该分类推广为 docs 全量豁免 |
| 显式或隐式 all-repos incremental | command result `reason_code=incremental-all-repos-unsupported`, `canonical_artifacts_preserved=true`; provider commands 不运行。覆盖显式 `--all-repos --incremental`，也覆盖父级 workspace 默认 all-repos 路径下只传 `--incremental` | 多仓 incremental 未验证；运行 all-repos full 或对单个 clean child repo 显式运行 incremental |

`last_indexed_commit` 是 per-provider status 的 clean readiness carry-forward 字段。只有 prior provider status 同时是 `provider-status.v1`、`graph_ready=true`、`query_ready=true`、clean，且 `repo_snapshot.source_revision` 与 `bootstrap_fingerprint.repo_snapshot.source_revision` 都等于该 commit 时，incremental preflight 才能把它当作 base。`graph-facts.v1.source_revision` 不是 incremental base truth source。

同一字段也是 `workspace-gitnexus-readiness.v1` 中 prior query-ready proof 的唯一可观测代理。GitNexus-aware workspace consumer 只能在 `provider-status.v1.last_indexed_commit != null`，或当前 session live query proof 通过时，把 dirty/stale child repo 的既有 index promote 为 `stale-advisory`。当上一轮 provider failure、provider upgrade、`requires_clean_full_refresh=true` reset、手动 clean 或其他原因导致当前 provider status 中 `last_indexed_commit=null` 时，consumer 必须按 `last_indexed_commit=null` 处理，降级为 `registry-present-query-unverified` / `definitions-pointer`，不得维护额外历史断言持久层。

Tracked docs、README、用户手册、issue 或 PR 描述不得粘贴 provider raw stdout/stderr、完整 raw log、credentialed URL、token/API key、`Authorization:`、`Cookie:`、私有 registry URL、内网主机名或用户名绝对路径片段。问题上报只应包含 provider、`reason_code`、`fallback_from_incremental` 是否出现、发生频率、人工脱敏摘录和本地 artifact path。

## setup-owned-dirty-ignore.v1

`setup-owned-dirty-ignore.v1` 是 `spec-graph-bootstrap` dirty gate 的 source-of-truth。脚本必须消费 `git status --porcelain=v2 -z` 输出，按记录字段提取路径并做 path prefix 匹配；rename 记录必须同时检查 old path 与 new path，任一 side 未命中 setup-owned 规则即归类为 graph-affecting。

| Path prefix | 归属 | 规则 |
| --- | --- | --- |
| `.spec-first/` | spec-first readiness/runtime artifacts | 整个前缀归 setup-owned |
| `.gitnexus/` | GitNexus provider storage | 整个前缀归 setup-owned |
| `.code-review-graph/` | code-review-graph provider storage | 整个前缀归 setup-owned |
| `AGENTS.md` | checked-in host entry source | 仅 spec-first managed blocks 内 diff 可豁免；managed block 外一律 graph-affecting |
| `CLAUDE.md` | checked-in host entry source | 仅 spec-first managed blocks 内 diff 可豁免；managed block 外一律 graph-affecting |
| `.gitignore` | spec-first init 管理忽略规则 | 仅 `# spec-first:start` / `# spec-first:end` managed block 内 diff 可豁免；managed block 外一律 graph-affecting |
| `.codex/spec-first/` | Codex host runtime projection | 整个前缀归 setup-owned |
| `.claude/spec-first/` | Claude host runtime projection | 整个前缀归 setup-owned |
| `.agents/skills/` | generated skill runtime mirror | 整个前缀归 setup-owned |

Managed block 二级判断必须 fail-closed：

- `AGENTS.md` / `CLAUDE.md` 使用 `<!-- spec-first:<name>:start -->` / `<!-- spec-first:<name>:end -->` marker；`.gitignore` 使用 `# spec-first:start` / `# spec-first:end` marker。
- tracked 文件通过 `git diff --unified=0 HEAD -- <path>` 同时覆盖 staged 与 unstaged 变更；只有所有 `+` / `-` 行都落在成对完整的 managed block 内，或是 marker 外 blank-only 分隔行，才归 setup-owned。
- untracked managed file 读取当前文件全文；marker 外仅允许 blank-only 分隔行；marker 缺失、不成对、只新增或只删除单个 marker，都归 graph-affecting。
- 整块 marker creation 或 deletion 在 marker 成对完整且无外部变更时可归 setup-owned。
- 同一 marker pair 重复出现（start 或 end 出现 2 次及以上）视为 duplicate/forged marker，必须归 graph-affecting。

此列表只服务 dirty gate。它不得复用到 `external_actor_fingerprint` / `Get-ExternalActorFingerprint` 的 concurrent-write detection；后者继续使用更窄的 bootstrap-owned 路径过滤，避免 critical write window 内的外部写入被静默放过。此列表不接受用户或项目级自定义；扩展条目必须修改本契约、Bash/PowerShell 常量和合同测试。

## non-graph-metadata-dirty-ignore.v1

`non-graph-metadata-dirty-ignore.v1` 是 graph readiness dirty gate 的窄元数据豁免列表。它只表示这些文件本身不改变 provider 可索引代码图谱；它们不是 setup-owned runtime 产物，也不是 docs 全量豁免入口。

| Path | 归属 | 规则 |
| --- | --- | --- |
| `CHANGELOG.md` | repo-level changelog metadata | 整个文件归 non-graph-metadata |
| `docs/变更日志.md` | localized changelog metadata | 整个文件归 non-graph-metadata |

不得把该列表扩展为 `docs/**`、README、架构文档、ADR、接口契约、计划、任务包、用户手册或业务说明。这些文档可能是 standards、plan、review 或人工判断输入，dirty 时仍归为 graph-affecting，并按当前 `dirty-advisory` / warn-and-continue 语义降级处理，除非另有独立计划修改本契约。

Dirty classification 值域：

- `clean`：当前 worktree 无 dirty。
- `setup-owned-only`：dirty 全部命中上表 setup-owned 规则；provider commands 可继续运行，成功刷新后 canonical `graph-facts.v1` 写入该值。
- `non-graph-only`：dirty 至少包含一个 non-graph-metadata path，且不包含 graph-affecting path；provider commands 可继续运行，成功刷新后 canonical `graph-facts.v1` 写入该值，并在 `dirty_paths_breakdown.non_graph_metadata_count` 中保留数量。
- `graph-affecting-blocked`：dirty 至少包含一个 graph-affecting path；GitNexus provider commands 继续运行（warn-and-continue），canonical `graph-facts.v1` 写入该值，同时写入 `freshness_state=dirty-advisory` 和 `source_revision_dirty=true`；`overall_status=ready-dirty-advisory`。

Legacy compatibility：`dirty-refresh-non-canonical` 仅代表旧版本把所有 dirty 一律阻断的历史 command result。新逻辑不得再写出该 reason code。`dirty-source-blocked` 是旧版 fail-closed 的 reason code，新逻辑不再写出；consumer 读取历史 command result 时应把它视同 dirty-uncertain。

## freshness_state 字段（additive，graph-facts.v1）

`freshness_state` 是 `graph-facts.v1` 的 additive 字段，consumer 缺失时回退到 `worktree_dirty` 判断：

- `fresh`：clean worktree，source_revision 精确对齐 HEAD
- `dirty-advisory`：`dirty_classification=graph-affecting-blocked`，index 基于当前未提交磁盘状态，source_revision 不精确对齐 HEAD；下游必须标注 `evidence_grade=advisory`

## Consumer Rules

1. 先读 `.spec-first/graph/provider-status.json` 和 `.spec-first/graph/graph-facts.json`，再按 `normalized_artifacts` 指针读取 provider-specific normalized facts。
2. 需要 context、impact 或 review 支持时，读 `.spec-first/impact/bootstrap-impact-capabilities.json` 的 per-capability `support_level`，而不是用 provider 是否 ready 推断所有能力都 full。
3. 比较 freshness 时同时检查 `source_revision`、`worktree_dirty` 和 `worktree_status_hash`；只检查 dirty boolean 不够。
4. 新写或本轮更新的 consumer 在比较 dirty freshness 前先读 `graph-facts.v1.freshness_state`（additive 字段，缺失时回退到 `worktree_dirty` + `dirty_classification`）：`fresh` 表示 clean；`dirty-advisory` 表示 index 基于未提交磁盘状态，必须标注 `evidence_grade=advisory`。缺失 `dirty_classification` 的旧 `graph-facts.v1` 必须回退到既有 `worktree_dirty` + `worktree_status_hash` dirty-aware 判断，并把 dirty 情况标为 legacy/dirty-uncertain，不得从字段缺失推断 clean。
5. `runtime-capabilities.json.project_graph_readiness` 与 `graph-providers.json.derived_readiness` 是 setup-owned projection，只能作为指向 canonical artifacts 的提示；下游 readiness 判断以 canonical graph artifacts 为准。
6. provider raw logs、diagnostics 和 live MCP 输出用于解释或补充本轮判断，不能替代 canonical fields。
7. live MCP 成功是 session-local corroboration，不能把 `.spec-first/graph/graph-facts.json`、`.spec-first/graph/provider-status.json` 或 setup projection 中的 `query_ready` 改写为 true。
8. consumer 可以推荐 `$spec-graph-bootstrap`，但不得在 plan/work/debug/review 内部静默运行 GitNexus analyze、provider build、index rebuild、repair 或 default hook/watch/daemon 路径。
9. 需要 refresh-mode 细节时读取 per-provider status 或 aggregate `provider-status.json.providers[]` 镜像；不要从 `graph-facts.v1` 推断 refresh mode。
10. `readiness_source` 是命令来源事实，不是 readiness success；消费 readiness 仍必须检查 `status=ready && query_ready=true`。
11. Parent workspace GitNexus-aware consumer 读取 `workspace-graph-targets.v1.repos[].status` 只能作为向后兼容；新逻辑必须优先读取 `refresh_eligibility`、`index_snapshot` 和 `query_usability`，并遵守 `docs/contracts/workspace-gitnexus-consumption.md` 的 topology gate。

## Forbidden Compatibility Reads

下游 active workflow、script 或 contract test 不应新增以下读取：

- `.spec-first/graph/bootstrap-impact-capabilities.json`
- `.spec-first/graph/architecture-facts.json`
- `.spec-first/graph/reuse-candidates.json`
- `.spec-first/graph/graph-facts.json` 顶层 `query_ready`
- `.spec-first/graph/graph-facts.json` 顶层 `ready_primary_providers`
- `.spec-first/graph/graph-facts.json` 顶层 `refresh_mode`
- `.spec-first/graph/graph-facts.json` 顶层 `refresh_modes_by_provider`
- `.spec-first/graph/graph-facts.json` 顶层 `refresh_mode_summary`
- 单纯用 `.spec-first/providers/<provider>/status.json` 是否存在判断 provider 可用

如果为了读取历史 artifact 做迁移，必须显式标记为 legacy/stale input，并在同一处指向当前 canonical artifact。
