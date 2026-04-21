#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_REPO="$(mktemp -d)"
trap 'rm -rf "$TMP_REPO"' EXIT

echo "=== E2E 测试：spec-graph-bootstrap installed runtime ==="

cd "$TMP_REPO"

node "$REPO_ROOT/bin/spec-first.js" init --claude -u reviewer --lang zh >/dev/null
node "$REPO_ROOT/bin/spec-first.js" init --codex -u reviewer --lang zh >/dev/null

CLAUDE_RUNTIME_SKILL="$TMP_REPO/.claude/spec-first/workflows/spec-graph-bootstrap/SKILL.md"
CLAUDE_RUNTIME_COMMAND="$TMP_REPO/.claude/commands/spec/graph-bootstrap.md"
CODEX_RUNTIME_SKILL="$TMP_REPO/.agents/skills/spec-graph-bootstrap/SKILL.md"

for file in "$CLAUDE_RUNTIME_SKILL" "$CLAUDE_RUNTIME_COMMAND" "$CODEX_RUNTIME_SKILL"; do
  test -f "$file"
  grep -q 'spec-first source repo internals' "$file"
  grep -q 'installed runtime assets' "$file"
  grep -q 'target repo generated artifacts' "$file"
  grep -q 'package CLI surfaces' "$file"
  grep -q '不要在 target repo 中查找 source repo 内部路径来判断 workflow 是否可用' "$file"
done

grep -q 'spec-first init --claude   # Claude 运行时' "$CLAUDE_RUNTIME_COMMAND"
grep -q '不是 `spec-first graph-bootstrap` 包级子命令' "$CLAUDE_RUNTIME_COMMAND"

grep -q 'spec-first init --codex   # Codex 运行时' "$CODEX_RUNTIME_SKILL"
grep -q '不是 `spec-first graph-bootstrap` 包级子命令' "$CODEX_RUNTIME_SKILL"

if grep -q '\.claude/spec-first/workflows/' "$CLAUDE_RUNTIME_COMMAND"; then
  echo "✗ Claude runtime command should not embed managed runtime workflow paths"
  exit 1
fi

if grep -q '\.claude/spec-first/workflows/' "$CODEX_RUNTIME_SKILL"; then
  echo "✗ Codex runtime skill should not retain Claude runtime workflow paths"
  exit 1
fi

echo "=== spec-graph-bootstrap installed runtime 通过 ✓ ==="
