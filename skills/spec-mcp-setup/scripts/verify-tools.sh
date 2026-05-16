#!/bin/bash
# verify-tools.sh - Write Required Harness Runtime readiness ledger v2.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo '错误：node 是必需依赖，请先安装 Node.js' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ARG=""
ALL_REPOS=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "verify-tools.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --all-repos)
      ALL_REPOS=true
      shift
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

# U2 host pointer self-heal: 检测 setup-owned host pointer drift,
# 在 ledger 中记录 reconciliation advisory event。 detect-only,
# 重写动作由后续构造 ledger 时统一完成。
compute_host_pointer_reconciliation() {
  local current_host current_repo runtime_path previous_host previous_path
  current_host="$(jq -r '.host // empty' <<<"$HOST_INFO_JSON")"
  [ -n "$current_host" ] || { printf 'null'; return 0; }
  current_repo="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$current_repo" ] || current_repo="$PWD"
  runtime_path="$current_repo/.spec-first/config/runtime-capabilities.json"
  [ -f "$runtime_path" ] || { printf 'null'; return 0; }
  previous_host="$(jq -r '.host_ledger_pointer.host // empty' "$runtime_path" 2>/dev/null || true)"
  previous_path="$(jq -r '.host_ledger_pointer.path // empty' "$runtime_path" 2>/dev/null || true)"
  if [ -z "$previous_host" ] || [ "$previous_host" = "$current_host" ]; then
    printf 'null'
    return 0
  fi
  jq -nc \
    --arg from_host "$previous_host" \
    --arg to_host "$current_host" \
    --arg from_marker "$previous_path" \
    --arg to_marker "$MARKER_PATH" \
    --arg reconciled_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    '{
      schema_version: "host-pointer-reconciliation.v1",
      from_host: $from_host,
      to_host: $to_host,
      from_marker_path: $from_marker,
      to_marker_path: $to_marker,
      reconciled_at: $reconciled_at,
      reason: "host marker drift detected between previous setup run and current detect-host"
    }'
}
HOST_POINTER_RECONCILIATION="$(compute_host_pointer_reconciliation)"

write_file_atomic_path() {
  local path="$1"
  local tmp
  mkdir -p "$(dirname "$path")"
  tmp="$(mktemp "${path}.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$path"
}

write_all_repos_verify_summary_and_exit() {
  local target_json="$1"
  local selection_source="${2:-explicit-all-repos}"
  local target_mode workspace_root candidate_count summary_items summary_json

  target_mode="$(jq -r '.mode // empty' <<<"$target_json")"
  workspace_root="$(jq -r '.workspace_root // .invocation_cwd' <<<"$target_json")"

  if [ -n "$REPO_ARG" ]; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-verify-summary.v1",
      overall_status:"action-required",
      workflow_mode:"blocked",
      reason_code:"all-repos-conflicts-with-repo",
      workspace_root:$workspace_root,
      advisory:true,
      next_action:"Use either --all-repos from a parent workspace or --repo <child>, not both."
    }'
    exit 1
  fi

  if [ "$target_mode" = "git-repo" ]; then
    jq -n --arg workspace_root "$workspace_root" '{
      schema_version:"workspace-mcp-verify-summary.v1",
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
      schema_version:"workspace-mcp-verify-summary.v1",
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

  mkdir -p "$MARKER_DIR"
  summary_items="$(mktemp "${TMPDIR:-/tmp}/mcp-verify-all-repos.XXXXXX")"
  jq -n '[]' > "$summary_items"
  while IFS=$'\t' read -r child_label child_path; do
    [ -n "$child_path" ] || continue
    set +e
    child_output="$(bash "$0" --repo "$child_path")"
    child_status=$?
    set -e
    if [ -f "$MARKER_PATH" ] && jq -e . "$MARKER_PATH" >/dev/null 2>&1; then
      child_ledger="$(cat "$MARKER_PATH")"
      child_overall="$(jq -r 'if (.baseline_ready == true) then "ready" else "action-required" end' <<<"$child_ledger")"
      child_reason="$(jq -r '.reason_code // empty' <<<"$child_ledger")"
      child_result="$(jq -n --argjson ledger "$child_ledger" '{
        schema_version:"mcp-verify-child-result.v1",
        baseline_ready:($ledger.baseline_ready // false),
        repo_config_status:($ledger.repo_config_status // "unknown"),
        runtime_capabilities_status:($ledger.runtime_capabilities_status // "unknown"),
        provider_artifacts_status:($ledger.provider_artifacts_status // "unknown"),
        graph_bootstrap_required:($ledger.graph_bootstrap_required // true),
        reason_code:($ledger.reason_code // ""),
        next_actions:($ledger.next_actions // [])
      }')"
    else
      child_overall="action-required"
      child_reason="child-verify-ledger-unavailable"
      child_result="$(jq -n --arg output "$child_output" '{schema_version:"mcp-verify-child-result.v1",baseline_ready:false,reason_code:"child-verify-ledger-unavailable",diagnostic:$output}')"
    fi
    if [ "$child_status" -ne 0 ] && [ "$child_overall" = "ready" ]; then
      child_overall="action-required"
      child_reason="child-verify-failed"
    fi
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
        schema_version:"workspace-mcp-verify-summary.v1",
        generated_at:$generated_at,
        advisory:true,
        workflow_mode:"all-repos",
        selection_source:$selection_source,
        workspace_root:($target.workspace_root // null),
        parent_writes_repo_local_artifacts:false,
        results:$results,
        counts:{
          total:($results | length),
          ready:([$results[] | select(.overall_status == "ready")] | length),
          action_required:([$results[] | select(.overall_status != "ready")] | length)
        },
        overall_status:(
          if ($results | length) == 0 then "action-required"
          elif ([$results[] | select(.overall_status != "ready")] | length) == 0 then "ready"
          elif ([$results[] | select(.overall_status == "ready")] | length) > 0 then "partial"
          else "action-required"
          end
        ),
        reason_code:(
          if ($results | length) == 0 then "workspace-no-git-candidates"
          elif ([$results[] | select(.overall_status != "ready")] | length) == 0 then null
          else "all-repos-partial-or-action-required"
          end
        ),
        next_action:(
          if ([$results[] | select(.overall_status != "ready")] | length) == 0 then
            "All child repos verified Required Harness Runtime readiness."
          else
            "Inspect per-child reason_code and rerun setup/verify for action-required repos."
          end
        )
      }')"
  rm -f "$summary_items"
  printf '%s\n' "$summary_json" | write_file_atomic_path "$workspace_root/.spec-first/workspace/mcp-verify-summary.json"
  printf '%s\n' "$summary_json"
  if [ "$(jq -r '.overall_status' <<<"$summary_json")" = "action-required" ]; then
    exit 1
  fi
  exit 0
}

DETECT_ARGS=()
if [ -n "$REPO_ARG" ] && [ "$ALL_REPOS" != "true" ]; then
  DETECT_ARGS+=(--repo "$REPO_ARG")
fi

if [ "$ALL_REPOS" = "true" ]; then
  set +e
  TARGET_JSON="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format json)"
  TARGET_STATUS=$?
  set -e
  [ -n "$TARGET_JSON" ] || { echo "verify-tools.sh: target resolver returned no JSON output" >&2; exit 1; }
  if [ "$TARGET_STATUS" -ne 0 ]; then
    :
  fi
  write_all_repos_verify_summary_and_exit "$TARGET_JSON" "explicit-all-repos"
fi

if [ -z "$REPO_ARG" ]; then
  set +e
  DEFAULT_TARGET_JSON="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format json)"
  DEFAULT_TARGET_STATUS=$?
  set -e
  [ -n "$DEFAULT_TARGET_JSON" ] || { echo "verify-tools.sh: target resolver returned no JSON output" >&2; exit 1; }
  DEFAULT_TARGET_MODE="$(jq -r '.mode // empty' <<<"$DEFAULT_TARGET_JSON")"
  DEFAULT_TARGET_CANDIDATE_COUNT="$(jq -r '(.candidates // []) | length' <<<"$DEFAULT_TARGET_JSON")"
  if [ "$DEFAULT_TARGET_MODE" != "git-repo" ] && [ "$DEFAULT_TARGET_CANDIDATE_COUNT" -gt 0 ]; then
    if [ "$DEFAULT_TARGET_STATUS" -ne 0 ]; then
      :
    fi
    write_all_repos_verify_summary_and_exit "$DEFAULT_TARGET_JSON" "workspace-default-all-repos"
  fi
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
  --argjson host_pointer_reconciliation "$HOST_POINTER_RECONCILIATION" \
  '
  def host_ready:
    ((.host_config_required == false) and (.host_config_status == "not-required"))
    or (.host_config_status == "ready")
    or (.host_config_status == "fallback-active");
  def tool_ready:
    (.dependency_status == "ready")
    and host_ready
    and ((.project_status == "ready") or (.project_status == "not-applicable") or (.project_status == "workspace-target-required"));
  def helper_ready:
    ((.result // "action-required") == "ready")
    or (((.baseline_blocking // true) == false) and ((.result // "") == "degraded"));

  . as $facts
  | ($helper.helper_tools // {}) as $helper_tools
  | ([($facts.tools // {})[] | tool_ready] | all) as $tools_ready
  | ([($helper_tools // {})[] | helper_ready] | all) as $helper_ready
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
      host_pointer_reconciliation: $host_pointer_reconciliation,
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
      mirror_endpoints: ($helper.mirror_endpoints // null),
      recommended_environment_variables: ($helper.recommended_environment_variables // null),
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
  def bootstrap($value):
    if $value == true then "required" elif $value == false then "done" else "n/a" end;
  def provider_names($ready):
    [(.tools // {} | to_entries[] | select((.value.type // "") == "graph-provider" and ((.value.query_ready // false) == $ready)) | .key)]
    | if length == 0 then "n/a" else join(",") end;
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
  def summary_rows:
    [
      [
        "Harness runtime",
        (if .baseline_ready == true then "ready" else "action-required" end),
        "baseline_ready=\((.baseline_ready // false) | tostring)",
        (if .baseline_ready == true then "" else "fix action-required rows" end)
      ],
      [
        "Graph readiness",
        (if .graph_bootstrap_required == true then "pending" else "ready" end),
        "ready: \(provider_names(true)); pending: \(provider_names(false))",
        (if .graph_bootstrap_required == true then "run spec-graph-bootstrap" else "" end)
      ]
    ];
  def mcp_rows:
    [(.tools // {} | to_entries[] | select((.value.type // "") == "mcp") |
      [display(.key), remark(.key), display(.value.dependency_status), display(.value.host_config_status), display(.value.project_status), display(.value.next_action)])];
  def graph_rows:
    [(.tools // {} | to_entries[] | select((.value.type // "") == "graph-provider") |
      [display(.key), remark(.key), display(.value.dependency_status), display(.value.host_config_status), query(.value.query_ready), bootstrap(.value.bootstrap_required), display(.value.next_action)])];
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
      {title: "Execution result", headers: ["Area", "Status", "Evidence", "Next"], rows: summary_rows},
      {title: "MCP servers", headers: ["Name", "Role", "Dependency", "Host", "Project", "Next"], rows: mcp_rows},
      {title: "Graph providers", headers: ["Name", "Role", "Dependency", "Host", "Query", "Bootstrap", "Next"], rows: graph_rows},
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
    standards_command="/spec:standards"
    ;;
  codex)
    host_display="Codex"
    setup_command='$spec-mcp-setup'
    graph_command='$spec-graph-bootstrap'
    standards_command='$spec-standards'
    ;;
  *)
    host_display="Claude Code / Codex"
    setup_command='/spec:mcp-setup or $spec-mcp-setup'
    graph_command='/spec:graph-bootstrap or $spec-graph-bootstrap'
    standards_command='/spec:standards or $spec-standards'
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
    echo "  1. 现在可以运行 ${graph_command} 完成 deterministic graph readiness 编译；也可以在本会话直接回复“继续完成”，让 agent 调用 bootstrap 脚本。"
    echo "  2. graph readiness 完成后，推荐运行 ${standards_command} 编译项目规范与 glue capability baseline，给后续需求、计划、执行和审查提供可复用上下文。"
    echo "  3. 重启 ${host_display} 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。"
  else
    echo "  1. 推荐下一步运行 ${standards_command} 编译项目规范与 glue capability baseline，给后续需求、计划、执行和审查提供可复用上下文。"
    echo "  2. 如果已经有明确任务，可以在新会话直接描述目标；using-spec-first 会按意图选择合适 workflow。"
    echo "  3. 重启 ${host_display} 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。"
  fi
else
  echo "  1. 先处理表格中的 action-required 行，然后重新运行 ${setup_command}。"
  echo "  2. 全部 ready 后重启 ${host_display} 或新开会话，让新写入的 MCP 配置被宿主加载。"
fi
