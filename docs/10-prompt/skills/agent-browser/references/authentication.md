# 身份验证模式

登录流程、会话持久性、OAuth、2FA 和经过身份验证的浏览。

**相关**：[commands.md](commands.md) 用于完整命令参考，[SKILL.md](../SKILL.md) 用于快速入门。

## 内容

- [从浏览器导入身份验证](#import-auth-from-your-browser)
- [持久配置文件](#persistent-profiles)
- [会话持久化](#session-persistence)
- [基本登录流程](#basic-login-flow)
- [保存身份验证状态](# saving-authentication-state)
- [恢复身份验证](#retoring-authentication)
- [OAuth / SSO 流程](#oauth--sso-flows)
- [双因素身份验证](#双因素身份验证)
- [HTTP 基本身份验证](#http-basic-auth)
- [基于 Cookie 的身份验证](#cookie-based-auth)
- [令牌刷新处理](#token-refresh-handling)
- [安全最佳实践](#security-best-practices)

## 从浏览器导入身份验证

最快的身份验证方法是重复使用您已登录的 Chrome 会话中的 Cookie。

**第 1 步：启动 Chrome 并进行远程调试**
```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```
像平常一样在此 Chrome 窗口中登录您的目标网站。

> **安全说明：** `--remote-debugging-port` 在本地主机上公开了完整的浏览器控制。任何本地进程都可以连接并读取 cookie、执行 JS 等。仅在受信任的计算机上使用，完成后关闭 Chrome。

**第 2 步：获取身份验证状态**
```bash
# Auto-discover the running Chrome and save its cookies + localStorage
agent-browser --auto-connect state save ./my-auth.json
```
**第 3 步：自动化重用**
```bash
# Load auth at launch
agent-browser --state ./my-auth.json open https://app.example.com/dashboard

# Or load into an existing session
agent-browser state load ./my-auth.json
agent-browser open https://app.example.com/dashboard
```
这适用于任何站点，包括那些具有复杂 OAuth 流程、SSO 或 2FA 的站点 - 只要 Chrome 已经具有有效的会话 cookie。

> **安全说明：** 状态文件包含明文形式的会话令牌。将它们添加到 `.gitignore`，不再需要时删除，并设置 `AGENT_BROWSER_ENCRYPTION_KEY` 进行静态加密。请参阅[安全最佳实践](#security-best-practices)。

**提示：** 与 `--session-name` 结合使用，以便导入的身份验证在重新启动后自动保留：
```bash
agent-browser --session-name myapp state load ./my-auth.json
# From now on, state is auto-saved/restored for "myapp"
```
## 持久配置文件

使用 `--profile` 将代理浏览器指向 Chrome 用户数据目录。这会在浏览器重新启动时保留所有内容（cookie、IndexedDB、服务工作者、缓存），而无需显式保存/加载：
```bash
# First run: login once
agent-browser --profile ~/.myapp-profile open https://app.example.com/login
# ... complete login flow ...

# All subsequent runs: already authenticated
agent-browser --profile ~/.myapp-profile open https://app.example.com/dashboard
```
对于不同的项目或测试用户使用不同的路径：
```bash
agent-browser --profile ~/.profiles/admin open https://app.example.com
agent-browser --profile ~/.profiles/viewer open https://app.example.com
```
或者通过环境变量设置：
```bash
export AGENT_BROWSER_PROFILE=~/.myapp-profile
agent-browser open https://app.example.com/dashboard
```
## 会话保持

使用`--session-name`按名称自动保存和恢复cookies+localStorage，无需管理文件：
```bash
# Auto-saves state on close, auto-restores on next launch
agent-browser --session-name twitter open https://twitter.com
# ... login flow ...
agent-browser close  # state saved to ~/.agent-browser/sessions/

# Next time: state is automatically restored
agent-browser --session-name twitter open https://twitter.com
```
加密静态状态：
```bash
export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)
agent-browser --session-name secure open https://app.example.com
```
## 基本登录流程
```bash
# Navigate to login page
agent-browser open https://app.example.com/login
agent-browser wait --load networkidle

# Get form elements
agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Sign In"

# Fill credentials
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"

# Submit
agent-browser click @e3
agent-browser wait --load networkidle

# Verify login succeeded
agent-browser get url  # Should be dashboard, not login
```
## 保存身份验证状态

登录后，保存状态以供重复使用：
```bash
# Login first (see above)
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --url "**/dashboard"

# Save authenticated state
agent-browser state save ./auth-state.json
```
## 恢复身份验证

通过加载保存的状态跳过登录：
```bash
# Load saved auth state
agent-browser state load ./auth-state.json

# Navigate directly to protected page
agent-browser open https://app.example.com/dashboard

# Verify authenticated
agent-browser snapshot -i
```
## OAuth / SSO 流程

对于 OAuth 重定向：
```bash
# Start OAuth flow
agent-browser open https://app.example.com/auth/google

# Handle redirects automatically
agent-browser wait --url "**/accounts.google.com**"
agent-browser snapshot -i

# Fill Google credentials
agent-browser fill @e1 "user@gmail.com"
agent-browser click @e2  # Next button
agent-browser wait 2000
agent-browser snapshot -i
agent-browser fill @e3 "password"
agent-browser click @e4  # Sign in

# Wait for redirect back
agent-browser wait --url "**/app.example.com**"
agent-browser state save ./oauth-state.json
```
## 双因素身份验证

通过手动干预处理 2FA：
```bash
# Login with credentials
agent-browser open https://app.example.com/login --headed  # Show browser
agent-browser snapshot -i
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3

# Wait for user to complete 2FA manually
echo "Complete 2FA in the browser window..."
agent-browser wait --url "**/dashboard" --timeout 120000

# Save state after 2FA
agent-browser state save ./2fa-state.json
```
## HTTP 基本身份验证

对于使用 HTTP 基本身份验证的站点：
```bash
# Set credentials before navigation
agent-browser set credentials username password

# Navigate to protected resource
agent-browser open https://protected.example.com/api
```
## 基于 Cookie 的身份验证

手动设置身份验证cookie：
```bash
# Set auth cookie
agent-browser cookies set session_token "abc123xyz"

# Navigate to protected page
agent-browser open https://app.example.com/dashboard
```
## 令牌刷新处理

对于具有过期令牌的会话：
```bash
#!/bin/bash
# Wrapper that handles token refresh

STATE_FILE="./auth-state.json"

# Try loading existing state
if [[ -f "$STATE_FILE" ]]; then
    agent-browser state load "$STATE_FILE"
    agent-browser open https://app.example.com/dashboard

    # Check if session is still valid
    URL=$(agent-browser get url)
    if [[ "$URL" == *"/login"* ]]; then
        echo "Session expired, re-authenticating..."
        # Perform fresh login
        agent-browser snapshot -i
        agent-browser fill @e1 "$USERNAME"
        agent-browser fill @e2 "$PASSWORD"
        agent-browser click @e3
        agent-browser wait --url "**/dashboard"
        agent-browser state save "$STATE_FILE"
    fi
else
    # First-time login
    agent-browser open https://app.example.com/login
    # ... login flow ...
fi
```
## 安全最佳实践

1. **永远不要提交状态文件** - 它们包含会话令牌
   ```bash
   echo "*.auth-state.json" >> .gitignore
   ```

2. **Use environment variables for credentials**
   ```bash
   agent-browser fill @e1 "$APP_USERNAME"
   agent-browser fill @e2 "$APP_PASSWORD"
   ```

3. **Clean up after automation**
   ```bash
   agent-browser cookies clear
   rm -f ./auth-state.json
   ```

4. **Use short-lived sessions for CI/CD**
   ```bash
   # Don't persist state in CI
   agent-browser open https://app.example.com/login
   # ... login and perform actions ...
   agent-browser close  # Session ends, nothing persisted
   ```
