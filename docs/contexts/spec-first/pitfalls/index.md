# spec-first 已知高风险区域与陷阱

**版本：** v1.5.1  
**语言：** JavaScript / CommonJS  
**最后更新：** 2026-04-07

本文档记录 `spec-first` 代码库中已识别的高风险区域，供开发者在修改相关代码时参考。每个条目包含：文件路径与行号范围、风险类型、为什么有风险、以及建议的缓解措施。

---

## 代码层风险

### P1 — 破坏性写入无 rollback（`plugin.js:syncSkills`）

**文件：** `src/cli/plugin.js`，行 153–169  
**风险类型：** 破坏性操作（高风险）

**代码片段：**

```javascript
function syncSkills(projectRoot, adapter) {
  const targetRoot = path.join(projectRoot, adapter.skillsRoot);
  fs.mkdirSync(targetRoot, { recursive: true });

  const sourceRoot = getBundledPath('skills');
  const skillNames = listBundledSkills();

  for (const skillName of skillNames) {
    const sourceDir = path.join(sourceRoot, skillName);
    const targetDir = path.join(targetRoot, skillName);
    fs.rmSync(targetDir, { recursive: true, force: true }); // 先删后写，无备份
    copyDirectoryWithTransform(sourceDir, targetDir, (content) =>
      adapter.transformSkillContent(content, { skillName }),
    );
  }
}
```

**为什么有风险：**

每次 `spec-first init` 都会对 `.claude/skills/<skillName>/` 执行 `rmSync + recursive: true`，再重建目录。如果用户在 skill 目录中有自定义修改（如本地化的 `SKILL.md`、额外配置文件），这些修改会被无声地永久删除。整个过程没有 dry-run 模式、没有备份、没有提示确认。

**建议缓解措施：**

1. 在删除前计算 source 与 target 的差量，仅覆写有变化的文件（增量同步）
2. 或在删除前将 target 备份到临时目录，失败时自动恢复（rollback）
3. 短期：添加 `--dry-run` 标志，让用户预览将被覆写的文件
4. 文档层面：在 `README` 中明确告知 skill 目录是托管目录，不应手动修改

---

### P2 — 双重正则重写存在顺序依赖（`adapters/claude.js:125–138`）

**文件：** `src/cli/adapters/claude.js`，行 125–138  
**风险类型：** 逻辑缺陷（中风险）

**代码片段：**

```javascript
function rewriteCanonicalAgentNamesForSkills(content) {
  return rewriteCanonicalAgentNamesForExecution(
    content.replace(/\bspec-first:([a-z-]+):([a-z-]+)\b/g, '$2'),
  ).replace(
    /Use fully-qualified agent names inside Task calls\./g,
    'Use bare agent names inside Task calls.',
  );
}

function rewriteCanonicalAgentNamesForExecution(content) {
  return content
    .replace(/Task\s+spec-first:([a-z-]+):([a-z-]+)\(/g, 'Task $2(')
    .replace(/subagent_type:\s*"spec-first:([a-z-]+):([a-z-]+)"/g, 'subagent_type: "$2"');
}
```

**为什么有风险：**

`rewriteCanonicalAgentNamesForSkills` 先用宽泛正则 `\bspec-first:([a-z-]+):([a-z-]+)\b` 将所有 canonical name 替换为 `$2`，然后才调用 `rewriteCanonicalAgentNamesForExecution`。由于第一步已将 `spec-first:category:name` 替换为 `name`，第二步的 `Task\s+spec-first:...(` 正则实际上在 skill 内容中永远不会命中（已被替换成 `name`）。

另一个 edge case：`Task\s+spec-first:([a-z-]+):([a-z-]+)\(` 要求 `(` 紧跟 canonical name 末尾，如果调用格式存在换行或空格（如多行格式），则正则不匹配，导致漏替换，运行时会出现残留的 `spec-first:category:name` 字符串。`doctor` 命令会将其标记为问题，但不会自动修复。

**建议缓解措施：**

1. 将两个重写函数的作用域分离：`ForSkills` 只处理 SKILL.md 中的引用格式，`ForExecution` 只处理执行指令块（如 Task、subagent_type）
2. 对 `Task` 调用正则放宽尾部匹配：`Task\s+spec-first:([a-z-]+):([a-z-]+)[\s\(]` 或使用前瞻断言
3. 增加单元测试覆盖含换行的 canonical name 格式

---

### P3 — `removeEmptyParents` 目录清理边界（`state.js:170–186`）

**文件：** `src/cli/state.js`，行 170–186  
**风险类型：** 潜在过度删除（中风险）

**代码片段：**

```javascript
function removeEmptyParents(startPath, stopRoot) {
  let current = startPath;
  while (current.startsWith(stopRoot) && current !== stopRoot) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }

    const entries = fs.readdirSync(current);
    if (entries.length > 0) {
      break;
    }

    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}
```

**为什么有风险：**

停止条件使用 `current.startsWith(stopRoot)` 做路径比较。如果 `stopRoot` 恰好是另一个路径的前缀（例如 `stopRoot = /project/.claude`，而系统存在 `/project/.claude-backup` 目录），`startsWith` 会误认为 `.claude-backup` 的子路径也在停止边界之内，从而可能向上追溯删除本不应清理的空目录。

此外，当 `startPath === stopRoot` 时，循环立即退出（`current !== stopRoot` 条件为假），该空目录不会被删除——这是设计意图，但行为不显而易见，可能让维护者误以为是 bug。

**建议缓解措施：**

1. 使用 `path.relative(stopRoot, current)` 或规范化后的路径精确比较，避免 `startsWith` 的前缀歧义
2. 或在进入函数前对 `stopRoot` 和 `startPath` 调用 `path.resolve()` 确保路径规范化
3. 添加注释说明 `startPath === stopRoot` 时的设计行为

---

## 架构层风险

### P4 — state 读取失败容忍过宽（`init.js:63–70`）

**文件：** `src/cli/commands/init.js`，行 63–70  
**风险类型：** 静默失败（中风险）

**代码片段：**

```javascript
let previousState = null;
try {
  previousState = readState(projectRoot, adapter);
} catch (error) {
  console.warn(
    `Warning: could not read existing spec-first state; continuing with a fresh sync. (${error instanceof Error ? error.message : String(error)})`,
  );
}
```

**为什么有风险：**

如果 `state.json` 存在但内容损坏（如 JSON 解析错误），`previousState` 会保持 `null`。后续 `removeObsoleteManagedAssets(null, ...)` 中 `normalizeState(null)` 返回空数组，不会清理任何旧版本残留资产。用户只会看到一条 `Warning` 日志，但不会意识到废弃的 skill/agent 文件仍然留在项目中。当用户降级 CLI 版本或删除某个 skill 后重新 init，就会出现"删不干净"的现象。

**建议缓解措施：**

1. 区分"文件不存在"（正常首次 init）和"文件存在但损坏"（需要告警且要求用户确认）
2. 对损坏的 state.json 提供自动修复选项（`--force` 标志清空重建）
3. 在 `doctor` 命令中增加对 state.json 有效性的检查

---

### P5 — `lang-policy.js` 损坏标记导致内容重复（`lang-policy.js:47–63`）

**文件：** `src/cli/lang-policy.js`，行 47–63  
**风险类型：** 状态损坏（中风险）

**代码片段：**

```javascript
function applyManagedBlock(existing, block) {
  const startIdx = existing.indexOf(LANG_START);
  const endIdx = existing.indexOf(LANG_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // 正常：原位替换
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + LANG_END.length);
    return `${before}${block}${after}`;
  }

  // START 存在但 END 缺失（损坏状态）：fallback 到追加
  if (existing.length === 0) {
    return block;
  }
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}\n`;
}
```

**为什么有风险：**

当 `CLAUDE.md` 中存在 `<!-- spec-first:lang:start -->` 但缺少对应的 `<!-- spec-first:lang:end -->`（手动编辑导致的损坏状态）时，函数会 fallback 到追加模式，在文件末尾添加一个新的完整 block。结果是文件中出现孤立的 START 标记，加上末尾的新完整 block（含 START + END），即内容重复且格式混乱。后续每次 `init` 都会继续追加，问题不断累积。

没有自动修复路径，用户必须手动编辑 `CLAUDE.md` 才能恢复正常。

**建议缓解措施：**

1. 检测到 START 存在但 END 缺失时，发出 `ERROR` 级别提示并中止写入，引导用户手动修复
2. 或提供 `--repair` 标志，自动删除孤立的 START 标记后重新追加完整 block
3. 在 `doctor` 命令中增加对 `CLAUDE.md` / `AGENTS.md` 标记完整性的检查

---

### P6 — developer 身份解析不对称（`developer.js:55–74`）

**文件：** `src/cli/developer.js`，行 55–74  
**风险类型：** 非直觉行为（低风险）

**代码片段：**

```javascript
function resolveDeveloperIdentity(projectRoot, options = {}, adapter = null) {
  const explicitName = normalizeName(options.user);
  const explicitLang = normalizeLang(options.lang);
  const projectDeveloper = adapter
    ? readDeveloperFile(getProjectDeveloperPath(projectRoot, adapter))
    : null;
  const globalDeveloper = readDeveloperFile(getGlobalDeveloperPath());
  const gitUserName = readGitUserName(projectRoot);

  // 注意：name 不从项目 .developer 读取——name 是全局身份标识，lang 是项目级偏好。
  const name =
    explicitName || (globalDeveloper && globalDeveloper.name) || gitUserName;
  const lang =
    explicitLang ||
    (projectDeveloper && projectDeveloper.lang) ||
    (globalDeveloper && globalDeveloper.lang) ||
    'zh';

  if (!name) {
    throw new Error(
      'Unable to determine developer name. Pass `-u/--user <name>` ...',
    );
  }
```

**为什么有风险：**

`lang` 从 project `.developer` 读取，但 `name` 不从 project `.developer` 读取，只来自 global profile 或 git config。这个非对称行为不直觉：用户可能期望重新运行 `init` 时，项目目录中已有的 `.developer` 文件（含 `name` 字段）会被复用。

更严重的是：如果全局 profile（`~/.spec-first/.developer`）和 git config 都不可用（如 CI 环境、容器内），`name` 解析失败会抛出错误，即使 project `.developer` 中已有完整的 `name` 字段。

**建议缓解措施：**

1. 将 project `.developer.name` 作为兜底来源之一（低于 global profile 优先级）
2. 或在文档和 `--help` 中明确说明 name 的解析优先级，避免用户困惑
3. 在 CI 友好场景下，提供 `SPEC_FIRST_USER` 环境变量作为 name 的注入方式

---

### P7 — Codex adapter legacy 目录硬编码无声删除（`codex.js:104–111`）

**文件：** `src/cli/adapters/codex.js`，行 55–73 / 104–111  
**风险类型：** 破坏性操作（高风险）

**代码片段（路径定义）：**

```javascript
get legacyCommandRoot()     { return '.codex/commands/spec'; }
get legacyCodexSkillsRoot() { return '.codex/skills'; }
get legacyMarketplaceRoot() { return '.agents/plugins'; }
get legacyPluginRoot()      { return 'plugins/spec'; }
get legacyPluginRootAlt()   { return 'plugins/spec-first'; }
```

**代码片段（删除调用）：**

```javascript
syncRuntimeFiles(projectRoot) {
  removeManagedDirectory(path.join(projectRoot, this.legacyCommandRoot), projectRoot);
  removeManagedDirectory(path.join(projectRoot, this.legacyCodexSkillsRoot), projectRoot);
  removeManagedDirectory(path.join(projectRoot, this.legacyMarketplaceRoot), projectRoot);
  removeManagedDirectory(path.join(projectRoot, this.legacyPluginRoot), projectRoot);
  removeManagedDirectory(path.join(projectRoot, this.legacyPluginRootAlt), projectRoot);
  return [];
}
```

**为什么有风险：**

每次对 Codex 平台执行 `init` 时，5 个 legacy 目录都会被无声地删除。这些路径（如 `.agents/plugins`、`plugins/spec`）是宽泛的通用路径，并非 spec-first 独占。如果用户项目中有其他工具恰好使用这些路径，相关内容会被永久删除。`removeManagedDirectory` 内部调用 `fs.rmSync(..., { recursive: true, force: true })`，无任何确认提示。

随着版本演进，这类 legacy 路径列表还可能继续增长，进一步扩大潜在影响范围。

**建议缓解措施：**

1. 删除前检查目录是否由 spec-first 创建（如检查目录内是否有 spec-first 特有标记文件）
2. 或收窄 legacy 路径的识别条件（如仅删除含有特定 metadata 文件的目录）
3. 将 legacy 清理操作改为可选步骤，需要用户传入 `--clean-legacy` 标志显式触发

---

## 业务逻辑风险

### P8 — version-reminder 无响应格式校验（`version-reminder.js:53–87`）

**文件：** `src/cli/version-reminder.js`，行 53–87  
**风险类型：** 静默失败（低风险）

**代码片段：**

```javascript
const payload = await response.json().catch(() => null);
return payload && typeof payload.version === 'string'
  ? payload.version.trim()
  : '';
```

**为什么有风险：**

npm registry 返回异常格式（如 `deprecated`、`dist-tags` 嵌套、CDN 错误页面）时，函数直接返回空字符串，无任何日志或告警。虽然对用户无影响（版本提示不显示），但当 registry 接口变更后，开发团队无法感知版本检查功能是否正常工作。

**建议缓解措施：**

1. 在 `process.env.DEBUG` 模式下输出响应格式异常的调试日志
2. 记录一个可监控的静默失败计数器，便于后续接入可观测性工具

---

## 已知限制与技术债务

### L1 — Codex CLI 检查降级为 WARNING（`doctor.js:127–130`）

**文件：** `src/cli/commands/doctor.js`，行 127–130

```javascript
// Note: Codex CLI may not be available yet - this is expected during MVP phase
const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
```

Codex CLI 不可用时，`doctor` 报告 `WARNING` 而非 `ERROR`。MVP 阶段的设计妥协。随着 Codex 平台支持趋于稳定，这里的容忍级别应该被重新评估并适时升级为 `ERROR`。

---

### L2 — syncSkills 无增量同步能力

`plugin.js:syncSkills` 目前是全量覆写（先 rmSync 再 copy）。缺少文件哈希比较或 mtime 检查，无法实现增量同步。在 skill 数量增多、文件体积变大后，每次 `init` 的磁盘 I/O 会线性增长。

---

## 风险等级汇总

| 编号 | 位置 | 风险类型 | 等级 |
|------|------|----------|------|
| P1 | `plugin.js:153–169` | 破坏性写入无 rollback | 高 |
| P7 | `codex.js:104–111` | 硬编码 legacy 路径无声删除 | 高 |
| P2 | `adapters/claude.js:125–138` | 双重正则顺序依赖 | 中 |
| P3 | `state.js:170–186` | 目录清理 startsWith 歧义 | 中 |
| P4 | `init.js:63–70` | state 读取失败静默继续 | 中 |
| P5 | `lang-policy.js:47–63` | 损坏标记导致内容重复 | 中 |
| P6 | `developer.js:55–74` | name 解析非对称 | 低 |
| P8 | `version-reminder.js:53–87` | 无格式校验静默失败 | 低 |
