---
title: "MCP MySQL 连接一致性校验逻辑缺陷：@@hostname 比较失效与状态标记混淆"
problem_type: logic_error
category: logic-errors
date: 2026-04-01
tags:
  - mcp
  - mysql
  - connection-validation
  - hostname-comparison
  - docker
  - database-consistency
module: spec-graph-bootstrap
component: tooling
symptoms:
  - "@@hostname 比较在 Docker/RDS/代理环境中产生误报"
  - "状态标记 [已验证 ✓] 在 Level 1 (MCP) 和 Level 2 (CLI) 复用导致歧义"
  - "[一致性未校验] 状态允许跳过验证直接使用 MCP"
root_cause: logic_error
resolution_type: code_fix
severity: critical
related_components:
  - development_workflow
  - database
---

# MCP MySQL 连接一致性校验逻辑缺陷

## Problem

spec-graph-bootstrap skill 的 MCP MySQL 一致性校验错误使用 `@@hostname` 验证连接目标，在 Docker 和云环境中产生误判，导致正确连接被标记为不匹配。

## Symptoms

- Docker 环境：`localhost` vs `mysql-container-abc123` 误报不匹配
- RDS 环境：`mydb.rds.amazonaws.com` vs `ip-10-0-0-5` 误报不匹配
- 状态标记 `[已验证 ✓]` 无法区分 MCP 验证和 CLI 验证
- `[一致性未校验]` 路径允许使用未验证的 MCP 连接，存在连接错误数据库风险

## What Didn't Work

### @@hostname 语义错误

`@@hostname` 返回**数据库服务器的操作系统主机名**，不是客户端连接地址：

```sql
-- 在 Docker 容器中
SELECT @@hostname;  -- 返回: mysql-container-abc123
-- 但连接地址是: localhost

-- 在 AWS RDS 中
SELECT @@hostname;  -- 返回: ip-10-0-0-5 (内部 EC2 主机名)
-- 但连接地址是: mydb.us-east-1.rds.amazonaws.com
```

这是**网络地址（连接参数）vs 系统身份（服务器标识）**的根本性不匹配。

## Solution

### 修改前（错误）

```sql
SELECT @@hostname AS server_host, DATABASE() AS current_db;
-- 比较: @@hostname == project_db_host ❌
```

```markdown
| Status | Marker |
|--------|--------|
| MCP 连通 + 一致性校验通过 | `[已验证 ✓]` |
| MCP not available, CLI succeeds | `[已验证 ✓]` |  <!-- 标记冲突 -->
| MCP 连通 + 无法校验一致性 | `[一致性未校验]` |  <!-- 风险路径 -->
```

### 修改后（正确）

```sql
SELECT DATABASE() AS current_db;
-- 仅比较: DATABASE() == project_db_name ✓
```

```markdown
| Status | Marker |
|--------|--------|
| MCP 连通 + DATABASE() 校验通过 | `[MCP 已验证 ✓]` |
| MCP not available, CLI succeeds | `[CLI 已验证 ✓]` |
| MCP 连通 + DATABASE() 不匹配 | `[MCP 数据库不匹配，降级 CLI]` |
| 项目配置缺少 db_name | `[项目配置不完整，降级 CLI]` |
```

### 一致性校验逻辑

```python
# 修改前
if mcp_hostname == project_host and mcp_db == project_db:
    use_mcp()  # Docker/RDS 环境误判

# 修改后
if mcp_db == project_db:
    use_mcp()  # 仅验证数据库名
elif project_config_incomplete:
    force_cli()  # 强制降级，无风险路径
```

### 变更文件

- `skills/spec-graph-bootstrap/SKILL.md` - 一致性校验规则 (R21.1)
- `skills/spec-graph-bootstrap/references/database-prd-template.md` - worker 模板

## Why This Works

1. **DATABASE() 返回活动数据库名** - 在所有连接方式下一致
2. **数据库名是逻辑身份** - 决定查询正确性，与基础设施无关
3. **主机名是基础设施细节** - 不应用于逻辑一致性验证
4. **移除误判依赖** - 不再要求网络拓扑与操作系统身份匹配

## Prevention

### 验证连接检查逻辑

- **在目标环境测试**：Docker、RDS、裸机部署前验证
- **确认变量实际返回值**：`@@hostname` ≠ 连接 host
- **匹配逻辑身份**：数据库名、schema，而非基础设施细节

### 服务器变量 vs 连接参数

| 用途 | 使用 | 不使用 |
|------|------|--------|
| 验证数据库目标 | `DATABASE()`, `SCHEMA()` | `@@hostname`, `@@server_id` |
| 检查用户权限 | `CURRENT_USER()`, `USER()` | `@@hostname` |
| 验证服务器配置 | `@@version`, `@@sql_mode` | 用于连接匹配 |

### 测试策略

```bash
# 一致性检查测试矩阵
docker run mysql  # @@hostname = 容器 ID
aws rds connect   # @@hostname = 内部 IP
localhost mysql   # @@hostname = 机器名

# 对每种环境：验证 DATABASE() 匹配，忽略 @@hostname
```

### 设计原则

**一致性检查应验证逻辑正确性，而非基础设施拓扑。** 连接端点（host/port）是路由细节；数据库名是语义身份。

## Related

- `skills/spec-graph-bootstrap/SKILL.md` - R21.1 MCP 一致性校验规则
- `skills/spec-graph-bootstrap/references/database-prd-template.md` - 验证流程
