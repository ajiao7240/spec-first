# Supported MCP Tools

This reference is the human-readable index for the MCP tools currently managed by `spec-mcp-setup`.

Use this file when a workflow needs to know:
- which MCP tools are supported
- whether a tool is required or optional
- what host-specific notes matter
- whether a tool requires current-repo bootstrap
- which downstream skills or workflows depend on it

The machine-truth tool registry remains `skills/spec-mcp-setup/mcp-tools.json`.

## Tool Index

| Tool | Required | Host notes | Current-repo bootstrap | Used by |
|------|----------|-----------|------------------------|---------|
| Serena | Yes | Claude/Codex use host-specific MCP args and Codex timeout | Yes — current repo bootstrap required | code navigation / symbol-aware workflows |
| Sequential Thinking | Yes | Standard MCP entry | No | planning / reasoning-heavy workflows |
| Context7 | Yes | Standard MCP entry | No | framework docs lookup |
| Playwright MCP | No | Host MCP config only | No | browser / frontend automation |

## Helper Tool Boundary

`agent-browser` is intentionally not listed in the MCP Tool Index and must not be added to `mcp-tools.json`. It is a required external browser automation CLI plus upstream/global skill installed through the `spec-mcp-setup` Phase 0 helper-tool preflight, not an MCP server and not part of `baseline_ready`.

The helper install path intentionally floats the current upstream package and skill source:

```bash
CI=true npm install -g agent-browser --no-audit --no-fund --loglevel=error && agent-browser install && npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
```

The trusted upstreams are the `agent-browser` npm package, `agent-browser install` for the browser/runtime bootstrap, and `https://github.com/vercel-labs/agent-browser` for the global skill stub. If that upstream path becomes unavailable or unsuitable for a host, do not add a local replacement skill in this repository; instead, rerun `spec-mcp-setup`, inspect `agent-browser --version`, and use the upstream/global skill docs from `agent-browser skills get core` for rollback or repair guidance.

## Host Target Notes

Route B keeps one machine-readable registry in `mcp-tools.json` and projects these host facts:
- Claude Code prefers official `managed-mcp.json` and may fall back to `~/.claude.json`
- Codex writes user config at `~/.codex/config.toml`
- Unix Codex also surfaces `/etc/codex/config.toml` as precedence fact
- uninstall removes entries from every declared uninstall target for the current host

## Readiness Signals

The host readiness ledger at the current host's `spec-first/host-setup.json` answers four questions:

1. Is the required MCP baseline ready?
2. Which tool is still pending and why?
3. Has Serena bootstrapped the current repo?
4. Which deterministic next action remains before MCP/helper workflows can proceed?

The most important fields are:
- `overall_status`
- `baseline_ready`
- `tools.<tool>.dependency_status`
- `tools.<tool>.host_config_status`
- `tools.<tool>.selected_scope`
- `tools.<tool>.project_status`
- `tools.<tool>.next_action`
- `next_actions[]`

`host_config_status` now means:
- `ready`
- `fallback-active`
- `precedence-blocked`
- `action-required`

## Serena Notes

Serena is the only tool in this list that currently requires host config **and** current-repo bootstrap.

A host can therefore be in one of these states:
- host config missing
- host config ready, repo bootstrap pending
- host config ready, repo bootstrap failed (project metadata exists but the latest index-ready marker is missing)
- host config ready, repo bootstrap ready

The current repo bootstrap is considered ready only when both `.serena/project.yml` and the latest index-ready marker (`.serena/index-ready.json`) exist.

Workflows that depend on Serena should prefer `tools.serena.project_status` over inferring readiness only from host config.

## Documentation Boundaries

- Keep this file human-readable.
- Do not duplicate the full tool catalog in `CLAUDE.md` or `AGENTS.md`.
- Do not introduce a second machine-readable registry here.
- Update this file when the supported tool set or readiness semantics change.
