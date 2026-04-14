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
      detect_key=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.key' "$TOOLS_JSON")
      expected_command=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .mcp_config.command' "$TOOLS_JSON")
      expected_args=$(jq -c --arg id "$tool_id" --arg context "$HOST_CONTEXT" '
        .tools[] | select(.id == $id) | .mcp_config.args | map(if . == "__HOST_CONTEXT__" then $context else . end)
      ' "$TOOLS_JSON")

      if [ "$HOST" = "claude" ]; then
        if [ -f "$CONFIG_PATH" ] && jq -e \
          --arg key "$detect_key" \
          --arg command "$expected_command" \
          --argjson expected_args "$expected_args" \
          '
            .mcpServers[$key].command == $command and
            (.mcpServers[$key].args // []) == $expected_args
          ' "$CONFIG_PATH" >/dev/null 2>&1; then
          found=true
        fi
      elif [ "$HOST" = "codex" ]; then
        if [ -f "$CONFIG_PATH" ]; then
          block="$(extract_toml_section "$detect_key")"
            if [ -n "$block" ] && printf '%s\n' "$block" | grep -qF "command = \"$expected_command\""; then
              found=true
              expected_args_count=$(jq 'length' <<<"$expected_args")
              for i in $(seq 0 $((expected_args_count - 1))); do
                expected_arg=$(jq -r ".[$i]" <<<"$expected_args")
              if ! printf '%s\n' "$block" | grep -qF -- "$expected_arg"; then
                  found=false
                  break
                fi
              done
            fi
        fi
      fi
      ;;

    "mcp_key_only")
      detect_key=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.key' "$TOOLS_JSON")
      if [ "$HOST" = "claude" ]; then
        if [ -f "$CONFIG_PATH" ] && jq -e \
          --arg key "$detect_key" \
          '.mcpServers[$key] != null' \
          "$CONFIG_PATH" >/dev/null 2>&1; then
          found=true
        fi
      elif [ "$HOST" = "codex" ]; then
        if [ -f "$CONFIG_PATH" ] && grep -qF "[mcp_servers.${detect_key}]" "$CONFIG_PATH" 2>/dev/null; then
          found=true
        fi
      fi
      ;;

    "command")
      # Run the full detection command so "command exists but is broken" is not misclassified as installed.
      # 超时保护：10秒内未完成则视为失败
      detect_cmd=$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detect.command' "$TOOLS_JSON")
      if command -v timeout >/dev/null 2>&1; then
        if timeout 10 bash -c "$detect_cmd" >/dev/null 2>&1; then
          found=true
        fi
      elif command -v perl >/dev/null 2>&1; then
        if perl -e 'alarm shift; exec @ARGV' 10 bash -c "$detect_cmd" >/dev/null 2>&1; then
          found=true
        fi
      else
        # 无超时工具可用，记录警告但仍然执行（不挂死比超时保护更重要）
        echo "⚠️  No timeout command available for detect-tools, running without timeout protection" >&2
        if eval "$detect_cmd" >/dev/null 2>&1; then
          found=true
        fi
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
