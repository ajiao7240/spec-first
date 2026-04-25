# 阶段 0：CRG Node.js 集成技术方案

> 阶段定位：`spec-graph-bootstrap` 的基础设施前置阶段，解决"CRG 能力如何内嵌 spec-first"。
> 阶段 0 完成后，阶段 1-4 才能以 `spec-first crg <command>` 为基础构建事实抽取与上下文生成能力。
>
> 目标：在 `spec-first` npm 包内用 Node.js **从零实现** CRG 核心能力，
> 消除 Python 依赖和 MCP 手动注册步骤，实现"安装即可用"。Node.js 版是唯一实现，无 Python 共存。
>
> 集成方式：**CLI 子命令**（`spec-first crg <command>`），SKILL.md 通过 `Bash(...)` 调用，
> 输出 JSON 到 stdout。无需 MCP server 注册，无需重启 Claude。
>
> 文档范围：架构设计、技术选型、22 个工具取舍决策、模块实现范围、实施路线图。

---

## 一、当前问题

```text
现状（Python CRG 作为独立工具）：
  1. npm install -g spec-first           (Node.js)
  2. pip install code-review-graph       (Python ← 额外依赖，环境隔离)
  3. uv run code-review-graph build      (构建图，2-10 分钟)
  4. 手动编辑 claude_desktop_config.json (注册 MCP server)
  5. 重启 Claude                         (MCP 生效)
  6. spec-first init                     (安装 skill)

目标（Node.js 原生实现，唯一实现）：
  1. npm install -g spec-first           (一步完成，零 Python 依赖)
  2. spec-first init                     (安装 skill + command 资产)
  3. spec-first crg build                (构建图，首次运行)
     ← 无 Python 环境、无 MCP 注册、无重启
```

---

## 二、目标架构

### 2.1 集成后的包结构

```text
spec-first (npm package)
  ├── bin/
  │   └── spec-first.js              CLI 入口（新增 crg 子命令分发：argv[2]==='crg' → src/crg/cli/router.js）
  ├── src/
  │   ├── cli/                       现有 CLI 逻辑（init / install 等）
  │   └── crg/                       ← 新增：CRG Node.js 实现
  │       ├── parser.js              tree-sitter AST 提取（含 SENSITIVE_PATTERNS 过滤，B6）
  │       ├── graph.js               SQLite CRUD + BFS 查询
  │       ├── migrations.js          schema 版本管理（v1→vN 自动升级）
  │       ├── incremental.js         SHA 变更检测 + 增量更新
  │       ├── communities.js         3-Pass 社区检测（目录框架 + 双指标健康评估 + 连通分量精化，B2/B5）
  │       ├── analyze.js             surprising_connections + godNodes（B1/B3）
  │       ├── flows.js               执行流检测
  │       ├── search.js              FTS5 关键词搜索
  │       ├── changes.js             变更风险评分
  │       └── cli/                   ← CLI 子命令实现（17 个工具）
  │           ├── router.js          子命令分发（argv → handler）
  │           ├── build.js           build / stats / postprocess
  │           ├── query.js           query / impact / large-functions / search
  │           ├── context.js         context
  │           ├── flows.js           flows / flow / affected-flows
  │           ├── communities.js     communities / community / architecture
  │           ├── review.js          detect-changes / review-context
  │           └── analyze.js         surprising-connections / god-nodes（B1/B3）
  ├── skills/
  │   └── spec-graph-bootstrap/
  └── templates/
```

### 2.2 SQLite 数据库

Node.js 版使用 `.spec-first-graph/graph.db`（SQLite WAL 模式），schema 设计参照 Python CRG，字段语义完全一致，便于未来互操作。

### 2.3 CLI 子命令设计

`spec-first crg <command>` 直接执行内嵌的 Node.js CRG 逻辑，所有命令输出 JSON 到 stdout。SKILL.md 通过 `Bash(...)` 调用，不需要 MCP server 注册。

#### 子命令总表

参数约定：多参数命令用具名参数（`--pattern`、`--symbol/--module/--subject`）；唯一主参数命令用位置参数（`crg flow <name>`），与主流 CLI（git/kubectl）惯例一致。

| 子命令 | 对应原工具 | 典型参数 | 输出说明 |
| --- | --- | --- | --- |
| `spec-first crg stats` | `list_graph_stats_tool` | `[--repo=<path>]` | 图统计信息（节点数、边数、最后构建时间）；含 `corpus_health` 字段（small / optimal / large，B4） |
| `spec-first crg build` | `build_or_update_graph_tool` | `[--force] [--repo=<path>]` | 构建/增量更新图，输出构建摘要 |
| `spec-first crg postprocess` | `run_postprocess_tool` | `[--repo=<path>]` | 重跑 flows + communities + FTS 索引 |
| `spec-first crg context` | `get_minimal_context_tool` | `[--task=<desc>] [--repo=<path>]` | ~100 token 超紧凑项目概览 |
| `spec-first crg query` | `query_graph_tool` | `--pattern=<type> (--symbol|--module|--subject) [--repo=<path>]` | 8 种查询模式（tests_for / callers_of 等） |
| `spec-first crg impact` | `get_impact_radius_tool` | `--node=<name> [--depth=<N>] [--repo=<path>]` | fan-out / blast radius 分析 |
| `spec-first crg large-functions` | `find_large_functions_tool` | `[--limit=<N>] [--min-lines=<N>] [--repo=<path>]` | 大函数/大类风险列表 |
| `spec-first crg search <keyword>` | `semantic_search_nodes_tool` | `<keyword> [--kind=<type>] [--repo=<path>]` | FTS5 关键词搜索结果 |
| `spec-first crg flows` | `list_flows_tool` | `[--sort=criticality] [--limit=<N>] [--repo=<path>]` | 执行流列表，按重要度排序 |
| `spec-first crg flow <name>` | `get_flow_tool` | `<name> [--repo=<path>]` | 单条执行流详情 + 调用链 |
| `spec-first crg affected-flows` | `get_affected_flows_tool` | `--since=<sha> [--repo=<path>]` | 变更影响的执行流列表 |
| `spec-first crg communities` | `list_communities_tool` | `[--limit=<N>] [--repo=<path>]` | 模块社区列表；每项含 `health.status` 四象限（healthy / isolated / scattered / fragmented）+ `density` + `independence` 双指标（B2/B5） |
| `spec-first crg surprising-connections` | —（graphify 借鉴） | `[--top=<N>] [--repo=<path>]` | 跨社区非显式高惊喜边列表，每项含 `score` 和 `reasons` 字段（B1） |
| `spec-first crg community <name>` | `get_community_tool` | `<name> [--repo=<path>]` | 单个社区详情 |
| `spec-first crg architecture` | `get_architecture_overview_tool` | `[--repo=<path>]` | 项目级架构摘要 + 跨社区耦合 |
| `spec-first crg detect-changes` | `detect_changes_tool` | `--since=<sha> [--repo=<path>]` | 风险评分变更分析 |
| `spec-first crg review-context` | `get_review_context_tool` | `--since=<sha> [--repo=<path>]` | diff + 影响分析 + 代码片段 |

#### JSON 输出契约

- 所有命令输出**合法 JSON**到 stdout（无额外文字）
- 错误信息输出到 stderr，exit code 非零
- `--repo=<path>` 缺省时取当前工作目录；SKILL.md 中应始终显式传入（见 §八）

---

## 三、技术选型

| Python 依赖 | Node.js 替代 | 版本 | 说明 |
| --- | --- | --- | --- |
| `tree-sitter` + `tree_sitter_language_pack` | `tree-sitter` + 各语言包 | 0.25.x | tree-sitter 原生 Node.js API（native binding）；锁 0.25.x 与语言包保持同代际 |
| `sqlite3` (标准库) | `better-sqlite3` | 12.8.x | 同步 API，性能优于 Python sqlite3；提供 prebuild binary，避免 CI 重复编译 |
| `fastmcp` / `mcp` | ❌ 不需要 | — | CLI 子命令方式不需要 MCP SDK；SKILL.md 直接用 Bash 调用 |
| `networkx` | 自实现 BFS/DFS（~150 行） | N/A | 图遍历逻辑简单，不需要完整图库 |
| `watchdog` | ❌ v1 不需要 | — | spec-graph-bootstrap 显式调用 `crg build`，不需要文件 watch；v2 增强项 |
| `gitpython` / subprocess git | `simple-git` | 3.x | Node.js Git 操作；仅 `changes.js` 和 `incremental.js` 使用 |
| `sentence-transformers` | ❌ 不集成 | — | 向量 embedding 需 Python ML 运行时，v1 不需要 |

**Node.js 版本要求**：≥ 18 LTS（支持 `node:crypto` 原生 SHA256，无需额外依赖）

**native 模块策略**：`tree-sitter` 和 `better-sqlite3` 均为 native binding（node-gyp 编译）。缓解措施：两者均提供 prebuild binary，常见平台（macOS/Linux/Windows × x64/arm64）安装时直接下载预编译产物，不触发本地编译。**v1 不承诺 runtime fallback**（WAL 模式、FTS5、同步 prepared-statement API 在 `sql.js` / WASM 实现中不等价，贸然降级会导致行为差异）；安装失败时输出清晰诊断信息并退出，`sql.js` 支持放到后续增强阶段。

---

## 四、22 个 MCP 工具取舍决策

### 4.1 取舍总表

| # | 工具名 | MCP 能力说明 | 集成决策 | 优先级 | CLI 子命令 | 取舍原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `build_or_update_graph_tool` | 用 tree-sitter 解析源文件，写入 SQLite 图；首次全量，后续按 SHA 变更增量。输出构建摘要（新增/更新/删除节点数） | ✅ **集成** | P0 | `crg build` | Phase 0 核心：构建/增量更新图，是所有其他子命令的前提 |
| 2 | `list_graph_stats_tool` | 返回图的统计快照：节点数、边数、各语言文件数、最后构建时间、DB 路径 | ✅ **集成** | P0 | `crg stats` | Phase 0 探测：判断图是否存在、是否已索引 |
| 3 | `get_minimal_context_tool` | 单次调用返回 ~100 token 的项目全局概览：Top 执行流 + Top 社区 + 高风险节点 + 建议下一步工具调用 | ✅ **集成** | P0 | `crg context` | Phase 1 入口：超紧凑概览，SKILL.md 推荐首调，next_tool_suggestions 驱动后续 |
| 4 | `query_graph_tool` | 8 种图查询模式：`tests_for`（测试覆盖）/ `callers_of`（上游调用方）/ `importers_of`（上游导入方）/ `calls_to`（下游调用）/ `imports_from`（下游导入）/ `similar_to`（同名/同签名）/ `context_for`（文件内所有符号）/ `related_to`（BFS 邻域） | ✅ **集成** | P0 | `crg query` | Phase 1 核心：8 种查询模式覆盖事实抽取所有主路径 |
| 5 | `list_flows_tool` | 列举所有执行流（入口点），附带重要度评分（PageRank-like）、调用深度、节点数；支持按 criticality 排序 | ✅ **集成** | P0 | `crg flows` | Phase 1：入口点识别，`entrypoints` 事实的直接来源 |
| 6 | `get_flow_tool` | 返回单条执行流的完整调用链（BFS 展开）、所在文件、关键节点标注 | ✅ **集成** | P0 | `crg flow` | Phase 1：单条执行流详情，入口点深度分析 |
| 7 | `list_communities_tool` | 列举所有代码社区（模块），附带成员文件数、内聚度、跨社区耦合度；使用 3-Pass 算法（自适应目录框架 → 双指标健康评估 → oversized 连通分量精化），完全确定性，零外部依赖 | ✅ **集成** | P0 | `crg communities` | Phase 1：模块结构识别，`modules` 事实的直接来源；`scattered` 状态直接对应 `high-risk-modules.md` 风险来源 |
| 8 | `get_community_tool` | 返回单个社区的详情：成员文件列表、对外暴露的公共符号、与其他社区的依赖关系 | ✅ **集成** | P0 | `crg community` | Phase 1：单个社区详情，模块深度分析 |
| 9 | `get_architecture_overview_tool` | 生成项目级架构摘要：Top 社区 + 跨社区耦合热点 + Hub 节点（高 fan-in）+ 孤立节点列表 | ✅ **集成** | P0 | `crg architecture` | Phase 1：项目级架构摘要，跨社区耦合分析 |
| 10 | `find_large_functions_tool` | 找出超过行数阈值的函数/类，按大小降序排列；支持按语言/目录过滤 | ✅ **集成** | P0 | `crg large-functions` | Phase 1：风险信号，大函数/大类识别 |
| 11 | `get_impact_radius_tool` | 从指定节点出发 BFS，计算 blast radius（有多少节点依赖它）和 fan-out（它依赖多少节点），附带分层依赖列表 | ✅ **集成** | P0 | `crg impact` | Phase 1：风险信号，fan-out / blast radius 计算 |
| 12 | `semantic_search_nodes_tool` | 按关键词搜索节点（FTS5）或按语义相似度搜索（向量模式）；返回匹配节点列表 + 所在文件 + 相关度分数 | ✅ **集成** | P0 | `crg search` | Phase 1：data_shapes / integrations 识别；v1 使用 FTS5 关键词模式 |
| 13 | `detect_changes_tool` | 分析 git diff（指定 SHA 范围），对每个变更文件/函数输出风险评分（High/Medium/Low）+ 变更原因分类 | ✅ **集成** | P1 | `crg detect-changes` | Phase 4 刷新 + spec-code-review：风险评分变更分析，fingerprints stale 检测的依据 |
| 14 | `get_review_context_tool` | 针对 git diff 生成 review 上下文包：diff 摘要 + 影响半径分析 + 被修改函数的代码片段 + 相关测试列表 | ✅ **集成** | P1 | `crg review-context` | spec-code-review 场景：review-change.md 生成的核心数据源 |
| 15 | `get_affected_flows_tool` | 给定 git diff，返回受影响的执行流列表（哪些入口点的调用链经过了被修改的节点） | ✅ **集成** | P1 | `crg affected-flows` | spec-code-review 场景：变更影响了哪些执行流，review context pack 的补充数据 |
| 16 | `run_postprocess_tool` | 在已有图上重跑后处理流程：执行流检测 + 社区检测 + FTS5 索引重建；build 完成后自动调用，也可手动触发 | ✅ **集成** | P1 | `crg postprocess` | build 的内部步骤，独立暴露便于手动重跑（如分析器版本升级后） |
| 17 | `embed_graph_tool` | 用 sentence-transformers 为所有节点生成向量 embedding，写入 DB；启用后 semantic_search 可切换为向量模式 | ❌ **不集成** | — | — | 依赖 Python ML 运行时；v1 FTS5 已足够；向量搜索作为 v2 增强项 |
| 18 | `get_docs_section_tool` | 按章节名检索 CRG 自身的 LLM 使用文档（工具说明、最佳实践、示例） | ❌ **不集成** | — | — | 读取 CRG 自文档，与 spec-graph-bootstrap 产物生成无关 |
| 19 | `refactor_tool` | 预览重命名影响范围、检测死代码、生成重构建议；产出 refactor_id 供 apply_refactor 消费 | ❌ **不集成** | — | — | 重构操作不在 spec-graph-bootstrap 事实抽取范围内 |
| 20 | `apply_refactor_tool` | 根据 refactor_tool 产出的 refactor_id 执行实际文件修改 | ❌ **不集成** | — | — | 依赖 refactor_tool，两者一起排除 |
| 21 | `generate_wiki_tool` | 从社区结构生成多页 Markdown wiki（每个社区一页，含模块说明、关键符号、依赖关系） | ❌ **不集成** | — | — | spec-graph-bootstrap 有自己的文档体系（00-summary.md 等），格式重叠避免混淆 |
| 22 | `get_wiki_page_tool` | 按页面名检索 generate_wiki_tool 生成的 wiki 页面 | ❌ **不集成** | — | — | 依赖 generate_wiki_tool，一起排除 |
| +1 | `list_repos_tool` | 列举多仓库注册表中的所有已注册仓库及其状态 | ❌ **不集成 v1** | — | — | v1 只支持单仓库分析；Phase 4 之后可扩展 |
| +2 | `cross_repo_search_tool` | 跨多个注册仓库搜索符号、文件、调用关系 | ❌ **不集成 v1** | — | — | v1 单仓库范围；多仓库支持推迟到 v2 |

> 注：`list_repos_tool` 和 `cross_repo_search_tool` 是官方 22 个工具中的 21、22 号；`run_postprocess_tool` 是 main.py 中额外注册的第 23 个工具，纳入集成但不计入官方 22 个的取舍。

### 4.1.1 Python CLI 专属命令取舍（无 MCP 工具对应）

以下命令存在于 Python 原版 CLI，但**不对应任何 MCP 工具**，属于运维/基础设施能力，独立列表说明集成决策：

| 命令 | 功能说明 | 集成决策 | 取舍原因 |
|------|---------|---------|---------|
| `install` / `init` | 向 Claude Code / Cursor / Windsurf / Zed 等 10+ AI 平台写入 MCP 配置（`mcp.json`），注入 `CLAUDE.md` 指令，安装 hooks 和 skill 文件；`--platform` 指定目标平台 | ❌ **v1 不集成** | spec-first v1 面向单仓库 CLI 场景，MCP 集成配置由用户手动完成；v2 如需发布 npm 包可补充 |
| `update` | 显式增量更新命令：基于 `git diff --unified=0` 解析变更行号范围，精确定位受影响节点后重新解析；语义比 `build`（SHA256 fingerprint）更精确 | ❌ **v1 不集成**（由 `build` 的增量路径覆盖） | `crg build` 已内置 SHA256 增量检测；`update` 的 git-based 行级精度是 B-2（detect-changes）修复路径的前提，待 B-2 修复时一并实现 |
| `watch` | 监听仓库文件变化（基于 watchdog），变更时自动触发增量 `update` | ❌ **v1 不集成** | 开发时调试场景，非核心路径；可用 `nodemon`/`chokidar` 在外层包装 `crg build` 替代 |
| `visualize` | 生成 D3.js 交互式 HTML 图（支持 auto/full/community/file 四种渲染模式），可选 `--serve` 启动本地 HTTP server（localhost:8765）；Python `visualization.py` 约 800 行，含 SRI hash 和 HTML 实体转义 | ❌ **v1 不集成** | 可视化属于调试辅助工具，非 spec-graph-bootstrap 核心产物生成路径；JavaScript 侧可直接复用 Python 生成的 HTML（共享同一 SQLite DB） |
| `serve` | 以 stdio 传输协议启动 MCP 服务器（FastMCP），注册全部 22+ 工具供 Claude Code 等 AI 平台通过 MCP 协议调用 | ⚠️ **待评估** | spec-first v1 定位为 CLI 工具；若未来需要作为独立 MCP 服务器替换 Python 版，须基于 `@modelcontextprotocol/sdk` 实现 stdio transport 并注册 17 个 CLI 命令为 MCP 工具；工作量约 3-5 天 |
| `eval` | 运行 5 个维度质量基准测试（token_efficiency / impact_accuracy / flow_completeness / search_quality / build_performance），支持 `--report` 生成报告 | ❌ **v1 不集成** | 基准测试依赖 Python 原版的 eval framework（`eval.py`）；spec-first v1 无对应测试体系；建议以集成测试脚本替代 |

### 4.2 集成 vs 不集成分布

```text
MCP 工具集成（17 个）：P0 事实抽取核心（12）+ P0 graphify 借鉴新增（1：surprising-connections）+ P1 review/刷新（4）
MCP 工具不集成（8 个）：向量 embedding（1）+ CRG 自文档（1）+ 重构操作（2）+ wiki（2）+ 多仓库（2）
CLI 专属命令不集成（6 个）：install/init（1）+ update（1）+ watch（1）+ visualize（1）+ eval（1）+ serve（待评估，1）
```

> `surprising-connections` 无 Python CRG 原工具对应，来自 graphify 借鉴（B1），归入 P0 与社区检测同步实现。

---

## 五、核心模块重写范围

### 5.1 模块对照表

| Python 模块 | 行数 | Node.js 模块 | 预估行数 | 备注 |
| --- | --- | --- | --- | --- |
| `parser.py` | 2,809 | `crg/parser.js` | ~1,800 | tree-sitter Node.js API 比 Python 更简洁；`NodeInfo` / `EdgeInfo` 直接映射为 JS 对象 |
| `graph.py` | 1,024 | `crg/graph.js` | ~600 | `better-sqlite3` 同步 API，代码更短；SQL 语句完全复用 |
| `incremental.py` | 670 | `crg/incremental.js` | ~450 | `simple-git` 替代 subprocess git；SHA256 用 `node:crypto` |
| `communities.py` | 638 | `crg/communities.js` | ~500 | 3-Pass 社区检测：Pass 1 自适应目录框架（跳过容器层）→ Pass 2 双指标健康评估（density + independence，四象限分类）→ Pass 3 仅对 oversized(>25%) 社区执行 BFS 连通分量精化；完全确定性，零外部依赖（B2/B5） |
| `graphify/analyze.py` | 430 | `crg/analyze.js` | ~150 | 借鉴移植：surprising_connections（多因子惊喜评分，B1）+ godNodes（文件级枢纽过滤，B3）；NetworkX → SQLite 查询 |
| `flows.py` | 597 | `crg/flows.js` | ~450 | BFS 图遍历逻辑直接移植 |
| `search.py` | 393 | `crg/search.js` | ~280 | SQLite FTS5 SQL 直接复用；去除向量搜索分支（embed_graph 不集成） |
| `changes.py` | 295 | `crg/changes.js` | ~220 | git diff 解析 + 风险评分，逻辑直接移植 |
| `tools/build.py` | 440 | `crg/cli/build.js` | ~300 | build / stats / postprocess 子命令，调用 incremental + parser + graph 的编排层 |
| `tools/query.py` | 554 | `crg/cli/query.js` | ~380 | query / impact / large-functions / search / context 子命令 |
| `tools/flows_tools.py` | 176 | `crg/cli/flows.js` | ~120 | flows / flow / affected-flows 子命令 |
| `tools/community_tools.py` | 185 | `crg/cli/communities.js` | ~130 | communities / community / architecture 子命令 |
| `tools/review.py` | 468 | `crg/cli/review.js` | ~320 | detect-changes / review-context 子命令 |
| `tools/context.py` | 148 | `crg/cli/context.js` | ~100 | context 子命令 |
| —（graphify 借鉴） | — | `crg/cli/analyze.js` | ~80 | surprising-connections / god-nodes 子命令入口（B1/B3） |
| **合计** | **8,397** | | **~5,880** | 约 70% 代码量；含 graphify 借鉴的 5 个算法模块（B1-B6，合计 ~590 行）；无 MCP server 层 |

### 5.2 不重写的模块（不在集成范围内）

| Python 模块 | 原因 |
| --- | --- |
| `main.py`（MCP server） | CLI 子命令方式不需要 MCP server；SKILL.md 直接用 Bash 调用 |
| `embeddings.py` | 依赖 sentence-transformers，不集成 embed_graph_tool |
| `visualization.py` | D3.js HTML 可视化，与 spec-graph-bootstrap 无关 |
| `wiki.py` | 依赖 generate_wiki_tool，不集成 |
| `refactor.py` | 依赖 refactor_tool，不集成 |
| `registry.py` | 依赖 list_repos / cross_repo_search，v1 不集成 |
| `hints.py` | review hint 生成，已被 review.py 覆盖 |
| `prompts.py` | 5 个 MCP prompt 模板；spec-graph-bootstrap 不依赖 CRG prompt，用自己的 SKILL.md |
| `eval/` | 评估框架，开发工具，不集成 |
| `tsconfig_resolver.py` | TypeScript path alias 解析；在 Node.js 端可在 parser.js 内直接实现 |

---

## 六、语言支持范围

Python 版使用 `tree-sitter-language-pack`（自动安装 50+ 语言），Node.js 版需明确声明依赖。

### 6.1 v1 优先支持（spec-graph-bootstrap 主要目标语言）

```json
"dependencies": {
  "tree-sitter": "~0.25.0",
  "tree-sitter-javascript": "~0.25.0",
  "tree-sitter-typescript": "~0.25.0",
  "tree-sitter-python": "~0.25.0",
  "tree-sitter-go": "~0.25.0",
  "tree-sitter-java": "~0.25.0",
  "tree-sitter-rust": "~0.25.0",
  "tree-sitter-c": "~0.25.0",
  "tree-sitter-cpp": "~0.25.0",
  "tree-sitter-ruby": "~0.25.0",
  "tree-sitter-php": "~0.25.0",
  "better-sqlite3": "~12.8.0",
  "simple-git": "~3.0.0"
}
```

> 版本使用 `~`（patch-level）而非 `^`（minor-level），防止语言包小版本升级导致解析行为静默变化。CSS 从 v1 列表移除——CSS 不含函数/类节点，AST 提取无实质收益，按需加入 v2。

### 6.2 iOS / KMP 扩展（已在 §14.7 实现，按需安装）

`tree-sitter-swift`、`tree-sitter-objc`、`tree-sitter-kotlin`。
详见 §14.7 的 `detectPresentLanguages` 按需策略——从输入收敛后的最终输入集合推导语言集合，仅加载实际出现语言。

### 6.3 v2 进一步扩展（后续计划）

`tree-sitter-vue`、`tree-sitter-solidity` 等。Python 版支持的 19 语言可逐步补齐。

---

## 七、SQLite Schema 定义

数据库路径：`<repo_root>/.spec-first-graph/graph.db`（WAL 模式，存放在目标仓库内，不提交到 git）。

**外键策略**：`migrations.js` 在建库时执行 `PRAGMA foreign_keys = ON`，后续每次连接同样开启。社区重建操作必须遵循外键安全顺序：先 `UPDATE nodes SET community_id = NULL`，再 `DELETE FROM communities`，再插入新社区并回填（见 §14.5、§14.8.3 实现参考）。

```sql
-- 节点表：每个有语义的代码符号对应一行
CREATE TABLE nodes (
    id           INTEGER PRIMARY KEY,
    symbol_key   TEXT NOT NULL UNIQUE, -- 稳定标识：<file_path>#<kind>#<name>#L<line_start>
    name         TEXT NOT NULL,
    kind         TEXT NOT NULL,        -- 'module' | 'function' | 'method' | 'class' | 'class_method' | 'struct' | 'interface'
    file_path    TEXT NOT NULL,
    line_start   INTEGER,
    line_end     INTEGER,
    language     TEXT,
    parent_name  TEXT,                 -- 所属类/模块名
    params       TEXT,                 -- 函数参数签名（序列化字符串）
    return_type  TEXT,
    modifiers    TEXT,                 -- public/private/static 等
    is_test      INTEGER DEFAULT 0,
    confidence   TEXT    DEFAULT 'Observed', -- Observed | Inferred | Unknown（surprisingConnections F1 评分使用）
    community_id INTEGER REFERENCES communities(id),  -- 3-Pass 社区归属（crg postprocess 后写入，B2/B5）
    extra        TEXT,                 -- JSON blob（扩展字段）
    sha          TEXT,                 -- 所在文件的 SHA256
    signature    TEXT                  -- FTS5 索引用，name + params 拼接
);
-- community_id 外键注意：communities 表需先建表，nodes 表后建；migration v1 中顺序已保证。
-- communityHealth() 通过 `WHERE community_id = ?` 批量取节点，crg postprocess 负责写入，
-- crg build 调用 postprocess 保证首次 build 后即可用。
-- confidence 赋值规则：
--   Observed  = parser 从 AST 直接提取（默认值）
--   Inferred  = 名称/路径启发式推断（如 test_naming_convention）
--   Unknown   = 无法判断来源（保留，用于未来降级场景）

-- 边表：符号之间的关系
CREATE TABLE edges (
    id          INTEGER PRIMARY KEY,
    kind        TEXT NOT NULL,    -- CALLS | IMPORTS_FROM | INHERITS | IMPLEMENTS | CONTAINS | TESTED_BY
    source_id   INTEGER NOT NULL REFERENCES nodes(id),
    target_id   INTEGER NOT NULL REFERENCES nodes(id),
    source_key  TEXT NOT NULL,    -- 冗余存储，便于调试和导出
    target_key  TEXT NOT NULL,
    file_path   TEXT,
    line        INTEGER,
    extra       TEXT
);

-- 社区表：3-Pass / Pod 边界社区检测产出的模块聚类（crg postprocess 写入）
-- 建表顺序约束：SQLite 外键完整性要求此表必须早于 nodes 表创建
--              （nodes.community_id REFERENCES communities(id)）
CREATE TABLE communities (
    id                  INTEGER PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    file_count          INTEGER,
    health_status       TEXT,         -- healthy | isolated | scattered | fragmented（B2/B5）
    health_density      REAL,         -- 内聚度：intra_edges / max_possible_edges
    health_independence REAL,         -- 独立度：intra_edges / (intra_edges + inter_edges)
    metadata            TEXT          -- JSON blob（扩展字段：note、oversized flag 等）
);

-- 执行流表：入口点及其调用链摘要
CREATE TABLE flows (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,  -- 入口函数名（selector / 方法名）
    entry_point_id  INTEGER REFERENCES nodes(id),  -- 入口节点 DB id（BFS 起点）
    action_id       TEXT,                  -- iOS CTMediator 稳定地址（如 "trade/checkoutJumpToBuySellVC"）
    file_path       TEXT,
    criticality     REAL DEFAULT 0,        -- PageRank-like 重要度分数
    metadata        TEXT                   -- JSON blob（调用深度、节点数等）
);

-- 流节点关联表
CREATE TABLE flow_nodes (
    flow_id   INTEGER REFERENCES flows(id),
    node_id   INTEGER REFERENCES nodes(id),
    node_key  TEXT NOT NULL,
    depth     INTEGER,
    PRIMARY KEY (flow_id, node_id)
);

-- 元数据表：schema 版本 + build 时间戳 + 分析器版本
CREATE TABLE graph_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
-- key 枚举：schema_version | last_built | analyzer_version | repo_root

-- 文件指纹表：增量检测基座（§14.2 detectChangedFiles 使用）
-- file_path 作为主键，每次 crg build 时批量比对 SHA256 确定变更/删除文件
CREATE TABLE fingerprints (
    file_path   TEXT PRIMARY KEY,
    sha256      TEXT NOT NULL,
    updated_at  INTEGER          -- Unix timestamp（unixepoch()）
);

-- FTS5 全文搜索虚表（关键词搜索）
CREATE VIRTUAL TABLE fts_nodes USING fts5(
    name, signature, content='nodes', content_rowid='id'
);
```

**Schema 版本管理**：`graph_meta` 的 `schema_version` 字段由 `migrations.js` 管理。首次 `crg build` 时自动执行全量建表（v1），后续版本升级执行增量 ALTER TABLE / 数据迁移，不破坏已有数据。
为避免同名符号歧义，`schema v2` 起边关系统一以 `source_id/target_id` 为主，`source_key/target_key` 仅作可读性冗余字段；若从早期试验表迁移，`migrations.js` 需执行一次性回填并校验外键完整性。

`fingerprints.json`（Phase 4 刷新基座）采用依赖图结构，至少包含：

```json
{
  "schema_version": "fingerprints/v1",
  "analyzer_version": "crg-node/0.1.0",
  "graph_schema_version": "2",
  "inputs": {
    "src/api/handler.ts": "sha256:...",
    "src/db/client.ts": "sha256:..."
  },
  "outputs": {
    "fact-inventory.json": {
      "depends_on": ["src/api/handler.ts", "src/db/client.ts"]
    },
    "context-packs/review-change.md": {
      "depends_on": ["fact-inventory.json", "risk-signals.json"]
    }
  }
}
```

**`.gitignore` 约定**：目标仓库应将 `.spec-first-graph/` 加入 `.gitignore`，图数据库属于本地构建产物，不应提交。

**输入收敛与排除配置约定**：目标仓库在根目录放置 `.spec-first-graphignore`（gitignore 语法）作为仓库级排除配置。`crg build` 应优先使用 `git ls-files`（tracked-only）构建候选集合，再应用内置默认规则 + `.spec-first-graphignore` 规则，最后执行语言过滤。详见《[阶段0-输入收敛与排除规则技术方案](./阶段0-输入收敛与排除规则技术方案.md)》。
v1 约定该文件由仓库侧维护，`spec-first init` 默认不强制覆写，避免覆盖项目已有治理规则。

---

## 八、CLI 接口规范

### 8.1 调用约定

```text
spec-first crg <subcommand> [positional-arg] [--option=value ...]

通用选项：
  --repo=<path>    目标仓库根目录；缺省取 CWD
  --help           显示子命令用法

输出规范：
  stdout  → 合法 JSON（无任何前缀文字，消费方直接 JSON.parse）
  stderr  → 错误信息、警告、降级说明（不影响 stdout 可解析性）
  exit 0  → 成功（含带 warning 的降级成功）
  exit 1  → 参数错误或可恢复业务错误
  exit 2  → 致命错误（图未构建、DB 损坏）
```

### 8.2 `--repo` 参数来源约定

`spec-first crg` 操作的是**目标仓库**，不是 spec-first 自身。SKILL.md 执行时必须显式传入 `--repo`：

```bash
# SKILL.md 中的标准写法
# TARGET_REPO 由 spec-graph-bootstrap Phase 0 从 task context 读取（通常是用户执行 skill 时的 CWD）
Bash("spec-first crg stats --repo=${TARGET_REPO}")
Bash("spec-first crg build --repo=${TARGET_REPO}")
```

- `TARGET_REPO` 由 spec-graph-bootstrap SKILL.md 的最外层从执行上下文确定，向下传递
- 省略 `--repo` 时取 CWD，仅适合用户在目标仓库目录下手动调试

### 8.3 SKILL.md 调用模式（唯一权威参考）

Phase 0：探测图状态

```bash
Bash("spec-first crg stats --repo=${TARGET_REPO}")
# 返回：{ "node_count": 1234, "edge_count": 5678, "last_built": "2026-04-10T...", "schema_version": "1" }
# 图未构建时：exit 2，stderr: "graph not found, run: spec-first crg build --repo=..."
```

Phase 0：首次或强制重建

```bash
Bash("spec-first crg build --repo=${TARGET_REPO}")
# 增量模式：自动检测 SHA 变更，只重解析变更文件
# 强制全量：Bash("spec-first crg build --force --repo=${TARGET_REPO}")
```

Phase 1：事实抽取

```bash
Bash("spec-first crg context --task='identify public API entrypoints' --repo=${TARGET_REPO}")
Bash("spec-first crg flows --sort=criticality --limit=20 --repo=${TARGET_REPO}")
Bash("spec-first crg query --pattern=callers_of --symbol=src/api/handler.ts#function#handleRequest#L42 --repo=${TARGET_REPO}")
Bash("spec-first crg architecture --repo=${TARGET_REPO}")
Bash("spec-first crg large-functions --limit=30 --min-lines=100 --repo=${TARGET_REPO}")
Bash("spec-first crg impact --node=src/db/connection.js --depth=3 --repo=${TARGET_REPO}")
```

spec-code-review 场景：

```bash
Bash("spec-first crg detect-changes --since=HEAD~1 --repo=${TARGET_REPO}")
Bash("spec-first crg review-context --since=HEAD~1 --repo=${TARGET_REPO}")
Bash("spec-first crg affected-flows --since=HEAD~1 --repo=${TARGET_REPO}")
```

### 8.4 降级行为

| 状态 | stdout | exit code | stderr 说明 |
| --- | --- | --- | --- |
| 图未构建（无 `.spec-first-graph/graph.db`） | — | 2 | `graph not found; run: spec-first crg build --repo=<path>` |
| 图已过期（SHA stale） | 正常 JSON + `"warning"` 字段 | 0 | 降级说明（哪些文件已过期） |
| 子命令不存在 | — | 1 | `unknown subcommand: <name>; run --help` |
| 参数缺失或格式错误 | — | 1 | 用法说明 |
| DB 损坏 / 读写失败 | — | 2 | 错误详情 + 建议执行 `crg build --force` |

### 8.5 JSON 输出契约（v1 冻结）

为满足 Facts First + Honest Confidence，所有子命令输出需包含统一 envelope 字段：

```json
{
  "schema_version": "crg-cli/v1",
  "generated_at": "2026-04-10T12:00:00Z",
  "repo_root": "/abs/path/repo",
  "degraded": false,
  "warnings": [],
  "data": {}
}
```

事实项最小字段要求：

- `confidence`: `Observed | Inferred | Unknown`
- `source_tier`: `crg_ast | serena_semantic | grep_glob`
- `evidence`: 证据位置（如 `file_path`、`line_start`、`line_end`、`symbol_key`）
- `inference_reason`: 当 `confidence=Inferred` 时必填，且必须取固定枚举值

`inference_reason` v1 枚举：
`semantic_similarity`、`name_heuristic`、`path_heuristic`、`test_naming_convention`、`import_pattern_match`

### 8.6 `crg query` 参数契约（去歧义）

`crg query` 不再使用单一 `--target` 承载全部 pattern，按模式拆分参数：

- `callers_of` / `calls_to` / `related_to`：`--symbol=<symbol_key>`
- `importers_of` / `imports_from`：`--module=<module_or_file>`
- `tests_for` / `context_for` / `similar_to`：`--subject=<symbol_or_file>`

CLI 层需在参数解析阶段校验 pattern 与参数组合；不合法组合统一返回 exit 1。

### 8.7 Workflow 级降级约定（不阻断主任务）

为保证 Stage-0 产物是增强项而非阻断项，spec-plan/work/review 在消费 CRG 时统一采用 `safe_crg_call` 约定：

```bash
safe_crg_call() {
  cmd="$1"
  if out=$(eval "$cmd" 2>_crg_err.tmp); then
    printf '%s\n' "$out"
    return 0
  fi
  code=$?
  if [ "$code" -eq 2 ]; then
    printf '{"degraded":true,"fallback":"repo_research"}\n'
    return 0
  fi
  return "$code"
}
```

约束：`exit 2` 只能触发降级，不能导致 workflow 整体失败；降级原因必须记录在产物元数据中。

---

## 九、spec-first init 变更

`spec-first init` 在现有逻辑基础上保持不变，**不需要写入 MCP 配置**：

```text
现有步骤（保持不变）：
  1. 安装 skill runtime 资产
  2. 安装 command 文件

无需新增：
  ✗ 写入 claude_desktop_config.json   ← CLI 子命令方式无需 MCP 注册
  ✗ 提示用户重启 Claude               ← 不需要 MCP 生效步骤

可选新增（首次使用引导）：
  3. 检测 .spec-first-graph/graph.db 是否存在
     └─ 不存在：输出提示 "Run 'spec-first crg build' to index this repo"
```

幂等保证：重复执行 `spec-first init` 不产生脏状态，行为与现有实现一致。

---

## 十、实施路线图

### Step 0：契约冻结（预计 2-3 天）

**目标**：先冻结对外契约，再写实现，避免后续 breaking change。

交付物：

- `docs/contracts/crg-cli-v1.schema.json`（统一 envelope + 各子命令 `data` schema）
- `docs/contracts/crg-fact-item.schema.json`（`confidence/source_tier/evidence/inference_reason`）
- `docs/contracts/crg-query-args.md`（pattern × 参数矩阵）

验收标准：

- 每个子命令都有 JSON schema，且能通过契约测试
- `Inferred` 事实若缺少 `inference_reason`，契约测试必须失败
- `crg query` 参数组合非法时稳定返回 exit 1

---

### Step 1：最小可用 MVP（预计 2-3 周）

**目标**：`crg build / stats / context / query` 四个核心子命令可在真实项目上运行

交付物：

- `crg/migrations.js`：建表 + schema v1 初始化，`crg build` 首次运行时自动执行
- `crg/parser.js`：支持 JS/TS/Python 三种语言，提取 Function/Class/Import/Test 节点和 CALLS/IMPORTS_FROM 原始引用（`target_name` / `target_path_raw`）
- `crg/graph.js`：SQLite CRUD（基于 §七 schema）+ `resolveEdges(db, rawEdges, repoRoot)`（将原始引用解析为 `source_id/target_id` canonical 边，见 §14.1.5）
- `crg/incremental.js`：SHA 变更检测 + 增量更新
- `crg/cli/router.js`：子命令分发层
- `crg/cli/build.js`：`crg build`（全量 + 增量）+ `crg stats` 子命令
- `crg/cli/query.js`：`crg query`（8 种 pattern）子命令（按 §8.6 参数矩阵校验）
- `crg/cli/context.js`：`crg context` 子命令
- `crg/analyze.js`：surprising_connections + godNodes（B1/B3，依赖 communities 完成后可独立追加）
- `bin/spec-first.js` 新增 crg 路由（`argv[2] === 'crg'` 分发至 router.js）
- `tests/contracts/crg-cli-v1.test.js`：命令输出契约测试（优先于功能测试）

验收标准：

- `spec-first crg build --repo=<project>` 返回合法 JSON，包含 `node_count`、`edge_count`
- `spec-first crg stats --repo=<project>` 返回合法 JSON，`schema_version` 字段存在
- `spec-first crg context --repo=<project>` 返回合法 JSON，包含 `top_flows`、`top_communities`
- `spec-first crg query --pattern=callers_of --symbol=<symbol_key> --repo=<project>` 返回合法 JSON
- 图未构建时 `crg stats` exit 2，stderr 包含提示信息
- 同名函数场景下 `impact/query` 结果不串线（以 `symbol_key` 断言）

---

### Step 2：覆盖全部 17 个子命令（预计 1-2 周）

**目标**：17 个子命令全部就绪，JSON 输出稳定

新增：

- `crg/communities.js`：3-Pass 目录框架社区检测（Pass 1 目录分组 + Pass 2 O(E) 健康评估 + Pass 3 BFS 精化，见 §14.5）
- `crg/flows.js`：执行流检测（BFS 图遍历 + PageRank-like 评分）
- `crg/search.js`：FTS5 关键词搜索
- `crg/cli/communities.js`：`crg communities` + `crg community <name>` + `crg architecture` 子命令
- `crg/cli/flows.js`：`crg flows` + `crg flow <name>` + `crg affected-flows` 子命令
- `crg/cli/query.js` 补全：`crg impact` + `crg large-functions` + `crg search <keyword>` 子命令
- `crg/cli/review.js`：`crg detect-changes` + `crg review-context` 子命令（依赖 Step 3 的 changes.js）
- 语言支持按需扩展（不设 v1.1/v1.2 版本门槛；由仓库实际语言分布驱动）
- parser 增加 `.h/.mm` 路由策略（内容判定 + 回退链路）
- 解析器抽取层引入 `LANG_SPEC[lang]`（节点类型 + 名称字段优先级 + 调用/导入提取器），替代全局 `FUNC_TYPES/CLASS_TYPES`

验收标准：

- 17 个子命令在 2 个真实项目上均返回合法 JSON，无 exit 2 意外退出
- `crg flows --sort=criticality` 输出按 criticality 降序排列
- `crg communities` 输出社区数 ≥ 1，成员文件列表非空
- `crg search <keyword>` 在已知有该关键词的项目上返回匹配结果
- 所有输出中 `confidence/source_tier` 字段覆盖率 100%
- 输入收敛生效：`Pods/graphify-out/build/dist/.git` 在最终输入集合中的文件数为 0（fixture + 真实仓库各 1 例）
- `.h` 文件在 ObjC/C/C++ 混合仓库下可稳定分类（fixture 断言）
- **B2/B5**：`crg communities` 每项含 `health.status`（healthy / isolated / scattered / fragmented）、`health.density`、`health.independence` 三个字段；顶层含 `stats.by_status` 汇总计数
- **B5 Pass 3**：对超过 总节点数×25% 的社区，连通分量分析后若有 ≥2 个子集，各自独立输出为独立社区；子目录再分组失败时输出 `health.note: "oversized, no split boundary found"` 而不是静默截断
- **B1**：`crg surprising-connections` 输出合法 JSON，每项含 `score`（整数）和 `reasons`（string[]）字段；不含 `imports / contains / defined_in` 结构边
- **B3**：`crg architecture` 的 `hub_nodes` 列表不含 `kind=module` 的文件级节点，只返回 Class / Function 等实体节点
- **B4**：`crg stats` 输出含 `corpus_health.status`（small / optimal / large）和 `corpus_health.total_loc` 字段
- **B6**：`crg build` 跳过匹配敏感文件正则的文件，stderr 输出 `skipped_sensitive: N`，`graph.db` 节点表和 FTS 索引均不含敏感文件路径

---

### Step 3：review 场景 + 增量刷新稳定（预计 1 周）

**目标**：spec-code-review 和 Phase 4 刷新所需子命令可靠运行

新增：

- `crg/changes.js`：git diff 解析 + 风险评分（High/Medium/Low）
- `crg postprocess` 子命令独立暴露
- `crg build` 增量模式稳定：重复执行只重解析变更文件，`crg stats` 输出 `last_built` 时间戳正确更新
- `fingerprints.json`：输入 SHA + 分析器版本 + schema 版本 + 产物依赖关系

验收标准：

- `crg detect-changes --since=HEAD~1 --repo=<project>` 返回含 `risk_level` 字段的合法 JSON
- `crg review-context --since=HEAD~1 --repo=<project>` 返回含 `diff_summary`、`affected_nodes` 的合法 JSON
- 对同一仓库执行两次 `crg build`，第二次输出 `changed_files: 0`（无变更时），验证增量逻辑正确
- `crg stats` 在图过期时输出 `"warning": "stale"` 字段，不 exit 2
- 指定单文件变更时，局部刷新只重算受影响产物（由 fingerprints 依赖图验证）

---

### Step 4：稳定化与测试（预计 1 周）

- 编写 Jest 测试覆盖 parser、graph、incremental 三个核心模块的边界情况
- `spec-first init` 幂等性验证
- 在 code-review-graph 本仓库上自举验证（用 Node.js 版分析 Python 代码库）
- 在 spec-first 本仓库上验证 JS/TS 解析准确性
- 记录安装与构建 SLO：`npm install -g spec-first` 耗时、`crg build` p50/p95、首次失败率

---

### Step 5：消费闭环验证（3A/3B gate，预计 3-5 天）

**目标**：证明产物“被正确消费且有收益”，而不是“只会生成”。

交付物：

- `docs/validation/graph-bootstrap-3a-logs/*.md`（真实任务验证记录）
- `expected_inputs` vs `actual_inputs` 比对脚本
- `fallback_reason` 聚合报告（识别误降级/过度降级）

验收标准：

- 至少 2 类真实任务（plan/review）验证通过
- `context token` 相比无 CRG 基线下降（目标：p50 至少 20%）
- `review` 场景中受影响流覆盖率提升（目标：关键改动漏检率下降）
- 达标后才允许进入 SKILL.md 的 3B 固化

---

## 十一、风险与缓解

| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| **spec-first 零依赖策略被打破** | tree-sitter + better-sqlite3 引入 native 编译，`npm install -g spec-first` 时间从秒级升至分钟级；无构建工具的 CI 可能失败 | ① 两者均优先使用 prebuild binary（主流 macOS/Linux/Windows × x64/arm64 免编译）；② crg 模块延迟 require（仅 `spec-first crg` 子命令触发时加载，不影响其他命令启动速度）；③ postinstall 检测 native 可用性，不可用时输出清晰提示而非静默失败 |
| **native 模块在受限环境编译失败** | 无 node-gyp / build-tools 的 CI 或容器无法安装 | v1 不提供 runtime fallback（WAL / FTS5 / 同步 API 与 sql.js/WASM 不等价）；prebuild binary 已覆盖常见平台；安装失败时输出清晰诊断并退出，fallback 支持放到后续增强阶段 |
| **社区检测稳定性**（已解决） | ~~Leiden 随机种子导致 fingerprints.json 跨 rerun 失效~~ | 3-Pass 算法（B5）完全绕开 Leiden：Pass 1 目录框架确定性分组，Pass 3 BFS 连通分量（~30 行零依赖）；rerun 结果严格一致，此风险已消除 |
| **tree-sitter 各语言包版本碎片化** | 语言包与主包版本不兼容，解析报错或结果静默异常 | 所有语言包统一锁 `~0.25.x`；CI 矩阵覆盖 macOS/Linux × Node 18/20/22；语言包升级需 CI 全矩阵通过后合入 |
| **从零实现无参照测试集** | 边界行为缺失，解析错误难以发现 | 以 Python CRG 的解析结果作为 ground truth：对同一仓库两版本建图，对比节点数/边数差异；每种语言建立 ≥3 个 fixtures 覆盖边界 case |
| **CLI JSON 输出格式与 SKILL.md 期望不匹配** | 事实抽取静默失败 | 每个子命令以 TypeScript interface 形式定义 JSON schema；输出格式变更视为 breaking change，需 major 版本号；SKILL.md 消费侧校验必要字段 |

---

## 十二、与 Python CRG 的关系

Node.js 版是 **spec-graph-bootstrap 的唯一 CRG 实现**，不依赖 Python CRG，也不需要与它共存。

Python CRG（`code-review-graph`）是独立项目，继续作为功能更完整的工具独立演进（MCP server、可视化、向量搜索、多仓库、重构分析等）。两个项目的关系是：

- **参照关系**：Node.js 版的 SQLite schema 设计和算法逻辑以 Python 版为参照基准
- **测试基准**：Python CRG 的解析结果可作为 Node.js 版的 ground truth 对比样本
- **功能边界不同**：Python 版全功能；Node.js 版只实现 spec-graph-bootstrap 需要的 16 个子命令子集

---

## 十三、终局倒推优化映射（逐项闭环）

| 问题 | 优化动作 | 落地位置 | 验收方式 |
| --- | --- | --- | --- |
| 同名符号导致关系串错 | 引入 `symbol_key`，边改为 `source_id/target_id` | §七 Schema | 同名函数 fixture 下 `impact/query` 结果不串线 |
| 置信度不可追溯 | 冻结统一 JSON envelope + `confidence/source_tier/evidence/inference_reason` | §8.5 + Step 0 | 契约测试校验必填字段与枚举 |
| query 参数语义模糊 | pattern 与参数组合矩阵化，非法组合直接 exit 1 | §8.6 | CLI 参数组合测试 |
| CRG 故障阻断主任务 | 统一 `safe_crg_call`，`exit 2` 自动降级并记录原因 | §8.7 | plan/work/review 在图缺失时仍可继续 |
| 增量刷新不可判定 | `fingerprints.json` 显式维护输入与产物依赖图 | §七 + Step 3 | 单文件变更触发局部重算 |
| 只验证”能生成”未验证”有收益” | 引入 Step 5（3A/3B gate）与量化指标 | Step 5 | token 降幅、漏检率、fallback 命中率达标 |
| 社区检测跨 rerun 漂移导致 fingerprints 失效 | 3-Pass 算法（B5）：目录框架 + BFS 连通分量替代 Leiden，完全确定性 | §五 communities.js | rerun 两次社区 ID 完全一致（fixture 测试验证） |
| `crg architecture` 被文件级节点污染误报 god node | B3 神节点过滤：module 类型 + 方法存根 + 孤立函数三规则 | §五 analyze.js | `hub_nodes` 列表在含 `index.ts` 的项目上不出现文件名节点 |
| 高风险模块识别缺乏结构性依据 | B2 双指标四象限：`scattered`（高密度+低独立性）直接对应耦合热点 | §五 communities.js | `crg communities` 输出的 `scattered` 社区可直接驱动 `high-risk-modules.md` |
| 敏感文件被解析后写入图导致信息泄露 | B6 敏感文件前置过滤（5 条正则，解析前拦截） | §五 parser.js | `crg build` 在含 `.env` 文件的仓库上 `skipped_sensitive ≥ 1`，FTS 无敏感路径 |

---

## 十四、核心算法实现参考

> 详细实现已迁移至独立文档：**[阶段0-核心算法实现参考.md](./阶段0-核心算法实现参考.md)**

八个核心算法 / 适配层概览：

| # | 算法 | 所在模块 | 关键设计 |
| --- | --- | --- | --- |
| 14.1 | tree-sitter 解析器骨架 | `parser.js` | PARSER_POOL 模块级缓存；字节读一次（TOCTOU-safe）；symbolKey 跨 rerun 去重 |
| 14.2 | SHA-based 增量检测 | `incremental.js` | 1 次批量 SELECT 到 Map；单事务批量 upsert/delete |
| 14.3 | BFS 影响半径 | `graph.js` | `loadAdjacency()` 预加载全图边；BFS 全程内存，零循环内 DB 查询 |
| 14.4 | 执行流 + PageRank-like 评分 | `flows.js` | CALLS 边预加载；20 次纯 JS 迭代；流路径复用同一邻接表 |
| 14.5 | 3-Pass 社区检测 | `communities.js` | `buildEdgeIndex` Set O(1) 健康评估；`withTempIds` 防 IN 子句爆炸；BFS 连通分量 + 子目录 fallback |
| 14.6 | 多因子惊喜评分 + 神节点过滤 | `analyze.js` | `buildDegreeMap` 预计算替代相关子查询；JOIN-only godNodes fan_in 过滤 |
| 14.7 | Swift / ObjC / Kotlin 解析器扩展 | `parser.js`（`detectPresentLanguages` + `LANG_SPEC` + LANG_LOADERS） | 从输入收敛后的最终输入集合推导语言并按需加载 grammar；`LANG_SPEC[lang]` 统一声明提取规则；ObjC selector 拼接；`message_expression` 提取；Kotlin `@HiddenFromObjC` 标注 |
| 14.8 | iOS 架构适配层 | `adapters/ios/` | CTMediator `Action_*` 入口策略；Pod 边界社区（O(N) 替代 3-Pass）；action_id 稳定寻址；3-Tier 符号解析 |
