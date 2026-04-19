---
date: 2026-04-01
topic: mcp-setup-skill
---

# MCP 工具一键安装 Skill

## Problem Frame

spec-graph-bootstrap 依赖 GitNexus、ABCoder、Serena 三个 MCP 工具才能运行 Full mode。用户需要手动安装和配置这些工具，流程繁琐且容易出错。需要一个 skill 简化这个过程，让用户可以快速配置完整的 MCP 工具链。

## Requirements

**安装模式**
- R1. 提供两种安装模式：快速模式（默认）和自定义模式
- R2. 快速模式：自动安装所有必装工具，最小化用户决策
- R3. 自定义模式：用户可选择要安装哪些工具

**自动化能力**
- R4. 智能检测前置依赖（Node.js, Go, uv）
- R5. 缺失依赖时提供一键安装命令或详细指引
- R6. 自动安装所有必装工具（快速模式）
- R7. 自动写入配置到 ~/.claude.json
- R8. 自动验证配置是否正确

**交互式引导**
- R9. 实时显示安装进度（⏳ 安装中 → ✅ 完成 / ❌ 失败）
- R10. 缺失依赖时询问是否自动安装
- R11. 安装完成后询问是否安装可选工具
- R12. 单个工具失败时提供重试选项
- R13. 显示具体错误和解决建议

**增量安装**
- R14. 检测已安装的工具，仅安装缺失的
- R15. 跳过已存在的配置
- R16. 支持断点续装

**ABCoder 特殊处理**
- R17. 安装阶段只安装 ABCoder 二进制
- R18. spec-graph-bootstrap 启动时检测 ABCoder 配置
- R19. 未配置时自动为当前项目生成 AST
- R20. 自动写入 AST 路径到配置文件

## 工作流程

### 用户视角流程（自定义模式）

```
用户运行: /mcp:setup
    ↓
1. 选择安装模式
   [1] 快速安装（推荐）
   [2] 自定义安装 - 手动选择工具
    ↓ [用户选 2]
2. 检测已安装工具
    ↓
3. 展示工具列表
   ✅ Serena [已安装]
   ⬜ GitNexus [未安装]
   ⬜ ABCoder [未安装]
   ⬜ Sequential Thinking [未安装]
   ⬜ Context7 [未安装]
   ⬜ Playwright MCP [未安装]
    ↓
4. 用户勾选要安装的工具
    ↓
5. 确认并安装
   ⏳ 安装中...
    ↓
6. 显示结果 + 提示重启
```

### ABCoder 自动配置流程（集成到 spec-graph-bootstrap）

```
用户运行: /spec:graph-bootstrap
    ↓
1. 检测 ABCoder 配置
   读取 ~/.claude.json → mcpServers.abcoder
    ↓ (未配置)
2. 提示自动配置
   > ABCoder 未配置，是否为当前项目生成 AST？[Y/n]
    ↓ [用户选 Y]
3. 检测项目语言
   扫描项目文件 → 识别主要语言
    ↓
4. 执行 abcoder parse
   > 正在解析项目... (可能需要 1-3 分钟)
   abcoder parse <language> . -o ~/.claude/abcoder-ast/<project-name>
    ↓
5. 写入配置到 ~/.claude.json
   mcpServers.abcoder.args = ["mcp", "<ast-path>"]
    ↓
6. 提示重启
   > ABCoder 已配置，请重启 Claude Code
   > 重启后将启用 Full 分析模式
```

### 技术实现流程

```
SKILL.md (编排层)
    ↓
1. 检测 OS → 选择脚本 (.sh / .ps1)
    ↓
2. 调用 install-coordinator 脚本
    ↓
install-coordinator (执行层)
    ↓
3. 读取 mcp-tools.json
    ↓
4. 检查依赖 (node -v, go version, uv --version)
    ↓
5. 检测已安装工具 (读取 ~/.claude.json)
    ↓
6. 返回工具状态 JSON → SKILL
    ↓
SKILL 展示列表 → 用户选择
    ↓
7. SKILL 调用 install-coordinator --install <tool-ids>
    ↓
8. 备份 ~/.claude.json
    ↓
9. 逐个安装:
   - 有 install_command → 执行命令
   - 有 mcp_config → 写入配置
    ↓
10. 返回安装结果 JSON → SKILL
    ↓
11. SKILL 展示结果 + 后续步骤
```

**错误处理**
- R14. 安装失败时显示具体错误信息
- R15. 部分工具安装失败时，继续安装其他工具
- R16. 提供重试选项

## MCP 工具列表

| 工具 | 定位 | 必装/可选 |
|------|------|-----------|
| Serena | 符号级精确编辑引擎 | ✅ 必装 |
| GitNexus | 代码知识图谱/架构引擎 | ✅ 必装 |
| ABCoder | 跨语言语义增强 | ✅ 必装 |
| Sequential Thinking | 动态反思性问题解决 | ✅ 必装 |
| Context7 | 最新框架文档查询 | ✅ 必装 |
| Playwright MCP | 前端自动化测试 | 📌 可选 |

## Success Criteria

- 用户可以通过一个命令 `/mcp:setup` 完成所有 MCP 工具的安装
- 安装过程有清晰的进度反馈
- 安装失败时有明确的错误提示和解决建议
- 安装完成后可以立即运行 spec-graph-bootstrap Full mode

## Scope

**包含：**
- MCP 工具安装和配置
- 安装状态检测和验证
- 用户交互和进度反馈
- 安装后可选运行 spec-graph-bootstrap

**不包含：**
- MCP 工具的卸载功能
- MCP 工具的更新/升级功能
- 自定义 MCP 工具配置参数
- 非列表中的其他 MCP 工具

## Technical Direction

**架构设计：配置驱动 + 分层脚本**

### 文件结构

```
.claude/skills/mcp-setup/
├── SKILL.md                    # Skill 定义（编排层）
├── mcp-tools.json              # 工具配置（配置层）
└── scripts/
    ├── install-coordinator.sh  # 安装协调器（执行层）
    └── install-coordinator.ps1 # Windows 协调器
```

### 架构分层

**1. 配置层 (mcp-tools.json)**
- 定义所有工具的元数据
- 包含安装方式、检测方法、依赖关系
- 新增工具只需修改此文件

**2. 编排层 (SKILL.md)**
- 用户交互：展示工具列表、收集选择
- 流程控制：前置检查 → 安装 → 验证 → 配置
- 错误处理：友好提示、恢复建议
- 调用执行层脚本

**3. 执行层 (install-coordinator)**
- 读取 mcp-tools.json 配置
- 依赖检查（Node.js/Go/uv 版本）
- 逐个安装工具
- 配置文件合并（增量更新 ~/.claude.json）
- 返回结构化 JSON 结果

### 健壮性保障

**1. 依赖检查**
- 安装前检查 Node.js/Go/uv 版本
- 不满足则给出明确安装指引，停止安装
- 避免半成品安装

**2. 原子性**
- 每个工具独立安装，失败不影响其他
- 记录安装状态到临时文件 `.mcp-setup-state.json`
- 支持断点续装

**3. 回滚机制**
- 安装前备份 `~/.claude.json` 到 `.claude.json.backup`
- 失败时自动恢复备份
- 记录失败原因供用户排查

**4. 幂等性**
- 重复运行不会重复安装
- 检测已安装工具并跳过
- 支持 `--repair` 模式修复损坏的安装

**5. 错误处理**
- 每个命令捕获 stderr
- 超时机制（默认 60s）
- 友好的错误提示（翻译技术错误为用户语言）

**新增简单工具（如 Sequential Thinking）：**
1. 在 `mcp-tools.json` 添加一个条目
2. 无需修改任何代码

**新增复杂工具（如 ABCoder）：**
1. 在 `mcp-tools.json` 添加条目，`install_type: "complex"`
2. 创建 `scripts/tools/install-<tool>.sh` 脚本
3. 无需修改编排层和执行层

**修改安装逻辑：**
- 只改对应的工具脚本
- 不影响其他工具
- 不需要修改 Skill

**版本管理：**
- `mcp-tools.json` 包含 `version` 字段
- 支持配置文件升级迁移
- 向后兼容旧版本配置

### 平台适配

**跨平台处理：**
- 协调器脚本分为 `.sh` 和 `.ps1` 两个版本
- Skill 根据 OS 自动选择对应脚本
- 配置文件路径自动适配

**平台差异表：**
| 差异项 | macOS/Linux | Windows |
|--------|-------------|---------|
| 配置文件路径 | `~/.claude.json` | `C:\Users\<username>\.claude.json` |
| ABCoder 命令 | `abcoder` | `abcoder.exe` |
| 路径分隔符 | `/` | `\\` |
| 脚本扩展名 | `.sh` | `.ps1` |
| Git 要求 | 可选 | 必须（Git for Windows）|

**平台特定配置：**
- `mcp-tools.json` 支持 `platform_overrides` 字段
- 例如：Windows 下 ABCoder 命令改为 `abcoder.exe`

### 配置文件结构 (mcp-tools.json)

```json
{
  "version": "1.0",
  "tools": [
    {
      "id": "serena",
      "name": "Serena",
      "category": "required",
      "mcp_config": {
        "command": "uvx",
        "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"]
      },
      "detect": {
        "method": "mcp_config",
        "key": "serena"
      },
      "dependencies": ["uv"]
    },
    {
      "id": "gitnexus",
      "name": "GitNexus",
      "category": "required",
      "mcp_config": {
        "command": "npx",
        "args": ["-y", "gitnexus", "mcp"]
      },
      "detect": {
        "method": "mcp_config",
        "key": "gitnexus"
      },
      "dependencies": ["node"]
    },
    {
      "id": "abcoder",
      "name": "ABCoder",
      "category": "required",
      "install_command": "go install github.com/cloudwego/abcoder@latest",
      "mcp_config": null,
      "note": "ABCoder 安装后需要用户手动配置 AST 目录",
      "detect": {
        "method": "command",
        "command": "abcoder version"
      },
      "dependencies": ["go"]
    },
    {
      "id": "sequential-thinking",
      "name": "Sequential Thinking",
      "category": "required",
      "mcp_config": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
      },
      "detect": {
        "method": "mcp_config",
        "key": "sequential-thinking"
      },
      "dependencies": ["node"]
    },
    {
      "id": "context7",
      "name": "Context7",
      "category": "required",
      "mcp_config": {
        "command": "npx",
        "args": ["-y", "@upstash/context7-mcp"]
      },
      "detect": {
        "method": "mcp_config",
        "key": "context7"
      },
      "dependencies": ["node"]
    },
    {
      "id": "playwright",
      "name": "Playwright MCP",
      "category": "optional",
      "mcp_config": {
        "command": "npx",
        "args": ["@playwright/mcp@latest"]
      },
      "detect": {
        "method": "mcp_config",
        "key": "playwright"
      },
      "dependencies": ["node"]
    }
  ]
}
```

**配置说明：**
- `mcp_config`: 直接写入 `~/.claude.json` 的配置
- `install_command`: 需要预先执行的安装命令（如 ABCoder）
- `mcp_config: null`: 表示不自动写入配置（需要用户手动配置）
- `detect.method`: `mcp_config` 检查配置文件，`command` 检查命令是否存在

## MCP 工具安装详情

### 必装工具（5个）

**1. Serena**
- Git 地址：`https://github.com/oraios/serena`
- 必须依赖：`uv / uvx`
- 推荐依赖：对应语言的 LSP server
- 安装命令：`uvx --from git+https://github.com/oraios/serena serena start-mcp-server`
- 配置路径：`~/.claude.json` (用户级) 或 `.mcp.json` (项目级)
- 检测方法：检查 `~/.claude.json` 中是否存在 `mcpServers.serena` 配置

**2. GitNexus**
- Git 地址：`https://github.com/nxpatterns/gitnexus`
- 必须依赖：`Node.js + npm/npx`
- 安装命令：`npx -y gitnexus` (首次运行会自动安装)
- 检测方法：检查 `~/.claude.json` 中是否存在 `mcpServers.gitnexus` 配置

**3. ABCoder**
- Git 地址：`https://github.com/cloudwego/abcoder`
- 必须依赖：`Go`
- 安装命令：`go install github.com/cloudwego/abcoder@latest`
- 检测方法：检查 `~/.claude.json` 中是否存在 `mcpServers.abcoder` 配置
- **注意：** ABCoder 需要 AST 目录，但这是使用时的配置，不是安装时的要求

**4. Sequential Thinking**
- Git 地址：`https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking`
- 必须依赖：`Node.js + npm/npx`
- 包名：`@modelcontextprotocol/server-sequential-thinking`
- 安装命令：`npx -y @modelcontextprotocol/server-sequential-thinking` (首次运行会自动安装)
- 检测方法：检查 `~/.claude.json` 中是否存在 `mcpServers.sequential-thinking` 配置

**5. Context7**
- Git 地址：`https://github.com/upstash/context7`
- 必须依赖：`Node.js + npm/npx`
- 推荐依赖：Context7 API Key（可选，用于更高 rate limits）
- 安装命令：`npx -y @upstash/context7-mcp` (首次运行会自动安装)
- 检测方法：检查 `~/.claude.json` 中是否存在 `mcpServers.context7` 配置

### 可选工具（1个）

**6. Playwright MCP**
- Git 地址：`https://github.com/microsoft/playwright-mcp`
- 必须依赖：`Node.js + npm/npx`
- 推荐依赖：Playwright MCP Chrome Extension（用于复用浏览器登录态）
- 安装命令：`npx @playwright/mcp@latest` (首次运行会自动安装)
- 检测方法：检查 `~/.claude.json` 中是否存在 `mcpServers.playwright` 配置

## 安装脚本输出格式

```json
{
  "tools": [
    {
      "name": "serena",
      "status": "installed" | "not_installed" | "failed",
      "message": "详细信息或错误消息"
    }
  ],
  "summary": {
    "total": 6,
    "installed": 5,
    "failed": 0,
    "skipped": 1
  }
}
```

## 前置条件

**必须依赖：**
- `uv / uvx` - 用于 Serena
- `Node.js + npm/npx` - 用于 GitNexus, Sequential Thinking, Context7, Playwright MCP
- `Go` - 用于 ABCoder

**推荐依赖：**
- 各语言的 LSP server（Serena 依赖）
- Context7 API Key（可选，用于更高 rate limits）

**检测命令：**
```bash
node -v && npm -v && npx -v
go version
uv --version && uvx --version
```

## Outstanding Questions

**已解决：**
- ✅ 配置文件路径：统一使用 `~/.claude.json`
- ✅ 前置依赖安装策略：检测 + 给出安装指引，不自动安装
- ✅ MCP 配置文件合并策略：增量合并，保留已有配置
- ✅ 工具检测方法：统一检查 `~/.claude.json` 中的 `mcpServers` 配置
- ✅ ABCoder 简化：只安装二进制，AST 配置留给用户使用时处理

**设计决策：**
- npx 工具（GitNexus, Sequential Thinking, Context7, Playwright）首次运行时自动安装，无需预安装
- ABCoder 只安装 `go install`，不在安装阶段处理 AST 生成
- 配置写入 `~/.claude.json`，用户需重启 Claude Code 生效

## MCP 配置示例

### macOS/Linux 配置

**配置文件位置：** `~/.claude.json` 或项目级 `.mcp.json`

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"]
    },
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus", "mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "abcoder": {
      "command": "abcoder",
      "args": ["mcp", "/ABS/PATH/TO/AST_DIR"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**注意：** `/ABS/PATH/TO/AST_DIR` 需要替换为实际的 ABCoder AST 目录路径。

### Windows 配置

**配置文件位置：** `C:\Users\你的用户名\.claude.json`

**前置要求：** 必须先安装 Git for Windows（Claude Code 官方要求）

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"]
    },
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus", "mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "abcoder": {
      "command": "abcoder.exe",
      "args": ["mcp", "D:\\mcp-data\\abcoder-ast"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**Windows 路径注意事项：**
- ABCoder 命令使用 `abcoder.exe`（或 `abcoder` 如果已在 PATH 中）
- 路径使用双反斜杠 `\\` 或正斜杠 `/`
- 示例：`D:\\mcp-data\\abcoder-ast` 或 `D:/mcp-data/abcoder-ast`

## 安装脚本示例

### macOS/Linux 安装脚本

```bash
#!/usr/bin/env bash
set -e

echo "== 检查 Node.js =="
node -v && npm -v && npx -v

echo "== 检查 Go =="
go version

echo "== 检查 uv =="
uv --version || echo "⚠️  uv 未安装，请访问: https://docs.astral.sh/uv/getting-started/installation/"

echo "== 安装 ABCoder =="
go install github.com/cloudwego/abcoder@latest

echo "== 预热 npm-based MCP 包 =="
npx -y @modelcontextprotocol/server-sequential-thinking --help || true
npx -y @upstash/context7-mcp --help || true
npx -y gitnexus --help || true

echo "== 测试 Serena =="
uvx --from git+https://github.com/oraios/serena serena --help || true

echo "✅ 安装完成"
```

### Windows 安装脚本 (PowerShell)

```powershell
# Windows MCP 工具安装脚本

Write-Host "== 检查 Git for Windows ==" -ForegroundColor Cyan
git --version

Write-Host "`n== 检查 Node.js ==" -ForegroundColor Cyan
node -v
npm -v
npx -v

Write-Host "`n== 检查 Go ==" -ForegroundColor Cyan
go version

Write-Host "`n== 检查 uv ==" -ForegroundColor Cyan
try {
    uv --version
} catch {
    Write-Host "⚠️  uv 未安装，请访问: https://docs.astral.sh/uv/getting-started/installation/" -ForegroundColor Yellow
}

Write-Host "`n== 安装 ABCoder ==" -ForegroundColor Cyan
go install github.com/cloudwego/abcoder@latest

Write-Host "`n== 验证 npm-based MCP 包 ==" -ForegroundColor Cyan
npx -y @modelcontextprotocol/server-sequential-thinking --help
npx -y @upstash/context7-mcp --help
npx -y gitnexus --help
npx @playwright/mcp@latest --help

Write-Host "`n== 测试 Serena ==" -ForegroundColor Cyan
uvx --from git+https://github.com/oraios/serena serena --help

Write-Host "`n✅ 安装完成" -ForegroundColor Green
Write-Host "请按照以下步骤完成配置：" -ForegroundColor Yellow
Write-Host "1. 在项目根目录运行: npx gitnexus analyze"
Write-Host "2. 生成 ABCoder AST 目录"
Write-Host "3. 编辑 C:\Users\$env:USERNAME\.claude.json"
Write-Host "4. 重启 Claude Code"
```

**Windows 安装顺序建议：**
1. 安装 Git for Windows（必须）
2. 安装 Node.js
3. 安装 Go
4. 安装 uv
5. 安装 Claude Code
6. 运行上述 PowerShell 脚本
7. 在项目根目录运行 `npx gitnexus analyze`
8. 准备 ABCoder AST 目录
9. 配置 `~/.claude.json`
10. 重启 Claude Code
