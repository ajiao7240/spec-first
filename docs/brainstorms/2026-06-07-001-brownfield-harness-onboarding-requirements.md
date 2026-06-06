---
date: 2026-06-07
topic: brownfield-harness-onboarding
spec_id: 2026-06-07-001-brownfield-harness-onboarding
---

# Brownfield Harness Onboarding(存量库渐进引入流程)

## Summary

为陌生的存量代码库提供一个渐进式 onboarding 能力:首次只建立一层**薄全局定向骨架**并标出未覆盖区,再由第一个真实任务驱动切片深化;成功标准是"第一个真实任务可安全开始",而非建成完整项目地图。它是 ① 导航地图与 ⑤ 渐进 adoption 的合流,也是 ②(知识 cold-start)与 ③(影响面)两个已拍板能力的挂靠地基。

---

## Problem Frame

把 AI agent 放进十万行级、技术栈交织的存量库时,核心矛盾是 cold start:库的隐性知识(关键链路、字段约束、高频变更区)没有机器可读形式,agent 的知识边界等于文件边界。现状下 spec-first 已覆盖"**能力维度**的渐进引入"(minimal→recommended→platform),但缺"**代码库语义** onboarding"——开发者接手陌生大库时,要么被迫通读全库,要么让 agent 在零上下文下盲改。文章《Harness Engineering》也把"存量库渐进引入而不被技术债淹没"列为公认开放问题。

约束前提(已核验):仓库 2026-06-03 收敛决策明确"不恢复 graph-bootstrap",此能力必须走 workflow/方法论层,默认不碰 provider 核心路径。详见 `docs/09-业界借鉴/2026-06-07-Harness-Engineering对照-spec-first架构分析.md` 第七节。

> 编号说明:正文 ①–⑤ 沿用 `docs/09` 报告第七节的待优化点清单——① 导航地图、② 知识 cold-start、③ 影响面、④ 技术债 baseline、⑤ 渐进 adoption。本 doc 聚焦 ①⑤ 合流的 onboarding 流程,衔接 ②③④。

---

## Actors

- A1. 开发者:接手存量库,发起 onboarding,审阅并确认产物(尤其入口文件改动)。
- A2. AI agent:消费导航骨架 + 切片上下文,在库内安全执行第一个及后续真实任务。
- A3. onboarding 流程:编排 script-owned 确定性事实(文件树/语言/模块边界/git 热点)与 LLM 语义判断(关键链路、约束识别),产出导航层与切片上下文。

---

## Key Flows

- F1. 首次 onboarding(建薄骨架)
  - **Trigger:** 开发者对一个尚无 spec-first 上下文的存量库发起 onboarding。
  - **Actors:** A1, A3
  - **Steps:** 采集确定性事实(模块边界/技术栈/入口/git 热点)→ LLM 提炼薄全局定向层 + 约束来源指针 → 记录现有告警/技术债 baseline 快照 → 明确标出未覆盖区 → 产物落独立 docs,入口改动以 preview 请 A1 确认。
  - **Outcome:** 存在一层薄、可增长、不冒充完整的全局导航 + 一个 debt baseline,A2 据此具备最小定向感。
  - **Covered by:** R1, R2, R5, R6, R9, R10

- F2. 首任务切片深化(含按需约束召回)
  - **Trigger:** A1 给出第一个真实任务。
  - **Actors:** A1, A2, A3
  - **Steps:** 按规模分档选影响面深度(方法论默认 / 大库 opt-in graph advisory)→ 按 定义→引用→测试→配置键→动态调用嫌疑点 追踪切片 → 按需从 git history/docs/PR 抽候选约束(低置信 advisory,请人审)→ 产出该切片可信上下文。
  - **Outcome:** 第一个任务在已知影响面 + 已审约束下安全开始。
  - **Covered by:** R3, R7, R8

- F3. 后续模块增量
  - **Trigger:** 后续任务首次进入某未覆盖模块。
  - **Actors:** A2, A3
  - **Steps:** 仅增量补该模块骨架与切片,刷新未覆盖区标记;不回头预先全建。
  - **Outcome:** 导航层随真实工作渐进生长,始终"够用且不过量"。
  - **Covered by:** R4

---

## Requirements

> 分期:v1 最小集 = R1 / R2 / R5 / R6 / R10(薄骨架 + 导航产物 + opt-in + 层位约束);R3 / R7 / R9 随首任务切片增量补;R8 待 v1.15 producer 落地后实现(本期只定契约)。

**Onboarding 流程主体**
- R1. 提供 brownfield onboarding 能力(① 与 ⑤ 合流),让陌生存量库渐进成为 AI 可工作环境;成功标准为"最小可工作上下文够第一个真实任务安全开始",非完整地图。
- R2. 首次 onboarding 产出**薄全局定向层**:顶层模块边界、技术栈、关键入口、关键约束来源指针,并明确标出未覆盖区;刻意保持薄,不一次性扫全库建百科。
- R4. 渐进式:首次只产薄骨架 + 未覆盖区标记;后续在某模块首次工作时增量补该模块,而非预先全建。
- R6. onboarding 是 **opt-in 增强**,零 harness 也能正常使用 spec-first;不设为强制 gate。

**切片深化(衔接已拍决策)**
- R3. 针对第一个真实任务触及的切片做深化,使用结构化影响面追踪序列(定义→引用→测试→配置键→动态调用嫌疑点)。该序列**标记影响面嫌疑点供人审/测试关注**,对反射/配置驱动/RPC 动态分发等不保证静态完备。
- R7. 影响面深度**按项目工程规模分档**(衔接报告 7.5):方法论是所有规模的默认底座;大型/跨仓库才 opt-in graph 作 advisory 托底。规模判断为 script-owned 确定性 facts,LLM 决定深度,graph 不自动装、不成 impact 真相源。
- R8. 定义 onboarding 在 F2 调用 **②(知识 cold-start 召回)的衔接契约**:输入 = 当前切片范围,输出 = 低置信 advisory 候选约束(强制人审、走 candidate→review→promote 落 `docs/solutions`、不预先批量)。**本期只定义契约与调用点;召回管道的实现依赖 v1.15 producer 落地**(见 Dependencies)。

**产物与边界**
- R5. 骨架与切片产物落**独立 docs 导航文档**(可增长);`AGENTS.md`/`CLAUDE.md` 仅加 preview-first 的轻指针(复用 `spec-compound` 的 discoverability 模式),不把地图写进入口、不自动改 source。
- R10. 导航文档定位为 Knowledge Harness **L1 项目上下文层**的结构地图成员:职责是项目结构导航 + 指向既有载体(README/AGENTS/CLAUDE/docs/contracts),**不复制**这些载体的内容。去重规则:同一事实只在其权威载体维护,导航文档只做索引与结构概览,避免多真相源。

**技术债基线**
- R9. 首次 onboarding 记录一个**全库现有告警/技术债快照**作为 baseline,定位为"增量判定基准"数据,供 R7 分档与审查/汇报参考;它**不重造** review 的 diff-scope 机制,而是为"区分 pre-existing 债 vs 本次改动"提供全库基线。baseline 是 advisory 快照,不设强制 gate。

---

## Acceptance Examples

- AE1. **Covers R2.** Given 一个无 spec-first 上下文的存量库,when 首次 onboarding 完成,then 产出一层薄全局导航(模块边界/技术栈/入口/约束来源指针)并显式列出未覆盖区,而非逐文件的完整索引。
- AE2. **Covers R7.** Given 项目规模为小/中,when 做影响面深化,then 仅用方法论序列(rg/ast-grep);given 大型或跨仓库且用户已 opt-in,when 深化,then 才叠加 graph advisory,且 graph 输出不直接成为结论。
- AE3. **Covers R8.** When 切片深化触及某模块,then 从历史材料抽出的约束以低置信 advisory 候选呈现并提请人审,绝不直接当 confirmed 写入 durable 知识。
- AE4. **Covers R4.** When 后续任务首次进入某未覆盖模块,then 仅增量补该模块,不触发全库重建。
- AE5. **Covers R5.** When onboarding 产出导航层,then 入口文件(AGENTS/CLAUDE)的任何改动先以 preview 呈现并经开发者确认后才写入。
- AE6. **Covers R9.** Given onboarding 已记录 debt baseline,when 后续审查运行,then 仅报告相对 baseline 新增的问题,历史既存告警不重复阻塞本次改动。

---

## Success Criteria

- 人类:开发者接手陌生大库后,**无需通读全库**即可让 AI 安全开始第一个真实任务;后续审查不被历史技术债告警淹没。
- 可观测代理:第一个任务的切片影响面已被追踪序列覆盖、候选约束经人审;agent 的改动未触及未 onboarding 的"未覆盖区"(若触及则触发增量 onboarding,而非在零上下文下盲改)。
- 下游:`spec-plan` / `spec-work` 能消费导航层 + 切片上下文(+ 若纳入则 adoption/debt baseline 状态),**无需自行发明**项目结构、模块边界或关键约束。

---

## Scope Boundaries

- 不一次性扫全库建 Wiki/百科式完整地图。
- 不自动改 `AGENTS.md`/`CLAUDE.md` source;入口仅 preview-first 轻指针。
- 不把 graph 作为默认影响面手段;仅大型/跨仓库 opt-in advisory。
- 不重启被否决的 graph-bootstrap / provider 核心路径。
- 不把 onboarding 设为强制 gate。
- 本 doc 不完整实现 ②(知识 cold-start 抽取),仅定义其在 F2 的衔接点;② 的结构化管道依赖 v1.15。

---

## Key Decisions

- onboarding 终点 = 最小可工作上下文(非完整地图):克制、反百科,匹配渐进哲学。
- 范围驱动 = 薄全局骨架 + 首任务切片深化(非纯切片、非全局优先):平衡定向感与 just-in-time。
- 产物落点 = 独立 docs + 入口轻指针:守 source 边界,复用 compound discoverability。
- 导航文档层位 = Knowledge Harness L1 的结构地图成员,只做索引/结构概览、不复制 README/AGENTS/contracts(防多真相源):见 R10。
- ④ 技术债 baseline **纳入** onboarding(顺带建快照,审查只对增量):与"审查不被历史债淹没"的 success criterion 强相关,边际成本低;baseline 保持 advisory,不设强制 gate。
- ③ 影响面 = 规模分档;② 知识 cold-start = 方向 3:见报告 7.5 / 7.6 决策记录。

---

## Dependencies / Assumptions

- 依赖 v1.15 Knowledge Harness 的 `learning-candidate` / candidate→review→promote producer 落 `src/cli`(R8;当前 contract 已定义、producer 未落地)。
- 依赖 ③ 的 `codebase-scale` advisory signal 确定性口径(R7;待 plan 细化)。
- 复用现有 `spec-compound` discoverability 模式(R5)。
- 假设:薄骨架的"够用"由 LLM 按任务判断,不由脚本设固定完整度阈值。

---

## Outstanding Questions

### Resolve Before Planning

- (无)所有阻塞性产品决策已解决;④ 技术债 baseline 已拍板纳入(见 R9 / Key Decisions)。

### Deferred to Planning

- [Affects R1][形态/Technical] onboarding 实现为新 public workflow(如 `/spec:onboard`)、`using-spec-first` 路由分支,还是扩现有 workflow 的 brownfield 模式?
- [Affects R7][Technical] `codebase-scale` signal 的确定性字段与分档阈值(LOC/文件数/语言数/多仓)。
- [Affects R2][Technical] 薄全局骨架的确切字段集与"未覆盖区"标记格式。
- [Affects R8][Needs research] 从 git history/PR 抽候选约束的可行抽取信号与误报控制。
- [Affects R9][Technical] R9 baseline 与现有 `spec-code-review` diff-scope 的边界与复用关系(避免重复机制;本轮 review 未核验该 skill 的 scope 行为)。
