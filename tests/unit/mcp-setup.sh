#!/bin/bash
# spec-mcp-setup required runtime unit tests

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/skills/spec-mcp-setup/scripts"
GRAPH_BOOTSTRAP_SCRIPT="$REPO_ROOT/skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh"
TOOLS_JSON="$REPO_ROOT/skills/spec-mcp-setup/mcp-tools.json"
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
  ln -s "$(command -v python3)" "$bin_dir/python3"

  cat > "$bin_dir/node" <<'SH'
#!/bin/bash
echo "v20.0.0"
SH
  cat > "$bin_dir/npm" <<SH
#!/bin/bash
echo "npm \$*" >> "$log_file"
if [ "\${1:-}" = "--version" ]; then echo "10.0.0"; fi
exit 0
SH
  cat > "$bin_dir/npx" <<SH
#!/bin/bash
echo "npx \$*" >> "$log_file"
if [ "\${1:-}" = "--version" ]; then echo "10.0.0"; fi
if [[ " \$* " == *" --skill agent-browser "* ]]; then
  mkdir -p "\$HOME/.agents/skills/agent-browser"
  printf 'name: agent-browser\n' > "\$HOME/.agents/skills/agent-browser/SKILL.md"
fi
if [[ " \$* " == *" skills add ast-grep/agent-skill "* ]]; then
  mkdir -p "\$HOME/.agents/skills/ast-grep"
  printf 'name: ast-grep\n' > "\$HOME/.agents/skills/ast-grep/SKILL.md"
fi
exit 0
SH
  cat > "$bin_dir/uv" <<'SH'
#!/bin/bash
echo "uv 0.1.0"
SH
  cat > "$bin_dir/uvx" <<SH
#!/bin/bash
echo "uvx \$*" >> "$log_file"
if [ "\${1:-}" = "--version" ]; then echo "uvx 0.1.0"; fi
if [[ " \$* " == *" serena project create "* ]]; then
  mkdir -p .serena
  printf 'created_by: fake-serena\n' > .serena/project.yml
fi
exit 0
SH
  cat > "$bin_dir/agent-browser" <<SH
#!/bin/bash
echo "agent-browser \$*" >> "$log_file"
if [ "\${1:-}" = "--version" ]; then echo "agent-browser 0.0.0"; fi
exit 0
SH
  for helper in gh vhs silicon ffmpeg ast-grep; do
    cat > "$bin_dir/$helper" <<SH
#!/bin/bash
echo "$helper \$*" >> "$log_file"
if [ "\${1:-}" = "--version" ]; then echo "$helper 0.0.0"; fi
exit 0
SH
  done
  chmod +x "$bin_dir/node" "$bin_dir/npm" "$bin_dir/npx" "$bin_dir/uv" "$bin_dir/uvx" "$bin_dir/agent-browser" "$bin_dir/gh" "$bin_dir/vhs" "$bin_dir/silicon" "$bin_dir/ffmpeg" "$bin_dir/ast-grep"
}

make_repo() {
  local repo_dir="$1"
  mkdir -p "$repo_dir"
  git -C "$repo_dir" init -q
}

echo "=== spec-mcp-setup required runtime tests ==="

assert_eq "mcp-tools schema is v4" "4" "$(jq -r '.schema_version' "$TOOLS_JSON")"
assert_eq "tool ids are fixed" "serena,sequential-thinking,context7,gitnexus,code-review-graph" "$(jq -r '[.tools[].id] | join(",")' "$TOOLS_JSON")"
assert_eq "every registry tool is required" "true" "$(jq -r 'all(.tools[]; .required == true)' "$TOOLS_JSON")"
assert_eq "categories are constrained" "true" "$(jq -r 'all(.tools[]; (.category == "mcp" or .category == "graph-provider"))' "$TOOLS_JSON")"
assert_eq "agent-browser is outside MCP registry" "false" "$(jq -r '[.tools[].id] | index("agent-browser") != null' "$TOOLS_JSON")"
assert_eq "browser MCP is not registered" "false" "$(jq -r '[.tools[].id] | any(. == "playwright")' "$TOOLS_JSON")"
assert_eq "graph provider roles are configured" "global_knowledge,impact_context" "$(jq -r '[.tools[] | select(.category == "graph-provider") | .provider_role] | join(",")' "$TOOLS_JSON")"
assert_eq "serena depends on uv and uvx" "uv,uvx" "$(jq -r '.tools[] | select(.id == "serena") | .dependencies | join(",")' "$TOOLS_JSON")"
assert_eq "code-review-graph depends on uv and uvx" "uv,uvx" "$(jq -r '.tools[] | select(.id == "code-review-graph") | .dependencies | join(",")' "$TOOLS_JSON")"
assert_eq "gitnexus warmup command" "npx -y gitnexus@latest --help" "$(jq -r '.tools[] | select(.id == "gitnexus") | [.installation.unix.command] + .installation.unix.args | join(" ")' "$TOOLS_JSON")"
assert_eq "code-review-graph mcp command" "uvx code-review-graph serve --tools get_minimal_context_tool,get_impact_radius_tool,get_review_context_tool,query_graph_tool,detect_changes_tool,list_graph_stats_tool" "$(jq -r '.tools[] | select(.id == "code-review-graph") | [.host_config.codex.command] + .host_config.codex.args | join(" ")' "$TOOLS_JSON")"

FAKE_BIN="$TMP_DIR/bin"
COMMAND_LOG="$TMP_DIR/commands.log"
touch "$COMMAND_LOG"
make_fake_bin "$FAKE_BIN" "$COMMAND_LOG"
TEST_PATH="$FAKE_BIN:$PATH"

deps_output="$(PATH="$TEST_PATH" bash "$SCRIPTS_DIR/check-deps.sh")"
assert "check-deps emits JSON" jq -e . <<<"$deps_output"
assert_eq "check-deps schema v2" "deps.v2" "$(jq -r '.schema_version' <<<"$deps_output")"
assert_eq "required Unix deps are ready" "true" "$(jq -r '[.dependencies | to_entries[] | select(.value.required == true) | .key] | sort | join(",") == "jq,node,npm,npx,python3,uv,uvx"' <<<"$deps_output")"
assert_eq "check-deps required_ready true with fake deps" "true" "$(jq -r '.required_ready' <<<"$deps_output")"

FAKE_HOME="$TMP_DIR/home"
mkdir -p "$FAKE_HOME"

helper_verify_log_before="$(cat "$COMMAND_LOG")"
helper_verify="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
helper_verify_log_after="$(cat "$COMMAND_LOG")"
assert "install-helpers verify-only emits JSON" jq -e . <<<"$helper_verify"
assert_eq "helper shape contains agent-browser" "true" "$(jq -r '.helper_tools | has("agent-browser")' <<<"$helper_verify")"
assert_eq "helper shape contains required jq" "true" "$(jq -r '.helper_tools | has("jq")' <<<"$helper_verify")"
assert_eq "helper shape contains required ast-grep CLI" "true" "$(jq -r '.helper_tools | has("ast-grep")' <<<"$helper_verify")"
assert_eq "helper shape contains required ast-grep skill" "true" "$(jq -r '.helper_tools | has("ast-grep-skill")' <<<"$helper_verify")"
assert_eq "helper verify-only does not run install commands" "$helper_verify_log_before" "$helper_verify_log_after"
assert_eq "helper verify-only requires browser install marker" "action-required" "$(jq -r '.helper_tools."agent-browser".result' <<<"$helper_verify")"
assert_eq "helper verify-only flags missing install marker" "action-required" "$(jq -r '.helper_tools."agent-browser".install_status' <<<"$helper_verify")"
assert_eq "helper verify-only asks for agent-browser install" "run agent-browser install" "$(jq -r '.helper_tools."agent-browser".next_action' <<<"$helper_verify")"
assert_eq "helper verify-only requires ast-grep global skill" "action-required" "$(jq -r '.helper_tools."ast-grep-skill".result' <<<"$helper_verify")"

helper_install="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh")"
assert "install-helpers install emits JSON" jq -e . <<<"$helper_install"
assert_contains "helper install runs agent-browser install" "agent-browser install" "$(cat "$COMMAND_LOG")"
assert_contains "helper install installs global skill" "npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y" "$(cat "$COMMAND_LOG")"
assert_contains "helper install installs ast-grep global skill" "npx skills add ast-grep/agent-skill -g -y" "$(cat "$COMMAND_LOG")"
assert "helper install writes browser install marker" test -f "$FAKE_HOME/.agent-browser/spec-first-install.json"
assert_eq "helper install reports all helpers ready" "true" "$(jq -r '[.helper_tools[] | .result == "ready"] | all' <<<"$helper_install")"

helper_verify_after_install_log_before="$(cat "$COMMAND_LOG")"
helper_verify_after_install="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
helper_verify_after_install_log_after="$(cat "$COMMAND_LOG")"
assert_eq "helper verify-only stays read-only after install" "$helper_verify_after_install_log_before" "$helper_verify_after_install_log_after"
assert_eq "helper verify-only ready after marker and skill" "ready" "$(jq -r '.helper_tools."agent-browser".result' <<<"$helper_verify_after_install")"

NO_BROWSER_BIN="$TMP_DIR/bin-no-browser"
NO_BROWSER_LOG="$TMP_DIR/no-browser-commands.log"
NO_BROWSER_HOME="$TMP_DIR/no-browser-home"
touch "$NO_BROWSER_LOG"
make_fake_bin "$NO_BROWSER_BIN" "$NO_BROWSER_LOG"
rm -f "$NO_BROWSER_BIN/agent-browser"
mkdir -p "$NO_BROWSER_HOME"
no_browser_install="$(PATH="$NO_BROWSER_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$NO_BROWSER_HOME" bash "$SCRIPTS_DIR/install-helpers.sh")"
assert "helper missing CLI install path emits JSON" jq -e . <<<"$no_browser_install"
assert_contains "helper default attempts CLI install when missing" "npm install -g agent-browser --no-audit --no-fund --loglevel=error" "$(cat "$NO_BROWSER_LOG")"
assert_eq "helper reports missing CLI if npm did not expose binary" "missing" "$(jq -r '.helper_tools."agent-browser".dependency_status' <<<"$no_browser_install")"

FAKE_REPO="$TMP_DIR/repo"
make_repo "$FAKE_REPO"
preflight_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert "check-health --json emits JSON" jq -e . <<<"$preflight_output"
assert_eq "check-health schema v2" "spec-mcp-setup-preflight.v2" "$(jq -r '.schema_version' <<<"$preflight_output")"
assert_eq "agent-browser remains required helper in preflight" "true" "$(jq -r '.tools[] | select(.id == "agent-browser") | .required' <<<"$preflight_output")"
assert_eq "project helper CLIs are required" "true" "$(jq -r 'all(.tools[]; .required == true)' <<<"$preflight_output")"
assert_eq "ast-grep skill is required" "true" "$(jq -r '.skills[] | select(.id == "ast-grep") | .required' <<<"$preflight_output")"
assert_eq "project facts are included" "missing" "$(jq -r '.project.local_config_status' <<<"$preflight_output")"

project_bootstrap="$(cd "$FAKE_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --refresh-example --create-local --ensure-gitignore --json)"
assert "bootstrap-project-config emits JSON" jq -e . <<<"$project_bootstrap"
assert_eq "bootstrap schema" "project-config-bootstrap.v1" "$(jq -r '.schema_version' <<<"$project_bootstrap")"
assert_eq "bootstrap refreshes example" "refreshed" "$(jq -r '.project.example_config_status' <<<"$project_bootstrap")"
assert_eq "bootstrap creates local config" "created" "$(jq -r '.project.local_config_status' <<<"$project_bootstrap")"
assert_eq "bootstrap adds gitignore" "added" "$(jq -r '.project.local_config_gitignore_status' <<<"$project_bootstrap")"
test -f "$FAKE_REPO/.spec-first/config.local.example.yaml"
test -f "$FAKE_REPO/.spec-first/config.local.yaml"
grep -qxF '.spec-first/*.local.yaml' "$FAKE_REPO/.gitignore"
printf 'custom-local-config\n' > "$FAKE_REPO/.spec-first/config.local.yaml"
project_bootstrap_again="$(cd "$FAKE_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --create-local --ensure-gitignore --json)"
assert_eq "bootstrap does not overwrite local config" "custom-local-config" "$(cat "$FAKE_REPO/.spec-first/config.local.yaml")"
assert_eq "bootstrap reports existing local config" "already-exists" "$(jq -r '.project.local_config_status' <<<"$project_bootstrap_again")"
assert_eq "gitignore entry is not duplicated" "1" "$(grep -cFx '.spec-first/*.local.yaml' "$FAKE_REPO/.gitignore")"
printf 'legacy\n' > "$FAKE_REPO/compound-engineering.local.md"
legacy_delete="$(cd "$FAKE_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --delete-legacy-markdown --json)"
assert_eq "legacy markdown deletion is explicit" "deleted" "$(jq -r '.legacy.compound_engineering_markdown_status' <<<"$legacy_delete")"
test ! -e "$FAKE_REPO/compound-engineering.local.md"

install_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh")"
assert "install-mcp emits JSON" jq -e . <<<"$install_output"
assert_eq "installer configures all required tools" "serena,sequential-thinking,context7,gitnexus,code-review-graph" "$(jq -r '[.results[].tool_id] | join(",")' <<<"$install_output")"
assert_eq "installer has no skipped optional results" "true" "$(jq -r 'all(.results[]; .status == "ready")' <<<"$install_output")"
assert_eq "installer writes GitNexus config" "npx" "$(jq -r '.mcpServers.gitnexus.command' "$FAKE_HOME/.claude.json")"
assert_eq "installer writes code-review-graph config" "uvx" "$(jq -r '.mcpServers["code-review-graph"].command' "$FAKE_HOME/.claude.json")"
assert "Serena ready marker exists" test -f "$FAKE_REPO/.serena/index-ready.json"
assert_contains "setup does not run GitNexus analyze" "gitnexus@latest --help" "$(cat "$COMMAND_LOG")"
if grep -q 'gitnexus@latest analyze' "$COMMAND_LOG"; then
  echo "FAIL: spec-mcp-setup must not run gitnexus analyze" >&2
  exit 1
fi
if grep -q 'code-review-graph build' "$COMMAND_LOG"; then
  echo "FAIL: spec-mcp-setup must not run code-review-graph build" >&2
  exit 1
fi

detect_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh")"
assert "detect-tools emits JSON" jq -e . <<<"$detect_output"
assert_eq "detect-tools schema v2 facts" "tool-facts.v2" "$(jq -r '.schema_version' <<<"$detect_output")"
assert_eq "detect-tools has no baseline_ready" "false" "$(jq -r 'has("baseline_ready")' <<<"$detect_output")"
assert_eq "detect-tools has no top-level crg" "false" "$(jq -r 'has("crg")' <<<"$detect_output")"
assert_eq "graph providers are not query-ready after setup detection" "false,false" "$(jq -r '[.graph_providers[] | .query_ready] | join(",")' <<<"$detect_output")"

verify_text="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "verify reports ledger v2" "readiness ledger v2" "$verify_text"
assert_contains "verify prints final status table" "Required Harness Runtime status:" "$verify_text"
assert_contains "verify table includes helper" "agent-browser" "$verify_text"
assert_contains "verify table includes required ast-grep helper" "ast-grep" "$verify_text"
assert_contains "verify table includes required ast-grep skill" "ast-grep-skill" "$verify_text"
assert_contains "verify table includes provider projection" "graph-providers.json" "$verify_text"
last_verify_line="$(printf '%s\n' "$verify_text" | sed '/^[[:space:]]*$/d' | tail -n 1)"
assert_contains "verify output ends with final status table" "graph-providers.json" "$last_verify_line"
LEDGER_PATH="$FAKE_HOME/.claude/spec-first/host-setup.json"
PROVIDER_CONFIG="$FAKE_REPO/.spec-first/config/graph-providers.json"
assert "ledger exists" test -f "$LEDGER_PATH"
assert "provider config exists" test -f "$PROVIDER_CONFIG"
assert_eq "ledger schema v2" "v2" "$(jq -r '.schema_version' "$LEDGER_PATH")"
assert_eq "ledger baseline includes all helpers and tools" "true" "$(jq -r '.baseline_ready and ([.helper_tools[] | .result == "ready"] | all) and (.tools.gitnexus.host_config_status == "fallback-active") and (.tools["code-review-graph"].host_config_status == "fallback-active")' "$LEDGER_PATH")"
assert_eq "provider projection schema" "graph-providers.v1" "$(jq -r '.schema_version' "$PROVIDER_CONFIG")"
assert_eq "provider projection is setup-only" "true" "$(jq -r '.boundaries.setup_only and .boundaries.does_not_run_gitnexus_analyze and .boundaries.does_not_run_code_review_graph_build' "$PROVIDER_CONFIG")"
assert_eq "providers are configured but not query-ready" "true" "$(jq -r '.providers.gitnexus.configured and .providers.gitnexus.enabled_for_bootstrap and (.providers.gitnexus.query_ready == false) and .providers["code-review-graph"].configured and .providers["code-review-graph"].enabled_for_bootstrap and (.providers["code-review-graph"].query_ready == false)' "$PROVIDER_CONFIG")"

FAKE_CODEX_HOME="$TMP_DIR/codex-home"
FAKE_CODEX_REPO="$TMP_DIR/codex-repo"
mkdir -p "$FAKE_CODEX_HOME"
mkdir -p "$FAKE_CODEX_HOME/.agents/skills/agent-browser"
printf 'name: agent-browser\n' > "$FAKE_CODEX_HOME/.agents/skills/agent-browser/SKILL.md"
make_repo "$FAKE_CODEX_REPO"
codex_config="$FAKE_CODEX_HOME/.codex/config.toml"
mkdir -p "$(dirname "$codex_config")"
cat > "$codex_config" <<'TOML'
[mcp_servers."code-review-graph"]
command = "old"
args = []

[profiles.default]
model = "gpt-5"
TOML
(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/configure-host.sh" --tool code-review-graph >/dev/null)
assert_contains "Codex config uses quoted table key" '[mcp_servers."code-review-graph"]' "$(cat "$codex_config")"
assert_contains "Codex configure preserves following non-MCP table" '[profiles.default]' "$(cat "$codex_config")"
codex_detect="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "detect-tools reads quoted Codex key" "ready" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect")"
cat > "$codex_config" <<'TOML'
[mcp_servers."code-review-graph"]
command = "uvx"
args = []
# code-review-graph serve --tools get_minimal_context_tool,get_impact_radius_tool,get_review_context_tool,query_graph_tool,detect_changes_tool,list_graph_stats_tool
TOML
codex_detect_bad_args="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "detect-tools requires exact Codex args, not comment substrings" "action-required" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect_bad_args")"
cat > "$codex_config" <<'TOML'
[mcp_servers.code-review-graph]
command = "old"
args = []

[mcp_servers."code-review-graph"]
command = "uvx"
args = ["code-review-graph","serve"]

[profiles.default]
model = "gpt-5"
TOML
(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/uninstall-mcp.sh" --tool code-review-graph >/dev/null)
if grep -q 'mcp_servers.*code-review-graph' "$codex_config"; then
  echo "FAIL: uninstall should remove quoted and unquoted code-review-graph sections" >&2
  exit 1
fi
assert_contains "Codex uninstall preserves following non-MCP table" '[profiles.default]' "$(cat "$codex_config")"

graph_log_before="$(cat "$COMMAND_LOG")"
bootstrap_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$GRAPH_BOOTSTRAP_SCRIPT")"
graph_log_after="$(cat "$COMMAND_LOG")"
assert "graph-bootstrap emits JSON" jq -e . <<<"$bootstrap_output"
assert_eq "graph-bootstrap result ready" "ready" "$(jq -r '.overall_status' <<<"$bootstrap_output")"
assert_contains "graph-bootstrap runs GitNexus analyze" "npx -y gitnexus@latest analyze" "$graph_log_after"
assert_contains "graph-bootstrap runs code-review-graph build" "uvx code-review-graph build" "$graph_log_after"
if [ "$graph_log_before" = "$graph_log_after" ]; then
  echo "FAIL: graph-bootstrap should run provider build commands" >&2
  exit 1
fi
assert_eq "graph-bootstrap flips query_ready" "true" "$(jq -r '.providers.gitnexus.query_ready and .providers["code-review-graph"].query_ready and (.providers.gitnexus.bootstrap_required == false) and (.providers["code-review-graph"].bootstrap_required == false)' "$PROVIDER_CONFIG")"

echo "=== spec-mcp-setup required runtime tests passed ==="
