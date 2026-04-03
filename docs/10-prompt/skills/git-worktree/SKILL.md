---
name: git-worktree
description: 此技能管理 Git 工作树以进行隔离并行开发。它遵循 KISS 原则，通过简单的交互界面处理创建、列出、切换和清理工作树。
---
# Git 工作树管理器

此技能提供了一个统一的界面，用于管理整个开发工作流程中的 Git 工作树。无论您是单独审查 PR 还是并行开发功能，此技能都可以处理所有复杂性。

## 该技能的作用

- **从具有明确分支名称的主分支创建工作树**
- **列出工作树**及其当前状态
- **在工作树之间切换**以实现并行工作
- **自动清理已完成的工作树**
- **每一步的交互式确认**
- **工作树目录的自动 .gitignore 管理**
- **自动 .env 文件复制**从主存储库到新工作树
- **自动开发工具信任**，用于带有审查安全护栏的 mise 和 direnv 配置

## 关键：始终使用管理器脚本

**切勿直接调用 `git worktree add`。** 始终使用 `worktree-manager.sh` 脚本。

该脚本处理原始 git 命令不处理的关键设置：
1. 从主仓库复制 `.env`、`.env.local`、`.env.test` 等
2. 信任具有分支感知安全规则的开发工具配置：
   - mise：仅当受信任的基线分支未发生变化时才自动信任
   - direnv：仅自动允许受信任的基础分支；查看工作树保留手册
3. 确保 `.worktrees` 位于 `.gitignore` 中
4. 创建一致的目录结构
```bash
# ✅ CORRECT - Always use the script
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh create feature-name

# ❌ WRONG - Never do this directly
git worktree add .worktrees/feature-name -b feature-name main
```
## 何时使用此技能

在以下场景中使用此技能：

1. **代码审查（`/spec:review`）**：如果尚未在目标分支（PR 分支或请求的分支）上，则提供工作树进行隔离审查
2. **功能工作（`/spec:work`）**：始终询问用户是否想要并行工作树或实时分支工作
3. **并行开发**：同时处理多个功能时
4. **清理**：完成工作树中的工作后

## 如何使用

### 在 Claude 代码工作流程中

该技能会自动从 `/spec:review` 和 `/spec:work` 命令调用：
```
# For review: offers worktree if not on PR branch
# For work: always asks - new branch or worktree?
```
### 手动使用

您还可以直接从 bash 调用该技能：
```bash
# Create a new worktree (copies .env files automatically)
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh create feature-login

# List all worktrees
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh list

# Switch to a worktree
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh switch feature-login

# Copy .env files to an existing worktree (if they weren't copied)
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh copy-env feature-login

# Clean up completed worktrees
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh cleanup
```
## 命令

### `create <branch-name> [from-branch]`

使用给定的分支名称创建一个新的工作树。

**选项：**
- `branch-name`（必需）：新分支和工作树的名称
- `from-branch`（可选）：创建的基础分支（默认为 `main`）

**示例：**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh create feature-login
```
**发生了什么：**
1. 检查工作树是否已经存在
2.从远程更新基础分支
3. 创建新的工作树和分支
4. **从主存储库复制所有 .env 文件**（.env、.env.local、.env.test 等）
5. **使用分支感知安全规则信任开发工具配置**：
   - 可信碱基（`main`、`develop`、`dev`、`trunk`、`staging`、`release/*`）与自身进行比较
   - 其他分支与默认分支进行比较
   - direnv auto-allow 在不受信任的基础上被跳过，因为 `.envrc` 可以获取未经检查的文件
6. 显示 cd 到工作树的路径

### `list` 或 `ls`

列出所有可用的工作树及其分支和当前状态。

**例子：**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh list
```
**输出显示：**
- 工作树名称
- 分行名称
- 哪个是最新的（标有 ✓）
- 主要回购状态

### `switch <name>` 或 `go <name>`

切换到现有工作树并进入其中。

**例子：**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh switch feature-login
```
**可选：**
- 如果未提供名称，则列出可用的工作树并提示选择

### `cleanup` 或 `clean`

通过确认以交互方式清理不活动的工作树。

**例子：**
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh cleanup
```
**发生了什么：**
1. 列出所有不活动的工作树
2. 要求确认
3. 删除选定的工作树
4.清理空目录

## 工作流程示例

### 使用 Worktree 进行代码审查
```bash
# Claude Code recognizes you're not on the PR branch
# Offers: "Use worktree for isolated review? (y/n)"

# You respond: yes
# Script runs (copies .env files automatically):
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh create pr-123-feature-name

# You're now in isolated worktree for review with all env vars
cd .worktrees/pr-123-feature-name

# After review, return to main:
cd ../..
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh cleanup
```
### 并行功能开发
```bash
# For first feature (copies .env files):
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh create feature-login

# Later, start second feature (also copies .env files):
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh create feature-notifications

# List what you have:
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh list

# Switch between them as needed:
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh switch feature-login

# Return to main and cleanup when done:
cd .
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh cleanup
```
## 关键设计原则

### KISS（保持简单，愚蠢）

- **一个管理器脚本** 处理所有工作树操作
- **简单的命令**，具有合理的默认值
- **互动提示**防止误操作
- **明确命名**直接使用分支名称

### 固执己见的默认值

- 工作树始终从 **main** 创建（除非指定）
- 工作树存储在 **.worktrees/** 目录中
- 分支名称成为工作树名称
- **.gitignore** 自动管理

### 安全第一

- **创建**工作树之前确认
- **清理前确认**以防止意外移除
- **不会删除当前工作树**
- **清除问题的错误消息**

## 与工作流程集成

### `/spec:review`

而不是总是创建工作树：
```
1. Check current branch
2. If ALREADY on target branch (PR branch or requested branch) → stay there, no worktree needed
3. If DIFFERENT branch than the review target → offer worktree:
   "Use worktree for isolated review? (y/n)"
   - yes → call git-worktree skill
   - no → proceed with PR diff on current branch
```
### `/spec:work`

始终提供选择：
```
1. Ask: "How do you want to work?
   1. New branch on current worktree (live work)
   2. Worktree (parallel work)"

2. If choice 1 → create new branch normally
3. If choice 2 → call git-worktree skill to create from main
```
## 故障排除

###“工作树已经存在”

如果您看到此内容，脚本会询问您是否要切换到它。

###“无法删除工作树：它是当前工作树”

首先切换出工作树（到主存储库），然后进行清理：
```bash
cd $(git rev-parse --show-toplevel)
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh cleanup
```
### 迷失在工作树中？

看看你在哪里：
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh list
```
### 工作树中缺少 .env 文件？

如果创建的工作树没有 .env 文件（例如，通过原始 `git worktree add`），请复制它们：
```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/git-worktree/scripts/worktree-manager.sh copy-env feature-name
```
导航回到主界面：
```bash
cd $(git rev-parse --show-toplevel)
```
## 技术细节

### 目录结构
```
.worktrees/
├── feature-login/          # Worktree 1
│   ├── .git
│   ├── app/
│   └── ...
├── feature-notifications/  # Worktree 2
│   ├── .git
│   ├── app/
│   └── ...
└── ...

.gitignore (updated to include .worktrees)
```
### 它是如何运作的

- 对于隔离环境使用 `git worktree add`
- 每个工作树都有自己的分支
- 一个工作树的变化不会影响其他工作树
- 与主仓库共享 git 历史记录
- 可以从任何工作树推送

### 性能

- 工作树是轻量级的（只是文件系统链接）
- 没有存储库重复
- 共享 git 对象以提高效率
- 比克隆或隐藏/切换快得多
