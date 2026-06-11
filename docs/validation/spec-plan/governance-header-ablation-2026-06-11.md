# Governance Header Ablation —— spec-plan(2026-06-11)

Plan: `docs/plans/2026-06-11-004-refactor-spec-plan-skill-slimming-plan.md`(U2)
Method: fresh general-purpose subagent A/B(A=注入治理节为唯一 operating instruction;B=无该节);self-contained prompt;`Do NOT read files`;每条件多次重复;行为锚点人工打分。
Status: **partial / 方法学验证 + 首轮信号;尚未形成 U4/U5 formal verdict。** 因下方两个混淆,RCE 需 clean-room 复跑、CCEB 需中性任务复跑,其余 extract 候选也需补跑,方可作为抽取/删除依据。

## 结果汇总

| 节 | 锚点 | A(有)| B(无)| 初判 | 阻断混淆 |
|---|---|---|---|---|---|
| Runtime Context Exclusion | 排除 .claude/.codex/.agents/skills 镜像 | 3/3 排除 | **3/3 排除** | NULL（given 全局层+先验冗余）| **全局层泄漏**:B 臂自发引用 `spec-first init`/`role contract`，证明本仓 CLAUDE.md/AGENTS.md 进入了 subagent system prompt |
| Recall Trust Boundary | learning 当 advisory 先验证 | 3/3 skepticism-first | 1/3 advisory-first；2/3 "先采纳再核" | **弱效果（非 null）→ extract** | 模型有中等"先验证 doc"先验，section 主要锐化姿态 |
| Capability-Class Evidence Boundary | code-graph 当 advisory 先验证再删 | 3/3，且含 `provider-untrusted`/freshness | 3/3 不删 **但理由是 payments 高风险** | 假 null（任务混淆）| **域线索**:`processPayment` 触发通用"高风险慎删"先验，淹没 section 锚点；section 特有行为仅 A 臂出现 |

（含可行性预跑:Recall Trust Boundary 2×2,因任务含 "(dated 3 months ago)" 线索得假 null,已弃用。）

## 两条被实测确认的方法学铁律(正式 U2 必守)

1. **全局层会泄漏进 subagent**。在本仓内跑 ablation,subagent 会自动加载 spec-first 的 `CLAUDE.md`/`AGENTS.md`(RCE 的 B 臂自发说 `spec-first init` 即铁证)。因此仓内 A/B 测的是「section vs (ambient 全局层 + 模型先验)」,**不是**「section vs 空」。
   - 推论:仓内 null = 「given 全局层冗余」= **开发本仓的冗余信号**,不是删除授权;但**终端用户 repo 无 spec-first CLAUDE.md**,需 **clean-room 复跑**(无全局层注入,或在不含 spec-first 治理的临时工作区)才能判定终端运行时是否仍 null。无 clean-room 证据前,删除必须先把语义抽到能投影到终端的 runtime-copied 载体(plan R5)。

2. **任务锚点不得含触发通用先验的域线索**。`processPayment`→payment 慎删先验;`(dated N months)`→staleness 先验。这些会让 B 臂"自带"目标行为,造成假 null。CCEB 须用中性函数名(如 `formatLabel`)复跑。

## 对计划的影响

- **RCE**:最强 null/冗余候选,但删除前必须 (a) clean-room 复跑确认终端无全局层时是否仍 null,(b) 若仍需保留语义则抽到可投影 runtime-copied 载体。
- **RTB**:弱效果 → **extract**(渐进披露 runtime-copied reference),不删。
- **CCEB**:**判定未决**,中性任务复跑后再定 extract/remove。
- harness 本身可行(18 agent 并行、~7s/agent、0 文件读取、隔离成功),U2 可规模化;本文件当前不授权 U4/U5 抽取或删除。

## 复跑 backlog(正式 U2)

- [ ] RCE clean-room A/B(无 spec-first 全局层)× ≥3
- [ ] CCEB 中性函数名 A/B × ≥3
- [ ] RTB 已得弱效果,可补 1 轮确认后定 extract
- [ ] 其余 extract 候选(Context Orientation / Domain Language / Cache-Friendly / Summary-First)各 A/B × ≥3
