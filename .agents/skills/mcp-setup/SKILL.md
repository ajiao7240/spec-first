---
name: mcp-setup
description: "One-click MCP tools installation and configuration for spec-first workflows. Installs Serena, GitNexus, ABCoder, Sequential Thinking, Context7 (required) and Playwright MCP (optional)."
argument-hint: "[quick|custom]"
user-invocable: false
---

# MCP Tools Setup

Install and configure MCP tools needed for spec-first Full mode.

**Claude entry point:** `/spec:mcp-setup [quick|custom]`
**Codex entry point:** Not yet supported

## Overview

This skill automates the installation and configuration of MCP tools required by spec-first workflows:

| Tool | Category | Purpose |
|------|----------|---------|
| Serena | Required | Symbol-level precision editing (spec-bootstrap Enhanced/Full mode) |
| GitNexus | Required | Code knowledge graph / architecture engine (spec-bootstrap Full mode) |
| ABCoder | Required | Cross-language semantic enhancement (binary only, AST configured at spec-bootstrap) |
| Sequential Thinking | Required | Dynamic reflective problem solving (universal dependency) |
| Context7 | Required | Latest framework documentation query (universal dependency) |
| Playwright MCP | Optional | Frontend automation testing |

**Actual flow:** `/spec:mcp-setup` (install + configure) → restart Claude Code → `/spec:bootstrap` (ABCoder auto-config, if needed) → done.

## Configuration

Tool metadata is defined in `skills/mcp-setup/mcp-tools.json`. Each tool entry includes:
- `id`, `name`, `category` (required/optional)
- `dependencies` (node/go/uv)
- `mcp_config` (command + args for MCP server registration, null if not applicable)
- `install_command` (binary install command, for tools like ABCoder)
- `detect` (detection method and parameters)

---

## Phase 1: Dependency Detection

**Goal:** Detect prerequisites (Node.js, Go, uv, jq) and auto-install with user consent.

### 1.1 Run Dependency Check

```bash
bash skills/mcp-setup/scripts/check-deps.sh
```

This script outputs JSON with the status of each dependency:

```json
{
  "node": { "installed": true, "version": "v20.11.0" },
  "go": { "installed": false, "install_suggestion": { "command": "...", "safety": "gated_auto" } },
  "uv": { "installed": true, "version": "uv 0.4.0" },
  "jq": { "installed": true, "version": "jq-1.7" }
}
```

### 1.2 Handle Missing Dependencies

For each missing dependency, use AskUserQuestion to ask the user whether to auto-install:

**Safety tiers:**

| Dependency | Safety | Behavior |
|------------|--------|----------|
| uv | safe_auto | Direct install: `curl -LsSf https://astral.sh/uv/install.sh \| sh` — installs to `~/.cargo/bin/`, no sudo needed |
| jq | safe_auto | Package manager install: `brew install jq` / `apt install jq` — no version conflicts |
| Node.js | gated_auto | Install via fnm — show risk hint: "may conflict with system Node.js" |
| Go | gated_auto | Install to user directory — show risk hint: "requires PATH configuration" |

**Auto-install commands:**

- **uv:** `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **jq:** `brew install jq` (macOS) / `sudo apt-get install -y jq` (Linux)
- **Node.js via fnm:** `curl -fsSL https://fnm.vercel.app/install | bash && export FNM_PATH="$HOME/.fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm install --lts`
- **Go:** Fetch latest stable version from `https://go.dev/dl/?mode=json`, download to `~/.local/go`, add to PATH

If the user declines auto-install, display manual installation instructions and exit.

### 1.3 Verify Dependencies

After auto-install or when all dependencies are present, re-run `check-deps.sh` to verify. If any dependency is still missing, display instructions and exit.

---

## Phase 2: Quick Install + Configuration Merge

**Goal:** Install all required tools and write their MCP configurations to `~/.claude.json`.

### 2.1 Detect Existing Tools

```bash
bash skills/mcp-setup/scripts/detect-tools.sh
```

This reads `~/.claude.json` and checks for existing tool configurations. Output:

```json
{
  "installed": ["serena", "context7", "sequential-thinking"],
  "missing": ["gitnexus", "abcoder"]
}
```

### 2.2 Install Required Tools

For each missing required tool (category="required"):

1. **Tools with `install_command`** (e.g., ABCoder): execute the install command
2. **Tools with `mcp_config` only** (e.g., Serena, GitNexus, Sequential Thinking, Context7): no binary install needed — npx/uvx handles this at runtime

Display progress in real-time:
```
⏳ Installing ABCoder...
✅ ABCoder installed (go install)
⏳ Configuring GitNexus...
✅ GitNexus configured
```

Skip tools already installed (idempotent).

### 2.3 Configuration Merge

**Atomic write with concurrent safety:**

1. **Backup:** `cp ~/.claude.json ~/.claude.json.backup.<timestamp>` with `chmod 600`
2. **Lock:** `flock ~/.claude.json.lock` (Linux/macOS) — fallback to timestamp warning if flock unavailable
3. **Merge:** Use `jq` to incrementally add only missing `mcpServers` entries:
   ```bash
   jq --argjson config "$TOOL_CONFIG" '.mcpServers += $config | .mcpServers' ~/.claude.json
   ```
4. **Validate:** `jq . < tmpfile` — verify JSON validity
5. **Atomic replace:** Write to temp file → validate → `mv` (POSIX atomic)
6. **Unlock:** Release flock

**Idempotent:** Existing mcpServers entries are never overwritten.

On failure, restore from backup and report error.

---

## Phase 3: Optional Tools

**Goal:** Offer optional tools after required tools are installed.

### 3.1 Prompt for Optional Tools

Use AskUserQuestion to ask:

"Required tools installed successfully. Would you like to install optional tools?"

Available optional tools (from mcp-tools.json where category="optional"):
- Playwright MCP — Frontend automation testing

If the user selects tools, run the same install + configure flow from Phase 2.

### 3.2 Skip in Non-Interactive Mode

If argument is `quick`, skip optional tool prompts entirely.

---

## Verification

After all installations:

1. Re-run `detect-tools.sh` — all required tools should appear as installed
2. Verify `~/.claude.json` contains all required mcpServers entries
3. Display summary:
```
✅ MCP Tools Setup Complete

Installed: Serena, GitNexus, ABCoder, Sequential Thinking, Context7
Skipped (already present): [list]
Optional: Playwright MCP [installed / not installed]

⚠️  Please restart Claude Code for changes to take effect.
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Dependency missing and user declines install | Show manual instructions, exit |
| Single tool install fails | Continue with other tools, report failure at end |
| Configuration merge fails | Restore from backup, report error |
| `~/.claude.json` doesn't exist | Create initial structure `{"mcpServers": {}}` |
| jq not available | Require jq, show install instructions (jq is a hard dependency) |

---

## Scope Boundaries

**Includes:**
- MCP tool installation and configuration (6 tools)
- Installation status detection and verification
- User interaction and progress feedback
- macOS/Linux support

**Excludes:**
- MCP tool uninstallation
- MCP tool update/upgrade
- Custom MCP tool configuration parameters
- Tools not in mcp-tools.json
- Windows support (Phase 2)
- Custom install mode with individual tool selection (Phase 2)
