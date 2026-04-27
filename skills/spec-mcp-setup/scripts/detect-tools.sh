#!/bin/bash
# detect-tools.sh - Detect host config and project bootstrap readiness for spec-mcp-setup
# Output: JSON facts ledger

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
HOST_INFO_JSON="$($SCRIPT_DIR/detect-host.sh)"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
PLATFORM="$(jq -r '.platform' <<<"$HOST_INFO_JSON")"
SELECTED_SCOPE="$(jq -r '.selected_scope // empty' <<<"$HOST_INFO_JSON")"
PRECEDENCE_BLOCKED="$(jq -r '.precedence_blocked' <<<"$HOST_INFO_JSON")"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

extract_toml_section() {
  local section_name="$1"
  awk -v section="[mcp_servers.$section_name]" '
    $0 == section { in_section = 1; next }
    /^\[mcp_servers\./ && in_section { exit }
    in_section { print }
  ' "$CONFIG_PATH"
}

dependency_status() {
  local dep="$1"
  if command -v "$dep" >/dev/null 2>&1; then
    echo ready
  else
    echo missing
  fi
}

host_config_status() {
  local tool_id="$1"
  local detect_kind detect_key host_cfg expected_command expected_args block expected_args_count i expected_arg
  detect_kind="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detection.kind' "$TOOLS_JSON")"
  detect_key="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .detection.key' "$TOOLS_JSON")"
  host_cfg="$(jq -c --arg id "$tool_id" --arg host "$HOST" '.tools[] | select(.id == $id) | .host_config[$host]' "$TOOLS_JSON")"

  [ -n "$SELECTED_SCOPE" ] || {
    echo action-required
    return
  }

  if [ "$PRECEDENCE_BLOCKED" = "true" ]; then
    echo precedence-blocked
    return
  fi

  [ -f "$CONFIG_PATH" ] || {
    echo action-required
    return
  }

  expected_command="$(jq -r '.command' <<<"$host_cfg")"
  expected_args="$(jq -c '.args' <<<"$host_cfg")"

  case "$detect_kind" in
    host_config_exact)
      if [ "$HOST" = "claude" ]; then
        if jq -e --arg key "$detect_key" --arg command "$expected_command" --argjson expected_args "$expected_args" '.mcpServers[$key].command == $command and (.mcpServers[$key].args // []) == $expected_args' "$CONFIG_PATH" >/dev/null 2>&1; then
          if [ "$SELECTED_SCOPE" = "managed" ]; then
            echo ready
          else
            echo fallback-active
          fi
        else
          echo action-required
        fi
        return
      fi
      block="$(extract_toml_section "$detect_key")"
      if [ -n "$block" ] && printf '%s\n' "$block" | grep -qF "command = \"$expected_command\""; then
        expected_args_count="$(jq 'length' <<<"$expected_args")"
        if [ "$expected_args_count" -gt 0 ]; then
          for i in $(seq 0 $((expected_args_count - 1))); do
            expected_arg="$(jq -r ".[$i]" <<<"$expected_args")"
            if ! printf '%s\n' "$block" | grep -qF -- "$expected_arg"; then
              echo action-required
              return
            fi
          done
        fi
        echo ready
      else
        echo action-required
      fi
      ;;
    host_config_key_only)
      if [ "$HOST" = "claude" ]; then
        if jq -e --arg key "$detect_key" '.mcpServers[$key] != null' "$CONFIG_PATH" >/dev/null 2>&1; then
          if [ "$SELECTED_SCOPE" = "managed" ]; then
            echo ready
          else
            echo fallback-active
          fi
        else
          echo action-required
        fi
      else
        if grep -qF "[mcp_servers.${detect_key}]" "$CONFIG_PATH" >/dev/null 2>&1; then
          echo ready
        else
          echo action-required
        fi
      fi
      ;;
    *)
      echo action-required
      ;;
  esac
}

project_status() {
  local tool_id="$1"
  local bootstrap_kind required project_file ready_marker_file
  bootstrap_kind="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .project_bootstrap.kind' "$TOOLS_JSON")"
  required="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .project_bootstrap.required' "$TOOLS_JSON")"
  if [ "$bootstrap_kind" = "none" ] || [ "$required" != "true" ]; then
    echo not-applicable
    return
  fi

  project_file="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .project_bootstrap.project_file // empty' "$TOOLS_JSON")"
  ready_marker_file="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .project_bootstrap.ready_marker_file // empty' "$TOOLS_JSON")"

  if [ -n "$project_file" ] && [ ! -f "$REPO_ROOT/$project_file" ]; then
    echo pending
    return
  fi

  if [ "$bootstrap_kind" = "serena" ]; then
    if [ -n "$ready_marker_file" ] && [ -f "$REPO_ROOT/$ready_marker_file" ]; then
      echo ready
    else
      echo failed
    fi
    return
  fi

  if [ -n "$project_file" ] && [ -f "$REPO_ROOT/$project_file" ]; then
    echo ready
  else
    echo pending
  fi
}

overall_status=ready
baseline_ready=true
results_json='{}'
next_actions_json='[]'

append_next_action() {
  local action="$1"
  [ -n "$action" ] || return 0
  next_actions_json="$(jq --arg action "$action" 'if index($action) then . else . + [$action] end' <<<"$next_actions_json")"
}

while IFS= read -r tool_id; do
  required="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .required' "$TOOLS_JSON")"
  dep_status=ready
  while IFS= read -r dep; do
    current_dep_status="$(dependency_status "$dep")"
    if [ "$current_dep_status" != "ready" ]; then
      dep_status="$current_dep_status"
      break
    fi
  done < <(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .dependencies[]' "$TOOLS_JSON")

  cfg_status="$(host_config_status "$tool_id")"
  proj_status="$(project_status "$tool_id")"
  next_action=""
  if [ "$dep_status" != "ready" ]; then
    next_action="install dependency"
  elif [ "$cfg_status" = "action-required" ]; then
    next_action="configure host"
  elif [ "$cfg_status" = "precedence-blocked" ]; then
    next_action="review higher-precedence host config"
  elif [ "$proj_status" = "pending" ]; then
    next_action="bootstrap project"
  fi

  if [ "$required" = "true" ]; then
    if [ "$dep_status" != "ready" ] || { [ "$cfg_status" != "ready" ] && [ "$cfg_status" != "fallback-active" ]; } || { [ "$proj_status" != "ready" ] && [ "$proj_status" != "not-applicable" ]; }; then
      baseline_ready=false
      if [ "$overall_status" = "ready" ]; then
        overall_status=partial
      fi
    fi
  fi

  if [ "$required" = "true" ] && { [ "$dep_status" = "missing" ] || [ "$cfg_status" = "action-required" ] || [ "$cfg_status" = "precedence-blocked" ]; }; then
    overall_status=action-required
  elif [ "$required" = "true" ] && [ "$cfg_status" = "fallback-active" ] && [ "$overall_status" = "ready" ]; then
    overall_status=partial
  elif [ "$required" = "true" ] && [ "$proj_status" = "failed" ] && [ "$overall_status" = "ready" ]; then
    overall_status=partial
  fi

  append_next_action "$next_action"

  results_json="$(jq \
    --arg id "$tool_id" \
    --argjson required_json "$required" \
    --arg dep "$dep_status" \
    --arg cfg "$cfg_status" \
    --arg proj "$proj_status" \
    --arg next "$next_action" \
    --arg scope "$SELECTED_SCOPE" \
    '. + {($id): {required: $required_json, dependency_status: $dep, host_config_status: $cfg, project_status: $proj, selected_scope: $scope, next_action: $next}}' <<<"$results_json")"
done < <(jq -r '.tools[].id' "$TOOLS_JSON")

jq -n \
  --arg host "$HOST" \
  --arg platform "$PLATFORM" \
  --arg repo_root "$REPO_ROOT" \
  --arg overall_status "$overall_status" \
  --argjson baseline_ready "$baseline_ready" \
  --argjson tools "$results_json" \
  --argjson next_actions "$next_actions_json" \
  '{
    host: $host,
    platform: $platform,
    repo_root: $repo_root,
    overall_status: $overall_status,
    baseline_ready: $baseline_ready,
    tools: $tools,
    next_actions: $next_actions
  }'
