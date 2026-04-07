# spec-first 项目概览

> 版本：v1.5.1 | 语言：JavaScript (CommonJS) | 类型：npm CLI tool + AI workflow asset package

---

## 技术栈

- **运行时：** Node.js（无框架，纯原生 CommonJS 模块）
- **包管理：** npm，无第三方 `dependencies`（`package.json` 无 `dependencies` 字段）
- **测试：** Bash shell 脚本（`tests/smoke/cli.sh`、`tests/unit/mcp-setup.sh`）
- **分发：** npm package，通过 `bin/spec-first.js` 注册 CLI 入口
- **目标平台：** Claude（`.claude/`）和 Codex（`.codex/`）两种 AI workflow 平台

---

## 顶层结构

```
spec-first/
├── bin/
│   ├── spec-first.js          # CLI 入口，透传 argv 给 src/cli/index.js
│   └── postinstall.js         # npm postinstall 钩子
├── src/cli/
│   ├── index.js               # runCli()：命令分发器（init/doctor/clean）
│   ├── plugin.js              # syncBundledAssets()：核心资产复制逻辑
│   ├── developer.js           # resolveDeveloperIdentity()：开发者身份解析
│   ├── state.js               # 增量同步状态管理，读写 state.json
│   ├── lang-policy.js         # 幂等语言策略注入（HTML 注释标记边界）
│   ├── version-reminder.js    # npm registry 异步版本检查（350ms 超时）
│   ├── changelog.js           # CHANGELOG.md 初始化工具
│   ├── commands/              # init.js / doctor.js / clean.js
│   └── adapters/              # base.js / claude.js / codex.js / index.js
├── skills/                    # 42 个 skill 目录，每个含 SKILL.md
├── agents/                    # 46 个 agent .md 文件，分 6 类
├── templates/claude/commands/spec/  # 8 个 command 模板
└── .claude-plugin/plugin.json       # manifest：声明 commands/skills/agents 目录映射
```

---

## 核心命令

### `spec-first init`

入口：`src/cli/commands/init.js`

将 skills、agents、commands 等 workflow 资产从包内目录同步到用户项目的 `.claude/` 或 `.codex/` 目录。核心数据流见下方「资产同步流程」章节。

主要选项：
- `--claude`：同步到 `.claude/`，使用 `ClaudeAdapter`
- `--codex`：同步到 `.codex/`，使用 `CodexAdapter`

### `spec-first doctor`

入口：`src/cli/commands/doctor.js`

对运行时资产执行两阶段完整性检查：
1. `inspectInstalledAssets()`：检查资产是否已正确安装、文件是否存在
2. `inspectRuntimeFiles()`：扫描运行时文件，检测是否残留未重写的 canonical agent 名称（形如 `spec-first:category:name`）

### `spec-first clean`

入口：`src/cli/commands/clean.js`

通过读取 `.claude/spec-first/state.json` 确定由本工具管理的资产列表，精确删除对应文件。无硬编码路径，完全依赖 state 文件驱动，避免误删用户文件。

---

## 关键模块职责

### `src/cli/plugin.js` — 资产同步核心

`syncBundledAssets()` 是整个 init 流程的中枢，依次调用：
- `syncCommands()`：复制 `templates/claude/commands/spec/` 下的 command 模板
- `syncSkills()`：整目录复制 `skills/` 下的每个 skill（含 `SKILL.md`）
- `syncAgents()`：复制 `agents/` 下各分类的 agent `.md` 文件

同时负责加载 `.claude-plugin/plugin.json` manifest，读取 `commands`、`skills`、`agents` 的目录映射配置。

### `src/cli/developer.js` — 开发者身份

`resolveDeveloperIdentity()` 按优先级合并身份信息：
1. CLI 参数（最高优先级）
2. 全局 `~/.developer` 文件
3. `git config user.name / user.email`（兜底）

解析结果写入项目 `.claude/spec-first/.developer`，记录 `lang`、`initialized_at` 等字段。

### `src/cli/state.js` — 增量同步状态

读写 `.claude/spec-first/state.json`，记录当前已管理的 `commands`、`skills`、`agents` 列表。init 时通过对比 `previousState` 与 `nextState` 识别废弃资产并自动删除，实现增量同步而非全量覆盖。

### `src/cli/lang-policy.js` — 语言策略注入

幂等地将语言/治理策略块注入 `CLAUDE.md` 或 `AGENTS.md`。使用 `<!-- spec-first:lang:start -->` / `<!-- spec-first:lang:end -->` HTML 注释标记边界，重复执行只替换标记区间内容，不依赖行号，不产生重复写入。

### `src/cli/version-reminder.js` — 版本提示

异步调用 `https://registry.npmjs.org/{pkg}/latest` 检查最新版本，设置 350ms 超时，不阻塞主流程。若检测到新版本则在命令完成后输出提示。

---

## Platform Adapter 模式

适配器位于 `src/cli/adapters/`，通过 `getAdapter()` 工厂函数（`adapters/index.js`）按平台选择实例。

### 共同基类

`adapters/base.js` 定义 `PlatformAdapter` 基类，声明资产写入接口的通用契约。

### ClaudeAdapter（`adapters/claude.js`）

- 目标目录：`.claude/`
- Commands：写入 `.claude/commands/spec/`
- Skills：写入 `.claude/skills/<skill-name>/`
- Agents：写入 `.claude/agents/<category>/`
- **关键差异**：调用 `rewriteCanonicalAgentNamesForSkills()`，将 `SKILL.md` 中的 `spec-first:category:name` 格式引用重写为 bare name（即仅保留 `name`），符合 Claude 平台约定

### CodexAdapter（`adapters/codex.js`）

- 目标目录：`.codex/`
- Commands：`hasCommands = false`，不写入 commands
- Skills：写入 `.agents/skills/<skill-name>/`（注意路径与 Claude 不同）
- Agents：写入 `.codex/agents/<category>/`
- **关键差异**：保留完整 canonical 名称格式 `spec-first:category:name`，Codex 平台通过完整路径保证 agent 名称唯一性

---

## 资产同步流程（init 命令核心数据流）

```
spec-first init --claude
       │
       ▼
  读取 .claude-plugin/plugin.json     ← manifest，含目录映射
       │
       ▼
  resolveDeveloperIdentity()          ← developer.js，合并身份信息
       │
       ▼
  syncBundledAssets()                 ← plugin.js，核心复制函数
  ├── syncCommands()
  ├── syncSkills()
  └── syncAgents()
       │（ClaudeAdapter）
       ▼
  rewriteCanonicalAgentNamesForSkills()  ← adapters/claude.js，名称重写
       │
       ▼
  state.json 写入 nextState            ← state.js，删除废弃资产
       │
       ▼
  lang-policy.js 注入语言策略          ← 幂等写入 CLAUDE.md
       │
       ▼
  changelog.js 初始化 CHANGELOG.md
```

---

## 已知限制

- **无数据库**：所有状态持久化依赖文件系统，核心状态文件为 `.claude/spec-first/state.json`；无法做跨机器状态同步
- **纯文件系统操作**：资产管理完全基于文件复制/删除，无事务保证；若 init 过程中断可能导致部分写入状态
- **Bash 测试**：测试套件为 shell 脚本（`tests/smoke/cli.sh`、`tests/unit/mcp-setup.sh`），无 JavaScript 单元测试框架，无法做细粒度的模块级 mock
- **零第三方依赖**：`package.json` 无 `dependencies` 字段，所有能力依赖 Node.js 原生 API，功能扩展受限于标准库能力
- **单进程无并发**：资产同步为顺序执行，无并发写入；大量资产时性能依赖文件系统 I/O
- **版本检查弱保障**：`version-reminder.js` 仅有 350ms 超时保障，网络异常时静默失败，不影响主流程但用户无法感知检查结果
