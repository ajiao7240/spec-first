---
title: "feat: spec-first update 执行实际升级并提示 init"
type: feat
status: completed
date: 2026-06-12
spec_id: 2026-06-12-003-update-perform-upgrade
---

# feat: spec-first update 执行实际升级并提示 init

## Summary

把 `spec-first update` 从 check-only 诊断改成实际执行升级:**无条件直接运行 `npm install -g spec-first@latest`**(npm 自身幂等,已是最新会自动 no-op),升级成功后友好提示用户下一步运行 `spec-first init` 刷新本地 runtime。按用户决策:**不做安装方式检测(无脑执行)**、**不查版本(无条件直跑,删除版本查询/比较代码)**、**完全替换 check-only 行为,不保留 `--json` / 只读模式**。

---

## Problem Frame

当前 `spec-first update`(`src/cli/commands/update.js`)是纯只读诊断:对比 CLI 包版本与 npm latest、检查 runtime drift,然后**只打印**建议命令(`npm install -g spec-first@latest` / `spec-first init`),从不执行任何 mutation(`mode: 'check-only'`,help 里写 "NEVER installs or upgrades")。

用户希望 `update` 直接承担"升级 CLI 包"这一动作:`spec-first update` ≈ `npm install -g spec-first@latest`,升级到新版本后提示用户去跑 `spec-first init` 刷新本地内容。runtime 刷新仍由 `init` 负责(不折叠进 update),所以 update 升级完只给提示、不代跑 init —— 这同时天然避开了"旧进程跑新 runtime 生成逻辑"的版本错位(用户升级后用新装的 binary 另起 `init`)。

> **已知风险(用户已确认接受):** 无脑执行 `npm install -g` 对非 npm-global 安装(Claude Code plugin / pnpm / yarn / volta / asdf)是有害的——会装出第二份冲突副本,而真正在用的副本纹丝不动;并且可能撞全局安装权限(EACCES)。本计划据此实现,但保留一条静态 caveat 提示与失败兜底(见 U1)。

---

## Requirements

- R1. `spec-first update` **无条件**执行 `npm install -g spec-first@latest`(不查版本、不检测安装方式;npm 幂等,已是最新自动 no-op)。
- R2. npm 安装成功后,友好提示用户下一步运行 `spec-first init` 刷新本地 runtime。
- R3. npm 安装失败时区分两类并 surface:`npm` 不在 PATH(spawn ENOENT,提示"未找到 npm")与 npm 返回非 0(转发真实退出码 + 手动命令);均以非 0 退出,不静默吞错。
- R4. 完全移除 check-only 契约:删除 `mode: 'check-only'`、`--json` 报告、`spec-first-update-report.v1` schema、runtime drift 检查与版本查询/比较;`--json`/`--claude`/`--codex` 不再受支持(视为未知 flag,exit 2)。
- R5. `runUpdate` 暴露可注入的 install 执行器(`runInstall`),使单测无需真实 `npm install -g`、无需联网。
- R6. 同步修正 version-reminder 启动提示中"`spec-first update` 是 read-only"的措辞,使其与新行为一致(reminder 自身仍只读)。
- R7. 同步更新 `--help`、CHANGELOG、README/README.zh-CN 中关于 `update` check-only 的描述。

---

## Scope Boundaries

- 不把 `spec-first init` 折叠进 `update`(不自动跑 init,只提示)。
- 不做安装方式检测/分支(用户显式否决"检测后改指引"方案)。
- 不保留只读/`--json`/dry-run 模式(用户显式选择完全替换)。
- 不改 `init`、`doctor`、`clean` 行为。
- 不引入升级前交互确认(无脑执行,直接装)。

---

## Direct Evidence Readiness

- target_repo: spec-first(当前仓库,单仓)
- evidence_sources: 直接源码读取、rg、git status/log
- source_refs: `src/cli/commands/update.js`、`src/cli/version-reminder.js`、`tests/unit/update-contracts.test.js`、`src/cli/index.js`
- current_revision: 8eeedbfb(HEAD,分支 leo-2026-06-11-plan-update)
- worktree_status: dirty(存在与本变更无关的 M 文件,见会话起始 git status)
- confidence: high(命令实现、契约测试、reminder、接线均已逐行读取)
- limitations: 未运行测试;npm 跨平台调用(`npm` vs `npm.cmd`)的精确机制留待实现

---

## Direct Evidence

- repo_scope: `src/cli/`(命令+reminder+接线)、`tests/unit/`
- source_reads_completed:
  - `src/cli/commands/update.js`(整文件,runUpdate 全链路)
  - `src/cli/version-reminder.js`(整文件;`formatStartupVersionReminder` line 154-164 含需改措辞)
  - `tests/unit/update-contracts.test.js`(整文件,硬断言 check-only 契约)
  - `src/cli/index.js`(grep:line 57 `runUpdate(args.slice(1))`,line 94 startup reminder)
- source_reads_required:
  - `tests/unit/version-reminder.sh`(确认是否断言启动提示措辞)
  - README.md / README.zh-CN.md / docs/ 中 "spec-first update" 描述位置(rg 定位)
- commands_or_tools_used: rg、grep、git log/status
- impact_on_plan: `spec-first-update-report.v1` 仅 update.js 与其测试消费(rg 确认),故删 json 报告影响面小;index.js 接线不变。
- key_findings:
  - `runUpdate` 现有依赖:`pkg`、`getAdapter`、`inspectInstalledAssets`、version-reminder 的 `defaultLookupLatestVersion`/`compareVersions`、`detectPlatforms`(来自 doctor)。改造后 runtime drift 相关依赖(`getAdapter`/`inspectInstalledAssets`/`detectPlatforms`)将不再需要。
  - version-reminder.js 是独立的被动启动提示,不调用 `runUpdate`;两者仅通过"提示用户去跑 update"这一文案耦合。
- limitations: 未执行测试链路;未实测 npm 全局安装行为。

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/commands/update.js` — `runUpdate(argv)`:待重写的命令主体。
- `src/cli/version-reminder.js` — `maybeShowVersionReminder` 的 `lookupLatestVersion` 注入是依赖注入的既有范式,U1 的 `runInstall` 注入照此办理。注意:本变更后 `update.js` 不再 import `defaultLookupLatestVersion`/`compareVersions`(它们仍服务 version-reminder 自身)。
- `formatStartupVersionReminder`(version-reminder.js:154)— 含 "read-only ... will not install" 措辞,U2 修正。
- `scripts/run-test-suite.cjs` 的 `run()`(spawnSync,`shell: false`,Windows 分支)— 跨平台子进程调用范式,U1 调 npm 时参考。
- `src/cli/index.js:57` — `return runUpdate(args.slice(1))`,签名保持兼容(可选第二参数注入)。

### Institutional Learnings

- 未检索到 `docs/solutions/` 中与本变更直接相关的既有沉淀(本计划范围窄,按直接源码证据推进)。

---

## Key Technical Decisions

- **无条件直跑 npm,不查版本**(用户决策,doc-review P2):删除 `defaultLookupLatestVersion`/`compareVersions` 的使用;`update` 只做"直跑 `npm install -g spec-first@latest`→成功则提示 init"。npm 自身处理"已是最新"幂等。代价:每次都联网+起 npm,无 `vX -> vY` 文案——用户已接受。
- **无脑执行,不检测安装方式**(用户决策):对 plugin/pnpm/volta 用户的有害性以一条静态 caveat 提示 + 失败兜底缓解,不做分支逻辑。
- **完全替换 check-only**(用户决策):删除 `--json`/runtime drift/`spec-first-update-report.v1`/版本比较。
- **依赖注入做测试 seam**:`runUpdate(argv, { runInstall })`,默认走真实 npm 子进程;测试注入假 installer(模拟成功/非0/ENOENT),避免真实全局安装。照 `maybeShowVersionReminder` 既有注入风格。
- **静态 plugin caveat(非检测)**:升级成功后打印一行 "若通过 Claude Code plugin 安装,请改用 `claude plugin update`",纯文案、不分支。若评审认为多余可删,不影响核心。
- **npm 跨平台调用**:`spawnSync` 调 `npm`(Windows 下 `npm.cmd` 或 `shell: true`),`stdio: 'inherit'` 让 npm 输出直达用户;捕获 `error.code === 'ENOENT'` 区分"未找到 npm"。精确机制留待实现(见 Deferred)。

---

## Open Questions

### Resolved During Planning

- 非 npm-global 安装如何处理?→ 用户选:无脑执行 `npm install -g`,不检测。
- 是否保留只读/`--json`?→ 用户选:完全替换,不保留。
- 是否查版本后再装?→ 用户选(doc-review P2):无条件直跑 npm,不查版本。
- 升级后是否自动跑 init?→ 否,只提示(避免版本错位 + 守 source/runtime 边界)。

### Deferred to Implementation

- npm 跨平台调用精确写法(`npm` vs `npm.cmd` vs `shell: true`):实现时按 `run-test-suite.cjs` 范式定。
- version-reminder.sh 是否断言启动提示具体措辞:实现时读该文件,若断言则同步改。

---

## Implementation Units

### U1. 重写 runUpdate 为无条件执行升级 + 重写 help + 重写契约测试

**Goal:** 把 `update` 命令主体从 check-only 改成"无条件直跑 `npm install -g spec-first@latest`→成功后提示 `spec-first init`",并重写其契约测试。

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/cli/commands/update.js`
- Test: `tests/unit/update-contracts.test.js`

**Approach:**
- 新 `runUpdate(argv, deps = {})`:
  - 解析 args:仅保留 `-h/--help`;`--json`/`--claude`/`--codex` 及其它 → 未知 flag,打印用法,exit 2(R4)。
  - `deps.runInstall`(默认真实 npm 子进程执行器:`spawnSync` npm install -g `${PACKAGE_NAME}@latest`,`stdio: 'inherit'`,返回 `{ status, errorCode }`)。
  - 无条件调 `runInstall()`(R1):
    - 成功(status 0):友好提示 "升级完成,下一步:运行 `spec-first init` 刷新本地 runtime",静态 plugin caveat 一行,return 0(R2)。
    - `error.code === 'ENOENT'`(未找到 npm):打印 "未找到 npm,请确认 Node.js/npm 已安装并在 PATH 中",return 非 0(R3)。
    - status 非 0:转发真实退出码 + 打印手动命令 `npm install -g spec-first@latest`,return 非 0(R3)。
  - 删除 `buildUpdateReport`/`buildPlatformRuntimeReport`/`inspectRuntimeDrift`/`reportExitCode`/`printUpdateReport`/`lookupLatest`/`classifyVersion` 等 check-only + 版本比较代码,以及随之 orphan 的 import(`getAdapter`、`inspectInstalledAssets`、`detectPlatforms`、version-reminder 的 `defaultLookupLatestVersion`/`compareVersions`)。仅删因本改动而无用的 import(精准修改);`PACKAGE_NAME`(来自 `pkg.name`)保留。
- 重写 `printHelp`:去掉 "check-only"/"NEVER installs";写明 update 会执行 `npm install -g spec-first@latest` 并提示随后跑 `spec-first init`;保留 Repository 行。
- 重写 `tests/unit/update-contracts.test.js`:注入假 `runInstall`(记录调用次数/参数,模拟成功/非0/ENOENT),覆盖下列场景;不得真实联网或真实全局安装。

**Patterns to follow:**
- `src/cli/version-reminder.js` 的 `lookupLatestVersion` 注入风格(本单元注入 `runInstall`)。
- `scripts/run-test-suite.cjs` `run()` 的 spawnSync 跨平台用法。

**Test scenarios:**
- Happy path:`runInstall` 模拟成功 → 被调用一次且命令为 `npm install -g spec-first@latest`,stdout 含 `spec-first init` 提示,exit 0。
- Error path:`runInstall` 模拟返回非 0 → stdout/stderr 含手动命令,exit 非 0,且**不**打印 init 提示。
- Error path:`runInstall` 模拟 ENOENT(npm 未找到)→ stderr 含"未找到 npm"提示,exit 非 0。
- Edge case:`--json`(旧 flag)→ exit 2(已不支持),`runInstall` 不被调用。
- Edge case:`--bogus` 未知 flag → exit 2,`runInstall` 不被调用。
- Happy path:`--help` → exit 0,`runInstall` 不被调用,stdout **不含** "check-only"/"NEVER",**含** `npm install -g spec-first@latest` 与 `spec-first init`。

**Verification:**
- `npm run test:unit`(或聚焦 `tests/unit/update-contracts.test.js`)通过。
- `node --check src/cli/commands/update.js` 通过。
- 手动 `spec-first update --help` 文案与新语义一致。

---

### U2. 修正 version-reminder 启动提示措辞

**Goal:** 让启动提示与 `update` 新行为一致——`update` 现在会升级,reminder 自身仍只读。

**Requirements:** R6

**Dependencies:** U1

**Files:**
- Modify: `src/cli/version-reminder.js`(`formatStartupVersionReminder`,line 154-164)
- Test: `tests/unit/version-reminder.sh`(若其断言措辞则同步,否则只读确认)

**Approach:**
- 改第二行措辞,例如:"Run `spec-first update` to upgrade the spec-first CLI, then `spec-first init` to refresh runtime assets. This startup reminder itself is read-only." 保留"reminder 只读"的真实声明,去掉暗示 `update` 只读的表述。
- 先读 `tests/unit/version-reminder.sh` 确认是否对该字符串断言;若断言则同步更新断言。

**Patterns to follow:**
- 现有 `formatStartupVersionReminder` 多行 join 结构。

**Test scenarios:**
- Happy path:startup reminder 输出不再声称 `spec-first update` 是 read-only;仍声明 reminder 自身只读。(若 `version-reminder.sh` 有对应断言,更新之并通过。)

**Verification:**
- `bash tests/unit/version-reminder.sh` 通过(或 `npm run test:unit`)。
- `node --check src/cli/version-reminder.js` 通过。

---

### U3. 同步文档与 CHANGELOG

**Goal:** 更新用户可见文档,使其反映 `update` 现在执行升级而非只检查。

**Requirements:** R7

**Dependencies:** U1

**Files:**
- Modify: `CHANGELOG.md`(必填,用户可见,标 `(user-visible)`,作者读 `~/.spec-first/.developer`)
- Modify: `README.md`、`README.zh-CN.md`(若含 `update` check-only 描述)
- Modify: `docs/`(rg 定位 "spec-first update" 描述处,按需更新)

**Approach:**
- rg 定位所有描述 `spec-first update` 为 check-only/只读/"不安装"的文案,改为"执行 `npm install -g spec-first@latest`,成功后提示 `spec-first init`",并标注移除 `--json`/`--claude`/`--codex` 为破坏性变更。
- CHANGELOG 按仓库现行格式新增条目,记录:行为从 check-only 改为实际升级;移除 `--json`/check-only 契约(破坏性);非 npm-global 安装的已知 caveat。

**Patterns to follow:**
- CHANGELOG 既有条目格式与 developer profile 约定。

**Test scenarios:**
- Test expectation: none — 文档/CHANGELOG 变更,无行为断言。(文案准确性靠 review。)

**Verification:**
- rg 复查无残留"check-only/NEVER installs"描述 `update` 的文案。
- CHANGELOG 含本次用户可见条目。

---

## System-Wide Impact

- **Interaction graph:** `src/cli/index.js:57` 调 `runUpdate(args.slice(1))`,签名向后兼容(新增可选第二参数);startup reminder(index.js:94)独立,仅文案耦合(U2)。
- **Error propagation:** npm 子进程失败需向上 surface 真实退出码与错误,不静默(R5)。
- **State lifecycle risks:** update 不写本仓 runtime,无 runtime 半残风险;全局安装失败由 npm 自身处理,update 只报告。
- **API surface parity:** 这是 CLI 公开契约的破坏性变更(移除 `--json`/`--claude`/`--codex`、行为从只读变 mutating),需在 CHANGELOG/README 明示。
- **Integration coverage:** 通过注入 `runInstall` 在单测验证"是否真的调用了 npm",避免真实全局安装。
- **Unchanged invariants:** `init`/`doctor`/`clean` 行为不变;version-reminder 仍为只读启动提示。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 非 npm-global(plugin/pnpm/volta)用户被装出冲突副本 / 撞权限 | 用户已确认接受;静态 caveat 提示 + 失败兜底(R5)缓解;CHANGELOG 明示 |
| 移除 `--json`/`--claude`/`--codex` 破坏既有脚本 | 在 CHANGELOG/README 标注破坏性变更;exit 2 给出清晰用法错误 |
| 单测误触发真实 `npm install -g` | 强制依赖注入 `runInstall`,默认实现仅在真实运行时生效(R7) |
| npm 跨平台(Windows `npm.cmd`)调用差异 | 参照 `run-test-suite.cjs` 既有跨平台范式,实现时定 |

---

## Documentation / Operational Notes

- CHANGELOG 必更(用户可见 + 破坏性)。
- README / README.zh-CN / docs 中 `update` 描述同步。
- 双宿主:本变更是 npm 包级行为,Claude 与 Codex 宿主一致;无 runtime generation 改动。

---

## Sources & References

- 命令实现:`src/cli/commands/update.js`
- 版本提示:`src/cli/version-reminder.js`(`formatStartupVersionReminder`)
- 契约测试:`tests/unit/update-contracts.test.js`
- 接线:`src/cli/index.js`(`runUpdate` 调用、startup reminder)
- 跨平台子进程范式:`scripts/run-test-suite.cjs`
