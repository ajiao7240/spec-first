#!/bin/bash
# bootstrap-providers.sh - Compile project graph provider readiness facts.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOLVER="$SCRIPT_DIR/../../spec-mcp-setup/scripts/resolve-project-target.sh"
REPO_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "bootstrap-providers.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    *)
      echo "bootstrap-providers.sh: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

TARGET_ARGS=()
if [ -n "$REPO_ARG" ]; then
  TARGET_ARGS+=(--repo "$REPO_ARG")
fi
set +e
TARGET_JSON="$(bash "$RESOLVER" --format json ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"})"
TARGET_STATUS=$?
set -e
[ -n "$TARGET_JSON" ] || { echo "bootstrap-providers.sh: target resolver returned no JSON output" >&2; exit 1; }
TARGET_STATE_WRITE_ALLOWED="$(jq -r '.state_write_allowed | tostring' <<<"$TARGET_JSON")"
if [ "$TARGET_STATUS" -ne 0 ] || [ "$TARGET_STATE_WRITE_ALLOWED" != "true" ]; then
  jq -n --argjson target "$TARGET_JSON" '{
    schema_version:"graph-bootstrap-result.v1",
    overall_status:"action-required",
    workflow_mode:"blocked",
    reason_code:($target.reason_code // "workspace-target-required"),
    workspace_root:($target.workspace_root // null),
    candidates:($target.candidates // []),
    next_action:($target.next_action // "Choose a child Git repo and rerun with --repo <child>.")
  }'
  exit 1
fi

REPO_ROOT="$(jq -r '.selected_repo_root' <<<"$TARGET_JSON")"
INVOCATION_WORKSPACE_ROOT="$(jq -r '.workspace_root // empty' <<<"$TARGET_JSON")"
SELECTION_SOURCE="$(jq -r '.selection_source // empty' <<<"$TARGET_JSON")"
SPEC_DIR="$REPO_ROOT/.spec-first"
CONFIG_DIR="$SPEC_DIR/config"
PROVIDER_CONFIG="$CONFIG_DIR/graph-providers.json"
RUNTIME_CAPABILITIES="$CONFIG_DIR/runtime-capabilities.json"
PROVIDER_ARTIFACTS="$CONFIG_DIR/provider-artifacts.json"
GRAPH_DIR="$SPEC_DIR/graph"
IMPACT_DIR="$SPEC_DIR/impact"
PROVIDERS_DIR="$SPEC_DIR/providers"

mkdir -p "$GRAPH_DIR" "$IMPACT_DIR" "$PROVIDERS_DIR"

BOOTSTRAPPED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SOURCE_REVISION="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
if [ -z "$SOURCE_REVISION" ]; then
  jq -n '{schema_version:"graph-bootstrap-result.v1",overall_status:"action-required",workflow_mode:"blocked",reason_code:"repo-snapshot-unavailable",next_action:"Resolve git repository state before graph bootstrap."}'
  exit 1
fi
WORKTREE_STATUS="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)"
if [ -n "$WORKTREE_STATUS" ]; then
  WORKTREE_DIRTY=true
else
  WORKTREE_DIRTY=false
fi

relpath() {
  local path="$1"
  case "$path" in
    "$REPO_ROOT"/*) printf '%s\n' "${path#"$REPO_ROOT"/}" ;;
    *) printf '%s\n' "$path" ;;
  esac
}

resolve_pointer_path() {
  local pointer="$1"
  case "$pointer" in
    "~/"*) printf '%s\n' "$HOME/${pointer#~/}" ;;
    '$HOME/'*) printf '%s\n' "$HOME/${pointer#\$HOME/}" ;;
    *) printf '%s\n' "$pointer" ;;
  esac
}

write_file_atomic() {
  local path="$1"
  local tmp
  tmp="$(mktemp "${path}.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$path"
}

write_blocked_report() {
  local workflow_mode="$1"
  local reason_code="$2"
  local next_action="$3"
  write_file_atomic "$GRAPH_DIR/bootstrap-report.md" <<MD
# Graph Bootstrap Report

- workflow_mode: $workflow_mode
- reason_code: $reason_code
- next_action: $next_action
MD
}

emit_blocked() {
  local workflow_mode="$1"
  local reason_code="$2"
  local next_action="$3"
  local exit_code="${4:-1}"
  write_blocked_report "$workflow_mode" "$reason_code" "$next_action"
  jq -n \
    --arg repo_root "$REPO_ROOT" \
    --arg invocation_workspace_root "$INVOCATION_WORKSPACE_ROOT" \
    --arg selection_source "$SELECTION_SOURCE" \
    --arg workflow_mode "$workflow_mode" \
    --arg reason_code "$reason_code" \
    --arg next_action "$next_action" \
    '{
      schema_version:"graph-bootstrap-result.v1",
      overall_status:"action-required",
      workflow_mode:$workflow_mode,
      reason_code:$reason_code,
      repo_root:$repo_root,
      invocation_workspace_root:$invocation_workspace_root,
      selection_source:$selection_source,
      next_action:$next_action
    }'
  exit "$exit_code"
}

require_file_schema() {
  local path="$1"
  local schema="$2"
  local reason="$3"
  [ -f "$path" ] || emit_blocked blocked "$reason" "Run spec-mcp-setup inside this git repo first."
  local actual
  actual="$(jq -r '.schema_version // empty' "$path" 2>/dev/null || true)"
  [ "$actual" = "$schema" ] || emit_blocked blocked schema-unsupported "Rerun spec-mcp-setup to regenerate v1 config artifacts."
}

require_file_schema "$PROVIDER_CONFIG" "graph-providers.v1" "missing_provider_config"
require_file_schema "$RUNTIME_CAPABILITIES" "runtime-capabilities.v1" "missing_runtime_capabilities"
require_file_schema "$PROVIDER_ARTIFACTS" "provider-artifacts.v1" "missing_provider_artifacts"

LEDGER_POINTER="$(jq -r '.host_ledger_pointer.path // empty' "$RUNTIME_CAPABILITIES")"
[ -n "$LEDGER_POINTER" ] || emit_blocked blocked readiness-conflict "Rerun spec-mcp-setup to write host_ledger_pointer."
LEDGER_PATH="$(resolve_pointer_path "$LEDGER_POINTER")"
[ -f "$LEDGER_PATH" ] || emit_blocked blocked readiness-conflict "Rerun spec-mcp-setup; host readiness ledger pointer is not readable."
[ "$(jq -r '.schema_version // empty' "$LEDGER_PATH")" = "v2" ] || emit_blocked blocked schema-unsupported "Rerun spec-mcp-setup to write readiness ledger v2."

RUNTIME_BASELINE="$(jq -r 'if (.baseline_summary | type == "object" and has("baseline_ready")) then (.baseline_summary.baseline_ready | tostring) else "" end' "$RUNTIME_CAPABILITIES")"
LEDGER_BASELINE="$(jq -r '.baseline_ready // false' "$LEDGER_PATH")"
if [ -n "$RUNTIME_BASELINE" ] && [ "$RUNTIME_BASELINE" != "$LEDGER_BASELINE" ]; then
  emit_blocked blocked readiness-conflict "Rerun spec-mcp-setup; runtime capabilities and host ledger disagree."
fi
if [ "$LEDGER_BASELINE" != "true" ]; then
  emit_blocked setup-not-ready baseline_not_ready "Fix Required Harness Runtime setup, then rerun spec-mcp-setup."
fi

command_shape_supported() {
  local provider="$1"
  local kind="$2"
  jq -e --arg provider "$provider" --arg kind "$kind" --arg repo_root "$REPO_ROOT" '
    def string_array:
      type == "array" and length > 0 and all(.[]; type == "string");
    def safe_args:
      all(.[]; (test("[;&|`$<>]") | not));
    def gitnexus_subcommand:
      if $kind == "bootstrap" then "analyze"
      elif $kind == "status" then "status"
      elif $kind == "query_probe" then "query"
      else null end;
    def crg_tail:
      if length >= 3 and .[0] == "uvx" and ((.[1] == "--upgrade") or (.[1] == "--refresh")) and .[2] == "code-review-graph" then .[3:]
      elif length >= 2 and .[0] == "uvx" and .[1] == "code-review-graph" then .[2:]
      else [] end;
    def crg_shape:
      (crg_tail) as $tail
      | if $kind == "bootstrap" then $tail == ["build"]
      elif $kind == "status" then $tail == ["status"]
      elif $kind == "query_probe" then $tail == ["status", "--repo", $repo_root]
      else false end;
    (.providers[$provider].commands[$kind]) as $cmd
    | ($cmd | string_array)
    and ($cmd | safe_args)
    and (
      if $provider == "gitnexus" then
        if $kind == "query_probe" then
          ($cmd | length == 7 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == "query" and (.[4] | length > 0) and .[5] == "--repo" and (.[6] | length > 0))
        elif $kind == "bootstrap" then
          (
            ($cmd | length == 4 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == "analyze")
            or
            ($cmd | length == 5 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == "analyze" and .[4] == "--force")
          )
        else
          ($cmd | length == 4 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == gitnexus_subcommand)
        end
      elif $provider == "code-review-graph" then
        ($cmd | crg_shape)
      else false end
    )
  ' "$PROVIDER_CONFIG" >/dev/null
}

provider_enabled() {
  local provider="$1"
  jq -e --arg provider "$provider" '
    .providers[$provider].configured == true
    and .providers[$provider].enabled_for_bootstrap == true
    and .providers[$provider].dependency_status == "ready"
    and (
      (.providers[$provider].host_config_status == "ready")
      or (.providers[$provider].host_config_status == "fallback-active")
      or ((.providers[$provider].host_config_required == false) and (.providers[$provider].host_config_status == "not-required"))
    )
  ' "$PROVIDER_CONFIG" >/dev/null
}

while IFS= read -r provider; do
  case "$provider" in
    gitnexus|code-review-graph) ;;
    *) emit_blocked blocked unsupported-provider-command "Unsupported graph provider id: $provider" ;;
  esac
  for kind in bootstrap status query_probe; do
    if ! command_shape_supported "$provider" "$kind"; then
      emit_blocked blocked unsupported-provider-command "Provider command shape is unsupported for $provider:$kind."
    fi
  done
done < <(jq -r '.providers | keys[]' "$PROVIDER_CONFIG")

command_display() {
  local provider="$1"
  local kind="$2"
  jq -r --arg provider "$provider" --arg kind "$kind" '.providers[$provider].commands[$kind] | join(" ")' "$PROVIDER_CONFIG"
}

RUN_EXIT_CODE=0
RUN_DIAGNOSTIC=""
RUN_TRUNCATED=false

run_configured_command() {
  local provider="$1"
  local kind="$2"
  local log_path="$3"
  local cmd=()
  local byte_count

  mkdir -p "$(dirname "$log_path")"
  while IFS= read -r arg; do
    cmd+=("$arg")
  done < <(jq -r --arg provider "$provider" --arg kind "$kind" '.providers[$provider].commands[$kind][]' "$PROVIDER_CONFIG")

  set +e
  printf 'spec-graph-bootstrap: running %s %s; dependencies may download on first use...\n' "$provider" "$kind" >&2
  (cd "$REPO_ROOT" && "${cmd[@]}") > "$log_path" 2>&1
  RUN_EXIT_CODE=$?
  printf 'spec-graph-bootstrap: finished %s %s with exit %s\n' "$provider" "$kind" "$RUN_EXIT_CODE" >&2
  set -e

  byte_count="$(wc -c < "$log_path" | tr -d ' ')"
  if [ "${byte_count:-0}" -gt 1000 ]; then
    RUN_TRUNCATED=true
  else
    RUN_TRUNCATED=false
  fi
  RUN_DIAGNOSTIC="$(tr '\n' ' ' < "$log_path" | cut -c 1-1000)"
}

QUERY_PROBE_VERIFICATION_REASON=""

gitnexus_query_probe_has_bad_diagnostics() {
  local log_path="$1"
  grep -Eiq 'FTS index ensure failed|Cannot execute write operations in a read-only database|doesn.?t have an index|Connection exception|BM25/FTS search failed|FTS extension unavailable|missing[ -]index' "$log_path"
}

gitnexus_query_probe_has_results() {
  local log_path="$1"
  local json_payload
  json_payload="$(awk 'found || /^[[:space:]]*\{/ { found=1; print }' "$log_path" || true)"
  [ -n "$json_payload" ] || return 1
  jq -e '
    (.warning? | not)
    and (((.processes // []) | length)
      + ((.process_symbols // []) | length) > 0)
  ' >/dev/null 2>&1 <<<"$json_payload"
}

gitnexus_query_probe_is_definitions_only() {
  local log_path="$1"
  local json_payload
  json_payload="$(awk 'found || /^[[:space:]]*\{/ { found=1; print }' "$log_path" || true)"
  [ -n "$json_payload" ] || return 1
  jq -e '
    (.warning? | not)
    and ((((.processes // []) | length)
      + ((.process_symbols // []) | length)) == 0)
    and (((.definitions // []) | length) > 0)
  ' >/dev/null 2>&1 <<<"$json_payload"
}

query_probe_verified() {
  local provider="$1"
  local log_path="$2"
  QUERY_PROBE_VERIFICATION_REASON=""
  if [ "$provider" != "gitnexus" ]; then
    return 0
  fi
  if gitnexus_query_probe_has_bad_diagnostics "$log_path"; then
    QUERY_PROBE_VERIFICATION_REASON="GitNexus query probe emitted FTS/read-only/missing-index diagnostics."
    return 1
  fi
  if gitnexus_query_probe_has_results "$log_path"; then
    return 0
  fi
  if gitnexus_query_probe_is_definitions_only "$log_path"; then
    QUERY_PROBE_VERIFICATION_REASON="GitNexus query probe returned definitions-only evidence without BM25/process query results."
  else
    QUERY_PROBE_VERIFICATION_REASON="GitNexus query probe did not return parseable non-empty BM25/process query results."
  fi
  return 1
}

classify_provider_failure() {
  local provider="$1"
  local phase="$2"
  local exit_code="$3"

  if [ "$provider" = "gitnexus" ] && [ "$phase" = "bootstrap" ] && [ "$exit_code" -eq 139 ]; then
    jq -n --argjson exit_code "$exit_code" '{
      failed_phase:"bootstrap",
      failure_class:"provider-crash",
      reason_code:"gitnexus-analyze-sigsegv",
      exit_code:$exit_code,
      recommended_action:"Do not trust GitNexus artifacts. Use code-review-graph and bounded local fallback; capture analyze.log and retry with a newer GitNexus rc or safer GitNexus runtime settings."
    }'
  elif [ "$exit_code" -ne 0 ]; then
    jq -n --arg phase "$phase" --argjson exit_code "$exit_code" '{
      failed_phase:$phase,
      failure_class:"provider-command-failed",
      reason_code:"provider-command-failed",
      exit_code:$exit_code,
      recommended_action:"Inspect the provider raw log and rerun graph bootstrap after fixing the provider command failure."
    }'
  else
    jq -n '{
      failed_phase:null,
      failure_class:null,
      reason_code:null,
      exit_code:null,
      recommended_action:null
    }'
  fi
}

append_command_result() {
  local results_file="$1"
  local kind="$2"
  local display="$3"
  local exit_code="$4"
  local diagnostic="$5"
  local truncated="$6"
  local raw_log="$7"
  jq --arg kind "$kind" \
     --arg display "$display" \
     --argjson exit_code "$exit_code" \
     --arg diagnostic "$diagnostic" \
     --argjson truncated "$truncated" \
     --arg raw_log "$raw_log" \
     '. + [{
       kind:$kind,
       command:$display,
       exit_code:$exit_code,
       diagnostic:$diagnostic,
       diagnostics_truncated:$truncated,
       raw_log:$raw_log
     }]' "$results_file" > "$results_file.next"
  mv "$results_file.next" "$results_file"
}

write_normalized_artifacts() {
  local provider="$1"
  local provider_status_path="$2"
  local query_ready="$3"
  local normalized_dir="$PROVIDERS_DIR/$provider/normalized"
  mkdir -p "$normalized_dir"

  if [ "$provider" = "gitnexus" ]; then
    for artifact in architecture-facts reuse-candidates; do
      jq -n \
        --arg provider "$provider" \
        --arg generated_at "$BOOTSTRAPPED_AT" \
        --arg source_status_path "$(relpath "$provider_status_path")" \
        --argjson query_ready "$query_ready" \
        '{
          schema_version:"provider-normalized-envelope.v1",
          provider:$provider,
          generated_at:$generated_at,
          source_status_path:$source_status_path,
          source_raw_logs:[".spec-first/providers/gitnexus/raw/analyze.log",".spec-first/providers/gitnexus/raw/status.log",".spec-first/providers/gitnexus/raw/query.log"],
          available_query_surfaces:(if $query_ready then ["status","query"] else [] end),
          capabilities:["architecture_map","dependency_map","execution_flow","repo_wiki","query_global_graph"],
          confidence:(if $query_ready then "high" else "low" end),
          limitations:(if $query_ready then [] else ["Provider query readiness is not verified."] end)
        }' | write_file_atomic "$normalized_dir/$artifact.json"
    done
  else
    jq -n \
      --arg provider "$provider" \
      --arg generated_at "$BOOTSTRAPPED_AT" \
      --arg source_status_path "$(relpath "$provider_status_path")" \
      --argjson query_ready "$query_ready" \
      '{
        schema_version:"provider-normalized-envelope.v1",
        provider:$provider,
        generated_at:$generated_at,
        source_status_path:$source_status_path,
        source_raw_logs:[".spec-first/providers/code-review-graph/raw/build.log",".spec-first/providers/code-review-graph/raw/status.log",".spec-first/providers/code-review-graph/raw/query.log"],
        available_query_surfaces:(if $query_ready then ["status","query_graph_tool","get_impact_radius_tool"] else [] end),
        capabilities:["detect_changes","blast_radius","minimal_context","review_context","related_tests","graph_stats"],
        confidence:(if $query_ready then "medium" else "low" end),
        limitations:(if $query_ready then ["code-review-graph query-surface proof is conservative and should be treated as provider readiness, not semantic evidence."] else ["Provider query readiness is not verified."] end)
      }' | write_file_atomic "$normalized_dir/impact-capabilities.json"
  fi
}

STATUS_FILES=()

write_provider_status() {
  local provider="$1"
  local provider_dir="$PROVIDERS_DIR/$provider"
  local raw_dir="$provider_dir/raw"
  local status_path="$provider_dir/status.json"
  local command_results
  local command_results_file
  local status="skipped"
  local graph_ready=false
  local query_ready=false
  local confidence="low"
  local limitations='["Provider is not configured for bootstrap."]'
  local failure_info='{"failed_phase":null,"failure_class":null,"reason_code":null,"exit_code":null,"recommended_action":null}'
  local configured enabled dependency_status host_config_required host_config_status host_ready skip_reason
  local bootstrap_log status_log query_log
  mkdir -p "$raw_dir" "$provider_dir/normalized"

  configured="$(jq -r --arg provider "$provider" '.providers[$provider].configured == true' "$PROVIDER_CONFIG")"
  enabled="$(jq -r --arg provider "$provider" '.providers[$provider].enabled_for_bootstrap == true' "$PROVIDER_CONFIG")"
  dependency_status="$(jq -r --arg provider "$provider" '.providers[$provider].dependency_status // "unknown"' "$PROVIDER_CONFIG")"
  host_config_required="$(jq -r --arg provider "$provider" '.providers[$provider] | if has("host_config_required") then .host_config_required else true end' "$PROVIDER_CONFIG")"
  host_config_status="$(jq -r --arg provider "$provider" '.providers[$provider].host_config_status // "unknown"' "$PROVIDER_CONFIG")"
  host_ready=false
  if [ "$host_config_status" = "ready" ] || [ "$host_config_status" = "fallback-active" ]; then
    host_ready=true
  elif [ "$host_config_required" != "true" ] && [ "$host_config_status" = "not-required" ]; then
    host_ready=true
  fi

  if [ "$configured" != "true" ]; then
    skip_reason="not-configured"
    limitations='["Provider is not configured."]'
  elif [ "$enabled" != "true" ]; then
    skip_reason="disabled-for-bootstrap"
    limitations='["Provider is disabled for bootstrap."]'
  elif [ "$dependency_status" != "ready" ]; then
    skip_reason="dependency-not-ready"
    limitations='["Provider dependency is not ready."]'
  elif [ "$host_ready" != "true" ]; then
    skip_reason="host-not-ready"
    limitations='["Provider host configuration is not ready."]'
  else
    skip_reason=""
  fi

  command_results_file="$(mktemp "${TMPDIR:-/tmp}/spec-graph-command-results.XXXXXX")"
  jq -n '[]' > "$command_results_file"

  if provider_enabled "$provider"; then
    if [ "$provider" = "gitnexus" ]; then
      bootstrap_log="$raw_dir/analyze.log"
    else
      bootstrap_log="$raw_dir/build.log"
    fi
    status_log="$raw_dir/status.log"
    query_log="$raw_dir/query.log"

    run_configured_command "$provider" bootstrap "$bootstrap_log"
    append_command_result "$command_results_file" bootstrap "$(command_display "$provider" bootstrap)" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$bootstrap_log")"
    if [ "$RUN_EXIT_CODE" -eq 0 ]; then
      run_configured_command "$provider" status "$status_log"
      append_command_result "$command_results_file" status "$(command_display "$provider" status)" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$status_log")"
      if [ "$RUN_EXIT_CODE" -eq 0 ]; then
        graph_ready=true
        run_configured_command "$provider" query_probe "$query_log"
        append_command_result "$command_results_file" query_probe "$(command_display "$provider" query_probe)" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$query_log")"
        if [ "$RUN_EXIT_CODE" -eq 0 ] && query_probe_verified "$provider" "$query_log"; then
          status="ready"
          query_ready=true
          confidence="high"
          limitations='[]'
        else
          status="query-unverified"
          query_ready=false
          confidence="medium"
          limitations="$(jq -n --arg reason "${QUERY_PROBE_VERIFICATION_REASON:-Provider-specific query-surface proof did not verify provider readiness.}" '["Build and status succeeded, but provider-specific query-surface proof did not verify provider readiness.", $reason]')"
        fi
      else
        status="query-unverified"
        query_ready=false
        confidence="medium"
        limitations='["Build succeeded, but status probe did not verify provider readiness."]'
      fi
    else
      status="failed"
      query_ready=false
      confidence="low"
      failure_info="$(classify_provider_failure "$provider" bootstrap "$RUN_EXIT_CODE")"
      limitations="$(jq -n --argjson failure "$failure_info" '["Provider bootstrap command failed."] + (if ($failure.recommended_action // "") != "" then [$failure.recommended_action] else [] end)')"
    fi
  fi

  command_results="$(cat "$command_results_file")"
  rm -f "$command_results_file"
  write_normalized_artifacts "$provider" "$status_path" "$query_ready"

  jq -n \
    --arg provider "$provider" \
    --arg generated_at "$BOOTSTRAPPED_AT" \
    --arg status "$status" \
    --argjson graph_ready "$graph_ready" \
    --argjson query_ready "$query_ready" \
    --argjson configured "$configured" \
    --argjson enabled "$enabled" \
    --arg dependency_status "$dependency_status" \
    --arg host_config_status "$host_config_status" \
    --arg skip_reason "$skip_reason" \
    --arg confidence "$confidence" \
    --arg source_revision "$SOURCE_REVISION" \
    --argjson worktree_dirty "$WORKTREE_DIRTY" \
    --argjson command_results "$command_results" \
    --argjson limitations "$limitations" \
    --argjson failure_info "$failure_info" \
    --slurpfile provider_config "$PROVIDER_CONFIG" \
    '{
      schema_version:"provider-status.v1",
      provider:$provider,
      generated_at:$generated_at,
      configured:$configured,
      enabled_for_bootstrap:$enabled,
      dependency_status:$dependency_status,
      host_config_status:$host_config_status,
      skip_reason:(if $status == "skipped" then $skip_reason else null end),
      status:$status,
      graph_ready:$graph_ready,
      query_ready:$query_ready,
      failed_phase:$failure_info.failed_phase,
      failure_class:$failure_info.failure_class,
      reason_code:$failure_info.reason_code,
      exit_code:$failure_info.exit_code,
      recommended_action:$failure_info.recommended_action,
      confidence:$confidence,
      limitations:$limitations,
      query_verification_reason:(if $status == "query-unverified" then ($limitations[-1] // null) else null end),
      query_probe_policy:($provider_config[0].providers[$provider].query_probe_policy // null),
      repo_snapshot:{
        source_revision:$source_revision,
        worktree_dirty:$worktree_dirty
      },
      command_results:$command_results,
      command_source:".spec-first/config/graph-providers.json",
      commands:($command_results | map({(.kind): .command}) | add // {}),
      diagnostics:($command_results | map(select(.diagnostic != "") | .diagnostic)),
      diagnostics_truncated:([ $command_results[] | .diagnostics_truncated == true ] | any),
      raw_logs:($command_results | map({(.kind): .raw_log}) | add // {}),
      normalized_artifacts:(
        if $provider == "gitnexus" then {
          architecture_facts:".spec-first/providers/gitnexus/normalized/architecture-facts.json",
          reuse_candidates:".spec-first/providers/gitnexus/normalized/reuse-candidates.json"
        } else {
          impact_capabilities:".spec-first/providers/code-review-graph/normalized/impact-capabilities.json"
        } end
      )
    }' | write_file_atomic "$status_path"
  STATUS_FILES+=("$status_path")
}

while IFS= read -r provider; do
  write_provider_status "$provider"
done < <(jq -r '.providers | keys[]' "$PROVIDER_CONFIG")

statuses_json="$(jq -s '.' "${STATUS_FILES[@]}")"
provider_count="$(jq 'length' <<<"$statuses_json")"
ready_count="$(jq '[.[] | select(.query_ready == true)] | length' <<<"$statuses_json")"
fallback_ready="$(jq -r '[.fallback_capabilities[]? | select(.support_level != "none")] | length > 0' "$RUNTIME_CAPABILITIES")"

if [ "$provider_count" -gt 0 ] && [ "$ready_count" -eq "$provider_count" ]; then
  WORKFLOW_MODE="primary"
  OVERALL_STATUS="ready"
  EXIT_CODE=0
elif [ "$fallback_ready" = "true" ]; then
  WORKFLOW_MODE="degraded-fallback"
  OVERALL_STATUS="degraded"
  EXIT_CODE=0
else
  WORKFLOW_MODE="blocked"
  OVERALL_STATUS="action-required"
  EXIT_CODE=1
fi

reason_code=""
if [ "$WORKFLOW_MODE" = "blocked" ]; then
  reason_code="graph-not-ready"
fi

jq -n \
  --arg generated_at "$BOOTSTRAPPED_AT" \
  --arg workflow_mode "$WORKFLOW_MODE" \
  --arg confidence "$(if [ "$WORKFLOW_MODE" = "primary" ]; then echo high; elif [ "$WORKFLOW_MODE" = "degraded-fallback" ]; then echo medium; else echo low; fi)" \
  --argjson providers "$statuses_json" \
  '{
    schema_version:"graph-provider-status.v1",
    generated_at:$generated_at,
    workflow_mode:$workflow_mode,
    ready_primary_providers:[$providers[] | select(.query_ready == true) | .provider],
    failed_primary_providers:[$providers[] | select(.query_ready != true and .status != "skipped") | .provider],
    skipped_primary_providers:[$providers[] | select(.status == "skipped") | .provider],
    partial_primary_available:([$providers[] | select(.query_ready == true)] | length > 0),
    providers:$providers,
    confidence:$confidence,
    limitations:(
      if $workflow_mode == "primary" then []
      elif $workflow_mode == "degraded-fallback" then ["One or more primary graph providers are unavailable or query-unverified; fallback capabilities are required."]
      else ["No query-ready graph provider or fallback capability is available."]
      end
    )
  }' | write_file_atomic "$GRAPH_DIR/provider-status.json"

jq -n \
  --arg generated_at "$BOOTSTRAPPED_AT" \
  --arg repo_root "$REPO_ROOT" \
  --arg source_revision "$SOURCE_REVISION" \
  --argjson worktree_dirty "$WORKTREE_DIRTY" \
  --arg workflow_mode "$WORKFLOW_MODE" \
  --arg confidence "$(if [ "$WORKFLOW_MODE" = "primary" ]; then echo high; elif [ "$WORKFLOW_MODE" = "degraded-fallback" ]; then echo medium; else echo low; fi)" \
  --argjson providers "$statuses_json" \
  '{
    schema_version:"graph-facts.v1",
    generated_at:$generated_at,
    repo_root:$repo_root,
    source_revision:$source_revision,
    worktree_dirty:$worktree_dirty,
    workflow_mode:$workflow_mode,
    provider_summary:{
      ready_primary_providers:[$providers[] | select(.query_ready == true) | .provider],
      degraded_providers:[$providers[] | select(.query_ready != true) | .provider],
      partial_primary_available:([$providers[] | select(.query_ready == true)] | length > 0)
    },
    canonical_artifacts:{
      provider_status:".spec-first/graph/provider-status.json",
      impact_capabilities:".spec-first/impact/bootstrap-impact-capabilities.json"
    },
    capabilities:{
      query_global_graph:([$providers[] | select(.provider == "gitnexus" and .query_ready == true)] | length > 0),
      impact_context:([$providers[] | select(.provider == "code-review-graph" and .query_ready == true)] | length > 0)
    },
    staleness_hints:{
      compare_source_revision:true,
      compare_worktree_dirty:true
    },
    confidence:$confidence,
    limitations:(
      if $workflow_mode == "primary" then []
      elif $workflow_mode == "degraded-fallback" then ["Graph facts are partial; downstream workflows must disclose limitations."]
      else ["Graph facts are not query-ready."]
      end
    )
  }' | write_file_atomic "$GRAPH_DIR/graph-facts.json"

jq -n \
  --arg generated_at "$BOOTSTRAPPED_AT" \
  --arg workflow_mode "$WORKFLOW_MODE" \
  --argjson providers "$statuses_json" \
  --slurpfile runtime "$RUNTIME_CAPABILITIES" \
  '{
    schema_version:"bootstrap-impact-capabilities.v1",
    generated_at:$generated_at,
    workflow_mode:$workflow_mode,
    capabilities:{
      context_selection:{
        support_level:(if ([$providers[] | select(.query_ready == true)] | length > 0) then "full" elif ($runtime[0].fallback_capabilities.context_selection.support_level // "none") != "none" then "partial" else "none" end),
        primary_providers:[$providers[] | select(.query_ready == true) | .provider],
        fallback_support:($runtime[0].fallback_capabilities.context_selection // {}),
        confidence:(if ([$providers[] | select(.query_ready == true)] | length > 0) then "high" else ($runtime[0].fallback_capabilities.context_selection.confidence // "unknown") end),
        limitations:(if ([$providers[] | select(.query_ready == true)] | length > 0) then [] else ["Using fallback context selection only."] end)
      },
      impact_radius:{
        support_level:(if ([$providers[] | select(.provider == "code-review-graph" and .query_ready == true)] | length > 0) then "full" elif ($runtime[0].fallback_capabilities.impact_radius.support_level // "none") != "none" then "partial" else "none" end),
        primary_providers:[$providers[] | select(.provider == "code-review-graph" and .query_ready == true) | .provider],
        fallback_support:($runtime[0].fallback_capabilities.impact_radius // {}),
        confidence:(if ([$providers[] | select(.provider == "code-review-graph" and .query_ready == true)] | length > 0) then "high" else ($runtime[0].fallback_capabilities.impact_radius.confidence // "unknown") end),
        limitations:(if ([$providers[] | select(.provider == "code-review-graph" and .query_ready == true)] | length > 0) then [] else ["Impact radius is not backed by a query-ready provider."] end)
      },
      review_support:{
        support_level:(if ([$providers[] | select(.provider == "code-review-graph" and .query_ready == true)] | length > 0) then "partial" elif ($runtime[0].fallback_capabilities.review_support.support_level // "none") != "none" then "partial" else "none" end),
        primary_providers:[$providers[] | select(.provider == "code-review-graph" and .query_ready == true) | .provider],
        fallback_support:($runtime[0].fallback_capabilities.review_support // {}),
        confidence:(if ([$providers[] | select(.provider == "code-review-graph" and .query_ready == true)] | length > 0) then "medium" else ($runtime[0].fallback_capabilities.review_support.confidence // "unknown") end),
        limitations:["This artifact reports readiness only; downstream LLM workflows decide review evidence relevance."]
      }
    },
    downstream_guidance:{
      canonical_graph_facts:".spec-first/graph/graph-facts.json",
      provider_status:".spec-first/graph/provider-status.json",
      limitations_required:($workflow_mode != "primary")
    }
  }' | write_file_atomic "$IMPACT_DIR/bootstrap-impact-capabilities.json"

provider_report_rows="$(jq -r '
  .[]
  | "| \(.provider) | \(.graph_ready) | \(.query_ready) | \(.query_probe_policy.token // "n/a") | \(.status) | \((.query_verification_reason // ((.limitations // []) | join("; ")) // "n/a") | gsub("\\|"; "/")) |"
' <<<"$statuses_json")"

write_file_atomic "$GRAPH_DIR/bootstrap-report.md" <<MD
# Graph Bootstrap Report

- workflow_mode: $WORKFLOW_MODE
- overall_status: $OVERALL_STATUS
- source_revision: $SOURCE_REVISION
- worktree_dirty: $WORKTREE_DIRTY
- provider_status: .spec-first/graph/provider-status.json
- graph_facts: .spec-first/graph/graph-facts.json
- impact_capabilities: .spec-first/impact/bootstrap-impact-capabilities.json

| Provider | Graph Ready | Query Ready | Probe Token | Evidence | Query Verification Reason |
| --- | --- | --- | --- | --- | --- |
$provider_report_rows
MD

jq -n \
  --arg repo_root "$REPO_ROOT" \
  --arg ledger_path "$LEDGER_PATH" \
  --arg provider_config_path "$PROVIDER_CONFIG" \
  --arg runtime_capabilities_path "$RUNTIME_CAPABILITIES" \
  --arg provider_artifacts_path "$PROVIDER_ARTIFACTS" \
  --arg invocation_workspace_root "$INVOCATION_WORKSPACE_ROOT" \
  --arg selection_source "$SELECTION_SOURCE" \
  --arg workflow_mode "$WORKFLOW_MODE" \
  --arg overall_status "$OVERALL_STATUS" \
  --arg reason_code "$reason_code" \
  --argjson results "$statuses_json" \
  '{
    schema_version:"graph-bootstrap-result.v1",
    overall_status:$overall_status,
    workflow_mode:$workflow_mode,
    reason_code:(if $reason_code == "" then null else $reason_code end),
    repo_root:$repo_root,
    invocation_workspace_root:$invocation_workspace_root,
    selection_source:$selection_source,
    ledger_path:$ledger_path,
    provider_config_path:$provider_config_path,
    runtime_capabilities_path:$runtime_capabilities_path,
    provider_artifacts_path:$provider_artifacts_path,
    results:$results
  }'

exit "$EXIT_CODE"
