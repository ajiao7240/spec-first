## 源码层

| 目录 / 文件 | 层级 | 职责 |
|---|---|---|
| `bin/` | CLI 入口层 | 包含两个可执行文件：`spec-first.js`（CLI 主入口，解析顶层子命令 init / doctor / clean，调用 `version-reminder` 显示升级提示）；`postinstall.js`（npm 安装后钩子，全局安装时运行） |
| `src/cli/commands/init.js` | 命令层 | 实现 `spec-first init --claude/--codex` 命令；完整的增量同步流程：读旧状态 → 解析开发者身份 → 删废弃资产 → 同步资产 → 写新状态 → 注入 lang policy → 自举 changelog |
| `src/cli/commands/doctor.js` | 命令层 | 实现 `spec-first doctor` 命令；检查 Node.js 版本、git 可用性、plugin manifest 完整性、平台 CLI 可用性、已安装资产完整性，以及 Claude 运行时中 canonical 名称残留问题 |
| `src/cli/commands/clean.js` | 命令层 | 实现 `spec-first clean` 命令；读取 state.json，删除所有已管理的资产文件，清理空父目录 |
| `src/cli/plugin.js` | 核心业务层 | Plugin manifest 加载与验证（`loadPluginManifest`、`validateManifest`）；资产枚举（`listBundledCommands`、`listBundledSkills`、`listBundledAgents`）；资产同步（`syncBundledAssets`、`syncSkills`、`syncAgents`、`syncCommands`）；资产检查（`inspectInstalledAssets`）；所有路径由 manifest `directories` 字段驱动 |
| `src/cli/adapters/base.js` | 平台适配层 | 定义 `PlatformAdapter` 抽象基类，声明 11 个 property / 方法接口；子类须实现 `id`、`runtimeRoot`、`commandRoot`、`skillsRoot`、`agentsRoot`、`stateFile`、`developerFile`、`instructionFile`、`transformSkillContent()`、`transformAgentContent()`、`inspect()` |
| `src/cli/adapters/claude.js` | 平台适配层 | `ClaudeAdapter` 实现：runtime root `.claude/`；`hasCommands=true`；`transformSkillContent()` 通过 `rewriteCanonicalAgentNamesForSkills()` 将 canonical 格式重写为 bare name；`inspectRuntimeFiles()` 扫描 canonical 名称残留和未解析 Task 引用 |
| `src/cli/adapters/codex.js` | 平台适配层 | `CodexAdapter` 实现：runtime root `.codex/`，skills 位于 `.agents/skills/`；`hasCommands=false`；`transformSkillContent()` 通过 `transformCodexContent()` 将 Task 调用转为 Read 模式；`syncRuntimeFiles()` 清理 5 个 legacy 目录（`legacyCommandRoot`、`legacyCodexSkillsRoot`、`legacyMarketplaceRoot`、`legacyPluginRoot`、`legacyPluginRootAlt`） |
| `src/cli/adapters/index.js` | 平台适配层 | 适配器注册表，`getAdapter(platform)` 返回对应实例，`getSupportedPlatforms()` 返回已知平台列表 |
| `src/cli/state.js` | 核心业务层 | 读写 `state.json`（`readState`、`writeState`、`buildState`）；增量同步核心：`removeObsoleteManagedAssets()` 对比 previous / next state 删除废弃资产；`pruneCommandNamespace()` 清理不在白名单的 command 文件；`removeManagedAssets()` 全量清理（clean 命令用） |
| `src/cli/developer.js` | 核心业务层 | 开发者身份解析（`resolveDeveloperIdentity`）：优先级为 CLI 参数 → 全局 `~/.spec-first/.developer` → `git config user.name`；读写 `.developer` 文件；lang 支持 `zh` / `en` 两种值 |
| `src/cli/lang-policy.js` | 核心业务层 | 幂等向 instruction file（`CLAUDE.md` / `AGENTS.md`）注入语言与治理策略块；由 `<!-- spec-first:lang:start -->` / `<!-- spec-first:lang:end -->` 标记管理；`buildManagedBlock()` 按 lang 生成中文或英文策略文本 |
| `src/cli/changelog.js` | 核心业务层 | `bootstrapChangelog()`：当项目根不存在 `CHANGELOG.md` 时自动创建初始版本，否则跳过（幂等） |
| `src/cli/version-reminder.js` | 核心业务层 | `maybeShowVersionReminder()`：向 npm registry 发起非阻塞版本查询（默认 350ms 超时），若有新版本则向 stderr 输出升级提示；比较逻辑由 `compareVersions()` 实现，支持 semver prerelease |

## 资产层

资产层是 npm 包的一部分，在 `npm publish` 时与源码一同发布。

| 目录 | 职责 |
|---|---|
| `skills/` | 42 个以上可安装 skill 目录，每个目录名即 skill 名，入口文件为 `SKILL.md`；init 时由 `plugin.js:syncSkills()` 整目录复制到目标平台 skills root，复制前用 `rmSync(targetDir, { recursive: true })` 清理旧版本 |
| `agents/` | 46 个 agent `.md` 文件，按分类子目录组织（`research/`、`design/`、`document-review/`、`docs/`、`review/`、`workflow/`）；init 时由 `syncAgents()` 平铺复制到目标平台 agents root |
| `templates/` | Claude 平台 command 模板文件，路径为 `templates/claude/commands/spec/`；manifest `directories.commands` 指向此目录；每个 `.md` 文件对应一个 slash command |

## 运行时输出层（不是源码）

运行时输出层由 `spec-first init` 命令生成，不纳入 npm 包，通常添加到目标项目的 `.gitignore`。

| 目录 | 归属平台 | 职责 |
|---|---|---|
| `.claude/` | Claude | Claude Code runtime root；包含 `commands/spec/`（8 个命令 md）、`skills/`（复制的 skill 目录）、`agents/`（复制的 agent md）、`spec-first/`（`state.json` + `.developer`） |
| `.codex/` | Codex | Codex runtime root；包含 `agents/`（复制的 agent md）、`spec-first/`（`state.json` + `.developer`） |
| `.agents/` | Codex | Codex skills 存放位置（`skills/` 子目录），与 `.codex/` 分离，遵循 Trellis 模型约定 |

## 配置层

| 文件 | 职责 |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest 单一事实来源；`schemaVersion`、`directories`（commands / skills / agents 路径）、`commands[]`（8 条命令定义）；由 `plugin.js:loadPluginManifest()` 加载并校验 |
| `package.json` | npm 包元数据；无 `dependencies` 字段（零运行时依赖）；`bin.spec-first` 指向 `bin/spec-first.js` |

## 测试层

| 目录 / 文件 | 职责 |
|---|---|
| `tests/unit/` | 单元测试 bash 脚本；`lang-policy.sh` 验证语言策略注入逻辑，`mcp-setup.sh` 验证 mcp-setup skill 配置 |
| `tests/smoke/` | 冒烟测试；`cli.sh` 验证 CLI 帮助、init、生成资产、doctor 等核心路径 |
| `tests/integration/` | 端到端集成测试；验证完整 init → doctor 流程 |
