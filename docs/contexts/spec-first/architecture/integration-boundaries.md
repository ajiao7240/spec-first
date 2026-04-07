## 外部服务依赖

### npm Registry

- **触发模块：** `src/cli/version-reminder.js` → `defaultLookupLatestVersion()`
- **协议：** HTTPS GET
- **URL 模式：** `https://registry.npmjs.org/{encodeURIComponent(packageName)}/latest`
- **超时：** 默认 350ms（可由调用方通过 `timeoutMs` 覆盖）；超时由 `AbortController` 控制
- **响应字段：** `payload.version`（string）
- **失败策略：** 静默忽略（网络错误、超时、非 2xx 响应均返回空字符串，不影响主流程）
- **环境变量覆盖：** `SPEC_FIRST_VERSION_REMINDER_LATEST`（用于测试/离线场景替代真实 registry 调用）
- **调用时机：** 每次 CLI 命令执行完毕后异步触发，不阻塞命令执行结果

## CLI 工具依赖

### git CLI

- **触发模块：** `src/cli/developer.js` → `readGitUserName()`
- **调用方式：** `spawnSync('git', ['config', 'user.name'], { cwd: projectRoot, encoding: 'utf8' })`
- **用途：** 解析开发者身份名称的最后兜底来源（优先级低于 CLI 参数 `-u/--user` 和全局 `~/.spec-first/.developer`）
- **失败策略：** 若 `result.status !== 0` 则返回空字符串；调用方 `resolveDeveloperIdentity()` 若最终名称为空则抛出用户可见错误
- **调用时机：** `spec-first init` 命令中解析开发者身份时

- **触发模块：** `src/cli/commands/doctor.js` → `checkGit()`
- **调用方式：** `spawnSync('git', ['--version'])` 检查 git 可用性
- **用途：** doctor 诊断中验证 git 是否安装
- **失败策略：** 返回 `{ level: 'ERROR', name: 'git', message: 'not found', fix: '...' }` 诊断项

### claude CLI

- **触发模块：** `src/cli/commands/doctor.js` → `checkPlatformCli('claude')`
- **调用方式：** `spawnSync('claude', ['--version'])`
- **用途：** doctor 诊断中验证 Claude Code CLI 是否安装
- **失败策略：** 返回 `{ level: 'WARN' }` 或 `{ level: 'INFO' }` 诊断项，不阻断其他检查
- **调用时机：** 仅在 `spec-first doctor [--claude]` 时触发

### codex CLI

- **触发模块：** `src/cli/commands/doctor.js` → `checkPlatformCli('codex')`
- **调用方式：** `spawnSync('codex', ['--version'])`
- **用途：** doctor 诊断中验证 Codex CLI 是否安装
- **失败策略：** 与 claude CLI 相同，返回诊断项，不阻断流程
- **调用时机：** 仅在 `spec-first doctor [--codex]` 时触发

## 文件系统边界

所有文件操作均通过 `node:fs` 模块完成，不依赖任何第三方文件操作库。

### 读操作

| 路径 | 模块 | 内容 |
|---|---|---|
| `.claude-plugin/plugin.json` | `plugin.js:loadPluginManifest()` | Plugin manifest，每次命令执行都重新读取 |
| `skills/<name>/` | `plugin.js:listBundledSkills()` | 枚举 skill 目录名 |
| `agents/**/*.md` | `plugin.js:listBundledAgents()` | 递归枚举 agent 路径 |
| `templates/claude/commands/spec/*.md` | `plugin.js:readBundledCommandTemplate()` | 读取 command 模板内容 |
| `adapter.stateFile`（如 `.claude/spec-first/state.json`） | `state.js:readState()` | 读取上次同步状态 |
| `adapter.developerFile` / `~/.spec-first/.developer` | `developer.js:readDeveloperFile()` | 读取开发者 identity |
| `adapter.instructionFile`（`CLAUDE.md` / `AGENTS.md`） | `lang-policy.js:writeLangPolicy()` | 读取现有内容以做幂等合并 |
| `package.json` | `developer.js` 顶层 `require` | 读取当前版本号 |

### 写操作

| 路径 | 模块 | 内容 |
|---|---|---|
| `adapter.commandRoot/`（如 `.claude/commands/spec/`） | `plugin.js:syncCommands()` | 写入经 `transformSkillContent()` 转换的 command md 文件 |
| `adapter.skillsRoot/<name>/` | `plugin.js:syncSkills()` | 先 `rmSync` 清理旧目录，再递归复制转换后的 skill 文件 |
| `adapter.agentsRoot/<path>` | `plugin.js:syncAgents()` | 写入经 `transformAgentContent()` 转换的 agent md 文件 |
| `adapter.stateFile` | `state.js:writeState()` | 写入增量同步后的新状态（JSON，2 空格缩进） |
| `adapter.developerFile` | `developer.js:writeDeveloperFile()` | 写入 `name / lang / initialized_at / version` 键值对文本 |
| `adapter.instructionFile` | `lang-policy.js:writeLangPolicy()` | 原子写入（先写 `.tmp` 再 `renameSync`）语言策略块 |
| `CHANGELOG.md` | `changelog.js:bootstrapChangelog()` | 仅在文件不存在时创建；已存在则跳过 |

### 删除操作

- `state.js:removeObsoleteManagedAssets()`：对比 previous / next state，使用 `fs.rmSync` 删除废弃的 command 文件、skill 目录、agent 文件
- `state.js:removeEmptyParents()`：删除空父目录（向上递归至 projectRoot 为止）
- `plugin.js:syncSkills()`：每个 skill 同步前先 `fs.rmSync(targetDir, { recursive: true, force: true })` 清理旧目录，确保移除目录内已删除的文件

## 平台运行时边界

### Claude 平台边界

Claude 平台的运行时目录与源码共存于同一 git 仓库（用户项目）。

| 边界接口 | 路径 | 协议 |
|---|---|---|
| Slash commands | `.claude/commands/spec/*.md` | Claude Code 读取 `commands/` 下 `.md` 文件作为 `/spec:*` 命令 |
| Skills | `.claude/skills/<name>/SKILL.md` | Claude Code skill 发现机制，通过 `SKILL.md` 入口加载 |
| Agents | `.claude/agents/**/*.md` | Claude Code agent 注册，`name:` front-matter 字段确定 bare name |
| Managed state | `.claude/spec-first/state.json` | spec-first 私有状态，对 Claude Code 透明 |
| Instruction file | `CLAUDE.md` | Claude Code 启动时读取，语言策略通过 `<!-- spec-first:lang:* -->` 标记嵌入 |

Claude adapter 的 `inspectRuntimeFiles()` 会扫描 `.claude/skills/` 和 `.claude/agents/` 下所有 `.md` 文件，检测是否存在未重写的 canonical 名称（`spec-first:[a-z-]+:[a-z-]+` 正则）和未解析的 Task agent 引用。

### Codex 平台边界

Codex 平台不使用 slash commands；skills 通过 skill discovery 机制加载，agents 通过 Read 引用访问。

| 边界接口 | 路径 | 协议 |
|---|---|---|
| Skills | `.agents/skills/<name>/SKILL.md` | Codex skill discovery 机制 |
| Agents | `.codex/agents/<category>/<name>.md` | 通过 `Read .codex/agents/...` 指令应用 agent profile |
| Managed state | `.codex/spec-first/state.json` | spec-first 私有状态，对 Codex 透明 |
| Instruction file | `AGENTS.md` | Codex 启动时读取，语言策略嵌入方式与 Claude 相同 |

Codex adapter 的 `syncRuntimeFiles()` 在每次 init 时清理 5 个 legacy 目录，防止旧版本残留干扰新版结构：`legacyCommandRoot`（`.codex/commands/spec`）、`legacyCodexSkillsRoot`（`.codex/skills`）、`legacyMarketplaceRoot`（`.agents/plugins`）、`legacyPluginRoot`（`plugins/spec`）、`legacyPluginRootAlt`（`plugins/spec-first`）。

### 模块间主要接口

| 调用方 | 被调用方 | 接口 | 数据 |
|---|---|---|---|
| `commands/init.js` | `plugin.js` | `syncBundledAssets(projectRoot, adapter)` | 返回 `{ commands, skills, agents }` |
| `commands/init.js` | `state.js` | `readState / removeObsoleteManagedAssets / writeState` | state JSON 对象 |
| `commands/init.js` | `developer.js` | `resolveDeveloperIdentity / writeDeveloperFile` | developer 对象（name / lang / initializedAt / version） |
| `commands/init.js` | `lang-policy.js` | `writeLangPolicy(projectRoot, developer, adapter)` | 副作用：写 CLAUDE.md / AGENTS.md |
| `plugin.js` | `adapters/*` | `adapter.transformSkillContent(content)` | 字符串转换（canonical name 重写） |
| `commands/doctor.js` | `plugin.js` | `inspectInstalledAssets(projectRoot, adapter)` | 返回 `{ commands, skills, agents }` 缺失列表 |
