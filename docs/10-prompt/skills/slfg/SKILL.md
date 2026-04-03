---
name: slfg
description: 使用集群模式并行执行的完全自主工程工作流程
argument-hint: "[feature description]"
disable-model-invocation: true
---
支持群的垃圾填埋气。按顺序运行这些步骤，并在指示的地方并行化。不要在步骤之间停下来——完成每一步直到最后。

## 顺序阶段

1. **可选：** 如果`ralph-loop`技能可用，则运行`/ralph-loop:ralph-loop "finish all slash commands" --completion-promise "DONE"`。如果不可用或失败，请立即跳过并继续步骤 2。
2. `/spec:plan $ARGUMENTS` — **记录步骤 4 和 6 中 `docs/plans/` 的计划文件路径**。
3. `/spec:work` — **使用群体模式**：制定任务列表并启动一支由代理群体子代理组成的军队来制定计划

## 并行阶段

工作完成后，作为**并行 Swarm 代理**启动步骤 4 和 5（两者都只需要编写代码）：

4. `/spec:review mode:report-only plan:<plan-path-from-step-2>` — 作为后台任务代理生成
5. `/test-browser` — 作为后台任务代理生成

等待两者完成后再继续。

## 自动修复阶段

6. `/spec:review mode:autofix plan:<plan-path-from-step-2>` — 在并行阶段之后按顺序运行，以便它可以安全地改变结账，应用 `safe_auto` 修复，并为步骤 7 发出剩余的待办事项

## 完成阶段

7. `/todo-resolve` — 解决发现的问题，综合学习内容，清理已完成的待办事项
8. `/feature-video` — 记录最终演练并添加到 PR
9. 视频PR时输出`<promise>DONE</promise>`

现在从步骤 1 开始。
