---
name: git-commit
description: 创建一条清晰、能表达变更价值的 git 提交信息。当用户说“commit”“保存这些改动”“创建提交”或希望提交已暂存/未暂存改动时使用。会遵循仓库现有约定；若没有，则默认使用 conventional commit。
---

# Git 提交

把当前工作区改动整理成一条高质量的 git commit。

## 工作流

### 第 1 步：收集上下文

运行以下命令了解当前状态：

```bash
git status
git diff HEAD
git branch --show-current
git log --oneline -10
git rev-parse --abbrev-ref origin/HEAD
```

最后一条命令会返回远端默认分支（例如 `origin/main`）。去掉 `origin/` 前缀即可得到分支名。如果命令失败，或者只返回 `HEAD`，尝试：

```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

如果两者都失败，则回退为 `main`。

如果这一步的 `git status` 显示工作树干净，没有已暂存、已修改或未跟踪文件，说明没有内容可提交，直接停止。

如果 `git branch --show-current` 返回空值，说明仓库处于 detached HEAD。若用户希望把工作附着到某个分支上，应先说明需要分支，并询问是否现在创建 feature branch。使用平台的阻塞式提问工具；如果没有提问工具，则展示选项并等待用户回复。

- 如果用户选择创建分支，根据改动内容推导分支名，执行 `git checkout -b <branch-name>`，然后重新获取当前分支名。
- 如果用户拒绝，则继续在 detached HEAD 上提交。

### 第 2 步：确定提交信息约定

按以下优先级判断：

1. 已在上下文中的仓库约定
2. 最近 10 条提交历史
3. 默认使用 conventional commits：`type(scope): description`

### 第 3 步：判断是否应拆分逻辑提交

在把所有文件一起暂存之前，先检查改动是否天然分成多个独立关注点。

原则：

- 只在**文件级别**拆分，不用 `git add -p`
- 如果区分很明确，就拆分
- 如果边界模糊，一条提交即可
- 2 到 3 条逻辑提交通常最合适，不要过度切分

### 第 4 步：暂存并提交

再次运行 `git branch --show-current`。如果当前分支是 `main`、`master`，或前面解析出的默认分支，提醒用户当前正在主分支提交，并询问是继续还是先建 feature branch。使用平台的阻塞式提问工具；如果不可用，则展示选项并等待回复。

优先按文件名精确暂存相关文件，而不是使用 `git add -A` 或 `git add .`，以免意外把 `.env`、凭据文件或无关改动一并提交。

编写提交信息：

- **Subject**：简洁、祈使句，聚焦“为什么”
- **Body**：仅在必要时补充动机、权衡或背景

使用 heredoc 保留格式：

```bash
git commit -m "$(cat <<'EOF'
type(scope): subject line here

Optional body explaining why this change was made,
not just what changed.
EOF
)"
```

### 第 5 步：确认结果

提交后运行 `git status` 验证成功，并汇报提交哈希和主题行。
