<div align="center">

# spec-first

[![npm version](https://img.shields.io/npm/v/spec-first.svg)](https://www.npmjs.com/package/spec-first)
[![license](https://img.shields.io/npm/l/spec-first.svg)](https://github.com/sunrain520/spec-first/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/spec-first.svg)](https://github.com/sunrain520/spec-first/blob/main/package.json)
[![CI](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml/badge.svg)](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml)
[![docs](https://img.shields.io/badge/docs-spec--first.cn-0b7285.svg)](http://spec-first.cn/)

[English](https://github.com/sunrain520/spec-first/blob/main/README.md) | [简体中文](https://github.com/sunrain520/spec-first/blob/main/README.zh-CN.md)

**面向 Claude Code 与 Codex 的 spec-driven AI engineering workflows。**

`spec-first` 帮助团队把 AI coding 会话变成可复用的工程闭环：环境与代码图谱准备、想法整理、需求澄清、文档审查、计划编写、任务包编译、执行/调试/优化/打磨、代码与 App 一致性审查、知识沉淀与系统进化。

它让脚本负责确定性的安装、生成、校验和事实采集；让 LLM 负责需求理解、方案取舍、实现判断和评审决策。

官网：[spec-first.cn](http://spec-first.cn/)

</div>

---

## 90 秒看懂

![spec-first workflow flow](https://raw.githubusercontent.com/sunrain520/spec-first/main/docs/assets/readme/spec-first-flow.svg)

```text
开放式改进问题
  -> $spec-ideate 或 /spec:ideate
  -> docs/ideation/YYYY-MM-DD-topic-ideation.md
  -> 选定一个粗略想法
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
docs/ideation/2026-05-01-cli-onboarding-ideation.md
docs/brainstorms/2026-05-01-001-cli-onboarding-requirements.md
docs/plans/2026-05-01-001-feat-cli-onboarding-plan.md
docs/tasks/2026-05-01-001-feat-cli-onboarding-tasks.md
```

当你需要 AI 主动生成并排序多个方向时，先用 `ideate`。第一次 brainstorm 通常只为一个已选想法生成 requirements brief。plan、task-pack、work、review、debug 和 compound 入口会在你继续推进链路时分别写入各自职责内的产物。

完整走查见 [首次工作流走查](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/09-%E9%A6%96%E6%AC%A1%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%B5%B0%E6%9F%A5.md)。

## 为什么使用 spec-first？

AI coding 最大的问题通常不是 agent 不会写代码，而是关键判断只停留在聊天窗口里：下一次会话缺上下文，reviewer 看不到计划为什么变化，团队也很难复用一次成功经验。

`spec-first` 对问题的判断很明确：真正需要被编排的不只是 agent，而是软件生命周期本身。需求、计划、任务、diff、review、失败根因和经验沉淀必须能跨会话存活，才能支撑长期项目。

### 核心区别：编排目标是谁

| 问题 | Agent 编排工具 | spec-first |
|---|---|---|
| 核心对象 | Agent、role、team、queue | Requirement、plan、task pack、diff、review、bug、learning |
| 主线问题 | Agent 之间怎么协作？ | 软件决策怎么被记下来、被验证、被复用？ |
| 状态位置 | Session state、消息总线、runtime memory | 项目内文档、generated runtime assets、可验证 CLI facts |
| 人的角色 | 尽量减少介入 | 工程师对 scope、tradeoff、验收保持在环 |
| 自动化边界 | 倾向更长的自动接力 | 脚本准备事实，LLM 做语义判断 |

`spec-first` 给这些工作一个轻量结构：

- requirements 变成持久 brief，而不是会话里消失的 prompt。
- plans 和 task packs 把模糊意图变成可评审、可执行的上下文。
- work、review、debug 和 compound workflows 会沉淀证据与经验。
- 脚本准备事实和 runtime assets；LLM 决定范围、取舍、实现策略和评审证据。
- 一套 source assets 同时支持 Claude Code 的 `/spec:*` 入口和 Codex 的 `$spec-*` 入口，不需要手工维护生成副本。

## 快速开始

Prerequisites / 前置条件：

- Node.js `>=20.0.0` 和 npm。
- Git 已安装并在 `PATH` 中；`doctor`、setup 和 workflow 检查会读取 Git 仓库事实。
- 已安装 Claude Code 或 Codex，并选择其中一个作为当前宿主。
- terminal 位于你想启用 `spec-first` 的项目仓库根目录。首次试用者可以先在 throwaway/test repo 中体验，再初始化真实项目。

请在当前平台的原生终端中安装并运行第一次健康检查。

macOS / Linux：

```bash
npm install -g spec-first
spec-first doctor
```

Windows PowerShell 7+ 或 Windows PowerShell 5.1：

```powershell
npm install -g spec-first
spec-first doctor
```

Windows cmd.exe：

```bat
npm install -g spec-first
spec-first doctor
```

在 Win64 上，推荐使用 Windows Terminal + PowerShell 7+ 或原生 `cmd.exe` 做安装和 smoke check。Windows PowerShell 5.1 也支持，但 PowerShell 7+ 的 UTF-8 行为更稳定。Git Bash、MSYS2、WSL 可用于 POSIX 环境，但不能替代 Windows 原生验证，因为 npm `.cmd` shim、`%PATH%`、quoting 和 code page 行为不同。

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

如果不确定该用哪个 workflow，可以在宿主会话中直接描述任务或询问下一步；`using-spec-first` 会推荐一个公开入口并说明原因。

### 完成标志

第一次 brainstorm 运行会生成类似这样的 requirements brief：

```text
docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md
```

随后进入当前宿主的 plan 入口继续推进。

## 研发全流程总览

这张图用于区分终端命令和宿主会话内 workflow 入口，并快速看到从安装到执行完成的全景路径：

```text
在目标项目 repo 的终端中
  |
  | npm install -g spec-first
  | spec-first doctor
  | spec-first init --claude -u <name> --lang zh
  |   或
  | spec-first init --codex -u <name> --lang zh
  v
重启 Claude Code 或 Codex
  |
  | /spec:mcp-setup       或 $spec-mcp-setup
  | /spec:graph-bootstrap 或 $spec-graph-bootstrap
  | /spec:standards       或 $spec-standards
  v
在宿主会话中选择下一步 workflow
  |
  +-- 需要候选方向、批判或改进想法
  |     -> /spec:ideate 或 $spec-ideate
  |     -> docs/ideation/*-ideation.md
  |
  +-- 已有粗略产品问题或功能想法
  |     -> /spec:brainstorm 或 $spec-brainstorm
  |     -> docs/brainstorms/*-requirements.md
  |
  +-- 目标已定，但实现路径还不清楚
  |     -> /spec:plan 或 $spec-plan
  |     -> docs/plans/*-plan.md
  |
  +-- 计划较大，需要确定性任务交接
  |     -> 已安装的 standalone write-tasks skill
  |     -> docs/tasks/*-tasks.md
  |
  +-- plan 或 task pack 已准备好执行
  |     -> /spec:work 或 $spec-work
  |     -> 代码、测试和验证记录
  |
  +-- 移动 App 改动需要在运行时 QA 前做静态一致性审查
  |     -> /spec:app-consistency-audit 或 $spec-app-consistency-audit
  |     -> .spec-first/app-audit/runs/<run-id>/
  |
  +-- 失败、bug 或难解释的错误
  |     -> /spec:debug 或 $spec-debug
  |     -> 根因、修复和验证证据
  v
合并或交接前
  |
  | /spec:code-review 或 $spec-code-review
  | /spec:doc-review  或 $spec-doc-review
  v
问题解决后
  |
  | /spec:compound 或 $spec-compound
  v
为下一次 AI coding 会话留下项目内可复用上下文
```

不是每个项目都要走完所有节点。按当前状态选择入口；状态不清楚时，直接在宿主会话里询问下一步该运行什么。

## 当前工程闭环

上面的总览图展示的是常见 first-run 路径。完整闭环更广：

```text
mcp-setup / graph-bootstrap
  -> ideate
  -> brainstorm
  -> doc-review
  -> plan
  -> write-tasks
  -> work / debug / optimize / polish
  -> code-review / app-consistency-audit
  -> compound / compound-refresh / sessions / slack-research / skill-audit
  -> 反哺项目知识、文档、skills 和下一次 workflow 选择
```

这是一条工程闭环，不是一串必须逐项执行的命令。根据当前状态进入最匹配的节点；当下一步不清楚时，宿主会话里的入口治理会推荐一个公开 workflow 并说明理由。`write-tasks` 是 standalone skill；可浏览 UI 的 polish 当前通过 `polish-beta` 暴露。

想要选项、批判或意外方向，还没确定问题框架时，用 `ideate`。已经有粗略产品问题或功能想法，需要整理 actors、flows、边界和验收样例时，用 `brainstorm`。已有 requirements、plan 或 task 文档，需要找缺口时，用 `doc-review`。不要把 `brainstorm` 当作所有不清楚请求的默认入口。

| 需求 | 更合适的入口 |
|---|---|
| “我们该改进什么？”或“给我一些想法” | `ideate` |
| “我有一个粗略产品问题，帮我成型” | `brainstorm` |
| “这份 requirements 或 plan 文档可能有缺口” | `doc-review` |

| 层级 | 节点 | 回答的问题 | 持久输出 |
|---|---|---|---|
| 能力底座 | `mcp-setup`、`graph-bootstrap` | AI 是否有正确工具？是否拿到了当前代码库事实？ | setup 报告、provider 配置、graph readiness facts、impact capability facts。 |
| 需求成型 | `ideate`、`brainstorm`、`doc-review` | 问题是否值得做、是否清楚、文档是否有明显缺口？ | 想法、requirements briefs、审查 findings、风险和开放问题。 |
| 设计与交接 | `plan`、standalone `write-tasks` skill | 该怎么实现？大计划如何变成可执行任务？ | implementation plans 和 validated task packs。 |
| 工程执行 | `work`、`debug`、`optimize`、`polish` | 如何实现、修复、优化或完成交付细节？ | 代码改动、测试、修复、度量结果和验证记录。 |
| 质量关口 | `code-review`、`app-consistency-audit` | 结果是否符合计划、代码质量和 App/产品一致性要求？ | review findings、residual risks 和 run-scoped audit evidence。 |
| 知识与进化 | `compound`、`compound-refresh`、`sessions`、`slack-research`、`skill-audit` | 什么经验要复用、什么外部/历史/团队上下文要刷新、spec-first 自己哪里要进化？ | learnings、刷新后的上下文、会话总结、组织研究和 skill audit findings。 |

边界仍然保持轻量：scripts 和 CLI 负责准备事实；LLM 负责判断 scope、tradeoff、下一步 workflow、实现策略和评审结论。最后一层把经验反哺到文档、skills 和项目记忆中，而不是把 `spec-first` 变成刚性状态机。

## 支持的开发模式

`spec-first` 的开发模式按仓库和项目拓扑定义，不按单个 workflow 的 `mode:*` 参数定义。当前支持三种：

| 模式 | 典型形态 | `.spec-first` 权威边界 | 处理方式 |
|---|---|---|---|
| 单仓单项目 | 一个 Git repo 中就是一个应用、SDK、CLI 或服务 | 当前 repo root | requirements、plan、work、review、graph facts 都以当前 repo 为边界。 |
| 单仓多模块 | 一个 Git repo 中包含多个 app、package、service 或 Android module | 同一个 repo root | 不为每个 module 拆多套 `.spec-first`；由 plan、task pack、work 和 review 在 repo 内按 module 边界拆分和路由。 |
| 多仓工作区 | 父目录下有多个独立 child Git repos | 每个 child repo 自己的 repo root；父级 workspace artifacts 仅作 advisory context | 父 workspace 负责候选发现；无参数 `spec-standards` 默认批量写 child-local standards baselines，显式父级 workspace standards context 仍只作 advisory；repo-local setup、graph、plan、work、review 必须落到显式 child repo。 |

```text
单仓单项目
my-app/
  .git/
  .spec-first/
  src/

单仓多模块
platform/
  .git/
  .spec-first/
  apps/web/
  apps/mobile/
  packages/core/

多仓工作区
workspace/
  frontend/
    .git/
    .spec-first/
  backend/
    .git/
    .spec-first/
  mobile/
    .git/
    .spec-first/
```

核心 contract 是：`.spec-first` 的事实边界永远是 **selected Git repo root**。

- 单仓多模块不要在每个 module 下各放一套 `.spec-first`，否则 plan、review、graph facts 和 knowledge 会分裂。
- 多仓工作区的父目录不拥有 repo-local truth。无参数 `spec-standards` 会给每个 discovered child repo 写 child-local `.spec-first/standards/` baseline facts；`--repo <child>` 可收窄到单个 child，`--workspace` 才显式写父级 `.spec-first/standards/` advisory artifacts。计划或任务仍需要写明 `target_repo` 或 per-unit/per-task `target_repo`。
- `mode:headless`、`mode:report-only`、`mode:autofix`、`depth:deep` 等是 workflow 或 skill 的运行姿态，不是开发模式分类。

## 你会得到什么

`spec-first` 把 AI 辅助开发建模成少数可持久化实体和事件驱动流程。

### 持久实体

| 实体 | 典型位置 | 作用 |
|---|---|---|
| Ideation shortlist | `docs/ideation/` | 在进入需求成型前，对候选想法进行排序、批判和取舍。 |
| Requirements brief | `docs/brainstorms/` | 在实现压力到来前记录问题、角色、流程、约束和验收样例。 |
| Implementation plan | `docs/plans/` | 把目标拆成实现单元、取舍、验证目标和非目标。 |
| Task pack | `docs/tasks/` | 当计划需要确定性任务身份、依赖顺序和验证时，提供结构化交接。 |
| App consistency audit run | `.spec-first/app-audit/runs/<run-id>/` | 在运行时验证前记录 PRD、Figma、源码、路由、架构、埋点和 i18n 的静态一致性证据。 |
| Review/debug evidence | workflow 输出、diff、tests、reports | 让代码评审和失败诊断基于证据，而不是感觉。 |
| Learning | `docs/solutions/` | 把已经解决的问题沉淀成可复用工程知识。 |

按 repo-relative path 表示：

```text
docs/
  ideation/      需求成型前的候选想法排序与批判
  brainstorms/   早期问题澄清得到的 requirements briefs
  plans/         可评审、可执行的 implementation plans
  tasks/         大计划需要结构化交接时生成的 task packs
  solutions/     解决问题后沉淀的可复用经验
.spec-first/
  app-audit/runs/ App 静态一致性审查事实和报告
```

Not every workflow writes every artifact；每个入口只写入与自身职责匹配的产物。

每类产物由谁生成、谁读取、是否应该手改，见 [产物目录](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/10-%E4%BA%A7%E7%89%A9%E7%9B%AE%E5%BD%95.md)。

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
  ideation -> brainstorms -> plans -> tasks -> work/review/debug -> learnings
```

source of truth 位于仓库源码资产中。`.claude/`、`.codex/`、`.agents/skills/` 下的 generated runtime copies 可丢弃，可通过 `spec-first init` 重建。

init 后的运行时结构：

```text
your-project/
├── docs/
│   ├── ideation/
│   ├── brainstorms/
│   ├── plans/
│   ├── tasks/
│   └── solutions/
├── .claude/          # 使用 Claude Code 时生成
├── .codex/           # 使用 Codex 时生成
├── .agents/skills/   # Codex-facing generated skills
└── AGENTS.md 或 CLAUDE.md
```

### 主要流程

| 流程 | 从这里开始 | 稳定什么 |
|---|---|---|
| 想法生成 | `/spec:ideate` 或 `$spec-ideate` | 候选方向、批判、排序，以及进入单个想法的 handoff。 |
| 问题澄清 | `/spec:brainstorm` 或 `$spec-brainstorm` | 一个已选想法的原始需求、用户目标、边界和验收样例。 |
| 实施规划 | `/spec:plan` 或 `$spec-plan` | 架构选择、实现单元、验证范围和已知未知。 |
| 执行开发 | `/spec:work` 或 `$spec-work` | 代码改动、聚焦测试、验证记录和 scope 控制。 |
| App 一致性审查 | `/spec:app-consistency-audit` 或 `$spec-app-consistency-audit` | 运行时验证前审查 PRD、Figma、源码、路由、KMP/Clean Architecture、埋点、i18n 和行业规则一致性。 |
| 质量与恢复 | `/spec:code-review`、`$spec-code-review`、`/spec:debug`、`$spec-debug` | findings、residual risks、根因、修复和证据。 |
| 知识复利 | `/spec:compound` 或 `$spec-compound` | 解决问题后的可复用经验。 |

## 选择你的路径

| 你的情况 | 从这里开始 | 预期结果 |
|---|---|---|
| 需要开放式改进方向或多个候选想法 | `/spec:ideate` 或 `$spec-ideate` | `docs/ideation/` 下的 ranked ideation artifact |
| 已有粗略产品问题或功能想法 | `/spec:brainstorm` 或 `$spec-brainstorm` | `docs/brainstorms/` 下的 requirements brief |
| 目标已定，但还没有实施策略 | `/spec:plan` 或 `$spec-plan` | `docs/plans/` 下的 plan |
| 已有 plan 或 task pack，准备执行 | `/spec:work` 或 `$spec-work` | 代码改动、测试和验证记录 |
| 移动 App 改动在 QA 前需要 PRD/Figma/source 一致性审查 | `/spec:app-consistency-audit` 或 `$spec-app-consistency-audit` | `.spec-first/app-audit/runs/` 下的静态审查报告和范围化证据 |
| 遇到失败测试、bug 或难解释的错误 | `/spec:debug` 或 `$spec-debug` | 根因、修复和验证证据 |
| 合并前需要评审 diff 风险 | `/spec:code-review` 或 `$spec-code-review` | 结构化 findings 和 residual risks |

## 核心 workflows

| 我想要... | Claude Code | Codex | 预期产物 |
|---|---|---|---|
| 生成并排序想法 | `/spec:ideate` | `$spec-ideate` | `docs/ideation/` 下的 ideation artifact |
| 把一个想法澄清成需求 | `/spec:brainstorm` | `$spec-brainstorm` | `docs/brainstorms/` 下的 requirements brief |
| 规划实现 | `/spec:plan` | `$spec-plan` | `docs/plans/` 下的 plan |
| 执行开发 | `/spec:work` | `$spec-work` | 代码、测试和验证记录 |
| 审查 App 一致性 | `/spec:app-consistency-audit` | `$spec-app-consistency-audit` | 静态一致性报告和范围化审查产物 |
| 代码评审 | `/spec:code-review` | `$spec-code-review` | 结构化 findings 和 residual risks |
| 调试问题 | `/spec:debug` | `$spec-debug` | 根因、修复和验证 |

## Trust Model

`spec-first` 不要求 LLM 模拟确定性工具，也不把 LLM 判断替换成刚性状态机。

核心规则很简单：Scripts prepare, LLM decides.

- **脚本负责什么：** 安装、校验、生成、清理、hash 和机器事实报告。
- **LLM 决定什么：** 需求 framing、scope boundaries、tradeoffs、implementation judgment、review evidence 和 next steps。
- **会写入什么：** repo-local docs、plans、task packs、显式路由后的 durable review/debug summaries，以及 init 期间生成的 managed runtime assets。full-detail code-review JSON 默认只写到当前 OS temp root 下，例如 `<os-temp>/spec-first/spec-code-review/<run-id>/`，作为临时 handoff，除非 workflow 写入 concise durable summary。
- **哪些是生成产物：** `.claude/`、`.codex/` 和 `.agents/skills/` runtime copies。
- **应该修改什么：** 修改 `skills/`、`agents/`、`templates/`、`src/cli/` 和 docs 中的 source assets；不要手改 generated runtime copies。
- **spec-first 不是什么：** 不是通用 agent marketplace，不是单次 prompt pack，也不是脱离 Claude Code/Codex 独立运行的应用。

当 plan 需要确定性的 task-pack handoff 时，使用已安装的 standalone `write-tasks` skill，再进入执行 workflow。

使用 `spec-first clean --claude` 或 `spec-first clean --codex` 删除 managed runtime assets。

## 适合使用 spec-first 的情况

适合使用 `spec-first` 的情况：

- 你已经在使用 Claude Code 或 Codex，并希望在项目内获得稳定 workflow，而不是一次性 prompt。
- 你希望 AI coding 工作留下可追踪的 requirements、plans、显式路由后的 review summaries 和 learnings。
- 你希望脚本处理确定性 setup，同时把语义判断保留给 LLM。
- 你希望 workflow layer 足够轻量，并能从 source assets 重建。

如果你只需要单次 prompt 片段、通用 agent marketplace、不依赖宿主的独立应用，或团队流程不希望 workflow artifacts 写入 repo，`spec-first` 可能不是最合适的形态。

## 相关文档

官网与语言入口：

- [spec-first.cn](http://spec-first.cn/)
- [English README](https://github.com/sunrain520/spec-first/blob/main/README.md)
- [简体中文 README](https://github.com/sunrain520/spec-first/blob/main/README.zh-CN.md)

理解模型：

- [用户手册](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/README.md)
- [核心概念](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/02-%E6%A0%B8%E5%BF%83%E6%A6%82%E5%BF%B5.md)
- [架构总览](https://github.com/sunrain520/spec-first/blob/main/docs/02-%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/01-%E6%95%B4%E4%BD%93%E6%9E%B6%E6%9E%84.md)

使用 workflows：

- [快速开始](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/01-%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B.md)
- [首次工作流走查](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/09-%E9%A6%96%E6%AC%A1%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%B5%B0%E6%9F%A5.md)
- [Workflows 与产物地图](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/04-workflows-artifacts-map.md)

开发与贡献：

- [贡献指南](https://github.com/sunrain520/spec-first/blob/main/CONTRIBUTING.md)
- [安全政策](https://github.com/sunrain520/spec-first/blob/main/SECURITY.md)
- [License](https://github.com/sunrain520/spec-first/blob/main/LICENSE)
- [开发规范](https://github.com/sunrain520/spec-first/blob/main/docs/03-%E5%AE%9E%E6%96%BD%E6%96%B9%E6%A1%88/06-%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83.md)
- [测试方案](https://github.com/sunrain520/spec-first/blob/main/docs/03-%E5%AE%9E%E6%96%BD%E6%96%B9%E6%A1%88/04-%E6%B5%8B%E8%AF%95%E6%96%B9%E6%A1%88.md)

版本记录：

- [版本更新记录](https://github.com/sunrain520/spec-first/blob/main/docs/08-%E7%89%88%E6%9C%AC%E6%9B%B4%E6%96%B0/README.md)

详细手册和实施文档均以中文为主。

## 完整 Workflow Reference

| 意图 | Claude Code | Codex |
|---|---|---|
| 安装必备 harness runtime | `/spec:mcp-setup` | `$spec-mcp-setup` |
| 编译 graph readiness facts | `/spec:graph-bootstrap` | `$spec-graph-bootstrap` |
| 编译、检查、刷新、深挖或导入项目规范与胶水能力基线 | `/spec:standards` | `$spec-standards` |
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
| 试用 Codex delegation beta（显式 opt-in） | `/spec:work-beta` | `$spec-work-beta` |
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
- 在父 workspace 下存在多个 child Git repos 时，只读代码问题可以使用 `workspace-graph-targets.v1` advisory facts 选择 bounded candidate repos，并优先使用 GitNexus-first evidence。除下一条父 workspace 维护入口外，写入、测试、changelog、review autofix 和 commit 仍必须有明确 `target_repo` / per-child scope。
- 父 workspace 维护操作中，init、setup 和 graph bootstrap 在未传 `--repo <child>` 时默认处理全部 child repos；`--repo <child>` 用于收窄范围，`--all-repos` 仍作为显式等价入口。首次 Serena 激活仍需要 per-child language evidence，缺语言的 child 会返回 `serena_language_required`，由 agent 用 `--serena-language-for <child>=<language>` 重跑。父目录可以写 advisory `.spec-first/workspace/*summary.json`；无参数 `spec-standards` 会给每个 discovered child repo 写 child-local `.spec-first/standards/` baseline facts，`spec-standards --workspace` 才写父级 advisory standards baseline。父目录不把 repo-local `.spec-first/config/*`、`.spec-first/graph/*`、`.spec-first/impact/*`、`.spec-first/providers/*`、child-local `.spec-first/standards/*` 或 `.serena/*` 当作 parent-local truth。
- 用已安装的 standalone `write-tasks` skill 做确定性的 task-pack handoff，再让当前宿主的 work、code-review 和 doc-review workflow 基于当前请求、plans/task packs、diffs、targeted file reads 与 tests 确定 scope authority。
- 移动 App 的 PRD/Figma/source 对齐审查使用 App consistency audit workflow。它消费本地 `prd:<path>` 与 `figma-context:<path>` 输入；`figma-ref:<id-or-url>` 只是 reference，只有宿主提供的 Figma MCP 能力 materialize 出本地 JSON 后才成为 evidence。Figma MCP 是 App-audit 可选能力，不属于 required setup baseline。

CLI reference：

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run] [--repo <child>|--all-repos]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan-path> [--json]
spec-first tasks validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]
```

Runtime asset summary：

当 `init` 在包含多个 child Git repo 的父 workspace 中运行时，会自动识别 workspace 模式并初始化每个 child repo，只在父目录写 advisory summary：`.spec-first/workspace/init-summary.json`。它不会在父目录写 `.gitignore`、`AGENTS.md`、`CLAUDE.md`、`.claude/`、`.codex/` 或 `.agents/` 等 repo-local artifacts。使用 `--repo <child>` 可只初始化一个 child repo，使用 `--all-repos` 可显式声明批量初始化意图。

managed `.gitignore` block 也会忽略 `.gitnexus/` 和 `.code-review-graph/` 等本地图谱 provider artifacts。

详细 runtime capability catalog 见 [Runtime Capability Catalog](https://github.com/sunrain520/spec-first/blob/main/docs/catalog/runtime-capabilities.md)。

| 层级 | 当前 contract |
|---|---|
| **能力层资产** | 仓库内置源码资产共 `40` 个 skills、`51` 个 agents、`0` 个 agent support files。运行时交付会按双宿主治理过滤：当前版本在 Claude 侧安装 `21` 个 commands + `2` 个 standalone skills + `1` 个 agent-facing internal skills，在 Codex 侧安装 `21` 个 workflow skills + `2` 个 standalone skills + `1` 个 agent-facing internal skills；两侧都会安装 `51` 个 agents |
| **Claude runtime** | commands 生成到 `.claude/commands/spec`，standalone 与 agent-facing internal skills 生成到 `.claude/skills`，command-backed workflow skill 副本生成到 `.claude/spec-first/workflows`，agents 生成到 `.claude/agents`，managed state 位于 `.claude/spec-first/state.json`。 |
| **Codex runtime** | workflow、standalone 与 agent-facing internal skills 生成到 `.agents/skills`，agents 生成到 `.codex/agents`，managed state 位于 `.codex/spec-first/state.json`。 |
| **Readiness** | setup workflow 写 readiness ledger v2 以及 setup-owned `graph-providers.json`、`runtime-capabilities.json` 和 `provider-artifacts.json`；graph bootstrap workflow 消费这些事实并写 canonical graph facts、provider status、impact capabilities 和 report。 |

Claude init 的预期输出包含：

```text
📦 Generated 21 command file(s) in .claude/commands/spec
🧩 Generated 3 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
下一步:
  1. 重启 Claude Code 或新开会话，让宿主加载刚生成的 /spec:* commands。
  2. 在新会话运行 /spec:mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 /spec:mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 /spec:graph-bootstrap。
  4. graph readiness 就绪后，运行 /spec:standards 编译项目规范与胶水基线，再进入下游 workflow。父 workspace 下会为所有 discovered child repo 批量生成 child-local baselines；使用 /spec:standards --repo <child> 收窄到单个 child，或用 /spec:standards --workspace 写父级 advisory artifacts。
```

Codex init 的预期输出包含：

```text
🧩 Generated 24 skill directory(ies) in .agents/skills
🤖 Generated 51 agent file(s) in .codex/agents
下一步:
  1. 重启 Codex 或新开会话，让宿主加载刚生成的 $spec-* skills。
  2. 在新会话运行 $spec-mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 $spec-mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 $spec-graph-bootstrap。
  4. graph readiness 就绪后，运行 $spec-standards 编译项目规范与胶水基线，再进入下游 workflow。父 workspace 下会为所有 discovered child repo 批量生成 child-local baselines；使用 $spec-standards --repo <child> 收窄到单个 child，或用 $spec-standards --workspace 写父级 advisory artifacts。
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

贡献与支持细节见 [CONTRIBUTING.md](https://github.com/sunrain520/spec-first/blob/main/CONTRIBUTING.md)、[SECURITY.md](https://github.com/sunrain520/spec-first/blob/main/SECURITY.md)、[LICENSE](https://github.com/sunrain520/spec-first/blob/main/LICENSE) 和 [GitHub Issues](https://github.com/sunrain520/spec-first/issues)。
