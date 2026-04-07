## 整体架构风格

`spec-first` 是一个零运行时依赖的 Node.js CLI 工具，采用 **Plugin Manifest 驱动 + Platform Adapter 模式**。其核心职责是将可安装的 AI workflow 资产（skills、agents、commands）从 npm 包同步到目标项目的平台运行时目录中。

整个工具以单一 manifest 文件（`.claude-plugin/plugin.json`）为事实来源，通过适配器层屏蔽 Claude 与 Codex 两个平台的差异，提供统一的 init / doctor / clean 操作接口。

## 分层策略

```
┌────────────────────────────────────────────────────┐
│  CLI 入口层                                         │
│  bin/spec-first.js  bin/postinstall.js             │
├────────────────────────────────────────────────────┤
│  命令层（Commands）                                 │
│  src/cli/commands/init.js                          │
│  src/cli/commands/doctor.js                        │
│  src/cli/commands/clean.js                         │
├────────────────────────────────────────────────────┤
│  核心业务层                                         │
│  src/cli/plugin.js        资产加载与同步            │
│  src/cli/state.js         增量同步状态机            │
│  src/cli/developer.js     开发者身份解析与写入       │
│  src/cli/lang-policy.js   语言策略幂等注入          │
│  src/cli/changelog.js     CHANGELOG 自举           │
│  src/cli/version-reminder.js  版本提醒              │
├────────────────────────────────────────────────────┤
│  平台适配层（Adapters）                             │
│  src/cli/adapters/base.js      PlatformAdapter 接口 │
│  src/cli/adapters/claude.js    Claude 实现          │
│  src/cli/adapters/codex.js     Codex 实现           │
│  src/cli/adapters/index.js     适配器注册与查询      │
├────────────────────────────────────────────────────┤
│  资产层（可发布，npm 包的一部分）                    │
│  skills/   agents/   templates/                    │
├────────────────────────────────────────────────────┤
│  配置层                                             │
│  .claude-plugin/plugin.json  manifest 单一事实来源  │
├────────────────────────────────────────────────────┤
│  运行时输出层（由 init 生成，不纳入 npm 包）         │
│  .claude/  .codex/  .agents/                       │
└────────────────────────────────────────────────────┘
```

## 关键架构决策

### 1. Plugin Manifest 驱动架构

`.claude-plugin/plugin.json` 是整个工具的单一事实来源。它声明：
- `directories.commands / skills / agents`：三类资产的源目录路径
- `commands[]`：8 个命令的 `name / filename / description / argumentHint / skill` 字段

`plugin.js` 的 `loadPluginManifest()` 在加载时做完整校验（schema 检查），所有资产操作（`syncBundledAssets`、`listBundledSkills`、`listBundledAgents`）都通过它取得路径，形成统一入口。

### 2. Platform Adapter 模式

`src/cli/adapters/base.js` 定义 `PlatformAdapter` 抽象基类，暴露 11 个 property / 方法：

| Property / 方法 | 职责 |
|---|---|
| `id` | 平台标识符 |
| `runtimeRoot` | 运行时根目录 |
| `managedRoot` | spec-first 状态目录 |
| `commandRoot / skillsRoot / agentsRoot` | 各资产目标路径 |
| `hasCommands` | 是否安装 command 入口点（Codex 为 false） |
| `stateFile / developerFile / instructionFile` | 元数据文件路径 |
| `transformSkillContent() / transformAgentContent()` | 平台特定内容转换 |
| `syncRuntimeFiles() / inspectRuntimeFiles()` | 平台特定运行时文件管理 |

`ClaudeAdapter` 与 `CodexAdapter` 分别继承并覆盖上述接口，确保命令层代码无需感知平台差异。

### 3. Canonical Agent Name 重写

资产源文件中使用 `spec-first:category:name` 格式（如 `spec-first:review:code-reviewer`）引用 agent，保证跨平台名称唯一性。

- `ClaudeAdapter.transformSkillContent()`：调用 `rewriteCanonicalAgentNamesForSkills()`，将 canonical 格式重写为 bare name（`code-reviewer`）
- `CodexAdapter.transformSkillContent()`：调用 `transformCodexContent()`，将 `Task spec-first:category:name(...)` 转换为 `Read .codex/agents/category/name.md and apply that agent profile` 的 Read 模式

### 4. 增量同步状态机

`state.js` 维护 `state.json`（位于 `adapter.stateFile`，Claude 为 `.claude/spec-first/state.json`），记录上次同步的 `commands / skills / agents` 列表及 `manifestVersion`。

`init` 执行流程：
1. `readState()` 读取 `previousState`
2. `buildState()` 预构建 `previewState`
3. `removeObsoleteManagedAssets(previousState, previewState)` 删除已废弃的资产
4. `syncBundledAssets()` 执行实际同步
5. `writeState()` 写入新的 `nextState`

### 5. 幂等 lang-policy 注入

`lang-policy.js` 的 `writeLangPolicy()` 通过 HTML 注释标记 `<!-- spec-first:lang:start -->` / `<!-- spec-first:lang:end -->` 在 instruction file（`CLAUDE.md` 或 `AGENTS.md`）中实现幂等写入，处理三种状态：文件不存在、无标记、有标记。写入使用 `tmp → rename` 原子操作，避免中途写坏文件。

### 6. 零运行时依赖

`package.json` 无 `dependencies` 字段，仅使用 Node.js built-in 模块（`node:fs`、`node:path`、`node:os`、`node:child_process`）。这确保 CLI 在任何 Node.js 环境下可直接运行，无需 `npm install`。

## 系统边界

spec-first 工具本身只处理**文件系统读写**和少量**进程调用**（git / claude / codex CLI）。它不提供 HTTP 服务，不连接数据库，不持有长期运行进程。其所有"效果"体现在用户项目目录中生成的 runtime 文件上。外部网络调用仅有一处：`version-reminder.js` 向 npm registry 发起非阻塞版本查询（350ms 超时，失败静默）。
