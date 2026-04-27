#!/bin/bash
# install-helpers.sh - Install or verify required non-MCP helper tooling.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

MODE="install"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install)
      MODE="install"
      shift
      ;;
    --verify-only)
      MODE="verify-only"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

status="ready"
dependency_status="ready"
install_status="ready"
skill_status="ready"
project_status="not-applicable"
next_action=""
GLOBAL_AGENT_BROWSER_SKILL="$HOME/.agents/skills/agent-browser/SKILL.md"

run_or_mark() {
  local failure_status="$1"
  local action="$2"
  shift 2
  if ! "$@" >/dev/null 2>&1; then
    status="action-required"
    case "$failure_status" in
      install) install_status="action-required" ;;
      skill) skill_status="action-required" ;;
    esac
    next_action="$action"
    return 1
  fi
  return 0
}

if ! command -v agent-browser >/dev/null 2>&1; then
  dependency_status="missing"
  install_status="action-required"
  if [ "$MODE" = "verify-only" ]; then
    status="action-required"
    next_action="install agent-browser CLI"
  else
    if CI=true npm install -g agent-browser --no-audit --no-fund --loglevel=error >/dev/null 2>&1; then
      dependency_status="ready"
      install_status="ready"
    else
      status="action-required"
      next_action="npm install -g agent-browser failed"
    fi
  fi
fi

if [ "$status" = "ready" ] && [ "$MODE" = "verify-only" ] && [ ! -f "$GLOBAL_AGENT_BROWSER_SKILL" ]; then
  status="action-required"
  skill_status="action-required"
  next_action="install global agent-browser skill"
fi

if [ "$status" = "ready" ] && [ "$MODE" = "install" ]; then
  run_or_mark install "run agent-browser install manually" agent-browser install || true
fi

if [ "$status" = "ready" ] && [ "$MODE" = "install" ]; then
  run_or_mark skill "install global agent-browser skill manually" npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y || true
fi

jq -n \
  --arg status "$status" \
  --arg dependency_status "$dependency_status" \
  --arg install_status "$install_status" \
  --arg skill_status "$skill_status" \
  --arg project_status "$project_status" \
  --arg next_action "$next_action" \
  '{
    helper_tools: {
      "agent-browser": {
        required: true,
        type: "helper",
        dependency_status: $dependency_status,
        host_config_status: "not-applicable",
        install_status: $install_status,
        skill_status: $skill_status,
        project_status: $project_status,
        result: $status,
        next_action: $next_action
      }
    }
  }'
