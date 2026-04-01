---
title: "docs: 为 spec-bootstrap 补充 MCP 工具使用指引"
type: docs
status: completed
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-spec-bootstrap-mcp-usage-guide-requirements.md
---

# docs: 为 spec-bootstrap 补充 MCP 工具使用指引

## Overview

在 `skills/spec-bootstrap/SKILL.md` 的 Prerequisites 节补充 MCP 工具的安装和使用指引，帮助外部开发者启用 Full/Enhanced 分析模式。

当前 Prerequisites 节只列出工具名称，缺少安装入口和使用示例，导致外部开发者无法充分利用 spec-bootstrap 的分析能力。

## Problem Frame

spec-bootstrap 从 Trellis 移植时简化了 MCP 工具使用指引。外部开发者不知道如何安装和使用 GitNexus、ABCoder、Serena，导致只能在 Basic 模式运行，分析深度和产物质量受限。

现有 mcp-setup skill 已解决安装问题，但 spec-bootstrap 需要补充使用指引，形成完整的"安装 → 使用"路径。

## Requirements Trace

来自 origin 文档的需求：

- R1. 在 Prerequisites 节第 4 条后新增"MCP Tools Setup"小节，引导用户使用 `/spec:mcp-setup quick` 一键安装
- R2. 在"MCP Tools Setup"小节后新增"Tool Usage Guide"小节，补充 GitNexus、ABCoder、Serena 的使用示例
- R3. 工具使用示例应与 `references/prd-template.md` 保持一致（如果已补充）
- R4. GitNexus 示例覆盖：`gitnexus_query`、`gitnexus_context`、`gitnexus_cypher`
- R5. ABCoder 示例覆盖：4 层钻取模式
- R6. Serena 示例覆盖：`get_symbols_overview`、`find_symbol`、`search_for_pattern`

## Scope Boundaries

- 不修改 mcp-setup skill 的内容
- 不修改 spec-bootstrap 的执行逻辑（Phase 1/2/3）
- 不创建独立的 references 文件
- 工具使用指引仅作为参考，不强制使用

---

## Context & Research

### 当前 Prerequisites 结构

SKILL.md 的 Prerequisites 节（第 25-38 行）包含 4 条前置要求：

1. 在目标项目中运行
2. Claude Code/Codex 有源码读权限
3. MySQL CLI 或 MCP MySQL（可选，用于 ER 生成）
4. Serena MCP（可选，用于 Enhanced 模式）

当前只列出工具名称，未说明如何安装或使用。

### mcp-setup skill 能力

`skills/mcp-setup/SKILL.md` 提供：

- `/spec:mcp-setup quick` 一键安装命令
- 安装 Serena、GitNexus、ABCoder、Sequential Thinking、Context7、Playwright MCP
- 依赖检测和自动安装（Node.js、Go、uv、jq）
- 配置合并到 `~/.claude.json`

但不包含工具使用示例和调用格式。

### Trellis 原版参考

Trellis 的 `references/mcp-setup.md` 包含：

- GitNexus: 安装、索引、配置、验证、Cypher 查询示例
- ABCoder: 安装、解析、配置、4 层钻取模式
- 工具调用示例表格和推荐工作流

---

## Key Technical Decisions

### 决策 1: 采用方案 A（在 SKILL.md 中补充）

**选项**：
- 方案 A: 在 Prerequisites 节补充 MCP Tools Setup 和 Tool Usage Guide 小节
- 方案 B: 创建独立的 `references/mcp-usage-guide.md`

**选择**: 方案 A

**理由**：
- 用户路径清晰：Prerequisites → `/spec:mcp-setup` → 重启 → `/spec:bootstrap`
- 维护成本低：单一文件，无需跨文件引用
- 与 mcp-setup skill 形成互补：安装（mcp-setup）+ 使用（spec-bootstrap）

### 决策 2: 内容深度为"调用示例 + 典型场景"

**选择**: 提供工具调用格式和推荐工作流，不展开完整教程

**理由**：
- SKILL.md 是执行指引，不是工具手册
- 详细文档由各工具官方提供
- 目标是让 worker 知道"怎么调用"，而非"工具原理"

### 决策 3: 与 prd-template.md 保持一致

如果 `references/prd-template.md` 已补充工具示例（补丁 2），SKILL.md 的工具使用指引应与其保持一致，避免信息冲突。

---

## Implementation Units

### Unit 1: 新增 MCP Tools Setup 小节

**位置**: `skills/spec-bootstrap/SKILL.md` 第 33 行后（Prerequisites 第 4 条后）

**操作**: 在第 4 条后插入新小节

**内容**:

```markdown
### MCP Tools Setup

To enable Full or Enhanced analysis mode, install required MCP tools:

```bash
/spec:mcp-setup quick
```

This installs:
- **GitNexus** + **ABCoder** (for Full mode)
- **Serena** (for Enhanced mode)
- Sequential Thinking, Context7 (universal dependencies)

⚠️ **Restart Claude Code** after installation for changes to take effect.

**Additional setup for Full mode:**

GitNexus requires indexing the target project:
```bash
npx gitnexus analyze
```

ABCoder auto-configures during `/spec:bootstrap` execution (no manual setup needed).

Verify installation:
```bash
claude mcp list | grep -E "gitnexus|abcoder|serena"
```
```

**验收**: Prerequisites 节包含 MCP Tools Setup 小节，说明 GitNexus 需要索引，ABCoder 自动配置

---

### Unit 2: 新增 Tool Usage Guide 小节 - GitNexus

**位置**: MCP Tools Setup 小节后

**操作**: 插入 GitNexus 工具使用指引

**内容**:

```markdown
### Tool Usage Guide

#### GitNexus (Full Mode)

Architecture-level analysis: clusters, flows, impact.

| Tool | Purpose | Example |
|------|---------|---------|
| `gitnexus_query` | Find execution flows | `gitnexus_query({query: "authentication flow"})` |
| `gitnexus_context` | 360° symbol view | `gitnexus_context({name: "AuthService"})` |
| `gitnexus_cypher` | Graph queries | `gitnexus_cypher({query: "MATCH (n:Class) RETURN n.name LIMIT 20"})` |

**Useful Cypher patterns**:
```cypher
-- Find classes in directory
MATCH (n:Class) WHERE n.file CONTAINS 'src/core' RETURN n.name, n.file

-- Find callers of a function
MATCH (a:Function)-[:CALLS]->(b:Function {name: 'fetchData'}) RETURN a.name, a.file

-- Cross-package dependencies
MATCH (a)-[r]->(b) WHERE a.file CONTAINS 'pkg-a' AND b.file CONTAINS 'pkg-b'
RETURN a.name, type(r), b.name LIMIT 20
```

**Workflow**: GitNexus first (identify flows) → ABCoder second (get signatures) → Read source (full context)
```

**验收**: 包含 GitNexus 工具表格（R4），覆盖 `gitnexus_query`、`gitnexus_context`、`gitnexus_cypher`

---

### Unit 3: 补充 ABCoder 工具使用指引

**位置**: GitNexus 小节后

**操作**: 插入 ABCoder 4 层钻取模式

**内容**:

```markdown
#### ABCoder (Full Mode)

Symbol-level analysis: AST nodes, signatures, dependencies.

| Tool | Layer | Purpose | Example |
|------|-------|---------|---------|
| `list_repos` | 1 | List parsed repos | `list_repos()` |
| `get_repo_structure` | 2 | File/package listing | `get_repo_structure({repo_name: "my-project"})` |
| `get_file_structure` | 3 | Nodes in file | `get_file_structure({repo_name: "my-project", file_path: "src/auth.ts"})` |
| `get_ast_node` | 4 | Full code + deps | `get_ast_node({repo_name: "my-project", node_ids: [...]})` |

**4-Layer Drill-Down**: list_repos → get_repo_structure → get_file_structure → get_ast_node
```

**验收**: 包含 ABCoder 4 层钻取模式（R5）

---

### Unit 4: 补充 Serena 工具使用指引

**位置**: ABCoder 小节后

**操作**: 插入 Serena 工具表格

**内容**:

```markdown
#### Serena (Enhanced Mode)

Semantic code analysis: symbol lookup, structure overview, pattern search.

| Tool | Purpose | Example |
|------|---------|---------|
| `mcp__serena__get_symbols_overview` | File structure | `mcp__serena__get_symbols_overview({relative_path: "src/auth.ts"})` |
| `mcp__serena__find_symbol` | Locate symbol | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` | Pattern search | `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |

**Workflow**: get_symbols_overview (structure) → find_symbol (locate) → Read source (details)
```

**验收**: 包含 Serena 工具表格（R6），覆盖 `get_symbols_overview`、`find_symbol`、`search_for_pattern`

---

## Test Scenarios

### 场景 1: 外部开发者首次使用

**步骤**:
1. 阅读 Prerequisites 节
2. 看到 MCP Tools Setup 小节
3. 执行 `/spec:mcp-setup quick`
4. 重启 Claude Code
5. 执行 `/spec:bootstrap`

**预期**: 用户能独立启用 Full/Enhanced 模式，无需额外文档

---

### 场景 2: Worker 执行 spec-bootstrap

**步骤**:
1. Orchestrator 创建 PRD，包含"Tools Available"节
2. Worker 阅读 SKILL.md 的 Tool Usage Guide
3. Worker 使用 GitNexus/ABCoder/Serena 进行代码分析
4. Worker 生成 context 文档

**预期**: Worker 知道如何调用 MCP 工具，产物质量提升

---

### 场景 3: 验证工具示例一致性

**步骤**:
1. 检查 `skills/spec-bootstrap/SKILL.md` 的 Tool Usage Guide
2. 检查 `skills/spec-bootstrap/references/prd-template.md` 的"Tools Available"节（如果已补充）
3. 对比工具调用格式和推荐工作流

**预期**: 两处示例保持一致，无信息冲突

---

## Acceptance Criteria

- [ ] Prerequisites 节包含"MCP Tools Setup"小节，引导用户使用 `/spec:mcp-setup quick`
- [ ] Prerequisites 节包含"Tool Usage Guide"小节，覆盖 GitNexus、ABCoder、Serena
- [ ] GitNexus 示例包含 `gitnexus_query`、`gitnexus_context`、`gitnexus_cypher`（R4）
- [ ] ABCoder 示例包含 4 层钻取模式（R5）
- [ ] Serena 示例包含 `get_symbols_overview`、`find_symbol`、`search_for_pattern`（R6）
- [ ] 工具使用指引与 `references/prd-template.md` 保持一致（如果已补充）
- [ ] 外部开发者能通过 Prerequisites 节独立启用 Full/Enhanced 模式
- [ ] Worker 能通过 Tool Usage Guide 正确调用 MCP 工具

---

## Handoff

实施完成后：
1. 验证 SKILL.md 的 Prerequisites 节包含所有新增内容
2. 测试外部开发者路径：阅读 Prerequisites → 执行 `/spec:mcp-setup` → 重启 → 执行 `/spec:bootstrap`
3. 如需同步更新 `references/prd-template.md`，参考补丁建议文档的补丁 2
