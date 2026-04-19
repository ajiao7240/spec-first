#!/bin/bash
# developer identity unit tests
# Tests resolveDeveloperIdentity and changelog author resolver contract

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

run_changelog_author() {
  local home_dir="$1"
  local project_root="$2"
  local fallback_name="$3"
  HOME="$home_dir" node - <<'EOF' "$REPO_ROOT" "$project_root" "$fallback_name"
const path = require('node:path');
const repoRoot = process.argv[2];
const projectRoot = process.argv[3];
const fallbackName = process.argv[4];
const { resolveChangelogAuthor } = require(path.join(repoRoot, 'src/cli/developer'));

process.stdout.write(JSON.stringify(resolveChangelogAuthor(projectRoot, {
  fallbackName: fallbackName || '',
})));
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

echo "5. changelog author keeps default identity fallback instead of reading project profiles"
mkdir -p "$PROJECT_DIR/.codex/spec-first" "$PROJECT_DIR/.claude/spec-first" "$HOME_DIR/.spec-first"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=global-user
lang=en
EOF
cat > "$PROJECT_DIR/.claude/spec-first/.developer" <<'EOF'
name=claude-user
lang=zh
EOF
cat > "$PROJECT_DIR/.codex/spec-first/.developer" <<'EOF'
name=codex-user
lang=en
EOF
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "fallback-user")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
host=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.host);" "$author")
path_value=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.path);" "$author")
assert_output "fallback name wins over project profiles" "fallback-user" "$name"
assert_output "fallback source is reported" "fallback_name" "$source"
assert_output "fallback host is empty" "" "$host"
assert_output "fallback path is empty" "" "$path_value"

echo "6. changelog author falls back to global developer after explicit fallback is absent"
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
host=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.host);" "$author")
path_value=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.path);" "$author")
assert_output "global developer fills author" "global-user" "$name"
assert_output "global source is reported" "global_developer" "$source"
assert_output "global host marker is reported" "global" "$host"
assert_output "global path is reported" ".spec-first/.developer" "$path_value"

echo "7. changelog author still ignores project profiles when explicit fallback is absent"
rm -f "$HOME_DIR/.spec-first/.developer"
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "git-user")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
assert_output "fallback still wins after removing global developer" "git-user" "$name"
assert_output "fallback source remains explicit fallback" "fallback_name" "$source"

echo "8. changelog author falls back to git config when explicit fallback and global developer are absent"
git -C "$PROJECT_DIR" init -q
git -C "$PROJECT_DIR" config user.name git-user
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
host=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.host);" "$author")
path_value=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.path);" "$author")
assert_output "git config fills author" "git-user" "$name"
assert_output "git source is reported" "git_config" "$source"
assert_output "git host marker is reported" "git" "$host"
assert_output "git path marker is reported" "user.name" "$path_value"

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
