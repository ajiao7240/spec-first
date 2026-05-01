# spec-app-consistency-audit 与 ECC Agent 专家集成思考

审查对象：`docs/02-架构设计/spec_app_consistency_audit_技术方案.md`

分析对象：当前 `everything-claude-code/agents/*.md` 中可复用的专家能力。

结论先行：`spec-app-consistency-audit` 需要的是一组面向移动 App 一致性审计的专家视角，而不是直接复用 ECC 的通用执行型 agent 池。短期最优方案是把 ECC agent 作为“专家能力素材”和“只读 lens/checklist”来源，改造成 `spec-first` 原生的 app-audit 专家 prompts；不要在 MVP 阶段把 ECC agent 原样导入 `spec-first/agents/`。当前主方案已经把这层能力落到 `## 8.17 ECC Derived Lens Integration`，这里负责解释为什么这样集成、哪些能力可以迁移、哪些能力必须留在原生实现里。

---

## 1. 方案解读

`spec-app-consistency-audit` 是一个静态优先的移动 App 一致性审计 Skill。它把 PRD、Figma、源码、路由、KMP/Clean Architecture、工程质量、组件模块复用、交互状态、埋点、国际化和行业规则统一抽取为结构化 contract，再由专家审查输出 evidence-backed issues。

它的核心边界是：

| 维度 | 方案口径 |
|---|---|
| 默认模式 | 静态审查优先 |
| 非目标 | 不默认启动真机、模拟器、Appium、Maestro 或打包流程 |
| 架构原则 | Light Contract、Explicit Boundaries、Scripts prepare, LLM decides、Preview-first |
| 专家模式 | 协议概念，不绑定单一 runtime；Claude Code 可用 subagent，Codex 可顺序执行专家轮次 |
| 输出约束 | No evidence, no issue；问题必须带 provenance、confidence、runtime verification policy |

因此这里的“Agent 专家”不是普通代码修复 agent，而是面向审计矩阵的只读判断角色。任何从 ECC 引入的 agent 都必须先降级为只读专家视角，不能拥有最终 verdict，也不能主动改代码。

---

## 2. 集成判断原则

结合当前 `spec-first` 与 ECC 集成方案，本文采用以下判断原则：

1. **不直接导入 ECC commands/hooks**：app-audit 不需要第二套入口。
2. **不在 MVP 默认导入 ECC agents**：当前 `spec-first` agent 分发仍缺少 pack-aware filtering。
3. **优先改造成 app-audit 原生专家 prompt**：保留 ECC agent 的专业 checklist、风险模式、审查语言，去掉执行/修复职责。
4. **只读优先**：带 `Write`、`Edit`、修复、优化、清理倾向的 ECC agent 只能作为参考材料或后续手动 follow-up，不进入审计主流程。
5. **证据协议优先**：所有专家输出必须服从 app-audit issue schema、evidence/provenance、confidence 和 runtime verification policy。
6. **行业能力不硬凑**：ECC 当前只有 `healthcare-reviewer` 是明确行业 agent；金融、证券、电商应由 app-audit rule packs/native prompts 承担。

---

## 3. app-audit 专家角色与 ECC agent 映射

| app-audit 专家 | 主要职责 | 可参考 ECC agent | 推荐集成形态 | 结论 |
|---|---|---|---|---|
| Orchestrator Agent / 总编排专家 | 管控审计阶段、合并 contract、调度专家、控制输出一致性 | `planner`、`architect`、`code-architect` | 抽取规划/架构分解方法，写成 app-audit native orchestrator prompt | 可参考，不直接导入 |
| Product Expert / 产品需求专家 | 从 PRD 抽取功能、状态、约束、验收点 | `planner`、少量 `chief-of-staff` 分级思路 | `planner` 可提供需求拆解视角；`chief-of-staff` 只参考信息分级，不导入 | 需要原生实现 |
| Figma Design Expert / 设计实现专家 | 对齐 Figma 结构、视觉状态、组件语义 | `a11y-architect`、`code-architect` | 使用 a11y/design-system 约束补充；Figma 对齐逻辑需原生实现 | 部分可参考 |
| Page Route Expert / 页面路由专家 | 抽取页面、导航、深链、入口、状态流 | `code-explorer`、`code-architect`、`kotlin-reviewer`、`flutter-reviewer` | 抽取代码路径追踪和平台路由审查 checklist | 可改造成只读 lens |
| Mobile UX Expert / 移动端交互专家 | 审查移动端状态、错误、空态、确认、撤销、权限等交互 | `a11y-architect`、`silent-failure-hunter`、`e2e-runner` | 静态阶段参考 a11y 与 silent failure；`e2e-runner` 只用于生成后续验证建议 | 强烈建议集成为 lens |
| KMP Clean Architect / KMP + Clean 架构专家 | 审查 KMP 分层、依赖方向、UiState、coroutine、Compose | `kotlin-reviewer`、`code-architect`、`architect`、`java-reviewer` | 以 `kotlin-reviewer` 为核心素材，改造成 KMP/Clean 只读专家 | 高价值，优先集成 |
| Engineering Quality Expert / App 工程质量专家 | 审查错误处理、性能、安全、类型设计、可维护性 | `code-reviewer`、`security-reviewer`、`performance-optimizer`、`silent-failure-hunter`、`type-design-analyzer`、`comment-analyzer` | 拆成多个只读子 lens，不引入修复型工具权限 | 高价值，但需收敛 |
| Component Module Expert / 组件化模块化复用专家 | 审查组件边界、模块划分、复用、重复实现 | `code-architect`、`architect`、`code-simplifier`、`refactor-cleaner` | 只采用架构/重复风险 checklist；`code-simplifier`/`refactor-cleaner` 不进入主流程 | 可参考，谨慎集成 |
| Analytics Expert / 埋点专家 | 审查事件覆盖、参数一致性、跨端一致性、隐私边界 | `silent-failure-hunter`、`code-reviewer`、`kotlin-reviewer` | ECC 无专门 analytics agent；只借用 silent failure 和代码审查视角 | 需要原生实现 |
| I18n Expert / 国际化专家 | 审查文案外置、locale 覆盖、长度膨胀、RTL、格式化 | `a11y-architect`、`kotlin-reviewer`、`flutter-reviewer`、`typescript-reviewer` | ECC 无专门 i18n agent；平台 reviewer 可补充实现风险 | 需要原生实现 |
| Industry Expert / 行业专家 | 金融、证券、电商、医疗等行业规则一致性 | `healthcare-reviewer` | 仅医疗方向可参考；金融/证券/电商靠 app-audit rule packs | 医疗可后续集成 |
| Evidence Auditor / 证据审计专家 | 审核 issue 是否有证据、置信度、来源和推理链 | `code-reviewer`、`pr-test-analyzer`、`silent-failure-hunter`、`type-design-analyzer` | 抽取“证据充分性”和“行为覆盖”审查模式 | 高价值，优先集成 |
| Regression Expert / 回归建议专家 | 生成后续验证建议、测试焦点、最小回归路径 | `pr-test-analyzer`、`e2e-runner`、`tdd-guide`、`build-error-resolver` | 静态审计只输出建议；不默认运行测试或修 build | 可集成为建议专家 |
| Report Writer / 报告专家 | 汇总发现、矩阵、风险、建议、preview writeback | `doc-updater`、`comment-analyzer` | 参考报告组织与注释腐化风险；报告格式仍由 app-audit schema 控制 | 可参考，不必直接导入 |

---

## 4. 优先集成候选

### 4.1 第一优先级：高增量、低冲突

| ECC agent | 可增强的 app-audit 专家 | 增量价值 | 集成建议 |
|---|---|---|---|
| `kotlin-reviewer` | KMP Clean Architect、Page Route Expert、Engineering Quality Expert | Kotlin/KMP、coroutine、Compose、Clean Architecture 审查高度匹配 MVP 目标 | 抽成 `app-audit-kmp-clean-lens` 或写入 KMP expert prompt |
| `a11y-architect` | Figma Design Expert、Mobile UX Expert、I18n Expert | WCAG、ARIA/native accessibility、移动交互可访问性覆盖 app-audit 原方案 | 抽成 `app-audit-accessibility-mobile-lens` |
| `silent-failure-hunter` | Mobile UX Expert、Analytics Expert、Engineering Quality Expert、Evidence Auditor | 能发现 swallowed errors、坏 fallback、缺失错误传播，与“静态发现交互/埋点缺口”很契合 | 抽成只读 failure-state lens |
| `type-design-analyzer` | KMP Clean Architect、Engineering Quality Expert、Evidence Auditor | UiState、sealed class、类型表达 invariant 的审查价值高 | 抽成 state/invariant lens |
| `code-explorer` | Page Route Expert、Orchestrator Agent | 擅长追踪执行路径、架构层、依赖，对页面路由抽取有帮助 | 作为脚本产物解释专家的参考 prompt |
| `code-architect` | KMP Clean Architect、Component Module Expert、Orchestrator Agent | 能把现有代码模式转为架构蓝图，对模块边界与依赖方向有帮助 | 作为 architecture lens，不授予改造职责 |
| `pr-test-analyzer` | Evidence Auditor、Regression Expert | 对行为覆盖和真实 bug prevention 的关注适合回归建议 | 改造成静态 regression recommendation prompt |

### 4.2 第二优先级：有价值但要裁剪

| ECC agent | 风险点 | 推荐处理 |
|---|---|---|
| `code-reviewer` | 过于泛化，可能覆盖 app-audit 专家职责 | 只抽取通用质量 checklist，不作为独立主专家 |
| `security-reviewer` | 带修复/写入倾向，且 app-audit 不是安全专项审计 | 仅保留隐私、敏感数据、认证边界 checklist |
| `performance-optimizer` | 带优化执行倾向，容易越界到性能专项 | 只保留移动端静态性能风险 lens，例如重组、过度渲染、N+1、主线程阻塞 |
| `flutter-reviewer` | 对 Flutter 项目有用，但 MVP 聚焦 KMP | 作为后续跨技术栈 pack |
| `java-reviewer` | Android Java/Spring 部分能力可补充，但不是核心 | 作为 Android legacy 代码 lens |
| `typescript-reviewer` | 只对 React Native / Node tooling 有意义 | 后续 React Native pack 再启用 |
| `doc-updater` | 原职责是写文档，可能与 report writer 边界冲突 | 只参考报告结构，不导入执行能力 |
| `e2e-runner` | 默认会生成/运行 E2E，违背静态优先 | 只用于 runtime verification suggestion，不默认执行 |
| `tdd-guide` | 强制测试先行与 app-audit 静态审计不是同一流程 | 只参考测试建议模板 |
| `healthcare-reviewer` | 行业范围窄，且可能涉及高风险医疗判断 | 只作为 healthcare rule pack 的参考，需单独安全边界 |

### 4.3 不建议进入主流程

| ECC agent | 不建议原因 |
|---|---|
| `chief-of-staff` | 通信工作流 agent，与 app 审计主职责不匹配 |
| `docs-lookup` | app-audit 依赖本地 PRD/Figma/code 和规则包；外部文档查找不是主流程默认能力 |
| `database-reviewer` | 移动 App 一致性审计通常不直接审数据库 schema；可留给后端专项 |
| `code-simplifier` | 具备改写/简化倾向，可能越过静态审计边界 |
| `refactor-cleaner` | 具备删除/清理倾向，风险高，不适合审计主流程 |
| `build-error-resolver` | 只在实际构建失败后作为 follow-up resolver，不属于默认静态审计 |
| 语言 build resolver 系列 | 与默认 no-build/no-package policy 冲突，只能后续失败场景调用 |
| `performance-optimizer` 原样形态 | 优化型 agent 容易提出超范围重构，不能原样导入 |
| `security-reviewer` 原样形态 | 安全修复型行为和工具权限过宽，不能原样导入 |

---

## 5. 推荐改造后的 app-audit 专家 prompt 与 supporting lens

不要把 ECC agent 名字直接暴露给 `spec-app-consistency-audit` 用户；建议在 app-audit 内部形成一组原生专家 prompts 和 supporting lenses，并在来源说明中标注参考 ECC agent。

| app-audit 原生专家 prompt | 参考来源 | 角色定位 |
|---|---|---|
| `kmp-clean-architect.md` | `kotlin-reviewer`、`code-architect`、`type-design-analyzer` | KMP/Clean/UiState/coroutine/Compose 静态审查 |
| `mobile-ux-expert.md` | `a11y-architect`、`silent-failure-hunter` | 空态、错误态、确认态、权限、可访问性、静默失败 |
| `page-route-expert.md` | `code-explorer`、`kotlin-reviewer`、`flutter-reviewer` | 页面、导航、入口、深链、状态流 |
| `engineering-quality-expert.md` | `code-reviewer`、`silent-failure-hunter`、`type-design-analyzer`、`comment-analyzer` | 质量、错误传播、类型建模、注释腐化、维护风险 |
| `component-module-expert.md` | `architect`、`code-architect` | 模块边界、组件复用、依赖方向、重复实现 |
| `evidence-auditor.md` | `pr-test-analyzer`、`code-reviewer`、`silent-failure-hunter` | 证据充分性、行为影响、置信度、runtime verification |
| `regression-expert.md` | `pr-test-analyzer`、`e2e-runner`、`tdd-guide` | 后续测试焦点与最小回归建议，不执行测试 |
| `accessibility-i18n-lens.md` | `a11y-architect`、平台 reviewer | 可访问性、文案长度、locale、RTL、动态字体风险 |

这组 prompts 与目标方案的 14 个专家并不一一复制 ECC agent。`accessibility-i18n-lens.md` 是 supporting lens，不拥有最终 verdict；它只为 Figma / Mobile UX / I18n 审查补充可访问性、文案膨胀和 locale 风险输入。

---

## 6. 集成方式建议

### 6.1 MVP：参考素材进入，不导入 agent 文件

MVP 不建议新增 `spec-first/agents/ecc-*`。更安全的做法是：

1. 读取 ECC agent 文档作为来源材料。
2. 手工抽取适配 app-audit 的 checklist、风险模式、审查问题。
3. 写入 `skills/spec-app-consistency-audit/prompts/*.md`。
4. 每个 prompt 明确：
   - 只读审查；
   - 不修改代码；
   - 不运行构建；
   - 不给最终 verdict；
   - 输出必须符合 app-audit issue protocol。

建议 MVP 先集成 5 个 ECC-derived lens：

| Lens | 来源 | 目标专家 |
|---|---|---|
| `kmp-clean-lens` | `kotlin-reviewer`、`type-design-analyzer` | KMP Clean Architect |
| `mobile-accessibility-lens` | `a11y-architect` | Figma Design / Mobile UX / I18n |
| `silent-failure-state-lens` | `silent-failure-hunter` | Mobile UX / Analytics / Engineering Quality |
| `route-code-exploration-lens` | `code-explorer`、`code-architect` | Page Route Expert |
| `evidence-regression-lens` | `pr-test-analyzer` | Evidence Auditor / Regression Expert |

### 6.2 Post-MVP：pack-aware agent governance 后再接 agent

只有当 `spec-first` 具备以下能力后，才考虑真正下发 ECC-derived agents：

| 前置能力 | 必要性 |
|---|---|
| agent governance / filtering | 避免所有 app-audit agent 默认进入所有 runtime |
| capability pack gating | 只在启用 app-audit 或 ECC pack 时出现 |
| read-only tool contract | 防止审计 agent 写文件、改代码、跑超范围命令 |
| output schema adapter | 让 agent 输出能被 app-audit issue schema 消费 |
| no-final-verdict rule | 保证最终结论由 app-audit orchestrator/report writer 统一合成 |
| Codex-compatible execution protocol | 避免 Claude Task/subagent 假设泄漏到 Codex |

Post-MVP 首批可 agent 化的候选是：

| 候选 agent | 原因 |
|---|---|
| `kotlin-reviewer` 派生版 | 与 KMP MVP 目标高度一致 |
| `a11y-architect` 派生版 | App 交互、Figma、一致性审计都需要可访问性 lens |
| `silent-failure-hunter` 派生版 | 静态发现状态遗漏、fallback、错误吞没非常适配 |
| `type-design-analyzer` 派生版 | UiState/invariant 审查是移动一致性审计关键能力 |
| `pr-test-analyzer` 派生版 | Evidence auditor 和 regression suggestion 都需要它的测试覆盖视角 |

### 6.3 目录归属政策

MVP 阶段，ECC 派生能力先落到 Skill 本地 prompts：

```text
skills/spec-app-consistency-audit/prompts/
```

这里承载 app-audit 专属的只读 lens、证据审计角色和回归建议角色。它们依赖本 Skill 的 issue schema、rule packs 和 preview-first 输出，不适合直接晋升为全局 agent。

```text
spec-first/agents/
```

这里只保留跨 workflow 稳定复用的通用专家。除非某个 ECC 派生能力已经证明与 app-audit 无关、也能在多个 workflow 中稳定复用，否则不要把它写入 `agents/`。

---

## 7. 与目标方案专家的缺口

当前 ECC agent 池不能完整覆盖 app-audit 目标专家，以下能力必须由 `spec-first` 原生设计：

| 缺口 | 原因 | 建议 |
|---|---|---|
| Product Expert | ECC 无专门 PRD contract extraction agent | 原生实现需求抽取和验收点建模 |
| Figma Design Expert | ECC 无专门 Figma MCP / frame contract agent | 原生实现 Figma contract 与 design-code matrix |
| Analytics Expert | ECC 无专门埋点专家 | 原生实现事件命名、参数、跨端一致性、隐私边界规则 |
| I18n Expert | ECC 无专门国际化专家 | 原生实现 locale、文案长度、RTL、动态字体、格式化规则 |
| Finance/Securities/Ecommerce Industry Expert | ECC 当前无金融/证券/电商专家 agent | 依赖 app-audit rule packs 和行业 native prompts |
| Report Writer | ECC `doc-updater` 是文档写入 agent，不是审计报告 schema writer | 原生实现 schema-first report writer |

这些缺口不应通过强行复用通用 code reviewer 补齐，否则会把 app-audit 变成泛代码评审，稀释“产品/设计/架构/交互/埋点/行业一致性”的核心定位。

---

## 8. 分阶段路线

### Phase 0：来源锁定与安全清洗

| 工作 | Done Signal |
|---|---|
| 记录被参考的 ECC agent 文件、版本、commit、hash | source lock 中可追踪 |
| 删除执行/修复/写入/运行测试语义 | prompts 中只保留只读审计措辞 |
| 映射到 app-audit issue protocol | 每个专家输出都能产生 evidence/provenance/confidence |

### Phase 1：MVP lens 素材集成

优先将以下素材合入 app-audit prompts：

1. `kotlin-reviewer` → KMP/Clean/Compose/coroutine lens。
2. `a11y-architect` → accessibility/mobile UX lens。
3. `silent-failure-hunter` → failure-state/analytics gap lens。
4. `type-design-analyzer` → UiState/invariant lens。
5. `pr-test-analyzer` → evidence/regression lens。

### Phase 2：补齐原生专家缺口

实现 ECC 无法覆盖的专家：

1. Product Expert。
2. Figma Design Expert。
3. Analytics Expert。
4. I18n Expert。
5. Finance/Securities/Ecommerce Industry Expert。
6. Report Writer。

### Phase 3：跨技术栈扩展

在 KMP MVP 稳定后，再引入：

| 技术栈 | 可参考 ECC agent |
|---|---|
| Flutter | `flutter-reviewer` |
| React Native | `typescript-reviewer` |
| Android legacy Java | `java-reviewer` |
| 后端/API 边界 | `security-reviewer`、`performance-optimizer`、`database-reviewer`，但仅限相关项目 |

### Phase 4：真正 agent 化

等 `spec-first` 完成 agent governance 后，再把部分 lens 升级为可调度专家 agent。升级时必须保留：

```text
read-only
schema-compatible
no final verdict
pack-gated
no command/hook dependency
Codex-compatible fallback
```

---

## 9. 最终建议

最值得从当前 ECC 集成进 `spec-app-consistency-audit` 的不是完整 agent 文件，而是以下专家能力：

```text
kotlin-reviewer
        → KMP/Clean/Compose/coroutine 审查能力

a11y-architect
        → 移动端可访问性与交互包容性审查能力

silent-failure-hunter
        → 静默失败、错误吞没、坏 fallback、状态缺失审查能力

type-design-analyzer
        → UiState、sealed hierarchy、类型 invariant 审查能力

code-explorer / code-architect
        → 页面路由、模块边界、依赖方向和代码路径追踪能力

pr-test-analyzer / e2e-runner / tdd-guide
        → 回归建议和后续验证设计能力，不默认执行
```

不建议 MVP 集成：

```text
ECC commands
ECC hooks
原样 ECC agents
带 Write/Edit 的修复型 agent
build resolver 系列
code-simplifier / refactor-cleaner
database-reviewer 作为默认 app-audit 专家
performance-optimizer / security-reviewer 的原始执行形态
```

一句话结论：

```text
spec-app-consistency-audit 可以吸收 ECC 的 Kotlin、可访问性、静默失败、类型设计、代码路径追踪和回归建议能力；但应先改造成 app-audit 原生只读专家 lens，而不是把 ECC agent 池直接接入 spec-first。
```

---

## 10. 落地到当前方案的执行建议

建议把 ECC 侧能力只落到三处：

1. `docs/02-架构设计/spec_app_consistency_audit_技术方案.md` 的 `8.17` 节，作为主方案的能力来源说明。
2. `skills/spec-app-consistency-audit/prompts/*.md`，作为原生专家 prompt 的来源注释。
3. `skills/spec-app-consistency-audit/references/ecc-source-lock.json`，记录参考 agent、commit、hash、吸收能力和剔除能力。
4. `skills/spec-app-consistency-audit/scripts/*` 和 `schemas/*`，只承接结构化输入和 evidence gate，不承接执行型 agent 职责。

建议优先集成的 lens 顺序是：

| 顺序 | ECC 来源 | app-audit 落点 | 理由 |
|---|---|---|---|
| 1 | `kotlin-reviewer` + `type-design-analyzer` | `kmp-clean-architect.md` | 最贴近 KMP / Clean Architecture MVP 主链路 |
| 2 | `a11y-architect` | `mobile-ux-expert.md` + `accessibility-i18n-lens.md` | 直接增强移动端交互包容性与文案风险识别 |
| 3 | `silent-failure-hunter` | `engineering-quality-expert.md` + `evidence-auditor.md` | 提升静默失败、坏 fallback、错误传播审查质量 |
| 4 | `code-explorer` + `code-architect` | `page-route-expert.md` + `component-module-expert.md` | 加强路径追踪、边界与依赖方向分析 |
| 5 | `pr-test-analyzer` | `regression-expert.md` | 把高价值问题转成可验证的回归建议 |
| 6 | `security-reviewer` | `engineering-quality-expert.md` 的安全分支 | 只吸收敏感数据、输入验证、权限、WebView/Deep Link 风险模式 |

不建议做的事情：

```text
1. 不把 ECC agent 原样复制到 spec-first runtime。
2. 不给 app-audit 专家额外的写入、修复或 build 权限。
3. 不把 commands / hooks 作为 app-audit 的默认依赖。
4. 不让 report writer 退化成通用 doc updater。
5. 不让行业能力依赖通用 code review 去补齐。
```

如果后续要继续推进，可以先把这一套结论同步到 app-audit 的 `prompts/` 目录，再做一次只读 fresh-source 评审，确认每个 expert prompt 仍然服从 `No evidence, no issue` 与 preview-first 边界。
