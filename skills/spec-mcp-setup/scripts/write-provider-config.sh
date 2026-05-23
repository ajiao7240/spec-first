#!/bin/bash
# write-provider-config.sh - Project-local graph provider and runtime facts writer.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

hash_text() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print "sha256:" $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print "sha256:" $1}'
  else
    python3 -c 'import hashlib,sys; print("sha256:" + hashlib.sha256(sys.stdin.buffer.read()).hexdigest())'
  fi
}

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
gitnexus_package_name="$(jq -r '.tools[] | select(.id == "gitnexus") | .package // ""' "$TOOLS_JSON")"
gitnexus_package_version="$(jq -r '.tools[] | select(.id == "gitnexus") | .version // ""' "$TOOLS_JSON")"
[ -n "$gitnexus_package_name" ] && [ -n "$gitnexus_package_version" ] || { echo "GitNexus package/version fields not found in mcp-tools.json" >&2; exit 1; }
gitnexus_package="${gitnexus_package_name}@${gitnexus_package_version}"
gitnexus_native_capabilities="$(jq -c '.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities // {}' "$TOOLS_JSON")"
code_review_graph_package_name="$(jq -r '.tools[] | select(.id == "code-review-graph") | .package // ""' "$TOOLS_JSON")"
code_review_graph_package_version="$(jq -r '.tools[] | select(.id == "code-review-graph") | .version // ""' "$TOOLS_JSON")"
[ -n "$code_review_graph_package_name" ] && [ -n "$code_review_graph_package_version" ] || { echo "code-review-graph package/version fields not found in mcp-tools.json" >&2; exit 1; }
code_review_graph_package="${code_review_graph_package_name}@${code_review_graph_package_version}"
GITNEXUS_QUERY_PROBE_CANDIDATE_LIMIT=5
GITNEXUS_QUERY_PROBE_SOURCE_FILE_LIMIT_BYTES=200000

gitnexus_probe_path_excluded() {
  case "$1" in
    .spec-first/*|.gitnexus/*|.code-review-graph/*|.agents/*|.codex/*|.claude/*|node_modules/*|vendor/*) return 0 ;;
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

gitnexus_probe_token_low_signal() {
  case "$1" in
    app|App|index|Index|main|Main|postinstall|preinstall|install|setup|config|constants|types|utils|helpers|test|spec) return 0 ;;
  esac
  [[ "$1" =~ (Config|Types?|Schema|Constants?)$ || "$1" =~ _(config|types?|schema|constants?)$ ]]
}

gitnexus_probe_token_workflow_signal() {
  [[ "$1" =~ (Activity|Fragment|ViewModel|Manager|Repository|Service|Controller|Handler|Form|Table|Page|Dashboard|Assessment|Questionnaire|Users|Relations|Login)$ ]]
}

gitnexus_probe_token_entry_signal() {
  [[ "$1" =~ ^(MainActivity|Launcher|Launch[A-Za-z0-9_]*|Loading[A-Za-z0-9_]*|Home[A-Za-z0-9_]*|Login[A-Za-z0-9_]*)$ || "$1" =~ (Router|Navigator|Navigation|Redirect)[A-Za-z0-9_]*$ ]]
}

gitnexus_probe_token_weak_proof_signal() {
  [[ "$1" =~ ^(Ad|Ads)$ || "$1" =~ ^(Advertise|Advertisement|Splash|Guide|Intro|Onboarding)[A-Za-z0-9_]* || "$1" =~ (Dialog|Adapter|Bean|DTO|Dto|VO|PO|Entity)$ ]]
}

gitnexus_probe_token_infrastructure_signal() {
  [[ "$1" =~ ^(Health|Ping|Actuator|Status|Info|Error|Metrics)[A-Za-z0-9_]*$ || "$1" =~ (Health|Ping|Actuator|Status|Info|Error|Metrics)(Controller|Endpoint|Handler|Service|Page|View|Route|Router)$ ]]
}

gitnexus_probe_token_display_signal() {
  [[ "$1" =~ (View|Screen|Layout|Modal|Report)$ ]]
}

gitnexus_probe_method_token_signal() {
  [[ "$1" =~ ^(step[A-Za-z0-9_]*|validate[A-Za-z0-9_]*|parse[A-Za-z0-9_]*|booleanResult|isSuccess|success|failure|options|bootstrap|start|submit|resubmit|create[A-Za-z0-9_]*|cancel[A-Za-z0-9_]*|add[A-Za-z0-9_]*|save[A-Za-z0-9_]*|delete[A-Za-z0-9_]*|update[A-Za-z0-9_]*|upload[A-Za-z0-9_]*|download[A-Za-z0-9_]*|handle[A-Za-z0-9_]*|process[A-Za-z0-9_]*)$ ]]
}

gitnexus_probe_method_token_low_signal() {
  [[ "$1" =~ ^(get|set|is|has|toString|equals|hashCode|query[A-Za-z0-9_]*|list[A-Za-z0-9_]*|resolve[A-Za-z0-9_]*|build[A-Za-z0-9_]*|convert[A-Za-z0-9_]*|map[A-Za-z0-9_]*)$ ]]
}

gitnexus_probe_method_tokens_from_path() {
  local repo_root="$1"
  local path="$2"
  local full_path size
  full_path="$repo_root/$path"
  [ -f "$full_path" ] || return 0
  size="$(wc -c < "$full_path" 2>/dev/null || printf '0')"
  [[ "$size" =~ ^[0-9]+$ ]] || size=0
  [ "$size" -le "$GITNEXUS_QUERY_PROBE_SOURCE_FILE_LIMIT_BYTES" ] || return 0

  awk '
    /\(/ {
      line = $0
      sub(/\/\/.*/, "", line)
      if (line ~ /^[[:space:]]*(if|for|while|switch|catch|return|throw|new)[[:space:]]*\(/) next
      if (line ~ /=>/) next
      before = line
      sub(/\(.*/, "", before)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", before)
      n = split(before, parts, /[[:space:]]+/)
      token = parts[n]
      if (token ~ /^[A-Za-z_][A-Za-z0-9_]*$/ && token !~ /^(if|for|while|switch|catch|return|throw|new|class|interface|enum)$/) {
        print token
      }
    }
  ' "$full_path" | while IFS= read -r token; do
    [ -n "$token" ] || continue
    gitnexus_probe_method_token_signal "$token" || continue
    gitnexus_probe_method_token_low_signal "$token" && continue
    printf '%s\n' "$token"
  done | awk '!seen[$0]++'
}

sanitize_gitnexus_repo_name() {
  local value="$1"
  value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  if [[ "$value" =~ ^[A-Za-z0-9._-]+$ ]]; then
    printf '%s\n' "$value"
  fi
}

gitnexus_repo_name_from_remote_url() {
  local remote="$1"
  local name sanitized
  remote="$(printf '%s' "$remote" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -n "$remote" ] || return 0
  remote="${remote%%#*}"
  remote="${remote%%\?*}"
  while [ "${remote%/}" != "$remote" ]; do
    remote="${remote%/}"
  done
  name="${remote##*/}"
  if [ "$name" = "$remote" ]; then
    name="${remote##*:}"
  fi
  name="${name%.git}"
  sanitized="$(sanitize_gitnexus_repo_name "$name")"
  [ -n "$sanitized" ] && printf '%s\n' "$sanitized"
}

git_remote_url_for_repo() {
  local repo_root="$1"
  local remote_url current_branch branch_remote remote_names remote_count first_remote
  command -v git >/dev/null 2>&1 || return 0

  remote_url="$(git -C "$repo_root" config --get remote.origin.url 2>/dev/null || true)"
  if [ -n "$remote_url" ]; then
    printf '%s\n' "$remote_url"
    return 0
  fi

  current_branch="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [ -n "$current_branch" ] && [ "$current_branch" != "HEAD" ]; then
    branch_remote="$(git -C "$repo_root" config --get "branch.$current_branch.remote" 2>/dev/null || true)"
    if [ -n "$branch_remote" ]; then
      remote_url="$(git -C "$repo_root" config --get "remote.$branch_remote.url" 2>/dev/null || true)"
      if [ -n "$remote_url" ]; then
        printf '%s\n' "$remote_url"
        return 0
      fi
    fi
  fi

  remote_names="$(git -C "$repo_root" remote 2>/dev/null || true)"
  remote_count="$(printf '%s\n' "$remote_names" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  if [ "${remote_count:-0}" -eq 1 ]; then
    first_remote="$(printf '%s\n' "$remote_names" | sed '/^[[:space:]]*$/d' | head -n 1)"
    remote_url="$(git -C "$repo_root" config --get "remote.$first_remote.url" 2>/dev/null || true)"
    if [ -n "$remote_url" ]; then
      printf '%s\n' "$remote_url"
    fi
  fi
}

resolve_gitnexus_repo_name() {
  local repo_root="$1"
  local facts_file="$2"
  local explicit remote derived fallback meta_path

  explicit="$(jq -r '[
      .gitnexus_repo_name?,
      .gitnexus.repo_name?,
      .gitnexus.repository_name?,
      .graph_providers.gitnexus.repo_name?,
      .graph_providers.gitnexus.repository_name?,
      .target.gitnexus_repo_name?
    ]
    | map(select(type == "string" and length > 0))
    | .[0] // empty' "$facts_file")"
  explicit="$(sanitize_gitnexus_repo_name "$explicit")"
  if [ -n "$explicit" ]; then
    printf '%s\n' "$explicit"
    return 0
  fi

  meta_path="$repo_root/.gitnexus/meta.json"
  if [ -f "$meta_path" ]; then
    remote="$(jq -r '.remoteUrl // empty' "$meta_path" 2>/dev/null || true)"
    derived="$(gitnexus_repo_name_from_remote_url "$remote")"
    if [ -n "$derived" ]; then
      printf '%s\n' "$derived"
      return 0
    fi
  fi

  remote="$(git_remote_url_for_repo "$repo_root")"
  derived="$(gitnexus_repo_name_from_remote_url "$remote")"
  if [ -n "$derived" ]; then
    printf '%s\n' "$derived"
    return 0
  fi

  fallback="$(sanitize_gitnexus_repo_name "$(basename "$repo_root")")"
  if [ -n "$fallback" ]; then
    printf '%s\n' "$fallback"
  else
    basename "$repo_root"
  fi
}

select_gitnexus_query_probe_policy() {
  local repo_root="$1"
  local path token priority method_token selected_reason policy_source
  local selected_path="" selected_token=""
  local candidates_json="[]"
  local candidate_count=0
  local candidate_limit_reached=false
  local -a files=("__spec_first_empty_file_list_sentinel__")

  while IFS= read -r path; do
    files+=("$path")
  done < <(git -C "$repo_root" ls-files 2>/dev/null || true)

  append_gitnexus_probe_candidate() {
    local candidate_token="$1"
    local candidate_path="$2"
    local candidate_reason="$3"
    if jq -e --arg token "$candidate_token" 'any(.[]; .token == $token)' >/dev/null <<<"$candidates_json"; then
      return 0
    fi
    candidates_json="$(jq -c \
      --arg token "$candidate_token" \
      --arg selected_from "$candidate_path" \
      --arg reason_code "$candidate_reason" \
      '. + [{token:$token, selected_from:$selected_from, reason_code:$reason_code}]' \
      <<<"$candidates_json")"
    candidate_count="$(jq 'length' <<<"$candidates_json")"
    if [ "$candidate_count" -ge "$GITNEXUS_QUERY_PROBE_CANDIDATE_LIMIT" ]; then
      candidate_limit_reached=true
    fi
  }

  for priority in entrypoint_named workflow_method src_method workflow_named src_high_signal high_signal android_named workflow_display_named any_source; do
    for path in "${files[@]}"; do
      [ "$path" != "__spec_first_empty_file_list_sentinel__" ] || continue
      gitnexus_probe_path_excluded "$path" && continue
      gitnexus_probe_source_path "$path" || continue
      token="$(gitnexus_probe_token_from_path "$path")"
      [ -n "$token" ] || continue
      case "$priority" in
        entrypoint_named)
          gitnexus_probe_token_entry_signal "$token" || continue
          ;;
        workflow_method)
          gitnexus_probe_token_workflow_signal "$token" || continue
          gitnexus_probe_token_infrastructure_signal "$token" && continue
          gitnexus_probe_token_weak_proof_signal "$token" && continue
          while IFS= read -r method_token; do
            [ -n "$method_token" ] || continue
            append_gitnexus_probe_candidate "$method_token" "$path" "$priority"
            [ "$candidate_limit_reached" = "true" ] && break
          done < <(gitnexus_probe_method_tokens_from_path "$repo_root" "$path")
          [ "$candidate_limit_reached" = "true" ] && break 2
          continue
          ;;
        src_method)
          case "$path" in
            src/*|*/src/*) ;;
            *) continue ;;
          esac
          gitnexus_probe_token_infrastructure_signal "$token" && continue
          gitnexus_probe_token_weak_proof_signal "$token" && continue
          while IFS= read -r method_token; do
            [ -n "$method_token" ] || continue
            append_gitnexus_probe_candidate "$method_token" "$path" "$priority"
            [ "$candidate_limit_reached" = "true" ] && break
          done < <(gitnexus_probe_method_tokens_from_path "$repo_root" "$path")
          [ "$candidate_limit_reached" = "true" ] && break 2
          continue
          ;;
        android_named)
          case "$path" in
            *.kt|*.java) ;;
            *) continue ;;
          esac
          [[ "$token" =~ (Activity|Fragment|ViewModel|Manager|Repository|Service)$ ]] || continue
          gitnexus_probe_token_low_signal "$token" && continue
          gitnexus_probe_token_infrastructure_signal "$token" && continue
          gitnexus_probe_token_display_signal "$token" && continue
          gitnexus_probe_token_weak_proof_signal "$token" && continue
          ;;
        workflow_named)
          gitnexus_probe_token_workflow_signal "$token" || continue
          gitnexus_probe_token_infrastructure_signal "$token" && continue
          gitnexus_probe_token_weak_proof_signal "$token" && continue
          ;;
        src_high_signal)
          case "$path" in
            src/*|*/src/*) ;;
            *) continue ;;
          esac
          gitnexus_probe_token_low_signal "$token" && continue
          gitnexus_probe_token_infrastructure_signal "$token" && continue
          gitnexus_probe_token_display_signal "$token" && continue
          gitnexus_probe_token_weak_proof_signal "$token" && continue
          ;;
        high_signal)
          gitnexus_probe_token_low_signal "$token" && continue
          gitnexus_probe_token_infrastructure_signal "$token" && continue
          gitnexus_probe_token_display_signal "$token" && continue
          gitnexus_probe_token_weak_proof_signal "$token" && continue
          ;;
        workflow_display_named)
          gitnexus_probe_token_display_signal "$token" || continue
          ;;
        any_source) ;;
      esac
      append_gitnexus_probe_candidate "$token" "$path" "$priority"
      if [ "$candidate_limit_reached" = "true" ]; then
        break 2
      fi
    done
  done

  if [ "$candidate_count" -gt 0 ]; then
    selected_token="$(jq -r '.[0].token' <<<"$candidates_json")"
    selected_path="$(jq -r '.[0].selected_from' <<<"$candidates_json")"
    selected_reason="$(jq -r '.[0].reason_code' <<<"$candidates_json")"
    if [[ "$selected_reason" =~ _method$ ]]; then
      policy_source="git-ls-files-source-symbol"
    else
      policy_source="git-ls-files-code-basename"
    fi
    jq -n \
      --arg token "$selected_token" \
      --arg selected_from "$selected_path" \
      --arg source "$policy_source" \
      --argjson candidates "$candidates_json" \
      '{
        expected_hit:true,
        source:$source,
        token:$token,
        selected_from:$selected_from,
        candidates:$candidates
      }'
  else
    jq -n '{
      expected_hit:false,
      source:"fallback-static",
      token:"main src build README package",
      selected_from:null,
      candidates:[{
        token:"main src build README package",
        selected_from:null,
        reason_code:"fallback-static"
      }]
    }'
  fi
}

gitnexus_query_probe_policy="$(select_gitnexus_query_probe_policy "$REPO_ROOT")"
gitnexus_repo_name="$(resolve_gitnexus_repo_name "$REPO_ROOT" "$FACTS_FILE")"
gitnexus_query_probe_token="$(jq -r '.token // ""' <<<"$gitnexus_query_probe_policy")"
gitnexus_commands_json="$(jq -n -S -c \
  --arg gitnexus_package "$gitnexus_package" \
  --arg query_probe "$gitnexus_query_probe_token" \
  --arg repo_name "$gitnexus_repo_name" '{
    bootstrap: ["npx", "-y", $gitnexus_package, "analyze", "--force", "--skip-agents-md", "--no-stats"],
    incremental: ["npx", "-y", $gitnexus_package, "analyze", "--skip-agents-md", "--no-stats"],
    status: ["npx", "-y", $gitnexus_package, "status"],
    query_probe: ["npx", "-y", $gitnexus_package, "query", $query_probe, "--repo", $repo_name]
  }')"
gitnexus_command_hash="$(printf '%s' "$gitnexus_commands_json" | hash_text)"
code_review_graph_commands_json="$(jq -n -S -c \
  --arg code_review_graph_package "$code_review_graph_package" \
  --arg repo_root "$REPO_ROOT" '{
    bootstrap: ["uvx", $code_review_graph_package, "build"],
    incremental: ["uvx", $code_review_graph_package, "update", "--base", "__SPEC_FIRST_LAST_INDEXED_COMMIT__"],
    status: ["uvx", $code_review_graph_package, "status"],
    query_probe: ["uvx", $code_review_graph_package, "status", "--repo", $repo_root]
  }')"
code_review_graph_command_hash="$(printf '%s' "$code_review_graph_commands_json" | hash_text)"
current_source_revision="$(git -C "$REPO_ROOT" rev-parse --verify 'HEAD^{commit}' 2>/dev/null || true)"
current_worktree_status="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)"
if [ -n "$current_worktree_status" ]; then
  current_worktree_dirty=true
else
  current_worktree_dirty=false
fi
current_worktree_status_hash="$(printf '%s' "$current_worktree_status" | hash_text)"

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
   --arg repo_name "$gitnexus_repo_name" \
   --arg repo_root "$REPO_ROOT" \
   --arg gitnexus_package "$gitnexus_package" \
   --arg code_review_graph_package "$code_review_graph_package" \
   --arg gitnexus_command_hash "$gitnexus_command_hash" \
   --arg code_review_graph_command_hash "$code_review_graph_command_hash" \
   --arg current_source_revision "$current_source_revision" \
   --argjson current_worktree_dirty "$current_worktree_dirty" \
   --arg current_worktree_status_hash "$current_worktree_status_hash" \
   --argjson gitnexus_commands "$gitnexus_commands_json" \
   --argjson code_review_graph_commands "$code_review_graph_commands_json" \
   --argjson gitnexus_query_probe_policy "$gitnexus_query_probe_policy" \
   --argjson gitnexus_native_capabilities "$gitnexus_native_capabilities" \
   --argjson graph_facts_exists "$graph_facts_exists" \
   --argjson provider_status_exists "$provider_status_exists" \
   --argjson impact_capabilities_exists "$impact_capabilities_exists" \
   --argjson canonical_graph_facts "$canonical_graph_facts" \
   --argjson canonical_provider_status "$canonical_provider_status" \
   --argjson canonical_impact_capabilities "$canonical_impact_capabilities" \
   --argjson existing "$existing_provider" '
  def canonical_graph_artifacts_exist:
    $graph_facts_exists and $provider_status_exists and $impact_capabilities_exists;

  def canonical_graph_source_revision_current:
    ($canonical_graph_facts.source_revision // "") as $recorded_source_revision
    | ($current_source_revision != "")
    and ($recorded_source_revision != "")
    and ($recorded_source_revision == $current_source_revision);

  def canonical_graph_worktree_current:
    ($canonical_graph_facts.worktree_status_hash // $canonical_graph_facts.staleness_hints.worktree_status_hash // "") as $recorded_worktree_status_hash
    | ($recorded_worktree_status_hash != "")
    and ($current_worktree_status_hash != "")
    and (($canonical_graph_facts | has("worktree_dirty")) and (($canonical_graph_facts.worktree_dirty == true) == $current_worktree_dirty))
    and ($recorded_worktree_status_hash == $current_worktree_status_hash);

  def canonical_graph_artifacts_current:
    canonical_graph_artifacts_exist
    and ($canonical_graph_facts.schema_version == "graph-facts.v1")
    and ($canonical_provider_status.schema_version == "graph-provider-status.v1")
    and ($canonical_impact_capabilities.schema_version == "bootstrap-impact-capabilities.v1")
    and (($canonical_graph_facts.repo_root // $repo_root) == $repo_root)
    and canonical_graph_source_revision_current
    and canonical_graph_worktree_current;

  def canonical_provider_status($key):
    [($canonical_provider_status.providers // [])[] | select(.provider == $key)][0] // null;

  def current_provider_package($key):
    if $key == "gitnexus" then $gitnexus_package
    elif $key == "code-review-graph" then $code_review_graph_package
    else "" end;

  def current_provider_command_hash($key):
    if $key == "gitnexus" then $gitnexus_command_hash
    elif $key == "code-review-graph" then $code_review_graph_command_hash
    else "" end;

  def canonical_provider_fresh_for_current($key):
    (canonical_provider_status($key).bootstrap_fingerprint.provider // null) as $fingerprint
    | (current_provider_package($key)) as $current_package
    | (current_provider_command_hash($key)) as $current_command_hash
    | ($fingerprint != null)
    and ($current_package != "")
    and ($current_command_hash != "")
    and (($fingerprint.version_policy // "") == "pinned")
    and (($fingerprint.configured_package_spec // "") == $current_package)
    and (($fingerprint.bundled_package_spec // "") == $current_package)
    and (($fingerprint.command_hash // "") == $current_command_hash);

  def provider_ready($provider):
    ($provider.configured == true)
    and ($provider.enabled_for_bootstrap == true)
    and ($provider.dependency_status == "ready")
    and (
      ($provider.host_config_status == "ready")
      or ($provider.host_config_status == "fallback-active")
      or (($provider.host_config_required == false) and ($provider.host_config_status == "not-required"))
    );

  def provider_commands($key):
    if $key == "gitnexus" then $gitnexus_commands
    elif $key == "code-review-graph" then $code_review_graph_commands
    else {} end;

  def provider_host_ready($provider):
    ($provider.host_config_status == "ready")
    or ($provider.host_config_status == "fallback-active")
    or (($provider.host_config_required == false) and ($provider.host_config_status == "not-required"));

  def native_capability_status($provider; $metadata):
    if (($provider | type) != "object") then "unknown"
    elif (($provider.configured // false) != true) then "unavailable"
    elif (($provider.enabled_for_bootstrap // false) != true) then "unavailable"
    elif (($provider.dependency_status // "unknown") == "unknown" or ($provider.dependency_status // "") == "") then "unknown"
    elif (($provider.dependency_status // "") != "ready") then "unavailable"
    elif ((($provider.host_config_status // "unknown") == "unknown") or (($provider.host_config_status // "") == "")) then "unknown"
    elif (provider_host_ready($provider) | not) then "unavailable"
    elif (($metadata.mutation_boundary // "unknown") == "mutation-gated") then "mutation-gated"
    else "available"
    end;

  def native_capability_source_tags($provider; $capability):
    ["registry-baseline", "provider-pin", "setup-projection"]
      + (if (($provider.host_config_status // "") != "") then ["host-config"] else [] end)
      + (if (($provider.dependency_status // "") == "ready") then ["dependency-ready"] else [] end)
      + (if $capability == "workspace_group" then ["workspace-advisory"] else [] end);

  def native_capability_source_provenance($provider; $status):
    if ($status == "available" or $status == "mutation-gated") then "observed-this-run"
    elif (($provider.configured // false) == true and (($provider.dependency_status // "") == "ready") and provider_host_ready($provider)) then "configured-and-detected"
    elif (($provider.configured // false) == true) then "configured-not-verified"
    else "registry-only"
    end;

  def native_capability_limitations($provider; $metadata; $status):
    [
      if $status == "unknown" then
        "setup-inferred unknown: deterministic setup facts are incomplete for this capability."
      else empty end,
      if $status == "unavailable" then
        "setup-inferred unavailable: GitNexus host config or dependency prerequisites are not ready for this capability."
      else empty end,
      if (($metadata.mutation_boundary // "unknown") == "policy-blocked") then
        "setup-inferred availability only; policy-blocked surfaces such as group_sync, group creation, or rename-like mutations must not run in setup or Plan."
      else empty end
    ];

  def gitnexus_native_capability_projection($provider):
    ($gitnexus_native_capabilities // {})
    | to_entries
    | map(
        .key as $capability
        | .value as $metadata
        | native_capability_status($provider; $metadata) as $status
        | {
            key: $capability,
            value: {
              status: $status,
              source_tags: native_capability_source_tags($provider; $capability),
              source_provenance: native_capability_source_provenance($provider; $status),
              native_surfaces: ($metadata.native_surfaces // []),
              mutation_boundary: ($metadata.mutation_boundary // "unknown"),
              limitations: native_capability_limitations($provider; $metadata; $status)
            }
          }
      )
    | from_entries;

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
	        | ($ready and canonical_graph_artifacts_current and canonical_provider_fresh_for_current($key) and ($previous.query_ready == true) and ($previous.bootstrap_required == false)) as $preserve_query_ready
        | {
            key: $key,
            value: ({
              configured: ($current.configured == true),
              enabled_for_bootstrap: ($current.enabled_for_bootstrap == true),
              required: ($current.required == true),
              role: $current.role,
              access_mode: ($current.access_mode // (if ($current.host_config_required == false) then "cli_artifact" else "live_mcp" end)),
              host_config_required: ($current.host_config_required != false),
              mcp_server: (if ($current.host_config_required == false) then null else $key end),
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
            } + (if $key == "gitnexus" then {native_capabilities: gitnexus_native_capability_projection($current)} else {} end)),
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
        workflow_mode: (
          if canonical_graph_artifacts_current then
            ($canonical_provider_status.workflow_mode // $canonical_graph_facts.workflow_mode // "unknown") as $mode
            | if $bootstrap_required and $mode == "primary" then "setup-ready-bootstrap-required" else $mode end
          elif $bootstrap_required then "setup-ready-bootstrap-required"
          else ($existing.derived_readiness.workflow_mode // "setup-ready-bootstrap-required")
          end
        ),
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
   --arg current_source_revision "$current_source_revision" \
   --argjson current_worktree_dirty "$current_worktree_dirty" \
   --arg current_worktree_status_hash "$current_worktree_status_hash" \
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

  def canonical_graph_source_revision_current:
    ($canonical_graph_facts.source_revision // "") as $recorded_source_revision
    | ($current_source_revision != "")
    and ($recorded_source_revision != "")
    and ($recorded_source_revision == $current_source_revision);

  def canonical_graph_worktree_current:
    ($canonical_graph_facts.worktree_status_hash // $canonical_graph_facts.staleness_hints.worktree_status_hash // "") as $recorded_worktree_status_hash
    | ($recorded_worktree_status_hash != "")
    and ($current_worktree_status_hash != "")
    and (($canonical_graph_facts | has("worktree_dirty")) and (($canonical_graph_facts.worktree_dirty == true) == $current_worktree_dirty))
    and ($recorded_worktree_status_hash == $current_worktree_status_hash);

  def canonical_graph_artifacts_current:
    canonical_graph_artifacts_exist
    and ($canonical_graph_facts.schema_version == "graph-facts.v1")
    and ($canonical_provider_status.schema_version == "graph-provider-status.v1")
    and ($canonical_impact_capabilities.schema_version == "bootstrap-impact-capabilities.v1")
    and (($canonical_graph_facts.repo_root // .repo_root) == .repo_root)
    and canonical_graph_source_revision_current
    and canonical_graph_worktree_current;

  (.helper_tools."ast-grep" // {}) as $ast_grep
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
          support_level: (if $ast_grep_ready then "partial" else "none" end),
          confidence: (if $ast_grep_ready then "medium" else "low" end),
          providers: ([if $ast_grep_ready then "ast-grep" else empty end]),
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
          ($canonical_graph_facts.workflow_mode // $provider[0].derived_readiness.workflow_mode // "unknown") as $canonical_mode
          | (($provider[0].derived_readiness.graph_bootstrap_required // false) == true) as $provider_bootstrap_required
          |
          {
            status: (if $provider_bootstrap_required and $canonical_mode == "primary" then "setup-ready-bootstrap-required" else $canonical_mode end),
            canonical_graph_facts_artifact: ($provider[0].derived_readiness.graph_facts_artifact // ".spec-first/graph/graph-facts.json"),
            provider_status_artifact: ($provider[0].derived_readiness.provider_status_artifact // ".spec-first/graph/provider-status.json"),
            impact_capabilities_artifact: ($provider[0].derived_readiness.impact_capabilities_artifact // ".spec-first/impact/bootstrap-impact-capabilities.json"),
            graph_bootstrap_required: ($provider_bootstrap_required or ($canonical_mode != "primary")),
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
      ),
      gitnexus_capability_discovery: {
        schema_version: "gitnexus-capability-discovery.v1",
        generated_by: "spec-mcp-setup",
        provider_projection: ".spec-first/config/graph-providers.json.providers.gitnexus.native_capabilities",
        capability_status_semantics: "setup-inferred availability only; not query-ready graph evidence.",
        graph_readiness_reconciliation: "setup-inferred available or mutation-gated native capability plus project_graph_readiness.status=not-bootstrapped is not a contradiction; durable graph-backed claims still require canonical provider query_ready=true.",
        freshness_policy: "Reuse existing setup-owned provider projection and fingerprint freshness checks; generated_at is audit metadata only.",
        handoff: {
          durable_readiness_refresh: "Run spec-graph-bootstrap when current durable graph readiness is needed.",
          plan_live_evidence: "Use spec-plan lightweight GitNexus live MCP probing when the current session exposes a relevant read-only surface.",
          stale_or_dirty_boundary: "Dirty worktree or stale durable readiness does not automatically make prior or session-local Plan evidence unusable."
        },
        capabilities: ($provider[0].providers.gitnexus.native_capabilities // {})
      }
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
