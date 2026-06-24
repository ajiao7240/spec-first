---
title: "refactor: spec-prd existing grill-to-PRD mental map"
type: refactor
status: superseded
date: 2026-06-24
spec_id: 2026-06-23-005-spec-prd-grill-first-clarification
origin: docs/brainstorms/2026-06-23-005-refactor-spec-prd-grill-first-clarification-requirements.md
superseded_by: docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md
implements_schemas: []
---

# refactor: spec-prd existing grill-to-PRD mental map

Superseded by [docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md](2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md), which reopens the goal from first principles and treats Product Expert Lens as a first-class PRD clarification capability instead of limiting the design to current references.

## Summary

本方案校准上一版“two-stage grill and PRD adapter”思路：`$spec-prd = 问透需求 + 写成标准 PRD + readiness 守门` 这个概念视图成立，但它不是新增架构。当前 `skills/spec-prd/references/` 已经具备三段物理结构：

| 概念视图 | 当前 source 对应 |
| --- | --- |
| Requirements Grill | `references/grill-with-docs-integration.md` + `references/domain-language-and-decision-ledger.md` |
| 标准 PRD 写入 | `references/prd-output-template.md` |
| Readiness Lens | `references/prd-readiness-lens.md` |

因此本次最终方案不是新建 `PRD Writer Adapter`、字段映射表或负向测试，而是在 `skills/spec-prd/SKILL.md` 的 Purpose 补一条心智地图：`Requirements Grill -> Standard PRD write-in -> Readiness Lens`。这让 owner 一眼看出 `$spec-prd` 的目标是先澄清需求、前置暴露下游会追问的 WHAT gaps，再把闭合结果写进标准 PRD，并用 readiness 判断 `spec-plan` / `spec-work` 是否还会回头发明产品行为。

---

## Decision Brief

- **Recommended approach:** 不新增部件；只在 `SKILL.md` Purpose 中显式标出已有三段关系。
- **Key correction:** `to-prd` 只保留为一次性启发：它提示“把讨论综合成 PRD”，但不进入 `$spec-prd` 的长期架构命名、字段映射、测试矩阵或 runtime dependency。
- **Validation focus:** 验证 source 文案没有把 `PRD Writer Adapter` 固化为实施对象；确认 source/runtime 边界仍然是 `skills/spec-prd/**` -> generated mirrors。
- **Completion state:** 最小 source 改动已落到 `skills/spec-prd/SKILL.md`；本 plan 作为纠偏后的决策记录。

---

## Problem Frame

用户对 `$spec-prd` 的本质判据已经明确：

> 澄清需求文档，减少后续技术方案、开发任务阶段的细节确认，把问题前置暴露并确认。

换成 workflow 判据，不是“问了多少问题”，而是后续 `spec-plan`、任务拆分、`spec-work` 是否还会因为 PRD 缺少 `谁用 / 流程 / 边界 / 异常 / 权限 / 验收 / 哪些不做 / 哪些是假设 / 哪些要 owner 拍板` 而回头确认或自行补 WHAT。

上一版方案把正确的三段概念写成 `Requirements Grill Engine -> PRD Writer Adapter -> Readiness Lens`。问题不在三段式，而在把第二段命名成了一个新 adapter，并把 `to-prd` 的字段结构变成长期实现对象。按角色契约 §7，这属于“借鉴 mechanism 正确，但过对标导致形态耦合”。

---

## Goals

- G1. 让 `$spec-prd` 的 Purpose 直接表达完整目标：问透需求、标准化写入 PRD、readiness 判断下游是否还会 invent WHAT。
- G2. 保持现有物理结构：grill 细节在 grill/domain references，PRD 写入在 output template，readiness 在 readiness lens。
- G3. 把 `to-prd` 降级为历史启发，不成为 source/runtime dependency、adapter 命名、字段映射表或测试矩阵。
- G4. 保持 Light contract：只补心智地图，不新增 schema、artifact、public workflow、agent、CLI command 或 runtime topology。

## Non-Goals

- 不新建 `PRD Writer Adapter` 或 `conversation-to-PRD adapter`。
- 不新增 `to-prd` 字段到 spec-first PRD sections 的专用映射表。
- 不新增“防 `to-prd` 泄漏”的负向测试；现有 `WHAT not HOW`、artifact boundary、issue-tracker absence 已由 `$spec-prd` 边界承担。
- 不直接串联外部 `grill-with-docs` + `to-prd` skill。
- 不修改 generated runtime mirrors 作为 source fix；runtime 只通过 `spec-first init` 从 source 投影。

---

## Current Implementation Read

当前 source 已经覆盖用户目标：

- `skills/spec-prd/SKILL.md` Purpose 已要求先用 source-first `grill-with-docs` discipline 澄清，再写 WHAT/WHY、current-state evidence、acceptance、scope boundaries、assumptions、unresolved blockers，让 `spec-plan` 不发明 product behavior。
- `references/grill-with-docs-integration.md` 与 `references/domain-language-and-decision-ledger.md` 承担一问一答、source-first、术语挑战、场景压测、source/user/glossary contradiction、named gap、PRD write target、closure state。
- `references/prd-output-template.md` 承担标准 PRD skeleton、section selection、surface lenses、gap-to-target mapping，把澄清结果写入 durable PRD artifact。
- `references/prd-readiness-lens.md` 承担 handoff entropy / planning invention 判断：是否还有 actor、flow、state、exception、scope、permission、acceptance、release-slice、terminology 等 WHAT 需要下游补。

这说明真正缺口不是能力缺失，而是 `SKILL.md` 顶层 Purpose 需要把三段关系说清楚，避免后续读者再次把它理解成“需要新造 adapter”。

---

## Target Flow

```text
+-----------------------------+
| $spec-prd                  |
| existing workflow spine    |
+-------------+---------------+
              |
              v
+-----------------------------+
| Intake + Sanitization       |
| claims / evidence / HOW     |
+-------------+---------------+
              |
              v
+-----------------------------+
| Requirements Grill          |
| source-first, one question  |
| named gap + PRD write target|
+-------------+---------------+
              |
              v
+-----------------------------+
| Standard PRD Write-In       |
| use prd-output-template     |
| write WHAT into sections    |
+-------------+---------------+
              |
              v
+-----------------------------+
| Readiness Lens              |
| would downstream invent WHAT?|
+-------------+---------------+
              |
      +-------+--------+
      |                |
      v                v
+------------+   +--------------------+
| spec-plan  |   | ask / revise /     |
| handoff    |   | block / route out  |
+------------+   +--------------------+
```

---

## Why Not `PRD Writer Adapter`

1. **命名冲突。** 当前 `$spec-prd` 已有 `Context / ADR Topology Adapter`，语义是把外部副作用边界化；再引入 `PRD Writer Adapter` 会让同一个 skill 里 `adapter` 同时指“副作用边界”和“字段映射”，降低可读性。
2. **耦合错误。** `to-prd` 的长期行为包括 no-interview、issue tracker publish、Implementation Decisions、Testing Decisions；这些都不是 `$spec-prd` 的 contract。把它命名进架构，会把一次性启发变成长期耦合。
3. **能力已存在。** HOW 剥离由 PRD Sanitization / WHAT not HOW 负责；综合进 section 由 `prd-output-template.md` 的 gap-to-target mapping 负责；readiness 已检查下游是否会 invent WHAT。
4. **边际收益为零或负。** 新 adapter、字段表、负向测试不会让下游少问更多 WHAT，反而增加维护面和误解成本。

---

## Implementation Unit

### U1. Purpose mental map only

**Goal:** 在 `skills/spec-prd/SKILL.md` Purpose 中补一句三段心智地图，明确这是现有 references 的关系，不是新增部件。

**Files:**
- Modify: `skills/spec-prd/SKILL.md`
- Modify: `docs/plans/2026-06-24-001-refactor-spec-prd-two-stage-grill-prd-adapter-plan.md`
- Modify: `CHANGELOG.md`

**Applied wording intent:**

```text
$spec-prd = Requirements Grill -> Standard PRD write-in -> Readiness Lens
```

并明确它不是：

```text
new component / adapter / external skill chain / persistent artifact topology
```

**Verification:**
- `git diff --check` 覆盖本次改动文件。
- focused Jest 覆盖 changelog 与 plan taxonomy。
- source 改动后通过 `spec-first init` 从 source 刷新 generated runtime mirrors，报告未手改 mirrors。

---

## Completion Criteria

- `skills/spec-prd/SKILL.md` Purpose 明确 `$spec-prd` 是现有 `Requirements Grill -> Standard PRD write-in -> Readiness Lens` 流程。
- 本 plan 不再规划 `PRD Writer Adapter`、`to-prd` 字段映射表或专门负向测试。
- `to-prd` 只作为 rejected/absorbed design inspiration 出现在决策说明中，不成为 runtime dependency。
- 用户目标以 readiness 判据表达：后续 planning/work 是否仍会回头问或发明 WHAT。
- 变更同步 `CHANGELOG.md`，并注明 generated runtime mirrors 只经 generator 刷新。

---

## Source / Runtime Boundary

- Source-of-truth: `skills/spec-prd/SKILL.md`、`skills/spec-prd/references/**`、`docs/plans/**`、`CHANGELOG.md`。
- Generated runtime mirrors: `.claude/**`、`.codex/**`、`.agents/skills/**`。
- 本次不手改 generated runtime mirrors；如 source 变更需要宿主 runtime 更新，只运行 `node bin/spec-first.js init --claude --codex -y --lang zh`。

---

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| 读者继续把三段概念理解成新增架构。 | Purpose 句子直接说明是 mental map over existing references。 |
| `to-prd` 被重新固化为 adapter。 | 本 plan 明确 `to-prd` 是历史启发，不建命名部件、不建字段表。 |
| 顶层 Purpose 继续过长。 | 只加一条短句，细节仍留在 references。 |
| generated runtime 与 source 漂移。 | source 改完后走 `spec-first init` 投影，不手改 mirrors。 |

---

## Final Decision

`$spec-prd` 的目标理解是验收标尺；它指向的最小实现是：

```text
不新增部件。
不串联外部 skill。
不把 to-prd 字段固化进架构。
只在 SKILL.md Purpose 补现有三段心智地图。
```

这比上一版 adapter plan 更符合角色契约的 `Light contract + Explicit boundaries + Let the LLM decide`：已有能力继续承担实际执行，新增内容只改善读者对目标和结构的理解。

---

## Sources & References

- Origin document: [docs/brainstorms/2026-06-23-005-refactor-spec-prd-grill-first-clarification-requirements.md](../brainstorms/2026-06-23-005-refactor-spec-prd-grill-first-clarification-requirements.md)
- Prior implementation plan: [docs/plans/2026-06-23-002-refactor-spec-prd-grill-first-clarification-plan.md](2026-06-23-002-refactor-spec-prd-grill-first-clarification-plan.md)
- Source workflow: [skills/spec-prd/SKILL.md](../../skills/spec-prd/SKILL.md)
- Grill integration reference: [skills/spec-prd/references/grill-with-docs-integration.md](../../skills/spec-prd/references/grill-with-docs-integration.md)
- Domain reference: [skills/spec-prd/references/domain-language-and-decision-ledger.md](../../skills/spec-prd/references/domain-language-and-decision-ledger.md)
- Output template reference: [skills/spec-prd/references/prd-output-template.md](../../skills/spec-prd/references/prd-output-template.md)
- Readiness reference: [skills/spec-prd/references/prd-readiness-lens.md](../../skills/spec-prd/references/prd-readiness-lens.md)
