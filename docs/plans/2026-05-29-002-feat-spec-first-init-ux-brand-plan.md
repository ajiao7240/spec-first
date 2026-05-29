---
title: "feat: spec-first init UX & brand polish"
type: feat
status: completed
date: 2026-05-29
spec_id: 2026-05-29-002-spec-first-init-ux-brand
origin: docs/brainstorms/2026-05-29-002-spec-first-init-ux-brand-requirements.md
---

# feat: spec-first init UX & brand polish

## Summary

本计划为 `spec-first init`、`spec-first -v` 与 postinstall 三处入口实现统一品牌体验：提取单一来源的品牌模块（ASCII art + 颜色主题），完成 init 全部 prompt 的本地化，增加按键提示与多选反馈，本地化并着色 preview，修复版本 banner 对齐，统一 postinstall 品牌展示。所有展示层改动不触碰 init 的落盘逻辑与产物结构。

## Completion Evidence

Completed on 2026-05-29.

Implemented:

- 新增 `src/cli/brand.js`，统一 `spec-first init`、`spec-first -v` 与 `bin/postinstall.js` 的品牌 art / wordmark / ANSI 颜色降级。
- 新增 `src/cli/init-i18n.js`，将 init prompt、hint、确认/取消与 preview 文案集中到 zh/en 消息表。
- 扩展 `src/cli/prompts/index.js`，为 select/checkbox 增加 hint，为 checkbox 增加 minSelected 可见错误反馈。
- 更新 `src/cli/commands/init.js`，支持首次/重复 init banner、active language 一致性、preview 本地化与语义色、next-step 文案 polish。
- `$spec-code-review` 发现的两个问题已修复：交互中选择语言后的后续 prompt 统一使用 active language；从已初始化 repo 子目录运行时按 git root 检测 managed state。

Verification run:

- `node --check src/cli/brand.js`
- `node --check src/cli/init-i18n.js`
- `node --check src/cli/prompts/index.js`
- `node --check src/cli/commands/init.js`
- `node --check src/cli/index.js`
- `node --check bin/postinstall.js`
- `npx jest tests/unit/brand.test.js tests/unit/init-i18n.test.js tests/unit/prompts.test.js --runInBand`
- `npx jest tests/unit/init-interactive.test.js --runInBand`
- `npx jest tests/unit/init-dry-run.test.js --runInBand`
- `npx jest tests/unit/cli-entry-contracts.test.js tests/unit/package-install-contracts.test.js --runInBand`
- `npm run typecheck`
- `npm run test:smoke`

Runtime generated directories: unchanged.

---

## Problem Frame

`spec-first init` 是用户接触框架的核心入口，但其交互层存在五处已验证痛点（见 origin doc）：品牌三套皮且 init 零品牌、语言割裂（中文用户被英文 prompt 包围）、版本 banner 对齐脆弱、交互可发现性弱（无按键提示、无多选最小数量反馈）、preview 机器味英文且全程无色。本次计划只做展示层与品牌层修改，不动底层落盘流程。

---

## Requirements

- R1. 单一来源品牌模块；`init`、`-v`、postinstall 三处共享。
- R2. 完整 art 在首次安装（postinstall）、首次 init（目标无现有 managed state）、版本展示（`-v`）时展示。
- R3. 首次 init 在第一个交互 prompt 之前先展示完整 art。
- R4. 重复运行 init（目标已存在 managed state）时开场降为一行轻量 wordmark。
- R5. init 全部交互 prompt 按当次运行解析出的默认语言（`zh`/`en`）本地化。
- R6. 同一次 init 运行内，所有 prompt、preview、next-step、取消/错误使用同一种语言。
- R7. 单选与多选 prompt 渲染时附带按键操作提示，提示文案随当次语言本地化。
- R8. 多选 prompt 在未满足最小选择数量时按回车给出可见反馈，不静默重绘。
- R9. preview 输出按当次语言本地化，并以有层次结构呈现写入/更新/移除/untrack 各动作，含语义色区分。
- R10. next-step 输出按当次语言本地化，带引导语气与清晰层次。
- R11. 版本展示品牌 logo 用计算式 padding，版本号变化时对齐保持稳定。
- R12. 单一来源颜色主题：品牌色（logo/wordmark/tagline）+ 语义色（preview 写入/更新/移除/untrack/次要文本）。
- R13. 颜色可优雅降级：`NO_COLOR` env var / 非 TTY / `TERM=dumb` 时全部退化为纯文本，不泄漏 ANSI 转义序列。
- R14. 着色范围仅限品牌 logo 与 preview；交互 prompt 与 next-step 本次不着色。

**Origin actors:** A1（首次接入开发者），A2（回头重置/修复开发者），A3（自动化/non-TTY 场景）
**Origin flows:** F1（首次安装与首次 init），F2（重复运行），F3（版本展示）
**Origin acceptance examples:**
- AE1（R2, R3, R5, R6）: 中文默认未初始化项目 → 完整 art + 全程中文
- AE2（R2, R4）: 已初始化项目 → 仅出现一行 wordmark
- AE3（R7, R8）: host 多选步骤 → 显示按键提示；零勾选回车 → 可见反馈
- AE4（R5, R6）: 默认语言 `en` → 全部 prompt/preview/next-step 为英文
- AE5（R11）: 长版本号 → logo 对齐不错位
- AE6（R1, R2）: 三处 art 一致
- AE7（R12, R14）: 彩色终端 → logo 品牌色 + preview 语义色，prompt/next-step 不着色
- AE8（R13）: `NO_COLOR=1` 或管道 → 纯文本无转义序列

---

## Scope Boundaries

- 不改变 init 落盘内容与底层流程（runtime asset 同步、managed block、state 文件、SessionStart hook、CHANGELOG bootstrap、.gitignore block、drift 检测等）。
- 不改变 non-TTY 拒绝行为，不新增 CI/自动化品牌通路。
- 不重做 `doctor`、`clean`、`tasks`、`session`、`gitnexus-instruction` 等其他子命令。
- 颜色仅覆盖品牌 logo 与 preview；交互 prompt 与 next-step 不着色。
- 不引入新 npm 运行时依赖；颜色用原生 ANSI 实现，不引入颜色库。
- 不重构 init 的交互骨架（步骤顺序与控件类型不变）。
- ASCII art 字形选择与最终 tagline 文案由实现阶段定稿，本计划只定义模块接口与行为约束。

---

## Graph Readiness

- target_repo: spec-first
- status: stale
- source_revision: fc3d0ca649ee
- current_revision: b37b5d8d4c44
- stale: true（当前 HEAD 比 graph facts 晚若干提交）
- primary_providers: gitnexus
- degraded_providers: none
- fallback_capabilities: bounded direct repo reads（本计划为展示层改动，直接源码读取已足够）
- runtime_mcp_evidence: not-used（展示层改动不需要 impact graph）
- confidence: high（变更面清晰，均为新模块 + 现有函数修改，无跨模块复杂依赖）
- limitations: graph stale，impact 范围通过代码直接读取验证

---

## Context & Research

**现有品牌/版本代码**

- `bin/postinstall.js`: 单线框 `┌─┐`，`ver.padEnd(48)` 半计算式；`版本` 字符串硬编码在框内，整体较短。
- `src/cli/index.js:printVersion()`: 双线框 `╔══╗`，版本号插入模板字符串但右侧是大量硬编码空格（`║   Spec-First v${pkg.version}                                    ║`），版本号长度变化会错位（AE5 问题）。
- `src/cli/commands/init.js:runInit()`: 完全无品牌 banner；直接进入 TTY 检查 → `collectInitInput()`。

**现有 prompt 实现**

- `src/cli/prompts/index.js`: 自研原生 prompt 库；`select`/`checkbox`/`textInput`/`confirm`；完全无按键提示；`checkbox` 的 `minSelected` 未满时仅 `redraw()`，无错误反馈（AE3 问题）。
- `renderSelect`/`renderCheckbox` 只输出问题 + 选项列表，没有任何 hint 行；`lineCount` 精确计算用于清除重绘（修改时需同步更新）。

**现有语言处理**

- `resolveDeveloperDefaults(root)` 已实现 lang fallback 链：`.developer` → `git config`，返回 `{ name, lang }`；lang 只有 `zh`/`en`。
- `printInitNextSteps()` 已有 zh/en 双支路，但 prompt 文案全为英文硬编码。

**First-run 检测机制**

- `buildProjectInitPlan()` 中 `readState(normalizedRoot, adapter)` 成功表示有现有 state（`previousState !== null`）。
- State 文件路径：Claude = `.claude/spec-first/state.json`，Codex = `.codex/spec-first/state.json`（来自 adapter.stateFile）。
- Banner 需要在 `collectInitInput()` 之前展示，此时还不知道用户选的 platform，因此用跨 adapter 的文件存在检查作为 "是否首次运行" 的快速判定：检查两个路径之一存在则为重复运行。

**关键决策**

| 问题 | 决策 | 理由 |
|------|------|------|
| i18n 承载方式 | 轻量 i18n 表（`src/cli/init-i18n.js`）而非 hard-code 双分支 | 字符串多（~15个），双分支散落在多处函数里维护成本高；i18n 表集中管理，可扩展性好，不引入依赖 |
| 按键提示位置 | 渲染在选项列表之后（最后一行），dim 色展示 | 密度低、非干扰，首次用户看得见；不占问题行上方空间 |
| 颜色 ANSI 级别 | 16-color ANSI（31~37, 90, 2m 等），不用 256-color | 兼容面最广；本次着色面仅 logo + preview，复杂度完全够用 |
| ASCII art 宽度策略 | 固定框宽（建议 62 字符），版本行用计算式 padding 填充右边距 | 宽度固定则框字符对齐稳定；仅版本行需要动态 padding，实现简单 |
| postinstall 颜色降级 | 与其他入口使用同一 `detectColorSupport()` 函数，由 `process.stdout.isTTY` + `NO_COLOR` 决定 | npm 子进程通常不是 TTY，自动降级为纯文本，与 R13 一致 |

---

## Key Technical Decisions

- `src/cli/brand.js`: 新增品牌模块，导出 `renderFullArt(version, opts)`、`renderWordmark(version, opts)`、`detectColorSupport()`、颜色常量 `BrandColors`。不依赖任何新 npm 包。
- `src/cli/init-i18n.js`: 新增 init 专用 i18n 表，导出 `getInitMessages(lang)` 返回该语言的全部 prompt/preview/hint 文案。
- `src/cli/prompts/index.js`: 在 `renderSelect` / `renderCheckbox` 加 `hint` 选项（字符串），渲染为最后一行；`checkbox` 加 `errorMessage` 内部状态，`minSelected` 未满回车时设错误、重绘，`renderCheckbox` 显示错误行；`lineCount` 需同步调整。
- 语言解析前置：`runInit()` 在 `collectInitInput()` 前调用 `resolveDeveloperDefaults(process.cwd()).lang` 得到 `defaultLang`，用于全部 prompt 文案和 banner hint。
- First-run 检测前置：`runInit()` 在 banner 展示前调用 `hasAnyManagedState(process.cwd())` 检查 `.claude/spec-first/state.json` / `.codex/spec-first/state.json` 是否存在，决定显示 full art 还是 wordmark。
- 颜色作用域限定：`renderFullArt`/`renderWordmark` 内部处理颜色；`printInitDryRun()` 接受颜色选项；`renderSelect`/`renderCheckbox` 的 hint 行用 dim 色；prompt 主体和 next-step 不着色（R14）。
- `printInitDryRun()` 新增 `lang` 参数，取 i18n 消息；新增 `useColor` 参数，控制语义色输出。

---

## High-Level Technical Design

*以下为方向性说明，非实现规格。*

**brand.js 接口草图**

```
renderFullArt(version, { useColor })
  → 返回多行字符串，含 ASCII art 框、wordmark、version 行（计算式 padding）、tagline

renderWordmark(version, { useColor })
  → 返回单行字符串：`spec-first v{version}`（或带简单前缀）

detectColorSupport()
  → 检查 NO_COLOR env var（存在 → false）、FORCE_COLOR（存在 → true）、stdout.isTTY（false → false）、TERM=dumb（→ false）
  → 返回 boolean

BrandColors = {
  brand: '\x1b[36m',     // cyan — logo/wordmark/tagline
  write: '\x1b[32m',     // green — write/update actions
  remove: '\x1b[31m',    // red — remove actions
  untrack: '\x1b[33m',   // yellow — untrack actions
  secondary: '\x1b[2m',  // dim — hints, secondary text
  reset: '\x1b[0m',
}
```

**版本 banner 对齐示例（方向参考）**

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   spec-first v{version}         {computed padding}            ║
║   AI 辅助工程框架 — Claude Code & Codex                        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

内框宽 W 固定；版本行内容长度 `len = "   spec-first v".length + version.length`；右填充 = `W - len - 1`；不出现硬编码空格串。

**Checkbox 多选反馈渲染流程**

```
[error 初始为 '']
用户按 ↩ 且 checkedCount < minSelected:
  error = getInitMessages(lang).minSelectedError(minSelected)
  redraw()
renderCheckbox:
  if error: 输出 `  ⚠ {error}` 行（dim 色），lineCount += 1
```

---

## Implementation Units

### U1. 品牌与颜色模块

**Goal:** 建立单一来源品牌模块，统一提供 ASCII art 渲染、wordmark 渲染、颜色检测与颜色主题，供 init、`-v`、postinstall 共享使用。

**Requirements:** R1, R2, R11, R12, R13

**Dependencies:** 无（基础模块）

**Files:**
- `src/cli/brand.js`（新建）
- `tests/unit/brand.test.js`（新建）

**Approach:**
- 导出 `detectColorSupport()`: 检查 `NO_COLOR`（存在即 false）→ `FORCE_COLOR`（存在即 true）→ `process.stdout.isTTY`（非 TTY 即 false）→ `TERM === 'dumb'`（即 false）→ true。
- 导出 `BrandColors` 对象：brand（cyan 36）、write（green 32）、remove（red 31）、untrack（yellow 33）、secondary（dim 2）、reset（0）；值均为 ANSI 16-color escape。
- 导出 `colorize(text, colorCode, useColor)` helper：useColor 为 false 时直接返回 text，否则包裹 `{colorCode}${text}\x1b[0m`。
- 导出 `renderFullArt(version, opts = {})`: opts 含 `useColor`（默认 `detectColorSupport()`）。Art 框宽度固定（实现时选择 64 字符等），version 行用计算式 padding（`' '.repeat(innerWidth - prefix.length - version.length - 1)`）确保右边框对齐。返回完整字符串（末尾含 `\n`），品牌色由 useColor 控制。
- 导出 `renderWordmark(version, opts = {})`: 返回单行 `spec-first v${version}` 或类似轻量格式，同样支持颜色。

**Patterns to follow:**  `src/cli/index.js:printVersion()` 的当前双线框结构作为起点，改为计算式 padding 实现。

**Test scenarios:**
- `detectColorSupport()` 在 `NO_COLOR=1` 时返回 false
- `detectColorSupport()` 在 `FORCE_COLOR=1` 时返回 true，即使非 TTY
- `detectColorSupport()` 在非 TTY（`isTTY=undefined`）时返回 false
- `colorize(text, colorCode, false)` 返回原始 text（无 ANSI 序列）
- `colorize(text, colorCode, true)` 返回包含 ANSI 序列的字符串，且以 `\x1b[0m` 结尾
- `renderFullArt('0.1.0', { useColor: false })` 不含 ANSI 转义序列
- `renderFullArt('0.1.0', { useColor: false })` 与 `renderFullArt('0.99.0-beta.10', { useColor: false })` 右边框列位置相同（对齐稳定，覆盖 AE5）
- `renderWordmark('1.0.0', { useColor: false })` 返回单行字符串（不含换行符数 > 1）
- `renderFullArt` 和 `renderWordmark` 在 `useColor: true` 时的输出在 `NO_COLOR` 测试环境下不主动调用 `detectColorSupport()`（可注入 useColor）

**Verification:** `node --check src/cli/brand.js` 通过；`npm run test:unit` 中 brand.test.js 全绿。

---

### U2. Init 首次/重复运行品牌 banner

**Goal:** 在 `runInit()` 中，先于所有交互 prompt 展示品牌 banner；首次运行（无现有 managed state）显示完整 art，重复运行降级为一行 wordmark。

**Requirements:** R2, R3, R4

**Dependencies:** U1（brand 模块）；需先有 `hasAnyManagedState`（本单元新增）

**Files:**
- `src/cli/commands/init.js`（修改：`runInit()`，新增 `hasAnyManagedState` helper）
- `tests/unit/init-interactive.test.js`（修改：新增 banner 相关场景）

**Approach:**
- 在 `runInit()` 的 `collectInitInput()` 调用前（在 TTY check 通过后），新增：
  1. `const defaultLang = resolveDeveloperDefaults(process.cwd()).lang;`（已有函数）
  2. `const isFirstRun = !hasAnyManagedState(process.cwd());`
  3. 若 `!parsed.yes` 且当前 stdout 是 TTY（`process.stdout.isTTY`）：输出 `renderFullArt` 或 `renderWordmark`
- `hasAnyManagedState(root)` helper：检查 `path.join(root, '.claude/spec-first/state.json')` 或 `path.join(root, '.codex/spec-first/state.json')` 是否存在（`fs.existsSync`），任一存在返回 true。
- 在 `-y` 模式下不输出 banner（非交互场景不刷屏）。
- `defaultLang` 同时传递给 U3 的 i18n 初始化，统一在这一步完成（避免重复调用 `resolveDeveloperDefaults`）。

**Patterns to follow:** TTY check 已在 `runInit()` line 108 附近，banner 插入紧跟其后。

**Test scenarios:**
- 无任何 managed state 时，stdout 捕获到包含完整 art 内容（多行）的输出，覆盖 AE1/AE2
- 已存在 `.claude/spec-first/state.json` 时，输出仅包含 wordmark 单行，不含完整 art，覆盖 AE2
- `-y` 模式下，stdout 无 banner 输出（非 TTY 路径不应出现转义序列）
- 非 TTY 环境（promptApi.requireTty 返回 ok: false）时，banner 不输出，已有拒绝逻辑不变

**Verification:** `npm run test:unit -- init-interactive` 通过；手动在空项目运行 `spec-first init` 看到完整 art，已初始化项目看到 wordmark。

---

### U3. Init prompt 本地化（i18n 表）

**Goal:** 将 init 全部交互 prompt 文案集中到轻量 i18n 表，按解析出的默认语言（zh/en）提供，消除中英混杂（AE1, AE4）。

**Requirements:** R5, R6

**Dependencies:** 无（独立模块；U2 先解析 defaultLang，U3 消费该 lang）

**Files:**
- `src/cli/init-i18n.js`（新建）
- `src/cli/commands/init.js`（修改：所有硬编码英文 prompt 字符串替换为 i18n 消息）
- `tests/unit/init-i18n.test.js`（新建）

**Approach:**
- `init-i18n.js` 导出 `getInitMessages(lang)` 函数，`lang` 为 `'zh'` 或 `'en'`（其他值 fallback 到 `'zh'`）。
- 返回对象包含所有 init 相关字符串，涵盖：
  - `selectHosts`（host 多选问题）
  - `developerName`（name 输入）
  - `languageSelect`（语言选择问题）
  - `workspaceTarget`（workspace 目标选择问题）
  - `workspaceAllRepos(count)`（所有子仓库 label）
  - `workspaceCancel`（取消 label）
  - `globalProfileOverwrite(display)`（全局 profile 覆盖确认）
  - `confirmApply`（确认应用更改）
  - `cancelled`（取消提示 `已取消。` / `Cancelled.`）
  - `nameRequired`（name 必填验证错误）
  - `minSelectedError(n)`（多选最小数量错误，供 U4 使用）
- `src/cli/commands/init.js` 中，`runInit()` 起始解析 `defaultLang`，传给 `collectInitInput()`；`collectInitInput()` 调用 `getInitMessages(lang)` 后用消息对象中的字符串替换所有硬编码英文问题。
- `printInitApplySuccess()` / `printInitNextSteps()` 等函数已有 lang 参数，复用；`confirm` 提示也本地化（R6 全运行内一致语言）。

**Patterns to follow:** `printInitNextSteps()` 已有 zh/en 双支路作为参考；本单元将 inline 双支路提取为 i18n 表。

**Test scenarios:**
- `getInitMessages('zh').selectHosts` 返回中文字符串（不含英文大写字母 Select/Host 等）
- `getInitMessages('en').selectHosts` 返回英文字符串
- `getInitMessages('invalid')` fallback 到 zh
- `getInitMessages('zh')` 和 `getInitMessages('en')` 的键集合完全相同（全量覆盖，覆盖 AE4）
- `getInitMessages('zh').minSelectedError(1)` 包含数字 1 且包含中文说明
- 集成：captureInit + promptOverrides 设 lang='en' → stdout 中 prompt 问题为英文，无中文 prompt 字符串（覆盖 AE4）

**Verification:** `npm run test:unit -- init-i18n` 通过；`npm run typecheck` 通过。

---

### U4. Prompt 按键提示与多选最小数量反馈

**Goal:** 为 `select` 和 `checkbox` prompt 增加按键操作提示行，为 `checkbox` 增加未满最小数量时的可见错误反馈（AE3）。

**Requirements:** R7, R8

**Dependencies:** 无（独立对 prompts/index.js 的修改；init.js 传入 hint 字符串来自 U3 i18n 表）

**Files:**
- `src/cli/prompts/index.js`（修改：`renderSelect`、`renderCheckbox`、`checkbox` 函数逻辑）
- `tests/unit/prompts.test.js`（修改：新增按键提示与多选反馈场景）

**Approach:**
- `select(question, options, promptOptions)`: `promptOptions` 新增可选 `hint` 字段（字符串）；`renderSelect` 若 `promptOptions.hint` 存在，在所有选项后额外输出一行 `  ${hint}\n`，`lineCount += 1`。
- `checkbox(question, options, promptOptions)`:
  - `promptOptions` 新增可选 `hint` 字段。
  - 新增内部变量 `errorMessage = ''`；在 `\r`/`\n` 分支，若未满 `minSelected`，设 `errorMessage = promptOptions.onMinError ? promptOptions.onMinError(minSelected) : 'Select at least ${minSelected}'`，然后 `redraw()` 返回（不 resolve）。
  - `renderCheckbox` 在选项列表后，若 `hint` 存在输出 hint 行；若 `errorMessage` 存在输出错误行（`  ⚠ ${errorMessage}`）；`lineCount` 相应 +1/+2。
  - 当用户再次操作（箭头/空格）时清除 errorMessage（防止过期错误残留）。
- hint 文案由调用方（init.js）通过 `promptOptions.hint` 和 `promptOptions.onMinError` 传入（来自 U3 i18n 表），prompt 模块本身不硬编码任何文案。
- `lineCount` 必须精确（影响清除重绘逻辑），修改时需仔细计算。

**Patterns to follow:** 现有 `renderSelect` / `renderCheckbox` 的 `lineCount` 计算模式；`textInput` 的错误处理（`write(output, \`\n${validation}\n\`)` 后 `redraw()`）作为参考。

**Test scenarios:**
- `renderSelect` 传入 `hint='↑↓ move'` 时输出包含该 hint 行，`lineCount` 为 `options.length + 2`
- `renderSelect` 不传 `hint` 时 `lineCount` 为 `options.length + 1`（无回归）
- `checkbox` 在 `minSelected=1` 且零勾选时按回车：不 resolve，输出包含错误行（覆盖 AE3）
- `checkbox` 在 `minSelected=1` 且零勾选时按回车后，用户按空格勾选一项再回车：正常 resolve（错误清除后可继续）
- `checkbox` 的错误行在用户按方向键后被清除（errorMessage 清零触发 redraw 不含错误行）
- 无 `minSelected` 或 `minSelected=0` 时零勾选回车正常 resolve（无回归）
- `renderCheckbox` 传入 hint 和 errorMessage 时 `lineCount` 为 `options.length + 3`

**Verification:** `npm run test:unit` 无回归；AE3 场景手动验证（零勾选回车 → 出现可见反馈）。

---

### U5. Preview 本地化与语义色

**Goal:** 将 `printInitDryRun()` 和相关 preview 函数本地化（zh/en），并为写入/更新/移除/untrack 添加语义色（AE7, AE8）。

**Requirements:** R9, R13, R14

**Dependencies:** U1（brand/颜色）、U3（i18n，preview 消息加入 i18n 表）

**Files:**
- `src/cli/commands/init.js`（修改：`printInitDryRun()`、`printInitPreviews()`、`printInitPreview()`）
- `src/cli/init-i18n.js`（修改：补充 preview 相关消息键）
- `tests/unit/init-interactive.test.js`（修改：补充 preview 语言和颜色场景）

**Approach:**
- `printInitDryRun()` 新增参数 `lang`（默认 `'zh'`）和 `useColor`（默认 `false`，由调用方传入）。
- 从 `getInitMessages(lang)` 取 preview 相关消息：`previewWouldRemove(n)`、`previewWouldWrite(n)`、`previewWouldPrune(n)`、`previewWouldEnsureDir(n)`、`previewWouldUntrack(n)`、`previewDryRunHeader`、`previewNoFilesChanged`、`previewHardResetLegacy`、`previewHardResetDrift` 等。
- 在消息中加语义色：写入/更新动作的计数部分用 `colorize(String(n), BrandColors.write, useColor)`；移除动作用 `BrandColors.remove`；untrack 用 `BrandColors.untrack`。
- `printInitPreviews()` 接收 `lang` 和 `useColor` 后向下传递。
- `runInit()` 中，`printInitPreviews(plans, { lang: defaultLang, useColor: detectColorSupport() })` 调用传递这两个参数。
- Workspace preview 相关 `console.log` 语句（`printWorkspaceInitApplySuccess` 中）本次不做语言切换（scope boundary：workspace 模式英文消息），仅做 preview dry-run 的本地化。

**Test scenarios:**
- `lang='zh'` 时 `printInitDryRun` 输出包含中文 "移除" 而非 "remove"
- `lang='en'` 时输出包含英文 "remove"（覆盖 AE4）
- `useColor=false` 时输出不含 ANSI 转义序列（覆盖 AE7/AE8）
- `useColor=true` 时输出写入/更新计数部分包含绿色 ANSI，移除部分包含红色 ANSI（AE7）
- `NO_COLOR=1` 下 `detectColorSupport()` 返回 false → preview 输出纯文本（AE8，通过环境变量注入）
- 零操作计划（write/remove 都为 0）的输出无语义色标记（无回归）

**Verification:** `npm run test:unit` 通过；手动运行 `spec-first init` → preview 中文 + 语义色。

---

### U6. Next-step 文案润色

**Goal:** 改进 `printInitNextSteps()` 和 `printInitNextStepsForPlatforms()` 的引导语气与层次感（R10）；语言分支已有，润色中英文文案。

**Requirements:** R10

**Dependencies:** U3（i18n 表已完成；next-step 文案可合并进 i18n 表或保留现有函数内直接改写）

**Files:**
- `src/cli/commands/init.js`（修改：`printInitNextSteps()`、`printInitNextStepsForPlatforms()`）

**Approach:**
- 改进中文版本文案：添加引导语气（例如首行加 `🎉 初始化完成！`），将 5 条编号步骤重组为有层次的结构（先关键步骤：重启宿主；次高优先级：按用途选 workflow；最后：可选增强如 mcp-setup/graph-bootstrap）。
- 改进英文版本（lang='en'）同步。
- 文案改动不影响 next-step 的信息完整性（重启、workflow 入口、mcp-setup、graph-bootstrap 都保留）。
- 若将消息提取到 i18n 表，在 U3 阶段补充；否则直接改函数内容。

**Test scenarios:**
- lang='zh' 时 `printInitNextSteps('claude', 'zh')` 输出包含 "重启" 关键词（核心步骤不丢失）
- lang='en' 时输出包含 "Restart" 关键词
- 双 platform（claude + codex）场景 `printInitNextStepsForPlatforms(['claude','codex'], 'zh')` 输出包含两个 platform 名称（覆盖多 platform 场景，无回归）

**Verification:** `npm run test:unit` 通过；文案结构人工确认。

---

### U7. 版本 banner 对齐修复

**Goal:** 用 U1 的 `renderFullArt` 替换 `printVersion()` 中的硬编码双线框，实现计算式对齐，消除版本号长度导致的错位（AE5, AE6）。

**Requirements:** R2, R11

**Dependencies:** U1（renderFullArt 已实现）

**Files:**
- `src/cli/index.js`（修改：`printVersion()` 函数）
- `tests/unit/index.test.js`（若已存在则补充；若不存在则创建最小测试）

**Approach:**
- `printVersion()` 改为：读取 `pkg.version` → 调用 `renderFullArt(pkg.version, { useColor: detectColorSupport() })` → 输出到 `console.log`。
- "快速上手" 文案（步骤列表）保留，直接跟在 art 后面输出（不作为 art 的一部分）。
- 删除旧的硬编码双线框字符串。

**Test scenarios:**
- `printVersion` 调用后输出不含硬编码空格串（即不出现超过 5 个连续空格，版本行之外）
- `renderFullArt('0.0.1', { useColor: false })` 与 `renderFullArt('99.99.99', { useColor: false })` 的每行字符长度相等（对齐稳定，覆盖 AE5）

**Verification:** `spec-first --version` 输出对齐正确（手动用 0.x.y 和 0.xx.yy 等不同长度版本号验证）。

---

### U8. Postinstall banner 统一

**Goal:** 将 `bin/postinstall.js` 的品牌展示替换为 U1 的 `renderFullArt`，实现三处品牌视觉一致（AE6）。

**Requirements:** R1, R2

**Dependencies:** U1

**Files:**
- `bin/postinstall.js`（修改）

**Approach:**
- 替换当前 `┌─┐` 单线框输出为 `renderFullArt(pkg.version, { useColor: detectColorSupport() })`。
- "下一步" 提示文案（`spec-first doctor` 等）保留，跟在 art 后输出。
- 注意：postinstall 在 `npm install` 子进程下运行，`process.stdout.isTTY` 通常为 undefined（管道），`detectColorSupport()` 会返回 false，自动降级为纯文本（满足 R13）。

**Test scenarios:**
- `bin/postinstall.js` 的 `process.stdout.write` 输出（或重定向 stdout）在模拟非 TTY 环境下不含 ANSI 序列（AE8 postinstall 路径）
- `Test expectation: none --` 对 postinstall 无自动化交互测试，由 smoke test（`npm run test:smoke`）中 postinstall 的输出包含版本字符串验证基本功能

**Verification:** `npm run test:smoke` 通过；`node bin/postinstall.js` 在 TTY 终端手动确认品牌输出与 `spec-first -v` 一致（AE6）。

---

## System-Wide Impact

- **A3（自动化/non-TTY）**: 颜色降级保证管道/CI 场景无 ANSI 泄漏；`-y` 模式 banner 不输出；non-TTY 拒绝路径不变。
- **prompt 模块**: `renderSelect`/`renderCheckbox` 的 `lineCount` 变化影响清除逻辑，需精确计算；测试需覆盖有/无 hint 两种路径。
- **`init-i18n.js` 公共边界**: 该模块成为 init 文案 source-of-truth，未来新增 prompt 须同步更新 zh/en 两组。
- **`brand.js` 颜色主题**: `BrandColors.brand`（cyan）决定三处品牌入口颜色；若后续改色只需改一处。

---

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| ASCII art 宽度与 CJK 字符对齐 | R11 对齐在含 CJK tagline 时可能因字符宽度计算不准而错位 | Art 主体使用 ASCII 字符；tagline 如含中文，在实现阶段用 `string-width` 已有逻辑或手动指定固定宽度测试；本计划不要求 CJK art，降低风险 |
| `lineCount` 计算误差 | 重绘 glitch / 残影 | renderSelect/renderCheckbox 修改后需仔细计算 lineCount，并在测试中捕获 output 行数 |
| postinstall TTY 检测准确性 | npm 子进程 isTTY 可能为 undefined 而非 false | `detectColorSupport()` 已处理 undefined（非 true 即 false），无问题 |
| i18n 表键不完整 | 某些 prompt 遗漏本地化 | `getInitMessages('zh')` 和 `getInitMessages('en')` 键集合测试（U3 test scenario 6）可捕获缺漏 |

---

## Open Questions / Deferred

- **[Deferred to implementation] ASCII art 具体字形与 tagline 文案**: 在 `src/cli/brand.js` 实现时选定；建议 5-7 行，含 `spec-first`、版本、`AI 辅助工程框架` tagline。
- **[Deferred to implementation] hint 文案最终措辞**: zh/en 按键提示文本由 i18n 表定义，实现时确定；方向参考：zh `↑↓ 移动 · 空格 选中/取消 · ↩ 确认 · Ctrl+C 取消`。
- **[Deferred to implementation] 版本 banner 快速上手文案**: 现有文案功能完整但略长，实现时可结合 U6 next-step 统一风格。
- **[Out of scope, per brainstorm] 颜色级别提升至 256-color 或 truecolor**: 当前 16-color 已满足需求，升级留待后续。
- **[Out of scope] prompt 着色（光标高亮、选中色）**: brainstorm Key Decisions 明确排除，成本高、收益低。
