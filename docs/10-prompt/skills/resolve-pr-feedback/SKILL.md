---
name: resolve-pr-feedback
description: 通过评估有效性和并行解决问题来解决 PR​​ 审查反馈。在处理 PR 审核意见、解决审核线程或修复代码审核反馈时使用。
argument-hint: "[PR number, comment URL, or blank for current branch's PR]"
disable-model-invocation: true
allowed-tools: Bash(gh *), Bash(git *), Read
---
# 解决 PR 审核反馈

评估并修复 PR 审核反馈，然后回复并解决话题。为每个线程生成并行代理。

> **代理时间很便宜。科技债务成本高昂。**
> 修复所有有效的问题——包括挑剔和低优先级的项目。如果我们已经在代码中，请修复它而不是放弃它。

## 模式检测

|论证|模式|
|----------|------|
|没有争论| **完整** -- 当前分支 PR 上所有未解析的线程 |
| PR 编号（例如 `123`）| **完整** -- 该 PR 上所有未解决的线程 |
|评论/话题 URL | **有针对性** -- 仅针对特定线程 |

**定向模式**：提供 URL 时，仅处理该反馈。不要获取或处理其他线程。

---

## 完整模式

### 1. 获取未解决的线程

如果没有提供 PR 号，则从当前分支检测：
```bash
gh pr view --json number -q .number
```
然后使用 [scripts/get-pr-comments](scripts/get-pr-comments) 中的 GraphQL 脚本获取所有反馈：
```bash
bash scripts/get-pr-comments PR_NUMBER
```
返回具有三个键的 JSON 对象：

|关键|内容 |有文件/行吗？ |可以解决吗？ |
|-----|----------|----------------|------------|
| `review_threads` |未解决的、未过时的内联代码审查线程 |是的 |是（GraphQL）|
| `pr_comments` |顶级PR对话评论（不包括PR作者）|没有 |没有 |
| `review_bodies` |使用非空文本审查提交正文（不包括 PR 作者）|没有 |没有 |

如果脚本失败，则回退到：
```bash
gh pr view PR_NUMBER --json reviews,comments
gh api repos/{owner}/{repo}/pulls/PR_NUMBER/comments
```
### 2. 分类：将新的与待处理的分开

在处理之前，将每条反馈分类为**新**或**已处理**。

**查看主题**：阅读主题的评论。如果有实质性答复承认问题但推迟采取行动（例如，“需要对此进行协调”、“将考虑这个问题”，或者提出选项但未解决的答复），则这是一个 **待决决定** - 不要重新处理。如果只有原始审稿人评论而没有实质性回复，则它是**新**。

**公关评论和审查机构**：这些没有解决机制，因此它们在每次运行时都会重新出现。检查 PR 对话中是否存在引用并解决反馈的现有回复。如果回复已存在，请跳过。如果没有，那就是新的。

区别在于内容，而不在于谁发布了什么。队友的推迟、之前的技能运行或手动回复都算在内。

如果所有反馈类型都没有新项目，请跳过步骤 3-7，直接进入步骤 8。

### 3. 计划

创建按类型分组的所有**新**未解决项目的任务列表（例如，Claude Code 中的 `TaskCreate`，Codex 中的 `update_plan`）：
- 要求更改代码
- 需要回答的问题
- 风格/惯例修复
- 需要测试添加

### 4. 实施（并行）

处理所有三种反馈类型。评论主题是主要类型；公关评论和审查机构是次要的，但不应忽视。

**对于审核线程** (`review_threads`)：为每个线程生成一个 `spec-first:workflow:pr-comment-resolver` 代理。

每个代理收到：
- 线程ID
- 文件路径和行号
- 完整评论文本（线程中的所有评论）
- PR 编号（用于上下文）
- 反馈类型（`review_thread`）**对于 PR 评论和审查机构** (`pr_comments`、`review_bodies`)：这些缺乏文件/行上下文。为每个可操作项目生成一个 `spec-first:workflow:pr-comment-resolver` 代理。代理接收评论 ID、正文、PR 编号和反馈类型（`pr_comment` 或 `review_body`）。代理必须从评论文本和 PR 差异中识别相关文件。

每个代理都会返回一个简短的摘要：
- **结论**：`fixed`、`fixed-differently`、`replied`、`not-addressing` 或 `needs-human`
- **feedback_id**：它处理的线程ID或评论ID
- **反馈类型**：`review_thread`、`pr_comment` 或 `review_body`
- **reply_text**：对帖子的Markdown回复（引用原始反馈的相关部分）
- **files_changed**：已修改的文件列表（如果回复/未寻址则为空）
- **原因**：简要说明已完成的操作或跳过的原因

判决书含义：
- `fixed` -- 按要求进行代码更改
- `fixed-differently` -- 进行了代码更改，但采用了比建议更好的方法
- `replied` -- 无需更改代码；回答问题、确认反馈或解释设计决策
- `not-addressing`——反馈的代码实际上是错误的；有证据就跳过
- `needs-human` -- 无法确定正确的动作；需要用户决定

**分批**：如果总共有 1-4 件商品，则并行发送所有商品。对于 5 个以上的物品，以 4 为一组进行批次。

**避免冲突**：如果多个线程引用同一文件，请将它们分组到单个代理调度中，以避免并行编辑冲突。处理多线程文件的代理接收该文件的所有线程并按顺序对它们进行寻址。修复有时可能会超出其引用的文件范围（例如，重命名方法会在其他地方更新调用者）。这种情况很少见，但可能会导致并行代理发生碰撞。验证步骤（步骤 7）捕获此问题 - 如果重新获取显示未解析的线程，或者如果提交显示不一致的更改，则按顺序重新运行受影响的代理。

不支持并行调度的平台应按顺序运行代理。

### 5. 提交并推送

所有代理完成后，检查是否确实更改了任何文件。如果所有结论都是 `replied`、`not-addressing` 或 `needs-human`（没有代码更改），则完全跳过此步骤并继续执行步骤 6。

如果有文件更改：

1. 仅暂存子代理报告的文件并提交引用 PR 的消息：
```bash
git add [files from agent summaries]
git commit -m "Address PR review feedback (#PR_NUMBER)

- [list changes from agent summaries]"
```
2. 推送至远程：
```bash
git push
```
### 6.回复并解决

推送成功后，发布回复并解决（如果适用）。该机制取决于反馈类型。

#### 回复格式

所有回复均应引用原始反馈的相关部分以保持连续性。引用所讨论的特定句子或段落，如果评论很长，则不要引用整个评论。

对于固定项目：
```markdown
> [quoted relevant part of original feedback]

Addressed: [brief description of the fix]
```
对于未提及的项目：
```markdown
> [quoted relevant part of original feedback]

Not addressing: [reason with evidence, e.g., "null check already exists at line 85"]
```
对于 `needs-human` 判决，请发布回复，但不要解决该主题。让它保持开放状态以供人工输入。

#### 评论主题

1. **使用 [scripts/reply-to-pr-thread](scripts/reply-to-pr-thread) 回复**：
```bash
echo "REPLY_TEXT" | bash scripts/reply-to-pr-thread THREAD_ID
```
2. **使用 [scripts/resolve-pr-thread](scripts/resolve-pr-thread) 解决**：
```bash
bash scripts/resolve-pr-thread THREAD_ID
```
#### 公关评论和审查机构

这些无法通过 GitHub 的 API 解决。回复引用原文的顶级公关评论：
```bash
gh pr comment PR_NUMBER --body "REPLY_TEXT"
```
在回复中包含足够的引用上下文，以便读者无需滚动即可了解正在处理的评论。

### 7. 验证

重新获取反馈以确认解决方案：
```bash
bash scripts/get-pr-comments PR_NUMBER
```
`review_threads` 数组应为空（`needs-human` 项除外）。如果仍有螺纹，请对剩余螺纹重复步骤 1。

PR 评论和审核机构没有解决机制，因此它们仍会出现在输出中。通过检查公关对话来验证他们是否得到回复。

### 8.总结

简要总结所有已完成的工作。按结论分组，每项一行描述“做了什么”而不仅仅是“在哪里”。这是用户看到的主要输出。

格式：
```
Resolved N of M new items on PR #NUMBER:

Fixed (count): [brief description of each fix]
Fixed differently (count): [what was changed and why the approach differed]
Replied (count): [what questions were answered]
Not addressing (count): [what was skipped and why]
```
如果任何代理返回 `needs-human`，请附加决策部分。这些情况很少见，但信号很高。每个 `needs-human` 代理返回一个 `decision_context` 字段，其中包含结构化分析：审阅者所说的内容、代理调查的内容、为什么需要做出决定、权衡的具体选项以及代理的精益（如果有的话）。

直接呈现 `decision_context`——它已经被结构化以便用户快速阅读和决定：
```
Needs your input (count):

1. [decision_context from the agent -- includes quoted feedback,
   investigation findings, why it needs a decision, options with
   tradeoffs, and the agent's recommendation if any]
```
`needs-human` 线程已经发布了听起来很自然的确认回复，并且在 PR 上保持开放状态。

如果之前的运行有 **未决的决定**（在步骤 2 中检测到的线程已响应但仍未解决），请在新工作后将其显示出来：
```
Still pending from a previous run (count):

1. [Thread path:line] -- [brief description of what's pending]
   Previous reply: [link to the existing reply]
   [Re-present the decision options if the original context is available,
   or summarize what was asked]
```
如果阻塞问题工具可用，请使用它来询问所有待决决策（新的 `needs-human` 和先前运行的待决决策）。如果只有待决的决定并且没有完成新的工作，则摘要仅是待决的项目。

如果有可用的阻塞问题工具（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`，请使用它来呈现决策并等待用户的响应。他们决定后，处理剩余的项目：修复代码、撰写回复、发布并解决线程。

如果没有可用的问题工具，请在摘要输出中呈现决策并等待用户在对话中做出响应。如果他们没有回复，这些项目将在 PR 上保持开放状态以供稍后处理。

---

## 目标模式

当提供特定评论或话题 URL 时：

### 1. 提取线程上下文

解析 URL 以提取 OWNER、REPO、PR 编号和评论 REST ID：
```
https://github.com/OWNER/REPO/pull/NUMBER#discussion_rCOMMENT_ID
```
**第 1 步** -- 通过 REST 获取评论详细信息和 GraphQL 节点 ID（便宜，单个评论）：
```bash
gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID \
  --jq '{node_id, path, line, body}'
```
**第 2 步** -- 将评论映射到其线程 ID。使用[scripts/get-thread-for-comment](scripts/get-thread-for-comment)：
```bash
bash scripts/get-thread-for-comment PR_NUMBER COMMENT_NODE_ID [OWNER/REPO]
```
这会获取线程 ID 及其第一个评论 ID（最小字段，无正文），并返回包含完整评论详细信息的匹配线程。

### 2.修复、回复、解决

为线程生成一个 `spec-first:workflow:pr-comment-resolver` 代理。然后遵循与完整模式步骤 5-6 相同的提交 -> 推送 -> 回复 -> 解析流程。

---

## 脚本

- [scripts/get-pr-comments](scripts/get-pr-comments) -- 未解决的评论线程的 GraphQL 查询
- [scripts/get-thread-for-comment](scripts/get-thread-for-comment) -- 将评论节点 ID 映射到其父线程（针对目标模式）
- [scripts/reply-to-pr-thread](scripts/reply-to-pr-thread) -- GraphQL 突变以在审阅线程中回复
- [scripts/resolve-pr-thread](scripts/resolve-pr-thread) -- GraphQL 突变通过 ID 解析线程

## 成功标准

- 评估所有未解决的审核线程
- 提交并推送的有效修复
- 每个线程都用引用的上下文进行回复
- 通过 GraphQL 解析的线程（`needs-human` 除外）
- 验证时 get-pr-comments 的结果为空（减去有意打开的线程）
