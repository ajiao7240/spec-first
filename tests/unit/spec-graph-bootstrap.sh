#!/bin/bash
# spec-graph-bootstrap compiler behavior tests

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GRAPH_BOOTSTRAP_SKILL="$REPO_ROOT/skills/spec-graph-bootstrap/SKILL.md"
BOOTSTRAP_SCRIPT="$REPO_ROOT/skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh"
BOOTSTRAP_PS1="$REPO_ROOT/skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1"
WORKSPACE_TARGET_RESOLVER="$REPO_ROOT/skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh"
MCP_WRITE_PROVIDER_CONFIG="$REPO_ROOT/skills/spec-mcp-setup/scripts/write-provider-config.sh"
TOOLS_JSON="$REPO_ROOT/skills/spec-mcp-setup/mcp-tools.json"
GITNEXUS_PACKAGE="$(jq -r '.tools[] | select(.id == "gitnexus") | (.package // "") + "@" + (.version // "")' "$TOOLS_JSON")"
GITNEXUS_QUERY_PROBE="TradeLoginActivity"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

assert() {
  local message="$1"
  shift
  if ! "$@"; then
    echo "FAIL: $message" >&2
    exit 1
  fi
}

assert_eq() {
  local message="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" != "$actual" ]; then
    echo "FAIL: $message" >&2
    echo "expected: $expected" >&2
    echo "actual:   $actual" >&2
    exit 1
  fi
}

assert_contains() {
  local message="$1"
  local needle="$2"
  local haystack="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "FAIL: $message" >&2
    echo "missing: $needle" >&2
    exit 1
  fi
}

assert_not_contains() {
  local message="$1"
  local needle="$2"
  local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "FAIL: $message" >&2
    echo "unexpected: $needle" >&2
    exit 1
  fi
}

bootstrap_script_source="$(cat "$BOOTSTRAP_SCRIPT")"
assert_contains "graph-bootstrap hashes canonical JSON without newline" 'printf '\''%s'\'' "$canonical" | hash_text' "$bootstrap_script_source"
assert_not_contains "graph-bootstrap json file hash does not pipe jq newline into hash" 'jq -S -c . "$path" | hash_text' "$bootstrap_script_source"
assert_not_contains "graph-bootstrap provider command hash does not pipe jq newline into hash" "'.providers[\$provider].commands // {}' \"\$PROVIDER_CONFIG\" | hash_text" "$bootstrap_script_source"

make_fake_bin() {
  local bin_dir="$1"
  local log_file="$2"
  mkdir -p "$bin_dir"
  ln -s "$(command -v jq)" "$bin_dir/jq"
cat > "$bin_dir/npx" <<SH
#!/bin/bash
echo "npx \$*" >> "$log_file"
if [[ "\${FAIL_GITNEXUS_NETWORK:-}" = "1" && " \$* " == *" gitnexus@"*" analyze "* ]]; then
  echo "npm error code ENOTFOUND" >&2
  echo "npm error syscall getaddrinfo" >&2
  echo "npm error request to https://registry.npmmirror.com/gitnexus failed, reason: getaddrinfo ENOTFOUND registry.npmmirror.com" >&2
  exit 1
fi
if [[ "\${FAIL_GITNEXUS_ANALYZE_SIGSEGV:-}" = "1" && " \$* " == *" gitnexus@"*" analyze "* ]]; then
  echo "Segmentation fault: 11" >&2
  exit 139
fi
if [[ "\${FAIL_GITNEXUS_LBUG:-}" = "1" && " \$* " == *" gitnexus@"*" analyze "* ]]; then
  echo "Cannot open file D:\\codes\\workspace\\child\\.gitnexus\\lbug - Error 3" >&2
  exit 1
fi
if [[ "\${MUTATE_AGENTS_DURING_GITNEXUS_STATUS:-}" = "1" && " \$* " == *" gitnexus@"*" status"* ]]; then
  repo_root="\$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  printf 'external actor update\n' >> "\$repo_root/AGENTS.md"
fi
if [[ "\${FAIL_GITNEXUS_INCREMENTAL:-}" = "1" && " \$* " == *" gitnexus@"*" analyze "* && " \$* " != *" --force "* ]]; then
  echo "incremental analyze failed" >&2
  exit 44
fi
if [[ "\${HANG_GITNEXUS_ANALYZE:-}" = "1" && " \$* " == *" gitnexus@"*" analyze "* ]]; then
  sleep 5
  exit 0
fi
if [[ "\${FAIL_GITNEXUS_QUERY:-}" = "1" && " \$* " == *" gitnexus@"*" query "* ]]; then
  echo "query failed" >&2
  exit 42
fi
if [[ " \$* " == *" gitnexus@"*" impact "* ]]; then
  if [[ "\${GITNEXUS_IMPACT_NO_TESTS:-}" = "1" ]]; then
    printf '{"byDepth":{"1":[{"filePath":"src/review-pre-facts.js"}]},"affected_processes":[]}\n'
    exit 0
  fi
  printf '{"byDepth":{"1":[{"filePath":"src/review-pre-facts.js"},{"filePath":"tests/unit/review-pre-facts-helper.test.js"}]},"affected_processes":[]}\n'
  exit 0
fi
if [[ " \$* " == *" gitnexus@"*" query "* ]]; then
  query_token=""
  previous_arg=""
  for current_arg in "\$@"; do
    if [[ "\$previous_arg" = "query" ]]; then
      query_token="\$current_arg"
      break
    fi
    previous_arg="\$current_arg"
  done
  if [[ "\${GITNEXUS_QUERY_FTS_EMPTY:-}" = "1" ]]; then
    echo "FTS index ensure failed: Cannot execute write operations in a read-only database" >&2
    printf '{"processes":[],"process_symbols":[],"definitions":[]}\n'
    exit 0
  fi
	  if [[ "\${GITNEXUS_QUERY_EMPTY:-}" = "1" ]]; then
	    printf '{"processes":[],"process_symbols":[],"definitions":[]}\n'
	    exit 0
	  fi
	  if [[ "\${GITNEXUS_QUERY_SECOND_CANDIDATE_SUCCEEDS:-}" = "1" && "\$query_token" != "$GITNEXUS_QUERY_PROBE" ]]; then
	    printf '{"processes":[],"process_symbols":[],"definitions":[]}\n'
	    exit 0
	  fi
	  if [[ "\${GITNEXUS_QUERY_NO_SOURCE_TOKEN_EMPTY:-}" = "1" && "\$query_token" = "main src build README package" ]]; then
	    printf '{"processes":[],"process_symbols":[],"definitions":[]}\n'
	    exit 0
	  fi
	  if [[ "\${GITNEXUS_QUERY_NO_SOURCE_TOKEN_DEFINITIONS_ONLY:-}" = "1" && "\$query_token" = "main src build README package" ]]; then
	    printf '{"processes":[],"process_symbols":[],"definitions":[{"name":"%s"}]}\n' "\$query_token"
	    exit 0
	  fi
	  if [[ "\${GITNEXUS_QUERY_DEFINITIONS_ONLY:-}" = "1" ]]; then
	    printf '{"processes":[],"process_symbols":[],"definitions":[{"name":"%s"}]}\n' "\$query_token"
	    exit 0
  fi
  printf '{"processes":[{"name":"probe","token":"%s"}],"process_symbols":[],"definitions":[]}\n' "\$query_token"
fi
exit 0
SH
cat > "$bin_dir/uvx" <<SH
#!/bin/bash
echo "uvx \$*" >> "$log_file"
exit 0
SH
  cat > "$bin_dir/spec-first" <<SH
#!/bin/bash
echo "global spec-first \$*" >> "$log_file"
if [[ " \$* " == *" gitnexus-instruction normalize "* ]]; then
  exit 88
fi
exit 0
SH
  chmod +x "$bin_dir/npx" "$bin_dir/uvx" "$bin_dir/spec-first"
}

make_repo() {
  local repo_dir="$1"
  mkdir -p "$repo_dir"
  git -C "$repo_dir" init -q
  git -C "$repo_dir" config user.name "Spec First Test"
  git -C "$repo_dir" config user.email "spec-first-test@example.invalid"
  git -C "$repo_dir" config core.hooksPath /dev/null
  printf '# fixture\n' > "$repo_dir/README.md"
  printf '.spec-first/\n.gitnexus/\n.code-review-graph/\n' > "$repo_dir/.gitignore"
  git -C "$repo_dir" add README.md .gitignore
  git -C "$repo_dir" commit -q -m "Initial fixture commit"
  mkdir -p "$repo_dir/.spec-first/config"
}

commit_repo_changes() {
  local repo_dir="$1"
  local message="$2"
  git -C "$repo_dir" add -A
  if ! git -C "$repo_dir" diff --cached --quiet; then
    git -C "$repo_dir" commit -q -m "$message"
  fi
}

make_unborn_repo() {
  local repo_dir="$1"
  mkdir -p "$repo_dir"
  git -C "$repo_dir" init -q
  mkdir -p "$repo_dir/.spec-first/config"
}

write_fixture_config() {
  local repo_dir="$1"
  local repo_root
  repo_root="$(cd "$repo_dir" && pwd -P)"
  local ledger_path="$2"
  local baseline="${3:-true}"
  mkdir -p "$(dirname "$ledger_path")" "$repo_dir/.spec-first/config"
  cat > "$ledger_path" <<JSON
{
  "schema_version": "v2",
  "host": "codex",
  "baseline_ready": $baseline,
  "host_runtime_ready": $baseline
}
JSON
  cat > "$repo_dir/.spec-first/config/graph-providers.json" <<JSON
{
  "schema_version": "graph-providers.v1",
  "repo_root": "$repo_root",
  "providers": {
    "gitnexus": {
      "configured": true,
      "enabled_for_bootstrap": true,
      "dependency_status": "ready",
      "host_config_status": "ready",
      "commands": {
        "bootstrap": ["npx", "-y", "$GITNEXUS_PACKAGE", "analyze", "--force", "--skip-agents-md", "--no-stats"],
        "incremental": ["npx", "-y", "$GITNEXUS_PACKAGE", "analyze", "--skip-agents-md", "--no-stats"],
        "status": ["npx", "-y", "$GITNEXUS_PACKAGE", "status"],
        "query_probe": ["npx", "-y", "$GITNEXUS_PACKAGE", "query", "$GITNEXUS_QUERY_PROBE", "--repo", "$(basename "$repo_root")"],
        "impact_probe": ["npx", "-y", "$GITNEXUS_PACKAGE", "impact", "$GITNEXUS_QUERY_PROBE", "--repo", "$(basename "$repo_root")", "--include-tests", "--depth", "2"]
      },
      "query_probe_policy": {
        "expected_hit": true,
        "source": "git-ls-files-code-basename",
        "token": "$GITNEXUS_QUERY_PROBE",
        "selected_from": "trade/src/main/java/com/hstong/trade/tradelogin/login/ui/TradeLoginActivity.java"
      }
    }
  },
  "derived_readiness": {
    "graph_bootstrap_required": true,
    "providers": {}
  },
  "boundaries": {
    "setup_only": true,
    "graph_bootstrap_required": true
  }
}
JSON
  cat > "$repo_dir/.spec-first/config/runtime-capabilities.json" <<JSON
{
  "schema_version": "runtime-capabilities.v1",
  "repo_root": "$repo_dir",
  "host_ledger_pointer": {
    "host": "codex",
    "path": "$ledger_path",
    "schema_version": "v2"
  },
  "baseline_summary": {
    "baseline_ready": $baseline,
    "host_runtime_ready": $baseline,
    "source": "host-readiness-ledger-v2"
  },
  "fallback_capabilities": {
    "context_selection": {
      "support_level": "partial",
      "confidence": "medium",
      "providers": ["ast-grep"],
      "limitations": []
    },
    "impact_radius": {
      "support_level": "partial",
      "confidence": "low",
      "providers": ["ast-grep"],
      "limitations": []
    },
    "review_support": {
      "support_level": "partial",
      "confidence": "low",
      "providers": ["ast-grep"],
      "limitations": []
    }
  },
  "project_graph_readiness": {
    "status": "not-bootstrapped",
    "graph_bootstrap_required": true
  }
}
JSON
  cat > "$repo_dir/.spec-first/config/provider-artifacts.json" <<JSON
{
  "schema_version": "provider-artifacts.v1",
  "repo_root": "$repo_dir",
  "providers": {
    "gitnexus": {
      "raw_dir": ".spec-first/providers/gitnexus/raw",
      "normalized_dir": ".spec-first/providers/gitnexus/normalized",
      "status_path": ".spec-first/providers/gitnexus/status.json",
      "raw_logs": {
        "bootstrap": ".spec-first/providers/gitnexus/raw/analyze.log",
        "status": ".spec-first/providers/gitnexus/raw/status.log",
        "query_probe": ".spec-first/providers/gitnexus/raw/query.log",
        "impact_probe": ".spec-first/providers/gitnexus/raw/impact.log"
      },
      "normalized_artifacts": {
        "architecture_facts": ".spec-first/providers/gitnexus/normalized/architecture-facts.json",
        "reuse_candidates": ".spec-first/providers/gitnexus/normalized/reuse-candidates.json",
        "impact_capabilities": ".spec-first/providers/gitnexus/normalized/impact-capabilities.json"
      }
    }
  },
  "canonical": {
    "provider_status": ".spec-first/graph/provider-status.json",
    "graph_facts": ".spec-first/graph/graph-facts.json",
    "bootstrap_report": ".spec-first/graph/bootstrap-report.md",
    "impact_capabilities": ".spec-first/impact/bootstrap-impact-capabilities.json"
  }
}
JSON
}

write_folder_fixture_config() {
  local folder_dir="$1"
  local ledger_path="$2"
  local folder_root
  folder_root="$(cd "$folder_dir" && pwd -P)"
  local facts_path="$TMP_DIR/$(basename "$folder_dir")-folder-facts.json"
  mkdir -p "$(dirname "$ledger_path")"
  cat > "$ledger_path" <<JSON
{
  "schema_version": "v2",
  "host": "codex",
  "baseline_ready": true,
  "host_runtime_ready": true
}
JSON
  jq -n \
    --arg folder_root "$folder_root" \
    --arg ledger_path "$ledger_path" \
    '{
      schema_version:"v2",
      host:"codex",
      platform:"macos",
      repo_status:"not-git-repo",
      repo_root:$folder_root,
      selected_folder_root:$folder_root,
      target_root:$folder_root,
      target_kind:"non-git-folder",
      target:{state_write_allowed:true,target_kind:"non-git-folder",selected_folder_root:$folder_root,target_root:$folder_root},
      host_ledger_pointer:{host:"codex", path:$ledger_path, schema_version:"v2"},
      baseline_ready:true,
      host_runtime_ready:true,
      tools:{},
      helper_tools:{},
      graph_providers:{
        gitnexus:{
          configured:true,
          enabled_for_bootstrap:true,
          required:true,
          role:"global_knowledge",
          access_mode:"live_mcp",
          host_config_required:true,
          dependency_status:"ready",
          host_config_status:"ready",
          capabilities:[]
        }
      }
    }' > "$facts_path"
  bash "$MCP_WRITE_PROVIDER_CONFIG" --facts-file "$facts_path" >/dev/null
}

echo "=== spec-graph-bootstrap compiler tests ==="

graph_bootstrap_skill_source="$(cat "$GRAPH_BOOTSTRAP_SKILL")"
assert_contains "graph-bootstrap skill owns canonical refresh artifacts" 'only default local workflow that may refresh canonical project graph readiness artifacts' "$graph_bootstrap_skill_source"
assert_contains "graph-bootstrap skill names graph artifact paths" '`.spec-first/graph/*`, `.spec-first/providers/*`, and `.spec-first/impact/*`' "$graph_bootstrap_skill_source"
assert_contains "graph-bootstrap skill treats branch changes as invalidation" 'branch switch, pull, rebase, merge' "$graph_bootstrap_skill_source"
assert_contains "graph-bootstrap skill does not auto rebuild on invalidation" 'not automatic provider rebuild triggers' "$graph_bootstrap_skill_source"
assert_contains "graph-bootstrap skill keeps repair preview first" 'GitNexus repair remains preview-first' "$graph_bootstrap_skill_source"

FAKE_BIN="$TMP_DIR/bin"
COMMAND_LOG="$TMP_DIR/commands.log"
touch "$COMMAND_LOG"
make_fake_bin "$FAKE_BIN" "$COMMAND_LOG"
TEST_PATH="$FAKE_BIN:$PATH"

WORKSPACE_REPO_A="$TMP_DIR/workspace/project-a"
WORKSPACE_REPO_B="$TMP_DIR/workspace/project-b"
WORKSPACE_LEDGER_A="$TMP_DIR/workspace-home-a/.codex/spec-first/host-setup.json"
make_repo "$WORKSPACE_REPO_A"
make_repo "$WORKSPACE_REPO_B"
write_fixture_config "$WORKSPACE_REPO_A" "$WORKSPACE_LEDGER_A" true
workspace_targets_output="$(cd "$TMP_DIR/workspace" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "workspace graph target resolver schema" "workspace-graph-targets.v1" "$(jq -r '.schema_version' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver marks multi repo topology" "multi-repo-workspace" "$(jq -r '.git_root_topology' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver keeps parent advisory" "true:false" "$(jq -r '(.advisory | tostring) + ":" + (.parent_writes_repo_local_artifacts | tostring)' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver lists children" "2" "$(jq -r '.repos | length' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver sees setup-ready child" "setup-ready-bootstrap-required" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | .status' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver sees unconfigured child" "unavailable" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-b") | .status' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver emits new query fields" "eligible|missing|unavailable|false" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | [.refresh_eligibility,.index_snapshot,.query_usability,(.working_tree_overlay.dirty | tostring)] | join("|")' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver emits query usability counts" "0|0|0|2" "$(jq -r '[.query_usability_counts["fresh-primary"],.query_usability_counts["stale-advisory"],.query_usability_counts["definitions-pointer"],.query_usability_counts.unavailable] | join("|")' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver does not emit development_mode" "false" "$(jq -r 'has("development_mode") or any(.repos[]; has("development_mode"))' <<<"$workspace_targets_output")"
assert_eq "workspace graph target resolver reads setup-owned config pointers" ".spec-first/config/graph-providers.json|.spec-first/config/runtime-capabilities.json|.spec-first/config/provider-artifacts.json" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | [.artifacts.graph_providers,.artifacts.runtime_capabilities,.artifacts.provider_artifacts] | join("|")' <<<"$workspace_targets_output")"
assert "workspace graph target resolver does not create parent graph artifacts" test ! -e "$TMP_DIR/workspace/.spec-first/graph"

MIXED_VERSION_WORKSPACE="$TMP_DIR/mixed-version-workspace"
MIXED_UPGRADED_CHILD="$MIXED_VERSION_WORKSPACE/upgraded-child"
MIXED_LEGACY_CHILD="$MIXED_VERSION_WORKSPACE/legacy-child"
MIXED_RESIDUE_CHILD="$MIXED_VERSION_WORKSPACE/residue-child"
MIXED_LEDGER_UPGRADED="$TMP_DIR/mixed-version-home-upgraded/.codex/spec-first/host-setup.json"
MIXED_LEDGER_LEGACY="$TMP_DIR/mixed-version-home-legacy/.codex/spec-first/host-setup.json"
make_repo "$MIXED_UPGRADED_CHILD"
make_repo "$MIXED_LEGACY_CHILD"
make_repo "$MIXED_RESIDUE_CHILD"
write_fixture_config "$MIXED_UPGRADED_CHILD" "$MIXED_LEDGER_UPGRADED" true
write_fixture_config "$MIXED_LEGACY_CHILD" "$MIXED_LEDGER_LEGACY" true
legacy_child_head="$(git -C "$MIXED_LEGACY_CHILD" rev-parse HEAD)"
mkdir -p "$MIXED_LEGACY_CHILD/.spec-first/providers/code-review-graph" "$MIXED_RESIDUE_CHILD/.spec-first/providers/code-review-graph"
jq '.providers["code-review-graph"] = {configured:true,enabled_for_bootstrap:true,dependency_status:"ready",host_config_status:"ready",commands:{bootstrap:["uvx","code-review-graph@2.3.3","build"],status:["uvx","code-review-graph@2.3.3","status"],query_probe:["uvx","code-review-graph@2.3.3","status","--repo",.repo_root]}}' "$MIXED_LEGACY_CHILD/.spec-first/config/graph-providers.json" > "$MIXED_LEGACY_CHILD/.spec-first/config/graph-providers.json.tmp"
mv "$MIXED_LEGACY_CHILD/.spec-first/config/graph-providers.json.tmp" "$MIXED_LEGACY_CHILD/.spec-first/config/graph-providers.json"
jq -n --arg head "$legacy_child_head" '{
  schema_version:"provider-status.v1",
  provider:"code-review-graph",
  status:"ready",
  graph_ready:true,
  query_ready:true,
  last_indexed_commit:$head,
  repo_snapshot:{source_revision:$head},
  bootstrap_fingerprint:{repo_snapshot:{source_revision:$head}}
}' > "$MIXED_LEGACY_CHILD/.spec-first/providers/code-review-graph/status.json"
jq -n '{
  schema_version:"provider-status.v1",
  provider:"code-review-graph",
  status:"ready",
  graph_ready:true,
  query_ready:true,
  last_indexed_commit:"historical"
}' > "$MIXED_RESIDUE_CHILD/.spec-first/providers/code-review-graph/status.json"
mixed_version_targets_output="$(cd "$MIXED_VERSION_WORKSPACE" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "mixed workspace resolver does not expose active CRG provider block" "false" "$(jq -r 'any(.repos[]; .providers | has("code-review-graph"))' <<<"$mixed_version_targets_output")"
assert_eq "mixed workspace legacy child asks for upgrade" "child-on-legacy-spec-first-version" "$(jq -r '.repos[] | select(.workspace_relative_path=="legacy-child") | .legacy_provider_advisories[0].reason_code' <<<"$mixed_version_targets_output")"
assert_eq "mixed workspace residue child ignores historical CRG state" "crg-residue-ignored" "$(jq -r '.repos[] | select(.workspace_relative_path=="residue-child") | .legacy_provider_advisories[0].reason_code' <<<"$mixed_version_targets_output")"
assert_eq "mixed workspace upgraded child has no CRG advisory" "0" "$(jq -r '.repos[] | select(.workspace_relative_path=="upgraded-child") | (.legacy_provider_advisories | length)' <<<"$mixed_version_targets_output")"

STALE_PARENT_WORKSPACE="$TMP_DIR/stale-parent-workspace"
make_repo "$STALE_PARENT_WORKSPACE/project-a"
make_repo "$STALE_PARENT_WORKSPACE/project-b"
mkdir -p "$STALE_PARENT_WORKSPACE/.spec-first/config"
printf 'gitdir: /missing/worktree/path\n' > "$STALE_PARENT_WORKSPACE/.git"
printf '{"schema_version":"graph-providers.v1","repo_root":"/old/path"}\n' > "$STALE_PARENT_WORKSPACE/.spec-first/config/graph-providers.json"
stale_parent_targets_output="$(cd "$STALE_PARENT_WORKSPACE" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "workspace graph target resolver ignores parent repo-local stale artifacts" "ignored:parent-workspace-repo-local-artifacts-ignored:invalid" "$(jq -r '.parent_repo_local_artifact_advisory | "\(.status):\(.reason_code):\(.git_marker_status)"' <<<"$stale_parent_targets_output")"
assert_eq "workspace graph target resolver names ignored parent config artifact" "true" "$(jq -r '.parent_repo_local_artifact_advisory.ignored_paths | index(".spec-first/config/graph-providers.json") != null' <<<"$stale_parent_targets_output")"
assert_eq "workspace graph target resolver still lists child repos with stale parent artifacts" "2:false" "$(jq -r '(.repos | length | tostring) + ":" + (.parent_writes_repo_local_artifacts | tostring)' <<<"$stale_parent_targets_output")"

set +e
workspace_default_output="$(cd "$TMP_DIR/workspace" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
workspace_default_status=$?
set -e
assert_eq "workspace parent default all-repos exits non-zero on partial" "1" "$workspace_default_status"
assert_eq "workspace parent without repo defaults to all repos" "workspace-graph-bootstrap-summary.v1" "$(jq -r '.schema_version' <<<"$workspace_default_output")"
assert_eq "workspace parent default all-repos selection source" "workspace-default-all-repos" "$(jq -r '.selection_source' <<<"$workspace_default_output")"
assert_eq "workspace parent default all-repos reports partial success" "partial:1:1" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$workspace_default_output")"
assert_eq "workspace parent default all-repos records missing child config" "project-b:missing_provider_config" "$(jq -r '.results[] | select(.workspace_relative_path=="project-b") | "\(.repo_label):\(.reason_code)"' <<<"$workspace_default_output")"
assert "workspace parent default all-repos writes advisory workspace summary" test -f "$TMP_DIR/workspace/.spec-first/workspace/graph-bootstrap-summary.json"
assert "workspace parent default all-repos writes child graph facts" test -f "$WORKSPACE_REPO_A/.spec-first/graph/graph-facts.json"
assert "workspace parent default all-repos does not create parent graph artifacts" test ! -e "$TMP_DIR/workspace/.spec-first/graph"

SINGLE_WORKSPACE="$TMP_DIR/single-workspace"
make_repo "$SINGLE_WORKSPACE/project-only"
single_candidate_targets="$(cd "$SINGLE_WORKSPACE" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "single candidate workspace has blocked topology null" "workspace-single-candidate:null:1" "$(jq -r '.mode + ":" + (.git_root_topology | tostring) + ":" + (.repos | length | tostring)' <<<"$single_candidate_targets")"
NO_GIT_WORKSPACE="$TMP_DIR/no-git-workspace"
mkdir -p "$NO_GIT_WORKSPACE/docs"
no_git_targets="$(cd "$NO_GIT_WORKSPACE" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "no git workspace has blocked topology null" "workspace-no-git-candidates:null:0" "$(jq -r '.mode + ":" + (.git_root_topology | tostring) + ":" + (.repos | length | tostring)' <<<"$no_git_targets")"
before_single_block_log="$(cat "$COMMAND_LOG")"
set +e
single_block_output="$(cd "$SINGLE_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
single_block_status=$?
set -e
assert_eq "single child workspace defaults to all repos and reports action required" "1" "$single_block_status"
assert_eq "single child workspace summary schema" "workspace-graph-bootstrap-summary.v1" "$(jq -r '.schema_version' <<<"$single_block_output")"
assert_eq "single child workspace default all-repos reason" "all-repos-partial-or-action-required" "$(jq -r '.reason_code' <<<"$single_block_output")"
assert_eq "single child workspace default all-repos selection source" "workspace-default-all-repos" "$(jq -r '.selection_source' <<<"$single_block_output")"
assert_eq "single child workspace does not run providers without child config" "$before_single_block_log" "$(cat "$COMMAND_LOG")"

ALL_REPOS_WORKSPACE="$TMP_DIR/all-repos-workspace"
ALL_REPOS_LEDGER="$TMP_DIR/all-repos-home/.codex/spec-first/host-setup.json"
make_repo "$ALL_REPOS_WORKSPACE/project-a"
make_repo "$ALL_REPOS_WORKSPACE/project-b"
write_fixture_config "$ALL_REPOS_WORKSPACE/project-a" "$ALL_REPOS_LEDGER" true
printf '# Parent Agents\n' > "$ALL_REPOS_WORKSPACE/AGENTS.md"
printf '# Parent Claude\n' > "$ALL_REPOS_WORKSPACE/CLAUDE.md"
all_repos_progress_err="$TMP_DIR/all-repos-progress.err"
set +e
all_repos_output="$(cd "$ALL_REPOS_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --all-repos 2>"$all_repos_progress_err")"
all_repos_status=$?
set -e
assert_eq "all-repos graph bootstrap exits non-zero on partial" "1" "$all_repos_status"
assert_eq "all-repos graph bootstrap emits workspace summary" "workspace-graph-bootstrap-summary.v1" "$(jq -r '.schema_version' <<<"$all_repos_output")"
assert_eq "all-repos graph bootstrap records explicit selection source" "explicit-all-repos" "$(jq -r '.selection_source' <<<"$all_repos_output")"
assert_eq "all-repos graph bootstrap records run id" "true" "$(jq -r '(.run_id | type == "string") and (.run_id | length > 0)' <<<"$all_repos_output")"
assert_eq "all-repos child rows carry parent run id" "true" "$(jq -r '(.run_id as $run_id | all(.results[]; .parent_run_id == $run_id))' <<<"$all_repos_output")"
assert_eq "all-repos summary records total timing" "true" "$(jq -r '(.timing.started_at | type == "string") and (.timing.finished_at | type == "string") and (.timing.duration_ms | type == "number") and (.timing.duration_ms >= 0)' <<<"$all_repos_output")"
assert_eq "all-repos child rows record timing" "true" "$(jq -r 'all(.results[]; (.started_at | type == "string") and (.finished_at | type == "string") and (.duration_ms | type == "number") and (.duration_ms >= 0))' <<<"$all_repos_output")"
assert_eq "all-repos graph bootstrap reports partial success" "partial:1:1" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$all_repos_output")"
assert_eq "all-repos graph bootstrap records child reason" "project-b:missing_provider_config" "$(jq -r '.results[] | select(.workspace_relative_path=="project-b") | "\(.repo_label):\(.reason_code)"' <<<"$all_repos_output")"
assert_eq "all-repos graph bootstrap records parent host normalization" "drift-detected:false:true:0" "$(jq -r '.parent_host_instruction_normalization as $norm | "\($norm.status):\(.parent_writes_host_instruction_files):\($norm.advisory):\($norm.exit_code)"' <<<"$all_repos_output")"
assert_contains "all-repos graph bootstrap prints child start progress" "all-repos child 1/2 start repo=project-a" "$(cat "$all_repos_progress_err")"
assert_contains "all-repos graph bootstrap prints child finish progress" "all-repos child 1/2 finish repo=project-a status=ready workflow=primary" "$(cat "$all_repos_progress_err")"
assert "all-repos graph bootstrap writes advisory workspace summary" test -f "$ALL_REPOS_WORKSPACE/.spec-first/workspace/graph-bootstrap-summary.json"
assert "all-repos graph bootstrap writes advisory workspace targets" test -f "$ALL_REPOS_WORKSPACE/.spec-first/workspace/graph-targets.json"
assert "all-repos graph bootstrap writes GitNexus readiness artifact" test -f "$ALL_REPOS_WORKSPACE/.spec-first/workspace/gitnexus-readiness.json"
assert "all-repos graph bootstrap writes child graph facts" test -f "$ALL_REPOS_WORKSPACE/project-a/.spec-first/graph/graph-facts.json"
assert "all-repos graph bootstrap does not write parent graph facts" test ! -e "$ALL_REPOS_WORKSPACE/.spec-first/graph"
assert "all-repos graph bootstrap does not write parent provider artifacts" test ! -e "$ALL_REPOS_WORKSPACE/.spec-first/providers"
assert "all-repos graph bootstrap does not write parent impact artifacts" test ! -e "$ALL_REPOS_WORKSPACE/.spec-first/impact"
assert "all-repos graph bootstrap does not write parent config artifacts" test ! -e "$ALL_REPOS_WORKSPACE/.spec-first/config"
assert_eq "all-repos summary records GitNexus readiness pointer" ".spec-first/workspace/gitnexus-readiness.json:script-mode-no-mcp" "$(jq -r '.workspace_gitnexus_readiness_pointer.path + ":" + .workspace_gitnexus_readiness_pointer.reason_code' <<<"$all_repos_output")"
assert_eq "all-repos summary pointer resolves to existing artifact" "true" "$(jq -r '.workspace_gitnexus_readiness_pointer.path' <<<"$all_repos_output" | { read -r rel_path; test -f "$ALL_REPOS_WORKSPACE/$rel_path" && printf true || printf false; })"
assert_eq "all-repos summary records nested placeholder group" "not-evaluated-no-mcp-input" "$(jq -r '.group.status' <<<"$all_repos_output")"
assert_eq "all-repos summary records durable query usability counts" "1:0:0:1" "$(jq -r '.query_usability_counts as $c | "\($c["fresh-primary"]):\($c["stale-advisory"]):\($c["definitions-pointer"]):\($c.unavailable)"' <<<"$all_repos_output")"
assert_eq "all-repos summary omits overlay-only query count keys" "false:false" "$(jq -r '(.query_usability_counts | has("registry-present-query-unverified") | tostring) + ":" + (.query_usability_counts | has("registry-fanout-advisory") | tostring)' <<<"$all_repos_output")"
assert_eq "all-repos summary records parent AGENTS dry-run workspace GitNexus block" "would-create:true:false:multi-repo-workspace" "$(jq -r '.parent_host_instruction_normalization.results[] | select(.file=="AGENTS.md") | "\(.action):\(.wouldChange):\(.written):\(.gitRootTopology)"' <<<"$all_repos_output")"
assert_eq "all-repos summary records parent CLAUDE dry-run workspace GitNexus block" "would-create:true:false:multi-repo-workspace" "$(jq -r '.parent_host_instruction_normalization.results[] | select(.file=="CLAUDE.md") | "\(.action):\(.wouldChange):\(.written):\(.gitRootTopology)"' <<<"$all_repos_output")"
assert_eq "all-repos graph bootstrap leaves parent AGENTS for init to refresh" "# Parent Agents" "$(cat "$ALL_REPOS_WORKSPACE/AGENTS.md")"
assert_eq "all-repos graph bootstrap leaves parent CLAUDE for init to refresh" "# Parent Claude" "$(cat "$ALL_REPOS_WORKSPACE/CLAUDE.md")"

WORKSPACE_TARGETS_SYMLINK_WORKSPACE="$TMP_DIR/workspace-targets-symlink-workspace"
WORKSPACE_TARGETS_SYMLINK_OUTSIDE="$TMP_DIR/workspace-targets-symlink-outside"
make_repo "$WORKSPACE_TARGETS_SYMLINK_WORKSPACE/project-a"
make_repo "$WORKSPACE_TARGETS_SYMLINK_WORKSPACE/project-b"
mkdir -p "$WORKSPACE_TARGETS_SYMLINK_WORKSPACE/.spec-first" "$WORKSPACE_TARGETS_SYMLINK_OUTSIDE"
ln -s "$WORKSPACE_TARGETS_SYMLINK_OUTSIDE" "$WORKSPACE_TARGETS_SYMLINK_WORKSPACE/.spec-first/workspace"
set +e
workspace_targets_symlink_output="$(cd "$WORKSPACE_TARGETS_SYMLINK_WORKSPACE" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER" --write-summary 2>/dev/null)"
workspace_targets_symlink_status=$?
set -e
assert_eq "workspace graph target resolver refuses symlinked workspace summary" "1" "$workspace_targets_symlink_status"
assert_eq "workspace graph target resolver symlink reason" "workspace-summary-symlink-escape" "$(jq -r '.reason_code' <<<"$workspace_targets_symlink_output")"
assert "workspace graph target resolver does not write summary outside workspace" test ! -e "$WORKSPACE_TARGETS_SYMLINK_OUTSIDE/graph-targets.json"

GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_WORKSPACE="$TMP_DIR/graph-bootstrap-summary-symlink-workspace"
GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_OUTSIDE="$TMP_DIR/graph-bootstrap-summary-symlink-outside"
GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_LEDGER="$TMP_DIR/graph-bootstrap-summary-symlink-home/.codex/spec-first/host-setup.json"
make_repo "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_WORKSPACE/project-a"
make_repo "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_WORKSPACE/project-b"
write_fixture_config "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_WORKSPACE/project-a" "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_LEDGER" true
mkdir -p "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_WORKSPACE/.spec-first" "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_OUTSIDE"
ln -s "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_OUTSIDE" "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_WORKSPACE/.spec-first/workspace"
set +e
graph_bootstrap_symlink_output="$(cd "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_WORKSPACE" && PATH="$TEST_PATH" HOME="$(dirname "$(dirname "$(dirname "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_LEDGER")")")" MCP_SETUP_HOST=codex bash "$BOOTSTRAP_SCRIPT" --all-repos 2>/dev/null)"
graph_bootstrap_symlink_status=$?
set -e
assert_eq "graph bootstrap refuses symlinked workspace summary" "1" "$graph_bootstrap_symlink_status"
assert_eq "graph bootstrap symlink summary reason" "workspace-summary-symlink-escape" "$(jq -r '.reason_code' <<<"$graph_bootstrap_symlink_output")"
assert "graph bootstrap does not write summary outside workspace" test ! -e "$GRAPH_BOOTSTRAP_SUMMARY_SYMLINK_OUTSIDE/graph-bootstrap-summary.json"

ALL_REPOS_INCREMENTAL_WORKSPACE="$TMP_DIR/all-repos-incremental-workspace"
ALL_REPOS_INCREMENTAL_LEDGER="$TMP_DIR/all-repos-incremental-home/.codex/spec-first/host-setup.json"
make_repo "$ALL_REPOS_INCREMENTAL_WORKSPACE/project-a"
write_fixture_config "$ALL_REPOS_INCREMENTAL_WORKSPACE/project-a" "$ALL_REPOS_INCREMENTAL_LEDGER" true
before_all_repos_incremental_log="$(cat "$COMMAND_LOG")"
set +e
all_repos_incremental_output="$(cd "$ALL_REPOS_INCREMENTAL_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --all-repos --incremental)"
all_repos_incremental_status=$?
set -e
assert_eq "all-repos incremental is unsupported" "1" "$all_repos_incremental_status"
assert_eq "all-repos incremental blocks before providers" "workspace-graph-bootstrap-summary.v1:blocked:incremental-all-repos-unsupported:true" "$(jq -r '.schema_version + ":" + .workflow_mode + ":" + .reason_code + ":" + (.canonical_artifacts_preserved | tostring)' <<<"$all_repos_incremental_output")"
assert_eq "all-repos incremental does not run provider commands" "$before_all_repos_incremental_log" "$(cat "$COMMAND_LOG")"
assert "all-repos incremental does not write child graph facts" test ! -e "$ALL_REPOS_INCREMENTAL_WORKSPACE/project-a/.spec-first/graph/graph-facts.json"
set +e
all_repos_conflict_output="$(cd "$ALL_REPOS_INCREMENTAL_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --all-repos --incremental --full)"
all_repos_conflict_status=$?
set -e
assert_eq "all-repos conflicting refresh flags fail closed" "1" "$all_repos_conflict_status"
assert_eq "all-repos conflicting refresh flags reason" "conflicting-refresh-flags" "$(jq -r '.reason_code' <<<"$all_repos_conflict_output")"
assert_eq "all-repos conflicting refresh flags do not run provider commands" "$before_all_repos_incremental_log" "$(cat "$COMMAND_LOG")"

set +e
default_all_repos_incremental_output="$(cd "$ALL_REPOS_INCREMENTAL_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --incremental)"
default_all_repos_incremental_status=$?
set -e
assert_eq "default all-repos incremental is unsupported" "1" "$default_all_repos_incremental_status"
assert_eq "default all-repos incremental blocks before providers" "workspace-graph-bootstrap-summary.v1:blocked:incremental-all-repos-unsupported:true" "$(jq -r '.schema_version + ":" + .workflow_mode + ":" + .reason_code + ":" + (.canonical_artifacts_preserved | tostring)' <<<"$default_all_repos_incremental_output")"
assert_eq "default all-repos incremental does not run provider commands" "$before_all_repos_incremental_log" "$(cat "$COMMAND_LOG")"

ALL_REPOS_DEGRADED_WORKSPACE="$TMP_DIR/all-repos-degraded-workspace"
ALL_REPOS_DEGRADED_LEDGER="$TMP_DIR/all-repos-degraded-home/.codex/spec-first/host-setup.json"
make_repo "$ALL_REPOS_DEGRADED_WORKSPACE/project-a"
make_repo "$ALL_REPOS_DEGRADED_WORKSPACE/project-b"
write_fixture_config "$ALL_REPOS_DEGRADED_WORKSPACE/project-a" "$ALL_REPOS_DEGRADED_LEDGER" true
write_fixture_config "$ALL_REPOS_DEGRADED_WORKSPACE/project-b" "$ALL_REPOS_DEGRADED_LEDGER" true
set +e
all_repos_degraded_output="$(cd "$ALL_REPOS_DEGRADED_WORKSPACE" && PATH="$TEST_PATH" GITNEXUS_QUERY_DEFINITIONS_ONLY=1 bash "$BOOTSTRAP_SCRIPT" --all-repos)"
all_repos_degraded_status=$?
set -e
assert_eq "all-repos definitions-only query exits ready" "0" "$all_repos_degraded_status"
assert_eq "all-repos definitions-only children are ready" "ready:2:0:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.degraded):\(.counts.action_required)"' <<<"$all_repos_degraded_output")"
assert_eq "all-repos definitions-only child exposes query-only limits" "true:false:unavailable:true" "$(jq -r '.results[0].result.capabilities.query_global_graph as $query | .results[0].result.capabilities.impact_context as $impact | .results[0].result.capabilities.impact_context_status as $status | .results[0].result.capabilities.impact_context_limitations as $limits | "\($query):\($impact):\($status):\(($limits | index("definitions_only_no_process_graph")) != null)"' <<<"$all_repos_degraded_output")"

ALL_REPOS_NO_SOURCE_WORKSPACE="$TMP_DIR/all-repos-no-source-workspace"
ALL_REPOS_NO_SOURCE_LEDGER="$TMP_DIR/all-repos-no-source-home/.codex/spec-first/host-setup.json"
make_repo "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-a"
make_repo "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-b"
write_fixture_config "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-a" "$ALL_REPOS_NO_SOURCE_LEDGER" true
write_fixture_config "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-b" "$ALL_REPOS_NO_SOURCE_LEDGER" true
jq '
  .providers.gitnexus.commands.query_probe[4] = "main src build README package"
  | .providers.gitnexus.query_probe_policy.expected_hit = false
  | .providers.gitnexus.query_probe_policy.source = "fallback-static"
  | .providers.gitnexus.query_probe_policy.token = "main src build README package"
  | .providers.gitnexus.query_probe_policy.selected_from = null
  | .providers.gitnexus.query_probe_policy.candidates = [
      {token:"main src build README package", selected_from:null, reason_code:"fallback-static"}
    ]
' "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-b/.spec-first/config/graph-providers.json" > "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-b/.spec-first/config/graph-providers.json.tmp"
mv "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-b/.spec-first/config/graph-providers.json.tmp" "$ALL_REPOS_NO_SOURCE_WORKSPACE/project-b/.spec-first/config/graph-providers.json"
all_repos_no_source_output="$(cd "$ALL_REPOS_NO_SOURCE_WORKSPACE" && PATH="$TEST_PATH" GITNEXUS_QUERY_NO_SOURCE_TOKEN_EMPTY=1 bash "$BOOTSTRAP_SCRIPT" --all-repos)"
assert_eq "all-repos graph bootstrap separates no-source children from degraded" "ready:1:0:1:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.degraded):\(.counts.not_applicable):\(.counts.action_required)"' <<<"$all_repos_no_source_output")"
assert_eq "all-repos no-source child workflow is explicit" "project-b:no-source:not-applicable" "$(jq -r '.results[] | select(.workspace_relative_path=="project-b") | "\(.repo_label):\(.workflow_mode):\(.overall_status)"' <<<"$all_repos_no_source_output")"

ONLY_NO_SOURCE_WORKSPACE="$TMP_DIR/only-no-source-workspace"
ONLY_NO_SOURCE_LEDGER="$TMP_DIR/only-no-source-home/.codex/spec-first/host-setup.json"
make_repo "$ONLY_NO_SOURCE_WORKSPACE/project-only"
write_fixture_config "$ONLY_NO_SOURCE_WORKSPACE/project-only" "$ONLY_NO_SOURCE_LEDGER" true
jq '
  .providers.gitnexus.commands.query_probe[4] = "main src build README package"
  | .providers.gitnexus.query_probe_policy.expected_hit = false
  | .providers.gitnexus.query_probe_policy.source = "fallback-static"
  | .providers.gitnexus.query_probe_policy.token = "main src build README package"
  | .providers.gitnexus.query_probe_policy.selected_from = null
  | .providers.gitnexus.query_probe_policy.candidates = [
      {token:"main src build README package", selected_from:null, reason_code:"fallback-static"}
    ]
' "$ONLY_NO_SOURCE_WORKSPACE/project-only/.spec-first/config/graph-providers.json" > "$ONLY_NO_SOURCE_WORKSPACE/project-only/.spec-first/config/graph-providers.json.tmp"
mv "$ONLY_NO_SOURCE_WORKSPACE/project-only/.spec-first/config/graph-providers.json.tmp" "$ONLY_NO_SOURCE_WORKSPACE/project-only/.spec-first/config/graph-providers.json"
only_no_source_output="$(cd "$ONLY_NO_SOURCE_WORKSPACE" && PATH="$TEST_PATH" GITNEXUS_QUERY_NO_SOURCE_TOKEN_EMPTY=1 bash "$BOOTSTRAP_SCRIPT" --all-repos)"
assert_eq "only no-source all-repos remains successful" "ready:0:0:1:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.degraded):\(.counts.not_applicable):\(.counts.action_required)"' <<<"$only_no_source_output")"
only_no_source_targets="$(cd "$ONLY_NO_SOURCE_WORKSPACE" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "resolver has explicit no-source reason when every child is no-source" "workspace-graph-targets-no-source:1" "$(jq -r '.reason_code + ":" + (.counts.no_source | tostring)' <<<"$only_no_source_targets")"
assert_contains "resolver no-source next action is explicit" "No code-bearing graph target is available" "$(jq -r '.next_action' <<<"$only_no_source_targets")"

ALL_REPOS_SINGLE_REPO="$TMP_DIR/all-repos-single-repo"
make_repo "$ALL_REPOS_SINGLE_REPO"
mkdir -p "$ALL_REPOS_SINGLE_REPO/packages/module-a" "$ALL_REPOS_SINGLE_REPO/apps/web"
single_repo_targets="$(cd "$ALL_REPOS_SINGLE_REPO" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "single repo topology remains repo local with modules" "single-repo:1:all-repos-single-repo" "$(jq -r '.git_root_topology + ":" + (.repos | length | tostring) + ":" + .repos[0].workspace_relative_path' <<<"$single_repo_targets")"
assert_eq "single repo resolver does not emit development_mode" "false" "$(jq -r 'has("development_mode") or any(.repos[]; has("development_mode"))' <<<"$single_repo_targets")"
set +e
all_repos_single_output="$(cd "$ALL_REPOS_SINGLE_REPO" 2>/dev/null && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --all-repos)"
all_repos_single_status=$?
set -e
assert_eq "all-repos inside git repo fails closed" "1" "$all_repos_single_status"
assert_eq "all-repos inside git repo reason" "all-repos-requires-parent-workspace" "$(jq -r '.reason_code' <<<"$all_repos_single_output")"

UNBORN_REPO="$TMP_DIR/unborn-repo"
UNBORN_LEDGER="$TMP_DIR/unborn-home/.codex/spec-first/host-setup.json"
make_unborn_repo "$UNBORN_REPO"
write_fixture_config "$UNBORN_REPO" "$UNBORN_LEDGER" true
before_unborn_log="$(cat "$COMMAND_LOG")"
set +e
unborn_output="$(cd "$UNBORN_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
unborn_status=$?
set -e
assert_eq "unborn repository fails snapshot validation" "1" "$unborn_status"
assert_eq "unborn repository reason" "repo-snapshot-unavailable" "$(jq -r '.reason_code' <<<"$unborn_output")"
assert_eq "unborn repository does not run providers" "$before_unborn_log" "$(cat "$COMMAND_LOG")"

workspace_selected_output="$(cd "$TMP_DIR/workspace" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --repo project-a)"
WORKSPACE_REPO_A_ROOT="$(cd "$WORKSPACE_REPO_A" && pwd -P)"
assert_eq "workspace explicit child runs primary bootstrap" "primary" "$(jq -r '.workflow_mode' <<<"$workspace_selected_output")"
assert_eq "workspace explicit child records explicit selection" "explicit-repo" "$(jq -r '.selection_source' <<<"$workspace_selected_output")"
assert "workspace explicit child writes child graph facts" test -f "$WORKSPACE_REPO_A/.spec-first/graph/graph-facts.json"
assert "workspace explicit child leaves parent graph clean" test ! -e "$TMP_DIR/workspace/.spec-first/graph"
assert_contains "workspace explicit child runs GitNexus provider" "npx -y $GITNEXUS_PACKAGE query $GITNEXUS_QUERY_PROBE --repo $(basename "$WORKSPACE_REPO_A_ROOT")" "$(cat "$COMMAND_LOG")"

workspace_targets_after_bootstrap="$(cd "$TMP_DIR/workspace" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "dirty graph facts with matching fingerprint stay usable" "primary:false" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | .status + ":" + (.freshness.dirty_uncertain | tostring)' <<<"$workspace_targets_after_bootstrap")"
assert_eq "primary resolver row separates refresh and query usability" "eligible|current-clean|fresh-primary" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | [.refresh_eligibility,.index_snapshot,.query_usability] | join("|")' <<<"$workspace_targets_after_bootstrap")"
assert_eq "graph facts record worktree status fingerprint" "true:true" "$(jq -r '(.worktree_status_hash | startswith("sha256:") | tostring) + ":" + (.staleness_hints.worktree_status_hash | startswith("sha256:") | tostring)' "$WORKSPACE_REPO_A/.spec-first/graph/graph-facts.json")"
jq '.worktree_dirty = true | del(.worktree_status_hash) | del(.staleness_hints.worktree_status_hash)' "$WORKSPACE_REPO_A/.spec-first/graph/graph-facts.json" > "$WORKSPACE_REPO_A/.spec-first/graph/graph-facts.json.tmp"
mv "$WORKSPACE_REPO_A/.spec-first/graph/graph-facts.json.tmp" "$WORKSPACE_REPO_A/.spec-first/graph/graph-facts.json"
printf 'dirty change\n' >> "$WORKSPACE_REPO_A/README.md"
workspace_targets_without_fingerprint="$(cd "$TMP_DIR/workspace" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "dirty graph facts without fingerprint are uncertain" "dirty-uncertain:true" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | .status + ":" + (.freshness.dirty_uncertain | tostring)' <<<"$workspace_targets_without_fingerprint")"
assert_eq "dirty resolver row keeps stale advisory if prior index exists" "blocked-dirty-source|current-with-dirty-overlay|stale-advisory|true" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | [.refresh_eligibility,.index_snapshot,.query_usability,(.working_tree_overlay.dirty | tostring)] | join("|")' <<<"$workspace_targets_without_fingerprint")"
assert_contains "dirty uncertainty limitation is explicit" "dirty worktree without a matching status fingerprint" "$(jq -r '.repos[] | select(.workspace_relative_path=="project-a") | .limitations | join(" ")' <<<"$workspace_targets_without_fingerprint")"

PRIMARY_REPO="$TMP_DIR/primary-repo"
PRIMARY_LEDGER="$TMP_DIR/primary-home/.codex/spec-first/host-setup.json"
make_repo "$PRIMARY_REPO"
write_fixture_config "$PRIMARY_REPO" "$PRIMARY_LEDGER" true
for host_instruction in AGENTS.md CLAUDE.md; do
  cat > "$PRIMARY_REPO/$host_instruction" <<'MD'
<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **primary-repo** (26859 symbols, 31088 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

## Always Do

- **MUST run impact analysis before editing any symbol.**

## CLI

| Understand architecture | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |

<!-- gitnexus:end -->
MD
done
git -C "$PRIMARY_REPO" add AGENTS.md CLAUDE.md
git -C "$PRIMARY_REPO" commit -q -m "Add host instruction fixtures"
primary_provider_config_before="$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/graph-providers.json")"
primary_runtime_capabilities_before="$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/runtime-capabilities.json")"

primary_output="$(cd "$PRIMARY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
PRIMARY_REPO_ROOT="$(cd "$PRIMARY_REPO" && pwd -P)"
assert "primary output is JSON" jq -e . <<<"$primary_output"
assert_eq "primary workflow mode" "primary" "$(jq -r '.workflow_mode' <<<"$primary_output")"
assert_contains "runs gitnexus analyze with force rebuild" "npx -y $GITNEXUS_PACKAGE analyze --force" "$(cat "$COMMAND_LOG")"
assert_contains "runs gitnexus query proof" "npx -y $GITNEXUS_PACKAGE query $GITNEXUS_QUERY_PROBE --repo $(basename "$PRIMARY_REPO_ROOT")" "$(cat "$COMMAND_LOG")"
assert_contains "runs gitnexus impact related-tests proof" "npx -y $GITNEXUS_PACKAGE impact $GITNEXUS_QUERY_PROBE --repo $(basename "$PRIMARY_REPO_ROOT") --include-tests --depth 2" "$(cat "$COMMAND_LOG")"
assert_not_contains "does not run code-review-graph query proof" "code-review-graph" "$(cat "$COMMAND_LOG")"
assert "provider status aggregate exists" test -f "$PRIMARY_REPO/.spec-first/graph/provider-status.json"
assert "graph facts exists" test -f "$PRIMARY_REPO/.spec-first/graph/graph-facts.json"
assert "impact capabilities exists" test -f "$PRIMARY_REPO/.spec-first/impact/bootstrap-impact-capabilities.json"
assert "provider raw log exists" test -f "$PRIMARY_REPO/.spec-first/providers/gitnexus/raw/analyze.log"
assert "code-review-graph normalized artifact is not written" test ! -e "$PRIMARY_REPO/.spec-first/providers/code-review-graph/normalized/impact-capabilities.json"
assert "GitNexus impact normalized artifact exists" test -f "$PRIMARY_REPO/.spec-first/providers/gitnexus/normalized/impact-capabilities.json"
assert "old graph raw path is not used" test ! -e "$PRIMARY_REPO/.spec-first/graph/raw/gitnexus"
assert_eq "graph-bootstrap leaves AGENTS host block for init to refresh" "true" "$(grep -Eq 'MUST run impact|\\.claude/skills/gitnexus' "$PRIMARY_REPO/AGENTS.md" && printf true || printf false)"
assert_eq "graph-bootstrap leaves CLAUDE host block for init to refresh" "true" "$(grep -Eq 'MUST run impact|\\.claude/skills/gitnexus' "$PRIMARY_REPO/CLAUDE.md" && printf true || printf false)"
assert_eq "graph facts source revision is a commit SHA" "true" "$(jq -r '.source_revision | test("^[0-9a-f]{40}$")' "$PRIMARY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "graph facts exposes GitNexus supported impact status" "true:true:supported:" "$(jq -r '(.capabilities.query_global_graph | tostring) + ":" + (.capabilities.impact_context | tostring) + ":" + .capabilities.impact_context_status + ":" + (.capabilities.impact_context_limitations | join(","))' "$PRIMARY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "GitNexus provider status points at impact normalized artifact" ".spec-first/providers/gitnexus/normalized/impact-capabilities.json" "$(jq -r '.normalized_artifacts.impact_capabilities' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "GitNexus provider status records supported related tests" "supported:.spec-first/providers/gitnexus/raw/impact.log:false" "$(jq -r '.review_support.related_tests_status + ":" + .review_support.impact_probe_raw_log + ":" + ((.review_support.limitations | index("related_tests_unverified")) != null | tostring)' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "GitNexus impact normalized artifact records supported related tests" "supported:high:false" "$(jq -r '.related_tests + ":" + .confidence + ":" + ((.limitations | index("related_tests_unverified")) != null | tostring)' "$PRIMARY_REPO/.spec-first/providers/gitnexus/normalized/impact-capabilities.json")"
assert_eq "bootstrap impact capabilities use GitNexus supported review support" "full:gitnexus:full:gitnexus:supported:false" "$(jq -r '.capabilities.impact_radius.support_level + ":" + (.capabilities.impact_radius.primary_providers | join(",")) + ":" + .capabilities.review_support.support_level + ":" + (.capabilities.review_support.primary_providers | join(",")) + ":" + .capabilities.review_support.related_tests_status + ":" + ((.capabilities.review_support.limitations | index("related_tests_unverified")) != null | tostring)' "$PRIMARY_REPO/.spec-first/impact/bootstrap-impact-capabilities.json")"
assert_eq "graph facts exposes staleness hints" "true:true" "$(jq -r '(.staleness_hints.compare_source_revision | tostring) + ":" + (.staleness_hints.compare_worktree_dirty | tostring)' "$PRIMARY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "provider status records command source" ".spec-first/config/graph-providers.json" "$(jq -r '.command_source' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "provider status records GitNexus host instruction normalization" "drift-detected:true:0" "$(jq -r '.host_instruction_normalization.status + ":" + (.host_instruction_normalization.advisory | tostring) + ":" + (.host_instruction_normalization.exit_code | tostring)' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "provider status records AGENTS dry-run host normalization" "would-normalize:true:false:single-repo" "$(jq -r '.host_instruction_normalization.results[] | select(.file=="AGENTS.md") | "\(.action):\(.wouldChange):\(.written):\(.gitRootTopology)"' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "provider status records CLAUDE dry-run host normalization" "would-normalize:true:false:single-repo" "$(jq -r '.host_instruction_normalization.results[] | select(.file=="CLAUDE.md") | "\(.action):\(.wouldChange):\(.written):\(.gitRootTopology)"' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "provider status records expected-hit query policy" "true:git-ls-files-code-basename:$GITNEXUS_QUERY_PROBE" "$(jq -r '.query_probe_policy | "\(.expected_hit):\(.source):\(.token)"' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "provider status records command timing" "true" "$(jq -r 'all(.command_results[]; (.started_at | type == "string") and (.finished_at | type == "string") and (.duration_ms | type == "number") and (.duration_ms >= 0))' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "provider status records provider timing" "true" "$(jq -r '(.timing.started_at | type == "string") and (.timing.finished_at | type == "string") and (.timing.duration_ms | type == "number") and (.timing.duration_ms >= 0)' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "final output records single repo timing" "true" "$(jq -r '(.timing.started_at | type == "string") and (.timing.finished_at | type == "string") and (.timing.duration_ms | type == "number") and (.timing.duration_ms >= 0)' <<<"$primary_output")"
assert_eq "GitNexus provider records version-safe reuse facts" "graph-bootstrap-fingerprint.v1:true:pinned:cold-run:$GITNEXUS_PACKAGE:$GITNEXUS_PACKAGE" "$(jq -r '.bootstrap_fingerprint.schema_version + ":" + (.reuse_eligible | tostring) + ":" + .bootstrap_fingerprint.provider.version_policy + ":" + .readiness_source + ":" + (.bootstrap_fingerprint.provider.configured_package_spec // "") + ":" + (.bootstrap_fingerprint.provider.bundled_package_spec // "")' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert "code-review-graph provider status is not written" test ! -e "$PRIMARY_REPO/.spec-first/providers/code-review-graph/status.json"
primary_head="$(git -C "$PRIMARY_REPO" rev-parse HEAD)"
assert_eq "full bootstrap records refresh mode and clean marker" "full:false:$primary_head:false" "$(jq -r '"\(.refresh_mode):\(.fallback_from_incremental):\(.last_indexed_commit):\(.requires_clean_full_refresh)"' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "graph facts does not add refresh-mode convenience fields" "false:false:false" "$(jq -r '[has("refresh_mode"), has("refresh_modes_by_provider"), has("refresh_mode_summary")] | map(tostring) | join(":")' "$PRIMARY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "bootstrap fingerprint includes invalidation hashes" "true" "$(jq -r '(.bootstrap_fingerprint.repo_snapshot.worktree_status_hash | startswith("sha256:")) and (.bootstrap_fingerprint.spec_first.graph_bootstrap_script_hash | startswith("sha256:")) and (.bootstrap_fingerprint.spec_first.mcp_tools_hash | startswith("sha256:")) and (.bootstrap_fingerprint.provider_projection.graph_providers_hash | startswith("sha256:")) and (.bootstrap_fingerprint.provider.command_hash | startswith("sha256:"))' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "graph-bootstrap does not mutate provider config input" "$primary_provider_config_before" "$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/graph-providers.json")"
assert_eq "graph-bootstrap does not mutate runtime capabilities input" "$primary_runtime_capabilities_before" "$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/runtime-capabilities.json")"

CANDIDATE_ONLY_REPO="$TMP_DIR/candidate-only-repo"
CANDIDATE_ONLY_LEDGER="$TMP_DIR/candidate-only-home/.codex/spec-first/host-setup.json"
make_repo "$CANDIDATE_ONLY_REPO"
write_fixture_config "$CANDIDATE_ONLY_REPO" "$CANDIDATE_ONLY_LEDGER" true
candidate_only_output="$(cd "$CANDIDATE_ONLY_REPO" && PATH="$TEST_PATH" GITNEXUS_IMPACT_NO_TESTS=1 bash "$BOOTSTRAP_SCRIPT")"
assert "candidate-only output is JSON" jq -e . <<<"$candidate_only_output"
assert_eq "candidate-only graph facts keep impact context limited" "true:false:limited:related_tests_unverified" "$(jq -r '(.capabilities.query_global_graph | tostring) + ":" + (.capabilities.impact_context | tostring) + ":" + .capabilities.impact_context_status + ":" + (.capabilities.impact_context_limitations | join(","))' "$CANDIDATE_ONLY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "candidate-only provider status records unproven related tests" "candidate-only:.spec-first/providers/gitnexus/raw/impact.log:true:related-tests-unproven" "$(jq -r '.review_support.related_tests_status + ":" + .review_support.impact_probe_raw_log + ":" + ((.review_support.limitations | index("related_tests_unverified")) != null | tostring) + ":" + ([.command_results[] | select(.kind=="impact_probe")][0].result_class // "")' "$CANDIDATE_ONLY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "candidate-only normalized impact artifact records limitation" "candidate-only:medium:true" "$(jq -r '.related_tests + ":" + .confidence + ":" + ((.limitations | index("related_tests_unverified")) != null | tostring)' "$CANDIDATE_ONLY_REPO/.spec-first/providers/gitnexus/normalized/impact-capabilities.json")"
assert_eq "candidate-only bootstrap impact capabilities remain partial" "partial:candidate-only:true" "$(jq -r '.capabilities.review_support.support_level + ":" + .capabilities.review_support.related_tests_status + ":" + ((.capabilities.review_support.limitations | index("related_tests_unverified")) != null | tostring)' "$CANDIDATE_ONLY_REPO/.spec-first/impact/bootstrap-impact-capabilities.json")"

NON_GIT_BOOTSTRAP_WORKSPACE="$TMP_DIR/non-git-bootstrap-workspace"
NON_GIT_BOOTSTRAP_FOLDER="$NON_GIT_BOOTSTRAP_WORKSPACE/plain-folder"
NON_GIT_BOOTSTRAP_LEDGER="$TMP_DIR/non-git-bootstrap-home/.codex/spec-first/host-setup.json"
mkdir -p "$NON_GIT_BOOTSTRAP_FOLDER/src"
printf 'export class PlainFolderBootstrap {}\n' > "$NON_GIT_BOOTSTRAP_FOLDER/src/PlainFolderBootstrap.ts"
write_folder_fixture_config "$NON_GIT_BOOTSTRAP_FOLDER" "$NON_GIT_BOOTSTRAP_LEDGER"
before_non_git_uvx_count="$(grep -cF "uvx " "$COMMAND_LOG" || true)"
non_git_bootstrap_output="$(cd "$NON_GIT_BOOTSTRAP_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --folder plain-folder)"
assert "non-git folder bootstrap emits JSON" jq -e . <<<"$non_git_bootstrap_output"
assert_eq "non-git folder bootstrap remains primary with explicit target" "primary:non-git-folder:explicit-folder" "$(jq -r '.workflow_mode + ":" + .target_kind + ":" + .selection_source' <<<"$non_git_bootstrap_output")"
assert_eq "non-git folder bootstrap only runs GitNexus provider" "gitnexus" "$(jq -r '[.results[].provider] | sort | join(",")' <<<"$non_git_bootstrap_output")"
assert_contains "non-git folder bootstrap invokes GitNexus with skip-git" "npx -y $GITNEXUS_PACKAGE analyze --skip-git --force --skip-agents-md --no-stats" "$(cat "$COMMAND_LOG")"
assert_eq "non-git folder bootstrap does not run uvx providers" "$before_non_git_uvx_count" "$(grep -cF "uvx " "$COMMAND_LOG" || true)"
assert_eq "non-git folder result omits fake Git metadata" "null|null|null|null|false" "$(jq -r '.source_revision as $sr | .worktree_dirty as $wd | .worktree_status_hash as $wh | (.results[] | select(.provider=="gitnexus") | .last_indexed_commit) as $lic | [$sr,$wd,$wh,$lic,.source_revision_dirty] | map(tostring) | join("|")' <<<"$non_git_bootstrap_output")"
assert_eq "non-git folder status has fingerprint and Git-only limitations" "true:true" "$(jq -r '(.folder_snapshot.content_fingerprint | startswith("sha256:") | tostring) + ":" + ((.limitations | join(" ")) | contains("no source_revision") and contains("no incremental") | tostring)' "$NON_GIT_BOOTSTRAP_FOLDER/.spec-first/graph/graph-facts.json")"
assert_eq "non-git folder impact support disables Git diff review impact" "none:unavailable:true" "$(jq -r '.capabilities.review_support.support_level + ":" + .capabilities.review_support.related_tests_status + ":" + ((.capabilities.review_support.limitations | index("non_git_folder_no_git_diff")) != null | tostring)' "$NON_GIT_BOOTSTRAP_FOLDER/.spec-first/impact/bootstrap-impact-capabilities.json")"
NON_GIT_DEFINITIONS_FOLDER="$NON_GIT_BOOTSTRAP_WORKSPACE/docs-folder"
NON_GIT_DEFINITIONS_LEDGER="$TMP_DIR/non-git-definitions-home/.codex/spec-first/host-setup.json"
mkdir -p "$NON_GIT_DEFINITIONS_FOLDER"
printf '# Docs only\n' > "$NON_GIT_DEFINITIONS_FOLDER/README.md"
write_folder_fixture_config "$NON_GIT_DEFINITIONS_FOLDER" "$NON_GIT_DEFINITIONS_LEDGER"
non_git_definitions_output="$(cd "$NON_GIT_BOOTSTRAP_WORKSPACE" && PATH="$TEST_PATH" GITNEXUS_QUERY_DEFINITIONS_ONLY=1 bash "$BOOTSTRAP_SCRIPT" --folder docs-folder)"
assert_eq "non-git folder definitions-only query is ready" "primary:ready:true:definitions-only" "$(jq -r '.workflow_mode as $mode | .results[] | select(.provider=="gitnexus") | "\($mode):\(.status):\(.query_ready):\(.query_probe_attempts[0].result_class)"' <<<"$non_git_definitions_output")"
assert_contains "non-git folder definitions-only limitation is explicit" "Definitions-only GitNexus evidence accepted" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$non_git_definitions_output")"
assert_eq "non-git folder definitions-only normalized architecture does not claim execution flow" "false:true" "$(jq -r '((.capabilities | index("execution_flow")) != null | tostring) + ":" + ((.limitations | index("non_git_folder_no_process_graph")) != null | tostring)' "$NON_GIT_DEFINITIONS_FOLDER/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"
assert_eq "non-git folder definitions-only normalized impact stays query-only" "query,context|0|unavailable|unavailable|true" "$(jq -r '(.available_query_surfaces | join(",")) + "|" + (.impact_evidence_surfaces | length | tostring) + "|" + .review_support.support_level + "|" + .review_support.related_tests + "|" + ((.limitations | index("non_git_folder_no_git_diff")) != null | tostring)' "$NON_GIT_DEFINITIONS_FOLDER/.spec-first/providers/gitnexus/normalized/impact-capabilities.json")"
assert_eq "non-git folder definitions-only graph facts do not expose impact context" "true|false|unavailable|true" "$(jq -r '(.capabilities.query_global_graph | tostring) + "|" + (.capabilities.impact_context | tostring) + "|" + .capabilities.impact_context_status + "|" + ((.capabilities.impact_context_limitations | index("non_git_folder_no_git_diff")) != null | tostring)' "$NON_GIT_DEFINITIONS_FOLDER/.spec-first/graph/graph-facts.json")"
assert_eq "non-git folder definitions-only aggregate impact stays unavailable" "full:gitnexus|none:0:true|none:0:unavailable:true" "$(jq -r '.capabilities.context_selection.support_level + ":" + (.capabilities.context_selection.primary_providers | join(",")) + "|" + .capabilities.impact_radius.support_level + ":" + (.capabilities.impact_radius.primary_providers | length | tostring) + ":" + ((.capabilities.impact_radius.limitations | index("non_git_folder_no_git_diff")) != null | tostring) + "|" + .capabilities.review_support.support_level + ":" + (.capabilities.review_support.primary_providers | length | tostring) + ":" + .capabilities.review_support.related_tests_status + ":" + ((.capabilities.review_support.limitations | index("non_git_folder_no_git_diff")) != null | tostring)' "$NON_GIT_DEFINITIONS_FOLDER/.spec-first/impact/bootstrap-impact-capabilities.json")"
non_git_targets_output="$(cd "$NON_GIT_BOOTSTRAP_WORKSPACE" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER" --folder plain-folder)"
assert_eq "workspace target resolver exposes explicit non-git folder row" "non-git-folder|null|fresh-primary|true" "$(jq -r '.repos[0] | .target_kind + "|" + (.git.current_revision | tostring) + "|" + .query_usability + "|" + (.non_git_support.query_context_architecture | tostring)' <<<"$non_git_targets_output")"
assert_contains "workspace target resolver records non-git limitation" "no Git diff evidence" "$(jq -r '.repos[0].git_only_limitations | join(" ")' <<<"$non_git_targets_output")"
before_non_git_incremental_log="$(cat "$COMMAND_LOG")"
set +e
non_git_incremental_output="$(cd "$NON_GIT_BOOTSTRAP_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --folder plain-folder --incremental)"
non_git_incremental_status=$?
set -e
assert_eq "non-git folder incremental is unsupported" "1" "$non_git_incremental_status"
assert_eq "non-git folder incremental reason is explicit" "blocked:incremental-non-git-folder-unsupported:true" "$(jq -r '.workflow_mode + ":" + .reason_code + ":" + (.canonical_artifacts_preserved | tostring)' <<<"$non_git_incremental_output")"
assert_eq "non-git folder incremental does not run provider commands" "$before_non_git_incremental_log" "$(cat "$COMMAND_LOG")"

CONCURRENT_HOST_REPO="$TMP_DIR/concurrent-host-repo"
CONCURRENT_HOST_LEDGER="$TMP_DIR/concurrent-host-home/.codex/spec-first/host-setup.json"
make_repo "$CONCURRENT_HOST_REPO"
write_fixture_config "$CONCURRENT_HOST_REPO" "$CONCURRENT_HOST_LEDGER" true
set +e
concurrent_output="$(cd "$CONCURRENT_HOST_REPO" && PATH="$TEST_PATH" MUTATE_AGENTS_DURING_GITNEXUS_STATUS=1 bash "$BOOTSTRAP_SCRIPT")"
concurrent_status=$?
set -e
assert_eq "graph-bootstrap catches concurrent AGENTS edits after bootstrap-owned normalization" "1" "$concurrent_status"
assert_eq "graph-bootstrap reports concurrent host instruction edit" "blocked:concurrent-write-detected:false" "$(jq -r '.workflow_mode + ":" + .reason_code + ":" + (.canonical_artifacts_preserved | tostring)' <<<"$concurrent_output")"

MISSING_HOST_REPO="$TMP_DIR/missing-host-repo"
MISSING_HOST_LEDGER="$TMP_DIR/missing-host-home/.codex/spec-first/host-setup.json"
make_repo "$MISSING_HOST_REPO"
write_fixture_config "$MISSING_HOST_REPO" "$MISSING_HOST_LEDGER" true
printf '# Host\n' > "$MISSING_HOST_REPO/AGENTS.md"
printf '# Host\n' > "$MISSING_HOST_REPO/CLAUDE.md"
git -C "$MISSING_HOST_REPO" add AGENTS.md CLAUDE.md
git -C "$MISSING_HOST_REPO" commit -q -m "Add host files"
missing_host_output="$(cd "$MISSING_HOST_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "missing GitNexus host block does not block graph readiness" "primary:ready" "$(jq -r '.workflow_mode + ":" + .overall_status' <<<"$missing_host_output")"
assert_eq "missing GitNexus host block is created as advisory drift detection" "drift-detected:true:0" "$(jq -r '.results[] | select(.provider=="gitnexus") | .host_instruction_normalization | .status + ":" + (.advisory | tostring) + ":" + (.exit_code | tostring)' <<<"$missing_host_output")"
assert_eq "missing GitNexus host block records AGENTS dry-run creation" "would-create:true:false:single-repo" "$(jq -r '.results[] | select(.provider=="gitnexus") | .host_instruction_normalization.results[] | select(.file=="AGENTS.md") | "\(.action):\(.wouldChange):\(.written):\(.gitRootTopology)"' <<<"$missing_host_output")"
assert_eq "missing GitNexus host block records CLAUDE dry-run creation" "would-create:true:false:single-repo" "$(jq -r '.results[] | select(.provider=="gitnexus") | .host_instruction_normalization.results[] | select(.file=="CLAUDE.md") | "\(.action):\(.wouldChange):\(.written):\(.gitRootTopology)"' <<<"$missing_host_output")"
assert_eq "graph-bootstrap leaves missing AGENTS host file for init to refresh" "# Host" "$(cat "$MISSING_HOST_REPO/AGENTS.md")"
assert_eq "graph-bootstrap leaves missing CLAUDE host file for init to refresh" "# Host" "$(cat "$MISSING_HOST_REPO/CLAUDE.md")"

PARTIAL_HOST_REPO="$TMP_DIR/partial-host-repo"
PARTIAL_HOST_LEDGER="$TMP_DIR/partial-host-home/.codex/spec-first/host-setup.json"
make_repo "$PARTIAL_HOST_REPO"
write_fixture_config "$PARTIAL_HOST_REPO" "$PARTIAL_HOST_LEDGER" true
cat > "$PARTIAL_HOST_REPO/AGENTS.md" <<'MD'
<!-- gitnexus:start -->
# GitNexus — Code Intelligence
MD
git -C "$PARTIAL_HOST_REPO" add AGENTS.md
git -C "$PARTIAL_HOST_REPO" commit -q -m "Add partial host block"
partial_host_output="$(cd "$PARTIAL_HOST_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "partial GitNexus host block does not block graph readiness" "primary:ready" "$(jq -r '.workflow_mode + ":" + .overall_status' <<<"$partial_host_output")"
assert_eq "partial GitNexus host block is recorded as advisory failure" "failed:true:gitnexus-instruction-block-partial:3" "$(jq -r '.results[] | select(.provider=="gitnexus") | .host_instruction_normalization | .status + ":" + (.advisory | tostring) + ":" + (.reason_code // "") + ":" + (.exit_code | tostring)' <<<"$partial_host_output")"

BAD_CLI_REPO="$TMP_DIR/bad-cli-repo"
BAD_CLI_LEDGER="$TMP_DIR/bad-cli-home/.codex/spec-first/host-setup.json"
make_repo "$BAD_CLI_REPO"
write_fixture_config "$BAD_CLI_REPO" "$BAD_CLI_LEDGER" true
bad_cli_output="$(cd "$BAD_CLI_REPO" && PATH="$TEST_PATH" SPEC_FIRST_CLI="$TMP_DIR/missing-spec-first-cli" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "missing SPEC_FIRST_CLI does not block graph readiness" "primary:ready" "$(jq -r '.workflow_mode + ":" + .overall_status' <<<"$bad_cli_output")"
assert_eq "missing SPEC_FIRST_CLI is recorded as advisory failure" "failed:true:gitnexus-instruction-normalizer-failed:127" "$(jq -r '.results[] | select(.provider=="gitnexus") | .host_instruction_normalization | .status + ":" + (.advisory | tostring) + ":" + (.reason_code // "") + ":" + (.exit_code | tostring)' <<<"$bad_cli_output")"

TIMEOUT_CLI_REPO="$TMP_DIR/timeout-cli-repo"
TIMEOUT_CLI_LEDGER="$TMP_DIR/timeout-cli-home/.codex/spec-first/host-setup.json"
TIMEOUT_CLI="$TMP_DIR/slow-spec-first-cli"
make_repo "$TIMEOUT_CLI_REPO"
write_fixture_config "$TIMEOUT_CLI_REPO" "$TIMEOUT_CLI_LEDGER" true
cat > "$TIMEOUT_CLI" <<'SH'
#!/bin/bash
sleep 5
SH
chmod +x "$TIMEOUT_CLI"
timeout_cli_output="$(cd "$TIMEOUT_CLI_REPO" && PATH="$TEST_PATH" SPEC_FIRST_PROVIDER_COMMAND_TIMEOUT_SECONDS=1 SPEC_FIRST_CLI="$TIMEOUT_CLI" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "timed out SPEC_FIRST_CLI does not block graph readiness" "primary:ready" "$(jq -r '.workflow_mode + ":" + .overall_status' <<<"$timeout_cli_output")"
assert_eq "timed out SPEC_FIRST_CLI is recorded as advisory timeout" "failed:true:gitnexus-instruction-normalizer-timeout:124" "$(jq -r '.results[] | select(.provider=="gitnexus") | .host_instruction_normalization | .status + ":" + (.advisory | tostring) + ":" + (.reason_code // "") + ":" + (.exit_code | tostring)' <<<"$timeout_cli_output")"

CLEAN_GRAPH_REPO="$TMP_DIR/clean-graph-repo"
CLEAN_GRAPH_LEDGER="$TMP_DIR/clean-graph-home/.codex/spec-first/host-setup.json"
make_repo "$CLEAN_GRAPH_REPO"
write_fixture_config "$CLEAN_GRAPH_REPO" "$CLEAN_GRAPH_LEDGER" true
clean_graph_output="$(cd "$CLEAN_GRAPH_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "clean graph bootstrap is primary" "primary" "$(jq -r '.workflow_mode' <<<"$clean_graph_output")"
clean_graph_targets="$(cd "$CLEAN_GRAPH_REPO" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "single repo graph target resolver reports supported impact context" "primary:true:true" "$(jq -r '.repos[0] | .status + ":" + (.capabilities.query_global_graph | tostring) + ":" + (.capabilities.impact_context | tostring)' <<<"$clean_graph_targets")"
printf 'changed\n' >> "$CLEAN_GRAPH_REPO/README.md"
git -C "$CLEAN_GRAPH_REPO" add README.md
git -C "$CLEAN_GRAPH_REPO" commit -q -m "Change source revision"
stale_graph_targets="$(cd "$CLEAN_GRAPH_REPO" && PATH="$TEST_PATH" bash "$WORKSPACE_TARGET_RESOLVER")"
assert_eq "source revision mismatch marks stale" "stale:true:false" "$(jq -r '.repos[0] | .status + ":" + (.freshness.stale | tostring) + ":" + (.freshness.source_revision_matches | tostring)' <<<"$stale_graph_targets")"

write_spec_first_managed_host_file() {
  local path="$1"
  cat > "$path" <<'MD'
# Host Entry

user-owned line

<!-- spec-first:bootstrap:start -->
managed line
<!-- spec-first:bootstrap:end -->
MD
}

write_spec_first_managed_only_host_file() {
  local path="$1"
  cat > "$path" <<'MD'
<!-- spec-first:lang:start -->
language block
<!-- spec-first:lang:end -->

<!-- spec-first:bootstrap:start -->
bootstrap block
<!-- spec-first:bootstrap:end -->

<!-- spec-first:coding-guidelines:start -->
coding block
<!-- spec-first:coding-guidelines:end -->
MD
}

write_spec_first_managed_gitignore() {
  local path="$1"
  cat > "$path" <<'TXT'
node_modules/

# spec-first:start
.spec-first/
.gitnexus/
.code-review-graph/
# spec-first:end
TXT
}

SETUP_DIRTY_REPO="$TMP_DIR/setup-dirty-repo"
SETUP_DIRTY_LEDGER="$TMP_DIR/setup-dirty-home/.codex/spec-first/host-setup.json"
make_repo "$SETUP_DIRTY_REPO"
write_fixture_config "$SETUP_DIRTY_REPO" "$SETUP_DIRTY_LEDGER" true
write_spec_first_managed_host_file "$SETUP_DIRTY_REPO/AGENTS.md"
write_spec_first_managed_gitignore "$SETUP_DIRTY_REPO/.gitignore"
git -C "$SETUP_DIRTY_REPO" add AGENTS.md .gitignore
git -C "$SETUP_DIRTY_REPO" commit -q -m "Add setup-owned files"
awk '{print} /managed line/ {print "managed dirty line"}' "$SETUP_DIRTY_REPO/AGENTS.md" > "$SETUP_DIRTY_REPO/AGENTS.md.tmp"
mv "$SETUP_DIRTY_REPO/AGENTS.md.tmp" "$SETUP_DIRTY_REPO/AGENTS.md"
awk '{print} /\.code-review-graph\// {print ".agents/skills/"}' "$SETUP_DIRTY_REPO/.gitignore" > "$SETUP_DIRTY_REPO/.gitignore.tmp"
mv "$SETUP_DIRTY_REPO/.gitignore.tmp" "$SETUP_DIRTY_REPO/.gitignore"
set +e
setup_dirty_output="$(cd "$SETUP_DIRTY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
setup_dirty_status=$?
set -e
assert_eq "setup-owned dirty exits successfully" "0" "$setup_dirty_status"
assert_eq "setup-owned dirty does not block bootstrap" "primary:setup-owned-only:true" "$(jq -r '.workflow_mode + ":" + .dirty_classification + ":" + (.dirty_paths_breakdown.setup_owned_count > 0 | tostring)' <<<"$setup_dirty_output")"
assert_eq "setup-owned dirty graph facts are written" "setup-owned-only:true:true" "$(jq -r '.dirty_classification + ":" + (.worktree_dirty | tostring) + ":" + (.dirty_paths_breakdown.setup_owned_count > 0 | tostring)' "$SETUP_DIRTY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "setup-owned dirty is not written to provider status aggregate" "false" "$(jq -r 'has("dirty_classification")' "$SETUP_DIRTY_REPO/.spec-first/graph/provider-status.json")"

NON_GRAPH_METADATA_REPO="$TMP_DIR/non-graph-metadata-repo"
NON_GRAPH_METADATA_LEDGER="$TMP_DIR/non-graph-metadata-home/.codex/spec-first/host-setup.json"
make_repo "$NON_GRAPH_METADATA_REPO"
write_fixture_config "$NON_GRAPH_METADATA_REPO" "$NON_GRAPH_METADATA_LEDGER" true
mkdir -p "$NON_GRAPH_METADATA_REPO/docs"
printf '# Changelog\n' > "$NON_GRAPH_METADATA_REPO/CHANGELOG.md"
printf '# 变更日志\n' > "$NON_GRAPH_METADATA_REPO/docs/变更日志.md"
git -C "$NON_GRAPH_METADATA_REPO" add CHANGELOG.md docs/变更日志.md
git -C "$NON_GRAPH_METADATA_REPO" commit -q -m "Add changelog metadata"
printf 'root changelog metadata dirty\n' >> "$NON_GRAPH_METADATA_REPO/CHANGELOG.md"
printf 'localized changelog metadata dirty\n' >> "$NON_GRAPH_METADATA_REPO/docs/变更日志.md"
non_graph_metadata_output="$(cd "$NON_GRAPH_METADATA_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "non-graph metadata dirty exits successfully" "0" "$?"
assert_eq "non-graph metadata dirty does not block bootstrap" "primary:non-graph-only:2:0" "$(jq -r '.workflow_mode + ":" + .dirty_classification + ":" + (.dirty_paths_breakdown.non_graph_metadata_count | tostring) + ":" + (.dirty_paths_breakdown.graph_affecting_count | tostring)' <<<"$non_graph_metadata_output")"
assert_eq "non-graph metadata dirty graph facts are written" "non-graph-only:true:2" "$(jq -r '.dirty_classification + ":" + (.worktree_dirty | tostring) + ":" + (.dirty_paths_breakdown.non_graph_metadata_count | tostring)' "$NON_GRAPH_METADATA_REPO/.spec-first/graph/graph-facts.json")"

UNTRACKED_HOST_SEPARATOR_REPO="$TMP_DIR/untracked-host-separator-repo"
UNTRACKED_HOST_SEPARATOR_LEDGER="$TMP_DIR/untracked-host-separator-home/.codex/spec-first/host-setup.json"
make_repo "$UNTRACKED_HOST_SEPARATOR_REPO"
write_fixture_config "$UNTRACKED_HOST_SEPARATOR_REPO" "$UNTRACKED_HOST_SEPARATOR_LEDGER" true
write_spec_first_managed_only_host_file "$UNTRACKED_HOST_SEPARATOR_REPO/AGENTS.md"
untracked_host_separator_output="$(cd "$UNTRACKED_HOST_SEPARATOR_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "untracked managed-only host entry permits blank separators" "primary:setup-owned-only" "$(jq -r '.workflow_mode + ":" + .dirty_classification' <<<"$untracked_host_separator_output")"

HOST_OUTSIDE_DIRTY_REPO="$TMP_DIR/host-outside-dirty-repo"
HOST_OUTSIDE_DIRTY_LEDGER="$TMP_DIR/host-outside-dirty-home/.codex/spec-first/host-setup.json"
make_repo "$HOST_OUTSIDE_DIRTY_REPO"
write_fixture_config "$HOST_OUTSIDE_DIRTY_REPO" "$HOST_OUTSIDE_DIRTY_LEDGER" true
write_spec_first_managed_host_file "$HOST_OUTSIDE_DIRTY_REPO/AGENTS.md"
git -C "$HOST_OUTSIDE_DIRTY_REPO" add AGENTS.md
git -C "$HOST_OUTSIDE_DIRTY_REPO" commit -q -m "Add host entry"
before_host_outside_log="$(cat "$COMMAND_LOG")"
printf 'user outside dirty\n' >> "$HOST_OUTSIDE_DIRTY_REPO/AGENTS.md"
set +e
host_outside_dirty_output="$(cd "$HOST_OUTSIDE_DIRTY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
host_outside_dirty_status=$?
set -e
assert_eq "host entry outside managed block is graph-affecting" "0" "$host_outside_dirty_status"
assert_eq "host entry outside managed block uses dirty-advisory" "primary:ready-dirty-advisory:graph-affecting-blocked" "$(jq -r '.workflow_mode + ":" + .overall_status + ":" + .dirty_classification' <<<"$host_outside_dirty_output")"
assert_eq "host entry outside managed block runs providers" "true" "$([ "$(cat "$COMMAND_LOG")" != "$before_host_outside_log" ] && echo true || echo false)"

UNICODE_SETUP_DIRTY_REPO="$TMP_DIR/unicode-setup-dirty-repo"
UNICODE_SETUP_DIRTY_LEDGER="$TMP_DIR/unicode-setup-dirty-home/.codex/spec-first/host-setup.json"
make_repo "$UNICODE_SETUP_DIRTY_REPO"
write_fixture_config "$UNICODE_SETUP_DIRTY_REPO" "$UNICODE_SETUP_DIRTY_LEDGER" true
mkdir -p "$UNICODE_SETUP_DIRTY_REPO/.codex/spec-first"
printf 'tracked runtime root\n' > "$UNICODE_SETUP_DIRTY_REPO/.codex/spec-first/.keep"
git -C "$UNICODE_SETUP_DIRTY_REPO" add .codex/spec-first/.keep
git -C "$UNICODE_SETUP_DIRTY_REPO" commit -q -m "Track codex runtime root"
mkdir -p "$UNICODE_SETUP_DIRTY_REPO/.codex/spec-first/带 空格"
printf 'unicode setup dirty\n' > "$UNICODE_SETUP_DIRTY_REPO/.codex/spec-first/带 空格/中文.md"
unicode_setup_dirty_output="$(cd "$UNICODE_SETUP_DIRTY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "space and unicode setup-owned path is parsed from porcelain v2 z" "primary:setup-owned-only" "$(jq -r '.workflow_mode + ":" + .dirty_classification' <<<"$unicode_setup_dirty_output")"

GITIGNORE_OUTSIDE_DIRTY_REPO="$TMP_DIR/gitignore-outside-dirty-repo"
GITIGNORE_OUTSIDE_DIRTY_LEDGER="$TMP_DIR/gitignore-outside-dirty-home/.codex/spec-first/host-setup.json"
make_repo "$GITIGNORE_OUTSIDE_DIRTY_REPO"
write_fixture_config "$GITIGNORE_OUTSIDE_DIRTY_REPO" "$GITIGNORE_OUTSIDE_DIRTY_LEDGER" true
write_spec_first_managed_gitignore "$GITIGNORE_OUTSIDE_DIRTY_REPO/.gitignore"
git -C "$GITIGNORE_OUTSIDE_DIRTY_REPO" add .gitignore
git -C "$GITIGNORE_OUTSIDE_DIRTY_REPO" commit -q -m "Add managed gitignore"
printf 'user-ignore\n' >> "$GITIGNORE_OUTSIDE_DIRTY_REPO/.gitignore"
set +e
gitignore_outside_dirty_output="$(cd "$GITIGNORE_OUTSIDE_DIRTY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
gitignore_outside_dirty_status=$?
set -e
assert_eq ".gitignore outside managed block is graph-affecting" "0:graph-affecting-blocked" "$gitignore_outside_dirty_status:$(jq -r '.dirty_classification' <<<"$gitignore_outside_dirty_output")"

UNTRACKED_GITIGNORE_REPO="$TMP_DIR/untracked-gitignore-repo"
UNTRACKED_GITIGNORE_LEDGER="$TMP_DIR/untracked-gitignore-home/.codex/spec-first/host-setup.json"
make_repo "$UNTRACKED_GITIGNORE_REPO"
write_fixture_config "$UNTRACKED_GITIGNORE_REPO" "$UNTRACKED_GITIGNORE_LEDGER" true
git -C "$UNTRACKED_GITIGNORE_REPO" rm -q .gitignore
git -C "$UNTRACKED_GITIGNORE_REPO" commit -q -m "Remove gitignore"
cat > "$UNTRACKED_GITIGNORE_REPO/.gitignore" <<'TXT'
# spec-first:start
.spec-first/
# spec-first:end
TXT
untracked_gitignore_output="$(cd "$UNTRACKED_GITIGNORE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "untracked managed-only .gitignore is setup-owned" "primary:setup-owned-only" "$(jq -r '.workflow_mode + ":" + .dirty_classification' <<<"$untracked_gitignore_output")"
cat > "$UNTRACKED_GITIGNORE_REPO/.gitignore" <<'TXT'
user-rule
# spec-first:start
.spec-first/
# spec-first:end
TXT
set +e
untracked_gitignore_user_output="$(cd "$UNTRACKED_GITIGNORE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
untracked_gitignore_user_status=$?
set -e
assert_eq "untracked .gitignore with user region is graph-affecting" "0:graph-affecting-blocked" "$untracked_gitignore_user_status:$(jq -r '.dirty_classification' <<<"$untracked_gitignore_user_output")"
cat > "$UNTRACKED_GITIGNORE_REPO/.gitignore" <<'TXT'
# spec-first:start
.spec-first/
TXT
set +e
untracked_gitignore_bad_marker_output="$(cd "$UNTRACKED_GITIGNORE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
untracked_gitignore_bad_marker_status=$?
set -e
assert_eq "untracked .gitignore with malformed marker is graph-affecting" "0:graph-affecting-blocked" "$untracked_gitignore_bad_marker_status:$(jq -r '.dirty_classification' <<<"$untracked_gitignore_bad_marker_output")"

MM_GITIGNORE_REPO="$TMP_DIR/mm-gitignore-repo"
MM_GITIGNORE_LEDGER="$TMP_DIR/mm-gitignore-home/.codex/spec-first/host-setup.json"
make_repo "$MM_GITIGNORE_REPO"
write_fixture_config "$MM_GITIGNORE_REPO" "$MM_GITIGNORE_LEDGER" true
write_spec_first_managed_gitignore "$MM_GITIGNORE_REPO/.gitignore"
git -C "$MM_GITIGNORE_REPO" add .gitignore
git -C "$MM_GITIGNORE_REPO" commit -q -m "Add managed gitignore"
awk '{print} /\.code-review-graph\// {print ".agents/skills/"}' "$MM_GITIGNORE_REPO/.gitignore" > "$MM_GITIGNORE_REPO/.gitignore.tmp"
mv "$MM_GITIGNORE_REPO/.gitignore.tmp" "$MM_GITIGNORE_REPO/.gitignore"
git -C "$MM_GITIGNORE_REPO" add .gitignore
printf 'user-mm-rule\n' >> "$MM_GITIGNORE_REPO/.gitignore"
set +e
mm_gitignore_output="$(cd "$MM_GITIGNORE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
mm_gitignore_status=$?
set -e
assert_eq "staged managed plus unstaged user .gitignore dirty is graph-affecting" "0:graph-affecting-blocked" "$mm_gitignore_status:$(jq -r '.dirty_classification' <<<"$mm_gitignore_output")"

MARKER_CREATE_DELETE_REPO="$TMP_DIR/marker-create-delete-repo"
MARKER_CREATE_DELETE_LEDGER="$TMP_DIR/marker-create-delete-home/.codex/spec-first/host-setup.json"
make_repo "$MARKER_CREATE_DELETE_REPO"
write_fixture_config "$MARKER_CREATE_DELETE_REPO" "$MARKER_CREATE_DELETE_LEDGER" true
printf 'user-rule\n' > "$MARKER_CREATE_DELETE_REPO/.gitignore"
git -C "$MARKER_CREATE_DELETE_REPO" add .gitignore
git -C "$MARKER_CREATE_DELETE_REPO" commit -q -m "Reset gitignore"
cat >> "$MARKER_CREATE_DELETE_REPO/.gitignore" <<'TXT'

# spec-first:start
.spec-first/
# spec-first:end
TXT
marker_create_output="$(cd "$MARKER_CREATE_DELETE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "marker creation block permits blank separator" "setup-owned-only" "$(jq -r '.dirty_classification' <<<"$marker_create_output")"
commit_repo_changes "$MARKER_CREATE_DELETE_REPO" "Commit marker block and normalized host files"
printf 'user-rule\n' > "$MARKER_CREATE_DELETE_REPO/.gitignore"
marker_delete_output="$(cd "$MARKER_CREATE_DELETE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "marker deletion block is setup-owned" "setup-owned-only" "$(jq -r '.dirty_classification' <<<"$marker_delete_output")"

FORGED_MARKER_REPO="$TMP_DIR/forged-marker-repo"
FORGED_MARKER_LEDGER="$TMP_DIR/forged-marker-home/.codex/spec-first/host-setup.json"
make_repo "$FORGED_MARKER_REPO"
write_fixture_config "$FORGED_MARKER_REPO" "$FORGED_MARKER_LEDGER" true
write_spec_first_managed_gitignore "$FORGED_MARKER_REPO/.gitignore"
git -C "$FORGED_MARKER_REPO" add .gitignore
git -C "$FORGED_MARKER_REPO" commit -q -m "Add managed gitignore"
cat >> "$FORGED_MARKER_REPO/.gitignore" <<'TXT'
# spec-first:start
forged-user-rule
# spec-first:end
TXT
set +e
forged_marker_output="$(cd "$FORGED_MARKER_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
forged_marker_status=$?
set -e
assert_eq "forged duplicate .gitignore markers are graph-affecting" "0:graph-affecting-blocked" "$forged_marker_status:$(jq -r '.dirty_classification' <<<"$forged_marker_output")"

RENAME_DIRTY_REPO="$TMP_DIR/rename-dirty-repo"
RENAME_DIRTY_LEDGER="$TMP_DIR/rename-dirty-home/.codex/spec-first/host-setup.json"
make_repo "$RENAME_DIRTY_REPO"
write_fixture_config "$RENAME_DIRTY_REPO" "$RENAME_DIRTY_LEDGER" true
mkdir -p "$RENAME_DIRTY_REPO/.spec-first" "$RENAME_DIRTY_REPO/src"
printf 'tracked setup\n' > "$RENAME_DIRTY_REPO/.spec-first/a.txt"
printf 'tracked source\n' > "$RENAME_DIRTY_REPO/src/foo.java"
git -C "$RENAME_DIRTY_REPO" add -f .spec-first/a.txt src/foo.java
git -C "$RENAME_DIRTY_REPO" commit -q -m "Add rename fixtures"
git -C "$RENAME_DIRTY_REPO" mv .spec-first/a.txt .spec-first/b.txt
rename_setup_output="$(cd "$RENAME_DIRTY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "rename within setup-owned boundary stays setup-owned" "setup-owned-only" "$(jq -r '.dirty_classification' <<<"$rename_setup_output")"
git -C "$RENAME_DIRTY_REPO" reset -q --hard HEAD
git -C "$RENAME_DIRTY_REPO" mv .spec-first/a.txt src/a.txt
set +e
rename_to_source_output="$(cd "$RENAME_DIRTY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
rename_to_source_status=$?
set -e
assert_eq "rename from setup-owned to source is graph-affecting" "0:graph-affecting-blocked" "$rename_to_source_status:$(jq -r '.dirty_classification' <<<"$rename_to_source_output")"
git -C "$RENAME_DIRTY_REPO" reset -q --hard HEAD
git -C "$RENAME_DIRTY_REPO" mv src/foo.java .spec-first/foo.java
set +e
rename_from_source_output="$(cd "$RENAME_DIRTY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
rename_from_source_status=$?
set -e
assert_eq "rename from source to setup-owned is graph-affecting" "0:graph-affecting-blocked" "$rename_from_source_status:$(jq -r '.dirty_classification' <<<"$rename_from_source_output")"

ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE="$TMP_DIR/all-repos-dirty-classification-workspace"
ALL_REPOS_DIRTY_CLASSIFICATION_LEDGER="$TMP_DIR/all-repos-dirty-classification-home/.codex/spec-first/host-setup.json"
make_repo "$ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE/project-a"
make_repo "$ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE/project-b"
write_fixture_config "$ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE/project-a" "$ALL_REPOS_DIRTY_CLASSIFICATION_LEDGER" true
write_fixture_config "$ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE/project-b" "$ALL_REPOS_DIRTY_CLASSIFICATION_LEDGER" true
printf 'non-graph metadata dirty\n' >> "$ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE/project-a/CHANGELOG.md"
printf 'source dirty\n' >> "$ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE/project-b/README.md"
set +e
all_repos_dirty_classification_output="$(cd "$ALL_REPOS_DIRTY_CLASSIFICATION_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --all-repos)"
all_repos_dirty_classification_status=$?
set -e
assert_eq "all-repos dirty classification summary is ready" "0:ready:non-graph-only:graph-affecting-blocked" "$all_repos_dirty_classification_status:$(jq -r '.overall_status + ":" + (.results[] | select(.workspace_relative_path=="project-a") | .dirty_classification) + ":" + (.results[] | select(.workspace_relative_path=="project-b") | .dirty_classification)' <<<"$all_repos_dirty_classification_output")"

DIRTY_REFRESH_REPO="$TMP_DIR/dirty-refresh-repo"
DIRTY_REFRESH_LEDGER="$TMP_DIR/dirty-refresh-home/.codex/spec-first/host-setup.json"
make_repo "$DIRTY_REFRESH_REPO"
write_fixture_config "$DIRTY_REFRESH_REPO" "$DIRTY_REFRESH_LEDGER" true
(cd "$DIRTY_REFRESH_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
commit_repo_changes "$DIRTY_REFRESH_REPO" "Commit normalized host files"
(cd "$DIRTY_REFRESH_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
dirty_gitnexus_status_before="$(jq -S -c . "$DIRTY_REFRESH_REPO/.spec-first/providers/gitnexus/status.json")"
dirty_aggregate_status_before="$(jq -S -c . "$DIRTY_REFRESH_REPO/.spec-first/graph/provider-status.json")"
dirty_graph_facts_before="$(jq -S -c . "$DIRTY_REFRESH_REPO/.spec-first/graph/graph-facts.json")"
dirty_bootstrap_report_before="$(cat "$DIRTY_REFRESH_REPO/.spec-first/graph/bootstrap-report.md")"
dirty_normalized_before="$(jq -S -c . "$DIRTY_REFRESH_REPO/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"
before_dirty_refresh_log="$(cat "$COMMAND_LOG")"
printf 'dirty refresh change\n' >> "$DIRTY_REFRESH_REPO/README.md"
for dirty_refresh_case in "default|" "incremental|--incremental" "full|--full" "force|--force"; do
  dirty_refresh_label="${dirty_refresh_case%%|*}"
  dirty_refresh_arg="${dirty_refresh_case#*|}"
  dirty_refresh_err="$TMP_DIR/dirty-refresh-${dirty_refresh_label}.err"
  set +e
  if [ -n "$dirty_refresh_arg" ]; then
    dirty_refresh_output="$(cd "$DIRTY_REFRESH_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" "$dirty_refresh_arg" 2>"$dirty_refresh_err")"
  else
    dirty_refresh_output="$(cd "$DIRTY_REFRESH_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" 2>"$dirty_refresh_err")"
  fi
  dirty_refresh_status=$?
  set -e
  assert_eq "dirty $dirty_refresh_label refresh continues with warn-and-continue" "0" "$dirty_refresh_status"
  assert_eq "dirty $dirty_refresh_label refresh writes dirty-advisory" "ready-dirty-advisory:graph-affecting-blocked:dirty-advisory" "$(jq -r '.overall_status + ":" + .dirty_classification + ":" + .freshness_state' <<<"$dirty_refresh_output")"
  assert_eq "dirty $dirty_refresh_label refresh reports graph-affecting count" "true" "$(jq -r '.dirty_paths_breakdown.graph_affecting_count > 0' <<<"$dirty_refresh_output")"
  assert_contains "dirty $dirty_refresh_label refresh warning includes sample path" "  dirty: README.md" "$(cat "$dirty_refresh_err")"
  assert_eq "dirty $dirty_refresh_label refresh runs provider commands" "true" "$([ "$(cat "$COMMAND_LOG")" != "$before_dirty_refresh_log" ] && echo true || echo false)"
done

if command -v pwsh >/dev/null 2>&1; then
  DIRTY_REFRESH_PS_REPO="$TMP_DIR/dirty-refresh-ps-repo"
  DIRTY_REFRESH_PS_LEDGER="$TMP_DIR/dirty-refresh-ps-home/.codex/spec-first/host-setup.json"
  make_repo "$DIRTY_REFRESH_PS_REPO"
  write_fixture_config "$DIRTY_REFRESH_PS_REPO" "$DIRTY_REFRESH_PS_LEDGER" true
  (cd "$DIRTY_REFRESH_PS_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  commit_repo_changes "$DIRTY_REFRESH_PS_REPO" "Commit normalized host files"
  (cd "$DIRTY_REFRESH_PS_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  dirty_ps_gitnexus_status_before="$(jq -S -c . "$DIRTY_REFRESH_PS_REPO/.spec-first/providers/gitnexus/status.json")"
  dirty_ps_aggregate_status_before="$(jq -S -c . "$DIRTY_REFRESH_PS_REPO/.spec-first/graph/provider-status.json")"
  dirty_ps_graph_facts_before="$(jq -S -c . "$DIRTY_REFRESH_PS_REPO/.spec-first/graph/graph-facts.json")"
  dirty_ps_bootstrap_report_before="$(cat "$DIRTY_REFRESH_PS_REPO/.spec-first/graph/bootstrap-report.md")"
  dirty_ps_normalized_before="$(jq -S -c . "$DIRTY_REFRESH_PS_REPO/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"
  before_dirty_ps_refresh_log="$(cat "$COMMAND_LOG")"
  printf 'dirty PowerShell refresh change\n' >> "$DIRTY_REFRESH_PS_REPO/README.md"
  for dirty_ps_refresh_case in "default|" "incremental|-Incremental" "full|-Full" "force|-Force"; do
    dirty_ps_refresh_label="${dirty_ps_refresh_case%%|*}"
    dirty_ps_refresh_arg="${dirty_ps_refresh_case#*|}"
    dirty_ps_refresh_err="$TMP_DIR/dirty-ps-refresh-${dirty_ps_refresh_label}.err"
    set +e
    if [ -n "$dirty_ps_refresh_arg" ]; then
      dirty_ps_refresh_output="$(cd "$DIRTY_REFRESH_PS_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" "$dirty_ps_refresh_arg" 2>"$dirty_ps_refresh_err")"
    else
      dirty_ps_refresh_output="$(cd "$DIRTY_REFRESH_PS_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" 2>"$dirty_ps_refresh_err")"
    fi
    dirty_ps_refresh_status=$?
    set -e
    assert_eq "dirty PowerShell $dirty_ps_refresh_label refresh continues with warn-and-continue" "0" "$dirty_ps_refresh_status"
    assert_eq "dirty PowerShell $dirty_ps_refresh_label refresh writes dirty-advisory" "ready-dirty-advisory:graph-affecting-blocked:dirty-advisory" "$(jq -r '.overall_status + ":" + .dirty_classification + ":" + .freshness_state' <<<"$dirty_ps_refresh_output")"
    assert_contains "dirty PowerShell $dirty_ps_refresh_label refresh warning includes sample path" "  dirty: README.md" "$(cat "$dirty_ps_refresh_err")"
    assert_eq "dirty PowerShell $dirty_ps_refresh_label refresh runs provider commands" "true" "$([ "$(cat "$COMMAND_LOG")" != "$before_dirty_ps_refresh_log" ] && echo true || echo false)"
  done

  PS_SETUP_DIRTY_REPO="$TMP_DIR/ps-setup-dirty-repo"
  PS_SETUP_DIRTY_LEDGER="$TMP_DIR/ps-setup-dirty-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_SETUP_DIRTY_REPO"
  write_fixture_config "$PS_SETUP_DIRTY_REPO" "$PS_SETUP_DIRTY_LEDGER" true
  write_spec_first_managed_only_host_file "$PS_SETUP_DIRTY_REPO/AGENTS.md"
  ps_setup_dirty_output="$(cd "$PS_SETUP_DIRTY_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1")"
  assert_eq "PowerShell setup-owned dirty permits host blank separators" "primary:setup-owned-only" "$(jq -r '.workflow_mode + ":" + .dirty_classification' <<<"$ps_setup_dirty_output")"

  PS_NON_GRAPH_METADATA_REPO="$TMP_DIR/ps-non-graph-metadata-repo"
  PS_NON_GRAPH_METADATA_LEDGER="$TMP_DIR/ps-non-graph-metadata-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_NON_GRAPH_METADATA_REPO"
  write_fixture_config "$PS_NON_GRAPH_METADATA_REPO" "$PS_NON_GRAPH_METADATA_LEDGER" true
  mkdir -p "$PS_NON_GRAPH_METADATA_REPO/docs"
  printf '# Changelog\n' > "$PS_NON_GRAPH_METADATA_REPO/CHANGELOG.md"
  printf '# 变更日志\n' > "$PS_NON_GRAPH_METADATA_REPO/docs/变更日志.md"
  git -C "$PS_NON_GRAPH_METADATA_REPO" add CHANGELOG.md docs/变更日志.md
  git -C "$PS_NON_GRAPH_METADATA_REPO" commit -q -m "Add changelog metadata"
  printf 'metadata dirty\n' >> "$PS_NON_GRAPH_METADATA_REPO/CHANGELOG.md"
  printf 'metadata dirty\n' >> "$PS_NON_GRAPH_METADATA_REPO/docs/变更日志.md"
  ps_non_graph_metadata_output="$(cd "$PS_NON_GRAPH_METADATA_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1")"
  assert_eq "PowerShell non-graph metadata dirty does not block" "primary:non-graph-only:2" "$(jq -r '.workflow_mode + ":" + .dirty_classification + ":" + (.dirty_paths_breakdown.non_graph_metadata_count | tostring)' <<<"$ps_non_graph_metadata_output")"
fi

INCREMENTAL_REPO="$TMP_DIR/incremental-repo"
INCREMENTAL_LEDGER="$TMP_DIR/incremental-home/.codex/spec-first/host-setup.json"
make_repo "$INCREMENTAL_REPO"
write_fixture_config "$INCREMENTAL_REPO" "$INCREMENTAL_LEDGER" true
(cd "$INCREMENTAL_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
incremental_base="$(git -C "$INCREMENTAL_REPO" rev-parse HEAD)"
commit_repo_changes "$INCREMENTAL_REPO" "Commit normalized host files"
incremental_head="$(git -C "$INCREMENTAL_REPO" rev-parse HEAD)"
incremental_output="$(cd "$INCREMENTAL_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --incremental)"
assert_eq "incremental bootstrap remains primary" "primary" "$(jq -r '.workflow_mode' <<<"$incremental_output")"
assert_eq "GitNexus incremental status fields are recorded" "incremental:incremental-update:false:$incremental_head:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.fallback_from_incremental):\(.last_indexed_commit):\(.requires_clean_full_refresh)"' <<<"$incremental_output")"
assert_eq "GitNexus incremental uses analyze without force" "npx -y $GITNEXUS_PACKAGE analyze --skip-agents-md --no-stats:incremental:primary" "$(jq -r '.results[] | select(.provider=="gitnexus") | .command_results[] | select(.kind=="bootstrap") | "\(.command):\(.refresh_mode):\(.attempt_role)"' <<<"$incremental_output")"
assert_eq "incremental output is GitNexus-only" "gitnexus" "$(jq -r '[.results[].provider] | join(",")' <<<"$incremental_output")"

MISSING_INCREMENTAL_REPO="$TMP_DIR/missing-incremental-repo"
MISSING_INCREMENTAL_LEDGER="$TMP_DIR/missing-incremental-home/.codex/spec-first/host-setup.json"
make_repo "$MISSING_INCREMENTAL_REPO"
write_fixture_config "$MISSING_INCREMENTAL_REPO" "$MISSING_INCREMENTAL_LEDGER" true
(cd "$MISSING_INCREMENTAL_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
commit_repo_changes "$MISSING_INCREMENTAL_REPO" "Commit normalized host files"
jq 'del(.providers.gitnexus.commands.incremental)' "$MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json" > "$MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json.tmp" "$MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json"
missing_incremental_output="$(cd "$MISSING_INCREMENTAL_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --incremental)"
assert_eq "missing incremental command degrades to full" "full:cold-run:incremental-command-unavailable" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.reason_code)"' <<<"$missing_incremental_output")"

STALE_CRG_PROJECTION_REPO="$TMP_DIR/stale-crg-projection-repo"
STALE_CRG_PROJECTION_LEDGER="$TMP_DIR/stale-crg-projection-home/.codex/spec-first/host-setup.json"
make_repo "$STALE_CRG_PROJECTION_REPO"
write_fixture_config "$STALE_CRG_PROJECTION_REPO" "$STALE_CRG_PROJECTION_LEDGER" true
jq '.providers["code-review-graph"] = {configured:true,enabled_for_bootstrap:true,dependency_status:"ready",host_config_status:"ready",commands:{bootstrap:["uvx","code-review-graph@2.3.3","build"],status:["uvx","code-review-graph@2.3.3","status"],query_probe:["uvx","code-review-graph@2.3.3","status","--repo",.repo_root]}}' "$STALE_CRG_PROJECTION_REPO/.spec-first/config/graph-providers.json" > "$STALE_CRG_PROJECTION_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$STALE_CRG_PROJECTION_REPO/.spec-first/config/graph-providers.json.tmp" "$STALE_CRG_PROJECTION_REPO/.spec-first/config/graph-providers.json"
before_stale_crg_projection_log="$(cat "$COMMAND_LOG")"
set +e
stale_crg_projection_output="$(cd "$STALE_CRG_PROJECTION_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
stale_crg_projection_status=$?
set -e
assert_eq "stale code-review-graph projection fails before provider commands" "1" "$stale_crg_projection_status"
assert_eq "stale code-review-graph projection reason" "stale-provider-projection" "$(jq -r '.reason_code' <<<"$stale_crg_projection_output")"
assert_contains "stale code-review-graph projection recommends setup" 'provider projection is stale; run `$spec-mcp-setup`' "$(jq -r '.next_action' <<<"$stale_crg_projection_output")"
assert_eq "stale code-review-graph projection is not executed" "$before_stale_crg_projection_log" "$(cat "$COMMAND_LOG")"

INVALID_BASE_REPO="$TMP_DIR/invalid-base-repo"
INVALID_BASE_LEDGER="$TMP_DIR/invalid-base-home/.codex/spec-first/host-setup.json"
make_repo "$INVALID_BASE_REPO"
write_fixture_config "$INVALID_BASE_REPO" "$INVALID_BASE_LEDGER" true
(cd "$INVALID_BASE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
commit_repo_changes "$INVALID_BASE_REPO" "Commit normalized host files"
jq '.last_indexed_commit = "--force"' "$INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json" > "$INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp"
mv "$INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp" "$INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json"
invalid_base_output="$(cd "$INVALID_BASE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --incremental)"
assert_eq "invalid incremental base falls back to full" "full:cold-run:incremental-base-ref-invalid-format" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.reason_code)"' <<<"$invalid_base_output")"

UNTRUSTED_BASE_REPO="$TMP_DIR/untrusted-base-repo"
UNTRUSTED_BASE_LEDGER="$TMP_DIR/untrusted-base-home/.codex/spec-first/host-setup.json"
make_repo "$UNTRUSTED_BASE_REPO"
write_fixture_config "$UNTRUSTED_BASE_REPO" "$UNTRUSTED_BASE_LEDGER" true
(cd "$UNTRUSTED_BASE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
commit_repo_changes "$UNTRUSTED_BASE_REPO" "Commit normalized host files"
jq '.query_ready = false' "$UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json" > "$UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp"
mv "$UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp" "$UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json"
untrusted_base_output="$(cd "$UNTRUSTED_BASE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" --incremental)"
assert_eq "untrusted incremental base falls back to full" "full:cold-run:incremental-base-status-untrusted" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.reason_code)"' <<<"$untrusted_base_output")"

INCREMENTAL_FALLBACK_REPO="$TMP_DIR/incremental-fallback-repo"
INCREMENTAL_FALLBACK_LEDGER="$TMP_DIR/incremental-fallback-home/.codex/spec-first/host-setup.json"
make_repo "$INCREMENTAL_FALLBACK_REPO"
write_fixture_config "$INCREMENTAL_FALLBACK_REPO" "$INCREMENTAL_FALLBACK_LEDGER" true
(cd "$INCREMENTAL_FALLBACK_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
commit_repo_changes "$INCREMENTAL_FALLBACK_REPO" "Commit normalized host files"
incremental_fallback_head="$(git -C "$INCREMENTAL_FALLBACK_REPO" rev-parse HEAD)"
incremental_fallback_output="$(cd "$INCREMENTAL_FALLBACK_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_INCREMENTAL=1 bash "$BOOTSTRAP_SCRIPT" --incremental)"
assert_eq "incremental failure falls back to full successfully" "incremental-fallback-full:incremental-fallback-full:true:incremental-refresh-failed-fallback-full:$incremental_fallback_head:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.fallback_from_incremental):\(.reason_code):\(.last_indexed_commit):\(.requires_clean_full_refresh)"' <<<"$incremental_fallback_output")"
assert_eq "incremental fallback records primary and fallback attempts" "npx -y $GITNEXUS_PACKAGE analyze --skip-agents-md --no-stats:incremental:primary:44|npx -y $GITNEXUS_PACKAGE analyze --force --skip-agents-md --no-stats:full:fallback:0" "$(jq -r '.results[] | select(.provider=="gitnexus") | [.command_results[] | select(.kind=="bootstrap") | "\(.command):\(.refresh_mode):\(.attempt_role):\(.exit_code)"] | join("|")' <<<"$incremental_fallback_output")"
assert_eq "GitNexus normalized envelope tracks fallback analyze log" "true:true" "$(jq -r '((.source_raw_logs | index(".spec-first/providers/gitnexus/raw/analyze.log")) != null | tostring) + ":" + ((.source_raw_logs | index(".spec-first/providers/gitnexus/raw/fallback-analyze.log")) != null | tostring)' "$INCREMENTAL_FALLBACK_REPO/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"

INCREMENTAL_BOTH_FAILED_REPO="$TMP_DIR/incremental-both-failed-repo"
INCREMENTAL_BOTH_FAILED_LEDGER="$TMP_DIR/incremental-both-failed-home/.codex/spec-first/host-setup.json"
make_repo "$INCREMENTAL_BOTH_FAILED_REPO"
write_fixture_config "$INCREMENTAL_BOTH_FAILED_REPO" "$INCREMENTAL_BOTH_FAILED_LEDGER" true
(cd "$INCREMENTAL_BOTH_FAILED_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT" >/dev/null)
commit_repo_changes "$INCREMENTAL_BOTH_FAILED_REPO" "Commit normalized host files"
both_failed_graph_facts_before="$(jq -S -c . "$INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/graph-facts.json")"
both_failed_provider_status_before="$(jq -S -c . "$INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/provider-status.json")"
both_failed_normalized_before="$(jq -S -c . "$INCREMENTAL_BOTH_FAILED_REPO/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"
set +e
incremental_both_failed_output="$(cd "$INCREMENTAL_BOTH_FAILED_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_ANALYZE_SIGSEGV=1 bash "$BOOTSTRAP_SCRIPT" --incremental)"
incremental_both_failed_status=$?
set -e
assert_eq "incremental and full failure remains degraded via fallback capabilities" "0" "$incremental_both_failed_status"
assert_eq "incremental and full failure returns top-level reason" "degraded-fallback:incremental-and-full-failed" "$(jq -r '.workflow_mode + ":" + .reason_code' <<<"$incremental_both_failed_output")"
assert_eq "incremental and full failure marks provider clean-full-required" "failed:false:false:incremental-and-full-failed:true" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.graph_ready):\(.query_ready):\(.reason_code):\(.requires_clean_full_refresh)"' <<<"$incremental_both_failed_output")"
assert_eq "incremental and full failure preserves aggregate provider status" "$both_failed_provider_status_before" "$(jq -S -c . "$INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/provider-status.json")"
assert_eq "incremental and full failure preserves graph facts" "$both_failed_graph_facts_before" "$(jq -S -c . "$INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "incremental and full failure preserves normalized envelopes" "$both_failed_normalized_before" "$(jq -S -c . "$INCREMENTAL_BOTH_FAILED_REPO/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"

if command -v pwsh >/dev/null 2>&1; then
  PS_INCREMENTAL_REPO="$TMP_DIR/ps-incremental-repo"
  PS_INCREMENTAL_LEDGER="$TMP_DIR/ps-incremental-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_INCREMENTAL_REPO"
  write_fixture_config "$PS_INCREMENTAL_REPO" "$PS_INCREMENTAL_LEDGER" true
  (cd "$PS_INCREMENTAL_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  ps_incremental_base="$(git -C "$PS_INCREMENTAL_REPO" rev-parse HEAD)"
  commit_repo_changes "$PS_INCREMENTAL_REPO" "Commit normalized host files"
  ps_incremental_head="$(git -C "$PS_INCREMENTAL_REPO" rev-parse HEAD)"
  ps_incremental_output="$(cd "$PS_INCREMENTAL_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -Incremental)"
  assert_eq "PowerShell incremental bootstrap remains primary" "primary" "$(jq -r '.workflow_mode' <<<"$ps_incremental_output")"
  assert_eq "PowerShell GitNexus incremental status fields are recorded" "incremental:incremental-update:false:$ps_incremental_head:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.fallback_from_incremental):\(.last_indexed_commit):\(.requires_clean_full_refresh)"' <<<"$ps_incremental_output")"
  assert_eq "PowerShell incremental output is GitNexus-only" "gitnexus" "$(jq -r '[.results[].provider] | join(",")' <<<"$ps_incremental_output")"

  PS_MISSING_INCREMENTAL_REPO="$TMP_DIR/ps-missing-incremental-repo"
  PS_MISSING_INCREMENTAL_LEDGER="$TMP_DIR/ps-missing-incremental-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_MISSING_INCREMENTAL_REPO"
  write_fixture_config "$PS_MISSING_INCREMENTAL_REPO" "$PS_MISSING_INCREMENTAL_LEDGER" true
  (cd "$PS_MISSING_INCREMENTAL_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  commit_repo_changes "$PS_MISSING_INCREMENTAL_REPO" "Commit normalized host files"
  jq 'del(.providers.gitnexus.commands.incremental)' "$PS_MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json" > "$PS_MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json.tmp"
  mv "$PS_MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json.tmp" "$PS_MISSING_INCREMENTAL_REPO/.spec-first/config/graph-providers.json"
  ps_missing_incremental_output="$(cd "$PS_MISSING_INCREMENTAL_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -Incremental)"
  assert_eq "PowerShell missing incremental command degrades to full" "full:cold-run:incremental-command-unavailable" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.reason_code)"' <<<"$ps_missing_incremental_output")"

  PS_BAD_INCREMENTAL_DEFAULT_REPO="$TMP_DIR/ps-bad-incremental-default-repo"
  PS_BAD_INCREMENTAL_DEFAULT_LEDGER="$TMP_DIR/ps-bad-incremental-default-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_BAD_INCREMENTAL_DEFAULT_REPO"
  write_fixture_config "$PS_BAD_INCREMENTAL_DEFAULT_REPO" "$PS_BAD_INCREMENTAL_DEFAULT_LEDGER" true
  jq '.providers.gitnexus.commands.incremental += ["--unexpected"]' "$PS_BAD_INCREMENTAL_DEFAULT_REPO/.spec-first/config/graph-providers.json" > "$PS_BAD_INCREMENTAL_DEFAULT_REPO/.spec-first/config/graph-providers.json.tmp"
  mv "$PS_BAD_INCREMENTAL_DEFAULT_REPO/.spec-first/config/graph-providers.json.tmp" "$PS_BAD_INCREMENTAL_DEFAULT_REPO/.spec-first/config/graph-providers.json"
  before_ps_bad_incremental_default_log="$(cat "$COMMAND_LOG")"
  set +e
  ps_bad_incremental_default_output="$(cd "$PS_BAD_INCREMENTAL_DEFAULT_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1")"
  ps_bad_incremental_default_status=$?
  set -e
  assert_eq "PowerShell malformed incremental projection fails closed on default full refresh" "1" "$ps_bad_incremental_default_status"
  assert_eq "PowerShell malformed incremental projection default reason" "unsupported-provider-command" "$(jq -r '.reason_code' <<<"$ps_bad_incremental_default_output")"
  assert_eq "PowerShell malformed incremental projection default is not executed" "$before_ps_bad_incremental_default_log" "$(cat "$COMMAND_LOG")"

  PS_INVALID_BASE_REPO="$TMP_DIR/ps-invalid-base-repo"
  PS_INVALID_BASE_LEDGER="$TMP_DIR/ps-invalid-base-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_INVALID_BASE_REPO"
  write_fixture_config "$PS_INVALID_BASE_REPO" "$PS_INVALID_BASE_LEDGER" true
  (cd "$PS_INVALID_BASE_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  commit_repo_changes "$PS_INVALID_BASE_REPO" "Commit normalized host files"
  jq '.last_indexed_commit = "--force"' "$PS_INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json" > "$PS_INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp"
  mv "$PS_INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp" "$PS_INVALID_BASE_REPO/.spec-first/providers/gitnexus/status.json"
  ps_invalid_base_output="$(cd "$PS_INVALID_BASE_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -Incremental)"
  assert_eq "PowerShell invalid incremental base falls back to full" "full:cold-run:incremental-base-ref-invalid-format" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.reason_code)"' <<<"$ps_invalid_base_output")"

  PS_UNTRUSTED_BASE_REPO="$TMP_DIR/ps-untrusted-base-repo"
  PS_UNTRUSTED_BASE_LEDGER="$TMP_DIR/ps-untrusted-base-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_UNTRUSTED_BASE_REPO"
  write_fixture_config "$PS_UNTRUSTED_BASE_REPO" "$PS_UNTRUSTED_BASE_LEDGER" true
  (cd "$PS_UNTRUSTED_BASE_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  commit_repo_changes "$PS_UNTRUSTED_BASE_REPO" "Commit normalized host files"
  jq '.query_ready = false' "$PS_UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json" > "$PS_UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp"
  mv "$PS_UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json.tmp" "$PS_UNTRUSTED_BASE_REPO/.spec-first/providers/gitnexus/status.json"
  ps_untrusted_base_output="$(cd "$PS_UNTRUSTED_BASE_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -Incremental)"
  assert_eq "PowerShell untrusted incremental base falls back to full" "full:cold-run:incremental-base-status-untrusted" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.reason_code)"' <<<"$ps_untrusted_base_output")"

  PS_INCREMENTAL_FALLBACK_REPO="$TMP_DIR/ps-incremental-fallback-repo"
  PS_INCREMENTAL_FALLBACK_LEDGER="$TMP_DIR/ps-incremental-fallback-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_INCREMENTAL_FALLBACK_REPO"
  write_fixture_config "$PS_INCREMENTAL_FALLBACK_REPO" "$PS_INCREMENTAL_FALLBACK_LEDGER" true
  (cd "$PS_INCREMENTAL_FALLBACK_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  commit_repo_changes "$PS_INCREMENTAL_FALLBACK_REPO" "Commit normalized host files"
  ps_incremental_fallback_head="$(git -C "$PS_INCREMENTAL_FALLBACK_REPO" rev-parse HEAD)"
  ps_incremental_fallback_output="$(cd "$PS_INCREMENTAL_FALLBACK_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_INCREMENTAL=1 pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -Incremental)"
  assert_eq "PowerShell incremental failure falls back to full successfully" "incremental-fallback-full:incremental-fallback-full:true:incremental-refresh-failed-fallback-full:$ps_incremental_fallback_head:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.refresh_mode):\(.readiness_source):\(.fallback_from_incremental):\(.reason_code):\(.last_indexed_commit):\(.requires_clean_full_refresh)"' <<<"$ps_incremental_fallback_output")"

  PS_INCREMENTAL_BOTH_FAILED_REPO="$TMP_DIR/ps-incremental-both-failed-repo"
  PS_INCREMENTAL_BOTH_FAILED_LEDGER="$TMP_DIR/ps-incremental-both-failed-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_INCREMENTAL_BOTH_FAILED_REPO"
  write_fixture_config "$PS_INCREMENTAL_BOTH_FAILED_REPO" "$PS_INCREMENTAL_BOTH_FAILED_LEDGER" true
  (cd "$PS_INCREMENTAL_BOTH_FAILED_REPO" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" >/dev/null)
  commit_repo_changes "$PS_INCREMENTAL_BOTH_FAILED_REPO" "Commit normalized host files"
  ps_both_failed_graph_facts_before="$(jq -S -c . "$PS_INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/graph-facts.json")"
  ps_both_failed_provider_status_before="$(jq -S -c . "$PS_INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/provider-status.json")"
  ps_both_failed_bootstrap_report_before="$(cat "$PS_INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/bootstrap-report.md")"
  set +e
  ps_incremental_both_failed_output="$(cd "$PS_INCREMENTAL_BOTH_FAILED_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_ANALYZE_SIGSEGV=1 pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -Incremental)"
  ps_incremental_both_failed_status=$?
  set -e
  assert_eq "PowerShell incremental and full failure remains degraded via fallback capabilities" "0" "$ps_incremental_both_failed_status"
  assert_eq "PowerShell incremental and full failure returns top-level reason" "degraded-fallback:incremental-and-full-failed" "$(jq -r '.workflow_mode + ":" + .reason_code' <<<"$ps_incremental_both_failed_output")"
  assert_eq "PowerShell incremental and full failure preserves aggregate provider status" "$ps_both_failed_provider_status_before" "$(jq -S -c . "$PS_INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/provider-status.json")"
  assert_eq "PowerShell incremental and full failure preserves graph facts" "$ps_both_failed_graph_facts_before" "$(jq -S -c . "$PS_INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/graph-facts.json")"
  assert_eq "PowerShell incremental and full failure preserves bootstrap report" "$ps_both_failed_bootstrap_report_before" "$(cat "$PS_INCREMENTAL_BOTH_FAILED_REPO/.spec-first/graph/bootstrap-report.md")"

  PS_ALL_REPOS_INCREMENTAL_WORKSPACE="$TMP_DIR/ps-all-repos-incremental-workspace"
  PS_ALL_REPOS_INCREMENTAL_LEDGER="$TMP_DIR/ps-all-repos-incremental-home/.codex/spec-first/host-setup.json"
  make_repo "$PS_ALL_REPOS_INCREMENTAL_WORKSPACE/project-a"
  write_fixture_config "$PS_ALL_REPOS_INCREMENTAL_WORKSPACE/project-a" "$PS_ALL_REPOS_INCREMENTAL_LEDGER" true
  before_ps_all_repos_incremental_log="$(cat "$COMMAND_LOG")"
  set +e
  ps_all_repos_incremental_output="$(cd "$PS_ALL_REPOS_INCREMENTAL_WORKSPACE" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -AllRepos -Incremental)"
  ps_all_repos_incremental_status=$?
  set -e
  assert_eq "PowerShell all-repos incremental is unsupported" "1" "$ps_all_repos_incremental_status"
  assert_eq "PowerShell all-repos incremental blocks before providers" "workspace-graph-bootstrap-summary.v1:blocked:incremental-all-repos-unsupported:true" "$(jq -r '.schema_version + ":" + .workflow_mode + ":" + .reason_code + ":" + (.canonical_artifacts_preserved | tostring)' <<<"$ps_all_repos_incremental_output")"
  assert_eq "PowerShell all-repos incremental does not run provider commands" "$before_ps_all_repos_incremental_log" "$(cat "$COMMAND_LOG")"
  set +e
  ps_all_repos_conflict_output="$(cd "$PS_ALL_REPOS_INCREMENTAL_WORKSPACE" && PATH="$TEST_PATH" pwsh -NoLogo -NoProfile -NonInteractive -File "$BOOTSTRAP_PS1" -AllRepos -Incremental -Full)"
  ps_all_repos_conflict_status=$?
  set -e
  assert_eq "PowerShell all-repos conflicting refresh flags fail closed" "1" "$ps_all_repos_conflict_status"
  assert_eq "PowerShell all-repos conflicting refresh flags reason" "conflicting-refresh-flags" "$(jq -r '.reason_code' <<<"$ps_all_repos_conflict_output")"
  assert_eq "PowerShell all-repos conflicting refresh flags do not run provider commands" "$before_ps_all_repos_incremental_log" "$(cat "$COMMAND_LOG")"
fi

MULTI_PROBE_REPO="$TMP_DIR/multi-probe-repo"
MULTI_PROBE_LEDGER="$TMP_DIR/multi-probe-home/.codex/spec-first/host-setup.json"
make_repo "$MULTI_PROBE_REPO"
write_fixture_config "$MULTI_PROBE_REPO" "$MULTI_PROBE_LEDGER" true
jq --arg probe "$GITNEXUS_QUERY_PROBE" '
  .providers.gitnexus.commands.query_probe[4] = "AdvertiseActivity"
  | .providers.gitnexus.query_probe_policy.token = "AdvertiseActivity"
  | .providers.gitnexus.query_probe_policy.selected_from = "app-core/src/main/java/com/hstong/app_core/ads/AdvertiseActivity.java"
  | .providers.gitnexus.query_probe_policy.candidates = [
      {token:"AdvertiseActivity", selected_from:"app-core/src/main/java/com/hstong/app_core/ads/AdvertiseActivity.java", reason_code:"android_named"},
      {token:$probe, selected_from:"trade/src/main/java/com/hstong/trade/tradelogin/login/ui/TradeLoginActivity.java", reason_code:"entrypoint_named"}
    ]
' "$MULTI_PROBE_REPO/.spec-first/config/graph-providers.json" > "$MULTI_PROBE_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$MULTI_PROBE_REPO/.spec-first/config/graph-providers.json.tmp" "$MULTI_PROBE_REPO/.spec-first/config/graph-providers.json"
multi_probe_output="$(cd "$MULTI_PROBE_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_SECOND_CANDIDATE_SUCCEEDS=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "multi-candidate probe verifies on later process result" "primary" "$(jq -r '.workflow_mode' <<<"$multi_probe_output")"
assert_eq "multi-candidate attempts are recorded" "2:empty-or-unparseable:process-results:true" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.query_probe_attempts | length):\(.query_probe_attempts[0].result_class):\(.query_probe_attempts[1].result_class):\(.query_ready)"' <<<"$multi_probe_output")"
assert_contains "multi-candidate probe runs first token" "npx -y $GITNEXUS_PACKAGE query AdvertiseActivity --repo $(basename "$MULTI_PROBE_REPO")" "$(cat "$COMMAND_LOG")"
assert_contains "multi-candidate probe runs second token" "npx -y $GITNEXUS_PACKAGE query $GITNEXUS_QUERY_PROBE --repo $(basename "$MULTI_PROBE_REPO")" "$(cat "$COMMAND_LOG")"
assert "multi-candidate secondary raw log exists" test -f "$MULTI_PROBE_REPO/.spec-first/providers/gitnexus/raw/query-2.log"
assert_eq "multi-candidate normalized artifact points to winning raw log" "true:.spec-first/providers/gitnexus/raw/query-2.log" "$(jq -r '(.source_raw_logs | index(".spec-first/providers/gitnexus/raw/query-2.log") != null | tostring) + ":" + (.winning_query_probe_log // "")' "$MULTI_PROBE_REPO/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"

TRUNCATED_PROBE_REPO="$TMP_DIR/truncated-probe-repo"
TRUNCATED_PROBE_LEDGER="$TMP_DIR/truncated-probe-home/.codex/spec-first/host-setup.json"
make_repo "$TRUNCATED_PROBE_REPO"
write_fixture_config "$TRUNCATED_PROBE_REPO" "$TRUNCATED_PROBE_LEDGER" true
jq '
  .providers.gitnexus.commands.query_probe[4] = "ProbeOne"
  | .providers.gitnexus.query_probe_policy.token = "ProbeOne"
  | .providers.gitnexus.query_probe_policy.selected_from = "src/ProbeOne.ts"
  | .providers.gitnexus.query_probe_policy.candidates = [
      {token:"ProbeOne", selected_from:"src/ProbeOne.ts", reason_code:"workflow_named"},
      {token:"ProbeTwo", selected_from:"src/ProbeTwo.ts", reason_code:"workflow_named"},
      {token:"ProbeThree", selected_from:"src/ProbeThree.ts", reason_code:"workflow_named"},
      {token:"ProbeFour", selected_from:"src/ProbeFour.ts", reason_code:"workflow_named"},
      {token:"ProbeFive", selected_from:"src/ProbeFive.ts", reason_code:"workflow_named"},
      {token:"ProbeSix", selected_from:"src/ProbeSix.ts", reason_code:"workflow_named"}
    ]
' "$TRUNCATED_PROBE_REPO/.spec-first/config/graph-providers.json" > "$TRUNCATED_PROBE_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$TRUNCATED_PROBE_REPO/.spec-first/config/graph-providers.json.tmp" "$TRUNCATED_PROBE_REPO/.spec-first/config/graph-providers.json"
truncated_probe_output="$(cd "$TRUNCATED_PROBE_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_EMPTY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "multi-candidate probe enforces consumer-side limit" "5:true:5:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.query_probe_attempts | length):\(.query_probe_candidates_truncated):\(.query_probe_candidate_limit):\(.query_ready)"' <<<"$truncated_probe_output")"
assert_contains "truncated candidate limitation is explicit" "Only the first 5 bounded GitNexus query probe candidates were attempted" "$(jq -r '.results[] | select(.provider=="gitnexus") | .query_verification_reason' <<<"$truncated_probe_output")"
assert "sixth truncated query log is not created" test ! -f "$TRUNCATED_PROBE_REPO/.spec-first/providers/gitnexus/raw/query-6.log"

VERSIONED_REPO="$TMP_DIR/versioned-command-repo"
VERSIONED_LEDGER="$TMP_DIR/versioned-home/.codex/spec-first/host-setup.json"
make_repo "$VERSIONED_REPO"
write_fixture_config "$VERSIONED_REPO" "$VERSIONED_LEDGER" true
jq --arg gitnexus_package "$GITNEXUS_PACKAGE" '.providers.gitnexus.commands.bootstrap = ["npx","-y",$gitnexus_package,"analyze"]' "$VERSIONED_REPO/.spec-first/config/graph-providers.json" > "$VERSIONED_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$VERSIONED_REPO/.spec-first/config/graph-providers.json.tmp" "$VERSIONED_REPO/.spec-first/config/graph-providers.json"
versioned_output="$(cd "$VERSIONED_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "safe command array variation remains accepted" "primary" "$(jq -r '.workflow_mode' <<<"$versioned_output")"
assert_contains "bootstrap executes command from config array" "npx -y $GITNEXUS_PACKAGE analyze" "$(cat "$COMMAND_LOG")"

DISABLED_GITNEXUS_REPO="$TMP_DIR/disabled-gitnexus-provider-repo"
DISABLED_GITNEXUS_LEDGER="$TMP_DIR/disabled-gitnexus-home/.codex/spec-first/host-setup.json"
make_repo "$DISABLED_GITNEXUS_REPO"
write_fixture_config "$DISABLED_GITNEXUS_REPO" "$DISABLED_GITNEXUS_LEDGER" true
jq '.providers.gitnexus.enabled_for_bootstrap = false' "$DISABLED_GITNEXUS_REPO/.spec-first/config/graph-providers.json" > "$DISABLED_GITNEXUS_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$DISABLED_GITNEXUS_REPO/.spec-first/config/graph-providers.json.tmp" "$DISABLED_GITNEXUS_REPO/.spec-first/config/graph-providers.json"
disabled_gitnexus_output="$(cd "$DISABLED_GITNEXUS_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "disabled GitNexus provider uses fallback workflow" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$disabled_gitnexus_output")"
assert_eq "disabled GitNexus status keeps real enabled flag" "false:disabled-for-bootstrap" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.enabled_for_bootstrap):\(.skip_reason)"' <<<"$disabled_gitnexus_output")"
assert_eq "disabled GitNexus provider is skipped not failed" "true" "$(jq -r '(.skipped_primary_providers | index("gitnexus") != null) and (.failed_primary_providers | index("gitnexus") == null)' "$DISABLED_GITNEXUS_REPO/.spec-first/graph/provider-status.json")"

SAFETY_REPO="$TMP_DIR/safety-repo"
SAFETY_LEDGER="$TMP_DIR/safety-home/.codex/spec-first/host-setup.json"
make_repo "$SAFETY_REPO"
write_fixture_config "$SAFETY_REPO" "$SAFETY_LEDGER" true
jq '.providers.gitnexus.commands.bootstrap = ["bash","-c","echo unsafe"]' "$SAFETY_REPO/.spec-first/config/graph-providers.json" > "$SAFETY_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$SAFETY_REPO/.spec-first/config/graph-providers.json.tmp" "$SAFETY_REPO/.spec-first/config/graph-providers.json"
before_safety_log="$(cat "$COMMAND_LOG")"
set +e
safety_output="$(cd "$SAFETY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
safety_status=$?
set -e
assert_eq "unsafe command fails" "1" "$safety_status"
assert_eq "unsafe command reason" "unsupported-provider-command" "$(jq -r '.reason_code' <<<"$safety_output")"
assert_eq "unsafe command is not executed" "$before_safety_log" "$(cat "$COMMAND_LOG")"

METACHAR_REPO="$TMP_DIR/metachar-repo"
METACHAR_LEDGER="$TMP_DIR/metachar-home/.codex/spec-first/host-setup.json"
make_repo "$METACHAR_REPO"
write_fixture_config "$METACHAR_REPO" "$METACHAR_LEDGER" true
jq --arg package "$GITNEXUS_PACKAGE" '.providers.gitnexus.commands.bootstrap = ["npx","-y",$package,"analyze;rm -rf /"]' "$METACHAR_REPO/.spec-first/config/graph-providers.json" > "$METACHAR_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$METACHAR_REPO/.spec-first/config/graph-providers.json.tmp" "$METACHAR_REPO/.spec-first/config/graph-providers.json"
before_metachar_log="$(cat "$COMMAND_LOG")"
set +e
metachar_output="$(cd "$METACHAR_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
metachar_status=$?
set -e
assert_eq "metachar command fails closed" "1" "$metachar_status"
assert_eq "metachar command reason" "unsupported-provider-command" "$(jq -r '.reason_code' <<<"$metachar_output")"
assert_eq "metachar command is not shell-interpreted" "$before_metachar_log" "$(cat "$COMMAND_LOG")"

CONTROL_CHAR_REPO="$TMP_DIR/control-char-repo"
CONTROL_CHAR_LEDGER="$TMP_DIR/control-char-home/.codex/spec-first/host-setup.json"
make_repo "$CONTROL_CHAR_REPO"
write_fixture_config "$CONTROL_CHAR_REPO" "$CONTROL_CHAR_LEDGER" true
jq --arg bad $'Trade\n--repo\nevil' '.providers.gitnexus.commands.query_probe[4] = $bad' "$CONTROL_CHAR_REPO/.spec-first/config/graph-providers.json" > "$CONTROL_CHAR_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$CONTROL_CHAR_REPO/.spec-first/config/graph-providers.json.tmp" "$CONTROL_CHAR_REPO/.spec-first/config/graph-providers.json"
before_control_char_log="$(cat "$COMMAND_LOG")"
set +e
control_char_output="$(cd "$CONTROL_CHAR_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
control_char_status=$?
set -e
assert_eq "control char command arg fails closed" "1" "$control_char_status"
assert_eq "control char command arg reason" "unsupported-provider-command" "$(jq -r '.reason_code' <<<"$control_char_output")"
assert_eq "control char command arg is not split into provider argv" "$before_control_char_log" "$(cat "$COMMAND_LOG")"

CONTROL_TOKEN_REPO="$TMP_DIR/control-token-repo"
CONTROL_TOKEN_LEDGER="$TMP_DIR/control-token-home/.codex/spec-first/host-setup.json"
make_repo "$CONTROL_TOKEN_REPO"
write_fixture_config "$CONTROL_TOKEN_REPO" "$CONTROL_TOKEN_LEDGER" true
jq --arg bad $'Trade\n--repo\nevil' '
  .providers.gitnexus.query_probe_policy.token = $bad
  | .providers.gitnexus.query_probe_policy.candidates = [
      {token:$bad, selected_from:"src/Trade.ts", reason_code:"workflow_named"}
    ]
' "$CONTROL_TOKEN_REPO/.spec-first/config/graph-providers.json" > "$CONTROL_TOKEN_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$CONTROL_TOKEN_REPO/.spec-first/config/graph-providers.json.tmp" "$CONTROL_TOKEN_REPO/.spec-first/config/graph-providers.json"
before_control_token_log="$(cat "$COMMAND_LOG")"
set +e
control_token_output="$(cd "$CONTROL_TOKEN_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
control_token_status=$?
set -e
assert_eq "control char query token fails closed" "1" "$control_token_status"
assert_eq "control char query token reason" "unsupported-provider-command" "$(jq -r '.reason_code' <<<"$control_token_output")"
assert_eq "control char query token is not executed" "$before_control_token_log" "$(cat "$COMMAND_LOG")"

LEGACY_TOKEN_REPO="$TMP_DIR/legacy-token-repo"
LEGACY_TOKEN_LEDGER="$TMP_DIR/legacy-token-home/.codex/spec-first/host-setup.json"
make_repo "$LEGACY_TOKEN_REPO"
write_fixture_config "$LEGACY_TOKEN_REPO" "$LEGACY_TOKEN_LEDGER" true
jq '.providers.gitnexus.query_probe_policy.token = "TradeLoginActivity;rm" | del(.providers.gitnexus.query_probe_policy.candidates)' "$LEGACY_TOKEN_REPO/.spec-first/config/graph-providers.json" > "$LEGACY_TOKEN_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$LEGACY_TOKEN_REPO/.spec-first/config/graph-providers.json.tmp" "$LEGACY_TOKEN_REPO/.spec-first/config/graph-providers.json"
before_legacy_token_log="$(cat "$COMMAND_LOG")"
set +e
legacy_token_output="$(cd "$LEGACY_TOKEN_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
legacy_token_status=$?
set -e
assert_eq "unsafe legacy query token fails closed" "1" "$legacy_token_status"
assert_eq "unsafe legacy query token reason" "unsupported-provider-command" "$(jq -r '.reason_code' <<<"$legacy_token_output")"
assert_eq "unsafe legacy query token is not executed" "$before_legacy_token_log" "$(cat "$COMMAND_LOG")"

ARTIFACT_DRIFT_REPO="$TMP_DIR/artifact-drift-repo"
ARTIFACT_DRIFT_LEDGER="$TMP_DIR/artifact-drift-home/.codex/spec-first/host-setup.json"
make_repo "$ARTIFACT_DRIFT_REPO"
write_fixture_config "$ARTIFACT_DRIFT_REPO" "$ARTIFACT_DRIFT_LEDGER" true
jq '.canonical.graph_facts = ".spec-first/graph/drifted.json"' "$ARTIFACT_DRIFT_REPO/.spec-first/config/provider-artifacts.json" > "$ARTIFACT_DRIFT_REPO/.spec-first/config/provider-artifacts.json.tmp"
mv "$ARTIFACT_DRIFT_REPO/.spec-first/config/provider-artifacts.json.tmp" "$ARTIFACT_DRIFT_REPO/.spec-first/config/provider-artifacts.json"
before_artifact_drift_log="$(cat "$COMMAND_LOG")"
set +e
artifact_drift_output="$(cd "$ARTIFACT_DRIFT_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
artifact_drift_status=$?
set -e
assert_eq "provider artifact path drift fails closed" "1" "$artifact_drift_status"
assert_eq "provider artifact path drift reason" "readiness-conflict" "$(jq -r '.reason_code' <<<"$artifact_drift_output")"
assert_eq "provider artifact path drift does not run providers" "$before_artifact_drift_log" "$(cat "$COMMAND_LOG")"

METADATA_REPO="$TMP_DIR/metadata-repo"
METADATA_LEDGER="$TMP_DIR/metadata-home/.codex/spec-first/host-setup.json"
make_repo "$METADATA_REPO"
write_fixture_config "$METADATA_REPO" "$METADATA_LEDGER" true
jq '
  .providers.gitnexus.query_probe_policy.candidates = [
    {token:"TradeLoginActivity", selected_from:"src/routes/$id/TradeLoginActivity.ts", reason_code:"workflow_named"}
  ]
' "$METADATA_REPO/.spec-first/config/graph-providers.json" > "$METADATA_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$METADATA_REPO/.spec-first/config/graph-providers.json.tmp" "$METADATA_REPO/.spec-first/config/graph-providers.json"
metadata_output="$(cd "$METADATA_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "query probe metadata allows route-style selected_from characters" "primary" "$(jq -r '.workflow_mode' <<<"$metadata_output")"
assert_eq "metadata selected_from is preserved in attempts" 'src/routes/$id/TradeLoginActivity.ts' "$(jq -r '.results[] | select(.provider=="gitnexus") | .query_probe_attempts[0].selected_from' <<<"$metadata_output")"

QUERY_REPO="$TMP_DIR/query-repo"
QUERY_LEDGER="$TMP_DIR/query-home/.codex/spec-first/host-setup.json"
make_repo "$QUERY_REPO"
write_fixture_config "$QUERY_REPO" "$QUERY_LEDGER" true
query_output="$(cd "$QUERY_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_QUERY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "query failure degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$query_output")"
assert_eq "query-unverified provider stays not ready" "query-unverified:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.query_ready)"' <<<"$query_output")"
assert_eq "query failure keeps graph ready separately" "true:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.graph_ready):\(.query_ready)"' <<<"$query_output")"

STALE_LABEL_REPO="$TMP_DIR/stale-label/Hr360_temp"
STALE_LABEL_LEDGER="$TMP_DIR/stale-label-home/.codex/spec-first/host-setup.json"
make_repo "$STALE_LABEL_REPO"
write_fixture_config "$STALE_LABEL_REPO" "$STALE_LABEL_LEDGER" true
mkdir -p "$STALE_LABEL_REPO/.gitnexus"
printf '{"remoteUrl":"https://gitee.com/sunnyrain/hr360.git"}\n' > "$STALE_LABEL_REPO/.gitnexus/meta.json"
stale_label_output="$(cd "$STALE_LABEL_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_QUERY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "stale GitNexus repo label degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$stale_label_output")"
assert_eq "stale GitNexus repo label is structured" "query-unverified:gitnexus-repo-label-mismatch:provider-projection-stale:query_probe:42" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.reason_code):\(.failure_class):\(.failed_phase):\(.exit_code)"' <<<"$stale_label_output")"
assert_contains "stale GitNexus repo label reason names projected label" "Hr360_temp" "$(jq -r '.results[] | select(.provider=="gitnexus") | .query_verification_reason' <<<"$stale_label_output")"
assert_contains "stale GitNexus repo label reason names current label" "hr360" "$(jq -r '.results[] | select(.provider=="gitnexus") | .query_verification_reason' <<<"$stale_label_output")"
assert_contains "stale GitNexus repo label recommends setup refresh" "Rerun spec-mcp-setup" "$(jq -r '.results[] | select(.provider=="gitnexus") | .recommended_action' <<<"$stale_label_output")"

FTS_EMPTY_REPO="$TMP_DIR/fts-empty-repo"
FTS_EMPTY_LEDGER="$TMP_DIR/fts-empty-home/.codex/spec-first/host-setup.json"
make_repo "$FTS_EMPTY_REPO"
write_fixture_config "$FTS_EMPTY_REPO" "$FTS_EMPTY_LEDGER" true
fts_empty_output="$(cd "$FTS_EMPTY_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_FTS_EMPTY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "FTS/read-only empty query result degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$fts_empty_output")"
assert_eq "FTS/read-only empty result is not query-ready" "query-unverified:true:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.graph_ready):\(.query_ready)"' <<<"$fts_empty_output")"
assert_eq "FTS/read-only diagnostic gets structured provider reason" "gitnexus-query-fts-readonly:provider-storage-readonly:query_probe:0" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.reason_code):\(.failure_class):\(.failed_phase):\(.exit_code)"' <<<"$fts_empty_output")"
assert_contains "FTS/read-only limitation is recorded" "FTS/read-only/missing-index" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$fts_empty_output")"
assert_contains "FTS/read-only recommended action is recorded" "Repair GitNexus index storage or permissions" "$(jq -r '.results[] | select(.provider=="gitnexus") | .recommended_action' <<<"$fts_empty_output")"
assert_contains "FTS/read-only recommended action names bounded fallback" "Use bounded source reads, git diff, ast-grep, tests, and logs meanwhile" "$(jq -r '.results[] | select(.provider=="gitnexus") | .recommended_action' <<<"$fts_empty_output")"

STALE_PACKAGE_REPO="$TMP_DIR/stale-package-repo"
STALE_PACKAGE_LEDGER="$TMP_DIR/stale-package-home/.codex/spec-first/host-setup.json"
make_repo "$STALE_PACKAGE_REPO"
write_fixture_config "$STALE_PACKAGE_REPO" "$STALE_PACKAGE_LEDGER" true
jq '
  .providers.gitnexus.commands.bootstrap[2] = "gitnexus@0.0.0-test"
  | .providers.gitnexus.commands.status[2] = "gitnexus@0.0.0-test"
  | .providers.gitnexus.commands.query_probe[2] = "gitnexus@0.0.0-test"
' "$STALE_PACKAGE_REPO/.spec-first/config/graph-providers.json" > "$STALE_PACKAGE_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$STALE_PACKAGE_REPO/.spec-first/config/graph-providers.json.tmp" "$STALE_PACKAGE_REPO/.spec-first/config/graph-providers.json"
stale_package_output="$(cd "$STALE_PACKAGE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "stale GitNexus projection is blocked before provider commands" "failed:false:false:preflight-blocked" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.graph_ready):\(.query_ready):\(.readiness_source)"' <<<"$stale_package_output")"
assert_eq "stale GitNexus projection recommends setup refresh" "gitnexus-provider-projection-stale:provider-projection-stale:preflight" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.reason_code):\(.failure_class):\(.failed_phase)"' <<<"$stale_package_output")"
assert_eq "stale GitNexus projection is not reuse eligible" "false:provider-projection-stale:projection-stale" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.reuse_eligible):\(.reuse_ineligible_reason):\(.bootstrap_fingerprint.provider.version_policy)"' <<<"$stale_package_output")"
assert_contains "stale package action names spec-mcp-setup" "Rerun spec-mcp-setup" "$(jq -r '.results[] | select(.provider=="gitnexus") | .recommended_action' <<<"$stale_package_output")"
assert_contains "stale package action names current projected package" "gitnexus@0.0.0-test" "$(jq -r '.results[] | select(.provider=="gitnexus") | .recommended_action' <<<"$stale_package_output")"
assert_not_contains "stale GitNexus package command is not executed" "gitnexus@0.0.0-test" "$(cat "$COMMAND_LOG")"

STALE_GITNEXUS_STATUS_REPO="$TMP_DIR/stale-gitnexus-status-repo"
STALE_GITNEXUS_STATUS_LEDGER="$TMP_DIR/stale-gitnexus-status-home/.codex/spec-first/host-setup.json"
make_repo "$STALE_GITNEXUS_STATUS_REPO"
write_fixture_config "$STALE_GITNEXUS_STATUS_REPO" "$STALE_GITNEXUS_STATUS_LEDGER" true
jq '
  .providers.gitnexus.commands.status[2] = "gitnexus@0.0.0-status"
' "$STALE_GITNEXUS_STATUS_REPO/.spec-first/config/graph-providers.json" > "$STALE_GITNEXUS_STATUS_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$STALE_GITNEXUS_STATUS_REPO/.spec-first/config/graph-providers.json.tmp" "$STALE_GITNEXUS_STATUS_REPO/.spec-first/config/graph-providers.json"
before_stale_gitnexus_status_log="$(cat "$COMMAND_LOG")"
stale_gitnexus_status_output="$(cd "$STALE_GITNEXUS_STATUS_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "mixed GitNexus status projection is blocked before provider commands" "failed:false:false:preflight-blocked" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.graph_ready):\(.query_ready):\(.readiness_source)"' <<<"$stale_gitnexus_status_output")"
assert_eq "mixed GitNexus status projection recommends setup refresh" "gitnexus-provider-projection-stale:provider-projection-stale:projection-stale" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.reason_code):\(.failure_class):\(.bootstrap_fingerprint.provider.version_policy)"' <<<"$stale_gitnexus_status_output")"
assert_eq "mixed GitNexus status projection does not execute provider commands" "$before_stale_gitnexus_status_log" "$(cat "$COMMAND_LOG")"

DEFINITIONS_ONLY_REPO="$TMP_DIR/definitions-only-repo"
DEFINITIONS_ONLY_LEDGER="$TMP_DIR/definitions-only-home/.codex/spec-first/host-setup.json"
make_repo "$DEFINITIONS_ONLY_REPO"
write_fixture_config "$DEFINITIONS_ONLY_REPO" "$DEFINITIONS_ONLY_LEDGER" true
definitions_only_output="$(cd "$DEFINITIONS_ONLY_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_DEFINITIONS_ONLY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "definitions-only query result is query-ready" "primary" "$(jq -r '.workflow_mode' <<<"$definitions_only_output")"
assert_eq "definitions-only result is ready for query/context" "ready:true:true:definitions-only" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.graph_ready):\(.query_ready):\(.query_probe_attempts[0].result_class)"' <<<"$definitions_only_output")"
assert_contains "definitions-only limitation is explicit" "Definitions-only GitNexus evidence" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$definitions_only_output")"
assert_eq "definitions-only does not carry query-unverified reason" "null" "$(jq -r '.results[] | select(.provider=="gitnexus") | .query_verification_reason | tostring' <<<"$definitions_only_output")"
assert_eq "definitions-only normalized architecture does not claim execution flow" "false:true" "$(jq -r '((.capabilities | index("execution_flow")) != null | tostring) + ":" + ((.limitations | index("definitions_only_no_process_graph")) != null | tostring)' "$DEFINITIONS_ONLY_REPO/.spec-first/providers/gitnexus/normalized/architecture-facts.json")"
assert_eq "definitions-only normalized impact stays query-only" "query,context|0|unavailable|unavailable|true" "$(jq -r '(.available_query_surfaces | join(",")) + "|" + (.impact_evidence_surfaces | length | tostring) + "|" + .review_support.support_level + "|" + .review_support.related_tests + "|" + ((.limitations | index("definitions_only_no_impact_evidence")) != null | tostring)' "$DEFINITIONS_ONLY_REPO/.spec-first/providers/gitnexus/normalized/impact-capabilities.json")"
assert_eq "definitions-only graph facts do not expose impact context" "true|false|unavailable|true" "$(jq -r '(.capabilities.query_global_graph | tostring) + "|" + (.capabilities.impact_context | tostring) + "|" + .capabilities.impact_context_status + "|" + ((.capabilities.impact_context_limitations | index("definitions_only_no_process_graph")) != null | tostring)' "$DEFINITIONS_ONLY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "definitions-only aggregate impact stays unavailable" "full:gitnexus|none:0:true|none:0:unavailable:true" "$(jq -r '.capabilities.context_selection.support_level + ":" + (.capabilities.context_selection.primary_providers | join(",")) + "|" + .capabilities.impact_radius.support_level + ":" + (.capabilities.impact_radius.primary_providers | length | tostring) + ":" + ((.capabilities.impact_radius.limitations | index("definitions_only_no_impact_evidence")) != null | tostring) + "|" + .capabilities.review_support.support_level + ":" + (.capabilities.review_support.primary_providers | length | tostring) + ":" + .capabilities.review_support.related_tests_status + ":" + ((.capabilities.review_support.limitations | index("definitions_only_no_related_tests")) != null | tostring)' "$DEFINITIONS_ONLY_REPO/.spec-first/impact/bootstrap-impact-capabilities.json")"
assert_eq "definitions-only skips GitNexus impact probe" "0" "$(jq '[.results[] | select(.provider=="gitnexus") | .command_results[] | select(.kind=="impact_probe")] | length' <<<"$definitions_only_output")"
assert_contains "bootstrap report includes probe token column" "Probe Token" "$(cat "$DEFINITIONS_ONLY_REPO/.spec-first/graph/bootstrap-report.md")"
assert_contains "bootstrap report includes definitions-only evidence" "Definitions-only GitNexus evidence" "$(cat "$DEFINITIONS_ONLY_REPO/.spec-first/graph/bootstrap-report.md")"

NO_SOURCE_DEFINITIONS_REPO="$TMP_DIR/no-source-definitions-repo"
NO_SOURCE_DEFINITIONS_LEDGER="$TMP_DIR/no-source-definitions-home/.codex/spec-first/host-setup.json"
make_repo "$NO_SOURCE_DEFINITIONS_REPO"
write_fixture_config "$NO_SOURCE_DEFINITIONS_REPO" "$NO_SOURCE_DEFINITIONS_LEDGER" true
jq '
  .providers.gitnexus.commands.query_probe[4] = "main src build README package"
  | .providers.gitnexus.query_probe_policy.expected_hit = false
  | .providers.gitnexus.query_probe_policy.source = "fallback-static"
  | .providers.gitnexus.query_probe_policy.token = "main src build README package"
  | .providers.gitnexus.query_probe_policy.selected_from = null
  | .providers.gitnexus.query_probe_policy.candidates = [
      {token:"main src build README package", selected_from:null, reason_code:"fallback-static"}
    ]
' "$NO_SOURCE_DEFINITIONS_REPO/.spec-first/config/graph-providers.json" > "$NO_SOURCE_DEFINITIONS_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$NO_SOURCE_DEFINITIONS_REPO/.spec-first/config/graph-providers.json.tmp" "$NO_SOURCE_DEFINITIONS_REPO/.spec-first/config/graph-providers.json"
no_source_definitions_output="$(cd "$NO_SOURCE_DEFINITIONS_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_NO_SOURCE_TOKEN_DEFINITIONS_ONLY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "no-source definitions-only fallback is query-ready" "primary:ready:true:definitions-only:false" "$(jq -r '.workflow_mode as $mode | .results[] | select(.provider=="gitnexus") | "\($mode):\(.status):\(.query_ready):\(.query_probe_attempts[0].result_class):\(.query_probe_policy.expected_hit)"' <<<"$no_source_definitions_output")"
assert_eq "no-source definitions-only fallback remains query-only" "true|false|unavailable|true" "$(jq -r '(.capabilities.query_global_graph | tostring) + "|" + (.capabilities.impact_context | tostring) + "|" + .capabilities.impact_context_status + "|" + ((.capabilities.impact_context_limitations | index("definitions_only_no_process_graph")) != null | tostring)' "$NO_SOURCE_DEFINITIONS_REPO/.spec-first/graph/graph-facts.json")"

NO_SOURCE_FALLBACK_REPO="$TMP_DIR/no-source-fallback-repo"
NO_SOURCE_FALLBACK_LEDGER="$TMP_DIR/no-source-fallback-home/.codex/spec-first/host-setup.json"
make_repo "$NO_SOURCE_FALLBACK_REPO"
write_fixture_config "$NO_SOURCE_FALLBACK_REPO" "$NO_SOURCE_FALLBACK_LEDGER" true
jq '
  .providers.gitnexus.commands.query_probe[4] = "main src build README package"
  | .providers.gitnexus.query_probe_policy.expected_hit = false
  | .providers.gitnexus.query_probe_policy.source = "fallback-static"
  | .providers.gitnexus.query_probe_policy.token = "main src build README package"
  | .providers.gitnexus.query_probe_policy.selected_from = null
  | .providers.gitnexus.query_probe_policy.candidates = [
      {token:"main src build README package", selected_from:null, reason_code:"fallback-static"}
    ]
' "$NO_SOURCE_FALLBACK_REPO/.spec-first/config/graph-providers.json" > "$NO_SOURCE_FALLBACK_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$NO_SOURCE_FALLBACK_REPO/.spec-first/config/graph-providers.json.tmp" "$NO_SOURCE_FALLBACK_REPO/.spec-first/config/graph-providers.json"
no_source_fallback_output="$(cd "$NO_SOURCE_FALLBACK_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_NO_SOURCE_TOKEN_EMPTY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "no-source fallback policy is not applicable not degraded" "no-source:not-applicable" "$(jq -r '"\(.workflow_mode):\(.overall_status)"' <<<"$no_source_fallback_output")"
assert_eq "no-source fallback keeps null selected_from" "null:fallback-static:empty-or-unparseable:false:query-not-applicable" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.query_probe_attempts[0].selected_from | tostring):\(.query_probe_attempts[0].reason_code):\(.query_probe_attempts[0].result_class):\(.query_ready):\(.status)"' <<<"$no_source_fallback_output")"
assert_eq "no-source fallback policy preserves nullable source pointer" "false:null:fallback-static" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.query_probe_policy.expected_hit):\(.query_probe_policy.selected_from | tostring):\(.query_probe_policy.source)"' <<<"$no_source_fallback_output")"
assert_eq "no-source fallback records structured reason" "gitnexus-query-not-applicable" "$(jq -r '.results[] | select(.provider=="gitnexus") | .reason_code' <<<"$no_source_fallback_output")"

SIGSEGV_REPO="$TMP_DIR/sigsegv-repo"
SIGSEGV_LEDGER="$TMP_DIR/sigsegv-home/.codex/spec-first/host-setup.json"
make_repo "$SIGSEGV_REPO"
write_fixture_config "$SIGSEGV_REPO" "$SIGSEGV_LEDGER" true
printf '# Host\n' > "$SIGSEGV_REPO/AGENTS.md"
git -C "$SIGSEGV_REPO" add AGENTS.md
git -C "$SIGSEGV_REPO" commit -q -m "Add host file"
sigsegv_output="$(cd "$SIGSEGV_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_ANALYZE_SIGSEGV=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "GitNexus sigsegv degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$sigsegv_output")"
assert_eq "GitNexus sigsegv has structured reason" "failed:gitnexus-analyze-sigsegv:provider-crash:bootstrap:139" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.reason_code):\(.failure_class):\(.failed_phase):\(.exit_code)"' <<<"$sigsegv_output")"
assert_contains "GitNexus sigsegv limitation recommends bounded fallback" "Use bounded local fallback" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$sigsegv_output")"
if grep -q '<!-- gitnexus:start -->' "$SIGSEGV_REPO/AGENTS.md"; then
  echo "FAIL: failed GitNexus bootstrap created host instruction block" >&2
  exit 1
fi

LBUG_REPO="$TMP_DIR/lbug-repo"
LBUG_LEDGER="$TMP_DIR/lbug-home/.codex/spec-first/host-setup.json"
make_repo "$LBUG_REPO"
write_fixture_config "$LBUG_REPO" "$LBUG_LEDGER" true
lbug_output="$(cd "$LBUG_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_LBUG=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "GitNexus lbug storage failure degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$lbug_output")"
assert_eq "GitNexus lbug storage failure has structured reason" "failed:gitnexus-analyze-storage-write-failed:provider-storage-write-failed:bootstrap:1" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.reason_code):\(.failure_class):\(.failed_phase):\(.exit_code)"' <<<"$lbug_output")"
assert_contains "GitNexus lbug limitation names index state" ".gitnexus/lbug" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$lbug_output")"
assert_contains "GitNexus lbug raw log preserves provider diagnostic" "Cannot open file" "$(cat "$LBUG_REPO/.spec-first/providers/gitnexus/raw/analyze.log")"

NETWORK_REPO="$TMP_DIR/network-repo"
NETWORK_LEDGER="$TMP_DIR/network-home/.codex/spec-first/host-setup.json"
make_repo "$NETWORK_REPO"
write_fixture_config "$NETWORK_REPO" "$NETWORK_LEDGER" true
network_output="$(cd "$NETWORK_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_NETWORK=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "GitNexus network failure degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$network_output")"
assert_eq "GitNexus network failure is environment classified" "failed:provider-network-unavailable:provider-environment:bootstrap:1" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.reason_code):\(.failure_class):\(.failed_phase):\(.exit_code)"' <<<"$network_output")"
assert_contains "GitNexus network failure recommends network/cache fix" "registry or network resolution failed" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$network_output")"

TIMEOUT_REPO="$TMP_DIR/timeout-repo"
TIMEOUT_LEDGER="$TMP_DIR/timeout-home/.codex/spec-first/host-setup.json"
make_repo "$TIMEOUT_REPO"
write_fixture_config "$TIMEOUT_REPO" "$TIMEOUT_LEDGER" true
timeout_output="$(cd "$TIMEOUT_REPO" && PATH="$TEST_PATH" SPEC_FIRST_PROVIDER_COMMAND_TIMEOUT_SECONDS=1 HANG_GITNEXUS_ANALYZE=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "GitNexus timeout degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$timeout_output")"
assert_eq "GitNexus timeout has structured reason" "failed:provider-command-timeout:provider-timeout:bootstrap:124" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.reason_code):\(.failure_class):\(.failed_phase):\(.exit_code)"' <<<"$timeout_output")"
assert_contains "GitNexus timeout raw log records timeout" "command timed out after 1s" "$(cat "$TIMEOUT_REPO/.spec-first/providers/gitnexus/raw/analyze.log")"

NO_FALLBACK_REPO="$TMP_DIR/no-fallback-repo"
NO_FALLBACK_LEDGER="$TMP_DIR/no-fallback-home/.codex/spec-first/host-setup.json"
make_repo "$NO_FALLBACK_REPO"
write_fixture_config "$NO_FALLBACK_REPO" "$NO_FALLBACK_LEDGER" true
jq '.fallback_capabilities |= with_entries(.value.support_level = "none")' "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json" > "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json.tmp"
mv "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json.tmp" "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json"
set +e
no_fallback_output="$(cd "$NO_FALLBACK_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_QUERY=1 bash "$BOOTSTRAP_SCRIPT")"
no_fallback_status=$?
set -e
assert_eq "no providers and no fallback blocks" "1" "$no_fallback_status"
assert_eq "blocked workflow without fallback" "blocked" "$(jq -r '.workflow_mode' <<<"$no_fallback_output")"
assert_eq "blocked impact capabilities fail closed" "none,none,none" "$(jq -r '[.capabilities.context_selection.support_level,.capabilities.impact_radius.support_level,.capabilities.review_support.support_level] | join(",")' "$NO_FALLBACK_REPO/.spec-first/impact/bootstrap-impact-capabilities.json")"

BASELINE_NOT_READY_REPO="$TMP_DIR/baseline-not-ready-repo"
BASELINE_NOT_READY_LEDGER="$TMP_DIR/baseline-not-ready-home/.codex/spec-first/host-setup.json"
make_repo "$BASELINE_NOT_READY_REPO"
write_fixture_config "$BASELINE_NOT_READY_REPO" "$BASELINE_NOT_READY_LEDGER" false
before_baseline_not_ready_log="$(cat "$COMMAND_LOG")"
set +e
baseline_not_ready_output="$(cd "$BASELINE_NOT_READY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
baseline_not_ready_status=$?
set -e
assert_eq "baseline not ready fails" "1" "$baseline_not_ready_status"
assert_eq "baseline not ready workflow mode" "setup-not-ready" "$(jq -r '.workflow_mode' <<<"$baseline_not_ready_output")"
assert_eq "baseline not ready reason" "baseline_not_ready" "$(jq -r '.reason_code' <<<"$baseline_not_ready_output")"
assert_eq "baseline not ready does not run providers" "$before_baseline_not_ready_log" "$(cat "$COMMAND_LOG")"

CONFLICT_REPO="$TMP_DIR/conflict-repo"
CONFLICT_LEDGER="$TMP_DIR/conflict-home/.codex/spec-first/host-setup.json"
make_repo "$CONFLICT_REPO"
write_fixture_config "$CONFLICT_REPO" "$CONFLICT_LEDGER" true
# U2: runtime-capabilities/ledger baseline 不一致由 spec-mcp-setup 自愈,
# bootstrap 不再替 setup 在此场景 fail-closed; 只要 ledger.baseline_ready=true,
# bootstrap 应继续运行 provider 命令并产出可用结果。
jq '.baseline_summary.baseline_ready = false' "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json" > "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json.tmp"
mv "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json.tmp" "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json"
set +e
conflict_output="$(cd "$CONFLICT_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
conflict_status=$?
set -e
assert_eq "host-pointer drift no longer fail-closes bootstrap" "0" "$conflict_status"
assert_eq "host-pointer drift reason is null" "null" "$(jq -r '.reason_code // "null"' <<<"$conflict_output")"

echo "=== spec-graph-bootstrap compiler tests passed ==="
