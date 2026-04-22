# 03 Critical Flow Review

## 1. 安装链路

### 代码事实
- `package.json:27` 指向 `postinstall`
- `bin/postinstall.js` 负责 native probe -> prebuild -> node-gyp -> hint
- `package.json:69-71` 把 `better-sqlite3` 放入 `optionalDependencies`
- `package.json:14-27` 说明安装后至少还有 `doctor`、`init`、`clean`、`test:release` 等工程闭环配套脚本

### 判断
- 安装链路接近最佳实践：核心 CLI 与可选 native 能力解耦，失败时能降级。
- 风险在于 repair 分支的故障注入验证仍不够强。

## 2. 初始化链路

### 代码事实
- `src/cli/index.js:35-37` 路由到 `runInit`
- `src/cli/commands/init.js:72-151,153-246,249-303` 依次处理 adapter/manifest/governance/state/drift/plan/apply/rollback
- `init` 支持 dry-run 与 destructive reset rollback：`src/cli/commands/init.js:166-186,198-218,249-264`

### 判断
- `init` 是确定性控制面的主链核心，设计成熟度高。
- 但它也是共享枢纽最重的文件之一，未来应避免继续吸纳更多跨层职责。

## 3. 清理链路

### 代码事实
- `src/cli/index.js:39-41` 路由到 `runClean`
- `src/cli/commands/clean.js` 读 managed state，legacy state 拒绝直接清理，保留 custom assets
- dry-run 会预览 remove/update 边界

### 判断
- `clean` 的边界比 `init` 更健康，是较成熟的 plan/apply 模式。

## 4. doctor / diagnostics 链路

### 代码事实
- `src/cli/index.js:31-33` 路由到 `runDoctor`
- `doctor.js` 汇总 runtime assets、plugin/developer/state、bootstrap contract、verification evidence/summary、CRG readiness

### 判断
- `doctor` 已从“安装检查器”演化为“全栈 diagnostics 汇总器”。
- 这是优势，但必须守住只读观察边界。

## 5. bootstrap / graph-bootstrap 链路

### 代码事实
- `src/bootstrap-compiler/run-bootstrap.js` 负责 control plane/context docs/workspace overview 写盘与 rollback
- 产物包含 `artifact-manifest.json`、`freshness.json`、`verification-profile.json`、`minimal-context/*`、`injection-index.yaml`
- `docs/contexts/spec-first/` 作为自举样本纳入版本控制

### 判断
- 这是仓库最重要的 deterministic compiler pipeline 之一。
- 产物面很完整，且与下游 Stage-0 消费衔接紧密。
- 风险是 workspace 模式、sample 基线、runtime 产物三者的同步成本持续上升。

## 6. Stage-0 / context-routing 链路

### 代码事实
- `entry-resolver.js`：workspace/single-repo/fallback 入口决议
- `loader.js`：runtime state 装载
- `evaluator.js`：上下文质量评估
- `workspace-loader.js`：workspace child 聚合
- `verification-summary.js`：verification bundle 组装

### 判断
- 这是仓库中最符合“提高 LLM 输入质量而非增加流程控制”的链路。
- 当前主要风险不是方向，而是聚合器膨胀。

## 7. CRG build 链路

### 代码事实
- `crg router -> cli/build.js -> collectInputFiles -> parseFile -> upsert/resolve -> postprocess`
- `graph.js#resolveEdges` 承担多阶段 target resolution

### 判断
- 这是标准的事实生产 ETL。
- 当前风险在于 `build.js` 与 `resolveEdges` 都已成为大而关键的共享热点。

## 8. review-context 链路

### 代码事实
- `review-context.js` 串联 detectChanges、risk scoring、graph expansion、retrieveContext、changeSurface summary

### 判断
- 这是连接 CRG 事实层与 review 工作流的关键桥梁。
- 它价值高，但最容易逐步演化为“review orchestration brain”。

## 9. 发布链路

### 代码事实
- `scripts/release-publish.cjs` 在非 dry-run 下先写 version，再跑 `test:release -> npm pack -> npm publish`

### 判断
- 发布链路具备真实工件验证意识，但原子性不足，失败恢复不完整，是当前最明显的工程短板之一。

## 10. 关键链路结论

### 强项
- CLI install/clean/doctor 的 deterministic control plane
- bootstrap/context-routing 的事实编译 + 消费设计
- CRG 作为事实层而非流程层

### 薄弱点
- `release-publish.cjs` 的失败恢复
- workspace bootstrap / rollback / prune failure 的故障路径验证
- 多个共享枢纽继续增厚的趋势
