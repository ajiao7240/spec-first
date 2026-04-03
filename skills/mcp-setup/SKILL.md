---
name: mcp-setup
description: "One-click MCP tools installation and configuration for spec-first workflows. Installs Serena, GitNexus, ABCoder, Sequential Thinking, Context7 (required) and Playwright MCP (optional)."
argument-hint: "[quick|custom]"
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
| ABCoder | Required | Cross-language semantic enhancement (binary + MCP config installed here; AST generated at spec-bootstrap) |
| Sequential Thinking | Required | Dynamic reflective problem solving (universal dependency) |
| Context7 | Required | Latest framework documentation query (universal dependency) |
| Playwright MCP | Optional | Frontend automation testing |

**Actual flow:** `/spec:mcp-setup` (install + configure all tools including ABCoder MCP) → restart Claude Code → `/spec:bootstrap` (project analysis + ABCoder AST generation) → done.

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

## Phase 4: Host Verification

Run after Phase 3 to record host-level install state and configure ABCoder MCP server.

### 4.1 Write Host Readiness Marker

Run `skills/mcp-setup/scripts/verify-tools.sh` to validate host-level install state
and write `~/.claude/spec-first/host-setup.json`.

If `verify-tools.sh` exits non-zero (e.g., cannot write marker file):
- Report the failure with the script's error output
- Do not claim setup is complete

### 4.2 Configure ABCoder MCP Server

ABCoder is installed as a binary only (no MCP config written by install-coordinator.sh).
After verifying the binary exists, write its MCP server config to `~/.claude.json`.

If `abcoder` binary is installed (`abcoder version` succeeds) and `mcpServers.abcoder`
is not yet configured in `~/.claude.json`:

```bash
ABCODER_AST="${HOME}/.claude/abcoder-ast"
mkdir -p "$ABCODER_AST"
tmp=$(mktemp "${HOME}/.claude/.claude.json.XXXXXX")
jq --arg dir "$ABCODER_AST" \
  '.mcpServers.abcoder = {"command":"abcoder","args":["mcp",$dir]}' \
  "${HOME}/.claude.json" > "$tmp" && chmod 600 "$tmp" && mv "$tmp" "${HOME}/.claude.json"
```

Skip if already configured (idempotent). Skip silently if `abcoder` binary is absent.

### 4.3 Language Environment Preflight

检测宿主语言运行时状态，对已知问题执行预防性修复。

#### 4.3.1 读取 host-setup.json

解析 `~/.claude/spec-first/host-setup.json` 中的字段：

- `language_runtime.go.present` — Go 运行时是否可用
- `language_runtime.python.present` — Python 运行时是否可用
- `jdt_cache.writable` — JDT 缓存目录是否可写（仅 abcoder 已安装 + Java 存在时有意义）
- `jdt_cache.path` — JDT 缓存路径（诊断用）
- `jdt_cache.reason` — 不可写原因

#### 4.3.2 JDT 缓存权限修复（仅当 abcoder 已安装 + Java 存在 + 缓存不可写）

**触发条件：** `jdt_cache.writable == false` AND `jdt_cache.reason == "not-writable"` 或 `"parent-not-writable"`

**根因：** ABCoder v0.3.1 违反 Go module cache 只读规范，尝试在 `go/pkg/mod/` 下创建 JDT 缓存目录（`jdtls`）。

**执行策略：**

1. 检测到 `jdt_cache.reason == "not-writable"` 时，输出诊断信息：

```
⚠️ ABCoder JDT 缓存目录权限不足（已知 bug）
   路径: <jdt_cache.path>
   原因: Go module cache 目录只读，abcoder 尝试写入 JDT 缓存失败
   影响: Java 项目无法使用 ABCoder AST 分析（将降级到 Serena Enhanced 模式）

   修复命令（推荐执行）:
   chmod -R u+w <jdt_cache.path 的父目录>
```

2. 使用 AskUserQuestion 询问用户是否执行修复
3. 用户确认后执行：`chmod -R u+w "$(dirname "$JDT_CACHE_PATH")"`
4. 修复后重新运行 `verify-tools.sh` 刷新 `host-setup.json`

#### 4.3.3 重新验证

修复完成后重新运行 `verify-tools.sh`，确认 `jdt_cache.writable == true`。

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

Host readiness:
- dependencies: ready
- mcp config: ready
- tool binaries: ready
- language runtimes: go=<version>, python=<version>, java=<version>
- JDT cache: writable ✓  (or "needs fix — see above")
- host marker: written (~/.claude/spec-first/host-setup.json)

Next steps:
1. Restart Claude Code (required to load new MCP configuration)
2. Run /spec:bootstrap
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
- Runtime MCP server availability verification (handled by spec-bootstrap at project-level probe)

---

## Appendix: host-setup.json Schema

`~/.claude/spec-first/host-setup.json` 是 mcp-setup 和 spec-bootstrap 之间的协调数据文件。

### Schema v2

```json
{
  "version": "2",
  "completed_at": "2026-04-03T12:00:00Z",
  "setup_success": true,
  "tools": {
    "abcoder":  { "installed": true,  "binary_ok": true },
    "gitnexus": { "configured": true },
    "serena":   { "configured": true },
    "context7": { "configured": true }
  },
  "java_runtime": { "present": true, "reason": "ok" },
  "language_runtime": {
    "go":     { "present": true,  "reason": "ok", "version": "go1.22.0" },
    "python": { "present": true,  "reason": "ok", "version": "3.12.0" }
  },
  "jdt_cache": {
    "writable": true,
    "path": "/Users/xxx/go/pkg/mod/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp/jdtls",
    "reason": "writable"
  }
}
```

> **注意：** Java 运行时信息保留在顶层 `java_runtime` 字段（v1 兼容），Go/Python 运行时在 `language_runtime` 下。这是历史遗留的结构差异，v1 消费方不受影响。

### 消费方

| 字段 | 消费方 | 用途 |
|------|--------|------|
| `setup_success` | spec-bootstrap Host Readiness Gate Step 1 | 判断 mcp-setup 是否已完成 |
| `tools.*.configured` | spec-bootstrap Phase 1.3 probe | 跳过已知不可用的工具 |
| `java_runtime.present` | spec-bootstrap ABCoder probe Step 2c | Java runtime 预检 |
| `language_runtime.*` | spec-bootstrap ABCoder probe Step 2c | 语言 runtime 预检（仅诊断用） |
| `jdt_cache.writable` | spec-bootstrap Host Readiness Gate Step 2b + ABCoder probe Step 2c | JDT 缓存预警 |
| `jdt_cache.reason` | mcp-setup Phase 4.3 | JDT 修复诊断 |

### 向后兼容

- v1 字段（`version`, `setup_success`, `tools`, `java_runtime`）保持不变
- v2 新增字段（`language_runtime`, `jdt_cache`）对 v1 消费方透明
- spec-bootstrap 应容忍 v1 格式（缺少新字段时使用默认值）
