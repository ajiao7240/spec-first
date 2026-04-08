# PRD 模板 - spec-bootstrap 上下文工人

该模板定义了每个上下文域任务契约的结构。编排器在第 2 阶段用项目专属内容填充它，并写入：

```text
.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md
```

工人只读取自己的 PRD。

---

## PRD：构建 `<context-domain>` 上下文文档

### 目标

为 `<project-name>` 项目构建 `<context-domain>` 上下文文档。

在 `docs/contexts/<slug>/` 下生成以下文件：
- `<file-path-1>`
- `<file-path-2>`

这些文件会成为项目长期存在的上下文库的一部分。

### 上下文

> 编排器用第一阶段分析中的项目专属发现填充此部分。

**项目：** `<project-name>` (`<primary-language>`)
**框架：** `<frameworks>`

**第一阶段分析的相关结果：**
- `<finding-1>`
- `<finding-2>`

### 可用工具

> 根据检测到的分析模式填写此部分。

**分析模式：[增强 | 基本]**

**--- 增强模式（Serena 可用） ---**

| 工具 | 目的 | 示例调用 |
|------|------|----------|
| `mcp__serena__get_symbols_overview` | 文件结构 | `mcp__serena__get_symbols_overview({relative_path: "src/auth.ts"})` |
| `mcp__serena__find_symbol` | 定位符号 | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` | 模式搜索 | `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |
| `mcp__serena__find_referencing_symbols` | 查找引用 | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

推荐工作流程：
1. `get_symbols_overview`
2. `find_symbol`
3. `find_referencing_symbols`
4. `search_for_pattern`
5. `Read`

**--- 基本模式（仅内置工具） ---**

| 工具 | 目的 | 示例调用 |
|------|------|----------|
| `Read` | 读取特定文件 | `Read({file_path: "src/auth.ts"})` |
| `Grep` | 按模式搜索 | `Grep({pattern: "class Auth", type: "ts"})` |
| `Glob` | 按名称查找文件 | `Glob({pattern: "src/**/*.ts"})` |

可用什么工具就用什么工具。优先使用能力更强的工具。

### 要填写的文件

| 文件 | 描述 |
|------|------|
| `docs/contexts/<slug>/<file-path>` | `<what this file should contain>` |

### 重要规则

1. 只写入“要填充的文件”中列出的文件。
2. 不要修改源代码。
3. 不要运行 git 命令。
4. 不要保留占位符文本。
5. 使用 Markdown，并使用 `##` / `###` 层级。
6. 如果生成多个文件，确保 `index.md` 与实际存在的文件一致。

### 验收标准

- [ ] “要填充的文件”中列出的所有文件均已生成且非空
- [ ] 没有占位符文本残留
- [ ] 每个文件至少引用 2 个真实代码库工件
- [ ] 文件使用结构化 Markdown
- [ ] 没有修改源代码

