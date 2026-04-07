#!/bin/bash
# install-coordinator.sh - Install MCP tools and merge configurations into ~/.claude.json
# Usage: install-coordinator.sh [--install <tool-ids>] [--skip <tool-ids>]
#   --install: comma-separated list of tool IDs to install (default: all required)
#   --skip: comma-separated list of tool IDs to skip

set -euo pipefail

# jq 是硬依赖
command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"

# 确保常用安装路径可用（Phase 1 安装的依赖可能未出现在当前 PATH）
export PATH="$HOME/.local/go/bin:$HOME/.cargo/bin:$HOME/.fnm/aliases/default/bin:$HOME/.local/bin:$PATH"
CLAUDE_JSON="$HOME/.claude.json"
LOCK_FILE="$HOME/.claude.json.lock"

# Parse arguments
INSTALL_FILTER=""
SKIP_FILTER=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --install)
      INSTALL_FILTER="$2"
      shift 2
      ;;
    --skip)
      SKIP_FILTER="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Convert comma-separated filters to arrays
if [ -n "$INSTALL_FILTER" ]; then
  IFS=',' read -ra INSTALL_ARRAY <<< "$INSTALL_FILTER"
else
  INSTALL_ARRAY=()
fi
if [ -n "$SKIP_FILTER" ]; then
  IFS=',' read -ra SKIP_ARRAY <<< "$SKIP_FILTER"
else
  SKIP_ARRAY=()
fi

should_install() {
  local tool_id="$1"
  local category="$2"

  # Check skip list
  for skip in ${SKIP_ARRAY[@]+"${SKIP_ARRAY[@]}"}; do
    if [ "$skip" = "$tool_id" ]; then
      return 1
    fi
  done

  # If install filter is specified, only install those
  if [ -n "$INSTALL_FILTER" ]; then
    for install in "${INSTALL_ARRAY[@]}"; do
      if [ "$install" = "$tool_id" ]; then
        return 0
      fi
    done
    return 1
  fi

  # Default: install required tools only
  if [ "$category" = "required" ]; then
    return 0
  fi

  return 1
}

# Backup ~/.claude.json with timestamp
backup_config() {
  if [ -f "$CLAUDE_JSON" ]; then
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup="$CLAUDE_JSON.backup.$timestamp"
    cp "$CLAUDE_JSON" "$backup"
    chmod 600 "$backup"
    echo "$backup"
  fi
}

# Ensure ~/.claude.json exists with minimal structure
ensure_config() {
  if [ ! -f "$CLAUDE_JSON" ]; then
    echo '{"mcpServers":{}}' > "$CLAUDE_JSON"
    chmod 600 "$CLAUDE_JSON"
  fi

  # Ensure mcpServers key exists
  if ! jq -e '.mcpServers' "$CLAUDE_JSON" >/dev/null 2>&1; then
    local tmp
    tmp=$(mktemp "${CLAUDE_JSON}.XXXXXX")
    jq '. + {"mcpServers": {}}' "$CLAUDE_JSON" > "$tmp" && chmod 600 "$tmp" && mv "$tmp" "$CLAUDE_JSON"
  fi
}

# Acquire file lock for concurrent safety
acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 200>"$LOCK_FILE" 2>/dev/null || { echo "⚠️  Cannot create lock file" >&2; return 1; }
    flock -w 10 200 || { echo "⚠️  Lock timeout, aborting" >&2; return 1; }
    return 0
  else
    # macOS fallback: use mkdir-based locking (atomic on most filesystems)
    local lock_dir="${CLAUDE_JSON}.lock.d"
    local attempts=0
    while ! mkdir "$lock_dir" 2>/dev/null; do
      # stale lock 检测：如果持有锁的进程已死，强制清理
      if [ -f "$lock_dir/pid" ]; then
        local lock_pid
        lock_pid=$(cat "$lock_dir/pid" 2>/dev/null)
        if [ -n "$lock_pid" ] && ! kill -0 "$lock_pid" 2>/dev/null; then
          rm -rf "$lock_dir" && continue
        fi
      fi
      attempts=$((attempts + 1))
      if [ $attempts -ge 100 ]; then
        echo "⚠️  Lock timeout, aborting" >&2
        return 1
      fi
      sleep 0.1
    done
    echo $$ > "$lock_dir/pid"
    LOCK_DIR="$lock_dir"
    return 0
  fi
}

release_lock() {
  if command -v flock >/dev/null 2>&1; then
    flock -u 200 2>/dev/null || true
    exec 200>&- 2>/dev/null || true
    rm -f "$LOCK_FILE"
  elif [ -n "${LOCK_DIR:-}" ]; then
    rm -rf "$LOCK_DIR"
  fi
}

# Merge a single tool's mcp_config into ~/.claude.json
# Args: tool_id
merge_tool_config() {
  local tool_id="$1"
  local mcp_config

  mcp_config=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config' "$TOOLS_JSON")

  # Skip tools with null mcp_config (e.g., ABCoder binary-only)
  if [ "$mcp_config" = "null" ] || [ -z "$mcp_config" ]; then
    return 0
  fi

  # Build the mcpServers entry for this tool
  local config_entry
  config_entry=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config | {($id): .}' "$TOOLS_JSON")

  # Check if already configured (idempotent)
  local existing
  existing=$(jq -r --arg id "$tool_id" '.mcpServers[$id] // empty' "$CLAUDE_JSON")
  if [ -n "$existing" ] && [ "$existing" != "null" ]; then
    echo "  ⏭️  $tool_id: already configured, skipping"
    return 0
  fi

  # Merge: add new entry to mcpServers (same-dir tempfile for atomic mv)
  local tmp
  tmp=$(mktemp "${CLAUDE_JSON}.XXXXXX")
  chmod 600 "$tmp"
  jq --argjson entry "$config_entry" '.mcpServers += $entry' "$CLAUDE_JSON" > "$tmp"

  # Validate JSON
  if jq . "$tmp" >/dev/null 2>&1; then
    mv "$tmp" "$CLAUDE_JSON"
    echo "  ✅ $tool_id: configured"
  else
    rm -f "$tmp"
    echo "  ❌ $tool_id: config merge failed (invalid JSON)" >&2
    return 1
  fi
}

# Install a tool that has install_command (binary install)
install_binary() {
  local tool_id="$1"
  local install_cmd

  install_cmd=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .install_command // empty' "$TOOLS_JSON")

  if [ -z "$install_cmd" ]; then
    return 0
  fi

  # Check if command already exists
  local detect_cmd
  detect_cmd=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.command // empty' "$TOOLS_JSON")
  if [ -n "$detect_cmd" ]; then
    if eval "$detect_cmd" >/dev/null 2>&1; then
      echo "  ⏭️  $tool_id: binary already installed, skipping"
      return 0
    fi
  fi

  echo "  ⏳ Installing $tool_id..."
  if eval "$install_cmd" 2>&1; then
    echo "  ✅ $tool_id: binary installed"
  else
    echo "  ❌ $tool_id: binary install failed" >&2
    return 1
  fi
}

# Main installation flow
main() {
  local results=()
  local failed=()

  # Acquire lock first (before any file operations)
  trap release_lock EXIT
  acquire_lock

  # Ensure config file exists
  ensure_config

  # Backup before changes
  local backup_file
  backup_file=$(backup_config)
  if [ -n "$backup_file" ]; then
    echo "📦 Backup created: $backup_file"
  fi

  # Get all tool IDs
  local -a all_tools
  while IFS= read -r line; do
    all_tools+=("$line")
  done < <(jq -r '.tools[].id' "$TOOLS_JSON")

  if [ ${#all_tools[@]} -eq 0 ]; then
    echo "❌ No tools found in $TOOLS_JSON" >&2
    exit 1
  fi

  echo ""
  echo "🔧 MCP Tools Installation"
  echo "========================"
  echo ""

  for tool_id in "${all_tools[@]}"; do
    local category
    category=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .category' "$TOOLS_JSON")

    if ! should_install "$tool_id" "$category"; then
      continue
    fi

    echo "Processing: $tool_id ($category)"

    # Install binary if needed
    if ! install_binary "$tool_id"; then
      failed+=("$tool_id")
      continue
    fi

    # Merge MCP config if needed
    if ! merge_tool_config "$tool_id"; then
      failed+=("$tool_id")
      continue
    fi

    results+=("$tool_id")
  done

  echo ""
  echo "========================"
  echo "📋 Installation Summary"
  echo ""

  if [ ${#results[@]} -gt 0 ]; then
    echo "✅ Processed: ${results[*]}"
  fi

  if [ ${#failed[@]} -gt 0 ]; then
    echo "❌ Failed: ${failed[*]}"
  fi

  # Remove backup on full success
  if [ ${#failed[@]} -eq 0 ] && [ -n "$backup_file" ]; then
    rm -f "$backup_file"
    echo "🗑️  Backup removed (all succeeded)"
  elif [ -n "$backup_file" ]; then
    echo "⚠️  Backup preserved at: $backup_file"
    echo "   To restore: cp $backup_file $CLAUDE_JSON"
  fi

  echo ""
  echo "⚠️  Please restart Claude Code for changes to take effect."

  # Exit with failure if any tool failed
  if [ ${#failed[@]} -gt 0 ]; then
    exit 1
  fi
}

main
