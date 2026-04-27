#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
OUTPUT_FILE="$TMP_DIR/install-local.out"
retired_default_entry="/spec:""bootstrap        默认稳定入口"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

echo "=== install-local.sh smoke test ==="

(
  cd "$REPO_ROOT"
  bash ./install-local.sh >"$OUTPUT_FILE"
)

echo "1. 检查脚本输出是否指向 npm CLI 模型..."
grep -q "npm install -g spec-first" "$OUTPUT_FILE"
grep -q "spec-first init --claude" "$OUTPUT_FILE"
if grep -q "$retired_default_entry" "$OUTPUT_FILE"; then
  echo "✗ 输出仍宣传已删除的旧 bootstrap 入口"
  exit 1
fi
if grep -q "/spec:""graph""-bootstrap" "$OUTPUT_FILE"; then
  echo "✗ 输出仍宣传已删除的图谱 workflow"
  exit 1
fi
grep -q "/spec:compound         工作完成后的稳定知识捕获入口" "$OUTPUT_FILE"
echo "✓ 输出已指向 npm CLI 初始化流程"

echo "2. 检查脚本未再承诺 Claude 插件缓存安装..."
if grep -q "\.claude/plugins/cache/spec-first-repo" "$OUTPUT_FILE"; then
  echo "✗ 输出仍包含旧插件缓存路径"
  exit 1
fi
echo "✓ 未再输出旧插件缓存路径"

echo "=== install-local.sh smoke test passed ✓ ==="
