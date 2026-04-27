---
name: spec-mcp-setup
description: Install, configure, and verify the required harness runtime for spec-first workflows on Claude Code or Codex.
argument-hint: ""
---

# Required Harness Runtime Setup

**Claude entry point:** `/spec:mcp-setup`
**Codex entry point:** `$spec-mcp-setup`

This workflow is the single setup entrypoint for spec-first. It has two distinct layers:

- Project Preflight / Local Setup: required developer helpers, project-local config bootstrap, and legacy Compound Engineering residue guidance.
- Required Harness Runtime: required MCP servers, graph-provider MCP servers, `agent-browser`, readiness ledger v2, and graph provider projection.

Project-local config and legacy residue facts do not affect `baseline_ready`. Required helper facts do affect `baseline_ready`. This workflow does not expose selectable MCP registry entries, legacy pending states, or a browser MCP server.

## Runtime Baseline

`skills/spec-mcp-setup/mcp-tools.json` is the only machine registry for MCP servers and graph-provider MCP servers. Schema version is `4`.

Required MCP tools:

- `serena`
- `sequential-thinking`
- `context7`

Required graph-provider MCP tools:

- `gitnexus` with role `global_knowledge`
- `code-review-graph` with role `impact_context`

Required helper tooling outside `mcp-tools.json`:

- `agent-browser`
- `gh`
- `jq`
- `vhs`
- `silicon`
- `ffmpeg`
- `ast-grep`
- global `ast-grep` skill

All tools in `mcp-tools.json` must have `required=true` and a `category` of `mcp` or `graph-provider`. Required helper tooling must not be added to `mcp-tools.json`; it is managed by `install-helpers.*` and appears under readiness ledger `helper_tools`.

## What This Workflow Does

1. Runs project preflight with `check-health`.
2. Offers explicit project-local config bootstrap actions when needed.
3. Reports legacy Compound Engineering residue and asks before deleting `compound-engineering.local.md`.
4. Checks required dependencies.
5. Installs/verifies required helper tooling.
6. Warms and configures every required MCP server in the host MCP config.
7. Bootstraps Serena for the current repo.
8. Writes readiness ledger v2 to the host marker path.
9. Writes `.spec-first/config/graph-providers.json` inside a git repo.
10. Tells the user to run `/spec:graph-bootstrap` or `$spec-graph-bootstrap` next.

It must not run:

- `npx -y gitnexus@latest analyze`
- `uvx code-review-graph build`
- the retired internal graph CLI

Graph construction is owned by `spec-graph-bootstrap`.

## Project Preflight

Run project preflight before changing host MCP config:

```bash
bash skills/spec-mcp-setup/scripts/check-health
```

Machine-readable form:

```bash
bash skills/spec-mcp-setup/scripts/check-health --json
```

On Windows, run `check-health` from Git Bash or WSL; project bootstrap has a native PowerShell script.

`check-health` reports:

- required helper `agent-browser`
- required developer helper tools
- required global `ast-grep` skill
- `.spec-first/config.local.yaml`
- `.spec-first/config.local.example.yaml`
- `.spec-first/*.local.yaml` gitignore coverage
- legacy `compound-engineering.local.md`
- legacy `.compound-engineering/config.local.yaml`

If project-local setup actions are needed, ask the user before changing files, then run the deterministic bootstrap script with explicit flags:

```bash
bash skills/spec-mcp-setup/scripts/bootstrap-project-config.sh --refresh-example --create-local --ensure-gitignore --json
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1 -RefreshExample -CreateLocal -EnsureGitignore -Json
```

Only pass `--delete-legacy-markdown` / `-DeleteLegacyMarkdown` after the user confirms deleting `compound-engineering.local.md`. Do not automatically delete `.compound-engineering/config.local.yaml`; report it as legacy residue and tell the user that spec-first now uses `.spec-first/config.local.yaml`.

Project preflight prepares setup input. Missing required helper tooling must mark Required Harness Runtime as failed. Missing local config, outdated example config, and legacy CE residue must not mark Required Harness Runtime as failed.

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

`install-helpers.* --verify-only` must only detect helper facts. It must not install the CLI, run `agent-browser install`, or install the global skill. It checks `$HOME/.agent-browser/spec-first-install.json` as the marker that the default install path has completed `agent-browser install`; missing marker means `install_status=action-required`.

## Helper Output Shape

`install-helpers.*` always returns helper facts under this top-level shape:

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

Default helper install mode must:

1. Install `agent-browser` CLI if missing.
2. Run `agent-browser install`.
3. Write `$HOME/.agent-browser/spec-first-install.json` after `agent-browser install` succeeds.
4. Install required helper CLIs: `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`, and `ast-grep`.
5. Install the upstream/global `agent-browser` skill:

```bash
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
```

6. Install the global `ast-grep` skill:

```bash
npx skills add ast-grep/agent-skill -g -y
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

`baseline_ready` includes required MCP tools, graph providers, and every required helper in `helper_tools`. Graph providers can be baseline-ready while still having `query_ready=false`; that means the harness runtime is ready and graph bootstrap is still required.

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

When setup finishes, display a final status table sourced from readiness ledger v2. The final visible output block must be this table; print ledger/projection notes before the table and do not print a non-table footer after it:

```text
Required Harness Runtime is ready.

Required Harness Runtime status:
  Name                     Type             Required Dependency       Host             Project          Query      Next
  ----                     ----             -------- ----------       ----             -------          -----      ----
  serena                   mcp              yes      ready            ready            ready            n/a        n/a
  sequential-thinking      mcp              yes      ready            ready            n/a              n/a        n/a
  context7                 mcp              yes      ready            ready            n/a              n/a        n/a
  gitnexus                 graph-provider   yes      ready            ready            n/a              pending    run spec-graph-bootstrap
  code-review-graph        graph-provider   yes      ready            ready            n/a              pending    run spec-graph-bootstrap
  agent-browser            helper           yes      ready            n/a              n/a              n/a        n/a
  gh                       helper           yes      ready            n/a              n/a              n/a        n/a
  jq                       helper           yes      ready            n/a              n/a              n/a        n/a
  vhs                      helper           yes      ready            n/a              n/a              n/a        n/a
  silicon                  helper           yes      ready            n/a              n/a              n/a        n/a
  ffmpeg                   helper           yes      ready            n/a              n/a              n/a        n/a
  ast-grep                 helper           yes      ready            n/a              n/a              n/a        n/a
  ast-grep-skill           global-skill     yes      ready            n/a              n/a              n/a        n/a
  graph-providers.json     project          yes      n/a              n/a              ready            n/a        n/a

```

## Reference

- Supported tools: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Machine registry: `skills/spec-mcp-setup/mcp-tools.json`
- Claude command metadata: `templates/claude/commands/spec/mcp-setup.md`
