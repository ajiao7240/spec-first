#!/bin/bash
# install-mcp.sh - Unix installer pipeline for spec-mcp-setup
# Usage: install-mcp.sh [--install <tool-ids>] [--skip <tool-ids>]

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
HOST_INFO_JSON="$($SCRIPT_DIR/detect-host.sh)"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
HOST_DISPLAY_NAME="$(jq -r '.display_name' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
PLATFORM="$(jq -r '.platform' <<<"$HOST_INFO_JSON")"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CONFIG_DIR="$(dirname "$CONFIG_PATH")"

INSTALL_FILTER=""
SKIP_FILTER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install)
      INSTALL_FILTER="${2:-}"
      shift 2
      ;;
    --skip)
      SKIP_FILTER="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ -n "$INSTALL_FILTER" ]; then
  IFS=',' read -ra INSTALL_ARRAY <<< "$INSTALL_FILTER"
else
  INSTALL_ARRAY=()
fi
if [ -n "$SKIP_FILTER" ]; then
  IFS=',' read -ra SKIP_ARRAY <<< "$SKIP_FILTER"
else
  SKIP_ARRAY=()
fi

should_install() {
  local tool_id="$1"
  local required="$2"

  for skip in ${SKIP_ARRAY[@]+"${SKIP_ARRAY[@]}"}; do
    if [ "$skip" = "$tool_id" ]; then
      return 1
    fi
  done

  if [ -n "$INSTALL_FILTER" ]; then
    for install in ${INSTALL_ARRAY[@]+"${INSTALL_ARRAY[@]}"}; do
      if [ "$install" = "$tool_id" ]; then
        return 0
      fi
    done
    return 1
  fi

  [ "$required" = "true" ]
}

is_skipped() {
  local tool_id="$1"
  for skip in ${SKIP_ARRAY[@]+"${SKIP_ARRAY[@]}"}; do
    if [ "$skip" = "$tool_id" ]; then
      return 0
    fi
  done
  return 1
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
     --argjson fallback_applied "$fallback_applied" \
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
       fallback_applied:$fallback_applied,
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
  local stdout_file stderr_file combined
  stdout_file="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-command-stdout.XXXXXX")"
  stderr_file="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-command-stderr.XXXXXX")"

  set +e
  "$@" >"$stdout_file" 2>"$stderr_file"
  RUN_EXIT_CODE=$?
  set -e

  RUN_STDOUT="$(cat "$stdout_file")"
  combined="$(cat "$stderr_file" "$stdout_file" | tr '\n' ' ' | cut -c 1-1000)"
  RUN_DIAGNOSTIC="$combined"
  rm -f "$stdout_file" "$stderr_file"
  return "$RUN_EXIT_CODE"
}

export PATH="$HOME/.cargo/bin:$HOME/.fnm/aliases/default/bin:$HOME/.local/bin:$PATH"
mkdir -p "$CONFIG_DIR"

command -v "$SCRIPT_DIR/configure-host.sh" >/dev/null 2>&1 || chmod +x "$SCRIPT_DIR/configure-host.sh"
command -v "$SCRIPT_DIR/repair-install.sh" >/dev/null 2>&1 || chmod +x "$SCRIPT_DIR/repair-install.sh"
command -v "$SCRIPT_DIR/activate-serena.sh" >/dev/null 2>&1 || chmod +x "$SCRIPT_DIR/activate-serena.sh"

ledger_tmp="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-install-ledger.XXXXXX")"
trap 'rm -f "$ledger_tmp"' EXIT

jq -n --arg host "$HOST" --arg display "$HOST_DISPLAY_NAME" --arg platform "$PLATFORM" '{host:$host,display_name:$display,platform:$platform,results:[]}' > "$ledger_tmp"

while IFS= read -r tool_id; do
  required="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .required' "$TOOLS_JSON")"
  install_kind="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.kind' "$TOOLS_JSON")"
  if [ "$required" = "true" ] && is_skipped "$tool_id"; then
    append_result "$tool_id" "action-required" "failed" "$install_kind" "invalid_required_skip" "required MCP baseline 工具不能通过 --skip 跳过" "" "" false "" "" ""
    continue
  fi

  if ! should_install "$tool_id" "$required"; then
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

  if [ "$install_kind" = "warmup" ]; then
    install_command="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.unix.command' "$TOOLS_JSON")"
    install_args=()
    while IFS= read -r arg; do
      install_args+=("$arg")
    done <<EOF
$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.unix.args[]' "$TOOLS_JSON")
EOF
    if ! run_and_capture "$install_command" "${install_args[@]}"; then
      status="action-required"
      last_action="failed"
      reason_code="warmup_failed"
      next_action="检查工具 warmup 命令与网络可达性"
      exit_code="$RUN_EXIT_CODE"
      diagnostic_summary="$RUN_DIAGNOSTIC"
    fi
  fi

  if [ "$status" = "ready" ]; then
    configure_output=""
    if run_and_capture "$SCRIPT_DIR/configure-host.sh" --tool "$tool_id"; then
      configure_output="$RUN_STDOUT"
      configured_path="$(jq -r '.configured_path // empty' <<<"$configure_output")"
      selected_scope="$(jq -r '.selected_scope // empty' <<<"$configure_output")"
      fallback_applied="$(jq -r '.fallback_applied // false' <<<"$configure_output")"
    else
      exit_code="$RUN_EXIT_CODE"
      diagnostic_summary="$RUN_DIAGNOSTIC"
      if run_and_capture "$SCRIPT_DIR/repair-install.sh" --tool "$tool_id"; then
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
  fi

  if [ "$tool_id" = "serena" ] && [ "$status" = "ready" ]; then
    if ! run_and_capture "$SCRIPT_DIR/activate-serena.sh"; then
      status="partial"
      last_action="failed"
      reason_code="serena_bootstrap_failed"
      next_action="检查当前仓库 Serena project bootstrap"
      exit_code="$RUN_EXIT_CODE"
      diagnostic_summary="$RUN_DIAGNOSTIC"
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
done < <(jq -r '.tools[].id' "$TOOLS_JSON")

cat "$ledger_tmp"
