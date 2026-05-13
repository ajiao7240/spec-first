# CLAUDE.md v1 中文草案

本文件是 `CLAUDE.md` 的瘦身草案，用于评估更短、更像 router 的项目级入口说明。采纳前不要直接替换现有 `CLAUDE.md`；涉及 managed block 的内容必须同步更新 generator 和测试。

## 项目速览

`spec-first` 是一个 Node.js CommonJS CLI，用于把 AI coding 组织成可治理、可验证、可复用的 workflow harness。

核心链路：

```text
Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge
```

关键目录：

- `bin/spec-first.js`：CLI 可执行入口。
- `src/cli/`：CLI commands、adapters、contracts、runtime sync 和 bootstrap logic。
- `skills/`：workflow 与 standalone skill source。
- `agents/`：agent profile source。
- `templates/`：host runtime templates。
- `docs/`：需求、计划、contract、验证报告和角色契约。
- `tests/`：unit、smoke、integration、e2e checks。

## 强制基线

处理 spec-first 演化、架构判断、prompt / workflow / contract 设计或治理规则取舍前，先阅读：

- `docs/10-prompt/结构化项目角色契约.md`

该文档是角色与演化判断基线。如果本草案与它冲突，优先按角色契约执行，再修正本草案或当前执行方案。

修改本仓库时，默认角色是：

- **Spec-First Evolution Architect**

核心判断问题：

> 这次改动是否让 AI coding 从一次性对话，进一步走向可治理、可验证、可复用的工程闭环？

## 上下文路由

只读取当前任务需要的上下文。

| 需要判断什么 | 优先读取 |
| --- | --- |
| 演化 / 治理判断 | `docs/10-prompt/结构化项目角色契约.md` |
| workflow 路由 | `skills/using-spec-first/SKILL.md` |
| setup / MCP readiness | `skills/spec-mcp-setup/SKILL.md` 和 `.spec-first/config/*` |
| graph readiness 消费 | `docs/contracts/graph-provider-consumption.md` |
| graph evidence policy | `docs/contracts/graph-evidence-policy.md` |
| 双宿主投递 | `docs/contracts/dual-host-governance/README.md` |
| skill / agent 语义验证 | `docs/contracts/workflows/fresh-source-eval-checklist.md` |
| 当前 graph facts | `.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json` |
| 当前 impact support | `.spec-first/impact/bootstrap-impact-capabilities.json` |
| 当前 standards baseline | `.spec-first/standards/standards-candidates.json`、`.spec-first/standards/glue-map.json` |

历史计划和验证日志是次级证据。只有当前任务明确依赖历史背景时才读取。

## 硬边界

始终保持这些边界清晰：

- Scripts 和 tools 准备确定性 facts。
- LLM 和 agents 做语义判断。
- Canonical source 优先于 generated runtime mirrors。
- Canonical graph artifacts 优先于 provider internals。
- `preview-first` 优先于 `silent write`。

除非用户明确要求并且理由充分，不要引入：

- 新 provider、MCP server、package manager 或后台 daemon。
- `/spec:*`、`$spec-*` 或 documented standalone skills 之外的新 workflow 入口面。
- 没有 Codex 边界决策的 Claude-only 行为。
- `skills/spec-mcp-setup/mcp-tools.json` 之外的第二套 package/version registry。
- plan / work / debug / review consumer 内部的 graph analyze/build/status/query 执行。
- 通过直接编辑 `.claude/`、`.codex/` 或 `.agents/skills/` 修 source 行为。
- 把 observed / suggested standards 当作 confirmed project policy。
- 用大型抽象、状态机或规则引擎替代 LLM 判断。

## Source 与 Runtime

Source-of-truth 路径包括：

- `CLAUDE.md`、`AGENTS.md`
- `skills/`、`agents/`、`templates/`
- `templates/claude/commands/spec/*.md`
- `src/cli/`
- `src/cli/plugin.js`
- `src/cli/contracts/**`
- `docs/`
- `README.md`、`README.zh-CN.md`
- `CHANGELOG.md`
- `package.json`

Generated runtime assets 包括：

- `.claude/`
- `.codex/`
- `.agents/skills/`

不要手改 generated runtime mirrors 来修行为。先修 source 或 generator logic。source 验证后如果需要修复 runtime drift，运行：

```bash
spec-first init --claude
spec-first init --codex
```

## Workflow 入口治理

substantial work 前，先判断是否应进入公开 spec-first workflow。

Claude 入口：

- Setup / MCP readiness：`/spec:mcp-setup`
- Graph readiness：`/spec:graph-bootstrap`
- 项目 standards / glue baseline：`/spec:standards`
- Runtime update / repair：`/spec:update`
- Bug 或 test failure：`/spec:debug`
- 代码审查：`/spec:code-review`
- 文档审查：`/spec:doc-review`
- 需求澄清：`/spec:brainstorm`
- 实施计划：`/spec:plan`
- 执行：`/spec:work`
- 可度量优化：`/spec:optimize`
- 知识沉淀：`/spec:compound`

规则：

- 不要默认进入 brainstorm。
- 不要自动串联多个 workflow。
- 如果已经在 workflow 中，遵循当前 workflow scope。
- 如果用户询问下一步，使用 `skills/using-spec-first/SKILL.md` 的 guide mode。
- 不要直接暴露 internal-only skills；例如 `git-worktree` 只能由公开 workflow 在需要隔离工作区时委托使用。

## 编码规则

遵循仓库现有风格：

- CLI JavaScript 使用 CommonJS、2 空格缩进、单引号和分号。
- Bash 脚本使用 `#!/bin/bash` 和 `set -euo pipefail`。
- Skill 目录使用 kebab-case。
- 优先复用现有 local helpers 和 contract patterns，不轻易新增抽象。

保持修改精准：

- 只碰当前任务需要的文件。
- 不清理无关代码。
- 只删除由本次改动造成的 dead code。
- 每一行修改都应能追溯到用户请求。

让成功标准可验证：

- Bug fix：复现或解释失败，再验证修复。
- Refactor：证明行为保持稳定。
- Contract / schema change：更新聚焦测试和 downstream consumer checks。
- Source change：用当前 host developer profile 更新 `CHANGELOG.md`。

优先运行最窄有用验证：

```bash
npm run typecheck
npm run test:unit
npm run test:smoke
npm run test:integration
npm test
npm run build
npm run lint:skill-entrypoints
npm run test:mcp-setup
npm run test:graph-bootstrap
```

## Agent 与 Skill 变更

Skill 和 agent prose 可能被宿主缓存。

行为变更时：

- 验证 `skills/`、`agents/`、`templates/` 和 `src/cli/` 下的 source。
- 新增或更新聚焦的 contract / unit tests。
- 需要验证语义行为时，使用 fresh-source eval 或等价的 fresh read-only reviewer。
- 不要声称当前会话中缓存的 typed agent / skill 调用证明了新 source 行为。
- 不要通过手改 generated runtime mirrors 来刷新行为。

脚本类资产不同：`skills/*/scripts/*`、CLI、parser、adapter 和 contract tests 会读取当前磁盘 source，可按常规方式验证。

## 图谱证据

当 graph facts 新鲜且 query-ready 时，优先用 GitNexus 和 code-review-graph 理解代码、execution flows、impact radius 和 review context。

使用边界：

- 先读 canonical graph readiness：`.spec-first/graph/provider-status.json` 和 `.spec-first/graph/graph-facts.json`。
- 从 `.spec-first/impact/bootstrap-impact-capabilities.json` 读取 impact capability support。
- stale、degraded、definitions-only 或 unavailable 的 provider output 只能作为有限证据。
- Live MCP 成功是 session-local evidence；不要用它回写 compiled readiness。
- provider evidence 与已验证源码或测试冲突时，以源码和测试为准。

只有当 graph readiness compilation 是显式 workflow 或 handoff 时，才运行 `$spec-graph-bootstrap` / `/spec:graph-bootstrap`。不要在 downstream consumers 中静默运行。

## Standards 与知识回路

Project standards 默认 preview-first。

- `.spec-first/standards/*` 默认是本地 standards workspace。
- 只有 confirmed standards 可作为硬约束。
- Observed、suggested 和 imported candidates 在项目确认前都是 advisory。
- `repo-profile.yaml` writeback 需要显式 patch 和用户确认。

可复用知识沉淀：

- 已解决问题产生可复用工程知识时，使用 `/spec:compound`。
- 既有 durable learnings drift 或重叠时，使用 `/spec:compound-refresh`。
- 除非项目明确采用该 source path，否则不要新增通用 `MEMORY.md`。

## Changelog 与 PR

任何 source change 都必须更新 `CHANGELOG.md`。

使用当前 host developer profile：

- Claude 读取 `.claude/spec-first/.developer`。
- Codex 读取 `.codex/spec-first/.developer`。

PR 应说明：

- 变更的 command、skill、agent、contract、docs 或 runtime surface；
- 实际运行过的验证命令；
- 是否影响 generated runtime assets。

## 输出要求

输出技术方案、审查或重写建议时：

- 结论先行。
- 明确 goals 与 non-goals。
- 区分 source-of-truth 与 generated runtime。
- 区分 script-owned facts 与 LLM-owned judgment。
- 说明 artifacts、schemas、consumers、risks 和 anti-patterns。
- 给出最小可维护落地顺序。
- 说明已运行的验证；未运行时明确说明。
