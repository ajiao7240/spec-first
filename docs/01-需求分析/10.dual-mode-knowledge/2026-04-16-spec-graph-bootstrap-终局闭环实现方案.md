# spec-graph-bootstrap 终局闭环实现方案

> 文档性质：技术方案 / 实施设计
> 撰写日期：2026-04-16
> 适用范围：
> - `src/crg/*`
> - `src/bootstrap-compiler/*`
> - `src/context-routing/*`
> - `skills/spec-graph-bootstrap/SKILL.md`
> - `docs/contracts/spec-graph-bootstrap/*`
> 前置文档：
> - [2026-04-16-spec-graph-bootstrap-当前skill产物来源矩阵与AST链路分析.md](./2026-04-16-spec-graph-bootstrap-当前skill产物来源矩阵与AST链路分析.md)
> - [2026-04-16-spec-graph-bootstrap-双模式知识承载-gap-分析.md](./2026-04-16-spec-graph-bootstrap-双模式知识承载-gap-分析.md)
> - [2026-04-16-spec-first-双模式知识承载-phase1-2-3-实施文档.md](./2026-04-16-spec-first-双模式知识承载-phase1-2-3-实施文档.md)

---

## 1. 方案目标

本文档要解决的不是“当前 skill 哪些地方还不够好”，而是更进一步回答：

> 以当前 `CRG AST / graph` 为底座，`spec-graph-bootstrap` 的正确终局闭环应该怎样设计，才能把源码事实稳定转成 machine artifacts、human docs 和可消费的 context routing。

这里的“终局闭环”指的是：

```text
源码
  -> CRG AST / graph build
  -> analyzer 层自动提取 machine facts
  -> bootstrap compiler 编排 machine artifacts
  -> renderer 层编译 human docs
  -> routing / manifest 反映真实产物状态
  -> plan / work / review 通过 evaluator 消费
```

本文档强调五件事：

1. 正确的终局架构是什么
2. 当前实现与终局之间的主链缺口是什么
3. 每个新增模块的职责边界是什么
4. 正确的开发顺序是什么
5. 如何避免过度设计与重复抽象

---

## 2. 终局判断

当前 `spec-graph-bootstrap` 的正确方向，不是继续堆 sample，也不是让 skill 文本承担逻辑，而是把系统正式收敛为三层：

### Layer 1：代码事实层

由 `src/crg` 提供真实的 AST / graph / retrieval 基础能力。

### Layer 2：facts analyzer 层

负责把 `graph.db`、repo 文件、diff、配置等真实输入，编译成三份 machine facts：

1. `fact-inventory.json`
2. `risk-signals.json`
3. `test-surface.json`

### Layer 3：bootstrap compiler 层

负责消费三份 machine facts，输出：

1. `minimal-context/*.json`
2. `freshness.json`
3. `lint-report.json`
4. `contradictions.json`
5. `artifact-manifest.json`
6. `context-routing.json`
7. `docs/contexts/<slug>/*`

一句话总结：

> 正确终局不是“bootstrap 自己再去做 AST”，而是“CRG 负责事实底座，bootstrap 负责把事实编译成可消费产物”。

---

## 3. 设计原则

## 3.1 保持单一职责，不让 bootstrap 重新实现 CRG

不应该做：

1. 在 `bootstrap-compiler` 内重新解析源码
2. 再造一套与 `graph.db` 平行的 AST 事实层
3. 让 skill 文本内嵌太多 analyzer 逻辑

应该做：

1. 让 CRG 继续承担 AST / graph / retrieval 真源
2. 让 bootstrap 的 analyzer 层只做“从图和仓库状态提炼 machine facts”
3. 让 renderer 层只做“从 machine facts 生成 narrative docs”

## 3.2 machine facts 必须成为正式真源

`fact-inventory.json`、`risk-signals.json`、`test-surface.json` 必须从“测试样本/契约前置”升级为“正式运行时真源”。

只有这样：

1. `minimal-context` 才真正可信
2. `routing / manifest` 才能脱离 sample
3. human docs 才有稳定输入

## 3.3 control plane 必须 machine-first

control plane 中的：

1. `artifact-manifest.json`
2. `context-routing.json`
3. `freshness.json`
4. `lint-report.json`
5. `contradictions.json`

都必须由真实运行结果驱动，而不是主要由 sample generator 驱动。

## 3.4 human docs 必须 renderer 化

不应该继续靠：

1. `DEFAULT_CONTEXT_DOCS`
2. 手工传 `contextDocs`
3. 静态 placeholder 文件

而应该为每个 docs family 建立正式 renderer。

## 3.5 先闭 machine facts，再闭 docs 渲染

正确顺序必须是：

```text
graph / repo state
  -> machine facts
  -> minimal-context
  -> routing / manifest
  -> human docs
```

不能反过来先写 markdown renderer，否则输入面不稳，后面一定返工。

---

## 4. 终局架构总览

```text
源码仓库
  |
  | 1. CRG build
  v
+-----------------------------------+
| src/crg                           |
| AST / graph / retrieval / impact  |
+------------------+----------------+
                   |
                   | 2. bootstrap analyzers
                   v
+-----------------------------------+
| src/bootstrap-analyzers/*         |
| fact inventory / risk / tests     |
+------------------+----------------+
                   |
                   | 3. machine facts 真源
                   v
+-----------------------------------+
| .spec-first/workflows/bootstrap/  |
| fact-inventory.json               |
| risk-signals.json                 |
| test-surface.json                 |
+------------------+----------------+
                   |
         +---------+---------+
         |                   |
         v                   v
+-------------------+   +----------------------+
| machine compiler  |   | docs renderers       |
| minimal/freshness |   | summary/module-map   |
| lint/contradiction|   | entrypoints/test-map |
+---------+---------+   | risk/pitfalls/review |
          |             +----------+-----------+
          |                        |
          +------------+-----------+
                       |
                       v
+-----------------------------------+
| control plane + durable docs      |
| manifest / routing / docs assets  |
+------------------+----------------+
                   |
                   | 4. evaluator
                   v
+-----------------------------------+
| plan / work / review consumers    |
+-----------------------------------+
```

---

## 5. 正确的数据平面设计

## 5.1 输入平面

终局输入必须只来自三类真源：

### A. graph truth

来源：

1. `graph.db`
2. `graph_meta`
3. `communities`
4. `flows`
5. `nodes`
6. `edges`
7. `chunks`

### B. repo truth

来源：

1. `package.json` / `go.mod` / `pom.xml` / `Gemfile` 等配置文件
2. 文件系统目录结构
3. 测试文件实际存在情况
4. 关键文档 / contract 文件

### C. runtime truth

来源：

1. 当前生成时间
2. graph last built
3. 已产出的 assets
4. rerun backup 状态
5. schema 校验结果

## 5.2 machine facts 平面

终局必须固定为三份文件：

### `fact-inventory.json`

回答：

1. 项目是谁
2. 模块边界是什么
3. 入口点是什么
4. 集成点是什么
5. 数据形态是什么
6. 测试覆盖面是什么

### `risk-signals.json`

回答：

1. 高风险模块在哪里
2. 风险严重度是什么
3. 风险来自什么证据
4. 哪些是 observed，哪些是 inferred

### `test-surface.json`

回答：

1. 有哪些测试文件
2. 测试文件覆盖哪些模块/目标
3. 哪些关键路径缺乏测试
4. candidate tests 如何挑选

## 5.3 control plane 平面

control plane 必须至少包含：

1. `artifact-manifest.json`
2. `context-routing.json`
3. `freshness.json`
4. `lint-report.json`
5. `contradictions.json`
6. `minimal-context/review.json`
7. `minimal-context/plan.json`
8. `minimal-context/work.json`

## 5.4 docs 平面

最终 `docs/contexts/<slug>/` 下的人类文档应来自 renderer，而不是默认占位。

---

## 6. 新增 analyzer 层设计

当前最重要的新增不是 renderer，而是 analyzer bridge。

建议新增目录：

```text
src/bootstrap-analyzers/
```

至少包含以下模块。

## 6.1 `fact-inventory-analyzer.js`

职责：

1. 从 graph、repo config、目录结构中构建 `fact-inventory.json`

输入：

1. `graph.db`
2. 主配置文件
3. repo root

输出应至少包含：

1. `project_identity`
2. `entrypoints`
3. `modules`
4. `integrations`
5. `layers`
6. `data_shapes`
7. `testing_surface`

来源建议：

- `entrypoints`：来自 graph symbols + framework conventions + public entry queries
- `modules`：来自 communities、目录聚类、module nodes
- `integrations`：来自 imports/calls/config + known dependency heuristics
- `layers`：来自 repo config、framework detection、目录模式
- `data_shapes`：来自 class/interface/schema/dto/entity 搜索与文件读取
- `testing_surface`：来自 is_test nodes + test files + naming conventions

## 6.2 `risk-signals-analyzer.js`

职责：

1. 从 graph analysis、review-context、diff/risk heuristics 中构建 `risk-signals.json`

输入：

1. `graph.db`
2. communities / flows / hubs
3. unresolved edge 情况
4. parser quality
5. 可选 `review-context` 扩展信息

输出应至少包含：

1. `signals`
2. `top_hubs`
3. `top_flows`
4. `top_communities`
5. 风险证据

来源建议：

- `top_hubs`：来自 `crg context`
- `top_flows`：来自 `crg context`
- `signals`：来自 hubs、surprising connections、large functions、god nodes、unresolved edge rate、module_only/no_parser/parse_error 等

## 6.3 `test-surface-analyzer.js`

职责：

1. 从 graph test nodes、测试文件存在性、命名约定和覆盖映射构建 `test-surface.json`

输入：

1. `nodes.is_test`
2. 文件系统测试文件
3. 入口点 / 模块 / changed paths

输出应至少包含：

1. `test_files`
2. `coverage_hints`
3. `candidate_tests`
4. `gaps`

## 6.4 `analyzer-orchestrator.js`

职责：

1. 统一编排三份 analyzer
2. 处理 mode / readiness / stale / degraded
3. 写入三份 machine facts

这是当前最缺的中间层。

---

## 7. bootstrap compiler 重构方案

## 7.1 当前问题

当前 `compileBootstrapArtifacts()` 的真实结构是：

1. machine
2. human
3. routing

但 machine 阶段并不包含 machine facts analyzer，只是在消费传入 facts。

## 7.2 正确重构方向

建议拆为五段：

```text
1. analyze-facts
2. compile-machine-artifacts
3. render-human-docs
4. compile-routing
5. write-assets
```

### 新的编排职责

#### Stage A：analyze-facts

输出：

1. `fact-inventory.json`
2. `risk-signals.json`
3. `test-surface.json`

#### Stage B：compile-machine-artifacts

输出：

1. `minimal-context/*.json`
2. `freshness.json`
3. `lint-report.json`
4. `contradictions.json`

#### Stage C：render-human-docs

输出：

1. `00-summary.md`
2. `architecture/module-map.md`
3. `code-facts/public-entrypoints.md`
4. `code-facts/test-map.md`
5. `code-facts/high-risk-modules.md`
6. `pitfalls/index.md`
7. `context-packs/review-change.md`
8. `README.md`

#### Stage D：compile-routing

输出：

1. `artifact-manifest.json`
2. `context-routing.json`
3. `injection-index.yaml`

#### Stage E：write-assets

职责：

1. 写 control plane
2. 写 docs plane
3. backup / rollback

---

## 8. human docs renderer 设计

建议新增目录：

```text
src/bootstrap-renderers/
```

每份文档一个 renderer。

## 8.1 `summary-renderer.js`

输入：

1. `fact-inventory`
2. `risk-signals`
3. `test-surface`

输出：

- 项目概览
- 核心模块
- 主要入口
- 主要风险
- 测试现状

## 8.2 `module-map-renderer.js`

输入：

1. `fact-inventory.modules`
2. `fact-inventory.layers`
3. `fact-inventory.integrations`

输出：

- 模块分层
- 主要目录/模块映射
- 边界与依赖

## 8.3 `public-entrypoints-renderer.js`

输入：

1. `fact-inventory.entrypoints`

输出：

- 入口点列表
- 每个入口的职责、路径、主要下游

## 8.4 `test-map-renderer.js`

输入：

1. `test-surface`
2. `fact-inventory.testing_surface`

输出：

- 测试文件
- 候选测试
- 测试薄弱区

## 8.5 `high-risk-modules-renderer.js`

输入：

1. `risk-signals.signals`
2. `risk-signals.top_hubs`

输出：

- 高风险模块排序
- 风险等级
- 风险证据

## 8.6 `pitfalls-renderer.js`

输入：

1. `contradictions`
2. `risk-signals`
3. parser quality / unresolved summary

输出：

- 常见误区
- 易错区域
- 上下文冲突

## 8.7 `review-change-renderer.js`

输入：

1. `risk-signals`
2. `test-surface`
3. 可选 review-context 结果

输出：

- 变更评审建议
- 风险优先级
- 建议关注测试

---

## 9. control plane 脱离 sample 的设计

## 9.1 `artifact-manifest.json`

当前问题：

- 主要由 sample generator 构造

终局要求：

1. `inputs` 反映真实 graph metadata、关键文件 SHA、analyzer versions
2. `outputs` 反映本次真实生成资产
3. `status` 反映真实阶段状态
4. `updated_at` 来自真实运行时间

## 9.2 `context-routing.json`

当前问题：

- 当前 stage assets 和 selection_rules 主要是固定样本

终局要求：

1. 固定骨架可保留
2. 但需根据真实 output existence、renderer 成功情况、facts completeness 调整
3. 不允许 manifest 说有，实际没有

## 9.3 `injection-index.yaml`

当前问题：

- 仍偏 sample human view

终局要求：

1. 作为 human-readable routing mirror 保留
2. 但内容必须来自真实 routing

---

## 10. 与双模式 durable knowledge 的集成要求

这部分必须与前面双模式知识承载方案一致。

## 10.1 control plane 继续 repo-local

以下内容保持 repo-local：

```text
.spec-first/workflows/bootstrap/<slug>/
```

包括：

1. 三份 machine facts
2. machine artifacts
3. routing / manifest

原因：

1. 它们是运行控制面
2. 与本地 graph state 和构建时间强耦合

## 10.2 human docs 走 knowledge backend

以下内容应走 knowledge backend resolver：

```text
docs/contexts/<slug>/*
```

因此：

1. renderer 输出的是“docs assets”
2. writer 决定最终写到 `in_repo` 还是 `external_knowledge`

## 10.3 这意味着什么

正确的终局不是把所有产物一锅端迁出去，而是：

```text
machine-first control plane   -> repo-local
human-readable durable docs   -> knowledge backend
```

---

## 11. 正确开发顺序

## 11.1 P0：补 analyzer bridge

必须先做：

1. `src/bootstrap-analyzers/`
2. 三份 machine facts 自动落盘
3. tests 改成以自动生成 facts 为真源

不先做这一步，后面的 renderer 全都会建立在不稳定输入上。

## 11.2 P1：强化 machine artifacts

随后做：

1. `minimal-context/*.json`
2. `freshness.json`
3. `lint-report.json`
4. `contradictions.json`

目标：

- 让 machine artifacts 完全基于真实 facts

## 11.3 P2：让 routing / manifest 脱离 sample

随后做：

1. `artifact-manifest.json`
2. `context-routing.json`
3. `injection-index.yaml`

目标：

- 让 evaluator 消费的 control plane 也变成真实编译结果

## 11.4 P3：补 human docs renderer

随后做：

1. summary
2. module-map
3. public-entrypoints
4. test-map
5. high-risk-modules
6. pitfalls
7. review-change

## 11.5 P4：接入双模式 durable knowledge

最后做：

1. docs writer 切 backend resolver
2. external mode backup / rollback
3. context-routing durable docs 读取切 backend

---

## 12. 测试策略

## 12.1 analyzer tests

需要新增：

1. `fact-inventory-analyzer.test.js`
2. `risk-signals-analyzer.test.js`
3. `test-surface-analyzer.test.js`

验证重点：

1. 图输入到 machine facts 的字段正确性
2. observed / inferred 字段标注正确
3. degraded/no_parser/module_only 情况下仍可输出

## 12.2 compiler integration tests

需要改造：

1. `spec-graph-bootstrap-compiler.test.js`

验证重点：

1. 自动 analyzer -> machine artifacts -> routing 主链
2. 不再依赖手工传 facts 才能跑通

## 12.3 contract tests

需要改造：

1. `spec-graph-bootstrap-contracts.test.js`

验证重点：

1. 三份 machine facts 是真实 outputs
2. manifest / routing 与真实产物一致
3. injection index 与 routing 一致

## 12.4 renderer tests

需要新增：

1. 每个 renderer 的 snapshot / golden tests

验证重点：

1. 文档不再是 placeholder
2. 文档内容与 facts 一致

## 12.5 dual-mode tests

需要新增：

1. `in_repo` docs 写入测试
2. `external_knowledge` docs 写入测试
3. repo-local control plane 与 external docs 分离测试

---

## 13. 验收标准

终局级闭环至少要满足以下全部条件：

1. `spec-graph-bootstrap` 无需外部手工注入即可自动生成三份 machine facts
2. 三份 machine facts 来源可追溯到 CRG graph 或 repo state
3. `minimal-context/*.json` 全部由真实 facts 生成
4. `artifact-manifest.json` 与 `context-routing.json` 不再主要依赖 sample generator
5. `docs/contexts/<slug>/*` 不再是 placeholder，而是由 renderer 生成
6. evaluator 读取到的 assets 与实际输出一致
7. `in_repo` 与 `external_knowledge` 双模式下都能成立
8. rerun backup / rollback 在 docs plane 下仍然可靠

---

## 14. 风险与控制

## 14.1 风险：analyzer 过度复杂，重造 CRG

控制：

1. analyzer 只消费 graph，不重新 parse 源码
2. 能复用 `crg context / review-context / impact / search` 的地方尽量复用

## 14.2 风险：renderer 先行，输入不稳定

控制：

1. 先 analyzer，再 renderer
2. 不允许继续扩大 placeholder 面积

## 14.3 风险：manifest / routing 与真实输出漂移

控制：

1. manifest 来自真实 output registry
2. routing 基于真实 output existence 编译
3. contract tests 强约束

## 14.4 风险：双模式接入过早引入复杂度

控制：

1. 先在 repo-local 下把 analyzer/renderers 闭环做实
2. 最后切 knowledge backend

---

## 15. 最终结论

当前 `spec-graph-bootstrap` 的正确终局闭环，不是继续扩充 skill 文本，也不是继续维护 sample-first 产物，而是把体系明确收敛为：

1. `CRG` 负责 AST / graph / retrieval 真源
2. `bootstrap-analyzers` 负责 machine facts 编译
3. `bootstrap-compiler` 负责 machine artifacts 编排
4. `bootstrap-renderers` 负责 human docs 生成
5. `context-routing` 负责按 stage 消费真实产物

最终正确链路应当是：

```text
CRG graph truth
  -> fact-inventory / risk-signals / test-surface
  -> minimal-context / freshness / lint / contradictions
  -> manifest / routing
  -> summary / module-map / entrypoints / test-map / risk / pitfalls / review-change
  -> plan / work / review
```

这条链路一旦成立，`spec-graph-bootstrap` 才真正从“bootstrap 框架骨架”升级为“代码事实驱动的上下文基础设施”。
