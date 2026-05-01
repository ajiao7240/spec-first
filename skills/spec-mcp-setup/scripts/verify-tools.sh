#!/bin/bash
# verify-tools.sh - Write Required Harness Runtime readiness ledger v2.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo '错误：node 是必需依赖，请先安装 Node.js' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "verify-tools.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    *)
      echo "verify-tools.sh: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

HOST_INFO_JSON="$(bash "$SCRIPT_DIR/detect-host.sh")"
MARKER_PATH="$(jq -r '.marker_path' <<<"$HOST_INFO_JSON")"
MARKER_DIR="$(dirname "$MARKER_PATH")"
DETECT_ARGS=()
if [ -n "$REPO_ARG" ]; then
  DETECT_ARGS+=(--repo "$REPO_ARG")
fi
FACTS_JSON="$(bash "$SCRIPT_DIR/detect-tools.sh" ${DETECT_ARGS[@]+"${DETECT_ARGS[@]}"})"
HELPER_JSON="$(bash "$SCRIPT_DIR/install-helpers.sh" --verify-only)"

mkdir -p "$MARKER_DIR"
[ -w "$MARKER_DIR" ] || { echo "verify-tools.sh: 无法写入 ${MARKER_DIR}" >&2; exit 1; }

combined_tmp="$(mktemp "${MARKER_DIR}/readiness-ledger-combined.XXXXXX")"
final_tmp="$(mktemp "${MARKER_DIR}/readiness-ledger.XXXXXX")"
trap 'rm -f "$combined_tmp" "$final_tmp"' EXIT
chmod 600 "$combined_tmp" "$final_tmp"

jq --arg completed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg marker_path "$MARKER_PATH" \
  --argjson helper "$HELPER_JSON" \
  '
  def host_ready:
    ((.host_config_required == false) and (.host_config_status == "not-required"))
    or (.host_config_status == "ready")
    or (.host_config_status == "fallback-active");
  def tool_ready:
    (.dependency_status == "ready")
    and host_ready
    and ((.project_status == "ready") or (.project_status == "not-applicable") or (.project_status == "workspace-target-required"));

  . as $facts
  | ($helper.helper_tools // {}) as $helper_tools
  | ([($facts.tools // {})[] | tool_ready] | all) as $tools_ready
  | ([($helper_tools // {})[] | (.result // "action-required") == "ready"] | all) as $helper_ready
  | ($tools_ready and $helper_ready) as $baseline_ready
  | {
      schema_version: "v2",
      host: $facts.host,
      platform: $facts.platform,
      repo_root: $facts.repo_root,
      repo_status: $facts.repo_status,
      target: ($facts.target // null),
      target_mode: ($facts.target_mode // ""),
      workspace_root: ($facts.workspace_root // null),
      selected_repo_root: ($facts.selected_repo_root // null),
      target_candidate_count: ($facts.target_candidate_count // 0),
      target_candidates: ($facts.target_candidates // []),
      reason_code: ($facts.reason_code // ""),
      host_ledger_pointer: {
        host: $facts.host,
        path: $marker_path,
        schema_version: "v2"
      },
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
      next_actions: (
        (($facts.next_actions // []) + [
          ($helper_tools // {})[] | .next_action // ""
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
   | .next_actions = (
       ((.next_actions // []) | map(select(. != "run spec-graph-bootstrap" and . != "enter a git repo and run spec-graph-bootstrap")))
       + (if ((.target.state_write_allowed // false) != true and ((.target.next_action // "") != "")) then
            [.target.next_action]
          elif .repo_status == "not-git-repo" then
            ["choose a child repo and rerun with --repo <child>"]
          elif (.baseline_ready == true and .graph_bootstrap_required == true) then
            ["run spec-graph-bootstrap"]
          else
            []
          end)
       | map(select(. != ""))
       | unique
     )' "$combined_tmp" > "$final_tmp"

mv "$final_tmp" "$MARKER_PATH"

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
  def remark($key):
    if $key == "serena" then "符号级精确编辑和项目索引"
    elif $key == "sequential-thinking" then "反思式推理辅助"
    elif $key == "context7" then "当前框架和库文档"
    elif $key == "gitnexus" then "全局代码知识图谱与影响分析"
    elif $key == "code-review-graph" then "变更影响半径与 review 上下文"
    elif $key == "agent-browser" then "浏览器自动化辅助"
    elif $key == "gh" then "GitHub issue 和 PR 操作"
    elif $key == "jq" then "JSON 解析与转换"
    elif $key == "vhs" then "终端演示录制"
    elif $key == "silicon" then "代码截图渲染"
    elif $key == "ffmpeg" then "媒体转换与视频合成"
    elif $key == "ast-grep" then "结构化代码搜索和重写"
    elif $key == "ast-grep-skill" then "ast-grep 使用指引"
    else "工具" end;
  def mcp_rows:
    [(.tools // {} | to_entries[] | select((.value.type // "") == "mcp") |
      [display(.key), remark(.key), display(.value.dependency_status), display(.value.host_config_status), display(.value.project_status), display(.value.next_action)])];
  def graph_rows:
    [(.tools // {} | to_entries[] | select((.value.type // "") == "graph-provider") |
      [display(.key), remark(.key), display(.value.dependency_status), display(.value.host_config_status), query(.value.query_ready), display(.value.next_action)])];
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
      {title: "MCP servers", headers: ["Name", "Role", "Dependency", "Host", "Project", "Next"], rows: mcp_rows},
      {title: "Graph providers", headers: ["Name", "Role", "Dependency", "Host", "Query", "Next"], rows: graph_rows},
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
    echo "  1. 建议先重启 ${host_display} 或新开会话，让新写入的 MCP 配置被宿主加载。"
    echo "  2. 然后运行 ${graph_command}；如果当前 agent 判断只需调用确定性 bootstrap 脚本，也可以在本会话直接回复“继续完成”，但下游 workflow 前仍要重启或新开会话。"
  else
    echo "  1. 重启 ${host_display} 或新开会话后，再依赖新的 MCP 配置运行下游 workflow。"
  fi
else
  echo "  1. 先处理表格中的 action-required 行，然后重新运行 ${setup_command}。"
  echo "  2. 全部 ready 后重启 ${host_display} 或新开会话，让新写入的 MCP 配置被宿主加载。"
fi
