#!/bin/bash
# verify-tools.sh - Write Required Harness Runtime readiness ledger v2.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo '错误：node 是必需依赖，请先安装 Node.js' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ARG=""
FOLDER_ARG=""
ALL_REPOS=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "verify-tools.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --folder)
      FOLDER_ARG="${2:-}"
      [ -n "$FOLDER_ARG" ] || { echo "verify-tools.sh: --folder requires a value" >&2; exit 1; }
      shift 2
      ;;
    --all-repos)
      ALL_REPOS=true
      shift
      ;;
    *)
      echo "verify-tools.sh: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -n "$REPO_ARG" ] && [ -n "$FOLDER_ARG" ]; then
  echo "verify-tools.sh: use either --repo or --folder, not both" >&2
  exit 1
fi
if [ "$ALL_REPOS" = "true" ] && [ -n "$FOLDER_ARG" ]; then
  echo "verify-tools.sh: use either --all-repos or --folder, not both" >&2
  exit 1
fi

HOST_INFO_JSON="$(bash "$SCRIPT_DIR/detect-host.sh")"
MARKER_PATH="$(jq -r '.marker_path' <<<"$HOST_INFO_JSON")"
MARKER_DIR="$(dirname "$MARKER_PATH")"

# U2 host pointer self-heal: 检测 setup-owned host pointer drift,
# 在 ledger 中记录 reconciliation advisory event。 detect-only,
# 重写动作由后续构造 ledger 时统一完成。
# Caller 必须在 detect-tools.sh 给出 facts 后传入 child repo root,
# 以便 --repo <child> / parent-workspace 路径下也能正确 reconcile。
compute_host_pointer_reconciliation() {
  local current_host="$1"
  local repo_root="$2"
  local marker_path="$3"
  local runtime_path previous_host previous_path
  [ -n "$current_host" ] || { printf 'null'; return 0; }
  [ -n "$repo_root" ] || { printf 'null'; return 0; }
  runtime_path="$repo_root/.spec-first/config/runtime-capabilities.json"
  [ -f "$runtime_path" ] || { printf 'null'; return 0; }
  if ! jq -e . "$runtime_path" >/dev/null 2>&1; then
    echo "verify-tools.sh: runtime-capabilities.json at $runtime_path is unreadable; host pointer reconciliation skipped (will be rewritten by setup)" >&2
    printf 'null'
    return 0
  fi
  previous_host="$(jq -r '.host_ledger_pointer.host // empty' "$runtime_path" 2>/dev/null || true)"
  previous_path="$(jq -r '.host_ledger_pointer.path // empty' "$runtime_path" 2>/dev/null || true)"
  if [ -z "$previous_host" ] || [ "$previous_host" = "$current_host" ]; then
    printf 'null'
    return 0
  fi
  jq -nc \
    --arg from_host "$previous_host" \
    --arg to_host "$current_host" \
    --arg from_marker "$previous_path" \
    --arg to_marker "$marker_path" \
    --arg reconciled_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    '{
      schema_version: "host-pointer-reconciliation.v1",
      from_host: $from_host,
      to_host: $to_host,
      from_marker_path: $from_marker,
      to_marker_path: $to_marker,
      reconciled_at: $reconciled_at,
      reason: "host marker drift detected between previous setup run and current detect-host"
    }'
}

write_workspace_summary_atomic() {
  local workspace_root="$1"
  local file_name="$2"
  local spec_dir="$workspace_root/.spec-first"
  local workspace_dir="$spec_dir/workspace"
  local path="$workspace_dir/$file_name"
  local tmp

  if [ -L "$spec_dir" ] || [ -L "$workspace_dir" ]; then
    echo "verify-tools.sh: refusing to write workspace summary through symlinked .spec-first/workspace" >&2
    return 1
  fi
  mkdir -p "$workspace_dir" || return 1
  if [ -L "$spec_dir" ] || [ -L "$workspace_dir" ] || [ -L "$path" ]; then
    echo "verify-tools.sh: refusing to write workspace summary through symlinked .spec-first/workspace" >&2
    return 1
  fi
  tmp="$(mktemp "${path}.XXXXXX")" || return 1
  if ! cat > "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if [ -L "$spec_dir" ] || [ -L "$workspace_dir" ] || [ -L "$path" ]; then
    rm -f "$tmp"
    echo "verify-tools.sh: refusing to write workspace summary through symlinked .spec-first/workspace" >&2
    return 1
  fi
  mv "$tmp" "$path" || { rm -f "$tmp"; return 1; }
}

json_field_or_empty() {
  local json_path="$1"
  local jq_filter="$2"
  [ -f "$json_path" ] || { printf ''; return 0; }
  jq -r "$jq_filter // empty" "$json_path" 2>/dev/null || true
}

is_foreign_absolute_stat_failure() {
  local candidate="$1"
  [ -n "$candidate" ] || return 1
  case "$candidate" in
    /*) ;;
    *) return 1 ;;
  esac
  [ ! -e "$candidate" ] || return 1
  [ -n "${HOME:-}" ] || return 0
  case "$candidate" in
    "$HOME"|"$HOME"/*) return 1 ;;
    *) return 0 ;;
  esac
}

append_parent_quarantine_item() {
  local items_file="$1"
  local rel_path="$2"
  local reason_code="$3"
  local stale_indicator="$4"
  local last_generated_at="$5"
  local fingerprint_origin="$6"

  jq \
    --arg path "$rel_path" \
    --arg reason_code "$reason_code" \
    --arg stale_indicator "$stale_indicator" \
    --arg last_generated_at "$last_generated_at" \
    --arg fingerprint_origin "$fingerprint_origin" \
    '. + [{
      path:$path,
      reason_code:$reason_code,
      stale_indicator:(if $stale_indicator == "" then null else $stale_indicator end),
      last_generated_at:(if $last_generated_at == "" then null else $last_generated_at end),
      fingerprint_origin:(if $fingerprint_origin == "" then null else $fingerprint_origin end)
    }]' "$items_file" > "$items_file.next"
  mv "$items_file.next" "$items_file"
}

append_parent_json_artifact_quarantine_item() {
  local workspace_root="$1"
  local items_file="$2"
  local rel_path="$3"
  local default_reason="$4"
  local artifact_path="$workspace_root/$rel_path"
  local repo_root generated_at pointer_path reason_code stale_indicator fingerprint_origin

  [ -e "$artifact_path" ] || return 0

  repo_root="$(json_field_or_empty "$artifact_path" '.repo_root')"
  generated_at="$(json_field_or_empty "$artifact_path" '.generated_at')"
  pointer_path="$(json_field_or_empty "$artifact_path" '.host_ledger_pointer.path')"
  reason_code="$default_reason"
  stale_indicator="parent-workspace-repo-local-artifact-present"
  fingerprint_origin="$repo_root"

  if is_foreign_absolute_stat_failure "$repo_root"; then
    reason_code="foreign-absolute-path-stat-failed"
    stale_indicator="$repo_root"
  elif is_foreign_absolute_stat_failure "$pointer_path"; then
    reason_code="foreign-absolute-path-stat-failed"
    stale_indicator="$pointer_path"
    fingerprint_origin="$pointer_path"
  elif [ -n "$repo_root" ] && [ "$repo_root" != "$workspace_root" ]; then
    reason_code="repo_root-mismatches-workspace-root"
    stale_indicator="$repo_root"
  fi

  append_parent_quarantine_item "$items_file" "$rel_path" "$reason_code" "$stale_indicator" "$generated_at" "$fingerprint_origin"
}

build_parent_artifact_quarantine_json() {
  local workspace_root="$1"
  local items_file gitnexus_meta gitnexus_origin gitnexus_generated reason_code stale_indicator
  items_file="$(mktemp "${TMPDIR:-/tmp}/parent-artifact-quarantine.XXXXXX")" || return 1
  jq -n '[]' > "$items_file"

  if [ -L "$workspace_root/.spec-first" ]; then
    jq -n \
      --arg generated_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
      '{
        schema_version:"parent-artifact-quarantine.v1",
        topology:"multi-repo-workspace",
        advisory:true,
        authority_level:"advisory",
        freshness:"generated",
        generated_at:$generated_at,
        generated_by:"spec-mcp-setup",
        consumers:["spec-first clean --workspace-orphans","LLM workflow degraded-evidence judgment"],
        quarantined_paths:[]
      }'
    rm -f "$items_file"
    return 0
  fi

  append_parent_json_artifact_quarantine_item "$workspace_root" "$items_file" ".spec-first/graph/graph-facts.json" "parent-workspace-must-not-have-repo-local-graph"
  append_parent_json_artifact_quarantine_item "$workspace_root" "$items_file" ".spec-first/config/graph-providers.json" "parent-workspace-must-not-have-repo-local-graph"
  append_parent_json_artifact_quarantine_item "$workspace_root" "$items_file" ".spec-first/config/runtime-capabilities.json" "parent-workspace-must-not-have-repo-local-graph"

  if [ -e "$workspace_root/.spec-first/providers/code-review-graph" ]; then
    append_parent_quarantine_item \
      "$items_file" \
      ".spec-first/providers/code-review-graph/" \
      "retired-provider-residue" \
      "retired-code-review-graph-provider-directory-present" \
      "" \
      "code-review-graph"
  fi

  if [ -e "$workspace_root/.gitnexus" ]; then
    gitnexus_meta="$workspace_root/.gitnexus/meta.json"
    gitnexus_origin="$(json_field_or_empty "$gitnexus_meta" '.repoPath')"
    gitnexus_generated="$(json_field_or_empty "$gitnexus_meta" '.indexedAt')"
    reason_code="parent-workspace-must-not-have-graph-index"
    stale_indicator="parent-workspace-graph-index-present"
    if is_foreign_absolute_stat_failure "$gitnexus_origin"; then
      reason_code="foreign-absolute-path-stat-failed"
      stale_indicator="$gitnexus_origin"
    elif [ -n "$gitnexus_origin" ] && [ "$gitnexus_origin" != "$workspace_root" ]; then
      reason_code="repo_root-mismatches-workspace-root"
      stale_indicator="$gitnexus_origin"
    fi
    append_parent_quarantine_item \
      "$items_file" \
      ".gitnexus/" \
      "$reason_code" \
      "$stale_indicator" \
      "$gitnexus_generated" \
      "$gitnexus_origin"
  fi

  jq -n \
    --arg generated_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --slurpfile paths "$items_file" \
    '{
      schema_version:"parent-artifact-quarantine.v1",
      topology:"multi-repo-workspace",
      advisory:true,
      authority_level:"advisory",
      freshness:"generated",
      generated_at:$generated_at,
      generated_by:"spec-mcp-setup",
      consumers:["spec-first clean --workspace-orphans","LLM workflow degraded-evidence judgment"],
      quarantined_paths:($paths[0] // [])
    }'
  rm -f "$items_file"
}

write_setup_scenario_fingerprint() {
  local state_write_allowed target_root output helper repo_root result status tmp

  state_write_allowed="$(jq -r 'if (.target | type == "object") then (.target.state_write_allowed // true | tostring) else "true" end' "$MARKER_PATH" 2>/dev/null || echo "false")"
  [ "$state_write_allowed" = "true" ] || return 0

  target_root="$(jq -r '.target_root // .selected_repo_root // .workspace_root // empty' "$MARKER_PATH" 2>/dev/null || true)"
  [ -n "$target_root" ] && [ -d "$target_root" ] || return 0

  output="$target_root/.spec-first/workspace/scenario-fingerprint-setup.json"
  repo_root="$(cd "$SCRIPT_DIR/../../.." && pwd)"
  helper="$repo_root/src/cli/helpers/scenario-fingerprint.js"

  set +e
  if [ -f "$helper" ]; then
    result="$(node "$helper" --layer setup --ledger "$MARKER_PATH" --out "$output" 2>&1)"
    status=$?
  elif [ -n "${SPEC_FIRST_CLI:-}" ]; then
    if [ -f "$SPEC_FIRST_CLI" ] && [[ "$SPEC_FIRST_CLI" == *.js ]]; then
      result="$(node "$SPEC_FIRST_CLI" internal compute-scenario-fingerprint --layer setup --ledger "$MARKER_PATH" --out "$output" 2>&1)"
      status=$?
    else
      result="$("$SPEC_FIRST_CLI" internal compute-scenario-fingerprint --layer setup --ledger "$MARKER_PATH" --out "$output" 2>&1)"
      status=$?
    fi
  elif command -v spec-first >/dev/null 2>&1; then
    result="$(spec-first internal compute-scenario-fingerprint --layer setup --ledger "$MARKER_PATH" --out "$output" 2>&1)"
    status=$?
  else
    result="spec-first CLI unavailable"
    status=127
  fi
  set -e

  tmp="$(mktemp "${MARKER_PATH}.scenario-fingerprint.XXXXXX")" || return 0
  if [ "$status" -eq 0 ] && [ -f "$output" ]; then
    jq --arg path "$output" '
      .scenario_fingerprint_setup = {
        status:"written",
        schema_version:"developer-scenario-fingerprint-setup.v1",
        path:$path,
        advisory:true
      }
    ' "$MARKER_PATH" > "$tmp" && mv "$tmp" "$MARKER_PATH"
    echo "🧭 setup scenario fingerprint: $output"
  else
    jq --arg diagnostic "$result" '
      .scenario_fingerprint_setup = {
        status:"failed",
        schema_version:"developer-scenario-fingerprint-setup.v1",
        advisory:true,
        diagnostic:($diagnostic | split("\n") | .[0:6] | join("\n"))
      }
    ' "$MARKER_PATH" > "$tmp" && mv "$tmp" "$MARKER_PATH"
    rm -f "$tmp"
    echo "verify-tools.sh: setup scenario fingerprint failed; continuing" >&2
  fi
}

write_all_repos_verify_summary_and_exit() {
  local target_json="$1"
  local selection_source="${2:-explicit-all-repos}"
  local target_mode workspace_root candidate_count summary_items summary_json quarantine_json parent_workspace_pollution_count

  target_mode="$(jq -r '.mode // empty' <<<"$target_json")"
  workspace_root="$(jq -r '.workspace_root // .invocation_cwd' <<<"$target_json")"

  if [ -n "$REPO_ARG" ]; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-verify-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"all-repos-conflicts-with-repo",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Use either --all-repos from a parent workspace or --repo <child>, not both."
    }'
    exit 1
  fi

  if [ "$target_mode" = "git-repo" ]; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-verify-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"all-repos-requires-parent-workspace",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Run --all-repos from a parent workspace containing child Git repos, or omit --all-repos in a single Git repo."
    }'
    exit 1
  fi

  candidate_count="$(jq -r '(.candidates // []) | length' <<<"$target_json")"
  if [ "$candidate_count" -eq 0 ]; then
    jq -n --argjson target "$target_json" '{
      schema_version:"workspace-mcp-verify-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:($target.reason_code // "workspace-no-git-candidates"),
      workspace_root:($target.workspace_root // null),
      parent_workspace_advisory:{
        git_health:($target.git_health // null),
        coverage_gap:($target.coverage_gap // null),
        candidates_diagnostics:($target.candidates_diagnostics // []),
        repair_action_available:(($target.git_health.status // "") == "broken-worktree"),
        repair_command:(if (($target.git_health.status // "") == "broken-worktree") then "spec-first repair-worktree --dry-run" else null end),
        diagnostic_action_available:(($target.git_health.status // "") == "corrupted-gitdir"),
        diagnostic_command:(if (($target.git_health.status // "") == "corrupted-gitdir") then "git fsck" else null end)
      },
      candidates:($target.candidates // []),
      advisory:true,
      next_action:($target.next_action // "Run from a parent workspace containing child Git repos.")
    }'
    exit 1
  fi

  mkdir -p "$MARKER_DIR"
  summary_items="$(mktemp "${TMPDIR:-/tmp}/mcp-verify-all-repos.XXXXXX")"
  jq -n '[]' > "$summary_items"
  while IFS=$'\t' read -r child_label child_path; do
    [ -n "$child_path" ] || continue
    set +e
    child_output="$(bash "$0" --repo "$child_path")"
    child_status=$?
    set -e
    if [ -f "$MARKER_PATH" ] && jq -e . "$MARKER_PATH" >/dev/null 2>&1; then
      child_ledger="$(cat "$MARKER_PATH")"
      child_overall="$(jq -r 'if (.baseline_ready == true) then "ready" else "action-required" end' <<<"$child_ledger")"
      child_reason="$(jq -r '.reason_code // empty' <<<"$child_ledger")"
      child_result="$(jq -n --argjson ledger "$child_ledger" '{
        schema_version:"mcp-verify-child-result.v1",
        baseline_ready:($ledger.baseline_ready // false),
        repo_config_status:($ledger.repo_config_status // "unknown"),
        runtime_capabilities_status:($ledger.runtime_capabilities_status // "unknown"),
        provider_artifacts_status:($ledger.provider_artifacts_status // "unknown"),
        graph_bootstrap_required:($ledger.graph_bootstrap_required // true),
        reason_code:($ledger.reason_code // ""),
        next_actions:($ledger.next_actions // [])
      }')"
    else
      child_overall="action-required"
      child_reason="child-verify-ledger-unavailable"
      child_result="$(jq -n --arg output "$child_output" '{schema_version:"mcp-verify-child-result.v1",baseline_ready:false,reason_code:"child-verify-ledger-unavailable",diagnostic:$output}')"
    fi
    if [ "$child_status" -ne 0 ] && [ "$child_overall" = "ready" ]; then
      child_overall="action-required"
      child_reason="child-verify-failed"
    fi
    jq \
      --arg repo_label "$child_label" \
      --arg workspace_relative_path "$child_path" \
      --argjson exit_code "$child_status" \
      --arg overall_status "$child_overall" \
      --arg reason_code "$child_reason" \
      --argjson result "$child_result" \
      '. + [{
        repo_label:$repo_label,
        workspace_relative_path:$workspace_relative_path,
        exit_code:$exit_code,
        overall_status:$overall_status,
        reason_code:(if $reason_code == "" then null else $reason_code end),
        result:$result
      }]' "$summary_items" > "$summary_items.next"
    mv "$summary_items.next" "$summary_items"
  done < <(jq -r '.candidates[] | [.repo_label, .workspace_relative_path] | @tsv' <<<"$target_json")

  quarantine_json="$(build_parent_artifact_quarantine_json "$workspace_root" 2>/dev/null || true)"
  if [ -n "$quarantine_json" ] && jq -e . >/dev/null 2>&1 <<<"$quarantine_json"; then
    parent_workspace_pollution_count="$(jq -r '(.quarantined_paths // []) | length' <<<"$quarantine_json")"
  else
    parent_workspace_pollution_count=0
  fi

  summary_json="$(jq -n \
    --arg generated_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --arg selection_source "$selection_source" \
    --argjson target "$target_json" \
    --argjson parent_workspace_pollution_count "$parent_workspace_pollution_count" \
    --slurpfile items "$summary_items" \
    '($items[0] // []) as $results
    | {
        schema_version:"workspace-mcp-verify-summary.v1",
        generated_at:$generated_at,
        advisory:true,
        workflow_mode:"all-repos",
        selection_source:$selection_source,
        workspace_root:($target.workspace_root // null),
        parent_workspace_advisory:{
          git_health:($target.git_health // null),
          coverage_gap:($target.coverage_gap // null),
          candidates_diagnostics:($target.candidates_diagnostics // []),
          repair_action_available:(($target.git_health.status // "") == "broken-worktree"),
          repair_command:(if (($target.git_health.status // "") == "broken-worktree") then "spec-first repair-worktree --dry-run" else null end),
          diagnostic_action_available:(($target.git_health.status // "") == "corrupted-gitdir"),
          diagnostic_command:(if (($target.git_health.status // "") == "corrupted-gitdir") then "git fsck" else null end)
        },
        parent_writes_repo_local_artifacts:false,
        results:$results,
        counts:{
          total:($results | length),
          ready:([$results[] | select(.overall_status == "ready")] | length),
          action_required:([$results[] | select(.overall_status != "ready")] | length)
        },
        overall_status:(
          if ($results | length) == 0 then "action-required"
          elif ([$results[] | select(.overall_status != "ready")] | length) == 0 then "ready"
          elif ([$results[] | select(.overall_status == "ready")] | length) > 0 then "partial"
          else "action-required"
          end
        ),
        reason_code:(
          if ($results | length) == 0 then "workspace-no-git-candidates"
          elif ([$results[] | select(.overall_status != "ready")] | length) == 0 then null
          else "all-repos-partial-or-action-required"
          end
        ),
        parent_workspace_pollution_count:$parent_workspace_pollution_count,
        runtime_hints:(
          if $parent_workspace_pollution_count > 0 then
            ["- Workspace pollution detected: wrote .spec-first/workspace/parent-artifact-quarantine.json (\($parent_workspace_pollution_count) paths quarantined). Run `spec-first clean --workspace-orphans` for read-only inspection."]
          else
            []
          end
        ),
        next_action:(
          if ([$results[] | select(.overall_status != "ready")] | length) == 0 then
            "All child repos verified Required Harness Runtime readiness."
          else
            "Inspect per-child reason_code and rerun setup/verify for action-required repos."
          end
        )
      }')"
  rm -f "$summary_items"
  if [ -n "$quarantine_json" ] && ! printf '%s\n' "$quarantine_json" | write_workspace_summary_atomic "$workspace_root" "parent-artifact-quarantine.json"; then
    echo "verify-tools.sh: parent artifact quarantine write failed; continuing" >&2
  fi
  if ! printf '%s\n' "$summary_json" | write_workspace_summary_atomic "$workspace_root" "mcp-verify-summary.json"; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-verify-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"workspace-summary-symlink-escape",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Replace symlinked .spec-first/workspace with a real workspace-local directory and rerun verify."
    }'
    exit 1
  fi
  printf '%s\n' "$summary_json"
  if [ "$(jq -r '.overall_status' <<<"$summary_json")" != "ready" ]; then
    exit 1
  fi
  exit 0
}

DETECT_ARGS=()
if [ -n "$REPO_ARG" ] && [ "$ALL_REPOS" != "true" ]; then
  DETECT_ARGS+=(--repo "$REPO_ARG")
fi
if [ -n "$FOLDER_ARG" ] && [ "$ALL_REPOS" != "true" ]; then
  DETECT_ARGS+=(--folder "$FOLDER_ARG")
fi

if [ "$ALL_REPOS" = "true" ]; then
  set +e
  TARGET_JSON="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format json)"
  TARGET_STATUS=$?
  set -e
  [ -n "$TARGET_JSON" ] || { echo "verify-tools.sh: target resolver returned no JSON output" >&2; exit 1; }
  if [ "$TARGET_STATUS" -ne 0 ]; then
    :
  fi
  write_all_repos_verify_summary_and_exit "$TARGET_JSON" "explicit-all-repos"
fi

if [ -z "$REPO_ARG" ] && [ -z "$FOLDER_ARG" ]; then
  set +e
  DEFAULT_TARGET_JSON="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format json)"
  DEFAULT_TARGET_STATUS=$?
  set -e
  [ -n "$DEFAULT_TARGET_JSON" ] || { echo "verify-tools.sh: target resolver returned no JSON output" >&2; exit 1; }
  DEFAULT_TARGET_MODE="$(jq -r '.mode // empty' <<<"$DEFAULT_TARGET_JSON")"
  DEFAULT_TARGET_CANDIDATE_COUNT="$(jq -r '(.candidates // []) | length' <<<"$DEFAULT_TARGET_JSON")"
  if [ "$DEFAULT_TARGET_MODE" != "git-repo" ] && [ "$DEFAULT_TARGET_CANDIDATE_COUNT" -gt 0 ]; then
    if [ "$DEFAULT_TARGET_STATUS" -ne 0 ]; then
      :
    fi
    write_all_repos_verify_summary_and_exit "$DEFAULT_TARGET_JSON" "workspace-default-all-repos"
  fi
fi

FACTS_JSON="$(bash "$SCRIPT_DIR/detect-tools.sh" ${DETECT_ARGS[@]+"${DETECT_ARGS[@]}"})"
HELPER_JSON="$(bash "$SCRIPT_DIR/install-helpers.sh" --verify-only)"

# U2: facts 给出 child repo root 后再做 reconciliation,
# 让 --repo <child> 在 parent workspace 下也能正确比对 runtime-capabilities.json。
RECONCILIATION_HOST="$(jq -r '.host // empty' <<<"$FACTS_JSON")"
RECONCILIATION_REPO_ROOT="$(jq -r '.selected_repo_root // .selected_folder_root // .target.target_root // .repo_root // empty' <<<"$FACTS_JSON")"
HOST_POINTER_RECONCILIATION="$(compute_host_pointer_reconciliation "$RECONCILIATION_HOST" "$RECONCILIATION_REPO_ROOT" "$MARKER_PATH")"

mkdir -p "$MARKER_DIR"
[ -w "$MARKER_DIR" ] || { echo "verify-tools.sh: 无法写入 ${MARKER_DIR}" >&2; exit 1; }

combined_tmp="$(mktemp "${MARKER_DIR}/readiness-ledger-combined.XXXXXX")"
final_tmp="$(mktemp "${MARKER_DIR}/readiness-ledger.XXXXXX")"
trap 'rm -f "$combined_tmp" "$final_tmp"' EXIT
chmod 600 "$combined_tmp" "$final_tmp"

jq --arg completed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg marker_path "$MARKER_PATH" \
  --argjson helper "$HELPER_JSON" \
  --argjson host_pointer_reconciliation "$HOST_POINTER_RECONCILIATION" \
  '
  def host_ready:
    ((.host_config_required == false) and (.host_config_status == "not-required"))
    or (.host_config_status == "ready")
    or (.host_config_status == "fallback-active");
  def tool_ready:
    (.dependency_status == "ready")
    and host_ready
    and ((.project_status == "ready") or (.project_status == "not-applicable") or (.project_status == "workspace-target-required"));
  def baseline_blocking:
    if has("baseline_blocking") then .baseline_blocking else true end;
  def helper_ready:
    ((.result // "action-required") == "ready")
    or ((baseline_blocking == false) and (((.result // "") == "degraded") or ((.result // "") == "skipped")));
  def helper_action_required:
    (baseline_blocking == true)
    or (((.result // "") != "ready") and (((.result // "") != "degraded") and ((.result // "") != "skipped")));
  def parent_workspace_advisory($facts):
    ($facts.git_health // $facts.target.git_health // null) as $git_health
    | ($git_health.status // "") as $git_status
    | {
        git_health: $git_health,
        coverage_gap: ($facts.coverage_gap // $facts.target.coverage_gap // null),
        candidates_diagnostics: ($facts.candidates_diagnostics // $facts.target.candidates_diagnostics // []),
        repair_action_available: ($git_status == "broken-worktree"),
        repair_command: (if $git_status == "broken-worktree" then "spec-first repair-worktree --dry-run" else null end),
        diagnostic_action_available: ($git_status == "corrupted-gitdir"),
        diagnostic_command: (if $git_status == "corrupted-gitdir" then "git fsck" else null end)
      };

  . as $facts
  | ($helper.helper_tools // {}) as $helper_tools
  | ([($facts.tools // {})[] | tool_ready] | all) as $tools_ready
  | ([($helper_tools // {})[] | helper_ready] | all) as $helper_ready
  | ($tools_ready and $helper_ready) as $baseline_ready
  | {
      schema_version: "v2",
      host: $facts.host,
      platform: $facts.platform,
      repo_root: $facts.repo_root,
      repo_status: $facts.repo_status,
      target: ($facts.target // null),
      target_mode: ($facts.target_mode // ""),
      target_kind: ($facts.target_kind // ""),
      workspace_root: ($facts.workspace_root // null),
      selected_repo_root: ($facts.selected_repo_root // null),
      selected_folder_root: ($facts.selected_folder_root // null),
      target_root: ($facts.target.target_root // $facts.repo_root // null),
      parent_workspace_advisory: parent_workspace_advisory($facts),
      target_candidate_count: ($facts.target_candidate_count // 0),
      target_candidates: ($facts.target_candidates // []),
      reason_code: ($facts.reason_code // ""),
      host_ledger_pointer: {
        host: $facts.host,
        path: $marker_path,
        schema_version: "v2"
      },
      host_pointer_reconciliation: $host_pointer_reconciliation,
      repo_config_status: "pending",
      repo_config_path: null,
      runtime_capabilities_status: "pending",
      runtime_capabilities_path: null,
      provider_artifacts_status: "pending",
      provider_artifacts_path: null,
      overall_status: (if $baseline_ready then "ready" else "action-required" end),
      baseline_ready: $baseline_ready,
      host_runtime_ready: $baseline_ready,
      graph_bootstrap_required: true,
      completed_at: $completed_at,
      tools: $facts.tools,
      graph_providers: $facts.graph_providers,
      helper_tools: $helper_tools,
      mirror_endpoints: ($helper.mirror_endpoints // null),
      recommended_environment_variables: ($helper.recommended_environment_variables // null),
      next_actions: (
        (($facts.next_actions // []) + [
          ($helper_tools // {})[] | select(helper_action_required) | .next_action // ""
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
   | .runtime_capabilities_status = ($provider.runtime_capabilities_status // "unknown")
   | .runtime_capabilities_path = ($provider.runtime_capabilities_path // null)
   | .provider_artifacts_status = ($provider.provider_artifacts_status // "unknown")
   | .provider_artifacts_path = ($provider.provider_artifacts_path // null)
   | .graph_bootstrap_required = (
       if ($provider | has("graph_bootstrap_required")) then
         ($provider.graph_bootstrap_required == true)
       else
         (.graph_bootstrap_required // true)
       end
     )
   | ($provider.providers // {}) as $providers
   | reduce ($providers | to_entries[]) as $provider_entry (.;
       if (.tools[$provider_entry.key]? != null) then
         .tools[$provider_entry.key].query_ready = ($provider_entry.value.query_ready // false)
         | .tools[$provider_entry.key].bootstrap_required = (
             if ($provider_entry.value | has("bootstrap_required")) then
               ($provider_entry.value.bootstrap_required == true)
             else
               true
             end
           )
         | .tools[$provider_entry.key].next_action = ($provider_entry.value.next_action // "")
       else
         .
       end
       | if (.graph_providers[$provider_entry.key]? != null) then
         .graph_providers[$provider_entry.key].query_ready = ($provider_entry.value.query_ready // false)
         | .graph_providers[$provider_entry.key].bootstrap_required = (
             if ($provider_entry.value | has("bootstrap_required")) then
               ($provider_entry.value.bootstrap_required == true)
             else
               true
             end
           )
         | .graph_providers[$provider_entry.key].next_action = ($provider_entry.value.next_action // "")
       else
         .
       end
     )
   | ([.helper_tools[]? | select((if has("baseline_blocking") then .baseline_blocking else true end) == false and (((.result // "") == "degraded") or ((.result // "") == "skipped"))) | .next_action // ""]) as $nonblocking_helper_actions
   | .next_actions = (
       ((.next_actions // []) | map(. as $action | select(
         . != "run spec-graph-bootstrap"
         and . != "enter a git repo and run spec-graph-bootstrap"
         and (($nonblocking_helper_actions | index($action)) == null)
       )))
       + (if ((.target.state_write_allowed // false) != true and ((.target.next_action // "") != "")) then
            [.target.next_action]
          elif .repo_status == "not-git-repo" and (.target_kind // "") != "non-git-folder" then
            ["choose a child repo and rerun with --repo <child>"]
          elif (.baseline_ready == true and .graph_bootstrap_required == true) then
            ["run spec-graph-bootstrap"]
          else
            []
          end)
       | map(select(. != ""))
       | unique
     )
   | ([.repo_config_status, .runtime_capabilities_status, .provider_artifacts_status]
      | any(. != "ready" and . != "written")) as $provider_action_required
   | .baseline_ready = ((.baseline_ready == true) and ($provider_action_required | not))
   | .host_runtime_ready = (.baseline_ready == true)
   | .overall_status = (if .baseline_ready == true then "ready" else "action-required" end)' "$combined_tmp" > "$final_tmp"

mv "$final_tmp" "$MARKER_PATH"
write_setup_scenario_fingerprint

echo "📝 宿主就绪标记已更新: $MARKER_PATH"
echo "🔎 当前宿主基线状态: $(jq -r '.overall_status' "$MARKER_PATH")"
echo "🧭 baseline_ready: $(jq -r '.baseline_ready' "$MARKER_PATH")"
if [ "$(jq -r 'if has("graph_bootstrap_required") then (.graph_bootstrap_required | tostring) else "true" end' "$MARKER_PATH")" = "true" ]; then
  echo "🧩 Graph providers are configured but not query-ready yet."
else
  echo "🧩 Graph providers are query-ready."
fi
echo "✅ readiness ledger v2 已写入"
echo ""
echo "Required Harness Runtime status (grouped):"
render_status_block() {
  node "$SCRIPT_DIR/render-status-block.cjs"
}

jq -c '
  def display($value):
    if ($value == null or $value == "" or $value == "not-applicable") then "n/a"
    elif $value == "fallback-active" then "fallback"
    else ($value | tostring) end;
  def query($value):
    if $value == true then "ready" elif $value == false then "pending" else "n/a" end;
  def bootstrap($value):
    if $value == true then "required" elif $value == false then "done" else "n/a" end;
  def provider_names($ready):
    [(.tools // {} | to_entries[] | select((.value.type // "") == "graph-provider" and ((.value.query_ready // false) == $ready)) | .key)]
    | if length == 0 then "n/a" else join(",") end;
  def remark($key):
    if $key == "sequential-thinking" then "反思式推理辅助"
    elif $key == "context7" then "当前框架和库文档"
    elif $key == "gitnexus" then "全局代码知识图谱与影响分析"
    elif $key == "agent-browser" then "浏览器自动化辅助"
    elif $key == "gh" then "GitHub issue 和 PR 操作"
    elif $key == "jq" then "JSON 解析与转换"
    elif $key == "vhs" then "终端演示录制"
    elif $key == "silicon" then "代码截图渲染"
    elif $key == "ffmpeg" then "媒体转换与视频合成"
    elif $key == "ast-grep" then "结构化代码搜索和重写"
    elif $key == "ast-grep-skill" then "ast-grep 使用指引"
    else "工具" end;
  def summary_rows:
    [
      [
        "Harness runtime",
        (if .baseline_ready == true then "ready" else "action-required" end),
        "baseline_ready=\((.baseline_ready // false) | tostring)",
        (if .baseline_ready == true then "" else "fix action-required rows" end)
      ],
      [
        "Graph readiness",
        (if .graph_bootstrap_required == true then "pending" else "ready" end),
        "ready: \(provider_names(true)); pending: \(provider_names(false))",
        (if .graph_bootstrap_required == true then "run spec-graph-bootstrap" else "" end)
      ]
    ];
  def mcp_rows:
    [(.tools // {} | to_entries[] | select((.value.type // "") == "mcp") |
      [display(.key), remark(.key), display(.value.dependency_status), display(.value.host_config_status), display(.value.project_status), display(.value.next_action)])];
  def graph_rows:
    [(.tools // {} | to_entries[] | select((.value.type // "") == "graph-provider") |
      [display(.key), remark(.key), display(.value.dependency_status), display(.value.host_config_status), query(.value.query_ready), bootstrap(.value.bootstrap_required), display(.value.next_action)])];
  def helper_rows:
    [(.helper_tools // {} | to_entries[] |
      [display(.key), display(.value.type // "helper"), display(.value.result), display(.value.dependency_status), display(.value.install_status), display(.value.skill_status), display(.value.next_action)])];
  def project_rows:
    [
      {
        name: "graph-providers.json",
        status: .repo_config_status,
        next: (if (.repo_config_status == "ready" or .repo_config_status == "written") then "" elif ((.target.next_action // "") != "") then .target.next_action else "write provider projection" end)
      },
      {
        name: "runtime-capabilities.json",
        status: .runtime_capabilities_status,
        next: (if (.runtime_capabilities_status == "ready" or .runtime_capabilities_status == "written") then "" elif ((.target.next_action // "") != "") then .target.next_action else "write runtime capabilities" end)
      },
      {
        name: "provider-artifacts.json",
        status: .provider_artifacts_status,
        next: (if (.provider_artifacts_status == "ready" or .provider_artifacts_status == "written") then "" elif ((.target.next_action // "") != "") then .target.next_action else "write provider artifacts" end)
      }
    ]
    | map([display(.name), display(.status), display(.next)]);
  {
    sections: [
      {title: "Execution result", headers: ["Area", "Status", "Evidence", "Next"], rows: summary_rows},
      {title: "MCP servers", headers: ["Name", "Role", "Dependency", "Host", "Project", "Next"], rows: mcp_rows},
      {title: "Graph providers", headers: ["Name", "Role", "Dependency", "Host", "Query", "Bootstrap", "Next"], rows: graph_rows},
      {title: "Helper tools", headers: ["Name", "Type", "Result", "Dependency", "Install", "Skill", "Next"], rows: helper_rows},
      {title: "Project setup facts", headers: ["Artifact", "Project", "Next"], rows: project_rows}
    ]
  }
' "$MARKER_PATH" | render_status_block

host_name="$(jq -r '.host // "unknown"' "$MARKER_PATH")"
baseline_ready="$(jq -r '.baseline_ready // false' "$MARKER_PATH")"
graph_bootstrap_required="$(jq -r '.graph_bootstrap_required // false' "$MARKER_PATH")"
case "$host_name" in
  claude)
    host_display="Claude Code"
    setup_command="/spec:mcp-setup"
    graph_command="/spec:graph-bootstrap"
    ;;
  codex)
    host_display="Codex"
    setup_command='$spec-mcp-setup'
    graph_command='$spec-graph-bootstrap'
    ;;
  *)
    host_display="Claude Code / Codex"
    setup_command='/spec:mcp-setup or $spec-mcp-setup'
    graph_command='/spec:graph-bootstrap or $spec-graph-bootstrap'
    ;;
esac

echo ""
echo "下一步:"
if [ "$baseline_ready" = "true" ]; then
  target_state_write_allowed="$(jq -r 'if (.target | type == "object") then (.target.state_write_allowed | tostring) else "true" end' "$MARKER_PATH")"
  target_next_action="$(jq -r '.target.next_action // empty' "$MARKER_PATH")"
  if [ "$target_state_write_allowed" != "true" ]; then
    echo "  1. 选择目标 child repo，并用 --repo 重新运行 ${setup_command} / ${graph_command}。"
    if [ -n "$target_next_action" ]; then
      echo "     $target_next_action"
    fi
  elif [ "$graph_bootstrap_required" = "true" ]; then
    echo "  1. 现在可以运行 ${graph_command} 完成 deterministic graph readiness 编译；也可以在本会话直接回复“继续完成”，让 agent 调用 bootstrap 脚本。"
    echo "  2. 如果只需要 Plan 阶段 live GitNexus evidence，可在当前已可见 MCP surface 下进入 plan；若 setup 刚写入 MCP 配置，先重启 ${host_display} 或新开会话再 probe。"
    echo "  3. dirty worktree 或 stale durable readiness 不等于 Plan 不能使用 prior/session-local GitNexus evidence；需要 durable readiness 时再运行 ${graph_command}。"
    echo "  4. graph readiness 完成后，按用户意图进入 plan/work/review/debug 等下游 workflow；项目指导来自 AGENTS.md、CLAUDE.md、docs/contracts、源码、测试和 graph readiness facts。"
    echo "  5. 重启 ${host_display} 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。"
  else
    echo "  1. graph readiness 已就绪；如果已经有明确任务，可以在新会话直接描述目标，或选择匹配的 plan/work/review/debug workflow。"
    echo "  2. 如果已经有明确任务，可以在新会话直接描述目标；using-spec-first 会按意图选择合适 workflow。"
    echo "  3. 重启 ${host_display} 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。"
  fi
else
  echo "  1. 先处理表格中的 action-required 行，然后重新运行 ${setup_command}。"
  echo "  2. 全部 ready 后重启 ${host_display} 或新开会话，让新写入的 MCP 配置被宿主加载。"
fi
