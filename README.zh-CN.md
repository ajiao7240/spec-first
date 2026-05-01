# spec-first

[![npm version](https://img.shields.io/npm/v/spec-first.svg)](https://www.npmjs.com/package/spec-first)
[![license](https://img.shields.io/npm/l/spec-first.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/spec-first.svg)](./package.json)
[![CI](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml/badge.svg)](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml)
[![docs](https://img.shields.io/badge/docs-spec--first.cn-0b7285.svg)](http://spec-first.cn/)

[English](./README.md) | [简体中文](./README.zh-CN.md)

面向 Claude Code 与 Codex 的 spec-driven AI engineering workflows。

`spec-first` 帮助团队把 AI coding 会话变成可复用的工程闭环：需求澄清、计划编写、任务包编译、执行开发、代码评审、问题调试和知识沉淀。

它让脚本负责确定性的安装、生成、校验和事实采集；让 LLM 负责需求理解、方案取舍、实现判断和评审决策。

官网：[spec-first.cn](http://spec-first.cn/)

## 90 秒看懂

![spec-first workflow flow](./docs/assets/readme/spec-first-flow.svg)

```text
模糊想法
  -> $spec-brainstorm 或 /spec:brainstorm
  -> docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md
  -> $spec-plan 或 /spec:plan
  -> docs/plans/YYYY-MM-DD-NNN-topic-plan.md
  -> $spec-work 或 /spec:work
  -> 代码、测试和验证记录
  -> $spec-code-review 或 /spec:code-review
  -> 结构化 findings 和 residual risks
```

重点不是再提供一组 prompt 片段，而是让每次 AI coding 会话都留下项目内可复用的工程上下文。

## 一个小例子

在当前宿主会话中输入：

```text
$spec-brainstorm "Improve onboarding for first-time CLI users"
```

Claude Code 用户可改用 `/spec:brainstorm "Improve onboarding for first-time CLI users"`。

一条完整 workflow 链路可能留下这些产物：

```text
docs/brainstorms/2026-05-01-001-cli-onboarding-requirements.md
docs/plans/2026-05-01-001-feat-cli-onboarding-plan.md
docs/tasks/2026-05-01-001-feat-cli-onboarding-tasks.md
```

第一次 brainstorm 通常只生成 requirements brief。plan、task-pack、work、review、debug 和 compound 入口会在你继续推进链路时分别写入各自职责内的产物。

完整走查见 [首次工作流走查](./docs/05-用户手册/09-首次工作流走查.md)。

## 为什么使用 spec-first？

AI coding 最大的问题通常不是 agent 不会写代码，而是关键判断只停留在聊天窗口里：下一次会话缺上下文，reviewer 看不到计划为什么变化，团队也很难复用一次成功经验。

`spec-first` 给这些工作一个轻量结构：

- requirements 变成持久 brief，而不是会话里消失的 prompt。
- plans 和 task packs 把模糊意图变成可评审、可执行的上下文。
- work、review、debug 和 compound workflows 会沉淀证据与经验。
- 脚本准备事实和 runtime assets；LLM 决定范围、取舍、实现策略和评审证据。
- 一套 source assets 同时支持 Claude Code 的 `/spec:*` 入口和 Codex 的 `$spec-*` 入口，不需要手工维护生成副本。

## 快速开始

Prerequisites / 前置条件：

- Node.js `>=20.0.0` 和 npm。
- 已安装 Claude Code 或 Codex，并选择其中一个作为当前宿主。
- terminal 位于你想启用 `spec-first` 的项目仓库根目录。首次试用者可以先在 throwaway/test repo 中体验，再初始化真实项目。

Terminal commands / 终端命令：

```bash
npm install -g spec-first
spec-first doctor
```

只初始化实际使用的宿主：

```bash
# Claude Code 项目
spec-first init --claude -u <name> --lang zh

# Codex 项目
spec-first init --codex -u <name> --lang zh
```

按实际使用的宿主运行 init：只用 Claude Code 就只跑 `--claude`，只用 Codex 就只跑 `--codex`；同一个 repo 需要同时支持两个宿主时才两个都跑。

重启宿主或新开会话，让宿主加载刚生成的 runtime assets。

宿主内 workflow 入口不是 shell 命令：

```text
# 在 Claude Code 会话中
/spec:brainstorm "改进 onboarding"

# 在 Codex 会话中
$spec-brainstorm "改进 onboarding"
```

### 完成标志

第一次 brainstorm 运行会生成类似这样的 requirements brief：

```text
docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md
```

随后进入当前宿主的 plan 入口继续推进。

## 你会得到什么

```text
docs/
  brainstorms/   早期问题澄清得到的 requirements briefs
  plans/         可评审、可执行的 implementation plans
  tasks/         大计划需要结构化交接时生成的 task packs
  solutions/     解决问题后沉淀的可复用经验
```

按 repo-relative path 表示，这些目录是 `docs/brainstorms/`、`docs/plans/`、`docs/tasks/` 和 `docs/solutions/`。

相关 workflows 还会产出结构化 review findings、debug evidence 和 verification notes。Not every workflow writes every artifact；每个入口只写入与自身职责匹配的产物。

每类产物由谁生成、谁读取、是否应该手改，见 [产物目录](./docs/05-用户手册/10-产物目录.md)。

## 工作方式

```text
Source assets
  skills/  agents/  templates/  src/cli/
        |
        | spec-first init --claude 或 --codex
        v
Host runtime assets
  Claude Code: /spec:* commands
  Codex:      $spec-* skills
        |
        v
Workflow artifacts
  brainstorms -> plans -> tasks -> work/review/debug -> learnings
```

source of truth 位于仓库源码资产中。`.claude/`、`.codex/`、`.agents/skills/` 下的 generated runtime copies 可丢弃，可通过 `spec-first init` 重建。

## 选择你的路径

| 你的情况 | 从这里开始 | 预期结果 |
|---|---|---|
| 只有模糊想法或产品问题 | `/spec:brainstorm` 或 `$spec-brainstorm` | `docs/brainstorms/` 下的 requirements brief |
| 目标已定，但还没有实施策略 | `/spec:plan` 或 `$spec-plan` | `docs/plans/` 下的 plan |
| 已有 plan 或 task pack，准备执行 | `/spec:work` 或 `$spec-work` | 代码改动、测试和验证记录 |
| 遇到失败测试、bug 或难解释的错误 | `/spec:debug` 或 `$spec-debug` | 根因、修复和验证证据 |
| 合并前需要评审 diff 风险 | `/spec:code-review` 或 `$spec-code-review` | 结构化 findings 和 residual risks |

## 核心 workflows

| 我想要... | Claude Code | Codex | 预期产物 |
|---|---|---|---|
| 探索想法 | `/spec:brainstorm` | `$spec-brainstorm` | `docs/brainstorms/` 下的 requirements brief |
| 规划实现 | `/spec:plan` | `$spec-plan` | `docs/plans/` 下的 plan |
| 执行开发 | `/spec:work` | `$spec-work` | 代码、测试和验证记录 |
| 代码评审 | `/spec:code-review` | `$spec-code-review` | 结构化 findings 和 residual risks |
| 调试问题 | `/spec:debug` | `$spec-debug` | 根因、修复和验证 |

## Trust Model

`spec-first` 不要求 LLM 模拟确定性工具，也不把 LLM 判断替换成刚性状态机。

核心规则很简单：Scripts prepare, LLM decides.

- **脚本负责什么：** 安装、校验、生成、清理、hash 和机器事实报告。
- **LLM 决定什么：** 需求 framing、scope boundaries、tradeoffs、implementation judgment、review evidence 和 next steps。
- **会写入什么：** repo-local docs、plans、task packs、review/debug artifacts，以及 init 期间生成的 managed runtime assets。
- **哪些是生成产物：** `.claude/`、`.codex/` 和 `.agents/skills/` runtime copies。不要把它们当作 source truth 手改。
- **spec-first 不是什么：** 不是通用 agent marketplace，不是单次 prompt pack，也不是脱离 Claude Code/Codex 独立运行的应用。

使用 `spec-first clean --claude` 或 `spec-first clean --codex` 删除 managed runtime assets。

## 适合使用 spec-first 的情况

- 你已经在使用 Claude Code 或 Codex，并希望在项目内获得稳定 workflow，而不是一次性 prompt。
- 你希望 AI coding 工作留下可追踪的 requirements、plans、review findings 和 learnings。
- 你希望脚本处理确定性 setup，同时把语义判断保留给 LLM。
- 你希望 workflow layer 足够轻量，并能从 source assets 重建。

如果你只需要单次 prompt 片段、通用 agent marketplace、不依赖宿主的独立应用，或团队流程不希望 workflow artifacts 写入 repo，`spec-first` 可能不是最合适的形态。

## 相关文档

官网与语言入口：

- [spec-first.cn](http://spec-first.cn/)
- [English README](./README.md)
- [简体中文 README](./README.zh-CN.md)

理解模型：

- [用户手册](./docs/05-用户手册/README.md)
- [核心概念](./docs/05-用户手册/02-核心概念.md)
- [架构总览](./docs/02-架构设计/01-整体架构.md)

使用 workflows：

- [快速开始](./docs/05-用户手册/01-快速开始.md)
- [首次工作流走查](./docs/05-用户手册/09-首次工作流走查.md)
- [完整示例](./docs/05-用户手册/03-完整示例.md)
- [产物目录](./docs/05-用户手册/10-产物目录.md)
- [Workflows 与产物地图](./docs/05-用户手册/04-workflows-artifacts-map.md)

开发与贡献：

- [贡献指南](./CONTRIBUTING.md)
- [安全政策](./SECURITY.md)
- [License](./LICENSE)
- [开发规范](./docs/03-实施方案/06-开发规范.md)
- [测试方案](./docs/03-实施方案/04-测试方案.md)

版本记录：

- [版本更新记录](./docs/08-版本更新/README.md)

详细手册和实施文档均以中文为主。

## 完整 Workflow Reference

| 意图 | Claude Code | Codex |
|---|---|---|
| 安装必备 harness runtime | `/spec:mcp-setup` | `$spec-mcp-setup` |
| 编译 graph readiness facts | `/spec:graph-bootstrap` | `$spec-graph-bootstrap` |
| 更新 spec-first 或 runtime assets | `/spec:update` | `$spec-update` |
| 搜索 agent session 历史 | `/spec:sessions` | `$spec-sessions` |
| 研究 Slack 组织上下文 | `/spec:slack-research` | `$spec-slack-research` |
| 审查 source skills | `/spec:skill-audit` | `$spec-skill-audit` |
| 生成并评估想法 | `/spec:ideate` | `$spec-ideate` |
| 需求澄清 | `/spec:brainstorm` | `$spec-brainstorm` |
| 文档/计划评审 | `/spec:doc-review` | `$spec-doc-review` |
| 写计划或深化计划 | `/spec:plan` | `$spec-plan` |
| 编译 task pack | 使用已安装的 standalone `write-tasks` skill | 使用已安装的 standalone `write-tasks` skill |
| 审查 App 一致性 | `/spec:app-consistency-audit` | `$spec-app-consistency-audit` |
| 调试失败或 bug | `/spec:debug` | `$spec-debug` |
| 执行工作 | `/spec:work` | `$spec-work` |
| 使用 Codex delegation beta 执行工作 | `/spec:work-beta` | `$spec-work-beta` |
| 优化可度量目标 | `/spec:optimize` | `$spec-optimize` |
| 打磨可浏览 UI beta | `/spec:polish-beta` | `$spec-polish-beta` |
| 代码评审 | `/spec:code-review` | `$spec-code-review` |
| 知识沉淀 | `/spec:compound` | `$spec-compound` |
| 刷新过期知识沉淀 | `/spec:compound-refresh` | `$spec-compound-refresh` |
| 查看版本说明 | `/spec:release-notes` | `$spec-release-notes` |

当 managed Claude hook 或 Codex 顶层 workflow-entry guidance 展示启动版本提醒时，提醒只会指向上表中的 update 入口；它不会安装包、刷新 runtime assets 或重启宿主。

## Runtime Reference

`spec-first` 提供 CLI helpers（`doctor`、`init`、`clean`、`tasks`、版本/help 输出）、workflow source assets、host-filtered runtime 生成，以及 ideation、brainstorm、plan、task-pack handoff、work、App consistency audit、debug、review、setup、update、sessions、Slack research、release notes、skill audit、compound、optimize 和 browser-visible polish 等公开 workflow 入口。

通过当前宿主的 setup workflow 管理 required harness runtime setup，覆盖 MCP servers、graph-provider MCP servers、helper CLIs 和项目 setup facts。

通过当前宿主的 graph bootstrap workflow 编译 external graph readiness，产出供下游 workflow 使用的 canonical graph / impact readiness artifacts。

当前上下文与 graph readiness 使用以下路径：

- 用当前宿主的 setup workflow 安装并验证 required harness runtime：Serena、Sequential Thinking、Context7、GitNexus、code-review-graph、`agent-browser`、`gh`、`jq`、`vhs`、`silicon`、`ffmpeg`、`ast-grep` 和 global `ast-grep` skill。
- 在 setup 报告 `baseline_ready=true` 后运行当前宿主的 graph bootstrap workflow。它读取 setup-owned config facts，校验 provider command arrays，临时运行 GitNexus/code-review-graph probes，并写入 `.spec-first/graph/*`、`.spec-first/providers/*` 和 `.spec-first/impact/*` readiness artifacts。
- 当前宿主的 plan workflow 是当前阶段第一个 graph-readiness consumer。它会报告 graph 状态、检查 freshness，并在 facts 缺失、blocked、stale 或 degraded 时退回 bounded direct repo reads。
- 在父 workspace 下存在多个 child Git repos 时，setup/bootstrap 脚本必须显式传 `--repo <child>`。父 workspace 只报告候选 repo，不拥有 repo-local `.spec-first/config/*`、`.spec-first/graph/*`、`.spec-first/impact/*` 或 `.serena/*` 产物。
- 用已安装的 standalone `write-tasks` skill 做确定性的 task-pack handoff，再让当前宿主的 work、code-review 和 doc-review workflow 基于当前请求、plans/task packs、diffs、targeted file reads 与 tests 确定 scope authority。

CLI reference：

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan-path> [--json]
spec-first tasks validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]
```

Runtime asset summary：

| 层级 | 当前 contract |
|---|---|
| **能力层资产** | 仓库内置源码资产共 `41` 个 skills、`51` 个 agents、`0` 个 agent support files。运行时交付会按双宿主治理过滤：当前版本在 Claude 侧安装 `20` 个 commands + `2` 个 standalone skills + `2` 个 agent-facing internal skills，在 Codex 侧安装 `20` 个 workflow skills + `2` 个 standalone skills + `2` 个 agent-facing internal skills；两侧都会安装 `51` 个 agents |
| **Claude runtime** | commands 生成到 `.claude/commands/spec`，standalone 与 agent-facing internal skills 生成到 `.claude/skills`，command-backed workflow skill 副本生成到 `.claude/spec-first/workflows`，agents 生成到 `.claude/agents`，managed state 位于 `.claude/spec-first/state.json`。 |
| **Codex runtime** | workflow、standalone 与 agent-facing internal skills 生成到 `.agents/skills`，agents 生成到 `.codex/agents`，managed state 位于 `.codex/spec-first/state.json`。 |
| **Readiness** | setup workflow 写 readiness ledger v2 以及 setup-owned `graph-providers.json`、`runtime-capabilities.json`、`provider-artifacts.json`；graph bootstrap workflow 消费这些事实并写 canonical graph facts、provider status、impact capabilities 和 report。 |

Claude init 的预期输出包含：

```text
📦 Generated 20 command file(s) in .claude/commands/spec
🧩 Generated 4 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
下一步:
  1. 重启 Claude Code 或新开会话，让宿主加载刚生成的 /spec:* commands。
  2. 在新会话运行 /spec:mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 /spec:mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 /spec:graph-bootstrap。
```

Codex init 的预期输出包含：

```text
🧩 Generated 24 skill directory(ies) in .agents/skills
🤖 Generated 51 agent file(s) in .codex/agents
下一步:
  1. 重启 Codex 或新开会话，让宿主加载刚生成的 $spec-* skills。
  2. 在新会话运行 $spec-mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 $spec-mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 $spec-graph-bootstrap。
```

## 开发与贡献

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

修改 source assets 时，应修改 `skills/`、`agents/`、`templates/` 或 `src/cli/`，再在新宿主会话中通过 `spec-first init --claude` 或 `spec-first init --codex` 重建 runtime copies。

贡献与支持细节见 [CONTRIBUTING.md](./CONTRIBUTING.md)、[SECURITY.md](./SECURITY.md)、[LICENSE](./LICENSE) 和 [GitHub Issues](https://github.com/sunrain520/spec-first/issues)。
