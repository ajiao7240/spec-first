# spec-graph-bootstrap v2 worker 任务拆分与 PRD 模板升级稿

> 本文定义 `spec-graph-bootstrap` v2 的 worker 拆分方式、执行模型和 PRD 合同升级方案。
> 目标不是让 worker 写更多文档，而是让每个 worker 稳定产出可被后续研发节点直接消费的高密度资产。

---

## 1. 设计目标

v2 的 worker 模型需要同时解决 4 个问题：

1. 把“架构认知”与“规则/样板/决策/风险”分开生产
2. 让每个 worker 明确自己要回答的核心问题
3. 让 PRD 不再只是“文件写作说明”，而是“质量资产合同”
4. 让 assembly 阶段能检查产物是否真的可执行、可信、可复用

v2 的 worker 体系还必须满足一个附加目标：

5. 不过拟合单一研发场景，能覆盖前端、后端、App、PC、CLI、数据和异步任务等项目类型

---

## 2. v1 的主要不足

v1 的 worker 划分为：

- `summary-context`
- `architecture-context`
- `pitfalls-context`
- `<layer>-context`
- `database-context`

这套划分有两个优点：

- 简单
- 文件 ownership 清晰

但也有明显不足：

1. `architecture-context` 承担过重，既写结构，又隐含规则和模式
2. 没有专职 worker 识别硬约束
3. 没有专职 worker 识别最近似样板和标准骨架
4. 没有专职 worker 提炼关键决策与历史限制
5. PRD 更偏“写文件任务”，不够强调证据、可信度和任务入口

---

## 3. v2 worker 总体模型

建议将 worker 拆分为“固定 worker + 条件 worker + 组装职责”。

worker 的拆分原则不应建立在“前端页面开发”之上，而应建立在“资产类型 + 项目能力面”之上。
这样同一套框架才能跨仓库复用。

### 3.1 固定 worker

| worker | 负责产物 | 主要问题 |
|--------|----------|----------|
| `summary-context` | `00-summary.md` | 这个项目整体是什么，后续从哪里切入 |
| `architecture-context` | `architecture/*` | 系统怎么组织，模块怎么协作 |
| `rules-context` | `rules/index.md`、`rules/coding-rules.md`、`rules/integration-rules.md` | 什么不能写错 |
| `patterns-context` | `patterns/index.md`、`patterns/review-hotspots.md` | 最该抄什么，最容易写歪什么 |
| `decisions-context` | `decisions/index.md`、`decisions/key-decisions.md` | 为什么现在是这样 |
| `pitfalls-context` | `pitfalls/index.md`、`pitfalls/hard-gotchas.md`、`pitfalls/frequent-mistakes.md` | 哪里最容易出事故 |

### 3.2 条件 worker

| worker | 触发条件 | 负责产物 |
|--------|----------|----------|
| `<layer>-context` | 检测到对应 layer | `layers/<layer>/index.md` |
| `guide-context` | 多层、跨层关系复杂或任务类型明显 | `guides/index.md`、`guides/task-playbooks.md` |
| `database-context` | MySQL 可连接或可推断 | `database/*` |
| `domain-rules-context` | 检测到明显域约束 | `rules/domain-constraints.md` |
| `testing-rules-context` | 测试规范足够明显 | `rules/testing-rules.md` |
| `data-rules-context` | 存在强数据约束 | `rules/data-rules.md` |
| `screen-patterns-context` | 存在 screen/page/navigation/flow 模式 | `patterns/screen-flow.md` |
| `ui-patterns-context` | 存在 UI/CRUD 模式 | `patterns/ui-crud.md` |
| `api-patterns-context` | 存在请求封装和接口接入模式 | `patterns/api-integration.md` |
| `state-patterns-context` | 存在明显状态管理模式 | `patterns/state-management.md` |
| `client-platform-patterns-context` | 存在 App、桌面端、跨端容器、平台桥接 | `patterns/client-platform.md` |
| `jobs-patterns-context` | 存在 jobs/queue/worker | `patterns/background-jobs.md` |
| `cli-patterns-context` | 存在 CLI | `patterns/cli-patterns.md` |
| `testing-patterns-context` | 存在成熟测试样板 | `patterns/testing-patterns.md` |
| `tradeoffs-context` | 能识别取舍信息 | `decisions/tradeoffs.md` |
| `historical-constraints-context` | 能识别历史包袱 | `decisions/historical-constraints.md` |
| `stale-risk-context` | 能识别过时区域 | `pitfalls/stale-areas.md` |
| `unsafe-assumptions-context` | 存在高风险误推断点 | `pitfalls/unsafe-assumptions.md` |
| `write-sensitive-context` | 存在高风险写路径 | `database/write-sensitive-areas.md` |

### 3.3 orchestrator 职责

orchestrator 仍由主控实例承担，不引入新的固定 orchestrator agent。

职责包括：

1. Phase 1 做全局分析
2. 确定 worker 集合
3. 生成每个 worker 的 PRD
4. 控制文件 ownership
5. 汇总结果并串行写 `README.md`
6. 做产物质量检查与 rerun 恢复决策

---

## 4. v2 三阶段执行模型

## Phase 1：全局分析与候选提取

这一阶段不再只做“仓库概览”，而是要为后续 worker 提供多维候选。

### 必须产出的 Phase 1 分析结果

1. 结构事实
   - 主语言
   - 主框架
   - 顶层目录
   - 服务/包/workspace 拓扑

2. 入口事实
   - 前端页面入口
   - 后端路由入口
   - CLI 入口
   - 数据迁移入口

3. 边界事实
   - 外部服务
   - 内部跨模块调用
   - 数据边界
   - 鉴权边界

4. 规则候选
   - 强依赖选择
   - 禁用模式
   - 请求/配置/鉴权约束
   - 测试规则和数据规则候选

5. 模式候选
   - 最近似参考实现
   - 高频页面/服务/任务骨架
   - 高一致性实现模式

6. 决策候选
   - 命名和组织不直观但稳定存在的模式
   - 明显折中设计
   - 历史兼容痕迹

7. 风险候选
   - 高改动热点
   - 容易误判的目录
   - 过时区域
   - 高频失败模式

### Phase 1 输出应形成的内部数据视图

```text
project_snapshot
artifact_candidates
rule_candidates
pattern_candidates
decision_candidates
risk_candidates
layer_detections
database_detections
freshness_notes
```

这些信息不直接写入长期资产，而是成为 Phase 2 PRD 的输入。

### Phase 1 的通用性要求

在 Phase 1 做检测时，orchestrator 不能先入为主地假设项目是 Web。
至少应先判断项目主类型，再决定激活哪些专项 worker。

建议的项目类型信号包括：

- Web/前端：React/Vue/Angular/Svelte/Solid/HTMX 等
- 后端：HTTP server、RPC server、framework、worker、service entry
- App：android/ios/flutter/react-native/expo 等
- PC/桌面端：Electron/Tauri/.xcodeproj/.csproj/GTK/JavaFX 等
- CLI：bin、main、entry_points、clap、click、cobra 等
- Data/ETL：schema、migration、airflow、dbt、pipeline、job 配置等

worker 的激活必须由这些信号驱动，而不是由固定模板驱动。

---

## Phase 2：PRD 合同生成

v2 的 PRD 必须从“写文件说明”升级为“质量资产合同”。

每份 PRD 应明确：

1. 这个 worker 要回答什么问题
2. 它必须提供什么证据
3. 它允许推断到什么程度
4. 它必须产出哪些任务入口
5. 它如何标记可信度
6. 它有哪些禁止行为

---

## Phase 3：并行生产与 assembly

每个 worker：

- 只读自己的 PRD
- 只写自己拥有的文件
- 只在允许的推断边界内下结论
- 不改源码
- 不跑 git 命令

assembly 阶段新增质量检查：

1. 是否存在无证据强结论
2. 是否核心文件缺 `Verified/Inferred`
3. 是否缺 `Closest Examples`
4. 是否规则和模式混写
5. 是否缺任务入口章节
6. 是否 README 未正确汇总新产物

---

## 5. 文件 ownership 方案

v2 继续采用文件级 ownership，避免并行冲突。

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

严禁多个 worker 共写一个文件。

---

## 6. PRD v2 模板结构

建议在保留 v1 的基本骨架上，升级为以下结构：

```text
Goal
Primary Questions
Context
Candidate Signals
Required Evidence
Tools
Files
Rules
Task Entry Expectations
Confidence Policy
Acceptance
Freshness Risks
Technical Notes
```

下面是逐节定义。

## 6.1 Goal

一句话定义本 worker 的最终交付目标。

示例：

> 产出可被后续实现阶段直接消费的后端层规则与模式文档，明确入口、硬约束和最近似参考实现。

## 6.2 Primary Questions

本 worker 必须回答的问题集合。

示例：

- 这个层或主题最重要的入口是什么
- 哪些实现模式最稳定
- 哪些写法最容易被 review 打回
- 哪些结论已经验证，哪些只是推断

## 6.3 Context

来自 Phase 1 的上下文摘要。

要求：

- 给路径
- 给符号
- 给配置键
- 给可验证的结构事实

禁止：

- 空泛项目介绍
- 不指向真实产物的泛化描述

## 6.4 Candidate Signals

列出 Phase 1 已识别的候选信息，供 worker 进一步验证或筛选。

示例：

- 候选规则
- 候选样板
- 候选决策
- 候选风险

## 6.5 Required Evidence

这是 v2 最关键的新章节之一。

要求说明：

- 哪些结论必须给代码路径
- 哪些结论必须给配置证据
- 哪些结论必须给真实参考实现
- 哪些结论没有足够证据时只能标 `Inferred`

示例：

- 所有 `Hard Rules` 至少给 1 个代码或配置证据
- 所有 `Recommended References` 必须给真实路径
- 所有“历史原因”类结论若无直接证据，标记为 `Inferred`

## 6.6 Tools

声明当前工具模式：

- `Full`
- `Enhanced`
- `Basic`

同时明确：

- 在当前模式下，哪些章节可保持强质量
- 哪些章节可能受限

## 6.7 Files

列出独占写入文件清单。

要求：

- 逐文件列出
- 标注文件角色
- 说明是否允许新增子节

## 6.8 Rules

worker 执行规则。

至少包括：

- 不改源码
- 不跑 git 命令
- 只写文件清单
- 不把推断包装成事实
- 不留占位符
- 不输出泛化废话

## 6.9 Task Entry Expectations

这是 v2 第二个关键新增章节。

要求 worker 在最终文档中显式产出：

- 典型任务入口
- 推荐阅读顺序
- 最近似参考实现
- 典型需要改动的文件

否则文档只能“读”，不能“用”。

## 6.10 Confidence Policy

定义本 worker 如何使用：

- `Verified`
- `Inferred`
- `Unknown`

要求：

- 强结论默认追求 `Verified`
- 证据不足但仍有价值的判断标 `Inferred`
- 无法可靠判断的内容只作为问题提示，不写成事实

## 6.11 Acceptance

v2 的验收标准应从“结构完整”升级为“可执行、可信、可复用”。

建议统一至少包含：

1. 无占位符
2. 有结构化章节
3. 有真实路径/符号/配置证据
4. 有 `Verified/Inferred`
5. 有任务入口
6. 有最近似参考实现或显式说明未找到
7. 不把规则、模式、风险混在一起

## 6.12 Freshness Risks

要求 worker 识别：

- 哪些结论可能因仓库快速演进而变旧
- 哪些参考实现可能是历史残留
- 哪些区域值得 rerun 时重点复查

## 6.13 Technical Notes

记录项目特殊约定、命名习惯、生成限制或术语说明。

---

## 7. PRD v2 示例骨架

```markdown
# Task PRD: rules-context

## Goal
产出项目级编码与集成规则资产，明确硬约束、优先选项和禁止模式。

## Primary Questions
- 哪些约束是后续实现阶段必须遵守的
- 哪些封装不可绕过
- 哪些规则能直接从代码或配置中验证

## Context
- 发现 `src/api/client.ts` 是统一请求封装入口
- 多个模块通过 `config/serviceHost.ts` 解析服务地址
- 测试目录中存在统一 test helper

## Candidate Signals
- 候选规则：禁止直接 fetch
- 候选规则：服务地址必须经 host map
- 候选风险：多个旧模块绕过统一 client

## Required Evidence
- 每条 Hard Rule 至少给 1 个真实文件路径
- 每条 Forbidden Pattern 必须给反例路径或配置证据

## Tools
- Enhanced mode

## Files
- docs/contexts/<slug>/rules/index.md
- docs/contexts/<slug>/rules/coding-rules.md
- docs/contexts/<slug>/rules/integration-rules.md

## Rules
- 不改源码
- 不跑 git 命令
- 只在证据允许范围内下结论
- 不输出无路径支撑的强规则

## Task Entry Expectations
- 文档中必须给“新增接口接入先看哪里”
- 文档中必须给“新增页面时哪些规则最常踩错”

## Confidence Policy
- Direct code/config facts → Verified
- Strong pattern guess without direct proof → Inferred
- Unclear historical reasons → Unknown

## Acceptance
- 每份规则文档有 Hard Rules / Forbidden Patterns / Evidence
- 至少给 3 条高价值规则
- 至少给 2 个任务入口
- 无规则与模式混写

## Freshness Risks
- host map 正在迁移，旧模块规则可能部分失效

## Technical Notes
- 项目内“client”一词可能同时指 SDK client 和 HTTP client，注意区分
```

---

## 8. 通用性导向的 worker 激活策略

为了避免 v2 只在前端 CRUD 场景下效果好，建议明确一张“项目类型 → 优先 worker”映射表。

| 项目类型 | 优先 worker |
|----------|-------------|
| 前端 Web | `summary-context`、`architecture-context`、`rules-context`、`patterns-context`、`screen-patterns-context`、`ui-patterns-context`、`state-patterns-context`、`pitfalls-context` |
| 后端服务 | `summary-context`、`architecture-context`、`rules-context`、`patterns-context`、`api-patterns-context`、`jobs-patterns-context`、`pitfalls-context`、`database-context` |
| App | `summary-context`、`architecture-context`、`rules-context`、`patterns-context`、`screen-patterns-context`、`client-platform-patterns-context`、`state-patterns-context`、`pitfalls-context` |
| PC/桌面端 | `summary-context`、`architecture-context`、`rules-context`、`patterns-context`、`screen-patterns-context`、`client-platform-patterns-context`、`pitfalls-context` |
| CLI | `summary-context`、`architecture-context`、`rules-context`、`patterns-context`、`cli-patterns-context`、`testing-rules-context`、`pitfalls-context` |
| 数据/ETL | `summary-context`、`architecture-context`、`rules-context`、`patterns-context`、`jobs-patterns-context`、`data-rules-context`、`database-context`、`pitfalls-context` |

这张表的意义在于：

- 不同场景共享同一套 Stage-0 资产模型
- 不同场景只激活自己最有价值的专项 worker
- 规则、模式、风险这些能力在所有项目类型中都是共通的一等公民

---

## 9. 各 worker 的问题定义

为了避免职责漂移，建议明确每个 worker 的核心问题。

## 9.1 `summary-context`

必须回答：

- 这个项目做什么
- 主链路是什么
- 后续最常见任务从哪里切入
- 哪些区域稳定，哪些波动大

## 9.2 `architecture-context`

必须回答：

- 系统和模块怎么组织
- 关键边界在哪里
- 哪些契约稳定
- 哪些路径是主路径

## 9.3 `rules-context`

必须回答：

- 什么绝对不能写错
- 哪些封装必须经过
- 哪些惯例已经接近“硬规则”

## 9.4 `patterns-context`

必须回答：

- 哪些任务类型最值得抄现有代码
- 参考实现在哪
- 标准骨架是什么
- review 最常打回哪些模式偏差

## 9.5 `decisions-context`

必须回答：

- 为什么现在的结构和约束是这样
- 哪些选择是折中
- 后续变更必须尊重哪些历史现实

## 9.6 `pitfalls-context`

必须回答：

- 哪些坑代价最大
- 哪些错误最常见
- 哪些判断看似合理实则危险

## 9.7 `<layer>-context`

必须回答：

- 这个层的标准骨架是什么
- 入口在哪
- 应遵守哪些规则
- 最像的参考实现是什么

## 9.8 `guide-context`

必须回答：

- 某类任务应该先看哪些文档
- 阅读顺序是什么
- 需要结合哪些规则和模式

## 9.9 `database-context`

必须回答：

- 数据模型核心关系是什么
- 哪些写路径最敏感
- 哪些地方不能只靠 schema 推断

---

## 9.10 专项 patterns worker 的问题定义

### `screen-patterns-context`

必须回答：

- 页面/Screen/导航流的标准组织方式是什么
- 生命周期和页面切换有哪些惯例
- 最接近的参考实现是什么

### `ui-patterns-context`

必须回答：

- 列表/表单/详情/交互区域等 UI 结构最该抄什么
- 哪些组件组合方式是标准写法
- 哪些 UI 模式最常被 review 打回

### `api-patterns-context`

必须回答：

- 新接口接入应该经过哪些封装
- 调用链组织和错误处理的标准模式是什么
- 哪些直接调用方式是危险的

### `state-patterns-context`

必须回答：

- 状态、缓存、派生数据、订阅流如何组织
- 哪些状态应本地持有，哪些应全局或共享
- 最接近的状态流样板是什么

### `client-platform-patterns-context`

必须回答：

- 端能力、平台桥、容器通信应如何接入
- 生命周期、权限、前后台切换等平台问题如何处理
- 哪些端特有约束最容易遗漏

### `jobs-patterns-context`

必须回答：

- 异步任务、队列消费、幂等、重试的标准模式是什么
- 哪些作业写法最容易造成重复执行或脏数据

### `cli-patterns-context`

必须回答：

- 命令结构、参数解析、输出格式、退出码的标准模式是什么
- 哪些用户交互方式应保持一致

### `testing-patterns-context`

必须回答：

- 当前仓库最成熟的测试样板是什么
- 单测、集成、E2E 分别应该如何组织

---

## 10. assembly 阶段的质量检查

orchestrator 在 worker 完成后，应至少做以下检查：

1. `README.md` 是否正确汇总全部产物
2. 核心文档是否都有 `Evidence`
3. 核心文档是否都有 `Verified/Inferred`
4. `rules/` 是否确实聚焦约束，不混入大量模式说明
5. `patterns/` 是否给真实参考实现，而不是抽象建议
6. `pitfalls/` 是否区分严重度和频率
7. `guides/` 是否能按任务类型串联资产
8. 是否存在多个文档重复、冲突或相互打架

必要时，orchestrator 可以：

- 回退单个失败 worker 的产物
- 生成 partial README
- 标出不可信资产
- 在最终报告中提示哪些资产需要人工复核

---

## 11. rerun 与恢复策略

v2 继续保留 v1 的备份机制，但需要更细化的恢复策略。

### 建议策略

- P0 核心固定资产失败：优先恢复备份
- P1/P2 条件资产失败：允许保留成功产物并写 partial README
- `rules/patterns/decisions` 若未来支持人工增强，rerun 时应允许保留人工段落

最终需要向用户报告：

- 成功产物
- 失败产物
- 可能过时的旧资产
- 需要人工确认的推断结论

---

## 12. rollout 建议

建议按以下顺序升级 worker 与 PRD。

### 第一步：升级固定 worker

- `summary-context`
- `architecture-context`
- `rules-context`
- `patterns-context`
- `pitfalls-context`

原因：

- 这是最直接提升后续研发质量的部分
- 可最快验证“规则 + 样板 + 风险”是否有价值

### 第二步：补齐 decisions 和 guides

- `decisions-context`
- `guide-context`

原因：

- 让资产从“可读”升级成“可串联”

### 第三步：补齐专项条件 worker

- domain/testing/data rules
- screen/UI/API/state/client-platform/jobs/CLI/testing patterns
- stale/write-sensitive/historical constraints

原因：

- 这些是高价值但项目依赖性更强的增强项

---

## 13. 总结

v2 的 worker 升级，本质上是把 `spec-graph-bootstrap` 从“并行写几篇架构文档”升级为“并行生产研发质量资产”。

最关键的变化有四点：

1. 新增 `rules-context`、`patterns-context`、`decisions-context`
2. PRD 新增 `Primary Questions`、`Required Evidence`、`Task Entry Expectations`、`Confidence Policy`
3. assembly 阶段新增“可执行性与可信度”检查
4. worker 的职责从“写文件”升级为“回答后续研发最关键的问题”

只有这样，Stage-0 的并行执行模型才真正服务于研发质量，而不是只服务于文档产出。
