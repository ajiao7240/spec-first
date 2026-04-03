---
name: git-clean-gone-branches
description: 清理远端跟踪分支已不存在的本地分支。当用户说“清理分支”“删除 gone 分支”“清理本地陈旧分支”或希望移除远端已删除的本地分支时使用。也会处理这些分支关联的 worktree。
---

# Git 清理 Gone 分支

清理那些远端跟踪分支已经消失的本地分支。

## 工作流

### 第 1 步：获取上下文

运行以下命令：

```bash
git fetch --prune
git branch -vv
git worktree list
```

找出 `git branch -vv` 输出中标记为 `: gone]` 的分支。

### 第 2 步：分析每个分支

对每个 gone 分支：

1. 检查它是否关联了 worktree
2. 检查它是否已经完全合并到默认分支
3. 检查它是否包含未合并提交

可使用：

```bash
git branch --merged <default-branch>
git log <default-branch>..<branch> --oneline
```

### 第 3 步：制定清理计划

将 gone 分支分成两类：

- `safe to delete`：已合并，或明显是已完成工作
- `needs review`：仍有未合并提交，可能需要保留

如果分支附带 worktree，先移除 worktree，再删除分支。

### 第 4 步：向用户展示计划

汇总如下内容：

- 可安全删除的分支
- 需要用户确认的分支
- 将被移除的 worktree

如果没有找到 gone 分支，直接说明并停止。

### 第 5 步：执行清理

删除前必须得到用户确认。

对于每个已确认删除的分支：

```bash
git worktree remove <path>   # 如果该分支有 worktree
git branch -d <branch>       # 已合并时
git branch -D <branch>       # 用户明确同意强制删除时
```

### 第 6 步：报告结果

报告：

- 已删除的分支
- 已移除的 worktree
- 因存在未合并提交而保留的分支
