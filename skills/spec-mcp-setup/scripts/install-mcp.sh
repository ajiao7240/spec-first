#!/bin/bash
# install-mcp.sh - Unix installer pipeline for Required Harness Runtime MCP servers
# Usage: install-mcp.sh [--only <tool-ids>] [--repo <child>] [--all-repos] [--serena-language <language>]... [--serena-languages <comma-list>] [--serena-language-for <child>=<comma-list>]...

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
HOST_INFO_JSON="$(bash "$SCRIPT_DIR/detect-host.sh")"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
HOST_DISPLAY_NAME="$(jq -r '.display_name' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
PLATFORM="$(jq -r '.platform' <<<"$HOST_INFO_JSON")"
CONFIG_DIR="$(dirname "$CONFIG_PATH")"

ONLY_FILTER=""
REPO_ARG=""
ALL_REPOS=false
SERENA_LANGUAGES_TEXT=""
SERENA_LANGUAGE_MAP_TEXT=""
DEFAULT_STAGE_TIMEOUT_SECONDS="${SPEC_FIRST_STAGE_TIMEOUT_SECONDS:-900}"

stage_log() {
  local stage="$1"
  local message="$2"
  printf 'spec-mcp-setup: [mcp/%s] %s\n' "$stage" "$message" >&2
}

append_serena_language_values() {
  local raw="$1"
  local language
  IFS=',' read -ra language_values <<< "$raw"
  for language in ${language_values[@]+"${language_values[@]}"}; do
    language="$(printf '%s' "$language" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -n "$language" ] || continue
    SERENA_LANGUAGES_TEXT="${SERENA_LANGUAGES_TEXT}${language}"$'\n'
  done
}

append_serena_language_map_value() {
  local raw="$1"
  local entry
  IFS=';' read -ra map_entries <<< "$raw"
  for entry in ${map_entries[@]+"${map_entries[@]}"}; do
    entry="$(printf '%s' "$entry" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -n "$entry" ] || continue
    [[ "$entry" == *"="* ]] || { echo "install-mcp.sh: --serena-language-for expects <child>=<language>[,<language>]" >&2; exit 1; }
    SERENA_LANGUAGE_MAP_TEXT="${SERENA_LANGUAGE_MAP_TEXT}${entry}"$'\n'
  done
}

lookup_serena_language_map_value() {
  local child_label="$1"
  local child_path="$2"
  local entry key value
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    key="${entry%%=*}"
    value="${entry#*=}"
    key="$(printf '%s' "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [ "$key" = "$child_label" ] || [ "$key" = "$child_path" ]; then
      printf '%s' "$value"
      return 0
    fi
  done <<<"$SERENA_LANGUAGE_MAP_TEXT"
  return 0
}

write_file_atomic_path() {
  local path="$1"
  local tmp
  mkdir -p "$(dirname "$path")"
  tmp="$(mktemp "${path}.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$path"
}

write_all_repos_install_summary_and_exit() {
  local target_json="$1"
  local selection_source="${2:-explicit-all-repos}"
  local target_mode workspace_root candidate_count summary_items summary_json

  target_mode="$(jq -r '.mode // empty' <<<"$target_json")"
  workspace_root="$(jq -r '.workspace_root // .invocation_cwd' <<<"$target_json")"

  if [ -n "$REPO_ARG" ]; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-setup-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"all-repos-conflicts-with-repo",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Use either --all-repos from a parent workspace or --repo <child>, not both."
    }'
    exit 1
  fi

  if [ -n "$SERENA_LANGUAGES_TEXT" ]; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-setup-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"all-repos-requires-language-map",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Use --serena-language-for <child>=<language>[,<language>] with --all-repos instead of a global --serena-language."
    }'
    exit 1
  fi

  if [ "$target_mode" = "git-repo" ]; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-setup-summary.v1",
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
      schema_version:"workspace-mcp-setup-summary.v1",
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

  summary_items="$(mktemp "${TMPDIR:-/tmp}/mcp-setup-all-repos.XXXXXX")"
  jq -n '[]' > "$summary_items"
  while IFS=$'\t' read -r child_label child_path; do
    [ -n "$child_path" ] || continue
    child_args=(--repo "$child_path")
    if [ -n "$ONLY_FILTER" ]; then
      child_args+=(--only "$ONLY_FILTER")
    fi
    child_languages="$(lookup_serena_language_map_value "$child_label" "$child_path")"
    if [ -n "$child_languages" ]; then
      child_args+=(--serena-languages "$child_languages")
    fi
    set +e
    child_output="$(bash "$0" ${child_args[@]+"${child_args[@]}"})"
    child_status=$?
    set -e
    if ! jq -e . >/dev/null 2>&1 <<<"$child_output"; then
      child_result="$(jq -n --arg output "$child_output" '{host:"unknown",display_name:"unknown",platform:"unknown",results:[],diagnostic:$output}')"
    else
      child_result="$child_output"
    fi
    child_overall="$(jq -r '
      if ((.results // []) | length) == 0 then "action-required"
      elif any((.results // [])[]; .status == "action-required") then "action-required"
      elif any((.results // [])[]; .status == "partial") then "partial"
      else "ready"
      end' <<<"$child_result")"
    child_reason="$(jq -r '[(.results // [])[] | select((.reason_code // "") != "") | .reason_code][0] // empty' <<<"$child_result")"
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

  summary_json="$(jq -n \
    --arg generated_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --arg selection_source "$selection_source" \
    --argjson target "$target_json" \
    --slurpfile items "$summary_items" \
    '($items[0] // []) as $results
    | {
        schema_version:"workspace-mcp-setup-summary.v1",
        generated_at:$generated_at,
        advisory:true,
        workflow_mode:"all-repos",
        selection_source:$selection_source,
        workspace_root:($target.workspace_root // null),
        parent_writes_repo_local_artifacts:false,
        language_map_required_for_first_time_serena:true,
        results:$results,
        counts:{
          total:($results | length),
          ready:([$results[] | select(.overall_status == "ready")] | length),
          partial:([$results[] | select(.overall_status == "partial")] | length),
          action_required:([$results[] | select(.overall_status == "action-required")] | length),
          serena_language_required:([$results[] | select(.reason_code == "serena_language_required")] | length)
        },
        overall_status:(
          if ($results | length) == 0 then "action-required"
          elif ([$results[] | select(.overall_status == "action-required")] | length) > 0 and ([$results[] | select(.overall_status != "action-required")] | length) == 0 then "action-required"
          elif ([$results[] | select(.overall_status != "ready")] | length) > 0 then "partial"
          else "ready"
          end
        ),
        reason_code:(
          if ($results | length) == 0 then "workspace-no-git-candidates"
          elif ([$results[] | select(.overall_status != "ready")] | length) == 0 then null
          else "all-repos-partial-or-action-required"
          end
        ),
        next_action:(
          if ([$results[] | select(.reason_code == "serena_language_required")] | length) > 0 then
            "Inspect per-child project evidence and rerun with --serena-language-for <child>=<language>[,<language>] for action-required children."
          elif ([$results[] | select(.overall_status != "ready")] | length) > 0 then
            "Inspect per-child reason_code and rerun setup for action-required repos."
          else
            "All child repos completed MCP setup."
          end
        )
      }')"
  rm -f "$summary_items"
  printf '%s\n' "$summary_json" | write_file_atomic_path "$workspace_root/.spec-first/workspace/mcp-setup-summary.json"
  printf '%s\n' "$summary_json"
  if [ "$(jq -r '.overall_status' <<<"$summary_json")" = "action-required" ]; then
    exit 1
  fi
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only)
      ONLY_FILTER="${2:-}"
      shift 2
      ;;
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "install-mcp.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --all-repos)
      ALL_REPOS=true
      shift
      ;;
    --serena-language)
      [ -n "${2:-}" ] || { echo "install-mcp.sh: --serena-language requires a value" >&2; exit 1; }
      append_serena_language_values "$2"
      shift 2
      ;;
    --serena-languages)
      [ -n "${2:-}" ] || { echo "install-mcp.sh: --serena-languages requires a value" >&2; exit 1; }
      append_serena_language_values "$2"
      shift 2
      ;;
    --serena-language-for|--serena-language-map)
      [ -n "${2:-}" ] || { echo "install-mcp.sh: $1 requires a value" >&2; exit 1; }
      append_serena_language_map_value "$2"
      shift 2
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

TARGET_ARGS=()
if [ -n "$REPO_ARG" ] && [ "$ALL_REPOS" != "true" ]; then
  TARGET_ARGS+=(--repo "$REPO_ARG")
fi
set +e
TARGET_ENV="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format env ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"})"
TARGET_STATUS=$?
TARGET_JSON="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format json ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"})"
TARGET_JSON_STATUS=$?
set -e
[ -n "$TARGET_ENV" ] || { echo "install-mcp.sh: target resolver returned no env output" >&2; exit 1; }
[ -n "$TARGET_JSON" ] || { echo "install-mcp.sh: target resolver returned no JSON output" >&2; exit 1; }
eval "$TARGET_ENV"
TARGET_STATE_WRITE_ALLOWED="$state_write_allowed"
TARGET_REASON_CODE="$reason_code"
TARGET_NEXT_ACTION="$next_action"
TARGET_SELECTED_REPO_ROOT="$selected_repo_root"
TARGET_WORKSPACE_ROOT="$workspace_root"
TARGET_MODE="$(jq -r '.mode // empty' <<<"$TARGET_JSON")"
TARGET_CANDIDATE_COUNT="$(jq -r '(.candidates // []) | length' <<<"$TARGET_JSON")"
DEFAULT_ALL_REPOS=false
if [ "$ALL_REPOS" != "true" ] && [ -z "$REPO_ARG" ] && [ "$TARGET_MODE" != "git-repo" ] && [ "$TARGET_CANDIDATE_COUNT" -gt 0 ]; then
  DEFAULT_ALL_REPOS=true
fi
if [ -n "$TARGET_SELECTED_REPO_ROOT" ]; then
  REPO_ROOT="$TARGET_SELECTED_REPO_ROOT"
else
  REPO_ROOT="$TARGET_WORKSPACE_ROOT"
fi
if [ "$TARGET_STATUS" -ne 0 ] || [ "$TARGET_JSON_STATUS" -ne 0 ]; then
  TARGET_STATE_WRITE_ALLOWED="false"
fi

if [ "$ALL_REPOS" = "true" ]; then
  write_all_repos_install_summary_and_exit "$TARGET_JSON" "explicit-all-repos"
fi

if [ "$DEFAULT_ALL_REPOS" = "true" ]; then
  write_all_repos_install_summary_and_exit "$TARGET_JSON" "workspace-default-all-repos"
fi

if [ -n "$SERENA_LANGUAGE_MAP_TEXT" ]; then
  echo "install-mcp.sh: --serena-language-for is only valid with --all-repos or parent-workspace default all-repos" >&2
  exit 1
fi

if [ -n "$ONLY_FILTER" ]; then
  IFS=',' read -ra ONLY_ARRAY <<< "$ONLY_FILTER"
else
  ONLY_ARRAY=()
fi

should_install() {
  local tool_id="$1"

  if [ -n "$ONLY_FILTER" ]; then
    for only in ${ONLY_ARRAY[@]+"${ONLY_ARRAY[@]}"}; do
      if [ "$only" = "$tool_id" ]; then
        return 0
      fi
    done
    return 1
  fi

  return 0
}

check_tool_dependencies() {
  local tool_id="$1"
  local dep
  while IFS= read -r dep; do
    if ! command -v "$dep" >/dev/null 2>&1; then
      printf '%s' "$dep"
      return 1
    fi
  done < <(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .dependencies[]' "$TOOLS_JSON")
  return 0
}

append_result() {
  local tool_id="$1"
  local status="$2"
  local last_action="$3"
  local install_kind="$4"
  local reason_code="$5"
  local next_action="$6"
  local configured_path="$7"
  local selected_scope="$8"
  local fallback_applied="$9"
  local exit_code="${10}"
  local diagnostic_summary="${11}"
  local repair_diagnostic_summary="${12}"

  jq --arg id "$tool_id" \
     --arg status "$status" \
     --arg last_action "$last_action" \
     --arg install_kind "$install_kind" \
     --arg reason_code "$reason_code" \
     --arg next_action "$next_action" \
     --arg configured_path "$configured_path" \
     --arg selected_scope "$selected_scope" \
     --arg fallback_applied "$fallback_applied" \
     --arg exit_code "$exit_code" \
     --arg diagnostic_summary "$diagnostic_summary" \
     --arg repair_diagnostic_summary "$repair_diagnostic_summary" \
     '.results += [{
       tool_id:$id,
       status:$status,
       last_action:$last_action,
       install_kind:$install_kind,
       reason_code:$reason_code,
       next_action:$next_action,
       configured_path:$configured_path,
       selected_scope:$selected_scope,
       fallback_applied:($fallback_applied == "true"),
       exit_code:($exit_code | if . == "" then null else tonumber end),
       diagnostic_summary:$diagnostic_summary,
       repair_diagnostic_summary:$repair_diagnostic_summary
     }]' \
     "$ledger_tmp" > "$ledger_tmp.next"
  mv "$ledger_tmp.next" "$ledger_tmp"
}

RUN_STDOUT=""
RUN_DIAGNOSTIC=""
RUN_EXIT_CODE=0
run_and_capture() {
  local stage="$1"
  local timeout_seconds="$2"
  shift 2
  local stdout_file stderr_file combined
  stdout_file="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-command-stdout.XXXXXX")"
  stderr_file="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-command-stderr.XXXXXX")"

  stage_log "$stage" "start"
  set +e
  python3 - "$timeout_seconds" "$@" <<'PY' >"$stdout_file" 2>"$stderr_file"
import subprocess
import sys

timeout = float(sys.argv[1])
args = sys.argv[2:]

try:
    completed = subprocess.run(args, check=False, stdin=subprocess.DEVNULL, timeout=timeout)
except subprocess.TimeoutExpired:
    sys.exit(124)
except FileNotFoundError as exc:
    sys.stderr.write(f"{exc}\n")
    sys.exit(127)
except Exception as exc:
    sys.stderr.write(f"{exc}\n")
    sys.exit(1)

sys.exit(completed.returncode)
PY
  RUN_EXIT_CODE=$?
  set -e

  RUN_STDOUT="$(cat "$stdout_file")"
  combined="$(cat "$stderr_file" "$stdout_file" | tr '\n' ' ' | cut -c 1-1000)"
  RUN_DIAGNOSTIC="$combined"
  rm -f "$stdout_file" "$stderr_file"
  if [ "$RUN_EXIT_CODE" -eq 124 ]; then
    stage_log "$stage" "timed out after ${timeout_seconds}s"
  else
    stage_log "$stage" "done (exit $RUN_EXIT_CODE)"
  fi
  return "$RUN_EXIT_CODE"
}

export PATH="$HOME/.cargo/bin:$HOME/.fnm/aliases/default/bin:$HOME/.local/bin:$PATH"
mkdir -p "$CONFIG_DIR"

ledger_tmp="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-install-ledger.XXXXXX")"
trap 'rm -f "$ledger_tmp"' EXIT

jq -n --arg host "$HOST" --arg display "$HOST_DISPLAY_NAME" --arg platform "$PLATFORM" '{host:$host,display_name:$display,platform:$platform,results:[]}' > "$ledger_tmp"

TOOL_IDS=()
while IFS= read -r tool_id; do
  TOOL_IDS+=("$tool_id")
done < <(jq -r '.tools[].id' "$TOOLS_JSON")

for tool_id in "${TOOL_IDS[@]}"; do
  required="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .required' "$TOOLS_JSON")"
  if [ "$required" != "true" ]; then
    append_result "$tool_id" "action-required" "failed" "warmup" "registry_not_required" "mcp-tools.json schema v4 只允许 required tools" "" "" false "" "" ""
    continue
  fi

  install_kind="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.kind' "$TOOLS_JSON")"
  host_config_required="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | if has("host_config_required") then .host_config_required else true end' "$TOOLS_JSON")"

  if ! should_install "$tool_id"; then
    continue
  fi

  last_action="installed"
  reason_code=""
  status="ready"
  next_action=""
  configured_path=""
  selected_scope=""
  fallback_applied=false
  exit_code=""
  diagnostic_summary=""
  repair_diagnostic_summary=""

  missing_dep="$(check_tool_dependencies "$tool_id" || true)"
  if [ -n "$missing_dep" ]; then
    status="action-required"
    last_action="failed"
    reason_code="missing_dependency"
    next_action="安装依赖: $missing_dep"
    diagnostic_summary="missing dependency: $missing_dep"
  fi

  if [ "$status" = "ready" ] && [ "$install_kind" = "warmup" ]; then
    install_command="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.unix.command' "$TOOLS_JSON")"
    install_args=()
    while IFS= read -r arg; do
      install_args+=("$arg")
    done <<EOF
$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.unix.args[]' "$TOOLS_JSON")
EOF
    if ! run_and_capture "warmup:$tool_id" "$DEFAULT_STAGE_TIMEOUT_SECONDS" "$install_command" "${install_args[@]}"; then
      status="action-required"
      last_action="failed"
      reason_code="warmup_failed"
      next_action="检查工具 warmup 命令与网络可达性"
      exit_code="$RUN_EXIT_CODE"
      diagnostic_summary="$RUN_DIAGNOSTIC"
    fi
  fi

  if [ "$status" = "ready" ] && [ "$host_config_required" = "true" ]; then
    configure_output=""
    if run_and_capture "configure:$tool_id" "$DEFAULT_STAGE_TIMEOUT_SECONDS" bash "$SCRIPT_DIR/configure-host.sh" --tool "$tool_id"; then
      configure_output="$RUN_STDOUT"
      configured_path="$(jq -r '.configured_path // empty' <<<"$configure_output")"
      selected_scope="$(jq -r '.selected_scope // empty' <<<"$configure_output")"
      fallback_applied="$(jq -r '.fallback_applied // false' <<<"$configure_output")"
    else
      exit_code="$RUN_EXIT_CODE"
      diagnostic_summary="$RUN_DIAGNOSTIC"
      if run_and_capture "repair:$tool_id" "$DEFAULT_STAGE_TIMEOUT_SECONDS" bash "$SCRIPT_DIR/repair-install.sh" --tool "$tool_id"; then
        repair_output="$RUN_STDOUT"
        last_action="repaired"
        configured_path="$(jq -r '.configured_path // empty' <<<"$repair_output")"
        selected_scope="$(jq -r '.selected_scope // empty' <<<"$repair_output")"
        fallback_applied="$(jq -r '.fallback_applied // false' <<<"$repair_output")"
      else
        status="action-required"
        last_action="failed"
        reason_code="configure_failed"
        next_action="检查宿主 CLI 与配置写入权限"
        repair_diagnostic_summary="$RUN_DIAGNOSTIC"
      fi
    fi
  elif [ "$status" = "ready" ]; then
    last_action="host-config-skipped"
    next_action="run spec-graph-bootstrap"
    diagnostic_summary="host MCP config is not required for this provider"
  fi

  if [ "$tool_id" = "serena" ] && [ "$status" = "ready" ]; then
    if [ "$TARGET_STATE_WRITE_ALLOWED" != "true" ]; then
      status="partial"
      last_action="skipped"
      reason_code="${TARGET_REASON_CODE:-workspace-target-required}"
      next_action="${TARGET_NEXT_ACTION:-Choose a child Git repo and rerun with --repo <child>.}"
      diagnostic_summary="project target unresolved: $reason_code"
    else
      serena_activate_args=(--repo "$REPO_ROOT")
      while IFS= read -r language; do
        [ -n "$language" ] || continue
        serena_activate_args+=("--language" "$language")
      done <<<"$SERENA_LANGUAGES_TEXT"
      if ! run_and_capture "serena:$tool_id" "$DEFAULT_STAGE_TIMEOUT_SECONDS" bash "$SCRIPT_DIR/activate-serena.sh" ${serena_activate_args[@]+"${serena_activate_args[@]}"}; then
        status="partial"
        last_action="failed"
        reason_code="serena_bootstrap_failed"
        next_action="检查当前仓库 Serena project bootstrap"
        exit_code="$RUN_EXIT_CODE"
        diagnostic_summary="$RUN_DIAGNOSTIC"
        if [[ "$RUN_DIAGNOSTIC" == *"first-time bootstrap requires --language"* ]]; then
          reason_code="serena_language_required"
          next_action="基于项目证据选择 Serena 语言，并用 --serena-language <language> 重试"
        fi
      fi
    fi
  fi

  if [ "$status" = "ready" ] && [ "$tool_id" = "serena" ]; then
    ready_marker_file="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .project_bootstrap.ready_marker_file // empty' "$TOOLS_JSON")"
    if [ -n "$ready_marker_file" ] && [ ! -f "$REPO_ROOT/$ready_marker_file" ]; then
      status="partial"
      last_action="failed"
      reason_code="serena_bootstrap_failed"
      next_action="检查当前仓库 Serena project bootstrap"
    fi
  fi

  append_result "$tool_id" "$status" "$last_action" "$install_kind" "$reason_code" "$next_action" "$configured_path" "$selected_scope" "$fallback_applied" "$exit_code" "$diagnostic_summary" "$repair_diagnostic_summary"
done

cat "$ledger_tmp"
