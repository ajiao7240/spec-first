---
spec_id: 2026-06-08-001-using-spec-first-injection-redesign
plan_depth: standard
status: ready
origin: docs/brainstorms/2026-06-08-001-using-spec-first-injection-redesign-requirements.md
created: 2026-06-08
---

# refactor: 扩展 using-spec-first bootstrap block 为核心决策集

把会话启动注入从 ~10 行轻量指针 router 扩展为 ~80 行核心决策集(Scope Guards + Decision Output Contract + Routing Priority/Route Map + Red Flags),让路由决策逻辑在会话启动即确定性在场,不再依赖模型主动去读 324 行 SKILL。借鉴 Superpowers 的全文注入机制,**不借** 1% 强制哲学。

Origin: `docs/brainstorms/2026-06-08-001-using-spec-first-injection-redesign-requirements.md`

---

## Problem Frame

`src/cli/instruction-bootstrap.js` 的 `buildZhBootstrapBody`/`buildEnBootstrapBody` 当前生成 ~10 行 router block,核心是一句「完整路由策略在 `skills/using-spec-first/SKILL.md`」。会话启动时(Claude SessionStart hook 运行时读 `CLAUDE.md` block / Codex 读 `AGENTS.md` block),模型只拿到指向 324 行 SKILL 的**指针**,而非路由决策逻辑本身——模型多数情况下不会主动读那 324 行,导致「什么算 substantial work、意图如何映射入口、何时该停下」的判断纲领大部分时候没进上下文。这是「该进 workflow 没进 / 裸对话直接动手」漏路由的结构性根因。

---

## Direct Evidence

- target_repo: spec-first(当前仓库根)
- source_refs:
  - `src/cli/instruction-bootstrap.js:131-185`(`buildZhBootstrapBody`/`buildEnBootstrapBody`——block 内容单点,需扩展)
  - `src/cli/instruction-bootstrap.js:38-82`(`inspectInstructionBootstrap`——drift 检测,用 `buildBootstrapBlock` 同源比对,自动跟随扩展)
  - `src/cli/instruction-bootstrap.js:218-283`(`stripManagedBootstrapSections`/`matchManagedBootstrapSection`——历史 block 清理,依赖 `bulletCount>=4 && managedAnchorCount>=2`,需验证扩大后仍命中)
  - `src/cli/instruction-bootstrap.js:197-216`(`stripKnownBootstrapBodies`/`buildKnownBootstrapBodies`——旧 body 精确匹配清理基线)
  - `skills/using-spec-first/SKILL.md:44-87`(Scope Guards)、`:107-118`(Decision Output Contract)、`:195-237`(Routing Priority + Route Map)、`:302-313`(Red Flags)——四核心段,选段来源
  - `CLAUDE.md` / `AGENTS.md` 的 checked-in managed bootstrap block——它们是 source slice,不是 generated runtime mirror;本仓自身执行后必须同步刷新,否则当前仓 SessionStart 仍注入旧轻量 router
  - `templates/claude/hooks/session-start`、`templates/codex/hooks/session-start`(运行时读 block 注入,**不改**)
  - `tests/unit/instruction-bootstrap.test.js:23-58`(现有 block 内容断言基线,需扩展)
- current_revision: 分支 `leo-2026-06-03-ceupdate`(工作树含既有未提交改动,与本计划无关)
- discovery_methods: 直接读 source、grep、读 origin requirements + SKILL 四段实际内容
- confidence: high(改动局限在 instruction-bootstrap.js 内容生成 + 测试;链路机制不变,无新架构)
- limitations:
  - 注入内容对模型路由行为的实际改善是语义效果,无法用单测证明,只能由 block 内容契约 + 人工/会话观察验证(见 Verification)
  - SKILL 是英文长 prose、block 是双语压缩 bullet,**形态不兼容**——R6 drift 防护只能用「独立维护 + 测试断言不变量」,不能同源生成/引用(已与用户确认)

---

## Context & Research

### 注入链路(全部已就绪,机制不改)

| 环节 | 位置 | 现状 | 本计划 |
|---|---|---|---|
| block 内容生成 | `instruction-bootstrap.js:131,159` | 生成 ~10 行 router | **扩展为 ~80 行核心决策集**(唯一实质改动) |
| block 写入 instruction 文件 | `writeInstructionBootstrap` | init 调用 | 不改(自动用新 body) |
| drift 检测 | `inspectInstructionBootstrap:65-81` | `buildBootstrapBlock` 同源比对 | 不改(自动跟随) |
| hook 运行时读 block | `templates/{claude,codex}/hooks/session-start` | 读 marker block 注入 | **不改**(R4) |
| 历史 block 清理 | `stripManagedBootstrapSections:218` | bulletCount≥4 + anchor≥2 | **验证扩大后仍命中**,必要时调阈值 |

### 核心决策集选段(R1,四段)

block 是**双语压缩 bullet**,不是 SKILL 英文 prose 的复制。U1 把 SKILL 四段的**语义要点**压缩成 bullet 融入 block body(中/英各一份),不是逐行搬运。四段要点:

1. **Scope Guards**(SKILL:44-87):什么算 substantial work(改代码/docs/config、启动各 workflow、改状态命令、架构/prompt/contract 决策、durable knowledge)/什么不算(轻量问答、窄事实查询、show output);已在 workflow / 作为 subagent 时不重启路由。
2. **Decision Output Contract**(SKILL:107-118):不靠关键词路由、意图优先于主题域;路由时输出一个入口 + 一个理由;显式调用的 workflow 优先;guide mode 给一入口/一理由/一动作。
3. **Routing Priority + Route Map**(SKILL:195-237):8 级优先级(explicit > safety/repair > diagnostic > evaluation > definition > optimization > execution > knowledge)+ 意图→入口映射(现 block 已有「常见入口锚点」一行,扩展为覆盖主要意图的紧凑映射)。
4. **Red Flags**(SKILL:302-313):反合理化自查(「我先改个文件就好」「这只是个快速架构改动」「我得先看一堆文件再决定」→ 对应正确动作)。

### R6 drift 防护(已定:独立维护 + 测试断言不变量)

block 与 SKILL 各自维护(形态不兼容)。U3 写不变量测试,断言关键语义点在 block 与 SKILL **双向存在**,任一侧改动破坏不变量则测试红。不变量示例:
- 「subagent/bounded 不重启路由」语义在 block 和 SKILL 都在
- 「一个入口 + 一个理由」在 block 和 SKILL 都在
- 「workflow-first ≠ brainstorming-first / 不强制」在 block 和 SKILL 都在(R2 反 1% 哲学的守护)
- Route Map 的入口集(mcp-setup/debug/code-review/doc-review/brainstorm/plan/work/optimize 等)在 block 与 SKILL Route Map 一致(R8 + R6)

---

## Requirements Traceability

| Origin | 计划归属 |
|---|---|
| R1 核心决策集扩展 | U1 |
| R2 保留分流哲学/不引入 1% | U1(措辞)+ U3(不变量断言) |
| R3 source 单点 instruction-bootstrap.js | U1 |
| R4 hook 脚本不改形态 | 全计划不碰 hook 脚本(non-goal,U3 回归守护) |
| R5 subagent 豁免语义 | U1(写入)+ U3(断言) |
| R6 drift 防护 | U3(不变量测试) |
| R7 与 CLAUDE.md/AGENTS.md 去重 | U1(去重)+ U2(strip 兼容)|
| R8 双宿主对齐 | U1(中英×双宿主)+ U3(对齐断言) |
| AE1/AE2/AE3 | U3 断言 |
| AE4(drift) | U3 不变量测试 |
| AE5(双宿主+doctor) | U3 + U2 |

---

## Implementation Units

### U1. 扩展 bootstrap body 为核心决策集

**Goal**:`buildZhBootstrapBody`/`buildEnBootstrapBody` 输出从 ~10 行 router 扩展为 ~80 行核心决策集,覆盖四段要点,双宿主 + 中英对齐。

**Requirements**:R1, R2, R3, R5, R7, R8

**Dependencies**:无

**Files**:
- `src/cli/instruction-bootstrap.js`(改 `buildZhBootstrapBody`/`buildEnBootstrapBody`)
- `CLAUDE.md` / `AGENTS.md`(本仓 checked-in host instruction source slice,通过新 generator 输出同步 managed bootstrap block,不手改 generated mirrors)

**Approach**:
- 在两个 body 函数内,把现有 ~10 行扩展为分组的核心决策集 bullet,保留现有 host-specific 分支机制(`hostLine`/`surfaceLine`/`codexStartupReminderLines`/`entry()`)。分组建议(用 bullet 子标题或紧凑分段,不引入 H2/H3 以免与 strip 的 heading 检测冲突):
  - **何时进入 workflow**(Scope Guards 压缩):substantial work 清单 + 非 substantial 清单 + 已在 workflow/subagent 不重启
  - **如何路由**(Decision Output Contract 压缩):意图优先于关键词、一个入口+一个理由、显式调用优先、guide mode 三件套
  - **优先级与入口映射**(Routing Priority + Route Map 压缩):8 级优先级紧凑表述 + 意图→入口锚点(扩展现有「常见入口锚点」行)
  - **反合理化红旗**(Red Flags 压缩):3-5 条「想法→正确动作」
- 为保持 `matchManagedBootstrapSection` 的损坏 marker 清理语义,expanded body 的 heading 后正文默认保持为连续 `- ` bullet 行;不要在 managed block 内插入空行、表格或非 bullet 分组正文。若实现确实需要非连续分组,必须同步扩展 matcher 并补误删/漏删测试后再落地。
- 保留现有所有语义点(测试已断言的 ~15 个 toContain 不能丢)。
- 措辞守 R2:显式包含「workflow-first ≠ brainstorming-first」「不强制每任务走 workflow」「轻量问答可直接答」,**不得**出现「1% 即必须」「if there is any chance... must invoke」类强制全拦截语义。
- 去重(R7):不重复 CLAUDE.md/AGENTS.md 别处已有内容(本 block 是 workflow 入口治理,不重述 source/runtime 边界、developer profile 等已在别处的主题)。
- 量级 ~80 行是目标非硬上限,按「够用且不过量」裁剪。
- source 同步:本仓 `CLAUDE.md` / `AGENTS.md` 中的 managed bootstrap block 必须随 generator 更新为 expanded block;`.claude/`、`.codex/`、`.agents/skills/` runtime mirrors 仍不手改。

**Patterns to follow**:现有 `buildZhBootstrapBody` 的 host 分支 + `entry()` 入口语法生成;现有 bullet 风格。

**Test expectation**:行为经 U3 验证(纯内容函数,断言其输出)。

---

### U2. 历史 block 兼容与清理

**Goal**:确保扩大后的 block 在 init/clean 时,(a) 旧 ~10 行 block 能被干净替换为新 block;(b) 新 block 自身能被正确识别清理。

**Requirements**:R3(历史兼容), R7

**Dependencies**:U1

**Files**:
- `src/cli/instruction-bootstrap.js`(按需调 `matchManagedBootstrapSection` 阈值 / `buildKnownBootstrapBodies`)
- `tests/unit/instruction-bootstrap.test.js`(锁定连续 bullet 或 matcher 扩展后的损坏 marker 清理行为)

**Approach**:
- `applyManagedBootstrapBlock` 走 marker 替换路径(start/end marker 在则整段替换)——这条路径对内容量无关,扩大 block 后旧→新替换天然干净(marker 不变)。**主路径无需改**。
- 兜底路径(marker 损坏)依赖 `stripKnownBootstrapBodies`(精确匹配旧 body)+ `stripManagedBootstrapSections`(heading + bulletCount≥4 + anchor≥2 容错)。验证两点:
  - 扩大后 block 的 bullet 数远超 4,`bulletCount>=4` 仍命中(放宽不收紧,安全)。`managedAnchorCount>=2`:确认扩大后 block 仍含 ≥2 个 `isManagedBootstrapAnchor` 锚点(using-spec-first/spec-brainstorm/常见入口锚点/spec-write-tasks/internal-only skills 等)——U1 内容必然含多个,安全。
  - `matchManagedBootstrapSection` 当前只连续消费 heading 后的 `- ` 行;expanded block 若出现空行/表格/非 bullet 段落,损坏 marker 清理会提前停止。优先把 body 格式约束为连续 bullet 并加断言;若为了可读性必须分段,则先改 matcher 支持该结构,并补 user section preserved / generated-like body removed 两类回归。
  - `buildKnownBootstrapBodies` 精确匹配的是**当前** body 输出,扩展后自动跟随;但它匹配不到**旧 ~10 行** body 字面量。评估:旧 body 字面量是否需加入 known bodies 以清理存量项目的损坏-marker 残留。**先写 AC8 风格测试**(给定含旧 ~10 行 block 的 instruction 文件,marker 完整 → 走主替换路径验证干净;marker 损坏 → 验证 strip 是否残留),据结果决定是否追加旧 body 常量。
- 决策门:若主替换路径(marker 完整)覆盖所有存量升级场景(大概率,因 init 写的 block 总带 marker),则**不追加** legacy body 常量(避免永久维护历史字符串,符合简洁优先)。

**Patterns to follow**:现有 `stripManagedBootstrapSections` section-level 容错;2026-06-07-002 计划 U3 的「先验证 strip 是否已覆盖再决定是否加 legacy 常量」模式。

**Test expectation**:U3 覆盖旧→新替换 + 损坏 marker 清理。

---

### U3. 测试覆盖(drift 不变量 + 双宿主对齐 + 回归)

**Goal**:断言核心决策集内容、R2 哲学守护、R6 drift 不变量、R8 双宿主对齐、历史兼容,防回归。

**Requirements**:R1, R2, R5, R6, R8, AE1-AE5

**Dependencies**:U1, U2

**Files**:
- `tests/unit/instruction-bootstrap.test.js`(扩展)
- 必要时 `tests/smoke/release-dual-host-governance.sh`(双宿主 block 内容断言)
- `docs/contracts/workflows/fresh-source-eval-checklist.md`(只读 checklist refs;不修改,用于语义 eval 记录)

**Approach**:以 instruction-bootstrap 单测为主(读当前磁盘 source,不受会话缓存影响)。

**Test scenarios**:
- Covers AE1/R1. `buildBootstrapBlock('claude','zh')` 与 `('codex','zh')` 输出含四段核心决策语义点(substantial work 清单关键项、一个入口+一个理由、8级优先级关键词、红旗关键项),而非仅「完整策略在 SKILL.md」指针。
- Covers AE2/R2. block 含「workflow-first ≠ brainstorming-first」「不强制」「轻量问答可直接答」;**不含**「1% 即必须 invoke」「any chance.*must invoke」类强制语义(正则反向断言)。
- Covers AE3/R5. block 含 subagent/bounded 不重启路由语义。
- Covers AE4/R6. **drift 不变量测试**:读 `skills/using-spec-first/SKILL.md` 当前磁盘内容,断言关键不变量(subagent 不重启 / 一个入口+一个理由 / workflow-first≠brainstorming-first / Route Map 入口集)在 block 与 SKILL **双向存在**;任一侧缺失则红。
- Covers AE5/R8. claude 与 codex block 除入口语法(`/spec:` vs `$spec-`)外,四段核心语义点对齐(同一组 toContain 对两宿主都过)。zh/en 双语均覆盖。
- 格式回归:expanded block heading 后正文保持连续 `- ` bullet 行,或 matcher 已明确支持分段结构;测试必须覆盖损坏 marker 下 generated-like expanded block 被完整移除、clean-heading user section 被保留。
- 回归:现有 ~15 个 toContain 断言全保留(扩展不删除现有语义点);`inspectInstructionBootstrap` 对新 block 返回 installed 不报 drift;旧 ~10 行 block(marker 完整)init 后干净替换为新 block;dual-host smoke 全绿。
- 回归(R4):hook 模板 `templates/{claude,codex}/hooks/session-start` 未被本计划修改(git diff 为空)。
- 行为语义:对 `skills/using-spec-first/SKILL.md` 当前磁盘 source + 生成后的 zh/en bootstrap block 做 fresh-source eval,按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 评估路由哲学、subagent 豁免、Route Map/priority、red flags 是否能被 fresh reviewer 正确理解;若当前 host 缺 dispatch primitive、未授权 helper agents 或 runtime 不安全,必须在 closeout 中记录 `fresh_source_eval_not_run` + 具体 reason,不得声称语义验证通过。

**Verification**:`npm run test:unit` + `npm run test:smoke` 通过,新增断言覆盖上述;fresh-source eval passed 或明确 not-run/degraded reason。

---

### U4. 文档与 CHANGELOG

**Goal**:同步 user-visible 变更记录与相关文档。

**Requirements**:R3, R7

**Dependencies**:U1, U2, U3

**Files**:
- `CHANGELOG.md`(新增条目,user-visible:init 后 CLAUDE.md/AGENTS.md 的 bootstrap block 从轻量 router 扩为核心决策集)
- `skills/using-spec-first/SKILL.md`(必做:更新 Source Of Truth / Injection Behavior 相关段,明确 bootstrap block 现含核心决策集,与本 SKILL 四段为独立维护 + 测试断言不变量的关系,防后人误改一处忘另一处)
- `CLAUDE.md` / `AGENTS.md`(必做:本仓 checked-in source slice 随 generator 更新 expanded managed bootstrap block;不可只改 runtime mirrors)
- `docs/solutions/`(可选:若 drift 不变量机制值得沉淀为可复用模式)

**Approach**:CHANGELOG 按仓库格式 + 当前 developer profile;SKILL 必须补 drift 关系说明(轻量一句,不重复 block 内容);通过 generator/`spec-first init` 路径或等价 source 同步方式刷新本仓 `CLAUDE.md`/`AGENTS.md` managed block,但不手改 `.claude/`、`.codex/`、`.agents/skills/` runtime mirrors;README 双宿主说明如提及注入,核对是否需同步(大概率不需要,init 行为描述不变)。

**Verification**:CHANGELOG 条目就位;SKILL 说明与实现一致;`CLAUDE.md`/`AGENTS.md` 中 checked-in managed block 不再是旧轻量 router;generated runtime mirrors 未被手改。

---

## System-Wide Impact

- **双宿主**:Claude(`CLAUDE.md`)与 Codex(`AGENTS.md`)的 bootstrap block 同步扩大,内容对齐;init/doctor/clean 行为机制不变(仅 block 内容变大)。
- **hook 注入**:Claude SessionStart hook、Codex SessionStart hook(2026-06-07 修复)运行时读的 block 变大 → 注入的 `additionalContext` 变大;hook 脚本本身不改。
- **TUI 显示**:注入内容显示从 ~10 行变 ~80 行(origin 已确认接受;仍远短于 Superpowers 117 行)。
- **常驻可见**:~80 行核心集常驻 checked-in CLAUDE.md/AGENTS.md,开发者日常可见(origin 已确认接受)。
- **CHANGELOG**:需新增 user-visible 条目。
- **本仓 source slice**:`CLAUDE.md`/`AGENTS.md` 是 checked-in source-of-truth,执行后必须同步 expanded block;`.claude/`、`.codex/`、`.agents/skills/` 仍是 generated runtime,不作为 source 修复目标。

---

## Risks & Mitigation

| 风险 | 缓解 |
|---|---|
| 扩大 block 与 SKILL 静默 drift | U3 drift 不变量测试双向断言关键语义点(R6 核心交付) |
| 措辞滑向 1% 强制哲学,反转设计 | U3 正则反向断言禁止强制全拦截语义(R2 守护) |
| 扩大后 strip 逻辑漏掉新 block | U2 验证 bulletCount≥4 + anchor≥2 仍命中(放宽方向,安全);U3 回归测试 |
| expanded block 分组格式打破损坏 marker 清理 | U1 默认连续 bullet 格式;U2/U3 加 generated-like body removed + clean-heading user section preserved 回归;若需非 bullet 分组,先扩 matcher 再落地 |
| 旧 ~10 行 block 升级残留 | U2 主替换路径(marker 完整)天然干净;损坏 marker 路径写测试验证,据结果决定是否加 legacy 常量 |
| block 与 CLAUDE.md 别处内容重复成多真相源 | U1 去重(本 block 只管 workflow 入口治理,不重述别处主题) |
| 只改 generator 未更新本仓 checked-in `CLAUDE.md`/`AGENTS.md`,导致当前仓仍注入旧 block | U4 把两文件列为必做 source slice 同步目标;验证 checked-in block 内容已更新且 runtime mirrors 未手改 |
| SKILL 仍声明 bootstrap 是 thin reminder,与 expanded block 策略冲突 | U4 必改 `skills/using-spec-first/SKILL.md` 的 Source Of Truth / Injection Behavior 说明,并用 U3 不变量测试防 drift |
| 误改 hook 脚本形态 | 本计划不碰 hook 脚本;U3 回归断言 hook 模板 git diff 为空 |
| ~80 行超宿主 instruction 大小限制 | 远低于常见上限;init 后人工核验一次 |

---

## Assumptions

- `[confirmed]` block 内容单点在 `buildZhBootstrapBody`/`buildEnBootstrapBody`,drift 检测同源比对(source: instruction-bootstrap.js)。
- `[confirmed]` `applyManagedBootstrapBlock` 主路径按 marker 整段替换,对内容量无关(source: :84-104)。
- `[confirmed]` SKILL 四段是英文 prose、block 是双语 bullet,形态不兼容 → drift 防护只能独立维护 + 测试断言(用户已确认)。
- `[advisory]` 主替换路径覆盖存量升级场景,无需追加旧 body 常量——U2 测试验证后定论。

---

## Scope Boundaries

### 本计划范围
- 扩展 block body 为核心决策集(U1)
- 历史兼容验证/调整(U2)
- drift 不变量 + 双宿主对齐 + 回归测试(U3)
- CHANGELOG + SKILL 关系说明(U4)

### Non-Goals(明确不做)
- 不采纳 1% 强制 invoke 哲学,不动现有 Hard Rule 对它的拒绝
- 不注入 SKILL 全文 324 行(只核心集 ~80 行)
- 不改 SessionStart hook 脚本读取/注入机制,不碰 Codex hooks.json 路径/key
- 不改公开 workflow 的 Route Map 入口集本身
- 不抽公共中间源双向生成(形态不兼容 + 过度设计,已否决)
- 不新增强状态机/强制 gate/运行时拦截器

---

## Verification Plan

- `npm run typecheck`
- `npm run test:unit`(含扩展的 instruction-bootstrap 断言 + drift 不变量 + 双宿主对齐)
- `npm run test:smoke`(dual-host governance)
- 回归:hook 模板未改(git diff 空);现有 ~15 个 block toContain 断言全过;expanded block 在损坏 marker 清理路径完整移除且不误删用户 clean-heading section
- 手动:临时项目 `spec-first init --claude` 与 `--codex` → 查 CLAUDE.md/AGENTS.md block 含核心决策集且双宿主对齐 → `doctor` PASS 不报 drift → 旧 block 项目重 init 干净替换
- 本仓 source slice:确认当前仓 `CLAUDE.md`/`AGENTS.md` checked-in managed block 已更新为核心决策集,不是旧轻量 router;确认 `.claude/`、`.codex/`、`.agents/skills/` 未被作为 source 手改
- 语义效果(无法单测):fresh-source eval passed 或记录 `fresh_source_eval_not_run` + reason;人工/会话观察路由判断质量是否提升(Success Criteria 人类维度,留作 follow-up 观察)
- CHANGELOG 条目就位

---

## Execution Order

U1(扩展 body)→ U2(历史兼容验证)→ U3(测试)→ U4(文档/CHANGELOG)。U1 是核心,U2/U3 守护其正确性,U4 收尾。
