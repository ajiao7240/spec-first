# scale-engine 能力清单与集成建议

> 调研日期：2026-06-02
> 调研对象：`/Users/kuang/xiaobu/scale-engine`（`@hongmaple0820/scale-engine` v0.44.0）
> 调研方式：`scale-engine/src/**/*.ts` **全量覆盖**（42 个模块 / 306 文件 / 87,018 行）逐文件结构化扫描 + 主干能力文件精读；补充只读分析 `/Users/kuang/xiaobu/project-scaffold` 的治理脚手架资产、`/Users/kuang/xiaobu/scale-os-config-claude-code` 的 Claude Code 运行时配置投影资产，以及 `/Users/kuang/xiaobu/scale-engine/docs/workflow/知识相关.md` 的知识分层说明
> 目标：以 scale-engine 为能力矿藏，评估哪些能力值得重构融入 spec-first，重点强化**知识 / 上下文**等 harness 能力
> 判断基线：`docs/10-prompt/结构化项目角色契约.md`

---

## 结论先行

scale-engine 是一个 **87,018 行 TypeScript / 306 文件 / 42 个子模块** 的庞大系统，远超既有路线图（`spec-first-scale-integration-version-roadmap-v2-final.md`）描述的规模（路线图称 SCALE v2.0、只提 GovernanceTemplatePacks/EvidenceStore/ReviewStore，实际版本 v0.44.0）。其架构本质是 **FSM（状态机）+ Gate（门禁引擎）+ Policy（规则引擎）+ Ledger（账本）** 驱动的"自主 AI 工程操作系统"。

补充观察：`project-scaffold` 不是另一个引擎，而是把 SCALE 协作规则落到真实项目的**治理基线脚手架**；`scale-os-config-claude-code` 也不是业务模板，而是把 SCALE Engine 的治理意图投影到 **Claude Code host-native settings、hooks、permission、MCP、skill registry 和质量契约**上的配置包；`docs/workflow/知识相关.md` 则把这些能力背后的知识系统拆成上下文、记忆、代码理解、能力选择和沉淀治理等分层。它们回答的不是"spec-first 应该内置什么执行循环"，而是"一个派生项目如何让人和 Agent 都能看到任务目标、影响范围、验证证据、技能选择、安全边界和沉淀责任"。因此本报告现在分四层看：**SCALE 本体提供能力矿藏，project-scaffold 提供可复制的治理资产形态，scale-os-config-claude-code 提供 host runtime 投影样板，知识相关文档提供 Knowledge Harness 分层骨架**。

**两个项目高度同源**：结构化扫描与主干精读发现 SCALE 多处逐字复制 spec-first 的工程理念——`KarpathyEvaluator` 的 K1-K4、`PromptOptimizer` 的执行规则、`AntiPatternRegistry` 的四原则，都直接对应 spec-first `CLAUDE.md` 的"编码执行准则"。这说明 SCALE 不是异质系统，而是把 spec-first 共享的理念用**重型确定性引擎**实现的另一条路线。

把它整体作为 spec-first 的"治理基座"内置，会与 spec-first 角色契约的核心红线（**拒绝强状态机 / 中心化流程引擎 / 复杂规则引擎，Let the LLM decide**）正面冲突。但它内部**存在大量高价值、确定性、文件化、契约兼容的能力点**，值得精确摘取重构。

**正确策略：不是"集成 SCALE"，而是"从 SCALE 摘取确定性脚本能力，用 spec-first 自己的 CommonJS 重写为 advisory facts"。** 摘取的过滤器是角色契约第 7 节的设计判断矩阵；摘取的形态必须是"脚本产事实、LLM 判断、文件化、不阻断"。

### 一句话版本

> SCALE 的**引擎**（gate/FSM/编排/SQLite）不要；SCALE 的**确定性检测与事实采集逻辑**（任务分级、验证命令探测、证据账本、行为检测、审查共识、拒绝记忆）值得用 spec-first 自己的轻量方式重写。

> project-scaffold 的**重型门禁和 `.scale` runtime truth** 不要；它的**任务证据模板、reality-check 分类、验证 profile、资源治理、上下文地图和 preview-first 升级路径**值得补进 spec-first 文档与 workflow lens。

> scale-os-config-claude-code 的**`.claude/settings.json` 大段 shell hook、`.scale/workflow.json` 状态机和 blocking gate 投影**不要；它的**生成报告、自检脚本、permission/protected-path 映射、skill registry 安全元数据、验证 profile、host capability report 和 dry-run 反例**值得补进 spec-first 的 runtime generation / doctor / closeout 文档。

> `知识相关.md` 的**六层 Knowledge Harness 骨架**可以整体借鉴；但 SCALE 的 `.scale/config.yaml`、Memory Provider Router、SQLite KnowledgeBase、Graphify/CodeGraph 默认 provider、`scale memory/codegraph/skill` CLI 和外部写入策略不能整体搬进 spec-first。spec-first 应把六层改写为 source-first、文件化、advisory、可降级的 agent/skill 协作 lens；GBrain / Graphify / CodeGraph 这类 provider 可以进入 `recommended` / `platform` 安装 profile，团队可 opt-in 设为默认安装，但不能默认成为 truth。

### 业界最佳实践视角说明

下面能力表新增"放宽约束后的业界最佳实践视角"列：该列不是替代当前 spec-first 边界，而是回答"如果不受当前轻量 harness 定位限制，按业界 agentic coding / enterprise AI engineering platform 的趋势，哪些能力值得借鉴集成"。参考口径包括：Claude Code 的项目/组织级 settings、permissions、hooks、subagents、memory 等 host-native control surface；GitHub Copilot 的 repository / path / `AGENTS.md` custom instructions；以及 OWASP 对 AI-assisted coding 的 human owner、review/approval、audit trail 和 secure coding accountability 要求。

该列使用三类标注：

- **核心集成**：即使做轻量 harness，也值得进入默认能力或默认 closeout lens。
- **分级 / opt-in 集成**：默认不阻断，但在高风险任务、团队平台或显式开启时可升级。
- **平台化 / 独立产品线**：对企业 agent platform 有价值，但不应直接塞进 spec-first 当前核心路径。

---

## 一、能力总表（全 42 模块，带集成建议勾选）

图例：✅ 建议摘取重写　🟡 谨慎评估（重叠/升级/借鉴思路）　❌ 不要（撞红线/定位冲突/已剥离）

### 0. 全量覆盖矩阵（42 个目录模块 + 2 个根入口）

本矩阵来自对 `/Users/kuang/xiaobu/scale-engine/src/**/*.ts` 当前 306 个文件的全量读取 inventory；行数口径使用 `wc -l`，与 87,018 行总数一致。根目录 `index.ts` / `version.ts` 不是一级目录模块，单独列为 `(root)`。

| 模块 / 入口 | 文件 / 行 | 能力定位 | 集成判断 |
|-------------|-----------|----------|----------|
| `workflow` | 65 / 24,694 | 最大模块，集中承载 gates、governance templates、engineering standards、review store、verification、task level、cognitive planning、security audit、execution loops | 只摘 `TaskLevelDetector`、`VerificationCommands`、`OutOfScopeStore`、`HonestDelivery`、`KarpathyEvaluator`、`RuleMaturity` 等确定性 advisory；不搬 gate/execution loop |
| `api` | 4 / 8,514 | CLI/master control plane、doctor、MCP、quickstart | 借 doctor/classify/report 思路；不搬 6k 行 CLI control plane 或 MCP runtime |
| `skills` | 25 / 4,623 | skill registry、radar、discovery、frontmatter、repository safety、trigger routing、executor | 借 metadata、install safety、frontmatter 校验、progressive disclosure；不搬自动触发/执行引擎 |
| `cli` | 16 / 4,051 | 各命令入口，尤其 phaseCommands 绑定 FSM、SQLite store、capabilities、workflow engine | 借命令口径和报告形态；不搬 phase command 作为 spec-first 执行主线 |
| `runtime` | 10 / 3,827 | AiOsRuntime、runtime doctor、evidence ledger、session ledger、cost/model usage、final report guard | 摘 RuntimeEvidenceLedger、FinalReportGuard、doctor/cost ledger 思路；不搬 AiOsRuntime 中心编排 |
| `adapters` | 24 / 3,753 | 多 host adapter 投影，覆盖 Claude Code、Aider、Windsurf、Devin 等 | 借 host capability mapping / adapter contract / drift test 思路；不扩 spec-first 默认宿主矩阵 |
| `output` | 6 / 2,967 | HTML renderer、artifact layer、UI prototype、governance dashboard | 借 generated report 不能替代 source doc 的原则；dashboard/HTML renderer 作为平台化能力不内置 |
| `memory` | 6 / 2,650 | MemoryBrain/Fabric/Providers/Learning/Intelligence，含 provider 和 DB 方向 | 借 MemoryIntelligence 冲突/新鲜度、MemoryLearning promotion 思路；不搬 memory provider/SQLite |
| `guardrails` | 10 / 2,579 | OWASP、dependency auditor、behavior detectors、red team、gateway/review enforcer | 摘 advisory detectors、dependency/security scan；不搬 blocking gateway |
| `artifact` | 5 / 2,228 | artifact types、store、sqlite store、FSM definitions | 借 artifact schema/authority/freshness 字段思想；不把 SQLite/FSM 当 spec-first truth |
| `agents` | 20 / 1,981 | agent types、pool、dispatcher、channel、coordinator、profiles | 借 profile/handoff/write-set 问题清单；不搬 agent scheduler |
| `evolution` | 9 / 1,970 | evolution engine、rule maturity、session learnings、skill creator、hook generator、defect creator | 摘 RuleMaturity、SessionLearnings；不搬 auto skill/hook/defect generation |
| `context` | 7 / 1,965 | ContextBudget/Compiler/Builder、ProjectAnatomy、anti-pattern registry、session sequence | 摘 ContextCompiler、ContextBudget 分类、anti-pattern registry；与现有 context-bundle 对齐 |
| `tools` | 10 / 1,912 | command compressor、safe runner、tool policy/capability/ledger/orchestrator | 摘 CommandOutputCompressor、SafeCommandRunner、tool readiness/ledger；不搬 tool orchestrator |
| `knowledge` | 6 / 1,472 | KnowledgeBase、TF-IDF、SQLite KB、Graphify KB、Cerebrum manager | 借 TF-IDF/recall baseline；不搬 SQLite/Graphify provider 为核心 truth |
| `cortex` | 9 / 1,429 | reflexion、instinct store/extractor、session injector、governance metrics | 借 SessionInjector 防重放 sentinel；不搬本地 LLM reflexion/instinct truth |
| `bootstrap` | 2 / 1,368 | DependencyBootstrap 与 renderer，安装/检查 RTK、Graphify、CodeGraph 等 | 借 readiness plan、post-check、rollback hint；不搬 provider-coupled bootstrap |
| `orchestrator` | 5 / 1,323 | daemon、reconciliation loop、policy loader、workspace/tracker adapter | 企业平台可 opt-in；spec-first 不内置 daemon/reconcile loop |
| `hooks` | 5 / 1,307 | hook generator/deployer、workflow hooks、bug pattern detector | 借 BugPatternDetector 和 hook source-generation 原则；不搬自动 hook 写入 |
| `prompts` | 3 / 1,302 | phase prompt registry、prompt optimizer、vibe template gallery | 借 request normalizer / prompt gallery docs；不替代 brainstorm/spec-prd |
| `codegraph` | 1 / 1,243 | CodeIntelligence graph provider，symbols/callers/impact/capability checks | 作为 optional provider 方向记录；当前不恢复 graph provider 核心依赖 |
| `capabilities` | 8 / 1,227 | browser/search/computer/installed-skills capability registry | 借 capability/readiness 表达；browser/search/computer 维持外部工具 opt-in |
| `shield` | 3 / 1,005 | protected paths、shield protocol、policy compiler | 借 permission/protected-path projection；不搬 SCALE Shield blocking runtime |
| `workflows` | 6 / 978 | DAG builder/executor、workflow orchestrator、gate parser、presets | 仅借 GateParser / preset taxonomy 作为平台参考；不搬 DAG executor |
| `dashboard` | 4 / 739 | dashboard server、metrics aggregator | 平台化可观测性参考；不进核心 |
| `core` | 5 / 710 | EventBus、DI container、external command、GBrain runtime、logger | 不搬 DI/event runtime；仅借 external command 边界和 logging discipline |
| `env` | 1 / 698 | EnvironmentDoctor，环境变量、工具、项目结构、git/OS/runtime 检查 | 借 environment readiness facts 和 degraded reason；不作为 gate |
| `eval` | 2 / 605 | WorkflowEval、BenchmarkPublisher | 摘失败分类、pass@k、benchmark 发布思路 |
| `tasks` | 2 / 556 | TaskEngine、IssueTriageFSM | 不搬 task engine/FSM；只借 issue triage 状态字段作 checklist |
| `setup` | 2 / 515 | SetupWizard、SetupVerification | 借 setup verification / post-init checklist；不搬 wizard flow |
| `topology` | 4 / 497 | DomainMapper、LayerClassifier、TourGenerator | 借 project topology/context map 生成思路，作为 optional context lens |
| `governance` | 2 / 338 | progressive governance、governance ROI | 借 ROI/渐进治理语言；不引入 block engine |
| `routing` | 3 / 309 | ModelRouter、LocalModelProvider、PromptCachePolicy | 不搬模型路由；可借 prompt cache policy 作为平台参考 |
| `config` | 1 / 287 | profiles 配置 | 借 profile taxonomy；不作为 spec-first 配置源 |
| `fsm` | 2 / 267 | FSMAgentBridge | 不搬，FSM 仅可作为外部 artifact lifecycle 参考 |
| `(root)` | 2 / 257 | `index.ts` 聚合导出、`version.ts` | 仅用于确认包 surface；不产生独立集成项 |
| `testing` | 2 / 174 | DiffTestSelector | 摘按 diff 选择测试 |
| `review` | 3 / 168 | CrossModelReviewer、ReviewAggregator、review commands | 摘 review 共识聚合 |
| `tui` | 1 / 132 | TUI dashboard | 不进核心，平台化 UI 参考 |
| `cache` | 1 / 131 | ScanCache | 可借文件 hash/cache invalidation；只能做 advisory cache |
| `orchestration` | 1 / 116 | EffectsWiring | 不搬 effects wiring；中心编排边界参考 |
| `qa` | 2 / 108 | browser daemon、E2E test orchestrator | 借 browser evidence / QA profile 表达；保持外部工具 opt-in |
| `i18n` | 1 / 43 | Language 类型 | 无独立集成项；仅确认多语言配置 surface |

### A. ✅ 建议摘取（确定性脚本 · 补真实洞 · 契约兼容）

| # | 能力 | 关键文件:行 | harness 层 | 落地 | 对应 spec-first 缺口/准则 | 放宽约束后的业界最佳实践视角 |
|---|------|-----------|-----------|------|--------------------------|------------------------------|
| 1 | 任务分级探测器 | `workflow/TaskLevelDetector.ts` | Governance | 无(纯函数+git) | 把"任务分级"准则从 LLM 主观判断变为确定性事实(文件数/行数/跨模块/关键文件/关键词→S/M/L/CRITICAL+confidence+reasons) | **核心集成**：作为 agentic coding 的 change-risk classifier，驱动权限、review 深度、验证 profile 和 human approval |
| 2 | 验证命令探测器 | `workflow/VerificationCommands.ts:48` | Execution/Evidence | 无(纯函数) | 自动探测 package.json 的 build/lint/test/coverage/smoke + packageManager + source 标注，替代"靠 prose 让 LLM 找命令" | **核心集成**：与 repository custom instructions / verification profile 结合，形成默认验证推荐与 not-run disclosure |
| 3 | 运行时证据账本 | `runtime/RuntimeEvidenceLedger.ts:62` | Evidence | **JSON 文件** | 结构化证据留存(kind/status/command/exitCode/summary + 内置 redaction + expectedRed)，已文件化无需去 SQLite | **核心集成**：作为 audit trail，记录工具、模型、命令、结果、人类批准，贴合 AI 代码 human accountability |
| 4 | 拒绝/范围外记忆 | `workflow/OutOfScopeStore.ts` | Knowledge | **markdown** | 直接实现 spec-work 的 "provenance-backed rejected/out-of-scope rationale"，已 markdown 化零冲突 | **核心集成**：作为 long-lived project memory，减少重复争论、scope creep 和 agent 重放旧错误 |
| 5 | 多视角审查共识聚合 | `review/CrossModelReviewer.ts` | Evidence/Evaluation | 纯函数 | 把多 persona code-review 发现按 unanimous/majority/solo 共识确定性分级 | **核心集成**：支持多 reviewer / 多模型安全审查，配合 manual review 保留最终责任 |
| 6 | 诚实交付报告 | `workflow/quality/HonestDelivery.ts` | Evidence | 纯逻辑 | COMPLETED/VERIFIED/⚠️UNVERIFIED/BLOCKERS，对应"说明已验证、未验证明确标注"准则 | **核心集成**：作为 agent closeout 标准，禁止 dry-run、skipped 或假 evidence 被包装成完成 |
| 7 | Karpathy 准则检查器 | `workflow/quality/KarpathyEvaluator.ts` | Evaluation | 纯函数 | K1-K4 逐字对应 CLAUDE.md 编码准则 1-4 条，可作 review advisory | **核心集成**：作为 lightweight quality rubric，可进入 pre-merge AI review / self-check |
| 8 | 上下文相关性编译器 | `context/ContextCompiler.ts:47` | Context | 纯函数 | 相关性打分排序(category 优先级+signal 匹配+预算贪心)，补 context-bundle 只截断不排序的洞 | **核心集成**：结合路径级 custom instructions、AGENTS.md 和 session memory 做 context orchestration |
| 9 | 行为反模式检测器 | `guardrails/detectors.ts`、`DetectorEnhanced.ts`、`advancedDetectors.ts` | Governance/Evaluation | 纯逻辑 | 暴力重试/过早完成/范围蔓延/幻觉检测，对应多条 CLAUDE.md 准则（**去掉 block 拦截，只产 advisory**） | **分级集成**：shadow 默认、CRITICAL 场景可升级为 permission/hook 阻断，符合 least privilege 和 secure coding guardrail |
| 10 | 失败分类学 + 评估指标 | `eval/WorkflowEval.ts:176` | Evaluation | JSON | FailureReplayCategory + pass@1/pass@3 + 失败回放，填补契约要求的 Evaluation Harness | **核心集成**：作为 workflow eval/benchmark 基座，衡量 agent 改进是否真实有效 |
| 11 | 命令输出压缩 | `tools/CommandOutputCompressor.ts:53` | Context | 纯函数 | 省 token，spec-first 无此能力 | **核心集成**：长日志摘要、failure signature 抽取和 reviewer handoff 必备 |
| 12 | 证据脱敏 | `tools/ToolEvidenceStore.ts:128` | Governance | 纯函数 | `redactEvidenceText/Value` 递归脱敏，随证据账本一起摘 | **核心集成**：所有 evidence、agent transcript、tool output 入库前必须过 redaction |
| 13 | 按 diff 选测试 | `testing/DiffTestSelector.ts` | Execution | 无(git) | touchfile 依赖→选最小测试集，对应"最窄验证命令"准则 | **核心集成**：把 affected tests 作为默认 test selection，降低 agent 执行成本 |
| 14 | 影子规则成熟度 | `evolution/RuleMaturity.ts` | Governance/Evolution | 可 JSON | **元能力**：新规则 shadow→candidate→approved-blocking，需证据+误报率+人工批准才阻断。化解"硬规则/状态机"担忧的安全框架 | **核心集成**：业界治理型 agent 平台应有 rule lifecycle，避免规则一次写死 |

### B. 🟡 谨慎评估（重叠/升级/借鉴思路，非空白补洞）

| 能力 | 关键文件 | 判断 | 放宽约束后的业界最佳实践视角 |
|------|---------|------|------------------------------|
| ContextBudget 预算分类 | `context/ContextBudget.ts:212` | 与 `context-bundle.js` 重叠；借鉴 5 类 category 思想改进现有，不整体替换 | **核心集成**：context budget / priority 是 agent platform 基础设施 |
| 需求歧义七维打分 | `workflow/cognitive/AmbiguityScorer.ts` | 对 brainstorm 是 advisory 输入（哪些维度还模糊）；`shouldBlock` 撞红线只取打分 | **分级集成**：可作为 PRD/plan readiness scoring，低置信度自动要求 clarification |
| 苏格拉底六问 | `workflow/cognitive/SocraticQuestioner.ts` | brainstorm 已是 LLM 驱动对话；六问框架可作问题清单参考 | **核心集成**：作为 requirements elicitation playbook，适合所有 planning agent |
| review specCoverage | `workflow/ReviewStore.ts` | diff 对 Spec/PRD 关键词覆盖率，对 review→spec 闭环有价值；severity 体系(vs 现 info/warn/fail)需斟酌 | **核心集成**：把 spec coverage 作为 PR/agent-review 的 traceability 指标 |
| SessionLearnings | `evolution/SessionLearnings.ts` | 轻量 jsonl 学习流 + relevanceDecay，与 docs/solutions 重叠但形态不同；`autoLearnFromRunReport` 角度新颖 | **核心集成**：session learning / decay 是长期 agent memory 的常见方向 |
| MemoryIntelligence 冲突检测 | `memory/MemoryIntelligence.ts:36` | 跨来源知识冲突检测(newest-wins/highest-confidence) + 新鲜度，纯函数，对 docs/solutions 多来源有借鉴 | **核心集成**：知识库必须处理 stale/conflict，否则 memory 会污染 agent |
| TF-IDF 召回算法 | `knowledge/KnowledgeBase.ts:56` | 算法可借鉴改进 docs/solutions 检索，落地须文件化，不带 SQLite KnowledgeBase | **分级集成**：先 TF-IDF/关键词，后向量/RAG；适合作为低成本 recall baseline |
| MemoryLearning 双写 | `memory/MemoryLearning.ts:78` | JSON+markdown 双写 + promotable + recommendedAction，与 compound 重叠，流程参考 | **平台化集成**：短期 session fact -> 长期 docs/knowledge 的 promotion pipeline 值得做 |
| SessionInjector 防重放 | `cortex/SessionInjector.ts` | `<!-- HISTORICAL CONTEXT — DO NOT RE-EXECUTE -->` sentinel 设计聪明，可在 SessionStart hook 复刻；instinct 抽取偏黑盒不取 | **核心集成**：context injection 必须标明历史事实不可重放，防止 agent 重做旧任务 |
| FinalReportGuard | `runtime/FinalReportGuard.ts` | "证据就绪才允许出结论"对齐 preview-first，纯函数 | **核心集成**：可作为 final answer / PR description quality gate |
| BugPatternDetector | `hooks/BugPatternDetector.ts` | 从 Edit old/new 自动给修复打标签，对 debug/compound 沉淀有借鉴 | **分级集成**：用于 bug taxonomy、regression hints 和 knowledge compounding |
| DependencyAuditor | `guardrails/DependencyAuditor.ts` | 供应链/typosquatting 检查，对应安全关切，确定性 | **核心集成**：AI agent 增依赖前应做供应链风险检查 |
| OWASP/STRIDE 安全扫描 | `workflow/SecurityAudit.ts`、`guardrails/OWASPDetector.ts` | 确定性安全扫描，对 review 安全维度有价值 | **核心集成**：安全审查应覆盖 threat modeling、OWASP risk、abuse cases |
| 保护路径/危险命令 | `shield/ProtectedPaths.ts` | mutation boundary 确定性实现，取检测产 advisory，不取 block | **核心集成**：agent permission model 必须有 protected paths / destructive command policy |
| 命令安全执行 | `tools/SafeCommandRunner.ts` | 解析+防注入逻辑可借鉴，依赖 execa 需换 node 内置 | **核心集成**：shell command parsing、no shell fallback、timeout、redaction 是 agent runner 基础 |
| PromptOptimizer | `prompts/PromptOptimizer.ts:62` | 粗糙输入结构化，执行规则逐条同源；brainstorm 已覆盖，价值中等 | **分级集成**：可做 request normalizer，但不能替代需求澄清 |
| Skill frontmatter 校验 | `skills/SkillFrontmatter.ts` | 对应 `lint:skill-entrypoints`，已有重叠；preamble-tier 分层概念可借鉴 | **核心集成**：skill/agent registry 需要 schema、metadata、trigger 精度和版本治理 |
| skill 安装安全扫描 | `skills/SkillRepository.ts:407` | `evaluateSkillInstallSafety` 对第三方 skill 安全检查有借鉴 | **核心集成**：第三方 agent skill marketplace 必须有 install safety scan |
| 工具就绪检查 | `tools/ToolCapabilityRegistry.ts` | `inspectToolCapabilities` 对应 provider readiness | **核心集成**：tool doctor / capability matrix 是多工具 agent 的基础运维能力 |
| 成本/用量账本 | `runtime/ModelUsageLedger.ts`、`CostAnalyzer.ts` | spec-first 无成本追踪，确定性，属低频边缘能力 | **平台化集成**：团队级 agent 平台需要 cost/usage/ROI ledger |
| classifyProject | `api/doctor.ts` | 项目类型分类思路可借鉴 | **核心集成**：冷启动时自动识别 stack/profile，提高 onboarding 质量 |
| GateParser | `workflows/GateParser.ts` | 声明式 gate 表达式解析，若做 advisory 检查可参考 | **平台化集成**：若建设企业 agent platform，声明式 policy/gate DSL 是可考虑方向 |

### C. ❌ 不要（撞红线 / 定位冲突 / 已剥离）

| 能力 | 关键文件 | 不要的理由 | 放宽约束后的业界最佳实践视角 |
|------|---------|-----------|------------------------------|
| Gate 引擎 G0-G22 | `workflow/gates/GateSystem.ts:181` | 强状态机门禁引擎，撞契约"拒绝中心化流程引擎/复杂规则引擎" | **企业平台可 opt-in**：安全、生产、数据、发布类任务可有 blocking gate，但需可解释、可覆盖、可人工 override |
| FSM 全家桶 | `artifact/fsm.ts`、`fsmDefinitions.ts`、`fsm/`、`tasks/IssueTriageFSM` | 状态机替代 LLM 判断，契约最核心红线 | **只适合 artifact lifecycle**：用于 issue/PR/release 状态，不应用来替代 agent 语义判断 |
| 总编排运行时 | `runtime/AiOsRuntime.ts:184`(2518行) | RunStep 硬编码 plan/context/memory/skill/gate 序列，中心化流程引擎 | **独立产品线**：若做完整 agent OS，可以保留；若做轻量 harness，不应进入核心 |
| WorkflowEngine/Orchestrator | `workflow/WorkflowEngine.ts`、`WorkflowOrchestrator.ts`、`SessionCoordinator.ts` | 会替代 spec-work 的 LLM 驱动骨架 | **独立产品线**：多 agent workflow platform 可用，但需清楚区分 planner/orchestrator/executor 职责 |
| workflows DAG 执行引擎 | `workflows/DAGBuilder.ts`、`WorkflowExecutor.ts`、`presets.ts` | DAG+gate 断言+step 状态机，硬编码 workflow | **企业平台可 opt-in**：适合 release、migration、benchmark、批量审查等确定步骤流程 |
| 各执行循环引擎 | `workflow/execution/`、`autonomous/`、`DiagnosticLoop`、`TddLoop` | Ralph/Ultrawork/AutonomousDevLoop 自主循环，撞红线 | **实验性集成**：适合 bounded autonomous mode，但必须有人类授权、预算、权限和 kill switch |
| 自动化编排守护进程 | `orchestrator/`(全部) | "对齐 Symphony"的多 agent daemon + reconciliation loop，与 harness 定位完全冲突 | **企业平台可 opt-in**：适合多仓持续治理 daemon；不适合默认开发助手 |
| Knowledge/Memory SQLite 引擎 | `memory/MemoryBrain.ts`、`knowledge/SQLiteKnowledgeBase.ts`、`artifact/sqliteStore.ts` | 与 docs/solutions 重叠 + native 依赖(better-sqlite3) = 多真相源，违反 Light contract | **平台化集成**：团队级 agent memory 可以用数据库，但必须有 provenance、expiry、conflict resolution 和 export-to-docs |
| 记忆 provider 体系 | `memory/MemoryProviders.ts:843` | provider 化(gbrain/外部 HTTP)，方向与 spec-first 剥离 provider 相反 | **平台化集成**：多 provider memory 是趋势，但需 provider readiness、data boundary、privacy policy |
| 本地 LLM 反思 | `cortex/ReflexionEngine.ts` | 依赖本地模型(Ollama/Qwen)，spec-first 是 harness 不自跑模型 | **实验性集成**：可用于离线 self-reflection/eval，不应默认参与交付结论 |
| instinct 抽取 | `cortex/InstinctExtractor.ts` | Observation 以 gate 为核心，摘取必牵连 gate 体系 | **谨慎实验**：可转为 learning extraction，但必须防止把主观 instinct 当事实 |
| codegraph 代码图谱 | `codegraph/CodeIntelligence.ts`(1243行) | capability=symbols/callers/impact，**等于 spec-first 刚主动剥离的 GitNexus**，引入即倒退 | **核心/平台二选一**：业界 agent coding 越来越需要 code intelligence；若恢复，应作为 optional provider，不做唯一 truth |
| GraphifyKnowledgeBase | `knowledge/GraphifyKnowledgeBase.ts` | 依赖外部 graphify CLI 的又一代码图谱 provider | **可 opt-in**：适合作为 secondary code graph provider，必须标 freshness/degraded |
| 24 个 host adapter | `adapters/*.ts` | SCALE 大而全(24 工具) vs spec-first 精做 Claude+Codex 双宿主，契约 80/20 | **平台化集成**：企业级 agent platform 可做多宿主 projection，但需 adapter contract 和 drift tests |
| ClaudeCodeAdapter | `adapters/ClaudeCodeAdapter.ts` | spec-first 已有成熟 adapter + managed block 机制 | **可借鉴**：保留 hook/permission/project memory 等 host-native capability 映射思路 |
| ModelRouter | `routing/ModelRouter.ts` | 模型选择由宿主 Claude/Codex 决定，spec-first 不自路由 | **平台化集成**：多模型成本/质量/风险路由是团队平台能力；轻量 CLI 不必内置 |
| agent 调度全家桶 | `agents/`(AgentManager/Pool/Dispatcher/Coordinator) | spec-first 已有 agents 体系 + 公开 workflow dispatch 边界 | **平台化集成**：多 agent 调度可做，但必须有 write-set、handoff、conflict 和 accountability contract |
| skill 触发路由引擎 | `skills/TriggerEngine.ts`、`SkillExecutor.ts` | spec-first 用 using-spec-first LLM 路由；block 式撞红线 | **平台化集成**：skill registry + trigger precision 是最佳实践；默认建议 human/LLM-in-the-loop |
| capability 内置 | `capabilities/`(browser/search/computer) | 契约明确 browser tooling 是 external，走 MCP 不内置 | **可 opt-in**：browser/search/computer use 能力应有 permission model、allowed domains、evidence capture |
| EvidenceStore as runtime truth | `workflow/EvidenceStore.ts` | spec-work 已明确声明"JSON schema 不是 runtime truth"（SKILL.md:35） | **平台化集成**：企业审计需要 evidence store，但必须与 source docs、git、CI 关系清晰 |
| 渐进治理 block 模式 | `governance/`、`guardrails/Gateway.ts`、`ReviewEnforcer.ts` | off/warn/block 的硬阻断 = 状态机替代判断 | **可 opt-in**：warning/block 分级符合安全治理，但 block 必须只覆盖高风险、可验证规则 |
| 自动生成资产 | `evolution/SkillCreator.ts`、`HookGenerator.ts`、`AutoDefectCreator.ts` | 自动生成 skill/hook/defect，违反 preview-first + 人工审查 | **谨慎集成**：可生成 PR/patch 草案，不应 silent write；必须审查后启用 |
| HTML/Dashboard/TUI | `output/`、`dashboard/`、`tui/` | 重型可视化，非核心链路，契约 80/20 | **平台化集成**：团队可观测性 dashboard 有价值，尤其展示 validation/evidence/cost/risk trends |
| SCALE 自身治理引擎 | `workflow/EngineeringStandards`(1440)、`ResourceGovernance`、`GovernanceTemplatePacks`(2209)、`UpgradeManager`、`CrossRepoOrchestrator` | SCALE 内部治理模板/资源/升级机制 | **平台化集成**：工程规范包、resource governance、upgrade check/plan/apply 是成熟治理能力 |
| SCALE 基础设施 | `core/`(EventBus/Container)、`api/cli.ts`(6824)、`api/mcp.ts`、`orchestration/` | SCALE 自身 DI/事件/CLI/MCP 接口 | **独立产品线**：如果做 agent platform，需要 DI/Event/MCP/CLI；若只是 spec-first harness，不应搬 |

---

## 二、重点能力详解（A 类摘取项）

### ✅ #1 TaskLevelDetector —— 任务分级从主观变确定性

**文件**：`workflow/TaskLevelDetector.ts`

**机制（源码）**：`detectFromGitDiff` 采集 git diff 信号（fileCount/lineDelta/crossModule/criticalFileHits/descriptionKeywords），按评分判定 S/M/L/CRITICAL + confidence + reasons。CRITICAL 关键词含 auth/payment/migration/secret/production；CRITICAL 文件 regex 含 migration/schema/.env/Dockerfile/package.json。纯逻辑 + git。

**相关性**：spec-first 角色契约第 8 节"任务分级"目前靠 LLM 主观判断任务大小。这个能产出**确定性的分级事实 + 理由**作为 advisory 喂给 LLM，让 LLM 在确定性基线上做语义裁量。完美的 "Scripts prepare, LLM decides"。

**摘取方式**：CommonJS 重写为 helper，产 advisory（不强制等级）。剥离它原本服务 gate 的耦合。

### ✅ #3 RuntimeEvidenceLedger —— 全库对 spec-first 最干净的一块

**文件**：`runtime/RuntimeEvidenceLedger.ts:62`（150 行，已全文通读）

**机制**：`record()` 写入 kind(command/gate/tool/skill/mcp/manual)+status(passed/failed/skipped)+command+exitCode+summary+artifacts，落地为 `.scale/evidence/runtime/RTE-{ts}-{uuid}.json` 单文件；**写入前自动 redaction**；`summary()` 聚合并识别 `expectedRed`（预期失败如 TDD red 阶段）。纯 `node:fs`，无 SQLite，无 native。

**关键张力**：spec-work SKILL.md:35 明确声明 "planned spec-work run JSON schema is **not** current runtime truth"——spec-first 主动拒绝过把 JSON 证据 schema 当权威真相。**因此摘取须作为 advisory 证据留存引入，不作为 gate 判定依据**，规避红线。

### ✅ #4 OutOfScopeStore —— 拒绝记忆，零冲突

**文件**：`workflow/OutOfScopeStore.ts`

**机制**：借鉴 mattpocock/skills 的 `.out-of-scope/`，把被拒功能请求持久化为 markdown(concept/reason/technicalContext/priorRequests)，`check()` 支持精确 + 模糊关键词(≥2 命中)去重，append 模式累积 priorRequests。

**相关性**：直接实现 spec-work 已提到的 "provenance-backed rejected/out-of-scope rationale" —— 当前 spec-first 提了这个概念但无专门存储。且**已经是 markdown 文件化**，与 docs/ 哲学零冲突。

### ✅ #5 CrossModelReviewer —— 多 persona 审查共识

**文件**：`review/CrossModelReviewer.ts`（103 行，已全文通读）

**机制**：`aggregate()` 合并多个 review 的 findings，按 category+description 去重，分 unanimous(全体一致)/majority(≥半数)/solo(单独)，算 overallScore(100-critical*25-high*10-solo*2) + recommendation。纯函数。

**相关性**：spec-first code-review 是多 persona 并行。这个把多视角发现按共识确定性聚合分级——unanimous 高可信、solo 需人工裁量。直接增强 review 闭环。

### ✅ #14 RuleMaturity —— 化解"硬规则"担忧的元框架

**文件**：`evolution/RuleMaturity.ts`

**机制**：规则三阶段成熟度 `shadow → candidate-hook → approved-blocking`；晋升需 minShadowHits(10) + minDefectEvidence(1) + maxFalsePositiveRate(0.2) + 人工 approvedBy；带 rollback。

**相关性**：这是元能力。spec-first 担心"硬编码规则/状态机替代判断"——而 RuleMaturity 提供了**安全引入确定性规则的框架**：新规则先 shadow（只观察不阻断）→ 积累命中证据和误报率 → 人工批准后才升级阻断。完全符合契约的 advisory→confirmed、preview-first。即使将来 spec-first 要引入任何检测规则，这个晋升框架本身就是正确范式。

---

## 三、知识 / 上下文 harness 专项（对应用户核心目标）

用户目标聚焦"知识、上下文"。专项结论：

**上下文（Context Harness）**：
- spec-first 已有 `context-bundle.js`（路径级预算打包，token budget + section + reason_code + degraded）。
- SCALE 的真正增量是 **ContextCompiler（✅ #8）的相关性打分排序**——context-bundle 只做预算截断不排序，这是实质补洞。
- ContextBudget 的 5 类 category（🟡）可借鉴改进分类。
- CommandOutputCompressor（✅ #11）补命令输出压缩的洞。

**知识（Knowledge Harness）**：
- spec-first 已有 `docs/solutions/` + spec-compound + spec-sessions（文件化、人可读、git 可审）。
- SCALE 的知识/记忆主体（MemoryBrain SQLite、MemoryProviders、KnowledgeBase）**与之重叠且走 SQLite/provider 方向 = 多真相源，❌ 不整体引入**。
- 真正可摘窄点：OutOfScopeStore（✅ #4，拒绝记忆，docs/solutions 没覆盖的类别）、MemoryIntelligence 冲突检测（🟡，多来源知识去冲突）、SessionInjector 防重放 sentinel（🟡，解决"沉淀了但下次会话不召回"）、TF-IDF 算法（🟡，改进检索）。

**核心判断**：知识/上下文的增强，**不靠引入 SCALE 的引擎，而是靠摘取它的几个确定性算法 + 一个新知识类别（拒绝记忆），用 spec-first 文件化方式重写**。

### 3.1 `知识相关.md` 的六层体系：借骨架，不搬 provider

`知识相关.md` 的原始分层更细：`Agent Adapter / Session 注入 -> Context Pack / Context Compiler -> Memory Provider Router -> Memory Fabric / Memory Brain -> KnowledgeBase / GraphifyKnowledgeBase -> CodeGraph / Graphify / fallback scan -> Skill Radar / Skill Policy -> Out-of-scope / Cerebrum / Glossary`。对 spec-first 来说，正确做法不是照搬这些 CLI、provider 和 `.scale` 配置，而是压缩成六层 **Knowledge Harness lens**：

1. **项目上下文 / 术语层**：让 agent 先知道项目目标、术语、source-of-truth 和已拒绝误解。
2. **Context Pack / 预算层**：把任务相关上下文按来源、预算、included/omitted 和 reason_code 交给 LLM。
3. **记忆召回 / 冲突层**：召回 `docs/solutions/`、历史 session、git 历史和 out-of-scope rationale，并标记 stale/conflict。
4. **代码理解 / 影响层**：用 bounded source reads、`rg`、ast-grep、测试和可选外部 provider facts 理解代码结构与影响面。
5. **能力选择 / Agent 路由层**：决定当前任务需要哪个 public workflow、skill、reviewer 或外部研究能力。
6. **沉淀治理 / 知识升级层**：把 runtime evidence、review 结论和真实复用价值沉淀进 changelog、docs/solutions、标准或后续 plan。

这个六层体系可以整体借来作为 spec-first 的知识协作语言，因为它与角色契约中的 `Codebase -> Context -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路一致；但它必须保持三条边界：第一，外部 provider 只产 advisory facts，不能成为 truth；第二，长期写入只在 `ship/consolidate` 后发生，不能在需求探索时把猜测 promote；第三，agent/skill 选择由 LLM 根据任务语义判断，不由脚本、状态机或 Skill Radar 强制决定。

### 3.2 六层对应的 spec-first agent / skill

下表不是新增 runtime contract，而是把现有 `skills/` 与 `agents/` 映射到六层 Knowledge Harness。`skill` 表示主要入口或消费者；`agent / reviewer` 表示适合在该层提供专业判断的现有角色，实际调度仍由对应 workflow 的文档化 phase 和当前 host 能力决定。

| 六层 | SCALE 对应 | spec-first 正确形态 | 对应 skill | 对应 agent / reviewer | 边界 |
|------|------------|---------------------|------------|------------------------|------|
| 1. 项目上下文 / 术语层 | `ContextBuilder`、`ProjectAnatomy`、`.scale/GLOSSARY.md`、Agent Adapter 注入 | 读取 `AGENTS.md` / `CLAUDE.md`、`docs/contracts/**`、README、项目规范、domain glossary 或 PRD-local glossary；缺失时降级为 direct source evidence | `using-spec-first`、`spec-prd`、`spec-brainstorm`、`spec-plan` | `spec-repo-research-analyst`、`spec-coherence-reviewer`、`spec-product-lens-reviewer`、`spec-scope-guardian-reviewer` | 不要求每个项目固定存在 `CONTEXT.md`、`.scale/GLOSSARY.md` 或统一 glossary；术语缺口是 advisory gap，不是 blocker |
| 2. Context Pack / 预算层 | `ContextCompiler`、`ContextBudget`、`MemoryFabric pack`、Session 注入 | 在 workflow 内形成 bounded context bundle：source refs、included/omitted、token budget、degraded reason、验证限制；脚本收集事实，LLM 判断相关性 | `spec-plan`、`spec-work`、`spec-code-review`、`spec-doc-review`、`spec-debug` | `spec-repo-research-analyst`、`spec-spec-flow-analyzer`、`spec-feasibility-reviewer` | 不做无限上下文和全仓常驻注入；context 排序可以借鉴 SCALE 算法，但不能让算法替代语义取舍 |
| 3. 记忆召回 / 冲突层 | `Memory Provider Router`、`Memory Brain`、`Memory Fabric`、`MemoryLearning`、`OutOfScopeStore`、`Cerebrum` | 以 `docs/solutions/`、`spec-sessions`、git history、out-of-scope rationale 和 review/validation docs 为可审计记忆；召回结果标注 provenance、freshness、conflict | `spec-sessions`、`spec-compound-refresh`、`spec-compound`、`spec-debug`、`spec-plan` | `spec-learnings-researcher`、`spec-session-historian`、`spec-git-history-analyzer`、`spec-pattern-recognition-specialist` | 不把 SQLite、GBrain、agentmemory 或 SCALE local memory 设为 truth；外部记忆默认只读、可降级、不可直接写长期规则 |
| 4. 代码理解 / 影响层 | `CodeGraph`、`Graphify`、`fallback scan`、`KnowledgeBase recall` | 默认用 bounded direct source reads、`rg`、ast-grep、git diff、测试和构建日志；可选 provider 只能补充 orientation 或 degraded facts | `spec-prd`、`spec-plan`、`spec-debug`、`spec-work`、`spec-code-review` | `spec-repo-research-analyst`、`spec-architecture-strategist`、`spec-api-contract-reviewer`、`spec-data-migrations-reviewer`、`spec-security-reviewer`、`spec-performance-reviewer`、`spec-testing-reviewer` | 不恢复 Graph/GitNexus/Graphify 为核心 provider truth；源码、diff 和实测命令永远高于图谱摘要 |
| 5. 能力选择 / Agent 路由层 | `Skill Radar`、`Skill Policy`、`SkillRepository`、`.scale/skills.json` | 由 `using-spec-first` 做 public workflow 路由，由各 workflow 按 documented phase 选择最小必要 skill / reviewer / research；skill registry 只提供 metadata 与 safety hints | `using-spec-first`、`spec-skill-audit`、`spec-mcp-setup`、`spec-update`、`spec-code-review`、`spec-doc-review` | `spec-project-standards-reviewer`、`spec-agent-native-reviewer`、`spec-cli-agent-readiness-reviewer`、`spec-best-practices-researcher`、`spec-framework-docs-researcher` | 不用 Skill Radar 强制执行，不把所有 skill 全文常驻上下文；agent 激活必须最小、可解释、可降级 |
| 6. 沉淀治理 / 知识升级层 | `memory settle/promote`、`Out-of-scope`、`Cerebrum`、docs/rules/ADR | 交付后按证据把结论写入 `CHANGELOG.md`、`docs/solutions/`、docs/contracts、README 或后续 plan；未验证内容只保留为 candidate / follow-up | `spec-compound`、`spec-compound-refresh`、`spec-release-notes`、`spec-work`、`spec-code-review` | `spec-learnings-researcher`、`spec-maintainability-reviewer`、`spec-project-standards-reviewer`、`spec-coherence-reviewer`、`spec-code-simplicity-reviewer` | 只有真实运行证据、review 结论或重复复用价值才能长期沉淀；不能把会话中临时猜测自动 promote 为项目规则 |

落到 workflow 节点上，六层的读写纪律应保持与 SCALE 原则一致但更轻量：`define/spec/plan/review` 主要读知识，`work/build` 消费约束并产生 runtime evidence，`verify/review` 校验证据可信度，`ship/compound` 才做长期沉淀。这样既借到了 SCALE 的知识系统骨架，又不引入 provider truth、中心化流程引擎或强状态机。

### 3.3 Provider 依赖安装策略：默认强推荐，不默认强信任

用户视角下，默认安装 GBrain、Graphify、CodeGraph 的确能提高上限：跨会话召回更连续，陌生仓库影响面分析更快，context pack 更容易带上历史经验和代码结构。但 spec-first 需要区分两个问题：**是否默认安装** 与 **是否默认信任**。前者可以按团队 profile 提升自动化程度；后者必须始终保持 source-first、evidence-first。

因此推荐采用三档安装 profile，而不是单一"默认全装"或"默认不装"：

| Profile | 默认行为 | 适用场景 | 安装对象 | 信任边界 |
|---------|----------|----------|----------|----------|
| `minimal` | 不安装外部 provider，只检测并提示 | 个人项目、低依赖环境、快速试用、隐私敏感仓库 | 无；只用 direct source reads、`rg`、git diff、测试、`docs/solutions/`、`spec-sessions` | 没有 provider facts，能力上限较低但 truth 边界最清晰 |
| `recommended` | 默认检测并**强推荐一键安装**，用户显式确认后安装 | 大多数团队项目，希望提升 recall / impact 但仍保持轻量治理 | 可选 GBrain 或等价 memory provider；可选 Graphify / CodeGraph 中一个代码理解 provider | provider 输出一律标 `advisory`、`freshness`、`source`、`confidence`、`fallback_used`；源码和实测命令优先 |
| `platform` | 团队可在 project / org profile 中把 provider 设为默认安装和默认启用 | 企业 agent platform、多仓协作、长期知识治理、需要统一 onboarding 的团队 | GBrain + Graphify + CodeGraph 或团队指定 provider 组合 | 安装和启用仍不等于 truth；长期 memory 写入默认走 candidate -> review -> promote，外部写入需显式 policy |

需要注意：GBrain / Graphify / CodeGraph 只是 `memory` / `knowledge` pack 的核心外部 provider，不是完整依赖清单。按 SCALE 原始安装面，依赖应按层拆开：

| 依赖层 | SCALE 对象 | 是否需要安装 | spec-first 借鉴判断 |
|--------|------------|--------------|----------------------|
| Host/runtime projection | `scale init --agent <agent>` 生成 settings、knowledge doc、skills dir、hooks、`.scale/config.yaml` | 生成/写入 runtime asset，不是第三方 provider 安装 | spec-first 只借 generation report、self-test、permission projection；不手改 generated mirror，不引入 `.scale` truth |
| Memory provider | GBrain、agentmemory、scale-local / Memory Brain、`.scale/memory-providers.json` | GBrain 是 SCALE 默认外部 provider；agentmemory 可选；scale-local 是本地 fallback；Memory Brain 依赖 SQLite/better-sqlite3 | `recommended/platform` 可安装 GBrain 或等价 provider；agentmemory 仅 explicit opt-in；spec-first 核心仍以 `docs/solutions/` / `spec-sessions` 为可审计记忆 |
| Knowledge / code provider | Graphify CLI、Graphify graph artifact、CodeGraph CLI、`.codegraph/` 索引、`.scale/code-intelligence.json` | Graphify / CodeGraph 属 knowledge pack 外部安装；图谱/索引还需要初始化和刷新 | 可作为 secondary provider；必须暴露 commit/hash/freshness/fallback，不替代源码、diff、测试 |
| Built-in fallback | `internal-scan`、`rg`、`read`、TF-IDF、Context Compiler、Memory Fabric | 不需要安装第三方；属于引擎内置或通用 shell/source read 能力 | spec-first 默认应优先使用这层：bounded direct reads、`rg`、ast-grep、git diff、测试日志 |
| Skill / tool registry | `.scale/skills.json`、`.scale/tools.json`、Skill Radar、SkillRepository | 多数是配置和 metadata；第三方 skill 需要另行安装 | 只借 registry metadata：source、trigger、risk、install command、recommended action；不把技能全文常驻上下文 |
| UI / docs knowledge skills | awesome-design-md、ui-ux-pro-max、Anthropic / Claude Code skills | UI pack 或显式 setup/apply 后安装 | 不是知识核心依赖；仅在 UI/UX/文档类任务或 platform profile 中 opt-in |
| Web / browser evidence tools | web-access、Agent Browser、Chrome DevTools MCP、Playwright | 按 web research、浏览器验证、E2E 场景安装 | 不随 knowledge provider 默认安装；由具体 workflow 根据最新信息、网页证据或 UI 验证需求触发 |
| Governance local stores | Out-of-scope、Cerebrum、learning candidates、glossary、runtime evidence | 多为本地文件/懒创建 store；不应被当作外部依赖 | 可借 out-of-scope / do-not-repeat / learning candidate 语义，但长期沉淀仍走 evidence -> review -> docs/rules |

正确安装流程应保留 SCALE 的 preview-first 节奏，但改成 spec-first 的 source/runtime 边界：

1. **detect**：`init` / `doctor` / `mcp-setup` 类入口检测 provider 是否存在、版本、权限、索引新鲜度、是否能读当前 repo。
2. **plan**：输出安装计划，列出 `benefit`、`cost`、`privacy`、`write_policy`、`install_command`、`verify_command` 和 `degraded fallback`。
3. **apply**：只有用户显式确认或团队 profile 明确选择 `recommended/platform` 时才安装，不 silent write。
4. **verify**：验证 provider CLI/MCP 可用、索引与当前 commit / files hash 对齐、memory provider 写入策略符合配置。
5. **consume**：workflow 消费 provider facts 时必须带 freshness/confidence/reason_code；与源码、diff、测试冲突时降级 provider facts。
6. **settle/promote**：只有交付后有 runtime evidence、review 结论或重复复用价值，才进入长期知识候选；默认不把一次会话猜测写入外部 memory。

这个策略承认"默认安装可以更强"，但把默认安装限定在 profile 化选择中：`minimal` 保持轻量核心，`recommended` 提供一键上限提升，`platform` 面向团队默认全装。无论哪一档，provider 和外部工具都只是增强 LLM 输入质量的工具，不拥有 scope、truth、review finding 或任务完成状态。

---

## 四、project-scaffold 补充分析：治理基线层

### 4.1 定位差异

| 对象 | 主要价值 | spec-first 应吸收什么 | 不应吸收什么 |
|------|----------|----------------------|--------------|
| scale-engine | 能力矿藏：检测器、证据账本、上下文排序、记忆算法、review 聚合 | 确定性算法与事实采集 helper，用 CommonJS 文件化重写为 advisory facts | FSM/Gate/Policy/SQLite/agent 编排/代码图谱 provider |
| project-scaffold | 治理基线：让项目复制一套可审计工作流资产 | 文档模板、证据分类、验证 profile、资源生命周期、上下文地图、preview-first 升级模式 | `.planning` 强状态、G0-G22 blocking gate、`.scale` 作为 truth、SCALE CLI/dashboard/codegraph 依赖 |
| scale-os-config-claude-code | 运行时配置投影：把 SCALE 意图落到 Claude Code project settings、hooks、permissions、MCP、skills 和质量契约 | 生成报告、自检脚本、host capability report、permission/protected-path mapping、skill registry 安全元数据、verification profile、dry-run 语义反例 | 大段 inline shell hooks、`.scale/workflow.json` 状态机 truth、blocking Stop gate、全量技能清单常驻上下文、配置不一致也通过的 validator |

### 4.2 建议补充到 spec-first 文档的能力

下表最后一列按"忽略当前 spec-first 轻量边界、从业界 agentic coding / enterprise AI engineering platform 最佳实践看是否值得集成"来标注；它是补充视角，不替代前面"建议形态 / 边界"列的当前落地判断。

| # | project-scaffold 资产 | 可补充到 spec-first 的点 | 建议形态 | 边界 | 放宽约束后的借鉴集成 |
|---|----------------------|--------------------------|----------|------|----------------------|
| 1 | 四问治理目标：`README.md:3-10` | 在 AI Coding Harness 文档中增加"任务目标 / 影响范围 / 已验证与未验证 / 沉淀与临时产物"四问，作为每个 workflow closeout 的共同 lens | 更新 docs/contract prose，不新增 runtime 状态 | LLM 负责判断四问答案，脚本只提供事实 | **核心集成**：作为所有 agent closeout / PR summary / release handoff 的最小 accountability contract |
| 2 | 任务证据目录：`scripts/workflow/new-task.sh:34` 生成 `explore.md`、`runtime.md`、`reality-check.md`、`resource-cleanup.md`、`verification.md` 等 | spec-work / spec-plan 可借鉴这些**证据切面**，补强现有 plan、task-pack、run artifact 的 closeout 信息结构 | 不复制 `.planning/tasks`；把切面并入现有 artifact template 或 closeout checklist | 避免把任务目录变成新的进度 truth | **核心集成**：任务 evidence workspace 是成熟 agent 平台常见形态，但应与 source docs / git diff 解耦 |
| 3 | Reality Check 模板：`docs/workflow/templates/reality-check.md:6-28`，G2 强制校验这些 heading：`scripts/gates/G2-verify.sh:45-56` | 把 `Confirmed / Not Verified / Stub / Credential-Gated / Environment-Gated / User-Visible Risk` 升级为 spec-work、spec-doc-review、spec-code-review 的通用证据诚实分类 | 新增或扩展 verification / review closeout lens；可进入 run artifact 的 `limitations[]` / `risk[]` | 只分类证据状态，不自动判定任务成功 | **核心集成**：证据状态 taxonomy 应成为 agent 平台默认审计语言，避免 skipped/dry-run 冒充 passed |
| 4 | 验证 profile 与 service matrix：`.agent/project.json:5-19`、`scripts/workflow/verify.sh:87-136` | 给 spec-first 一个 project-local 验证命令声明范式：profile→services→checks→commands→required_tools | 作为 optional `verification-profile` contract 或文档建议；优先消费现有 package scripts | 不新增第二套业务验证，不把缺工具包装成失败成功结论 | **核心集成**：repository-level verification profile 是业界标配，可驱动 affected tests、CI parity 和 not-run disclosure |
| 5 | Product Smoke：`docs/workflow/templates/product-smoke.md:3-23` | 补强 spec-work 验证定义：用户可见改动要尽量证明真实产品路径，不用 health endpoint 代替业务路径 | 作为 `spec-work` 验证 lens / docs 示例 | 不强制所有任务跑 E2E，小任务仍保持轻量 | **核心集成**：用户可见改动应有 product-path smoke 或明确未验证说明，是交付可信度底线 |
| 6 | 资源治理：`.scale/resource-policy.json:13-31`、`docs/workflow/templates/resource-impact.md:21-24`、`resource-cleanup.md:6-17` | 补齐 artifact 生命周期判断：哪些是 source、runtime、task evidence、temporary、generated report；哪些要提交、忽略、删除或提升为长期文档 | 扩展 source/runtime boundary、artifact map、closeout resource lens | `.scale` 配置不作为 spec-first truth；source-of-truth 仍在 `docs/contracts/**` 与 CLI contracts | **核心集成**：artifact lifecycle / retention / cleanup policy 是团队级 AI 工程治理必备能力 |
| 7 | 上下文地图：`CONTEXT.md:5-15`、`docs/CONTEXT-MAP.md:5-18` | 借鉴低 token 术语表 + 模块/文档关系图，帮助 LLM 快速定位长期事实、拒绝误解和文档更新责任 | 作为可选 project-local context pattern；与 `domain-glossary` / `context-bundle` 对齐 | 不要求每个项目固定存在 `CONTEXT.md`；缺失只降级，不阻塞 | **核心集成**：project memory / context map 应成为 agent onboarding 的默认入口，可降低上下文漂移 |
| 8 | Skill / Tool 证据策略：`.scale/skills.json:3-11`、`.scale/tools.json:2-14`、`skill-plan.md` / `skill-evidence.md` | 对 UI、E2E、API、DB、安全、发布等场景，记录"为什么选这个 skill/tool、实际是否运行、fallback 是什么" | 加入 workflow closeout 的 tool/skill evidence 表达；保留 advisory | 不把第三方 skill/tool 变成必装依赖 | **核心集成**：tool use provenance、fallback 和 output summary 是多工具 agent 的审计基础 |
| 9 | Preview-first 升级路径：`README.md:68-79`、`docs/workflow/README.md:78-91` | 强化 `spec-first init/update/clean` 文档中的 check→plan→apply→verify 节奏，尤其 runtime drift / host guidance 修复 | 文档和 CLI help 层面补 preview-first wording | `apply` 必须显式确认，不能静默覆盖项目语义 | **核心集成**：check/plan/apply/verify 是安全自动化的标准节奏，尤其适合 runtime 和 policy 变更 |
| 10 | Runtime Contract：`docs/workflow/templates/runtime.md:5-18` | 把配置来源、服务拓扑、认证方式、已覆盖/未覆盖/凭据受限/云环境受限写成验证边界，而不是只列测试命令 | 加入 `spec-work` closeout / run artifact 的 runtime-boundary lens；可供 context-bundle 摘要 | runtime 描述是本次验证事实，不是长期环境 truth；缺失只降级 | **核心集成**：环境、凭据、服务拓扑和不可验证边界必须进入交付证据，支撑 reproducibility |
| 11 | 条件化领域模板：`api-contract.md`、`db-change-plan.md`、`security-review.md`、`architecture-review.md`、`ui-spec.md`、`visual-review.md` | 按变更拓扑触发对应问题清单：API 变更问请求/响应/权限/兼容；DB 变更问迁移/回滚；UI 变更问状态/响应式/可访问性 | 作为 `spec-plan` / `spec-doc-review` / `spec-code-review` 的 conditional lens，不新增固定模板墙 | 小任务不强制展开；领域 lens 由 LLM 根据 scope 选择 | **分级集成**：按 surface 触发 domain lens 是最佳实践；高风险 API/DB/security/UI 改动应默认启用 |
| 12 | Docs / Standards Impact：`docs-impact.md`、`standards-impact.md`、`docs/standards/common/DOCUMENT_STANDARDS.md:43-57`、`docs/CONTEXT-MAP.md:10-14` | 把"哪些代码变更需要更新哪些文档/标准/入口索引"显式化，减少代码已改而文档责任丢失 | 补入 artifact map、doc-review lens 或 spec-work closeout 的 docs-impact 检查 | 不做全仓同步引擎；最终仍以 source read + diff 判断 | **核心集成**：docs/standards impact tracing 应进入 PR readiness，避免系统知识与代码长期分叉 |
| 13 | Redline / dangerous-file 检查：`scripts/redlines/R1-check.sh`、`R2-check.sh`、`R3-check.sh`、`scripts/gates/G19-verify.sh`、`scripts/hooks/check-dangerous-file.sh` | 零数据丢失、零静默失败、零硬编码密钥、空 catch、危险路径等可转成 advisory detector 样例 | 借鉴规则形态进入 review/security lens 或 RuleMaturity shadow 阶段 | 默认不阻断；只有经证据成熟度和人工批准的规则才可能升级 | **分级 / opt-in 集成**：redline rules 应先 shadow 观察误报率；生产/安全/数据任务可升级为 blocking guardrail |
| 14 | 多 Agent ownership contract：`docs/standards/common/COLLABORATION_GOVERNANCE.md:121-139` | dispatch 前声明 task boundary、write set、read context、integration contract、conflict rule，可增强 reviewer/worker 交接质量 | 补进 subagent/reviewer prompt contract 与 handoff checklist | 不引入中心化 coordinator；并行边界仍由公开 workflow 当次判断 | **核心集成**：多 agent 协作必须显式 write-set、handoff、conflict 和 accountability，否则并发越多风险越高 |
| 15 | dry-run 语义：`docs/guides/DEVELOPMENT_WORKFLOW.md:62-73`、`scripts/workflow/verify.sh:87-136`、`scripts/gates/all.sh:45-58` | 明确 dry-run 只能证明可调度 / 语法可跑，不等于业务验证通过 | 写入 verification closeout taxonomy，与 `Not Verified` / `skipped` 区分 | 禁止把 dry-run 包装成 passed；脚本输出只提供事实 | **核心集成**：dry-run / simulated / skipped / passed 必须分层记录，是 AI 交付可信度最小要求 |

### 4.2.1 建议落入的 spec-first 文档面

| spec-first 文档/入口 | 建议补充内容 | 预期收益 |
|---------------------|--------------|----------|
| `docs/contracts/ai-coding-harness.md` | 增加 project-scaffold 四问与 Reality Check 六类证据状态，作为 Evidence / Governance Harness 的共同语言 | 让所有 workflow 的完成报告有同一套诚实口径 |
| `docs/contracts/artifact-summary.md`、`docs/contracts/workflows/spec-work-run-artifact.schema.json` | 增加 runtime-boundary、resource lifecycle、tool/skill evidence、docs-impact 的可选字段或 lens 描述 | closeout 能回答"验证边界在哪里、产物该留哪、用了什么工具" |
| `skills/spec-work/SKILL.md` | 补 Product Smoke、Runtime Contract、dry-run 语义和 Resource Cleanup 的 closeout 约束 | 执行完成时更少出现"测试跑了但业务路径没证明"的假完成 |
| `skills/spec-plan/SKILL.md`、`skills/spec-prd/SKILL.md` | 借鉴 API / DB / Security / UI / Architecture 条件化模板作为 scope lens | 计划阶段更早暴露权限、迁移、回滚、响应式和兼容性风险 |
| `skills/spec-code-review/SKILL.md`、`skills/spec-doc-review/SKILL.md` | 借鉴 Redline、Docs Impact、Standards Impact、Visual Review 的 reviewer checklist | 审查发现从泛泛质量评价收敛到证据化风险点 |
| `docs/contracts/context-governance.md`、`docs/contracts/domain-glossary.md` | 借鉴 `CONTEXT.md` / `CONTEXT-MAP.md` 的低 token 术语表、拒绝误解和文档责任图 | 不要求固定项目文件，但给下游项目一个轻量上下文模式 |

### 4.2.2 进一步补充建议：按落地优先级分层

| 优先级 | 可借鉴项 | 建议补充到文档的表达 | 为什么适合 spec-first |
|--------|----------|----------------------|----------------------|
| P0 | Closeout 四问 + Reality Check 六类状态 | 在 `ai-coding-harness`、`spec-work`、`spec-code-review`、`spec-doc-review` 中统一要求区分任务目标、影响范围、真实验证、未验证/受限/模拟证据和沉淀边界 | 只改变 LLM 的报告 lens，不新增流程状态；能直接减少"看起来完成" |
| P0 | dry-run / skipped / failed / passed 的证据语义 | 在 verification taxonomy 中明确 `dry-run=schedulable`、`skipped=未执行且有原因`、`passed=真实命令通过`，禁止互相替代 | 这是脚本事实与 LLM 判断的边界问题，成本极低、收益高 |
| P0 | Runtime Contract + Product Smoke | 在 `spec-work` closeout 增加运行边界：配置来源、服务拓扑、凭据/环境限制、真实用户路径是否验证 | 避免把 health check、语法检查或 dry-run 包装成业务链路验证 |
| P1 | Resource Lifecycle / Docs Impact / Standards Impact | 在 artifact 和 closeout 文档里增加产物去向：长期 source、任务证据、临时 runtime、生成报告、应清理项、应更新文档 | 补齐"哪些结论沉淀、哪些只是过程产物"，与 source/runtime 边界同构 |
| P1 | `.agent/project.json` 风格的 verification profile | 把 `profile -> services -> checks -> commands -> required_tools` 作为可选项目本地验证声明范式 | 比让 LLM 临场猜命令更稳；但必须优先消费已有 package scripts，不形成第二套业务真相 |
| P1 | Conditional surface lens | 将 API/DB/Security/UI/E2E/Architecture 模板压缩为按变更拓扑触发的问题清单 | 让 plan/review 在命中领域时问对问题，小任务不承担模板墙成本 |
| P1 | Tool / Skill evidence | 记录为什么选择某 tool/skill、实际是否运行、fallback 是什么、输出摘要在哪里 | 对多工具协作很有用，但必须保留 advisory，不把第三方工具变成必装依赖 |
| P2 | Ownership manifest / generated output policy | 借鉴 `governance.lock.json` 与 `output-policy.json` 的 owned-file/hash、source markdown -> generated report 关系 | 可用于未来 runtime generation / docs report 的 drift 说明；现阶段只作为设计参考 |
| P2 | Redline detector 样例 | 将零数据丢失、零静默失败、零硬编码密钥、危险路径、空 catch 转成 review/security advisory detector | 适合走 RuleMaturity shadow 阶段；默认不阻断，避免重回 gate engine |

### 4.2.3 真相源分辨：哪些形态只借语义

`project-scaffold` 的文件形态不能原样套进 spec-first：

| project-scaffold 形态 | 在 spec-first 中的正确处理 |
|----------------------|----------------------------|
| `.planning/tasks/<task>/` | 只借 `explore/runtime/reality/resource/verification/review/summary` 这些证据切面；不新增任务状态目录，也不替代 brainstorm/plan/task-pack/run artifact |
| `.agent/state/current.json` | 不搬。spec-first 不需要中心化 current-state 作为 workflow truth |
| `.agent/project.json` | 可借 profile/service/check/command/required_tools 的声明范式，作为 project-local optional verification facts |
| `.scale/verification.json` | 不作为证据主来源；本项目里该文件反而是空 service，说明 `.scale` runtime policy 不应被视为 spec-first truth |
| `.scale/governance.lock.json` | 只借 owned-file/hash/pack-version 的 drift 说明思想；不把外部 SCALE pack 变成 spec-first source |
| `.scale/output-policy.json` | 借"生成 HTML/report 只能从源 Markdown 派生，不能替代 source doc"的原则 |
| G0-G22 scripts | 借单个检查的表达和风险分类，不搬 blocking gate 编排 |

### 4.3 scale-os-config-claude-code 补充分析：Claude Code 运行时投影层

`scale-os-config-claude-code` 是一个小型配置包（38 个文件 / 5,739 行），文件面包括 `CLAUDE.md`、`.claude/settings.json`、`.agent/project.json`、`.agent/report.json`、`.scale/{workflow,quality-contract,skills-registry,policies}.json`、session hooks、G0-G9 gate 脚本、verification profile runner 和质量契约文档。它展示了 SCALE Engine 如何把治理理念投影到 Claude Code 的 host-native 表面。

关键判断：这个配置包**比 project-scaffold 更接近 runtime projection**，因此更不能按原形搬进 spec-first source；但它暴露了 spec-first 当前可补强的几个低成本点：生成物自检、host capability report、permission 映射、skills registry 安全元数据、verification profile、dry-run 出口码语义、以及 runtime guidance 不应把过多技术栈和技能塞入可见上下文。

| # | 配置资产 | 可借鉴点 | 建议补到 spec-first 的形态 | 不应照搬的边界 | 放宽约束后的借鉴集成 |
|---|----------|----------|----------------------------|----------------|----------------------|
| 1 | `README.md` + `SCALE-REPORT.md` 文件清单与生成报告 | 每次 runtime/config 生成后给出机器必跑命令、人类可读产物清单、unsupported/degraded、honesty rules | 扩展 `spec-first init` / `doctor` / `update` 文档和报告口径：列出 source、generated runtime、must-run、degraded reason | 不把 report 当 source truth；它只是本次生成事实摘要 | **核心集成**：host runtime projection 必须有 capability report 和生成后自检清单 |
| 2 | `.agent/report.json` host capability report | 明确 agent 支持 memoryFiles、configFiles、hooks、MCP、permissions、skills、stop hook | 为 `spec-first doctor --claude/--codex` 增加 host capability summary 或在现有 runtime tools index 中补字段 | 不引入 `.agent/report.json` 作为新 truth；由 CLI 现场探测或从既有 contract 派生 | **核心集成**：多宿主治理需要能力矩阵，否则 workflow 无法诚实降级 |
| 3 | `.claude/settings.json` permissions allow/deny | 把 protected paths、危险命令、允许的验证命令落到 host-native permission surface | 在 docs/dual-host-governance 中补"source policy -> host permission projection"设计 lens；未来可由 source contract 生成 | 不手写大段 runtime settings，不绕过 `spec-first init` source-first 生成 | **核心集成**：agent 平台应把高风险写入、破坏性命令、发布命令映射到宿主权限 |
| 4 | `.scale/policies.json` + Devin shield YAML | 同一 protected-path / denied-command policy 可以投影到不同 host/provider | 借鉴为 policy projection pattern：source policy 一份，多宿主生成不同 runtime 表达 | 不引入 `.scale` policy truth，不把 provider-specific YAML 纳入默认核心 | **平台化集成**：企业平台需要 policy-as-source + host adapters，但轻量 harness 只保留 source/runtime 边界 |
| 5 | `.scale/skills-registry.json`（177 entries） | registry 只暴露 id/name/category/tier/status/sourceRepo/trigger/safety/riskFlags/recommendedAction，符合 progressive disclosure；统计显示 `unknown-source` 96、`manual-review` 76、`installer-script` 20、`global-install` 8 | 增强 skill/agent quality governance 文档：第三方 skill 应有 source、trigger、install command、risk flags、recommended action；默认只读 metadata，不加载全文 | 不把 177 个技能塞进 `CLAUDE.md`；不要求 spec-first 内置第三方 skill marketplace | **核心集成**：skill registry + install safety scan 是 agent ecosystem 的基础能力 |
| 6 | `CLAUDE.md` 的 `SKILL_RADAR` 和 `MACHINE_CHECKS` | 任务开始先扫 registry，按任务阶段组合最小技能集；完成时记录 skills_used、tool_outputs、skipped_reason | 补进 workflow closeout / reviewer handoff 的 tool-skill evidence lens | 不要求 agent "必须主动使用已安装 skills"；选择权仍由 LLM 按相关性判断 | **核心集成**：tool/skill provenance 和 skipped_reason 是多工具协作的审计底线 |
| 7 | `.agent/project.json` verification profiles | `fast/default/release` + service matrix + required/optional checks + required_tools，能把验证从 prose 变成项目配置事实 | 作为 optional verification-profile contract 的更完整样例，补 `required_tools` 与 service directory 字段 | 不与 package scripts 竞争真相源；缺工具和占位命令必须标 degraded/not-run | **核心集成**：verification profile 应驱动最窄验证、CI parity 和 release readiness |
| 8 | `scripts/workflow/verify.sh` | profile runner 能遍历服务、区分 required/optional、执行命令并累计失败 | 借鉴 runner 输出结构和 not-run/failure 分类；若落地需 CommonJS 或更严 shell 实现 | 不直接执行外部配置命令；不把 optional skipped 算 passed | **分级集成**：团队级可执行 profile runner 有价值，当前 spec-first 可先文档化 contract |
| 9 | `scripts/validate-config.sh` + `scripts/tests/run.sh` | 生成物自测覆盖文件存在、JSON 语法、脚本 executable bit | `spec-first init/update` 后增加或强化 generated runtime smoke：文件存在、JSON/Markdown 合法、脚本权限、host hook 可调度 | 当前样例 validator 漏掉 Java/Go/pnpm 不一致，说明一致性校验必须基于 schema 而非少量 if | **核心集成**：生成资产必须有 deterministic self-test，且 validator 不能假阳性 |
| 10 | `scripts/gates/all.sh --dry-run` 实测反例 | 本仓 `--dry-run` 打印 10 个 non-executable 失败，却仍 exit 0 并输出 OK，证明 dry-run exit code 必须区分 schedulable 与 not-schedulable | 在 spec-first verification taxonomy 明确：dry-run 如果发现不可调度必须 failed；只能证明调度面，不证明业务验证 | 不采用该 all.sh 逻辑；把它作为 anti-pattern 写入 docs | **核心集成**：CI/agent closeout 必须禁止 "reported failure + exit 0" 的干运行假阳性 |
| 11 | `.claude/hooks/session-start-reminder.sh` | 会话启动只提示技能扫描、任务级别、阶段输出，低成本改善 agent 入口姿态 | 保留现有 lightweight startup-reminder 思路，进一步要求提示短、source-generated、可降级 | 不把大型方法论和全技能清单注入 session start | **分级集成**：host-native reminder 有用，但必须控制 token 和噪声 |
| 12 | `.claude/hooks/session-end-gate.sh` / Stop hooks | Stop gate 试图阻断未验证、上下文污染、流程缺失 | 只借"final answer 前检查 validation evidence"语义，进入 HonestDelivery / closeout lens | 不用 blocking Stop hook 替代 LLM 判断；不依赖手写 marker 文件作为 truth | **opt-in 集成**：高风险团队可启用 Stop hook，但应可解释、可 override、记录 reason_code |
| 13 | `docs/workflow/templates/task-summary.md` | Delivered / Verification(command, exit code, evidence) / Skills and Tools / Resource Cleanup / Residual Risk 的 summary 结构简洁 | 可作为 spec-work closeout 模板压缩参考，尤其补 `Skills And Tools Used` 与 `Resource Cleanup` | 不新增固定 task-summary 文件作为进度 truth | **核心集成**：最终交付摘要应同时覆盖验证、工具、资源和残余风险 |
| 14 | `docs/workflow/templates/mini-prd.md` + `vibe-prompts.md` | 用户可见或 UI/UX/bug/release 场景给出 copyable prompt 与验收字段 | 借鉴为 user manual / examples，不进入核心 workflow contract | 不把 prompt gallery 当执行系统；不替代 spec-prd/spec-plan | **分级集成**：prompt templates 是 onboarding 资产，适合 docs/example 层而非 runtime 核心 |
| 15 | `docs/standards/ENGINEERING_RULES.md` | Logging、Data/ORM、Architecture、Security、UI/UX、Verification/Release 的跨栈红线 | 补入 domain/surface conditional lens：日志脱敏、ORM 边界、迁移回滚、UI 状态、release profile | 不把所有语言栈规则常驻每个项目入口 | **核心集成**：工程红线应该可按 surface 激活，避免无关规则污染上下文 |

### 4.3.1 进一步修正后的文档补充方向

| 优先级 | 从 scale-os-config-claude-code 新增的借鉴项 | 建议补充到文档的表达 | 为什么适合 spec-first |
|--------|------------------------------------------|----------------------|----------------------|
| P0 | Runtime/config generation report | `init/update/doctor` 生成或检查后必须清楚列出 source、runtime、must-run、degraded、unsupported、honesty rules | 解决"runtime 到底生成了什么、要验证什么、哪里降级"的问题 |
| P0 | Generated runtime self-test | 任何生成脚本/hook/settings 必须检查存在性、语法、可执行权限、host 可调度性；dry-run 检出不可调度必须非 0 | 本次配置仓暴露了 dry-run 假阳性和 executable bit 漏洞，spec-first 应作为反例吸收 |
| P0 | Skill registry metadata | skill 只默认暴露 metadata：id/name/category/tier/trigger/source/safety/risk/recommended action；需要时再读全文 | 这比把所有 SKILL.md 或长列表注入上下文更符合 progressive disclosure |
| P1 | Permission/protected-path projection | 将危险路径、危险命令、发布/删除/迁移类操作从 source policy 投影到 Claude/Codex 各自可支持的权限面 | 与 source/runtime 边界同构，可提升安全但不需要内置 SCALE Shield |
| P1 | Host capability summary | doctor 输出 host 是否支持 hooks、permissions、MCP、skills、stop hook、memory files，并给 degraded reason | 能让 workflow 对能力缺失诚实降级，不凭感觉假设宿主能力 |
| P1 | Verification profile runner contract | profile/service/check/command/required_tools 形成可选 contract；runner 输出 command、exit code、required/optional、not-run reason | 让验证命令发现从 prose 迁移到项目事实，但仍不形成第二真相源 |
| P2 | Stop hook / session-end gate | 仅在 high-risk/team opt-in 下做 final-evidence check，必须支持 override、reason_code 和人工责任 | 有治理价值，但默认启用会把 spec-first 推向强状态机 |

### 4.4 不建议搬进 spec-first 的部分

| project-scaffold 机制 | 不搬理由 |
|----------------------|----------|
| `.planning/tasks/<date>-slug>/` + `.agent/state/current.json` 作为任务状态 | spec-first 已有 brainstorm/plan/task-pack/run artifact 链路；再引入任务状态目录会形成多 truth，且容易把 LLM 判断压成状态机 |
| G0-G22 门禁脚本整体 | 可借鉴个别检查项，但整体 blocking gate 与角色契约的 "Light contract + Let the LLM decide" 冲突 |
| `.scale/**` 作为治理 truth | `.scale` 是 SCALE runtime / policy 资产；spec-first 的 truth 应留在 source docs、contracts、skills、CLI |
| `scale-codegraph` / Graphify / Dashboard | 与当前 spec-first 剥离 graph provider 和拒绝重型 dashboard 的方向冲突 |
| GitLab Flow / clean repository / pushed branches 作为硬 finish gate | 可作为团队 policy 示例，不能做 spec-first 通用默认；会干扰 docs-only、小任务和本地实验 |
| `.claude/`、`.codex/` runtime hooks 模板 | spec-first 不能从外部脚手架复制 generated runtime；宿主 runtime 仍由 `spec-first init` 从 source 生成 |
| scale-os inline shell hooks | `.claude/settings.json` 内嵌大段 shell，难测试、难 diff、难跨宿主；spec-first 应从 source helper/template 生成 runtime |
| scale-os 全技能清单常驻 `CLAUDE.md` | 177 个技能清单会污染上下文；只保留 registry metadata 和按需打开策略 |
| scale-os workflow state / marker files | `.scale/workflow.json`、`.claude/session/.verified` 等 marker 容易变成第二进度 truth；spec-first closeout 以实际 diff、命令、artifact 为证据 |

### 4.5 对本文建议的修正

结合 project-scaffold 与 scale-os-config-claude-code 后，最小落地顺序应增加一个**治理 / runtime 投影预备层**：先补文档与 closeout lens，再补 runtime generation report、generated self-test、skill registry metadata 和 verification profile contract，最后再考虑 SCALE 算法重写。理由是 reality-check、runtime contract、resource-cleanup、verification profile、context map、docs-impact、redline detector 样例、host capability report 和 dry-run 语义校验都是低成本文档/contract 增量，可以先提升 LLM 输入质量、证据诚实度和 runtime 可观察性，而不引入 SCALE 的 engine 复杂度。

---

## 五、建议的最小落地顺序（若决定推进）

按"边际增益 ÷ 边际成本"排序，每步独立可验证、不撞红线、全部产 advisory 不阻断：

0. **治理 / runtime 投影基线 lens + Knowledge Harness 六层 lens + provider 安装 profile** —— project-scaffold 的四问 closeout、Reality Check 分类、Runtime Contract、资源治理、docs-impact、product smoke、verification profile、dry-run 语义和 redline advisory；scale-os-config-claude-code 的 generation report、host capability summary、generated self-test、skill registry metadata、permission projection 和 dry-run 假阳性反例；`知识相关.md` 的项目上下文、Context Pack、记忆召回、代码理解、能力选择、沉淀治理六层映射；GBrain / Graphify / CodeGraph 这类 provider 采用 `minimal` / `recommended` / `platform` 三档安装策略。验证：workflow prose / contract test 能检查这些分类存在，`init/update/doctor` 类报告能列出 must-run/degraded/unsupported 和 provider install recommendation，且不新增任务状态 truth 或 provider truth。
1. **OutOfScopeStore（✅#4）** —— 新增 markdown 拒绝记忆。零冲突、纯增量。验证：被拒概念能写入/去重检索。
2. **VerificationCommands（✅#2）+ RuntimeEvidenceLedger（✅#3）** —— 验证命令探测 + 结构化证据留存(advisory)。验证：closeout 产出命令清单 + 证据 JSON，现有测试不破。
3. **TaskLevelDetector（✅#1）** —— git diff 任务分级 advisory。验证：构造不同规模 diff 得到合理等级 + 理由。
4. **CrossModelReviewer（✅#5）+ HonestDelivery（✅#6）+ KarpathyEvaluator（✅#7）** —— review 共识聚合 + 诚实交付 + 准则检查，接入 code-review。验证：多 persona 发现正确聚合分级。
5. **ContextCompiler（✅#8）+ CommandOutputCompressor（✅#11）** —— 上下文相关性排序 + 输出压缩，增强现有 context-bundle。验证：相关文件排序靠前、长输出被压缩。
6. **行为检测器（✅#9）选 3-5 个 + WorkflowEval（✅#10）** —— 行为 advisory + 评估指标。验证：坏行为样本可检出、pass@1 可统计。

每步都需：CHANGELOG 更新、Claude+Codex 双宿主验证、source/runtime 边界检查；引入任何"规则"时遵循 RuleMaturity（✅#14）的 shadow→approved 晋升范式。

---

## 六、与既有路线图的关系修正

既有 `spec-first-scale-integration-version-roadmap-v2-final.md` 的核心问题：

1. **版本号错误**：称 SCALE v2.0，实际 v0.44.0。
2. **规模严重低估**：只提几个文件，实际 87k 行 42 模块。
3. **方向错位**：通篇讲 governance/gate 内置——而 gate 引擎恰是契约最警惕的部分；用户真实目标是"知识/上下文"，与路线图内容不匹配。
4. **依赖外部升级**：P0/E0/C0 假设 SCALE 完成 v2.1 bundle 升级，把 spec-first 3.0 绑在外部项目上。**本调研的"摘取重写"策略让这些前置依赖全部消失**（不依赖 SCALE 包，重写为自有 CommonJS）。

**本调研建议取代路线图的 governance 框架**，改以"project-scaffold 治理基线 lens + scale-os-config host runtime 投影 lens + SCALE 确定性能力摘取 + 知识/上下文 harness 增强"为主线。

---

## 七、调研方法与验证状态

**已执行（全量覆盖，非按样本抽查）**：
- `scale-engine/src/**/*.ts` 计数经 `find -type f -name '*.ts' | wc -l` 与 `wc -l` 复核：42 个一级模块 / 306 个 .ts 文件 / 87,018 行。
- 当前轮重新读取全部 306 个 `.ts` 文件生成 deterministic inventory：逐文件记录 `sha256`、`wc -l` 行数、导入、导出、class/interface/function 声明、能力 flags，并汇总为 42 个目录模块 + `(root)` 的覆盖矩阵；矩阵已写入本文 §1.0。
- 全部 306 个 .ts 文件做逐文件结构化扫描：行数、导出符号、外部依赖、能力 flags（sqlite/fs_write/command/hook/gate/fsm/policy/knowledge/context/security 等）与模块归类。
- 逐模块结构化笔记 8 份（knowledge-memory-cortex / context-runtime-artifact-eval / workflow-fsm-governance / guardrails-shield-hooks-tools / skills-routing-agents-capabilities / evolution-output-adapters-prompts / api-core-infra / cli-review-tui-workflows），覆盖率经脚本核对无遗漏模块。
- 关键文件全文通读：GateSystem、GateCatalog、KnowledgeBase、CerebrumManager、MemoryBrain/Fabric/Providers/Intelligence/Learning、SessionInjector/InstinctStore/Extractor/ReflexionEngine、RuntimeEvidenceLedger、ContextBudget/Compiler/AntiPatternRegistry、WorkflowEval、HonestDelivery/KarpathyEvaluator、VerificationCommands、TaskLevelDetector、OutOfScopeStore、SocraticQuestioner/AmbiguityScorer、ReviewStore/CrossModelReviewer、RuleMaturity/SessionLearnings、detectors/DiffTestSelector/SafeCommandRunner/DependencyAuditor、PromptOptimizer/ClaudeCodeAdapter、CodeIntelligence、workflows/presets 等。
- spec-first 侧对照确认：`context-bundle.js` 全文、spec-work/spec-compound/spec-sessions SKILL.md、SessionStart hook 配置、docs/solutions/ 目录结构。
- project-scaffold 补充只读分析：`README.md`、`AGENTS.md`、`docs/guides/DEVELOPMENT_WORKFLOW.md`、`docs/workflow/README.md`、`docs/WORKFLOW_OPTIMIZATION*.md`、`.agent/project.json`、`.scale/{verification,resource-policy,workspace,skills,tools}.json`、`Makefile`、`scripts/workflow/{new-task,explore,resume,verify}.sh`、`scripts/gates/{all,G0-G22}-verify.sh`、`scripts/redlines/*.sh`、`scripts/hooks/*.sh`、`docs/workflow/templates/*.md`、`CONTEXT.md`、`docs/CONTEXT-MAP.md`、`docs/standards/common/{RESOURCE_GOVERNANCE,COLLABORATION_GOVERNANCE,DOCUMENT_STANDARDS,SECURITY_SENSITIVE_DATA,GIT_STANDARDS}.md`。
- scale-os-config-claude-code 补充只读分析：38 个文件 / 5,739 行，覆盖 `CLAUDE.md`、`INSTALL-GUIDE.md`、`README.md`、`SCALE-PROMPT.md`、`SCALE-REPORT.md`、`.claude/settings.json`、session hooks、`.agent/{project,report}.json`、`.scale/{workflow,quality-contract,skills-registry,policies}.json`、Devin shield YAML、G0-G9 gate 脚本、`scripts/workflow/verify.sh`、`scripts/validate-config.sh`、`scripts/tests/run.sh`、workflow templates 和 engineering rules。
- scale-os-config-claude-code 实测校验：`bash scripts/validate-config.sh` 退出 0；`bash scripts/tests/run.sh` 退出 1，原因是生成脚本权限为 `664`、不可执行；`bash scripts/gates/all.sh --dry-run` 打印 10 个 non-executable failure 但仍退出 0 并输出 OK，作为 dry-run 假阳性反例纳入判断。
- 行数/版本/依赖经 `wc`/`package.json`/`grep` 实测，非估算。

**未执行 / 限制**：
- 未运行 scale-engine 构建或测试（只读调研）。
- 本文结论主要来自全量结构扫描、模块级审阅和主干能力文件精读；非主干 types/util 文件用于覆盖检查、能力归类和负向判断，不作为摘取项的主证据。
- 未运行 project-scaffold 的 `make` / gate / verify 命令（只读分析）；其脚本和模板作为治理形态参考，不代表已验证可直接移植。
- 未运行 scale-os-config-claude-code 的真实 gate / verification profile（如 `scripts/workflow/verify.sh default`），因为它会执行目标项目配置命令；只运行了配置自检、生成脚本自测和 gate dry-run。
- 摘取项的实际 CommonJS 重写工作量未做 PoC；建议推进时先对 RuntimeEvidenceLedger 或 OutOfScopeStore 做最小 PoC 验证可行性。

**本文档仍属调研/brainstorm 阶段产物，描述 WHAT 与取舍，不构成已批准的实施计划。任何实际重写应走 `/spec:plan`。**
