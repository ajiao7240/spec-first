---
name: spec-bootstrap
description: "Stage-0 supporting workflow: analyze a target project and generate long-lived project context assets under docs/contexts/<slug>/. Run this before brainstorm/plan/work/review to give those workflows a durable context foundation."
argument-hint: "[target repo path or context slug]"
user-invocable: true
---

# Spec-First Bootstrap

Bootstrap a durable project context for a target repository. This is a **Stage-0 supporting workflow** — it runs once (or on demand) to generate context assets that subsequent spec-first workflows can consume.

**Claude entry point:** `/spec:bootstrap [target-repo-path-or-slug]`
**Codex entry point:** `$spec-bootstrap [target-repo-path-or-slug]`

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

---

## Analysis Mode Detection

At startup, detect and report the available analysis mode:

| Mode | Condition | Capability |
|------|-----------|------------|
| **Full** | GitNexus + ABCoder MCP available | Architecture-level + symbol-level analysis |
| **Enhanced** | Serena MCP available (`mcp__serena__*`) | Semantic code analysis: symbol lookup, structure overview, pattern search |
| **Basic** | Built-in tools only | Text-level analysis via Read/Grep/Glob |

Report to the user: `> [Bootstrap] Analysis mode: <mode> | DB access: <db-mode>`

DB access modes: `MCP MySQL` / `CLI mysql` / `ORM inference [unverified]` / `not detected`

---

## Phase 1: Analyze the Target Repository

**Goal:** Build sufficient architectural understanding to write high-quality PRDs for each context domain. Detect database configuration. Determine `context-slug`.

### 1.1 Establish Context Slug

Apply slug priority rules (R12-R13):

1. **User explicit:** if argument matches `[a-z0-9-]+` (no path separators), treat as slug
2. **Reuse verified:** if `docs/contexts/<candidate>/README.md` exists and contains bootstrap generation marker (`<!-- spec-bootstrap -->`) → reuse that slug
3. **Directory name:** derive from target project root directory name → convert to kebab-case

Confirm slug with user before proceeding if ambiguous.

### 1.2 Rerun Backup (R20)

If `docs/contexts/<slug>/` already exists:
- Back up to `.context/spec-first/bootstrap/<slug>/backup/` before Phase 3 writes
- On full success: delete backup
- On partial failure: restore backup or preserve partial output and report to user
- Never silently leave a partially overwritten state

### 1.3 Repository Analysis

Exclude `docs/contexts/` from analysis (it contains previous bootstrap output, not project source).

**Analysis depth by mode:**

**Full mode (GitNexus + ABCoder):**
```
1. npx gitnexus analyze  → module clusters, execution flows, dependency graph
2. abcoder parse         → AST structure, symbol signatures, cross-file references
3. Synthesize: package boundaries, data flows, error propagation patterns
```

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
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "SELECT 1;" 2>/dev/null
```

**DB access mode reporting:**

| Status | Marker | Meaning |
|--------|--------|---------|
| MCP MySQL Server available + connected | `[已验证 ✓]` | Use `mcp__mysql-mcp-server__*` |
| MCP not available, CLI connected | `[已验证 ✓]` | Use bash mysql CLI |
| CLI available but connection failed | `[未验证]` | Fallback to ORM inference |
| CLI not installed | `[CLI不可用]` | Fallback to ORM inference |
| Connection timed out | `[连接超时]` | Fallback to ORM inference |

Trigger `database-context` task in Phase 2 **only** when status is `[已验证 ✓]` and database is MySQL.

---

## Phase 2: Create PRD Task Contracts

**Goal:** Write one PRD file per context domain. Each PRD is the complete instructions for one worker subagent.

Control plane location: `.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md`

### 2.1 Fixed Tasks (always created)

| Task ID | Produces |
|---------|---------|
| `summary-context` | `docs/contexts/<slug>/00-summary.md` |
| `architecture-context` | `docs/contexts/<slug>/architecture/system-overview.md`, `module-map.md`, `integration-boundaries.md` |
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
| `database-context` | `docs/contexts/<slug>/database/database-er.md` (or database-index.md + database-{name}.md) |
| **Orchestrator only** | `docs/contexts/<slug>/README.md` |

### 3.2 Worker Dispatch

For each task, launch a worker subagent with:
- Full path to its PRD: `.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md`
- Instruction: "Read the PRD at the given path. Analyze the target project using available tools. Write only the files listed in 'Files to Fill'. Do not modify source code. Do not run git commands."

Workers for tasks with no shared files can run in parallel.

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
   - [Architecture](architecture/) — system structure, module map, integration boundaries
   - [Pitfalls](pitfalls/index.md) — known high-risk areas
   [conditional layers and database entries here]
   ```
3. Delete backup (`.context/spec-first/bootstrap/<slug>/backup/`) on full success
4. On partial failure: restore backup or preserve partial output and report which tasks failed

### 3.5 Execution Summary

Report to user:
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

---

## Completion Checklist

- [ ] `docs/contexts/<slug>/README.md` contains bootstrap generation marker (`<!-- spec-bootstrap -->`)
- [ ] All fixed-task files produced and non-empty
- [ ] `00-summary.md` identifies primary language, framework(s), top-level structure
- [ ] `architecture/module-map.md` includes top-level directories with descriptions
- [ ] Conditional files produced only when evidence was found
- [ ] `database-er.md` (if generated): no passwords, < 200 lines, Mermaid erDiagram present
- [ ] Backup deleted on success, or failure reported with recovery action taken
- [ ] User informed of analysis mode and DB access mode at start
- [ ] Context slug confirmed with user when ambiguous

---

## Context Files Are Not Fixed

Workers must adapt file content to the real project — not fill in placeholder text. If a planned file has no meaningful content for this project, the worker should skip it and note why. If the project has patterns not covered by the templates, the worker should add them.

`index.md` files (layers, guides, pitfalls) must reflect the actual generated file set.

---

## References

- `references/prd-template.md` — PRD task contract template (Goal/Context/Tools/Files/Rules/Acceptance/Notes)
- `references/database-prd-template.md` — database context PRD template with ER format and credential protection rules
