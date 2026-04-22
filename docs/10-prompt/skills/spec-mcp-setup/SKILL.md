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

The active host is detected automatically. Claude Code writes user-scoped MCP config to `~/.claude.json`; Codex writes user-scoped MCP config to `~/.codex/config.toml`. The host readiness ledger is written to the current host's `spec-first/host-setup.json` marker path.

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

For each missing dependency, ask whether to install it.

Typical outcomes:
- `uv` → safe auto-install path
- `jq` → package-manager install path
- `node` → gated auto-install path with PATH-risk warning

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
- `project_status`
- `next_action`

`crg.cli_status` and `crg.native_modules_status` remain downstream machine facts for graph bootstrap decisions.

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

`configure-host.*` writes the selected tool into the host config:
- Claude Code → `~/.claude.json`
- Codex → `~/.codex/config.toml`

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

### 4.2 Ledger Semantics

`baseline_ready=true` means the required host baseline is ready.

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
- MCP tool uninstallation
- MCP tool update/upgrade
- Custom MCP tool configuration parameters outside the tool registry
- Tools not in the active installer metadata source
- Open-ended auto-debug loops inside shell / PowerShell scripts

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
