---
name: setup
description: "Use when diagnosing or fixing a spec-first environment, bootstrapping repo-local `.spec-first/config.local.yaml`, checking workflow helper tools, or handing off to MCP setup."
disable-model-invocation: true
---

# Spec-First Setup

Diagnose and configure the spec-first environment for the current machine and repository.

**Claude entry point:** `/spec:setup`
**Codex entry point:** `$setup`

## Overview

This workflow is the unified setup entrypoint for:

- repo-local config bootstrap under `.spec-first/`
- helper tool diagnostics (`agent-browser`, `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`)
- legacy Compound Engineering cleanup guidance
- MCP setup handoff via 当前宿主对应的 `mcp-setup` 入口（Claude: `/spec:mcp-setup`；Codex: `$spec-mcp-setup`）

Do not inline the MCP installation flow here. `setup` owns the repo/tooling diagnosis and project config bootstrap; `spec-mcp-setup` owns host-level MCP installation and verification.

## Interaction Rules

Ask before any destructive or machine-wide action.

- Never auto-delete legacy files without confirmation.
- Never auto-install tools without confirmation.
- Never silently modify `.gitignore`; ask first.
- Always show the diagnostic output from `scripts/check-health` before proposing fixes.

## Phase 1: Diagnose

### Step 1: Determine Current Version When Available

If you can cheaply determine the current `spec-first` version from local runtime metadata, pass it to the health script with `--version`. If not, skip the flag.

Examples of acceptable sources:

- current package metadata
- current managed runtime state under `.claude/spec-first/` or `.codex/spec-first/`

If the version is ambiguous, omit it.

### Step 2: Run the Health Check Script

Before running the script, tell the user:

`Spec-First -- checking your environment...`

Run:

```bash
bash scripts/check-health --version VERSION
```

Or without the version when Step 1 could not determine it:

```bash
bash scripts/check-health
```

Display the script output to the user verbatim.

### Step 3: Evaluate the Report

If the report shows no actionable issues, summarize briefly:

```text
✅ Spec-First setup complete

Tools: [healthy helper tools from the report]
Config: ✅

Run the current host's setup entrypoint anytime to re-check.
```

If the user also needs MCP-backed workflows such as `spec-graph-bootstrap` Enhanced mode, Serena-backed symbol editing, or Context7 lookup, append:

`Next: run the current host's mcp-setup entrypoint`

Stop here.

Otherwise continue to Phase 2 in this order:

1. legacy cleanup
2. repo-local config bootstrap
3. helper tool installation
4. MCP handoff if needed

## Phase 2: Fix

### Step 4: Resolve Legacy Compound Engineering State

Resolve the repository root with:

```bash
git rev-parse --show-toplevel
```

If `compound-engineering.local.md` exists at the repo root, explain that it is obsolete and ask whether to delete it now.

If `.compound-engineering/config.local.yaml` exists, explain that spec-first reads `.spec-first/config.local.yaml` instead. Do not delete the legacy CE config automatically; only note that it is legacy unless the user explicitly asks to remove it.

### Step 5: Bootstrap Repo-Local Config

All paths below are relative to the repository root.

**Example config (always refresh):**

- Ensure `<repo-root>/.spec-first/` exists.
- Copy `references/config-template.yaml` to `<repo-root>/.spec-first/config.local.example.yaml`.
- Always overwrite the example file so the repo advertises the latest available settings.

**Local config (create once):**

If `<repo-root>/.spec-first/config.local.yaml` does not exist, ask whether to create it.

If the user approves, copy `references/config-template.yaml` to `<repo-root>/.spec-first/config.local.yaml`.

If `.spec-first/config.local.yaml` is not safely gitignored, offer to add this entry to the repo root `.gitignore`:

```text
.spec-first/*.local.yaml
```

If the local config already exists, do not overwrite it. Only refresh the example file and fix `.gitignore` coverage if the user approves.

### Step 6: Offer Helper Tool Installation

Use the missing tool list from `scripts/check-health`.

Present only tools that are actually missing:

- `agent-browser` -- browser automation used by browser-heavy workflows
- `gh` -- GitHub CLI used by review / changelog / bug flows
- `jq` -- required by setup scripts and MCP tooling
- `vhs` -- terminal capture for demo/video workflows
- `silicon` -- code screenshot generation
- `ffmpeg` -- media processing for feature demos

For each selected tool:

1. Show the install command from the health report.
2. Ask for approval.
3. Run the command only if the user approves.
4. Verify with `command -v <tool>` or the tool-specific verification command.
5. If verification fails, show the fallback project URL from the report and continue.

### Step 7: Hand Off to MCP Setup When Needed

If the user needs MCP-backed workflows or the health conversation reveals missing MCP prerequisites, hand off explicitly:

- Claude: `Run /spec:mcp-setup` for the full guided flow
- Codex: `Run $spec-mcp-setup` for the full guided flow
- Claude: `Run /spec:mcp-setup quick` when the user wants the baseline path without optional prompts
- Codex: `Run $spec-mcp-setup quick` when the user wants the baseline path without optional prompts

Do not re-implement `spec-mcp-setup` inside this skill.

## Repo-Local Config Contract

The repo-local config file is:

`<repo-root>/.spec-first/config.local.yaml`

The committed example file is:

`<repo-root>/.spec-first/config.local.example.yaml`

Current supported keys are defined in `references/config-template.yaml` and must remain aligned with `spec-work-beta`'s delegation contract.

## Verification

Before declaring success:

1. Re-run `bash scripts/check-health`
2. Confirm repo-local config warnings are gone or explicitly accepted by the user
3. If MCP setup was requested, stop after the handoff and let the current host's `mcp-setup` entrypoint own host-level verification

## Boundaries

**Includes:**

- helper tool diagnostics
- `.spec-first/config.local.yaml` bootstrap
- `.spec-first/config.local.example.yaml` refresh
- legacy CE cleanup guidance
- MCP setup handoff

**Excludes:**

- host-level MCP installation logic
- deleting legacy CE config directories without explicit user approval
- overwriting an existing `.spec-first/config.local.yaml`
