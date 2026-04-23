#!/bin/bash
# uninstall-mcp.sh - Deterministic Unix uninstall path for spec-mcp-setup
# Usage: uninstall-mcp.sh [--tool <tool-id>]

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
HOST_INFO_JSON="$($SCRIPT_DIR/detect-host.sh)"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
PLATFORM="$(jq -r '.platform' <<<"$HOST_INFO_JSON")"
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

resolve_path_template() {
  local template="$1"
  case "$template" in
    '$HOME'*)
      printf '%s%s' "$HOME" "${template#'$HOME'}"
      ;;
    *)
      printf '%s' "$template"
      ;;
  esac
}

remove_claude_entry() {
  local config_path="$1"
  local tool_id="$2"
  [ -f "$config_path" ] || return 0
  local tmp
  tmp="$(mktemp "${config_path}.XXXXXX")"
  chmod 600 "$tmp"
  jq --arg id "$tool_id" 'if .mcpServers then .mcpServers |= with_entries(select(.key != $id)) else . end' "$config_path" > "$tmp"
  mv "$tmp" "$config_path"
}

remove_codex_entry() {
  local config_path="$1"
  local tool_id="$2"
  [ -f "$config_path" ] || return 0
  local tmp
  tmp="$(mktemp "${config_path}.XXXXXX")"
  chmod 600 "$tmp"
  python3 - "$config_path" "$tool_id" "$tmp" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
tool_id = sys.argv[2]
out = Path(sys.argv[3])
text = path.read_text(encoding='utf-8') if path.exists() else ''
pattern = rf'(?ms)^\[mcp_servers\.{re.escape(tool_id)}\]\n.*?(?=^\[mcp_servers\.|\Z)'
text = re.sub(pattern, '', text).strip()
out.write_text((text + '\n') if text else '', encoding='utf-8')
PY
  mv "$tmp" "$config_path"
}

if [ -n "$TOOL_ID" ]; then
  TOOL_IDS=("$TOOL_ID")
else
  mapfile -t TOOL_IDS < <(jq -r '.tools[].id' "$TOOLS_JSON")
fi

for tool_id in "${TOOL_IDS[@]}"; do
  while IFS= read -r target_key; do
    target_json="$(jq -c --arg id "$tool_id" --arg host "$HOST" --arg key "$target_key" '.tools[] | select(.id == $id) | .host_config[$host].targets[$key]' "$TOOLS_JSON")"
    [ "$target_json" != "null" ] || continue
    raw_path="$(jq -r '.config_path | if type == "object" then .[$platform] // empty else . end' --arg platform "$PLATFORM" <<<"$target_json")"
    [ -n "$raw_path" ] || continue
    config_path="$(resolve_path_template "$raw_path")"
    if [ "$HOST" = "claude" ]; then
      remove_claude_entry "$config_path" "$tool_id"
    else
      remove_codex_entry "$config_path" "$tool_id"
    fi
  done < <(jq -r --arg id "$tool_id" --arg host "$HOST" '.tools[] | select(.id == $id) | .host_config[$host].uninstall_targets[]' "$TOOLS_JSON")
done

jq -n --arg host "$HOST" --arg platform "$PLATFORM" --argjson tools "$(printf '%s
' "${TOOL_IDS[@]}" | jq -R . | jq -s .)" '{host:$host,platform:$platform,removed_tools:$tools}'
