---
title: "spec-first AI 开发辅助质量二八整改方案"
status: completed
created: 2026-04-18
owner: spec-platform
---

# spec-first AI 开发辅助质量二八整改方案

> 历史说明：本文中的 benchmark / `CRG Quality Gate` / `test:crg:gate` / `test:crg:benchmark-evidence` 表述对应 2026-04-18 当时的整改背景。相关 benchmark 目录、脚本与 gate 已在当前实现中退役；阅读本文时请将这些内容视为历史记录，而不是当前仓库仍可执行的操作说明。
> 本文基于当前仓库代码事实编写，目标是让 `spec-first` 更稳定、更高质量地辅助 AI 开发，而不是继续堆叠文档设想。
> 核心方法：用二八原则只抓最影响 AI 辅助质量的少数关键链路，先修“事实输入质量 + 运行时一致性 + 质量回归门”，再做更重的算法与体验升级。
> 完成状态：截至 `2026-04-18`，本文对应的 Unit 0-4 收口项已按当前代码事实执行完成，并完成文档、benchmark、gate 与回归基线同步。

## 1. 目标

在不引入第二套真源、不扩大系统漂移面的前提下，优先解决当前最影响 AI 辅助质量的 4 个问题：

1. Stage-0 产物仍大量依赖 sample / 占位内容，导致下游 workflow 拿到的上下文不够真实。
2. `skills/`、`docs/contracts/`、`src/bootstrap-compiler/`、`src/context-routing/` 之间仍存在事实漂移风险。
3. CRG 仍有一批在线的语义缺陷，会直接污染 `flow`、风险感知、review context 与检索上下文。
4. 缺少把“是否真的帮助 AI 开发”锁住的硬性质量门，当前测试更多是在验证结构完整，而不是验证效果稳定。

本方案不追求一次性“终局重构”，而是先把最能提高 AI 辅助质量的 20% 工作做实。

---

## 2. 当前代码事实

以下判断全部来自当前代码，不基于推测。

### 2.1 Stage-0 编译链仍偏 sample-driven

- `src/bootstrap-compiler/compile-human-assets.js` 当前只做文件路径过滤，不生成真实上下文文档内容。
- `src/bootstrap-compiler/compile-routing.js` 当前直接调用 `sample-generator` 生成 `context-routing`、`artifact-manifest`、`injection-index`。
- `src/bootstrap-compiler/run-bootstrap.js` 当前默认写出的 `README.md`、`module-map.md`、`public-entrypoints.md`、`test-map.md` 等文档仍来自 `DEFAULT_CONTEXT_DOCS` 占位文本或外部注入。
- `tests/unit/spec-graph-bootstrap-compiler.test.js` 当前主断言也是围绕 sample / placeholder 产物的结构存在性，而不是围绕真实 fact → asset 编译闭环。

对应文件：
- `src/bootstrap-compiler/compile-human-assets.js`
- `src/bootstrap-compiler/compile-routing.js`
- `src/bootstrap-compiler/sample-generator.js`
- `src/bootstrap-compiler/run-bootstrap.js`
- `tests/unit/spec-graph-bootstrap-compiler.test.js`
- `tests/e2e/spec-graph-bootstrap-mainline.sh`

### 2.2 运行时真源已经偏向 control plane，但文档与实现仍容易漂移

- `src/context-routing/loader.js` 明确优先读取 control plane 下的 `context-routing.json`、`artifact-manifest.json`、`freshness.json`。
- `src/context-routing/evaluator.js` 的运行时判定依赖 `output_exists.*`、`stage_is.*`，并显式跳过 `fact.*`。
- `tests/unit/workflow-stage0-consumption.test.js` 已锁定 `spec-plan`、`spec-work`、`spec-review` 以 evaluator 输出 contract 为真源。
- 但 `skills/spec-graph-bootstrap/SKILL.md`、`docs/02-架构设计/*`、checked-in sample 之间仍可能继续出现“文本先行、代码滞后”的问题。

对应文件：
- `src/context-routing/loader.js`
- `src/context-routing/evaluator.js`
- `tests/unit/workflow-stage0-consumption.test.js`
- `skills/spec-graph-bootstrap/SKILL.md`
- `docs/contracts/spec-graph-bootstrap/*.schema.json`

### 2.3 CRG 在线问题里，真正仍影响 AI 辅助质量的不是全部算法项，而是少数几个评分/入口语义问题

当前仍成立、且直接影响 AI 辅助质量的点：

- `src/crg/flows.js`
  - `test_gap` 当前算的是 flow 内 `is_test` 节点占比，不是真正的测试覆盖。
  - `security_score` 用宽泛关键词 + `includes()`，在 Web 项目里容易产生高噪声。
  - `entry` 仍主要依赖 `fan-in=0` 的 `calls` 图入口，天然漏掉框架分发入口。
- `src/crg/analyze.js`
  - `cross_community` 仍采用门控策略，当前继续保留，是否放开仍需 benchmark 证据而不是直觉判断。
  - `peripheral_to_hub` 已保守放宽到 `srcDeg <= 1`，用于小幅提高召回，但没有同步放开 `cross_community`。
- `src/crg/chunking.js`
  - 仍按固定行数切块，不是 AST-aware。
- `src/crg/incremental.js`
  - 仍对候选文件直接整文件读入并计算 SHA，没有 `mtime + size` 预筛。

对应文件：
- `src/crg/flows.js`
- `src/crg/analyze.js`
- `src/crg/chunking.js`
- `src/crg/incremental.js`
- `src/crg/constants.js`

### 2.4 项目已经有丰富测试与 benchmark 入口，但还没有把“AI 开发辅助效果”作为主 gate

当前已有：
- 单元测试：`tests/unit/*.test.js`
- CLI / E2E：`tests/e2e/crg-all-commands.sh`、`tests/e2e/spec-graph-bootstrap-mainline.sh`
- benchmark 入口：
  - `npm run test:crg:gate`
  - `npm run test:crg:benchmarks`
- smoke 测试：
  - `tests/unit/context-efficiency-benchmark-smoke.test.js`
  - `tests/unit/review-benchmark-smoke.test.js`
  - `tests/unit/repo-qa-benchmark-smoke.test.js`

问题不在“没有测试”，而在“最关键的 gate 还没对准项目最重要的价值函数”：
- AI 拿到的上下文是否更真实
- 评审建议是否更聚焦高风险
- 计划/执行前的 selected assets 是否更相关
- 改动后是否引入新的 contract 漂移

---

## 3. 二八优先级判断

### 3.1 现在最该优先做的 20%

以下 4 个主题会贡献当前阶段 80% 的质量提升：

1. **Stage-0 真实化**
   - 如果 Stage-0 仍主要输出 sample / placeholder，上层 workflow 再聪明也只是“更好地消费假信息”。
2. **真源收敛与 contract 锁定**
   - 如果 `skills`、`contracts`、compiler、runtime evaluator 不同步，项目会持续制造“文档说一套、运行时做一套”的错误上下文。
3. **CRG 在线信号修正**
   - 优先修 `test_gap`、`security_score`、`entry confidence` 这类直接污染 AI 判断的点。
4. **AI 质量门**
   - 没有可重复 benchmark / regression gate，任何“优化”都无法证明是在帮 AI，而不是帮自己感觉更好。

### 3.2 当前不应抢先做的 80%

这些方向有价值，但不该抢在前面：

- 直接把社区检测升级成 Louvain / Leiden
- 一次性重写 retrieval 全链路
- 一次性把 `chunking` 升级成多语言 AST-aware 高级切分
- 扩大 workspace / 多仓智能聚合复杂度
- 引入第二套路由真源或新的 runtime 状态语义

原因不是这些不重要，而是当前主问题还在“输入是否真实、契约是否收敛、信号是否可信”。

---

## 4. 整改原则

1. **代码优先于文档**
   - 任何方案都必须先对齐当前代码，再更新文档与 sample。
2. **control plane 是运行时真源**
   - 运行时只消费 `context-routing.json`、`artifact-manifest.json`、`freshness.json` 及 `minimal-context/*`。
   - `injection-index.yaml` 保留为人类视图，不再被描述成运行时唯一真源。
3. **先 characterization，再升级语义**
   - 对 CRG 的关键输出先锁当前基线，再做评分/算法变更。
4. **先修在线污染项，再做重算法**
   - 优先修当前仍在误导 AI 的地方，不优先做理论上更高级的算法。
5. **每个整改单元都必须带验证闭环**
   - 方案、代码、schema、sample、tests、benchmark 同步推进。

---

## 5. 总体整改路径

整改分 4 个阶段推进，前后依赖明确。

### Phase 0：事实收敛与基线冻结

目标：
- 统一“当前已修复 / 仍待处理 / 设计讨论”三类问题
- 为后续改动建立可信基线

产出：
- 审计文档状态收敛
- characterization fixtures
- 当前 Stage-0 / CRG 关键输出基线

### Phase 1：Stage-0 真实化与主链收敛

目标：
- 把 `spec-graph-bootstrap` 的主价值链从 sample 驱动改成 fact 驱动
- 让 AI 在 `spec-plan` / `spec-work` / `spec-review` 中拿到更真实的上下文

### Phase 2：CRG 在线信号修正

目标：
- 修正仍在污染 AI 判断的 flow / risk / review context 语义
- 不一次性做重算法升级

### Phase 3：AI 质量门与回归治理

目标：
- 用 benchmark 与 E2E 把“真的更能辅助 AI 开发”锁成回归门
- 避免后续优化再次退回 sample / 漂移 / 语义错配

---

## 6. 实施单元

## Unit 0：事实收敛与基线冻结

### 6.1 目标

把当前“计划文档 / 审计文档 / 实现现状”之间的差异先收束，再开始新一轮整改。

### 6.2 代码事实依据

- 多份文档已经出现“目标态写成现状”的情况。
- 审计报告中部分问题已被代码修复，但摘要与优先级表未同步收口。

### 6.3 文件范围

- 修改：`docs/02-架构设计/2026-04-18-spec-graph-bootstrap-与-CRG-数据底座深度剖析.md`
- 修改：`docs/02-架构设计/2026-04-18-CRG算法逻辑深度审计报告.md`
- 修改：`docs/plans/2026-04-16-014-refactor-unified-crg-stage0-execution-plan.md`
- 新增或修改：`tests/contracts/` 或 `tests/unit/` 下的 characterization 用例

### 6.4 步骤

1. 标记每个审计结论是 `implemented`、`active`、还是 `design-discussion`。
2. 为以下输出建立 characterization baseline：
   - `crg flows`
   - `crg context`
   - `crg review-context`
   - `evaluateContextForRepo({ stage: 'plan' | 'work' | 'review' })`
3. 把文档中的“运行时真源”表述统一为 control plane contract。

### 6.5 测试与验证

- 修改：`tests/unit/spec-graph-bootstrap-contracts.test.js`
- 修改：`tests/unit/spec-graph-bootstrap-compiler.test.js`
- 修改：`tests/unit/context-routing-evaluator.test.js`
- 新增：`tests/unit/crg-characterization.test.js`

测试场景：
- checked-in sample、contracts 与当前运行时 contract 不冲突
- evaluator 的 selected assets 顺序在无改动情况下稳定
- CRG 关键 CLI 输出在 characterization fixture 下稳定

### 6.6 完成信号

- 后续所有整改任务都能明确引用“当前仍在线的问题”
- 文档不再把已修复问题列为 P0

---

## Unit 1：Stage-0 真实 machine artifacts 生产链

### 6.1 目标

把 Stage-0 从“sample + placeholder 主链”推进到“真实事实输入驱动的 machine artifacts 主链”。

### 6.2 为什么这是最高优先级

当前 AI 辅助质量最核心的问题不是“缺少 fancy 算法”，而是上层 workflow 拿到的 Stage-0 上下文仍可能是 sample 或占位内容。

### 6.3 代码事实依据

- `src/bootstrap-compiler/compile-machine-artifacts.js` 目前主要生成 `minimal_context`、`freshness`、`lint_report`、`contradictions`。
- `src/bootstrap-compiler/compile-routing.js` 直接调用 sample generator。
- `src/bootstrap-compiler/run-bootstrap.js` 默认文档资产来自 `DEFAULT_CONTEXT_DOCS`。
- `src/bootstrap-compiler/compile-human-assets.js` 不是实际编译器，只是路径分类器。

### 6.4 文件范围

- 修改：`src/bootstrap-compiler/compile-machine-artifacts.js`
- 修改：`src/bootstrap-compiler/compile-human-assets.js`
- 修改：`src/bootstrap-compiler/compile-routing.js`
- 修改：`src/bootstrap-compiler/orchestrator.js`
- 修改：`src/bootstrap-compiler/run-bootstrap.js`
- 修改：`src/bootstrap-compiler/sample-generator.js`
- 修改：`src/bootstrap-compiler/schema-loader.js`
- 修改：`docs/contracts/spec-graph-bootstrap/*.schema.json`
- 修改：`skills/spec-graph-bootstrap/SKILL.md`
- 修改：`skills/spec-graph-bootstrap/references/artifact-schemas.md`

### 6.5 方案决策

1. 不再让 `compile-routing.js` 直接成为 sample 包装器。
2. machine artifacts 先落到真实输入驱动的最小闭环：
   - `fact-inventory.json`
   - `risk-signals.json`
   - `test-surface.json`
   - `artifact-manifest.json`
3. `sample-generator.js` 保留，但角色下沉为：
   - checked-in sample 生成器
   - test fixture 辅助
   - 不再承担运行时主链逻辑
4. `compile-human-assets.js` 升级为真实 human asset compiler，而不是简单过滤器。

### 6.6 逐步实施

1. 先定义最小稳定输入 contract
   - 固定 `fact-inventory`、`risk-signals`、`test-surface` 的最小必填字段
2. 让 machine artifacts 先真实可产出
   - 即使 human assets 仍未完全真实化，也不能继续伪造完整结果
3. 再替换 human assets 编译
   - 先覆盖 `00-summary.md`、`module-map.md`、`public-entrypoints.md`、`test-map.md`
4. 最后替换 routing / manifest 深合并逻辑

### 6.7 测试与验证

- 修改：`tests/unit/spec-graph-bootstrap-compiler.test.js`
- 修改：`tests/unit/spec-graph-bootstrap-contracts.test.js`
- 修改：`tests/unit/stage0-freshness.test.js`
- 修改：`tests/unit/workflow-stage0-consumption.test.js`
- 修改：`tests/e2e/spec-graph-bootstrap-mainline.sh`

测试场景：
- `runBootstrap()` 在提供真实 fact 输入时，输出真实 machine artifacts 而不是 sample
- `artifact-manifest.json` 与 `context-routing.json` 满足 schema，且字段来自真实输入
- `spec-plan` / `spec-work` / `spec-review` 的 selected assets 由真实 control plane 决定
- docs backup / rollback 语义不被新的编译链破坏

### 6.8 完成信号

- `sample-generator.js` 不再是 bootstrap 主链的核心依赖
- `tests/e2e/spec-graph-bootstrap-mainline.sh` 覆盖真实 Stage-0 编译闭环
- `compile-human-assets.js` 不再是 14 行过滤器

---

## Unit 2：真源收敛与双宿主一致性

### 6.1 目标

确保 Claude / Codex 双宿主、skills、contracts、runtime evaluator 使用同一套事实语义，不再继续累积文本漂移。

### 6.2 代码事实依据

- `src/context-routing/loader.js` / `src/context-routing/evaluator.js` 已经明确以 control plane contract 为真源。
- `tests/unit/workflow-stage0-consumption.test.js` 已要求三个 workflow 以 evaluator 输出 contract 为真源。
- `src/cli/adapters/claude.js` 与 `src/cli/adapters/codex.js` 对 runtime 结构有不同变换逻辑，若 contracts 与 templates 不同步，容易漂移。

### 6.3 文件范围

- 修改：`src/context-routing/loader.js`
- 修改：`src/context-routing/evaluator.js`
- 修改：`src/cli/adapters/claude.js`
- 修改：`src/cli/adapters/codex.js`
- 修改：`templates/`
- 修改：`skills/spec-plan/SKILL.md`
- 修改：`skills/spec-work/SKILL.md`
- 修改：`skills/spec-review/SKILL.md`
- 修改：`docs/contracts/spec-graph-bootstrap/*.schema.json`

### 6.4 方案决策

1. 运行时只消费 `context-routing.json`，不新增第二套路由真源。
2. `injection-index.yaml` 明确降级为 durable human view。
3. `skills/` 文本与 runtime contract 的冲突，以 checked schema + checked tests 为准。
4. Claude/Codex 适配只做宿主表面变换，不承载独立语义。

### 6.5 测试与验证

- 修改：`tests/unit/workflow-stage0-consumption.test.js`
- 修改：`tests/unit/using-spec-first-runtime-contracts.test.js`
- 修改：`tests/unit/spec-plan-contracts.test.js`
- 修改：`tests/unit/spec-review-contracts.test.js`
- 修改：`tests/unit/spec-work-contracts.test.js`
- 新增或修改：Claude/Codex 双宿主 smoke 场景

测试场景：
- 三个 workflow 读取 Stage-0 时不再依赖 yaml 解析逻辑
- 双宿主初始化后生成的 runtime 资产与 source-of-truth 一致
- contract 变更后，skills 与 adapters 不会静默漂移

### 6.6 完成信号

- 文档、skills、runtime、contracts 对“运行时真源”只有一种说法
- 双宿主 smoke 覆盖 Stage-0 消费路径

---

## Unit 3：CRG 在线信号修正

### 6.1 目标

优先修复当前仍直接污染 AI 判断的 CRG 语义问题，而不是先做重型算法升级。

### 6.2 范围内问题

优先处理：

1. `test_gap` 语义错误
2. `security_score` 噪声过高
3. `entry` 只靠 `fan-in=0`，缺少置信度表达
4. `peripheral_to_hub` 阈值过窄

暂不优先：

- 社区检测升级为 Louvain
- AST-aware chunking 全量替换
- `cross_community` 权重直接重构上线

### 6.3 文件范围

- 修改：`src/crg/flows.js`
- 修改：`src/crg/constants.js`
- 修改：`src/crg/analyze.js`
- 修改：`src/crg/cli/context.js`
- 修改：`src/crg/commands/flows.js`
- 修改：`src/crg/commands/review-context.js`
- 修改：`src/crg/changes.js`
- 修改：`tests/unit/crg-analyze.test.js`
- 修改：`tests/unit/crg-changes.test.js`
- 修改：`tests/unit/crg-review-context-hunks.test.js`
- 新增：`tests/unit/crg-flows-scoring.test.js`

### 6.4 方案决策

1. `test_gap`
   - 第一阶段不要假装算“真实覆盖率”。
   - 最稳方案是先改成：
     - 直接删除该因子，或
     - 改为“module/test import 反查”的近似覆盖，并明确 `inference_reason`
2. `security_score`
   - 拆成强信号与弱信号两层
   - 弱信号只有在路径、依赖或上下文命中时才加权
3. `entry`
   - 不先承诺“更准确识别全部框架入口”
   - 先让现有 heuristic 显式输出 `confidence: Inferred` 与 `inference_reason`
4. `cross_community`
   - 先用 benchmark 和 fixture 评估门控是否该放开
   - 在没有数据前，不直接改线上默认

### 6.5 测试与验证

- characterization：对比修改前后 `flows`、`context`、`review-context`
- benchmark：review benchmark、repo QA、context efficiency
- CLI：`tests/e2e/crg-all-commands.sh`

测试场景：
- `criticality` 排序不再被恒定噪声因子主导
- 小型 Web repo 下的 `security_score` 不再大面积虚高
- `entry` 输出带置信度和原因，调用方能识别其启发式属性
- review-context 的高风险节点排序更稳定

### 6.6 完成信号

- 至少一个外部仓库和 `spec-first` 自仓库上的 review / context benchmark 无退化
- `flows` 评分逻辑能解释，不再包含明显伪语义

### 6.7 当前状态（2026-04-18）

已完成：

- `src/crg/flows.js`
  - 删除伪语义 `test_gap`
  - `criticality` 改为 4 因子轻量评分
- `src/crg/constants.js`
  - 安全信号从宽泛关键词改为“强信号 + 安全路径弱信号”
- `src/crg/changes.js`
  - 节点风险评分同步复用新的安全信号
- `src/crg/commands/flows.js`
- `src/crg/commands/flow.js`
- `src/crg/commands/affected-flows.js`
- `src/crg/cli/context.js`
  - flow 相关输出显式增加 `entry_confidence: Inferred`
  - flow 相关输出显式增加 `entry_inference_reason: zero_in_degree_calls`
- `src/crg/analyze.js`
  - `peripheral_to_hub` 已从 `srcDeg === 0` 保守放宽到 `srcDeg <= 1`
  - `cross_community` 仍保持“需与 `cross_language` 或 `peripheral_to_hub` 共现才加权”的门控
- 测试已补：
  - `tests/unit/crg-flows-scoring.test.js`
  - `tests/unit/crg-changes.test.js`
  - `tests/unit/crg-characterization.test.js`
  - `tests/contracts/crg-cli-v1.test.js`
  - `tests/unit/crg-analyze.test.js`

已验证：

- `npx jest tests/unit/crg-flows-scoring.test.js tests/unit/crg-changes.test.js tests/unit/crg-characterization.test.js tests/contracts/crg-cli-v1.test.js --runInBand`
- `npx jest tests/unit/crg-analyze.test.js tests/unit/crg-review-context-hunks.test.js --runInBand`
- `bash tests/e2e/crg-all-commands.sh`

待继续评估：

- 是否需要在 benchmark 证据足够前继续调整 `cross_community` 门控

---

## Unit 4：AI 质量门与回归治理

### 6.1 目标

把“是否真的在帮助 AI 开发”变成硬 gate，而不是只验证产物存在。

### 6.2 文件范围

- 修改：`benchmarks/regression/run-regression.js`
- 修改：`benchmarks/review/run-review-benchmark.js`
- 修改：`benchmarks/repo-qa/run-repo-qa.js`
- 修改：`benchmarks/context-efficiency/run-context-efficiency.js`
- 修改：`tests/unit/regression-gate.test.js`
- 修改：`tests/unit/context-efficiency-benchmark-smoke.test.js`
- 修改：`tests/unit/review-benchmark-smoke.test.js`
- 修改：`tests/unit/repo-qa-benchmark-smoke.test.js`
- 修改：`.github/workflows/` 中相关 gate（若已有）

### 6.3 要锁住的指标

优先锁以下 4 类指标：

1. **Stage-0 selected assets 相关性**
   - `plan` / `work` / `review` 的 selected assets 是否符合当前真实改动面
2. **review risk focus**
   - 高风险节点与候选测试是否更集中
3. **context efficiency**
   - 更少无关上下文进入 AI prompt
4. **contract stability**
   - `schema`、`sample`、runtime 生成物、workflow 消费逻辑不能互相打架

### 6.4 方案决策

1. benchmark 必须能在自仓库与外部仓库双场景运行。
2. 质量门不以“绝对更强”作为第一阶段 blocker，而以“不退化 + 关键项收敛”为 blocker。
3. 任何 analyzer 语义升级都要配 analyzer version / revision 感知。

### 6.5 测试与验证

- `npm run test:unit`
- `npm run test:e2e:crg`
- `npm run test:crg:gate`
- `npm run test:crg:benchmarks`

### 6.6 完成信号

- 关键 benchmark 成为合并前 gate，而不是可选参考
- 任何 Stage-0 / CRG 语义变更都能在 benchmark 中看到影响

### 6.7 当前状态（2026-04-18）

已完成：

- `benchmarks/review/run-review-benchmark.js`
- `benchmarks/repo-qa/run-repo-qa.js`
- `benchmarks/context-efficiency/run-context-efficiency.js`
  - benchmark 输出显式增加：
    - `benchmark_contract_version`
    - `analyzer_revision`
    - `input_digest`
- `benchmarks/regression/run-regression.js`
  - regression 输出显式增加：
    - `benchmark_contract_version`
    - `analyzer_revision`
    - `inputs.*_digest`
    - `compatibility`
  - baseline 不可比时明确返回 `baseline_incompatible`
- `benchmarks/regression/baselines.json`
  - baseline 升级为 revision-aware 可比对格式
  - 在 external fixture 样本集扩容后，input digest 与 context-efficiency 上限会按当前事实同步更新
- `scripts/update-crg-baselines.js`
  - baseline update 会同步写入 analyzer revision 与输入 digest
- `scripts/run-ai-dev-quality-gate.js`
  - `crg-regression` summary 透传 benchmark contract / revision / compatibility
- `scripts/run-crg-benchmark-evidence.js`
  - 新增轻量 benchmark evidence artifact 收集脚本，写出三类 benchmark 结果与聚合索引，不新增 gate 状态语义
- `.github/workflows/crg-quality-gate.yml`
  - 从“单一 regression job”扩为 `regression-gate + benchmark-evidence` 两类 PR job
- `tests/fixtures/benchmarks/demo-store`
  - 受控 external fixture repo 样本 1，覆盖 web storefront + orders service
- `tests/fixtures/benchmarks/wallet-suite`
  - 受控 external fixture repo 样本 2，覆盖 iOS/H5 + payments service 多端支付场景
- 三个 benchmark runner
  - 仅在 case/question 显式提供 `fixture_repo_root` 时切换输入根目录
- smoke 守卫已补：
  - `tests/unit/review-benchmark-smoke.test.js`
  - `tests/unit/repo-qa-benchmark-smoke.test.js`
  - `tests/unit/context-efficiency-benchmark-smoke.test.js`
  - `tests/unit/crg-benchmark-evidence.test.js`

已验证：

- `npx jest tests/unit/regression-gate.test.js tests/unit/review-benchmark-smoke.test.js tests/unit/repo-qa-benchmark-smoke.test.js tests/unit/context-efficiency-benchmark-smoke.test.js tests/unit/ai-dev-quality-gate.test.js --runInBand`
- `npx jest tests/unit/crg-benchmark-evidence.test.js tests/unit/review-benchmark-smoke.test.js tests/unit/repo-qa-benchmark-smoke.test.js tests/unit/context-efficiency-benchmark-smoke.test.js tests/unit/ai-dev-quality-gate.test.js tests/unit/branch-protection-policy.test.js tests/integration/verification-gate.integration.test.js --runInBand`
- `npm run test:crg:benchmark-evidence`
- `npm run test:crg:gate`
- `npm run test:ai-dev:gate`

当前收口结论：

- `CRG Quality Gate` 已形成 `regression-gate + benchmark-evidence` 的轻量 PR 组合：
  - `regression-gate` 继续作为 regression blocker
  - `benchmark-evidence` 只提供 evidence artifact，不引入新的 gate 状态机
- external fixture 已从单一样本扩到 `demo-store + wallet-suite` 两个受控对照样本
- `cross_community` 当前维持原门控不动；在现有自仓库 + 两个 external fixture 样本下，继续优先保持低噪声边界，而不是为追求召回再放宽默认

---

## 7. 里程碑排序

### Milestone 1：先把事实链路做真

包含：
- Unit 0
- Unit 1
- Unit 2 的最小收敛部分

目标：
- 让 AI 至少先拿到真实 Stage-0 事实，而不是 sample 占位

### Milestone 2：修正当前在线误导信号

包含：
- Unit 3

目标：
- 让 flow / risk / review context 不再被明显伪语义污染

### Milestone 3：把效果锁成回归门

包含：
- Unit 4

目标：
- 后续任何优化必须证明自己真的在帮助 AI 开发

---

## 8. 非目标

本轮整改不包含：

- 直接把社区算法升级成真正图社区发现算法
- 一次性全量 AST-aware chunking 重写
- 一次性重构 retrieval 全链路
- 为 workspace / 多仓场景引入更复杂的新 contract
- 创建新的 runtime 状态真源或新的 control plane 平行体系

这些不是不做，而是不应抢在更高杠杆的问题前面。

---

## 9. 风险与控制

| 风险 | 控制方式 |
|------|----------|
| Stage-0 真实化改动面大，主链失稳 | 先 machine artifacts，后 human assets，再 routing；每层都有 characterization |
| CRG 信号修复后 benchmark 退化 | 先加 characterization 和 benchmark gate，再改评分逻辑 |
| 文档与代码继续漂移 | contracts + tests 为准，skills 与 docs 同步更新 |
| 双宿主行为分叉 | Claude/Codex smoke 同步覆盖 |
| 改动只在 `spec-first` 自仓库表现良好 | 每个里程碑都要求至少一个外部仓库对照验证 |

---

## 10. 验收标准

整改完成的验收标准不是“写了更多文档”，而是：

1. `spec-plan`、`spec-work`、`spec-review` 读取的 Stage-0 资产来自真实事实链，而非 sample 占位。
2. CRG 的关键输出不再包含当前已知的明显伪语义因子。
3. contracts、skills、compiler、runtime evaluator 的真源关系明确且被测试锁住。
4. benchmark 能对“AI 开发辅助质量”形成可重复、可比较、可阻断退化的回归门。

---

## 11. 推荐执行顺序

按严格顺序执行：

1. Unit 0：事实收敛与 characterization
2. Unit 1：Stage-0 machine artifacts 真实化
3. Unit 2：真源收敛与双宿主一致性
4. Unit 3：CRG 在线信号修正
5. Unit 4：AI 质量门与回归治理

不要反过来先做 Louvain、AST chunking、workspace 扩展或新的 status 体系。

---

## 12. 剩余高价值优化项确认版

以下清单用于回答“当前进入下一轮时，还剩哪些最值得做的优化项”。

排序原则：

1. 优先做最能提高 LLM 决策输入质量的项
2. 优先做最能降低 runtime contract 漂移风险的项
3. 优先做已有代码基础、可直接推进的项
4. 不把“大而全重构”抢在高杠杆收口项前面

---

### P0：必须优先推进

#### P0-1 Stage-0 machine artifacts 脱离 sample 主链

**目标**

- 让 bootstrap 主链优先消费真实 fact 输入，而不是通过 `sample-generator` 兜底出看似完整的 control plane。

**直接文件**

- `src/bootstrap-compiler/compile-machine-artifacts.js`
- `src/bootstrap-compiler/compile-routing.js`
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/sample-generator.js`
- `src/bootstrap-compiler/compile-human-assets.js`

**验证方式**

- `tests/unit/spec-graph-bootstrap-compiler.test.js`
- `tests/unit/spec-graph-bootstrap-contracts.test.js`
- `tests/e2e/spec-graph-bootstrap-mainline.sh`

**暂不做**

- 不一次性把所有 human docs 都升级成“高质量 narrative”
- 不在这一项里直接引入新的 control plane 真源

#### P0-2 固化 Stage-0 四层 runtime contract 边界

**目标**

- 把 `verification_summary / verifier_dispatch / verification_evidence / verification_gate_state` 的职责彻底定稿，避免继续交叉回填语义。

**直接文件**

- `src/context-routing/verification-summary.js`
- `src/context-routing/verifier-registry.js`
- `src/context-routing/verification-evidence.js`
- `src/context-routing/verification-gate-state.js`
- `src/context-routing/telemetry.js`
- `src/cli/commands/stage0-context.js`

**验证方式**

- `tests/unit/stage0-context-command.test.js`
- `tests/unit/workspace-context.test.js`
- `tests/unit/verification-evidence.test.js`
- `tests/unit/verification-gate-state.test.js`
- `tests/unit/workflow-telemetry.test.js`

**暂不做**

- 不把 gate state 扩成自动执行树
- 不把 evidence 重新压回 summary

#### P0-3 将 verification-profile 做成可扩展 repo truth

**目标**

- 让 `verification-profile` 从“已接通 baseline”升级成多语言、多端仓库可稳定扩展的 repo-scoped verification truth。

**直接文件**

- `src/bootstrap-compiler/compile-verification-profile.js`
- `src/bootstrap-compiler/compile-minimal-context.js`
- `src/bootstrap-compiler/schema-loader.js`
- `docs/contracts/spec-graph-bootstrap/verification-profile.schema.json`

**验证方式**

- `tests/unit/spec-graph-bootstrap-contracts.test.js`
- `tests/unit/spec-graph-bootstrap-compiler.test.js`
- `tests/unit/workflow-stage0-consumption.test.js`

**暂不做**

- 不在这一项里直接解决 per-diff verification recommendation 的全部问题
- 不把 repo profile 和 change-surface recommendation 混成一层

#### P0-4 扩 verifier registry 覆盖平台面

**目标**

- 让 verifier dispatch 不再主要围绕 Web / iOS，而能表达 backend / Android / desktop 等平台面。

**直接文件**

- `src/context-routing/verifier-registry.js`
- `skills/test-browser/SKILL.md`
- `skills/test-xcode/SKILL.md`
- 未来新增的 verifier skill / docs mirror / contract tests

**验证方式**

- `tests/unit/verifier-registry.test.js`
- 相关新增 verifier 的 contract tests
- `stage0-context` 与 workflow telemetry 断言

**暂不做**

- 不要求第一轮就把每个平台都接成真实可执行 verifier
- 不在没有 registry metadata 的情况下靠 prose 硬写支持范围

---

### P1：高收益、但应在 P0 后推进

#### P1-1 修正 CRG 当前仍在线的污染信号

**目标**

- 优先修 `flows` / risk / entry heuristic 中仍会误导 AI 判断的少数在线语义问题。

**直接文件**

- `src/crg/flows.js`
- `src/crg/constants.js`
- `src/crg/analyze.js`
- `src/crg/commands/review-context.js`

**验证方式**

- `tests/unit/crg-analyze.test.js`
- `tests/unit/review-context.test.js`
- `tests/e2e/crg-all-commands.sh`
- review / repo-qa / context-efficiency benchmark

**暂不做**

- 不先做 Louvain / Leiden 社区重算法
- 不先做 retrieval 全链路重写

#### P1-2 收紧 bootstrap complete/success 语义

**目标**

- 让 bootstrap 成功不再主要表示“产物拼出来了”，而要更强地表示“真实分析输入足够支撑当前结果”。

**直接文件**

- `src/bootstrap-compiler/orchestrator.js`
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/compile-machine-artifacts.js`

**验证方式**

- `tests/unit/spec-graph-bootstrap-compiler.test.js`
- `tests/e2e/spec-graph-bootstrap-mainline.sh`

**暂不做**

- 不在这一轮引入过重的失败恢复状态机
- 不要求所有 degraded 场景都阻断产物生成

#### P1-3 为 doctor 增加 runnable probes

**目标**

- 在现有 drift/existence 检查之外，增加少量真实可运行探针，证明关键入口和 verifier 环境是可用的。

**直接文件**

- `src/cli/commands/doctor.js`
- `src/cli/adapters/claude.js`
- `src/cli/adapters/codex.js`

**验证方式**

- `tests/smoke/cli.sh`
- 相关 unit tests

**暂不做**

- 不让 doctor 默认执行重型 E2E
- 不把 doctor 变成新的 workflow 编排器

#### P1-4 继续压缩 docs mirror 漂移面

**目标**

- 降低 `skills/`、`docs/10-prompt/`、schema、tests 之间继续出现事实漂移的概率。

**直接文件**

- `skills/`
- `docs/10-prompt/`
- `tests/unit/*contracts*.test.js`

**验证方式**

- 现有 contract tests
- 新增 mirror drift 守卫测试

**暂不做**

- 不删除人类可读 mirror
- 不把所有 docs 都强行做成生成产物

---

### P2：应做，但不抢在前面

#### P2-1 把 AI 辅助质量 benchmark 提升为主 gate

**目标**

- 让“是否真的帮助 AI 开发”成为明确回归门，而不仅是结构完整性验证。

**直接文件**

- `benchmarks/regression/run-regression.js`
- `benchmarks/review/run-review-benchmark.js`
- `benchmarks/repo-qa/run-repo-qa.js`
- `benchmarks/context-efficiency/run-context-efficiency.js`

**验证方式**

- `npm run test:crg:gate`
- `npm run test:crg:benchmarks`
- 相关 smoke tests

**暂不做**

- 不把第一轮 benchmark 直接设成“绝对分数不升就阻断”
- 先以“不退化 + 高信号项收敛”为 gate

#### P2-2 workspace / multi-repo 再做一轮边界压测

**目标**

- 继续降低 child slug、artifact anchor、explicit repo roots、cwd/target 路径命中这类边界回归。

**直接文件**

- `src/context-routing/entry-resolver.js`
- `src/context-routing/workspace-loader.js`
- `src/bootstrap-compiler/workspace-compiler.js`

**验证方式**

- `tests/unit/workspace-context.test.js`
- `tests/unit/stage0-context-command.test.js`

**暂不做**

- 不在这一轮继续扩 workspace 新语义
- 先收敛已有路径和聚合边界

#### P2-3 做高收益轻量性能优化，而不是大重写

**目标**

- 只修对主链有直接收益的性能点，例如 `incremental` 预筛和 `chunking` 最小增强。

**直接文件**

- `src/crg/incremental.js`
- `src/crg/chunking.js`

**验证方式**

- `tests/unit/crg-incremental.test.js`
- `tests/unit/crg-chunking.test.js`
- benchmark 对比

**暂不做**

- 不在这轮做 AST-aware chunking 全量替换
- 不先引入复杂缓存层或并行调度层

#### P2-4 清理旧控制面与新 control plane 并存噪声

**目标**

- 明确哪些旧脚本/旧控制面只是兼容层，哪些已经退出运行时真源职责。

**直接文件**

- `scripts/`
- 相关 docs / plans / audit 文档

**验证方式**

- 文档收敛审查
- smoke / doctor / init 路径不受影响

**暂不做**

- 不为了“看起来干净”而盲删旧资产
- 先明确职责，再决定删除或保留

---

### 本轮之后的推荐执行顺序

1. `P0-1` Stage-0 machine artifacts 脱离 sample 主链
2. `P0-2` 固化 Stage-0 四层 runtime contract
3. `P0-3` / `P0-4` 完成 verification-profile 与 verifier registry 扩展
4. `P1-1` 修正 CRG 在线污染信号
5. `P1-2` / `P1-3` / `P1-4` 收紧 bootstrap success、doctor probe、docs drift
6. `P2-*` 再做 benchmark 主 gate、workspace 压测、轻量性能优化、旧控制面收敛

### 当前明确不建议抢先做的项

- 直接引入重状态机 workflow 编排
- 为每种语言复制一套 workflow
- 一次性 AST-aware chunking / retrieval / 社区算法大重写
- 创建新的 runtime control plane 平行真源

## 13. 参考输入

本方案直接参考以下现有事实来源：

- `src/bootstrap-compiler/*`
- `src/context-routing/*`
- `src/crg/*`
- `src/cli/adapters/*`
- `tests/unit/spec-graph-bootstrap-compiler.test.js`
- `tests/unit/spec-graph-bootstrap-contracts.test.js`
- `tests/unit/workflow-stage0-consumption.test.js`
- `tests/e2e/spec-graph-bootstrap-mainline.sh`
- `docs/plans/2026-04-16-014-refactor-unified-crg-stage0-execution-plan.md`
- `docs/02-架构设计/2026-04-18-spec-graph-bootstrap-与-CRG-数据底座深度剖析.md`
- `docs/02-架构设计/2026-04-18-CRG算法逻辑深度审计报告.md`

本方案的执行判断标准只有一个：是否让项目整体更高质量地辅助 AI 开发。
