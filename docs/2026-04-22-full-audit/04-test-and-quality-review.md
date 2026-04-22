# 04 Test and Quality Review

## A. 测试结构

### 代码事实
- `package.json:14-27` 定义：`test:unit`、`test:smoke`、`test:integration`、`test:e2e:crg`、`test:release`、`test:ai-dev:gate`
- smoke 覆盖 CLI/install/runtime wiring：`tests/smoke/cli.sh`、`tests/smoke/install-local.sh`、`tests/smoke/install-tarball.sh`
- integration 覆盖 verification gate 与 e2e：`tests/integration/verification-gate.integration.test.js`、`tests/integration/e2e.sh`
- e2e 覆盖 CRG 与 graph-bootstrap：`tests/e2e/spec-graph-bootstrap-mainline.sh`、`tests/e2e/spec-graph-bootstrap-installed-runtime.sh`
- unit 包含 contract test、runtime drift、docs/solutions frontmatter、Stage-0 contracts 等，典型证据有 `tests/unit/doctor-json-contract.test.js`、`tests/unit/clean-dry-run.test.js`

### 判断
- 测试分层明显优于普通 CLI 项目，已经具备产品级测试塔。

## B. 工程成熟度

### 代码事实
- `init/clean` 的 dry-run 与 apply 共享 operation plan 体系
- `doctor` 已具备 evidence schema/freshness/fallback_reason 等事实层诊断字段
- bootstrap 有 backup/restore
- tarball install smoke 与 dual-host governance smoke 表明发布工件验证较强

### 判断
- 工程成熟度总体高。
- 项目不是“写完脚本就发布”，而是对 runtime drift、contract drift、tarball 真机安装有明确治理。

## C. 风险断层

### 1. 发布失败恢复
#### 代码事实
- `scripts/release-publish.cjs` 先改 version，再测试/打包/发布

#### 判断
- 一旦中途失败，工作树会停在半收口状态，是当前最高风险工程断层之一。

### 2. postinstall repair 分支验证不足
#### 代码事实
- `bin/postinstall.js` 有三阶段修复链，但 smoke 更偏结果验证，不是逐分支故障注入

#### 判断
- 主路径可用，但 repair 策略的行为回归保护还不够硬。

### 3. rollback 真触发路径验证不足
#### 代码事实
- bootstrap 与 init 都有 rollback/restore 逻辑

#### 判断
- 设计成熟，但失败注入测试不足，导致“设计上安全”强于“验证上安全”。

### 4. workspace prune failure 验证不足
#### 代码事实
- `run-bootstrap.js` 设计了 `prunedChildSlugs` / `failedPrunes`

#### 判断
- 这是典型故障边界，但未见足够强的 contract-level failure test 证据。

## D. 工程质量结论

### 已接近最佳实践
- 分层测试结构
- dry-run/apply 同构
- diagnostics 事实层输出
- tarball / dual-host install 验证
- rollback 设计意识

### 仍只是当前可用
- release 原子性
- postinstall repair 分支验证
- rollback 故障注入验证
- workspace prune failure 验证

## E. 建议

### 应保留
- 现有测试塔结构
- contract drift / runtime integrity tests

### 应强化
- release failure tests
- rollback failure injection
- postinstall repair branch tests
- workspace prune failure contract tests

### 应轻量化
- 若某些 contract tests 只是重复验证同一语义，可收口重复面

### 应重构
- `scripts/release-publish.cjs`

### 应实验化
- 更细粒度 evidence-to-verdict 追踪，帮助 diagnostics 与 review 共享事实基础
