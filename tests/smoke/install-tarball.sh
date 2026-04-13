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
TARBALL=$(npm pack --pack-destination "$TARBALL_DIR" 2>&1 | tail -1)
TARBALL_PATH="$TARBALL_DIR/$TARBALL"
echo "   tarball: $TARBALL_PATH"
test -f "$TARBALL_PATH"

# -------------------------------------------------------------------------
# 2. 隔离安装
# -------------------------------------------------------------------------
echo "2. 隔离安装到临时 prefix..."
export npm_config_prefix="$TMP_PREFIX"
export npm_config_cache="$TMP_CACHE"
export npm_config_foreground_scripts=true

INSTALL_LOG="$TMP_CACHE/install.log"
npm install -g "$TARBALL_PATH" >"$INSTALL_LOG" 2>&1
install_rc=$?
echo "   install exit code: $install_rc"
test "$install_rc" -eq 0

# -------------------------------------------------------------------------
# 3. 验证安装日志
# -------------------------------------------------------------------------
echo "3. 验证安装日志..."

# 3a. 禁止出现安装期联网下载链
if grep -q "tree-sitter-cli" "$INSTALL_LOG"; then
  echo "✗ 安装日志中出现 tree-sitter-cli"
  exit 1
fi
if grep -q "Downloading https://github.com/tree-sitter/tree-sitter/releases" "$INSTALL_LOG"; then
  echo "✗ 安装日志中出现 GitHub release 下载"
  exit 1
fi
if grep -q "ETIMEDOUT" "$INSTALL_LOG"; then
  echo "✗ 安装日志中出现 ETIMEDOUT"
  exit 1
fi
echo "   ✓ 无安装期联网下载链"

# 3b. tree-sitter peer warning 冲突包集合断言
# 只从 ERESOLVE/warning 行中提取 tree-sitter-<lang> 冲突包名（去重），断言集合 ⊆ {tree-sitter-objc}
conflict_packages=$(grep -i "ERESOLVE\|peer.*tree-sitter" "$INSTALL_LOG" | grep -oE 'tree-sitter-[a-z][-a-z0-9]*' | sort -u || true)
echo "   检测到的 tree-sitter 冲突包: ${conflict_packages:-无}"

for pkg in $conflict_packages; do
  case "$pkg" in
    tree-sitter-objc)
      # objc 是允许的残留冲突
      echo "   ℹ $pkg: 允许的残留冲突"
      ;;
    tree-sitter-c|tree-sitter-python|tree-sitter-rust|tree-sitter-swift)
      echo "✗ 禁止出现的冲突包: $pkg"
      exit 1
      ;;
    tree-sitter)
      # tree-sitter 主包名不是冲突
      ;;
    *)
      echo "   ⚠ 未知 tree-sitter 包: $pkg（忽略）"
      ;;
  esac
done
echo "   ✓ 冲突包集合验证通过"

# 3c. postinstall 输出断言（依赖 foreground_scripts）
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
# 5. Swift parser 真实加载验证
# -------------------------------------------------------------------------
echo "5. 验证 Swift parser 真实加载..."
GLOBAL_PKG="$TMP_PREFIX/lib/node_modules/spec-first"
test -d "$GLOBAL_PKG"

# 创建最小 Swift fixture
SWIFT_FIXTURE="$TMP_CACHE/fixture.swift"
echo 'import Foundation
class AppConfig {
    var name: String
    init(name: String) { self.name = name }
    func greet() -> String { return "Hello, \(name)" }
}' > "$SWIFT_FIXTURE"

# 尝试 require() Swift parser 并解析 fixture
node -e "
const path = require('path');
const root = path.join('$GLOBAL_PKG');
const Parser = require(path.join(root, 'node_modules/tree-sitter'));
const swiftPkg = require(path.join(root, 'node_modules/tree-sitter-swift'));
const parser = new Parser();
parser.setLanguage(swiftPkg);
const fs = require('fs');
const code = fs.readFileSync('$SWIFT_FIXTURE', 'utf8');
const tree = parser.parse(code);
if (!tree || !tree.rootNode) {
  console.error('✗ Swift parser failed to produce AST');
  process.exit(1);
}
const hasClass = tree.rootNode.children.some(c => c.type === 'class_declaration');
if (!hasClass) {
  console.error('✗ Swift parser did not detect class_declaration');
  process.exit(1);
}
console.log('   ✓ Swift parser 加载并解析成功');
" 2>&1

# -------------------------------------------------------------------------
# 完成
# -------------------------------------------------------------------------
echo ""
echo "=== install-tarball.sh — 全部验证通过 ✓ ==="
