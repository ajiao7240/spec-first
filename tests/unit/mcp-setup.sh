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
MCP_SETUP_SKILL="$REPO_ROOT/skills/spec-mcp-setup/SKILL.md"
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

mcp_setup_skill_source="$(cat "$MCP_SETUP_SKILL")"
assert_contains "mcp setup owns setup projection not graph refresh" '`spec-mcp-setup` owns setup projection, not graph readiness refresh' "$mcp_setup_skill_source"
assert_contains "mcp setup does not write graph readiness artifacts" 'must not write canonical `.spec-first/graph/*`, `.spec-first/providers/*`, or `.spec-first/impact/*`' "$mcp_setup_skill_source"
assert_contains "mcp setup marks bootstrap required on fingerprint mismatch" 'provider fingerprint mismatch' "$mcp_setup_skill_source"
assert_contains "mcp setup hands off to graph-bootstrap" 'hand off to `$spec-graph-bootstrap` / `/spec:graph-bootstrap`' "$mcp_setup_skill_source"
assert_contains "mcp setup avoids branch-triggered refresh" 'branch/pull/rebase-triggered refresh' "$mcp_setup_skill_source"
assert_contains "mcp setup writes setup-inferred capability discovery only" 'setup-inferred availability/discovery facts' "$mcp_setup_skill_source"
assert_contains "mcp setup distinguishes graph bootstrap from plan live evidence" 'Distinguish durable readiness refresh from Plan-stage live GitNexus evidence' "$mcp_setup_skill_source"
assert_contains "mcp setup dirty durable readiness does not block plan evidence" 'Dirty worktree or stale durable readiness does not automatically make prior/session-local Plan evidence unusable' "$mcp_setup_skill_source"
assert_contains "mcp setup documents GitNexus-only upgrade path" 'GitNexus-Only Upgrade Path' "$mcp_setup_skill_source"
assert_contains "mcp setup tells upgrades to run setup before graph-bootstrap" 'run `$spec-mcp-setup` / `/spec:mcp-setup` first' "$mcp_setup_skill_source"
assert_contains "mcp setup sends retired CRG cleanup to manual guidance" '19-旧CRG残留手动清理指引.md' "$mcp_setup_skill_source"
assert_not_contains "mcp setup fallback does not mention retired Serena semantics" "Serena" "$mcp_setup_skill_source"

assert "project target resolver is executable" test -x "$RESOLVER_SCRIPT"
TARGET_WORKSPACE="$TMP_DIR/target-workspace"
make_repo "$TARGET_WORKSPACE/project-a"
make_repo "$TARGET_WORKSPACE/project-b"
make_repo "$TMP_DIR/outside"
target_multi="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT")"
assert_eq "resolver detects multi-repo workspace" "workspace-multi-repo" "$(jq -r '.mode' <<<"$target_multi")"
assert_eq "resolver emits project target v2" "project-target.v2" "$(jq -r '.schema_version' <<<"$target_multi")"
assert_eq "resolver emits git health" "not-git" "$(jq -r '.git_health.status' <<<"$target_multi")"
assert_eq "multi-repo workspace requires explicit target" "workspace-target-required:false:2" "$(jq -r '"\(.reason_code):\(.state_write_allowed):\(.candidates | length)"' <<<"$target_multi")"
assert_eq "multi-repo workspace emits coverage gap" "0" "$(jq -r '.coverage_gap.uncovered_top_level_dirs' <<<"$target_multi")"
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
mkdir -p "$TARGET_WORKSPACE/non-git-docs/src"
printf 'export class FolderTargetService {}\n' > "$TARGET_WORKSPACE/non-git-docs/src/FolderTargetService.ts"
target_folder="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT" --folder non-git-docs)"
assert_eq "resolver accepts explicit non-git folder target" "non-git-folder:explicit-folder:true:non-git-docs" "$(jq -r '"\(.mode):\(.selection_source):\(.state_write_allowed):\(.folder_label)"' <<<"$target_folder")"
assert_eq "resolver exposes folder target paths without fake repo root" "true" "$(jq -r '(.target_kind == "non-git-folder") and (.selected_repo_root == null) and (.selected_folder_root != null) and (.target_root == .selected_folder_root)' <<<"$target_folder")"
assert_eq "resolver does not emit coverage gap for explicit folder" "false" "$(jq -r 'has("coverage_gap")' <<<"$target_folder")"
set +e
target_folder_git_repo="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT" --folder project-a 2>/dev/null)"
target_folder_git_repo_status=$?
set -e
assert_eq "resolver rejects folder target inside Git repo" "1" "$target_folder_git_repo_status"
assert_eq "folder target inside Git repo reason is stable" "folder-target-is-git-repo" "$(jq -r '.reason_code' <<<"$target_folder_git_repo")"
set +e
target_repo_folder_conflict="$(cd "$TARGET_WORKSPACE" && bash "$RESOLVER_SCRIPT" --repo project-a --folder non-git-docs 2>/dev/null)"
target_repo_folder_conflict_status=$?
set -e
assert_eq "resolver rejects repo and folder together" "1" "$target_repo_folder_conflict_status"

BROKEN_WORKTREE_WORKSPACE="$TMP_DIR/broken-worktree-workspace"
mkdir -p "$BROKEN_WORKTREE_WORKSPACE/project-a" "$BROKEN_WORKTREE_WORKSPACE/broken-child" "$BROKEN_WORKTREE_WORKSPACE/plain" "$BROKEN_WORKTREE_WORKSPACE/build"
git -C "$BROKEN_WORKTREE_WORKSPACE/project-a" init -q
printf 'gitdir: /missing/parent/worktree\n' > "$BROKEN_WORKTREE_WORKSPACE/.git"
printf 'gitdir: /missing/child/worktree\n' > "$BROKEN_WORKTREE_WORKSPACE/broken-child/.git"
REPAIR_WORKTREE_SCRIPT="$SCRIPTS_DIR/repair-worktree.sh"
broken_target="$(cd "$BROKEN_WORKTREE_WORKSPACE" && bash "$RESOLVER_SCRIPT")"
assert_eq "resolver detects broken parent worktree" "broken-worktree:false" "$(jq -r '"\(.git_health.status):\(.git_health.worktree_pointer.exists)"' <<<"$broken_target")"
assert_contains "broken worktree next action recommends dry-run repair" "spec-first repair-worktree --dry-run" "$(jq -r '.next_action' <<<"$broken_target")"
assert_eq "resolver records broken child diagnostics" "broken-child:broken-worktree" "$(jq -r '.candidates_diagnostics[0] | "\(.workspace_relative_path):\(.git_health.status)"' <<<"$broken_target")"
assert_eq "coverage gap counts non-git plain dir and ignores build" "1:plain:false" "$(jq -r '"\(.coverage_gap.uncovered_top_level_dirs):\(.coverage_gap.sample[0]):\(.coverage_gap.ignored_dir_patterns | index("build") == null)"' <<<"$broken_target")"

INVALID_WORKTREE_POINTER_WORKSPACE="$TMP_DIR/invalid-worktree-pointer-workspace"
mkdir -p "$INVALID_WORKTREE_POINTER_WORKSPACE/project-a" "$INVALID_WORKTREE_POINTER_WORKSPACE/existing-not-git"
git -C "$INVALID_WORKTREE_POINTER_WORKSPACE/project-a" init -q
printf 'gitdir: %s\n' "$INVALID_WORKTREE_POINTER_WORKSPACE/existing-not-git" > "$INVALID_WORKTREE_POINTER_WORKSPACE/.git"
invalid_pointer_target="$(cd "$INVALID_WORKTREE_POINTER_WORKSPACE" && bash "$RESOLVER_SCRIPT")"
assert_eq "resolver rejects existing but invalid gitdir pointer" "broken-worktree:broken-worktree-pointer-invalid:true" "$(jq -r '"\(.git_health.status):\(.git_health.reason_code):\(.git_health.worktree_pointer.exists)"' <<<"$invalid_pointer_target")"
invalid_pointer_repair_output="$(cd "$INVALID_WORKTREE_POINTER_WORKSPACE" && bash "$REPAIR_WORKTREE_SCRIPT" --dry-run)"
assert_contains "repair-worktree handles existing invalid gitdir pointer" "reason_code=broken-worktree-pointer-invalid" "$invalid_pointer_repair_output"

CORRUPTED_WORKSPACE="$TMP_DIR/corrupted-workspace"
mkdir -p "$CORRUPTED_WORKSPACE/.git" "$CORRUPTED_WORKSPACE/project-a"
git -C "$CORRUPTED_WORKSPACE/project-a" init -q
corrupted_target="$(cd "$CORRUPTED_WORKSPACE" && bash "$RESOLVER_SCRIPT")"
assert_eq "resolver detects corrupted gitdir" "corrupted-gitdir" "$(jq -r '.git_health.status' <<<"$corrupted_target")"
assert_contains "corrupted gitdir next action recommends git fsck" "git fsck" "$(jq -r '.next_action' <<<"$corrupted_target")"

assert "repair-worktree script is executable" test -x "$REPAIR_WORKTREE_SCRIPT"
repair_output="$(cd "$BROKEN_WORKTREE_WORKSPACE" && bash "$REPAIR_WORKTREE_SCRIPT" --dry-run)"
assert_contains "repair-worktree dry-run prints preview marker" "repair_worktree_dry_run=true" "$repair_output"
assert_contains "repair-worktree dry-run prints unlink preview" "Unlink preview:" "$repair_output"
assert_contains "repair-worktree dry-run prints manual guidance" "Manual repair guidance:" "$repair_output"
assert "repair-worktree dry-run does not delete .git" test -f "$BROKEN_WORKTREE_WORKSPACE/.git"
set +e
repair_apply_output="$(cd "$BROKEN_WORKTREE_WORKSPACE" && bash "$REPAIR_WORKTREE_SCRIPT" --apply 2>&1)"
repair_apply_status=$?
set -e
assert_eq "repair-worktree apply is deferred" "1" "$repair_apply_status"
assert_contains "repair-worktree apply emits deferred reason" "repair-worktree-apply-deferred" "$repair_apply_output"
assert "repair-worktree apply does not delete .git" test -f "$BROKEN_WORKTREE_WORKSPACE/.git"

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

assert_eq "mcp-tools schema is v6" "6" "$(jq -r '.schema_version' "$TOOLS_JSON")"
assert_eq "tool ids are fixed" "sequential-thinking,context7,gitnexus" "$(jq -r '[.tools[].id] | join(",")' "$TOOLS_JSON")"
assert_eq "every registry tool is required" "true" "$(jq -r 'all(.tools[]; .required == true)' "$TOOLS_JSON")"
assert_eq "categories are constrained" "true" "$(jq -r 'all(.tools[]; (.category == "mcp" or .category == "graph-provider"))' "$TOOLS_JSON")"
assert_eq "agent-browser is outside MCP registry" "false" "$(jq -r '[.tools[].id] | index("agent-browser") != null' "$TOOLS_JSON")"
assert_eq "browser MCP is not registered" "false" "$(jq -r '[.tools[].id] | any(. == "playwright")' "$TOOLS_JSON")"
assert_eq "graph provider roles are configured" "global_knowledge" "$(jq -r '[.tools[] | select(.category == "graph-provider") | .provider_role] | join(",")' "$TOOLS_JSON")"
assert_eq "GitNexus package pin is explicit" "gitnexus@1.6.6-rc.76" "$GITNEXUS_PACKAGE"
assert_eq "GitNexus native capability keys are locked" "context,cypher,impact,query,repo_registry,route_api_evidence,shape_check,tool_map,workspace_group" "$(jq -r '.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities | keys | sort | join(",")' "$TOOLS_JSON")"
assert_eq "GitNexus native capability registry uses locked fields" "true" "$(jq -r '.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities | to_entries | all(.value | (keys | sort | join(",")) == "fallback_posture,meaning,mutation_boundary,native_resources,native_tools,source_tags")' "$TOOLS_JSON")"
assert_eq "GitNexus native capability registry uses catalog source tags" "true" "$(jq -r '.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities | to_entries | all(.value.source_tags == ["checked-in-baseline","provider-pin"])' "$TOOLS_JSON")"
assert_eq "GitNexus native capability registry has no task-level outputs" "true" "$(jq -r '.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities | tostring | ((contains("query_result") or contains("result_snippet") or contains("semantic_conclusion") or contains("task_conclusion") or contains("raw_log")) | not)' "$TOOLS_JSON")"
assert_eq "GitNexus workspace group capability is read-only orientation" "read-only" "$(jq -r '.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.workspace_group.mutation_boundary' "$TOOLS_JSON")"
assert_eq "GitNexus workspace group registry exposes only read-only group tools and resources" "group_list:false:true" "$(jq -r '.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.workspace_group as $cap | "\($cap.native_tools | join(",")):\((($cap.native_tools + $cap.native_resources) | index("group_sync")) != null):\($cap.native_resources | index("gitnexus://group/{name}/status") != null)"' "$TOOLS_JSON")"
assert_eq "GitNexus native capability contract avoids alternate top-level name" "false" "$(jq -r '.tools[] | select(.id == "gitnexus") | .provider_config | has("capability_metadata")' "$TOOLS_JSON")"
assert_eq "gitnexus warmup command uses configured package" "npx -y $GITNEXUS_PACKAGE --help" "$(jq -r '.tools[] | select(.id == "gitnexus") as $t | [$t.installation.unix.command] + ($t.installation.unix.args | map(gsub("\\{\\{package\\}\\}"; ($t.package // "")) | gsub("\\{\\{version\\}\\}"; ($t.version // "")))) | join(" ")' "$TOOLS_JSON")"
assert_contains "write-provider-config.sh reads GitNexus package field separately" 'gitnexus_package_name="$(jq -r' "$(cat "$SCRIPTS_DIR/write-provider-config.sh")"
assert_contains "write-provider-config.sh reads GitNexus version field separately" 'gitnexus_package_version="$(jq -r' "$(cat "$SCRIPTS_DIR/write-provider-config.sh")"
assert_contains "write-provider-config.sh rejects missing GitNexus package or version" '[ -n "$gitnexus_package_name" ] && [ -n "$gitnexus_package_version" ]' "$(cat "$SCRIPTS_DIR/write-provider-config.sh")"
assert_contains "write-provider-config.sh hashes canonical GitNexus command JSON without newline" 'gitnexus_command_hash="$(printf '\''%s'\'' "$gitnexus_commands_json" | hash_text)"' "$(cat "$SCRIPTS_DIR/write-provider-config.sh")"
assert_contains "write-provider-config.sh emits the same canonical GitNexus command JSON" 'if $key == "gitnexus" then $gitnexus_commands' "$(cat "$SCRIPTS_DIR/write-provider-config.sh")"
assert_not_contains "write-provider-config.sh no longer reads code-review-graph package" 'code_review_graph_package_name' "$(cat "$SCRIPTS_DIR/write-provider-config.sh")"
assert_not_contains "write-provider-config.sh no longer emits code-review-graph commands" 'code_review_graph_commands' "$(cat "$SCRIPTS_DIR/write-provider-config.sh")"
assert_eq "sequential-thinking uses latest npm package" "npx -y @modelcontextprotocol/server-sequential-thinking@latest" "$(jq -r '.tools[] | select(.id == "sequential-thinking") | [.host_config.codex.command] + .host_config.codex.args | join(" ")' "$TOOLS_JSON")"
assert_eq "context7 uses latest npm package" "npx -y @upstash/context7-mcp@latest" "$(jq -r '.tools[] | select(.id == "context7") | [.host_config.codex.command] + .host_config.codex.args | join(" ")' "$TOOLS_JSON")"

FAKE_BIN="$TMP_DIR/bin"
COMMAND_LOG="$TMP_DIR/commands.log"
touch "$COMMAND_LOG"
make_fake_bin "$FAKE_BIN" "$COMMAND_LOG"
TEST_PATH="$FAKE_BIN:$PATH"

deps_output="$(PATH="$TEST_PATH" bash "$SCRIPTS_DIR/check-deps.sh")"
assert "check-deps emits JSON" jq -e . <<<"$deps_output"
assert_eq "check-deps schema v2" "deps.v2" "$(jq -r '.schema_version' <<<"$deps_output")"
assert_eq "required Unix deps are ready" "true" "$(jq -r '[.dependencies | to_entries[] | select(.value.required == true) | .key] | sort | join(",") == "jq,node,npm,npx,python3"' <<<"$deps_output")"
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
assert_eq "missing uv does not block GitNexus-only setup readiness" "true" "$(jq -r '.required_ready' <<<"$missing_uv_deps_output")"
assert_contains "missing uv is warning-only" "uv missing" "$(jq -r '.warnings | join(",")' <<<"$missing_uv_deps_output")"
assert_contains "missing uvx is warning-only" "uvx missing" "$(jq -r '.warnings | join(",")' <<<"$missing_uv_deps_output")"
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
assert_eq "helper verify-only skips browser helper without explicit demand" "skipped" "$(jq -r '.helper_tools."agent-browser".result' <<<"$helper_verify")"
assert_eq "helper verify-only skipped browser helper is non-blocking" "false" "$(jq -r '.helper_tools."agent-browser".baseline_blocking' <<<"$helper_verify")"
assert_eq "helper verify-only flags missing install marker" "action-required" "$(jq -r '.helper_tools."agent-browser".install_status' <<<"$helper_verify")"
assert_contains "helper verify-only asks for explicit browser helper opt-in" "SPEC_FIRST_BROWSER_HELPER_REQUIRED=1" "$(jq -r '.helper_tools."agent-browser".next_action' <<<"$helper_verify")"
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
assert_eq "Windows agent-browser missing runtime is skipped without opt-in" "skipped" "$(jq -r '.helper_tools."agent-browser".result' <<<"$windows_helper_verify")"
assert_eq "Windows agent-browser skipped runtime is non-blocking" "false" "$(jq -r '.helper_tools."agent-browser".baseline_blocking' <<<"$windows_helper_verify")"
assert_contains "Windows agent-browser skipped runtime suggests opt-in" "SPEC_FIRST_BROWSER_HELPER_REQUIRED=1" "$(jq -r '.helper_tools."agent-browser".next_action' <<<"$windows_helper_verify")"
assert_eq "Windows agent-browser CLI remains required" "ready" "$(jq -r '.helper_tools."agent-browser".dependency_status' <<<"$windows_helper_verify")"

helper_install_err="$TMP_DIR/helper-install.err"
helper_install="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" 2>"$helper_install_err")"
assert "install-helpers install emits JSON" jq -e . <<<"$helper_install"
assert_not_contains "helper install skips browser runtime without explicit demand" "agent-browser install" "$(cat "$COMMAND_LOG")"
assert_not_contains "helper install skips agent-browser global skill without explicit demand" "npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y" "$(cat "$COMMAND_LOG")"
assert_contains "helper install installs ast-grep global skill with latest skills CLI" "npx -y skills@latest add ast-grep/agent-skill -g -y" "$(cat "$COMMAND_LOG")"
assert "helper install does not write browser marker without explicit demand" test ! -f "$FAKE_HOME/.agent-browser/spec-first-install.json"
assert_eq "helper install reports skipped agent-browser without explicit demand" "skipped" "$(jq -r '.helper_tools."agent-browser".result' <<<"$helper_install")"
assert_eq "helper install reports missing agent-browser skill without explicit demand" "action-required" "$(jq -r '.helper_tools."agent-browser".skill_status' <<<"$helper_install")"

helper_verify_after_install_log_before="$(cat "$COMMAND_LOG")"
helper_verify_after_install="$(PATH="$TEST_PATH" HOME="$FAKE_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
helper_verify_after_install_log_after="$(cat "$COMMAND_LOG")"
assert_eq "helper verify-only stays read-only after install" "$helper_verify_after_install_log_before" "$helper_verify_after_install_log_after"
assert_eq "helper verify-only remains skipped without browser marker" "skipped" "$(jq -r '.helper_tools."agent-browser".result' <<<"$helper_verify_after_install")"

BROWSER_DEMAND_HOME="$TMP_DIR/browser-demand-home"
mkdir -p "$BROWSER_DEMAND_HOME/.agents/skills/ast-grep"
printf 'name: ast-grep\n' > "$BROWSER_DEMAND_HOME/.agents/skills/ast-grep/SKILL.md"
browser_demand_log_before="$(cat "$COMMAND_LOG")"
browser_demand_install="$(PATH="$TEST_PATH" HOME="$BROWSER_DEMAND_HOME" SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 bash "$SCRIPTS_DIR/install-helpers.sh" --install)"
browser_demand_log_after="$(cat "$COMMAND_LOG")"
browser_demand_new_log="${browser_demand_log_after#"$browser_demand_log_before"}"
assert "explicit browser helper demand emits JSON" jq -e . <<<"$browser_demand_install"
assert_contains "explicit demand runs agent-browser install" "agent-browser install" "$browser_demand_new_log"
assert_contains "explicit demand installs agent-browser global skill" "npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y" "$browser_demand_new_log"
assert "explicit demand writes browser marker" test -f "$BROWSER_DEMAND_HOME/.agent-browser/spec-first-install.json"
assert_eq "explicit demand reports agent-browser ready" "ready" "$(jq -r '.helper_tools."agent-browser".result' <<<"$browser_demand_install")"

WEB_SIGNAL_REPO="$TMP_DIR/web-signal-repo"
mkdir -p "$WEB_SIGNAL_REPO/src/app"
printf 'page\n' > "$WEB_SIGNAL_REPO/src/app/page.tsx"
printf '{"scripts":{"dev":"next dev"},"devDependencies":{"@playwright/test":"latest"}}\n' > "$WEB_SIGNAL_REPO/package.json"
web_signal_install="$(cd "$WEB_SIGNAL_REPO" && PATH="$TEST_PATH" HOME="$TMP_DIR/web-signal-home" bash "$SCRIPTS_DIR/install-helpers.sh" --install)"
assert "web signal install emits JSON" jq -e . <<<"$web_signal_install"
assert_eq "web signal without opt-in still skips browser install" "skipped" "$(jq -r '.helper_tools."agent-browser".result' <<<"$web_signal_install")"
assert_eq "web signal without opt-in still reports missing browser skill" "action-required" "$(jq -r '.helper_tools."agent-browser".skill_status' <<<"$web_signal_install")"
assert_contains "web signal records package demand signal" "package.json:dependency:@playwright/test" "$(jq -r '.helper_tools."agent-browser".browser_capability_demand_signals | join("\n")' <<<"$web_signal_install")"
assert_contains "web signal records directory demand signal" "dir:src/app" "$(jq -r '.helper_tools."agent-browser".browser_capability_demand_signals | join("\n")' <<<"$web_signal_install")"

CONCURRENT_BIN="$TMP_DIR/concurrent-bin"
CONCURRENT_HOME="$TMP_DIR/concurrent-home"
CONCURRENT_LOG="$TMP_DIR/concurrent-commands.log"
touch "$CONCURRENT_LOG"
make_fake_bin "$CONCURRENT_BIN" "$CONCURRENT_LOG"
mkdir -p "$CONCURRENT_HOME/.agents/skills/ast-grep"
printf 'name: ast-grep\n' > "$CONCURRENT_HOME/.agents/skills/ast-grep/SKILL.md"
concurrent_stderr="$TMP_DIR/concurrent-stderr.log"
concurrent_output="$(PATH="$CONCURRENT_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$CONCURRENT_HOME" SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 SLOW_AGENT_BROWSER_INSTALL_SECONDS=2 SLOW_AGENT_BROWSER_SKILL_SECONDS=2 SPEC_FIRST_STAGE_TIMEOUT_SECONDS=10 bash "$SCRIPTS_DIR/install-helpers.sh" 2>"$concurrent_stderr")"
concurrent_stage_log="$(cat "$concurrent_stderr")"
assert "helper install concurrent run emits JSON" jq -e . <<<"$concurrent_output"
assert "helper install concurrent run writes browser marker" test -f "$CONCURRENT_HOME/.agent-browser/spec-first-install.json"
assert_contains "helper install concurrent run starts browser install" "agent-browser install" "$(cat "$CONCURRENT_LOG")"
assert_contains "helper install concurrent run starts browser skill install" "npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y" "$(cat "$CONCURRENT_LOG")"
assert_contains "helper install concurrent run logs browser start" "agent-browser-browser-install] start (parallel)" "$concurrent_stage_log"
assert_contains "helper install concurrent run logs skill start" "agent-browser-skill-install] start (parallel)" "$concurrent_stage_log"
browser_start_line="$(awk '/agent-browser-browser-install] start \(parallel\)/ { print NR; exit }' "$concurrent_stderr")"
skill_start_line="$(awk '/agent-browser-skill-install] start \(parallel\)/ { print NR; exit }' "$concurrent_stderr")"
first_done_line="$(awk '/agent-browser-browser-install] done|agent-browser-skill-install] done/ { print NR; exit }' "$concurrent_stderr")"
concurrent_queued_before_wait="$(python3 -c 'import sys; b=int(sys.argv[1] or 0); s=int(sys.argv[2] or 0); d=int(sys.argv[3] or 0); print(str(b > 0 and s > 0 and d > 0 and b < d and s < d).lower())' "$browser_start_line" "$skill_start_line" "$first_done_line")"
assert_eq "helper install concurrent run queues both tasks before waiting" "true" "$concurrent_queued_before_wait"
assert_eq "helper install concurrent run keeps agent-browser ready" "ready" "$(jq -r '.helper_tools."agent-browser".result' <<<"$concurrent_output")"

NO_BROWSER_BIN="$TMP_DIR/bin-no-browser"
NO_BROWSER_LOG="$TMP_DIR/no-browser-commands.log"
NO_BROWSER_HOME="$TMP_DIR/no-browser-home"
touch "$NO_BROWSER_LOG"
make_fake_bin "$NO_BROWSER_BIN" "$NO_BROWSER_LOG"
rm -f "$NO_BROWSER_BIN/agent-browser"
mkdir -p "$NO_BROWSER_HOME"
NO_BROWSER_STDERR="$TMP_DIR/no-browser-stderr.log"
no_browser_install="$(PATH="$NO_BROWSER_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$NO_BROWSER_HOME" SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 SLOW_NPM_INSTALL_SECONDS=2 SPEC_FIRST_STAGE_TIMEOUT_SECONDS=1 bash "$SCRIPTS_DIR/install-helpers.sh" 2>"$NO_BROWSER_STDERR")"
assert "helper missing CLI install path emits JSON" jq -e . <<<"$no_browser_install"
assert_contains "explicit browser helper opt-in records timeout on slow npm" "timed out after 1s" "$(cat "$NO_BROWSER_STDERR")"
assert_eq "helper reports missing CLI if npm did not expose binary" "missing" "$(jq -r '.helper_tools."agent-browser".dependency_status' <<<"$no_browser_install")"
assert_eq "helper missing CLI remains non-blocking after opt-in failure" "false" "$(jq -r '.helper_tools."agent-browser".baseline_blocking' <<<"$no_browser_install")"
assert_eq "helper missing CLI reports degraded after opt-in failure" "degraded" "$(jq -r '.helper_tools."agent-browser".result' <<<"$no_browser_install")"

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
rm -f "$MIRROR_BIN/ast-grep"
cat > "$MIRROR_BIN/uname" <<'SH'
#!/bin/bash
echo Linux
SH
cat > "$MIRROR_BIN/npm" <<SH
#!/bin/bash
echo "npm \$* registry=\${npm_config_registry:-}\${NPM_CONFIG_REGISTRY:-}" >> "$MIRROR_LOG"
if [ "\${1:-}" = "--version" ]; then echo "10.0.0"; exit 0; fi
case " \$* " in
  *" install -g "*)
    if [ -n "\${npm_config_registry:-}\${NPM_CONFIG_REGISTRY:-}" ]; then
      mkdir -p "\$HOME/.npm-global/bin"
      if [[ " \$* " == *" agent-browser@latest "* ]]; then
        cat > "\$HOME/.npm-global/bin/agent-browser" <<'INNER'
#!/bin/bash
exit 0
INNER
        chmod +x "\$HOME/.npm-global/bin/agent-browser"
      fi
      if [[ " \$* " == *" @ast-grep/cli@latest "* ]]; then
        cat > "\$HOME/.npm-global/bin/ast-grep" <<'INNER'
#!/bin/bash
exit 0
INNER
        chmod +x "\$HOME/.npm-global/bin/ast-grep"
      fi
      exit 0
    fi
    exit 1
    ;;
esac
exit 0
SH
chmod +x "$MIRROR_BIN/npm" "$MIRROR_BIN/uname"
mkdir -p "$MIRROR_HOME/.agents/skills/ast-grep" "$MIRROR_HOME/.npm-global/bin"
printf 'name: ast-grep\n' > "$MIRROR_HOME/.agents/skills/ast-grep/SKILL.md"
mirror_install="$(PATH="$MIRROR_HOME/.npm-global/bin:$MIRROR_BIN:/usr/bin:/bin:/usr/sbin:/sbin" HOME="$MIRROR_HOME" SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 SPEC_FIRST_STAGE_TIMEOUT_SECONDS=15 bash "$SCRIPTS_DIR/install-helpers.sh" --install 2>/dev/null)"
assert "mirror fallback install emits JSON" jq -e . <<<"$mirror_install"
assert_eq "mirror fallback marks agent-browser source mirror" "mirror" "$(jq -r '.helper_tools."agent-browser".install_source' <<<"$mirror_install")"
assert_eq "mirror fallback flags mirror_used true" "true" "$(jq -r '.helper_tools."agent-browser".mirror_used' <<<"$mirror_install")"
assert_eq "mirror fallback marks ast-grep source mirror" "mirror" "$(jq -r '.helper_tools."ast-grep".install_source' <<<"$mirror_install")"
assert_eq "mirror fallback flags ast-grep mirror_used true" "true" "$(jq -r '.helper_tools."ast-grep".mirror_used' <<<"$mirror_install")"
assert_eq "ledger advertises npm mirror endpoint" "https://registry.npmmirror.com" "$(jq -r '.mirror_endpoints.npm' <<<"$mirror_install")"
assert_eq "ledger advertises uv mirror endpoint" "https://mirrors.tuna.tsinghua.edu.cn/pypi/simple" "$(jq -r '.mirror_endpoints.uv' <<<"$mirror_install")"
assert_contains "mirror fallback retries with mirror registry" "registry=https://registry.npmmirror.com" "$(cat "$MIRROR_LOG")"

PREFLIGHT_HOME="$TMP_DIR/preflight-home"
mkdir -p "$PREFLIGHT_HOME/.agents/skills/agent-browser"
printf 'name: agent-browser\n' > "$PREFLIGHT_HOME/.agents/skills/agent-browser/SKILL.md"
preflight_missing_marker="$(cd "$TMP_DIR" && PATH="$TEST_PATH" HOME="$PREFLIGHT_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health skips agent-browser install marker without opt-in" "skipped" "$(jq -r '.tools[] | select(.id == "agent-browser") | .result' <<<"$preflight_missing_marker")"
assert_eq "check-health keeps agent-browser CLI dependency ready when only marker is missing" "ready" "$(jq -r '.tools[] | select(.id == "agent-browser") | .dependency_status' <<<"$preflight_missing_marker")"
assert_contains "check-health points browser helper to opt-in" "SPEC_FIRST_BROWSER_HELPER_REQUIRED=1" "$(jq -r '.tools[] | select(.id == "agent-browser") | .next_action' <<<"$preflight_missing_marker")"

PREFLIGHT_CODEX_SKILL_HOME="$TMP_DIR/preflight-codex-skill-home"
mkdir -p "$PREFLIGHT_CODEX_SKILL_HOME/.codex/skills/ast-grep"
printf 'name: ast-grep\n' > "$PREFLIGHT_CODEX_SKILL_HOME/.codex/skills/ast-grep/SKILL.md"
preflight_codex_skill="$(cd "$TMP_DIR" && PATH="$TEST_PATH" HOME="$PREFLIGHT_CODEX_SKILL_HOME" bash "$SCRIPTS_DIR/check-health" --json)"
assert_eq "check-health detects Codex global skill fallback even when skills CLI omits it" "ready" "$(jq -r '.skills[] | select(.id == "ast-grep") | .result' <<<"$preflight_codex_skill")"
helper_codex_skill="$(cd "$TMP_DIR" && PATH="$TEST_PATH" HOME="$PREFLIGHT_CODEX_SKILL_HOME" bash "$SCRIPTS_DIR/install-helpers.sh" --verify-only)"
assert_eq "install-helpers detects Codex global skill fallback" "ready" "$(jq -r '.helper_tools."ast-grep-skill".result' <<<"$helper_codex_skill")"

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

NON_GIT_CONFIG_WORKSPACE="$TMP_DIR/non-git-config-workspace"
NON_GIT_CONFIG_FOLDER="$NON_GIT_CONFIG_WORKSPACE/plain-folder"
mkdir -p "$NON_GIT_CONFIG_FOLDER/src"
printf 'export class PlainFolderConfig {}\n' > "$NON_GIT_CONFIG_FOLDER/src/PlainFolderConfig.ts"
non_git_project_bootstrap="$(cd "$NON_GIT_CONFIG_WORKSPACE" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --folder plain-folder --refresh-example --create-local --ensure-gitignore --json)"
assert "bootstrap-project-config --folder emits JSON" jq -e . <<<"$non_git_project_bootstrap"
assert_eq "bootstrap-project-config --folder records non-git target" "non-git-folder:ready" "$(jq -r '"\(.target_kind):\(.overall_status)"' <<<"$non_git_project_bootstrap")"
assert_eq "bootstrap-project-config --folder skips gitignore mutation" "not-applicable-non-git-folder" "$(jq -r '.project.local_config_gitignore_status' <<<"$non_git_project_bootstrap")"
assert "bootstrap-project-config --folder writes local config under selected folder" test -f "$NON_GIT_CONFIG_FOLDER/.spec-first/config.local.yaml"
assert "bootstrap-project-config --folder writes example config under selected folder" test -f "$NON_GIT_CONFIG_FOLDER/.spec-first/config.local.example.yaml"
assert "bootstrap-project-config --folder does not write workspace parent config" test ! -e "$NON_GIT_CONFIG_WORKSPACE/.spec-first/config.local.yaml"

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

PROJECT_CONFIG_SUMMARY_SYMLINK_WORKSPACE="$TMP_DIR/project-config-summary-symlink-workspace"
PROJECT_CONFIG_SUMMARY_SYMLINK_OUTSIDE="$TMP_DIR/project-config-summary-outside"
make_repo "$PROJECT_CONFIG_SUMMARY_SYMLINK_WORKSPACE/project-a"
make_repo "$PROJECT_CONFIG_SUMMARY_SYMLINK_WORKSPACE/project-b"
mkdir -p "$PROJECT_CONFIG_SUMMARY_SYMLINK_WORKSPACE/.spec-first" "$PROJECT_CONFIG_SUMMARY_SYMLINK_OUTSIDE"
ln -s "$PROJECT_CONFIG_SUMMARY_SYMLINK_OUTSIDE" "$PROJECT_CONFIG_SUMMARY_SYMLINK_WORKSPACE/.spec-first/workspace"
set +e
project_config_symlink_output="$(cd "$PROJECT_CONFIG_SUMMARY_SYMLINK_WORKSPACE" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --all-repos --create-local --json 2>/dev/null)"
project_config_symlink_status=$?
set -e
assert_eq "bootstrap-project-config refuses symlinked workspace summary" "1" "$project_config_symlink_status"
assert_eq "bootstrap-project-config symlink summary reason" "workspace-summary-symlink-escape" "$(jq -r '.reason_code' <<<"$project_config_symlink_output")"
assert "bootstrap-project-config does not write summary outside workspace" test ! -e "$PROJECT_CONFIG_SUMMARY_SYMLINK_OUTSIDE/project-config-bootstrap-summary.json"

PROJECT_SPEC_SYMLINK_REPO="$TMP_DIR/project-spec-symlink-repo"
PROJECT_SPEC_SYMLINK_OUTSIDE="$TMP_DIR/project-spec-symlink-outside"
make_repo "$PROJECT_SPEC_SYMLINK_REPO"
mkdir -p "$PROJECT_SPEC_SYMLINK_OUTSIDE"
ln -s "$PROJECT_SPEC_SYMLINK_OUTSIDE" "$PROJECT_SPEC_SYMLINK_REPO/.spec-first"
set +e
project_spec_symlink_output="$(cd "$PROJECT_SPEC_SYMLINK_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --create-local --json 2>/dev/null)"
project_spec_symlink_status=$?
set -e
assert_eq "bootstrap-project-config refuses symlinked .spec-first" "1" "$project_spec_symlink_status"
assert_eq "bootstrap-project-config .spec-first symlink reason" "project-config-symlink-escape" "$(jq -r '.reason' <<<"$project_spec_symlink_output")"
assert "bootstrap-project-config does not write local config outside repo" test ! -e "$PROJECT_SPEC_SYMLINK_OUTSIDE/config.local.yaml"

PROJECT_CONFIG_LEAF_SYMLINK_REPO="$TMP_DIR/project-config-leaf-symlink-repo"
PROJECT_CONFIG_LEAF_OUTSIDE="$TMP_DIR/project-config-leaf-outside.yaml"
make_repo "$PROJECT_CONFIG_LEAF_SYMLINK_REPO"
mkdir -p "$PROJECT_CONFIG_LEAF_SYMLINK_REPO/.spec-first"
printf 'outside-before\n' > "$PROJECT_CONFIG_LEAF_OUTSIDE"
ln -s "$PROJECT_CONFIG_LEAF_OUTSIDE" "$PROJECT_CONFIG_LEAF_SYMLINK_REPO/.spec-first/config.local.example.yaml"
set +e
project_config_leaf_symlink_output="$(cd "$PROJECT_CONFIG_LEAF_SYMLINK_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --refresh-example --json 2>/dev/null)"
project_config_leaf_symlink_status=$?
set -e
assert_eq "bootstrap-project-config refuses symlinked example config leaf" "1" "$project_config_leaf_symlink_status"
assert_eq "bootstrap-project-config example config leaf symlink reason" "project-config-symlink-escape" "$(jq -r '.reason' <<<"$project_config_leaf_symlink_output")"
assert_eq "bootstrap-project-config leaves outside example config target unchanged" "outside-before" "$(cat "$PROJECT_CONFIG_LEAF_OUTSIDE")"

PROJECT_GITIGNORE_SYMLINK_REPO="$TMP_DIR/project-gitignore-symlink-repo"
PROJECT_GITIGNORE_OUTSIDE="$TMP_DIR/project-gitignore-outside"
make_repo "$PROJECT_GITIGNORE_SYMLINK_REPO"
printf 'outside\n' > "$PROJECT_GITIGNORE_OUTSIDE"
rm -f "$PROJECT_GITIGNORE_SYMLINK_REPO/.gitignore"
ln -s "$PROJECT_GITIGNORE_OUTSIDE" "$PROJECT_GITIGNORE_SYMLINK_REPO/.gitignore"
set +e
project_gitignore_symlink_output="$(cd "$PROJECT_GITIGNORE_SYMLINK_REPO" && bash "$SCRIPTS_DIR/bootstrap-project-config.sh" --ensure-gitignore --json 2>/dev/null)"
project_gitignore_symlink_status=$?
set -e
assert_eq "bootstrap-project-config refuses symlinked gitignore" "1" "$project_gitignore_symlink_status"
assert_eq "bootstrap-project-config gitignore symlink reason" "gitignore-symlink-escape" "$(jq -r '.reason' <<<"$project_gitignore_symlink_output")"
assert_eq "bootstrap-project-config leaves outside gitignore target unchanged" "outside" "$(cat "$PROJECT_GITIGNORE_OUTSIDE")"

install_mcp_log="$TMP_DIR/install-mcp.log"
install_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" 2>"$install_mcp_log")"
assert "install-mcp emits JSON" jq -e . <<<"$install_output"
assert_eq "installer configures all required tools" "sequential-thinking,context7,gitnexus" "$(jq -r '[.results[].tool_id] | join(",")' <<<"$install_output")"
assert_eq "installer has no skipped optional results" "true" "$(jq -r 'all(.results[]; .status == "ready")' <<<"$install_output")"
assert_eq "installer writes GitNexus config" "npx" "$(jq -r '.mcpServers.gitnexus.command' "$FAKE_HOME/.claude.json")"
assert_eq "installer does not configure code-review-graph host MCP" "false" "$(jq -r '.mcpServers | has("code-review-graph")' "$FAKE_HOME/.claude.json")"

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
stdin_drain_output="$(cd "$STDIN_DRAIN_REPO" && PATH="$TEST_PATH" HOME="$STDIN_DRAIN_HOME" MCP_SETUP_HOST=claude DRAIN_NPX_STDIN=1 bash "$SCRIPTS_DIR/install-mcp.sh")"
assert "install-mcp with stdin-draining npx emits JSON" jq -e . <<<"$stdin_drain_output"
assert_eq "installer protects tool iteration from child stdin drains" "sequential-thinking,context7,gitnexus" "$(jq -r '[.results[].tool_id] | join(",")' <<<"$stdin_drain_output")"
assert_eq "stdin-drain installer writes latest sequential-thinking config" "@modelcontextprotocol/server-sequential-thinking@latest" "$(jq -r '.mcpServers["sequential-thinking"].args[1]' "$STDIN_DRAIN_HOME/.claude.json")"
assert_eq "stdin-drain installer writes latest context7 config" "@upstash/context7-mcp@latest" "$(jq -r '.mcpServers.context7.args[1]' "$STDIN_DRAIN_HOME/.claude.json")"

assert_contains "setup does not run GitNexus analyze" "$GITNEXUS_PACKAGE --help" "$(cat "$COMMAND_LOG")"
assert_not_contains "setup does not warm code-review-graph package" "code-review-graph" "$(cat "$COMMAND_LOG")"
if grep -q "$GITNEXUS_PACKAGE analyze" "$COMMAND_LOG"; then
  echo "FAIL: spec-mcp-setup must not run gitnexus analyze" >&2
  exit 1
fi
if grep -q 'code-review-graph build' "$COMMAND_LOG"; then
  echo "FAIL: spec-mcp-setup must not run code-review-graph build" >&2
  exit 1
fi

PARENT_WORKSPACE="$TMP_DIR/parent-workspace"
make_repo "$PARENT_WORKSPACE/project-a"
make_repo "$PARENT_WORKSPACE/project-b"
parent_detect_output="$(cd "$PARENT_WORKSPACE" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh")"
assert_eq "detect-tools exposes workspace target mode" "workspace-multi-repo" "$(jq -r '.target_mode' <<<"$parent_detect_output")"
assert_eq "detect-tools exposes git health and coverage gap" "not-git:0" "$(jq -r '"\(.git_health.status):\(.coverage_gap.uncovered_top_level_dirs)"' <<<"$parent_detect_output")"
parent_verify_output="$(cd "$PARENT_WORKSPACE" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert "verify-tools parent default emits JSON" jq -e . <<<"$parent_verify_output"
assert_eq "verify-tools parent default schema" "workspace-mcp-verify-summary.v1" "$(jq -r '.schema_version' <<<"$parent_verify_output")"
assert_eq "verify-tools parent default selection source" "workspace-default-all-repos" "$(jq -r '.selection_source' <<<"$parent_verify_output")"
assert_eq "verify-tools parent default verifies all children" "ready:2:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$parent_verify_output")"
assert_eq "verify-tools parent summary carries advisory git health" "not-git:false" "$(jq -r '"\(.parent_workspace_advisory.git_health.status):\(.parent_workspace_advisory.repair_action_available)"' <<<"$parent_verify_output")"
assert_eq "verify-tools parent default has no pollution" "0" "$(jq -r '.parent_workspace_pollution_count' <<<"$parent_verify_output")"
assert_eq "verify-tools parent default emits empty runtime_hints" "0" "$(jq -r '.runtime_hints | length' <<<"$parent_verify_output")"
assert "verify-tools parent default writes advisory summary" test -f "$PARENT_WORKSPACE/.spec-first/workspace/mcp-verify-summary.json"
assert "verify-tools parent default writes quarantine scan artifact" test -f "$PARENT_WORKSPACE/.spec-first/workspace/parent-artifact-quarantine.json"
assert_eq "verify-tools parent clean quarantine is empty" "0" "$(jq -r '.quarantined_paths | length' "$PARENT_WORKSPACE/.spec-first/workspace/parent-artifact-quarantine.json")"
assert "verify does not create parent project config dir" test ! -e "$PARENT_WORKSPACE/.spec-first/config"
assert "verify does not create parent graph dir" test ! -e "$PARENT_WORKSPACE/.spec-first/graph"

PARENT_POLLUTION_WORKSPACE="$TMP_DIR/parent-pollution-workspace"
make_repo "$PARENT_POLLUTION_WORKSPACE/project-a"
make_repo "$PARENT_POLLUTION_WORKSPACE/project-b"
mkdir -p \
  "$PARENT_POLLUTION_WORKSPACE/.spec-first/graph" \
  "$PARENT_POLLUTION_WORKSPACE/.spec-first/providers/code-review-graph" \
  "$PARENT_POLLUTION_WORKSPACE/.gitnexus"
cat > "$PARENT_POLLUTION_WORKSPACE/.spec-first/graph/graph-facts.json" <<'JSON'
{"schema_version":"graph-facts.v1","repo_root":"/Users/lynwang/old-child","generated_at":"2026-05-28T00:00:00Z"}
JSON
cat > "$PARENT_POLLUTION_WORKSPACE/.gitnexus/meta.json" <<'JSON'
{"repoPath":"/Users/lynwang/old-child","indexedAt":"2026-05-28T00:00:01Z"}
JSON
parent_pollution_verify_output="$(cd "$PARENT_POLLUTION_WORKSPACE" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert "verify-tools parent pollution emits JSON" jq -e . <<<"$parent_pollution_verify_output"
assert_eq "verify-tools parent pollution count" "3" "$(jq -r '.parent_workspace_pollution_count' <<<"$parent_pollution_verify_output")"
assert "verify-tools writes parent quarantine artifact" test -f "$PARENT_POLLUTION_WORKSPACE/.spec-first/workspace/parent-artifact-quarantine.json"
assert_eq "parent quarantine schema" "parent-artifact-quarantine.v1" "$(jq -r '.schema_version' "$PARENT_POLLUTION_WORKSPACE/.spec-first/workspace/parent-artifact-quarantine.json")"
assert_eq "parent quarantine paths are POSIX" "true" "$(jq -r 'all(.quarantined_paths[]; (.path | contains("\\") | not))' "$PARENT_POLLUTION_WORKSPACE/.spec-first/workspace/parent-artifact-quarantine.json")"
assert_eq "parent quarantine captures foreign graph facts" "foreign-absolute-path-stat-failed" "$(jq -r '.quarantined_paths[] | select(.path==".spec-first/graph/graph-facts.json") | .reason_code' "$PARENT_POLLUTION_WORKSPACE/.spec-first/workspace/parent-artifact-quarantine.json")"
assert_eq "parent quarantine captures retired provider residue" "retired-provider-residue" "$(jq -r '.quarantined_paths[] | select(.path==".spec-first/providers/code-review-graph/") | .reason_code' "$PARENT_POLLUTION_WORKSPACE/.spec-first/workspace/parent-artifact-quarantine.json")"
assert_eq "verify-tools pollution emits runtime_hints with one entry" "1" "$(jq -r '.runtime_hints | length' <<<"$parent_pollution_verify_output")"
assert_eq "verify-tools pollution hint contains Workspace pollution detected" "true" "$(jq -r '.runtime_hints[0] | contains("Workspace pollution detected")' <<<"$parent_pollution_verify_output")"
assert_eq "verify-tools pollution hint includes pollution count" "true" "$(jq -r '.runtime_hints[0] | contains("3 paths quarantined")' <<<"$parent_pollution_verify_output")"
assert_eq "verify-tools pollution hint references clean command" "true" "$(jq -r '.runtime_hints[0] | contains("spec-first clean --workspace-orphans")' <<<"$parent_pollution_verify_output")"

MCP_ALL_REPOS_WORKSPACE="$TMP_DIR/mcp-all-repos-workspace"
MCP_ALL_REPOS_HOME="$FAKE_HOME"
make_repo "$MCP_ALL_REPOS_WORKSPACE/project-a"
make_repo "$MCP_ALL_REPOS_WORKSPACE/project-b"
default_repos_install_output="$(cd "$MCP_ALL_REPOS_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --only sequential-thinking)"
assert "install-mcp parent default emits JSON" jq -e . <<<"$default_repos_install_output"
assert_eq "install-mcp parent default schema" "workspace-mcp-setup-summary.v1" "$(jq -r '.schema_version' <<<"$default_repos_install_output")"
assert_eq "install-mcp parent default selection source" "workspace-default-all-repos" "$(jq -r '.selection_source' <<<"$default_repos_install_output")"
assert_eq "install-mcp parent default reports all child success" "ready:2:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.partial)"' <<<"$default_repos_install_output")"
assert "install-mcp parent default writes advisory summary" test -f "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-setup-summary.json"
rm -f "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-setup-summary.json"
all_repos_install_output="$(cd "$MCP_ALL_REPOS_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --all-repos --only sequential-thinking)"
assert "install-mcp --all-repos emits JSON" jq -e . <<<"$all_repos_install_output"
assert_eq "install-mcp --all-repos emits summary schema" "workspace-mcp-setup-summary.v1" "$(jq -r '.schema_version' <<<"$all_repos_install_output")"
assert_eq "install-mcp --all-repos records explicit selection source" "explicit-all-repos" "$(jq -r '.selection_source' <<<"$all_repos_install_output")"
assert_eq "install-mcp --all-repos reports all child success" "ready:2:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.partial)"' <<<"$all_repos_install_output")"
assert "install-mcp --all-repos writes advisory workspace summary" test -f "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-setup-summary.json"
assert "install-mcp --all-repos does not write parent project config" test ! -e "$MCP_ALL_REPOS_WORKSPACE/.spec-first/config"

MCP_SETUP_SUMMARY_SYMLINK_WORKSPACE="$TMP_DIR/mcp-setup-summary-symlink-workspace"
MCP_SETUP_SUMMARY_SYMLINK_OUTSIDE="$TMP_DIR/mcp-setup-summary-outside"
make_repo "$MCP_SETUP_SUMMARY_SYMLINK_WORKSPACE/project-a"
make_repo "$MCP_SETUP_SUMMARY_SYMLINK_WORKSPACE/project-b"
mkdir -p "$MCP_SETUP_SUMMARY_SYMLINK_WORKSPACE/.spec-first" "$MCP_SETUP_SUMMARY_SYMLINK_OUTSIDE"
ln -s "$MCP_SETUP_SUMMARY_SYMLINK_OUTSIDE" "$MCP_SETUP_SUMMARY_SYMLINK_WORKSPACE/.spec-first/workspace"
set +e
mcp_setup_symlink_output="$(cd "$MCP_SETUP_SUMMARY_SYMLINK_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_ALL_REPOS_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/install-mcp.sh" --all-repos --only __no_such_tool__ 2>/dev/null)"
mcp_setup_symlink_status=$?
set -e
assert_eq "install-mcp refuses symlinked workspace summary" "1" "$mcp_setup_symlink_status"
assert_eq "install-mcp symlink summary reason" "workspace-summary-symlink-escape" "$(jq -r '.reason_code' <<<"$mcp_setup_symlink_output")"
assert "install-mcp does not write summary outside workspace" test ! -e "$MCP_SETUP_SUMMARY_SYMLINK_OUTSIDE/mcp-setup-summary.json"

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
assert_eq "verify-tools --all-repos reports all child readiness" "ready:2:0" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$all_repos_verify_output")"
assert "verify-tools --all-repos writes advisory workspace summary" test -f "$MCP_ALL_REPOS_WORKSPACE/.spec-first/workspace/mcp-verify-summary.json"
assert "verify-tools --all-repos writes child provider projection" test -f "$MCP_ALL_REPOS_WORKSPACE/project-a/.spec-first/config/graph-providers.json"
assert "verify-tools --all-repos does not write parent graph facts" test ! -e "$MCP_ALL_REPOS_WORKSPACE/.spec-first/graph"
assert "verify-tools --all-repos does not write parent provider projection" test ! -e "$MCP_ALL_REPOS_WORKSPACE/.spec-first/config/graph-providers.json"

MCP_VERIFY_PARTIAL_WORKSPACE="$TMP_DIR/mcp-verify-partial-workspace"
MCP_VERIFY_PARTIAL_HOME="$TMP_DIR/mcp-verify-partial-home"
MCP_VERIFY_PARTIAL_OUTSIDE="$TMP_DIR/mcp-verify-partial-outside"
make_repo "$MCP_VERIFY_PARTIAL_WORKSPACE/project-a"
make_repo "$MCP_VERIFY_PARTIAL_WORKSPACE/project-b"
mkdir -p "$MCP_VERIFY_PARTIAL_HOME"
cp -R "$MCP_ALL_REPOS_HOME"/. "$MCP_VERIFY_PARTIAL_HOME"/
mkdir -p "$MCP_VERIFY_PARTIAL_WORKSPACE/project-b/.spec-first" "$MCP_VERIFY_PARTIAL_OUTSIDE"
ln -s "$MCP_VERIFY_PARTIAL_OUTSIDE" "$MCP_VERIFY_PARTIAL_WORKSPACE/project-b/.spec-first/config"
set +e
verify_partial_output="$(cd "$MCP_VERIFY_PARTIAL_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_VERIFY_PARTIAL_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh" --all-repos 2>/dev/null)"
verify_partial_status=$?
set -e
assert_eq "verify-tools --all-repos exits non-zero on partial" "1" "$verify_partial_status"
assert_eq "verify-tools --all-repos partial status" "partial:1:1" "$(jq -r '"\(.overall_status):\(.counts.ready):\(.counts.action_required)"' <<<"$verify_partial_output")"
assert_eq "verify-tools records child provider config symlink escape" "project-config-symlink-escape" "$(jq -r '.results[] | select(.workspace_relative_path=="project-b") | .result.repo_config_status' <<<"$verify_partial_output")"
assert "verify-tools does not write provider config through child symlink" test ! -e "$MCP_VERIFY_PARTIAL_OUTSIDE/graph-providers.json"

MCP_VERIFY_SUMMARY_SYMLINK_WORKSPACE="$TMP_DIR/mcp-verify-summary-symlink-workspace"
MCP_VERIFY_SUMMARY_SYMLINK_OUTSIDE="$TMP_DIR/mcp-verify-summary-outside"
make_repo "$MCP_VERIFY_SUMMARY_SYMLINK_WORKSPACE/project-a"
make_repo "$MCP_VERIFY_SUMMARY_SYMLINK_WORKSPACE/project-b"
mkdir -p "$MCP_VERIFY_SUMMARY_SYMLINK_WORKSPACE/.spec-first" "$MCP_VERIFY_SUMMARY_SYMLINK_OUTSIDE"
ln -s "$MCP_VERIFY_SUMMARY_SYMLINK_OUTSIDE" "$MCP_VERIFY_SUMMARY_SYMLINK_WORKSPACE/.spec-first/workspace"
set +e
verify_summary_symlink_output="$(cd "$MCP_VERIFY_SUMMARY_SYMLINK_WORKSPACE" && PATH="$TEST_PATH" HOME="$MCP_VERIFY_PARTIAL_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh" --all-repos 2>/dev/null)"
verify_summary_symlink_status=$?
set -e
assert_eq "verify-tools refuses symlinked workspace summary" "1" "$verify_summary_symlink_status"
assert_eq "verify-tools symlink summary reason" "workspace-summary-symlink-escape" "$(jq -r '.reason_code' <<<"$verify_summary_symlink_output")"
assert "verify-tools does not write summary outside workspace" test ! -e "$MCP_VERIFY_SUMMARY_SYMLINK_OUTSIDE/mcp-verify-summary.json"

detect_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh")"
assert "detect-tools emits JSON" jq -e . <<<"$detect_output"
assert_eq "detect-tools schema v2 facts" "tool-facts.v2" "$(jq -r '.schema_version' <<<"$detect_output")"
assert_eq "detect-tools has no baseline_ready" "false" "$(jq -r 'has("baseline_ready")' <<<"$detect_output")"
assert_eq "detect-tools has no top-level crg" "false" "$(jq -r 'has("crg")' <<<"$detect_output")"
assert_eq "graph providers are not query-ready after setup detection" "false" "$(jq -r '[.graph_providers[] | .query_ready] | join(",")' <<<"$detect_output")"
assert_eq "code-review-graph is absent from detect output" "null" "$(jq -r '.graph_providers["code-review-graph"] // "null"' <<<"$detect_output")"

NON_GIT_VERIFY_WORKSPACE="$TMP_DIR/non-git-verify-workspace"
NON_GIT_VERIFY_FOLDER="$NON_GIT_VERIFY_WORKSPACE/plain-folder"
NON_GIT_VERIFY_HOME="$TMP_DIR/non-git-verify-home"
mkdir -p "$NON_GIT_VERIFY_FOLDER/src" "$NON_GIT_VERIFY_HOME"
NON_GIT_VERIFY_FOLDER_ROOT="$(cd "$NON_GIT_VERIFY_FOLDER" && pwd -P)"
cp -R "$FAKE_HOME"/. "$NON_GIT_VERIFY_HOME"/
printf 'export class PlainFolderWorkflow {}\n' > "$NON_GIT_VERIFY_FOLDER/src/PlainFolderWorkflow.ts"
non_git_detect_output="$(cd "$NON_GIT_VERIFY_WORKSPACE" && PATH="$TEST_PATH" HOME="$NON_GIT_VERIFY_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/detect-tools.sh" --folder plain-folder)"
assert "detect-tools --folder emits JSON" jq -e . <<<"$non_git_detect_output"
assert_eq "detect-tools --folder records non-git target" "not-git-repo:non-git-folder:plain-folder" "$(jq -r '"\(.repo_status):\(.target_kind):\(.target.folder_label)"' <<<"$non_git_detect_output")"
assert_eq "detect-tools --folder exposes selected folder root" "true" "$(jq -r '(.selected_folder_root != null) and (.target_root == .selected_folder_root)' <<<"$non_git_detect_output")"
non_git_verify_text="$(cd "$NON_GIT_VERIFY_WORKSPACE" && PATH="$TEST_PATH" HOME="$NON_GIT_VERIFY_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh" --folder plain-folder)"
assert_not_contains "verify-tools --folder does not ask user to choose child repo" "choose a child repo and rerun with --repo <child>" "$non_git_verify_text"
NON_GIT_VERIFY_LEDGER="$NON_GIT_VERIFY_HOME/.claude/spec-first/host-setup.json"
NON_GIT_VERIFY_PROVIDER_CONFIG="$NON_GIT_VERIFY_FOLDER/.spec-first/config/graph-providers.json"
assert "verify-tools --folder writes provider projection" test -f "$NON_GIT_VERIFY_PROVIDER_CONFIG"
assert_eq "verify-tools --folder ledger carries folder target" "non-git-folder:$NON_GIT_VERIFY_FOLDER_ROOT" "$(jq -r '"\(.target_kind):\(.selected_folder_root)"' "$NON_GIT_VERIFY_LEDGER")"
assert_eq "verify-tools --folder provider projection is GitNexus-only" "gitnexus" "$(jq -r '.providers | keys | sort | join(",")' "$NON_GIT_VERIFY_PROVIDER_CONFIG")"

verify_text="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "verify reports ledger v2" "readiness ledger v2" "$verify_text"
assert_contains "verify prints grouped final status tables" "Required Harness Runtime status (grouped):" "$verify_text"
assert_contains "verify prints execution result summary" "Execution result:" "$verify_text"
assert_contains "verify summary includes harness runtime decision" "Harness runtime" "$verify_text"
assert_contains "verify summary includes graph provider split" "ready: n/a; pending: gitnexus" "$verify_text"
assert_contains "verify table includes helper" "agent-browser" "$verify_text"
assert_contains "verify table includes required ast-grep helper" "ast-grep" "$verify_text"
assert_contains "verify table includes required ast-grep skill" "ast-grep-skill" "$verify_text"
assert_contains "verify table includes provider projection" "graph-providers.json" "$verify_text"
assert_contains "verify table includes runtime capabilities" "runtime-capabilities.json" "$verify_text"
assert_contains "verify table includes provider artifacts" "provider-artifacts.json" "$verify_text"
assert_contains "verify prints fenced status blocks" '```text' "$verify_text"
assert_contains "verify prints MCP server table" "MCP servers:" "$verify_text"
assert_contains "verify prints graph provider table" "Graph providers:" "$verify_text"
assert_contains "verify MCP server table preserves Role column" "| Name                | Role" "$verify_text"
assert_contains "verify graph provider table preserves Role column" "| Name     | Role" "$verify_text"
assert_contains "verify prints helper table" "Helper tools:" "$verify_text"
assert_contains "verify prints project setup table" "Project setup facts:" "$verify_text"
assert_contains "verify prints aligned MCP columns" "| Name" "$verify_text"
assert_contains "verify prints aligned project columns" "| Artifact" "$verify_text"
assert_contains "verify prints tool remark" "反思式推理辅助" "$verify_text"
assert_contains "verify graph table includes bootstrap column" "Bootstrap" "$verify_text"
assert_contains "verify graph table shows bootstrap required" "required" "$verify_text"
assert_contains "verify prints friendly next steps" "下一步:" "$verify_text"
assert_contains "verify prompts graph bootstrap command" "/spec:graph-bootstrap" "$verify_text"
assert_contains "verify prompts continue completion" "继续完成" "$verify_text"
assert_contains "verify says graph bootstrap can run now" "现在可以运行 /spec:graph-bootstrap" "$verify_text"
assert_contains "verify routes by intent after graph bootstrap" "按用户意图进入 plan/work/review/debug 等下游 workflow" "$verify_text"
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
assert_eq "ledger baseline accepts non-blocking skipped browser helper and GitNexus provider" "true" "$(jq -r '.baseline_ready and (.helper_tools["agent-browser"].result == "skipped") and (.helper_tools["agent-browser"].baseline_blocking == false) and ([.helper_tools | to_entries[] | select(.key != "agent-browser") | .value.result == "ready"] | all) and (.tools.gitnexus.host_config_status == "fallback-active") and (.tools | has("code-review-graph") | not)' "$LEDGER_PATH")"
assert_eq "provider projection schema" "graph-providers.v1" "$(jq -r '.schema_version' "$PROVIDER_CONFIG")"
assert_eq "runtime capabilities schema" "runtime-capabilities.v1" "$(jq -r '.schema_version' "$RUNTIME_CAPABILITIES")"
assert_eq "provider artifacts schema" "provider-artifacts.v1" "$(jq -r '.schema_version' "$PROVIDER_ARTIFACTS")"
assert_eq "provider projection is setup-only" "true" "$(jq -r '.boundaries.setup_only and .boundaries.does_not_run_gitnexus_analyze and .boundaries.does_not_run_provider_refresh and (.boundaries | has("does_not_run_code_review_graph_build") | not)' "$PROVIDER_CONFIG")"
provider_config_repo_root="$(jq -r '.repo_root' "$PROVIDER_CONFIG")"
assert_eq "provider commands are config-defined arrays" "true" "$(jq -r --arg repo_name "$GITNEXUS_REPO_LABEL" --arg gitnexus_package "$GITNEXUS_PACKAGE" --arg query_probe "$GITNEXUS_QUERY_PROBE" '(.providers | keys == ["gitnexus"]) and .providers.gitnexus.configured and .providers.gitnexus.enabled_for_bootstrap and (.providers.gitnexus.commands.bootstrap == ["npx","-y",$gitnexus_package,"analyze","--force","--skip-agents-md","--no-stats"]) and (.providers.gitnexus.commands.incremental == ["npx","-y",$gitnexus_package,"analyze","--skip-agents-md","--no-stats"]) and (.providers.gitnexus.commands.status == ["npx","-y",$gitnexus_package,"status"]) and (.providers.gitnexus.commands.query_probe == ["npx","-y",$gitnexus_package,"query",$query_probe,"--repo",$repo_name]) and (.providers.gitnexus.commands.impact_probe == ["npx","-y",$gitnexus_package,"impact",$query_probe,"--repo",$repo_name,"--include-tests","--depth","2"]) and (.providers.gitnexus.query_probe_policy.expected_hit == true) and (.providers.gitnexus.query_probe_policy.source == "git-ls-files-code-basename") and (.providers.gitnexus.query_probe_policy.token == $query_probe) and (.providers.gitnexus.query_probe_policy.selected_from == "trade/src/main/java/com/hstong/trade/tradelogin/login/ui/TradeLoginActivity.java") and (.providers.gitnexus.query_probe_policy.candidates[0].token == $query_probe) and (.providers.gitnexus.query_probe_policy.candidates[0].reason_code == "workflow_named")' "$PROVIDER_CONFIG")"

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
      }
    }
  }' > "$LOW_SIGNAL_FACTS"
low_signal_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$LOW_SIGNAL_FACTS")"
assert "low-signal provider projection emits JSON" jq -e . <<<"$low_signal_projection"
LOW_SIGNAL_PROVIDER_CONFIG="$LOW_SIGNAL_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus probe skips low-signal and display-only basenames" "DashboardConfigForm:frontend/admin/src/components/DashboardConfigForm.tsx:workflow_named" "$(jq -r '.providers.gitnexus.query_probe_policy | "\(.token):\(.selected_from):\(.candidates[0].reason_code)"' "$LOW_SIGNAL_PROVIDER_CONFIG")"

NON_GIT_PROVIDER_WORKSPACE="$TMP_DIR/non-git-provider-workspace"
NON_GIT_PROVIDER_FOLDER="$NON_GIT_PROVIDER_WORKSPACE/plain-folder"
NON_GIT_PROVIDER_HOME="$TMP_DIR/non-git-provider-home"
mkdir -p "$NON_GIT_PROVIDER_FOLDER/src" "$NON_GIT_PROVIDER_HOME"
printf 'export class PlainFolderProvider {}\n' > "$NON_GIT_PROVIDER_FOLDER/src/PlainFolderProvider.ts"
NON_GIT_PROVIDER_FACTS="$TMP_DIR/non-git-provider-facts.json"
jq -n \
  --arg folder_root "$NON_GIT_PROVIDER_FOLDER" \
  --arg ledger_path "$NON_GIT_PROVIDER_HOME/.claude/spec-first/host-setup.json" \
  '{
    schema_version:"v2",
    host:"claude",
    platform:"macos",
    repo_status:"not-git-repo",
    repo_root:$folder_root,
    selected_folder_root:$folder_root,
    target_root:$folder_root,
    target_kind:"non-git-folder",
    target:{state_write_allowed:true,target_kind:"non-git-folder",selected_folder_root:$folder_root,target_root:$folder_root},
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
      }
    }
  }' > "$NON_GIT_PROVIDER_FACTS"
non_git_provider_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$NON_GIT_PROVIDER_FACTS")"
assert "non-git provider projection emits JSON" jq -e . <<<"$non_git_provider_projection"
NON_GIT_PROVIDER_CONFIG="$NON_GIT_PROVIDER_FOLDER/.spec-first/config/graph-providers.json"
assert_eq "non-git provider projection records target kind and folder fingerprint" "true" "$(jq -r '(.target_kind == "non-git-folder") and (.folder_snapshot.content_fingerprint | startswith("sha256:"))' "$NON_GIT_PROVIDER_CONFIG")"
assert_eq "non-git provider projection emits only GitNexus provider" "gitnexus" "$(jq -r '.providers | keys | sort | join(",")' "$NON_GIT_PROVIDER_CONFIG")"
assert_eq "non-git provider projection uses skip-git and omits incremental" "true" "$(jq -r --arg gitnexus_package "$GITNEXUS_PACKAGE" '(.providers.gitnexus.commands.bootstrap == ["npx","-y",$gitnexus_package,"analyze","--skip-git","--force","--skip-agents-md","--no-stats"]) and (.providers.gitnexus.commands | has("incremental") | not)' "$NON_GIT_PROVIDER_CONFIG")"
assert_eq "non-git provider selection routes context to GitNexus without impact provider" "gitnexus:null" "$(jq -r '"\(.selection.context_selection):\(.selection.impact_context // "null")"' "$NON_GIT_PROVIDER_CONFIG")"

DEGRADED_CAPABILITY_REPO="$TMP_DIR/degraded-capability-repo"
make_repo "$DEGRADED_CAPABILITY_REPO"
DEGRADED_CAPABILITY_FACTS="$TMP_DIR/degraded-capability-facts.json"
jq --arg repo_root "$DEGRADED_CAPABILITY_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
  | .target.state_write_allowed = true
  | .graph_providers.gitnexus.dependency_status = "missing"
  | .graph_providers.gitnexus.host_config_status = "ready"
' "$LOW_SIGNAL_FACTS" > "$DEGRADED_CAPABILITY_FACTS"
degraded_capability_projection="$(bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$DEGRADED_CAPABILITY_FACTS")"
assert "degraded capability provider projection emits JSON" jq -e . <<<"$degraded_capability_projection"
DEGRADED_CAPABILITY_PROVIDER_CONFIG="$DEGRADED_CAPABILITY_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus degraded capability provenance stays conservative" "unavailable:configured-not-verified:true" "$(jq -r '.providers.gitnexus.native_capabilities.query | "\(.status):\(.source_provenance):\(.limitations | join(" ") | contains("unavailable"))"' "$DEGRADED_CAPABILITY_PROVIDER_CONFIG")"

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

assert_eq "providers are configured but not query-ready" "true" "$(jq -r '(.derived_readiness.providers | keys == ["gitnexus"]) and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers.gitnexus.bootstrap_required == true)' "$PROVIDER_CONFIG")"
assert_eq "GitNexus native capability projection keys are locked" "context,cypher,impact,query,repo_registry,route_api_evidence,shape_check,tool_map,workspace_group" "$(jq -r '.providers.gitnexus.native_capabilities | keys | sort | join(",")' "$PROVIDER_CONFIG")"
assert_eq "GitNexus native capability projection uses locked fields" "true" "$(jq -r '.providers.gitnexus.native_capabilities | to_entries | all(.value | (keys | sort | join(",")) == "limitations,mutation_boundary,native_resources,native_tools,source_provenance,source_tags,status")' "$PROVIDER_CONFIG")"
assert_eq "GitNexus native capability projection uses locked enums" "true" "$(jq -r '.providers.gitnexus.native_capabilities | all(.[]; (.status as $status | ["available","unavailable","unknown","mutation-gated"] | index($status) != null) and (.source_provenance as $provenance | ["registry-only","configured-not-verified","configured-and-detected"] | index($provenance) != null) and (.mutation_boundary as $boundary | ["read-only","mutation-gated","policy-blocked","unknown"] | index($boundary) != null))' "$PROVIDER_CONFIG")"
assert_eq "GitNexus native capability projection keeps non-empty tool or resource arrays" "true" "$(jq -r '.providers.gitnexus.native_capabilities | all(.[]; (.native_tools | type) == "array" and (.native_resources | type) == "array" and (((.native_tools | length) + (.native_resources | length)) > 0))' "$PROVIDER_CONFIG")"
assert_eq "GitNexus available capabilities have required closed setup source tags" "true" "$(jq -r '.providers.gitnexus.native_capabilities as $caps | ([$caps[] | select(.status == "available" or .status == "mutation-gated") | ((.source_tags | index("checked-in-baseline") != null) and (.source_tags | index("provider-pin") != null) and (.source_tags | index("setup-projection") != null))] | all) and ([$caps[] | .source_tags[]] | all(. as $tag | ["checked-in-baseline","provider-pin","setup-projection"] | index($tag) != null))' "$PROVIDER_CONFIG")"
assert_eq "GitNexus normal capability source tags keep cross-host order" "checked-in-baseline,provider-pin,setup-projection" "$(jq -r '.providers.gitnexus.native_capabilities.query.source_tags | join(",")' "$PROVIDER_CONFIG")"
assert_eq "GitNexus workspace capability source tags keep cross-host order" "checked-in-baseline,provider-pin,setup-projection" "$(jq -r '.providers.gitnexus.native_capabilities.workspace_group.source_tags | join(",")' "$PROVIDER_CONFIG")"
CUSTOM_TAG_SKILL="$TMP_DIR/custom-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$CUSTOM_TAG_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.source_tags) = ["provider-pin","checked-in-baseline","provider-pin"]' "$CUSTOM_TAG_SKILL/mcp-tools.json" > "$CUSTOM_TAG_SKILL/mcp-tools.json.tmp"
mv "$CUSTOM_TAG_SKILL/mcp-tools.json.tmp" "$CUSTOM_TAG_SKILL/mcp-tools.json"
CUSTOM_TAG_REPO="$TMP_DIR/custom-tag-repo"
make_repo "$CUSTOM_TAG_REPO"
printf 'custom tags fixture\n' > "$CUSTOM_TAG_REPO/README.md"
git -C "$CUSTOM_TAG_REPO" add README.md
git -C "$CUSTOM_TAG_REPO" commit -q -m "Add custom tags fixture"
CUSTOM_TAG_FACTS="$TMP_DIR/custom-tag-facts.json"
jq -n \
  --arg repo_root "$CUSTOM_TAG_REPO" \
  '{
    schema_version:"v2",
    host:"claude",
    platform:"macos",
    repo_status:"git-repo",
    repo_root:$repo_root,
    selected_repo_root:$repo_root,
    target:{state_write_allowed:true},
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
      }
    }
  }' > "$CUSTOM_TAG_FACTS"
custom_tag_projection="$(bash "$CUSTOM_TAG_SKILL/scripts/write-provider-config.sh" --facts-file "$CUSTOM_TAG_FACTS")"
assert "custom source tag projection emits JSON" jq -e . <<<"$custom_tag_projection"
CUSTOM_TAG_PROVIDER_CONFIG="$CUSTOM_TAG_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus source tags projection derives and deduplicates registry tags" "provider-pin,checked-in-baseline,setup-projection" "$(jq -r '.providers.gitnexus.native_capabilities.query.source_tags | join(",")' "$CUSTOM_TAG_PROVIDER_CONFIG")"
INVALID_TAG_SKILL="$TMP_DIR/invalid-tag-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$INVALID_TAG_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.source_tags) = ["checked-in-baseline","live-mcp-tool"]' "$INVALID_TAG_SKILL/mcp-tools.json" > "$INVALID_TAG_SKILL/mcp-tools.json.tmp"
mv "$INVALID_TAG_SKILL/mcp-tools.json.tmp" "$INVALID_TAG_SKILL/mcp-tools.json"
INVALID_TAG_REPO="$TMP_DIR/invalid-tag-repo"
make_repo "$INVALID_TAG_REPO"
printf 'invalid tags fixture\n' > "$INVALID_TAG_REPO/README.md"
git -C "$INVALID_TAG_REPO" add README.md
git -C "$INVALID_TAG_REPO" commit -q -m "Add invalid tags fixture"
INVALID_TAG_FACTS="$TMP_DIR/invalid-tag-facts.json"
jq --arg repo_root "$INVALID_TAG_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$INVALID_TAG_FACTS"
invalid_tag_log="$TMP_DIR/invalid-tag.log"
if bash "$INVALID_TAG_SKILL/scripts/write-provider-config.sh" --facts-file "$INVALID_TAG_FACTS" >"$invalid_tag_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects live MCP source tags from registry" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects live MCP source tags from registry" "invalid_gitnexus_source_tag:live-mcp-tool" "$(cat "$invalid_tag_log")"
assert_eq "GitNexus invalid source tag projection does not write provider config" "false" "$(test -f "$INVALID_TAG_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
SCALAR_TAG_SKILL="$TMP_DIR/scalar-tag-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$SCALAR_TAG_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.source_tags) = "checked-in-baseline"' "$SCALAR_TAG_SKILL/mcp-tools.json" > "$SCALAR_TAG_SKILL/mcp-tools.json.tmp"
mv "$SCALAR_TAG_SKILL/mcp-tools.json.tmp" "$SCALAR_TAG_SKILL/mcp-tools.json"
SCALAR_TAG_REPO="$TMP_DIR/scalar-tag-repo"
make_repo "$SCALAR_TAG_REPO"
printf 'scalar tags fixture\n' > "$SCALAR_TAG_REPO/README.md"
git -C "$SCALAR_TAG_REPO" add README.md
git -C "$SCALAR_TAG_REPO" commit -q -m "Add scalar tags fixture"
SCALAR_TAG_FACTS="$TMP_DIR/scalar-tag-facts.json"
jq --arg repo_root "$SCALAR_TAG_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$SCALAR_TAG_FACTS"
scalar_tag_log="$TMP_DIR/scalar-tag.log"
if bash "$SCALAR_TAG_SKILL/scripts/write-provider-config.sh" --facts-file "$SCALAR_TAG_FACTS" >"$scalar_tag_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects scalar source tags from registry" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects scalar source tags from registry" "invalid_gitnexus_source_tags:not-array" "$(cat "$scalar_tag_log")"
assert_eq "GitNexus scalar source tag projection does not write provider config" "false" "$(test -f "$SCALAR_TAG_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
EMPTY_TAG_SKILL="$TMP_DIR/empty-tag-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$EMPTY_TAG_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.source_tags) = []' "$EMPTY_TAG_SKILL/mcp-tools.json" > "$EMPTY_TAG_SKILL/mcp-tools.json.tmp"
mv "$EMPTY_TAG_SKILL/mcp-tools.json.tmp" "$EMPTY_TAG_SKILL/mcp-tools.json"
EMPTY_TAG_REPO="$TMP_DIR/empty-tag-repo"
make_repo "$EMPTY_TAG_REPO"
printf 'empty tags fixture\n' > "$EMPTY_TAG_REPO/README.md"
git -C "$EMPTY_TAG_REPO" add README.md
git -C "$EMPTY_TAG_REPO" commit -q -m "Add empty tags fixture"
EMPTY_TAG_FACTS="$TMP_DIR/empty-tag-facts.json"
jq --arg repo_root "$EMPTY_TAG_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$EMPTY_TAG_FACTS"
empty_tag_log="$TMP_DIR/empty-tag.log"
if bash "$EMPTY_TAG_SKILL/scripts/write-provider-config.sh" --facts-file "$EMPTY_TAG_FACTS" >"$empty_tag_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects empty source tags from registry" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects empty source tags from registry" "invalid_gitnexus_source_tags:missing-baseline" "$(cat "$empty_tag_log")"
assert_eq "GitNexus empty source tag projection does not write provider config" "false" "$(test -f "$EMPTY_TAG_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
MISSING_TAG_SKILL="$TMP_DIR/missing-tag-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$MISSING_TAG_SKILL"
jq 'del(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.source_tags)' "$MISSING_TAG_SKILL/mcp-tools.json" > "$MISSING_TAG_SKILL/mcp-tools.json.tmp"
mv "$MISSING_TAG_SKILL/mcp-tools.json.tmp" "$MISSING_TAG_SKILL/mcp-tools.json"
MISSING_TAG_REPO="$TMP_DIR/missing-tag-repo"
make_repo "$MISSING_TAG_REPO"
printf 'missing tags fixture\n' > "$MISSING_TAG_REPO/README.md"
git -C "$MISSING_TAG_REPO" add README.md
git -C "$MISSING_TAG_REPO" commit -q -m "Add missing tags fixture"
MISSING_TAG_FACTS="$TMP_DIR/missing-tag-facts.json"
jq --arg repo_root "$MISSING_TAG_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$MISSING_TAG_FACTS"
missing_tag_log="$TMP_DIR/missing-tag.log"
if bash "$MISSING_TAG_SKILL/scripts/write-provider-config.sh" --facts-file "$MISSING_TAG_FACTS" >"$missing_tag_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects missing source_tags field" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects missing source_tags field" "invalid_gitnexus_source_tags:missing-field" "$(cat "$missing_tag_log")"
assert_eq "GitNexus missing source_tags projection does not write provider config" "false" "$(test -f "$MISSING_TAG_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
MISSING_MEANING_SKILL="$TMP_DIR/missing-meaning-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$MISSING_MEANING_SKILL"
jq 'del(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.meaning)' "$MISSING_MEANING_SKILL/mcp-tools.json" > "$MISSING_MEANING_SKILL/mcp-tools.json.tmp"
mv "$MISSING_MEANING_SKILL/mcp-tools.json.tmp" "$MISSING_MEANING_SKILL/mcp-tools.json"
MISSING_MEANING_REPO="$TMP_DIR/missing-meaning-repo"
make_repo "$MISSING_MEANING_REPO"
printf 'missing meaning fixture\n' > "$MISSING_MEANING_REPO/README.md"
git -C "$MISSING_MEANING_REPO" add README.md
git -C "$MISSING_MEANING_REPO" commit -q -m "Add missing meaning fixture"
MISSING_MEANING_FACTS="$TMP_DIR/missing-meaning-facts.json"
jq --arg repo_root "$MISSING_MEANING_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$MISSING_MEANING_FACTS"
missing_meaning_log="$TMP_DIR/missing-meaning.log"
if bash "$MISSING_MEANING_SKILL/scripts/write-provider-config.sh" --facts-file "$MISSING_MEANING_FACTS" >"$missing_meaning_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects missing meaning field" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects missing meaning field" "invalid_gitnexus_meaning:missing-field" "$(cat "$missing_meaning_log")"
assert_eq "GitNexus missing meaning projection does not write provider config" "false" "$(test -f "$MISSING_MEANING_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
MISSING_FALLBACK_SKILL="$TMP_DIR/missing-fallback-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$MISSING_FALLBACK_SKILL"
jq 'del(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.fallback_posture)' "$MISSING_FALLBACK_SKILL/mcp-tools.json" > "$MISSING_FALLBACK_SKILL/mcp-tools.json.tmp"
mv "$MISSING_FALLBACK_SKILL/mcp-tools.json.tmp" "$MISSING_FALLBACK_SKILL/mcp-tools.json"
MISSING_FALLBACK_REPO="$TMP_DIR/missing-fallback-repo"
make_repo "$MISSING_FALLBACK_REPO"
printf 'missing fallback fixture\n' > "$MISSING_FALLBACK_REPO/README.md"
git -C "$MISSING_FALLBACK_REPO" add README.md
git -C "$MISSING_FALLBACK_REPO" commit -q -m "Add missing fallback fixture"
MISSING_FALLBACK_FACTS="$TMP_DIR/missing-fallback-facts.json"
jq --arg repo_root "$MISSING_FALLBACK_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$MISSING_FALLBACK_FACTS"
missing_fallback_log="$TMP_DIR/missing-fallback.log"
if bash "$MISSING_FALLBACK_SKILL/scripts/write-provider-config.sh" --facts-file "$MISSING_FALLBACK_FACTS" >"$missing_fallback_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects missing fallback_posture field" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects missing fallback_posture field" "invalid_gitnexus_fallback_posture:missing-field" "$(cat "$missing_fallback_log")"
assert_eq "GitNexus missing fallback_posture projection does not write provider config" "false" "$(test -f "$MISSING_FALLBACK_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
BLANK_FALLBACK_SKILL="$TMP_DIR/blank-fallback-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$BLANK_FALLBACK_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.fallback_posture) = " "' "$BLANK_FALLBACK_SKILL/mcp-tools.json" > "$BLANK_FALLBACK_SKILL/mcp-tools.json.tmp"
mv "$BLANK_FALLBACK_SKILL/mcp-tools.json.tmp" "$BLANK_FALLBACK_SKILL/mcp-tools.json"
BLANK_FALLBACK_REPO="$TMP_DIR/blank-fallback-repo"
make_repo "$BLANK_FALLBACK_REPO"
printf 'blank fallback fixture\n' > "$BLANK_FALLBACK_REPO/README.md"
git -C "$BLANK_FALLBACK_REPO" add README.md
git -C "$BLANK_FALLBACK_REPO" commit -q -m "Add blank fallback fixture"
BLANK_FALLBACK_FACTS="$TMP_DIR/blank-fallback-facts.json"
jq --arg repo_root "$BLANK_FALLBACK_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$BLANK_FALLBACK_FACTS"
blank_fallback_log="$TMP_DIR/blank-fallback.log"
if bash "$BLANK_FALLBACK_SKILL/scripts/write-provider-config.sh" --facts-file "$BLANK_FALLBACK_FACTS" >"$blank_fallback_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects blank fallback_posture field" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects blank fallback_posture field" "invalid_gitnexus_fallback_posture:invalid-entry" "$(cat "$blank_fallback_log")"
assert_eq "GitNexus blank fallback_posture projection does not write provider config" "false" "$(test -f "$BLANK_FALLBACK_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
SCHEMA_V5_SKILL="$TMP_DIR/schema-v5-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$SCHEMA_V5_SKILL"
jq '.schema_version = "5"' "$SCHEMA_V5_SKILL/mcp-tools.json" > "$SCHEMA_V5_SKILL/mcp-tools.json.tmp"
mv "$SCHEMA_V5_SKILL/mcp-tools.json.tmp" "$SCHEMA_V5_SKILL/mcp-tools.json"
SCHEMA_V5_REPO="$TMP_DIR/schema-v5-repo"
make_repo "$SCHEMA_V5_REPO"
printf 'schema v5 fixture\n' > "$SCHEMA_V5_REPO/README.md"
git -C "$SCHEMA_V5_REPO" add README.md
git -C "$SCHEMA_V5_REPO" commit -q -m "Add schema v5 fixture"
SCHEMA_V5_FACTS="$TMP_DIR/schema-v5-facts.json"
jq --arg repo_root "$SCHEMA_V5_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$SCHEMA_V5_FACTS"
schema_v5_log="$TMP_DIR/schema-v5.log"
if bash "$SCHEMA_V5_SKILL/scripts/write-provider-config.sh" --facts-file "$SCHEMA_V5_FACTS" >"$schema_v5_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects stale mcp-tools schema version" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects stale mcp-tools schema version" "invalid_mcp_tools_schema_version:5" "$(cat "$schema_v5_log")"
assert_eq "GitNexus stale schema projection does not write provider config" "false" "$(test -f "$SCHEMA_V5_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
SCHEMA_V5_HOME="$TMP_DIR/schema-v5-home"
mkdir -p "$SCHEMA_V5_HOME"
assert_stale_schema_script_rejects() {
  local label="$1"
  shift
  local log="$TMP_DIR/schema-v5-${label}.log"
  if PATH="$TEST_PATH" HOME="$SCHEMA_V5_HOME" MCP_SETUP_HOST=codex "$@" >"$log" 2>&1; then
    echo "FAIL: $label should reject stale mcp-tools schema version" >&2
    exit 1
  fi
  assert_contains "$label rejects stale mcp-tools schema version" "invalid_mcp_tools_schema_version:5" "$(cat "$log")"
}
assert_stale_schema_script_rejects "detect-host" bash "$SCHEMA_V5_SKILL/scripts/detect-host.sh"
assert_stale_schema_script_rejects "detect-tools" bash "$SCHEMA_V5_SKILL/scripts/detect-tools.sh"
assert_stale_schema_script_rejects "configure-host" bash "$SCHEMA_V5_SKILL/scripts/configure-host.sh" --tool context7
assert_stale_schema_script_rejects "repair-install" bash "$SCHEMA_V5_SKILL/scripts/repair-install.sh" --tool context7
assert_stale_schema_script_rejects "uninstall-mcp" bash "$SCHEMA_V5_SKILL/scripts/uninstall-mcp.sh" --tool context7
assert_stale_schema_script_rejects "install-mcp" bash "$SCHEMA_V5_SKILL/scripts/install-mcp.sh" --only context7
assert_eq "stale schema host scripts do not write Codex config" "false" "$(test -f "$SCHEMA_V5_HOME/.codex/config.toml" && echo true || echo false)"
SCALAR_TOOLS_SKILL="$TMP_DIR/scalar-tools-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$SCALAR_TOOLS_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_tools) = "query"' "$SCALAR_TOOLS_SKILL/mcp-tools.json" > "$SCALAR_TOOLS_SKILL/mcp-tools.json.tmp"
mv "$SCALAR_TOOLS_SKILL/mcp-tools.json.tmp" "$SCALAR_TOOLS_SKILL/mcp-tools.json"
SCALAR_TOOLS_REPO="$TMP_DIR/scalar-tools-repo"
make_repo "$SCALAR_TOOLS_REPO"
printf 'scalar tools fixture\n' > "$SCALAR_TOOLS_REPO/README.md"
git -C "$SCALAR_TOOLS_REPO" add README.md
git -C "$SCALAR_TOOLS_REPO" commit -q -m "Add scalar tools fixture"
SCALAR_TOOLS_FACTS="$TMP_DIR/scalar-tools-facts.json"
jq --arg repo_root "$SCALAR_TOOLS_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$SCALAR_TOOLS_FACTS"
scalar_tools_log="$TMP_DIR/scalar-tools.log"
if bash "$SCALAR_TOOLS_SKILL/scripts/write-provider-config.sh" --facts-file "$SCALAR_TOOLS_FACTS" >"$scalar_tools_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects scalar native tools from registry" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects scalar native tools from registry" "invalid_gitnexus_native_tools:not-array" "$(cat "$scalar_tools_log")"
assert_eq "GitNexus scalar native tools projection does not write provider config" "false" "$(test -f "$SCALAR_TOOLS_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
SCALAR_RESOURCES_SKILL="$TMP_DIR/scalar-resources-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$SCALAR_RESOURCES_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_resources) = "gitnexus://repo/{name}/status"' "$SCALAR_RESOURCES_SKILL/mcp-tools.json" > "$SCALAR_RESOURCES_SKILL/mcp-tools.json.tmp"
mv "$SCALAR_RESOURCES_SKILL/mcp-tools.json.tmp" "$SCALAR_RESOURCES_SKILL/mcp-tools.json"
SCALAR_RESOURCES_REPO="$TMP_DIR/scalar-resources-repo"
make_repo "$SCALAR_RESOURCES_REPO"
printf 'scalar resources fixture\n' > "$SCALAR_RESOURCES_REPO/README.md"
git -C "$SCALAR_RESOURCES_REPO" add README.md
git -C "$SCALAR_RESOURCES_REPO" commit -q -m "Add scalar resources fixture"
SCALAR_RESOURCES_FACTS="$TMP_DIR/scalar-resources-facts.json"
jq --arg repo_root "$SCALAR_RESOURCES_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$SCALAR_RESOURCES_FACTS"
scalar_resources_log="$TMP_DIR/scalar-resources.log"
if bash "$SCALAR_RESOURCES_SKILL/scripts/write-provider-config.sh" --facts-file "$SCALAR_RESOURCES_FACTS" >"$scalar_resources_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects scalar native resources from registry" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects scalar native resources from registry" "invalid_gitnexus_native_resources:not-array" "$(cat "$scalar_resources_log")"
assert_eq "GitNexus scalar native resources projection does not write provider config" "false" "$(test -f "$SCALAR_RESOURCES_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
OBJECT_TOOLS_SKILL="$TMP_DIR/object-tools-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$OBJECT_TOOLS_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_tools) = [{"name":"query"}]' "$OBJECT_TOOLS_SKILL/mcp-tools.json" > "$OBJECT_TOOLS_SKILL/mcp-tools.json.tmp"
mv "$OBJECT_TOOLS_SKILL/mcp-tools.json.tmp" "$OBJECT_TOOLS_SKILL/mcp-tools.json"
OBJECT_TOOLS_REPO="$TMP_DIR/object-tools-repo"
make_repo "$OBJECT_TOOLS_REPO"
printf 'object tools fixture\n' > "$OBJECT_TOOLS_REPO/README.md"
git -C "$OBJECT_TOOLS_REPO" add README.md
git -C "$OBJECT_TOOLS_REPO" commit -q -m "Add object tools fixture"
OBJECT_TOOLS_FACTS="$TMP_DIR/object-tools-facts.json"
jq --arg repo_root "$OBJECT_TOOLS_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$OBJECT_TOOLS_FACTS"
object_tools_log="$TMP_DIR/object-tools.log"
if bash "$OBJECT_TOOLS_SKILL/scripts/write-provider-config.sh" --facts-file "$OBJECT_TOOLS_FACTS" >"$object_tools_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects object native tool entries" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects object native tool entries" "invalid_gitnexus_native_tools:invalid-entry" "$(cat "$object_tools_log")"
assert_eq "GitNexus object native tool projection does not write provider config" "false" "$(test -f "$OBJECT_TOOLS_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
BLANK_RESOURCES_SKILL="$TMP_DIR/blank-resources-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$BLANK_RESOURCES_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_resources) = [" "]' "$BLANK_RESOURCES_SKILL/mcp-tools.json" > "$BLANK_RESOURCES_SKILL/mcp-tools.json.tmp"
mv "$BLANK_RESOURCES_SKILL/mcp-tools.json.tmp" "$BLANK_RESOURCES_SKILL/mcp-tools.json"
BLANK_RESOURCES_REPO="$TMP_DIR/blank-resources-repo"
make_repo "$BLANK_RESOURCES_REPO"
printf 'blank resources fixture\n' > "$BLANK_RESOURCES_REPO/README.md"
git -C "$BLANK_RESOURCES_REPO" add README.md
git -C "$BLANK_RESOURCES_REPO" commit -q -m "Add blank resources fixture"
BLANK_RESOURCES_FACTS="$TMP_DIR/blank-resources-facts.json"
jq --arg repo_root "$BLANK_RESOURCES_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$BLANK_RESOURCES_FACTS"
blank_resources_log="$TMP_DIR/blank-resources.log"
if bash "$BLANK_RESOURCES_SKILL/scripts/write-provider-config.sh" --facts-file "$BLANK_RESOURCES_FACTS" >"$blank_resources_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects blank native resource entries" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects blank native resource entries" "invalid_gitnexus_native_resources:invalid-entry" "$(cat "$blank_resources_log")"
assert_eq "GitNexus blank native resource projection does not write provider config" "false" "$(test -f "$BLANK_RESOURCES_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
MISSING_TOOLS_SKILL="$TMP_DIR/missing-tools-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$MISSING_TOOLS_SKILL"
jq 'del(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_tools)' "$MISSING_TOOLS_SKILL/mcp-tools.json" > "$MISSING_TOOLS_SKILL/mcp-tools.json.tmp"
mv "$MISSING_TOOLS_SKILL/mcp-tools.json.tmp" "$MISSING_TOOLS_SKILL/mcp-tools.json"
MISSING_TOOLS_REPO="$TMP_DIR/missing-tools-repo"
make_repo "$MISSING_TOOLS_REPO"
printf 'missing tools fixture\n' > "$MISSING_TOOLS_REPO/README.md"
git -C "$MISSING_TOOLS_REPO" add README.md
git -C "$MISSING_TOOLS_REPO" commit -q -m "Add missing tools fixture"
MISSING_TOOLS_FACTS="$TMP_DIR/missing-tools-facts.json"
jq --arg repo_root "$MISSING_TOOLS_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$MISSING_TOOLS_FACTS"
missing_tools_log="$TMP_DIR/missing-tools.log"
if bash "$MISSING_TOOLS_SKILL/scripts/write-provider-config.sh" --facts-file "$MISSING_TOOLS_FACTS" >"$missing_tools_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects missing native_tools field" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects missing native_tools field" "invalid_gitnexus_native_tools:missing-field" "$(cat "$missing_tools_log")"
assert_eq "GitNexus missing native_tools projection does not write provider config" "false" "$(test -f "$MISSING_TOOLS_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
MISSING_RESOURCES_SKILL="$TMP_DIR/missing-resources-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$MISSING_RESOURCES_SKILL"
jq 'del(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_resources)' "$MISSING_RESOURCES_SKILL/mcp-tools.json" > "$MISSING_RESOURCES_SKILL/mcp-tools.json.tmp"
mv "$MISSING_RESOURCES_SKILL/mcp-tools.json.tmp" "$MISSING_RESOURCES_SKILL/mcp-tools.json"
MISSING_RESOURCES_REPO="$TMP_DIR/missing-resources-repo"
make_repo "$MISSING_RESOURCES_REPO"
printf 'missing resources fixture\n' > "$MISSING_RESOURCES_REPO/README.md"
git -C "$MISSING_RESOURCES_REPO" add README.md
git -C "$MISSING_RESOURCES_REPO" commit -q -m "Add missing resources fixture"
MISSING_RESOURCES_FACTS="$TMP_DIR/missing-resources-facts.json"
jq --arg repo_root "$MISSING_RESOURCES_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$MISSING_RESOURCES_FACTS"
missing_resources_log="$TMP_DIR/missing-resources.log"
if bash "$MISSING_RESOURCES_SKILL/scripts/write-provider-config.sh" --facts-file "$MISSING_RESOURCES_FACTS" >"$missing_resources_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects missing native_resources field" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects missing native_resources field" "invalid_gitnexus_native_resources:missing-field" "$(cat "$missing_resources_log")"
assert_eq "GitNexus missing native_resources projection does not write provider config" "false" "$(test -f "$MISSING_RESOURCES_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
LEGACY_SURFACES_SKILL="$TMP_DIR/legacy-surfaces-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$LEGACY_SURFACES_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query) |= (del(.native_tools) | .native_surfaces = ["query"])' "$LEGACY_SURFACES_SKILL/mcp-tools.json" > "$LEGACY_SURFACES_SKILL/mcp-tools.json.tmp"
mv "$LEGACY_SURFACES_SKILL/mcp-tools.json.tmp" "$LEGACY_SURFACES_SKILL/mcp-tools.json"
LEGACY_SURFACES_REPO="$TMP_DIR/legacy-surfaces-repo"
make_repo "$LEGACY_SURFACES_REPO"
printf 'legacy surfaces fixture\n' > "$LEGACY_SURFACES_REPO/README.md"
git -C "$LEGACY_SURFACES_REPO" add README.md
git -C "$LEGACY_SURFACES_REPO" commit -q -m "Add legacy surfaces fixture"
LEGACY_SURFACES_FACTS="$TMP_DIR/legacy-surfaces-facts.json"
jq --arg repo_root "$LEGACY_SURFACES_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$LEGACY_SURFACES_FACTS"
legacy_surfaces_log="$TMP_DIR/legacy-surfaces.log"
if bash "$LEGACY_SURFACES_SKILL/scripts/write-provider-config.sh" --facts-file "$LEGACY_SURFACES_FACTS" >"$legacy_surfaces_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects retired native_surfaces from registry" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects retired native_surfaces from registry" "invalid_gitnexus_native_surfaces:retired-field" "$(cat "$legacy_surfaces_log")"
assert_eq "GitNexus retired native surfaces projection does not write provider config" "false" "$(test -f "$LEGACY_SURFACES_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
EMPTY_SURFACES_SKILL="$TMP_DIR/empty-surfaces-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$EMPTY_SURFACES_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_tools) = [] | (.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.native_resources) = []' "$EMPTY_SURFACES_SKILL/mcp-tools.json" > "$EMPTY_SURFACES_SKILL/mcp-tools.json.tmp"
mv "$EMPTY_SURFACES_SKILL/mcp-tools.json.tmp" "$EMPTY_SURFACES_SKILL/mcp-tools.json"
EMPTY_SURFACES_REPO="$TMP_DIR/empty-surfaces-repo"
make_repo "$EMPTY_SURFACES_REPO"
printf 'empty surfaces fixture\n' > "$EMPTY_SURFACES_REPO/README.md"
git -C "$EMPTY_SURFACES_REPO" add README.md
git -C "$EMPTY_SURFACES_REPO" commit -q -m "Add empty surfaces fixture"
EMPTY_SURFACES_FACTS="$TMP_DIR/empty-surfaces-facts.json"
jq --arg repo_root "$EMPTY_SURFACES_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$EMPTY_SURFACES_FACTS"
empty_surfaces_log="$TMP_DIR/empty-surfaces.log"
if bash "$EMPTY_SURFACES_SKILL/scripts/write-provider-config.sh" --facts-file "$EMPTY_SURFACES_FACTS" >"$empty_surfaces_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects empty native capability surfaces" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects empty native capability surfaces" "invalid_gitnexus_native_capability:no-surfaces" "$(cat "$empty_surfaces_log")"
assert_eq "GitNexus empty native capability surfaces projection does not write provider config" "false" "$(test -f "$EMPTY_SURFACES_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
POLICY_BLOCKED_SKILL="$TMP_DIR/policy-blocked-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$POLICY_BLOCKED_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.mutation_boundary) = "policy-blocked"' "$POLICY_BLOCKED_SKILL/mcp-tools.json" > "$POLICY_BLOCKED_SKILL/mcp-tools.json.tmp"
mv "$POLICY_BLOCKED_SKILL/mcp-tools.json.tmp" "$POLICY_BLOCKED_SKILL/mcp-tools.json"
POLICY_BLOCKED_REPO="$TMP_DIR/policy-blocked-repo"
make_repo "$POLICY_BLOCKED_REPO"
printf 'policy blocked fixture\n' > "$POLICY_BLOCKED_REPO/README.md"
git -C "$POLICY_BLOCKED_REPO" add README.md
git -C "$POLICY_BLOCKED_REPO" commit -q -m "Add policy blocked fixture"
POLICY_BLOCKED_FACTS="$TMP_DIR/policy-blocked-facts.json"
jq --arg repo_root "$POLICY_BLOCKED_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$POLICY_BLOCKED_FACTS"
bash "$POLICY_BLOCKED_SKILL/scripts/write-provider-config.sh" --facts-file "$POLICY_BLOCKED_FACTS" > /dev/null
POLICY_BLOCKED_CONFIG="$POLICY_BLOCKED_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus policy-blocked boundary projects as mutation-gated status" "mutation-gated:policy-blocked:true" "$(jq -r '.providers.gitnexus.native_capabilities.query | "\(.status):\(.mutation_boundary):\(.limitations | join(" ") | contains("must not run in setup or Plan"))"' "$POLICY_BLOCKED_CONFIG")"
INVALID_BOUNDARY_SKILL="$TMP_DIR/invalid-boundary-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$INVALID_BOUNDARY_SKILL"
jq '(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.mutation_boundary) = "dangerous-write"' "$INVALID_BOUNDARY_SKILL/mcp-tools.json" > "$INVALID_BOUNDARY_SKILL/mcp-tools.json.tmp"
mv "$INVALID_BOUNDARY_SKILL/mcp-tools.json.tmp" "$INVALID_BOUNDARY_SKILL/mcp-tools.json"
INVALID_BOUNDARY_REPO="$TMP_DIR/invalid-boundary-repo"
make_repo "$INVALID_BOUNDARY_REPO"
printf 'invalid boundary fixture\n' > "$INVALID_BOUNDARY_REPO/README.md"
git -C "$INVALID_BOUNDARY_REPO" add README.md
git -C "$INVALID_BOUNDARY_REPO" commit -q -m "Add invalid boundary fixture"
INVALID_BOUNDARY_FACTS="$TMP_DIR/invalid-boundary-facts.json"
jq --arg repo_root "$INVALID_BOUNDARY_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$INVALID_BOUNDARY_FACTS"
invalid_boundary_log="$TMP_DIR/invalid-boundary.log"
if bash "$INVALID_BOUNDARY_SKILL/scripts/write-provider-config.sh" --facts-file "$INVALID_BOUNDARY_FACTS" >"$invalid_boundary_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects invalid mutation boundary" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects invalid mutation boundary" "invalid_gitnexus_mutation_boundary:dangerous-write" "$(cat "$invalid_boundary_log")"
assert_eq "GitNexus invalid mutation boundary projection does not write provider config" "false" "$(test -f "$INVALID_BOUNDARY_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
MISSING_BOUNDARY_SKILL="$TMP_DIR/missing-boundary-spec-mcp-setup"
cp -R "$REPO_ROOT/skills/spec-mcp-setup" "$MISSING_BOUNDARY_SKILL"
jq 'del(.tools[] | select(.id == "gitnexus") | .provider_config.native_capabilities.query.mutation_boundary)' "$MISSING_BOUNDARY_SKILL/mcp-tools.json" > "$MISSING_BOUNDARY_SKILL/mcp-tools.json.tmp"
mv "$MISSING_BOUNDARY_SKILL/mcp-tools.json.tmp" "$MISSING_BOUNDARY_SKILL/mcp-tools.json"
MISSING_BOUNDARY_REPO="$TMP_DIR/missing-boundary-repo"
make_repo "$MISSING_BOUNDARY_REPO"
printf 'missing boundary fixture\n' > "$MISSING_BOUNDARY_REPO/README.md"
git -C "$MISSING_BOUNDARY_REPO" add README.md
git -C "$MISSING_BOUNDARY_REPO" commit -q -m "Add missing boundary fixture"
MISSING_BOUNDARY_FACTS="$TMP_DIR/missing-boundary-facts.json"
jq --arg repo_root "$MISSING_BOUNDARY_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
' "$CUSTOM_TAG_FACTS" > "$MISSING_BOUNDARY_FACTS"
missing_boundary_log="$TMP_DIR/missing-boundary.log"
if bash "$MISSING_BOUNDARY_SKILL/scripts/write-provider-config.sh" --facts-file "$MISSING_BOUNDARY_FACTS" >"$missing_boundary_log" 2>&1; then
  echo "FAIL: GitNexus setup projection rejects missing mutation_boundary field" >&2
  exit 1
fi
assert_contains "GitNexus setup projection rejects missing mutation_boundary field" "invalid_gitnexus_mutation_boundary:missing-field" "$(cat "$missing_boundary_log")"
assert_eq "GitNexus missing mutation boundary projection does not write provider config" "false" "$(test -f "$MISSING_BOUNDARY_REPO/.spec-first/config/graph-providers.json" && echo true || echo false)"
assert_eq "GitNexus ready setup projection stays setup-inferred configured-and-detected" "true" "$(jq -r '.providers.gitnexus.native_capabilities | all(.[]; .source_provenance == "configured-and-detected")' "$PROVIDER_CONFIG")"
DISABLED_PROVIDER_REPO="$TMP_DIR/disabled-provider-repo"
make_repo "$DISABLED_PROVIDER_REPO"
printf 'disabled provider fixture\n' > "$DISABLED_PROVIDER_REPO/README.md"
git -C "$DISABLED_PROVIDER_REPO" add README.md
git -C "$DISABLED_PROVIDER_REPO" commit -q -m "Add disabled provider fixture"
DISABLED_PROVIDER_FACTS="$TMP_DIR/disabled-provider-facts.json"
jq --arg repo_root "$DISABLED_PROVIDER_REPO" '
  .repo_root = $repo_root
  | .selected_repo_root = $repo_root
  | .graph_providers.gitnexus.enabled_for_bootstrap = false
' "$CUSTOM_TAG_FACTS" > "$DISABLED_PROVIDER_FACTS"
bash "$SCRIPTS_DIR/write-provider-config.sh" --facts-file "$DISABLED_PROVIDER_FACTS" > /dev/null
DISABLED_PROVIDER_CONFIG="$DISABLED_PROVIDER_REPO/.spec-first/config/graph-providers.json"
assert_eq "GitNexus disabled provider projection is unavailable and not detected" "unavailable:configured-not-verified" "$(jq -r '.providers.gitnexus.native_capabilities.query | "\(.status):\(.source_provenance)"' "$DISABLED_PROVIDER_CONFIG")"
assert_eq "GitNexus workspace group projection remains read-only and resource surfaced" "available:read-only:group_list:false:true" "$(jq -r '.providers.gitnexus.native_capabilities.workspace_group | "\(.status):\(.mutation_boundary):\(.native_tools | join(",")):\((.native_tools + .native_resources | index("group_sync")) != null):\(.native_resources | index("gitnexus://group/{name}/contracts") != null)"' "$PROVIDER_CONFIG")"
assert_eq "runtime capabilities points to host ledger" "$LEDGER_PATH" "$(jq -r '.host_ledger_pointer.path' "$RUNTIME_CAPABILITIES")"
assert_eq "runtime capabilities starts not bootstrapped" "not-bootstrapped" "$(jq -r '.project_graph_readiness.status' "$RUNTIME_CAPABILITIES")"
assert_eq "runtime GitNexus capability discovery keys match provider projection" "context,cypher,impact,query,repo_registry,route_api_evidence,shape_check,tool_map,workspace_group" "$(jq -r '.gitnexus_capability_discovery.capabilities | keys | sort | join(",")' "$RUNTIME_CAPABILITIES")"
assert_eq "runtime GitNexus capability discovery is not query-ready graph evidence" "not-bootstrapped:available:true" "$(jq -r '.project_graph_readiness.status as $readiness | .gitnexus_capability_discovery.capabilities.query.status as $query_status | "\($readiness):\($query_status):\(.gitnexus_capability_discovery.capability_status_semantics | contains("not query-ready graph evidence"))"' "$RUNTIME_CAPABILITIES")"
assert_eq "runtime GitNexus capability discovery does not restate command arrays" "true" "$(jq -r '.gitnexus_capability_discovery | tostring | ((contains("query_probe") or contains("analyze --force") or contains("status --repo")) | not)' "$RUNTIME_CAPABILITIES")"
assert_eq "capability discovery avoids TTL freshness fields" "false:false" "$(jq -r '"\(.gitnexus_capability_discovery | has("capability_metadata_freshness")):\(.gitnexus_capability_discovery | has("expires_at"))"' "$RUNTIME_CAPABILITIES")"
assert_eq "provider artifacts use provider projection path" ".spec-first/providers/gitnexus/raw" "$(jq -r '.providers.gitnexus.raw_dir' "$PROVIDER_ARTIFACTS")"

setup_dirty_log_before="$(cat "$COMMAND_LOG")"
printf 'dirty\n' > "$FAKE_REPO/dirty-source.js"
setup_dirty_verify="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "dirty setup rerun keeps graph bootstrap handoff separate from plan probe" "Plan 阶段 live GitNexus evidence" "$setup_dirty_verify"
setup_dirty_log_after="$(cat "$COMMAND_LOG")"
setup_dirty_delta="${setup_dirty_log_after#"$setup_dirty_log_before"}"
assert_not_contains "dirty setup rerun does not run GitNexus analyze" "$GITNEXUS_PACKAGE analyze" "$setup_dirty_delta"
assert_not_contains "dirty setup rerun does not run GitNexus status" "$GITNEXUS_PACKAGE status" "$setup_dirty_delta"
assert_not_contains "dirty setup rerun does not run GitNexus query" "$GITNEXUS_PACKAGE query" "$setup_dirty_delta"
assert_not_contains "dirty setup rerun does not run GitNexus cypher" "$GITNEXUS_PACKAGE cypher" "$setup_dirty_delta"
assert_not_contains "dirty setup rerun does not run GitNexus group sync" "group_sync" "$setup_dirty_delta"
assert_not_contains "dirty setup rerun does not run provider repair" "repair" "$setup_dirty_delta"
rm -f "$FAKE_REPO/dirty-source.js"

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
set +e
codex_configure_crg_output="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/configure-host.sh" --tool code-review-graph 2>&1)"
codex_configure_crg_status=$?
set -e
assert_eq "configure-host rejects retired code-review-graph tool" "1" "$codex_configure_crg_status"
assert_contains "configure-host reports missing code-review-graph config" "未找到 code-review-graph 的 host_config" "$codex_configure_crg_output"
set +e
codex_uninstall_crg_output="$(cd "$FAKE_CODEX_REPO" && PATH="$TEST_PATH" HOME="$FAKE_CODEX_HOME" MCP_SETUP_HOST=codex bash "$SCRIPTS_DIR/uninstall-mcp.sh" --tool code-review-graph 2>&1)"
codex_uninstall_crg_status=$?
set -e
assert_eq "uninstall-mcp rejects retired code-review-graph tool" "1" "$codex_uninstall_crg_status"
assert_contains "uninstall-mcp reports missing code-review-graph definition" "未找到 code-review-graph 的工具定义" "$codex_uninstall_crg_output"
assert_contains "unsupported code-review-graph uninstall leaves legacy Codex MCP for manual cleanup" '[mcp_servers."code-review-graph"]' "$(cat "$codex_config")"
assert_contains "unsupported code-review-graph uninstall preserves following non-MCP table" '[profiles.default]' "$(cat "$codex_config")"
assert "CRG manual cleanup guidance exists" test -f "$REPO_ROOT/docs/05-用户手册/19-旧CRG残留手动清理指引.md"

printf '\n.spec-first/\n.gitnexus/\n.code-review-graph/\n' >> "$FAKE_REPO/.gitignore"
git -C "$FAKE_REPO" add .gitignore
git -C "$FAKE_REPO" commit -q -m "Prepare graph bootstrap fixture"

graph_log_before="$(cat "$COMMAND_LOG")"
bootstrap_output="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$GRAPH_BOOTSTRAP_SCRIPT")"
graph_log_after="$(cat "$COMMAND_LOG")"
assert "graph-bootstrap emits JSON" jq -e . <<<"$bootstrap_output"
assert_eq "graph-bootstrap result ready" "ready" "$(jq -r '.overall_status' <<<"$bootstrap_output")"
assert_contains "graph-bootstrap runs GitNexus analyze" "npx -y $GITNEXUS_PACKAGE analyze --force" "$graph_log_after"
assert_contains "graph-bootstrap uses GitNexus remote-derived repo label" "npx -y $GITNEXUS_PACKAGE query $GITNEXUS_QUERY_PROBE --repo $GITNEXUS_REPO_LABEL" "$graph_log_after"
assert_not_contains "graph-bootstrap does not run code-review-graph build" "code-review-graph build" "${graph_log_after#"$graph_log_before"}"
if [ "$graph_log_before" = "$graph_log_after" ]; then
  echo "FAIL: graph-bootstrap should run provider build commands" >&2
  exit 1
fi
assert_eq "graph-bootstrap writes GitNexus-only canonical provider readiness" "gitnexus:1" "$(jq -r '(.ready_primary_providers | join(",")) + ":" + (([.providers[] | select(.query_ready == true)] | length) | tostring)' "$FAKE_REPO/.spec-first/graph/provider-status.json")"
verify_after_bootstrap="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "repeat verify shows gitnexus row" "gitnexus" "$verify_after_bootstrap"
assert_contains "repeat verify shows graph provider query ready" "全局代码知识图谱与影响分析" "$verify_after_bootstrap"
assert_contains "repeat verify shows ready query and done bootstrap cells" "| ready | done" "$verify_after_bootstrap"
assert_contains "repeat verify summary lists ready GitNexus provider" "ready: gitnexus; pending: n/a" "$verify_after_bootstrap"
assert_contains "repeat verify reports graph provider query ready summary" "Graph providers are query-ready." "$verify_after_bootstrap"
assert_contains "repeat verify recommends intent workflow handoff" "graph readiness 已就绪" "$verify_after_bootstrap"
assert_contains "repeat verify allows direct task description after restart" "如果已经有明确任务，可以在新会话直接描述目标" "$verify_after_bootstrap"
if [[ "$verify_after_bootstrap" == *"Graph providers are configured but not query-ready yet."* ]]; then
  echo "FAIL: repeat verify should not say query-ready providers are pending" >&2
  exit 1
fi
assert_eq "repeat verify projects GitNexus query_ready from canonical artifacts" "true" "$(jq -r '.derived_readiness.providers.gitnexus.query_ready and (.derived_readiness.providers.gitnexus.bootstrap_required == false) and (.derived_readiness.providers | has("code-review-graph") | not)' "$PROVIDER_CONFIG")"
assert_eq "repeat verify projects runtime graph readiness summary" "primary:false:spec-mcp-setup" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required):\(.updated_by)"' "$RUNTIME_CAPABILITIES")"
assert_eq "repeat verify clears graph bootstrap next action" "false" "$(jq -r '.next_actions | index("run spec-graph-bootstrap") != null' "$LEDGER_PATH")"
assert_eq "repeat verify ledger graph bootstrap no longer required" "false" "$(jq -r '.graph_bootstrap_required' "$LEDGER_PATH")"

GRAPH_FACTS="$FAKE_REPO/.spec-first/graph/graph-facts.json"
PROVIDER_STATUS="$FAKE_REPO/.spec-first/graph/provider-status.json"
graph_facts_backup="$(cat "$GRAPH_FACTS")"
provider_status_backup="$(cat "$PROVIDER_STATUS")"
jq '.source_revision = "0000000000000000000000000000000000000000"' "$GRAPH_FACTS" > "$GRAPH_FACTS.tmp"
mv "$GRAPH_FACTS.tmp" "$GRAPH_FACTS"
verify_after_stale_source_revision="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "stale graph source revision requires graph bootstrap" "Graph providers are configured but not query-ready yet." "$verify_after_stale_source_revision"
assert_eq "stale graph source revision resets GitNexus readiness" "true" "$(jq -r '.derived_readiness.graph_bootstrap_required and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers | has("code-review-graph") | not)' "$PROVIDER_CONFIG")"
assert_eq "stale graph source revision resets runtime summary" "not-bootstrapped:true" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required)"' "$RUNTIME_CAPABILITIES")"
printf '%s\n' "$graph_facts_backup" > "$GRAPH_FACTS"

jq '.worktree_status_hash = "sha256:stale" | .staleness_hints.worktree_status_hash = "sha256:stale"' "$GRAPH_FACTS" > "$GRAPH_FACTS.tmp"
mv "$GRAPH_FACTS.tmp" "$GRAPH_FACTS"
verify_after_stale_worktree_hash="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "stale graph worktree hash requires graph bootstrap" "Graph providers are configured but not query-ready yet." "$verify_after_stale_worktree_hash"
assert_eq "stale graph worktree hash resets GitNexus readiness" "true" "$(jq -r '.derived_readiness.graph_bootstrap_required and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers | has("code-review-graph") | not)' "$PROVIDER_CONFIG")"
assert_eq "stale graph worktree hash resets runtime summary" "not-bootstrapped:true" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required)"' "$RUNTIME_CAPABILITIES")"
printf '%s\n' "$graph_facts_backup" > "$GRAPH_FACTS"
verify_after_restored_freshness="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "restored graph freshness projects query ready" "Graph providers are query-ready." "$verify_after_restored_freshness"
assert_eq "restored graph freshness restores runtime summary" "primary:false:spec-mcp-setup" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required):\(.updated_by)"' "$RUNTIME_CAPABILITIES")"

jq '
  .providers = (.providers | map(
    if .provider == "gitnexus" then
      .bootstrap_fingerprint.provider.command_hash = "sha256:stale"
    else . end
  ))
' "$PROVIDER_STATUS" > "$PROVIDER_STATUS.tmp"
mv "$PROVIDER_STATUS.tmp" "$PROVIDER_STATUS"
verify_after_stale_provider_fingerprint="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "stale provider fingerprint requires graph bootstrap" "Graph providers are configured but not query-ready yet." "$verify_after_stale_provider_fingerprint"
assert_eq "stale provider fingerprint invalidates GitNexus readiness" "true" "$(jq -r '.derived_readiness.graph_bootstrap_required and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers.gitnexus.bootstrap_required == true) and (.derived_readiness.providers | has("code-review-graph") | not)' "$PROVIDER_CONFIG")"
assert_eq "stale provider fingerprint prevents runtime primary readiness" "setup-ready-bootstrap-required:true" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required)"' "$RUNTIME_CAPABILITIES")"
printf '%s\n' "$provider_status_backup" > "$PROVIDER_STATUS"

jq '.workflow_mode = "degraded-fallback" | .confidence = "medium" | .generated_at = "2099-01-01T00:00:00Z"' "$GRAPH_FACTS" > "$GRAPH_FACTS.tmp"
mv "$GRAPH_FACTS.tmp" "$GRAPH_FACTS"
jq '.workflow_mode = "degraded-fallback" | .generated_at = "2099-01-01T00:00:00Z" | .providers = (.providers | map(if .provider == "gitnexus" then .query_ready = false | .status = "failed" else . end))' "$PROVIDER_STATUS" > "$PROVIDER_STATUS.tmp"
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
assert_eq "invalid canonical impact schema resets GitNexus readiness" "true" "$(jq -r '.derived_readiness.graph_bootstrap_required and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers | has("code-review-graph") | not)' "$PROVIDER_CONFIG")"
assert_eq "invalid canonical impact schema resets runtime summary" "not-bootstrapped:true" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required)"' "$RUNTIME_CAPABILITIES")"
printf '%s\n' "$impact_capabilities_backup" > "$IMPACT_CAPABILITIES"
verify_after_restored_impact="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "restored canonical impact artifact projects query ready" "Graph providers are query-ready." "$verify_after_restored_impact"
assert_eq "restored canonical impact artifact restores GitNexus readiness" "true" "$(jq -r '.derived_readiness.providers.gitnexus.query_ready and (.derived_readiness.providers.gitnexus.bootstrap_required == false) and (.derived_readiness.providers | has("code-review-graph") | not)' "$PROVIDER_CONFIG")"

rm -f "$FAKE_REPO/.spec-first/graph/graph-facts.json"
verify_after_missing_canonical="$(cd "$FAKE_REPO" && PATH="$TEST_PATH" HOME="$FAKE_HOME" MCP_SETUP_HOST=claude bash "$SCRIPTS_DIR/verify-tools.sh")"
assert_contains "missing canonical graph facts requires graph bootstrap" "Graph providers are configured but not query-ready yet." "$verify_after_missing_canonical"
assert_eq "missing canonical artifact resets GitNexus readiness" "true" "$(jq -r '.derived_readiness.graph_bootstrap_required and (.derived_readiness.providers.gitnexus.query_ready == false) and (.derived_readiness.providers | has("code-review-graph") | not)' "$PROVIDER_CONFIG")"
assert_eq "missing canonical artifact resets runtime summary" "not-bootstrapped:true" "$(jq -r '.project_graph_readiness | "\(.status):\(.graph_bootstrap_required)"' "$RUNTIME_CAPABILITIES")"

# R15e: spec-mcp-setup SKILL.md prose 在 graph_ready=pending 与 graph_ready=ready
# 双路径下都必须含 restart/new session 提示与 deterministic compilation 措辞,
# 防止未来 prose 改写吞掉 setup 的下一步引导。
mcp_setup_prose="$(cat "$REPO_ROOT/skills/spec-mcp-setup/SKILL.md")"
assert_contains "mcp-setup prose says graph bootstrap is deterministic CLI compilation (R15e)" "deterministic CLI compilation" "$mcp_setup_prose"
assert_contains "mcp-setup prose carries restart/new session caveat (R15e)" "重启 Claude Code/Codex 或新开会话" "$mcp_setup_prose"
assert_contains "mcp-setup prose mentions live MCP probe trigger (R15e)" "live MCP probe 前需要" "$mcp_setup_prose"
assert_contains "mcp-setup prose covers ready path with new-session option (R15e)" "restarted/new session" "$mcp_setup_prose"
assert_contains "mcp-setup prose covers pending path execution result table (R15e)" "Execution result" "$mcp_setup_prose"
assert_contains "mcp-setup prose covers Required Harness Runtime grouping (R15e)" "Required Harness Runtime" "$mcp_setup_prose"

echo "=== spec-mcp-setup required runtime tests passed ==="
