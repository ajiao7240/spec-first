# Supported Required Harness Runtime Tools

This reference is the human-readable index for the runtime managed by `spec-mcp-setup`. The machine truth for MCP servers and graph providers remains `skills/spec-mcp-setup/mcp-tools.json`.

## Instruction Surface Boundary

`AGENTS.md` and `CLAUDE.md` may contain a managed `spec-first:runtime-tools` block. That block is only a lightweight usage-boundary index for agents at session start.

Do not treat repo-root instruction files as the tool catalog, install guide, or readiness source. Keep the complete human-readable catalog in this file, MCP / graph-provider machine truth in `skills/spec-mcp-setup/mcp-tools.json`, setup-owned project facts in `.spec-first/config/*.json`, and canonical graph readiness facts in `.spec-first/graph/*` plus `.spec-first/impact/*`.

## Required MCP Tools

| Tool | Required | Category | Host Config | Project Bootstrap | Purpose |
|---|---:|---|---|---|---|---|
| Serena | Yes | `mcp` | Claude/Codex MCP server | Yes | Symbol-aware repo editing and project indexing |
| Sequential Thinking | Yes | `mcp` | Claude/Codex MCP server | No | Reflective reasoning support |
| Context7 | Yes | `mcp` | Claude/Codex MCP server | No | Current framework/library documentation |

## Required Graph Providers

| Tool | Required | Category | Role | Default Access | Setup Command | Bootstrap Owner |
|---|---:|---|---|---|---|
| GitNexus | Yes | `graph-provider` | `global_knowledge` | required host MCP | `npx -y <configured-gitnexus-package> mcp` | `spec-graph-bootstrap` reads `graph-providers.json` command arrays and transiently runs analyze/status/query probes |
| code-review-graph | Yes | `graph-provider` | `impact_context` | CLI artifacts; host MCP optional | `uvx --upgrade code-review-graph --help` | `spec-graph-bootstrap` reads `graph-providers.json` command arrays and transiently runs build/status/query-proof probes |

`spec-mcp-setup` only warms required provider packages, configures host-MCP-required providers, and writes setup-owned config facts. It must not run `gitnexus analyze`, `gitnexus status`, `gitnexus query`, `code-review-graph build`, or `code-review-graph status`. `code-review-graph serve` remains an explicit optional live-MCP enhancement and is not part of the default baseline.

## Required Helper Tooling

Required helper tooling is not an MCP server category and is intentionally not listed in `mcp-tools.json`.

| Tool | Required | Type | Purpose |
|---|---:|---|---|
| `agent-browser` | Yes | helper CLI + global skill | Browser automation helper used by downstream workflows |
| `gh` | Yes | helper CLI | GitHub issue/PR operations |
| `jq` | Yes | helper CLI / script dependency | JSON parsing for deterministic setup scripts |
| `vhs` | Yes | helper CLI | Terminal demo recording |
| `silicon` | Yes | helper CLI | Code screenshot rendering |
| `ffmpeg` | Yes | helper CLI | Media conversion and video assembly |
| `ast-grep` | Yes | helper CLI | Structural code search and rewrite |
| global `ast-grep` skill | Yes | global skill | Agent-facing ast-grep usage guidance |

Default helper install mode runs:

```bash
CI=true npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error
agent-browser install
npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
brew update && if brew list --formula <tool> >/dev/null 2>&1; then brew upgrade -q <tool>; else brew install -q <tool>; fi
npx -y skills@latest add ast-grep/agent-skill -g -y
```

The helper install path preserves inherited npm registry / proxy env vars through the sudo fallback, so `NPM_CONFIG_REGISTRY` / `npm_config_registry` can point npm and npx at a domestic mirror without rewriting global config. On Linux, `agent-browser install` uses `--with-deps`; on macOS and Windows it stays `agent-browser install` and relies on existing browser detection or the upstream runtime download path. When both `agent-browser` browser runtime and the global `agent-browser` skill are missing, `install-helpers.*` installs them in parallel and keeps the remaining helper tools serialized to avoid package-manager lock contention.

Package-backed setup paths request latest versions: npm/npx packages use `@latest`, `uvx` MCP/tool commands use `--upgrade`, Cargo installs use `--force`, and Homebrew/winget handoffs prefer upgrade-before-install semantics. Temporary package pins must live in `mcp-tools.json`; GitNexus projections must read that package spec from the registry instead of hard-coding it in prose or tests. `--verify-only` only reads facts and does not upgrade.

After `agent-browser install` succeeds, `install-helpers.*` writes `$HOME/.agent-browser/spec-first-install.json`. `--verify-only` only reads that marker, the CLI presence, and the global skill file; it does not run install or diagnostic commands.

`install-helpers.* --verify-only` only detects the helper facts and returns:

```json
{
  "helper_tools": {
    "agent-browser": {},
    "gh": {},
    "jq": {},
    "vhs": {},
    "silicon": {},
    "ffmpeg": {},
    "ast-grep": {},
    "ast-grep-skill": {}
  }
}
```

## Readiness Boundary

Readiness ledger v2 is written by `verify-tools.*` after merging MCP/graph-provider facts with helper facts.

`baseline_ready=true` means:

- required MCP tools are configured;
- required graph providers are configured; host MCP config is required only for providers with `host_config_required=true`;
- every required helper fact is ready.

It does not mean graph facts are query-ready. On first setup, graph providers remain:

```json
{
  "configured": true,
  "enabled_for_bootstrap": true,
  "query_ready": false,
  "bootstrap_required": true
}
```

`verify-tools.*` also writes setup-owned project facts when run inside a git repo:

- `.spec-first/config/graph-providers.json`
- `.spec-first/config/runtime-capabilities.json`
- `.spec-first/config/provider-artifacts.json`

`runtime-capabilities.json` records a `host_ledger_pointer` to the host readiness ledger v2. `spec-graph-bootstrap` must follow that pointer and fail closed on conflicts; it must not guess host ledger paths.

Run `/spec:graph-bootstrap` or `$spec-graph-bootstrap` to compile provider readiness, canonical graph facts, impact capabilities, and a bootstrap report. The command may transiently execute validated provider command arrays from `.spec-first/config/graph-providers.json`; it must not perform persistent installs or edit host MCP config.

Repeated setup, reinstall, or post-upgrade verification preserves existing project graph readiness summaries when the existing provider projection is for the same repo and the provider is still configured and dependency-ready. It must not reset canonical project graph readiness to `not-bootstrapped` just because setup reran. Uninstall or broken provider config must not preserve query readiness.

The final setup output should make this handoff explicit below the grouped readiness blocks: the safe default is to restart Claude Code/Codex or start a new session first, then run the graph-bootstrap command. If the current agent determines it only needs the deterministic bootstrap script and does not need newly loaded MCP servers, it may accept "继续完成" in the current session; downstream workflows should still wait for a restarted/new session.

Setup is idempotent: re-running it must not destroy an already ready Serena project, and host MCP config entries must not contain internal setup metadata such as selected scope. For Codex, higher-precedence config handling is per MCP server section, not per config file.
