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

jq -n -S \
  --arg generated_at "$generated_at" \
  --arg repo_root "$REPO_ROOT" \
  --slurpfile facts "$FACTS_FILE" '{
    schema_version:"tool-facts.v1",
    generated_at:$generated_at,
    repo_root:$repo_root,
    host: ($facts[0].host // null),
    platform: ($facts[0].platform // null),
    tools: ($facts[0].tools // {}),
    helper_tools: ($facts[0].helper_tools // {}),
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
