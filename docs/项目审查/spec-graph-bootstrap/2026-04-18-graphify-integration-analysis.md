# `graphify` 与 `spec-graph-bootstrap` 集成优化分析

## 一句话结论

基于当前代码事实，`graphify` 不适合作为 `spec-graph-bootstrap` 的默认 Stage-0 真源，也不适合进入主质量门或主路由合同；它更适合作为一个可选的 `multimodal semantic sidecar`，在运行时为 `stage0-context` 或上层 workflow 提供“设计理由、跨文档语义桥、意外关联、建议提问”，而不是替代 `fact-inventory.json`、`risk-signals.json`、`test-surface.json` 这类确定性事实层。

这符合当前专项审查的指导思想：

- 轻 contract
- 明确边界
- 让 LLM 决策
- 给 LLM 提供更高质量的决策输入，而不是给系统增加一套更重的静态产物和状态机

## 这份文档回答什么

这份文档聚焦回答 4 个问题：

1. `graphify` 这个项目的核心思想和架构逻辑是什么
2. 它与 `code-review-graph`、当前 `spec-graph-bootstrap` 的本质差异是什么
3. 哪些能力适合集成进 `spec-first`，哪些不适合
4. 如果要集成，边界应该怎么划，避免把 Stage-0 做重

## 代码事实依据

本结论主要基于以下代码与文档：

- `graphify`
  - `graphify/README.md`
  - `graphify/ARCHITECTURE.md`
  - `graphify/graphify/build.py`
  - `graphify/graphify/extract.py`
  - `graphify/graphify/analyze.py`
  - `graphify/graphify/report.py`
  - `graphify/graphify/serve.py`

- `spec-first`
  - [stage0-context.js](../../../src/cli/commands/stage0-context.js)
  - [workspace-compiler.js](../../../src/bootstrap-compiler/workspace-compiler.js)
  - [evaluator.js](../../../src/context-routing/evaluator.js)

- `code-review-graph`
  - `code-review-graph/README.md`
  - `code-review-graph/code_review_graph/graph.py`
  - `code-review-graph/code_review_graph/tools/context.py`

## `graphify` 的项目思想

### 1. 它不是“代码事实压缩器”，而是“跨模态知识图谱构建器”

从 `graphify/README.md` 和 `graphify/ARCHITECTURE.md` 可以看到，`graphify` 的目标不是只服务代码审查，也不是只服务软件工程仓库，而是：

- 输入任意 corpus
  - 代码
  - markdown
  - PDF
  - 截图
  - 白板照片
  - 图片
  - 视频
  - 音频

- 将这些异构内容统一抽成一个知识图
- 然后让代理用图去发现：
  - 结构
  - 理由
  - 社区
  - 意外连接
  - 值得继续追问的问题

因此它的“中心价值”不是 deterministic repo facts，而是 semantic discovery。

### 2. 它天然接受“推断”和“不确定性”

`graphify` 的置信度模型是显式设计的一部分。
代码依据：

- `graphify/ARCHITECTURE.md`
- `graphify/graphify/analyze.py`
- `graphify/graphify/report.py`

它把边区分成：

- `EXTRACTED`
- `INFERRED`
- `AMBIGUOUS`

这说明 `graphify` 不是在承诺“所有输出都适合作为主事实合同”，而是在承诺：

- 我会把找到的、推断的、模糊的区分开
- 允许图中存在推断关系
- 允许图中存在值得人工复核的模糊边

这很适合“探索、启发、跨材料理解”，但不适合作为 Stage-0 主真源直接驱动下游硬门控。

## `graphify` 的架构逻辑

### 1. Pipeline 非常清晰，但它解决的是“语义图谱构建”问题

`graphify/ARCHITECTURE.md` 明确给出了 pipeline：

`detect() -> extract() -> build_graph() -> cluster() -> analyze() -> report() -> export()`

这个 pipeline 背后的架构意图很统一：

- `detect`
  - 找 corpus 文件
- `extract`
  - 从不同内容类型抽节点和边
- `build_graph`
  - 合并为图
- `cluster`
  - 按图拓扑发现社区
- `analyze`
  - 识别 god nodes、surprising connections、suggested questions
- `report`
  - 生成人读报告
- `export`
  - 导出查询与浏览产物

这套链路说明 `graphify` 的第一性原理是：

- 先构图
- 再基于图做理解与启发

而不是：

- 先定义 workflow contract
- 再为 `plan/work/review` 生产最小充分事实包

### 2. 抽取结构是轻 schema，不是阶段化 workflow contract

`graphify/graphify/extract.py` 和 `graphify/ARCHITECTURE.md` 显示，它的 extractor 输出 schema 很轻：

- `nodes`
- `edges`

每个边核心上只有：

- `source`
- `target`
- `relation`
- `confidence`

它没有像 `spec-first` 当前 runtime 那样面向 workflow 输出：

- `selected_assets`
- `fallback_reason`
- `verification_summary`
- `verification_evidence`
- `verification_gate_state`
- `ai_dev_quality_gate_result`

这说明它不是“workflow-ready contract system”，而是“graph-ready semantic substrate”。

### 3. 查询面是图查询，不是阶段上下文编译

`graphify/graphify/serve.py` 暴露的是典型图谱查询接口：

- `query_graph`
- `get_node`
- `get_neighbors`
- `get_community`
- `god_nodes`
- `graph_stats`
- `shortest_path`

这些接口非常适合：

- 按概念追图
- 查邻接关系
- 查路径
- 查社区
- 做解释性探索

但它没有原生回答 `spec-first` 当前最关键的问题：

- 当前 stage 应注入哪些资产
- 当前 fallback_reason 是什么
- 当前 verification 应用哪个 profile
- 这个 repo/workspace 现在处于什么可用等级

所以它更像上游知识底座或旁路探索器，而不是 `stage0-context` 的直接替代品。

## 与 `code-review-graph` 的本质差异

### 1. `code-review-graph` 更像“工程审查上下文压缩器”

从 `code-review-graph/code_review_graph/graph.py` 和 `code-review-graph/code_review_graph/tools/context.py` 可以看到，`code-review-graph` 的重心是：

- 用 AST 与图结构表示代码关系
- 针对变更面做 blast radius
- 针对 review/debug/onboard 产出 ultra-compact context

它的最强特性不是多模态，而是：

- 变更影响面
- 最小上下文
- 代码审查任务导向

这与 `spec-first` 的 Stage-0 目标天然更接近。

### 2. `graphify` 更广，但也更“语义探索”

`graphify` 的重心是：

- 跨代码与文档/图片/视频的统一语义图
- 社区发现
- 惊喜关联
- 设计理由
- 建议提问

因此：

- `code-review-graph` 更像“工程任务图”
- `graphify` 更像“知识理解图”

前者更适合做 deterministic workflow context compression。
后者更适合做 optional semantic augmentation。

## 与当前 `spec-graph-bootstrap` 的本质差异

### 1. 当前 `spec-first` runtime 的核心是“按 stage 编译最小充分决策输入”

[workspace-compiler.js](../../../src/bootstrap-compiler/workspace-compiler.js) 和 [evaluator.js](../../../src/context-routing/evaluator.js) 的核心逻辑不是构图，而是：

- 解析当前 repo 或 workspace 命中范围
- 评估当前 context 状态
- 根据 routing、manifest、freshness 和 stage 选择资产
- 合成 runtime verification bundle
- 最终得到 stage-facing 决策包

[stage0-context.js](../../../src/cli/commands/stage0-context.js) 又把这层能力暴露成统一 CLI 入口。

这说明当前 `spec-first` 真正稳定的系统轴线已经不是“静态写很多文档”，而是：

- facts / routing / freshness / verification
- runtime compile
- task-facing context packet

### 2. `graphify` 如果硬并入主轴，会引入合同污染

如果把 `graphify` 直接塞进 `spec-graph-bootstrap` 的默认核心产物集合，会出现几个结构性问题：

1. 真源边界变模糊
   `graph.json` 混合了确定性事实、推断关系、模糊关系，不再适合作为 Stage-0 主真源。

2. 下游消费语义不稳定
   `spec-plan`、`spec-work`、`spec-code-review` 需要的是最小充分决策输入，而不是一个需要再次解释的大图。

3. 质量门容易被做重
   一旦把 graphify 结果接入 freshness / completeness / quality gate，就会形成新的门控源，增加流程中断概率。

4. 持久化产物膨胀
   `graph.json`、`GRAPH_REPORT.md`、`graph.html`、cache、community 导出物很容易让 bootstrap 重新滑向“产物过多、消费不清、合同漂移”。

## 适合集成的点

### 1. 设计理由与架构意图

`graphify` 擅长把：

- code
- docs
- paper
- screenshot
- 白板图
- 历史方案文档

连成一张语义图。
这对于 `spec-brainstorm`、`spec-ideate`、`spec-plan` 非常有价值，因为这些阶段经常需要：

- 不只是知道“代码怎么写”
- 还需要知道“为什么会这样设计”

### 2. 跨文档语义桥

当前 `spec-first` 的 Stage-0 更擅长 repo facts，但对：

- 方案文档
- brainstorming 文档
- solution 文档
- 历史事故复盘

之间的语义桥接能力较弱。
`graphify` 在这里可以补位，尤其是：

- 某个模块为什么这样设计
- 某个风险在历史文档里是否讨论过
- 某个方案和当前实现之间是否存在概念映射

### 3. 生成“更高质量的问题”

`graphify/graphify/analyze.py` 和 `graphify/graphify/report.py` 明确会生成：

- `god_nodes`
- `surprising_connections`
- `suggested_questions`

这类输出对 LLM 非常有价值，因为它们不是替 LLM 做决定，而是提升 LLM 提问和探索的质量。
这恰好符合“让 LLM 决策”的方向。

### 4. 作为 runtime 辅助输入，而不是持久化主合同

最适合的集成方式不是把 `graphify` 结果并入默认 `artifact-manifest.json` 主集合，而是让 `stage0-context` 在运行时知道：

- 是否存在 graphify sidecar
- 如果存在，能提供哪些摘要信号

例如只暴露一小段 sidecar summary：

- `available`
- `graph_path`
- `report_path`
- `top_communities`
- `god_nodes`
- `surprising_connections`
- `suggested_questions`

这样可以：

- 保持主合同轻
- 让 LLM 有更好的探索入口
- 又不把大图硬塞进固定上下文

## 不适合集成的点

### 1. 不应作为默认 Stage-0 真源

不建议把以下内容并入 `spec-graph-bootstrap` 的默认核心持久化集合：

- `graph.json`
- `GRAPH_REPORT.md`
- `graph.html`
- 全量 community 导出物

原因不是它们没价值，而是它们的价值属性不属于“主事实合同”。

### 2. 不应进入主质量门

不建议让以下问题成为 `plan/work/review` 的主 gate：

- graphify 没跑
- graphify 图不完整
- graphify 没生成 report
- graphify sidecar 不可用

否则结果会很直接：

- gate 变重
- 流程更容易中断
- 用户为了过门去补跑语义图，而不是聚焦真实任务

这与前面已经识别出的 `spec-first` “gate 可能过重”的问题方向相反。

### 3. 不应把图查询 contract 冒充为 workflow contract

`query_graph`、`shortest_path`、`get_neighbors` 很好，但它们解决的是图探索，不是 workflow 决策。
如果把它们包装成“plan/review/work 的必须上下文”，会造成：

- contract 语义变混
- 责任边界不清
- 下游 skill 不知道哪些输入是 hard fact，哪些是 soft hint

### 4. 不应直接复用它的 host 注入策略作为 `spec-first` 主路径

`graphify` 不只是生成图产物，它还会通过 skill 与 hook 机制把“先看图再读文件”的行为写入宿主环境。
代码依据：

- `graphify/graphify/hooks.py`
- `graphify/graphify/skill-codex.md`
- `graphify/graphify/skill.md`

这套机制本身没问题，但对 `spec-first` 来说有一个很现实的集成风险：

- `spec-first` 已经有自己的 runtime 资产治理
- 已经有自己的 `AGENTS.md` / `CLAUDE.md` / workflow entry 治理
- 已经有自己的 stage 路由与上下文编译入口

如果直接把 `graphify` 的宿主注入策略照搬进来，很容易造成：

- 规则来源重复
- 指令优先级混乱
- 宿主级 always-on 提示与 `stage0-context` 选择逻辑互相打架

因此更合理的方式不是“直接安装 graphify 的主机治理层”，而是：

- 在 `spec-first` 内部做一层轻适配
- 由 `spec-first` runtime 自己决定何时暴露 graphify sidecar 摘要
- 避免出现两套并行的宿主级上下文治理系统

## 推荐的集成边界

## 结论边界

推荐把 `graphify` 定义为：

`spec-first` 可选的多模态语义旁路，不进入 Stage-0 主真源，不进入主 gate，只在运行时以轻摘要形式参与高层决策与探索式 workflow。

这条边界要同时满足三件事：

1. 不污染主事实合同
2. 不增加流程阻塞
3. 确实提升 LLM 的决策输入质量

### 推荐边界模型

可以把 `spec-first` 的知识输入分成三层：

1. 主事实层
   来源：`spec-graph-bootstrap` / `stage0-context`
   特征：确定性、可追溯、面向 workflow 决策

2. 运行时辅助层
   来源：verification、changed-files、repo/workspace 选择结果
   特征：当前任务导向

3. 语义旁路层
   来源：`graphify`
   特征：探索性、启发性、多模态、允许推断和模糊

`graphify` 应明确处在第 3 层，而不是第 1 层。

## 推荐的集成方式

### 方案 A：`stage0-context` 识别 sidecar，但不消费全图

最稳妥的方式是：

- `stage0-context` 检测 repo 中是否存在 graphify 产物
- 如果存在，提取一个极小 sidecar summary
- 把该 summary 加入最终 runtime payload

但只保留轻摘要字段，不直接内嵌全量图或 report 正文。

这会让 LLM 在需要时知道：

- 这里还有一个语义图旁路可查
- 这个图当前最值得看的是什么

而不是一上来被灌入额外的大块上下文。

### 方案 B：优先服务 `spec-brainstorm` / `spec-ideate` / `spec-plan`

`graphify` 的最佳首批落点不是 `spec-work` 或 `spec-code-review`，而是：

- `spec-brainstorm`
- `spec-ideate`
- `spec-plan`
- `spec-compound`

因为这些 workflow 更依赖：

- 设计意图
- 文档联系
- 历史上下文
- 值得继续追问的问题

而不是只看变更影响面和验证 gate。

### 方案 C：把 graphify 查询留在显式触发路径

比起默认注入，更建议把较重的图能力保留在显式触发路径，例如：

- 用户明确请求“看设计理由”
- 用户明确请求“查跨文档联系”
- 用户明确请求“找 surprising connections”
- 上层 workflow 判定当前问题是“语义探索型”

这符合“轻 contract + 明确边界”的原则，因为：

- 默认路径不变重
- 需要时仍然可以获得高质量语义支持

### 方案 D：只接能力，不接它的宿主治理层

如果后续真的要接 `graphify`，建议复用的是：

- 图产物
- 轻量摘要
- 查询能力

不建议直接复用的是：

- 原生 `AGENTS.md` 注入策略
- 原生 `CLAUDE.md` 注入策略
- 原生 always-on hook 作为 `spec-first` 的默认宿主治理方式

因为在 `spec-first` 里，宿主治理层已经是一个独立系统边界，应该继续由 `spec-first` 自己掌控。

## 分阶段集成路线

### 阶段 1：只做 sidecar 发现，不做 hard dependency

建议动作：

- 为 `stage0-context` 增加一个非阻塞 sidecar 探测点
- 只判断 graphify 产物是否存在
- 只读取轻量摘要，不读取全量 `graph.json`

验收标准：

- 没有 graphify 时，任何主 workflow 不受影响
- 有 graphify 时，runtime payload 只多出一个轻 sidecar 区块

### 阶段 2：先服务“文档理解型” workflow

建议动作：

- 在 `spec-brainstorm` / `spec-plan` / `spec-compound` 中试点使用
- 观察它是否真的提升：
  - 方案理解质量
  - 提问质量
  - 文档联系质量

验收标准：

- 没有把流程变重
- LLM 输出的问题和方案明显更有上下文含量

### 阶段 3：谨慎探索 workspace 级跨 repo 语义桥

这一步只建议在后期考虑。
如果 `spec-first` 未来确实要覆盖：

- 多 repo 方案协同
- 跨仓历史文档与实现映射
- 组织级知识桥接

那 `graphify` 才有进一步价值。

但即使到这一步，也不建议把它升级成主 gate 或主真源。

## 对 `spec-graph-bootstrap` 的具体启发

### 1. 应借鉴 `graphify` 的，不是“产物更多”，而是“问题更好”

`graphify` 最值得借鉴的是：

- 它会主动提出 `suggested_questions`
- 它会给出 `surprising_connections`
- 它会提炼 `god_nodes`

这些都在增强 LLM 的认知起点，而不是替代理由判断。
`spec-first` 后续如果要提升质量，应该更多思考：

- 如何让 runtime 给 LLM 一个更好的“起问面”
- 而不是如何继续增加固定 markdown 和静态路由文件

### 2. 应避免借鉴 `graphify` 的“全量导出倾向”

`graphify` 自身做全量导出没有问题，因为它是一个图谱产品。
但 `spec-graph-bootstrap` 的目标不是做另一个图谱产品，而是为 `spec-plan`、`spec-work`、`spec-code-review` 提供高质量 Stage-0 输入。

所以这里要明确克制：

- 不把可导出的都变成默认核心产物
- 不把旁路能力都写成必选合同

### 3. `graphify` 更像增强器，不像底座

如果硬要一句话概括：

- `code-review-graph` 更像“可成为底座的方法论参考”
- `graphify` 更像“高价值增强器”

这两者都值得研究，但在 `spec-first` 里的角色不能混。

## 最终建议

### 可以集成

- 以 sidecar 方式检测 `graphify` 是否存在
- 只读取轻量摘要信号
- 优先服务 `spec-brainstorm`、`spec-ideate`、`spec-plan`、`spec-compound`
- 把 `suggested_questions` 一类能力转化为更优的 LLM 决策输入

### 不建议集成

- 把 `graph.json` 作为默认 Stage-0 truth
- 把 `GRAPH_REPORT.md` 作为默认主上下文资产
- 把 graphify 可用性纳入主质量门
- 让 `spec-work` / `spec-code-review` 默认依赖图查询 contract

## 与现有文档的关系

当前这一组文档建议这样使用：

1. 看“当前真实产物和消费关系”
   以 [2026-04-18-spec-graph-bootstrap-artifacts-map.md](./2026-04-18-spec-graph-bootstrap-artifacts-map.md) 为准，再以代码为最终事实依据。

2. 看“未来目标产物模型与迁移方向”
   以 [2026-04-18-spec-graph-bootstrap-target-model-and-migration-plan.md](./2026-04-18-spec-graph-bootstrap-target-model-and-migration-plan.md) 为准。

3. 看“`graphify` 该如何接入、不该如何接入”
   以本文为准。

## 最终判断

在当前 `spec-first` 演进阶段，`graphify` 最合理的位置不是 Stage-0 主合同的一部分，而是：

- 一个可选语义增强旁路
- 一个帮助 LLM 更好理解设计理由和文档联系的运行时辅助器
- 一个更适合 brainstorm / ideate / plan / compound 的质量增强器

如果坚持“轻 contract + 明确边界 + 让 LLM 决策”，那就不应把 `graphify` 强行接成新的主状态流转节点，更不应让它把 `spec-graph-bootstrap` 再次推回“多状态流转 + 强编排”的方向。
