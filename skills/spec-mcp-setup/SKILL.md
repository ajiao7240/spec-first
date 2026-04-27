---
name: spec-mcp-setup
description: Install, configure, and verify the required harness runtime for spec-first workflows on Claude Code or Codex.
argument-hint: ""
---

# Required Harness Runtime Setup

**Claude entry point:** `/spec:mcp-setup`
**Codex entry point:** `$spec-mcp-setup`

This workflow installs the fixed spec-first harness runtime. It does not expose selectable setup modes, optional MCP registry entries, legacy pending states, or a browser MCP server.

## Runtime Baseline

`skills/spec-mcp-setup/mcp-tools.json` is the only machine registry for MCP servers and graph-provider MCP servers. Schema version is `4`.

Required MCP tools:

- `serena`
- `sequential-thinking`
- `context7`

Required graph-provider MCP tools:

- `gitnexus` with role `global_knowledge`
- `code-review-graph` with role `impact_context`

Required helper tool outside `mcp-tools.json`:

- `agent-browser`

All tools in `mcp-tools.json` must have `required=true` and a `category` of `mcp` or `graph-provider`. `agent-browser` must not be added to `mcp-tools.json`; it is a helper CLI plus global skill managed by `install-helpers.*`.

## What This Workflow Does

1. Checks required dependencies.
2. Installs/verifies the required helper `agent-browser`.
3. Warms and configures every required MCP server in the host MCP config.
4. Bootstraps Serena for the current repo.
5. Writes readiness ledger v2 to the host marker path.
6. Writes `.spec-first/config/graph-providers.json` inside a git repo.
7. Tells the user to run `/spec:graph-bootstrap` or `$spec-graph-bootstrap` next.

It must not run:

- `npx -y gitnexus@latest analyze`
- `uvx code-review-graph build`
- the retired internal graph CLI

Graph construction is owned by `spec-graph-bootstrap`.

## Deterministic Commands

Run dependency checks first:

```bash
bash skills/spec-mcp-setup/scripts/check-deps.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/check-deps.ps1
```

Install helper tooling:

```bash
bash skills/spec-mcp-setup/scripts/install-helpers.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-helpers.ps1
```

Install and configure required MCP servers:

```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1
```

Write the final readiness ledger and project provider projection:

```bash
bash skills/spec-mcp-setup/scripts/verify-tools.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/verify-tools.ps1
```

`install-helpers.* --verify-only` must only detect helper facts. It must not install the CLI, run `agent-browser install`, or install the global skill.

## Helper Output Shape

`install-helpers.*` always returns helper facts under this top-level shape:

```json
{
  "helper_tools": {
    "agent-browser": {}
  }
}
```

Default helper install mode must:

1. Install `agent-browser` CLI if missing.
2. Run `agent-browser install`.
3. Install the upstream/global skill:

```bash
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
```

## Readiness Ledger v2

`detect-tools.*` outputs tool facts only:

- `schema_version="tool-facts.v2"`
- `tools`
- `graph_providers`
- no top-level `crg`
- no `baseline_ready`

`verify-tools.*` merges:

- `detect-tools.*` facts
- `install-helpers.* --verify-only` facts

Then it computes one final readiness ledger:

```json
{
  "schema_version": "v2",
  "baseline_ready": true,
  "tools": {},
  "graph_providers": {},
  "helper_tools": {}
}
```

`baseline_ready` includes required MCP tools, graph providers, and `agent-browser`. Graph providers can be baseline-ready while still having `query_ready=false`; that means the harness runtime is ready and graph bootstrap is still required.

After setup, graph-provider facts must only show:

```json
{
  "configured": true,
  "enabled_for_bootstrap": true,
  "query_ready": false,
  "bootstrap_required": true
}
```

## Provider Projection

`write-provider-config.*` writes `.spec-first/config/graph-providers.json` only when running inside a git repo. This file is not a second registry. It is a project-local provider selection projection for downstream workflows.

Expected projection boundaries:

```json
{
  "schema_version": "graph-providers.v1",
  "generated_by": "spec-mcp-setup",
  "boundaries": {
    "setup_only": true,
    "does_not_run_gitnexus_analyze": true,
    "does_not_run_code_review_graph_build": true,
    "graph_bootstrap_required": true
  }
}
```

## Codex TOML Contract

Codex MCP sections with hyphenated names must use quoted TOML table keys:

```toml
[mcp_servers."code-review-graph"]
```

Before writing a Codex section, scripts must delete both legacy unquoted and current quoted sections for the same MCP server. `configure-host.*`, `detect-tools.*`, and `uninstall-mcp.*` must share the same TOML formatter/parser helpers.

## Uninstall Contract

`uninstall-mcp.*` must remove all registered MCP servers, including `gitnexus` and `code-review-graph`. After uninstall it must refresh:

- host readiness ledger v2
- `.spec-first/config/graph-providers.json`

Uninstall does not delete `agent-browser`, external caches, or the project projection file.

## Success Summary

When setup succeeds, summarize:

```text
Required Harness Runtime is ready.

Installed and configured:
- Serena
- Sequential Thinking
- Context7
- GitNexus
- code-review-graph
- agent-browser

Generated:
- host readiness ledger v2
- .spec-first/config/graph-providers.json

Graph providers are configured but not query-ready yet.

Next:
1. Restart Claude Code / Codex if needed.
2. Run /spec:graph-bootstrap or $spec-graph-bootstrap.
```

## Reference

- Supported tools: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Machine registry: `skills/spec-mcp-setup/mcp-tools.json`
- Claude command metadata: `templates/claude/commands/spec/mcp-setup.md`
