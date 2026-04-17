#!/bin/bash
# mcp-setup skill unit tests
# Tests check-deps.sh, detect-tools.sh, install-coordinator.sh, and config files

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/skills/spec-mcp-setup/scripts"
TOOLS_JSON="$REPO_ROOT/skills/spec-mcp-setup/mcp-tools.json"
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

# ============================================================================
echo "1. Config file validation"

echo "1.1 mcp-tools.json is valid JSON"
assert "mcp-tools.json is valid JSON" jq -e . "$TOOLS_JSON" >/dev/null

echo "1.2 mcp-tools.json has 5 tools"
tool_count=$(jq '.tools | length' "$TOOLS_JSON")
assert_output "5 tools defined" "5" "$tool_count"

echo "1.3 All tools have required fields"
for field in id name category description dependencies detect; do
  missing=$(jq -r --arg f "$field" '.tools[] | select(.[$f] == null) | .id' "$TOOLS_JSON" 2>/dev/null || true)
  assert "All tools have '$field'" test -z "$missing"
done

echo "1.4 Required tools have correct IDs"
required_ids=$(jq -r '.tools[] | select(.category == "required") | .id' "$TOOLS_JSON" | sort | paste -sd ',' -)
assert_output "Required tool count is 3" "3" "$(echo "$required_ids" | tr ',' '\n' | wc -l | tr -d ' ')"
assert_contains "Has serena" "serena" "$required_ids"
assert_contains "Has sequential-thinking" "sequential-thinking" "$required_ids"
assert_contains "Has context7" "context7" "$required_ids"
assert_not_contains "No gitnexus" "gitnexus" "$required_ids"
assert_not_contains "No abcoder" "abcoder" "$required_ids"

echo "1.5 Optional tools have correct IDs"
optional_ids=$(jq -r '[.tools[] | select(.category == "optional") | .id] | sort | join(",")' "$TOOLS_JSON")
assert_output "Optional tool IDs" "feishu,playwright" "$optional_ids"

echo "1.6 Serena has correct entry point"
serena_cmd=$(jq -r '.tools[] | select(.id == "serena") | .mcp_config.command' "$TOOLS_JSON")
assert_output "Serena uses uvx" "uvx" "$serena_cmd"
serena_args=$(jq -r '.tools[] | select(.id == "serena") | .mcp_config.args | join(" ")' "$TOOLS_JSON")
assert_contains "Serena args include serena start-mcp-server" "serena start-mcp-server" "$serena_args"
assert_contains "Serena args include --project-from-cwd" "--project-from-cwd" "$serena_args"
assert_contains "Serena args keep host placeholder" "__HOST_CONTEXT__" "$serena_args"
serena_startup_timeout=$(jq -r '.tools[] | select(.id == "serena") | .mcp_config.startup_timeout_sec' "$TOOLS_JSON")
assert_output "Serena startup_timeout_sec is 90" "90" "$serena_startup_timeout"

echo ""

# ============================================================================
echo "2. check-deps.sh tests"

echo "2.1 Produces valid JSON"
deps_output=$(bash "$SCRIPTS_DIR/check-deps.sh" 2>/dev/null)
assert "check-deps.sh produces valid JSON" jq -e . <<<"$deps_output"

echo "2.2 JSON has expected top-level keys"
for key in os node uv jq; do
  assert "JSON has '$key' key" jq -e ".$key" <<<"$deps_output"
done
assert "JSON does not have go key" jq -e '.go | not' <<<"$deps_output"

echo "2.3 Installed deps have 'installed: true' and 'version'"
for dep in node uv jq; do
  installed=$(jq -r ".$dep.installed" <<<"$deps_output")
  version=$(jq -r ".$dep.version" <<<"$deps_output")
  assert "$dep is installed" test "$installed" = "true"
  assert "$dep has version" test -n "$version" -a "$version" != "null"
done

echo "2.4 Installed deps have null install_suggestion"
for dep in node uv jq; do
  suggestion=$(jq -r ".$dep.install_suggestion" <<<"$deps_output")
  assert "$dep install_suggestion is null" test "$suggestion" = "null"
done

echo "2.5 OS detection returns valid value"
os_val=$(jq -r '.os' <<<"$deps_output")
assert "OS is detected" test -n "$os_val" -a "$os_val" != "null"

echo ""

# ============================================================================
echo "3. detect-tools.sh tests"

echo "3.1 Produces valid JSON"
detect_output=$(bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
assert "detect-tools.sh produces valid JSON" jq -e . <<<"$detect_output"

echo "3.2 JSON has installed and missing arrays"
assert "JSON has 'installed' array" jq -e '.installed | type == "array"' <<<"$detect_output"
assert "JSON has 'missing' array" jq -e '.missing | type == "array"' <<<"$detect_output"

echo "3.3 All tools accounted for (no duplicates, no gaps) [5 total]"
installed_count=$(jq '.installed | length' <<<"$detect_output")
missing_count=$(jq '.missing | length' <<<"$detect_output")
total=$((installed_count + missing_count))
assert_output "Total tools = 5" "5" "$total"

echo "3.4 installed array has no empty strings"
empty_installed=$(jq '[.installed[] | select(. == "")] | length' <<<"$detect_output")
assert_output "No empty strings in installed" "0" "$empty_installed"

echo "3.5 missing array has no empty strings"
empty_missing=$(jq '[.missing[] | select(. == "")] | length' <<<"$detect_output")
assert_output "No empty strings in missing" "0" "$empty_missing"

echo "3.6 detect-host.sh reports host-specific paths"
host_claude=$(MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-host.sh" 2>/dev/null)
assert_output "Claude host detected" "claude" "$(jq -r '.host' <<<"$host_claude")"
assert_output "Claude config path" "$HOME/.claude.json" "$(jq -r '.config_path' <<<"$host_claude")"
assert_output "Claude marker path" "$HOME/.claude/spec-first/host-setup.json" "$(jq -r '.marker_path' <<<"$host_claude")"
host_codex=$(MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-host.sh" 2>/dev/null)
assert_output "Codex host detected" "codex" "$(jq -r '.host' <<<"$host_codex")"
assert_output "Codex config path" "$HOME/.codex/config.toml" "$(jq -r '.config_path' <<<"$host_codex")"
assert_output "Codex marker path" "$HOME/.codex/spec-first/host-setup.json" "$(jq -r '.marker_path' <<<"$host_codex")"

echo "3.7 Ambiguous host detection requires explicit MCP_SETUP_HOST"
FAKE_BIN="$TMP_DIR/fake_bin"
mkdir -p "$FAKE_BIN"
cat > "$FAKE_BIN/claude" <<'SHELLEOF'
#!/bin/sh
exit 0
SHELLEOF
cat > "$FAKE_BIN/codex" <<'SHELLEOF'
#!/bin/sh
exit 0
SHELLEOF
chmod +x "$FAKE_BIN/claude" "$FAKE_BIN/codex"
set +e
ambiguous_output=$(PATH="$FAKE_BIN:$PATH" env -u MCP_SETUP_HOST -u CODEX_CI -u CODEX_MANAGED_BY_NPM -u CODEX_THREAD_ID -u CODEX_SANDBOX -u CLAUDE_CODE_SSE_PORT -u CLAUDE_CODE_SESSION_ID -u CLAUDE_PROJECT_DIR bash "$SCRIPTS_DIR/detect-host.sh" 2>&1)
ambiguous_status=$?
set -e
assert_output "Ambiguous host exits non-zero" "1" "$ambiguous_status"
assert_contains "Ambiguous host reports explicit guidance" "请显式设置 MCP_SETUP_HOST=claude 或 MCP_SETUP_HOST=codex" "$ambiguous_output"

echo "3.8 Detection works when all required tools are configured"
FAKE_HOME="$TMP_DIR/detect_home"
mkdir -p "$FAKE_HOME"
mkdir -p "$FAKE_HOME/.claude"
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
detect_full=$(HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
full_installed=$(jq -r '.installed | sort | join(",")' <<<"$detect_full")
assert_output "All required tools installed" "context7,sequential-thinking,serena" "$full_installed"
full_missing_count=$(jq '.missing | length' <<<"$detect_full")
assert_output "No missing tools when config present" "2" "$full_missing_count"

echo "3.9 Codex config.toml is detected"
FAKE_HOME_C="$TMP_DIR/detect_home_codex"
mkdir -p "$FAKE_HOME_C/.codex"
cat > "$FAKE_HOME_C/.codex/config.toml" <<'TOMLEOF'
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "codex", "--open-web-dashboard", "false"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.sequential-thinking]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-sequential-thinking"]
TOMLEOF
detect_codex=$(HOME="$FAKE_HOME_C" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
codex_installed=$(jq -r '.installed | sort | join(",")' <<<"$detect_codex")
assert_output "Codex required tools installed" "context7,sequential-thinking,serena" "$codex_installed"
codex_missing_count=$(jq '.missing | length' <<<"$detect_codex")
assert_output "No missing tools in codex config" "2" "$codex_missing_count"

echo "3.10 Codex config with wrong Serena context is treated as missing"
cat > "$FAKE_HOME_C/.codex/config.toml" <<'TOMLEOF'
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "ide-assistant", "--open-web-dashboard", "false"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.sequential-thinking]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-sequential-thinking"]
TOMLEOF
detect_codex_wrong=$(HOME="$FAKE_HOME_C" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
wrong_installed=$(jq -r '.installed | sort | join(",")' <<<"$detect_codex_wrong")
assert_output "Wrong Serena context excludes serena" "context7,sequential-thinking" "$wrong_installed"
wrong_missing=$(jq -r '.missing | sort | join(",")' <<<"$detect_codex_wrong")
assert_output "Wrong Serena context marks serena missing" "feishu,playwright,serena" "$wrong_missing"

echo "3.11 Empty config yields all tools missing"
echo '{}' > "$FAKE_HOME/.claude.json"
detect_empty=$(HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
empty_missing=$(jq '.missing | length' <<<"$detect_empty")
assert_output "All 5 tools missing" "5" "$empty_missing"

echo ""

# ============================================================================
echo "4. install-coordinator.sh tests"

echo "4.1 Claude install configures only required tools"
FAKE_HOME2="$TMP_DIR/test_install"
mkdir -p "$FAKE_HOME2"
echo '{"mcpServers":{}}' > "$FAKE_HOME2/.claude.json"
chmod 600 "$FAKE_HOME2/.claude.json"

install_output_41=$(HOME="$FAKE_HOME2" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-coordinator.sh" 2>&1 || true)
assert_contains "Install output has friendly intro" "我会先检查当前宿主的配置" "$install_output_41"
assert_contains "Install output shows per-tool progress" "正在为 Claude Code 写入 serena 配置" "$install_output_41"
for tool in serena context7 sequential-thinking; do
  configured=$(jq -r --arg t "$tool" '.mcpServers[$t].command // empty' "$FAKE_HOME2/.claude.json")
  assert "$tool configured" test -n "$configured"
done
serena_host_context=$(jq -r '.mcpServers.serena.args | join(" ")' "$FAKE_HOME2/.claude.json")
assert_contains "Claude Serena context resolves to ide-assistant" "ide-assistant" "$serena_host_context"
playwright_default=$(jq -r '.mcpServers.playwright // empty' "$FAKE_HOME2/.claude.json")
assert "playwright not installed by default" test -z "$playwright_default"

echo "4.2 --skip flag works"
FAKE_HOME3="$TMP_DIR/test_skip"
mkdir -p "$FAKE_HOME3"
echo '{"mcpServers":{}}' > "$FAKE_HOME3/.claude.json"
chmod 600 "$FAKE_HOME3/.claude.json"
HOME="$FAKE_HOME3" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-coordinator.sh" --skip playwright >/dev/null 2>&1 || true
playwright_skip=$(jq -r '.mcpServers.playwright // empty' "$FAKE_HOME3/.claude.json")
assert "playwright skipped" test -z "$playwright_skip"

echo "4.3 Existing config is preserved"
FAKE_HOME4="$TMP_DIR/test_merge"
mkdir -p "$FAKE_HOME4"
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
HOME="$FAKE_HOME4" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-coordinator.sh" >/dev/null 2>&1 || true
serena_cmd_after=$(jq -r '.mcpServers.serena.command' "$FAKE_HOME4/.claude.json")
assert_output "Existing config preserved" "custom-serena" "$serena_cmd_after"

echo "4.4 Creates config when missing"
FAKE_HOME5="$TMP_DIR/test_create"
mkdir -p "$FAKE_HOME5"
HOME="$FAKE_HOME5" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-coordinator.sh" >/dev/null 2>&1 || true
assert "Config created" test -f "$FAKE_HOME5/.claude.json"
config_valid=$(jq -e '.mcpServers.context7' "$FAKE_HOME5/.claude.json" 2>/dev/null)
assert "context7 configured in new file" test -n "$config_valid"

echo "4.5 Codex install configures codex config.toml"
FAKE_HOME6="$TMP_DIR/test_codex_install"
mkdir -p "$FAKE_HOME6"
mkdir -p "$FAKE_HOME6/.codex"
cat > "$FAKE_HOME6/.codex/config.toml" <<'TOMLEOF'
[mcp_servers]
TOMLEOF
chmod 600 "$FAKE_HOME6/.codex/config.toml"
HOME="$FAKE_HOME6" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/install-coordinator.sh" >/dev/null 2>&1 || true
for tool in serena context7 sequential-thinking; do
  assert "codex $tool configured" grep -qF "[mcp_servers.$tool]" "$FAKE_HOME6/.codex/config.toml"
done
assert "codex serena context flag present" grep -qF -- '--context' "$FAKE_HOME6/.codex/config.toml"
assert "codex serena host context value present" grep -qF -- 'codex' "$FAKE_HOME6/.codex/config.toml"
serena_timeout_val=$(awk '
  $0 == "[mcp_servers.serena]" { in_section = 1; next }
  in_section && /^\[mcp_servers\./ { exit }
  in_section && $0 ~ /^[[:space:]]*startup_timeout_sec[[:space:]]*=/ {
    value = $0
    sub(/^[[:space:]]*startup_timeout_sec[[:space:]]*=[[:space:]]*/, "", value)
    sub(/[[:space:]]*(#.*)?$/, "", value)
    print value
    exit
  }
' "$FAKE_HOME6/.codex/config.toml")
assert "codex serena startup_timeout_sec >= 90" awk -v v="$serena_timeout_val" 'BEGIN { exit !((v + 0) >= 90) }'
assert "codex config exists" test -f "$FAKE_HOME6/.codex/config.toml"

echo "4.6 File permissions preserved (600)"
perms=$(stat -f '%Lp' "$FAKE_HOME5/.claude.json" 2>/dev/null || stat -c '%a' "$FAKE_HOME5/.claude.json" 2>/dev/null)
assert_output "Config file is 600" "600" "$perms"

echo "4.7 Atomic write uses same-dir tempfile (not /tmp)"
leftover=$(find "$FAKE_HOME5" -name '.claude.json.??????' | wc -l | tr -d ' ')
assert_output "No leftover temp files" "0" "$leftover"

echo "4.8 Existing low startup_timeout_sec is upgraded to recommended value"
FAKE_HOME7="$TMP_DIR/test_codex_low_timeout"
mkdir -p "$FAKE_HOME7/.codex"
cat > "$FAKE_HOME7/.codex/config.toml" <<'TOMLEOF'
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "codex", "--open-web-dashboard", "false"]
startup_timeout_sec = 5
TOMLEOF
chmod 600 "$FAKE_HOME7/.codex/config.toml"
HOME="$FAKE_HOME7" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/install-coordinator.sh" --install serena >/dev/null 2>&1 || true
low_timeout_after=$(awk '
  $0 == "[mcp_servers.serena]" { in_section = 1; next }
  in_section && /^\[mcp_servers\./ { exit }
  in_section && $0 ~ /^[[:space:]]*startup_timeout_sec[[:space:]]*=/ {
    value = $0
    sub(/^[[:space:]]*startup_timeout_sec[[:space:]]*=[[:space:]]*/, "", value)
    sub(/[[:space:]]*(#.*)?$/, "", value)
    print value
    exit
  }
' "$FAKE_HOME7/.codex/config.toml")
assert "low startup_timeout_sec is upgraded to >= 90" awk -v v="$low_timeout_after" 'BEGIN { exit !((v + 0) >= 90) }'

echo ""

# ============================================================================
echo "5. verify-tools.sh tests"

VERIFY_SCRIPT="$SCRIPTS_DIR/verify-tools.sh"

echo "5.1 setup_success=true when baseline tools are configured for Claude"
FH91="$TMP_DIR/fh91"
mkdir -p "$FH91"
cat > "$FH91/.claude.json" <<'JSONEOF'
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
verify_output_51=$(HOME="$FH91" MCP_SETUP_HOST=claude bash "$VERIFY_SCRIPT" 2>&1)
assert_contains "Verify output announces baseline check" "正在核对当前宿主的基础 MCP 配置" "$verify_output_51"
assert_contains "Verify output shows marker update" "宿主就绪标记已更新" "$verify_output_51"
schema_91=$(jq -r '.version' "$FH91/.claude/spec-first/host-setup.json")
assert_output "schema version v6" "6" "$schema_91"
host_91=$(jq -r '.host' "$FH91/.claude/spec-first/host-setup.json")
assert_output "claude host field" "claude" "$host_91"
out91=$(jq -r '.setup_success' "$FH91/.claude/spec-first/host-setup.json")
assert_output "setup_success true" "true" "$out91"
serena_cfg_91=$(jq -r '.tools.serena.configured' "$FH91/.claude/spec-first/host-setup.json")
assert_output "serena.configured true" "true" "$serena_cfg_91"
ctx_cfg_91=$(jq -r '.tools.context7.configured' "$FH91/.claude/spec-first/host-setup.json")
assert_output "context7.configured true" "true" "$ctx_cfg_91"
seq_cfg_91=$(jq -r '.tools."sequential-thinking".configured' "$FH91/.claude/spec-first/host-setup.json")
assert_output "sequential-thinking.configured true" "true" "$seq_cfg_91"

echo "5.2 setup_success=false when a baseline tool is missing"
FH92="$TMP_DIR/fh92"
mkdir -p "$FH92"
cat > "$FH92/.claude.json" <<'JSONEOF'
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "ide-assistant", "--open-web-dashboard", "false"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
JSONEOF
HOME="$FH92" MCP_SETUP_HOST=claude bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out92=$(jq -r '.setup_success' "$FH92/.claude/spec-first/host-setup.json")
assert_output "setup_success false" "false" "$out92"

echo "5.3 host-setup schema does not include removed tools"
assert "No gitnexus tool entry" jq -e '.tools.gitnexus | not' "$FH91/.claude/spec-first/host-setup.json"
assert "No abcoder tool entry" jq -e '.tools.abcoder | not' "$FH91/.claude/spec-first/host-setup.json"

echo "5.3.1 host-setup v6 has crg block, playwright, and feishu"
assert "crg block exists" jq -e '.crg' "$FH91/.claude/spec-first/host-setup.json"
crg_cli=$(jq -r '.crg.cli_available' "$FH91/.claude/spec-first/host-setup.json")
assert "crg.cli_available is boolean" test "$crg_cli" = "true" -o "$crg_cli" = "false"
crg_nm=$(jq -r '.crg.native_modules' "$FH91/.claude/spec-first/host-setup.json")
assert "crg.native_modules is valid" test "$crg_nm" = "ok" -o "$crg_nm" = "missing" -o "$crg_nm" = "unchecked"
pw_cfg=$(jq -r '.tools.playwright.configured' "$FH91/.claude/spec-first/host-setup.json")
assert "playwright.configured is boolean" test "$pw_cfg" = "true" -o "$pw_cfg" = "false"
fw_cfg=$(jq -r '.tools.feishu.configured' "$FH91/.claude/spec-first/host-setup.json")
assert_output "feishu.configured false when absent" "false" "$fw_cfg"
fw_whoami=$(jq -r '.tools.feishu.whoami' "$FH91/.claude/spec-first/host-setup.json")
assert_output "feishu.whoami unchecked when absent" "unchecked" "$fw_whoami"

echo "5.3.2 feishu.configured=true when feishu key present (mcp_key_only branch)"
FH95="$TMP_DIR/fh95"
mkdir -p "$FH95"
cat > "$FH95/.claude.json" <<'JSONEOF'
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
    },
    "feishu": {
      "command": "npx",
      "args": ["-y", "@larksuiteoapi/lark-mcp", "mcp", "--language", "zh"]
    }
  }
}
JSONEOF
HOME="$FH95" MCP_SETUP_HOST=claude bash "$VERIFY_SCRIPT" >/dev/null 2>&1
fw2_cfg=$(jq -r '.tools.feishu.configured' "$FH95/.claude/spec-first/host-setup.json")
assert_output "feishu.configured true when key present" "true" "$fw2_cfg"
fw2_whoami=$(jq -r '.tools.feishu.whoami' "$FH95/.claude/spec-first/host-setup.json")
assert_output "feishu.whoami unchecked without app_id in args" "unchecked" "$fw2_whoami"

echo "5.4 setup_success=true when baseline tools are configured for Codex"
FH93="$TMP_DIR/fh93"
mkdir -p "$FH93/.codex"
cat > "$FH93/.codex/config.toml" <<'TOMLEOF'
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "codex", "--open-web-dashboard", "false"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.sequential-thinking]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-sequential-thinking"]
TOMLEOF
HOME="$FH93" MCP_SETUP_HOST=codex bash "$VERIFY_SCRIPT" >/dev/null 2>&1
schema_93=$(jq -r '.version' "$FH93/.codex/spec-first/host-setup.json")
assert_output "codex schema version v6" "6" "$schema_93"
host_93=$(jq -r '.host' "$FH93/.codex/spec-first/host-setup.json")
assert_output "codex host field" "codex" "$host_93"
out93=$(jq -r '.setup_success' "$FH93/.codex/spec-first/host-setup.json")
assert_output "codex setup_success true" "true" "$out93"

echo "5.5 setup_success=false when Serena context is wrong for Codex"
FH94="$TMP_DIR/fh94"
mkdir -p "$FH94/.codex"
cat > "$FH94/.codex/config.toml" <<'TOMLEOF'
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context", "ide-assistant", "--open-web-dashboard", "false"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.sequential-thinking]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-sequential-thinking"]
TOMLEOF
HOME="$FH94" MCP_SETUP_HOST=codex bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out94=$(jq -r '.setup_success' "$FH94/.codex/spec-first/host-setup.json")
assert_output "codex setup_success false on wrong context" "false" "$out94"

echo ""

# ============================================================================
echo "6. SKILL.md validation"

SKILL_MD="$REPO_ROOT/skills/spec-mcp-setup/SKILL.md"
PROMPT_SKILL_MD="$REPO_ROOT/docs/10-prompt/skills/spec-mcp-setup/SKILL.md"

echo "6.1 SKILL.md has YAML frontmatter"
first_line=$(head -1 "$SKILL_MD")
assert "SKILL.md starts with ---" test "$first_line" = "---"

echo "6.2 SKILL.md frontmatter has required fields"
for field in name description argument-hint; do
  assert "SKILL.md has '$field'" grep -q "^${field}:" "$SKILL_MD"
done

echo "6.3 SKILL.md name is spec-mcp-setup"
skill_name=$(grep '^name:' "$SKILL_MD" | head -1 | sed 's/^name: *//')
assert_output "SKILL.md name" "spec-mcp-setup" "$skill_name"

echo "6.4 SKILL.md has Phase 1, 2, 3 sections"
for phase in "Phase 1" "Phase 2" "Phase 3"; do
  assert "SKILL.md has '$phase'" grep -q "$phase" "$SKILL_MD"
done

echo "6.5 SKILL.md omits GitNexus/ABCoder blurbs"
assert_not_contains "SKILL.md no longer mentions GitNexus" "GitNexus" "$(cat "$SKILL_MD")"
assert_not_contains "SKILL.md no longer mentions ABCoder" "ABCoder" "$(cat "$SKILL_MD")"
assert_not_contains "Prompt skill no longer mentions GitNexus" "GitNexus" "$(cat "$PROMPT_SKILL_MD")"
assert_not_contains "Prompt skill no longer mentions ABCoder" "ABCoder" "$(cat "$PROMPT_SKILL_MD")"

echo "6.6 SKILL.md references real spec-mcp-setup asset paths"
skill_body="$(cat "$SKILL_MD")"
assert_not_contains "SKILL.md no longer references skills/mcp-setup/" "skills/mcp-setup/" "$skill_body"
assert_contains "SKILL.md references spec-mcp-setup mcp-tools.json" "skills/spec-mcp-setup/mcp-tools.json" "$skill_body"
assert_contains "SKILL.md references spec-mcp-setup check-deps.sh" "skills/spec-mcp-setup/scripts/check-deps.sh" "$skill_body"
assert_contains "SKILL.md references spec-mcp-setup install-coordinator.sh" "skills/spec-mcp-setup/scripts/install-coordinator.sh" "$skill_body"
assert_contains "SKILL.md references spec-mcp-setup verify-tools.sh" "skills/spec-mcp-setup/scripts/verify-tools.sh" "$skill_body"

echo "6.7 SKILL.md reflects both optional tools"
assert_contains "SKILL.md lists Playwright MCP as optional" "Playwright MCP" "$skill_body"
assert_contains "SKILL.md lists 飞书 MCP as optional" "飞书 MCP" "$skill_body"
assert_contains "SKILL.md scope says 3 required + 2 optional tools" "3 required tools + 2 optional tools" "$skill_body"

echo ""

# ============================================================================
echo "7. Command template validation"

CMD_TEMPLATE="$REPO_ROOT/templates/claude/commands/spec/mcp-setup.md"

echo "7.1 Command template exists"
assert "Command template exists" test -f "$CMD_TEMPLATE"

echo "7.2 Command template has YAML frontmatter"
first_line=$(head -1 "$CMD_TEMPLATE")
assert "Template starts with ---" test "$first_line" = "---"

echo "7.3 Command template references correct skill path"
assert "References workflows/spec-mcp-setup/SKILL.md" grep -q 'workflows/spec-mcp-setup/SKILL.md' "$CMD_TEMPLATE"

echo "7.4 Command template does NOT reference .claude/skills/ (old path)"
assert_not_contains "No .claude/skills/ path" ".claude/skills/spec-mcp-setup" "$(cat "$CMD_TEMPLATE")"

echo "7.5 Windows PowerShell entrypoints exist"
for ps1 in check-deps.ps1 detect-host.ps1 detect-tools.ps1 install-coordinator.ps1 verify-tools.ps1; do
  assert "Has $ps1" test -f "$SCRIPTS_DIR/$ps1"
done

echo ""

# ============================================================================
echo "8. Integration: detect → install → verify"

FAKE_HOME9="$TMP_DIR/test_integration"
mkdir -p "$FAKE_HOME9"
echo '{"mcpServers":{}}' > "$FAKE_HOME9/.claude.json"
chmod 600 "$FAKE_HOME9/.claude.json"

before=$(HOME="$FAKE_HOME9" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
before_missing=$(jq '.missing | length' <<<"$before")
HOME="$FAKE_HOME9" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-coordinator.sh" >/dev/null 2>&1 || true
after=$(HOME="$FAKE_HOME9" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" 2>/dev/null)
after_missing=$(jq '.missing | length' <<<"$after")

assert "Fewer missing after install" test "$after_missing" -lt "$before_missing"
assert "Config still valid JSON" jq -e . "$FAKE_HOME9/.claude.json" >/dev/null
for tool in serena sequential-thinking context7; do
  configured=$(jq -r --arg t "$tool" '.mcpServers[$t].command // empty' "$FAKE_HOME9/.claude.json")
  assert "$tool configured" test -n "$configured"
done
playwright_after=$(jq -r '.mcpServers.playwright // empty' "$FAKE_HOME9/.claude.json")
assert "playwright absent by default in integration flow" test -z "$playwright_after"

echo ""

echo "=== summary ==="
echo "pass: $pass"
echo "fail: $fail"

if [ "$fail" -ne 0 ]; then
  exit 1
fi
