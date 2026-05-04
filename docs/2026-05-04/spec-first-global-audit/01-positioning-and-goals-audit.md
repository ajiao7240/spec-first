# 产品定位与目标一致性审查

## 结论

当前项目主定位基本准确：`spec-first` 不是 prompt library，也不是通用 agent orchestration 工具，而是面向 Claude Code 与 Codex 的 workflow-first AI coding harness。README 的主叙事和当前代码大体一致，但 source truth 文档中仍有旧 manifest 概念残留，文档层也有历史 CRG/ECC 方案污染。

## 产品定位审查

| 维度 | 当前证据 | 判断 | 问题 | 建议 |
|---|---|---|---|---|
| 是否 workflow-first | `README.md:41` 明确不是 prompt snippet；`README.md:204-213` 展示完整闭环；`README.md:472` 列出 CLI helpers 与 public workflow entrypoints | 准确 | 无主叙事偏移 | 保持 “workflow harness + artifacts + review/knowledge loop” 作为主叙事 |
| 是否避免 prompt library 定位 | `README.md:390-405` 明确不是 prompt pack，也说明适用/不适用场景 | 准确 | skill/prose 资产多，外部读者仍可能把项目理解成 prompt collection | 在 README 前部增加 “Skill 是流程节点，不是提示词片段” 的术语框 |
| 是否避免 agent marketplace 定位 | `README.md:390` 明确不是 generic agent marketplace；`src/cli/contracts/dual-host-governance/skills-governance.json` 把 public workflow 与 internal-only 区分 | 基本准确 | 51 个 agents 的存在感较强，容易被误解为 agent catalog | 在 agent 文档中强调 agent 是局部专家 lens，由 workflow 调用，不是用户入口 |
| 是否明确 Claude/Codex 宿主依赖 | `README.md:118-128`、`:493-495` 区分 shell CLI 与 host session entries；adapter 代码也分离 | 准确 | postinstall 和 init 输出仍容易让新用户以为 init 后立即可在当前会话用 `$spec-*` | init 下一步必须继续强调 restart/new session 与 standards handoff |
| 是否明确 source/runtime 边界 | `README.md:329-331`、`src/cli/adapters/*`、`.gitignore:31-40` | 大体准确 | `AGENTS.md`/`CLAUDE.md` 仍列出不存在的 `.claude-plugin/plugin.json` | 更新 source truth 列表，改为 `src/cli/plugin.js` + governance JSON + templates |
| 是否明确 script/LLM 边界 | 角色契约与 `skills/spec-mcp-setup/SKILL.md`、`skills/spec-graph-bootstrap/SKILL.md` 多处强调 scripts prepare facts | 准确 | 部分 provider probe heuristic 很强，容易被理解成事实结论 | 每个 heuristic artifact 加 `advisory`/`candidate` 状态和 consumer rule |
| 是否目标足够聚焦 | 主链路聚焦 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` | 基本聚焦 | `ideate`、`polish-beta`、`slack-research`、`release-notes` 使入口面变宽 | README 应继续区分主链路、辅助入口、beta/optional 入口 |

## 表达冲突

| 冲突点 | 证据 | 风险 | 建议 |
|---|---|---|---|
| `.claude-plugin/plugin.json` 被列为 source truth，但文件不存在 | `AGENTS.md:84`、`CLAUDE.md:84`、`docs/10-prompt/结构化项目角色契约.md:193`；真实 manifest 在 `src/cli/plugin.js:115-156` | P1：维护者会去找或新增退休 manifest，破坏当前动态治理机制 | 改 source truth 列表为 `src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/skills-governance.json`、`templates/claude/commands/spec/*.md` |
| README expected init output 与 mcp-setup 新引导不同步 | `README.md:515-529`、`src/cli/commands/init.js:303-321` 只到 graph-bootstrap；`skills/spec-mcp-setup/SKILL.md:498-544` 已要求 graph ready 后推荐 standards | P1：first-run 用户完成 setup 后不知道应编译 standards baseline | 更新 init/README expected output，把 standards 作为 graph ready 后的 durable handoff |
| 外部官网链接存在，但仓库没有官网 source | `README.md:9-19`、`:409-411` 链到 `http://spec-first.cn/`；`package.json:63` homepage 指 GitHub README | P2：官网文案无法从 repo code truth 中验证，会形成发布前 blind spot | 将官网 source 纳入 repo 或在 release checklist 中加入 website sync check |
| 历史 CRG 文档仍大量可搜索 | `docs/README.md:34-45` 标为 historical-input，但 `rg "src/crg|spec-first crg"` 仍命中大量历史文档 | P2：新维护者容易把旧 internal CRG 当成当前能力 | 给历史目录加强 banner，或移动到 `docs/archive/` 并更新索引 |
| `docs/ideation/` 产物不够显眼 | `skills/spec-ideate/SKILL.md:17` 输出 `docs/ideation/`，但 `docs/05-用户手册/10-产物目录.md:17-20` 只列 brainstorm/plan/tasks/solutions | P2：ideate 的 durable artifact 不被用户理解 | 在 artifact catalog 和 README durable entities 增加 ideation |

## 核心术语统一建议

| 术语 | 推荐定义 | 当前证据 | 需要修正的点 |
|---|---|---|---|
| Prompt | 局部指令文本或 prompt asset，不是 workflow 单位 | 大量 `prompts/`、`SKILL.md` | 避免把 skill 简写成 prompt |
| Skill | 可由 host 加载的流程节点或 standalone capability，定义触发、边界、输入、输出、失败模式 | `skills/*/SKILL.md`、governance JSON | 强调 workflow_command / standalone / internal_only 三类 |
| Agent | 被 workflow 调用的局部专家 persona/lens，负责判断，不拥有主流程控制权 | `agents/*.agent.md`、`spec-code-review` reviewer dispatch | README 需降低 agent catalog 感 |
| Tool / Script | 确定性执行工具，负责检测、写 facts、校验 schema、运行命令 | `skills/*/scripts/*`、`src/cli/*` | 避免脚本输出语义结论；用 `reason_code` 和 `candidate/advisory` |
| Artifact | repo-local 或 temp 的证据/决策/运行产物，有 producer/consumer/lifecycle | `docs/*`、`.spec-first/*`、`/tmp/spec-first/*` | 明确 durable docs 与 runtime facts 区别 |
| Workflow | 用户面对的研发流程节点，串联输入、输出、质量门与后续动作 | 21 个 workflow command | 不把 internal helper 暴露成 workflow |
| Knowledge | 长期可复用的团队工程经验和历史上下文 | `docs/solutions/`、sessions/slack digest | 需要 freshness/status lifecycle |

## 建议的项目主叙事

建议对外统一成以下叙事：

> `spec-first` is a workflow-first AI coding harness for Claude Code and Codex. It turns one-off AI conversations into a project-local engineering loop: setup the harness, compile graph and project facts, write requirements and plans, execute scoped work, review with evidence, and compound reusable knowledge. Skills are workflow nodes, agents are local expert lenses, scripts prepare deterministic facts, and durable artifacts keep the next AI session from starting from zero.

中文叙事：

> `spec-first` 是面向 Claude Code 与 Codex 的 workflow-first AI coding harness。它不是 prompt 集合，而是把一次性 AI 对话收敛为项目内可规划、可执行、可审查、可沉淀的工程闭环：先准备工具与 graph facts，再形成需求和计划，执行受控改动，基于证据审查，最后把经验沉淀为团队知识。Skill 是流程节点，Agent 是局部专家，Script 只准备确定性事实，Artifact 承担跨会话传递。

## 是否偏离 workflow-first

没有整体偏离，但存在三个局部偏移风险：

| 风险 | 当前表现 | 是否已经失控 | 处理 |
|---|---|---|---|
| Prompt/agent collection 感 | `42` skills、`51` agents、多个 internal helpers | 未失控，runtime 过滤有效 | 加公开入口目录和 internal-only banner |
| Artifact 过厚 | App audit 和 optimize 都有较厚 `.spec-first` 产物 | 未失控，但用户成本高 | 提供最小消费面、manifest 和 summary-first 输出 |
| 历史架构污染 | 旧 CRG/ECC 文档仍在 docs 搜索结果中 | 部分影响理解 | 强化 docs lifecycle，归档 superseded docs |
