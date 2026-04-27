#!/bin/bash
# bootstrap-providers.sh - Build external graph provider indexes for the current repo.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
MCP_SETUP_SCRIPTS_DIR="$(cd "$SKILL_DIR/../spec-mcp-setup/scripts" && pwd)"

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
else
  echo '{"schema_version":"graph-bootstrap-result.v1","overall_status":"action-required","reason_code":"not_git_repo","next_action":"Run spec-graph-bootstrap inside a git repo."}'
  exit 1
fi

HOST_INFO_JSON="$(bash "$MCP_SETUP_SCRIPTS_DIR/detect-host.sh")"
LEDGER_PATH="$(jq -r '.marker_path' <<<"$HOST_INFO_JSON")"
PROVIDER_CONFIG="$REPO_ROOT/.spec-first/config/graph-providers.json"

if [ ! -f "$LEDGER_PATH" ]; then
  jq -n --arg ledger "$LEDGER_PATH" '{schema_version:"graph-bootstrap-result.v1",overall_status:"action-required",reason_code:"missing_ledger",ledger_path:$ledger,next_action:"Run spec-mcp-setup first."}'
  exit 1
fi

if [ "$(jq -r '.schema_version // empty' "$LEDGER_PATH")" != "v2" ]; then
  jq -n --arg ledger "$LEDGER_PATH" '{schema_version:"graph-bootstrap-result.v1",overall_status:"action-required",reason_code:"unsupported_ledger_schema",ledger_path:$ledger,next_action:"Rerun spec-mcp-setup to write readiness ledger v2."}'
  exit 1
fi

if [ "$(jq -r '.baseline_ready // false' "$LEDGER_PATH")" != "true" ]; then
  jq -n --arg ledger "$LEDGER_PATH" '{schema_version:"graph-bootstrap-result.v1",overall_status:"action-required",reason_code:"baseline_not_ready",ledger_path:$ledger,next_action:"Fix Required Harness Runtime setup, then rerun spec-mcp-setup."}'
  exit 1
fi

if [ ! -f "$PROVIDER_CONFIG" ]; then
  jq -n --arg config "$PROVIDER_CONFIG" '{schema_version:"graph-bootstrap-result.v1",overall_status:"action-required",reason_code:"missing_provider_config",provider_config_path:$config,next_action:"Run spec-mcp-setup inside this git repo first."}'
  exit 1
fi

if [ "$(jq -r '.schema_version // empty' "$PROVIDER_CONFIG")" != "graph-providers.v1" ]; then
  jq -n --arg config "$PROVIDER_CONFIG" '{schema_version:"graph-bootstrap-result.v1",overall_status:"action-required",reason_code:"unsupported_provider_config_schema",provider_config_path:$config,next_action:"Rerun spec-mcp-setup to refresh graph-providers.json."}'
  exit 1
fi

results_tmp="$(mktemp "${TMPDIR:-/tmp}/spec-graph-bootstrap-results.XXXXXX")"
success_tmp="$(mktemp "${TMPDIR:-/tmp}/spec-graph-bootstrap-success.XXXXXX")"
trap 'rm -f "$results_tmp" "$success_tmp"' EXIT
jq -n '[]' > "$results_tmp"
jq -n '[]' > "$success_tmp"

append_result() {
  local provider="$1"
  local status="$2"
  local command="$3"
  local exit_code="$4"
  local diagnostic="$5"
  jq --arg provider "$provider" \
     --arg status "$status" \
     --arg command "$command" \
     --arg exit_code "$exit_code" \
     --arg diagnostic "$diagnostic" \
     '. + [{
       provider:$provider,
       status:$status,
       command:$command,
       exit_code:($exit_code | if . == "" then null else tonumber end),
       diagnostic_summary:$diagnostic
     }]' "$results_tmp" > "$results_tmp.next"
  mv "$results_tmp.next" "$results_tmp"
}

mark_success() {
  local provider="$1"
  jq --arg provider "$provider" '. + [$provider]' "$success_tmp" > "$success_tmp.next"
  mv "$success_tmp.next" "$success_tmp"
}

run_provider() {
  local provider="$1"
  shift
  local command_display="$*"
  local stdout_file stderr_file exit_code diagnostic
  stdout_file="$(mktemp "${TMPDIR:-/tmp}/spec-graph-provider-stdout.XXXXXX")"
  stderr_file="$(mktemp "${TMPDIR:-/tmp}/spec-graph-provider-stderr.XXXXXX")"

  set +e
  (cd "$REPO_ROOT" && "$@") >"$stdout_file" 2>"$stderr_file"
  exit_code=$?
  set -e

  diagnostic="$(cat "$stderr_file" "$stdout_file" | tr '\n' ' ' | cut -c 1-1000)"
  rm -f "$stdout_file" "$stderr_file"

  if [ "$exit_code" -eq 0 ]; then
    append_result "$provider" "ready" "$command_display" "$exit_code" "$diagnostic"
    mark_success "$provider"
  else
    append_result "$provider" "action-required" "$command_display" "$exit_code" "$diagnostic"
  fi
}

if jq -e '.providers.gitnexus.configured == true and .providers.gitnexus.enabled_for_bootstrap == true' "$PROVIDER_CONFIG" >/dev/null; then
  run_provider "gitnexus" npx -y gitnexus@latest analyze
else
  append_result "gitnexus" "skipped" "npx -y gitnexus@latest analyze" "" "provider is not configured for bootstrap"
fi

if jq -e '.providers["code-review-graph"].configured == true and .providers["code-review-graph"].enabled_for_bootstrap == true' "$PROVIDER_CONFIG" >/dev/null; then
  run_provider "code-review-graph" uvx code-review-graph build
else
  append_result "code-review-graph" "skipped" "uvx code-review-graph build" "" "provider is not configured for bootstrap"
fi

bootstrapped_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
config_tmp="$(mktemp "${PROVIDER_CONFIG}.XXXXXX")"
jq --arg bootstrapped_at "$bootstrapped_at" --argjson successes "$(cat "$success_tmp")" '
  .last_updated_by = "spec-graph-bootstrap"
  | .last_bootstrapped_at = $bootstrapped_at
  | .providers |= with_entries(
      .key as $provider_key
      | if ($successes | index($provider_key)) then
        .value.query_ready = true
        | .value.bootstrap_required = false
        | .value.last_bootstrap_status = "ready"
        | .value.last_bootstrapped_at = $bootstrapped_at
      else
        .value.query_ready = false
        | .value.bootstrap_required = true
        | .value.last_bootstrap_status = "not-ready"
      end
    )
  | .boundaries.graph_bootstrap_required = (([.providers[] | .bootstrap_required == true] | any))
' "$PROVIDER_CONFIG" > "$config_tmp"
mv "$config_tmp" "$PROVIDER_CONFIG"

overall_status="$(jq -r 'if (map(.status == "ready") | all) then "ready" else "action-required" end' "$results_tmp")"
jq -n \
  --arg repo_root "$REPO_ROOT" \
  --arg ledger_path "$LEDGER_PATH" \
  --arg provider_config_path "$PROVIDER_CONFIG" \
  --arg overall_status "$overall_status" \
  --argjson results "$(cat "$results_tmp")" \
  '{
    schema_version:"graph-bootstrap-result.v1",
    overall_status:$overall_status,
    repo_root:$repo_root,
    ledger_path:$ledger_path,
    provider_config_path:$provider_config_path,
    results:$results
  }'

[ "$overall_status" = "ready" ]
