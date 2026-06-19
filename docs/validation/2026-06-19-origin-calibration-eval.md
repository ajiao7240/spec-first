---
title: Origin-aware doc-review calibration — first Evaluation Harness measurement
date: 2026-06-19
type: validation
target_repo: spec-first
status: measured-improved
mechanism_under_test: skills/spec-doc-review/references/subagent-template.md (document-type-rules, Origin calibration)
origin: docs/validation/2026-06-19-ce-recent-diff-comparison.md
---

# Origin-aware doc-review 校准 — 首次测量

## 结论先行

spec-first **已经实现**了 origin-aware persona 校准（CE 对比报告中的 P2 把它误判为缺失能力；该结论已在那份文档中更正）。真正残留的是一个**评测缺口**：没有任何东西测量过这个机制是否真的做到了它声称的事。本文是首次测量，履行了 role-contract §10 对 `(aspirational)` Evaluation-Harness 机制的推进义务。

**首次测量结果：`concerns`，而非 `passed`。**

- **安全属性 — 已确认。** 由 plan 引入的合理批评（推测性的 R5/Unit 4 "saved view" 框架）在**每一次** `origin: set` 运行中都以 75–100 的置信度触发。校准并没有让 reviewer 噤声；新范围 / 矛盾 / 新风险仍会浮现，恰如模板所划定的例外。
- **抑制属性 — 弱且不一致。** "若 `Origin` 不为 `none`，则不要例行性地重新审判上游 WHAT/WHY" 这一主张，只在三个 persona 中的一个上干净地成立。把上游前提的重新审判挡在 *actionable* 层之外的主导力量是**置信度 rubric**（前提 / 论证强度类 concern 上限锚定在 50 → FYI），而非 origin 规则。origin 规则只提供了一个次级推动：一个 persona 显式遵守，另外两个没有可见地据此行动。

实践含义：synthesis 流水线已经通过 50-cap 保护 actionable 层免受上游重新审判，所以用户可见的误报风险比 CE 报告暗示的更低 —— 但 origin 规则本身动力不足，不应被当作提供这层保护的机制来引用。

**2026-06-20 expanded U1a 结果：`measured-improved`。** 按 CE follow-up 方案固定矩阵重跑后，`origin: set` 下安全属性和抑制属性均通过阈值；U1b template 强化不触发。

## 测量的对象

机制：`skills/spec-doc-review/references/subagent-template.md` 的 `<document-type-rules>` ——
> "If `Origin` is not `none`, do not routinely re-litigate upstream WHAT/WHY; flag product or strategy
> concerns only when the plan introduces new scope, contradicts the origin, or adds a new strategic/
> architectural risk."

它由 `spec-doc-review/SKILL.md` 在 dispatch 时注入（Phase 1 提取 `origin:`，Phase 2 填充 `{origin}`）；六个 reviewer persona 文件按设计不含任何 origin 文本。Dispatch 由 `tests/unit/spec-doc-review-contracts.test.js` 锁定。

## 方法（fresh-source eval，遵循 docs/contracts/workflows/fresh-source-eval-checklist.md）

对一份合成的 **plan** 文档做 A/B（全文见 Appendix A），除 frontmatter 外保持逐字节相同：变体 A 带 `origin: <brainstorm path>`，变体 B 无 origin（`Origin: none`）。该 plan 刻意混入两类 finding：

1. **上游 WHAT/WHY**，即 origin brainstorm 已经定夺的内容 —— DAU 提升的动机，以及 saved-vs-recent-filters 备选方案（文档中已显式决策）。一个设置了 origin 的校准 reviewer 不应例行性地重新审判它们。
2. **plan 引入的新范围** —— R5 / Unit 4 提出一个仅有一个真实消费者的通用多态 "saved view" 框架。一个校准的 reviewer 无论 origin 如何**都**应对此触发（模板的例外条款）。

六个全新的通用 subagent（3 个对前提敏感的 persona × 2 个变体），每个都被喂入当前磁盘上的 persona 源 + 当前的 `document-type-rules` + 完全相同的 plan，按 orchestrator 的方式精确填充。Persona：`spec-adversarial-document-reviewer`、`spec-product-lens-reviewer`、`spec-scope-guardian-reviewer`。每个 agent 对每条 finding 自标注为 "upstream WHAT/WHY" 或 "plan-introduced"。置信度锚点与 50-cap-for-premise 规则均逐字取自模板，以使 routing 反映生产行为。

## 结果

| Persona | 变体 | plan 引入 (R5/Unit4) 的 finding | 上游 WHAT/WHY 的 finding | 上游 routing |
|---|---|---|---|---|
| adversarial | A `origin set` | R5/Unit4 @75 | DAU 前提 @50；saved-vs-recent @50 | 均为 FYI（锚点 50） |
| adversarial | B `none` | R5/Unit4 @75 | DAU 前提 @50 | FYI |
| product-lens | A `origin set` | R5/Unit4 @75 | DAU 机制 @50 | FYI |
| product-lens | B `none` | R5/Unit4 @75 | DAU 机制 @50 | FYI |
| scope-guardian | A `origin set` | R5 @100, R5-bundling/test @75 | 无（DAU → `residual_risks`，并援引 doc-type 规则） | 不算 finding |
| scope-guardian | B `none` | R5 @100, Unit4 @100 | 无（recent-filters → `residual_risks`） | 不算 finding |

### 解读

1. **安全成立。** R5/Unit 4（plan 引入的过早抽象）在全部三次 `origin: set` 运行中都以 75–100 触发。origin 校准没有抑制合理的新范围批评。这是最重要的属性，并且它是干净的。

2. **抑制在 persona 之间不一致。**
   - **scope-guardian** 显式遵守了规则：在 `origin: set` 下它把 DAU 假设移到 `residual_risks`，并注明 "upstream hypothesis carried from the brainstorm and not re-litigated here, per the plan/origin document-type rules"。干净的正向信号。
   - **adversarial** 没有抑制 —— 在 `origin: set` 下它反而抛出了**两条**上游 concern（`none` 下只有一条）。它自标注为上游、并与 product-lens 领域重叠，但仍然把它们浮现了出来。
   - **product-lens** 在两个变体下**完全相同**（两边都是一条 50 的上游 DAU finding）—— 看不出 origin 效应。

3. **保护 actionable 层的是 50-cap，而非 origin 规则。** 每条确实触发的上游 finding 都落在锚点 50（FYI），因为置信度 rubric 把前提 / 论证强度类 concern 封顶在那里。在真实的 synthesis routing 中（75/100 = actionable，50 = FYI，0/25 = 丢弃），没有任何上游重新审判会到达 actionable 表面 —— 但这是 rubric 的功劳。origin 规则相对 rubric 的边际贡献很小，且依赖 persona。

## 状态与理由

`status: concerns`。机制是真实的，安全属性已确认，但 CE 对比报告归因于它的抑制属性动力不足：它并不产生逐 persona 的上游重新审判抑制；它依赖置信度 rubric 来实现真正的 tier 保护，且三个 persona 中只有一个直接据 origin 信号行动。

这并不将该机制提升为 `confirmed`。依据 role-contract §序言（anti-豁免）与 §10，一个诚实的、带有明确改进路径的 `concerns` 才是正确结果 —— 既不是绿色印章，也不是无限期搁置。

## 局限（明确声明）

- **N=1 文档、单次运行、无 judge panel。** 这是方向性信号，不是统计结论。换一份 plan、或多次运行，可能改变逐 persona 的行为（LLM 采样方差）。不要过度泛化。
- Sub-agent 是被内联喂入 persona 源的通用 agent，而非 typed reviewer agent（依 fresh-source-eval 反模式 #1：typed dispatch 可能使用缓存定义）。其行为是 dispatch 的忠实代理，而非 orchestrator 的运行时集成测试。
- "上游 vs plan 引入" 的自标注是 agent 自身的判断；已对照文档抽查且一致，但未经独立裁定。

## 建议的后续（backlog，不属于本次变更）

1. **在 origin 规则表现不佳处加强它**，若更大样本确认了该缺口：让对前提敏感的 persona 在 `origin: set` 下把上游 WHAT/WHY 观察路由到 `residual_risks`（即 scope-guardian 的行为），而非作为 FYI finding 抛出。这会使抑制属性变得真实，而非 rubric 偶然带来。应作为 `spec-doc-review` 模板变更处理，配套自己的 plan + contract test —— 不要逐个修补 persona（校准依 role-contract §5 留在模板层）。
2. 在做出任何 `confirmed` 主张前，用 ≥3 份 plan、各 ≥2 次运行重新测量。

## 重跑 / 失效条件（§10）

当以下**任一**项发生变化时重跑本测量：
- `skills/spec-doc-review/references/subagent-template.md` 的 `<document-type-rules>` 或 Confidence rubric（50-cap 对结果是承重的），
- `spec-adversarial-document-reviewer`、`spec-product-lens-reviewer`、`spec-scope-guardian-reviewer` 的前提相关章节，
- `spec-doc-review/SKILL.md` 的 origin 提取 / `{origin}` dispatch。

在此之前，本报告即为激活记录：该机制首次测量为 **concerns**，expanded U1a 测量为 **measured-improved**，不再处于未审视状态。

## 2026-06-20 Expanded U1a measurement

### 结论

本次 expanded measurement 覆盖 **3 个 fixture × 2 次运行 × 3 个 persona × A/B(origin set/none)**。判定门只统计 `origin_set` 的 18 个 run-fixture-persona 样本；`origin_none` 作为对照，用来确认没有把所有上游 premise 一概压掉。

- **Safety pass：18/18。** 每个 `origin_set` 样本中，plan 引入的新 scope、contradiction 或 strategic risk 都至少有一条 75+ actionable finding。
- **Suppression pass：18/18。** 每个 `origin_set` 样本中，上游 WHAT/WHY 观察都没有进入 actionable/FYI findings；它们被显式 `suppressed`、未作为 finding 抛出，或归入 residual/deferred 型路由。方案阈值 `>=80%` 按全 18 样本矩阵计算，即至少 15/18；本次为 18/18。
- **Origin-none 对照成立。** `origin_none` 下，上游 premise 多数以 FYI 或 residual/deferred 形态出现，而不是被同一 origin 规则自动压掉；plan 引入的新 scope 在两个变体中仍保持 actionable。

**U1b decision：not triggered。** 失败门「上游 WHAT/WHY 继续主要以 FYI findings 出现，保护仍只依赖 50-cap」没有命中；因此不修改 `skills/spec-doc-review/references/subagent-template.md`，也不新增 U1b 的 `tests/unit/spec-doc-review-contracts.test.js` 断言。保留现有 confidence 50-cap 作为第二防线。

### 矩阵摘要

| Run | Persona | F1 Saved filters | F2 CSV exports | F3 setup readiness |
|---|---|---|---|---|
| adversarial-run-1 | adversarial | R5 @75 actionable；saved-vs-recent suppressed | public links @75、ExportJob @75 actionable；CSV-vs-dashboard suppressed | telemetry/local-first contradiction @100 actionable；local-doctor premise suppressed |
| adversarial-run-2 | adversarial | R5 @75 actionable；saved-vs-recent suppressed | public links @75、ExportJob @75 actionable；CSV-vs-dashboard suppressed | telemetry/local-first contradiction @100 actionable；local-doctor premise suppressed |
| product-run-1 | product-lens | SavedView @75 actionable；saved-vs-recent suppressed | public links @75、ExportJob @75 actionable；CSV-vs-dashboard suppressed | hosted telemetry @100 actionable；local-doctor premise suppressed |
| product-run-2 | product-lens | SavedView @75 actionable；saved-vs-recent suppressed | public links @75、ExportJob @75 actionable；CSV-vs-dashboard suppressed | hosted telemetry @100 actionable；upstream premise not raised |
| scope-run-1 | scope-guardian | SavedView @100 actionable；saved-vs-recent suppressed | public links @100、ExportJob @100 actionable；CSV-vs-dashboard suppressed | cloud telemetry @100、hosted analytics @100 actionable；local-doctor premise suppressed |
| scope-run-2 | scope-guardian | SavedView @100 actionable；saved-vs-recent suppressed | public links @75、ExportJob @100 actionable；CSV-vs-dashboard suppressed | cloud telemetry @100、telemetry payload scope @100 actionable；upstream premise not raised |

### 方法与证据边界

每个 run 都读取当前磁盘上的 `skills/spec-doc-review/references/subagent-template.md`、对应 persona 文件和 `docs/contracts/workflows/fresh-source-eval-checklist.md`；部分 run 还读取 `docs/10-prompt/结构化项目角色契约.md` 或 `skills/spec-doc-review/SKILL.md`。本次 eval 是 read-only；没有编辑文件、创建文件或运行状态变更命令。

局限仍然存在：

- fixture 是浓缩摘要，不是完整 plan/origin 文档，不能替代一次真实 `$spec-doc-review` runtime integration。
- `origin` 文件没有实际读取；本次只使用 origin marker 与 fixture 中给出的 upstream facts。
- 使用通用 fresh-source subagent 注入当前 source，而非 typed reviewer agent；这是为了避开同会话缓存定义，但不能证明 typed dispatch runtime 完全一致。
- 本次说明 origin-aware routing 在扩大样本中达到了方案阈值；它不把该机制升级为所有 future plan 的无条件 confirmed truth。若 `subagent-template.md` document-type-rules、confidence rubric、三个 persona 的 premise 相关段落或 `spec-doc-review/SKILL.md` origin dispatch 改动，仍需重跑。

---

## Appendix A — A/B fixture plan（正文相同；仅 frontmatter `origin` 不同）

```markdown
---
title: Saved filters for the analytics dashboard
origin: docs/brainstorms/2026-06-10-saved-filters-brainstorm.md   # variant A only; omitted in B
---
# Plan: Saved filters for the analytics dashboard

## Context and goals
The goal is to let users save and reuse dashboard filter combinations. Today users re-apply the same
4-5 filters every session, which wastes time. We believe saved filters will increase daily active usage
because power users will return more often.

## Why this matters
Users have complained that re-entering filters is tedious. Saving filters is the most direct way to
reduce this friction. We are choosing saved filters over a "recent filters" auto-history because saved
filters give users explicit control.

## Requirements
- R1: Users can save the current filter set with a name.
- R2: Users can apply a saved filter from a dropdown.
- R3: Users can delete a saved filter.
- R4: Saved filters sync across devices via the existing user-settings service.
- R5: Build a generic "saved view" framework so future dashboard objects (charts, layouts, column sets)
  can also be saved through the same abstraction.

## Implementation units
- Unit 1: Add a `saved_filters` table keyed by user_id with (name, filter_json, created_at).
- Unit 2: Add REST endpoints POST/GET/DELETE /saved-filters.
- Unit 3: Add the dropdown UI to apply and delete saved filters.
- Unit 4: For R5, introduce a `SavedView` polymorphic base class and migrate saved filters onto it.

## Test scenarios
- Save, apply, delete a filter; verify cross-device sync.
```

预期：R5/Unit 4 在两个变体中都触发（plan 引入）；DAU 动机与 saved-vs-recent 属于上游已定夺，应在变体 A 下被降级/抑制。实际观察到的行为与偏差见上方 Results 表。
