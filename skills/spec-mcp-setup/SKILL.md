---
name: spec-mcp-setup
description: "Use when installing MCP tools for Claude Code or Codex, rebuilding host MCP config, bootstrapping Serena for the current repo, or verifying the host readiness ledger."
argument-hint: "[quick|custom]"
---

# MCP Tools Setup

Install, repair, and verify the MCP tools used by spec-first workflows.

**Claude entry point:** `/spec:mcp-setup [quick|custom]`
**Codex entry point:** `$spec-mcp-setup [quick|custom]`

## Overview

This workflow rebuilds the host MCP setup around a deterministic installer pipeline instead of the retired `install-coordinator.*` flow.

| Tool | Required | Purpose |
|------|----------|---------|
| Serena | Yes | Symbol-level editing and current-repo bootstrap |
| Sequential Thinking | Yes | Dynamic reflective problem solving |
| Context7 | Yes | Latest framework documentation lookup |
| Playwright MCP | No | Frontend automation testing |

The active host is detected automatically. Claude Code now prefers the official managed MCP target (`managed-mcp.json`) and falls back to `~/.claude.json` when the managed target is not writable; Codex writes user-scoped MCP config to `~/.codex/config.toml` while also surfacing `/etc/codex/config.toml` precedence facts on Unix. The host readiness ledger is written to the current host's `spec-first/host-setup.json` marker path.

Route B host facts intentionally expose:
- selected scope (`managed` / `user`)
- fallback order
- uninstall targets
- precedence-blocked facts for Codex
- the exact config path chosen for this run

This keeps one machine truth in `mcp-tools.json` and lets scripts stay deterministic.

If both CLIs are present and no host hint is available, set `MCP_SETUP_HOST=claude|codex` explicitly; the workflow will not guess.

Platform entrypoints:
- macOS / Linux / WSL: `*.sh`
- Windows: matching `*.ps1`

## Installer Metadata

Tool metadata is defined in `skills/spec-mcp-setup/mcp-tools.json`.

The current schema provides one machine truth for:
- required vs optional tools
- dependency requirements
- host-specific MCP config shape
- detection strategy
- project bootstrap requirements
- summary column order

Do not create a second machine-readable registry for the same tool catalog in this workflow.

---

## Phase 0: Project / Repo Setup Preflight

**Goal:** Reuse the migrated deterministic preflight to diagnose helper tools, legacy Spec-First residue, and repo-local `.spec-first` config before entering MCP baseline setup.

### 0.1 Run Preflight Health Check

Before running the script, tell the user:

`Spec-First -- checking your environment...`

macOS/Linux:
```bash
bash skills/spec-mcp-setup/scripts/check-health
```

Display the script output to the user verbatim.

### 0.2 Use Preflight Output As The Only Phase-A Machine Input

The migrated `check-health` script is the single deterministic input for this phase.

Use it for:
- helper tool detection and install suggestions (`agent-browser`, `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`)
- legacy Spec-First detection
- `.spec-first/config.local.yaml` presence
- `.spec-first/config.local.example.yaml` freshness
- `.gitignore` coverage hints

Do not:
- add these helper tools to `mcp-tools.json`
- merge these checks into `detect-tools.*`
- invent a second preflight registry or metadata file
- write any of these Phase-A states into the readiness ledger

### 0.3 Handle Project / Repo Preflight Issues

Continue to use the preflight output to drive user-confirmed actions only when the action would write user-owned project config or install optional helper tooling:
- legacy Spec-First cleanup guidance
- `.spec-first/config.local.example.yaml` refresh from `skills/spec-mcp-setup/references/config-template.yaml`
- `.spec-first/config.local.yaml` bootstrap from `skills/spec-mcp-setup/references/config-template.yaml`
- `.gitignore` coverage prompt
- helper tool installation guidance

These remain Phase-A facts only. They do not change `baseline_ready`.

---

## Phase 1: Dependency Detection

**Goal:** Detect prerequisite dependencies and establish whether the host can proceed to installation.

### 1.1 Run Dependency Check

macOS/Linux:
```bash
bash skills/spec-mcp-setup/scripts/check-deps.sh
```

Windows:
```powershell
pwsh -File skills/spec-mcp-setup/scripts/check-deps.ps1
```

Expected output shape:

```json
{
  "os": "macos",
  "node": { "installed": true, "version": "v20.11.0", "install_suggestion": null },
  "uv": { "installed": true, "version": "uv 0.4.0", "install_suggestion": null },
  "jq": { "installed": true, "version": "jq-1.7", "install_suggestion": null }
}
```

### 1.2 Handle Missing Dependencies

For each missing dependency, decide whether the workflow already has enough user intent to proceed:

Typical outcomes:
- `uv` → safe auto-install path; after explicit `$spec-mcp-setup` / `/spec:mcp-setup`, install or repair directly unless the script reports a destructive or privileged step
- `jq` → package-manager install path; ask before privileged package-manager writes
- `node` → gated auto-install path with PATH-risk warning; ask before changing Node/PATH

If the user declines installation, display manual instructions and stop.

### 1.3 Re-run Detection

After dependency installation, re-run the same platform dependency check.
If any required dependency is still missing, do not continue into host configuration.

---

## Phase 2: Readiness Facts

**Goal:** Build a machine-readable view of host + project readiness before installation.

### 2.1 Detect Host and Tool State

macOS/Linux:
```bash
bash skills/spec-mcp-setup/scripts/detect-tools.sh
```

Windows:
```powershell
pwsh -File skills/spec-mcp-setup/scripts/detect-tools.ps1
```

Expected output shape:

```json
{
  "host": "claude",
  "platform": "macos",
  "repo_root": "/path/to/repo",
  "overall_status": "partial",
  "baseline_ready": false,
  "tools": {
    "serena": {
      "required": true,
      "dependency_status": "ready",
      "host_config_status": "action-required",
      "project_status": "pending",
      "next_action": "configure host"
    }
  },
  "crg": {
    "cli_status": "ready",
    "native_modules_status": "ready"
  },
  "next_actions": ["bootstrap project"]
}
```

### 2.2 Interpret the Facts

`overall_status` is one of:
- `ready`
- `partial`
- `action-required`
- `failed`

`baseline_ready=true` means the required MCP baseline is ready across:
- dependency layer
- host config layer
- required project bootstrap layer

Per-tool fields explain where readiness stops:
- `dependency_status`
- `host_config_status`
- `selected_scope`
- `project_status`
- `next_action`

`host_config_status` meanings:
- `ready` — preferred target configured and effective
- `fallback-active` — Claude fell back from `managed-mcp.json` to `~/.claude.json`, but the baseline is still usable
- `precedence-blocked` — Codex user config exists, but a higher-precedence config file may override it
- `action-required` — no usable host config detected

`crg.cli_status` and `crg.native_modules_status` remain downstream machine facts for graph bootstrap decisions. Native module detection must resolve `better-sqlite3` and `tree-sitter` from the real `spec-first` CLI installation context, not from the caller's current working directory. A current-directory bare `require()` can misreport global installs as missing.

For Route B host selection, `detect-host.*` also exposes:
- target map and writable facts
- fallback order
- uninstall targets
- configured path for this run
- Codex precedence-blocked facts

These stay machine-readable only; the workflow still keeps a single registry in `mcp-tools.json`.

---

## Phase 3: Installer Pipeline

**Goal:** Run deterministic install/configure/repair/bootstrap steps based on the readiness facts.

### 3.1 Run the Installer

macOS/Linux:
```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh
```

Windows:
```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1
```

The pipeline layers are:
- `install-mcp.*` — orchestration
- `configure-host.*` — host MCP config writes
- `repair-install.*` — deterministic repair path
- `activate-serena.*` — current-repo Serena bootstrap

The retired `install-coordinator.*` flow is not part of this workflow anymore.

### 3.2 Optional Tools

In `quick` mode, install the required baseline only.

In `custom` mode, ask which optional tools to include, then rerun the same installer pipeline with the selected tool ids passed explicitly.

For example, if the user selects Playwright MCP:

macOS/Linux:
```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh --install playwright
```

Windows:
```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1 -Install playwright
```

Do not treat optional-tool selection as implied by `custom` mode alone; pass the chosen optional tool ids into `install-mcp.*` explicitly.

### 3.3 Host Config Writing

`configure-host.*` writes the selected tool into the host config selected by `detect-host.*`:
- Claude Code → prefer official `managed-mcp.json`, fall back to `~/.claude.json` when the managed target is not writable
- Codex → write `~/.codex/config.toml`, but also surface Unix `/etc/codex/config.toml` precedence facts

The write result must expose:
- `configured_path`
- `selected_scope`
- `fallback_applied`

Keep host-specific path resolution, fallback logic, uninstall target handling, and same-name replacement logic in scripts, not in the prose.

### 3.3a Uninstall Path

Route B adds a deterministic uninstall path:
- macOS/Linux: `bash skills/spec-mcp-setup/scripts/uninstall-mcp.sh [--tool <tool-id>]`
- Windows: `pwsh -File skills/spec-mcp-setup/scripts/uninstall-mcp.ps1 [-Tool <tool-id>]`

Uninstall removes the named MCP entry from every declared uninstall target for the current host. It does not introduce a second registry.

If no tool id is passed, uninstall removes all tools declared in `mcp-tools.json` for the current host.

Keep uninstall bounded to host config cleanup only; it must not delete repo bootstrap files or invent extra cleanup heuristics.

### 3.3b Preferred Target Semantics

For Claude Code:
- preferred target = managed MCP config
- fallback target = user config
- `fallback-active` still counts as usable baseline when required tools and project bootstrap are ready

For Codex:
- write target = user config
- higher-precedence Unix config is advisory-only machine fact
- `precedence-blocked` means the user config entry exists but may not be effective

Do not collapse these distinctions into a single boolean.

### 3.3c Managed Path Notes

Claude managed MCP target paths:
- macOS: `/Library/Application Support/ClaudeCode/managed-mcp.json`
- Linux / WSL: `/etc/claude-code/managed-mcp.json`
- Windows: `C:\Program Files\ClaudeCode\managed-mcp.json`

Codex precedence note:
- Unix may also have `/etc/codex/config.toml`
- Route B surfaces this as precedence fact instead of guessing whether user config is authoritative

Keep `managed-mcp.json` and `/etc/codex/config.toml` wording aligned across source docs, mirrors, tests, and reference.

Keep host-specific wrapping logic there, not in the prose.

### 3.3d Context7 Note

Context7 remains part of the same unified installer metadata source and continues to use `@upstash/context7-mcp` in the deterministic pipeline. Do not split it into a second setup flow.

### 3.3e Verify the Write Surface

After `configure-host.*`, the workflow should be able to explain:
- where it wrote
- whether fallback happened
- whether a higher-precedence file exists
- whether uninstall will need to clean one target or multiple targets

These are Route B machine facts, not human-only summary text.

### 3.3f Do Not Add A Second Registry

Do not add:
- a second uninstall registry
- a separate managed-path catalog
- a parallel host-target metadata file
- a Context7-only installer definition

All of these facts stay inside `skills/spec-mcp-setup/mcp-tools.json`.

### 3.3g Host Config Status Projection

When summarizing readiness:
- `ready` and `fallback-active` both mean the write path succeeded
- `precedence-blocked` means human attention is required before claiming the config is effective
- `action-required` means the host config layer is still missing or invalid

This projection belongs in `detect-tools.*` / `verify-tools.*`, not in a second rule engine.

### 3.3h Bounded Repair

`repair-install.*` may reuse the same host facts and rerun `configure-host.*`, but should not start open-ended filesystem surgery or guess undocumented host paths.

### 3.3i Table Output Contract

When showing final machine-derived summary, keep the existing columns:

```text
Tool | Required | Dependency | Host Config | Project Bootstrap | Result | Next Action
```

The `Host Config` column may now contain `ready`, `fallback-active`, or `precedence-blocked`.

### 3.3j Downstream Compatibility

Downstream consumers such as graph bootstrap should keep reading the readiness ledger v1 shape, but now interpret the richer `host_config_status` values rather than assuming only `ready` / `action-required`.

### 3.3k Verify Current Host Marker Stability

Even with Route B changes, keep the readiness ledger marker paths stable:
- Claude Code: `~/.claude/spec-first/host-setup.json`
- Codex: `~/.codex/spec-first/host-setup.json`

Do not move marker paths just because host config targets changed.

### 3.3l Summary Rule

The workflow may prefer the managed target, fall back to user target, and expose precedence facts, but it still reports one deterministic selected write target per run.

Keep host-specific wrapping logic there, not in the prose.

### 3.4 Repair Path

If deterministic install or configure fails:
1. Call `repair-install.*` for the same tool
2. If repair succeeds, continue and mark the tool as repaired
3. If repair fails, return structured facts and stop claiming completion

Unknown failures should surface bounded facts and next actions; do not hard-code open-ended shell heuristics.

### 3.5 Serena Current-Repo Bootstrap

After Serena host config is ready, run `activate-serena.*`.

Success means the current repo now has Serena project metadata (for example `.serena/project.yml`) and an explicit ready marker for the latest successful index refresh (currently `.serena/index-ready.json`).

If Serena host config is ready but repo bootstrap is still pending or the latest index refresh failed, the host remains only partially ready.

`tools.serena.project_status` uses these states:
- `pending` — project metadata is missing
- `failed` — project metadata exists but the latest index-ready marker is missing
- `ready` — project metadata and the latest index-ready marker both exist

Do not treat `.serena/project.yml` alone as proof that Serena bootstrap is complete.

### 3.5a Warmup Command

For tools whose metadata declares `installation.kind = warmup`, `install-mcp.*` runs the metadata-defined warmup command before host config writes. If warmup fails, stop claiming success and surface bounded failure facts.

### 3.5b Serena Current-Repo Bootstrap Failure Boundary

`activate-serena.*` must fail when the Serena index command fails. It may create project metadata before attempting the index, but it must not report bootstrap success unless the index-ready marker is written.

If Serena bootstrap fails after host config is already ready, mark the run as partial rather than silently downgrading the repo to "ready".

If Serena host config is ready but repo bootstrap is still pending, the host remains only partially ready.

### 3.6 Atomic Host Update

When `configure-host.*` writes host config:
1. Back up the current host config
2. Acquire a lock
3. Write the selected MCP entry
4. Re-read the host config and verify the entry
5. Release the lock
6. Restore from backup on failure

Do not reintroduce the old `install-coordinator.*` abstraction to preserve this behavior.

---

## Phase 4: Final Readiness Ledger

**Goal:** Write the single machine-truth ledger for the current host after installation.

### 4.1 Write the Ledger

macOS/Linux:
```bash
bash skills/spec-mcp-setup/scripts/verify-tools.sh
```

Windows:
```powershell
pwsh -File skills/spec-mcp-setup/scripts/verify-tools.ps1
```

The final ledger answers:
- Is the required baseline ready?
- Which tool is pending and why?
- Has Serena bootstrapped the current repo?
- Is CRG usable on this machine?

Do not ask for confirmation before re-running `detect-tools.*` or `verify-tools.*`; they are deterministic fact collection / ledger write steps for the active setup workflow. Ask before privileged installs, optional-tool selection, destructive cleanup, or ambiguous project config writes.

### 4.2 Ledger Semantics

`baseline_ready=true` means the required MCP baseline is ready.

`overall_status` is one of:
- `ready`
- `partial`
- `action-required`
- `failed`

`next_actions[]` is the machine-truth next-step list that the human summary should project. It must aggregate repo-level blockers (for example CRG CLI/native-module issues) and each tool's non-empty `next_action` without duplicates.

### 4.3 Completion Rule

If `verify-tools.*` exits non-zero:
- report the failure facts
- do not claim setup is complete

If `baseline_ready=false` after verification:
- report which required tools or repo bootstrap steps are still pending
- do not claim setup is complete

If only optional tools remain absent:
- report them as skipped or pending
- continue when the baseline is ready

---

## Verification

After all installations:

1. Re-run the platform readiness facts script — the host should reflect the new state
2. Verify the current host config contains the expected entries for required tools
3. Read the readiness ledger and confirm `baseline_ready == true` when setup is complete
4. Display a table derived from the ledger with these columns:

```text
Tool | Required | Dependency | Host Config | Project Bootstrap | Result | Next Action
```

Recommended next steps after success:
1. Restart the current host when needed to load the new MCP configuration
2. Run the current host's graph bootstrap entrypoint (`/spec:graph-bootstrap` or `$spec-graph-bootstrap`)

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Dependency missing and user declines install | Show manual instructions, exit |
| Deterministic install/configure fails but repair can resolve it | Run `repair-install.*`, continue, mark tool as repaired |
| Deterministic install/configure fails and repair cannot resolve it | Return structured failure facts, stop claiming completion |
| Current host config doesn't exist | Create the host-specific config file through the installer path |
| Serena repo bootstrap is still pending | Mark host as partial, surface `next_action` |
| `jq` not available | Require jq, show install instructions |

---

## Scope Boundaries

**Includes:**
- MCP tool dependency detection, installation, host configuration, repair, and verification
- Serena current-repo bootstrap
- CRG CLI availability and native module health facts
- User interaction and progress feedback
- macOS/Linux/WSL/Windows support

**Excludes:**
- MCP tool update/upgrade
- Custom MCP tool configuration parameters outside the tool registry
- Tools not in the active installer metadata source
- Open-ended auto-debug loops inside shell / PowerShell scripts

Route B now includes bounded MCP tool uninstallation via `uninstall-mcp.*`.

---

## Appendix: readiness ledger schema

The readiness ledger is host-specific:

- Claude Code: `~/.claude/spec-first/host-setup.json`
- Codex: `~/.codex/spec-first/host-setup.json`

### Schema v1

```json
{
  "schema_version": "v1",
  "host": "claude",
  "platform": "macos",
  "repo_root": "/path/to/repo",
  "overall_status": "partial",
  "baseline_ready": false,
  "completed_at": "2026-04-22T12:00:00Z",
  "tools": {
    "serena": {
      "required": true,
      "dependency_status": "ready",
      "host_config_status": "ready",
      "project_status": "failed",
      "next_action": "bootstrap project"
    },
    "context7": {
      "required": true,
      "dependency_status": "ready",
      "host_config_status": "ready",
      "project_status": "not-applicable",
      "next_action": ""
    }
  },
  "crg": {
    "cli_status": "ready",
    "native_modules_status": "ready"
  },
  "next_actions": ["bootstrap project"]
}
```

### Consumers

| Field | Consumer | Purpose |
|------|--------|---------|
| `host` / `platform` | runtime host selector | pick the matching marker and host path |
| `overall_status` | spec-mcp-setup summary / graph-bootstrap gate | decide whether the host is ready, partial, or blocked |
| `baseline_ready` | graph-bootstrap host readiness | determine whether required MCP baseline is ready |
| `tools.<tool>.host_config_status` | graph-bootstrap / future skills | know whether the MCP entry is configured |
| `tools.<tool>.project_status` | Serena-aware workflows | know whether the current repo bootstrap is pending / failed / ready |
| `crg.cli_status` | graph-bootstrap Phase 0.2b | skip CRG operations when CLI is unavailable |
| `crg.native_modules_status` | graph-bootstrap Phase 0.2b | warn before attempting `crg build` |
| `next_actions[]` | spec-mcp-setup human summary | present the next deterministic steps |
| `completed_at` | stale detection | know when the ledger was last refreshed |

For full tool descriptions and host-specific notes, use `references/supported-mcp-tools.md`.

---

## References

- Supported tool catalog: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Tool metadata source: `skills/spec-mcp-setup/mcp-tools.json`
- Unix entrypoints: `install-mcp.sh`, `configure-host.sh`, `repair-install.sh`, `activate-serena.sh`, `verify-tools.sh`
- Windows entrypoints: `install-mcp.ps1`, `configure-host.ps1`, `repair-install.ps1`, `activate-serena.ps1`, `verify-tools.ps1`
- Downstream consumer: `skills/spec-graph-bootstrap/SKILL.md`
- Runtime command metadata: `templates/claude/commands/spec/mcp-setup.md`

Do not refer users to `install-coordinator.*`; it is a retired implementation.
