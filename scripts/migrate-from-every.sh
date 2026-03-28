#!/bin/bash
set -e

# 迁移脚本：从 Every 基座复制所有文件
# 第一步：全部复制，确保能正常运行

EVERY_BASE="/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering"
TARGET_BASE="/Users/kuang/xiaobu/spec-first"

echo "开始从 Every 基座迁移..."

# 1. 复制 .claude-plugin 元数据
echo "复制 .claude-plugin..."
cp -r "$EVERY_BASE/.claude-plugin" "$TARGET_BASE/"

# 2. 复制所有 agents
echo "复制 agents..."
cp -r "$EVERY_BASE/agents" "$TARGET_BASE/"

# 3. 复制所有 skills
echo "复制 skills..."
cp -r "$EVERY_BASE/skills" "$TARGET_BASE/"

echo "迁移完成！"
echo "已复制："
echo "  - .claude-plugin/"
echo "  - agents/ (6个目录)"
echo "  - skills/ (43个目录)"
