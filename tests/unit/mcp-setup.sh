#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL_DIR="$REPO_ROOT/skills/spec-mcp-setup"
SCRIPTS_DIR="$SKILL_DIR/scripts"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
WRITE_SETUP_FACTS="$SCRIPTS_DIR/write-setup-facts.sh"
SPEC_FIRST_CLI="$REPO_ROOT/bin/spec-first.js"

pass_count=0

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_eq() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" != "$actual" ]; then
    fail "$label: expected [$expected], got [$actual]"
  fi
  pass_count=$((pass_count + 1))
}

assert() {
  local label="$1"
  shift
  if ! "$@"; then
    fail "$label"
  fi
  pass_count=$((pass_count + 1))
}

command -v jq >/dev/null 2>&1 || fail "jq is required"
command -v node >/dev/null 2>&1 || fail "node is required"

assert_eq "registry schema version" "6" "$(jq -r '.schema_version' "$TOOLS_JSON")"
assert_eq "tool ids are current" "sequential-thinking,context7" "$(jq -r '[.tools[].id] | join(",")' "$TOOLS_JSON")"
assert_eq "registry categories are mcp only" "true" "$(jq -r 'all(.tools[]; .category == "mcp")' "$TOOLS_JSON")"
assert_eq "all tools are required" "true" "$(jq -r 'all(.tools[]; .required == true)' "$TOOLS_JSON")"
assert_eq "summary includes project bootstrap column" "true" "$(jq -r '.summary_columns | index("project_bootstrap") != null' "$TOOLS_JSON")"

while IFS= read -r script_path; do
  bash -n "$script_path"
done < <(find "$SCRIPTS_DIR" -name '*.sh' -type f | sort)
pass_count=$((pass_count + 1))

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/spec-first-mcp-setup.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT

REPO_A="$TMP_ROOT/repo-a"
mkdir -p "$REPO_A"
printf '{"name":"repo-a"}\n' > "$REPO_A/package.json"
FACTS_FILE="$TMP_ROOT/facts.json"
cat > "$FACTS_FILE" <<JSON
{
  "repo_status": "git-repo",
  "repo_root": "$REPO_A",
  "host": "codex",
  "platform": "macos",
  "baseline_ready": true,
  "host_runtime_ready": true,
  "tools": {
    "context7": {
      "status": "ready"
    }
  },
  "helper_tools": {
    "node": {
      "status": "ready"
    }
  },
  "target": {
    "target_kind": "git-repo",
    "target_root": "$REPO_A",
    "workspace_root": "$REPO_A",
    "state_write_allowed": true,
    "reason_code": "explicit-repo-target"
  },
  "host_ledger_pointer": {
    "host": "codex",
    "path": "$TMP_ROOT/ledger.json"
  }
}
JSON

setup_output="$(bash "$WRITE_SETUP_FACTS" --facts-file "$FACTS_FILE")"
assert_eq "setup writer reason" "setup-facts-ready" "$(jq -r '.reason_code' <<<"$setup_output")"
assert "tool facts file exists" test -f "$REPO_A/.spec-first/config/tool-facts.json"
assert "runtime facts file exists" test -f "$REPO_A/.spec-first/config/runtime-capabilities.json"
assert_eq "tool facts schema" "tool-facts.v1" "$(jq -r '.schema_version' "$REPO_A/.spec-first/config/tool-facts.json")"
assert_eq "runtime facts schema" "runtime-capabilities.v1" "$(jq -r '.schema_version' "$REPO_A/.spec-first/config/runtime-capabilities.json")"
assert_eq "direct evidence facts are available" "true" "$(jq -r '.direct_evidence.bounded_source_reads and .direct_evidence.ripgrep and .direct_evidence.git_diff' "$REPO_A/.spec-first/config/runtime-capabilities.json")"

REPO_SYMLINK="$TMP_ROOT/repo-symlink"
OUTSIDE_CONFIG="$TMP_ROOT/outside-config"
mkdir -p "$REPO_SYMLINK/.spec-first" "$OUTSIDE_CONFIG"
ln -s "$OUTSIDE_CONFIG" "$REPO_SYMLINK/.spec-first/config"
SYMLINK_FACTS="$TMP_ROOT/symlink-facts.json"
cat > "$SYMLINK_FACTS" <<JSON
{
  "repo_status": "git-repo",
  "repo_root": "$REPO_SYMLINK",
  "target": {
    "target_kind": "git-repo",
    "target_root": "$REPO_SYMLINK",
    "state_write_allowed": true
  }
}
JSON
symlink_output="$(bash "$WRITE_SETUP_FACTS" --facts-file "$SYMLINK_FACTS")"
assert_eq "setup writer blocks symlinked config" "project-config-symlink-escape" "$(jq -r '.reason_code' <<<"$symlink_output")"
assert "symlink target remains empty" test ! -f "$OUTSIDE_CONFIG/tool-facts.json"

git -C "$REPO_A" init >/dev/null
git -C "$REPO_A" config user.email "test@example.com"
git -C "$REPO_A" config user.name "Spec Test"
git -C "$REPO_A" add package.json .spec-first/config/tool-facts.json .spec-first/config/runtime-capabilities.json
git -C "$REPO_A" commit --no-verify -m "initial" >/dev/null
printf 'changed\n' > "$REPO_A/src.txt"

fingerprint_output="$(node "$SPEC_FIRST_CLI" internal compute-scenario-fingerprint --layer setup --workspace-root "$REPO_A")"
assert_eq "scenario fingerprint setup schema" "developer-scenario-fingerprint-setup.v1" "$(jq -r '.schema_version' <<<"$fingerprint_output")"
assert_eq "scenario fingerprint uses source dirty field" "true" "$(jq -r '.complexity_dimensions | has("worktree_dirty_source_affecting")' <<<"$fingerprint_output")"
assert_eq "dirty path sample uses source flag" "true" "$(jq -r '([.worktree.dirty_paths_sample[]? | has("source_affecting")] | all)' <<<"$fingerprint_output")"

echo "mcp-setup unit checks passed: $pass_count"
