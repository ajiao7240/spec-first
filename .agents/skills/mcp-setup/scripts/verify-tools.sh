#!/bin/bash
# verify-tools.sh - Verify host-level tool installation state after mcp-setup
# Writes the current host's spec-first/host-setup.json readiness marker
# Used by spec-bootstrap Host Readiness Gate

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_INFO_JSON="$("$SCRIPT_DIR/detect-host.sh")"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
HOST_SETUP_FILE="$(jq -r '.marker_path' <<<"$HOST_INFO_JSON")"
HOST_SETUP_DIR="$(dirname "$HOST_SETUP_FILE")"

check_mcp_configured() {
  local tool="$1"
  if [ ! -f "$CONFIG_PATH" ]; then
    echo "false"
    return
  fi

  if [ "$HOST" = "claude" ]; then
    if jq -e --arg t "$tool" '.mcpServers[$t]' "$CONFIG_PATH" >/dev/null 2>&1; then
      echo "true"
    else
      echo "false"
    fi
    return
  fi

  if grep -qF "[mcp_servers.$tool]" "$CONFIG_PATH"; then
    echo "true"
  else
    echo "false"
  fi
}

serena_configured=$(check_mcp_configured "serena")
context7_configured=$(check_mcp_configured "context7")
sequential_thinking_configured=$(check_mcp_configured "sequential-thinking")

setup_success=false
if [ "$serena_configured" = "true" ] \
  && [ "$context7_configured" = "true" ] \
  && [ "$sequential_thinking_configured" = "true" ]; then
  setup_success=true
fi

echo "🔎 正在核对当前宿主的基础 MCP 配置..."
echo "  serena: ${serena_configured}"
echo "  context7: ${context7_configured}"
echo "  sequential-thinking: ${sequential_thinking_configured}"

if ! mkdir -p "$HOST_SETUP_DIR" 2>/dev/null; then
  echo "verify-tools.sh: 无法创建目录 ${HOST_SETUP_DIR}" >&2
  exit 1
fi

if [ ! -w "$HOST_SETUP_DIR" ]; then
  echo "verify-tools.sh: 无法写入 ${HOST_SETUP_DIR}" >&2
  exit 1
fi

completed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
tmp=$(mktemp "${HOST_SETUP_DIR}/host-setup.XXXXXX") || exit 1
_RM=$(command -v rm)
trap '${_RM:-rm} -f "$tmp"' EXIT
chmod 600 "$tmp"

jq -n \
  --arg host "$HOST" \
  --arg completed_at "$completed_at" \
  --argjson serena_configured "$serena_configured" \
  --argjson context7_configured "$context7_configured" \
  --argjson sequential_thinking_configured "$sequential_thinking_configured" \
  --argjson setup_success "$setup_success" \
  '{
    "version": "4",
    "host": $host,
    "completed_at": $completed_at,
    "setup_success": $setup_success,
    "tools": {
      "serena": { "configured": $serena_configured },
      "context7": { "configured": $context7_configured },
      "sequential-thinking": { "configured": $sequential_thinking_configured }
    }
  }' > "$tmp"

mv "$tmp" "$HOST_SETUP_FILE"
echo "📝 宿主就绪标记已更新: $HOST_SETUP_FILE"
echo "✅ 当前宿主的基础 MCP 配置已完成校验"
