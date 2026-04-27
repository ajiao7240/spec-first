#!/bin/bash
# write-provider-config.sh - Project-local graph provider projection writer.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

FACTS_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --facts-file)
      FACTS_FILE="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

[ -n "$FACTS_FILE" ] || { echo "--facts-file required" >&2; exit 1; }
[ -f "$FACTS_FILE" ] || { echo "facts file not found: $FACTS_FILE" >&2; exit 1; }

REPO_STATUS="$(jq -r '.repo_status // "not-git-repo"' "$FACTS_FILE")"
REPO_ROOT="$(jq -r '.repo_root' "$FACTS_FILE")"

if [ "$REPO_STATUS" != "git-repo" ]; then
  jq -n '{repo_config_status:"skipped-no-git-repo",repo_config_path:null}'
  exit 0
fi

OUT_DIR="$REPO_ROOT/.spec-first/config"
OUT_FILE="$OUT_DIR/graph-providers.json"
mkdir -p "$OUT_DIR"

EXISTING_JSON='{}'
if [ -f "$OUT_FILE" ] && jq -e --arg repo_root "$REPO_ROOT" '.schema_version == "graph-providers.v1" and .repo_root == $repo_root' "$OUT_FILE" >/dev/null 2>&1; then
  EXISTING_JSON="$(cat "$OUT_FILE")"
fi

jq --arg generated_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
   --argjson existing "$EXISTING_JSON" '
  def provider_ready($provider):
    ($provider.configured == true)
    and ($provider.dependency_status == "ready")
    and (($provider.host_config_status == "ready") or ($provider.host_config_status == "fallback-active"));

  def provider_projection($entry):
    $entry.key as $key
    | $entry.value as $current
    | ($existing.providers[$key] // {}) as $previous
    | provider_ready($current) as $ready
    | ($ready and ($previous.query_ready == true) and ($previous.bootstrap_required == false)) as $preserve_query_ready
    | {
        configured: ($current.configured == true),
        enabled_for_bootstrap: ($current.enabled_for_bootstrap == true),
        query_ready: $preserve_query_ready,
        bootstrap_required: (if $ready then ($preserve_query_ready | not) else true end),
        required: ($current.required == true),
        role: $current.role,
        mcp_server: $key,
        dependency_status: $current.dependency_status,
        host_config_status: $current.host_config_status,
        capabilities: ($current.capabilities // []),
        next_action: (
          if $ready and $preserve_query_ready then ""
          elif $ready then "run spec-graph-bootstrap"
          else "Fix provider setup and rerun spec-mcp-setup."
          end
        )
      }
      + (if $preserve_query_ready then {
          last_bootstrap_status: ($previous.last_bootstrap_status // "ready"),
          last_bootstrapped_at: ($previous.last_bootstrapped_at // null)
        } else {} end);

  (
    (.graph_providers // {})
    | to_entries
    | map({
        key: .key,
        value: provider_projection(.)
      })
    | from_entries
  ) as $providers
  |
  {
    schema_version: "graph-providers.v1",
    generated_by: "spec-mcp-setup",
    generated_at: $generated_at,
    repo_root: .repo_root,
    providers: $providers,
    selection: {
      global_knowledge: "gitnexus",
      impact_context: "code-review-graph",
      context_selection: "code-review-graph"
    },
    boundaries: {
      setup_only: true,
      does_not_run_gitnexus_analyze: true,
      does_not_run_code_review_graph_build: true,
      graph_bootstrap_required: ([($providers // {})[] | .bootstrap_required == true] | any)
    }
  }' "$FACTS_FILE" > "$OUT_FILE"

jq -n --arg path "$OUT_FILE" --slurpfile projection "$OUT_FILE" '{
  repo_config_status:"written",
  repo_config_path:$path,
  graph_bootstrap_required: (
    if ($projection[0].boundaries | has("graph_bootstrap_required")) then
      ($projection[0].boundaries.graph_bootstrap_required == true)
    else
      true
    end
  ),
  providers: ($projection[0].providers // {})
}'
