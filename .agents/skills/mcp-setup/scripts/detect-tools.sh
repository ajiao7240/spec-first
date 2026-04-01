#!/bin/bash
# detect-tools.sh - Detect already installed MCP tools from ~/.claude.json
# Output: JSON with installed and missing tool lists

set -euo pipefail

CLAUDE_JSON="$HOME/.claude.json"
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

      if [ -f "$CLAUDE_JSON" ]; then
        if jq -e --arg key "$detect_key" '.mcpServers[$key]' "$CLAUDE_JSON" >/dev/null 2>&1; then
          found=true
        fi
      fi
      ;;

    "command")
      # Check if command exists on system
      detect_cmd=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.command' "$TOOLS_JSON")
      cmd_name=$(echo "$detect_cmd" | awk '{print $1}')

      if command -v "$cmd_name" >/dev/null 2>&1; then
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
installed_json=$(printf '%s\n' ${installed[@]+"${installed[@]}"} | jq -R . | jq -s .)
missing_json=$(printf '%s\n' ${missing[@]+"${missing[@]}"} | jq -R . | jq -s .)

jq -n \
  --argjson installed "$installed_json" \
  --argjson missing "$missing_json" \
  '{
    "installed": $installed,
    "missing": $missing
  }'
