#!/bin/bash
# 开发模式：提醒按 npm CLI 模型重新验证

set -euo pipefail

echo "spec-first 开发验证模式："
echo "  1. npm install -g spec-first"
echo "  2. 在目标项目运行 spec-first doctor"
echo "  3. 在目标项目运行 spec-first init --claude"
echo "  4. 检查 .claude/commands/spec/ 和 .claude/skills/"
echo ""
echo "如需验证本地发布物，请先执行 npm pack。"
