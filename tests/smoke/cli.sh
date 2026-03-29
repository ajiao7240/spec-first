#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== CLI smoke test ==="

echo "1. Check help and version output..."
help_output="$(node "$REPO_ROOT/bin/spec-first.js" --help)"
version_output="$(node "$REPO_ROOT/bin/spec-first.js" --version)"
grep -q "doctor" <<<"$help_output"
grep -q "init --claude" <<<"$help_output"
grep -q "^1.3.10$" <<<"$version_output"
echo "✓ help/version output is present"

echo "1b. Check doctor output in a fresh project is concise..."
doctor_fresh_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor)"
grep -q "PASS    .claude-plugin/plugin.json" <<<"$doctor_fresh_output"
grep -q "WARNING .claude/skills: missing" <<<"$doctor_fresh_output"
grep -q "WARNING .claude/agents: missing" <<<"$doctor_fresh_output"
if grep -q "agent-browser" <<<"$doctor_fresh_output"; then
  echo "✗ doctor output is too noisy for missing skills"
  exit 1
fi
echo "✓ doctor reports missing skills concisely"

echo "2. Initialize Claude commands in a fresh project..."
(
  cd "$TMP_DIR"
  node "$REPO_ROOT/bin/spec-first.js" init --claude
)

for file in brainstorm.md plan.md work.md review.md compound.md; do
  test -f "$TMP_DIR/.claude/commands/spec/$file"
done
grep -q "Spec-First Brainstorm" "$TMP_DIR/.claude/commands/spec/brainstorm.md"
grep -q "Spec-First Plan" "$TMP_DIR/.claude/commands/spec/plan.md"
grep -q "Spec-First Work" "$TMP_DIR/.claude/commands/spec/work.md"
grep -q "Spec-First Review" "$TMP_DIR/.claude/commands/spec/review.md"
grep -q "Spec-First Compound" "$TMP_DIR/.claude/commands/spec/compound.md"
grep -q '.claude/skills/spec-brainstorm/SKILL.md' "$TMP_DIR/.claude/commands/spec/brainstorm.md"
grep -q '.claude/skills/spec-plan/SKILL.md' "$TMP_DIR/.claude/commands/spec/plan.md"
echo "✓ init generated all /spec:* command files"

echo "2b. Verify skill directories were installed..."
expected_skill_count="$(find "$REPO_ROOT/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
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
echo "✓ init generated all bundled skill directories"

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
  node "$REPO_ROOT/bin/spec-first.js" init --claude
)
grep -q "Spec-First Brainstorm" "$TMP_DIR/.claude/commands/spec/brainstorm.md"
if grep -q "local edit" "$TMP_DIR/.claude/commands/spec/brainstorm.md"; then
  echo "✗ init did not overwrite existing command files"
  exit 1
fi
echo "✓ init overwrites existing command files by default"

echo "3. Run doctor after initialization..."
doctor_output="$(cd "$TMP_DIR" && node "$REPO_ROOT/bin/spec-first.js" doctor)"
grep -q "PASS" <<<"$doctor_output"
grep -q ".claude/commands/spec" <<<"$doctor_output"
grep -q ".claude/skills" <<<"$doctor_output"
grep -q ".claude/agents" <<<"$doctor_output"
echo "✓ doctor reports generated commands, skills, and agents"

echo "4. Check npm pack output includes CLI assets..."
pack_output="$(cd "$REPO_ROOT" && npm pack --dry-run 2>&1)"
grep -q "bin/spec-first.js" <<<"$pack_output"
grep -q ".claude-plugin/plugin.json" <<<"$pack_output"
grep -q "templates/claude/commands/spec/brainstorm.md" <<<"$pack_output"
grep -q "skills/spec-plan/SKILL.md" <<<"$pack_output"
grep -q "skills/document-review/SKILL.md" <<<"$pack_output"
grep -q "agents/review/correctness-reviewer.md" <<<"$pack_output"
if grep -qE 'npm notice scripts/' <<<"$pack_output"; then
  echo "✗ package output still contains repository-only assets"
  exit 1
fi
if grep -qE 'check-dependencies\.sh|migrate-from-every\.sh' <<<"$pack_output"; then
  echo "✗ package output still contains obsolete migration/check scripts"
  exit 1
fi
echo "✓ package output includes CLI entry, templates, skills, and agents"

echo "=== CLI smoke test passed ✓ ==="
