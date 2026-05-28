# Workspace GitNexus Consumption Contract

## 目标

本文定义 parent workspace 下 GitNexus registry / group evidence 的消费边界。它补充 `docs/contracts/ai-coding-harness.md`、`docs/contracts/graph-provider-consumption.md` 和 `docs/contracts/graph-evidence-policy.md`：child repo 继续拥有 canonical graph artifacts，parent workspace 只保存 `.spec-first/workspace/*` advisory facts；脚本准备确定性事实，LLM 决定语义 repo 相关性与证据是否足够。

## Topology Gate

所有 GitNexus workspace/group 行为必须先经过 `git_root_topology` gate。

`git_root_topology` 是 artifact 层唯一 topology 字段，由脚本按 Git root 数量确定。非空值只能是：

- `single-repo`：当前调用解析到一个 Git root。单仓单项目和单仓多模块都落在这个值下。
- `multi-repo-workspace`：当前调用位于非 Git parent workspace，且发现多个独立 child Git roots。

Blocked target-resolution 状态必须输出 `git_root_topology: null`，或不写 `workspace-gitnexus-readiness.v1` artifact，并附 reason code。典型 blocked 状态包括 `workspace-no-git-candidates` 和 `workspace-single-candidate`；单个 child repo 不会被 parent resolver 自动提升为 `single-repo`，用户必须显式选择 `--repo <child>`。

三种开发模式 `single-repo-single-project`、`single-repo-multi-module`、`multi-repo-workspace` 只属于 prose / SKILL.md / 用户文档层概念，不是 artifact 字段，不是 classifier 输入，也不是 classifier 输出。monorepo packages/modules 不是 GitNexus group members；它们仍使用 repo-local GitNexus selector。

只有 `git_root_topology="multi-repo-workspace"` 允许 workspace group / registry fan-out。`git_root_topology="single-repo"` 只能使用 repo-local GitNexus evidence。

## Explicit Non-Git Folder Targets

`--folder <path>` / `-Folder <path>` 是显式 target，不是 topology classifier 的自动 fallback。它用于用户明确要求索引某个非 Git 目录的场景；该目录必须在 workspace 内、必须存在，且不能位于 Git repo 内。`--repo` 与 `--folder` 互斥。

当 resolver 收到显式 folder target 时，`workspace-graph-targets.v1` 只描述这个 folder target，不做 child repo fan-out，也不评价 GitNexus group readiness。该 target row 使用：

- `target_kind="non-git-folder"`。
- `folder_root` / `workspace_relative_path` 指向显式目录；`git.current_revision=null`。
- `folder_snapshot.content_fingerprint` 表示当前 folder 内容指纹，`folder_snapshot.indexed_content_fingerprint` 表示 canonical graph facts 中记录的指纹。
- `staleness_hints.content_fingerprint` 与 `staleness_hints.content_fingerprint_matches` 是 freshness 比对入口。
- `non_git_support={query_context_architecture:true, git_diff_review_impact:false, commit_freshness:false, incremental:false}`。

Consumer 可以把 matching content fingerprint 的 non-git target 归入 read-only orientation evidence，但不得把它解释为 child repo、group member、commit-ready index、review-impact provider 或 incremental refresh candidate。fingerprint mismatch 时按 stale/advisory 处理，并用 folder 当前源码读取验证结论。

## Advisory Artifact

`workspace-gitnexus-readiness.v1` 是 script-owned workspace advisory facts，不是 child repo canonical graph truth。它只能写在 `.spec-first/workspace/gitnexus-readiness.json`，不得写入 parent `.spec-first/graph/*`、`.spec-first/providers/*` 或 `.spec-first/impact/*`。

Canonical shape pinning：

- `group` 是嵌套对象，不是顶层 snake_case 字段。
- 固定形状为 `group: { name: string|null, status: "group-ready"|"group-missing"|"group-sync-required"|"unavailable"|"not-evaluated-no-mcp-input", query_selector: string|null }`。
- `group` 对象不得携带 `reason_code` 等额外字段；诊断原因必须放在顶层 `group_reason_code: string|null`。
- 下游 consumer 必须读取 `group.status`，禁止写顶层 `group_status`。
- durable script-mode artifact 的 `query_usability_counts` 只能包含四个 key：`fresh-primary`、`stale-advisory`、`definitions-pointer`、`unavailable`。`registry-present-query-unverified` 与 `registry-fanout-advisory` 只属于 session-local live overlay / skill prose 输出，不得写入 durable artifact counts。
- JSON 字段名使用 snake_case，枚举值使用 kebab-case，嵌套路径使用点号，例如 `group.status`。

## Three Independent Axes

GitNexus-aware consumer 必须区分三类事实，不得用单一 `ready/action-required` 状态承载全部含义。

| Axis | Owner | Example values | Meaning |
| --- | --- | --- | --- |
| `refresh_eligibility` | child repo bootstrap facts | `eligible`, `eligible-after-refresh`, `blocked-dirty-source`, `setup-required` | 当前 child 是否可以安全执行 provider refresh |
| `index_snapshot` | child canonical artifact + current git snapshot | `current-clean`, `current-with-dirty-overlay`, `stale-commit`, `missing` | 已有 index 覆盖哪个 Git snapshot |
| `query_usability` | child facts + GitNexus registry/group snapshot | `fresh-primary`, `stale-advisory`, `registry-present-query-unverified`, `registry-fanout-advisory`, `definitions-pointer`, `unavailable` | 当前只读查询可用性和限制 |

`dirty-source-blocked` 是 legacy refresh result，不是 query result；当前 graph-affecting dirty refresh 以 `dirty-advisory` / warn-and-continue 写入降级证据。dirty / stale child repo 的既有 GitNexus index 可以作为 read-only `stale-advisory` evidence，但下游必须披露 limitations，并用源码读取或测试验证最终结论。

## Prior Query-Ready Promotion Gate

`provider-status.v1.last_indexed_commit != null` 是 `workspace-gitnexus-readiness.v1` 中 prior query-ready proof 的唯一可观测代理。该字段的信任条件以 graph-provider consumption contract 为准，包括 `repo_snapshot.source_revision` 与 `bootstrap_fingerprint.repo_snapshot.source_revision` 的 source revision 一致性要求；它只在 prior provider status 同时满足 `graph_ready=true && query_ready=true && clean` 后 carry-forward。

Classifier 只能在以下条件之一满足时把 dirty/stale repo promote 到 `stale-advisory`：

- 当前 child provider status 的 `last_indexed_commit` 非空。
- 当前 session live query proof 通过；该 proof 是 session-local overlay，不写入 durable artifact。

仅有 GitNexus registry entry，但 `last_indexed_commit=null` 且本轮 `query_ready=false` 的 child 最高只能归为 `registry-present-query-unverified` 或 `definitions-pointer`，不得归为 `stale-advisory` 或 `fresh-primary`。当 provider failure、provider upgrade、`requires_clean_full_refresh=true` reset 或手动 clean 导致 `last_indexed_commit` 在当前 status 中断裂为 null 时，classifier 不读取历史 status 恢复旧断言。

## Registry And Group Evidence

GitNexus registry/group 是多仓 query model，不是 refresh gate。

- `group.status="group-ready"`：优先使用 `repo="@<groupName>"` 做 read-only orientation；仍需根据 per-child `query_usability` 披露 stale/dirty limitations。
- `group.status="group-missing"`：不是 provider failure；使用 bounded registry/per-repo fan-out，并可建议后续显式配置 group。
- `group.status="group-sync-required"`：不得由 downstream workflow 静默运行 `group_sync`；当前只读消费降级到 bounded registry/per-repo fan-out，并把 group 同步作为 preview-first next action。
- `group.status="unavailable"`：group snapshot 不可信或不可解析；如果 registry snapshot 可用且有 repo match，使用 bounded registry/per-repo fan-out，否则降级为 direct-read fallback，并披露 `group_reason_code`。
- `group.status="not-evaluated-no-mcp-input"`：script mode 未评价 live MCP overlay；downstream workflow 要么在当前 session 做 fresh live probe，要么披露 group/registry overlay 未评价。

`group_sync` 或等价 provider mutation 必须 explicit、preview-first，并由 setup/bootstrap-owned 路径执行。plan/work/debug/review 不得静默运行 `group_sync`、GitNexus analyze、provider repair、hooks、watchers 或 daemon。

Read-only group resources are first-class evidence surfaces, not mutation approval. `gitnexus://group/{name}/contracts` and `gitnexus://group/{name}/status` may be reported with `live-mcp-resource` / `session-local-inference` provenance when current-session resource discovery or reads actually occurred. Checked-in baseline or setup projection can list those resources as candidates, but cannot claim current group readiness or replace `workspace-gitnexus-readiness.v1` / per-child source reads.

## Workspace / Resource Session Evidence

当 workflow 明确需要 multi-repo 或 group orientation 时，workspace/resource lane evidence 可以使用 `gitnexus-session-evidence.v1`。有效 surface 包括：

- `gitnexus://repos`
- `gitnexus://repo/{name}/context`
- `gitnexus://repo/{name}/schema`
- `gitnexus://repo/{name}/processes`
- `gitnexus://repo/{name}/process/{processName}`
- `gitnexus://group/{name}/contracts`
- `gitnexus://group/{name}/status`
- group-aware `query/context/impact` with `repo="@<groupName>"` or a scoped group member selector

规则：

1. Group-aware calls 需要 explicit `target_repo`、per-unit repo scope、per-task repo scope，或 read-only orientation question。它们不能自行选择写入 repo。
2. Group/resource evidence 必须在 session evidence envelope 中携带 `repo_scope` 和 `task_domain`。
3. Stale、dirty、registry-only、`group-missing` 或 `not-evaluated-no-mcp-input` evidence 仍是 advisory，必须列出 limitations。
4. Cross-repo API / contract、route、consumer 或 process claim 变成 plan scope、finding、work closeout fact 或 knowledge entry 前，必须先完成 source confirmation。
5. `group_sync`、provider refresh/repair/analyze、hooks、watchers、daemons 和 GitNexus mutation tools 仍在普通 plan/work/debug/review automation 之外。

## Consumer Rules

1. parent workspace 只读问题可以先读 `workspace-graph-targets.v1`，再在 `git_root_topology="multi-repo-workspace"` 时合并 GitNexus registry/group evidence。
2. 写入、测试、autofix、changelog 或 commit 前仍必须有 `target_repo` 或 per-unit repo scope；workspace readiness 不能替 LLM 或用户选择写入仓库。
3. `group_missing` 不会让 per-repo registry evidence 失效；它只表示 group-mode selector 不可用。
4. dirty/stale GitNexus evidence 必须标记为 stale/advisory，并直接读取 dirty/stale 文件验证结论。
5. `workspace-graph-targets.v1.repos[].status` 保留为向后兼容字段；新 GitNexus-aware consumer 必须优先读取 `refresh_eligibility`、`index_snapshot` 和 `query_usability`。
6. Gradle/npm build-target coverage facts（`non_git_build_modules[]`、`coverage_summary`、`graph_coverage_class`）是 advisory 覆盖率输入，只暴露 Git root 与 build module / workspace package 的错位供 LLM 判断；它们不授权索引非 Git module 目录，也不扩展 implementation scope。

## `$spec-plan` Evidence Posture Requirements

Multi-repo workspace plan 输出中的 `## Graph / GitNexus Evidence` 必须说明 registry evidence、group evidence、per-repo `query_usability`、dirty/stale limitations，以及写入前 `target_repo` / per-child scope 要求。`group.status="group-missing"` 或 `group.status="not-evaluated-no-mcp-input"` 只能降级为 bounded registry/per-repo fallback 或 session-local probe limitation，不能变成 provider failure。

GitNexus 发现的额外 repo、symbol、route 或 flow 只能作为 risk / follow-up / test-candidate evidence；implementation scope 仍由用户请求、origin requirements、plan/task pack、当前 git diff 和显式 `target_repo` / per-unit repo scope 决定。`workspace_group_sync`、`group_sync`、`symbol_rename`、GitNexus `rename` 或等价 mutation-capable capability 必须标记为 `mutation-gated` / `requires explicit user action`，不得在 plan/work/debug/review 中成为自动 implementation unit。

用户手动调用上述 mutation-capable capability 时的最低安全闭环（preview / execute / verify / recover）见 `docs/contracts/gitnexus-capability-catalog.md` 的 `## Manual Execution Guidance`；该指引仅面向用户手动操作，不构成任何 spec-first workflow 的自动执行依据。
