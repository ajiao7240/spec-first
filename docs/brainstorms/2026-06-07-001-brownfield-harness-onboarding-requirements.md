---
date: 2026-06-07
topic: brownfield-harness-onboarding
spec_id: 2026-06-07-001-brownfield-harness-onboarding
---

# Brownfield Harness Onboarding(存量库渐进引入流程)

## Summary

为陌生的存量代码库提供渐进式 onboarding,核心是 **agent 默认不会自发做、又是 spec-first 边界强项的三件事**:影响面规模分档决策(R7)、技术债增量基线(R9)、证据与人审治理。薄全局骨架按需 just-in-time 生成、不预建持久化文档(R2);影响面追踪只保留"分档决策 + 嫌疑点治理",纯定位 grep 让给模型(R3)。成功标准是"第一个真实任务可安全开始",而非建成完整项目地图。

> 2026-06 趋势裁决(基于两轮 deep-research,见 `docs/09` 报告第八节):长窗 + agent 原生探索 + harness 显学三趋势,**强化**抗膨胀与治理价值、**弱化**"造持久化导航文档"与"教 agent grep"。需求据此瘦身——做方法论/治理,缓做造文档。

---

## Problem Frame

把 AI agent 放进十万行级、技术栈交织的存量库时,核心矛盾是 cold start:库的隐性知识(关键链路、字段约束、高频变更区)没有机器可读形式,agent 的知识边界等于文件边界。现状下 spec-first 已覆盖"**能力维度**的渐进引入"(minimal→recommended→platform),但缺"**代码库语义** onboarding"——开发者接手陌生大库时,要么被迫通读全库,要么让 agent 在零上下文下盲改。文章《Harness Engineering》也把"存量库渐进引入而不被技术债淹没"列为公认开放问题。

约束前提(已核验):仓库 2026-06-03 收敛决策明确"不恢复 graph-bootstrap",此能力必须走 workflow/方法论层,默认不碰 provider 核心路径。详见 `docs/09-业界借鉴/2026-06-07-Harness-Engineering对照-spec-first架构分析.md` 第七节。

> 编号说明:正文 ①–⑤ 沿用 `docs/09` 报告第七节的待优化点清单——① 导航地图、② 知识 cold-start、③ 影响面、④ 技术债 baseline、⑤ 渐进 adoption。本 doc 聚焦 ①⑤ 合流的 onboarding 流程,衔接 ②③④。

---

## Actors

- A1. 开发者:接手存量库,发起 onboarding,审阅并确认产物(尤其入口文件改动)。
- A2. AI agent:消费最小定向上下文 + 切片上下文,在库内安全执行第一个及后续真实任务。
- A3. onboarding 流程:编排 script-owned 确定性事实(文件树/语言/模块边界/git 热点)与 LLM 语义判断(关键链路、约束识别),产出最小定向与切片上下文。

---

## Key Flows

- F1. 首次 onboarding(最小定向 + 基线)
  - **Trigger:** 开发者对一个尚无 spec-first 上下文的存量库发起 onboarding。
  - **Actors:** A1, A3
  - **Steps:** 采集确定性事实(模块边界/技术栈/入口/git 热点)→ 记录现有告警/技术债 baseline 快照 → 标出未覆盖区 → 提供最小全局定向(形态优先 just-in-time,不默认预建持久化文档,见 R2);若需持久化则入口改动以 preview 请 A1 确认。
  - **Outcome:** 存在一个 debt baseline + 最小定向,A2 据此具备定向感;无新增需长期维护的持久化文档负担。
  - **Covered by:** R1, R2, R6, R9

- F2. 首任务切片深化(治理 + 按需约束召回)
  - **Trigger:** A1 给出第一个真实任务。
  - **Actors:** A1, A2, A3
  - **Steps:** 按规模分档选影响面深度(R7:方法论默认 / 大库 opt-in graph advisory)→ agent 原生探索做静态定位,onboarding 只补**动态调用/配置驱动嫌疑点的标记与人审提示**(R3)→ 按需从 git history/docs/PR 抽候选约束(低置信 advisory,请人审,R8)→ 产出该切片可信上下文。
  - **Outcome:** 第一个任务在已分档的影响面 + 已审嫌疑点/约束下安全开始。
  - **Covered by:** R3, R7, R8

- F3. 后续模块增量
  - **Trigger:** 后续任务首次进入某未覆盖模块。
  - **Actors:** A2, A3
  - **Steps:** 仅增量补该模块定向与切片,刷新未覆盖区标记;不回头预先全建。
  - **Outcome:** 定向随真实工作渐进生长,始终"够用且不过量"。
  - **Covered by:** R4

---

## Requirements

> 分期(2026-06 趋势裁决后重排):
> - **v1 核心(agent 不会自发做 + spec-first 强项)** = R7 规模分档决策 + R9 技术债增量基线 + R3(收窄后的影响面治理)+ R1/R6 框架。
> - **降级为 open question(形态待重审)** = R2/R5/R10 的"持久化导航文档"——趋势①② 提示改 just-in-time 生成或并入既有被动上下文(AGENTS/CLAUDE),而非新建持久化 docs。
> - **待依赖** = R8(依赖 v1.15 producer,本期只定契约)。

**Onboarding 流程主体**
- R1. 提供 brownfield onboarding 能力(① 与 ⑤ 合流),让陌生存量库渐进成为 AI 可工作环境;成功标准为"最小可工作上下文够第一个真实任务安全开始",非完整地图。
- R4. 渐进式:首次只产最小骨架 + 未覆盖区标记;后续在某模块首次工作时增量补该模块,而非预先全建。
- R6. onboarding 是 **opt-in 增强**,零 harness 也能正常使用 spec-first;不设为强制 gate。

**v1 核心:治理与分档(agent 默认不自发做)**
- R3. (收窄)影响面深化只承担 **agent 默认不会做的治理部分**:规模分档决策(何时升级深度)、动态调用/配置驱动**嫌疑点的显式标记与人审提示**。纯定义→引用→测试的静态定位 grep **交给 agent 原生探索**,不包装为本能力的 deliverable。
- R7. 影响面深度**按项目工程规模分档**(衔接报告 7.5):方法论是所有规模的默认底座;大型/跨仓库才 opt-in graph 作 advisory 托底。规模判断为 script-owned 确定性 facts,LLM 决定深度,graph 不自动装、不成 impact 真相源。
- R9. 首次 onboarding 记录一个**全库现有告警/技术债快照**作为 baseline,定位为"增量判定基准"数据,供 R7 分档与审查/汇报参考;它**不重造** review 的 diff-scope 机制,而是为"区分 pre-existing 债 vs 本次改动"提供全库基线。baseline 是 advisory 快照,不设强制 gate。

**衔接契约(待依赖)**
- R8. 定义 onboarding 在 F2 调用 **②(知识 cold-start 召回)的衔接契约**:输入 = 当前切片范围,输出 = 低置信 advisory 候选约束(强制人审、走 candidate→review→promote 落 `docs/solutions`、不预先批量)。**本期只定义契约与调用点;召回管道的实现依赖 v1.15 producer 落地**(见 Dependencies)。

**降级:导航产物形态(open question,见 Outstanding)**
- R2. (降级)onboarding 需让 agent 获得最小全局定向(模块边界/技术栈/入口/约束来源指针)+ 未覆盖区标记;**产出形态与生命周期待重审**——优先 just-in-time,但 just-in-time 的具体生命周期(单会话瞬态 / run-scoped 缓存 / 持久化)决定下游 `spec-plan`/`spec-work` 能否消费同一份定向,这一点与下方 R5/R10 是同一个产品决策(见 Outstanding)。
- R5. (降级)若决定持久化,产物落点(独立 docs vs 并入 AGENTS/CLAUDE 被动上下文)在 plan 阶段重审,避免新建一套与 AGENTS.md 红海重叠、需用户额外维护的文档。
- R10. (降级,条件性)若选独立 docs 形态,须定位为 Knowledge Harness L1 结构地图成员、只做索引不复制既有载体内容(去重规则防多真相源);若并入既有被动上下文则此约束由该载体承接。

---

## Acceptance Examples

- AE1. **Covers R2.** Given 一个无 spec-first 上下文的存量库,when 首次 onboarding 完成,then agent 获得最小全局定向(模块边界/技术栈/入口/约束来源指针)+ 未覆盖区标记,而非逐文件完整索引;定向优先以 just-in-time 形态提供,不强制产出需长期维护的持久化文档。
- AE2. **Covers R7, R3.** Given 项目规模为小/中,when 做影响面深化,then 由 agent 原生探索做静态定位、onboarding 只补嫌疑点治理;given 大型或跨仓库且用户已 opt-in,when 深化,then 才叠加 graph advisory,且 graph 输出不直接成为结论。
- AE3. **Covers R8.** When 切片深化触及某模块,then 从历史材料抽出的约束以低置信 advisory 候选呈现并提请人审,绝不直接当 confirmed 写入 durable 知识。
- AE4. **Covers R4.** When 后续任务首次进入某未覆盖模块,then 仅增量补该模块,不触发全库重建。
- AE5. **Covers R5, R10.** If plan 阶段决定需要持久化导航产物,then 入口文件(AGENTS/CLAUDE)的任何改动先以 preview 呈现并经开发者确认,且不与既有载体重复维护同一事实。
- AE6. **Covers R9.** Given onboarding 已记录 debt baseline,when 后续审查运行,then 仅报告相对 baseline 新增的问题,历史既存告警不重复阻塞本次改动。
- AE7. **Covers R6.** Given 一个未运行 onboarding 的项目,when 正常使用 spec-first workflow,then 不被阻塞、不报 onboarding 缺失类 gate(onboarding 是 opt-in 增强,非前置条件)。

---

## Success Criteria

- 人类:开发者接手陌生大库后,**无需通读全库**即可让 AI 安全开始第一个真实任务;后续审查不被历史技术债告警淹没。
- 可观测代理(R3):第一个任务的切片影响面已被追踪序列覆盖、候选约束经人审;agent 的改动未触及未 onboarding 的"未覆盖区"(若触及则触发增量 onboarding,而非在零上下文下盲改)。
- 可观测代理(R9):对一个已知含历史告警的模块,onboarding 后的审查只报相对 baseline 的增量、不重复报 baseline 内既存项(呼应 AE6)。
- 可观测代理(R7):规模分档决策可由 script-owned facts 复现(同一库同样规模 → 同样的默认深度建议);graph 仅在大型/跨仓 opt-in 时出现且不直接成结论。
- 下游:`spec-plan` / `spec-work` 能消费最小定向 + 切片上下文 + debt baseline 状态,**无需自行发明**项目结构、模块边界或关键约束。**前提**:定向的生命周期形态(见 Outstanding 产物形态决策)支持跨 workflow 消费;若选瞬态形态,下游各自重新生成而非消费同一份。

---

## Scope Boundaries

- 不一次性扫全库建 Wiki/百科式完整地图。
- **不新建一套与 AGENTS.md 红海重叠、需用户长期维护的持久化导航文档**(趋势裁决);若需持久化,优先并入既有被动上下文。
- 不把"教 agent 做静态 grep 定位"包装为本能力 deliverable——交给 agent 原生探索。
- 不自动改 `AGENTS.md`/`CLAUDE.md` source;任何入口改动 preview-first。
- 不把 graph 作为默认影响面手段;仅大型/跨仓库 opt-in advisory。
- 不重启被否决的 graph-bootstrap / provider 核心路径。
- 不把 onboarding 设为强制 gate。
- 本 doc 不完整实现 ②(知识 cold-start 抽取),仅定义其在 F2 的衔接点;② 的结构化管道依赖 v1.15。

---

## Key Decisions

- onboarding 终点 = 最小可工作上下文(非完整地图):克制、反百科,匹配渐进哲学。
- **价值重心 = 治理而非文档(2026-06 趋势裁决)**:v1 核心是 R7 规模分档 + R9 技术债增量基线 + R3 嫌疑点治理——agent 默认不自发做、又是 spec-first 边界强项;纯 grep 定位与造持久化文档正被模型能力和 AGENTS.md 红海吃掉,故收窄/降级。证据见 `docs/09` 报告第八节。
- **产物落点 = 待重审(逆转原决策)**:原定"独立 docs + 入口轻指针";趋势证据(长窗下塞太多反降成功率、持久化文档易腐化、AGENTS.md 已 12 万+文件红海)使其降为 open question——优先 just-in-time 生成或并入既有被动上下文,而非新建持久化 docs。
- ④ 技术债 baseline **纳入**且提为 v1 核心:agent 不会自发建 baseline,与"审查不被历史债淹没"强相关。
- ③ 影响面 = 规模分档(R7 保留)+ 治理收窄(R3);② 知识 cold-start = 方向 3:见报告 7.5 / 7.6 决策记录。

---

## Dependencies / Assumptions

- 依赖 v1.15 Knowledge Harness 的 `learning-candidate` / candidate→review→promote producer 落 `src/cli`(R8;当前 contract 已定义、producer 未落地)。
- 依赖 ③ 的 `codebase-scale` advisory signal 确定性口径(R7;待 plan 细化)。
- 条件依赖:若 R5 选持久化/入口指针形态,则复用现有 `spec-compound` discoverability 模式;若选 just-in-time 形态则不依赖。
- 假设:薄骨架的"够用"由 LLM 按任务判断,不由脚本设固定完整度阈值。

---

## Outstanding Questions

### Resolve Before Planning

- [Affects R2/R5/R10][产品决策] 最小定向的**产物形态与生命周期**(单一决策):(a) 纯 just-in-time、单会话瞬态、不持久化;(b) just-in-time 生成 + run-scoped 缓存,供同一 plan→work 链消费;(c) 增量并入既有 AGENTS.md/CLAUDE.md 被动上下文;(d) 独立持久化 docs。趋势裁决倾向 (a)/(b)/(c),(d) 需额外理由克服红海/腐化/多真相源风险。**注意**:此决策同时决定 Success Criteria 中"下游 `spec-plan`/`spec-work` 能消费导航层"的可行性——(a) 瞬态形态下下游无法消费同一份定向,需改为各自重新生成或选 (b)/(c)/(d)。

### Deferred to Planning

- [Affects R1][形态/Technical] onboarding 实现为新 public workflow(如 `/spec:onboard`)、`using-spec-first` 路由分支,还是扩现有 workflow 的 brownfield 模式?
- [Affects R7][Technical] `codebase-scale` signal 的确定性字段与分档阈值(LOC/文件数/语言数/多仓)。
- [Affects R3][Technical] agent 原生探索与 onboarding 嫌疑点治理的职责切分点(哪些定位让给 agent、哪些必须显式治理)。
- [Affects R8][Needs research] 从 git history/PR 抽候选约束的可行抽取信号与误报控制。
- [Affects R9][Technical] R9 baseline 与现有 `spec-code-review` diff-scope 的边界与复用关系(避免重复机制;本轮 review 未核验该 skill 的 scope 行为)。
- [Affects v1 整体][Needs validation] 先 dogfood R7/R9/R3 于真实存量库,用 Evaluation Harness 度量痛点量级与 bounded 探索成本,再决定是否扩 R2 持久化形态。
