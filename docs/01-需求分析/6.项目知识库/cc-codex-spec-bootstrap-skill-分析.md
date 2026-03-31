# cc-codex-spec-bootstrap Skill 完整分析

> 来源: `spec-first v1.3.11/marketplace/skills/cc-codex-spec-bootstrap`
> 分析日期: 2026-03-30

---

## 1. 做了什么事情（功能概述）

### 核心功能
**自动化生成项目特定的 Coding Guidelines（编码规范）**。

通过 **Claude Code (CC) + Codex 多 Agent 并行流水线**，利用代码智能 MCP 工具分析仓库架构，然后创建带有丰富架构上下文的任务 PRD，最终由多个 Codex Agent 并行填充 spec-first 框架下的编码规范文件。

### 解决的痛点
- AI coding agent 在有项目特定 coding guidelines 时产出更好，但手动填写这些 guidelines 非常枯燥
- 通用模板缺乏项目实际的代码示例、模式和反模式
- 单 Agent 顺序处理效率低

### 适用场景
- 为项目初始化 spec-first 编码规范
- 为 Codex Agent 批量创建 spec 任务
- 利用 GitNexus/ABCoder MCP 工具进行多 Agent spec 生成
- 引导新的 coding guidelines 填充

---

## 2. 怎么做的（实现流程）

### 整体架构：三阶段流水线

```
┌─────────────────────────────────────────────────────────┐
│                    Phase 1: Analyze                      │
│  CC 用 GitNexus + ABCoder 分析仓库，输出架构认知          │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│                Phase 2: Create Tasks                     │
│  CC 按 (package × layer) 拆分任务，为每个任务写 PRD       │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Phase 3: Launch Codex                       │
│  多个 Codex Agent 并行执行，各自填充 spec 文件            │
└─────────────────────────────────────────────────────────┘
```

### Phase 1: 分析仓库

**Step 1 — GitNexus 索引**
```bash
npx gitnexus analyze    # 构建知识图谱（~5s 典型 monorepo）
```
产出：`.gitnexus/` 目录（KuzuDB 数据库，50-200MB）
包含：nodes（符号）、edges（依赖关系）、clusters（模块分组）、flows（执行流）

通过 MCP 工具查询：
- `gitnexus_query({query: "plugin system"})` — 查找执行流
- `gitnexus_context({name: "SomeClass"})` — 360度符号视图
- `gitnexus_cypher({query: "MATCH ..."})` — Cypher 图查询

**Step 2 — ABCoder 解析**
```bash
abcoder parse /path/to/package --lang typescript --name pkg-name --output ~/abcoder-asts
```
产出：`~/abcoder-asts/<name>-ast.json`（每个包 1-10MB）

通过 MCP 工具查询（4层下钻）：
- Layer 1: `list_repos()` — 列出所有仓库
- Layer 2: `get_repo_structure()` — 文件/包列表
- Layer 3: `get_file_structure()` / `get_package_structure()` — 文件内节点
- Layer 4: `get_ast_node()` — 完整代码 + 依赖 + 引用 + 实现

**Step 3 — 架构映射**

结合两个工具的洞察，理解：
- 包边界（哪些包存在，各自职责）
- 模块集群（功能分组）
- 关键模式（Fetcher/Provider/Plugin/Adapter/Router 等）
- 跨包数据流
- 错误处理模式
- 状态管理方式

### Phase 2: 创建 spec-first 任务

**任务拆分策略**

按 `(package, layer)` 矩阵拆分，每个组合一个独立任务：
```
package-a/backend    → Task 1
package-a/frontend   → Task 2
package-b/backend    → Task 3
package-b/frontend   → Task 4
cross-layer-guide    → Task 5
```

**创建任务目录**
```bash
python3 .spec-first/scripts/task.py create "Fill <package> <layer> spec" --slug <package>-<layer>-spec
```

**编写 PRD（关键环节）**

每个 PRD 是一个 Codex Agent 的**完整上下文包**，必须包含：

| PRD 区域 | 内容 | 目的 |
|----------|------|------|
| Goal | 一句话目标 | 明确任务边界 |
| Context | Phase 1 收集的架构知识 | 让 Agent 理解代码库 |
| Tools Available | MCP 工具使用模板 | 让 Agent 知道如何使用工具 |
| Files to Fill | 列出需填充的 spec 文件 + 提示 | 指引分析方向 |
| Important Rules | 并行安全规则 | 防止冲突 |
| Acceptance Criteria | 验收标准 | 质量保障 |
| Technical Notes | 包路径/语言/框架等 | 技术上下文 |

### Phase 3: 启动 Codex Agents

**并行执行**
```bash
# 每个 terminal 启动一个 agent
codex -q "Read .spec-first/tasks/<task-slug>/prd.md and execute the task. Use GitNexus and ABCoder MCP tools to analyze the codebase, then fill all spec files listed in the PRD."
```

**监控进度**
```bash
# 查看行数（0 或 ~50 行说明还是模板）
find .spec-first/spec -name "*.md" -exec sh -c 'echo "$(wc -l < "$1") $1"' _ {} \; | sort -rn

# 检查占位符残留
grep -rl "To be filled" .spec-first/spec/

# 新创建/修改的文件
find .spec-first/spec -name "*.md" -newer .spec-first/tasks/ -exec ls -la {} \;
```

**审查结果**
1. 行数检查 — 实质性文件应 80+ 行
2. 占位符检查 — 不应残留 "To be filled"
3. 代码示例检查 — 应有真实代码引用
4. index.md 检查 — 反映实际文件集

---

## 3. 有哪些依赖（工具链）

### 必需工具

| 工具 | 用途 | 安装/验证 |
|------|------|-----------|
| [spec-first](https://github.com/mindfold/spec) | 工作流框架，提供 `.spec-first/spec/` 目录结构 | `python3 .spec-first/scripts/get_context.py` |
| [GitNexus](https://github.com/abhigyan-ron/ron) | 代码→知识图谱（Tree-sitter + KuzuDB） | `npx gitnexus status` |
| [ABCoder](https://github.com/nicepkg/abcoder) | 代码→UniAST（ts-morph/tree-sitter） | `abcoder list-repos` |
| [Codex CLI](https://github.com/openai/codex) | 并行任务执行 Agent | `codex mcp list` |

### MCP 工具配置

**GitNexus MCP** — 架构级分析

| MCP 工具 | 功能 |
|----------|------|
| `gitnexus_query` | 按概念搜索执行流 |
| `gitnexus_context` | 符号 360 度视图 |
| `gitnexus_impact` | 影响范围分析 |
| `gitnexus_detect_changes` | 提交前范围检查 |
| `gitnexus_rename` | 安全多文件重命名 |
| `gitnexus_cypher` | 直接 Cypher 图查询 |
| `gitnexus_list_repos` | 列出已索引仓库 |

**ABCoder MCP** — 符号级分析

| MCP 工具 | 层级 | 功能 |
|----------|------|------|
| `list_repos` | L1 | 列出已解析仓库 |
| `get_repo_structure` | L2 | 仓库文件/包列表 |
| `get_package_structure` | L3 | 包内节点列表 |
| `get_file_structure` | L3 | 文件内节点（函数、类型、签名） |
| `get_ast_node` | L4 | 完整代码 + 依赖 + 引用 |

### MCP 配置命令

```bash
# Claude Code
claude mcp add gitnexus -- npx -y gitnexus mcp
claude mcp add abcoder -- abcoder mcp ~/abcoder-asts

# Codex
codex mcp add gitnexus -- npx -y gitnexus mcp
codex mcp add abcoder -- abcoder mcp ~/abcoder-asts
```

---

## 4. 有哪些产物（输出文件）

### 中间产物

| 产物 | 路径 | 说明 |
|------|------|------|
| GitNexus 知识图谱 | `.gitnexus/` | KuzuDB 数据库（50-200MB） |
| ABCoder AST 文件 | `~/abcoder-asts/<name>-ast.json` | 每包 1-10MB |
| 任务目录 | `.spec-first/tasks/<task-slug>/` | 每个任务一个目录 |
| PRD 文件 | `.spec-first/tasks/<task-slug>/prd.md` | Codex Agent 的上下文包 |

### 最终产物

| 产物 | 路径 | 说明 |
|------|------|------|
| Spec 文件集 | `.spec-first/spec/<package>/<layer>/*.md` | 填充后的编码规范文件 |
| 更新的 index.md | `.spec-first/spec/<package>/<layer>/index.md` | 反映实际文件列表 |

### Spec 文件质量标准

- 包含真实代码示例（带文件路径引用）
- 包含反模式文档
- 无占位符文本残留
- index.md 反映实际文件集
- 实质性文件应 80+ 行

---

## 5. 有哪些规范（设计模式与约束）

### Skill 文件组织规范

```
skill-name/
  SKILL.md              # 主文件（必需）
  references/            # 参考资料（可选）
    mcp-setup.md         # 工具配置指南
```

### SKILL.md 结构规范

```yaml
# Frontmatter（YAML）
---
name: <skill-unique-id>                           # 唯一标识符
description: "详细描述 + 触发关键词场景"              # 包含多个触发场景
---

# 正文结构（Markdown）
1. 标题 + 概述段落（Why This Exists）
2. Prerequisites 表格
3. Phase × Steps 流程
4. Checklist
```

### Frontmatter description 编写规范

必须包含触发场景关键词，用引号包裹具体短语，例如：
- `"bootstrap specs for codex"`
- `"create spec tasks"`
- `"CC + Codex spec pipeline"`
- `"initialize coding guidelines with code intelligence"`

### PRD 模板规范

每个 PRD 必须包含 7 个区域：

```markdown
# Fill <package> <layer> spec

## Goal        — 一句话目标
## Context     — 架构知识（从 Phase 1 提取）
## Tools Available — MCP 工具使用模板（标准化）
## Files to Fill   — 目标文件列表 + 分析提示
## Important Rules — 并行安全规则
## Acceptance Criteria — 验收 Checklist
## Technical Notes — 技术上下文（语言/框架/构建工具）
```

### MCP 工具使用规范

**推荐工作流顺序**：
1. GitNexus 先行 — 找到相关执行流和集群（宏观）
2. ABCoder 其次 — 获取精确代码模式和签名（微观）
3. Read 源文件 — 获取完整上下文
4. Write specs — 用真实代码示例填充

**ABCoder 4 层下钻模式**：
```
list_repos → get_repo_structure → get_file_structure → get_ast_node
   (仓库)        (包结构)           (文件节点)          (完整AST)
```

### 并行执行安全规范

| 规则 | 说明 |
|------|------|
| 只修改分配目录 | 每个 Agent 只操作自己的 spec 目录 |
| 不修改源码 | Agent 只读源码进行分析 |
| 不操作 git | Agent 不执行 git 命令 |
| 可读任意文件 | 分析阶段无限制 |

### Spec 文件灵活性规范

- **可删除**不适用的模板文件
- **可新建**模板未覆盖的模式文件
- **可重命名**不合适的模板文件名
- **必须更新** index.md 反映最终文件集

### 完成度验证 Checklist

```markdown
- [ ] GitNexus analyzed (`npx gitnexus analyze`)
- [ ] ABCoder parsed all packages
- [ ] GitNexus + ABCoder MCP configured for both Claude Code and Codex
- [ ] Architecture mapped (packages, patterns, boundaries)
- [ ] One task per (package, layer) created with `task.py create`
- [ ] Each PRD has: Context, MCP Tools, Files to Fill, Rules, Acceptance Criteria
- [ ] Codex agents launched in parallel
- [ ] Results reviewed — no placeholders, real code examples present
```

---

## 6. 创建新 Skill 的参考模板

基于以上分析，创建新 skill 的最小骨架：

```
your-skill-name/
  SKILL.md
  references/           # 可选
    setup-guide.md
```

```markdown
---
name: your-skill-name
description: "功能描述。触发关键词: 'keyword1', 'keyword2', '场景描述'。Use when: 具体场景列表。"
---

# Skill 标题

一段话说明为什么需要这个 skill。

## Prerequisites
| Tool | Purpose | Required |
|------|---------|----------|
| ... | ... | Yes |

## Phase 1: <阶段名>
### Step 1: <步骤名>
具体操作和命令...

## Phase 2: <阶段名>
...

## Checklist
- [ ] 验证项 1
- [ ] 验证项 2
```

### 关键设计要点

1. **Description 要丰富** — 包含多种触发场景，提高自动匹配率
2. **PRD 是核心** — 多 Agent 场景下，PRD 是 Agent 唯一的上下文来源
3. **Phase 划分** — 每阶段有明确目标和可验证产出
4. **references 独立** — 配置细节不阻塞主流程
5. **Checklist 闭环** — 用户可逐步验证完成度
