#!/bin/bash
# resolve-workspace-graph-targets.sh - Resolve read-only graph targets for workspace routing.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_RESOLVER="$SCRIPT_DIR/../../spec-mcp-setup/scripts/resolve-project-target.sh"
BUILD_TARGET_COMPILER="$SCRIPT_DIR/compile-gradle-build-targets.js"
REPO_ARG=""
FOLDER_ARG=""
SCAN_DEPTH=3
WRITE_SUMMARY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "resolve-workspace-graph-targets.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --folder)
      FOLDER_ARG="${2:-}"
      [ -n "$FOLDER_ARG" ] || { echo "resolve-workspace-graph-targets.sh: --folder requires a value" >&2; exit 1; }
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

if [ -n "$REPO_ARG" ] && [ -n "$FOLDER_ARG" ]; then
  echo "resolve-workspace-graph-targets.sh: use either --repo or --folder, not both" >&2
  exit 1
fi

hash_stdin() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print "sha256:" $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print "sha256:" $1}'
  else
    python3 -c 'import hashlib,sys; print("sha256:" + hashlib.sha256(sys.stdin.buffer.read()).hexdigest())'
  fi
}

hash_file() {
  local path="$1"
  if [ -f "$path" ]; then
    hash_stdin < "$path"
  else
    printf '%s\n' "missing"
  fi
}

folder_content_fingerprint() {
  local root="$1"
  (
    cd "$root"
    find -P . -type f -print 2>/dev/null |
      sed 's#^\./##' |
      sort |
      while IFS= read -r path; do
        case "$path" in
          .spec-first/*|.gitnexus/*|.code-review-graph/*|.agents/*|.codex/*|.claude/*|node_modules/*|vendor/*) continue ;;
        esac
        printf '%s\n' "$path"
        hash_file "$path"
      done
  ) | hash_stdin
}

write_workspace_summary_atomic() {
  local workspace_root="$1"
  local file_name="$2"
  local spec_dir="$workspace_root/.spec-first"
  local workspace_dir="$spec_dir/workspace"
  local path="$workspace_dir/$file_name"
  local tmp

  if [ -L "$spec_dir" ] || [ -L "$workspace_dir" ]; then
    echo "resolve-workspace-graph-targets.sh: refusing to write workspace summary through symlinked .spec-first/workspace" >&2
    return 1
  fi
  mkdir -p "$workspace_dir" || return 1
  if [ -L "$spec_dir" ] || [ -L "$workspace_dir" ] || [ -L "$path" ]; then
    echo "resolve-workspace-graph-targets.sh: refusing to write workspace summary through symlinked .spec-first/workspace" >&2
    return 1
  fi
  tmp="$(mktemp "${path}.XXXXXX")" || return 1
  if ! cat > "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if [ -L "$spec_dir" ] || [ -L "$workspace_dir" ] || [ -L "$path" ]; then
    rm -f "$tmp"
    echo "resolve-workspace-graph-targets.sh: refusing to write workspace summary through symlinked .spec-first/workspace" >&2
    return 1
  fi
  mv "$tmp" "$path" || { rm -f "$tmp"; return 1; }
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
if [ -n "$FOLDER_ARG" ]; then
  TARGET_ARGS+=(--folder "$FOLDER_ARG")
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
TARGETS_FILE="$(mktemp "${TMPDIR:-/tmp}/workspace-graph-targets.XXXXXX")"
trap 'rm -f "$NULL_JSON" "$RECORDS_JSON" "$TARGETS_FILE"' EXIT
printf 'null\n' > "$NULL_JSON"

TARGETS_JSON="$(jq -c '
  if (.selected_repo_root // null) != null then
    [{
      target_kind:"git-repo",
      repo_label:(.repo_label // ""),
      git_root:.selected_repo_root,
      workspace_relative_path:(if (.repo_label // "") == "" then "." else .repo_label end),
      relationship:"selected_git_repo"
    }]
  elif (.selected_folder_root // null) != null then
    [{
      target_kind:"non-git-folder",
      repo_label:(.folder_label // .repo_label // ""),
      folder_root:.selected_folder_root,
      git_root:null,
      workspace_relative_path:(if (.folder_label // .repo_label // "") == "" then "." else (.folder_label // .repo_label) end),
      relationship:"explicit_non_git_folder"
    }]
  else
    (.candidates // [])
  end
' <<<"$TARGET_JSON")"
printf '%s\n' "$TARGETS_JSON" > "$TARGETS_FILE"
BUILD_TARGET_AWARENESS="$(node "$BUILD_TARGET_COMPILER" --workspace-root "$WORKSPACE_ROOT" --targets "$TARGETS_FILE" --scan-depth "$SCAN_DEPTH")"

parent_repo_local_artifact_advisory() {
  local workspace_root="$1"
  local target_json="$2"
  local ignored_paths="[]"
  local git_marker_status="absent"
  local rel_path

  if jq -e '(.selected_repo_root // null) != null' >/dev/null <<<"$target_json"; then
    jq -n '{status:"not-applicable",advisory:true,reason_code:null,git_marker_status:"selected-git-repo",ignored_paths:[],next_action:null}'
    return 0
  fi

  for rel_path in \
    ".spec-first/config/graph-providers.json" \
    ".spec-first/config/runtime-capabilities.json" \
    ".spec-first/config/provider-artifacts.json" \
    ".spec-first/graph/graph-facts.json" \
    ".spec-first/graph/provider-status.json" \
    ".spec-first/providers/gitnexus/status.json" \
    ".spec-first/providers/code-review-graph/status.json" \
    ".spec-first/impact/bootstrap-impact-capabilities.json"; do
    if [ -e "$workspace_root/$rel_path" ]; then
      ignored_paths="$(jq -c --arg path "$rel_path" '. + [$path]' <<<"$ignored_paths")"
    fi
  done

  if [ -e "$workspace_root/.git" ]; then
    if git -C "$workspace_root" rev-parse --show-toplevel >/dev/null 2>&1; then
      git_marker_status="valid"
    else
      git_marker_status="invalid"
    fi
  fi

  jq -n \
    --arg git_marker_status "$git_marker_status" \
    --argjson ignored_paths "$ignored_paths" '
    {
      status:(if (($ignored_paths | length) > 0 or $git_marker_status == "invalid") then "ignored" else "none" end),
      advisory:true,
      reason_code:(
        if (($ignored_paths | length) > 0 or $git_marker_status == "invalid") then
          "parent-workspace-repo-local-artifacts-ignored"
        else null end
      ),
      git_marker_status:$git_marker_status,
      ignored_paths:$ignored_paths,
      next_action:(
        if (($ignored_paths | length) > 0 or $git_marker_status == "invalid") then
          "Ignore parent repo-local graph/config artifacts in this multi-repo workspace; use child repo artifacts from repos[] and .spec-first/workspace/* summaries."
        else null end
      )
    }'
}

inspect_repo() {
  local item="$1"
  local repo_root repo_label workspace_relative_path target_kind
  local spec_dir config_dir graph_dir impact_dir providers_dir
  local graph_providers runtime_capabilities provider_artifacts graph_facts provider_status impact_capabilities gitnexus_status crg_status
  local graph_providers_arg runtime_capabilities_arg provider_artifacts_arg graph_facts_arg provider_status_arg impact_capabilities_arg gitnexus_status_arg crg_status_arg
  local current_revision current_status current_dirty current_status_hash
  local setup_ready=false

  target_kind="$(jq -r '.target_kind // "git-repo"' <<<"$item")"
  repo_root="$(jq -r '.git_root // .folder_root' <<<"$item")"
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
  crg_status="$providers_dir/code-review-graph/status.json"

  if [ "$target_kind" = "non-git-folder" ]; then
    current_revision=""
    current_status=""
    current_dirty=false
    current_status_hash="$(folder_content_fingerprint "$repo_root")"
  else
    current_revision="$(git -C "$repo_root" rev-parse --verify 'HEAD^{commit}' 2>/dev/null || true)"
    current_status="$(git -C "$repo_root" status --porcelain 2>/dev/null || true)"
    if [ -n "$current_status" ]; then
      current_dirty=true
    else
      current_dirty=false
    fi
    current_status_hash="$(printf '%s' "$current_status" | hash_stdin)"
  fi

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
  crg_status_arg="$(json_file_or_null "$crg_status" "$NULL_JSON")"

  jq -n \
    --arg target_repo "$repo_label" \
    --arg repo_root "$repo_root" \
    --arg target_kind "$target_kind" \
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
    --slurpfile crg_status "$crg_status_arg" \
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
    | (obj($crg_status[0])) as $crg
    | (provider_status_for("gitnexus")) as $gitnexus_provider_status
    | (provider_status_for("code-review-graph")) as $crg_provider_status
    | (($target_kind == "non-git-folder") or (($graph.target_kind // "") == "non-git-folder")) as $is_non_git_folder
    | ($graph.source_revision // null) as $source_revision
    | ($graph.worktree_status_hash // $graph.staleness_hints.worktree_status_hash // null) as $recorded_status_hash
    | ($graph.folder_snapshot.content_fingerprint // $graph.staleness_hints.content_fingerprint // null) as $recorded_content_fingerprint
    | (if $is_non_git_folder then (($recorded_content_fingerprint != null and $recorded_content_fingerprint != $current_worktree_status_hash)) else (($source_revision != null and $source_revision != "" and $current_revision != "" and $source_revision != $current_revision)) end) as $stale
    | (if $is_non_git_folder then false else ((($graph | length) > 0) and (($graph.worktree_dirty // false) == true) and (($recorded_status_hash == null) or ($recorded_status_hash != $current_worktree_status_hash))) end) as $dirty_uncertain
    | (($gitnexus_provider_status.requires_clean_full_refresh // $gitnexus.requires_clean_full_refresh // false) == true) as $gitnexus_requires_clean_full_refresh
    | (((($gitnexus_provider_status.last_indexed_commit // $gitnexus.last_indexed_commit // "") != "") and ($gitnexus_requires_clean_full_refresh | not))) as $gitnexus_prior_query_ready
    | (($gp.providers | type == "object") and ($gp.providers | has("code-review-graph"))) as $crg_projection_present
    | (($crg | length) > 0) as $crg_status_present
    | (($crg_provider_status | length) > 0) as $crg_aggregate_status_present
    | (($crg.repo_snapshot.source_revision // $crg.bootstrap_fingerprint.repo_snapshot.source_revision // $crg.source_revision // $crg.last_indexed_commit // $crg_provider_status.last_indexed_commit // "") == $current_revision and $current_revision != "") as $crg_revision_fresh
    | (((($crg.query_ready // $crg_provider_status.query_ready // false) == true) and (($crg.graph_ready // $crg_provider_status.graph_ready // false) == true) and ($current_worktree_dirty | not) and $crg_revision_fresh)) as $crg_status_fresh
    | ($gp.derived_readiness.workflow_mode // (if $setup_ready then "setup-ready-bootstrap-required" else null end)) as $setup_workflow_mode
    | ($graph.workflow_mode // null) as $graph_workflow_mode
    | (
        if ($is_non_git_folder and ($graph | length) > 0) then
          if $stale then "stale"
          elif $graph_workflow_mode == "primary" then "primary"
          elif $graph_workflow_mode == "degraded-fallback" then "degraded-fallback"
          elif $graph_workflow_mode == "no-source" then "no-source"
          else ($graph_workflow_mode // "unavailable")
          end
        elif ($is_non_git_folder and $setup_ready) then ($setup_workflow_mode // "setup-ready-bootstrap-required")
        elif $current_revision == "" then "unavailable"
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
    | (
        if $current_worktree_dirty then "blocked-dirty-source"
        elif $graph_status == "stale" then "eligible-after-refresh"
        elif $setup_ready then "eligible"
        else "setup-required"
        end
      ) as $refresh_eligibility
    | (
        if ($graph | length) == 0 then "missing"
        elif $stale then "stale-commit"
        elif $current_worktree_dirty then "current-with-dirty-overlay"
        else "current-clean"
        end
      ) as $index_snapshot
    | (
        if $graph_status == "no-source" then "definitions-pointer"
        elif (($gitnexus_provider_status.query_ready // $gitnexus.query_ready // false) == true and ($gitnexus_requires_clean_full_refresh | not) and ($stale | not) and ($current_worktree_dirty | not)) then "fresh-primary"
        elif $gitnexus_prior_query_ready then "stale-advisory"
        elif (($gitnexus_provider_status.graph_ready // $gitnexus.graph_ready // false) == true) then "definitions-pointer"
        else "unavailable"
        end
      ) as $query_usability
    | {
        target_repo:$target_repo,
        repo_label:$target_repo,
        target_kind:$target_kind,
        git_root:(if $is_non_git_folder then null else $repo_root end),
        folder_root:(if $is_non_git_folder then $repo_root else null end),
        workspace_relative_path:$workspace_relative_path,
        status:$graph_status,
        graph_status:$graph_status,
        refresh_eligibility:$refresh_eligibility,
        index_snapshot:$index_snapshot,
        query_usability:$query_usability,
        working_tree_overlay:{
          dirty:$current_worktree_dirty,
          status_hash:$current_worktree_status_hash,
          indexed_status_hash:($recorded_status_hash // null),
          limitation:(if $current_worktree_dirty then "current working tree may differ from indexed GitNexus graph; verify dirty paths with direct source reads" else null end)
        },
        workflow_mode:($graph_workflow_mode // $setup_workflow_mode // $graph_status),
        setup_status:(if $setup_ready then "ready" else "missing-or-unsupported" end),
        setup_ready:$setup_ready,
        git:{
          current_revision:(if $is_non_git_folder or $current_revision == "" then null else $current_revision end),
          current_worktree_dirty:(if $is_non_git_folder then null else $current_worktree_dirty end),
          current_worktree_status_hash:(if $is_non_git_folder then null else $current_worktree_status_hash end)
        },
        folder_snapshot:(if $is_non_git_folder then {content_fingerprint:$current_worktree_status_hash,indexed_content_fingerprint:$recorded_content_fingerprint} else null end),
        non_git_support:(if $is_non_git_folder then {query_context_architecture:true, git_diff_review_impact:false, commit_freshness:false, incremental:false} else null end),
        git_only_limitations:(if $is_non_git_folder then ["no source_revision","no branch","no dirty hash","no last_indexed_commit","no Git diff evidence","no incremental freshness"] else [] end),
        freshness:{
          source_revision:(if $is_non_git_folder then null else $source_revision end),
          source_revision_matches:(if $is_non_git_folder or $source_revision == null or $current_revision == "" then null else ($source_revision == $current_revision) end),
          content_fingerprint:(if $is_non_git_folder then $recorded_content_fingerprint else null end),
          content_fingerprint_matches:(if $is_non_git_folder then ($recorded_content_fingerprint != null and $recorded_content_fingerprint == $current_worktree_status_hash) else null end),
          stale:$stale,
          worktree_dirty_at_bootstrap:(if $is_non_git_folder then null else ($graph.worktree_dirty // null) end),
          worktree_status_hash:(if $is_non_git_folder then null else ($recorded_status_hash // null) end),
          dirty_uncertain:$dirty_uncertain
        },
        providers:{
          gitnexus:{
            configured:($gp.providers.gitnexus.configured // false),
            graph_ready:($gitnexus_provider_status.graph_ready // $gitnexus.graph_ready // false),
            query_ready:($gitnexus_provider_status.query_ready // $gitnexus.query_ready // false),
            status:($gitnexus_provider_status.status // $gitnexus.status // null),
            last_indexed_commit:($gitnexus_provider_status.last_indexed_commit // $gitnexus.last_indexed_commit // null),
            requires_clean_full_refresh:$gitnexus_requires_clean_full_refresh,
            repo:($gp.providers.gitnexus.commands.query_probe[6] // null),
            query_probe_policy:($gp.providers.gitnexus.query_probe_policy // null),
            status_artifact:".spec-first/providers/gitnexus/status.json"
          }
        },
        legacy_provider_advisories:(
          if ($crg_projection_present and $crg_status_fresh) then
            [{
              provider:"code-review-graph",
              status:"legacy-active",
              advisory:true,
              reason_code:"child-on-legacy-spec-first-version",
              projection_path:".spec-first/config/graph-providers.json",
              status_artifact:".spec-first/providers/code-review-graph/status.json",
              next_action:"Upgrade spec-first in this child repo and rerun `$spec-mcp-setup`; then rerun `$spec-graph-bootstrap`."
            }]
          elif ($crg_projection_present or $crg_status_present or $crg_aggregate_status_present) then
            [{
              provider:"code-review-graph",
              status:"ignored-residue",
              advisory:true,
              reason_code:"crg-residue-ignored",
              projection_path:(if $crg_projection_present then ".spec-first/config/graph-providers.json" else null end),
              status_artifact:(if ($crg_status_present or $crg_aggregate_status_present) then ".spec-first/providers/code-review-graph/status.json" else null end),
              next_action:"Ignore historical CRG residue for workspace readiness; rerun `$spec-mcp-setup` in this child repo if graph-providers.json still projects code-review-graph."
            }]
          else [] end
        ),
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
          + (if ($is_non_git_folder and $stale) then ["compiled graph facts content fingerprint differs from current folder contents"] elif $stale then ["compiled graph facts source revision differs from current HEAD"] else [] end)
          + (if $dirty_uncertain then ["compiled graph facts were generated from a dirty worktree without a matching status fingerprint"] else [] end)
          + (if (($graph | length) == 0 and $setup_ready) then ["graph bootstrap has not produced canonical graph facts"] else [] end)
          + (if $is_non_git_folder then ["non-git folder target has no commit, branch, dirty hash, Git diff, last_indexed_commit, or incremental evidence"] elif $current_worktree_dirty then ["current working tree overlay is not guaranteed to be indexed; verify dirty paths directly"] else [] end)
          + (if ((($gitnexus_provider_status.status // null) == "query-not-applicable")) then ["GitNexus process routing is not applicable because no source-derived query target exists"] elif ((($gitnexus_provider_status.graph_ready // false) == true) and (($gitnexus_provider_status.query_ready // false) != true)) then ["GitNexus graph exists but query readiness is unverified; use live MCP probe or bounded direct reads"] else [] end)
          + (if ($crg_projection_present and $crg_status_fresh) then ["child repository is on a legacy spec-first projection that still contains code-review-graph"] elif ($crg_projection_present or $crg_status_present or $crg_aggregate_status_present) then ["historical code-review-graph residue is ignored for workspace readiness"] else [] end)
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

PARENT_REPO_LOCAL_ARTIFACT_ADVISORY="$(parent_repo_local_artifact_advisory "$WORKSPACE_ROOT" "$TARGET_JSON")"

RESULT_JSON="$(jq -n \
  --arg generated_at "$GENERATED_AT" \
  --argjson target "$TARGET_JSON" \
  --argjson parent_repo_local_artifact_advisory "$PARENT_REPO_LOCAL_ARTIFACT_ADVISORY" \
  --argjson build_target_awareness "$BUILD_TARGET_AWARENESS" \
  --slurpfile records "$RECORDS_JSON" \
  '($records[0] // []) as $repos
  | {
      schema_version:"workspace-graph-targets.v1",
      generated_at:$generated_at,
      advisory:true,
      git_root_topology:(
        if ($target.selected_repo_root // null) != null then "single-repo"
        elif ($target.selected_folder_root // null) != null then "non-git-folder"
        elif (($target.mode // "") == "workspace-multi-repo" and ($repos | length) > 1) then "multi-repo-workspace"
        else null
        end
      ),
      mode:($target.mode // "unknown"),
      target_kind:($target.target_kind // ""),
      repo_status:($target.repo_status // "not-git-repo"),
      invocation_cwd:($target.invocation_cwd // null),
      workspace_root:($target.workspace_root // null),
      selection_source:($target.selection_source // ""),
      state_write_allowed:($target.state_write_allowed // false),
      parent_writes_repo_local_artifacts:false,
      parent_repo_local_artifact_advisory:$parent_repo_local_artifact_advisory,
      coverage_inference:($build_target_awareness.coverage_inference // "skipped"),
      coverage_reason_code:($build_target_awareness.reason_code // null),
      non_git_build_modules:($build_target_awareness.non_git_build_modules // []),
      coverage_summary:($build_target_awareness.coverage_summary // {total_build_targets:0,covered_by_git_children:0,uncovered_build_modules:0,coverage_ratio:null}),
      graph_coverage_class:($build_target_awareness.graph_coverage_class // "none"),
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
      query_usability_counts:{
        "fresh-primary":([$repos[] | select(.query_usability == "fresh-primary")] | length),
        "stale-advisory":([$repos[] | select(.query_usability == "stale-advisory")] | length),
        "definitions-pointer":([$repos[] | select(.query_usability == "definitions-pointer")] | length),
        unavailable:([$repos[] | select(.query_usability == "unavailable")] | length)
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
  if ! printf '%s\n' "$RESULT_JSON" | write_workspace_summary_atomic "$WORKSPACE_ROOT" "graph-targets.json"; then
    jq -n --arg workspace_root "$WORKSPACE_ROOT" '{
      schema_version:"workspace-graph-targets.v1",
      advisory:true,
      mode:"blocked",
      repo_status:"not-git-repo",
      workspace_root:$workspace_root,
      parent_writes_repo_local_artifacts:false,
      repos:[],
      counts:{total:0,primary:0,degraded:0,no_source:0,stale:0,dirty_uncertain:0,setup_ready_bootstrap_required:0,unavailable:0},
      query_usability_counts:{"fresh-primary":0,"stale-advisory":0,"definitions-pointer":0,unavailable:0},
      reason_code:"workspace-summary-symlink-escape",
      next_action:"Replace symlinked .spec-first/workspace with a real workspace-local directory and rerun graph target resolution."
    }'
    exit 1
  fi
fi

printf '%s\n' "$RESULT_JSON"
