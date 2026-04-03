---
name: mcp-setup
description: “一键式 MCP 工具安装和配置，用于规范优先的工作流程。安装 Serena、GitNexus、ABCoder、Sequential Thinking、Context7（必需）和 Playwright MCP（可选）。”
argument-hint: "[quick|custom]"
---
# MCP 工具设置

安装和配置规范优先完整模式所需的 MCP 工具。

**克劳德入口点：** `/spec:mcp-setup [quick|custom]`
**法典入口点：** 尚不支持

## 概述

此技能可自动安装和配置规范优先工作流程所需的 MCP 工具：

|工具|类别 |目的|
|------|----------|---------|
|瑟琳娜|必填 |符号级精度编辑（spec-bootstrap 增强/完整模式）|
| GitNexus |必填 |代码知识图谱/架构引擎（spec-bootstrap Full模式）|
| AB编码器|必填 |跨语言语义增强（此处安装二进制 + MCP 配置；在spec-bootstrap 生成 AST）|
|顺序思维 |必填 |动态反思性问题解决（普遍依赖）|
|背景7 |必填 |最新框架文档查询（通用依赖）|
|剧作家 MCP |可选|前端自动化测试 |

**实际流程：** `/spec:mcp-setup`（安装+配置包括ABCoder MCP在内的所有工具）→重启Claude Code→`/spec:bootstrap`（项目分析+ABCoder AST生成）→完成。

## 配置

工具元数据在 `skills/mcp-setup/mcp-tools.json` 中定义。每个工具条目包括：
- `id`、`name`、`category`（必需/可选）
- `dependencies`（节点/go/uv）
- `mcp_config`（用于 MCP 服务器注册的命令 + 参数，如果不适用则为 null）
- `install_command`（二进制安装命令，适用于 ABCoder 等工具）
- `detect`（检测方法及参数）

---

## 第 1 阶段：依赖性检测

**目标：** 检测先决条件（Node.js、Go、uv、jq）并在用户同意的情况下自动安装。

### 1.1 运行依赖性检查
```bash
bash skills/mcp-setup/scripts/check-deps.sh
```
此脚本输出 JSON 以及每个依赖项的状态：
```json
{
  "node": { "installed": true, "version": "v20.11.0" },
  "go": { "installed": false, "install_suggestion": { "command": "...", "safety": "gated_auto" } },
  "uv": { "installed": true, "version": "uv 0.4.0" },
  "jq": { "installed": true, "version": "jq-1.7" }
}
```
### 1.2 处理缺失的依赖项

对于每个缺少的依赖项，使用 AskUserQuestion 询问用户是否自动安装：

**安全等级：**

|依赖|安全|行为 |
|------------|--------|----------|
|紫外线|安全汽车 |直接安装：`curl -LsSf https://astral.sh/uv/install.sh \| sh` — 安装到 `~/.cargo/bin/`，无需 sudo |
| jq |安全汽车 |包管理器安装：`brew install jq` / `apt install jq` — 无版本冲突 |
| Node.js |门控自动 |通过 fnm 安装 — 显示风险提示：“可能与系统 Node.js 冲突”|
|去 |门控自动 |安装到用户目录 — 显示风险提示：“需要 PATH 配置”|

**自动安装命令：**

- **紫外线：** `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **jq:** `brew install jq` (macOS) / `sudo apt-get install -y jq` (Linux)
- **Node.js 通过 fnm:** `curl -fsSL https://fnm.vercel.app/install | bash && export FNM_PATH="$HOME/.fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm install --lts`
- **Go:** 从 `https://go.dev/dl/?mode=json` 获取最新稳定版本，下载到 `~/.local/go`，添加到 PATH

如果用户拒绝自动安装，则显示手动安装说明并退出。

### 1.3 验证依赖关系

自动安装后或当所有依赖项都存在时，重新运行 `check-deps.sh` 进行验证。如果仍然缺少任何依赖项，则显示说明并退出。

---

## 第 2 阶段：快速安装 + 配置合并

**目标：** 安装所有必需的工具并将其 MCP 配置写入 `~/.claude.json`。

### 2.1 检测现有工具
```bash
bash skills/mcp-setup/scripts/detect-tools.sh
```
这将读取 `~/.claude.json` 并检查现有工具配置。输出：
```json
{
  "installed": ["serena", "context7", "sequential-thinking"],
  "missing": ["gitnexus", "abcoder"]
}
```
### 2.2 安装所需工具

对于每个缺少的必需工具（类别=“必需”）：

1. **带有`install_command`**的工具（例如ABCoder）：执行安装命令
2. **仅限 `mcp_config` 的工具**（例如，Serena、GitNexus、Sequential Thinking、Context7）：无需二进制安装 - npx/uvx 在运行时处理此问题

实时显示进度：
```
⏳ Installing ABCoder...
✅ ABCoder installed (go install)
⏳ Configuring GitNexus...
✅ GitNexus configured
```
跳过已安装的工具（幂等）。

### 2.3 配置合并

**具有并发安全性的原子写入：**

1. **备份：** `cp ~/.claude.json ~/.claude.json.backup.<timestamp>` 和 `chmod 600`
2. **Lock:** `flock ~/.claude.json.lock` (Linux/macOS) — 如果集群不可用则回退到时间戳警告
3. **合并：** 使用 `jq` 仅增量添加缺失的 `mcpServers` 条目：
   ```bash
   jq --argjson config "$TOOL_CONFIG" '.mcpServers += $config | .mcpServers' ~/.claude.json
   ```
4. **Validate:** `jq 。 < tmpfile` — verify JSON validity
5. **Atomic replace:** Write to temp file → validate → `mv` (POSIX atomic)
6. **Unlock:** Release flock

**Idempotent:** Existing mcpServers entries are never overwritten.

On failure, restore from backup and report error.

---

## Phase 3: Optional Tools

**Goal:** Offer optional tools after required tools are installed.

### 3.1 Prompt for Optional Tools

Use AskUserQuestion to ask:

"Required tools installed successfully. Would you like to install optional tools?"

Available optional tools (from mcp-tools.json where category="optional"):
- Playwright MCP — Frontend automation testing

If the user selects tools, run the same install + configure flow from Phase 2.

### 3.2 Skip in Non-Interactive Mode

If argument is `quick`, skip optional tool prompts entirely.

---

## Phase 4: Host Verification

Run after Phase 3 to record host-level install state and configure ABCoder MCP server.

### 4.1 Write Host Readiness Marker

Run `skills/mcp-setup/scripts/verify-tools.sh` to validate host-level install state
and write `~/.claude/spec-first/host-setup.json`.

If `verify-tools.sh` 退出非零（例如，无法写入标记文件）：
- 使用脚本的错误输出报告失败
- 不要声称设置已完成### 4.2 配置 ABCoder MCP 服务器

ABCoder 仅作为二进制文件安装（install-coordinator.sh 未编写 MCP 配置）。
验证二进制文件存在后，将其 MCP 服务器配置写入 `~/.claude.json`。

如果安装了 `abcoder` 二进制文件（`abcoder version` 成功）并且 `mcpServers.abcoder`
尚未在 `~/.claude.json` 中配置：
```bash
ABCODER_AST="${HOME}/.claude/abcoder-ast"
mkdir -p "$ABCODER_AST"
tmp=$(mktemp "${HOME}/.claude/.claude.json.XXXXXX")
jq --arg dir "$ABCODER_AST" \
  '.mcpServers.abcoder = {"command":"abcoder","args":["mcp",$dir]}' \
  "${HOME}/.claude.json" > "$tmp" && chmod 600 "$tmp" && mv "$tmp" "${HOME}/.claude.json"
```
如果已配置（幂等），则跳过。如果 `abcoder` 二进制文件不存在，则静默跳过。

---

## 验证

全部安装完毕后：

1. 重新运行 `detect-tools.sh` — 所有必需的工具应显示为已安装
2. 验证 `~/.claude.json` 包含所有必需的 mcpServers 条目
3. 显示概要：
```
✅ MCP Tools Setup Complete

Installed: Serena, GitNexus, ABCoder, Sequential Thinking, Context7
Skipped (already present): [list]
Optional: Playwright MCP [installed / not installed]

Host readiness:
- dependencies: ready
- mcp config: ready
- tool binaries: ready
- host marker: written (~/.claude/spec-first/host-setup.json)

Next steps:
1. Restart Claude Code (required to load new MCP configuration)
2. Run /spec:bootstrap
```
---

## 错误处理

|场景 |行动|
|----------|--------|
|依赖项缺失且用户拒绝安装 |显示手册说明，退出 |
|单个工具安装失败 |继续使用其他工具，最后报告失败 |
|配置合并失败 |从备份恢复，报告错误 |
| `~/.claude.json` 不存在 |创建初始结构 `{"mcpServers": {}}` |
| jq 不可用 |需要 jq，显示安装说明（jq 是硬依赖项）|

---

## 范围边界

**包括：**
- MCP工具安装和配置（6个工具）
- 安装状态检测和验证
- 用户交互和进度反馈
- macOS/Linux 支持

**不包括：**
- MCP工具卸载
- MCP工具更新/升级
- 自定义MCP工具配置参数
- mcp-tools.json 中没有的工具
- Windows 支持（第 2 阶段）
- 具有单独工具选择的自定义安装模式（第 2 阶段）
- 运行时MCP服务器可用性验证（由项目级探测的spec-bootstrap处理）
