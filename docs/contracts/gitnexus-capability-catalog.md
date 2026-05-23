# GitNexus Capability Catalog Contract

## 目标

本文定义 GitNexus native capability catalog 的 source/provenance 边界。它补充 `docs/contracts/graph-evidence-policy.md`、`docs/contracts/graph-provider-consumption.md` 和 `docs/contracts/workspace-gitnexus-consumption.md`：catalog 是轻量 source input，不是 query readiness truth，也不是隐藏 provider 平台。

核心边界：

- checked-in baseline 只定义 capability 语义、候选 native tools/resources、mutation boundary 和 fallback posture。
- setup projection 只写 setup-inferred observed availability / discovery facts。
- live MCP tool/resource surface 只产生当前会话 evidence。
- `$spec-plan` 负责基于当前任务语义选择 capability，并在 live claim 前复核当前 session surface。

## Source Tag Vocabulary

公开 `source_tags[]` 是闭合词表，只能使用下列值：

- `checked-in-baseline`：repo 中 checked-in catalog baseline。
- `setup-projection`：`spec-mcp-setup` 写出的 setup-owned projection。
- `provider-pin`：`mcp-tools.json` 中 GitNexus provider package/version pin。
- `live-mcp-tool`：当前会话实际可调用的 GitNexus MCP tool surface。
- `live-mcp-resource`：当前会话实际可读取的 GitNexus MCP resource/template surface。
- `session-local-inference`：LLM 基于当前会话工具/resource 结果做出的本轮推断。
- `user-decision`：用户显式选择或批准的任务边界 / maintenance action。

`source_tags[]` 不承载 setup-internal diagnostics。host config、dependency readiness、workspace advisory 这类 setup-internal / advisory diagnostics 不得成为 tags；其中 host config 和 dependency readiness 可以出现在 `source_provenance`，workspace advisory、prior projection reuse 等确定性事实可以出现在 `limitations[]`、provider fingerprint facts 或 setup logs 中，但不得作为公共 `source_tags[]` 值出现。

`source_tag` singular 在 plan decision ledger 中仍可表示 `confirmed`、`advisory`、`session-local`、`stale` 或 `user` 等决策证据等级；它不是本 catalog 的 `source_tags[]` 字段。

## Verification Posture

verification posture 是派生判断，不是独立闭合 enum。消费者应从 `source_tags[]`、canonical graph readiness、新鲜度、当前 live MCP tool/resource 复核结果和直接源码/测试证据推导本轮姿态。

常见描述可以使用 `baseline-only`、`setup-inferred`、`live-verified`、`resource-verified`、`conflict-degraded` 或 `user-confirmed` 这类 prose，但不要把它们写成第二个 machine enum。只有当现有 source tags 无法表达真实消费者需求，并且新增 contract test 证明必要性时，才能扩展 machine contract。

## Checked-In Baseline

Machine-readable baseline 位于 `skills/spec-mcp-setup/mcp-tools.json` 的 GitNexus entry：

```text
tools[].id == "gitnexus" -> provider_config.native_capabilities
```

每个 capability 至少包含：

- `meaning`
- `native_tools[]`
- `native_resources[]`
- `mutation_boundary`
- `fallback_posture`
- `source_tags[]`

Baseline 必须包含 `checked-in-baseline` 和 `provider-pin`，并且不得包含 `query_ready`、live availability、task result、raw log、query snippet、semantic conclusion 或 current group readiness。

Read-only MCP resources 与 tools 同为 evidence surface，但不是执行 capability。候选 resource 包括 `gitnexus://repos`、`gitnexus://repo/{name}/context`、`gitnexus://repo/{name}/schema`、`gitnexus://repo/{name}/processes`、`gitnexus://repo/{name}/process/{processName}`、`gitnexus://group/{name}/contracts` 和 `gitnexus://group/{name}/status`。

## Setup Projection

`spec-mcp-setup` 可以把 baseline 和 provider pin 投影到：

- `.spec-first/config/graph-providers.json.providers.gitnexus.native_capabilities`
- `.spec-first/config/runtime-capabilities.json.gitnexus_capability_discovery`

Projection 必须添加 `setup-projection` source tag，并保持 `checked-in-baseline` / `provider-pin` 来源可见。Projection 可以写 `status`、`source_provenance`、`native_tools[]`、`native_resources[]`、`mutation_boundary` 和 `limitations[]`，但它仍只是 setup-inferred availability，不得成为第二个永久 capability registry 或 graph readiness source。

Setup projection 必须 fail closed：如果 checked-in registry 的 baseline `source_tags[]` 为空、缺少 `checked-in-baseline` / `provider-pin`、包含 live/session/user tags 或未知 tags，setup 不得把这些值透传到 projection。Setup 自己只追加 `setup-projection`，不会伪造 `live-mcp-tool`、`live-mcp-resource`、`session-local-inference` 或 `user-decision`。

Schema v6 不再接受 legacy `native_surfaces`。`source_tags[]`、`native_tools[]`、`native_resources[]` 和 `mutation_boundary` 都是必填字段；setup 不得为缺失字段合成默认 registry facts。`native_tools[]` 与 `native_resources[]` 必须是非空字符串元素组成的数组，且每个 capability 至少有一个 candidate tool 或 read-only resource。`mutation_boundary` 只能是 `read-only`、`mutation-gated`、`policy-blocked` 或 `unknown`；未知值必须在 setup projection 前失败，不能写成 deterministic fact。

Setup 不得调用或读取 live MCP resources，也不得运行 GitNexus query/analyze/status、Cypher、group sync、rename、provider repair、hooks、watchers 或 daemons。

## Plan Consumption

`$spec-plan` 可以读取 checked-in baseline 与 setup projection 来选择候选 surface，但 live claim 必须来自当前 session MCP tool/resource 复核或被降级为 setup-inferred / baseline-only limitation。

当 baseline、provider pin、setup projection、canonical graph readiness 与 live MCP surface 不一致时，Plan 采用当前已验证 surface 的保守解释：

- live tool claim 需要 `live-mcp-tool`。
- live resource claim 需要 `live-mcp-resource`。
- 基于当前会话结果的 LLM 推断需要 `session-local-inference`。
- mutation 或 maintenance action 需要 `user-decision`，并且必须走 preview-first / explicit action。

No-graph/no-MCP/no-setup-projection fast path 不枚举静态 catalog。只有存在 canonical graph artifacts、workspace advisory facts、setup-owned projection 或 current-session GitNexus MCP tool/resource surface 时，Plan 才需要写详细 `Graph / GitNexus Evidence` posture。

## Mutation Boundary

Catalog 可以描述 mutation-capable provider surfaces as limitations or maintenance follow-ups，但普通 setup/plan/work/debug/review 不得把 `group_sync`、workspace group mutation、GitNexus `rename` 或 symbol rename-like capability 变成自动 implementation step。

Read-only workspace orientation uses `group_list` and read-only group resources. `group_sync` remains outside the automatic catalog execution path and belongs to a separate preview-first maintenance plan when explicitly requested.

## Manual Execution Guidance

本节面向**用户手动调用** GitNexus mutation-capable capability 的场景，提供最低安全闭环。它不是 workflow 执行步骤——spec-first 的 setup / plan / work / code-review / debug 不得引用本节作为自动执行依据。`mutation-gated` 不等于 `unavailable`：能力可用，但必须经显式用户操作 + preview-first 才能落地。

### `workspace_group_sync`（GitNexus tool: `group_sync`）

- Preview：先调用 `list_repos` 与 `group_list`（可结合 `gitnexus://repos`、`gitnexus://group/{name}/status` 资源），核对 registry 中已索引仓库与候选 group 成员是否符合预期。
- Execute：在显式确认成员清单后调用 `group_sync`，参数中明确传入 group 名称与成员清单,不依赖隐式默认。
- Verify：再次 `group_list`,确认 `group.status="group-ready"` 且成员仓库与预期一致。
- Recover：`group_sync` 写入是覆盖式的；如需修正可用更正后的成员清单重新调用。

### `symbol_rename`（GitNexus tool: `rename`）

- Preview：使用 provider 自带 dry-run（`rename --dry-run` 或等价参数），按 confidence tag 逐项 review；任何 low-confidence 命中都应人工核对源码。
- Execute：dry-run 通过后再去掉 dry-run 标志执行；多仓 workspace 必须明确 `target_repo`,禁止跨仓批量执行。
- Verify：`git diff --stat` 比对实际改动与 dry-run preview 是否一致；运行受影响范围的测试。
- Recover：失败或回滚使用 `git revert` / `git restore` 在受影响 repo 内回退,必要时再次走完整 preview 流程。

### 多仓 scope 校验

任何 mutation 写入前,确认每个变更落到具体 `target_repo` / per-child scope；GitNexus registry / group evidence 仅用于发现候选,不替代写入边界判断（参考 `docs/contracts/workspace-gitnexus-consumption.md`）。
