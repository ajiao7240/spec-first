# Database PRD Template — spec-bootstrap `database-context` Worker

This template is used exclusively for the `database-context` conditional task. The orchestrator fills it with project-specific connection information and writes it to:

```
.context/spec-first/bootstrap/<slug>/tasks/database-context/prd.md
```

This task is only created when Phase 1 detected MySQL configuration **and** CLI/MCP connection was verified `[已验证 ✓]`.

**Architecture note:** This template is designed for MySQL (MVP). PostgreSQL, SQLite, MongoDB, Oracle, and MSSQL paths are reserved for future versions and are noted below with `[future]` markers.

---

## PRD: Build `database-context` Context Docs

### Goal

Generate database ER documentation for the `<project-name>` project's MySQL database(s).

Produce the following files:

**Single database:**
- `docs/contexts/<slug>/database/database-er.md`

**Multiple databases:**
- `docs/contexts/<slug>/database/database-index.md`
- `docs/contexts/<slug>/database/database-<name>.md` (one per database)

These files serve as a navigable, queryable index of the database schema — **not** a field-by-field reference. Detailed field inspection is done via CLI commands provided in the document.

---

### Context

**Project:** `<project-name>`
**Database type:** MySQL `[已验证 ✓]`
**Connection source:** `<env var name or config file path — never the actual password>`
  - e.g., `DB_HOST=$DB_HOST, DB_USER=$DB_USER, DB_NAME=$DB_NAME` (resolve from env at runtime)

**DB access level:**
- [ ] Level 1: MCP MySQL Server available → use `mcp__mysql-mcp-server__*` tools
- [ ] Level 2: CLI mysql available → use bash `mysql` commands
- [ ] Level 3: Neither available → infer from ORM models (mark all output `[未验证]`)

**Additional context from Phase 1:**
- ORM framework detected: `<Prisma/Sequelize/TypeORM/Drizzle/ActiveRecord/Django ORM/none>`
- ORM config file: `<path if found>`
- Estimated table count from ORM models: `<count or "unknown">`

---

### Step 1: Database Configuration Detection

Before writing any output, verify connectivity and discover the database structure.

#### 1.1 Detection Priority (already completed by orchestrator in Phase 1)

The connection information was determined using this priority order:

| Priority | Source | Example |
|----------|--------|---------|
| 1 | User explicit (`db_url=`) | `mysql://user:pass@host/db` |
| 2 | `.spec-first/meta/config.yaml` | `databases.list[0]` |
| 3 | Environment variables | `DATABASE_URL`, `DB_HOST`+`DB_NAME` |
| 4 | ORM config | `prisma/schema.prisma`, `config/database.yml` |
| 5 | Framework config | `application.yml`, `settings.py` |

The connection source for this project is: `<filled by orchestrator>`

#### 1.2 Connection Verification

At task start, verify the connection is still live:

```bash
# MySQL / MariaDB
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT 1;" 2>/dev/null

# Via MCP (Level 1)
mcp__mysql-mcp-server__execute_query: "SELECT 1"
```

If connection fails: downgrade to Level 3 (ORM inference), mark all output `[未验证]`, and continue.

#### 1.3 Connection Status Markers

Use exactly these four markers in output documents:

| Marker | Meaning |
|--------|---------|
| `[已验证 ✓]` | CLI/MCP connected successfully |
| `[CLI不可用]` | mysql CLI not installed |
| `[未验证]` | CLI available but connection failed, or ORM inference mode |
| `[连接超时]` | Connection attempt timed out |

#### 1.4 Credential Protection Rules (mandatory)

- **Never write** passwords, full connection strings, long-lived tokens, or private keys to any output file
- Reference env var **names** only: write `$DB_HOST` not the actual hostname value
- If a connection string appears in logs, replace the password segment with `***`
- DSN sanitization example: `mysql://user:***@host:3306/dbname` (not the actual DSN)
- After connection probing, clear any temporary in-memory credential references

---

### Step 2: Table Discovery and Filtering

#### 2.1 List All Tables

```sql
-- Via CLI
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW TABLES;"

-- Via MCP
mcp__mysql-mcp-server__list_tables
```

#### 2.2 Apply Backup/Stale Table Filters (R23)

Exclude tables matching **any** of the following heuristics:

**Suffix patterns:**
- `_bak`, `_backup`, `_old`, `_copy`, `_tmp`, `_temp`, `_deprecated`, `_archive`

**Prefix patterns:**
- `bak_`, `backup_`, `tmp_`, `temp_`

**Date patterns in table name:**
- `_20YYMMDD` (e.g., `orders_20240101`)
- `_YYYY_MM` (e.g., `logs_2024_03`)
- `_YYYYMM` (e.g., `events_202403`)

**Stale heuristic (use if last_update metadata available):**
- Last modified > 180 days ago AND no foreign key references to this table from other tables

**Transparent reporting:** List all excluded tables in the output document with the reason for exclusion.

#### 2.3 Schema Analysis for Remaining Tables

For each non-excluded table:

```sql
-- Get structure
DESCRIBE <table_name>;

-- Get CREATE statement (includes FKs and indexes)
SHOW CREATE TABLE <table_name>;
```

Via MCP: `mcp__mysql-mcp-server__describe_table`

Identify:
- Primary key
- Foreign keys (and which table/column they reference)
- Unique constraints
- Key business columns (status fields, timestamps)

#### 2.4 Entity Type Classification

Classify each table into one of:

| Type | Criteria |
|------|---------|
| **主数据** (Master) | Long-lived, unique identity, independent business meaning, no business timestamps |
| **事务** (Transaction) | Records a business event; has `created_at`/`updated_at`/status columns |
| **关系/明细** (Relation) | Multiple FK references, no independent business meaning |
| **配置** (Config) | Global key-value settings, non-business data |
| **审计** (Audit) | Contains `action`/`operator`/`changed_at` columns |
| **缓存** (Cache) | Has TTL/`expired_at` column |

A table may fit multiple types — classify by primary business semantics. Mark inferred classifications as `[推断]` with evidence.

---

### Step 3: ER Document Generation

#### 3.1 Output Format

Produce `database-er.md` (single DB) or per-database files (multi-DB) using this format:

```markdown
---
last_updated: <ISO date>
database_type: MySQL
cli_tool: mysql
connection_status: [已验证 ✓]
---

# <Project Name> 数据库 ER 图

> 连接状态: [已验证 ✓]
> 凭证来源: 环境变量 `$DB_HOST` / `$DB_USER` / `$DB_NAME`（密码不记录）

## 数据库连接

### CLI 查询示例

```bash
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e "DESCRIBE <table_name>;"
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e "SHOW CREATE TABLE <table_name>;"
```

## ER 图

```mermaid
erDiagram
    <TableA> ||--o{ <TableB> : "places"
    <TableB> ||--|{ <TableC> : "contains"
```

**图例:** `||--o{` 一对多, `||--||` 一对一, `}o--o{` 多对多

## 核心关系

| 主表 | 从表 | FK 字段 | 基数 | 关系说明 |
|------|------|---------|------|---------|
| TableA | TableB | table_a_id | 1:N | ... |

## 实体类型清单

| 表名 | 实体类型 | 说明 |
|------|---------|------|
| TableA | 主数据 | ... |
| TableB | 事务 [推断] | has created_at/updated_at |

## 数据流图

```mermaid
flowchart TD
  A[写入入口: API/Job] --> B[校验]
  B --> C[写主表]
  C --> D[写关系表]
  D --> E[更新状态]

  F[读取入口: API/Report] --> G[按索引查主表]
  G --> H[关联明细]
  H --> I[聚合返回]
```

## 表清单

| 表名 | 用途 | 备注 |
|------|------|------|
| TableA | ... | ... |

## 已过滤表

以下表按备份/过期启发式规则排除：

| 表名 | 排除原因 |
|------|---------|
| orders_bak_20240101 | 后缀 _bak + 日期模式 |

## 索引摘要（可选）

| 表名 | 字段 | 类型 | 说明 |
|------|------|------|------|
| TableA | email | UNIQUE | 唯一约束 |

> 💡 详细字段信息请使用上方 CLI 命令实时查询
```

#### 3.2 ER Diagram Rules (Mermaid)

**Use Mermaid `erDiagram` format.** Do not use ASCII art or box-drawing characters — Mermaid syntax is a linear token sequence, which LLMs and rendering tools handle more reliably.

- Show only table names and relationships — no field lists inside the diagram
- Relationship cardinality: `||--o{` (one-to-many), `||--||` (one-to-one), `}o--o{` (many-to-many)
- Limit to tables with at least one FK relationship — isolated tables go in Table Inventory only

#### 3.3 What NOT to Generate

| Prohibited | Alternative |
|-----------|------------|
| Per-table field tables (`| column | type | nullable |`) | Provide CLI `DESCRIBE` command |
| ER diagram with field names listed | Show table names + relationships only |
| Actual passwords or connection strings | Use env var names |
| Full table dump | Table inventory with one-line purpose |

#### 3.4 Size Constraints

Target: **< 200 lines** and **< 10 KB** per document.

If the schema is very large (100+ tables), produce a summary ER with the 20 most-connected tables and note that less-connected tables are in the table inventory only.

---

### Step 4: Multi-Database Handling (future)

If multiple databases are detected (MySQL in MVP, other types `[future]`):

1. Produce `database-index.md` with a table listing all databases and links to per-database files
2. Produce one `database-<name>.md` per database
3. Note cross-database relationships if observable from ORM or join queries

---

### Files to Fill

You own exclusively:

**Single database:**
- `docs/contexts/<slug>/database/database-er.md`

**Multiple databases:**
- `docs/contexts/<slug>/database/database-index.md`
- `docs/contexts/<slug>/database/database-<name>.md` (one per database)

Do not write to any other file.

---

### Important Rules

1. **Credential protection is non-negotiable:** No passwords, full DSN strings, host IPs, or user credentials in any output file. Reference env var names only.
2. **No field-level detail tables:** Per-table field lists are prohibited — provide CLI commands instead.
3. **No source code changes:** Read ORM models freely. Never modify source files.
4. **No git commands.**
5. **Transparent filtering:** List all excluded tables with reasons in the "已过滤表" section.
6. **Mark inferences:** Anything inferred from ORM code rather than live DB must be marked `[推断]` with evidence source. Level 3 output must mark the entire document `[未验证]` in the frontmatter.
7. **Size limits:** Each document must be < 200 lines and < 10 KB.

---

### Acceptance Criteria

- [ ] Output file(s) produced under `docs/contexts/<slug>/database/`
- [ ] Document contains no passwords, full connection strings, or other credentials
- [ ] ER diagram uses Mermaid `erDiagram` format (not ASCII art)
- [ ] ER diagram shows only table names + relationships (no field lists)
- [ ] CLI query examples are syntactically correct
- [ ] "已过滤表" section lists excluded tables with reasons
- [ ] Document is < 200 lines and < 10 KB
- [ ] Connection status marker is one of: `[已验证 ✓]`, `[CLI不可用]`, `[未验证]`, `[连接超时]`
- [ ] All inferred classifications marked `[推断]` with evidence

---

### Technical Notes

- For Level 3 (ORM inference): read ORM model files, derive table names and relationships from model definitions. Mark the frontmatter `connection_status: [未验证]` and add a banner at the top of the document.
- If the database has > 100 tables: produce a focused ER of the 20 most-connected tables and use the table inventory for the remainder.
- If foreign keys are not explicitly defined (implicit FK via naming convention): note the inferred relationship with `[推断]`.

---

*This PRD is a one-time task contract. Database schema evolves — regenerate bootstrap to refresh.*
