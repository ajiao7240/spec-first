# SDD 与 AI Coding Harness 业界对标调研报告

日期：2026-06-19  
角色：Spec-First Evolution Architect  
目标仓库：`/Users/kuang/xiaobu/spec-first`  
调研范围：`/Users/kuang/xiaobu/` 下 SDD、AI 辅助编程 workflow、agent harness、skill/agent/runtime 相关项目；重点对标 `superpowers`、`spec-kit`、`OpenSpec`、`get-shit-done` / `gsd-2`，并横向覆盖 BMAD、scale-engine、cc-sdd、sdd-riper、pro-workflow、Vibe-Skills、code_flow、gstack、planning-with-files、compound-engineering-plugin 等。

## 0. 结论先行

`spec-first` 的方向是正确的：它不应退回“prompt collection”或“agent collection”，而应继续做 **AI Coding Harness**，把不稳定的模型推理放进 repo-backed、可验证、可沉淀的工程闭环里。当前项目在 source/runtime 边界、双宿主投影、证据边界、workflow→review→knowledge 链路上比大多数对标项目更清晰。

但对标后，`spec-first` 需要补齐的不是“更多 commands / agents / adapters”，而是以下 8 个机制缺口：

1. **Evaluation Harness 从 aspirational 变为可运行最小闭环**：至少覆盖 PRD/plan/task/review/skill prompt 的可回放 fixture、语义评审证据和趋势指标。
2. **Artifact 质量门更像 Spec Kit 的 “Unit Tests for English”**：把需求、计划、任务包当作可测试英文/中文契约，而非只靠 reviewer prose。
3. **Honest closeout / run artifact 覆盖面扩大**：当前 structured runtime contract 仍窄，`honest-closeout` 类信任模型未形成跨 workflow producer integration。
4. **可选 OpenSpec-style change delta 层**：补 behavior contract / capability spec 的 ADDED/MODIFIED/REMOVED/RENAMED 变更表达，但不能把整个系统变成强状态机。
5. **Fresh subagent review 的任务级闭环更硬**：借鉴 Superpowers 的“实现后先 spec compliance，再 code quality”，并要求 full task text handoff。
6. **运行观测与成本账本补 optional ledger**：借鉴 GSD-2 的 per-unit runtime record、timeout/stuck/crash、token/cost ledger，但只作为 evidence harness，不进入核心自动模式。
7. **onboarding / next-step / demo 可外部验证性不足**：BMAD、Spec Kit 的用户入口比 spec-first 更容易被第一次使用者理解和试跑。
8. **extension / preset / override 生态应延后但要预留边界**：Spec Kit 在 presets/extensions 和 integration manifest 上领先；spec-first 应在核心 contracts 稳定后以 source-first、hash-protected 方式补。

战略判断：`spec-first` 应保持 **Light contract + Explicit boundaries + Scripts prepare, LLM decides**。业界强趋势是 agent cloud、parallel tasks、skills、MCP/tools、guardrails、evals、tracing 商品化；spec-first 的差异化不在重建宿主运行时，而在跨宿主的 **artifact / evidence / governance / knowledge 闭环**。

## 1. 方法、范围与限制

### 1.1 执行方式

本次采用主线程源码核验 + 4 路并行 agent 调研：

- Euler：`superpowers`、`spec-kit`。
- Anscombe：`OpenSpec`、`get-shit-done`、`gsd-2`。
- Erdos：`scale-engine`、`BMAD-METHOD`、`cc-sdd`、`sdd-riper`、`planning-with-files`、`gstack`、`code_flow`、`pro-workflow`、`Vibe-Skills`、`compound-engineering-plugin`。
- Huygens：`spec-first` 当前架构定位、趋势判断、外部生态参照。

按用户要求，已对 `/Users/kuang/xiaobu/` 下项目尝试执行 `git pull -v` 拉取最新代码。限制是多个仓库存在本地 dirty worktree 或 behind remote，部分 pull 被本地改动阻塞。因此本报告结论基于 **当前本地 checkout + 可读取源码 + agent 返回证据**，不是对远端最新 main 的绝对结论。

### 1.2 证据等级

- **confirmed source evidence**：本地源码 / README / schema / tests / docs 行号。
- **agent research evidence**：四路 agent 的只读调研结果，主线程做整合判断。
- **external trend evidence**：官方或公开资料，用于趋势框定，不替代本地源码。
- **provider advisory**：Graphify 查询只做导航；本次 Graphify 结果弱且噪声较大，未作为结论证据。

### 1.3 典型 checkout 限制

- `superpowers`：本地 `main...origin/main [behind 168]`，dirty/untracked；结论基于当前 checkout。
- `spec-kit`：本地 `main...origin/main [behind 50]`，dirty/untracked；结论基于当前 checkout。
- `gsd-2`：本地 `main...origin/main [behind 6299]`，dirty；只能代表当前本地快照。
- 其他项目也可能 dirty/behind；本报告关注机制形态与架构启发，不做版本发布状态判断。

## 2. 外部趋势：AI coding 正从 prompt 走向 harness

### 2.1 从“会写代码”转向“可治理地交付代码”

GitHub 对 Spec Kit 的官方介绍明确把问题从模型能力转到 specification：coding agents 越强，vibe-coding 在严肃应用和既有代码库中越容易出现“看起来对但不工作”的情况；Spec Kit 的解法是让 spec 成为 shared source of truth，并驱动 implementation、checklists、task breakdown。外部资料：GitHub Blog，2025-09-02，`https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/`。

这与 `spec-first` 的角色契约高度一致：`docs/10-prompt/结构化项目角色契约.md:47` 把核心链路定义为 `Codebase -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge`；`README.md:13-17` 将项目定位为 AI Coding Harness 和 repo-backed loop。

### 2.2 Workflows 与 agents 的边界正在变清晰

Anthropic 的 “Building effective agents” 建议从简单 compositional workflows 开始，谨慎引入框架抽象，并明确 workflow 中可加入 programmatic gates。外部资料：Anthropic Engineering，`https://www.anthropic.com/engineering/building-effective-agents`。

这支持 `spec-first` 的基线：`docs/10-prompt/结构化项目角色契约.md:66-70` 强调 `Scripts prepare, LLM decides` 和强运行边界、轻语义合同；`docs/10-prompt/结构化项目角色契约.md:101` 将硬 gate 限定为 mutation、verification、source/runtime、handoff、knowledge promotion 五类。

### 2.3 Tools、guardrails、tracing、evals 成为 agent 工程的基础设施

OpenAI Agents SDK 把 guardrails、handoffs、tracing、observability 放进 agent application 的常规构件；其中 guardrail tripwire 会 halt execution。外部资料：OpenAI Agents SDK Guardrails，`https://openai.github.io/openai-agents-python/guardrails/`。

Anthropic 关于 agent tools 的工程文章进一步指出：tools 是 deterministic systems 与 non-deterministic agents 之间的新契约，必须通过真实任务评测工具是否适合 agent 使用。外部资料：`https://www.anthropic.com/engineering/writing-tools-for-agents`。

对 `spec-first` 的含义：MCP/provider readiness、Graphify、ast-grep 等都应继续被当作 provider facts 或 advisory candidates，而不是 semantic authority。`docs/contracts/project-graph-consumption.md:35-72` 已经做对了这一点。

### 2.4 Cloud coding agent 与 parallel tasks 商品化，harness 价值上移

OpenAI Codex web 官方文档强调 Codex 可在 cloud environment 后台并行处理任务、创建 PR。外部资料：`https://developers.openai.com/codex/cloud`。Codex GA 公告还展示了企业把 background coding agent platform 接入远程开发环境完成端到端任务的模式。外部资料：`https://openai.com/index/codex-now-generally-available/`。

这意味着 `spec-first` 不应把核心投入放在复制云端 agent runtime、session manager、parallel executor。更可持续的差异化是：

- 给 cloud/local agents 提供更好的 spec/plan/task 输入。
- 记录它们的 evidence、diff、test、review、knowledge。
- 用 source/runtime 边界保证跨宿主投影一致。
- 在 completion/handoff/knowledge promotion 出口做最小硬 gate。

## 3. spec-first 当前基线

### 3.1 项目定位与核心优势

`spec-first` 明确不是 prompt collection，而是 workflow harness：

- `README.md:13-17`：定义 AI Coding Harness，把 AI 推理放入 repo-backed engineering loop。
- `README.md:73-80`：区别于 agent orchestration tools，强调 artifact、evidence、workflow。
- `CONCEPTS.md:9-19`：解释 harness shape。
- `CONCEPTS.md:29-43`：区分 Skill / Agent / Tool / Script。
- `CONCEPTS.md:47-65`：定义 source truth、runtime、evidence、artifact。

当前核心设计优势：

- **source/runtime 边界清楚**：`src/cli/plugin.js:25-37` 声明 source dirs 和 supported platforms；`src/cli/adapters/codex.js:41-75`、`src/cli/adapters/claude.js:34-64` 明确 Codex / Claude runtime roots。
- **generated runtime 不作为 source**：`docs/contracts/context-governance.md:22-35` 排除 generated mirrors。
- **外部 provider 降级清楚**：`docs/contracts/project-graph-consumption.md:35-72` 要求 Graphify/code graph 结论回源确认。
- **work workflow 有 direct evidence 边界**：`skills/spec-work/SKILL.md:63-120` 规定反馈回路、source/runtime exclusion、provider untrusted。
- **knowledge promotion 已有结构化门槛**：`skills/spec-compound/SKILL.md:93-97` 要求 verified、可复用、带 invalidation condition。

### 3.2 当前能力规模

根据 `docs/catalog/runtime-capabilities.md:21-29`：

- 36 个 source skills。
- 51 个 agents。
- 18 个 workflow commands/skills。
- 2 个 workflow runtime contracts。

根据 `docs/catalog/runtime-capabilities.md:89-105`：

- 当前真正 producer/workflow integrated 的核心 runtime contract 主要是 `spec-work-run-artifact`。
- `honest-closeout` 类信任模型尚未成为普遍 workflow producer integration。

### 3.3 主要短板

`docs/10-prompt/结构化项目角色契约.md:51` 明确 Evaluation Harness 中 debug 命中率、review 漏判率、workflow 质量反馈仍有 aspirational 成分。对标后看，这不是文档措辞问题，而是 `spec-first` 当前从“治理理念强”走向“可外部验证强”的最大缺口。

## 4. 核心对标项目深读

## 4.1 Superpowers：skill-driven methodology 的标杆

### 定位与哲学

Superpowers 的核心定位是“built on composable skills”的完整 AI coding methodology，而不是 CLI harness。证据：

- `/Users/kuang/xiaobu/superpowers/README.md:3`：声明 complete methodology built on composable skills。
- `/Users/kuang/xiaobu/superpowers/README.md:7`：支持 Claude Code、Codex、Gemini、OpenCode、Cursor、Copilot 等宿主。
- `/Users/kuang/xiaobu/superpowers/README.md:198-204`：强调 TDD、systematic、simplicity、evidence。

它与 `spec-first` 的根本区别：

- Superpowers 用 **skill invocation discipline** 管 agent 行为。
- spec-first 用 **source/runtime + artifact/evidence contract** 管 workflow 产物和宿主投影。
- Superpowers 更像“AI coding 行为方法论”；spec-first 更像“跨宿主 workflow harness”。

### 架构设计

Superpowers 的核心抽象是 skills、hooks、plugin/runtime adapters、tests/evals：

- `skills/using-superpowers/SKILL.md:10-16`：只要有 1% 可能适用，就必须 invoke skill。
- `hooks/session-start:17-55`：通过 session bootstrap 注入使用规则。
- `.codex-plugin/plugin.json:1-23`、`.claude-plugin/plugin.json:1-20`：以插件形式投影宿主。
- `.opencode/plugins/superpowers.js:61-133`、`GEMINI.md:1-2`：多宿主适配。

### 工作流

`README.md:154-170` 列出工作流：brainstorming、writing plans、subagent-driven development / executing plans、TDD、code review、finishing branch。

关键阶段：

- `skills/brainstorming/SKILL.md:12-14`：设计未批准前不得实现。
- `skills/brainstorming/SKILL.md:20-33`：先提问、给 2-3 approaches，再推进。
- `skills/brainstorming/SKILL.md:107-136`：spec 写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，并做 placeholder、consistency、scope、ambiguity 自检。
- `skills/writing-plans/SKILL.md:10-18`：计划必须让“零上下文工程师”可执行。
- `skills/writing-plans/SKILL.md:36-61`：任务要拆到 2-5 分钟、包含具体文件/测试/命令。
- `skills/writing-plans/SKILL.md:63-120`：计划中必须声明 `REQUIRED SUB-SKILL`。

### Skill 系统

Superpowers 的 skill 系统不是能力菜单，而是行为约束：

- `skills/using-superpowers/SKILL.md:44-47`：process skills 优先。
- `skills/test-driven-development/SKILL.md:10-14`、`:31-45`：必须先看到 failing test。
- `skills/systematic-debugging/SKILL.md:16-23`、`:46-87`：debug 必须先 root cause。
- `skills/verification-before-completion/SKILL.md:16-50`：close 前必须有 fresh verification evidence。
- `skills/requesting-code-review/SKILL.md:8-23`：fresh reviewer 不继承会话历史。

### Spec / Plan / Requirements 表达

Superpowers 有 spec/plan 概念，但不是 schema-first：

- spec 是 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` 下的设计文档。
- plan 是 `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`。
- plan 重点不是结构化字段，而是“零上下文可执行”的任务说明。

它没有 OpenSpec 那样的 delta model，也没有 Spec Kit 那样的 FR/SC/Given-When-Then template 强约束。

### 命令系统与 AI Agent 集成

Superpowers 的命令主要是宿主 skill/plugin/hook 入口，不是独立 CLI command system。它支持 Claude、Codex、Gemini、OpenCode、Cursor、Copilot 等，但治理逻辑主要靠 prompt/runtime 注入。

### 验证、治理与知识沉淀

最值得借鉴的是 fresh subagent review：

- `skills/subagent-driven-development/SKILL.md:8-14`：每个任务用 fresh subagent。
- `skills/subagent-driven-development/SKILL.md:42-87`：顺序为 implementer → spec reviewer → code quality reviewer。
- `skills/subagent-driven-development/SKILL.md:236-250`：禁止跳过 review。
- `implementer-prompt.md:11-18`：父 agent 粘贴 full task text。
- `spec-reviewer-prompt.md:21-36`、`:58-60`：先做 spec compliance。
- `code-quality-reviewer-prompt.md:5-8`：再做 code quality。

测试/evals 层面也比多数 skill 项目成熟：

- `docs/testing.md:5-8`、`:40-64`：用真实 Claude headless transcript 验证复杂 skill。
- `tests/claude-code/test-subagent-driven-development.sh:31-160`：检查 SDD 行为。
- `tests/claude-code/test-subagent-driven-development-integration.sh:195-293`：验证 plan 只读一次、full task text、review order、loops、independent verification。

### 量化

本地统计：约 149 files、25,954 lines、14 skills。由于 checkout behind remote，量化仅代表当前本地快照。

### 局限

- 1% skill trigger 对轻量请求过重，容易流程化。
- 缺少 spec-first 这种 source/runtime 边界和 runtime drift contract。
- 缺少 deterministic artifact schema / producer / consumer 机制。
- 多宿主更多是 prompt 注入与插件投影，而不是统一 contract 层。

### 对 spec-first 的启发

应借鉴：

- fresh subagent review。
- spec compliance before code quality。
- full task text handoff。
- completion 前 fresh verification evidence。
- skill eval 以真实 transcript / behavior check 而非自评为准。

不应照搬：

- 1% 强制触发规则。
- 对 host bootstrap 的强依赖。
- 把 skill prose 当作唯一治理层。

## 4.2 Spec Kit：SDD artifact scaffolding 的标杆

### 定位与哲学

Spec Kit 的定位是让 specification 成为 primary artifact，驱动 plan、tasks、implementation。证据：

- `/Users/kuang/xiaobu/spec-kit/README.md:39-42`：specifications become executable。
- `/Users/kuang/xiaobu/spec-kit/docs/concepts/sdd.md:7-13`：SDD 概念。
- `/Users/kuang/xiaobu/spec-kit/spec-driven.md:5-31`：spec-driven process。
- GitHub 官方 Blog：spec 成为 shared source of truth，驱动 implementation、checklists、task breakdown。

### 架构设计

Spec Kit 是 Python Typer CLI：

- `pyproject.toml:1-19`、`:28-48`：包名、依赖、打包范围。
- `src/specify_cli/__init__.py:93-99`：CLI 入口。
- `src/specify_cli/commands/init.py:68-115`、`:242-345`、`:347-390`、`:392-431`：初始化 integration、shared infra、constitution、bundled workflow、agent-context extension。

它的架构层更重，包含 templates、commands、scripts、extensions、workflows、presets、integrations。

### 工作流

核心命令：

- `constitution`
- `specify`
- `plan`
- `tasks`
- `implement`

证据：

- `README.md:80-120`：constitution/specify/plan/tasks/implement flow。
- `README.md:150-176`：core/optional commands。
- `src/specify_cli/__init__.py:425-437`、`commands/init.py:574-580`：命令注册。

### Spec / Plan / Tasks 表达

Spec Kit 的 artifact templates 很值得 `spec-first` 借鉴：

- `templates/spec-template.md:11-24`：user stories 必须 independently testable。
- `templates/spec-template.md:88-100`：functional requirements 编号。
- `templates/spec-template.md:106-130`：success criteria 可度量。
- `templates/commands/specify.md:57-114`、`:121-141`：从自然语言创建 feature/spec，并限制 `[NEEDS CLARIFICATION]`。
- `templates/commands/specify.md:143-231`：创建 checklist 并自修复。
- `templates/commands/specify.md:268-276`：`.specify/feature.json` 让 downstream 不依赖 git branch。

Plan：

- `templates/commands/plan.md:60-72`、`:112-160`：输出 research、data-model、contracts、quickstart，并执行 constitution gate。
- `templates/plan-template.md:39-57`、`:106-113`：结构化 plan。

Tasks：

- `templates/tasks-template.md:16-20`：任务格式 `- [ ] T001 [P] [US1] ...`。
- `templates/tasks-template.md:48-99`：按 story 分组，支持 MVP。
- `templates/commands/tasks.md:61-91`、`:140-216`：phase/dependencies/[P]/TDD。

### 命令系统与 AI Agent 集成

Spec Kit 的 integration surface 是最宽的之一：

- `README.md:144-147`：支持 30+ AI coding agent integrations。
- `src/specify_cli/integrations/__init__.py:37-120`：integration catalog。
- `integrations/catalog.json:1-77`：catalog。
- `integrations/codex/__init__.py:1-59`：Codex integration。
- `integrations/base.py:1547-1563`、`:1599-1608`、`:1658-1770`：command separator / skill mode / host 转换。

### 验证与治理

两个机制特别重要：

1. **Checklist as Unit Tests for English**
   - `templates/commands/checklist.md:8-27`：checklist 是英文/需求文档的 unit tests。
   - `templates/commands/checklist.md:128-146`：生成质量要求。
   - `templates/commands/checklist.md:212-246`：要求 traceability，不允许实现验证措辞。

2. **Analyze read-only consistency**
   - `templates/commands/analyze.md:50-58`：严格只读。
   - `templates/commands/analyze.md:104-159`：检查重复、歧义、coverage、constitution。
   - `templates/commands/analyze.md:160-200`、`:235-240`：最多 50 findings。

Runtime 治理：

- `src/specify_cli/integrations/manifest.py:1-7`、`:29-48`：manifest 与 hash。
- `src/specify_cli/integrations/manifest.py:273-399`：卸载只删除 hash 未变文件，防 path escape / symlink 风险。

Workflow engine：

- `workflows/ARCHITECTURE.md:7-76`、`:78-103`、`:170-185`：YAML workflow、run state、resume、gate、command/prompt/shell/control-flow/fan-out 等 step types。
- `workflows/speckit/workflow.yml:1-77`：speckit workflow 串联 specify → gate → plan → gate → tasks → implement。

### 量化

本地统计：约 360 files、104,748 lines、111 Markdown、191 code、15 templates；版本 `0.10.3.dev0`；Python `>=3.11`；支持 30+ integrations。

### 局限

- 核心 artifact 仍是 Markdown，自然语言 schema 弱。
- 多 integration 导致 generator/frontmatter/placeholder/context-file 规则分散。
- workflow engine 已接近中心化流程引擎，复杂度高于 spec-first 的 light contract 目标。
- `docs/concepts/spec-persistence.md:3-21`、`:86-106` 显示 spec persistence 更多留给团队约定。

### 对 spec-first 的启发

应借鉴：

- PRD/plan/task checklist 作为 “Unit Tests for English”。
- `.specify/feature.json` 类 feature state，不依赖 git branch。
- extension / preset / core override 优先级栈。
- manifest hash 保护用户修改。

不应照搬：

- 30+ integration 矩阵。
- 大型 workflow engine。
- 把 Markdown template 当强 schema。

## 4.3 OpenSpec：change/spec delta 的标杆

### 定位与哲学

OpenSpec 是最接近“规范变更层”的项目。它强调 lightweight spec layer，不做强 execution runtime。证据：

- `/Users/kuang/xiaobu/OpenSpec/README.md:125-132`：lightweight spec layer，no rigid gates，20+ assistants。
- `/Users/kuang/xiaobu/OpenSpec/README.md:136-140`：与 Spec Kit 对比，更轻、更 fluid。
- `docs/concepts.md:26-50`：`specs/` 是 source truth，`changes/` 是 proposed modifications。

### 架构设计

核心对象：

- `openspec/specs/<capability>/spec.md`
- `openspec/changes/<change>/proposal.md`
- `openspec/changes/<change>/design.md`
- `openspec/changes/<change>/tasks.md`
- `.openspec.yaml`

证据：`docs/concepts.md:326-373`。

### Delta 表达

OpenSpec 最有价值的是 requirement delta：

- `schemas/spec-driven/schema.yaml:1-4`：proposal -> specs -> design -> tasks。
- `schemas/spec-driven/schema.yaml:41-61`：ADDED / MODIFIED / REMOVED / RENAMED、SHALL/MUST、scenarios。
- `docs/concepts.md:490-520`：delta 类型解释。

### 命令系统

CLI 覆盖：

- `init/update`
- `change/archive`
- `validate/show`
- `workflow status/instructions/schemas`

证据：`src/cli/index.ts:116-205`、`:241-318`、`:327-375`、`:460-520`。

### Apply / Archive 治理

OpenSpec 有确定性 apply 顺序：

- `src/core/parsers/change-parser.ts:84-148`：解析 change。
- `src/core/specs-apply.ts:102-200`：预校验。
- `src/core/specs-apply.ts:244-306`：按 `RENAMED -> REMOVED -> MODIFIED -> ADDED` 应用。
- `src/core/archive.ts:91-151`、`:196-287`：archive 前验证并更新 specs。

### AI Agent 集成

- `src/core/config.ts:21-52`：25+ AI tools 配置。
- `src/core/command-generation/adapters/codex.ts:23-43`：Codex 写 prompts。
- `src/core/command-generation/adapters/claude.ts:34-55`：Claude commands。

### 局限

OpenSpec 的主要短板不是 delta model，而是 prompt/script 合同存在不一致风险：

- `schemas/spec-driven/schema.yaml:54-61` 和 `src/core/specs-apply.ts:283-297` 要求 `MODIFIED` 是完整替换块。
- `src/core/templates/workflows/sync-specs.ts:58-123` 的 `/opsx:sync` prompt 允许 partial intelligent merge。

这类不一致是 `spec-first` 必须避免的：脚本 contract 和 LLM prompt contract 一旦不一致，就会形成“看似自动化，实际不确定”的风险。

### 量化

本地统计：约 843 files、131,291 lines、520 Markdown、279 code。

### 对 spec-first 的启发

应借鉴：

- 可选 `spec/change` source-of-truth。
- behavior requirement delta：ADDED / MODIFIED / REMOVED / RENAMED。
- apply/archive preflight。
- preview-first。

不应照搬：

- 把所有 workflow 都纳入 change archive。
- prompt 与脚本 contract 不一致的 partial merge。
- 让 delta 层成为中心状态机。

## 4.4 Get Shit Done / GSD-2：runtime-agent-app 的标杆

### v1 定位

`get-shit-done` README 当前提示迁移到 Open GSD Core，但仓内仍保留 v1 源码：

- `/Users/kuang/xiaobu/get-shit-done/README.md:1-12`：archived / moved。
- `package.json:2-5`：v1 package 信息。
- `docs/ARCHITECTURE.md:22-65`：context engineering、multi-agent orchestration、SDD pipeline、state management。

### v1 工作流与治理

v1 是 `.planning/` runtime artifacts + phase + agent prompt 的 workflow harness：

- `docs/WORKFLOW-ID-ANALYSIS-AND-LESSONS.md:11-23`：idea/new-project/milestone -> PROJECT/REQUIREMENTS/ROADMAP -> discuss/ui -> plan -> execute -> verify -> complete。
- `commands/gsd/spec-phase.md:15-28`：WHAT/WHY 与 ambiguity gate。
- `commands/gsd/plan-phase.md:17-30`：Research/Plan/Verify。
- `commands/gsd/execute-phase.md:17-31`：wave-based execution。
- `commands/gsd/quick.md:16-35`：快路径仍写 state/commit。
- `references/gates.md:7-70`：Pre-flight、Revision、Escalation、Abort gates。
- `references/artifact-types.md:1-6`：artifact 必须有 consumer 才有意义。
- `agents/gsd-verifier.md:14-69`：SUMMARY 不是 evidence。

### v2 定位

`gsd-2` 是 real coding agent application，深度控制 session、context injection、state machine、timeout、metrics、crash recovery。证据：

- `/Users/kuang/xiaobu/gsd-2/README.md:12-14`：v1 prompt framework vs v2 TypeScript app。
- `README.md:35-48`：v1 vs v2 table。
- `README.md:78-96`：Milestone / Slice / Task loop。
- `README.md:106-126`：auto mode state machine、fresh session、context preload、crash recovery、stuck detection、timeout、cost。
- `README.md:421-447`：architecture 与 disk state source of truth。
- `src/cli.ts:1-20`、`:216-280`、`:315-390`：CLI/runtime。

### Artifact 与 runtime

- `README.md:241-252`：artifact model。
- `README.md:273-282`：verification ladder。
- `README.md:323-334`：per-phase model、skill discovery、budget。
- `README.md:338-365`：bundled tools/agents。
- `src/resources/GSD-WORKFLOW.md:38-63`、`:126-258`：`.gsd/` 中 roadmap、slice plan、task plan、state/context/decisions。
- `src/resources/GSD-WORKFLOW.md:514-539`：`state.md` 是 derived cache，roadmap/plan/summaries 是 source of truth。

### 运行治理

GSD-2 的 runtime 机制是所有对标项目中最“agent app”的：

- `src/resources/extensions/gsd/auto.ts:489-693`：dispatch guard / doctor / self-heal。
- `auto.ts:1467-1495`：secrets gate。
- `auto.ts:1943-2038`：timeout / idle watchdog。
- `crash-recovery.ts:1-94`：crash recovery。
- `unit-runtime.ts:12-85`：unit runtime record。
- `metrics.ts:1-14`、`:223-295`：token/cost ledger。
- `src/resources/extensions/gsd/index.ts:104-186`、`:248-394`、`:408-558`：hook-based context injection、dynamic tools、write gate、compaction hook。

### 迁移与 preview-first

`src/resources/extensions/gsd/migrate/command.ts:1-10`、`:108-127`、`:153-217` 展示 preview-first migration 与 optional agent review。这一点与 `spec-first` 的 preview-first 基线一致。

### 量化

- `get-shit-done` 本地统计：约 1,852 files、388,561 lines、33 agents、67 commands。
- `gsd-2` 本地统计：约 747 files、209,000 lines。

### 局限

- `gsd-2` 深度绑定 Pi runtime。
- 自动 git/init/merge/self-heal/secrets gate 对 `spec-first` 的 source/runtime 边界过重。
- 强状态机、auto mode、runtime app 化会让 `spec-first` 偏离“轻语义合同”。

### 对 spec-first 的启发

应借鉴：

- unit runtime record。
- token/cost ledger。
- timeout/stuck/crash recovery 的 optional evidence。
- artifact-verified idempotency。
- disk artifact 派生 state，而不是 state 反过来支配 source。

不应照搬：

- Pi runtime 深绑定。
- 自动 git 操作。
- 强 auto mode 状态机。
- 过重 secrets/runtime gate。

## 4.5 BMAD：productized lifecycle / onboarding 的标杆

### 定位

BMAD 是 Agile AI framework，强在产品化入口、角色体系和生命周期引导：

- `/Users/kuang/xiaobu/BMAD-METHOD/README.md:8-21`：agile AI framework、scale-adaptive、workflows、specialized agents、complete lifecycle。
- `README.md:39-55`：`npx bmad-method install` 与 `bmad-help`。
- `README.md:61-67`：modules 与 BMM 34+ workflows。
- `docs/reference/workflow-map.md:8-14`：progressive context。
- `docs/reference/workflow-map.md:22-76`：Analysis → Planning → Solutioning → Implementation。
- `docs/reference/agents.md:18-28`：PM / Architect / SM / Dev / QA agent map。
- `src/bmm/agents/pm.agent.yaml:21-44`：PM menu 含 PRD、epics、readiness、correct-course。

### 对 spec-first 的启发

BMAD 不比 `spec-first` 更强在 source/runtime contract，但它更强在首次使用者路径：

- 安装入口简单。
- 帮助菜单清楚。
- progressive context 让用户知道下一步。
- 角色菜单贴近软件团队语言。

`spec-first` 应补的是 onboarding / guide / next-step，而不是复制 BMAD 的角色菜单。

## 4.6 Scale Engine：heavy harness / gates 的上限参照

Scale Engine 是最完整但也最重的 harness 参照：

- `/Users/kuang/xiaobu/scale-engine/README.md:13`：把探索、规划、实现、验证、评审、发版变成 commands、gates、evidence。
- `README.md:45-49`：生成 `.scale/verification.json`、`.scale/skills.json`、`.scale/tools.json`、workflow templates。
- `README.md:105-119`：Workflow Engine、Gate System、AI OS Runtime、Cross-Repo、Memory、ROI、Shield/Orchestrator/Cortex。
- `src/workflow/WorkflowEngine.ts:85-191`：实现 explore/plan/build/verify/executePRD。
- `src/workflow/GateCatalog.ts:68-219`：定义 TDD/build/lint/tests/security/review/runtime evidence gates。

量化：README badge 显示 `platforms-22`、`agents-22`、version `0.50.3`。

对 `spec-first` 的启发是 gate taxonomy、evidence taxonomy、ROI/metrics；反面启发是不要把 light contract 演化成强状态机。

## 4.7 cc-sdd 与 sdd-riper：Kiro-style / protocol-style SDD

### cc-sdd

`cc-sdd` 是 Kiro-style SDD：

- `/Users/kuang/xiaobu/cc-sdd/README.md:12-25`：Requirements → Design → Tasks → Implementation、spec-first guarantees、project memory、8 agents。
- `README.md:46-56`：生成 `requirements.md`、`design.md`、`tasks.md`。
- `docs/guides/spec-driven.md:7-20`：steering/spec-init/requirements/design/tasks/impl/gates/status。
- `docs/guides/spec-driven.md:22-35`：command → artifact map。
- `tools/cc-sdd/templates/manifests/codex.json:1-32`：Codex artifacts。
- `kiro-spec-tasks.md:27-75`：加载 spec/steering/templates、校验 approvals、生成 tasks。

强项是 spec scaffolding；弱项是 review/knowledge/evidence 闭环。

### sdd-riper

`sdd-riper` 是 protocol 型 SDD：

- `/Users/kuang/xiaobu/sdd-riper/README.md:10-14`：SDD 公式。
- `README.md:25-30`：Spec anchor、RIPER Loop、docs-as-source、triangle verification。
- `README.md:77-83`：light vs standard skills。
- `README.md:163-180`：Research → Innovate → Plan → Execute → Review。
- `skills/sdd-riper-one-light/SKILL.md:16-27`：No Spec / No Approval / Done by Evidence / Reverse Sync。
- `skills/sdd-riper-one/SKILL.md:71-87`：热/温/冷上下文与硬门禁。
- `references/spec-template.md:7-86`：单项目模板。

强项是轻协议清楚；弱项是缺 CLI、contract tests、runtime drift 支撑。

## 4.8 其他邻域项目

### pro-workflow

偏 memory / knowledge plane：

- `/Users/kuang/xiaobu/pro-workflow/README.md:15-19`：SQLite、FTS5 wikis、skills/agents/commands/hooks。
- `README.md:32-37`：self-correction memory、knowledge plane、quality gates。
- `README.md:115-123`：learn / wrap-up / wiki / develop / smart-commit。
- `README.md:300-315`：37 hook scripts across 24 events。
- `skills/orchestrate/SKILL.md:10-38`：Research → Plan → Implement → Review。

启发：session memory、knowledge plane、hook observability。限制：不是 PRD/spec 主轴。

### Vibe-Skills

大型 skill governance / router / runtime OS：

- `/Users/kuang/xiaobu/Vibe-Skills/README.md:21`：340+ skills。
- `README.md:163-180`：Canonical Router。
- `README.md:203-208`：deterministic/traceable routing。
- `README.md:287-335`：four-tier memory。
- `SKILL.md:44-57`：固定 6-stage runtime。
- `SKILL.md:154-167`：canonical router authority。
- `core/skill-contracts/v1/vibe.json:1-22`：canonical skill contract。

启发：skill contract 和 memory taxonomy。反面启发：不要堆成巨大 router 和 skill pile。

### gstack

角色化软件工厂：

- `/Users/kuang/xiaobu/gstack/README.md:21`：virtual engineering team。
- `README.md:151-181`：Think → Plan → Build → Review → Test → Ship → Reflect。
- `README.md:198-224`：parallel sprint、smart review routing、tests、browser、second opinion。
- `SKILL.md:19-79`：session/preamble/routing state。
- `autoplan/SKILL.md:1-24`：auto-review pipeline。
- `review/SKILL.md:1-20`：pre-landing review。

启发：review/QA/browser/ship 的工程化体验。限制：不是 spec/PRD-first。

### code_flow

规范/context injection harness：

- `/Users/kuang/xiaobu/code_flow/README.md:1-4`：项目规范 CLI。
- `README.md:74-104`：生成 `.code-flow`、hooks、commands、skills、AGENTS/CLAUDE。
- `.code-flow/config.yml:3-18`：token budget 与 auto injection/dedup。
- `.code-flow/config.yml:69-109`：path mapping。
- `src/core/code-flow/scripts/cf_core.py:57-186`：spec discovery、mapping、path matching。
- `src/adapters/codex/AGENTS.md:19-41`：Tier 0/Tier 1 规范加载。

启发：token budget、path-based context mapping。限制：不是完整 SDD 闭环。

### planning-with-files

持久文件规划模式：

- `/Users/kuang/xiaobu/planning-with-files/README.md:124`：persistent markdown files。
- `README.md:200-208`：`task_plan.md` / `findings.md` / `progress.md`。
- `README.md:221-239`：re-read hooks、completion hook。
- `skills/planning-with-files/SKILL.md:88-147`：create plan first、2-action rule、3-strike protocol。
- `skills/planning-with-files/SKILL.md:207-228`：prompt-injection 安全边界。

启发：简单文件化 progress。限制：不是完整 harness。

### compound-engineering-plugin

与 spec-first 同源/近似的工程闭环：

- `/Users/kuang/xiaobu/compound-engineering-plugin/README.md:29-51`：brainstorm → plan → work → review → compound loop。
- `plugins/compound-engineering/skills/ce-plan/SKILL.md:11-16`：WHAT / HOW / execute 边界。
- `ce-work/SKILL.md:47-61`：plan 是 decision artifact，不在执行中改 plan。
- `ce-code-review/SKILL.md:3-10`：多 persona review、confidence-gated findings、merge/dedup。
- `ce-compound/SKILL.md:13-15`：写入 `docs/solutions/`。
- `CONCEPTS.md:37-44`：pipeline and learning。

对 spec-first 的价值更多是 parity / regression reference，而不是独立行业趋势。

## 5. 横向能力矩阵

| 项目 | Spec 表达 | Plan/Tasks | 执行 | Review | Evidence/Gates | Knowledge | Multi-host | Runtime state | Eval | 主要风险 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| spec-first | PRD/plan/tasks/workflow artifacts，source/runtime 清楚 | 强 | 中强 | 强 | 强理念，中等集成 | 强 | Claude/Codex 稳 | 中 | 弱到中，部分 aspirational | eval / closeout 覆盖窄 |
| Superpowers | design spec + zero-context plan | 强 | 强 skill discipline | 强 fresh review | 强 prose/eval，弱 schema | 中 | 很宽 | 弱 | 中强，transcript eval | 1% trigger 过重 |
| Spec Kit | user stories / FR / SC / Given-When-Then | 最强 | 中 | 中 | checklist/analyze 强 | 弱到中 | 最宽之一 | 中 | 中 | workflow engine / Markdown template 复杂 |
| OpenSpec | capability spec + change delta | 中 | 弱 | 弱到中 | apply/archive 强 | 中 | 宽 | 中 | 弱 | prompt/script contract mismatch |
| GSD v1 | `.planning` artifacts | 强 | 强 | 强 | gates 强 | 强 | 中 | 强 | 中 | surface 过宽 |
| GSD-2 | `.gsd` roadmap/slice/task | 强 | 最强 runtime | 中强 | runtime guards 强 | 中强 | Pi 绑定 | 最强 | 中 | 强状态机/平台绑定 |
| BMAD | agile artifacts | 强 | 中 | 中 | 中 | 中 | 中 | 弱到中 | 弱 | 角色菜单大，证据弱 |
| scale-engine | PRD/workflow/gates | 强 | 强 | 强 | 最强但重 | 强 | 22 platforms | 强 | 中 | 过重 |
| cc-sdd | requirements/design/tasks | 强 | 中 | 弱 | 中 | 弱 | 中 | 弱 | 弱 | review/knowledge 缺 |
| sdd-riper | protocol spec | 中 | 中 | 中 | prose gate | 弱 | 弱 | 弱 | 弱 | 缺确定性支撑 |
| pro-workflow | 非 spec 主轴 | 中 | 中 | 中 | 中 | 强 memory | 中 | 强 | 弱 | 偏 memory |
| Vibe-Skills | skill contract | 中 | 中 | 中 | router/governance 强 | 强 | 中 | 强 | 中 | skill pile / router OS |
| code_flow | standards/context specs | 弱到中 | 弱到中 | 弱 | context injection 强 | 弱 | 4 platforms | 中 | 弱 | 不是 SDD 闭环 |

## 6. spec-first 需要补齐的点

### P0-1：把 Evaluation Harness 落成最小可运行闭环

当前问题：

- `docs/10-prompt/结构化项目角色契约.md:51` 把 Evaluation Harness 中 debug 命中率、review 漏判率标为 aspirational。
- 这会让项目在内部治理上成熟，但外部说服力不足：无法展示“用了 spec-first 真的更稳”。

建议落地：

- 建立 `docs/evals/` 或 `tests/evals/` 下的最小 benchmark corpus。
- 每个 fixture 记录：输入 artifact、期望 reviewer/agent 行为、必须引用的 source refs、允许的变体、not-run reason。
- 先覆盖 4 类高价值场景：PRD 质量、plan scope 边界、task handoff 完整性、code-review finding confidence。
- 输出 replayable report，而不是 LLM self-score。

Non-goals：

- 不建大规模中心化评测平台。
- 不把语义判断完全脚本化。
- 不追求跨模型排名。

### P0-2：引入 artifact quality gates，需求/计划/任务要能被“测”

借鉴 Spec Kit 的 `templates/commands/checklist.md:8-27`，“Unit Tests for English” 是本次最值得直接迁移的机制。

建议：

- 给 PRD/plan/task pack 增加 checklist generator 或 checklist section。
- 质量门只验证 artifact 自洽性，不验证实现是否完成。
- checklist item 必须可追溯到 source/story/FR/task/path。
- 对 plan/task 的 ready-to-work 判定增加最小硬条件：scope、inputs、acceptance、verification candidate、non-goals、handoff summary。

Non-goals：

- 不复制 Spec Kit 的整套 constitution。
- 不要求所有 docs 都有 checklist。
- 不把 checklist 变成审批流。

### P0-3：扩大 honest closeout / run artifact producer integration

当前 `docs/catalog/runtime-capabilities.md:89-105` 显示真正 workflow integrated 的 runtime contract 仍窄。

建议：

- 让 work/debug/code-review/doc-review 在 durable evidence trigger 下统一写 closeout/run summary。
- `honest-closeout` 至少检查：声明了什么、跑了什么、没跑什么、证据路径是什么、限制是什么。
- final response 仍由 LLM 写，但必须引用 structured evidence path 或明确 `not-run reason_code`。

Non-goals：

- 不把 run artifact 当作 workflow state authority。
- 不用 artifact 取代 git diff/test logs/source refs。

### P1-1：增加可选 OpenSpec-style change delta layer

当前 `spec-first` 的 spec/plan/task 更偏 workflow artifact，缺少 capability behavior 随时间演化的 delta 表达。

建议：

- 新增可选 `changes/<change-id>/` 或 `specs/<capability>/changes/` 模式。
- 最小 delta 类型：ADDED / MODIFIED / REMOVED / RENAMED。
- 支持 SHALL/MUST + scenarios，但不强制所有需求都迁移。
- 提供 preview/apply/archive，先只做 docs/spec 级，不碰代码。

Non-goals：

- 不把 OpenSpec 全量架构纳入核心。
- 不做 intelligent partial merge，避免 prompt/script contract mismatch。
- 不让 delta 层成为所有 workflow 的中心状态。

### P1-2：强化任务级 fresh review

Superpowers 的 `subagent-driven-development` 给出明确顺序：implementer → spec reviewer → code quality reviewer，并且 reviewer fresh，不继承上下文。

建议：

- 在 `spec-work` 对可委托任务支持 optional fresh review protocol。
- review order 固定为 spec compliance before code quality。
- 父 agent 传 full task text、acceptance、changed files、verification evidence。
- 缺少 subagent dispatch 授权时，记录 `dispatch_authorization_missing` 并走主线程 fallback。

Non-goals：

- 不让每个小任务强制 3-agent fanout。
- 不默认扩大用户未授权的 subagent dispatch。

### P1-3：补 next-step / onboarding / demo 体验

BMAD 与 Spec Kit 的优势不是更深的治理，而是用户首次路径更清楚。

建议：

- 增强 `using-spec-first` guide mode 或新增 `spec-first guide/next` CLI。
- 给新仓库提供一套可跑 demo：从需求到 plan/task/work/review/knowledge 的最短闭环。
- 让 README 首屏更快回答：用户现在该运行什么、会生成什么、如何判断成功。

Non-goals：

- 不增加大菜单。
- 不把 internal-only helper 暴露为用户入口。

### P2-1：增加 optional runtime ledger

借鉴 GSD-2，但保持 optional：

- per-workflow run id。
- started/ended/status。
- verification commands。
- token/cost（能拿到就记，拿不到 degraded）。
- timeout/stuck/crash reason。
- linked artifacts。

Non-goals：

- 不实现 GSD-2 式 auto mode。
- 不控制 cloud agent runtime。
- 不自动 git merge / commit / push。

### P2-2：预留 extension / preset 机制

Spec Kit 的 extension/preset/manifest hash 对 OSS adoption 很重要，但 `spec-first` 现在更应先稳 core contracts。

建议：

- 先定义 extension source boundary，不急于实现 marketplace。
- 采用 manifest hash 保护用户修改。
- 明确 core / project override / extension 优先级。
- runtime generation 继续 source-first。

Non-goals：

- 不追 30+ integrations。
- 不做中心化插件生态。

## 7. 不应复制的反模式

### 7.1 Superpowers 的 1% 触发阈值

该规则有利于高纪律，但会牺牲轻量交互效率。`spec-first` 已经有 substantial-work routing 与 direct-answer allowance，不应倒退成所有请求都过 workflow。

### 7.2 Spec Kit 的大 workflow engine

Spec Kit 的 YAML workflow engine 很强，但会把 `spec-first` 推向中心化流程引擎。`spec-first` 的优势是 light contract 和 LLM judgment，不应画死路径。

### 7.3 OpenSpec 的 prompt/script contract mismatch

OpenSpec 的完整块 apply 与 prompt partial merge 之间的差异是明确风险。`spec-first` 所有 prompt、schema、script、test 必须共享同一 contract。

### 7.4 GSD-2 的 runtime app 化和强状态机

GSD-2 对 session/runtime 的掌控很强，但这属于宿主/agent app 层。`spec-first` 应消费其 evidence 思路，而不是复制 Pi-bound runtime。

### 7.5 Vibe-Skills 式巨大 router / skill pile

skill 数量不是护城河。`spec-first` 的护城河是 artifact/evidence/knowledge 闭环和 source/runtime 边界。

## 8. 建议路线图

### P0：3-4 周内应优先落地

1. **Artifact checklist gate v1**
   - 覆盖 PRD/plan/task。
   - 输出 checklist artifact。
   - 只做自洽与 traceability，不做实现验证。

2. **Honest closeout producer integration v1**
   - 先覆盖 `spec-work`、`spec-debug`、`spec-code-review`、`spec-doc-review`。
   - 强制 final response 引用结构化 evidence 或 not-run reason。

3. **Eval corpus v1**
   - 10-20 个最小 fixtures。
   - 以 prompt/workflow asset 行为为评测对象。
   - 记录 replay report。

### P1：随后补强

4. **Optional change-delta spec v0**
   - 只支持 docs/spec delta preview。
   - 不触碰代码 apply。
   - 与 existing PRD/plan/task 并行，不替换。

5. **Fresh review protocol**
   - 在 subagent 授权存在时启用。
   - spec compliance before quality。
   - full task text handoff。

6. **Guide / next-step**
   - 降低首次使用成本。
   - 提供 demo loop。

### P2：成熟后扩展

7. **Runtime ledger**
   - optional evidence。
   - cost/token/stuck/crash。

8. **Extension / preset**
   - manifest hash。
   - source-first。
   - 不追 adapter 数量。

## 9. 最终架构判断

`spec-first` 当前最有价值的资产不是某个单独 skill，而是完整判断模型：

- source-of-truth 与 generated runtime 分离。
- script/tool 只准备 deterministic facts。
- LLM/agent 做语义判断。
- workflow 留 artifact。
- artifact 带 evidence、freshness、limitations。
- review 后进入 knowledge promotion。

业界对标项目分别证明了几个方向：

- Superpowers 证明 skill discipline 和 fresh review 能显著提升 agent 行为。
- Spec Kit 证明 SDD artifact scaffolding 和 checklist 能降低“意图丢失”。
- OpenSpec 证明 spec delta 是长期维护行为契约的关键。
- GSD-2 证明 runtime evidence、crash/stuck/cost 记录对长任务有价值。
- BMAD 证明 onboarding 和角色语言会影响 adoption。
- Scale Engine 证明 gates/evidence 可以很强，但也证明过重 harness 会牺牲边界清晰。

因此 `spec-first` 的下一阶段不应是“做一个更大的 agent OS”，而应是：

> 用最小 durable mechanisms，把 Spec → Plan → Tasks → Code → Review → Knowledge 这条链路从“理念清楚”推进到“证据可回放、质量可测量、闭环可外部验证”。
