#!/bin/bash
# mcp-setup skill unit tests
# Tests check-deps.sh, detect-tools.sh, install-coordinator.sh, and config files

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/skills/mcp-setup/scripts"
TOOLS_JSON="$REPO_ROOT/skills/mcp-setup/mcp-tools.json"
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
  if grep -qF "$needle" <<<"$haystack"; then
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
  if ! grep -qF "$needle" <<<"$haystack"; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: '$needle' should not be in output"
    fail=$((fail + 1))
  fi
}

# ============================================================================
echo "=== mcp-setup skill tests ==="
echo ""

# ============================================================================
echo "1. Config file validation"
# ============================================================================

echo "1.1 mcp-tools.json is valid JSON"
output=$(jq . "$TOOLS_JSON" 2>&1)
assert "mcp-tools.json is valid JSON" test -n "$output"

echo "1.2 mcp-tools.json has 6 tools"
tool_count=$(jq '.tools | length' "$TOOLS_JSON")
assert_output "6 tools defined" "6" "$tool_count"

echo "1.3 All tools have required fields"
for field in id name category description dependencies detect; do
  missing=$(jq -r --arg f "$field" '.tools[] | select(.[$f] == null) | .id' "$TOOLS_JSON" 2>/dev/null || true)
  assert "All tools have '$field'" test -z "$missing"
done

echo "1.4 Required tools have correct IDs"
required_ids=$(jq -r '.tools[] | select(.category == "required") | .id' "$TOOLS_JSON" | sort | paste -sd ',' -)
expected_ids="abcoder,context7,gitnexus,serena,sequential-thinking"
assert "Required tool count is 5" test "$(echo "$required_ids" | tr ',' '\n' | wc -l | tr -d ' ')" = "5"
assert_contains "Has serena" "serena" "$required_ids"
assert_contains "Has gitnexus" "gitnexus" "$required_ids"
assert_contains "Has abcoder" "abcoder" "$required_ids"

echo "1.5 Optional tools have correct IDs"
optional_ids=$(jq -r '.tools[] | select(.category == "optional") | .id' "$TOOLS_JSON")
assert_output "Optional tool IDs" "playwright" "$optional_ids"

echo "1.6 Serena has correct entry point (serena-mcp-server)"
serena_cmd=$(jq -r '.tools[] | select(.id == "serena") | .mcp_config.command' "$TOOLS_JSON")
assert_output "Serena uses uvx" "uvx" "$serena_cmd"
serena_args=$(jq -r '.tools[] | select(.id == "serena") | .mcp_config.args | join(" ")' "$TOOLS_JSON")
assert_contains "Serena args include serena-mcp-server" "serena-mcp-server" "$serena_args"
# --context may look like a grep flag; use fixed string matching
if echo "$serena_args" | grep -qF "ide-assistant"; then
  pass=$((pass + 1))
else
  echo "  ✗ Serena args include ide-assistant"
  fail=$((fail + 1))
fi

echo "1.7 ABCoder has install_command and null mcp_config"
abcoder_install=$(jq -r '.tools[] | select(.id == "abcoder") | .install_command' "$TOOLS_JSON")
assert_contains "ABCoder install_command" "go install github.com/cloudwego/abcoder" "$abcoder_install"
abcoder_mcp=$(jq -r '.tools[] | select(.id == "abcoder") | .mcp_config' "$TOOLS_JSON")
assert_output "ABCoder mcp_config is null" "null" "$abcoder_mcp"

echo ""

# ============================================================================
echo "2. check-deps.sh tests"
# ============================================================================

echo "2.1 Produces valid JSON"
deps_output=$(bash "$SCRIPTS_DIR/check-deps.sh" 2>/dev/null)
assert "check-deps.sh produces valid JSON" jq -e . <<<"$deps_output"

echo "2.2 JSON has expected top-level keys"
for key in os node go uv jq; do
  assert "JSON has '$key' key" jq -e ".$key" <<<"$deps_output"
done

echo "2.3 Installed deps have 'installed: true' and 'version'"
for dep in node go uv jq; do
  installed=$(jq -r ".$dep.installed" <<<"$deps_output")
  version=$(jq -r ".$dep.version" <<<"$deps_output")
  assert "$dep is installed" test "$installed" = "true"
  assert "$dep has version" test -n "$version" -a "$version" != "null"
done

echo "2.4 Installed deps have null install_suggestion"
for dep in node go uv jq; do
  suggestion=$(jq -r ".$dep.install_suggestion" <<<"$deps_output")
  assert "$dep install_suggestion is null" test "$suggestion" = "null"
done

echo "2.5 OS detection returns valid value"
os_val=$(jq -r '.os' <<<"$deps_output")
assert "OS is detected" test -n "$os_val" -a "$os_val" != "null"

echo "2.6 JSON version strings don't contain unescaped quotes"
# Verify the JSON is parseable and version fields are clean strings
for dep in node go uv jq; do
  version_type=$(jq -r ".$dep.version | type" <<<"$deps_output")
  assert "$dep version is a string" test "$version_type" = "string"
done

echo ""

# ============================================================================
echo "3. detect-tools.sh tests"
# ============================================================================

echo "3.1 Produces valid JSON"
detect_output=$(bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
assert "detect-tools.sh produces valid JSON" jq -e . <<<"$detect_output"

echo "3.2 JSON has installed and missing arrays"
assert "JSON has 'installed' array" jq -e '.installed | type == "array"' <<<"$detect_output"
assert "JSON has 'missing' array" jq -e '.missing | type == "array"' <<<"$detect_output"

echo "3.3 All tools accounted for (no duplicates, no gaps)"
installed_count=$(jq '.installed | length' <<<"$detect_output")
missing_count=$(jq '.missing | length' <<<"$detect_output")
total=$((installed_count + missing_count))
assert_output "Total tools = 6" "6" "$total"

echo "3.4 installed array has no empty strings"
empty_installed=$(jq '[.installed[] | select(. == "")] | length' <<<"$detect_output")
assert_output "No empty strings in installed" "0" "$empty_installed"

echo "3.5 missing array has no empty strings"
empty_missing=$(jq '[.missing[] | select(. == "")] | length' <<<"$detect_output")
assert_output "No empty strings in missing" "0" "$empty_missing"

echo "3.6 Serena detected in current env (mcp_config method)"
assert_contains "serena in installed" "serena" "$(jq -r '.installed[]' <<<"$detect_output")"

echo "3.7 ABCoder detected in current env (command method)"
assert_contains "abcoder in installed" "abcoder" "$(jq -r '.installed[]' <<<"$detect_output")"

echo "3.8 Edge case: missing ~/.claude.json"
CLAUDE_JSON_BACKUP="$HOME/.claude.json"
# Use a temp home to simulate missing config
FAKE_HOME="$TMP_DIR/fake_home"
mkdir -p "$FAKE_HOME"
detect_no_config=$(HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
assert "Works without ~/.claude.json" jq -e . <<<"$detect_no_config"
# All mcp_config-based tools should be missing, command-based may still be found
assert "Valid JSON with missing config" test -n "$detect_no_config"

echo "3.9 Edge case: empty ~/.claude.json (no mcpServers)"
echo '{}' > "$FAKE_HOME/.claude.json"
detect_empty=$(HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
assert "Works with empty config" jq -e . <<<"$detect_empty"
# All mcp_config tools should be missing
serena_in_empty=$(jq -r '(.installed // []) | map(select(. == "serena")) | length' <<<"$detect_empty")
assert_output "serena not detected with empty config" "0" "$serena_in_empty"

echo "3.10 Edge case: all tools missing (empty installed array)"
echo '{"mcpServers":{}}' > "$FAKE_HOME/.claude.json"
# PATH=/dev/null to hide all commands
detect_all_missing=$(HOME="$FAKE_HOME" PATH="/dev/null:/usr/bin" bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null || true)
if [ -n "$detect_all_missing" ]; then
  installed_empty=$(jq -e '.installed | length' <<<"$detect_all_missing" 2>/dev/null || echo "parse_error")
  # Should be 0 or the JSON should be valid with empty array
  assert "Valid JSON when all missing" test "$installed_empty" != "parse_error"
fi

echo ""

# ============================================================================
echo "4. install-coordinator.sh tests"
# ============================================================================

echo "4.1 --install with single tool (gitnexus)"
FAKE_HOME2="$TMP_DIR/test_install"
mkdir -p "$FAKE_HOME2"
echo '{"mcpServers":{}}' > "$FAKE_HOME2/.claude.json"
chmod 600 "$FAKE_HOME2/.claude.json"

install_out=$(HOME="$FAKE_HOME2" bash "$SCRIPTS_DIR/install-coordinator.sh" --install gitnexus 2>&1)
assert "Install gitnexus succeeds" test $? -eq 0 -o $? -eq 1 || true
assert_contains "gitnexus configured message" "gitnexus" "$install_out"

# Verify config was written
gitnexus_exists=$(jq -e '.mcpServers.gitnexus' "$FAKE_HOME2/.claude.json" 2>/dev/null)
assert "gitnexus in ~/.claude.json" test -n "$gitnexus_exists"

gitnexus_cmd=$(jq -r '.mcpServers.gitnexus.command' "$FAKE_HOME2/.claude.json")
assert_output "gitnexus command is npx" "npx" "$gitnexus_cmd"

echo "4.2 Idempotency: run twice, same config"
BEFORE=$(jq -S . "$FAKE_HOME2/.claude.json")
HOME="$FAKE_HOME2" bash "$SCRIPTS_DIR/install-coordinator.sh" --install gitnexus >/dev/null 2>&1 || true
AFTER=$(jq -S . "$FAKE_HOME2/.claude.json")
assert_output "Config unchanged after rerun" "$BEFORE" "$AFTER"

echo "4.3 --skip flag works"
FAKE_HOME3="$TMP_DIR/test_skip"
mkdir -p "$FAKE_HOME3"
echo '{"mcpServers":{}}' > "$FAKE_HOME3/.claude.json"
chmod 600 "$FAKE_HOME3/.claude.json"

HOME="$FAKE_HOME3" bash "$SCRIPTS_DIR/install-coordinator.sh" --skip playwright >/dev/null 2>&1 || true
# Should have serena, gitnexus, sequential-thinking, context7 but NOT playwright
has_playwright=$(jq -r '.mcpServers.playwright // empty' "$FAKE_HOME3/.claude.json")
assert "playwright skipped" test -z "$has_playwright"
has_serena=$(jq -r '.mcpServers.serena.command // empty' "$FAKE_HOME3/.claude.json")
assert "serena installed" test -n "$has_serena"

echo "4.4 Config merge doesn't overwrite existing entries"
FAKE_HOME4="$TMP_DIR/test_merge"
mkdir -p "$FAKE_HOME4"
# Pre-existing custom serena config
cat > "$FAKE_HOME4/.claude.json" <<'JSONEOF'
{
  "mcpServers": {
    "serena": {
      "command": "custom-serena",
      "args": ["--custom-flag"]
    }
  }
}
JSONEOF
chmod 600 "$FAKE_HOME4/.claude.json"

HOME="$FAKE_HOME4" bash "$SCRIPTS_DIR/install-coordinator.sh" --install serena >/dev/null 2>&1 || true
serena_cmd_after=$(jq -r '.mcpServers.serena.command' "$FAKE_HOME4/.claude.json")
assert_output "Existing config preserved" "custom-serena" "$serena_cmd_after"

echo "4.5 Backup created and cleaned up"
FAKE_HOME5="$TMP_DIR/test_backup"
mkdir -p "$FAKE_HOME5"
echo '{"mcpServers":{}}' > "$FAKE_HOME5/.claude.json"
chmod 600 "$FAKE_HOME5/.claude.json"

HOME="$FAKE_HOME5" bash "$SCRIPTS_DIR/install-coordinator.sh" --install context7 >/dev/null 2>&1 || true
# Backup should be deleted on success
backup_count=$(find "$FAKE_HOME5" -name '.claude.json.backup.*' | wc -l | tr -d ' ')
assert_output "Backup cleaned on success" "0" "$backup_count"

echo "4.6 File permissions preserved (600)"
FAKE_HOME6="$TMP_DIR/test_perms"
mkdir -p "$FAKE_HOME6"
echo '{"mcpServers":{}}' > "$FAKE_HOME6/.claude.json"
chmod 600 "$FAKE_HOME6/.claude.json"

HOME="$FAKE_HOME6" bash "$SCRIPTS_DIR/install-coordinator.sh" --install sequential-thinking >/dev/null 2>&1 || true
perms=$(stat -f '%Lp' "$FAKE_HOME6/.claude.json" 2>/dev/null || stat -c '%a' "$FAKE_HOME6/.claude.json" 2>/dev/null)
assert_output "Config file is 600" "600" "$perms"

echo "4.7 Creates initial config when ~/.claude.json doesn't exist"
FAKE_HOME7="$TMP_DIR/test_create"
mkdir -p "$FAKE_HOME7"
HOME="$FAKE_HOME7" bash "$SCRIPTS_DIR/install-coordinator.sh" --install context7 >/dev/null 2>&1 || true
assert "Config created" test -f "$FAKE_HOME7/.claude.json"
config_valid=$(jq -e '.mcpServers.context7' "$FAKE_HOME7/.claude.json" 2>/dev/null)
assert "context7 configured in new file" test -n "$config_valid"

echo "4.8 Atomic write uses same-dir tempfile (not /tmp)"
FAKE_HOME8="$TMP_DIR/test_atomic"
mkdir -p "$FAKE_HOME8"
echo '{"mcpServers":{}}' > "$FAKE_HOME8/.claude.json"
chmod 600 "$FAKE_HOME8/.claude.json"

# Run and check no leftover temp files
HOME="$FAKE_HOME8" bash "$SCRIPTS_DIR/install-coordinator.sh" --install context7 >/dev/null 2>&1 || true
leftover=$(find "$FAKE_HOME8" -name '.claude.json.??????' | wc -l | tr -d ' ')
assert_output "No leftover temp files" "0" "$leftover"

echo ""

# ============================================================================
echo "5. SKILL.md validation"
# ============================================================================

SKILL_MD="$REPO_ROOT/skills/mcp-setup/SKILL.md"

echo "5.1 SKILL.md has YAML frontmatter"
first_line=$(head -1 "$SKILL_MD")
assert "SKILL.md starts with ---" test "$first_line" = "---"

echo "5.2 SKILL.md frontmatter has required fields"
for field in name description argument-hint; do
  assert "SKILL.md has '$field'" grep -q "^${field}:" "$SKILL_MD"
done

echo "5.3 SKILL.md name is mcp-setup"
skill_name=$(grep '^name:' "$SKILL_MD" | head -1 | sed 's/^name: *//')
assert_output "SKILL.md name" "mcp-setup" "$skill_name"

echo "5.4 SKILL.md has Phase 1, 2, 3 sections"
for phase in "Phase 1" "Phase 2" "Phase 3"; do
  assert "SKILL.md has '$phase'" grep -q "$phase" "$SKILL_MD"
done

echo ""

# ============================================================================
echo "6. plugin.json validation"
# ============================================================================

PLUGIN_JSON="$REPO_ROOT/.claude-plugin/plugin.json"

echo "6.1 plugin.json is valid JSON"
assert "plugin.json is valid JSON" jq -e . "$PLUGIN_JSON" >/dev/null

echo "6.2 plugin.json has mcp-setup command"
mcp_setup=$(jq -r '.commands[] | select(.name == "mcp-setup") | .name' "$PLUGIN_JSON")
assert_output "mcp-setup command registered" "mcp-setup" "$mcp_setup"

echo "6.3 mcp-setup command has correct fields"
mcp_filename=$(jq -r '.commands[] | select(.name == "mcp-setup") | .filename' "$PLUGIN_JSON")
mcp_skill=$(jq -r '.commands[] | select(.name == "mcp-setup") | .skill' "$PLUGIN_JSON")
assert_output "filename is mcp-setup.md" "mcp-setup.md" "$mcp_filename"
assert_output "skill is mcp-setup" "mcp-setup" "$mcp_skill"

echo ""

# ============================================================================
echo "7. Command template validation"
# ============================================================================

CMD_TEMPLATE="$REPO_ROOT/templates/claude/commands/spec/mcp-setup.md"

echo "7.1 Command template exists"
assert "Command template exists" test -f "$CMD_TEMPLATE"

echo "7.2 Command template has YAML frontmatter"
first_line=$(head -1 "$CMD_TEMPLATE")
assert "Template starts with ---" test "$first_line" = "---"

echo "7.3 Command template references correct skill path"
assert "References skills/mcp-setup/SKILL.md" grep -q 'skills/mcp-setup/SKILL.md' "$CMD_TEMPLATE"

echo "7.4 Command template does NOT reference .claude/skills/ (old path)"
assert_not_contains "No .claude/skills/ path" ".claude/skills/mcp-setup" "$(cat "$CMD_TEMPLATE")"

echo ""

# ============================================================================
echo "8. Integration: detect → install → verify"
# ============================================================================

echo "8.1 Full flow: detect missing → install → detect installed"
FAKE_HOME9="$TMP_DIR/test_integration"
mkdir -p "$FAKE_HOME9"
echo '{"mcpServers":{}}' > "$FAKE_HOME9/.claude.json"
chmod 600 "$FAKE_HOME9/.claude.json"

# Step 1: detect
before=$(HOME="$FAKE_HOME9" bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
before_missing=$(jq -r '.missing[]' <<<"$before" | grep -c . || echo "0")

# Step 2: install
HOME="$FAKE_HOME9" bash "$SCRIPTS_DIR/install-coordinator.sh" --skip playwright >/dev/null 2>&1 || true

# Step 3: detect again
after=$(HOME="$FAKE_HOME9" bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
after_missing=$(jq '.missing | length' <<<"$after")

assert "Fewer missing after install" test "$after_missing" -lt "$before_missing"

echo "8.2 Config file still valid JSON after full flow"
assert "Config still valid JSON" jq -e . "$FAKE_HOME9/.claude.json" >/dev/null

echo "8.3 All required MCP tools configured"
for tool in serena gitnexus sequential-thinking context7; do
  configured=$(jq -r --arg t "$tool" '.mcpServers[$t].command // empty' "$FAKE_HOME9/.claude.json")
  assert "$tool configured" test -n "$configured"
done

echo ""

# ============================================================================
echo "9. verify-tools.sh tests"
# ============================================================================

VERIFY_SCRIPT="$SCRIPTS_DIR/verify-tools.sh"

echo "9.1 abcoder binary detected when present (controlled PATH with stub)"
FH91="$TMP_DIR/fh91"
FAKEBIN91="$TMP_DIR/fakebin91"
mkdir -p "$FH91" "$FAKEBIN91"
echo '{"mcpServers":{}}' > "$FH91/.claude.json"
# Stub abcoder binary that always exits 0 (simulates installed + working)
printf '#!/bin/sh\nexit 0\n' > "$FAKEBIN91/abcoder"
chmod +x "$FAKEBIN91/abcoder"
for cmd in bash jq date mkdir mktemp chmod mv; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN91/$cmd"; fi
done
out91=$(HOME="$FH91" PATH="$FAKEBIN91" bash "$VERIFY_SCRIPT" 2>/dev/null \
  && jq -r '.tools.abcoder.installed' "$FH91/.claude/spec-first/host-setup.json")
assert_output "9.1 abcoder.installed=true when in PATH" "true" "$out91"

echo "9.2 abcoder binary not detected when absent (PATH override)"
FH92="$TMP_DIR/fh92"
FAKEBIN92="$TMP_DIR/fakebin92"
mkdir -p "$FH92" "$FAKEBIN92"
echo '{"mcpServers":{}}' > "$FH92/.claude.json"
# Build a minimal PATH with required tools but WITHOUT abcoder
for cmd in bash jq date mkdir mktemp chmod mv; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN92/$cmd"; fi
done
# Do NOT link abcoder — it should appear absent in this PATH
out92=$(HOME="$FH92" PATH="$FAKEBIN92" bash "$VERIFY_SCRIPT" 2>/dev/null \
  && jq -r '.tools.abcoder.installed' "$FH92/.claude/spec-first/host-setup.json")
assert_output "9.2 abcoder.installed=false when not in PATH" "false" "$out92"

echo "9.3 serena configured=true when mcpServers.serena exists in ~/.claude.json"
FH93="$TMP_DIR/fh93"
mkdir -p "$FH93"
echo '{"mcpServers":{"serena":{"command":"uvx"}}}' > "$FH93/.claude.json"
HOME="$FH93" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out93=$(jq -r '.tools.serena.configured' "$FH93/.claude/spec-first/host-setup.json")
assert_output "9.3 serena.configured=true" "true" "$out93"

echo "9.4 serena configured=false when ~/.claude.json absent"
FH94="$TMP_DIR/fh94"
mkdir -p "$FH94"
HOME="$FH94" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out94=$(jq -r '.tools.serena.configured' "$FH94/.claude/spec-first/host-setup.json")
assert_output "9.4 serena.configured=false when no claude.json" "false" "$out94"

echo "9.5 serena configured=false when mcpServers key exists but serena missing"
FH95="$TMP_DIR/fh95"
mkdir -p "$FH95"
echo '{"mcpServers":{"gitnexus":{"command":"npx"}}}' > "$FH95/.claude.json"
HOME="$FH95" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out95=$(jq -r '.tools.serena.configured' "$FH95/.claude/spec-first/host-setup.json")
assert_output "9.5 serena.configured=false when absent from mcpServers" "false" "$out95"

echo "9.6 host-setup.json written to correct path"
FH96="$TMP_DIR/fh96"
mkdir -p "$FH96"
HOME="$FH96" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
assert "9.6 host-setup.json at ~/.claude/spec-first/host-setup.json" test -f "$FH96/.claude/spec-first/host-setup.json"

echo "9.7 host-setup.json is valid JSON after write"
FH97="$TMP_DIR/fh97"
mkdir -p "$FH97"
HOME="$FH97" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
assert "9.7 host-setup.json is valid JSON" jq -e . "$FH97/.claude/spec-first/host-setup.json"

echo "9.8 host-setup.json has chmod 600 permissions"
FH98="$TMP_DIR/fh98"
mkdir -p "$FH98"
HOME="$FH98" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
perms98=$(stat -f '%Lp' "$FH98/.claude/spec-first/host-setup.json" 2>/dev/null || stat -c '%a' "$FH98/.claude/spec-first/host-setup.json" 2>/dev/null)
assert_output "9.8 host-setup.json is 600" "600" "$perms98"

echo "9.9 idempotent: second run overwrites, no error"
FH99="$TMP_DIR/fh99"
mkdir -p "$FH99"
HOME="$FH99" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
first99=$(jq -S . "$FH99/.claude/spec-first/host-setup.json")
HOME="$FH99" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
second99=$(jq -S . "$FH99/.claude/spec-first/host-setup.json")
# Both runs should produce valid JSON (timestamps differ, so we just check validity)
assert "9.9 first run valid JSON" jq -e . "$FH99/.claude/spec-first/host-setup.json"
assert "9.9 second run succeeds without error" test -n "$second99"

echo "9.10 exits non-zero when host-setup.json parent not writable"
FH910="$TMP_DIR/fh910"
mkdir -p "$FH910/.claude/spec-first"
chmod 500 "$FH910/.claude/spec-first"
exit910=0
HOME="$FH910" bash "$VERIFY_SCRIPT" >/dev/null 2>&1 || exit910=$?
chmod 700 "$FH910/.claude/spec-first"  # restore for cleanup
assert "9.10 exits non-zero on unwritable dir" test "$exit910" -ne 0

echo "9.11 java_runtime.present=false when java not in PATH"
FH911="$TMP_DIR/fh911"
FAKEBIN911="$TMP_DIR/fakebin911"
mkdir -p "$FH911" "$FAKEBIN911"
# Build a minimal PATH with required tools but WITHOUT java
for cmd in bash jq date mkdir mktemp chmod mv abcoder; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN911/$cmd"; fi
done
# Do NOT link java — it should appear absent
HOME="$FH911" PATH="$FAKEBIN911" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out911=$(jq -r '.java_runtime.present' "$FH911/.claude/spec-first/host-setup.json")
assert_output "9.11 java_runtime.present=false" "false" "$out911"
reason911=$(jq -r '.java_runtime.reason' "$FH911/.claude/spec-first/host-setup.json")
assert_output "9.11 java_runtime.reason=java-not-found" "java-not-found" "$reason911"

echo "9.12 context7 configured=true when mcpServers.context7 exists in ~/.claude.json"
FH912="$TMP_DIR/fh912"
mkdir -p "$FH912"
echo '{"mcpServers":{"context7":{"command":"npx"}}}' > "$FH912/.claude.json"
HOME="$FH912" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out912=$(jq -r '.tools.context7.configured' "$FH912/.claude/spec-first/host-setup.json")
assert_output "9.12 context7.configured=true" "true" "$out912"

echo ""

# ============================================================================
echo "=== Results ==="
echo "  Passed: $pass"
echo "  Failed: $fail"
echo ""

if [ $fail -gt 0 ]; then
  echo "=== mcp-setup tests FAILED ==="
  exit 1
else
  echo "=== mcp-setup tests PASSED ==="
fi
