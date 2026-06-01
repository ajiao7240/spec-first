---
date: 2026-06-01
topic: spec-first-install-version-visibility
spec_id: 2026-06-01-001-spec-first-install-version-visibility
artifact_kind: prd-requirements
---

# spec-first 安装流程的版本可见性优化

## Summary

为 `spec-first` 的安装环节补一层「版本可见性」：让用户在装到旧版时能真正收到升级提醒，并在安装后被引导到正确的安装源。范围收窄为两处精准修正——**调大现有版本提醒的网络超时**（核心根因修复）与 **`postinstall` 文案补一句官方 registry 引导**——不动 `init` 命令本身的交互骨架与落盘行为（其交互式重构与品牌 UX 已在 1.8.2 落地）。

**修正记录（重要）：** 本 PRD 初稿误判「`2026-04-01-npm-version-reminder` 需求从未实现」。回源核实后纠正：该需求**已实现**——`src/cli/version-reminder.js` 提供完整的 `maybeShowVersionReminder` / `maybeShowStartupVersionReminder`，查 `https://registry.npmjs.org/<pkg>/latest`、做 semver 比较、非阻塞降级，且已接入 `src/cli/index.js` 的 `doctor` / `init` / `clean` 命令前置（满足原 `2026-04-01` 需求 R7 范围）。因此不再「新增 doctor 版本检查」（会与现有功能重复，且现有的原生 `fetch` 直连 API 比新增 `npm view` spawn 更轻）。真实缺口是：现有提醒的 `fetch` 超时硬编码为 **350ms**，而实测查询 `registry.npmjs.org` 在本场景耗时约 **630ms**，导致提醒每次静默超时、等于功能不存在——这正是用户从镜像源装到旧版 1.8.2 却从未看到任何升级提示的根因。

## Problem Frame

`spec-first` 的安装链路（`npm install -g` → postinstall 欢迎 → `doctor`/`init`）目前在「用户装到的是哪个版本、是不是最新」这件事上完全静默。本次会话亲历的真实摩擦：

- **镜像源滞后，用户无感知装到旧版**：用户本机默认 registry 是国内镜像（`registry.npmmirror.com`），`npm install -g spec-first` 拉到的是镜像上滞后的 `1.8.2`，而官方 `registry.npmjs.org` 已是 `1.9.0`。npm 输出 `changed 7 packages`，用户以为装好了最新版，实际装的是旧版。
- **旧版二进制行为与新版文档不符，放大困惑**：用户随后跑 `spec-first init`，旧版 `1.8.2` 二进制甩出批处理式 Usage（`init (--claude|--codex) ...`），与新版的交互式引导预期不符，用户误以为命令坏了，而根因只是「装到了旧版」。
- **CLI 全程不提示版本新旧**：`postinstall`、`spec-first -v`、`doctor` 当前都不检查「安装版本 vs npm 最新版」。已安装旧版的用户在正常使用中无法自然发现可升级，只能靠手动 `npm view` 或偶然看到发布信息。
- **postinstall 文案不含 registry 引导**：当前 postinstall 只提示「下一步：doctor / init」，当用户因镜像滞后装到旧版时，没有任何线索告诉他「可显式从官方源安装最新版」。

这些摩擦叠加在「安装」这个最高频、信任成本最高的首次接触点上，会让用户在第一步就对工具产生「装完即坏」的错误印象，而真实原因只是版本可见性缺失。

`2026-04-01-npm-version-reminder` 需求文档早已识别「已安装用户如何及时知道有新版本」，但从未实现（回源 `src/cli/`：仅 `doctor.js` 有针对 git/claude/codex 的 `--version` 超时文案，无 spec-first 自身的 npm-latest 比对）。本次以最小克制方式补齐它。

## Current System Snapshot

均回源 `src/cli/`、`bin/`、`docs/brainstorms/`，作为本 PRD 的 brownfield 基线：

- `src/cli/version-reminder.js`（`confirmed-source`）：版本提醒**已实现**。`maybeShowVersionReminder({packageName, currentVersion})` 经 `defaultLookupLatestVersion` 用原生 `fetch('https://registry.npmjs.org/<pkg>/latest', { signal: AbortController, timeoutMs })` 取最新版，`compareVersions`（支持 semver + 预发布）判断是否落后，落后则 `formatVersionReminder` 输出 `Update available... Upgrade with: npm install -g <pkg>@latest`，任何异常/超时静默返回 false（非阻塞）。同文件另有 `maybeShowStartupVersionReminder` 启动提醒路径（带 24h cooldown）。
- `src/cli/index.js`（`confirmed-source`）：`runCli` 在 `cmd === 'doctor' || 'init' || 'clean'` 时 `await maybeShowVersionReminder({ packageName: pkg.name, currentVersion: pkg.version })`（line 37-42），并在末尾调用 `maybeShowStartupVersionReminder`。即原 `2026-04-01` 需求 R7（覆盖 init/doctor/clean）**已满足**。
- **根因（`confirmed-source` + 实测）**：`maybeShowVersionReminder`（line 30）、`buildStartupVersionReminder`（line 101）、`defaultLookupLatestVersion`（line 624）、`defaultLookupStartupLatestVersion`（line 403）的默认 `timeoutMs` 均硬编码 **350**。实测 `curl https://registry.npmjs.org/spec-first/latest` 耗时约 **0.63s**。350ms < 630ms → 提醒在常见网络下每次静默超时，从不显示。
- `bin/postinstall.js`（`confirmed-source`）：`ensureSupportedNodeVersion()` 守门后用 `renderFullArt(pkg.version)` 打品牌 art + 固定文案（安装完成 / 下一步 doctor、init / 详情 -v / 说明）。无 registry 引导，纯展示尾步、无网络请求。
- `init` 命令交互式重构（`2026-05-26-002`）与品牌 UX（`2026-05-29-002`）：`confirmed`，已落地 1.8.2。**本次不重做 init 命令本身。**
- `2026-04-01-npm-version-reminder-requirements.md`（`confirmed`，已纠正）：该需求**已实现并接入**；本次只修其超时根因，不重新实现。

## Change Delta

- **extend** `src/cli/version-reminder.js`：把硬编码的 350ms 默认超时提到一个合理且可配置的默认值，使提醒在常见网络下真正能完成查询。不改提醒的触发时机、文案结构、非阻塞语义或 cooldown。
- **extend** `bin/postinstall.js`：在现有欢迎文案中追加一条「确保安装最新版 / registry 可能滞后」的官方 registry 引导。不改 Node 守门、品牌渲染来源与现有下一步提示结构。
- **keep** `src/cli/index.js` 的 reminder 接入点（doctor/init/clean 前置 + startup），不改触发逻辑。
- **keep** `init` 命令、`doctor` 命令、`-v` 全部不变。

## Requirements

### 版本提醒超时根因修复

- R1. `version-reminder.js` 两条查询路径（`maybeShowVersionReminder` / startup）的默认网络超时必须从 350ms 提到一个能在常见网络下完成 `registry.npmjs.org` 查询的值（实测基线约 630ms，留余量）。
- R2. 默认超时必须可通过环境变量覆盖，便于慢网用户调大、CI 调小，遵循本仓库现有 env 覆盖惯例（如 `SPEC_FIRST_VERSION_REMINDER_LATEST` 同族命名）。
- R3. 修改超时不得改变提醒的非阻塞语义：查询失败/超时仍静默返回、不打印堆栈、不阻塞当前命令、不改命令退出码。
- R4. 不得改变提醒的触发时机（doctor/init/clean 前置 + startup）、文案结构、semver 比较逻辑或 startup cooldown。

### postinstall registry 引导

- R5. `postinstall` 欢迎文案必须新增一条引导，说明「若需确保安装最新版本，可显式从官方 registry 安装」，包含可直接复制的命令（显式 `--registry=https://registry.npmjs.org`）。
- R6. R5 文案必须与既有欢迎文案语言一致，不引入中英混杂。
- R7. `postinstall` 不得因新增文案引入任何网络请求或阻塞；其执行时间与失败语义保持不变。

### 边界保持

- R8. 不新增 doctor 版本检查项（现有 reminder 已覆盖该能力，新增会重复）。
- R9. 不修改 `init` 命令的参数解析、交互流程、落盘产物、品牌渲染或 non-TTY 行为。
- R10. 不引入自动升级、自动安装、强制退出或镜像源切换；版本可见性只做「提示」。
- R11. 不引入新的第三方依赖；复用现有 `fetch` + `AbortController`。

## Acceptance Examples

- AE1. 在查询 `registry.npmjs.org` 耗时约 630ms 的网络下、安装版本落后于最新版时运行 `spec-first doctor`（或 init/clean）→ 提醒能在新默认超时内完成查询并输出 `Update available... Upgrade with: ...`（350ms 下此前不会出现）。
- AE2. 设置超时覆盖环境变量为很小的值并断网运行 → 提醒静默不显示，命令照常完成、退出码不变（验证非阻塞 R3）。
- AE3. 安装版本等于最新版本时运行命令 → 不显示升级提醒（`shouldNotifyVersionReminder` 行为不变）。
- AE4. 设置超时覆盖环境变量为大值 → `defaultLookupLatestVersion` 实际使用该值（验证 R2 可配置）。
- AE5. `npm install -g spec-first` 后的 postinstall 输出包含官方 registry 安装引导，且与既有「下一步：doctor / init」提示并存、语言一致。
- AE6. 运行 `spec-first init`（交互式）→ 行为与 1.8.2 落地的交互骨架完全一致，未因本次改动出现差异。
- AE7. `spec-first --help` 与 `spec-first -v` 不触发版本提醒（保持 `index.js` 现有「纯信息命令不前置 reminder」行为）。

## Scope Boundaries

- 只覆盖 `src/cli/version-reminder.js` 超时根因 与 `bin/postinstall.js` 文案两处。
- 不重做 `init` 命令的交互/品牌/落盘（已由 `2026-05-26-002`、`2026-05-29-002` 覆盖并落地）。
- 不新增 doctor 版本检查项——版本提醒能力已由 `version-reminder.js` 实现并接入 doctor/init/clean，新增会重复。
- 不实现「侵入式扩大提醒命令范围」；只修现有提醒的超时根因，使其在常见网络下真正生效。
- 不做自动升级、镜像源切换、registry 配置写入。
- 不引入新依赖。

## Evidence And Assumptions

- 现状均 `confirmed-source`（回源 `src/cli/version-reminder.js`、`src/cli/index.js`、`bin/postinstall.js`）。
- 根因 `confirmed`（实测）：`curl https://registry.npmjs.org/spec-first/latest` 耗时约 0.63s > 现有 350ms 默认超时。
- prior art 状态 `confirmed`（已纠正初稿误判）：init 交互/品牌已落地；npm-version-reminder **已实现并接入**，本次只修超时根因。
- 假设（`assumption`，安全可携带）：把默认超时提到约 2s 量级即可覆盖绝大多数网络，同时仍足够短不明显拖慢命令；精确值与 env 变量名留给 plan/实现。
- 假设（`assumption`）：现有 `fetch` + `AbortController` 路径只需调整超时常量即可，无需改查询实现或引入依赖。

## Outstanding Questions

- OQ1. 新默认超时取多少？本 PRD 不钉死具体值（实测基线 ~630ms，建议 plan 定在 ~2s 量级留足余量）。不阻塞——属实现细节。
- OQ2. 是否同时把版本提示接入 `-v` / `--help`？本 PRD 默认否（保持「纯信息命令不前置 reminder」的现有 `index.js` 行为与 smoke token）。建议默认不接入。

---

**Readiness 自检（`references/prd-readiness-lens.md`）**：核心段齐备；当前状态全部 evidence-tagged（含初稿误判的纠正记录）；Change Delta 明确区分 extend/keep；AE 覆盖 超时生效/非阻塞/最新版不提醒/可配置/postinstall/init 不回归/纯信息命令安静；与 prior art 边界已划清（不重做 init，不重复已实现的 reminder，只修超时根因）。规划阶段无需再发明 WHAT——HOW（精确超时值、env 变量名、文案措辞）留给 plan。两个 OQ 均不阻塞。
