---
title: "spec-graph-bootstrap MySQL 预校验当前 contract：移除 @@hostname，DATABASE() 不匹配仅告警"
date: 2026-04-19
last_updated: 2026-04-20
category: documentation-gaps
module: spec-graph-bootstrap
problem_type: documentation_gap
component: tooling
severity: high
applies_when:
  - "刷新或审查 spec-graph-bootstrap 的 MySQL database worker 文档时"
  - "判断 MCP Level 1 的 DATABASE() 不匹配是否应该强制降级 CLI 时"
  - "旧 learning、架构分析文档与当前 database-worker source-of-truth 不一致时"
tags:
  - spec-graph-bootstrap
  - mysql
  - mcp
  - database-worker
  - consistency-check
  - documentation-drift
  - database-precheck
---

# spec-graph-bootstrap MySQL 预校验当前 contract：移除 @@hostname，DATABASE() 不匹配仅告警

## Context

仓库里曾有一篇现已删除的早期 learning（`docs/solutions/logic-errors/mcp-mysql-hostname-validation-logic-flaw-2026-04-01.md`），其中“`@@hostname` 不能用于校验 MySQL 连接目标”这一点仍然成立；但那篇文档继续把“`DATABASE()` 与期望 DB 名不匹配”描述成**必须降级 CLI**，并把状态标记写成核心 contract，这两部分已经不再符合当前代码现实。

当前 source-of-truth 已经收口到 [database-worker.md](../../skills/spec-graph-bootstrap/references/database-worker.md)：

- 不再使用 `@@hostname`
- Level 1 只做 `SELECT DATABASE()` 预校验
- `DATABASE()` 与期望 DB 名不匹配时，打印警告，**不终止**，继续使用当前连接 DB
- 真正的硬停止条件是：`DATABASE()` 返回 `NULL`、系统库，或 MCP/CLI 连接失败
- 运行时结果通过 `generation_errors`、`db_access_level` 和产物是否生成来体现，而不是旧文档里的状态标记表

## Guidance

判断 spec-graph-bootstrap 当前 MySQL 一致性预校验时，应以 `skills/spec-graph-bootstrap/references/database-worker.md` 为准，而不是沿用旧 learning 或分析文档里的早期降级语义。

### 当前 Level 1（MCP）预校验

```text
execute_query("SELECT 1")
  -> 成功后执行 execute_query("SELECT DATABASE()")
     -> NULL: 写 generation_errors，跳过 database worker
     -> information_schema/mysql/performance_schema: 写 generation_errors，跳过 database worker
     -> 与期望 DB 名不匹配: 打印警告，但继续使用当前连接 DB
     -> 其余: 继续 list_tables
```

其中“期望 DB 名”来自 Phase 1 对 `.env` / `DATABASE_URL` / `config/database.yml` 的提取；如果拿不到期望值，就跳过比对，而不是把 MCP 降级掉。

### 当前 Level 2（CLI）预校验

```text
先检查 DB_HOST / DB_USER
  -> 缺失: 写 generation_errors，跳过 database worker
  -> 齐备: mysql ... -e "SHOW TABLES"
     -> 失败: 写 generation_errors，跳过 database worker
     -> 成功: 继续 schema 读取
```

### 当前 contract 里已经不存在的旧语义

以下内容不应再被当成现行 contract：

1. `@@hostname == project_db_host` 之类的连接目标比较
2. `DATABASE()` 不匹配时必须降级 CLI
3. 用 `[MCP 已验证 ✓]`、`[CLI 已验证 ✓]`、`[一致性未校验]` 这类状态标记表来表达数据库 worker 的最终行为
4. `skills/spec-graph-bootstrap/references/database-prd-template.md` 作为当前 worker 模板入口

当前 worker 模板文件名已经是：

- `skills/spec-graph-bootstrap/references/database-worker.md`

## Why This Matters

这不是文案细节，而是运行语义差异：

- 如果还按旧 learning 理解，你会误以为“DB 名不匹配一定会自动降级 CLI”
- 但当前代码实际是“告警并继续使用当前连接 DB”，这会直接影响你对风险、日志和调试路径的判断
- 如果还盯着旧状态标记表，你会错过现在真正留痕的地方：`generation_errors`、`db_access_level` 和产物生成结果

换句话说，旧 learning 的前半句“不要用 `@@hostname`”仍对，但后半句“mismatch 必降级 CLI”和“状态标记 contract”已经漂移。继续保留旧文档会把读者带到错误的当前行为认知上。

## When to Apply

- 你在维护 `skills/spec-graph-bootstrap/references/database-worker.md`
- 你在评估 MySQL MCP 连接失配时 database worker 的实际降级行为
- 你在刷新 `docs/solutions/` 或架构分析文档，发现它们仍然写着“mismatch -> CLI fallback”
- 你在排查为什么 database worker 没有降级 CLI，而只是打印 warning 并继续

## Examples

### 例 1：当前 DB 名与项目配置不匹配

**旧理解（已失效）**：

```text
DATABASE() != project_db_name
  -> 降级 CLI
```

**当前 source-of-truth**：

```text
DATABASE() != project_db_name
  -> 打印 warning
  -> 继续使用当前 MCP 连接的 DB
```

### 例 2：当前连接落在系统库

```text
DATABASE() in [information_schema, mysql, performance_schema]
  -> 写 generation_errors
  -> 跳过整个 database worker
```

### 例 3：刷新相关文档时的核对顺序

1. 先读 `skills/spec-graph-bootstrap/references/database-worker.md`
2. 再看 `skills/spec-graph-bootstrap/SKILL.md` 对 database worker 的引用
3. 最后再对照 `docs/solutions/` 和架构分析文档

如果三者冲突，以 source-of-truth 为准，而不是沿用旧 learning 的结论。

## Related

- [database-worker.md](../../skills/spec-graph-bootstrap/references/database-worker.md) — 当前 MySQL database worker 的 source-of-truth
- [modify-source-not-artifacts-2026-04-13.md](../workflow-issues/modify-source-not-artifacts-2026-04-13.md) — 当 learning 与当前源码冲突时，先以 source-of-truth 纠正文档，而不是反过来解释代码
