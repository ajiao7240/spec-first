---
name: reproduce-bug
description: 系统地重现并调查 GitHub 问题中的错误。当用户提供他们想要重现或调查的错误的 GitHub 问题号或 URL 时使用。
argument-hint: "[GitHub issue number or URL]"
---
# 重现错误

与框架无关、假设驱动的工作流程，用于重现和调查问题报告中的错误。适用于任何语言、框架或项目类型。

## 第一阶段：了解问题

在接触代码库之前获取并分析错误报告以提取结构化信息。

### 获取问题

如果没有提供问题编号或 URL 作为参数，请在继续之前询问用户（使用平台的问题工具 - 例如，Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user` - 或提出提示并等待回复）。
```bash
gh issue view $ARGUMENTS --json title,body,comments,labels,assignees
```
如果参数是 URL 而不是数字，请提取问题编号或将 URL 直接传递给 `gh`。

### 提取关键细节

阅读问题和评论，然后确定：

- **报告的症状** -- 用户观察到的内容（错误消息、错误输出、视觉故障、崩溃）
- **预期行为** -- 应该发生什么
- **复制步骤** - 记者提供的任何步骤
- **环境线索** -- 浏览器、操作系统、版本、用户角色、数据情况
- **频率** -- 总是可重复的、间歇性的或一次性的

如果问题缺乏重现步骤或不明确，请注意缺少的内容 - 这将决定调查策略。

## 第二阶段：假设

在运行任何操作之前，请形成有关根本原因的理论。这可以集中调查并防止漫无目的的探索。

### 搜索相关代码

使用本机内容搜索工具（例如 Claude Code 中的 Grep）查找与报告的症状相关的代码路径。搜索：

- 问题中提到的错误消息或字符串
- 报告中描述的要素名称、路线路径或 UI 标签
- 相关型号/服务/控制器名称

### 形成假设

根据问题详细信息和代码搜索结果，写下 2-3 个合理的假设。每个人都应该确定：

- **什么**可能是错误的（例如，“会话刷新中的竞争条件”、“可选字段上缺少 nil 检查”）
- 代码库中的 **Where**（特定文件和行范围）
- **为什么**它会产生所报告的症状

按可能性对假设进行排名。首先开始调查最有可能的一个。

## 第三阶段：再现

尝试触发错误。重现策略取决于错误类型。

### 路线A：基于测试的重现（后端、逻辑、数据错误）编写或找到一个现有的测试来执行可疑的代码路径：

1. 使用本机文件搜索工具搜索涵盖受影响代码的现有测试文件（例如 Claude Code 中的 Glob）
2. 运行现有测试以查看是否有任何已失败
3. 如果没有测试涵盖该场景，请编写一个最小的失败测试来演示所报告的行为
4. 与报告的症状相匹配的失败测试证实了该错误

### 路线 B：基于浏览器的再现（UI、视觉、交互错误）

使用 `agent-browser` CLI 实现浏览器自动化。请勿使用任何替代浏览器 MCP 集成或内置浏览器控制工具。有关设置和详细 CLI 用法，请参阅 `agent-browser` 技能。

#### 验证服务器正在运行
```bash
agent-browser open http://localhost:${PORT:-3000}
agent-browser snapshot -i
```
如果服务器未运行，请要求用户启动其开发服务器并提供正确的端口。

要检测正确的端口，请检查项目指令文件（`AGENTS.md`、`CLAUDE.md`）以获取端口引用，然后检查 `package.json` 开发脚本，然后检查 `.env` 文件，最后检查 `3000`。

####遵循复制步骤

导航到受影响的区域并执行问题中的步骤：
```bash
agent-browser open "http://localhost:${PORT}/[affected_route]"
agent-browser snapshot -i
```
使用 `agent-browser` 命令与页面交互：
- `agent-browser click @ref` -- 单击元素
- `agent-browser fill @ref "text"` -- 填写表单字段
- `agent-browser snapshot -i` -- 捕获当前状态
- `agent-browser screenshot bug-evidence.png` -- 保存视觉证据

#### 捕获错误状态

当错误重现时：
1. 错误状态截图
2. 检查控制台错误：查看浏览器输出和任何可见的错误消息
3. 记录触发它的确切步骤顺序

###路线C：手动/特定环境再现

对于需要特定数据条件、用户角色、外部服务状态或无法自动化的错误：

1.记录需要什么条件
2.询问用户（使用平台的提问工具——例如Claude Code中的`AskUserQuestion`、Codex中的`request_user_input`、Gemini中的`ask_user`——或提出选项并等待回复）是否可以设置所需的条件
3. 如果需要，指导他们完成手动复制步骤

### 如果复制失败

如果在尝试最可能的假设后无法重现错误：

1. 重新审视剩余的假设
2. 检查错误是否与环境相关（版本、操作系统、浏览器、数据相关）
3. 在代码库中搜索受影响区域的最新更改：`git log --oneline -20 -- [affected_files]`
4. 记录尝试过的内容以及可能缺少的条件

## 第四阶段：调查

使用项目提供的任何可观察性来深入挖掘根本原因。

### 检查日志和痕迹

搜索复制期间的错误、警告或意外行为。检查什么取决于错误以及项目可用的内容：- **应用程序日志** -- 使用本机内容搜索工具搜索本地日志输出（开发服务器标准输出、日志文件）以查找错误模式、堆栈跟踪或警告
- **错误跟踪** -- 检查项目错误跟踪器中的相关异常（Sentry、AppSignal、Bugsnag、Datadog 等）
- **浏览器控制台** -- 对于 UI 错误，请检查开发人员控制台输出是否存在 JavaScript 错误、失败的网络请求或 CORS 问题
- **数据库状态** -- 如果错误涉及数据，请检查相关记录是否有意外值、缺少关联或违反约束
- **请求/响应周期** -- 检查特定请求的服务器日志：状态代码、参数、计时、中间件行为

### 跟踪代码路径

从阶段 2 中确定的入口点开始，跟踪执行路径：

1.使用原生文件读取工具读取相关源文件
2. 确定行为与预期的差异
3. 检查边缘情况：nil/null 值、空集合、边界条件、竞争条件
4.查找最近可能引入错误的更改：`git log --oneline -10 -- [file]`

## 第 5 阶段：记录调查结果

总结调查期间发现的所有内容。

### 编译报告

将调查结果整理为：

1. **根本原因** - 实际错误是什么以及错误所在（包含文件路径和行号，例如 `app/services/example_service.rb:42`）
2. **重现步骤** -- 已验证的触发bug的步骤（标记为已确认或未确认）
3. **证据**——屏幕截图、测试输出、日志摘录、控制台错误
4. **建议的修复** - 如果修复是明显的，请用所需的特定代码更改来描述它
5. **开放性问题**——任何尚不清楚或需要进一步调查的问题

### 在任何外部操作之前呈现给用户向用户呈现完整的报告。未经明确确认，请勿对 GitHub 问题发表评论或采取任何外部操作。

询问用户（使用平台的提问工具，或提供选项并等待）：
```
Investigation complete. How to proceed?

1. Post findings to the issue as a comment
2. Start working on a fix
3. Just review the findings (no external action)
```
如果用户选择发布问题：
```bash
gh issue comment $ARGUMENTS --body "$(cat <<'EOF'
## Bug Investigation

**Root Cause:** [summary]

**Reproduction Steps (verified):**
1. [step]
2. [step]

**Relevant Code:** [file:line references]

**Suggested Fix:** [description if applicable]
EOF
)"
```
