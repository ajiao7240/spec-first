# `spec-graph-bootstrap` 专项审查报告

文档角色：`专项深挖审查`  
上游文档：[2026-04-18-spec-first-code-audit-report.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-code-audit-report.md)  
聚焦范围：`spec-graph-bootstrap` 对 Stage-0 决策输入和 `plan/work/review` 下游链路的影响  
下游文档：[2026-04-18-spec-graph-bootstrap-optimization-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-optimization-roadmap.md)

日期：`2026-04-18`  
范围：`/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap` 及其对应编译链、运行时消费链、下游 workflow 消费链  
审查方法：以仓库代码与测试为事实依据，按“轻 contract + 明确边界 + 让 LLM 决策”的指导思路复审

本报告是对总报告中 Stage-0 / bootstrap 风险的专题深挖；对应整改计划见 [2026-04-18-spec-graph-bootstrap-optimization-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-optimization-roadmap.md)。

## 一句话结论

`spec-graph-bootstrap` 是当前仓库里最关键的上游 skill 之一，因为它直接生成 `spec-plan`、`spec-work`、`spec-code-review` 会优先消费的 Stage-0 决策输入；它现在的优势是“控制面已经可稳定装配并被下游消费”，它现在的核心问题是“装配完成度强于事实真实性”。  

换句话说，当前系统更像是一个已经跑通的 Stage-0 control plane，而不是一个已经成熟的“高真实性仓库事实编译器”。

---

## 审查步骤

1. 先确认 skill contract 与 machine-first 真源边界。
2. 再拆解 `src/bootstrap-compiler/` 中 machine / human / routing 三段编译链。
3. 再看 `runBootstrap()` 如何真实写盘、回滚、发布 telemetry。
4. 最后核对 `context-routing` 与 `spec-plan` / `spec-work` / `spec-code-review` 如何消费这些产物。
5. 用 unit/e2e 测试判断当前测试是在证明“存在性”，还是已经证明“真实性”。

---

## 1. 为什么这个 skill 对后续流程影响极大

### 1.1 它是 Stage-0 的事实入口，而不是普通文档 skill

`skills/spec-graph-bootstrap/SKILL.md` 已明确把自己定义为 graph-informed 的项目 bootstrap 工作流，并把 Stage-0 的字段 contract 指向 machine-first 真源 `docs/contracts/spec-graph-bootstrap/`，同时把编译职责收敛到 `src/bootstrap-compiler/`。  

证据：

- `skills/spec-graph-bootstrap/SKILL.md:18-32`

这意味着它不是“写一堆上下文文档”的轻技能，而是后续 workflow 的输入编译层。

### 1.2 下游 `plan/work/review` 明确把它的产物当成最高优先级 machine context

`spec-plan` 明确要求优先读取：

- `minimal-context/plan.json`
- `architecture/module-map.md`
- `code-facts/public-entrypoints.md`

并且把 `required_verifications` 视为 verification summary。  

证据：

- `skills/spec-plan/SKILL.md:78-90`

`spec-work` 明确要求优先读取：

- `minimal-context/work.json`
- `code-facts/test-map.md`
- `context-packs/review-change.md`

并将 `required_verifications`、`optional_verifications`、`verification_gate_state` 等视为本次执行的验证基线。  

证据：

- `skills/spec-work/SKILL.md:37-55`
- `skills/spec-work/SKILL.md:85-91`

`spec-code-review` 明确要求优先读取：

- `minimal-context/review.json`
- `code-facts/high-risk-modules.md`
- `code-facts/test-map.md`
- `context-packs/review-change.md`

并把 `verification_gaps_to_check` 作为本次 review 的有效 gap checklist。  

证据：

- `skills/spec-code-review/SKILL.md:27-45`

### 1.3 运行时评估器会把这些产物直接提升为 L0 / L1 决策输入

`src/context-routing/evaluator.js` 的逻辑很直接：

- 如果 `artifact-manifest.json` 不存在或 `status !== complete`，直接退化到 `L3`
- 如果 `routing` 存在，就按 `always + stage assets + selection_rules` 选资产
- 如果目标 stage 的 `minimal-context/*.json` 存在，就把它放到最前面
- 如果 `minimal-context` 存在，最终会给出 `L0`
- 如果只缺 `minimal-context`，才退成 `L1`

证据：

- `src/context-routing/evaluator.js:74-145`

这说明 `spec-graph-bootstrap` 不是“可有可无的补充上下文”，而是后续 workflow 进入 L0 决策模式的核心前提。

### 1.4 `workspace-compiler` 继续把这批 Stage-0 产物扩散到单仓和多仓场景

`src/bootstrap-compiler/workspace-compiler.js` 在 single-repo 与 workspace 两条路径里，都会输出：

- `selected_assets`
- `verification_summary`
- `verifier_dispatch`
- `verification_evidence`
- `verification_gate_state`

证据：

- `src/bootstrap-compiler/workspace-compiler.js:71-112`
- `src/bootstrap-compiler/workspace-compiler.js:158-215`

所以这个 skill 的质量问题不是局部问题，而是会沿着 `bootstrap -> context-routing -> plan/work/review` 整条链条放大。

---

## 2. 这个 skill 的内部逻辑，代码事实拆解

## 2.1 合同层：定义了很高的目标

从 `SKILL.md` 看，这个 skill 宣称的主链是：

1. CRG readiness detection
2. AST-grade fact extraction
3. task planning
4. document generation
5. route generation

证据：

- `skills/spec-graph-bootstrap/SKILL.md:1-32`

这个目标方向是对的，也符合“轻 contract + 高质量输入”的系统定位。

## 2.2 编排层：真实执行链是 machine -> human -> routing

`src/bootstrap-compiler/orchestrator.js` 把主流程收敛为三段：

1. `compileMachineArtifacts()`
2. `compileHumanAssets()`
3. `compileRouting()`

只要三段都没抛错，就返回：

- `status: 'complete'`
- `stages: success`

证据：

- `src/bootstrap-compiler/orchestrator.js:19-62`

这里的关键问题是：这个 `complete` 目前表达的是“编译链执行完了”，不是“真实仓库事实已经充分抽取完了”。

## 2.3 machine artifacts：这一段是当前最有价值的真分析部分

`compileMachineArtifacts()` 并不只是 sample，它至少做了三件真实有价值的事：

- 基于 `factInventory + testSurface` 生成 `verification_profile`
- 基于 `factInventory + riskSignals + testSurface + verificationProfile` 生成 `minimal_context.plan/work/review`
- 基于 manifest / assets 生成 `freshness`、`lint_report`、`contradictions`

证据：

- `src/bootstrap-compiler/compile-machine-artifacts.js:10-65`

而 `compile-minimal-context.js` 也确实把 LLM 真正需要的决策输入压缩进去了，例如：

- `platform_focus`
- `entrypoint_focus`
- `module_focus`
- `candidate_tests`
- `required_verifications`
- `optional_verifications`
- `verification_gaps_to_check`

证据：

- `src/bootstrap-compiler/compile-minimal-context.js:55-84`
- `src/bootstrap-compiler/compile-minimal-context.js:86-115`
- `src/bootstrap-compiler/compile-minimal-context.js:117-157`

这是当前这条链最值得保留和继续增强的部分，因为它已经在做“给 LLM 更好的决策输入”这件事。

## 2.4 但 machine artifacts 里仍然混入了 sample manifest 依赖

`compileMachineArtifacts()` 的 `manifest` 参数默认值来自 `buildArtifactManifestSample()`。  

证据：

- `src/bootstrap-compiler/compile-machine-artifacts.js:16-20`

而 `orchestrator.js` 在调用 `pipeline.machine()` 时并没有传入真实 manifest。  

证据：

- `src/bootstrap-compiler/orchestrator.js:33-43`

这会带来两个后果：

1. `freshness` 可能建立在 sample manifest 的 `graph_last_built` 与 sample `inputs` 上。
2. machine 侧控制面会默认继承 sample manifest 的时间、依赖、schema 描述。

这不是小问题，因为它会让“控制面看起来完整”与“控制面真实反映了当前仓库状态”混在一起。

## 2.5 human assets：目前几乎没有真正“生成高质量文档”

`compileHumanAssets()` 当前做的只是把 `contextAssets` 做两次路径过滤：

- `.md/.yaml` 进入 `generated_assets`
- `architecture/` 或 `code-facts/` 前缀进入 `docs_assets`

证据：

- `src/bootstrap-compiler/compile-human-assets.js:3-10`

它并没有：

- 基于 `factInventory` 生成 `module-map`
- 基于 `entrypoints` 生成 `public-entrypoints`
- 基于 `riskSignals` 生成 `high-risk-modules`
- 基于 `testSurface` 生成 `test-map`

也就是说，human assets 这一段当前更像“声明哪些文档资产应该存在”，而不是“从事实中生成这些文档”。

## 2.6 routing：当前仍明显是 sample 装配

`compileRouting()` 直接调用：

- `buildContextRoutingSample()`
- `buildArtifactManifestSample()`
- `buildInjectionIndexSample()`

证据：

- `src/bootstrap-compiler/compile-routing.js:3-15`

而 `sample-generator.js` 硬编码了大量关键控制面内容，例如：

- `context-routing.json` 的 `always`、`stages`、`selection_rules`
- `artifact-manifest.json` 的 `status: complete`
- `artifact-manifest.inputs.crg.node_count / edge_count / last_build_commit`
- `verification-profile` sample
- `injection-index`

证据：

- `src/bootstrap-compiler/sample-generator.js:8-58`
- `src/bootstrap-compiler/sample-generator.js:61-228`
- `src/bootstrap-compiler/sample-generator.js:231-300`
- `src/bootstrap-compiler/sample-generator.js:303-320`

这说明 routing/control plane 的大块内容目前还是“确定性样板生成”，而不是“根据本次真实分析结果编译”。

## 2.7 runBootstrap：真实写盘链路会把默认上下文写成完整产物

`runBootstrap()` 的默认 `contextAssets` 是固定集合：

- `00-summary.md`
- `README.md`
- `architecture/module-map.md`
- `code-facts/public-entrypoints.md`
- `code-facts/test-map.md`
- `code-facts/high-risk-modules.md`
- `pitfalls/index.md`
- `context-packs/review-change.md`
- `injection-index.yaml`

证据：

- `src/bootstrap-compiler/run-bootstrap.js:31-40`
- `src/bootstrap-compiler/run-bootstrap.js:414-429`

而 `writeContextArtifacts()` 会把 `DEFAULT_CONTEXT_DOCS` 与调用方传入的 `contextDocs` merge 后全部写盘。  

证据：

- `src/bootstrap-compiler/run-bootstrap.js:85-96`

这意味着当调用方没有提供真实 `contextDocs` 时，系统依然会写出一整套“看起来完整”的文档骨架。

## 2.8 control plane 里还有若干无条件 sample 治理产物

`writeControlPlaneArtifacts()` 会无条件写出：

- `ownership.json`，来源于 `buildOwnershipRegistrySample()`
- `review-queue.json`，来源于 `buildReviewQueueSample()`

证据：

- `src/bootstrap-compiler/run-bootstrap.js:56-83`

这些文件如果没有 provenance/fallback 语义，就很容易被误解为真实分析产物。

## 2.9 evaluator 现在只判断“可消费”，不会判断“是否足够真实”

`loadBootstrapRuntimeState()` 只是安全读取：

- `context-routing.json`
- `artifact-manifest.json`
- `freshness.json`
- `verification-profile.json`

证据：

- `src/context-routing/loader.js:36-46`

`evaluateContext()` 的判断重点是：

- manifest 是否 `complete`
- routing 是否存在
- 资产文件是否存在
- minimal-context 是否存在

它并不会检查：

- 这些文档是 sample 还是真分析生成
- manifest 的 `inputs.crg` 是否来自当前仓库
- human docs 是否有真实证据支撑

证据：

- `src/context-routing/evaluator.js:74-145`

这正是当前“装配完成度强于事实真实性”的根因之一。

---

## 3. 当前产物质量判断

## 3.1 可以明确肯定的部分

### A. 控制面 contract 已经开始收敛

skill 文本已经把 contract 真源明确指向 `docs/contracts/spec-graph-bootstrap/`，说明系统方向是 machine-first，而不是 prompt-only。  

证据：

- `skills/spec-graph-bootstrap/SKILL.md:18-32`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:54-59`

### B. minimal context 的字段设计对下游 LLM 决策确实有用

`plan/work/review` 三套 minimal context 都在提供“高密度、低噪音”的决策输入，而不是把整份仓库上下文一股脑塞给模型。  

证据：

- `src/bootstrap-compiler/compile-minimal-context.js:55-165`

### C. 运行时降级语义已经存在

系统不是全有或全无。`evaluateContext()` 会根据 manifest、routing、minimal-context 的存在情况给出 `L0/L1/L2/L3` 与 `fallback_reason`。  

证据：

- `src/context-routing/evaluator.js:63-145`

这符合“轻 contract + 明确边界”的设计方向。

## 3.2 明确存在的质量短板

### A. `complete` 语义过宽

只要 `machine -> human -> routing` 三段没报错，orchestrator 就返回 `status: complete`。  

证据：

- `src/bootstrap-compiler/orchestrator.js:33-62`

但这不等于：

- 真实图已准备好
- 真实入口点已抽取
- 真实测试映射已完成
- 真实文档已生成

### B. sample 和真实分析仍混在同一控制面里

当前 sample 不是只存在于测试夹具，而是直接进入运行时代码路径：

- `compileMachineArtifacts()` 默认 sample manifest
- `compileRouting()` 默认 sample routing / manifest / injection index
- `writeControlPlaneArtifacts()` 默认 sample ownership / review queue
- `writeContextArtifacts()` 默认写入一组骨架 markdown

证据：

- `src/bootstrap-compiler/compile-machine-artifacts.js:16-20`
- `src/bootstrap-compiler/compile-routing.js:9-14`
- `src/bootstrap-compiler/run-bootstrap.js:56-96`

### C. human assets 的“真值生产能力”明显不足

human assets 当前没有从事实对象编译出文档内容，更多只是把应存在的文档路径组织出来。  

证据：

- `src/bootstrap-compiler/compile-human-assets.js:3-10`

### D. 下游消费口径已经比上游产物真实性更“认真”

`spec-plan`、`spec-work`、`spec-code-review` 已经把 minimal context 和 verification summary 当成高优先级 machine context 使用。  

证据：

- `skills/spec-plan/SKILL.md:80-90`
- `skills/spec-work/SKILL.md:39-53`
- `skills/spec-code-review/SKILL.md:29-44`

这会导致一个结构性风险：下游消费足够认真，但上游输入仍然部分样板化。

---

## 4. 高优先级问题清单

## P0. “控制面完成”与“事实编译完成”没有显式分离

影响：

- 下游可能把 sample 驱动的完整控制面当成真实 Stage-0
- `evaluateContext()` 可能给出 `L0`，但这只是“资产齐了”，不是“事实真了”

代码依据：

- `src/bootstrap-compiler/orchestrator.js:33-62`
- `src/context-routing/evaluator.js:74-145`

## P0. routing / manifest 仍主要由 sample generator 生成

影响：

- `artifact-manifest.json` 的 `status`、`inputs`、`outputs` 带有很强的模板色彩
- 运行时选择逻辑建立在样板 manifest 之上

代码依据：

- `src/bootstrap-compiler/compile-routing.js:9-14`
- `src/bootstrap-compiler/sample-generator.js:61-228`

## P0. 默认 human docs 会让“存在性”掩盖“真实性”

影响：

- 即便没有真实文档生成逻辑，也会写出 `module-map`、`public-entrypoints`、`test-map` 等固定文件
- 这会抬高 L0 评估概率，掩盖信息质量不足

代码依据：

- `src/bootstrap-compiler/run-bootstrap.js:31-40`
- `src/bootstrap-compiler/run-bootstrap.js:85-96`

## P1. machine artifacts 的 freshness / manifest 输入仍可能受 sample 默认值污染

影响：

- freshness 与 control plane 元数据可能无法忠实表达当前 repo 的真实状态

代码依据：

- `src/bootstrap-compiler/compile-machine-artifacts.js:16-20`
- `src/bootstrap-compiler/orchestrator.js:33-43`

## P1. 当前测试更强地证明“可装配、可回滚、可消费”，没有同强度证明“事实足够真”

当前测试重点包括：

- orchestrator 顺序正确
- compileRouting 输出与 sample 一致
- runBootstrap 能写出主链产物
- evaluator 能读到 `L0`
- e2e 检查 required artifacts 是否存在

证据：

- `tests/unit/spec-graph-bootstrap-compiler.test.js:56-80`
- `tests/unit/spec-graph-bootstrap-compiler.test.js:139-146`
- `tests/unit/spec-graph-bootstrap-compiler.test.js:148-174`
- `tests/e2e/spec-graph-bootstrap-mainline.sh:28-78`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:86-114`

这组测试很有价值，但它们当前主要证明的是“控制面可以稳定生成与消费”，不是“输出内容足以支撑高质量 LLM 决策”。

---

## 5. 该怎么优化，优先级排序

以下优化建议遵循同一原则：不要把系统改造成重状态机，而是提升 contract 诚实度、边界清晰度和 LLM 可用输入质量。

## 5.1 优先级 1：把“装配成功”与“事实可信”分开表示

建议改动：

- 将当前单一 `status: complete` 拆成至少两层语义：
  - `assembly_status`
  - `evidence_status`
- 为 manifest 增加例如：
  - `truth_level: sample-backed | analyzer-backed | mixed`
  - `fallback_reason`
  - `missing_analyzers`
  - `coverage_summary`

原因：

- 现在的 `complete` 对下游过于乐观。
- LLM 不怕降级，怕被误导。

建议验收标准：

- 当 `routing` 主要来自 sample 时，`truth_level` 不能仍显示为 analyzer-backed
- 当 human docs 只写了默认骨架时，manifest 必须暴露 `evidence_status: skeletal`
- `evaluateContext()` 不应仅凭文件存在就给出 `L0`

## 5.2 优先级 2：让 routing/manifest 从真实分析结果编译，而不是直接 sample 生成

建议改动：

- `compileRouting()` 改为接收真实的：
  - `factInventory`
  - `riskSignals`
  - `testSurface`
  - `verificationProfile`
  - `availableAssets`
- `artifact-manifest.inputs` 应来自本次运行真实输入，而不是 sample 常量
- `outputs` 可以保留 schema-driven 声明，但要额外标出每个输出的 provenance

原因：

- 这是 control plane 的中心文件。
- 只要 manifest 还是样板，L0/L1 判定就会持续偏乐观。

建议验收标准：

- 修改同一仓库输入后，manifest `inputs` 会发生合理变化
- `selection_rules` 对应的 asset existence 与 provenance 一致
- `graph_last_built`、`node_count`、`edge_count` 不再来自 sample 常量

## 5.3 优先级 3：把 human docs 从“路径骨架”升级到“事实投影”

建议改动：

- `compileHumanAssets()` 不只返回路径分类，还要真正生成文档内容
- 每个关键文档至少带三类元数据：
  - `provenance`
  - `confidence`
  - `updated_at`

推荐优先增强：

- `architecture/module-map.md`
- `code-facts/public-entrypoints.md`
- `code-facts/test-map.md`
- `code-facts/high-risk-modules.md`

原因：

- 这些正是下游 workflow 的高频输入。
- 现在的“骨架默认写盘”太容易制造假完整感。

建议验收标准：

- 关键文档正文不再是默认占位文本
- 文档至少包含可回溯事实片段，例如文件路径、符号名、测试命令、风险来源
- 文档头部能清楚标识是 analyzer-backed 还是 fallback-generated

## 5.4 优先级 4：给 minimal context 加强 provenance 与 freshness

建议改动：

- 在 `minimal-context/*.json` 中补充：
  - `source_provenance`
  - `fact_coverage`
  - `freshness_status`
  - `confidence`

原因：

- 下游最信任的是 minimal context。
- 既然它是高优先级 machine context，它就应该自带“我为什么值得信”的元信息。

建议验收标准：

- `spec-plan` / `spec-work` / `spec-code-review` 可以直接读取这些元字段
- 当来源不足时，下游 prompt 能自然降级，而不是继续高信任引用

## 5.5 优先级 5：收紧 evaluator 的 L0 判定

建议改动：

- `L0` 不应只依赖：
  - manifest complete
  - routing exists
  - minimal-context exists
- 应新增至少一项真实性门，例如：
  - minimal context `confidence >= medium`
  - 关键 docs 非 skeletal
  - manifest `truth_level !== sample-backed`

原因：

- 当前 L0 太容易拿到。
- 这会让下游误判 bootstrap 质量。

建议验收标准：

- 纯 sample / 纯默认骨架产物只能得到 `L1` 或 `L2`
- 只有 analyzer-backed 的关键资产满足阈值时才进入 `L0`

## 5.6 优先级 6：补“真实性测试”，而不仅是“存在性测试”

建议增加测试类型：

- 输入变化会驱动 `minimal-context` 焦点变化
- 缺失 `entrypoints` 时 `plan` 上下文会显式降级
- human docs 不是默认模板文本
- sample fallback 会在 manifest/provenance 中显式暴露
- evaluator 遇到 skeletal assets 时不会误判为 `L0`

原因：

- 当前测试已经证明系统稳定性不错。
- 下一阶段最缺的是“质量门”测试，而不是“还能不能跑通”测试。

建议验收标准：

- 新增单测覆盖“truth_level / provenance / fallback_reason”契约
- e2e 不只检查文件存在，还检查关键字段和内容质量

---

## 6. 建议新增的“产物质量门”

如果希望这个 skill 真正成为“给 LLM 提供高质量决策输入”的上游基础设施，建议在 contract 里增加以下质量门。

## 6.1 每个关键产物都要回答 4 个问题

1. 我是谁生成的？
2. 我基于哪些事实？
3. 我有多新？
4. 我有多可信？

建议覆盖对象：

- `artifact-manifest.json`
- `context-routing.json`
- `verification-profile.json`
- `minimal-context/*.json`
- `code-facts/*.md`
- `architecture/module-map.md`

## 6.2 关键字段建议

- `provenance`
- `confidence`
- `freshness_status`
- `fallback_reason`
- `coverage_gaps`
- `evidence_refs`

## 6.3 下游使用规则建议

- `spec-plan` 遇到 `truth_level=mixed` 时，应把计划表达改为“假设 + 待验证”，而不是“已知事实”
- `spec-work` 遇到 `skeletal docs` 时，应优先补验证证据而不是盲写代码
- `spec-code-review` 遇到低置信 `risk_signals` 时，应把它当 review hint，而不是事实断言

---

## 7. 最终判断

`spec-graph-bootstrap` 当前已经证明了一件非常重要的事：`spec-first` 可以拥有一个稳定的 Stage-0 控制面，并让下游 workflow 用统一 contract 消费它。  

但它还没有完全证明另一件更关键的事：这套控制面里的事实已经足够真实、足够新、足够可追溯，足以作为 LLM 的高信任决策输入。

因此，后续优化重点不应该是把它改造成更重的流程编排器，而应该是继续沿着下面这条主线推进：

- 轻 contract
- 明确边界
- 让 LLM 决策
- 但必须提供更高质量、更诚实、更可追溯的决策输入

这是当前这条 skill 链最有价值、也最应该投入的方向。

---

## 附：本次重点证据文件

- `skills/spec-graph-bootstrap/SKILL.md`
- `src/bootstrap-compiler/orchestrator.js`
- `src/bootstrap-compiler/compile-machine-artifacts.js`
- `src/bootstrap-compiler/compile-minimal-context.js`
- `src/bootstrap-compiler/compile-human-assets.js`
- `src/bootstrap-compiler/compile-routing.js`
- `src/bootstrap-compiler/sample-generator.js`
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/context-routing/loader.js`
- `src/context-routing/evaluator.js`
- `src/bootstrap-compiler/workspace-compiler.js`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `tests/unit/spec-graph-bootstrap-compiler.test.js`
- `tests/unit/spec-graph-bootstrap-contracts.test.js`
- `tests/e2e/spec-graph-bootstrap-mainline.sh`
