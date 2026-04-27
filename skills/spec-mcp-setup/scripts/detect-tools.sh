#!/bin/bash
# detect-tools.sh - Detect MCP tool and graph-provider host readiness facts.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
source "$SCRIPT_DIR/lib-toml.sh"

HOST_INFO_JSON="$(bash "$SCRIPT_DIR/detect-host.sh")"
HOST="$(jq -r '.host' <<<"$HOST_INFO_JSON")"
CONFIG_PATH="$(jq -r '.config_path' <<<"$HOST_INFO_JSON")"
PLATFORM="$(jq -r '.platform' <<<"$HOST_INFO_JSON")"
SELECTED_SCOPE="$(jq -r '.selected_scope // empty' <<<"$HOST_INFO_JSON")"
PRECEDENCE_BLOCKED="$(jq -r '.precedence_blocked' <<<"$HOST_INFO_JSON")"

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
  REPO_STATUS="git-repo"
else
  REPO_ROOT="$(pwd)"
  REPO_STATUS="not-git-repo"
fi

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

      block="$(extract_toml_mcp_section "$CONFIG_PATH" "$detect_key")"
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
        if [ -n "$(extract_toml_mcp_section "$CONFIG_PATH" "$detect_key")" ]; then
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

  echo ready
}

tools_json='{}'
graph_providers_json='{}'
next_actions_json='[]'

append_next_action() {
  local action="$1"
  [ -n "$action" ] || return 0
  next_actions_json="$(jq --arg action "$action" 'if index($action) then . else . + [$action] end' <<<"$next_actions_json")"
}

while IFS= read -r tool_id; do
  required="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .required' "$TOOLS_JSON")"
  category="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .category // "mcp"' "$TOOLS_JSON")"
  provider_role="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .provider_role // empty' "$TOOLS_JSON")"
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
  configured=false
  if [ "$cfg_status" = "ready" ] || [ "$cfg_status" = "fallback-active" ]; then
    configured=true
  fi

  next_action=""
  if [ "$dep_status" != "ready" ]; then
    next_action="install dependency"
  elif [ "$cfg_status" = "action-required" ]; then
    next_action="configure host"
  elif [ "$cfg_status" = "precedence-blocked" ]; then
    next_action="review higher-precedence host config"
  elif [ "$proj_status" = "pending" ]; then
    next_action="bootstrap project"
  elif [ "$category" = "graph-provider" ] && [ "$configured" = "true" ]; then
    next_action="run spec-graph-bootstrap"
  fi

  append_next_action "$next_action"

  tools_json="$(jq \
    --arg id "$tool_id" \
    --argjson required_json "$required" \
    --arg type "$category" \
    --arg dep "$dep_status" \
    --arg cfg "$cfg_status" \
    --arg proj "$proj_status" \
    --arg scope "$SELECTED_SCOPE" \
    --arg next "$next_action" \
    --argjson configured "$configured" \
    '.
      + {($id): {
        required: $required_json,
        type: $type,
        dependency_status: $dep,
        host_config_status: $cfg,
        project_status: $proj,
        selected_scope: $scope,
        next_action: $next
      }}
      | if $type == "graph-provider" then
        .[$id] += {
          configured: $configured,
          enabled_for_bootstrap: $configured,
          query_ready: false,
          bootstrap_required: true
        }
      else . end' <<<"$tools_json")"

  if [ "$category" = "graph-provider" ]; then
    capabilities="$(jq -c --arg id "$tool_id" '.tools[] | select(.id == $id) | .provider_config.capabilities // []' "$TOOLS_JSON")"
    graph_providers_json="$(jq \
      --arg id "$tool_id" \
      --arg role "$provider_role" \
      --argjson required_json "$required" \
      --arg dep "$dep_status" \
      --arg cfg "$cfg_status" \
      --arg next "$next_action" \
      --argjson configured "$configured" \
      --argjson capabilities "$capabilities" \
      '. + {($id): {
        required: $required_json,
        role: $role,
        dependency_status: $dep,
        host_config_status: $cfg,
        configured: $configured,
        enabled_for_bootstrap: $configured,
        query_ready: false,
        bootstrap_required: true,
        capabilities: $capabilities,
        next_action: $next
      }}' <<<"$graph_providers_json")"
  fi
done < <(jq -r '.tools[].id' "$TOOLS_JSON")

jq -n \
  --arg host "$HOST" \
  --arg platform "$PLATFORM" \
  --arg repo_root "$REPO_ROOT" \
  --arg repo_status "$REPO_STATUS" \
  --argjson tools "$tools_json" \
  --argjson graph_providers "$graph_providers_json" \
  --argjson next_actions "$next_actions_json" \
  '{
    schema_version: "tool-facts.v2",
    host: $host,
    platform: $platform,
    repo_root: $repo_root,
    repo_status: $repo_status,
    tools: $tools,
    graph_providers: $graph_providers,
    next_actions: $next_actions
  }'
