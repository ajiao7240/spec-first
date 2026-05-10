---
title: "spec-graph-bootstrap CRG Query-First 收益与竞品差异化分析"
type: analysis
date: 2026-04-26
status: active
source_plan: "docs/plans/2026-04-25-001-refactor-graph-bootstrap-crg-query-decision-plan.md"
---

# spec-graph-bootstrap CRG Query-First 收益与竞品差异化分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 结论

如果 `spec-graph-bootstrap` 按当前方案完成重构，`spec-first` 的核心提升不是“多一个图谱功能”，而是把 AI 研发 workflow 的输入层从静态上下文文档升级为可查询、可审计、可降级的代码事实层。

目标状态可以概括为：

```text
从：LLM 读文档 + grep + 猜测
到：AST / CRG 提供结构化事实 + LLM 基于证据决策
```

这会让 `spec-first` 从偏 prompt/workflow 编排的工具，进化为面向 AI coding workflow 的本地代码事实层与决策输入层。

最有价值的第一闭环不是 `locate`，而是 diff impact：

```text
真实 diff
  -> review-context
  -> blast radius
  -> affected flows
  -> candidate tests
  -> spec-code-review 按影响面排序审查
```

原因是 diff impact 有真实 ground truth，能最快证明 CRG query-first 是否真的提升计划、实现和 review 的质量。

## 对当前项目的提升

### 1. 会话冷启动更快

当前 `spec-graph-bootstrap` 主链仍偏向生成 `docs/contexts` 项目上下文包。完成后，默认入口会变成：

```text
graph ready
  -> graph-index-status.json
  -> code-navigation.json
  -> 按任务 query
  -> LLM 决策
```

AI 新会话进入项目时，不需要先读取大量静态 markdown，再自行拼接项目结构。它可以先获得低 token 的图导航信号：

- 关键 entrypoints
- top flows
- top communities
- top hubs
- high-risk nodes
- suggested queries
- graph freshness / degraded 状态
- 可用 query capabilities

直接收益是：新任务进入速度更快，且第一轮判断更贴近当前代码事实。

### 2. `spec-plan` 从“泛化计划”升级为“证据锚定计划”

当前 plan 容易出现的问题是：计划看起来完整，但候选修改面来自 LLM 对目录名、模块名和旧文档的推断。

完成后，`spec-plan` 可以优先消费：

```text
crg locate --query="<task>"
crg explain --symbol=<candidate>
crg path --from=<candidate-a> --to=<candidate-b>
```

计划文档会更容易写出：

- candidate files / symbols / modules
- 每个候选为什么相关
- 证据来自哪个 AST node / flow / community / path
- 哪些候选是 `ambiguous`
- 哪些候选被 LLM 排除，以及排除理由

收益不是“让脚本决定改哪里”，而是减少“先看看某模块附近”这类低价值计划表述，让 LLM 的语义判断建立在更清晰的代码事实上。

### 3. `spec-work` 能控制实际 blast radius

完成后，`spec-work` 可以形成前后两次校准：

```text
实现前：
  impact / path 校准计划改动面

实现后：
  review-context --since=<base>
  对比实际 blast radius 与计划 change surface
```

这能提前发现：

- 原以为是局部修改，实际触达核心调用链。
- 新增改动扩展到了未计划模块。
- 修改命中高 fan-in symbol。
- affected flows 超出计划。
- candidate tests 与实际改动面不匹配。

这比“写完后跑测试看是否失败”更主动，因为它在测试之前先回答“影响范围是否已经扩大”。

### 4. `spec-code-review` 从逐文件 review 升级为影响面 review

当前 review 常见模式是读 diff、读上下文、逐文件判断。完成后，review 可以先拿到：

- changed nodes
- hunk hit nodes
- graph expansion
- affected flows
- impacted modules
- candidate tests
- risk summary
- recommended verifications
- limitations

这会让 review 顺序从：

```text
按文件顺序看 diff
```

升级为：

```text
按影响面、风险和验证缺口排序审查
```

对复杂项目而言，这比单纯“更快读 diff”更有价值。真正的风险通常不在变更行数，而在变更是否触碰关键调用链、关键 flow、公共入口和测试薄弱区。

### 5. 测试建议更精准

当前 AI 经常给出泛化建议：

```text
运行相关测试
必要时运行全量测试
```

CRG query-first 后，测试建议可以从这些事实派生：

- touched symbols
- impacted modules
- affected flows
- candidate tests
- test roots
- coverage gaps
- stale / degraded graph limitations

预期收益是：减少无目标全量测试建议，减少漏掉关键候选测试。

### 6. 文档负担下降，事实真源更清晰

完成后，系统边界会变成：

```text
代码事实真源：graph.db
状态面板：graph-index-status.json
导航摘要：code-navigation.json
人类说明：docs/contexts / graph-report.md
语义决策：LLM
```

这比继续扩大 `docs/contexts` 更健康。静态文档越多，越容易变旧，也越容易被后续 LLM 误读为事实真源。

CRG query-first 的本质是：减少预生成知识包，增加可查询事实层。

## 业界对标

### Cursor：IDE 内 codebase indexing 与 agent editing

Cursor 官方文档说明，它会通过 codebase indexing 计算代码库 embedding，并在代码变更后自动同步，用于提升代码库问答和编辑体验。Cursor 的强项是 IDE 内体验、自动索引、代码生成、编辑和交互。

对标判断：

```text
Cursor 强项：编辑器内高频 coding 体验
spec-first 应避开：IDE 体验和自动补全
spec-first 应强化：AST/CRG 事实、workflow 消费、blast radius、可审计决策输入
```

差异化不是“比 Cursor 更会写代码”，而是“让任何 AI agent 在 plan/work/review 中有更可靠的代码事实输入”。

参考：Cursor Codebase Indexing  
https://docs.cursor.com/context/codebase-indexing

### GitHub Copilot coding agent：平台原生后台执行

GitHub Copilot coding agent 的优势是 GitHub 平台原生：可以把 issue 分配给 Copilot，在 GitHub Actions 环境中工作，并提交 pull request。

对标判断：

```text
Copilot coding agent 强项：GitHub 原生执行与 PR 自动化
spec-first 应避开：平台级任务执行入口
spec-first 应强化：执行前的 change surface、执行后的 blast radius、review 输入质量
```

`spec-first` 的价值不是替代 Copilot 执行任务，而是成为任何执行 agent 的证据层：任务前知道该查哪里，任务后知道影响哪里。

参考：GitHub Docs - About assigning tasks to Copilot  
https://docs.github.com/en/copilot/using-github-copilot/coding-agent/about-assigning-tasks-to-copilot

### Sourcegraph Cody：企业级代码搜索与 code graph 上下文

Sourcegraph/Cody 的文档把 keyword search、Sourcegraph Search、Code Graph、OpenCtx 等作为上下文来源。它的优势是企业级代码搜索、跨仓库 code intelligence 和平台化上下文。

对标判断：

```text
Sourcegraph 强项：企业级代码搜索与跨仓 code intelligence
spec-first 应避开：大型平台级搜索基础设施
spec-first 应强化：local-first、repo-local contract、workflow-native graph consumption
```

`spec-first` 的差异化应该是轻量本地事实层，而不是重建一个企业级 Sourcegraph。

参考：Sourcegraph Cody Context  
https://sourcegraph.com/docs/cody/core-concepts/context

### CodeRabbit：PR review 与知识库上下文

CodeRabbit 的 Knowledge Base 会融合项目指令、linked repos、外部文档、历史 PR、issue tracker、MCP 等上下文，用于增强 code review 和相关工作流。

对标判断：

```text
CodeRabbit 强项：PR review + 团队知识上下文
spec-first 应避开：单点 PR review SaaS 竞争
spec-first 应强化：plan -> work -> review 全链路的代码事实消费
```

CodeRabbit 更偏“PR 已经发生后如何 review”。`spec-first` 可以把 CRG 放到更早的位置：需求刚来时定位候选修改面，实现后检查实际 blast radius，review 时再按影响面排序。

参考：CodeRabbit Knowledge Base  
https://docs.coderabbit.ai/guides/knowledge-base/

### GraphRAG / LlamaIndex：index -> query -> answer 的通用范式

Microsoft GraphRAG 与 LlamaIndex KG-RAG 的共同思路是：先构建索引，再针对问题查询相关子图或知识结构，最后生成答案。

对标判断：

```text
GraphRAG / KG-RAG 强项：通用知识图谱问答
spec-first 应避开：通用语义知识图谱平台
spec-first 应强化：代码专用 CRG，服务修改、影响、验证三类工程决策
```

`spec-first` 的 CRG 不应变成通用知识图谱。它应该坚持代码工程对象：

- file
- symbol
- function
- module
- flow
- community
- test
- diff hunk
- call/import/contains relation

这样才能保持 deterministic facts 和 LLM decisions 的职责边界。

参考：

- Microsoft GraphRAG Query Overview: https://microsoft.github.io/graphrag/query/overview/
- LlamaIndex Knowledge Graph RAG Query Engine: https://docs.llamaindex.ai/en/stable/examples/query_engine/knowledge_graph_rag_query_engine/

## 差异化竞争优势

### 优势 1：不是 AI coding assistant，而是 AI coding workflow 的事实层

Cursor、Copilot 更接近 AI coding assistant。`spec-first` 不应在“谁更会写代码”上竞争。

更准确的定位是：

```text
面向 AI coding workflow 的本地代码事实层与决策输入层。
```

这意味着它可以服务多个 host 和 agent：

- Codex
- Claude Code
- Cursor
- GitHub Copilot
- 其他本地或远端 agent

只要它们能消费 CLI/MCP/文件 contract，就能使用同一套 CRG 事实。

### 优势 2：Workflow-native graph consumption

很多工具提供 code search、embedding search 或 chat context，但上下文消费往往停留在一次问答里。

`spec-first` 的潜在壁垒是把 CRG 融入完整工作流：

```text
spec-plan
  -> locate / explain / path

spec-work
  -> impact before change
  -> review-context after change

spec-code-review
  -> review-context risk ordering
```

这会形成持续复利：每个任务都以同一套事实边界进入计划、实现和审查。

### 优势 3：Blast radius first

主流 AI coding 工具的叙事通常是“更快生成代码”。`spec-first` 可以建立不同心智：

```text
更可靠地控制改动影响面。
```

对复杂项目和团队协作而言，这比“生成更快”更接近高价值问题。真正昂贵的不是写代码本身，而是：

- 改错地方
- 漏掉调用方
- 漏掉 affected flow
- 漏掉测试
- review 没看关键风险点
- 上线后发现 blast radius 远大于预期

### 优势 4：Deterministic facts + LLM decisions 的清晰边界

方案坚持：

```text
Scripts prepare graph facts.
LLM decides engineering meaning.
```

这能避免两类常见问题：

- 让 LLM 假装自己做了 AST/graph 分析。
- 让脚本或规则引擎替 LLM 做语义裁决。

`decision_input_kind: observed | inferred | ambiguous`、`evidence[]`、`limitations[]`、`graph-index-status.json` 会让结论更可审计。用户可以知道某个候选来自确定 AST 事实、图遍历推断，还是低置信度候选。

### 优势 5：Local-first / vendor-neutral

竞品通常有明显平台绑定：

- Cursor 绑定 IDE 体验。
- GitHub Copilot coding agent 深度绑定 GitHub。
- Sourcegraph 绑定企业级代码搜索平台。
- CodeRabbit 绑定 PR review SaaS。

`spec-first` 可以保持：

- 本地生成
- 本地查询
- repo-local artifacts
- host-agnostic
- model-agnostic
- CLI-first，未来可 MCP-first

这会让它更适合作为团队内部的 AI 研发事实层，而不是某个单点工具的附属功能。

### 优势 6：轻 contract，不做 hard gate

很多工程治理工具最后会变成流程负担。当前方案的优势是保持：

- light contract
- explicit boundaries
- no hard gate
- no state machine replacement
- graceful fallback

CRG 结果只作为高质量决策输入，不把 query 结果升级成强制结论。这更符合 AI 研发工具的真实使用方式：工具负责提高输入质量，最终工程判断仍由 LLM 和人类共同承担。

## 需要警惕的非优势区

### 不要和 Cursor 拼 IDE 编辑体验

`spec-first` 不应把重点放在 inline completion、tab editing、chat UX 或 agent UI 上。那是 Cursor 的主战场。

### 不要和 Sourcegraph 拼企业级代码搜索平台

跨仓权限、全公司代码搜索、长期索引服务、代码智能平台不是当前最短路径。`spec-first` 应先证明 repo-local CRG 对 plan/work/review 的价值。

### 不要和 CodeRabbit 拼单点 PR SaaS review

如果只做 review report，很容易被 CodeRabbit 的产品形态压制。`spec-first` 的优势必须来自 plan -> work -> review 全链路，而不是单点 review。

### 不要把 CRG 变成通用 GraphRAG

GraphRAG 是范式参考，不是实现目标。`spec-first` 的图应该服务代码修改决策，而不是扩展成泛知识问答平台。

## 推荐落地优先级

### P1：先打穿 Diff Impact Loop

优先完成：

- `graph-index-status.json`
- `code-navigation.json` 最小版
- `crg review-context` 增强
- `crg impact` 增强
- `spec-work` 实现后消费 `review-context`
- `spec-code-review` 按影响面排序审查

成功标准：

```text
给定真实 diff，系统能回答：
- 改了哪些 AST nodes
- 2-hop 内影响哪些 callers
- 影响哪些 flows/modules
- 候选测试有哪些
- 实际 blast radius 是否超出计划范围
```

这是最容易证明价值、最能与竞品形成差异的第一阶段。

### P2：再做 Planning Navigation Loop

第二阶段完成：

- `crg locate`
- `crg explain`
- `crg path`
- `decision_input_kind`
- `spec-plan` 消费 query 输出生成 candidate change surface

成功标准：

```text
给定新需求，系统能回答：
- 候选文件 / symbol / module 是哪些
- 为什么相关
- 哪些候选是 ambiguous
- LLM 最终选择和排除的证据是什么
```

### P3：补齐 Reliability Layer

第三阶段完成：

- input detection
- self-output exclusion
- sensitive file skip summary
- freshness status
- shrink guard
- last-known-good

成功标准：

```text
graph stale / degraded 时诚实降级；
异常 partial rebuild 不会覆盖健康 graph；
workflow 不伪造 CRG 事实。
```

## 最终定位

完成后，`spec-first` 的对外定位可以是：

```text
面向 AI coding workflow 的本地代码事实层与决策输入层。
```

一句话对标：

```text
Cursor / Copilot 帮你更快写代码；
CodeRabbit 帮你 review PR；
Sourcegraph 帮你搜索和理解大代码库；
spec-first 帮 AI 在 plan / work / review 每一步都基于可审计的代码图事实做工程决策。
```

这个定位成立的前提是实现时坚持当前方案的边界：

- 不膨胀成文档生成器。
- 不做强 gate。
- 不让 `locate` 替 LLM 决定修改点。
- 不用 embedding 替代 AST 事实。
- 不把 `graph-report.md` 做成新的大上下文包。
- 不把通用 GraphRAG 当作主目标。

真正的护城河不是“有图”，而是：

```text
CRG 图事实
  + 按需查询
  + plan/work/review 全链路消费
  + 可审计 evidence / limitations
  + LLM 负责最终工程判断
```

