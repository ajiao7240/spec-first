# 05 Best Practice Debate

## 角色 A：系统哲学守护者

### 支持意见
- `docs/10-prompt/项目角色.md:7-22,42-63` 把 `Light contract / Explicit boundaries / Let the LLM decide` 作为强制哲学基线。
- `src/context-routing/evaluator.js:233-264` 输出的是 `level/fallback_reason/confidence/provenance` 等事实，而不是硬状态机。
- `skills/spec-graph-bootstrap/SKILL.md` 明确区分 source repo internals / runtime assets / generated artifacts / package CLI surfaces，边界意识很强。

### 反对意见
- 项目为了捍卫“轻 contract”，实际上正在维护越来越多 contract / mirror / sample / runtime 投影层。
- 这与“单一真相源、减少编排层”的长期方向存在张力。

### 裁决
- 哲学方向正确，但必须主动削减表达层数量，否则会在形式上坚持轻量，实质上变重。

## 角色 B：代码实现审查官

### 支持意见
- CLI 根入口薄：`src/cli/index.js:10-49`
- `state.js` 把 operation plan、managed state、asset removal 收口为共享工具：`src/cli/state.js:16-315`
- context-routing 的 resolver / loader / evaluator 拆分非常清晰。
- CRG 主要生产代码事实，而不是直接做流程编排。

### 反对意见
- `src/cli/commands/init.js`
- `src/bootstrap-compiler/workspace-compiler.js`
- `src/crg/cli/build.js`
- `src/crg/commands/review-context.js`
- `src/crg/graph.js#resolveEdges`

这些都已是明显的大热点协调器，继续膨胀会降低可维护性。

### 裁决
- 当前实现大体稳健，但已来到“必须主动拆热点”的阶段。

## 角色 C：可维护性与质量保证审查官

### 支持意见
- `package.json` 显示完整的测试塔与质量门。
- tarball install、release governance、Stage-0 contracts、runtime integrity tests 都说明项目有较强质量自觉。
- diagnostics 已输出 evidence schema/freshness/fallback_reason，而不是单一状态值。

### 反对意见
- 质量守护面也在变成维护税：source / mirror / sample / runtime 的同步测试越来越多。
- 发布失败恢复、postinstall repair 分支、rollback 真触发路径的验证仍不够强。

### 裁决
- 工程质量高，但还未达到“失败路径与主路径同等有证据”的水平。

## 角色 D：演化与集成裁判

### 支持意见
- 项目正在形成“CLI installer + bootstrap compiler + context routing + CRG”这套完整能力链，长期复利很高。
- 对 dual-host delivery、Stage-0、verification signal 的收口，说明它在认真构建可组合平台能力。

### 反对意见
- 产品身份越来越宽：安装器、workflow platform、context compiler、code intelligence substrate 都在同一仓里持续前进。
- 如果默认主路径不及时收口，外部采用叙事会越来越复杂。

### 裁决
- 应继续保留平台演化方向，但必须明确“默认主路径”和“实验能力”的边界。

## 辩论综合结论

### 当前已接近最佳实践的部分
- 哲学被代码与 contract tests 明确落实
- deterministic execution 与 semantic decision 的边界总体清晰
- context-routing/evaluator 的退化显式化做得很好
- runtime install/clean/doctor 的工程成熟度较高

### 只是当前可用、尚不能称为最佳实践的部分
- 多层投影同步维持整体一致
- 复杂度主要由核心维护者吸收
- 发布与失败恢复闭环不够完整

### 与最佳实践相悖或明显存在背离风险的部分
- 共享枢纽持续膨胀
- source / mirror / runtime / sample 表达面过多
- 产品身份扩张快于默认路径收口

### 必须分阶段看待的部分
- workspace/topology/verification/gate 完备度
- 高密度 contract tests 与 mirror 同步
- 平台化能力的默认暴露程度
