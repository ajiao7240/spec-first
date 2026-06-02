# 多工程 / 微服务联动需求场景集成能力方案

> Lifecycle: historical-input / external-reference. 本文保留旧架构、方案、迁移或研究记录；当前 source of truth 以 `docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/` 和 `CHANGELOG.md` 为准。

## 1. 文档目标

本文档回答的问题不是：

- `CRG + spec-graph-bootstrap` 终局研究项有哪些
- 多仓库是不是最终都要做成全局超级图
- 当前系统还能继续加哪些高级算法

本文档回答的问题是：

> 在团队微服务拆分过细、一个需求往往需要修改多个工程代码的现实前提下，`spec-first` 当前最应该集成进来的功能是什么，才能真正提升需求理解、任务拆分、上下文装配、评审与验证效率？

因此，本文档是：

- 面向当前团队现状的能力集成方案
- 面向“多工程联动需求”场景的近期实施基线
- 对 `006` 终局研究项在现实组织场景下的落地收敛

本文档不是：

- 终局级 cross-repo symbol graph 的完整实现计划
- 一份无边界的技术愿望单
- 对当前单仓能力价值的否定

---

## 2. 当前团队问题画像

在微服务拆分过细的团队里，真正的痛点通常不是“不会写某个服务内的代码”，而是：

1. 一个需求落地前，无法快速知道到底涉及哪些工程。
2. 即使知道涉及多个工程，也不知道修改顺序、依赖顺序和验证顺序。
3. 当前上下文选择仍偏单仓，AI 很容易只在一个 repo 内局部最优。
4. 契约类变更比实现类变更更容易漏掉消费者和下游联动。
5. 多工程联动需求的评审责任、验证责任、回归责任没有自动显式化。
6. 如果每次都全量重建全部工程上下文，成本过高且难以维护。

因此，当前最需要补的不是“更强单仓智能”，而是：

> 让系统先能稳定回答“这次需求为什么会跨多个工程、具体跨哪些工程、每个工程要做什么、怎么验证没有漏改”。

---

## 3. 当前已有基础能力

结合当前代码实现，系统已经具备的基础包括：

- Stage-0 contract + evaluator 主链
- CRG retrieval / impact / chunking 最小闭环
- workspace v1 最小聚合
- ownership registry 最小版
- review queue lifecycle 最小版
- telemetry / regression / benchmark gate 最小闭环

这些能力说明当前不是从零开始，而是已经有若干可复用底座。

但当前对“多工程联动需求”的支持仍然不够，原因在于：

- workspace v1 还是聚合 helper，不是跨工程理解主链
- impact 仍以单仓 blast radius 为主
- ownership / review queue 还没有成为真正的跨工程路由器
- minimal-context 仍未升级成“多工程联动上下文装配器”
- 验证能力还没有收敛成跨工程验证矩阵

---

## 4. 设计原则

本方案必须遵守以下原则：

1. 先解决真实需求联动问题，不为“终局感”堆复杂能力。
2. 先补跨工程依赖识别与上下文装配，再考虑更强 semantic 能力。
3. 先保证可维护、可增量更新、可回滚，不做全量重建依赖的大系统。
4. 先把契约级联动识别做对，再扩展到更深层符号图。
5. 复杂性应藏在系统内部，用户入口仍应保持少量稳定命令。

---

## 5. 正确的问题分解

面对“一个需求修改多个工程”的团队现实，系统必须逐个解决以下问题：

1. 这次需求涉及哪些工程？
2. 这些工程为什么会被牵连？
3. 哪些是主修改工程，哪些是联动适配工程？
4. 哪些共享契约发生了变化？
5. 哪些 owner 需要参与 review 或确认？
6. 哪些测试、契约校验、集成路径必须验证？
7. 这次变更如何在后续增量更新时保持可维护？

只有这七个问题都能被系统回答，AI 才能真正帮助团队处理多工程联动需求。

---

## 6. 当前必须集成的能力总表

| 优先级 | 能力 | 目标 | 当前是否已有骨架 | 当前是否必须集成 |
|---|---|---|---|---|
| P0 | workspace repo registry | 把多工程集合、边界、owner、语言、角色统一建模 | 部分有 | 是 |
| P0 | cross-repo dependency index | 识别服务间真实联动关系 | 否 | 是 |
| P0 | cross-repo impact analysis | 判断需求或改动会影响哪些工程/契约/测试 | 部分有 | 是 |
| P0 | cross-repo minimal-context assembly | 为 plan/work/review 自动装配多工程最小上下文 | 部分有 | 是 |
| P0 | cross-repo ownership & review routing | 自动识别谁应参与评审与确认 | 部分有 | 是 |
| P1 | contract-level dependency extraction | 把 API / schema / topic / SDK 依赖识别出来 | 否 | 是 |
| P1 | cross-repo task decomposition | 自动拆成主工程任务 + 联动工程任务 | 否 | 是 |
| P1 | cross-repo verification matrix | 自动列出必须验证的多工程路径 | 否 | 是 |
| P1 | incremental update & rollback | 支持局部更新，避免每次全量重算 | 部分有 | 是 |
| P2 | cross-repo semantic retrieval | 提升抽象查询与长尾需求召回 | 否 | 否 |
| P2 | cross-repo learned ranking | 提升多工程上下文排序质量 | 否 | 否 |
| P2 | durable multi-repo memory | 长期积累跨工程历史知识 | 否 | 否 |

---

## 7. P0：当前必须先集成的能力

### 7.1 workspace repo registry

#### 目标

为所有参与联动需求的工程建立统一 registry，回答：

- 当前 workspace 里有哪些 repo
- 每个 repo 的角色是什么
- 每个 repo 的 owner / review group 是谁
- 每个 repo 属于什么边界

#### 为什么必须先做

如果没有 registry，后续所有 cross-repo 能力都没有稳定输入。

现在的 `workspace v1` 只能聚合 repo 结果，但还不能作为跨工程理解的真源。

#### 正确产物

- `workspace-repos.json`
- `service-boundaries.json`
- `workspace-ownership.json`

#### 必须满足

- 显式声明 repoRoot、slug、service_name、language、owner、boundary_type
- 支持新增 repo 的增量注册
- 缺失单个 repo 时整体优雅降级

---

### 7.2 cross-repo dependency index

#### 目标

识别工程间真实依赖，不只看源码 import，而是关注真正导致“一个需求要改多个工程”的依赖。

#### 必须覆盖的依赖类型

1. API 调用依赖
2. SDK / package 依赖
3. topic / queue / event 依赖
4. shared schema / protobuf / OpenAPI / GraphQL 依赖
5. shared config / feature flag / auth / tenant contract 依赖

#### 为什么必须先做

这是回答“为什么这次需求会跨多个工程”的第一性能力。

没有这层，系统只能做 repo 聚合，不能做联动推理。

#### 正确产物

- `cross-repo-dependencies.json`
- `contract-dependencies.json`
- `dependency-evidence.json`

#### 必须满足

- 区分 direct dependency 和 inferred dependency
- 每条跨工程依赖都要能给出 evidence
- 支持局部 repo 变更后的增量更新

---

### 7.3 cross-repo impact analysis

#### 目标

从“这次需求或改动了哪些文件/契约”推导出：

- impacted repos
- impacted contracts
- impacted owners
- impacted tests
- impacted deploy units

#### 为什么必须先做

这是多工程联动场景中，最直接提升效率的功能。

单仓 `impact` 已经证明 blast radius 很有价值，但团队真正需要的是：

> 从单仓 blast radius 升级到跨工程联动影响半径。

#### 正确产物

- `cross-repo-impact.json`
- `affected-repos.json`
- `affected-contracts.json`

#### 必须满足

- 支持从 changed files 和 changed contracts 两个入口出发
- 输出必须按 repo 边界聚合
- 必须给出 impact chain 和置信依据

---

### 7.4 cross-repo minimal-context assembly

#### 目标

为 `plan / work / review` 自动装配“本次需求真正需要看的多工程最小上下文”。

#### 正确输出应包含

- primary repo
- downstream impacted repos
- upstream dependency repos
- shared contracts
- candidate tests by repo
- risk hotspots by repo

#### 为什么必须先做

如果 AI 仍然以单仓上下文为主，即使知道涉及多个工程，也无法真正帮助团队做多工程任务拆解。

#### 正确产物

- `workspace-context.json`
- `multi-repo-plan-context.json`
- `multi-repo-review-context.json`

#### 必须满足

- 单仓路径不退化
- 多工程模式必须显式可解释
- context 超预算时按 repo / contract / risk 优先级裁剪

---

### 7.5 cross-repo ownership & review routing

#### 目标

自动识别：

- 哪些 owner 需要参与
- 哪些服务负责人需要确认
- 哪些 repo 需要 review queue 条目

#### 为什么必须先做

在多工程联动需求里，技术问题往往不是“谁能写”，而是“谁必须知道、谁必须 review、谁负责边界解释”。

#### 正确产物

- `cross-repo-review-routing.json`
- `cross-repo-review-queue.json`
- `affected-owners.json`

#### 必须满足

- ownership 读取以 registry 为真源
- route 必须能追溯到 impacted repo / contract
- 单个 owner 缺失时不阻断整个链路

---

## 8. P1：紧接着必须补齐的能力

### 8.1 contract-level dependency extraction

#### 目标

把真正会引发多工程联动的“契约对象”抽出来。

#### 为什么重要

在微服务团队里，真正导致联动修改的，很多时候不是函数调用，而是契约变化。

#### 当前最应该支持的契约对象

- OpenAPI
- protobuf / thrift
- GraphQL schema
- message schema
- shared DTO / SDK
- auth / permission / tenant contract

#### 结果

这会让系统从“看代码关系”升级到“看服务协作关系”。

---

### 8.2 cross-repo task decomposition

#### 目标

把一个需求自动拆成：

- 主改动工程任务
- 联动适配工程任务
- 契约更新任务
- 测试补齐任务
- 发布/回滚准备任务

#### 为什么重要

当前团队最缺的不是 plan，而是跨工程任务边界和依赖顺序。

#### 正确输出

- `multi-repo-task-plan.json`
- `repo-task-breakdown.md`

#### 必须满足

- 输出 repo-by-repo task list
- 标记 blocking contracts
- 标记先后顺序和并行边界

---

### 8.3 cross-repo verification matrix

#### 目标

告诉团队：这次需求完成后，最小必须验证哪些 repo、哪些链路、哪些契约。

#### 验证矩阵至少包含

- producer tests
- consumer compatibility checks
- contract checks
- e2e path checks
- deploy order checks
- rollback safety checks

#### 为什么重要

多工程需求最容易出现“主工程改完了，但消费者没验证”。

#### 正确输出

- `cross-repo-verification-matrix.json`
- `verification-checklist.md`

---

### 8.4 incremental update & rollback

#### 目标

让整个多工程能力支持可维护的日常更新，而不是每次全量重建。

#### 必须满足

1. repo 内普通代码变更，只更新本 repo 索引
2. 契约变更时，只对受影响 repo 做级联失效
3. workspace 结果支持 last-known-good 回退
4. index/schema 更新支持版本迁移

#### 为什么重要

这不是优化项，而是多工程能力能否长期运维的前提。

如果每次都全量重算所有工程，系统很快会不可维护。

---

## 9. P2：当前不应优先集成的能力

### 9.1 cross-repo semantic retrieval

有价值，但当前不应先做。

因为如果没有稳定的 cross-repo dependency / contract index，semantic retrieval 只会扩大噪音召回范围。

### 9.2 cross-repo learned ranking

有价值，但当前不应先做。

因为没有跨工程 benchmark 和 relevance labels，排序增强收益不可验证。

### 9.3 durable multi-repo memory

长期有价值，但不是当前一线痛点。

当前最痛的是：

- 哪些工程受影响
- 为什么受影响
- 应该先改谁
- 应该验证什么

而不是记忆积累不够。

---

## 10. 正确的实施顺序

### Phase A：建立多工程输入真源

1. workspace repo registry
2. workspace ownership registry
3. service / boundary registry

### Phase B：建立联动识别能力

1. cross-repo dependency index
2. contract-level dependency extraction
3. cross-repo impact analysis

### Phase C：接入 workflow 主链

1. cross-repo minimal-context assembly
2. cross-repo ownership & review routing
3. cross-repo task decomposition

### Phase D：建立验证与运维闭环

1. cross-repo verification matrix
2. incremental update
3. rollback / last-known-good
4. regression fixtures for multi-repo scenarios

---

## 11. 必须新增的产物与 contract

建议新增以下机器产物：

1. `workspace-repos.json`
2. `service-boundaries.json`
3. `workspace-ownership.json`
4. `cross-repo-dependencies.json`
5. `contract-dependencies.json`
6. `cross-repo-impact.json`
7. `workspace-context.json`
8. `cross-repo-review-routing.json`
9. `multi-repo-task-plan.json`
10. `cross-repo-verification-matrix.json`

建议新增以下 contract 原则：

1. 每个产物必须包含 `generated_at`、`schema_version`、`source_repos`
2. 每个 cross-repo 结论必须有 `evidence`
3. 每个聚合结果必须保留 repo 边界
4. 每个 machine artifact 必须有 graceful fallback 语义

---

## 12. 成功标准

当以下问题能被系统稳定回答时，说明当前集成方向是正确的：

1. 给一个需求描述，系统能列出可能涉及的 repo 清单。
2. 系统能解释每个 repo 为什么被牵连。
3. 系统能输出 repo 级任务拆分与先后顺序。
4. 系统能输出 repo 级验证矩阵。
5. 单个 repo 代码变更后，系统能局部更新，而不是全量重建。
6. 在多工程模式下，单仓路径没有明显退化。

---

## 13. 当前集成清单

按当前团队现状，正确的“当前集成清单”应统一为以下 9 项：

1. `workspace repo registry`
2. `cross-repo dependency index`
3. `cross-repo impact analysis`
4. `cross-repo minimal-context assembly`
5. `cross-repo ownership & review routing`
6. `contract-level dependency extraction`
7. `cross-repo task decomposition`
8. `cross-repo verification matrix`
9. `incremental update + rollback`

其中：

- `1-5` 解决“这次需求会牵连哪些工程、为什么牵连、应该把哪些上下文装进来”
- `6-8` 解决“如何围绕共享契约拆任务、派评审、补验证”
- `9` 解决“这套系统能否长期维护，而不是每次全量重算”

---

## 14. 最终结论

结合当前团队“微服务拆分过细、一个需求需要改多个工程”的现实，当前最该集成的不是更多单仓算法强化，而是以下能力组：

1. `workspace repo registry`
2. `cross-repo dependency index`
3. `cross-repo impact analysis`
4. `cross-repo minimal-context assembly`
5. `cross-repo ownership & review routing`
6. `contract-level dependency extraction`
7. `cross-repo task decomposition`
8. `cross-repo verification matrix`
9. `incremental update & rollback`

如果严格按完整集成清单执行，则应按以下顺序推进：

1. `workspace repo registry`
2. `cross-repo dependency index`
3. `cross-repo impact analysis`
4. `cross-repo minimal-context assembly`
5. `cross-repo ownership & review routing`
6. `contract-level dependency extraction`
7. `cross-repo task decomposition`
8. `cross-repo verification matrix`
9. `incremental update + rollback`

如果只能先做最核心的前三项，则应优先做：

1. `cross-repo dependency index`
2. `cross-repo impact analysis`
3. `cross-repo minimal-context assembly`

因为这三项一旦落地，系统就能先回答：

> 这次需求到底涉及哪些工程，为什么涉及，应该把哪些工程的上下文一起装进来。

这才是当前团队最真实、最紧迫、也最能落地的研发效能提升点。
