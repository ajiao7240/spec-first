---
title: 借鉴 AI 代码评审器能力的判断边界（证据确定性门 + 已有原语覆盖门）
date: 2026-06-09
category: docs/solutions/architecture-patterns
module: spec-code-review
problem_type: architecture_pattern
component: development_workflow
severity: medium
applies_when:
  - 有人提议给 spec-code-review 借鉴某个 AI 评审器（CodeRabbit/Greptile/Qodo/Diamond/Copilot）的能力
  - 要判断「测试决策单 / 分级回归 / 增量复审 / 影响范围」这类评审器特性是否值得在本项目落地
  - 借鉴的能力可能需要本 harness 不具备的确定性数据（覆盖率、TIA、依赖图）
  - 借鉴的能力可能已被现有原语（如 code-review 的 base:<sha> token）覆盖
domain: code-review 能力借鉴 / 竞品评审器形态对标
pattern: AI-reviewer capability borrowing gate（证据确定性 + 已有原语覆盖）
rejected_alternatives:
  - "顶层必填 testing_plan + 点名必跑/建议/可选回归测试清单（违反 evidence-first，无任何评审器先例）"
  - "新增 incremental-scope.sh + repo-local state + scope:full token 的重型增量复审机制（base:<sha> 已覆盖，misfit 本地 CLI）"
  - "spec-regression-strategist 合成 persona（与并行叶子 reviewer 派发模型不兼容）"
applicable_versions:
  - "spec-first 1.10.x"
  - "AI code reviewer landscape 2025-2026"
invalidation_condition: 当 spec-first 自身具备确定性 TIA/覆盖率/依赖图 provider 且评审可作为其 consumer 消费时，Case 1 的「点名测试=幻觉」结论需重评；当出现确凿用户证据显示本地同分支 3+ 次复审的重复 finding 是真实高频痛点且 base:<sha> 摩擦过大时，Case 2 需重评
source_refs:
  - "spec-first-doc:业界学习/03-机制分析/review-testing/code-review-test-decision-sheet-analysis.md"
  - "docs/plans/2026-06-09-001-feat-code-review-incremental-scope-plan.md"
  - "skills/spec-code-review/SKILL.md"
  - "skills/spec-code-review/references/findings-schema.json"
  - "skills/spec-code-review/references/review-output-template.md"
tags: [code-review, competitor-analysis, evidence-first, anti-bloat, test-impact-analysis, incremental-review, ai-reviewer]
---

# 借鉴 AI 代码评审器能力的判断边界

## Context

会话里有两类高频请求会把"业界 AI 评审器有 X 能力"推成"spec-code-review 也该加 X":

1. 读到一篇产品文章（"测试决策单"：把评审产出压缩成一句话结论 + 影响范围 + **必跑/建议/可选三级回归测试清单** + 缺失测试点），提议给 code-review 加 `testing_plan`。
2. 看到 CodeRabbit 有"增量复审"（push 后只审新 commit），提议给 code-review 加一套 state 文件 + 脚本 + token 的增量机制。

两者都"看起来该借"，但经两轮 deep-research（25 claims 全 3-0 验证）+ 源码核验 + 4 reviewer 对抗式评审后，**核心机制都被否决**。这是 [[competitor-skill-borrowing-judgment]] 通用方法论在 code-review 域的具体落点：本文记录两个域专属的"借鉴门"，避免重复提案。

## Guidance

借鉴 AI 评审器能力前，过两道域专属的门。任一不过，该能力不在评审器里落地（或降级为 advisory）。

### 门 1：证据确定性门 —— 这能力靠 LLM 语义判断，还是靠 harness 不具备的确定性数据？

- **可借（LLM 语义判断）**：缺失测试点识别、风险等级/一句话结论、变更影响范围的*语义解释*。这些是 LLM 擅长且有产品先例的。
- **不可借（需确定性数据）**：**点名具体回归测试清单**。业界一手证据一致：
  - 主流评审器（CodeRabbit/Diamond/Qodo/Greptile）默认输出**全部是 findings + severity + summary**，finding 连接的是*代码 fix*，**无一**产出分级回归测试清单；测试生成是刻意解耦的 on-demand 能力。
  - TIA/RTS（微软 TIA、Ekstazi、STARTS、Facebook PTS、Gradle Develocity）**定义上**基于确定性 per-test 覆盖率/依赖数据，"cannot be reconstructed from a diff alone"，且一致定位为 **CI/build-time 独立能力**，不是评审器功能。
  - Greptile 一手实验：让 LLM 对自己产出的 severity 打分，结果"nearly random"——**LLM 在无确定性证据时分配等级/点名测试 = 猜测，不是 confirmed truth**。

> 心法：评审器可以*说*"这里缺并发测试"（gap 识别，语义），不能*点名*"跑 PaymentFlowIntegrationTest"（需 TIA，确定性）。后者在 spec-first 里直接撞 SKILL.md 的 Capability-Class Evidence Boundary（"provider 自报 affected-test 不是 confirmed review fact"）。

### 门 2：已有原语覆盖门 —— 现有 token/机制是否已覆盖 80% 价值？

借鉴前先查现有原语 + 用法模式是否真实高频：

- **增量复审**：spec-code-review 已有 `base:<sha-or-ref>` token（走 fast-path，直接用作 diff base 并跳过 scope 检测）。重审同一分支时传上次复审的 HEAD SHA = 增量复审，**零新机制**。
- **形态错配检查**：增量复审是 CodeRabbit 那类**云端高频 PR bot**的核心 UX（一个 PR 几百次 push）；spec-first 是**本地 CLI、单人、单会话**。把云端形态的重型 state 机制搬进来，违反抗膨胀（见 [[competitor-skill-borrowing-judgment]] 的"借功底不借形态"）。
- **核验自动化 caller**：声称"要保护 headless caller"前，先查它们实际怎么调。本案 spec-work 已显式传 `base:`（增量层对它根本不触发），所谓的防护多半是伪命题。

> 心法：提"新增 state + 脚本 + token"前，先问"现有的 `base:<sha>` 为什么不够？"。答案常是"用户不知道能这么用"——那只需**文档化既有能力**，不需新机制。

## Why This Matters

这两道门把"借鉴 AI 评审器"从"功能堆砌"拉回到 spec-first 的两条生死线：

- **evidence-first**：门 1 防止把 LLM 猜测包装成 confirmed 测试决策，守住"Scripts prepare facts, LLM decides"和"advisory facts 不是 confirmed truth"。
- **抗膨胀 + 80/20**：门 2 防止把云端 bot 形态错配到本地 CLI，守住 market memory 的"守四差异点 + 抗膨胀是生死线"。

两个 case 还各留下一个可复用的负面结论，省掉下次重新研究：
- 测试决策单的"点名回归"在 spec-first 语境永远不该进评审器（除非自身有 TIA provider）。
- 增量复审不值得建重型机制，`base:<sha>` 已够。

## When to Apply

1. **任何"给 code-review 借鉴某 AI 评审器特性"的请求**——先过两道门，不要直接列"可借清单"。
2. **借鉴的能力涉及"该测什么/影响哪些测试/回归选择"时**——门 1 优先：是 gap 识别（可借）还是测试选择（需 TIA，不可借）？
3. **提议"新增 state/脚本/token"时**——门 2 优先：现有 `base:<sha>` 或其他原语是否已覆盖？用法模式是否真实高频？
4. **声称"保护 headless/自动化 caller"时**——先 grep 实际调用方传了什么参数，别凭直觉建防护机器。

## Examples

**Case 1 — 测试决策单（门 1 否决）**

| 借鉴项 | 门 1 判定 | 裁决 |
| --- | --- | --- |
| 一句话结论 / 风险等级 | LLM 语义，且 SKILL 已有 Verdict | 已有，无需借 |
| 缺失测试点 | LLM gap 识别 | 可借（已有 testing_gaps） |
| 变更影响范围*解释* | LLM 语义 | 可借（advisory） |
| **必跑/建议/可选回归测试清单** | **需 TIA/覆盖，LLM 点名=幻觉** | **✗ 否决（无先例 + 撞 evidence boundary）** |

**Case 2 — 增量复审（门 2 否决）**

```text
初版方案: incremental-scope.sh + repo-local state + scope:full token + 5 单元
对抗评审核验:
  - base:<sha> 已提供手动增量（SKILL.md 行 110/277）        → 门 2 不过
  - spec-work 已显式传 base:，增量层对它不触发              → D4 防护伪命题
  - LLM merge-base --is-ancestor 与 set -euo pipefail 三态冲突 → 真技术缺陷
  - D5 carried-forward 只存提示不存 finding                 → 兑现不了"降噪"卖点
收敛结果: 2 单元文档计划——仅文档化 base:<sha> 的增量用法，零新机制
```

两案的共性：**借鉴对象的能力先过"是否需要本 harness 缺失的确定性数据"和"现有原语是否已覆盖"两道门，砍是默认、留要举证。**

## Related

- [[competitor-skill-borrowing-judgment]] — 通用四步借鉴方法论（本文是其在 code-review 域的具体落点；双重过滤的"覆盖检查"在此细化为两道域专属门）
- `spec-first-doc:业界学习/03-机制分析/review-testing/code-review-test-decision-sheet-analysis.md` — Case 1 的原始分析（含对 findings-schema 的逐字核验）
- `docs/plans/2026-06-09-001-feat-code-review-incremental-scope-plan.md` — Case 2 的计划（含 Rejected Heavy Mechanism 留档）
- `skills/spec-code-review/SKILL.md` — Capability-Class Evidence Boundary（provider 自报非 confirmed fact）、`base:<sha>` fast-path、Scenario Capability override
- `docs/solutions/workflow-issues/routing-skill-eval-methodology-2026-06-08.md` — 同源"对抗式评审验证结论"方法
