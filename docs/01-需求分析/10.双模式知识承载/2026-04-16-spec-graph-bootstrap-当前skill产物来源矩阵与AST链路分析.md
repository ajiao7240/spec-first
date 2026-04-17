# spec-graph-bootstrap 当前 Skill 产物来源矩阵与 AST 链路分析

> 文档性质：实现审查 / 来源追踪 / 缺口分析
> 撰写日期：2026-04-16
> 审查范围：
> - `skills/spec-graph-bootstrap/SKILL.md`
> - `src/bootstrap-compiler/*`
> - `src/context-routing/*`
> - `src/crg/*`
> - `tests/unit/spec-graph-bootstrap-contracts.test.js`

---

## 1. 文档目标

本文档只回答三类问题：

1. 当前 `spec-graph-bootstrap` skill 的每类产物，真实来源是什么
2. AST / graph 分析到底发生在哪一层，当前是否已经闭环进入 skill 产物主链
3. 现状距离“AST-grade facts -> machine artifacts -> human docs -> routing”终局链路，还差哪些关键闭环

本文档不按理想方案描述，而是：

> 严格以当前代码实现为准，逐个产物追踪来源，并给出 `Observed / Derived / Sample / Placeholder` 分类。

---

## 2. 先给结论

当前 `spec-graph-bootstrap` 的真实实现状态可以概括为一句话：

> 下层 `CRG` 已经具备真实的 AST + graph + retrieval 能力；上层 `bootstrap-compiler` 已经具备 control plane / context docs 的编排与写盘骨架；但两者之间还没有完全接成“自动事实提取 -> 自动文档编译”的终局闭环。

更具体地说：

1. `src/crg` 里的 AST 解析、graph 构建、增量更新、检索能力是真实现
2. `src/bootstrap-compiler` 当前主要是“消费输入 facts 并写产物”的编排器
3. 当前 `factInventory / riskSignals / testSurface` 更多是编译输入，不是 bootstrap 主链内部自动生成物
4. 当前 `minimal-context/*.json` 最接近真实 facts 消费产物
5. 当前 `context-routing.json / artifact-manifest.json / ownership.json / review-queue.json` 仍明显依赖 sample generator
6. 当前 human docs 文件已形成正式目录 contract，但默认内容仍主要是 placeholder

因此当前真正成立的是：

```text
源码
  -> CRG AST / graph / retrieval

bootstrap compiler
  -> 接收 factInventory / riskSignals / testSurface
  -> 生成 control plane + context docs 骨架

context-routing
  -> 消费 control plane + docs assets
```

而当前尚未完全成立的是：

```text
源码
  -> CRG AST / graph
  -> 自动产出 fact-inventory.json / risk-signals.json / test-surface.json
  -> 自动编译高质量 human docs
  -> 自动生成真实 routing / manifest
```

---

## 3. 产物来源分类口径

为避免混淆，本文对来源做四类分类。

### 3.1 Observed

含义：

- 直接来自源码、AST、graph.db、文件系统、git diff、构建时间等真实观察值
- 不依赖硬编码样本

示例：

- `nodes`
- `edges`
- `graph_meta.last_built`
- 变更文件列表
- 已存在文件路径

### 3.2 Derived

含义：

- 基于 `Observed` 输入经规则计算得到
- 不是原始事实，但有明确计算来源

示例：

- `minimal-context.review.risk_focus`
- `freshness.status`
- `lint_report.missing_assets`

### 3.3 Sample

含义：

- 当前代码中由 sample generator 固定生成
- 用于维持 contract、样本、测试一致性
- 不是仓库当前状态的真实编译结果

示例：

- `buildArtifactManifestSample()`
- `buildContextRoutingSample()`
- `buildInjectionIndexSample()`

### 3.4 Placeholder

含义：

- 已有正式产物路径和文件 contract
- 但内容仍为占位文本，未由真实 facts 编译

示例：

- `# summary`
- `# module map`
- `# public entrypoints`

---

## 4. 当前 skill 的真实执行链

## 4.1 上层 bootstrap 编排链

当前主链入口在：

- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/orchestrator.js`

真实执行顺序如下：

```text
runBootstrap(repoRoot, factInventory, riskSignals, testSurface, ...)
  -> resolve slug
  -> resolve controlPlaneDir + contextDir
  -> backup docs/contexts/<slug>/
  -> compileBootstrapArtifacts()
       -> compileMachineArtifacts()
       -> compileHumanAssets()
       -> compileRouting()
  -> 写 control plane JSON
  -> 写 docs/contexts/<slug>/*
  -> 成功则删除 backup
  -> 失败则恢复 backup
```

这条链的特征是：

1. 已经有稳定的写盘、回滚和 deterministic contract
2. 产物路径已经明确区分 control plane 与 docs plane
3. 当前“分析”更多体现在输入数据消费，而不是 bootstrap 内部主动跑 AST

## 4.2 下层 CRG 分析链

真实 AST / graph 分析链在：

- `src/crg/cli/build.js`
- `src/crg/parser.js`
- `src/crg/graph.js`
- `src/crg/migrations.js`
- `src/crg/retrieval/*`

真实流程如下：

```text
spec-first crg build --repo=<target>
  -> 收集输入文件
  -> 增量检测 changed/deleted
  -> parseFile(file)
       -> inferLanguage
       -> tree-sitter parse
       -> extract nodes/rawEdges
  -> upsert nodes/chunks
  -> resolve rawEdges -> edges
  -> 写 graph_meta / fingerprints / unresolved_edges
  -> postprocess
```

这条链已经是实打实的代码分析实现，不是样本。

---

## 5. AST 到 graph.db 的真实来源链

## 5.1 解析器是否真实存在

结论：存在，而且已经较完整。

证据：

- `src/crg/parser.js` 使用 `tree-sitter`
- `src/crg/lang-config.js` 维护多语言 grammar 配置
- `src/crg/cli/build.js` 实际调用 `parseFile()`

当前关键特征：

1. 每个文件先建立一个 `module` 节点
2. `tree-sitter` 可用时继续提取 symbol 与 rawEdges
3. `tree-sitter` 缺失时 graceful degradation，只保留 module 节点
4. 解析失败时不会阻塞整个 build，但会留下质量信号

## 5.2 当前支持的语言范围

当前实现已支持：

1. JavaScript
2. TypeScript
3. TSX
4. Python
5. Go
6. Java
7. Rust
8. C / C++
9. Objective-C
10. Swift
11. Kotlin
12. Ruby
13. PHP
14. C#
15. Scala

这说明下层 CRG 已经不是“只支持 JS 的 demo parser”。

## 5.3 当前提取出的图事实类型

从当前实现看，至少已真实支持：

1. `module`
2. `function`
3. `class`
4. `method`
5. `interface`
6. `struct`
7. `imports_from`
8. `contains`
9. `defined_in`
10. `calls`

这批事实写入 `nodes` 和 `edges`，并进一步供：

1. graph analysis
2. retrieval
3. review-context
4. impact analysis
5. context command

使用。

## 5.4 graph.db 里的真实数据平面

数据库 schema 在 `src/crg/migrations.js`，核心表有：

1. `nodes`
2. `edges`
3. `flows`
4. `flow_nodes`
5. `communities`
6. `graph_meta`
7. `fingerprints`
8. `unresolved_edges`
9. `chunks`
10. `fts_nodes`

这套 schema 说明当前底层不是“只解析一下 AST”，而是已经形成：

```text
AST symbol graph
  + incremental fingerprints
  + unresolved edge audit
  + chunks for retrieval
  + FTS search
  + communities / flows
```

---

## 6. 当前 skill 产物来源矩阵

## 6.1 总览矩阵

| 产物 | 当前写入位置 | 真实来源 | 来源分类 | 当前状态判断 |
|---|---|---|---|---|
| `context-routing.json` | control plane | `compileRouting()` -> `buildContextRoutingSample()` | Sample | contract 已建立，非真实仓库感知 |
| `artifact-manifest.json` | control plane | `compileRouting()` -> `buildArtifactManifestSample()` | Sample | contract 已建立，非真实 analyzer 链 |
| `freshness.json` | control plane | `buildFreshnessReport()` + manifest inputs | Derived + Sample 输入 | 计算逻辑真实，输入快照仍偏 sample |
| `lint-report.json` | control plane | `buildLintReport()` | Derived | 逻辑真实，但依赖 manifest/sample 完整度 |
| `contradictions.json` | control plane | `buildContradictionsReport()` | Derived | 逻辑真实，但默认输入经常为空 |
| `ownership.json` | control plane | `buildOwnershipRegistrySample()` | Sample | 治理 contract 已占位 |
| `review-queue.json` | control plane | `buildReviewQueueSample()` | Sample | 治理 contract 已占位 |
| `minimal-context/review.json` | control plane | `riskSignals + testSurface` | Derived | 当前最真实的 facts 消费产物之一 |
| `minimal-context/plan.json` | control plane | `factInventory` | Derived | 当前最真实的 facts 消费产物之一 |
| `minimal-context/work.json` | control plane | `factInventory + riskSignals + testSurface` | Derived | 当前最真实的 facts 消费产物之一 |
| `00-summary.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `README.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `architecture/module-map.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `code-facts/public-entrypoints.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `code-facts/test-map.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `code-facts/high-risk-modules.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `pitfalls/index.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `context-packs/review-change.md` | context docs | `DEFAULT_CONTEXT_DOCS` 或 `contextDocs` | Placeholder / 外部注入 | 默认仍是占位文本 |
| `injection-index.yaml` | context docs | `serializeInjectionIndex(buildInjectionIndexSample())` | Sample | 已可被 evaluator 使用，但非实时编译 |

---

## 6.2 control plane 逐项说明

### A. `context-routing.json`

当前来源：

- `compileRouting()` 直接调用 `buildContextRoutingSample()`

判断：

- 当前是 `Sample`
- 不是从 `factInventory / riskSignals / testSurface / actual asset existence` 实时推导

意义：

- 已建立 stage-aware routing contract
- 已能被 evaluator 消费
- 但当前不是“根据仓库真实状态编译出来的路由”

### B. `artifact-manifest.json`

当前来源：

- `compileRouting()` 直接调用 `buildArtifactManifestSample()`

判断：

- 当前是 `Sample`
- 虽然 schema、depends_on、outputs 已经比较完整，但仍主要是样本化 contract

意义：

- 已经把“输出依赖图”设计出来
- 但当前不是由真实 analyzer 运行记录自动生成

### C. `freshness.json`

当前来源：

- `buildFreshnessReport()`
- 输入包括 `generatedAt / graphLastBuilt / outputUpdatedAt / manifest.inputs`

判断：

- `status` 计算逻辑是真实 `Derived`
- 但当前 `manifest.inputs` 默认经常来自 sample manifest

因此它的真实性是：

```text
计算逻辑真实
输入快照不完全真实
=> 半真实
```

### D. `lint-report.json`

当前来源：

- `buildLintReport()`

真实逻辑：

1. 读取 manifest 里的 expected outputs
2. 对比 actual assets
3. 计算 missing assets
4. 计算 orphan pages

判断：

- 属于 `Derived`
- 但上游 manifest 如果仍是 sample，就会限制它的真实性边界

### E. `contradictions.json`

当前来源：

- `buildContradictionsReport()`

真实逻辑：

1. 从传入 assets 里抽 scalar facts
2. 同 key 多 value 时记为 contradiction

判断：

- 算法真实
- 但当前通常依赖调用方是否真的传入内容
- 默认主链中并没有形成强力的事实抽取输入面

### F. `ownership.json` 与 `review-queue.json`

当前来源：

- `buildOwnershipRegistrySample()`
- `buildReviewQueueSample()`

判断：

- 当前纯 `Sample`
- 这两项更像 control plane 治理占位，而不是当前已实现的代码分析结果

---

## 6.3 minimal-context 逐项说明

这是当前上层 bootstrap 实现里最“像真实编译”的部分。

### A. `minimal-context/review.json`

当前来源：

- `riskSignals.signals`
- `testSurface.test_files`

主要 derived 字段：

1. `risk_focus`
2. `candidate_tests`
3. `priority_assets`
4. `selected_assets`

判断：

- 如果 `riskSignals` 和 `testSurface` 真实，那么它就是 `Derived`
- 当前问题不在这个编译器本身，而在上游 facts 未完全自动产出

### B. `minimal-context/plan.json`

当前来源：

- `factInventory.entrypoints`
- `factInventory.modules`
- `factInventory.integrations`

主要 derived 字段：

1. `entrypoint_focus`
2. `module_focus`
3. `integration_focus`

判断：

- 当前是最接近“代码事实 -> AI 上下文卡片”的真实产物之一

### C. `minimal-context/work.json`

当前来源：

- `factInventory.testing_surface`
- `factInventory.modules`
- `riskSignals.signals`
- `testSurface.test_files`

主要 derived 字段：

1. `impacted_modules`
2. `candidate_tests`

判断：

- 当前同样属于真实的 `Derived`
- 但真实性上限仍取决于三份输入 facts 的真实性

---

## 6.4 human docs 逐项说明

当前 docs 写盘逻辑很明确，但内容编译还没有完成闭环。

当前默认内容源于：

- `DEFAULT_CONTEXT_DOCS`
- 或外部传入 `contextDocs`

默认内容示例就是：

1. `# summary`
2. `# module map`
3. `# public entrypoints`
4. `# test map`
5. `# high risk modules`

因此当前这些 docs 的真实性判断必须非常严格：

| 文档 | 当前来源判断 | 结论 |
|---|---|---|
| `00-summary.md` | placeholder | 还不是事实编译结果 |
| `architecture/module-map.md` | placeholder | 还不是 module analyzer 输出 |
| `code-facts/public-entrypoints.md` | placeholder | 还不是 entrypoint analyzer 输出 |
| `code-facts/test-map.md` | placeholder | 还不是 test surface renderer 输出 |
| `code-facts/high-risk-modules.md` | placeholder | 还不是 risk signals renderer 输出 |
| `pitfalls/index.md` | placeholder | 还不是 contradiction / risk narrative renderer 输出 |
| `context-packs/review-change.md` | placeholder | 还不是 review-context narrative renderer 输出 |

这意味着：

> 当前文档面已经有“文件 contract”，但还没有“高质量内容编译器”。

---

## 7. tests 与 contract 暴露出的真实现状

当前 tests 已经明确把一些终局产物当作正式 contract。

特别是：

- `.spec-first/workflows/bootstrap/spec-first/risk-signals.json`
- `.spec-first/workflows/bootstrap/spec-first/test-surface.json`
- `.spec-first/workflows/bootstrap/spec-first/fact-inventory.json`

都在 `tests/unit/spec-graph-bootstrap-contracts.test.js` 中被读取并参与断言。

这说明当前仓库的真实状态是：

1. contract 层已经假定三份事实文件存在
2. minimal-context compiler 已经在消费这三份文件
3. 但 `runBootstrap()` 当前主链并没有自动把这三份文件写出来

因此这里存在一个非常明确的断层：

```text
contract/tests
  已经假定 fact-inventory / risk-signals / test-surface 是正式输入输出

当前 compiler mainline
  仍把它们当作调用参数
  没有完整自动生成落盘
```

这不是小问题，而是当前 skill 实现状态判断的核心。

---

## 8. context-routing 消费侧的真实状态

消费侧代码在：

- `src/context-routing/loader.js`
- `src/context-routing/evaluator.js`
- `src/context-routing/fallback.js`

当前能力是成立的。

真实消费链如下：

```text
loadBootstrapRuntimeState()
  -> 读 context-routing.json / artifact-manifest.json / freshness.json
  -> findExistingAsset()
  -> evaluateContext(stage)
  -> 根据 routing + selection_rules + minimal-context 是否存在
     计算 L0 / L1 / L2 / L3 fallback
```

这里说明两件事：

1. routing/evaluator 这条消费主链已经可用
2. 它依赖的前提是 bootstrap 至少输出了可被消费的 control plane contract

因此当前系统的“消费面成熟度”高于“事实抽取面成熟度”。

---

## 9. 当前链路的完整 ASCII 图

## 9.1 当前真实执行链

```text
源码仓库
  |
  | 1. spec-first crg build
  v
+-------------------------------+
| src/crg/parser.js             |
| tree-sitter AST 提取          |
| module/function/class/calls   |
+-------------------------------+
  |
  | 2. upsert nodes/edges/chunks
  v
+-------------------------------+
| .spec-first/graph/graph.db    |
| nodes / edges / flows /       |
| communities / chunks / fts    |
+-------------------------------+
  |
  | 3. CRG CLI 查询/检索
  v
+-------------------------------+
| crg context / review-context  |
| impact / search / retrieval   |
+-------------------------------+
  |
  | 4. 当前 bootstrap 并未完整自动接入
  |    而是依赖外部传入:
  |    factInventory / riskSignals / testSurface
  v
+--------------------------------------+
| src/bootstrap-compiler/orchestrator   |
| machine -> human -> routing           |
+--------------------------------------+
  |
  +--------------------+----------------------+
  |                    |                      |
  v                    v                      v
+----------------+  +----------------+  +------------------+
| minimal-context|  | routing/manifest| | context docs      |
| 派生较真实     |  | sample 偏重     | | placeholder 偏重  |
+----------------+  +----------------+  +------------------+
  |
  | 5. context-routing 消费
  v
+--------------------------------------+
| evaluateContext(plan/work/review)     |
| 选择 selected_assets + fallback level |
+--------------------------------------+
```

## 9.2 当前 skill 的本质

```text
当前 skill = “产物编排器 + 路由控制面 + 文档落盘骨架”
不是      = “完整自动 AST 事实工厂”
```

---

## 10. 当前到终局的缺口闭环图

## 10.1 正确终局链路

```text
源码
  -> CRG AST / graph build
  -> analyzer 层自动产出:
       fact-inventory.json
       risk-signals.json
       test-surface.json
  -> bootstrap compiler 消费三份 machine facts
  -> 生成:
       minimal-context/*.json
       freshness/lint/contradictions
       context-routing.json
       artifact-manifest.json
       高质量 human docs (*.md)
  -> evaluator 消费
  -> plan/work/review 获得最小上下文
```

## 10.2 当前主要缺口

### Gap-1：三份 machine facts 未在主链中自动落盘

当前现状：

- tests 与 skill 已把它们当前置 contract
- compiler mainline 未自动生成

正确补法：

- 新增事实提取编排层
- 明确 `fact-inventory / risk-signals / test-surface` 的 analyzer 入口
- 写入 control plane，成为 manifest 正式 outputs

### Gap-2：routing / manifest 仍主要由 sample generator 驱动

当前现状：

- contract 结构是对的
- 但并非“真实分析结果”

正确补法：

- `artifact-manifest` 改为真实编译记录
- `context-routing` 改为根据已产出 assets 和 analyzer 结果实时编译

### Gap-3：human docs 仍是 placeholder

当前现状：

- 路径和回滚 contract 已成立
- 内容没有真正从 facts 渲染

正确补法：

- 为每类 docs 新增 renderer：
  - summary renderer
  - module-map renderer
  - public-entrypoints renderer
  - test-map renderer
  - high-risk-modules renderer
  - pitfalls renderer
  - review-change renderer

### Gap-4：CRG 与 bootstrap 之间缺少正式 analyzer bridge

当前现状：

- 下层图很强
- 上层 compiler 能消费 facts
- 中间 bridge 缺失

正确补法：

- 新增 analyzer pipeline：
  - graph -> fact inventory analyzer
  - graph + review-context -> risk signals analyzer
  - graph + test nodes -> test surface analyzer

### Gap-5：当前 control plane 与 docs plane 的“真实性层级”不一致

当前现状：

- minimal-context 较真实
- routing/manifest 偏 sample
- docs 偏 placeholder

正确补法：

- 统一为 machine-first 真源
- 让 manifest 记录真实 analyzer versions、inputs、outputs、timestamps

---

## 11. 终局实现的最小闭环建议

如果只抓最关键闭环，正确顺序应该是：

### Step 1：先让三份 machine facts 自动落盘

目标：

- `fact-inventory.json`
- `risk-signals.json`
- `test-surface.json`

真正由 CRG + analyzer 自动生成。

### Step 2：让 manifest 和 routing 脱离 sample

目标：

- `artifact-manifest.json` 记录真实输入输出
- `context-routing.json` 反映真实可用资产

### Step 3：让 minimal-context 继续作为 machine facts 的第一消费层

目标：

- 保持当前最成熟的 Derived 能力
- 把它从“半真实”提升为“完全真实”

### Step 4：补 human docs renderer

目标：

- 把 placeholder 文件替换为真正 narrative 产物

### Step 5：最后再强化治理面

目标：

- `ownership.json`
- `review-queue.json`
- contradictions narrative

---

## 12. 最终判断

从“当前 skill 产物的来源真实性”角度，必须做出非常明确的判断：

1. 当前 `CRG` AST / graph 能力是真实现，不是 demo
2. 当前 `bootstrap-compiler` 编排与写盘主链也是真实现
3. 当前 `context-routing` 消费链也是真实现
4. 但当前 `spec-graph-bootstrap` 还不是完整的“AST-grade facts 自动编译系统”

更准确地说：

```text
当前已实现：
  AST/graph 引擎
  bootstrap 编排骨架
  context-routing 消费骨架

当前未完全实现：
  AST/graph -> fact-inventory/risk-signals/test-surface 自动闭环
  facts -> human docs 自动高质量渲染
  routing/manifest 从 sample 升级为真实编译记录
```

因此，若从产物真实性分层给当前 skill 定位，最合理的表述是：

> 当前 `spec-graph-bootstrap` 已经完成了“graph-informed bootstrap 框架层”和“runtime/control-plane contract 层”，但尚未完成“事实自动提取闭环层”和“文档高质量渲染层”。

这也是后续优化时最应该优先补上的主链。
