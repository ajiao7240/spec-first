#!/bin/bash
# install-coordinator.sh - Install MCP tools and configure the current host's MCP registry
# Usage: install-coordinator.sh [--install <tool-ids>] [--skip <tool-ids>]
#   --install: comma-separated list of tool IDs to install (default: all required)
#   --skip: comma-separated list of tool IDs to skip

set -euo pipefail

# jq 是硬依赖
command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
HOST_INFO_JSON="$("$SCRIPT_DIR/detect-host.sh")"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
HOST_DISPLAY_NAME="$(jq -r '.display_name' <<<"$HOST_INFO_JSON")"
CLI_COMMAND="$(jq -r '.cli_command' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
LOCK_FILE="${CONFIG_PATH}.lock"
CONFIG_DIR="$(dirname "$CONFIG_PATH")"

# 确保常用安装路径可用（Phase 1 安装的依赖可能未出现在当前 PATH）
export PATH="$HOME/.cargo/bin:$HOME/.fnm/aliases/default/bin:$HOME/.local/bin:$PATH"
mkdir -p "$CONFIG_DIR"

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

# Backup the host config with timestamp
backup_config() {
  if [ -f "$CONFIG_PATH" ]; then
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup="$CONFIG_PATH.backup.$timestamp"
    cp "$CONFIG_PATH" "$backup"
    chmod 600 "$backup"
    echo "$backup"
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
    local lock_dir="${CONFIG_PATH}.lock.d"
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

tool_is_configured() {
  local tool_id="$1"

  if [ ! -f "$CONFIG_PATH" ]; then
    return 1
  fi

  if [ "$HOST" = "claude" ]; then
    jq -e --arg id "$tool_id" '.mcpServers[$id]' "$CONFIG_PATH" >/dev/null 2>&1
    return
  fi

  grep -qF "[mcp_servers.$tool_id]" "$CONFIG_PATH"
}

add_tool_config() {
  local tool_id="$1"
  local command
  command=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config.command' "$TOOLS_JSON")

  if [ "$HOST" = "claude" ]; then
    local config_json
    config_json=$(jq -c --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config | {command: .command, args: .args}' "$TOOLS_JSON")
    "$CLI_COMMAND" mcp add-json --scope user "$tool_id" "$config_json"
    return
  fi

  local tool_args=()
  while IFS= read -r arg; do
    tool_args+=("$arg")
  done < <(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config.args[]' "$TOOLS_JSON")

  "$CLI_COMMAND" mcp add "$tool_id" -- "$command" "${tool_args[@]}"
}

restore_config() {
  local backup_file="$1"
  local created_during_run="$2"

  if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
    cp "$backup_file" "$CONFIG_PATH"
    chmod 600 "$CONFIG_PATH"
  elif [ "$created_during_run" = "true" ]; then
    rm -f "$CONFIG_PATH"
  fi
}

configure_tool() {
  local tool_id="$1"

  if tool_is_configured "$tool_id"; then
    echo "  ⏭️  $tool_id: already configured, skipping"
    return 0
  fi

  echo "  ⏳ Configuring $tool_id for ${HOST_DISPLAY_NAME}..."
  if add_tool_config "$tool_id"; then
    if tool_is_configured "$tool_id"; then
      echo "  ✅ $tool_id: configured"
      return 0
    fi

    echo "  ❌ $tool_id: CLI completed but configuration is still missing" >&2
    return 1
  fi

  echo "  ❌ $tool_id: configuration failed" >&2
  return 1
}

# Main installation flow
main() {
  local results=()
  local failed=()

  # Acquire lock first (before any file operations)
  trap release_lock EXIT
  acquire_lock

  if [ ! -f "$CONFIG_PATH" ]; then
    created_during_run="true"
  else
    created_during_run="false"
  fi

  # Backup before changes
  local backup_file
  backup_file=$(backup_config)
  if [ -n "$backup_file" ]; then
    echo "📦 Backup created: $backup_file"
  fi

  echo ""
  echo "🔧 MCP Tools Installation"
  echo "========================"
  echo "Host: ${HOST_DISPLAY_NAME}"
  echo "Config: ${CONFIG_PATH}"
  echo ""

  while IFS= read -r tool_id; do
    local category
    category=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .category' "$TOOLS_JSON")

    if ! should_install "$tool_id" "$category"; then
      continue
    fi

    echo "Processing: $tool_id ($category)"

    if ! configure_tool "$tool_id"; then
      restore_config "$backup_file" "$created_during_run"
      failed+=("$tool_id")
      continue
    fi

    results+=("$tool_id")
  done < <(jq -r '.tools[].id' "$TOOLS_JSON")

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
    echo "   To restore: cp $backup_file $CONFIG_PATH"
  fi

  echo ""
  echo "⚠️  Please restart ${HOST_DISPLAY_NAME} for changes to take effect."

  # Exit with failure if any tool failed
  if [ ${#failed[@]} -gt 0 ]; then
    exit 1
  fi
}

main
