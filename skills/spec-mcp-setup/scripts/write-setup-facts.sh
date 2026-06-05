#!/bin/bash
# write-setup-facts.sh - Project-local setup fact writer.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

FACTS_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --facts-file)
      FACTS_FILE="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

[ -n "$FACTS_FILE" ] || { echo "--facts-file required" >&2; exit 1; }
[ -f "$FACTS_FILE" ] || { echo "facts file not found: $FACTS_FILE" >&2; exit 1; }

REPO_STATUS="$(jq -r '.repo_status // "not-git-repo"' "$FACTS_FILE")"
TARGET_KIND="$(jq -r '.target_kind // .target.target_kind // empty' "$FACTS_FILE")"
TARGET_STATE_WRITE_ALLOWED="$(jq -r 'if (.target | type == "object") then (.target.state_write_allowed | tostring) else (if .repo_status == "git-repo" then "true" else "false" end) end' "$FACTS_FILE")"
TARGET_REASON_CODE="$(jq -r '.target.reason_code // .reason_code // empty' "$FACTS_FILE")"
TARGET_NEXT_ACTION="$(jq -r '.target.next_action // empty' "$FACTS_FILE")"
REPO_ROOT="$(jq -r '.target.target_root // .selected_repo_root // .target.selected_folder_root // .repo_root' "$FACTS_FILE")"

if [ "$TARGET_STATE_WRITE_ALLOWED" != "true" ] || { [ "$REPO_STATUS" != "git-repo" ] && [ "$TARGET_KIND" != "non-git-folder" ]; }; then
  status="${TARGET_REASON_CODE:-skipped-no-git-repo}"
  next="${TARGET_NEXT_ACTION:-Choose a Git repo target and rerun spec-mcp-setup with --repo <child>.}"
  jq -n \
    --arg status "$status" \
    --arg next_action "$next" \
    --slurpfile facts "$FACTS_FILE" '{
      tool_facts_status:$status,
      tool_facts_path:null,
      runtime_capabilities_status:$status,
      runtime_capabilities_path:null,
      reason_code:$status,
      next_action:$next_action,
      workspace_root: ($facts[0].target.workspace_root // $facts[0].workspace_root // null),
      candidates: ($facts[0].target.candidates // $facts[0].target_candidates // [])
    }'
  exit 0
fi

OUT_DIR="$REPO_ROOT/.spec-first/config"
TOOL_FACTS="$OUT_DIR/tool-facts.json"
RUNTIME_CAPABILITIES="$OUT_DIR/runtime-capabilities.json"

blocked_result() {
  jq -n --arg reason "$1" '{
    tool_facts_status:$reason,
    tool_facts_path:null,
    runtime_capabilities_status:$reason,
    runtime_capabilities_path:null,
    reason_code:$reason,
    next_action:"Replace symlinked .spec-first/config with a real repo-local directory and rerun spec-mcp-setup."
  }'
}

if [ -L "$REPO_ROOT/.spec-first" ] || [ -L "$OUT_DIR" ]; then
  blocked_result "project-config-symlink-escape"
  exit 0
fi
mkdir -p "$OUT_DIR"
if [ -L "$REPO_ROOT/.spec-first" ] || [ -L "$OUT_DIR" ]; then
  blocked_result "project-config-symlink-escape"
  exit 0
fi

TOOL_FACTS_TMP="$(mktemp "${TOOL_FACTS}.XXXXXX")"
RUNTIME_TMP="$(mktemp "${RUNTIME_CAPABILITIES}.XXXXXX")"
trap 'rm -f "${TOOL_FACTS_TMP:-}" "${RUNTIME_TMP:-}"' EXIT
chmod 600 "$TOOL_FACTS_TMP" "$RUNTIME_TMP"

generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
# scan 失败时不静默伪装成空结果:产出带 configured_scan_status=scan-failed 的结构,
# 让下游能区分「扫了没有 configured deps」与「扫描失败」(诚实降级,非漏检美化)。
CONFIGURED_SCAN="$(bash "$(dirname "$0")/scan-configured-deps.sh" --repo-root "$REPO_ROOT" --facts-file "$FACTS_FILE" 2>/dev/null || jq -n '{configured_dependencies:[], configured_scan_status:"scan-failed"}' )"

jq -n -S \
  --arg generated_at "$generated_at" \
  --arg repo_root "$REPO_ROOT" \
  --argjson configured_scan "$CONFIGURED_SCAN" \
  --slurpfile facts "$FACTS_FILE" '
  def item_result($value; $dep; $configured; $project):
    ($value.result // null) as $source_result
    | if $source_result == "skipped" then "skipped"
      elif ($configured == "action-required" or $configured == "precedence-blocked") then "action-required"
      elif ($dep != "ready" and $dep != "ok") then
        if $source_result == "degraded" then "degraded"
        elif ($source_result != null and $source_result != "ready") then $source_result
        else "action-required" end
      elif $configured == "registry-args-drift" then "degraded"
      elif ($project == "pending" or $project == "failed") then "action-required"
      elif ($source_result != null and $source_result != "ready") then $source_result
      elif (($value.status // "") == "ready" or ($value.status // "") == "ok") then "ready"
      elif $source_result == "ready" then "ready"
      elif ($configured == "ready" or $configured == "not-applicable" or $configured == "not-required" or $configured == "fallback-active") then "ready"
      elif ($value.status // "") == "missing" then "action-required"
      else ($value.status // "unknown") end;
  def item_reason($value; $dep; $configured; $project; $result; $baseline_blocking):
    ($value.reason_code // null) as $source_reason
    | if $result == "ready" then "ready"
      elif $result == "skipped" then (if ($source_reason != null and $source_reason != "ready") then $source_reason else "optional-skipped" end)
      elif $configured == "registry-args-drift" then "host-config-version-drift"
      elif $dep == "missing" then "missing_dependency"
      elif $configured == "action-required" then "host-config-action-required"
      elif $configured == "precedence-blocked" then "host-config-precedence-blocked"
      elif $project == "pending" then "project-bootstrap-pending"
      elif $project == "failed" then "project-bootstrap-failed"
      elif $result == "degraded" then
        if ($source_reason != null and $source_reason != "ready") then $source_reason
        elif $baseline_blocking then "baseline-degraded"
        else "optional-capability-degraded" end
      elif $result == "action-required" then "required-runtime-action-required"
      else ($source_reason // "unknown") end;
  {
    schema_version:"tool-facts.v2",
    generated_at:$generated_at,
    repo_root:$repo_root,
    host: ($facts[0].host // null),
    platform: ($facts[0].platform // null),
    profile: ($facts[0].profile // "minimal"),
    tools: ($facts[0].tools // {}),
    helper_tools: ($facts[0].helper_tools // {}),
    provider_readiness: ($facts[0].provider_readiness // []),
    schema_capabilities:[
      "items",
      "configured_dependencies",
      "schema_capabilities",
      "tool-existence",
      "provider-readiness-generic"
    ],
    items: (
      [($facts[0].tools // {}) | to_entries[] | . as $entry
        | ($entry.value.dependency_status // $entry.value.status // "unknown") as $dep
        | ($entry.value.configured_status // $entry.value.host_config_status // $entry.value.project_status // "not-checked") as $configured
        | ($entry.value.project_status // "not-applicable") as $project
        | ($entry.value.baseline_blocking // ($entry.value.required // true)) as $baseline_blocking
        | (item_result($entry.value; $dep; $configured; $project)) as $result
        | {
        id:$entry.key,
        kind:($entry.value.type // $entry.value.kind // "mcp"),
        profile:($entry.value.profile // "minimal"),
        required:($entry.value.required // true),
        baseline_blocking:$baseline_blocking,
        dependency_status:$dep,
        configured_status:$configured,
        result:$result,
        reason_code:item_reason($entry.value; $dep; $configured; $project; $result; $baseline_blocking),
        installed:($dep == "ready"),
        missing_dependency_reason:(if $dep == "ready" then null else "missing_dependency" end),
        next_action:($entry.value.next_action // "")
      }]
      +
      [($facts[0].helper_tools // {}) | to_entries[] | . as $entry
        | ($entry.value.dependency_status // $entry.value.status // "unknown") as $dep
        | ($entry.value.configured_status // $entry.value.host_config_status // "not-applicable") as $configured
        | ($entry.value.project_status // "not-applicable") as $project
        | ($entry.value.baseline_blocking // ($entry.value.required // true)) as $baseline_blocking
        | (item_result($entry.value; $dep; $configured; $project)) as $result
        | {
        id:$entry.key,
        kind:($entry.value.kind // $entry.value.type // "helper"),
        profile:($entry.value.profile // "minimal"),
        required:($entry.value.required // true),
        baseline_blocking:$baseline_blocking,
        dependency_status:$dep,
        configured_status:$configured,
        result:$result,
        reason_code:item_reason($entry.value; $dep; $configured; $project; $result; $baseline_blocking),
        installed:($dep == "ready"),
        missing_dependency_reason:(if $dep == "ready" then null else "missing_dependency" end),
        next_action:($entry.value.next_action // "")
      }]
    ),
    configured_dependencies: ($configured_scan.configured_dependencies // []),
    configured_scan_status: ($configured_scan.configured_scan_status // "ok"),
    target: ($facts[0].target // null),
    source:{
      facts_file: ($facts[0].facts_file // null),
      repo_status: ($facts[0].repo_status // null),
      target_kind: ($facts[0].target_kind // $facts[0].target.target_kind // null)
    }
  }' > "$TOOL_FACTS_TMP"

jq -n -S \
  --arg generated_at "$generated_at" \
  --arg repo_root "$REPO_ROOT" \
  --slurpfile facts "$FACTS_FILE" '{
    schema_version:"runtime-capabilities.v1",
    generated_at:$generated_at,
    repo_root:$repo_root,
    host: ($facts[0].host // null),
    direct_evidence:{
      bounded_source_reads:true,
      ripgrep:true,
      ast_grep:true,
      git_diff:true,
      tests_and_logs:true
    },
    setup_summary:{
      host_runtime_ready: ($facts[0].host_runtime_ready // $facts[0].baseline_ready // false),
      baseline_ready: ($facts[0].baseline_ready // false),
      reason_code:"setup-facts-ready"
    },
    host_ledger_pointer: ($facts[0].host_ledger_pointer // null)
  }' > "$RUNTIME_TMP"

write_if_changed() {
  local tmp="$1"
  local out="$2"
  if [ -f "$out" ] && jq -e --slurpfile next "$tmp" 'has("generated_at") and ((. | del(.generated_at)) == ($next[0] | del(.generated_at)))' "$out" >/dev/null 2>&1; then
    rm -f "$tmp"
    echo ready
  else
    mv "$tmp" "$out"
    echo written
  fi
}

tool_facts_status="$(write_if_changed "$TOOL_FACTS_TMP" "$TOOL_FACTS")"
runtime_status="$(write_if_changed "$RUNTIME_TMP" "$RUNTIME_CAPABILITIES")"

jq -n \
  --arg tool_facts_path "$TOOL_FACTS" \
  --arg runtime_path "$RUNTIME_CAPABILITIES" \
  --arg tool_facts_status "$tool_facts_status" \
  --arg runtime_status "$runtime_status" '{
    tool_facts_status:$tool_facts_status,
    tool_facts_path:$tool_facts_path,
    runtime_capabilities_status:$runtime_status,
    runtime_capabilities_path:$runtime_path,
    reason_code:"setup-facts-ready",
    next_action:""
  }'
