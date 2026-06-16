---
spec_id: 2026-06-16-003-fix-home-init-global-hook-pollution
title: "fix: 防止在 $HOME/CODEX_HOME init 污染全局 hook 导致 Codex SessionStart 双注入"
status: completed
plan_depth: standard
plan_type: fix
created: 2026-06-16
target_repo: spec-first (current repo)
---

# fix: 防止在 $HOME/CODEX_HOME init 污染全局 hook 导致 Codex SessionStart 双注入

## Summary

用户在 Codex 启动时观察到 `SessionStart hook (completed)` 注入了**两段完全相同**的 using-spec-first 内容。经源码核对，根因是 **SessionStart hook 在两个 scope 各注册了一份**：

- **全局** `~/.codex/hooks.json` → `~/.codex/hooks/session-start`
- **项目级** `<repo>/.codex/hooks.json` → `<repo>/.codex/hooks/session-start`

两份脚本都是 spec-first 生成的同形脚本（都读 `$CODEX_PROJECT_DIR/AGENTS.md` 的 bootstrap 块），Codex 启动时**全局层 + 项目层 SessionStart 都 fire** → 输出两段一模一样的注入。

**为什么全局会有一份**：spec-first 的 codex adapter（`src/cli/adapters/codex.js`）只写**项目级**路径（全部基于 `projectRoot`，从不主动写全局）。但用户曾在 `$HOME`（`/Users/kuang`）跑过一次 `spec-first init`——`config.toml:69 [projects."/Users/kuang"]` + `config.toml:184 [hooks.state."/Users/kuang/.codex/hooks.json:session_start:0:0"]` 实证。spec-first 把 HOME 当普通项目，`projectRoot=~`，于是写出 `~/.codex/hooks.json`。**致命重合**：`~/.codex/hooks.json` 恰是 Codex 的 CODEX_HOME 全局 hook 发现位置，于是它对**所有**项目生效。

这是 spec-first 缺一道护栏，不是纯用户误操作：在 `$HOME`（= CODEX_HOME / Claude 全局目录）init 会**静默污染全局**、影响用户**所有** Codex 项目，而产品当前**无防护、无检测、无提示**（`init.js` 无 homedir 检查；doctor 无跨 scope 重复检测）。影响面是"所有项目"而非单仓，值得修。

本计划加护栏。**注意：经第二轮多视角审查（对抗 reviewer），核心护栏判据已重写**——原计划用 `projectRoot === $HOME` 判定是错的等价类（`grep CODEX_HOME` 零命中，adapter 从不读 CODEX_HOME；污染的充要条件是"`projectRoot/.codex` 的 canonical == 实际 CODEX_HOME"）。修复要点：
- **U1（根因拦截）**：init 在派生 `.codex` 落到 effectiveCodexHome 时**跳过 hook 写入**（默认形态，非"确认/拒绝"——因全局装此类 hook 无合理用例）。
- **U2/U2b（存量兜底）**：doctor 用 stale 判定检测全局污染（能认出本机实际命中的裸路径形态）；正常项目 init 收尾顺带 advisory（高触达）。
- **U3（清理）**：clean 清全局误装，且护栏**单向只加写入侧**不挡 clean；state 缺失时给手删兜底。

**明确不做**：不改 adapter 写入路径逻辑（问题不在 adapter，在"目录的 .codex 恰是全局位置"）；不让 spec-first 接管 Codex 全局 hook 层；Claude 端在验证机制前不 over-fix。

---

## Decision Brief

- **推荐做法**：在 `init` 的 projectRoot 解析后加一道 home/全局目录护栏（拒绝或强确认），并在 `doctor` 加一项跨 scope 重复 SessionStart 检测。两者都是窄增量，复用现有 init plan / doctor check 结构。
- **关键判断**：根因是"HOME 被当普通项目 init → 写进恰好是全局 hook 位置的 `~/.codex/hooks.json`"。最有效的拦截点是 **init 时不让它发生**（P0）；doctor 检测是给**已被污染**的存量用户自查（P1）。adapter 去重是错方向。
- **验证焦点**：(a) init 在 HOME/CODEX_HOME 给出护栏且正常项目不受影响；(b) doctor 能识别双 scope 注册并给出可执行清理指引；(c) 双 host（Codex 主、Claude 同类风险一并护栏）；(d) 不破坏现有 init/doctor 测试与 hook wire 契约。
- **最大风险**：判据用错等价类（HOME 身份 vs CODEX_HOME 派生位置）——这是对抗审查抓出的原计划根本缺陷。缓解：U0 helper 统一用派生位置比较 + 读 CODEX_HOME env。次要风险"误伤想全局装的用户"：默认形态是**只跳过 hook 写入**（skills/agents 仍装），因全局装此类 hook 无合理用例，故不需"确认/拒绝"交互。

---

## Direct Evidence

- target_repo: spec-first（当前仓库）
- source_refs:
  - `src/cli/adapters/codex.js:13-19`（hook 安装路径全部基于 `projectRoot`：`.codex/hooks.json`、`.codex/hooks/session-start`；注释确认 `.codex/hooks.json` = codex-rs `config_folder.join("hooks.json")` 的发现位置）
  - `src/cli/commands/init.js:126`（`workspaceRoot = process.cwd()`）、`:434-602`（projectRoot 解析分支，无 homedir 护栏）
  - `src/cli/commands/doctor.js:27-94`（doctor check 渲染结构：common_checks + platform_checks，可扩展）、`:8,10`（已 import `inspectInstructionBootstrap`、`inspectManagedClaudeHooks`）
  - `templates/codex/hooks/hooks.json`（模板只注册 1 个 SessionStart entry，证明双注入非模板多注册，而是双 scope）
  - `src/cli/claude-settings.js:5-8`（Claude hook 用 `"$CLAUDE_PROJECT_DIR"/.claude/...`，写 `.claude/settings.json`，同样基于项目）
- 用户环境实证（advisory，非本仓 source）：
  - `~/.codex/hooks.json` 含 spec-first SessionStart → `~/.codex/hooks/session-start`
  - `~/.codex/config.toml:69 [projects."/Users/kuang"]`、`:184 [hooks.state."/Users/kuang/.codex/hooks.json:session_start:0:0"]` → 确证 HOME 被 init 过
  - `~/.claude/settings.json` 实测**无** spec-first hook（Claude 端本机未被污染，但机制风险同在）
- discovery_methods: `cat`/`grep` 模板与生成配置、`grep` config.toml hooks.state、对比全局 vs 项目脚本的 baked CLI 路径（两者同为 `/opt/homebrew/lib/node_modules/spec-first/bin/spec-first.js`）
- tests_or_logs: 用户提供的 Codex 启动输出（两段相同 SessionStart hook context）
- confidence: 高（根因链逐环源码+config 实证）
- limitations: 未在干净环境复现"HOME init→全局污染→双注入"全过程（依赖用户机现状推断，但链路每环已各自证实）；未核 Codex 是否在某些版本只执行单层 hook（当前 v0.140.0 实测双执行）

---

## Problem Frame

### 根因链

```
用户在 $HOME 跑 spec-first init（把 HOME 当普通项目）
  → projectRoot = ~ ，codex adapter 写 ~/.codex/hooks.json + ~/.codex/hooks/session-start
  → 但 ~/.codex/hooks.json 恰是 Codex CODEX_HOME 全局 hook 发现位置（不是某个项目的）
  → 全局 hook 对所有项目生效，且脚本读 $CODEX_PROJECT_DIR/AGENTS.md
  → 任何带 AGENTS.md 的项目启动 Codex：全局层 SessionStart fire 一次 + 项目层 fire 一次
  → 两段完全相同的注入（双注入）
```

### 缺的是护栏，不是 adapter 正确性

- adapter **设计正确**：只写 `projectRoot` 相对路径，从不主动碰全局。
- 问题在 **init 把 `$HOME` 当成合法 projectRoot**，而 `$HOME/.codex/` 不是"某项目的 .codex"，是 Codex 全局配置目录。spec-first 对这个特殊性**无感知、无护栏**。
- 同理 `$HOME/.claude/` 是 Claude 全局目录——Claude 端有同样的潜在污染风险（本机暂未触发，但机制相同）。

### 为什么影响面值得修

全局 hook 污染不是单仓问题——它让用户**每一个** Codex 项目会话都恒定多注入一段冗余内容。这与 token 注入治理目标同源：每会话恒定浪费。

---

## Goals

- init 在 `canonical(projectRoot/.codex) === canonical(effectiveCodexHome)`（即派生 `.codex` 恰是 Codex 实际读 hook 的位置）时，默认**跳过 SessionStart hook 写入**（仍可装 skills/agents/AGENTS.md）并提示原因——按**派生位置**判定，不按 projectRoot 是否为 HOME。
- doctor 检测 effectiveCodexHome 的 hooks.json 是否含 spec-first SessionStart（用 stale/子串判定，能认出全局裸路径形态），报 advisory + 可执行清理指引（含 state 缺失时的手删兜底）。
- 正常项目 init 收尾顺带检测全局污染并 advisory（高触达兜底）。
- 给用户即时清理路径（clean / 手删），消除当前双注入。
- **Codex 为确证范围**；Claude 端先验证 user+project 是否真双 fire，证实才纳入，证伪只留一般提示（不基于错误类比 over-fix）。

## Non-Goals

- 不改 codex/claude adapter 的 hook 写入路径逻辑（不在 adapter 做去重）。
- 不让 spec-first 接管或"管理" Codex/Claude 的**全局** hook 层（spec-first 是项目级工具）。
- 不自动删除用户全局 hook（doctor 只检测+指引；删除是用户显式动作或 `clean` 的既有职责）。
- 不改 SessionStart hook 脚本本身的注入内容（它单次注入是对的，问题是被注册两次）。
- 不引入新的 CLI 命令或新 schema。

---

## Key Technical Decisions

> 以下 KTD 已按第二轮多视角审查（对抗 reviewer P0/P1/P2）重写。原始版本的护栏判据从根上用错了等价类，记录于此以警示。

1. **拦截点在 init 的 projectRoot 解析后，而非 adapter。**
   根因是"某目录被当项目，而它的 `.codex` 恰好是 Codex 全局 hook 位置"。最早可拦截处是 init 确定 `projectRoot` 之后（实测在 `init.js:500-556` target collection / `:758-789` buildInitPlan，**非**原计划写的 :420-610）、写 runtime 之前。

2. **（P0 重写）判据 = 派生位置比较，不是 projectRoot 身份比较。**
   原计划判 `projectRoot === os.homedir()` 是**错的等价类**：`grep CODEX_HOME src/ templates/` 零命中，adapter 永远写 `<projectRoot>/.codex/hooks.json`，而 Codex 实际读的是 `$CODEX_HOME/hooks.json`（默认 `~/.codex`）。污染的**充要条件**是：
   ```
   canonical(path.join(projectRoot, '.codex')) === canonical(effectiveCodexHome)
   其中 effectiveCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
   ```
   - CODEX_HOME 被 env 改走时：在 `$HOME` init 写的 `~/.codex/hooks.json` Codex 根本不读（不污染），原判据会**误报**；真正污染的目录（使 `.codex` 落到改后的 CODEX_HOME）原判据会**漏拦**。
   - `projectRoot === homedir()` 仅作附带 UX 提示，**不作污染判据**。

3. **（P2，先验证再定形）护栏形态取决于"是否真有人想全局装"。**
   全局装一个读 `$CODEX_PROJECT_DIR/AGENTS.md` 的 SessionStart hook，对每个项目重复项目级已做的事，**几乎无合理用例**。因此优先方案是 **U1 直接"全局目录跳过 hook 写入 + 提示"**（仍允许装 skills/agents/AGENTS.md），砍掉"知情确认 / `--allow-global` / 非交互拒绝"三套交互逻辑——范围减半且更治本（连"用户误确认"都没有）。仅当实现期发现确有合理全局用例，才回退到"知情确认 + 覆盖 flag"。**hook 写入与 skills/agents 写入分别处理**：跳过的是 hook，不是整个 init。

4. **（P1 重写）doctor/检测的全局 scope 判定用 effectiveCodexHome 派生路径 + stale/子串判定，不是当前 projectRoot exact。**
   现有 `isManagedSessionStartHook`/`isCurrentManagedSessionStartEntry`（`codex.js:653,600`）都用 `projectRoot` 派生 exact command 比较；doctor 在某项目里跑时 projectRoot≠`~`，去比全局裸路径 entry **必然 miss**。能跨 scope 命中的是 `isStaleManagedSessionStartCommand`（`codex.js:674`，子串 `.includes('.codex/hooks/session-start')` 判定，实测对裸路径返回 true）。U2 必须显式用 effectiveCodexHome 派生路径 + stale 判定，并加测试断言"stale 格式（裸路径、无 commandWindows）的全局 entry 必须被报出"——这正是本机实际命中的形态。只读不改，不自动删。

5. **（P1 重写）护栏只加在 init 写入侧；clean/doctor 在全局目录运行不得被同一护栏拦截。**
   这是 U1↔U3 的自相矛盾点：clean 现在能清全局误装，恰恰**因为它没有护栏**（`clean.js:56` 读 state→strip）。若实现者把 U1 护栏"对称"抄到 clean，会打死官方清理路径。必须显式写死：护栏是**写入侧**单向的。另：clean 依赖 `~/.codex/spec-first/state.json` 存在（`clean.js:62` legacy/缺失分支会拒绝），故文档兜底必须同时给"手删 `~/.codex/hooks.json` SessionStart entry"这条不依赖 state 的最终路径。

6. **（P0 Claude，降级为待验证）Claude 端是未经验证的类比，不当既定事实。**
   `claude-settings.js:8` hook command = `"$CLAUDE_PROJECT_DIR"/.claude/...`（项目相对），与 Codex 全局裸绝对路径机制**根本不同**；本机 `~/.claude/settings.json` 无该 hook。Claude 是否会 user+project 双 fire SessionStart **无证据**。先做 fresh 验证（读 Claude settings 合并语义或实测）：证实才做对称护栏；**证伪则 Claude 端只保留"全局 settings 影响所有项目"的一般提示**，不宣称修了不存在的双注入。违反"可验证事实优先于模型猜测"的是原计划，不是本 KTD。

---

## System-Wide Impact

| 真相源 | 改动 | 提交? | 下游影响 |
|---|---|---|---|
| **新增 `src/cli/helpers/global-config-dir.js`（U0）** | `effectiveCodexHome()` + `isCodexHomeProjectRoot()` 派生位置判据 | ✅ source | init/doctor/clean 唯一判据真相源 |
| `src/cli/commands/init.js`（U1+U2b） | 命中时跳过 hook 写入（保留 skills/agents）；正常 init 收尾全局污染 advisory | ✅ source | 所有 `init` 调用 |
| `src/cli/commands/doctor.js`（U2） | 新增全局污染检测 check（stale/子串判定，非 projectRoot exact） | ✅ source | `doctor` 输出；需**新建** doctor 单测 |
| `src/cli/commands/clean.js`（U3） | 核实清理 + 写死"护栏不挡 clean" | ✅ source | `clean` 行为 |
| `tests/unit/`（init / **新建 doctor** / clean / global-config-dir） | 护栏 + stale 检测 + state-gated + 反护栏断言 | ✅ source | 防回归 |
| `CHANGELOG.md`、`docs/05-用户手册`（FAQ + 手删兜底） | 记录 + 排查指引 | ✅ source | 用户可见 |
| **Claude 端（待验证后定）** | KTD#6：先验证 user+project 是否双 fire；证实才纳入 init/doctor | ⏸ 前置验证 | 不基于错误类比 over-fix |

受影响人群：所有使某目录 `.codex` 落到 CODEX_HOME 而被误装的 Codex 用户（存量）+ 未来所有 init 用户（防护）。无外部 API/CLI 契约破坏。

---

## Implementation Units

### U1. init 在"派生 .codex 落到 CODEX_HOME"时跳过 hook 写入（默认形态）

**Goal**：当 `init` 的 `projectRoot` 使其 `.codex/` 恰好落到 Codex 实际读 hook 的 CODEX_HOME 目录时，**不写 SessionStart hook**（仍可装 skills/agents/AGENTS.md），并提示原因。根因拦截、防止再次污染全局。

**Requirements**：根因拦截。

**Dependencies**：U0（全局路径判定 helper，见下新增）。

**Files**：
- `src/cli/commands/init.js`（`projectRoot` 最终确定后、写 runtime 前——实测 `:758-789` buildInitPlan / `applyInitPlan` 前）
- `src/cli/init-i18n.js`（提示文案 zh/en）

**Approach（P0/P2 重写后）**：
- **判据（P0）**：用 U0 helper 计算 `effectiveCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')`；命中条件 = `canonical(path.join(projectRoot, '.codex')) === canonical(effectiveCodexHome)`。**不**用 `projectRoot === homedir()`。
- **形态（P2，默认）**：命中时跳过 hook 写入步骤（hooks.json + session-start 脚本），保留 skills/agents/AGENTS.md 写入；打印提示"此目录的 `.codex` 是 Codex 全局 hook 位置，跳过 SessionStart hook 安装以避免对所有项目双注入"。
- **不引入** `--allow-global`/确认/非交互拒绝三套逻辑，除非实现期证实有合理全局 hook 用例（KTD#3）。
- 未命中：行为完全不变（正常项目零影响）。

**Patterns to follow**：`init.js` 现有 plan 构造与 i18n 文案；hook 写入步骤的现有开关点（`buildRuntimeHookWriteOperations`，`adapters/codex.js`）。

**Test scenarios**：
- `path.join(projectRoot,'.codex') === effectiveCodexHome`（默认 HOME 场景） → 不写 hooks.json/session-start，但 skills/agents/AGENTS.md 仍写。
- `CODEX_HOME` env 改到别处、`projectRoot=$HOME` → **不**命中（因 `~/.codex` 此时不是 Codex 读取位置）→ 正常写（负向，确认不误报）。
- `CODEX_HOME` env 改到 `/work/codex`、`projectRoot=/work` → 命中 → 跳过 hook（确认按派生位置而非 HOME 身份）。
- 普通项目目录 → 不命中，init 正常（负向）。
- Covers 根因：断言命中目录时不产出 `<projectRoot>/.codex/hooks.json` 的 SessionStart entry。

**Verification**：`npx jest init-dry-run init-plan` + 新增判据测试通过；`npm run typecheck`；tmp 目录 + 改 CODEX_HOME env 模拟命中/未命中两侧。

---

### U0. 新增 effectiveCodexHome / 全局 hook 位置判定 helper（U1/U2/U3 共用）

**Goal**：单一 helper 计算"projectRoot 的 .codex 是否落到 Codex 实际 CODEX_HOME"，供 init/doctor/clean 复用，避免三处各写一份判据而漂移（实测无现成 helper，`developer.js` 的 `getGlobalDeveloperPath` 只管 `.spec-first/.developer`）。

**Requirements**：P0 判据的唯一真相源。

**Dependencies**：无（最先做）。

**Files**：
- 新增 `src/cli/helpers/global-config-dir.js`（或就近），导出 `effectiveCodexHome()`、`isCodexHomeProjectRoot(projectRoot)`，canonical 化路径比较。

**Approach**：
- `effectiveCodexHome()` = `process.env.CODEX_HOME` 若设置否则 `path.join(os.homedir(), '.codex')`，`fs.realpathSync` 容错 canonical。
- `isCodexHomeProjectRoot(projectRoot)` = `canonical(path.join(projectRoot, '.codex')) === canonical(effectiveCodexHome())`。
- Claude 等价物**暂不实现**（KTD#6 待验证后再定）。

**Test scenarios**：默认/改 env/不存在路径三态；Windows `USERPROFILE` + `CODEX_HOME` 覆盖。

**Verification**：helper 单测通过；跨平台路径用例覆盖。

---

### U2. doctor 加跨 scope 重复 SessionStart 检测

**Goal**：doctor 发现全局 + 项目级**都**注册 spec-first SessionStart 时报 advisory 并给清理指引。

**Requirements**：存量已污染用户的自查兜底。

**Dependencies**：U0（effectiveCodexHome helper）。

**Files**：
- `src/cli/commands/doctor.js`（新增 check，实测结构在 `:414-463` common_checks/platform_checks，每 check = `{level,name,message,fix?}`）
- 复用 U0 helper
- 注意：实测**当前无 doctor 单测文件**，需新建 `tests/unit/doctor-*.test.js`

**Approach（P1 重写后）**：
- 读 `effectiveCodexHome()/hooks.json`（**不是**写死 `~/.codex`）与当前项目 `.codex/hooks.json`。
- **检测口径（P1 关键）**：全局那份的 command 是 home-rooted 裸路径，与当前 projectRoot 派生 exact command **不相等**——不能用 `isCurrentManagedSessionStartEntry`。必须用 `isStaleManagedSessionStartCommand`（`codex.js:674`，子串 `.includes('.codex/hooks/session-start')` + 程序位判定，实测对裸路径返回 true）或等价的 effectiveCodexHome 派生路径子串判定。
- 全局含 spec-first SessionStart → advisory check：`message`="检测到 Codex 全局 hook 位置（effectiveCodexHome）注册了 spec-first SessionStart，会让所有项目每会话双注入"；`fix`="从 `<effectiveCodexHome>/hooks.json` 移除 spec-first SessionStart entry（全局无其它 hook 可整删），或在该目录运行 `spec-first clean --codex`；若 state 缺失则手删"。
- **Claude 等价物暂缓**（KTD#6 待验证）；本 unit 先只做 Codex。
- 只读不改；不自动删。

**Patterns to follow**：`doctor.js:71-94` 的 check 结构（`name`/`level`/`message`/`fix`）；`inspectManagedClaudeHooks`/`inspectInstructionBootstrap` 的 inspect 返回形态。

**Test scenarios**：
- 模拟全局（effectiveCodexHome）有 **stale 裸路径** SessionStart + 当前项目级也有 → doctor 报 advisory + 含清理指引。**（P1 关键断言：stale/裸路径形态必须被报出——这是本机实际命中的形态，用 projectRoot exact 判定会漏报）**
- 只有项目级 → 不报（负向）。
- 只有全局 → 报 advisory。
- `CODEX_HOME` 改 env → 检测跟随 effectiveCodexHome（不写死 `~/.codex`）。
- 断言 check 不修改任何文件（只读）。

**Verification**：新增 doctor 测试通过；`spec-first doctor --codex` 在当前被污染机器上人工确认报出该 advisory（本机全局是裸路径形态）。

---

### U2b. 正常项目 init 收尾加全局污染 advisory（P1，高触达兜底）

**Goal**：把"存量全局污染"的修复触达挂到用户**高频会做**的动作（在正常项目 `init --codex`）上，而非等用户某天想起跑 doctor。

**Requirements**：存量兜底的高触达补充（对抗 reviewer P1：doctor 太被动）。

**Dependencies**：U0、U2（复用检测）。

**Files**：
- `src/cli/commands/init.js`（正常项目 init 成功后的收尾输出）

**Approach**：
- 正常项目（未命中 U1 跳过条件）init 成功后，用 U0/U2 检测逻辑只读检查 effectiveCodexHome 是否有 spec-first 全局 SessionStart；命中则打 advisory（"检测到全局 hook 污染，会导致双注入，建议清理：…"）。
- 只读+提示，**不自动删**（守 Non-Goal）。

**Test scenarios**：
- 正常项目 init + 全局有污染 → 收尾打出 advisory。
- 正常项目 init + 全局干净 → 无额外输出（负向，不打扰）。

**Verification**：init 测试覆盖两态；人工在本机正常项目 init 确认 advisory 出现。

---

### U3. 核实/补全 clean 对全局误装的清理（含 state-gated 失败路径）

**Goal**：用户能用 spec-first 自身清掉 home-init 写的全局 hook；明确护栏不挡 clean。

**Requirements**：提供官方清理路径，呼应 U2 指引。

**Dependencies**：U0。

**Files**：
- `src/cli/commands/clean.js`（实测 `:56` 读 state、缺失/legacy 分支 `:62` 会拒绝）
- 相关 clean 测试

**Approach（P1 重写后）**：
- 核实：在 effectiveCodexHome 对应目录运行 `clean --codex`，当 `~/.codex/spec-first/state.json` **存在**时能 strip 全局 stale hook（本机大概率成立——state 存在 + 全局裸路径命中 `isStaleManagedSessionStartCommand`）。
- **（P1 反自相矛盾，硬约束）**：U1 的写入侧护栏**不得**复制到 clean；clean 在全局目录运行必须照常工作。计划显式写死此边界。
- **（P1 state-gated 失败路径）**：当全局 hook 是更老版本写的、state 缺失或 legacy（`clean.js:62` 拒绝）→ clean 清不掉。此时文档兜底必须给"手删 `<effectiveCodexHome>/hooks.json` 的 SessionStart entry"这条不依赖 state 的最终路径（落到 U4）。
- 不扩展 clean 去碰用户非 spec-first 的全局 hook。

**Test scenarios**：
- 全局 stale hook + state 存在 → `clean` 移除 spec-first SessionStart，保留用户其它 hook。
- 全局 stale hook + **state 缺失/legacy** → `clean` 行为（拒绝/降级）被断言，确认这是已知失败路径（文档给手删兜底）。
- `clean` 不触碰非 spec-first 全局 hook（负向）。
- 断言：clean 无 U1 写入侧护栏（在 effectiveCodexHome 目录仍能运行）。

**Verification**：clean 测试通过；人工在被污染机器（或 tmp 复制）确认清理后双注入消失。

---

### U4. CHANGELOG 与用户手册排查指引

**Goal**：记录变更 + 给用户"Codex SessionStart 双注入"排查指引。

**Requirements**：CLAUDE.md 强制基线（source 变更须更新 CHANGELOG；用户可见追加 `(user-visible)`）。

**Dependencies**：U1-U3。

**Files**：
- `CHANGELOG.md`
- `docs/05-用户手册/04-常见问题.md`（或等价 FAQ：双注入症状 + 根因 + 清理）

**Approach**：
- CHANGELOG compact 条目：init 在"派生 .codex 落到 CODEX_HOME"时跳过 hook 写入、doctor 全局污染检测、init 收尾 advisory、clean 清理路径、Codex（Claude 待验证）；标 `(user-visible)`。
- 用户手册 FAQ 加："Codex 启动出现两段相同 SessionStart 注入 → 根因是在某目录 init 过、其 `.codex` 恰是 Codex 全局 hook 位置（默认 `~/.codex`）→ 用 `spec-first doctor --codex` 确认 → `spec-first clean --codex` 清理；**若 state 缺失 clean 拒绝，则手删 `<CODEX_HOME>/hooks.json` 的 SessionStart entry**（不依赖 state 的最终路径）"。
- 可选提一句 config.toml 残留（`[hooks.state...]`/`[projects."~"]` 不影响双注入，但用户清完仍会看到痕迹）。

**Test scenarios**：
- `npx jest changelog-format` 通过。
- 改用户手册时不破坏 user-manual-hard-constraints 钉死的文件名/字符串。

**Verification**：`npx jest changelog-format`；FAQ 表述与实际 doctor 输出一致。

---

## Sequencing

U0（effectiveCodexHome helper，唯一判据真相源）→ U1（init 命中时跳过 hook 写入）→ U2（doctor 全局污染检测，用 stale 判定）→ U2b（正常项目 init 收尾 advisory）→ U3（clean 清理核实 + 反护栏自相矛盾约束）→ U4（CHANGELOG/FAQ 含手删兜底）。U0 先建判据，U1/U2/U2b/U3 全部复用同一 helper，避免"派生位置比较"在多处漂移——这正是对抗审查指出原判据用错等价类后的统一修复点。

**Claude 端（KTD#6）**作为前置验证插在 U0 之后、并行：先确认 Claude 是否真的 user+project 双 fire SessionStart；证实才把 Claude 纳入 U1/U2，证伪则只在 U4 留一般性提示。

---

## Risks & Mitigations

| 风险 | 缓解 |
|---|---|
| **（P0）护栏判据用错等价类（HOME 身份 vs CODEX_HOME 派生位置）** | U0 helper 统一用 `canonical(projectRoot/.codex)===canonical(effectiveCodexHome)`；读 `CODEX_HOME` env；本风险是对抗审查抓出的原计划根本缺陷，已重写 |
| 默认形态误伤"真心想全局装"的用户 | KTD#3：全局装读 `$CODEX_PROJECT_DIR/AGENTS.md` 的 hook 无合理用例，故默认"跳过 hook 写入"而非阻断整个 init；skills/agents 仍可装；实现期若证实有用例再回退确认形态 |
| 全局路径判定跨平台不准（Windows） | U0 canonical 比较；覆盖 `CODEX_HOME` env、`USERPROFILE`；Windows 路径测试 |
| **（P1）doctor/clean 用 projectRoot exact 判定漏掉全局裸路径 entry** | U2 显式用 `isStaleManagedSessionStartCommand`/effectiveCodexHome 派生子串判定，加"stale 形态必须被报出"断言——本机实际命中的就是裸路径 |
| **（P1）U1 护栏被"对称"抄到 clean，打死清理路径** | KTD#5/U3 硬约束：护栏单向，只加写入侧；clean/doctor 在全局目录必须照常工作；加断言 |
| **（P1）clean 依赖 state，老版本/state 缺失时清不掉** | U3 测试覆盖 state-gated 失败路径；U4 给"手删 hooks.json entry"不依赖 state 的最终兜底 |
| **（P0 Claude）把未验证的 Claude 双注入当既定事实** | KTD#6：Claude 机制不同（`$CLAUDE_PROJECT_DIR` 相对），先验证再决定；证伪则只留一般提示，不宣称修了不存在的问题 |
| 改 init/doctor 触碰双 host 生成一致性 | 双 host 各自测试；`release-dual-host-governance.sh` 把关 |
| 仅修产品但用户存量仍双注入 | U2 doctor + **U2b 高触达 init 收尾 advisory** + U3 clean + U4 FAQ（含手删兜底）；closeout 明确指引用户在本机执行 |

---

## Assumptions

- Codex v0.140.0 会同时执行全局层 + 项目层 SessionStart hook（用户输出实证；不同 Codex 版本行为可能不同，但护栏对所有版本都正确——避免写全局总是更安全）。
- `~/.codex/hooks.json` 是 Codex CODEX_HOME 的全局 hook 发现位置（`adapters/codex.js:17` 注释 + 用户环境行为一致）。
- 用户的全局那份确由 home-init 产生（`config.toml:69,184` 实证），非手工或其它工具写入。

## Deferred to Implementation

- 是否真有合理"全局装 Codex hook"用例——实现期确认。若无（预期），U1 保持"跳过 hook 写入"默认形态，**不引入** `--allow-global`；若有，才设计覆盖 flag。
- doctor 全局检测是否需要在**任意**项目都扫全局（建议是，因全局影响所有项目），还是仅 `--codex` 时——实现时按 doctor 现有 platform check 分组定。
- U3 是验证即可还是需补代码——取决于实现时核实 clean 现状。

## Relationship to Other Plans

独立于 `2026-06-16-002`（路由阈值）。两者都服务"减少不合理/冗余注入"的大目标，但机制不同：002 改路由措辞（减少不必要触发），本计划修全局 hook 双注入（消除恒定冗余注入）。可独立实现，无顺序依赖。
