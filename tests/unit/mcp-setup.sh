#!/bin/bash
# spec-mcp-setup required runtime unit tests

set -euo pipefail

while IFS='=' read -r env_name _; do
  case "$env_name" in
    INIT_CWD|npm_*)
      unset "$env_name" 2>/dev/null || true
      ;;
  esac
done < <(env)

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/skills/spec-mcp-setup/scripts"
RESOLVER_SCRIPT="$SCRIPTS_DIR/resolve-project-target.sh"
GRAPH_BOOTSTRAP_SCRIPT="$REPO_ROOT/skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh"
TOOLS_JSON="$REPO_ROOT/skills/spec-mcp-setup/mcp-tools.json"
GITNEXUS_PACKAGE="$(jq -r '.tools[] | select(.id == "gitnexus") | (.package // "") + "@" + (.version // "")' "$TOOLS_JSON")"
GITNEXUS_QUERY_PROBE="TradeLoginActivity"
GITNEXUS_REPO_LABEL="hr360"
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

assert_not_contains() {
  local message="$1"
  local needle="$2"
  local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "FAIL: $message" >&2
    echo "unexpected: $needle" >&2
    exit 1
  fi
}

renderer_fixture='{"sections":[{"title":"Display width","headers":["Name","Role","Next"],"rows":[["abc","中文宽度",""],["长长长","x","run"]]}]}'
renderer_expected="$(cat <<'EOF'
Display width:
```text
| Name   | Role     | Next |
| ------ | -------- | ---- |
| abc    | 中文宽度 |      |
| 长长长 | x        | run  |
```
EOF
)"
renderer_actual="$(printf '%s' "$renderer_fixture" | node "$SCRIPTS_DIR/render-status-block.cjs")"
assert_eq "renderer aligns mixed CJK and ASCII cell display widths" "$renderer_expected" "$renderer_actual"

make_fake_bin() {
  local bin_dir="$1"
  local log_file="$2"
  local real_node
  real_node="$(command -v node)"
  mkdir -p "$bin_dir"

  ln -s "$(command -v jq)" "$bin_dir/jq"
  ln -s "$(command -v python3)" "$bin_dir/python3"

  cat > "$bin_dir/node" <<SH
#!/bin/bash
if [ "\${1:-}" = "--version" ] || [ "\$#" -eq 0 ]; then
  echo "v20.0.0"
  exit 0
fi
exec "$real_node" "\$@"
SH
cat > "$bin_dir/npm" <<SH
#!/bin/bash
echo "npm \$*" >> "$log_file"
if [ "\${1:-}" = "--version" ]; then echo "10.0.0"; fi
if [ -n "\${SLOW_NPM_INSTALL_SECONDS:-}" ] && [[ " \$* " == *" agent-browser@latest "* ]]; then
  sleep "\$SLOW_NPM_INSTALL_SECONDS"
fi
exit 0
SH
  cat > "$bin_dir/npx" <<SH
#!/bin/bash
echo "npx \$*" >> "$log_file"
if [ "\${DRAIN_NPX_STDIN:-}" = "1" ]; then
  cat >/dev/null
fi
if [ "\${1:-}" = "--version" ]; then echo "10.0.0"; fi
if [ -n "\${SLOW_AGENT_BROWSER_SKILL_SECONDS:-}" ] && [[ " \$* " == *" --skill agent-browser "* ]]; then
  sleep "\$SLOW_AGENT_BROWSER_SKILL_SECONDS"
fi
if [[ " \$* " == *" --skill agent-browser "* ]]; then
  mkdir -p "\$HOME/.agents/skills/agent-browser"
  printf 'name: agent-browser\n' > "\$HOME/.agents/skills/agent-browser/SKILL.md"
fi
if [[ " \$* " == *" add ast-grep/agent-skill "* ]]; then
  mkdir -p "\$HOME/.agents/skills/ast-grep"
  printf 'name: ast-grep\n' > "\$HOME/.agents/skills/ast-grep/SKILL.md"
fi
if [[ " \$* " == *" gitnexus@"*" query "* ]]; then
  printf '{"processes":[{"name":"probe"}],"process_symbols":[{"symbol":"TradeLoginActivity"}],"definitions":[]}\n'
fi
if [ -n "\${SLOW_NPX_SKILL_SECONDS:-}" ] && [[ " \$* " == *" add ast-grep/agent-skill "* ]]; then
  sleep "\$SLOW_NPX_SKILL_SECONDS"
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
if [ -n "\${SLOW_AGENT_BROWSER_INSTALL_SECONDS:-}" ] && [[ " \$* " == *" install "* ]]; then
  sleep "\$SLOW_AGENT_BROWSER_INSTALL_SECONDS"
fi
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
  git -C "$repo_dir" config user.name "Spec First Test"
  git -C "$repo_dir" config user.email "spec-first-test@example.invalid"
  git -C "$repo_dir" config core.hooksPath /dev/null
}

echo "=== spec-mcp-setup required runtime tests ==="

assert "project target resolver is executable" test -x "$RESOLVER_SCRIPT"
TARGET_WORKSPACE="$TMP_DIR/target-workspace"
make_repo "$TARGET_WORKSPACE/project-a"
make_repo "$TARGET_WORKSPACE/project-b"
make_repo "$TMP_DIR/outside"
target_multi="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT")"
assert_eq "resolver detects multi-repo workspace" "workspace-multi-repo" "$(jq -r '.mode' <<<"$target_multi")"
assert_eq "multi-repo workspace requires explicit target" "workspace-target-required:false:2" "$(jq -r '"\(.reason_code):\(.state_write_allowed):\(.candidates | length)"' <<<"$target_multi")"
target_selected="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT" --repo project-a)"
assert_eq "resolver accepts explicit child repo" "git-repo:explicit-repo:true:project-a" "$(jq -r '"\(.mode):\(.selection_source):\(.state_write_allowed):\(.repo_label)"' <<<"$target_selected")"
set +e
target_outside="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT" --repo ../outside 2>/dev/null)"
target_outside_status=$?
set -e
assert_eq "resolver rejects workspace escape" "1" "$target_outside_status"
assert_eq "workspace escape reason is stable" "repo-target-outside-workspace" "$(jq -r '.reason_code' <<<"$target_outside")"
rm -rf "$TARGET_WORKSPACE/project-b"
target_single="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT")"
assert_eq "single child repo is only advisory" "workspace-single-candidate:workspace-target-required:false" "$(jq -r '"\(.mode):\(.reason_code):\(.state_write_allowed)"' <<<"$target_single")"
target_env="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT" --format env)"
assert_contains "env output exposes mode without jq" "mode='workspace-single-candidate'" "$target_env"
assert_contains "env output exposes write gate without jq" "state_write_allowed='false'" "$target_env"

# env_quote adversarial coverage: load the real implementation from resolve-project-target.sh
# and confirm it neutralizes single quotes, command substitution, semicolon injection,
# backticks, and embedded newlines so the eval "$TARGET_ENV" call site in install-mcp.sh
# stays safe even when a repo path or git config value contains apostrophes.
ENV_QUOTE_LIB="$TMP_DIR/env-quote.sh"
sed -n '/^env_quote()/,/^}/p' "$RESOLVER_SCRIPT" > "$ENV_QUOTE_LIB"
assert "env_quote function extracted from resolver" test -s "$ENV_QUOTE_LIB"
# shellcheck source=/dev/null
source "$ENV_QUOTE_LIB"

ENV_QUOTE_SENTINEL="$TMP_DIR/env-quote-injection-marker"
rm -f "$ENV_QUOTE_SENTINEL"

quote_case_simple="hello-world"
eval "actual_simple=$(env_quote "$quote_case_simple")"
assert_eq "env_quote round-trips plain ASCII (fast path)" "$quote_case_simple" "$actual_simple"
SED_GUARD_BIN="$TMP_DIR/sed-guard-bin"
mkdir -p "$SED_GUARD_BIN"
cat > "$SED_GUARD_BIN/sed" <<'EOF'
#!/bin/sh
echo "sed-called" > "$SED_GUARD_MARKER"
exit 99
EOF
chmod +x "$SED_GUARD_BIN/sed"
SED_GUARD_MARKER="$TMP_DIR/env-quote-sed-called"
rm -f "$SED_GUARD_MARKER"
guarded_fast="$(SED_GUARD_MARKER="$SED_GUARD_MARKER" PATH="$SED_GUARD_BIN:$PATH" env_quote "$quote_case_simple")"
eval "actual_guarded_fast=$guarded_fast"
assert_eq "env_quote fast path round-trips without sed" "$quote_case_simple" "$actual_guarded_fast"
assert "env_quote fast path does not fork sed" test ! -e "$SED_GUARD_MARKER"

quote_case_single="hello'world"
eval "actual_single=$(env_quote "$quote_case_single")"
assert_eq "env_quote round-trips single quote (slow path)" "$quote_case_single" "$actual_single"

quote_case_cmdsub='$(touch '"$ENV_QUOTE_SENTINEL"')'
eval "actual_cmdsub=$(env_quote "$quote_case_cmdsub")"
assert_eq "env_quote round-trips command-substitution literal" "$quote_case_cmdsub" "$actual_cmdsub"
assert "env_quote prevents command substitution from executing" test ! -e "$ENV_QUOTE_SENTINEL"

quote_case_semi="value;touch $ENV_QUOTE_SENTINEL"
eval "actual_semi=$(env_quote "$quote_case_semi")"
assert_eq "env_quote round-trips semicolon payload" "$quote_case_semi" "$actual_semi"
assert "env_quote prevents semicolon-chained command from executing" test ! -e "$ENV_QUOTE_SENTINEL"

quote_case_backtick='`touch '"$ENV_QUOTE_SENTINEL"'`'
eval "actual_backtick=$(env_quote "$quote_case_backtick")"
assert_eq "env_quote round-trips backtick payload" "$quote_case_backtick" "$actual_backtick"
assert "env_quote prevents backtick command from executing" test ! -e "$ENV_QUOTE_SENTINEL"

quote_case_mixed='abc$(touch '"$ENV_QUOTE_SENTINEL"')'"'"'def'
eval "actual_mixed=$(env_quote "$quote_case_mixed")"
assert_eq "env_quote round-trips mixed single-quote + cmd-sub payload" "$quote_case_mixed" "$actual_mixed"
assert "env_quote prevents mixed payload from executing" test ! -e "$ENV_QUOTE_SENTINEL"

quote_case_newline=$'line1\nline2'
eval "actual_newline=$(env_quote "$quote_case_newline")"
assert_eq "env_quote round-trips embedded newline" "$quote_case_newline" "$actual_newline"

unset env_quote

# Regression guard: install-mcp.sh must define SCRIPT_DIR exactly once at the top level.
# A previous lint pass introduced a duplicate (one BASH_SOURCE-based, one $0-based) and the
# second assignment silently shadowed the first. Pin the count so a future lint cannot
# reintroduce that drift unnoticed.
install_mcp_script_dir_lines=$(grep -cE '^SCRIPT_DIR=' "$SCRIPTS_DIR/install-mcp.sh")
assert_eq "install-mcp.sh defines SCRIPT_DIR exactly once" "1" "$install_mcp_script_dir_lines"
MONOREPO_FIXTURE="$TMP_DIR/monorepo-fixture"
make_repo "$MONOREPO_FIXTURE"
mkdir -p "$MONOREPO_FIXTURE/packages/a" "$MONOREPO_FIXTURE/packages/b"
target_monorepo="$(cd "$MONOREPO_FIXTURE/packages/a" && bash "$RESOLVER_SCRIPT")"
assert_eq "monorepo packages stay inside one git repo target" "git-repo:cwd-git-root:0" "$(jq -r '"\(.mode):\(.selection_source):\(.candidates | length)"' <<<"$target_monorepo")"

assert_eq "mcp-tools schema is v5" "5" "$(jq -r '.schema_version' "$TOOLS_JSON")"
assert_eq "tool ids are fixed" "serena,sequential-thinking,context7,gitnexus,code-review-graph" "$(jq -r '[.tools[].id] | join(",")' "$TOOLS_JSON")"
assert_eq "every registry tool is required" "true" "$(jq -r 'all(.tools[]; .required == true)' "$TOOLS_JSON")"
assert_eq "categories are constrained" "true" "$(jq -r 'all(.tools[]; (.category == "mcp" or .category == "graph-provider"))' "$TOOLS_JSON")"
assert_eq "agent-browser is outside MCP registry" "false" "$(jq -r '[.tools[].id] | index("agent-browser") != null' "$TOOLS_JSON")"
assert_eq "browser MCP is not registered" "false" "$(jq -r '[.tools[].id] | any(. == "playwright")' "$TOOLS_JSON")"
assert_eq "graph provider roles are configured" "global_knowledge,impact_context" "$(jq -r '[.tools[] | select(.category == "graph-provider") | .provider_role] | join(",")' "$TOOLS_JSON")"
assert_eq "serena depends on uv and uvx" "uv,uvx" "$(jq -r '.tools[] | select(.id == "serena") | .dependencies | join(",")' "$TOOLS_JSON")"
assert_eq "Serena project bootstrap does not hard-code languages" "false" "$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.index_command.args | index("--language") != null' "$TOOLS_JSON")"
assert_eq "code-review-graph depends on uv and uvx" "uv,uvx" "$(jq -r '.tools[] | select(.id == "code-review-graph") | .dependencies | join(",")' "$TOOLS_JSON")"
assert_eq "code-review-graph host MCP is optional" "false:cli_artifact:true" "$(jq -r '.tools[] | select(.id == "code-review-graph") | "\(.host_config_required):\(.provider_config.access_mode):\(.provider_config.optional_live_mcp)"' "$TOOLS_JSON")"
assert_eq "GitNexus package pin is explicit" "gitnexus@1.6.4-rc.85" "$GITNEXUS_PACKAGE"
assert_eq "gitnexus warmup command uses configured package" "npx -y $GITNEXUS_PACKAGE --help" "$(jq -r '.tools[] | select(.id == "gitnexus") as $t | [$t.installation.unix.command] + ($t.installation.unix.args | map(gsub("\\{\\{package\\}\\}"; ($t.package // "")) | gsub("\\{\\{version\\}\\}"; ($t.version // "")))) | join(" ")' "$TOOLS_JSON")"
assert_eq "sequential-thinking uses latest npm package" "npx -y @modelcontextprotocol/server-sequential-thinking@latest" "$(jq -r '.tools[] | select(.id == "sequential-thinking") | [.host_config.codex.command] + .host_config.codex.args | join(" ")' "$TOOLS_JSON")"
assert_eq "context7 uses latest npm package" "npx -y @upstash/context7-mcp@latest" "$(jq -r '.tools[] | select(.id == "context7") | [.host_config.codex.command] + .host_config.codex.args | join(" ")' "$TOOLS_JSON")"
assert_eq "code-review-graph optional mcp command remains available" "uvx --upgrade code-review-graph serve --tools get_minimal_context_tool,get_impact_radius_tool,get_review_context_tool,query_graph_tool,detect_changes_tool,list_graph_stats_tool" "$(jq -r '.tools[] | select(.id == "code-review-graph") | [.host_config.codex.command] + .host_config.codex.args | join(" ")' "$TOOLS_JSON")"

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

MISSING_UV_BIN="$TMP_DIR/missing-uv-bin"
mkdir -p "$MISSING_UV_BIN"
ln -s "$(command -v jq)" "$MISSING_UV_BIN/jq"
ln -s "$(command -v python3)" "$MISSING_UV_BIN/python3"
ln -s "$(command -v git)" "$MISSING_UV_BIN/git"
ln -s "$FAKE_BIN/node" "$MISSING_UV_BIN/node"
ln -s "$FAKE_BIN/npm" "$MISSING_UV_BIN/npm"
ln -s "$FAKE_BIN/npx" "$MISSING_UV_BIN/npx"
missing_uv_deps_output="$(PATH="$MISSING_UV_BIN:/usr/bin:/bin:/usr/sbin:/sbin" bash "$SCRIPTS_DIR/check-deps.sh")"
missing_uv_suggestion="$(jq -r '.dependencies.uv.install_suggestion' <<<"$missing_uv_deps_output")"
assert_contains "Unix uv suggestion downloads installer to local file" 'curl -LsSf https://astral.sh/uv/install.sh -o "$tmp"' "$missing_uv_suggestion"
assert_contains "Unix uv suggestion prints explicit review handoff" "Review it, then run: sh" "$missing_uv_suggestion"
assert_not_contains "Unix uv suggestion avoids interactive pager" 'less "$tmp"' "$missing_uv_suggestion"
assert_not_contains "Unix uv suggestion avoids pipe-to-sh" "install.sh | sh" "$missing_uv_suggestion"

DNF_DEPS_BIN="$TMP_DIR/dnf-deps-bin"
mkdir -p "$DNF_DEPS_BIN"
ln -s "$(command -v jq)" "$DNF_DEPS_BIN/jq"
ln -s "$(command -v python3)" "$DNF_DEPS_BIN/python3"
ln -s "$(command -v head)" "$DNF_DEPS_BIN/head"
ln -s "$(command -v grep)" "$DNF_DEPS_BIN/grep"
cat > "$DNF_DEPS_BIN/uname" <<'SH'
#!/bin/bash
echo "Linux"
SH
cat > "$DNF_DEPS_BIN/dnf" <<'SH'
#!/bin/bash
exit 0
SH
for cmd in node npm npx uv uvx; do
  cat > "$DNF_DEPS_BIN/$cmd" <<'SH'
#!/bin/bash
echo "0.0.0"
SH
done
chmod +x "$DNF_DEPS_BIN/uname" "$DNF_DEPS_BIN/dnf" "$DNF_DEPS_BIN/node" "$DNF_DEPS_BIN/npm" "$DNF_DEPS_BIN/npx" "$DNF_DEPS_BIN/uv" "$DNF_DEPS_BIN/uvx"
dnf_deps_output="$(PATH="$DNF_DEPS_BIN:/bin" bash "$SCRIPTS_DIR/check-deps.sh")"
assert_eq "check-deps uses detected dnf for missing git" "sudo dnf install -y git" "$(jq -r '.dependencies.git.install_suggestion' <<<"$dnf_deps_output")"

MISSING_NODE_DNF_BIN="$TMP_DIR/missing-node-dnf-bin"
mkdir -p "$MISSING_NODE_DNF_BIN"
ln -s "$(command -v jq)" "$MISSING_NODE_DNF_BIN/jq"
ln -s "$(command -v python3)" "$MISSING_NODE_DNF_BIN/python3"
ln -s "$(command -v git)" "$MISSING_NODE_DNF_BIN/git"
ln -s "$(command -v head)" "$MISSING_NODE_DNF_BIN/head"
ln -s "$(command -v grep)" "$MISSING_NODE_DNF_BIN/grep"
cat > "$MISSING_NODE_DNF_BIN/uname" <<'SH'
#!/bin/bash
echo "Linux"
SH
cat > "$MISSING_NODE_DNF_BIN/dnf" <<'SH'
#!/bin/bash
exit 0
SH
for cmd in uv uvx; do
  cat > "$MISSING_NODE_DNF_BIN/$cmd" <<'SH'
#!/bin/bash
echo "0.0.0"
SH
done
chmod +x "$MISSING_NODE_DNF_BIN/uname" "$MISSING_NODE_DNF_BIN/dnf" "$MISSING_NODE_DNF_BIN/uv" "$MISSING_NODE_DNF_BIN/uvx"
missing_node_dnf_output="$(PATH="$MISSING_NODE_DNF_BIN:/bin" bash "$SCRIPTS_DIR/check-deps.sh")"
assert_eq "check-deps uses detected dnf for missing node" "sudo dnf install -y nodejs" "$(jq -r '.dependencies.node.install_suggestion' <<<"$missing_node_dnf_output")"
assert_eq "check-deps uses detected dnf for missing npm" "sudo dnf install -y npm" "$(jq -r '.dependencies.npm.install_suggestion' <<<"$missing_node_dnf_output")"
assert_eq "check-deps uses detected dnf for missing npx" "sudo dnf install -y npm" "$(jq -r '.dependencies.npx.install_suggestion' <<<"$missing_node_dnf_output")"
assert_not_contains "Linux node suggestion avoids fnm when package manager exists" "fnm.vercel.app/install" "$(jq -r '.dependencies.node.install_suggestion' <<<"$missing_node_dnf_output")"

MISSING_NODE_NO_MANAGER_BIN="$TMP_DIR/missing-node-no-manager-bin"
mkdir -p "$MISSING_NODE_NO_MANAGER_BIN"
ln -s "$(command -v jq)" "$MISSING_NODE_NO_MANAGER_BIN/jq"
ln -s "$(command -v python3)" "$MISSING_NODE_NO_MANAGER_BIN/python3"
ln -s "$(command -v git)" "$MISSING_NODE_NO_MANAGER_BIN/git"
ln -s "$(command -v head)" "$MISSING_NODE_NO_MANAGER_BIN/head"
ln -s "$(command -v grep)" "$MISSING_NODE_NO_MANAGER_BIN/grep"
cat > "$MISSING_NODE_NO_MANAGER_BIN/uname" <<'SH'
#!/bin/bash
echo "Linux"
SH
for cmd in uv uvx; do
  cat > "$MISSING_NODE_NO_MANAGER_BIN/$cmd" <<'SH'
#!/bin/bash
echo "0.0.0"
SH
done
chmod +x "$MISSING_NODE_NO_MANAGER_BIN/uname" "$MISSING_NODE_NO_MANAGER_BIN/uv" "$MISSING_NODE_NO_MANAGER_BIN/uvx"
missing_node_no_manager_output="$(PATH="$MISSING_NODE_NO_MANAGER_BIN:/bin" bash "$SCRIPTS_DIR/check-deps.sh")"
assert_contains "Linux node fallback downloads fnm installer for review when package manager is absent" "fnm.vercel.app/install" "$(jq -r '.dependencies.node.install_suggestion' <<<"$missing_node_no_manager_output")"
assert_contains "Linux node fallback prints review handoff" "Review it, then run: bash" "$(jq -r '.dependencies.node.install_suggestion' <<<"$missing_node_no_manager_output")"
assert_not_contains "Linux node fallback avoids pipe-to-shell" "install | bash" "$(jq -r '.dependencies.node.install_suggestion' <<<"$missing_node_no_manager_output")"

PACMAN_DEPS_BIN="$TMP_DIR/pacman-deps-bin"
mkdir -p "$PACMAN_DEPS_BIN"
ln -s "$(command -v jq)" "$PACMAN_DEPS_BIN/jq"
ln -s "$(command -v python3)" "$PACMAN_DEPS_BIN/python3"
ln -s "$(command -v git)" "$PACMAN_DEPS_BIN/git"
ln -s "$(command -v dirname)" "$PACMAN_DEPS_BIN/dirname"
ln -s "$(command -v head)" "$PACMAN_DEPS_BIN/head"
ln -s "$(command -v grep)" "$PACMAN_DEPS_BIN/grep"
cat > "$PACMAN_DEPS_BIN/uname" <<'SH'
#!/bin/bash
echo "Linux"
SH
cat > "$PACMAN_DEPS_BIN/pacman" <<'SH'
#!/bin/bash
exit 0
SH
for cmd in uv uvx; do
  cat > "$PACMAN_DEPS_BIN/$cmd" <<'SH'
#!/bin/bash
echo "0.0.0"
SH
done
chmod +x "$PACMAN_DEPS_BIN/uname" "$PACMAN_DEPS_BIN/pacman" "$PACMAN_DEPS_BIN/uv" "$PACMAN_DEPS_BIN/uvx"
pacman_deps_output="$(PATH="$PACMAN_DEPS_BIN:/bin" bash "$SCRIPTS_DIR/check-deps.sh")"
assert_eq "check-deps pacman suggestion avoids partial upgrade" "sudo pacman -Syu --needed nodejs" "$(jq -r '.dependencies.node.install_suggestion' <<<"$pacman_deps_output")"
assert_not_contains "check-deps pacman suggestion does not use -Sy" "pacman -Sy --noconfirm" "$(jq -r '.dependencies.node.install_suggestion' <<<"$pacman_deps_output")"
pacman_preflight_output="$(PATH="$PACMAN_DEPS_BIN:/bin" HOME="$TMP_DIR/pacman-home" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health pacman suggestion avoids partial upgrade" "sudo pacman -Syu --needed github-cli" "$(jq -r '.tools[] | select(.id == "gh") | .install_command' <<<"$pacman_preflight_output")"
assert_not_contains "check-health pacman suggestion does not use -Sy" "pacman -Sy --noconfirm" "$(jq -r '[.tools[].install_command, .skills[].install_command] | join("\n")' <<<"$pacman_preflight_output")"
pacman_helper_output="$(PATH="$PACMAN_DEPS_BIN:/bin" HOME="$TMP_DIR/pacman-helper-home" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
assert_eq "install-helpers pacman suggestion avoids partial upgrade" "sudo pacman -Syu --needed github-cli" "$(jq -r '.helper_tools.gh.next_action' <<<"$pacman_helper_output")"
assert_not_contains "install-helpers pacman suggestion does not use -Sy" "pacman -Sy --noconfirm" "$(jq -r '[.helper_tools[].next_action] | join("\n")' <<<"$pacman_helper_output")"

NO_JQ_DNF_BIN="$TMP_DIR/no-jq-dnf-bin"
mkdir -p "$NO_JQ_DNF_BIN"
ln -s "$(command -v grep)" "$NO_JQ_DNF_BIN/grep"
cat > "$NO_JQ_DNF_BIN/uname" <<'SH'
#!/bin/bash
echo "Linux"
SH
cat > "$NO_JQ_DNF_BIN/dnf" <<'SH'
#!/bin/bash
exit 0
SH
chmod +x "$NO_JQ_DNF_BIN/uname" "$NO_JQ_DNF_BIN/dnf"
set +e
no_jq_dnf_error="$(PATH="$NO_JQ_DNF_BIN:/bin" bash "$SCRIPTS_DIR/check-deps.sh" 2>&1 >/dev/null)"
no_jq_dnf_status=$?
set -e
assert_eq "check-deps exits when jq is missing" "1" "$no_jq_dnf_status"
assert_contains "check-deps jq bootstrap suggestion uses detected dnf" "sudo dnf install -y jq" "$no_jq_dnf_error"

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
assert_contains "Windows uv suggestion downloads PowerShell installer for review" "Invoke-WebRequest -Uri https://astral.sh/uv/install.ps1 -OutFile" "$(jq -r '.dependencies.uv.install_suggestion' <<<"$windows_deps_output")"
assert_contains "Windows uv suggestion prints review handoff" "Review it, then run: powershell -NoProfile -ExecutionPolicy ByPass -File" "$(jq -r '.dependencies.uv.install_suggestion' <<<"$windows_deps_output")"
assert_not_contains "Windows uv suggestion avoids pipe-to-iex" "install.ps1 | iex" "$(jq -r '.dependencies.uv.install_suggestion' <<<"$windows_deps_output")"
assert_not_contains "Windows uv suggestion avoids GUI editor dependency" "notepad" "$(jq -r '.dependencies.uv.install_suggestion' <<<"$windows_deps_output")"

FAKE_HOME="$TMP_DIR/home"
mkdir -p "$FAKE_HOME"
mkdir -p "$FAKE_HOME/.agents/skills/agent-browser"
printf 'name: agent-browser\n' > "$FAKE_HOME/.agents/skills/agent-browser/SKILL.md"

helper_verify_log_before="$(cat "$COMMAND_LOG")"
helper_verify="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
helper_verify_log_after="$(cat "$COMMAND_LOG")"
rm -rf "$FAKE_HOME/.agents/skills/agent-browser"
assert "install-helpers verify-only emits JSON" jq -e . <<<"$helper_verify"
assert_eq "helper shape contains agent-browser" "true" "$(jq -r '.helper_tools | has("agent-browser")' <<<"$helper_verify")"
assert_eq "helper shape contains required jq" "true" "$(jq -r '.helper_tools | has("jq")' <<<"$helper_verify")"
assert_eq "helper shape contains required ast-grep CLI" "true" "$(jq -r '.helper_tools | has("ast-grep")' <<<"$helper_verify")"
assert_eq "helper shape contains required ast-grep skill" "true" "$(jq -r '.helper_tools | has("ast-grep-skill")' <<<"$helper_verify")"
assert_eq "helper verify-only does not run install commands" "$helper_verify_log_before" "$helper_verify_log_after"
assert_eq "helper verify-only requires browser install marker" "action-required" "$(jq -r '.helper_tools."agent-browser".result' <<<"$helper_verify")"
assert_eq "helper verify-only flags missing install marker" "action-required" "$(jq -r '.helper_tools."agent-browser".install_status' <<<"$helper_verify")"
assert_eq "helper verify-only asks for agent-browser install" "run agent-browser install or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable" "$(jq -r '.helper_tools."agent-browser".next_action' <<<"$helper_verify")"
assert_eq "helper verify-only requires ast-grep global skill" "action-required" "$(jq -r '.helper_tools."ast-grep-skill".result' <<<"$helper_verify")"

WINDOWS_HELPER_BIN="$TMP_DIR/windows-helper-bin"
WINDOWS_HELPER_LOG="$TMP_DIR/windows-helper-commands.log"
WINDOWS_HELPER_HOME="$TMP_DIR/windows-helper-home"
touch "$WINDOWS_HELPER_LOG"
make_fake_bin "$WINDOWS_HELPER_BIN" "$WINDOWS_HELPER_LOG"
cat > "$WINDOWS_HELPER_BIN/uname" <<'SH'
#!/bin/bash
echo "MINGW64_NT-10.0"
SH
chmod +x "$WINDOWS_HELPER_BIN/uname"
mkdir -p "$WINDOWS_HELPER_HOME/.agents/skills/agent-browser" "$WINDOWS_HELPER_HOME/.agents/skills/ast-grep"
printf 'name: agent-browser\n' > "$WINDOWS_HELPER_HOME/.agents/skills/agent-browser/SKILL.md"
printf 'name: ast-grep\n' > "$WINDOWS_HELPER_HOME/.agents/skills/ast-grep/SKILL.md"
windows_helper_verify="$(PATH="$WINDOWS_HELPER_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$WINDOWS_HELPER_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
assert "Windows helper verify-only emits JSON" jq -e . <<<"$windows_helper_verify"
assert_eq "Windows agent-browser missing runtime is degraded" "degraded" "$(jq -r '.helper_tools."agent-browser".result' <<<"$windows_helper_verify")"
assert_eq "Windows agent-browser degraded runtime is non-blocking" "false" "$(jq -r '.helper_tools."agent-browser".baseline_blocking' <<<"$windows_helper_verify")"
assert_contains "Windows agent-browser degraded runtime suggests executable override" "AGENT_BROWSER_EXECUTABLE_PATH" "$(jq -r '.helper_tools."agent-browser".next_action' <<<"$windows_helper_verify")"
assert_eq "Windows agent-browser CLI remains required" "ready" "$(jq -r '.helper_tools."agent-browser".dependency_status' <<<"$windows_helper_verify")"

helper_install_err="$TMP_DIR/helper-install.err"
helper_install="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" 2>"$helper_install_err")"
assert "install-helpers install emits JSON" jq -e . <<<"$helper_install"
assert_contains "helper install runs agent-browser install" "agent-browser install" "$(cat "$COMMAND_LOG")"
assert_contains "helper install installs global skill with latest skills CLI" "npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y" "$(cat "$COMMAND_LOG")"
assert_contains "helper install installs ast-grep global skill with latest skills CLI" "npx -y skills@latest add ast-grep/agent-skill -g -y" "$(cat "$COMMAND_LOG")"
assert "helper install writes browser install marker" test -f "$FAKE_HOME/.agent-browser/spec-first-install.json"
assert_eq "helper install reports all helpers ready" "true" "$(jq -r '[.helper_tools[] | .result == "ready"] | all' <<<"$helper_install")"

helper_verify_after_install_log_before="$(cat "$COMMAND_LOG")"
helper_verify_after_install="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
helper_verify_after_install_log_after="$(cat "$COMMAND_LOG")"
assert_eq "helper verify-only stays read-only after install" "$helper_verify_after_install_log_before" "$helper_verify_after_install_log_after"
assert_eq "helper verify-only ready after marker and skill" "ready" "$(jq -r '.helper_tools."agent-browser".result' <<<"$helper_verify_after_install")"

CONCURRENT_BIN="$TMP_DIR/concurrent-bin"
CONCURRENT_HOME="$TMP_DIR/concurrent-home"
CONCURRENT_LOG="$TMP_DIR/concurrent-commands.log"
touch "$CONCURRENT_LOG"
make_fake_bin "$CONCURRENT_BIN" "$CONCURRENT_LOG"
mkdir -p "$CONCURRENT_HOME/.agents/skills/ast-grep"
printf 'name: ast-grep\n' > "$CONCURRENT_HOME/.agents/skills/ast-grep/SKILL.md"
concurrent_start_ms="$(python3 -c 'import time; print(int(time.time() * 1000))')"
concurrent_output="$(PATH="$CONCURRENT_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$CONCURRENT_HOME" SLOW_AGENT_BROWSER_INSTALL_SECONDS=2 SLOW_AGENT_BROWSER_SKILL_SECONDS=2 SPEC_FIRST_STAGE_TIMEOUT_SECONDS=10 bash "$SCRIPTS_DIR/install-helpers.sh")"
concurrent_end_ms="$(python3 -c 'import time; print(int(time.time() * 1000))')"
concurrent_duration_ms="$((concurrent_end_ms - concurrent_start_ms))"
assert "helper install concurrent run emits JSON" jq -e . <<<"$concurrent_output"
assert "helper install concurrent run writes browser marker" test -f "$CONCURRENT_HOME/.agent-browser/spec-first-install.json"
assert_contains "helper install concurrent run starts browser install" "agent-browser install" "$(cat "$CONCURRENT_LOG")"
assert_contains "helper install concurrent run starts browser skill install" "npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y" "$(cat "$CONCURRENT_LOG")"
concurrent_fast_enough="$(python3 -c 'import sys; print(str(int(sys.argv[1]) < 3500).lower())' "$concurrent_duration_ms")"
assert_eq "helper install concurrent run remains below serial baseline" "true" "$concurrent_fast_enough"
assert_eq "helper install concurrent run keeps agent-browser ready" "ready" "$(jq -r '.helper_tools."agent-browser".result' <<<"$concurrent_output")"

NO_BROWSER_BIN="$TMP_DIR/bin-no-browser"
NO_BROWSER_LOG="$TMP_DIR/no-browser-commands.log"
NO_BROWSER_HOME="$TMP_DIR/no-browser-home"
touch "$NO_BROWSER_LOG"
make_fake_bin "$NO_BROWSER_BIN" "$NO_BROWSER_LOG"
rm -f "$NO_BROWSER_BIN/agent-browser"
mkdir -p "$NO_BROWSER_HOME"
NO_BROWSER_STDERR="$TMP_DIR/no-browser-stderr.log"
no_browser_install="$(PATH="$NO_BROWSER_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$NO_BROWSER_HOME" SLOW_NPM_INSTALL_SECONDS=2 SPEC_FIRST_STAGE_TIMEOUT_SECONDS=1 bash "$SCRIPTS_DIR/install-helpers.sh" 2>"$NO_BROWSER_STDERR")"
assert "helper missing CLI install path emits JSON" jq -e . <<<"$no_browser_install"
assert_contains "helper default attempts latest CLI install when missing" "npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error" "$(cat "$NO_BROWSER_LOG")"
assert_contains "helper default records timeout on slow npm" "timed out after 1s" "$(cat "$NO_BROWSER_STDERR")"
assert_eq "helper reports missing CLI if npm did not expose binary" "missing" "$(jq -r '.helper_tools."agent-browser".dependency_status' <<<"$no_browser_install")"

SLOW_SKILL_HOME="$TMP_DIR/slow-skill-home"
mkdir -p "$SLOW_SKILL_HOME"
slow_skill_stderr="$TMP_DIR/slow-skill-stderr.log"
slow_skill_install="$(PATH="$TEST_PATH" HOME="$SLOW_SKILL_HOME" SLOW_NPX_SKILL_SECONDS=2 SPEC_FIRST_STAGE_TIMEOUT_SECONDS=1 bash "$SCRIPTS_DIR/install-helpers.sh" --install 2>"$slow_skill_stderr")"
assert "helper install with slow skill emits JSON" jq -e . <<<"$slow_skill_install"
assert_contains "helper install times out slow ast-grep skill" "timed out after 1s" "$(cat "$slow_skill_stderr")"
assert_eq "helper install marks ast-grep-skill action-required on timeout" "action-required" "$(jq -r '.helper_tools."ast-grep-skill".result' <<<"$slow_skill_install")"

# --- Mirror fallback: official npm registry fails, mirror succeeds.
MIRROR_BIN="$TMP_DIR/mirror-bin"
MIRROR_LOG="$TMP_DIR/mirror-commands.log"
MIRROR_HOME="$TMP_DIR/mirror-home"
touch "$MIRROR_LOG"
make_fake_bin "$MIRROR_BIN" "$MIRROR_LOG"
rm -f "$MIRROR_BIN/agent-browser"
cat > "$MIRROR_BIN/npm" <<SH
#!/bin/bash
echo "npm \$* registry=\${npm_config_registry:-}\${NPM_CONFIG_REGISTRY:-}" >> "$MIRROR_LOG"
if [ "\${1:-}" = "--version" ]; then echo "10.0.0"; exit 0; fi
case " \$* " in
  *" install -g "*)
    if [ -n "\${npm_config_registry:-}\${NPM_CONFIG_REGISTRY:-}" ]; then
      mkdir -p "\$HOME/.npm-global/bin"
      cat > "\$HOME/.npm-global/bin/agent-browser" <<'INNER'
#!/bin/bash
exit 0
INNER
      chmod +x "\$HOME/.npm-global/bin/agent-browser"
      exit 0
    fi
    exit 1
    ;;
esac
exit 0
SH
chmod +x "$MIRROR_BIN/npm"
mkdir -p "$MIRROR_HOME/.agents/skills/ast-grep" "$MIRROR_HOME/.npm-global/bin"
printf 'name: ast-grep\n' > "$MIRROR_HOME/.agents/skills/ast-grep/SKILL.md"
mirror_install="$(PATH="$MIRROR_HOME/.npm-global/bin:$MIRROR_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$MIRROR_HOME" SPEC_FIRST_STAGE_TIMEOUT_SECONDS=15 bash "$SCRIPTS_DIR/install-helpers.sh" --install 2>/dev/null)"
assert "mirror fallback install emits JSON" jq -e . <<<"$mirror_install"
assert_eq "mirror fallback marks agent-browser source mirror" "mirror" "$(jq -r '.helper_tools."agent-browser".install_source' <<<"$mirror_install")"
assert_eq "mirror fallback flags mirror_used true" "true" "$(jq -r '.helper_tools."agent-browser".mirror_used' <<<"$mirror_install")"
assert_eq "ledger advertises npm mirror endpoint" "https://registry.npmmirror.com" "$(jq -r '.mirror_endpoints.npm' <<<"$mirror_install")"
assert_eq "ledger advertises uv mirror endpoint" "https://mirrors.tuna.tsinghua.edu.cn/pypi/simple" "$(jq -r '.mirror_endpoints.uv' <<<"$mirror_install")"
assert_contains "mirror fallback retries with mirror registry" "registry=https://registry.npmmirror.com" "$(cat "$MIRROR_LOG")"

PREFLIGHT_HOME="$TMP_DIR/preflight-home"
mkdir -p "$PREFLIGHT_HOME/.agents/skills/agent-browser"
printf 'name: agent-browser\n' > "$PREFLIGHT_HOME/.agents/skills/agent-browser/SKILL.md"
preflight_missing_marker="$(cd "$TMP_DIR" && PATH="$TEST_PATH" HOME="$PREFLIGHT_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health requires agent-browser install marker" "action-required" "$(jq -r '.tools[] | select(.id == "agent-browser") | .result' <<<"$preflight_missing_marker")"

PREFLIGHT_CODEX_SKILL_HOME="$TMP_DIR/preflight-codex-skill-home"
mkdir -p "$PREFLIGHT_CODEX_SKILL_HOME/.codex/skills/ast-grep"
printf 'name: ast-grep\n' > "$PREFLIGHT_CODEX_SKILL_HOME/.codex/skills/ast-grep/SKILL.md"
preflight_codex_skill="$(cd "$TMP_DIR" && PATH="$TEST_PATH" HOME="$PREFLIGHT_CODEX_SKILL_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health detects Codex global skill fallback even when skills CLI omits it" "ready" "$(jq -r '.skills[] | select(.id == "ast-grep") | .result' <<<"$preflight_codex_skill")"

WINDOWS_PREFLIGHT_HOME="$TMP_DIR/windows-preflight-home"
mkdir -p "$WINDOWS_PREFLIGHT_HOME"
windows_preflight="$(cd "$TMP_DIR" && PATH="$WIN_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$WINDOWS_PREFLIGHT_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health Windows gh upgrades or installs with winget" "if winget upgrade --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements; then true; else winget install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements; fi" "$(jq -r '.tools[] | select(.id == "gh") | .install_command' <<<"$windows_preflight")"
assert_eq "check-health Windows ast-grep uses latest npm package" "npm install -g @ast-grep/cli@latest" "$(jq -r '.tools[] | select(.id == "ast-grep") | .install_command' <<<"$windows_preflight")"
assert_eq "check-health Windows output avoids Homebrew" "false" "$(jq -r '[.tools[].install_command, .skills[].install_command] | join("\n") | contains("brew install")' <<<"$windows_preflight")"

FAKE_REPO="$TMP_DIR/repo"
make_repo "$FAKE_REPO"
mkdir -p "$FAKE_REPO/.gitnexus"
printf '{"remoteUrl":"https://gitee.com/sunnyrain/%s.git"}\n' "$GITNEXUS_REPO_LABEL" > "$FAKE_REPO/.gitnexus/meta.json"
mkdir -p "$FAKE_REPO/trade/src/main/java/com/hstong/trade/tradelogin/login/ui"
printf 'class TradeLoginActivity {}\n' > "$FAKE_REPO/trade/src/main/java/com/hstong/trade/tradelogin/login/ui/TradeLoginActivity.java"
git -C "$FAKE_REPO" add trade/src/main/java/com/hstong/trade/tradelogin/login/ui/TradeLoginActivity.java
git -C "$FAKE_REPO" config user.name "Spec First Test"
git -C "$FAKE_REPO" config user.email "spec-first-test@example.invalid"
git -C "$FAKE_REPO" commit -q -m "Add fixture source"
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

INIT_GITIGNORE_REPO="$TMP_DIR/init-gitignore-repo"
make_repo "$INIT_GITIGNORE_REPO"
node - "$REPO_ROOT" > "$INIT_GITIGNORE_REPO/.gitignore" <<'NODE'
const repoRoot = process.argv[2];
const { buildSpecFirstGitignoreBlock } = require(`${repoRoot}/src/cli/gitignore-policy`);
console.log(buildSpecFirstGitignoreBlock());
NODE
init_block_bootstrap="$(cd "$INIT_GITIGNORE_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --create-local --ensure-gitignore --json)"
assert_eq "init managed block already ignores local config" "already-ignored" "$(jq -r '.project.local_config_gitignore_status' <<<"$init_block_bootstrap")"
assert_eq "mcp setup does not duplicate init gitignore local config rule" "1" "$(grep -cFx '.spec-first/*.local.yaml' "$INIT_GITIGNORE_REPO/.gitignore")"

printf 'legacy\n' > "$FAKE_REPO/compound-engineering.local.md"
legacy_delete="$(cd "$FAKE_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --delete-legacy-markdown --json)"
assert_eq "legacy markdown deletion is explicit" "deleted" "$(jq -r '.legacy.compound_engineering_markdown_status' <<<"$legacy_delete")"
test ! -e "$FAKE_REPO/compound-engineering.local.md"

PROJECT_CONFIG_WORKSPACE="$TMP_DIR/project-config-workspace"
make_repo "$PROJECT_CONFIG_WORKSPACE/project-a"
make_repo "$PROJECT_CONFIG_WORKSPACE/project-b"
project_config_default_output="$(cd "$PROJECT_CONFIG_WORKSPACE" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --refresh-example --create-local --ensure-gitignore --json)"
assert "bootstrap-project-config parent default emits JSON" jq -e . <<<"$project_config_default_output"
assert_eq "bootstrap-project-config parent default schema" "workspace-project-config-bootstrap-summary.v1" "$(jq -r '.schema_version' <<<"$project_config_default_output")"
assert_eq "bootstrap-project-config parent default selection source" "workspace-default-all-repos" "$(jq -r '.selection_source' <<<"$project_config_default_output")"
assert_eq "bootstrap-project-config parent default writes all children" "ready:2:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$project_config_default_output")"
assert "bootstrap-project-config parent default writes advisory summary" test -f "$PROJECT_CONFIG_WORKSPACE/.spec-first/workspace/project-config-bootstrap-summary.json"
assert "bootstrap-project-config parent default writes child a local config" test -f "$PROJECT_CONFIG_WORKSPACE/project-a/.spec-first/config.local.yaml"
assert "bootstrap-project-config parent default writes child b local config" test -f "$PROJECT_CONFIG_WORKSPACE/project-b/.spec-first/config.local.yaml"
assert "bootstrap-project-config parent default does not write parent config" test ! -e "$PROJECT_CONFIG_WORKSPACE/.spec-first/config.local.yaml"

install_mcp_log="$TMP_DIR/install-mcp.log"
install_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --serena-language typescript 2>"$install_mcp_log")"
assert "install-mcp emits JSON" jq -e . <<<"$install_output"
assert_eq "installer configures all required tools" "serena,sequential-thinking,context7,gitnexus,code-review-graph" "$(jq -r '[.results[].tool_id] | join(",")' <<<"$install_output")"
assert_eq "installer has no skipped optional results" "true" "$(jq -r 'all(.results[]; .status == "ready")' <<<"$install_output")"
assert_eq "installer writes GitNexus config" "npx" "$(jq -r '.mcpServers.gitnexus.command' "$FAKE_HOME/.claude.json")"
assert_eq "installer skips optional code-review-graph host MCP config" "false" "$(jq -r '.mcpServers | has("code-review-graph")' "$FAKE_HOME/.claude.json")"
assert_eq "installer records code-review-graph host config skipped" "host-config-skipped" "$(jq -r '.results[] | select(.tool_id == "code-review-graph") | .last_action' <<<"$install_output")"
assert_eq "installer does not write internal scope into Claude config" "false" "$(jq -r '.mcpServers.serena | has("scope")' "$FAKE_HOME/.claude.json")"
assert "Serena ready marker exists" test -f "$FAKE_REPO/.serena/index-ready.json"
assert_contains "installer uses explicit LLM-selected TypeScript language for Node repo" "serena project create . --index --language typescript" "$(cat "$COMMAND_LOG")"
assert_contains "installer prints configure-host stage logs" "spec-mcp-setup: [mcp/configure:serena] start" "$(cat "$install_mcp_log")"
assert_contains "installer prints Serena stage logs" "spec-mcp-setup: [mcp/serena:serena] start" "$(cat "$install_mcp_log")"

gitnexus_warmup_count_before="$(grep -cF "npx -y $GITNEXUS_PACKAGE --help" "$COMMAND_LOG" || true)"
WARMUP_CACHE_REUSE_REPO="$TMP_DIR/warmup-cache-reuse-repo"
make_repo "$WARMUP_CACHE_REUSE_REPO"
warmup_cache_reuse_output="$(cd "$WARMUP_CACHE_REUSE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --only gitnexus)"
assert "warmup cache reuse emits JSON" jq -e . <<<"$warmup_cache_reuse_output"
gitnexus_warmup_count_after="$(grep -cF "npx -y $GITNEXUS_PACKAGE --help" "$COMMAND_LOG" || true)"
assert_eq "second repo reuses GitNexus warmup cache instead of rerunning npx" "$gitnexus_warmup_count_before" "$gitnexus_warmup_count_after"
assert_eq "ledger reports GitNexus warmup cache hit" "ready:warmup-cache-hit" "$(jq -r '.results[] | select(.tool_id == "gitnexus") | "\(.status):\(.last_action)"' <<<"$warmup_cache_reuse_output")"
gitnexus_warmup_cache_file="$(find "$FAKE_HOME/.spec-first/cache/mcp-warmup" -path '*/gitnexus.json' -print -quit)"
assert "GitNexus warmup cache marker exists" test -n "$gitnexus_warmup_cache_file"
assert_eq "GitNexus warmup cache records configured package" "$GITNEXUS_PACKAGE" "$(jq -r '.package_spec' "$gitnexus_warmup_cache_file")"

sequential_warmup_count_before="$(grep -cF 'npx -y @modelcontextprotocol/server-sequential-thinking@latest' "$COMMAND_LOG" || true)"
warmup_invalid_ttl_output="$(cd "$WARMUP_CACHE_REUSE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude SPEC_FIRST_WARMUP_LATEST_TTL_SECONDS=not-a-number bash "$SCRIPTS_DIR/install-mcp.sh" --only sequential-thinking)"
assert "warmup cache tolerates invalid latest TTL env" jq -e . <<<"$warmup_invalid_ttl_output"
sequential_warmup_count_after="$(grep -cF 'npx -y @modelcontextprotocol/server-sequential-thinking@latest' "$COMMAND_LOG" || true)"
assert_eq "invalid latest TTL env falls back without rerunning cached warmup" "$sequential_warmup_count_before" "$sequential_warmup_count_after"
assert_eq "latest package cache hit remains explicit" "ready:warmup-cache-hit" "$(jq -r '.results[] | select(.tool_id == "sequential-thinking") | "\(.status):\(.last_action)"' <<<"$warmup_invalid_ttl_output")"

BROKEN_WARMUP_CACHE_PATH="$TMP_DIR/warmup-cache-as-file"
printf 'not a directory\n' > "$BROKEN_WARMUP_CACHE_PATH"
warmup_broken_cache_output="$(cd "$WARMUP_CACHE_REUSE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude SPEC_FIRST_FORCE_WARMUP=1 SPEC_FIRST_WARMUP_CACHE_DIR="$BROKEN_WARMUP_CACHE_PATH" bash "$SCRIPTS_DIR/install-mcp.sh" --only gitnexus)"
assert "warmup cache write failure remains non-blocking" jq -e . <<<"$warmup_broken_cache_output"
assert_eq "broken warmup cache path does not fail setup" "ready:installed" "$(jq -r '.results[] | select(.tool_id == "gitnexus") | "\(.status):\(.last_action)"' <<<"$warmup_broken_cache_output")"

STDIN_DRAIN_REPO="$TMP_DIR/stdin-drain-repo"
STDIN_DRAIN_HOME="$TMP_DIR/stdin-drain-home"
make_repo "$STDIN_DRAIN_REPO"
stdin_drain_output="$(cd "$STDIN_DRAIN_REPO" && PATH="$TEST_PATH" HOME="$STDIN_DRAIN_HOME" MCP_SETUP_HOST=claude DRAIN_NPX_STDIN=1 bash "$SCRIPTS_DIR/install-mcp.sh" --serena-language typescript)"
assert "install-mcp with stdin-draining npx emits JSON" jq -e . <<<"$stdin_drain_output"
assert_eq "installer protects tool iteration from child stdin drains" "serena,sequential-thinking,context7,gitnexus,code-review-graph" "$(jq -r '[.results[].tool_id] | join(",")' <<<"$stdin_drain_output")"
assert_eq "stdin-drain installer writes latest sequential-thinking config" "@modelcontextprotocol/server-sequential-thinking@latest" "$(jq -r '.mcpServers["sequential-thinking"].args[1]' "$STDIN_DRAIN_HOME/.claude.json")"
assert_eq "stdin-drain installer writes latest context7 config" "@upstash/context7-mcp@latest" "$(jq -r '.mcpServers.context7.args[1]' "$STDIN_DRAIN_HOME/.claude.json")"

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
assert_contains "Serena local override ignores node_modules before indexing" '"**/node_modules/"' "$(cat "$INSTALL_LANG_REPO/.serena/project.local.yml")"
assert_contains "Serena local override ignores virtualenvs before indexing" '"**/.venv/"' "$(cat "$INSTALL_LANG_REPO/.serena/project.local.yml")"
assert_contains "Serena local override ignores generated runtime before indexing" '".agents/skills/"' "$(cat "$INSTALL_LANG_REPO/.serena/project.local.yml")"

INSTALL_NO_LANG_REPO="$TMP_DIR/install-no-lang-repo"
INSTALL_NO_LANG_HOME="$TMP_DIR/install-no-lang-home"
INSTALL_NO_LANG_BIN="$TMP_DIR/install-no-lang-bin"
INSTALL_NO_LANG_LOG="$TMP_DIR/install-no-lang-commands.log"
make_repo "$INSTALL_NO_LANG_REPO"
mkdir -p "$INSTALL_NO_LANG_HOME"
touch "$INSTALL_NO_LANG_LOG"
make_fake_bin "$INSTALL_NO_LANG_BIN" "$INSTALL_NO_LANG_LOG"
install_no_lang_output="$(cd "$INSTALL_NO_LANG_REPO" && PATH="$INSTALL_NO_LANG_BIN:$TEST_PATH" HOME="$INSTALL_NO_LANG_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --only serena)"
assert "install-mcp first-time no-language emits JSON" jq -e . <<<"$install_no_lang_output"
assert_eq "install-mcp classifies first-time missing Serena language" "partial:serena_language_required" "$(jq -r '.results[] | select(.tool_id == "serena") | "\(.status):\(.reason_code)"' <<<"$install_no_lang_output")"
assert_contains "install-mcp no-language next action names language flag" "--serena-language <language>" "$(jq -r '.results[] | select(.tool_id == "serena") | .next_action' <<<"$install_no_lang_output")"
assert_contains "install-mcp no-language diagnostic preserves fast-fail cause" "first-time bootstrap requires --language" "$(jq -r '.results[] | select(.tool_id == "serena") | .diagnostic_summary' <<<"$install_no_lang_output")"
if grep -q 'serena project create' "$INSTALL_NO_LANG_LOG"; then
  echo "FAIL: install-mcp first-time no-language path must not invoke Serena interactive project create" >&2
  exit 1
fi

assert_contains "setup does not run GitNexus analyze" "$GITNEXUS_PACKAGE --help" "$(cat "$COMMAND_LOG")"
if grep -q "$GITNEXUS_PACKAGE analyze" "$COMMAND_LOG"; then
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
serena_verify_ready="$(cd "$SERENA_SAFE_REPO" && PATH="$SERENA_FAIL_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --verify-only)"
assert_eq "Serena verify-only reports ready project" "ready::$(cd "$SERENA_SAFE_REPO" && pwd -P)" "$(jq -r '"\(.overall_status):\(.reason_code // ""):\(.repo_root)"' <<<"$serena_verify_ready")"

SERENA_VERIFY_MISSING_REPO="$TMP_DIR/serena-verify-missing-repo"
make_repo "$SERENA_VERIFY_MISSING_REPO"
serena_verify_missing="$(cd "$SERENA_VERIFY_MISSING_REPO" && PATH="$SERENA_FAIL_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --verify-only)"
assert_eq "Serena verify-only reports missing project as action required" "action-required:serena-project-not-ready" "$(jq -r '"\(.overall_status):\(.reason_code)"' <<<"$serena_verify_missing")"
assert "Serena verify-only does not create project directory" test ! -e "$SERENA_VERIFY_MISSING_REPO/.serena"

SERENA_INCOMPLETE_REPO="$TMP_DIR/serena-incomplete-repo"
SERENA_INCOMPLETE_BIN="$TMP_DIR/serena-incomplete-bin"
SERENA_INCOMPLETE_LOG="$TMP_DIR/serena-incomplete-commands.log"
make_repo "$SERENA_INCOMPLETE_REPO"
mkdir -p "$SERENA_INCOMPLETE_REPO/.serena/cache/typescript"
cat > "$SERENA_INCOMPLETE_REPO/.serena/project.yml" <<'YAML'
languages:
- typescript
YAML
printf 'stale-cache\n' > "$SERENA_INCOMPLETE_REPO/.serena/cache/typescript/raw_document_symbols.pkl"
touch "$SERENA_INCOMPLETE_LOG"
make_fake_bin "$SERENA_INCOMPLETE_BIN" "$SERENA_INCOMPLETE_LOG"
serena_incomplete_verify="$(cd "$SERENA_INCOMPLETE_REPO" && PATH="$SERENA_INCOMPLETE_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --verify-only)"
assert_eq "Serena verify-only reports incomplete cache without ready marker" "incomplete" "$(jq -r '.cache.status' <<<"$serena_incomplete_verify")"
assert_contains "Serena verify-only next action names incomplete cache" ".serena/cache" "$(jq -r '.next_action' <<<"$serena_incomplete_verify")"
(cd "$SERENA_INCOMPLETE_REPO" && PATH="$SERENA_INCOMPLETE_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh")
assert "Serena rebuild removes stale incomplete cache file" test ! -e "$SERENA_INCOMPLETE_REPO/.serena/cache/typescript/raw_document_symbols.pkl"
assert_contains "Serena incomplete rebuild reuses existing language" "serena project create . --index --language typescript" "$(cat "$SERENA_INCOMPLETE_LOG")"
assert_contains "Serena incomplete rebuild keeps safe local ignored paths" '"**/node_modules/"' "$(cat "$SERENA_INCOMPLETE_REPO/.serena/project.local.yml")"

SERENA_FIRST_TIME_NO_LANG_REPO="$TMP_DIR/serena-first-time-no-lang-repo"
SERENA_FIRST_TIME_NO_LANG_BIN="$TMP_DIR/serena-first-time-no-lang-bin"
SERENA_FIRST_TIME_NO_LANG_LOG="$TMP_DIR/serena-first-time-no-lang-commands.log"
make_repo "$SERENA_FIRST_TIME_NO_LANG_REPO"
touch "$SERENA_FIRST_TIME_NO_LANG_LOG"
make_fake_bin "$SERENA_FIRST_TIME_NO_LANG_BIN" "$SERENA_FIRST_TIME_NO_LANG_LOG"
set +e
serena_first_time_no_lang_output="$(cd "$SERENA_FIRST_TIME_NO_LANG_REPO" && PATH="$SERENA_FIRST_TIME_NO_LANG_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" 2>&1)"
serena_first_time_no_lang_status=$?
set -e
assert_eq "Serena first-time bootstrap without language fails fast" "1" "$serena_first_time_no_lang_status"
assert_contains "Serena first-time bootstrap asks LLM for supported language" "first-time bootstrap requires --language" "$serena_first_time_no_lang_output"
if grep -q 'serena project create' "$SERENA_FIRST_TIME_NO_LANG_LOG"; then
  echo "FAIL: first-time no-language bootstrap must not invoke Serena interactive project create" >&2
  exit 1
fi
assert "Serena first-time no-language failure does not create project directory" test ! -e "$SERENA_FIRST_TIME_NO_LANG_REPO/.serena"

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

SERENA_REUSE_REBUILD_REPO="$TMP_DIR/serena-reuse-rebuild-repo"
SERENA_REUSE_REBUILD_BIN="$TMP_DIR/serena-reuse-rebuild-bin"
SERENA_REUSE_REBUILD_LOG="$TMP_DIR/serena-reuse-rebuild-commands.log"
make_repo "$SERENA_REUSE_REBUILD_REPO"
mkdir -p "$SERENA_REUSE_REBUILD_REPO/.serena"
cat > "$SERENA_REUSE_REBUILD_REPO/.serena/project.yml" <<'YAML'
languages:
- typescript
YAML
touch "$SERENA_REUSE_REBUILD_LOG"
make_fake_bin "$SERENA_REUSE_REBUILD_BIN" "$SERENA_REUSE_REBUILD_LOG"
(cd "$SERENA_REUSE_REBUILD_REPO" && PATH="$SERENA_REUSE_REBUILD_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh")
assert_contains "Serena non-refresh rebuild reuses existing config languages" "serena project create . --index --language typescript" "$(cat "$SERENA_REUSE_REBUILD_LOG")"

SERENA_TIMEOUT_REPO="$TMP_DIR/serena-timeout-repo"
SERENA_TIMEOUT_HOME="$TMP_DIR/serena-timeout-home"
SERENA_TIMEOUT_BIN="$TMP_DIR/serena-timeout-bin"
SERENA_TIMEOUT_LOG="$TMP_DIR/serena-timeout-commands.log"
SERENA_TIMEOUT_CHILD_PID="$TMP_DIR/serena-timeout-child.pid"
make_repo "$SERENA_TIMEOUT_REPO"
mkdir -p "$SERENA_TIMEOUT_HOME"
touch "$SERENA_TIMEOUT_LOG"
make_fake_bin "$SERENA_TIMEOUT_BIN" "$SERENA_TIMEOUT_LOG"
cat > "$SERENA_TIMEOUT_BIN/uvx" <<SH
#!/bin/bash
echo "uvx \$*" >> "$SERENA_TIMEOUT_LOG"
if [[ " \$* " == *" serena project create "* ]]; then
  (while true; do sleep 1; done) &
  echo "\$!" > "$SERENA_TIMEOUT_CHILD_PID"
  wait
fi
exit 0
SH
chmod +x "$SERENA_TIMEOUT_BIN/uvx"
set +e
serena_timeout_output="$(cd "$SERENA_TIMEOUT_REPO" && PATH="$SERENA_TIMEOUT_BIN:$TEST_PATH" HOME="$SERENA_TIMEOUT_HOME" MCP_SETUP_HOST=claude SPEC_FIRST_STAGE_TIMEOUT_SECONDS=1 bash "$SCRIPTS_DIR/install-mcp.sh" --only serena --serena-language typescript)"
serena_timeout_status=$?
set -e
assert_eq "install-mcp timeout returns JSON without crashing" "0" "$serena_timeout_status"
assert "install-mcp timeout output is JSON" jq -e . <<<"$serena_timeout_output"
assert_eq "install-mcp classifies timed out Serena bootstrap as partial" "partial:serena_bootstrap_failed" "$(jq -r '.results[] | select(.tool_id == "serena") | "\(.status):\(.reason_code)"' <<<"$serena_timeout_output")"
if [ -f "$SERENA_TIMEOUT_CHILD_PID" ] && kill -0 "$(cat "$SERENA_TIMEOUT_CHILD_PID")" 2>/dev/null; then
  echo "FAIL: timed out Serena bootstrap left child process running" >&2
  exit 1
fi

SERENA_NO_LANG_REPO="$TMP_DIR/serena-no-lang-repo"
make_repo "$SERENA_NO_LANG_REPO"
set +e
serena_no_lang_output="$(cd "$SERENA_NO_LANG_REPO" && PATH="$SERENA_REFRESH_BIN:$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --refresh 2>&1)"
serena_no_lang_status=$?
set -e
assert_eq "Serena refresh fails fast without language evidence" "1" "$serena_no_lang_status"
assert_contains "Serena refresh failure asks LLM to pass language" "requires --language" "$serena_no_lang_output"

PARENT_WORKSPACE="$TMP_DIR/parent-workspace"
make_repo "$PARENT_WORKSPACE/project-a"
make_repo "$PARENT_WORKSPACE/project-b"
set +e
serena_parent_output="$(cd "$PARENT_WORKSPACE" && PATH="$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" 2>&1)"
serena_parent_status=$?
set -e
assert_eq "Serena refuses unresolved parent workspace" "1" "$serena_parent_status"
assert_contains "Serena unresolved workspace reports reason code" "workspace-target-required" "$serena_parent_output"
assert "Serena does not initialize parent workspace" test ! -e "$PARENT_WORKSPACE/.serena"
(cd "$PARENT_WORKSPACE" && PATH="$TEST_PATH" bash "$SCRIPTS_DIR/activate-serena.sh" --repo project-a --language typescript)
assert "Serena explicit child repo writes child project" test -f "$PARENT_WORKSPACE/project-a/.serena/project.yml"
assert "Serena explicit child repo writes child ready marker" test -f "$PARENT_WORKSPACE/project-a/.serena/index-ready.json"
assert "Serena explicit child repo still leaves parent clean" test ! -e "$PARENT_WORKSPACE/.serena"

parent_detect_output="$(cd "$PARENT_WORKSPACE" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "detect-tools exposes workspace target mode" "workspace-multi-repo" "$(jq -r '.target_mode' <<<"$parent_detect_output")"
assert_eq "detect-tools marks Serena project target required" "workspace-target-required" "$(jq -r '.tools.serena.project_status' <<<"$parent_detect_output")"
parent_verify_output="$(cd "$PARENT_WORKSPACE" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert "verify-tools parent default emits JSON" jq -e . <<<"$parent_verify_output"
assert_eq "verify-tools parent default schema" "workspace-mcp-verify-summary.v1" "$(jq -r '.schema_version' <<<"$parent_verify_output")"
assert_eq "verify-tools parent default selection source" "workspace-default-all-repos" "$(jq -r '.selection_source' <<<"$parent_verify_output")"
assert_eq "verify-tools parent default verifies all children" "partial:1:1" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$parent_verify_output")"
assert "verify-tools parent default writes advisory summary" test -f "$PARENT_WORKSPACE/.spec-first/workspace/mcp-verify-summary.json"
assert "verify does not create parent project config dir" test ! -e "$PARENT_WORKSPACE/.spec-first/config"
assert "verify does not create parent graph dir" test ! -e "$PARENT_WORKSPACE/.spec-first/graph"

MCP_ALL_REPOS_WORKSPACE="$TMP_DIR/mcp-all-repos-workspace"
MCP_ALL_REPOS_HOME="$FAKE_HOME"
make_repo "$MCP_ALL_REPOS_WORKSPACE/project-a"
make_repo "$MCP_ALL_REPOS_WORKSPACE/project-b"
default_repos_install_output="$(cd "$MCP_ALL_REPOS_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --only serena --serena-language-for project-a=typescript)"
assert "install-mcp parent default emits JSON" jq -e . <<<"$default_repos_install_output"
assert_eq "install-mcp parent default schema" "workspace-mcp-setup-summary.v1" "$(jq -r '.schema_version' <<<"$default_repos_install_output")"
assert_eq "install-mcp parent default selection source" "workspace-default-all-repos" "$(jq -r '.selection_source' <<<"$default_repos_install_output")"
assert_eq "install-mcp parent default reports partial language-gated success" "partial:1:1:1" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.partial):\(.counts.serena_language_required)"' <<<"$default_repos_install_output")"
assert "install-mcp parent default writes advisory summary" test -f "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-setup-summary.json"
rm -rf "$MCP_ALL_REPOS_WORKSPACE/project-a/.serena" "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-setup-summary.json"
all_repos_install_output="$(cd "$MCP_ALL_REPOS_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --all-repos --only serena --serena-language-for project-a=typescript)"
assert "install-mcp --all-repos emits JSON" jq -e . <<<"$all_repos_install_output"
assert_eq "install-mcp --all-repos emits summary schema" "workspace-mcp-setup-summary.v1" "$(jq -r '.schema_version' <<<"$all_repos_install_output")"
assert_eq "install-mcp --all-repos records explicit selection source" "explicit-all-repos" "$(jq -r '.selection_source' <<<"$all_repos_install_output")"
assert_eq "install-mcp --all-repos reports partial language-gated success" "partial:1:1:1" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.partial):\(.counts.serena_language_required)"' <<<"$all_repos_install_output")"
assert_eq "install-mcp --all-repos records per-child language gate" "project-b:serena_language_required" "$(jq -r '.results[] | select(.workspace_relative_path=="project-b") | "\(.repo_label):\(.reason_code)"' <<<"$all_repos_install_output")"
assert "install-mcp --all-repos writes advisory workspace summary" test -f "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-setup-summary.json"
assert "install-mcp --all-repos writes explicit-language child Serena project" test -f "$MCP_ALL_REPOS_WORKSPACE/project-a/.serena/project.yml"
assert "install-mcp --all-repos does not create no-language child Serena project" test ! -e "$MCP_ALL_REPOS_WORKSPACE/project-b/.serena"
assert "install-mcp --all-repos does not initialize parent Serena" test ! -e "$MCP_ALL_REPOS_WORKSPACE/.serena"
assert "install-mcp --all-repos does not write parent project config" test ! -e "$MCP_ALL_REPOS_WORKSPACE/.spec-first/config"

set +e
all_repos_conflict_output="$(cd "$MCP_ALL_REPOS_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --all-repos --repo project-a 2>/dev/null)"
all_repos_conflict_status=$?
set -e
assert_eq "install-mcp --all-repos rejects --repo conflict" "1" "$all_repos_conflict_status"
assert_eq "install-mcp --all-repos conflict reason" "all-repos-conflicts-with-repo" "$(jq -r '.reason_code' <<<"$all_repos_conflict_output")"

set +e
all_repos_single_setup_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --all-repos 2>/dev/null)"
all_repos_single_setup_status=$?
set -e
assert_eq "install-mcp --all-repos inside git repo fails closed" "1" "$all_repos_single_setup_status"
assert_eq "install-mcp --all-repos inside git repo reason" "all-repos-requires-parent-workspace" "$(jq -r '.reason_code' <<<"$all_repos_single_setup_output")"

all_repos_verify_output="$(cd "$MCP_ALL_REPOS_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh" --all-repos)"
assert "verify-tools --all-repos emits JSON" jq -e . <<<"$all_repos_verify_output"
assert_eq "verify-tools --all-repos emits summary schema" "workspace-mcp-verify-summary.v1" "$(jq -r '.schema_version' <<<"$all_repos_verify_output")"
assert_eq "verify-tools --all-repos records explicit selection source" "explicit-all-repos" "$(jq -r '.selection_source' <<<"$all_repos_verify_output")"
assert_eq "verify-tools --all-repos reports partial readiness" "partial:1:1" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$all_repos_verify_output")"
assert "verify-tools --all-repos writes advisory workspace summary" test -f "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-verify-summary.json"
assert "verify-tools --all-repos writes child provider projection" test -f "$MCP_ALL_REPOS_WORKSPACE/project-a/.spec-first/config/graph-providers.json"
assert "verify-tools --all-repos does not write parent graph facts" test ! -e "$MCP_ALL_REPOS_WORKSPACE/.spec-first/graph"
assert "verify-tools --all-repos does not write parent provider projection" test ! -e "$MCP_ALL_REPOS_WORKSPACE/.spec-first/config/graph-providers.json"

detect_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh")"
assert "detect-tools emits JSON" jq -e . <<<"$detect_output"
assert_eq "detect-tools schema v2 facts" "tool-facts.v2" "$(jq -r '.schema_version' <<<"$detect_output")"
assert_eq "detect-tools has no baseline_ready" "false" "$(jq -r 'has("baseline_ready")' <<<"$detect_output")"
assert_eq "detect-tools has no top-level crg" "false" "$(jq -r 'has("crg")' <<<"$detect_output")"
assert_eq "graph providers are not query-ready after setup detection" "false,false" "$(jq -r '[.graph_providers[] | .query_ready] | join(",")' <<<"$detect_output")"
assert_eq "code-review-graph provider does not require host MCP for bootstrap" "not-required:true:cli_artifact" "$(jq -r '.graph_providers["code-review-graph"] | "\(.host_config_status):\(.configured):\(.access_mode)"' <<<"$detect_output")"

verify_text="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "verify reports ledger v2" "readiness ledger v2" "$verify_text"
assert_contains "verify prints grouped final status tables" "Required Harness Runtime status (grouped):" "$verify_text"
assert_contains "verify prints execution result summary" "Execution result:" "$verify_text"
assert_contains "verify summary includes harness runtime decision" "Harness runtime" "$verify_text"
assert_contains "verify summary includes graph provider split" "ready: n/a; pending: gitnexus,code-review-graph" "$verify_text"
assert_contains "verify table includes helper" "agent-browser" "$verify_text"
assert_contains "verify table includes required ast-grep helper" "ast-grep" "$verify_text"
assert_contains "verify table includes required ast-grep skill" "ast-grep-skill" "$verify_text"
assert_contains "verify table includes provider projection" "graph-providers.json" "$verify_text"
assert_contains "verify table includes runtime capabilities" "runtime-capabilities.json" "$verify_text"
assert_contains "verify table includes provider artifacts" "provider-artifacts.json" "$verify_text"
assert_contains "verify prints fenced status blocks" '```text' "$verify_text"
assert_contains "verify prints MCP server table" "MCP servers:" "$verify_text"
assert_contains "verify prints graph provider table" "Graph providers:" "$verify_text"
assert_contains "verify prints helper table" "Helper tools:" "$verify_text"
assert_contains "verify prints project setup table" "Project setup facts:" "$verify_text"
assert_contains "verify prints aligned MCP columns" "| Name" "$verify_text"
assert_contains "verify prints aligned project columns" "| Artifact" "$verify_text"
assert_contains "verify prints tool remark" "符号级精确编辑和项目索引" "$verify_text"
assert_contains "verify graph table includes bootstrap column" "Bootstrap" "$verify_text"
assert_contains "verify graph table shows bootstrap required" "required" "$verify_text"
assert_contains "verify prints friendly next steps" "下一步:" "$verify_text"
assert_contains "verify prompts graph bootstrap command" "/spec:graph-bootstrap" "$verify_text"
assert_contains "verify prompts continue completion" "继续完成" "$verify_text"
assert_contains "verify says graph bootstrap can run now" "现在可以运行 /spec:graph-bootstrap" "$verify_text"
assert_contains "verify points to standards after graph bootstrap" "推荐运行 /spec:standards" "$verify_text"
last_verify_line="$(printf '%s\n' "$verify_text" | sed '/^[[:space:]]*$/d' | tail -n 1)"
assert_contains "verify output ends with downstream restart caveat" "live MCP probe 前需要" "$last_verify_line"
LEDGER_PATH="$FAKE_HOME/.claude/spec-first/host-setup.json"
PROVIDER_CONFIG="$FAKE_REPO/.spec-first/config/graph-providers.json"
RUNTIME_CAPABILITIES="$FAKE_REPO/.spec-first/config/runtime-capabilities.json"
PROVIDER_ARTIFACTS="$FAKE_REPO/.spec-first/config/provider-artifacts.json"
assert "ledger exists" test -f "$LEDGER_PATH"
assert "provider config exists" test -f "$PROVIDER_CONFIG"
assert "runtime capabilities exists" test -f "$RUNTIME_CAPABILITIES"
assert "provider artifacts exists" test -f "$PROVIDER_ARTIFACTS"
assert_eq "ledger schema v2" "v2" "$(jq -r '.schema_version' "$LEDGER_PATH")"
assert_eq "ledger baseline includes helpers and CLI graph provider" "true" "$(jq -r '.baseline_ready and ([.helper_tools[] | .result == "ready"] | all) and (.tools.gitnexus.host_config_status == "fallback-active") and (.tools["code-review-graph"].host_config_status == "not-required") and (.tools["code-review-graph"].configured == true)' "$LEDGER_PATH")"
assert_eq "provider projection schema" "graph-providers.v1" "$(jq -r '.schema_version' "$PROVIDER_CONFIG")"
assert_eq "runtime capabilities schema" "runtime-capabilities.v1" "$(jq -r '.schema_version' "$RUNTIME_CAPABILITIES")"
assert_eq "provider artifacts schema" "provider-artifacts.v1" "$(jq -r '.schema_version' "$PROVIDER_ARTIFACTS")"
assert_eq "provider projection is setup-only" "true" "$(jq -r '.boundaries.setup_only and .boundaries.does_not_run_gitnexus_analyze and .boundaries.does_not_run_code_review_graph_build' "$PROVIDER_CONFIG")"
provider_config_repo_root="$(jq -r '.repo_root' "$PROVIDER_CONFIG")"
assert_eq "provider commands are config-defined arrays" "true" "$(jq -r --arg repo_root "$provider_config_repo_root" --arg repo_name "$GITNEXUS_REPO_LABEL" --arg gitnexus_package "$GITNEXUS_PACKAGE" --arg query_probe "$GITNEXUS_QUERY_PROBE" '.providers.gitnexus.configured and .providers.gitnexus.enabled_for_bootstrap and (.providers.gitnexus.commands.bootstrap == ["npx","-y",$gitnexus_package,"analyze","--force"]) and (.providers.gitnexus.commands.query_probe == ["npx","-y",$gitnexus_package,"query",$query_probe,"--repo",$repo_name]) and (.providers.gitnexus.query_probe_policy.expected_hit == true) and (.providers.gitnexus.query_probe_policy.source == "git-ls-files-code-basename") and (.providers.gitnexus.query_probe_policy.token == $query_probe) and (.providers.gitnexus.query_probe_policy.selected_from == "trade/src/main/java/com/hstong/trade/tradelogin/login/ui/TradeLoginActivity.java") and (.providers.gitnexus.query_probe_policy.candidates[0].token == $query_probe) and (.providers.gitnexus.query_probe_policy.candidates[0].reason_code == "workflow_named") and (.providers["code-review-graph"].commands.bootstrap == ["uvx","--upgrade","code-review-graph","build"]) and (.providers["code-review-graph"].commands.query_probe == ["uvx","--upgrade","code-review-graph","status","--repo",$repo_root]) and (.providers["code-review-graph"].access_mode == "cli_artifact") and (.providers["code-review-graph"].host_config_required == false) and (.providers["code-review-graph"].mcp_server == null)' "$PROVIDER_CONFIG")"

LOW_SIGNAL_REPO="$TMP_DIR/low-signal-repo"
make_repo "$LOW_SIGNAL_REPO"
mkdir -p "$LOW_SIGNAL_REPO/bin" "$LOW_SIGNAL_REPO/frontend/admin/src/api" "$LOW_SIGNAL_REPO/frontend/admin/src/components" "$LOW_SIGNAL_REPO/src/cli/adapters"
printf 'console.log("install")\n' > "$LOW_SIGNAL_REPO/bin/postinstall.js"
printf 'export function getSystemConfig() {}\n' > "$LOW_SIGNAL_REPO/frontend/admin/src/api/systemConfig.ts"
printf 'export function AssessmentReport() {}\n' > "$LOW_SIGNAL_REPO/frontend/admin/src/components/AssessmentReport.tsx"
printf 'export function DashboardConfigForm() {}\n' > "$LOW_SIGNAL_REPO/frontend/admin/src/components/DashboardConfigForm.tsx"
printf 'export class ClaudeAdapter {}\n' > "$LOW_SIGNAL_REPO/src/cli/adapters/claude.js"
git -C "$LOW_SIGNAL_REPO" add bin/postinstall.js frontend/admin/src/api/systemConfig.ts frontend/admin/src/components/AssessmentReport.tsx frontend/admin/src/components/DashboardConfigForm.tsx src/cli/adapters/claude.js
LOW_SIGNAL_FACTS="$TMP_DIR/low-signal-facts.json"
LOW_SIGNAL_HOME="$TMP_DIR/low-signal-home"
mkdir -p "$LOW_SIGNAL_HOME"
jq -n \
  --arg repo_root "$LOW_SIGNAL_REPO" \
  --arg ledger_path "$LOW_SIGNAL_HOME/.claude/spec-first/host-setup.json" \
  '{
    schema_version:"v2",
    host:"claude",
    platform:"macos",
    repo_status:"git-repo",
    repo_root:$repo_root,
    selected_repo_root:$repo_root,
    target:{state_write_allowed:true},
    host_ledger_pointer:{host:"claude", path:$ledger_path, schema_version:"v2"},
    baseline_ready:true,
    host_runtime_ready:true,
    tools:{},
    helper_tools:{},
    graph_providers:{
      gitnexus:{
        configured:true,
        enabled_for_bootstrap:true,
        required:true,
        role:"global_knowledge",
        access_mode:"live_mcp",
        host_config_required:true,
        dependency_status:"ready",
        host_config_status:"ready",
        capabilities:[]
      },
      "code-review-graph":{
        configured:true,
        enabled_for_bootstrap:true,
        required:true,
        role:"impact_context",
        access_mode:"cli_artifact",
        host_config_required:false,
        dependency_status:"ready",
        host_config_status:"not-required",
        capabilities:[]
      }
    }
  }' > "$LOW_SIGNAL_FACTS"
low_signal_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$LOW_SIGNAL_FACTS")"
assert "low-signal provider projection emits JSON" jq -e . <<<"$low_signal_projection"
LOW_SIGNAL_PROVIDER_CONFIG="$LOW_SIGNAL_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus probe skips low-signal and display-only basenames" "DashboardConfigForm:frontend/admin/src/components/DashboardConfigForm.tsx:workflow_named" "$(jq -r '.providers.gitnexus.query_probe_policy | "\(.token):\(.selected_from):\(.candidates[0].reason_code)"' "$LOW_SIGNAL_PROVIDER_CONFIG")"

REMOTE_LABEL_REPO="$TMP_DIR/Hr360_temp"
make_repo "$REMOTE_LABEL_REPO"
git -C "$REMOTE_LABEL_REPO" remote add origin "https://gitee.com/sunnyrain/$GITNEXUS_REPO_LABEL.git"
mkdir -p "$REMOTE_LABEL_REPO/frontend/admin/src/pages"
printf 'export default function Login() { return null }\n' > "$REMOTE_LABEL_REPO/frontend/admin/src/pages/Login.tsx"
git -C "$REMOTE_LABEL_REPO" add frontend/admin/src/pages/Login.tsx
REMOTE_LABEL_FACTS="$TMP_DIR/remote-label-facts.json"
jq --arg repo_root "$REMOTE_LABEL_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
  | .target.state_write_allowed = true
' "$LOW_SIGNAL_FACTS" > "$REMOTE_LABEL_FACTS"
remote_label_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$REMOTE_LABEL_FACTS")"
assert "remote-label provider projection emits JSON" jq -e . <<<"$remote_label_projection"
assert "remote-label fixture intentionally has no GitNexus metadata yet" test ! -e "$REMOTE_LABEL_REPO/.gitnexus/meta.json"
REMOTE_LABEL_PROVIDER_CONFIG="$REMOTE_LABEL_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus repo label falls back to git remote before directory basename" "$GITNEXUS_REPO_LABEL" "$(jq -r '.providers.gitnexus.commands.query_probe[6]' "$REMOTE_LABEL_PROVIDER_CONFIG")"
assert_eq "GitNexus repo label remote fallback avoids temp directory basename" "false" "$(jq -r '.providers.gitnexus.commands.query_probe[6] == "Hr360_temp"' "$REMOTE_LABEL_PROVIDER_CONFIG")"

BUSINESS_TOKEN_REPO="$TMP_DIR/business-token-repo"
make_repo "$BUSINESS_TOKEN_REPO"
mkdir -p "$BUSINESS_TOKEN_REPO/src/address" "$BUSINESS_TOKEN_REPO/src/admin" "$BUSINESS_TOKEN_REPO/src/ads"
printf 'export class AddressService {}\n' > "$BUSINESS_TOKEN_REPO/src/address/AddressService.ts"
printf 'export class AdminController {}\n' > "$BUSINESS_TOKEN_REPO/src/admin/AdminController.ts"
printf 'export class AdvertiseActivity {}\n' > "$BUSINESS_TOKEN_REPO/src/ads/AdvertiseActivity.ts"
git -C "$BUSINESS_TOKEN_REPO" add src/address/AddressService.ts src/admin/AdminController.ts src/ads/AdvertiseActivity.ts
BUSINESS_TOKEN_FACTS="$TMP_DIR/business-token-facts.json"
jq --arg repo_root "$BUSINESS_TOKEN_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
  | .target.state_write_allowed = true
' "$LOW_SIGNAL_FACTS" > "$BUSINESS_TOKEN_FACTS"
business_token_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$BUSINESS_TOKEN_FACTS")"
assert "business-token provider projection emits JSON" jq -e . <<<"$business_token_projection"
BUSINESS_TOKEN_PROVIDER_CONFIG="$BUSINESS_TOKEN_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus weak-proof filter does not demote Admin or Address flows" "AddressService,AdminController" "$(jq -r '.providers.gitnexus.query_probe_policy.candidates[0:2] | map(.token) | join(",")' "$BUSINESS_TOKEN_PROVIDER_CONFIG")"
assert_eq "GitNexus weak-proof filter demotes Advertise behind flow-bearing tokens" "AdvertiseActivity" "$(jq -r '.providers.gitnexus.query_probe_policy.candidates[2].token' "$BUSINESS_TOKEN_PROVIDER_CONFIG")"

HEALTH_TOKEN_REPO="$TMP_DIR/health-token-repo"
make_repo "$HEALTH_TOKEN_REPO"
mkdir -p "$HEALTH_TOKEN_REPO/src/health" "$HEALTH_TOKEN_REPO/src/money"
printf 'class HealthController {}\n' > "$HEALTH_TOKEN_REPO/src/health/HealthController.java"
printf 'class MemberWithdrawController {}\n' > "$HEALTH_TOKEN_REPO/src/money/MemberWithdrawController.java"
git -C "$HEALTH_TOKEN_REPO" add src/health/HealthController.java src/money/MemberWithdrawController.java
HEALTH_TOKEN_FACTS="$TMP_DIR/health-token-facts.json"
jq --arg repo_root "$HEALTH_TOKEN_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
  | .target.state_write_allowed = true
' "$LOW_SIGNAL_FACTS" > "$HEALTH_TOKEN_FACTS"
health_token_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$HEALTH_TOKEN_FACTS")"
assert "health-token provider projection emits JSON" jq -e . <<<"$health_token_projection"
HEALTH_TOKEN_PROVIDER_CONFIG="$HEALTH_TOKEN_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus probe demotes health controller behind business flow" "MemberWithdrawController:workflow_named" "$(jq -r '.providers.gitnexus.query_probe_policy | "\(.token):\(.candidates[0].reason_code)"' "$HEALTH_TOKEN_PROVIDER_CONFIG")"

HEALTH_ONLY_REPO="$TMP_DIR/health-only-repo"
make_repo "$HEALTH_ONLY_REPO"
mkdir -p "$HEALTH_ONLY_REPO/src/health"
printf 'class HealthController {}\n' > "$HEALTH_ONLY_REPO/src/health/HealthController.java"
git -C "$HEALTH_ONLY_REPO" add src/health/HealthController.java
HEALTH_ONLY_FACTS="$TMP_DIR/health-only-facts.json"
jq --arg repo_root "$HEALTH_ONLY_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
  | .target.state_write_allowed = true
' "$LOW_SIGNAL_FACTS" > "$HEALTH_ONLY_FACTS"
health_only_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$HEALTH_ONLY_FACTS")"
assert "health-only provider projection emits JSON" jq -e . <<<"$health_only_projection"
HEALTH_ONLY_PROVIDER_CONFIG="$HEALTH_ONLY_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus probe keeps health-only fallback explicit" "HealthController:any_source" "$(jq -r '.providers.gitnexus.query_probe_policy | "\(.token):\(.candidates[0].reason_code)"' "$HEALTH_ONLY_PROVIDER_CONFIG")"

WEB_METHOD_REPO="$TMP_DIR/web-method-repo"
make_repo "$WEB_METHOD_REPO"
mkdir -p "$WEB_METHOD_REPO/src/main/java/com/acme/web/controller/money" "$WEB_METHOD_REPO/src/main/java/com/acme/web/controller/opening" "$WEB_METHOD_REPO/src/main/java/com/acme/web/controller/optional"
printf 'class MemberDepositController {\n  public Result<Void> queryDepositHistoryPage() { return null; }\n  public Result<Void> queryDepositDetail() { return null; }\n}\n' > "$WEB_METHOD_REPO/src/main/java/com/acme/web/controller/money/MemberDepositController.java"
printf 'class OpeningController {\n  public Result<Void> stepSave() { return null; }\n  public Result<Void> options() { return null; }\n}\n' > "$WEB_METHOD_REPO/src/main/java/com/acme/web/controller/opening/OpeningController.java"
printf 'class MemberOptionalStockController {\n  public Result<Void> save() { return null; }\n  public Result<Void> delete() { return null; }\n  public Result<Void> add() { return null; }\n  private <T> Result<T> booleanResult() { return null; }\n}\n' > "$WEB_METHOD_REPO/src/main/java/com/acme/web/controller/optional/MemberOptionalStockController.java"
git -C "$WEB_METHOD_REPO" add src/main/java/com/acme/web/controller/money/MemberDepositController.java src/main/java/com/acme/web/controller/opening/OpeningController.java src/main/java/com/acme/web/controller/optional/MemberOptionalStockController.java
WEB_METHOD_FACTS="$TMP_DIR/web-method-facts.json"
jq --arg repo_root "$WEB_METHOD_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
  | .target.state_write_allowed = true
' "$LOW_SIGNAL_FACTS" > "$WEB_METHOD_FACTS"
web_method_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$WEB_METHOD_FACTS")"
assert "web-method provider projection emits JSON" jq -e . <<<"$web_method_projection"
WEB_METHOD_PROVIDER_CONFIG="$WEB_METHOD_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus probe prefers flow-like methods over controller class names" "git-ls-files-source-symbol:stepSave:workflow_method:OpeningController.java" "$(jq -r '.providers.gitnexus.query_probe_policy | "\(.source):\(.token):\(.candidates[0].reason_code):\(.candidates[0].selected_from | split("/")[-1])"' "$WEB_METHOD_PROVIDER_CONFIG")"
assert_eq "GitNexus method candidates stay bounded and source-derived" "stepSave,options,save,delete,add" "$(jq -r '.providers.gitnexus.query_probe_policy.candidates | map(.token) | join(",")' "$WEB_METHOD_PROVIDER_CONFIG")"

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
assert_eq "detect-tools treats optional code-review-graph MCP as not required" "not-required" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect")"
cat > "$codex_system_config" <<'TOML'
[profiles.default]
model = "gpt-5"
TOML
codex_detect_system_profile="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE="$codex_system_config" bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "Codex higher-precedence profile-only config does not affect optional MCP" "not-required" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect_system_profile")"
cat > "$codex_system_config" <<'TOML'
[mcp_servers."code-review-graph"]
command = "old"
args = []
TOML
codex_detect_system_conflict="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE="$codex_system_config" bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "Codex higher-precedence optional MCP mismatch does not block baseline" "not-required" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect_system_conflict")"
rm -f "$codex_system_config"
cat > "$codex_config" <<'TOML'
[mcp_servers."code-review-graph"]
command = "uvx"
args = []
# code-review-graph serve --tools get_minimal_context_tool,get_impact_radius_tool,get_review_context_tool,query_graph_tool,detect_changes_tool,list_graph_stats_tool
TOML
codex_detect_bad_args="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "detect-tools ignores bad optional code-review-graph MCP args for baseline" "not-required" "$(jq -r '.tools["code-review-graph"].host_config_status' <<<"$codex_detect_bad_args")"
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
assert_contains "graph-bootstrap runs GitNexus analyze" "npx -y $GITNEXUS_PACKAGE analyze --force" "$graph_log_after"
assert_contains "graph-bootstrap uses GitNexus remote-derived repo label" "npx -y $GITNEXUS_PACKAGE query $GITNEXUS_QUERY_PROBE --repo $GITNEXUS_REPO_LABEL" "$graph_log_after"
assert_contains "graph-bootstrap runs latest code-review-graph build" "uvx --upgrade code-review-graph build" "$graph_log_after"
if [ "$graph_log_before" = "$graph_log_after" ]; then
  echo "FAIL: graph-bootstrap should run provider build commands" >&2
  exit 1
fi
assert_eq "graph-bootstrap writes canonical provider readiness" "true" "$(jq -r '(.ready_primary_providers | index("gitnexus") != null) and (.ready_primary_providers | index("code-review-graph") != null) and ([.providers[] | select(.query_ready == true)] | length == 2)' "$FAKE_REPO/.spec-first/graph/provider-status.json")"
verify_after_bootstrap="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "repeat verify shows gitnexus row" "gitnexus" "$verify_after_bootstrap"
assert_contains "repeat verify shows graph provider query ready" "全局代码知识图谱与影响分析" "$verify_after_bootstrap"
assert_contains "repeat verify shows ready query and done bootstrap cells" "| ready | done" "$verify_after_bootstrap"
assert_contains "repeat verify summary lists ready providers" "ready: gitnexus,code-review-graph; pending: n/a" "$verify_after_bootstrap"
assert_contains "repeat verify reports graph provider query ready summary" "Graph providers are query-ready." "$verify_after_bootstrap"
assert_contains "repeat verify recommends standards handoff" "推荐下一步运行 /spec:standards" "$verify_after_bootstrap"
assert_contains "repeat verify allows direct task description after restart" "如果已经有明确任务，可以在新会话直接描述目标" "$verify_after_bootstrap"
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
