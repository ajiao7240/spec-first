# 快照和参考

紧凑的元素引用可显着减少 AI 代理的上下文使用。

**相关**：[commands.md](commands.md) 用于完整命令参考，[SKILL.md](../SKILL.md) 用于快速入门。

## 内容

- [参考文献如何工作](#how-refs-work)
- [快照命令](#the-snapshot-command)
- [使用参考](#using-refs)
- [参考生命周期](#ref-lifecycle)
- [最佳实践](#best-practices)
- [参考符号详细信息](#ref-notation-details)
- [疑难解答](#疑难解答)

## 参考如何工作

传统方法：
```
Full DOM/HTML -> AI parses -> CSS selector -> Action (~3000-5000 tokens)
```
代理浏览器方法：
```
Compact snapshot -> @refs assigned -> Direct interaction (~200-400 tokens)
```
## 快照命令
```bash
# Basic snapshot (shows page structure)
agent-browser snapshot

# Interactive snapshot (-i flag) - RECOMMENDED
agent-browser snapshot -i
```
### 快照输出格式
```
Page: Example Site - Home
URL: https://example.com

@e1 [header]
  @e2 [nav]
    @e3 [a] "Home"
    @e4 [a] "Products"
    @e5 [a] "About"
  @e6 [button] "Sign In"

@e7 [main]
  @e8 [h1] "Welcome"
  @e9 [form]
    @e10 [input type="email"] placeholder="Email"
    @e11 [input type="password"] placeholder="Password"
    @e12 [button type="submit"] "Log In"

@e13 [footer]
  @e14 [a] "Privacy Policy"
```
## 使用参考

一旦你有了参考文献，就可以直接互动：
```bash
# Click the "Sign In" button
agent-browser click @e6

# Fill email input
agent-browser fill @e10 "user@example.com"

# Fill password
agent-browser fill @e11 "password123"

# Submit the form
agent-browser click @e12
```
## 参考生命周期

**重要**：页面更改时引用将失效！
```bash
# Get initial snapshot
agent-browser snapshot -i
# @e1 [button] "Next"

# Click triggers page change
agent-browser click @e1

# MUST re-snapshot to get new refs!
agent-browser snapshot -i
# @e1 [h1] "Page 2"  <- Different element now!
```
## 最佳实践

### 1. 交互之前始终先快照
```bash
# CORRECT
agent-browser open https://example.com
agent-browser snapshot -i          # Get refs first
agent-browser click @e1            # Use ref

# WRONG
agent-browser open https://example.com
agent-browser click @e1            # Ref doesn't exist yet!
```
### 2. 导航后重新快照
```bash
agent-browser click @e5            # Navigates to new page
agent-browser snapshot -i          # Get new refs
agent-browser click @e1            # Use new refs
```
### 3.动态变化后重新快照
```bash
agent-browser click @e1            # Opens dropdown
agent-browser snapshot -i          # See dropdown items
agent-browser click @e7            # Select item
```
### 4. 特定区域快照

对于复杂页面，对特定区域进行快照：
```bash
# Snapshot just the form
agent-browser snapshot @e9
```
## 参考符号详细信息
```
@e1 [tag type="value"] "text content" placeholder="hint"
|    |   |             |               |
|    |   |             |               +- Additional attributes
|    |   |             +- Visible text
|    |   +- Key attributes shown
|    +- HTML tag name
+- Unique ref ID
```
### 常见模式
```
@e1 [button] "Submit"                    # Button with text
@e2 [input type="email"]                 # Email input
@e3 [input type="password"]              # Password input
@e4 [a href="/page"] "Link Text"         # Anchor link
@e5 [select]                             # Dropdown
@e6 [textarea] placeholder="Message"     # Text area
@e7 [div class="modal"]                  # Container (when relevant)
@e8 [img alt="Logo"]                     # Image
@e9 [checkbox] checked                   # Checked checkbox
@e10 [radio] selected                    # Selected radio
```
## 故障排除

###“找不到参考”错误
```bash
# Ref may have changed - re-snapshot
agent-browser snapshot -i
```
### 元素在快照中不可见
```bash
# Scroll down to reveal element
agent-browser scroll down 1000
agent-browser snapshot -i

# Or wait for dynamic content
agent-browser wait 1000
agent-browser snapshot -i
```
### 元素太多
```bash
# Snapshot specific container
agent-browser snapshot @e5

# Or use get text for content-only extraction
agent-browser get text @e5
```
