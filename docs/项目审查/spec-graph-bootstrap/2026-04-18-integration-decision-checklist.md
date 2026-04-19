# `spec-first` 集成取舍清单

## 文档目的

这份文档把前面关于 `spec-graph-bootstrap`、`code-review-graph`、`graphify` 的分析，收敛成一份可直接用于设计决策的清单。

目标不是“能力越多越好”，而是围绕一个唯一标准做取舍：

`是否能稳定提升高质量完成编码的概率，同时不把主流程做重。`

判断时坚持以下原则：

- 轻 contract
- 明确边界
- 让 LLM 决策
- 给 LLM 更高质量的决策输入
- 避免把质量保障做成多状态流转 + 强编排状态机

## 使用方式

后续讨论任何“要不要集成某项能力”时，优先用这份清单判断它属于哪一类：

1. 必须进入主路径
2. 可以集成，但只能作为可选增强
3. 明确不要进入主路径

如果某项能力无法明确归类，默认先不要进入主路径。

## 一、必须进入主路径的能力

这类能力直接影响 LLM 能否基于事实完成高质量编码，应该成为 `spec-first` 的核心系统能力。

### 清单

| 能力 | 是否必须集成 | 原因 | 推荐落点 |
|---|---|---|---|
| repo 结构事实 | 是 | 决定 LLM 是否知道模块边界、入口、依赖关系 | `fact-inventory.json` |
| 风险事实 | 是 | 决定 LLM 是否能优先关注高风险区域 | `risk-signals.json` |
| 测试面事实 | 是 | 决定 LLM 是否能知道应验证哪些区域 | `test-surface.json` |
| verification 基线 | 是 | 决定各阶段的默认验证策略是否稳定 | `verification-profile.json` |
| freshness / manifest | 是 | 决定当前上下文是否可用、是否陈旧 | `freshness.json` + `artifact-manifest.json` |
| stage-aware runtime context | 是 | 决定当前任务真正注入什么，而不是堆静态文档 | `stage0-context` |
| workspace / repo 选择能力 | 是 | 决定 monorepo / workspace 下当前任务命中范围 | `workspace-compiler` + routing |
| changed-files / task-facing selection | 是 | 决定当前工作是否能基于真实变更面收敛上下文 | runtime compile 层 |
| verification summary / evidence | 是 | 决定 workflow 是否看到足够的验证事实 | runtime verification bundle |

### 判断标准

如果一个能力满足以下条件，就应优先进入主路径：

- 它输出的是高置信、可追溯事实
- 它直接帮助 LLM 少猜测、少漏看
- 它能稳定提升 `plan/work/review` 的质量
- 它不会显著增加主流程失败点

### 设计要求

这些能力进入主路径时，也仍然要保持克制：

- 以 machine-readable contract 为主
- 以 runtime 编译最小上下文为主
- 以事实快照为主
- 不为了“完整感”无限增加静态 markdown 产物

## 二、可以集成，但只能作为可选增强

这类能力有价值，但它们更适合提升理解质量、提问质量、方案质量，而不是成为所有 workflow 的默认主输入。

### 清单

| 能力 | 是否可集成 | 适合方式 | 不适合方式 |
|---|---|---|---|
| 设计理由提炼 | 是 | runtime sidecar summary | 默认变成主 truth |
| 跨文档语义桥接 | 是 | 仅在需要时显式调用 | 默认注入所有 workflow |
| `god_nodes` | 是 | 作为理解辅助摘要 | 作为阶段 gate |
| `surprising_connections` | 是 | 作为 brainstorm / plan 提问增强 | 作为 review 必选输入 |
| `suggested_questions` | 是 | 提升 LLM 提问质量 | 替代事实层 contract |
| 多模态材料理解 | 是 | 用于 docs / solutions / plans / brainstorms | 强制进入编码主路径 |
| 图查询能力 | 是 | 作为显式探索工具 | 包装成默认 workflow contract |
| community / semantic summary | 是 | 小摘要注入 runtime payload | 全量图注入上下文 |

### 典型来源

这类能力主要对应 `graphify` 的优势区域：

- code + docs + images + video 的统一语义理解
- 设计理由和概念桥接
- 更高质量的问题生成
- 更高质量的探索入口

### 更适合服务哪些 workflow

这类能力优先服务：

- `spec-brainstorm`
- `spec-ideate`
- `spec-plan`
- `spec-compound`

原因很直接：

- 这些 workflow 更依赖“为什么”和“还有什么值得继续问”
- 它们更能从语义旁路中获益
- 它们对推断性信号的容忍度更高

### 设计要求

集成这类能力时，必须同时满足 3 条：

1. 主流程不依赖它也能正常工作
2. 它只提供辅助决策输入，不篡改主事实合同
3. 它的失败不会中断主 workflow

## 三、明确不要进入主路径的能力

这类能力不是没有价值，而是进入主路径后副作用大于收益。

### 清单

| 能力 / 做法 | 是否应进入主路径 | 不建议原因 |
|---|---|---|
| 把 `graph.json` 作为默认 Stage-0 主 truth | 否 | 混合确定性事实、推断关系、模糊关系，污染主合同 |
| 把 `GRAPH_REPORT.md` 作为默认主上下文资产 | 否 | 更适合阅读与探索，不适合作为稳定 runtime contract |
| 把 graph sidecar 可用性纳入主 gate | 否 | 会增加流程中断点 |
| 让 `plan/work/review` 默认依赖图查询 | 否 | 下游 contract 会变混，主流程变重 |
| 引入第二套宿主治理层 | 否 | 会和现有 `AGENTS.md` / `CLAUDE.md` / runtime 治理冲突 |
| 复制 `graphify` 原生 always-on hook 策略到主路径 | 否 | 会引入双控制平面问题 |
| 为了“完整”继续增加静态产物集合 | 否 | 产物越多，不代表输入质量越高 |
| 把 verification 扩展成复杂状态机 | 否 | 容易形成多状态流转 + 强编排 |
| 把 quality gate 做成“必须经过很多阶段才能继续” | 否 | 会削弱编码流畅性，增加中断 |
| 把探索型信号当成硬约束 | 否 | 会把启发式信息误用为事实合同 |

### 统一判断

凡是具有以下特征的设计，默认都不应该进入主路径：

- 失败会阻断编码流程
- 输出中混合大量推断、模糊、启发式结论
- 主要服务“理解更丰富”，而不是“编码更稳”
- 会引入第二套平行治理系统
- 会让用户为了过流程而不是为了写对代码去补动作

## 四、辩证看待：什么叫“值得集成”

不是所有“高级能力”都值得进主系统。  
真正值得集成的能力，应同时满足“收益高、稳定、低副作用”。

### 建议用这 4 个问题判断

1. 这个能力提供的是事实，还是启发？
2. 它失败时，是否会中断主流程？
3. 它是否直接提升编码质量，而不是只提升系统复杂度？
4. 它进入后，会不会导致新的双真源、双治理、双 gate？

如果答案是：

- 偏事实
- 不中断主流程
- 直接提升编码质量
- 不引入双系统

那么可以考虑进入主路径。  
否则应优先作为 sidecar 或显式触发能力。

## 五、面向当前项目的推荐结论

### 应继续加强的

| 方向 | 建议 |
|---|---|
| Stage-0 事实层 | 继续收紧 `fact-inventory.json` / `risk-signals.json` / `test-surface.json` 等主真源 |
| runtime context 编译 | 继续强化 `stage0-context` 的 stage-aware、task-aware 选择能力 |
| verification 快照 | 保留 verification summary / evidence / gate state，但停留在轻事实层 |
| workspace 路由 | 保持 workspace 只做注册、选择、聚合，不演变成另一套重知识库 |

### 可试点增强的

| 方向 | 建议 |
|---|---|
| `graphify` sidecar | 只做轻摘要探测和显式调用 |
| 文档语义桥接 | 优先用于 `spec-brainstorm` / `spec-plan` / `spec-compound` |
| suggested questions | 把“更好的问题”作为 LLM 决策输入增强，而不是新 gate |

### 应明确克制的

| 方向 | 建议 |
|---|---|
| graph 进入默认 truth | 不做 |
| graph 进入主 gate | 不做 |
| 默认全量注入图报告 | 不做 |
| 新增强状态编排 | 不做 |
| 宿主层双治理 | 不做 |

## 六、执行顺序建议

如果后续真的要推进集成优化，建议按下面顺序做，而不是并行铺开：

1. 先收紧主事实合同  
   先确保 Stage-0 真源边界明确、稳定、可追溯。

2. 再强化 runtime 决策层  
   优先保证 `stage0-context` 能真正输出高质量最小上下文。

3. 再引入可选 sidecar  
   只在主路径稳定之后，再加 `graphify` 这类语义增强。

4. 最后评估是否值得扩展  
   看 sidecar 是否真的提升 brainstorm / plan / compound 质量，再决定是否扩大使用范围。

## 七、最终清单

### 必须做

- 保持 Stage-0 主真源轻而稳定
- 保持 runtime context 编译为主入口
- 保持 verification 为轻事实快照
- 保持 workspace 只做注册与聚合
- 保持下游 workflow 基于高置信事实工作

### 可以做，但非默认

- 接 `graphify` sidecar 轻摘要
- 提供显式图查询入口
- 用 `suggested_questions` 增强 brainstorm / plan
- 用多模态语义桥接增强文档理解

### 不要做

- 不要把 semantic graph 变成默认 truth
- 不要把 graph 可用性纳入主 gate
- 不要让所有 workflow 默认依赖图查询
- 不要复制第二套宿主治理系统
- 不要把质量保障做成强编排状态机

## 结论

围绕“高质量完成编码”这个目标，真正值得进入主路径的，是：

- 事实
- 选择
- 验证

真正值得作为增强器存在的，是：

- 语义桥接
- 设计理由
- 更好的问题

真正需要克制的，是：

- 产物膨胀
- gate 过重
- 双治理
- 强状态编排

一句话收敛：

`主路径只保留高置信、直接提升编码质量的能力；语义增强能力只在需要时出现，帮助 LLM 想得更好，但不让系统变重。`
