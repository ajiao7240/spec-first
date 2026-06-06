# Spec-First：scale-engine 架构思想对标可借鉴性深度研究报告

> 元信息：日期 2026-06-05；研究对象 scale-engine（SCALE Engine 0.48.0，`/Users/kuang/xiaobu/scale-engine`）；对标基线 spec-first 角色契约 v2.0；方法 7 路并行代码深读 + 已覆盖清单去重 + 逐条对抗验证（共 41 条裁决）；本报告为 **advisory 研究输入**，不是 confirmed 实现进展，也不替代 plan。
>
> 配套阅读：本报告回答「scale 的设计**思想**哪些值得借鉴」；同目录 `2026-06-06-scale底座替换spec-first可行性研究报告.md` 回答「能否把 scale 当**运行底座**」。两者是「借鉴路线」与「替换路线」的互补视角，统一到 §五。

---

## 一、执行摘要（结论先行）

**一句话结论**：scale-engine 是一个「用系统约束 / 门禁 / 守护进程替代 Agent 自觉」的 **Agent Governance Runtime（重型 OS）**；spec-first 是「Let the LLM decide + 明确拒绝状态机」的**轻量 Harness**。两者哲学相反，因此 scale 的多数「能力」对 spec-first 是 anti-pattern；但 scale 的若干**底层设计思想**（证据驱动、advisory-not-blocking、source→runtime 生成链）与 spec-first 高度同源，值得在不破坏边界的前提下吸收。

**最关键的发现**：经过对 41 条候选设计思想的对抗去重，**绝大多数「可借鉴点」其实已被 spec-first 的 v1.11–v1.17 版本线覆盖，或属于已明确拒绝项**。真正的「未覆盖增量」只有 **2 条**，且都是低成本锦上添花，不是 80/20 核心。这本身是一个**健康信号**：说明 spec-first 已有的 scale 集成研究（父方案 + 5 篇子文档）方向正确、吸收充分，没有遗漏高价值机制。

**最值得关注的 2 条真增量**（详见 §五）：
1. **AI 失败模式分类枚举**（`failure_mode` 可选字段）→ 提升 `docs/solutions/` 召回精度，挂 Knowledge Harness。
2. **只读证据聚合视图**（read-only evidence-summary）→ 给 Evaluation Harness 一个人脸向健康视图，建议并入 v1.17。

**明确不该借鉴的**（一句话）：FSM 强状态机、G0-G22 blocking gate、Shield 退出码拦截全集、event sourcing + SQLite、外接 memory provider、Skill Radar 评分路由——这些要么是中心化引擎、要么让脚本替 LLM 做语义裁决、要么制造多真相源，全部撞 spec-first 立身之本。

**与已有研究的关系**：本报告确认 v1.11–v1.15 已落地且过 gate 的内化（dependency readiness / verification evidence / honest-closeout / governance lens / knowledge harness）是对 scale 思想的**正确且充分**的吸收，新增工作量极小。

---

## 二、两个项目的定位与哲学差异

| 维度 | scale-engine（SCALE 0.48.0） | spec-first | 启示 |
| --- | --- | --- | --- |
| 核心隐喻 | Agent Governance Runtime → AI Engineering OS | 轻量 AI Coding Harness | 一个「治理引擎」，一个「工程闭环脚手架」 |
| 对 LLM 的态度 | **用约束/门禁替代自觉**（不信任，物理阻断） | **Let the LLM decide**（信任 + advisory） | 行为本性相反 |
| 契约重量 | `.scale/*.json` 声明式状态 + 11 FSM + 23 gate + 5 hook | Light contract，44 个轻量 schema，advisory 为主 | scale 重框架，spec-first 轻合同 |
| 状态机 | workflow FSM（process.exit(2) 硬阻断） | **明确拒绝**强状态机 | spec-first 红线 |
| Gate | G0-G22 中心化 blocking | gate-lens-taxonomy 命名词表（advisory，blocking 留 v1.17 须人审） | spec-first 把 gate 降为「轻量确认点」 |
| 脚本 vs LLM | 脚本做 score 折叠 + 自动裁决 | Scripts prepare, LLM decides（脚本只产 facts + reason_code） | 边界划分的根本分歧 |
| Memory | 外接 provider（gbrain/agentmemory）+ SQLite + 衰减 | **不外接**，走 `docs/solutions/` + rg | spec-first 拒绝平行 memory platform |
| 扩展模型 | runtime-loaded dynamic registry + 第三方技能全集 | source-managed static projection（38 skills + 50+ agents） | spec-first 不做 agent collection 膨胀 |
| 失败语义 | gate fail → 硬阻断 / 自动进化注入 | honest-closeout：缺证据→degraded/unsupported（advisory honest） | scale 物理拦，spec-first 诚实标注 |
| 语言/所有权 | TypeScript ESM，外部 npm 包，独立发布节奏 | CommonJS，自有仓库，2 个运行时依赖 | 见替换报告 §所有权 |

**核心洞察**：spec-first 的 durable 差异化**不在 skills/agents 的 prose**（那是任何 harness 都能复用的 commodity），而在 **runtime 层的「行为方式」**：轻、非阻塞、advisory、preview-first、source-first、Let-the-LLM-decide。因此「借鉴 scale」的正确姿势是**借它与这套行为方式同源的底层思想**，而**不是搬它的治理引擎机制**。

---

## 三、scale-engine 架构全景（按 7 子系统）

以下每个子系统的设计思想本质 + 关键证据，来自对 scale 源码的实际深读（file:line 为 scale-engine 仓库相对路径）。

### 3.1 Cortex 进化 + 知识沉淀
**定位**：把每次失败转化为带置信度的「本能」，下次会话注入；用四级成熟路径防止未验证规则过早变阻塞 hook。
- **证据积累置信度门控**：观察事件 JSONL 按 errorPattern 计数，频次映射置信度（1→0.3 / 5→0.7 / 10→0.9）决定是否注入。`src/cortex/InstinctExtractor.ts:127-191`
- **Shadow Mode 规则渐进成熟**：规则 shadow 起步只记命中，晋升 blocking 需 hits≥10 + defectEvidence + rollback + FP率≤0.2 + 人审；HookGenerator 硬门控。`src/evolution/RuleMaturity.ts:1-123`
- **历史上下文哨兵**：注入历史摘要用 `<!-- HISTORICAL CONTEXT — DO NOT RE-EXECUTE -->` 包裹，区分「记录」与「指令」。`src/cortex/SessionInjector.ts:37-86`
- **四级进化链 Scripts-own vs Human-approve 分工**：脚本扫描聚合候选 → 人审批 → 脚本机械生成。`src/evolution/EvolutionEngine.ts:438-471`

### 3.2 核心 Workflow 引擎 + Gate + FSM
**定位**：把 AI 幻觉式合规变成基于物理约束、结构化证据、状态机顺序的可审计纪律。
- **Evidence-Grounded Task Score**：完成度由六维加权合成 + 阈值，`passed = blockers==0 AND totalScore>=threshold`。`src/workflow/TaskScoreEngine.ts:52-91`
- **Gate 软硬分层 + Evidence 持久化解耦**：23 gate 分 blocking/advisory，GateResult 持久化与决策解耦。`src/workflow/EvidenceStore.ts:25-39`
- **Task DAG 分层执行**：三类边 + pre-insertion DFS 环检测 + Kahn 算 levels 并行组。`src/workflow/TaskDependencyGraph.ts:71-301`
- **G0-G22 全量 blocking gate**：23 检查点，phase 推进必过对应 gate。`src/workflow/gates/GateSystem.ts`（**anti-pattern**）
- **强 Event Sourcing**：JSONL 事件流为真相源 + SQLite 投影 + 回放。`docs/01-ARCHITECTURE.md`（**anti-pattern**）

### 3.3 Shield + Governance + Guardrails
**定位**：把「AI 不应做的事」从 prompt 提升到机器物理约束。
- **exit 0/2 确定性阻断协议**：hook stdin JSON → stdout decision，exit 2 由平台原生阻断。「不要说服 AI 自律，让 AI 物理上做不到错的事。」`src/shield/ShieldProtocol.ts:11-147`
- **声明式策略 → hook 脚本编译**：YAML policy 编译为跨宿主 hook + policy hash 防篡改。`src/shield/PolicyCompiler.ts:14-316`
- **渐进治理模式（信号驱动升级）**：从任务文本 + 变更路径检测风险信号 → effectiveMode → requiredBehaviors。`src/governance/ProgressiveGovernance.ts:1-165`
- **FSM Guard Strict**：迁移前 guard 读 verified facts，缺字段则 exit 1。`absent verification = absent evidence = block`。`docs/TASK_GUARD_SUMMARY.md`

### 3.4 Context + AIOS Runtime + Memory
**定位**：把 context 预算、memory 召回评分、证据台账、治理模式全部编码成机器可读 JSON。
- **Context Compiler 三步剪枝**：5 类候选 → 任务信号评分 → 预算贪心选取 + omissionReason。`src/context/ContextCompiler.ts:39-93`
- **Runtime Evidence Ledger**：每次执行写 JSON + 脱敏 + final-check（passed≥1 且 failed=0 才允许声称完成）。`src/runtime/RuntimeEvidenceLedger.ts:62-96`
- **Memory Brain candidate-first**：运行时证据只进 candidate，须显式 promote + evidencePaths 才成 active。`src/memory/MemoryBrain.ts:10-80`
- **Memory Intelligence 6 信号评分 + 跨 provider 冲突检测 + 衰减**。`src/memory/MemoryIntelligence.ts:1-167`（多维冲突 **anti-pattern**）
- **ai-os plan 一次命令多维计划**：context + memory + skill + governance + ROI 合一 JSON。`src/runtime/AiOsRuntime.ts:49-182`

### 3.5 Orchestrator + 多仓 + Session
**定位**：声明式策略 + git worktree 物理隔离 + 协调循环，把多任务并行变可观察可恢复。
- **SCALE_POLICY.md YAML+Markdown 双格式声明式策略** + daemon 热重载 + last-good 回退。`src/orchestrator/PolicyLoader.ts:113-160`
- **git worktree 物理隔离 + 三条安全不变量**：path 在 root 下 + name 白名单 + cwd 在 workspace 内，防路径穿越。`src/orchestrator/WorkspaceManager.ts:35-139`
- **Session Coordinator 文件重叠检测**：倒排索引 + 文件类型/会话数加权 OverlapRisk + advisory 三级（默认 warn）。`src/workflow/SessionCoordinator.ts:52-219`
- **Workspace Topology 拓扑枚举 + 差异化 finishPolicy**：single/monorepo/polyrepo/moe，graceful 降级。`src/workflow/WorkspaceTopology.ts:77-263`
- **poll-filter-dispatch 协调循环 + 五态状态机**。`src/orchestrator/ReconciliationLoop.ts:73-226`（**anti-pattern**）

### 3.6 Skills/Agents + Routing + Tool 编排
**定位**：把「用哪个 skill/agent」从 LLM 主观猜测变成可评分、可审计、可降级的决策。
- **Skill Radar 评分路由**：任务文本 + changed files → confidence score → action 枚举。`src/skills/SkillRadar.ts`（**与 Let-the-LLM-decide 冲突**）
- **Evidence Contract 绑定**：每个 skill 推荐声明 requiredEvidence + fallback，缺证据标 unverified。`src/skills/SkillRepository.ts`
- **供应链安全扫描**：第三方 skill 安装前过静态阻断（curl|bash / 非 HTTPS / pinned）。`src/skills/SkillRepository.ts:478-493`
- **渐进式 Skill 披露**：startup 只读元数据，命中才懒加载完整 SKILL.md。`src/skills/SkillRepository.ts:25-28`
- **领导者预设四元组**：decisionRights / coachingQuestions / defaultTeam / boundaries。`src/agents/LeadershipPresets.ts`

### 3.7 Verification + Evidence + ROI + Dashboard
**定位**：用分层证据链 + ROI 度量 + 看板，让「任务已完成」从自评变成可查事实。
- **三层证据分离**：Gate / Tool / Runtime 三层独立证据，缺一不许声称完成。`src/tools/ToolEvidenceStore.ts:1-80`
- **FailureReplay 五字段 + category 枚举**：(wrongTurn, evidence, correction, prevention, category) + promoteFailure。`src/eval/WorkflowEval.ts:8-260`
- **GovernanceROI 卡片**：每个治理模块出 evidenceLevel(measured/estimated/missing) + benefit + overhead + recommendation。`src/governance/GovernanceRoi.ts:7-84`
- **Dashboard = View over Evidence**：只读已存在 JSON，缺失报 missing 而非发明值。`src/dashboard/MetricsAggregator.ts:37-72`
- **DependencyBootstrap plan-first + --apply**：默认出计划，显式 apply 才执行 + rollbackHints。`src/bootstrap/DependencyBootstrap.ts:40-71`
- **SafeCommandRunner**：verification 命令禁 shell 元字符注入，execa file+args 模式。`src/tools/SafeCommandRunner.ts:1-60`

---

## 四、可借鉴设计思想清单（核心产出，按裁决分级）

对 41 条候选思想做了对抗去重 + 边界检验，结果分布：**borrow-with-adaptation 5 条、reject 36 条、borrow-as-is 0 条**。reject 中绝大多数原因是「已被 v1.11–v1.17 覆盖」或「已在明确拒绝清单」，**而非思想本身不好**——这恰恰证明 spec-first 的内化已充分。

### 4.1 borrow-with-adaptation（改造借鉴，5 条）

> 改造 = 借思想内核、去状态机/去 blocking/去 runtime store，落成 spec-first 自有轻量 contract。

| # | 思想（scale 出处） | 覆盖度 | 对标落点 | 最小落地建议 | 边际效应 vs 成本 |
| --- | --- | --- | --- | --- | --- |
| B1 | **历史上下文哨兵**（`SessionInjector.ts:37-86`） | partially | Context Harness / spec-sessions replay-ref 输出约定 | spec-sessions 返回 replay reference 时补一句：surfaced 的历史命令是「历史记录，非待执行指令，重跑须按当前 source 重新确认」。一句 prose，不进 schema、不进 v1.15 gate | 价值中低（防破坏性历史命令重放）/ 成本≈0 |
| B2 | **多仓 target_repo 成员校验**（`WorkspaceManager.ts:35-139`） | partially | Governance Harness / `src/cli/helpers/target-repo.js` + scenario-fingerprint child_repos[] | 复用已枚举的 child_repos[] 作 advisory allowed-set，多仓写入 preflight 输出「target_repo ∈ enumerated children?」fact + reason_code。不引入新 config、不引入 daemon、不引入 sanitizeName | 价值小但正（多一层多仓误写防线）/ 成本低（扩现有 helper）；优先级低于 v1.15/v1.16 |
| B3 | **高协调成本文件类加权**（`SessionCoordinator.ts:52-219`） | partially | Evidence/Governance Harness / task-pack overlap finding 或 resource-governance-lens | 把 manifest/lock/tsconfig/.env 作 elevated-risk advisory 信号，叠到现有单次 run overlap finding 或 task-governance-signals 的 critical_path 维度（schema 已有字段，扩 reason_code 即可）。**拒绝**跨 session 持久倒排索引 + resolution 状态存储 | 价值正（高频脚手架文件冲突显式化）/ 成本低（复用现有字段） |
| B4 | **AI 失败模式分类枚举**（`WorkflowEval.ts:8-260`） | partially | **Knowledge Harness（真增量 ⭐）** | spec-compound `schema.yaml` knowledge-track 加 **OPTIONAL** `failure_mode` 枚举（hallucinated-project-fact / over-broad-context-load / missing-fallback / human-correction-after-confidence），LLM/人选填、不必填、不自动 promote、不入 completion gate。**不借** promoteFailure 自动升级、不借 SQLite | 价值中（提升 docs/solutions 召回精度 + 防同类 hallucination 复发）/ 成本低（schema 加一个可选 enum）；锦上添花非核心 |
| B5 | **只读证据聚合视图**（`MetricsAggregator.ts:37-72`） | partially | **Evaluation Harness（真增量 ⭐）** | 极轻量 read-only CLI 子命令，deterministic 聚合 git log + spec-work-run-artifact + docs/solutions 计数，缺源标 missing。**严格约束**：read-only + JSON-only + 缺源标 missing + opt-in（不进默认 runtime context）+ 指标 deterministic 可计算（不让 LLM 估值）。**不做** HTML、不做常驻 | 价值中低（人脸向健康视图）/ 做对成本低、做过成本陡升；建议并入 v1.17 与 GovernanceROI 一并评估 |

### 4.2 真增量 Top Picks（已有研究未覆盖、值得新立项的）

整个 41 条里，**唯二**未被 v1.11–v1.17 任何版本线覆盖、且通过边界检验的真增量是 **B4（失败模式枚举）** 和 **B5（证据聚合视图）**。其余 borrow-with-adaptation（B1/B2/B3）都是对已有机制的**轻量增强**，不需新版本线，可作 follow-up。

**建议**：B4 作为 v1.15 已知 follow-up（schema.yaml 加可选字段），B5 并入 v1.17（与 GovernanceROI 同批，避免单独造命令）。两者都是 P2 级，不阻塞主线。

---

## 五、与 spec-first 已有 scale 集成研究的关系

### 5.1 已覆盖（v1.11–v1.17 已吸收，不要重复造轮子）

| 版本 | 已吸收的 scale 思想 | 状态 | 对应 reject 的 scale 机制 |
| --- | --- | --- | --- |
| v1.11/v1.12 | Dependency Readiness + Doctor Consumption（含 DependencyBootstrap plan-first 思想） | 已完成 | — |
| v1.13 | Verification + Honest Closeout（= scale 三层证据分离 + RuntimeEvidenceLedger + FSM Guard absent-evidence 原则，且更干净） | 已完成 | Runtime Evidence Ledger / 三层证据 / FSM Guard |
| v1.14 | Governance Lens（task-governance-signals = ProgressiveGovernance 信号驱动；gate-lens-taxonomy = G0-G22 压缩为词表；rule-maturity = Shadow Mode 渐进成熟） | 已完成 | Evidence-Grounded Task Score / G0-G22 / ProgressiveGovernance 自动升级 |
| v1.15 | Knowledge Harness（context-bundle = Context Compiler 预算剪枝；artifact-summary = 双模式注入；verified promotion gate = Memory Brain candidate-first；recall boundary） | 计划中 | Context Compiler scoring / Memory Brain SQLite / 双模式硬上限 |
| v1.16 | Capability-aware（CodeGraph/Graphify「install 帮装、消费不耦合」） | 未开始 | Memory Provider Router（连帮装都不做） |
| v1.17 | Governance Maturity（RuleMaturity required-evidence + GovernanceROI advisory 思路） | 未开始 | — |

**结论**：scale 真正值钱的设计思想（证据驱动、advisory-not-blocking、信号驱动分级、source→runtime 生成链、置信渐进成熟、context 预算）**已被 v1.11–v1.17 系统性吸收**，且 spec-first 的实现形式（claim↔evidence 校验、reason_code、invalidation_condition、candidate_level）往往**比 scale 原版更精确、更符合 Scripts-prepare-LLM-decides**。

### 5.2 真增量（新立项候选）

只有 **B4（failure_mode 枚举）+ B5（证据聚合视图）** 两条，均为 P2 锦上添花。**没有发现需要紧急新立项的高价值缺口**——这是对已有研究质量的正面背书。

### 5.3 与替换报告（06-06）的统一

- **借鉴路线（本报告）**：把 scale 的 sound idea 落成 spec-first 自有轻量 contract，零依赖、保主权、可逆。= 替换报告里的 **Option A（OPT-D）**，是推荐主线。
- **替换路线（06-06 报告）**：把 scale 当运行底座、拆 spec-first 逻辑。= **Option C（OPT-A）**，结论是哲学上不该做、近乎不可逆。
- **统一战略**：**主线持续内化（本报告 §四的 5 条 + 已有 v1.11–v1.17）；底座替换严格关进 v2 spike，不碰主线。**

---

## 六、明确不建议借鉴的（reject + 边界理由）

| scale 机制 | 违背的 spec-first 边界 |
| --- | --- |
| **G0-G22 全量 blocking gate** | 中心化审批引擎，撞「Gate 是轻量确认点，非状态机/审批引擎」；脚本机械裁决 phase 推进违 Scripts-prepare-LLM-decides |
| **workflow FSM / FSM Guard / Effects Wiring** | 强状态机，明确拒绝；需维护 Artifact 状态 DB |
| **强 Event Sourcing（JSONL+SQLite+回放）** | infra cost 超 light contract；SQLite 作默认 truth = 多真相源 |
| **Shield exit-code hook 全集 + PolicyCompiler** | 中心化拦截引擎，撞「不复制 inline hook 全集」；blocking 与 advisory-first 冲突；拦截应由各 host 原生 hook 承担 |
| **Memory Provider Router / Memory Intelligence 多维评分** | 外接 memory 工具（已删 GBrain）；provider 内部实现泄漏成 contract；脚本越界做语义相关性判断 |
| **Skill Radar 评分路由** | 路由是 spec-first 刻意留给 LLM 的语义判断，「不 route by keyword alone」；评分函数把 advisory 硬化成 confirmed route |
| **Evidence-Grounded Task Score（复合数字）** | 脚本对「任务是否完成」下语义裁决；伪数值 confidence；v1.14 已显式丢弃 score/confidence |
| **ai-os plan mega-plan JSON** | 趋向中心 runtime plane + 第二套聚合真相源；tool DAG/evaluator gates 不在范围 |
| **协调循环 daemon + 五态状态机** | 中心化调度引擎 + 强状态机；spec-work 是单次触发非 daemon |
| **.scale/assets.json 平行 registry / Tool Policy Layer** | 平行 registry = 第二真相源；已被 managed-state + plugin manifest 覆盖 |
| **自动进化注入（InstinctExtractor/SessionInjector 闭环）** | 自动写长期记忆 + 自动注入 system 违 source-first；spec-first 走人审 promotion |

---

## 七、最小可维护落地建议（优先级排序）

> 全部遵守 preview-first / source-first；多数是对已有机制的轻量增强，不开新版本线。

- **P2-a（v1.15 follow-up）**：B4 — spec-compound `schema.yaml` knowledge-track 加 OPTIONAL `failure_mode` 枚举。验证：schema-validator 通过 + 一个 fixture。
- **P2-b（随 v1.16 多仓 work）**：B2 — target-repo.js 复用 child_repos[] 输出 allowed-set advisory fact。验证：target-repo 单测 + multi-repo fixture。
- **P2-c（v1.14/v1.17 governance lens 增量）**：B3 — 高协调成本文件类加权叠到现有 overlap finding / critical_path。验证：task-pack 单测扩 reason_code。
- **P2-d（v1.17，与 GovernanceROI 同批）**：B5 — read-only evidence-summary 子命令。验证：deterministic 聚合源 + 缺源标 missing 的契约测试。
- **P3（轻量收尾）**：B1 — spec-sessions replay-ref 加「历史记录非待执行指令」框定句。验证：fresh-source eval。

**注意**：以上**没有 P0/P1**——因为高价值 scale 思想已在 v1.11–v1.17 主线。这些都是补充，不应抢占主线资源。

---

## 八、风险与反模式（执行本报告建议时的护栏）

1. **过度泛化为「借一切」**：本报告确认 36/41 条该 reject。不要因为「这是 scale 的成熟机制」就反向冲动引入——成熟≠适合 spec-first 哲学。
2. **状态机蔓延**：任何 borrow-with-adaptation 若演化出 blocking 语义或持久状态机，立即触发哲学评审（尤其 B3 不可滑向跨 session coordinator、B5 不可滑向常驻 dashboard）。
3. **多真相源**：B4/B5 必须复用既有 schema/facts，不新建第二套 store（scale 大量机制 reject 的核心原因正是多真相源）。
4. **advisory 当 confirmed**：任何从 scale 借来的 facts 形态都必须保持 advisory，回源到权威 source，不让 LLM 自评打分（Self-RAG 教训）。
5. **contract sprawl**：44 个 contract 已不算少，每个新增（含 B4/B5）必须有 named workflow consumer（无消费方=不交付）。

---

## 附录：证据索引（按子系统）

- **Cortex/进化**：`src/cortex/InstinctExtractor.ts`、`src/cortex/SessionInjector.ts`、`src/evolution/RuleMaturity.ts`、`src/evolution/EvolutionEngine.ts`、`docs/CORTEX.md`、`docs/EVOLUTION_SHADOW_MODE.md`
- **Workflow/Gate/FSM**：`src/workflow/TaskScoreEngine.ts`、`src/workflow/EvidenceStore.ts`、`src/workflow/TaskDependencyGraph.ts`、`src/workflow/gates/GateSystem.ts`、`src/fsm/FSMAgentBridge.ts`、`docs/workflow/GATES_AND_SCORE.md`
- **Shield/Governance**：`src/shield/ShieldProtocol.ts`、`src/shield/PolicyCompiler.ts`、`src/governance/ProgressiveGovernance.ts`、`docs/SHIELD.md`、`docs/TASK_GUARD_SUMMARY.md`
- **Context/AIOS/Memory**：`src/context/ContextCompiler.ts`、`src/runtime/RuntimeEvidenceLedger.ts`、`src/runtime/AiOsRuntime.ts`、`src/memory/MemoryBrain.ts`、`src/memory/MemoryIntelligence.ts`、`docs/AI_ENGINEERING_OS_POSITIONING.md`、`docs/CONTEXT_BUDGET.md`
- **Orchestrator/多仓/Session**：`src/orchestrator/PolicyLoader.ts`、`src/orchestrator/WorkspaceManager.ts`、`src/orchestrator/ReconciliationLoop.ts`、`src/workflow/SessionCoordinator.ts`、`src/workflow/WorkspaceTopology.ts`、`docs/ORCHESTRATOR.md`
- **Skills/Agents/Routing**：`src/skills/SkillRadar.ts`、`src/skills/SkillRepository.ts`、`src/skills/RoleSkills.ts`、`src/agents/LeadershipPresets.ts`、`docs/SKILL_RADAR.md`、`docs/TOOL_ORCHESTRATION.md`
- **Verification/Evidence/ROI**：`src/tools/ToolEvidenceStore.ts`、`src/eval/WorkflowEval.ts`、`src/governance/GovernanceRoi.ts`、`src/dashboard/MetricsAggregator.ts`、`src/bootstrap/DependencyBootstrap.ts`、`src/tools/SafeCommandRunner.ts`
- **spec-first 对标基线**：`docs/10-prompt/结构化项目角色契约.md`、`docs/01-需求分析/13.scale集成/README.md`（v1.11–v1.17 版本线）

> 说明：scale-engine file:line 由并行深读 agent 读取当时源码取证；spec-first 覆盖度由「已覆盖清单」agent 对照 v1.11–v1.17 plan 与 contracts 核对。本报告为 advisory，落地前请以 plan 阶段的再次取证为准。
