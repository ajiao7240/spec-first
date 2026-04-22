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
| Serena | Yes | Claude/Codex use host-specific MCP args and Codex timeout | Yes — current repo bootstrap required | `spec-graph-bootstrap`, code navigation / symbol workflows |
| Sequential Thinking | Yes | Standard MCP entry | No | planning / reasoning-heavy workflows |
| Context7 | Yes | Standard MCP entry | No | framework docs lookup |
| Playwright MCP | No | Host MCP config only | No | browser / frontend automation |

## Readiness Signals

The host readiness ledger at the current host's `spec-first/host-setup.json` answers four questions:

1. Is the required MCP baseline ready?
2. Which tool is still pending and why?
3. Has Serena bootstrapped the current repo?
4. Is CRG usable on this machine?

The most important fields are:
- `overall_status`
- `baseline_ready`
- `tools.<tool>.dependency_status`
- `tools.<tool>.host_config_status`
- `tools.<tool>.project_status`
- `tools.<tool>.next_action`
- `crg.cli_status`
- `crg.native_modules_status`
- `next_actions[]`

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
