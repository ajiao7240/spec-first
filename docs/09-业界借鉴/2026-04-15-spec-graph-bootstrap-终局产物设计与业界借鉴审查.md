# spec-graph-bootstrap：Stage-0 终局产物设计与业界借鉴审查

## 一、这次审查到底在回答什么

这次审查不把“当前实现了多少代码”当作边界，而是倒过来问：

**如果目标是让 AI 在真实团队协作里更稳、更快、更准地理解代码库并服务 `plan / work / review`，那么一个正确且合理的 Stage-0 产物体系应该长什么样？**

因此，评估维度不是单一的“需求是否实现”，而是五个维度一起看：

1. 团队协作场景下是否可维护、可更新、可迭代
2. 产物是否合理完整，是否能形成稳定消费入口
3. 是否真的提升代码库理解，而不是只多了一批文档
4. 是否具备增量刷新、失效传播、契约收敛能力
5. 是否有评测与验证机制，证明它带来了真实收益

## 二、结论先行

当前 `spec-graph-bootstrap` 的判断不是“做得不对”，而是：

**方向是对的，底座已经成立，但距离“合理终局”还差关键系统件。**

更准确地说，当前系统已经有了：

- 控制面雏形
- 可机读事实层初版
- 人类可读文档层初版
- 后续 workflow 的消费接线

但它还没有成为一个真正成熟的 Stage-0 上下文系统，因为以下两个关键能力还没闭环：

1. **最小上下文分发闭环**还没有硬化
2. **代码库理解质量闭环**还没有被验证

所以，现阶段更适合把它定义为：

**从“知识资产生成器”迈向“可验证的上下文分发系统”的过渡版本。**

## 三、本地代码证据：当前系统到底已经做到哪一步

### 3.1 已经成立的部分

从 source skill、样本产物和消费型 workflow 看，当前 Stage-0 已经形成一条明确链路：

- source-of-truth 技能定义已经收敛到 [skills/spec-graph-bootstrap/SKILL.md](../../skills/spec-graph-bootstrap/SKILL.md)
- 控制面产物已经落到 [.spec-first/workflows/bootstrap/spec-first/artifact-manifest.json](../../.spec-first/workflows/bootstrap/spec-first/artifact-manifest.json)
- checked-in 样本上下文已经落到 [docs/contexts/spec-first/README.md](../contexts/spec-first/README.md)
- `spec-plan`、`spec-work`、`spec-code-review` 都已经接入 `injection-index.yaml` 作为 Stage-0 预载入口

从样本看，当前最小闭环已经包含：

- `fact-inventory.json`
- `risk-signals.json`
- `test-surface.json`
- `00-summary.md`
- `architecture/module-map.md`
- `code-facts/public-entrypoints.md`
- `code-facts/test-map.md`
- `code-facts/high-risk-modules.md`
- `context-packs/review-change.md`
- `injection-index.yaml`
- `artifact-manifest.json`

这说明当前系统已经不再是纯概念设计，而是进入“可运行、可消费”的阶段。

### 3.2 还没有闭环的关键问题

#### 问题 A：消费入口接上了，但消费执行仍是软约束

三个消费型 workflow 的 Stage-0 预载逻辑都写在 skill 文档里：

- [skills/spec-plan/SKILL.md](../../skills/spec-plan/SKILL.md)
- [skills/spec-work/SKILL.md](../../skills/spec-work/SKILL.md)
- [skills/spec-code-review/SKILL.md](../../skills/spec-code-review/SKILL.md)

它们都描述了：

- 解析 slug
- 读取 `injection-index.yaml`
- 按 `always + stages + selection_rules` 加载
- 失败时退回 Level 2 固定最小集合

但当前仓库里还没有一个共享的、确定性的 evaluator 来执行这件事。也就是说：

- 路由规则存在
- 样本存在
- 消费约定存在
- 但“该读什么、怎么求值、怎么去重、为什么降级”还没有被代码模块硬化

这在个人单次使用时问题不大，但在团队协作和长期演进里，维护成本会快速上升。

#### 问题 B：source skill 契约与样本产物仍有漂移

这是当前最硬的证据之一。

source skill 里已经把字段口径写得更严格，例如：

- [skills/spec-graph-bootstrap/SKILL.md](../../skills/spec-graph-bootstrap/SKILL.md) 明确要求 `layers.*` 带 `updated_at`
- 同一文件明确要求 `risk-signals.signals[*]` 带 `updated_at`

但当前 checked-in 样本里：

- [.spec-first/workflows/bootstrap/spec-first/fact-inventory.json](../../.spec-first/workflows/bootstrap/spec-first/fact-inventory.json) 的 `layers.frontend/backend/cli` 没有 `updated_at`
- [.spec-first/workflows/bootstrap/spec-first/risk-signals.json](../../.spec-first/workflows/bootstrap/spec-first/risk-signals.json) 的 `signals[*]` 也没有 `updated_at`

这说明当前仍存在：

- source contract
- checked-in sample
- contract test
- 真实生成结果

四层没有完全锁死的问题。

这类问题不是“文档瑕疵”，而是会直接破坏团队维护性，因为后续所有消费者都无法确定到底谁才是真正的 schema。

#### 问题 C：代码库理解能力已经有雏形，但仍存在噪声污染

当前 `fact-inventory.json` 的 `data_shapes` 里抽到的是：

- [skills/dspy-ruby/assets/signature-template.rb](../../skills/dspy-ruby/assets/signature-template.rb)

这说明当前抽取过程在某些任务上还没有把“目标项目源码”和“仓库内 workflow/asset 模板”严格分层，导致事实层混入了与主代码库理解无关的噪声。

这类问题的风险很高，因为它会让 AI 形成“看似有结构，实际不贴业务主轴”的错误理解。

如果 Stage-0 目标是帮助 AI 理解代码库，那么正确的系统必须优先回答：

- 真实入口在哪里
- 真实核心流在哪里
- 真实高风险点在哪里
- 真实测试覆盖面在哪里
- 哪些是知识资产本身，哪些只是工具模板或示例

在这一点上，当前系统已经起步，但还不够干净。

#### 问题 D：当前产物更像“文档集合”，还不像“最小上下文分发系统”

当前样本产物里，人类可读层已经比较完整，例如：

- [docs/contexts/spec-first/00-summary.md](../contexts/spec-first/00-summary.md)
- [docs/contexts/spec-first/architecture/module-map.md](../contexts/spec-first/architecture/module-map.md)
- [docs/contexts/spec-first/code-facts/public-entrypoints.md](../contexts/spec-first/code-facts/public-entrypoints.md)
- [docs/contexts/spec-first/code-facts/high-risk-modules.md](../contexts/spec-first/code-facts/high-risk-modules.md)

但它仍缺少一个真正 machine-first 的最小入口产物，例如：

- 面向 `plan` 的最小上下文卡片
- 面向 `review` 的证据优先卡片
- 面向 `work` 的测试与风险卡片
- 按 token budget 或任务类型计算过的最小文件集

当前的 `injection-index.yaml` 更像“文件路由表”，还不是“任务理解入口”。

#### 问题 E：刷新与失效传播能力还不够强

当前 [artifact-manifest.json](../../.spec-first/workflows/bootstrap/spec-first/artifact-manifest.json) 已经有了 `inputs`、`outputs` 和 `depends_on`，这是正确方向。

但如果从团队长期维护角度看，它还缺：

- 文件级 freshness 状态
- schema compatibility 信息
- 生成器版本与消费器版本的兼容矩阵
- asset owner / reviewer / last_verified
- 失效传播与局部重建信息
- “为什么这次没有更新”的跳过原因明细

也就是说，它有控制面雏形，但还不是一个完整的“可维护控制面”。

## 四、业界方案给出的启发：正确系统通常长什么样

## 4.1 Repomix：适合做兼容层，不适合做 Stage-0 核心

来源：

- https://github.com/yamadashy/repomix

Repomix 的长处非常明确：

- 把仓库打包成 AI 友好的单文件
- 支持 token counting
- 支持压缩
- respect ignore 规则
- 强调安全检查

它解决的是“**如何把代码高效交给模型**”的问题。

但它没有真正解决：

- 如何持续理解代码库
- 如何增量刷新
- 如何给不同任务分发最小上下文
- 如何形成团队级可维护知识层

所以它更适合作为 **export/compatibility layer**，而不是 `spec-graph-bootstrap` 的核心终局模型。

## 4.2 Sourcegraph / Qodo Aware / code-review-graph：核心启发是“最小检索 + 持续索引 + 评测驱动”

来源：

- https://sourcegraph.com/blog/lessons-from-building-ai-coding-assistants-context-retrieval-and-evaluation
- https://docs.qodo.ai/qodo-documentation/qodo-AWARE
- https://docs.qodo.ai/qodo-aware/core/benchmark
- https://github.com/qodo-ai/aware-swe-agent
- https://www.qodo.ai/blog/code-aware-agentic-ai-the-system-approach/
- https://www.qodo.ai/blog/qodo-ranked-1-ai-code-review-tool-in-martians-code-review-benchmark/
- [code-review-graph/README.md](../../../code-review-graph/README.md)
- [code-review-graph/docs/LLM-OPTIMIZED-REFERENCE.md](../../../code-review-graph/docs/LLM-OPTIMIZED-REFERENCE.md)

这一类方案给出的核心启发最重要。

共性特征是：

1. **不是先把所有内容都喂给模型，而是先做持续索引**
2. **不是先追求文档完整，而是先追求最小但足够的上下文**
3. **不是凭感觉判断效果，而是引入 benchmark / evaluation**
4. **不是单看单文件，而是强调 cross-file / architecture / dependency understanding**

其中几个点尤其值得借鉴：

- Sourcegraph 明确把 context retrieval 当作一项独立工程问题来做，强调检索和打包都必须服务模型的上下文预算约束
- Qodo Aware 明确把代码理解分成多层能力，不只看静态语法，还看语义、符号关系和运行时行为
- Qodo 在 review 场景里把 precision / recall / F1 当作核心指标，说明“高质量理解”必须可测
- `code-review-graph` 明确要求先走 `get_minimal_context_tool(task=...)`，并把 token 预算做成一等约束

对 `spec-graph-bootstrap` 来说，这一类方案意味着：

**Stage-0 的核心价值，不应该是生成一套文档，而应该是成为后续任务的最小上下文分发底座。**

## 4.3 DeepWiki / graphify / spec-graph-bootstrap：核心启发是“人类可读知识层 + 渐进披露”

来源：

- https://docs.devin.ai/release-notes/2025
- https://deepwiki.com/
- [graphify/ARCHITECTURE.md](../../../graphify/ARCHITECTURE.md)
- [skills/spec-graph-bootstrap/SKILL.md](../../skills/spec-graph-bootstrap/SKILL.md)

这一类方案强调的是：

- 给人和 agent 一个稳定可读的项目地图
- 先给 one-page summary，再按需深入
- 明确证据等级和不确定性
- 把 durable context files 当作长期资产维护

这类思路和 `spec-graph-bootstrap` 的方向非常一致，也和 `graphify` 的 “one-page map + deeper graph query” 很接近。

它们的启发是：

- narrative 层是必要的
- 但 narrative 层应该服务导航，而不是替代代码理解
- 正确做法是“先给地图，再给查询”，而不是“先给大而全百科”

## 4.4 Octogent / repo-analyzer：核心启发是“协作上下文需要持久文件，但报告生成不是终局”

来源：

- https://github.com/hesamsheikh/octogent
- https://github.com/yzddmr6/repo-analyzer

`octogent` 的价值在于，它把上下文、todo、handoff note 做成了持久文件系统，让多 agent 协作不依赖单一聊天线程。

这对 `spec-graph-bootstrap` 的启发是：

- 团队协作不是只靠一份 summary 文档
- 需要 durable、可局部更新、可交接的上下文文件
- context 应该能服务多角色、多阶段，而不只是单次会话

`repo-analyzer` 的价值则在于：

- 它很适合做一次性的架构理解报告
- 但这类报告不是持续型 Stage-0 系统的核心

换句话说，它更像“研究报告生成器”，不是“可迭代上下文分发系统”。

## 4.5 Benchmark 方案给出的启发：必须把“代码库理解”做成可评估对象

来源：

- https://arxiv.org/abs/2602.05892
- https://www.qodo.ai/blog/qodo-ranked-1-ai-code-review-tool-in-martians-code-review-benchmark/

外部方案在这点上已经非常清晰：

- 代码理解不是抽象口号，而是可以围绕真实任务评估
- review、定位问题、规划改动、问答理解，都可以设计 benchmark
- 多 agent 也不是目的，关键是能否在 precision / recall / F1 / success rate 上带来真实提升

这对 `spec-graph-bootstrap` 的意义很直接：

**如果没有 benchmark，就无法证明当前 Stage-0 真正提升了代码库理解。**

## 五、以终为始：一个正确且合理的 Stage-0 产物体系应该长什么样

如果不受当前实现约束，只看目标，那么正确的 Stage-0 产物体系应该分成五层。

## 5.1 控制面：回答“这些产物从哪里来、还能不能信”

建议保留并升级：

- `artifact-manifest.json`

但它应该扩展为真正的控制面，至少包含：

- schema version
- analyzer version
- generator version
- source snapshot
- owner / reviewer / last_verified
- freshness state
- invalidation reason
- compatibility info
- outputs dependency graph
- per-output staleness

控制面的职责不是记录“生成过”，而是回答：

- 现在还能不能用
- 为什么能用
- 哪些部分已经过时

## 5.2 事实层：回答“代码库真实结构是什么”

这一层必须坚持 machine-first，优先于 narrative。

建议保留并收口为少数高价值事实资产：

- `repo-identity.json`
- `entrypoints.json`
- `module-index.json`
- `risk-index.json`
- `test-index.json`
- `integration-index.json`
- `data-shapes.json`
- `graph-health.json`

每条事实都应带：

- `confidence`
- `inference_reason`
- `evidence`
- `updated_at`
- `freshness`

同时要严格避免：

- 混入非目标代码范围的资产模板
- 把 narrative 摘要和事实结构混在一起
- 只给结论不给证据

## 5.3 路由层：回答“这个任务现在最该读什么”

这是当前最缺的层。

建议新增：

- `context-routing.yaml` 或 `context-routing.json`
- deterministic evaluator
- 最小上下文卡片（minimal context cards）

这层的职责是：

- 按任务类型/阶段/预算计算最小文件集
- 给出阅读优先级
- 标注哪些规则命中、哪些规则跳过
- 给出降级原因

这一层的输出不应该只是“文件列表”，还应包含：

- task profile
- 证据优先顺序
- token budget 建议
- fallback reason

## 5.4 narrative 层：回答“人如何快速建立心智模型”

这一层仍然重要，但应该服从事实层和路由层。

建议 narrative 层只保留高 ROI 文档：

- `00-summary.md`
- `architecture/module-map.md`
- `pitfalls/index.md`
- `context-packs/review-change.md`

其定位是：

- 地图
- 导航
- 风险提示
- 协作交接

而不是试图成为“代码翻译全文档”。

## 5.5 评测层：回答“它是否真的提升了代码库理解与下游任务质量”

建议新增独立评测资产，例如：

- `benchmarks/context-understanding/`
- `benchmarks/review-recall/`
- `benchmarks/planning-accuracy/`
- `benchmarks/task-routing/`

至少覆盖四类问题：

1. 仓库问答是否更准
2. 变更 review 是否更能抓到 cross-file 问题
3. 规划时是否更快找到正确入口和测试面
4. work 执行时是否更少扫无关文件

没有这一层，Stage-0 永远只能停留在“看起来合理”。

## 六、基于终局模型回看当前方案：差距主要在哪里

### 6.1 团队协作可维护性：当前是“可维护雏形”，不是“低成本维护系统”

当前优点：

- 路径和产物命名已经比早期版本稳定
- `artifact-manifest.json` 已经提供控制面雏形
- `docs/contexts/<slug>/` 作为 durable asset 的方向是正确的

当前不足：

- 规则执行还在 prompt 层，维护成本高
- sample 仍可能漂移
- freshness / ownership / compatibility 信息不足
- 缺少局部失效传播和局部重建的明确定义

结论：

**当前可以维护，但维护成本会随着产物增加而上升，不适合直接无限扩容。**

### 6.2 产物内容合理完整性：当前是“方向合理但结构不够分层”

当前优点：

- 已经覆盖入口、风险、测试、概览、模块图这些高价值主题
- narrative 层没有完全失控，仍然偏精简

当前不足：

- machine-first 事实层和 narrative 层耦合仍偏重
- 缺少真正的 minimal context artifact
- 缺少 freshness / uncertainty / provenance 的系统化表达
- 数据形状等内容还可能被无关资产污染

结论：

**当前内容并不空，但还没有形成“面向任务消费”的合理分层。**

### 6.3 代码库理解能力：当前已具雏形，但还不是可信赖的“理解引擎”

当前优点：

- 已能识别主要入口、部分高风险点、部分测试映射
- 已有 CRG Full 模式与图谱健康提示
- 已能把“应谨慎解读”的图谱状态写入 summary

当前不足：

- unresolved edges 仍高，说明图谱理解还有盲区
- data shapes 仍会混入非主代码资产
- 缺少任务级最小证据包
- 缺少以 benchmark 证明“理解是否更准”

结论：

**当前更像“代码库理解辅助器”，还不是“代码库理解底座”。**

## 七、下一阶段优化优先级

## P0：先修系统性硬伤

1. 建立 source skill -> sample -> generated artifact 的单一真源与 sample generator
2. 修复 `updated_at` 等 schema drift
3. 为事实抽取补充“分析范围边界”，隔离 workflow assets / templates 对主代码理解的污染
4. 把 freshness / compatibility / owner / last_verified 补入控制面

## P1：补最小上下文分发层

1. 新增 shared evaluator
2. 从 `injection-index.yaml` 升级到 machine-readable routing contract
3. 引入 minimal context card / task profile / token budget
4. 把 `plan / work / review` 的路由执行从 prompt 描述升级到结构化求值结果

## P2：补代码库理解质量闭环

1. 建立 codebase understanding benchmark
2. 建立 review recall / planning accuracy / routing hit-rate 指标
3. 用真实仓库任务做 A/B 验证
4. 用评测结果反推哪些产物保留、哪些产物淘汰

## P3：最后再扩 narrative 与团队协作层

1. 增加按角色/任务的 handoff 视图
2. 增加 workspace / multi-repo 级知识层
3. 增加对团队维护流程更友好的编辑入口
4. 视收益决定是否引入更丰富的 wiki / report 资产

## 八、最终判断

如果问题是：

**“当前 Stage-0 产物能不能支撑下一步继续演进？”**

答案是：**能。**

如果问题是：

**“当前 Stage-0 产物是否已经达到合理终局，足以宣布目标达成？”**

答案是：**不能。**

它当前最像的是：

- 一个方向正确的 Stage-0 MVP
- 一个已经具备事实层和文档层雏形的底座
- 一个还缺“最小上下文分发 + 评测闭环 + 代码理解质量控制”的过渡系统

真正合理的终局，不是继续堆更多文档，而是把它收敛成：

**控制面可信、事实层干净、路由层确定、narrative 层克制、评测层可验证的代码库理解与上下文分发系统。**

这才是 `spec-graph-bootstrap` 下一阶段最值得追求的目标。
