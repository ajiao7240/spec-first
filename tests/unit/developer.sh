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
mkdir -p "$HOME_DIR/.spec-first" "$PROJECT_DIR"

echo "1. explicit --lang and --user override the global profile"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=global-user
lang=en
EOF
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "cli-user" "en")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$result")
assert_output "explicit lang wins" "en" "$lang"
assert_output "explicit user wins" "cli-user" "$name"

echo "2. global profile is used when no explicit args are provided"
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "" "")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$result")
assert_output "global lang wins" "en" "$lang"
assert_output "global name wins" "global-user" "$name"

echo "3. default lang is zh when global profile lacks lang"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=global-user
EOF
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "" "")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
assert_output "default lang fallback" "zh" "$lang"

echo "4. default lang is zh when neither global profile nor --lang provides lang"
rm -f "$HOME_DIR/.spec-first/.developer"
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "git-user" "")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
assert_output "default lang fallback" "zh" "$lang"

echo "5. project-level .developer files are ignored"
mkdir -p "$PROJECT_DIR/.codex/spec-first" "$PROJECT_DIR/.claude/spec-first"
cat > "$PROJECT_DIR/.claude/spec-first/.developer" <<'EOF'
name=project-claude
lang=en
EOF
cat > "$PROJECT_DIR/.codex/spec-first/.developer" <<'EOF'
name=project-codex
lang=en
EOF
git -C "$PROJECT_DIR" init -q
git -C "$PROJECT_DIR" config user.name git-user
result=$(run_resolve "$HOME_DIR" "$PROJECT_DIR" "" "")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$result")
lang=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.lang);" "$result")
assert_output "project profile is ignored, falls through to git" "git-user" "$name"
assert_output "project lang is ignored, defaults to zh" "zh" "$lang"
rm -rf "$PROJECT_DIR/.codex" "$PROJECT_DIR/.claude"

echo "6. changelog author reads global developer before explicit fallback"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=global-user
lang=en
EOF
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "fallback-user")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
host=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.host);" "$author")
path_value=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.path);" "$author")
assert_output "global developer wins over fallback" "global-user" "$name"
assert_output "global source is reported" "global_developer" "$source"
assert_output "global host marker is reported" "global" "$host"
assert_output "global path is reported" ".spec-first/.developer" "$path_value"

echo "7. changelog author reads global developer when no explicit fallback"
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
host=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.host);" "$author")
path_value=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.path);" "$author")
assert_output "global developer fills author" "global-user" "$name"
assert_output "global source is reported" "global_developer" "$source"
assert_output "global host marker is reported" "global" "$host"
assert_output "global path is reported" ".spec-first/.developer" "$path_value"

echo "8. project-level .developer files do not alter changelog author"
mkdir -p "$PROJECT_DIR/.codex/spec-first" "$PROJECT_DIR/.claude/spec-first"
cat > "$PROJECT_DIR/.claude/spec-first/.developer" <<'EOF'
name=project-claude
lang=en
EOF
cat > "$PROJECT_DIR/.codex/spec-first/.developer" <<'EOF'
name=project-codex
lang=en
EOF
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
assert_output "project files are ignored, global wins" "global-user" "$name"
assert_output "global source still reported" "global_developer" "$source"
rm -rf "$PROJECT_DIR/.codex" "$PROJECT_DIR/.claude"

echo "9. changelog author keeps explicit fallback when global is absent"
rm -f "$HOME_DIR/.spec-first/.developer"
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "fallback-user")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
host=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.host);" "$author")
path_value=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.path);" "$author")
assert_output "fallback fills author when global is absent" "fallback-user" "$name"
assert_output "fallback source is reported" "fallback_name" "$source"
assert_output "fallback host is empty" "" "$host"
assert_output "fallback path is empty" "" "$path_value"

echo "10. changelog author falls back to git config when fallback and global are absent"
author=$(run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
host=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.host);" "$author")
path_value=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.path);" "$author")
assert_output "git config fills author" "git-user" "$name"
assert_output "git source is reported" "git_config" "$source"
assert_output "git host marker is reported" "git" "$host"
assert_output "git path marker is reported" "user.name" "$path_value"

echo "11. changelog author does not hang when git config times out"
FAKE_BIN="$TMP_DIR/fake-bin"
mkdir -p "$FAKE_BIN"
cat > "$FAKE_BIN/git" <<'EOF'
#!/bin/sh
sleep 5
EOF
chmod +x "$FAKE_BIN/git"
author=$(PATH="$FAKE_BIN:$PATH" SPEC_FIRST_EXTERNAL_COMMAND_TIMEOUT_MS=50 run_changelog_author "$HOME_DIR" "$PROJECT_DIR" "")
name=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.name);" "$author")
source=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.source);" "$author")
assert_output "timed out git config does not choose a name" "" "$name"
assert_output "timed out git config falls through unresolved" "unresolved" "$source"

echo "12. hosts field round-trips through the global developer file"
rm -rf "$PROJECT_DIR/.codex" "$PROJECT_DIR/.claude"
hosts_round_trip=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const {
  writeGlobalDeveloperFile,
  readDeveloperFile,
  getGlobalDeveloperPath,
} = require(path.join(repoRoot, 'src/cli/developer'));

writeGlobalDeveloperFile({
  name: 'host-user',
  lang: 'zh',
  initializedAt: 't',
  version: '1',
  hosts: ['codex', 'claude', 'claude'],
});
process.stdout.write(JSON.stringify(readDeveloperFile(getGlobalDeveloperPath()).hosts));
EOF
)
assert_output "hosts dedup + sort round-trips" '["claude","codex"]' "$hosts_round_trip"

echo "13. old developer files without hosts read back as empty hosts"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=legacy-user
lang=en
EOF
legacy_hosts=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const { readDeveloperFile, getGlobalDeveloperPath } = require(path.join(repoRoot, 'src/cli/developer'));
process.stdout.write(JSON.stringify(readDeveloperFile(getGlobalDeveloperPath()).hosts));
EOF
)
assert_output "legacy file yields empty hosts" '[]' "$legacy_hosts"

echo "14. a developer record with only hosts is not normalized to null"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
hosts=claude
EOF
only_hosts=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const { readDeveloperFile, getGlobalDeveloperPath } = require(path.join(repoRoot, 'src/cli/developer'));
const record = readDeveloperFile(getGlobalDeveloperPath());
process.stdout.write(record === null ? 'null' : JSON.stringify(record.hosts));
EOF
)
assert_output "only-hosts record is preserved" '["claude"]' "$only_hosts"

echo "15. empty hosts are omitted from the serialized file"
host_line=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const { formatDeveloperContents } = require(path.join(repoRoot, 'src/cli/developer'));
const out = formatDeveloperContents({ name: 'x', lang: 'zh', initializedAt: 't', version: '1' });
process.stdout.write(out.includes('hosts=') ? 'has-hosts' : 'no-hosts');
EOF
)
assert_output "empty hosts omit the hosts line" "no-hosts" "$host_line"

echo "16. sync_user_language true/false round-trips through the global developer file"
sync_round_trip=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const {
  writeGlobalDeveloperFile,
  readDeveloperFile,
  getGlobalDeveloperPath,
} = require(path.join(repoRoot, 'src/cli/developer'));

writeGlobalDeveloperFile({
  name: 'sync-user',
  lang: 'zh',
  initializedAt: 't',
  version: '1',
  syncUserLanguage: false,
});
const first = readDeveloperFile(getGlobalDeveloperPath()).syncUserLanguage;
writeGlobalDeveloperFile({
  name: 'sync-user',
  lang: 'zh',
  initializedAt: 't',
  version: '1',
  syncUserLanguage: true,
});
const second = readDeveloperFile(getGlobalDeveloperPath()).syncUserLanguage;
process.stdout.write(JSON.stringify([first, second]));
EOF
)
assert_output "sync_user_language false and true round-trip" '[false,true]' "$sync_round_trip"

echo "17. legacy files without sync_user_language stay unset"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=legacy-user
lang=en
EOF
legacy_sync=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const { readDeveloperFile, getGlobalDeveloperPath } = require(path.join(repoRoot, 'src/cli/developer'));
const value = readDeveloperFile(getGlobalDeveloperPath()).syncUserLanguage;
process.stdout.write(value === null ? 'unset' : String(value));
EOF
)
assert_output "legacy file yields unset sync preference" "unset" "$legacy_sync"

echo "18. invalid sync_user_language values normalize to unset"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
name=invalid-sync
lang=zh
sync_user_language=maybe
EOF
invalid_sync=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const { readDeveloperFile, getGlobalDeveloperPath } = require(path.join(repoRoot, 'src/cli/developer'));
const value = readDeveloperFile(getGlobalDeveloperPath()).syncUserLanguage;
process.stdout.write(value === null ? 'unset' : String(value));
EOF
)
assert_output "invalid sync preference yields unset" "unset" "$invalid_sync"

echo "19. a developer record with only sync_user_language is preserved"
cat > "$HOME_DIR/.spec-first/.developer" <<'EOF'
sync_user_language=false
EOF
only_sync=$(HOME="$HOME_DIR" node - <<'EOF' "$REPO_ROOT"
const path = require('node:path');
const repoRoot = process.argv[2];
const { readDeveloperFile, getGlobalDeveloperPath } = require(path.join(repoRoot, 'src/cli/developer'));
const record = readDeveloperFile(getGlobalDeveloperPath());
process.stdout.write(record === null ? 'null' : String(record.syncUserLanguage));
EOF
)
assert_output "only-sync record is preserved" "false" "$only_sync"

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
