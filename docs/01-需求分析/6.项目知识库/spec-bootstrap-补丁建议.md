# spec-bootstrap 补丁建议

> 基于 Trellis 原版 `cc-codex-spec-bootstrap` 的对比分析，识别当前 spec-first 版本的缺失内容和改进方向。
>
> **2026-04-03 代码审查更新**：本文档写于 MCP-first 改造之前。MCP-first 改造实施后（feat: 实现 MCP-first 改造 5 个 Unit），部分分析前提已失效，已更新各补丁状态。

---

## 对比总结

| 维度 | Trellis 原版 | spec-first 当前版 | 差距 | 当前状态 |
| --- | ----------- | ---------------- | ---- | ------- |
| 工具安装指引 | 完整的 `references/mcp-setup.md` | `/spec:mcp-setup` 独立技能 + SKILL.md Tool Usage Guide | — | ✅ 已解决（方式不同） |
| PRD 工具使用模板 | 具体调用示例 + 推荐工作流 | 抽象工具列表，无示例 | worker 不知道怎么用 MCP 工具 | ❌ 仍然存在 |
| 产物结构灵活性 | 明确"Spec files are NOT fixed"原则 | Rule 5 有覆盖但粒度不足 | worker 可能机械填充 | ⚠️ 部分解决 |
| 验收标准 | 要求"Anti-patterns documented" | 未明确要求反模式文档 | pitfalls 质量无保证 | ❌ 仍然存在 |

---

## 补丁清单

### P0 - 立即补充（影响外部开发者可用性）

#### ~~补丁 1：恢复 `references/mcp-setup.md`~~ ✅ 已解决

> **2026-04-03 审查**：本补丁的前提（"SKILL.md 只检测可用性，不提供安装指引"）已不成立，**无需实施**。

**已解决路径**：MCP-first 改造以更好的方式解决了这个问题：

- `skills/mcp-setup/SKILL.md` — 完整的 4-Phase 安装技能（依赖检测→安装→配置合并→验证）
- `skills/spec-bootstrap/SKILL.md` L34-68 — "MCP Tools Setup" 节，明确指向 `/spec:mcp-setup quick`
- `skills/spec-bootstrap/SKILL.md` L69-120 — "Tool Usage Guide"，含三种工具的调用表格+工作流

用一个独立技能替代参考文件，比原方案更好（安装逻辑可独立演进，关注点分离）。

**不再需要创建 `references/mcp-setup.md`。**

**职责边界（建议在文档中收紧表述）**：

- `mcp-setup`：负责工具安装 + MCP server 注册（写入 `~/.claude.json`）+ 宿主标记（`host-setup.json`）
- `spec-bootstrap`：负责项目级 readiness probe + ABCoder parse + 上下文资产生成

两者不共享职责，mcp-setup 不感知任何目标项目，spec-bootstrap 不做任何工具安装。

---

#### 补丁 2：PRD 模板补充 MCP 工具调用示例

**状态**：❌ 仍然存在

**问题**：`references/prd-template.md` 的"Tools Available"节只列工具名，没有调用格式和推荐工作流。

**影响路径**：

```text
orchestrator 读 SKILL.md（有示例）
   → 用 prd-template.md 填充 PRD
   → template 格式只有工具名，未引导 orchestrator 写入示例
   → worker subagent 读 PRD → 无调用示例可参考
```

虽然 SKILL.md 现在有完整的 Tool Usage Guide（L69-120），但 **worker subagent 只读 PRD，不读 SKILL.md**。prd-template.md 未引导编排器把示例写进 PRD，导致 worker 执行质量仍存在风险。

**方案**：在 prd-template.md 的"Tools Available"节替换为带示例的表格格式：

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

**附 1：ABCoder 调用链不一致**

`prd-template.md:53` 写的是 `list_repos → get_repo_structure → get_package_structure → get_ast_node`，但 `SKILL.md:96-107` 的表格是 `list_repos → get_repo_structure → get_file_structure → get_ast_node`（`get_file_structure` 而非 `get_package_structure`）。替换 Tools Available 节时一并修正为 `get_file_structure`。

**附 2：SKILL.md Tool Usage Guide 工具清单不完整**

SKILL.md Tool Usage Guide（L71-119）只列了 GitNexus 3 个工具 + Serena 3 个工具，但实际 MCP server 提供更多工具。以下对上下文生成有直接价值的工具被遗漏：

- `gitnexus_impact`：分析变更影响范围（blast radius），对 pitfalls/architecture 分析有直接价值。GitNexus 实际提供 7 个工具（query, context, impact, detect_changes, rename, cypher, list_repos），SKILL.md 只列了 3 个。
- `mcp__serena__find_referencing_symbols`：找到引用某符号的所有位置，对理解依赖关系有直接价值。当前 prd-template.md:62 已列出此工具，但 SKILL.md 未列。

**前置要求**：替换 prd-template.md Tools Available **之前**，须先更新 SKILL.md Tool Usage Guide，将上述两个工具补入。prd-template.md 的内容严格从 SKILL.md 复制，不超出其工具范围。

**位置**：`skills/spec-bootstrap/references/prd-template.md` 的"Tools Available"节（prd-template.md），`skills/spec-bootstrap/SKILL.md` L71-119（SKILL.md，前置更新）

---

### P1 - 增强质量（提升产物价值）

#### 补丁 3：编排器 Phase 2 动态决定 Files to Fill + 多点一致性

**状态**：❌ 修复方向需调整（影响面比原提案大）

**问题**：文件级灵活性（可跳过 planned files、可新建额外文件）原本不应该下放给 worker。原因：

- `prd-template.md:105`：AC 第一条要求 "All files listed in Files to Fill are produced and non-empty"
- `SKILL.md:503`：dispatch contract 明确 `ownership_boundary: only the files listed in Files to Fill`

在通用 Rule 5 加"可删文件/可新建/可重命名"，会直接和 AC 与 contract 冲突，worker 会陷入矛盾指令。

**已有覆盖**：`prd-template.md` Rule 5 和 `SKILL.md:619` 已允许 worker 在 section 级别灵活处理。section 级灵活性足够，不需要扩展到文件级。

**预存矛盾**：SKILL.md 自身存在一处未被识别的矛盾——`L619-621` "Context Files Are Not Fixed" 给了 worker 文件级跳过权（"If a planned file has no meaningful content, the worker should skip it"），与 `L608` Completion Checklist "All fixed-task files produced and non-empty" 直接冲突。本补丁需一并修复。

**正确修复层**：编排器的 **Phase 2**（创建 PRD 时）。编排器在了解项目实际结构后，应动态决定每个 worker 的 Files to Fill 列表——对于与项目无关的文档，直接从 Files to Fill 中省略，而不是写进去再让 worker 跳过。

**影响面（6 处需同步修改）**：

| 位置 | 当前语义 | 需修改为 |
| --- | --- | --- |
| Phase 2.1 Fixed Tasks 表（L414-420） | architecture-context 固定产出 3 文件 | integration-boundaries.md 标注为条件产物 |
| Phase 2.4 PRD Content（L453-464） | 无动态裁剪指引 | 追加 Files to Fill 动态策略子章节 |
| Phase 3.4 Assembly README（L571） | 硬编码 "system structure, module map, integration boundaries" | 改为动态描述，根据实际产出文件生成 |
| Phase 3.5 Execution Summary（L590） | 硬编码 `architecture/ (3 files)` | 改用实际产出文件列表和动态计数 |
| Completion Checklist（L608） | "All fixed-task files produced" | 改为 "All PRD-listed Files to Fill produced" |
| L619-621 "Context Files Are Not Fixed" | 给 worker 文件级跳过权 | 收紧为 section 级灵活性（文件级决策由编排器负责） |

**方案**：

1. 在 Phase 2.1 Fixed Tasks 表中，`architecture-context` 的 Produces 列标注 `integration-boundaries.md`（条件：项目有外部集成点时创建）。
2. 在 `SKILL.md` Phase 2.4 节追加 Files to Fill 动态策略：

```markdown
### 2.4 PRD Content — Files to Fill 动态策略

编排器根据 Phase 1 的分析结果，决定每个 worker 的 Files to Fill：

- 对 architecture-context：若项目无明显外部集成点，可省略 integration-boundaries.md
- 对 layer-context：若该层代码极少（< 3 个文件），可合并进 00-summary.md，不单独建 worker
- 原则：Files to Fill 只列编排器有把握能生成高质量内容的文件；宁可省略，不要产出空壳文档
```

3. Phase 3.4 Assembly README 模板的 Architecture 描述行改为动态——根据实际产出文件生成描述（如省略 integration-boundaries.md 则不提及 "integration boundaries"）。
4. Phase 3.5 Execution Summary 模板改为动态文件列表（不硬编码文件数）。
5. Completion Checklist L608 改为 "All PRD-listed Files to Fill produced and non-empty"。
6. L619-621 收紧为："Workers must adapt **section content** to the real project. If a planned section has no meaningful content, skip it and note why. File-level decisions (which files to create) are the orchestrator's responsibility."

**位置**：`skills/spec-bootstrap/SKILL.md` Phase 2.1 + Phase 2.4 + Phase 3.4 + Phase 3.5 + Completion Checklist + "Context Files Are Not Fixed" 节

---

#### 补丁 4：pitfalls-context PRD 注入 task-specific AC

**状态**：❌ 修复方向需调整

**问题**：pitfalls 类产物质量无保证，需要明确的验收条件。但 `prd-template.md` 是所有非 database 任务（summary、architecture、pitfalls、layer...）的基模板（`SKILL.md:455`），在通用 AC 加"Anti-patterns documented"会让 summary-context、architecture-context 的 worker 也被这条卡住，而这两类任务本来不负责记录反模式。

**正确修复层**：编排器 **Phase 2** 在为 pitfalls-context（以及 layer-context）创建 PRD 时，注入 task-specific AC 条目，而不是污染通用模板。

**方案**：在 `SKILL.md` Phase 2.4 节补充：

```markdown
### 2.4 PRD Content — Task-specific Acceptance Criteria 注入规则

编排器在填写 PRD 的 Acceptance Criteria 节时，根据任务类型追加专项条目：

**pitfalls-context / layer-context 追加：**
- [ ] Each documented pitfall includes: location (file + line range), risk type, why risky, recommended mitigation
- [ ] At least 3 concrete anti-patterns documented with real code examples from the codebase

其他任务类型（summary、architecture、guides）使用通用 Acceptance Criteria，不追加专项条目。
```

> **注意**：database-context 不经过 Phase 2.4（`SKILL.md:453` 明确 2.4 只服务 non-database tasks）。database 走 Phase 2.3 + `references/database-prd-template.md` 独立模板。database 的专项 AC（凭证保护、Mermaid erDiagram）应在 `database-prd-template.md` 中直接验证是否已覆盖，不在 2.4 注入。

**位置**：`skills/spec-bootstrap/SKILL.md` Phase 2.4 节（与补丁 3 合并到同一节）

---

#### 补丁 6：为各文档提供推荐骨架（非强制 schema）

**状态**：❌ 修复方向需调整（原为 P2，重新评估后升为 P1）

**问题**：除 module-map 外，其他文档无章节参考，产物格式因人而异。

**约束**：`prd-template.md:95` Rule 5 和 `SKILL.md:619` 明确鼓励 worker 按项目现实删减和增补。将章节结构硬编进通用模板会与"Context files are not fixed"原则冲突，不能作为强制 schema。

**方案**：以**推荐骨架**形式写入编排器为各任务创建 PRD 时的 Technical Notes 节，而非 Files to Fill 或 Rules 节。骨架是参考起点，worker 可以自由增删。

**编排器注入的推荐骨架（Technical Notes）：**

*summary-context：*

```markdown
**Suggested structure for 00-summary.md** (adapt freely):
- ## 技术栈 — 主语言、主框架、关键依赖
- ## 顶层结构 — 目录组织、模块划分
- ## 核心职责 — 项目做什么、不做什么
- ## 已知限制 — 当前版本功能边界、技术债（如无证据可省略）
```

*architecture-context：*

```markdown
**Suggested structure** (adapt freely):
- system-overview.md: ## 整体结构 / ## 关键架构决策 / ## 系统边界
- module-map.md: 每个顶层目录一行，格式：`目录/ — 一句话职责`
- integration-boundaries.md: ## 模块间接口 / ## 外部依赖 / ## 通信协议
```

*pitfalls-context：*

```markdown
**Suggested structure** (adapt freely):
- ## 代码层风险 — TODO/FIXME 密集区、复杂条件逻辑、裸 catch
- ## 架构层风险 — 循环依赖、God class、高耦合
- ## 业务逻辑风险 — 权限绕过路径、竞态、事务边界
- ## 历史热点 — 高频改动文件（如有 git history）
```

**位置**：`skills/spec-bootstrap/SKILL.md` Phase 2.4 节，编排器填写 Technical Notes 的说明中

---

### P1 - 新增（代码审查发现）

#### 补丁 5：修复 `mcp-setup/SKILL.md` 的 `user-invocable` 矛盾

**状态**：✅ 已解决（2026-04-03）

`user-invocable: false` 已从 `skills/mcp-setup/SKILL.md` frontmatter 删除。`.claude/skills/mcp-setup/SKILL.md`（运行时副本）同步更新。

**佐证**：`plugin.json:63-68` 将 mcp-setup 注册为可调用命令，进一步确认该字段的矛盾是真实存在的，删除是正确修复。

---

### P2 - 长期优化（架构层面改进）

#### 补丁 7：pitfalls worker 补充发现策略

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

**位置**：`skills/spec-bootstrap/SKILL.md` Phase 2 中 pitfalls-context PRD 创建说明附近

---

#### 补丁 8：澄清三个 architecture 文件的边界

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

**位置**：`skills/spec-bootstrap/SKILL.md` Phase 2 中 architecture-context PRD 创建说明附近

---

## 实施优先级建议

### 立即实施（P0）

1. **补丁 2**：替换 prd-template.md 的 Tools Available 节，补充调用示例 + 推荐工作流，同步修正 ABCoder 调用链（`get_file_structure` 替换 `get_package_structure`）

**预期收益**：

- worker 知道如何正确调用 MCP 工具
- Full/Enhanced 模式的分析深度得以体现

**工作量估算**：1-2 小时

---

### 近期实施（P1）

1. **补丁 3**：在 `SKILL.md` Phase 2.4 节补充编排器动态 Files to Fill 策略
2. **补丁 4**：在 `SKILL.md` Phase 2.4 节补充 task-specific AC 注入规则（pitfalls/layer/database）
3. **补丁 6**：在 `SKILL.md` Phase 2.4 节补充各任务类型的推荐骨架（Technical Notes 注入）

**说明**：补丁 3/4/6 都落在 `SKILL.md` Phase 2.4 节，可合并为一次编辑。

**预期收益**：

- 编排器生成的 PRD 更精准（Files to Fill 按项目裁剪）
- pitfalls 产物有明确验收标准
- worker 有骨架参考但不被强制约束

**工作量估算**：1-2 小时

---

### 长期优化（P2）

1. **补丁 7**：pitfalls-context PRD 补充发现策略（Technical Notes）
2. **补丁 8**：澄清三个 architecture 文件的内容边界

**预期收益**：

- pitfalls 生成质量提升
- architecture 文档职责清晰

**工作量估算**：2-3 小时

---

## 补丁实施后的验证标准

### 外部开发者视角

- [ ] 能通过 `/spec:mcp-setup` 独立配置 GitNexus/ABCoder/Serena
- [ ] 能看懂 PRD 中的 MCP 工具调用示例
- [ ] 生成的文档格式在不同项目间保持一致

### Worker 执行视角

- [ ] PRD 提供了足够的工具使用指引（含调用示例）
- [ ] 知道可以在 section 级别自由增删内容（文件级决策由编排器负责）
- [ ] pitfalls 文档有具体的发现策略可遵循

### 产物质量视角

- [ ] 每个文档有明确的章节结构
- [ ] pitfalls 文档包含反模式和具体示例
- [ ] architecture 三个文件职责不重叠

---

## 附录：Trellis 原版的其他差异（不建议移植）

以下 Trellis 特性与 spec-first 架构不兼容，不建议移植：

| Trellis 特性 | spec-first 对应 | 是否移植 |
| ----------- | -------------- | ------- |
| Codex 并行执行 | worker subagents | ❌ 架构不同 |
| `.trellis/spec/` 产物路径 | `docs/contexts/` | ❌ 已调整 |
| Trellis task.py 脚本 | orchestrator 直接创建 PRD | ❌ 无需脚本 |
| 编码规范文档（coding guidelines） | 项目上下文文档 | ❌ 目标不同 |
| `references/mcp-setup.md` | `/spec:mcp-setup` 独立技能 | ❌ 已用更好方式解决 |

---

## 总结

MCP-first 改造实施后，补丁 1（工具安装指引）和补丁 5（user-invocable 矛盾）均已解决。

**当前最关键问题**：补丁 2（PRD 工具调用示例缺失）——worker subagent 只读 PRD，而 prd-template.md 的 Tools Available 节只有工具名，没有调用示例，导致 worker 执行时缺乏指引。同时存在 ABCoder 调用链写法不一致（`get_package_structure` vs `get_file_structure`）需一并修正。

**关键架构认知**：补丁 3/4/6 的正确修复层是**编排器 Phase 2**（填写 PRD 时的动态注入），而不是通用模板。把文件级灵活性或 task-specific 条件下放给 worker 会制造矛盾指令；由编排器在 PRD 创建时按任务类型注入，才符合现有 contract 设计。

**最小可行补丁**：补丁 2（P0，1-2 小时）+ 补丁 3/4/6 合并编辑（P1，1-2 小时）。
