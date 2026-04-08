---
name: spec-bootstrap
description: “第 0 阶段支持工作流程：分析目标项目并在 docs/contexts/<slug>/ 下生成长期存在的项目上下文资产。在头脑风暴/计划/工作/审查之前运行此操作，为后续工作流提供持久上下文基础。”
argument-hint: "[target repo path or context slug]"
user-invocable: true
---

# 规范优先引导程序

为目标仓库生成可复用的项目上下文。这是一个 **Stage-0 支持工作流**：它运行一次（或按需运行），为后续规范优先工作流提供长期上下文资产。

**克劳德入口点：** `/spec:bootstrap [target-repo-path-or-slug]`
**法典入口点：** `$spec-bootstrap [target-repo-path-or-slug]`

## 为什么存在

spec-first 的五阶段工作流（头脑风暴 → 计划 → 工作 → 审查 → 复盘）依赖稳定的项目级上下文：架构、模块边界、已知陷阱和数据关系。没有这些内容，每次都会冷启动。

`spec-bootstrap` 会把这些信息生成到 `docs/contexts/<slug>/` 中。它不是主工作流的第六阶段，而是一个前置的资产生成器。

**当前版本范围：** 仅生成上下文资产。

---

## 先决条件

运行引导程序前：

1. 你正在目标项目内，或者已经指向目标项目
2. Claude Code 或 Codex 对目标项目源代码树有读取权限
3. （可选）MySQL CLI (`mysql`) 或 MCP MySQL 服务器可用于数据库 ER 生成
4. （可选）Serena MCP (`mcp__serena__*`) 可用于增强代码分析

### MCP 工具设置

要启用增强分析模式，请安装基础 MCP 工具：

```bash
/spec:mcp-setup quick
```

这会安装：
- **Serena**（用于增强模式）
- Sequential Thinking、Context7（通用依赖）

⚠️ 安装后请重启当前宿主以使配置生效。

验证安装：

```bash
<host> mcp list | grep -E "serena|context7|sequential-thinking"
```

### 工具使用指南

#### Serena（增强模式）

语义代码分析：符号查找、结构概述、模式搜索。

| 工具 | 目的 | 示例 |
|------|------|------|
| `mcp__serena__get_symbols_overview` | 文件结构 | `mcp__serena__get_symbols_overview({relative_path: "src/auth.ts"})` |
| `mcp__serena__find_symbol` | 定位符号 | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` | 模式搜索 | `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |
| `mcp__serena__find_referencing_symbols` | 查找引用 | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

工作流程：结构概述 → 定位符号 → 查找引用 → 模式搜索 → 读取源代码

---

## 主机就绪门

**在任何其他阶段之前运行此检查。如果失败，请立即停止。**

### 第 0 步：确定当前宿主

使用与 `mcp-setup` 相同的宿主选择规则，选出当前运行时宿主：

- Claude Code → `~/.claude/spec-first/host-setup.json`
- Codex → `~/.codex/spec-first/host-setup.json`

同时使用对应宿主的 CLI 做运行时检查：
- 当前宿主 CLI → 根据检测结果使用 `claude mcp list` 或 `codex mcp list`

### 第 1 步：检查 mcp-setup 标记

检查当前宿主的 `spec-first/host-setup.json` 是否存在并且 `setup_success == true`。

- **文件不存在，或存在但 `setup_success != true`** → 状态：`NOT_SETUP`

  输出给用户：

  ```text
  ⛔ spec-bootstrap 无法继续：宿主尚未完成 MCP 工具安装。

  原因：未检测到当前宿主的 spec-first/host-setup.json（或 setup_success 不为 true），
        说明 /spec:mcp-setup 尚未在本机成功执行。

  操作：请先运行 /spec:mcp-setup 并等待完成。

  完成后：重启当前宿主，然后重新运行 /spec:bootstrap。
  ```

  停止。不要进入后续步骤。

- **文件存在且 `setup_success == true`** → 继续到第 2 步。

### 第 2 步：检查 MCP 运行时可用性

执行一个轻量、无副作用的 MCP 调用，确认当前宿主已加载当前 MCP 配置。

首选探针：`context7 resolve-library-id`
回退探针：`serena get_current_config`

- **探针失败或返回错误** → 状态：`SETUP_DONE_NOT_RESTARTED`

  输出给用户：

  ```text
  ⛔ spec-bootstrap 无法继续：MCP 工具当前不可调用。

  原因：当前宿主的 spec-first/host-setup.json 存在（mcp-setup 已完成），
        但 MCP 工具当前不可调用，通常说明宿主尚未重启以加载新配置。

  操作：请重启当前宿主。

  完成后：重新运行 /spec:bootstrap。

  如果重启后仍看到此提示，请运行当前宿主对应的 `mcp list` 确认 MCP 服务已注册，
  或重新运行 /spec:mcp-setup。
  ```

  停止。不要进入 Phase 1。

- **探针成功** → 状态：`READY`。继续。

  注意：
  - 该探针只证明当前宿主至少加载了一个当前配置里的 MCP server
  - 它不代表 Serena 一定已经挂载在当前会话中
  - 工具级可用性要到 Phase 1.3 再单独判断；如果 `host-setup.json` 里写着 `configured=true`，
    但第一次项目级调用返回不可用，应记录 `reason=<tool>-not-mounted-in-session`

继续进入分析模式。

---

## 分析模式

在 Phase 1.3 探测结束后决定模式。

| 模式 | 条件 | 能力 |
|------|------|------|
| **增强** | `serena.ready` | 使用 Serena 做语义分析 |
| **基本** | 所有探测失败 | 仅使用 Read / Grep / Glob |

说明：
- `ready` 表示当前项目探测成功，不只是“工具已安装”
- 基本模式只使用内置工具，不依赖 MCP

报告格式：`> [Bootstrap] Analysis mode: <mode> | DB access: <db-mode>`

---

## Phase 1：分析目标仓库

### 1.1 建立上下文 Slug

应用 slug 优先级规则：

1. **用户显式：** 若参数匹配 `[a-z0-9-]+`，则直接视为 slug
2. **重用验证：** 扫描目标项目根目录下 `docs/contexts/*/README.md` 的 `<!-- spec-bootstrap -->` 标记
3. **目录名称：** 从目标项目根目录名称生成 kebab-case slug

**非阻塞策略：** 不要阻塞 slug 确认，直接在执行摘要中展示所选 slug。

### 1.2 重新运行备份

如果 `docs/contexts/<slug>/` 已经存在：
- 写入前备份到 `.context/spec-first/bootstrap/<slug>/backup_<ISO-timestamp>/`
- 验证备份文件数和原始文件数一致
- 成功后删除备份
- 失败时按恢复策略处理，避免留下半写状态

### 1.3 仓库分析

排除 `docs/contexts/`，因为那是历史输出。

**Serena 探测：**
1. 调用 `serena get_current_config`
   - 如果工具不可用或未挂载 → `serena.ready=false`，`reason=serena-not-mounted-in-session`
2. 如果没有活动项目：调用 `serena activate_project`
3. 校验返回的活动项目路径是否与 `$CWD` 一致
   - 不一致 → `serena.ready=false`，`reason=serena-wrong-project-activated`
4. 路径一致后，调用 `serena get_symbols_overview`
- 成功 → `serena.ready=true`
- 失败 → `serena.ready=false`，记录原因

**模式选择：**

```
if serena.ready  → Enhanced
else             → Basic
```

**报告给用户：**

```text
🔍 检测项目工具就绪状态...

Serena:   ready=yes, project=<path>

📊 分析模式: Enhanced
```

如果 Serena 不可用：

```text
Serena:   ready=no, reason=serena-not-mounted-in-session

📊 分析模式: Basic
```

然后按选定模式继续分析。

**增强模式（Serena MCP）：**

```
1. get_symbols_overview  → 了解文件结构
2. find_symbol           → 定位关键类、服务、路由
3. search_for_pattern    → 查找 API 路由、ORM 模型、配置模式
4. Synthesize            → 模块图、关键入口、层边界
```

**基本模式（内置工具）：**

```
1. Glob 目录结构
2. Grep 框架标记
3. Read 入口文件
4. Synthesize 顶层结构和技术栈
```

**最低质量保证：**
- `00-summary.md` 必须识别主要语言、主要框架和顶层模块结构
- `architecture/module-map.md` 必须包含顶级目录和一行用途说明

### 1.4 层检测

使用机械证据检测层：

| 层 | 检测标准 |
|----|----------|
| 前端 | package.json 依赖中的 React/Vue/Angular/Svelte/SolidJS/HTMX |
| 后端 | API 路由或服务端框架 |
| 移动 | `android/`、`ios/`、`flutter/` 目录或 React Native deps |
| 桌面 | Electron/Tauri 依赖、`.xcodeproj`、`.csproj` |
| cli | `bin` 字段、`click`、`argparse`、`clap` 等入口 |
| 共享 | 显式跨层共享代码目录 |
| 数据 | 数据库架构、ETL、数据管道定义 |

只有当检测到至少 3 个活动层且至少 2 个层存在显式跨层依赖时，才生成 `guides/index.md`。

### 1.5 数据库配置检测

扫描目标项目的 MySQL 连接配置。

检测优先级：
1. 用户显式参数
2. `.spec-first/meta/config.yaml`
3. 环境变量
4. ORM 配置
5. 框架配置

**MVP：** 仅主动处理 MySQL。

**CLI 验证（MySQL）：**

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS --connect-timeout=10 -e "SELECT 1;" 2>/dev/null
```

---

## Phase 2：创建 PRD 任务合约

控制平面位置：`.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md`

### 2.1 固定任务

| Task ID | Produces |
|---------|---------|
| `summary-context` | `docs/contexts/<slug>/00-summary.md` |
| `architecture-context` | `docs/contexts/<slug>/architecture/system-overview.md`, `module-map.md`, `integration-boundaries.md` |
| `pitfalls-context` | `docs/contexts/<slug>/pitfalls/index.md` |

### 2.2 条件层任务

按 Phase 1.4 的层检测结果生成对应任务。

### 2.3 Database Task

仅当 Phase 1.5 检测到 MySQL 时生成 `database-context` 任务。

### 2.4 PRD 内容

每个 PRD 必须：
- 写清目标文件
- 只包含与自身任务相关的上下文
- 指定可用工具
- 说明文件所有权和验收标准

---

## 验证

完成后：

1. 确认生成的上下文文件非空
2. 确认 `docs/contexts/<slug>/index.md`（如果存在）只链接真实文件
3. 确认执行摘要包含实际选择的分析模式和 slug
