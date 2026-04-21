#!/bin/bash
# E2E 测试：完整五步闭环流程

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

TEST_DIR=".claude/tasks/test-e2e-$(date +%s)"
TASK_ID="2026-03-29-test-e2e"

echo "=== E2E 测试：五步闭环流程 ==="
echo ""

# 清理
cleanup() {
    echo "清理测试数据..."
    rm -rf "$TEST_DIR"
    rm -rf ".claude/tasks/$TASK_ID"
}

trap cleanup EXIT

# 1. 初始化任务
echo "1. 测试任务初始化..."
./scripts/task-manager.sh create \
    --task-id "$TASK_ID" \
    --title "测试功能" \
    --role "dev" \
    --level "L2"

if [ ! -f ".claude/tasks/$TASK_ID/task.yaml" ]; then
    echo "✗ 任务创建失败"
    exit 1
fi
echo "✓ 任务创建成功"

# 2. Brainstorm 阶段
echo ""
echo "2. 测试 Brainstorm 阶段..."
./scripts/stage-gate.sh check --task-id "$TASK_ID" --stage "brainstorm"
echo "✓ Brainstorm 阶段检查通过"

# 创建 brainstorm 产物
cat > ".claude/tasks/$TASK_ID/01-brainstorm.md" <<EOF
---
task_id: $TASK_ID
stage: brainstorm
---

# 候选方案

## 方案A
实现方式A

## 推荐方案
采用方案A
EOF

./scripts/task-manager.sh update --task-id "$TASK_ID" --stage "plan" --status "in_progress"
echo "✓ Brainstorm 产物已创建"

# 3. Plan 阶段
echo ""
echo "3. 测试 Plan 阶段..."
./scripts/stage-gate.sh check --task-id "$TASK_ID" --stage "plan"
echo "✓ Plan 阶段检查通过"

# 创建 plan 产物
cat > ".claude/tasks/$TASK_ID/02-plan.md" <<EOF
---
task_id: $TASK_ID
stage: plan
---

# 实施计划

## 步骤1
实现功能A

## 步骤2
测试功能A
EOF

./scripts/task-manager.sh update --task-id "$TASK_ID" --stage "work" --status "in_progress"
echo "✓ Plan 产物已创建"

# 4. Work 阶段
echo ""
echo "4. 测试 Work 阶段..."
./scripts/stage-gate.sh check --task-id "$TASK_ID" --stage "work"
echo "✓ Work 阶段检查通过"

# 创建 work 产物
cat > ".claude/tasks/$TASK_ID/03-work.md" <<EOF
---
task_id: $TASK_ID
stage: work
---

# 实施记录

已完成功能A的实现和测试
EOF

./scripts/task-manager.sh update --task-id "$TASK_ID" --stage "review" --status "in_progress"
echo "✓ Work 产物已创建"

# 5. Review 阶段
echo ""
echo "5. 测试 Review 阶段..."
./scripts/stage-gate.sh check --task-id "$TASK_ID" --stage "review"
echo "✓ Review 阶段检查通过"

# 测试 review-judge
echo ""
echo "6. 测试 Review 判定..."
result=$(./scripts/review-judge.sh judge --correctness 4 --completeness 4 --executability 4 --reusability 4 --blocking 0)
if echo "$result" | grep -q "pass: true"; then
    echo "✓ Review 判定通过"
else
    echo "✗ Review 判定失败"
    exit 1
fi

# 创建 review 产物
cat > ".claude/tasks/$TASK_ID/04-review.md" <<EOF
---
task_id: $TASK_ID
stage: review
scores:
  correctness: 4
  completeness: 4
  executability: 4
  reusability: 4
summary_score: 16
blocking_issues: 0
pass: true
---

# Review 结果

所有检查通过
EOF

./scripts/task-manager.sh update --task-id "$TASK_ID" --stage "compound" --status "in_progress"
echo "✓ Review 产物已创建"

# 7. Compound 阶段
echo ""
echo "7. 测试 Compound 阶段..."
./scripts/stage-gate.sh check --task-id "$TASK_ID" --stage "compound"
echo "✓ Compound 阶段检查通过"

# 创建 compound 产物
cat > ".claude/tasks/$TASK_ID/05-compound.md" <<EOF
---
task_id: $TASK_ID
stage: compound
---

# 知识沉淀

已完成功能A的开发和测试
EOF

./scripts/task-manager.sh update --task-id "$TASK_ID" --status "completed"
echo "✓ Compound 产物已创建"

# 8. 验证最终状态
echo ""
echo "8. 验证最终状态..."
final_status=$(./scripts/task-manager.sh read --task-id "$TASK_ID" | grep "status:" | awk '{print $2}')
if [ "$final_status" = "completed" ]; then
    echo "✓ 任务状态正确"
else
    echo "✗ 任务状态错误: $final_status"
    exit 1
fi

echo ""
echo "9. 测试 spec-graph-bootstrap 主链..."
bash tests/e2e/spec-graph-bootstrap-mainline.sh
echo "✓ spec-graph-bootstrap 主链通过"

echo ""
echo "10. 测试 spec-graph-bootstrap installed runtime..."
bash tests/e2e/spec-graph-bootstrap-installed-runtime.sh
echo "✓ spec-graph-bootstrap installed runtime 通过"

echo ""
echo "11. 测试 spec-brainstorm 确定性 contract 接线..."
bash tests/integration/spec-brainstorm-flow.sh
echo "✓ spec-brainstorm 确定性 contract 接线通过"

echo ""
echo "=== E2E 测试全部通过 ✓ ==="
