# spec-bootstrap v2 需求与实施方案

> 本文是 `spec-bootstrap` v2 的正式需求与实施方案稿。
> 定位是“可进入实现”的主文档，用于统一目标、范围、产物、执行模型和落地顺序。

---

## 1. 背景

`spec-bootstrap` v1 已经建立了 Stage-0 的基础能力，能够为目标仓库生成一组长期上下文资产，帮助后续阶段快速理解：

- 项目总览
- 系统结构
- 模块职责
- 集成边界
- 风险点
- 分层结构
- 数据库 ER

但从“提升研发质量”的目标回看，v1 仍然偏重“理解项目”，没有系统解决以下问题：

1. 后续节点如何减少原创代码比例
2. 后续节点如何更稳定地遵守团队约束
3. 后续节点如何更容易命中既有高质量实现模式
4. 后续节点如何理解历史取舍与隐性边界
5. 后续节点如何区分强事实、弱推断和高风险假设

因此，v2 需要把 Stage-0 从“项目上下文生成”升级为“研发质量资产生成”。

### 1.1 外部实践启发：胶水编程

近期“胶水编程”实践文章进一步强化了这一判断：  
高采纳率 AI 编码的关键，不是持续优化 prompt 让模型“原创得更好”，而是让模型在团队已有资产上做低原创度组装。

该实践将 AI 编码所需信息拆为四层：

1. `任务规格`：这次做什么
2. `开发规范`：什么不能写错
3. `代码模式`：最该抄什么
4. `领域知识`：内部组件、平台约束、业务规则、踩坑经验

这与 `spec-bootstrap v2` 的方向高度一致，尤其强化了三个结论：

1. **SPEC/Plan 不足以单独支撑高质量研发，必须补 Rules 与 Patterns**
2. **最值得沉淀的不是抽象说明，而是最像的参考实现和不可违反的约束**
3. **提升研发质量的核心指标之一，不是“生成了多少代码”，而是“减少了多少无必要原创”**

---

## 2. 核心问题

当前 Stage-0 的主要问题可以概括为四类：

### P1. 只有认知资产，没有执行资产

v1 文档更像“说明书”，而不是“作业手册”。
它能告诉后续节点系统是什么，但不够稳定地告诉它：

- 什么不能写错
- 什么最该抄
- 什么地方最容易被 review 打回

### P2. 规则、样板、决策没有被独立建模

高价值信息目前大量混在架构说明或风险总结中，导致：

- 后续节点检索成本高
- 规则和经验混杂
- 推荐模式不可直接引用

### P3. 证据与可信度表达不足

文档里的许多结论缺少：

- 文件路径
- 符号引用
- 配置证据
- `Verified / Inferred / Unknown`

这会让后续节点难以判断哪些内容可以直接依赖。

### P4. 对多场景项目的通用性不够强

v1 虽然支持 layer 检测，但在思维模型上仍较偏 Web 项目。
v2 必须显式支持：

- 前端 Web
- 后端服务
- 移动端 App
- 桌面端 PC
- CLI 工具
- 数据/ETL
- 异步任务

---

## 3. 目标

## 3.1 产品目标

`spec-bootstrap` v2 的产品目标是：

1. 生成长期可复用的研发质量资产
2. 降低后续阶段的原创比例
3. 降低后续阶段违反项目约束的概率
4. 提高后续阶段命中既有实现模式的概率
5. 提升后续阶段对高风险区域和历史取舍的感知能力
6. 为 `plan / work / review / compound` 提供高质量上游资产

## 3.2 设计目标

v2 的设计目标包括：

1. 建立通用、可扩展的产物模型
2. 明确固定产物与条件产物边界
3. 明确 worker 角色分工和 ownership
4. 提高 PRD 的控制力和可验证性
5. 让文档默认可执行、可引用、可追溯

---

## 4. 非目标

本轮 v2 不负责：

1. 自动将所有产物注入后续节点
2. 代码与文档的全自动双向同步
3. 替代人工架构决策
4. 自动生成全部高价值规则、模式和历史决策
5. 一次性建成完整知识运营系统

也就是说，v2 聚焦在：

> 先把“高价值资产生产模型”设计正确。

---

## 5. 目标用户

v2 面向三类用户：

1. **外部开发者 / 仓库使用者**
   - 希望快速获得项目的高质量上下文
   - 不想从零猜哪些路径、规则和模式最重要

2. **后续 workflow 节点**
   - `plan`
   - `work`
   - `review`
   - `compound`
   这些节点需要结构化、可直接消费的上游资产

3. **框架维护者**
   - 需要一个可演进、可治理、跨项目复用的 Stage-0 模型

---

## 6. 总体方案

## 6.1 总体定义

v2 将长期资产升级为五类资产族：

1. `Understanding`
2. `Rules`
3. `Patterns`
4. `Decisions`
5. `Risks`

完整长期资产目录结构如下：

```text
docs/contexts/<slug>/
├── README.md
├── 00-summary.md
├── architecture/
│   ├── system-overview.md
│   ├── module-map.md
│   ├── integration-boundaries.md
│   └── runtime-topology.md              # 条件
├── rules/
│   ├── index.md
│   ├── coding-rules.md
│   ├── integration-rules.md
│   ├── domain-constraints.md            # 条件
│   ├── testing-rules.md                 # 条件
│   └── data-rules.md                    # 条件
├── patterns/
│   ├── index.md
│   ├── review-hotspots.md
│   ├── screen-flow.md                   # 条件
│   ├── ui-crud.md                       # 条件
│   ├── api-integration.md               # 条件
│   ├── state-management.md              # 条件
│   ├── background-jobs.md               # 条件
│   ├── client-platform.md               # 条件
│   ├── cli-patterns.md                  # 条件
│   └── testing-patterns.md              # 条件
├── decisions/
│   ├── index.md
│   ├── key-decisions.md
│   ├── tradeoffs.md                     # 条件
│   └── historical-constraints.md        # 条件
├── pitfalls/
│   ├── index.md
│   ├── hard-gotchas.md
│   ├── frequent-mistakes.md
│   ├── stale-areas.md                   # 条件
│   └── unsafe-assumptions.md            # 条件
├── layers/
│   ├── frontend/index.md                # 条件
│   ├── backend/index.md                 # 条件
│   ├── mobile/index.md                  # 条件
│   ├── desktop/index.md                 # 条件
│   ├── cli/index.md                     # 条件
│   ├── shared/index.md                  # 条件
│   └── data/index.md                    # 条件
├── guides/
│   ├── index.md                         # 条件
│   └── task-playbooks.md                # 条件
└── database/
    ├── database-er.md                   # 条件
    ├── database-index.md                # 条件
    ├── database-<name>.md               # 条件，多库
    └── write-sensitive-areas.md         # 条件
```

控制面仍保留在：

```text
.context/spec-first/bootstrap/
```

长期资产仍保留在：

```text
docs/contexts/<slug>/
```

## 6.2 方案核心

v2 的核心，不是多写几篇文档，而是新增三件 v1 缺失的东西：

1. `rules/`
2. `patterns/`
3. `decisions/`

并将 `pitfalls/` 从单薄风险入口升级成更可执行的风险资产。

## 6.3 与胶水编程的映射关系

为了避免 v2 继续停留在“认知文档”层，建议显式建立与胶水编程四层物料的映射：

| 胶水编程物料 | `spec-bootstrap v2` 对应资产 |
|--------------|------------------------------|
| 任务规格 | 不由 bootstrap 直接生产，但由后续 `plan` 消费 bootstrap 资产来增强 |
| 开发规范 | `rules/` |
| 代码模式 | `patterns/` |
| 领域知识 | `rules/` + `patterns/` + `pitfalls/` + `decisions/` |

这张映射表的含义是：

- Stage-0 不直接替代 SPEC
- 但 Stage-0 必须把后续最缺的”规则、样板、经验、决策”先准备好
- 这样后续节点才不会继续依赖高原创度生成

## 6.4 三阶段执行模型

v2 采用三阶段执行模型，orchestrator 全程控制：

**Phase 1 - 全局分析与候选提取**

不只做仓库概览，而是为后续 worker 提供多维候选：

- 结构事实：主语言、主框架、顶层目录、服务/包拓扑
- 入口事实：前端页面入口、后端路由入口、CLI 入口、数据迁移入口
- 边界事实：外部服务、内部跨模块调用、数据边界、鉴权边界
- 规则候选：强依赖选择、禁用模式、请求/配置/鉴权约束
- 模式候选：最近似参考实现、高频骨架、高一致性实现
- 决策候选：不直观但稳定存在的模式、明显折中设计、历史兼容痕迹
- 风险候选：高改动热点、容易误判目录、过时区域

Phase 1 输出内部数据视图（`project_snapshot`、`rule_candidates`、`pattern_candidates` 等），**不直接写入长期资产**，而是作为 Phase 2 PRD 的输入。

**Phase 2 - PRD 合同生成**

orchestrator 为每个激活的 worker 生成 PRD 合同，注入 Phase 1 的候选信息，明确：

- 这个 worker 要回答什么核心问题
- 允许的推断边界
- 必须提供的证据要求
- 必须产出的任务入口
- 独占写入的文件 ownership

**Phase 3 - 并行生产与 assembly**

每个 worker 只读各自 PRD、只写各自文件、不改源码、不跑 git 命令。assembly 阶段做质量检查，orchestrator 串行写 `README.md`。

---

## 7. 需求清单

## 7.1 产物模型需求

### R1. 维持两层产物架构

必须保留：

- `docs/contexts/<slug>/`
- `.context/spec-first/bootstrap/`

长期资产与控制面文件必须分离。

### R2. 长期资产必须升级为五类资产族

必须支持：

- `Understanding`
- `Rules`
- `Patterns`
- `Decisions`
- `Risks`

### R3. 必须保留并增强 v1 的理解类资产

至少保留：

- `README.md`
- `00-summary.md`
- `architecture/system-overview.md`
- `architecture/module-map.md`
- `architecture/integration-boundaries.md`
- `layers/*`
- `database/*`

### R4. 必须新增规则资产族

至少支持：

- `rules/index.md`
- `rules/coding-rules.md`
- `rules/integration-rules.md`

并按项目情况扩展：

- `rules/domain-constraints.md`
- `rules/testing-rules.md`
- `rules/data-rules.md`

### R5. 必须新增模式资产族

至少支持：

- `patterns/index.md`
- `patterns/review-hotspots.md`

并按项目情况扩展：

- `patterns/screen-flow.md`
- `patterns/ui-crud.md`
- `patterns/api-integration.md`
- `patterns/state-management.md`
- `patterns/background-jobs.md`
- `patterns/client-platform.md`
- `patterns/cli-patterns.md`
- `patterns/testing-patterns.md`

这些模式文档的目标不是“解释框架常识”，而是尽量沉淀：

- 最像的真实参考实现
- 标准骨架
- 哪些部分可替换
- 哪些部分不要改
- 最常被 review 打回的模式偏差

### R6. 必须新增决策资产族

至少支持：

- `decisions/index.md`
- `decisions/key-decisions.md`

并按项目情况扩展：

- `decisions/tradeoffs.md`
- `decisions/historical-constraints.md`

### R7. 风险资产必须结构化

至少支持：

- `pitfalls/index.md`
- `pitfalls/hard-gotchas.md`
- `pitfalls/frequent-mistakes.md`

并按项目情况扩展：

- `pitfalls/stale-areas.md`
- `pitfalls/unsafe-assumptions.md`

### R8. 应按条件新增导航与任务路径族

当项目存在 3 个及以上活跃 layer 且任务类型明显时，应支持：

- `guides/index.md`
- `guides/task-playbooks.md`

`task-playbooks.md` 的价值是将 `rules/`、`patterns/`、`risks/`、`layers/` 真正串联起来，让后续节点能按任务类型直接定位"先读哪里、最近似参考实现在哪、哪条规则先读"，使资产从"可读"升级为"可串联"。

### 产物生成优先级

为避免 v2 一次性扩张过大，按优先级生成：

**P0：必须生成（固定产物）**

- `README.md`
- `00-summary.md`
- `architecture/system-overview.md`
- `architecture/module-map.md`
- `architecture/integration-boundaries.md`
- `rules/index.md`、`rules/coding-rules.md`、`rules/integration-rules.md`
- `patterns/index.md`、`patterns/review-hotspots.md`
- `decisions/index.md`、`decisions/key-decisions.md`
- `pitfalls/index.md`、`pitfalls/hard-gotchas.md`、`pitfalls/frequent-mistakes.md`

**P1：高价值条件产物**

- `layers/*`
- `patterns/screen-flow.md`、`patterns/ui-crud.md`、`patterns/api-integration.md`、`patterns/state-management.md`、`patterns/client-platform.md`
- `rules/domain-constraints.md`、`rules/testing-rules.md`
- `guides/index.md`、`guides/task-playbooks.md`
- `database/*`

**P2：深度增强产物**

- `architecture/runtime-topology.md`
- `patterns/background-jobs.md`、`patterns/cli-patterns.md`、`patterns/testing-patterns.md`
- `decisions/tradeoffs.md`、`decisions/historical-constraints.md`
- `pitfalls/stale-areas.md`、`pitfalls/unsafe-assumptions.md`
- `rules/data-rules.md`
- `database/write-sensitive-areas.md`

### 各资产族职责边界

每类资产族有明确的职责边界，不得越界，不得混写：

**Understanding（理解类）**

回答：系统整体怎么工作、主链路是什么、哪些目录和模块最重要、哪些部分稳定/容易变化。
不负责：定义硬约束、给出强执行建议、替代代码样板。

**Rules（规则类）**

回答：什么不能写错、哪些封装必须经过、哪些模式禁止使用、哪些业务和平台约束不能违反。
不负责：描述系统全貌、给出完整代码骨架。

**Patterns（模式类）**

回答：哪类需求最应该参考哪些现有实现、标准骨架长什么样、哪些部分通常可改/不要改。
不负责：承担规则层职责、输出泛化架构描述。

**Decisions（决策类）**

回答：为什么这样设计、为什么没有选其他方案、哪些设计是历史/组织/兼容性导致的。
不负责：做全量 ADR 替代、重复 Rules 或 Patterns 的内容。

**Risks（风险类）**

回答：哪里最容易踩坑、哪些区域高风险或过时、哪些判断容易看似合理但实则错误。
不负责：承担规则汇总职责、代替完整样板说明。

---

## 7.2 文档质量需求

### R9. 核心文档必须任务导向

每份核心文档应尽量具备：

- `When To Read`
- `Entry Points`
- `Closest Examples`
- `Read Next`

这是 v2 吸收胶水编程实践后的关键要求之一：  
文档不能只帮助理解项目，还必须帮助后续节点快速定位“最值得抄的代码”和“最该遵守的规则”。

### R10. 高价值结论必须附证据

高价值结论至少应尽量附：

- 文件路径
- 符号
- 配置键
- schema
- 参考实现

证据的最低数量要求：

1. 至少 1 个真实文件路径、符号、配置键或 schema 引用
2. 若结论会影响实现选择，优先要求 2 个及以上证据点
3. 对于样板类结论（`patterns/`），必须给真实参考实现路径
4. 对于规则类结论（`rules/`），能机械验证时不得只写主观总结

### R11. 必须引入可信度标记

统一支持：

- `Verified`
- `Inferred`
- `Unknown`

### R12. 必须提供 freshness 信息

核心文档应尽量具备：

- `Generated At`
- `Bootstrap Version`
- `Potentially Stale Areas`

### R13. 不允许大量无证据的强结论

会直接影响实现选择的结论，如果没有足够证据，不得包装成强事实。

### 每类核心文件的必填章节规范

以下为 v2 各核心文件的必填章节，是 PRD 和 assembly 检查的基准：

**`README.md`**
- `What This Context Covers`
- `Freshness`（生成时间、Bootstrap 版本、可能过时区域）
- `How To Use This Context`
- `Task Router`（按任务类型快速路由）
- `Critical Rules`
- `Recommended Patterns`
- `High-Risk Areas`
- `Artifact Index`（产物目录索引）

**`00-summary.md`**
- `Project Snapshot`（项目一句话定义、技术栈、规模）
- `Primary Workflows`（主要业务流）
- `Core Modules`（核心模块）
- `Typical Change Entry Points`（典型改动从哪里切入）
- `Stable Areas`
- `Volatile Areas`
- `Read Next`

**`architecture/system-overview.md`**
- `System Shape`（系统整体形态）
- `Core Flows`（主链路）
- `External Dependencies`
- `Runtime Boundaries`
- `Stable vs Volatile`
- `Evidence`（支撑以上结论的文件路径/配置/符号）

**`architecture/module-map.md`**
- `Module Inventory`（模块清单）
- `Responsibilities`（各模块职责）
- `Typical Changes`（典型修改点）
- `Closest Examples`（最近似参考实现）
- `Key Files`
- `Dependencies`（模块间依赖）
- `Evidence`

**`architecture/integration-boundaries.md`**
- `Boundary Overview`
- `Hard Contracts`（稳定契约，不能破坏）
- `Common Violation Patterns`（常见绕过方式）
- `Do Not Bypass`（明确禁止绕过的封装）
- `External Integrations`
- `Evidence`

**`rules/*.md`**
- `Purpose`（这份规则文档的范围）
- `Hard Rules`（Must 级，违反即拒绝）
- `Preferred Choices`（Should 级，优先选择）
- `Forbidden Patterns`（Avoid 级，明确禁止）
- `Exceptions`（已知例外）
- `Evidence`
- `Verification Status`（Verified / Inferred / Unknown）

**`patterns/*.md`**
- `Applicable Scenarios`（适用哪类任务）
- `Recommended References`（最近似参考实现路径）
- `Standard Skeleton`（标准骨架代码或伪代码）
- `Replaceable Parts`（可替换部分）
- `Stable Parts`（不要改的部分）
- `Common Mistakes`（最常被 review 打回的偏差）
- `Evidence`
- `Confidence`（Verified / Inferred）

**`decisions/*.md`**
- `Decision`（决策结论）
- `Context`（决策时的背景）
- `Why This Exists`（为什么做这个选择）
- `Tradeoff`（取舍点）
- `What Future Changes Must Respect`（后续修改必须尊重的约束）
- `Evidence`

**`pitfalls/*.md`**
- `Risk`（风险描述）
- `Why It Happens`（为什么会发生）
- `How To Detect`（如何判断是否踩中）
- `How To Avoid`（如何避免）
- `Evidence`
- `Severity`（High / Medium / Low）

**`layers/<layer>/index.md`**
- `Role In System`（这一层在系统中的角色）
- `Standard Skeleton`（该层标准骨架）
- `Entry Points`（入口）
- `Recommended References`
- `Hard Rules`（该层特有约束）
- `Integration Shape`（与其他层的集成方式）
- `Typical Changes`（典型修改点）
- `Frequent Mistakes`
- `Evidence`

**`guides/task-playbooks.md`**
- `Task Type`（任务类型）
- `Read Order`（推荐阅读顺序）
- `Relevant Rules`（相关规则）
- `Relevant Patterns`（相关模式）
- `Common Risks`（典型风险）
- `Typical Files To Touch`（典型需要修改的文件）

**`database/*.md`**
- `Database Scope`
- `Core Entities`（核心实体）
- `Key Relationships`（关键关联关系）
- `Write-Sensitive Areas`（写入敏感区）
- `Inference Limits`（推断局限说明）
- `Evidence`

---

## 7.3 通用性需求

### R14. v2 必须场景中立

不得默认项目是前端 Web 或中后台 CRUD。

### R15. 必须支持多类项目

设计上必须覆盖：

- 前端 Web
- 后端服务
- App
- PC/桌面端
- CLI
- 数据/ETL
- 异步任务

### R16. `patterns/` 必须按能力面组织

`patterns/` 不应只围绕 UI，而应按能力面扩展：

- screen / flow
- UI
- API
- state
- platform bridge
- jobs
- CLI
- testing

这样做的原因之一，是避免把“代码模式”狭义理解成前端页面样板。  
胶水编程的核心不是 CRUD 模板，而是**在任何项目类型里沉淀最值得复用的实现骨架**。

### R17. worker 激活必须由项目信号驱动

不得通过固定前端模板假定所有项目。

建议的项目类型信号：

- **Web/前端**：React / Vue / Angular / Svelte 等框架依赖
- **后端**：HTTP server、RPC server、service entry、框架路由
- **App**：android / ios / flutter / react-native / expo 等
- **PC/桌面端**：Electron / Tauri / .xcodeproj / .csproj / GTK 等
- **CLI**：bin、entry_points、clap、click、cobra 等命令入口
- **Data/ETL**：schema、migration、airflow、dbt、pipeline、job 配置

### 场景映射

不同项目类型的优先产物：

| 场景 | 优先产物 |
|------|----------|
| 前端 Web | `layers/frontend`、`patterns/screen-flow.md`、`patterns/ui-crud.md`、`patterns/state-management.md` |
| 后端服务 | `layers/backend`、`patterns/api-integration.md`、`patterns/background-jobs.md`、`rules/integration-rules.md` |
| App | `layers/mobile`、`patterns/screen-flow.md`、`patterns/client-platform.md`、`patterns/state-management.md` |
| PC/桌面端 | `layers/desktop`、`patterns/screen-flow.md`、`patterns/client-platform.md` |
| CLI | `layers/cli`、`patterns/cli-patterns.md`、`rules/testing-rules.md` |
| 数据/ETL | `layers/data`、`patterns/background-jobs.md`、`rules/data-rules.md`、`database/write-sensitive-areas.md` |

这张映射表不是固定模板，而是约束 bootstrap 在不同项目类型下优先产出最有价值的资产。

---

## 7.4 控制面需求

### R18. v2 必须扩展固定 worker

固定 worker 至少应包括：

- `summary-context`
- `architecture-context`
- `rules-context`
- `patterns-context`
- `decisions-context`
- `pitfalls-context`

### R19. 条件 worker 必须按项目能力面扩展

例如：

- `<layer>-context`
- `guide-context`
- `database-context`
- `domain-rules-context`
- `testing-rules-context`
- `data-rules-context`
- `screen-patterns-context`
- `ui-patterns-context`
- `api-patterns-context`
- `state-patterns-context`
- `client-platform-patterns-context`
- `jobs-patterns-context`
- `cli-patterns-context`
- `testing-patterns-context`

### R20. 必须继续采用文件级 ownership

禁止多个 worker 并写同一文件。

### R21. orchestrator 继续负责 README assembly

共享导航文件仍由 orchestrator 串行写入。

### 文件 ownership 方案

v2 继续采用文件级 ownership，禁止多个 worker 并写同一文件：

| worker | 文件所有权 |
|--------|------------|
| `summary-context` | `00-summary.md` |
| `architecture-context` | `architecture/*` |
| `rules-context` | `rules/index.md`、`rules/coding-rules.md`、`rules/integration-rules.md` |
| `patterns-context` | `patterns/index.md`、`patterns/review-hotspots.md` |
| `decisions-context` | `decisions/index.md`、`decisions/key-decisions.md` |
| `pitfalls-context` | `pitfalls/index.md`、`pitfalls/hard-gotchas.md`、`pitfalls/frequent-mistakes.md` |
| `<layer>-context` | `layers/<layer>/index.md` |
| `guide-context` | `guides/*` |
| `database-context` | `database/*` |
| 条件专项 worker | 对应专项单文件 |
| orchestrator | `README.md` |

### 每个 worker 的核心问题定义

为防止职责漂移，每个 worker 的产出必须能回答以下核心问题：

**`summary-context`**：这个项目做什么 / 主链路是什么 / 后续最常见任务从哪里切入 / 哪些区域稳定、哪些波动大

**`architecture-context`**：系统和模块怎么组织 / 关键边界在哪里 / 哪些契约稳定 / 哪些路径是主路径

**`rules-context`**：什么绝对不能写错 / 哪些封装必须经过 / 哪些惯例已经接近"硬规则"

**`patterns-context`**：哪些任务类型最值得抄现有代码 / 参考实现在哪 / 标准骨架是什么 / review 最常打回哪些模式偏差

**`decisions-context`**：为什么现在的结构和约束是这样 / 哪些选择是折中 / 后续变更必须尊重哪些历史现实

**`pitfalls-context`**：哪些坑代价最大 / 哪些错误最常见 / 哪些判断看似合理实则危险

**`<layer>-context`**：这个层的标准骨架是什么 / 入口在哪 / 应遵守哪些规则 / 最像的参考实现是什么

**`guide-context`**：某类任务应该先看哪些文档 / 阅读顺序是什么 / 需要结合哪些规则和模式

**`database-context`**：数据模型核心关系是什么 / 哪些写路径最敏感 / 哪些地方不能只靠 schema 推断

**专项 patterns worker**：

| worker | 必须回答 |
|--------|----------|
| `screen-patterns-context` | 页面/Screen/导航流的标准组织方式 / 生命周期和页面切换惯例 / 最接近的参考实现 |
| `ui-patterns-context` | 列表/表单/详情等 UI 结构最该抄什么 / 哪些组件组合方式是标准写法 / review 最常打回哪些偏差 |
| `api-patterns-context` | 新接口接入应经过哪些封装 / 调用链和错误处理的标准模式 / 哪些直接调用方式是危险的 |
| `state-patterns-context` | 状态/缓存/派生数据如何组织 / 哪些状态应本地持有/全局共享 / 最接近的状态流样板 |
| `client-platform-patterns-context` | 端能力/平台桥/容器通信如何接入 / 生命周期/权限/前后台切换如何处理 / 哪些端特有约束最容易遗漏 |
| `jobs-patterns-context` | 异步任务/队列消费/幂等/重试的标准模式 / 哪些写法最容易造成重复执行或脏数据 |
| `cli-patterns-context` | 命令结构/参数解析/输出格式/退出码的标准模式 / 哪些用户交互方式应保持一致 |
| `testing-patterns-context` | 当前仓库最成熟的测试样板 / 单测/集成/E2E 分别如何组织 |

---

## 7.5 PRD 合同需求

### R22. PRD 必须从”文件写作说明”升级为”质量资产合同”

### R23. PRD 必须新增关键字段

至少包括：

- `Primary Questions`
- `Candidate Signals`
- `Required Evidence`
- `Task Entry Expectations`
- `Confidence Policy`
- `Freshness Risks`

其中 `Task Entry Expectations` 是吸收胶水编程后非常关键的新增字段。  
worker 最终产物必须帮助后续节点回答：

- 遇到这类任务先看哪里
- 最像的参考实现在哪里
- 哪些规则一定要先读

### R24. PRD 必须显式限制推断边界

worker 只能在允许的范围内下结论。

### R25. PRD 必须要求任务入口输出

否则文档只能读，不能直接用。

### PRD v2 模板字段结构与字段定义

**字段结构：**

```text
Goal                    # 一句话定义交付目标
Primary Questions       # 本 worker 必须回答的问题集合
Context                 # Phase 1 上下文摘要（给路径、符号、配置键）
Candidate Signals       # Phase 1 识别的规则/样板/决策/风险候选
Required Evidence       # 哪些结论必须给代码路径/配置证据/参考实现
Tools                   # Full / Enhanced / Basic 模式声明
Files                   # 独占写入文件清单（逐文件列出）
Rules                   # 执行规则（不改源码、不跑 git、不留占位符）
Task Entry Expectations # 必须产出的任务入口（先看哪里、先读哪条规则）
Confidence Policy       # Verified / Inferred / Unknown 使用策略
Acceptance              # 验收标准（可执行、可信、可复用）
Freshness Risks         # 哪些结论可能因快速演进而变旧
Technical Notes         # 项目特殊约定、命名习惯、术语说明
```

**各字段详细定义：**

**`Goal`**：一句话定义本 worker 的最终交付目标，例如"产出可被后续实现阶段直接消费的后端层规则与模式文档，明确入口、硬约束和最近似参考实现"。

**`Primary Questions`**：本 worker 必须回答的问题集合，是验收的核心基准。若最终文档无法回答其中一项，则视为未完成。

**`Context`**：来自 Phase 1 的上下文摘要。要求给路径、给符号、给配置键、给可验证的结构事实。禁止空泛项目介绍、禁止不指向真实产物的泛化描述。

**`Candidate Signals`**：列出 Phase 1 已识别的候选信息（候选规则、候选样板、候选决策、候选风险），供 worker 进一步验证或筛选，不要求全部采纳。

**`Required Evidence`**（v2 新增）：明确哪些结论必须给代码路径、哪些必须给配置证据、哪些必须给真实参考实现、哪些证据不足时只能标 `Inferred`。例如：所有 `Hard Rules` 至少给 1 个代码或配置证据；所有 `Recommended References` 必须给真实路径。

**`Tools`**：声明当前工具模式（Full / Enhanced / Basic），并明确在此模式下哪些章节可保持强质量、哪些章节可能受限。

**`Files`**：列出独占写入文件清单，逐文件列出，标注文件角色，说明是否允许新增子节。

**`Rules`**：worker 执行规则，至少包括：不改源码、不跑 git 命令、只写文件清单、不把推断包装成事实、不留占位符、不输出泛化废话。

**`Task Entry Expectations`**（v2 新增）：要求 worker 在最终文档中显式产出典型任务入口、推荐阅读顺序、最近似参考实现、典型需要改动的文件。否则文档只能"读"，不能"用"。

**`Confidence Policy`**（v2 新增）：定义本 worker 如何使用 Verified / Inferred / Unknown。强结论默认追求 `Verified`；证据不足但仍有价值的判断标 `Inferred`；无法可靠判断的内容只作为问题提示，不写成事实。

**`Acceptance`**：v2 的验收标准从"结构完整"升级为"可执行、可信、可复用"，统一至少包含：无占位符、有结构化章节、有真实路径/符号/配置证据、有 Verified/Inferred 标记、有任务入口、有最近似参考实现或显式说明未找到、不把规则/模式/风险混在一起。

**`Freshness Risks`**：要求 worker 识别哪些结论可能因仓库快速演进而变旧、哪些参考实现可能是历史残留、哪些区域值得 rerun 时重点复查。

**`Technical Notes`**：记录项目特殊约定、命名习惯、生成限制或术语说明，例如"项目内 client 一词可能同时指 SDK client 和 HTTP client，注意区分"。

其中 `Required Evidence`、`Task Entry Expectations`、`Confidence Policy` 是 v2 相比 v1 最关键的新增字段。

---

## 7.6 质量校验需求

### R26. assembly 阶段必须新增检查

orchestrator 在 worker 完成后，至少做以下检查：

**产物完整性检查：**
- `README.md` 是否正确汇总全部产物
- P0 固定产物是否全部生成
- 激活的条件产物是否全部生成

**内容质量检查：**
- 核心文档是否都有 `Evidence` 章节
- 核心文档是否都有 `Verified/Inferred` 标记
- 是否存在无路径支撑的无证据强结论
- 是否存在明显占位符（如 `TODO`、`[待补充]`、`TBD`）

**资产边界检查：**
- `rules/` 是否确实聚焦约束，未混入大量模式说明
- `patterns/` 是否给真实参考实现，而不是抽象建议
- `pitfalls/` 是否区分了严重度（Severity）和频率
- 是否存在多个文档内容重复或相互矛盾

**可用性检查：**
- 是否缺 `Closest Examples` / `Recommended References`
- 是否缺任务入口（`Task Entry` / `When To Read`）
- `guides/task-playbooks.md`（若存在）是否能按任务类型串联资产

**修复策略：**

必要时 orchestrator 可以：回退单个失败 worker 的产物、生成 partial README 并标注缺失项、标出不可信资产、在最终报告中提示哪些资产需要人工复核。

### R27. rerun 必须继续支持备份恢复

v1 的 rerun 保护机制保留。

### R28. rerun 后应尽量提示 stale 风险

后续应逐步支持：

- 新出现模块
- 失效参考实现
- 规则变更候选
- 风险热点变化

---

## 8. 实施方案

## 8.1 Phase A：产物模型升级

**目标：先把”产什么”定义清楚。**

本阶段交付：

- 确定五类资产族完整目录结构（含固定产物与条件产物边界）
- 新增 `rules/` 资产族及章节规范
- 新增 `patterns/` 资产族及章节规范（包含 Applicable Scenarios / Recommended References / Standard Skeleton / Replaceable Parts / Stable Parts / Common Mistakes）
- 新增 `decisions/` 资产族及章节规范
- 重构 `pitfalls/` 为结构化风险资产（区分 hard-gotchas / frequent-mistakes / stale-areas / unsafe-assumptions）
- 定义 `guides/` 条件资产族（task-playbooks 串联资产）
- 制定每类核心文件的必填章节规范

**Rollout 顺序（第一步）：**

优先升级固定 worker：`summary-context`、`architecture-context`、`rules-context`、`patterns-context`、`pitfalls-context`。这是最直接提升后续研发质量的部分，可最快验证”规则 + 样板 + 风险”是否有价值。

## 8.2 Phase B：worker 与 PRD 升级

**目标：把”怎么稳定地产”做起来。**

本阶段交付：

- 新增固定 worker：`rules-context`、`patterns-context`、`decisions-context`
- 新增条件 worker 完整集合（专项 patterns、domain/testing/data rules、stale/unsafe-assumptions 等）
- 升级 PRD 为 v2 质量资产合同格式（新增 `Primary Questions`、`Required Evidence`、`Task Entry Expectations`、`Confidence Policy` 字段）
- 明确每个 worker 的核心问题定义，防止职责漂移
- assembly 阶段新增质量检查（无占位符、有证据、有任务入口、无规则模式混写）
- 制定项目类型信号检测逻辑，确保 worker 激活由信号驱动

**Rollout 顺序（第二步）：**

补齐 `decisions-context` 和 `guide-context`，让资产从”可读”升级为”可串联”。再补齐专项条件 worker（domain/testing/data rules，screen/UI/API/state/client-platform/jobs/CLI/testing patterns 等）。

## 8.3 Phase C：证据与 freshness 升级

**目标：提高资产可信度。**

本阶段交付：

- 统一引入 `Verified / Inferred / Unknown` 可信度标记
- 核心文档新增 freshness 字段：`Generated At`、`Bootstrap Version`、`Potentially Stale Areas`
- `README.md` 必须说明资产是快照、后续代码变化可能使局部文档失效
- 新增 rerun 差异检测：识别新出现模块、失效参考实现、规则变更候选、风险热点变化
- 增强 stale 提示，rerun 后向用户报告：成功产物、失败产物、可能过时的旧资产、需人工确认的推断结论

## 8.4 Phase D：消费对接

**目标：让正确的资产真正成为后续阶段的默认输入。**

本阶段交付：

- 与 `plan` 的消费链路打通：`plan` 阶段可直接引用 `rules/`、`patterns/`、`decisions/` 作为约束输入
- 与 `work` 的消费链路打通：实现阶段可通过 `guides/task-playbooks.md` 按任务类型快速定位参考实现
- 与 `review` 的消费链路打通：review 阶段可将 `patterns/review-hotspots.md` 和 `pitfalls/frequent-mistakes.md` 作为核查基准
- 与 `compound` 的消费链路打通：知识沉淀阶段可将高价值经验反哺回 `decisions/` 和 `pitfalls/`

---

## 9. 成功标准

### S1. 产物结构成功

v2 能生成新的五类资产结构，而不破坏 v1 的基本可用性。

### S2. 产物质量成功

核心文档具备：

- 任务入口
- 证据
- 可信度
- 推荐参考实现

### S3. 通用性成功

v2 的设计可以同时解释并覆盖：

- Web
- 后端
- App
- PC
- CLI
- 数据
- 异步任务

### S4. 下游价值成功

至少从设计目标上，v2 能明显更好地支撑：

- 降低原创比例
- 降低违反规则概率
- 提高模式复用率
- 提高风险感知能力

### S5. 与胶水编程方法论一致

v2 至少在设计上能够支撑以下目标：

- 让高频研发任务更容易”抄 + 改”，而不是”从零写”
- 让 Rules 与 Patterns 成为一等公民
- 让高价值领域知识不再散落在背景描述里
- 让后续节点默认沿着团队已有最佳实践工作

### S6. 可量化验收指标

以下是判断 v2 是否真正达到质量目标的可量化指标：

| 指标 | 目标值 |
|------|--------|
| P0 固定产物生成率 | 100% |
| 核心文档附有证据的结论比例 | ≥ 80% |
| 核心文档有可信度标记的结论比例 | ≥ 80% |
| `patterns/` 文档给出真实参考实现路径的比例 | ≥ 90% |
| `rules/` 文档每条 Hard Rule 附证据的比例 | ≥ 85% |
| 产物通过 assembly 质量检查的比例 | ≥ 90% |
| 后续 review 中”风格/模式不符”问题占比（参照基准） | 较 v1 下降 |
| 后续 plan 阶段引用 bootstrap 资产的频率（参照基准） | 较 v1 上升 |

前 6 项可在 assembly 阶段自动检测；后 2 项为下游效果指标，需要 Phase D 消费对接完成后追踪。

---

## 10. 开放问题

以下问题可以留到后续设计：

1. `rules/`、`patterns/`、`decisions/` 中哪些允许人工增强并在 rerun 中保留
2. 如何自动发现“最像的参考实现”
3. 如何在不消费编排的情况下衡量下游真实收益
4. 如何在多 workspace/多服务项目中压缩文档体量
5. 不同项目类型下，哪些 patterns 应定义为 P0/P1

---

## 11. 关联文档

- `spec-bootstrap-v2-总体方案.md`
- `spec-bootstrap-v2-演进决策稿.md`
- `spec-bootstrap-v2-产物清单明细表.md`
- `spec-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md`
- `spec-bootstrap-产物文档全览.md`

---

## 12. 最终结论

`spec-bootstrap` v2 的真正目标，不是把 Stage-0 文档写得更厚，而是：

> 让 Stage-0 成为后续研发质量的准备层。

只有当 Stage-0 能稳定生产：

- 规则
- 样板
- 决策
- 风险
- 证据

后续阶段才可能真正做到少原创、少犯规、少误判、少返工。

---

## 13. 技术规格

本节定义 `spec-bootstrap v2` 的完整技术实现规格，包括文件结构、工具链、数据格式、算法和错误处理。

---

### 13.1 Skill 文件结构

```text
skills/spec-bootstrap/
├── SKILL.md                        # 主入口：流程定义、执行协议、验收标准
└── references/
    ├── prd-template.md             # PRD 通用模板（orchestrator 生成 PRD 的骨架）
    ├── database-prd-template.md    # database-context 专用 PRD 模板
    └── mcp-setup.md                # MCP 工具安装与环境验证说明
```

**`SKILL.md` 必须包含的章节：**

```text
---
name: spec-bootstrap
description: Stage-0 研发质量资产生成器，为目标仓库生成 rules/patterns/decisions/risks 等长期资产
---

## Why This Exists
## Prerequisites
## Phase 1: Global Analysis
## Phase 2: PRD Generation
## Phase 3: Parallel Production & Assembly
## Worker Execution Rules
## Acceptance Criteria
## Checklist
```

---

### 13.2 控制面文件结构

控制面位于 `.context/spec-first/bootstrap/`，仅在 bootstrap 执行期存在，建议加入 `.gitignore`。

```text
.context/spec-first/bootstrap/
├── phase1-snapshot.md          # Phase 1 分析结果快照（输入给 Phase 2）
├── worker-registry.md          # 本次激活的 worker 清单与 ownership 分配
├── prd/                        # 各 worker 的 PRD 合同
│   ├── summary-context.md
│   ├── architecture-context.md
│   ├── rules-context.md
│   ├── patterns-context.md
│   ├── decisions-context.md
│   ├── pitfalls-context.md
│   └── <condition-worker>.md   # 按条件动态生成
├── backup/                     # rerun 前备份的上一次产物
│   └── <timestamp>/
│       └── docs/contexts/<slug>/...
└── assembly-report.md          # assembly 质量检查报告
```

**`phase1-snapshot.md` 内部数据视图格式：**

```markdown
# Phase 1 Snapshot

## Project Snapshot
- slug: <project-slug>
- primary_language: TypeScript
- primary_framework: Next.js
- repo_size: 42000 lines
- top_dirs: [src, packages, scripts, docs]
- workspace_topology: monorepo / single-package / multi-service

## Layer Detections
- frontend: YES (React 18, Next.js 14, src/app/)
- backend: YES (Next.js API routes, src/app/api/)
- mobile: NO
- desktop: NO
- cli: NO
- shared: YES (packages/shared/)
- data: YES (prisma/schema.prisma)

## Entry Facts
- frontend_entry: src/app/layout.tsx
- backend_entry: src/app/api/
- cli_entry: null
- migration_entry: prisma/migrations/

## Boundary Facts
- external_services: [Stripe, SendGrid, Sentry]
- internal_cross_module: [packages/shared → src/app]
- auth_boundary: src/middleware.ts
- data_boundary: src/lib/db.ts

## Rule Candidates
- rule_1: 禁止跳过 src/lib/db.ts 直接使用 prisma client（强证据：src/lib/db.ts）
- rule_2: API 路由必须经过 src/lib/auth.ts 鉴权中间件（强证据：src/middleware.ts）
- rule_3: 环境变量必须通过 src/lib/env.ts 读取（推断：多处 import env from lib/env）

## Pattern Candidates
- pattern_1: 标准 API 路由骨架（参考：src/app/api/users/route.ts）
- pattern_2: 标准 Server Action 骨架（参考：src/app/actions/createUser.ts）
- pattern_3: 标准列表页骨架（参考：src/app/users/page.tsx）

## Decision Candidates
- decision_1: App Router 而非 Pages Router（设计选择，非历史包袱）
- decision_2: Prisma 而非 Drizzle（推断：全量使用 Prisma，无 Drizzle 痕迹）

## Risk Candidates
- risk_1: src/app/api/legacy/ 存在废弃 API，仍被 2 处引用
- risk_2: packages/shared/utils 存在循环依赖风险
- risk_3: prisma migration 历史有破坏性变更（20240115_rename_user_table）

## Database Detections
- mysql_connectable: NO
- schema_inferable: YES (prisma/schema.prisma)

## Freshness Notes
- last_analyzed: 2026-04-02T10:30:00Z
- bootstrap_version: v2.0.0
- potentially_stale: [src/app/api/legacy/]
```

---

### 13.3 条件产物精确触发信号

| 产物 | 触发信号（任意一条满足即触发） |
|------|-------------------------------|
| `layers/frontend/index.md` | `package.json` 含 React / Vue / Angular / Svelte / SolidJS / HTMX；或检测到 `src/app`、`src/pages`、`views/` 目录 |
| `layers/backend/index.md` | 存在 API 路由文件；或依赖 Express / Django / Rails / Spring / Gin / Fastify / Hono 等服务端框架 |
| `layers/mobile/index.md` | 存在 `android/`、`ios/`、`flutter/` 目录；或依赖 React Native / Expo |
| `layers/desktop/index.md` | 依赖 Electron / Tauri；或存在 `.xcodeproj`、`.csproj`（含 UseWPF） |
| `layers/cli/index.md` | `package.json` 含 `bin` 字段；或存在 Go main + flag；或依赖 click / argparse / cobra / clap |
| `layers/shared/index.md` | 存在明确的跨层共享目录（`packages/shared`、`libs/`、`common/`） |
| `layers/data/index.md` | 存在 schema 文件、ETL 配置、数据管线（prisma、drizzle、dbt、airflow） |
| `guides/index.md` | 激活层数 ≥ 3 且至少 2 层之间有显式跨层依赖 |
| `guides/task-playbooks.md` | 项目存在高频任务类型（能从代码结构抽象出标准阅读路径） |
| `architecture/runtime-topology.md` | 存在多个服务进程、多个运行单元、或明显部署拓扑 |
| `rules/domain-constraints.md` | 检测到业务状态机、字段映射枚举、复杂校验逻辑 |
| `rules/testing-rules.md` | 存在 `jest.config`、`vitest.config`、`pytest.ini`、`.rspec` 等测试规范文件；或 `__tests__/`、`spec/` 目录下有足够多文件 |
| `rules/data-rules.md` | 存在数据库 migration 文件、写路径封装、强数据约束（事务、唯一约束） |
| `patterns/screen-flow.md` | 存在页面路由、导航栈、生命周期管理（router.push、Navigation、TabBar 等） |
| `patterns/ui-crud.md` | 存在前端或界面型 CRUD 代码（列表/表单/详情组件） |
| `patterns/api-integration.md` | 存在接口客户端封装、服务调用层、请求拦截器 |
| `patterns/state-management.md` | 存在 Redux / Zustand / Pinia / MobX / Provider / useContext 等状态管理依赖或模式 |
| `patterns/background-jobs.md` | 存在 queue、consumer、worker、scheduler、cron 相关代码 |
| `patterns/client-platform.md` | 存在 App 或桌面端平台桥接代码（NativeModules、ipcMain、invoke 等） |
| `patterns/cli-patterns.md` | 存在 CLI 命令结构、参数解析、输出格式化代码 |
| `patterns/testing-patterns.md` | 存在成熟的测试样板（多于 30 个测试文件） |
| `decisions/tradeoffs.md` | 可识别出显式取舍（注释、commit message、配置文件注释包含"instead of"、"we chose" 等） |
| `decisions/historical-constraints.md` | 存在 legacy/、deprecated/、compat/ 目录，或 TODO/FIXME 注释密度高 |
| `pitfalls/stale-areas.md` | 可识别出过时目录、弃用 API、兼容层 |
| `pitfalls/unsafe-assumptions.md` | 存在容易看似合理但实则错误的推断点（如多种写法并存但有隐性优先级） |
| `database/database-er.md` | MySQL 可连接，或存在单 schema 文件可推断 ER |
| `database/database-index.md` | 多数据库 |
| `database/write-sensitive-areas.md` | 存在高风险写路径、唯一键约束、关键业务表写操作 |

---

### 13.4 Phase 1 分析工具链

Phase 1 使用以下工具组合完成全局分析：

| 工具 | 用途 | 调用方式 |
|------|------|----------|
| **GitNexus MCP** | 架构层：模块聚类、执行流、调用关系、影响分析 | `gitnexus_query`、`gitnexus_context`、`gitnexus_impact` |
| **ABCoder MCP** | 符号层：repo 结构、file 结构、AST node、跨文件依赖 | `list_repos`、`get_repo_structure`、`get_package_structure`、`get_ast_node` |
| **文件系统分析** | 目录结构、框架信号检测、配置文件读取 | Glob、Read、Grep |
| **数据库连接** | MySQL schema 推断，ER 生成 | MySQL MCP（可选） |

**Phase 1 推荐分析顺序：**

```text
1. 读取 package.json / go.mod / Cargo.toml / requirements.txt → 确认语言、框架、依赖
2. 扫描顶层目录结构 → 确认 workspace 拓扑、layer 检测
3. GitNexus analyze → 获取模块聚类、执行流、调用关系
4. ABCoder get_repo_structure → 获取 package 列表
5. ABCoder get_package_structure（核心 package）→ 确认主要符号
6. ABCoder get_ast_node（关键 node）→ 提取规则候选、模式候选
7. Grep 关键模式（状态管理、路由、鉴权、测试配置）→ 补充候选信号
8. 汇总到 phase1-snapshot.md
```

---

### 13.5 Phase 2 PRD 生成算法

orchestrator 在 Phase 1 完成后，按以下算法生成 PRD：

```text
for each activated_worker in worker_registry:
  1. 读取 prd-template.md 骨架
  2. 填充 Goal（对应 worker 的核心问题定义）
  3. 填充 Primary Questions（该 worker 必须回答的问题集合）
  4. 从 phase1-snapshot.md 提取相关 Candidate Signals
  5. 制定 Required Evidence（基于该 worker 的资产类型）
  6. 分配 Files（独占写入文件清单，不与其他 worker 重叠）
  7. 填充 Context（包含真实路径、符号、配置键的上下文摘要）
  8. 写入 .context/spec-first/bootstrap/prd/<worker-name>.md
  9. 在 worker-registry.md 中记录 ownership
```

**ownership 冲突检查：** 所有 PRD 生成完成后，orchestrator 必须验证无任何文件被两个 worker 同时声明。如有冲突，则取消冲突文件的低优先级 worker 的对应文件。

---

### 13.6 Phase 3 Worker 执行约束

每个 worker（Codex agent 或 subagent）执行时的硬性约束：

**必须：**

- 只读取自己的 PRD 文件（`.context/spec-first/bootstrap/prd/<worker-name>.md`）
- 只写入 `Files` 章节中声明的文件
- 对每个高价值结论附证据（文件路径、符号、配置键）
- 用 `Verified / Inferred / Unknown` 标记可信度
- 在文档末尾写 `Generated At` 和 `Potentially Stale Areas`
- 删除不适用的模板章节，不保留占位符

**禁止：**

- 修改源代码
- 写入其他 worker 拥有的文件
- 执行 git 命令
- 把推断包装成强事实（无路径证据的断言）
- 保留模板占位符（`[TODO]`、`[待补充]`、`TBD`）
- 输出泛化框架常识而非项目内实际模式

**推荐工具使用顺序（worker 内部）：**

```text
1. 读取 PRD 中的 Context 和 Candidate Signals
2. 用 ABCoder get_ast_node 验证候选信号（获取真实代码）
3. 用 GitNexus 补充模块关系和调用链
4. 用 Grep / Read 精确定位参考实现路径
5. 基于证据撰写文档
```

---

### 13.7 Assembly 算法

orchestrator 在所有 worker 完成后执行 assembly：

```text
Phase 3 Assembly 流程：

1. 产物完整性检查
   - 检查 P0 固定产物是否全部存在
   - 检查激活的条件产物是否全部生成
   - 记录缺失产物列表

2. 内容质量检查（逐文件）
   - grep "TODO\|TBD\|\[待补充\]" → 检测残留占位符
   - grep "Verified\|Inferred\|Unknown" → 检查可信度标记覆盖
   - grep "Evidence\|证据\|参考实现\|路径" → 检查证据章节
   - 检查 patterns/ 文件是否包含真实路径（非泛化描述）

3. 资产边界检查
   - 检查 rules/ 是否混入模式说明（pattern/骨架/示例 关键词）
   - 检查 patterns/ 是否混入规则（must/forbidden/禁止 关键词）
   - 检查 pitfalls/ 是否有 Severity 标记

4. 可用性检查
   - 检查核心文档是否有任务入口章节
   - 检查 patterns/ 是否有 Recommended References 章节
   - 检查 guides/task-playbooks.md（若存在）是否有 Read Order

5. README assembly（串行，由 orchestrator 执行）
   - 汇总所有产物路径
   - 写入 Task Router（按任务类型路由）
   - 写入 Critical Rules 摘要（来自 rules/index.md）
   - 写入 Recommended Patterns 摘要（来自 patterns/index.md）
   - 写入 High-Risk Areas 摘要（来自 pitfalls/index.md）
   - 写入 Freshness（生成时间、Bootstrap 版本、可能过时区域）
   - 写入 Artifact Index（完整产物目录索引）

6. 生成 assembly-report.md
   - 记录通过项、失败项、警告项
   - 对失败项给出修复建议
   - 对存疑产物标注需人工复核

7. 失败处理
   - P0 固定产物失败 → 恢复 backup/ 中的对应文件，标注为 stale
   - P1/P2 条件产物失败 → 保留成功产物，在 README 中标注缺失
   - 质量检查失败 → 在 assembly-report.md 中列出，不回滚
```

---

### 13.8 rerun 机制

**触发条件：** 用户在已有 `docs/contexts/<slug>/` 的仓库上再次运行 `spec-bootstrap`。

**执行流程：**

```text
1. 备份现有产物
   - 将 docs/contexts/<slug>/ 全量复制到
     .context/spec-first/bootstrap/backup/<timestamp>/
   - 记录备份时间戳

2. 差异检测（与上次 Phase 1 快照对比）
   - 新出现的顶层目录或模块
   - 消失的模块（可能是重构或删除）
   - 依赖版本变更（框架大版本升级）
   - 高改动热点（git diff 行数统计）

3. stale 提示生成
   - 对比新旧 phase1-snapshot.md，生成 stale-hints.md：
     * 可能失效的参考实现（原路径已不存在）
     * 可能过时的规则（依赖版本变更）
     * 可能新增的风险热点（新出现高改动目录）
     * 新增模块（尚未覆盖的 layer 或 package）

4. 选择性重新生成
   - 默认：全量重新生成所有 P0 固定产物
   - 可选：只重新生成 stale 提示指向的文件
   - 人工增强保留策略（当前为开放问题，v2 暂不实现）

5. 恢复策略
   - 全量 rerun 失败 → 从 backup/<timestamp>/ 全量恢复
   - 部分 worker 失败 → 从 backup/ 恢复该 worker 对应文件，其余保留新版
```

---

### 13.9 错误处理策略

| 错误类型 | 处理方式 |
|----------|----------|
| Phase 1 工具不可用（GitNexus / ABCoder 未配置） | 降级为 Basic 模式：只用文件系统分析，跳过符号级检测；在 `phase1-snapshot.md` 中标注 `analysis_mode: basic` |
| Phase 1 分析超时 | 保留已完成部分，标注未完成区域，继续 Phase 2（接受部分候选信号缺失） |
| Phase 2 PRD 生成失败（个别 worker） | 跳过该 worker，记录到 `assembly-report.md`，不阻断整体流程 |
| Phase 3 worker 超时或失败 | 标记该 worker 产物为 `FAILED`，在 README 中显式标注该文件缺失；不影响其他 worker |
| 数据库不可连接 | 跳过 `database/database-er.md`，在 `assembly-report.md` 中标注；其他产物不受影响 |
| assembly 质量检查失败 | 不回滚，生成 `assembly-report.md` 列出所有问题，由用户决定是否接受 |
| rerun 备份失败 | 拒绝继续执行，提示用户手动备份后重试 |

---

### 13.10 完整 PRD 示例（rules-context）

以下是 `rules-context` worker 的完整 PRD 示例，展示 v2 PRD 合同的完整形态：

```markdown
# Task PRD: rules-context

## Goal
产出项目级编码规则与集成规则资产，明确硬约束、优先选项和禁止模式，
确保后续实现阶段能快速定位"什么不能写错"。

## Primary Questions
- 哪些约束是后续实现阶段绝对不能违反的
- 哪些封装层不可绕过，必须经过
- 哪些写法已经接近"硬规则"但目前没有显式文档
- 哪些规则能直接从代码或配置中机械验证

## Context
基于 Phase 1 分析：
- 统一请求封装入口：`src/lib/api-client.ts`（Verified）
- 鉴权中间件：`src/middleware.ts`（Verified）
- 环境变量读取封装：`src/lib/env.ts`（Verified）
- 发现 3 处旧模块绕过 api-client 直接 fetch（Inferred，路径：src/app/api/legacy/）
- Prisma client 封装：`src/lib/db.ts`（Verified）

## Candidate Signals
规则候选（来自 phase1-snapshot.md）：
- 禁止跳过 src/lib/api-client.ts 直接使用 fetch（强证据）
- 禁止绕过 src/lib/db.ts 直接 new PrismaClient()（强证据）
- 禁止跳过 src/lib/env.ts 直接读取 process.env（中等证据）
- API 路由必须验证 session，经 src/middleware.ts 或 src/lib/auth.ts（强证据）

## Required Evidence
- 每条 Hard Rule 至少给 1 个真实文件路径（不接受"推断应该有"）
- Forbidden Pattern 必须给真实反例路径或配置证据
- 若某约束无代码证据，只能标 Inferred，不得写成 Must

## Tools
- Enhanced mode（ABCoder + GitNexus + Grep 均可用）

## Files
独占写入：
- docs/contexts/my-project/rules/index.md（路由页）
- docs/contexts/my-project/rules/coding-rules.md（编码底线）
- docs/contexts/my-project/rules/integration-rules.md（集成约束）

## Rules
- 不改源码
- 不跑 git 命令
- 只写上述 3 个文件
- 不把推断包装成事实
- 不保留模板占位符
- 不输出"应该遵循 REST 规范"等泛化常识

## Task Entry Expectations
coding-rules.md 必须能回答：
- "新增一个 API 调用时，第一件事是什么"（先看 api-client.ts）
- "读取环境变量怎么做"（必须通过 env.ts）

integration-rules.md 必须能回答：
- "新路由如何处理鉴权"（接入 middleware.ts 或 auth.ts）
- "数据库操作从哪里开始"（从 src/lib/db.ts 的封装入手）

## Confidence Policy
- 有代码路径直接支撑 → Verified
- 从命名/使用方式推断，未直接验证 → Inferred
- 历史原因类结论，无直接证据 → Unknown
- Unknown 的内容只作为问题提示，不写成规则

## Acceptance
通过验收的最低要求：
1. 每份规则文档有 Hard Rules / Forbidden Patterns / Evidence 章节
2. coding-rules.md 至少给 3 条高价值规则，每条有真实路径
3. integration-rules.md 至少给 3 条约束，每条有真实路径
4. 至少 2 个任务入口（"遇到 X 任务先看哪里"）
5. 无规则与模式混写
6. 无占位符

## Freshness Risks
- src/app/api/legacy/ 旧模块规则可能已无效（该目录计划迁移）
- 若 middleware.ts 重构，鉴权规则需要复查

## Technical Notes
- 项目中"client"一词可能同时指 API client（src/lib/api-client.ts）和
  Prisma client（src/lib/db.ts），写规则时注意区分
- env.ts 当前只处理服务端变量，客户端变量有另一套机制（next.config.js publicRuntimeConfig）
```

---

### 13.11 MCP 依赖说明

v2 依赖以下 MCP 工具（均为可选降级，但影响产物质量）：

#### GitNexus MCP

| 工具函数 | 用途 | Phase |
|----------|------|-------|
| `gitnexus_query` | 查询模块关系、执行流 | Phase 1 |
| `gitnexus_context` | 获取模块上下文摘要 | Phase 1 |
| `gitnexus_impact` | 分析修改影响范围 | Phase 1 |
| `gitnexus_cypher` | 执行图数据库查询 | Phase 1 |

缺失时降级：跳过模块关系分析，仅依赖文件系统结构推断模块边界。

#### ABCoder MCP

| 工具函数 | 用途 | Phase |
|----------|------|-------|
| `list_repos` | 确认 repo 名称 | Phase 1 |
| `get_repo_structure` | 获取 package 列表 | Phase 1 |
| `get_package_structure` | 获取文件和 node 列表 | Phase 1 / Phase 3 |
| `get_file_structure` | 获取文件内 node | Phase 1 / Phase 3 |
| `get_ast_node` | 获取 node 的代码、依赖、引用 | Phase 1 / Phase 3 |

缺失时降级：跳过符号级分析，候选信号质量下降，`Verified` 结论数量减少。

#### 环境验证命令（执行前必须通过）

```bash
claude mcp list          # 确认 GitNexus 和 ABCoder 已挂载
ls .gitnexus/meta.json   # 确认 GitNexus 已完成索引
ls ~/abcoder-asts/*.json # 确认 ABCoder AST 已生成
```

---

### 13.12 技术约束汇总

| 约束维度 | 具体约束 |
|----------|----------|
| 并发安全 | 每个文件只能由一个 worker 写入，orchestrator 在 Phase 2 强制校验 ownership |
| 执行幂等 | rerun 前必须备份，assembly 失败不回滚，保留现场供诊断 |
| 工具降级 | GitNexus / ABCoder 不可用时降级为 Basic 模式，不中断执行 |
| 产物隔离 | 控制面（`.context/`）与长期资产（`docs/contexts/`）严格分离 |
| 版本标记 | 每份产物包含 `Generated At` 和 `Bootstrap Version`，支持 freshness 判断 |
| 大小限制 | 单份产物文档目标 < 200 行，database-er.md < 10KB，避免过大导致消费困难 |
| 模板适配 | 不适用的模板章节应删除，不保留空占位，`index.md` 与实际文件同步 |
