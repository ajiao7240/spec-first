#!/bin/bash
# detect-tools.sh - Detect already installed MCP tools from the current host config
# Output: JSON with installed and missing tool lists

set -euo pipefail

# jq 是硬依赖
command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_INFO_JSON="$("$SCRIPT_DIR/detect-host.sh")"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
TOOLS_JSON="$(cd "$(dirname "$0")/.." && pwd)/mcp-tools.json"

installed=()
missing=()

# Parse tool list from mcp-tools.json
tool_ids=$(jq -r '.tools[].id' "$TOOLS_JSON")

for tool_id in $tool_ids; do
  # Get detection method
  detect_method=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.method' "$TOOLS_JSON")

  found=false

  case "$detect_method" in
    "mcp_config")
      # Check if tool exists in mcpServers config
      detect_key=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.key' "$TOOLS_JSON")

      if [ "$HOST" = "claude" ]; then
        if [ -f "$CONFIG_PATH" ] && jq -e --arg key "$detect_key" '.mcpServers[$key]' "$CONFIG_PATH" >/dev/null 2>&1; then
          found=true
        fi
      elif [ "$HOST" = "codex" ]; then
        if [ -f "$CONFIG_PATH" ] && grep -qF "[mcp_servers.$detect_key]" "$CONFIG_PATH"; then
          found=true
        fi
      fi
      ;;

    "command")
      # Run the full detection command so "command exists but is broken" is not misclassified as installed.
      detect_cmd=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.command' "$TOOLS_JSON")
      if eval "$detect_cmd" >/dev/null 2>&1; then
        found=true
      fi
      ;;

    *)
      # Unknown detection method, treat as missing
      ;;
  esac

  if $found; then
    installed+=("$tool_id")
  else
    missing+=("$tool_id")
  fi
done

# Build JSON output (guarded expansion for empty arrays on bash 3.2)
if [ ${#installed[@]} -eq 0 ]; then
  installed_json='[]'
else
  installed_json=$(printf '%s\n' "${installed[@]}" | jq -R . | jq -s .)
fi

if [ ${#missing[@]} -eq 0 ]; then
  missing_json='[]'
else
  missing_json=$(printf '%s\n' "${missing[@]}" | jq -R . | jq -s .)
fi

jq -n \
  --argjson installed "$installed_json" \
  --argjson missing "$missing_json" \
  '{
    "installed": $installed,
    "missing": $missing
  }'
