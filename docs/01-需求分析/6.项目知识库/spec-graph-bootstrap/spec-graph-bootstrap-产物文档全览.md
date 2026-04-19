# spec-graph-bootstrap 产物文档全览（v1 历史版）

> 本文记录 `spec-graph-bootstrap` v1 的产物模型。
> 当前知识库已补充 v2 方案，v2 不再只关注“项目认知文档”，而是升级为“研发质量资产”模型。
> 参考来源：`skills/spec-graph-bootstrap/SKILL.md`、`references/prd-template.md`、`references/database-prd-template.md`

---

## 阅读入口

如果你是第一次阅读本主题，建议按下面顺序进入：

| 目的 | 建议阅读 |
|------|----------|
| 快速了解 v2 的完整主方案 | `spec-graph-bootstrap-v2-总体方案.md` |
| 了解 v1 当前模型 | `spec-graph-bootstrap-产物文档全览.md`（本文） |
| 了解 v2 为什么要升级、升级边界和优先级 | `spec-graph-bootstrap-v2-演进决策稿.md` |
| 了解 v2 目标态产物模型 | `spec-graph-bootstrap-v2-产物清单明细表.md` |
| 了解 v2 worker 与 PRD 合同升级 | `spec-graph-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md` |

### v1 与 v2 的关系

| 维度 | v1 | v2 |
|------|----|----|
| 核心定位 | 项目上下文生成 | 研发质量资产生成 |
| 长板 | 帮助理解项目结构 | 帮助理解 + 规则 + 样板 + 决策 + 风险 |
| 固定产物 | summary / architecture / pitfalls | summary / architecture / rules / patterns / decisions / pitfalls |
| 主要问题 | 偏介绍型、偏认知型 | 面向执行、可控出码、任务导向 |

### 当前状态说明

- 本文保留为 **v1 历史版全览**
- 若后续要继续演进 `spec-graph-bootstrap`，应以 v2 文档为主
- 若需要对照 v1 和 v2 的变化，建议先读本文，再读 v2 产物清单

---

## v1 两层产物架构

```
docs/contexts/<slug>/          ← 长期资产（持久保留、可提交版本库）
.context/spec-first/bootstrap/ ← 控制面（执行期临时，建议加入 .gitignore）
```

---

## 一、v1 长期资产 `docs/contexts/<slug>/`

### 固定产物（每次必生成，共 6 个文件）

| 文件 | 负责方 | 内容 |
|------|--------|------|
| `README.md` | Orchestrator（串行写入） | 含 `<!-- spec-graph-bootstrap -->` 标记、生成时间戳、所有产物的导航索引。Orchestrator 在全部 worker 完成后统一写入，不允许 worker 写 |
| `00-summary.md` | summary-context worker | 项目总览：主语言、主框架、顶层模块结构、技术栈、核心职责 |
| `architecture/system-overview.md` | architecture-context worker | 系统架构概览：整体结构、关键架构决策、系统边界 |
| `architecture/module-map.md` | architecture-context worker | 模块地图：顶层目录 + 每个目录的一行职责说明（最低质量保证：必须覆盖顶层目录） |
| `architecture/integration-boundaries.md` | architecture-context worker | 集成边界：模块间接口、外部依赖、服务间通信方式 |
| `pitfalls/index.md` | pitfalls-context worker | 已知高风险区：技术债、易出错模式、已知问题、历史 Bug 热点 |

### 条件产物——按代码层（有机械证据才生成）

| 文件 | 触发条件 | 内容 |
|------|----------|------|
| `layers/frontend/index.md` | package.json 含 React/Vue/Angular/Svelte/SolidJS/HTMX | 前端层架构：组件体系、状态管理、路由、构建配置 |
| `layers/backend/index.md` | 存在 API 路由文件或服务端框架（Express/Django/Rails/Spring 等） | 后端层架构：服务划分、API 设计、中间件、认证鉴权 |
| `layers/mobile/index.md` | 存在 `android/`、`ios/`、`flutter/` 目录或 React Native 依赖 | 移动层架构：原生/跨平台策略、打包配置、平台差异 |
| `layers/desktop/index.md` | Electron/Tauri 依赖、`.xcodeproj`、`.csproj` 含 UseWPF 等 | 桌面层架构：窗口管理、进程通信、平台打包 |
| `layers/cli/index.md` | npm `bin` 字段、Go main+flag、Python click/argparse、Rust clap | CLI 层架构：命令结构、参数解析、输入输出约定 |
| `layers/shared/index.md` | 存在跨层共享代码目录 | 共享层：公共模块、工具函数、共享类型定义 |
| `layers/data/index.md` | 存在独立数据层（schema 文件、ETL 配置、数据管线） | 数据层：存储策略、数据模型、ETL/管线设计 |
| `guides/index.md` | ≥3 个活跃层 **且** 至少 2 个层之间有显式跨层依赖 | 跨层集成指南：层间依赖关系、API 消费关系、共享模块使用说明 |

### 条件产物——数据库 ER（MySQL + CLI 可连接才生成）

| 场景 | 产物文件 | 内容 |
|------|----------|------|
| 单数据库 | `database/database-er.md` | Mermaid erDiagram + 核心关系表 + 实体类型清单 + 数据流图 + 表清单。目标 < 200 行 / < 10 KB，不含字段详情，不含密码 |
| 多数据库 | `database/database-index.md` + `database-{name}.md`（每库一个） | database-index.md 为索引；每个 database-{name}.md 格式同单库 ER 文档 |

---

## 二、v1 控制面产物 `.context/spec-first/bootstrap/<slug>/tasks/<task-id>/`

每个 worker 对应一个 PRD 文件，路径为 `tasks/<task-id>/prd.md`：

| task-id | 触发条件 | PRD 关键节 |
|---------|----------|------------|
| `summary-context` | 始终创建 | Goal / Context（Phase 1 分析结果） / Tools Available / Files to Fill / Rules / Acceptance / Technical Notes |
| `architecture-context` | 始终创建 | 同上，Context 含模块边界、关键包结构 |
| `pitfalls-context` | 始终创建 | 同上，Context 含已知风险区发现 |
| `<layer>-context` | 检测到对应层 | 同上，Context 含该层的框架依赖、入口文件、路由结构 |
| `database-context` | MySQL 可连接 | 专用模板（database-prd-template.md），含 DB host/port/name 来源（仅环境变量名）、备份表过滤规则、ER 产物格式要求、降级级别（MCP/CLI/ORM推断） |

PRD 内容七节骨架（来自 `references/prd-template.md`）：

```
Goal         — 本 worker 必须产出什么
Context      — Phase 1 分析发现的架构上下文（具体路径/类名/配置键）
Tools        — 当前会话可用工具（Full/Enhanced/Basic 模式）
Files        — 本 worker 独占写入的文件清单
Rules        — 文件所有权、禁止改源码、禁止 git 命令、格式要求
Acceptance   — 验收标准（无占位符、有结构化章节、引用真实产物）
Tech Notes   — 项目特有约定、框架特殊之处、命名规范
```

**PRD 仅服务当次执行，不持久保留（建议加入 .gitignore）**

---

## 三、v1 临时备份（Rerun 保护）

```
.context/spec-first/bootstrap/<slug>/backup_<ISO-timestamp>/
```

| 时机 | 操作 |
|------|------|
| Phase 3 开始前 | 备份已有 `docs/contexts/<slug>/` |
| 全部 worker 成功 | 删除备份 |
| summary-context 失败 | 完全恢复备份，停止执行 |
| 其他 worker 失败 | 保留已成功产物，写 partial README.md，报告失败任务 |
| 全部 worker 失败 | 完全恢复备份 |

---

## 四、v1 产物总览示意

```
docs/contexts/<slug>/
├── README.md                          ← Orchestrator 串行写（固定）
├── 00-summary.md                      ← summary-context（固定）
├── architecture/
│   ├── system-overview.md             ← architecture-context（固定）
│   ├── module-map.md                  ← architecture-context（固定）
│   └── integration-boundaries.md     ← architecture-context（固定）
├── pitfalls/
│   └── index.md                       ← pitfalls-context（固定）
├── layers/                            ← 条件，按检测到的层生成
│   ├── frontend/index.md
│   ├── backend/index.md
│   ├── cli/index.md
│   └── ...
├── guides/
│   └── index.md                       ← 条件：≥3层 + 显式跨层依赖
└── database/                          ← 条件：MySQL + CLI 可连接
    └── database-er.md
```

---

## 五、v1 的局限

从当前知识库演进结论看，v1 主要解决的是“理解项目”，还没有系统解决“提升后续研发质量”。

主要局限有：

1. 缺独立的 `rules/` 层，硬约束不够显式
2. 缺独立的 `patterns/` 层，最值得抄的代码模式未被系统沉淀
3. 缺独立的 `decisions/` 层，关键历史取舍不可见
4. 多数文档偏介绍型，不够任务导向
5. 对前端、后端、App、PC、CLI、数据等多场景的统一抽象还不够强

这些问题正是 v2 方案要解决的重点。

---

## 六、后续阅读建议

如果目标是推进下一版设计：

1. 先读 `spec-graph-bootstrap-v2-产物清单明细表.md`
2. 再读 `spec-graph-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md`
3. 最后再回看本文，对照哪些内容属于 v1 保留、哪些需要升级
