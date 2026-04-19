#!/bin/bash
# verify-tools.sh - Verify host-level tool installation state after mcp-setup
# Writes the current host's spec-first/host-setup.json readiness marker
# Used by spec-graph-bootstrap Host Readiness Gate

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_INFO_JSON="$("$SCRIPT_DIR/detect-host.sh")"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
HOST_SETUP_FILE="$(jq -r '.marker_path' <<<"$HOST_INFO_JSON")"
HOST_SETUP_DIR="$(dirname "$HOST_SETUP_FILE")"
HOST_CONTEXT="ide-assistant"

if [ "$HOST" = "codex" ]; then
  HOST_CONTEXT="codex"
fi

extract_toml_section() {
  local section_name="$1"
  awk -v section="[mcp_servers.$section_name]" '
    $0 == section { in_section = 1; next }
    /^\[mcp_servers\./ && in_section { exit }
    in_section { print }
  ' "$CONFIG_PATH"
}

check_mcp_configured() {
  local tool="$1"
  local expected_command
  local expected_args

  if [ ! -f "$CONFIG_PATH" ]; then
    echo "false"
    return
  fi

  expected_command=$(jq -r --arg id "$tool" '.tools[] | select(.id == $id) | .mcp_config.command' "$SCRIPT_DIR/../mcp-tools.json")
  expected_args=$(jq -c --arg id "$tool" --arg context "$HOST_CONTEXT" '
    .tools[] | select(.id == $id) | .mcp_config.args | map(if . == "__HOST_CONTEXT__" then $context else . end)
  ' "$SCRIPT_DIR/../mcp-tools.json")

  if [ "$HOST" = "claude" ]; then
    if jq -e \
      --arg t "$tool" \
      --arg command "$expected_command" \
      --argjson expected_args "$expected_args" \
      '
        .mcpServers[$t].command == $command and
        (.mcpServers[$t].args // []) == $expected_args
      ' "$CONFIG_PATH" >/dev/null 2>&1; then
      echo "true"
    else
      echo "false"
    fi
    return
  fi

  block="$(extract_toml_section "$tool")"
  if [ -n "$block" ] && printf '%s\n' "$block" | grep -qF "command = \"$expected_command\""; then
    expected_args_count=$(jq 'length' <<<"$expected_args")
    for i in $(seq 0 $((expected_args_count - 1))); do
      expected_arg=$(jq -r ".[$i]" <<<"$expected_args")
      if ! printf '%s\n' "$block" | grep -qF -- "$expected_arg"; then
        echo "false"
        return
      fi
    done
    echo "true"
  else
    echo "false"
  fi
}

check_mcp_key_only() {
  local key="$1"

  if [ ! -f "$CONFIG_PATH" ]; then
    echo "false"
    return
  fi

  if [ "$HOST" = "claude" ]; then
    if jq -e \
      --arg key "$key" \
      '.mcpServers[$key] != null' \
      "$CONFIG_PATH" >/dev/null 2>&1; then
      echo "true"
    else
      echo "false"
    fi
    return
  fi

  # codex: TOML key check
  if grep -qF "[mcp_servers.${key}]" "$CONFIG_PATH" 2>/dev/null; then
    echo "true"
  else
    echo "false"
  fi
}

check_feishu_whoami() {
  # 仅 Claude host 支持 JSON 凭据提取；Codex TOML 格式暂不解析
  if [ "$HOST" != "claude" ] || [ ! -f "$CONFIG_PATH" ]; then
    echo "unchecked"
    return
  fi

  local app_id app_secret
  app_id=$(jq -r '
    (.mcpServers.feishu.args // []) as $args |
    ($args | index("--app-id")) as $i |
    if $i != null then $args[$i+1] else "" end
  ' "$CONFIG_PATH" 2>/dev/null) || app_id=""
  app_secret=$(jq -r '
    (.mcpServers.feishu.args // []) as $args |
    ($args | index("--app-secret")) as $i |
    if $i != null then $args[$i+1] else "" end
  ' "$CONFIG_PATH" 2>/dev/null) || app_secret=""

  if [ -z "$app_id" ] || [ -z "$app_secret" ]; then
    echo "unchecked"
    return
  fi

  command -v curl >/dev/null 2>&1 || { echo "unchecked"; return; }

  local body response
  body=$(jq -n --arg id "$app_id" --arg sec "$app_secret" '{"app_id":$id,"app_secret":$sec}')
  response=""

  if command -v timeout >/dev/null 2>&1; then
    response=$(timeout 10 curl -s -X POST \
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
      -H "Content-Type: application/json" \
      -d "$body" 2>/dev/null) || response=""
  elif command -v perl >/dev/null 2>&1; then
    response=$(perl -e 'alarm shift; exec @ARGV' 10 curl -s --max-time 10 -X POST \
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
      -H "Content-Type: application/json" \
      -d "$body" 2>/dev/null) || response=""
  else
    response=$(curl -s --max-time 10 -X POST \
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
      -H "Content-Type: application/json" \
      -d "$body" 2>/dev/null) || response=""
  fi

  if [ -n "$response" ] && jq -e '.code == 0' <<<"$response" >/dev/null 2>&1; then
    echo "ok"
  else
    echo "failed"
  fi
}

check_crg_readiness() {
  local cli_available=false
  local native_modules="unchecked"

  # 检查 CRG CLI 路由器是否可执行（5秒超时）
  if command -v spec-first >/dev/null 2>&1; then
    if timeout 5 spec-first crg --help >/dev/null 2>&1; then
      cli_available=true
    elif perl -e 'alarm shift; exec @ARGV' 5 spec-first crg --help >/dev/null 2>&1; then
      cli_available=true
    fi
  fi

  # CLI 可用时检查原生模块
  if [ "$cli_available" = "true" ]; then
    native_modules="ok"
    if ! node -e "try{require('better-sqlite3')}catch{process.exit(1)}" 2>/dev/null; then
      native_modules="missing"
    fi
    if [ "$native_modules" = "ok" ] && \
       ! node -e "try{require('tree-sitter')}catch{process.exit(1)}" 2>/dev/null; then
      native_modules="missing"
    fi
  fi

  echo "{\"cli_available\": $cli_available, \"native_modules\": \"$native_modules\"}"
}

serena_configured=$(check_mcp_configured "serena")
context7_configured=$(check_mcp_configured "context7")
sequential_thinking_configured=$(check_mcp_configured "sequential-thinking")
playwright_configured=$(check_mcp_configured "playwright")
feishu_configured=$(check_mcp_key_only "feishu")
feishu_whoami="unchecked"
if [ "$feishu_configured" = "true" ]; then
  feishu_whoami=$(check_feishu_whoami)
fi
crg_info=$(check_crg_readiness)
crg_checked_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

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
echo "  playwright: ${playwright_configured}"
echo "  feishu: ${feishu_configured} (whoami: ${feishu_whoami})"
echo "  crg: $(echo "$crg_info" | jq -r '.cli_available') (native_modules: $(echo "$crg_info" | jq -r '.native_modules'))"

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

crg_cli_available=$(echo "$crg_info" | jq -r '.cli_available')
crg_native_modules=$(echo "$crg_info" | jq -r '.native_modules')

jq -n \
  --arg host "$HOST" \
  --arg completed_at "$completed_at" \
  --argjson serena_configured "$serena_configured" \
  --argjson context7_configured "$context7_configured" \
  --argjson sequential_thinking_configured "$sequential_thinking_configured" \
  --argjson playwright_configured "$playwright_configured" \
  --argjson feishu_configured "$feishu_configured" \
  --arg feishu_whoami "$feishu_whoami" \
  --argjson setup_success "$setup_success" \
  --argjson crg_cli_available "$crg_cli_available" \
  --arg crg_native_modules "$crg_native_modules" \
  --arg crg_checked_at "$crg_checked_at" \
  '{
    "version": "6",
    "host": $host,
    "completed_at": $completed_at,
    "setup_success": $setup_success,
    "tools": {
      "serena": { "configured": $serena_configured },
      "context7": { "configured": $context7_configured },
      "sequential-thinking": { "configured": $sequential_thinking_configured },
      "playwright": { "configured": $playwright_configured },
      "feishu": { "configured": $feishu_configured, "whoami": $feishu_whoami }
    },
    "crg": {
      "cli_available": $crg_cli_available,
      "native_modules": $crg_native_modules,
      "checked_at": $crg_checked_at
    }
  }' > "$tmp"

mv "$tmp" "$HOST_SETUP_FILE"
echo "📝 宿主就绪标记已更新: $HOST_SETUP_FILE"
echo "✅ 当前宿主的基础 MCP 配置已完成校验"
