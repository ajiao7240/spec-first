#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== CLI smoke test ==="

expected_version="$(node -p "require('$REPO_ROOT/package.json').version")"
expected_version_regex="${expected_version//./\\.}"
outdated_version="9.9.9"
expected_command_count="$(node -p "require('$REPO_ROOT/.claude-plugin/plugin.json').commands.length")"
expected_skill_count="$(find "$REPO_ROOT/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
export SPEC_FIRST_VERSION_REMINDER_LATEST="$expected_version"

echo "1. Check help and version output..."
help_stderr="$TMP_DIR/help.err"
version_stderr="$TMP_DIR/version.err"
help_output="$(node "$REPO_ROOT/bin/spec-first.js" --help 2>"$help_stderr")"
version_output="$(node "$REPO_ROOT/bin/spec-first.js" --version 2>"$version_stderr")"
grep -q "doctor" <<<"$help_output"
grep -q "init (--claude|--codex)" <<<"$help_output"
grep -q "clean (--claude|--codex)" <<<"$help_output"
grep -q "Spec-First v${expected_version}" <<<"$version_output"
grep -q "Claude Code & Codex" <<<"$version_output"
test ! -s "$help_stderr"
test ! -s "$version_stderr"
echo "✓ help/version output is present"

echo "1b. Check doctor output in a fresh project is concise..."
doctor_fresh_stderr="$TMP_DIR/doctor-fresh.err"
doctor_fresh_output="$(
  cd "$TMP_DIR"
  SPEC_FIRST_VERSION_REMINDER_LATEST="$outdated_version" node "$REPO_ROOT/bin/spec-first.js" doctor 2>"$doctor_fresh_stderr"
)"
grep -q "No spec-first platform detected in this project." <<<"$doctor_fresh_output"
grep -q 'spec-first init --claude' <<<"$doctor_fresh_output"
grep -q 'spec-first init --codex' <<<"$doctor_fresh_output"
if grep -q "agent-browser" <<<"$doctor_fresh_output"; then
  echo "✗ doctor output is too noisy for missing skills"
  exit 1
fi
grep -q "Update available for spec-first" "$doctor_fresh_stderr"
grep -q "npm install -g spec-first@latest" "$doctor_fresh_stderr"
echo "✓ doctor reports missing skills concisely"

echo "2. Initialize Claude commands in a fresh project..."
init_stderr="$TMP_DIR/init.err"
init_output="$(
  cd "$TMP_DIR"
  SPEC_FIRST_VERSION_REMINDER_LATEST="$outdated_version" node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang en 2>"$init_stderr"
)"
grep -q "Generated ${expected_command_count} command file(s)" <<<"$init_output"
grep -q "Generated ${expected_skill_count} skill directory(ies)" <<<"$init_output"
grep -q "Generated 47 agent file(s)" <<<"$init_output"
grep -q "Wrote project developer profile" <<<"$init_output"
grep -q "Update available for spec-first" "$init_stderr"
grep -q "npm install -g spec-first@latest" "$init_stderr"
if grep -qE '^- |  - ' <<<"$init_output"; then
  echo "✗ init output should not enumerate per-file details"
  exit 1
fi
if grep -q "brainstorm.md" <<<"$init_output"; then
  echo "✗ init output should not list individual command filenames"
  exit 1
fi
if grep -q "ideate.md" <<<"$init_output"; then
  echo "✗ init output should not list individual command filenames"
  exit 1
fi
if grep -q "bootstrap.md" <<<"$init_output"; then
  echo "✗ init output should not list individual command filenames"
  exit 1
fi

for file in ideate.md brainstorm.md plan.md work.md review.md compound.md bootstrap.md; do
  test -f "$TMP_DIR/.claude/commands/spec/$file"
done
grep -q "Spec-First Ideate" "$TMP_DIR/.claude/commands/spec/ideate.md"
grep -q "Spec-First Brainstorm" "$TMP_DIR/.claude/commands/spec/brainstorm.md"
grep -q '.claude/skills/spec-ideate/SKILL.md' "$TMP_DIR/.claude/commands/spec/ideate.md"
grep -q "Spec-First Plan" "$TMP_DIR/.claude/commands/spec/plan.md"
grep -q "Spec-First Work" "$TMP_DIR/.claude/commands/spec/work.md"
grep -q "Spec-First Review" "$TMP_DIR/.claude/commands/spec/review.md"
grep -q "Spec-First Compound" "$TMP_DIR/.claude/commands/spec/compound.md"
grep -q "Spec-First Bootstrap" "$TMP_DIR/.claude/commands/spec/bootstrap.md"
grep -q '.claude/skills/spec-brainstorm/SKILL.md' "$TMP_DIR/.claude/commands/spec/brainstorm.md"
grep -q '.claude/skills/spec-plan/SKILL.md' "$TMP_DIR/.claude/commands/spec/plan.md"
grep -q '.claude/skills/spec-bootstrap/SKILL.md' "$TMP_DIR/.claude/commands/spec/bootstrap.md"
test -f "$TMP_DIR/.claude/skills/spec-bootstrap/SKILL.md"
grep -q '^name: spec-bootstrap$' "$TMP_DIR/.claude/skills/spec-bootstrap/SKILL.md"
grep -q 'serena-not-mounted-in-session' "$TMP_DIR/.claude/skills/spec-bootstrap/SKILL.md"
grep -q '不代表 Serena 已挂载' "$TMP_DIR/.claude/skills/spec-bootstrap/SKILL.md"
test -f "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
grep -q 'mcp__serena__get_symbols_overview' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
! grep -q 'get_package_structure' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
grep -q 'mcp__serena__get_symbols_overview' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
grep -q 'Example Call' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
test -f "$TMP_DIR/.claude/skills/spec-bootstrap/references/database-prd-template.md"
test -f "$TMP_DIR/.claude/spec-first/.developer"
grep -q '^name=kuang$' "$TMP_DIR/.claude/spec-first/.developer"
grep -q '^lang=en$' "$TMP_DIR/.claude/spec-first/.developer"
grep -q '^initialized_at=' "$TMP_DIR/.claude/spec-first/.developer"
grep -q "^version=${expected_version}$" "$TMP_DIR/.claude/spec-first/.developer"
node - "$TMP_DIR/.claude/spec-first/state.json" <<'EOF'
const fs = require('node:fs');
const statePath = process.argv[2];
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (!state.developer || state.developer.name !== 'kuang' || state.developer.lang !== 'en') {
  console.error('state.json does not record the project developer profile');
  process.exit(1);
}
EOF
echo "✓ init generated all /spec:* command files"

echo "2a-1. Verify source assets use the current spec-first branding and naming..."
for file in \
  "$REPO_ROOT/skills/spec-ideate/SKILL.md" \
  "$REPO_ROOT/skills/spec-work-beta/SKILL.md" \
  "$REPO_ROOT/skills/spec-compound-refresh/SKILL.md" \
  "$REPO_ROOT/skills/report-bug/SKILL.md"
do
  test -f "$file"
done
if grep -R -n -E 'EveryInc/spec-first-plugin|Compound Engineering v\[VERSION\]|Report a Compound Engineering Plugin Bug|report-bug-ce' \
  "$REPO_ROOT/skills/spec-work/SKILL.md" \
  "$REPO_ROOT/skills/spec-work-beta/SKILL.md" \
  "$REPO_ROOT/skills/git-commit-push-pr/SKILL.md" \
  "$REPO_ROOT/skills/report-bug/SKILL.md"; then
  echo "✗ source assets still contain old branding or legacy bug-report references"
  exit 1
fi
for file in \
  "$REPO_ROOT/skills/spec-ideate/SKILL.md" \
  "$REPO_ROOT/skills/spec-work-beta/SKILL.md" \
  "$REPO_ROOT/skills/spec-compound-refresh/SKILL.md"
do
  if grep -q '^name: spec:' "$file"; then
    echo "✗ $(basename "$(dirname "$file")") should use an internal workflow name in source assets"
    exit 1
  fi
done
echo "✓ source assets use current branding and internal workflow names"

echo "2b. Verify skill directories were installed..."
installed_skill_count="$(find "$TMP_DIR/.claude/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
test "$installed_skill_count" = "$expected_skill_count"
for skill in spec-plan spec-review spec-work document-review git-worktree; do
  test -f "$TMP_DIR/.claude/skills/$skill/SKILL.md"
done
for skill in spec-brainstorm spec-plan spec-work spec-review spec-compound; do
  if grep -q "^user-invocable: true$" "$TMP_DIR/.claude/skills/$skill/SKILL.md"; then
    echo "✗ $skill should not be exposed as a standalone slash command"
    exit 1
  fi
done
for skill in spec-ideate spec-work-beta spec-compound-refresh; do
  if grep -q "^name: spec:" "$TMP_DIR/.claude/skills/$skill/SKILL.md"; then
    echo "✗ $skill should use an internal workflow name instead of a public spec:* skill name"
    exit 1
  fi
done
echo "✓ init generated all bundled skill directories"

echo "2b-1. Verify generated runtime assets adapt fully qualified agent names..."
grep -q 'Task repo-research-analyst' "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"
grep -q 'Task spec-flow-analyzer' "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"
grep -q '`coherence-reviewer`' "$TMP_DIR/.claude/skills/document-review/SKILL.md"
grep -q 'Spawn a `pr-comment-resolver` agent' "$TMP_DIR/.claude/skills/resolve-pr-feedback/SKILL.md"
grep -q 'Use bare agent names inside Task calls.' "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"
grep -q 'spec-first:research:learnings-researcher' "$TMP_DIR/.claude/agents/review/project-standards-reviewer.md"
if grep -q 'spec-first:research:repo-research-analyst' "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"; then
  echo "✗ generated spec-plan skill still contains unadapted spec-first agent namespace"
  exit 1
fi
if grep -Eq 'Task [a-z-]+:[a-z-]+\(' "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"; then
  echo "✗ generated spec-plan skill still contains grouped runtime Task agent names"
  exit 1
fi
if grep -Eq 'subagent_type: "[a-z-]+:[a-z-]+"' "$TMP_DIR/.claude/skills/orchestrating-swarms/SKILL.md"; then
  echo "✗ generated Claude skills still contain grouped runtime subagent_type values"
  exit 1
fi
echo "✓ generated runtime assets adapt fully qualified agent names"

echo "2c. Verify agent files were installed..."
expected_agent_count="$(find "$REPO_ROOT/agents" -type f -name '*.md' | wc -l | tr -d ' ')"
installed_agent_count="$(find "$TMP_DIR/.claude/agents" -type f -name '*.md' | wc -l | tr -d ' ')"
test "$installed_agent_count" = "$expected_agent_count"
for agent in \
  review/correctness-reviewer.md \
  research/repo-research-analyst.md \
  workflow/spec-flow-analyzer.md
do
  test -f "$TMP_DIR/.claude/agents/$agent"
done
echo "✓ init generated all bundled agent files"

echo "2d. Re-run init and verify it overwrites existing files..."
printf 'local edit\n' >> "$TMP_DIR/.claude/commands/spec/brainstorm.md"
(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang en
)
grep -q "Spec-First Brainstorm" "$TMP_DIR/.claude/commands/spec/brainstorm.md"
if grep -q "local edit" "$TMP_DIR/.claude/commands/spec/brainstorm.md"; then
  echo "✗ init did not overwrite existing command files"
  exit 1
fi
echo "✓ init overwrites existing command files by default"

echo "2e. Verify init prunes stale managed assets without touching unrelated custom assets..."
mkdir -p "$TMP_DIR/.claude/skills/obsolete-skill" "$TMP_DIR/.claude/agents/obsolete" "$TMP_DIR/.claude/skills/custom-skill"
printf 'stale command\n' > "$TMP_DIR/.claude/commands/spec/obsolete.md"
printf 'stale skill\n' > "$TMP_DIR/.claude/skills/obsolete-skill/SKILL.md"
printf 'stale agent\n' > "$TMP_DIR/.claude/agents/obsolete/ghost.md"
printf 'custom skill\n' > "$TMP_DIR/.claude/skills/custom-skill/SKILL.md"
node - "$TMP_DIR/.claude/spec-first/state.json" <<'EOF'
const fs = require('node:fs');
const statePath = process.argv[2];
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
state.commands.push('obsolete.md');
state.skills.push('obsolete-skill');
state.agents.push('obsolete/ghost.md');
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
EOF
(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang en
)
test ! -e "$TMP_DIR/.claude/commands/spec/obsolete.md"
test ! -e "$TMP_DIR/.claude/skills/obsolete-skill/SKILL.md"
test ! -e "$TMP_DIR/.claude/agents/obsolete/ghost.md"
test -e "$TMP_DIR/.claude/skills/custom-skill/SKILL.md"
echo "✓ init prunes stale managed assets and preserves custom assets"

echo "3. Run doctor after initialization..."
doctor_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor)"
grep -q "PASS" <<<"$doctor_output"
grep -q "PASS    .claude/spec-first/.developer" <<<"$doctor_output"
grep -q ".claude/spec-first/state.json" <<<"$doctor_output"
grep -q ".claude/commands/spec" <<<"$doctor_output"
grep -q ".claude/skills" <<<"$doctor_output"
grep -q ".claude/agents" <<<"$doctor_output"
echo "✓ doctor reports generated commands, skills, and agents"

echo "3a. Verify doctor catches broken Claude runtime agent references..."
printf '\n- Task research:repo-research-analyst(test mismatch)\n' >> "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"
if (
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" doctor --claude >"$TMP_DIR/doctor-broken.txt" 2>&1
); then
  echo "✗ doctor should fail when Claude runtime Task references do not match installed agent names"
  exit 1
fi
grep -q "ERROR   Claude Task agent references" "$TMP_DIR/doctor-broken.txt"
grep -q "spec-plan/SKILL.md -> research:repo-research-analyst" "$TMP_DIR/doctor-broken.txt"
(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang en >/dev/null
)
echo "✓ doctor catches Claude runtime agent reference drift"

echo "3a-2. Verify CLAUDE.md lang policy block was written..."
grep -q '<!-- spec-first:lang:start -->' "$TMP_DIR/CLAUDE.md"
grep -q '<!-- spec-first:lang:end -->' "$TMP_DIR/CLAUDE.md"
# Last init used --lang en, so English directive must be present
grep -q 'English' "$TMP_DIR/CLAUDE.md"
# Changelog governance rule must be present
grep -q 'CHANGELOG' "$TMP_DIR/CLAUDE.md"
# Changelog iron law must refuse code generation without a record
grep -q 'refuse to generate' "$TMP_DIR/CLAUDE.md"
# Governance file commit rule must be absent
! grep -q 'Governance File Commit Rule' "$TMP_DIR/CLAUDE.md"
# Exactly one start marker (idempotent across multiple inits)
lang_marker_count=$(grep -c '<!-- spec-first:lang:start -->' "$TMP_DIR/CLAUDE.md")
[ "$lang_marker_count" = "1" ]
# CHANGELOG.md bootstrapped
test -f "$TMP_DIR/CHANGELOG.md"
grep -q -- '- 记录格式：`- v版本号 YYYY-MM-DD HH:MM:SS 作者: 变更摘要 \[(user-visible)\]`' "$TMP_DIR/CHANGELOG.md"
grep -q '`变更摘要` 使用中文，简明说明本次改动' "$TMP_DIR/CHANGELOG.md"
grep -q '日期时间必须使用 `YYYY-MM-DD HH:MM:SS`' "$TMP_DIR/CHANGELOG.md"
grep -Eq -- "- v${expected_version_regex} [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} " "$TMP_DIR/CHANGELOG.md"
grep -q 'kuang' "$TMP_DIR/CHANGELOG.md"
grep -q '使用 spec-first 初始化项目' "$TMP_DIR/CHANGELOG.md"
echo "✓ CLAUDE.md lang policy block written; CHANGELOG.md bootstrapped"

echo "3a-1. Verify Codex init/doctor/clean work..."
codex_output="$(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" init --codex -u kuang --lang en
)"
grep -q "Generated ${expected_command_count} command file(s) in .codex/commands/spec" <<<"$codex_output"
grep -q "Generated ${expected_skill_count} skill directory(ies) in .agents/skills" <<<"$codex_output"
grep -q "Generated 47 agent file(s) in .codex/agents" <<<"$codex_output"
for file in ideate.md brainstorm.md plan.md work.md review.md compound.md bootstrap.md mcp-setup.md; do
  test -f "$TMP_DIR/.codex/commands/spec/$file"
done
grep -q "Spec-First Ideate" "$TMP_DIR/.codex/commands/spec/ideate.md"
grep -q "Spec-First Brainstorm" "$TMP_DIR/.codex/commands/spec/brainstorm.md"
grep -q '.agents/skills/spec-bootstrap/SKILL.md' "$TMP_DIR/.codex/commands/spec/bootstrap.md"
test -f "$TMP_DIR/.agents/skills/spec-brainstorm/SKILL.md"
test -f "$TMP_DIR/.agents/skills/spec-plan/SKILL.md"
test -f "$TMP_DIR/.agents/skills/spec-work/SKILL.md"
test -f "$TMP_DIR/.agents/skills/spec-review/SKILL.md"
test -f "$TMP_DIR/.agents/skills/spec-compound/SKILL.md"
installed_codex_skill_count="$(find "$TMP_DIR/.agents/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
test "$installed_codex_skill_count" = "$expected_skill_count"
grep -q '^name: spec-brainstorm$' "$TMP_DIR/.agents/skills/spec-brainstorm/SKILL.md"
grep -q '^name: spec-plan$' "$TMP_DIR/.agents/skills/spec-plan/SKILL.md"
grep -q '^name: spec-work$' "$TMP_DIR/.agents/skills/spec-work/SKILL.md"
grep -q '^name: spec-review$' "$TMP_DIR/.agents/skills/spec-review/SKILL.md"
grep -q '^name: spec-compound$' "$TMP_DIR/.agents/skills/spec-compound/SKILL.md"
test -f "$TMP_DIR/.agents/skills/spec-bootstrap/SKILL.md"
grep -q '^name: spec-bootstrap$' "$TMP_DIR/.agents/skills/spec-bootstrap/SKILL.md"
test -f "$TMP_DIR/.codex/agents/review/correctness-reviewer.md"
test -f "$TMP_DIR/.codex/agents/research/repo-research-analyst.md"
test -f "$TMP_DIR/.codex/spec-first/.developer"
grep -q '^name=kuang$' "$TMP_DIR/.codex/spec-first/.developer"
grep -q '<!-- spec-first:lang:start -->' "$TMP_DIR/AGENTS.md"
grep -q '<!-- spec-first:lang:end -->' "$TMP_DIR/AGENTS.md"
grep -q 'English' "$TMP_DIR/AGENTS.md"
grep -q 'refuse to generate' "$TMP_DIR/AGENTS.md"
! grep -q 'Governance File Commit Rule' "$TMP_DIR/AGENTS.md"
echo "✓ AGENTS.md lang policy block written"
codex_doctor_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor --codex)"
grep -q ".codex/spec-first/.developer" <<<"$codex_doctor_output"
grep -q ".codex/commands/spec" <<<"$codex_doctor_output"
grep -q ".agents/skills" <<<"$codex_doctor_output"
grep -q ".codex/agents" <<<"$codex_doctor_output"
if grep -q ".agents/plugins/marketplace.json" <<<"$codex_doctor_output"; then
  echo "✗ codex doctor should not depend on plugin marketplace anymore"
  exit 1
fi
mkdir -p "$TMP_DIR/.codex/spec-first/commands" "$TMP_DIR/.codex/skills/legacy-skill" "$TMP_DIR/.agents/plugins/plugins/spec" "$TMP_DIR/plugins/spec-first"
printf 'legacy command\n' > "$TMP_DIR/.codex/spec-first/commands/brainstorm.md"
printf 'legacy skill\n' > "$TMP_DIR/.codex/skills/legacy-skill/SKILL.md"
printf 'legacy plugin\n' > "$TMP_DIR/.agents/plugins/marketplace.json"
printf 'legacy plugin skill\n' > "$TMP_DIR/.agents/plugins/plugins/spec/README.md"
printf 'legacy plugin\n' > "$TMP_DIR/plugins/spec-first/README.md"
(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" init --codex -u kuang --lang en >/dev/null
)
test ! -e "$TMP_DIR/.codex/spec-first/commands/brainstorm.md"
test ! -e "$TMP_DIR/.codex/skills/legacy-skill/SKILL.md"
test ! -e "$TMP_DIR/.agents/plugins/marketplace.json"
test ! -e "$TMP_DIR/.agents/plugins/plugins/spec/README.md"
test ! -e "$TMP_DIR/plugins/spec-first"
(
  cd "$TMP_DIR"
  SPEC_FIRST_VERSION_REMINDER_LATEST="$outdated_version" node "$REPO_ROOT/bin/spec-first.js" clean --codex 2>"$TMP_DIR/codex-clean.err"
)
test ! -e "$TMP_DIR/.codex/commands/spec/brainstorm.md"
test ! -e "$TMP_DIR/.agents/skills/spec-brainstorm/SKILL.md"
test ! -e "$TMP_DIR/.codex/agents/review/correctness-reviewer.md"
test ! -e "$TMP_DIR/.codex/spec-first/.developer"
grep -q "Update available for spec-first" "$TMP_DIR/codex-clean.err"
echo "✓ codex init/doctor/clean work"

echo "3b. Verify clean removes managed assets and preserves custom assets..."
(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" clean --claude
)
test ! -e "$TMP_DIR/.claude/commands/spec/brainstorm.md"
test ! -e "$TMP_DIR/.claude/skills/spec-brainstorm/SKILL.md"
test ! -e "$TMP_DIR/.claude/agents/review/correctness-reviewer.md"
test ! -e "$TMP_DIR/.claude/spec-first/.developer"
test -e "$TMP_DIR/.claude/skills/custom-skill/SKILL.md"
echo "✓ clean removes managed assets and preserves custom assets"

echo "3c. Re-init after clean..."
(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang en
)
test -f "$TMP_DIR/.claude/commands/spec/brainstorm.md"
test -f "$TMP_DIR/.claude/commands/spec/ideate.md"
grep -q "Spec-First Ideate" "$TMP_DIR/.claude/commands/spec/ideate.md"
test -f "$TMP_DIR/.claude/skills/spec-brainstorm/SKILL.md"
test -f "$TMP_DIR/.claude/skills/spec-ideate/SKILL.md"
test -f "$TMP_DIR/.claude/agents/review/correctness-reviewer.md"
test -f "$TMP_DIR/.claude/spec-first/.developer"
echo "✓ re-init works after clean"

echo "4. Check npm pack output includes CLI assets..."
pack_output="$(cd "$REPO_ROOT" && npm_config_cache="$TMP_DIR/.npm-cache" npm pack --dry-run 2>&1)"
grep -q "bin/spec-first.js" <<<"$pack_output"
grep -q ".claude-plugin/plugin.json" <<<"$pack_output"
grep -q "templates/claude/commands/spec/ideate.md" <<<"$pack_output"
grep -q "templates/claude/commands/spec/brainstorm.md" <<<"$pack_output"
grep -q "templates/claude/commands/spec/bootstrap.md" <<<"$pack_output"
grep -q "skills/spec-plan/SKILL.md" <<<"$pack_output"
grep -q "skills/spec-bootstrap/SKILL.md" <<<"$pack_output"
grep -q "skills/document-review/SKILL.md" <<<"$pack_output"
grep -q "skills/spec-ideate/SKILL.md" <<<"$pack_output"
grep -q "skills/spec-work-beta/SKILL.md" <<<"$pack_output"
grep -q "skills/spec-compound-refresh/SKILL.md" <<<"$pack_output"
grep -q "skills/report-bug/SKILL.md" <<<"$pack_output"
grep -q "agents/review/correctness-reviewer.md" <<<"$pack_output"
if grep -qE 'npm notice scripts/' <<<"$pack_output"; then
  echo "✗ package output still contains repository-only assets"
  exit 1
fi
if grep -qE 'check-dependencies\.sh|migrate-from-every\.sh' <<<"$pack_output"; then
  echo "✗ package output still contains obsolete migration/check scripts"
  exit 1
fi
if grep -qE 'skills/ce-ideate/|skills/ce-work-beta/|skills/ce-compound-refresh/|skills/report-bug-ce/' <<<"$pack_output"; then
  echo "✗ package output still contains legacy pre-rename skill directories"
  exit 1
fi
echo "✓ package output includes CLI entry, templates, skills, and agents"

echo "=== CLI smoke test passed ✓ ==="
