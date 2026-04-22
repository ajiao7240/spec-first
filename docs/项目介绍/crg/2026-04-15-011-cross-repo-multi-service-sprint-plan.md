# 多工程 / 微服务联动需求 Sprint 排期计划

> 历史说明：本文是 2026-04-15 的 Sprint 排期记录，文中的 benchmark / `test:crg:gate` 等表述对应当时方案背景；相关 benchmark/gate 已在当前实现中退役，现仅保留为历史排期资料。

**Goal:** 将 [2026-04-15-010-cross-repo-multi-service-implementation-backlog.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-010-cross-repo-multi-service-implementation-backlog.md) 转换为可执行的按周排期计划，供团队按 Sprint 推进 `Level 1` 与 `Level 2` 开发。

**Source of Truth:**
- [2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md)
- [2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md)
- [2026-04-15-010-cross-repo-multi-service-implementation-backlog.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-010-cross-repo-multi-service-implementation-backlog.md)

**Plan Assumption:**
- 以 1 周为一个 Sprint
- 团队至少具备 2-3 个可并行开发角色
- `Level 1` 优先，`Level 2` 不反向阻塞

---

## 1. Sprint 总览

| Sprint | 目标 | 覆盖范围 | 交付结果 |
|---|---|---|---|
| Sprint 1 | 建立开发地基与真源入口 | `E0`, `E1`, `E2`, `E3` | invocation + registry + ownership/boundary |
| Sprint 2 | 建立联动识别主链 | `E4`, `E5`, `E6`, `E7` | Gate A + contract/dependency/impact |
| Sprint 3 | 建立 `Level 1` workflow 闭环 | `E8`, `E9`, `E10` | context + routing + verification |
| Sprint 4 | 完成 `Level 1` 试点验收 | `E11` | acceptance + delta + 上线口径 |
| Sprint 5 | 完成 `Level 2` 结构硬化 | `E12`, `E13` | decomposition + incremental |
| Sprint 6 | 完成 `Level 2` 运行硬化 | `E14`, `E15` | rollback + regression + CI gate |
| Sprint 7 | 推广与运维收口 | `E16` | rollout docs + troubleshooting + pilot template |

说明：

- 如果团队人力有限，可将 `Sprint 6-7` 合并为一个较长周期。
- 如果 `Sprint 4` 验收未通过，`Sprint 5` 不应启动，先回到 `Sprint 2-3` 做返工。

---

## 2. Sprint 1：开发地基与真源入口

### 2.1 Sprint Goal

建立 cross-repo 的最小开发地基与输入真源，让后续所有能力都有稳定的 contract、fixture、invocation、registry、ownership/boundary 基础。

### 2.2 Scope

**Epics:**
- `E0 Baseline & Fixture Foundation`
- `E1 Cross-repo Invocation Contract`
- `E2 Workspace Identity Registry`
- `E3 Ownership & Boundary Registry`

**Stories:**
- `E0-S1`
- `E0-S2`
- `E0-S3`
- `E1-S1`
- `E1-S2`
- `E1-S3`
- `E2-S1`
- `E2-S2`
- `E2-S3`
- `E2-S4`
- `E3-S1`
- `E3-S2`
- `E3-S3`
- `E3-S4`

### 2.3 Sprint Deliverables

1. `docs/contracts/cross-repo/` 目录与规则
2. `docs/fixtures/cross-repo/`、`tests/fixtures/cross-repo/` 目录骨架
3. `tests/unit/cross-repo-coverage-gate.test.js`
4. `tests/e2e/cross-repo-mainline.sh`
5. `docs/contracts/cross-repo/invocation.schema.json`
6. `src/context-routing/cross-repo-invocation.js`
7. `docs/contracts/cross-repo/workspace-repos.schema.json`
8. `src/bootstrap-compiler/workspace-registry.js`
9. `.spec-first/workflows/bootstrap/spec-first/workspace-repos.json`
10. `docs/contracts/cross-repo/service-boundaries.schema.json`
11. `docs/contracts/cross-repo/workspace-ownership.schema.json`
12. `src/bootstrap-compiler/service-boundaries.js`
13. `.spec-first/workflows/bootstrap/spec-first/service-boundaries.json`
14. `.spec-first/workflows/bootstrap/spec-first/workspace-ownership.json`

### 2.4 并行建议

**Track A: Contract / Compiler**
- `E1-S1`
- `E2-S1`
- `E2-S2`
- `E3-S1`
- `E3-S2`
- `E3-S3`

**Track B: Context / Loader**
- `E1-S2`
- `E2-S3`

**Track C: Test / Fixture**
- `E0-S1`
- `E0-S2`
- `E0-S3`
- `E1-S3`
- `E2-S4`
- `E3-S4`

### 2.5 Sprint Exit Criteria

- `Task 00-02` 对应 unit tests 全通过
- 单仓路径兼容未退化
- invocation、registry、ownership/boundary 三类真源都能稳定产出

### 2.6 Verification

- `npx jest tests/unit/cross-repo-invocation.test.js --runInBand`
- `npx jest tests/unit/workspace-registry.test.js --runInBand`
- `npx jest tests/unit/workspace-ownership.test.js --runInBand`
- `npx jest tests/unit/workspace-context.test.js --runInBand`

### 2.7 风险与应对

**Risk 1:** `workspace-loader` 改造破坏现有单仓路径  
**Mitigation:** 必须保留旧 `repoRoots` fallback，先增量接入，不移除旧逻辑

**Risk 2:** ownership / boundary 字段过早扩张  
**Mitigation:** 严格控制为支持 review routing 的最小字段

---

## 3. Sprint 2：联动识别主链

### 3.1 Sprint Goal

建立 `Gate A + contract extraction + dependency index + impact analysis` 主链，使系统首次具备“为什么跨多个工程”的结构化解释能力。

### 3.2 Scope

**Epics:**
- `E4 Historical Coverage Gate`
- `E5 Contract Dependency Extraction`
- `E6 Cross-repo Dependency Index`
- `E7 Cross-repo Impact Analysis`

**Stories:**
- `E4-S1`
- `E4-S2`
- `E4-S3`
- `E5-S1`
- `E5-S2`
- `E5-S3`
- `E6-S1`
- `E6-S2`
- `E6-S3`
- `E7-S1`
- `E7-S2`
- `E7-S3`

### 3.3 Sprint Deliverables

1. `docs/fixtures/cross-repo-historical-cases.json`
2. `docs/fixtures/cross-repo-coverage-report.md`
3. `docs/contracts/cross-repo/contract-dependencies.schema.json`
4. `src/bootstrap-compiler/contract-dependencies.js`
5. `.spec-first/workflows/bootstrap/spec-first/contract-dependencies.json`
6. `docs/contracts/cross-repo/cross-repo-dependencies.schema.json`
7. `src/bootstrap-compiler/cross-repo-dependencies.js`
8. `.spec-first/workflows/bootstrap/spec-first/cross-repo-dependencies.json`
9. `docs/contracts/cross-repo/cross-repo-impact.schema.json`
10. `src/crg/cross-repo-impact.js`
11. `.spec-first/workflows/bootstrap/spec-first/cross-repo-impact.json`

### 3.4 并行建议

**Track A: Gate / Eval**
- `E4-S1`
- `E4-S2`
- `E4-S3`

**Track B: Contract Extraction**
- `E5-S1`
- `E5-S2`
- `E5-S3`

**Track C: Dependency / Impact**
- `E6-S1`
- `E6-S2`
- `E6-S3`
- `E7-S1`
- `E7-S2`
- `E7-S3`

说明：

- `E7` 必须等待 `E6-S2` 基本完成后再进入实现阶段。
- `Gate A` 结果必须在 Sprint 结束前形成文档结论。

### 3.5 Sprint Exit Criteria

- `Gate A` 形成明确结论
- `contract-dependencies`、`cross-repo-dependencies`、`cross-repo-impact` 三类 artifact 可稳定生成
- 可以明确当前上线口径是否需要收缩

### 3.6 Verification

- `npx jest tests/unit/cross-repo-coverage-gate.test.js --runInBand`
- `npx jest tests/unit/contract-dependencies.test.js --runInBand`
- `npx jest tests/unit/cross-repo-dependencies.test.js --runInBand`
- `npx jest tests/unit/cross-repo-impact.test.js --runInBand`

### 3.7 风险与应对

**Risk 1:** 历史案例不足，`Gate A` 无法形成可信结论  
**Mitigation:** 先保证 5-10 个案例完整标注，再跑 gate

**Risk 2:** dependency index 噪音过大  
**Mitigation:** 先收缩 direct + explicit contract，`inferred` 仅 advisory

---

## 4. Sprint 3：Level 1 workflow 闭环

### 4.1 Sprint Goal

让 `plan / work / review` 真正消费 cross-repo artifact，形成 `workspace context + review routing + verification matrix` 的 `Level 1` 闭环。

### 4.2 Scope

**Epics:**
- `E8 Workspace Context Assembly`
- `E9 Review Routing`
- `E10 Verification Matrix`

**Stories:**
- `E8-S1`
- `E8-S2`
- `E8-S3`
- `E8-S4`
- `E9-S1`
- `E9-S2`
- `E9-S3`
- `E9-S4`
- `E10-S1`
- `E10-S2`
- `E10-S3`

### 4.3 Sprint Deliverables

1. `docs/contracts/cross-repo/workspace-context.schema.json`
2. `src/context-routing/cross-repo-context.js`
3. `.spec-first/workflows/bootstrap/spec-first/workspace-context.json`
4. `docs/contracts/cross-repo/cross-repo-review-routing.schema.json`
5. `src/context-routing/cross-repo-review-routing.js`
6. `.spec-first/workflows/bootstrap/spec-first/cross-repo-review-routing.json`
7. `docs/contracts/cross-repo/cross-repo-verification-matrix.schema.json`
8. `src/context-routing/cross-repo-verification.js`
9. `.spec-first/workflows/bootstrap/spec-first/cross-repo-verification-matrix.json`

### 4.4 并行建议

**Track A: Workspace Context**
- `E8-S1`
- `E8-S2`
- `E8-S3`
- `E8-S4`

**Track B: Review Routing**
- `E9-S1`
- `E9-S2`
- `E9-S3`
- `E9-S4`

**Track C: Verification**
- `E10-S1`
- `E10-S2`
- `E10-S3`

### 4.5 Sprint Exit Criteria

- `workspace-context.json`
- `cross-repo-review-routing.json`
- `cross-repo-verification-matrix.json`
三类 artifact 全部可稳定生成

- `plan / work / review` 已能读入 workspace artifact
- 单仓路径仍保持当前 `selected_assets` 语义

### 4.6 Verification

- `npx jest tests/unit/cross-repo-context.test.js --runInBand`
- `npx jest tests/unit/workspace-context.test.js --runInBand`
- `npx jest tests/unit/cross-repo-review-routing.test.js --runInBand`
- `npx jest tests/unit/cross-repo-verification.test.js --runInBand`

### 4.7 风险与应对

**Risk 1:** consumer 只“输出不同”，没有真正提升结果  
**Mitigation:** 在 Sprint 4 中强制做 baseline 对比，不接受“看起来不同”作为成功

**Risk 2:** workspace-context 被匿名压平成单仓语义  
**Mitigation:** evaluator 必须显式区分 `workspace-context` 与 `selected_assets`

---

## 5. Sprint 4：Level 1 试点验收

### 5.1 Sprint Goal

验证 `Level 1` 是否真的成立，并给出是否可试点、是否要收缩上线口径的正式结论。

### 5.2 Scope

**Epic:**
- `E11 Level 1 Acceptance`

**Stories:**
- `E11-S1`
- `E11-S2`
- `E11-S3`

### 5.3 Sprint Deliverables

1. `docs/fixtures/cross-repo/level1-acceptance-report.md`
2. `docs/fixtures/cross-repo/consumer-delta-report.md`
3. 若需要，更新 [008 方案文档](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md)

### 5.4 Sprint Exit Criteria

- `affected repos recall`
- `required reviewers hit rate`
- `required verification paths hit rate`
- `affected repos precision`
达到 `008` 定义门槛，或明确说明未达标原因

- 明确结论：
  - `Level 1 可试点`
  - 或 `Level 1 需返工`
  - 或 `Level 1 仅能按显式契约型联动识别试点`

### 5.5 Verification

- 历史案例回放报告
- single-repo vs workspace-consumer delta 报告

### 5.6 风险与应对

**Risk 1:** 结果指标不达标  
**Mitigation:** 不进入 Sprint 5 扩展，先回到 Sprint 2/3 返工

**Risk 2:** ownership authority 不足导致 reviewer 命中率低  
**Mitigation:** 收缩强口径，只输出 advisory routing

---

## 6. Sprint 5：Level 2 结构硬化

### 6.1 Sprint Goal

先拿下任务拆解与增量更新，为后续 rollback / regression 提供稳定状态底座。

### 6.2 Scope

**Epics:**
- `E12 Task Decomposition`
- `E13 Incremental Update`

**Stories:**
- `E12-S1`
- `E12-S2`
- `E12-S3`
- `E13-S1`
- `E13-S2`
- `E13-S3`

### 6.3 Sprint Deliverables

1. `docs/contracts/cross-repo/multi-repo-task-plan.schema.json`
2. `src/context-routing/cross-repo-task-plan.js`
3. `.spec-first/workflows/bootstrap/spec-first/multi-repo-task-plan.json`
4. `docs/contracts/cross-repo/cross-repo-build-state.schema.json`
5. `src/bootstrap-compiler/cross-repo-incremental.js`
6. `.spec-first/workflows/bootstrap/spec-first/cross-repo-build-state.json`

### 6.4 并行建议

**Track A: Task Plan**
- `E12-S1`
- `E12-S2`
- `E12-S3`

**Track B: Incremental / Rollback**
- `E13-S1`
- `E13-S2`
- `E13-S3`

### 6.5 Sprint Exit Criteria

- task decomposition 可生成 repo 级任务计划
- incremental update 可在局部改动时工作

### 6.6 Verification

- `npx jest tests/unit/cross-repo-task-plan.test.js --runInBand`
- `npx jest tests/unit/cross-repo-incremental.test.js --runInBand`

### 6.7 风险与应对

**Risk 1:** incremental invalidation 边界不清  
**Mitigation:** 先以保守 invalidation 为主，再逐步优化

**Risk 2:** task decomposition 过早细粒度化  
**Mitigation:** 先只做 repo 级任务计划，不扩到代码级任务

---

## 7. Sprint 6：Level 2 运行硬化

### 7.1 Sprint Goal

在已有 build-state 与 task decomposition 底座上，补齐 rollback、regression、CI gate，形成运行稳定性闭环。

### 7.2 Scope

**Epics:**
- `E14 Rollback & Last-known-good`
- `E15 Regression & CI Gate`

**Stories:**
- `E14-S1`
- `E14-S2`
- `E14-S3`
- `E15-S1`
- `E15-S2`
- `E15-S3`
- `E15-S4`

### 7.3 Sprint Deliverables

1. `docs/contracts/cross-repo/workspace-snapshot-manifest.schema.json`
2. `.spec-first/workflows/bootstrap/spec-first/workspace-snapshot-manifest.json`
3. `benchmarks/cross-repo/cases.json`
4. `tests/unit/cross-repo-regression.test.js`
5. `.github/workflows/crg-quality-gate.yml`

### 7.4 并行建议

**Track A: Rollback**
- `E14-S1`
- `E14-S2`
- `E14-S3`

**Track B: Regression / CI**
- `E15-S1`
- `E15-S2`
- `E15-S3`
- `E15-S4`

### 7.5 Sprint Exit Criteria

- rollback / last-known-good 可恢复
- regression / CI gate 可以守住单仓与多仓双基线

### 7.6 Verification

- `npx jest tests/unit/cross-repo-rollback.test.js --runInBand`
- `npx jest tests/unit/cross-repo-regression.test.js --runInBand`
- `bash tests/e2e/cross-repo-mainline.sh`
- `npm run test:crg:gate`

### 7.7 风险与应对

**Risk 1:** rollback 依赖 manifest 但 snapshot 写入顺序不稳  
**Mitigation:** 先固定 staged write -> manifest -> promote 顺序，再接入恢复逻辑

**Risk 2:** regression case 不足导致 gate 失真  
**Mitigation:** 至少覆盖 single-repo baseline + 一类显式契约 cross-repo case

**Risk 3:** rollback 设计过重  
**Mitigation:** 只做文件产物级 last-known-good，不扩张为事务系统

---

## 8. Sprint 7：推广与运维收口

### 8.1 Sprint Goal

完成 rollout guide、故障排查和试点反馈模板，让系统不仅能做出来，还能真正被团队用起来。

### 8.2 Scope

**Epic:**
- `E16 Rollout & Operations`

**Stories:**
- `E16-S1`
- `E16-S2`
- `E16-S3`

### 8.3 Sprint Deliverables

1. `docs/fixtures/cross-repo/rollout-guide.md`
2. `docs/fixtures/cross-repo/troubleshooting.md`
3. `docs/fixtures/cross-repo/pilot-feedback-template.md`

### 8.4 Sprint Exit Criteria

- rollout guide 可指导试点团队开启使用
- troubleshooting 可解释 degraded / incomplete / rollback
- pilot feedback 模板可支撑下一轮优化输入

---

## 9. 推荐排期节奏

### 方案 A：标准 7 Sprint

适合：
- 2-3 名开发并行
- 希望先稳后快

节奏：
1. Sprint 1：真源与入口
2. Sprint 2：识别主链
3. Sprint 3：workflow 闭环
4. Sprint 4：Level 1 验收
5. Sprint 5：Level 2 结构硬化
6. Sprint 6：Level 2 运行硬化
7. Sprint 7：推广收口

### 方案 B：压缩 5 Sprint

适合：
- 更强并行能力
- 接受更高返工风险

节奏：
1. Sprint 1：Phase 0 + Phase 1
2. Sprint 2：Phase 2
3. Sprint 3：Phase 3 + Phase 4
4. Sprint 4：Phase 5（结构硬化）
5. Sprint 5：Phase 6 + Phase 7（运行硬化 + rollout）

风险：
- Sprint 3 压力很大
- 若 `Level 1` 验收失败，会拖垮 Sprint 4-5

结论：
- 默认推荐 `方案 A`

---

## 10. Sprint 评审模板

每个 Sprint 结束时，固定回答以下问题：

1. 本 Sprint 计划交付是否全部完成？
2. 哪些 Story 进入 `done`，哪些仍在 `blocked / rework`？
3. 哪些结果性指标被验证了？
4. 是否出现单仓退化？
5. 是否需要调整下一 Sprint 范围？
6. 是否需要修订 `008 / 009 / 010` 文档口径？

---

## 11. 最终说明

这份 `011` 是排期视图。

建议团队实际使用方式如下：

1. 架构评审看 `008`
2. 执行拆解看 `009`
3. 任务分配看 `010`
4. 迭代排期看 `011`

这样每份文档只承担一种职责，开发、管理、评审三条线不会混在一起。
