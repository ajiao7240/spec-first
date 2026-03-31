---
title: "feat: Add MCP tools one-click installation skill"
type: feat
status: active
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-mcp-setup-skill-requirements.md
---

# feat: Add MCP tools one-click installation skill

## Overview

创建 `/mcp:setup` skill，安装和配置 MCP 工具链。**实际流程：** `/mcp:setup`（安装+配置） → 重启 Claude Code → `/spec:bootstrap`（ABCoder 自动配置，如需） → 完成。非完全一键完成，但显著减少手动步骤。

## Problem Frame

spec-bootstrap Full mode 依赖 GitNexus、ABCoder、Serena。此外，Sequential Thinking（复杂问题分解）和 Context7（最新框架文档查询）是 spec-first 全工作流的通用依赖。Playwright MCP 为可选工具。用户需要手动安装和配置这些工具，流程繁琐且容易出错。需要一个 skill 简化这个过程。(see origin: docs/brainstorms/2026-04-01-mcp-setup-skill-requirements.md)

**必装工具论证：**
- **Serena** (Full mode 符号级分析) — spec-bootstrap Phase 1.3 Enhanced/Full mode 必需
- **GitNexus** (Full mode 架构级分析) — spec-bootstrap Phase 1.3 Full mode 必需
- **ABCoder** (Full mode 跨语言语义增强) — spec-bootstrap Phase 1.3 Full mode 必需
- **Sequential Thinking** (通用依赖) — spec-first 全工作流复杂问题分解，CLAUDE.md 已配置
- **Context7** (通用依赖) — spec-first 全工作流最新框架文档查询
- **Playwright MCP** (可选) — 前端自动化测试，非 spec-bootstrap 必需

## Requirements Trace

- R1. 提供两种安装模式：快速模式（默认）和自定义模式
- R2. 快速模式：自动安装所有必装工具，最小化用户决策
- R3. 自定义模式：用户可选择要安装哪些工具
- R4. 智能检测前置依赖（Node.js, Go, uv）
- R5. 缺失依赖时提供一键安装命令或详细指引
- R6. 自动安装所有必装工具（快速模式）
- R7. 自动写入配置到 ~/.claude.json
- R8. 自动验证配置是否正确
- R9. 实时显示安装进度
- R10. 缺失依赖时询问是否自动安装
- R11. 安装完成后询问是否安装可选工具
- R12. 单个工具失败时提供重试选项
- R13. 显示具体错误和解决建议
- R14. 检测已安装的工具，仅安装缺失的
- R15. 跳过已存在的配置
- R16. 支持断点续装
- R17. 安装阶段只安装 ABCoder 二进制
- R18. spec-bootstrap 启动时检测 ABCoder 配置
- R19. 未配置时自动为当前项目生成 AST
- R20. 自动写入 AST 路径到配置文件

## Scope Boundaries

**包含：**
- MCP 工具安装和配置（6个工具）
- 安装状态检测和验证
- 用户交互和进度反馈
- 跨平台支持（macOS/Linux/Windows）

**不包含：**
- MCP 工具的卸载功能
- MCP 工具的更新/升级功能
- 自定义 MCP 工具配置参数
- 非列表中的其他 MCP 工具


## Context & Research

### Relevant Code and Patterns

- `skills/spec-bootstrap/SKILL.md` - 多阶段编排模式，worker subagent 调度
- `skills/rclone/scripts/check_setup.sh` - 工具检测脚本模式
- `.claude-plugin/plugin.json` - 命令注册和 skill 映射
- Skill YAML frontmatter 标准格式

### Institutional Learnings

- **MCP MySQL 连接一致性校验逻辑缺陷** (docs/solutions/logic-errors/mcp-mysql-hostname-validation-logic-flaw-2026-04-01.md)
  - 验证逻辑身份而非基础设施细节
  - 提供明确的降级路径
  - 跨环境测试（Docker/本地/云）

### External References

- MCP 工具官方仓库：
  - Serena: https://github.com/oraios/serena
  - GitNexus: https://github.com/nxpatterns/gitnexus
  - ABCoder: https://github.com/cloudwego/abcoder
  - Sequential Thinking: https://github.com/modelcontextprotocol/servers
  - Context7: https://github.com/upstash/context7
  - Playwright MCP: https://github.com/microsoft/playwright-mcp

## Key Technical Decisions

- **配置驱动架构**: 使用 `mcp-tools.json` 集中管理工具元数据，新增工具只需修改配置文件
  - Rationale: 提高扩展性，避免硬编码工具列表
  
- **分层设计**: 配置层 → 编排层 (SKILL.md) → 执行层 (install-coordinator.sh)
  - Rationale: 职责分离，便于维护和测试
  
- **ABCoder 延迟配置**: 安装时只装二进制，spec-bootstrap 时自动配置 AST
  - Rationale: AST 生成需要项目上下文，安装阶段无法确定目标项目
  
- **配置文件位置**: 统一使用 `~/.claude.json` (用户级)
  - Rationale: 与 Claude Code 官方文档一致，避免路径混淆
  
- **跨平台脚本**: bash (macOS/Linux) + PowerShell (Windows)
  - Rationale: 使用各平台原生脚本语言，避免跨平台兼容性问题


## Open Questions

### Resolved During Planning

- **Q: 如何处理 ABCoder 的 AST 配置？**
  - Resolution: 安装时只装二进制，spec-bootstrap 启动时检测并自动配置

- **Q: 配置文件合并策略？**
  - Resolution: 增量合并，使用 jq 读取现有配置，仅添加缺失的工具配置

- **Q: Windows 支持方式？**
  - Resolution: 提供独立的 PowerShell 脚本，SKILL.md 根据 OS 选择对应脚本

### Resolved During Planning (continued)

- **Q: R10 缺失依赖是否自动安装？**
  - Resolution: 分层策略 — uv 为 safe_auto（直接询问并安装），Node.js/Go 为 gated_auto（询问时附带风险提示）
  - uv 官方脚本无需 sudo、安装到用户目录，风险可控
  - Node.js/Go 可能与系统版本冲突或需要 PATH 配置，需用户确认

### Resolved During Review (2026-04-01)

- **Serena 入口点**: 已验证可用配置为 `uvx --from git+https://github.com/oraios/serena serena-mcp-server --context ide-assistant`（非 `serena start-mcp-server`）。mcp-tools.json 须使用此配置。
- **jq 是硬依赖**: 所有配置操作使用 jq。check-deps.sh 须检测 jq 并提供安装指引。Risks 表已更新。
- **并发安全**: ~/.claude.json 写入需 flock 或等效机制防止多会话竞争写入。已加入 Unit 3 Approach。
- **credential protection**: 备份文件 chmod 600，进度输出不显示配置内容。
- **abcoder parse 输出路径**: abcoder parse 输出文件到目录，mcp config args 指向目录。Unit 5 已修正。
- **Unit 3+5 合并**: 配置合并逻辑合并到 Unit 3，消除重复。Unit 编号重新排列： 1→2→3→4(原6)→5(原7)
- **Go PATH 问题**: Go 安装到 ~/.local/go 后需立即 export PATH，否则后续 go install 命令失败。已修复 Unit 2 auto-install 命令。

- **fnm PATH 问题**: fnm install 后需 source 环境变量才能在当前 session 使用。已修复 Unit 2 auto-install 命令。

- **Go 版本硬编码**: go1.23.6 会过时。改为从 go.dev/dl API 获取最新稳定版。

- **备份策略**: 使用时间戳备份（非静态文件名），保留最近 N 个备份供审计。

### Deferred to Implementation

- **Node.js/Go 自动安装的具体命令**: Windows 平台的安装路径和命令需实际测试，建议优先支持 fnm（Node.js）和用户目录安装（Go）
- **配置验证的超时时间**: 需要实际测试各工具的启动时间后确定合理的超时值
- **错误消息的中英文支持**: 当前优先中文，后续可根据用户反馈添加国际化支持


## Implementation Units

- [ ] **Unit 1: 创建 Skill 基础结构和配置文件**

**Goal:** 建立 mcp-setup skill 的目录结构、SKILL.md 文档和工具配置文件

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Create: `skills/mcp-setup/SKILL.md`
- Create: `skills/mcp-setup/mcp-tools.json`
- Create: `templates/claude/commands/spec/mcp-setup.md`
- Modify: `.claude-plugin/plugin.json`

**Approach:**
- SKILL.md 包含 YAML frontmatter 和 workflow 定义
- mcp-tools.json 定义 6 个工具的元数据（id, name, category, mcp_config, dependencies, detect）
- 在 plugin.json 中注册 `/mcp:setup` 命令

**Patterns to follow:**
- `skills/spec-bootstrap/SKILL.md` - YAML frontmatter 格式
- `.claude-plugin/plugin.json` - commands 数组结构

**Test scenarios:**
- Happy path: 创建的文件符合 YAML 和 JSON schema
- Edge case: plugin.json 已有其他命令，正确追加新命令
- Verification: 运行 `jq . skills/mcp-setup/mcp-tools.json` 验证 JSON 格式

**Verification:**
- `skills/mcp-setup/SKILL.md` 存在且包含有效的 YAML frontmatter
- `mcp-tools.json` 包含 6 个工具的完整配置
- plugin.json 中存在 mcp-setup 命令映射


- [ ] **Unit 2: 实现依赖检测和工具状态检测**

**Goal:** 检测前置依赖（Node.js, Go, uv）和已安装的 MCP 工具状态

**Requirements:** R4, R5, R10, R14

**Dependencies:** Unit 1

**Files:**
- Create: `skills/mcp-setup/scripts/check-deps.sh`
- Create: `skills/mcp-setup/scripts/detect-tools.sh`
- Modify: `skills/mcp-setup/SKILL.md` (Phase 1: 依赖检测 + 自动安装交互)

**Approach:**
- check-deps.sh 检测 node, go, uv 版本，返回 JSON 格式状态
  - 输出增加 `install_suggestion` 字段：包含自动安装命令和安全等级
  - 安全等级: `safe_auto`(uv) / `gated_auto`(node, go)
- detect-tools.sh 读取 ~/.claude.json，检查 mcpServers 配置
- 使用 `command -v` 检测工具存在性
- 使用 `jq` 解析 JSON 配置文件
- SKILL.md Phase 1 交互逻辑：
  1. 调用 check-deps.sh 获取依赖状态
  2. 缺失依赖时使用 AskUserQuestion 询问是否自动安装
  3. 按安全等级区分询问方式：
     - **uv** (`safe_auto`): "uv 未安装，是否自动安装？[Y/n]" — 直接执行官方安装脚本
     - **Node.js** (`gated_auto`): "Node.js 未安装，建议通过 fnm 安装。是否自动执行？[Y/n]" — 提示可能冲突
     - **Go** (`gated_auto`): "Go 未安装，建议下载到用户目录。是否自动执行？[Y/n]" — 提示需要配置 PATH
  4. 用户拒绝时降级为显示安装指引（R5）

**Auto-install commands:**
- uv: `curl -LsSf https://astral.sh/uv/install.sh | sh` (无需 sudo，安装到 ~/.cargo/bin/)
- Node.js via fnm: `curl -fsSL https://fnm.vercel.app/install | bash && export FNM_PATH="$HOME/.fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm install --lts`
- Go: `curl -sL https://go.dev/dl/go1.23.6.$(uname -s | tr A-Z a-z)-$(uname -m).tar.gz | tar -C $HOME/.local -xz` + PATH 配置提示

**Patterns to follow:**
- `skills/rclone/scripts/check_setup.sh` - 工具检测模式

**Test scenarios:**
- Happy path: 所有依赖已安装，返回版本号
- Edge case: ~/.claude.json 不存在，返回空配置
- Error path: 依赖缺失，返回安装指引
- R10 path: 依赖缺失，SKILL 询问用户，用户确认自动安装
- R10 decline: 用户拒绝自动安装，显示手动安装指引
- Integration: SKILL.md 调用脚本并解析 JSON 输出，执行自动安装

**Verification:**
- 脚本返回有效的 JSON 格式（含 install_suggestion 字段）
- 正确识别已安装和未安装的工具
- 缺失依赖时提供正确的安装指引
- uv 自动安装成功（safe_auto 路径）
- Node.js/Go 自动安装时显示风险提示（gated_auto 路径）
- 用户拒绝时正确降级为手动指引


- [ ] **Unit 3: 实现快速安装 + 配置合并**

**Goal:** 实现一键安装所有必装工具，并安全地将配置合并到 ~/.claude.json

**Requirements:** R2, R6, R7, R8, R9, R15, R16

**Dependencies:** Unit 2

**Files:**
- Create: `skills/mcp-setup/scripts/install-coordinator.sh`
- Modify: `skills/mcp-setup/SKILL.md` (Phase 2: 快速安装)

**Approach:**
- 读取 mcp-tools.json，过滤 category="required" 的工具
- 逐个安装：有 install_command 则执行，有 mcp_config 则写入配置
- 实时输出进度（⏳ → ✅ / ❌）
- **配置合并（原 Unit 5 逻辑合并至此）：**
  - 备份 ~/.claude.json 到 ~/.claude.json.backup.<timestamp>（时间戳备份，防止多次运行覆盖原始配置）
  - 写入前检测 ~/.claude.json 是否存在，不存在则创建 `{"mcpServers": {}}`
  - 使用 jq 增量合并：仅添加缺失的 mcpServers 条目（跳过已存在的配置）
  - 原子写入：写临时文件 → jq 验证 → mv 原子替换（POSIX atomic）
  - **并发安全：** 使用 flock（Linux/macOS）防止多个 Claude Code 会话同时写入 ~/.claude.json。flock 不可用时降级为检测备份时间戳警告
  - 成功后保留最近 N 个备份（非删除），供审计用

**Patterns to follow:**
- spec-bootstrap 的备份恢复策略
- POSIX 原子 mv 操作

**Test scenarios:**
- Happy path: 所有必装工具安装成功
- Edge case: 部分工具已安装，跳过已存在的
- Error path: 单个工具失败，继续安装其他工具
- Integration: 配置正确写入 ~/.claude.json
- Nil path: ~/.claude.json 不存在，创建初始结构
- Atomic: 写入过程中断，备份可恢复
- Idempotent: 多次运行不重复写入

**Verification:**
- ~/.claude.json 包含 5 个必装工具的配置
- 安装失败的工具有明确错误信息
- 配置文件格式正确（jq 验证）
- 已存在的配置不被覆盖


- [ ] **Unit 4: 实现自定义安装模式** *(Phase 2 — MVP 只需快速模式 + 可选工具询问)* (Phase 2 — 可选，

**Goal:** 实现用户可选择要安装哪些工具的自定义模式

**Requirements:** R3, R11, R12, R13

**Dependencies:** Unit 3

**Files:**
- Modify: `skills/mcp-setup/scripts/install-coordinator.sh` (add --custom flag)
- Modify: `skills/mcp-setup/SKILL.md` (Phase 3: 自定义安装)

**Approach:**
- SKILL.md 使用 AskUserQuestion 展示工具列表（必装 + 可选）
- 用户勾选要安装的工具
- 调用 install-coordinator.sh --install <tool-ids>
- 单个工具失败时询问是否重试

**Patterns to follow:**
- AskUserQuestion multiSelect 模式

**Test scenarios:**
- Happy path: 用户选择部分工具，安装成功
- Edge case: 用户取消所有可选工具，仅安装必装工具
- Error path: 单个工具失败，用户选择重试
- Integration: 重试逻辑正确执行

**Verification:**
- 用户可以自由选择工具组合
- 失败工具有重试选项
- 最终安装结果准确反映用户选择
- [ ] **Unit 6: 集成 ABCoder 配置到 spec-bootstrap**

**Goal:** spec-bootstrap 启动时自动检测并配置 ABCoder AST

**Requirements:** R17, R18, R19, R20

**Dependencies:** Unit 3

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md` (Phase 1.3: ABCoder 配置检测)

**Approach:**
- Phase 1.3 开始时检测 ~/.claude.json 中 mcpServers.abcoder 配置
- 未配置时询问用户是否自动配置
- 检测项目主要语言（扫描文件扩展名）
- 创建目录 ~/.claude/abcoder-ast/（如不存在）
- 执行 abcoder parse <language> . -o ~/.claude/abcoder-ast/<project-name>.json
- 写入配置到 ~/.claude.json： args = ["mcp", "~/.claude/abcoder-ast"]（指向目录，非文件）
- 设置超时 120 秜 大型项目超时降级
- abcoder 不支持的语言（Ruby/Rust/C++等）→ 跳过并提示
- 提示用户重启 Claude Code

**Patterns to follow:**
- spec-bootstrap 的依赖检测模式

**Test scenarios:**
- Happy path: ABCoder 未配置，自动生成 AST 并写入配置
- Edge case: ABCoder 已配置，跳过
- Error path: abcoder 命令不存在，提示安装
- Integration: 配置后 Full mode 可用

**Verification:**
- ABCoder 配置正确写入 ~/.claude.json
- AST 目录存在且包含解析结果
- spec-bootstrap Full mode 可以使用 ABCoder 工具
- 用户收到明确的重启提示


- [ ] **Unit 7: 添加 Windows 支持** *(Phase 2 — MVP 仅支持 macOS/Linux)*

**Goal:** 提供 Windows PowerShell 版本的安装脚本

**Requirements:** R1-R20 (跨平台支持)

**Dependencies:** Unit 5

**Files:**
- Create: `skills/mcp-setup/scripts/install-coordinator.ps1`
- Create: `skills/mcp-setup/scripts/check-deps.ps1`
- Create: `skills/mcp-setup/scripts/detect-tools.ps1`
- Modify: `skills/mcp-setup/SKILL.md` (OS 检测和脚本选择)

**Approach:**
- 将 bash 脚本逻辑移植到 PowerShell
- 处理 Windows 路径差异（`\` vs `/`）
- 使用 `ConvertTo-Json` / `ConvertFrom-Json` 处理 JSON
- ABCoder 命令使用 `abcoder.exe`
- 配置文件路径：`$env:USERPROFILE\.claude.json`

**Patterns to follow:**
- 保持与 bash 版本的功能对等
- 使用 PowerShell 原生 cmdlet

**Test scenarios:**
- Happy path: Windows 环境下完整安装流程
- Edge case: Git for Windows 未安装，提示用户
- Error path: 依赖缺失，给出 Windows 安装指引
- Integration: 配置正确写入 Windows 路径

**Verification:**
- PowerShell 脚本在 Windows 上运行无错误
- 配置文件写入正确的 Windows 路径
- 所有工具在 Windows 上可用
- 错误提示包含 Windows 特定的安装指引


## System-Wide Impact

### Modified Components

| Component | Change Type | Impact |
|-----------|-------------|--------|
| `.claude-plugin/plugin.json` | Add command | New `/mcp:setup` command available |
| `skills/spec-bootstrap/SKILL.md` | Modify Phase 1.3 | ABCoder auto-configuration |
| `~/.claude.json` | Write config | MCP servers registered |

### New Components

| Component | Purpose |
|-----------|---------|
| `skills/mcp-setup/` | MCP 工具安装 skill 目录 |
| `skills/mcp-setup/SKILL.md` | Skill 编排逻辑 |
| `skills/mcp-setup/mcp-tools.json` | 工具元数据配置 |
| `skills/mcp-setup/scripts/install-coordinator.sh` | Unix 安装协调器 |
| `skills/mcp-setup/scripts/install-coordinator.ps1` | Windows 安装协调器 |
| `skills/mcp-setup/scripts/check-deps.sh` | Unix 依赖检测 |
| `skills/mcp-setup/scripts/detect-tools.sh` | Unix 工具状态检测 |
| `templates/claude/commands/spec/mcp-setup.md` | 命令模板 |

### User-Facing Changes

- New command: `/mcp:setup` for one-click MCP tools installation
- spec-bootstrap Full mode becomes accessible after running mcp-setup
- ABCoder configuration happens automatically during spec-bootstrap

### Breaking Changes

None. This is a new feature with no impact on existing workflows.


## Risks & Dependencies

### Critical Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Node.js | 用户未安装 | 检测并提供安装指引 |
| Go | 用户未安装 | 检测并提供安装指引 |
| uv/uvx | 用户未安装 | 检测并提供安装指引 |
| Git for Windows | Windows 必需 | 检测并提示安装 |
| jq | JSON 处理依赖（必需） | check-deps.sh 检测并提示安装（`brew install jq` / `apt install jq`） |

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 配置文件损坏 | Low | High | 安装前备份，失败时恢复 |
| 网络超时 | Medium | Medium | 设置合理超时，提供重试选项 |
| 权限不足 | Low | Medium | 检测权限，提示用户 |
| 跨平台兼容性 | Medium | High | 独立的 Windows 脚本，充分测试 |
| ABCoder AST 生成失败 | Medium | Low | 降级到 Enhanced/Basic 模式 |

### Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| 用户中途取消安装 | 部分工具已安装 | 支持断点续装，幂等性设计 |
| MCP 工具版本更新 | 配置格式变化 | 使用稳定的包管理器（npx, uvx） |
| 多次运行导致配置重复 | 配置文件膨胀 | 检测已存在配置，跳过 |


## Documentation/Operational Notes

### User Documentation

**README updates needed:**
- Add `/mcp:setup` to command reference
- Document quick vs custom install modes
- List supported platforms and prerequisites
- Troubleshooting guide for common installation issues

**Skill documentation:**
- `skills/mcp-setup/README.md` - usage guide, examples, FAQ

### Testing Strategy

**Unit testing:**
- Dependency detection logic (mock command outputs)
- JSON merging logic (various config states)
- Backup/restore mechanism

**Integration testing:**
- Full installation flow on clean system
- Rerun on partially installed system
- Configuration merge with existing tools

**Platform testing:**
- macOS (Intel + Apple Silicon)
- Linux (Ubuntu, Debian, Fedora)
- Windows 10/11

**Smoke test checklist:**
- [ ] `/mcp:setup` command registered and invocable
- [ ] Quick mode installs all 5 required tools
- [ ] Custom mode allows tool selection
- [ ] Configuration correctly written to ~/.claude.json
- [ ] ABCoder auto-configuration works in spec-bootstrap
- [ ] Rerun skips already installed tools
- [ ] Backup/restore works on failure

### Rollout Plan

**Phase 1: Internal testing**
- Test on development machines (all platforms)
- Verify with fresh Claude Code installations

**Phase 2: Documentation**
- Update main README
- Create skill-specific documentation
- Record demo video

**Phase 3: Release**
- Merge to main branch
- Announce in project changelog
- Update spec-bootstrap documentation


## Sources & References

### Internal References

- `docs/brainstorms/2026-04-01-mcp-setup-skill-requirements.md` - Origin requirements document
- `skills/spec-bootstrap/SKILL.md` - Multi-stage orchestration pattern, worker subagent dispatch
- `skills/rclone/scripts/check_setup.sh` - Tool detection script pattern
- `.claude-plugin/plugin.json` - Command registration format
- `docs/solutions/logic-errors/mcp-mysql-hostname-validation-logic-flaw-2026-04-01.md` - Validation logic lessons

### External References

**MCP Tools:**
- Serena: https://github.com/oraios/serena
- GitNexus: https://github.com/nxpatterns/gitnexus
- ABCoder: https://github.com/cloudwego/abcoder
- Sequential Thinking: https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking
- Context7: https://github.com/upstash/context7
- Playwright MCP: https://github.com/microsoft/playwright-mcp

**Dependencies:**
- uv installation: https://docs.astral.sh/uv/getting-started/installation/
- Node.js: https://nodejs.org/
- Go: https://go.dev/doc/install

