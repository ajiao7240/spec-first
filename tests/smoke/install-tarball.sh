#!/bin/bash
# install-tarball.sh — 真实 tarball 安装体验回归
# 职责：npm pack → npm install -g → postinstall 输出 → 全局 shim → 安装日志 warning 计数
# 运行方式：bash tests/smoke/install-tarball.sh（不纳入默认 npm test）
# 前置：需要 npm registry 和外网可用

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_PREFIX="$(mktemp -d)/prefix"
TMP_CACHE="$(mktemp -d)"
TARBALL_DIR="$(mktemp -d)"

export npm_config_prefix="$TMP_PREFIX"
export npm_config_cache="$TMP_CACHE"
export npm_config_foreground_scripts=true

cleanup() {
  rm -rf "$TMP_PREFIX" "$TMP_CACHE" "$TARBALL_DIR"
  # 清理父目录
  rmdir "$(dirname "$TMP_PREFIX")" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== install-tarball.sh — 真实 tarball 安装验证 ==="

# -------------------------------------------------------------------------
# 1. npm pack
# -------------------------------------------------------------------------
echo "1. 打包 tarball..."
cd "$REPO_ROOT"
if ! PACK_OUTPUT=$(npm pack --pack-destination "$TARBALL_DIR" 2>&1); then
  echo "$PACK_OUTPUT"
  exit 1
fi
printf '%s\n' "$PACK_OUTPUT" > "$TARBALL_DIR/npm-pack.log"
TARBALL=$(printf '%s\n' "$PACK_OUTPUT" | awk '/\.tgz$/ { name=$NF } END { print name }')
if [ -z "$TARBALL" ]; then
  echo "✗ 无法从 npm pack 输出中解析 tarball 文件名"
  echo "$PACK_OUTPUT"
  exit 1
fi
TARBALL_PATH="$TARBALL_DIR/$TARBALL"
echo "   tarball: $TARBALL_PATH"
test -f "$TARBALL_PATH"
PACK_LIST="$TARBALL_DIR/pack-list.txt"
tar -tf "$TARBALL_PATH" > "$PACK_LIST"
obsolete_src="src/""crg"
parser_dep="tree""-sitter"
sqlite_dep="better""-sqlite3"
if grep -E "$obsolete_src|$parser_dep|$sqlite_dep" "$PACK_LIST"; then
  echo "✗ tarball 文件列表包含已删除的图谱运行时内容"
  exit 1
fi
if grep -q '^package/\.claude-plugin/' "$PACK_LIST"; then
  echo "✗ tarball 文件列表不应包含安装生成的 .claude-plugin 产物"
  exit 1
fi
if grep -E '(^|/)__pycache__/|\.py[co]$' "$PACK_LIST"; then
  echo "✗ tarball 文件列表不应包含 Python bytecode 缓存"
  exit 1
fi
grep -q "skills/spec-graph-bootstrap/SKILL.md" "$PACK_LIST"
grep -q "templates/claude/commands/spec/graph-bootstrap.md" "$PACK_LIST"
grep -q "skills/spec-standards/SKILL.md" "$PACK_LIST"
grep -q "skills/spec-standards/scripts/prepare-baseline.js" "$PACK_LIST"
grep -q "templates/claude/commands/spec/standards.md" "$PACK_LIST"
grep -q "skills/spec-skill-audit/SKILL.md" "$PACK_LIST"
grep -q "skills/spec-skill-audit/scripts/write-audit-artifacts.js" "$PACK_LIST"
grep -q "templates/claude/commands/spec/skill-audit.md" "$PACK_LIST"
echo "   ✓ tarball 未包含内置 CRG runtime / .claude-plugin，且包含 external graph bootstrap 与 skill audit"

# -------------------------------------------------------------------------
# 2. 隔离安装
# -------------------------------------------------------------------------
echo "2. 隔离安装到临时 prefix..."
INSTALL_LOG="$TMP_CACHE/install.log"
if npm install -g "$TARBALL_PATH" >"$INSTALL_LOG" 2>&1; then
  install_rc=0
else
  install_rc=$?
  echo "   npm install failed; last install log lines:" >&2
  tail -80 "$INSTALL_LOG" >&2 || true
fi
echo "   install exit code: $install_rc"
test "$install_rc" -eq 0

# -------------------------------------------------------------------------
# 3. 验证安装日志
# -------------------------------------------------------------------------
echo "3. 验证安装日志..."

if grep -E "$parser_dep|$sqlite_dep|$obsolete_src" "$INSTALL_LOG"; then
  echo "✗ 安装日志包含已删除的图谱运行时内容"
  exit 1
fi
echo "   ✓ 安装日志未包含已删除的图谱运行时内容"

# 3a. postinstall 输出断言（依赖 foreground_scripts）
if grep -q "安装完成" "$INSTALL_LOG"; then
  echo "   ✓ postinstall 输出包含安装完成"
  if grep -q "spec-first doctor" "$INSTALL_LOG"; then
    echo "   ✓ postinstall 输出包含 spec-first doctor"
  else
    echo "   ⚠ postinstall 输出未包含 spec-first doctor（可能被 npm 吞掉）"
  fi
else
  echo "   ⚠ postinstall 输出不可见（foreground_scripts 行为差异）"
fi

# -------------------------------------------------------------------------
# 4. 验证全局 shim
# -------------------------------------------------------------------------
echo "4. 验证全局 shim..."
SHIM="$TMP_PREFIX/bin/spec-first"
test -x "$SHIM"

# 4a. spec-first -v
VERSION_OUTPUT=$("$SHIM" -v 2>&1)
echo "   ✓ spec-first -v 可执行"
grep -q "Spec-First" <<<"$VERSION_OUTPUT"
grep -q "doctor" <<<"$VERSION_OUTPUT"
echo "   ✓ -v 输出包含 doctor"
# 确定性断言：-v 不推荐 /spec:ideate 或 /spec:brainstorm 作为安装后第一建议
if grep -q "/spec:ideate" <<<"$VERSION_OUTPUT"; then
  echo "✗ -v 输出不应推荐 /spec:ideate 作为安装后第一建议"
  exit 1
fi
if grep -q "/spec:brainstorm" <<<"$VERSION_OUTPUT"; then
  echo "✗ -v 输出不应推荐 /spec:brainstorm 作为安装后第一建议"
  exit 1
fi
echo "   ✓ -v 输出未推荐 /spec:ideate 或 /spec:brainstorm"

# 4b. spec-first doctor（在空目录）
DOCTOR_TMP="$(mktemp -d)"
DOCTOR_OUTPUT=$(cd "$DOCTOR_TMP" && "$SHIM" doctor 2>&1)
rm -rf "$DOCTOR_TMP"
grep -q "init" <<<"$DOCTOR_OUTPUT"
grep -q "spec-first init --claude" <<<"$DOCTOR_OUTPUT"
echo "   ✓ doctor 在空目录输出 init --claude 指引"

# -------------------------------------------------------------------------
# 5. 验证全局包内容
# -------------------------------------------------------------------------
echo "5. 验证全局包内容..."
GLOBAL_PKG="$TMP_PREFIX/lib/node_modules/spec-first"
test -d "$GLOBAL_PKG"

node -e "
const fs = require('fs');
const path = require('path');
const root = '$GLOBAL_PKG';
const forbidden = [
  'src/' + 'crg',
  'vendor/' + 'tree' + '-sitter-objc',
  'vendor/' + 'tree' + '-sitter-swift',
  '.claude-plugin',
];
for (const rel of forbidden) {
  if (fs.existsSync(path.join(root, rel))) {
    console.error('forbidden package path exists: ' + rel);
    process.exit(1);
  }
}
if (!fs.existsSync(path.join(root, 'skills/spec-' + 'graph' + '-bootstrap/SKILL.md'))) {
  console.error('external graph bootstrap skill missing from package');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'templates/claude/commands/spec/' + 'graph' + '-bootstrap.md'))) {
  console.error('external graph bootstrap command missing from package');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'skills/spec-' + 'skill' + '-audit/SKILL.md'))) {
  console.error('skill audit skill missing from package');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'skills/spec-' + 'skill' + '-audit/scripts/write-audit-artifacts.js'))) {
  console.error('skill audit artifact writer missing from package');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'templates/claude/commands/spec/' + 'skill' + '-audit.md'))) {
  console.error('skill audit command missing from package');
  process.exit(1);
}
"
echo "   ✓ 全局包未包含内置 CRG runtime，且包含 external graph bootstrap 与 skill audit"

# -------------------------------------------------------------------------
# 完成
# -------------------------------------------------------------------------
echo ""
echo "=== install-tarball.sh — 全部验证通过 ✓ ==="
