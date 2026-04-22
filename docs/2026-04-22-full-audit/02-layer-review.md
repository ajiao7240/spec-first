# 02 Layer Review

## A. CLI 控制面

### 代码事实
- `src/cli/index.js:10-49` 只路由 `doctor/init/clean/stage0-context`
- `src/cli/plugin.js:111-335` 加载并校验 plugin manifest 与 skills governance
- `src/cli/state.js:16-315` 统一 managed state 的读写、plan merge、operation summary、asset removal
- `src/cli/adapters/claude.js:12-177`、`src/cli/adapters/codex.js:15-236` 负责宿主差异、路径布局与内容重写

### 判断
- CLI 根入口边界清晰，符合 light control plane。
- 真正复杂度集中在 `init.js` 与 `doctor.js`：前者是安装/重建协调器，后者是跨层 diagnostics 汇总器。

### 风险
- `init.js` 继续增长会形成“运行时资产全生命周期大脑”
- `doctor.js` 若再引入自动修复或策略裁决，会越过观察边界

## B. Bootstrap Compiler

### 代码事实
- `src/bootstrap-compiler/run-bootstrap.js:31-119,140-173,317-340` 负责编排 control plane/context docs 写盘、workspace overview 与 rollback
- `src/bootstrap-compiler/workspace-compiler.js` 汇总 stage output、workspace child 选择、verification bundle 等

### 判断
- 这层整体职责仍是 deterministic compiler pipeline，方向正确。
- `workspace-compiler.js` 已是最重的 Stage-0 聚合器之一，长期需要进一步显式化中间 contract。

### 风险
- 模式解析、summary merge、dispatch posture、workspace child 选择、最终输出组装集中于少数大文件

## C. Context Routing

### 代码事实
- `entry-resolver.js:73-346`：负责 workspace/single-repo 入口解析
- `loader.js:14-62`：负责 runtime 路径与 JSON 安全读取
- `evaluator.js:149-284`：负责 level/fallback_reason/confidence/provenance/coverage_gaps 评估
- `workspace-loader.js:54-276`：负责 workspace child runtime 聚合
- `verification-summary.js:196-360`：负责 verification summary 与 dispatch posture 组装

### 判断
- 这是本仓库边界最清楚的一层之一。
- `evaluator.js` 是项目哲学落地最好的模块之一：它输出事实信号，而不是强编排结果。

### 风险
- `verification-summary.js` 若继续吸纳更多 stage policy，容易从事实层滑向流程层

## D. CRG 事实层

### 代码事实
- `src/crg/cli/router.js:6-171`：薄路由
- `src/crg/parser.js`：AST/符号/边抽取
- `src/crg/input-convergence.js`：文件收敛、ignore、iOS 适配
- `src/crg/graph.js:142-360`：edge resolution 与 SQLite CRUD
- `src/crg/cli/build.js:180-340`：build orchestration
- `src/crg/commands/review-context.js:41-305`：review context 聚合

### 判断
- CRG 整体仍是事实生产层，而不是编排层，这点非常重要。
- 但 `cli/build.js`、`graph.js#resolveEdges`、`review-context.js` 都是明显的大热点模块。

### 风险
- 新语言、新导入规则、新 review packaging 继续堆入这些热点，会迅速推高维护成本

## E. Workflow / Prompt / 资产治理层

### 代码事实
- `skills/` 是 source-of-truth，这一点由 `src/cli/plugin.js:111-177,337-360` 对 bundled path / governance 的读取方式侧面证明
- `docs/10-prompt/` 是 mirror，这一点由 contract tests 与资产治理审计结果共同证明
- `.claude-plugin/plugin.json` + `skills-governance.json` 共同定义交付治理：`src/cli/plugin.js:111-335`
- `src/cli/adapters/claude.js:52-177`、`src/cli/adapters/codex.js:80-236` 把 source 资产投影到 Claude/Codex runtime
- `docs/contexts/spec-first/` 既是自举样本，也是生成产物基线，这一点由 `docs/contexts/README.md` 与仓库治理说明共同证明

### 判断
- 源资产与 runtime 副本的原则边界清楚。
- 真正的风险在于：source / mirror / runtime / sample 的表达层越来越多，维护税上升。

### 风险
- mirror 与 sample 若不持续收口，会与“单一真相源”哲学形成张力

## F. 文档 / 契约 / 知识层

### 代码事实
- `docs/contracts/` 是 machine-readable contract 真源
- `docs/solutions/` 是知识资产真源
- `docs/contexts/` 承载 bootstrap 产物与自举样本

### 判断
- 文档层不是弱附属，而是系统的一部分。
- 这很强，但也意味着文档治理本身已经成为系统复杂度来源。

## G. 分层结论

### 已符合哲学的部分
- CLI 根入口薄
- loader/evaluator 分层清楚
- CRG 主要生产事实
- bootstrap/compiler 整体仍属于 deterministic execution

### 需要重点防膨胀的部分
- `init.js`
- `doctor.js`
- `workspace-compiler.js`
- `verification-summary.js`
- `cli/build.js`
- `review-context.js`
- `graph.js#resolveEdges`
