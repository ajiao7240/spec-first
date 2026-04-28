#!/bin/bash
# write-provider-config.sh - Project-local graph provider and runtime facts writer.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
[ -f "$TOOLS_JSON" ] || { echo "mcp-tools.json not found: $TOOLS_JSON" >&2; exit 1; }

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
TARGET_STATE_WRITE_ALLOWED="$(jq -r 'if (.target | type == "object") then (.target.state_write_allowed | tostring) else (if .repo_status == "git-repo" then "true" else "false" end) end' "$FACTS_FILE")"
TARGET_REASON_CODE="$(jq -r '.target.reason_code // .reason_code // empty' "$FACTS_FILE")"
TARGET_NEXT_ACTION="$(jq -r '.target.next_action // empty' "$FACTS_FILE")"
REPO_ROOT="$(jq -r '.selected_repo_root // .repo_root' "$FACTS_FILE")"

if [ "$TARGET_STATE_WRITE_ALLOWED" != "true" ] || [ "$REPO_STATUS" != "git-repo" ]; then
  status="${TARGET_REASON_CODE:-skipped-no-git-repo}"
  next="${TARGET_NEXT_ACTION:-Choose a Git repo target and rerun spec-mcp-setup with --repo <child>.}"
  jq -n \
    --arg status "$status" \
    --arg next_action "$next" \
    --slurpfile facts "$FACTS_FILE" '{
      repo_config_status:$status,
      repo_config_path:null,
      runtime_capabilities_status:$status,
      runtime_capabilities_path:null,
      provider_artifacts_status:$status,
      provider_artifacts_path:null,
      graph_bootstrap_required:true,
      reason_code:$status,
      next_action:$next_action,
      workspace_root: ($facts[0].target.workspace_root // $facts[0].workspace_root // null),
      candidates: ($facts[0].target.candidates // $facts[0].target_candidates // [])
    }'
  exit 0
fi

OUT_DIR="$REPO_ROOT/.spec-first/config"
PROVIDER_CONFIG="$OUT_DIR/graph-providers.json"
RUNTIME_CAPABILITIES="$OUT_DIR/runtime-capabilities.json"
PROVIDER_ARTIFACTS="$OUT_DIR/provider-artifacts.json"
mkdir -p "$OUT_DIR"

PROJECTION_TMP="$(mktemp "${PROVIDER_CONFIG}.XXXXXX")"
RUNTIME_TMP="$(mktemp "${RUNTIME_CAPABILITIES}.XXXXXX")"
ARTIFACTS_TMP="$(mktemp "${PROVIDER_ARTIFACTS}.XXXXXX")"
trap 'rm -f "${PROJECTION_TMP:-}" "${RUNTIME_TMP:-}" "${ARTIFACTS_TMP:-}"' EXIT
chmod 600 "$PROJECTION_TMP" "$RUNTIME_TMP" "$ARTIFACTS_TMP"

existing_provider='{}'
if [ -f "$PROVIDER_CONFIG" ] && jq -e --arg repo_root "$REPO_ROOT" '.schema_version == "graph-providers.v1" and .repo_root == $repo_root' "$PROVIDER_CONFIG" >/dev/null 2>&1; then
  existing_provider="$(cat "$PROVIDER_CONFIG")"
fi

existing_runtime='{}'
if [ -f "$RUNTIME_CAPABILITIES" ] && jq -e --arg repo_root "$REPO_ROOT" '.schema_version == "runtime-capabilities.v1" and .repo_root == $repo_root' "$RUNTIME_CAPABILITIES" >/dev/null 2>&1; then
  existing_runtime="$(cat "$RUNTIME_CAPABILITIES")"
fi

generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
gitnexus_package="$(jq -r '.tools[] | select(.id == "gitnexus") | .installation.unix.args[1] // empty' "$TOOLS_JSON")"
[ -n "$gitnexus_package" ] || { echo "GitNexus package spec not found in mcp-tools.json" >&2; exit 1; }

gitnexus_probe_path_excluded() {
  case "$1" in
    .spec-first/*|.gitnexus/*|.code-review-graph/*|.agents/*|.codex/*|.claude/*|.serena/*|node_modules/*|vendor/*) return 0 ;;
    build/*|*/build/*|cache/*|*/cache/*|runtime/*|*/runtime/*|generated/*|*/generated/*|.gradle/*|*/.gradle/*) return 0 ;;
    */src/test/*|*/src/androidTest/*|test/*|tests/*|*/test/*|*/tests/*) return 0 ;;
    *.jar|*.aar|*.apk|*.dex|*.so|*.dylib|*.class|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.zip|*.tar|*.gz|*.tgz|*.mp4|*.mov|*.pdf) return 0 ;;
    *) return 1 ;;
  esac
}

gitnexus_probe_source_path() {
  case "$1" in
    *.kt|*.java|*.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.go|*.rb|*.php|*.rs|*.c|*.cc|*.cpp|*.h|*.hpp|*.swift) return 0 ;;
    *) return 1 ;;
  esac
}

gitnexus_probe_token_from_path() {
  local path="$1"
  local base token
  base="$(basename "$path")"
  token="${base%.*}"
  if [[ "$token" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    printf '%s\n' "$token"
  fi
}

select_gitnexus_query_probe_policy() {
  local repo_root="$1"
  local path token priority
  local selected_path="" selected_token=""
  local -a files=()

  while IFS= read -r path; do
    files+=("$path")
  done < <(git -C "$repo_root" ls-files 2>/dev/null || true)

  for priority in android_named named any_source; do
    for path in "${files[@]}"; do
      gitnexus_probe_path_excluded "$path" && continue
      gitnexus_probe_source_path "$path" || continue
      token="$(gitnexus_probe_token_from_path "$path")"
      [ -n "$token" ] || continue
      case "$priority" in
        android_named)
          case "$path" in
            *.kt|*.java) ;;
            *) continue ;;
          esac
          [[ "$token" =~ (Activity|Fragment|ViewModel|Manager|Repository|Service)$ ]] || continue
          ;;
        named)
          [[ "$token" =~ (Activity|Fragment|ViewModel|Manager|Repository|Service)$ ]] || continue
          ;;
        any_source) ;;
      esac
      selected_path="$path"
      selected_token="$token"
      break 2
    done
  done

  if [ -n "$selected_token" ]; then
    jq -n \
      --arg token "$selected_token" \
      --arg selected_from "$selected_path" \
      '{
        expected_hit:true,
        source:"git-ls-files-code-basename",
        token:$token,
        selected_from:$selected_from
      }'
  else
    jq -n '{
      expected_hit:false,
      source:"fallback-static",
      token:"main src build README package",
      selected_from:null
    }'
  fi
}

gitnexus_query_probe_policy="$(select_gitnexus_query_probe_policy "$REPO_ROOT")"

graph_facts_exists=false
provider_status_exists=false
impact_capabilities_exists=false
[ -f "$REPO_ROOT/.spec-first/graph/graph-facts.json" ] && graph_facts_exists=true
[ -f "$REPO_ROOT/.spec-first/graph/provider-status.json" ] && provider_status_exists=true
[ -f "$REPO_ROOT/.spec-first/impact/bootstrap-impact-capabilities.json" ] && impact_capabilities_exists=true

canonical_graph_facts='{}'
if [ -f "$REPO_ROOT/.spec-first/graph/graph-facts.json" ] && jq -e '.schema_version == "graph-facts.v1"' "$REPO_ROOT/.spec-first/graph/graph-facts.json" >/dev/null 2>&1; then
  canonical_graph_facts="$(cat "$REPO_ROOT/.spec-first/graph/graph-facts.json")"
fi

canonical_provider_status='{}'
if [ -f "$REPO_ROOT/.spec-first/graph/provider-status.json" ] && jq -e '.schema_version == "graph-provider-status.v1"' "$REPO_ROOT/.spec-first/graph/provider-status.json" >/dev/null 2>&1; then
  canonical_provider_status="$(cat "$REPO_ROOT/.spec-first/graph/provider-status.json")"
fi

canonical_impact_capabilities='{}'
if [ -f "$REPO_ROOT/.spec-first/impact/bootstrap-impact-capabilities.json" ] && jq -e '.schema_version == "bootstrap-impact-capabilities.v1"' "$REPO_ROOT/.spec-first/impact/bootstrap-impact-capabilities.json" >/dev/null 2>&1; then
  canonical_impact_capabilities="$(cat "$REPO_ROOT/.spec-first/impact/bootstrap-impact-capabilities.json")"
fi

jq --arg generated_at "$generated_at" \
   --arg repo_name "$(basename "$REPO_ROOT")" \
   --arg repo_root "$REPO_ROOT" \
   --arg gitnexus_package "$gitnexus_package" \
   --argjson gitnexus_query_probe_policy "$gitnexus_query_probe_policy" \
   --argjson graph_facts_exists "$graph_facts_exists" \
   --argjson provider_status_exists "$provider_status_exists" \
   --argjson impact_capabilities_exists "$impact_capabilities_exists" \
   --argjson canonical_graph_facts "$canonical_graph_facts" \
   --argjson canonical_provider_status "$canonical_provider_status" \
   --argjson canonical_impact_capabilities "$canonical_impact_capabilities" \
   --argjson existing "$existing_provider" '
  def canonical_graph_artifacts_exist:
    $graph_facts_exists and $provider_status_exists and $impact_capabilities_exists;

  def canonical_graph_artifacts_current:
    canonical_graph_artifacts_exist
    and ($canonical_graph_facts.schema_version == "graph-facts.v1")
    and ($canonical_provider_status.schema_version == "graph-provider-status.v1")
    and ($canonical_impact_capabilities.schema_version == "bootstrap-impact-capabilities.v1")
    and (($canonical_graph_facts.repo_root // $repo_root) == $repo_root);

  def canonical_provider_status($key):
    [($canonical_provider_status.providers // [])[] | select(.provider == $key)][0] // null;

  def provider_ready($provider):
    ($provider.configured == true)
    and ($provider.enabled_for_bootstrap == true)
    and ($provider.dependency_status == "ready")
    and (($provider.host_config_status == "ready") or ($provider.host_config_status == "fallback-active"));

  def provider_commands($key):
    if $key == "gitnexus" then {
      bootstrap: ["npx", "-y", $gitnexus_package, "analyze", "--force"],
      status: ["npx", "-y", $gitnexus_package, "status"],
      query_probe: ["npx", "-y", $gitnexus_package, "query", $gitnexus_query_probe_policy.token, "--repo", $repo_name]
    }
    elif $key == "code-review-graph" then {
      bootstrap: ["uvx", "--upgrade", "code-review-graph", "build"],
      status: ["uvx", "--upgrade", "code-review-graph", "status"],
      query_probe: ["uvx", "--upgrade", "code-review-graph", "status", "--repo", $repo_root]
    }
    else {} end;

  def provider_artifacts($key):
    {
      raw_dir: ".spec-first/providers/\($key)/raw",
      normalized_dir: ".spec-first/providers/\($key)/normalized",
      status_path: ".spec-first/providers/\($key)/status.json"
    };

  def previous_readiness($key):
    (canonical_provider_status($key)) as $canonical
    | if canonical_graph_artifacts_current and ($canonical != null) then {
      query_ready: ($canonical.query_ready == true),
      bootstrap_required: ($canonical.query_ready != true),
      last_bootstrap_status: ($canonical.status // "unknown"),
      last_bootstrapped_at: ($canonical.generated_at // null),
      provider_status_artifact: ".spec-first/providers/\($key)/status.json"
    } else ($existing.derived_readiness.providers[$key] // {
      query_ready: ($existing.providers[$key].query_ready // false),
      bootstrap_required: (if ($existing.providers[$key] | has("bootstrap_required")) then ($existing.providers[$key].bootstrap_required == true) else true end),
      last_bootstrap_status: ($existing.providers[$key].last_bootstrap_status // "not-bootstrapped"),
      last_bootstrapped_at: ($existing.providers[$key].last_bootstrapped_at // null)
    }) end;

  (
    (.graph_providers // {})
    | to_entries
    | map(
        .key as $key
        | .value as $current
        | provider_ready($current) as $ready
        | previous_readiness($key) as $previous
        | ($ready and canonical_graph_artifacts_current and ($previous.query_ready == true) and ($previous.bootstrap_required == false)) as $preserve_query_ready
        | {
            key: $key,
            value: {
              configured: ($current.configured == true),
              enabled_for_bootstrap: ($current.enabled_for_bootstrap == true),
              required: ($current.required == true),
              role: $current.role,
              mcp_server: $key,
              dependency_status: $current.dependency_status,
              host_config_status: $current.host_config_status,
              capabilities: ($current.capabilities // []),
              commands: provider_commands($key),
              query_probe_policy: (if $key == "gitnexus" then $gitnexus_query_probe_policy else null end),
              artifacts: provider_artifacts($key),
              next_action: (
                if $ready and $preserve_query_ready then ""
                elif $ready then "run spec-graph-bootstrap"
                else "Fix provider setup and rerun spec-mcp-setup."
                end
              )
            },
            readiness: {
              query_ready: $preserve_query_ready,
              bootstrap_required: (if $ready then ($preserve_query_ready | not) else true end),
              last_bootstrap_status: (if $preserve_query_ready then ($previous.last_bootstrap_status // "ready") else "not-bootstrapped" end),
              last_bootstrapped_at: (if $preserve_query_ready then ($previous.last_bootstrapped_at // null) else null end),
              provider_status_artifact: ".spec-first/providers/\($key)/status.json"
            }
          }
      )
  ) as $entries
  | ($entries | map({key:.key,value:.value}) | from_entries) as $providers
  | ($entries | map({key:.key,value:.readiness}) | from_entries) as $readiness
  | {
    schema_version: "graph-providers.v1",
    generated_by: "spec-mcp-setup",
    generated_at: $generated_at,
    repo_root: .repo_root,
    providers: $providers,
    derived_readiness: (
      ([($readiness // {})[] | .bootstrap_required == true] | any) as $bootstrap_required
      | {
      updated_by: "spec-mcp-setup",
      updated_at: (if canonical_graph_artifacts_current then ($canonical_provider_status.generated_at // $canonical_graph_facts.generated_at // null) elif $bootstrap_required then null else ($existing.derived_readiness.updated_at // null) end),
      workflow_mode: (if canonical_graph_artifacts_current then ($canonical_provider_status.workflow_mode // $canonical_graph_facts.workflow_mode // "unknown") elif $bootstrap_required then "setup-ready-bootstrap-required" else ($existing.derived_readiness.workflow_mode // "setup-ready-bootstrap-required") end),
      graph_bootstrap_required: $bootstrap_required,
      provider_status_artifact: ($existing.derived_readiness.provider_status_artifact // ".spec-first/graph/provider-status.json"),
      graph_facts_artifact: ($existing.derived_readiness.graph_facts_artifact // ".spec-first/graph/graph-facts.json"),
      impact_capabilities_artifact: ($existing.derived_readiness.impact_capabilities_artifact // ".spec-first/impact/bootstrap-impact-capabilities.json"),
      providers: $readiness
      }
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
      graph_bootstrap_required: ([($readiness // {})[] | .bootstrap_required == true] | any)
    }
  }
  as $projection
  | $projection
  | .generated_at = (
      if (($existing | has("generated_at")) and (($existing | del(.generated_at)) == ($projection | del(.generated_at)))) then
        $existing.generated_at
      else
        $generated_at
      end
    )' "$FACTS_FILE" > "$PROJECTION_TMP"

jq --arg generated_at "$generated_at" \
   --argjson existing "$existing_runtime" \
   --argjson graph_facts_exists "$graph_facts_exists" \
   --argjson provider_status_exists "$provider_status_exists" \
   --argjson impact_capabilities_exists "$impact_capabilities_exists" \
   --argjson canonical_graph_facts "$canonical_graph_facts" \
   --argjson canonical_provider_status "$canonical_provider_status" \
   --argjson canonical_impact_capabilities "$canonical_impact_capabilities" \
   --slurpfile provider "$PROJECTION_TMP" '
  def helper_ready($helper):
    (($helper.result // "action-required") == "ready");

  def tool_ready($tool):
    ($tool.dependency_status == "ready")
    and (($tool.host_config_status == "ready") or ($tool.host_config_status == "fallback-active"))
    and (($tool.project_status == "ready") or ($tool.project_status == "not-applicable"));

  def canonical_graph_artifacts_exist:
    $graph_facts_exists and $provider_status_exists and $impact_capabilities_exists;

  def canonical_graph_artifacts_current:
    canonical_graph_artifacts_exist
    and ($canonical_graph_facts.schema_version == "graph-facts.v1")
    and ($canonical_provider_status.schema_version == "graph-provider-status.v1")
    and ($canonical_impact_capabilities.schema_version == "bootstrap-impact-capabilities.v1")
    and (($canonical_graph_facts.repo_root // .repo_root) == .repo_root);

  (.tools.serena // {}) as $serena
  | (.helper_tools."ast-grep" // {}) as $ast_grep
  | (tool_ready($serena)) as $serena_ready
  | (helper_ready($ast_grep)) as $ast_grep_ready
  | {
      schema_version: "runtime-capabilities.v1",
      generated_by: "spec-mcp-setup",
      generated_at: $generated_at,
      repo_root: .repo_root,
      host: .host,
      platform: .platform,
      repo_status: .repo_status,
      host_ledger_pointer: (.host_ledger_pointer // {
        host: .host,
        path: null,
        schema_version: "v2"
      }),
      baseline_summary: {
        baseline_ready: (.baseline_ready == true),
        host_runtime_ready: (.host_runtime_ready == true),
        source: "host-readiness-ledger-v2"
      },
      fallback_tools: {
        serena: {
          support_level: (if $serena_ready then "partial" else "none" end),
          readiness_status: (if $serena_ready then "ready" else "action-required" end),
          confidence: (if $serena_ready then "medium" else "low" end),
          capabilities: ["symbol_overview", "symbol_lookup", "references"],
          limitations: (if $serena_ready then [] else ["Serena is not ready."] end)
        },
        "ast-grep": {
          support_level: (if $ast_grep_ready then "partial" else "none" end),
          readiness_status: (if $ast_grep_ready then "ready" else "action-required" end),
          confidence: (if $ast_grep_ready then "medium" else "low" end),
          capabilities: ["structural_search", "safe_rewrite"],
          limitations: (if $ast_grep_ready then [] else ["ast-grep helper is not ready."] end)
        }
      },
      fallback_capabilities: {
        context_selection: {
          support_level: (if $serena_ready or $ast_grep_ready then "partial" else "none" end),
          confidence: (if $serena_ready or $ast_grep_ready then "medium" else "low" end),
          providers: ([if $serena_ready then "serena" else empty end, if $ast_grep_ready then "ast-grep" else empty end]),
          limitations: ["Fallback context is bounded local repo reads, not compiled graph evidence."]
        },
        impact_radius: {
          support_level: (if $ast_grep_ready then "partial" else "none" end),
          confidence: (if $ast_grep_ready then "low" else "unknown" end),
          providers: ([if $ast_grep_ready then "ast-grep" else empty end]),
          limitations: ["Fallback impact is heuristic and does not replace graph-provider impact radius."]
        },
        review_support: {
          support_level: (if $ast_grep_ready then "partial" else "none" end),
          confidence: (if $ast_grep_ready then "low" else "unknown" end),
          providers: ([if $ast_grep_ready then "ast-grep" else empty end]),
          limitations: ["Fallback review support has no canonical graph facts."]
        }
      },
      project_graph_readiness: (
        if canonical_graph_artifacts_current then
          {
            status: ($canonical_graph_facts.workflow_mode // $provider[0].derived_readiness.workflow_mode // "unknown"),
            canonical_graph_facts_artifact: ($provider[0].derived_readiness.graph_facts_artifact // ".spec-first/graph/graph-facts.json"),
            provider_status_artifact: ($provider[0].derived_readiness.provider_status_artifact // ".spec-first/graph/provider-status.json"),
            impact_capabilities_artifact: ($provider[0].derived_readiness.impact_capabilities_artifact // ".spec-first/impact/bootstrap-impact-capabilities.json"),
            graph_bootstrap_required: (($canonical_graph_facts.workflow_mode // $provider[0].derived_readiness.workflow_mode // "unknown") != "primary"),
            updated_by:"spec-mcp-setup",
            updated_at:($canonical_graph_facts.generated_at // $provider[0].derived_readiness.updated_at // null),
            confidence:($canonical_graph_facts.confidence // "medium"),
            limitations: ["Setup projection derived from canonical graph artifacts; canonical readiness truth is under .spec-first/graph/ and .spec-first/impact/."]
          }
        else
          {
            status: "not-bootstrapped",
            canonical_graph_facts_artifact: ".spec-first/graph/graph-facts.json",
            provider_status_artifact: ".spec-first/graph/provider-status.json",
            impact_capabilities_artifact: ".spec-first/impact/bootstrap-impact-capabilities.json",
            graph_bootstrap_required: true,
            confidence: "unknown",
            limitations: ["Run spec-graph-bootstrap to compile project graph readiness."]
          }
        end
      )
    }
  as $runtime
  | $runtime
  | .generated_at = (
      if (($existing | has("generated_at")) and (($existing | del(.generated_at)) == ($runtime | del(.generated_at)))) then
        $existing.generated_at
      else
        $generated_at
      end
    )' "$FACTS_FILE" > "$RUNTIME_TMP"

jq --arg generated_at "$generated_at" --slurpfile provider "$PROJECTION_TMP" '
  {
    schema_version: "provider-artifacts.v1",
    generated_by: "spec-mcp-setup",
    generated_at: $generated_at,
    repo_root: .repo_root,
    providers: (
      $provider[0].providers
      | with_entries({
          key: .key,
          value: {
            raw_dir: ".spec-first/providers/\(.key)/raw",
            normalized_dir: ".spec-first/providers/\(.key)/normalized",
            status_path: ".spec-first/providers/\(.key)/status.json",
            raw_logs: (
              if .key == "gitnexus" then {
                bootstrap: ".spec-first/providers/gitnexus/raw/analyze.log",
                status: ".spec-first/providers/gitnexus/raw/status.log",
                query_probe: ".spec-first/providers/gitnexus/raw/query.log"
              } else {
                bootstrap: ".spec-first/providers/code-review-graph/raw/build.log",
                status: ".spec-first/providers/code-review-graph/raw/status.log",
                query_probe: ".spec-first/providers/code-review-graph/raw/query.log"
              } end
            ),
            normalized_artifacts: (
              if .key == "gitnexus" then {
                architecture_facts: ".spec-first/providers/gitnexus/normalized/architecture-facts.json",
                reuse_candidates: ".spec-first/providers/gitnexus/normalized/reuse-candidates.json"
              } else {
                impact_capabilities: ".spec-first/providers/code-review-graph/normalized/impact-capabilities.json"
              } end
            )
          }
        })
    ),
    canonical: {
      provider_status: ".spec-first/graph/provider-status.json",
      graph_facts: ".spec-first/graph/graph-facts.json",
      bootstrap_report: ".spec-first/graph/bootstrap-report.md",
      impact_capabilities: ".spec-first/impact/bootstrap-impact-capabilities.json"
    }
  }' "$FACTS_FILE" > "$ARTIFACTS_TMP"

write_if_changed() {
  local tmp="$1"
  local out="$2"
  if [ -f "$out" ] && jq -e --slurpfile next "$tmp" 'has("generated_at") and ((. | del(.generated_at)) == ($next[0] | del(.generated_at)))' "$out" >/dev/null 2>&1; then
    rm -f "$tmp"
    echo ready
  else
    mv "$tmp" "$out"
    echo written
  fi
}

provider_status="$(write_if_changed "$PROJECTION_TMP" "$PROVIDER_CONFIG")"
runtime_status="$(write_if_changed "$RUNTIME_TMP" "$RUNTIME_CAPABILITIES")"
artifacts_status="$(write_if_changed "$ARTIFACTS_TMP" "$PROVIDER_ARTIFACTS")"

jq -n \
  --arg provider_path "$PROVIDER_CONFIG" \
  --arg runtime_path "$RUNTIME_CAPABILITIES" \
  --arg artifacts_path "$PROVIDER_ARTIFACTS" \
  --arg provider_status "$provider_status" \
  --arg runtime_status "$runtime_status" \
  --arg artifacts_status "$artifacts_status" \
  --slurpfile projection "$PROVIDER_CONFIG" '{
    repo_config_status:$provider_status,
    repo_config_path:$provider_path,
    runtime_capabilities_status:$runtime_status,
    runtime_capabilities_path:$runtime_path,
    provider_artifacts_status:$artifacts_status,
    provider_artifacts_path:$artifacts_path,
    graph_bootstrap_required: (
      if ($projection[0].derived_readiness | has("graph_bootstrap_required")) then
        ($projection[0].derived_readiness.graph_bootstrap_required == true)
      elif ($projection[0].boundaries | has("graph_bootstrap_required")) then
        ($projection[0].boundaries.graph_bootstrap_required == true)
      else
        true
      end
    ),
    providers: ($projection[0].derived_readiness.providers // {})
  }'
