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
assert_eq "Serena project bootstrap does not hard-code languages" "false" "$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.index_command.args | index("--language") != null' "$TOOLS_JSON")"
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

WIN_BIN="$TMP_DIR/windows-bin"
mkdir -p "$WIN_BIN"
ln -s "$(command -v jq)" "$WIN_BIN/jq"
ln -s "$(command -v python3)" "$WIN_BIN/python3"
ln -s "$(command -v git)" "$WIN_BIN/git"
cat > "$WIN_BIN/uname" <<'SH'
#!/bin/bash
echo "MINGW64_NT-10.0"
SH
cat > "$WIN_BIN/node" <<'SH'
#!/bin/bash
echo "v20.0.0"
SH
cat > "$WIN_BIN/npm" <<'SH'
#!/bin/bash
if [ "${1:-}" = "--version" ]; then echo "10.0.0"; fi
SH
cat > "$WIN_BIN/npx" <<'SH'
#!/bin/bash
if [ "${1:-}" = "--version" ]; then echo "10.0.0"; exit 0; fi
if [[ " $* " == *" skills list "* ]]; then echo "[]"; exit 0; fi
exit 0
SH
chmod +x "$WIN_BIN/uname" "$WIN_BIN/node" "$WIN_BIN/npm" "$WIN_BIN/npx"
windows_deps_output="$(PATH="$WIN_BIN:/usr/bin:/bin:/usr/sbin:/sbin" bash "$SCRIPTS_DIR/check-deps.sh")"
assert_eq "check-deps detects Git Bash Windows" "windows" "$(jq -r '.platform' <<<"$windows_deps_output")"
assert_contains "Windows uv suggestion uses PowerShell installer" "install.ps1 | iex" "$(jq -r '.dependencies.uv.install_suggestion' <<<"$windows_deps_output")"

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

PREFLIGHT_HOME="$TMP_DIR/preflight-home"
mkdir -p "$PREFLIGHT_HOME/.agents/skills/agent-browser"
printf 'name: agent-browser\n' > "$PREFLIGHT_HOME/.agents/skills/agent-browser/SKILL.md"
preflight_missing_marker="$(cd "$TMP_DIR" && PATH="$TEST_PATH" HOME="$PREFLIGHT_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health requires agent-browser install marker" "action-required" "$(jq -r '.tools[] | select(.id == "agent-browser") | .result' <<<"$preflight_missing_marker")"

WINDOWS_PREFLIGHT_HOME="$TMP_DIR/windows-preflight-home"
mkdir -p "$WINDOWS_PREFLIGHT_HOME"
windows_preflight="$(cd "$TMP_DIR" && PATH="$WIN_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$WINDOWS_PREFLIGHT_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health Windows gh uses winget" "winget install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements" "$(jq -r '.tools[] | select(.id == "gh") | .install_command' <<<"$windows_preflight")"
assert_eq "check-health Windows ast-grep uses npm" "npm install -g @ast-grep/cli" "$(jq -r '.tools[] | select(.id == "ast-grep") | .install_command' <<<"$windows_preflight")"
assert_eq "check-health Windows output avoids Homebrew" "false" "$(jq -r '[.tools[].install_command, .skills[].install_command] | join("\n") | contains("brew install")' <<<"$windows_preflight")"

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
assert_eq "installer does not write internal scope into Claude config" "false" "$(jq -r '.mcpServers.serena | has("scope")' "$FAKE_HOME/.claude.json")"
assert "Serena ready marker exists" test -f "$FAKE_REPO/.serena/index-ready.json"
if grep -q 'serena project create .*--language typescript' "$COMMAND_LOG"; then
  echo "FAIL: default Serena bootstrap should let Serena infer project languages" >&2
  exit 1
fi

INSTALL_LANG_REPO="$TMP_DIR/install-lang-repo"
INSTALL_LANG_HOME="$TMP_DIR/install-lang-home"
INSTALL_LANG_BIN="$TMP_DIR/install-lang-bin"
INSTALL_LANG_LOG="$TMP_DIR/install-lang-commands.log"
make_repo "$INSTALL_LANG_REPO"
mkdir -p "$INSTALL_LANG_HOME"
touch "$INSTALL_LANG_LOG"
make_fake_bin "$INSTALL_LANG_BIN" "$INSTALL_LANG_LOG"
install_lang_output="$(cd "$INSTALL_LANG_REPO" && PATH="$INSTALL_LANG_BIN:$TEST_PATH" HOME="$INSTALL_LANG_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --only serena --serena-languages kotlin,java)"
assert "install-mcp with Serena languages emits JSON" jq -e . <<<"$install_lang_output"
assert_contains "install-mcp forwards LLM-selected Serena languages" "serena project create . --index --language kotlin --language java" "$(cat "$INSTALL_LANG_LOG")"

assert_contains "setup does not run GitNexus analyze" "gitnexus@latest --help" "$(cat "$COMMAND_LOG")"
if grep -q 'gitnexus@latest analyze' "$COMMAND_LOG"; then
  echo "FAIL: spec-mcp-setup must not run gitnexus analyze" >&2
  exit 1
fi
if grep -q 'code-review-graph build' "$COMMAND_LOG"; then
  echo "FAIL: spec-mcp-setup must not run code-review-graph build" >&2
  exit 1
fi

SERENA_SAFE_REPO="$TMP_DIR/serena-safe-repo"
SERENA_FAIL_BIN="$TMP_DIR/serena-fail-bin"
make_repo "$SERENA_SAFE_REPO"
mkdir -p "$SERENA_SAFE_REPO/.serena" "$SERENA_FAIL_BIN"
printf 'existing-project\n' > "$SERENA_SAFE_REPO/.serena/project.yml"
printf '{"index_status":"ready"}\n' > "$SERENA_SAFE_REPO/.serena/index-ready.json"
cat > "$SERENA_FAIL_BIN/uvx" <<'SH'
#!/bin/bash
exit 42
SH
chmod +x "$SERENA_FAIL_BIN/uvx"
(cd "$SERENA_SAFE_REPO" && PATH="$SERENA_FAIL_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh")
assert_eq "existing Serena project survives idempotent bootstrap" "existing-project" "$(cat "$SERENA_SAFE_REPO/.serena/project.yml")"
assert "existing Serena ready marker survives idempotent bootstrap" test -f "$SERENA_SAFE_REPO/.serena/index-ready.json"

SERENA_RESTORE_REPO="$TMP_DIR/serena-restore-repo"
make_repo "$SERENA_RESTORE_REPO"
mkdir -p "$SERENA_RESTORE_REPO/.serena"
printf 'existing-project\n' > "$SERENA_RESTORE_REPO/.serena/project.yml"
set +e
(cd "$SERENA_RESTORE_REPO" && PATH="$SERENA_FAIL_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" >/dev/null 2>&1)
serena_restore_status=$?
set -e
assert_eq "Serena failed rebuild exits nonzero" "1" "$serena_restore_status"
assert_eq "Serena failed rebuild restores existing project" "existing-project" "$(cat "$SERENA_RESTORE_REPO/.serena/project.yml")"

SERENA_REFRESH_REPO="$TMP_DIR/serena-refresh-repo"
SERENA_REFRESH_BIN="$TMP_DIR/serena-refresh-bin"
SERENA_REFRESH_LOG="$TMP_DIR/serena-refresh-commands.log"
make_repo "$SERENA_REFRESH_REPO"
touch "$SERENA_REFRESH_LOG"
make_fake_bin "$SERENA_REFRESH_BIN" "$SERENA_REFRESH_LOG"
(cd "$SERENA_REFRESH_REPO" && PATH="$SERENA_REFRESH_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --refresh --language kotlin --language java)
assert_contains "Serena refresh accepts LLM-selected languages" "serena project create . --index --language kotlin --language java" "$(cat "$SERENA_REFRESH_LOG")"

SERENA_FALLBACK_REPO="$TMP_DIR/serena-fallback-repo"
SERENA_FALLBACK_BIN="$TMP_DIR/serena-fallback-bin"
SERENA_FALLBACK_LOG="$TMP_DIR/serena-fallback-commands.log"
make_repo "$SERENA_FALLBACK_REPO"
touch "$SERENA_FALLBACK_LOG"
make_fake_bin "$SERENA_FALLBACK_BIN" "$SERENA_FALLBACK_LOG"
cat > "$SERENA_FALLBACK_BIN/uvx" <<SH
#!/bin/bash
echo "uvx \$*" >> "$SERENA_FALLBACK_LOG"
if [[ " \$* " == *" --language java "* && " \$* " != *" --language kotlin "* ]]; then
  mkdir -p .serena
  printf 'created_by: fake-serena-java\n' > .serena/project.yml
  exit 0
fi
exit 42
SH
chmod +x "$SERENA_FALLBACK_BIN/uvx"
(cd "$SERENA_FALLBACK_REPO" && PATH="$SERENA_FALLBACK_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --refresh --language kotlin,java)
assert_contains "Serena refresh first tries the full LLM-selected language set" "serena project create . --index --language kotlin --language java" "$(cat "$SERENA_FALLBACK_LOG")"
assert_contains "Serena refresh falls back to Java when Kotlin LSP fails" "serena project create . --index --language java" "$(cat "$SERENA_FALLBACK_LOG")"
assert_eq "Serena fallback bootstrap writes project" "created_by: fake-serena-java" "$(cat "$SERENA_FALLBACK_REPO/.serena/project.yml")"

SERENA_REUSE_REPO="$TMP_DIR/serena-reuse-repo"
SERENA_REUSE_BIN="$TMP_DIR/serena-reuse-bin"
SERENA_REUSE_LOG="$TMP_DIR/serena-reuse-commands.log"
make_repo "$SERENA_REUSE_REPO"
mkdir -p "$SERENA_REUSE_REPO/.serena"
cat > "$SERENA_REUSE_REPO/.serena/project.yml" <<'YAML'
languages:
- typescript
- vue
YAML
printf '{"index_status":"ready"}\n' > "$SERENA_REUSE_REPO/.serena/index-ready.json"
touch "$SERENA_REUSE_LOG"
make_fake_bin "$SERENA_REUSE_BIN" "$SERENA_REUSE_LOG"
(cd "$SERENA_REUSE_REPO" && PATH="$SERENA_REUSE_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --refresh)
assert_contains "Serena refresh without explicit languages reuses existing config languages" "serena project create . --index --language typescript --language vue" "$(cat "$SERENA_REUSE_LOG")"

SERENA_NO_LANG_REPO="$TMP_DIR/serena-no-lang-repo"
make_repo "$SERENA_NO_LANG_REPO"
set +e
serena_no_lang_output="$(cd "$SERENA_NO_LANG_REPO" && PATH="$SERENA_REFRESH_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --refresh 2>&1)"
serena_no_lang_status=$?
set -e
assert_eq "Serena refresh fails fast without language evidence" "1" "$serena_no_lang_status"
assert_contains "Serena refresh failure asks LLM to pass language" "requires --language" "$serena_no_lang_output"

detect_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh")"
assert "detect-tools emits JSON" jq -e . <<<"$detect_output"
assert_eq "detect-tools schema v2 facts" "tool-facts.v2" "$(jq -r '.schema_version' <<<"$detect_output")"
assert_eq "detect-tools has no baseline_ready" "false" "$(jq -r 'has("baseline_ready")' <<<"$detect_output")"
assert_eq "detect-tools has no top-level crg" "false" "$(jq -r 'has("crg")' <<<"$detect_output")"
assert_eq "graph providers are not query-ready after setup detection" "false,false" "$(jq -r '[.graph_providers[] | .query_ready] | join(",")' <<<"$detect_output")"

verify_text="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "verify reports ledger v2" "readiness ledger v2" "$verify_text"
assert_contains "verify prints grouped final status tables" "Required Harness Runtime status (grouped):" "$verify_text"
assert_contains "verify table includes helper" "agent-browser" "$verify_text"
assert_contains "verify table includes required ast-grep helper" "ast-grep" "$verify_text"
assert_contains "verify table includes required ast-grep skill" "ast-grep-skill" "$verify_text"
assert_contains "verify table includes provider projection" "graph-providers.json" "$verify_text"
assert_contains "verify table includes runtime capabilities" "runtime-capabilities.json" "$verify_text"
assert_contains "verify table includes provider artifacts" "provider-artifacts.json" "$verify_text"
assert_contains "verify prints MCP server table" "| Name | Role | Dependency | Host | Project | Next |" "$verify_text"
assert_contains "verify prints graph provider table" "| Name | Role | Dependency | Host | Query | Next |" "$verify_text"
assert_contains "verify prints helper table" "| Name | Type | Result | Dependency | Install | Skill | Next |" "$verify_text"
assert_contains "verify prints project setup table" "| Artifact | Project | Next |" "$verify_text"
assert_contains "verify prints tool remark" "符号级精确编辑和项目索引" "$verify_text"
assert_contains "verify prints friendly next steps" "下一步:" "$verify_text"
assert_contains "verify prompts graph bootstrap command" "/spec:graph-bootstrap" "$verify_text"
assert_contains "verify prompts continue completion" "继续完成" "$verify_text"
assert_contains "verify prompts host restart first" "建议先重启 Claude Code" "$verify_text"
last_verify_line="$(printf '%s\n' "$verify_text" | sed '/^[[:space:]]*$/d' | tail -n 1)"
assert_contains "verify output ends with downstream restart caveat" "下游 workflow 前仍要重启或新开会话" "$last_verify_line"
LEDGER_PATH="$FAKE_HOME/.claude/spec-first/host-setup.json"
PROVIDER_CONFIG="$FAKE_REPO/.spec-first/config/graph-providers.json"
RUNTIME_CAPABILITIES="$FAKE_REPO/.spec-first/config/runtime-capabilities.json"
PROVIDER_ARTIFACTS="$FAKE_REPO/.spec-first/config/provider-artifacts.json"
assert "ledger exists" test -f "$LEDGER_PATH"
assert "provider config exists" test -f "$PROVIDER_CONFIG"
assert "runtime capabilities exists" test -f "$RUNTIME_CAPABILITIES"
assert "provider artifacts exists" test -f "$PROVIDER_ARTIFACTS"
assert_eq "ledger schema v2" "v2" "$(jq -r '.schema_version' "$LEDGER_PATH")"
assert_eq "ledger baseline includes all helpers and tools" "true" "$(jq -r '.baseline_ready and ([.helper_tools[] | .result == "ready"] | all) and (.tools.gitnexus.host_config_status == "fallback-active") and (.tools["code-review-graph"].host_config_status == "fallback-active")' "$LEDGER_PATH")"
assert_eq "provider projection schema" "graph-providers.v1" "$(jq -r '.schema_version' "$PROVIDER_CONFIG")"
assert_eq "runtime capabilities schema" "runtime-capabilities.v1" "$(jq -r '.schema_version' "$RUNTIME_CAPABILITIES")"
assert_eq "provider artifacts schema" "provider-artifacts.v1" "$(jq -r '.schema_version' "$PROVIDER_ARTIFACTS")"
assert_eq "provider projection is setup-only" "true" "$(jq -r '.boundaries.setup_only and .boundaries.does_not_run_gitnexus_analyze and .boundaries.does_not_run_code_review_graph_build' "$PROVIDER_CONFIG")"
provider_config_repo_root="$(jq -r '.repo_root' "$PROVIDER_CONFIG")"
assert_eq "provider commands are config-defined arrays" "true" "$(jq -r --arg repo_root "$provider_config_repo_root" --arg repo_name "$(basename "$provider_config_repo_root")" '.providers.gitnexus.configured and .providers.gitnexus.enabled_for_bootstrap and (.providers.gitnexus.commands.bootstrap == ["npx","-y","gitnexus@latest","analyze"]) and (.providers.gitnexus.commands.query_probe == ["npx","-y","gitnexus@latest","query","spec-first-readiness-probe","--repo",$repo_name]) and (.providers["code-review-graph"].commands.bootstrap == ["uvx","code-review-graph","build"]) and (.providers["code-review-graph"].commands.query_probe == ["uvx","code-review-graph","status","--repo",$repo_root])' "$PROVIDER_CONFIG")"
assert_eq "providers are configured but not query-ready" "true" "$(jq -r '(.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers.gitnexus.bootstrap_required == true) and (.derived_readiness.providers["code-review-graph"].query_ready == false) and (.derived_readiness.providers["code-review-graph"].bootstrap_required == true)' "$PROVIDER_CONFIG")"
assert_eq "runtime capabilities points to host ledger" "$LEDGER_PATH" "$(jq -r '.host_ledger_pointer.path' "$RUNTIME_CAPABILITIES")"
assert_eq "runtime capabilities starts not bootstrapped" "not-bootstrapped" "$(jq -r '.project_graph_readiness.status' "$RUNTIME_CAPABILITIES")"
assert_eq "provider artifacts use provider projection path" ".spec-first/providers/gitnexus/raw" "$(jq -r '.providers.gitnexus.raw_dir' "$PROVIDER_ARTIFACTS")"

FAKE_CODEX_HOME="$TMP_DIR/codex-home"
FAKE_CODEX_REPO="$TMP_DIR/codex-repo"
FAKE_CODEX_SYSTEM="$TMP_DIR/codex-system"
mkdir -p "$FAKE_CODEX_HOME"
mkdir -p "$FAKE_CODEX_HOME/.agents/skills/agent-browser"
mkdir -p "$FAKE_CODEX_SYSTEM"
printf 'name: agent-browser\n' > "$FAKE_CODEX_HOME/.agents/skills/agent-browser/SKILL.md"
make_repo "$FAKE_CODEX_REPO"
codex_config="$FAKE_CODEX_HOME/.codex/config.toml"
codex_system_config="$FAKE_CODEX_SYSTEM/config.toml"
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
assert_contains "Codex config does not write internal scope" 'startup_timeout_sec = 120' "$(cat "$codex_config")"
if grep -q '^scope =' "$codex_config"; then
  echo "FAIL: Codex config should not contain internal scope" >&2
  exit 1
fi
codex_detect="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "detect-tools reads quoted Codex key" "ready" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect")"
cat > "$codex_system_config" <<'TOML'
[profiles.default]
model = "gpt-5"
TOML
codex_detect_system_profile="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE="$codex_system_config" bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "Codex higher-precedence profile-only config does not block MCP" "ready" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect_system_profile")"
cat > "$codex_system_config" <<'TOML'
[mcp_servers."code-review-graph"]
command = "old"
args = []
TOML
codex_detect_system_conflict="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE="$codex_system_config" bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "Codex higher-precedence same MCP mismatch blocks selected config" "precedence-blocked" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect_system_conflict")"
rm -f "$codex_system_config"
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
assert_eq "graph-bootstrap writes canonical provider readiness" "true" "$(jq -r '(.ready_primary_providers | index("gitnexus") != null) and (.ready_primary_providers | index("code-review-graph") != null) and ([.providers[] | select(.query_ready == true)] | length == 2)' "$FAKE_REPO/.spec-first/graph/provider-status.json")"
verify_after_bootstrap="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "repeat verify shows graph provider query ready" "| gitnexus | 全局代码知识图谱与影响分析 | ready | fallback | ready | n/a |" "$verify_after_bootstrap"
assert_contains "repeat verify reports graph provider query ready summary" "Graph providers are query-ready." "$verify_after_bootstrap"
if [[ "$verify_after_bootstrap" == *"Graph providers are configured but not query-ready yet."* ]]; then
  echo "FAIL: repeat verify should not say query-ready providers are pending" >&2
  exit 1
fi
assert_eq "repeat verify projects provider query_ready from canonical artifacts" "true" "$(jq -r '.derived_readiness.providers.gitnexus.query_ready and .derived_readiness.providers["code-review-graph"].query_ready and (.derived_readiness.providers.gitnexus.bootstrap_required == false) and (.derived_readiness.providers["code-review-graph"].bootstrap_required == false)' "$PROVIDER_CONFIG")"
assert_eq "repeat verify projects runtime graph readiness summary" "primary:false:spec-mcp-setup" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required):\(.updated_by)"' "$RUNTIME_CAPABILITIES")"
assert_eq "repeat verify clears graph bootstrap next action" "false" "$(jq -r '.next_actions | index("run spec-graph-bootstrap") != null' "$LEDGER_PATH")"
assert_eq "repeat verify ledger graph bootstrap no longer required" "false" "$(jq -r '.graph_bootstrap_required' "$LEDGER_PATH")"

GRAPH_FACTS="$FAKE_REPO/.spec-first/graph/graph-facts.json"
PROVIDER_STATUS="$FAKE_REPO/.spec-first/graph/provider-status.json"
graph_facts_backup="$(cat "$GRAPH_FACTS")"
provider_status_backup="$(cat "$PROVIDER_STATUS")"
jq '.workflow_mode = "degraded-fallback" | .confidence = "medium" | .generated_at = "2099-01-01T00:00:00Z"' "$GRAPH_FACTS" > "$GRAPH_FACTS.tmp"
mv "$GRAPH_FACTS.tmp" "$GRAPH_FACTS"
jq '.workflow_mode = "degraded-fallback" | .generated_at = "2099-01-01T00:00:00Z" | .providers = (.providers | map(if .provider == "code-review-graph" then .query_ready = false | .status = "failed" else . end))' "$PROVIDER_STATUS" > "$PROVIDER_STATUS.tmp"
mv "$PROVIDER_STATUS.tmp" "$PROVIDER_STATUS"
verify_after_degraded_canonical="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "degraded canonical artifacts require graph bootstrap" "Graph providers are configured but not query-ready yet." "$verify_after_degraded_canonical"
assert_eq "degraded canonical artifacts replace stale primary runtime summary" "degraded-fallback:true:spec-mcp-setup" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required):\(.updated_by)"' "$RUNTIME_CAPABILITIES")"
printf '%s\n' "$graph_facts_backup" > "$GRAPH_FACTS"
printf '%s\n' "$provider_status_backup" > "$PROVIDER_STATUS"
verify_after_restored_canonical="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "restored canonical artifacts project query ready" "Graph providers are query-ready." "$verify_after_restored_canonical"
assert_eq "restored canonical artifacts replace stale degraded runtime summary" "primary:false:spec-mcp-setup" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required):\(.updated_by)"' "$RUNTIME_CAPABILITIES")"

IMPACT_CAPABILITIES="$FAKE_REPO/.spec-first/impact/bootstrap-impact-capabilities.json"
impact_capabilities_backup="$(cat "$IMPACT_CAPABILITIES")"
jq '.schema_version = "wrong-impact-schema.v1"' "$IMPACT_CAPABILITIES" > "$IMPACT_CAPABILITIES.tmp"
mv "$IMPACT_CAPABILITIES.tmp" "$IMPACT_CAPABILITIES"
verify_after_invalid_impact="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "invalid canonical impact artifact requires graph bootstrap" "Graph providers are configured but not query-ready yet." "$verify_after_invalid_impact"
assert_eq "invalid canonical impact schema resets provider readiness" "true" "$(jq -r '.derived_readiness.graph_bootstrap_required and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers["code-review-graph"].query_ready == false)' "$PROVIDER_CONFIG")"
assert_eq "invalid canonical impact schema resets runtime summary" "not-bootstrapped:true" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required)"' "$RUNTIME_CAPABILITIES")"
printf '%s\n' "$impact_capabilities_backup" > "$IMPACT_CAPABILITIES"
verify_after_restored_impact="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "restored canonical impact artifact projects query ready" "Graph providers are query-ready." "$verify_after_restored_impact"
assert_eq "restored canonical impact artifact restores provider readiness" "true" "$(jq -r '.derived_readiness.providers.gitnexus.query_ready and .derived_readiness.providers["code-review-graph"].query_ready and (.derived_readiness.providers.gitnexus.bootstrap_required == false) and (.derived_readiness.providers["code-review-graph"].bootstrap_required == false)' "$PROVIDER_CONFIG")"

rm -f "$FAKE_REPO/.spec-first/graph/graph-facts.json"
verify_after_missing_canonical="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "missing canonical graph facts requires graph bootstrap" "Graph providers are configured but not query-ready yet." "$verify_after_missing_canonical"
assert_eq "missing canonical artifact resets provider readiness" "true" "$(jq -r '.derived_readiness.graph_bootstrap_required and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers["code-review-graph"].query_ready == false)' "$PROVIDER_CONFIG")"
assert_eq "missing canonical artifact resets runtime summary" "not-bootstrapped:true" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required)"' "$RUNTIME_CAPABILITIES")"

echo "=== spec-mcp-setup required runtime tests passed ==="
