#!/bin/bash
# 测试核心 skills 是否可用

echo "=== 测试核心 Skills 可用性 ==="
echo ""

# 检查 skill 文件格式
echo "1. 检查 SKILL.md 格式..."

check_skill_format() {
    local skill=$1
    local file="skills/$skill/SKILL.md"

    if grep -q "^---$" "$file" && grep -q "^name:" "$file"; then
        echo "  ✓ $skill 格式正确"
        return 0
    else
        echo "  ✗ $skill 格式错误"
        return 1
    fi
}

check_skill_format "spec-brainstorm"
check_skill_format "spec-plan"
check_skill_format "spec-work"
check_skill_format "spec-review"
check_skill_format "spec-compound"

echo ""
echo "2. 检查 skill 名称..."
for skill in spec-brainstorm spec-plan spec-work spec-review spec-compound; do
    name=$(grep "^name:" "skills/$skill/SKILL.md" | head -1)
    echo "  $skill: $name"
done

echo ""
echo "=== 测试完成 ==="
