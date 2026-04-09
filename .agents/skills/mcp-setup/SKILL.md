---
name: mcp-setup
description: "Use when installing MCP tools for a Claude Code, Codex, or Windows PowerShell session and the host-specific MCP config needs to be detected, configured, or verified."
argument-hint: "[quick|custom]"
---

# MCP Tools Setup

Install and configure the MCP tools needed by spec-first workflows.

**Claude entry point:** `/spec:mcp-setup [quick|custom]`
**Codex entry point:** `/spec:mcp-setup [quick|custom]`
If you invoke the skill directly inside a Codex session, `$spec-mcp-setup [quick|custom]` still works.

## Overview

This skill automates the installation and configuration of the MCP tools used by spec-first:

| Tool | Category | Purpose |
|------|----------|---------|
| Serena | Required | Symbol-level precision editing for spec-bootstrap Enhanced mode |
| Sequential Thinking | Required | Dynamic reflective problem solving |
| Context7 | Required | Latest framework documentation lookup |
| Playwright MCP | Optional | Frontend automation testing |

The active host is detected automatically. Claude Code writes to `~/.claude.json` and `~/.claude/spec-first/host-setup.json`; Codex writes to `~/.codex/config.toml` and `~/.codex/spec-first/host-setup.json`.
If both CLIs are present and no host hint is available, set `MCP_SETUP_HOST=claude|codex` explicitly; the skill will not guess.

Platform entrypoints:
- macOS/Linux: use the `*.sh` scripts with `bash`
- Windows: use the matching `*.ps1` scripts with `pwsh` 7+

**Actual flow:** `/spec:mcp-setup` → restart the active host → `/spec:bootstrap` → done.

## Configuration

Tool metadata is defined in `skills/mcp-setup/mcp-tools.json`. Each tool entry includes:
- `id`, `name`, `category`
- `dependencies` (node / uv)
- `mcp_config` (command + args for MCP server registration; host placeholders such as `__HOST_CONTEXT__` are resolved at install time)
- `detect` (detection method and parameters)

---

## Phase 1: Dependency Detection

**Goal:** Detect prerequisites (`node`, `uv`, `jq`) and auto-install with user consent.

### 1.1 Run Dependency Check

```bash
bash skills/mcp-setup/scripts/check-deps.sh
```

Windows:
```powershell
pwsh -File skills/mcp-setup/scripts/check-deps.ps1
```

This script outputs JSON with the status of each dependency:

```json
{
  "node": { "installed": true, "version": "v20.11.0" },
  "uv": { "installed": true, "version": "uv 0.4.0" },
  "jq": { "installed": true, "version": "jq-1.7" }
}
```

### 1.2 Handle Missing Dependencies

For each missing dependency, ask the user whether to auto-install:

| Dependency | Safety | Behavior |
|------------|--------|----------|
| uv | safe_auto | Direct install: `curl -LsSf https://astral.sh/uv/install.sh | sh` |
| jq | safe_auto | Package manager install: `brew install jq` / `apt install jq` |
| Node.js | gated_auto | Install via fnm with a PATH-risk warning |

If the user declines auto-install, display manual installation instructions and exit.

### 1.3 Verify Dependencies

After auto-install or when all dependencies are present, rerun the matching platform dependency script. If any dependency is still missing, display instructions and exit.

---

## Phase 2: Quick Install + Configuration Merge

**Goal:** Install all required tools and write their MCP configurations to the current host's MCP config.

Windows:
```powershell
pwsh -File skills/mcp-setup/scripts/install-coordinator.ps1
```

### 2.1 Detect Existing Tools

```bash
bash skills/mcp-setup/scripts/detect-tools.sh
```

Windows:
```powershell
pwsh -File skills/mcp-setup/scripts/detect-tools.ps1
```

Expected output shape:

```json
{
  "installed": ["serena", "context7", "sequential-thinking"],
  "missing": []
}
```

### 2.2 Install Required Tools

For each missing required tool, write its `mcp_config` into the current host config:
- Claude Code: `~/.claude.json`
- Codex: `~/.codex/config.toml`

Display progress in real time:
```
🧭 我会先检查当前宿主的配置，再逐个补齐缺失工具。
⏳ Configuring Serena...
✅ Serena configured
⏳ Configuring Context7...
✅ Context7 configured
```

Tools with `mcp_config` only do not need a binary install step.
Skip already configured tools.

### 2.3 Configuration Merge

Use an atomic host-aware update:

1. Backup the current host config
2. Acquire a lock
3. Add only missing host-specific MCP entries with the host CLI
4. Verify the entry is present after the command returns
5. Restore the backup if configuration fails
6. Release the lock

Existing entries must never be overwritten.

---

## Phase 3: Optional Tools

Offer optional tools only after required tools are installed.

### 3.1 Prompt for Optional Tools

Ask whether to install optional tools.

Available optional tool:
- Playwright MCP

If the user selects it, run the same install + configure flow from Phase 2.

### 3.2 Skip in Non-Interactive Mode

If the argument is `quick`, skip optional prompts entirely.

---

## Phase 4: Host Verification

Run after Phase 3 to record host-level install state.

### 4.1 Write Host Readiness Marker

Run `skills/mcp-setup/scripts/verify-tools.sh` to validate host-level install state and write the current host's `spec-first/host-setup.json` marker.

Windows:
```powershell
pwsh -File skills/mcp-setup/scripts/verify-tools.ps1
```

The verification step will print the current host's baseline status and the final marker path so users can immediately tell whether they need to restart.

`setup_success` means the baseline host-level prerequisites are actually ready:
- `serena`, `context7`, `sequential-thinking` are configured in the current host config

If `verify-tools.sh` exits non-zero:
- Report the failure with the script's error output
- Do not claim setup is complete

If `setup_success == false` after verification:
- Report which baseline tools are still missing or misconfigured
- Do not claim setup is complete

If optional tools are missing after verification:
- Report that optional tools were skipped or unavailable
- Continue and treat setup as complete when baseline tools are ready

---

## Verification

After all installations:

1. Re-run the matching platform detection script — baseline tools should appear as installed
2. Verify the current host config contains baseline MCP entries (`serena`, `context7`, `sequential-thinking`)
3. Read the current host's `spec-first/host-setup.json` and confirm `setup_success == true`
4. Display summary:

```text
✅ MCP Tools Setup Complete

Installed: Serena, Sequential Thinking, Context7
Skipped (already present): [list]
Optional: Playwright MCP [installed / not installed]

Host readiness:
- dependencies: ready
- mcp config: ready
- host marker: written (current host's `spec-first/host-setup.json`)

Next steps:
1. Restart the current host (required to load new MCP configuration)
2. Run /spec:bootstrap
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Dependency missing and user declines install | Show manual instructions, exit |
| Single tool install fails | Continue with other tools, report failure at end |
| Configuration merge fails | Restore from backup, report error |
| Current host config doesn't exist | Create the host-specific config file via the host CLI |
| `jq` not available | Require jq, show install instructions |

---

## Scope Boundaries

**Includes:**
- MCP tool installation and configuration (3 required tools + 1 optional tool)
- Installation status detection and verification
- User interaction and progress feedback
- macOS/Linux/Windows support

**Excludes:**
- MCP tool uninstallation
- MCP tool update/upgrade
- Custom MCP tool configuration parameters
- Tools not in `mcp-tools.json`
- Runtime MCP server availability verification (handled by spec-bootstrap at project level)

---

## Appendix: host-setup.json Schema

The coordination file between mcp-setup and spec-bootstrap is host-specific:

- Claude Code: `~/.claude/spec-first/host-setup.json`
- Codex: `~/.codex/spec-first/host-setup.json`

### Schema v4

```json
{
  "version": "4",
  "host": "claude",
  "completed_at": "2026-04-08T12:00:00Z",
  "setup_success": true,
  "tools": {
    "serena": { "configured": true },
    "context7": { "configured": true },
    "sequential-thinking": { "configured": true }
  }
}
```

### Consumers

| Field | Consumer | Purpose |
|------|--------|------|
| `host` | spec-bootstrap Host Readiness Gate Step 0 | Select the matching runtime marker and probe path |
| `setup_success` | spec-bootstrap Host Readiness Gate Step 1 | Determine whether baseline host prerequisites are ready |
| `tools.*.configured` | spec-bootstrap runtime checks | Skip known-missing tools |
