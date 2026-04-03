# 分析

在浏览器自动化期间捕获 Chrome DevTools 性能配置文件以进行性能分析。

**相关**：[commands.md](commands.md) 用于完整命令参考，[SKILL.md](../SKILL.md) 用于快速入门。

## 内容

- [基本分析](#basic-profiling)
- [分析器命令](#profiler-commands)
- [类别](#categories)
- [用例](#use-cases)
- [输出格式](#输出格式)
- [查看个人资料](#viewing-profiles)
- [限制](#限制)

## 基本分析
```bash
# Start profiling
agent-browser profiler start

# Perform actions
agent-browser navigate https://example.com
agent-browser click "#button"
agent-browser wait 1000

# Stop and save
agent-browser profiler stop ./trace.json
```
## 分析器命令
```bash
# Start profiling with default categories
agent-browser profiler start

# Start with custom trace categories
agent-browser profiler start --categories "devtools.timeline,v8.execute,blink.user_timing"

# Stop profiling and save to file
agent-browser profiler stop ./trace.json
```
## 类别

`--categories` 标志接受以逗号分隔的 Chrome 跟踪类别列表。默认类别包括：

- `devtools.timeline` -- 标准 DevTools 性能跟踪
- `v8.execute` -- 运行 JavaScript 所花费的时间
- `blink` -- 渲染器事件
- `blink.user_timing` -- `performance.mark()` / `performance.measure()` 通话
- `latencyInfo` -- 输入到延迟跟踪
- `renderer.scheduler` -- 任务调度和执行
- `toplevel` -- 广谱基本事件

还包括多个 `disabled-by-default-*` 类别，用于详细时间线、调用堆栈和 V8 CPU 分析数据。

## 用例

### 诊断页面加载缓慢
```bash
agent-browser profiler start
agent-browser navigate https://app.example.com
agent-browser wait --load networkidle
agent-browser profiler stop ./page-load-profile.json
```
### 分析用户交互
```bash
agent-browser navigate https://app.example.com
agent-browser profiler start
agent-browser click "#submit"
agent-browser wait 2000
agent-browser profiler stop ./interaction-profile.json
```
### CI 性能回归检查
```bash
#!/bin/bash
agent-browser profiler start
agent-browser navigate https://app.example.com
agent-browser wait --load networkidle
agent-browser profiler stop "./profiles/build-${BUILD_ID}.json"
```
## 输出格式

输出是 Chrome Trace Event 格式的 JSON 文件：
```json
{
  "traceEvents": [
    { "cat": "devtools.timeline", "name": "RunTask", "ph": "X", "ts": 12345, "dur": 100 },
    ...
  ],
  "metadata": {
    "clock-domain": "LINUX_CLOCK_MONOTONIC"
  }
}
```
`metadata.clock-domain` 字段根据主机平台（Linux 或 macOS）设置。在 Windows 上它被省略。

## 查看个人资料

在以下任意工具中加载输出 JSON 文件：

- **Chrome DevTools**：性能面板 > 加载配置文件（Ctrl+Shift+I > 性能）
- **Perfetto UI**: https://ui.perfetto.dev/ -- 拖放 JSON 文件
- **跟踪查看器**：任何 Chromium 浏览器中的 `chrome://tracing`

## 限制

- 仅适用于基于 Chromium 的浏览器（Chrome、Edge）。 Firefox 或 WebKit 不支持。
- 当分析处于活动状态时，跟踪数据会累积在内存中（上限为 500 万个事件）。在感兴趣的区域之后立即停止分析。
- 停止时的数据收集有 30 秒的超时时间。如果浏览器无响应，停止命令可能会失败。
