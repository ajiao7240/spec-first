#!/bin/bash
# spec-graph-bootstrap compiler behavior tests

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BOOTSTRAP_SCRIPT="$REPO_ROOT/skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh"
TOOLS_JSON="$REPO_ROOT/skills/spec-mcp-setup/mcp-tools.json"
GITNEXUS_PACKAGE="$(jq -r '.tools[] | select(.id == "gitnexus") | .installation.unix.args[1]' "$TOOLS_JSON")"
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

make_fake_bin() {
  local bin_dir="$1"
  local log_file="$2"
  mkdir -p "$bin_dir"
  ln -s "$(command -v jq)" "$bin_dir/jq"
cat > "$bin_dir/npx" <<SH
#!/bin/bash
echo "npx \$*" >> "$log_file"
if [[ "\${FAIL_GITNEXUS_ANALYZE_SIGSEGV:-}" = "1" && " \$* " == *" gitnexus@"*" analyze "* ]]; then
  echo "Segmentation fault: 11" >&2
  exit 139
fi
if [[ "\${FAIL_GITNEXUS_QUERY:-}" = "1" && " \$* " == *" gitnexus@"*" query "* ]]; then
  echo "query failed" >&2
  exit 42
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
  if [[ "\${GITNEXUS_QUERY_SECOND_CANDIDATE_SUCCEEDS:-}" = "1" && "\$query_token" != "$GITNEXUS_QUERY_PROBE" ]]; then
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
if [[ "\${FAIL_CRG_BUILD:-}" = "1" && " \$* " == *" code-review-graph build "* ]]; then
  echo "build failed" >&2
  exit 43
fi
exit 0
SH
  chmod +x "$bin_dir/npx" "$bin_dir/uvx"
}

make_repo() {
  local repo_dir="$1"
  mkdir -p "$repo_dir"
  git -C "$repo_dir" init -q
  git -C "$repo_dir" config user.name "Spec First Test"
  git -C "$repo_dir" config user.email "spec-first-test@example.invalid"
  git -C "$repo_dir" config core.hooksPath /dev/null
  printf '# fixture\n' > "$repo_dir/README.md"
  git -C "$repo_dir" add README.md
  git -C "$repo_dir" commit -q -m "Initial fixture commit"
  mkdir -p "$repo_dir/.spec-first/config"
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
        "bootstrap": ["npx", "-y", "$GITNEXUS_PACKAGE", "analyze", "--force"],
        "status": ["npx", "-y", "$GITNEXUS_PACKAGE", "status"],
        "query_probe": ["npx", "-y", "$GITNEXUS_PACKAGE", "query", "$GITNEXUS_QUERY_PROBE", "--repo", "$(basename "$repo_root")"]
      },
      "query_probe_policy": {
        "expected_hit": true,
        "source": "git-ls-files-code-basename",
        "token": "$GITNEXUS_QUERY_PROBE",
        "selected_from": "trade/src/main/java/com/hstong/trade/tradelogin/login/ui/TradeLoginActivity.java"
      }
    },
    "code-review-graph": {
      "configured": true,
      "enabled_for_bootstrap": true,
      "dependency_status": "ready",
      "host_config_status": "ready",
      "commands": {
        "bootstrap": ["uvx", "--upgrade", "code-review-graph", "build"],
        "status": ["uvx", "--upgrade", "code-review-graph", "status"],
        "query_probe": ["uvx", "--upgrade", "code-review-graph", "status", "--repo", "$repo_root"]
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
        "query_probe": ".spec-first/providers/gitnexus/raw/query.log"
      },
      "normalized_artifacts": {
        "architecture_facts": ".spec-first/providers/gitnexus/normalized/architecture-facts.json",
        "reuse_candidates": ".spec-first/providers/gitnexus/normalized/reuse-candidates.json"
      }
    },
    "code-review-graph": {
      "raw_dir": ".spec-first/providers/code-review-graph/raw",
      "normalized_dir": ".spec-first/providers/code-review-graph/normalized",
      "status_path": ".spec-first/providers/code-review-graph/status.json",
      "raw_logs": {
        "bootstrap": ".spec-first/providers/code-review-graph/raw/build.log",
        "status": ".spec-first/providers/code-review-graph/raw/status.log",
        "query_probe": ".spec-first/providers/code-review-graph/raw/query.log"
      },
      "normalized_artifacts": {
        "impact_capabilities": ".spec-first/providers/code-review-graph/normalized/impact-capabilities.json"
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

echo "=== spec-graph-bootstrap compiler tests ==="

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
before_workspace_block_log="$(cat "$COMMAND_LOG")"
set +e
workspace_block_output="$(cd "$TMP_DIR/workspace" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
workspace_block_status=$?
set -e
assert_eq "workspace parent without repo fails closed" "1" "$workspace_block_status"
assert_eq "workspace parent reason requires target" "workspace-target-required" "$(jq -r '.reason_code' <<<"$workspace_block_output")"
assert_eq "workspace parent lists child candidates" "2" "$(jq -r '.candidates | length' <<<"$workspace_block_output")"
assert_eq "workspace parent does not run providers" "$before_workspace_block_log" "$(cat "$COMMAND_LOG")"
assert "workspace parent does not create graph artifacts" test ! -e "$TMP_DIR/workspace/.spec-first/graph"

SINGLE_WORKSPACE="$TMP_DIR/single-workspace"
make_repo "$SINGLE_WORKSPACE/project-only"
before_single_block_log="$(cat "$COMMAND_LOG")"
set +e
single_block_output="$(cd "$SINGLE_WORKSPACE" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
single_block_status=$?
set -e
assert_eq "single child workspace also fails closed" "1" "$single_block_status"
assert_eq "single child workspace remains target-required" "workspace-target-required" "$(jq -r '.reason_code' <<<"$single_block_output")"
assert_eq "single child workspace does not run providers" "$before_single_block_log" "$(cat "$COMMAND_LOG")"

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
assert_contains "workspace explicit child runs provider from child root" "uvx --upgrade code-review-graph status --repo $WORKSPACE_REPO_A_ROOT" "$(cat "$COMMAND_LOG")"

PRIMARY_REPO="$TMP_DIR/primary-repo"
PRIMARY_LEDGER="$TMP_DIR/primary-home/.codex/spec-first/host-setup.json"
make_repo "$PRIMARY_REPO"
write_fixture_config "$PRIMARY_REPO" "$PRIMARY_LEDGER" true
primary_provider_config_before="$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/graph-providers.json")"
primary_runtime_capabilities_before="$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/runtime-capabilities.json")"

primary_output="$(cd "$PRIMARY_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
PRIMARY_REPO_ROOT="$(cd "$PRIMARY_REPO" && pwd -P)"
assert "primary output is JSON" jq -e . <<<"$primary_output"
assert_eq "primary workflow mode" "primary" "$(jq -r '.workflow_mode' <<<"$primary_output")"
assert_contains "runs gitnexus analyze with force rebuild" "npx -y $GITNEXUS_PACKAGE analyze --force" "$(cat "$COMMAND_LOG")"
assert_contains "runs gitnexus query proof" "npx -y $GITNEXUS_PACKAGE query $GITNEXUS_QUERY_PROBE --repo $(basename "$PRIMARY_REPO_ROOT")" "$(cat "$COMMAND_LOG")"
assert_contains "runs latest code-review-graph query proof" "uvx --upgrade code-review-graph status --repo $PRIMARY_REPO_ROOT" "$(cat "$COMMAND_LOG")"
assert "provider status aggregate exists" test -f "$PRIMARY_REPO/.spec-first/graph/provider-status.json"
assert "graph facts exists" test -f "$PRIMARY_REPO/.spec-first/graph/graph-facts.json"
assert "impact capabilities exists" test -f "$PRIMARY_REPO/.spec-first/impact/bootstrap-impact-capabilities.json"
assert "provider raw log exists" test -f "$PRIMARY_REPO/.spec-first/providers/gitnexus/raw/analyze.log"
assert "normalized artifact exists" test -f "$PRIMARY_REPO/.spec-first/providers/code-review-graph/normalized/impact-capabilities.json"
assert "old graph raw path is not used" test ! -e "$PRIMARY_REPO/.spec-first/graph/raw/gitnexus"
assert_eq "graph facts source revision is a commit SHA" "true" "$(jq -r '.source_revision | test("^[0-9a-f]{40}$")' "$PRIMARY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "graph facts exposes capability booleans" "true:true" "$(jq -r '(.capabilities.query_global_graph | tostring) + ":" + (.capabilities.impact_context | tostring)' "$PRIMARY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "graph facts exposes staleness hints" "true:true" "$(jq -r '(.staleness_hints.compare_source_revision | tostring) + ":" + (.staleness_hints.compare_worktree_dirty | tostring)' "$PRIMARY_REPO/.spec-first/graph/graph-facts.json")"
assert_eq "provider status records command source" ".spec-first/config/graph-providers.json" "$(jq -r '.command_source' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "provider status records expected-hit query policy" "true:git-ls-files-code-basename:$GITNEXUS_QUERY_PROBE" "$(jq -r '.query_probe_policy | "\(.expected_hit):\(.source):\(.token)"' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "graph-bootstrap does not mutate provider config input" "$primary_provider_config_before" "$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/graph-providers.json")"
assert_eq "graph-bootstrap does not mutate runtime capabilities input" "$primary_runtime_capabilities_before" "$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/runtime-capabilities.json")"

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
assert_eq "multi-candidate attempts are recorded" "2:definitions-only:process-results:true" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.query_probe_attempts | length):\(.query_probe_attempts[0].result_class):\(.query_probe_attempts[1].result_class):\(.query_ready)"' <<<"$multi_probe_output")"
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
truncated_probe_output="$(cd "$TRUNCATED_PROBE_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_DEFINITIONS_ONLY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "multi-candidate probe enforces consumer-side limit" "5:true:5:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.query_probe_attempts | length):\(.query_probe_candidates_truncated):\(.query_probe_candidate_limit):\(.query_ready)"' <<<"$truncated_probe_output")"
assert_contains "truncated candidate limitation is explicit" "Only the first 5 bounded GitNexus query probe candidates were attempted" "$(jq -r '.results[] | select(.provider=="gitnexus") | .query_verification_reason' <<<"$truncated_probe_output")"
assert "sixth truncated query log is not created" test ! -f "$TRUNCATED_PROBE_REPO/.spec-first/providers/gitnexus/raw/query-6.log"

VERSIONED_REPO="$TMP_DIR/versioned-command-repo"
VERSIONED_LEDGER="$TMP_DIR/versioned-home/.codex/spec-first/host-setup.json"
make_repo "$VERSIONED_REPO"
write_fixture_config "$VERSIONED_REPO" "$VERSIONED_LEDGER" true
jq '.providers.gitnexus.commands.bootstrap = ["npx","-y","gitnexus@1.2.3","analyze"]' "$VERSIONED_REPO/.spec-first/config/graph-providers.json" > "$VERSIONED_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$VERSIONED_REPO/.spec-first/config/graph-providers.json.tmp" "$VERSIONED_REPO/.spec-first/config/graph-providers.json"
versioned_output="$(cd "$VERSIONED_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "safe command array variation remains accepted" "primary" "$(jq -r '.workflow_mode' <<<"$versioned_output")"
assert_contains "bootstrap executes command from config array" "npx -y gitnexus@1.2.3 analyze" "$(cat "$COMMAND_LOG")"

DISABLED_REPO="$TMP_DIR/disabled-provider-repo"
DISABLED_LEDGER="$TMP_DIR/disabled-home/.codex/spec-first/host-setup.json"
make_repo "$DISABLED_REPO"
write_fixture_config "$DISABLED_REPO" "$DISABLED_LEDGER" true
jq '.providers["code-review-graph"].enabled_for_bootstrap = false' "$DISABLED_REPO/.spec-first/config/graph-providers.json" > "$DISABLED_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$DISABLED_REPO/.spec-first/config/graph-providers.json.tmp" "$DISABLED_REPO/.spec-first/config/graph-providers.json"
disabled_output="$(cd "$DISABLED_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
assert_eq "disabled provider uses fallback workflow" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$disabled_output")"
assert_eq "disabled provider status keeps real enabled flag" "false:disabled-for-bootstrap" "$(jq -r '.results[] | select(.provider=="code-review-graph") | "\(.enabled_for_bootstrap):\(.skip_reason)"' <<<"$disabled_output")"
assert_eq "disabled provider is skipped not failed" "true" "$(jq -r '(.skipped_primary_providers | index("code-review-graph") != null) and (.failed_primary_providers | index("code-review-graph") == null)' "$DISABLED_REPO/.spec-first/graph/provider-status.json")"
assert_eq "disabled provider is skipped not degraded in graph facts" "false:true" "$(jq -r '(.provider_summary.degraded_providers | index("code-review-graph") != null | tostring) + ":" + (.provider_summary.skipped_primary_providers | index("code-review-graph") != null | tostring)' "$DISABLED_REPO/.spec-first/graph/graph-facts.json")"

DISABLED_UNSAFE_REPO="$TMP_DIR/disabled-unsafe-repo"
DISABLED_UNSAFE_LEDGER="$TMP_DIR/disabled-unsafe-home/.codex/spec-first/host-setup.json"
make_repo "$DISABLED_UNSAFE_REPO"
write_fixture_config "$DISABLED_UNSAFE_REPO" "$DISABLED_UNSAFE_LEDGER" true
jq '.providers["code-review-graph"].enabled_for_bootstrap = false | .providers["code-review-graph"].commands.bootstrap = ["bash","-c","echo unsafe"]' "$DISABLED_UNSAFE_REPO/.spec-first/config/graph-providers.json" > "$DISABLED_UNSAFE_REPO/.spec-first/config/graph-providers.json.tmp"
mv "$DISABLED_UNSAFE_REPO/.spec-first/config/graph-providers.json.tmp" "$DISABLED_UNSAFE_REPO/.spec-first/config/graph-providers.json"
before_disabled_unsafe_log="$(cat "$COMMAND_LOG")"
set +e
disabled_unsafe_output="$(cd "$DISABLED_UNSAFE_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
disabled_unsafe_status=$?
set -e
assert_eq "disabled unsafe provider fails closed" "1" "$disabled_unsafe_status"
assert_eq "disabled unsafe provider reason" "unsupported-provider-command" "$(jq -r '.reason_code' <<<"$disabled_unsafe_output")"
assert_eq "disabled unsafe provider is not executed" "$before_disabled_unsafe_log" "$(cat "$COMMAND_LOG")"

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

FTS_EMPTY_REPO="$TMP_DIR/fts-empty-repo"
FTS_EMPTY_LEDGER="$TMP_DIR/fts-empty-home/.codex/spec-first/host-setup.json"
make_repo "$FTS_EMPTY_REPO"
write_fixture_config "$FTS_EMPTY_REPO" "$FTS_EMPTY_LEDGER" true
fts_empty_output="$(cd "$FTS_EMPTY_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_FTS_EMPTY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "FTS/read-only empty query result degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$fts_empty_output")"
assert_eq "FTS/read-only empty result is not query-ready" "query-unverified:true:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.graph_ready):\(.query_ready)"' <<<"$fts_empty_output")"
assert_contains "FTS/read-only limitation is recorded" "FTS/read-only/missing-index" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$fts_empty_output")"

DEFINITIONS_ONLY_REPO="$TMP_DIR/definitions-only-repo"
DEFINITIONS_ONLY_LEDGER="$TMP_DIR/definitions-only-home/.codex/spec-first/host-setup.json"
make_repo "$DEFINITIONS_ONLY_REPO"
write_fixture_config "$DEFINITIONS_ONLY_REPO" "$DEFINITIONS_ONLY_LEDGER" true
definitions_only_output="$(cd "$DEFINITIONS_ONLY_REPO" && PATH="$TEST_PATH" GITNEXUS_QUERY_DEFINITIONS_ONLY=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "definitions-only query result degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$definitions_only_output")"
assert_eq "definitions-only result is not query-ready" "query-unverified:true:false" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.graph_ready):\(.query_ready)"' <<<"$definitions_only_output")"
assert_contains "definitions-only limitation is explicit" "definitions-only evidence" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$definitions_only_output")"
assert_contains "definitions-only reason is structured" "definitions-only evidence" "$(jq -r '.results[] | select(.provider=="gitnexus") | .query_verification_reason' <<<"$definitions_only_output")"
assert_contains "bootstrap report includes probe token column" "Probe Token" "$(cat "$DEFINITIONS_ONLY_REPO/.spec-first/graph/bootstrap-report.md")"
assert_contains "bootstrap report includes definitions-only evidence" "definitions-only evidence" "$(cat "$DEFINITIONS_ONLY_REPO/.spec-first/graph/bootstrap-report.md")"

SIGSEGV_REPO="$TMP_DIR/sigsegv-repo"
SIGSEGV_LEDGER="$TMP_DIR/sigsegv-home/.codex/spec-first/host-setup.json"
make_repo "$SIGSEGV_REPO"
write_fixture_config "$SIGSEGV_REPO" "$SIGSEGV_LEDGER" true
sigsegv_output="$(cd "$SIGSEGV_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_ANALYZE_SIGSEGV=1 bash "$BOOTSTRAP_SCRIPT")"
assert_eq "GitNexus sigsegv degrades with fallback" "degraded-fallback" "$(jq -r '.workflow_mode' <<<"$sigsegv_output")"
assert_eq "GitNexus sigsegv has structured reason" "failed:gitnexus-analyze-sigsegv:provider-crash:bootstrap:139" "$(jq -r '.results[] | select(.provider=="gitnexus") | "\(.status):\(.reason_code):\(.failure_class):\(.failed_phase):\(.exit_code)"' <<<"$sigsegv_output")"
assert_contains "GitNexus sigsegv limitation recommends fallback" "Do not trust GitNexus artifacts" "$(jq -r '.results[] | select(.provider=="gitnexus") | .limitations | join(" ")' <<<"$sigsegv_output")"

NO_FALLBACK_REPO="$TMP_DIR/no-fallback-repo"
NO_FALLBACK_LEDGER="$TMP_DIR/no-fallback-home/.codex/spec-first/host-setup.json"
make_repo "$NO_FALLBACK_REPO"
write_fixture_config "$NO_FALLBACK_REPO" "$NO_FALLBACK_LEDGER" true
jq '.fallback_capabilities |= with_entries(.value.support_level = "none")' "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json" > "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json.tmp"
mv "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json.tmp" "$NO_FALLBACK_REPO/.spec-first/config/runtime-capabilities.json"
set +e
no_fallback_output="$(cd "$NO_FALLBACK_REPO" && PATH="$TEST_PATH" FAIL_GITNEXUS_QUERY=1 FAIL_CRG_BUILD=1 bash "$BOOTSTRAP_SCRIPT")"
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
jq '.baseline_summary.baseline_ready = false' "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json" > "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json.tmp"
mv "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json.tmp" "$CONFLICT_REPO/.spec-first/config/runtime-capabilities.json"
before_conflict_log="$(cat "$COMMAND_LOG")"
set +e
conflict_output="$(cd "$CONFLICT_REPO" && PATH="$TEST_PATH" bash "$BOOTSTRAP_SCRIPT")"
conflict_status=$?
set -e
assert_eq "readiness conflict fails" "1" "$conflict_status"
assert_eq "readiness conflict reason" "readiness-conflict" "$(jq -r '.reason_code' <<<"$conflict_output")"
assert_eq "readiness conflict does not run providers" "$before_conflict_log" "$(cat "$COMMAND_LOG")"

echo "=== spec-graph-bootstrap compiler tests passed ==="
