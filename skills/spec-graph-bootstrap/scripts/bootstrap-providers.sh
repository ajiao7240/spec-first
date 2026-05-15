#!/bin/bash
# bootstrap-providers.sh - Compile project graph provider readiness facts.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Cross-skill helper reuse: spec-graph-bootstrap is shipped together with spec-mcp-setup
# inside the same spec-first package, so the relative path to the resolver is intentionally
# stable. Override with SPEC_FIRST_PROJECT_TARGET_RESOLVER if a future packaging splits the
# two skills.
RESOLVER="${SPEC_FIRST_PROJECT_TARGET_RESOLVER:-$SCRIPT_DIR/../../spec-mcp-setup/scripts/resolve-project-target.sh}"
MCP_TOOLS_JSON="${SPEC_FIRST_MCP_TOOLS_JSON:-$SCRIPT_DIR/../../spec-mcp-setup/mcp-tools.json}"
PACKAGE_JSON="${SPEC_FIRST_PACKAGE_JSON:-$SCRIPT_DIR/../../../package.json}"
REPO_ARG=""
ALL_REPOS=false
REQUEST_INCREMENTAL=false
REQUEST_FULL=false
DEFAULT_REFRESH_MODE_SINGLE_REPO=full
DEFAULT_REFRESH_MODE_ALL_REPOS=full
PROVIDER_COMMAND_TIMEOUT_SECONDS="${SPEC_FIRST_PROVIDER_COMMAND_TIMEOUT_SECONDS:-${SPEC_FIRST_STAGE_TIMEOUT_SECONDS:-900}}"

utc_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

epoch_ms() {
  python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
}

hash_text() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print "sha256:" $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print "sha256:" $1}'
  else
    python3 -c 'import hashlib,sys; print("sha256:" + hashlib.sha256(sys.stdin.buffer.read()).hexdigest())'
  fi
}

hash_file() {
  local path="$1"
  if [ -f "$path" ]; then
    hash_text < "$path"
  else
    printf '%s\n' "missing"
  fi
}

json_file_hash() {
  local path="$1"
  if [ -f "$path" ]; then
    jq -S -c . "$path" | hash_text
  else
    printf '%s\n' "missing"
  fi
}

SCRIPT_STARTED_AT="$(utc_now)"
SCRIPT_STARTED_EPOCH_MS="$(epoch_ms)"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "bootstrap-providers.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --all-repos)
      ALL_REPOS=true
      shift
      ;;
    --incremental)
      REQUEST_INCREMENTAL=true
      shift
      ;;
    --full|--force)
      REQUEST_FULL=true
      shift
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

TARGET_MODE="$(jq -r '.mode // empty' <<<"$TARGET_JSON")"
WORKSPACE_ROOT_FOR_ALL="$(jq -r '.workspace_root // .invocation_cwd' <<<"$TARGET_JSON")"
CANDIDATE_COUNT="$(jq -r '(.candidates // []) | length' <<<"$TARGET_JSON")"
DEFAULT_ALL_REPOS=false
if [ "$ALL_REPOS" != "true" ] && [ -z "$REPO_ARG" ] && [ "$TARGET_MODE" != "git-repo" ] && [ "$CANDIDATE_COUNT" -gt 0 ]; then
  DEFAULT_ALL_REPOS=true
fi
ALL_REPOS_SCOPE=false
if [ "$ALL_REPOS" = "true" ] || [ "$DEFAULT_ALL_REPOS" = "true" ]; then
  ALL_REPOS_SCOPE=true
fi

if [ "$ALL_REPOS_SCOPE" = "true" ] && [ "$REQUEST_INCREMENTAL" = "true" ] && [ "$REQUEST_FULL" = "true" ]; then
  jq -n --argjson target "$TARGET_JSON" '{
    schema_version:"graph-bootstrap-result.v1",
    overall_status:"action-required",
    workflow_mode:"blocked",
    reason_code:"conflicting-refresh-flags",
    workspace_root:($target.workspace_root // null),
    next_action:"Use either --incremental or --full/--force, not both."
  }'
  exit 1
fi

if [ "$ALL_REPOS_SCOPE" = "true" ] && [ "$REQUEST_INCREMENTAL" = "true" ]; then
  jq -n --argjson target "$TARGET_JSON" '{
    schema_version:"workspace-graph-bootstrap-summary.v1",
    overall_status:"action-required",
    workflow_mode:"blocked",
    reason_code:"incremental-all-repos-unsupported",
    workspace_root:($target.workspace_root // null),
    parent_writes_repo_local_artifacts:false,
    canonical_artifacts_preserved:true,
    next_action:"Run --all-repos without --incremental, or run --incremental against one clean child repo with --repo <child>."
  }'
  exit 1
fi

write_file_atomic_path() {
  local path="$1"
  local tmp
  mkdir -p "$(dirname "$path")"
  tmp="$(mktemp "${path}.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$path"
}

run_command_with_timeout() {
  local timeout_seconds="$1"
  local log_path="$2"
  shift 2
  python3 - "$timeout_seconds" "$log_path" "$@" <<'PY'
import subprocess
import sys

timeout = float(sys.argv[1])
log_path = sys.argv[2]
args = sys.argv[3:]

try:
    with open(log_path, "wb") as log:
        try:
            completed = subprocess.run(
                args,
                check=False,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                timeout=timeout,
            )
            sys.exit(completed.returncode)
        except subprocess.TimeoutExpired:
            log.write(f"\ncommand timed out after {timeout:g}s\n".encode("utf-8"))
            sys.exit(124)
        except FileNotFoundError as exc:
            log.write(f"{exc}\n".encode("utf-8"))
            sys.exit(127)
        except Exception as exc:
            log.write(f"{exc}\n".encode("utf-8"))
            sys.exit(1)
except OSError as exc:
    sys.stderr.write(f"{exc}\n")
    sys.exit(1)
PY
}

SPEC_FIRST_CLI_COMMAND=()

resolve_spec_first_cli_command() {
  local source_cli="$SCRIPT_DIR/../../../bin/spec-first.js"
  if [ -n "${SPEC_FIRST_CLI:-}" ]; then
    if [ -f "$SPEC_FIRST_CLI" ] && [[ "$SPEC_FIRST_CLI" == *.js ]]; then
      SPEC_FIRST_CLI_COMMAND=(node "$SPEC_FIRST_CLI")
    else
      SPEC_FIRST_CLI_COMMAND=("$SPEC_FIRST_CLI")
    fi
  elif [ -f "$source_cli" ]; then
    SPEC_FIRST_CLI_COMMAND=(node "$source_cli")
  elif command -v spec-first >/dev/null 2>&1; then
    SPEC_FIRST_CLI_COMMAND=(spec-first)
  else
    return 127
  fi
}

normalize_gitnexus_instruction_block_for_root() {
  local repo_root="$1"
  local output_file
  local output
  local exit_code
  local timed_out=false
  local started_at finished_at started_epoch_ms finished_epoch_ms duration_ms
  started_at="$(utc_now)"
  started_epoch_ms="$(epoch_ms)"
  output_file="$(mktemp "${TMPDIR:-/tmp}/spec-first-gitnexus-instruction.XXXXXX")"
  set +e
  if resolve_spec_first_cli_command; then
    run_command_with_timeout \
      "$PROVIDER_COMMAND_TIMEOUT_SECONDS" \
      "$output_file" \
      "${SPEC_FIRST_CLI_COMMAND[@]}" \
      gitnexus-instruction normalize --repo-root "$repo_root" --write --json
    exit_code=$?
  else
    exit_code=127
  fi
  output="$(cat "$output_file" 2>/dev/null)"
  rm -f "$output_file"
  finished_at="$(utc_now)"
  finished_epoch_ms="$(epoch_ms)"
  duration_ms=$((finished_epoch_ms - started_epoch_ms))
  if [ "$exit_code" -eq 124 ]; then
    timed_out=true
  fi
  set -e

  if jq -e . >/dev/null 2>&1 <<<"$output"; then
    local results
    local status
    local reason_code
    results="$(jq '.results // []' <<<"$output")"
    if jq -e '(.overall_status // "") == "partial" or any(.results[]?; .status == "partial")' >/dev/null <<<"$output"; then
      status="failed"
      reason_code="gitnexus-instruction-block-partial"
    elif [ "$exit_code" -ne 0 ]; then
      status="failed"
      reason_code="gitnexus-instruction-normalizer-failed"
    elif jq -e '(.overall_status // "") == "normalized" or any(.results[]?; .status == "updated" and .changed == true)' >/dev/null <<<"$output"; then
      status="normalized"
      reason_code=""
    elif jq -e '(.overall_status // "") == "unchanged" or any(.results[]?; .status == "already-current")' >/dev/null <<<"$output"; then
      status="unchanged"
      reason_code=""
    else
      status="not-applicable"
      reason_code="$(jq -r '.reason_code // "gitnexus-instruction-block-missing"' <<<"$output")"
    fi

    jq -n \
      --arg provider "gitnexus" \
      --arg status "$status" \
      --arg reason_code "$reason_code" \
      --arg started_at "$started_at" \
      --arg finished_at "$finished_at" \
      --argjson exit_code "$exit_code" \
      --argjson duration_ms "$duration_ms" \
      --argjson results "$results" \
      '{
        provider:$provider,
        status:$status,
        advisory:true,
        reason_code:(if $reason_code == "" then null else $reason_code end),
        exit_code:$exit_code,
        started_at:$started_at,
        finished_at:$finished_at,
        duration_ms:$duration_ms,
        results:$results
      }'
    return 0
  fi

  if [ "$exit_code" -ne 0 ]; then
    printf 'spec-graph-bootstrap: warning: could not normalize GitNexus instruction block; run `spec-first gitnexus-instruction normalize --write` after bootstrap.\n' >&2
    local failure_reason="gitnexus-instruction-normalizer-failed"
    if [ "$timed_out" = "true" ]; then
      failure_reason="gitnexus-instruction-normalizer-timeout"
    fi
    jq -n \
      --arg provider "gitnexus" \
      --arg status "failed" \
      --arg reason_code "$failure_reason" \
      --arg diagnostic "$output" \
      --arg started_at "$started_at" \
      --arg finished_at "$finished_at" \
      --argjson exit_code "$exit_code" \
      --argjson duration_ms "$duration_ms" \
      '{provider:$provider,status:$status,advisory:true,reason_code:$reason_code,exit_code:$exit_code,diagnostic:$diagnostic,started_at:$started_at,finished_at:$finished_at,duration_ms:$duration_ms,results:[]}'
    return 0
  fi

  if ! jq -e . >/dev/null 2>&1 <<<"$output"; then
    printf 'spec-graph-bootstrap: warning: GitNexus instruction normalizer returned non-JSON output.\n' >&2
    jq -n \
      --arg provider "gitnexus" \
      --arg status "failed" \
      --arg reason_code "gitnexus-instruction-normalizer-output-invalid" \
      --arg diagnostic "$output" \
      --arg started_at "$started_at" \
      --arg finished_at "$finished_at" \
      --argjson duration_ms "$duration_ms" \
      '{provider:$provider,status:$status,advisory:true,reason_code:$reason_code,exit_code:0,diagnostic:$diagnostic,started_at:$started_at,finished_at:$finished_at,duration_ms:$duration_ms,results:[]}'
    return 0
  fi
}

if [ "$ALL_REPOS" = "true" ] || [ "$DEFAULT_ALL_REPOS" = "true" ]; then
  if [ "$DEFAULT_ALL_REPOS" = "true" ]; then
    ALL_REPOS_SELECTION_SOURCE="workspace-default-all-repos"
  else
    ALL_REPOS_SELECTION_SOURCE="explicit-all-repos"
  fi
  if [ -n "$REPO_ARG" ]; then
    jq -n --arg workspace_root "$WORKSPACE_ROOT_FOR_ALL" '{
      schema_version:"workspace-graph-bootstrap-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"all-repos-conflicts-with-repo",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Use either --all-repos from a parent workspace or --repo <child>, not both."
    }'
    exit 1
  fi
  if [ "$TARGET_MODE" = "git-repo" ]; then
    jq -n --arg workspace_root "$WORKSPACE_ROOT_FOR_ALL" '{
      schema_version:"workspace-graph-bootstrap-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"all-repos-requires-parent-workspace",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Run --all-repos from a parent workspace containing child Git repos, or omit --all-repos in a single Git repo."
    }'
    exit 1
  fi

  if [ "$CANDIDATE_COUNT" -eq 0 ]; then
    jq -n --argjson target "$TARGET_JSON" '{
      schema_version:"workspace-graph-bootstrap-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:($target.reason_code // "workspace-no-git-candidates"),
      workspace_root:($target.workspace_root // null),
      candidates:($target.candidates // []),
      advisory:true,
      next_action:($target.next_action // "Run from a parent workspace containing child Git repos.")
    }'
    exit 1
  fi

  SUMMARY_ITEMS="$(mktemp "${TMPDIR:-/tmp}/graph-bootstrap-all-repos.XXXXXX")"
  WORKSPACE_RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")"
  ALL_REPOS_CHILD_REFRESH_ARGS=()
  case "$DEFAULT_REFRESH_MODE_ALL_REPOS" in
    full)
      ALL_REPOS_CHILD_REFRESH_ARGS+=(--full)
      ;;
    incremental)
      ALL_REPOS_CHILD_REFRESH_ARGS+=(--incremental)
      ;;
    *)
      jq -n --arg workspace_root "$WORKSPACE_ROOT_FOR_ALL" --arg mode "$DEFAULT_REFRESH_MODE_ALL_REPOS" '{
        schema_version:"workspace-graph-bootstrap-summary.v1",
        overall_status:"action-required",
        workflow_mode:"blocked",
        reason_code:"unsupported-default-refresh-mode",
        workspace_root:$workspace_root,
        advisory:true,
        next_action:("Unsupported DEFAULT_REFRESH_MODE_ALL_REPOS value: " + $mode)
      }'
      exit 1
      ;;
  esac
  child_index=0
  jq -n '[]' > "$SUMMARY_ITEMS"
  while IFS=$'\t' read -r child_label child_path; do
    [ -n "$child_path" ] || continue
    child_index=$((child_index + 1))
    child_started_at="$(utc_now)"
    child_started_epoch_ms="$(epoch_ms)"
    printf 'spec-graph-bootstrap: all-repos child %s/%s start repo=%s\n' "$child_index" "$CANDIDATE_COUNT" "$child_path" >&2
    set +e
    child_output="$(bash "$0" --repo "$child_path" "${ALL_REPOS_CHILD_REFRESH_ARGS[@]}")"
    child_status=$?
    set -e
    child_finished_at="$(utc_now)"
    child_finished_epoch_ms="$(epoch_ms)"
    child_duration_ms=$((child_finished_epoch_ms - child_started_epoch_ms))
    if ! jq -e . >/dev/null 2>&1 <<<"$child_output"; then
      child_result="$(jq -n --arg output "$child_output" '{schema_version:"graph-bootstrap-result.v1",overall_status:"action-required",workflow_mode:"blocked",reason_code:"child-bootstrap-output-unparseable",diagnostic:$output}')"
    else
      child_result="$child_output"
    fi
    jq \
      --arg parent_run_id "$WORKSPACE_RUN_ID" \
      --arg repo_label "$child_label" \
      --arg workspace_relative_path "$child_path" \
      --arg child_started_at "$child_started_at" \
      --arg child_finished_at "$child_finished_at" \
      --argjson exit_code "$child_status" \
      --argjson child_duration_ms "$child_duration_ms" \
      --argjson result "$child_result" \
      '. + [{
        parent_run_id:$parent_run_id,
        repo_label:$repo_label,
        workspace_relative_path:$workspace_relative_path,
        exit_code:$exit_code,
        started_at:$child_started_at,
        finished_at:$child_finished_at,
        duration_ms:$child_duration_ms,
        overall_status:($result.overall_status // "unknown"),
        workflow_mode:($result.workflow_mode // "unknown"),
        reason_code:($result.reason_code // null),
        result:$result
      }]' "$SUMMARY_ITEMS" > "$SUMMARY_ITEMS.next"
    mv "$SUMMARY_ITEMS.next" "$SUMMARY_ITEMS"
    printf 'spec-graph-bootstrap: all-repos child %s/%s finish repo=%s status=%s workflow=%s duration_ms=%s\n' \
      "$child_index" \
      "$CANDIDATE_COUNT" \
      "$child_path" \
      "$(jq -r '.overall_status // "unknown"' <<<"$child_result")" \
      "$(jq -r '.workflow_mode // "unknown"' <<<"$child_result")" \
      "$child_duration_ms" >&2
  done < <(jq -r '.candidates[] | [.repo_label, .workspace_relative_path] | @tsv' <<<"$TARGET_JSON")

  PARENT_HOST_INSTRUCTION_NORMALIZATION="$(jq -n '{provider:"gitnexus",status:"not-applicable",advisory:true,reason_code:"all-repos-gitnexus-provider-not-bootstrapped",exit_code:null,results:[]}')"
  if jq -e 'any(.[]; ((.result.results // []) | any(.provider == "gitnexus" and ((.command_results // []) | any(.kind == "bootstrap" and .exit_code == 0)))))' "$SUMMARY_ITEMS" >/dev/null; then
    PARENT_HOST_INSTRUCTION_NORMALIZATION="$(normalize_gitnexus_instruction_block_for_root "$WORKSPACE_ROOT_FOR_ALL")"
  fi

  WORKSPACE_FINISHED_AT="$(utc_now)"
  WORKSPACE_FINISHED_EPOCH_MS="$(epoch_ms)"
  WORKSPACE_DURATION_MS=$((WORKSPACE_FINISHED_EPOCH_MS - SCRIPT_STARTED_EPOCH_MS))
  SUMMARY_JSON="$(jq -n \
    --arg generated_at "$WORKSPACE_FINISHED_AT" \
    --arg run_id "$WORKSPACE_RUN_ID" \
    --arg selection_source "$ALL_REPOS_SELECTION_SOURCE" \
    --arg started_at "$SCRIPT_STARTED_AT" \
    --arg finished_at "$WORKSPACE_FINISHED_AT" \
    --argjson duration_ms "$WORKSPACE_DURATION_MS" \
    --argjson parent_host_instruction_normalization "$PARENT_HOST_INSTRUCTION_NORMALIZATION" \
    --argjson target "$TARGET_JSON" \
    --slurpfile items "$SUMMARY_ITEMS" \
    '($items[0] // []) as $results
    | {
        schema_version:"workspace-graph-bootstrap-summary.v1",
        generated_at:$generated_at,
        run_id:$run_id,
        advisory:true,
        workflow_mode:"all-repos",
        selection_source:$selection_source,
        workspace_root:($target.workspace_root // null),
        parent_writes_repo_local_artifacts:false,
        parent_writes_host_instruction_files:any($parent_host_instruction_normalization.results[]?; .written == true),
        parent_host_instruction_normalization:$parent_host_instruction_normalization,
        timing:{
          started_at:$started_at,
          finished_at:$finished_at,
          duration_ms:$duration_ms
        },
        results:$results,
        counts:{
          total:($results | length),
          ready:([$results[] | select(.overall_status == "ready")] | length),
          degraded:([$results[] | select(.workflow_mode == "degraded-fallback" or .overall_status == "degraded")] | length),
          not_applicable:([$results[] | select(.workflow_mode == "no-source" or .overall_status == "not-applicable")] | length),
          action_required:([$results[] | select(.overall_status != "ready" and .workflow_mode != "degraded-fallback" and .overall_status != "degraded" and .workflow_mode != "no-source" and .overall_status != "not-applicable")] | length),
          primary:([$results[] | select(.workflow_mode == "primary")] | length),
          blocked:([$results[] | select(.workflow_mode == "blocked" or .workflow_mode == "setup-not-ready")] | length)
        },
        overall_status:(
          if ($results | length) == 0 then "action-required"
          elif ([$results[] | select(.overall_status != "ready" and .workflow_mode != "degraded-fallback" and .overall_status != "degraded" and .workflow_mode != "no-source" and .overall_status != "not-applicable")] | length) == 0
            and ([$results[] | select(.workflow_mode == "degraded-fallback" or .overall_status == "degraded")] | length) == 0 then "ready"
          elif ([$results[] | select(.overall_status == "ready" or .workflow_mode == "degraded-fallback" or .overall_status == "degraded")] | length) > 0 then "partial"
          else "action-required"
          end
        ),
        reason_code:(
          if ($results | length) == 0 then "workspace-no-git-candidates"
          elif ([$results[] | select(.overall_status != "ready" and .workflow_mode != "degraded-fallback" and .overall_status != "degraded" and .workflow_mode != "no-source" and .overall_status != "not-applicable")] | length) > 0 then "all-repos-partial-or-action-required"
          elif ([$results[] | select(.workflow_mode == "degraded-fallback" or .overall_status == "degraded")] | length) > 0 then "all-repos-degraded-fallback"
          else null
          end
        ),
        next_action:(
          if ([$results[] | select(.overall_status != "ready" and .workflow_mode != "degraded-fallback" and .overall_status != "degraded" and .workflow_mode != "no-source" and .overall_status != "not-applicable")] | length) > 0 then "Inspect per-child reason_code and rerun setup/bootstrap for action-required repos."
          elif ([$results[] | select(.workflow_mode == "degraded-fallback" or .overall_status == "degraded")] | length) > 0 then "Inspect per-child provider reason_code/recommended_action. Use degraded child artifacts with disclosed limitations, or refresh query readiness for degraded repos."
          elif ([$results[] | select(.workflow_mode == "no-source" or .overall_status == "not-applicable")] | length) > 0 then "All code-bearing child repos produced graph bootstrap artifacts; skip GitNexus process routing for no-source children."
          else "All child repos produced graph bootstrap artifacts."
          end
        )
      }')"
  rm -f "$SUMMARY_ITEMS"
  printf '%s\n' "$SUMMARY_JSON" | write_file_atomic_path "$WORKSPACE_ROOT_FOR_ALL/.spec-first/workspace/graph-bootstrap-summary.json"
  printf '%s\n' "$SUMMARY_JSON"
  if [ "$(jq -r '.overall_status' <<<"$SUMMARY_JSON")" = "action-required" ]; then
    exit 1
  fi
  exit 0
fi

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
GITNEXUS_QUERY_PROBE_CANDIDATE_LIMIT=5

mkdir -p "$GRAPH_DIR" "$IMPACT_DIR" "$PROVIDERS_DIR"

BOOTSTRAPPED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SOURCE_REVISION="$(git -C "$REPO_ROOT" rev-parse --verify 'HEAD^{commit}' 2>/dev/null || true)"
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
WORKTREE_STATUS_HASH="$(printf '%s' "$WORKTREE_STATUS" | hash_text)"

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
  local canonical_artifacts_preserved="${5:-false}"
  if [ "$canonical_artifacts_preserved" != "true" ]; then
    write_blocked_report "$workflow_mode" "$reason_code" "$next_action"
  fi
  jq -n \
    --arg repo_root "$REPO_ROOT" \
    --arg invocation_workspace_root "$INVOCATION_WORKSPACE_ROOT" \
    --arg selection_source "$SELECTION_SOURCE" \
    --arg workflow_mode "$workflow_mode" \
    --arg reason_code "$reason_code" \
    --arg next_action "$next_action" \
    --argjson canonical_artifacts_preserved "$canonical_artifacts_preserved" \
    '{
      schema_version:"graph-bootstrap-result.v1",
      overall_status:"action-required",
      workflow_mode:$workflow_mode,
      reason_code:$reason_code,
      repo_root:$repo_root,
      invocation_workspace_root:$invocation_workspace_root,
      selection_source:$selection_source,
      canonical_artifacts_preserved:$canonical_artifacts_preserved,
      next_action:$next_action
    }'
  exit "$exit_code"
}

if [ "$REQUEST_INCREMENTAL" = "true" ] && [ "$REQUEST_FULL" = "true" ]; then
  emit_blocked blocked conflicting-refresh-flags "Use either --incremental or --full/--force, not both."
fi

if [ "$REQUEST_INCREMENTAL" = "true" ]; then
  INVOCATION_REFRESH_MODE="incremental"
elif [ "$REQUEST_FULL" = "true" ]; then
  INVOCATION_REFRESH_MODE="full"
else
  INVOCATION_REFRESH_MODE="$DEFAULT_REFRESH_MODE_SINGLE_REPO"
fi

if [ "$WORKTREE_DIRTY" = "true" ]; then
  emit_blocked blocked dirty-refresh-non-canonical "Commit, stash, or clean worktree changes before graph bootstrap refresh; provider commands were not run." 1 true
fi

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

SPEC_FIRST_PACKAGE_VERSION="$(jq -r '.version // "unknown"' "$PACKAGE_JSON" 2>/dev/null || printf '%s\n' "unknown")"
GRAPH_BOOTSTRAP_SCRIPT_HASH="$(hash_file "$0")"
MCP_TOOLS_HASH="$(json_file_hash "$MCP_TOOLS_JSON")"
GRAPH_PROVIDERS_HASH="$(json_file_hash "$PROVIDER_CONFIG")"
RUNTIME_CAPABILITIES_HASH="$(json_file_hash "$RUNTIME_CAPABILITIES")"
PROVIDER_ARTIFACTS_HASH="$(json_file_hash "$PROVIDER_ARTIFACTS")"

provider_artifact_contract_supported() {
  jq -e --slurpfile provider_config "$PROVIDER_CONFIG" '
    (.canonical.provider_status == ".spec-first/graph/provider-status.json")
    and (.canonical.graph_facts == ".spec-first/graph/graph-facts.json")
    and (.canonical.bootstrap_report == ".spec-first/graph/bootstrap-report.md")
    and (.canonical.impact_capabilities == ".spec-first/impact/bootstrap-impact-capabilities.json")
    and ((.providers // {}) | type == "object")
    and (
      (.providers // {}) as $artifact_providers
      | ($provider_config[0].providers | keys) as $configured_providers
      | all($configured_providers[]; ($artifact_providers[.] // null) != null)
    )
    and (
      (.providers.gitnexus // null) == null
      or (
        .providers.gitnexus.raw_dir == ".spec-first/providers/gitnexus/raw"
        and .providers.gitnexus.normalized_dir == ".spec-first/providers/gitnexus/normalized"
        and .providers.gitnexus.status_path == ".spec-first/providers/gitnexus/status.json"
        and .providers.gitnexus.raw_logs.bootstrap == ".spec-first/providers/gitnexus/raw/analyze.log"
        and .providers.gitnexus.raw_logs.status == ".spec-first/providers/gitnexus/raw/status.log"
        and .providers.gitnexus.raw_logs.query_probe == ".spec-first/providers/gitnexus/raw/query.log"
        and .providers.gitnexus.normalized_artifacts.architecture_facts == ".spec-first/providers/gitnexus/normalized/architecture-facts.json"
        and .providers.gitnexus.normalized_artifacts.reuse_candidates == ".spec-first/providers/gitnexus/normalized/reuse-candidates.json"
      )
    )
    and (
      (.providers["code-review-graph"] // null) == null
      or (
        .providers["code-review-graph"].raw_dir == ".spec-first/providers/code-review-graph/raw"
        and .providers["code-review-graph"].normalized_dir == ".spec-first/providers/code-review-graph/normalized"
        and .providers["code-review-graph"].status_path == ".spec-first/providers/code-review-graph/status.json"
        and .providers["code-review-graph"].raw_logs.bootstrap == ".spec-first/providers/code-review-graph/raw/build.log"
        and .providers["code-review-graph"].raw_logs.status == ".spec-first/providers/code-review-graph/raw/status.log"
        and .providers["code-review-graph"].raw_logs.query_probe == ".spec-first/providers/code-review-graph/raw/query.log"
        and .providers["code-review-graph"].normalized_artifacts.impact_capabilities == ".spec-first/providers/code-review-graph/normalized/impact-capabilities.json"
      )
    )
  ' "$PROVIDER_ARTIFACTS" >/dev/null
}

if ! provider_artifact_contract_supported; then
  emit_blocked blocked readiness-conflict "Rerun spec-mcp-setup; provider artifact path contract drifted."
fi

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
    def safe_string:
      (explode | all(.[]; (. >= 32 and . != 127)))
      and (test("[;&|`$<>]") | not);
    def safe_args:
      all(.[]; safe_string);
    def gitnexus_subcommand:
      if $kind == "bootstrap" then "analyze"
      elif $kind == "incremental" then "analyze"
      elif $kind == "status" then "status"
      elif $kind == "query_probe" then "query"
      else null end;
    def crg_exact_package:
      type == "string" and test("^code-review-graph@[0-9][0-9A-Za-z._+!-]*$");
    def crg_legacy_tail:
      if length >= 3 and .[0] == "uvx" and ((.[1] == "--upgrade") or (.[1] == "--refresh")) and .[2] == "code-review-graph" then .[3:]
      else [] end;
    def crg_pinned_tail:
      if length >= 2 and .[0] == "uvx" and (.[1] | crg_exact_package) then .[2:]
      else [] end;
    def crg_shape:
      (if (crg_pinned_tail | length) > 0 then crg_pinned_tail else crg_legacy_tail end) as $tail
      | if $kind == "bootstrap" then $tail == ["build"]
      elif $kind == "incremental" then
        ($tail | length == 3 and .[0] == "update" and .[1] == "--base" and .[2] == "__SPEC_FIRST_LAST_INDEXED_COMMIT__")
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
            or
            ($cmd | length == 6 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == "analyze" and .[4] == "--skip-agents-md" and .[5] == "--no-stats")
            or
            ($cmd | length == 7 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == "analyze" and .[4] == "--force" and .[5] == "--skip-agents-md" and .[6] == "--no-stats")
          )
        elif $kind == "incremental" then
          (
            ($cmd | length == 4 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == "analyze")
            or
            ($cmd | length == 6 and .[0] == "npx" and .[1] == "-y" and (.[2] | test("^gitnexus(@[A-Za-z0-9._~+:-]+)?$")) and .[3] == "analyze" and .[4] == "--skip-agents-md" and .[5] == "--no-stats")
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

query_probe_policy_supported() {
  local provider="$1"
  if [ "$provider" != "gitnexus" ]; then
    return 0
  fi
  jq -e --arg provider "$provider" '
    def safe_token:
      type == "string"
      and length > 0
      and (explode | all(.[]; (. >= 32 and . != 127)))
      and (test("[;&|`$<>]") | not);
    def optional_nullable_string($key):
      ((has($key) | not) or (.[$key] == null) or (.[$key] | type == "string"));
    (.providers[$provider].query_probe_policy // {}) as $policy
    | ($policy | type == "object")
    and (($policy.candidates // []) | type == "array")
    and ($policy | optional_nullable_string("selected_from"))
    and ($policy | optional_nullable_string("source"))
    and (if ($policy | has("token")) then ($policy.token | safe_token) else true end)
    and all(($policy.candidates // [])[];
      (.token | safe_token)
      and ((.selected_from // "") | type == "string")
      and ((.reason_code // "") | type == "string")
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
  if jq -e --arg provider "$provider" '(.providers[$provider].commands.incremental // null) != null' "$PROVIDER_CONFIG" >/dev/null \
    && ! command_shape_supported "$provider" incremental; then
    emit_blocked blocked unsupported-provider-command "Provider command shape is unsupported for $provider:incremental."
  fi
  if ! query_probe_policy_supported "$provider"; then
    emit_blocked blocked unsupported-provider-command "Provider query probe policy is unsupported for $provider."
  fi
done < <(jq -r '.providers | keys[]' "$PROVIDER_CONFIG")

command_display() {
  local provider="$1"
  local kind="$2"
  jq -r --arg provider "$provider" --arg kind "$kind" '.providers[$provider].commands[$kind] | join(" ")' "$PROVIDER_CONFIG"
}

command_json_display() {
  local command_json="$1"
  jq -r 'join(" ")' <<<"$command_json"
}

RUN_EXIT_CODE=0
RUN_DIAGNOSTIC=""
RUN_TRUNCATED=false
RUN_STARTED_AT=""
RUN_FINISHED_AT=""
RUN_DURATION_MS=0

run_command_json() {
  local provider="$1"
  local kind="$2"
  local log_path="$3"
  local command_json="$4"
  local cmd=()
  local byte_count

  mkdir -p "$(dirname "$log_path")"
  while IFS= read -r -d '' arg; do
    cmd+=("$arg")
  done < <(jq -j '.[] | . + "\u0000"' <<<"$command_json")

  local started_epoch_ms finished_epoch_ms
  RUN_STARTED_AT="$(utc_now)"
  started_epoch_ms="$(epoch_ms)"
  set +e
  printf 'spec-graph-bootstrap: running %s %s; dependencies may download on first use...\n' "$provider" "$kind" >&2
  (cd "$REPO_ROOT" && run_command_with_timeout "$PROVIDER_COMMAND_TIMEOUT_SECONDS" "$log_path" "${cmd[@]}")
  RUN_EXIT_CODE=$?
  RUN_FINISHED_AT="$(utc_now)"
  finished_epoch_ms="$(epoch_ms)"
  RUN_DURATION_MS=$((finished_epoch_ms - started_epoch_ms))
  if [ "$RUN_EXIT_CODE" -eq 124 ]; then
    printf 'spec-graph-bootstrap: timed out %s %s after %ss\n' "$provider" "$kind" "$PROVIDER_COMMAND_TIMEOUT_SECONDS" >&2
  else
    printf 'spec-graph-bootstrap: finished %s %s with exit %s\n' "$provider" "$kind" "$RUN_EXIT_CODE" >&2
  fi
  set -e

  byte_count="$(wc -c < "$log_path" | tr -d ' ')"
  if [ "${byte_count:-0}" -gt 1000 ]; then
    RUN_TRUNCATED=true
  else
    RUN_TRUNCATED=false
  fi
  RUN_DIAGNOSTIC="$(tr '\n' ' ' < "$log_path" | cut -c 1-1000)"
}

run_configured_command() {
  local provider="$1"
  local kind="$2"
  local log_path="$3"
  local command_json
  command_json="$(jq -c --arg provider "$provider" --arg kind "$kind" '.providers[$provider].commands[$kind]' "$PROVIDER_CONFIG")"
  run_command_json "$provider" "$kind" "$log_path" "$command_json"
}

run_configured_gitnexus_query_probe() {
  local provider="$1"
  local log_path="$2"
  local token="$3"
  local cmd=()
  local byte_count

  mkdir -p "$(dirname "$log_path")"
  while IFS= read -r -d '' arg; do
    cmd+=("$arg")
  done < <(jq -j --arg provider "$provider" '.providers[$provider].commands.query_probe[] | . + "\u0000"' "$PROVIDER_CONFIG")
  cmd[4]="$token"

  local started_epoch_ms finished_epoch_ms
  RUN_STARTED_AT="$(utc_now)"
  started_epoch_ms="$(epoch_ms)"
  set +e
  printf 'spec-graph-bootstrap: running %s query_probe token=%s; dependencies may download on first use...\n' "$provider" "$token" >&2
  (cd "$REPO_ROOT" && run_command_with_timeout "$PROVIDER_COMMAND_TIMEOUT_SECONDS" "$log_path" "${cmd[@]}")
  RUN_EXIT_CODE=$?
  RUN_FINISHED_AT="$(utc_now)"
  finished_epoch_ms="$(epoch_ms)"
  RUN_DURATION_MS=$((finished_epoch_ms - started_epoch_ms))
  if [ "$RUN_EXIT_CODE" -eq 124 ]; then
    printf 'spec-graph-bootstrap: timed out %s query_probe token=%s after %ss\n' "$provider" "$token" "$PROVIDER_COMMAND_TIMEOUT_SECONDS" >&2
  else
    printf 'spec-graph-bootstrap: finished %s query_probe token=%s with exit %s\n' "$provider" "$token" "$RUN_EXIT_CODE" >&2
  fi
  set -e

  byte_count="$(wc -c < "$log_path" | tr -d ' ')"
  if [ "${byte_count:-0}" -gt 1000 ]; then
    RUN_TRUNCATED=true
  else
    RUN_TRUNCATED=false
  fi
  RUN_DIAGNOSTIC="$(tr '\n' ' ' < "$log_path" | cut -c 1-1000)"
}

gitnexus_query_probe_command_display() {
  local provider="$1"
  local token="$2"
  jq -r --arg provider "$provider" --arg token "$token" '.providers[$provider].commands.query_probe | .[4] = $token | join(" ")' "$PROVIDER_CONFIG"
}

QUERY_PROBE_VERIFICATION_REASON=""
QUERY_PROBE_RESULT_CLASS=""
QUERY_PROBE_ATTEMPTS="[]"
QUERY_PROBE_CANDIDATES_TRUNCATED=false

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

gitnexus_query_probe_result_class() {
  local log_path="$1"
  if gitnexus_query_probe_has_bad_diagnostics "$log_path"; then
    printf '%s\n' "diagnostic"
  elif gitnexus_query_probe_has_results "$log_path"; then
    printf '%s\n' "process-results"
  elif gitnexus_query_probe_is_definitions_only "$log_path"; then
    printf '%s\n' "definitions-only"
  else
    printf '%s\n' "empty-or-unparseable"
  fi
}

gitnexus_query_probe_reason_for_class() {
  case "$1" in
    diagnostic)
      printf '%s\n' "GitNexus query probe emitted FTS/read-only/missing-index diagnostics."
      ;;
    definitions-only)
      printf '%s\n' "GitNexus query probe returned definitions-only evidence without BM25/process query results."
      ;;
    process-results)
      printf '%s\n' ""
      ;;
    *)
      printf '%s\n' "GitNexus query probe did not return parseable non-empty BM25/process query results."
      ;;
  esac
}

configured_gitnexus_package_spec() {
  provider_configured_package_spec gitnexus
}

bundled_gitnexus_package_spec() {
  [ -f "$MCP_TOOLS_JSON" ] || return 0
  jq -r '
    .tools[]?
    | select(.id == "gitnexus")
    | select((.package // "") != "" and (.version // "") != "")
    | (.package + "@" + .version)
  ' "$MCP_TOOLS_JSON" 2>/dev/null | head -n 1
}

bundled_code_review_graph_package_spec() {
  [ -f "$MCP_TOOLS_JSON" ] || return 0
  jq -r '
    .tools[]?
    | select(.id == "code-review-graph")
    | select((.package // "") != "" and (.version // "") != "")
    | (.package + "@" + .version)
  ' "$MCP_TOOLS_JSON" 2>/dev/null | head -n 1
}

provider_configured_package_spec() {
  local provider="$1"
  jq -r --arg provider "$provider" '
    def command_package($config; $provider; $kind):
      ($config.providers[$provider].commands[$kind] // []) as $cmd
      | if $provider == "gitnexus" then
          if ($cmd[0] // "") == "npx" and ($cmd[1] // "") == "-y" then ($cmd[2] // "") else "" end
        elif $provider == "code-review-graph" then
          if ($cmd[0] // "") == "uvx" and (($cmd[1] // "") == "--upgrade" or ($cmd[1] // "") == "--refresh") then
            ($cmd[2] // "")
          elif ($cmd[0] // "") == "uvx" then
            ($cmd[1] // "")
          else ""
          end
        else "" end;
    . as $config
    |
    (["bootstrap", "status", "query_probe"] + (if (($config.providers[$provider].commands.incremental // null) != null) then ["incremental"] else [] end)) as $phases
    | ($phases | map(command_package($config; $provider; .))) as $packages
    | ($packages | map(select(. != "")) | unique) as $unique
    | if (($packages | all(. != "")) and ($unique | length == 1)) then
        $unique[0]
      elif ($packages | length) > 0 then
        "mixed-provider-command-packages:" + ($packages | join(","))
      else ""
      end
  ' "$PROVIDER_CONFIG" 2>/dev/null || true
}

provider_bundled_package_spec() {
  local provider="$1"
  if [ "$provider" = "gitnexus" ]; then
    bundled_gitnexus_package_spec
  elif [ "$provider" = "code-review-graph" ]; then
    bundled_code_review_graph_package_spec
  fi
}

provider_command_hash() {
  local provider="$1"
  jq -S -c --arg provider "$provider" '.providers[$provider].commands // {}' "$PROVIDER_CONFIG" | hash_text
}

provider_version_policy() {
  local provider="$1"
  local configured_package="$2"
  local bundled_package="$3"
  if [ -n "$configured_package" ] && [ -n "$bundled_package" ] && [ "$configured_package" = "$bundled_package" ]; then
    printf '%s\n' "pinned"
  elif [ -n "$configured_package" ] && [ -n "$bundled_package" ] && [ "$configured_package" != "$bundled_package" ]; then
    printf '%s\n' "projection-stale"
  else
    printf '%s\n' "floating-unverifiable"
  fi
}

provider_reuse_decision() {
  local provider="$1"
  local skip_reason="$2"
  local version_policy="$3"
  if [ -n "$skip_reason" ]; then
    jq -n '{eligible:false,reason:"provider-not-enabled"}'
  elif [ "$version_policy" = "pinned" ]; then
    jq -n '{eligible:true,reason:null}'
  elif [ "$version_policy" = "projection-stale" ]; then
    jq -n '{eligible:false,reason:"provider-projection-stale"}'
  else
    jq -n '{eligible:false,reason:"provider-version-unverifiable"}'
  fi
}

provider_bootstrap_fingerprint() {
  local provider="$1"
  local configured_package="$2"
  local bundled_package="$3"
  local version_policy="$4"
  local command_hash
  command_hash="$(provider_command_hash "$provider")"
  jq -n \
    --arg provider "$provider" \
    --arg source_revision "$SOURCE_REVISION" \
    --arg worktree_status_hash "$WORKTREE_STATUS_HASH" \
    --argjson worktree_dirty "$WORKTREE_DIRTY" \
    --arg package_version "$SPEC_FIRST_PACKAGE_VERSION" \
    --arg script_hash "$GRAPH_BOOTSTRAP_SCRIPT_HASH" \
    --arg mcp_tools_hash "$MCP_TOOLS_HASH" \
    --arg graph_providers_hash "$GRAPH_PROVIDERS_HASH" \
    --arg runtime_capabilities_hash "$RUNTIME_CAPABILITIES_HASH" \
    --arg provider_artifacts_hash "$PROVIDER_ARTIFACTS_HASH" \
    --arg command_hash "$command_hash" \
    --arg configured_package "$configured_package" \
    --arg bundled_package "$bundled_package" \
    --arg version_policy "$version_policy" '{
      schema_version:"graph-bootstrap-fingerprint.v1",
      repo_snapshot:{
        source_revision:$source_revision,
        worktree_dirty:$worktree_dirty,
        worktree_status_hash:$worktree_status_hash
      },
      spec_first:{
        package_version:$package_version,
        graph_bootstrap_script_hash:$script_hash,
        mcp_tools_hash:$mcp_tools_hash
      },
      provider_projection:{
        graph_providers_hash:$graph_providers_hash,
        runtime_capabilities_hash:$runtime_capabilities_hash,
        provider_artifacts_hash:$provider_artifacts_hash
      },
      provider:{
        id:$provider,
        command_hash:$command_hash,
        configured_package_spec:(if $configured_package == "" then null else $configured_package end),
        bundled_package_spec:(if $bundled_package == "" then null else $bundled_package end),
        version_policy:$version_policy
      }
    }'
}

gitnexus_provider_projection_stale_failure() {
  local configured="$1"
  local bundled="$2"
  jq -n \
    --arg configured "$configured" \
    --arg bundled "$bundled" '{
      failed_phase:"preflight",
      failure_class:"provider-projection-stale",
      reason_code:"gitnexus-provider-projection-stale",
      exit_code:null,
      recommended_action:("Rerun spec-mcp-setup to refresh .spec-first/config/graph-providers.json from bundled GitNexus package `" + $bundled + "`; it currently projects `" + $configured + "`. Then rerun spec-graph-bootstrap."),
      diagnostic:("GitNexus setup-projected package `" + $configured + "` differs from bundled package `" + $bundled + "` before provider commands ran.")
    }'
}

code_review_graph_provider_projection_stale_failure() {
  local configured="$1"
  local bundled="$2"
  jq -n \
    --arg configured "$configured" \
    --arg bundled "$bundled" '{
      failed_phase:"preflight",
      failure_class:"provider-projection-stale",
      reason_code:"code-review-graph-provider-projection-stale",
      exit_code:null,
      recommended_action:("Rerun spec-mcp-setup to refresh .spec-first/config/graph-providers.json from bundled code-review-graph package `" + $bundled + "`; it currently projects `" + $configured + "`. Then rerun spec-graph-bootstrap."),
      diagnostic:("code-review-graph setup-projected package `" + $configured + "` differs from bundled package `" + $bundled + "` before provider commands ran.")
	    }'
}

code_review_graph_provider_version_unverifiable_failure() {
  local configured="$1"
  local bundled="$2"
  jq -n \
    --arg configured "$configured" \
    --arg bundled "$bundled" '{
      failed_phase:"preflight",
      failure_class:"provider-version-unverifiable",
      reason_code:"code-review-graph-provider-version-unverifiable",
      exit_code:null,
      recommended_action:("Rerun spec-mcp-setup so .spec-first/config/graph-providers.json is refreshed from the bundled code-review-graph package pin before rerunning spec-graph-bootstrap."),
      diagnostic:("code-review-graph provider package identity is not pinned/verifiable before provider commands ran. configured=`" + $configured + "`, bundled=`" + $bundled + "`.")
    }'
}

provider_projection_stale_failure() {
  local provider="$1"
  local configured="$2"
  local bundled="$3"
  if [ "$provider" = "gitnexus" ]; then
    gitnexus_provider_projection_stale_failure "$configured" "$bundled"
  else
    code_review_graph_provider_projection_stale_failure "$configured" "$bundled"
  fi
}

provider_projection_stale_label() {
  case "$1" in
    gitnexus) printf '%s\n' "GitNexus" ;;
    code-review-graph) printf '%s\n' "code-review-graph" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

gitnexus_query_surface_diagnostic_failure() {
  local exit_code="$1"
  local configured_package bundled_package
  if ! jq -e 'any(.[]; .result_class == "diagnostic")' >/dev/null 2>&1 <<<"$QUERY_PROBE_ATTEMPTS"; then
    return 1
  fi

  configured_package="$(configured_gitnexus_package_spec)"
  bundled_package="$(bundled_gitnexus_package_spec)"
  if [ -n "$configured_package" ] && [ -n "$bundled_package" ] && [ "$configured_package" != "$bundled_package" ]; then
    jq -n \
      --arg configured "$configured_package" \
      --arg bundled "$bundled_package" \
      --argjson exit_code "$exit_code" '{
        failed_phase:"query_probe",
        failure_class:"provider-projection-stale",
        reason_code:"gitnexus-query-provider-projection-stale",
        exit_code:$exit_code,
        recommended_action:("Rerun spec-mcp-setup to refresh .spec-first/config/graph-providers.json from bundled GitNexus package `" + $bundled + "`; it currently projects `" + $configured + "`. Then rerun spec-graph-bootstrap. Use code-review-graph degraded fallback until GitNexus query proof returns process results."),
        diagnostic:("GitNexus query probe emitted FTS/read-only/missing-index diagnostics while setup-projected package `" + $configured + "` differs from bundled package `" + $bundled + "`.")
      }'
    return 0
  fi

  jq -n --argjson exit_code "$exit_code" '{
    failed_phase:"query_probe",
    failure_class:"provider-storage-readonly",
    reason_code:"gitnexus-query-fts-readonly",
    exit_code:$exit_code,
    recommended_action:"GitNexus query emitted FTS/read-only/missing-index diagnostics after build/status succeeded. Repair GitNexus index storage or permissions, or clean/reanalyze GitNexus with a fixed provider version, then rerun spec-graph-bootstrap. Use code-review-graph degraded fallback meanwhile.",
    diagnostic:"GitNexus query probe emitted FTS/read-only/missing-index diagnostics after build/status succeeded."
  }'
}

query_probe_verified() {
  local provider="$1"
  local log_path="$2"
  QUERY_PROBE_VERIFICATION_REASON=""
  QUERY_PROBE_RESULT_CLASS=""
  if [ "$provider" != "gitnexus" ]; then
    return 0
  fi
  QUERY_PROBE_RESULT_CLASS="$(gitnexus_query_probe_result_class "$log_path")"
  QUERY_PROBE_VERIFICATION_REASON="$(gitnexus_query_probe_reason_for_class "$QUERY_PROBE_RESULT_CLASS")"
  if [ "$QUERY_PROBE_RESULT_CLASS" = "process-results" ]; then
    return 0
  fi
  return 1
}

gitnexus_query_probe_candidates() {
  local provider="$1"
  jq -r --arg provider "$provider" --argjson limit "$GITNEXUS_QUERY_PROBE_CANDIDATE_LIMIT" '
    (.providers[$provider].query_probe_policy // {}) as $policy
    | (if (($policy.candidates // []) | length) > 0 then
        $policy.candidates
      else
        [{
          token:($policy.token // (.providers[$provider].commands.query_probe[4] // "")),
          selected_from:($policy.selected_from // null),
          reason_code:($policy.source // "legacy-token")
        }]
      end)
    | .[0:$limit]
    | .[]
    | @base64
  ' "$PROVIDER_CONFIG"
}

gitnexus_query_probe_candidate_count() {
  local provider="$1"
  jq -r --arg provider "$provider" '
    (.providers[$provider].query_probe_policy // {}) as $policy
    | if (($policy.candidates // []) | length) > 0 then
        ($policy.candidates | length)
      elif (($policy.token // (.providers[$provider].commands.query_probe[4] // "")) | length) > 0 then
        1
      else
        0
      end
  ' "$PROVIDER_CONFIG"
}

gitnexus_query_probe_expected_hit() {
  local provider="$1"
  jq -r --arg provider "$provider" '
    (.providers[$provider].query_probe_policy // {}) as $policy
    | if ($policy | has("expected_hit")) then ($policy.expected_hit == true) else true end
  ' "$PROVIDER_CONFIG"
}

gitnexus_repo_name_from_remote_url_for_diagnostic() {
  local remote="$1"
  local name
  remote="$(printf '%s' "$remote" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -n "$remote" ] || return 0
  remote="${remote%%#*}"
  remote="${remote%%\?*}"
  while [ "${remote%/}" != "$remote" ]; do
    remote="${remote%/}"
  done
  name="${remote##*/}"
  if [ "$name" = "$remote" ]; then
    name="${remote##*:}"
  fi
  name="${name%.git}"
  if [[ "$name" =~ ^[A-Za-z0-9._-]+$ ]]; then
    printf '%s\n' "$name"
  fi
}

git_remote_url_for_repo_diagnostic() {
  local repo_root="$1"
  local remote_url current_branch branch_remote remote_names remote_count first_remote
  command -v git >/dev/null 2>&1 || return 0

  remote_url="$(git -C "$repo_root" config --get remote.origin.url 2>/dev/null || true)"
  if [ -n "$remote_url" ]; then
    printf '%s\n' "$remote_url"
    return 0
  fi

  current_branch="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [ -n "$current_branch" ] && [ "$current_branch" != "HEAD" ]; then
    branch_remote="$(git -C "$repo_root" config --get "branch.$current_branch.remote" 2>/dev/null || true)"
    if [ -n "$branch_remote" ]; then
      remote_url="$(git -C "$repo_root" config --get "remote.$branch_remote.url" 2>/dev/null || true)"
      if [ -n "$remote_url" ]; then
        printf '%s\n' "$remote_url"
        return 0
      fi
    fi
  fi

  remote_names="$(git -C "$repo_root" remote 2>/dev/null || true)"
  remote_count="$(printf '%s\n' "$remote_names" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  if [ "${remote_count:-0}" -eq 1 ]; then
    first_remote="$(printf '%s\n' "$remote_names" | sed '/^[[:space:]]*$/d' | head -n 1)"
    remote_url="$(git -C "$repo_root" config --get "remote.$first_remote.url" 2>/dev/null || true)"
    if [ -n "$remote_url" ]; then
      printf '%s\n' "$remote_url"
    fi
  fi
}

gitnexus_current_repo_label_for_diagnostic() {
  local meta_path="$REPO_ROOT/.gitnexus/meta.json"
  local remote derived
  if [ -f "$meta_path" ]; then
    remote="$(jq -r '.remoteUrl // empty' "$meta_path" 2>/dev/null || true)"
    derived="$(gitnexus_repo_name_from_remote_url_for_diagnostic "$remote")"
    if [ -n "$derived" ]; then
      printf '%s\n' "$derived"
      return 0
    fi
  fi

  remote="$(git_remote_url_for_repo_diagnostic "$REPO_ROOT")"
  derived="$(gitnexus_repo_name_from_remote_url_for_diagnostic "$remote")"
  if [ -n "$derived" ]; then
    printf '%s\n' "$derived"
  fi
}

gitnexus_query_repo_label_mismatch_failure() {
  local exit_code="$1"
  local configured current
  configured="$(jq -r '.providers.gitnexus.commands.query_probe[6] // empty' "$PROVIDER_CONFIG" 2>/dev/null || true)"
  current="$(gitnexus_current_repo_label_for_diagnostic)"
  if [ -n "$configured" ] && [ -n "$current" ] && [ "$configured" != "$current" ]; then
    jq -n \
      --arg configured "$configured" \
      --arg current "$current" \
      --argjson exit_code "$exit_code" '{
        failed_phase:"query_probe",
        failure_class:"provider-projection-stale",
        reason_code:"gitnexus-repo-label-mismatch",
        exit_code:$exit_code,
        recommended_action:"Rerun spec-mcp-setup to refresh .spec-first/config/graph-providers.json from GitNexus metadata or git remote basename, then rerun spec-graph-bootstrap.",
        diagnostic:("GitNexus query probe used setup-projected repo label `" + $configured + "`, but current repository metadata points to `" + $current + "`.")
      }'
    return 0
  fi
  return 1
}

append_query_probe_attempt() {
  local token="$1"
  local selected_from="$2"
  local reason_code="$3"
  local exit_code="$4"
  local result_class="$5"
  local verification_reason="$6"
  local raw_log="$7"
  QUERY_PROBE_ATTEMPTS="$(jq -c \
    --arg token "$token" \
    --arg selected_from "$selected_from" \
    --arg reason_code "$reason_code" \
    --argjson exit_code "$exit_code" \
    --arg result_class "$result_class" \
    --arg verification_reason "$verification_reason" \
    --arg raw_log "$raw_log" \
    '. + [{
      token:$token,
      selected_from:(if $selected_from == "" then null else $selected_from end),
      reason_code:$reason_code,
      exit_code:$exit_code,
      result_class:$result_class,
      verification_reason:(if $verification_reason == "" then null else $verification_reason end),
      raw_log:$raw_log
    }]' <<<"$QUERY_PROBE_ATTEMPTS")"
}

classify_provider_failure() {
  local provider="$1"
  local phase="$2"
  local exit_code="$3"
  local diagnostic="${4:-}"

  if [ "$provider" = "gitnexus" ] && [ "$phase" = "bootstrap" ] && [ "$exit_code" -eq 139 ]; then
    jq -n --argjson exit_code "$exit_code" '{
      failed_phase:"bootstrap",
      failure_class:"provider-crash",
      reason_code:"gitnexus-analyze-sigsegv",
      exit_code:$exit_code,
      recommended_action:"Do not trust GitNexus artifacts. Use code-review-graph and bounded local fallback; capture analyze.log and retry with a newer GitNexus rc or safer GitNexus runtime settings."
    }'
  elif [ "$provider" = "gitnexus" ] \
    && [ "$phase" = "bootstrap" ] \
    && [ "$exit_code" -ne 0 ] \
    && grep -Eiq 'Cannot open file.*\.gitnexus[\\/]+lbug|\.gitnexus[\\/]+lbug.*Error 3' <<<"$diagnostic"; then
    jq -n --argjson exit_code "$exit_code" '{
      failed_phase:"bootstrap",
      failure_class:"provider-storage-write-failed",
      reason_code:"gitnexus-analyze-storage-write-failed",
      exit_code:$exit_code,
      recommended_action:"GitNexus analyze could not open or write its .gitnexus index state such as .gitnexus/lbug. First verify spec-mcp-setup refreshed the provider projection to the bundled GitNexus package, then rerun spec-graph-bootstrap. If the current bundled package still fails, preserve analyze.log and inspect Windows locks, permissions, path state, or explicitly archive/remove stale .gitnexus as a recovery action. Use code-review-graph degraded fallback meanwhile."
    }'
  elif [ "$exit_code" -eq 124 ]; then
    jq -n --arg phase "$phase" --argjson exit_code "$exit_code" '{
      failed_phase:$phase,
      failure_class:"provider-timeout",
      reason_code:"provider-command-timeout",
      exit_code:$exit_code,
      recommended_action:"Provider command timed out. Inspect the raw log, increase SPEC_FIRST_PROVIDER_COMMAND_TIMEOUT_SECONDS if the command is legitimately slow, or fix the provider before rerunning graph bootstrap."
    }'
  elif [ "$exit_code" -ne 0 ] && grep -Eiq 'ENOTFOUND|getaddrinfo|registry\.npmmirror\.com|registry\.npmjs\.org|EAI_AGAIN' <<<"$diagnostic"; then
    jq -n --arg phase "$phase" --argjson exit_code "$exit_code" '{
      failed_phase:$phase,
      failure_class:"provider-environment",
      reason_code:"provider-network-unavailable",
      exit_code:$exit_code,
      recommended_action:"Provider package registry or network resolution failed. Restore registry/network access or warm the package cache, then rerun graph bootstrap."
    }'
  elif [ "$provider" = "code-review-graph" ] \
    && [ "$exit_code" -ne 0 ] \
    && [[ "$diagnostic" == *"code-review-graph"* ]] \
    && { [[ "$diagnostic" == *"package registry"* ]] || [[ "$diagnostic" == *"No solution found when resolving tool dependencies"* ]] || [[ "$diagnostic" == *"requirements are unsatisfiable"* ]]; }; then
    jq -n --arg phase "$phase" --argjson exit_code "$exit_code" '{
      failed_phase:$phase,
      failure_class:"provider-package-resolution-failed",
      reason_code:"provider-package-not-found",
      exit_code:$exit_code,
      recommended_action:"code-review-graph was not found in the active Python package index. Unset UV_INDEX_URL/PIP_INDEX_URL or use an index that contains code-review-graph, then rerun graph bootstrap."
    }'
  elif [ "$exit_code" -ne 0 ] \
    && grep -Eiq 'Operation not permitted|Permission denied|EACCES' <<<"$diagnostic" \
    && grep -Eiq '(\.cache/uv|/\.npm|\.npm)' <<<"$diagnostic"; then
    jq -n --arg phase "$phase" --argjson exit_code "$exit_code" '{
      failed_phase:$phase,
      failure_class:"provider-environment",
      reason_code:"provider-cache-permission-denied",
      exit_code:$exit_code,
      recommended_action:"Provider cache access was denied. Fix permissions or run with access to the provider cache directories, then rerun graph bootstrap."
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
  local probe_token="${8:-}"
  local probe_selected_from="${9:-}"
  local probe_reason_code="${10:-}"
  local result_class="${11:-}"
  local verification_reason="${12:-}"
  local refresh_mode="${13:-}"
  local attempt_role="${14:-}"
  jq --arg kind "$kind" \
     --arg display "$display" \
     --argjson exit_code "$exit_code" \
     --arg diagnostic "$diagnostic" \
     --argjson truncated "$truncated" \
     --arg raw_log "$raw_log" \
     --arg started_at "$RUN_STARTED_AT" \
     --arg finished_at "$RUN_FINISHED_AT" \
     --argjson duration_ms "$RUN_DURATION_MS" \
     --arg probe_token "$probe_token" \
     --arg probe_selected_from "$probe_selected_from" \
     --arg probe_reason_code "$probe_reason_code" \
     --arg result_class "$result_class" \
     --arg verification_reason "$verification_reason" \
     --arg refresh_mode "$refresh_mode" \
     --arg attempt_role "$attempt_role" \
     '. + [{
       kind:$kind,
       command:$display,
       exit_code:$exit_code,
       diagnostic:$diagnostic,
       diagnostics_truncated:$truncated,
       raw_log:$raw_log,
       started_at:$started_at,
       finished_at:$finished_at,
       duration_ms:$duration_ms
     }
     + (if $probe_token != "" then {probe_token:$probe_token} else {} end)
     + (if $probe_selected_from != "" then {probe_selected_from:$probe_selected_from} else {} end)
     + (if $probe_reason_code != "" then {probe_reason_code:$probe_reason_code} else {} end)
     + (if $result_class != "" then {result_class:$result_class} else {} end)
     + (if $verification_reason != "" then {verification_reason:$verification_reason} else {} end)
     + (if $refresh_mode != "" then {refresh_mode:$refresh_mode} else {} end)
     + (if $attempt_role != "" then {attempt_role:$attempt_role} else {} end)
     ]' "$results_file" > "$results_file.next"
  mv "$results_file.next" "$results_file"
}

append_bootstrap_command_result() {
  local results_file="$1"
  local display="$2"
  local exit_code="$3"
  local diagnostic="$4"
  local truncated="$5"
  local raw_log="$6"
  local refresh_mode="$7"
  local attempt_role="$8"
  append_command_result "$results_file" bootstrap "$display" "$exit_code" "$diagnostic" "$truncated" "$raw_log" "" "" "" "" "" "$refresh_mode" "$attempt_role"
}

write_normalized_artifacts() {
  local provider="$1"
  local provider_status_path="$2"
  local query_ready="$3"
  local command_results="${4:-[]}"
  local normalized_dir="$PROVIDERS_DIR/$provider/normalized"
  mkdir -p "$normalized_dir"

  if [ "$provider" = "gitnexus" ]; then
    for artifact in architecture-facts reuse-candidates; do
      jq -n \
        --arg provider "$provider" \
        --arg generated_at "$BOOTSTRAPPED_AT" \
        --arg source_status_path "$(relpath "$provider_status_path")" \
        --argjson query_ready "$query_ready" \
        --argjson query_probe_attempts "$QUERY_PROBE_ATTEMPTS" \
        --argjson command_results "$command_results" \
        '{
          schema_version:"provider-normalized-envelope.v1",
          provider:$provider,
          generated_at:$generated_at,
          source_status_path:$source_status_path,
          source_raw_logs:(
            (([$command_results[]? | select(.kind == "bootstrap") | .raw_log] | if length > 0 then . else [".spec-first/providers/gitnexus/raw/analyze.log"] end)
            + [".spec-first/providers/gitnexus/raw/status.log"])
            + (if ($query_probe_attempts | length) > 0 then [$query_probe_attempts[].raw_log] else [".spec-first/providers/gitnexus/raw/query.log"] end)
          ),
          query_probe_attempt_logs:[$query_probe_attempts[].raw_log],
          winning_query_probe_log:([$query_probe_attempts[] | select(.result_class == "process-results") | .raw_log][0] // null),
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
      --argjson command_results "$command_results" \
      '{
        schema_version:"provider-normalized-envelope.v1",
        provider:$provider,
        generated_at:$generated_at,
        source_status_path:$source_status_path,
        source_raw_logs:(
          ([$command_results[]? | select(.kind == "bootstrap") | .raw_log] | if length > 0 then . else [".spec-first/providers/code-review-graph/raw/build.log"] end)
          + [".spec-first/providers/code-review-graph/raw/status.log",".spec-first/providers/code-review-graph/raw/query.log"]
        ),
        available_query_surfaces:(if $query_ready then ["status","query_graph_tool","get_impact_radius_tool"] else [] end),
        capabilities:["detect_changes","blast_radius","minimal_context","review_context","related_tests","graph_stats"],
        confidence:(if $query_ready then "medium" else "low" end),
        limitations:(if $query_ready then ["code-review-graph query-surface proof is conservative and should be treated as provider readiness, not semantic evidence."] else ["Provider query readiness is not verified."] end)
      }' | write_file_atomic "$normalized_dir/impact-capabilities.json"
  fi
}

provider_incremental_command_present() {
  local provider="$1"
  jq -e --arg provider "$provider" '(.providers[$provider].commands.incremental // null) != null' "$PROVIDER_CONFIG" >/dev/null
}

provider_incremental_command_json() {
  local provider="$1"
  local last_indexed_commit="${2:-}"
  if [ "$provider" = "code-review-graph" ]; then
    jq -c --arg provider "$provider" --arg sha "$last_indexed_commit" '
      .providers[$provider].commands.incremental
      | if .[length - 1] != "__SPEC_FIRST_LAST_INDEXED_COMMIT__" then
          error("code-review-graph incremental command sentinel missing")
        else
          .[length - 1] = $sha
        end
    ' "$PROVIDER_CONFIG"
  else
    jq -c --arg provider "$provider" '.providers[$provider].commands.incremental' "$PROVIDER_CONFIG"
  fi
}

provider_full_command_json() {
  local provider="$1"
  jq -c --arg provider "$provider" '.providers[$provider].commands.bootstrap' "$PROVIDER_CONFIG"
}

provider_bootstrap_log_for_mode() {
  local provider="$1"
  local refresh_mode="$2"
  local role="${3:-primary}"
  local raw_dir="$4"
  if [ "$provider" = "gitnexus" ]; then
    if [ "$role" = "fallback" ]; then
      printf '%s\n' "$raw_dir/fallback-analyze.log"
    else
      printf '%s\n' "$raw_dir/analyze.log"
    fi
  elif [ "$refresh_mode" = "incremental" ]; then
    printf '%s\n' "$raw_dir/update.log"
  elif [ "$role" = "fallback" ]; then
    printf '%s\n' "$raw_dir/fallback-build.log"
  else
    printf '%s\n' "$raw_dir/build.log"
  fi
}

make_preflight_reason_failure() {
  local reason_code="$1"
  jq -n --arg reason_code "$reason_code" '{
    failed_phase:"preflight",
    failure_class:"refresh-mode-decision",
    reason_code:$reason_code,
    exit_code:null,
    recommended_action:null,
    diagnostic:("Refresh mode preflight selected full refresh: " + $reason_code)
  }'
}

incremental_fallback_success_failure_info() {
  local exit_code="$1"
  jq -n --argjson exit_code "$exit_code" '{
    failed_phase:"bootstrap",
    failure_class:"incremental-fallback-recovered",
    reason_code:"incremental-refresh-failed-fallback-full",
    exit_code:$exit_code,
    recommended_action:null,
    diagnostic:"Incremental refresh failed, then full fallback completed successfully."
  }'
}

incremental_both_failed_failure_info() {
  local exit_code="$1"
  jq -n --argjson exit_code "$exit_code" '{
    failed_phase:"bootstrap",
    failure_class:"provider-command-failed",
    reason_code:"incremental-and-full-failed",
    exit_code:$exit_code,
    recommended_action:"Inspect the provider raw logs. Run a clean full graph bootstrap after fixing the provider command failure.",
    diagnostic:"Incremental refresh failed and the full fallback also failed."
  }'
}

resolve_provider_refresh_mode() {
  local provider="$1"
  local status_path="$2"
  local bootstrap_fingerprint="$3"
  local reason_code=""
  local last_indexed_commit=""

  if [ "$INVOCATION_REFRESH_MODE" != "incremental" ]; then
    jq -n '{refresh_mode:"full",reason_code:null,last_indexed_commit:null}'
    return
  fi

  if ! provider_incremental_command_present "$provider"; then
    jq -n '{refresh_mode:"full",reason_code:"incremental-command-unavailable",last_indexed_commit:null}'
    return
  fi
  if ! command_shape_supported "$provider" incremental; then
    jq -n '{refresh_mode:"blocked",reason_code:"unsupported-provider-command",last_indexed_commit:null}'
    return
  fi

  if [ ! -f "$status_path" ] || ! jq -e '.schema_version == "provider-status.v1"' "$status_path" >/dev/null 2>&1; then
    jq -n '{refresh_mode:"full",reason_code:"incremental-base-ref-unset",last_indexed_commit:null}'
    return
  fi

  reason_code="$(jq -r --argjson current "$bootstrap_fingerprint" '
    if ((.bootstrap_fingerprint // null) == null) then empty
    elif (.bootstrap_fingerprint.spec_first != $current.spec_first) then "fingerprint-spec-first-changed"
    elif (.bootstrap_fingerprint.provider_projection != $current.provider_projection) then "fingerprint-projection-changed"
    elif (.bootstrap_fingerprint.provider != $current.provider) then "fingerprint-provider-changed"
    else empty end
  ' "$status_path")"
  if [ -n "$reason_code" ]; then
    jq -n --arg reason_code "$reason_code" '{refresh_mode:"full",reason_code:$reason_code,last_indexed_commit:null}'
    return
  fi

  if jq -e '.requires_clean_full_refresh == true' "$status_path" >/dev/null 2>&1; then
    jq -n '{refresh_mode:"full",reason_code:"clean-full-refresh-required",last_indexed_commit:null}'
    return
  fi

  last_indexed_commit="$(jq -r '.last_indexed_commit // empty' "$status_path")"
  if [ -z "$last_indexed_commit" ]; then
    jq -n '{refresh_mode:"full",reason_code:"incremental-base-ref-unset",last_indexed_commit:null}'
    return
  fi
  if ! [[ "$last_indexed_commit" =~ ^[0-9a-f]{40}$ ]]; then
    jq -n '{refresh_mode:"full",reason_code:"incremental-base-ref-invalid-format",last_indexed_commit:null}'
    return
  fi

  if ! jq -e --arg sha "$last_indexed_commit" '
    .schema_version == "provider-status.v1"
    and (.graph_ready == true)
    and (.query_ready == true)
    and (.repo_snapshot.worktree_dirty == false)
    and ((.repo_snapshot.source_revision // "") == $sha)
    and ((.bootstrap_fingerprint.repo_snapshot.source_revision // "") == $sha)
  ' "$status_path" >/dev/null 2>&1; then
    jq -n '{refresh_mode:"full",reason_code:"incremental-base-status-untrusted",last_indexed_commit:null}'
    return
  fi

  if ! git -C "$REPO_ROOT" cat-file -e "$last_indexed_commit^{commit}" 2>/dev/null; then
    jq -n '{refresh_mode:"full",reason_code:"incremental-base-ref-missing",last_indexed_commit:null}'
    return
  fi
  if ! git -C "$REPO_ROOT" merge-base --is-ancestor "$last_indexed_commit" "$SOURCE_REVISION" 2>/dev/null; then
    jq -n '{refresh_mode:"full",reason_code:"incremental-base-ref-not-ancestor",last_indexed_commit:null}'
    return
  fi

  jq -n --arg sha "$last_indexed_commit" '{refresh_mode:"incremental",reason_code:null,last_indexed_commit:$sha}'
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
  local query_probe_candidates_truncated=false
  local query_probe_expected_hit=true
  local provider_started_at provider_finished_at provider_started_epoch_ms provider_finished_epoch_ms provider_duration_ms
  local configured_package bundled_package version_policy reuse_decision reuse_eligible reuse_ineligible_reason bootstrap_fingerprint readiness_source
  local prior_last_indexed_commit="" prior_requires_clean_full_refresh=false
  local refresh_decision provider_refresh_mode="full" refresh_reason_code="" incremental_base_commit=""
  local fallback_from_incremental=false refresh_process_failed=false final_full_attempt_succeeded=false skip_normalized_write=false
  local bootstrap_command_json bootstrap_command_display bootstrap_exit_code bootstrap_diagnostic bootstrap_truncated
  provider_started_at="$(utc_now)"
  provider_started_epoch_ms="$(epoch_ms)"
  readiness_source="skipped"
  QUERY_PROBE_ATTEMPTS="[]"
  QUERY_PROBE_CANDIDATES_TRUNCATED=false
  local host_instruction_normalization="null"
  if [ "$provider" = "gitnexus" ]; then
    host_instruction_normalization="$(jq -n '{provider:"gitnexus",status:"not-applicable",advisory:true,reason_code:"gitnexus-provider-not-bootstrapped",exit_code:null,results:[]}')"
  fi
  mkdir -p "$raw_dir" "$provider_dir/normalized"
  if [ -f "$status_path" ] && jq -e '.schema_version == "provider-status.v1"' "$status_path" >/dev/null 2>&1; then
    prior_last_indexed_commit="$(jq -r '.last_indexed_commit // empty' "$status_path")"
    prior_requires_clean_full_refresh="$(jq -r 'if .requires_clean_full_refresh == true then "true" else "false" end' "$status_path")"
  fi

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

  configured_package="$(provider_configured_package_spec "$provider")"
  bundled_package="$(provider_bundled_package_spec "$provider")"
  version_policy="$(provider_version_policy "$provider" "$configured_package" "$bundled_package")"
  reuse_decision="$(provider_reuse_decision "$provider" "$skip_reason" "$version_policy")"
  reuse_eligible="$(jq -r '.eligible | tostring' <<<"$reuse_decision")"
  reuse_ineligible_reason="$(jq -r '.reason // empty' <<<"$reuse_decision")"
  bootstrap_fingerprint="$(provider_bootstrap_fingerprint "$provider" "$configured_package" "$bundled_package" "$version_policy")"

  command_results_file="$(mktemp "${TMPDIR:-/tmp}/spec-graph-command-results.XXXXXX")"
  jq -n '[]' > "$command_results_file"

  if provider_enabled "$provider"; then
    readiness_source="cold-run"
    if [ "$version_policy" = "projection-stale" ] || { [ "$provider" = "code-review-graph" ] && [ "$version_policy" != "pinned" ]; }; then
      readiness_source="preflight-blocked"
      provider_refresh_mode="failed"
      status="failed"
      graph_ready=false
      query_ready=false
      confidence="low"
      if [ "$version_policy" = "projection-stale" ]; then
        failure_info="$(provider_projection_stale_failure "$provider" "$configured_package" "$bundled_package")"
      else
        failure_info="$(code_review_graph_provider_version_unverifiable_failure "$configured_package" "$bundled_package")"
      fi
      stale_label="$(provider_projection_stale_label "$provider")"
      limitations="$(jq -n --arg label "$stale_label" --argjson failure "$failure_info" '[($label + " provider projection is not fresh/verifiable; provider commands were not run.")] + (if ($failure.recommended_action // "") != "" then [$failure.recommended_action] else [] end)')"
      QUERY_PROBE_VERIFICATION_REASON="$(jq -r '.diagnostic' <<<"$failure_info")"
    else
    refresh_decision="$(resolve_provider_refresh_mode "$provider" "$status_path" "$bootstrap_fingerprint")"
    provider_refresh_mode="$(jq -r '.refresh_mode' <<<"$refresh_decision")"
    refresh_reason_code="$(jq -r '.reason_code // empty' <<<"$refresh_decision")"
    incremental_base_commit="$(jq -r '.last_indexed_commit // empty' <<<"$refresh_decision")"
    if [ "$provider_refresh_mode" = "blocked" ]; then
      emit_blocked blocked "$refresh_reason_code" "Provider command shape is unsupported for $provider:incremental."
    fi
    if [ "$provider_refresh_mode" = "incremental" ]; then
      readiness_source="incremental-update"
    else
      readiness_source="cold-run"
      if [ -n "$refresh_reason_code" ]; then
        failure_info="$(make_preflight_reason_failure "$refresh_reason_code")"
      fi
    fi

    status_log="$raw_dir/status.log"
    query_log="$raw_dir/query.log"

    if [ "$provider_refresh_mode" = "incremental" ]; then
      bootstrap_log="$(provider_bootstrap_log_for_mode "$provider" incremental primary "$raw_dir")"
      bootstrap_command_json="$(provider_incremental_command_json "$provider" "$incremental_base_commit")"
      bootstrap_command_display="$(command_json_display "$bootstrap_command_json")"
      run_command_json "$provider" incremental "$bootstrap_log" "$bootstrap_command_json"
      bootstrap_exit_code="$RUN_EXIT_CODE"
      bootstrap_diagnostic="$RUN_DIAGNOSTIC"
      bootstrap_truncated="$RUN_TRUNCATED"
      append_bootstrap_command_result "$command_results_file" "$bootstrap_command_display" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$bootstrap_log")" incremental primary
      if [ "$RUN_EXIT_CODE" -ne 0 ]; then
        fallback_from_incremental=true
        provider_refresh_mode="incremental-fallback-full"
        readiness_source="incremental-fallback-full"
        bootstrap_log="$(provider_bootstrap_log_for_mode "$provider" full fallback "$raw_dir")"
        bootstrap_command_json="$(provider_full_command_json "$provider")"
        bootstrap_command_display="$(command_json_display "$bootstrap_command_json")"
        run_command_json "$provider" bootstrap "$bootstrap_log" "$bootstrap_command_json"
        append_bootstrap_command_result "$command_results_file" "$bootstrap_command_display" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$bootstrap_log")" full fallback
        if [ "$RUN_EXIT_CODE" -eq 0 ]; then
          final_full_attempt_succeeded=true
          failure_info="$(incremental_fallback_success_failure_info "$bootstrap_exit_code")"
        else
          refresh_process_failed=true
          provider_refresh_mode="failed"
          skip_normalized_write=true
          failure_info="$(incremental_both_failed_failure_info "$RUN_EXIT_CODE")"
        fi
      fi
    else
      bootstrap_log="$(provider_bootstrap_log_for_mode "$provider" full primary "$raw_dir")"
      bootstrap_command_json="$(provider_full_command_json "$provider")"
      bootstrap_command_display="$(command_json_display "$bootstrap_command_json")"
      run_command_json "$provider" bootstrap "$bootstrap_log" "$bootstrap_command_json"
      append_bootstrap_command_result "$command_results_file" "$bootstrap_command_display" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$bootstrap_log")" full primary
      if [ "$RUN_EXIT_CODE" -eq 0 ]; then
        final_full_attempt_succeeded=true
      else
        refresh_process_failed=true
      fi
    fi
    if [ "$provider" = "gitnexus" ] && [ "$RUN_EXIT_CODE" -eq 0 ]; then
      host_instruction_normalization="$(normalize_gitnexus_instruction_block_for_root "$REPO_ROOT")"
    fi
    if [ "$RUN_EXIT_CODE" -eq 0 ]; then
      run_configured_command "$provider" status "$status_log"
      append_command_result "$command_results_file" status "$(command_display "$provider" status)" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$status_log")"
      if [ "$RUN_EXIT_CODE" -eq 0 ]; then
        graph_ready=true
        QUERY_PROBE_ATTEMPTS="[]"
        QUERY_PROBE_VERIFICATION_REASON=""
        if [ "$provider" = "gitnexus" ]; then
          attempt_index=0
          query_ready=false
          query_probe_expected_hit="$(gitnexus_query_probe_expected_hit "$provider")"
          candidate_count="$(gitnexus_query_probe_candidate_count "$provider")"
          if [ "${candidate_count:-0}" -gt "$GITNEXUS_QUERY_PROBE_CANDIDATE_LIMIT" ]; then
            query_probe_candidates_truncated=true
            QUERY_PROBE_CANDIDATES_TRUNCATED=true
          fi
          while IFS= read -r probe_candidate; do
            [ -n "$probe_candidate" ] || continue
            probe_token="$(jq -rR '@base64d | fromjson | .token // ""' <<<"$probe_candidate")"
            probe_selected_from="$(jq -rR '@base64d | fromjson | .selected_from // ""' <<<"$probe_candidate")"
            probe_reason_code="$(jq -rR '@base64d | fromjson | .reason_code // "legacy-token"' <<<"$probe_candidate")"
            [ -n "$probe_token" ] || continue
            attempt_index=$((attempt_index + 1))
            if [ "$attempt_index" -eq 1 ]; then
              query_log="$raw_dir/query.log"
            else
              query_log="$raw_dir/query-${attempt_index}.log"
            fi
            run_configured_gitnexus_query_probe "$provider" "$query_log" "$probe_token"
            if [ "$RUN_EXIT_CODE" -eq 0 ] && query_probe_verified "$provider" "$query_log"; then
              query_ready=true
            elif [ "$RUN_EXIT_CODE" -ne 0 ]; then
              QUERY_PROBE_RESULT_CLASS="command-failed"
              QUERY_PROBE_VERIFICATION_REASON="GitNexus query probe command failed."
            fi
            append_command_result \
              "$command_results_file" \
              query_probe \
              "$(gitnexus_query_probe_command_display "$provider" "$probe_token")" \
              "$RUN_EXIT_CODE" \
              "$RUN_DIAGNOSTIC" \
              "$RUN_TRUNCATED" \
              "$(relpath "$query_log")" \
              "$probe_token" \
              "$probe_selected_from" \
              "$probe_reason_code" \
              "$QUERY_PROBE_RESULT_CLASS" \
              "$QUERY_PROBE_VERIFICATION_REASON"
            append_query_probe_attempt \
              "$probe_token" \
              "$probe_selected_from" \
              "$probe_reason_code" \
              "$RUN_EXIT_CODE" \
              "$QUERY_PROBE_RESULT_CLASS" \
              "$QUERY_PROBE_VERIFICATION_REASON" \
              "$(relpath "$query_log")"
            if [ "$query_ready" = "true" ]; then
              break
            fi
          done < <(gitnexus_query_probe_candidates "$provider")
          if [ "$query_ready" != "true" ]; then
            QUERY_PROBE_VERIFICATION_REASON="$(jq -r '
              if length == 0 then
                "GitNexus query probe did not run any candidate."
              elif all(.[]; .result_class == "definitions-only") then
                "All GitNexus query probe candidates returned definitions-only evidence without BM25/process query results."
              elif any(.[]; .result_class == "diagnostic") then
                "GitNexus query probe emitted FTS/read-only/missing-index diagnostics."
	      elif any(.[]; .result_class == "command-failed") then
		"GitNexus query probe command failed."
	      else
		"GitNexus query probe candidates did not return non-empty BM25/process query results."
	      end
	    ' <<<"$QUERY_PROBE_ATTEMPTS")"
            if [ "$query_probe_candidates_truncated" = "true" ]; then
              QUERY_PROBE_VERIFICATION_REASON="$QUERY_PROBE_VERIFICATION_REASON Only the first $GITNEXUS_QUERY_PROBE_CANDIDATE_LIMIT bounded GitNexus query probe candidates were attempted."
            fi
            mismatch_failure="$(gitnexus_query_repo_label_mismatch_failure "$RUN_EXIT_CODE" || true)"
            if [ -n "$mismatch_failure" ]; then
              failure_info="$mismatch_failure"
              QUERY_PROBE_VERIFICATION_REASON="$(jq -r '.diagnostic' <<<"$failure_info")"
            else
              diagnostic_failure="$(gitnexus_query_surface_diagnostic_failure "$RUN_EXIT_CODE" || true)"
              if [ -n "$diagnostic_failure" ]; then
                failure_info="$diagnostic_failure"
                QUERY_PROBE_VERIFICATION_REASON="$(jq -r '.diagnostic' <<<"$failure_info")"
              fi
            fi
          fi
        else
          run_configured_command "$provider" query_probe "$query_log"
          append_command_result "$command_results_file" query_probe "$(command_display "$provider" query_probe)" "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC" "$RUN_TRUNCATED" "$(relpath "$query_log")"
          if [ "$RUN_EXIT_CODE" -eq 0 ] && query_probe_verified "$provider" "$query_log"; then
            query_ready=true
          else
            query_ready=false
          fi
        fi
        if [ "$query_ready" = "true" ]; then
          status="ready"
          confidence="high"
          limitations='[]'
        elif [ "$provider" = "gitnexus" ] && [ "$query_probe_expected_hit" != "true" ]; then
          status="query-not-applicable"
          confidence="medium"
          QUERY_PROBE_VERIFICATION_REASON="GitNexus query proof is not expected because setup found no source-derived probe candidate."
          failure_info="$(jq -n '{failed_phase:null,failure_class:null,reason_code:"gitnexus-query-not-applicable",exit_code:null,recommended_action:"Skip GitNexus process routing for this no-source child repo; use file/direct-read context only if needed."}')"
          limitations="$(jq -n --arg reason "$QUERY_PROBE_VERIFICATION_REASON" '["Build and status succeeded; this repo has no source-derived GitNexus query probe candidate.", $reason]')"
        else
          status="query-unverified"
          confidence="medium"
          limitations="$(jq -n \
            --arg reason "${QUERY_PROBE_VERIFICATION_REASON:-Provider-specific query-surface proof did not verify provider readiness.}" \
            --argjson failure "$failure_info" \
            '["Build and status succeeded, but provider-specific query-surface proof did not verify provider readiness.", $reason]
            + (if ($failure.recommended_action // "") != "" then [$failure.recommended_action] else [] end)')"
        fi
      else
        status="query-unverified"
        query_ready=false
        confidence="medium"
        failure_info="$(classify_provider_failure "$provider" status "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC")"
        limitations="$(jq -n --argjson failure "$failure_info" '["Build succeeded, but status probe did not verify provider readiness."] + (if ($failure.recommended_action // "") != "" then [$failure.recommended_action] else [] end)')"
      fi
    else
      status="failed"
      query_ready=false
      confidence="low"
      provider_refresh_mode="failed"
      if [ "$(jq -r '.reason_code // empty' <<<"$failure_info")" != "incremental-and-full-failed" ]; then
        failure_info="$(classify_provider_failure "$provider" bootstrap "$RUN_EXIT_CODE" "$RUN_DIAGNOSTIC")"
      fi
      limitations="$(jq -n --argjson failure "$failure_info" '["Provider bootstrap command failed."] + (if ($failure.recommended_action // "") != "" then [$failure.recommended_action] else [] end)')"
    fi
    fi
  fi

  command_results="$(cat "$command_results_file")"
  rm -f "$command_results_file"
  if [ "$skip_normalized_write" != "true" ]; then
    write_normalized_artifacts "$provider" "$status_path" "$query_ready" "$command_results"
  fi
  provider_finished_at="$(utc_now)"
  provider_finished_epoch_ms="$(epoch_ms)"
  provider_duration_ms=$((provider_finished_epoch_ms - provider_started_epoch_ms))

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
    --arg worktree_status_hash "$WORKTREE_STATUS_HASH" \
    --arg provider_started_at "$provider_started_at" \
    --arg provider_finished_at "$provider_finished_at" \
    --argjson provider_duration_ms "$provider_duration_ms" \
    --argjson command_results "$command_results" \
    --argjson query_probe_attempts "$QUERY_PROBE_ATTEMPTS" \
    --argjson query_probe_candidate_limit "$GITNEXUS_QUERY_PROBE_CANDIDATE_LIMIT" \
    --argjson query_probe_candidates_truncated "$query_probe_candidates_truncated" \
    --argjson host_instruction_normalization "$host_instruction_normalization" \
    --argjson limitations "$limitations" \
    --argjson failure_info "$failure_info" \
    --arg query_verification_reason "$QUERY_PROBE_VERIFICATION_REASON" \
    --argjson bootstrap_fingerprint "$bootstrap_fingerprint" \
    --argjson reuse_eligible "$reuse_eligible" \
    --arg reuse_ineligible_reason "$reuse_ineligible_reason" \
    --arg readiness_source "$readiness_source" \
    --arg provider_refresh_mode "$provider_refresh_mode" \
    --argjson fallback_from_incremental "$fallback_from_incremental" \
    --arg prior_last_indexed_commit "$prior_last_indexed_commit" \
    --argjson prior_requires_clean_full_refresh "$prior_requires_clean_full_refresh" \
    --argjson refresh_process_failed "$refresh_process_failed" \
    --argjson final_full_attempt_succeeded "$final_full_attempt_succeeded" \
    --slurpfile provider_config "$PROVIDER_CONFIG" \
    '{
      schema_version:"provider-status.v1",
      provider:$provider,
      generated_at:$generated_at,
      timing:{
        started_at:$provider_started_at,
        finished_at:$provider_finished_at,
        duration_ms:$provider_duration_ms
      },
      configured:$configured,
      enabled_for_bootstrap:$enabled,
      dependency_status:$dependency_status,
      host_config_status:$host_config_status,
      skip_reason:(if $status == "skipped" then $skip_reason else null end),
      status:$status,
      graph_ready:$graph_ready,
      query_ready:$query_ready,
      readiness_source:$readiness_source,
      refresh_mode:$provider_refresh_mode,
      fallback_from_incremental:$fallback_from_incremental,
      last_indexed_commit:(
        if ($graph_ready and $query_ready and ($worktree_dirty | not)) then $source_revision
        elif $prior_last_indexed_commit != "" then $prior_last_indexed_commit
        else null end
      ),
      requires_clean_full_refresh:(
        if (($worktree_dirty | not) and $final_full_attempt_succeeded and $graph_ready and $query_ready) then false
        elif $refresh_process_failed then true
        else $prior_requires_clean_full_refresh end
      ),
      reuse_eligible:$reuse_eligible,
      reuse_ineligible_reason:(if $reuse_ineligible_reason == "" then null else $reuse_ineligible_reason end),
      bootstrap_fingerprint:$bootstrap_fingerprint,
      failed_phase:$failure_info.failed_phase,
      failure_class:$failure_info.failure_class,
      reason_code:$failure_info.reason_code,
      exit_code:$failure_info.exit_code,
      recommended_action:$failure_info.recommended_action,
      confidence:$confidence,
      limitations:$limitations,
      query_verification_reason:(if ($status == "query-unverified" or $status == "query-not-applicable") then (if $query_verification_reason != "" then $query_verification_reason else ($limitations[-1] // null) end) else null end),
      query_probe_policy:($provider_config[0].providers[$provider].query_probe_policy // null),
      query_probe_candidate_limit:(if $provider == "gitnexus" then $query_probe_candidate_limit else null end),
      query_probe_candidates_truncated:(if $provider == "gitnexus" then $query_probe_candidates_truncated else null end),
      repo_snapshot:{
        source_revision:$source_revision,
        worktree_dirty:$worktree_dirty,
        worktree_status_hash:$worktree_status_hash
      },
      command_results:$command_results,
      query_probe_attempts:(if $provider == "gitnexus" then $query_probe_attempts else null end),
      host_instruction_normalization:(if $provider == "gitnexus" then $host_instruction_normalization else null end),
      command_source:".spec-first/config/graph-providers.json",
      commands:($command_results | map({(.kind): .command}) | add // {}),
      diagnostics:($command_results | map(select(.diagnostic != "") | .diagnostic)),
      diagnostics_truncated:([ $command_results[] | .diagnostics_truncated == true ] | any),
      raw_logs:(
        ($command_results | map(select(.kind != "query_probe") | {(.kind): .raw_log}) | add // {})
        + (if ([$command_results[] | select(.kind == "query_probe")] | length) > 0 then {query_probe:([$command_results[] | select(.kind == "query_probe")][0].raw_log)} else {} end)
      ),
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
not_applicable_count="$(jq '[.[] | select(.status == "query-not-applicable")] | length' <<<"$statuses_json")"
blocking_not_ready_count="$(jq '[.[] | select(.query_ready != true and .status != "query-not-applicable" and .status != "skipped")] | length' <<<"$statuses_json")"
fallback_ready="$(jq -r '[.fallback_capabilities[]? | select(.support_level != "none")] | length > 0' "$RUNTIME_CAPABILITIES")"
PRESERVE_CANONICAL_FRESHNESS=false
if jq -e 'any(.[]; (.reason_code // "") == "incremental-and-full-failed")' >/dev/null <<<"$statuses_json"; then
  PRESERVE_CANONICAL_FRESHNESS=true
fi

if [ "$provider_count" -gt 0 ] && [ "$ready_count" -eq "$provider_count" ]; then
  WORKFLOW_MODE="primary"
  OVERALL_STATUS="ready"
  EXIT_CODE=0
elif [ "$provider_count" -gt 0 ] && [ "$not_applicable_count" -gt 0 ] && [ "$blocking_not_ready_count" -eq 0 ]; then
  WORKFLOW_MODE="no-source"
  OVERALL_STATUS="not-applicable"
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
if [ "$PRESERVE_CANONICAL_FRESHNESS" = "true" ]; then
  reason_code="incremental-and-full-failed"
elif [ "$WORKFLOW_MODE" = "blocked" ]; then
  reason_code="graph-not-ready"
fi
BOOTSTRAP_FINISHED_AT="$(utc_now)"
BOOTSTRAP_FINISHED_EPOCH_MS="$(epoch_ms)"
BOOTSTRAP_DURATION_MS=$((BOOTSTRAP_FINISHED_EPOCH_MS - SCRIPT_STARTED_EPOCH_MS))

if [ "$PRESERVE_CANONICAL_FRESHNESS" != "true" ] || [ ! -f "$GRAPH_DIR/provider-status.json" ]; then
  jq -n \
  --arg generated_at "$BOOTSTRAPPED_AT" \
  --arg started_at "$SCRIPT_STARTED_AT" \
  --arg finished_at "$BOOTSTRAP_FINISHED_AT" \
  --arg workflow_mode "$WORKFLOW_MODE" \
  --arg confidence "$(if [ "$WORKFLOW_MODE" = "primary" ]; then echo high; elif [ "$WORKFLOW_MODE" = "degraded-fallback" ] || [ "$WORKFLOW_MODE" = "no-source" ]; then echo medium; else echo low; fi)" \
  --argjson duration_ms "$BOOTSTRAP_DURATION_MS" \
  --argjson providers "$statuses_json" \
  '{
    schema_version:"graph-provider-status.v1",
    generated_at:$generated_at,
    timing:{
      started_at:$started_at,
      finished_at:$finished_at,
      duration_ms:$duration_ms
    },
    workflow_mode:$workflow_mode,
    ready_primary_providers:[$providers[] | select(.query_ready == true) | .provider],
    failed_primary_providers:[$providers[] | select(.query_ready != true and .status != "skipped" and .status != "query-not-applicable") | .provider],
    not_applicable_providers:[$providers[] | select(.status == "query-not-applicable") | .provider],
    skipped_primary_providers:[$providers[] | select(.status == "skipped") | .provider],
    partial_primary_available:([$providers[] | select(.query_ready == true)] | length > 0),
    providers:$providers,
    confidence:$confidence,
    limitations:(
      if $workflow_mode == "primary" then []
      elif $workflow_mode == "degraded-fallback" then ["One or more primary graph providers are unavailable or query-unverified; fallback capabilities are required."]
      elif $workflow_mode == "no-source" then ["No source-derived GitNexus process query target is available for this repo."]
      else ["No query-ready graph provider or fallback capability is available."]
      end
    )
  }' | write_file_atomic "$GRAPH_DIR/provider-status.json"
fi

if [ "$PRESERVE_CANONICAL_FRESHNESS" != "true" ] || [ ! -f "$GRAPH_DIR/graph-facts.json" ]; then
jq -n \
  --arg generated_at "$BOOTSTRAPPED_AT" \
  --arg started_at "$SCRIPT_STARTED_AT" \
  --arg finished_at "$BOOTSTRAP_FINISHED_AT" \
  --arg repo_root "$REPO_ROOT" \
  --arg source_revision "$SOURCE_REVISION" \
  --arg worktree_status_hash "$WORKTREE_STATUS_HASH" \
  --argjson worktree_dirty "$WORKTREE_DIRTY" \
  --arg workflow_mode "$WORKFLOW_MODE" \
  --arg confidence "$(if [ "$WORKFLOW_MODE" = "primary" ]; then echo high; elif [ "$WORKFLOW_MODE" = "degraded-fallback" ] || [ "$WORKFLOW_MODE" = "no-source" ]; then echo medium; else echo low; fi)" \
  --argjson duration_ms "$BOOTSTRAP_DURATION_MS" \
  --argjson providers "$statuses_json" \
  '{
    schema_version:"graph-facts.v1",
    generated_at:$generated_at,
    timing:{
      started_at:$started_at,
      finished_at:$finished_at,
      duration_ms:$duration_ms
    },
    repo_root:$repo_root,
    source_revision:$source_revision,
    worktree_dirty:$worktree_dirty,
    worktree_status_hash:$worktree_status_hash,
    workflow_mode:$workflow_mode,
    provider_summary:{
      ready_primary_providers:[$providers[] | select(.query_ready == true) | .provider],
      degraded_providers:[$providers[] | select(.query_ready != true and .status != "skipped" and .status != "query-not-applicable") | .provider],
      not_applicable_providers:[$providers[] | select(.status == "query-not-applicable") | .provider],
      skipped_primary_providers:[$providers[] | select(.status == "skipped") | .provider],
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
      compare_worktree_dirty:true,
      worktree_status_hash:$worktree_status_hash
    },
    confidence:$confidence,
    limitations:(
      if $workflow_mode == "primary" then []
      elif $workflow_mode == "degraded-fallback" then ["Graph facts are partial; downstream workflows must disclose limitations."]
      elif $workflow_mode == "no-source" then ["Graph facts are not applicable for GitNexus process routing because no source-derived query target exists."]
      else ["Graph facts are not query-ready."]
      end
    )
  }' | write_file_atomic "$GRAPH_DIR/graph-facts.json"
fi

if [ "$PRESERVE_CANONICAL_FRESHNESS" != "true" ] || [ ! -f "$IMPACT_DIR/bootstrap-impact-capabilities.json" ]; then
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
fi

provider_report_rows="$(jq -r '
  .[]
  | (((.query_probe_attempts // []) | map("\(.token):\(.result_class)") | join(",")) // "") as $attempts
  | "| \(.provider) | \(.graph_ready) | \(.query_ready) | \(if $attempts == "" then (.query_probe_policy.token // "n/a") else $attempts end) | \(.status) | \(.timing.duration_ms // 0) | \((.query_verification_reason // ((.limitations // []) | join("; ")) // "n/a") | gsub("\\|"; "/")) |"
' <<<"$statuses_json")"

if [ "$PRESERVE_CANONICAL_FRESHNESS" != "true" ]; then
  write_file_atomic "$GRAPH_DIR/bootstrap-report.md" <<MD
# Graph Bootstrap Report

- workflow_mode: $WORKFLOW_MODE
- overall_status: $OVERALL_STATUS
- source_revision: $SOURCE_REVISION
- worktree_dirty: $WORKTREE_DIRTY
- duration_ms: $BOOTSTRAP_DURATION_MS
- provider_status: .spec-first/graph/provider-status.json
- graph_facts: .spec-first/graph/graph-facts.json
- impact_capabilities: .spec-first/impact/bootstrap-impact-capabilities.json

| Provider | Graph Ready | Query Ready | Probe Token | Evidence | Duration ms | Query Verification Reason |
| --- | --- | --- | --- | --- | ---: | --- |
$provider_report_rows
MD
fi

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
  --arg started_at "$SCRIPT_STARTED_AT" \
  --arg finished_at "$BOOTSTRAP_FINISHED_AT" \
  --argjson duration_ms "$BOOTSTRAP_DURATION_MS" \
  --argjson canonical_artifacts_preserved "$PRESERVE_CANONICAL_FRESHNESS" \
  --argjson results "$statuses_json" \
  '{
    schema_version:"graph-bootstrap-result.v1",
    overall_status:$overall_status,
    workflow_mode:$workflow_mode,
    reason_code:(if $reason_code == "" then null else $reason_code end),
    canonical_artifacts_preserved:$canonical_artifacts_preserved,
    repo_root:$repo_root,
    invocation_workspace_root:$invocation_workspace_root,
    selection_source:$selection_source,
    ledger_path:$ledger_path,
    provider_config_path:$provider_config_path,
    runtime_capabilities_path:$runtime_capabilities_path,
    provider_artifacts_path:$provider_artifacts_path,
    timing:{
      started_at:$started_at,
      finished_at:$finished_at,
      duration_ms:$duration_ms
    },
    results:$results
  }'

exit "$EXIT_CODE"
