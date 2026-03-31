# Spec Bootstrap 集成设计

## 目标

把 Trellis 的 `cc-codex-spec-bootstrap` 能力集成到 `spec-first`，作为一个新的支持型 workflow，用来为目标项目生成可长期复用的项目上下文资产；同时尽量保留原始 prompt contract，只把执行方式从 `Codex CLI workers` 改成 `Claude subagent` 主控下的 worker subagents。

## 背景理解

Trellis 原 skill 的真实作用不是“写通用编码规范”，而是做一层 **项目上下文 bootstrap**：

- 用 GitNexus 建立架构级认知
- 用 ABCoder 建立符号级认知
- 把分析结果打包进每个任务的 `prd.md`
- 用并行 worker 生产长期上下文资产
- 让后续 AI 工作不再依赖临场猜测

当前 `spec-first` 仓库本身是一个工作流框架，不是被分析的目标项目。因此本次集成必须围绕“如何为目标项目生成上下文资产”来设计，而不是围绕 `spec-first` 自己的源码目录来设计。

## 设计结论

### 1. 主集成方式

采用 **skill-first、subagent-assisted** 的方式集成。

- 新增 canonical skill：`skills/spec-bootstrap/SKILL.md`
- 新增 Claude 命令入口：`/spec:bootstrap`
- 保持主控逻辑在 skill contract 中，不新增专门 orchestrator agent
- 把原 Trellis 中的 `Codex agents` 改成 `worker subagents`

### 2. 产品定位

`spec-bootstrap` **不是** 五阶段主链的一部分。

它是一个 **Stage-0 / supporting workflow**，职责是：

- 为目标项目生成 durable project context assets
- 为后续 workflow 准备可消费的上下文基座

### 3. 当前版本边界

当前版本只承诺：

- 生成 `docs/contexts/<context-slug>/...` 长期上下文资产
- 提供 bootstrap skill 与命令入口
- 提供 task PRD 控制面与并行生产机制

当前版本**不承诺**：

- 自动把 `docs/contexts/` 注入到 `brainstorm / plan / work / review / compound`
- 自动为后续 workflow 做上下文发现、选择、摘要压缩
- 自动维护 bootstrap 资产与后续增量变更之间的同步关系

这些属于后续版本的消费链路集成范围。

## 产物模型

### 1. 长期上下文资产

采用 `spec-first` 原生目录模型：

```text
docs/contexts/<context-slug>/
  README.md
  00-summary.md

  architecture/
    system-overview.md
    module-map.md
    integration-boundaries.md

  layers/
    frontend/
    backend/
    mobile/
    desktop/
    cli/
    shared/
    data/

  guides/
    index.md
    pre-implementation-checklist.md
    cross-layer-thinking-guide.md
    debugging-thinking-guide.md

  pitfalls/
    index.md
    <issue-slug>.md
```

### 2. 短期控制面产物

不要把 `prd.md` 混入 `docs/contexts/`。

采用单独的控制面目录：

```text
.context/spec-first/bootstrap/<context-slug>/
  manifest.json
  tasks/
    summary-context/prd.md
    architecture-context/prd.md
    frontend-context/prd.md
    backend-context/prd.md
    pitfalls-context/prd.md
```

### 3. 两层产物的职责划分

- `docs/contexts/`：长期资产，供后续版本消费
- `.context/spec-first/bootstrap/.../prd.md`：单次运行的任务合同，只服务当前 bootstrap 执行

## MVP 产物范围

当前版本的 `spec-bootstrap` 只负责生成最小可用的项目上下文基座，不追求一次性覆盖所有专题文档。设计原则是：

- 骨架固定
- 内容可先稀疏
- 专题按证据生成
- 并行 ownership 必须清晰
- 当前版本只生成，不自动接入后续五阶段消费链

### 固定必产物

每个 `context-slug` 必须生成以下文件：

```text
docs/contexts/<context-slug>/
  README.md
  00-summary.md

  architecture/
    system-overview.md
    module-map.md
    integration-boundaries.md

  pitfalls/
    index.md
```

#### 文件职责

- `README.md`
  - 整个 context 包的入口导航
  - 由 orchestrator 最终统一写入
- `00-summary.md`
  - 项目上下文摘要入口
  - 供后续版本做 prompt 注入时优先消费
- `architecture/system-overview.md`
  - 系统整体结构、核心组件、主数据流、技术边界
- `architecture/module-map.md`
  - 目录、模块、包职责地图
- `architecture/integration-boundaries.md`
  - 外部依赖、内部层边界、接口契约和禁止跨越的边界
- `pitfalls/index.md`
  - 当前项目已知高风险点入口
  - 当前版本允许保持摘要级，不强制展开为多个 case 文件

### 条件产物

以下文件只在代码库证据明确时生成：

**层级条件产物**（当前版本只生成 `index.md`）：

```text
docs/contexts/<context-slug>/layers/frontend/index.md
docs/contexts/<context-slug>/layers/backend/index.md
docs/contexts/<context-slug>/layers/mobile/index.md
docs/contexts/<context-slug>/layers/desktop/index.md
docs/contexts/<context-slug>/layers/cli/index.md
docs/contexts/<context-slug>/layers/shared/index.md
docs/contexts/<context-slug>/layers/data/index.md
docs/contexts/<context-slug>/guides/index.md
```

**数据库条件产物**（仅后端项目 + MySQL 可连接时生成，R21-R23）：

```text
docs/contexts/<context-slug>/database/
  单库 → database-er.md
  多库 → database-index.md + database-{name}.md
```

产物原则：索引化 + Mermaid erDiagram + Mermaid flowchart + 可执行 CLI 查询命令，不输出逐字段详情，产物 < 200 行 / < 10 KB。备份表/过期表过滤结果在文档中透明报告。

#### 生成原则

- 有明确前端层时，生成 `layers/frontend/index.md`
- 有明确后端层时，生成 `layers/backend/index.md`
- 有 CLI 时，生成 `layers/cli/index.md`
- 有明显跨层复杂度或需要统一思考框架时，生成 `guides/index.md`
- Phase 1 检测到 MySQL 配置 + CLI 可连接时，生成 `database/` 下的 ER 概览文档
- 当前版本不强制展开为 `components.md`、`state-management.md` 等二级专题文件

### 当前版本延期项

以下文件不属于当前版本的强制范围：

```text
guides/pre-implementation-checklist.md
guides/cross-layer-thinking-guide.md
guides/debugging-thinking-guide.md

layers/frontend/components.md
layers/frontend/state-management.md
layers/backend/error-handling.md
layers/shared/conventions.md

pitfalls/<issue-slug>.md
```

注意：`layers/backend/database.md` 已从延期项中移除，数据库 ER 分析已升级为 MVP 范围（R21-R23），产物路径为 `docs/contexts/<slug>/database/`。

这些内容需要更强的主题识别、更细的 PRD 质量以及更稳定的消费场景，因此放在后续版本演进。

## 为什么不是 Trellis 的 `marketplace/specs/`

不直接沿用 `marketplace/specs/<stack-profile>/...`，原因有三点：

1. `spec-first` 的长期文档体系已经围绕 `docs/` 建立，不适合再引入平行的 `specs/` 根目录
2. 当前框架强调 workflow 产物与长期资产分层，`docs/contexts/` 更符合现有叙事
3. `stack-profile` 更像模板库语义，而本次需要的是“目标项目自己的上下文资产库”

## `docs/contexts/` 的 artifact 契约

`docs/contexts/*` 应被定义为新的 durable artifact family。

它与现有目录的关系如下：

- `docs/brainstorms/`：需求定义
- `docs/plans/`：实施计划
- `docs/solutions/`：问题解决沉淀
- `docs/contexts/`：项目上下文基座

设计要求：

- `docs/contexts/*` 不应被当作临时文件
- 后续 review / cleanup / docs 叙事中应把它视为 canonical project context assets

## `context-slug` 规则

`context-slug` 是 bootstrap 的核心标识，必须可复现。

优先级规则：

1. 用户显式传入
2. 复用已存在的 `docs/contexts/<context-slug>/`（**验证条件**：该目录下 `README.md` 存在且包含 bootstrap 生成标记。不满足验证条件的已有目录不视为可复用 slug，避免误覆盖非 bootstrap 内容）
3. 使用目标仓库根目录名的 kebab-case

补充规则：

- 默认一个目标项目只建立一个 `context-slug`
- 只有在明确存在多个独立产品面时，才允许多个 slug
- rerun 默认复用已有 slug，不自动新建第二份

## 任务拆分模型

不把 `(package x layer)` 当成唯一拆分规则。

采用 **context domain** 作为主拆分单位。

### 1. 核心任务

始终生成：

- `summary`
- `architecture`
- `module-map`

### 2. 层级任务

仅在代码库有明确证据时生成：

- `frontend`
- `backend`
- `mobile`
- `desktop`
- `cli`
- `shared`
- `data`

### 3. 数据库条件任务（R21-R23）

**触发条件**：Phase 1 检测到 MySQL 连接配置 + CLI 可连接

- 任务名：`database-context`
- 产物路径：`docs/contexts/<context-slug>/database/`
- 单库 → `database-er.md`；多库 → `database-index.md` + `database-{name}.md`
- DB 降级策略（独立于代码分析降级链）：
  - Level 1: MCP MySQL Server 可用 → 直接查询 schema
  - Level 2: CLI mysql 可用 → 通过 bash 执行 SQL
  - Level 3: 都不可用 → 从 ORM/代码推断 ER，标记 `[未验证]`
- 备份表/过期表过滤（R23）：启发式规则 + 透明报告

### 4. 专项任务（延期）

以下专项任务在当前版本不强制展开：

- `authentication`
- `api-contracts`
- `state-management`
- `observability`
- `ai-integration`
- `build-test`
- `pitfalls`（仅 index.md，不展开二级文件）

### 5. 任务命名

使用上下文语义命名，例如：

- `<context-slug>-summary-context`
- `<context-slug>-architecture-context`
- `<context-slug>-frontend-context`
- `<context-slug>-pitfalls-context`
- `<context-slug>-database-context`（条件触发）

## MVP 任务模型

当前版本采用最小任务集，不追求一开始就展开大量专题任务。

### 固定任务

每个 `context-slug` 固定生成以下任务：

```text
<context-slug>-summary-context
<context-slug>-architecture-context
<context-slug>-pitfalls-context
```

### 条件任务

按项目实际存在的层生成：

```text
<context-slug>-frontend-context
<context-slug>-backend-context
<context-slug>-mobile-context
<context-slug>-desktop-context
<context-slug>-cli-context
<context-slug>-shared-context
<context-slug>-data-context
<context-slug>-guides-context
<context-slug>-database-context    ← 仅后端 + MySQL 可连接时触发（R21-R23）
```

## 并行写入最佳实践

### 1. 原则

不能只写“每个 worker 写自己的 context 目录”，因为 `docs/contexts/<context-slug>/` 下存在共享导航文件。

必须采用 **文件级 ownership + 最终 assembly**。

### 2. Ownership 规则

推荐：

- `summary` worker 独占：
  - `docs/contexts/<context-slug>/00-summary.md`
- `architecture` worker 独占：
  - `docs/contexts/<context-slug>/architecture/*`
- `frontend` worker 独占：
  - `docs/contexts/<context-slug>/layers/frontend/*`
- `backend` worker 独占：
  - `docs/contexts/<context-slug>/layers/backend/*`
- `pitfalls` worker 独占：
  - `docs/contexts/<context-slug>/pitfalls/index.md`（当前版本仅 index.md，不展开 `<issue-slug>.md`）

以下共享导航文件不允许多个 worker 并写，由 orchestrator 最终统一 assembly：

- `docs/contexts/<context-slug>/README.md`

如 `layers/<layer>/index.md`、`guides/index.md`、`pitfalls/index.md` 会由各自明确 owner 负责，不跨 worker 共享。

### 2.1 文件级 ownership 表

| Task | 负责文件 |
|---|---|
| `summary-context` | `docs/contexts/<context-slug>/00-summary.md` |
| `architecture-context` | `docs/contexts/<context-slug>/architecture/system-overview.md` `docs/contexts/<context-slug>/architecture/module-map.md` `docs/contexts/<context-slug>/architecture/integration-boundaries.md` |
| `pitfalls-context` | `docs/contexts/<context-slug>/pitfalls/index.md` |
| `<layer>-context` | `docs/contexts/<context-slug>/layers/<layer>/index.md` |
| `guides-context` | `docs/contexts/<context-slug>/guides/index.md` |
| `database-context` | `docs/contexts/<context-slug>/database/database-er.md`（单库）或 `docs/contexts/<context-slug>/database/database-index.md` + `database-{name}.md`（多库） |
| `orchestrator only` | `docs/contexts/<context-slug>/README.md` |

当前版本中，`layers/<layer>/index.md`、`guides/index.md`、`pitfalls/index.md` 都必须有明确单一 owner，不允许多个 worker 共同写入。

### 3. 为什么要 assembly

这样可以避免：

- worker 之间争抢共享入口文件
- rerun 时导航文件被不同 task 反复改写
- 并行模式下出现“写入范围看似合法，但实际上相互覆盖”的问题

## PRD Contract

保留 Trellis 原始 PRD 骨架：

- `Goal`
- `Context`
- `Tools Available`
- `Files to Fill`
- `Important Rules`
- `Acceptance Criteria`
- `Technical Notes`

### 必要改写

1. 任务标题从 `Fill <package> <layer> spec` 改成 `Build <context domain> context docs`
2. 目标输出从 `.trellis/spec/...` 改成 `docs/contexts/<context-slug>/...`
3. 模板规则从 “Spec files are NOT fixed” 改成 “Context files are NOT fixed”
4. 执行术语从 `Codex agents` 改成 `worker subagents`
5. worker 读取路径改成 `.context/spec-first/bootstrap/<context-slug>/tasks/<task-id>/prd.md`

## 执行模型

### Phase 1

主控分析目标仓库，用 GitNexus 和 ABCoder 形成架构认知，并为各任务写入 PRD 上下文。

### Phase 2

主控在目标项目里：

- 解析或确定 `context-slug`
- 创建 `.context/spec-first/bootstrap/<context-slug>/tasks/...`
- 为每个 context task 写一份 `prd.md`

### Phase 3

主控启动一个 worker subagent 处理一个 task。每个 worker：

- 只读取一份 PRD
- 只写自己拥有的文件清单
- 不改源码
- 不跑 git 命令
- 可以读取任意源码分析

最终由 orchestrator：

- 汇总 worker 结果
- 串行写入共享导航文件
- 完成 final assembly

## 平台契约

当前设计不做 platform gating。

因此公共契约应明确为：

- Claude：`/spec:bootstrap`
- Codex：`$spec-bootstrap`

规范要求：

- canonical skill 文案应保持平台中立，不写死 Claude-only contract
- Claude command template 提供 `/spec:bootstrap`
- Codex runtime 通过既有 skill sync 暴露 `$spec-bootstrap`

## `spec-first` 仓库中的变更范围

### 当前版本必须做

- 创建 `skills/spec-bootstrap/SKILL.md`
- 创建 `skills/spec-bootstrap/references/prd-template.md`
- 创建 `skills/spec-bootstrap/references/database-prd-template.md`
- 创建 `templates/claude/commands/spec/bootstrap.md`
- 更新 `.claude-plugin/plugin.json`
- 更新 `README.md`
- 更新 `docs/05-用户手册/02-核心概念.md`
- 更新 `docs/02-架构设计/01-整体架构.md`
- 更新 `docs/02-架构设计/02-目录结构.md`
- 更新 `tests/smoke/cli.sh`

> 注：设计文档早期版本中列出的 `mcp-setup.md` 已被有意省略——三级降级策略的工具检测逻辑将直接内联在 SKILL.md 中。数据库 ER 分析（R21-R23）已从延期项升级为 MVP 范围。

### 当前版本不做

- 不新增 Node CLI 子命令
- 不修改 adapter 架构
- 不新增专门 orchestrator agent
- 不新增专门 worker agent
- 不把 `docs/contexts/` 自动接入五阶段 prompt 消费链

## 风险与缓解

### 风险 1：上下文资产生成出来，但不被后续 workflow 使用

缓解：

- 当前版本文档明确声明“只生成，不自动接入”
- 后续版本单独做 downstream discovery / loading / injection

### 风险 2：并行任务互相覆盖共享文件

缓解：

- 采用文件级 ownership
- 共享入口文件只由 orchestrator assembly

### 风险 3：`context-slug` 混乱导致 rerun 产物分叉

缓解：

- 明确定义 slug 优先级与复用规则
- 默认不自动创建第二个 slug

### 风险 4：数据库连接失败或 CLI 不可用

缓解：

- DB 降级策略：MCP MySQL Server → CLI mysql → ORM/代码推断（标记 `[未验证]`）
- 当前版本仅 MySQL，架构预留多 DB 扩展
- 备份表/过期表使用多维度启发式过滤，结果在 ER 文档中透明报告

### 风险 5：实现计划不可移植

缓解：

- 实施计划只引用 repo 内文档
- 不依赖作者本机绝对路径

## 验收标准

### 当前版本验收

- `spec-first init --claude` 安装 `/spec:bootstrap`
- `spec-first init --codex` 同步出 `$spec-bootstrap`
- canonical bootstrap skill 在结构上接近 Trellis 源 skill
- 执行模型改为 subagent-based，而不是 `codex -q`
- 长期产物模型为 `docs/contexts/<context-slug>/...`
- 短期控制面模型为 `.context/spec-first/bootstrap/<context-slug>/tasks/*/prd.md`
- 数据库 ER 分析：后端项目 + MySQL 可连接时生成 `database/` 下的 ER 概览文档
- 数据库产物遵循索引化原则，包含 Mermaid erDiagram + 核心关系表 + 备份表排除报告
- 文档明确说明 bootstrap 是 supporting Stage-0 workflow，而不是第六个核心阶段
- 文档明确说明当前版本只负责生成 context assets，不负责自动注入后续五阶段

### 后续版本验收

留待后续版本实现：

- `brainstorm / plan / work / review / compound` 能自动发现并消费 `docs/contexts/`
- context 选择、摘要压缩、prompt 注入策略稳定
