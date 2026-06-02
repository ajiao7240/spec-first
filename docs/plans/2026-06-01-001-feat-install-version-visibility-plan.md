---
date: 2026-06-01
spec_id: 2026-06-01-001-spec-first-install-version-visibility
status: completed
plan_type: fix
origin: docs/brainstorms/2026-06-01-001-spec-first-install-version-visibility-requirements.md
---

# fix: spec-first 版本提醒超时根因修复 + postinstall registry 引导

## Problem Frame

用户从镜像源（`registry.npmmirror.com`）装到旧版 1.8.2 却从未收到任何升级提醒。回源 + 实测确认根因：版本提醒功能**已实现**（`src/cli/version-reminder.js`，已接入 `index.js` 的 doctor/init/clean），但其网络查询默认超时硬编码为 **350ms**，而实测查询 `https://registry.npmjs.org/spec-first/latest` 耗时约 **630ms**——提醒每次静默超时，等于功能不存在。

本计划做两处精准修正（见 origin: `docs/brainstorms/2026-06-01-001-spec-first-install-version-visibility-requirements.md`）：
1. 把版本提醒默认超时从 350ms 提到合理值并支持环境变量覆盖（核心根因修复）。
2. `postinstall` 文案补一句官方 registry 安装引导。

**前提纠正：** 本计划初稿（同 spec_id 上一版）误判"需要新增 doctor 版本检查"。回源发现该能力已存在，故改为修现有实现的超时根因，不新增重复检查。

---

## Graph Readiness

- target_repo: spec-first (current repo)
- status: stale
- source_revision: fc3d0ca649ee6739d16302608858e1ef4165fc9f
- current_revision: c590f74d37b2db22cb39bd9051d9b0bdbd9119b5
- stale: true
- primary_providers: none used
- degraded_providers: gitnexus (stale facts)
- fallback_capabilities: bounded direct repo reads
- runtime_mcp_evidence: not-probed
- confidence: high (改动集中在 version-reminder.js 超时常量 + postinstall 文案；相关函数已直接读全)
- limitations: graph facts stale，未用 graph-backed 影响分析；窄范围常量/文案修改，blast radius 非决策相关。现状均直接回源 `src/cli/version-reminder.js`、`src/cli/index.js`、`bin/postinstall.js`，并经 `curl` 实测超时。

---

## Context & Research

直接回源 + 实测（bounded direct reads）：

- **超时硬编码点**（`src/cli/version-reminder.js`）：四处默认 `timeoutMs = 350` / `timeoutMs: 350`——
  - `maybeShowVersionReminder`（line 30，opts 默认）
  - `buildStartupVersionReminder`（line 101）
  - `defaultLookupLatestVersion`（line 624，`Number.isFinite(options.timeoutMs) ? options.timeoutMs : 350`）
  - `defaultLookupStartupLatestVersion`（line 403 附近）
- **查询实现**（`defaultLookupLatestVersion`，line 618）：原生 `fetch('https://registry.npmjs.org/<pkg>/latest', { signal: AbortController })`，350ms abort，失败/非 200/解析失败均返回 `''`（非阻塞）。已有 env 覆盖先例 `SPEC_FIRST_VERSION_REMINDER_LATEST`（line 619，`normalizeOverride`）——env 命名惯例可循。
- **接入点**（`src/cli/index.js:37-42`）：`doctor`/`init`/`clean` 前 `await maybeShowVersionReminder({ packageName, currentVersion })`；末尾 `maybeShowStartupVersionReminder`。`--help`/`-h`/`--version`/`-v` 在更早分支 return，不前置 reminder（满足 R-纯信息命令安静）。
- **实测根因**：`curl -m5 https://registry.npmjs.org/spec-first/latest` → HTTP 200，`time_total ≈ 0.63s`。350ms < 630ms。
- **postinstall**（`bin/postinstall.js`）：`process.stdout.write` 模板字符串，中文文案（安装完成 / 下一步 / 详情 / 说明），纯展示无网络。
- **测试惯例**：`version-reminder.js` 已有单测覆盖（搜 `tests/unit/` version-reminder 相关）；postinstall 输出由 `tests/smoke/install-tarball.sh:108` grep。

研究决策：跳过外部研究——超时调整与 env 覆盖是本仓库成熟本地模式。

---

## Goals

- 版本提醒在常见网络（~630ms 查询延迟）下能真正完成查询并显示，不再被 350ms 静默吞掉。
- 超时可经环境变量覆盖（慢网调大、CI 调小）。
- postinstall 文案引导用户在需要时显式从官方 registry 安装最新版。
- 全程保持非阻塞语义与现有触发逻辑不变。

## Non-Goals

- 不新增 doctor 版本检查（现有 reminder 已覆盖，新增重复）。
- 不重做 init 命令交互/品牌/落盘（已落地 1.8.2）。
- 不扩大提醒触发的命令范围、不改文案结构、不改 cooldown、不改 semver 比较。
- 不做自动升级、镜像源切换、registry 配置写入、不接入 `-v`/`--help`。

---

## Requirements Traceability

| Origin Req | 覆盖单元 |
|---|---|
| R1, R2, R3, R4 (超时提值/可配置/非阻塞/不改触发) | U1 |
| R5, R6, R7 (postinstall registry 引导/语言/非阻塞) | U2 |
| R8, R9, R10, R11 (不新增 doctor 检查/不改 init/无自动升级/无新依赖) | U1, U2（约束） |

AE 映射：AE1/AE2/AE3/AE4 → U1；AE5 → U2；AE6/AE7 → U1+U2 回归。

---

## Key Technical Decisions

- **统一默认超时常量 + env 覆盖**。新增模块级常量（如 `DEFAULT_VERSION_REMINDER_TIMEOUT_MS`），默认值定在 ~2000ms（覆盖实测 630ms 余量充足，仍不明显拖慢命令）。四处 `350` 引用改为读该常量。
  - `question`: 默认超时取多少？ `recommended_answer`: ~2000ms。 `source_tag`: user（origin OQ1 建议 ~2s 量级）。 `consequence`: 慢网/断网时命令最多多等 2s，但 reminder 非阻塞、查询失败静默。
- **env 覆盖遵循现有命名**。新增 `SPEC_FIRST_VERSION_REMINDER_TIMEOUT_MS`（与现有 `SPEC_FIRST_VERSION_REMINDER_LATEST` 同族），在 `resolveVersionReminderTimeoutMs()`（新增小函数）中解析：合法正整数则用，否则回落默认常量。复用 `external-command.js` 里 `resolveExternalCommandTimeoutMs` 的同款模式。
- **只改超时来源，不改查询/降级/触发逻辑**。`fetch` + `AbortController` + 失败返回 `''` 全部保留，最小化 blast radius，保证非阻塞语义不回归。
- **postinstall 纯静态文案**。不引入任何网络请求（postinstall 是安装尾步，加网络会拖慢/阻塞安装）。

---

## Implementation Units

### U1. 修复 version-reminder 默认超时根因（350ms → 可配置 ~2s）

**Goal:** 让版本提醒在常见网络下真正完成 `registry.npmjs.org` 查询，并支持 env 覆盖，保持非阻塞与触发逻辑不变。

**Requirements:** R1, R2, R3, R4, R8, R9, R10, R11；AE1, AE2, AE3, AE4。

**Dependencies:** none。

**Files:**
- `src/cli/version-reminder.js`（新增超时常量 + `resolveVersionReminderTimeoutMs()`，替换四处 `350`）
- `tests/unit/version-reminder.test.js`（若存在则扩展；否则在现有 version-reminder 测试文件补用例）

**Approach:**
- 在模块顶部（`STARTUP_REMINDER_COOLDOWN_MS` 附近）新增 `DEFAULT_VERSION_REMINDER_TIMEOUT_MS = 2000`。
- 新增 `resolveVersionReminderTimeoutMs()`：读 `process.env.SPEC_FIRST_VERSION_REMINDER_TIMEOUT_MS`，合法正整数则返回，否则返回默认常量（参照 `external-command.js:resolveExternalCommandTimeoutMs`）。
- 把 `maybeShowVersionReminder`（line 30）、`buildStartupVersionReminder`（line 101）、`defaultLookupLatestVersion`（line 624）、`defaultLookupStartupLatestVersion`（line 403）的 `350` 默认替换为 `resolveVersionReminderTimeoutMs()` 的返回值。保留各函数仍接受显式 `timeoutMs` 入参覆盖（测试注入用），仅改"未显式传值时的默认"。
- 不改 `fetch` URL、`AbortController`、失败返回 `''`、`shouldNotifyVersionReminder`、cooldown、触发条件。

**Patterns to follow:** `src/cli/external-command.js` 的 `DEFAULT_EXTERNAL_COMMAND_TIMEOUT_MS` + `resolveExternalCommandTimeoutMs()`；现有 `SPEC_FIRST_VERSION_REMINDER_LATEST` env 覆盖 + `normalizeOverride`。

**Test scenarios:**
- Covers AE1. 注入 `lookupLatestVersion` 返回高于 current 的版本（绕过真实网络）→ `maybeShowVersionReminder` 输出升级提醒、返回 true（验证逻辑路径在超时充足时走通）。
- Covers AE4. 设 `process.env.SPEC_FIRST_VERSION_REMINDER_TIMEOUT_MS='5000'` → `resolveVersionReminderTimeoutMs()` 返回 5000；非法值（`'abc'`/`'-1'`/`'0'`）→ 回落默认 2000。
- Covers AE3. current === latest → `shouldNotifyVersionReminder` false → 不提醒（行为不变）。
- Covers AE2. 注入 lookup 抛错/返回 '' → `maybeShowVersionReminder` 返回 false、不抛、不写 output（非阻塞 R3）。
- 默认常量断言：未设 env 时 `resolveVersionReminderTimeoutMs()` === 2000（防回归到 350）。
- startup 路径：`buildStartupVersionReminder` 未显式传 timeoutMs 时使用 resolve 后的默认（验证四处都改到、无遗漏）。
- 回归：现有 version-reminder 单测全绿（semver 比较、cooldown、格式化不受影响）。

**Verification:** 单测全绿；联网旧版环境下 `spec-first doctor` 实际显示升级提醒（350ms 下不显示）；`npm run test:unit` 通过。

---

### U2. postinstall 追加官方 registry 安装引导

**Goal:** postinstall 欢迎文案新增一条官方 registry 安装引导，语言一致、无网络请求。

**Requirements:** R5, R6, R7；AE5。

**Dependencies:** none（与 U1 独立）。

**Files:**
- `bin/postinstall.js`（文案块追加一行引导）
- `tests/smoke/install-tarball.sh`（现有 postinstall 输出断言处补一条 grep）

**Approach:**
- 在 `process.stdout.write` 模板的"说明："行附近追加一句静态中文引导，含 `npm install -g spec-first --registry=https://registry.npmjs.org`。
- 保持与既有"安装完成 / 下一步 / 详情 / 说明"同语言同风格，不混英文长句。
- 纯字符串，无 `spawn`/`fetch`/网络。

**Patterns to follow:** `bin/postinstall.js` 现有模板字符串结构与中文风格。

**Test scenarios:**
- Covers AE5. `tests/smoke/install-tarball.sh` 安装后 grep postinstall 输出包含 `registry.npmjs.org`，与既有"spec-first doctor"断言并存。
- 语言一致性：grep 关键中文引导词存在，输出无中英混杂。
- Test expectation: 纯展示文案变更，无需单测；smoke 断言即可。

**Verification:** `npm pack` 隔离安装后 postinstall 输出含 registry 引导且与既有下一步提示并存；`tests/smoke/install-tarball.sh` 通过。

---

## System-Wide Impact

- **所有 CLI 用户（doctor/init/clean + startup）**：版本提醒在慢网下现在能生效；联网正常时命令最多多等到新超时窗口（~2s）但非阻塞，断网仍静默。
- **新安装用户（postinstall）**：安装尾部多一行 registry 引导文案。
- **CI / non-TTY**：reminder 在无网络 CI 中仍走静默降级；env 可调小超时避免 CI 等待。postinstall 文案变化已被 smoke 覆盖。
- **release/install 门禁**：`install-tarball.sh` 已 grep postinstall，U2 同步该断言避免回归。

---

## Risks & Mitigations

- **风险：超时提到 2s 让命令在断网时明显变慢。** 缓解：env 可调小（`SPEC_FIRST_VERSION_REMINDER_TIMEOUT_MS`）；CI 设小值；非阻塞不报错。
- **风险：四处 350 漏改一处导致部分路径仍失效。** 缓解：U1 测试显式覆盖 `maybeShowVersionReminder` 与 startup 两条路径的默认超时；grep 确认无残留字面量 350。
- **风险：postinstall 文案语言混杂回归 origin 已修复问题。** 缓解：R6 + smoke grep 关键中文词。

---

## Deferred to Implementation

- 默认超时精确值（~2000ms 是建议，实现时可微调）。
- env 变量解析的边界（是否接受小数、上限保护）——参照 `resolveExternalCommandTimeoutMs` 现状。
- postinstall 引导句的最终中文措辞。

---

## Outstanding Questions (from origin, with defaults)

- OQ1（默认超时取值）：默认 ~2000ms，实现可微调。不阻塞。
- OQ2（是否接入 `-v`/`--help`）：默认否，保持纯信息命令不前置 reminder。不阻塞。
