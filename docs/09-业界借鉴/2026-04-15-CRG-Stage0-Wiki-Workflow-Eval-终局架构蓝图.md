# CRG + Stage-0 + LLM Wiki + Workflow + Eval：终局架构蓝图

## 一、为什么还需要这一份蓝图

前一份审查文档已经回答了两个问题：

1. 当前 `spec-graph-bootstrap` 方向是否正确
2. 当前 Stage-0 产物距离合理终局还差什么

但要真正指导后续演进，还需要再向前走一步：

**不只审查当前方案，而是明确整个系统的终局分层。**

也就是：

- `src/crg` 到底应该承担什么职责
- `spec-graph-bootstrap` 应该编译出什么中间产物
- `LLM Wiki / context wiki` 在体系里处于哪一层
- `plan / work / review / verify` 应该消费什么
- 用什么评测来证明这整套系统真的提升了代码库理解与交付质量

这份文档回答的不是“某个模块该怎么改”，而是：

**从代码事实到知识编译，再到任务消费与价值证明，一整套系统应该怎么分层。**

## 二、结论先行

`CRG` 的合理终局定位，不是“代码图工具”，也不是“更高级的 grep”。

它更准确的定位应该是：

**代码事实编译底座。**

在这个定位下，整套系统应分成 5 层：

1. **Index Layer**：从代码库中抽取结构化、可审计、可增量更新的事实
2. **Retrieval Layer**：把事实转换成任务可消费的最小上下文检索与重排能力
3. **Compiled Context Layer**：把高价值理解编译成持久、可维护、可导航的中间知识层
4. **Workflow Layer**：让 `plan / work / review / verify` 在正确时机拿到正确上下文
5. **Eval Layer**：证明整套系统真的提升了代码库理解、决策质量与执行效率

当前仓库的真实状态是：

- **Index Layer**：已经有不错底座
- **Retrieval Layer**：刚起步，明显不足
- **Compiled Context Layer**：已有 Stage-0 雏形，但还未成熟
- **Workflow Layer**：已有软接线，尚未硬化
- **Eval Layer**：基本未建立

## 三、外部参照物如何映射到五层架构

## 3.1 Karpathy `LLM Wiki`：定义中间知识层的范式

来源：

- https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

Karpathy 的核心贡献，不是检索算法，而是提出了一个极重要的系统范式：

- `Raw Sources`
- `Wiki`
- `Schema`

以及三种核心操作：

- `Ingest`
- `Query`
- `Lint`

这说明：

**正确的终局，不是每次都从原始材料重新发现知识，而是把知识编译成可持续维护的中间层。**

这条线直接定义了本文中的 **Compiled Context Layer**。

## 3.2 `llm_wiki`：Karpathy 范式的产品化实现

来源：

- https://github.com/nashsu/llm_wiki

`llm_wiki` 非常重要，因为它把 Karpathy 的模式做成了一个完整产品：

- two-step ingest
- persistent ingest queue
- source traceability
- `index.md` / `log.md` / `overview.md`
- 4-signal relevance model
- community detection
- optional vector search
- review queue / deep research / lint

它说明：

**中间知识层不是“写几篇 wiki”那么简单，而是一个可持续 ingest、可查询、可 lint 的编译系统。**

这条线不仅强化了 **Compiled Context Layer**，也说明它天然需要：

- Retrieval Layer 支撑
- Workflow Layer 消费
- Eval Layer 反证

## 3.3 `graphify`：图消费与渐进披露

来源：

- [graphify/README.md](../../../graphify/README.md)
- [graphify/ARCHITECTURE.md](../../../graphify/ARCHITECTURE.md)

`graphify` 的关键价值在于，它强调：

- one-page summary + deeper query
- confidence taxonomy
- persistent graph
- budget-aware query
- graph 作为 session 间持续资产

它代表的是：

**图不只是建出来，更要被 agent 以低成本、渐进披露的方式消费。**

它主要映射到：

- Retrieval Layer
- Compiled Context Layer

## 3.4 `code-review-graph`：最小上下文与评测驱动

来源：

- [code-review-graph/README.md](../../../code-review-graph/README.md)
- [code-review-graph/docs/LLM-OPTIMIZED-REFERENCE.md](../../../code-review-graph/docs/LLM-OPTIMIZED-REFERENCE.md)
- [code-review-graph/code_review_graph/eval/benchmarks/search_quality.py](../../../code-review-graph/code_review_graph/eval/benchmarks/search_quality.py)

`code-review-graph` 的核心启发很明确：

- minimal context first
- token budget first
- hybrid search
- review-specific blast radius
- eval and benchmark first

它代表的是：

- Retrieval Layer 的成熟化
- Eval Layer 的产品化

## 3.5 `get-shit-done`：workflow 编排层

来源：

- https://github.com/gsd-build/get-shit-done

`get-shit-done` 的关键价值不是索引算法，而是：

- planning context rebuild
- context rot 防控
- verification-aware workflow
- 上层接口轻量稳定

它说明：

**再好的索引与知识层，如果进不了 workflow 主链，也只是静态资产。**

它主要映射到：

- Workflow Layer

## 3.6 学术论文：给 Retrieval / Eval 层提供算法方向

主要来源：

- RepoHyper: https://arxiv.org/abs/2403.06095
- Repoformer: https://arxiv.org/abs/2403.10059
- RepoCoder: https://arxiv.org/abs/2303.12570
- GraphCoder: https://arxiv.org/abs/2406.07003
- CodeRAG-Bench: https://arxiv.org/abs/2406.14497
- CodeRepoQA: https://arxiv.org/abs/2412.14764
- RANGER: https://arxiv.org/abs/2509.25257
- SWE-QA: https://arxiv.org/abs/2509.14635
- AACR-Bench: https://arxiv.org/abs/2601.19494
- FastCode: https://arxiv.org/abs/2603.01012
- SWE-QA-Pro: https://arxiv.org/abs/2603.16124

这些论文共同说明：

- 代码库理解不是“静态索引”就够了
- retrieval / expansion / reranking / packing 是独立问题
- repository-level benchmark 必须单独建立

## 四、五层终局架构

## 4.1 Index Layer：代码事实编译底座

### 目标

从代码库中抽取结构化、可审计、可增量更新的事实。

### 主要职责

- 输入收敛与排除规则
- AST/符号级节点抽取
- 显式边与 unresolved 审计
- 增量构建与 stale 检测
- 图数据库与基础查询
- 基础风险/flow/community 信号计算

### 当前仓库对应

- [src/crg](/Users/kuang/xiaobu/spec-first/src/crg)

### 应产出的核心资产

- `graph.db`
- `input-fingerprints.json`
- `node facts`
- `edge facts`
- `unresolved edges`
- `graph health`
- `generation metadata`

### 当前优点

- AST-first
- incremental build
- unresolved 审计
- SQLite + migration + WAL
- 输入收敛较严谨

### 当前缺口

- generation-based / snapshot-based 原子切换仍不足
- parser degradation 缺少更强的代际可见性
- 检索友好的 node summary / semantic fields 缺失
- 多源内容尚未纳入统一索引抽象

### 设计原则

- 这一层只负责 **事实正确性与索引稳定性**
- 不直接负责“如何把上下文喂给模型”

## 4.2 Retrieval Layer：最小上下文检索与重排层

### 目标

让 agent 在特定任务下拿到**最小但足够**的上下文。

### 主要职责

- lexical retrieval
- graph expansion
- optional semantic retrieval
- reranking
- token-budget packing
- task-aware retrieval profile

### 对应外部启发

- `code-review-graph`
- `graphify`
- RepoHyper
- RANGER
- Repoformer
- FastCode

### 理想输入

- graph facts
- node summaries
- task type
- query / diff / goal
- token budget

### 理想输出

```json
{
  "task_type": "review",
  "budget": 2000,
  "seed_hits": [],
  "expanded_hits": [],
  "ranked_context": [],
  "packing_reason": "graph_expansion + test_coverage + risk_hotspot"
}
```

### 当前仓库对应

当前只有零散能力：

- [src/crg/search.js](../../src/crg/search.js)
- [src/crg/cli/query.js](../../src/crg/cli/query.js)
- [src/crg/commands/review-context.js](../../src/crg/commands/review-context.js)

但还没有真正的统一 Retrieval Layer。

### 当前缺口

- 还没有 hybrid retrieval
- 还没有 graph-enhanced reranking
- 还没有 task-aware packing
- 还没有显式 token budget policy

## 4.3 Compiled Context Layer：持久上下文编译层

### 目标

把高价值理解编译成持久、可维护、可导航的中间知识层。

### 主要职责

- 把 code facts 编译为稳定上下文资产
- 维护 narrative 入口而不是全文翻译
- 维护 `index / log / overview / lint` 等导航资产
- 维护 source traceability
- 维护 freshness / compatibility / contradictions

### 对应外部启发

- Karpathy `LLM Wiki`
- `llm_wiki`
- `graphify`
- `spec-bootstrap`

### 当前仓库对应

- [skills/spec-graph-bootstrap/SKILL.md](../../skills/spec-graph-bootstrap/SKILL.md)
- [docs/contexts/spec-first](/Users/kuang/xiaobu/spec-first/docs/contexts/spec-first)
- [.spec-first/workflows/bootstrap/spec-first](/Users/kuang/xiaobu/spec-first/.spec-first/workflows/bootstrap/spec-first)

### 理想产物

- `artifact-manifest.json`
- `repo-identity.json`
- `entrypoints.json`
- `risk-index.json`
- `test-index.json`
- `context-routing.json`
- `README.md`
- `00-summary.md`
- `module-map.md`
- `overview.md`
- `index.md`
- `log.md`
- `lint-report.json`

### 当前缺口

- narrative 层和 machine-first 层分层仍不够清楚
- 缺少 compiled wiki 风格的 `index/log/lint` 体系
- 缺少 contradictions / stale claims / orphan pages 之类的 lint 资产
- 还没有形成真正的 source-of-truth compiled context contract

## 4.4 Workflow Layer：任务消费与验证编排层

### 目标

让 `plan / work / review / verify` 在正确时机消费正确上下文，并把消费过程纳入质量门禁。

### 主要职责

- planning-aware routing
- review-aware context injection
- work-aware test/risk guidance
- verify-aware quality gates
- context rebuild when needed
- context rot 防控

### 对应外部启发

- `get-shit-done`
- `code-review-graph`
- `spec-first` 当前 workflow 体系

### 当前仓库对应

- [skills/spec-plan/SKILL.md](../../skills/spec-plan/SKILL.md)
- [skills/spec-work/SKILL.md](../../skills/spec-work/SKILL.md)
- [skills/spec-review/SKILL.md](../../skills/spec-review/SKILL.md)

### 当前缺口

- Stage-0 预载仍以 prompt 约定为主
- 缺少 deterministic evaluator
- 缺少结构化 fallback reason
- 缺少 workflow 消费日志
- 缺少 verify 阶段的上下文质量门禁

## 4.5 Eval Layer：价值证明层

### 目标

证明系统真的提升了：

- 代码库理解
- 任务决策质量
- review 命中率
- 上下文效率

### 主要职责

- repo QA benchmark
- retrieval hit-rate benchmark
- context efficiency benchmark
- review benchmark
- impact analysis benchmark
- regression suite for routing / packing / staleness

### 对应外部启发

- `code-review-graph` eval
- CodeRepoQA
- CodeRAG-Bench
- SWE-QA / SWE-QA-Pro
- AACR-Bench

### 当前仓库状态

几乎没有独立建立。

当前只有：

- build quality
- unresolved edge count
- stale warning

这些是运行指标，不是理解质量指标。

## 五、这五层如何协同

正确的数据流应是：

```text
Raw Repo / Raw Docs
  -> Index Layer
  -> Retrieval-ready Facts
  -> Compiled Context Layer
  -> Workflow Layer Consumption
  -> Eval Layer Measurement
  -> 反向修正 Retrieval / Context / Workflow 策略
```

也就是说：

- `Index Layer` 负责把“原始代码”变成“可信事实”
- `Retrieval Layer` 负责把“可信事实”变成“任务所需证据包”
- `Compiled Context Layer` 负责把“高价值理解”固化为长期资产
- `Workflow Layer` 负责把这些资产稳定接入真实任务
- `Eval Layer` 负责证明这套系统值不值得继续存在

## 六、对应到当前仓库，最关键的系统缺口是什么

### 6.1 `src/crg` 过强在索引，过弱在 retrieval

当前 `src/crg` 已具备较强的 symbolic indexing 能力，但 Retrieval Layer 还非常薄弱。

这意味着：

- 它能较好地回答“图里有什么”
- 还不能较好地回答“任务现在最该读什么”

### 6.2 Stage-0 有 compiled context 雏形，但还不像完整 wiki layer

当前 Stage-0 的产物已经在往 compiled context 方向走，但仍更像：

- 一组文档
- 一组 JSON
- 一个简单路由索引

还不像：

- 持久知识编译层
- 可 lint 的 context wiki
- 可演化的 index/log 系统

### 6.3 Workflow 已接线，但消费尚未硬化

这是当前最明显的“系统接口缺口”。

### 6.4 Eval 层几乎缺失

这会导致后续所有增强都很难证明真实收益。

## 七、`CRG v2` 的建议演进顺序

## 7.1 近期：先把 Index Layer 和 Retrieval Layer 接起来

优先级最高：

1. generation-based build / 更强的原子切换
2. parser degradation / stale facts 显式标记
3. node summary / retrieval text 准备
4. unified retrieval API
5. task-aware minimal context packing 初版

目标：

- 不再只有“建图”和“查图”
- 开始具备“给任务分发最小上下文”的能力

## 7.2 中期：让 Stage-0 真的成为 compiled context layer

优先级第二：

1. 引入 `index.md / overview.md / log.md / lint-report`
2. 引入 source traceability 与 contradictions lint
3. 引入 source skill -> sample -> runtime generator 的单一真源
4. 引入 deterministic evaluator

目标：

- Stage-0 不再只是 docs generator
- 而成为 agent 可持续消费的 context compiler

## 7.3 中长期：把 Workflow Layer 和 Eval Layer 建起来

优先级第三：

1. `plan / work / review / verify` 的统一 Stage-0 evaluator
2. repo QA / review / context efficiency benchmark
3. 用真实项目做 A/B 验证
4. 用 benchmark 回推该保留哪些产物、淘汰哪些产物

目标：

- 这套系统不再只能“看起来合理”
- 而能被持续证明有效

## 八、最重要的原则

### 原则 1：不要把 `CRG` 当成终局

`CRG` 是底座，不是终局产品。

### 原则 2：不要把 Stage-0 当成文档工厂

Stage-0 的终局是 compiled context，不是 narrative 膨胀。

### 原则 3：不要把 workflow 接线当作消费闭环

只在 skill 里写“应读取哪些文件”，不等于系统真的稳定消费了这些资产。

### 原则 4：没有 benchmark，就没有“理解提升”

这一点必须严格执行。

## 九、最终判断

到这个阶段，可以把整套系统的终局判断压成一句话：

**`CRG` 是代码事实编译器，Stage-0 是上下文编译器，Workflow 是任务消费器，Eval 是价值证明器。**

当前仓库的真实进度是：

- 第 1 层已经有不错基础
- 第 2 层刚起步
- 第 3 层有雏形但尚未成熟
- 第 4 层只有软接线
- 第 5 层几乎还没建立

所以后续演进的正确方向，不是继续横向堆功能，而是沿这五层逐层补齐。

这也是 `spec-first` 真正走向“AI 代码库理解底座”的必要路径。
