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
  if ! should_install "$tool_id" "$required"; then
    continue
  fi

  install_kind="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.kind' "$TOOLS_JSON")"
  last_action="installed"
  reason_code=""
  status="ready"
  next_action=""

  if [ "$install_kind" = "warmup" ]; then
    install_command="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.unix.command' "$TOOLS_JSON")"
    install_args=()
    while IFS= read -r arg; do
      install_args+=("$arg")
    done <<EOF
$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .installation.unix.args[]' "$TOOLS_JSON")
EOF
    if ! "$install_command" "${install_args[@]}" >/dev/null 2>&1; then
      status="action-required"
      last_action="failed"
      reason_code="warmup_failed"
      next_action="检查工具 warmup 命令与网络可达性"
    fi
  fi

  if [ "$status" = "ready" ] && ! "$SCRIPT_DIR/configure-host.sh" --tool "$tool_id"; then
    if "$SCRIPT_DIR/repair-install.sh" --tool "$tool_id"; then
      last_action="repaired"
    else
      status="action-required"
      last_action="failed"
      reason_code="configure_failed"
      next_action="检查宿主 CLI 与配置写入权限"
    fi
  fi

  if [ "$tool_id" = "serena" ] && [ "$status" = "ready" ]; then
    if ! "$SCRIPT_DIR/activate-serena.sh"; then
      status="partial"
      last_action="failed"
      reason_code="serena_bootstrap_failed"
      next_action="检查当前仓库 Serena project bootstrap"
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

  jq --arg id "$tool_id" \
     --arg status "$status" \
     --arg last_action "$last_action" \
     --arg install_kind "$install_kind" \
     --arg reason_code "$reason_code" \
     --arg next_action "$next_action" \
     '.results += [{tool_id:$id,status:$status,last_action:$last_action,install_kind:$install_kind,reason_code:$reason_code,next_action:$next_action}]' \
     "$ledger_tmp" > "$ledger_tmp.next"
  mv "$ledger_tmp.next" "$ledger_tmp"
done < <(jq -r '.tools[].id' "$TOOLS_JSON")

cat "$ledger_tmp"
