---
name: test-browser
description: 在受当前 PR 或分支影响的页面上运行浏览器测试
argument-hint: "[PR number, branch name, 'current', or --port PORT]"
---
# 浏览器测试技巧

使用 `agent-browser` CLI 在受 PR 或分支更改影响的页面上运行端到端浏览器测试。

## 仅将 `agent-browser` 用于浏览器自动化

此工作流程仅使用 `agent-browser` CLI。请勿使用任何替代浏览器自动化系统、浏览器 MCP 集成或内置浏览器控制工具。如果平台提供多种控制浏览器的方式，请始终选择`agent-browser`。

使用 `agent-browser` 进行：打开页面、单击元素、填写表单、截取屏幕截图以及抓取渲染内容。

特定于平台的提示：
- 在 Claude Code 中，请勿使用 Chrome MCP 工具 (`mcp__claude-in-chrome__*`)。
- 在 Codex 中，不要替换不相关的浏览工具。

## 先决条件

- 正在运行的本地开发服务器（例如，`bin/dev`、`rails server`、`npm run dev`）
- `agent-browser` CLI 安装（参见下面的设置）
- Git 存储库，包含要测试的更改

## 设置
```bash
command -v agent-browser >/dev/null 2>&1 && echo "Installed" || echo "NOT INSTALLED"
```
如果需要安装：
```bash
npm install -g agent-browser
agent-browser install
```
详细使用方法请参见`agent-browser`技能。

## 工作流程

### 1. 验证安装

开始之前，请验证 `agent-browser` 是否可用：
```bash
command -v agent-browser >/dev/null 2>&1 && echo "Ready" || (echo "Installing..." && npm install -g agent-browser && agent-browser install)
```
如果安装失败，通知用户并停止。

### 2.询问浏览器模式

询问用户是否有头运行或无头运行（使用平台的问题工具 - 例如，Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user` - 或提供选项并等待回复）：
```
Do you want to watch the browser tests run?

1. Headed (watch) - Opens visible browser window so you can see tests run
2. Headless (faster) - Runs in background, faster but invisible
```
当用户选择选项 1 时，存储选择并使用 `--headed` 标志。

### 3. 确定测试范围

**如果提供 PR 号码：**
```bash
gh pr view [number] --json files -q '.files[].path'
```
**如果“当前”或为空：**
```bash
git diff --name-only main...HEAD
```
**如果提供分行名称：**
```bash
git diff --name-only main...[branch]
```
### 4. 将文件映射到路由

将更改的文件映射到可测试的路径：

|文件模式|路线 |
|----------|----------|
| `app/views/users/*` | `/users`、`/users/:id`、`/users/new` |
| `app/controllers/settings_controller.rb` | `/settings` |
| `app/javascript/controllers/*_controller.js` |使用 Stimulus 控制器的页面 |
| `app/components/*_component.rb` |渲染该组件的页面 |
| `app/views/layouts/*` |所有页面（至少测试主页）|
| `app/assets/stylesheets/*` |关键页面上的视觉回归 |
| `app/helpers/*_helper.rb` |使用该帮助程序的页面 |
| `src/app/*` (Next.js) |对应路线 |
| `src/components/*` |使用这些组件的页面 |

根据映射构建要测试的 URL 列表。

### 5.检测开发服务器端口

使用此优先级确定开发服务器端口：

1. **显式参数** — 如果用户传递了 `--port 5000`，则直接使用它
2. **项目说明** — 检查 `AGENTS.md`、`CLAUDE.md` 或其他说明文件以获取端口引用
3. **package.json** — 检查开发/启动脚本中的 `--port` 标志
4. **环境文件** — 检查 `.env`、`.env.local`、`.env.development` 的 `PORT=`
5. **默认** — 回退到 `3000`
```bash
PORT="${EXPLICIT_PORT:-}"
if [ -z "$PORT" ]; then
  PORT=$(grep -Eio '(port\s*[:=]\s*|localhost:)([0-9]{4,5})' AGENTS.md 2>/dev/null | grep -Eo '[0-9]{4,5}' | head -1)
  if [ -z "$PORT" ]; then
    PORT=$(grep -Eio '(port\s*[:=]\s*|localhost:)([0-9]{4,5})' CLAUDE.md 2>/dev/null | grep -Eo '[0-9]{4,5}' | head -1)
  fi
fi
if [ -z "$PORT" ]; then
  PORT=$(grep -Eo '\-\-port[= ]+[0-9]{4,5}' package.json 2>/dev/null | grep -Eo '[0-9]{4,5}' | head -1)
fi
if [ -z "$PORT" ]; then
  PORT=$(grep -h '^PORT=' .env .env.local .env.development 2>/dev/null | tail -1 | cut -d= -f2)
fi
PORT="${PORT:-3000}"
echo "Using dev server port: $PORT"
```
### 6. 验证服务器是否正在运行
```bash
agent-browser open http://localhost:${PORT}
agent-browser snapshot -i
```
如果服务器未运行，请通知用户：
```
Server not running on port ${PORT}

Please start your development server:
- Rails: `bin/dev` or `rails server`
- Node/Next.js: `npm run dev`
- Custom port: run this skill again with `--port <your-port>`

Then re-run this skill.
```
### 7. 测试每个受影响的页面

对于每条受影响的路线：

**导航并捕获快照：**
```bash
agent-browser open "http://localhost:${PORT}/[route]"
agent-browser snapshot -i
```
**对于头部模式：**
```bash
agent-browser --headed open "http://localhost:${PORT}/[route]"
agent-browser --headed snapshot -i
```
**验证关键要素：**
- 使用 `agent-browser snapshot -i` 获取带有引用的交互元素
- 页面标题/标题存在
- 呈现的主要内容
- 没有可见的错误消息
- 表单有预期字段

**测试关键交互：**
```bash
agent-browser click @e1
agent-browser snapshot -i
```
**截图：**
```bash
agent-browser screenshot page-name.png
agent-browser screenshot --full page-name-full.png
```
### 8. 人工验证（需要时）

测试需要外部交互的触摸流时暂停以等待人工输入：

|流量类型|问什么 |
|------------|-------------|
| OAuth | “请使用 [provider] 登录并确认其有效” |
|电子邮件 | “检查您的收件箱中是否有测试电子邮件并确认收到”|
|付款 | “在沙盒模式下完成测试购买”|
|短信| “验证您收到短信代码” |
|外部 API | “确认[服务]集成正在运行”|

询问用户（使用平台的问题工具，或呈现编号选项并等待）：
```
Human Verification Needed

This test touches [flow type]. Please:
1. [Action to take]
2. [What to verify]

Did it work correctly?
1. Yes - continue testing
2. No - describe the issue
```
### 9. 处理失败

当测试失败时：

1. **记录失败：**
   - 错误状态截图：`agent-browser screenshot error.png`
   - 注意准确的复制步骤

2. **询问用户如何继续：**

   ```
   Test Failed: [route]

   Issue: [description]
   Console errors: [if any]

   How to proceed?
   1. Fix now - I'll help debug and fix
   2. Create todo - Add a todo for later (using the todo-create skill)
   3. Skip - Continue testing other pages
   ```

3. **If "Fix now":** investigate, propose a fix, apply, re-run the failing test
4. **If "Create todo":** load the `todo-create` skill and create a todo with priority p1 and description `browser-test-{description}`，继续
5. **如果“Skip”：**记录为已跳过，则继续

### 10. 测试总结

所有测试完成后，提出总结：
```markdown
## Browser Test Results

**Test Scope:** PR #[number] / [branch name]
**Server:** http://localhost:${PORT}

### Pages Tested: [count]

| Route | Status | Notes |
|-------|--------|-------|
| `/users` | Pass | |
| `/settings` | Pass | |
| `/dashboard` | Fail | Console error: [msg] |
| `/checkout` | Skip | Requires payment credentials |

### Console Errors: [count]
- [List any errors found]

### Human Verifications: [count]
- OAuth flow: Confirmed
- Email delivery: Confirmed

### Failures: [count]
- `/dashboard` - [issue description]

### Created Todos: [count]
- `005-pending-p1-browser-test-dashboard-error.md`

### Result: [PASS / FAIL / PARTIAL]
```
## 快速使用示例
```bash
# Test current branch changes (auto-detects port)
/test-browser

# Test specific PR
/test-browser 847

# Test specific branch
/test-browser feature/new-dashboard

# Test on a specific port
/test-browser --port 5000
```
## 代理浏览器 CLI 参考
```bash
# Navigation
agent-browser open <url>           # Navigate to URL
agent-browser back                 # Go back
agent-browser close                # Close browser

# Snapshots (get element refs)
agent-browser snapshot -i          # Interactive elements with refs (@e1, @e2, etc.)
agent-browser snapshot -i --json   # JSON output

# Interactions (use refs from snapshot)
agent-browser click @e1            # Click element
agent-browser fill @e1 "text"      # Fill input
agent-browser type @e1 "text"      # Type without clearing
agent-browser press Enter          # Press key

# Screenshots
agent-browser screenshot out.png       # Viewport screenshot
agent-browser screenshot --full out.png # Full page screenshot

# Headed mode (visible browser)
agent-browser --headed open <url>      # Open with visible browser
agent-browser --headed click @e1       # Click in visible browser

# Wait
agent-browser wait @e1             # Wait for element
agent-browser wait 2000            # Wait milliseconds
```
