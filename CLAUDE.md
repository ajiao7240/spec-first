# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 强制前置阅读

在处理本仓库中任何涉及 spec-first 演化、架构判断、prompt / workflow / contract 设计、治理规则取舍的工作前，必须先阅读 `docs/10-prompt/项目角色.md`。

`docs/10-prompt/项目角色.md` 是当前项目的角色定义与判断基线，优先用于校准系统目标、边界划分、脚本与 LLM 的职责分工，以及对“轻 contract + 明确边界 + 让 LLM 决策”的理解。

如果本文件后续内容与该文档的理解发生冲突，优先按 `docs/10-prompt/项目角色.md` 对齐后再继续执行。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用开发命令

- `npm run typecheck`：对 CLI 与关键脚本做 `node --check` 语法检查。
- `npm run build`：执行 `npm pack --dry-run`，验证发布包内容。
- `npm test`：运行主测试链路，覆盖 unit、smoke、integration、CRG e2e。
- `npm run test:unit`：运行 shell 单测与 Jest 单测。
- `npm run test:smoke`：验证安装、本地 init、CLI 主路径等烟雾测试。
- `npm run test:integration`：运行 verification gate + workflow 级集成测试。
- `npm run test:e2e:crg`：运行 CRG 端到端脚本。
- `npm run test:jest -- tests/unit/crg-parser.test.js --runInBand`：运行单个 Jest 测试文件。
- `npx jest tests/unit/crg-parser.test.js --runInBand -t "parser"`：运行单测文件中的单个测试用例。
- `npm run lint:skill-entrypoints`：校验 skill / workflow 入口治理。
- `spec-first --help`：查看 package CLI 命令面。
- `spec-first doctor --claude` / `spec-first doctor --codex`：检查宿主侧运行时资产与状态。
- `spec-first init --claude` / `spec-first init --codex`：把源码资产同步成宿主运行时资产。
- `spec-first clean --claude` / `spec-first clean --codex`：移除 spec-first 管理的宿主资产。
- `spec-first crg --help`：查看 CRG 子命令。
- `spec-first crg build --repo .`：构建或刷新 Code Review Graph。
- `spec-first stage0-context --stage plan --workflow spec-plan --format json`：输出指定 stage 的 Stage-0 上下文。

## 架构总览

`spec-first` 是一个 Node.js CommonJS CLI。包级入口在 `bin/spec-first.js`：普通命令走 `src/cli/index.js`，`crg` 子命令单独延迟加载到 `src/crg/cli/router.js`，避免影响 `init/doctor/clean` 启动速度。

仓库可以按四层理解：

1. **CLI 控制面**：`src/cli/commands/` 实现 `doctor / init / clean / stage0-context`。这层负责可重复、确定性的宿主资产同步、状态检查、初始化与清理。
2. **Bootstrap / Context 层**：`src/bootstrap-compiler/` 与 `src/context-routing/` 负责把代码库事实编译成 Stage-0 上下文，包括 `minimal-context`、`injection-index`、quality/fallback/verification 信号。这层的目标是提高 LLM 的输入质量，而不是替代 LLM 决策。
3. **CRG 图引擎**：`src/crg/` 提供基于 SQLite + FTS5 的 Code Review Graph 能力，负责 AST/符号/边关系、影响分析、review-context、community、flow 等检索与分析。
4. **Workflow 资产源码**：`skills/`、`agents/`、`templates/` 是 source of truth；`spec-first init` 会把它们转换并同步到 `.claude/`、`.codex/`、`.agents/skills/` 等宿主目录。**不要直接编辑生成出来的运行时资产。**

## 关键目录与职责

- `bin/`：CLI 可执行入口与安装后处理脚本。
- `src/cli/`：包级 CLI、平台 adapter、插件清单装载、指令注入、状态管理。
- `src/bootstrap-compiler/`：Phase 0–4 事实提取与 machine artifacts / minimal-context 编译。
- `src/context-routing/`：Stage-0 evaluator、verification evidence、selection context、fallback 与 telemetry。
- `src/crg/`：CRG 图构建、查询、review-context、增量刷新与检索打包。
- `skills/`：workflow/standalone skill 源码。
- `agents/`：review / research / design / docs 等 agent profile 源码。
- `templates/`：宿主运行时模板，例如 Claude SessionStart hook。
- `tests/`：按 `unit / smoke / integration / e2e / contracts` 分层；`tests/fixtures/` 提供 parser、benchmark、graphignore 等测试仓库。
- `vendor/`：本地 vendored tree-sitter 依赖。

## 运行时与源码边界

`init` 的核心不是“执行 workflow”，而是**根据插件清单与平台 adapter，同步运行时资产**。

- Claude 侧运行时根在 `.claude/`，命令入口在 `.claude/commands/spec/`，skills 在 `.claude/skills/`，agents 在 `.claude/agents/`。
- Codex 侧运行时根在 `.codex/`，用户可见 skills 在 `.agents/skills/`，agents 在 `.codex/agents/`。
- 平台差异由 `src/cli/adapters/claude.js` 与 `src/cli/adapters/codex.js` 负责，包括路径重写、agent 名称改写、运行时文件同步与清理策略。
- 资产清单与治理真相源在 `.claude-plugin/plugin.json` 和 `src/cli/contracts/dual-host-governance/skills-governance.json`；如果命令、skill、agent 是否应该下发到哪个宿主有疑问，优先看这两个文件。

## 重要开发约束

- 本仓库的设计目标是**提升 LLM 决策输入质量**，不要把语义决策硬编码成状态机或规则引擎。
- 脚本负责确定性工作：同步资产、校验状态、生成工件、发出 quality signal。
- Skill / agent / template 变更后，不要手改生成产物；应修改源码后通过 `spec-first init --claude|--codex` 验证生成结果。
- `doctor` / `init` / `clean` 依赖 managed state；涉及 runtime 治理的改动通常需要同时检查 `src/cli/commands/`, `src/cli/plugin.js`, `src/cli/state.js`, 以及对应 adapter。
- 任何源码改动都必须同步更新根目录 `CHANGELOG.md`。

## 测试与验证策略

- 改 CLI 参数、状态文件、运行时同步逻辑：至少跑相关 unit 测试和 smoke 测试。
- 改 skill / agent 治理、入口映射、contract：先跑 `npm run lint:skill-entrypoints`，再补对应 contract/unit 测试。
- 改 Stage-0 / verification / context routing：跑 `npm run test:integration`，必要时补 `tests/unit/*verification*` 与 `tests/unit/*context*`。
- 改 CRG 图构建、检索或 SQLite 逻辑：跑相关 `tests/unit/crg-*.test.js`，并视影响面执行 `npm run test:e2e:crg`。
- 改发布物、打包内容、安装路径：至少跑 `npm run build`、相关 smoke/release 测试。

## Agent 与 Skill 变更验证

对 `agents/` 或 `skills/` 下 agent / skill prose 的行为性修改，验证方式不同于普通代码。宿主通常会在会话启动时加载 agent / skill 定义；同一会话内直接调用已加载的 runtime agent 或 skill，可能仍在测试旧内容。

- 优先验证源码真相源：直接读取并检查 `agents/`、`skills/`、`templates/`、`src/cli/` 中的源码文件，补对应 contract/unit 测试。
- 行为性 prose 需要语义验证时，使用 fresh-source eval：把当前磁盘上的目标 agent / skill 源文件内容注入到一个全新通用 subagent 的 prompt 中评估，或用等价的只读 fresh subagent 读取源码后执行评审；不要依赖当前会话已缓存的 typed-agent / skill 调用。
- 不要手改 `.claude/`、`.codex/`、`.agents/skills/` 下的生成资产来“强制刷新”。这些目录由 `spec-first init --claude|--codex` 管理，手改会制造 source/runtime drift。
- 若必须验证宿主加载后的行为，先通过 `spec-first init --claude|--codex` 重建 runtime，再在新会话中测试；不要把同一会话内的 typed-agent / skill 调用当作刚修改 prose 的充分验证。
- 脚本类资产不受会话缓存限制。`skills/*/scripts/*`、CLI、parser、adapter、contract 测试都会读取当前磁盘源码，可用常规测试验证。

## 提交前注意

- 先确认自己修改的是源码真相源，不是宿主生成目录。
- 如果改动影响用户可见行为、命令面或宿主资产生成，补 `CHANGELOG.md`。
- 如果改动影响 README/AGENTS/CLAUDE 中的治理表述，确保与 `docs/10-prompt/项目角色.md` 一致，不要引入“强编排”或“状态机优先”的叙述。

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
- Claude workflow 入口使用 `/spec:*`
- 不要把 `using-spec-first` 本身当作 command-backed workflow
- 常见入口锚点：环境/MCP→`/spec:mcp-setup`；graph readiness 编译→`/spec:graph-bootstrap`；更新/runtime 修复→`/spec:update`；bug/失败→`/spec:debug`；代码/文档评审→`/spec:code-review`/`/spec:doc-review`；需求/计划/任务编译/执行→`/spec:brainstorm`/`/spec:plan`/`spec-write-tasks`（standalone skill）/`/spec:work`
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

<!-- spec-first:runtime-tools:start -->
## 代码智能与运行时工具（由 spec-first 管理）

`spec-mcp-setup` 管理本项目推荐/必需的 MCP servers、graph-provider MCP servers 与 helper tooling。完整工具清单、安装命令、host-specific notes 与 readiness ledger 语义统一收口在 `.claude/skills/spec-mcp-setup/references/supported-mcp-tools.md`。

### 使用边界
- `GitNexus`：用于全局代码知识图谱、架构理解、影响分析和提交前变更检测。若本文件存在 `<!-- gitnexus:start -->` 管理块，优先遵守该块的强制规则。
- `code-review-graph`：用于最小上下文、impact radius、review context、相关测试和 graph stats。只有 canonical graph facts / provider readiness 已 query-ready 且未 stale 时使用；blocked、stale 或未 ready 时先运行 `/spec:graph-bootstrap`，或退回 bounded direct repo reads。
- `Serena MCP`：用于 symbol overview、symbol lookup、references、LSP 辅助定位和精确编辑。它是上下文/编辑辅助，不替代源码真相源、测试或 graph-level 影响分析。
- `ast-grep`：用于结构化代码搜索和安全 rewrite。简单文本/文件搜索仍优先 `rg` / `rg --files`；需要 AST 语义匹配时再使用 `ast-grep`。

### 不要做
- 不要把 helper tools 当成 MCP server 写入 `mcp-tools.json`。
- 不要在本文件复制安装命令、版本号、完整工具表或动态 ready 状态。
- 不要让多个 graph provider 规则互相覆盖；明确的强制治理块优先，其余工具作为上下文增强 provider 使用。
<!-- spec-first:runtime-tools:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **spec-first** (19803 symbols, 22386 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
