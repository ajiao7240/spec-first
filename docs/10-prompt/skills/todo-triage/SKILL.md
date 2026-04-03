---
name: todo-triage
description: 在审查待批准的待办事项、确定代码审查结果的优先级或以交互方式对工作项目进行分类时使用
argument-hint: "[findings list or source type]"
disable-model-invocation: true
---
# 都都分类

用于逐项审查待办事项并决定是否批准、跳过或修改每一项的交互式工作流程。

**在分类期间不要编写代码。**这纯粹是为了审查和优先级排序 - 实现发生在 `/todo-resolve` 中。

- 首先将 /model 设置为 Haiku
- 从 `.context/spec-first/todos/` 和旧 `todos/` 目录中读取所有待处理的待办事项

## 工作流程

### 1. 展示每项发现

对于每个待处理的待办事项，请清楚地说明其严重性、类别、描述、位置、问题场景、建议的解决方案和工作量估计。然后问：
```
Do you want to add this to the todo list?
1. yes - approve and mark ready
2. next - skip (deletes the todo file)
3. custom - modify before approving
```
使用严重性级别：🔴 P1（严重）、🟡 P2（重要）、🔵 P3（最好有）。

在每个标题中包含进度跟踪：`Progress: 3/10 completed`

### 2. 处理决策

**是：** 在文件名和 frontmatter 中从 `pending` -> `ready` 重命名文件。填写建议操作部分。如果创建新待办事项（不更新现有待办事项），请使用 `todo-create` 技能中的命名约定。

优先级映射：🔴 P1 -> `p1`、🟡 P2 -> `p2`、🔵 P3 -> `p3`

确认：“✅ 已批准：`{filename}`（问题 #{issue_id}）- 状态：**准备就绪**”

**下一步：** 删除待办事项文件。记录为已跳过以获取最终摘要。

**自定义：**询问要修改、更新、重新呈现、再次询问的内容。

### 3.最终总结

处理完所有项目后：
```markdown
## Triage Complete

**Total Items:** [X] | **Approved (ready):** [Y] | **Skipped:** [Z]

### Approved Todos (Ready for Work):
- `042-ready-p1-transaction-boundaries.md` - Transaction boundary issue

### Skipped (Deleted):
- Item #5: [reason]
```
### 4. 后续步骤
```markdown
What would you like to do next?

1. run /todo-resolve to resolve the todos
2. commit the todos
3. nothing, go chill
```
