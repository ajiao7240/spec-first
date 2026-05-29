---
date: 2026-05-29
topic: spec-first-init-ux-brand
spec_id: 2026-05-29-002-spec-first-init-ux-brand
---

# spec-first init 安装体验与品牌展示优化

## Summary

为 `spec-first init` 及其同源品牌入口（`spec-first -v`、postinstall）做一次体验与品牌打磨：引入一套统一的 spec-first ASCII art 品牌 logo，在首次安装 / 首次 init / 版本展示时打出完整 art、在重复运行（重置 / 漂移修复）时降为一行轻量 wordmark；把 init 全部交互 prompt 按解析出的默认语言本地化以消除中英混杂；为单选 / 多选 prompt 增加按键提示与「至少选一个」反馈；润色 preview 与 next-step 文案；并为品牌 logo 与 preview 引入一套可优雅降级的颜色主题（logo 品牌色 + preview 语义色），在 `NO_COLOR` 或非彩色 / 非 TTY 终端下自动退化为纯文本。init 的落盘行为与产物本体保持不变。

---

## Problem Frame

`spec-first init` 是用户接触 spec-first 的核心入口，但它的交互层在体验与品牌一致性上有几处已验证的粗糙点：

- **语言割裂**：项目默认语言是 `zh`，全局指令也强制中文，但 init 的所有 prompt 标签是硬编码英文（host 多选、开发者名、语言选择、workspace 目标、确认）。结果是一个中文默认用户全程被英文问句包围，最后被一句中文「已取消。」收尾，体验断裂。
- **品牌三套皮、init 零品牌**：postinstall 用 `┌──┐` 单线框 + 「安装完成」，`spec-first -v` 用 `╔══╗` 双线框 + wordmark，而用户最高频接触的 `spec-first init` 开场没有任何品牌锚点，直接跳进第一个 prompt。三处风格互不一致，品牌识别分散。
- **版本 banner 对齐脆弱**：`-v` 的双线框靠硬编码空格做 padding，版本号长度一变右边框就错位；postinstall 反而用了计算式 padding，连这点都不统一。
- **交互可发现性弱**：单选 / 多选 prompt 只渲染 `>` 光标和 `[x]`，没有「↑↓ 移动 / 空格勾选 / 回车确认 / Esc 取消」提示，首次用户不知道 host 多选要按空格；多选未满足最小数量时回车只是静默重绘，不给任何「至少选一个」反馈。
- **机器味文案**：preview 是密集英文（`Would remove N managed obsolete path(s)` 等），next-step 是 5 行编号清单，信息全但缺层次与引导语气，对首次接入者不直观。
- **全程无色**：三处品牌入口与 preview 当前都是纯文本，缺少颜色层级。品牌 logo 没有品牌色锚点，preview 的「写入 / 移除 / untrack」也只能靠文字区分，扫一眼无法快速分辨破坏性动作与新增动作。

这些问题单看都是小摩擦，但叠加在同一个高频入口上，会持续削弱首次接入者的信任感和顺手度，也让「这是一个成熟、专业的工程框架」的品牌印象立不住。init 的交互骨架本身在近期已重构完成，本次只在其上做表层体验与品牌打磨，不动底层流程。

---

## Actors

- A1. 首次接入开发者：首次安装并运行 init，需要在不读 README 的前提下感知品牌、看懂每一步、知道下一步。最受益于完整 art、本地化 prompt、按键提示、引导式 next-step。
- A2. 回头重置 / 修复开发者：在已初始化项目里重复运行 init（重置或漂移修复）。最在意「别每次都打一大块 art 刷屏」，需要轻量 wordmark 而非完整 art。
- A3. 自动化 / non-TTY 场景：CI、子进程、tarball install 测试等。本次不改变其行为，但品牌 / 文案改动不能破坏其既有的拒绝路径与可解析信号。

---

## Key Flows

- F1. 首次安装与首次 init
  - **Trigger:** 用户首次 `npm install` 后看到 postinstall 欢迎，随后在未初始化的项目里运行 `spec-first init`。
  - **Actors:** A1。
  - **Steps:**
    1. postinstall 打出完整 ASCII art 品牌 logo + 版本 + 安装完成提示 + 下一步指引。
    2. `spec-first init` 检测到目标无现有 spec-first managed state，开场打出同一套完整 art。
    3. 按解析出的默认语言，依次呈现本地化的 host 多选、开发者名、语言、（必要时）workspace 目标 prompt，每个交互 prompt 带按键提示。
    4. 打出本地化、有层次、带语义色（写入 / 更新 / 移除 / untrack 各有区分色）的 preview，再请求确认。
    5. 确认后落盘，打出本地化、有引导语气的 next-step。
  - **Outcome:** 首次用户全程同一语言、有品牌锚点、每步知道怎么操作和下一步做什么。
  - **Covered by:** R1, R2, R3, R5, R6, R7, R8, R9, R10, R12, R13。

- F2. 重复运行（重置 / 漂移修复）
  - **Trigger:** 用户在已存在 spec-first managed state 的项目里再次运行 `spec-first init`。
  - **Actors:** A2。
  - **Steps:**
    1. init 检测到现有 managed state，开场只打一行轻量 wordmark（版本 + 极简标识），不打完整 art。
    2. 其余交互、preview、next-step 与 F1 一致（本地化、带提示）。
  - **Outcome:** 重复运行不被大块 art 刷屏，但仍保留品牌存在感与一致体验。
  - **Covered by:** R2, R4, R5, R6, R7, R8, R9, R10。

- F3. 版本展示
  - **Trigger:** 用户运行 `spec-first -v` / `--version`。
  - **Actors:** A1, A2。
  - **Steps:**
    1. 打出与 init/postinstall 同一套完整 ASCII art 品牌 logo，版本号与 tagline 对齐稳定（计算式 padding，不随版本号长度错位）。
  - **Outcome:** 版本入口与安装 / 初始化入口品牌视觉一致，无对齐缺陷。
  - **Covered by:** R2, R11。

---

## Requirements

**品牌 logo 与视觉统一**
- R1. 提供一套单一来源的 spec-first 完整 ASCII art 品牌 logo（含 wordmark、版本、tagline），由 `spec-first init`、`spec-first -v`、postinstall 三处共享渲染，不维护三份各异的副本。
- R2. 完整 art 在以下时机展示：首次安装（postinstall）、首次 init（目标未检测到现有 spec-first managed state）、版本展示（`-v` / `--version`）。
- R3. 首次 init 在进入第一个交互 prompt 之前先展示完整 art 品牌 logo。
- R4. 重复运行 init（目标已存在 spec-first managed state，含重置 / 漂移修复路径）时，开场降为一行轻量 wordmark，不展示完整 art。
- R11. 版本展示的品牌 logo 必须在版本号长度变化时保持边框 / 对齐稳定（计算式 padding），不得出现硬编码空格导致的错位。

**语言一致性**
- R5. init 的全部交互 prompt 标签（host 选择、开发者名、语言选择、workspace 目标、确认及相关提示语）按当次运行解析出的默认语言（沿用现有 `.developer` → 全局 profile → git user 的 fallback 链）本地化，支持 `zh` / `en`。
- R6. 同一次 init 运行内，所有 prompt、preview、next-step、取消 / 错误提示使用同一种语言；不在当次运行中途因语言选择步骤而切换已呈现 prompt 的语言。语言选择步骤决定的是持久化给后续会话的语言。

**交互可发现性**
- R7. 单选与多选 prompt 渲染时附带按键操作提示（如上下移动、空格勾选、回车确认、取消），提示文案随当次语言本地化。
- R8. 多选 prompt 在未满足最小选择数量时按回车，必须给出可见的「至少选择 N 项」反馈，而非静默重绘。

**文案润色**
- R9. init 的 preview 输出按当次语言本地化，并以有层次的结构呈现「将写入 / 更新 / 移除 / untrack」等动作，便于首次用户快速理解将发生什么。
- R10. init 成功后的 next-step 输出按当次语言本地化，带引导语气与清晰层次，指明重启宿主、按意图选择 workflow 入口等下一步。

**颜色主题**
- R12. 提供一套单一来源的颜色主题，至少覆盖：品牌 logo / wordmark / tagline 的品牌色，以及 preview 中「写入 / 更新」「移除」「untrack」「按键提示等次要文本」的语义区分色；着色由 `spec-first init`、`spec-first -v`、postinstall 共享同一套颜色定义。
- R13. 颜色必须可优雅降级：当检测到 `NO_COLOR` 环境变量、输出目标非 TTY（如被管道捕获）、或终端不支持颜色时，全部输出退化为纯文本，且绝不泄漏任何 ANSI 转义序列到输出中。
- R14. 本次着色范围仅限品牌 logo 与 preview；init 的交互 prompt（光标 / 选中高亮 / 确认提示）与 next-step 本次不要求着色，保持纯文本，留待后续按需扩展。

---

## Acceptance Examples

- AE1. **Covers R2, R3, R5, R6.** 在中文默认、未初始化的项目里交互运行 `spec-first init`：开场打出完整 ASCII art logo，随后所有 prompt 均为中文，全程无英文问句，取消 / 确认提示同为中文。
- AE2. **Covers R2, R4.** 在已初始化（存在 managed state）的项目里再次运行 `spec-first init`：开场只出现一行轻量 wordmark，不出现多行完整 art；其余交互与首次一致。
- AE3. **Covers R7, R8.** 运行 init 到 host 多选步骤：界面显示按键提示；不勾选任何项直接回车时，出现可见的「至少选择一项」反馈而非无响应。
- AE4. **Covers R5, R6.** 当解析出的默认语言为 `en` 时运行 init：全部 prompt、preview、next-step 均为英文，无中文残留。
- AE5. **Covers R11.** 对一个较长版本号（如 `vX.Y.Z-beta.N`）运行 `spec-first -v`：品牌 logo 边框 / 对齐保持完整，不出现右边框错位。
- AE6. **Covers R1, R2.** 同一版本下，`spec-first init`（首次）、`spec-first -v`、postinstall 三处展示的完整 art 在 wordmark 与版本呈现上一致。
- AE7. **Covers R12, R14.** 在支持颜色的终端里运行 `spec-first init`：品牌 logo 以品牌色呈现，preview 中「移除 / untrack」与「写入 / 更新」用不同颜色区分；同一次运行的交互 prompt 与 next-step 不着色。
- AE8. **Covers R13.** 设置 `NO_COLOR=1` 或将 `spec-first -v` / init 输出重定向到文件 / 管道：输出为纯文本，不含任何 ANSI 转义序列，logo 与 preview 仍可读且结构完整。

---

## Success Criteria

- 首次接入者在不读 README 的前提下运行一次 init，全程同一语言、开场即有品牌锚点、每步知道如何操作、结束知道下一步，主观体验连贯无断裂。
- 重复运行 init 的开发者不会被大块 art 反复刷屏，但仍能感知品牌存在。
- `spec-first init`、`spec-first -v`、postinstall 三处品牌视觉一致，版本号长度变化不再破坏对齐。
- 支持颜色的终端里 logo 有品牌色锚点、preview 能一眼分辨破坏性与新增动作；`NO_COLOR` / 非 TTY / 管道场景输出纯净无转义序列残留。
- init 的落盘产物（runtime mirror、managed blocks、`.developer`、state、SessionStart hook、CHANGELOG bootstrap、`.gitignore` block）与改动前逐字段等价；non-TTY 拒绝路径与可解析信号不受影响。
- 下游实现者 / agent 能从本文档明确区分「哪些是展示层改动」与「哪些行为必须保持不变」，无需反推产品意图。

---

## Scope Boundaries

- 不改变 init 的落盘内容与底层流程（runtime asset 同步、managed block 渲染、developer profile、state 文件、SessionStart hook、CHANGELOG bootstrap、`.gitignore` managed block、drift 检测、legacy hard reset、untrack 等全部保持原样）。
- 不改变 non-TTY 拒绝行为，也不新增 CI / 自动化 / pipe stdin 的品牌或非交互兜底通路。
- 不重做 `doctor`、`clean`、`tasks`、`session`、`gitnexus-instruction` 等其他子命令的视觉或文案。
- 颜色主题本次仅覆盖品牌 logo 与 preview；不要求为交互 prompt（光标 / 选中 / 确认）与 next-step 着色，也不引入用户可配置的调色板 / 主题切换。
- 不引入新的 npm 运行时依赖；复用现有原生 prompt 模块、品牌字符串渲染，并以原生 ANSI 转义实现着色与降级，不引入颜色库。
- 不重构 init 的交互骨架（host/name/lang/target/preview/confirm 的步骤顺序与控件类型本身不变，仅在其上做展示与本地化打磨）。

---

## Key Decisions

- 品牌 logo 采用完整 ASCII art 而非中等框 / 极简单行：用户明确选择最强品牌识别形态；代价（占行多、可能刷屏）通过「首次 / 版本打完整 art、重复运行降为轻量 wordmark」的时机分级来对冲。
- 完整 art 仅在首次安装 / 首次 init / 版本展示出现，重复运行降级为一行 wordmark：在「品牌存在感」与「重复运行不刷屏」之间取平衡，避免 art 在反复重置 / 漂移修复时变成噪音。
- 「首次 init」以「目标未检测到现有 spec-first managed state」为判定信号：复用 init 既有的 state 检测，无需新增状态来源。
- 同一次运行使用单一语言、语言步骤只决定持久化语言：避免当次运行中途切换已呈现 prompt 语言带来的实现复杂度与视觉跳动；收益（中途变语言）极低，不值得其成本。
- logo / wordmark 单一来源、三处共享渲染：避免再次产生「三套各异品牌皮」的维护负担，从根上解决当前不一致问题。
- 颜色主题着色范围限定为 logo + preview 语义色，prompt 与 next-step 暂不着色：preview 的破坏性 / 新增动作区分是颜色收益最高的地方，logo 品牌色是品牌锚点；prompt 全程着色承载成本最高（要改原生渲染层）且反复运行时易偏闹，性价比低，故本次排除。
- 颜色降级作为硬性需求而非可选项：尊重 `NO_COLOR`、非 TTY / 非彩色终端自动退化纯文本，避免管道捕获 / CI 日志出现转义序列乱码，这是颜色能力进入核心入口的前置条件。
- 着色用原生 ANSI 实现、不引入颜色库：着色面有限（logo + preview），原生转义足够，引入依赖与本项目「0 新增运行时依赖」基线冲突，成本不划算。

---

## Dependencies / Assumptions

- 假设 init 现有的「是否存在现有 managed state」检测可直接作为「首次 vs 重复运行」的判定依据，无需引入新的探测逻辑。
- 假设现有 developer / 语言 fallback 链（`.developer` → 全局 `~/.spec-first/.developer` → `git config user.name`）已能在进入 prompt 前解析出默认语言，可前置用于本地化整轮 prompt。
- 假设现有原生 prompt 模块（单选 / 多选 / 文本 / 确认）可在不引入新依赖的前提下扩展按键提示与最小选择反馈。
- 假设 ASCII art 在主流 macOS / Linux 终端的等宽渲染下对齐稳定；CJK 字符宽度与个别终端的等宽差异需在 plan / 实现阶段抽样验证（影响 R11 的对齐策略选择）。
- 假设颜色支持可通过现有信号（`process.stdout.isTTY`、`NO_COLOR` 环境变量等）可靠判定，无需引入终端能力探测库；postinstall 在 npm 子进程下的 TTY / 颜色判定准确性需在 plan 阶段确认（影响 R13 降级触发的准确性）。

---

## Outstanding Questions

### Resolve Before Planning

（无；本次产品维度的关键决策已在对话中确认。）

### Deferred to Planning

- [Affects R1, R3, R11][Technical] 完整 ASCII art 的具体字形、行数与 tagline 文案定稿，以及计算式 padding 的对齐实现细节。
- [Affects R5, R6, R7, R9, R10][Technical] init 文案本地化的承载方式：延续现有 hard-code 双语分支，还是抽出轻量 i18n 文案表；改动面较大，需 plan 评估可维护性。
- [Affects R11][Needs research] ASCII art 与品牌框在 CJK tagline、Windows 终端、SSH non-pty 等环境下的宽度 / 对齐准确性，需抽样验证或定义补充规则。
- [Affects R7][Technical] 按键提示是常驻渲染在 prompt 内，还是作为首次出现时的一行说明；需在视觉密度与可发现性间权衡。
- [Affects R12, R13][Technical] 颜色判定与降级的具体实现：依赖哪些信号组合（`isTTY` / `NO_COLOR` / `TERM` / `FORCE_COLOR`）、是否需要在测试中可注入颜色开关，以及品牌色与语义色的精确色值（ANSI 16 色还是 256 色）；需 plan 阶段定稿。
