# CLI 层实现详情

**项目版本：** spec-first v1.5.1  
**运行时：** Node.js 20+，CommonJS，无 CLI 框架  
**入口文件：** `bin/spec-first.js` → `src/cli/index.js`

---

## CLI 入口与命令路由

```
bin/spec-first.js
  └─ src/cli/index.js : runCli(argv)
       ├─ doctor  → commands/doctor.js : runDoctor(argv)
       ├─ init    → commands/init.js   : runInit(argv)
       └─ clean   → commands/clean.js  : runClean(argv)
```

`runCli()` 是整个 CLI 的顶层协调器（`src/cli/index.js` L9-45）。它仅做三件事：

1. 解析第一个位置参数作为子命令名（`cmd = args[0]`）
2. 在分发之前调用 `maybeShowVersionReminder()` 检查是否有新版本
3. 把剩余 argv（`args.slice(1)`）原样转交给对应的子命令函数

`runCli()` 返回 `Promise<number>`（退出码），调用方在 `bin/spec-first.js` 中 `process.exit(code)` 接收。未知命令输出错误到 `console.error` 并返回 1。

---

## 命令参数格式

### `spec-first init`

```
spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>]
```

**解析函数：** `parseInitArgs(argv)` — `src/cli/commands/init.js` L147-217

| 参数 | 说明 |
|------|------|
| `--claude` | 选择 Claude 平台，写入 `.claude/` |
| `--codex` | 选择 Codex 平台，写入 `.codex/`（技能写入 `.agents/skills/`） |
| `-u` / `--user <name>` | 覆盖开发者姓名；也支持 `--user=name` 格式 |
| `--lang <zh\|en>` | 覆盖语言策略；也支持 `--lang=zh` 格式 |
| `-h` / `--help` | 打印帮助并退出 0 |

**强制约束：**
- `--claude` 和 `--codex` 必须二选一，不可同时指定
- 任何无法识别的 flag 会进入 `parsed.unknown[]`，非空时报错退出 1
- `-u`/`--lang` 后若紧跟另一个 `-` 开头的词，则视为非法（`parsed.unknown.push(arg)`）

**完整执行流程（`runInit()`，L24-141）：**

1. `getAdapter(platform)` — 选择 ClaudeAdapter 或 CodexAdapter
2. `findDuplicateClaudeAgentNames()` — 仅 Claude 平台：验证所有 bundled agent 的 bare name 不重复
3. `readState(projectRoot, adapter)` — 读取已有 state（失败时 warn-then-continue，保证重装幂等）
4. `resolveDeveloperIdentity()` — 优先级：CLI arg > 全局 `~/.spec-first/.developer` > git config
5. `removeObsoleteManagedAssets()` — diff previousState vs previewState，删除废弃资产
6. `pruneCommandNamespace()` — 删除 commandRoot 中不在 nextState.commands 列表内的文件
7. `syncBundledAssets()` — 批量复制 commands/skills/agents（见"资产同步数据流"一节）
8. `writeDeveloperFile()` — 写 `.developer` 文件
9. `writeState()` — 写 `state.json`
10. `adapter.syncRuntimeFiles()` — 平台特定后处理（Codex: 清理遗留目录）
11. `writeLangPolicy()` — 幂等注入语言策略到 `CLAUDE.md` 或 `AGENTS.md`
12. `bootstrapChangelog()` — 首次初始化时创建 `CHANGELOG.md`

### `spec-first doctor`

```
spec-first doctor [--claude|--codex]
```

**解析函数：** `parseDoctorArgs(argv)` — `src/cli/commands/doctor.js` L401-422

| 参数 | 说明 |
|------|------|
| `--claude` | 只检查 Claude 平台 |
| `--codex` | 只检查 Codex 平台 |
| （无参数） | 调用 `detectPlatforms()` 自动检测（检查 `.claude/`/`.codex/` 目录是否存在） |

**检查分层：**

通用检查（所有平台共享）：
- `checkNodeVersion()` — 要求 Node.js 20+
- `checkGit()` — 通过 `spawnSync('git', ['--version'])` 验证 git 可用
- `checkPluginManifest()` — 读取并校验 `.claude-plugin/plugin.json`

平台特定检查（按顺序）：
- `checkPlatformCli(platform)` — 验证 `claude`/`codex` CLI 已安装（不可用时降级为 WARNING）
- `checkProjectDeveloper()` — `.developer` 文件完整性及版本一致性
- `checkManagedState()` — `state.json` 完整性及 manifestVersion 一致性
- `adapter.inspectRuntimeFiles()` — Claude 专属：检测 canonical name 残留和未解析 Task 引用
- `checkGeneratedCommands()` — 仅 Claude：检查命令文件是否缺失
- `checkInstalledSkills()` — 技能目录同步情况
- `checkInstalledAgents()` — agent 文件同步情况

**退出码：** 有任意 `level === 'ERROR'` 的检查项 → 返回 1；全部为 PASS/WARNING → 返回 0

### `spec-first clean`

```
spec-first clean (--claude|--codex)
```

**解析函数：** `parseCleanArgs(argv)` — `src/cli/commands/clean.js` L75-96

| 参数 | 说明 |
|------|------|
| `--claude` | 清理 Claude 平台资产 |
| `--codex` | 清理 Codex 平台资产 |

**执行流程（`runClean()`，L6-55）：**

1. `readState(projectRoot, adapter)` — 读取 `state.json`（失败则硬退出 1，不允许静默继续）
2. `removeManagedAssets()` — 根据 state 列表删除 commands/skills/agents/.developer
3. `adapter.removeRuntimeFiles()` — 清理平台遗留目录（Codex 清理 legacy 路径）
4. `clearState()` — 删除 `state.json` 本身并清理空父目录
5. `removeEmptyManagedRoots()` — 如果 skills/agents/commands 目录变为空则删除

**设计要点：** clean 完全依赖 state.json 知道要删什么，不硬编码路径。自定义资产（不在 state 列表中）不受影响。

---

## 资产同步数据流

核心函数：`syncBundledAssets(projectRoot, adapter)` — `src/cli/plugin.js` L124-130

```
syncBundledAssets(projectRoot, adapter)
  ├─ syncCommands(projectRoot, adapter)    [仅 Claude]
  ├─ syncSkills(projectRoot, adapter)
  └─ syncAgents(projectRoot, adapter)
```

### syncCommands（`plugin.js` L132-151）

1. 从 `.claude-plugin/plugin.json` 的 `commands[]` 数组读取命令定义列表
2. 对每个命令：从 `templates/claude/commands/spec/<filename>` 读取模板内容
3. 调用 `adapter.transformSkillContent(content)` 做平台适配（名称重写）
4. 写入 `<projectRoot>/<adapter.commandRoot>/<adapter.commandFilename(command)>`

当前共 8 个 command 模板：ideate / brainstorm / plan / work / review / compound / bootstrap / mcp-setup

### syncSkills（`plugin.js` L153-169）

```
for each skillName in listBundledSkills():
  targetDir = <projectRoot>/<adapter.skillsRoot>/<skillName>
  fs.rmSync(targetDir, { recursive: true, force: true })   // 先删
  copyDirectoryWithTransform(sourceDir, targetDir, adapter.transformSkillContent)
```

**关键设计：先删后拷（L163）**。这保证同步结果与 bundled 资产完全一致，但不可回滚——若复制中途失败，目标目录可能处于部分状态。选择简单胜过事务安全。

当前共 43 个 skill 目录，每个 skill 必须包含 `SKILL.md` 入口文件。

### syncAgents（`plugin.js` L172-189）

1. `listBundledAgents()` 递归遍历 `agents/` 目录，返回所有 `.md` 文件的相对路径列表
2. 对每个 agentPath：保留目录层级，调用 `adapter.transformAgentContent(content)` 适配
3. 写入 `<projectRoot>/<adapter.agentsRoot>/<agentPath>`

当前共 47 个 agent 文件，分布于 6 个分类目录：research / design / document-review / docs / review / workflow

### 内容转换（transformContent）

| 转换类型 | Claude 行为 | Codex 行为 |
|---------|------------|-----------|
| `spec-first:cat:name` in skill | 替换为 bare name `name`（`$2`） | 替换为路径字符串 `.codex/agents/cat/name.md` |
| `Task spec-first:cat:name(...)` | 替换为 `Task name(...)` | 替换为 `Read \`.codex/agents/cat/name.md\` and apply...` |
| `subagent_type: "spec-first:cat:name"` | 替换为 `"name"` | 无此字段转换 |
| 路径引用 `.claude/commands/spec/x.md` | 不变 | 替换为 `.agents/skills/spec-x/SKILL.md` |
| `--claude` 标志文本 | 不变 | 替换为 `--codex` |

---

## Platform Adapter 模式

Adapter 定义在 `src/cli/adapters/` 目录，基类为 `base.js`，两个实现：`claude.js` 和 `codex.js`。通过 `getAdapter(platform)` 工厂函数获取实例。

### 属性对比

| 属性 | ClaudeAdapter | CodexAdapter |
|------|--------------|-------------|
| `id` | `'claude'` | `'codex'` |
| `hasCommands` | `true`（继承基类默认值） | `false`（显式覆盖） |
| `runtimeRoot` | `.claude` | `.codex` |
| `commandRoot` | `.claude/commands/spec` | `.codex/spec-first/commands`（不启用） |
| `skillsRoot` | `.claude/skills` | `.agents/skills` |
| `agentsRoot` | `.claude/agents` | `.codex/agents` |
| `stateFile` | `.claude/spec-first/state.json` | `.codex/spec-first/state.json` |
| `developerFile` | `.claude/spec-first/.developer` | `.codex/spec-first/.developer` |
| `instructionFile` | `CLAUDE.md` | `AGENTS.md` |

### Agent 名称格式差异

Claude adapter（`claude.js` L125-132）使用 bare name：

```js
// rewriteCanonicalAgentNamesForSkills: spec-first:research:repo-research-analyst → repo-research-analyst
content.replace(/\bspec-first:([a-z-]+):([a-z-]+)\b/g, '$2')

// rewriteCanonicalAgentNamesForExecution: Task spec-first:review:reviewer(...) → Task reviewer(...)
content.replace(/Task\s+spec-first:([a-z-]+):([a-z-]+)\(/g, 'Task $2(')
```

Codex adapter（`codex.js` L143-173）使用完整路径：

```js
// Task spec-first:review:reviewer(summary) → Read `.codex/agents/review/reviewer.md` and apply...
content.replace(/Task\s+spec-first:([a-z-]+):([a-z-]+)\(([^)]*)\)/gm, ...)
```

### inspectRuntimeFiles 差异

Claude adapter 执行两类运行时检查（`claude.js` L73-120）：
1. 扫描 `.claude/skills/` 中所有 `.md` 文件，检测残留 `spec-first:cat:name` canonical name
2. 扫描 skills + agents 中所有 `Task xxx(` 引用，与已注册 agent name 列表做 diff，报告未解析引用

Codex adapter 的 `inspectRuntimeFiles()` 直接返回空数组（`codex.js` L113-115），不做此类检查。

### syncRuntimeFiles 差异

ClaudeAdapter 的 `syncRuntimeFiles()` 只调用 `adapter.syncRuntimeFiles(projectRoot, { manifest, synced })`（基类空实现）。

CodexAdapter 的 `syncRuntimeFiles()` 额外清理多个遗留路径（`codex.js` L104-111）：
- `.codex/commands/spec`（旧版 command 目录）
- `.codex/skills`（旧版 Codex skills 目录）
- `.agents/plugins`（marketplace 残留）
- `plugins/spec` 和 `plugins/spec-first`（更早期的遗留路径）

---

## 测试策略

测试分三层，全部使用 bash 脚本驱动（无 Jest/Mocha）：

### 单元层 (`tests/unit/`)

| 脚本 | 测试内容 |
|------|---------|
| `lang-policy.sh` | `lang-policy.js` 的幂等注入逻辑、标记解析 |
| `developer.sh` | developer identity 解析、.developer 文件格式 |
| `version-reminder.sh` | 版本检查逻辑 |
| `mcp-setup.sh` | mcp-setup skill 的 bash 脚本和 JSON 配置（check-deps.sh, detect-tools.sh） |

单元测试使用 `assert()` / `assert_output()` / `assert_contains()` helper 函数，最终汇报 pass/fail 计数。

### Smoke 层 (`tests/smoke/`)

主要脚本：`cli.sh`（约 400 行）

端到端验证完整的 init → doctor → clean 流程，在临时目录中执行真实的 CLI 命令：

- 验证 8 个 command 文件生成（`grep -q "Generated 8 command file(s)"`）
- 验证 43 个 skill 目录安装、47 个 agent 文件安装
- 验证 canonical agent name 重写正确（`Task repo-research-analyst`，而非 `Task research:repo-research-analyst`）
- 验证废弃资产被 prune（`test ! -e "$TMP_DIR/.claude/commands/spec/obsolete.md"`）
- 验证 CLAUDE.md lang policy 块幂等性（`lang_marker_count` 必须为 1）
- 验证 clean 不影响自定义资产（`test -e "$TMP_DIR/.claude/skills/custom-skill/SKILL.md"`）
- 验证 Codex 平台 init/doctor/clean 完整流程
- 验证 doctor 能检测到 Task agent 名称漂移（exit code 1 + ERROR 消息）

### Integration 层 (`tests/integration/`)

脚本：`e2e.sh`

完整安装 + 多命令 e2e 流程检查，涵盖 Claude 和 Codex 双平台的完整生命周期。

### 执行命令

```bash
npm test                        # smoke + integration
npm run test:smoke              # 只跑 smoke
bash tests/unit/lang-policy.sh  # 单独验证语言策略
bash tests/unit/mcp-setup.sh    # 单独验证 mcp-setup skill
```

---

## 注意事项与设计取舍

### 1. 手写 argv 解析（无 commander/yargs）

**设计决策：** 每个命令有独立的 `parseXxxArgs()` 函数，使用 `for` 循环手工解析。

**取舍原因：** spec-first 定位为零依赖或最小依赖的 CLI 工具，引入 commander/yargs 会增加依赖树复杂度和包体积。三个命令的参数非常简单（最多 4 个 flag），手写成本可控。

**代价：** 不支持缩写合并（`-cu`），参数错误信息不够友好，每次增加新 flag 需同步修改 `parseXxxArgs()` 和 `printHelp()`。

### 2. init 的失败容忍设计（warn-then-continue）

`src/cli/commands/init.js` L63-70：

```js
try {
  previousState = readState(projectRoot, adapter);
} catch (error) {
  console.warn(`Warning: could not read existing spec-first state; continuing with a fresh sync. ...`);
}
```

`readState` 失败时 `previousState` 保持 `null`，后续的 `removeObsoleteManagedAssets()` 和 `pruneCommandNamespace()` 用空 state 调用，不删任何文件。结果是：即使 state.json 损坏，重装也能成功，保证了安装的幂等性。

**反例：** clean 命令的 `readState` 失败则硬退出 1，因为无法安全知道"该删什么"。

### 3. syncSkills 先删后拷（不可回滚）

`src/cli/plugin.js` L163：

```js
fs.rmSync(targetDir, { recursive: true, force: true });  // 先删整个 skill 目录
copyDirectoryWithTransform(sourceDir, targetDir, ...);   // 再复制
```

**取舍原因：** 先删确保目标目录与 bundled 资产完全一致，避免"孤儿文件"（前一版本留下但新版本不再有的文件）残留。实现逻辑简单。

**风险：** 若 `copyDirectoryWithTransform` 中途抛出异常（如磁盘空间不足），目标 skill 目录处于半复制状态。没有事务语义，没有回滚。选择了简单胜过事务安全。

### 4. 退出码规范

所有 `runXxx()` 函数均返回数字：

| 返回值 | 含义 |
|--------|------|
| `0` | 成功 |
| `1` | 失败（参数错误、文件缺失、doctor 发现 ERROR） |

错误输出统一到 `console.error`，正常输出到 `console.log`。每个 `runXxx()` 是纯函数（除了文件系统副作用），无全局状态。

---

## Anti-patterns 与 Code Smells

### 1. `require` 内联读取 package.json 版本

**文件：** `src/cli/commands/doctor.js` L308  
**行范围：** L308

```js
const packageVersion = require('../../../package.json').version;
```

**风险类型：** 维护性 / 可测试性  
**为何有风险：** 相对路径 `'../../../package.json'` 依赖文件层级不变，若 `doctor.js` 被移动则路径失效。模块级 `require` 在测试时难以 mock，导致版本检查逻辑无法单独测试。同项目其他地方（`developer.js` L8、`src/cli/index.js` L3）通过顶层 `require` 将 pkg 作为变量传递，风格不一致。  
**建议修复：** 在 `doctor.js` 文件顶部统一 `const pkg = require('../../../package.json')`，或将 `packageVersion` 作为参数注入 `checkProjectDeveloper(projectRoot, adapter, packageVersion)`。

---

### 2. `syncSkills` 没有原子性保护

**文件：** `src/cli/plugin.js`  
**行范围：** L153-169

```js
for (const skillName of skillNames) {
  const targetDir = path.join(targetRoot, skillName);
  fs.rmSync(targetDir, { recursive: true, force: true });  // L163: 先删
  copyDirectoryWithTransform(sourceDir, targetDir, ...);    // L164: 再拷
}
```

**风险类型：** 可靠性 / 数据丢失  
**为何有风险：** `rmSync` 成功但 `copyDirectoryWithTransform` 抛出时，该 skill 目录被彻底删除且不会自动恢复。`for` 循环中前面几个 skill 可能已完成、后面的还未开始，整个 `skills/` 目录处于不一致状态。重新执行 `init` 可以修复，但用户在此期间运行 Claude Code 会发现 skill 缺失。  
**建议修复：** 先复制到临时目录 `targetDir + '.tmp'`，成功后 `renameSync` 替换原目录；或在外层用 try/catch 捕获并向用户提示"部分技能安装失败，请重新 init"。

---

### 3. `rewriteCanonicalAgentNamesForSkills` 的双重嵌套重写

**文件：** `src/cli/adapters/claude.js`  
**行范围：** L125-132

```js
function rewriteCanonicalAgentNamesForSkills(content) {
  return rewriteCanonicalAgentNamesForExecution(   // 内层调用
    content.replace(/\bspec-first:([a-z-]+):([a-z-]+)\b/g, '$2')  // 外层先做字面量替换
  ).replace(
    /Use fully-qualified agent names inside Task calls\./g,
    'Use bare agent names inside Task calls.',
  );
}
```

**风险类型：** 正确性 / 可读性  
**为何有风险：** 外层先将 `spec-first:cat:name` → `name`（只保留第二段），内层 `rewriteCanonicalAgentNamesForExecution` 再做一次 `Task spec-first:cat:name(` → `Task name(` 和 `subagent_type` 替换。当 skill 内容同时含有 `Task spec-first:cat:name(` 的形式时，外层替换先于内层执行，先变成 `Task name(` 后内层正则已无法匹配（因为 `spec-first:` 已被移除），结果是**内层的 Task 重写对 skill 文件实际上从不触发**。这个行为靠顺序保证是正确的，但非常脆弱，任何调整顺序的重构都会引入静默 bug。  
**建议修复：** 将两步合并为一次正则处理，或在注释中明确说明"外层先替换会使内层 Task 正则短路，这是有意设计"，并添加单元测试覆盖 `Task spec-first:cat:name(args)` 在 skill 文件中的转换结果。

---

## 快速参考

| 函数 | 文件 | 职责 |
|------|------|------|
| `runCli(argv)` | `src/cli/index.js` | 顶层命令路由 |
| `runInit(argv)` | `src/cli/commands/init.js` | 执行 init 12 步流程 |
| `parseInitArgs(argv)` | `src/cli/commands/init.js` | 解析 init flag |
| `runDoctor(argv)` | `src/cli/commands/doctor.js` | 两阶段健康检查 |
| `runClean(argv)` | `src/cli/commands/clean.js` | 基于 state 的资产清理 |
| `syncBundledAssets()` | `src/cli/plugin.js` | commands/skills/agents 批量同步 |
| `syncSkills()` | `src/cli/plugin.js` | 先删后拷安装 skills |
| `syncAgents()` | `src/cli/plugin.js` | 保留层级安装 agents |
| `getAdapter(platform)` | `src/cli/adapters/index.js` | 工厂：返回 ClaudeAdapter 或 CodexAdapter |
| `resolveDeveloperIdentity()` | `src/cli/developer.js` | 三级优先级解析开发者身份 |
| `readState()` / `writeState()` | `src/cli/state.js` | state.json 读写 |
| `removeObsoleteManagedAssets()` | `src/cli/state.js` | diff-based 废弃资产清理 |
| `writeLangPolicy()` | `src/cli/lang-policy.js` | 幂等注入语言策略块 |
| `bootstrapChangelog()` | `src/cli/changelog.js` | 首次创建 CHANGELOG.md |
