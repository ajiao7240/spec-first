# Repository Guidelines

## 强制前置阅读

在处理本仓库中任何涉及 spec-first 演化、架构判断、prompt / workflow / contract 设计、治理规则取舍的工作前，必须先阅读 `docs/10-prompt/项目角色.md`。

`docs/10-prompt/项目角色.md` 是当前项目的角色定义与判断基线，优先用于校准系统目标、边界划分、脚本与 LLM 的职责分工，以及对“轻 contract + 明确边界 + 让 LLM 决策”的理解。

如果本文件后续内容与该文档的理解发生冲突，优先按 `docs/10-prompt/项目角色.md` 对齐后再继续执行。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure & Module Organization

`spec-first` 是一个 Node.js CLI。可执行入口在 `bin/spec-first.js`，主源码在 `src/cli/`。仓库中的 `skills/` 和 `agents/` 是 workflow 资产的源码；运行时生成到 `.claude/` 和 `.codex/` 的副本不是 source of truth。文档放在 `docs/`，模板放在 `templates/`，辅助脚本放在 `scripts/`，第三方 parser 依赖放在 `vendor/`。测试按层分在 `tests/unit/`、`tests/smoke/`、`tests/integration/`、`tests/e2e/`。

## Build, Test, and Development Commands

- `npm test`：运行主测试链路，包含 unit、smoke、integration 和 CRG e2e。
- `npm run test:unit`：执行 shell 单测和 Jest 单测。
- `npm run test:smoke`：验证 CLI help、`init`、`doctor` 等核心安装路径。
- `npm run test:integration`：运行端到端 workflow 检查。
- `npm run typecheck`：用 `node --check` 做语法检查。
- `npm run build`：执行 `npm pack --dry-run`，确认发布包内容。

## Coding Style & Naming Conventions

CLI 代码使用 CommonJS、2 空格缩进、单引号和分号。延续现有目录拆分方式，例如 `commands/`、`adapters/`、`helpers/`。Shell 脚本使用 `#!/bin/bash` 和 `set -euo pipefail`。技能目录使用 kebab-case，例如 `spec-graph-bootstrap`。不要手改 `.claude/` 或 `.codex/` 下的生成资产；修改 `skills/`、`agents/` 或 `src/cli/` 后再通过 `spec-first init --claude|--codex` 重建。

## Testing Guidelines

优先补最窄的测试层来证明变更，再根据影响面扩大验证。新增测试文件应放到对应层级目录，命名保持现有模式，例如 `*.test.js` 或 `tests/<layer>/*.sh`。涉及 runtime 生成、host 治理或安装行为的改动，至少运行相关 smoke 测试；影响发布物时再跑 `npm run build` 和 `npm test`。

## Agent 与 Skill 变更验证

对 `agents/` 或 `skills/` 下 agent / skill prose 的行为性修改，验证方式不同于普通代码。宿主通常会在会话启动时加载 agent / skill 定义；同一会话内直接调用已加载的 runtime agent 或 skill，可能仍在测试旧内容。

- 优先验证源码真相源：直接读取并检查 `agents/`、`skills/`、`templates/`、`src/cli/` 中的源码文件，补对应 contract/unit 测试。
- 行为性 prose 需要语义验证时，使用 fresh-source eval：把当前磁盘上的目标 agent / skill 源文件内容注入到一个全新通用 subagent 的 prompt 中评估，或用等价的只读 fresh subagent 读取源码后执行评审；不要依赖当前会话已缓存的 typed-agent / skill 调用。
- 不要手改 `.claude/`、`.codex/`、`.agents/skills/` 下的生成资产来“强制刷新”。这些目录由 `spec-first init --claude|--codex` 管理，手改会制造 source/runtime drift。
- 若必须验证宿主加载后的行为，先通过 `spec-first init --claude|--codex` 重建 runtime，再在新会话中测试；不要把同一会话内的 typed-agent / skill 调用当作刚修改 prose 的充分验证。
- 脚本类资产不受会话缓存限制。`skills/*/scripts/*`、CLI、parser、adapter、contract 测试都会读取当前磁盘源码，可用常规测试验证。

## Commit & Pull Request Guidelines

提交信息遵循 Conventional Commits，并常带任务前缀，例如 `[TASK-BOOTSTRAP-001] feat(init): ...` 或 `fix(release): ...`。PR 需要说明改动的命令、skill 或 agent，列出实际执行过的验证命令，并注明是否影响生成资产。只有视觉文档或 UI 资产变更时才附截图。

<!-- spec-first:lang:start -->
## 语言与治理策略（由 spec-first 管理）

**语言设置：** `Chinese / 中文`

### 语言规则
- 默认输出语言是 **中文（Chinese）**。除非用户明确要求翻译、双语或指定其他语言，所有新生成的自然语言内容必须使用中文
- 严格适用范围包括：回复、状态更新、问题澄清、生成文档、需求/计划/任务、评审意见、总结、变更说明、commit/PR 文案等
- 如果输入、工具输出或被引用材料是其他语言，除非需要保留原文引用，新生成的说明、归纳和结论仍必须使用中文
- 允许混用英文技术术语，不要求强行翻译常见技术词
- 代码标识符（变量、函数、类、模块、文件名中的技术标识）保持英文
- 新增代码注释使用中文，简洁清晰，不写空洞注释
- 代码、命令、路径、配置键、环境变量名、API 名称、协议名等技术标识不因语言偏好而被翻译

### Changelog 治理规则
**代码变动铁律（无例外）**
- 任何对项目源码的新增、删除、修改，必须同步在项目根目录 `CHANGELOG.md` 中添加一条记录
- 无此记录的代码变动，一律拒绝生成
- 记录格式以仓库现行格式为准
- `作者` 必须使用当前 host 的项目级 developer profile：Codex 读取 `.codex/spec-first/.developer`，Claude 读取 `.claude/spec-first/.developer`；如果缺失，先运行对应的 `spec-first init --codex|--claude -u <name> --lang <zh|en>`
- **示例：** `- vX.Y.Z YYYY-MM-DD 作者: 一句话摘要`
- 用户可见变更在末尾追加 `(user-visible)`
<!-- spec-first:lang:end -->

<!-- spec-first:bootstrap:start -->
## Workflow 入口治理（由 spec-first 管理）

- 本 block 是 spec-first workflow 入口提醒；`using-spec-first` 是 standalone meta skill，不是 workflow command
- 修改文件、运行会改变状态的命令、或做架构/prompt/workflow 决策前，先判断是否应进入公开 spec-first workflow；轻量问答和窄事实查询可直接回答
- 按当前用户意图选择一个最匹配入口；不要默认进入 `spec-brainstorm`，也不要自动串联多个 workflow
- 如果已经在 spec-first workflow 中或作为 bounded subagent 执行，遵循当前 workflow/父任务范围，不重新入口分流
- Codex workflow 入口使用 `$spec-*`
- 不要把 `using-spec-first` 写成 `/spec:*` 或 command-backed workflow
- 常见入口锚点：环境/MCP→`$spec-mcp-setup`；graph readiness 编译→`$spec-graph-bootstrap`；更新/runtime 修复→`$spec-update`；bug/失败→`$spec-debug`；代码/文档评审→`$spec-code-review`/`$spec-doc-review`；需求/计划/任务编译/执行→`$spec-brainstorm`/`$spec-plan`/`spec-write-tasks`（standalone skill）/`$spec-work`；可度量优化→`$spec-optimize`
- 完整选择策略、优先级和 red flags 由 spec-first 随包的 `using-spec-first` 维护；本 block 只保留启动提醒、host 入口边界和少量锚点
- 不要直接暴露 internal-only skills：`spec-session-inventory`、`spec-session-extract`
<!-- spec-first:bootstrap:end -->

<!-- spec-first:coding-guidelines:start -->
## 编码执行准则（由 spec-first 管理）

这些准则只约束进入工作后的执行姿势，不替代 `using-spec-first` 的 workflow 入口治理。

### 先想清楚再动手
- 当假设会影响实现或验证时，必须先显式说明假设。
- 如果存在 2 条及以上会实质影响行为、接口、数据结构或错误语义的路径，先说明 tradeoff，再继续执行。
- 如果更简单的做法能解决当前任务，优先采用更简单的做法。
- 如果不明确之处会实质影响实现或验证，先澄清，再编码。

### 先做最小可行改动
- 只实现当前任务真正需要的最小代码。
- 不新增未被请求的功能、配置项或单次使用的抽象。
- 不为当前任务没有证据支持的失败模式添加 speculative guard 或 fallback。

### 改动要保持手术式边界
- 只修改完成当前任务所必需的文件和行为切片。
- 遵循当前文件和局部模块的既有风格与模式。
- 清理本次改动自己引入且随即失效的 unused imports / variables / functions。
- 不要在未被请求时重构、删除或顺手清理无关的既有代码。

### 用可验证目标收口
- 在 substantial work 前先明确 done signals。
- 修 bug 或改行为时，优先使用测试或其他可重复验证方式证明变更。
- 先验证目标改动，再验证相邻受影响行为。
<!-- spec-first:coding-guidelines:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **spec-first** (19990 symbols, 22564 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/spec-first/context` | Codebase overview, check index freshness |
| `gitnexus://repo/spec-first/clusters` | All functional areas |
| `gitnexus://repo/spec-first/processes` | All execution flows |
| `gitnexus://repo/spec-first/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
