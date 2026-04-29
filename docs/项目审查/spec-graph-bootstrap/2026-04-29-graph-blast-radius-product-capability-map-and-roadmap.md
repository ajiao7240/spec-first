# Graph Blast Radius 产品能力地图与路线图

## 1. 背景

`spec-graph-bootstrap` 已经把 external graph provider 的可用性问题收敛为一组可追溯的 readiness 事实：哪些 provider 可运行、哪些查询面已验证、哪些只能降级使用、哪些需要回退到直接读仓库。

但这套能力目前仍主要以 runtime artifact、contract 和 workflow handoff 的形式存在。对于 `spec-plan`、`spec-work`、`spec-code-review` 这类下游场景来说，仓库里已经有了“图能力是否可用”的基础判断，却还没有一份足够清晰的产品级文档来回答下面这些问题：

1. Graph Blast Radius 到底是什么能力，而不是什么能力。
2. 它当前已经具备哪些输入条件与使用边界。
3. 它与 graph readiness、query readiness、live MCP probe 之间是什么关系。
4. 它下一阶段应该如何演化，才能真正提升 LLM 的决策输入质量，而不是演化成额外的状态机或强编排层。

这份文档的目标，是把 Graph Blast Radius 从“已有若干 readiness 基础设施与下游消费线索”整理为“一个边界明确、可渐进增强的产品能力地图与路线图”。

## 2. 问题定义

Graph Blast Radius 关注的不是“有没有图”，而是“在当前会话、当前仓库、当前任务上下文里，系统能否为 LLM 提供足够真实、可追溯、可降级的影响面输入”。

这里至少存在四个必须分清的层次：

1. **provider build/status readiness**
   - provider 是否能完成 bootstrap / status。
2. **query-surface readiness**
   - provider 是否真的具备可用的查询面，而不是只完成了安装或建图。
3. **session-local live MCP evidence**
   - 当前会话是否正好能通过 MCP 成功拿到一次真实查询结果。
4. **LLM 最终可用输入**
   - 在 compiled artifacts 可用、live MCP 可用、或两者都不充分时，LLM 实际应该依赖哪些事实做决策。

当前仓库里的一个关键经验是：**图谱存在，不等于查询面健康；live MCP probe 成功，也不等于 compiled `query_ready=true`。**

这意味着 Graph Blast Radius 不能被设计成“只要有某种图能力就自动输出影响结论”的黑盒系统。它必须保留事实层和判断层的边界：脚本只编译 readiness 事实，LLM 负责解释这些事实是否足够支撑当前任务。

## 3. 产品定位

Graph Blast Radius 的正确定位是：

> 面向 spec-first workflow 的变更影响理解能力层，用来提升 LLM 在计划、执行、评审场景中的决策输入质量。

它不是：

- 一个独立替代 LLM 的规则引擎。
- 一个必须成功才能继续工作的中心化 gate。
- 一个把所有 graph / MCP / review / task 语义强行汇总成单一状态机的编排系统。

它应遵循当前项目已经明确的演化原则：

- **Light contract**：只固化最低必要事实合同。
- **Explicit boundaries**：清楚区分 compiled readiness、session-local evidence、downstream interpretation。
- **Let the LLM decide**：脚本准备确定性事实，LLM 决定是否足够支撑当前问题。

## 4. 目标用户与核心场景

### 4.1 目标用户

1. 使用 `spec-plan` 制定任务方案的 LLM / 用户
2. 使用 `spec-work` 执行变更的 LLM / 用户
3. 使用 `spec-code-review` 审视改动影响面的 LLM / 用户
4. 需要理解 graph degraded / fallback 语义的仓库维护者

### 4.2 核心场景

#### 场景 A：修改前判断 blast radius

在编辑一个符号、一个 workflow 文档或一个 runtime contract 之前，需要先知道：

- 这项改动可能影响哪些下游 workflow。
- 当前图能力能否支持足够可信的影响判断。
- 如果图能力不足，应该回退到哪些证据来源。

#### 场景 B：plan 阶段解释为什么能或不能依赖图能力

`spec-plan` 需要的不只是“graph_ready=true/false”，而是：

- 当前 readiness 是 fully ready、degraded 还是 blocked。
- degraded 的原因在 build/status/query-surface 哪一层。
- 当前会话是否有额外的 live MCP 证据可以帮助缩小不确定性。

#### 场景 C：review/work 阶段说明影响判断的可信度

在 work 或 review 阶段，如果系统给出“这项修改可能影响 X/Y/Z”，还需要能解释：

- 这来自 compiled graph artifacts。
- 还是来自一次 session-local live MCP probe。
- 或者其实来自 bounded direct repo reads 的 fallback 推断。

#### 场景 D：graph degraded 时维持可工作的降级路径

Graph Blast Radius 的价值不在于“强制每次都拿到完整图谱”，而在于：

- 当图能力充足时，提高理解效率。
- 当图能力部分失效时，仍能清楚地告诉 LLM：哪些能信，哪些不能信，下一步该怎么退化。

## 5. 当前能力地图

## 5.1 已具备的基础能力

### A. Graph Readiness Compiler

当前 `spec-graph-bootstrap` 已能把外部 graph provider 的 deterministic readiness 编译为 canonical artifacts，包括：

- provider status
- graph facts
- impact capability artifacts
- bootstrap report

它的作用不是直接输出 blast radius 结论，而是回答：

- provider 是否成功 bootstrap。
- provider 是否成功 status。
- provider 是否完成 provider-specific query proof。
- 当前整体处于 ready、degraded-fallback 还是 blocked。

### B. Provider 级 readiness 边界

当前合同已经明确区分两个 provider：

- `gitnexus`
- `code-review-graph`

并要求 `query_ready=true` 必须依赖三级证据，而不能从 build 成功直接推断。这为后续 blast radius 能力提供了必要前提：至少系统知道自己是否真的拥有可用查询面。

### C. Live MCP Probe 的边界治理

当前合同已经明确：

- deterministic bootstrap script 不能调用 host MCP tools。
- live MCP probe 只应在脚本完成后、会话工具可用且结果能澄清交付时，做一次 bounded probe。
- live MCP probe 成功只能视为 **session-local evidence**。
- 它不能回写 compiled `query_ready=true`，也不能重写 canonical graph artifacts。

这是 Graph Blast Radius 产品能力的关键约束，因为它防止“当前会话碰巧 probe 成功”污染项目级 readiness 事实。

### D. 下游已有消费入口

当前 `spec-plan` 已经是 graph readiness 的首个下游消费者。它能读取 graph/impact artifacts，在 readiness 缺失、陈旧、blocked 或 degraded 时，转向 fallback 证据。

这说明 blast radius 并不是从零开始，而是已经有了一个可继续增强的消费入口。

## 5.2 当前仍缺失的能力

尽管 readiness 基础设施已经存在，但真正的 Graph Blast Radius 产品能力还缺以下拼图：

### A. 用户可读的影响面表达层

当前系统更擅长回答“provider 是否可用”，还不擅长稳定回答：

- 这次改动可能影响哪些模块、流程、合同边界。
- 这些影响判断分别来自哪类证据。
- 当前判断的置信度属于高、中、低哪一类。

### B. workflow 级 blast radius evidence block

目前 readiness 已可下游消费，但仍缺少一个更产品化的“blast radius evidence block”，把下面这些内容统一呈现给 workflow：

- evidence source
- readiness level
- fallback path
- confidence / caveat
- recommended use

### C. review/work 对影响摘要的稳定消费

当前可以说已有“图能力准备层”，但还没有形成稳定的“影响摘要消费层”。

也就是说，Graph Blast Radius 还更像 substrate，而不是完整闭环产品。

## 6. 成熟度判断

从产品成熟度看，Graph Blast Radius 目前处于：

> **Stage 0.5：具备 readiness substrate，但尚未形成完整的 blast radius 产品闭环。**

### 6.1 已具备

- provider readiness 编译
- query-surface fail-closed 约束
- compiled readiness 与 session-local evidence 分离
- 下游 workflow 的初步消费入口
- degraded / blocked / fallback 的基本叙事框架

### 6.2 部分具备

- 影响能力的对外表达
- 不同证据来源之间的可信度说明
- 从 readiness 事实过渡到“本次改动可能影响什么”的桥接结构

### 6.3 尚未具备

- 可复用的 blast radius evidence block
- review/work 稳定消费的影响摘要合同
- 面向最终用户的统一“为什么这次能信/不能信”解释层

因此，当前最合理的判断是：

Graph Blast Radius 还不是一个“已经成型的最终用户能力”，但它已经拥有足够清晰的 readiness 基础设施，值得以产品能力地图的方式继续推进。

## 7. 差异化优势

如果这条路线继续沿着当前边界推进，它有几个明显优势。

### 7.1 先把 readiness 做真，再谈 blast radius 做强

很多系统容易过早进入“自动影响分析结论”阶段，但当前 spec-first 的做法更稳：

- 先验证 provider 是否真的可用。
- 再区分 compiled artifacts 与 live session evidence。
- 最后才让下游 workflow 决定如何消费这些证据。

这减少了“假图能力”“伪成功查询”“把会话偶发现象写成项目真相”的风险。

### 7.2 双宿主治理天然要求边界清晰

spec-first 需要同时面对 Claude / Codex 等不同宿主，任何图能力都不能假设单一宿主行为恒定。这反而迫使 Graph Blast Radius 产品从一开始就：

- 避免写死宿主特性。
- 避免把 host-local 状态写进项目级真相源。
- 保持事实层、运行时层、解释层分离。

### 7.3 deterministic scripts + LLM interpretation

这条路线与项目哲学高度一致：

- 脚本负责可重复、可验证的 readiness 编译。
- LLM 负责将这些事实解释为风险、影响、下一步建议。

这使 Graph Blast Radius 更像“高质量认知输入系统”，而不是“自动决策替代系统”。

## 8. 版本增强路线

## 8.1 MVP：让 `spec-plan` 能清楚解释 graph readiness 与 fallback

目标：

- 让 `spec-plan` 不只是知道 provider degraded，而是能把 degraded 对 planning 意味着什么说清楚。
- 明确 compiled readiness、live MCP probe、direct repo reads 在 plan 阶段各自承担什么角色。

MVP 的完成信号：

- 用户在 plan 阶段能清楚看到本次规划所依赖的影响证据来自哪里。
- degraded 时不会被误导为“图能力完全可用”。
- live MCP 成功不会污染 compiled query readiness。

## 8.2 Phase 1：形成 blast radius evidence block

目标：

- 在不引入重状态机的前提下，形成一个可被多个 workflow 消费的最小证据块。

建议字段方向：

- evidence source
- readiness level
- confidence note
- fallback used
- recommended interpretation

完成信号：

- `spec-plan`、`spec-work`、`spec-code-review` 能共享同一种最小影响证据表达。
- 证据块仍保持轻量，不反向变成中心化 gate。

## 8.3 Phase 2：review/work 消费影响摘要

目标：

- 让 work/review 能基于 blast radius evidence block 生成更稳定的影响摘要。

这里的关键不是自动生成“绝对正确的影响图”，而是稳定表达：

- 这次判断依赖了哪些事实。
- 哪些部分是图证据，哪些部分是 LLM fallback 推断。
- 哪些结论应被视为提示，而不是硬门控。

## 8.4 Phase 3：更成熟的任务级影响协作

只有在前几阶段已经稳定后，才值得探索：

- task-level impact facts
- review evidence 复用
- 更细粒度的 process/symbol blast radius 摘要

但这些都应建立在“当前事实边界已经被长期证明稳定”之后，而不是现在就提前引入。

## 9. 风险与边界

Graph Blast Radius 最容易跑偏的地方主要有四类。

### 9.1 把 live MCP success 写成 compiled truth

这是当前合同已经明确禁止的方向。

如果一次 live MCP probe 成功就把 compiled `query_ready` 改成 true，会导致：

- 项目级真相源被会话偶然性污染。
- 后续 session 无法正确理解 graph degraded 的真实状态。

### 9.2 把 readiness compiler 演化成强编排中心

`spec-graph-bootstrap` 的职责应保持在 readiness 编译层，不应把 blast radius、task inference、review judgment 都塞回 bootstrap 阶段。

否则会导致：

- contract 膨胀
- 多真相源
- 脚本职责侵入 LLM 决策层

### 9.3 把 Graph Blast Radius 误做成自动裁决系统

这个能力的正确作用是“提高输入质量”，不是“替代判断”。

如果它被做成“只要图可用就自动给出影响结论、自动决定该不该继续”的系统，就会偏离项目当前的哲学基线。

### 9.4 过早追求表面完整

当前最稳的路径不是一口气补齐所有 review/work/task 影响结构，而是：

- 先让 readiness 解释足够清楚。
- 再让 blast radius evidence block 足够轻。
- 最后再考虑更多下游复用。

## 10. 结论

Graph Blast Radius 已经拥有一个值得继续推进的基础：provider readiness、query-surface proof、live MCP probe 边界和 downstream fallback 语义都已逐步成形。

但它当前仍主要是“基础能力准备层”，不是完整产品闭环。

因此，下一阶段最重要的不是再增加更多 provider 或更多状态，而是把现有 readiness 基础设施收敛为一套更清晰的产品能力表达：

- 它服务谁。
- 它当前能做什么。
- 它不能做什么。
- 当图能力不足时，LLM 应如何安全降级。
- 哪些增强值得做，哪些增强会让系统边界变糊。

如果沿着这条路线推进，Graph Blast Radius 会成为 spec-first 中一个非常关键的“高质量决策输入层”：它不抢 LLM 的判断权，但能显著提高 LLM 做判断时所依赖的事实质量。