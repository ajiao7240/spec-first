# 01 Codebase Map

## A. 审查范围与覆盖证明

### 已覆盖目录

#### 源码真源
- `src/cli/`
- `src/bootstrap-compiler/`
- `src/context-routing/`
- `src/crg/`

#### 工程与发布
- `bin/`
- `scripts/`
- `package.json`

#### 测试
- `tests/unit/`
- `tests/smoke/`
- `tests/integration/`
- `tests/e2e/`

#### workflow / prompt 资产
- `skills/`
- `agents/`
- `templates/`
- `.claude-plugin/`

#### 文档 / 契约 / 知识资产
- `docs/contracts/`
- `docs/solutions/`
- `docs/contexts/`
- `docs/10-prompt/`

### 排除内容
- `vendor/`：第三方受控依赖，不纳入核心代码质量裁决
- runtime 副本目录：`.claude/`、`.codex/`、`.agents/skills/`，除非用于边界证明，不作为源码真源
- `.git/`、临时 worktree 与缓存输出

### 为什么不是抽查

本次结论不是基于 README 或少数入口文件，而是基于：

1. 先建立全量目录地图；
2. 对四个源码主层分别亲读关键模块；
3. 结合工程链路、测试链路、资产治理层、Stage-0 样本与 contract tests 做交叉验证；
4. 使用多 agent 分别覆盖代码事实、工程质量、资产治理、外部实践、哲学辩论；
5. 主协调器再亲读 agent 指向的关键证据文件。

### 本轮已亲读的关键代码/资产证据

#### CLI 与运行时治理
- `src/cli/index.js:10-49`
- `src/cli/commands/init.js:52-303`
- `src/cli/commands/doctor.js:30-103,105-217,219-360`
- `src/cli/commands/clean.js:23-102,150-226`
- `src/cli/plugin.js:111-352`
- `src/cli/state.js:16-315`
- `src/cli/adapters/claude.js:12-177`
- `src/cli/adapters/codex.js:15-236`

#### Bootstrap / Context Routing
- `src/bootstrap-compiler/run-bootstrap.js:31-119,122-173,193-315`
- `src/context-routing/loader.js:14-62`
- `src/context-routing/evaluator.js:149-284`
- `src/context-routing/entry-resolver.js:73-346`
- `src/context-routing/workspace-loader.js:54-276`
- `src/context-routing/verification-summary.js:196-360`

#### CRG
- `src/crg/cli/router.js:6-171`
- `src/crg/cli/build.js:180-340`
- `src/crg/commands/review-context.js:41-305`
- `src/crg/graph.js:142-360`

#### 工程与测试
- `package.json:1-98`
- `bin/postinstall.js`
- `scripts/release-publish.cjs`
- `tests/smoke/cli.sh`
- `tests/smoke/install-tarball.sh`
- `tests/smoke/release-dual-host-governance.sh`
- `tests/unit/clean-dry-run.test.js`
- `tests/unit/doctor-json-contract.test.js`

#### 哲学与资产治理
- `docs/10-prompt/项目角色.md:7-22,42-63`
- `skills/spec-graph-bootstrap/SKILL.md`
- `docs/contexts/spec-first/00-summary.md`
- `docs/contexts/spec-first/code-facts/high-risk-modules.md`
- `docs/contexts/spec-first/code-facts/test-map.md`

## B. 项目全量代码地图

### 1. 源码层

#### `src/cli/`
职责：package CLI 控制面、manifest/governance、adapter/runtime sync、state 管理、doctor/init/clean/stage0-context。

关键文件：
- `src/cli/index.js`
- `src/cli/commands/init.js`
- `src/cli/commands/clean.js`
- `src/cli/commands/doctor.js`
- `src/cli/plugin.js`
- `src/cli/state.js`
- `src/cli/adapters/claude.js`
- `src/cli/adapters/codex.js`

#### `src/bootstrap-compiler/`
职责：把 bootstrap 事实编译成 machine artifacts、minimal context、routing 与 workspace overview，并负责写盘/回滚。

关键文件：
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/workspace-compiler.js`
- `src/bootstrap-compiler/workspace-registry.js`
- `src/bootstrap-compiler/orchestrator.js`
- `src/bootstrap-compiler/rollback.js`

#### `src/context-routing/`
职责：读取 bootstrap 运行产物，解析 single-repo/workspace 入口，评估上下文质量，输出 verification summary / dispatch posture。

关键文件：
- `src/context-routing/entry-resolver.js`
- `src/context-routing/loader.js`
- `src/context-routing/evaluator.js`
- `src/context-routing/workspace-loader.js`
- `src/context-routing/verification-summary.js`

#### `src/crg/`
职责：代码事实图构建、增量更新、查询、review context、retrieval、risk 分析。

关键文件：
- `src/crg/cli/router.js`
- `src/crg/cli/build.js`
- `src/crg/parser.js`
- `src/crg/graph.js`
- `src/crg/input-convergence.js`
- `src/crg/commands/review-context.js`

### 2. 脚本层

- `bin/spec-first.js`：顶层 CLI 二次分发
- `bin/postinstall.js`：native module 修复链与安装提示
- `scripts/release-publish.cjs`：发布链路
- `scripts/run-ai-dev-quality-gate.js`：AI dev quality gate 汇总

### 3. 测试层

- `tests/unit/`：contract、state、routing、runtime drift、Stage-0、CRG 局部行为
- `tests/smoke/`：CLI 可用性、安装、本地/tarball、release governance
- `tests/integration/`：verification gate 与流程拼接
- `tests/e2e/`：CRG 与 spec-graph-bootstrap 端到端

### 4. workflow 资产层

- `skills/`：source-of-truth 的 workflow/skill 资产
- `agents/`：review/research/document/workflow agent profiles
- `templates/claude/commands/spec/`：Claude command 模板
- `.claude-plugin/plugin.json`：plugin manifest 与 command-backed workflow 清单

### 5. docs / knowledge 层

- `docs/contracts/`：machine-readable contract 真源
- `docs/solutions/`：知识复用真源
- `docs/contexts/`：bootstrap 产物与 `spec-first` 自举样本
- `docs/10-prompt/`：prompt mirror 与项目哲学基线

### 6. generated / vendor / runtime copy 边界层

- `vendor/`：受控 tree-sitter 第三方依赖
- `.claude/` / `.codex/` / `.agents/skills/`：runtime copy，不是源码真源
- `.spec-first/workflows/`：运行产物与 evidence，不是源码真源

## C. 关键架构关系图（文字版）

1. `skills/agents/templates/.claude-plugin` 是源资产与治理真源
2. `src/cli/*` 把这些真源安装/同步到 Claude/Codex runtime
3. `src/bootstrap-compiler/*` 为仓库生成 Stage-0 control plane 与 context docs
4. `src/context-routing/*` 在 workflow 执行前消费这些 control plane 产物，给 LLM 提供更高质量输入
5. `src/crg/*` 作为代码事实层，为 bootstrap 与 review 提供结构化代码信号

## D. 关键热点

### 共享枢纽
- `src/cli/commands/init.js`
- `src/cli/commands/doctor.js`
- `src/bootstrap-compiler/workspace-compiler.js`
- `src/crg/cli/build.js`
- `src/crg/commands/review-context.js`
- `src/crg/graph.js#resolveEdges`

### 治理热点
- `src/cli/plugin.js`
- `src/cli/state.js`
- `src/cli/adapters/claude.js`
- `src/cli/adapters/codex.js`
- `docs/10-prompt/` 与 `skills/` 的 mirror 同步
- `docs/contexts/spec-first/` 的样本化生成产物角色
