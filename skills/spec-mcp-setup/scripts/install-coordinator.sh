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
HOST_CONTEXT="ide-assistant"

if [ "$HOST" = "codex" ]; then
  HOST_CONTEXT="codex"
fi

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

extract_toml_section() {
  local section_name="$1"
  awk -v section="[mcp_servers.$section_name]" '
    $0 == section { in_section = 1; next }
    /^\[mcp_servers\./ && in_section { exit }
    in_section { print }
  ' "$CONFIG_PATH"
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
    config_json=$(jq -c --arg id "$tool_id" --arg host_context "$HOST_CONTEXT" '
      .tools[] | select(.id == $id) | .mcp_config |
      {
        command: .command,
        args: [.args[] | if . == "__HOST_CONTEXT__" then $host_context else . end]
      }
    ' "$TOOLS_JSON")
    "$CLI_COMMAND" mcp add-json --scope user "$tool_id" "$config_json"
    return
  fi

  local tool_args=()
  while IFS= read -r arg; do
    if [ "$arg" = "__HOST_CONTEXT__" ]; then
      tool_args+=("$HOST_CONTEXT")
    else
      tool_args+=("$arg")
    fi
  done < <(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config.args[]' "$TOOLS_JSON")

  "$CLI_COMMAND" mcp add "$tool_id" -- "$command" "${tool_args[@]}"
}

ensure_codex_startup_timeout() {
  local tool_id="$1"
  local timeout_sec

  if [ "$HOST" != "codex" ]; then
    return 0
  fi

  timeout_sec=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config.startup_timeout_sec // empty' "$TOOLS_JSON")
  if [ -z "$timeout_sec" ]; then
    return 0
  fi

  if [ ! -f "$CONFIG_PATH" ]; then
    echo "  ❌ $tool_id: codex 配置文件不存在，无法写入 startup_timeout_sec" >&2
    return 1
  fi

  local block
  block="$(extract_toml_section "$tool_id")"
  if [ -z "$block" ]; then
    echo "  ❌ $tool_id: 未找到 [mcp_servers.$tool_id]，无法写入 startup_timeout_sec" >&2
    return 1
  fi

  local tmp
  tmp=$(mktemp "${CONFIG_PATH}.XXXXXX")
  chmod 600 "$tmp"

  awk -v section="[mcp_servers.$tool_id]" -v timeout="$timeout_sec" '
    BEGIN {
      in_section = 0
      has_timeout = 0
    }
    {
      if ($0 == section) {
        in_section = 1
        print
        next
      }

      if (in_section && $0 ~ /^[[:space:]]*startup_timeout_sec[[:space:]]*=/) {
        value = $0
        sub(/^[[:space:]]*startup_timeout_sec[[:space:]]*=[[:space:]]*/, "", value)
        sub(/[[:space:]]*(#.*)?$/, "", value)
        gsub(/"/, "", value)
        if (value ~ /^[0-9]+([.][0-9]+)?$/ && (value + 0) >= (timeout + 0)) {
          print
        } else {
          print "startup_timeout_sec = " timeout
        }
        has_timeout = 1
        next
      }

      if (in_section && $0 ~ /^\[mcp_servers\./) {
        if (!has_timeout) {
          print "startup_timeout_sec = " timeout
          has_timeout = 1
        }
        in_section = 0
      }

      print
    }
    END {
      if (in_section && !has_timeout) {
        print "startup_timeout_sec = " timeout
      }
    }
  ' "$CONFIG_PATH" > "$tmp"

  mv "$tmp" "$CONFIG_PATH"
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
    if ! ensure_codex_startup_timeout "$tool_id"; then
      return 1
    fi
    echo "  ⏭️  $tool_id: already configured, skipping"
    return 0
  fi

  echo "  ⏳ Configuring $tool_id for ${HOST_DISPLAY_NAME}..."
  if add_tool_config "$tool_id"; then
    if ! ensure_codex_startup_timeout "$tool_id"; then
      echo "  ❌ $tool_id: startup_timeout_sec update failed" >&2
      return 1
    fi
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

install_feishu() {
  if tool_is_configured "feishu"; then
    echo "  ⏭️  feishu: already configured, skipping"
    return 0
  fi

  echo ""
  echo "=== 飞书 MCP 配置引导 ==="
  echo "需要飞书开放平台应用凭据。若尚未创建，请前往："
  echo "  https://open.feishu.cn/app"
  echo ""

  local FEISHU_APP_ID=""
  local FEISHU_APP_SECRET=""
  read -r -p "请输入 Feishu App ID: " FEISHU_APP_ID || FEISHU_APP_ID=""
  read -r -p "请输入 Feishu App Secret: " FEISHU_APP_SECRET || FEISHU_APP_SECRET=""

  if [ -z "$FEISHU_APP_ID" ] || [ -z "$FEISHU_APP_SECRET" ]; then
    echo "  ⚠️  feishu: 凭据为空，跳过配置。可后续手动配置或重新运行 spec-mcp-setup。"
    return 0
  fi

  echo "  ⏳ Configuring feishu for ${HOST_DISPLAY_NAME}..."

  if [ "$HOST" = "claude" ]; then
    local FEISHU_CONFIG
    FEISHU_CONFIG=$(jq -n \
      --arg app_id "$FEISHU_APP_ID" \
      --arg app_secret "$FEISHU_APP_SECRET" \
      '{"command":"npx","args":["-y","@larksuiteoapi/lark-mcp","mcp","--app-id",$app_id,"--app-secret",$app_secret,"--language","zh"]}')
    if "$CLI_COMMAND" mcp add-json --scope user feishu "$FEISHU_CONFIG"; then
      echo "  ✅ feishu: configured"
    else
      echo "  ❌ feishu: configuration failed" >&2
      return 1
    fi
  elif [ "$HOST" = "codex" ]; then
    if "$CLI_COMMAND" mcp add feishu -- npx -y @larksuiteoapi/lark-mcp mcp \
        --app-id "$FEISHU_APP_ID" --app-secret "$FEISHU_APP_SECRET" --language zh; then
      echo "  ✅ feishu: configured"
    else
      echo "  ❌ feishu: configuration failed" >&2
      return 1
    fi
  fi
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
  echo "🧭 我会先检查当前宿主的配置，再逐个补齐缺失工具。"
  echo ""

  while IFS= read -r tool_id; do
    local category
    category=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .category' "$TOOLS_JSON")

    if ! should_install "$tool_id" "$category"; then
      continue
    fi

    echo "Processing: $tool_id ($category)"
    echo "  → 正在为 ${HOST_DISPLAY_NAME} 写入 $tool_id 配置"

    if [ "$tool_id" = "feishu" ]; then
      if ! install_feishu; then
        restore_config "$backup_file" "$created_during_run"
        failed+=("feishu")
        results=()
        break
      fi
      results+=("feishu")
      continue
    fi

    if ! configure_tool "$tool_id"; then
      restore_config "$backup_file" "$created_during_run"
      failed+=("$tool_id")
      results=()
      break
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
  if [ ${#results[@]} -eq 0 ] && [ ${#failed[@]} -eq 0 ]; then
    echo "✅ 当前宿主已经就绪，没有发现需要补充的 MCP 工具。"
  fi

  # Exit with failure if any tool failed
  if [ ${#failed[@]} -gt 0 ]; then
    exit 1
  fi
}

main
