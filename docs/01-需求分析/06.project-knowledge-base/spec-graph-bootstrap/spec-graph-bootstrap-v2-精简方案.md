# spec-graph-bootstrap v2 精简方案

> 本文是对 `spec-graph-bootstrap-v2-需求与实施方案.md` 的精简重写。
> 目标：在不损失核心价值的前提下，大幅收紧 scope，让 v2 第一版可以真正落地。

---

## 一句话定位

Stage-0 从"项目上下文生成器"升级为"研发质量资产生成器"：
在 v1 基础上新增 `rules/`、`patterns/`、`decisions/` 三类资产，让后续节点能**抄+改**而非从零写。

---

## 边界

### 做什么

- 新增 `rules/`、`patterns/`、`decisions/` 三类资产族
- 产出有任务入口、有真实路径证据、有可信度标记的执行型文档
- 支持 `Verified / Inferred / Unknown` 三级标记
- 保留 v1 已有的条件产物（layers、database、guides）

### 不做什么（本版）

- 不新增专题化 patterns（screen-flow、api-integration 等）延后到 v2.1
- 不做 rerun 差异检测（只保留基础备份）
- 不做 plan / work / review 消费对接
- 不做自动双向同步
- 条件 rules（domain-constraints、testing-rules、data-rules）延后到 v2.1

---

## 产物模型

### 目录结构

```text
docs/contexts/<slug>/
├── README.md                        # 任务路由入口（orchestrator 串行写）
├── 00-summary.md
├── architecture/
│   ├── system-overview.md
│   ├── module-map.md
│   └── integration-boundaries.md
├── rules/                           # NEW v2
│   ├── index.md
│   ├── coding-rules.md
│   └── integration-rules.md
├── patterns/                        # NEW v2
│   ├── index.md
│   └── review-hotspots.md
├── decisions/                       # NEW v2
│   ├── index.md
│   └── key-decisions.md
├── pitfalls/
│   ├── index.md
│   ├── hard-gotchas.md
│   └── frequent-mistakes.md
├── layers/                          # 条件产物（v1 保留）
│   └── <frontend|backend|mobile|desktop|cli|shared|data>/index.md
├── guides/                          # 条件产物（v1 保留）
│   └── index.md
└── database/                        # 条件产物（v1 保留）
    ├── database-er.md
    └── write-sensitive-areas.md
```

控制面（不提交）：

```text
.context/spec-first/bootstrap/
├── phase1-snapshot.md               # Phase 1 分析快照
├── prd/                             # 各 worker 的 PRD 合同
│   ├── summary-context.md           # 固定
│   ├── architecture-context.md      # 固定
│   ├── rules-context.md             # 固定
│   ├── patterns-context.md          # 固定
│   ├── decisions-context.md         # 固定
│   ├── pitfalls-context.md          # 固定
│   └── <layer|database|guides>-context.md  # 条件，按激活情况生成
├── backup/<timestamp>/              # rerun 前自动备份
└── assembly-report.md               # assembly 结果记录
```

### 新旧对比

| 类型 | v1 | v2（本版） |
|------|----|-----------|
| Understanding | ✓ README, summary, architecture, pitfalls | ✓ 保留并增强 |
| Rules | ✗ 散落在 architecture/pitfalls 中 | ✓ 独立 rules/ |
| Patterns | ✗ 无 | ✓ 独立 patterns/ |
| Decisions | ✗ 无 | ✓ 独立 decisions/ |
| 条件产物 | ✓ layers, database, guides | ✓ 保留，不扩展 |

---

## 执行模型（两阶段）

### Phase 1：全局分析 + PRD 生成

orchestrator 扫描目标仓库，完成两件事后进入 Phase 2：

**1a. 分析快照（写入 `phase1-snapshot.md`）：**

```text
## Project Snapshot
language: <语言>  framework: <框架>  project_type: [frontend, backend, ...]

## Rule Candidates
- <路径>（<描述>）[Verified|Inferred]

## Pattern Candidates
- <路径>（<描述>）[Verified|Inferred]

## Decision Candidates
- <描述>（来源：<路径或注释>）[Verified|Inferred]

## Risk Candidates
- <路径>（<描述>）

## Activated Workers
fixed: [summary-context, architecture-context, rules-context, patterns-context, decisions-context, pitfalls-context]
conditional: [<激活的条件 worker 列表>]
```

工具优先级：ABCoder MCP（有则用，符号级候选）→ Grep + Read（降级，结构级候选）

**1b. PRD 合同生成（orchestrator 在 1a 完成后执行）：**

为每个激活的 worker 写 `.context/spec-first/bootstrap/prd/<worker-name>.md`，注入对应候选信号。

**Phase 1 不写 `docs/contexts/` 下的任何文件。**

### Phase 2：并行生产 + Assembly

```text
1. orchestrator 并行启动所有激活的 worker（固定 + 条件）
2. 每个 worker 只读自己的 PRD，只写 PRD Files 中声明的文件
3. 所有 worker 完成后，orchestrator 执行 3 项 assembly 检查
4. orchestrator 串行写 README.md（无论检查是否通过，都写，失败项在 README 中标注缺失）
5. 写 assembly-report.md，记录通过项、失败项和修复建议
```

---

## Worker 模型（6 个固定 worker）

| Worker | 独占文件 | 核心问题 |
|--------|---------|---------|
| `summary-context` | `00-summary.md` | 项目是什么、主链路是什么、团队规模 |
| `architecture-context` | `architecture/*.md` | 模块怎么分、边界在哪、集成方式 |
| `rules-context` | `rules/*.md` | 什么不能写错、哪些封装不可绕过 |
| `patterns-context` | `patterns/*.md` | 最该抄哪个文件、标准骨架是什么 |
| `decisions-context` | `decisions/*.md` | 为什么这样设计、历史取舍是什么 |
| `pitfalls-context` | `pitfalls/*.md` | 哪里最容易踩坑、哪些假设是错的 |

条件 worker（与 v1 一致，仅激活对应 layer/database/guides）：

| 触发信号 | 激活 worker | 独占文件 |
|---------|------------|---------|
| 有前端框架（React/Vue/Angular 等） | `frontend-context` | `layers/frontend/index.md` |
| 有服务端框架（Express/Django/Rails 等） | `backend-context` | `layers/backend/index.md` |
| 有 Android/iOS/RN/Flutter | `mobile-context` | `layers/mobile/index.md` |
| 有 Electron/Tauri | `desktop-context` | `layers/desktop/index.md` |
| package.json 有 bin / 有 cobra/click 等 | `cli-context` | `layers/cli/index.md` |
| 有跨层共享目录（libs/、packages/shared） | `shared-context` | `layers/shared/index.md` |
| 有 Prisma/Drizzle/dbt/Airflow 等 | `data-context` | `layers/data/index.md` |
| MySQL 可连接 / 有单一 schema 文件 | `database-context` | `database/database-er.md`、`database/write-sensitive-areas.md` |
| 激活层数 ≥ 3 | `guides-context` | `guides/index.md` |

---

## PRD 合同格式（5 个核心字段）

orchestrator 在 Phase 1 结束后为每个 worker 生成 PRD，注入分析结果：

```markdown
# Task PRD: <worker-name>

## Goal
<一句话：这个 worker 要解决什么问题、帮助后续节点回答什么>

## Files
<独占写入的文件列表，每行一个路径>

## Candidate Signals
<来自 phase1-snapshot.md 的候选素材>
- 路径示例：src/lib/api-client.ts（统一请求封装入口）
- 符号示例：AuthMiddleware（src/middleware.ts）
- 模式示例：src/features/<feature>/hooks/ 目录结构统一

## Required Evidence
<必须给出证据的结论类型>
- 每条规则必须附文件路径或符号名
- 每个模式必须附至少一个参考实现路径
- 决策必须说明"为什么"而非只说"是什么"

## Confidence Policy
- Verified：能给出路径或符号的结论
- Inferred：有间接证据但未直接验证的推断
- Unknown：无法确认的内容，标注后跳过
- 禁止：无证据的强事实陈述、模板占位符（[TODO]、TBD）
```

---

## 文档质量要求

所有核心文档（rules/、patterns/、decisions/）必须满足：

**结构要求：**
- 有 `When To Read` 章节：遇到什么任务先看我
- 有 `Closest Examples` 章节：给出真实路径
- 有 `Hard Rules / Forbidden Patterns`（rules 文档）或 `Standard Skeleton`（patterns 文档）
- 文档末尾有 `Generated At` 和 `Potentially Stale Areas`

**内容要求：**
- 每个高价值结论标注 `Verified / Inferred / Unknown`
- 规则文档：区分 `Must / Should / Avoid`
- 模式文档：说明哪些部分可替换、哪些不要改
- 不写框架常识，只写项目内实际模式

**禁止：**
- 占位符（`[TODO]`、`[待补充]`、`TBD`）
- 只写原则，不给路径
- 规则与模式混写在同一文档

---

## Assembly（3 项检查）

orchestrator 在所有 worker 完成后执行：

```text
1. 完整性检查
   所有 PRD Files 中声明的文件是否都已存在
   → 缺失则记录，不阻断

2. 无占位符检查
   扫描所有生成文件，检测 [TODO]、[待补充]、TBD
   → 发现则记录，不阻断

3. 任务入口检查
   rules/index.md、patterns/index.md、decisions/index.md 是否有 When To Read 章节
   → 缺失则记录，不阻断
```

README.md **无论检查结果如何都写**，内容：任务路由、关键规则摘要、推荐模式摘要、高风险区域摘要、产物索引。
有失败项时在 README.md 对应位置标注"⚠ 未生成"，并写 assembly-report.md 列出修复建议。

---

## Rerun（最小保护）

```text
1. 检测 docs/contexts/<slug>/ 是否已存在
2. 存在则全量复制到 .context/spec-first/bootstrap/backup/<timestamp>/
3. 执行正常流程（Phase 1 → Phase 2 → Assembly）
4. 若 Phase 2 任一 worker 失败 → 从 backup/ 恢复该 worker 的文件
5. 若整体失败 → 从 backup/ 全量恢复
```

---

## 实施计划

### Phase A：产物模型升级（本版目标）

交付项：
- `rules/`、`patterns/`、`decisions/` 三个目录及其固定文件
- 6 个固定 worker 的 PRD v2 模板
- 3 项 assembly 检查
- `phase1-snapshot.md` 格式定义

验收标准：
1. `rules/coding-rules.md` 包含 ≥ 3 条有路径证据的硬性规则
2. `patterns/review-hotspots.md` 包含 ≥ 3 个有参考实现路径的模式
3. `decisions/key-decisions.md` 包含 ≥ 2 个有"为什么"说明的决策
4. 所有固定文档有 `When To Read` 章节
5. Assembly 无占位符告警

### Phase B：条件产物扩展（v2.1）

延后事项：
- `rules/domain-constraints.md`、`testing-rules.md`、`data-rules.md`
- `patterns/` 专题文件（screen-flow、api-integration 等）
- `guides/task-playbooks.md`
- `decisions/tradeoffs.md`、`historical-constraints.md`
- rerun stale 差异检测
- ABCoder / GitNexus MCP 深度集成

### Phase C：消费对接（v2.2）

- plan / work / review 阶段注入 bootstrap 资产
- Verified 比例追踪
- 参考实现命中率监控

---

## 成功判断（Phase A）

以下 4 项全部成立才算真正的 v2：

1. `rules/` 成立，且内容是项目内真实约束，不是框架常识
2. `patterns/` 成立，且内容包含真实参考实现路径
3. 文档支持任务入口（`When To Read`）
4. 设计显式面向"降低无必要原创"

只要这 4 项未成立，再多文档也仍然只是"v1 的扩写版"。

---

## 与现有文档的关系

| 文档 | 角色 |
|------|------|
| 本文（精简方案） | **执行参考**，Phase A 实施依据 |
| `spec-graph-bootstrap-v2-需求与实施方案.md` | 完整技术规格存档，Phase B/C 参考 |
| `spec-graph-bootstrap-v2-验收标准清单.md` | 全量验收清单，用于评估偏差 |
| `spec-graph-bootstrap-v2-产物清单明细表.md` | 详细产物定义，按需参考 |
