---
name: todo-create
description: 在创建持久工作项、管理待办事项生命周期或在基于文件的待办事项系统中跨会话跟踪结果时使用
disable-model-invocation: true
---
# 基于文件的待办事项跟踪

## 概述

`.context/spec-first/todos/` 目录是一个基于文件的跟踪系统，用于代码审查反馈、技术债务、功能请求和工作项目。每个待办事项都是一个带有 YAML frontmatter 的 markdown 文件。

> **旧版支持：** 阅读时始终检查 `.context/spec-first/todos/` （规范）和 `todos/` （旧版）。仅将新待办事项写入规范路径。该目录具有多会话生命周期——不要从头开始清理它。

## 目录路径

|目的|路径|
|---------|------|
| **规范（写在这里）** | `.context/spec-first/todos/` |
| **旧版（只读）** | `todos/` |

## 文件命名约定
```
{issue_id}-{status}-{priority}-{description}.md
```
- **issue_id**：序列号（001、002、...）——从未重复使用
- **状态**：`pending` | `ready` | `complete`
- **优先级**：`p1`（关键）| `p2`（重要）| `p3`（必备）
- **描述**：烤肉串盒，简短

**示例：** `002-ready-p1-fix-n-plus-1.md`

## 文件结构

每个待办事项都有 YAML frontmatter 和结构化部分。创建新待办事项时，请使用下面包含的待办事项模板。
```yaml
---
status: ready
priority: p1
issue_id: "002"
tags: [rails, performance]
dependencies: ["001"]     # Issue IDs this is blocked by
---
```
**必填部分：** 问题陈述、调查结果、建议的解决方案、建议的行动（在分类期间填写）、验收标准、工作日志。

**可选部分：** 技术细节、资源、注释。

## 工作流程

> **工具首选项：** 使用本机文件搜索/glob 和内容搜索工具而不是 shell 命令来查找和读取待办事项文件。 Shell 仅适用于没有本机等效项的操作（`mv`、`mkdir -p`）。

### 创建一个新的待办事项

1. `mkdir -p .context/spec-first/todos/`
2. 在两个路径中搜索`[0-9]*-*.md`，找到最高的数字前缀、增量、零填充至 3 位数字。
3. 使用下面包含的待办事项模板，将规范路径写入为 `{NEXT_ID}-pending-{priority}-{description}.md`。
4. 填写问题陈述、调查结果、建议的解决方案、验收标准和初始工作日志条目。
5. 设置状态：`pending`（需要分诊）或`ready`（预先批准）。

**当**工作需要超过 15 分钟、具有依赖性、需要规划或需要优先级时创建待办事项。 **当修复是微不足道的、明显的且独立的时，立即采取行动**。

### 对待处理项目进行分类

1. 在两个路径中使用 Glob `*-pending-*.md`。
2. 审查每个待办事项的问题陈述、调查结果和建议的解决方案。
3. 批准：重命名文件名和frontmatter中的`pending` -> `ready`，填写Recommended Action。
4. 推迟：保留为`pending`。

加载交互式审批工作流程的 `todo-triage` 技能。

### 管理依赖关系
```yaml
dependencies: ["002", "005"]  # Blocked by these issues
dependencies: []               # No blockers
```
要检查拦截器：在两个路径中搜索 `{dep_id}-complete-*.md`。缺少匹配项 = 不完整的拦截器。

### 完成待办事项

1. 验证所有验收标准。
2. 使用最终会话更新工作日志。
3. 重命名文件名和frontmatter中的`ready` -> `complete`。
4. 检查是否有未阻止的工作：搜索包含`dependencies:.*"{issue_id}"`的文件。

## 与工作流程集成

|触发|流量|
|---------|------|
|代码审查 | `/spec:review` -> 调查结果 -> `/todo-triage` -> 待办事项 |
|自主审核| `/spec:review mode:autofix` -> 剩余待办事项 -> `/todo-resolve` |
|代码 TODO | `/todo-resolve` -> 修复 + 复杂待办事项 |
|规划|头脑风暴 -> 创建待办事项 -> 工作 -> 完成 |

## 主要区别

此技能管理以 Markdown 文件形式保存的**持久的跨会话工作项**。对于临时会话中步骤跟踪，请使用平台任务工具（Claude Code 中的 `TaskCreate`/`TaskUpdate`，Codex 中的 `update_plan`）。

---

## 待办事项模板

@./assets/todo-template.md
