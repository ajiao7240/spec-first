---
name: todo-resolve
description: 在批量解决批准的待办事项时使用，特别是在代码审查或分类会议之后
argument-hint: "[optional: specific todo ID or pattern]"
---
使用并行处理解决已批准的待办事项，记录经验教训，然后进行清理。

仅解决 `ready` 待办事项。 `pending` 待办事项被跳过——它们尚未被分类。如果存在待处理的待办事项，请将它们列在最后，以便用户知道留下了什么。

## 工作流程

### 1. 分析

扫描 `.context/spec-first/todos/*.md` 和旧版 `todos/*.md`。按状态划分：

- **`ready`**（状态字段或文件名中的 `-ready-`：解决这些问题。
- **`pending`**：跳过。最后报告他们。
- **`complete`**：忽略，已经完成。

如果特定的待办事项 ID 或模式作为参数传递，则仅过滤到匹配的待办事项（仍然必须是 `ready`）。

`safe_auto` 通过后 `spec:review mode:autofix` 的剩余可操作工作将已经是 `ready`。

跳过任何建议删除、移除或 gitignoring `docs/brainstorms/`、`docs/plans/` 或 `docs/solutions/` 中文件的待办事项 — 这些是有意的管道工件。

### 2. 计划

创建按类型分组的任务列表（例如，Claude Code 中的 `TaskCreate`，Codex 中的 `update_plan`。分析依赖关系——其他人依赖的项目首先运行。输出显示执行顺序和并行性的美人鱼图。

### 3. 实施（并行）

每个物品生成一个 `spec-first:workflow:pr-comment-resolver` 特工。优先选择平行；回退到尊重依赖顺序的顺序。

**批量：** 1-4 项：直接并行返回。 5 个以上项目：4 个批次，每个批次仅返回一个简短的状态摘要（待办事项已处理、文件已更改、测试运行/跳过、阻止程序）。

对于大型集，请使用 `.context/spec-first/todo-resolve/<run-id>/` 处的暂存目录来存储每个解析器工件。仅将完成摘要返回给父级。

### 4. 提交并解决

提交更改，标记待办事项已解决，推送到远程。门：停止。在继续之前验证待办事项已解决并已提交更改。

### 5. 总结经验教训

加载 `spec:compound` 工作流程以记录所学到的内容。待办事项决议通常会浮出值得捕捉的模式和架构见解。

门：停止。验证复合技能在`docs/solutions/`中生成了解决方案文档。如果没有（用户拒绝或没有学习），请继续。

### 6. 清理

从两个路径中删除已完成/已解决的待办事项文件。如果在 `.context/spec-first/todo-resolve/<run-id>/` 创建了临时目录，请将其删除（除非用户要求检查）。
```
Todos resolved: [count]
Pending (skipped): [count, or "none"]
Lessons documented: [path to solution doc, or "skipped"]
Todos cleaned up: [count deleted]
```
如果跳过待处理的待办事项，请列出它们：
```
Skipped pending todos (run /todo-triage to approve):
  - 003-pending-p2-missing-index.md
  - 005-pending-p3-rename-variable.md
```
