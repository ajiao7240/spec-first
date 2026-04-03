---
name: git-commit-push-pr
description: 提交、推送并开启具有适应性、价值优先描述的 PR。当用户说“提交并 PR”、“推送并打开 PR”、“发布此”、“创建 PR”、“打开拉取请求”、“提交推送 PR”，或者想要一步从工作更改转到打开拉取请求时使用。当用户说“更新 PR 描述”、“刷新 PR 描述”、“刷新 PR”或想要重写现有 PR 描述时也可使用。生成随着变更的复杂性而深入扩展的 PR 描述，避免千篇一律的模板。
---
# Git 提交、推送和 PR

在单个工作流程中从工作树更改变为开放拉取请求，或更新现有 PR 描述。这项技能的关键区别在于公关描述，它传达与变革的复杂性成比例的“价值和意图”。

## 模式检测

如果用户要求更新、刷新或重写现有 PR 描述（未提及提交或推送），则这是**仅描述更新**。用户还可以提供更新的焦点（例如，“更新 PR 描述并添加基准测试结果”）。请注意 DU-3 中使用的所有焦点说明。

对于仅描述更新，请遵循下面的描述更新工作流程。否则，请遵循完整的工作流程。

---

## 描述更新工作流程

### DU-1：确认意图

请用户确认：“更新该分支的 PR 描述吗？”使用平台的屏蔽问题工具（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`）。如果没有可用的提问工具，请提出问题并等待用户的回复。

如果用户拒绝，则停止。

### DU-2：找到 PR

运行以下命令来识别分支并找到 PR：
```bash
git branch --show-current
```
如果为空（分离的 HEAD），则报告没有要更新的分支并停止。

否则，检查现有的开放 PR：
```bash
gh pr view --json url,title,state
```
解释结果。不要将每个非零退出视为致命错误：

- 如果它返回带有 `state: OPEN` 的 PR 数据，则当前分支存在打开的 PR。
- 如果它返回非 OPEN 状态（CLOSED、MERGED）的 PR 数据，则将其视为“未打开 PR”。报告该分支不存在开放 PR 并停止。
- 如果它以非零值退出并且输出表明当前分支不存在拉取请求，则将其视为正常的“此分支无 PR”状态。报告该分支不存在开放 PR 并停止。
- 如果由于其他原因（身份验证、网络、存储库配置）而出错，请报告错误并停止。

### DU-3：编写并应用更新的描述

阅读当前的 PR 描述：
```bash
gh pr view --json body --jq '.body'
```
按照步骤 6 的“检测基本分支和远程”和“收集分支范围”部分获取完整分支差异。使用 DU-2 中找到的 PR 作为基本分支检测的现有 PR。然后按照步骤 6 中的编写原则编写新的描述。如果用户提供了焦点，请将其与分支差异上下文一起合并到描述中。

将新的描述与当前的描述进行比较，并为用户总结重大变化（例如，“增加了新缓存层的覆盖范围，更新了测试计划，删除了过时的迁移注释”）。如果用户提供了焦点，请确认该问题已得到解决。申请前请用户确认。使用平台的屏蔽问题工具（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`）。如果没有可用的提问工具，则呈现摘要并等待用户的回复。

如果确认，请申请：
```bash
gh pr edit --body "$(cat <<'EOF'
Updated description here
EOF
)"
```
报告 PR URL。

---

## 完整的工作流程

### 第 1 步：收集背景信息

运行这些命令。
```bash
git status
git diff HEAD
git branch --show-current
git log --oneline -10
git rev-parse --abbrev-ref origin/HEAD
```
最后一个命令返回远程默认分支（例如，`origin/main`）。去掉 `origin/` 前缀即可获取分支名称。如果命令失败或返回空的 `HEAD`，请尝试：
```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```
如果两者都失败，则退回到 `main`。

运行`git branch --show-current`。如果它返回空结果，则存储库处于分离的 HEAD 状态。说明在提交和推送之前需要一个分支。询问是否立即创建功能分支。使用平台的阻塞问题工具（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`）。如果没有可用的提问工具，则显示选项并等待用户的回复。

- 如果用户同意，则从更改内容中派生一个描述性分支名称，使用 `git checkout -b <branch-name>` 创建它，然后再次运行 `git branch --show-current` 并将该结果用作工作流其余部分的当前分支名称。
- 如果用户拒绝，则停止。

如果此步骤的 `git status` 结果显示干净的工作树（没有暂存、修改或未跟踪的文件），请在停止之前检查是否有未推送的提交或丢失的 PR：

1. 运行`git branch --show-current`获取当前分支名称。
2. 执行`git rev-parse --abbrev-ref --symbolic-full-name @{u}`检查是否配置了上行。
3. 如果命令成功，请使用上一个命令中的上游名称运行 `git log <upstream>..HEAD --oneline`。
4. 如果配置了上游，请使用步骤3中的方法检查是否存在现有PR。- 如果当前分支是 `main`、`master` 或步骤 1 中已解析的默认分支，并且没有 **没有上游** 或有 **未推送的提交**，请说明现在推送将直接使用默认分支。询问是否先创建feature分支。使用平台的阻塞问题工具（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`）。如果没有可用的提问工具，则显示选项并等待用户的回复。
- 如果用户同意，则从更改内容中派生一个描述性分支名称，使用 `git checkout -b <branch-name>` 创建它，然后从步骤 5 继续（推送）。
- 如果用户拒绝，则报告此工作流无法直接从默认分支打开 PR 并停止。
- 如果**没有上游**，则将该分支视为需要第一次推送。跳过步骤 4（提交）并从步骤 5 继续（推送）。
- 如果存在**未推送的提交**，请跳过步骤 4（提交）并从步骤 5（推送）继续。
- 如果所有提交均已推送，但 **不存在打开的 PR** 并且当前分支是 `main`、`master` 或步骤 1 中已解析的默认分支，则报告没有可作为 PR 打开的功能分支工作并停止。
- 如果所有提交均已推送但**不存在打开的 PR**，请跳过步骤 4-5 并从步骤 6（编写 PR 描述）和步骤 7（创建 PR）继续。
- 如果所有提交都被推送**并且存在开放的 PR**，请报告并停止 - 没有什么可做的。

### 第 2 步：确定约定

请遵循提交消息 * 和 * PR 标题的优先顺序：1. **Repo 约定已在上下文中** -- 如果加载项目说明（AGENTS.md、CLAUDE.md 或类似）并指定约定，请遵循这些说明。不要重新阅读这些文件；它们在会话开始时加载。
2. **最近提交历史记录** -- 如果不存在显式约定，则匹配最近 10 次提交中可见的模式。
3. **默认：常规提交** -- `type(scope): description` 作为后备。

### 第 3 步：检查现有 PR

运行 `git branch --show-current` 获取当前分支名称。如果此处返回空结果，则报告工作流仍处于分离的 HEAD 状态并停止。

然后检查现有的开放 PR：
```bash
gh pr view --json url,title,state
```
解释结果。不要将每个非零退出视为致命错误：

- 如果它 **返回带有 `state: OPEN`** 的 PR 数据，则当前分支存在打开的 PR。记下 URL 并继续执行步骤 4（提交）和步骤 5（推送）。然后跳到步骤 7（现有 PR 流程），而不是创建新 PR。
- 如果它 **返回非 OPEN 状态**（CLOSED、MERGED）的 PR 数据，则将其视为“不存在 PR”——前一个 PR 已完成，需要一个新的 PR。像平常一样继续步骤 4 到步骤 8。
- 如果它**以非零值退出并且输出表明当前分支不存在拉取请求**，则不存在 PR。像平常一样继续步骤 4 到步骤 8。
- 如果出现**错误**（身份验证、网络、存储库配置），请向用户报告错误并停止。

### 步骤 4：分支、暂存和提交

1. 运行`git branch --show-current`。如果它返回 `main`、`master` 或步骤 1 中解析的默认分支，请首先使用 `git checkout -b <branch-name>` 创建一个描述性功能分支。从变更内容中得出分支名称。
2. 在将所有内容放在一起之前，扫描已更改的文件以查找自然不同的问题。如果修改的文件明确分组为单独的逻辑更改（例如，一组文件中的重构和另一组文件中的新功能），请为每个组创建单独的提交。保持这个轻量级——仅在**文件级别**进行分组（无`git add -p`），仅在明显时进行拆分，并且最多进行两到三个逻辑提交。如果不明确，一次提交就可以了。
3. 按名称暂存相关文件。避免使用 `git add -A` 或 `git add .`，以防止意外包含敏感文件。
4. 遵守步骤 2 中的约定。对消息使用heredoc。

### 第 5 步：推送
```bash
git push -u origin HEAD
```
### 第 6 步：编写 PR 描述

在编写之前，确定**基础分支**并收集**完整分支范围**。步骤 1 中的工作树差异仅显示调用时未提交的更改 - PR 描述必须涵盖将出现在 PR 中的 **所有提交**。

#### 检测基础分支和远程分支

解析基本分支**和**托管它的远程分支。在基于分叉的 PR 中，基础存储库可能对应于除 `origin`（通常为 `upstream`）之外的远程存储库。

使用这个后备链。在第一个成功的地方停止：

1. **PR 元数据**（如果在步骤 3 中找到现有 PR）：
   ```bash
   gh pr view --json baseRefName,url
   ```
   Extract `baseRefName` as the base branch name. The PR URL contains the base repository (`https://github.com/<owner>/<repo>/pull/...[[[P5]]]`[[[P6]]]`[[[P7]]]owner/repo[[[P8]]]origin[[[P9]]]origin/HEAD[[[P10]]]`[[[P11]]]`[[[P12]]]origin/[[[P13]]]origin[[[P14]]]`[[[P15]]]`[[[P16]]]origin[[[P17]]]main[[[P18]]]master[[[P19]]]develop[[[P20]]]trunk[[[P21]]]`[[[P22]]]`[[[P23]]]origin` 作为基本遥控器。如果没有解决，请要求用户指定目标分支。使用平台的屏蔽问题工具（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`）。如果没有可用的提问工具，则显示选项并等待用户的回复。

#### 收集分支范围

一旦知道基础分支和远程分支：

1. 验证本地是否存在远程跟踪引用，并在需要时获取：
   ```bash
   git rev-parse --verify <base-remote>/<base-branch>
   ```
   If this fails (ref missing or stale), fetch it:
   ```bash
   git fetch --no-tags <base-remote> <base-branch>
   ```
2. Find the merge base:
   ```bash
   git merge-base <base-remote>/<base-branch> HEAD
   ```
2. List all commits unique to this branch:
   ```bash
   git log --oneline <merge-base>..HEAD
   ```
3. Get the full diff a reviewer will see:
   ```bash
   git diff <merge-base>...HEAD
   ```

使用完整的分支差异和提交列表作为 PR 描述的基础——而不是步骤 1 中的工作树差异。

这是最重要的一步。描述必须是**自适应的**——它的深度应该与变化的复杂性相匹配。一行错误修复不需要性能结果表。一个大的架构变化不应该是一个项目符号列表。

#### 调整变更大小

在写入之前，根据完整分支差异评估沿两个轴的 PR：

- **大小**：有多少文件发生了变化？差距有多大？
- **复杂性**：这是一个简单的更改（重命名、依赖项冲突、拼写错误修复）还是涉及设计决策、权衡、新模式或横切问题？

使用它来选择正确的描述深度：|更改个人资料 |说明方法|
|---|---|
|小 + 简单（打字错误、配置、dep 碰撞）| 1-2 句话，无标题。正文不到 300 个字符。 |
|小+不平凡（有针对性的错误修复，行为改变）|简短的“问题/修复”叙述，约 3-5 句话。足以让审阅者在不阅读差异的情况下理解*为什么*。除非有两个不同的问题，否则不需要标头。 |
|中等功能或重构 |摘要段落，然后是解释更改内容和原因的部分。提出设计决策。 |
|大型或具有建筑意义的 |完整叙述：问题背景、选择的方法（以及原因）、关键决策、迁移说明或回滚注意事项（如果相关）。 |
|绩效提升|包括之前/之后的测量（如果有）。降价表在这里有效。 |

**对于小改动来说，简洁很重要。** 3 行 bug 修复和 20 行 PR 描述表明作者没有进行校准。将描述的权重与变更的权重相匹配。如果有疑问，越短越好——审阅者可以阅读差异。

#### 写作原则- **以价值引导**：第一句话应该告诉审阅者*为什么此 PR 存在*，而不是*哪些文件发生了变化*。 “修复批量导出期间的超时错误”击败“更新的export_handler.py和config.yaml”。
- **没有孤立的开头段落**：如果描述在任何地方使用 `##` 节标题，则开头摘要也必须位于标题下（例如 `## Summary`）。无标题段落后跟有标题的部分看起来像是缺少标题。对于没有章节的简短描述，一个简单的段落就可以了。
- **描述最终结果，而不是过程**：PR 描述是关于最终状态 - 发生了什么变化以及原因。不要包含工作产品详细信息，例如开发期间发现和修复的错误、中间故障、调试步骤、迭代历史记录或一路上完成的重构。这些是完成工作的一部分，而不是结果的一部分。如果在开发过程中发生错误修复，则该修复已经在差异中 - 在描述中提及它意味着审阅者应该评估它是一个单独的问题，而实际上它只是最终实现的一部分。例外：仅当流程细节对于审阅者理解设计选择至关重要时才包含流程细节（例如，“首先尝试了 X 方法，但它导致了 Y，所以改为使用 Z”）。
- **当提交冲突时，相信最终的差异**：提交列表支持上下文，而不是最终 PR 描述的事实来源。如果提交消息描述了后来修改或恢复的中间步骤（例如，“切换到 gh pr list”，随后又更改回 `gh pr view`），请描述完整分支差异显示的最终状态。不要叙述矛盾的提交历史，就好像所有的提交历史都已交付一样。
- **解释不明显的**：如果差异是不言自明的，则不要叙述它。将描述空间花在差异*未*显示的内容上：为什么采用这种方法，考虑和拒绝了什么，审阅者应该注意什么。
- **当它值得保留时使用结构**：标题、项目符号列表和表格都是工具——当它们有助于理解时使用它们，而不是作为强制性的模板部分。空的“## Breaking Changes”部分会增加噪音。
- **数据降价表**：当存在前后比较、性能数字或选项权衡时，表格可以很好地传达密度。例子：```markdown
  | Metric | Before | After |
  |--------|--------|-------|
  | p95 latency | 340ms | 120ms |
  | Memory (peak) | 2.1GB | 1.4GB |
  ```

- **No empty sections**: If a section (like "Breaking Changes" or "Migration Guide") doesn't apply, omit it entirely. Do not include it with "N/A" or "None".
- **Test plan -- only when it adds value**: Include a test plan section when the testing approach is non-obvious: edge cases the reviewer might not think of, verification steps for behavior that's hard to see in the diff, or scenarios that require specific setup. Omit it for straightforward changes where the tests are self-explanatory or where "run the tests" is the only useful guidance. A test plan for "verify the typo is fixed" is noise.

#### Numbering and references

**Never prefix list items with `#`** in PR descriptions. GitHub interprets `#1`, `#2`等作为问题/PR 参考并自动链接它们。而不是：
```markdown
## Changes
#1. Updated the parser
#2. Fixed the validation
```
写：
```markdown
## Changes
1. Updated the parser
2. Fixed the validation
```
引用实际的 GitHub 问题或 PR 时，请使用完整格式：`org/repo#123` 或完整 URL。除非您已验证它指的是当前存储库中的正确问题，否则切勿使用裸露的 `#123`。

#### 规格第一徽章

将徽章页脚附加到 PR 描述中，并用 `---` 规则分隔。如果描述已包含规格优先徽章（例如，由 `spec:work` 等其他技能添加），请勿添加。
```markdown
---

[![Spec First v[VERSION]](https://img.shields.io/badge/Spec_First-v[VERSION]-6366f1)](https://github.com/sunrain520/spec-first)
🤖 Generated with [MODEL] ([CONTEXT] context, [THINKING]) via [HARNESS](HARNESS_URL)
```
PR创建时填写：

|占位符 |价值|示例|
|------------|--------|---------|
| `[MODEL]` |型号名称 |克劳德作品 4.6，GPT-5.4 |
| `[CONTEXT]` |上下文窗口（如果已知）| 20万、1M |
| `[THINKING]` |思维水平（如果已知）|延伸思考|
| `[HARNESS]` |运行你的工具|克劳德代码、Codex、Gemini CLI |
| `[HARNESS_URL]` |链接到该工具 | `https://claude.com/claude-code` |
| `[VERSION]` | `plugin.json` 或 `package.json` -> `version` | 1.3.10 |

### 第 7 步：创建或更新 PR

#### 新 PR（第 3 步中没有现有 PR）
```bash
gh pr create --title "the pr title" --body "$(cat <<'EOF'
PR description here

---

[![Spec First v[VERSION]](https://img.shields.io/badge/Spec_First-v[VERSION]-6366f1)](https://github.com/sunrain520/spec-first)
🤖 Generated with [MODEL] ([CONTEXT] context, [THINKING]) via [HARNESS](HARNESS_URL)
EOF
)"
```
PR 标题的长度应控制在 72 个字符以内。标题遵循与提交消息相同的约定（步骤 2）。

#### 现有 PR（在步骤 3 中找到）

新的提交已经在步骤 5 中推送的 PR 上。报告 PR URL，然后询问用户是否希望更新 PR 描述以反映新的更改。使用平台的屏蔽问题工具（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`）。如果没有可用的提问工具，请显示选项并等待用户回复后再继续。

- 如果**是** - 按照步骤 6 中的相同原则编写新的描述（调整完整 PR 的大小，而不仅仅是新提交的大小），包括规范优先徽章，除非现有描述中已存在该徽章。应用它：

  ```bash
  gh pr edit --body "$(cat <<'EOF'
  Updated description here
  EOF
  )"
  ```

- 如果**否** -- 完成。所需要的只是推动。

### 第 8 步：报告

输出 PR URL，以便用户可以直接导航到它。
