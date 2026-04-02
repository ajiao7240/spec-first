# spec-bootstrap v2 产物清单明细表

> 本文定义 `spec-bootstrap` 在 v2 目标态下的长期资产与控制面产物清单。
> 核心目标不是补更多“说明文档”，而是把 Stage-0 升级为研发质量资产生产层。

---

## 1. 产物模型总览

v2 仍然保留“两层产物架构”，但长期资产从“项目认知文档”扩展为“研发质量资产”。

```text
docs/contexts/<slug>/          ← 长期资产（可提交版本库）
.context/spec-first/bootstrap/ ← 控制面（执行期临时，不提交）
```

长期资产分为 5 大资产族：

1. Understanding：帮助理解系统结构和主链路
2. Rules：沉淀硬约束、底线规则和域约束
3. Patterns：沉淀最值得抄的代码模式和标准骨架
4. Decisions：沉淀关键设计取舍和历史约束
5. Risks：沉淀高风险区、高频误判点和过时区域

v2 的设计原则之一是“场景中立”。
它不能默认项目是 Web 中后台，也不能把“列表页/表单页”当作唯一高频任务。
产物模型必须能覆盖：

- 前端 Web
- 后端服务
- 移动端 App
- 桌面端 PC
- CLI 工具
- 异步任务与后台作业
- 数据与 ETL 场景

也就是说，`spec-bootstrap` 产物首先按“资产类型”组织，而不是按“前端任务类型”组织。
具体到某个仓库时，再由条件产物收敛到该仓库实际存在的层和模式。

---

## 2. 长期资产目录树

```text
docs/contexts/<slug>/
├── README.md
├── 00-summary.md
├── architecture/
│   ├── system-overview.md
│   ├── module-map.md
│   ├── integration-boundaries.md
│   └── runtime-topology.md                # 条件
├── rules/
│   ├── index.md
│   ├── coding-rules.md
│   ├── integration-rules.md
│   ├── domain-constraints.md              # 条件
│   ├── testing-rules.md                   # 条件
│   └── data-rules.md                      # 条件
├── patterns/
│   ├── index.md
│   ├── screen-flow.md                     # 条件
│   ├── ui-crud.md                         # 条件
│   ├── api-integration.md                 # 条件
│   ├── state-management.md                # 条件
│   ├── background-jobs.md                 # 条件
│   ├── client-platform.md                 # 条件
│   ├── cli-patterns.md                    # 条件
│   ├── testing-patterns.md                # 条件
│   └── review-hotspots.md
├── decisions/
│   ├── index.md
│   ├── key-decisions.md
│   ├── tradeoffs.md                       # 条件
│   └── historical-constraints.md          # 条件
├── pitfalls/
│   ├── index.md
│   ├── hard-gotchas.md
│   ├── frequent-mistakes.md
│   ├── stale-areas.md                     # 条件
│   └── unsafe-assumptions.md              # 条件
├── layers/
│   ├── frontend/index.md                  # 条件
│   ├── backend/index.md                   # 条件
│   ├── mobile/index.md                    # 条件
│   ├── desktop/index.md                   # 条件
│   ├── cli/index.md                       # 条件
│   ├── shared/index.md                    # 条件
│   └── data/index.md                      # 条件
├── guides/
│   ├── index.md                           # 条件
│   └── task-playbooks.md                  # 条件
└── database/
    ├── database-er.md                     # 条件
    ├── database-index.md                  # 条件
    ├── database-<name>.md                 # 条件，多库
    └── write-sensitive-areas.md           # 条件
```

---

## 3. 核心固定产物

以下文件是 v2 的固定产物，默认每次 bootstrap 都应生成。

| 文件 | 资产族 | 作用 | 负责 worker |
|------|--------|------|-------------|
| `README.md` | Root | 导航 + 任务路由 + 风险提示 | orchestrator |
| `00-summary.md` | Understanding | 项目总览 + 主链路 + 变更入口 | summary-context |
| `architecture/system-overview.md` | Understanding | 系统整体结构与边界 | architecture-context |
| `architecture/module-map.md` | Understanding | 模块职责 + 典型修改点 + 参考实现 | architecture-context |
| `architecture/integration-boundaries.md` | Understanding | 稳定契约、禁止绕过点、边界风险 | architecture-context |
| `rules/index.md` | Rules | 规则路由页，按优先级汇总约束 | rules-context |
| `rules/coding-rules.md` | Rules | 编码底线、依赖约束、目录和错误处理约束 | rules-context |
| `rules/integration-rules.md` | Rules | API、跨模块、鉴权、配置读取约束 | rules-context |
| `patterns/index.md` | Patterns | 模式导航页，按任务类型推荐最像的样板 | patterns-context |
| `patterns/review-hotspots.md` | Patterns | 最常被 review 打回的模式偏差 | patterns-context |
| `decisions/index.md` | Decisions | 关键决策索引 | decisions-context |
| `decisions/key-decisions.md` | Decisions | 当前架构和流程中的高价值决策 | decisions-context |
| `pitfalls/index.md` | Risks | 风险索引页 | pitfalls-context |
| `pitfalls/hard-gotchas.md` | Risks | 一旦踩中就容易造成故障的坑 | pitfalls-context |
| `pitfalls/frequent-mistakes.md` | Risks | 高频错误模式 | pitfalls-context |

---

## 4. 条件产物

## 4.1 architecture 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `architecture/runtime-topology.md` | 多服务、多进程、多运行单元，或存在明显部署拓扑 | 解释运行时拓扑和跨边界调用关系 |

## 4.2 rules 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `rules/domain-constraints.md` | 业务语义、状态机、字段映射、域规则明显存在 | 记录业务域不变量和特例 |
| `rules/testing-rules.md` | 仓库存在明确测试规范、测试层次或强约束 | 记录测试方式、入口和禁区 |
| `rules/data-rules.md` | 存在数据库、迁移、写路径或高风险数据约束 | 记录数据写入、迁移和关键表规则 |

## 4.3 patterns 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `patterns/screen-flow.md` | 存在界面流、导航流、状态流转驱动的客户端工程 | 沉淀页面、导航、生命周期、交互流模式 |
| `patterns/ui-crud.md` | 存在前端或界面型 CRUD 代码 | 沉淀页面/表单/列表/详情等标准骨架 |
| `patterns/api-integration.md` | 存在接口客户端、服务调用、请求封装 | 沉淀接口接入模式 |
| `patterns/state-management.md` | 存在明显状态管理模式 | 沉淀状态、缓存、数据流模式 |
| `patterns/background-jobs.md` | 存在队列、任务、定时器、consumer、worker | 沉淀异步任务模式 |
| `patterns/client-platform.md` | 存在 App、桌面端、跨端容器或平台桥接 | 沉淀平台桥接、生命周期、端能力调用模式 |
| `patterns/cli-patterns.md` | 存在 CLI 工程或命令入口 | 沉淀 CLI 命令设计模式 |
| `patterns/testing-patterns.md` | 存在成熟测试样板 | 沉淀单测、集成、E2E 模式 |

## 4.4 decisions 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `decisions/tradeoffs.md` | 能识别出显式取舍、兼容成本或局部最优方案 | 记录为什么选 A 不选 B |
| `decisions/historical-constraints.md` | 存在历史包袱、迁移残留、组织边界限制 | 记录历史原因导致的非直观设计 |

## 4.5 pitfalls 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `pitfalls/stale-areas.md` | 可识别出过时目录、兼容层或弃用区域 | 标出高过时风险区 |
| `pitfalls/unsafe-assumptions.md` | 存在容易“看起来合理但其实错”的推断点 | 预防误判式研发 |

## 4.6 layers 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `layers/frontend/index.md` | 检测到前端框架或 UI 层 | 前端标准骨架、入口、规则、模式 |
| `layers/backend/index.md` | 检测到后端路由或服务端框架 | 后端分层、入口、模式、禁区 |
| `layers/mobile/index.md` | 检测到移动端项目结构或依赖 | 移动层约束和样板 |
| `layers/desktop/index.md` | 检测到桌面端结构或依赖 | 桌面层约束和样板 |
| `layers/cli/index.md` | 检测到 CLI 入口 | CLI 结构、交互和输出模式 |
| `layers/shared/index.md` | 存在跨层共享代码目录 | 共享模块使用原则 |
| `layers/data/index.md` | 存在独立数据层 | 数据建模、读写、ETL 模式 |

## 4.7 guides 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `guides/index.md` | 至少 3 个活跃 layer 且存在显式跨层依赖 | 跨层导航和关系概览 |
| `guides/task-playbooks.md` | 项目存在高频任务类型且能抽象出标准阅读路径 | 用任务视角串联上下文资产 |

## 4.8 database 扩展文件

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `database/database-er.md` | 单数据库、可连接或可推断 | ER 概览 |
| `database/database-index.md` | 多数据库 | 多库索引 |
| `database/database-<name>.md` | 多数据库 | 单库 ER 概览 |
| `database/write-sensitive-areas.md` | 存在高风险写路径、关键表或强约束数据流 | 标注写敏感区域 |

---

## 5. 每类产物的职责边界

## 5.1 Understanding

回答的问题：

- 系统整体怎么工作
- 主链路是什么
- 哪些目录和模块最重要
- 哪些部分稳定，哪些部分容易变化

不负责：

- 定义硬约束
- 给出强执行建议
- 替代代码样板

## 5.2 Rules

回答的问题：

- 什么不能写错
- 哪些封装必须经过
- 哪些模式禁止使用
- 哪些业务和平台约束不能违反

不负责：

- 描述系统全貌
- 给出完整代码骨架

## 5.3 Patterns

回答的问题：

- 哪类需求最应该参考哪些现有实现
- 标准骨架长什么样
- 哪些部分通常可改，哪些部分不要改

不负责：

- 承担规则层职责
- 输出泛化架构描述

## 5.4 Decisions

回答的问题：

- 为什么这样设计
- 为什么没有选其他方案
- 哪些设计是历史、组织、兼容性导致的

不负责：

- 做全量 ADR 替代
- 重复 Rules 或 Patterns 的内容

## 5.5 Risks

回答的问题：

- 哪里最容易踩坑
- 哪些区域高风险或过时
- 哪些判断容易看似合理但实则错误

不负责：

- 承担规则汇总职责
- 代替完整样板说明

---

## 6. 每个核心文件的必填章节

## 6.1 `README.md`

- `What This Context Covers`
- `Freshness`
- `How To Use This Context`
- `Task Router`
- `Critical Rules`
- `Recommended Patterns`
- `High-Risk Areas`
- `Artifact Index`

## 6.2 `00-summary.md`

- `Project Snapshot`
- `Primary Workflows`
- `Core Modules`
- `Typical Change Entry Points`
- `Stable Areas`
- `Volatile Areas`
- `Read Next`

## 6.3 `architecture/system-overview.md`

- `System Shape`
- `Core Flows`
- `External Dependencies`
- `Runtime Boundaries`
- `Stable vs Volatile`
- `Evidence`

## 6.4 `architecture/module-map.md`

- `Module Inventory`
- `Responsibilities`
- `Typical Changes`
- `Closest Examples`
- `Key Files`
- `Dependencies`
- `Evidence`

## 6.5 `architecture/integration-boundaries.md`

- `Boundary Overview`
- `Hard Contracts`
- `Common Violation Patterns`
- `Do Not Bypass`
- `External Integrations`
- `Evidence`

## 6.6 `rules/*.md`

- `Purpose`
- `Hard Rules`
- `Preferred Choices`
- `Forbidden Patterns`
- `Exceptions`
- `Evidence`
- `Verification Status`

## 6.7 `patterns/*.md`

- `Applicable Scenarios`
- `Recommended References`
- `Standard Skeleton`
- `Replaceable Parts`
- `Stable Parts`
- `Common Mistakes`
- `Evidence`
- `Confidence`

## 6.8 `decisions/*.md`

- `Decision`
- `Context`
- `Why This Exists`
- `Tradeoff`
- `What Future Changes Must Respect`
- `Evidence`

## 6.9 `pitfalls/*.md`

- `Risk`
- `Why It Happens`
- `How To Detect`
- `How To Avoid`
- `Evidence`
- `Severity`

## 6.10 `layers/<layer>/index.md`

- `Role In System`
- `Standard Skeleton`
- `Entry Points`
- `Recommended References`
- `Hard Rules`
- `Integration Shape`
- `Typical Changes`
- `Frequent Mistakes`
- `Evidence`

## 6.11 `guides/task-playbooks.md`

- `Task Type`
- `Read Order`
- `Relevant Rules`
- `Relevant Patterns`
- `Common Risks`
- `Typical Files To Touch`

## 6.12 `database/*.md`

- `Database Scope`
- `Core Entities`
- `Key Relationships`
- `Write-Sensitive Areas`
- `Inference Limits`
- `Evidence`

---

## 7. 证据与可信度标准

所有核心产物都必须支持以下可信度标记：

- `Verified`：由代码、配置、schema、命令输出等直接支撑
- `Inferred`：由结构、命名、使用方式推断，尚未直接验证
- `Unknown`：无法可靠确认，仅作为问题提示，不得包装成事实

关键结论的最低证据要求：

1. 至少 1 个真实文件路径、符号、配置键或 schema 引用
2. 若结论会影响实现选择，优先要求 2 个及以上证据点
3. 对于样板类结论，必须给真实参考实现路径
4. 对于规则类结论，能机械验证时不得只写主观总结

---

## 8. Freshness 标准

每份长期资产都建议包含：

- `Generated At`
- `Bootstrap Version`
- `Analysis Mode`
- `Potentially Stale Areas`

`README.md` 必须明确：

- 当前资产是某个时间点的项目快照
- 后续代码变化可能使局部文档失效
- 哪些区域最值得在 rerun 时优先关注

---

## 9. 通用性设计约束

为了保证 v2 不过拟合单一技术栈，产物清单需要遵守以下约束：

1. `patterns/` 优先按“能力类型”组织，而不是按“前端页面类型”组织
2. `layers/` 是技术层视角，`patterns/` 是实现模式视角，两者不能混同
3. 一个纯后端仓库也应能完整受益于 v2，即使没有任何 `ui-*` 产物
4. 一个移动端或桌面端仓库应能通过 `screen-flow.md`、`client-platform.md`、`state-management.md` 获得高价值模式沉淀
5. 一个 CLI 或数据工程项目应能通过 `cli-patterns.md`、`background-jobs.md`、`data-rules.md` 获得等价支持

建议的场景映射如下：

| 场景 | 优先产物 |
|------|----------|
| 前端 Web | `layers/frontend`、`patterns/screen-flow.md`、`patterns/ui-crud.md`、`patterns/state-management.md` |
| 后端服务 | `layers/backend`、`patterns/api-integration.md`、`patterns/background-jobs.md`、`rules/integration-rules.md` |
| App | `layers/mobile`、`patterns/screen-flow.md`、`patterns/client-platform.md`、`patterns/state-management.md` |
| PC/桌面端 | `layers/desktop`、`patterns/screen-flow.md`、`patterns/client-platform.md` |
| CLI | `layers/cli`、`patterns/cli-patterns.md`、`rules/testing-rules.md` |
| 数据/ETL | `layers/data`、`patterns/background-jobs.md`、`rules/data-rules.md`、`database/write-sensitive-areas.md` |

这张映射表的作用不是固定模板，而是约束 bootstrap 在不同项目类型下优先产出最有价值的资产。

---

## 10. 生成优先级

为避免 v2 一次性扩张过大，建议按优先级生成：

### P0：必须生成

- `README.md`
- `00-summary.md`
- `architecture/system-overview.md`
- `architecture/module-map.md`
- `architecture/integration-boundaries.md`
- `rules/index.md`
- `rules/coding-rules.md`
- `rules/integration-rules.md`
- `patterns/index.md`
- `patterns/review-hotspots.md`
- `decisions/index.md`
- `decisions/key-decisions.md`
- `pitfalls/index.md`
- `pitfalls/hard-gotchas.md`
- `pitfalls/frequent-mistakes.md`

### P1：高价值条件产物

- `layers/*`
- `patterns/screen-flow.md`
- `patterns/ui-crud.md`
- `patterns/api-integration.md`
- `patterns/state-management.md`
- `patterns/client-platform.md`
- `rules/domain-constraints.md`
- `rules/testing-rules.md`
- `guides/index.md`
- `guides/task-playbooks.md`
- `database/*`

### P2：深度增强产物

- `architecture/runtime-topology.md`
- `patterns/background-jobs.md`
- `patterns/cli-patterns.md`
- `patterns/testing-patterns.md`
- `decisions/tradeoffs.md`
- `decisions/historical-constraints.md`
- `pitfalls/stale-areas.md`
- `pitfalls/unsafe-assumptions.md`
- `rules/data-rules.md`
- `database/write-sensitive-areas.md`

---

## 11. 成功标准

v2 产物体系的成功，不再只看“文件生成完整”。

应至少满足以下标准：

1. 后续节点能够快速定位高价值规则和最近似样板
2. 核心文档具备可执行的任务入口，不只是说明
3. 关键实现相关结论大多附带证据
4. `Rules` 和 `Patterns` 能覆盖项目中的高频研发任务
5. 风险文档能有效预警高频错误和高代价误判
6. 文档结构能支持后续自动消费，但不依赖消费编排才有价值

---

## 12. 与 v1 的本质差异

| 维度 | v1 | v2 |
|------|----|----|
| 目标 | 项目上下文生成 | 研发质量资产生成 |
| 强项 | 帮助理解项目 | 帮助理解 + 约束 + 参考 + 防错 |
| 主要产物 | summary / architecture / pitfalls / layers / database | understanding + rules + patterns + decisions + risks |
| 面向对象 | 阅读者 | 后续研发节点与阅读者 |
| 价值核心 | 认知 | 认知 + 可控出码 |

---

## 13. 总结

`spec-bootstrap` v2 的核心，不是“多几份 markdown”，而是把 Stage-0 产物从“架构说明书”升级为“研发质量资产面”。

最关键的结构变化有三点：

1. 新增 `rules/`，把硬约束显式化
2. 新增 `patterns/`，把推荐抄写骨架显式化
3. 新增 `decisions/`，把关键取舍显式化

只有这样，Stage-0 才能真正支撑后续阶段降低原创比例、减少误判、提升交付一致性。
