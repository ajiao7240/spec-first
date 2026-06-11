# spec-first 与 Graphify 配合优化分析

## 0. 文档目标

本文记录 2026-06-10 会话中关于“spec-first 如何与 Graphify 更好配合”的分析结论，并把临时讨论收敛为可落地的优化方向。

目标不是把 Graphify 提升为新的 source of truth，而是明确它在 spec-first 中的正确位置：

- Graphify 负责快速提供项目地图、跨文件关系和架构级候选。
- spec-first 负责 workflow 编排、证据分级、回源确认和降级策略。
- 源码、测试、日志、契约文档仍是 confirmed truth。

## 1. 背景：为什么需要重新讨论 Graphify 配合方式

这次讨论不是从“要不要安装 Graphify”开始的，而是从一个更具体的执行问题暴露出来的：当用户询问代码链路时，agent 先用了 `rg` 做文本定位，后续才使用 CodeGraph 交叉验证。用户随后追问“最佳顺序应该怎样”，结论是：代码链路问题应该先用 CodeGraph / Graphify 这类图谱或索引能力做候选定位，再用 `rg`、源码读取和配置查询确认。

这个小问题背后实际指向 spec-first 的一个系统性缺口：

- Runtime Setup 已经可以安装和初始化 Graphify / CodeGraph。
- AGENTS / CLAUDE 也已经有“代码库问题优先用 graphify query/path/explain”的说明。
- 但各个 `$spec-*` workflow 对这些 provider 的消费顺序、证据记录和回源纪律并不完全一致。

因此，问题不是“Graphify 能不能用”，而是“spec-first 如何稳定、低耦合、可审计地使用 Graphify”。

## 2. 背景：GitNexus 教训与 provider 边界

spec-first 之前已经经历过 GitNexus provider 的耦合问题。GitNexus 的问题不在于“图谱能力本身不好”，而在于消费侧被 provider-specific 细节绑死：

- workflow routing、startup reminder、instruction block、review pre-facts、schema 和 CI gate 都显式绑定具体 provider。
- provider 输出被过度靠近 workflow contract，导致工具替换、降级和删除都变重。
- 图谱事实、readiness facts、workflow 判断之间的边界不够清晰。

这次 Graphify / CodeGraph 的正确集成方向，是对这个教训的结构性回应：

```text
Runtime Setup 可以帮装、配置、初始化 provider。
Provider 自己拥有索引、图谱生成、query surface 和刷新机制。
Workflow 只消费 capability-class 输出，把它当候选而不是结论。
最终结论必须回到源码、测试、日志、契约文档或用户确认。
```

也就是说，Graphify 应该作为 `project-graph` 能力工具存在，而不是成为新的 workflow truth。

## 3. 背景：CodeGraph 与 Graphify 的分层不同

CodeGraph 和 Graphify 都能帮助 agent 更快理解代码库，但它们服务的问题不同。

CodeGraph 更适合 tactical locating：

- 某个 symbol 的 callers / callees。
- 某个入口会影响哪些函数或方法。
- 某个文件或类的局部调用链。
- 大仓里快速缩小源码读取面。

Graphify 更适合 strategic project map：

- 项目整体结构、社区、god nodes。
- 跨文件、跨文档、跨模块的关系。
- 历史方案、架构文档、代码与文档之间的主题连接。
- 帮助 agent 找到“应该问什么问题”和“先看哪些区域”。

所以最佳顺序不是固定“永远先 Graphify”或“永远先 CodeGraph”，而是按问题类型选择：

```text
符号级/调用链问题：CodeGraph 优先，Graphify 辅助背景。
架构/跨模块/历史方案问题：Graphify 优先，源码和文档回源确认。
bug/root cause/review finding：Graphify 只能给候选，不能直接定因。
```

## 4. 背景：当前 Graphify 已经接入，但查询质量仍有盲区

当前 `spec-first` 仓库已经有 `graphify-out/graph.json`，并且 Runtime Setup 已把 Graphify 纳入 optional provider pack。理论上，agent 面对架构或跨模块问题时可以直接使用：

```bash
graphify query "<question>" --budget N
graphify path "<A>" "<B>"
graphify explain "<concept>"
```

但本次实测也暴露了一个实际盲区：查询 “Graphify 如何与 spec-first 配合” 时，Graphify 主要命中 `AGENTS.md` / `CLAUDE.md` 中的 graphify 小节，没有优先命中 `docs/01-需求分析/13.scale-integration/CodeGraph技术方案.md` 这类关键方案文档。

这说明“图谱存在”不等于“图谱能稳定召回关键上下文”。Graphify 的价值需要两个条件同时成立：

1. provider 已安装、图谱已生成、查询接口可用。
2. 关键文档有足够清晰的 anchor / alias / summary，能被 query 找到。

如果第 2 点不足，workflow 仍然应该降级到 bounded direct reads、`rg` 和 source refs，而不是把 Graphify 的低质量召回当成事实。

## 5. 背景：为什么需要统一消费协议

目前 `spec-plan`、`spec-debug`、`spec-code-review` 已经有 capability-class evidence boundary，说明外部 provider 只能作为 advisory input。但这种边界还没有形成一个独立、可复用的 Graphify consumption protocol。

缺少统一协议会造成三个后果：

1. agent 使用顺序不稳定：有时先 `rg`，有时先 CodeGraph，有时先 Graphify。
2. 证据等级不稳定：Graphify 输出可能被口头当作“项目事实”引用。
3. closeout 不可复盘：后续看不到哪些候选来自 Graphify、哪些已回源确认、哪些被拒绝。

因此，优化点不应是“让 Graphify 更强势”，而应是“让 Graphify 作为 advisory candidate 的使用方式更标准”。

## 6. 总体结论

最佳协作模型不是 `源码 -> CodeGraph -> Graphify -> workflow` 的硬线性 pipeline，而是三层分工：

```text
源码 / tests / logs / docs = confirmed truth
CodeGraph / rg / ast-grep = tactical locating，缩小源码读取面
Graphify = strategic project map，做架构导航、跨模块关系、候选问题发现
spec-first = workflow harness，决定什么时候用、怎么降级、如何记录证据
```

一句话概括：

```text
Graphify 提升理解速度，spec-first 保持证据纪律。
```

## 7. 现状证据

当前仓库已经具备基础集成：

- `spec-mcp-setup` 已把 Graphify 作为 optional provider，安装 `graphifyy==0.8.36`，生成项目根 `graphify-out/`，安装 project skill 和 hook。
- `AGENTS.md` / `CLAUDE.md` 已写入 graphify 使用规则：代码库问题优先使用 `graphify query` / `graphify path` / `graphify explain`。
- `docs/contracts/provider-readiness.md` 已明确：Graphify readiness 是机械事实，不是 confirmed context。
- `spec-plan` / `spec-debug` / `spec-code-review` 已有 capability-class evidence boundary：只把 `project-graph` 当 advisory candidate。

已有架构文档也已经定过核心边界：Graphify 是 `strategic project map`，不是 CodeGraph 后处理，也不是 source truth。

## 8. 暴露的问题

### 8.1 workflow 消费口径覆盖不完整

`spec-plan`、`spec-debug`、`spec-code-review` 已经有 capability-class evidence boundary，但 `spec-work`、`spec-brainstorm`、`spec-prd`、`spec-ideate` 等入口没有同等清晰的 Graphify 读取协议。

这会导致不同 workflow 的行为不稳定：

- 有的 workflow 会优先用 Graphify 做架构导航。
- 有的 workflow 只依赖 direct source reads。
- 有的 workflow 可能用了 Graphify 候选，但没有标准位置记录它的 advisory / untrusted 状态。

### 8.2 Graphify 查询召回关键方案不稳定

实测 `graphify explain "Graphify"` 主要命中 `AGENTS.md` / `CLAUDE.md` 中的 graphify 小节，没有优先命中 `docs/01-需求分析/13.scale-integration/CodeGraph技术方案.md` 这种关键方案。

这说明当前图谱虽然包含相关文档，但 Graphify 对“Graphify 与 spec-first 配合”这类主题的 anchor / alias / summary 质量仍不足。

### 8.3 provider evidence 没有统一落点

当前方向上 `graph_evidence_used` 已被标记为 legacy，新的 work-run artifact 更偏向 `direct_evidence_used`。这是正确方向，但需要补齐“Graphify 候选如何进入 direct evidence”的过程说明。

缺口在于：

- Graphify query 结果应先作为候选。
- 候选被 source/test/log/doc 验证后，才能进入 confirmed scope / finding / root cause。
- 被使用或拒绝的候选应有轻量记录，避免后续复盘时看不出判断来源。

## 9. 建议优化方案

### 9.1 新增共享 Project-Graph Consumption Protocol

建议新增一个共享 contract 或 reference，例如：

```text
docs/contracts/project-graph-consumption.md
```

它不需要很重，只定义 workflow 消费 Graphify 的统一梯度：

```text
1. broad orientation: graphify query "<topic>" --budget N
2. relationship question: graphify path "A" "B"
3. concept explanation: graphify explain "X"
4. never cat graph.json
5. Graphify output is candidate only
6. candidate must be confirmed by source/test/log/doc before becoming finding/scope/root-cause
7. stale/unavailable -> fallback to rg/ast-grep/direct reads
```

下游 workflow 只引用这个协议，避免在每个 `SKILL.md` 里复制长段。

### 9.2 统一记录 `provider_untrusted`

当 workflow 使用过 Graphify 后，closeout / review / plan handoff 至少应记录：

```json
{
  "provider": "graphify",
  "readiness_status": "fresh|stale|unknown|degraded",
  "queries": ["..."],
  "candidates_used": ["..."],
  "source_refs_validated": ["file:line"],
  "candidates_rejected": ["..."],
  "limitations": ["..."]
}
```

这不应恢复旧的 `graph_evidence_used` 作为主 schema。更好的方向是继续使用 `direct_evidence_used`：Graphify 候选最终必须落到 source refs 和 checks/logs。

### 9.3 提升 Graphify 对关键文档的召回

当前关键方案在语料内，但查询召回不稳定。建议增加两个轻量机制：

1. 在关键方案文档中加入稳定 alias / 标题词，例如：
   - `Graphify consumption protocol`
   - `project-graph evidence boundary`
   - `Graphify advisory candidate`
2. 在 Graphify setup / update 后跑一个 query smoke test，例如：

```bash
graphify query "Graphify consumption protocol provider readiness source confirmation"
```

如果查询无法命中关键方案，setup status 不必失败，但可以标记：

```text
query_verified=false
next_action=improve-graphify-anchor-or-rerun-update
```

这能把“图谱存在”与“图谱可用”区分开。

### 9.4 明确不同问题类型的工具顺序

建议把工具选择规则写成短表：

| 问题类型 | 优先工具 | Graphify 角色 | 回源要求 |
| --- | --- | --- | --- |
| 符号级调用链 / 谁调用谁 | CodeGraph / rg | 辅助理解模块背景 | 结论必须读源码 |
| 跨模块架构 / 历史方案 / 关系路径 | Graphify | 第一入口，给候选地图 | 关键结论必须读源文档或源码 |
| bug / root cause | repro / logs / source reads | 提供相关面候选 | 不得直接定因 |
| code review | diff / source reads / tests | 提供影响面候选 | finding 必须有 direct evidence |
| plan / PRD / brainstorm | Graphify + docs/source reads | 做 context orientation | 不得决定 scope authority |
| work 执行 | plan/task/source/tests | 仅帮助定位相关区域 | 修改依据必须是 plan/task/source/tests |

## 10. 最小落地顺序

### P0：统一协议

新增 `project-graph-consumption` 协议，明确 query/path/explain、never cat graph.json、candidate-only、source confirmation、fallback 的最小规则。

### P1：补齐 workflow coverage

让 `spec-work`、`spec-prd`、`spec-brainstorm`、`spec-ideate` 引用同一协议，使它们与 `spec-plan`、`spec-debug`、`spec-code-review` 的 capability-class 边界一致。

### P2：记录 Graphify 使用证据

在 closeout / handoff 中统一记录 `provider_untrusted` 摘要，并把真正验证过的内容落到 `direct_evidence_used`。

### P3：Graphify 查询质量 smoke test

在 setup / refresh 后增加只读 query probe，用于发现图谱召回质量不足的问题。它只产生 advisory next action，不阻塞普通 workflow。

## 11. 明确非目标

以下做法不建议进入核心路径：

- 不把 Graphify 输出当 confirmed evidence。
- 不让 workflow 运行期自动生成或刷新 Graphify 图谱来补缺口。
- 不直接读取全量 `graphify-out/graph.json`。
- 不新增 Graphify 专属 reader 或 adapter envelope。
- 不把 Graphify 名称写死进所有 workflow 的决策逻辑。
- 不恢复 GitNexus 式 provider-specific consumption coupling。

## 12. 最终建议

优先落地三件事：

1. 新增共享 `Project-Graph Consumption Protocol`，定义 Graphify 读取梯度和回源规则。
2. 给 `spec-work`、`spec-prd`、`spec-brainstorm`、`spec-ideate` 补 capability-class evidence boundary。
3. 增加 focused tests，锁住“不直接读全量 `graph.json`、不把 Graphify 输出当 confirmed、用过 Graphify 必须记录 provider_untrusted/source validation”。

这样可以让 Graphify 真正服务 `Codebase -> Context -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路：它负责更快给出项目地图和候选路径，spec-first 负责把候选变成可验证、可审查、可复用的工程证据。
