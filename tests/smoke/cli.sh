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
grep -q "^1.3.9$" <<<"$version_output"
echo "✓ help/version output is present"

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
echo "✓ init generated all /spec:* command files"

echo "2b. Re-run init and verify it overwrites existing files..."
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
echo "✓ doctor reports generated command files"

echo "4. Check npm pack output includes CLI assets..."
pack_output="$(cd "$REPO_ROOT" && npm pack --dry-run 2>&1)"
grep -q "bin/spec-first.js" <<<"$pack_output"
grep -q "templates/claude/commands/spec/brainstorm.md" <<<"$pack_output"
if grep -qE '(skills/|agents/|scripts/)' <<<"$pack_output"; then
  echo "✗ package output still contains repository-only assets"
  exit 1
fi
if grep -qE 'check-dependencies\.sh|migrate-from-every\.sh' <<<"$pack_output"; then
  echo "✗ package output still contains obsolete migration/check scripts"
  exit 1
fi
echo "✓ package output includes CLI entry and templates"

echo "=== CLI smoke test passed ✓ ==="
