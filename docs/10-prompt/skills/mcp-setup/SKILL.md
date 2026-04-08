---
name: spec-mcp-setup
description: “一键式 MCP 工具安装和配置，用于规范优先工作流程。安装 Serena、Sequential Thinking、Context7（必需）和 Playwright MCP（可选），支持 Claude Code / Codex / Windows PowerShell 宿主。”
argument-hint: "[quick|custom]"
---

# MCP 工具设置

安装并配置 spec-first 工作流所需的 MCP 工具。

**克劳德入口点：** `/spec:mcp-setup [quick|custom]`
**法典入口点：** `/spec:mcp-setup [quick|custom]`
如果你在 Codex 会话里直接调用技能命名空间，`$spec-mcp-setup [quick|custom]` 仍然可用。
如果两个宿主 CLI 都存在且没有环境提示，请显式设置 `MCP_SETUP_HOST=claude|codex`，脚本不会猜测宿主。

## 概述

此技能负责安装和配置 spec-first 使用的 MCP 工具：

平台入口：
- macOS / Linux：使用 `bash` 执行 `*.sh`
- Windows：使用 `pwsh` 7+ 执行对应的 `*.ps1`

| 工具 | 类别 | 用途 |
|------|------|------|
| Serena | 必需 | 为 spec-bootstrap 的增强模式提供符号级精确编辑 |
| Sequential Thinking | 必需 | 提供动态反思式问题求解 |
| Context7 | 必需 | 提供最新框架文档查询 |
| Playwright MCP | 可选 | 前端自动化测试 |

**实际流程：** `/spec:mcp-setup` → 重启当前宿主 → `/spec:bootstrap` → 完成。

## 配置

工具元数据定义在 `skills/mcp-setup/mcp-tools.json` 中。每个条目包含：
- `id`、`name`、`category`
- `dependencies`（node / uv）
- `mcp_config`（MCP 服务注册命令与参数；`__HOST_CONTEXT__` 这类占位符会在安装时按宿主解析）
- `detect`（检测方法和参数）

---

## 第 1 阶段：依赖检测

**目标：** 检测前置依赖（`node`、`uv`、`jq`）并在用户同意后自动安装。

### 1.1 运行依赖检查

```bash
bash skills/mcp-setup/scripts/check-deps.sh
```

Windows：
```powershell
pwsh -File skills/mcp-setup/scripts/check-deps.ps1
```

输出示例：

```json
{
  "node": { "installed": true, "version": "v20.11.0" },
  "uv": { "installed": true, "version": "uv 0.4.0" },
  "jq": { "installed": true, "version": "jq-1.7" }
}
```

### 1.2 处理缺失依赖

| 依赖 | 安全级别 | 行为 |
|------|----------|------|
| uv | safe_auto | 直接安装：`curl -LsSf https://astral.sh/uv/install.sh | sh` |
| jq | safe_auto | 包管理器安装：`brew install jq` / `apt install jq` |
| Node.js | gated_auto | 通过 fnm 安装，并提示 PATH 兼容风险 |

如果用户拒绝自动安装，则显示手动安装说明并退出。

### 1.3 验证依赖

自动安装后或所有依赖都存在时，重新运行当前平台对应的依赖检测脚本。如果仍然缺失，显示说明并退出。

---

## 第 2 阶段：快速安装 + 配置合并

**目标：** 安装所有必需工具，并把 MCP 配置写入当前宿主的配置文件。

Windows：
```powershell
pwsh -File skills/mcp-setup/scripts/install-coordinator.ps1
```

### 2.1 检测现有工具

```bash
bash skills/mcp-setup/scripts/detect-tools.sh
```

Windows：
```powershell
pwsh -File skills/mcp-setup/scripts/detect-tools.ps1
```

输出示例：

```json
{
  "installed": ["serena", "context7", "sequential-thinking"],
  "missing": []
}
```

### 2.2 安装所需工具

对每个缺失的必需工具，写入对应的 `mcp_config`。

显示进度：

```text
🧭 我会先检查当前宿主的配置，再逐个补齐缺失工具。
⏳ Configuring Serena...
✅ Serena configured
⏳ Configuring Context7...
✅ Context7 configured
```

带有 `mcp_config` 的工具不需要额外二进制安装。
跳过已配置工具。

### 2.3 配置合并

使用原子化合并：

1. 备份当前宿主配置文件
2. 获取锁
3. 只添加缺失的宿主专属 MCP 条目
4. 校验命令返回后条目已存在
5. 配置失败时恢复备份
6. 释放锁

现有配置绝不覆盖。

---

## 第 3 阶段：可选工具

在必需工具安装完成后，再询问可选工具。

### 3.1 询问可选工具

询问用户是否安装可选工具。

可选工具：
- Playwright MCP

如果用户选择，则复用第 2 阶段的安装 + 配置流程。

### 3.2 非交互模式跳过

如果参数是 `quick`，跳过可选工具提示。

---

## 第 4 阶段：宿主验证

在第 3 阶段后运行，用于记录宿主级安装状态。

### 4.1 写入宿主就绪标记

运行 `skills/mcp-setup/scripts/verify-tools.sh`，验证宿主级安装状态并写入当前宿主的 `spec-first/host-setup.json`。

Windows：
```powershell
pwsh -File skills/mcp-setup/scripts/verify-tools.ps1
```

验证步骤会打印当前宿主的基础状态和最终标记路径，方便用户判断是否需要重启。

Claude Code 写入 `~/.claude/spec-first/host-setup.json`，Codex 写入 `~/.codex/spec-first/host-setup.json`。

`setup_success` 表示基础宿主前置条件已经准备就绪：
- `serena`、`context7`、`sequential-thinking` 已写入当前宿主配置文件

如果 `verify-tools.sh` 退出非零：
- 使用脚本错误输出报告失败
- 不要声称设置已完成

如果验证后 `setup_success == false`：
- 报告缺失或配置错误的基础工具
- 不要声称设置已完成

如果可选工具缺失：
- 报告为可选项未安装
- 只要基础工具就绪，就视为完成

---

## 验证

全部安装完成后：

1. 重新运行当前平台对应的检测脚本，基础工具应显示为已安装
2. 验证当前宿主配置文件包含基础 MCP 条目（`serena`、`context7`、`sequential-thinking`）
3. 读取当前宿主的 `spec-first/host-setup.json` 并确认 `setup_success == true`
4. 输出摘要：

```text
✅ MCP Tools Setup Complete

Installed: Serena, Sequential Thinking, Context7
Skipped (already present): [list]
Optional: Playwright MCP [installed / not installed]

Host readiness:
- dependencies: ready
- mcp config: ready
- host marker: written (current host's `spec-first/host-setup.json`)

Next steps:
1. 重启当前宿主（需要加载新的 MCP 配置）
2. Run /spec:bootstrap
```

---

## 错误处理

| 场景 | 行动 |
|------|------|
| 依赖项缺失且用户拒绝安装 | 显示手动说明并退出 |
| 单个工具安装失败 | 继续处理其他工具，最后汇报失败 |
| 配置合并失败 | 从备份恢复并报告错误 |
| 当前宿主配置文件不存在 | 通过宿主 CLI 创建初始结构 |
| jq 不可用 | 要求安装 jq |

---

## 范围边界

**包含：**
- 3 个必需工具 + 1 个可选工具的安装与配置
- 安装状态检测与验证
- 用户交互和进度反馈
- macOS / Linux / Windows 支持

**不包含：**
- MCP 工具卸载
- MCP 工具更新/升级
- 自定义 MCP 配置参数
- `mcp-tools.json` 之外的工具
- 运行时 MCP 服务可用性验证（由 spec-bootstrap 在项目级探测中处理）

---

## 附录：host-setup.json Schema

`~/.claude/spec-first/host-setup.json` 和 `~/.codex/spec-first/host-setup.json` 是 mcp-setup 和 spec-bootstrap 之间的协调文件。

### Schema v4

```json
{
  "version": "4",
  "host": "claude",
  "completed_at": "2026-04-08T12:00:00Z",
  "setup_success": true,
  "tools": {
    "serena": { "configured": true },
    "context7": { "configured": true },
    "sequential-thinking": { "configured": true }
  }
}
```

### 消费方

| 字段 | 消费方 | 用途 |
|------|------|------|
| `host` | spec-bootstrap Host Readiness Gate Step 0 | 选择匹配的运行时 marker 和探针路径 |
| `setup_success` | spec-bootstrap Host Readiness Gate Step 1 | 判断宿主前置条件是否就绪 |
| `tools.*.configured` | spec-bootstrap 运行时检查 | 跳过已知缺失的工具 |
