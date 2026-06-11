---
title: "feat: v1.17 Governance Maturity 整版（规则自进化闭环 + governance ROI + resource hardening）"
type: feat
status: active
date: 2026-06-10
spec_id: 2026-06-10-001-rule-maturity-shadow-producer
implements_schemas:
  - docs/contracts/governance/rule-maturity.schema.json
  - docs/contracts/governance/resource-governance-lens.schema.json
---

# feat: v1.17 Governance Maturity 整版（规则自进化闭环 + governance ROI + resource hardening）

## Summary

v1.17 是 spec-first「自我进化」支柱的规则轮：知识轮（docs/solutions 沉淀→检索）已闭环，规则轮（观测→裁决→晋升→毕业→退役）由本计划闭合。整版分四个 phase 交付：phase 1 为 `rule-maturity.v1` 接上唯一 producer（record/list），让 governance lens 命中的 shadow 观测先流动起来；phase 2 落地人审裁决（误报/真缺陷署名记录）、晋升就绪报告与跨机证据汇聚；phase 3 钉死 spec-first 原生的 blocking 语义——规则毕业为 `npm test` 主链路的确定性 contract test/lint gate（不是 runtime hook），并补上退役/降级路径（构建是为了删除）；phase 4 交付 governance ROI 确定性漏斗聚合与 resource/output governance 的父方案 §4.8 缺口收口。全程无自动晋升、无 daemon、无 runtime hook：脚本记录事实与阈值对照，stage 变更只经人审署名。

---

## Problem Frame

SCALE 集成路线（`docs/01-需求分析/13.scale-integration/README.md`）中 v1.11–v1.16 已全部完成，v1.17 Governance Maturity 是唯一未开始的版本。但路线自己钉死了硬前置：RuleMaturity 的 required-evidence / blocking 候选需要 v1.14 foundation「先运行、沉淀误报证据 + 人审」（父方案 §4.7）。

现状是 `rule-maturity.v1` 自 v1.14 起为有意的 schema/docs-only shadow 例外：无 producer、无 helper、仓库内没有任何 `shadow_hits` 观测记录落盘。promotion 所需的证据集是空集。直接实现 promotion/blocking 会违反路线验收口径；正确的第一步是建立最小证据生产链路，再沿证据逐 phase 推进到裁决、晋升与毕业。

全局定位：spec-first 的产品三支柱是「0-1/1-100 需求交付、团队大规模协作、自我进化」。自我进化有两个轮子——知识轮（解决过的问题沉淀进 docs/solutions、下次自动检索，已闭环）和规则轮（踩过的坑固化为可升级、可退役的治理规则，当前断裂）。v1.17 补的就是规则轮，让「重复的问题不会重复犯错」从靠 LLM 记性变成靠治理机制。harness 工程化实践（`docs/01-需求分析/14.harness-engineering/`）给出三条直接输入：每条规则都是一次事故的墓志铭（规则的诞生源头是真实 hit，不是凭空设计）；验证反馈质量决定 agent 可靠性（arxiv 2605.29682：验证反馈 R²=0.94 vs token 预算 R²=0.33——规则的毕业形态应是确定性 gate）；构建是为了删除（每条晋升规则必须带退役路径，否则 harness 越积越厚反成负担）。同时按 OPT-D 裁决过滤掉 harness 文档中与 spec-first 哲学冲突的建议：不引入 dispatcher 状态机、不建 G0-G22 式 runtime 门禁墙、不做 runtime hook 拦截——spec-first 的 blocking 落点是 contract test 进 CI，这正是仓库既有实践（`governance-contracts.test.js` 的断言本质上就是毕业规则）的正式化。

---

## Requirements

**Phase 1（shadow 观测 producer）：**

- R1. 存在唯一可追溯的 shadow-hits producer：`spec-first internal rule-maturity record`，每次调用向目标 rule 的 `shadow_hits` 追加一条 hit（`observed_at` / `workflow` / `evidence_ref` / `reason_code`），整条 rule record 写盘后符合 `rule-maturity.v1` schema。（术语约定：本计划中「rule record」指 schema 顶层对象，「hit」指 `shadow_hits` 数组中的一条观测，`record` 单指 CLI 子动作。）
- R2. producer 侧 stage 不可达 reserved stages：phase 1 `record` 不提供 stage 参数、固定写 `shadow`；任何 stage 变更（含 `advisory`）均不经 `record` 发生，留给 phase 2 promotion 工具。
- R3. 存在 deterministic 读取面：`spec-first internal rule-maturity list --json` 输出逐 rule 的 stage、shadow_hits 计数与 evidence refs 汇总。
- R4. 至少一个真实 consumer 消费读取面：`spec-skill-audit` 将 rule-maturity 观测汇总纳入其确定性事实 artifact（同 `reviewer-guard-coverage-report.json` 模式），满足父方案 §9.0.1「无消费方 = 不交付」。
- R5. 至少两个 workflow 的 SKILL prose 在 governance lens 命中时显式引导记录 shadow hit：`spec-plan`（task-governance-signals 之后）与 `spec-code-review`（resource-governance-lens advisory 之后）。职责定位明确：lens helper 保持只读、只返回 facts；SKILL prose 含调用 `rule-maturity record` 的程序性引导；是否记录由 LLM 按引导判断后显式调用。
- R6. 落盘路径、gitignore 策略、context-governance 读取边界明确登记，evidence 文件不被当作普通 source context 扫描。
- R7. 现有治理断言有意识翻转/保留：`governance-contracts.test.js` 中「internal.js 不含 rule-maturity subcommand」断言翻转为正向注册断言；「producers 不出现 reserved stage 字面量」断言保留并扩展覆盖新 producer 的写入路径。
- R8. 文档同步：`rule-maturity.md` 合同登记 producer/consumer 现状，SCALE README v1.17 行进展更新（plan 写入仓库→「计划中」；实现合入且测试通过→「进行中（phase 1 shadow producer 已落地）」），CHANGELOG 按仓库格式记录。

**Phase 2（人审裁决与晋升就绪）：**

- R9. 存在唯一裁决记录入口：`rule-maturity adjudicate` 把指定 shadow hit 裁决为误报或真缺陷，写入 schema 既有 `false_positive_refs` / `defect_evidence_refs`；必须带人审署名（`--decided-by`）与 durable 裁决依据 ref；署名持久化在 ref 指向的 repo 内 prose 裁决记录中（`rule-maturity.v1` schema 顶层 `additionalProperties:false` 且 refs items 为纯字符串，不承载署名字段——与 R11 promotion 审批记录同构）；裁决语义判断归人/评审，脚本只做结构记录与 ref 存在性校验。
- R10. 存在晋升就绪只读报告：`rule-maturity report` 输出逐 rule 的 deterministic 就绪事实与 `readiness_blockers[]`（hits 计数对照阈值、误报率、defect 证据数、rollback 在场性）；阈值为 advisory 默认值（借上游 RuleMaturity.ts 实测口径：min_shadow_hits=10、min_defect_evidence=1、max_false_positive_rate=0.2、rollback 必在场）且可配置覆盖；报告不输出「应当晋升」结论。
- R11. stage 变更只经人审：`rule-maturity promote|demote` 要求署名 + repo 内 prose 审批记录 artifact（含证据 refs、rollback 策略、`invalidation_condition` 必填）；晋升到 required-evidence/blocking 额外要求 R10 报告 blockers 为空；不存在任何自动晋升路径；审批记录以 ref 进 `evidence_refs`，schema 不 bump。
- R12. 跨机证据汇聚最小面：`rule-maturity merge` 按 rule_id 合并多机导出的 shadow_hits 与裁决（按 `observed_at`+`evidence_ref` 去重），支撑团队级 promotion 评审样本。

**Phase 3（毕业与退役）：**

- R13. blocking 语义钉死为「毕业为确定性 gate」：stage=blocking 的规则必须有 `evidence_refs` 指向 `npm test` 主链路中的 contract test 或 lint 脚本；不引入 runtime hook / pre-commit 拦截；`report` 对 blocking 规则校验毕业 test ref 在场。
- R14. 退役/降级路径常驻：晋升记录的 `invalidation_condition` 由周期复查消费；`report` 输出 decay 信号事实（如 blocking 规则长期零 hit、晋升后新增误报）；降级/退役经 `demote` 人审路径执行，毕业测试随退役删除。

**Phase 4（governance ROI 与 resource hardening）：**

- R15. governance ROI 为确定性聚合 facts：治理漏斗（observed→adjudicated→promoted→graduated）计数与时间窗对比 delta，零 LLM 调用、零虚构常数（不引入上游 GovernanceMetrics 的 15%/10% 节省估算与 ROI Score baseline）、无数据支撑的指标不出现在报告中；**漏斗必输出 decay 事实**：blocking 规则总数趋势（本期 vs 前期）与每条 blocking 规则的最近命中时间是必输出 deterministic facts，不是可选项——治理面只增不减是上游已被证实的结构性缺陷，ROI 报告必须让「规则在变多还是在被删除」可直接读出；消费者为 skill-audit artifact 与 promotion 人审。
- R16. resource/output governance 按父方案 §4.8 全范围收口：补 screenshots/媒体产物 staged 检测、coverage/playwright-report 提交策略 advisory、raw log retention 与 redaction status 字段、policy 输出补 owners/modules；schema bump `resource-governance-lens.v2` 并带版本说明与 downstream consumer tests。
- R17. resource lens 消费接通两个已核实空置点：spec-work PR handoff（git-commit-push-pr 上下文清单注入 lens advisory）与 spec-code-review project-standards reviewer（lens items 进入其输入）；spec-release-notes 不接入（只读检索型 workflow、无 staging 环节，决策记录在案）。

---

## Assumptions

- A1. phase 1 的 rule_id 由调用方（workflow LLM）显式传入，**命名约定锚定 `gate-lens-taxonomy.v1` 的 7 个 canonical lens family 作前缀**（`preflight|exploration|planning|execution|verification|review|summary`，如 `planning-depth-underclassified`、`summary-generated-output`），复用既有治理词表缓解 rule_id 碎片化；前缀约定写入 U3 prose 与 U5 的 `rule-maturity.md`，脚本只校验非空与长度、不强制前缀（advisory 约定，不是 schema 约束）。独立注册表是 phase 2 的候选工作，等真实 rule_id 积累后再判断是否需要。
- A2. phase 1 shadow-hits 证据以本机累积（gitignored local file）。spec-first 面向团队协作，**跨机证据导出/汇聚是 phase 2 的确定工作项**（promotion 人审需要全团队样本），不是按需可选项；phase 1 的存储格式已具备可合并性——按 `rule_id` upsert 的 rule record 数组天然支持跨机按 rule_id 合并 `shadow_hits`，实现时不得引入破坏可合并性的结构（如本机自增主键）。

---

## Scope Boundaries

本计划覆盖 v1.17 整版（README v1.17 行三件事全部在内），按 phase 1→4 顺序交付。整版 non-goals（任何 phase 都不做）：

- **不做自动晋升 / promotion 状态机**：stage 变更只经人审署名路径（`promote|demote`）；`report` 只产 deterministic 就绪事实，不输出「应当晋升」结论。OPT-D 裁决与 self-reflection「advisory fields, not a central state machine」先例双重背书。
- **不做 runtime hook / pre-commit 拦截 / 门禁墙**：拒绝上游 HookGenerator 的 bash hook `exit 2` 模式与 harness 文档的 G1-G8 门禁墙建议——blocking 的 spec-first 原生落点是 contract test 进 `npm test` 主链路（fail-closed 且确定性，但在 CI/测试边界而非 runtime 边界）。
- **不做 daemon/watcher 式自动观测与自动注入**：shadow hit 是 workflow 显式记录的离散观测（合同原文：not daemon counters）；拒绝上游 EvolutionEngine.runCycle 的自动扫描提议与 Cortex SessionStart 注入闭环（父方案 §non-goal 已裁决）。
- **不做数值健康分 / ROI Score**：拒绝上游 GovernanceMetrics 的虚构常数（15%/10% 节省、50 分 baseline、5min/fix）；ROI 报告只含可验证计数与 delta（brooks-lint 否决先例同构）。
- 不让 `task-governance-signals` / `resource-governance-lens` 两个只读 lens helper 带写盘副作用（phase 4 的 resource lens v2 扩展输出字段，仍保持只读）。
- 不新增公开 workflow 入口、不新增 skill；全部能力经 internal helper + 既有 workflow prose 接入。
- 不接入 doctor rollup；doctor 只消费 setup facts，治理证据消费面是 skill-audit 与 promotion 人审。
- 不引入 dispatcher 状态机 / 薄主会话架构（harness 文档 P0-1 建议与 spec-first「不强状态机」哲学冲突，OPT-D 裁决覆盖）。

### Deferred to Follow-Up Work

- rule_id 注册表 / canonical rule 词表：等真实 rule_id 出现重复与歧义后再评估（phase 1 用 lens-family 前缀约定缓解）。
- spec-work closeout 接入 shadow 记录：phase 1 先验证 plan/code-review 两个接入点，work closeout 已有 honest-closeout 链路，叠加点位在 phase 2 启动时按零记录复查结果裁定。
- harness 衰减审计（定期关组件对比质量）：「构建是为了删除」已通过 R14 退役路径承载最小语义；组件级 A/B 衰减审计是独立的 optimize 实验课题，走 `/spec:optimize`。
- 评测平台 / 上下文预算管理等 harness 文档其余建议：与 v1.17 无强依赖，另行走 ideate/brainstorm 裁定。

---

## Completion Criteria

**Phase 1 完成判据：**

- **§9.0.1 交付等级登记（与 v1.11/v1.12 先例同构）**：phase 1 满足三级 gate 的前两级——contract test（U1/U6）+ direct deterministic consumer（U4 skill-audit）；第三级「named workflow 可观察行为变化」的兑现点是 phase 2 的 promotion review 消费。在此之前，shadow 观测能力整体标 **advisory**，任何文档不得宣称已兑现 workflow 治理价值（同 CON-PROV-001 的 enabling infra 口径）。
- `spec-first internal rule-maturity record|list` 可运行且通过 focused unit tests。
- `spec-skill-audit` 的 audit artifact 中出现 rule-maturity 汇总事实（fixture 测试守住）。
- `skills/spec-plan/SKILL.md` 与 `skills/spec-code-review/SKILL.md` 含显式记录引导，对应 doc contract tests 通过。
- `governance-contracts.test.js` 断言翻转后 `npm run test:unit` 通过。
- `rule-maturity.md`、SCALE README v1.17 行、CHANGELOG 已同步。

**Phase gate（phase 间推进条件）：**

- phase 1 → phase 2：phase 1 合入后真实运行 2 周复查点通过（`rule-maturity list` 非零记录；零记录则先按 U3 风险表评估更强接线再进入 phase 2）。复查同时登记观测密度事实（条/周、覆盖的 rule_id 数），作为 phase 2 阈值校准（U8 advisory 阈值）的首份真实输入——上游 min_shadow_hits=10 假设的是 daemon 级观测密度，spec-first 的低频显式记录可能需要完全不同的阈值量级。
- phase 2 → phase 3：至少 1 条 rule 经 `adjudicate` 积累了人审裁决记录且 `report` 能输出非空就绪事实（毕业机制要有真实候选才有验收对象）。
- phase 3 与 phase 4 无相互依赖，phase 4 可与 phase 2/3 并行（resource hardening 与 ROI 聚合不依赖 promotion 链路）。

**整版完成判据：**

- 全部 R1–R17 落地且 `npm test` 主链路通过；至少 1 条规则走完 shadow→裁决→晋升的完整人审路径（毕业到 blocking 不是整版完成的硬条件——有没有规则值得毕业由证据决定，机制在场即可）。
- SCALE README v1.17 行进展时点：本 plan 写入→「计划中」；phase 1 合入→「进行中（phase 1 shadow producer 已落地）」；R1–R17 全部落地→「已完成」。中间任何时点不得提前标「已完成」。

---

## Direct Evidence

- repo_scope: spec-first 单仓（target_repo: 当前仓库）
- source_reads_completed:
  - `docs/contracts/governance/rule-maturity.md` + `rule-maturity.schema.json`（schema 全文）
  - `tests/unit/governance-contracts.test.js`（全文：含「无 producer」反向断言与 reserved-stage 字面量守卫）
  - `src/cli/commands/internal.js`（subcommand dispatch 全貌）
  - `src/cli/helpers/resource-governance-lens.js`（前 80 行：runCli/parseArgs/schema 校验模式）
  - `docs/01-需求分析/13.scale-integration/spec-first内化集成scale-project-scaffold技术方案.md` §4.6–4.7
  - `docs/contracts/context-governance.md`（`.spec-first/**` 读取边界条目）
  - `.gitignore`（`.spec-first/` 现行 ignore 清单；`governance/` 子目录当前未被 ignore）
  - `skills/spec-plan/SKILL.md` / `skills/spec-code-review/SKILL.md` 中 lens 消费段落
- source_reads_required（实现时）:
  - `skills/spec-skill-audit/scripts/write-audit-artifacts.js` 与 `collect-skill-facts.js`（reviewer-guard-coverage-report 的 writer 模式细节）
  - `src/cli/helpers/task-governance-signals.js` 全文（CLI arg 解析复用）
  - `src/cli/bootstrap` 中 `.gitignore` managed block 的生成位置
- commands_or_tools_used: `rg`/grep、`spec-first internal task-governance-signals`（depth 分级实测）、`spec-learnings-researcher` agent（5 篇 learning 命中）、4 路并行深读 agent（上游源码 + resource 缺口 + promotion 先例实测）
- 整版扩展时新增 source_reads_completed:
  - `scale-engine/src/evolution/RuleMaturity.ts` 全文（123 行）+ `EvolutionEngine.ts`/`GovernanceMetrics.ts`/`EvolutionEvaluator.ts` 关键面（上游阈值、署名晋升、hook 阻断、虚构常数均为实测）
  - `src/cli/helpers/resource-governance-lens.js` 全文 vs 父方案 §4.8 逐项对照（7 项缺口清单，含「合同字段都没有 / producer 部分实现 / 有 producer 无消费」三类定级）
  - `skills/spec-work/references/shipping-workflow.md`（closeout 已消费 lens：L124/L134/L137；PR handoff 清单 L179-185 未含 lens——R17 接入点）
  - `docs/contracts/workflows/self-reflection-capability-upgrade.md` + `skills/spec-compound/SKILL.md` promote gate + `knowledge-harness.md` L6（人审 promotion 三先例，U9 的 prose-artifact 决策依据）
  - `docs/01-需求分析/14.harness-engineering/harness-engineering-x-spec-first-analysis.md` + `harness-discipline-deep-analysis.md` 全文（三条输入 + OPT-D 过滤清单）
- impact_on_plan: governance 测试的反向断言决定了 U6 必须与 U1 同切片落地；gitignore 现状决定了 U2 的存在；上游「无 demotion」缺陷决定了 R14 的存在；resource 缺口实测决定了 U12/U13 的范围与 spec-release-notes 不接入决策
- key_findings: 见 Context & Research
- limitations: 未读 `spec-skill-audit` writer 脚本全文，U4/U11 接线细节按实现时证据微调；上游 RuleMaturity 阈值在本仓的适配性无先验数据，phase 2 校准

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/helpers/resource-governance-lens.js` — internal helper 的标准结构：`runCli(argv)` 返回 exit code、`parseArgs` 收集 errors、输出前 `validateAgainstSchema` 自校验、`writeJson` 统一输出。新 helper 完全照此模式。
- `src/cli/commands/internal.js` — subcommand 注册点：require helper 的 `runCli` 并加一个 `if (subcommand === 'rule-maturity')` 分支。
- `src/contracts/schema-validator.js` — 已有 `validateAgainstSchema`，record 写入前对整条 record 校验。
- `skills/spec-skill-audit/scripts/write-audit-artifacts.js` — `reviewer-guard-coverage-report.json` 的确定性事实 artifact 先例，U4 消费面模仿该模式。
- `.spec-first/config/tool-facts.json` 的生产/消费链 — 「generated local facts + 单一 writer + doctor 消费」是 phase 1 producer→consumer 形态的最近参照。

### 上游参考实现实测（借思想、不引代码，OPT-D 口径）

- `scale-engine/src/evolution/RuleMaturity.ts`（123 行纯函数）：三段 stage（shadow→candidate-hook→approved-blocking）；晋升条件 = 计数阈值 + 证据 + rollback 在场 + 误报率，`DEFAULT_THRESHOLDS`：minShadowHits=10、minDefectEvidence=1、maxFalsePositiveRate=0.2；`approveRuleMaturity` 人工署名 + 晋升前重验；`evaluateRulePromotion` 返回可读 `blockers[]`。**可借鉴**：人审署名、晋升前重验、blockers 报告形态、rollback 硬前置。**拒绝**：纯内存存储（无持久化）、HookGenerator 自动生成 bash hook `exit 2` 阻断、EvolutionEngine.runCycle 自动扫描提议。无 demotion 转换是其缺陷——spec-first 补上（R14）。
- `scale-engine/src/cortex/GovernanceMetrics.ts`：漏斗计数（proposed→validated→approved→enforced）与时间窗 delta 可借鉴为纯文件聚合；**拒绝**其虚构常数（15%/10% 节省估算、ROI Score 50 分 baseline、5min/fix）与占位指标（instinctHitRateDelta 恒 0 仍进报告）。
- 上游误报标记是 `recordShadowHit(…, {falsePositive})` 记录时顺手传——spec-first 改为记录与裁决分离（U7），因为「是否误报」是语义判断，须经人审署名，不能混进机械观测。

### Harness 工程化输入（docs/01-需求分析/14.harness-engineering/）

- 「每条规则都是一次事故的墓志铭」：规则的合法来源是真实 hit/事故，不是凭空设计——backing R9 裁决链路与 U10 的 compound 接通（verified learning → rule 候选）。
- arxiv 2605.29682（验证反馈质量 R²=0.94 vs token 预算 R²=0.33）：决定 agent 可靠性的是「检查做得多好」——backing R13 毕业形态为确定性 contract test。
- 「构建是为了删除」/ Harness 衰减：每条晋升规则必须带退役路径，否则 harness 越积越厚——backing R14 demote/decay 信号；invalidation_condition 必填进审批记录。
- 同时按 OPT-D 过滤其建议：dispatcher 状态机、G1-G8 runtime 门禁墙、hook 拦截、≤8K 上下文预算管理均不进 v1.17（前两者与「不强状态机、advisory-first」哲学正面冲突；后者是独立课题）。

### Institutional Learnings

- `docs/solutions/architecture-patterns/ai-reviewer-capability-borrowing-gates-2026-06-09.md` — 无确定性证据时 LLM 评分≈随机；shadow_hits 只记可回查事实，不带评分/promote 建议。
- `docs/solutions/workflow-issues/database-routing-and-dual-view-refresh-boundaries-2026-04-20.md` — 新 artifact 合同收口五件套（schema + writer + 读取面 + unit tests + 必要 integration）；明确逐条 hit 记录是主真源，聚合计数只是 projection。
- `docs/solutions/workflow-issues/self-reflection-cud-contract-loop-2026-05-05.md` — 「advisory fields, not a central state machine；证据流动后再升级」，直接背书 phase 1 切法。
- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md` — evidence artifact 不覆盖 `docs/contracts/**` 行为契约；产物错了先查 producer。
- `docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md` — internal helper 不登记为 workflow_command、不建 command template。

### External References

- 无需外部研究：仓库内已有三个同构 internal helper 先例与完整 contract test 模式，phase 1 是成熟局部模式的复用（Phase 1.2 决策：跳过外部研究）。phase 2–4 的上游参考（RuleMaturity.ts / GovernanceMetrics.ts）与 harness 工程化输入已在前两节实测登记。

---

## High-Level Technical Design

> *以下为方向性示意，供评审校验整体形状，不是实现规范。实现以各 Implementation Unit 为准。*

规则轮全生命周期（与知识轮的接通点在 compound）：

```text
                     ┌──────────────── 知识轮（已闭环）────────────────┐
                     │  问题解决 → spec-compound → docs/solutions      │
                     │                   │ (U10: verified learning     │
                     │                   ▼  可提示为 rule 候选)        │
                     └───────────────────┼─────────────────────────────┘
                                         │
  ┌─────────────────── 规则轮（v1.17 闭合）▼─────────────────────────────┐
  │                                                                      │
  │  Phase 1            Phase 2                Phase 3                   │
  │  ┌────────┐  人审   ┌──────────┐   人审    ┌──────────────┐          │
  │  │ shadow │ ──────▶ │ advisory │ ────────▶ │ req-evidence │          │
  │  │ 观测   │ promote │          │  promote  │  /blocking   │          │
  │  └────────┘ (署名+  └──────────┘ (R10 就绪 └──────────────┘          │
  │     ▲       审批ref)     ▲       blockers       │ 毕业 =             │
  │     │record             │        为空)          │ contract test      │
  │  workflow lens 命中     │adjudicate             │ 进 npm test        │
  │  (spec-plan/            │(误报/真缺陷,          ▼                    │
  │   code-review prose)    │ 人审署名)        ┌────────┐               │
  │                         │                  │ 退役   │◀── decay 信号  │
  │  merge(跨机汇聚) ───────┘                  │ demote │    (R14,人审)  │
  │                                            └────────┘               │
  │  Phase 4: report --funnel（observed→adjudicated→promoted→graduated  │
  │           漏斗计数 + 时间窗 delta，零虚构常数）→ skill-audit 消费    │
  └──────────────────────────────────────────────────────────────────────┘

  全程不变量：stage 变更只经人审署名命令；脚本只产 facts/blockers；
  blocking 执行体 = CI contract test（无 runtime hook）；降级永远可达。
```

---

## Key Technical Decisions

- **独立 `rule-maturity` 子命令作为唯一 writer，而非 lens helper 内嵌写盘**：保持 `task-governance-signals` / `resource-governance-lens` 纯只读合同不变；记录动作是 LLM 在 lens 命中后的显式判断（「Scripts prepare, LLM decides」——是否构成值得观测的 hit 是语义判断），单一 writer 满足可追溯性 learning。（用户已确认）
- **最小 consumer 选 `spec-skill-audit` 而非 doctor**：skill-audit 已有「读取确定性事实 artifact 进 audit 报告」的同构先例（reviewer-guard-coverage-report），消费语义贴合（治理证据 → 资产审计）；doctor 扩边界的成本与收益不匹配。（用户已确认采纳推荐）
- **落盘路径 `.spec-first/governance/rule-maturity.json`，gitignored**：与 `.spec-first/config/*.json` 等 generated local facts 同策略。shadow 观测是本机 workflow 运行的离散记录，提交进 git 会产生持续 commit 噪声且诱发「为绿而改」；promotion review（phase 2）需要跨机共享时再设计导出面。需同步 `.gitignore` 与 `spec-first init` managed block。
- **存储形态：单文件、按 `rule_id` upsert 的 rule record 数组**：每条 rule record 是完整 `rule-maturity.v1` 对象，`record` 子动作对已存在的 rule_id 追加 hit、对新 rule_id 创建 stage=shadow 的初始 rule record。逐 hit 明细是主真源；`list` 的计数是 projection，不替代明细。
- **phase 1 stage 固定 shadow、record 无 stage 参数**：所有计划内调用方只产 shadow 观测；不提供 `--stage` 即从 CLI 面根除 reserved-stage 与隐式 shadow→advisory 迁移路径（评审发现：开放 `advisory` 入参等于无人审的后门 stage 变更，且 phase 1 无任何 advisory 调用方）。stage 变更整体归 phase 2 的 `promote|demote` 人审路径（U9）。这把 v1.14 的「schema 允许、source 不产」边界升级为「schema 允许、producer 不可达」，并被 contract test 守住。
- **blocking 的执行体是 contract test 进 `npm test`，不是 runtime hook**：上游用 HookGenerator 生成 bash hook `exit 2` 在工具调用边界阻断；spec-first 的确定性边界在 CI/测试（仓库既有实践：`governance-contracts.test.js` 的断言本质就是毕业规则）。fail-closed 语义保留（测试红了就是阻断），但阻断点从 runtime 移到验证链路——与「advisory-first、不强状态机」哲学一致，且毕业测试天然带退役路径（删测试 = 退役，git 可审计）。arxiv 2605.29682 的「验证反馈质量决定可靠性」为此背书。
- **promotion 审计轨迹走 prose artifact + ref，schema 不 bump v2**：审批记录（证据、rollback、invalidation_condition、署名）是 prose 文档，以 ref 进既有 `evidence_refs`；与 knowledge-harness L6「prose-enforced gate、不加第二套 validator」先例一致。仅当未来出现 machine-readable stage_history 的真实消费者时再评估 v2。
- **裁决与观测分离**：上游在 recordShadowHit 时顺手传 falsePositive；spec-first 拆成 record（机械观测，workflow 即时）与 adjudicate（语义裁决，人审事后署名）两个动作——两轴分离原则的直接应用，也让误报证据天然带裁决人与依据。
- **ROI 报告零虚构常数**：只输出可从 evidence 文件复算的计数与 delta；拒绝上游的节省估算/ROI Score/占位指标。「可验证事实优先于模型猜测」。

---

## Open Questions

### Resolved During Planning

- producer 形态（独立子命令 vs lens 内嵌）：独立子命令，用户确认。
- 最小 consumer 位置（skill-audit vs doctor vs compound）：skill-audit，用户确认采纳推荐。
- 落盘是否 git 提交：gitignored local，理由见 Key Technical Decisions（A2 标注为假设，用户可在评审时推翻）。

### Deferred to Implementation

- `record` 的 CLI 参数面细节（逐参数 vs `--input` JSON 文件）：实现时按 `task-governance-signals --input` 既有模式定，倾向支持两者中维护成本更低的一种。
- skill-audit 接线的确切函数位置与读取方式：现有 audit 脚本无 subprocess 先例且只以 repoRoot 为读根，倾向在 `collect-skill-facts.js` 新增 `collectRuleMaturityObservations(repoRoot)` 直读 evidence 文件（路径从 repoRoot 解析 `.spec-first/governance/`），不引入 child_process；最终按 `write-audit-artifacts.js` 实际结构定。
- `list` projection 字段与 U4 消费的契合度：若实现中发现 audit 需要的字段超出 list projection，优先扩 projection 而非让 audit 直读绕过。

---

## Implementation Units

### U1. rule-maturity internal helper（record/list） — phase 1

**Goal:** 实现唯一 writer 与 deterministic 读取面。

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Create: `src/cli/helpers/rule-maturity.js`
- Modify: `src/cli/commands/internal.js`
- Test: `tests/unit/rule-maturity.test.js`

**Approach:**
- `runCli(argv)` 模式照搬 `resource-governance-lens.js`：parseArgs → 执行 → schema 自校验 → writeJson → exit code。
- `record` 子动作：必填 `--rule-id`、`--workflow`、`--evidence-ref`、`--reason-code`，可选 `--repo` 解析目标仓根。`observed_at` 由脚本取当前时间写入。写入前对整条 record 跑 `validateAgainstSchema(rule-maturity.schema.json)`；写入失败（目录不可写、JSON 损坏）返回结构化错误而非半写。
- **phase 1 stage 固定为 `shadow`，`record` 不提供 `--stage` 参数**：所有计划内调用方（U3 两个 workflow）只产 shadow 观测；stage 经 `record` 不可变更，避免开出无人消费的 advisory 后门或隐式 stage 迁移路径。advisory 及以上的 stage 变更属 phase 2 promotion 工具的职责。
- **初始 record 的 schema 必填字段填充规则（钉死，避免实现时即兴决定）**：新 rule_id 首次 record 时，`defect_evidence_refs: []`、`false_positive_refs: []`（留待 phase 2 人审填写，本 producer 永不写入）、`rollback: { available: true, notes: "shadow observation only; nothing to roll back" }`（措辞明确这不是经人审的 rollback 策略）、顶层 `evidence_refs` 为各 shadow_hits `evidence_ref` 的去重投影（追加 hit 时同步更新）、顶层 `reason_code` 固定为 `shadow-observation`（与逐 hit 的 reason_code 区分：顶层描述 record 性质，逐 hit 描述命中原因）。
- `list` 子动作：读 `.spec-first/governance/rule-maturity.json`，输出 `{ schema_version, status, rules: [{ rule_id, stage, shadow_hit_count, last_observed_at, workflows, reason_codes }], reason_code }`；文件缺失输出 `status: empty` 而非报错。phase 1 不做输出截断/上限——本机离散观测的量级不需要（移除原 MAX_ADVISORY_ITEMS 参照）。
- 存储文件不存在时 `record` 自动创建目录与文件；JSON 损坏时拒绝写入并报 `evidence-store-corrupt`，不静默重建（保护既有证据）。
- reserved-stage 拒绝的实现位置：`record` 无 `--stage` 入口即天然不可达 reserved stages；但 helper 内仍保留对读入存量 record 的 stage 校验（防手改文件出非法值），校验用 schema enum，不在源码硬编码 reserved 字面量逻辑分支。

**Patterns to follow:**
- `src/cli/helpers/resource-governance-lens.js`（CLI 骨架、schema 自校验、错误形态）
- `src/cli/helpers/task-governance-signals.js`（`--input`/参数解析风格）

**Test scenarios:**
- Happy path: record 一条 shadow hit → 文件创建、整条 rule record 通过 schema 校验（含默认填充的 `defect_evidence_refs`/`false_positive_refs`/`rollback`/顶层 `evidence_refs`/顶层 `reason_code`）、`observed_at` 为 ISO 字符串。
- Happy path: 同 rule_id 二次 record → 该 rule 的 `shadow_hits` 追加为 2 条（upsert 既有 rule record，不新建），顶层 `evidence_refs` 投影同步更新。
- Happy path: list → 计数、last_observed_at、reason_codes 汇总正确；空库 → `status: empty`。
- Error path: 传入 `--stage`（任意值）→ exit 2 invalid-arguments（phase 1 无此参数）。
- Error path: 存量文件中某 record 的 stage 为 reserved 值（手改场景）→ record 拒绝追加并报结构化错误，文件未被改写。
- Error path: 缺 `--evidence-ref` 或 `--reason-code` → exit 2 invalid-arguments。
- Error path: 存储文件为损坏 JSON → record 拒绝写入、报 `evidence-store-corrupt`、原文件内容不变。
- Edge case: rule_id 超长（>120）被 schema 校验拒绝。

**Verification:**
- `npm run test:unit` 中新测试文件全绿；手跑 record+list 闭环可复现。

---

### U2. 落盘路径治理（gitignore + init managed block + context-governance） — phase 1

**Goal:** `.spec-first/governance/` 成为登记过的 generated local evidence 路径。

**Requirements:** R6

**Dependencies:** U1（路径由 U1 确定）

**Files:**
- Modify: `.gitignore`
- Modify: `src/cli/gitignore-policy.js`（managed `.gitignore` block 生成源：`SPEC_FIRST_GITIGNORE_SECTIONS` / `buildSpecFirstGitignoreBlock()`）
- Modify: `docs/contracts/context-governance.md`
- Modify: `docs/05-用户手册/12-gitignore参考.md`（手册内嵌完整 managed block 文本，必须与生成器同步——`gitignore-policy.test.js` 有镜像断言，漏改即测试失败）
- Test: `tests/unit/gitignore-policy.test.js`

**Approach:**
- `.gitignore` 与 init managed block 同步加 `.spec-first/governance/`。
- 注意 `SPEC_FIRST_GITIGNORE_SECTIONS` 会经 `spec-first init` 投影到所有下游用户仓库的 managed block——这是有意行为（用户本机治理观测证据同样不应入 git），属 user-visible 变更，CHANGELOG 标注。
- `context-governance.md` 登记：该路径是 workflow 观测证据，不进普通 source context；消费方（skill-audit、未来 promotion review）按需显式读取。

**Test scenarios:**
- Happy path: `buildSpecFirstGitignoreBlock()` 输出含 `.spec-first/governance/`（contract test 断言）。
- Happy path: 用户手册内嵌 block 与生成器输出保持镜像（既有断言在新行加入后仍通过）。
- Test expectation: context-governance 文档行 — 由 U6 的 doc contract test 覆盖，本单元不重复。

**Verification:**
- `git check-ignore .spec-first/governance/rule-maturity.json` 命中；init 后 managed block 含新行。

---

### U3. workflow 接入（spec-plan + spec-code-review prose） — phase 1

**Goal:** 两个 lens 消费点在命中时显式引导记录 shadow hit。

**Requirements:** R5

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-plan/SKILL.md`（Phase 0.6 task-governance-signals 段之后）
- Modify: `skills/spec-code-review/SKILL.md`（resource-governance-lens preflight 段之后）

**Approach:**
- 各加一小段（≤5 行）：当 lens 返回非平凡信号（如 `candidate_level` 与最终判断不一致、resource lens `status=advisory`），LLM 判断是否构成值得观测的治理 hit；是则调用 `spec-first internal rule-maturity record` 落一条。helper 不可用时记录 degraded 继续，不阻塞 workflow。
- **evidence_ref 必须指向 durable 可回查载体**：repo 内 artifact 路径（如本次 plan 文档、review artifact、audit 报告）或可复跑的命令描述；lens 的 stdout 输出是会话级临时数据，不是合法 evidence_ref——若 lens 输出是关键证据，workflow 应先把它持久化（如写入 plan 的 Direct Evidence 段）再引用该路径。此规则同时写入 U5 的 `rule-maturity.md` producer 登记段。
- 明确措辞：记录是 advisory 观测，不改变 lens 结论，不是审计义务；每次 workflow 至多记录少量真实 hit，不刷量。
- prose 给出固定示例调用（含 rule_id 派生示例与 reason_code 示例），rule_id 示例遵循 A1 的 lens-family 前缀约定（如 `planning-depth-underclassified`）；U6 的关键短语断言锚定这些固定措辞，两单元同 PR 收口。
- 双宿主影响：SKILL.md 变更后需 `spec-first init` 刷新 runtime mirror（执行期动作，不手改 mirror）。

**Patterns to follow:**
- `skills/spec-code-review/SKILL.md` 现有 resource-governance-lens 段的「advisory 不升级为 blocking」措辞密度。

**Test scenarios:**
- Happy path: 两个 SKILL.md 含 `rule-maturity record` 调用引导且含 degraded 降级措辞（U6 doc contract test 断言关键短语）。
- Test expectation: prose 行为语义 — 按 CLAUDE.md「Agent 与 Skill 变更验证」，实现时用 fresh-source eval 验证引导可被新会话正确执行；不依赖本会话缓存。

**Verification:**
- `npm run lint:skill-entrypoints` 通过；doc contract test 通过。

---

### U4. spec-skill-audit 最小消费面 — phase 1

**Goal:** 兑现 producer→consumer gate：audit artifact 纳入 rule-maturity 汇总事实。

**Requirements:** R4

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-skill-audit/scripts/collect-skill-facts.js` 或 `write-audit-artifacts.js`（实现时按实际分工定）
- Modify: `skills/spec-skill-audit/SKILL.md`（Outputs 与 read-step 说明）
- Test: `tests/unit/` 下 skill-audit artifact 既有测试文件（实现时定位）+ fixture

**Approach:**
- audit 采集时读取 rule-maturity 观测汇总，把逐 rule 计数写入 audit artifact（新增 `rule-maturity-observations.json` 或并入既有 governance 报告，按 write-audit-artifacts 现有结构最小侵入选择）。读取方式：现有 audit 脚本无 child_process 先例，倾向直读 evidence 文件（从 repoRoot 解析路径，汇总逻辑与 `list` 共享同一 helper 模块导出函数，避免双实现），不 spawn CLI 子进程；细节见 Open Questions。
- evidence 文件缺失/为空时输出 `status: empty` 事实，不报错——空集本身是 v1.17 promotion 未就绪的有效证据。

**Patterns to follow:**
- `reviewer-guard-coverage-report.json` 的采集→写入→SKILL read-step→fixture 测试四件套。

**Test scenarios:**
- Happy path: fixture evidence 文件含 2 rules → artifact 汇总 2 行、计数正确。
- Edge case: evidence 文件缺失 → artifact 含 `status: empty` 事实，audit 不失败。
- Error path: evidence 文件损坏 → artifact 记录 degraded 事实，audit 不失败。

**Verification:**
- focused skill-audit tests 通过。

---

### U5. 合同与路线文档同步 — phase 1

**Goal:** 文档反映 producer 落地后的真实状态。

**Requirements:** R8

**Dependencies:** U1, U4

**Files:**
- Modify: `docs/contracts/governance/rule-maturity.md`
- Modify: `docs/01-需求分析/13.scale-integration/README.md`（v1.17 行进展 + 必要的边界句）
- Modify: `CHANGELOG.md`

**Approach:**
- `rule-maturity.md`：v1.14「schema/docs-only、无 producer」段更新为「v1.17 phase 1 起有唯一 producer `spec-first internal rule-maturity`，仅产 shadow/advisory；promotion/blocking 仍未实现」，登记存储路径与 consumer。
- SCALE README：v1.17 行进展按真实状态更新（plan 落地→计划中；实现合入→进行中），并在范围列点明 phase 1 边界。
- 注意 `tests/unit/scale-provider-doc-contracts.test.js:57` 断言父方案含「v1.14 schema/docs-only shadow 例外」字样——该历史表述保留（它描述 v1.14 决策），新增表述不得删除它；若措辞冲突，调整新增句而非历史句。

**Test scenarios:**
- Test expectation: none — docs-only 单元，断言由 U6 的 doc contract tests 承载。

**Verification:**
- `npm run test:unit` 中 doc contract tests 通过。

---

### U6. 治理断言翻转与合同测试收口 — phase 1

**Goal:** 有意识地翻转「无 producer」断言，扩展 reserved-stage 守卫，补 doc contract 断言。

**Requirements:** R2, R7, R5（断言部分）

**Dependencies:** U1, U3, U5

**Files:**
- Modify: `tests/unit/governance-contracts.test.js`
- Modify/Create: doc contract 断言所在文件（实现时定位，预计 `scale-provider-doc-contracts.test.js` 或邻近文件）

**Approach:**
- 翻转：`expect(internalSource).not.toContain("subcommand === 'rule-maturity'")` → 正向断言已注册。
- 保留并扩展：「producers never emit reserved maturity stages」对 `task-governance-signals.js` / `resource-governance-lens.js` 的断言不变。**陷阱警示：不得把 `rule-maturity.js` 加入该测试的既有 `producers` 数组**——该数组用字面量扫描（`not.toMatch(/['"]required-evidence['"]/)` 等），而 rule-maturity.js 的存量 stage 校验可能合法包含这些字符串。对 `rule-maturity.js` 单独新增断言：守源码层不出现 promotion 函数模式（`promote|approveRule|escalate`）与 `--stage` CLI 参数解析；行为级 reserved-stage 拒绝由 U1 测试承载。
- 新增 doc 断言：两个 SKILL.md 含 record 引导关键短语（短语清单以 U3 落地的实际措辞为准，U3 与本单元同 PR 收口避免短语漂移）；`rule-maturity.md` 含 producer 登记表述。

**Test scenarios:**
- Happy path: 全套 governance contract tests 在新现实下通过。
- Error path（守卫有效性）: 临时在 rule-maturity.js 加 `promote(` 字样应使断言失败（开发时自检，不留在代码中）。

**Verification:**
- `npm run test:unit` 全绿；`npm test` 主链路通过。

---

### U7. 裁决与汇聚子命令（adjudicate / merge）— phase 2

**Goal:** 人审裁决可被结构化记录，多机证据可合并成团队级样本。

**Requirements:** R9, R12

**Dependencies:** U1（复用同一 helper 模块与存储文件）；phase gate：phase 1 复查点通过

**Files:**
- Modify: `src/cli/helpers/rule-maturity.js`
- Create: `docs/contracts/governance/rule-adjudication-record.md`（裁决记录 prose 模板：署名、verdict、被裁决 hit 复合键、依据、**该 rule 是否与既有 advisory/blocking 规则冲突或重叠**（必填项，防规则间自我矛盾——规则集互相冲突是 harness 实践已证实的崩溃模式，模型遇冲突规则会编造折中方案）；U7 先于 U9 落地，故独立建档；实现时若与 U9 的 promotion 模板合并为同文件双段，在该文件内登记决策即可）
- Test: `tests/unit/rule-maturity.test.js`

**Approach:**
- `adjudicate`：必填 `--rule-id`、`--hit-ref`、`--verdict false-positive|defect`、`--decided-by`、`--evidence-ref`（durable 裁决依据）。误报写入 `false_positive_refs`、真缺陷写入 `defect_evidence_refs`；裁决 ref 同步进顶层 `evidence_refs`。脚本只做结构记录——「这条 hit 是不是误报」的语义判断发生在人/评审侧，命令只是登记结论。
- **`--hit-ref` 取值钉死为 `<observed_at>::<evidence_ref>` 复合键**（与 merge 去重键同一约定）：脚本据此在该 rule 的 `shadow_hits` 中定位 hit，定位不到报结构化错误；同 rule 内复合键碰撞（理论上可能：同一秒同一 evidence_ref 两次 record）报结构化错误要求人工先去重，不猜测。
- **署名与 hit↔verdict 关联的 durable 落点是 prose 裁决记录，不是 v1 schema**：schema 顶层 `additionalProperties:false` 且三个 refs 数组 items 为纯字符串，承载不了 `decided_by` 或 hit 关联字段。与 U9 promotion 同构：`--evidence-ref` 必须指向 repo 内存在的裁决记录文件（模板见 Files 的 `rule-adjudication-record.md`），记录内必填署名、verdict、被裁决 hit 的复合键、依据、规则冲突/重叠检查（与模板必填项一致）；脚本校验 ref 存在性，不校验 prose 质量。「同一 hit 重复裁决」的可靠判定来源是裁决记录 prose 内登记的 hit 复合键（人审可查）；脚本侧不机读 prose，重复防护降级为参数层提示（完整 ref 字符串重复提交时报已存在），主防线是人审记录本身——advisory 语义可承受该近似。
- **`--evidence-ref` 支持 `#` 后缀定位批量裁决记录中的单条裁决**：取值允许 `<repo内路径>#<hit复合键>` 形态；存在性校验只看 `#` 前的文件路径部分，refs 仍是纯字符串、schema 不 bump。动机：一份 prose 裁决记录天然可批量登记多条 hit 的裁决（一次人审 session 裁决多条），若按裸文件路径做重复防护，第二条裁决就会被「已存在」误拒，迫使人为每条 hit 建文件、抬高裁决成本、系统性低估误报率。重复防护按完整 ref（含 `#` 后缀）判断。
- **`report`（U8）的 `false_positive_rate` 分母口径钉死**：分母 = `shadow_hits` 计数，分子 = `false_positive_refs` 计数；这是 refs-数组长度近似（一条裁决记录一个 ref），不是逐 hit 状态机——口径写入 `rule-maturity.md` 合同，消费侧（人审）知晓其近似性。
- `merge`：输入另一份同 schema 的 evidence 文件路径（队友导出），按 rule_id 合并、`shadow_hits` 按 `observed_at`+`evidence_ref` 复合键去重、裁决 refs 取并集；冲突（同 rule 不同 stage）拒绝合并并报结构化错误（stage 分歧属人审议题，不自动调和）。
- 导出即复制 evidence 文件本身（gitignored 单文件天然可传递），不另建导出格式。

**Patterns to follow:**
- 上游 `RuleMaturity.ts` 的 `recordShadowHit(record, {falsePositive})` 思路，但把误报标记从「记录时调用方顺手传」改为「事后显式裁决」——记录与裁决分离是 spec-first 两轴（机械观测 vs 语义判断）的要求。

**Test scenarios:**
- Happy path: adjudicate 一条 hit 为误报 → `false_positive_refs` 追加裁决记录 ref、record 整体 schema 校验通过（署名在 ref 指向的 prose 裁决记录内，不在 JSON record 上）。
- Happy path: merge 两份文件（部分 rule 重叠）→ hits 去重合并、计数正确。
- Error path: adjudicate 缺 `--decided-by` → exit 2（无署名不接受裁决；署名进裁决记录 prose，CLI 参数仅作必填校验与回显）。
- Error path: `--evidence-ref` 指向不存在的文件 → exit 2（裁决记录必须先落盘）。
- Error path: merge 遇 stage 冲突 → 拒绝且两份文件均不被修改。
- Edge case: `--hit-ref` 复合键定位不到 hit → 结构化错误。
- Edge case: 同 rule 内复合键碰撞 → 结构化错误要求人工去重。

**Verification:**
- focused unit tests 通过；手跑 record→adjudicate→merge 闭环可复现。

---

### U8. 晋升就绪报告（report）— phase 2

**Goal:** 把上游 `evaluateRulePromotion` 的阈值对照思想落为只读 deterministic 报告，给人审提供就绪事实。

**Requirements:** R10, R13（blocking 毕业 ref 校验）, R14（decay 信号）

**Dependencies:** U7

**Files:**
- Modify: `src/cli/helpers/rule-maturity.js`
- Modify: `docs/contracts/governance/rule-maturity.md`（登记报告字段与 advisory 阈值语义）
- Test: `tests/unit/rule-maturity.test.js`

**Approach:**
- `report` 输出逐 rule：`{ rule_id, stage, shadow_hit_count, adjudicated_count, false_positive_rate, defect_evidence_count, rollback_present, readiness_blockers[], decay_signals[] }`。`false_positive_rate` 按 U7 钉死的口径：分母 = `shadow_hits` 计数、分子 = `false_positive_refs` 计数（refs 长度近似）；`adjudicated_count` = `false_positive_refs` + `defect_evidence_refs` 计数（裁决次数，非被裁决 hit 数——近似性同上，写入合同）。
- `readiness_blockers[]` 模仿上游可读 blockers 形态（如 `shadow hits 3/10`）：默认阈值 min_shadow_hits=10、min_defect_evidence=1、max_false_positive_rate=0.2、rollback 必在场（**自上游 RuleMaturity.ts DEFAULT_THRESHOLDS 源码实测读出、未经任何真实运行数据校准的 advisory 起点**——上游自身也无校准依据，且其假设的是 daemon 级观测密度；该来源与未校准状态写入 `rule-maturity.md` 合同，防止默认值被消费侧误读为经验值）；可经 `--thresholds <json>` 覆盖，阈值本身的合理性由 phase 2 真实数据（phase gate 登记的观测密度事实）校准。
- 对 stage=blocking 的 rule 校验毕业 test ref 在场（R13）；`decay_signals[]` 输出如「blocking 规则近 N 次 report 间隔零新 hit」「晋升后新增误报裁决」等可机读事实（R14），解释留给人审。
- 报告不输出任何「应当晋升/降级」结论——blockers 为空只说明「就绪事实满足」，决定仍归人。

**Test scenarios:**
- Happy path: hits=12、误报率 0.1、defect=2、rollback 在场 → blockers 为空。
- Happy path: hits=3 → blockers 含 `shadow hits 3/10` 形态条目。
- Happy path: blocking rule 无毕业 test ref → blockers 含 graduation-ref-missing。
- Edge case: hits=0 → 误报率按 0 计（上游同口径），blockers 含 hits 不足。
- Edge case: `--thresholds` 覆盖后 blockers 按新阈值计算。

**Verification:**
- focused unit tests 通过；report **读入**的每条 rule record 经 `rule-maturity.v1` 校验（坏 record 报结构化错误），report **输出**形状由 unit tests 守住——不为 report 输出新建 schema/validator（与 knowledge-harness L6「不加第二套 validator」先例对齐；`list` projection 同口径）。

---

### U9. 人审晋升/降级路径（promote / demote）— phase 2

**Goal:** stage 变更有且只有一条人审署名路径，审批记录为 durable prose artifact。

**Requirements:** R11, R14（demote 即退役执行路径）

**Dependencies:** U8

**Files:**
- Modify: `src/cli/helpers/rule-maturity.js`
- Create: `docs/contracts/governance/rule-promotion-record.md`（审批记录 prose 模板与必填要素：证据 refs、rollback 策略、invalidation_condition、署名、本次晋升生效的阈值快照）
- Test: `tests/unit/rule-maturity.test.js`

**Approach:**
- `promote --rule-id --to <stage> --decided-by --approval-ref <repo内审批记录路径>`：逐级晋升（不可跳级）；`--to required-evidence|blocking` 时先内部跑 R10 就绪检查，blockers 非空则 exit 2 并回显 blockers（上游 `approveRuleMaturity` 的「晋升前重验、不合格即 throw」同构）。**重验必须支持与 `report` 相同的 `--thresholds` 覆盖，且默认阈值与 report 同源（同一常量定义，不得双处硬编码）**——上游 `approveRuleMaturity` 内部调 `evaluateRulePromotion(record)` 时丢弃自定义阈值、永远按 DEFAULT_THRESHOLDS 重验（RuleMaturity.ts:105），是「评估时一套阈值、审批时另一套」的已证实 bug class，本单元从设计层堵死。生效阈值快照必须回显在命令输出中，并登记进审批记录 prose（rule-promotion-record.md 模板必填要素之一），使「这次晋升按什么阈值判定」可审计；approval-ref 必须是 repo 内存在的文件路径（prose 审批记录），以 ref 进 `evidence_refs`。schema 保持 v1 不 bump——promotion 审计轨迹走 prose artifact + ref，与 knowledge-harness L6「prose-enforced gate、不加第二套 validator」先例一致。
- `demote --rule-id --to <stage> --decided-by --approval-ref`：降级/退役路径，无就绪检查（降级永远可达——「构建是为了删除」）；降级自 blocking 时提示同步删除毕业测试（提示属 next_action 事实，删除动作归执行该退役的 work 任务）。
- 审批记录模板放 `docs/contracts/governance/rule-promotion-record.md`，要素必填但形式是 prose——脚本校验 ref 存在性，不校验 prose 质量（质量归人审）。

**Test scenarios:**
- Happy path: shadow→advisory promote（无就绪门）→ stage 更新、approval ref 进 evidence_refs。
- Happy path: advisory→required-evidence 且 blockers 为空 → 成功。
- Error path: blockers 非空时 promote 到 required-evidence → exit 2 回显 blockers。
- Error path: 跳级 promote（shadow→blocking）→ exit 2。
- Error path: approval-ref 指向不存在文件 → exit 2。
- Happy path: required-evidence→blocking promote 且 blockers 为空 → 成功（每个非 shadow stage 都有显式晋升用例，防 candidate-hook 式「评估可达但审批跳过」的死 stage）。
- Happy path: 自定义阈值下 `report --thresholds` blockers 为空、默认阈值下非空 → promote 带同样 `--thresholds` 成功，且输出回显生效阈值快照（阈值同源回归用例，对应上游 approveRuleMaturity 丢弃自定义阈值的 bug class）。
- Happy path: blocking→advisory demote → 成功且 next_action 提示删除毕业测试。

**Verification:**
- focused unit tests 通过；governance-contracts 的「producer 无 promotion 函数」断言相应调整为「promotion 仅经人审署名命令路径」（U6 断言的 phase 2 修订，记入该测试文件注释）。

---

### U10. 毕业机制合同化（blocking = contract test）— phase 3

**Goal:** 把「规则毕业为 npm test 主链路的确定性 gate」从约定变成被守护的合同。

**Requirements:** R13, R14

**Dependencies:** U9；phase gate：至少 1 条 rule 有裁决记录

**Files:**
- Modify: `docs/contracts/governance/rule-maturity.md`（毕业语义章节：blocking 的执行体是 contract test/lint，不是 runtime hook）
- Modify: `tests/unit/governance-contracts.test.js`（新增断言：源码层不出现 hook 安装/pre-commit 写入模式；以及 stage 图完整性断言——每个非 shadow stage 均可经 promote 逐级到达、经 demote 离开，防止上游 `candidate-hook` 式死 stage：evaluateRulePromotion 返回它作 nextStage，approveRuleMaturity 却直接跳到 approved-blocking，没有任何代码路径真正进入该 stage）
- Modify: `skills/spec-compound/SKILL.md`（沉淀治理类 solution 时，提示「该 learning 是否对应某条 rule 的毕业候选」，把知识轮与规则轮在 compound 处接通；≤3 行 prose）

**Approach:**
- 毕业流程为既有机制的组合而非新机制：人审决定毕业 → 走 `/spec:work` 写毕业 contract test（如同 `governance-contracts.test.js` 既有断言）→ `promote --to blocking` 时 approval-ref 记录毕业 test 路径 → `report` 此后校验该 ref。
- 合同明确反向守卫：任何把 blocking 实现为 runtime hook、pre-commit 拦截、SessionStart 注入的尝试都违反本合同（OPT-D 与父方案 non-goal 双重背书），由 governance-contracts 测试守源码层。
- compound 接通是单向提示：知识轮的 verified learning 可成为规则轮的 rule 候选（事故墓志铭→规则），不反向自动创建。

**Test scenarios:**
- Happy path: doc contract test 断言 rule-maturity.md 含毕业语义关键短语。
- Happy path: governance-contracts 新增断言通过（rule-maturity.js 无 hook/pre-commit 模式）。
- Test expectation: compound prose 行 — doc contract test 断言关键短语在场。

**Verification:**
- `npm run test:unit` 全绿；fresh-source eval 验证 compound 提示可被新会话正确执行。

---

### U11. governance ROI 确定性聚合 — phase 4

**Goal:** 治理漏斗可量化：观测→裁决→晋升→毕业的转化计数与时间窗趋势，零虚构常数。

**Requirements:** R15

**Dependencies:** U7（裁决数据）、U9（晋升数据）；与 phase 3 无依赖

**Files:**
- Modify: `src/cli/helpers/rule-maturity.js`（`report --funnel` 或独立 `roi` 子动作，实现时按输出体量定）
- Modify: `skills/spec-skill-audit/scripts/collect-skill-facts.js`（audit artifact 纳入漏斗事实，扩展 U4 已有采集函数）
- Test: `tests/unit/rule-maturity.test.js` + skill-audit fixture 测试

**Approach:**
- 借上游 GovernanceMetrics 的两个可取形态：漏斗转化计数（proposed→validated→approved→enforced 映射为 observed→adjudicated→promoted→graduated）与时间窗对比 delta（本期 vs 前期，纯文件聚合）。adjudicated 级计数沿用 U8 钉死的 refs-计数口径（裁决次数近似，合同已登记），不在 ROI 层伪造逐 hit 精度。
- 时间窗边界是显式输入而非 wall-clock 隐式输入：`report --funnel` 支持 `--as-of`（或 `--window-start/--window-end`）参数，漏斗输出是「evidence 文件 + 窗口参数」的纯函数；默认可取当前时间但必须在输出中回显实际窗口边界，窗口语义（默认窗口长度、「本期/前期」边界推导规则）在实现首个测试前钉死——否则同一 evidence 文件在不同时刻跑出不同 delta，违反本单元「每个数字可从 evidence 文件直接复算」的 verification 口径（harness 工程化原文「宁要可复现的粗糙分」同向背书）。
- 显式拒绝其虚构面：无 token 节省估算、无 ROI Score、无占位指标（上游 instinctHitRateDelta 恒 0 还进报告的反例）；每个输出数字必须可从 evidence 文件直接复算。
- **漏斗输出必须附排除计数与原因（omission 事实段）**：窗口外 N 条、格式不合/校验失败 N 条、已 retire N 条等被排除项以确定性计数回显，不允许 silent truncation——「漏斗只展示纳入项」会被消费侧读作「覆盖了全部 evidence」，与 no-silent-caps 口径一致；排除原因是机械事实（窗口边界、schema 校验结果），不含语义判断。
- 输出为 facts，解读归 LLM/人（如「30 天零裁决」是事实，「裁决流程停滞需要关注」是消费侧判断）。

**Test scenarios:**
- Happy path: fixture 含完整漏斗数据 → 各级计数与 delta 正确。
- Happy path: fixture 含窗口外与格式不合数据 → 排除计数与原因正确回显，纳入计数不含被排除项。
- Happy path: 同一 fixture + 同一窗口参数多次运行 → 输出逐字节一致（确定性可复现）。
- Edge case: 时间窗内无数据 → 计数为 0，不出现估算或外推值。
- Happy path: skill-audit artifact 含漏斗事实（fixture 断言）。

**Verification:**
- focused tests 通过；输出中不存在任何非复算来源的数字（code review 核对项）。

---

### U12. resource lens v2 producer 扩展 — phase 4

**Goal:** 收口父方案 §4.8 已核实的 producer/schema 缺口。

**Requirements:** R16

**Dependencies:** None（与 promotion 链路独立，可并行）

**Files:**
- Modify: `src/cli/helpers/resource-governance-lens.js`
- Modify: `docs/contracts/governance/resource-governance-lens.md` + `resource-governance-lens.schema.json`（bump v2 + 版本说明）
- Modify: `skills/spec-work/references/shipping-workflow.md`（Phase 3 step 2.5 boundary rules 的维度枚举句，约 L134——被 prose contract test 逐字钉死，新增维度后必须同步更新）
- Modify: `skills/spec-code-review/SKILL.md`（Stage 3/6 的 lens 维度与字段枚举措辞，同样被 prose contract test 钉死）
- Test: `tests/unit/resource-governance-lens.test.js` + `tests/unit/governance-contracts.test.js`（L83 的 `schema_version: 'resource-governance-lens.v1'` payload 字面量随 const bump 同步改）
- Test: `tests/unit/spec-work-resource-lens-contract.test.js` + `tests/unit/spec-code-review-resource-lens-contract.test.js`（两个 prose contract test 逐字断言 v1 维度枚举短语——「large files, generated output, raw logs, owner hints, and staging-scope risks」等——v2 新增维度后断言与 prose 必须同 PR 更新）

**Approach:**
- 新增维度（已核实「合同字段都没有」的四项）：staged 媒体产物检测（screenshots/视频扩展名，新 dimension + reason_code）；coverage/playwright-report 等生成报告目录的 staged 提交策略 advisory（注意与现有 retained 白名单的方向区分：白名单抑制 raw-log 噪声，新维度提示「staged 了不该提交的生成报告」）；raw log retention 状态字段（策略 + 「应清理」事实）；redaction status 字段（敏感信息脱敏与否的机械可判事实，judgment 不进脚本）。
- policy 输出补 owners/modules 全貌（item-level hint 已有，policy-level 缺）。
- 保持 lens 只读、never-blocking、exit 0 三态合同不变；v2 是字段扩展不是行为变更。

**Test scenarios:**
- Happy path: staged 一个 .png → 媒体维度 advisory 产出。
- Happy path: staged coverage/ 目录文件 → 提交策略 advisory（而非被白名单静默）。
- Happy path: v2 schema 校验通过且 v1 消费者关注的既有字段全部保留。
- Happy path: v2 维度枚举在两个消费 prose（shipping-workflow.md L134 段、spec-code-review Stage 3/6）中同步更新，对应逐字断言随之更新且通过。
- Edge case: retained 白名单目录内的 .log 仍被抑制（既有行为不回归）。
- Error path: 既有三态 exit code 合同不变（rejected 才非 0）。

**Verification:**
- focused tests + `npm run test:unit` 通过；schema 版本说明含 v1→v2 字段对照。

---

### U13. resource lens 消费接通（PR handoff + standards reviewer）— phase 4

**Goal:** 接通两个已核实的消费空置点，让 hardening 产生 workflow 可观察行为变化。

**Requirements:** R17

**Dependencies:** U12

**Files:**
- Modify: `skills/spec-work/references/shipping-workflow.md`（Phase 4 Step 3 git-commit-push-pr 上下文清单注入 lens advisory）
- Modify: `skills/spec-code-review/SKILL.md`（Stage 4 per-reviewer context 组装：project-standards persona 的 review context 追加 lens items；Stage 3b 保持纯路径发现职责不动）
- Test: 对应 doc contract tests

**Approach:**
- PR handoff：把 lens 的大文件/generated-output/媒体产物 advisory 列入 PR description 上下文清单，让 PR 评审者看到资源风险事实；advisory 不阻塞 PR 创建。
- standards reviewer：接入点在 Stage 4 的 per-reviewer context 组装清单（与既有 `<standards-paths>` block 同位置追加），lens items（含 subject_path/evidence_ref）作为 project-standards persona 的输入之一——不写进 Stage 3b：该段职责是「only file paths, not contents」的廉价路径发现，塞结构化 facts 与其设计说明冲突。reviewer 仍独立判断是否构成 finding（advisory 不自动转 finding，既有 SKILL L838 口径不变）。
- spec-release-notes 不接入的决策记录进 shipping-workflow 注释或本 plan（已核实其为只读检索型、无 staging 环节）。

**Test scenarios:**
- Happy path: doc contract test 断言两处接入 prose 在场。
- Test expectation: 行为语义 — fresh-source eval 验证接入引导可被新会话执行。

**Verification:**
- doc contract tests + `npm run lint:skill-entrypoints` 通过；`spec-first init` 刷新 runtime mirror。

---

### U14. 整版文档与路线收口 — phase 4 末

**Goal:** v1.17 全范围的文档状态与真实进展一致。

**Requirements:** R8（整版口径）

**Dependencies:** U10, U11, U13

**Files:**
- Modify: `docs/contracts/governance/rule-maturity.md`（整版后的 stage 生命周期全貌：观测→裁决→晋升→毕业→退役）
- Modify: `docs/01-需求分析/13.scale-integration/README.md`（v1.17 行→「已完成」，仅当 R1–R17 全部落地）
- Modify: `CHANGELOG.md`（逐 phase 合入时分别记录）
- Modify: `docs/contracts/workflows/spec-work-run-artifact` 相关文档若 resource v2 字段影响 run artifact 引用（实现时核实，预计不影响）

**Test scenarios:**
- Test expectation: none — docs-only 收口单元，断言由各 phase 的 doc contract tests 承载。

**Verification:**
- `npm test` 主链路通过；README 进展与 §9.0.1 三级 gate 实况逐项对照无虚标。

---

## System-Wide Impact

- **Interaction graph:** internal.js 新增 dispatch 分支；spec-plan / spec-code-review 的 lens 消费段新增一个可选后继动作；skill-audit artifact 写入面新增一类事实。无公开 CLI 入口变化。
- **Error propagation:** record 失败（store 损坏、参数非法）以 exit 2 + 结构化 reason_code 返回，workflow prose 明确 degraded 继续；不让治理观测失败阻塞主 workflow。
- **State lifecycle risks:** 单文件 upsert 存在并发写竞态（两个会话同时 record）——phase 1 接受该风险：观测是低频显式动作，丢失个别 hit 不影响 advisory 语义；不引入锁机制（避免过度设计），风险登记于下表。
- **API surface parity:** Claude/Codex 双宿主：SKILL.md 变更经 `spec-first init` 投影；helper 是 Node 脚本不受会话缓存影响。
- **Integration coverage:** `npm test` 主链路覆盖 internal dispatch + skill-audit artifact；record→list→audit 消费的端到端在 U4 fixture 测试中验证。
- **Unchanged invariants:** `task-governance-signals` 输出合同不变；`resource-governance-lens` 在 phase 1–3 不变（phase 4 U12 经 v2 bump 扩展，保留 v1 字段）；`rule-maturity.v1` schema 全程不 bump（promotion 审批与 adjudication 裁决的署名/审计轨迹均走 prose artifact + ref，schema 只承载 ref 字符串）；doctor 合同不变；`gate-lens-taxonomy.v1` 词表不变。
- **Phase 2+ 增量影响:** adjudicate/promote/demote/merge/report 均为同一 internal helper 的子动作，无新 CLI 入口；U10 在 spec-compound 加 ≤3 行单向提示（知识轮→规则轮候选）；U13 在 spec-work shipping-workflow 与 spec-code-review standards reviewer 各加一处 lens facts 注入。全部为 advisory 注入，不改变任何 workflow 的阻塞行为。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| workflow prose 引导被 LLM 忽略，证据仍不流动 | U3 用 doc contract test 守住引导在场；**落地后 2 周复查点（owner：本仓维护者，动作：跑 `rule-maturity list`）——零记录即在 phase 2 启动前优先评估更强接线（如 closeout 检查项）**；phase gate 把该复查设为 phase 2 推进条件 |
| evidence_ref 指向会话级临时数据，人审无法回查 | U3/U5 钉死 durable evidence_ref 规则：只接受 repo 内 artifact 路径或可复跑命令描述，lens stdout 不合法 |
| 记录刷量/低质 hit 稀释证据价值 | prose 明确「LLM 判断值得观测才记录」+ durable evidence_ref 门槛；list/report 暴露 reason_code 分布便于人审甄别 |
| 并发写竞态丢失记录 | 接受（低频显式动作 + advisory 语义）；store 损坏有 `evidence-store-corrupt` 保护不静默重建 |
| 翻转治理断言时误删 reserved-stage 守卫 / 误把 rule-maturity.js 加入字面量扫描数组 | U6 明确「翻转一条、保留另一条、新文件单独断言」，code review 重点核对 |
| gitignored 本机证据在多人协作下分散或因 re-clone 丢失 | phase 2 `merge`（U7）提供跨机汇聚；phase 1 窗口内证据丢失代价是重新积累时间而非正确性 |
| 上游阈值（10 hits / 0.2 误报率）不适配本仓节奏，就绪门形同虚设或永不可达 | 阈值显式标 advisory 默认值 + `--thresholds` 可覆盖；phase 2 用真实数据校准并把校准结论写回合同 |
| 毕业测试越积越多，npm test 变慢、harness 变厚 | R14 退役路径 + report decay 信号（长期零 hit 的 blocking 规则浮出）；「构建是为了删除」原则进 rule-maturity.md 合同 |
| promote 人审流于形式（审批记录复制粘贴） | 审批记录必填 invalidation_condition 与 rollback 策略（模板 U9）；report blockers 为空是晋升必要条件而非充分条件，决定权在人 |
| resource lens v2 字段扩展破坏既有消费者 | v2 保留 v1 全部字段，contract test 守既有字段不回归（U12 测试场景）；版本说明含字段对照 |
| phase 4 与 phase 2/3 并行导致 helper 文件合并冲突 | U11 依赖 U7/U9 的数据但代码面是独立子动作；U12/U13 完全独立文件；按 U-ID 依赖图排 PR 顺序即可 |

---

## Documentation / Operational Notes

- CHANGELOG 按仓库格式逐 phase 合入时分别记录，标 `(user-visible)`（新增 CLI internal 子命令 + skill-audit 报告新增事实面 + resource lens v2）。
- SKILL.md 变更后执行 `spec-first init` 刷新双宿主 runtime mirror；不手改 mirror。
- phase 1 合入后真实运行 2 周再启动 phase 2 实现（phase gate），让 shadow_hits 积累出可供人审的样本；phase 4 的 U12/U13 不受此 gate 约束，可提前并行。
- 团队推广注意：phase 2 `merge` 落地前，各成员本机证据互不可见——团队级 promotion 评审从 phase 2 起才有完整样本，phase 1 期间不要基于单机数据做晋升预判。

---

## Sources & References

- 路线索引：`docs/01-需求分析/13.scale-integration/README.md`（v1.17 行 + 开发顺序约束）
- 父方案：`docs/01-需求分析/13.scale-integration/spec-first内化集成scale-project-scaffold技术方案.md` §4.7（RuleMaturity）、§4.8（resource/output governance）、§9.0.1（三级交付 gate）、§10（P1 治理优先级 + GovernanceMetrics P2-advisory 裁决）
- 合同：`docs/contracts/governance/rule-maturity.md` + schema、`docs/contracts/governance/resource-governance-lens.md` + schema、`docs/contracts/governance/gate-lens-taxonomy.schema.json`
- v1.14 前序 plan：`docs/plans/2026-06-05-001-feat-governance-lens-foundation-plan.md`
- 上游参考（只借思想）：`scale-engine/src/evolution/RuleMaturity.ts`、`scale-engine/src/cortex/GovernanceMetrics.ts`（实测提炼见 Context & Research）
- Harness 工程化输入：`docs/01-需求分析/14.harness-engineering/harness-engineering-x-spec-first-analysis.md`、`docs/01-需求分析/14.harness-engineering/harness-discipline-deep-analysis.md`
- 人审 promotion 先例：`docs/contracts/workflows/self-reflection-capability-upgrade.md`、`docs/contracts/knowledge/knowledge-harness.md`（L6）、`skills/spec-compound/SKILL.md`（verified promote gate）
- Learnings：见 Context & Research（5 篇）
