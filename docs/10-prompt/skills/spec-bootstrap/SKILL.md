---
name: spec-bootstrap
description: “第 0 阶段支持工作流程：分析目标项目并在 docs/contexts/<slug>/ 下生成长期存在的项目上下文资产。在头脑风暴/计划/工作/审查之前运行此操作，为这些工作流程提供持久的上下文基础。”
argument-hint: "[target repo path or context slug]"
user-invocable: true
---
# 规范优先引导程序

为目标存储库引导持久的项目上下文。这是一个 **Stage-0 支持工作流程** - 它运行一次（或按需）以生成后续规范优先工作流程可以使用的上下文资产。

**克劳德入口点：** `/spec:bootstrap [target-repo-path-or-slug]`
**法典入口点：** `$spec-bootstrap [target-repo-path-or-slug]`

## 为什么会存在

spec-first 的五阶段工作流程（头脑风暴 → 计划 → 工作 → 审查 → 复合）在能够利用稳定的项目级上下文（架构、模块边界、已知陷阱和数据关系）时效果最佳。如果没有这个基础，每个工作流会话都会冷启动，导致分析不一致和推理工作重复。

`spec-bootstrap` 通过在 `docs/contexts/<slug>/` 生成可重用上下文库来解决这个问题。它不是主工作流程的第六阶段 - 它是您在加入新项目或在重大更改后刷新上下文时运行的必备资产生成器。

**当前版本范围：** 仅生成上下文资产。自动注入五阶段工作流程是未来的一项功能。

---

## 先决条件

在运行引导程序之前：

1.您正在内部运行或指向**目标项目**（而不是规范优先框架存储库本身）
2. Claude Code 或 Codex 具有目标项目源代码树的读取权限
3.（可选）MySQL CLI (`mysql`) 或 MCP MySQL 服务器可用于数据库 ER 生成
4.（可选）Serena MCP (`mcp__serena__*`) 用于增强代码分析

### MCP 工具设置

要启用完整或增强分析模式，请安装所需的 MCP 工具：
```bash
/spec:mcp-setup quick
```
这将安装：
- **GitNexus** + **ABCoder** （对于完整模式）
- **Serena**（用于增强模式）
- 顺序思维，Context7（普遍依赖）

⚠️ **安装后重新启动 Claude Code** 以使更改生效。

**完整模式的附加设置：**

GitNexus 需要对目标项目建立索引：
```bash
npx gitnexus analyze
```
ABCoder 在 `/spec:bootstrap` 执行期间自动配置（无需手动设置）。

验证安装：
```bash
claude mcp list | grep -E "gitnexus|abcoder|serena"
```
**推荐的`.gitignore`条目**（添加到目标项目）：
```
.context/spec-first/
```
`.context/` 控制平面包含 PRD 任务契约和临时引导状态 - 它不应该被提交到版本控制。

### 工具使用指南

#### GitNexus（完整模式）

架构级分析：集群、流程、影响。

|工具|目的|示例|
|------|---------|---------|
| `gitnexus_query` |查找执行流程 | `gitnexus_query({query: "authentication flow"})` |
| `gitnexus_context` | 360° 符号视图 | `gitnexus_context({name: "AuthService"})` |
| `gitnexus_cypher` |图形查询 | `gitnexus_cypher({query: "MATCH (n:Class) RETURN n.name LIMIT 20"})` |
| `gitnexus_impact` |爆炸半径分析| `gitnexus_impact({target: "UserModel", direction: "downstream"})` |

**有用的密码模式**：
```cypher
-- Find classes in directory
MATCH (n:Class) WHERE n.file CONTAINS 'src/core' RETURN n.name, n.file

-- Find callers of a function
MATCH (a:Function)-[:CALLS]->(b:Function {name: 'fetchData'}) RETURN a.name, a.file

-- Cross-package dependencies
MATCH (a)-[r]->(b) WHERE a.file CONTAINS 'pkg-a' AND b.file CONTAINS 'pkg-b'
RETURN a.name, type(r), b.name LIMIT 20
```
**工作流程**：首先 GitNexus（识别流程）→ ABCoder 第二（获取签名）→ 读取源代码（完整上下文）

#### ABCoder（完整模式）

符号级分析：AST 节点、签名、依赖项。

|工具|层 |目的|示例|
|------|--------|---------|---------|
| `list_repos` | 1 |列出已解析的存储库 | `list_repos()` |
| `get_repo_structure` | 2 |文件/包列表 | `get_repo_structure({repo_name: "my-project"})` |
| `get_file_structure` | 3 |文件中的节点 | `get_file_structure({repo_name: "my-project", file_path: "src/auth.ts"})` |
| `get_ast_node` | 4 |完整代码 + 依赖 | `get_ast_node({repo_name: "my-project", node_ids: [...]})` |

**4 层向下钻取**：list_repos → get_repo_struct → get_file_struct → get_ast_node

#### Serena（增强模式）

语义代码分析：符号查找、结构概述、模式搜索。

|工具|目的|示例|
|------|---------|---------|
| `mcp__serena__get_symbols_overview` |文件结构 | `mcp__serena__get_symbols_overview({relative_path: "src/auth.ts"})` |
| `mcp__serena__find_symbol` |定位符号 | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` |模式搜索| `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |
| `mcp__serena__find_referencing_symbols` |查找参考资料 | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

**工作流程**：get_symbols_overview（结构）→ find_symbol（定位）→ find_referencing_symbols（调用者）→ 读取源代码（详细信息）

---

## 主机就绪门

**在任何其他阶段之前运行此检查。如果失败，请立即停止。**

### 第 1 步：检查 mcp-setup 标记检查`~/.claude/spec-first/host-setup.json`是否存在**和**`setup_success == true`。

- **文件不存在，或存在但 `setup_success != true`** → 状态: `NOT_SETUP`

  输出给用户：
  ```
  ⛔ spec-bootstrap 无法继续：宿主尚未完成 MCP 工具安装。

  原因：未检测到 ~/.claude/spec-first/host-setup.json（或 setup_success 不为 true），
        说明 /spec:mcp-setup 尚未在本机成功执行。

  操作：请先运行 /spec:mcp-setup 并等待完成。

  完成后：重启 Claude Code，然后重新运行 /spec:bootstrap。
  ```

  Stop. Do not proceed to Step 2 or any Phase.

- **文件存在且 `setup_success == true`** → Continue to Step 2.

### Step 2: Check MCP runtime availability

Attempt a lightweight, side-effect-free MCP tool call to confirm Claude Code has loaded
the current MCP configuration.

Preferred probe: `context7 解析库-id` with any query string.
Fallback probe: `serena get_current_config`.

- **Probe fails or returns an error** → State: `SETUP_DONE_NOT_RESTARTED`

  Output to user:
  ```
  ⛔ spec-bootstrap 无法继续：MCP 工具尚不可调用。

  原因：~/.claude/spec-first/host-setup.json 存在（mcp-setup 已完成），
        但 MCP 工具当前不可调用，通常说明 Claude Code 尚未重启以加载新配置。

  操作：请重启 Claude Code。

  完成后：重新运行 /spec:bootstrap。

  如果重启后仍看到此提示，请运行 `claude mcp列表` 确认 MCP 服务已注册，
  或重新运行 /spec:mcp-setup。
  ```

  Stop. Do not proceed to Phase 1.

- **Probe succeeds** → State: `READY`. Continue to `##分析模式`。

  注意：
  - 该探针只证明 Claude Code 已加载当前配置中的**至少一个** MCP server。
  - 这**不代表** Serena / GitNexus / ABCoder 已在当前会话中挂载。
  - 工具级可用性要到 Phase 1.3 再单独判断；若 `host-setup.json` 中某工具 `configured=true`，
    但首次项目级调用就报告不可用，应记录 `reason=<tool>-not-mounted-in-session`。

**注意事项：**
- 爆发输出必须包含三个要素：原因 / 操作 / 完成后续下一步
- 两类爆发均未进入第一阶段，不执行任何项目分析逻辑
- MCP探针超时：若工具调用失败或返回错误（包括Claude Code内置超时机制触发的超时），一律视为探针失败，判定SETUP_DONE_NOT_RESTARTED状态
- `context7` 成功只代表 baseline MCP runtime 已加载，不代表 Serena / GitNexus / ABCoder 已挂载

---

## 分析模式

模式是在阶段 1.3 中运行项目工具就绪探测后确定的。|模式|状况 |能力|
|------|------------|------------|
| **完整** | `gitnexus.ready AND abcoder.ready` |架构级+符号级分析|
| **增强** | `serena.ready OR abcoder.ready` |语义分析；使用ABCoder是否也准备好了|
| **基本** |所有探测均失败 |通过 Read/Grep/Glob 进行文本级分析 |

注意：模式是在探测完成后选择的。 `ready` 表示探测成功
当前项目，而不仅仅是安装或配置工具。

基本模式：仅使用 Read/Grep/Glob。没有 MCP 工具。分析深度有限——
输出将缺少跨文件调用链、历史语义和完整类型图。
用户将被告知该模式及其限制。

报告格式：`> [Bootstrap] Analysis mode: <mode> | DB access: <db-mode>`

DB 访问模式：`MCP MySQL` / `CLI mysql` / `ORM inference [unverified]` / `not detected`

---

## 第 1 阶段：分析目标存储库

**目标：** 建立足够的架构理解，为每个上下文域编写高质量的 PRD。检测数据库配置。确定`context-slug`。

### 1.1 建立上下文 Slug

应用段优先级规则 (R12-R13)：1. **用户显式：** 如果参数匹配 `[a-z0-9-]+` （无路径分隔符），则视为 slug → 立即继续
2. **重用验证：** 扫描 `<target-project-root>/docs/contexts/*/README.md` 查找 `<!-- spec-bootstrap -->` 标记（搜索范围：仅目标项目根目录，而不是规范优先的存储库）
   - 0 场比赛 → 跳至规则 3
   - 1 个匹配 → 重用该 slug（路径的 `*` 组件），继续而不提示
   - 2+ 场比赛 → 自动选择最近修改的一场，注意执行摘要中的决定
3. **目录名称：**源自目标项目根目录名称→转换为短横线→不提示继续

**非阻塞策略：** 绝不阻塞 slug 确认。请注意执行摘要顶部的派生 slug，以便用户可以看到所选择的内容。

### 1.2 重新运行备份 (R20)

如果 `docs/contexts/<slug>/` 已经存在：
- 在第 3 阶段写入之前备份到 `.context/spec-first/bootstrap/<slug>/backup_<ISO-timestamp>/`
- **验证备份**：对备份中的文件进行计数 - 如果计数与原始文件不匹配，则错误中止；不要进入第 3 阶段
- 完全成功：删除备份目录
- 部分失败时：应用阶段 3.4 中的策略（摘要上下文失败 → 完全恢复；其他失败 → 保留部分）
- 永远不要默默地留下部分覆盖的状态

### 1.3 存储库分析

从分析中排除 `docs/contexts/`（它包含以前的引导输出，而不是项目源）。

**项目工具准备就绪（并行运行，一切就绪——失败时不取消）：**

同时运行所有三个探针。独立收集每个结果。**塞雷娜探测器：**
1. 调用`serena get_current_config`检查MCP可用性
   - 若工具在当前会话中不可用 / 未挂载 → `serena.ready=false`、`reason=serena-not-mounted-in-session`
2. 如果没有活动项目：使用当前工作目录调用 `serena activate_project`
3.激活后：验证返回的活动项目路径是否匹配`$CWD`
   - 不匹配 → `serena.ready=false`、`reason=serena-wrong-project-activated`
4. 如果路径匹配：调用`serena get_symbols_overview`作为轻量级探针
- 成功 → `serena.ready=true`
- 失败 → `serena.ready=false`，记录原因（`serena-activate-failed` / `serena-probe-failed`）

**GitNexus 探针：**
1. 检查 MCP 可用性
   - 若工具在当前会话中不可用 / 未挂载 → `gitnexus.ready=false`、`reason=gitnexus-not-mounted-in-session`
2. 查询当前存储库（例如，具有最小参数的 `search_commits` 或 `get_file_history`
   - 返回结果 → `gitnexus.ready=true`
   - 空结果（存储库未索引）→ `gitnexus.ready=false`，`reason=repo-not-indexed`
   - MCP 异常/服务无法访问 → `gitnexus.ready=false`, `reason=gitnexus-mcp-error`
- 不触发索引。不要等待。立即降级。

**ABCoder 探测（4 个步骤）：**

第 1 步：`list_repos()` — 始终放在第一位，切勿从目录名称猜测 repo_name
  - MCP 工具在当前会话中不可用 / 未挂载 → `abcoder.ready=false`、`reason=abcoder-not-mounted-in-session`
  - 找到仓库 → 跳到步骤 4

步骤 2（如果 list_repos 为空）：Java 项目的语言预检
  - `java -version` 可以访问吗？
  - `JAVA_HOME`可以解决吗？
  - JDT缓存目录可写吗？
  - （可选）JDT下载源网络是否可达？
  - 任何失败 → `abcoder.ready=false`，记录原因（例如，`java-runtime-missing`、`jdt-cache-not-writable`、`jdt-network-unreachable`）

第3步：触发解析，等待≤60s（外部定时器-记录开始时间，检查每次轮询的经过时间）3a. **检测主要语言**（扫描文件扩展名）：
  - `.go` → `go`、`.py` → `python`、`.ts/.tsx/.js/.jsx` → `typescript`/`javascript`、`.java` → `java`
  - 选择源文件最多的语言
  - 如果 ABCoder 不支持语言（例如 Ruby、Rust、C++）→ `abcoder.ready=false`、`reason=language-not-supported`

  3b.运行：`abcoder parse <language> <project-root>`（无 `-o` 标志 — ABCoder MCP 服务器从其内部存储读取）
  - 超时 → `abcoder.ready=false`, `reason=parse-timeout`;注意：Java JDT冷启动可能会超过60s，请通知用户重试
  - 解析失败 → `abcoder.ready=false`, `reason=parse-failed`

第 4 步：验证
  - 再次 `list_repos()` — 确认仓库可见
  - 验证返回的存储库根路径与 `$CWD` 匹配（以避免错误存储库误报）
  - `get_repo_structure` 与检索到的 repo_name
  - 全部通过 → `abcoder.ready=true`
  - 任何失败 → `abcoder.ready=false`、`reason=repo-not-visible-in-abcoder` 或 `reason=abcoder-wrong-repo`

**模式选择（所有探测完成后）：**
```
if gitnexus.ready AND abcoder.ready  → Full
elif serena.ready OR abcoder.ready   → Enhanced  (ABCoder used if also ready)
else                                 → Basic
```
**向用户报告：**
```
🔍 检测项目工具就绪状态...

Serena:   ready=yes, project=<path>
GitNexus: ready=no,  reason=repo-not-indexed
ABCoder:  ready=yes

📊 分析模式: Enhanced  (ABCoder 可用)
```

部分 MCP 挂载失败场景示例：
```
Serena:   ready=no,  reason=serena-not-mounted-in-session
          (host-setup.json 显示 serena.configured=true，但当前 Claude 会话未挂载 Serena；
           请先运行 `claude mcp list` 检查，再重启 Claude Code 或重新运行 /spec:mcp-setup)
GitNexus: ready=no,  reason=gitnexus-not-mounted-in-session
ABCoder:  ready=yes

📊 分析模式: Enhanced  (ABCoder 可用；Serena/GitNexus 未挂载)
```
然后使用所选模式的工具集继续进行分析。

**完整模式（GitNexus + ABCoder）：**
```
1. npx gitnexus analyze  → module clusters, execution flows, dependency graph
2. abcoder parse         → AST structure, symbol signatures, cross-file references
3. Synthesize: package boundaries, data flows, error propagation patterns
```
**增强模式（Serena MCP）：**
```
1. mcp__serena__get_symbols_overview  → top-level symbol structure per file
2. mcp__serena__find_symbol           → locate key classes, services, routes
3. mcp__serena__search_for_pattern   → find patterns (API routes, ORM models, config)
4. Synthesize: module map, key entry points, layer boundaries
```
**基本模式（读取/Grep/Glob）：**
```
1. Glob directory structure → identify layers, frameworks, languages
2. Grep for framework markers (package.json, go.mod, requirements.txt, pom.xml)
3. Read entry-point files → understand initialization, routing, main modules
4. Synthesize: top-level structure, language/framework stack
```
**无论模式如何，最低质量保证：**
- `00-summary.md` 必须确定：主要语言、主要框架、顶级模块结构
- `architecture/module-map.md` 必须包括：具有一行用途描述的顶级目录

### 1.4 层检测（R9-R10）

使用机械证据检测存在哪些层：

|层 |检测标准|
|--------|--------------------|
| **前端** | package.json 依赖项中的 React/Vue/Angular/Svelte/SolidJS/HTMX |
| **后端** | API路由定义或服务器端框架（Express、Django、Rails、Spring等）|
| **移动** | `android/`、`ios/`、`flutter/` 目录或 React Native deps |
| **桌面** | Electron/Tauri 依赖项，`.xcodeproj`、`.csproj` 与 UseWPF/UseWindowsForms |
| **cli** | package.json 中的 `bin` 字段、`go main + flag`、`click`/`argparse` 入口点、`clap` |
| **共享** |显式跨层共享代码目录 |
| **数据** |数据库架构文件、ETL 配置、数据管道定义 |

仅在以下情况下生成 `guides/index.md`：检测到 ≥3 个活动层并且至少 2 个层具有显式跨层依赖性（导入路径、API 消耗、共享模块使用）。

### 1.5 数据库配置检测（R21）

扫描目标项目的 MySQL 连接配置。检测优先级：

1. 用户显式参数（`db_url=...`）
2. `.spec-first/meta/config.yaml` → `databases.list`
3. 环境变量：`.env`、`.env.local` — 查找 `DATABASE_URL`、`DB_HOST`、`MYSQL_*`、`{NAME}_DATABASE_URL`
4. ORM配置：`prisma/schema.prisma` (provider=mysql), `drizzle.config.*`, `typeorm.config.*`, `config/database.yml` (Rails)
5. 框架配置：`application.yml`、`settings.py`、`appsettings.json`**MVP：** 仅主动处理 MySQL。 PostgreSQL/SQLite/MongoDB/Oracle/MSSQL 条目会被标注但会被跳过。

**协议识别：**
- `mysql://` / `mysql2://` → MySQL ✓
- 其他协议 → 已注明，在 MVP 中跳过

**CLI 验证（MySQL）：**
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS --connect-timeout=10 -e "SELECT 1;" 2>/dev/null
```
**数据库访问模式报告：**

**MCP 验证：** 不要假设 MCP 服务器可用性等于数据库连接。使用 `SELECT 1` 调用 `mcp__mysql-mcp-server__execute_query` — 成功响应确认实际的 DB 连接。正在运行的 MCP 服务器进程可能仍无法访问数据库。

**MCP一致性校验(R21.1):** MCP服务器在启动时绑定了固定的连接参数（主机/端口/数据库），与目标项目实际配置可能不同。否则后续必须MCP连接的数据库是否与项目配置一致：

1. 通过 MCP 执行 `SELECT DATABASE()` 获取 MCP 实际连接的数据库名
2.与项目配置中解析出的`DB_NAME`比对
3. 校验结果：
   - **匹配** → 使用 MCP (Level 1)，标记 `[MCP 已验证 ✓]`
   - **不匹配** → 降级到CLI (Level 2)，标记`[MCP 数据库不匹配，降级 CLI]`，PRD中关联MCP实际连接的数据库名
   - **无法比对**（项目配置缺少 db_name）→ 降级到 CLI (Level 2)，标记 `[项目配置不完整，降级 CLI]`

|状态 |标记|数据库访问级别|意义|
|--------|--------|----------------|---------|
| MCP 担心 + DATABASE() 校验通过 | `[MCP 已验证 ✓]` | 1 级：MCP |使用`mcp__mysql-mcp-server__*`|
| MCP 形状 + DATABASE() 不匹配，CLI `SELECT 1` 成功 | `[MCP 数据库不匹配，降级 CLI]` |级别 2：CLI |在项目配置中使用 bash `mysql` |
| MCP + 项目配置缺少 db_name，CLI `SELECT 1` 成功 | `[项目配置不完整，降级 CLI]` |级别 2：CLI |在项目配置中使用 bash `mysql` |
| MCP 不可用，CLI `SELECT 1` 成功 | `[CLI 已验证 ✓]` |级别 2：CLI |使用 bash mysql CLI |
| CLI 可用但连接失败 | `[未验证]` |第 3 级：ORM 推理 |回退到 ORM 推理 |
| CLI 未安装 | `[CLI不可用]` |第 3 级：ORM 推理 |回退到 ORM 推理 |
|连接超时 | `[连接超时]` |第 3 级：ORM 推理 |回退到 ORM 推理 |

**项目配置解析：** 编排器在 Phase 1.5 中必须从项目配置提取以下信息（非密码），读取 PRD Context 供工作人员使用：
- `project_db_host`: 从项目配置解析的数据库主机名
- `project_db_port`: 端口（默认 3306）
- `project_db_name`: 数据库名
- `project_db_user_env`：用户名环境变量名（如`$DB_USER`）
- `project_db_pass_env`:密码环境指标名（如`$DB_PASS`）—仅记录指标名，不记录值**仅**当状态为 `[MCP 已验证 ✓]` / `[CLI 已验证 ✓]` / `[MCP 数据库不匹配，降级 CLI]` / `[项目配置不完整，降级 CLI]` 且数据库为 MySQL 时才在第 2 阶段触发 `database-context` 任务。

---

## 第二阶段：创建 PRD 任务合约

**目标：** 每个上下文域写入一个 PRD 文件。每个 PRD 都是一个工作子代理的完整指令。

控制平面位置：`.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md`

### 2.1 固定任务（始终创建）

|任务 ID |生产 |
|---------|---------|
| `summary-context` | `docs/contexts/<slug>/00-summary.md` |
| `architecture-context` | `docs/contexts/<slug>/architecture/system-overview.md`、`module-map.md`、`integration-boundaries.md` |
| `pitfalls-context` | `docs/contexts/<slug>/pitfalls/index.md` |

### 2.2 条件层任务

为阶段 1.4 中检测到的每个层创建一个任务：

|任务 ID |生产 |
|---------|---------|
| `frontend-context` | `docs/contexts/<slug>/layers/frontend/index.md` |
| `backend-context` | `docs/contexts/<slug>/layers/backend/index.md` |
| `mobile-context` | `docs/contexts/<slug>/layers/mobile/index.md` |
| `desktop-context` | `docs/contexts/<slug>/layers/desktop/index.md` |
| `cli-context` | `docs/contexts/<slug>/layers/cli/index.md` |
| `shared-context` | `docs/contexts/<slug>/layers/shared/index.md` |
| `data-context` | `docs/contexts/<slug>/layers/data/index.md` |
| `guides-context` | `docs/contexts/<slug>/guides/index.md` |

### 2.3 数据库任务（有条件 — R21-R23）

**仅**当阶段 1.5 检测到 MySQL `[已验证 ✓]` 时创建 `database-context` 任务。PRD 必须包括：
- 数据库主机/端口/名称源（仅环境变量名称 - **绝不是实际密码或连接字符串**）
- 备份表过滤规则（R23 启发式 — 请参阅database-prd-template.md）
- ER 文档格式要求（Mermaid erDiagram + 表格 — 请参阅database-prd-template.md）
- DB退化级别：1级（MCP）/2级（CLI）/3级（ORM推理）

生产：
- 单一数据库 → `docs/contexts/<slug>/database/database-er.md`
- 多个数据库 → `docs/contexts/<slug>/database/database-index.md` + `database-{name}.md`

使用 `references/database-prd-template.md` 作为此 PRD 的模板。

### 2.4 PRD 内容

使用 `references/prd-template.md` 作为所有非数据库任务的基本模板。每个 PRD 必须包括：

- `Goal` — 该工人必须生产什么
- `Context` — 第一阶段分析的架构背景（将相关结果直接粘贴到 PRD 中）
- `Tools Available` — 列出此会话模式的可用工具（完整/增强/基本）
- `Files to Fill` — 该工作人员拥有的确切文件路径
- `Important Rules` — 文件所有权、无源代码更改、无 git 命令、格式要求
- `Acceptance Criteria` — 具体检查（无占位符文本，存在结构化部分）
- `Technical Notes` — 特定于项目的模式、框架怪癖、命名约定

### 2.5 珠三角质量门

在第 3 阶段开始之前，在每个 PRD 上运行轻量级质量门：

- `Goal` 是具体的并且与当前任务明确相关，而不是通用的引导程序散文
- `Context` 包括第一阶段的具体证据，例如真实路径、类名、函数名或配置键
- `Files to Fill` 列出确切的文件路径，而不是抽象类别或文件夹名称
- `Technical Notes` 包括至少一个特定于项目的约束或模式

如果任何检查失败：1. 用更多第一阶段证据丰富 PRD `Context`
2. 重新运行质量门
3. 不要引入人工批准作为阻碍步骤
4. 只有在 PRD 足够具体后才能进入第 3 阶段

---

## 第 3 阶段：执行 Worker 子代理

**目标：** 并行生成所有上下文文档。所有工作人员完成后，依次组装 README.md。

### 3.1 文件所有权规则 (R15-R16)

每个工作人员都独占其分配的文件。任何工人都不能在其所有权范围之外进行写入。

|工人|独家拥有|
|--------|-----------------|
| `summary-context` | `docs/contexts/<slug>/00-summary.md` |
| `architecture-context` | `docs/contexts/<slug>/architecture/*.md` |
| `pitfalls-context` | `docs/contexts/<slug>/pitfalls/index.md` |
| `<layer>-context` | `docs/contexts/<slug>/layers/<layer>/index.md` |
| `guides-context` | `docs/contexts/<slug>/guides/index.md` |
| `database-context` *（条件：仅限后端 + MySQL `[已验证 ✓]`）* | `docs/contexts/<slug>/database/database-er.md` （或数据库-index.md + 数据库-{name}.md）|
| **仅限编曲家** | `docs/contexts/<slug>/README.md` |

### 3.2 工人派遣合同

对于每项任务，使用以下最低合同启动一个工作子代理：
```text
task_id: <task-id>
prd_path: .context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md
ownership_boundary: only the files listed in Files to Fill
execution_guardrails: do not modify source code; do not run git commands
completion_report: produced files + any missing evidence or blocked assumptions
```
发货规则：
- 没有共享文件的worker可以并行运行
- 如果worker运行时间超过20分钟，则将其视为失败并应用部分失败策略
- 不要使用特定于主机的 API 调用来扩展合约；保持切换平台不可知

### 3.3 数据库工作人员说明 (R21-R23)

数据库工作人员必须：

1. **使用适当的级别连接**：
   - 1 级 (MCP)：`mcp__mysql-mcp-server__execute_query`、`mcp__mysql-mcp-server__list_tables`、`mcp__mysql-mcp-server__describe_table`
   - 2 级 (CLI)：`mysql -h $DB_HOST -u $DB_USER -p...`
   - 第 3 级（ORM 推理）：读取 ORM 模型文件，推断架构，标记所有内容 `[未验证]`

2. **发现表**：`SHOW TABLES` 或 MCP 等效项

3. **应用备份表过滤器 (R23)** — 排除与以下任意一项匹配的表：
   - 后缀模式：`_bak`、`_backup`、`_old`、`_copy`、`_tmp`、`_temp`、`_deprecated`、`_archive`
   - 前缀模式：`bak_`、`backup_`、`tmp_`、`temp_`
   - 名称中的日期模式：`_20YYMMDD`、`_YYYY_MM`、`_YYYYMM`
   - 启发式陈旧：最后更新 > 180 天前，并且没有对其他表的 FK 引用

   在 ER 文档中列出所有排除的表并附上原因（透明报告）。

4. **分析架构**：对于每个非排除表：
   - `SHOW CREATE TABLE <table>` 或 `DESCRIBE <table>`
   - 识别外键
   - 推断实体类型（主数据/事务/关系/配置/审计/服务器）

5. **根据 `references/database-prd-template.md` 生成 ER 文档**：
   - Mermaid `erDiagram`（仅表名称+关系，无字段详细信息）
   - 核心关系表
   - 实体类型列表
   - 数据流程图（美人鱼流程图）
   - 表清单（名称+一行用途）
   - 可选索引摘要（仅限 UNIQUE 和关键查询索引）
   - 目标：< 200 行，< 10 KB6. **凭据保护**：切勿将密码、完整连接字符串或长期令牌写入任何输出文件。仅引用环境变量名称（例如，`$DB_HOST`）。清理日志：用 `***` 替换密码值。

### 3.4 组装

所有工人报告完成后：

1. 收集每个worker生成的文件列表
2. 写入 `docs/contexts/<slug>/README.md`（仅限协调器）：
   ```markdown
   <!-- spec-bootstrap -->
   # <Project Name> Context

   Generated: <ISO date> | spec-first bootstrap

   > ⚠️ This document reflects the repository state at generation time.
   > It is not automatically synchronized with subsequent code changes.

   ## Contents

   - [Summary](00-summary.md) — project overview and tech stack
   - [Architecture](architecture/) — system structure, module map, integration boundaries
   - [Pitfalls](pitfalls/index.md) — known high-risk areas
   [conditional layers and database entries here]
   ```
3. Delete backup (`.context/spec-first/bootstrap/<slug>/backup_<ISO-timestamp>/`) on full success
4. **Partial failure policy:**
   - `summary-context` fails → **full restore**: replace `docs/contexts/<slug>/` 带备份，报告错误，停止
   - 任何其他工作人员失败 → **保留部分**：保留成功的输出，编写部分 README.md 记录缺少哪些域，报告失败的任务并说明原因
   - 所有工作人员失败 → 完全恢复（与摘要上下文失败相同）

### 3.5 执行总结

向用户报告：
```
Bootstrap complete for: <slug>

✓ Produced:
  docs/contexts/<slug>/README.md
  docs/contexts/<slug>/00-summary.md
  docs/contexts/<slug>/architecture/ (3 files)
  docs/contexts/<slug>/pitfalls/index.md
  [conditional files...]

✗ Failed:
  [task-id]: <reason>

Analysis mode: <mode>
DB access: <mode>
```
> **提交之前：** `docs/contexts/<slug>/` 被设计为持久的 VCS 资产。在第一个 `git add` 之前检查其内容 - 如果它包含敏感的架构细节，请在提交之前有选择地排除或编辑。

---

## 完成清单

- [ ] `docs/contexts/<slug>/README.md` 包含引导生成标记 (`<!-- spec-bootstrap -->`)
- [ ] 生成的所有固定任务文件且非空
- [ ] `00-summary.md` 标识主要语言、框架、顶层结构
- [ ] `architecture/module-map.md` 包括带有描述的顶级目录
- [ ] 仅在找到证据时才生成条件文件
- [ ] `database-er.md`（如果生成）：无密码，< 200 行，存在 Mermaid erDiagram
- [ ] 成功时删除备份，或采取恢复操作报告失败
- [ ] 用户在启动时获悉分析模式和数据库访问模式
- [ ] 当上下文不明确时与用户确认

---

## 上下文文件不固定

工作人员必须根据实际项目调整文件内容，而不是填写占位符文本。如果计划的文件对于该项目没有任何有意义的内容，工作人员应该跳过它并记下原因。如果项目有模板未涵盖的模式，工作人员应添加它们。

`index.md` 文件（图层、参考线、陷阱）必须反映实际生成的文件集。

---

## 参考文献

- `references/prd-template.md` — PRD任务合同模板（目标/上下文/工具/文件/规则/接受/注释）
- `references/database-prd-template.md` — 具有 ER 格式和凭证保护规则的数据库上下文 PRD 模板
