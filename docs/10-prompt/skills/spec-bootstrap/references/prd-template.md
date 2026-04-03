# PRD 模板 —spec-bootstrap Context Worker

该模板定义了每个上下文域任务契约的结构。编排器（主 Claude 实例）在第 2 阶段使用特定于项目的内容填充此模板，并将其写入：
```
.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md
```
工人只阅读自己的 PRD。他们不读取其他任务的 PRD。

---

## PRD：构建 `<context-domain>` 上下文文档

### 目标

为 `<project-name>` 项目构建 `<context-domain>` 上下文文档。

在`docs/contexts/<slug>/`下生成以下文件：
- `<file-path-1>`
- `<file-path-2>`

这些文件成为项目长期存在的上下文库的一部分。它们不是临时的——将它们视为持久的文档资产。

---

### 上下文

> 协调器用第一阶段分析中的项目特定结果填充此部分。
> 包括：语言/框架堆栈、相关模块边界、关键模式、架构决策。
> 具体 — 粘贴实际的目录名称、文件名称、框架名称和观察到的模式。

**项目：** `<project-name>` (`<primary-language>`)
**框架：** `<frameworks>`
**与该领域相关的关键模块：**
```
<paste relevant directory tree or module list>
```
**第一阶段分析的相关结果：**
- `<finding-1>`
- `<finding-2>`

---

### 可用工具

> 协调器根据检测到的分析模式填充此部分。
> 仅包含与检测到的模式匹配的块。

**分析模式：[完整|增强|基本]**

**--- 完整模式（GitNexus + ABCoder 可用） ---**

|工具|目的|示例调用 |
|------|---------|-------------|
| `gitnexus_query` |查找执行流程 | `gitnexus_query({query: "authentication flow"})` |
| `gitnexus_context` | 360° 符号视图 | `gitnexus_context({name: "AuthService"})` |
| `gitnexus_cypher` |图形查询 | `gitnexus_cypher({query: "MATCH (n:Class) RETURN n.name LIMIT 20"})` |
| `gitnexus_impact` |爆炸半径分析| `gitnexus_impact({target: "UserModel", direction: "downstream"})` |

|工具|层 |目的|示例调用 |
|------|--------|---------|-------------|
| `mcp__abcoder__list_repos` | 1 |列出已解析的存储库 | `list_repos()` |
| `mcp__abcoder__get_repo_structure` | 2 |文件/包列表 | `get_repo_structure({repo_name: "my-project"})` |
| `mcp__abcoder__get_file_structure` | 3 |文件中的节点 | `get_file_structure({repo_name: "my-project", file_path: "src/auth.ts"})` |
| `mcp__abcoder__get_ast_node` | 4 |完整代码 + 依赖 | `get_ast_node({repo_name: "my-project", node_ids: [...]})` |

推荐工作流程：
1. `gitnexus_query` — 识别相关流和集群
2. `gitnexus_context` / `gitnexus_impact` — 获取符号上下文和爆炸半径
3. `mcp__abcoder__list_repos` → `get_repo_structure` → `get_file_structure` → `get_ast_node` — 深入了解签名和依赖项
4. `Read` — 需要时阅读完整源代码

**--- 增强模式（Serena 可用）---**|工具|目的|示例调用 |
|------|---------|-------------|
| `mcp__serena__get_symbols_overview` |文件结构 | `mcp__serena__get_symbols_overview({relative_path: "src/auth.ts"})` |
| `mcp__serena__find_symbol` |定位符号 | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` |模式搜索| `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |
| `mcp__serena__find_referencing_symbols` |查找参考资料 | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

推荐工作流程：
1. `get_symbols_overview` — 了解文件结构
2. `find_symbol` — 定位目标类/方法
3. `find_referencing_symbols` — 查找呼叫者/家属
4. `search_for_pattern` — 跨代码库模式搜索
5. `Read` — 需要时的完整源代码

**--- 基本模式（仅限内置工具） ---**

|工具|目的|示例调用 |
|------|---------|-------------|
| `Read` |读取特定文件 | `Read({file_path: "src/auth.ts"})` |
| `Grep` |按模式搜索 | `Grep({pattern: "class Auth", type: "ts"})` |
| `Glob` |按名称查找文件 | `Glob({pattern: "src/**/*.ts"})` |

推荐工作流程：
1. `Glob` — 查找候选文件
2. `Grep` — 搜索模式
3. `Read` — 阅读全文
4. `Grep` — 遵循参考文献

使用任何可用的工具。如果存在的话，更喜欢使用更高功能的工具。

---

### 要填写的文件

您独家拥有以下文件。不要写入任何其他文件。

|文件|描述 |
|------|-------------|
| `docs/contexts/<slug>/<file-path>` | `<what this file should contain>` |**每个文件的内容要求：**
- 必须包含特定于项目的内容 - 而不是占位符文本或通用描述
- 必须引用实际文件路径、类名或代码库中观察到的模式
- 必须包含结构化部分（## 标题）
- 如果项目允许，可以添加本模板中未包含的部分
- 如果不存在相关证据，可能会跳过计划的小节（请说明原因）

---

### 重要规则

1. **文件所有权严格：** 只能写入上面“要填充的文件”中列出的文件。不要触及其他上下文文件、源代码文件或任务 PRD。
2. **不更改源代码：** 自由阅读源代码进行分析。切勿修改它。
3. **无 git 命令：** 不要运行 `git add`、`git commit`、`git push` 或任何其他 git 命令。
4. **无占位符文本：** 每个部分都必须包含真实的项目内容。删除模板中没有证据的部分。
5. **上下文文件不固定：** 使模板适应项目。删除不适用的部分。为特定于项目的模式添加新部分。
6. **格式：** Markdown。对顶级部分使用 `## H2`，对子部分使用 `### H3`。代码示例和文件路径的代码块。
7. **index.md 对齐：** 如果生成多个文件，请确保 `index.md` 链接到实际生成的文件。
8. **时间限制：** 在 20 分钟内完成指定的文件。如果分析范围太大，请优先考虑广度（涵盖摘要深度的所有主要模块）而不是深度（详尽的每个文件分析）。

---

### 验收标准- [ ] “要填充的文件”中列出的所有文件均已生成且非空
- [ ] 没有文件包含占位符文本，例如 `<TODO>`、`<fill-in>`、`[TBD]` 或没有内容的模板节标题
- [ ] 每个文件至少引用实际代码库中的 2 个特定工件（文件路径、类名、函数名、配置键）
- [ ] 文件使用结构化 Markdown（至少：一个顶级 `#` 标题和两个 `##` 部分）
- [ ] 未修改源代码
- [ ] `index.md`（如果生成）仅列出实际创建的文件

### 自检

在报告完成之前，请验证：

- 所有拥有的文件均存在且非空
- 不再保留 `<TODO>`、`<fill-in>` 或 `[TBD]` 等占位符标记
- 每个文件都引用真实的代码库工件，而不是通用描述
- 没有修改源代码
- `index.md` 仅链接到实际存在的文件

如果任何检查失败，请先修复文件，然后才报告完成情况

---

### 技术说明

> 协调器用特定于项目的约定填充此部分。

- **文件命名约定：** `<observed conventions>`
- **已知模式：** `<patterns to be aware of>`
- **记录反模式：** `<if known>`
- **特定于框架的注释：** `<relevant framework quirks>`

---

*此 PRD 是一次性任务合同。它不与后续代码更改保持同步。*

## 示例 — 填充 PRD

> 从真实的 `spec-bootstrap` 运行中脱敏。名称是匿名的，但路径格式和符号模式是真实的。

### 目标

为 `<project>` 项目构建 `summary-context` 文档。

生产：
- `docs/contexts/<slug>/00-summary.md`

### 上下文

**项目：** `<project>` (`JavaScript`)
**框架：** `Node.js CLI`
**与该领域相关的关键模块：**
```text
src/cli/
  ├── commands/init.js
  ├── commands/doctor.js
  ├── plugin.js
  └── developer.js
skills/spec-bootstrap/
  ├── SKILL.md
  └── references/prd-template.md
```
**第一阶段分析的相关结果：**
- `src/cli/plugin.js` 导出 `syncSkills()` 和 `syncAgents()` 用于运行时资产安装
- `src/cli/adapters/base.js` 定义 `PlatformAdapter`，并且 `src/cli/adapters/claude.js` / `src/cli/adapters/codex.js` 实现特定于平台的行为

### 可用工具

**分析模式：增强**

- `mcp__serena__get_symbols_overview`
- `mcp__serena__find_symbol`
- `mcp__serena__search_for_pattern`
- `Read`
- `Grep`
- `Glob`

### 要填写的文件

|文件|描述 |
|------|-------------|
| `docs/contexts/<slug>/00-summary.md` |项目概述、堆栈和顶层结构 |

### 技术说明

- 使用存储库的实际命令/模块名称，而不是通用占位符
- 描述堆栈时参考具体配置键或导出函数
- 保持文档简短、具体且持久
