---
date: 2026-05-22
topic: gitnexus-downstream-workflows-deep-integration
spec_id: 2026-05-22-003-gitnexus-downstream-workflows-deep-integration
source_requirement: docs/brainstorms/2026-05-22-001-gitnexus-first-class-capability-plugin-requirements.md
status: guidance
---

# GitNexus Downstream Workflows 深度接入文档

## Summary

本文档是 `GitNexus First-Class Capability Plugin` 需求中 R19 的 companion guidance：第一阶段仍只要求 `$spec-plan` 深度接入 GitNexus capability；`$spec-work`、`$spec-code-review`、`$spec-debug` 后续逐步接入同一能力协议。本文只定义后续接入的目标、输入、边界、输出和推荐顺序，不把这些 downstream workflow 改造升级为 v1 硬验收条件。

核心判断：GitNexus 是代码智能增强插件，不是 scope authority、provider refresh orchestrator 或源码/测试/review 的替代品。下游 workflow 只能把 GitNexus evidence 用于缩小读码范围、发现影响面、提高验证质量和披露风险。

---

## Goals

- 让 `$spec-work` 能消费 `$spec-plan` 输出的 `Graph / GitNexus Evidence`，把图谱证据转化为更聚焦的实现读码、验证和 review handoff。
- 让 `$spec-code-review` 能在 diff review 中使用 GitNexus 原生能力补足影响面、API consumer、shape drift、execution flow 和跨仓风险证据。
- 让 `$spec-debug` 能用 GitNexus 辅助定位执行流、调用链和 blast radius，但仍以 reproduction、source reads、logs 和 tests 证明 root cause。
- 保持统一 evidence envelope：`capability_status`、`evidence_grade`、`freshness_state`、`source_contract_fields`、`limitations`。
- 保持 Multi Repo Workspace 边界：只读查询可用 registry/group evidence orientation；写入、测试、autofix、changelog、commit 前必须有明确 `target_repo` 或 per-child scope。

## Non-Goals

- 不要求 v1 同时改造 `$spec-work`、`$spec-code-review`、`$spec-debug`。
- 不让 downstream workflow 自动运行 `gitnexus analyze`、provider build、provider repair、index rebuild、`group_sync` 或其他 durable provider state mutation。
- 不让 GitNexus evidence 自动扩大 plan/task/debug/review scope。
- 不把 `Graph Readiness` 改造成影响分析字段；readiness 是事实入口，workflow evidence 是任务级消费结果。
- 不恢复任何 retired symbol-indexing MCP 或相关 fallback 语义。

---

## Shared Capability Contract

### 输入来源

Downstream workflows 后续接入时，按优先级消费这些输入：

| 输入 | 用途 | Authority |
|---|---|---|
| 用户当前请求、plan、task pack、debug symptom、review diff | 定义 WHAT、scope、目标仓库和验收意图 | scope authority |
| `$spec-plan` 的 `Graph Readiness` | durable readiness、freshness、query readiness、artifact provenance | fact source |
| `$spec-plan` 的 `Graph / GitNexus Evidence` | 本任务已使用的 native capability、关键发现、限制、source reads required | advisory evidence |
| `.spec-first/graph/*`、`.spec-first/providers/*`、`.spec-first/workspace/*` | provider status、workspace advisory facts、per-repo freshness | fact source |
| setup capability projection | 当前 host/runtime 暴露的 GitNexus capability metadata | fact source |
| session-local GitNexus MCP tools/resources | 本轮 workflow 可验证的 live code-intelligence evidence | session-local evidence |
| direct source reads、tests、logs、git diff、ast-grep、code-review-graph | GitNexus 不可用或需要验证时的 fallback / confirmed evidence | confirmed when directly verified |

### Evidence Envelope

下游 workflow 不应发明新的 readiness truth。它们只在本轮输出中携带任务级 evidence posture：

| 字段 | 含义 | 不允许 |
|---|---|---|
| `capability_status` | 当前 capability 是否可用于本轮 workflow：`available`、`partial`、`unavailable`、`mutation-gated` | 不替代 provider readiness 或 workspace query usability |
| `evidence_grade` | 证据等级：`primary`、`session-local`、`advisory`、`fallback` | 不把 advisory graph evidence 伪装成 confirmed source truth |
| `freshness_state` | index 新鲜度：`fresh`、`stale`、`dirty-advisory`、`query-unverified` | 不写回 `.spec-first/graph/*`、`.spec-first/providers/*`、`.spec-first/workspace/*` |
| `source_contract_fields` | 字段从哪些 existing contracts / artifacts / live resources 派生 | 不引用不存在字段，不固化 session-local snapshot |
| `limitations` | provider unavailable、definitions-only、stale、dirty、group-missing 等限制 | 不静默省略限制 |

### 能力边界

- Read-only GitNexus tools/resources 可以用于 orientation、deep dive、impact evidence 和验证路径选择。
- mutation-capable capability（`workspace_group_sync`、`symbol_rename`）默认 `mutation-gated`，需要显式用户授权、preview-first、明确 `target_repo` / group scope 后才可能进入专门 work/maintenance 路径。
- `group-missing`、`group-sync-required`、`not-evaluated-no-mcp-input` 是 Multi Repo Workspace 的降级状态，不是 GitNexus 整体失败。
- `dirty-source-blocked` 只说明 durable refresh 受限，不等于已有 GitNexus query evidence 完全不可用；下游必须标注 `dirty-advisory` 并用当前源码验证关键点。

---

## `$spec-work` 深度接入

### 接入目标

`$spec-work` 接入 GitNexus 的目标不是重新计划，而是在执行已定 scope 时提高 implementation focus：

- 把 plan/task pack 中的 GitNexus evidence 转化为候选文件、符号、执行流、测试点和风险提示。
- 在编辑前验证 plan 的 file focus 是否与当前源码、query evidence 和 `target_repo` 一致。
- 在实现后把 session-local graph evidence、direct source validation 和测试结果带给 `$spec-code-review`。

### 允许使用的 GitNexus 能力

| 场景 | 首选 capability | 用法 |
|---|---|---|
| 找实现入口、复用模式、邻近流程 | `query`、`context`、repo resources | 缩小读码范围，不替代源码读取 |
| 公共符号、shared helper、core workflow 变更 | `impact` | 找 risk hotspots 和 test candidates |
| route/API 相关实现 | `api_impact`、`route_map`、`shape_check` | 找 handler、consumer、shape drift 风险 |
| MCP/RPC tool 实现 | `tool_map`、`context` | 找 tool handler 和调用链 |
| 多仓工作区 orientation | `list_repos`、`group_list`、group resources、`query(repo="@group")` | 只读候选发现，写入前仍需 `target_repo` |

### 禁止边界

- 不得因为 GitNexus 发现额外 impacted files/repos 而自动扩大当前 implementation unit。
- 不得运行 provider refresh、`group_sync`、analyze/build/repair、index rebuild、default hooks、watchers 或 daemons。
- 不得把 definitions-only 结果当作行为事实；只能作为 file/symbol pointer。
- 不得在 parent workspace 中仅凭 cwd、registry 或 group evidence 写入某个 child repo。

### 输出要求

`$spec-work` 后续接入后，completion / review handoff 应包含：

- `target_repo` 或 per-unit repo scope。
- GitNexus capabilities used：tool/resource 名称、repo scope、evidence grade、freshness state。
- 哪些 graph findings 被源码读取验证，哪些仅作为 advisory follow-up。
- scope 未扩大的说明：额外影响面进入 risk / follow-up / plan update，不进入静默实现。
- test candidates 如何由 GitNexus evidence 影响，以及实际运行了哪些验证。

---

## `$spec-code-review` 深度接入

### 接入目标

`$spec-code-review` 接入 GitNexus 的目标是增强 diff review 的证据质量，而不是让 provider 决定 finding：

- 对 diff 做 impacted execution flows、callers/consumers、API shape 和 multi-repo risk orientation。
- 把 stale/degraded/provider failure 记录在 Coverage，而不是让 review 失败。
- 让 findings 仍以 diff、source reads、tests 和 reviewer judgment 为主证据。

### 允许使用的 GitNexus 能力

| Review 场景 | 首选 capability | 输出方式 |
|---|---|---|
| 当前 diff 影响哪些执行流 | `detect_changes`、`impact` | Coverage + finding evidence pointer |
| route handler / public API diff | `api_impact`、`route_map` | consumer impact、missing tests、contract drift risk |
| response shape / consumer access | `shape_check` | P1/P2 finding 的 supporting evidence，需源码确认 |
| shared symbol / helper 改动 | `context`、`impact` | caller/callee 风险提示 |
| MCP/RPC tool diff | `tool_map`、`context` | handler/description/consumer mismatch |
| 多仓 review | per-child readiness + optional group resources | 按 child repo 分组 evidence，不合并 repo-local truth |

### 禁止边界

- 不得把 GitNexus startup/call failure 视为 reviewer failure；只能降级 graph evidence。
- 不得让各 persona 重复探测同一个不可用 provider；一次记录在 Coverage 即可。
- 不得运行 GitNexus analyze、code-review-graph build、provider repair、index rebuild 或 group sync。
- 不得仅凭 graph evidence 提 finding；finding 必须能落到 diff/source/test/contract 证据。
- Autofix 不得编辑 diff scope 或 `target_repo` 之外的 child repo。

### 输出要求

`$spec-code-review` 后续接入后，Coverage 至少说明：

- graph evidence posture：fresh/session-local/advisory/fallback。
- 使用了哪些 GitNexus native tools/resources，以及失败或未用原因。
- multi-repo review 如何按 child repo 分组。
- graph limitations 对 finding confidence 和 residual risk 的影响。
- provider degraded 时 review 仍覆盖了哪些 fallback reads/tests。

---

## `$spec-debug` 深度接入

### 接入目标

`$spec-debug` 接入 GitNexus 的目标是改善 causal trace 和 hypothesis quality：

- 用 execution-flow / context / impact evidence 辅助从 symptom 追到 root cause。
- 用 route/API/shape/tool capabilities 定位跨 handler、consumer、schema 或 tool contract 的 bug。
- 用 blast radius evidence 选择验证范围，但不把 graph output 当作 root cause proof。

### 允许使用的 GitNexus 能力

| Debug 场景 | 首选 capability | 用法 |
|---|---|---|
| 错误栈或日志定位到符号 | `context`、`impact` | 找 caller/callee、上游入口和影响面 |
| 行为链路不清楚 | `query`、process resources、`cypher` | 找 execution flow 候选，再源码追踪 |
| API 返回异常或 consumer 崩溃 | `route_map`、`api_impact`、`shape_check` | 验证 handler/consumer/shape causal chain |
| MCP/RPC tool 行为异常 | `tool_map`、`context` | 找 tool handler、description 和调用者 |
| 多仓症状 | registry/group evidence + per-repo query | 找候选 repo；修复前明确 `target_repo` |

### 禁止边界

- 不得在没有 reproduction、source reads、logs 或 tests 支持时宣称 graph-backed root cause。
- stale graph + graph-heavy debugging 时，只能把 GitNexus 作为 advisory；若要声明 graph-backed root cause，应建议先运行 `$spec-graph-bootstrap`。
- 不得运行 provider refresh、group sync、analyze/build/repair 或 index rebuild。
- 不得为了“试试”同时改多个候选点；仍遵守 one change at a time。
- 写入前必须有明确 `target_repo` 或 per-fix repo scope。

### 输出要求

`$spec-debug` 后续接入后，root-cause / handoff 应包含：

- symptom → entry point → causal chain → invalid state origin。
- GitNexus evidence 在 hypothesis ledger 中支持了哪个 link。
- 哪些 graph claims 被 reproduction、source reads、logs 或 tests 验证。
- stale/degraded/provider unavailable 对 root-cause confidence 的影响。
- fix scope 与 impacted surfaces 的边界说明。

---

## 推荐接入顺序

1. **Phase D1：`$spec-work` read-only consumer**
   - 先消费 `$spec-plan` 的 `Graph / GitNexus Evidence`。
   - 不新增 durable artifact。
   - 只补 work closeout / review handoff 的 evidence posture。

2. **Phase D2：`$spec-code-review` Coverage integration**
   - 在 review preflight 中读取 plan/work evidence posture。
   - 对 graph-heavy diff 使用 `detect_changes` / `impact` / route/API/shape capabilities。
   - Coverage 统一披露 degraded graph evidence。

3. **Phase D3：`$spec-debug` hypothesis integration**
   - 把 GitNexus evidence 接入 causal trace 和 hypothesis ledger。
   - 明确 root cause 必须由 reproduction/source/test/log 证明。

4. **Phase D4：mutation-gated maintenance path**
   - 只在明确用户授权和 preview-first contract 下处理 `group_sync`、`rename` 等 mutation capability。
   - 不并入普通 plan/work/review/debug happy path。

---

## Acceptance Examples

- AE-D1. Given a plan contains `Graph / GitNexus Evidence`, when `$spec-work` executes the plan, then it uses that evidence to focus source reads and test selection, but does not implement graph-discovered follow-up scope without user or plan authority.
- AE-D2. Given GitNexus impact finds extra affected symbols during work, when the current task scope does not include them, then Work records them as risk/follow-up or returns to Plan instead of editing them silently.
- AE-D3. Given a review diff changes a route handler response, when `$spec-code-review` has fresh or session-local GitNexus available, then it prefers `api_impact` / `shape_check` for consumer and response-shape evidence and confirms findings with source/diff evidence.
- AE-D4. Given GitNexus is stale or unavailable during review, when reviewers run, then Coverage records degraded graph evidence once and review continues with bounded direct reads instead of failing reviewer dispatch.
- AE-D5. Given a bug spans multiple modules, when `$spec-debug` traces the symptom, then GitNexus execution-flow/context evidence may guide hypotheses, but root cause is only claimed after reproduction, source, log, or test evidence closes the causal chain.
- AE-D6. Given a parent multi-repo workspace, when any downstream workflow is about to write, test, autofix, changelog, or commit, then it must name `target_repo` or per-child scope even if GitNexus group evidence is ready.

---

## Open Implementation Questions

- 下游接入是否需要新增最小 shared helper，还是只在各 workflow prompt 中消费 `$spec-plan` 输出 envelope。
- `$spec-work` closeout 是否需要结构化 `graph_evidence_used` 小节，还是先作为人类可读 completion evidence。
- `$spec-code-review` Coverage 中 graph evidence posture 是否映射到现有 reviewer JSON schema，或只在 synthesis 输出中呈现。
- `$spec-debug` hypothesis ledger 是否需要固定字段，还是保持轻量工作记录。
- 多仓 group evidence 在 downstream workflow 中是否需要统一 `repo_scope` 文案模板，避免 group-ready 被误解成 write scope。

## Next Step

当 `2026-05-22-001-gitnexus-first-class-capability-plugin-requirements.md` 进入 `$spec-plan` 后，把本文作为 R19 downstream guidance 输入；v1 plan 应只把 `$spec-work` / `$spec-code-review` / `$spec-debug` 的兼容接入纳入 future phases，不把它们列为 v1 completion gate。
