#!/bin/bash
# developer identity unit tests
# Tests resolveDeveloperIdentity fallback order for language selection

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

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

run_resolve() {
  local home_dir="$1"
  local project_root="$2"
  local user_arg="$3"
  local lang_arg="$4"
  HOME="$home_dir" node - <<'EOF' "$REPO_ROOT" "$project_root" "$user_arg" "$lang_arg"
const path = require('node:path');
const repoRoot = process.argv[2];
const projectRoot = process.argv[3];
const user = process.argv[4];
const lang = process.argv[5];
const { resolveDeveloperIdentity } = require(path.join(repoRoot, 'src/cli/developer'));

const result = resolveDeveloperIdentity(projectRoot, {
  user: user || '',
  lang: lang || '',
}, {
  developerFile: '.claude/spec-first/.developer',
});

process.stdout.write(JSON.stringify(result));
EOF
}

echo "=== developer identity tests ==="
echo ""

HOME_DIR="$TMP_DIR/home"
PROJECT_DIR="$TMP_DIR/project"
mkdir -p "$HOME_DIR/.spec-first" "$PROJECT_DIR/.claude/spec-first"

echo "1. explicit --lang overrides project and global"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=global-user
lang=en
EOF
cat > "$PROJECT_DIR/.claude/spec-first/.developer" <<'EOF'
name=project-user
lang=zh
EOF
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "cli-user" "en")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$result")
assert_output "explicit lang wins" "en" "$lang"
assert_output "explicit user wins" "cli-user" "$name"

echo "2. project .developer lang wins when --lang is absent"
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "" "")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$result")
assert_output "project lang wins" "zh" "$lang"
assert_output "global name still fills identity" "global-user" "$name"

echo "3. global .developer lang is used only when project profile is absent"
rm -f "$PROJECT_DIR/.claude/spec-first/.developer"
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "" "")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
assert_output "global lang fallback" "en" "$lang"

echo "4. default lang is zh when neither project nor global profile provides lang"
rm -f "$HOME_DIR/.spec-first/.developer"
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "git-user" "")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
assert_output "default lang fallback" "zh" "$lang"

echo ""
echo "=== Results ==="
echo "  Passed: $pass"
echo "  Failed: $fail"
echo ""

if [ $fail -gt 0 ]; then
  echo "=== developer identity tests FAILED ==="
  exit 1
else
  echo "=== developer identity tests PASSED ==="
fi
