# spec-bootstrap 补丁建议

> 基于 Trellis 原版 `cc-codex-spec-bootstrap` 的对比分析，识别当前 spec-first 版本的缺失内容和改进方向。

---

## 对比总结

| 维度 | Trellis 原版 | spec-first 当前版 | 差距 |
|------|-------------|------------------|------|
| 工具安装指引 | 完整的 `references/mcp-setup.md` | 省略，仅在 SKILL.md 中检测 | 外部开发者不知道如何启用 Full/Enhanced 模式 |
| PRD 工具使用模板 | 具体调用示例 + 推荐工作流 | 抽象工具列表 | worker 不知道怎么用 MCP 工具 |
| 产物结构灵活性 | 明确"Spec files are NOT fixed"原则 | 末尾提及但未在 PRD 中强调 | worker 可能机械填充模板 |
| 验收标准 | 要求"Anti-patterns documented" | 未明确要求反模式文档 | pitfalls 质量无保证 |

---

## 补丁清单

### P0 - 立即补充（影响外部开发者可用性）

#### 补丁 1：恢复 `references/mcp-setup.md`

**问题**：当前 SKILL.md 只检测工具是否可用，不告诉用户如何安装配置。

**方案**：从 Trellis 原版移植 `mcp-setup.md`，调整为 spec-first 语境：
- 保留 GitNexus 和 ABCoder 的安装、配置、验证步骤
- 新增 Serena MCP 的配置说明（Enhanced 模式）
- 移除 Codex 相关内容（spec-first 不用 Codex）
- 调整路径引用（`.trellis/` → `docs/contexts/`）

**位置**：`skills/spec-bootstrap/references/mcp-setup.md`

**关键章节**：
```markdown
# MCP 工具安装与配置指南

## GitNexus（Full 模式必需）
### 安装
npm install -g gitnexus

### 索引项目
npx gitnexus analyze

### 配置 MCP
claude mcp add gitnexus -- npx -y gitnexus mcp

### 验证
gitnexus_query({query: "test"})

## ABCoder（Full 模式必需）
### 安装
npm install -g abcoder

### 解析项目
abcoder parse /path/to/project --lang typescript --name my-project --output ~/.abcoder-asts

### 配置 MCP
claude mcp add abcoder -- abcoder mcp ~/.abcoder-asts

### 验证
list_repos()

## Serena（Enhanced 模式必需）
### 配置
参考 Serena MCP 官方文档配置 mcp__serena__* 工具

### 验证
mcp__serena__get_symbols_overview({relative_path: "src/index.ts"})
```

---

#### 补丁 2：PRD 模板补充 MCP 工具调用示例

**问题**：`references/prd-template.md` 的"Tools Available"节只列工具名，没有调用格式和推荐工作流。

**方案**：参考 Trellis 原版，在 prd-template.md 的"Tools Available"节补充：

```markdown
## Tools Available

> The orchestrator fills this section based on the detected analysis mode.

**Analysis mode: [Full | Enhanced | Basic]**

### Full Mode — GitNexus + ABCoder MCP

**GitNexus MCP (architecture-level: clusters, flows, impact)**

| Tool | Purpose | Example Call |
|------|---------|--------------|
| `gitnexus_query` | Find execution flows by concept | `gitnexus_query({query: "authentication flow"})` |
| `gitnexus_context` | 360-degree symbol view (callers, callees, cluster) | `gitnexus_context({name: "AuthService"})` |
| `gitnexus_impact` | Blast radius analysis | `gitnexus_impact({target: "UserModel", direction: "downstream"})` |
| `gitnexus_cypher` | Direct Cypher queries against KuzuDB | `gitnexus_cypher({query: "MATCH (n:Class) RETURN n.name LIMIT 20"})` |

**ABCoder MCP (symbol-level: AST nodes, signatures, dependencies)**

| Tool | Purpose | Example Call |
|------|---------|--------------|
| `list_repos` | List all parsed repositories | `list_repos()` |
| `get_repo_structure` | Full file/package listing | `get_repo_structure({repo_name: "my-project"})` |
| `get_file_structure` | All nodes in a file with signatures | `get_file_structure({repo_name: "my-project", file_path: "src/core/auth.ts"})` |
| `get_ast_node` | Full code + dependencies + references | `get_ast_node({repo_name: "my-project", node_ids: [{mod_path: "...", pkg_path: "src/core/auth.ts", name: "AuthService"}]})` |

**Recommended Workflow:**
1. **GitNexus first** — identify relevant execution flows and module clusters
2. **ABCoder second** — get exact function signatures and type definitions
3. **Read source files** — for full context where needed
4. **Write context docs** — with real code examples from steps 2-3

### Enhanced Mode — Serena MCP

| Tool | Purpose | Example Call |
|------|---------|--------------|
| `mcp__serena__get_symbols_overview` | High-level symbol structure of a file | `mcp__serena__get_symbols_overview({relative_path: "src/auth/service.ts"})` |
| `mcp__serena__find_symbol` | Locate specific class/method/function | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` | Pattern search across codebase | `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |
| `mcp__serena__find_referencing_symbols` | Find what references a symbol | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

**Recommended Workflow:**
1. **get_symbols_overview** — understand file structure
2. **find_symbol** — locate key classes/functions
3. **search_for_pattern** — find patterns (routes, models, configs)
4. **Read source files** — for implementation details
5. **Write context docs** — with concrete examples

### Basic Mode — Built-in Tools

| Tool | Purpose |
|------|---------|
| `Read` | Read specific files |
| `Grep` | Search file contents by pattern |
| `Glob` | Find files by name pattern |

**Recommended Workflow:**
1. **Glob** — identify directory structure and file types
2. **Grep** — find framework markers and key patterns
3. **Read** — examine entry points and configuration files
4. **Write context docs** — focus on top-level structure
```

**位置**：`skills/spec-bootstrap/references/prd-template.md` 的"Tools Available"节

---

### P1 - 增强质量（提升产物价值）

#### 补丁 3：PRD Rules 中强调"产物结构可变"

**问题**：当前 prd-template.md 的 Rules 节未强调模板灵活性，worker 可能机械填充。

**方案**：在 Rules 节第 5 条后新增：

```markdown
5. **No placeholder text:** Every section must contain real project content. Delete template sections that have no evidence.
6. **Context files are NOT fixed — adapt to reality:**
   - Delete planned files that don't apply to this project
   - Create new files for project-specific patterns not covered by templates
   - Rename files if template names don't match project terminology
   - Update index.md to reflect the actual generated file set
   - Prioritize project reality over template structure
```

**位置**：`skills/spec-bootstrap/references/prd-template.md` 的"Important Rules"节

---

#### 补丁 4：验收标准加入"Anti-patterns documented"

**问题**：当前验收标准未明确要求反模式文档，pitfalls 质量无保证。

**方案**：在 Acceptance Criteria 中补充：

```markdown
### Acceptance Criteria

- [ ] All files listed in "Files to Fill" are produced and non-empty
- [ ] No file contains placeholder text like `<TODO>`, `<fill-in>`, `[TBD]`
- [ ] Each file references at least 2 specific artifacts from the actual codebase (file paths, class names, function names)
- [ ] **Anti-patterns and known pitfalls are documented with concrete examples** (for pitfalls-context and layer-context tasks)
- [ ] Files use structured Markdown (at minimum: a top-level `#` heading and two `##` sections)
- [ ] No source code was modified
- [ ] `index.md` (if produced) lists only files that were actually created
```

**位置**：`skills/spec-bootstrap/references/prd-template.md` 的"Acceptance Criteria"节

---

### P2 - 长期优化（架构层面改进）

#### 补丁 5：标准化各文档的章节结构

**问题**：除 module-map 外，其他文档无章节定义，产物格式不一致。

**方案**：为每类文档定义最小章节结构，在对应 PRD 的"Files to Fill"表格中明确：

**00-summary.md 最小结构：**
```markdown
# 项目总览

## 技术栈
- 主语言、主框架、关键依赖

## 顶层结构
- 目录组织、模块划分

## 核心职责
- 项目做什么、不做什么

## 已知限制
- 当前版本的功能边界、技术债
```

**architecture/system-overview.md 最小结构：**
```markdown
# 系统架构概览

## 整体结构
- 分层/分模块策略

## 关键架构决策
- 为什么这样设计

## 系统边界
- 与外部系统的集成点
```

**pitfalls/index.md 最小结构：**
```markdown
# 已知风险点

## 代码层风险
- 易出错的代码模式、竞态条件

## 架构层风险
- 模块耦合、循环依赖

## 业务逻辑风险
- 边界条件、权限绕过

## 历史问题热点
- 高频 Bug 区域
```

**实施方式**：在 summary-context、architecture-context、pitfalls-context 的 PRD 模板中，"Files to Fill"表格的"Description"列补充章节要求。

---

#### 补丁 6：pitfalls worker 补充发现策略

**问题**：pitfalls 是最难生成的文档，当前 PRD 无具体指引。

**方案**：在 pitfalls-context 的 PRD 模板"Technical Notes"节补充发现策略：

```markdown
## Technical Notes

### Pitfall Discovery Strategy

**Code-level signals:**
- High density of TODO/FIXME/HACK comments
- Complex conditional logic (nested if > 3 levels)
- Large functions (> 100 lines)
- Duplicated code blocks
- Missing error handling (bare try-catch, swallowed exceptions)

**Architecture-level signals:**
- Circular dependencies between modules
- God classes (> 500 lines, > 20 methods)
- Tight coupling (high fan-in/fan-out)
- Inconsistent patterns across similar modules

**Business logic signals:**
- Authentication/authorization bypass paths
- Race conditions in concurrent code
- Transaction boundary issues
- Data validation gaps

**Historical signals (if git history available):**
- Files with high churn rate
- Frequent bug fixes in specific areas
- Reverted commits

**Output format:**
For each identified pitfall, document:
- Location (file path + line range)
- Risk type (code/architecture/business/security)
- Why it's risky
- Recommended mitigation
```

**位置**：创建专门的 `pitfalls-prd-template.md`，或在 prd-template.md 中为 pitfalls-context 任务添加条件章节。

---

#### 补丁 7：澄清三个 architecture 文件的边界

**问题**：system-overview、module-map、integration-boundaries 内容边界模糊。

**方案**：在 architecture-context 的 PRD 中明确各文件职责：

```markdown
## Files to Fill

| File | Scope | What to Document | What NOT to Document |
|------|-------|------------------|---------------------|
| `architecture/system-overview.md` | 宏观架构 | 分层策略、架构风格（微服务/单体/插件化）、关键设计决策 | 具体模块列表（那是 module-map 的职责） |
| `architecture/module-map.md` | 模块清单 | 每个顶层目录/包的职责、所属层级 | 模块间调用关系（那是 integration-boundaries 的职责） |
| `architecture/integration-boundaries.md` | 集成关系 | 模块间接口、外部依赖、服务间通信协议 | 模块内部实现（那是 layer 文档的职责） |
```

**位置**：`skills/spec-bootstrap/references/prd-template.md` 中为 architecture-context 任务定制"Files to Fill"表格。

---

## 实施优先级建议

### 立即实施（P0）

1. **补丁 1**：恢复 `references/mcp-setup.md` — 外部开发者必需
2. **补丁 2**：PRD 补充 MCP 工具调用示例 — worker 执行质量关键

**预期收益**：
- 外部开发者能独立启用 Full/Enhanced 模式
- worker 知道如何正确使用 MCP 工具
- Full 模式的价值得以体现

**工作量估算**：2-3 小时（主要是移植和调整 Trellis 内容）

---

### 近期实施（P1）

3. **补丁 3**：PRD Rules 强调产物结构可变
4. **补丁 4**：验收标准加入反模式要求

**预期收益**：
- worker 产出更贴合项目实际
- pitfalls 文档质量有保证

**工作量估算**：1 小时（文案调整）

---

### 长期优化（P2）

5. **补丁 5**：标准化各文档章节结构
6. **补丁 6**：pitfalls worker 补充发现策略
7. **补丁 7**：澄清三个 architecture 文件边界

**预期收益**：
- 产物格式一致性
- pitfalls 生成质量提升
- architecture 文档职责清晰

**工作量估算**：4-6 小时（需要设计章节结构和发现策略）

---

## 补丁实施后的验证标准

### 外部开发者视角
- [ ] 能通过 mcp-setup.md 独立配置 GitNexus/ABCoder/Serena
- [ ] 能看懂 PRD 中的 MCP 工具调用示例
- [ ] 生成的文档格式在不同项目间保持一致

### Worker 执行视角
- [ ] PRD 提供了足够的工具使用指引
- [ ] 知道可以调整产物结构而不是机械填充
- [ ] pitfalls 文档有具体的发现策略可遵循

### 产物质量视角
- [ ] 每个文档有明确的章节结构
- [ ] pitfalls 文档包含反模式和具体示例
- [ ] architecture 三个文件职责不重叠

---

## 附录：Trellis 原版的其他差异（不建议移植）

以下 Trellis 特性与 spec-first 架构不兼容，不建议移植：

| Trellis 特性 | spec-first 对应 | 是否移植 |
|-------------|----------------|---------|
| Codex 并行执行 | worker subagents | ❌ 架构不同 |
| `.trellis/spec/` 产物路径 | `docs/contexts/` | ❌ 已调整 |
| Trellis task.py 脚本 | orchestrator 直接创建 PRD | ❌ 无需脚本 |
| 编码规范文档（coding guidelines） | 项目上下文文档 | ❌ 目标不同 |

---

## 总结

当前 spec-bootstrap 在移植 Trellis 时**简化了工具使用指引和 PRD 模板细节**，这对外部开发者和 worker 执行质量有负面影响。

**核心问题**：假设用户和 worker 都知道怎么用 MCP 工具，但实际上需要明确的示例和工作流指引。

**最小可行补丁**：P0 的两个补丁（mcp-setup.md + PRD 工具示例），能显著提升可用性和执行质量。
