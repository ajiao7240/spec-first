---
name: spec-bootstrap
description: "Stage-0 supporting workflow: analyze a target project and generate long-lived project context assets under docs/contexts/<slug>/. Run this before brainstorm/plan/work/review to give those workflows a durable context foundation."
---

# Spec-First Bootstrap

Bootstrap a durable project context for a target repository. This is a **Stage-0 supporting workflow** — it runs once (or on demand) to generate context assets that subsequent spec-first workflows can consume.

**Claude entry point:** `/spec:bootstrap [target-repo-path-or-slug]`
**Codex entry point:** `/spec:bootstrap [target-repo-path-or-slug]`
If you invoke the skill directly inside a Codex session, `$spec-bootstrap [target-repo-path-or-slug]` still works.

## Why This Exists

spec-first's five-stage workflow (brainstorm → plan → work → review → compound) works best when it can draw on stable project-level context: architecture, module boundaries, known pitfalls, and data relationships. Without this foundation, each workflow session starts cold, leading to inconsistent analysis and repeated inference work.

`spec-bootstrap` solves this by producing a reusable context library at `docs/contexts/<slug>/`. It is not a sixth stage of the main workflow — it is a prerequisite asset generator you run when onboarding a new project or refreshing context after significant changes.

**Current version scope:** generate context assets only. Automatic injection into the five-stage workflow is a future capability.

---

## Prerequisites

Before running bootstrap:

1. You are running inside or pointed at the **target project** (not the spec-first framework repo itself)
2. Claude Code or Codex has read access to the target project's source tree
3. (Optional) MySQL CLI (`mysql`) or MCP MySQL server available for database ER generation
4. (Optional) Serena MCP (`mcp__serena__*`) for enhanced code analysis

### MCP Tools Setup

To enable Enhanced analysis mode, install the baseline MCP tools:

```bash
/spec:mcp-setup quick
```

This installs:
- **Serena** (for Enhanced mode)
- Sequential Thinking and Context7 (universal dependencies)

⚠️ **Restart the active host** after installation for changes to take effect.

Verify installation:
```bash
<host> mcp list | grep -E "serena|context7|sequential-thinking"
```

**Recommended `.gitignore` entry** (add to target project):
```
.spec-first/
```
The `.spec-first/` control plane contains PRD task contracts and temporary bootstrap state — it should not be committed to version control.

### Tool Usage Guide

#### Serena (Enhanced Mode)

Semantic code analysis: symbol lookup, structure overview, pattern search.

| Tool | Purpose | Example |
|------|---------|---------|
| `mcp__serena__get_symbols_overview` | File structure | `mcp__serena__get_symbols_overview({relative_path: "src/auth.ts"})` |
| `mcp__serena__find_symbol` | Locate symbol | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` | Pattern search | `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |
| `mcp__serena__find_referencing_symbols` | Find references | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

**Workflow**: get_symbols_overview (structure) → find_symbol (locate) → find_referencing_symbols (callers) → Read source (details)

---

## Host Readiness Gate

**Run this check before any other phase. If it fails, stop immediately.**

### Step 0: Determine the active host

Use the same host selection rules as `mcp-setup` to choose the current runtime host:

- Claude Code → `~/.claude/spec-first/host-setup.json`
- Codex → `~/.codex/spec-first/host-setup.json`

Also use the matching host CLI for runtime checks:
- Active host CLI → `claude mcp list` or `codex mcp list`, depending on the detected host

### Step 1: Check mcp-setup marker

Check whether the current host's `spec-first/host-setup.json` exists **and** `setup_success == true`.

- **文件不存在，或存在但 `setup_success != true`** → State: `NOT_SETUP`

  Output to user:
  ```
  ⛔ spec-bootstrap 无法继续：宿主尚未完成 MCP 工具安装。

  原因：未检测到当前宿主的 spec-first/host-setup.json（或 setup_success 不为 true），
        说明 /spec:mcp-setup 尚未在本机成功执行。

  操作：请先运行 /spec:mcp-setup 并等待完成。

  完成后：重启当前宿主，然后重新运行 /spec:bootstrap。
  ```

  Stop. Do not proceed to Step 2 or any Phase.

- **文件存在且 `setup_success == true`** → Continue to Step 2.

### Step 2: Check MCP runtime availability

Attempt a lightweight, side-effect-free MCP tool call to confirm the active host has loaded
the current MCP configuration.

Preferred probe: `context7 resolve-library-id` with any query string.
Fallback probe: `serena get_current_config`.

- **Probe fails or returns an error** → State: `SETUP_DONE_NOT_RESTARTED`

  Output to user:
  ```
  ⛔ spec-bootstrap 无法继续：MCP 工具尚不可调用。

  原因：当前宿主的 spec-first/host-setup.json 存在（mcp-setup 已完成），
        但 MCP 工具当前不可调用，通常说明宿主尚未重启以加载新配置。

  操作：请重启当前宿主。

  完成后：重新运行 /spec:bootstrap。

  如果重启后仍看到此提示，请运行当前宿主对应的 `mcp list` 确认 MCP 服务已注册，
  或重新运行 /spec:mcp-setup。
  ```

  Stop. Do not proceed to Phase 1.

- **Probe succeeds** → State: `READY`. Continue to Step 2b.

  Note:
  - This probe only proves the active host has loaded **at least one** MCP server from the current config.
  - It does **not** prove Serena is mounted in the current session.
  - Tool-specific availability is determined in Phase 1.3. If `host-setup.json` says a tool is `configured=true`
    but the first project-level call says the tool is unavailable, record `reason=<tool>-not-mounted-in-session`.

Continue to `## Analysis Mode`.

**注意事项：**
- 阻断输出必须包含三要素：原因 / 操作 / 完成后下一步
- 两类阻断均不进入 Phase 1，不执行任何项目分析逻辑
- MCP probe 超时：若 tool call 失败或返回错误（包括宿主内置超时机制触发的超时），一律视为探针失败，判定 SETUP_DONE_NOT_RESTARTED 状态
- `context7` 成功只代表 baseline MCP runtime 已加载，不代表 Serena 已挂载

---

## Analysis Mode

Mode is determined after running Project Tool Readiness probes in Phase 1.3.

| Mode | Condition | Capability |
|------|-----------|------------|
| **Enhanced** | `serena.ready` | Semantic analysis via Serena |
| **Basic** | All probes failed | Text-level analysis via Read/Grep/Glob |

Note: Mode is selected after probes complete. `ready` means the probe succeeded for the
current project, not merely that the tool is installed or configured.

Basic mode: uses only Read/Grep/Glob. No MCP tools. Analysis depth is limited —
output will lack cross-file call chains, history semantics, and full type graphs.
User will be informed of the mode and its limitations.

Report format: `> [Bootstrap] Analysis mode: <mode> | DB access: <db-mode>`

DB access modes: `MCP MySQL` / `CLI mysql` / `ORM inference [unverified]` / `not detected`

---

## Phase 1: Analyze the Target Repository

**Goal:** Build sufficient architectural understanding to write high-quality PRDs for each context domain. Detect database configuration. Determine `context-slug`.

### 1.1 Establish Context Slug

Apply slug priority rules (R12-R13):

1. **User explicit:** if argument matches `[a-z0-9-]+` (no path separators), treat as slug → proceed immediately
2. **Reuse verified:** scan `<target-project-root>/docs/contexts/*/README.md` for `<!-- spec-bootstrap -->` marker (search scope: target project root only, not spec-first repo)
   - 0 matches → skip to Rule 3
   - 1 match → reuse that slug (the `*` component of the path), proceed without prompting
   - 2+ matches → auto-select the most recently modified one, note the decision in execution summary
3. **Directory name:** derive from target project root directory name → convert to kebab-case → proceed without prompting

**Non-blocking policy:** Never block for slug confirmation. Note the derived slug at the top of the execution summary so the user can see what was chosen.

### 1.2 Rerun Backup (R20)

If `docs/contexts/<slug>/` already exists:
- Back up to `.spec-first/workflows/bootstrap/<slug>/backup_<ISO-timestamp>/` before Phase 3 writes
- **Validate backup**: count files in backup — if count doesn't match original, abort with error; do not proceed to Phase 3
- On full success: delete backup directory
- On partial failure: apply the policy in Phase 3.4 (summary-context failure → full restore; other failures → preserve partial)
- Never silently leave a partially overwritten state

### 1.3 Repository Analysis

Exclude `docs/contexts/` from analysis (it contains previous bootstrap output, not project source).

**Project Tool Readiness (run in parallel, all-settled — do not cancel on failure):**

Run the Serena probe. Collect the result independently.

**Serena probe:**
1. Call `serena get_current_config` to check MCP availability
   - If the tool is unavailable / not mounted in the session → `serena.ready=false`, `reason=serena-not-mounted-in-session`
2. If no active project: call `serena activate_project` with current working directory
3. After activate: verify the returned active project path matches `$CWD`
   - Mismatch → `serena.ready=false`, `reason=serena-wrong-project-activated`
4. If path matches: call `serena get_symbols_overview` as lightweight probe
- Success → `serena.ready=true`
- Failure → `serena.ready=false`, record reason (`serena-activate-failed` / `serena-probe-failed`)

**Mode selection (after probe completes):**

```
if serena.ready  → Enhanced
else             → Basic
```

**Report to user:**
```
🔍 检测项目工具就绪状态...

Serena:   ready=yes, project=<path>

📊 分析模式: Enhanced
```

Partial MCP mount 场景示例：
```
Serena:   ready=no,  reason=serena-not-mounted-in-session
          (host-setup.json 显示 serena.configured=true，但当前宿主会话未挂载 Serena；
           请先运行当前宿主对应的 `mcp list` 检查，再重启宿主或重新运行 /spec:mcp-setup)

📊 分析模式: Basic
```

Then proceed with analysis using the selected mode's tool set.

**Enhanced mode (Serena MCP):**
```
1. mcp__serena__get_symbols_overview  → top-level symbol structure per file
2. mcp__serena__find_symbol           → locate key classes, services, routes
3. mcp__serena__search_for_pattern   → find patterns (API routes, ORM models, config)
4. Synthesize: module map, key entry points, layer boundaries
```

**Basic mode (Read/Grep/Glob):**
```
1. Glob directory structure → identify layers, frameworks, languages
2. Grep for framework markers (package.json, go.mod, requirements.txt, pom.xml)
3. Read entry-point files → understand initialization, routing, main modules
4. Synthesize: top-level structure, language/framework stack
```

**Minimum quality guarantees regardless of mode:**
- `00-summary.md` must identify: primary language, primary framework(s), top-level module structure
- `architecture/module-map.md` must include: top-level directories with one-line purpose descriptions

### 1.4 Layer Detection (R9-R10)

Detect which layers are present using mechanical evidence:

| Layer | Detection criteria |
|-------|--------------------|
| **frontend** | React/Vue/Angular/Svelte/SolidJS/HTMX in package.json dependencies |
| **backend** | API route definitions or server-side framework (Express, Django, Rails, Spring, etc.) |
| **mobile** | `android/`, `ios/`, `flutter/` directories, or React Native deps |
| **desktop** | Electron/Tauri deps, `.xcodeproj`, `.csproj` with UseWPF/UseWindowsForms |
| **cli** | `bin` field in package.json, `go main + flag`, `click`/`argparse` entry_points, `clap` |
| **shared** | Explicit cross-layer shared code directory |
| **data** | Database schema files, ETL configs, data pipeline definitions |

Generate `guides/index.md` only when: ≥3 active layers detected AND at least 2 layers have explicit cross-layer dependency (import paths, API consumption, shared module usage).

### 1.5 Database Configuration Detection (R21)

Scan the target project for MySQL connection configuration. Detection priority:

1. User explicit argument (`db_url=...`)
2. `.spec-first/meta/config.yaml` → `databases.list`
3. Environment variables: `.env`, `.env.local` — look for `DATABASE_URL`, `DB_HOST`, `MYSQL_*`, `{NAME}_DATABASE_URL`
4. ORM configs: `prisma/schema.prisma` (provider=mysql), `drizzle.config.*`, `typeorm.config.*`, `config/database.yml` (Rails)
5. Framework configs: `application.yml`, `settings.py`, `appsettings.json`

**MVP:** Only MySQL is actively processed. PostgreSQL/SQLite/MongoDB/Oracle/MSSQL entries are noted but skipped.

**Protocol recognition:**
- `mysql://` / `mysql2://` → MySQL ✓
- Other protocols → noted, skipped in MVP

**CLI verification (MySQL):**
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS --connect-timeout=10 -e "SELECT 1;" 2>/dev/null
```

**DB access mode reporting:**

**MCP verification:** Do not assume MCP server availability equals DB connectivity. Call `mcp__mysql-mcp-server__execute_query` with `SELECT 1` — a successful response confirms actual DB connection. A running MCP server process may still fail to reach the database.

**MCP 一致性校验 (R21.1):** MCP 服务器在启动时绑定了固定的连接参数（host/port/database），与目标项目实际配置可能不同。连通后必须校验 MCP 连接的数据库是否与项目配置一致：

1. 通过 MCP 执行 `SELECT DATABASE()` 获取 MCP 实际连接的数据库名
2. 与项目配置中解析出的 `DB_NAME` 比对
3. 校验结果：
   - **匹配** → 使用 MCP (Level 1)，标记 `[MCP 已验证 ✓]`
   - **不匹配** → 降级到 CLI (Level 2)，标记 `[MCP 数据库不匹配，降级 CLI]`，PRD 中注明 MCP 实际连接的数据库名
   - **无法比对**（项目配置缺少 db_name）→ 降级到 CLI (Level 2)，标记 `[项目配置不完整，降级 CLI]`

| Status | Marker | DB Access Level | Meaning |
|--------|--------|----------------|---------|
| MCP 连通 + DATABASE() 校验通过 | `[MCP 已验证 ✓]` | Level 1: MCP | Use `mcp__mysql-mcp-server__*` |
| MCP 连通 + DATABASE() 不匹配，CLI `SELECT 1` 成功 | `[MCP 数据库不匹配，降级 CLI]` | Level 2: CLI | Use bash `mysql` with project config |
| MCP 连通 + 项目配置缺少 db_name，CLI `SELECT 1` 成功 | `[项目配置不完整，降级 CLI]` | Level 2: CLI | Use bash `mysql` with project config |
| MCP not available, CLI `SELECT 1` succeeds | `[CLI 已验证 ✓]` | Level 2: CLI | Use bash mysql CLI |
| CLI available but connection failed | `[未验证]` | Level 3: ORM inference | Fallback to ORM inference |
| CLI not installed | `[CLI不可用]` | Level 3: ORM inference | Fallback to ORM inference |
| Connection timed out | `[连接超时]` | Level 3: ORM inference | Fallback to ORM inference |

**项目配置解析：** 编排器在 Phase 1.5 中必须从项目配置提取以下信息（非密码），写入 PRD Context 供 worker 使用：
- `project_db_host`: 从项目配置解析的数据库主机名
- `project_db_port`: 端口（默认 3306）
- `project_db_name`: 数据库名
- `project_db_user_env`: 用户名环境变量名（如 `$DB_USER`）
- `project_db_pass_env`: 密码环境变量名（如 `$DB_PASS`）— 仅记录变量名，不记录值

Trigger `database-context` task in Phase 2 **only** when status is `[MCP 已验证 ✓]` / `[CLI 已验证 ✓]` / `[MCP 数据库不匹配，降级 CLI]` / `[项目配置不完整，降级 CLI]` and database is MySQL.

---

## Phase 2: Create PRD Task Contracts

**Goal:** Write one PRD file per context domain. Each PRD is the complete instructions for one worker subagent.

Control plane location: `.spec-first/workflows/bootstrap/<slug>/tasks/<task-id>/prd.md`

### 2.1 Fixed Tasks (always created)

| Task ID | Produces |
|---------|---------|
| `summary-context` | `docs/contexts/<slug>/00-summary.md` |
| `architecture-context` | `docs/contexts/<slug>/architecture/system-overview.md`, `module-map.md`, `integration-boundaries.md`（条件：`integration-boundaries.md` 仅在项目有明显外部集成点时创建） |
| `pitfalls-context` | `docs/contexts/<slug>/pitfalls/index.md` |

### 2.2 Conditional Layer Tasks

Create a task for each layer detected in Phase 1.4:

| Task ID | Produces |
|---------|---------|
| `frontend-context` | `docs/contexts/<slug>/layers/frontend/index.md` |
| `backend-context` | `docs/contexts/<slug>/layers/backend/index.md` |
| `mobile-context` | `docs/contexts/<slug>/layers/mobile/index.md` |
| `desktop-context` | `docs/contexts/<slug>/layers/desktop/index.md` |
| `cli-context` | `docs/contexts/<slug>/layers/cli/index.md` |
| `shared-context` | `docs/contexts/<slug>/layers/shared/index.md` |
| `data-context` | `docs/contexts/<slug>/layers/data/index.md` |
| `guides-context` | `docs/contexts/<slug>/guides/index.md` |

### 2.3 Database Task (conditional — R21-R23)

Create `database-context` task **only** when Phase 1.5 detected MySQL `[已验证 ✓]`.

PRD must include:
- Database host/port/name source (env var name only — **never the actual password or connection string**)
- Backup table filter rules (R23 heuristics — see database-prd-template.md)
- ER document format requirements (Mermaid erDiagram + tables — see database-prd-template.md)
- DB degradation level: Level 1 (MCP) / Level 2 (CLI) / Level 3 (ORM inference)

Produces:
- Single database → `docs/contexts/<slug>/database/database-er.md`
- Multiple databases → `docs/contexts/<slug>/database/database-index.md` + `database-{name}.md`

Use `references/database-prd-template.md` as the template for this PRD.

### 2.4 PRD Content

Use `references/prd-template.md` as the base template for all non-database tasks. Each PRD must include:

- `Goal` — what this worker must produce
- `Context` — architectural context from Phase 1 analysis (paste relevant findings directly into the PRD)
- `Tools Available` — list available tools for this session's mode (Full/Enhanced/Basic)
- `Files to Fill` — exact file paths this worker owns
- `Important Rules` — file ownership, no source code changes, no git commands, format requirements
- `Acceptance Criteria` — concrete checks (no placeholder text, structured sections present)
- `Technical Notes` — project-specific patterns, framework quirks, naming conventions

#### 2.4.1 Files to Fill 动态策略

编排器依据 Phase 1 分析结果，动态决定每个 worker 的 Files to Fill 列表：

- **省略条件示例：**
  - `architecture-context`：项目无明显外部集成点 → 省略 `integration-boundaries.md`（Files to Fill 只列 2 个文件）
  - `layer-context`：该层代码 < 3 个文件 → 可降级合并进 `00-summary.md`，不单独建 worker
- **原则：** Files to Fill 只列编排器有把握生成高质量内容的文件；宁可省略，不要产出空壳文档

> `pitfalls-context` 是固定任务，小项目可产出薄文档但不应省略任务本身。

#### 2.4.2 Task-specific Acceptance Criteria 注入规则

对以下任务类型，在通用 AC 之后追加特定条目：

**pitfalls-context 追加：**
- [ ] Each pitfall includes: file + line range, risk type, why risky, recommended mitigation
- [ ] At least 3 concrete examples documented with real code from the codebase

**layer-context 追加：**
- [ ] Each anti-pattern / code smell includes: file + line range, risk type, why risky, recommended mitigation
- [ ] At least 3 concrete examples documented with real code from the codebase

> **注意：** `database-context` 不经过 Phase 2.4（Phase 2.4 开头明确 "all non-database tasks"）。database 专项 AC 已在 `references/database-prd-template.md` 独立模板中覆盖。

#### 2.4.3 Technical Notes 推荐骨架

编排器填写 Technical Notes 时参考以下骨架（adapt freely）：

**summary-context：**
- Suggested structure: `## 技术栈` / `## 顶层结构` / `## 核心职责` / `## 已知限制`

**architecture-context：**
- `system-overview.md` — Suggested: `## 整体结构` / `## 关键架构决策` / `## 系统边界`
- `module-map.md` — Suggested: 每个顶层目录一行（`目录/ — 一句话职责`）
- `integration-boundaries.md` — Suggested: `## 模块间接口` / `## 外部依赖` / `## 通信协议`

**Architecture 三文件职责边界**（避免内容重叠，编排器生成三个 PRD 时参考）：

| 文件 | 写什么 | 不写什么 |
|------|--------|---------|
| `system-overview.md` | 分层策略、架构风格、关键设计决策 | 具体模块列表（→ module-map） |
| `module-map.md` | 每个顶层目录职责、所属层级 | 模块间调用关系（→ integration-boundaries） |
| `integration-boundaries.md` | 模块间接口、外部依赖、通信协议 | 模块内部实现（→ layer 文档） |

**pitfalls-context：**
- Suggested structure: `## 代码层风险` / `## 架构层风险` / `## 业务逻辑风险` / `## 历史热点`

**Pitfall Discovery Strategy**（编排器填写 pitfalls PRD 的 Technical Notes 时参考）：

*Code-level signals:*
- TODO/FIXME/HACK 密集区
- 嵌套条件 > 3 层
- 函数体 > 100 行
- 裸 try-catch / swallowed exceptions

*Architecture-level signals:*
- 循环依赖
- God class（> 500 行 / > 20 方法）
- 高扇入扇出
- 相似模块间模式不一致

*Business logic signals:*
- 权限绕过路径
- 并发竞态
- 事务边界问题
- 数据验证缺口

*Historical signals (if git available):*
- 高频改动文件
- 集中 bug-fix 区域
- Reverted commits

Output per pitfall: `location` + `risk type` + `why risky` + `recommended mitigation`

### 2.5 PRD Quality Gate

Before Phase 3 starts, run a lightweight quality gate on every PRD:

- `Goal` is specific and clearly tied to the current task, not generic bootstrap prose
- `Context` includes concrete evidence from Phase 1, such as real paths, class names, function names, or config keys
- `Files to Fill` lists exact file paths, not abstract categories or folder names
- `Technical Notes` includes at least one project-specific constraint or pattern

If any check fails:

1. Enrich the PRD `Context` with more Phase 1 evidence
2. Re-run the quality gate
3. Do not introduce human approval as a blocking step
4. Proceed to Phase 3 only after the PRD is sufficiently specific

---

## Phase 3: Execute Worker Subagents

**Goal:** Produce all context documents in parallel. Assemble README.md serially after all workers complete.

### 3.1 File Ownership Rules (R15-R16)

Each worker exclusively owns its assigned files. No worker may write outside its ownership boundary.

| Worker | Owns exclusively |
|--------|-----------------|
| `summary-context` | `docs/contexts/<slug>/00-summary.md` |
| `architecture-context` | `docs/contexts/<slug>/architecture/*.md` |
| `pitfalls-context` | `docs/contexts/<slug>/pitfalls/index.md` |
| `<layer>-context` | `docs/contexts/<slug>/layers/<layer>/index.md` |
| `guides-context` | `docs/contexts/<slug>/guides/index.md` |
| `database-context` *(conditional: backend + MySQL `[已验证 ✓]` only)* | `docs/contexts/<slug>/database/database-er.md` (or database-index.md + database-{name}.md) |
| **Orchestrator only** | `docs/contexts/<slug>/README.md` |

### 3.2 Worker Dispatch Contract

For each task, launch a worker subagent with this minimum contract:

```text
task_id: <task-id>
prd_path: .spec-first/workflows/bootstrap/<slug>/tasks/<task-id>/prd.md
ownership_boundary: only the files listed in Files to Fill
execution_guardrails: do not modify source code; do not run git commands
completion_report: produced files + any missing evidence or blocked assumptions
```

Dispatch rules:
- Workers with no shared files may run in parallel
- If a worker runs longer than 20 minutes, treat it as failed and apply the partial failure policy
- Do not expand the contract with host-specific API calls; keep the handoff platform agnostic

### 3.3 Database Worker Instructions (R21-R23)

The database worker must:

1. **Connect** using the appropriate level:
   - Level 1 (MCP): `mcp__mysql-mcp-server__execute_query`, `mcp__mysql-mcp-server__list_tables`, `mcp__mysql-mcp-server__describe_table`
   - Level 2 (CLI): `mysql -h $DB_HOST -u $DB_USER -p...`
   - Level 3 (ORM inference): read ORM model files, infer schema, mark everything `[未验证]`

2. **Discover tables**: `SHOW TABLES` or MCP equivalent

3. **Apply backup table filters (R23)** — exclude tables matching any of:
   - Suffix patterns: `_bak`, `_backup`, `_old`, `_copy`, `_tmp`, `_temp`, `_deprecated`, `_archive`
   - Prefix patterns: `bak_`, `backup_`, `tmp_`, `temp_`
   - Date patterns in name: `_20YYMMDD`, `_YYYY_MM`, `_YYYYMM`
   - Heuristic stale: last updated > 180 days ago AND no FK references to other tables

   List all excluded tables with reason in the ER document (transparent reporting).

4. **Analyze schema**: for each non-excluded table:
   - `SHOW CREATE TABLE <table>` or `DESCRIBE <table>`
   - Identify foreign keys
   - Infer entity type (主数据/事务/关系/配置/审计/缓存)

5. **Generate ER document** per `references/database-prd-template.md`:
   - Mermaid `erDiagram` (table names + relationships only, no field details)
   - Core relationships table
   - Entity type list
   - Data flow diagram (Mermaid flowchart)
   - Table inventory (name + one-line purpose)
   - Optional index summary (UNIQUE and critical query indexes only)
   - Target: < 200 lines, < 10 KB

6. **Credential protection**: never write passwords, full connection strings, or long-lived tokens to any output file. Reference env var names only (e.g., `$DB_HOST`). Sanitize logs: replace password values with `***`.

### 3.4 Assembly

After all workers report completion:

1. Collect produced file list from each worker
2. Write `docs/contexts/<slug>/README.md` (orchestrator only):
   ```markdown
   <!-- spec-bootstrap -->
   # <Project Name> Context

   Generated: <ISO date> | spec-first bootstrap

   > ⚠️ This document reflects the repository state at generation time.
   > It is not automatically synchronized with subsequent code changes.

   ## Contents

   - [Summary](00-summary.md) — project overview and tech stack
   - [Architecture](architecture/) — <list files actually produced, e.g. system overview, module map, integration boundaries>
   - [Pitfalls](pitfalls/index.md) — known high-risk areas
   [conditional layers and database entries here]
   ```
3. Delete backup (`.spec-first/workflows/bootstrap/<slug>/backup_<ISO-timestamp>/`) on full success
4. **Partial failure policy:**
   - `summary-context` fails → **full restore**: replace `docs/contexts/<slug>/` with backup, report error, stop
   - Any other worker fails → **preserve partial**: keep successful outputs, write partial README.md noting which domains are missing, report failed tasks with reason
   - All workers fail → full restore (same as summary-context failure)

### 3.5 Execution Summary

Report to user:
```
Bootstrap complete for: <slug>

✓ Produced:
  docs/contexts/<slug>/README.md
  docs/contexts/<slug>/00-summary.md
  docs/contexts/<slug>/architecture/ (N files)
  docs/contexts/<slug>/pitfalls/index.md
  [conditional files...]

✗ Failed:
  [task-id]: <reason>

Analysis mode: <mode>
DB access: <mode>
```

> **Before committing:** `docs/contexts/<slug>/` is designed as a durable VCS asset. Review its contents before the first `git add` — if it contains sensitive architectural details, selectively exclude or redact before committing.

---

## Completion Checklist

- [ ] `docs/contexts/<slug>/README.md` contains bootstrap generation marker (`<!-- spec-bootstrap -->`)
- [ ] All PRD-listed Files to Fill produced and non-empty
- [ ] `00-summary.md` identifies primary language, framework(s), top-level structure
- [ ] `architecture/module-map.md` includes top-level directories with descriptions
- [ ] Conditional files produced only when evidence was found
- [ ] `database-er.md` (if generated): no passwords, < 200 lines, Mermaid erDiagram present
- [ ] Backup deleted on success, or failure reported with recovery action taken
- [ ] User informed of analysis mode and DB access mode at start
- [ ] Context slug confirmed with user when ambiguous

---

## Context Files Are Not Fixed

Workers must adapt **section content** to the real project — not fill in placeholder text. If a planned section has no meaningful content, skip it and note why. If the project has patterns not covered by the templates, the worker should add them.

File-level decisions (which files to create or omit) are the orchestrator's responsibility in Phase 2. Workers execute the file list in their PRD as-is.

`index.md` files (layers, guides, pitfalls) must reflect the actual generated file set.

---

## References

- `references/prd-template.md` — PRD task contract template (Goal/Context/Tools/Files/Rules/Acceptance/Notes)
- `references/database-prd-template.md` — database context PRD template with ER format and credential protection rules
