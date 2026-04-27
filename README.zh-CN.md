# spec-first

[English](./README.md) | [简体中文](./README.zh-CN.md)

`spec-first` 是面向 Claude Code 与 Codex 的 Node.js CLI 和 workflow 资产包。它负责确定性的安装、初始化、清理、任务包校验和 readiness 事实采集；需求理解、计划取舍、实现判断和代码评审仍由 LLM 完成。

## 当前范围

`spec-first` 提供：

- CLI helpers：`doctor`、`init`、`clean`、`tasks`、版本/help 输出和确定性 setup 检查。
- `skills/`、`agents/`、`templates/` 下的 workflow source assets。
- 面向 Claude Code 与 Codex 的 host-filtered runtime 生成。
- 通过 `$spec-mcp-setup` 管理 MCP/helper readiness。
- plan、task-pack、work、review、setup、sessions、release-notes、compound 等 workflow。

内置 CRG runtime 与 graph-bootstrap workflow 已移除。当前 workflow 依赖显式 repo context、task packs、diffs、tests、直接文件读取，以及用户或宿主提供的可选工具。

## 安装

```bash
npm install -g spec-first
spec-first doctor
spec-first init --claude -u <name> --lang zh
spec-first init --codex -u <name> --lang zh
```

使用 `spec-first clean --claude` 或 `spec-first clean --codex` 删除 managed runtime assets。`.claude/`、`.codex/`、`.agents/skills/` 下的是生成副本；修改应落在 `skills/`、`agents/`、`templates/` 和 `src/cli/`。

## CRG 删除后的代码库上下文路径

内置 CRG runtime 已移除。当前 workflow 使用以下路径获取上下文：

- 用 `$spec-plan` 做设计与实施规划。
- 用 `$spec-write-tasks` 编译可执行 task packs。
- 用 `$spec-work` 基于 direct repo reads、nearby files、task packs、diffs 和 tests 执行工作。
- 用 `$spec-code-review` 基于 diff、plan/task evidence、targeted file reads 和 test results 做评审。
- 用 `$spec-mcp-setup` 只检查 MCP/helper readiness，不检查 graph readiness。

## 主要命令

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan.md>
spec-first tasks validate <task-pack.md> --json
```

## Runtime Assets

| 层级 | 当前 contract |
|---|---|
| **能力层资产** | 仓库内置源码资产共 `39` 个 skills、`51` 个 agents、`0` 个 agent support files。运行时交付会按双宿主治理过滤：当前版本在 Claude 侧安装 `18` 个 commands + `2` 个 standalone skills + `2` 个 agent-facing internal skills，在 Codex 侧安装 `18` 个 workflow skills + `2` 个 standalone skills + `2` 个 agent-facing internal skills；两侧都会安装 `51` 个 agents |
| **Claude runtime** | commands 生成到 `.claude/commands/spec`，skills 生成到 `.claude/skills`，agents 生成到 `.claude/agents`，managed state 位于 `.claude/spec-first/state.json`。 |
| **Codex runtime** | workflow skills 生成到 `.agents/skills`，agents 生成到 `.codex/agents`，managed state 位于 `.codex/spec-first/state.json`。 |
| **Readiness** | `$spec-mcp-setup` 管理 MCP/helper readiness，不报告 graph readiness。 |

Claude init 的预期输出包含：

```text
📦 Generated 18 command file(s) in .claude/commands/spec
🧩 Generated 4 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
```

## Workflow 入口

| 意图 | Claude Code | Codex |
|---|---|---|
| 需求澄清 | `/spec:brainstorm` | `$spec-brainstorm` |
| 写计划或深化计划 | `/spec:plan` | `$spec-plan` |
| 编译 task pack | 使用已安装的 `write-tasks` skill | `$spec-write-tasks` |
| 执行工作 | `/spec:work` | `$spec-work` |
| 代码评审 | `/spec:code-review` | `$spec-code-review` |
| 文档/计划评审 | `/spec:doc-review` | `$spec-doc-review` |
| MCP/helper setup | `/spec:mcp-setup` | `$spec-mcp-setup` |
| 知识沉淀 | `/spec:compound` | `$spec-compound` |

## 开发与验证

```bash
npm run typecheck
npm run test:unit
npm run test:smoke
npm run test:integration
npm run build
npm test
```

`npm run build` 执行 `npm pack --dry-run`，用于验证发布包内容。

## 设计边界

`spec-first` 保持“脚本负责确定性流程，LLM 负责语义判断”：

- 脚本负责安装、校验、生成、清理、hash 和机器事实报告。
- LLM 负责选择范围、评估 tradeoff、规划实现、执行评审判断和决定证据权重。
- source of truth 在本仓库源码资产中。生成 runtime 可丢弃，应通过 `spec-first init` 重建。
