# 多工程 / 微服务联动需求 Implementation Backlog

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 direct source evidence workflows 为准。

**Goal:** 将 [2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md) 继续下沉为可分配、可排期、可跟踪的 backlog，按 `Epic -> Story -> Subtask -> 验收标准` 组织，支撑团队分阶段推进 `Level 1` 与 `Level 2` 开发。

**Source of Truth:**
- [2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md)
- [2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-009-cross-repo-multi-service-full-development-execution-checklist.md)

**Usage:**
- `008` 负责架构与边界
- `009` 负责阶段推进与全量清单
- `010` 负责开发排期、任务分配、迭代执行

---

## 1. Backlog 使用规则

1. `Epic` 是可管理的能力包，不是随意分组。
2. `Story` 是可在一个小迭代内完成并验收的交付单元。
3. `Subtask` 是开发者真正要做的代码/测试/文档动作。
4. 每个 `Story` 都必须有输入、产出、依赖、验收标准、失败回退方式。
5. `Level 1` backlog 优先级高于全部 `Level 2` backlog。
6. 若 `Gate A` 未通过，后续 backlog 不停止，但上线口径必须自动收缩。
7. 未通过验收的 `Story` 不得标记完成，只能标记为 `blocked` 或 `rework`。

---

## 2. 状态定义

| 状态 | 含义 |
|---|---|
| `todo` | 尚未开始 |
| `ready` | 前置依赖已满足，可开工 |
| `in_progress` | 正在开发 |
| `blocked` | 被外部依赖或缺信息阻塞 |
| `review` | 已完成开发，待评审/验收 |
| `done` | 已通过验收 |
| `rework` | 已实现但验收失败，需要返工 |

---

## 3. 优先级定义

| 优先级 | 含义 |
|---|---|
| `P0` | 阻塞 Level 1 主链，不做无法推进 |
| `P1` | Level 1 闭环所需，但可在 P0 后并行推进 |
| `P2` | Level 2 工程硬化，不能反向阻塞 Level 1 |
| `P3` | rollout、文档、运营支持项 |

---

## 4. Epic 总览

| Epic ID | 名称 | 对应阶段 | 优先级 | 目标 |
|---|---|---|---|---|
| E0 | Baseline & Fixture Foundation | Phase 0 | P0 | 建立开发地基 |
| E1 | Cross-repo Invocation Contract | Phase 1 | P0 | 建立稳定调用入口 |
| E2 | Workspace Identity Registry | Phase 1 | P0 | 建立 repo identity 真源 |
| E3 | Ownership & Boundary Registry | Phase 1 | P0 | 建立 ownership/boundary 真源 |
| E4 | Historical Coverage Gate | Phase 2 | P0 | 校准问题边界与上线口径 |
| E5 | Contract Dependency Extraction | Phase 2 | P0 | 建立显式契约抽取 |
| E6 | Cross-repo Dependency Index | Phase 2 | P0 | 建立跨工程依赖索引 |
| E7 | Cross-repo Impact Analysis | Phase 2 | P0 | 建立影响半径主链 |
| E8 | Workspace Context Assembly | Phase 3 | P1 | 为 workflow 装配多工程上下文 |
| E9 | Review Routing | Phase 3 | P1 | 自动路由 owner/reviewer |
| E10 | Verification Matrix | Phase 3 | P1 | 自动生成验证矩阵 |
| E11 | Level 1 Acceptance | Phase 4 | P1 | 确认 Level 1 是否成立 |
| E12 | Task Decomposition | Phase 5 | P2 | 生成 repo 级任务计划 |
| E13 | Incremental Update | Phase 5 | P2 | 支持增量更新 |
| E14 | Rollback & Last-known-good | Phase 5 | P2 | 支持回滚恢复 |
| E15 | Regression & CI Gate | Phase 5 | P2 | 守住质量与不退化 |
| E16 | Rollout & Operations | Phase 6 | P3 | 推广与运维收口 |

---

## 5. Level 1 Backlog

## 5.1 E0 Baseline & Fixture Foundation

### Story E0-S1：建立 contracts/fixtures 目录与规则

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** 无

**Input:**
- `008`
- `009`

**Output:**
- `docs/contracts/cross-repo/README.md`
- `docs/fixtures/cross-repo/README.md`
- `tests/fixtures/cross-repo/` 目录骨架

**Subtasks:**
1. 建立 cross-repo contracts 目录与命名规范
2. 建立 cross-repo fixtures 目录与分类规则
3. 明确 artifact、schema、fixture 三者映射关系

**Acceptance Criteria:**
- 后续 schema 与 fixture 都有固定落点
- README 里写清命名、版本、组织规则

**Rollback:**
- 无需回滚；如规则不合理，直接修订 README

### Story E0-S2：建立 cross-repo 测试入口骨架

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E0-S1`

**Output:**
- `tests/unit/cross-repo-coverage-gate.test.js`
- `tests/e2e/cross-repo-mainline.sh`

**Subtasks:**
1. 建立空测试文件
2. 统一 cross-repo 公共状态断言风格
3. 约定 shell e2e workspace fixture 输入方式

**Acceptance Criteria:**
- 测试文件可执行
- 后续 story 可以直接往其中补内容

### Story E0-S3：记录单仓 baseline

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** 无

**Output:**
- `docs/fixtures/cross-repo/single-repo-baseline-notes.md`

**Subtasks:**
1. 记录 `workspace-loader` 当前行为
2. 记录 `evaluator` 当前单仓行为
3. 记录 `workspace-context.test.js` 当前基线
4. 记录 rollback / freshness / loader 现有语义

**Acceptance Criteria:**
- 后续任何“单仓不退化”争议都有比对基线

---

## 5.2 E1 Cross-repo Invocation Contract

### Story E1-S1：定义 invocation schema

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E0-S1`

**Files:**
- `docs/contracts/cross-repo/invocation.schema.json`

**Subtasks:**
1. 定义 `mode`
2. 定义 `workspace`
3. 定义 `changedFiles`
4. 定义 `changedContracts`
5. 定义错误响应结构

**Acceptance Criteria:**
- schema 能表达单仓与 workspace 两种模式
- 空输入与非法输入语义清晰

### Story E1-S2：实现 invocation 解析器

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E1-S1`

**Files:**
- `src/context-routing/cross-repo-invocation.js`

**Subtasks:**
1. 解析单仓输入
2. 解析 workspace 输入
3. 统一标准输出结构
4. 处理空输入与非法输入

**Acceptance Criteria:**
- 调用层可统一拿到结构化 invocation 数据

### Story E1-S3：补 invocation tests

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E1-S2`, `E0-S2`

**Files:**
- `tests/unit/cross-repo-invocation.test.js`
- `tests/e2e/cross-repo-mainline.sh`

**Subtasks:**
1. 单仓 happy path
2. workspace happy path
3. `ok-empty` 场景
4. 结构化错误场景
5. e2e 入口接入

**Acceptance Criteria:**
- unit + e2e 通过

---

## 5.3 E2 Workspace Identity Registry

### Story E2-S1：定义 workspace repos schema

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E0-S1`

**Files:**
- `docs/contracts/cross-repo/workspace-repos.schema.json`

**Acceptance Criteria:**
- 能完整表达 repo identity 最小字段

### Story E2-S2：实现 workspace registry compiler

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E2-S1`

**Files:**
- `src/bootstrap-compiler/workspace-registry.js`
- `.spec-first/workflows/bootstrap/spec-first/workspace-repos.json`

**Subtasks:**
1. 统一加载 repo 列表
2. 做 schema 校验
3. 单 repo metadata 缺失时 degraded
4. 保持 registry 不混 ownership

**Acceptance Criteria:**
- `workspace-repos.json` 可稳定生成

### Story E2-S3：兼容接入 workspace-loader

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E2-S2`

**Files:**
- `src/context-routing/workspace-loader.js`

**Subtasks:**
1. 增加 registry-aware 读取
2. 保留旧 `repoRoots` fallback
3. 保证 Windows / Unix slug 正确

**Acceptance Criteria:**
- 不移除旧路径
- 多仓读取优先 registry，单仓行为不变

### Story E2-S4：补 workspace registry tests

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E2-S3`

**Files:**
- `tests/unit/workspace-registry.test.js`
- `tests/unit/workspace-context.test.js`

**Acceptance Criteria:**
- Windows / Unix path case 都通过
- 单仓兼容不退化

---

## 5.4 E3 Ownership & Boundary Registry

### Story E3-S1：定义 service-boundaries schema

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E2-S1`

**Files:**
- `docs/contracts/cross-repo/service-boundaries.schema.json`
- `docs/contracts/cross-repo/workspace-ownership.schema.json`

**Acceptance Criteria:**
- `service-boundaries.schema.json` 能表达 repo 与 boundary 的最小绑定关系
- `workspace-ownership.schema.json` 能表达 owner / reviewer / authority / updated_at 最小字段

### Story E3-S2：扩展 ownership registry 为 workspace 维度

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E2-S2`

**Files:**
- `src/bootstrap-compiler/ownership-registry.js`
- `.spec-first/workflows/bootstrap/spec-first/workspace-ownership.json`

**Acceptance Criteria:**
- 支持 workspace ownership
- authority 不足时不产生强路由结论

### Story E3-S3：实现 service-boundaries compiler

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E3-S1`, `E2-S2`

**Files:**
- `src/bootstrap-compiler/service-boundaries.js`
- `.spec-first/workflows/bootstrap/spec-first/service-boundaries.json`

### Story E3-S4：补 ownership/boundary tests

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E3-S2`, `E3-S3`

**Files:**
- `tests/unit/workspace-ownership.test.js`

**Acceptance Criteria:**
- ownership 缺失 -> degraded
- authority 过期 -> advisory only

---

## 5.5 E4 Historical Coverage Gate

### Story E4-S1：整理历史案例数据集

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E0-S1`, `E0-S2`

**Files:**
- `docs/fixtures/cross-repo-historical-cases.json`

**Subtasks:**
1. 收集 5-10 个真实案例
2. 分类 `in_scope_explicit_contract`
3. 分类 `out_of_scope_non_contract`
4. 分类 `mixed`
5. 标注 ground truth

**Acceptance Criteria:**
- 案例集可用于 gate test 与回放评估

### Story E4-S2：实现 coverage gate test

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E4-S1`

**Files:**
- `tests/unit/cross-repo-coverage-gate.test.js`

**Acceptance Criteria:**
- 能计算 `explicit_contract_case_coverage`
- 能计算 `all_case_coverage`
- 有明确 pass/fail 条件

### Story E4-S3：输出 coverage 报告

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E4-S2`

**Files:**
- `docs/fixtures/cross-repo-coverage-report.md`

**Acceptance Criteria:**
- 明确当前上线口径
- 明确漏报/误报/缺失依赖类型

---

## 5.6 E5 Contract Dependency Extraction

### Story E5-S1：定义 contract-dependencies schema

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E0-S1`

**Files:**
- `docs/contracts/cross-repo/contract-dependencies.schema.json`

**Acceptance Criteria:**
- schema 能表达 `contract_type / producer_repo / consumer_repos / evidence`
- schema 能表达 `unknown / incomplete` 状态

### Story E5-S2：实现 contract extractor

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E5-S1`, `E4-S3`

**Files:**
- `src/bootstrap-compiler/contract-dependencies.js`
- `.spec-first/workflows/bootstrap/spec-first/contract-dependencies.json`

**Acceptance Criteria:**
- 支持首批 5 类显式契约
- 不支持类型输出 `unknown`

### Story E5-S3：补 contract extraction tests

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E5-S2`

**Files:**
- `tests/unit/contract-dependencies.test.js`

---

## 5.7 E6 Cross-repo Dependency Index

### Story E6-S1：定义 cross-repo-dependencies schema

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E0-S1`

**Files:**
- `docs/contracts/cross-repo/cross-repo-dependencies.schema.json`

**Acceptance Criteria:**
- schema 能表达 `direct / inferred`
- schema 能表达 `source_kind / evidence`

### Story E6-S2：实现 dependency index compiler

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E2-S2`, `E5-S2`

**Files:**
- `src/bootstrap-compiler/cross-repo-dependencies.js`
- `.spec-first/workflows/bootstrap/spec-first/cross-repo-dependencies.json`

**Acceptance Criteria:**
- direct / inferred 区分清晰
- evidence 完整

### Story E6-S3：补 dependency index tests

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E6-S2`

**Files:**
- `tests/unit/cross-repo-dependencies.test.js`

---

## 5.8 E7 Cross-repo Impact Analysis

### Story E7-S1：定义 cross-repo-impact schema

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E0-S1`

**Files:**
- `docs/contracts/cross-repo/cross-repo-impact.schema.json`

**Acceptance Criteria:**
- schema 能表达 `affected_repos / affected_contracts / affected_owners / affected_tests`
- schema 能表达 `impact_chain`
- schema 能表达 `ok / ok-empty / incomplete / degraded / error`

### Story E7-S2：实现 cross-repo impact

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E6-S2`

**Files:**
- `src/crg/cross-repo-impact.js`
- `src/crg/commands/impact.js`
- `.spec-first/workflows/bootstrap/spec-first/cross-repo-impact.json`

**Acceptance Criteria:**
- 从 `changedFiles` 与 `changedContracts` 都能出结果
- 有 `ok-empty / degraded / incomplete / error`

### Story E7-S3：补 impact tests

**Priority:** `P0`  
**Status:** `todo`  
**Dependencies:** `E7-S2`

**Files:**
- `tests/unit/cross-repo-impact.test.js`

---

## 5.9 E8 Workspace Context Assembly

### Story E8-S1：定义 workspace-context schema

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E0-S1`

**Files:**
- `docs/contracts/cross-repo/workspace-context.schema.json`

**Acceptance Criteria:**
- schema 能表达 `primary_repo / affected_repos / shared_contracts / candidate_tests`
- schema 能表达预算裁剪相关字段

### Story E8-S2：实现 cross-repo-context compiler

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E7-S2`, `E3-S2`

**Files:**
- `src/context-routing/cross-repo-context.js`
- `.spec-first/workflows/bootstrap/spec-first/workspace-context.json`

### Story E8-S3：接入 evaluator / workspace-loader

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E8-S2`

**Files:**
- `src/context-routing/evaluator.js`
- `src/context-routing/workspace-loader.js`

**Acceptance Criteria:**
- workspace 场景读 `workspace-context`
- 单仓仍走 `selected_assets`

### Story E8-S4：补 context tests 与 consumer 对比用例

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E8-S3`

**Files:**
- `tests/unit/cross-repo-context.test.js`
- `tests/unit/workspace-context.test.js`

---

## 5.10 E9 Review Routing

### Story E9-S1：定义 review-routing schema

**Priority:** `P1`  
**Status:** `todo`

**Files:**
- `docs/contracts/cross-repo/cross-repo-review-routing.schema.json`

**Acceptance Criteria:**
- schema 能表达 `required_reviewers / advisory_reviewers / unresolved`
- schema 能表达 authority 降级语义

### Story E9-S2：实现 cross-repo-review-routing

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E7-S2`, `E3-S2`

**Files:**
- `src/context-routing/cross-repo-review-routing.js`
- `.spec-first/workflows/bootstrap/spec-first/cross-repo-review-routing.json`

### Story E9-S3：扩展 review-queue-state

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E9-S2`

**Files:**
- `src/bootstrap-compiler/review-queue-state.js`

### Story E9-S4：补 routing tests

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E9-S3`

**Files:**
- `tests/unit/cross-repo-review-routing.test.js`

---

## 5.11 E10 Verification Matrix

### Story E10-S1：定义 verification-matrix schema

**Priority:** `P1`  
**Status:** `todo`

**Files:**
- `docs/contracts/cross-repo/cross-repo-verification-matrix.schema.json`

**Acceptance Criteria:**
- schema 能表达 `repo / check_type / required / elective`
- schema 能表达 verification gap 提示

### Story E10-S2：实现 verification matrix compiler

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E7-S2`, `E8-S2`

**Files:**
- `src/context-routing/cross-repo-verification.js`
- `.spec-first/workflows/bootstrap/spec-first/cross-repo-verification-matrix.json`

### Story E10-S3：补 verification tests

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E10-S2`

**Files:**
- `tests/unit/cross-repo-verification.test.js`

---

## 5.12 E11 Level 1 Acceptance

### Story E11-S1：回放历史案例并评估结果门槛

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E4-S3`, `E8-S4`, `E9-S4`, `E10-S3`

**Files:**
- `docs/fixtures/cross-repo/level1-acceptance-report.md`

**Acceptance Criteria:**
- `affected repos recall`
- `required reviewers hit rate`
- `required verification paths hit rate`
- `affected repos precision`
达到 `008` 中定义门槛

### Story E11-S2：输出 consumer delta 报告

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E11-S1`

**Files:**
- `docs/fixtures/cross-repo/consumer-delta-report.md`

### Story E11-S3：确认上线口径

**Priority:** `P1`  
**Status:** `todo`  
**Dependencies:** `E11-S1`, `E11-S2`

**Files:**
- `docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md`

**Acceptance Criteria:**
- 明确 Level 1 是否可进入试点
- 明确是否收缩为“显式契约型联动识别”

---

## 6. Level 2 Backlog

## 6.1 E12 Task Decomposition

### Story E12-S1：定义 multi-repo-task-plan schema

**Priority:** `P2`  
**Status:** `todo`

**Files:**
- `docs/contracts/cross-repo/multi-repo-task-plan.schema.json`

**Acceptance Criteria:**
- schema 能表达 `primary / dependent / contract-update / verification` 任务类型
- schema 能表达顺序依赖与 blocking contract

### Story E12-S2：实现 repo 级 task planner

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E7-S2`, `E6-S2`, `E3-S2`

**Files:**
- `src/context-routing/cross-repo-task-plan.js`
- `.spec-first/workflows/bootstrap/spec-first/multi-repo-task-plan.json`

### Story E12-S3：补 task planner tests

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E12-S2`

**Files:**
- `tests/unit/cross-repo-task-plan.test.js`

## 6.2 E13 Incremental Update

### Story E13-S1：定义 build-state schema

**Priority:** `P2`  
**Status:** `todo`

**Files:**
- `docs/contracts/cross-repo/cross-repo-build-state.schema.json`

**Acceptance Criteria:**
- schema 能表达 `input_fingerprint / dependency_revision / workspace_snapshot_id / repo_snapshot_ids`
- schema 能表达 invalidation basis

### Story E13-S2：实现 incremental engine

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E7-S2`

**Files:**
- `src/bootstrap-compiler/cross-repo-incremental.js`
- `.spec-first/workflows/bootstrap/spec-first/cross-repo-build-state.json`
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/orchestrator.js`

### Story E13-S3：补 incremental tests

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E13-S2`

**Files:**
- `tests/unit/cross-repo-incremental.test.js`

## 6.3 E14 Rollback & Last-known-good

### Story E14-S1：定义 workspace-snapshot-manifest schema

**Priority:** `P2`  
**Status:** `todo`

**Files:**
- `docs/contracts/cross-repo/workspace-snapshot-manifest.schema.json`

**Acceptance Criteria:**
- schema 能表达 staged write、repo snapshot、last-known-good 最小字段
- schema 能表达恢复顺序所需元数据

### Story E14-S2：扩展 rollback 支持 workspace snapshot

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E13-S2`

**Files:**
- `src/bootstrap-compiler/rollback.js`
- `src/bootstrap-compiler/run-bootstrap.js`
- `.spec-first/workflows/bootstrap/spec-first/workspace-snapshot-manifest.json`

### Story E14-S3：补 rollback tests

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E14-S2`

**Files:**
- `tests/unit/cross-repo-rollback.test.js`
- `tests/e2e/cross-repo-mainline.sh`

## 6.4 E15 Regression & CI Gate

### Story E15-S1：增加 cross-repo benchmark cases

**Priority:** `P2`  
**Status:** `todo`

**Files:**
- `benchmarks/cross-repo/cases.json`

**Acceptance Criteria:**
- 包含至少一类显式契约型案例
- 包含 single-repo baseline 对照所需字段

### Story E15-S2：扩展 regression runner

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E15-S1`

**Files:**
- `benchmarks/regression/run-regression.js`
- `benchmarks/regression/baselines.json`

### Story E15-S3：补 regression tests

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E15-S2`

**Files:**
- `tests/unit/cross-repo-regression.test.js`

### Story E15-S4：更新 CI Gate

**Priority:** `P2`  
**Status:** `todo`  
**Dependencies:** `E15-S2`

**Files:**
- `.github/workflows/crg-quality-gate.yml`

---

## 7. Rollout Backlog

## 7.1 E16 Rollout & Operations

### Story E16-S1：补 rollout guide

**Priority:** `P3`  
**Status:** `todo`  
**Dependencies:** `E11-S3`

**Files:**
- `docs/fixtures/cross-repo/rollout-guide.md`

### Story E16-S2：补 troubleshooting

**Priority:** `P3`  
**Status:** `todo`  
**Dependencies:** `E13-S2`, `E14-S2`

**Files:**
- `docs/fixtures/cross-repo/troubleshooting.md`

### Story E16-S3：补 pilot feedback template

**Priority:** `P3`  
**Status:** `todo`  
**Dependencies:** `E11-S3`

**Files:**
- `docs/fixtures/cross-repo/pilot-feedback-template.md`

---

## 8. 推荐迭代拆分

### Iteration 1：地基与真源

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

**Exit Criteria:**
- invocation + registry + ownership/boundary 全部打通

### Iteration 2：识别主链

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

**Exit Criteria:**
- coverage gate + dependency + impact 主链成立

### Iteration 3：Level 1 闭环

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
- `E11-S1`
- `E11-S2`
- `E11-S3`

**Exit Criteria:**
- Level 1 是否可试点有正式结论

### Iteration 4：Level 2 工程硬化

**Stories:**
- `E12-S1`
- `E12-S2`
- `E12-S3`
- `E13-S1`
- `E13-S2`
- `E13-S3`
- `E14-S1`
- `E14-S2`
- `E14-S3`
- `E15-S1`
- `E15-S2`
- `E15-S3`
- `E15-S4`

**Exit Criteria:**
- 可增量、可回退、可回归

### Iteration 5：推广与运维

**Stories:**
- `E16-S1`
- `E16-S2`
- `E16-S3`

---

## 9. 开发分工建议

### 角色 A：Compiler / Contract Owner

负责：
- `E1`
- `E2`
- `E3`
- `E5`
- `E6`
- `E13`
- `E14`

### 角色 B：Context Routing / Consumer Owner

负责：
- `E8`
- `E9`
- `E10`
- `E12`

### 角色 C：Quality / Eval Owner

负责：
- `E0`
- `E4`
- `E11`
- `E15`
- `E16`

说明：
- 若团队人少，可按迭代推进，不必强行并行。
- 若团队人足够，可按 write-scope 并行推进，但必须避免多人同时改同一批核心文件。

---

## 10. Blocker 清单

以下 blocker 需要在执行中被显式跟踪：

1. 历史案例是否足够覆盖真实联动类型
2. ownership authority 数据是否足够支撑 required reviewer
3. candidate tests 映射是否足够支撑 verification matrix
4. 单仓 consumer 改造后是否真的带来结果收益
5. incremental invalidation 规则是否会导致陈旧状态

若 blocker 未解决，应标记受影响 `Story` 为 `blocked`，不得伪装为完成。

---

## 11. 最终说明

`010` 的定位不是新方案，而是开发管理视图。

团队执行时，推荐这样使用：

1. 架构师看 `008`
2. TL / PM 看 `009`
3. 开发排期与分工看 `010`

这样可以避免一份文档同时承担架构、执行、管理三种职责，最终导致既不清晰也不可执行。
