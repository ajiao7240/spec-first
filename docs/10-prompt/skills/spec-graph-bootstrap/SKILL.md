# spec-graph-bootstrap Prompt Mirror

> 镜像用途：记录 Graph Readiness Compiler 的当前架构语义。源码真相源仍是 `skills/spec-graph-bootstrap/SKILL.md`。

`spec-graph-bootstrap` 在 `spec-mcp-setup` 之后运行，负责把 project graph readiness 编译成 canonical artifacts。`spec-mcp-setup` 只写 setup-owned facts；`spec-graph-bootstrap` 消费这些 facts，瞬时执行经过安全校验的 provider command arrays，并写出下游 workflow 可读取的事实入口。

它读取：

- `.spec-first/config/graph-providers.json`
- `.spec-first/config/runtime-capabilities.json`
- `.spec-first/config/provider-artifacts.json`
- `runtime-capabilities.json` 中的 `host_ledger_pointer` 指向的 host readiness ledger v2

它运行：

- `graph-providers.json` 中 `providers.<id>.commands.bootstrap/status/query_probe` 定义的 command arrays
- command arrays 必须是数组，不允许 string eval、`bash -c`、`sh -c` 或 unsupported executable/package shape
- 执行必须不经过 shell interpolation；不支持的命令形态 fail closed，`reason_code=unsupported-provider-command`

它写入 canonical artifacts：

```json
{
  ".spec-first/graph/provider-status.json": "provider readiness aggregate",
  ".spec-first/graph/graph-facts.json": "canonical graph readiness facts",
  ".spec-first/impact/bootstrap-impact-capabilities.json": "fallback-aware impact capability envelope",
  ".spec-first/graph/bootstrap-report.md": "human-readable report"
}
```

Readiness 规则：

- `query_ready=true` 需要 build/analyze、status probe、provider-specific query-surface proof 全部成功。
- build/status 成功但 query-surface proof 缺失或失败时写 `status=query-unverified`，`query_ready=false`。
- GitNexus CLI proof 可以消费 `query_probe_policy.candidates[]` 做 bounded multi-candidate probe；候选由 `spec-mcp-setup` 从 tracked source basenames 确定，优先跨栈入口/工作流信号，Android 只是平台信号之一。
- GitNexus 多候选 proof 最多尝试 consumer-side limit 内的前 5 个候选，并在第一个 `processes` 或 `process_symbols` 非空结果处停止；第一个候选写 `raw/query.log`，后续候选写 `raw/query-2.log`、`raw/query-3.log` 等，并在 provider status 记录 `query_probe_attempts[]`。
- 如果 setup 侧提供超过 5 个候选，bootstrap 只尝试前 5 个，并写出 `query_probe_candidate_limit=5`、`query_probe_candidates_truncated=true`；这是防止 provider probe 变成 broad search 的 consumer-side 边界。
- GitNexus normalized envelopes 必须包含实际 attempted query logs；如果第二个或后续候选首次产生 process result，`winning_query_probe_log` 应指向对应 `query-N.log`，不能只指向 `query.log`。
- GitNexus `query-unverified` 只表示 bootstrap CLI query probe 未验证通过，不等于 live GitNexus MCP 一定不可用。
- 所有候选都只返回 definitions-only 时仍然是 `query-unverified`；definitions-only 只能说明符号定位可用，不能证明 BM25/process query surface 健康。
- 脚本不能调用 host MCP tools；如果当前会话已加载 GitNexus MCP 且结果会澄清最终交付，LLM 应在脚本完成后做一次 bounded live MCP probe，例如用 `gitnexus_query` / `gitnexus_context` / `gitnexus_impact` 验证当前会话是否能读图；probe token 优先使用 `query_probe_attempts[]` 中第一个 `process-results` attempt，没有成功 attempt 时再回退到 policy candidate。
- live MCP probe 只尝试一个具体调用；不要循环重试、广泛探测，或把 live MCP probe 变成 compiled readiness 的 gate。
- live MCP 成功只作为 session-local evidence，不回写 `.spec-first/graph/*`，不把 compiled `query_ready` 改成 true。
- 如果 live GitNexus 返回 `definitions` 但没有 `processes` / `process_symbols`，标记为 `partial-definitions-only`，不要写成 `failed`；这类证据只能作为定位文件或符号的局部指针，不证明 BM25/process query surface 健康。
- 如果执行或需要说明 live MCP probe，最终用户可见结果表格必须拆分 compiled CLI readiness 与 session-local MCP evidence，例如包含 `CLI graph_ready`、`CLI query_ready`、`Probe Token`、`CLI Evidence`、`Live MCP Probe`、`Final Use` 列。
- `Live MCP Probe=passed` 不能折叠成 `CLI query_ready=true`；只能说明当前会话可用 GitNexus MCP，downstream compiled facts 仍保持 degraded 或 query-unverified。
- runtime baseline summary 与 host ledger v2 冲突时 fail closed，`reason_code=readiness-conflict`。
- 没有 query-ready provider 时，capability envelope 必须根据 `runtime-capabilities.fallback_capabilities` 写 `partial` 或 `none`；不能凭空声明 fallback 可用。
- `graph-facts.provider_summary.degraded_providers` 不应混入 `status=skipped` 的 provider；skipped provider 必须单独进入 `skipped_primary_providers`，避免 downstream 把显式禁用误读成失败或降级。
- 重复 `spec-mcp-setup` 只有在 canonical artifacts 仍存在且 current 时，才从 canonical readiness artifacts 重建 setup-owned project graph readiness projection。

`spec-plan` 是第一个 downstream consumer。它读取 `.spec-first/graph/graph-facts.json` 和 `.spec-first/impact/bootstrap-impact-capabilities.json`，在计划中输出固定的 `## Graph Readiness` block；artifact 缺失、blocked、setup-not-ready 或 stale 时，计划继续使用 bounded direct repo reads。

边界：

- 不读取顶层 `crg`。
- 不依赖 retired internal CRG runtime。
- 不把 provider projection、runtime summary 或 bootstrap report 当成 canonical graph truth；canonical truth 在 `.spec-first/graph/` 和 `.spec-first/impact/`。
- 不回写 setup-owned config inputs；`graph-providers.json.derived_readiness` 和 `runtime-capabilities.json.project_graph_readiness` 由 `spec-mcp-setup` 从 canonical artifacts 投影。
- 不做 persistent install：不执行 `npm install -g`、`uv tool install`、shell profile 修改或 MCP host config 修改。
- scripts 负责 deterministic build/probe/readiness 写入；LLM 负责判断下游 workflow 如何消费这些事实。
