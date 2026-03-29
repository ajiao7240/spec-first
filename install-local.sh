#!/bin/bash
# 本地安装脚本

set -e

PLUGIN_DIR="$HOME/.claude/plugins/spec-first"

echo "安装 spec-first 到 Claude Code..."

# 创建插件目录
mkdir -p "$PLUGIN_DIR"

# 复制文件
cp -r .claude-plugin "$PLUGIN_DIR/"
cp -r skills "$PLUGIN_DIR/"
cp -r agents "$PLUGIN_DIR/"
cp -r scripts "$PLUGIN_DIR/"

echo "✓ 安装完成"
echo ""
echo "验证安装："
echo "  ls ~/.claude/plugins/spec-first"
