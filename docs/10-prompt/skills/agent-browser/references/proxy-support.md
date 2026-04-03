# 代理支持

用于地理测试、速率限制避免和企业环境的代理配置。

**相关**：[commands.md](commands.md) 用于全局选项，[SKILL.md](../SKILL.md) 用于快速启动。

## 内容

- [基本代理配置](#basic-proxy-configuration)
- [经过身份验证的代理](#authenticated-proxy)
- [SOCKS 代理](#socks-proxy)
- [代理绕过](#proxy-bypass)
- [常见用例](#common-use-cases)
- [验证代理连接](#verifying-proxy-connection)
- [疑难解答](#疑难解答)
- [最佳实践](#best-practices)

## 基本代理配置

使用 `--proxy` 标志或通过环境变量设置代理：
```bash
# Via CLI flag
agent-browser --proxy "http://proxy.example.com:8080" open https://example.com

# Via environment variable
export HTTP_PROXY="http://proxy.example.com:8080"
agent-browser open https://example.com

# HTTPS proxy
export HTTPS_PROXY="https://proxy.example.com:8080"
agent-browser open https://example.com

# Both
export HTTP_PROXY="http://proxy.example.com:8080"
export HTTPS_PROXY="http://proxy.example.com:8080"
agent-browser open https://example.com
```
## 经过身份验证的代理

对于需要身份验证的代理：
```bash
# Include credentials in URL
export HTTP_PROXY="http://username:password@proxy.example.com:8080"
agent-browser open https://example.com
```
## SOCKS 代理
```bash
# SOCKS5 proxy
export ALL_PROXY="socks5://proxy.example.com:1080"
agent-browser open https://example.com

# SOCKS5 with auth
export ALL_PROXY="socks5://user:pass@proxy.example.com:1080"
agent-browser open https://example.com
```
## 代理绕过

使用 `--proxy-bypass` 或 `NO_PROXY` 跳过特定域的代理：
```bash
# Via CLI flag
agent-browser --proxy "http://proxy.example.com:8080" --proxy-bypass "localhost,*.internal.com" open https://example.com

# Via environment variable
export NO_PROXY="localhost,127.0.0.1,.internal.company.com"
agent-browser open https://internal.company.com  # Direct connection
agent-browser open https://external.com          # Via proxy
```
## 常见用例

### 地理位置测试
```bash
#!/bin/bash
# Test site from different regions using geo-located proxies

PROXIES=(
    "http://us-proxy.example.com:8080"
    "http://eu-proxy.example.com:8080"
    "http://asia-proxy.example.com:8080"
)

for proxy in "${PROXIES[@]}"; do
    export HTTP_PROXY="$proxy"
    export HTTPS_PROXY="$proxy"

    region=$(echo "$proxy" | grep -oP '^\w+-\w+')
    echo "Testing from: $region"

    agent-browser --session "$region" open https://example.com
    agent-browser --session "$region" screenshot "./screenshots/$region.png"
    agent-browser --session "$region" close
done
```
### 旋转代理进行抓取
```bash
#!/bin/bash
# Rotate through proxy list to avoid rate limiting

PROXY_LIST=(
    "http://proxy1.example.com:8080"
    "http://proxy2.example.com:8080"
    "http://proxy3.example.com:8080"
)

URLS=(
    "https://site.com/page1"
    "https://site.com/page2"
    "https://site.com/page3"
)

for i in "${!URLS[@]}"; do
    proxy_index=$((i % ${#PROXY_LIST[@]}))
    export HTTP_PROXY="${PROXY_LIST[$proxy_index]}"
    export HTTPS_PROXY="${PROXY_LIST[$proxy_index]}"

    agent-browser open "${URLS[$i]}"
    agent-browser get text body > "output-$i.txt"
    agent-browser close

    sleep 1  # Polite delay
done
```
### 公司网络访问
```bash
#!/bin/bash
# Access internal sites via corporate proxy

export HTTP_PROXY="http://corpproxy.company.com:8080"
export HTTPS_PROXY="http://corpproxy.company.com:8080"
export NO_PROXY="localhost,127.0.0.1,.company.com"

# External sites go through proxy
agent-browser open https://external-vendor.com

# Internal sites bypass proxy
agent-browser open https://intranet.company.com
```
## 验证代理连接
```bash
# Check your apparent IP
agent-browser open https://httpbin.org/ip
agent-browser get text body
# Should show proxy's IP, not your real IP
```
## 故障排除

### 代理连接失败
```bash
# Test proxy connectivity first
curl -x http://proxy.example.com:8080 https://httpbin.org/ip

# Check if proxy requires auth
export HTTP_PROXY="http://user:pass@proxy.example.com:8080"
```
### 通过代理的 SSL/TLS 错误

某些代理执行 SSL 检查。如果遇到证书错误：
```bash
# For testing only - not recommended for production
agent-browser open https://example.com --ignore-https-errors
```
### 性能缓慢
```bash
# Use proxy only when necessary
export NO_PROXY="*.cdn.com,*.static.com"  # Direct CDN access
```
## 最佳实践

1. **使用环境变量** - 不要硬编码代理凭据
2. **适当设置 NO_PROXY** - 避免通过代理路由本地流量
3. **自动化之前测试代理** - 通过简单请求验证连接
4. **优雅地处理代理失败** - 为不稳定的代理实现重试逻辑
5. **为大型抓取作业轮换代理** - 分配负载并避免禁止
