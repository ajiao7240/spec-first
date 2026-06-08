# SCALE Workflow 三方对比与 spec-first 参考

更新日期：2026-06-02

本文对比三套相关的 SCALE workflow 表达，并补充它们对 `spec-first` 的可参考优化点：

- `scale-engine`：`/Users/kuang/xiaobu/scale-engine`
- `project-scaffold`：`/Users/kuang/xiaobu/project-scaffold`
- `scale-os-config-claude-code`：`/Users/kuang/xiaobu/scale-os-config-claude-code`
- `spec-first`：`/Users/kuang/xiaobu/spec-first`，作为参考对象，不属于 SCALE 三套配置之一。

术语说明见 [SCALE_SPEC_FIRST_GOVERNANCE_TERMS.md](SCALE_SPEC_FIRST_GOVERNANCE_TERMS.md)。

## 总结

三套代码/配置表达的是同一个治理目标：让 Agent 工作从需求澄清、探索、规划、执行、验证、审查到交付都有可追溯证据。

但它们不是完全一致的实现：

- `scale-engine` 是引擎源码和 CLI 产品面。
- `project-scaffold` 是给派生项目使用的可复用治理脚手架。
- `scale-os-config-claude-code` 是基于 SCALE 思路生成的 Claude Code 配置包。

## 主流程形态

| 对象 | 主 workflow | 事实来源 | 说明 |
| --- | --- | --- | --- |
| `scale-engine` 产品 CLI | `define -> plan -> build -> verify -> review -> ship` | `src/workflow/WorkflowOrchestrator.ts`、`src/cli/phaseCommands.ts` | 产品级 canonical phase workflow。 |
| `scale-engine` 仓库自身开发 | `探索 -> 规划 -> 执行 -> 验证 -> 沉淀` | `AGENTS.md`、`docs/guides/DEVELOPMENT_WORKFLOW.md`、`docs/workflow/README.md` | 本仓库维护工作流，映射到本地门禁脚本。 |
| `project-scaffold` | `探索 -> 规划 -> 执行 -> 验证 -> 沉淀` | `AGENTS.md`、`README.md`、`docs/workflow/README.md` | 面向人类和 Agent 的脚手架工作流。 |
| `project-scaffold` Claude workflow 配置 | standard：`explore -> plan -> execute -> verify -> consolidate`；critical：`explore -> plan -> review -> execute -> verify -> security -> consolidate` | `.claude/workflow.json` | 增加 tier 分级和自动升级规则。 |
| `scale-os-config-claude-code` | 当前 critical flow：`explore -> plan -> review -> execute -> verify -> security -> consolidate` | `.scale/workflow.json`、`CLAUDE.md`、`.claude/settings.json` | 生成型 Claude Code 配置，包含 hooks 和 skill registry。 |

## 阶段映射

| `scale-engine` 阶段 | 脚手架/配置阶段 | 含义 |
| --- | --- | --- |
| `define` | `explore` | 澄清需求、读取上下文、降低歧义、识别主要矛盾。 |
| `plan` | `plan` | 定义范围、方案、风险、回滚和验证方式。 |
| `build` | `execute` | 执行代码、脚本、文档或治理配置改动。 |
| `verify` | `verify` | 运行 build/lint/test/typecheck/security/product smoke 等验证并记录证据。 |
| `review` | `review` / `security` | 审查 diff、安全、架构、工程规范和未解决 findings。 |
| `ship` | `consolidate` | 最终交付、总结、清理、知识/文档沉淀，必要时提交或发版。 |

## 门禁对比

| 对象 | 声明的门禁范围 | 说明 |
| --- | --- | --- |
| `scale-engine` | `G0-G22` | 完整引擎门禁目录：构建、探索、计划、TDD、lint、测试、证据、安全、产品冒烟、元治理、提交纪律、运行时证据、审查、供应链、token 预算、会话健康等。 |
| `project-scaffold` docs/scripts | 脚本包含 `G0-G22`；workflow 配置声明 `G1-G7` | 脚手架已有较新的门禁脚本，但 `.claude/workflow.json` 仍只建模核心 G1-G7。 |
| `scale-os-config-claude-code` | `G0-G9` | 生成配置聚焦 build/explore/plan/TDD/lint/test/typecheck/security/no-slop/knowledge-updated。 |

## Skill 路由对比

| 对象 | Skill 来源 | 路由模型 | 优先级行为 |
| --- | --- | --- | --- |
| `scale-engine` | `src/skills/routing/SkillPolicy.ts` 内置默认策略；项目可用 `.scale/skills.json` 覆盖 | Intent classifier 根据任务描述、文件和服务给 domain 打分 | required skills 先于 recommended skills；domain 分数决定 domain 顺序；同一 domain 内按数组顺序。 |
| `project-scaffold` | `.scale/skills.json` | 与 `scale-engine` 相同的 routing-policy schema，但 domain 更少 | 对 M/L/CRITICAL 使用 warn 模式。大多是 recommended skills，DB/security domain 有 required security skill。 |
| `scale-os-config-claude-code` | `.scale/skills-registry.json` 加 `CLAUDE.md` 规则 | 大型 registry + prompt/hook 驱动的软路由，不是 `.scale/skills.json` policy schema | tier/status/trigger/safety 指导 Claude Code 选择；不是代码级 dispatcher。 |

## Skill Domain 对比

| Domain | `scale-engine` 默认策略 | `project-scaffold` | `scale-os-config-claude-code` |
| --- | --- | --- | --- |
| UI/frontend | Required：`awesome-design-md`、`ui-ux-pro-max`；recommended：`frontend-design`、`webapp-testing`、`agent-browser`、`mcp-chrome-devtools`、`browser-testing-with-devtools`、`design-review` | Recommended：`ui-ux-pro-max`、`frontend-design`、`design-review` | registry 中包含 UI/design role presets 和 UI skills，由 `CLAUDE.md` 规则选择。 |
| Web research | Required：`web-access`；recommended：`agent-browser`、`mcp-chrome-devtools`、`source-driven-development`、`browser-use` | `.scale/skills.json` 未显式建模 | registry 包含 web/browser skills，由 trigger 和任务文本选择。 |
| Browser/E2E | Recommended：`webapp-testing`、`agent-browser`、`web-access`、`mcp-chrome-devtools`、`playwright`、`playwright-interactive` | Recommended：`playwright`、`playwright-interactive` | registry 包含 browser 和 Playwright 相关能力。 |
| Desktop automation | Required：`turix-cua`；recommended：`agent-browser`、`web-access`、`computer-use`、`opencli` | 未显式建模 | registry 包含 desktop/computer-use 类条目，并要求安全边界审查。 |
| External agent CLI | Recommended：`codex-cli`、`gemini-cli`、`opencode-cli`、`git-workflow-and-versioning`、`code-reviewer` | 未显式建模 | registry 包含 cross-agent 和 role-preset 条目。 |
| API | Recommended：`tdd-guide`、`code-review` | Recommended：`tdd-guide`、`code-review` | 由通用 engineering/review skills 和 role presets 覆盖。 |
| DB/security | DB required：`security-review`；security required：`security-review`；recommended：`systematic-debugging` 或 `code-review` | 核心思路相同：DB/security 需要 `security-review` | registry 包含 security/review role presets 和安全元数据。 |
| Docs | Recommended：`update-docs`、`workflow-guide` | Recommended：`workflow-guide` | registry 包含 docs/writing 和 knowledge-management skills。 |
| Release/review | Release required：`code-reviewer`；recommended：`pr-creator`、`fix`、`verification`、`code-review`；review required：`code-reviewer` | Release recommended：`verification`、`code-review` | registry 包含 review、release 和 governance skills。 |
| Resource/standards governance | 默认策略中存在 | `.scale/skills.json` 未显式建模 | 部分由生成治理规则和 registry 条目表达。 |

## `scale-engine` 核心开源参考

说明：

- 本节梳理 `scale-engine` 当前仓库明确记录的 GitHub 上游、外部 provider、skill 参考和模式来源。
- 事实来源主要是 `docs/EXTERNAL_REFERENCES.md`、`docs/THIRD_PARTY_SKILLS.md`、`README.md`、`docs/05-ROADMAP.md` 和源码注释。
- 仓库文档明确说明：这些记录是 acknowledgement/governance record，不表示上游源码已经 vendored 到 `scale-engine` 中；多数是 external reference、adapter target、optional provider 或 adapted concept。

| 参考项目 | GitHub/来源 | 在 `scale-engine` 中对应能力 | 使用状态 | 主要落点 |
| --- | --- | --- | --- | --- |
| SCALE Engine 自身 | `https://github.com/hongmaple0820/scale-engine` | 当前项目源码仓库 | 项目本体 | `README.md` |
| agent-hooks-in-depth | `https://github.com/dabit3/agent-hooks-in-depth` | Scale Shield：hook exit 0/2 allow/block 协议、危险命令阻断、保护路径 | 对标/协议参考 | `README.md`、`docs/SHIELD.md`、`src/shield/*` |
| Planning with Files | `https://github.com/OthmanAdi/planning-with-files` | 文件化 plan、findings、progress、active-plan routing、plan attestation | adapted concept，不 vendored | `src/skills/SkillRepository.ts`、`docs/THIRD_PARTY_SKILLS.md` |
| GBrain | `https://github.com/garrytan/gbrain` | 默认 graph-backed memory provider，跨会话记忆召回 | external provider，默认启用但写入受控 | `src/memory/MemoryProviders.ts`、`.scale/memory-providers.json`、`docs/MEMORY_FABRIC.md` |
| agentmemory | `https://github.com/rohitg00/agentmemory` | 可选外部 persistent memory server / MCP provider | external provider，当前配置禁用 | `src/memory/MemoryProviders.ts`、`.scale/memory-providers.json`、`docs/THIRD_PARTY_SKILLS.md` |
| Graphify | `https://github.com/safishamsi/graphify` | 知识图谱 artifact provider、Graphify knowledge recall、Graphify skill freshness 检查 | external provider；依赖 `graphify-out/graph.json` | `src/knowledge/GraphifyKnowledgeBase.ts`、`src/codegraph/CodeIntelligence.ts`、`docs/CODE_INTELLIGENCE.md` |
| CodeGraph | `https://github.com/colbymchenry/codegraph` | 代码结构 provider，支持 symbol/query/context/impact/ROI | external CLI/MCP reference；依赖 `.codegraph/` index | `src/codegraph/CodeIntelligence.ts`、`.scale/code-intelligence.json` |
| Anthropic Skills | `https://github.com/anthropics/skills` | `frontend-design`、`webapp-testing` 等 workflow skill 参考 | external skill reference | `src/skills/SkillCatalog.ts`、`src/skills/SkillRepository.ts` |
| Claude Code skills | `https://github.com/anthropics/claude-code` | Graphify、playwright-interactive skill discovery 参考 | optional discovery reference | `src/skills/SkillDiscovery.ts` |
| awesome-design-md | `https://github.com/VoltAgent/awesome-design-md` | DESIGN.md、品牌、视觉语言、设计系统参考 | 显式 setup/apply 后安装 | `src/bootstrap/DependencyBootstrap.ts`、`src/skills/ExternalSkills.ts` |
| ui-ux-pro-max-skill | `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` | UI/UX、可访问性、响应式和 acceptance-review skill | 显式 setup/apply 后安装 | `src/bootstrap/DependencyBootstrap.ts`、`.scale/skills.json` |
| RTK | `https://github.com/rtk-ai/rtk` | shell 输出压缩、governed CLI proxy、token savings | external CLI only | `src/tools/ToolCapabilityRegistry.ts`、`docs/TOOL_ORCHESTRATION.md` |
| web-access | `https://github.com/eze-is/web-access` | Web research、logged-in/dynamic page CDP browser automation | external skill reference | `src/skills/ExternalSkills.ts`、`.scale/skills.json` |
| Agent Browser | `https://github.com/vercel-labs/agent-browser` | 浏览器自动化 CLI、截图、E2E/browser evidence | external CLI reference | `src/tools/ToolCapabilityRegistry.ts`、`.scale/skills.json` |
| Chrome DevTools MCP | `https://github.com/ChromeDevTools/chrome-devtools-mcp` | console/network/browser inspection evidence | MCP reference | `src/tools/ToolCapabilityRegistry.ts`、`.scale/skills.json` |
| CUA | `https://github.com/trycua/cua` | desktop computer-use automation | restricted external automation reference | `src/skills/SkillDoctor.ts`、`src/tools/ToolCapabilityRegistry.ts` |
| Playwright | `https://github.com/microsoft/playwright` | browser automation、E2E 验证 | optional discovery/reference | `src/skills/SkillDiscovery.ts`、`package.json` optional dependency |
| Codex | `https://github.com/openai/codex` | Codex adapter、外部 reviewer/worker CLI | adapter target / external CLI reference | `src/adapters/CodexAdapter.ts`、`src/skills/ExternalSkills.ts` |
| Gemini CLI | `https://github.com/google-gemini/gemini-cli` | Gemini adapter、`code-reviewer`/`pr-creator` skill 参考 | adapter target / external CLI and skill reference | `src/adapters/GeminiAdapter.ts`、`src/skills/SkillCatalog.ts` |
| OpenCode | `https://github.com/sst/opencode`；`https://github.com/opencode-ai/opencode` | OpenCode adapter、外部 reviewer/worker CLI | adapter target / external CLI reference | `src/adapters/OpenCodeAdapter.ts`、`src/skills/ExternalSkills.ts` |
| Aider | `https://github.com/Aider-AI/aider` | Aider adapter target | adapter target reference | `src/adapters/AiderAdapter.ts` |
| agency-agents-zh | `https://github.com/jnMetaCode/agency-agents-zh` | 中文角色预设参考，CEO/CTO/工程/设计/产品等 role presets | external preset reference | `src/skills/SkillRepository.ts`、`src/agents/types.ts` |
| Diagram/PPT/video skills | `yizhiyanhua-ai/fireworks-tech-graph`、`github/awesome-copilot`、`Cocoon-AI/architecture-diagram-generator`、`heygen-com/hyperframes`、`op7418/guizang-ppt-skill` | 图表、架构图、视频、PPT 等可选 skill installer/discovery 参考 | optional install reference | `src/skills/SkillInstaller.ts`、`docs/skill-installation-workflow.md` |

### 模式类参考

| 模式/来源 | 仓库中记录的参考点 | 对应实现 |
| --- | --- | --- |
| Symphony `WORKFLOW.md` | Scale Orchestrator 的声明式策略、worktree 隔离、协调循环 | `README.md`、`docs/05-ROADMAP.md`、`.scale/policy.yaml` |
| ECC Instincts | Scale Cortex 的观察、模式提取、本能注入和治理 ROI | `README.md`、`docs/05-ROADMAP.md` |
| mattpocock/skills | `CONTEXT.md`、`.out-of-scope/`、Agent Brief、双轴 review、grilling templates 等模式 | `.scale/GLOSSARY.md`、`src/workflow/OutOfScopeStore.ts`、`src/workflow/ReviewAnalyzer.ts` |
| OpenWolf | cerebrum、anatomy、bug pattern detector | `src/knowledge/CerebrumManager.ts`、`src/context/ProjectAnatomy.ts`、`src/hooks/BugPatternDetector.ts` |
| gstack | role skills、ship、security audit、learnings、preamble、touchfile test dependency | `src/skills/RoleSkills.ts`、`src/workflow/ShipPipeline.ts`、`src/workflow/SecurityAudit.ts`、`src/evolution/SessionLearnings.ts` |
| OMC | deep-interview、office-hours、skill interop | `src/workflow/cognitive/SocraticQuestioner.ts`、`src/skills/interop/OMCInterop.ts` |
| z.ai + Baton System | autonomous dev loop、跨会话 baton persistence | `src/workflow/autonomous/AutonomousDevLoop.ts`、`src/workflow/autonomous/WorklogManager.ts` |

## `scale-engine` 知识库相关层、文档、Skill 和外部组件

说明：

- 下表只梳理 `scale-engine` 当前项目本身的知识库、记忆、上下文和代码图谱能力。
- “专门文档”表示已有单篇文档直接解释该层；“分散说明”表示需要同时读架构、数据模型、术语表、配置或源码。
- `Skill` 指 SCALE skill/routing 中可被推荐或执行的能力；`Agent` 指宿主 Agent adapter 或角色化审查视角；`Provider/组件` 指外部开源组件、CLI、MCP 或本地库。

| 层 | 当前实现/配置 | 说明文档 | 对应 Skill | 对应 Agent/角色 | 开源组件/Provider | 文档状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 项目上下文/术语层 | `src/context/ContextBuilder.ts`、`src/context/ContextCompiler.ts`、`src/context/ProjectAnatomy.ts`、`.scale/GLOSSARY.md` | `docs/CONTEXT_BUDGET.md`；`docs/01-ARCHITECTURE.md` 的 L1 Context Layer；`docs/03-CORE-MODULES.md` §3.6；`docs/AI_ENGINEERING_OS_POSITIONING.md` §5.2/§6.5；`.scale/GLOSSARY.md` | `update-docs`、`workflow-guide`、`documentation-and-adrs`、`planning-with-files` | 通过 `ClaudeCodeAdapter`、`CodexAdapter`、`CursorAdapter`、`GeminiAdapter`、`OpenCodeAdapter`、`AiderAdapter` 等注入给宿主 Agent | `OthmanAdi/planning-with-files` 是 file-backed planning 概念参考 | 有上下文预算专门文档；Project Anatomy/术语层没有单独成篇 |
| 核心 KnowledgeBase 层 | `src/knowledge/KnowledgeBase.ts`、`src/knowledge/SQLiteKnowledgeBase.ts`、`src/knowledge/GraphifyKnowledgeBase.ts`、`src/knowledge/TfidfIndex.ts` | `docs/03-CORE-MODULES.md` §3.4；`docs/02-DATA-MODEL.md` 的 `knowledge_entries` schema；`docs/00-OVERVIEW.md` L5 Memory；`docs/05-ROADMAP.md` Week 7；`.scale/GLOSSARY.md` | `graphify`；本地召回通过 SCALE 内置接口完成 | 无独立 Agent，作为运行时知识召回服务供当前宿主 Agent 使用 | `better-sqlite3`；`Graphify`；项目内 TF-IDF 实现 | 分散说明；当前没有 `docs/KNOWLEDGE_BASE.md` 单篇说明 |
| 长期记忆 Memory Brain 层 | `src/memory/MemoryBrain.ts`、`src/memory/MemoryLearning.ts`、`.scale/memory/brain.sqlite` 运行时库 | `docs/MEMORY_BRAIN.md`；`docs/MEMORY_FABRIC.md`；`docs/GOVERNANCE_DASHBOARD.md`；`docs/WORKFLOW_EVAL.md` | 内置能力名 `memory-brain`；外部相关 skill/provider 为 `gbrain`、`agentmemory` | 无独立 Agent；可把查询结果注入当前宿主 Agent | `better-sqlite3` 本地存储；可与 `GBrain`、`agentmemory` 联动 | 有专门文档 |
| Memory Fabric 上下文压缩层 | `src/memory/MemoryFabric.ts`、`scale memory pack/settle` | `docs/MEMORY_FABRIC.md`；`docs/CONTEXT_BUDGET.md`；`docs/start/agent-governance-demo.md` | `memory-brain` fallback；记忆类任务由 Skill Radar 推荐 `gbrain`、`agentmemory` 或本地 fallback | 当前宿主 Agent 消费 context pack；不是独立 Agent | 本地证据账本、session events、KnowledgeBase、Graphify 产物摘要 | 有专门文档 |
| 记忆 Provider 路由层 | `src/memory/MemoryProviders.ts`、`.scale/memory-providers.json` | `docs/MEMORY_FABRIC.md` 的 provider routing；`docs/THIRD_PARTY_SKILLS.md`；`docs/EXTERNAL_REFERENCES.md`；`docs/start/quickstart.md` | `gbrain`、`agentmemory`、`scale-local` fallback | 通过 MCP/CLI 或本地 fallback 给不同宿主 Agent 共享召回结果 | `GBrain` 默认启用；`agentmemory` 当前禁用；`scale-local` 本地 fallback | 有文档；隐私、保留、删除边界仍要求评审证据 |
| 代码图谱/代码智能层 | `src/codegraph/CodeIntelligence.ts`、`.scale/code-intelligence.json`、`scale codegraph ...` | `docs/CODE_INTELLIGENCE.md`；`docs/THIRD_PARTY_SKILLS.md`；`docs/EXTERNAL_REFERENCES.md`；`docs/start/quickstart.md` | `graphify`；`codegraph` 更偏 CLI/tool provider，不是普通 skill-file | 无专门 Agent；用于 `explore`、`review`、`impact/context` 推荐 | `CodeGraph`、`Graphify`、fallback：`internal-scan`、`rg`、`read` | 有专门文档 |
| Session 注入/AI OS 运行时层 | `scale context inject`、`src/context/SessionStartSequence.ts`、`src/runtime/AiOsRuntime.ts`、`scale ai-os plan/run/status` | `README.md` 的 AI OS Runtime；`docs/AI_ENGINEERING_OS_POSITIONING.md`；`docs/CONTEXT_BUDGET.md`；`docs/MEMORY_FABRIC.md` | 按任务域触发 Skill Radar/Skill Policy；记忆和图谱结果进入 context pack | 当前宿主 Agent；adapter 会生成 hooks、settings、knowledge doc | SCALE 内置 runtime；外部 provider 按记忆/图谱配置接入 | 有定位文档；SessionStart 细节主要在源码和 adapter 文档中 |
| Cerebrum 偏好/禁忌层 | `src/knowledge/CerebrumManager.ts`、`scale memory cerebrum` | `src/knowledge/CerebrumManager.ts` 源码说明；`.scale/GLOSSARY.md` 间接覆盖 KnowledgeBase；`docs/MEMORY_BRAIN.md` 可作为长期记忆背景 | 无独立外部 skill；通过 memory 命令写入 `preference`/`do_not_repeat` | 注入给当前宿主 Agent 作为用户偏好和不要重复的约束 | 源码注释提到参考 OpenWolf cerebrum 思路 | 只有源码级说明；建议后续补 `docs/CEREBRUM.md` 或并入 Memory Brain |
| Out-of-scope 制度记忆层 | `src/workflow/OutOfScopeStore.ts`、`scale out-of-scope ...`、`.scale/out-of-scope/` | `.scale/GLOSSARY.md`；`src/workflow/OutOfScopeStore.ts` 源码说明；`docs/workflow/templates/summary.md`/任务总结间接使用 | 无独立 skill；通常由 `workflow-guide`、`documentation-and-adrs`、`code-review` 触发沉淀 | 当前宿主 Agent 在规划/审查时读取，避免反复讨论已拒绝概念 | 借鉴 `mattpocock/skills` 的 `.out-of-scope/` 模式 | 分散说明；当前没有单篇制度记忆文档 |
| Skill Radar/能力选择层 | `src/skills/SkillRadar.ts`、`src/skills/SkillRepository.ts`、`.scale/skills.json`、`.scale/tools.json` | `docs/SKILL_RADAR.md`；`docs/SKILL-REPOSITORY.md`；`docs/THIRD_PARTY_SKILLS.md`；`docs/EXTERNAL_REFERENCES.md` | `find-skills`、`gbrain`、`agentmemory`、`graphify`、`web-access`、`agent-browser`、`code-reviewer` 等按 domain 推荐 | 当前宿主 Agent 执行推荐；也可联动外部 CLI/MCP | 社区 skill、MCP、外部 CLI；不默认 vendoring | 有专门文档 |
| 角色化审查层 | `src/skills/RoleSkills.ts`、`src/skills/coreSkills.ts`、`src/guardrails/roles.ts` | `README.md` Role Skills；`docs/05-ROADMAP.md`；`docs/04-INTEGRATION.md` role activation；`src/skills/RoleSkills.ts` | `code-reviewer`、`security-review`、`qa-lead` 类审查能力；外部 `agency-agents-zh` 是角色预设参考 | 内置角色：`eng-manager`、`security-reviewer`、`qa-lead`、`release-engineer`、`design-reviewer`、`ceo-reviewer` | `jnMetaCode/agency-agents-zh` 作为中文角色库参考 | 分散说明；当前没有单篇 `ROLE_SKILLS.md` |
| Agent Adapter/宿主集成层 | `src/adapters/index.ts` 及各平台 Adapter | `docs/04-INTEGRATION.md`；`docs/01-ARCHITECTURE.md`；`docs/EXTERNAL_REFERENCES.md`；各 adapter 源码 | 不直接选择知识 skill，但负责把 SCALE context、hooks、knowledge doc、skills dir 接入宿主 | 支持 `claude-code`、`codex`、`opencode`、`cursor`、`gemini`、`openclaw`、`hermes`、`trae`、`workbuddy`、`vsc`、`qcoder`、`deepseek-tui`、`aider`、`windsurf`、`kimi`、`doubao`、`kiro`、`qoder`、`jcode`、`cline`、`kilocode`、`antigravity` | Codex、Claude Code、Gemini CLI、OpenCode、Aider、Cursor 等外部 Agent 平台 | 有集成文档；平台差异主要在源码中 |

### 知识库相关命令与配置入口

| 入口 | 对应层 | 说明文档 | 当前项目配置/默认行为 |
| --- | --- | --- | --- |
| `scale context build/status/inject/glossary/init/grill/budget/pack/doctor/anatomy` | 上下文、术语、Session 注入、Context Budget | `docs/CONTEXT_BUDGET.md`、`docs/AI_ENGINEERING_OS_POSITIONING.md`、`docs/03-CORE-MODULES.md` §3.6 | 负责把规则、术语、任务、记忆、证据和预算装配给 Agent |
| `scale memory pack/doctor/cerebrum/settle/ingest/query/contradictions/dream/promote/export/import/provider` | Memory Fabric、Memory Brain、Cerebrum、Provider 路由 | `docs/MEMORY_FABRIC.md`、`docs/MEMORY_BRAIN.md`、`docs/THIRD_PARTY_SKILLS.md` | `.scale/memory-providers.json` 当前为 `external-first`，顺序 `gbrain -> agentmemory -> scale-local`，外部写入关闭 |
| `scale codegraph status/init/query/impact/context/roi` | 代码图谱、代码智能、Graphify/CodeGraph provider | `docs/CODE_INTELLIGENCE.md` | `.scale/code-intelligence.json` 启用 `codegraph` 和 `graphify`，fallback 为 `internal-scan`、`rg`、`read` |
| `scale out-of-scope add/check/list/remove` | 制度记忆、已拒绝概念 | `.scale/GLOSSARY.md`、`src/workflow/OutOfScopeStore.ts` | 生成 `.scale/out-of-scope/` 条目；当前项目清单中尚未看到该目录 |
| `scale skill radar/plan/doctor` 相关入口 | Skill Radar、能力选择、供应链检查 | `docs/SKILL_RADAR.md`、`docs/SKILL-REPOSITORY.md`、`docs/THIRD_PARTY_SKILLS.md` | `.scale/skills.json` 以 warn 模式要求 M/L/CRITICAL 任务记录 skill plan 和 evidence |
| `scale setup --pack memory/knowledge`、`scale bootstrap deps --pack memory,knowledge` | 第三方记忆和知识图谱安装/检查 | `docs/start/quickstart.md`、`docs/THIRD_PARTY_SKILLS.md`、`docs/CODE_INTELLIGENCE.md` | 只在显式 `--apply`/`--yes` 后安装；smoke 默认不执行真实第三方安装 |

### 知识库相关层在 Workflow 节点中的使用方式

说明：

- `scale-engine` 产品 CLI 的 canonical 节点是 `define -> plan -> build -> verify -> review -> ship`。
- 脚手架和 Claude 配置里的别名分别对应 `explore -> plan -> execute -> verify -> review/security -> consolidate`。
- 知识库相关层不是按 phase 硬编码，而是由 `scale ai-os plan`、`scale context pack`、`scale memory pack/provider recall`、`scale codegraph ...`、`scale skill plan/radar` 等入口按任务、文件、等级和 provider 状态组合使用。

| Workflow 节点 | 别名 | 节点里如何使用知识库相关层 | 主要读取 | 主要写入/沉淀 | 常用命令/证据 |
| --- | --- | --- | --- | --- | --- |
| `define` | `explore` | 用上下文、记忆和代码图谱降低歧义，先确认项目术语、历史经验、已拒绝概念和可能影响面。复杂代码问题先查 CodeGraph/Graphify；长会话或跨 Agent 场景先拉 Memory Fabric/context pack。 | `.scale/GLOSSARY.md`；Context Pack；Memory Provider recall；Memory Fabric；CodeGraph/Graphify；Out-of-scope entries；Cerebrum preferences | 通常不写长期知识；只记录 explore 证据、已读文件和 skill scan | `scale context pack --task ...`；`scale memory provider recall ...`；`scale memory pack ...`；`scale codegraph query ...`；`scale out-of-scope check ...`；`scale skill radar ...`；`explore.md`、`skill-plan.md` |
| `plan` | `plan` | 把召回结果转成计划约束：哪些历史经验要遵守、哪些 out-of-scope 不能重开、哪些文件/符号有影响面、需要哪些 skill/provider 和验证门禁。`ai-os plan` 会同时生成 context、memory recall、memory context pack、skill plan、adaptive workflow 和 ROI。 | Context Compiler；Memory Provider recall；Memory Brain/Memory Fabric；CodeGraph impact/context；Skill Policy；Cerebrum；Out-of-scope | 计划产物，不直接提升长期记忆；必要时记录新 out-of-scope rationale | `scale ai-os plan --task ... --files ...`；`scale codegraph impact --symbol ...`；`scale codegraph context --symbol ...`；`scale skill plan ...`；`plan.md`、`api-contract.md`、`security-review.md` |
| `build` | `execute` | 实现时主要消费计划阶段给出的知识约束：按图谱推荐文件局部读取，遵守 Cerebrum do-not-repeat/preference，避免重犯历史事故；运行中的真实命令和工具结果进入 runtime evidence，供后续 memory pack/settle 使用。 | 计划产物；CodeGraph context files；Cerebrum；Context Pack；相关 docs/ADR/glossary；Skill Plan | Runtime Evidence；Tool/skill evidence；必要时更新长期文档或 ADR，但不应把未经验证的会话判断直接写入长期记忆 | `scale context status`；局部 `rg/read`；实际 build/edit 命令证据；`skill-evidence.md`；runtime evidence |
| `verify` | `verify` | 用证据层验证“知识是否可用、结论是否可信”：检查 context budget、memory pack 是否在预算内、CodeGraph/Graphify/GBrain provider 是否可用，运行测试/冒烟/浏览器验证，并把结果写入 evidence。 | Memory Fabric；Memory Provider status；Code Intelligence status；Context Budget；Runtime Evidence；Skill evidence | Verification evidence；失败证据；可作为后续 Memory Learning candidate 的输入 | `scale context doctor ...`；`scale memory doctor ...`；`scale memory provider status --json`；`scale codegraph status --json`；`scale tool doctor --tools gbrain,codegraph,graphify --json`；`verification.md` |
| `review` | `review` / `security` | 审查阶段重新读取记忆、图谱、证据和历史事故，验证方案是否违背已有规则、是否遗漏影响面、是否需要安全/架构/质量角色补评。Memory Brain 的 contradictions/dream 可用于发现冲突或陈旧知识。 | Runtime Evidence；Memory Pack；Memory Brain active/candidate memories；Memory contradictions；CodeGraph impact/context；Skill evidence；Security/standards docs | Review findings；accepted risk；必要时把“拒绝原因”写入 Out-of-scope，或把可复用教训标记为候选 | `scale memory query ...`；`scale memory contradictions`；`scale memory dream`；`scale codegraph impact ...`；`scale out-of-scope add/check ...`；`review.md`、`security-review.md` |
| `ship` | `consolidate` | 交付阶段做知识收口：把真实运行证据压缩成 learning candidate，经人审后再 promote 到 Memory Brain 或写入 docs/rules/ADR；同时更新术语、out-of-scope、summary 和未验证项。 | Runtime Evidence；Memory Fabric pack；Review/verification evidence；Cerebrum；Out-of-scope；docs/ADR/glossary | `.scale/memory/learning-candidates/*`；Memory Brain active node；`summary.md`；长期 docs/rules/ADR；Out-of-scope entries；Cerebrum md | `scale memory settle ...`；`scale memory promote <id>`；`scale memory export/import`；`scale memory cerebrum --write`；`scale out-of-scope add ...`；`summary.md` |

### 节点使用原则

| 原则 | 含义 |
| --- | --- |
| 先读后写 | `define/plan/review` 以读取上下文、记忆、图谱和历史决策为主；`ship/consolidate` 才把稳定经验沉淀为长期知识。 |
| 证据优先 | Memory Fabric 的推荐闭环是 `runtime evidence -> memory pack -> memory settle -> 人审 -> knowledge/docs/rules`，不会把一次会话判断自动升级成长期规则。 |
| Provider 有 fallback | Memory Provider 默认顺序是 `gbrain -> agentmemory -> scale-local`；Code Intelligence 默认优先 `codegraph`/`graphify`，不可用时回退 `internal-scan`、`rg`、`read`。 |
| 预算可解释 | Context Compiler 和 Memory Fabric 都会记录 included/omitted section、token 预算和裁剪原因，避免 Agent 误以为没有相关知识。 |
| 外部写入默认关闭 | `.scale/memory-providers.json` 当前 `allowExternalWrite=false`，外部 memory provider 默认只读；长期写入需要显式策略和评审边界。 |

### 需求阶段可使用的知识

需求阶段在 `scale-engine` 产品 workflow 中对应 `define`，在脚手架和 Claude 配置中通常对应 `explore`。这一阶段的目标是澄清需求、理解真实项目约束、降低歧义和识别主要矛盾，因此主要是“读知识”和“记录探索证据”，不应直接把未经验证的新判断写入长期记忆。

| 可用知识 | 作用 | 常用入口 | 输出/证据 |
| --- | --- | --- | --- |
| 项目基础上下文 | 了解项目目标、运行方式、开发规范、工作流入口 | `README.md`、`AGENTS.md`、`docs/guides/GETTING_STARTED.md`、`docs/guides/DEVELOPMENT_WORKFLOW.md`、`docs/workflow/README.md` | 已读文件清单、main contradiction、`explore.md` |
| 术语和项目语言 | 确认项目专有词、概念边界和常用命名，避免误解需求 | `.scale/GLOSSARY.md`、`scale context glossary` | 术语引用、歧义点、待确认问题 |
| Context Pack | 生成与当前任务相关的预算化上下文，避免整仓库噪声 | `scale context pack --task "..." --files "..." --level M` | included/omitted sections、token budget、context evidence |
| Memory Provider 召回 | 查询跨会话记忆、历史经验、相似问题和团队约束 | `scale memory provider recall "..." --json` | provider order、selected provider、fallback reason、recall items |
| Memory Fabric | 聚合 runtime evidence、session events、knowledge recall 和 project graph 摘要 | `scale memory pack --task "..." --files "..." --budget 4000` | memory context pack、runtime/session/knowledge/graph sections |
| KnowledgeBase 已验证经验 | 召回 lesson、规则、历史教训和可复用模式 | 通过 `MemoryFabric` 或 `KnowledgeBase.recall/recallByVector` 间接使用 | knowledge recall Top K、relevance、verified 标记 |
| CodeGraph / Graphify | 理解代码结构、模块关系、符号、路由和潜在影响面 | `scale codegraph query "..."`、`scale codegraph context --symbol ...` | 命中文件、符号、confidence、fallbackUsed |
| Out-of-scope 制度记忆 | 查询某个需求、方向或概念是否以前已被拒绝，避免重复讨论 | `scale out-of-scope check "..."` | matched entry、拒绝原因、是否需要重新评估 |
| Cerebrum 偏好/禁忌 | 读取用户偏好和 do-not-repeat 规则，避免重复踩坑 | `scale memory cerebrum`、`.scale/cerebrum.md` | preference/do-not-repeat 摘要 |
| Skill Radar / Skill Policy | 判断需求涉及哪些能力、skill、MCP、CLI、浏览器或外部 provider | `scale skill radar --task "..." --phase define`、`scale skill plan ...` | `skill-plan.md`、recommended/required skills、required evidence |
| 外部事实和网页信息 | 当需求依赖最新 API、法规、产品、竞品或网页动态内容时补充事实来源 | `web-access`、`agent-browser`、官方文档/来源引用 | source citation、browser evidence、未确认项 |

推荐使用顺序：

1. 先读项目基础上下文：`README.md`、`AGENTS.md`、`.scale/GLOSSARY.md` 和 workflow 文档。
2. 生成任务相关 context：`scale context pack --task "..."`。
3. 需要历史经验时查 memory：`scale memory provider recall "..."` 或 `scale memory pack --task "..."`。
4. 涉及代码影响面时查 codegraph：`scale codegraph query "..."` 或 `scale codegraph context --symbol ...`。
5. 需求可能重复、被拒绝或边界不清时查 out-of-scope 和 Cerebrum。
6. 最后用 Skill Radar/Skill Plan 判断后续 `plan/build/verify` 需要哪些 skill 和证据。

阶段边界：

- 可以输出 `explore.md`、`mini-prd.md`、`skill-plan.md`、已读文件清单、问题清单和未确认项。
- 不应直接 promote Memory Brain，也不应把一次需求讨论中的猜测写入长期规则。
- 如果发现稳定、可复用的新事实，先作为计划或总结里的候选记录，等 `ship/consolidate` 阶段通过 `memory settle -> 人审 -> promote/docs/rules` 再沉淀。

### 知识相关构建、Skill、Agent 和组件的安装阶段

说明：

- 这里的“安装阶段”不是 workflow 的 `build/execute` 节点，而是项目接入和第三方依赖准备阶段。
- `define/plan/build/verify/review/ship` 节点默认只消费这些能力；真正安装或初始化通常发生在 `scale init`、`scale setup`、`scale bootstrap deps`、`scale codegraph init` 或 provider 自身初始化命令里。
- `setup`/`bootstrap deps` 默认先输出计划；只有显式 `--apply` 或 `--yes` 才执行安装。

| 对象 | 类型 | 安装/初始化阶段 | 触发命令 | 安装/构建内容 | 后续验证 |
| --- | --- | --- | --- | --- | --- |
| Agent adapter 知识文档 | Agent 宿主接入 | 项目初始化阶段 | `scale init --agent <agent>` 或 quick start | 生成平台 settings、knowledge doc、skills dir、hooks；例如 `AGENTS.md`、`CLAUDE.md` 或各平台规则文件 | 查看 init 输出的 `Knowledge:` 路径；后续 `scale context inject/status` |
| `.scale/config.yaml` | 项目配置 | 项目初始化阶段 | `scale init ...` | 写入 profile、storage、knowledge backend、memory provider 等基础配置 | `scale doctor`、`scale setup --verify` |
| GBrain | memory provider / CLI | 第三方依赖安装阶段，`memory` pack | `scale setup --pack memory --memory-provider gbrain --apply --yes` 或 `scale bootstrap deps --pack memory --apply` | 安装 `gbrain` CLI；初始化 brain，例如 `gbrain init --pglite`；写入/调整 `.scale/memory-providers.json` provider 顺序 | `scale memory provider status --json`；`scale tool doctor --tools gbrain --json`；强验证用 `npm run smoke:gbrain` |
| agentmemory | optional memory provider / MCP | 手动外部服务接入阶段 | 配置 provider，或按上游命令启动 agentmemory/MCP | 作为可选外部 provider；当前 bootstrap definitions 未自动安装它，`.scale/memory-providers.json` 默认禁用 | `scale memory provider status --json`；需要隐私、保留、删除边界评审 |
| scale-local / Memory Brain | 本地长期记忆 | 运行时懒创建 | `scale memory ingest/query/promote/...` | 使用 `.scale/memory/brain.sqlite` 本地库；`MemoryBrain` 构造时创建目录和 schema | `scale memory query ...`；`scale memory dream`；`scale memory contradictions` |
| Memory Fabric | 本地 context pack 构建 | workflow 使用阶段，无第三方安装 | `scale memory pack --task ...`、`scale memory doctor ...` | 聚合 runtime evidence、session events、knowledge recall、project graph 摘要 | pack 输出 included/omitted sections；`scale memory doctor ...` |
| Graphify CLI | knowledge graph provider / CLI / skill | 第三方依赖安装阶段，`knowledge` pack | `scale setup --pack knowledge --apply --yes` 或 `scale bootstrap deps --pack knowledge --apply` | 通过 `uv/pipx/pip/python` 安装 Graphify；执行 `graphify install --platform codex`、`graphify hook install` | `scale tool doctor --tools graphify --json`；`graphify hook status` |
| Graphify 图谱产物 | 知识图谱 artifact | provider 初始化/图谱构建阶段 | `graphify update <project> --no-cluster` | 生成 `graphify-out/graph.json` 和相关报告；SCALE 只把它当 artifact provider，不默认提交生成产物 | `scale codegraph status --json`；强验证用 `npm run smoke:graphify -- --large-project <path>` |
| CodeGraph CLI | code intelligence provider / CLI | 第三方依赖安装阶段，`knowledge` pack | `scale setup --pack knowledge --apply --yes` 或 `scale bootstrap deps --pack knowledge --apply` | `npm install -g @colbymchenry/codegraph` | `scale tool doctor --tools codegraph --json` |
| `.codegraph/` 项目索引 | 代码结构索引 | provider 初始化/索引构建阶段 | `codegraph init -i` 或 `scale codegraph init` | 生成项目本地 `.codegraph/` 索引，供 symbol/query/context/impact 使用 | `scale codegraph status --json`；`codegraph status .` |
| `.scale/code-intelligence.json` | 代码智能 provider 配置 | knowledge pack post-action 或手动 init | `scale codegraph init`；`scale bootstrap deps --pack knowledge --apply` | 写入 `codegraph`、`graphify` provider 和 fallback 配置 | `scale codegraph status --json` |
| `.scale/memory-providers.json` | memory provider 路由配置 | memory pack post-action 或 provider use | `scale memory provider init`；`scale memory provider use gbrain --json`；`scale setup --pack memory ...` | 写入 provider 顺序、写入策略、外部 provider 安全边界 | `scale memory provider status --json` |
| UI/文档知识 skills | skill-file / vendor reference | UI pack 安装阶段，不属于 knowledge pack 默认项 | `scale setup --pack ui --include awesome-design-md --apply`、`scale setup --pack ui --include ui-ux-pro-max --apply` | 同步上游到 `~/.scale/vendor/*`，生成 `~/.agents/skills/*/SKILL.md` | `scale tool doctor --tools awesome-design-md,ui-ux-pro-max --json`；`scale skill doctor --json` |
| Skill Radar / Skill Policy | 内置路由能力 | 项目配置阶段，无外部安装 | `.scale/skills.json` 随 governance pack/init 提供；也可手动编辑 | 根据任务/文件/等级推荐 required/recommended skills 和证据 | `scale skill radar --task ...`；`scale skill plan ...` |
| Out-of-scope | 本地制度记忆 | 使用时创建 | `scale out-of-scope add ...` | 生成 `.scale/out-of-scope/` 条目 | `scale out-of-scope list/check ...` |
| Cerebrum | 本地偏好/禁忌知识 | 使用时写入 | `scale memory cerebrum --type preference ...` 或 `--type do-not-repeat ...` | 写入 KnowledgeBase 条目，可生成 `.scale/cerebrum.md` | `scale memory cerebrum --json` |

安装顺序建议：

1. **项目初始化**：`scale init --agent <agent>`，生成宿主 Agent 的 settings、knowledge doc、hooks 和基础 `.scale/config.yaml`。
2. **依赖计划**：`scale setup --pack memory,knowledge --json` 或 `scale bootstrap deps --pack memory,knowledge`，先看 runtimeChecks。
3. **显式安装**：确认后运行 `scale setup --pack memory,knowledge --apply --yes`。
4. **Provider 初始化**：根据提示执行或确认 `gbrain init --pglite`、`graphify update <project> --no-cluster`、`codegraph init -i`。
5. **状态验证**：运行 `scale memory provider status --json`、`scale codegraph status --json`、`scale tool doctor --tools gbrain,codegraph,graphify --json`。
6. **Workflow 使用**：进入 `define/plan/...` 后，通过 `scale context pack`、`scale memory provider recall`、`scale memory pack`、`scale codegraph query/context/impact` 消费这些能力。
7. **交付沉淀**：到 `ship/consolidate` 阶段再用 `scale memory settle`、`scale memory promote`、docs/rules/ADR/out-of-scope 做长期知识沉淀。

### 当前文档缺口

| 缺口 | 影响 | 建议补充 |
| --- | --- | --- |
| `KnowledgeBase` 没有单篇说明文档 | 需要从架构、数据模型、源码和术语表拼接理解 | 增加 `docs/KNOWLEDGE_BASE.md`，说明 entry 类型、SQLite schema、Graphify overlay、TF-IDF recall、verify/decay 规则 |
| `CerebrumManager` 没有单篇说明文档 | 用户偏好和 do-not-repeat 与 Memory Brain 的关系不够清晰 | 增加 `docs/CEREBRUM.md` 或并入 `docs/MEMORY_BRAIN.md` 的独立章节 |
| `OutOfScopeStore` 没有单篇说明文档 | “拒绝过的概念”如何进入规划/审查上下文不够明确 | 增加 `docs/OUT_OF_SCOPE_MEMORY.md`，说明 add/check/list/remove 和提交边界 |
| Agent Adapter 的知识注入差异主要在源码中 | 难比较各宿主 Agent 的 knowledge doc、skills dir、hook 注入路径 | 增加 adapter matrix，列出每个平台的 `knowledgeDocPath`、`skillsDir`、hook 支持和限制 |

## 各项目 Workflow 节点与可用 Skill

说明：

- `scale-engine` 的 skill 决策来自 `scale skill plan` 使用的 routing policy。它不是按 phase 硬编码 skill，而是按任务描述、文件、服务识别 domain 后生成 required/recommended skill。
- `project-scaffold` 使用 `.scale/skills.json`，schema 与 `scale-engine` 相同，但 domain 和 skill 数量更少。
- `scale-os-config-claude-code` 使用 `.scale/skills-registry.json`，它是 registry schema，依靠 `CLAUDE.md` 和 hooks 进行软路由。表中列出当前配置中可用于该节点的代表性 skill。

### `scale-engine`

| Workflow 节点 | 节点职责 | 可用 skill / domain | 优先级规则 | 需要的证据 |
| --- | --- | --- | --- | --- |
| `define` | 需求定义、上下文读取、歧义降低、外部事实确认 | `web-access`；`agent-browser`；`mcp-chrome-devtools`；`source-driven-development`；`browser-use`；`find-skills`；`fullstack-developer` | web research 类任务优先 `web-access`；缺能力时使用 `find-skills`；prototype/MVP 触发 `fullstack-developer` | `skill-plan.md`、`skill-evidence.md`、source citation、browser evidence、mini-prd |
| `plan` | 方案设计、边界、异常、回滚、接口/数据/安全计划 | UI：`awesome-design-md`、`ui-ux-pro-max`、`frontend-design`、`design-review`；API：`tdd-guide`、`code-review`；DB/security：`security-review`、`systematic-debugging`；standards：`code-review-and-quality`、`security-and-hardening`、`documentation-and-adrs` | required skills 先于 recommended skills；domain 分数越高越靠前；同一 domain 内按数组顺序 | `skill-plan.md`、`mini-prd.md`、`ui-spec.md`、`api-contract.md`、`db-change-plan.md`、`security-review.md`、`architecture-review.md` |
| `build` | 实现代码、脚本、文档和治理配置 | UI：`awesome-design-md`、`ui-ux-pro-max`、`frontend-design`；API：`tdd-guide`；DB：`security-review`；external CLI：`codex-cli`、`gemini-cli`、`opencode-cli`；fullstack：`fullstack-developer` | 由任务涉及文件和关键词触发；DB/security required skill 不得被 recommended skill 替代 | `skill-evidence.md`、implementation evidence、contract-check、rollback-plan、side-effect-boundary |
| `verify` | 运行验证、浏览器/E2E、截图、控制台/网络证据 | Browser/E2E：`webapp-testing`、`agent-browser`、`web-access`、`mcp-chrome-devtools`、`playwright`、`playwright-interactive`；release：`verification` | E2E/browser 文件或关键词命中后推荐浏览器技能；required verification 必须有实际证据或 fallback 记录 | `verification.md`、browser-run、screenshot、console-log、network-console-check、preflight |
| `review` | 代码审查、安全审查、设计审查、规范审查 | `code-reviewer`；`code-review`；`design-review`；`security-review`；`code-review-and-quality`；`security-and-hardening`；`documentation-and-adrs` | review/release domain 触发 `code-reviewer`；security/db domain 触发 `security-review`；standards domain 触发质量/安全/文档组合 | `review.md`、`skill-evidence.md`、review-evidence、threat-model、standards-scan |
| `ship` | 交付、发版、PR、总结、最终证据收口 | `code-reviewer`；`pr-creator`；`fix`；`verification`；`code-review`；`git-workflow-and-versioning` | release domain 中 `code-reviewer` 为 required；其余为 recommended；必须先满足 verify/review evidence | `summary.md`、`review.md`、`skill-evidence.md`、preflight、final verification evidence |

### `project-scaffold`

| Workflow 节点 | 节点职责 | 可用 skill / capability | 优先级规则 | 需要的证据 |
| --- | --- | --- | --- | --- |
| `explore` | 读取现状、确认主要矛盾、识别影响面 | CodeGraph/Graphify；`workflow-guide`；按任务触发 UI/API/DB/security/docs/release domain | 先读文件和现状；复杂代码理解优先 CodeGraph/Graphify，不可用时回退 `rg` 和局部读取 | `explore.md`、已读文件、main contradiction、G1 |
| `plan` | 写计划、范围、异常、回滚、验证方式 | UI：`ui-ux-pro-max`、`frontend-design`、`design-review`；API：`tdd-guide`、`code-review`；DB/security：`security-review`、`systematic-debugging`；docs：`workflow-guide`；release：`verification`、`code-review` | `.scale/skills.json` warn 模式；DB/security 有 required `security-review`；其余多为 recommended | `plan.md`、`skill-plan.md`、`mini-prd.md`、`api-contract.md`、`db-change-plan.md`、`security-review.md`、G2 |
| `execute` | 执行改动和 TDD | `tdd-guide`；`ui-ux-pro-max`；`frontend-design`；`systematic-debugging`；`security-review` | 写新行为优先 TDD；DB/security 改动优先安全评审；UI 改动优先 UI/design skill | 代码/脚本/文档 diff、测试先行说明或不适用原因、G3 |
| `verify` | 运行脚手架或派生项目验证 profile | E2E：`playwright`、`playwright-interactive`；release：`verification`；review：`code-review`；UI：`design-review` | 普通 scaffold 验证走 `make verify PROFILE=scaffold`；E2E/browser 文件命中时补 Playwright skill | `verification.md`、browser-run、screenshot、responsive-check、contract-check、G4-G7 |
| `review` | L/CRITICAL 或提交前审查 | `code-review`；`design-review`；`security-review`；`verification` | 涉及权限、DB、发布、安全时必须升级审查强度 | `review.md`、review findings、accepted risk/fix evidence |
| `security` | critical 任务安全检查 | `security-review`；`systematic-debugging`；安全扫描相关工具 | auth/security/credential/migration/schema 关键词自动升级 critical | `security-review.md`、threat-model、rollback-plan、G7 |
| `consolidate` | 总结、知识沉淀、长期文档同步、资源治理 | `workflow-guide`；`verification`；`code-review`；CodeGraph/Graphify | 长期事实写入 README/标准/ADR/CONTEXT；临时证据默认不提交 | `summary.md`、metrics、长期文档更新记录、final review |

### `scale-os-config-claude-code`

| Workflow 节点 | 节点职责 | 可用 skill / registry 条目 | 优先级规则 | 需要的证据 |
| --- | --- | --- | --- | --- |
| `explore` | 会话启动、技能扫描、上下文读取、知识图谱/记忆召回 | `graphify`；`openwolf`；`memect-ppx`；`trace`；`systematic-debugging`；`deep-interview`；`zoom-out`；`gbrain-memory` | `CLAUDE.md` 要求先读 registry 的名称、说明、触发条件和安全状态；需求模糊优先 `deep-interview`；复杂项目优先 `graphify` | `[SKILL SCAN]` 记录、已读文件、main contradiction、知识/记忆召回证据 |
| `plan` | 需求评审、头脑风暴、计划和方案冻结 | `deep-interview`；`office-hours`；`brainstorming`；`writing-plans`；`ralplan`；`autoplan`；`vibe-coding-workflow`；`grill-with-docs`；`planning-with-files` | L 级规划优先 `writing-plans`；设计阶段优先 `brainstorming`；需求模糊优先 `deep-interview`；只选最小可用组合 | `plan.md`、skills_used、skipped_reason、风险/回滚/验证方式 |
| `review` | 代码、方案、安全、质量审查 | `review`；`code-review-graph`；`ce-review`；`cso`；`ultraqa`；`karpathy-guidelines`；`harness-engineering`；role presets 如 `code-reviewer`/`security` 类条目 | 提交/PR 前优先 review 类；高风险任务补 security/quality 类；第三方 skill 先做 supply-chain review | `review.md`、finding list、severity、accepted-risk-or-fix |
| `execute` | 实现、自动化执行、多 agent/角色协作 | `freeze-guard`；`tdd`；`autopilot`；`ralph`；`ultrawork`；`team`；`subagent-driven-dev`；`frontend-developer`；`backend-architect`；`senior-developer`；`software-architect` | 执行前优先 `freeze-guard`；写新代码优先 `tdd`；确定性高的重复任务才用 `autopilot`；多角色任务才用 `team`/`subagent-driven-dev` | 实际改动、TDD 证据、tool_outputs、fallback/skipped_reason |
| `verify` | 测试、QA、浏览器/E2E、真实验证 | `verification`；`qa`；`ultraqa`；`playwright`/browser 类能力；`agent-browser`；`browser-testing-with-devtools`；`code-review-graph` | 声称完成前必须 `verification`；浏览器/E2E 任务补 browser/playwright/devtools；失败必须记录降级方案 | `verification.md`、exit code、screenshot、console/network evidence、未验证项 |
| `security` | 权限、凭据、生产配置、数据库、供应链风险 | `openclaw-security`；`security-and-hardening`；`security-review` 类 role preset；`identity-trust`；`cso`；`gosec`/dependency audit 类工具 | auth/permission/token/credential/migration/schema 自动升级；安装第三方 skill 前检查来源、脚本、依赖、postinstall 和权限 | `security-review.md`、threat-model、rollback-plan、safety review、blocked/skipped reason |
| `consolidate` | 总结、学习、知识沉淀、配置同步 | `learn`；`retro`；`learner`；`openspace-evolve`；`gbrain-memory`；`openwolf`；`graphify`；`workflow-guide` | 重要任务结束后必须总结经验教训并更新知识文档；不确认信息标记 `[UNCERTAIN]` | `summary.md`、skills_used、tool_outputs、知识库/文档更新记录、未验证项 |

## 一致性结论

| 维度 | 是否一致 | 结论 |
| --- | --- | --- |
| 高层治理闭环 | 一致 | 三者都收敛到探索/规划/执行/验证/审查交付。 |
| canonical phase 名称 | 不一致 | `scale-engine` 使用 `define/build/ship`；脚手架和生成配置使用 `explore/execute/consolidate`。 |
| 门禁目录 | 部分一致 | `scale-engine` 最完整；`project-scaffold` 脚本较完整但 `.claude/workflow.json` 较旧；Claude 生成配置使用 G0-G9。 |
| Skill policy schema | 部分一致 | `scale-engine` 和 `project-scaffold` 使用 `.scale/skills.json`；Claude 生成配置使用 `.scale/skills-registry.json`。 |
| 运行时强制方式 | 不一致 | `scale-engine` 有代码级 CLI/gate/skill planning；`project-scaffold` 依赖脚本和 Make targets；Claude 配置主要依赖 hooks 和 prompt 规则。 |

## 规范化建议

建议以 `scale-engine` 的产品阶段作为 canonical model：

```text
define -> plan -> build -> verify -> review -> ship
```

同时保留面向脚手架/配置用户的兼容别名：

| Canonical phase | Alias |
| --- | --- |
| `define` | `explore` |
| `build` | `execute` |
| `ship` | `consolidate` |

建议后续动作：

- 生成配置时同时写入 canonical phase 和 display alias。
- 更新 `project-scaffold/.claude/workflow.json`，让它和 `scripts/gates/G0-G22` 的门禁目录保持同一代。
- 明确决定 Claude 生成配置是否也输出 `.scale/skills.json`；如果不输出，应文档化 `.scale/skills-registry.json` 是另一套 registry schema。
- 保持 `scale skill plan` 作为任务级权威路由计划，`scale skill radar` 作为推荐和发现报告。

## 对 `spec-first` 的参考优化点

`spec-first` 和 SCALE 的共同目标都是把一次性 Agent 对话变成可治理、可验证、可复用的工程闭环。区别在于：

- SCALE 倾向用 `Artifact + Event + FSM + Gate + Hook` 建立更硬的运行时约束。
- `spec-first` 倾向用 `Light contract + Explicit boundaries + Scripts prepare, LLM decides` 保持轻量可维护边界。

因此，`spec-first` 适合借鉴 SCALE 的结构化证据和配置对齐方法，但不应直接复制 SCALE 的强状态机或强阻断模型。

### 可借鉴机制

| SCALE 机制 | `spec-first` 当前相近能力 | 可参考优化 | 边界 |
| --- | --- | --- | --- |
| Canonical workflow phase | `ideate -> brainstorm/prd -> plan -> tasks -> work/debug/review -> compound` | 增加一份轻量 phase-alias catalog，把 `brainstorm/plan/work/review/compound` 与用户可读阶段、artifact roots、expected evidence 对齐。 | 只做路由和文档事实，不把 workflow 变成全局状态机。 |
| Gate catalog | `doctor`、`mcp-setup`、`graph-bootstrap`、review/debug/work 内部验证要求 | 为核心 workflow 建一个 advisory gate catalog，列出 setup、context、graph、plan、work、review、knowledge 的最小证据。 | Gate 输出 reason_code 和证据路径，由 LLM 判断是否继续；避免 hard block 除非是 source/runtime 或安全边界。 |
| Evidence store | `docs/brainstorms/`、`docs/plans/`、`docs/tasks/`、`docs/solutions/`、`.spec-first/providers/**`、`.spec-first/graph/**` | 引入轻量 `workflow evidence index`，记录 artifact path、producer、freshness、authority_level、consumer。 | 不做 SQLite/Event Sourcing；repo-local Markdown 和 JSON facts 仍是主要真相源。 |
| Skill routing policy | `using-spec-first` 路由、各 `$spec-*` skill contract | 为 public workflow 产出一个只读 routing matrix：intent -> entrypoint -> required facts -> optional providers -> degraded mode。 | 不让脚本替代入口判断；routing matrix 是 LLM 输入质量增强，不是自动派发器。 |
| Runtime hook/check | `spec-first init/doctor/clean`、source/runtime drift 规则 | 增加 preview-first runtime drift summary，让用户在更新 runtime 前看到 source slice、generated mirror、provider facts 的差异。 | 不手改 generated mirrors；不把 hook 当作主要治理入口。 |
| Evolution / Cortex | `spec-compound`、`docs/solutions/`、skill audit、review residuals | 让 debug/review/work 的 closeout 更稳定地提示是否应沉淀 solution，并记录 rejected rationale。 | 学习沉淀由 LLM 选择，人审或用户确认后进入长期知识；不自动把 lesson 升级成 rule/hook。 |

### 知识库层是否适合借鉴到 `spec-first`

结论：**适合借鉴，但不适合照搬 SCALE 的 Memory Brain / Memory Fabric / Cortex runtime。**

`spec-first` 已经有一个 repo-local knowledge base 原型：`docs/solutions/`、`spec-compound`、`spec-compound-refresh`、`artifact-summary.v1` 和 `context-bundle.v1`。SCALE 的知识库层可以帮助 `spec-first` 把这条链路做得更可检索、更可维护，但落点应该是轻量 contract 和 workflow handoff，而不是 SQLite 长期记忆、自动 SessionStart 注入或强制规则进化。

| SCALE 知识层 | 核心思想 | `spec-first` 可借鉴形态 | 不照搬的部分 |
| --- | --- | --- | --- |
| Memory Fabric | 为当前任务生成预算受控的 context pack，聚合 runtime evidence、session events、knowledge recall、project graph 摘要。 | 强化 `context-bundle.v1`：加入 `solution_summaries`、`recalled_learnings`、`omitted_reason`、`budget_pressure`，让 plan/work/review 先消费摘要和 evidence paths。 | 不做全局 Context Router；不把大型图谱、raw session、raw provider output 塞进 prompt。 |
| Memory Brain | 存储 reviewed project knowledge，带 evidencePaths、confidence、scope、status、contradiction checks。 | 强化 `docs/solutions/` frontmatter：增加或规范 `evidence_paths`、`confidence`、`scope`、`status`、`last_verified_at`、`contradicts` 等轻量字段。 | 不引入 `.spec-first/memory/*.sqlite` 作为新的真相源；source-first 仍以 Markdown learning docs 为主。 |
| Memory Provider Router | 外部 memory provider 优先，local fallback，记录 provider 可用性和 fallback reason。 | 作为 optional provider facts：`spec-mcp-setup` 或 `doctor` 可报告 memory provider readiness，workflow 只消费 `provider-memory` 摘要。 | 不默认要求 gbrain/agentmemory；外部 provider 不成为 core workflow 前置条件。 |
| Memory settle / promote | 运行证据先生成 candidate，人审或显式 promote 后进入 active memory。 | `spec-work`、`spec-debug`、`spec-code-review` closeout 生成 “compound candidate” 摘要，用户选择后进入 `spec-compound`。 | 不自动把每次会话观察写进长期知识；不自动 promote。 |
| Contradiction checks | 检测 active memory 之间的冲突，但不自动解决。 | `spec-compound-refresh` 增加 contradiction scan：同一 module/component 下 conflicting solution、stale path、相反建议。 | 不让脚本决定哪条知识“正确”；脚本只输出冲突候选和 evidence paths。 |
| Dream maintenance | 周期性报告 stale、duplicate、missing evidence、docs update suggestion。 | 增强 `spec-compound-refresh` broad mode：生成 stale/duplicate/missing-evidence report。 | 不自动删除、改规范或注入 rule；需要 evidence-backed edit 或用户确认。 |
| Cortex Instincts | 从失败中提取高置信 instinct 并注入 SessionStart。 | 只借鉴 confidence ladder 和 hit-rate 思想，用于给 solution docs 排优先级和复查频率。 | 不自动 SessionStart 注入；不自动 lesson -> rule -> hook。 |

建议的 `spec-first` 最小集成路径：

1. **Solution metadata v2**
   - 在 `docs/solutions/` frontmatter contract 中补充 `evidence_paths`、`confidence`、`scope`、`status`、`last_verified_at`、`source_artifacts`。
   - 保持 backward-compatible；旧文档不强制迁移。

2. **Knowledge recall summary**
   - 给 plan/work/debug/review 增加可选 `solution_summaries` 输入块。
   - 每条 recalled learning 只带 title、path、applies_when、confidence、freshness、evidence_paths。
   - 命中 full-read trigger 时才打开完整 solution doc。

3. **Compound candidate handoff**
   - `spec-work`、`spec-debug`、`spec-code-review` closeout 在发现可复用经验时输出候选：

   ```json
   {
     "candidate_type": "compound-learning",
     "problem": "what was solved",
     "evidence_paths": ["tests/unit/example.test.js"],
     "recommended_action": "$spec-compound"
   }
   ```

   - 这只是 handoff，不是自动写入长期知识。

4. **Contradiction / stale scan**
   - `spec-compound-refresh` 先做轻量 inventory：按 module、component、tags 聚类，检查重复、冲突、路径失效和 missing evidence。
   - 输出 recommendation，由 LLM 或用户决定 keep/update/consolidate/replace/delete。

5. **Optional memory provider readiness**
   - `spec-mcp-setup` / `doctor` 可以检测外部 memory provider 是否可用。
   - workflow 消费时必须标记 `confirmed|advisory|stale|degraded`，不能把外部 recall 当成 source truth。

这个方向能提升 `spec-first` 的 Knowledge Harness，但仍保持核心边界：

- `docs/solutions/` 是长期知识 source surface。
- `.spec-first/**` 只放运行事实、索引、候选和 provider readiness。
- 脚本只做 recall、inventory、schema、stale/contradiction candidate。
- LLM 决定哪些知识适用、是否沉淀、是否替换旧知识。

建议新增的 `spec-first` Knowledge Harness 结构：

| 层 | 建议形态 | Source / Runtime 边界 | 主要消费者 |
| --- | --- | --- | --- |
| Long-term learning source | `docs/solutions/**` Markdown learning docs，带 backward-compatible frontmatter。 | Source。可由 `spec-compound` / `spec-compound-refresh` 修改；不是 `.spec-first/**` runtime。 | `spec-plan`、`spec-work`、`spec-debug`、`spec-code-review`、人类维护者。 |
| Learning summary contract | `solution-summary.v1`，从 solution doc 提取 title、path、scope、applies_when、confidence、freshness、evidence_paths。 | Contract source 放在 `docs/contracts/`；summary 可作为 handoff 段落或临时 JSON facts。 | `context-bundle.v1`、review/work/debug handoff、compound-refresh。 |
| Recall / inventory helper | `spec-first internal solutions inventory|recall --json` 这类确定性 helper。 | CLI/helper 只读 source docs，输出 candidates 和 reason_code；不做语义适用性结论。 | workflow 动态上下文、doc-review、compound-refresh。 |
| Compound candidate | work/debug/review closeout 里的 `compound-learning` candidate。 | Runtime/handoff evidence，不是长期知识；进入 `docs/solutions/` 前必须经过 `spec-compound`。 | `spec-compound`、用户、后续 review。 |
| Maintenance report | `spec-compound-refresh` 生成 stale/duplicate/contradiction/missing-evidence report。 | Report 可以是 workflow artifact；具体知识修正仍写回 `docs/solutions/`。 | 维护者、后续 plan/work/review。 |
| Optional provider memory | gbrain/agentmemory 等外部 recall 的 compact provider-memory summary。 | Provider evidence。必须标记 `confirmed|advisory|stale|degraded`；不得成为 source truth。 | plan/work/debug/review 的上下文候选。 |

`solution-summary.v1` 可以控制在很小的字段集合内：

```json
{
  "schema_version": "spec-first.solution-summary.v1",
  "source_path": "docs/solutions/workflow-issues/example.md",
  "title": "Reusable lesson title",
  "module": "spec-work",
  "component": "development_workflow",
  "problem_type": "workflow_issue",
  "scope": "project",
  "status": "active",
  "confidence": "medium",
  "freshness": "current|stale|unknown",
  "applies_when": ["brief trigger condition"],
  "evidence_paths": ["skills/spec-work/SKILL.md"],
  "full_read_triggers": [
    "需要精确步骤、代码片段、root cause 或 prevention detail"
  ]
}
```

这个 summary 的价值是让 downstream workflow 先看“是否相关”和“证据在哪里”，而不是默认把完整 learning doc 全文塞进上下文。

建议的 closeout candidate 结构：

```json
{
  "schema_version": "spec-first.compound-candidate.v1",
  "candidate_type": "compound-learning",
  "producer": "spec-work|spec-debug|spec-code-review",
  "problem": "short description of the solved problem",
  "reusable_lesson": "short reusable lesson",
  "source_artifacts": ["docs/plans/example-plan.md"],
  "evidence_paths": ["tests/unit/example.test.js"],
  "confidence": "low|medium|high",
  "promotion_boundary": "requires spec-compound before entering docs/solutions",
  "recommended_action": "$spec-compound"
}
```

这样可以借鉴 SCALE 的 settle/promote 分层，但仍保持 `spec-first` 的轻量边界：candidate 只是候选，`spec-compound` 才是进入长期知识的显式动作。

### 不建议直接照搬

| SCALE 做法 | 不直接照搬的原因 | `spec-first` 更合适的形态 |
| --- | --- | --- |
| Artifact 全量 FSM 作为 ground truth | `spec-first` 的价值在于轻 contract 和跨 host 文档化协作，强 FSM 会提高 schema、迁移、降级和双宿主成本。 | 只在 task-pack、run artifact、provider readiness 这类 machine-readable facts 上使用严格 schema。 |
| Stop Hook 强制阻断完成 | Codex/Claude host 能力不同，强 hook 会把 runtime 集成复杂度推到核心路径。 | 在 workflow closeout 中要求列出实际验证和未验证项；必要时由 `doctor`/`review` 发现缺口。 |
| Role 网关锁工具权限 | `spec-first` 不是 agent runtime sandbox，不能假装拥有统一工具权限控制面。 | 用 workflow contract、entry routing 和 review personas 管理语义角色。 |
| 自进化规则自动注入 SessionStart | 自动注入容易造成 prompt 膨胀、旧知识污染和多真相源。 | `docs/solutions/` 通过明确检索和引用进入上下文，带 freshness/confidence。 |
| 全局 central orchestrator | 会把 `spec-first` 从 workflow harness 推向中心化流程引擎。 | 继续保持 public workflow 自治：每个 `$spec-*` 负责自己的输入、产物、降级和 handoff。 |

### 最小落地顺序

1. **Phase alias catalog**
   - Source：`docs/contracts/` 或 `src/cli/contracts/` 下新增轻量 catalog。
   - Consumer：README、`using-spec-first`、workflow docs。
   - 验证：schema/unit test 或 docs link check。

2. **Workflow evidence index**
   - Source：现有 artifact roots 和 `.spec-first/*` facts。
   - Consumer：`spec-work` closeout、`spec-code-review` coverage、`spec-compound`。
   - 验证：给一个已有 plan/work/review 场景生成 index dry-run，不写入核心 runtime。

3. **Advisory gate catalog**
   - Source：当前 workflow contract 中已经存在的 verification/readiness 要求。
   - Consumer：`doctor`、`mcp-setup`、`graph-bootstrap`、review/work closeout。
   - 验证：只输出 `passed|failed|degraded|not_applicable` 和 reason_code，不输出语义结论。

4. **Skill routing matrix**
   - Source：`skills/*/SKILL.md` frontmatter 和 public entrypoint map。
   - Consumer：`using-spec-first` guide mode、README workflow table、runtime bootstrap block。
   - 验证：入口示例 eval，检查不把 internal helper 暴露成 public workflow。

5. **Knowledge closeout strengthening**
   - Source：`docs/solutions/`、`spec-compound`、`spec-compound-refresh` 与 review/debug/work 的 closeout summary。
   - Consumer：后续 plan/work/debug/review。
   - 验证：docs-only fixture，检查 compound candidate 有来源、evidence paths、confidence、边界和未沉淀原因。

## 面向 `spec-first` 的结论

SCALE 最值得 `spec-first` 学习的不是“更强状态机”，而是三点：

1. **证据对象更统一**：每个 workflow 输出都能说清 producer、freshness、consumer 和 authority。
2. **门禁目录更可见**：用户知道当前缺的是 setup、context、verification、review 还是 knowledge evidence。
3. **配置代际更可比**：canonical phase、alias、skill policy、runtime mirror 能被放进一张表里对齐。

`spec-first` 应保持自己的核心取舍：脚本产出事实，LLM 做语义判断；source 优先于 runtime；light contract 优先于完整状态机。SCALE 的优化点应进入 `spec-first` 的 facts、catalog、closeout 和 review evidence，而不是进入强制 workflow engine。
