#!/bin/bash
# lang-policy unit tests
# Tests applyManagedBlock, buildManagedBlock (via lang-policy.js) and bootstrapChangelog

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

assert() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc"
    fail=$((fail + 1))
  fi
}

assert_output() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: expected '$expected', got '$actual'"
    fail=$((fail + 1))
  fi
}

assert_contains() {
  local desc="$1"
  local needle="$2"
  local haystack="$3"
  if printf '%s' "$haystack" | grep -qF -- "$needle"; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: '$needle' not found in output"
    fail=$((fail + 1))
  fi
}

assert_not_contains() {
  local desc="$1"
  local needle="$2"
  local haystack="$3"
  if ! printf '%s' "$haystack" | grep -qF -- "$needle"; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: '$needle' should not be in output"
    fail=$((fail + 1))
  fi
}

# Node helper: run a JS snippet and capture stdout
node_run() {
  node -e "
const { applyManagedBlock, buildManagedBlock } = require('$REPO_ROOT/src/cli/lang-policy');
const { bootstrapChangelog, buildInitialChangelog } = require('$REPO_ROOT/src/cli/changelog');
$1
"
}

# ============================================================================
echo "=== lang-policy unit tests ==="
echo ""

# ============================================================================
echo "1. buildManagedBlock"
# ============================================================================

echo "1.1 zh block contains START marker"
zh_block=$(node_run "process.stdout.write(buildManagedBlock('zh'))")
assert_contains "zh block has start marker" "<!-- spec-first:lang:start -->" "$zh_block"

echo "1.2 zh block contains END marker"
assert_contains "zh block has end marker" "<!-- spec-first:lang:end -->" "$zh_block"

echo "1.3 zh block contains Chinese language directive"
assert_contains "zh block has Chinese directive" "中文" "$zh_block"

echo "1.4 en block contains English language directive"
en_block=$(node_run "process.stdout.write(buildManagedBlock('en'))")
assert_contains "en block has English directive" "English" "$en_block"

echo "1.5 en block contains START and END markers"
assert_contains "en block has start marker" "<!-- spec-first:lang:start -->" "$en_block"
assert_contains "en block has end marker" "<!-- spec-first:lang:end -->" "$en_block"

echo "1.6 zh block does not contain 'English'"
assert_not_contains "zh block has no 'English'" "English" "$zh_block"

echo "1.7 en block contains changelog governance rule"
assert_contains "en block has changelog rule" "CHANGELOG" "$en_block"

echo "1.8 zh block contains changelog governance rule"
assert_contains "zh block has changelog rule" "CHANGELOG" "$zh_block"

echo "1.9 zh block contains refusal rule"
assert_contains "zh block has refusal rule" "拒绝生成" "$zh_block"

echo "1.10 en block contains refusal rule"
assert_contains "en block has refusal rule" "refuse to generate" "$en_block"

echo "1.11 zh block does not contain governance file commit rule"
assert_not_contains "zh block omits governance file commit rule" "规范文件提交规则" "$zh_block"

echo "1.12 en block does not contain governance file commit rule"
assert_not_contains "en block omits governance file commit rule" "Governance File Commit Rule" "$en_block"

echo ""

# ============================================================================
echo "2. applyManagedBlock — file absent (empty string)"
# ============================================================================

echo "2.1 empty existing -> returns block only"
result=$(node_run "
const block = buildManagedBlock('zh');
process.stdout.write(applyManagedBlock('', block));
")
assert_contains "result has start marker" "<!-- spec-first:lang:start -->" "$result"
assert_contains "result has end marker" "<!-- spec-first:lang:end -->" "$result"

echo ""

# ============================================================================
echo "3. applyManagedBlock — file exists, no markers"
# ============================================================================

echo "3.1 existing content preserved when appending"
result=$(node_run "
const block = buildManagedBlock('zh');
const existing = '# My Repo\n\nSome user content here.\n';
process.stdout.write(applyManagedBlock(existing, block));
")
assert_contains "user content preserved" "My Repo" "$result"
assert_contains "user content line preserved" "Some user content here." "$result"
assert_contains "block appended with markers" "<!-- spec-first:lang:start -->" "$result"

echo "3.2 no duplicate markers when no markers in existing"
marker_count=$(printf '%s' "$result" | grep -c '<!-- spec-first:lang:start -->' || true)
assert_output "exactly one start marker" "1" "$marker_count"

echo ""

# ============================================================================
echo "4. applyManagedBlock — file exists with markers (idempotent update)"
# ============================================================================

echo "4.1 replacing zh block with en block: only one start marker remains"
result=$(node_run "
const zhBlock = buildManagedBlock('zh');
const enBlock = buildManagedBlock('en');
const after_zh = applyManagedBlock('# Repo\n', zhBlock);
process.stdout.write(applyManagedBlock(after_zh, enBlock));
")
marker_count=$(printf '%s' "$result" | grep -c '<!-- spec-first:lang:start -->' || true)
assert_output "exactly one start marker after update" "1" "$marker_count"

echo "4.2 en content present after update"
assert_contains "en content after update" "English" "$result"

echo "4.3 user content before block preserved after update"
assert_contains "user content before block preserved" "# Repo" "$result"

echo "4.4 running same lang again is idempotent"
result2=$(node_run "
const zhBlock = buildManagedBlock('zh');
const after = applyManagedBlock('# Repo\n', zhBlock);
process.stdout.write(applyManagedBlock(after, zhBlock));
")
marker_count2=$(printf '%s' "$result2" | grep -c '<!-- spec-first:lang:start -->' || true)
assert_output "idempotent: still one start marker" "1" "$marker_count2"

echo ""

# ============================================================================
echo "5. applyManagedBlock — corrupted state (START without END)"
# ============================================================================

echo "5.1 corrupted file treated as no markers: block appended"
result=$(node_run "
const block = buildManagedBlock('zh');
const corrupted = '# Repo\n<!-- spec-first:lang:start -->\nsome partial content\n';
process.stdout.write(applyManagedBlock(corrupted, block));
")
assert_contains "block appended to corrupted file" "<!-- spec-first:lang:end -->" "$result"
# At least one END marker should appear (from the appended block)
end_count=$(printf '%s' "$result" | grep -c '<!-- spec-first:lang:end -->' || true)
assert "end marker present after appending to corrupted" test "$end_count" -ge 1

echo ""

# ============================================================================
echo "6. bootstrapChangelog"
# ============================================================================

echo "6.1 creates CHANGELOG.md when absent"
FAKE_ROOT1="$TMP_DIR/proj1"
mkdir -p "$FAKE_ROOT1"
node_run "bootstrapChangelog('$FAKE_ROOT1', { name: 'testuser', version: '1.4.0' })" >/dev/null
assert "CHANGELOG.md created" test -f "$FAKE_ROOT1/CHANGELOG.md"

echo "6.2 created file contains versioned entry format"
content=$(cat "$FAKE_ROOT1/CHANGELOG.md")
assert_contains "has versioned entry format" 'Entry format: `- vX.Y.Z YYYY-MM-DD author: summary [(user-visible)]`' "$content"

echo "6.3 created file contains developer name in initial entry"
assert_contains "has developer name" "testuser" "$content"

echo "6.4 created file contains spec-first version in initial entry"
assert_contains "has versioned initial entry" "- v1.4.0 " "$content"

echo "6.5 no-op when file already exists"
ORIGINAL=$(cat "$FAKE_ROOT1/CHANGELOG.md")
node_run "bootstrapChangelog('$FAKE_ROOT1', { name: 'other', version: '2.0.0' })" >/dev/null
AFTER=$(cat "$FAKE_ROOT1/CHANGELOG.md")
assert_output "file unchanged on second call" "$ORIGINAL" "$AFTER"

echo "6.6 works with empty name and version"
FAKE_ROOT2="$TMP_DIR/proj2"
mkdir -p "$FAKE_ROOT2"
node_run "bootstrapChangelog('$FAKE_ROOT2', { name: '', version: '' })" >/dev/null
assert "CHANGELOG.md created with empty fields" test -f "$FAKE_ROOT2/CHANGELOG.md"

echo "6.7 entry format contains date"
TODAY=$(date +%Y-%m-%d)
content2=$(cat "$FAKE_ROOT1/CHANGELOG.md")
assert_contains "entry has today's date" "$TODAY" "$content2"

echo "6.8 no legacy Unreleased section remains"
assert_not_contains "no unreleased section" "## [Unreleased]" "$content2"

echo ""

# ============================================================================
echo "=== Results ==="
echo "  Passed: $pass"
echo "  Failed: $fail"
echo ""

if [ $fail -gt 0 ]; then
  echo "=== lang-policy tests FAILED ==="
  exit 1
else
  echo "=== lang-policy tests PASSED ==="
fi
