---
name: agent-browser
description: 用于 AI 代理的浏览器自动化 CLI。当用户需要与网站交互时使用，包括导航页面、填写表单、单击按钮、截屏、提取数据、测试 Web 应用程序或自动执行任何浏览器任务。触发器包括“打开网站”、“填写表单”、“单击按钮”、“截取屏幕截图”、“从页面抓取数据”、“测试此 Web 应用程序”、“登录网站”、“自动执行浏览器操作”或任何需要编程 Web 交互的任务的请求。
allowed-tools: Bash(npx agent-browser:*), Bash(agent-browser:*)
---
# 使用代理浏览器实现浏览器自动化

CLI 直接通过 CDP 使用 Chrome/Chromium。通过 `npm i -g agent-browser`、`brew install agent-browser` 或 `cargo install agent-browser` 安装。运行 `agent-browser install` 下载 Chrome。运行`agent-browser upgrade`更新到最新版本。

## 核心工作流程

每个浏览器自动化都遵循以下模式：

1. **导航**：`agent-browser open <url>`
2. **快照**：`agent-browser snapshot -i`（获取元素引用，例如`@e1`，`@e2`）
3. **交互**：使用refs进行点击、填充、选择
4. **重新快照**：导航或 DOM 更改后，获取新的引用
```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```
## 命令链

命令可以在单个 shell 调用中与 `&&` 链接。浏览器通过后台守护程序在命令之间保持不变，因此链接比单独调用更安全且更有效。
```bash
# Chain open + wait + snapshot in one call
agent-browser open https://example.com && agent-browser wait --load networkidle && agent-browser snapshot -i

# Chain multiple interactions
agent-browser fill @e1 "user@example.com" && agent-browser fill @e2 "password123" && agent-browser click @e3

# Navigate and capture
agent-browser open https://example.com && agent-browser wait --load networkidle && agent-browser screenshot page.png
```
**何时链接：** 当您不需要在继续操作之前读取中间命令的输出时（例如，打开 + 等待 + 屏幕截图），请使用 `&&`。当您需要首先解析输出时（例如，快照以发现引用，然后使用这些引用进行交互），请单独运行命令。

## 处理身份验证

当自动化需要登录的站点时，请选择适合的方法：

**选项 1：从用户浏览器导入身份验证（一次性任务最快）**
```bash
# Connect to the user's running Chrome (they're already logged in)
agent-browser --auto-connect state save ./auth.json
# Use that auth state
agent-browser --state ./auth.json open https://app.example.com/dashboard
```
状态文件包含纯文本形式的会话令牌——添加到 `.gitignore` 并在不再需要时删除。设置 `AGENT_BROWSER_ENCRYPTION_KEY` 进行静态加密。

**选项 2：持久配置文件（对于重复任务最简单）**
```bash
# First run: login manually or via automation
agent-browser --profile ~/.myapp open https://app.example.com/login
# ... fill credentials, submit ...

# All future runs: already authenticated
agent-browser --profile ~/.myapp open https://app.example.com/dashboard
```
**选项 3：会话名称（自动保存/恢复 cookie + localStorage）**
```bash
agent-browser --session-name myapp open https://app.example.com/login
# ... login flow ...
agent-browser close  # State auto-saved

# Next time: state auto-restored
agent-browser --session-name myapp open https://app.example.com/dashboard
```
**选项 4：身份验证保险库（凭证加密存储，按名称登录）**
```bash
echo "$PASSWORD" | agent-browser auth save myapp --url https://app.example.com/login --username user --password-stdin
agent-browser auth login myapp
```
`auth login` 使用 `load` 导航，然后等待登录表单选择器出现后再填写/单击，这在延迟的 SPA 登录屏幕上更可靠。

**选项 5：状态文件（手动保存/加载）**
```bash
# After logging in:
agent-browser state save ./auth.json
# In a future session:
agent-browser state load ./auth.json
agent-browser open https://app.example.com/dashboard
```
请参阅 `references/authentication.md` 了解 OAuth、2FA、基于 cookie 的身份验证和令牌刷新模式。

## 基本命令
```bash
# Navigation
agent-browser open <url>              # Navigate (aliases: goto, navigate)
agent-browser close                   # Close browser

# Snapshot
agent-browser snapshot -i             # Interactive elements with refs (recommended)
agent-browser snapshot -i -C          # Include cursor-interactive elements (divs with onclick, cursor:pointer)
agent-browser snapshot -s "#selector" # Scope to CSS selector

# Interaction (use @refs from snapshot)
agent-browser click @e1               # Click element
agent-browser click @e1 --new-tab     # Click and open in new tab
agent-browser fill @e2 "text"         # Clear and type text
agent-browser type @e2 "text"         # Type without clearing
agent-browser select @e1 "option"     # Select dropdown option
agent-browser check @e1               # Check checkbox
agent-browser press Enter             # Press key
agent-browser keyboard type "text"    # Type at current focus (no selector)
agent-browser keyboard inserttext "text"  # Insert without key events
agent-browser scroll down 500         # Scroll page
agent-browser scroll down 500 --selector "div.content"  # Scroll within a specific container

# Get information
agent-browser get text @e1            # Get element text
agent-browser get url                 # Get current URL
agent-browser get title               # Get page title
agent-browser get cdp-url             # Get CDP WebSocket URL

# Wait
agent-browser wait @e1                # Wait for element
agent-browser wait --load networkidle # Wait for network idle
agent-browser wait --url "**/page"    # Wait for URL pattern
agent-browser wait 2000               # Wait milliseconds
agent-browser wait --text "Welcome"    # Wait for text to appear (substring match)
agent-browser wait --fn "!document.body.innerText.includes('Loading...')"  # Wait for text to disappear
agent-browser wait "#spinner" --state hidden  # Wait for element to disappear

# Downloads
agent-browser download @e1 ./file.pdf          # Click element to trigger download
agent-browser wait --download ./output.zip     # Wait for any download to complete
agent-browser --download-path ./downloads open <url>  # Set default download directory

# Network
agent-browser network requests                 # Inspect tracked requests
agent-browser network route "**/api/*" --abort  # Block matching requests
agent-browser network har start                # Start HAR recording
agent-browser network har stop ./capture.har   # Stop and save HAR file

# Viewport & Device Emulation
agent-browser set viewport 1920 1080          # Set viewport size (default: 1280x720)
agent-browser set viewport 1920 1080 2        # 2x retina (same CSS size, higher res screenshots)
agent-browser set device "iPhone 14"          # Emulate device (viewport + user agent)

# Capture
agent-browser screenshot              # Screenshot to temp dir
agent-browser screenshot --full       # Full page screenshot
agent-browser screenshot --annotate   # Annotated screenshot with numbered element labels
agent-browser screenshot --screenshot-dir ./shots  # Save to custom directory
agent-browser screenshot --screenshot-format jpeg --screenshot-quality 80
agent-browser pdf output.pdf          # Save as PDF

# Clipboard
agent-browser clipboard read                      # Read text from clipboard
agent-browser clipboard write "Hello, World!"     # Write text to clipboard
agent-browser clipboard copy                      # Copy current selection
agent-browser clipboard paste                     # Paste from clipboard

# Diff (compare page states)
agent-browser diff snapshot                          # Compare current vs last snapshot
agent-browser diff snapshot --baseline before.txt    # Compare current vs saved file
agent-browser diff screenshot --baseline before.png  # Visual pixel diff
agent-browser diff url <url1> <url2>                 # Compare two pages
agent-browser diff url <url1> <url2> --wait-until networkidle  # Custom wait strategy
agent-browser diff url <url1> <url2> --selector "#main"  # Scope to element
```
## 批量执行

通过将字符串数组的 JSON 数组通过管道传输到 `batch`，在一次调用中执行多个命令。这可以避免运行多步骤工作流时每个命令进程的启动开销。
```bash
echo '[
  ["open", "https://example.com"],
  ["snapshot", "-i"],
  ["click", "@e1"],
  ["screenshot", "result.png"]
]' | agent-browser batch --json

# Stop on first error
agent-browser batch --bail < commands.json
```
当您有不依赖于中间输出的已知命令序列时，请使用 `batch`。当您需要解析步骤之间的输出（例如，快照来发现参考，然后进行交互）时，请使用单独的命令或 `&&` 链接。

## 常见模式

### 表格提交
```bash
agent-browser open https://example.com/signup
agent-browser snapshot -i
agent-browser fill @e1 "Jane Doe"
agent-browser fill @e2 "jane@example.com"
agent-browser select @e3 "California"
agent-browser check @e4
agent-browser click @e5
agent-browser wait --load networkidle
```
### 使用 Auth Vault 进行身份验证（推荐）
```bash
# Save credentials once (encrypted with AGENT_BROWSER_ENCRYPTION_KEY)
# Recommended: pipe password via stdin to avoid shell history exposure
echo "pass" | agent-browser auth save github --url https://github.com/login --username user --password-stdin

# Login using saved profile (LLM never sees password)
agent-browser auth login github

# List/show/delete profiles
agent-browser auth list
agent-browser auth show github
agent-browser auth delete github
```
`auth login` 在交互之前等待用户名/密码/提交选择器，超时与默认操作超时相关。

### 具有状态持久性的身份验证
```bash
# Login once and save state
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "$USERNAME"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save auth.json

# Reuse in future sessions
agent-browser state load auth.json
agent-browser open https://app.example.com/dashboard
```
### 会话持续性
```bash
# Auto-save/restore cookies and localStorage across browser restarts
agent-browser --session-name myapp open https://app.example.com/login
# ... login flow ...
agent-browser close  # State auto-saved to ~/.agent-browser/sessions/

# Next time, state is auto-loaded
agent-browser --session-name myapp open https://app.example.com/dashboard

# Encrypt state at rest
export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)
agent-browser --session-name secure open https://app.example.com

# Manage saved states
agent-browser state list
agent-browser state show myapp-default.json
agent-browser state clear myapp
agent-browser state clean --older-than 7
```
### 使用 Iframe

iframe 内容会自动内联到快照中。 iframe 内的引用携带框架上下文，因此您可以直接与它们交互。
```bash
agent-browser open https://example.com/checkout
agent-browser snapshot -i
# @e1 [heading] "Checkout"
# @e2 [Iframe] "payment-frame"
#   @e3 [input] "Card number"
#   @e4 [input] "Expiry"
#   @e5 [button] "Pay"

# Interact directly — no frame switch needed
agent-browser fill @e3 "4111111111111111"
agent-browser fill @e4 "12/28"
agent-browser click @e5

# To scope a snapshot to one iframe:
agent-browser frame @e2
agent-browser snapshot -i         # Only iframe content
agent-browser frame main          # Return to main frame
```
### 数据提取
```bash
agent-browser open https://example.com/products
agent-browser snapshot -i
agent-browser get text @e5           # Get specific element text
agent-browser get text body > page.txt  # Get all page text

# JSON output for parsing
agent-browser snapshot -i --json
agent-browser get text @e1 --json
```
### 平行会议
```bash
agent-browser --session site1 open https://site-a.com
agent-browser --session site2 open https://site-b.com

agent-browser --session site1 snapshot -i
agent-browser --session site2 snapshot -i

agent-browser session list
```
### 连接到现有的 Chrome
```bash
# Auto-discover running Chrome with remote debugging enabled
agent-browser --auto-connect open https://example.com
agent-browser --auto-connect snapshot

# Or with explicit CDP port
agent-browser --cdp 9222 snapshot
```
自动连接通过 `DevToolsActivePort`、常见调试端口（9222、9229）发现 Chrome，如果基于 HTTP 的 CDP 发现失败，则回退到直接 WebSocket 连接。

### 配色方案（深色模式）
```bash
# Persistent dark mode via flag (applies to all pages and new tabs)
agent-browser --color-scheme dark open https://example.com

# Or via environment variable
AGENT_BROWSER_COLOR_SCHEME=dark agent-browser open https://example.com

# Or set during session (persists for subsequent commands)
agent-browser set media dark
```
### 视口和响应测试
```bash
# Set a custom viewport size (default is 1280x720)
agent-browser set viewport 1920 1080
agent-browser screenshot desktop.png

# Test mobile-width layout
agent-browser set viewport 375 812
agent-browser screenshot mobile.png

# Retina/HiDPI: same CSS layout at 2x pixel density
# Screenshots stay at logical viewport size, but content renders at higher DPI
agent-browser set viewport 1920 1080 2
agent-browser screenshot retina.png

# Device emulation (sets viewport + user agent in one step)
agent-browser set device "iPhone 14"
agent-browser screenshot device.png
```
`scale` 参数（第三个参数）设置 `window.devicePixelRatio` 而不更改 CSS 布局。在测试视网膜渲染或捕获更高分辨率的屏幕截图时使用它。

### 可视化浏览器（调试）
```bash
agent-browser --headed open https://example.com
agent-browser highlight @e1          # Highlight element
agent-browser inspect                # Open Chrome DevTools for the active page
agent-browser record start demo.webm # Record session
agent-browser profiler start         # Start Chrome DevTools profiling
agent-browser profiler stop trace.json # Stop and save profile (path optional)
```
使用 `AGENT_BROWSER_HEADED=1` 通过环境变量启用 head 模式。浏览器扩展可以在有头模式和无头模式下工作。

### 本地文件（PDF、HTML）
```bash
# Open local files with file:// URLs
agent-browser --allow-file-access open file:///path/to/document.pdf
agent-browser --allow-file-access open file:///path/to/page.html
agent-browser screenshot output.png
```
### iOS 模拟器（移动 Safari）
```bash
# List available iOS simulators
agent-browser device list

# Launch Safari on a specific device
agent-browser -p ios --device "iPhone 16 Pro" open https://example.com

# Same workflow as desktop - snapshot, interact, re-snapshot
agent-browser -p ios snapshot -i
agent-browser -p ios tap @e1          # Tap (alias for click)
agent-browser -p ios fill @e2 "text"
agent-browser -p ios swipe up         # Mobile-specific gesture

# Take screenshot
agent-browser -p ios screenshot mobile.png

# Close session (shuts down simulator)
agent-browser -p ios close
```
**要求：** 带有 Xcode、Appium 的 macOS (`npm install -g appium && appium driver install xcuitest`)

**真实设备：** 如果预先配置，可与物理 iOS 设备配合使用。使用 `--device "<UDID>"`，其中 UDID 来自 `xcrun xctrace list devices`。

## 安全

所有安全功能都是可选的。默认情况下，代理浏览器对导航、操作或输出没有任何限制。

### 内容边界（推荐用于 AI 代理）

启用 `--content-boundaries` 将页面来源的输出包装在标记中，帮助 LLM 区分工具输出和不受信任的页面内容：
```bash
export AGENT_BROWSER_CONTENT_BOUNDARIES=1
agent-browser snapshot
# Output:
# --- AGENT_BROWSER_PAGE_CONTENT nonce=<hex> origin=https://example.com ---
# [accessibility tree]
# --- END_AGENT_BROWSER_PAGE_CONTENT nonce=<hex> ---
```
### 域名白名单

将导航限制到受信任的域。像 `*.example.com` 这样的通配符也匹配裸域 `example.com`。与非允许域的子资源请求、WebSocket 和 EventSource 连接也会被阻止。包括您的目标页面所依赖的 CDN 域：
```bash
export AGENT_BROWSER_ALLOWED_DOMAINS="example.com,*.example.com"
agent-browser open https://example.com        # OK
agent-browser open https://malicious.com       # Blocked
```
### 行动政策

使用策略文件来控制破坏性操作：
```bash
export AGENT_BROWSER_ACTION_POLICY=./policy.json
```
示例 `policy.json`：
```json
{ "default": "deny", "allow": ["navigate", "snapshot", "click", "scroll", "wait", "get"] }
```
身份验证保管库操作（`auth login` 等）绕过操作策略，但域白名单仍然适用。

### 输出限制

防止大页面的上下文泛滥：
```bash
export AGENT_BROWSER_MAX_OUTPUT=50000
```
## 比较（验证更改）

执行操作后使用 `diff snapshot` 来验证其是否达到了预期效果。这会将当前的可访问性树与会话中拍摄的最后一个快照进行比较。
```bash
# Typical workflow: snapshot -> action -> diff
agent-browser snapshot -i          # Take baseline snapshot
agent-browser click @e2            # Perform action
agent-browser diff snapshot        # See what changed (auto-compares to last snapshot)
```
对于视觉回归测试或监控：
```bash
# Save a baseline screenshot, then compare later
agent-browser screenshot baseline.png
# ... time passes or changes are made ...
agent-browser diff screenshot --baseline baseline.png

# Compare staging vs production
agent-browser diff url https://staging.example.com https://prod.example.com --screenshot
```
`diff snapshot` 输出使用 `+` 进行添加，使用 `-` 进行删除，类似于 git diff。 `diff screenshot` 生成一个差异图像，其中更改的像素以红色突出显示，以及不匹配百分比。

## 超时和慢速页面

默认超时为 25 秒。这可以用 `AGENT_BROWSER_DEFAULT_TIMEOUT` 环境变量（值以毫秒为单位）覆盖。对于速度慢的网站或大页面，请使用显式等待而不是依赖默认超时：
```bash
# Wait for network activity to settle (best for slow pages)
agent-browser wait --load networkidle

# Wait for a specific element to appear
agent-browser wait "#content"
agent-browser wait @e1

# Wait for a specific URL pattern (useful after redirects)
agent-browser wait --url "**/dashboard"

# Wait for a JavaScript condition
agent-browser wait --fn "document.readyState === 'complete'"

# Wait a fixed duration (milliseconds) as a last resort
agent-browser wait 5000
```
当处理持续缓慢的网站时，请在 `open` 之后使用 `wait --load networkidle` 以确保在拍摄快照之前页面已完全加载。如果某个特定元素渲染速度较慢，请直接使用 `wait <selector>` 或 `wait @ref` 等待它。

## 会话管理和清理

同时运行多个代理或自动化时，请始终使用命名会话以避免冲突：
```bash
# Each agent gets its own isolated session
agent-browser --session agent1 open site-a.com
agent-browser --session agent2 open site-b.com

# Check active sessions
agent-browser session list
```
完成后请务必关闭浏览器会话，以避免泄露进程：
```bash
agent-browser close                    # Close default session
agent-browser --session agent1 close   # Close specific session
```
如果先前的会话未正确关闭，守护进程可能仍在运行。在开始新的工作之前使用`agent-browser close`将其清理干净。

要在一段时间不活动后自动关闭守护进程（对于临时/CI 环境有用）：
```bash
AGENT_BROWSER_IDLE_TIMEOUT_MS=60000 agent-browser open example.com
```
## 参考生命周期（重要）

页面更改时，参考（`@e1`、`@e2` 等）无效。始终在以下时间后重新拍摄快照：

- 单击导航的链接或按钮
- 表格提交
- 动态内容加载（下拉菜单、模式）
```bash
agent-browser click @e5              # Navigates to new page
agent-browser snapshot -i            # MUST re-snapshot
agent-browser click @e1              # Use new refs
```
## 带注释的屏幕截图（视觉模式）

使用 `--annotate` 截取屏幕截图，其中编号标签覆盖在交互元素上。每个标签 `[N]` 映射到引用 `@eN`。这也会缓存引用，因此您可以立即与元素交互，而无需单独的快照。
```bash
agent-browser screenshot --annotate
# Output includes the image path and a legend:
#   [1] @e1 button "Submit"
#   [2] @e2 link "Home"
#   [3] @e3 textbox "Email"
agent-browser click @e2              # Click using ref from annotated screenshot
```
在以下情况下使用带注释的屏幕截图：

- 页面具有未标记的图标按钮或纯视觉元素
- 您需要验证视觉布局或样式
- 存在画布或图表元素（对于文本快照不可见）
- 您需要对元素位置进行空间推理

## 语义定位器（参考的替代）

当引用不可用或不可靠时，请使用语义定位器：
```bash
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find role button click --name "Submit"
agent-browser find placeholder "Search" type "query"
agent-browser find testid "submit-btn" click
```
## JavaScript 评估（eval）

使用 `eval` 在浏览器上下文中运行 JavaScript。 **Shell 引用可能会损坏复杂的表达式** - 使用 `--stdin` 或 `-b` 来避免问题。
```bash
# Simple expressions work with regular quoting
agent-browser eval 'document.title'
agent-browser eval 'document.querySelectorAll("img").length'

# Complex JS: use --stdin with heredoc (RECOMMENDED)
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(
  Array.from(document.querySelectorAll("img"))
    .filter(i => !i.alt)
    .map(i => ({ src: i.src.split("/").pop(), width: i.width }))
)
EVALEOF

# Alternative: base64 encoding (avoids all shell escaping issues)
agent-browser eval -b "$(echo -n 'Array.from(document.querySelectorAll("a")).map(a => a.href)' | base64)"
```
**为什么这很重要：** 当 shell 处理您的命令时，内部双引号、`!` 字符（历史扩展）、反引号和 `$()` 都可能在 JavaScript 到达代理浏览器之前损坏它。 `--stdin` 和 `-b` 标志完全绕过 shell 解释。

**经验法则：**

- 单行，无嵌套引号 -> 常规 `eval 'expression'` 带单引号即可
- 嵌套引号、箭头函数、模板文字或多行 -> 使用 `eval --stdin <<'EVALEOF'`
- 编程/生成的脚本 -> 使用 `eval -b` 和 base64

## 配置文件

在项目根目录中创建 `agent-browser.json` 以进行持久设置：
```json
{
  "headed": true,
  "proxy": "http://localhost:8080",
  "profile": "./browser-data"
}
```
优先级（从最低到最高）：`~/.agent-browser/config.json` < `./agent-browser.json` < 环境变量 < CLI 标志。使用 `--config <path>` 或 `AGENT_BROWSER_CONFIG` env var 作为自定义配置文件（如果丢失/无效，则退出并显示错误）。所有 CLI 选项都映射到驼峰命名法键（例如 `--executable-path` -> `"executablePath"`）。布尔标志接受 `true`/`false` 值（例如，`--headed false` 覆盖配置）。来自用户和项目配置的扩展被合并，而不是被替换。

## 深入研究文档

|参考|何时使用 |
| --------- | ----------- |
| `references/commands.md` |包含所有选项的完整命令参考 |
| `references/snapshot-refs.md` | Ref 生命周期、失效规则、故障排除 |
| `references/session-management.md` |并行会话、状态持久性、并发抓取 |
| `references/authentication.md` |登录流程、OAuth、2FA 处理、状态重用 |
| `references/video-recording.md` |记录调试和文档工作流程 |
| `references/profiling.md` |用于性能分析的 Chrome DevTools 分析 |
| `references/proxy-support.md` |代理配置、地理测试、轮换代理 |

## 浏览器引擎选择

使用`--engine`选择本地浏览器引擎。默认值为 `chrome`。
```bash
# Use Lightpanda (fast headless browser, requires separate install)
agent-browser --engine lightpanda open example.com

# Via environment variable
export AGENT_BROWSER_ENGINE=lightpanda
agent-browser open example.com

# With custom binary path
agent-browser --engine lightpanda --executable-path /path/to/lightpanda open example.com
```
支持的引擎：
- `chrome`（默认）-- Chrome/Chromium 通过 CDP
- `lightpanda` -- Lightpanda 通过 CDP 的无头浏览器（比 Chrome 快 10 倍，内存少 10 倍）

Lightpanda 不支持 `--extension`、`--profile`、`--state` 或 `--allow-file-access`。从 https://lightpanda.io/docs/open-source/installation. 安装 Lightpanda

## 即用型模板

|模板|描述 |
| -------- | ----------- |
| `templates/form-automation.sh` |表格填写与验证 |
| `templates/authenticated-session.sh` |登录一次，重用状态 |
| `templates/capture-workflow.sh` |内容提取与截图|
```bash
./templates/form-automation.sh https://example.com/form
./templates/authenticated-session.sh https://app.example.com/login
./templates/capture-workflow.sh https://example.com ./output
```
