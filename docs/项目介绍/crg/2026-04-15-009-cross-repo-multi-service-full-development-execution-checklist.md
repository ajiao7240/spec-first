# 多工程 / 微服务联动需求全量开发执行清单

**Goal:** 将 [2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md) 下沉为一份可直接执行的全量开发清单，覆盖 `Level 1 可开发主链` 与 `Level 2 工程硬化` 的完整推进路径，明确每个阶段的任务包、文件范围、验证口径、交付物和完成判据。

**Source of Truth:**
- [2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md)
- [2026-04-15-007-cross-repo-multi-service-demand-integration-capabilities-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-007-cross-repo-multi-service-demand-integration-capabilities-plan.md)
- [2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md)

**Non-goals:**
- 不在本清单内引入 cross-repo symbol graph
- 不在本清单内引入 semantic retrieval / learned ranking
- 不在本清单内解决组织级未知 repo 自动发现
- 不在本清单内做 production-grade observability 平台

---

## 1. 执行原则

1. 所有开发以 `008` 为架构真源，本清单只做执行拆分，不改变能力边界。
2. 严格按阶段推进，禁止跳过 `Task 00 / 01 / 02 / Gate A` 直接做 cross-repo impact。
3. 每个阶段都必须先补测试，再补实现，再跑阶段验收。
4. 每个 machine artifact 都必须有 schema、sample/fixture、状态语义、失败降级语义。
5. 单仓路径不退化是硬约束，所有 cross-repo 代码都必须保留 fallback。
6. `Gate A` 是 scope gate，不是装饰性分析；未通过时必须收缩上线口径。
7. `Level 1` 先做到“已知 workspace 范围内”的稳定主链；`Level 2` 再做增量更新、回滚、回归硬化。

---

## 2. 总体阶段划分

| 阶段 | 名称 | 范围 | 对应任务 | 完成目标 |
|---|---|---|---|---|
| Phase 0 | 开发准备与基线校准 | 测试基线、fixture、目录、约束 | 支撑性准备 | 为后续任务提供稳定开发地基 |
| Phase 1 | 调用契约与多工程真源 | invocation + registry + ownership/boundary | `Task 00-02` | 建立 cross-repo 输入与 identity 真源 |
| Phase 2 | 联动识别主链 | Gate A + contract extraction + dependency + impact | `Gate A`, `Task 03-05` | 建立可解释的 cross-repo 识别主链 |
| Phase 3 | workflow 主链接入 | context + routing + verification | `Task 06-07-09` | 形成 `Level 1` 闭环 |
| Phase 4 | Level 1 试点验收 | 历史案例回放、consumer 对比、上线口径确认 | `Level 1 acceptance` | 决定是否进入试点 |
| Phase 5 | Level 2 工程硬化 | task plan + incremental + rollback + regression | `Task 08`, `Task 10-12` | 形成可维护、可增量、可回退系统 |
| Phase 6 | 试点推广与运维收口 | 文档、CI、发布策略、运行约束 | rollout 收口 | 让能力可持续使用 |

---

## 3. Phase 0：开发准备与基线校准

### 3.1 目标

- 为后续 cross-repo 开发建立稳定 fixture、测试入口和目录约束
- 确认现有单仓链路的 baseline，避免后续“做着做着退化了还不知道”

### 3.2 任务清单

#### P0-01 建立 cross-repo contracts 目录骨架

**Files:**
- Create: `docs/contracts/cross-repo/`
- Create: `docs/contracts/cross-repo/README.md`

**Checklist:**
- 建立 cross-repo contracts 目录
- 约定 schema 命名规则与版本策略
- 约定 machine artifact 与 schema 的一一映射关系

**Done when:**
- 后续 `Task 00-12` 所需 schema 都有固定目录落点

#### P0-02 建立 cross-repo fixtures 目录骨架

**Files:**
- Create: `docs/fixtures/cross-repo/`
- Create: `docs/fixtures/cross-repo/README.md`
- Create: `tests/fixtures/cross-repo/` 或等价目录

**Checklist:**
- 约定历史案例 fixture 放置位置
- 约定 workspace/repo/contract 伪数据组织方式
- 明确哪些 fixture 是 `Gate A` 专用，哪些是 unit/e2e 共用

**Done when:**
- `Gate A`、unit tests、shell e2e 都能消费统一 fixture 目录

#### P0-03 建立 cross-repo 测试入口骨架

**Files:**
- Create: `tests/unit/cross-repo-coverage-gate.test.js`
- Create: `tests/e2e/cross-repo-mainline.sh`

**Checklist:**
- 建立空测试文件与基本执行入口
- 明确 `ok / ok-empty / incomplete / degraded / error` 的公共断言风格
- 明确 shell e2e 的 fixture workspace 输入方式

**Done when:**
- 测试文件存在且可被测试命令发现

#### P0-04 记录当前单仓 baseline

**Files:**
- Modify: `benchmarks/regression/baselines.json` 或先记录到临时基线文档
- Create: `docs/fixtures/cross-repo/single-repo-baseline-notes.md`

**Checklist:**
- 记录 `workspace-loader`、`evaluator`、单仓 `selected_assets` 现状
- 记录现有 `workspace-context.test.js` 行为基线
- 记录当前 rollback / freshness / loader 语义

**Done when:**
- 后续 cross-repo 改造有明确的“不得退化”参照

### 3.3 阶段验收

- `tests/e2e/cross-repo-mainline.sh` 可执行
- `tests/unit/cross-repo-coverage-gate.test.js` 可执行
- 目录骨架与命名约定齐备

---

## 4. Phase 1：调用契约与多工程真源

### 4.1 目标

- 建立 cross-repo invocation contract
- 建立 workspace repo identity 真源
- 建立 ownership / boundary 真源

### 4.2 任务包 A：Task 00 cross-repo invocation contract

#### A-01 定义 invocation schema

**Files:**
- Create: `docs/contracts/cross-repo/invocation.schema.json`

**Checklist:**
- 定义 `mode: single-repo | workspace`
- 定义 `changedFiles`
- 定义 `changedContracts`
- 定义 `workspace`
- 定义非法输入的结构化错误模型

#### A-02 实现 invocation 解析器

**Files:**
- Create: `src/context-routing/cross-repo-invocation.js`

**Checklist:**
- 实现输入解析
- 实现单仓兼容分支
- 实现 workspace 输入分支
- 实现空输入 `ok-empty` 或等价语义

#### A-03 补 invocation 单测

**Files:**
- Create: `tests/unit/cross-repo-invocation.test.js`

**Checklist:**
- 单仓输入通过
- workspace 输入通过
- 空 `changedFiles` / `changedContracts` 通过
- 非法输入返回结构化错误

#### A-04 补 invocation e2e 接入

**Files:**
- Modify: `tests/e2e/cross-repo-mainline.sh`

**Checklist:**
- fixture workspace 可以经 invocation 进入主链
- shell e2e 能区分单仓与多仓输入

**Phase Exit:**
- `npx jest tests/unit/cross-repo-invocation.test.js --runInBand`

### 4.3 任务包 B：Task 01 workspace repo registry

#### B-01 定义 workspace repos schema

**Files:**
- Create: `docs/contracts/cross-repo/workspace-repos.schema.json`

**Checklist:**
- 定义 `repoRoot`
- 定义 `slug`
- 定义 `service_name`
- 定义 `language`
- 定义 `role`
- 定义 `status`

#### B-02 实现 workspace registry compiler

**Files:**
- Create: `src/bootstrap-compiler/workspace-registry.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-repos.json`

**Checklist:**
- 统一加载 repo 列表
- 做 schema 校验
- 缺少单 repo metadata 时输出 degraded
- 保留 repo identity 真源职责，不混 ownership

#### B-03 兼容接入 workspace-loader

**Files:**
- Modify: `src/context-routing/workspace-loader.js`

**Checklist:**
- 增加 registry-aware 读取
- 保留旧 `repoRoots` fallback
- 不移除当前松散输入路径
- Windows / Unix slug 路径都正确

#### B-04 补 registry 单测

**Files:**
- Create: `tests/unit/workspace-registry.test.js`
- Modify: `tests/unit/workspace-context.test.js`

**Checklist:**
- 单仓兼容不变
- 多 repo registry 字段完整
- 缺 role 时 degraded
- Windows 路径 slug 正确

**Phase Exit:**
- `npx jest tests/unit/workspace-registry.test.js --runInBand`
- `npx jest tests/unit/workspace-context.test.js --runInBand`

### 4.4 任务包 C：Task 02 workspace ownership / boundary registry

#### C-01 定义 service boundaries schema

**Files:**
- Create: `docs/contracts/cross-repo/service-boundaries.schema.json`
- Create: `docs/contracts/cross-repo/workspace-ownership.schema.json`

**Checklist:**
- 定义 boundary identity
- 定义 repo 关联
- 定义 authority / updated_at
- 定义 workspace ownership entry 结构
- 定义 owner / reviewer / authority / updated_at 最小字段

#### C-02 扩展 ownership registry

**Files:**
- Modify: `src/bootstrap-compiler/ownership-registry.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-ownership.json`

**Checklist:**
- 增加 workspace 维度 ownership 读取
- 支持多角色 owner
- authority 不足时只给 suggestion

#### C-03 实现 service boundaries compiler

**Files:**
- Create: `src/bootstrap-compiler/service-boundaries.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/service-boundaries.json`

**Checklist:**
- boundary 可映射到 repo
- 与 registry identity 对齐
- 缺 boundary 时保守降级

#### C-04 补 ownership/boundary 单测

**Files:**
- Create: `tests/unit/workspace-ownership.test.js`

**Checklist:**
- ownership 缺失时 degraded
- authority 过期时 routing 后续只能 advisory
- repo 与 boundary 绑定正确

**Phase Exit:**
- `npx jest tests/unit/workspace-ownership.test.js --runInBand`

### 4.5 Phase 1 完成定义

- `Task 00-02` 全部通过单测
- invocation、repo registry、ownership/boundary 三类真源建立完成
- 现有单仓路径仍可工作

---

## 5. Phase 2：联动识别主链

### 5.1 目标

- 用 `Gate A` 先校准问题边界
- 建立显式契约抽取
- 建立 dependency index
- 建立 cross-repo impact

### 5.2 任务包 D：Gate A 历史案例 coverage 校准

#### D-01 收集历史案例

**Files:**
- Create: `docs/fixtures/cross-repo-historical-cases.json`

**Checklist:**
- 收集 5-10 个真实案例
- 每个案例标注 `affected_repos`
- 标注 `changed_contracts`
- 标注 `required_reviewers`
- 标注 `required_verification_paths`
- 标注 `linkage_source_types`

#### D-02 输出 coverage 报告模板

**Files:**
- Create: `docs/fixtures/cross-repo-coverage-report.md`

**Checklist:**
- 明确 `explicit_contract_case_coverage`
- 明确 `all_case_coverage`
- 明确漏报来源 / 误报来源
- 明确缺失依赖类型

#### D-03 实现 Gate A 校验测试

**Files:**
- Modify: `tests/unit/cross-repo-coverage-gate.test.js`

**Checklist:**
- 能回放历史案例 fixture
- 能输出 pass/fail
- 能对 `explicit_contract_case_coverage` 设置阈值
- 能对 `all_case_coverage` 设置阈值

**Phase Exit:**
- `npx jest tests/unit/cross-repo-coverage-gate.test.js --runInBand`

### 5.3 任务包 E：Task 03 contract-level dependency extraction

#### E-01 定义 contract dependencies schema

**Files:**
- Create: `docs/contracts/cross-repo/contract-dependencies.schema.json`

**Checklist:**
- 定义 `contract_type`
- 定义 `producer_repo`
- 定义 `consumer_repos`
- 定义 `evidence`
- 定义 `unknown / incomplete`

#### E-02 实现 contract extractor

**Files:**
- Create: `src/bootstrap-compiler/contract-dependencies.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/contract-dependencies.json`

**Checklist:**
- 支持 OpenAPI
- 支持 protobuf
- 支持 GraphQL
- 支持 message schema
- 支持 shared SDK manifest
- 不支持类型输出 `unknown`

#### E-03 补 contract extractor 单测

**Files:**
- Create: `tests/unit/contract-dependencies.test.js`

**Checklist:**
- producer -> 多 consumer 场景正确
- consumer 缺失时 incomplete
- 不支持类型时 unknown

**Phase Exit:**
- `npx jest tests/unit/contract-dependencies.test.js --runInBand`

### 5.4 任务包 F：Task 04 cross-repo dependency index

#### F-01 定义 dependency index schema

**Files:**
- Create: `docs/contracts/cross-repo/cross-repo-dependencies.schema.json`

**Checklist:**
- 定义 `direct`
- 定义 `inferred`
- 定义 `source_kind`
- 定义 `evidence`

#### F-02 实现 dependency index compiler

**Files:**
- Create: `src/bootstrap-compiler/cross-repo-dependencies.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-dependencies.json`

**Checklist:**
- 组合 registry
- 组合 contract dependencies
- 组合配置/manifest 扫描
- `inferred` 默认只进入 advisory 集

#### F-03 补 dependency index 单测

**Files:**
- Create: `tests/unit/cross-repo-dependencies.test.js`

**Checklist:**
- direct/inferred 区分正确
- evidence 存在
- 单 repo 缺信息不拖垮整体

**Phase Exit:**
- `npx jest tests/unit/cross-repo-dependencies.test.js --runInBand`

### 5.5 任务包 G：Task 05 cross-repo impact analysis

#### G-01 定义 cross-repo impact schema

**Files:**
- Create: `docs/contracts/cross-repo/cross-repo-impact.schema.json`

**Checklist:**
- 定义 `affected_repos`
- 定义 `affected_contracts`
- 定义 `affected_owners`
- 定义 `affected_tests`
- 定义 `impact_chain`
- 定义统一状态语义

#### G-02 实现 cross-repo impact

**Files:**
- Create: `src/crg/cross-repo-impact.js`
- Modify: `src/crg/commands/impact.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-impact.json`

**Checklist:**
- 支持 `changedFiles`
- 支持 `changedContracts`
- 无结果时输出 `ok-empty`
- 缺依赖边时输出保守降级

#### G-03 补 impact 单测

**Files:**
- Create: `tests/unit/cross-repo-impact.test.js`

**Checklist:**
- producer 变更 -> consumer repo 被识别
- shared contract -> 多 repo 被识别
- 缺边时 degraded/incomplete

**Phase Exit:**
- `npx jest tests/unit/cross-repo-impact.test.js --runInBand`

### 5.6 Phase 2 完成定义

- `Gate A` 产出 coverage 结论
- `Task 03-05` 全通过
- 可以稳定产出 `contract-dependencies.json`、`cross-repo-dependencies.json`、`cross-repo-impact.json`
- 能明确当前上线口径是“已知 workspace 范围内多工程识别”还是“显式契约型联动识别”

---

## 6. Phase 3：workflow 主链接入

### 6.1 目标

- 让 `plan / work / review` 实际消费 cross-repo artifact
- 形成 `Level 1` 闭环

### 6.2 任务包 H：Task 06 cross-repo minimal-context assembly

#### H-01 定义 workspace context schema

**Files:**
- Create: `docs/contracts/cross-repo/workspace-context.schema.json`

**Checklist:**
- 定义 `primary_repo`
- 定义 `affected_repos`
- 定义 `shared_contracts`
- 定义 `candidate_tests`
- 定义预算裁剪字段

#### H-02 实现 cross-repo context compiler

**Files:**
- Create: `src/context-routing/cross-repo-context.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-context.json`

**Checklist:**
- 组合 registry + impact + ownership
- repo / contract / risk 优先裁剪
- 单仓路径不退化

#### H-03 接入 evaluator / workspace-loader

**Files:**
- Modify: `src/context-routing/evaluator.js`
- Modify: `src/context-routing/workspace-loader.js`

**Checklist:**
- workspace 场景识别 `workspace-context`
- 单仓仍保持 `selected_assets`
- 不匿名压平 repo 边界

#### H-04 补 context 单测

**Files:**
- Create: `tests/unit/cross-repo-context.test.js`
- Modify: `tests/unit/workspace-context.test.js`

**Checklist:**
- primary/affected/shared/candidate_tests 正确
- 超预算裁剪稳定
- consumer 读入后可区分单仓与多仓

**Phase Exit:**
- `npx jest tests/unit/cross-repo-context.test.js --runInBand`
- `npx jest tests/unit/workspace-context.test.js --runInBand`

### 6.3 任务包 I：Task 07 cross-repo ownership & review routing

#### I-01 定义 review routing schema

**Files:**
- Create: `docs/contracts/cross-repo/cross-repo-review-routing.schema.json`

**Checklist:**
- 定义 `required_reviewers`
- 定义 `advisory_reviewers`
- 定义 `unresolved`
- 定义 authority 降级规则

#### I-02 实现 review routing

**Files:**
- Create: `src/context-routing/cross-repo-review-routing.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-review-routing.json`

**Checklist:**
- 从 impacted repos/contracts 反推 owner
- authority 不足时降级 advisory
- owner 缺失时 unresolved

#### I-03 扩展 review queue state

**Files:**
- Modify: `src/bootstrap-compiler/review-queue-state.js`

**Checklist:**
- 支持跨工程 queue 条目
- 不污染单仓状态流转

#### I-04 补 routing 单测

**Files:**
- Create: `tests/unit/cross-repo-review-routing.test.js`

**Checklist:**
- 多 repo 多 reviewer 组
- unresolved 语义正确
- authority 过期降级正确

**Phase Exit:**
- `npx jest tests/unit/cross-repo-review-routing.test.js --runInBand`

### 6.4 任务包 J：Task 09 cross-repo verification matrix

#### J-01 定义 verification matrix schema

**Files:**
- Create: `docs/contracts/cross-repo/cross-repo-verification-matrix.schema.json`

**Checklist:**
- 定义 repo
- 定义 `check_type`
- 定义 `required / elective`
- 定义 gap 提示

#### J-02 实现 verification matrix compiler

**Files:**
- Create: `src/context-routing/cross-repo-verification.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-verification-matrix.json`

**Checklist:**
- 生成 producer/consumer/contract/e2e 检查
- 单仓场景不误报跨工程矩阵
- 缺映射时明确 gap

#### J-03 补 verification 单测

**Files:**
- Create: `tests/unit/cross-repo-verification.test.js`

**Checklist:**
- 四类检查都能输出
- gap 行为稳定
- 单仓兼容正确

**Phase Exit:**
- `npx jest tests/unit/cross-repo-verification.test.js --runInBand`

### 6.5 Phase 3 完成定义

- `Task 06 / 07 / 09` 全通过
- `workspace-context.json`、`cross-repo-review-routing.json`、`cross-repo-verification-matrix.json` 可稳定产出
- `plan / work / review` 已能接入多工程最小上下文

---

## 7. Phase 4：Level 1 试点验收

### 7.1 目标

- 用历史案例和 consumer 对比验证 `Level 1` 是否真的成立

### 7.2 任务清单

#### K-01 历史案例回放

**Files:**
- Modify: `docs/fixtures/cross-repo-coverage-report.md`

**Checklist:**
- 回放 `in_scope_explicit_contract`
- 回放 `mixed`
- 回放 `out_of_scope_non_contract`
- 给出 pass/fail 与原因

#### K-02 consumer 对比评估

**Files:**
- Create: `docs/fixtures/cross-repo/consumer-delta-report.md`

**Checklist:**
- 对比 single-repo baseline
- 对比 `affected repos` 命中
- 对比 `required reviewers` 命中
- 对比 `required verification` 命中

#### K-03 Level 1 上线口径确认

**Files:**
- Modify: `docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md`（若验收结论需要收缩口径）
- Create: `docs/fixtures/cross-repo/level1-acceptance-report.md`

**Checklist:**
- 判断 `Gate A` 是否通过
- 判断是否可使用“已知 workspace 范围内多工程联动识别”表述
- 若未通过，明确降级为“显式契约型联动识别”

### 7.3 Phase 4 完成定义

- 结果性指标达到文档门槛
- `Level 1 acceptance report` 形成书面结论
- 决定是否进入试点

---

## 8. Phase 5：Level 2 工程硬化

### 8.1 目标

- 让系统从“能跑通”升级到“可维护、可增量、可回退、可回归”

### 8.2 任务包 L：Task 08 cross-repo task decomposition

#### L-01 定义 task plan schema

**Files:**
- Create: `docs/contracts/cross-repo/multi-repo-task-plan.schema.json`

#### L-02 实现 repo 级 task planner

**Files:**
- Create: `src/context-routing/cross-repo-task-plan.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/multi-repo-task-plan.json`

#### L-03 补 task plan 单测

**Files:**
- Create: `tests/unit/cross-repo-task-plan.test.js`

**Checklist:**
- 主 repo / 联动 repo 顺序正确
- contract-update / verification 任务不遗漏

### 8.3 任务包 M：Task 10 incremental update

#### M-01 定义 build state schema

**Files:**
- Create: `docs/contracts/cross-repo/cross-repo-build-state.schema.json`

#### M-02 实现 incremental engine

**Files:**
- Create: `src/bootstrap-compiler/cross-repo-incremental.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-build-state.json`
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `src/bootstrap-compiler/orchestrator.js`

**Checklist:**
- 本 repo 变更只更新本 repo
- 契约变更触发跨 repo invalidation
- 非契约但经历史案例证明会传播的变更可触发 invalidation

#### M-03 补 incremental 单测

**Files:**
- Create: `tests/unit/cross-repo-incremental.test.js`

### 8.4 任务包 N：Task 11 rollback / last-known-good

#### N-01 定义 snapshot manifest schema

**Files:**
- Create: `docs/contracts/cross-repo/workspace-snapshot-manifest.schema.json`

#### N-02 扩展 rollback

**Files:**
- Modify: `src/bootstrap-compiler/rollback.js`
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-snapshot-manifest.json`

**Checklist:**
- staged write 有 manifest
- workspace / repo snapshot 可恢复
- 失败时 last-known-good 可恢复

#### N-03 补 rollback 测试

**Files:**
- Create: `tests/unit/cross-repo-rollback.test.js`
- Modify: `tests/e2e/cross-repo-mainline.sh`

### 8.5 任务包 O：Task 12 regression / e2e / 单仓不退化 gate

#### O-01 增加 cross-repo benchmark cases

**Files:**
- Create: `benchmarks/cross-repo/cases.json`

#### O-02 扩展 regression runner

**Files:**
- Modify: `benchmarks/regression/run-regression.js`
- Modify: `benchmarks/regression/baselines.json`

#### O-03 增加 regression 单测

**Files:**
- Create: `tests/unit/cross-repo-regression.test.js`

#### O-04 更新 CI gate

**Files:**
- Modify: `.github/workflows/crg-quality-gate.yml`

**Checklist:**
- single-repo baseline 不退化
- cross-repo 至少一类场景有可测收益
- fallback rate / irrelevant ratio 不显著恶化

### 8.6 Phase 5 完成定义

- `Task 08 / 10 / 11 / 12` 全通过
- 有增量更新状态文件
- 有 snapshot manifest
- 有 regression / e2e / CI gate

---

## 9. Phase 6：试点推广与运维收口

### 9.1 目标

- 让能力不仅能开发完成，还能真正被团队使用

### 9.2 任务清单

#### R-01 补开发者文档

**Files:**
- Create: `docs/08-版本更新/` 下相关说明或专门文档
- Create: `docs/fixtures/cross-repo/rollout-guide.md`

**Checklist:**
- 如何开启 cross-repo 模式
- 什么时候必须显式 workspace 输入
- `Gate A` 未通过时如何解读结果

#### R-02 补故障排查文档

**Files:**
- Create: `docs/fixtures/cross-repo/troubleshooting.md`

**Checklist:**
- artifact 缺失如何处理
- degraded / incomplete 如何解释
- rollback 恢复如何触发

#### R-03 补试点反馈模板

**Files:**
- Create: `docs/fixtures/cross-repo/pilot-feedback-template.md`

**Checklist:**
- 收集误报
- 收集漏报
- 收集 token / latency 成本
- 收集协作收益

### 9.3 Phase 6 完成定义

- 有 rollout 文档
- 有 troubleshooting 文档
- 有 pilot feedback 模板

---

## 10. 全量执行顺序

严格执行顺序如下：

1. `P0-01` 到 `P0-04`
2. `Task 00`
3. `Task 01`
4. `Task 02`
5. `Gate A`
6. `Task 03`
7. `Task 04`
8. `Task 05`
9. `Task 06`
10. `Task 07`
11. `Task 09`
12. `Phase 4 Level 1 验收`
13. `Task 08`
14. `Task 10`
15. `Task 11`
16. `Task 12`
17. `Phase 6 rollout 收口`

禁止以下错误顺序：

- 未完成 `Task 00-02` 先做 impact
- 未完成 `Gate A` 先声称已解决多工程需求识别
- 未完成 `Task 06-07-09` 就宣称 `Level 1` 闭环
- 未有 regression gate 就把 cross-repo 默认打开

---

## 11. 每阶段验收命令清单

### Phase 0

- `bash tests/e2e/cross-repo-mainline.sh`

### Phase 1

- `npx jest tests/unit/cross-repo-invocation.test.js --runInBand`
- `npx jest tests/unit/workspace-registry.test.js --runInBand`
- `npx jest tests/unit/workspace-ownership.test.js --runInBand`
- `npx jest tests/unit/workspace-context.test.js --runInBand`

### Phase 2

- `npx jest tests/unit/cross-repo-coverage-gate.test.js --runInBand`
- `npx jest tests/unit/contract-dependencies.test.js --runInBand`
- `npx jest tests/unit/cross-repo-dependencies.test.js --runInBand`
- `npx jest tests/unit/cross-repo-impact.test.js --runInBand`

### Phase 3

- `npx jest tests/unit/cross-repo-context.test.js --runInBand`
- `npx jest tests/unit/cross-repo-review-routing.test.js --runInBand`
- `npx jest tests/unit/cross-repo-verification.test.js --runInBand`

### Phase 5

- `npx jest tests/unit/cross-repo-task-plan.test.js --runInBand`
- `npx jest tests/unit/cross-repo-incremental.test.js --runInBand`
- `npx jest tests/unit/cross-repo-rollback.test.js --runInBand`
- `npx jest tests/unit/cross-repo-regression.test.js --runInBand`
- `bash tests/e2e/cross-repo-mainline.sh`
- `npm run test:crg:gate`

---

## 12. 最终交付物清单

### Level 1 必须交付

1. `invocation.schema.json`
2. `workspace-repos.schema.json`
3. `service-boundaries.schema.json`
4. `workspace-ownership.schema.json`
5. `contract-dependencies.schema.json`
6. `cross-repo-dependencies.schema.json`
7. `cross-repo-impact.schema.json`
8. `workspace-context.schema.json`
9. `cross-repo-review-routing.schema.json`
10. `cross-repo-verification-matrix.schema.json`
11. `workspace-repos.json`
12. `service-boundaries.json`
13. `workspace-ownership.json`
14. `contract-dependencies.json`
15. `cross-repo-dependencies.json`
16. `cross-repo-impact.json`
17. `workspace-context.json`
18. `cross-repo-review-routing.json`
19. `cross-repo-verification-matrix.json`
20. `cross-repo-coverage-report.md`
21. `level1-acceptance-report.md`

### Level 2 必须交付

1. `multi-repo-task-plan.schema.json`
2. `cross-repo-build-state.schema.json`
3. `workspace-snapshot-manifest.schema.json`
4. `multi-repo-task-plan.json`
5. `cross-repo-build-state.json`
6. `workspace-snapshot-manifest.json`
7. `consumer-delta-report.md`
8. `rollout-guide.md`
9. `troubleshooting.md`
10. `pilot-feedback-template.md`

---

## 13. 开发完成判据

### Level 1 完成判据

1. `Task 00-02` 建立了稳定输入与 identity 真源。
2. `Gate A` 给出了明确上线口径。
3. `Task 03-05` 建立了显式契约优先的联动识别主链。
4. `Task 06-07-09` 让 `plan / work / review` 能真实消费 cross-repo artifact。
5. 历史案例回放达到 `008` 中定义的结果门槛。
6. 单仓路径未明显退化。

### Level 2 完成判据

1. 多工程任务可拆解为 repo 级任务计划。
2. 局部变更可增量更新。
3. 部分失败可 rollback 到 last-known-good。
4. regression / e2e / CI gate 已守住单仓与多仓双基线。

---

## 14. 最终说明

这份清单不是重新讨论“做不做”，而是回答“**怎么按阶段把它做完**”。

执行时，正确姿势不是多个任务同时散开，而是：

1. 先拿下 `Phase 1` 真源
2. 再拿下 `Phase 2` 联动识别
3. 再闭合 `Phase 3` workflow 主链
4. 用 `Phase 4` 决定 `Level 1` 是否真成立
5. 最后再做 `Phase 5-6` 的工程硬化和推广

只有这样，最终产物才会是一个真正可维护、可更新、可迭代的多工程联动需求支持系统，而不是一组看起来很多、但无法稳定消费的 cross-repo 模块。
