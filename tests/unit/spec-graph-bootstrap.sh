#!/bin/bash
# spec-graph-bootstrap compiler behavior tests

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BOOTSTRAP_SCRIPT="$REPO_ROOT/skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh"
TOOLS_JSON="$REPO_ROOT/skills/spec-mcp-setup/mcp-tools.json"
GITNEXUS_PACKAGE="$(jq -r '.tools[] | select(.id == "gitnexus") | .installation.unix.args[1]' "$TOOLS_JSON")"
GITNEXUS_QUERY_PROBE="main src build README package"
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
if [[ "\${FAIL_GITNEXUS_QUERY:-}" = "1" && " \$* " == *" gitnexus@"*" query "* ]]; then
  echo "query failed" >&2
  exit 42
fi
if [[ " \$* " == *" gitnexus@"*" query "* ]]; then
  if [[ "\${GITNEXUS_QUERY_FTS_EMPTY:-}" = "1" ]]; then
    echo "FTS index ensure failed: Cannot execute write operations in a read-only database" >&2
    printf '{"processes":[],"process_symbols":[],"definitions":[]}\n'
    exit 0
  fi
  printf '{"processes":[{"name":"probe"}],"process_symbols":[],"definitions":[]}\n'
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
        "bootstrap": ["npx", "-y", "$GITNEXUS_PACKAGE", "analyze"],
        "status": ["npx", "-y", "$GITNEXUS_PACKAGE", "status"],
        "query_probe": ["npx", "-y", "$GITNEXUS_PACKAGE", "query", "$GITNEXUS_QUERY_PROBE", "--repo", "$(basename "$repo_root")"]
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
  "providers": {},
  "canonical": {
    "provider_status": ".spec-first/graph/provider-status.json",
    "graph_facts": ".spec-first/graph/graph-facts.json",
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
assert_contains "runs gitnexus analyze" "npx -y $GITNEXUS_PACKAGE analyze" "$(cat "$COMMAND_LOG")"
assert_contains "runs gitnexus query proof" "npx -y $GITNEXUS_PACKAGE query $GITNEXUS_QUERY_PROBE --repo $(basename "$PRIMARY_REPO_ROOT")" "$(cat "$COMMAND_LOG")"
assert_contains "runs latest code-review-graph query proof" "uvx --upgrade code-review-graph status --repo $PRIMARY_REPO_ROOT" "$(cat "$COMMAND_LOG")"
assert "provider status aggregate exists" test -f "$PRIMARY_REPO/.spec-first/graph/provider-status.json"
assert "graph facts exists" test -f "$PRIMARY_REPO/.spec-first/graph/graph-facts.json"
assert "impact capabilities exists" test -f "$PRIMARY_REPO/.spec-first/impact/bootstrap-impact-capabilities.json"
assert "provider raw log exists" test -f "$PRIMARY_REPO/.spec-first/providers/gitnexus/raw/analyze.log"
assert "normalized artifact exists" test -f "$PRIMARY_REPO/.spec-first/providers/code-review-graph/normalized/impact-capabilities.json"
assert "old graph raw path is not used" test ! -e "$PRIMARY_REPO/.spec-first/graph/raw/gitnexus"
assert_eq "provider status records command source" ".spec-first/config/graph-providers.json" "$(jq -r '.command_source' "$PRIMARY_REPO/.spec-first/providers/gitnexus/status.json")"
assert_eq "graph-bootstrap does not mutate provider config input" "$primary_provider_config_before" "$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/graph-providers.json")"
assert_eq "graph-bootstrap does not mutate runtime capabilities input" "$primary_runtime_capabilities_before" "$(jq -S -c . "$PRIMARY_REPO/.spec-first/config/runtime-capabilities.json")"

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
