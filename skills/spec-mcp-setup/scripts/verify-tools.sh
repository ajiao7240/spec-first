#!/bin/bash
# verify-tools.sh - Write Required Harness Runtime readiness ledger v2.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_INFO_JSON="$(bash "$SCRIPT_DIR/detect-host.sh")"
MARKER_PATH="$(jq -r '.marker_path' <<<"$HOST_INFO_JSON")"
MARKER_DIR="$(dirname "$MARKER_PATH")"
FACTS_JSON="$(bash "$SCRIPT_DIR/detect-tools.sh")"
HELPER_JSON="$(bash "$SCRIPT_DIR/install-helpers.sh" --verify-only)"

mkdir -p "$MARKER_DIR"
[ -w "$MARKER_DIR" ] || { echo "verify-tools.sh: 无法写入 ${MARKER_DIR}" >&2; exit 1; }

combined_tmp="$(mktemp "${MARKER_DIR}/readiness-ledger-combined.XXXXXX")"
final_tmp="$(mktemp "${MARKER_DIR}/readiness-ledger.XXXXXX")"
trap 'rm -f "$combined_tmp" "$final_tmp"' EXIT
chmod 600 "$combined_tmp" "$final_tmp"

jq --arg completed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson helper "$HELPER_JSON" \
  '
  def tool_ready:
    (.dependency_status == "ready")
    and ((.host_config_status == "ready") or (.host_config_status == "fallback-active"))
    and ((.project_status == "ready") or (.project_status == "not-applicable"));

  . as $facts
  | ($helper.helper_tools // {}) as $helper_tools
  | ([($facts.tools // {})[] | tool_ready] | all) as $tools_ready
  | (($helper_tools["agent-browser"].result // "action-required") == "ready") as $helper_ready
  | ($tools_ready and $helper_ready) as $baseline_ready
  | {
      schema_version: "v2",
      host: $facts.host,
      platform: $facts.platform,
      repo_root: $facts.repo_root,
      repo_status: $facts.repo_status,
      repo_config_status: "pending",
      repo_config_path: null,
      overall_status: (if $baseline_ready then "ready" else "action-required" end),
      baseline_ready: $baseline_ready,
      host_runtime_ready: $baseline_ready,
      graph_bootstrap_required: true,
      completed_at: $completed_at,
      tools: $facts.tools,
      graph_providers: $facts.graph_providers,
      helper_tools: $helper_tools,
      next_actions: (
        (($facts.next_actions // []) + [
          ($helper_tools["agent-browser"].next_action // "")
        ] + (if $baseline_ready then ["run spec-graph-bootstrap"] else [] end))
        | map(select(. != ""))
        | unique
      )
    }
  ' <<<"$FACTS_JSON" > "$combined_tmp"

PROVIDER_RESULT="$(bash "$SCRIPT_DIR/write-provider-config.sh" --facts-file "$combined_tmp")"

jq --argjson provider "$PROVIDER_RESULT" \
  '.repo_config_status = ($provider.repo_config_status // "unknown")
   | .repo_config_path = ($provider.repo_config_path // null)
   | if .repo_status == "not-git-repo" then
       .next_actions = ((.next_actions + ["enter a git repo and run spec-graph-bootstrap"]) | unique)
     else
       .
     end' "$combined_tmp" > "$final_tmp"

mv "$final_tmp" "$MARKER_PATH"

echo "📝 宿主就绪标记已更新: $MARKER_PATH"
echo "🔎 当前宿主基线状态: $(jq -r '.overall_status' "$MARKER_PATH")"
echo "🧭 baseline_ready: $(jq -r '.baseline_ready' "$MARKER_PATH")"
echo ""
echo "Required Harness Runtime status:"
printf "  %-24s %-16s %-8s %-16s %-16s %-16s %-10s %s\n" "Name" "Type" "Required" "Dependency" "Host" "Project" "Query" "Next"
printf "  %-24s %-16s %-8s %-16s %-16s %-16s %-10s %s\n" "----" "----" "--------" "----------" "----" "-------" "-----" "----"
jq -r '
  def display($value):
    if ($value == null or $value == "") then "n/a" else ($value | tostring) end;
  def required($value):
    if $value == true then "yes" elif $value == false then "no" else "n/a" end;
  def query($value):
    if $value == true then "ready" elif $value == false then "pending" else "n/a" end;
  [
    (.tools // {} | to_entries[] | {
      name: .key,
      type: .value.type,
      required: .value.required,
      dependency: .value.dependency_status,
      host: .value.host_config_status,
      project: .value.project_status,
      query: .value.query_ready,
      next: .value.next_action
    }),
    (.helper_tools // {} | to_entries[] | {
      name: .key,
      type: (.value.type // "helper"),
      required: .value.required,
      dependency: .value.dependency_status,
      host: .value.host_config_status,
      project: .value.project_status,
      query: null,
      next: .value.next_action
    }),
    {
      name: "graph-providers.json",
      type: "project",
      required: true,
      dependency: null,
      host: null,
      project: .repo_config_status,
      query: null,
      next: (if .repo_config_status == "ready" then "" else "write provider projection" end)
    }
  ][]
  | [
      display(.name),
      display(.type),
      required(.required),
      display(.dependency),
      display(.host),
      display(.project),
      query(.query),
      display(.next)
    ]
  | @tsv
' "$MARKER_PATH" | while IFS=$'\t' read -r name type required dependency host project query next; do
  printf "  %-24s %-16s %-8s %-16s %-16s %-16s %-10s %s\n" "$name" "$type" "$required" "$dependency" "$host" "$project" "$query" "$next"
done
echo ""
echo "🧩 Graph providers are configured but not query-ready yet."
echo "✅ readiness ledger v2 已写入"
