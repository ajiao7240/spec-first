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
- `spec-mcp-setup` 当前支持的 MCP 工具、人类可读 readiness 语义与宿主差异统一收口在 `skills/spec-mcp-setup/references/supported-mcp-tools.md`；不要把完整工具目录重复写进本文件。
- 任何源码改动都必须同步更新根目录 `CHANGELOG.md`。

## 测试与验证策略

- 改 CLI 参数、状态文件、运行时同步逻辑：至少跑相关 unit 测试和 smoke 测试。
- 改 skill / agent 治理、入口映射、contract：先跑 `npm run lint:skill-entrypoints`，再补对应 contract/unit 测试。
- 改 Stage-0 / verification / context routing：跑 `npm run test:integration`，必要时补 `tests/unit/*verification*` 与 `tests/unit/*context*`。
- 改 CRG 图构建、检索或 SQLite 逻辑：跑相关 `tests/unit/crg-*.test.js`，并视影响面执行 `npm run test:e2e:crg`。
- 改发布物、打包内容、安装路径：至少跑 `npm run build`、相关 smoke/release 测试。

## 提交前注意

- 先确认自己修改的是源码真相源，不是宿主生成目录。
- 如果改动影响用户可见行为、命令面或宿主资产生成，补 `CHANGELOG.md`。
- 如果改动影响 README/AGENTS/CLAUDE 中的治理表述，确保与 `docs/10-prompt/项目角色.md` 一致，不要引入“强编排”或“状态机优先”的叙述。

<!-- spec-first:lang:start -->
## 语言与治理策略（由 spec-first 管理）

**语言设置：** `中文`

### 语言规则
- 回复、状态更新、生成文档、评审意见、计划说明等所有自然语言输出使用**中文**
- 允许混用英文技术术语，不要求强行翻译常见技术词
- 代码标识符（变量、函数、类、模块、文件名中的技术标识）保持英文
- 新增代码注释使用中文，简洁清晰，不写空洞注释
- 代码、命令、路径、配置键、环境变量名、API 名称、协议名等技术标识不因语言偏好而被翻译

### Changelog 治理规则
**代码变动铁律（无例外）**
- 任何对项目源码的新增、删除、修改，必须同步在项目根目录 `CHANGELOG.md` 中添加一条记录
- 无此记录的代码变动，一律拒绝生成
- 记录格式以仓库现行格式为准
- **示例：** `- vX.Y.Z YYYY-MM-DD 作者: 一句话摘要`
- 用户可见变更在末尾追加 `(user-visible)`
<!-- spec-first:lang:end -->

<!-- spec-first:bootstrap:start -->
## Workflow 入口治理（由 spec-first 管理）

- 当前项目已安装 `using-spec-first`
- 开始 substantial work 前，先按 `using-spec-first` 做 workflow 判定
- Claude workflow 入口使用 `/spec:*`
- 不要把 `using-spec-first` 本身当作 command-backed workflow
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
