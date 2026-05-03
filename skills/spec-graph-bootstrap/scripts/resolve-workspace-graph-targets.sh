#!/bin/bash
# resolve-workspace-graph-targets.sh - Resolve read-only graph targets for workspace routing.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_RESOLVER="$SCRIPT_DIR/../../spec-mcp-setup/scripts/resolve-project-target.sh"
REPO_ARG=""
SCAN_DEPTH=3
WRITE_SUMMARY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "resolve-workspace-graph-targets.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --scan-depth)
      SCAN_DEPTH="${2:-}"
      [[ "$SCAN_DEPTH" =~ ^[0-9]+$ ]] || { echo "resolve-workspace-graph-targets.sh: --scan-depth must be an integer" >&2; exit 1; }
      shift 2
      ;;
    --write-summary)
      WRITE_SUMMARY=true
      shift
      ;;
    *)
      echo "resolve-workspace-graph-targets.sh: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

hash_stdin() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print "sha256:" $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print "sha256:" $1}'
  else
    python3 -c 'import hashlib,sys; print("sha256:" + hashlib.sha256(sys.stdin.buffer.read()).hexdigest())'
  fi
}

write_file_atomic() {
  local path="$1"
  local tmp
  tmp="$(mktemp "${path}.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$path"
}

schema_matches() {
  local path="$1"
  local expected="$2"
  [ -f "$path" ] || return 1
  [ "$(jq -r '.schema_version // empty' "$path" 2>/dev/null || true)" = "$expected" ]
}

json_file_or_null() {
  local path="$1"
  local null_file="$2"
  if [ -f "$path" ]; then
    printf '%s\n' "$path"
  else
    printf '%s\n' "$null_file"
  fi
}

TARGET_ARGS=(--scan-depth "$SCAN_DEPTH")
if [ -n "$REPO_ARG" ]; then
  TARGET_ARGS+=(--repo "$REPO_ARG")
fi

set +e
TARGET_JSON="$(bash "$PROJECT_RESOLVER" --format json "${TARGET_ARGS[@]}")"
TARGET_STATUS=$?
set -e
[ -n "$TARGET_JSON" ] || { echo "resolve-workspace-graph-targets.sh: target resolver returned no JSON output" >&2; exit 1; }

WORKSPACE_ROOT="$(jq -r '.workspace_root // .invocation_cwd' <<<"$TARGET_JSON")"
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
NULL_JSON="$(mktemp "${TMPDIR:-/tmp}/workspace-graph-null.XXXXXX")"
RECORDS_JSON="$(mktemp "${TMPDIR:-/tmp}/workspace-graph-records.XXXXXX")"
trap 'rm -f "$NULL_JSON" "$RECORDS_JSON"' EXIT
printf 'null\n' > "$NULL_JSON"

TARGETS_JSON="$(jq -c '
  if (.selected_repo_root // null) != null then
    [{
      repo_label:(.repo_label // ""),
      git_root:.selected_repo_root,
      workspace_relative_path:(if (.repo_label // "") == "" then "." else .repo_label end),
      relationship:"selected_git_repo"
    }]
  else
    (.candidates // [])
  end
' <<<"$TARGET_JSON")"

inspect_repo() {
  local item="$1"
  local repo_root repo_label workspace_relative_path
  local spec_dir config_dir graph_dir impact_dir providers_dir
  local graph_providers runtime_capabilities provider_artifacts graph_facts provider_status impact_capabilities gitnexus_status
  local graph_providers_arg runtime_capabilities_arg provider_artifacts_arg graph_facts_arg provider_status_arg impact_capabilities_arg gitnexus_status_arg
  local current_revision current_status current_dirty current_status_hash
  local setup_ready=false

  repo_root="$(jq -r '.git_root' <<<"$item")"
  repo_label="$(jq -r '.repo_label // ""' <<<"$item")"
  workspace_relative_path="$(jq -r '.workspace_relative_path // .repo_label // ""' <<<"$item")"

  spec_dir="$repo_root/.spec-first"
  config_dir="$spec_dir/config"
  graph_dir="$spec_dir/graph"
  impact_dir="$spec_dir/impact"
  providers_dir="$spec_dir/providers"
  graph_providers="$config_dir/graph-providers.json"
  runtime_capabilities="$config_dir/runtime-capabilities.json"
  provider_artifacts="$config_dir/provider-artifacts.json"
  graph_facts="$graph_dir/graph-facts.json"
  provider_status="$graph_dir/provider-status.json"
  impact_capabilities="$impact_dir/bootstrap-impact-capabilities.json"
  gitnexus_status="$providers_dir/gitnexus/status.json"

  current_revision="$(git -C "$repo_root" rev-parse --verify 'HEAD^{commit}' 2>/dev/null || true)"
  current_status="$(git -C "$repo_root" status --porcelain 2>/dev/null || true)"
  if [ -n "$current_status" ]; then
    current_dirty=true
  else
    current_dirty=false
  fi
  current_status_hash="$(printf '%s' "$current_status" | hash_stdin)"

  if schema_matches "$graph_providers" "graph-providers.v1" \
    && schema_matches "$runtime_capabilities" "runtime-capabilities.v1" \
    && schema_matches "$provider_artifacts" "provider-artifacts.v1"; then
    setup_ready=true
  fi

  graph_providers_arg="$(json_file_or_null "$graph_providers" "$NULL_JSON")"
  runtime_capabilities_arg="$(json_file_or_null "$runtime_capabilities" "$NULL_JSON")"
  provider_artifacts_arg="$(json_file_or_null "$provider_artifacts" "$NULL_JSON")"
  graph_facts_arg="$(json_file_or_null "$graph_facts" "$NULL_JSON")"
  provider_status_arg="$(json_file_or_null "$provider_status" "$NULL_JSON")"
  impact_capabilities_arg="$(json_file_or_null "$impact_capabilities" "$NULL_JSON")"
  gitnexus_status_arg="$(json_file_or_null "$gitnexus_status" "$NULL_JSON")"

  jq -n \
    --arg target_repo "$repo_label" \
    --arg repo_root "$repo_root" \
    --arg workspace_relative_path "$workspace_relative_path" \
    --arg current_revision "$current_revision" \
    --argjson current_worktree_dirty "$current_dirty" \
    --arg current_worktree_status_hash "$current_status_hash" \
    --argjson setup_ready "$setup_ready" \
    --slurpfile graph_providers "$graph_providers_arg" \
    --slurpfile runtime_capabilities "$runtime_capabilities_arg" \
    --slurpfile provider_artifacts "$provider_artifacts_arg" \
    --slurpfile graph_facts "$graph_facts_arg" \
    --slurpfile provider_status "$provider_status_arg" \
    --slurpfile impact_capabilities "$impact_capabilities_arg" \
    --slurpfile gitnexus_status "$gitnexus_status_arg" \
    '
    def obj($x): if ($x // null) == null then {} else $x end;
    def rel($p):
      if ($p // "") == "" then null
      elif ($p | startswith(".spec-first/")) then $p
      else $p end;
    def provider_status_for($id):
      ([((obj($provider_status[0]).providers // [])[]) | select(.provider == $id)][0] // {});

    (obj($graph_providers[0])) as $gp
    | (obj($runtime_capabilities[0])) as $runtime
    | (obj($provider_artifacts[0])) as $artifacts
    | (obj($graph_facts[0])) as $graph
    | (obj($provider_status[0])) as $status
    | (obj($impact_capabilities[0])) as $impact
    | (obj($gitnexus_status[0])) as $gitnexus
    | ($graph.source_revision // null) as $source_revision
    | ($graph.worktree_status_hash // $graph.staleness_hints.worktree_status_hash // null) as $recorded_status_hash
    | (($source_revision != null and $source_revision != "" and $current_revision != "" and $source_revision != $current_revision)) as $stale
    | ((($graph | length) > 0) and (($graph.worktree_dirty // false) == true) and (($recorded_status_hash == null) or ($recorded_status_hash != $current_worktree_status_hash))) as $dirty_uncertain
    | ($gp.derived_readiness.workflow_mode // (if $setup_ready then "setup-ready-bootstrap-required" else null end)) as $setup_workflow_mode
    | ($graph.workflow_mode // null) as $graph_workflow_mode
    | (
        if $current_revision == "" then "unavailable"
        elif ($graph | length) > 0 then
          if $stale then "stale"
          elif $dirty_uncertain then "dirty-uncertain"
          elif $graph_workflow_mode == "primary" then "primary"
          elif $graph_workflow_mode == "degraded-fallback" then "degraded-fallback"
          elif $graph_workflow_mode == "no-source" then "no-source"
          else ($graph_workflow_mode // "unavailable")
          end
        elif $setup_ready then ($setup_workflow_mode // "setup-ready-bootstrap-required")
        else "unavailable"
        end
      ) as $graph_status
    | {
        target_repo:$target_repo,
        repo_label:$target_repo,
        git_root:$repo_root,
        workspace_relative_path:$workspace_relative_path,
        status:$graph_status,
        graph_status:$graph_status,
        workflow_mode:($graph_workflow_mode // $setup_workflow_mode // $graph_status),
        setup_status:(if $setup_ready then "ready" else "missing-or-unsupported" end),
        setup_ready:$setup_ready,
        git:{
          current_revision:(if $current_revision == "" then null else $current_revision end),
          current_worktree_dirty:$current_worktree_dirty,
          current_worktree_status_hash:$current_worktree_status_hash
        },
        freshness:{
          source_revision:$source_revision,
          source_revision_matches:(if $source_revision == null or $current_revision == "" then null else ($source_revision == $current_revision) end),
          stale:$stale,
          worktree_dirty_at_bootstrap:($graph.worktree_dirty // null),
          worktree_status_hash:($recorded_status_hash // null),
          dirty_uncertain:$dirty_uncertain
        },
        providers:{
          gitnexus:{
            configured:($gp.providers.gitnexus.configured // false),
            graph_ready:(provider_status_for("gitnexus").graph_ready // $gitnexus.graph_ready // false),
            query_ready:(provider_status_for("gitnexus").query_ready // $gitnexus.query_ready // false),
            status:(provider_status_for("gitnexus").status // $gitnexus.status // null),
            repo:($gp.providers.gitnexus.commands.query_probe[6] // null),
            query_probe_policy:($gp.providers.gitnexus.query_probe_policy // null),
            status_artifact:".spec-first/providers/gitnexus/status.json"
          },
          "code-review-graph":{
            configured:($gp.providers["code-review-graph"].configured // false),
            graph_ready:(provider_status_for("code-review-graph").graph_ready // false),
            query_ready:(provider_status_for("code-review-graph").query_ready // false),
            status:(provider_status_for("code-review-graph").status // null),
            status_artifact:".spec-first/providers/code-review-graph/status.json"
          }
        },
        capabilities:{
          query_global_graph:($graph.capabilities.query_global_graph // false),
          impact_context:($graph.capabilities.impact_context // false),
          context_selection:($impact.capabilities.context_selection.support_level // null),
          impact_radius:($impact.capabilities.impact_radius.support_level // null),
          review_support:($impact.capabilities.review_support.support_level // null)
        },
        artifacts:{
          graph_providers:(if ($gp | length) > 0 then ".spec-first/config/graph-providers.json" else null end),
          runtime_capabilities:(if ($runtime | length) > 0 then ".spec-first/config/runtime-capabilities.json" else null end),
          provider_artifacts:(if ($artifacts | length) > 0 then ".spec-first/config/provider-artifacts.json" else null end),
          provider_status:(if ($status | length) > 0 then ".spec-first/graph/provider-status.json" else null end),
          graph_facts:(if ($graph | length) > 0 then ".spec-first/graph/graph-facts.json" else null end),
          impact_capabilities:(if ($impact | length) > 0 then ".spec-first/impact/bootstrap-impact-capabilities.json" else null end)
        },
        candidate_tokens:(
          (($gp.providers.gitnexus.query_probe_policy.candidates // [])
            | map({token, selected_from, reason_code}))
          + (if (($gp.providers.gitnexus.query_probe_policy.token // "") != "") then
              [{token:$gp.providers.gitnexus.query_probe_policy.token, selected_from:($gp.providers.gitnexus.query_probe_policy.selected_from // null), reason_code:($gp.providers.gitnexus.query_probe_policy.source // "legacy-token")}]
            else [] end)
          | unique_by(.token)
        ),
        limitations:(
          []
          + (if $setup_ready then [] else ["setup-owned config is missing or unsupported"] end)
          + (if $stale then ["compiled graph facts source revision differs from current HEAD"] else [] end)
          + (if $dirty_uncertain then ["compiled graph facts were generated from a dirty worktree without a matching status fingerprint"] else [] end)
          + (if (($graph | length) == 0 and $setup_ready) then ["graph bootstrap has not produced canonical graph facts"] else [] end)
          + (if ((provider_status_for("gitnexus").status // null) == "query-not-applicable") then ["GitNexus process routing is not applicable because no source-derived query target exists"] elif ((provider_status_for("gitnexus").graph_ready // false) == true and (provider_status_for("gitnexus").query_ready // false) != true) then ["GitNexus graph exists but query readiness is unverified; use live MCP probe or bounded direct reads"] else [] end)
        ),
        next_action:(
          if $graph_status == "primary" then "Use GitNexus-first for bounded read-only evidence."
          elif $graph_status == "degraded-fallback" then "Use available provider facts with disclosed fallback limitations."
          elif $graph_status == "no-source" then "Skip GitNexus process routing for this no-source child repo."
          elif $graph_status == "dirty-uncertain" then "Refresh graph bootstrap or use one bounded live MCP probe/direct read fallback."
          elif $graph_status == "stale" then "Rerun spec-graph-bootstrap for this child repo or use bounded fallback evidence."
          elif $graph_status == "setup-ready-bootstrap-required" then "Run spec-graph-bootstrap for this child repo."
          else "Run spec-mcp-setup for this child repo."
          end
        )
      }
    '
}

{
  jq -c '.[]' <<<"$TARGETS_JSON" | while IFS= read -r target_item; do
    [ -n "$target_item" ] || continue
    inspect_repo "$target_item"
  done
} | jq -s '.' > "$RECORDS_JSON"

RESULT_JSON="$(jq -n \
  --arg generated_at "$GENERATED_AT" \
  --argjson target "$TARGET_JSON" \
  --slurpfile records "$RECORDS_JSON" \
  '($records[0] // []) as $repos
  | {
      schema_version:"workspace-graph-targets.v1",
      generated_at:$generated_at,
      advisory:true,
      mode:($target.mode // "unknown"),
      repo_status:($target.repo_status // "not-git-repo"),
      invocation_cwd:($target.invocation_cwd // null),
      workspace_root:($target.workspace_root // null),
      selection_source:($target.selection_source // ""),
      state_write_allowed:($target.state_write_allowed // false),
      parent_writes_repo_local_artifacts:false,
      repos:$repos,
      counts:{
        total:($repos | length),
        primary:([$repos[] | select(.status == "primary")] | length),
        degraded:([$repos[] | select(.status == "degraded-fallback")] | length),
        no_source:([$repos[] | select(.status == "no-source")] | length),
        stale:([$repos[] | select(.status == "stale")] | length),
        dirty_uncertain:([$repos[] | select(.status == "dirty-uncertain")] | length),
        setup_ready_bootstrap_required:([$repos[] | select(.status == "setup-ready-bootstrap-required")] | length),
        unavailable:([$repos[] | select(.status == "unavailable")] | length)
      },
      reason_code:(
        if ($repos | length) == 0 then ($target.reason_code // "workspace-no-git-candidates")
        elif ([$repos[] | select(.status == "primary")] | length) > 0 then "workspace-graph-targets-ready"
        elif ([$repos[] | select(.status == "no-source")] | length) == ($repos | length) then "workspace-graph-targets-no-source"
        else "workspace-graph-targets-degraded"
        end
      ),
      next_action:(
        if ($repos | length) == 0 then ($target.next_action // "Run from a Git repo or parent workspace with child Git repos.")
        elif ([$repos[] | select(.status == "primary")] | length) > 0 then "Use bounded GitNexus-first routing for read-only questions; require target_repo before writes."
        elif ([$repos[] | select(.status == "no-source")] | length) == ($repos | length) then "No code-bearing graph target is available; skip GitNexus process routing for no-source child repos."
        else "Use per-child next_action values to bootstrap or refresh graph readiness."
        end
      )
    }')"

if [ "$WRITE_SUMMARY" = "true" ]; then
  mkdir -p "$WORKSPACE_ROOT/.spec-first/workspace"
  printf '%s\n' "$RESULT_JSON" | write_file_atomic "$WORKSPACE_ROOT/.spec-first/workspace/graph-targets.json"
fi

printf '%s\n' "$RESULT_JSON"
