---
title: "Harness Engineering 文章 × spec-first 架构对照分析"
date: "2026-06-07"
type: 业界借鉴分析
related_source: "./2026-06-06-Harness-Engineering：耗时一周，我是如何将应用的AI-Coding率提升至90%的.md"
verification: "文章主张经独立 deep-research workflow 核验(102 agent / 19 一手源 / 25 主张 3 票对抗,0 推翻);spec-first 侧断言来自直接源码阅读(角色契约、spec-work/spec-compound SKILL、contracts、rg 核验)"
note: "分析产出,不改动 source,不计入 CHANGELOG"
---

# Harness Engineering 文章 × spec-first 架构对照

对照对象:阿里 ITPUB《Harness Engineering:耗时一周,我是如何将应用的 AI Coding 率提升至 90% 的》(2026-06-06)与本仓库 spec-first 的系统设计。

---

## 结论先行

1. **文章方向可信,但数字和金句要打折**。一手来源 3 票对抗核验了 25 条主张:核心方法论(执行-评判分离、机械化门禁、Hashimoto 定义、OpenAI 百万行量化数据、Anthropic/OpenAI 三篇博客确实存在)**confirmed**;但 **"40% 上下文 sweet spot" 是杜撰**(Anthropic 只说"上下文是有限资源、填满则衰退",从未给百分比)、**"60% 用 AI / 0-20% 完全委托"、《2026 Agentic Coding Trends Report》、"Agents aren't hard; the Harness is hard" 金句均无法溯源**。借鉴时不要把这些当既定事实引用。

2. **spec-first 与这份经核验的成熟 harness 基线高度同构**,且在「证据治理 / source-runtime 边界 / 双宿主分发」三点上做得比文章更系统。

3. **文章真正值得借鉴的,不是它的强状态机,而是三个具体的工程化细节**:per-需求审计 dossier、CI 门禁的反空测试条件、failure-mode→gate 的显式映射。

4. **文章的 10 阶段状态机 + 单一 Owner 编排,与 spec-first 的核心哲学(反状态机、Let the LLM decide)是有意分歧,不是缺口**——而且外部一手反证(METR 2025、GitClear)恰好支持 spec-first 对"过度流程化"的警惕。

---

## 一、文章主张可信度校准(核验结论)

| 论断 | 核验结论 | 说明 |
|---|---|---|
| Planner/Generator/Evaluator 分离是关键杠杆 | **confirmed** | Anthropic "Harness design for long-running apps" 原文 "separating the agent doing the work from the agent judging it proves to be a strong lever" |
| Hashimoto 对 harness engineering 的定义 | **confirmed** | mitchellh.com 本人署名,"anytime you find an agent makes a mistake, you... engineer a solution such that the agent never makes that mistake again" |
| OpenAI 100 万行/1500 PR/3.5 PR-天/10x | **confirmed(但自报未审计)** | OpenAI "Harness engineering"(Ryan Lopopolo, 2026-02-11)逐字确认;注:含基础设施/工具/文档,非纯产品代码 |
| 三篇工程博客存在 | **confirmed** | Anthropic effective-harnesses(2025-11-26)、harness-design(2026-03-24)、OpenAI harness-engineering(2026-02-11) |
| 四种失败模式 + "无法自评" | **partially-confirmed** | 失败模式方向对,但 "One-shot Syndrome" 等品牌名系文章自创;Anthropic 用描述性措辞,且确认自评偏向乐观 |
| 机械化门禁原则 | **partially-confirmed** | 原则 confirmed(OpenAI "enforce mechanically"、Anthropic Stop hook);但 "If it can't be mechanically enforced, the agent will drift" 原句与 `status==SUCCESS && total_tests>0 && passed==total` 代码片段未逐字溯源 |
| 40% 上下文 sweet spot | **底层原理 confirmed / 40% 数字 refuted** | Anthropic 反复讲 context rot 与"最小高信号 token 集",但三处来源均无任何百分比阈值 |
| 60% 用 AI / 0-20% 完全委托 | **unverified** | 任何 Anthropic 一手来源均未定位到这组数字 |
| 《2026 Agentic Coding Trends Report》 | **unverified** | 未在 Anthropic 一手来源中找到 |

**反证(借鉴 90% 数字时必须知道)**:METR 2025-07 研究显示早期 AI 工具可能**拖慢**资深开源开发者;GitClear 2025 研究指出 AI 辅助代码存在质量/重复度问题。文章的 24.86%→90.54% 是单团队自报指标,且"AI 代码率"本身是否等价于"研发增益"存疑。

---

## 二、能力基线对照(10 维)

基线来自 Anthropic + OpenAI + Hashimoto 一手核验。

| 能力维度 | 成熟基线判定标准 | 文章(90% 实践) | spec-first | 对照 |
|---|---|---|---|---|
| 分层上下文加载 | 入口轻量作 map、progressive disclosure、最小高信号 token | L1/L2/L3 三层 + AGENTS.md~420 行 | context-bundle(确定性 helper,记录 budget pressure 但**不**做语义门禁)+ context-governance + runtime exclusion + cache-friendly layout | **spec-first 更系统** |
| 执行-评判分离 | 做事的 agent 不为自己打分 | 编码 agent vs expert-reviewer(单个) | **50 个专业 review agent** + fresh-source eval + 对抗 reviewer + "不依赖模型自评" | **spec-first 显著更系统** |
| 跨会话持久化状态 | 首会话 init、后续增量、状态可恢复 | summary.md + changes/ 目录 | run.json 不可变 artifact + resume_evidence + auto-memory | 两者都有,机制不同 |
| 结构化执行 + 质量门禁 | sprint contract、硬阈值、任一失败即整体失败 | 10 阶段 + 回退路由 + 迭代上限 | spec-work feedback loop + gate-lens-taxonomy + honest-closeout(轻量 gate,非状态机) | **哲学分歧**(见四) |
| 可机械验证约束 | linter/CI/structural test/Stop hook 强制,非 prose | CI 门禁 `status==SUCCESS && total_tests>0 && passed==total` | honest-closeout validate + verification-run-summary.v1 + branch-protection-policy(schema 化) | spec-first 更 schema 化;**文章的反空测试条件值得借鉴** |
| 变更审计链 | 增量提交、每特性可追溯、PR 化 | **per-需求 dossier**:`changes/{需求}/` 串 spec→…→deploy,review 版本递增不删 | run.json(per-run)+ docs/solutions + git/PR handoff,**但分散,无统一 per-需求 dossier 视图** | **文章组织得更聚合(真缺口候选)** |
| 知识沉淀/反馈闭环 | docs 作 system of record、doc-gardening 自动开 PR | .harness/ 沉淀 + 规范活文档 | spec-compound→docs/solutions(5 类 + schema)+ compound-refresh + Recall Trust Boundary | **spec-first 更系统** |
| failure-mode 防护 | 显式防 premature victory/feature/cold-start + 防自评偏差 | 四失败模式 + browser E2E 截图 | 散落在 spec-work/honest-closeout,**无显式 failure-mode→gate 映射表** | **文章映射更清晰(可借鉴)** |
| self-evolving harness | golden principles 后台扫描、自动重构 PR | 列为未来工作 | spec-skill-audit + app-consistency-audit + optimize + compound-refresh + agent-native-audit | **spec-first 已部分落地** |
| 跨项目模板化 | 入口/约束/门禁可复用为模板 | 列为未来工作 | **npm CLI + init/doctor/update + source/runtime 边界 + 双宿主生成** | **spec-first 已是成品,文章还在设想** |

---

## 三、spec-first 已做得更系统的(4 点)

1. **证据治理是 spec-first 的护城河**。Artifact 四级权威(advisory/confirmed/generated/degraded)、Recall Trust Boundary(召回只是"指针去查证"、必须回到 source/test)、reason_code、"不依赖模型自评"——文章只有朴素经验("Agents 无法自评"),spec-first 把它做成了贯穿全链路的 contract。

2. **source/runtime 边界 + 双宿主生成**。文章是单宿主 bespoke `.harness/` 目录;spec-first 区分 source-of-truth 与 generated mirror(`.claude/`/`.codex/`/`.agents/`),用 `spec-first init` 重生成,且同时服务 Claude 与 Codex。文章把"跨项目模板化"列为未来,spec-first 的 CLI 分发已经是这个未来的成品。

3. **评判侧深度**。文章 1 个 expert-reviewer;spec-first 50 个专业 agent(安全/性能/可维护性/数据迁移/API contract/scope guardian…)+ fresh-source eval 防宿主缓存。

4. **上下文管理更诚实**。文章用杜撰的 40% 硬阈值;spec-first 用确定性 context-bundle 记录 budget pressure、把语义相关性判断留给 LLM——与"Anthropic 从未给百分比"的核验结论一致。

---

## 四、文章有而 spec-first 可借鉴的(3 个真细节,非整套照搬)

1. **per-需求审计 dossier 视图**。文章的 `changes/{需求}/summary.md` 把 spec→plan→tasks→code→review→test→ci→deploy 串成一页纸单一真相源 + 版本递增不删的 review。spec-first 的等价证据更 schema 化但**分散**在 `.spec-first/workflows/` 和 `docs/`。值得评估是否要一个轻量 per-需求 dossier 聚合视图。**注意**:按 80/20 和反状态机哲学,这应该是 advisory 视图而非强制目录结构。

2. **CI 门禁的"反空测试"条件**。`total_tests > 0` 专门防"空测试套件也返回 SUCCESS"的陷阱,很具体。spec-first 的 verification-run-summary 可核查是否已显式覆盖"测试数为 0 视为失败"。

3. **failure-mode → gate 的显式映射表**。文章把四种失败模式逐一对应到防护手段,教学价值高。spec-first 的防护散落各处,可在 gate-lens-taxonomy 或角色契约里补一张显式映射表,降低新贡献者理解成本。

---

## 五、哲学分歧(有意选择,不要照搬)

| 维度 | 文章 | spec-first | 为什么 spec-first 不应改 |
|---|---|---|---|
| 流程形态 | 10 阶段强状态机 + 精确回退路由 + 迭代上限 | entry governor + 公开 workflow 调度 + 轻量 gate | 角色契约明令"禁止用状态机替代 LLM 判断";METR 2025 / GitClear 一手研究显示:对成熟代码库/资深开发者,强流程+AI 可能降速降质,印证对过度流程化的警惕 |
| 编排 | 单一 Application Owner Agent 当大脑 | 无中心 orchestrator,workflow 各自负责 | 中心化 owner 是 spec-first 系统边界明确排除的"中心化流程引擎" |
| 载体 | 单项目 bespoke 目录 | 可分发 CLI + 双宿主 | spec-first 的存在价值就是产品化的 harness,不是一次性配置 |

---

## 六、对 spec-first 演化的判断(最小可维护建议)

- **可考虑(中型,需各自走 brainstorm/plan)**:failure-mode→gate 显式映射表(纯 docs/治理,边际成本低、解释价值高)> CI 反空测试条件核查(窄、可验证)> per-需求 dossier advisory 视图(需先确认是否引入状态机味,谨慎)。
- **明确不做**:40% 上下文硬阈值、10 阶段状态机、单一 Owner 编排——与核心哲学冲突。
- **共同开放问题(文章和 spec-first 都没解)**:存量遗留库的渐进式 harness 引入。spec-first 的 `spec-prd` 只覆盖 brownfield **需求**侧,不解决"老库引入 harness 不被技术债告警淹没"这个行业公认难题——这是后续真正值得投入研究的方向。详见第七节深化分析。

---

## 七、存量库渐进引入:cold-start 深化分析

> 本节是对第六节"开放问题"的深化(2026-06-07 brainstorm 产出)。事实来自直接源码/路线文档阅读,非记忆。

### 7.1 关键约束(框定前提)

仓库对"存量库 / 代码理解"不是空白地,已有沉淀和明确收敛决策,任何方案必须在此边界内:

- **已有完整 SCALE 融合路线**(`docs/00-版本路线/2026-06-03-scale-engine-fusion-version-split.md`,v1.11→v2.0)。其 6 条拆分原则本身就是渐进哲学:先 minimal 后 provider、先文件化记忆后外部记忆、先 advisory 后 blocking。
- **graph-bootstrap 已被明确否决**:"不恢复 graph-bootstrap"、"GitNexus 已退役";CodeGraph/Graphify 降级为 v1.16 optional orientation provider 且暂缓。`src/cli` 中 0 命中——未进 source。
- **v1.15 Knowledge Harness** 定义了知识六层(L1–L6)与召回纪律,但知识靠 `spec-compound` **边干边沉淀**,**无针对存量大库的 cold-start 策略**。

### 7.2 主题重新框定

spec-first 已覆盖"**能力维度**的渐进引入"(minimal→recommended→platform);文章真正在问的、也是 spec-first 的真空白,是"**代码库语义 onboarding**"维度——十万行级大库如何让 AI 从零建立够用的可信上下文而不被技术债淹没。**该 gap 恰好可不碰被否决的 graph-bootstrap,纯走 workflow/方法论层。**

### 7.3 五个待优化点(AI 在陌生大库可靠工作所需的可信上下文)

| # | 子能力 | 现状(已核验) | 缺口 | 补什么 | 落点 |
|---|---|---|---|---|---|
| ① | 项目导航地图(L1) | 无 codebase-map/project-analysis,靠 bounded reads+rg 现查;CLAUDE/AGENTS 人手写 | 首次接入无"渐进建图并沉淀"引导 | brownfield onboarding 流程,增量补全 L1 而非一次性扫描 | **A** 方法论 |
| ② | 隐性约束沉淀 | L3/L6 靠 compound 在解决问题"后"沉淀 | cold-start 时知识库空,历史约束(字段类型/高频链路)干活前就该知道 | 从 git history/现有 docs/PR 抽**候选**约束→人审→沉淀 L3 advisory/L6 durable | **A**(须 advisory+人审) |
| ③ | 变更影响面 | bounded reads+rg+ast-grep;v1.16 graph orientation 暂缓 | 大库纯 bounded 探索影响面可能不稳 | **按规模分档**(见 7.5):方法论(A)为所有规模默认底座;大型/跨仓库 opt-in graph(C)做 advisory 托底 | **已拍板:规模分档** |
| ④ | 技术债不淹没 | scenario-capability-matrix 有降级语义,review 默认 scope 到 diff | 无 pre-existing 债 vs 本次改动的显式区分 | debt baseline 快照 + 只对增量 gate | **A** 治理 |
| ⑤ | 渐进非一次性 | minimal 默认+advisory+文件化记忆,哲学已支持 | 未显式化为 adoption 指南 | brownfield adoption 指南,串起①②④ | **A** 最低成本 |

### 7.4 结论

5 块里 4 块(①②④⑤)在 **A 侧:纯 workflow/方法论、不碰被否决的 graph-bootstrap、符合 spec-first 哲学**,可低成本补;**③ 影响面**已拍板为"按规模分档"(见 7.5)。建议切入顺序:**②(知识 cold-start 空窗)+ ④(技术债 baseline)** 最痛且最合哲学,①⑤ 顺带,③ 按 7.5 决策推进。

**未决分支(待后续 plan)**:7.5 中"codebase scale signal"的确定性口径(阈值/字段)待 plan 细化;7.6 方向 3 依赖的 v1.15 `learning-candidate` producer 落 source 与 ①⑤ onboarding 流程成形。

### 7.5 决策记录:③ 影响面 A/C(2026-06-07 拍板)

| 字段 | 内容 |
|---|---|
| question | 存量大库变更影响面分析,用纯方法论(rg/ast-grep 引导)还是机器索引(graph/provider)托底? |
| chosen_answer | **按项目工程规模分档**,非二选一 |
| source_tag | user(拍板)+ confirmed(对齐 06-03 收敛决策与现有 profile 分档) |
| 决策细则 | (1) 方法论(A)是**所有规模的无条件默认底座**:补"影响面系统化追踪"能力,引导 LLM 按 定义→引用→测试→配置键→动态调用嫌疑点 固定序列走,用 rg/ast-grep 产**结构化影响面 evidence**。(2) 大型/跨仓库才把 graph(C)作为 **opt-in advisory 托底**,定位为 recommended/platform profile 增强,不是通用功能。 |
| 边界(必须守) | ① graph 是"方法论 + 托底",不替代方法论;② 规模判断是 **script-owned 确定性 facts**(LOC/文件数/语言数/多仓),advisory,**LLM 决定影响面深度**;③ graph 永远 **opt-in + advisory**,规模信号只建议大库考虑 opt-in,**不自动按 LOC 装 graph**,不成 impact 真相源。 |
| consequence | 默认路径(所有规模)= A 方法论能力,**无条件先做**;v1.16 optional graph orientation **维持暂缓**,但定位收窄为"大型/跨仓库的 opt-in 影响面托底",**不重启核心路径、与 06-03 收敛决策一致**。可能需一个轻量 `codebase-scale` advisory signal(复用已有 git/文件统计,不造引擎)决定何时建议 opt-in C。 |
| 证伪/触发重评 | 小中库出现方法论影响面漏判(测试也兜不住)→ 强化方法论或下探分档阈值;大库 opt-in graph 实测 ROI 不足 → 收回 C。由 Evaluation Harness 度量,不凭感觉。 |

### 7.6 决策记录:② 隐性约束沉淀归属(2026-06-07 拍板)

| 字段 | 内容 |
|---|---|
| question | 存量库隐性约束沉淀能力,放新 skill 还是扩 `spec-compound`? |
| chosen_answer | **方向 3**:just-in-time 按需召回 + 挂在 ①⑤ brownfield onboarding 流程,复用 v1.15 candidate→review→promote 管道与 `docs/solutions` 存储 |
| source_tag | user(拍板)+ confirmed(compound 语义边界、knowledge-harness candidate→promote 机制均已核验) |
| 关键理由 | `spec-compound` 强绑定"recently solved problem",② 在触发(干活前)/输入(git history 等)/证据(历史推断=低置信)三维都不同,硬扩会污染语义、违反 light contract;管道与存储已由 v1.15 定义,不应重造;just-in-time 优于预先批量(降噪、避免预先浪费)。 |
| 边界(必须守) | ① 历史推断 = 低置信 advisory candidate,**强制人审**,不当 confirmed;② 复用 `docs/solutions` + candidate→review→promote,**不造第二真相源**;③ **不新增顶级 skill**,作为 onboarding 流程的一个 phase;④ **按需召回为默认**,非批量扫描。 |
| consequence | 不动 `spec-compound` 语义;② 成为 ①⑤ brownfield onboarding 流程的一个能力;**排在 v1.15 candidate producer 落 source + ①⑤ 流程成形之后**。 |
| 依赖/退路 | 依赖:v1.15 `learning-candidate` 管道(contract 已定义、producer 未落 `src/cli`)+ ①⑤ onboarding 流程。退路:若依赖未就绪,退**方向 2 轻量独立 skill**,不退方向 1(语义边界 > 省一个 skill)。 |

---

## 一手来源

- Anthropic. Effective harnesses for long-running agents — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic. Harness design for long-running application development — https://www.anthropic.com/engineering/harness-design-long-running-apps
- Anthropic. Effective context engineering for AI agents — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic. Building effective agents — https://www.anthropic.com/engineering/building-effective-agents
- Anthropic. Claude Code best practices — https://www.anthropic.com/engineering/claude-code-best-practices
- OpenAI. Harness engineering: leveraging Codex in an agent-first world(Ryan Lopopolo)— https://openai.com/index/harness-engineering/
- Mitchell Hashimoto. My AI adoption journey — https://mitchellh.com/writing/my-ai-adoption-journey
- METR. Early-2025 AI impact on experienced OSS developers — https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- GitClear. AI assistant code quality 2025 research — https://www.gitclear.com/ai_assistant_code_quality_2025_research
