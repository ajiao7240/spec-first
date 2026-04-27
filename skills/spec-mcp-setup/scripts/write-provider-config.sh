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

jq --arg generated_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '
  {
    schema_version: "graph-providers.v1",
    generated_by: "spec-mcp-setup",
    generated_at: $generated_at,
    repo_root: .repo_root,
    providers: (
      (.graph_providers // {})
      | to_entries
      | map({
          key: .key,
          value: {
            configured: (.value.configured == true),
            enabled_for_bootstrap: (.value.enabled_for_bootstrap == true),
            query_ready: false,
            bootstrap_required: true,
            required: (.value.required == true),
            role: .value.role,
            mcp_server: .key,
            dependency_status: .value.dependency_status,
            host_config_status: .value.host_config_status,
            capabilities: (.value.capabilities // []),
            next_action: (
              if (.value.configured == true and (.value.dependency_status == "ready") and (.value.host_config_status == "ready" or .value.host_config_status == "fallback-active"))
              then "run spec-graph-bootstrap"
              else "Fix provider setup and rerun spec-mcp-setup."
              end
            )
          }
        })
      | from_entries
    ),
    selection: {
      global_knowledge: "gitnexus",
      impact_context: "code-review-graph",
      context_selection: "code-review-graph"
    },
    boundaries: {
      setup_only: true,
      does_not_run_gitnexus_analyze: true,
      does_not_run_code_review_graph_build: true,
      graph_bootstrap_required: true
    }
  }' "$FACTS_FILE" > "$OUT_FILE"

jq -n --arg path "$OUT_FILE" '{repo_config_status:"written",repo_config_path:$path}'
