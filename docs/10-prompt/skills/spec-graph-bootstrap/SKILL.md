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
- GitNexus `query-unverified` 只表示 bootstrap CLI query probe 未验证通过，不等于 live GitNexus MCP 一定不可用。
- 脚本不能调用 host MCP tools；如果当前会话已加载 GitNexus MCP 且结果会澄清最终交付，LLM 应在脚本完成后做一次 bounded live MCP probe，例如用 `gitnexus_query` / `gitnexus_context` / `gitnexus_impact` 验证当前会话是否能读图。
- live MCP probe 只尝试一个具体调用；不要循环重试、广泛探测，或把 live MCP probe 变成 compiled readiness 的 gate。
- live MCP 成功只作为 session-local evidence，不回写 `.spec-first/graph/*`，不把 compiled `query_ready` 改成 true。
- 如果执行或需要说明 live MCP probe，最终用户可见结果表格必须拆分 compiled CLI readiness 与 session-local MCP evidence，例如包含 `CLI graph_ready`、`CLI query_ready`、`Live MCP Probe`、`Final Use` 列。
- `Live MCP Probe=passed` 不能折叠成 `CLI query_ready=true`；只能说明当前会话可用 GitNexus MCP，downstream compiled facts 仍保持 degraded 或 query-unverified。
- runtime baseline summary 与 host ledger v2 冲突时 fail closed，`reason_code=readiness-conflict`。
- 没有 query-ready provider 时，capability envelope 必须根据 `runtime-capabilities.fallback_capabilities` 写 `partial` 或 `none`；不能凭空声明 fallback 可用。
- 重复 `spec-mcp-setup` 只有在 canonical artifacts 仍存在且 current 时，才从 canonical readiness artifacts 重建 setup-owned project graph readiness projection。

`spec-plan` 是第一个 downstream consumer。它读取 `.spec-first/graph/graph-facts.json` 和 `.spec-first/impact/bootstrap-impact-capabilities.json`，在计划中输出固定的 `## Graph Readiness` block；artifact 缺失、blocked、setup-not-ready 或 stale 时，计划继续使用 bounded direct repo reads。

边界：

- 不读取顶层 `crg`。
- 不依赖 retired internal CRG runtime。
- 不把 provider projection、runtime summary 或 bootstrap report 当成 canonical graph truth；canonical truth 在 `.spec-first/graph/` 和 `.spec-first/impact/`。
- 不回写 setup-owned config inputs；`graph-providers.json.derived_readiness` 和 `runtime-capabilities.json.project_graph_readiness` 由 `spec-mcp-setup` 从 canonical artifacts 投影。
- 不做 persistent install：不执行 `npm install -g`、`uv tool install`、shell profile 修改或 MCP host config 修改。
- scripts 负责 deterministic build/probe/readiness 写入；LLM 负责判断下游 workflow 如何消费这些事实。
