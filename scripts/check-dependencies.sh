#!/bin/bash
# 依赖检查脚本：检查核心 skills 的依赖完整性

echo "=== 检查核心 Skills 依赖 ==="
echo ""

# 检查 5 个核心 skills 是否存在
CORE_SKILLS=("ce-brainstorm" "ce-plan" "ce-work" "ce-review" "ce-compound")

echo "1. 检查核心 Skills 文件..."
for skill in "${CORE_SKILLS[@]}"; do
    if [ -f "skills/$skill/SKILL.md" ]; then
        echo "  ✓ $skill/SKILL.md 存在"
    else
        echo "  ✗ $skill/SKILL.md 缺失"
    fi
done

echo ""
echo "2. 检查 Agents 目录..."
AGENTS=("design" "docs" "document-review" "research" "review" "workflow")
for agent in "${AGENTS[@]}"; do
    if [ -d "agents/$agent" ]; then
        count=$(find "agents/$agent" -name "*.md" | wc -l)
        echo "  ✓ $agent/ 存在 ($count 个文件)"
    else
        echo "  ✗ $agent/ 缺失"
    fi
done

echo ""
echo "3. 检查 .claude-plugin..."
if [ -f ".claude-plugin/plugin.json" ]; then
    echo "  ✓ plugin.json 存在"
else
    echo "  ✗ plugin.json 缺失"
fi

echo ""
echo "=== 检查完成 ==="
