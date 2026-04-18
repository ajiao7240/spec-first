[English](./README.md) | [简体中文](./README.zh-CN.md)

<div align="center">
<h1>Spec-First</h1>

<p><strong>把 AI 编程从一次性对话，升级为可安装、可治理、可复用的工程系统。</strong></p>

<p>面向 <strong>Claude Code</strong> 与 <strong>Codex</strong> 的中文优先开源 AI 工程工作流 CLI。</p>

<p>
  <code>Doctor → Init → Workflow</code>
  <code>Claude Code + Codex</code>
  <code>Ideate → Brainstorm → Plan → Work → Review → Compound</code>
</p>

<p>候选发散、需求澄清、方案规划、实施执行、结构化评审、知识沉淀，一条链路闭环到底。</p>

<p>
  <a href="#快速开始"><strong>快速开始</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#核心工作流"><strong>核心工作流</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="./docs/05-用户手册/README.md"><strong>用户手册</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="https://www.npmjs.com/package/spec-first"><strong>npm</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="http://1.15.14.36:8087/"><strong>官网</strong></a>
</p>

<p>
  <a href="https://www.npmjs.com/package/spec-first"><img src="https://img.shields.io/npm/v/spec-first?style=flat-square&color=2563eb" alt="npm version"></a>
  <a href="https://npmtrends.com/spec-first"><img src="https://img.shields.io/npm/dm/spec-first?style=flat-square&color=cb3837&label=downloads" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/sunrain520/spec-first?style=flat-square&color=16a34a" alt="license"></a>
  <a href="https://github.com/sunrain520/spec-first/stargazers"><img src="https://img.shields.io/github/stars/sunrain520/spec-first?style=flat-square&color=eab308" alt="GitHub stars"></a>
  <a href="./docs/05-用户手册/README.md"><img src="https://img.shields.io/badge/docs-用户手册-0f766e?style=flat-square" alt="用户手册"></a>
  <a href="https://github.com/sunrain520/spec-first/issues"><img src="https://img.shields.io/github/issues/sunrain520/spec-first?style=flat-square&color=e67e22" alt="GitHub issues"></a>
  <a href="https://github.com/sunrain520/spec-first/pulls"><img src="https://img.shields.io/github/issues-pr/sunrain520/spec-first?style=flat-square&color=9b59b6" alt="GitHub PRs"></a>
  <a href="https://deepwiki.com/sunrain520/spec-first"><img src="https://img.shields.io/badge/Ask-DeepWiki-blue?style=flat-square" alt="Ask DeepWiki"></a>
  <a href="https://chatgpt.com/?q=Explain+the+project+sunrain520/spec-first+on+GitHub"><img src="https://img.shields.io/badge/Ask-ChatGPT-74aa9c?style=flat-square&logo=openai&logoColor=white" alt="Ask ChatGPT"></a>
</p>
</div>

<p align="center">
  <img alt="Spec-First overview" src="./docs/assets/svg/spec-first-overview.svg">
</p>

## 概述

`spec-first` 是一个面向 **Claude Code** 和 **Codex** 的开源 `npm` CLI。
它不只是安装一组命令，而是把 AI 辅助开发从临时对话收敛成项目级工程工作流，具备明确产物、结构化评审和可复用知识沉淀。

Codex 现在也会生成共享的 `/spec:*` command files 到 `.codex/commands/spec/` 下，同时继续支持 `$spec-*` 技能入口。

当前 Stage-0 有两个并行入口：

- `/spec:bootstrap` 或 `$spec-bootstrap` 是默认稳定入口
- `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` 是 graph-informed Phase 0-4 入口
- 对 Codex 而言，正式可用性仍以宿主发现 `.agents/skills/spec-graph-bootstrap/` 为准；`.codex/commands/spec/graph-bootstrap.md` 只是兼容命令层

首次在 Claude Code 中使用时，推荐顺序是：

`spec-first init --claude` → `/spec:mcp-setup` → 重启 Claude Code → `/spec:bootstrap`

## 快速开始

### 先决条件

- Node.js `>=20`
- **Claude Code** 或 **Codex** 至少安装一个

### 1. 安装 CLI

```bash
npm install -g spec-first
spec-first -v
```

### 2. 检查环境

```bash
spec-first doctor
spec-first doctor --claude
spec-first doctor --codex
```

### 3. 在目标项目中初始化

```bash
spec-first init --claude
# 或
spec-first init --codex
```

如果 `doctor` 报告 `legacy managed state`，或者 `clean` 明确拒绝处理 legacy 安装，不要先手动删除运行时目录，直接重新运行对应平台的 `spec-first init`。当前升级策略是 hard cut：

- `init` 是唯一受支持的 legacy 升级入口
- `init` 会先执行 managed hard reset，再全量重建运行时
- `clean` 只负责移除当前受管资产，不承担 legacy state 迁移

如需显式指定开发者身份：

```bash
spec-first init --claude -u <name> --lang <zh|en>
spec-first init --codex -u <name> --lang <zh|en>
```

身份解析规则：

- 未提供 `-u/--user` 时，优先读取全局 `~/.spec-first/.developer`
- 若全局配置不存在，则回退到 `git config user.name`
- 未提供 `--lang` 时，优先沿用当前项目 `.developer`，再回退到全局配置，最后默认 `zh`

### 4. 开始工作流

#### Claude Code 首次使用

```text
# 第一步：初始化项目运行时
spec-first init --claude

# 第二步：安装 MCP 工具
/spec:mcp-setup

# 第三步：重启 Claude Code

# 第四步：生成项目上下文
/spec:bootstrap

# 可选：图谱驱动入口
/spec:graph-bootstrap

# 进入主工作流
/spec:ideate
/spec:brainstorm
/spec:plan
/spec:work
/spec:review
/spec:compound
```

`/spec:bootstrap` 在启动时会执行 Host Readiness Gate。如果跳过 `/spec:mcp-setup` 或未重启 Claude Code，它会直接给出明确提示并停止，不会静默降级。

#### Codex

```text
# 第一步：初始化项目运行时
spec-first init --codex

# 第二步：生成项目上下文
$spec-bootstrap

# 可选：图谱驱动入口
$spec-graph-bootstrap

# 进入主工作流
$spec-ideate
$spec-brainstorm
$spec-plan
$spec-work
$spec-review
$spec-compound
```

## 实际效果

```bash
$ spec-first init --claude

📋 Wrote language policy to CLAUDE.md
🧭 Wrote using-spec-first bootstrap to CLAUDE.md
🪝 Installed Claude SessionStart matcher in .claude/settings.json
📦 Generated 13 command file(s) in .claude/commands/spec
🧩 Generated 35 skill directory(ies) in .claude/skills
🤖 Generated 57 agent file(s) in .claude/agents
🧰 Generated 4 agent support file(s) in .claude/agents
🪪 Wrote project developer profile:
  📍 path: .claude/spec-first/.developer
  👤 name: yourname
  🈯 lang: zh
  ⏱ initialized_at: 2026-04-15T00:00:00.000Z
  🔖 version: 1.5.1

🔁 Restart Claude Code after generation so it can pick up the new /spec:* commands.
```

初始化完成后，通常的首次路径是：

```text
Claude Code: /spec:mcp-setup → restart → /spec:bootstrap → /spec:ideate → /spec:brainstorm → /spec:plan → /spec:work → /spec:review → /spec:compound
Codex:       $spec-bootstrap → $spec-ideate → $spec-brainstorm → $spec-plan → $spec-work → $spec-review → $spec-compound
```

如需 graph-informed 的 Stage-0 路径，可额外使用 `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap`。它覆盖 Phase 0-4 的事实抽取与上下文生成，而 `bootstrap` 仍是默认稳定入口。

## 为什么需要 Spec-First

大多数 AI 编程失败，不是因为模型不够强，而是因为工程边界不稳定：

- 需求没有被明确表达
- 计划与实现容易漂移
- 评审缺少结构化结论
- 已解决问题没有沉淀成下一轮可复用知识

Spec-First 关注的是完整交付闭环，而不是单次回答：

- 用 `doctor / init / clean` 管理项目运行时资产
- 用 `/spec:*` 与 `$spec-*` 提供稳定入口
- 用 Stage-0 与多阶段工作流约束执行
- 用结构化评审与知识沉淀提升下一轮质量

## 你会得到什么

| 能力 | 说明 |
|------|------|
| 双平台支持 | 同时支持 Claude Code 与 Codex |
| CLI 控制面 | 用 3 个核心命令管理安装、诊断与清理 |
| 工作流层 | 内置 Stage-0、Ideate、Brainstorm、Plan、Work、Review、Compound |
| 能力层 | 内置 `48` 个 skills、`57` 个 agents、`4` 个 agent support files |
| 运行时治理 | 受管运行时资产可同步、恢复、更新、清理 |
| 开放文档 | 提供用户手册、架构文档、方案文档与经验沉淀 |

## 核心工作流

<p align="center">
  <img src="./docs/assets/svg/spec-first-workflow.svg" alt="Spec-First workflow">
</p>

| 阶段 | Claude Code | Codex | 目标 | 主要产物 |
|------------|-------------|-------|-----------|--------------------|
| 宿主准备 | `/spec:mcp-setup` → 重启 Claude Code | — | 安装并配置 MCP 工具链，写入宿主就绪标记 | `~/.claude/spec-first/host-setup.json` |
| Stage-0 | `/spec:bootstrap`（稳定）<br>`/spec:graph-bootstrap`（图谱驱动） | `$spec-bootstrap`（稳定）<br>`$spec-graph-bootstrap`（图谱驱动） | 建立长期项目上下文 | `docs/contexts/<slug>/` |
| Ideate | `/spec:ideate` | `$spec-ideate` | 发散候选方向并排序 | `docs/ideation/*.md` |
| Brainstorm | `/spec:brainstorm` | `$spec-brainstorm` | 澄清需求、收敛范围、明确验收 | `docs/brainstorms/*.md` |
| Plan | `/spec:plan` | `$spec-plan` | 制定实施方案、拆解任务、识别风险 | `docs/plans/*.md` |
| Work | `/spec:work` | `$spec-work` | 按计划实现并补齐测试/文档 | code + tests |
| Review | `/spec:review` | `$spec-review` | 产出结构化评审结论 | review report |
| Compound | `/spec:compound` | `$spec-compound` | 沉淀为可复用知识资产 | `docs/solutions/**/*.md` |

<p align="center">
  <img src="./docs/assets/svg/workflow-end-to-end.svg" alt="Spec-First end-to-end workflow">
</p>

## 架构视图

<p align="center">
  <img src="./docs/assets/svg/three-layer-architecture.svg" alt="Three-layer architecture">
</p>

Spec-First 的核心，不是往模型里塞更多 prompt，而是建立稳定的三层系统：

1. 入口层
   `spec-first` CLI 负责环境检查、平台运行时初始化和受管资产清理。
2. 工作流层
   Skills 定义阶段边界、输入输出契约和执行顺序。
3. 能力层
   Agents 提供评审、研究、设计、文档和专项分析能力。

对应的项目运行时模型如下：

<p align="center">
  <img src="./docs/assets/svg/spec-first-runtime-assets.svg" alt="Runtime assets">
</p>

## CLI 命令

| 命令 | 用途 | 说明 |
|------|------|------|
| `spec-first doctor` | 环境检查 | 检查本地环境、平台状态、插件清单与受管资产；`--claude` / `--codex` 可指定单平台；若发现 legacy managed state，会明确提示改用 `init` 执行 hard reset |
| `spec-first init` | 初始化运行时 | 向当前项目同步 commands、standalone skills、workflow skills、agents、agent support files 与开发者元数据；也是唯一支持的 legacy 升级入口 |
| `spec-first clean` | 清理运行时 | 移除当前 Spec-First 受管资产，保留非受管内容；不负责 legacy state 迁移 |

查看帮助：

```bash
spec-first --help
```

## 适用场景

- 希望让 AI 在动手前先理解项目
- 希望把 `需求 → 计划 → 实施 → 评审 → 沉淀` 变成团队级流程
- 希望为 AI 输出加入结构化评审和多视角质量门禁
- 希望把已解决问题沉淀为后续可复用输入
- 希望在 Claude Code 和 Codex 之间复用一致方法论

## 开源仓库模型

这个仓库同时是：

- 一个可发布的 `npm` CLI 包
- 一套可版本化的 workflow assets 源仓库
- 一个持续演进 AI 工程方法论的开源项目

`skills/`、`agents/`、`templates/` 和 `docs/` 是 source-of-truth。运行时复制到 `.claude/`、`.codex/` 或 `.agents/` 的内容属于生成结果，不是手工编辑入口。

## 文档导航

### 推荐阅读路径

- 第一次使用：[用户手册](./docs/05-用户手册/README.md) → [快速开始](./docs/05-用户手册/01-快速开始.md) → [核心概念](./docs/05-用户手册/02-核心概念.md)
- 遇到问题：[常见问题](./docs/05-用户手册/04-常见问题.md) → [最佳实践](./docs/05-用户手册/05-最佳实践.md)
- 想参与开发：[整体架构](./docs/02-架构设计/01-整体架构.md) → [开发规范](./docs/03-实施方案/06-开发规范.md) → [测试方案](./docs/03-实施方案/04-测试方案.md)

### 用户文档

- [英文 README](./README.md)
- [用户手册](./docs/05-用户手册/README.md)
- [快速开始](./docs/05-用户手册/01-快速开始.md)
- [核心概念](./docs/05-用户手册/02-核心概念.md)
- [完整示例](./docs/05-用户手册/03-完整示例.md)
- [常见问题](./docs/05-用户手册/04-常见问题.md)
- [最佳实践](./docs/05-用户手册/05-最佳实践.md)
- [本地源码安装](./docs/05-用户手册/06-本地源码安装.md)

### 设计与实现

- [整体架构](./docs/02-架构设计/01-整体架构.md)
- [目录结构](./docs/02-架构设计/02-目录结构.md)
- [Agent Workflow Patterns](./docs/02-架构设计/03-agent-workflow-patterns.md)
- [开发规范](./docs/03-实施方案/06-开发规范.md)
- [测试方案](./docs/03-实施方案/04-测试方案.md)
- [版本更新说明](./docs/08-版本更新/README.md)

## 本地开发

```bash
git clone https://github.com/sunrain520/spec-first.git
cd spec-first
npm test
```

常用验证命令：

```bash
npm run test:smoke
npm run test:integration
bash tests/unit/lang-policy.sh
bash tests/unit/mcp-setup.sh
npm pack
```

## 贡献

欢迎提交 Issue 和 Pull Request。

报告问题请在 [Issues](https://github.com/sunrain520/spec-first/issues) 中提供复现步骤、环境信息和期望行为。

提交代码建议按以下步骤：

1. Fork 仓库并从 `main` 创建特性分支
2. 阅读 [AGENTS.md](./AGENTS.md) 了解仓库协作规范
3. 运行 `npm test`
4. 提交 PR，并说明变更目标和验证方式

贡献前建议先阅读：

- [AGENTS.md](./AGENTS.md)
- [用户手册](./docs/05-用户手册/README.md)
- [版本更新说明](./docs/08-版本更新/README.md)

## License

[MIT](./LICENSE) © [sunrain520](https://github.com/sunrain520)
