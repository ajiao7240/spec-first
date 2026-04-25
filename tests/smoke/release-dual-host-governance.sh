#!/bin/bash
# release-dual-host-governance.sh — 双宿主治理 tarball 发布闭环验证

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_ROOT="$(mktemp -d)"
TMP_PREFIX="$TMP_ROOT/prefix"
TMP_CACHE="$TMP_ROOT/cache"
TARBALL_DIR="$TMP_ROOT/tarball"
CODEX_PROJECT="$TMP_ROOT/codex-project"
CLAUDE_PROJECT="$TMP_ROOT/claude-project"
PACKAGE_VERSION="$(node -p "require(process.argv[1]).version" "$REPO_ROOT/package.json")"

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

echo "=== release-dual-host-governance.sh — tarball 治理闭环验证 ==="

echo "1. 打包 tarball..."
cd "$REPO_ROOT"
mkdir -p "$TARBALL_DIR" "$TMP_CACHE"
export npm_config_cache="$TMP_CACHE"
npm pack --pack-destination "$TARBALL_DIR" >"$TMP_ROOT/pack.log" 2>&1
TARBALL_PATH="$(find "$TARBALL_DIR" -maxdepth 1 -type f -name '*.tgz' -print -quit)"
test -f "$TARBALL_PATH"
echo "   tarball: $TARBALL_PATH"

echo "2. 校验 tarball 包含 runtime governance assets..."
tar -tf "$TARBALL_PATH" | grep -q '^package/src/cli/contracts/dual-host-governance/skills-governance.json$'
tar -tf "$TARBALL_PATH" | grep -q '^package/src/cli/contracts/dual-host-governance/skills-governance.schema.json$'
if tar -tf "$TARBALL_PATH" | grep -q '^package/docs/contracts/dual-host-governance/skills-governance.json$'; then
  echo "✗ tarball 不应再包含 docs-side skills-governance.json"
  exit 1
fi
if tar -tf "$TARBALL_PATH" | grep -q '^package/docs/contracts/dual-host-governance/skills-governance.schema.json$'; then
  echo "✗ tarball 不应再包含 docs-side skills-governance.schema.json"
  exit 1
fi
echo "   ✓ tarball 已包含 runtime governance JSON/schema"

echo "3. 隔离安装 tarball..."
export npm_config_prefix="$TMP_PREFIX"
export npm_config_foreground_scripts=true
mkdir -p "$TMP_PREFIX" "$TMP_CACHE"

npm install -g --omit=optional "$TARBALL_PATH" >"$TMP_ROOT/install.log" 2>&1
SHIM="$TMP_PREFIX/bin/spec-first"
test -x "$SHIM"
test -f "$TMP_PREFIX/lib/node_modules/spec-first/src/cli/contracts/dual-host-governance/skills-governance.json"
echo "   ✓ 安装后 runtime governance 真源存在"

echo "4. 验证 Codex 安装态 init / doctor..."
mkdir -p "$CODEX_PROJECT"
codex_init_output="$(
  cd "$CODEX_PROJECT"
  SPEC_FIRST_VERSION_REMINDER_LATEST="$PACKAGE_VERSION" "$SHIM" init --codex -u test --lang en 2>&1
)"
grep -q 'new \$spec-\* skills' <<<"$codex_init_output"
test ! -e "$CODEX_PROJECT/.codex/commands/spec"
test -f "$CODEX_PROJECT/.agents/skills/spec-work/SKILL.md"
test -f "$CODEX_PROJECT/.agents/skills/using-spec-first/SKILL.md"
test ! -e "$CODEX_PROJECT/.agents/skills/claude-permissions-optimizer/SKILL.md"
test ! -e "$CODEX_PROJECT/.agents/skills/orchestrating-swarms/SKILL.md"

codex_doctor_output="$(
  cd "$CODEX_PROJECT"
  SPEC_FIRST_VERSION_REMINDER_LATEST="$PACKAGE_VERSION" "$SHIM" doctor --codex 2>&1
)"
grep -q '.agents/skills' <<<"$codex_doctor_output"
grep -q 'workflow skills' <<<"$codex_doctor_output"
grep -q 'standalone skills' <<<"$codex_doctor_output"
if grep -q '.codex/commands/spec' <<<"$codex_doctor_output"; then
  echo "✗ Codex doctor 不应再把 .codex/commands/spec 当作正式产品面"
  exit 1
fi
echo "   ✓ Codex 安装态闭环通过"

echo "5. 验证 Claude 安装态 init / doctor..."
mkdir -p "$CLAUDE_PROJECT"
claude_init_output="$(
  cd "$CLAUDE_PROJECT"
  SPEC_FIRST_VERSION_REMINDER_LATEST="$PACKAGE_VERSION" "$SHIM" init --claude -u test --lang en 2>&1
)"
grep -q '.claude/commands/spec' <<<"$claude_init_output"
test -f "$CLAUDE_PROJECT/.claude/commands/spec/brainstorm.md"
test -f "$CLAUDE_PROJECT/.claude/skills/using-spec-first/SKILL.md"
test ! -e "$CLAUDE_PROJECT/.claude/spec-first/workflows/spec-work/SKILL.md"

claude_doctor_output="$(
  cd "$CLAUDE_PROJECT"
  SPEC_FIRST_VERSION_REMINDER_LATEST="$PACKAGE_VERSION" "$SHIM" doctor --claude 2>&1
)"
grep -q '.claude/commands/spec' <<<"$claude_doctor_output"
grep -q '.claude/skills' <<<"$claude_doctor_output"
grep -q '0 workflow skills' <<<"$claude_doctor_output"
echo "   ✓ Claude 安装态闭环通过"

echo
echo "=== release-dual-host-governance.sh — 全部验证通过 ✓ ==="
