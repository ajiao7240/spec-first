#!/bin/bash
# configure-host.sh - Unix host config writer for spec-mcp-setup
# Usage: configure-host.sh --tool <tool-id>

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
source "$SCRIPT_DIR/lib-toml.sh"
HOST_INFO_JSON="$(bash "$SCRIPT_DIR/detect-host.sh")"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
SELECTED_SCOPE="$(jq -r '.selected_scope // empty' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
LOCK_FILE="${CONFIG_PATH}.lock"
CONFIG_DIR="$(dirname "$CONFIG_PATH")"

TOOL_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool)
      TOOL_ID="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

[ -n "$TOOL_ID" ] || { echo '错误：缺少 --tool' >&2; exit 1; }
[ -n "$SELECTED_SCOPE" ] || { echo '错误：未找到可用宿主配置目标' >&2; exit 1; }
mkdir -p "$CONFIG_DIR"

HOST_CONFIG_JSON=$(jq -c --arg id "$TOOL_ID" --arg host "$HOST" '.tools[] | select(.id == $id) | .host_config[$host]' "$TOOLS_JSON")
[ -n "$HOST_CONFIG_JSON" ] && [ "$HOST_CONFIG_JSON" != "null" ] || { echo "错误：未找到 $TOOL_ID 的 host_config" >&2; exit 1; }

RESOLVED_TOOL_CONFIG_JSON="$(jq -c --arg scope "$SELECTED_SCOPE" '{command, args} + (if has("startup_timeout_sec") then {startup_timeout_sec} else {} end) + {scope: $scope}' <<<"$HOST_CONFIG_JSON")"
EXPECTED_COMMAND="$(jq -r '.command' <<<"$RESOLVED_TOOL_CONFIG_JSON")"
EXPECTED_ARGS="$(jq -c '.args' <<<"$RESOLVED_TOOL_CONFIG_JSON")"
DETECT_KIND="$(jq -r --arg id "$TOOL_ID" '.tools[] | select(.id == $id) | .detection.kind' "$TOOLS_JSON")"
DETECT_KEY="$(jq -r --arg id "$TOOL_ID" '.tools[] | select(.id == $id) | .detection.key' "$TOOLS_JSON")"
FALLBACK_APPLIED=false
if [ "$HOST" = "claude" ] && [ "$SELECTED_SCOPE" != "managed" ]; then
  FALLBACK_APPLIED=true
fi

tool_is_configured() {
  local block expected_args_count i expected_arg
  [ -f "$CONFIG_PATH" ] || return 1

  case "$DETECT_KIND" in
    host_config_exact)
      if [ "$HOST" = "claude" ]; then
        jq -e --arg key "$DETECT_KEY" --arg command "$EXPECTED_COMMAND" --argjson expected_args "$EXPECTED_ARGS" '.mcpServers[$key].command == $command and (.mcpServers[$key].args // []) == $expected_args' "$CONFIG_PATH" >/dev/null 2>&1
        return
      fi
      block="$(extract_toml_mcp_section "$CONFIG_PATH" "$DETECT_KEY")"
      if [ -n "$block" ] && printf '%s\n' "$block" | grep -qF "command = \"$EXPECTED_COMMAND\""; then
        expected_args_count="$(jq 'length' <<<"$EXPECTED_ARGS")"
        if [ "$expected_args_count" -gt 0 ]; then
          for i in $(seq 0 $((expected_args_count - 1))); do
            expected_arg="$(jq -r ".[$i]" <<<"$EXPECTED_ARGS")"
            if ! printf '%s\n' "$block" | grep -qF -- "$expected_arg"; then
              return 1
            fi
          done
        fi
        return 0
      fi
      return 1
      ;;
    host_config_key_only)
      if [ "$HOST" = "claude" ]; then
        jq -e --arg key "$DETECT_KEY" '.mcpServers[$key] != null' "$CONFIG_PATH" >/dev/null 2>&1
      else
        [ -n "$(extract_toml_mcp_section "$CONFIG_PATH" "$DETECT_KEY")" ]
      fi
      ;;
    *)
      return 1
      ;;
  esac
}

acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 200>"$LOCK_FILE" 2>/dev/null || return 1
    flock -w 10 200 || return 1
    return 0
  fi

  LOCK_DIR="${CONFIG_PATH}.lock.d"
  local attempts=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ $attempts -ge 100 ]; then
      return 1
    fi
    sleep 0.1
  done
  echo $$ > "$LOCK_DIR/pid"
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

write_claude_config() {
  local config_json="$1"
  local tmp
  tmp="$(mktemp "${CONFIG_PATH}.XXXXXX")"
  chmod 600 "$tmp"
  if [ -f "$CONFIG_PATH" ]; then
    jq --arg id "$TOOL_ID" --argjson cfg "$config_json" '(.mcpServers //= {}) | .mcpServers[$id] = $cfg' "$CONFIG_PATH" > "$tmp"
  else
    jq -n --arg id "$TOOL_ID" --argjson cfg "$config_json" '{mcpServers: {($id): $cfg}}' > "$tmp"
  fi
  mv "$tmp" "$CONFIG_PATH"
}

write_codex_config() {
  local command args_json timeout section_body
  command="$(jq -r '.command' <<<"$RESOLVED_TOOL_CONFIG_JSON")"
  args_json="$(jq -c '.args' <<<"$RESOLVED_TOOL_CONFIG_JSON")"
  timeout="$(jq -r '.startup_timeout_sec // empty' <<<"$RESOLVED_TOOL_CONFIG_JSON")"
  section_body="command = \"$command\"\nargs = $args_json"
  if [ -n "$timeout" ]; then
    section_body="$section_body\nstartup_timeout_sec = $timeout"
  fi
  local tmp
  tmp="$(mktemp "${CONFIG_PATH}.XXXXXX")"
  chmod 600 "$tmp"
  write_toml_mcp_section "$CONFIG_PATH" "$DETECT_KEY" "$section_body" "$tmp"
  mv "$tmp" "$CONFIG_PATH"
}

restore_backup() {
  [ -n "${BACKUP_PATH:-}" ] || return 0
  if [ -f "$BACKUP_PATH" ]; then
    mv "$BACKUP_PATH" "$CONFIG_PATH"
  else
    rm -f "$CONFIG_PATH"
  fi
}

trap release_lock EXIT
acquire_lock || { echo '错误：无法获取配置锁' >&2; exit 1; }

if tool_is_configured; then
  jq -n --arg tool_id "$TOOL_ID" --arg configured_path "$CONFIG_PATH" --arg selected_scope "$SELECTED_SCOPE" --argjson fallback_applied "$FALLBACK_APPLIED" '{tool_id:$tool_id,configured_path:$configured_path,selected_scope:$selected_scope,fallback_applied:$fallback_applied}'
  exit 0
fi

BACKUP_PATH=""
if [ -f "$CONFIG_PATH" ]; then
  BACKUP_PATH="$(mktemp "${CONFIG_PATH}.backup.XXXXXX")"
  cp "$CONFIG_PATH" "$BACKUP_PATH"
  chmod 600 "$BACKUP_PATH"
else
  BACKUP_PATH="${CONFIG_PATH}.missing"
fi

if [ "$HOST" = "claude" ]; then
  if ! write_claude_config "$RESOLVED_TOOL_CONFIG_JSON"; then
    restore_backup
    echo "错误：$TOOL_ID 写入宿主配置失败，已回滚" >&2
    exit 1
  fi
else
  if ! write_codex_config; then
    restore_backup
    echo "错误：$TOOL_ID 写入宿主配置失败，已回滚" >&2
    exit 1
  fi
fi

if tool_is_configured; then
  [ -f "$BACKUP_PATH" ] && rm -f "$BACKUP_PATH"
  jq -n --arg tool_id "$TOOL_ID" --arg configured_path "$CONFIG_PATH" --arg selected_scope "$SELECTED_SCOPE" --argjson fallback_applied "$FALLBACK_APPLIED" '{tool_id:$tool_id,configured_path:$configured_path,selected_scope:$selected_scope,fallback_applied:$fallback_applied}'
  exit 0
fi

restore_backup
echo "错误：$TOOL_ID 配置后仍未检测到有效宿主配置，已回滚" >&2
exit 1
