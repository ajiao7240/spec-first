#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_REPO="$(mktemp -d)"
trap 'rm -rf "$TMP_REPO"' EXIT

echo "=== E2E 测试：spec-graph-bootstrap installed runtime ==="

cd "$TMP_REPO"

node "$REPO_ROOT/bin/spec-first.js" init --claude -u reviewer --lang zh >/dev/null
node "$REPO_ROOT/bin/spec-first.js" init --codex -u reviewer --lang zh >/dev/null

CLAUDE_RUNTIME_COMMAND="$TMP_REPO/.claude/commands/spec/graph-bootstrap.md"
CODEX_RUNTIME_SKILL="$TMP_REPO/.agents/skills/spec-graph-bootstrap/SKILL.md"

test ! -e "$TMP_REPO/.claude/spec-first/workflows/spec-graph-bootstrap/SKILL.md"

for file in "$CLAUDE_RUNTIME_COMMAND" "$CODEX_RUNTIME_SKILL"; do
  test -f "$file"
  grep -q 'CRG query-first' "$file"
  grep -q 'spec-first crg build --repo=<target>' "$file"
  grep -q 'graph-index-status.json' "$file"
  grep -q 'code-navigation.json' "$file"
  grep -q 'graph-operations.jsonl' "$file"
  grep -q 'spec-first crg hook before-plan' "$file"
  grep -q 'direct_repo_reads' "$file"
done

if grep -q 'stage0-context\|minimal-context\|injection-index.yaml\|docs/contexts' "$CLAUDE_RUNTIME_COMMAND"; then
  echo "✗ Claude runtime command should not retain retired bootstrap context wording"
  exit 1
fi

if grep -q 'stage0-context\|minimal-context\|injection-index.yaml\|docs/contexts' "$CODEX_RUNTIME_SKILL"; then
  echo "✗ Codex runtime skill should not retain retired bootstrap context wording"
  exit 1
fi

if grep -q '\.claude/spec-first/workflows/' "$CLAUDE_RUNTIME_COMMAND"; then
  echo "✗ Claude runtime command should not embed managed runtime workflow paths"
  exit 1
fi

if grep -q '\.claude/spec-first/workflows/' "$CODEX_RUNTIME_SKILL"; then
  echo "✗ Codex runtime skill should not retain Claude runtime workflow paths"
  exit 1
fi

echo "=== spec-graph-bootstrap installed runtime 通过 ✓ ==="
