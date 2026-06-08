# spec-graph-bootstrap 终局闭环全量开发任务清单

> 文档性质：开发执行清单
> 撰写日期：2026-04-16
> 适用范围：
> - `src/crg/*`
> - `src/bootstrap-compiler/*`
> - `src/context-routing/*`
> - `src/bootstrap-analyzers/*`（新增）
> - `src/bootstrap-renderers/*`（新增）
> - `skills/spec-graph-bootstrap/SKILL.md`
> - `docs/contracts/spec-graph-bootstrap/*`
> 前置文档：
> - [2026-04-16-spec-graph-bootstrap-当前skill产物来源矩阵与AST链路分析.md](./2026-04-16-spec-graph-bootstrap-当前skill产物来源矩阵与AST链路分析.md)
> - [2026-04-16-spec-graph-bootstrap-终局闭环实现方案.md](./2026-04-16-spec-graph-bootstrap-终局闭环实现方案.md)
> - [2026-04-16-spec-first-双模式知识承载-phase1-2-3-实施文档.md](./2026-04-16-spec-first-双模式知识承载-phase1-2-3-实施文档.md)

---

## 1. 文档目标

本文档将终局闭环方案转成可以直接进入开发的执行清单。

要求：

1. 每个阶段都有明确目标
2. 每个任务都有具体文件范围
3. 每个任务都有前置依赖
4. 每个任务都有测试要求
5. 每个阶段都有可审查的完成定义

本文档默认前提：

1. 当前仍在开发阶段
2. 不要求兼容旧单模式实现
3. 可以直接重写旧 sample-first contract、旧 tests 假设、旧路径模型

---

## 2. 总体开发顺序

正确顺序必须是：

```text
Stage A 事实真源闭环
  -> Stage B machine artifacts 真化
  -> Stage C routing / manifest 真化
  -> Stage D human docs renderer 化
  -> Stage E 双模式 durable docs 接入
  -> Stage F 治理与收尾
```

不能反过来先做：

1. 全量 markdown renderer
2. 外挂知识库接入
3. group/workspace 级知识层

否则后续会大面积返工。

---

## 3. 里程碑定义

## M1：machine facts 成为正式真源

达成后应满足：

1. `fact-inventory.json` 自动生成
2. `risk-signals.json` 自动生成
3. `test-surface.json` 自动生成
4. `minimal-context` 不再依赖手工传入 facts

## M2：control plane 脱离 sample

达成后应满足：

1. `artifact-manifest.json` 来自真实运行结果
2. `context-routing.json` 来自真实产物状态
3. `injection-index.yaml` 来自真实 routing

## M3：human docs 不再是 placeholder

达成后应满足：

1. `docs/contexts/<slug>/*` 由 renderer 生成
2. 不再依赖 `DEFAULT_CONTEXT_DOCS`

## M4：双模式 durable knowledge 成立

达成后应满足：

1. control plane 保持 repo-local
2. docs plane 支持 `in_repo` / `external_knowledge`
3. evaluator 在两种模式下都能读对

---

## 4. Stage A：事实真源闭环

## A1. 建立 analyzer 目录与统一入口

目标：

- 建立 machine facts analyzer 层

涉及文件：

1. 新增 `src/bootstrap-analyzers/index.js`
2. 新增 `src/bootstrap-analyzers/analyzer-orchestrator.js`
3. 新增 `src/bootstrap-analyzers/shared.js`

任务：

1. 定义 analyzer 输入 contract
2. 定义 analyzer 输出 contract
3. 提供统一 `analyzeBootstrapFacts({ repoRoot, slug, generatedAt, ... })`
4. 输出统一结构：
   - `factInventory`
   - `riskSignals`
   - `testSurface`
   - `analysisMeta`

前置依赖：

- 无

测试：

1. 新增 `tests/unit/bootstrap-analyzers-orchestrator.test.js`

完成定义：

1. analyzer 主入口存在
2. 可返回三份 facts 的统一 envelope

## A2. 实现 `fact-inventory-analyzer`

涉及文件：

1. 新增 `src/bootstrap-analyzers/fact-inventory-analyzer.js`
2. 可能复用 `src/crg/cli/context.js`
3. 可能复用 `src/crg/commands/search.js`
4. 可能复用 `src/crg/retrieval/*`

任务：

1. 编译 `project_identity`
2. 编译 `entrypoints`
3. 编译 `modules`
4. 编译 `integrations`
5. 编译 `layers`
6. 编译 `data_shapes`
7. 编译 `testing_surface`

实现要求：

1. 优先复用 graph.db 和 CRG 现有查询能力
2. 允许 repo config + 目录规则补充
3. 每个 fact item 明确：
   - `confidence`
   - `source_tier`
   - `evidence`
   - `inference_reason`
   - `updated_at`

测试：

1. 新增 `tests/unit/fact-inventory-analyzer.test.js`

完成定义：

1. 输入 graph/repo 状态后能稳定输出完整 `fact-inventory.json`
2. 不依赖 sample 文件

## A3. 实现 `risk-signals-analyzer`

涉及文件：

1. 新增 `src/bootstrap-analyzers/risk-signals-analyzer.js`
2. 复用 `src/crg/analyze.js`
3. 复用 `src/crg/cli/context.js`
4. 复用 `src/crg/commands/review-context.js`
5. 复用 `src/crg/commands/large-functions.js`
6. 复用 `src/crg/commands/god-nodes.js`

任务：

1. 生成 `signals`
2. 生成 `top_hubs`
3. 生成 `top_flows`
4. 生成 `top_communities`
5. 把 parser degradation / unresolved edge / graph health 也纳入风险信号

实现要求：

1. 区分 `Observed` 与 `Inferred`
2. 统一 severity 模型
3. 统一 evidence 模型

测试：

1. 新增 `tests/unit/risk-signals-analyzer.test.js`

完成定义：

1. 风险信号不再依赖手工样本
2. 图构建质量问题可进入 `risk-signals.json`

## A4. 实现 `test-surface-analyzer`

涉及文件：

1. 新增 `src/bootstrap-analyzers/test-surface-analyzer.js`
2. 可复用 `src/crg/commands/review-context.js`
3. 可复用 `src/crg/changes.js`

任务：

1. 输出 `test_files`
2. 输出 `candidate_tests`
3. 输出 `coverage_hints`
4. 输出 `gaps`

实现要求：

1. 综合 `nodes.is_test`、文件存在性、命名约定
2. 支持弱覆盖场景下降级输出

测试：

1. 新增 `tests/unit/test-surface-analyzer.test.js`

完成定义：

1. `test-surface.json` 可自动生成
2. `candidate_tests` 可被 `minimal-context/work` 直接消费

## A5. 三份 machine facts 写入 control plane

涉及文件：

1. `src/bootstrap-compiler/run-bootstrap.js`
2. `src/bootstrap-compiler/orchestrator.js`
3. 可能新增 `src/bootstrap-compiler/write-machine-facts.js`

任务：

1. 在 control plane 中写入：
   - `fact-inventory.json`
   - `risk-signals.json`
   - `test-surface.json`
2. 把它们纳入 rerun 生命周期
3. 让 manifest 后续能引用这三份输出

测试：

1. 更新 `tests/unit/spec-graph-bootstrap-compiler.test.js`

完成定义：

1. `runBootstrap()` 无需外部手工传 facts 也能自动得到三份 machine facts

---

## 5. Stage B：machine artifacts 真化

## B1. 重构 orchestrator 阶段顺序

涉及文件：

1. `src/bootstrap-compiler/orchestrator.js`

任务：

1. 将现有三段改为五段：
   - `analyze-facts`
   - `compile-machine-artifacts`
   - `render-human-docs`
   - `compile-routing`
   - `write-assets`
2. 阶段错误需结构化输出

测试：

1. 更新 `tests/unit/spec-graph-bootstrap-compiler.test.js`

完成定义：

1. orchestrator 明确包含 analyze-facts 阶段
2. 阶段失败信息可追溯

## B2. `compile-machine-artifacts` 全量改为消费真实 facts

涉及文件：

1. `src/bootstrap-compiler/compile-machine-artifacts.js`
2. `src/bootstrap-compiler/compile-minimal-context.js`
3. `src/bootstrap-compiler/freshness.js`
4. `src/bootstrap-compiler/lint.js`
5. `src/bootstrap-compiler/contradictions.js`

任务：

1. 确保 `minimal-context/*.json` 全部由 analyzer 输出驱动
2. `freshness.json` 使用真实 graph/meta/output 时间
3. `lint-report.json` 使用真实 outputs
4. `contradictions.json` 使用真实 facts/docs 内容

测试：

1. 更新对应 unit tests

完成定义：

1. machine artifacts 对 sample generator 的依赖只保留测试 fixture，不再是运行时主链

## B3. 新增 machine facts schema 校验

涉及文件：

1. 新增 `docs/contracts/spec-graph-bootstrap/fact-inventory.schema.json`
2. 新增 `docs/contracts/spec-graph-bootstrap/risk-signals.schema.json`
3. 新增 `docs/contracts/spec-graph-bootstrap/test-surface.schema.json`
4. `src/bootstrap-compiler/schema-loader.js`

任务：

1. 为三份 machine facts 建正式 schema
2. 在编译阶段校验

测试：

1. 更新 `tests/unit/spec-graph-bootstrap-contracts.test.js`

完成定义：

1. 三份 machine facts 成为正式 contract

---

## 6. Stage C：routing / manifest 真化

## C1. 替换 sample manifest 主链

涉及文件：

1. `src/bootstrap-compiler/compile-routing.js`
2. `src/bootstrap-compiler/sample-generator.js`

任务：

1. 让 `artifact-manifest.json` 来自真实 inputs/outputs/stages
2. `sample-generator.js` 仅保留 fixture 角色
3. `outputs.depends_on` 与真实 analyzer / renderer 对齐

测试：

1. 更新 `tests/unit/spec-graph-bootstrap-contracts.test.js`

完成定义：

1. 运行时 manifest 不再主要由 sample 生成

## C2. 替换 sample routing 主链

涉及文件：

1. `src/bootstrap-compiler/compile-routing.js`
2. `src/context-routing/evaluator.js`

任务：

1. 让 `context-routing.json` 根据真实 output existence 编译
2. 规则中保留固定骨架，但不允许虚报资产

测试：

1. 更新 `tests/unit/context-routing-evaluator.test.js`

完成定义：

1. evaluator 读到的路由与实际输出一致

## C3. `injection-index.yaml` 改为 routing mirror

涉及文件：

1. `src/bootstrap-compiler/compile-routing.js`
2. `src/bootstrap-compiler/sample-generator.js`

任务：

1. `injection-index.yaml` 不再独立 sample 生成
2. 从真实 routing 映射得到

测试：

1. 更新 `tests/unit/spec-graph-bootstrap-contracts.test.js`

完成定义：

1. injection index 与 routing 不会漂移

---

## 7. Stage D：human docs renderer 化

## D1. 新建 renderer 目录与入口

涉及文件：

1. 新增 `src/bootstrap-renderers/index.js`
2. 新增 `src/bootstrap-renderers/render-docs.js`
3. 新增 `src/bootstrap-renderers/shared.js`

任务：

1. 定义统一 docs render contract
2. 输出相对路径 -> 内容映射

测试：

1. 新增 `tests/unit/bootstrap-renderers.test.js`

完成定义：

1. renderer 层具备统一入口

## D2. 实现 summary / module-map / public-entrypoints renderer

涉及文件：

1. 新增 `src/bootstrap-renderers/summary-renderer.js`
2. 新增 `src/bootstrap-renderers/module-map-renderer.js`
3. 新增 `src/bootstrap-renderers/public-entrypoints-renderer.js`

任务：

1. 用 `fact-inventory` 生成真正 narrative docs

测试：

1. 新增对应 snapshot tests

完成定义：

1. 这三份 docs 不再是 placeholder

## D3. 实现 test-map / high-risk-modules renderer

涉及文件：

1. 新增 `src/bootstrap-renderers/test-map-renderer.js`
2. 新增 `src/bootstrap-renderers/high-risk-modules-renderer.js`

任务：

1. 用 `test-surface` 和 `risk-signals` 渲染事实型 docs

测试：

1. 新增对应 snapshot tests

完成定义：

1. 测试面和风险面有真实文档输出

## D4. 实现 pitfalls / review-change / README renderer

涉及文件：

1. 新增 `src/bootstrap-renderers/pitfalls-renderer.js`
2. 新增 `src/bootstrap-renderers/review-change-renderer.js`
3. 新增 `src/bootstrap-renderers/readme-renderer.js`

任务：

1. 将 contradictions / risk / stage guidance 转成人类可读文档

测试：

1. 新增对应 snapshot tests

完成定义：

1. `pitfalls/index.md` 与 `context-packs/review-change.md` 不再为空壳

## D5. 移除 `DEFAULT_CONTEXT_DOCS` 主链依赖

涉及文件：

1. `src/bootstrap-compiler/run-bootstrap.js`
2. `src/bootstrap-compiler/compile-human-assets.js`

任务：

1. 默认主链改为 renderer 输出
2. `DEFAULT_CONTEXT_DOCS` 最多保留给极端 fallback，不再是正常路径

测试：

1. 更新 `tests/unit/spec-graph-bootstrap-compiler.test.js`

完成定义：

1. 正常运行下 docs 来自 renderer

---

## 8. Stage E：双模式 durable docs 接入

## E1. durable docs resolver 接入 bootstrap writer

涉及文件：

1. `src/knowledge-backend/resolver.js`（若尚未实现则新增）
2. `src/bootstrap-compiler/run-bootstrap.js`
3. `src/crg/artifact-paths.js`

任务：

1. control plane 与 docs plane 路径正式拆开
2. docs plane 走 knowledge backend resolver

测试：

1. 新增 `tests/unit/bootstrap-knowledge-backend.test.js`

完成定义：

1. control plane repo-local
2. docs plane 可按 mode 分流

## E2. external mode backup / rollback

涉及文件：

1. `src/bootstrap-compiler/rollback.js`
2. `src/bootstrap-compiler/run-bootstrap.js`

任务：

1. external durable docs 也能在 rerun 失败时回滚

测试：

1. 新增 external mode rollback tests

完成定义：

1. docs plane 真源可恢复

## E3. context-routing 读取切 durable docs backend

涉及文件：

1. `src/context-routing/loader.js`
2. `src/context-routing/evaluator.js`
3. `src/context-routing/workspace-loader.js`

任务：

1. human docs 改由 backend resolver 指向的 docs root 加载
2. 损坏 JSON / 缺失文档时降级

测试：

1. 更新 `tests/unit/context-routing-evaluator.test.js`

完成定义：

1. `in_repo` / `external_knowledge` 下 evaluator 都可正常工作

---

## 9. Stage F：skill / contract / docs / smoke 收尾

## F1. 更新 skill 文本 contract

涉及文件：

1. `skills/spec-graph-bootstrap/SKILL.md`

任务：

1. 把 skill 文本与真实五段编排一致
2. 明确三份 machine facts 为正式真源
3. 明确 control plane 与 durable docs 的双平面语义

测试：

1. 更新 smoke tests 中对 skill 文本的断言

完成定义：

1. skill 文本不再夸大或漂移

## F2. 更新 checked-in samples / fixtures

涉及文件：

1. `.spec-first/workflows/bootstrap/spec-first/*`
2. `docs/contexts/spec-first/*`

任务：

1. 更新 sample outputs，使之与新主链一致
2. 确保 fixtures 仍可做 contract 回归

测试：

1. 更新 contract tests

完成定义：

1. sample 退回 fixture 身份，但仍反映新主链

## F3. 补 smoke / integration

涉及文件：

1. `tests/smoke/cli.sh`
2. 相关 integration tests

任务：

1. 覆盖 `spec-first crg build` + `spec-graph-bootstrap` 主链
2. 覆盖 `in_repo`
3. 覆盖 `external_knowledge`

完成定义：

1. 用户从 init 到 bootstrap 到 context-routing 的主链可回归

---

## 10. 阶段依赖矩阵

| 阶段 | 依赖 | 不能跳过的原因 |
|---|---|---|
| Stage A | 无 | 必须先建立 machine facts 真源 |
| Stage B | Stage A | machine artifacts 需要真实 facts |
| Stage C | Stage A + B | routing/manifest 要反映真实 outputs |
| Stage D | Stage A + B | docs renderer 需要稳定 facts 输入 |
| Stage E | Stage B + C + D | 双模式接入前必须先把单模式主链做实 |
| Stage F | 全部前置 | 收尾只能在主链稳定后进行 |

---

## 11. 推荐并行切分

可以并行的只有横向模块，不可并行的是主链阶段。

### 可并行组 1

1. `fact-inventory-analyzer`
2. `risk-signals-analyzer`
3. `test-surface-analyzer`

前提：

- 先有 analyzer 统一 contract

### 可并行组 2

1. `summary/module-map/public-entrypoints`
2. `test-map/high-risk-modules`
3. `pitfalls/review-change/README`

前提：

- machine facts schema 已稳定

### 不建议并行的部分

1. orchestrator 重构
2. manifest/routing 真化
3. durable docs backend 切换

这些都在主链上，容易相互阻塞。

---

## 12. 每阶段完成后的审查点

## Stage A 审查点

检查：

1. 三份 facts 是否自动落盘
2. facts 字段是否都能追溯来源
3. tests 是否摆脱手工注入

## Stage B 审查点

检查：

1. minimal-context 是否完全基于真实 facts
2. freshness/lint/contradictions 是否使用真实 inputs/outputs

## Stage C 审查点

检查：

1. manifest 是否仍残留 sample 主链
2. routing 是否会虚报 asset

## Stage D 审查点

检查：

1. docs 是否仍存在 placeholder 主路径
2. renderer 输出是否与 facts 一致

## Stage E 审查点

检查：

1. control plane 是否仍 repo-local
2. docs plane 是否按 mode 正确写入
3. rollback 是否覆盖 docs 真源

## Stage F 审查点

检查：

1. skill 文本、samples、tests 是否统一

---

## 13. 最终完成定义

当且仅当以下全部成立，才能认为 `spec-graph-bootstrap` 终局闭环开发完成：

1. `spec-graph-bootstrap` 自动生成三份 machine facts
2. machine facts 来自 graph truth / repo truth / runtime truth
3. `minimal-context/*.json` 不再依赖手工输入
4. `artifact-manifest.json` 与 `context-routing.json` 不再主要依赖 sample generator
5. `docs/contexts/<slug>/*` 不再是 placeholder
6. `context-routing` 在真实主链下选中的 assets 与实际输出一致
7. `in_repo` 与 `external_knowledge` 双模式都可运行
8. skill 文本、contract、sample、tests、runtime 主链全部一致

---

## 14. 最终结论

这份开发清单的核心不是“列更多任务”，而是把主链收敛清楚：

1. 第一优先级是 machine facts 真源闭环
2. 第二优先级是 machine artifacts 和 routing 真化
3. 第三优先级是 human docs renderer 化
4. 最后才是双模式 durable docs 接入和治理收尾

如果按这个顺序执行，`spec-graph-bootstrap` 会从“有 AST 底座但 bootstrap 仍偏 sample/placeholder 的骨架系统”，升级为“真正代码事实驱动的上下文基础设施”。
