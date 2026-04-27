#!/bin/bash
# mcp-setup skill unit tests
# Tests Route B host facts, installer metadata, installer pipeline, uninstall path, and readiness ledger

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
set -euo pipefail
if [ "$#" -ge 5 ] && [ "$1" = "--from" ] && [ "$3" = "serena" ] && [ "$4" = "project" ] && [ "$5" = "create" ]; then
  repo_root="$6"
  mkdir -p "$repo_root/.serena"
  cat > "$repo_root/.serena/project.yml" <<YAML
project_root: "$repo_root"
languages:
  - typescript
  - vue
  - markdown
  - yaml
  - bash
created_by: spec-mcp-setup
YAML
  cat > "$repo_root/.serena/index-ready.json" <<JSON
{"project_root":"$repo_root","index_status":"ready","indexed_at":"2026-04-23T02:40:00Z"}
JSON
fi
exit 0
EOF
cat > "$FAKE_BIN/npx" <<'EOF'
#!/bin/bash
exit 0
EOF
cat > "$FAKE_BIN/uv" <<'EOF'
#!/bin/bash
exit 0
EOF
FAKE_SPEC_FIRST_PKG="$TMP_DIR/fake-spec-first"
mkdir -p "$FAKE_SPEC_FIRST_PKG/bin" \
  "$FAKE_SPEC_FIRST_PKG/node_modules/better-sqlite3" \
  "$FAKE_SPEC_FIRST_PKG/node_modules/tree-sitter"
cat > "$FAKE_SPEC_FIRST_PKG/package.json" <<'EOF'
{"name":"spec-first","version":"0.0.0-test"}
EOF
cat > "$FAKE_SPEC_FIRST_PKG/bin/spec-first" <<'EOF'
#!/bin/bash
set -euo pipefail
if [ "${1:-}" = "crg" ] && [ "${2:-}" = "--help" ]; then
  exit 0
fi
exit 1
EOF
cat > "$FAKE_SPEC_FIRST_PKG/node_modules/better-sqlite3/package.json" <<'EOF'
{"name":"better-sqlite3","version":"0.0.0-test"}
EOF
cat > "$FAKE_SPEC_FIRST_PKG/node_modules/better-sqlite3/index.js" <<'EOF'
module.exports = {};
EOF
cat > "$FAKE_SPEC_FIRST_PKG/node_modules/tree-sitter/package.json" <<'EOF'
{"name":"tree-sitter","version":"0.0.0-test"}
EOF
cat > "$FAKE_SPEC_FIRST_PKG/node_modules/tree-sitter/index.js" <<'EOF'
module.exports = {};
EOF
ln -s "$FAKE_SPEC_FIRST_PKG/bin/spec-first" "$FAKE_BIN/spec-first"
chmod +x "$FAKE_BIN/uvx" "$FAKE_BIN/npx" "$FAKE_BIN/uv" "$FAKE_SPEC_FIRST_PKG/bin/spec-first"
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
assert_output "schema_version is 3" "3" "$(jq -r '.schema_version' "$TOOLS_JSON")"
assert_output "4 tools defined" "4" "$(jq '.tools | length' "$TOOLS_JSON")"
assert_output "3 required tools" "3" "$(jq '[.tools[] | select(.required == true)] | length' "$TOOLS_JSON")"
assert_output "1 optional tool" "1" "$(jq '[.tools[] | select(.required == false)] | length' "$TOOLS_JSON")"
assert_output "summary column count 7" "7" "$(jq -r '.summary_columns | length' "$TOOLS_JSON")"
assert_output "tool ids stable" "serena,sequential-thinking,context7,playwright" "$(jq -r '[.tools[].id] | join(",")' "$TOOLS_JSON")"
assert_output "agent-browser is not an MCP registry tool" "false" "$(jq -r '[.tools[].id] | index("agent-browser") != null' "$TOOLS_JSON")"
assert_output "Claude scope defaults managed" "true" "$(jq -r '[.tools[] | .host_config.claude.scope == "managed"] | all' "$TOOLS_JSON")"
assert_output "Codex scope defaults user" "true" "$(jq -r '[.tools[] | .host_config.codex.scope == "user"] | all' "$TOOLS_JSON")"
assert_output "Claude managed macOS path" "/Library/Application Support/ClaudeCode/managed-mcp.json" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.claude.targets.managed.config_path.macos' "$TOOLS_JSON")"
assert_output "Claude managed Linux path" "/etc/claude-code/managed-mcp.json" "$(jq -r '.tools[] | select(.id == "context7") | .host_config.claude.targets.managed.config_path.linux' "$TOOLS_JSON")"
assert_output "Codex user path template" '$HOME/.codex/config.toml' "$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.targets.user.config_path' "$TOOLS_JSON")"
assert_output "Codex system path" "/etc/codex/config.toml" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.targets.system.config_path' "$TOOLS_JSON")"
assert_output "Codex system precedence 100" "100" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.targets.system.precedence' "$TOOLS_JSON")"
assert_output "Codex system writable check file-only" "file-only" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.targets.system.writable_check' "$TOOLS_JSON")"
assert_output "Claude fallback order managed,user" "managed,user" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.claude.fallback_order | join(",")' "$TOOLS_JSON")"
assert_output "Codex fallback order user" "user" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.fallback_order | join(",")' "$TOOLS_JSON")"
assert_output "Claude uninstall targets managed,user" "managed,user" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.claude.uninstall_targets | join(",")' "$TOOLS_JSON")"
assert_output "Codex uninstall targets user,system" "user,system" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.uninstall_targets | join(",")' "$TOOLS_JSON")"
assert_output "Serena codex timeout is 90" "90" "$(jq -r '.tools[] | select(.id == "serena") | .host_config.codex.startup_timeout_sec' "$TOOLS_JSON")"
assert_output "Serena project bootstrap file" ".serena/project.yml" "$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.project_file' "$TOOLS_JSON")"
assert_output "Serena ready marker file" ".serena/index-ready.json" "$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.ready_marker_file' "$TOOLS_JSON")"
assert_output "Context7 package remains current" "@upstash/context7-mcp" "$(jq -r '.tools[] | select(.id == "context7") | .host_config.claude.args[1]' "$TOOLS_JSON")"
assert_output "Sequential Thinking package remains current" "@modelcontextprotocol/server-sequential-thinking" "$(jq -r '.tools[] | select(.id == "sequential-thinking") | .host_config.codex.args[1]' "$TOOLS_JSON")"
assert_output "Playwright remains optional" "false" "$(jq -r '.tools[] | select(.id == "playwright") | .required' "$TOOLS_JSON")"
assert "uninstall-mcp.sh exists" test -f "$SCRIPTS_DIR/uninstall-mcp.sh"
assert "uninstall-mcp.ps1 exists" test -f "$SCRIPTS_DIR/uninstall-mcp.ps1"
missing_jq_dir="$TMP_DIR/no-jq-bin"
mkdir -p "$missing_jq_dir"
ln -s /bin/bash "$missing_jq_dir/bash"
ln -s /bin/uname "$missing_jq_dir/uname" 2>/dev/null || ln -s /usr/bin/uname "$missing_jq_dir/uname"
missing_jq_stderr="$TMP_DIR/missing-jq.stderr"
if PATH="$missing_jq_dir" bash "$SCRIPTS_DIR/check-deps.sh" >"$TMP_DIR/missing-jq.stdout" 2>"$missing_jq_stderr"; then
  missing_jq_status=0
else
  missing_jq_status=$?
fi
assert_output "check-deps.sh exits non-zero when jq is missing" "1" "$missing_jq_status"
assert_contains "missing jq reports hard prerequisite" "jq 是必需依赖" "$(cat "$missing_jq_stderr")"
assert_contains "missing jq reports install suggestion" "建议：" "$(cat "$missing_jq_stderr")"


echo ""
echo "2. detect-host.sh contract"
host_claude=$(HOME="$TMP_DIR/h1" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-host.sh" 2>/dev/null)
assert_output "Claude host detected" "claude" "$(jq -r '.host' <<<"$host_claude")"
assert_output "Claude primary scope managed" "managed" "$(jq -r '.primary_scope' <<<"$host_claude")"
assert_output "Claude selected scope falls back to user" "user" "$(jq -r '.selected_scope' <<<"$host_claude")"
assert_output "Claude config path falls back to user file" "$TMP_DIR/h1/.claude.json" "$(jq -r '.config_path' <<<"$host_claude")"
assert_output "Claude marker path" "$TMP_DIR/h1/.claude/spec-first/host-setup.json" "$(jq -r '.marker_path' <<<"$host_claude")"
assert_output "Claude managed target path exposed" "/Library/Application Support/ClaudeCode/managed-mcp.json" "$(jq -r '.targets.managed.config_path' <<<"$host_claude")"
assert_output "Claude user target path exposed" "$TMP_DIR/h1/.claude.json" "$(jq -r '.targets.user.config_path' <<<"$host_claude")"
assert_output "Claude fallback order exposed" "managed,user" "$(jq -r '.fallback_order | join(",")' <<<"$host_claude")"
assert_output "Claude uninstall targets exposed" "managed,user" "$(jq -r '.uninstall_targets | join(",")' <<<"$host_claude")"
managed_override_path="$TMP_DIR/managed-target/managed-mcp.json"
mkdir -p "$(dirname "$managed_override_path")"
echo '{"mcpServers":{}}' > "$managed_override_path"
host_claude_managed=$(HOME="$TMP_DIR/h1" MCP_SETUP_HOST=claude MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE="$managed_override_path" bash "$SCRIPTS_DIR/detect-host.sh" 2>/dev/null)
assert_output "Claude selected scope managed when override target writable" "managed" "$(jq -r '.selected_scope' <<<"$host_claude_managed")"
assert_output "Claude managed override path selected" "$managed_override_path" "$(jq -r '.config_path' <<<"$host_claude_managed")"
host_codex=$(HOME="$TMP_DIR/h2" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-host.sh" 2>/dev/null)
assert_output "Codex host detected" "codex" "$(jq -r '.host' <<<"$host_codex")"
assert_output "Codex primary scope user" "user" "$(jq -r '.primary_scope' <<<"$host_codex")"
assert_output "Codex selected scope user" "user" "$(jq -r '.selected_scope' <<<"$host_codex")"
assert_output "Codex config path" "$TMP_DIR/h2/.codex/config.toml" "$(jq -r '.config_path' <<<"$host_codex")"
assert_output "Codex marker path" "$TMP_DIR/h2/.codex/spec-first/host-setup.json" "$(jq -r '.marker_path' <<<"$host_codex")"
assert_output "Codex system target path exposed" "/etc/codex/config.toml" "$(jq -r '.targets.system.config_path' <<<"$host_codex")"
assert_output "Codex precedence blocked false by default" "false" "$(jq -r '.precedence_blocked' <<<"$host_codex")"


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
facts_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert "detect-tools.sh produces valid JSON" jq -e . <<<"$facts_output"
assert_output "facts host claude" "claude" "$(jq -r '.host' <<<"$facts_output")"
assert_output "facts baseline_ready false because serena project pending" "false" "$(jq -r '.baseline_ready' <<<"$facts_output")"
assert_output "serena host config fallback-active on Claude user fallback" "fallback-active" "$(jq -r '.tools.serena.host_config_status' <<<"$facts_output")"
assert_output "serena selected scope user" "user" "$(jq -r '.tools.serena.selected_scope' <<<"$facts_output")"
assert_output "serena project pending" "pending" "$(jq -r '.tools.serena.project_status' <<<"$facts_output")"
assert_output "facts expose bootstrap project next action" "true" "$(jq -r '.next_actions | index("bootstrap project") != null' <<<"$facts_output")"
assert_output "context7 not-applicable project" "not-applicable" "$(jq -r '.tools.context7.project_status' <<<"$facts_output")"
assert_output "crg cli ready with fake installed CLI" "ready" "$(jq -r '.crg.cli_status' <<<"$facts_output")"
assert_output "crg native modules resolve from CLI install context" "ready" "$(jq -r '.crg.native_modules_status' <<<"$facts_output")"

mkdir -p "$FAKE_REPO/.serena"
cat > "$FAKE_REPO/.serena/project.yml" <<'EOF'
project_root: fake
EOF
facts_failed="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert_output "baseline_ready false when serena metadata exists without ready marker" "false" "$(jq -r '.baseline_ready' <<<"$facts_failed")"
assert_output "serena project failed without ready marker" "failed" "$(jq -r '.tools.serena.project_status' <<<"$facts_failed")"
cat > "$FAKE_REPO/.serena/index-ready.json" <<'EOF'
{"project_root":"fake","index_status":"ready","indexed_at":"2026-04-23T01:00:00Z"}
EOF
facts_ready="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert_output "baseline_ready true when serena ready marker exists" "true" "$(jq -r '.baseline_ready' <<<"$facts_ready")"
assert_output "serena project ready when ready marker exists" "ready" "$(jq -r '.tools.serena.project_status' <<<"$facts_ready")"
assert_output "overall status partial under fallback-active" "partial" "$(jq -r '.overall_status' <<<"$facts_ready")"
cat > "$TMP_DIR/managed-target/managed-mcp.json" <<'JSONEOF'
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
managed_facts_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE="$TMP_DIR/managed-target/managed-mcp.json" bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert_output "managed override yields ready host config" "ready" "$(jq -r '.tools.serena.host_config_status' <<<"$managed_facts_output")"
assert_output "managed override yields managed selected scope" "managed" "$(jq -r '.tools.serena.selected_scope' <<<"$managed_facts_output")"
mkdir -p "$TMP_DIR/codex-system"
echo '[mcp_servers.external]' > "$TMP_DIR/codex-system/config.toml"
mkdir -p "$TMP_DIR/codex-home/.codex" "$TMP_DIR/codex-repo"
git -C "$TMP_DIR/codex-repo" init >/dev/null 2>&1
echo '[mcp_servers.serena]
command = "uvx"
args = ["--from","git+https://github.com/oraios/serena","serena","start-mcp-server","--project-from-cwd","--context","codex","--open-web-dashboard","false"]' > "$TMP_DIR/codex-home/.codex/config.toml"
facts_codex_precedence="$(cd "$TMP_DIR/codex-repo" && PATH="$TEST_PATH" HOME="$TMP_DIR/codex-home" MCP_SETUP_HOST=codex MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE="$TMP_DIR/codex-system/config.toml" bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)"
assert_output "Codex precedence-blocked when higher-precedence config exists" "precedence-blocked" "$(jq -r '.tools.serena.host_config_status' <<<"$facts_codex_precedence")"
assert_output "Codex selected scope remains user under precedence block" "user" "$(jq -r '.tools.serena.selected_scope' <<<"$facts_codex_precedence")"
assert_output "Codex overall status action-required under precedence block" "action-required" "$(jq -r '.overall_status' <<<"$facts_codex_precedence")"


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
assert_output "installer records configured path" "$FAKE_HOME2/.claude.json" "$(jq -r '.results | map(select(.tool_id == "serena"))[0].configured_path' <<<"$install_output")"
assert_output "installer records selected scope user" "user" "$(jq -r '.results | map(select(.tool_id == "serena"))[0].selected_scope' <<<"$install_output")"
assert_output "installer records fallback applied true" "true" "$(jq -r '.results | map(select(.tool_id == "serena"))[0].fallback_applied' <<<"$install_output")"
assert "installer creates serena bootstrap file" test -f "$FAKE_REPO2/.serena/project.yml"
assert_output "installer bootstrap file includes languages" "true" "$(grep -q '^languages:' "$FAKE_REPO2/.serena/project.yml" && printf true || printf false)"
assert "installer creates serena ready marker" test -f "$FAKE_REPO2/.serena/index-ready.json"
assert_output "installer reports serena ready after bootstrap" "ready" "$(jq -r '.results | map(select(.tool_id == "serena"))[0].status' <<<"$install_output")"
install_playwright_output="$(cd "$FAKE_REPO2" && PATH="$TEST_PATH" HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --install playwright 2>/dev/null || true)"
assert "install-mcp.sh with explicit playwright returns valid JSON" jq -e . <<<"$install_playwright_output"
assert_output "installer includes explicit playwright result" "true" "$(jq -r '.results | any(.tool_id == "playwright")' <<<"$install_playwright_output")"
assert_output "installer writes playwright host config" "npx" "$(jq -r '.mcpServers.playwright.command' "$FAKE_HOME2/.claude.json")"
assert_output "installer writes playwright host args" "true" "$(jq -r '.mcpServers.playwright.args == ["-y","@playwright/mcp@latest"]' "$FAKE_HOME2/.claude.json")"
install_skip_optional_output="$(cd "$FAKE_REPO2" && PATH="$TEST_PATH" HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --skip playwright 2>/dev/null || true)"
assert "install-mcp.sh with optional skip returns valid JSON" jq -e . <<<"$install_skip_optional_output"
assert_output "optional skip still includes serena" "true" "$(jq -r '.results | any(.tool_id == "serena")' <<<"$install_skip_optional_output")"
assert_output "optional skip excludes playwright" "false" "$(jq -r '.results | any(.tool_id == "playwright")' <<<"$install_skip_optional_output")"
install_skip_required_output="$(cd "$FAKE_REPO2" && PATH="$TEST_PATH" HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --skip serena 2>/dev/null || true)"
assert "install-mcp.sh with required skip returns valid JSON" jq -e . <<<"$install_skip_required_output"
assert_output "required skip reports action-required" "action-required" "$(jq -r '.results | map(select(.tool_id == "serena"))[0].status' <<<"$install_skip_required_output")"
assert_output "required skip reports invalid_required_skip" "invalid_required_skip" "$(jq -r '.results | map(select(.tool_id == "serena"))[0].reason_code' <<<"$install_skip_required_output")"
FAIL_BIN="$TMP_DIR/fail-bin"
mkdir -p "$FAIL_BIN"
cat > "$FAIL_BIN/npx" <<'EOF'
#!/bin/bash
echo 'simulated "warmup" failure' >&2
exit 42
EOF
chmod +x "$FAIL_BIN/npx"
install_warmup_fail_output="$(cd "$FAKE_REPO2" && PATH="$FAIL_BIN:$TEST_PATH" HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --install context7 2>/dev/null || true)"
assert "install-mcp.sh warmup failure returns valid JSON" jq -e . <<<"$install_warmup_fail_output"
assert_output "warmup failure reports reason code" "warmup_failed" "$(jq -r '.results | map(select(.tool_id == "context7"))[0].reason_code' <<<"$install_warmup_fail_output")"
assert_output "warmup failure records exit code" "42" "$(jq -r '.results | map(select(.tool_id == "context7"))[0].exit_code' <<<"$install_warmup_fail_output")"
assert_output "warmup failure records bounded diagnostic" "true" "$(jq -r '.results | map(select(.tool_id == "context7"))[0].diagnostic_summary | contains("warmup")' <<<"$install_warmup_fail_output")"
uninstall_output="$(HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/uninstall-mcp.sh" --tool playwright 2>/dev/null || true)"
assert "uninstall-mcp.sh returns valid JSON" jq -e . <<<"$uninstall_output"
assert_output "uninstall reports removed playwright" "playwright" "$(jq -r '.removed_tools[0]' <<<"$uninstall_output")"
assert_output "uninstall removes playwright from config" "false" "$(jq -r '.mcpServers | has("playwright")' "$FAKE_HOME2/.claude.json")"


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
assert_contains "verify output shows baseline_ready" "MCP baseline_ready:" "$verify_output"
ledger_path="$VERIFY_HOME/.claude/spec-first/host-setup.json"
assert "ledger file exists" test -f "$ledger_path"
assert_output "schema_version v1" "v1" "$(jq -r '.schema_version' "$ledger_path")"
assert_output "overall_status field exists" "true" "$(jq -r 'has("overall_status")' "$ledger_path")"
assert_output "baseline_ready true in ledger" "true" "$(jq -r '.baseline_ready' "$ledger_path")"
assert_output "serena host config fallback-active in ledger" "fallback-active" "$(jq -r '.tools.serena.host_config_status' "$ledger_path")"
assert_output "serena selected scope user in ledger" "user" "$(jq -r '.tools.serena.selected_scope' "$ledger_path")"
assert_output "ledger includes helper tools" "true" "$(jq -r 'has("helper_tools")' "$ledger_path")"
assert_output "agent-browser helper is required in ledger" "true" "$(jq -r '.helper_tools."agent-browser".required' "$ledger_path")"
assert_output "agent-browser helper has non-MCP host config" "not-applicable" "$(jq -r '.helper_tools."agent-browser".host_config_status' "$ledger_path")"
assert_output "next_actions is array" "array" "$(jq -r '.next_actions | type' "$ledger_path")"


echo ""
echo "6. Skill and reference validation"
SKILL_MD="$REPO_ROOT/skills/spec-mcp-setup/SKILL.md"
REF_MD="$REPO_ROOT/skills/spec-mcp-setup/references/supported-mcp-tools.md"
GRAPH_BOOTSTRAP_SKILL_MD="$REPO_ROOT/skills/spec-graph-bootstrap/SKILL.md"
CHECK_HEALTH="$REPO_ROOT/skills/spec-mcp-setup/scripts/check-health"
SETUP_SKILL_MD="$REPO_ROOT/skills/spec-setup/SKILL.md"
SETUP_CHECK_HEALTH="$REPO_ROOT/skills/spec-setup/scripts/check-health"
CONFIG_TEMPLATE="$REPO_ROOT/skills/spec-mcp-setup/references/config-template.yaml"
skill_body="$(cat "$SKILL_MD")"
setup_skill_body="$(cat "$SETUP_SKILL_MD")"
graph_bootstrap_skill_body="$(cat "$GRAPH_BOOTSTRAP_SKILL_MD")"
assert "migrated check-health exists" test -f "$CHECK_HEALTH"
assert "migrated config template exists" test -f "$CONFIG_TEMPLATE"
assert_contains "check-health lists agent-browser helper" "agent-browser" "$(cat "$CHECK_HEALTH")"
assert_contains "check-health marks agent-browser required" '"agent-browser|required"' "$(cat "$CHECK_HEALTH")"
assert_contains "check-health prints install status table" 'Tool install status' "$(cat "$CHECK_HEALTH")"
assert_contains "check-health prints required column" 'Required' "$(cat "$CHECK_HEALTH")"
assert_contains "check-health prints status column" 'Status' "$(cat "$CHECK_HEALTH")"
assert_contains "check-health supports JSON helper facts" '--json' "$(cat "$CHECK_HEALTH")"
assert_contains "check-health installs agent-browser CLI" "npm install -g agent-browser" "$(cat "$CHECK_HEALTH")"
assert_contains "check-health initializes agent-browser runtime" "agent-browser install" "$(cat "$CHECK_HEALTH")"
assert_contains "check-health installs upstream agent-browser skill" "npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y" "$(cat "$CHECK_HEALTH")"
assert_contains "SKILL references install-mcp.sh" "skills/spec-mcp-setup/scripts/install-mcp.sh" "$skill_body"
assert_contains "SKILL references uninstall-mcp.sh" "uninstall-mcp.sh" "$skill_body"
assert_contains "SKILL mentions managed-mcp.json" "managed-mcp.json" "$skill_body"
assert_contains "SKILL mentions /etc/codex/config.toml" "/etc/codex/config.toml" "$skill_body"
assert_contains "SKILL mentions fallback-active" "fallback-active" "$skill_body"
assert_contains "SKILL separates agent-browser helper boundary" "browser automation helper substrate" "$skill_body"
assert_contains "SKILL says agent-browser required" '`agent-browser` is required' "$skill_body"
assert_contains "SKILL merges helper tools into final table" "helper_tools" "$skill_body"
assert_contains "SKILL table includes Type column" "Tool | Type | Required | Dependency | Host Config | Project Bootstrap | Result | Next Action" "$skill_body"
assert_contains "SKILL sorts required MCP before helpers" "required MCP tools" "$skill_body"
assert_contains "SKILL maps not-applicable to n/a" 'not-applicable` -> `n/a' "$skill_body"
assert_contains "SKILL clarifies optional MCP pending display" "optional-pending" "$skill_body"
assert_contains "reference mentions fallback-active" "fallback-active" "$(cat "$REF_MD")"
assert_contains "reference mentions precedence-blocked" "precedence-blocked" "$(cat "$REF_MD")"
assert_contains "reference mentions baseline_ready" "baseline_ready" "$(cat "$REF_MD")"
assert_contains "reference keeps agent-browser outside MCP index" "not listed in the MCP Tool Index" "$(cat "$REF_MD")"
assert_contains "reference records agent-browser floating upstream policy" "intentionally floats the current upstream package and skill source" "$(cat "$REF_MD")"
assert_contains "reference points agent-browser docs to CLI-served upstream docs" "agent-browser skills get core" "$(cat "$REF_MD")"
assert_contains "spec-setup delegates agent-browser setup to spec-mcp-setup" 'Browser automation setup is owned by `spec-mcp-setup`' "$setup_skill_body"
assert_not_contains "spec-setup script has no independent agent-browser install command" "npm install -g agent-browser" "$(cat "$SETUP_CHECK_HEALTH")"
assert_contains "graph-bootstrap skill uses readiness ledger wording" "readiness ledger v1" "$graph_bootstrap_skill_body"
assert_contains "graph-bootstrap skill mentions fallback-active" "fallback-active" "$graph_bootstrap_skill_body"
assert_not_contains "SKILL does not mention retired coordinator" "install-coordinator.sh" "$skill_body"


echo ""
echo "7. Windows and uninstall entrypoint files exist"
for script in check-deps.sh detect-host.sh detect-tools.sh install-mcp.sh configure-host.sh repair-install.sh activate-serena.sh verify-tools.sh uninstall-mcp.sh; do
  assert "Has $script" test -f "$SCRIPTS_DIR/$script"
done
for ps1 in check-deps.ps1 detect-host.ps1 detect-tools.ps1 install-mcp.ps1 configure-host.ps1 repair-install.ps1 activate-serena.ps1 verify-tools.ps1 uninstall-mcp.ps1; do
  assert "Has $ps1" test -f "$SCRIPTS_DIR/$ps1"
done


echo ""
echo "=== summary ==="
echo "pass: $pass"
echo "fail: $fail"

if [ "$fail" -ne 0 ]; then
  exit 1
fi
