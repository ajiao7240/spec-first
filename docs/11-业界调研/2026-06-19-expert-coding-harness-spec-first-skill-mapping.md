# Expert-Coding-Harness 到 spec-first 的 Skill 节点映射补充报告

日期：2026-06-19
角色：Spec-First Evolution Architect
外部源码：`/Users/kuang/xiaobu/Expert-Coding-Harness`
目标仓库：`/Users/kuang/xiaobu/spec-first`
范围：外部仓库只读源码分析；输出 spec-first skill 节点能力映射与补充建议；不修改外部仓库，不修改 generated runtime mirrors。

## 0. 结论先行

`Expert-Coding-Harness`（下称 ECH）不是一个像 `spec-first` 这样的 Node.js CLI / runtime generation harness。它的核心形态是 **25 个中文 skills + Claude/Cursor hooks + Cursor always-on rules**，更接近“AI coding 方法库”和“宿主行为提醒层”。

对 `spec-first` 的正确吸收方式不是批量导入 25 个新 public workflow，也不是把 ECH hooks 变成跨宿主事实源，而是把其中较成熟的 **方法 rubric、任务交接纪律、专项审查维度和长任务上下文记忆模式** 映射到既有节点：

| 优先级 | 建议 | 对应 spec-first 节点 | 判断 |
| --- | --- | --- | --- |
| P0 | 强化 `spec-work` 的 task handoff 质量：完整任务文本、源文件路径、验收条件、验证命令必须传给 fresh worker / reviewer | `spec-work`、`spec-write-tasks` | ECH `subagent-driven-development` 与 `writing-plans` 的最高价值点；符合 light contract |
| P0 | 强化 review 顺序：先规格符合性，再代码质量；reviewer 不应只看 diff 美观 | `spec-code-review`、`spec-work` | ECH SDD 的 implementer -> spec reviewer -> code quality reviewer 顺序值得吸收 |
| P1 | 把安全审计、前端审查、API 设计、AI Agent 安全做成 code-review / plan 的专项 rubric 或 persona，而不是新增默认 workflow | `spec-code-review`、`spec-plan`、`spec-skill-audit` | ECH 专项 skill 细，但多数是 checklist，不应扩大 public surface |
| P1 | 借鉴 `source-reading-analyst` 的报告模板：源码事实、调用路径、Mermaid 图、风险和改造建议分栏 | `spec-plan`、`spec-debug`、`agent-native-architecture` | 适合作为架构分析输出格式，不应替代 direct source evidence |
| P1 | 借鉴 `debug-expert` 的 hypothesis ledger / minimal repro 语言 | `spec-debug` | 与现有 debug workflow 同向，可作为 prose 加固 |
| P2 | 研究 hooks 的 deterministic warning / blocking 边界，尤其 config protection 与 sensitive file warning | `spec-mcp-setup`、未来 host hook governance | 只能作为可选 host readiness / warning，不应成为 semantic authority |
| 不采纳 | 根目录 `task_plan.md/findings.md/progress.md` 作为全仓第二真相源 | `spec-work`、`spec-sessions` | 与 spec-first repo-backed artifacts 和 source/runtime 边界冲突；只能借鉴“长任务 ledger”概念 |
| 不采纳 | 导入 `caveman`、`grill-me` 等交互风格 skill | 无 | 它们是交互模式，不是 spec-first 工程闭环节点能力 |

最终判断：ECH 对 spec-first 的补充价值集中在 **行为纪律和专项 rubric**，不在 runtime 架构。`spec-first` 已覆盖 `Codebase -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 主链路，后续应选择性吸收高信噪比规则，而不是制造 skill 数量膨胀。

## 1. 证据边界

| 类别 | 已核验源码 | 结论用途 |
| --- | --- | --- |
| 外部 README | `Expert-Coding-Harness/README.md` | 确认 25 skills、Claude/Cursor hooks、Cursor rules 的项目定位 |
| 外部 skills | `Expert-Coding-Harness/skills/*/SKILL.md` | 提取 workflow skill、domain checklist、hard gate、统一契约形态 |
| 外部 hooks | `Expert-Coding-Harness/hooks/hooks.json`、`scripts/hooks/*.js`、`scripts/lib/*.js` | 区分 warning hook、blocking hook、post-edit helper、session/cost/planning 文件 hook |
| 外部 rules | `Expert-Coding-Harness/.cursor/rules/*.md` | 判断其为宿主 always-on style/governance hints，不是 durable source-of-truth contract |
| 目标 skills | `spec-first/skills/*/SKILL.md` | 建立现有 public workflow / standalone skill 节点映射 |
| 目标 agents | `spec-first/agents/*.agent.md` | 判断专项 reviewer / researcher 是否已有可承接节点 |
| 项目角色契约 | `docs/10-prompt/结构化项目角色契约.md` | 校准 Light contract、Explicit boundaries、Scripts prepare facts / LLM decides |

限制：

| 限制 | 处理方式 |
| --- | --- |
| 外部仓库没有可用 `graphify-out/graph.json` | 采用 bounded direct source reads，不把 graph 输出作为证据 |
| ECH skills 多数是 prompt prose，不是可运行 schema | 映射为 rubric / advisory pattern，不当作 confirmed behavior |
| ECH hooks 面向 Claude/Cursor，未证明跨 Codex 等宿主一致 | 只作为 host-specific candidate，不进入 spec-first core contract |
| 本报告为 docs-only | 不修改 source skills，不更新 runtime mirror，不声称已完成行为落地 |

## 2. 源码拓扑与交付模型

| 维度 | 源码事实 | 证据 | 对 spec-first 的判断 |
| --- | --- | --- | --- |
| 仓库形态 | ECH 没有 `package.json`，不是 Node CLI 包；共有 340 个非 `.git` 文件 | `find`/`package.json` 回源核验；`README.md:41-64` 描述 `.cursor/`、`hooks/`、`scripts/` | 不应按 CLI harness 方式集成；只能把方法资产映射到现有 workflow nodes |
| Skill 源 | 顶层 `skills/` 有 25 个 skill 目录 | `README.md:1-39` 列 25 个 skill；`find skills -maxdepth 1` 回源计数为 25 | 顶层 `skills/` 是本报告主要分析对象 |
| Cursor 交付镜像 | `.cursor/skills/` 也包含全部 25 个技能 | `README.md:47-55` 明确 `.cursor/skills/` 内容与 `skills/` 一致 | ECH 采用“source 与宿主交付镜像同仓并存”的形态；spec-first 不应照搬到 generated runtime source |
| Claude hooks | `hooks/hooks.json` 配置 Claude Code `PreToolUse`、`PostToolUse`、`Stop`、`SessionStart`、`PreCompact` | `hooks/hooks.json:1-110` | 可作为 host hook pattern 参考，但不能变成 spec-first 跨宿主 contract |
| Cursor hooks | `.cursor/hooks.json` 配置 15 类事件；`.cursor/hooks/` 是适配层 | `.cursor/hooks.json:1-133`；`README.md:47-49` | ECH 的 Cursor 集成更重，spec-first 若借鉴应只吸收 deterministic helper 思路 |
| Hook 实现 | `scripts/hooks/` 有 17 个 JS 脚本，`scripts/lib/` 有 6 个工具库文件 | `find scripts/hooks scripts/lib` 回源计数 | scripts 多数只产 warning/format/check facts；符合“scripts prepare facts”但不应做语义判断 |
| Cursor rules | `.cursor/rules/` 有 24 个 always-on / language-specific rule 文件 | `README.md:66-83`；`find .cursor/rules` 回源计数 | rules 是常驻提示层，不是 repo artifact contract；可吸收为 reviewer lens |
| 参考库密度 | `code-security-audit` 有 32 个 references 文件，是 ECH 最重知识库 | `skills/code-security-audit/SKILL.md:190-227`；`find skills/code-security-audit/references` | 适合 optional security deep-dive；不适合作为默认 review 成本 |

## 3. ECH 总体能力库存

| 能力面 | 源码位置 | 核心机制 | 强度 | 对 spec-first 的含义 |
| --- | --- | --- | --- | --- |
| 25 个 skills | `skills/*/SKILL.md` | 覆盖 brainstorm、PRD、计划、TDD、debug、review、安全、前端、API、架构、handoff 等 | 高：覆盖面广 | 作为映射候选；不应逐个变成 public workflow |
| 统一契约 skill | `brainstorming`、`code-review-expert`、`code-security-audit`、`debug-expert`、`subagent-driven-development`、`writing-plans` | `Inputs / Outputs / Gates / Handoffs` | 中高：契约清楚但仍是 prose | 可借鉴到 spec-first task/artifact quality rubric |
| hard gate | 7 个 skill 共 9 处 `<HARD-GATE>`；`debug-expert`、`tdd-master` 各 2 处 | 禁止跳过设计批准、源码读取、RED 验证、修复验证等 | 中：多数靠模型遵守 | 只吸收适合 light contract 的语义门禁；不要硬编码业务判断 |
| 安全审计知识库 | `code-security-audit/references/**` | 五阶段审计、污点追踪、攻击链、架构图模板 | 高：资料最丰富 | 可作为未来 `spec-code-review` security deep-dive persona / optional mode |
| 文件化长任务记忆 | `planning-with-files/**` + hooks | `task_plan.md/findings.md/progress.md` 高频注入和 stop 提醒 | 中：实用但侵入 source truth | 借鉴 ledger 纪律，不采用根目录三文件作为第二真相源 |
| Hooks | `hooks/hooks.json`、`scripts/hooks/*.js` | secret/sensitive/config/format/typecheck/session/cost/planning | 中：deterministic helper | 可作为 runtime readiness 参考，不替代 spec-first source/runtime contract |
| Cursor rules | `.cursor/rules/*.md` | always-on coding/security/testing/style rules | 中低：宿主绑定强 | 可借鉴规则内容，不复制成 spec-first 常驻注入 |

## 4. 源码级证据摘要

| 能力/结论 | ECH 证据 | 解释 |
| --- | --- | --- |
| 项目自定位为生产级 AI Agent 技能集 | `README.md:1-8` | README 首屏直接定义为覆盖代码审查、安全审计、TDD、PRD、计划、子代理、架构、调试、前端等的技能集 |
| 25 skill 覆盖面完整 | `README.md:13-39` | 表格列出 25 个 skill、触发方式与安装命令；这也是 ECH public surface |
| ECH 交付模式是“克隆即用配置体系” | `README.md:41-64` | `.cursor/`、`hooks/`、`scripts/` 同仓交付；与 spec-first source/runtime mirror 边界不同 |
| Cursor rules 是 always-on | `README.md:66-83`；`.cursor/rules/common-development-workflow.md:1-4` | 规则文件 frontmatter `alwaysApply: true`，应视为宿主提示层 |
| `writing-plans` 强调零上下文执行者 | `skills/writing-plans/SKILL.md:8` | 计划必须写明路径、命令、完整代码块与预期输出，是 P0 task quality 借鉴点 |
| `writing-plans` 有可执行计划 gate | `skills/writing-plans/SKILL.md:19-30`、`:128-147` | 禁止占位词、要求路径/命令/预期输出、自检规格覆盖和占位扫描 |
| `subagent-driven-development` 的核心是完整任务文本 + 双审查顺序 | `skills/subagent-driven-development/SKILL.md:8`、`:16-27`、`:45-53`、`:92-99` | 主会话读计划一次，粘贴任务全文；审查顺序为规格符合性再代码质量，不能用实现者自述替代独立审查 |
| `code-security-audit` 要求 Source-to-Sink 证据链 | `skills/code-security-audit/SKILL.md:8-22`、`:28-35`、`:113-127`、`:173-186` | 这是安全审计最值得吸收的证据纪律；但成本高，适合 optional deep-dive |
| `planning-with-files` 采用根三文件持久记忆 | `skills/planning-with-files/SKILL.md:9-22`、`:33-60` | 2-action rule 和 read-before-decide 有价值；根目录 `task_plan.md` 高频注入与 spec-first source truth 冲突 |
| `source-reading-analyst` 是只读源码分析模板 | `skills/source-reading-analyst/SKILL.md:8-12`、`:41-67`、`:220-228` | 可吸收证据表/调用图/report template；不能替代 spec-first 回源确认 |
| Claude hook 中只有 config protection 明确阻断 | `hooks/hooks.json:4-24`；`scripts/hooks/config-protection.js:1-13`、`:81-104`、`:132-134` | exit 2 阻断修改 eslint/prettier/biome 等配置；其他常见 hook 多为 warning/pass-through |
| 格式化和 typecheck hook 是非阻断 post-edit helper | `scripts/hooks/post-edit-format.js:1-18`、`:95-108`；`scripts/hooks/post-edit-typecheck.js:1-8`、`:62-90` | 格式化可能 silent write，typecheck 输出相关错误但最终 exit 0；spec-first 应保持 preview-first |
| secret / sensitive hook 是 warning-only | `scripts/hooks/check-secrets.js:1-13`、`:57-65`；`scripts/hooks/warn-sensitive-file.js:1-13`、`:55-56` | 不能把“未报警”当作安全通过 |
| Cursor planning hooks 会把计划注入 prompt | `.cursor/hooks.json:1-24`；`scripts/hooks/planning-with-files-user-prompt-submit.js:1-13`、`:32-47` | 对长任务有用，但把 `task_plan.md` 变成高频上下文源；spec-first 需避免第二真相源 |

## 5. ECH Skill 到 spec-first 节点完整映射

| ECH skill | 类型 | ECH 源码信号 | 当前 spec-first 对应节点 | 覆盖状态 | 建议补充 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| `brainstorming` | Workflow | 有统一契约和 `<HARD-GATE>`；设计未确认前不实现 | `spec-brainstorm`、`spec-ideate` | 基本覆盖 | 可借鉴“候选方案对比 + 用户确认 + 设计文档自检”语言，但不新增 workflow | P1 |
| `prd-engineer` | Workflow | `<HARD-GATE>`；访谈驱动 PRD / issue 拆解 | `spec-prd` | 基本覆盖 | 可检查 `spec-prd` 是否已有最小访谈轮次、open questions、验收标准自检 | P1 |
| `writing-plans` | Workflow | 统一契约；计划面向零上下文执行者；包含路径、命令、TDD 粒度 | `spec-plan`、`spec-write-tasks` | 覆盖但可加强 | 把“zero-context executor / no placeholders / full paths / verification commands”作为 task-pack 质量 rubric | P0 |
| `subagent-driven-development` | Workflow | 统一契约；fresh subagent；implementer -> spec reviewer -> code quality reviewer | `spec-work`、`spec-code-review` | 部分覆盖 | 强化 full task text handoff、spec compliance before code quality、fresh-source reviewer 纪律 | P0 |
| `tdd-master` | Workflow / method | `<HARD-GATE>`；必须先看到因正确原因失败的测试；RED-GREEN-REFACTOR | `spec-work` | 部分覆盖 | 仅对明确 TDD slice 增加“先验证 RED”严格模式；不要求所有任务 TDD 化 | P1 |
| `debug-expert` | Workflow | 统一契约；两个 `<HARD-GATE>`；要求最小复现、假设、实际验证 | `spec-debug` | 基本覆盖 | 补强 hypothesis ledger、minimal repro、verification-before-fixed 的措辞 | P1 |
| `code-review-expert` | Review | 统一契约；SOLID、安全、性能、边界条件、删除代码检查 | `spec-code-review` | 基本覆盖 | 抽取 refactor/delete-code/SOLID checklist 作为 reviewer rubric，不改 schema | P1 |
| `code-security-audit` | Review / security | 统一契约；五阶段审计；污点追踪、攻击链、10 维安全面 | `spec-code-review`、`spec-skill-audit` | 部分覆盖 | 做 security deep-dive optional mode 或专项 persona；敏感面触发，不默认全量跑 | P1 |
| `source-reading-analyst` | Research / architecture | `<HARD-GATE>`；只读源码；报告含 Mermaid、调用关系、改造建议 | `spec-plan`、`spec-debug`、`agent-native-architecture` | 部分覆盖 | 借鉴报告模板和图表选型；重要结论仍需 source/test/log 回源确认 | P1 |
| `architecture-advisor` | Architecture | 新系统 / 既有架构优化，输出 Mermaid 和路线图 | `spec-plan`、`agent-native-architecture`、`spec-code-review` | 部分覆盖 | 可吸收“现状图 -> 目标图 -> 分阶段路线图”格式 | P2 |
| `improve-codebase-architecture` | Architecture | 深模块 / 浅模块识别，改善可测试性和 AI 可导航性 | `spec-plan`、`spec-code-review`、`spec-compound` | 部分覆盖 | 适合转成 architecture smell rubric 和 durable knowledge 候选 | P2 |
| `skill-smith` | Meta-skill | skill 创建反模式、触发描述、结构建议 | `skill-creator`、`spec-skill-audit` | 基本覆盖 | 可对照补 trigger precision / anti-pattern 示例；不替代现有 skill governance | P2 |
| `docs-lookup` | Tool-use method | Context7 resolve 后 query；避免 API 幻觉 | `openai-docs`、Context7 工具使用、`spec-mcp-setup` | 部分覆盖 | 保持“官方 docs / primary source 优先”，并标记 provider_untrusted/advisory | P1 |
| `planning-with-files` | Long-task memory | `task_plan.md/findings.md/progress.md`；hooks 注入/回读/提醒 | `spec-work`、`spec-sessions`、run artifacts | 概念覆盖，形态冲突 | 借鉴“每 2 次探索写 ledger / 决策前回读目标”；不采用根三文件为 source truth | P2 |
| `handoff` | Handoff | 结构化会话交接 | `spec-work` closeout、`spec-sessions` | 基本覆盖 | 可吸收“当前状态 / 已试过 / 剩余风险 / 下一步”字段作为 closeout 补充 | P2 |
| `prototype` | Prototype | 一次性原型验证，完成后清理 | `spec-polish-beta`、`spec-plan` | 部分覆盖 | 可加入原型 cleanup / discard rule；避免 prototype 演变成 source 负债 | P2 |
| `frontend-code-review` | Domain review | React/Vue/Next/TS；功能、性能、安全、可维护性 | `spec-code-review`、`frontend-design` | 部分覆盖 | 作为 frontend reviewer profile / selector rubric | P1 |
| `frontend-performance-optimization` | Domain optimize | Web Vitals、加载、运行时、bundle | `spec-optimize`、`test-browser`、`frontend-design` | 部分覆盖 | 用指标驱动而非 checklist 驱动；接入 browser/perf evidence 时再落地 | P1 |
| `react-best-practices` | Domain checklist | React/Next 组件、Hooks、状态、性能 | `frontend-design`、`spec-code-review` | 部分覆盖 | 只作为 React checklist，不新增 workflow | P2 |
| `api-design` | Domain checklist | REST/GraphQL、版本、错误处理，行数最多 | `spec-prd`、`spec-plan`、`spec-code-review` | 部分覆盖 | 抽取 API contract / error model / versioning rubric；不做独立默认 skill | P2 |
| `ai-agent-security` | Domain security | prompt injection、tool abuse、权限越界 | `agent-native-architecture`、`spec-skill-audit`、`spec-code-review` | 部分覆盖 | 对 agent/tool/MCP 变更启用专项安全 checklist | P1 |
| `interview-knowledge-track` | Knowledge / interview | 面试知识拆分、主题检索、经历绑定 | 无核心对应；可旁路到 knowledge | 低相关 | 不纳入 spec-first coding workflow；若做知识产品再评估 | 不采纳 |
| `llm-wiki-interview` | Knowledge / interview | Raw/Wiki/Index 面试知识库 | 无核心对应 | 低相关 | 不纳入当前 skill 节点 | 不采纳 |
| `grill-me` | Interaction mode | 深度追问，每次一个问题 | `spec-brainstorm` 可吸收局部 | 轻量覆盖 | 作为提问风格可选，不做节点 | 不采纳 |
| `caveman` | Interaction mode | 极简通信模式，削减 token | 无 | 无需覆盖 | 与当前中文治理输出标准冲突，不纳入 | 不采纳 |

## 6. spec-first 现有承接证据

| spec-first 能力 | 源码证据 | 对 ECH 的吸收边界 |
| --- | --- | --- |
| 核心链路已经存在 | `docs/10-prompt/结构化项目角色契约.md` 定义 `Codebase -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` | ECH 不是补链路空白，而是补局部质量纪律 |
| `spec-work` 已有 direct evidence boundary 和最小反馈回路 | `skills/spec-work/SKILL.md:77-120` | 可补 task handoff 细节；不需要引入 ECH 的三文件状态机 |
| `spec-work` 已有 subagent / worktree / serial-parallel 执行纪律 | `skills/spec-work/SKILL.md:340-370` | 可吸收“完整任务文本”和“先规格后质量审查”；不复制 ECH 共享目录禁止并行规则为绝对规则 |
| `spec-write-tasks` 明确 task pack 是 derived artifact | `skills/spec-write-tasks/SKILL.md:49-83` | 直接反证 ECH `task_plan.md` 不应成为 spec-first 第二 source-of-truth |
| `spec-write-tasks` 已有 `context_refs`、`review_gate`、`review_focus` | `skills/spec-write-tasks/SKILL.md:315-346` | ECH 的 zero-context task quality 可落到现有字段语义，不新增 schema 字段 |
| `spec-code-review` 已有 security/performance/api personas | `skills/spec-code-review/references/persona-catalog.md:31-40` | ECH 的 security/API/perf/frontend 能做 persona/rubric 增强，不应默认新 workflow |
| `spec-code-review` reviewer 输出已有 JSON schema 与 confidence anchors | `skills/spec-code-review/references/subagent-template.md:20-55` | ECH checklist 若接入 review，必须转成 schema-compatible findings，而不是自由文本 |
| `spec-debug` 已有 root cause、hypothesis ledger、repro feedback loop | `skills/spec-debug/SKILL.md:61-78`、`:126-130` | ECH `debug-expert` 只需做措辞强化或 eval 参照，不是缺失能力 |
| `spec-skill-audit` 已覆盖 trigger precision、scope、runtime governance | `skills/spec-skill-audit/SKILL.md:2-3`、`:80-100` | ECH `skill-smith` 只适合作为对照样例 |

## 7. 按 spec-first 节点的补充建议

| spec-first 节点 | 当前职责 | ECH 可补充能力 | 建议集成方式 | 不做什么 |
| --- | --- | --- | --- | --- |
| `spec-brainstorm` | 需求澄清、方案探索 | `brainstorming` 的方案对比、批准前不实现、自检清单 | 补 prose rubric：每个候选方案要有 tradeoff、风险、open questions | 不新增 `brainstorming` clone |
| `spec-prd` | PRD-grade requirements | `prd-engineer` 的访谈驱动和 issue 拆解 | 对 PRD 输出检查 open questions、acceptance criteria、non-goals | 不强制固定访谈轮次 |
| `spec-plan` | 实施计划 | `writing-plans` 的 zero-context executor、`architecture-advisor` 的现状/目标/路线图 | 在计划质量标准里补“完整路径、命令、停止条件、验收证据” | 不新增复杂 plan schema |
| `spec-write-tasks` | 任务包生成 | ECH 任务要小、可执行、含验证命令 | 复用现有 `context_refs` / `stop_if` / `review_focus`，补写作 rubric | 不新增 task-pack 字段 |
| `spec-work` | 执行实现 | `subagent-driven-development` 的 full task text handoff、TDD slice、handoff | 补 P0 交接纪律和 review 顺序；TDD 只在明确 slice 启用 | 不把所有任务改成强 TDD |
| `spec-debug` | 根因定位和修复 | `debug-expert` 的 hypothesis ledger、minimal repro、fix 验证门 | 补强语言和 checklist；保持现有 direct evidence / regression test 纪律 | 不让模型编造 repro 或 verification |
| `spec-code-review` | 代码审查 | review/security/frontend/API/agent-security 多类 checklist | 作为 persona selector 或 reviewer rubric；安全审计可 optional deep-dive | 不默认每次跑大型安全审计 |
| `spec-doc-review` | 文档审查 | `source-reading-analyst` 报告结构 | 仅借鉴 evidence table / claims table 输出形态 | 不把 Mermaid 变成文档审查硬要求 |
| `spec-skill-audit` | skill/agent 审计 | `skill-smith`、`ai-agent-security` | 补 trigger precision、tool permission、安全边界 rubric | 不让外部 skill style 覆盖 spec-first governance |
| `spec-mcp-setup` | runtime readiness | `docs-lookup` / hooks readiness 思路 | 对 Context7/Graphify 等 provider 维持 readiness facts + degraded mode | 不把 provider 输出当 truth |
| `spec-compound` | 知识沉淀 | `improve-codebase-architecture` 的模式沉淀、debug/review 经验 | 好的架构 smell / TDD / security lesson 可沉淀为 `best_practice` / `convention` | 不把 ECH checklist 全量塞入 solutions |
| `spec-sessions` | 历史会话检索 | `handoff`、session-start/end hooks | 长任务 closeout 和 resume 可参考 handoff 字段 | 不采用 `~/.claude` session state 为 source truth |
| `spec-optimize` | 指标优化 | `frontend-performance-optimization` 的 Web Vitals / bundle 指标 | 指标驱动优化实验；配合 browser/perf evidence | 不做无指标性能 checklist |
| `frontend-design` | 前端设计/实现 | `react-best-practices`、`frontend-code-review` | 补 React/Next/Vue checklist 或 reviewer lens | 不替代实际 browser 验证 |
| `agent-native-architecture` | agent/tool 架构判断 | `ai-agent-security`、`architecture-advisor` | 补 prompt injection/tool abuse/权限边界审查 | 不把安全 checklist 写成硬编码专家系统 |

## 8. Hooks 与 runtime 行为映射

| ECH hook / script | 事件/触发 | 行为 | 风险边界 | spec-first 处理建议 |
| --- | --- | --- | --- | --- |
| `check-secrets.js` | Stop / beforeSubmitPrompt | 扫描 secret patterns，warning-only，exit 0 | 正则可能误报/漏报；不应声称安全通过 | 可作为 optional warning；最终安全结论仍归 review/test |
| `warn-sensitive-file.js` | PreToolUse Read | 读取 `.env/.key/.pem` 等敏感文件前警告 | warning-only；宿主绑定 | 可参考到 source-reading safety reminder |
| `config-protection.js` | PreToolUse Edit | 修改 eslint/prettier 等配置时 exit 2 阻断 | blocking hook 影响 mutation；需明确 allowlist/override | 若采纳，必须 source-owned policy + 双宿主 contract，不直接复制 |
| `post-edit-format.js` | PostToolUse Edit | 检测 Biome/Prettier 后格式化 | hidden write 风险；可能改用户未预期文件 | spec-first 应保持 preview-first；格式化只在明确验证/修复路径中运行 |
| `post-edit-typecheck.js` | PostToolUse Edit | TS/TSX 编辑后运行 `tsc --noEmit` 并摘录相关行 | 非阻断；可能慢 | 可借鉴为 validation helper，不做默认 silent gate |
| `check-console-log.js` / `post-edit-checks.js` | Stop / post edit | 提醒遗留 `console.log` | 语言/场景特异 | 可作为 review checklist，不做核心 gate |
| `session-start.js` | SessionStart | 注入最近会话摘要、包管理器、项目类型 | `~/.claude` 状态不是 repo truth | spec-first 已有 session/context 边界；只借鉴摘要字段 |
| `session-end.js` / `session-end-marker.js` | Stop | 写 session summary | 外部状态易漂移 | 交给 `spec-sessions` 或 workflow artifacts，不作为 source |
| `pre-compact.js` | PreCompact | 压缩前保存状态 | 宿主事件绑定 | 可作为 host-specific runtime idea，不进入 core |
| `cost-tracker.js` | Stop | 写 `~/.claude/metrics/costs.jsonl` | 成本估算不是工程事实 | P2 可研究 optional run ledger |
| `planning-with-files-*` | UserPromptSubmit / PreToolUse / PostToolUse / Stop | 注入/回读/提醒/未完成门禁 | 根三文件会成为第二真相源；外部内容注入有 prompt injection 风险 | 只借鉴“目标回读”和“长任务进度 ledger”纪律 |

## 9. Cursor Rules 映射

| Rule 类别 | 源码范围 | 主要内容 | spec-first 可借鉴点 | 不采用理由 |
| --- | --- | --- | --- | --- |
| common coding/security/testing/workflow/git | `.cursor/rules/common-*.md` | 编码风格、安全、测试、工作流、Git、agents、patterns、performance | 可作为 code-review / work checklist 素材 | always-on rules 宿主绑定强，且容易变成常驻上下文膨胀 |
| TypeScript rules | `.cursor/rules/typescript-*.md` | TS/JS 风格、hooks、patterns、安全、testing | 可映射到 TS reviewer lens | spec-first 不能让语言 rules 覆盖仓库本地约定 |
| Python rules | `.cursor/rules/python-*.md` | PEP8、pytest、ruff、bandit 等 | 可映射到 Python reviewer lens | 同上 |
| Go rules | `.cursor/rules/golang-*.md` | gofmt、表驱动测试、gosec 等 | 可映射到 Go reviewer lens | 同上 |

判断：ECH rules 是“宿主提示层”，不是 `spec-first` 的 source-of-truth。若后续吸收，应进入 reviewer persona / project standards lens，而不是 SessionStart 常驻注入。

## 10. 外部 Skill 结构附录

| ECH skill | 行数 | 结构信号 | 集成强度 | 备注 |
| --- | ---: | --- | --- | --- |
| `grill-me` | 18 | 极短交互模式 | 低 | 不纳入 |
| `llm-wiki-interview` | 35 | 面试知识库流程 | 低 | 与 coding workflow 弱相关 |
| `prototype` | 35 | 一次性验证 | 中 | 可补 prototype cleanup |
| `handoff` | 36 | 会话交接 | 中 | 可补 closeout 字段 |
| `caveman` | 37 | 交互风格 | 低 | 不纳入 |
| `planning-with-files` | 61 | 三文件记忆 + hooks | 中 | 借鉴 ledger，不复制 source truth |
| `improve-codebase-architecture` | 66 | 架构改善 checklist | 中 | 架构 smell rubric |
| `docs-lookup` | 94 | Context7 docs | 中 | provider advisory |
| `interview-knowledge-track` | 110 | 面试知识追踪 | 低 | 不纳入 |
| `frontend-code-review` | 120 | 前端 review | 中 | reviewer profile |
| `react-best-practices` | 129 | React checklist | 中低 | frontend lens |
| `subagent-driven-development` | 131 | 统一契约 + fresh subagents | 高 | P0 吸收 task handoff / review order |
| `brainstorming` | 142 | 统一契约 + hard gate | 中 | 补 brainstorm rubric |
| `prd-engineer` | 142 | hard gate + PRD | 中 | 补 PRD self-check |
| `frontend-performance-optimization` | 144 | 性能优化 | 中 | 指标驱动吸收 |
| `code-review-expert` | 165 | 统一契约 + hard gate | 中高 | review rubric |
| `architecture-advisor` | 169 | 架构图和路线图 | 中 | plan / architecture lens |
| `writing-plans` | 176 | 统一契约 | 高 | P0 吸收 task quality rubric |
| `skill-smith` | 192 | skill 创建 | 中 | skill-audit nuance |
| `tdd-master` | 204 | hard gate + RED/GREEN | 中高 | optional strict TDD |
| `debug-expert` | 224 | 统一契约 + hard gates | 中高 | debug rubric |
| `code-security-audit` | 227 | 统一契约 + references | 高 | optional security deep-dive |
| `source-reading-analyst` | 252 | hard gate + Mermaid report | 中高 | source analysis template |
| `ai-agent-security` | 399 | agent 安全 checklist | 中 | agent/tool security lens |
| `api-design` | 523 | API design checklist | 中 | API contract rubric |

## 11. 建议落地顺序

| 阶段 | 目标 | 最小改动面 | 验证方式 |
| --- | --- | --- | --- |
| Phase 0 | 保留本报告为映射证据 | `docs/11-业界调研/` + `CHANGELOG.md` | `git diff --check`、文档关键段落回读 |
| Phase 1 | 强化 task handoff / task-pack 质量 rubric | `skills/spec-work/SKILL.md`、`skills/spec-write-tasks/**`、相关 tests | fresh-source eval + unit contract tests |
| Phase 2 | 接入专项 reviewer rubric | `skills/spec-code-review/**`、persona catalog、可能新增/调整 agents | code-review fixture + JSON schema contract tests |
| Phase 3 | 安全深审 optional mode | `spec-code-review` 或独立 optional skill 的需求/计划先行 | security fixture + source-to-sink evidence review |
| Phase 4 | hooks / runtime readiness 研究 | `spec-mcp-setup` 或 host hook governance docs | 先 plan，再双宿主 dry-run；避免 hidden writes |

## 12. 反模式清单

| 反模式 | 为什么不做 | 正确方向 |
| --- | --- | --- |
| 把 ECH 25 个 skills 全部复制进 `skills/` | 扩大 public surface，稀释 workflow 入口治理，制造维护负担 | 映射到既有节点和 reviewer rubric |
| 把 Cursor rules 直接变成 spec-first 常驻规则 | 宿主绑定、上下文膨胀、与 repo-local 约定冲突 | 只吸收为 checklist / persona lens |
| 引入根目录 `task_plan.md` 作为强制状态 | 第二真相源，与 artifact/source 边界冲突 | 使用 workflow artifacts / closeout / `spec-sessions` |
| 默认启用 post-edit format/typecheck hook | hidden write / hidden cost / 用户意图不透明 | preview-first，验证命令显式执行 |
| 用 hooks 做语义判断 | 脚本只能产 deterministic facts，不应做架构/业务判断 | scripts prepare facts, LLM decides |
| 把 Context7/Graphify/外部 docs 当 truth | provider 输出可能过时或不完整 | provider_untrusted，关键结论回源确认 |
| 把 TDD 设为所有任务硬要求 | 许多 docs/config/探索任务不适用 | 只对明确 TDD slice 启用 RED gate |

## 13. 完成度审计

| 用户要求 | 当前证据 | 状态 |
| --- | --- | --- |
| 深度分析 `/Users/kuang/xiaobu/Expert-Coding-Harness` | 本报告覆盖 README、25 个顶层 skill、17 个 hook 脚本、6 个 hook lib、24 个 Cursor rules、Claude/Cursor hook 配置、关键 references | 已满足 |
| 做源码级分析 | 报告含外部源码路径与行号证据；区分 README 宣称、SKILL.md prose、hook 实现、rules frontmatter、脚本退出码 | 已满足 |
| 补充到当前 spec-first skill 节点能力 | 映射到 `spec-work`、`spec-write-tasks`、`spec-code-review`、`spec-debug`、`spec-plan`、`spec-prd`、`spec-skill-audit`、`spec-mcp-setup` 等节点，并给出 P0/P1/P2 顺序 | 已满足 |
| 表格内容输出 | 报告主体以表格为主：能力库存、证据摘要、skill 映射、节点补充、hooks、rules、结构附录、落地顺序、反模式、完成度审计 | 已满足 |
| 写入本地文档 | 文档路径为 `docs/11-业界调研/2026-06-19-expert-coding-harness-spec-first-skill-mapping.md` | 已满足 |
| 遵守 spec-first source/runtime 边界 | 只修改 `docs/11-业界调研/` 与 `CHANGELOG.md`；不修改外部仓库，不修改 `.claude/`、`.codex/`、`.agents/skills/` | 已满足 |

## 14. 最终映射结论

| 结论 | 说明 |
| --- | --- |
| ECH 最高价值不是 runtime，而是方法纪律 | `writing-plans`、`subagent-driven-development`、`debug-expert`、`code-security-audit`、`source-reading-analyst` 的方法可吸收 |
| spec-first 不缺 workflow 名称，缺少部分 task/review 细节硬度 | P0 应补 task handoff、zero-context executor、spec compliance review order |
| 专项 domain skills 应成为 reviewer lens，而不是 public workflow 膨胀 | frontend / API / AI-agent-security / security-audit 适合 selector 或 optional deep-dive |
| Hooks 只适合做 deterministic warning/readiness | blocking hook 需 source-owned policy、双宿主验证和 explicit override |
| 长任务记忆要 repo artifact 化，而不是根三文件全局化 | 借鉴 ledger，不复制 `task_plan.md/findings.md/progress.md` 形态 |

本报告建议后续如果进入实现，应优先起一份窄 plan：**“ECH P0 task handoff 与 review-order 补强”**。该 plan 应只覆盖 `spec-work` / `spec-write-tasks` / `spec-code-review` 的 prose + contract tests，不引入新 schema、不新增 public skill、不修改 runtime mirror。
