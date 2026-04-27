# Supported Required Harness Runtime Tools

This reference is the human-readable index for the runtime managed by `spec-mcp-setup`. The machine truth for MCP servers and graph-provider MCP servers remains `skills/spec-mcp-setup/mcp-tools.json`.

## Required MCP Tools

| Tool | Required | Category | Host Config | Project Bootstrap | Purpose |
|---|---:|---|---|---|---|
| Serena | Yes | `mcp` | Claude/Codex MCP server | Yes | Symbol-aware repo editing and project indexing |
| Sequential Thinking | Yes | `mcp` | Claude/Codex MCP server | No | Reflective reasoning support |
| Context7 | Yes | `mcp` | Claude/Codex MCP server | No | Current framework/library documentation |

## Required Graph Providers

| Tool | Required | Category | Role | Setup Command | Bootstrap Owner |
|---|---:|---|---|---|---|
| GitNexus | Yes | `graph-provider` | `global_knowledge` | `npx -y gitnexus@latest mcp` | `spec-graph-bootstrap` runs `npx -y gitnexus@latest analyze` |
| code-review-graph | Yes | `graph-provider` | `impact_context` | `uvx code-review-graph serve --tools get_minimal_context_tool,get_impact_radius_tool,get_review_context_tool,query_graph_tool,detect_changes_tool,list_graph_stats_tool` | `spec-graph-bootstrap` runs `uvx code-review-graph build` |

`spec-mcp-setup` only warms and configures graph-provider MCP servers. It must not run `gitnexus analyze` or `code-review-graph build`.

## Required Helper Tool

`agent-browser` is required helper tooling, not an MCP server. It is intentionally not listed in `mcp-tools.json`.

Default helper install mode runs:

```bash
CI=true npm install -g agent-browser --no-audit --no-fund --loglevel=error
agent-browser install
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
```

After `agent-browser install` succeeds, `install-helpers.*` writes `$HOME/.agent-browser/spec-first-install.json`. `--verify-only` only reads that marker, the CLI presence, and the global skill file; it does not run install or diagnostic commands.

`install-helpers.* --verify-only` only detects the helper facts and returns:

```json
{
  "helper_tools": {
    "agent-browser": {}
  }
}
```

## Readiness Boundary

Readiness ledger v2 is written by `verify-tools.*` after merging MCP/graph-provider facts with helper facts.

`baseline_ready=true` means:

- required MCP tools are configured;
- required graph-provider MCP servers are configured;
- `agent-browser` helper facts are ready.

It does not mean graph indexes are query-ready. After `spec-mcp-setup`, graph providers remain:

```json
{
  "configured": true,
  "enabled_for_bootstrap": true,
  "query_ready": false,
  "bootstrap_required": true
}
```

Run `/spec:graph-bootstrap` or `$spec-graph-bootstrap` to build provider indexes and flip `query_ready=true`.
