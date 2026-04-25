---
title: "spec-first 跨语言多端 AI 开发辅助最佳实践与演进方案"
status: completed
created: 2026-04-18
deepened: 2026-04-18
owner: spec-platform
related:
  - docs/plans/2026-04-18-spec-first-ai-dev-quality-remediation-plan.md
  - docs/plans/2026-04-18-002-feat-stage0-verification-profile-integration-plan.md
---

# spec-first 跨语言多端 AI 开发辅助最佳实践与演进方案

> 本文基于当前仓库代码事实与业界公开最佳实践编写，目标不是抽象讨论“AI 研发提效”，而是回答一个更具体的问题：
>
> `spec-first` 要如何支持 `1-10`、`10-100` 规模的需求迭代，并在 `前端 / H5 / App / PC / 后端 / Java / Python / JS / TS / Swift / Kotlin` 等不同技术栈下，稳定辅助高质量代码开发。
>
> 本文是 `docs/plans/2026-04-18-spec-first-ai-dev-quality-remediation-plan.md` 的补充方案。前者聚焦当前仓库最关键的 Stage-0 / CRG / 质量门整改；本文聚焦跨语言、多端、不同需求规模下的统一工作方式与演进路径。

## 当前推进状态（2026-04-18）

基于当前分支已落地代码，阶段状态更新如下：

- Phase A `Repo profile baseline`：已完成当前范围
  - `verification-profile.json`、minimal-context verification summary、workflow 消费链已打通
- Phase B `Diff-aware recommendation`：已形成主链
  - `change surface -> verification recommendation` 已进入 runtime `verification_summary`
- Phase C `Verifier registry + stage-aware dispatch`：已完成当前范围基础版
  - 已有独立 verifier registry
  - `test-browser` / `test-xcode` 已纳入 stage-aware dispatch
  - Android / Backend / Desktop verifier 保留为后续按需扩展项，不影响当前方案完成态
- Phase D `Evidence, CI gate, and feedback loop`：已完成轻量闭环
  - 已新增 `AI Dev Quality Gate` workflow 与 `test:ai-dev:gate`
  - 已新增独立 `ai-dev-quality-gate-result` machine-readable artifact
  - runtime 已可读取最近一次 `ai-dev-quality-gate-result` 作为被动事实输入
  - 已新增独立 `verification_evidence` contract
  - `verification_gate_state` 已能基于真实 evidence reference 反映 `satisfied` gate
  - `stage0-context` / workspace runtime / telemetry 已同步暴露 evidence 层
  - 已进入 `CI-ready gate baseline`
  - 已新增被动 `quality-feedback-topics` artifact，供 `spec-compound` / `spec-compound-refresh` 作为补充输入读取
  - `branch protection advisory policy` 已完成
  - GitHub 宿主侧的实际 protection enforcement 明确不纳入本轮范围，不阻塞方案完成态

这意味着当前最核心的 runtime 决策输入已经从三层推进到五层：

- `verification_summary`
- `verifier_dispatch`
- `verification_evidence`
- `verification_gate_state`
- `ai-dev-quality-gate-result`

其中 `ai-dev-quality-gate-result` 当前也只按单仓事实读取，多仓 workspace 不做聚合，以避免过早引入“质量背景如何合并”的隐式策略。

而在 runtime 主链之外，当前又补了一层更克制的 feedback bridge：

- `quality-feedback-topics`

它只服务 compound / refresh 这类“经验回灌”场景，不反向进入主 workflow 编排。

但依然坚持边界：

- 不把 evidence 重新压回 summary
- 不让 gate state 反向承担 dispatch 语义
- 不在这一步直接跳到重型自动执行或 CI fail 策略

## 1. 结论先行

### 1.1 最重要的判断

如果目标是让 `spec-first` 真正高质量辅助 AI 开发，正确方向不是“为每种语言、每个平台各写一套 workflow”，而是建立一条统一主链：

`需求 → 事实 → 计划 → 执行 → 验证 → 沉淀`

然后只在 3 个层面做差异化：

1. **语言差异放在 fact extraction**
   - 由 parser / resolver / graph / symbol extraction 负责处理 Java、Python、JS/TS、Swift、Kotlin 等差异。
2. **平台差异放在 verification**
   - 由 Web、Android、iOS、Backend、Desktop 等不同验证器负责执行对应测试与质量门。
3. **需求规模差异放在 orchestration**
   - `1-10` 规模需求走轻量闭环。
   - `10-100` 规模需求走分解、契约、阶段门和多面验证矩阵。

### 1.2 业界最佳实践对本项目的直接启示

结合 Anthropic Claude Code、GitHub Copilot、Google 工程实践、DORA、Trunk-Based Development、Playwright、Android、Apple Xcode 等公开资料，可以收敛出 6 条适用于 `spec-first` 的硬原则：

1. **上下文必须是可验证事实，不是“多给点文档”**
2. **先探索与计划，再编码；越大改动越要显式分解**
3. **小批次、短分支、快速反馈比“大而全上下文”更稳定**
4. **验证必须是第一等公民，且按平台差异化**
5. **仓库级 instruction / contract / status checks 必须是机器可消费真源**
6. **AI 辅助系统必须对“是否真的提升开发质量”有 benchmark 与回归门**

### 1.3 对 `spec-first` 的最终架构要求

`spec-first` 应演进为：

- 一条统一 workflow 主链，避免按语言复制 workflow
- 一套 Stage-0 control plane 真源，避免上下文漂移
- 一套 language-aware facts 层，服务多语言仓库
- 一套 platform-aware verification 层，服务 App / Web / Backend / PC
- 一套 small-change / medium-large-change 双模式编排
- 一套 benchmark + regression + branch gate 组成的 AI 质量门

---

## 2. 当前项目代码事实

以下判断全部基于当前仓库实现，不基于推测。

### 2.1 已有基础能力

#### A. 已具备跨语言代码事实提取的底子

- `src/crg/parser.js`
  - 当前已支持多语言 AST 解析与 graceful degradation。
  - 文件头注释声明当前覆盖 `javascript / typescript / tsx / python / go / java / rust / c / cpp / objc / swift / kotlin / ruby / php / c-sharp / scala`。
- `src/crg/input-convergence.js`
  - 当前已做输入收敛、默认排除、安全硬规则、语言识别、`presentLanguages` 推导。
  - 说明项目已经具备“跨语言仓库先做统一收敛”的设计方向。

#### B. 已具备统一 workflow 主链的雏形

- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `tests/unit/workflow-stage0-consumption.test.js`

这些文件表明：

- 当前主工作流已经统一为 `plan / work / review`
- 三个 workflow 已按 `selected_assets / fallback_reason / level / skipped_rules` 消费 Stage-0 evaluator 输出
- 这意味着项目方向已经是“统一 workflow + 统一上下文真源”，不是“按语言拆 workflow”

#### C. 已有平台验证工具积木，但还未形成统一调度层

- `skills/test-browser/SKILL.md`
  - 已提供 Web 页面级浏览器验证能力。
- `skills/test-xcode/SKILL.md`
  - 已提供 iOS/XcodeBuildMCP 验证能力。
- `skills/spec-mcp-setup/mcp-tools.json`
  - 当前已管理 `playwright` 等工具接入。

说明当前仓库并不是完全没有“多端验证”能力，而是**这些能力还没有被 Stage-0 / spec-work / spec-code-review 主链统一调度**。

#### D. 已有部分质量门基础

- `.github/workflows/crg-quality-gate.yml`
  - 当前已在 PR 上跑 `npm run test:crg:gate`

说明仓库已经开始把质量门前移到 CI，但目前 gate 主要面向 CRG / Stage-0 自身回归，不是“跨语言、多端、AI 辅助质量”总门。

#### E. 当前分支已开始把 verification profile 接入主链

- `src/bootstrap-compiler/compile-verification-profile.js`
  - 当前工作区已新增 repo 级 verification profile 编译逻辑。
- `docs/contracts/spec-graph-bootstrap/verification-profile.schema.json`
  - 当前工作区已新增独立 schema。
- `src/bootstrap-compiler/compile-machine-artifacts.js`
- `src/bootstrap-compiler/compile-minimal-context.js`
- `src/bootstrap-compiler/run-bootstrap.js`
  - 当前工作区已把 `verification-profile.json` 与 minimal-context verification summary 接进 bootstrap 主链。
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
  - 当前工作区已开始在 workflow 中消费 `platform_focus` / `required_verifications` / `verification_gaps_to_check`。

这说明 `verification-profile` 对本项目已经不是纯理论方向，而是正在落地中的 P1 基线能力。

### 2.2 当前明显缺口

#### A. Stage-0 仍不够真实

- `src/bootstrap-compiler/compile-routing.js` 当前直接从 `sample-generator` 生成 `context-routing` / `artifact-manifest` / `injection-index`
- `src/bootstrap-compiler/run-bootstrap.js` 当前仍会写入 `DEFAULT_CONTEXT_DOCS` 占位内容
- `src/bootstrap-compiler/compile-human-assets.js` 当前只做路径过滤，不生成真实 narrative docs

这意味着当前系统还没有把“多语言、多端仓库真实事实”稳定编译成可消费上下文。

#### B. `verification-profile` 正从“缺口”进入“基线能力”，但还没有完成战略闭环

当前工作区已经出现：

- `verification-profile.schema.json`
- `compile-verification-profile.js`
- `verification-profile.json` output
- workflow 对 verification summary 的消费口径

这意味着本方案不应再把 P1 定义成“从 0 到 1 发明 verification profile”，而应定义成：

1. 把这条链路正式化、自洽化、可回归
2. 明确它只是 **repo-scoped profile**，不是 per-diff recommendation
3. 确保 schema / compiler / sample / minimal-context / workflow / tests 原子交付，不留下半接入状态

#### C. 仍没有把“当前改动影响哪些端、哪些语言、哪些测试面”固化成统一产物

虽然有：

- `src/crg/changes.js`
- `src/crg/commands/review-context.js`
- `src/crg/flows.js`

但当前没有稳定产物把以下信息统一表达出来：

- 本次改动命中了哪些模块
- 命中了哪些语言
- 命中了哪些平台面
- 最小必跑测试集合是什么
- 哪些验证属于 required gate，哪些属于 optional evidence

当前真正缺的不是“仓库级默认验证画像”，而是“本次改动最少该验证什么”的 diff-aware contract。

#### D. 还没有独立 verifier registry 与 evidence contract

当前工作区虽然已经能产出 `verifier_hints`，但仍缺少两层稳定真源：

- verifier capability registry
  - 统一表达 verifier id、覆盖平台、前置条件、证据类型、宿主边界
- verification evidence / gate state contract
  - 统一表达哪些 gate 已执行、哪些被 blocker 阻断、证据落在哪里

如果没有这两层，workflow 最多只能给出“建议”，还不能稳定进入可审计的验证闭环。

#### E. 现有 CRG 在线信号仍会污染后续判断

当前仍在线的问题包括：

- `src/crg/flows.js` 的 `test_gap`
- `src/crg/flows.js` / `src/crg/constants.js` 的 `security_score`
- `src/crg/flows.js` 的 `entry` heuristic
- `src/crg/chunking.js` 固定行切块
- `src/crg/incremental.js` 缺少 `mtime + size` 预筛

这些问题会降低“按改动面推荐验证”的可信度。

---

## 3. 业界最佳实践调研结论

本节只保留对本项目最有约束力的部分。

### 3.1 AI coding 不是“更多提示词”，而是“更强事实和验证闭环”

Anthropic Claude Code 的最佳实践强调：

- 先探索，再计划，再编码
- 管理上下文，而不是无上限塞上下文
- 给清晰任务、清晰约束、清晰验证方式

这与当前 `spec-first` 的正确方向完全一致：不是继续堆更多 narrative docs，而是让 Stage-0 提供更真实、更少噪声、更贴近当前任务的 machine-readable context。

对 `spec-first` 的启示：

1. Stage-0 必须优先产出“当前任务真正需要的最小事实集”
2. workflow 必须优先消费 control plane，而不是回到大而散的人类文档
3. 任何“更智能的编排”都不能绕开验证闭环

### 3.2 仓库级 instruction 必须是机器可消费真源

GitHub Copilot 官方文档明确支持在仓库中通过 `copilot-instructions.md` 提供 repository custom instructions。

这说明行业共识已经非常明确：

- AI 协作不是每次重新解释项目规则
- 仓库级约束应显式、持久、可版本化
- instruction 需要成为 agent 的稳定输入，而不是会话内临时口述

对 `spec-first` 的启示：

1. `AGENTS.md` / `CLAUDE.md` / runtime workflow skill 已经走在正确方向上
2. 下一步不是再加更多自由文本，而是把 repo constraints、verification profile、quality gate 进一步结构化
3. “跨语言、多端支持”不应藏在 prompt prose 里，而要变成 control plane contract

### 3.3 小批次、短反馈、受保护主干，是高质量迭代的基础

Google 工程实践和 Trunk-Based Development 的共同结论是：

- 代码评审更适合小改动
- 分支应短命
- 频繁集成比长期分叉更稳

GitHub 对 protected branches / required status checks 的支持，则提供了行业标准的落地手段。

对 `spec-first` 的启示：

1. `1-10` 规模需求要优化“小步快跑 + 快速验证”
2. `10-100` 规模需求要优化“拆解后并行推进 + 阶段门保护”
3. AI 系统不应该鼓励“大包式一次性生成”，而应该鼓励“可验证的小单元交付”

### 3.4 文档质量不是附属品，而是 DevEx 与 AI 质量的一部分

DORA 把 documentation quality 视为影响软件交付表现的重要能力，并单独提出 AI-accessible internal data 能提升 AI 场景下的开发体验。

对 `spec-first` 的启示：

1. 文档的价值不在“写得多”，而在“结构清晰、可被 AI 正确访问”
2. `docs/contexts/<slug>/` 与 control plane 的目标不应是信息堆积，而应是 AI 可定位、可裁剪、可追溯
3. 如果 Stage-0 产物不真实、不新鲜、不可路由，文档越多只会越干扰

### 3.5 验证策略必须按平台而不是按语言定制

Playwright 官方最佳实践强调：

- 优先测试用户可见行为
- 测试应隔离
- 使用稳定定位方式，避免脆弱脚本

Android 官方测试文档强调：

- 围绕 app quality 做测试
- 以功能、体验、兼容性为核心组织验证面

Apple/Xcode 官方文档强调：

- 用 test plans 组织不同配置
- 提升反馈速度与覆盖率
- 面向真实交互组织 UI / device 级验证

对 `spec-first` 的启示：

1. 验证差异首先是“平台差异”，其次才是语言差异
2. 例如：
   - Web/H5 的关键验证是 route、交互、视觉、console/network 错误
   - Backend 的关键验证是 contract、integration、migration、rollback、性能回归
   - iOS/Android 的关键验证是 simulator/device、权限、生命周期、布局、崩溃日志
3. 因此不应该设计“Java workflow”“Python workflow”“Swift workflow”
4. 应该设计“Backend verifier”“Web verifier”“iOS verifier”“Android verifier”“Desktop verifier”

---

## 4. 面向 `1-10` 与 `10-100` 需求迭代的最佳辅助模式

## 4.1 `1-10` 规模需求：快速真实上下文 + 最小计划 + 强验证闭环

适用场景：

- 单模块优化
- 小型 bugfix
- 一个接口、一处页面、一段流程的局部增强
- 影响文件通常在 `1-10` 个量级

最佳模式：

1. **输入压缩**
   - 只给当前需求、相关模块、最小上下文、最小测试面
2. **计划轻量**
   - 保持单任务、单意图、单验证目标
3. **执行收敛**
   - 优先小 diff、避免跨多个平台面
4. **验证必选**
   - 至少跑一条与改动面强相关的 required verification
5. **沉淀简短**
   - 只记录有复用价值的 pitfall、约束、差异

对 `spec-first` 的产品要求：

- 能快速选出与本次需求最相关的 `selected_assets`
- 能给出最小必跑测试建议
- 能根据改动面提示是否需要 `test-browser` 或 `test-xcode`
- 能把验证结果与计划/审查结果绑在一起，而不是分散在会话文本里

## 4.2 `10-100` 规模需求：分解、契约、阶段门、多面验证矩阵

适用场景：

- 跨模块需求
- 一个中等 Feature，从接口到前端到测试的联动变更
- App / Web / Backend 协同改动
- 影响文件通常在 `10-100` 个量级

最佳模式：

1. **先拆子问题，再做子实现**
   - 先分 boundary、contract、sequence，再进入编码
2. **用契约而不是口头约定协调多端**
   - API contract、event contract、route contract、data model contract
3. **阶段门明确**
   - plan gate
   - implementation gate
   - verification gate
   - review gate
4. **多面验证矩阵**
   - unit
   - integration
   - e2e
   - device/simulator
   - static/lint/type
5. **按批次合入，而不是一次性大 PR**
   - 符合 trunk-based 的短分支 / 小批次集成原则

对 `spec-first` 的产品要求：

- 需要显式输出 change decomposition
- 需要显式输出 impacted surfaces
- 需要显式输出 per-surface verification matrix
- 需要显式输出 required gates 与 optional evidence
- 需要在 review 阶段检查“是否漏验证”“是否越界实现”“是否与 plan/contract 漂移”

---

## 5. `spec-first` 的目标能力模型

为了覆盖不同语言与不同开发端，建议把能力模型分成 6 层。

## 5.1 需求层

目标：

- 把自然语言需求收敛成清晰 scope、非目标、成功标准、边界条件

当前基础：

- `skills/spec-brainstorm/SKILL.md`
- `skills/spec-plan/SKILL.md`

缺口：

- 尚未把“需求规模识别”稳定影响后续编排模式

## 5.2 事实层

目标：

- 把代码库真实状态抽成 language-aware、module-aware、platform-aware facts

当前基础：

- `src/crg/parser.js`
- `src/crg/input-convergence.js`
- `src/context-routing/loader.js`
- `src/context-routing/evaluator.js`

缺口：

- Stage-0 仍 sample-driven
- 事实没有稳定映射到 verification profile

## 5.3 规划层

目标：

- 让 AI 先理解边界、依赖、验证面，再开始实施

当前基础：

- `skills/spec-plan/SKILL.md`

缺口：

- 缺少“按规模切换轻量计划 / 深计划”
- 缺少“按平台输出验证矩阵”

## 5.4 执行层

目标：

- 让 AI 在最小必要上下文中实现需求，而不是越界生成

当前基础：

- `skills/spec-work/SKILL.md`
- `skills/spec-work-beta/SKILL.md`

缺口：

- 还没有 diff-aware / platform-aware verification dispatch

## 5.5 验证层

目标：

- 让验证不是“最后顺手跑一下”，而是被计划和执行主链显式调度

当前基础：

- `skills/test-browser/SKILL.md`
- `skills/test-xcode/SKILL.md`
- `.github/workflows/crg-quality-gate.yml`

缺口：

- 没有统一 verifier registry
- 没有 required vs optional gate 语义
- 没有 per-platform test profile

## 5.6 沉淀层

目标：

- 把可复用的坑、约束、测试经验、架构例外变成下次任务的输入

当前基础：

- `skills/spec-compound/SKILL.md`
- `docs/solutions/`

缺口：

- 还没有把“验证失败原因”“平台特定坑点”“语言特定例外”系统回灌到 Stage-0

---

## 6. 设计原则：什么该统一，什么该分层

### 6.1 统一 workflow，不统一验证器

应统一：

- `spec-brainstorm`
- `spec-plan`
- `spec-work`
- `spec-code-review`
- `spec-compound`

不应统一成单一命令模板的部分：

- Web 验证
- iOS 验证
- Android 验证
- Backend integration / migration 验证
- Desktop / Electron 验证

原因：

- 用户协作范式可以统一
- 事实提取 contract 可以统一
- 但验证执行必须按平台差异化，否则只能退化成“请你自己跑测试”

### 6.2 统一事实层，不复制语言 workflow

应在事实层处理：

- Java / Python / JS/TS / Swift / Kotlin 的 parser/resolver 差异
- import / symbol / entrypoint / test surface 的语言差异

不应做：

- `spec-java-work`
- `spec-python-work`
- `spec-swift-work`

原因：

- 语言差异属于事实提取与构建链路问题
- 一旦把它提升成 workflow 分叉，会迅速制造治理负担和双宿主漂移

### 6.3 平台优先于语言

对于真实开发质量，平台维度通常比语言维度更决定验证方式。

例如：

- `TypeScript + React + H5` 与 `TypeScript + Electron + PC`，语言一样，但验证面差异极大
- `Java + Spring Backend` 与 `Kotlin + Ktor Backend`，语言不同，但 verification profile 可能非常接近

因此平台面应至少覆盖：

- `web`
- `mobile-ios`
- `mobile-android`
- `backend`
- `desktop`
- `shared-contract`

### 6.4 验证是 contract，不是建议

应把以下内容结构化：

- required verifications
- optional verifications
- verifier prerequisites
- environment blockers
- verification evidence locations

否则 agent 无法稳定判断“哪些必须做，哪些可以降级”。

### 6.5 控制面必须拆成四层 contract

后续演进不应把“verification”揉成一个越来越大的 JSON，而应稳定拆成四层：

1. **Repo profile**
   - 回答“这个仓库默认有哪些平台面、默认 required gate 是什么”
   - 对应 `verification-profile.json`
2. **Change recommendation**
   - 回答“这次改动最少该验证什么、哪些是 optional evidence”
   - 应由 CRG / review-context / change-surface 推导
3. **Verifier capability registry**
   - 回答“有哪些 verifier 能验证这些平台面、需要什么前置条件、能产出什么证据”
4. **Evidence and gate state**
   - 回答“这次实际跑了什么、哪些被 blocker 阻断、证据落在何处、CI 是否通过”

这四层各自回答不同问题：

- `verification-profile.json` 不能冒充 diff recommendation
- change recommendation 不应复制 verifier 能力清单
- verifier registry 不应硬编码业务仓库命令
- CI gate 不应直接依赖 workflow prose 判断是否通过

只有把这四层边界拆清楚，系统才不会在后续扩展中重新混成 prompt 约定。

---

## 7. 二八原则下，最值得先做的 20%

如果目标是尽快让 `spec-first` 支持跨语言、多端、高质量 AI 开发，最该优先做的是以下 5 件事。

## 7.1 P0：Stage-0 真实化

理由：

- 没有真实上下文，后续一切推荐和调度都不可信

直接关联文件：

- `src/bootstrap-compiler/compile-routing.js`
- `src/bootstrap-compiler/compile-machine-artifacts.js`
- `src/bootstrap-compiler/compile-human-assets.js`
- `src/bootstrap-compiler/orchestrator.js`
- `src/bootstrap-compiler/run-bootstrap.js`

## 7.2 P1：把 `verification-profile` 从局部接入推进为正式基线

理由：

- 当前工作区已经证明这条方向可落地；下一步关键不是重复设计，而是把 schema / compiler / sample / minimal-context / workflow / tests 做成自洽真源

## 7.3 P2：新增 change surface → verification recommendation 主链

理由：

- 用户真正需要的是“本次改动最少该验证什么”，而不是“平台理论上可怎么测”

## 7.4 P3：建立 verifier registry，并让 workflow 进入 stage-aware dispatch

理由：

- 项目已经有 `test-browser`、`test-xcode` 等积木，不缺 0 到 1 的工具，缺的是“能力清单 + 调度边界”

## 7.5 P4：把 evidence、quality gate 与 compound 回灌串成闭环

理由：

- 如果验证只存在于会话文本里，项目不会“越用越好”

---

## 8. 可执行整改方案

### 8.0 阶段边界与依赖关系

本方案建议按 4 个阶段推进，而不是把所有验证能力混做一批：

1. **Phase A: Repo profile baseline**
   - 目标是稳定 `verification-profile.json` 与 workflow summary 消费
   - 产物回答“仓库默认怎么验证”
2. **Phase B: Diff-aware recommendation**
   - 目标是把 change surface 转成最小必跑验证建议
   - 产物回答“这次改动最少该验证什么”
3. **Phase C: Verifier registry + stage-aware dispatch**
   - 目标是把现有 verifier 纳入统一能力层，并按 `plan / work / review` 阶段选择不同调度姿态
4. **Phase D: Evidence, CI gate, and feedback loop**
   - 目标是让验证结果进入 PR gate 与长期沉淀

这里最关键的依赖关系是：

- Phase A 可以与 Stage-0/CRG 基础纠偏并行推进，但不能跳过自洽与回归
- Phase B 必须建立在更可信的 Stage-0 facts 与 CRG 信号之上
- Phase C 不能早于 Phase B，否则只会把 verifier 更早接到错误推荐上
- Phase D 必须建立在 evidence contract 之上，否则 CI 只会检查“有没有写过文字说明”

## Unit 0：沿用现有整改方案，先完成 Stage-0 / CRG 基础纠偏

本单元直接承接：

- `docs/plans/2026-04-18-spec-first-ai-dev-quality-remediation-plan.md`

本单元目标：

- 修掉 Stage-0 sample-driven 主链
- 修掉 CRG 在线污染信号
- 建立 characterization / benchmark 基线

本单元未完成前，后续多端验证层会建立在不稳定事实上，收益会被稀释。

## Unit 1：把 `verification-profile.json` 固化为正式 Stage-0 基线

### 8.1 目标

完成当前分支已经在推进的 `verification-profile` 主链，把它从“局部接入中的能力”固化成可稳定依赖的 Stage-0 基线。

本单元只回答 repo 级问题：

- 这个仓库有哪些平台面
- 默认 required/optional gate 是什么
- 有哪些 verifier hint 和环境前置条件

本单元明确 **不**回答：

- 这次 diff 最少该验证什么
- 哪个 verifier 现在就应该自动执行
- CI 是否应该因为某个 optional verifier 没跑而 fail

### 8.2 新增 / 修改文件

- New: `docs/contracts/spec-graph-bootstrap/verification-profile.schema.json`
- New: `src/bootstrap-compiler/compile-verification-profile.js`
- Modify: `src/bootstrap-compiler/compile-machine-artifacts.js`
- Modify: `src/bootstrap-compiler/compile-minimal-context.js`
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `src/bootstrap-compiler/sample-generator.js`
- Modify: `src/bootstrap-compiler/schema-loader.js`
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- Test: `tests/unit/spec-graph-bootstrap-compiler.test.js`
- Test: `tests/unit/workflow-stage0-consumption.test.js`

### 8.3 建议 contract

`verification-profile.json` 至少包含：

- `schema_version`
- `generated_at`
- `profile_id`
- `platforms`
- `languages`
- `detected_test_frameworks`
- `required_gates`
- `optional_gates`
- `verifier_hints`
- `environment_prerequisites`
- `confidence`
- `fallback_reason`

说明：

- 这里的 `platforms` 是 `web / mobile-ios / mobile-android / backend / desktop / cli / shared-contract / unknown`
- 不以语言作为主分类
- workflow 只通过 `minimal-context/*.json` 中的 verification summary 消费这些信息，不直接绕过 evaluator 自己读取原始 profile
- schema / compiler / sample / workflow tests 必须原子交付；不允许只落 consumer，不落 schema 或 fixture

### 8.4 Test scenarios

- Node/Web 仓库输出 `platforms: ["web"]`
- Spring/Flask/FastAPI 类仓库输出 `platforms: ["backend"]`
- iOS 仓库输出 `mobile-ios`
- 混合仓库允许输出多平台
- 缺失平台信号时，必须退化为 `unknown`，而不是伪造
- clean checkout / tracked-only checkout 下，compiler、schema loader、contract tests 都必须可运行，不能依赖未纳入交付范围的 module / schema / fixture
- `minimal-context/plan.json`、`minimal-context/work.json`、`minimal-context/review.json` 只暴露 verification summary，不重复内嵌整份 profile

## Unit 2：建立 `change surface` 到 `verification recommendation` 的桥

### 8.5 目标

让 AI 不只知道“仓库可能有哪些验证方式”，而是知道“这次改动最少该跑什么”。

### 8.6 新增 / 修改文件

- Modify: `src/crg/changes.js`
- Modify: `src/crg/commands/review-context.js`
- Modify: `src/crg/flows.js`
- New: `src/context-routing/change-surface.js`
- Test: `tests/unit/crg-characterization.test.js`
- Test: `tests/unit/review-context.test.js`

### 8.7 输出要求

建议新增结构化输出，至少表达：

- `impacted_modules`
- `impacted_languages`
- `impacted_platforms`
- `recommended_required_verifications`
- `recommended_optional_verifications`
- `confidence`
- `reason_sources`

其中：

- `recommended_*` 应优先复用 repo profile 中已有 gate id，而不是重新发明一套第二命名空间
- `reason_sources` 至少能区分 `repo-profile`、`diff-signal`、`manual-override`
- 低置信度时允许输出“需要人工确认”，不允许伪装成高确定性推荐

### 8.8 Test scenarios

- 前端页面改动推荐 browser verification
- iOS UI 改动推荐 xcode/simulator verification
- 后端接口改动推荐 contract + integration verification
- shared contract 改动同时提示上下游验证
- 低置信度场景必须显式标注 `confidence: low`

## Unit 3：把 `spec-plan` / `spec-work` / `spec-code-review` 接到 verification summary

### 8.9 目标

让 workflow 能读 control plane，按改动与平台决定 required gate，而不是只给泛化建议。

### 8.10 新增 / 修改文件

- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/workflow-stage0-consumption.test.js`
- Modify: `tests/unit/spec-work-contracts.test.js`
- Modify: `tests/unit/spec-plan-contracts.test.js`

### 8.11 设计要求

- `spec-plan`
  - 输出 verification matrix 草案
- `spec-work`
  - 输出 required gate checklist
- `spec-code-review`
  - 检查实现是否漏掉 required verifications
- 三个 workflow 都只消费 evaluator / minimal-context 暴露出的 summary，不直接自己打开 `verification-profile.json` 或未来 change artifact
- 本单元仍以“形成 checklist 与缺口检查”为主，不要求自动执行 verifier

### 8.12 Test scenarios

- `verification-profile.json` 存在时，workflow 优先消费它
- profile 缺失时，workflow 只能降级，不得捏造平台验证要求
- 仅命中 docs / prompt / non-runtime 变更时，不强行触发 browser/xcode 验证

## Unit 4：把现有平台 skill 纳入统一 verifier registry

### 8.13 目标

复用现有 `test-browser`、`test-xcode` 等能力，不再让它们与主 workflow 脱节。

### 8.14 新增 / 修改文件

- New: `docs/contracts/verifiers/verifier-registry.schema.json`
- New: `src/context-routing/verifier-registry.js`
- Modify: `skills/test-browser/SKILL.md`
- Modify: `skills/test-xcode/SKILL.md`
- Modify: `skills/spec-mcp-setup/SKILL.md`
- Modify: `skills/spec-mcp-setup/mcp-tools.json`
- Test: `tests/unit/test-xcode-contracts.test.js`
- Test: `tests/unit/agent-browser-contracts.test.js`

### 8.15 设计要求

registry 只表达：

- verifier id
- supported platforms
- prerequisites
- evidence outputs
- invocation hints

不在 registry 中硬编码业务仓库命令。

补充边界：

- registry 回答“能做什么”，不回答“这次一定要做什么”
- repo-specific command 仍应来自 repo profile、change recommendation 或仓库脚本事实，而不是 registry
- host-specific entrypoint 仍遵循当前 dual-host governance，不在 registry 中复制一遍 slash-command 规则

### 8.16 Test scenarios

- Web verifier 正确标识 `browser evidence`
- iOS verifier 正确标识 simulator / screenshot / logs
- 缺少 tool prerequisite 时，workflow 输出 blocker 而不是假装已验证

## Unit 5：把 required gate 接到 CI / branch protection 语义

### 8.17 目标

让“必须验证”的约束不止停留在会话层，而进入仓库 gate 体系。

### 8.18 新增 / 修改文件

- Modify: `.github/workflows/crg-quality-gate.yml`
- New: `.github/workflows/ai-dev-quality-gate.yml`
- New: `src/cli/contracts/quality-gates/branch-protection-policy.json`
- New: `src/cli/contracts/quality-gates/branch-protection-policy.schema.json`
- New: `tests/integration/verification-gate.integration.test.js`
- Modify: `docs/08-版本更新/README.md`（当该单元落地时）

### 8.19 设计要求

- 保留现有 CRG quality gate
- 新增 AI-dev quality gate，聚焦：
  - Stage-0 contract 完整性
  - verification profile 生成
  - 关键 workflow contract
  - regression benchmark
- branch protection 先落 advisory policy baseline：
  - 只表达建议 required checks
  - 只表达 workflow / job / command / 覆盖面
  - 不自动修改 GitHub protection 设置
  - 不把 required checks 反向解释成 workflow 状态机

### 8.20 Test scenarios

- 改动 Stage-0/compiler 相关代码时，quality gate 自动触发
- contract 缺失时 PR fail
- benchmark 明显回退时 PR fail

## Unit 6：把验证经验回灌到 compound / Stage-0

### 8.21 目标

让系统真正形成“越用越懂仓库”的闭环。

### 8.22 新增 / 修改文件

- Modify: `skills/spec-compound/SKILL.md`
- Modify: `skills/spec-compound-refresh/SKILL.md`
- New: `docs/contracts/quality-gates/quality-feedback-topics.schema.json`
- New: `src/context-routing/quality-feedback.js`
- Modify: `scripts/run-ai-dev-quality-gate.js`
- Test: `tests/unit/spec-compound-contracts.test.js`

### 8.23 回灌内容

- 平台特定坑点
- 环境前置条件
- 易错验证步骤
- 高价值失败模式

补充边界：

- 回灌应先落成被动 artifact，再允许 workflow 读取
- artifact 只提供 `candidate_topics / scope_hint / artifact_paths / evidence_refs`
- 不自动触发 `compound` / `compound-refresh`
- 不把 gate 失败解释成 workflow 状态流转

### 8.24 Test scenarios

- 同类失败可被沉淀为 pitfall
- 无复用价值的一次性日志不进入长期 learnings
- 回灌内容必须带来源与适用边界

---

## 9. 不同技术栈下的落地方式

本节回答“如何覆盖 Java / Python / App / PC / 前端 / H5 / 后端”等问题。

## 9.1 Java / Python / JS/TS：放在 language-aware facts 层

应处理的内容：

- parser / symbol extraction
- test framework detection
- entrypoint / module / call graph 解析
- import / dependency / ownership 信号

不应处理的内容：

- 为每种语言单独设计 workflow

## 9.2 前端 / H5：放在 Web verification profile

关键验证面：

- route reachability
- 关键交互
- console / network error
- 视觉与布局异常
- e2e smoke

可复用现有能力：

- `skills/test-browser/SKILL.md`

## 9.3 后端：放在 Backend verification profile

关键验证面：

- unit
- integration
- contract
- migration
- rollback
- perf / error budget（按需）

当前缺口：

- 还没有统一 backend verifier contract
- `spec-work` 仍偏泛化命令建议

## 9.4 iOS / Android：放在 Mobile verification profile

关键验证面：

- simulator / emulator
- 权限与生命周期
- UI / layout
- crash / logs
- device-specific flows

当前基础：

- iOS 已有 `skills/test-xcode/SKILL.md`

当前缺口：

- Android 尚未形成等价 verifier
- mobile verifier 还没被主 workflow 统一路由

## 9.5 PC / Desktop：放在 Desktop verification profile

适用对象：

- Electron
- Tauri
- 原生桌面应用

关键验证面：

- window / menu / file-system / permission / crash
- 不同于普通 Web 页面验证

建议：

- Desktop 与 Web 分开建 verifier profile，不要混成一个“前端测试”

---

## 10. 建议的推进顺序

按依赖关系，建议这样推进：

1. 先把当前分支中的 `verification-profile` 主链补齐成 **自洽、可回归、可 clean-checkout 的 Phase A 基线**
2. 并行继续推进 `docs/plans/2026-04-18-spec-first-ai-dev-quality-remediation-plan.md` 中直接影响事实质量的 Unit 0-4
3. 在 Phase A 与基础事实质量都稳定后，再落 `change surface -> verification recommendation`
4. 再把 `test-browser / test-xcode / 未来 Android verifier` 纳入 registry，并定义 `plan / work / review` 的 stage-aware dispatch posture
5. 再把 required gate 与 evidence contract 升级到 CI / branch protection advisory policy 语义
6. 最后把验证 learnings 以被动 feedback artifact 形式回灌到 compound / Stage-0

不建议的顺序：

- 把 repo profile、diff recommendation、verifier registry、CI gate 混成一个大而全 contract
- 先做大量新 verifier，却没有 verification profile
- 先把 verifier 自动执行接进 workflow，却没有稳定的 change recommendation
- 先做重型算法升级，却没有 Stage-0 真实化
- 先按语言复制 workflow，制造治理分叉

---

## 11. 风险与边界

### 11.1 这轮不建议优先做的事

- 直接重写成“每语言一套 workflow”
- 一次性做全量 AST-aware chunking 重构
- 一次性做全链路多仓 + 多端 + 多环境自动编排
- 先扩 verifier 数量，再补真源 contract

### 11.2 最大风险

如果不先解决 Stage-0 与 verification profile 真源问题，系统很容易进入一种假繁荣：

- 文档更多了
- skill 更多了
- verifier 更多了
- 但 AI 仍不知道本次需求最该看什么、最该改什么、最该验什么

更具体地说，这轮最需要防的有 4 类架构性误伤：

1. **把 repo profile 当成 diff recommendation**
   - 结果会把“仓库通常应该怎么验”误当成“这次改动必须怎么验”
2. **让 workflow 绕开 evaluator 直接读取底层 contract**
   - 结果会重新制造第二套 control plane，破坏 Stage-0 真源收敛
3. **让 verifier registry 承担 repo-specific command 语义**
   - 结果会把能力清单和仓库策略耦死，难以跨仓复用
4. **以半接入状态落地 control-plane 改造**
   - 结果会出现 schema、module、fixture、tests 不自洽，clean checkout 不可运行

---

## 12. 验收标准

当以下结果成立时，可以认为 `spec-first` 已进入“可高质量辅助跨语言、多端开发”的第一阶段：

1. Stage-0 产物不再主要依赖 sample / placeholder，且 verification 相关产物在 clean checkout 下可稳定生成
2. 每个 repo 都能稳定生成 repo-scoped 的 `verification-profile.json`
3. workflow 能通过 evaluator summary 读取 repo profile，并根据 change surface 输出 required verification checklist
4. repo profile、change recommendation、verifier registry、evidence/gate state 四层 contract 的边界清晰且不互相越权
5. Web / iOS / Backend 至少 3 类 verifier 被统一 registry 描述，并能被 workflow 作为可选调度能力识别
6. PR 上存在 AI-dev quality gate，而不是只有 CRG 子系统 gate
7. compound 能沉淀高价值验证坑点并被后续任务检索到

---

## 13. 参考资料

以下资料用于提炼本文中的业界最佳实践结论：

- Anthropic Claude Code Best Practices
  - <https://code.claude.com/docs/en/best-practices>
- GitHub Copilot repository custom instructions
  - <https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot>
- GitHub protected branches / required status checks
  - <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>
- Google Software Engineering at Google, Chapter 9 Code Review
  - <https://abseil.io/resources/swe-book/html/ch09.html>
- Trunk-Based Development, short-lived feature branches
  - <https://trunkbaseddevelopment.com/short-lived-feature-branches/>
- DORA, AI-accessible internal data
  - <https://dora.dev/capabilities/ai-accessible-internal-data/>
- DORA, documentation quality
  - <https://dora.dev/devops-capabilities/process/documentation-quality/>
- Playwright Best Practices
  - <https://playwright.dev/docs/best-practices>
- Android Developers, what to test
  - <https://developer.android.com/tools/testing/what_to_test>
- Apple Xcode testing guidance
  - <https://developer.apple.com/documentation/xcode/organizing-tests-to-improve-feedback>
