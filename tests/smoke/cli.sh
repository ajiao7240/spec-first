#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

export SPEC_FIRST_VERSION_REMINDER_LATEST="$(node -p "require('$REPO_ROOT/package.json').version")"
expected_version="$SPEC_FIRST_VERSION_REMINDER_LATEST"
expected_command_count="$(find "$REPO_ROOT/templates/claude/commands/spec" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')"
expected_agent_count="$(find "$REPO_ROOT/agents" -type f -name '*.md' | wc -l | tr -d ' ')"
expected_workflow_skill_count="$(node - "$REPO_ROOT" <<'NODE'
const repoRoot = process.argv[2];
const { buildFilteredAssetSet } = require(`${repoRoot}/src/cli/plugin`);
process.stdout.write(String(buildFilteredAssetSet('claude').workflowSkills.length));
NODE
)"
expected_claude_skill_count="$(node - "$REPO_ROOT" <<'NODE'
const repoRoot = process.argv[2];
const { buildFilteredAssetSet } = require(`${repoRoot}/src/cli/plugin`);
const claude = buildFilteredAssetSet('claude');
process.stdout.write(String(claude.skills.length + claude.internalSkills.length));
NODE
)"
expected_codex_total_skill_count="$(node - "$REPO_ROOT" <<'NODE'
const repoRoot = process.argv[2];
const { buildFilteredAssetSet } = require(`${repoRoot}/src/cli/plugin`);
const codex = buildFilteredAssetSet('codex');
process.stdout.write(String(codex.skills.length + codex.workflowSkills.length + codex.internalSkills.length));
NODE
)"

echo "=== CLI smoke test ==="

echo "1. Check help and version output..."
help_output="$(node "$REPO_ROOT/bin/spec-first.js" --help)"
version_output="$(node "$REPO_ROOT/bin/spec-first.js" --version)"
grep -q "doctor" <<<"$help_output"
grep -q "init (--claude|--codex)" <<<"$help_output"
grep -q "clean (--claude|--codex)" <<<"$help_output"
grep -q "tasks <subcommand>" <<<"$help_output"
grep -q "gitnexus-instruction" <<<"$help_output"
if grep -q "crg <subcommand>" <<<"$help_output"; then
  echo "help output should not advertise retired graph command" >&2
  exit 1
fi
if grep -q "stage0-context" <<<"$help_output"; then
  echo "help output should not advertise stage0-context" >&2
  exit 1
fi
grep -q "Spec-First v${expected_version}" <<<"$version_output"
grep -q "Claude Code & Codex" <<<"$version_output"
if grep -q "graph""-bootstrap" <<<"$version_output"; then
  echo "version output should not advertise retired graph workflow" >&2
  exit 1
fi
retired_stdout="$TMP_DIR/retired-command.stdout"
retired_stderr="$TMP_DIR/retired-command.stderr"
if node "$REPO_ROOT/bin/spec-first.js" crg --help >"$retired_stdout" 2>"$retired_stderr"; then
  retired_status=0
else
  retired_status=$?
fi
retired_combined="$(cat "$retired_stdout" "$retired_stderr")"
if [ "$retired_status" -eq 0 ]; then
  echo "retired graph command should not exit successfully" >&2
  exit 1
fi
if ! grep -Eiq "unknown command|unknown|unsupported|invalid" <<<"$retired_combined"; then
  echo "retired graph command should use normal unknown-command path" >&2
  exit 1
fi
if grep -q "src/""crg" <<<"$retired_combined" || grep -q "crg <subcommand>" <<<"$retired_combined"; then
  echo "retired graph command output leaks old implementation details" >&2
  exit 1
fi
echo "✓ help/version output is present"

echo "2. Check doctor output in a fresh project..."
doctor_fresh_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor)"
grep -q "No spec-first platform detected in this project." <<<"$doctor_fresh_output"
grep -q 'spec-first init --claude' <<<"$doctor_fresh_output"
grep -q 'spec-first init --codex' <<<"$doctor_fresh_output"
doctor_fresh_json="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor --json)"
node - "$doctor_fresh_json" <<'NODE'
const payload = JSON.parse(process.argv[2]);
if (payload.workflow_runnability !== 'not_verified') throw new Error('fresh doctor runnability mismatch');
if (payload.runtime_asset_health !== 'not_applicable') throw new Error('fresh doctor asset health mismatch');
NODE
echo "✓ doctor reports fresh-project state"

echo "3. Check init --dry-run previews changes without writing files..."
dry_dir="$TMP_DIR/dry-init"
mkdir -p "$dry_dir/.claude/commands/spec"
git -C "$dry_dir" init -q >/dev/null
printf 'custom command\n' > "$dry_dir/.claude/commands/spec/custom.md"
dry_output="$(cd "$dry_dir" && node "$REPO_ROOT/bin/spec-first.js" init --claude --dry-run -u kuang --lang en)"
grep -q "Dry run: spec-first init (claude)" <<<"$dry_output"
grep -q "Would prune 1 unmanaged command file(s)" <<<"$dry_output"
grep -q "No managed runtime paths require untracking." <<<"$dry_output"
grep -q ".gitignore" <<<"$dry_output"
grep -q "No files were changed." <<<"$dry_output"
test -e "$dry_dir/.claude/commands/spec/custom.md"
test ! -e "$dry_dir/.claude/spec-first/state.json"
test ! -e "$dry_dir/.gitignore"
echo "✓ init --dry-run previews changes without writing files"

echo "4. Initialize Claude runtime in a fresh project..."
claude_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang en)"
grep -q "Generated ${expected_command_count} command file(s)" <<<"$claude_output"
grep -q "Generated ${expected_claude_skill_count} skill directory(ies)" <<<"$claude_output"
grep -q "Generated ${expected_agent_count} agent file(s)" <<<"$claude_output"
for file in brainstorm.md code-review.md compound.md compound-refresh.md debug.md doc-review.md graph-bootstrap.md ideate.md mcp-setup.md optimize.md plan.md polish-beta.md release-notes.md sessions.md slack-research.md update.md work.md; do
  test -f "$TMP_DIR/.claude/commands/spec/$file"
done
test ! -e "$TMP_DIR/.claude/commands/spec/"standards".md"
test -f "$TMP_DIR/.claude/spec-first/workflows/spec-mcp-setup/scripts/check-health"
grep -q 'bash .claude/spec-first/workflows/spec-mcp-setup/scripts/check-health' "$TMP_DIR/.claude/commands/spec/mcp-setup.md"
if grep -q 'bash skills/spec-mcp-setup/scripts/check-health' "$TMP_DIR/.claude/commands/spec/mcp-setup.md"; then
  echo "Claude mcp-setup command should not reference source-only skill script paths" >&2
  exit 1
fi
installed_claude_skill_count="$(find "$TMP_DIR/.claude/skills" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
test "$installed_claude_skill_count" = "$expected_claude_skill_count"
test -f "$TMP_DIR/.claude/skills/using-spec-first/SKILL.md"
grep -q '^name: using-spec-first$' "$TMP_DIR/.claude/skills/using-spec-first/SKILL.md"
test -f "$TMP_DIR/.claude/skills/git-worktree/SKILL.md"
test -f "$TMP_DIR/.claude/skills/git-worktree/scripts/worktree-manager.sh"
grep -q '^name: git-worktree$' "$TMP_DIR/.claude/skills/git-worktree/SKILL.md"
grep -q '^user-invocable: false$' "$TMP_DIR/.claude/skills/git-worktree/SKILL.md"
grep -q 'allowed-tools: Bash(bash \*worktree-manager.sh\*)' "$TMP_DIR/.claude/skills/git-worktree/SKILL.md"
grep -q '.claude/skills/git-worktree/scripts/worktree-manager.sh' "$TMP_DIR/.claude/skills/git-worktree/SKILL.md"
test ! -e "$TMP_DIR/.claude/skills/spec-session-inventory"
test ! -e "$TMP_DIR/.claude/skills/spec-session-extract"
for agent in spec-repo-research-analyst.agent.md spec-session-historian.agent.md spec-slack-researcher.agent.md spec-spec-flow-analyzer.agent.md; do
  test -f "$TMP_DIR/.claude/agents/$agent"
done
node - "$TMP_DIR/.claude/spec-first/state.json" "$expected_command_count" "$expected_claude_skill_count" "$expected_workflow_skill_count" "$expected_agent_count" <<'NODE'
const fs = require('node:fs');
const [statePath, commandCount, skillCount, workflowSkillCount, agentCount] = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (state.commands.length !== Number(commandCount)) throw new Error('command count mismatch');
if (state.skills.length !== Number(skillCount)) throw new Error('skill count mismatch');
if (state.workflowSkills.length !== Number(workflowSkillCount)) throw new Error('workflow skill count mismatch');
if (!state.workflowSkills.includes('spec-mcp-setup')) throw new Error('missing Claude mcp-setup workflow support asset');
if (state.agents.length !== Number(agentCount)) throw new Error('agent count mismatch');
if (state.developer.name !== 'kuang' || state.developer.lang !== 'en') throw new Error('developer profile mismatch');
NODE
grep -q '<!-- spec-first:lang:start -->' "$TMP_DIR/CLAUDE.md"
grep -q '<!-- spec-first:bootstrap:start -->' "$TMP_DIR/CLAUDE.md"
grep -q 'workspace-graph-targets.v1' "$TMP_DIR/CLAUDE.md"
grep -q '<!-- spec-first:coding-guidelines:start -->' "$TMP_DIR/CLAUDE.md"
test -f "$TMP_DIR/.claude/hooks/session-start"
grep -q 'startup-reminder' "$TMP_DIR/.claude/hooks/session-start"
grep -q -- '--claude' "$TMP_DIR/.claude/hooks/session-start"
test -f "$TMP_DIR/.gitignore"
grep -q '# spec-first:start' "$TMP_DIR/.gitignore"
grep -q '.claude/commands/spec/' "$TMP_DIR/.gitignore"
if grep -q ".spec-first/"standards"/" "$TMP_DIR/.gitignore"; then
  echo "init gitignore should not preserve retired standards artifact root" >&2
  exit 1
fi
if grep -qxF '.spec-first/' "$TMP_DIR/.gitignore" || grep -qxF '.agents/' "$TMP_DIR/.gitignore"; then
  echo "init gitignore should not hide broad source/runtime roots" >&2
  exit 1
fi
echo "✓ Claude init generated commands, skills, agents, hooks, and state"

echo "5. Run doctor after Claude initialization..."
doctor_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor --claude)"
grep -q ".claude/spec-first/state.json" <<<"$doctor_output"
grep -q ".claude/commands/spec" <<<"$doctor_output"
grep -q ".claude/skills" <<<"$doctor_output"
grep -q ".claude/agents" <<<"$doctor_output"
doctor_json="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor --claude --json)"
node - "$doctor_json" <<'NODE'
const payload = JSON.parse(process.argv[2]);
if (!['simulated', 'verified', 'not_verified'].includes(payload.workflow_runnability)) {
  throw new Error(`unexpected runnability ${payload.workflow_runnability}`);
}
if (!['pass', 'warn', 'error'].includes(payload.runtime_asset_health)) {
  throw new Error(`unexpected asset health ${payload.runtime_asset_health}`);
}
if (!payload.platform_checks?.claude?.length) throw new Error('missing claude checks');
NODE
echo "✓ doctor reports Claude runtime facts"

echo "6. Initialize Codex runtime and verify assets..."
codex_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" init --codex -u kuang --lang en)"
grep -q "Generated ${expected_agent_count} agent file(s) in .codex/agents" <<<"$codex_output"
grep -q "Generated ${expected_codex_total_skill_count} skill directory(ies) in .agents/skills" <<<"$codex_output"
installed_codex_skill_count="$(find "$TMP_DIR/.agents/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
test "$installed_codex_skill_count" = "$expected_codex_total_skill_count"
for skill in spec-plan spec-work spec-code-review spec-doc-review spec-brainstorm spec-graph-bootstrap spec-mcp-setup spec-compound-refresh; do
  test -f "$TMP_DIR/.agents/skills/$skill/SKILL.md"
done
test ! -e "$TMP_DIR/.agents/skills/spec-"standards"/SKILL.md"
test ! -e "$TMP_DIR/.agents/skills/spec-work-beta/SKILL.md"
test -f "$TMP_DIR/.agents/skills/using-spec-first/SKILL.md"
grep -q '^name: using-spec-first$' "$TMP_DIR/.agents/skills/using-spec-first/SKILL.md"
grep -q '^name: spec-polish-beta$' "$TMP_DIR/.agents/skills/spec-polish-beta/SKILL.md"
test -f "$TMP_DIR/.agents/skills/git-worktree/SKILL.md"
test -f "$TMP_DIR/.agents/skills/git-worktree/scripts/worktree-manager.sh"
grep -q '^name: git-worktree$' "$TMP_DIR/.agents/skills/git-worktree/SKILL.md"
grep -q '^user-invocable: false$' "$TMP_DIR/.agents/skills/git-worktree/SKILL.md"
grep -q 'allowed-tools: Bash(bash \*worktree-manager.sh\*)' "$TMP_DIR/.agents/skills/git-worktree/SKILL.md"
grep -q '.agents/skills/git-worktree/scripts/worktree-manager.sh' "$TMP_DIR/.agents/skills/git-worktree/SKILL.md"
test ! -e "$TMP_DIR/.agents/skills/spec-session-inventory"
test ! -e "$TMP_DIR/.agents/skills/spec-session-extract"
for agent in spec-repo-research-analyst.agent.md spec-session-historian.agent.md spec-slack-researcher.agent.md; do
  test -f "$TMP_DIR/.codex/agents/$agent"
done
grep -q '<!-- spec-first:lang:start -->' "$TMP_DIR/AGENTS.md"
grep -q '<!-- spec-first:bootstrap:start -->' "$TMP_DIR/AGENTS.md"
grep -q 'workspace-graph-targets.v1' "$TMP_DIR/AGENTS.md"
grep -q '<!-- spec-first:coding-guidelines:start -->' "$TMP_DIR/AGENTS.md"
grep -q 'spec-first startup-reminder --codex' "$TMP_DIR/AGENTS.md"
grep -q 'must not block routing' "$TMP_DIR/AGENTS.md"
grep -q 'bounded subagents, leaf reviewers, and worker agents' "$TMP_DIR/AGENTS.md"
grep -q '.agents/skills/' "$TMP_DIR/.gitignore"
echo "✓ Codex init generated skills, agents, and AGENTS.md"

echo "7. Verify clean dry-run and clean removal..."
clean_dry="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" clean --claude --dry-run)"
grep -q "Dry run: spec-first clean (claude)" <<<"$clean_dry"
grep -q "No files were changed." <<<"$clean_dry"
test -d "$TMP_DIR/.claude/spec-first"
(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" clean --claude >/dev/null)
test ! -d "$TMP_DIR/.claude/spec-first"
test ! -d "$TMP_DIR/.claude/commands/spec"
echo "✓ clean removes managed Claude runtime"

echo "=== CLI smoke test passed ✓ ==="
