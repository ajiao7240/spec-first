# Spec-First 项目介绍

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 一句话定义

`spec-first` 是一个开源 npm CLI 工具，将 AI 编码从"即兴对话"转变为"规格驱动的工程交付闭环"，为 Claude Code 和 Codex 两个宿主提供统一的 `需求 → 计划 → 实现 → 评审 → 知识沉淀` 工作流。

---

## 项目基本数据

| 指标 | 数值 |
|------|------|
| 版本 | v1.5.1 |
| 源码文件 | 88 个 JS 文件（src/） |
| 源码行数 | ~13,700 行 |
| 测试文件 | 102 个（JS + Shell） |
| 测试行数 | ~3,900 行 |
| Skills | 39 个 |
| Agents | 57 个 |
| 命令模板 | 13 个（/spec:* 系列） |
| 支持宿主 | Claude Code + Codex |
| 安装方式 | `npm install -g spec-first` |

---

## 它解决什么问题

AI coding 工具（Claude Code、Codex）的默认模式是"给一段对话，产出代码"。这种模式的核心问题：

1. **没有规格** — 需求不清就开始写，改了又改
2. **没有计划** — 大任务直接动手，经常走偏
3. **没有评审** — AI 产出的代码缺乏结构化 review
4. **没有沉淀** — 解决过的问题不记录，下次重新踩坑
5. **单仓盲区** — AI 不了解项目结构，每次从零探索

spec-first 的回答是：**把 AI 编码变成一套有明确产物、有质量门、有知识积累的工程流程**。

---

## 核心工作流

```
用户安装 spec-first
  |
  v
spec-first init
  (同步 skills + agents + commands 到项目运行时)
  |
  v
/spec:mcp-setup
  (一键安装配置 MCP 工具)
  |
  v
/spec:graph-bootstrap 或 /spec:graph-bootstrap
  (生成项目上下文: 模块结构、入口、测试面、风险信号)
  |
  v
+-------------------------------------------------------------------+
|                     日常开发闭环                                    |
|                                                                     |
|  /spec:ideate ──> /spec:brainstorm ──> /spec:plan ──> /spec:work   |
|  (创意发散)       (方案论证)            (规格计划)     (执行实现)   |
|       |                                                    |        |
|       |               /spec:code-review  <─────────────────────+        |
|       |               (结构化代码评审)                              |
|       |                    |                                        |
|       |               /spec:compound                                |
|       |               (知识沉淀到 docs/solutions/)                  |
|       |                                                             |
+-------------------------------------------------------------------+
```

### 13 个命令入口

| 命令 | 职责 |
|------|------|
| `/spec:ideate` | 创意发散，从模糊需求生成候选方案 |
| `/spec:brainstorm` | 多角度论证，对候选方案做深度研判 |
| `/spec:plan` | 生成结构化实施计划（含置信度评分 + deepening） |
| `/spec:work` | 按计划执行编码（含测试、review、shipping） |
| `/spec:code-review` | 17 个 reviewer persona 并行评审 PR |
| `/spec:compound` | 将解决过的问题沉淀为可复用知识文档 |
| `/spec:graph-bootstrap` | 稳定版项目上下文生成 |
| `/spec:graph-bootstrap` | 图增强版项目上下文生成（CRG 驱动） |
| `/spec:mcp-setup` | 统一 setup 入口：repo-local preflight + MCP 工具安装与配置 |
| `/spec:sessions` | 搜索和总结历史 coding agent 会话 |
| `/spec:debug` | 结构化 debug 工作流 |
| `/spec:update` | 更新 spec-first 版本 |

---

## 系统架构

```
+===================================================================+
|                        用户入口层                                   |
|  spec-first doctor | init | clean | crg <subcommand>              |
+===================================================================+
         |                    |                        |
         v                    v                        v
+------------------+  +------------------+  +------------------+
| CLI 核心         |  | 资产同步引擎      |  | CRG 代码图引擎   |
| (src/cli/)       |  | (plugin.js +     |  | (src/crg/)       |
|                  |  |  adapters/)      |  |                  |
| index.js 路由    |  | syncBundledAssets|  | 46 文件 13,697行 |
| doctor.js 检查   |  | claude.js 适配   |  | 16语言 AST 解析  |
| init.js 初始化   |  | codex.js 适配    |  | SQLite 图存储    |
| clean.js 清理    |  |                  |  | 混合检索管道     |
| state.js 状态    |  | name rewrite:    |  | 社区/流程/风险   |
| developer.js     |  | spec-first:cat:  |  |                  |
| lang-policy.js   |  | name → bare name |  | 详见:            |
|                  |  |                  |  | CRG-代码图引擎   |
+------------------+  +------------------+  | 分析.md          |
                                            +------------------+
         |                    |                        |
         v                    v                        v
+===================================================================+
|                     运行时产物层                                    |
|                                                                     |
|  .claude/skills/        ← 39 个 skill (SKILL.md + references/)    |
|  .claude/agents/        ← 57 个 agent (.md persona 文件)           |
|  .claude/commands/spec/ ← 13 个命令模板                             |
|  .spec-first/graph/     ← CRG SQLite DB + generations             |
|  .spec-first/workflows/ ← bootstrap 控制面产物                      |
|  docs/contexts/<slug>/  ← 项目上下文文档 (Stage-0)                  |
|  docs/solutions/        ← compound 知识沉淀                        |
+===================================================================+
         |
         v
+===================================================================+
|                   上下文路由层                                       |
|  src/context-routing/                                               |
|    evaluator.js   ← 确定性求值器: 算出每个 workflow 该读什么         |
|    loader.js      ← 加载 injection-index.yaml                      |
|    profiles.js    ← plan/work/review 不同 profile                  |
|    telemetry.js   ← 记录消费行为                                    |
|    workspace-loader.js ← 多仓聚合                                   |
+===================================================================+
         |
         v
+===================================================================+
|                   AI Agent 消费层                                    |
|                                                                     |
|  /spec:plan   读 module-map + database-index                       |
|  /spec:work   读 test-map                                          |
|  /spec:code-review 读 high-risk-modules + pitfalls + review-change      |
|               + test-map + database-index + data-flow              |
+===================================================================+
```

---

## 三大核心子系统

### 1. 资产同步引擎

**职责**：将 `skills/`、`agents/`、`templates/` 下的源资产同步到用户项目的 `.claude/` 或 `.codex/` 运行时目录。

**关键机制**：
- **Canonical Agent Name 重写**：源文件用 `spec-first:category:name` 命名，Claude 适配器重写为 bare name，Codex 适配器重写为 `.codex/agents/...` 路径
- **State 管理**：`state.json` 记录已同步资产清单，支持增量同步和废弃资产清理
- **双宿主支持**：Claude (`--claude`) 和 Codex (`--codex`) 各有独立适配器，输出布局不同

**核心文件**：

| 文件 | 行数 | 职责 |
|------|------|------|
| `plugin.js` | - | 加载 manifest，实现 `syncBundledAssets` |
| `adapters/claude.js` | - | Claude 平台适配，canonical → bare name |
| `adapters/codex.js` | - | Codex 平台适配，canonical → 显式路径 |
| `state.js` | - | 读写 `state.json`，增量同步识别 |
| `developer.js` | - | developer identity（git 用户名、语言） |
| `lang-policy.js` | - | 幂等注入语言/治理策略到 CLAUDE.md |

### 2. CRG 代码图引擎

**职责**：以 tree-sitter AST 为基座，将代码库的结构关系持久化到 SQLite 图数据库，支持 17 个子命令的查询与分析。

**规模**：46 个 JS 文件，13,697 行。

**核心能力链**：

```
文件收集(10步过滤) → AST解析(16语言) → 增量检测(SHA-256)
  → 图写入(六阶段边解析) → 语义分块 → 代际管理
  → 社区检测(3-Pass) → 流程追踪(BFS+5因子)
  → 图分析(surprising+god_nodes) → FTS5 搜索
  → 混合检索(seed→expand→rerank→pack)
```

**详细分析见**：[CRG-代码图引擎分析.md](./CRG-代码图引擎分析.md)

### 3. 上下文路由系统

**职责**：将 CRG + bootstrap 产出的上下文文档，按 workflow 阶段（plan/work/review）路由给 AI agent。

**核心机制**：
- `injection-index.yaml` 定义了每个阶段该读什么文件
- `evaluator.js` 做确定性求值：解析 yaml → 检查文件存在性 → 去重排序 → 返回 `selected_assets`
- 三级降级：`normal → level1 → level2 → level3`，降级原因结构化记录

---

## Skills 分类

| 类别 | Skills | 说明 |
|------|--------|------|
| **核心工作流** | spec-plan, spec-work, spec-work-beta, spec-code-review, spec-ideate, spec-brainstorm, spec-compound, spec-compound-refresh | 日常开发闭环 |
| **项目上下文** | spec-graph-bootstrap, spec-sessions | 项目理解、上下文生成与 session 历史编排 |
| **基础设施** | spec-mcp-setup, spec-update, spec-debug, spec-optimize, changelog | 环境配置与维护 |
| **Git 工作流** | git-commit, git-commit-push-pr, git-worktree, git-clean-gone-branches | 版本控制 |
| **代码质量** | spec-doc-review, resolve-pr-feedback, spec-pr-description | 评审、反馈处理与 PR 描述 |
| **前端设计** | frontend-design, feature-video, gemini-imagegen | UI/UX 与视觉 |
| **测试** | test-browser, test-xcode | 测试与验证 |
| **知识管理** | proof, spec-release-notes | 文档协作与版本摘要 |
| **外部工具** | agent-browser, agent-native-architecture, agent-native-audit | 外部集成与 agent-native 评估 |
| **Ruby/Rails** | spec-dhh-rails-style | Rails 风格与约定 |
| **其他** | lfg, report-bug, spec-slack-research, spec-polish-beta | 特殊用途 |

---

## 57 个 Agents 分类

| 类别 | 数量 | 示例 |
|------|------|------|
| **Review personas** | 17+ | correctness, security, performance, maintainability, api-contract, data-migrations, adversarial... |
| **Research agents** | 10+ | best-practices, git-history, issue-intelligence, learnings, session-historian, framework-docs... |
| **Design agents** | 3 | design-iterator, design-implementation, figma-design-sync |
| **Workflow agents** | 5+ | pr-comment-resolver, bug-reproduction-validator, spec-flow-analyzer... |
| **Document review** | 7 | product-lens, feasibility, coherence, scope-guardian, security-lens, design-lens, adversarial-document |

---

## Stage-0 上下文系统

`/spec:graph-bootstrap` 生成的产物树：

```
.spec-first/workflows/bootstrap/<slug>/   ← 机器控制面
  fact-inventory.json      (入口、模块、测试、风险、依赖)
  risk-signals.json        (风险信号 + CRG 图指标)
  test-surface.json        (测试映射 + 覆盖缺口)
  artifact-manifest.json   (构建元数据)

docs/contexts/<slug>/                      ← 人/Agent 可读层
  00-summary.md            (项目摘要)
  architecture/module-map.md  (模块结构)
  code-facts/
    public-entrypoints.md  (公共入口)
    test-map.md            (测试映射)
    high-risk-modules.md   (高风险模块)
  pitfalls/index.md        (风险与陷阱)
  context-packs/
    review-change.md       (review 专用变更上下文)
  database/                (条件: MySQL Level1/Level2)
    database-index.md      (总索引)
    data-flow.md           (数据流)
    database-er.md / domains/*.md  (ER图)
    semantic-catalog.md    (大型系统)
  injection-index.yaml     (路由表)
```

**三级置信度模型**：

```
Full (CRG AST图)  →  Enhanced (Serena LSP)  →  Basic (Glob/Grep)
confidence: high      confidence: medium          confidence: low
```

**每个 workflow 阶段读不同文件**：

```
injection-index.yaml:
  plan:   [module-map, database-index]
  work:   [test-map]
  review: [high-risk-modules, pitfalls, review-change, test-map,
           database-index, data-flow]
```

---

## 目录结构

```
spec-first/
  src/
    cli/              ← CLI 核心 (index/doctor/init/clean/state/developer/lang-policy)
      adapters/       ← Claude + Codex 平台适配器
      commands/       ← doctor/init/clean 命令实现
      contracts/      ← 双宿主治理契约
    crg/              ← CRG 代码图引擎 (46 文件, 13,697 行)
      cli/            ← build/stats/context/query/postprocess/router
      commands/       ← 13 个子命令处理器
      retrieval/      ← 混合检索管道 (seed/expand/rerank/pack/api)
      generations/    ← 代际管理 (paths/promote/health/rollback)
    context-routing/  ← 上下文路由 (evaluator/loader/profiles/telemetry)
    bootstrap-compiler/ ← bootstrap 编译器 (orchestrator/machine/human/routing)
  skills/             ← 39 个 skill 源目录
  agents/             ← 57 个 agent 定义 (review/research/design/workflow/docs)
  templates/          ← 命令模板 (claude/commands/spec/)
  tests/              ← 102 个测试文件
  .spec-first/        ← workflow artifacts / graph / spec-work run artifacts
  vendor/             ← tree-sitter-objc + tree-sitter-swift fork
  docs/               ← 文档体系
    contracts/        ← JSON Schema 契约
    contexts/         ← Stage-0 产物样本
    solutions/        ← compound 知识沉淀
    plans/            ← 技术方案与计划
  .claude-plugin/     ← plugin.json manifest
```

---

## 技术栈

| 层面 | 技术选型 |
|------|---------|
| 语言 | Node.js CommonJS |
| 存储 | SQLite (better-sqlite3) + WAL |
| AST | tree-sitter (16 语言原生 binding) |
| 搜索 | FTS5 全文索引 |
| 测试 | Jest + Shell e2e |
| CI | GitHub Actions (`crg-quality-gate.yml`) |
| 发布 | npm (`spec-first`) |
| 契约 | JSON Schema Draft 2020-12 |

---

## 文档索引

| 文档 | 路径 |
|------|------|
| CRG 代码图引擎完整分析 | [CRG-代码图引擎分析.md](./CRG-代码图引擎分析.md) |
| 用户手册 | [docs/05-用户手册/README.md](../05-用户手册/README.md) |
| 版本更新 | [docs/08-版本更新/README.md](../08-版本更新/README.md) |
| 核心概念 | [docs/05-用户手册/02-核心概念.md](../05-用户手册/02-核心概念.md) |
