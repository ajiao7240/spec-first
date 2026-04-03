---
name: test-xcode
description: 使用 XcodeBuildMCP 在模拟器上构建和测试 iOS 应用程序
argument-hint: "[scheme name or 'current' to use default]"
disable-model-invocation: true
---
# Xcode测试技巧

使用 XcodeBuildMCP 在模拟器上构建、安装和测试 iOS 应用程序。捕获屏幕截图、日志并验证应用程序行为。

## 先决条件

- 使用命令行工具安装 Xcode
- XcodeBuildMCP MCP 服务器已连接
- 有效的 Xcode 项目或工作区
- 至少一个可用的 iOS 模拟器

## 工作流程

### 0.验证 XcodeBuildMCP 是否可用

通过调用 `list_simulators` 工具检查 XcodeBuildMCP MCP 服务器是否已连接。

MCP 工具名称因平台而异：
- 克劳德代码：`mcp__xcodebuildmcp__list_simulators`
- 其他平台：使用等效的 MCP 工具调用 `XcodeBuildMCP` 服务器的 `list_simulators` 方法

如果未找到该工具或出现错误，请通知用户他们需要添加 XcodeBuildMCP MCP 服务器：
```
XcodeBuildMCP not installed

Install via Homebrew:
  brew tap getsentry/xcodebuildmcp && brew install xcodebuildmcp

Or via npx (no global install needed):
  npx -y xcodebuildmcp@latest mcp

Then add "XcodeBuildMCP" as an MCP server in your agent configuration
and restart your agent.
```
在确认 XcodeBuildMCP 正常工作之前，请勿继续。

### 1. 发现项目和方案

调用 XcodeBuildMCP 的 `discover_projs` 工具查找可用项目，然后使用项目路径 `list_schemes` 获取可用方案。

如果提供了参数，请使用该方案名称。如果“当前”，则使用默认/上次使用的方案。

### 2.启动模拟器

调用 `list_simulators` 查找可用的模拟器。使用 `boot_simulator` 和模拟器的 UUID 启动首选模拟器（推荐 iPhone 15 Pro）。

等待模拟器准备好后再继续。

### 3. 构建应用程序

使用项目路径和方案名称调用 `build_ios_sim_app`。

**失败时：**
- 捕获构建错误
- 为每个构建错误创建一个 P1 待办事项
- 向用户报告具体错误详细信息

**成功时：**
- 记下构建的应用程序安装路径
- 继续执行步骤 4

### 4. 安装并启动

1. 使用构建的应用程序路径和模拟器 UUID 调用 `install_app_on_simulator`
2. 使用bundle ID和模拟器UUID调用`launch_app_on_simulator`
3.使用模拟器UUID和bundle ID调用`capture_sim_logs`开始日志捕获

### 5. 测试关键屏幕

对于应用程序中的每个关键屏幕：

**截图：**
使用模拟器 UUID 和描述性文件名（例如 `screen-home.png`）调用 `take_screenshot`。

**查看屏幕截图：**
- UI 元素正确呈现
- 没有可见的错误消息
- 预期显示的内容
- 布局看起来正确

**检查日志是否有错误：**
使用模拟器 UUID 调用 `get_sim_logs`。寻找：
- 崩溃
- 例外情况
- 错误级别日志消息
- 网络请求失败**已知的自动化限制 - SwiftUI 文本链接：**
模拟点击（通过 XcodeBuildMCP 或任何模拟器自动化工具）不会触发具有内联 `AttributedString` 链接的 SwiftUI `Text` 视图上的手势识别器。点击报告成功但没有任何效果。这是一个平台限制——内联链接不会作为可访问性树中的单独元素公开。当点击文本链接没有可见效果时，提示用户在模拟器中手动点击。如果目标 URL 已知，`xcrun simctl openurl <device> <URL>` 可以直接打开它作为后备。

### 6. 人工验证（需要时）

测试需要设备交互的触摸流时暂停人工输入。

|流量类型|问什么 |
|------------|-------------|
|使用 Apple 登录 | “请在模拟器上完成使用 Apple 登录”|
|推送通知 | “发送测试推送并确认其出现” |
|应用内购买 | “完成沙盒购买” |
|相机/照片| “授予权限并验证相机是否正常工作” |
|地点 | “允许位置访问并验证地图更新” |
| SwiftUI 文本链接 | “请手动点击[元素描述] - 自动点击无法触发内嵌文本链接” |

询问用户（使用平台的问题工具 - 例如，Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user` - 或呈现编号选项并等待）：
```
Human Verification Needed

This test requires [flow type]. Please:
1. [Action to take on simulator]
2. [What to verify]

Did it work correctly?
1. Yes - continue testing
2. No - describe the issue
```
### 7. 处理失败

当测试失败时：

1. **记录失败：**
   - 截取错误状态的屏幕截图
   - 捕获控制台日志
   - 注意复制步骤

2. **询问用户如何继续：**

   ```
   Test Failed: [screen/feature]

   Issue: [description]
   Logs: [relevant error messages]

   How to proceed?
   1. Fix now - I'll help debug and fix
   2. Create todo - Add a todo for later (using the todo-create skill)
   3. Skip - Continue testing other screens
   ```

3. **If "Fix now":** investigate, propose a fix, rebuild and retest
4. **If "Create todo":** load the `todo-create` skill and create a todo with priority p1 and description `xcode-{description}`，继续
5. **如果“Skip”：**记录为已跳过，则继续

### 8. 测试总结

所有测试完成后，提出总结：
```markdown
## Xcode Test Results

**Project:** [project name]
**Scheme:** [scheme name]
**Simulator:** [simulator name]

### Build: Success / Failed

### Screens Tested: [count]

| Screen | Status | Notes |
|--------|--------|-------|
| Launch | Pass | |
| Home | Pass | |
| Settings | Fail | Crash on tap |
| Profile | Skip | Requires login |

### Console Errors: [count]
- [List any errors found]

### Human Verifications: [count]
- Sign in with Apple: Confirmed
- Push notifications: Confirmed

### Failures: [count]
- Settings screen - crash on navigation

### Created Todos: [count]
- `006-pending-p1-xcode-settings-crash.md`

### Result: [PASS / FAIL / PARTIAL]
```
### 9. 清理

测试后：

1.使用模拟器UUID调用`stop_log_capture`
2. 可以选择使用模拟器 UUID 调用 `shutdown_simulator`

## 快速使用示例
```bash
# Test with default scheme
/test-xcode

# Test specific scheme
/test-xcode MyApp-Debug

# Test after making changes
/test-xcode current
```
## 与规范集成：审查

在审查涉及 iOS 代码的 PR 时，`spec:review` 工作流程可以生成一个代理来运行此技能、在模拟器上构建、测试关键屏幕并检查崩溃。
