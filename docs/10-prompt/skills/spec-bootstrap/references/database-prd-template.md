# 数据库 PRD 模板 —spec-bootstrap `database-context` Worker

该模板专门用于 `database-context` 条件任务。编排器用项目特定的连接信息填充它并将其写入：
```
.context/spec-first/bootstrap/<slug>/tasks/database-context/prd.md
```
仅当第 1 阶段检测到 MySQL 配置**并且** CLI/MCP 连接已验证 `[已验证 ✓]` 时，才会创建此任务。

**架构说明：** 该模板是为 MySQL (MVP) 设计的。 PostgreSQL、SQLite、MongoDB、Oracle 和 MSSQL 路径是为未来版本保留的，并在下面用 `[future]` 标记进行标注。

---

## PRD：构建 `database-context` 上下文文档

### 目标

为 `<project-name>` 项目的 MySQL 数据库生成数据库 ER 文档。

生成以下文件：

**单一数据库：**
- `docs/contexts/<slug>/database/database-er.md`

**多个数据库：**
- `docs/contexts/<slug>/database/database-index.md`
- `docs/contexts/<slug>/database/database-<name>.md`（每个数据库一个）

这些文件充当数据库模式的可导航、可查询的索引——**不是**逐个字段的引用。详细的现场检查是通过文档中提供的 CLI 命令完成的。

---

### 上下文

**项目：** `<project-name>`
**数据库类型：** MySQL `[已验证 ✓]`
**连接源：** `<env var name or config file path — never the actual password>`
  - 例如，`DB_HOST=$DB_HOST, DB_USER=$DB_USER, DB_NAME=$DB_NAME`（运行时从 env 解析）

**项目数据库配置（由阶段 1.5 中的 Orchestrator 解决）：**
  - `project_db_host`：`<resolved host from project config, e.g., 10.0.0.5 or localhost>`
  - `project_db_port`：`<port, default 3306>`
  - `project_db_name`：`<database name>`
  - `project_db_user_env`：`<env var name for user, e.g., $DB_USER>`
  - `project_db_pass_env`：`<env var name for password, e.g., $DB_PASS>`**数据库访问级别（由协调器在 MCP 一致性检查后确定）：**
- [ ] 级别 1：MCP MySQL 服务器 + DATABASE() 校验方式 → 使用 `mcp__mysql-mcp-server__*` 工具
  - **前提：** 编排器已通过 `SELECT DATABASE()` 确认 MCP 连接的数据库名与项目配置一致
- [ ] Level 2: MCP 不匹配或不可用，CLI mysql 可用 → 使用 bash `mysql` 命令**和项目配置**
  - `mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME`
  - 连接参数来自上方 `project_db_*` 信号，除 MCP 配置
- [ ] 3 级：MCP 和 CLI 均不可用 → 从 ORM 模型推断（标记所有输出 `[未验证]`）

**MCP一致性检查结果：** `<filled by orchestrator: matched / mismatched (MCP db=<>, project db=<>) / config_incomplete>`

**第一阶段的其他背景：**
- 检测到 ORM 框架：`<Prisma/Sequelize/TypeORM/Drizzle/ActiveRecord/Django ORM/none>`
- ORM 配置文件：`<path if found>`
- ORM 模型的估计表数量：`<count or "unknown">`

---

### 步骤1：数据库配置检测

在写入任何输出之前，请验证连接并发现数据库结构。

#### 1.1 检测优先级（已在第一阶段由orchestrator完成）

连接信息是使用以下优先级顺序确定的：

|优先|来源 |示例|
|----------|--------|---------|
| 1 |用户显式 (`db_url=`) | `mysql://user:pass@host/db` |
| 2 | `.spec-first/meta/config.yaml` | `databases.list[0]` |
| 3 |环境变量| `DATABASE_URL`、`DB_HOST`+`DB_NAME` |
| 4 | ORM 配置 | `prisma/schema.prisma`、`config/database.yml` |
| 5 |框架配置 | `application.yml`、`settings.py` |

该项目的连接源是：`<filled by orchestrator>`

#### 1.2 连接验证

在任务开始时，验证连接仍然有效并且与项目配置一致：**1 级 (MCP) — 验证 + 一致性检查：**
```sql
-- Step 1: Verify connectivity
mcp__mysql-mcp-server__execute_query: "SELECT 1"

-- Step 2: Verify consistency (CRITICAL)
-- Compare MCP's actual database with project config
mcp__mysql-mcp-server__execute_query: "SELECT DATABASE()"
```
将结果与上下文中的 `project_db_name` 进行比较：
- `DATABASE()` 匹配 `project_db_name` → **一致**，继续 MCP
- 不匹配 → **停止使用 MCP**，降级到 2 级（带有项目配置的 CLI）或 3 级
- 将比较结果记录在输出文档中

**级别 2 (CLI) — 使用项目配置进行验证：**
```bash
# Use project's actual connection parameters, NOT MCP's
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT 1;" 2>/dev/null
```
如果连接失败：降级到3级（ORM推理），标记所有输出`[未验证]`，然后继续。

#### 1.3 连接状态标记

在输出文档中准确使用这些标记：

|标记|意义|
|--------|---------|
| `[MCP 已验证 ✓]` | MCP 连接且 DATABASE() 与项目配置匹配 |
| `[CLI 已验证 ✓]` | CLI 与项目配置成功连接 |
| `[MCP 数据库不匹配，降级 CLI]` | MCP 连接但数据库错误，降级为 CLI |
| `[项目配置不完整，降级 CLI]` |项目配置缺少 db_name，降级为 CLI |
| `[CLI不可用]` | mysql CLI 未安装 |
| `[未验证]` | CLI可用但连接失败，或ORM推理模式 |
| `[连接超时]` |连接尝试超时 |

#### 1.4 凭证保护规则（强制）

- **切勿将**密码、完整连接字符串、长期令牌或私钥写入任何输出文件
- 仅参考环境变量**名称**：写入 `$DB_HOST` 而不是实际的主机名值
- 如果日志中出现连接字符串，请将密码段替换为 `***`
- DSN 清理示例：`mysql://user:***@host:3306/dbname`（不是实际的 DSN）
- 连接探测后，清除所有临时内存凭证引用

---

### 步骤 2：表发现和过滤

#### 2.1 列出所有表
```sql
-- Via CLI (Level 2 — uses project config connection)
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME -e "SHOW TABLES;"

-- Via MCP (Level 1 — only if consistency check passed)
mcp__mysql-mcp-server__list_tables
```
#### 2.2 应用备份/过时表过滤器 (R23)

排除与**任何**以下启发式匹配的表：

**后缀模式：**
- `_bak`、`_backup`、`_old`、`_copy`、`_tmp`、`_temp`、`_deprecated`、`_archive`

**前缀模式：**
- `bak_`、`backup_`、`tmp_`、`temp_`

**表名称中的日期模式：**
- `_20YYMMDD`（例如`orders_20240101`）
- `_YYYY_MM`（例如`logs_2024_03`）
- `_YYYYMM`（例如`events_202403`）

**过时的启发式（如果last_update元数据可用则使用）：**
- 上次修改 > 180 天前，并且没有外键从其他表引用此表

**透明报告：** 列出输出文档中所有排除的表以及排除原因。

#### 参考 SQL — 可选

> 以下 SQL 仅作参考，不能替代上面的启发式描述。不同的 MySQL 版本对 `information_schema` 元数据的可用性不同，尤其是 `update_time` 在某些引擎或旧版本中可能为 `NULL`。
```sql
-- Suffix / prefix filters
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND (
    table_name REGEXP '(_bak|_backup|_old|_copy|_tmp|_temp|_deprecated|_archive)$'
    OR table_name REGEXP '^(bak_|backup_|tmp_|temp_)'
  );

-- Date-pattern filters in table names
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND (
    table_name REGEXP '_20[0-9]{6}$'
    OR table_name REGEXP '_[0-9]{4}_[0-9]{2}$'
    OR table_name REGEXP '_[0-9]{6}$'
  );

-- Stale heuristic: updated long ago and not referenced by foreign keys
SELECT t.table_name
FROM information_schema.tables t
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.referenced_table_schema = t.table_schema
 AND kcu.referenced_table_name = t.table_name
WHERE t.table_schema = DATABASE()
  AND t.update_time IS NOT NULL
  AND t.update_time < NOW() - INTERVAL 180 DAY
  AND kcu.referenced_table_name IS NULL;
```
> MySQL 8.0+ 通常会更可靠地为 InnoDB 表公开 `update_time`。在 MySQL 5.7 上，或者当元数据不可用时，将过时的启发式视为建议，并仅回退到基于 FK 的排除。

#### 2.3 剩余表的模式分析

对于每个非排除表：
```sql
-- Get structure
DESCRIBE <table_name>;

-- Get CREATE statement (includes FKs and indexes)
SHOW CREATE TABLE <table_name>;
```
通过 MCP：`mcp__mysql-mcp-server__describe_table`

识别：
- 主键
- 外键（以及它们引用的表/列）
- 独特的限制
- 关键业务列（状态字段、时间戳）

#### 2.4 实体类型分类

将每个表分类为以下之一：

|类型 |标准|
|------|---------|
| **主数据**（硕士）|寿命长、身份唯一、独立商业意义、无商业时间戳 |
| **事务**（交易）|记录商业事件；具有 `created_at`/`updated_at`/状态列 |
| **关系/明细** (关系) |多个FK引用，无独立商业意义|
| **配置**（配置）|全局键值设置、非业务数据 |
| **审计**（审计）|包含 `action`/`operator`/`changed_at` 列 |
| ** 缓存**（缓存）|有TTL/`expired_at`栏|

一个表可以适合多种类型——按主要业务语义进行分类。将推断的分类标记为`[推断]`并提供证据。

---

### 步骤 3：ER 文档生成

#### 3.1 输出格式

使用以下格式生成 `database-er.md`（单 DB）或每个数据库文件（多 DB）：
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
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME -e "描述 <表名>;"
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME -e "显示创建表 <表名>;"
```

> 注意：上方 CLI 命令使用目标项目的连接参数（`$DB_HOST`, `$DB_PORT`, `$DB_NAME`），非 MCP 预配置连接。

## ER 图

```mermaid
er图
    <TableA> ||--o{ <TableB> : “地点”
    <TableB> ||--|{ <TableC> : “包含”
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
流程图TD
  A[写入入口: API/Job] --> B[校验]
  B --> C[写主表]
  C --> D[写关系表]
  D --> E[更新状态]

  F[读取入口：API/Report] --> G[按索引查主表]
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
#### 3.2 ER 图规则（美人鱼）

**使用 Mermaid `erDiagram` 格式。** 不要使用 ASCII 艺术或方框图字符 — Mermaid 语法是线性标记序列，LLM 和渲染工具可以更可靠地处理它。

- 仅显示表名称和关系 - 图中没有字段列表
- 关系基数：`||--o{`（一对多），`||--||`（一对一），`}o--o{`（多对多）
- 仅限于至少具有一个 FK 关系的表 — 孤立的表仅出现在表库存中

#### 3.3 不应该生成什么

|禁止 |另类|
|------------|------------|
|每表字段表 (`| column | type | nullable |`) |提供 CLI `DESCRIBE` 命令 |
|列出字段名称的 ER 图 |仅显示表名+关系 |
|实际密码或连接字符串 |使用环境变量名称 |
|全表转储|具有单行用途的表库存 |

#### 3.4 尺寸限制

目标：每个文档 **< 200 行** 且 **< 10 KB**。

如果架构非常大（超过 100 个表），请生成包含 20 个连接最频繁的表的摘要 ER，并注意连接较少的表仅位于表清单中。

---

### 步骤 4：多数据库处理（未来）

如果检测到多个数据库（MVP中的MySQL，其他类型`[future]`）：

1. 生成 `database-index.md`，其中包含列出所有数据库和每个数据库文件链接的表格
2. 每个数据库生成一个`database-<name>.md`
3. 如果可以从 ORM 或连接查询观察到跨数据库关系，请注意

---

### 要填写的文件

您独家拥有：

**单一数据库：**
- `docs/contexts/<slug>/database/database-er.md`

**多个数据库：**
- `docs/contexts/<slug>/database/database-index.md`
- `docs/contexts/<slug>/database/database-<name>.md`（每个数据库一个）

不要写入任何其他文件。

---### 重要规则

1. **凭据保护是不可协商的：** 任何输出文件中都没有密码、完整 DSN 字符串、主机 IP 或用户凭据。仅引用环境变量名称。
2. **没有字段级详细信息表：** 禁止每表字段列表 - 请改为提供 CLI 命令。
3. **无需更改源代码：** 自由阅读 ORM 模型。切勿修改源文件。
4. **没有 git 命令。**
5. **透明过滤：** 在“已过滤表”部分列出所有排除的表并附上原因。
6. **标记推论：** 从 ORM 代码而不是实时数据库推断的任何内容都必须用证据源标记 `[推断]`。 3 级输出必须在前面标记整个文档 `[未验证]`。
7. **大小限制：** 每个文档必须 < 200 行且 < 10 KB。

---

### 验收标准

- [ ] 在 `docs/contexts/<slug>/database/` 下生成的输出文件
- [ ] 文档不包含密码、完整连接字符串或其他凭据
- [ ] ER 图使用 Mermaid `erDiagram` 格式（不是 ASCII 艺术）
- [ ] ER图仅显示表名+关系（无字段列表）
- [ ] CLI 查询示例使用项目配置参数（`$DB_HOST`、`$DB_PORT`、`$DB_NAME`），而不是 MCP 默认值
- [ ]“已过滤表”部分列出了排除的表及其原因
- [ ] 文档 < 200 行且 < 10 KB
- [ ] 连接状态标记为以下之一：`[MCP 已验证 ✓]`、`[CLI 已验证 ✓]`、`[MCP 数据库不匹配，降级 CLI]`、`[项目配置不完整，降级 CLI]`、`[CLI不可用]`、`[未验证]`、`[连接超时]`
- [ ] 如果级别 1 (MCP)：记录一致性检查结果（匹配 db_name）
- [ ] 如果级别 2 (CLI)：CLI 命令引用项目配置变量，而不是 MCP 配置
- [ ] 所有推断的分类均标有证据`[推断]`

---

### 技术说明- 对于第 3 级（ORM 推理）：读取 ORM 模型文件，从模型定义中派生表名称和关系。标记 frontmatter `connection_status: [未验证]` 并在文档顶部添加横幅。
- 如果数据库有超过 100 个表：生成 20 个连接最频繁的表的重点 ER，并使用表清单来处理其余的表。
- 如果未显式定义外键（通过命名约定隐式 FK）：请注意与 `[推断]` 的推断关系。

---

*此 PRD 是一次性任务合同。数据库模式不断发展——重新生成引导程序以进行刷新。*
