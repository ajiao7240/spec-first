#!/bin/bash
# verify-tools.sh - Write the new readiness ledger for spec-mcp-setup

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_INFO_JSON="$($SCRIPT_DIR/detect-host.sh)"
MARKER_PATH="$(jq -r '.marker_path' <<<"$HOST_INFO_JSON")"
MARKER_DIR="$(dirname "$MARKER_PATH")"
FACTS_JSON="$($SCRIPT_DIR/detect-tools.sh)"
HELPER_TOOLS_JSON="$(bash "$SCRIPT_DIR/check-health" --json)"

mkdir -p "$MARKER_DIR"
[ -w "$MARKER_DIR" ] || { echo "verify-tools.sh: 无法写入 ${MARKER_DIR}" >&2; exit 1; }

tmp="$(mktemp "${MARKER_DIR}/readiness-ledger.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"

jq --arg completed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson helper_tools "$HELPER_TOOLS_JSON" \
  '. + {
    schema_version:"v1",
    completed_at:$completed_at,
    helper_tools: (
      $helper_tools.tools
      | map({key:.id, value:{
        required:.required,
        dependency_status:.dependency_status,
        host_config_status:.host_config_status,
        project_status:.project_status,
        result:.result,
        next_action:.next_action
      }})
      | from_entries
    )
  }' <<<"$FACTS_JSON" > "$tmp"
mv "$tmp" "$MARKER_PATH"

echo "📝 宿主就绪标记已更新: $MARKER_PATH"
echo "🔎 当前宿主基线状态: $(jq -r '.overall_status' <<<"$FACTS_JSON")"
echo "🧭 MCP baseline_ready: $(jq -r '.baseline_ready' <<<"$FACTS_JSON")"
echo "✅ readiness ledger 已写入"
