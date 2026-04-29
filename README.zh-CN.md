# spec-first

[English](./README.md) | [简体中文](./README.zh-CN.md)

`spec-first` 是面向 Claude Code 与 Codex 的 Node.js CLI 和 workflow 资产包。它负责确定性的安装、初始化、清理、任务包校验和 readiness 事实采集；需求理解、计划取舍、实现判断和代码评审仍由 LLM 完成。

## 当前范围

`spec-first` 提供：

- CLI helpers：`doctor`、`init`、`clean`、`tasks`、版本/help 输出和确定性 setup 检查。
- `skills/`、`agents/`、`templates/` 下的 workflow source assets。
- 面向 Claude Code 与 Codex 的 host-filtered runtime 生成。
- 通过当前宿主的 setup workflow 管理 required harness runtime setup，覆盖 MCP servers、graph-provider MCP servers、helper CLIs 和项目 setup facts。
- 通过当前宿主的 graph bootstrap workflow 编译 external graph readiness，产出供下游 workflow 使用的 canonical graph / impact readiness artifacts。
- ideation、brainstorm、plan、task-pack handoff、work、debug、review、setup、update、sessions、Slack research、release notes、compound、optimize 和 browser-visible polish 等公开 workflow 入口。

图谱上下文由 setup workflow 配置 external graph providers，再由 graph bootstrap workflow 编译为 canonical readiness artifacts。

## 安装

```bash
npm install -g spec-first
spec-first doctor
spec-first init --claude -u <name> --lang zh
spec-first init --codex -u <name> --lang zh
```

按实际使用的宿主运行 init：只用 Claude Code 就只跑 `--claude`，只用 Codex 就只跑 `--codex`；同一个 repo 需要同时支持两个宿主时才两个都跑。

使用 `spec-first clean --claude` 或 `spec-first clean --codex` 删除 managed runtime assets。`.claude/`、`.codex/`、`.agents/skills/` 下的是生成副本；修改应落在 `skills/`、`agents/`、`templates/` 和 `src/cli/`。

## 上下文与 Graph Readiness

当前上下文与 graph readiness 使用以下路径：

- 用当前宿主的 setup workflow 安装并验证 required harness runtime：Serena、Sequential Thinking、Context7、GitNexus、code-review-graph、`agent-browser`、`gh`、`jq`、`vhs`、`silicon`、`ffmpeg`、`ast-grep` 和 global `ast-grep` skill。
- 在 setup 报告 `baseline_ready=true` 后运行当前宿主的 graph bootstrap workflow。它读取 setup-owned config facts，校验 provider command arrays，临时运行 GitNexus/code-review-graph probes，并写入 `.spec-first/graph/*`、`.spec-first/providers/*` 和 `.spec-first/impact/*` readiness artifacts。
- 当前宿主的 plan workflow 是当前阶段第一个 graph-readiness consumer。它会报告 graph 状态、检查 freshness，并在 facts 缺失、blocked、stale 或 degraded 时退回 bounded direct repo reads。
- 在父 workspace 下存在多个 child Git repos 时，setup/bootstrap 脚本必须显式传 `--repo <child>`。父 workspace 只报告候选 repo，不拥有 repo-local `.spec-first/config/*`、`.spec-first/graph/*`、`.spec-first/impact/*` 或 `.serena/*` 产物。
- 用已安装的 standalone `write-tasks` skill 做确定性的 task-pack handoff，再让当前宿主的 work、code-review 和 doc-review workflow 基于当前请求、plans/task packs、diffs、targeted file reads 与 tests 确定 scope authority。

## 主要命令

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan-path> [--json]
spec-first tasks validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]
```

## Runtime Assets

| 层级 | 当前 contract |
|---|---|
| **能力层资产** | 仓库内置源码资产共 `39` 个 skills、`51` 个 agents、`0` 个 agent support files。运行时交付会按双宿主治理过滤：当前版本在 Claude 侧安装 `18` 个 commands + `2` 个 standalone skills + `2` 个 agent-facing internal skills，在 Codex 侧安装 `18` 个 workflow skills + `2` 个 standalone skills + `2` 个 agent-facing internal skills；两侧都会安装 `51` 个 agents |
| **Claude runtime** | commands 生成到 `.claude/commands/spec`，standalone 与 agent-facing internal skills 生成到 `.claude/skills`，command-backed workflow skill 副本生成到 `.claude/spec-first/workflows`，agents 生成到 `.claude/agents`，managed state 位于 `.claude/spec-first/state.json`。 |
| **Codex runtime** | workflow、standalone 与 agent-facing internal skills 生成到 `.agents/skills`，agents 生成到 `.codex/agents`，managed state 位于 `.codex/spec-first/state.json`。 |
| **Readiness** | setup workflow 写 readiness ledger v2 以及 setup-owned `graph-providers.json`、`runtime-capabilities.json`、`provider-artifacts.json`；graph bootstrap workflow 消费这些事实并写 canonical graph facts、provider status、impact capabilities 和 report。 |

Claude init 的预期输出包含：

```text
📦 Generated 18 command file(s) in .claude/commands/spec
🧩 Generated 4 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
下一步:
  1. 重启 Claude Code 或新开会话，让宿主加载刚生成的 /spec:* commands。
  2. 在新会话运行 /spec:mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 /spec:mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 /spec:graph-bootstrap。
```

Codex init 的预期输出包含：

```text
🧩 Generated 22 skill directory(ies) in .agents/skills
🤖 Generated 51 agent file(s) in .codex/agents
下一步:
  1. 重启 Codex 或新开会话，让宿主加载刚生成的 $spec-* skills。
  2. 在新会话运行 $spec-mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 $spec-mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 $spec-graph-bootstrap。
```

## Workflow 入口

| 意图 | Claude Code | Codex |
|---|---|---|
| required harness runtime setup | `/spec:mcp-setup` | `$spec-mcp-setup` |
| 编译 graph readiness facts | `/spec:graph-bootstrap` | `$spec-graph-bootstrap` |
| 更新 spec-first 或 runtime assets | `/spec:update` | `$spec-update` |
| 搜索 agent session 历史 | `/spec:sessions` | `$spec-sessions` |
| 研究 Slack 组织上下文 | `/spec:slack-research` | `$spec-slack-research` |
| 生成并评估想法 | `/spec:ideate` | `$spec-ideate` |
| 需求澄清 | `/spec:brainstorm` | `$spec-brainstorm` |
| 文档/计划评审 | `/spec:doc-review` | `$spec-doc-review` |
| 写计划或深化计划 | `/spec:plan` | `$spec-plan` |
| 编译 task pack | 使用已安装的 standalone `write-tasks` skill | 使用已安装的 standalone `write-tasks` skill |
| 调试失败或 bug | `/spec:debug` | `$spec-debug` |
| 执行工作 | `/spec:work` | `$spec-work` |
| 使用 Codex delegation beta 执行工作 | `/spec:work-beta` | `$spec-work-beta` |
| 优化可度量目标 | `/spec:optimize` | `$spec-optimize` |
| polish browser-visible UI beta | `/spec:polish-beta` | `$spec-polish-beta` |
| 代码评审 | `/spec:code-review` | `$spec-code-review` |
| 知识沉淀 | `/spec:compound` | `$spec-compound` |
| 刷新过期知识沉淀 | `/spec:compound-refresh` | `$spec-compound-refresh` |
| 查看 release notes | `/spec:release-notes` | `$spec-release-notes` |

当 managed Claude hook 或 Codex 顶层 workflow-entry guidance 展示启动版本提醒时，
提醒只会指向上表中的 update 入口；它不会安装包、刷新 runtime assets 或重启宿主。

## 开发与验证

```bash
npm run typecheck
npm run test:mcp-setup
npm run test:graph-bootstrap
npm run test:unit
npm run test:smoke
npm run test:integration
npm run test:ai-dev:gate
npm run test:release
npm run build
npm test
```

`npm run build` 执行 `npm pack --dry-run`，用于验证发布包内容。

## 相关文档

详细手册和实施文档均以中文为主。

- [架构总览](./docs/02-架构设计/01-整体架构.md)
- [开发规范](./docs/03-实施方案/06-开发规范.md)
- [测试方案](./docs/03-实施方案/04-测试方案.md)
- [版本更新记录](./docs/08-版本更新/README.md)

## 设计边界

`spec-first` 保持“脚本负责确定性流程，LLM 负责语义判断”：

- 脚本负责安装、校验、生成、清理、hash 和机器事实报告。
- LLM 负责选择范围、评估 tradeoff、规划实现、执行评审判断和决定证据权重。
- source of truth 在本仓库源码资产中。生成 runtime 可丢弃，应通过 `spec-first init` 重建。
