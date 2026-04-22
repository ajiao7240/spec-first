#!/bin/bash
# mcp-setup skill unit tests
# Tests the rebuilt installer metadata, readiness facts, installer pipeline, and readiness ledger

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/skills/spec-mcp-setup/scripts"
TOOLS_JSON="$REPO_ROOT/skills/spec-mcp-setup/mcp-tools.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
FAKE_BIN="$TMP_DIR/fake-bin"
mkdir -p "$FAKE_BIN"
cat > "$FAKE_BIN/uvx" <<'EOF'
#!/bin/bash
exit 0
EOF
cat > "$FAKE_BIN/npx" <<'EOF'
#!/bin/bash
exit 0
EOF
chmod +x "$FAKE_BIN/uvx" "$FAKE_BIN/npx"
TEST_PATH="$FAKE_BIN:$PATH"

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
  if grep -qF -- "$needle" <<<"$haystack"; then
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
  if ! grep -qF -- "$needle" <<<"$haystack"; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: '$needle' should not be in output"
    fail=$((fail + 1))
  fi
}

echo "=== mcp-setup skill tests ==="
echo ""

echo "1. Installer metadata validation"
assert "mcp-tools.json is valid JSON" jq -e . "$TOOLS_JSON"
schema_version=$(jq -r '.schema_version' "$TOOLS_JSON")
assert_output "schema_version is 2" "2" "$schema_version"
tool_count=$(jq '.tools | length' "$TOOLS_JSON")
assert_output "4 tools defined" "4" "$tool_count"
required_count=$(jq '[.tools[] | select(.required == true)] | length' "$TOOLS_JSON")
assert_output "3 required tools" "3" "$required_count"
optional_count=$(jq '[.tools[] | select(.required == false)] | length' "$TOOLS_JSON")
assert_output "1 optional tool" "1" "$optional_count"
assert "summary_columns exist" jq -e '.summary_columns | length > 0' "$TOOLS_JSON"
serena_timeout=$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.startup_timeout_sec' "$TOOLS_JSON")
assert_output "Serena codex timeout is 90" "90" "$serena_timeout"
serena_project_file=$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.project_file' "$TOOLS_JSON")
assert_output "Serena project bootstrap file" ".serena/project.yml" "$serena_project_file"
serena_ready_marker=$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.ready_marker_file' "$TOOLS_JSON")
assert_output "Serena ready marker file" ".serena/index-ready.json" "$serena_ready_marker"


echo ""
echo "2. detect-host.sh contract"
host_claude=$(HOME="$TMP_DIR/h1" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-host.sh" 2>/dev/null)
assert_output "Claude host detected" "claude" "$(jq -r '.host' <<<"$host_claude")"
assert_output "Claude platform key exists" "true" "$(jq -r 'has("platform")' <<<"$host_claude")"
assert_output "Claude marker path" "$TMP_DIR/h1/.claude/spec-first/host-setup.json" "$(jq -r '.marker_path' <<<"$host_claude")"
host_codex=$(HOME="$TMP_DIR/h2" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-host.sh" 2>/dev/null)
assert_output "Codex host detected" "codex" "$(jq -r '.host' <<<"$host_codex")"
assert_output "Codex marker path" "$TMP_DIR/h2/.codex/spec-first/host-setup.json" "$(jq -r '.marker_path' <<<"$host_codex")"


echo ""
echo "3. detect-tools.sh readiness facts"
FAKE_HOME="$TMP_DIR/facts"
FAKE_REPO="$TMP_DIR/facts_repo"
mkdir -p "$FAKE_HOME/.claude" "$FAKE_REPO"
git -C "$FAKE_REPO" init >/dev/null 2>&1
cat > "$FAKE_HOME/.claude.json" <<'JSONEOF'
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "ide-assistant", "--open-web-dashboard", "false"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
JSONEOF
facts_output="$(cd "$FAKE_REPO" && HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert "detect-tools.sh produces valid JSON" jq -e . <<<"$facts_output"
assert_output "facts host claude" "claude" "$(jq -r '.host' <<<"$facts_output")"
assert_output "facts have baseline_ready false because serena project pending" "false" "$(jq -r '.baseline_ready' <<<"$facts_output")"
assert_output "serena host config ready" "ready" "$(jq -r '.tools.serena.host_config_status' <<<"$facts_output")"
assert_output "serena project pending" "pending" "$(jq -r '.tools.serena.project_status' <<<"$facts_output")"
assert_output "facts expose bootstrap project next action" "true" "$(jq -r '.next_actions | index("bootstrap project") != null' <<<"$facts_output")"
assert_output "context7 not-applicable project" "not-applicable" "$(jq -r '.tools.context7.project_status' <<<"$facts_output")"

mkdir -p "$FAKE_REPO/.serena"
cat > "$FAKE_REPO/.serena/project.yml" <<'EOF'
project_root: fake
EOF
facts_failed="$(cd "$FAKE_REPO" && HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert_output "baseline_ready false when serena metadata exists without ready marker" "false" "$(jq -r '.baseline_ready' <<<"$facts_failed")"
assert_output "serena project failed without ready marker" "failed" "$(jq -r '.tools.serena.project_status' <<<"$facts_failed")"
cat > "$FAKE_REPO/.serena/index-ready.json" <<'EOF'
{"project_root":"fake","index_status":"ready","indexed_at":"2026-04-23T01:00:00Z"}
EOF
facts_ready="$(cd "$FAKE_REPO" && HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert_output "baseline_ready true when serena ready marker exists" "true" "$(jq -r '.baseline_ready' <<<"$facts_ready")"
assert_output "serena project ready when ready marker exists" "ready" "$(jq -r '.tools.serena.project_status' <<<"$facts_ready")"


echo ""
echo "4. install-mcp.sh integration"
FAKE_HOME2="$TMP_DIR/install"
FAKE_REPO2="$TMP_DIR/install_repo"
mkdir -p "$FAKE_HOME2" "$FAKE_REPO2"
git -C "$FAKE_REPO2" init >/dev/null 2>&1
echo '{"mcpServers":{}}' > "$FAKE_HOME2/.claude.json"
chmod 600 "$FAKE_HOME2/.claude.json"
install_output="$(cd "$FAKE_REPO2" && PATH="$TEST_PATH" HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" 2>/dev/null || true)"
assert "install-mcp.sh returns valid JSON" jq -e . <<<"$install_output"
assert_output "installer host claude" "claude" "$(jq -r '.host' <<<"$install_output")"
assert_output "installer includes serena result" "true" "$(jq -r '.results | map(select(.tool_id == "serena")) | length == 1' <<<"$install_output")"
assert_output "installer excludes optional playwright by default" "false" "$(jq -r '.results | any(.tool_id == "playwright")' <<<"$install_output")"
assert "installer creates serena bootstrap file" test -f "$FAKE_REPO2/.serena/project.yml"
assert "installer creates serena ready marker" test -f "$FAKE_REPO2/.serena/index-ready.json"
assert_output "installer reports serena bootstrap failure or readiness deterministically" "true" "$(jq -r '(.results | map(select(.tool_id == "serena"))[0].reason_code) as $code | ($code == "" or $code == "serena_bootstrap_failed")' <<<"$install_output")"
install_playwright_output="$(cd "$FAKE_REPO2" && PATH="$TEST_PATH" HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --install playwright 2>/dev/null || true)"
assert "install-mcp.sh with explicit playwright returns valid JSON" jq -e . <<<"$install_playwright_output"
assert_output "installer includes explicit playwright result" "true" "$(jq -r '.results | any(.tool_id == "playwright")' <<<"$install_playwright_output")"
assert_output "installer writes playwright host config" "npx" "$(jq -r '.mcpServers.playwright.command' "$FAKE_HOME2/.claude.json")"
assert_output "installer writes playwright host args" "true" "$(jq -r '.mcpServers.playwright.args == ["-y","@playwright/mcp@latest"]' "$FAKE_HOME2/.claude.json")"


echo ""
echo "5. verify-tools.sh readiness ledger"
VERIFY_HOME="$TMP_DIR/verify"
mkdir -p "$VERIFY_HOME/.claude" "$VERIFY_HOME/.serena"
cat > "$VERIFY_HOME/.claude.json" <<'JSONEOF'
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "ide-assistant", "--open-web-dashboard", "false"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
JSONEOF
cat > "$VERIFY_HOME/.serena/project.yml" <<'EOF'
project_root: fake
EOF
cat > "$VERIFY_HOME/.serena/index-ready.json" <<'EOF'
{"project_root":"fake","index_status":"ready","indexed_at":"2026-04-23T01:00:00Z"}
EOF
verify_output=$(cd "$VERIFY_HOME" && PATH="$TEST_PATH" HOME="$VERIFY_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh" 2>&1)
assert_contains "verify output updates marker" "宿主就绪标记已更新" "$verify_output"
ledger_path="$VERIFY_HOME/.claude/spec-first/host-setup.json"
assert "ledger file exists" test -f "$ledger_path"
assert_output "schema_version v1" "v1" "$(jq -r '.schema_version' "$ledger_path")"
assert_output "overall_status field exists" "true" "$(jq -r 'has("overall_status")' "$ledger_path")"
assert_output "baseline_ready true in ledger" "true" "$(jq -r '.baseline_ready' "$ledger_path")"
assert_output "crg cli_status field exists" "true" "$(jq -r '.crg | has("cli_status")' "$ledger_path")"
assert_output "next_actions is array" "array" "$(jq -r '.next_actions | type' "$ledger_path")"
assert_output "ledger carries serena ready status" "ready" "$(jq -r '.tools.serena.project_status' "$ledger_path")"


echo ""
echo "6. Skill and reference validation"
SKILL_MD="$REPO_ROOT/skills/spec-mcp-setup/SKILL.md"
PROMPT_SKILL_MD="$REPO_ROOT/docs/10-prompt/skills/spec-mcp-setup/SKILL.md"
REF_MD="$REPO_ROOT/skills/spec-mcp-setup/references/supported-mcp-tools.md"
GRAPH_BOOTSTRAP_SKILL_MD="$REPO_ROOT/skills/spec-graph-bootstrap/SKILL.md"
GRAPH_BOOTSTRAP_PROMPT_SKILL_MD="$REPO_ROOT/docs/10-prompt/skills/spec-graph-bootstrap/SKILL.md"
skill_body="$(cat "$SKILL_MD")"
prompt_skill_body="$(cat "$PROMPT_SKILL_MD")"
graph_bootstrap_skill_body="$(cat "$GRAPH_BOOTSTRAP_SKILL_MD")"
graph_bootstrap_prompt_skill_body="$(cat "$GRAPH_BOOTSTRAP_PROMPT_SKILL_MD")"
assert_contains "SKILL references install-mcp.sh" "skills/spec-mcp-setup/scripts/install-mcp.sh" "$skill_body"
assert_contains "SKILL references configure-host.sh" "configure-host.sh" "$skill_body"
assert_contains "SKILL references supported-mcp-tools" "references/supported-mcp-tools.md" "$skill_body"
assert_not_contains "SKILL does not reference install-coordinator" "install-coordinator.sh" "$skill_body"
assert_contains "Prompt mirror references install-mcp.sh" "skills/spec-mcp-setup/scripts/install-mcp.sh" "$prompt_skill_body"
assert "supported-mcp-tools exists" test -f "$REF_MD"
assert_contains "reference mentions Serena" "Serena" "$(cat "$REF_MD")"
assert_contains "reference mentions readiness ledger" "baseline_ready" "$(cat "$REF_MD")"
assert_contains "graph-bootstrap skill uses readiness ledger wording" "readiness ledger v1" "$graph_bootstrap_skill_body"
assert_contains "graph-bootstrap skill retires setup_success" "setup_success" "$graph_bootstrap_skill_body"
assert_contains "graph-bootstrap skill references current-repo bootstrap" "current-repo bootstrap" "$graph_bootstrap_skill_body"
assert_contains "graph-bootstrap prompt mirror uses readiness ledger wording" "readiness ledger v1" "$graph_bootstrap_prompt_skill_body"
assert_contains "graph-bootstrap prompt mirror references supported-mcp-tools" "supported-mcp-tools.md" "$graph_bootstrap_prompt_skill_body"


echo ""
echo "7. Windows entrypoint files exist"
for ps1 in check-deps.ps1 detect-host.ps1 detect-tools.ps1 install-mcp.ps1 configure-host.ps1 repair-install.ps1 activate-serena.ps1 verify-tools.ps1; do
  assert "Has $ps1" test -f "$SCRIPTS_DIR/$ps1"
done


echo ""
echo "=== summary ==="
echo "pass: $pass"
echo "fail: $fail"

if [ "$fail" -ne 0 ]; then
  exit 1
fi
