# 多工程 / 微服务联动需求集成实施计划

> 历史说明：本文中的 benchmark、`test:crg:gate` 等引用属于 2026-04-15 当时的实施背景。相关 benchmark/gate 已在当前实现中退役，因此这些条目只应按历史计划阅读。

**Goal:** 面向“一个需求需要联动多个工程代码”的团队现实，完成 `spec-first` 在 cross-repo / multi-service 场景下的最小可运行主链，使系统能在**已知 workspace 范围**内、在存在 `workspace registry` 或显式 workspace 输入时，稳定回答“涉及哪些工程、为什么涉及、每个工程要做什么、怎么验证没有漏改”。本计划同时区分 `Level 1 可开发主链` 与 `Level 2 工程硬化`，避免把 MVP 一次性扩成平台工程。

**Architecture:** 本计划严格以 [2026-04-15-007-cross-repo-multi-service-demand-integration-capabilities-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-007-cross-repo-multi-service-demand-integration-capabilities-plan.md) 为唯一能力范围基线，以 [2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-15-006-crg-spec-graph-bootstrap-endgame-research-backlog.md) 的 `R0 / R7a / R6` 约束为技术边界。执行顺序固定为：`A 调用契约 -> B 多工程真源 -> C 联动识别 -> D workflow 主链接入 -> E 验证与硬化`。本轮不做终局级 cross-repo symbol graph，不做 cross-repo semantic retrieval，不做 production-grade observability 平台。

**Tech Stack:** Node.js CommonJS、Jest、shell e2e、JSON contract、现有 `bootstrap-compiler / context-routing / crg / benchmark / skills` 体系、可复用的 `impact / ownership / workspace v1 / regression gate` 能力

---

## 1. 计划范围

本计划只覆盖当前必须落地的 9 项 cross-repo 集成能力：

1. `workspace repo registry`
2. `cross-repo dependency index`
3. `cross-repo impact analysis`
4. `cross-repo minimal-context assembly`
5. `cross-repo ownership & review routing`
6. `contract-level dependency extraction`
7. `cross-repo task decomposition`
8. `cross-repo verification matrix`
9. `incremental update + rollback`

本计划完成后，系统必须满足以下最低成功标准：

- 在存在 `workspace registry` 或显式 workspace 输入时，给出需求描述或变更输入，能产出稳定的 `affected repos` 清单
- 每个受影响 repo 都有可解释的 `impact evidence`
- `plan / work / review` 能消费 cross-repo minimal-context
- cross-repo 路由能够输出 owner / review routing
- 系统至少能输出 repo 级 verification matrix；repo 级 task decomposition 作为 Level 2 增强能力
- 单仓路径在引入 cross-repo 能力后不明显退化
- 存在最小 e2e 主链：`invocation -> registry -> dependency/impact -> context -> routing -> verification`

补充边界说明：

- 本计划的 `Level 1` 只解决“**已知 workspace 范围内**的多工程联动识别与装配”，不解决组织级未知 repo 自动发现。
- 若 `Gate A` 证明当前白名单契约类型不足以覆盖团队主要历史案例，则 `Level 1` 对外表述必须自动收缩为“显式契约型跨工程联动识别”，不得继续使用一般性“多工程需求稳定识别”口径。

### 1.1 两级完成定义

#### Level 1：可开发主链

达到以下条件即可进入真实开发试点：

1. 存在稳定的 cross-repo invocation contract
2. 存在 workspace registry 与 ownership/boundary 真源
3. 存在 contract/dependency/impact 主链
4. `plan / work / review` 能消费 workspace context
5. 能输出 cross-repo review routing 与 verification matrix
6. 单仓路径不退化
7. `Gate A` 已给出上线口径：
   - 若 `Gate A` 通过，则可使用“已知 workspace 范围内的多工程联动识别”表述
   - 若 `Gate A` 未通过，则 `Level 1` 仅能以“显式契约型跨工程联动识别”进入试点

#### Level 2：工程硬化

达到以下条件才允许扩大到更多 repo / 契约类型：

1. 增量更新稳定
2. rollback / last-known-good 稳定
3. regression / e2e / gate 完整
4. repo 级 task decomposition 稳定

---

## 2. 非目标

以下内容本轮明确不进入实现范围：

- 真正的 cross-repo symbol graph
- cross-repo semantic retrieval / embedding recall
- cross-repo learned ranking
- durable multi-repo memory
- production-grade observability platform
- 自动生成跨工程发布流水线
- 强制接入外部 CMDB / service catalog 平台

说明：

- 本轮解决的是“多工程联动需求可识别、可装配、可验证”，不是“多工程终局智能平台”。
- 若后续要做 cross-repo semantic retrieval，必须先有本计划的结构底座与评测底座。

---

## 3. 架构原则

### 3.1 必须遵守的实现原则

1. 先 invocation contract，后 registry；先 registry，后 dependency；先 dependency，后 impact；先 impact，后 context assembly。
2. 任何 cross-repo 能力都必须保留 repo 边界，不得直接把多工程结果压平成一个匿名上下文包。
3. 任何聚合结果都必须有 `evidence`，不能只输出推断结论。
4. 任何新能力都必须支持 graceful fallback，不能阻断单仓链路。
5. 任何状态性数据都必须支持增量更新、last-known-good 或等价回退。
6. 契约级依赖优先于“更复杂的代码图”，先解决真实联动，再追求更深结构理解。
7. `inferred` 依赖默认不得直接进入 required routing / required verification，除非通过质量门。

### 3.2 本轮不允许的设计误区

- 把 workspace v1 聚合误当作 cross-repo 主链完成
- 把全量重建当成可接受默认路径
- 先做语义向量搜索，再补结构依赖索引
- 在没有 verification matrix 前声称解决了多工程联动问题
- 把多工程结果匿名压平回单仓 `selected_assets` 语义包，导致 repo 边界丢失

---

## 4. 总体实施顺序与依赖

### 4.1 正确顺序

1. `A 调用契约`
2. `B 多工程真源`
3. `C 联动识别`
4. `D workflow 主链接入`
5. `E 验证与硬化`

### 4.2 依赖图

```text
A 调用契约
  └─ Task 00 cross-repo invocation contract
           ↓
B 多工程真源
  ├─ Task 01 workspace repo registry
  └─ Task 02 workspace ownership / boundary registry
           ↓
C 联动识别
  ├─ Gate A 历史案例 coverage 校准
  ├─ Task 03 contract-level dependency extraction
  ├─ Task 04 cross-repo dependency index
  └─ Task 05 cross-repo impact analysis
           ↓
D workflow 主链接入
  ├─ Task 06 cross-repo minimal-context assembly
  ├─ Task 07 cross-repo ownership & review routing
  └─ Task 09 cross-repo verification matrix
           ↓
E 验证与硬化
  ├─ Task 08 cross-repo task decomposition
  ├─ Task 10 incremental update
  ├─ Task 11 rollback / last-known-good
  └─ Task 12 regression / e2e / 单仓不退化 gate
```

### 4.3 执行纪律

- `Task 00` 未完成前，不得进入 cross-repo impact。
- `Task 01-02` 未完成前，不得进入 cross-repo impact。
- `Gate A` 未完成前，不得宣称“当前契约类型足以覆盖团队主要跨工程联动”。
- `Gate A` 未通过前，不得使用一般性“多工程需求稳定识别”上线口径；`Level 1` 成功定义必须自动收缩为“显式契约型跨工程联动识别”。
- `Task 03-05` 未完成前，不得宣称 cross-repo context 已可用。
- `Task 06-07-09` 完成且 `Gate A` 已给出明确上线口径后，才可宣称 `Level 1` 主链闭环。
- `Task 08-10-11-12` 只定义为 `Level 2` 工程硬化，不得反向阻塞 `Level 1` 试点验证。

---

## 5. Phase A：调用契约

### Task 00：定义 cross-repo invocation contract

**Goal:** 为多工程主链定义稳定调用入口，明确 workspace 输入、变更输入、单仓兼容与 e2e 触发方式。

**Files:**
- Create: `src/context-routing/cross-repo-invocation.js`
- Create: `docs/contracts/cross-repo/invocation.schema.json`
- Test: `tests/unit/cross-repo-invocation.test.js`
- Test: `tests/e2e/cross-repo-mainline.sh`

**Patterns to follow:**
- 输入契约必须显式区分 `single-repo` 与 `workspace`。
- `changedFiles`、`changedContracts`、`workspace` 输入都必须有稳定 schema。
- 不要求首批改造所有 CLI；本轮允许先从 bootstrap / e2e / fixture 调用面打通。

**Steps:**
1. 先补失败测试，定义 invocation schema 与单仓兼容语义。
2. 新建 `cross-repo-invocation.js`，统一解析 workspace 输入与变更输入。
3. 定义 fixture 与 e2e 调用方式，明确谁负责把 invocation 输入传给 impact / context。
4. 跑 unit tests，确认入口真源成立。

**Test scenarios:**
- 单仓输入走原有路径。
- workspace 输入能稳定加载多个 repo。
- `changedFiles` 为空、`changedContracts` 为空时输出 `ok-empty` 或等价状态。
- 非法输入返回结构化错误。

**Verification:**
- `npx jest tests/unit/cross-repo-invocation.test.js --runInBand`

---

## 6. Phase B：多工程真源

### Task 01：建立 workspace repo registry

**Goal:** 为多工程场景建立统一 repo registry，成为后续 cross-repo 识别与路由的输入真源。

**Files:**
- Create: `src/bootstrap-compiler/workspace-registry.js`
- Create: `docs/contracts/cross-repo/workspace-repos.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-repos.json`
- Modify: `src/context-routing/workspace-loader.js`（仅增加 registry-aware 兼容读取，不移除旧输入路径）
- Test: `tests/unit/workspace-registry.test.js`

**Patterns to follow:**
- 复用现有 workspace v1 输入模式，不引入第二套 repoRoots 语义。
- repo registry 只承载 repo 身份真源：`repoRoot`、`slug`、`service_name`、`language`、`role`、`status`。
- 缺少单个 repo 的 metadata 时显式降级，不阻断其他 repo。

**Steps:**
1. 先补失败测试，定义 registry 最小字段、错误路径与 graceful fallback。
2. 新建 `workspace-registry.js`，统一加载并校验 repo 列表。
3. 让 `workspace-loader.js` 增加 registry-aware 兼容读取；在 `Task 00-05` 阶段保留旧路径，禁止移除松散输入 fallback。
4. 产出 `workspace-repos.json` 示例与 schema。
5. 跑 unit tests，确认 registry 真源成立。

**Test scenarios:**
- 单仓输入时仍保持当前路径兼容。
- 多 repo 输入时 registry 字段完整稳定。
- 某个 repo 缺失 role 时显式标记 degraded。
- Windows / Unix 路径都能稳定解析 slug / repoRoot。

**Verification:**
- `npx jest tests/unit/workspace-registry.test.js --runInBand`
- `npx jest tests/unit/workspace-context.test.js --runInBand`

### Task 02：建立 workspace ownership / boundary registry

**Goal:** 在 repo registry 基础上补齐 workspace 级 ownership 与 service boundary 真源，并定义 authority/freshness 规则。

**Files:**
- Create: `src/bootstrap-compiler/service-boundaries.js`
- Modify: `src/bootstrap-compiler/ownership-registry.js`
- Create: `docs/contracts/cross-repo/service-boundaries.schema.json`
- Create: `docs/contracts/cross-repo/workspace-ownership.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/service-boundaries.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-ownership.json`
- Test: `tests/unit/workspace-ownership.test.js`

**Patterns to follow:**
- ownership 与 boundary 必须和 repo registry 对齐，不能形成第三套 identity。
- 允许最小字段，但必须能支持 review routing。
- 不要求组织级 CMDB 集成，本轮只做 repo-local / workspace-local contract。
- 必须显式声明 `authority`、`updated_at` 或等价 freshness 字段；若拿不到高权威源，routing 只能降级为 suggestion。

**Steps:**
1. 先补失败测试，定义 service boundary 与 owner 关联规则。
2. 扩展 ownership registry，支持 workspace 维度读写。
3. 新建 `service-boundaries.js`，校验边界类型和 owner 归属。
4. 生成示例产物与 schema，并定义 freshness / authority 规则。
5. 跑 unit tests，确认 workspace 真源可被消费。

**Test scenarios:**
- service boundary 能映射到 repo。
- ownership 缺失时 review routing 显式 degraded。
- 同一 repo 可挂多个 owner 角色但字段结构稳定。
- authority 过期或缺失时 routing 降级为 suggestion。

**Verification:**
- `npx jest tests/unit/workspace-ownership.test.js --runInBand`

---

## 7. Phase C：联动识别

### Gate A：历史案例 coverage 校准

**Goal:** 在开始 contract-level dependency extraction 前，先验证“当前契约白名单”对团队真实多工程联动的覆盖率是否足够。

**Deliverables:**
- `docs/fixtures/cross-repo-historical-cases.json`
- `docs/fixtures/cross-repo-coverage-report.md`
- `tests/unit/cross-repo-coverage-gate.test.js`

**Rules:**
- 至少选取 5-10 个真实历史多工程需求案例回放。
- 必须按联动来源分层抽样，至少区分：
  - `in_scope_explicit_contract`：OpenAPI / protobuf / GraphQL / message schema / shared SDK manifest
  - `out_of_scope_non_contract`：共享配置、部署编排、脚本生成物、运行时约定、人工流程依赖等
  - `mixed`：同时包含显式契约与非契约联动来源
- 每个案例都必须提供 ground truth：`affected_repos`、`changed_contracts`、`required_reviewers`、`required_verification_paths`、`linkage_source_types`。
- 必须分别统计：
  - `explicit_contract_case_coverage`
  - `all_case_coverage`
  - 漏报来源、误报来源、主要缺失依赖类型
- 若 `explicit_contract_case_coverage` 不足，则不得进入 `Task 03`。
- 若 `all_case_coverage` 不足，则不得继续使用一般性“多工程需求稳定识别”表述，必须降级为“显式契约型联动识别”。

**Verification:**
- `npx jest tests/unit/cross-repo-coverage-gate.test.js --runInBand`

### Task 03：落地 contract-level dependency extraction

**Goal:** 先把真实导致多工程联动的契约对象抽出来，而不是直接做大而全 cross-repo graph。

**Files:**
- Create: `src/bootstrap-compiler/contract-dependencies.js`
- Create: `docs/contracts/cross-repo/contract-dependencies.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/contract-dependencies.json`
- Test: `tests/unit/contract-dependencies.test.js`

**Patterns to follow:**
- 本轮只支持最关键契约类型：OpenAPI / protobuf / GraphQL / message schema / shared SDK manifest。
- 契约输出必须有 `contract_type / producer_repo / consumer_repos / evidence`。
- 无法识别的契约不静默忽略，应输出 `unknown` 或 `incomplete` 状态。
- 每类契约都必须明确 `locator / parser / producer-consumer 判定 / fallback`。

**Steps:**
1. 先写失败测试，定义支持的契约类型、locator、evidence 与 `unknown/incomplete` 结构。
2. 为每种契约类型定义最小规则：支持文件模式、producer/consumer 判定方式、fallback 行为。
3. 实现 `contract-dependencies.js`，扫描约定路径和 manifest。
4. 产出 `contract-dependencies.json`。
5. 跑 unit tests，确认契约对象能稳定抽取。

**Test scenarios:**
- 单个 producer 对多个 consumer 的契约被正确识别。
- 缺失 consumer 映射时保留 incomplete 状态。
- 契约文件变更能被后续 impact 分析消费。
- 不支持类型时输出 `unknown`，而不是静默丢失。

**Verification:**
- `npx jest tests/unit/contract-dependencies.test.js --runInBand`

### Task 04：建立 cross-repo dependency index

**Goal:** 形成统一的跨工程依赖索引，覆盖 API / SDK / topic / contract 等主要联动关系。

**Files:**
- Create: `src/bootstrap-compiler/cross-repo-dependencies.js`
- Create: `docs/contracts/cross-repo/cross-repo-dependencies.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-dependencies.json`
- Test: `tests/unit/cross-repo-dependencies.test.js`

**Patterns to follow:**
- dependency index 先解决“真实联动”，不追求所有代码边。
- 区分 `direct` 和 `inferred` 两类关系。
- 每条依赖都必须保留 `evidence` 与 `source_kind`。
- `inferred` 结果默认不得直接进入 required routing / required verification。

**Steps:**
1. 先补失败测试，定义 direct/inferred/evidence 结构。
2. 组合 registry + contract-dependencies + 配置/manifest 扫描，生成统一索引。
3. 产出 `cross-repo-dependencies.json`。
4. 跑 unit tests，确认 dependency index 可解释、可消费。

**Test scenarios:**
- direct dependency 输出 producer/consumer 边。
- inferred dependency 不会和 direct 混淆。
- 单个 repo 缺失信息时不会拖垮整个索引。
- `inferred` 边默认只进入 advisory 结果集。

**Verification:**
- `npx jest tests/unit/cross-repo-dependencies.test.js --runInBand`

### Task 05：建立 cross-repo impact analysis

**Goal:** 从 changed files / changed contracts 推导跨工程 impact，输出受影响 repo、契约、owner、tests。

**Files:**
- Create: `src/crg/cross-repo-impact.js`
- Create: `docs/contracts/cross-repo/cross-repo-impact.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-impact.json`
- Modify: `src/crg/commands/impact.js`
- Test: `tests/unit/cross-repo-impact.test.js`

**Patterns to follow:**
- 复用单仓 impact 的思路，但输出按 repo 边界聚合。
- 支持从 `changedFiles` 和 `changedContracts` 两个入口触发。
- impact 结果必须包含 `impact_chain` 或等价 evidence。
- 必须定义 `ok-empty / degraded / incomplete / error` 四类空结果与异常语义。

**Steps:**
1. 先补失败测试，定义 cross-repo impact 输出结构。
2. 新建 `cross-repo-impact.js`，组合 dependency index 与 contract dependencies。
3. 让 impact 能输出 `affected_repos / affected_contracts / affected_owners / affected_tests`，并统一空结果语义。
4. 跑 unit tests，确认联动影响半径成立。

**Test scenarios:**
- 改动 producer repo 时，下游 consumer repo 被正确列出。
- 改动 shared contract 时，多个 repo 同时受影响。
- 缺失某条依赖边时仍能保守降级，而不是崩溃。
- 无跨仓影响时输出 `ok-empty` 或等价稳定状态。

**Verification:**
- `npx jest tests/unit/cross-repo-impact.test.js --runInBand`

---

## 8. Phase D：workflow 主链接入

### Task 06：落地 cross-repo minimal-context assembly

**Goal:** 让 `plan / work / review` 能自动消费多工程最小上下文，而不是只依赖单仓 `selected_assets`。

**Files:**
- Create: `src/context-routing/cross-repo-context.js`
- Create: `docs/contracts/cross-repo/workspace-context.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-context.json`
- Modify: `src/context-routing/evaluator.js`
- Modify: `src/context-routing/workspace-loader.js`
- Test: `tests/unit/cross-repo-context.test.js`

**Patterns to follow:**
- 单仓路径不退化，只有存在 `workspace registry` 或显式 workspace 输入才进入 cross-repo assembly。
- 输出必须包含 primary repo、affected repos、shared contracts、candidate tests。
- context 预算不够时按 repo / contract / risk 优先级裁剪。
- cross-repo context 应作为新的 workspace artifact 消费，不能匿名压平成单仓 `selected_assets`。

**Steps:**
1. 先补失败测试，定义 cross-repo context 输出结构与预算裁剪规则。
2. 新建 `cross-repo-context.js`，把 registry + impact + ownership 组合成最小上下文。
3. 扩展 evaluator，使其在 workspace 场景识别 `workspace-context` artifact；单仓 `selected_assets` 语义保持不变。
4. 用现有 `plan / work / review` 主链回放至少 2-3 个多工程需求，对比 single-repo baseline，验证 consumer contract 真实生效，而不是只验证“输出不同”。
5. 跑 unit tests，确认单仓兼容与多仓新增收益。

**Test scenarios:**
- 单仓场景 `selected_assets` 保持原样。
- 多仓场景正确输出 primary/affected/shared/candidate_tests。
- context 超预算时裁剪行为稳定可解释。
- 现有 consumer 在接入 workspace artifact 后，在历史案例上对 `affected repos / required reviewers / required verification` 的命中优于 single-repo baseline。

**Verification:**
- `npx jest tests/unit/cross-repo-context.test.js --runInBand`
- `npx jest tests/unit/workspace-context.test.js --runInBand`

### Task 07：接入 cross-repo ownership & review routing

**Goal:** 让系统能基于 impact 与 ownership 自动输出 review routing。

**Files:**
- Create: `src/context-routing/cross-repo-review-routing.js`
- Create: `docs/contracts/cross-repo/cross-repo-review-routing.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-review-routing.json`
- Modify: `src/bootstrap-compiler/review-queue-state.js`
- Test: `tests/unit/cross-repo-review-routing.test.js`

**Patterns to follow:**
- routing 必须从 impacted repos / contracts 反推 owner，不允许孤立生成 queue 条目。
- 缺失 owner 时降级为 unresolved routing，不阻断主链。
- 结果应区分 required reviewer 和 advisory reviewer。
- 当 ownership authority 不足时，routing 只能输出 suggestion/advisory。

**Steps:**
1. 先补失败测试，定义 routing 输出结构与 unresolved 语义。
2. 实现 `cross-repo-review-routing.js`。
3. 扩展 review queue state，使其可接收跨工程条目。
4. 跑 unit tests，确认 routing contract 稳定。

**Test scenarios:**
- 多个 repo 被影响时，输出多个 reviewer 组。
- 单个 repo owner 缺失时输出 unresolved。
- contract owner 与 repo owner 同时存在时优先级明确。
- authority 过期时 required reviewer 自动降级为 advisory reviewer。

**Verification:**
- `npx jest tests/unit/cross-repo-review-routing.test.js --runInBand`

### Task 08：落地 cross-repo task decomposition（Level 2）

**Goal:** 在 Level 1 主链稳定后，把一个多工程需求自动拆成 repo 级任务序列与依赖顺序。

**Files:**
- Create: `src/context-routing/cross-repo-task-plan.js`
- Create: `docs/contracts/cross-repo/multi-repo-task-plan.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/multi-repo-task-plan.json`
- Test: `tests/unit/cross-repo-task-plan.test.js`

**Patterns to follow:**
- 先输出 repo 级任务，不直接尝试生成极细粒度代码任务。
- task plan 必须标记 `primary`、`dependent`、`contract-update`、`verification` 类型。
- 顺序关系必须可解释。
- 本任务不是 Level 1 主链成立前置条件。

**Steps:**
1. 先补失败测试，定义任务类型、顺序与 blocking contract 结构。
2. 实现 `cross-repo-task-plan.js`，组合 impact + dependency + ownership。
3. 产出 `multi-repo-task-plan.json`。
4. 跑 unit tests，确认分解结果可解释且稳定。

**Test scenarios:**
- 一个主 repo + 两个联动 repo 的任务顺序正确。
- 契约先改后适配的场景能被表达。
- 验证任务不会被遗漏。

**Verification:**
- `npx jest tests/unit/cross-repo-task-plan.test.js --runInBand`

---

## 9. Phase E：验证与硬化

### Task 09：建立 cross-repo verification matrix

**Goal:** 为多工程联动需求输出最小验证矩阵，覆盖 producer/consumer/contract/e2e。

**Files:**
- Create: `src/context-routing/cross-repo-verification.js`
- Create: `docs/contracts/cross-repo/cross-repo-verification-matrix.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-verification-matrix.json`
- Test: `tests/unit/cross-repo-verification.test.js`

**Patterns to follow:**
- verification matrix 是 machine-readable 产物，不只是文案建议。
- 必须显式列出 repo、check_type、required/elective。
- 不做真正执行器，本轮只做矩阵生成与 workflow 消费。
- rollback 单独由 Task 11 负责，不混入 verification matrix 结构。

**Steps:**
1. 先补失败测试，定义 verification matrix 字段。
2. 实现 `cross-repo-verification.js`，从 impact + contracts + candidate tests 生成矩阵。
3. 产出 `cross-repo-verification-matrix.json`。
4. 跑 unit tests，确认矩阵稳定可消费。

**Test scenarios:**
- producer/consumer/contract/e2e 四类检查都能输出。
- 缺少测试映射时显式提示 gap。
- 单仓场景不会错误生成跨工程矩阵。

**Verification:**
- `npx jest tests/unit/cross-repo-verification.test.js --runInBand`

### Task 10：建立 incremental update

**Goal:** 作为 Level 2 硬化能力，支持 repo 局部变更时的增量更新，避免每次全量重建 workspace 结果。

**Files:**
- Create: `src/bootstrap-compiler/cross-repo-incremental.js`
- Create: `docs/contracts/cross-repo/cross-repo-build-state.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/cross-repo-build-state.json`
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `src/bootstrap-compiler/orchestrator.js`
- Test: `tests/unit/cross-repo-incremental.test.js`

**Patterns to follow:**
- 普通 repo 内代码变更只更新本 repo。
- 契约类变更默认触发跨 repo 级联失效；其他被历史案例证明会跨仓传播的变更类型也必须显式纳入 invalidation 规则。
- 增量更新失败时必须能回退到 last-known-good。
- 在覆盖率未验证前，增量路径应允许显式 opt-in，而不是默认强切主链。

**Steps:**
1. 先补失败测试，定义增量更新输入、输出与失效范围。
2. 实现 `cross-repo-incremental.js`，计算受影响 repo 集，并显式建模 invalidation basis。
3. 生成 `cross-repo-build-state.json`，统一记录 `input_fingerprint`、`dependency_revision`、`workspace_snapshot_id`、`repo_snapshot_ids` 与 invalidation basis。
4. 把 run-bootstrap/orchestrator 接到增量路径。
5. 跑 unit tests，确认增量更新与全量路径结果一致性。

**Test scenarios:**
- 单文件变更只更新单 repo。
- shared contract 变更触发多 repo invalidation。
- 增量失败时保守回退。
- 历史案例证明会跨仓传播的非契约变更也能正确 invalidation。

**Verification:**
- `npx jest tests/unit/cross-repo-incremental.test.js --runInBand`

### Task 11：建立 rollback / last-known-good

**Goal:** 作为 Level 2 硬化能力，让 cross-repo 产物在增量失败或部分 repo 异常时可回退。

**Files:**
- Modify: `src/bootstrap-compiler/rollback.js`
- Create: `docs/contracts/cross-repo/workspace-snapshot-manifest.schema.json`
- Create: `.spec-first/workflows/bootstrap/spec-first/workspace-snapshot-manifest.json`
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Test: `tests/unit/cross-repo-rollback.test.js`
- Test: `tests/e2e/cross-repo-mainline.sh`

**Patterns to follow:**
- 回退粒度至少支持 workspace 级与 repo 级。
- 不要求复杂事务系统，本轮只做文件产物级 last-known-good。
- 回退不能污染单仓路径。
- 必须依赖显式 snapshot manifest 与 staged write，而不是隐式文件覆盖。

**Steps:**
1. 先补失败测试，定义部分 repo 失败时的回退行为。
2. 定义 `workspace-snapshot-manifest.json`，明确 staged write、repo snapshot、last-known-good 的记录字段与恢复顺序。
3. 扩展 rollback.js，支持 workspace snapshot manifest 与 staged write 恢复。
4. 补 e2e，验证 cross-repo 主链失败后可恢复。
5. 跑 tests，确认回退成立。

**Test scenarios:**
- 某个 repo incremental 失败时恢复旧 snapshot。
- 某个契约产物损坏时整体不崩。
- 单仓路径继续兼容当前 rollback 语义。

**Verification:**
- `npx jest tests/unit/cross-repo-rollback.test.js --runInBand`
- `bash tests/e2e/cross-repo-mainline.sh`

### Task 12：建立 regression / e2e / 单仓不退化 gate

**Goal:** 作为 Level 2 硬化能力，为 cross-repo 场景建立最小 regression / e2e，确保新能力不会拖垮单仓链路。

**Files:**
- Modify: `benchmarks/regression/run-regression.js`
- Modify: `benchmarks/regression/baselines.json`
- Create: `benchmarks/cross-repo/cases.json`
- Create: `tests/unit/cross-repo-regression.test.js`
- Modify: `.github/workflows/crg-quality-gate.yml`

**Patterns to follow:**
- baseline 必须区分 single-repo 与 cross-repo。
- 先验证单仓不退化，再验证 cross-repo 最小收益。
- Level 2 之前，允许先用最小 shell e2e + unit tests 证明不退化。

**Steps:**
1. 先补失败测试，定义 cross-repo regression 口径。
2. 在 regression 中增加 cross-repo 指标聚合。
3. 增加最小多工程样例。
4. 更新 CI gate，确保单仓与 cross-repo 两条线都被守护。

**Test scenarios:**
- 引入 cross-repo 后 single-repo baseline 不退化。
- cross-repo 问题至少对一类场景带来可测收益。
- fallback rate / irrelevant ratio 没有明显恶化。

**Verification:**
- `npx jest tests/unit/cross-repo-regression.test.js --runInBand`
- `npm run test:crg:gate`
- `bash tests/e2e/cross-repo-mainline.sh`

---

## 10. 空结果语义与状态模型

所有 cross-repo artifacts 都必须统一使用以下状态语义：

1. `ok`：成功生成且存在有效内容
2. `ok-empty`：成功生成但结果为空，例如无跨仓影响、无 candidate tests
3. `incomplete`：部分信息缺失，但结果仍可部分消费
4. `degraded`：上游输入或真源不足，结果仅能保守使用
5. `error`：生成失败，不可消费

所有状态性产物都必须至少包含以下一致性字段：

- `schema_version`
- `generated_at`
- `source_repos`
- `status`
- `input_fingerprint`
- `dependency_revision` 或等价 invalidation basis

增量更新与回滚还必须补充：

- `workspace_snapshot_id`
- `repo_snapshot_ids`
- `staged_write_id`
- `last_known_good_at`

---

## 11. 必须新增的 machine artifacts

本计划默认新增以下 machine artifacts：

### Level 1 必需 artifacts

1. `workspace-repos.json`
2. `service-boundaries.json`
3. `workspace-ownership.json`
4. `contract-dependencies.json`
5. `cross-repo-dependencies.json`
6. `cross-repo-impact.json`
7. `workspace-context.json`
8. `cross-repo-review-routing.json`
9. `cross-repo-verification-matrix.json`

### Level 2 可选/硬化 artifacts

1. `multi-repo-task-plan.json`
2. `workspace-snapshot-manifest.json`
3. `cross-repo-build-state.json`

责任归属：

- `cross-repo-build-state.json` 由 `Task 10 incremental update` 负责生成与更新。
- `workspace-snapshot-manifest.json` 由 `Task 11 rollback / last-known-good` 负责生成与消费。

每个产物都必须包含：

- `schema_version`
- `generated_at`
- `source_repos`
- `status`
- `input_fingerprint`
- `evidence` 或可追溯等价字段

---

## 12. 成功标准

### Level 1 成功标准

前提：仅针对**已知 workspace 范围**的需求；若 `Gate A` 未通过，则以下“多工程”表述自动收缩为“显式契约型跨工程”。

在存在 `workspace registry` 或显式 workspace 输入时，系统必须能稳定回答以下问题：

1. 这次需求涉及哪些 repo？
2. 每个 repo 为什么被牵连？
3. 哪些 shared contracts 被改变？
4. 哪些 owners 必须参与 review？
5. 哪些验证路径必须执行？
6. `plan / work / review` 在历史多工程案例回放中，读入 `workspace-context` 后，对 `affected repos / required reviewers / required verification` 的命中优于 single-repo baseline。

同时必须满足以下结果性校验：

1. 对 `in_scope_explicit_contract` 历史案例，`affected repos` 召回率、`required reviewers` 命中率、`required verification paths` 命中率都必须达到约定门槛。
   - 初始门槛建议：`affected repos recall >= 0.80`、`required reviewers hit rate >= 0.80`（仅统计 authority 有效案例）、`required verification paths hit rate >= 0.80`、`affected repos precision >= 0.60`。
2. 对 `out_of_scope_non_contract` 或 `mixed` 且当前能力无法可靠覆盖的案例，必须输出 `degraded` 或 `incomplete`，并给出明确原因，不能伪装成 `ok`。
3. 若当前只有 advisory 级依据，不得输出 `required reviewer` 或 `required verification` 的强口径。

### Level 2 成功标准

1. 哪些是主改动 repo，哪些是联动适配 repo？
2. 局部 repo 变更后，系统能否增量更新而不是全量重建？
3. rollback / last-known-good 是否稳定？

若上述问题中任一项仍只能靠人脑手工判断，则说明本计划未真正完成。

---

## 13. 迁移与兼容策略

为避免打断当前单仓链路，本计划必须按以下迁移策略执行：

1. `Task 00-05` 先旁路生成新 artifacts，不直接切换现有 consumer。
   - 例外：`Task 01` 允许在 `workspace-loader` 中增加 registry-aware 兼容读取，但不得移除旧路径。
2. `Task 06-07-09` 先双读：保留单仓旧路径，同时允许 workspace artifact 被显式消费。
3. cross-repo 路径默认以显式 workspace 输入或 feature flag 启用，不直接覆盖单仓默认行为。
4. CI gate 先以观察模式记录结果，Level 2 再切换到阻断模式。
5. rollback 时必须明确哪些新产物被忽略、哪些 snapshot 被恢复，避免新旧 contract 混跑。

---

## 14. 风险与回退策略

### 14.1 主要风险

1. dependency index 设计过宽，噪音边过多，导致 impact 误报泛滥
2. contract extraction 规则过窄，漏掉真实联动路径
3. cross-repo context 装配过重，导致 token / latency 快速上升
4. 增量更新失效边界不清，产生陈旧结果
5. 引入 cross-repo 后单仓路径退化
6. workspace ownership / boundary metadata 不够权威，导致 routing 失真

### 14.2 回退策略

1. 若 dependency index 噪音过大，优先收缩到 direct + contract 依赖，不保留过多 inferred 边
2. 若 context 超预算，优先裁剪 affected repos 的低风险上下文，不裁 primary repo / shared contracts
3. 若增量更新不稳定，先回退到 per-repo rebuild，而非 workspace 全量 rebuild
4. 若单仓指标退化，优先把 cross-repo 路径改成显式 opt-in
5. 若 ownership authority 不足，优先把 routing 降级为 suggestion，而不是 required reviewer
6. 若历史案例 coverage 不足，收缩目标为“显式契约型跨工程联动识别”

---

## 15. 最终结论

这不是一个“终局多工程智能平台”的计划，而是一个“让团队当前**已知 workspace 范围内**的多工程联动需求先真正可识别、可装配、可拆解、可验证”的实施计划。

正确顺序必须是：

1. 先建立调用契约
2. 再建立多工程真源
3. 再建立联动识别
4. 再接入 workflow 主链
5. 先完成 Level 1 主链
6. 最后再补 Level 2 验证与增量更新

如果执行顺序被打乱，例如先做语义检索、先做 learned ranking、先做大平台观测，都会显著增加复杂度，并延后真实价值交付。

本计划的完成标志不是“有了更多 cross-repo 模块”，而是：

> 对于一个**已知 workspace 范围内**、且通过 `Gate A` 定义为当前能力可覆盖的多工程需求，在存在 workspace registry 或显式 workspace 输入时，系统已经能稳定产出涉及 repo、联动原因、workspace context、review routing 与 verification matrix；若 `Gate A` 未通过，则对外口径自动收缩为“显式契约型跨工程联动识别”，随后再通过 Level 2 补齐任务拆解、增量更新与回滚硬化。
