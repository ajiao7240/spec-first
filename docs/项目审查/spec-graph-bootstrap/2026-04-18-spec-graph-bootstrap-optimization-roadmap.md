# `spec-graph-bootstrap` 优化路线图

文档角色：`整改路线图 / 执行计划`  
来源文档：[2026-04-18-spec-graph-bootstrap-audit.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-audit.md)  
上位结论：[2026-04-18-spec-first-code-audit-report.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-code-audit-report.md)  
当前状态：`方案阶段，尚未进入实施跟踪`

日期：`2026-04-18`  
目标：基于专项审查结果，将 `spec-graph-bootstrap` 从“可稳定装配的 Stage-0 控制面”推进到“对 LLM 足够诚实、可追溯、可降级的高质量决策输入层”

本路线图基于专项审查结论制定，不重复证明问题是否存在，而是定义修复顺序、执行边界与阶段目标。

## 总体原则

这条线的优化重点不是引入更重的状态机，也不是把 workflow 全部编码成硬编排，而是持续提高四件事：

1. 输入真实性
2. 边界清晰度
3. 降级可见性
4. 下游可安全消费性

一句话目标：

让 `spec-plan`、`spec-work`、`spec-code-review` 看到的是“真实、带 provenance、带 confidence、带 fallback 的决策输入”，而不是“看起来完整的控制面样板”。

---

## 1. 当前最需要优化的点

## P0. 拆开“装配完成”和“事实可信”

当前问题：

- `orchestrator.js` 只要 `machine -> human -> routing` 三段不报错就返回 `status: complete`
- `evaluator.js` 对 `L0` 的判断重点仍然是 manifest / routing / minimal-context 是否存在

影响：

- 下游 workflow 很容易把“产物齐全”误读为“事实可信”
- 这会放大 Stage-0 的误导成本

建议改动：

- 在 `artifact-manifest.json` 中新增：
  - `assembly_status`
  - `evidence_status`
  - `truth_level`
  - `fallback_reason`
  - `missing_analyzers`
- 将 `status: complete` 收窄为“装配已完成”，不再默认代表“事实已充分验证”

建议落点：

- `src/bootstrap-compiler/orchestrator.js`
- `src/bootstrap-compiler/compile-routing.js`
- `src/context-routing/evaluator.js`

验收标准：

- 纯 sample 运行不能再直接得到“高可信 complete”语义
- 下游能区分 `sample-backed`、`mixed`、`analyzer-backed`

## P0. 去掉 routing / manifest 的 sample 主导地位

当前问题：

- `compileRouting()` 直接基于 sample generator 生成 routing / manifest / injection-index

影响：

- 控制面最核心的索引文件仍然偏静态模板
- `selection_rules` 与实际分析结果之间的绑定不够真实

建议改动：

- 让 `compileRouting()` 接收真实输入：
  - `factInventory`
  - `riskSignals`
  - `testSurface`
  - `verificationProfile`
  - `actualAssets`
  - `contextAssets`
- `artifact-manifest.inputs` 改为记录本次运行真实输入快照
- 每个 output 增加 `provenance` 与 `confidence`

建议落点：

- `src/bootstrap-compiler/compile-routing.js`
- `src/bootstrap-compiler/sample-generator.js`
- `src/bootstrap-compiler/run-bootstrap.js`

验收标准：

- 仓库输入变化后，manifest 的 inputs / outputs 元信息可观测变化
- `node_count`、`edge_count`、`graph_last_built` 不再来自固定 sample 常量

## P0. 去掉默认骨架文档造成的“假完整”

当前问题：

- `runBootstrap()` 默认会写入一组固定 markdown 文档
- `writeContextArtifacts()` 会把 `DEFAULT_CONTEXT_DOCS` 无条件 merge 写盘

影响：

- `module-map`、`test-map`、`public-entrypoints` 即便没有真实内容也会存在
- 存在性测试很容易掩盖内容质量不足

建议改动：

- 将默认骨架文档标记为 `skeletal`
- 关键文档默认不写正文占位，而是写显式降级头：
  - `status: skeletal`
  - `fallback_reason`
  - `missing_evidence`
- 只有 analyzer-backed 内容才升级为 `ready`

建议落点：

- `src/bootstrap-compiler/run-bootstrap.js`
- 后续新增真实 human doc compiler

验收标准：

- 缺失真实分析时，关键 docs 仍可存在，但会被明确识别为 skeletal
- evaluator 不会仅凭 skeletal docs 把结果判为 `L0`

## P1. 给 minimal context 补 provenance / confidence / freshness

当前问题：

- `minimal-context/*.json` 已有不错的决策字段，但元信息仍偏弱

影响：

- 下游知道“该看什么”，但不够知道“这些信息值不值得信”

建议改动：

- 为 `plan/work/review` 三份 minimal context 增加：
  - `provenance`
  - `confidence`
  - `freshness_status`
  - `coverage_gaps`
  - `source_assets`

建议落点：

- `src/bootstrap-compiler/compile-minimal-context.js`

验收标准：

- `spec-plan` / `spec-work` / `spec-code-review` 可以直接引用这些字段组织 prompt
- 低置信输入在 downstream prompt 中自动降级为“待确认信号”

## P1. 让 human assets 真正成为“事实投影层”

当前问题：

- `compileHumanAssets()` 只做路径过滤，没有真正生成高价值文档

影响：

- 文档面是 Stage-0 的重要人类可读层，但当前几乎没有自己的事实编译能力

建议改动：

- 将 `compileHumanAssets()` 拆成几类编译器：
  - `compileModuleMapDoc()`
  - `compilePublicEntrypointsDoc()`
  - `compileTestMapDoc()`
  - `compileHighRiskModulesDoc()`
- 每篇文档显式附：
  - `generated_at`
  - `provenance`
  - `confidence`
  - `fallback_reason`

建议落点：

- `src/bootstrap-compiler/compile-human-assets.js`
- 可能新增 `src/bootstrap-compiler/human-docs/*.js`

验收标准：

- 文档正文不再是默认占位文本
- 文档中包含真实文件路径、符号、命令、风险来源

## P1. 收紧 L0 判断标准

当前问题：

- evaluator 主要看“有没有”，不够看“真不真”

建议改动：

- `L0` 至少要求同时满足：
  - manifest truth level 不是 `sample-backed`
  - minimal context confidence 达阈值
  - 关键 docs 不是 skeletal
- 否则退到 `L1`

建议落点：

- `src/context-routing/evaluator.js`

验收标准：

- sample-only bootstrap 只能拿到 `L1` 或更低
- analyzer-backed 产物才进入 `L0`

## P2. 把 sample generator 收缩到测试与受控 fallback

当前问题：

- sample generator 当前既服务测试，也进入主运行路径

建议改动：

- 将 sample generator 明确分成两类：
  - `fixtures / tests only`
  - `runtime fallback only`
- runtime fallback 输出必须在 manifest 中显式打标

建议落点：

- `src/bootstrap-compiler/sample-generator.js`
- `tests/unit/spec-graph-bootstrap-contracts.test.js`

验收标准：

- 生产路径里不会无标记地产出 sample-backed manifest

## P2. 增加真实性导向测试

建议新增测试：

1. 输入变化会驱动 minimal-context 的 focus 变化
2. 缺失 entrypoints 时 manifest 会显式降级
3. skeletal docs 不会导致 `L0`
4. runtime fallback 会写明 provenance / fallback_reason
5. verification_profile 与 manifest inputs 在 rerun 时可追溯变化

建议落点：

- `tests/unit/spec-graph-bootstrap-compiler.test.js`
- `tests/unit/spec-graph-bootstrap-contracts.test.js`
- `tests/e2e/spec-graph-bootstrap-mainline.sh`

---

## 2. 推荐实施顺序

## 第 1 阶段：先修 contract 诚实度

目标：

- 不再把“样板完整”误报成“事实可信”

动作：

1. 拆 `status`
2. 加 `truth_level`
3. 加 `fallback_reason`
4. evaluator 收紧 `L0`

预期收益：

- 下游不再被误导
- 系统边界立刻更清楚

## 第 2 阶段：替换 routing / manifest 的 sample 主链

目标：

- 控制面索引改为真实编译结果驱动

动作：

1. `compileRouting()` 改为接收真实输入
2. manifest `inputs` 改为真实快照
3. outputs 增加 provenance / confidence

预期收益：

- control plane 终于开始真正表达 repo 当前状态

## 第 3 阶段：增强 minimal context 与 human docs

目标：

- 让 machine context 与 human context 都成为高质量事实投影

动作：

1. 扩 minimal context 元字段
2. 给 human docs 增加真实编译逻辑
3. 为关键 docs 加 evidence refs

预期收益：

- `plan/work/review` 的上下文质量会明显提升

## 第 4 阶段：补真实性测试与质量门

目标：

- 将“输入真实性”纳入回归门，而不是只测存在性

动作：

1. 新增 truth/provenance/fallback contract tests
2. 新增 skeletal downgrade tests
3. 新增 rerun freshness tests

预期收益：

- 后续演进更稳，不容易再次滑回“样板完整优先”

---

## 3. 建议拆成的具体任务

### 任务组 A：Manifest 诚实度治理

- 重构 `artifact-manifest` schema，区分 assembly / evidence / truth
- 更新 `compile-routing.js`
- 更新 `evaluator.js`
- 更新相关 contract tests

### 任务组 B：Runtime fallback 显式化

- 规范 skeletal docs 头部格式
- 规范 runtime fallback provenance
- 更新 `writeContextArtifacts()`

### 任务组 C：Minimal context 增强

- 追加 provenance / confidence / freshness_status / coverage_gaps
- 对齐 `spec-plan` / `spec-work` / `spec-code-review` 的消费口径

### 任务组 D：Human docs 真编译

- 先做 `public-entrypoints` 与 `test-map`
- 再做 `module-map` 与 `high-risk-modules`

### 任务组 E：真实性测试门

- 单元测试补 contract
- e2e 增加质量断言

---

## 4. 30 / 60 / 90 天建议

## 30 天

- 先解决 `status / truth_level / fallback_reason`
- 收紧 `L0`
- 给 skeletal docs 打标

## 60 天

- routing / manifest 切到真实编译输入
- minimal context 带 provenance / confidence

## 90 天

- human docs 真编译落地
- 新质量门纳入默认测试

---

## 最终目标状态

当这条路线完成后，`spec-graph-bootstrap` 应该达到下面的状态：

1. 下游 workflow 可以放心把 Stage-0 当作“有边界的高质量输入”，不是“可能掺样板的完整包”
2. 任意一个关键文件都能回答：
   - 它从哪里来
   - 可信度多少
   - 何时生成
   - 缺了什么
3. 系统继续保持轻 contract，不引入不必要的重编排
4. 真正把“让 LLM 做决策”建立在“给 LLM 更好的事实输入”之上
