---
date: 2026-04-19
topic: sdd-riper-integration
focus: 将 sdd-riper 中可迁移的协作约束集成到 spec-first，以提升当前项目质量
status: initial
---

# Ideation: sdd-riper 可集成能力评估

## Codebase Context

`spec-first` 当前已经是工程化 workflow CLI，而不是单纯 prompt pack。它包含 CLI 控制面、Claude/Codex 双宿主 adapter、Stage-0 graph bootstrap、CRG/AST/SQLite 分析、workflow skills、persona review、compound knowledge、schema contract、runtime governance 和较完整测试体系。

当前仓库的核心原则是：

```text
轻 contract + 明确边界 + 让 LLM 决策
```

因此，`sdd-riper` 中最值得迁移的不是完整 `Research -> Innovate -> Plan -> Execute -> Review` 状态机，而是它对协作质量有高杠杆作用的轻量约束：

- 先复述理解，减少任务误读。
- 明确当前核心目标，防止长链路漂移。
- 执行前 checkpoint，暴露范围、风险和验证方式。
- 执行后 reverse sync，把偏差和证据回写到持久 artifact。
- Review 按 spec 质量、spec-code 一致性、代码自身质量三轴验收。
- Archive 把任务中间产物沉淀成人类汇报版和 LLM 复用版。

这些机制与 `spec-first` 的方向兼容，但必须改造成“决策输入增强”，不能变成新的强编排状态机。

## Ranked Ideas

### 1. 引入轻量 `Goal / Done / Checkpoint` 工作流锚点

**Description:** 在 `spec-brainstorm`、`spec-plan`、`spec-work` 的 skill contract 中统一加入一个短小锚点结构：当前任务理解、核心目标、Done Contract、边界、下一步、风险、验证方式。它不替代现有 requirements/plan/stage0 context，只作为每轮关键节点的热上下文。

**Rationale:** `spec-first` 已经有 Stage-0 和 plan artifact，但在长会话中仍可能出现“模型知道很多上下文，但当前动作偏离目标”的问题。sdd-riper light 的强项正是用极短 checkpoint 对抗漂移。这个能力符合当前项目原则：它不是执行树，只是更好的 LLM 决策输入。

**Downsides:** 如果写得太机械，会增加 skill 文本噪音。需要明确“关键节点才复述”，避免每轮固定输出。

**Confidence:** 92%

**Complexity:** Low

**Status:** Unexplored

### 2. 为 `spec-work` 增加 `Reverse Sync / Closure Summary`

**Description:** 在 `spec-work` 的收尾规则中增加强约束：执行后必须把实际改动、计划偏差、验证证据、剩余风险和恢复锚点回写到 plan 或 run artifact。可以先从 skill contract 做起，后续再考虑结构化文件。

**Rationale:** 当前 `spec-work` 已要求按 plan 执行、更新 checkboxes、运行验证，但“执行结果如何反向同步到持久 artifact”还可以更硬。sdd-riper 的 `Reverse Sync` 能提高交接、复盘、review 和 compound 的质量，尤其适合当前项目已有 `docs/plans/`、`.spec-first/workflows/`、`docs/solutions/` 的资产体系。

**Downsides:** 如果直接修改 plan 文档，可能和用户手写计划产生编辑冲突。更稳的方式是先写入 `.spec-first/workflows/spec-work/<run-id>/closure-summary.md`，再由用户或后续 workflow 选择是否回填 plan。

**Confidence:** 90%

**Complexity:** Medium

**Status:** Unexplored

### 3. 在 `spec-code-review` 顶层增加三轴 Review Verdict

**Description:** 在 persona findings 合并后，增加一个顶层三轴 verdict：`Requirement Completion`、`Plan/Diff Fidelity`、`Intrinsic Code Quality`。这不是替代 17 persona，而是把多角色 findings 聚合成更容易决策的审查矩阵。

**Rationale:** sdd-riper 的三轴 review 很适合补齐 `spec-first` 的“最后决策视图”。当前 `spec-code-review` persona 很强，但输出可能偏 finding 列表；三轴 verdict 可以帮助用户判断：需求是否完成、实现是否忠实于计划、代码本身是否值得合并。

**Downsides:** 需要避免把三轴 verdict 写成硬 gate。它应该是审查摘要和决策输入，具体是否阻断仍由 severity、routing、用户判断和分支保护决定。

**Confidence:** 88%

**Complexity:** Medium

**Status:** Unexplored

### 4. 将 sdd-riper 的 `Archive` 思想并入 `spec-compound`

**Description:** 扩展 `spec-compound` 的输出视角，让它支持两类沉淀：human-facing summary 和 LLM-facing reusable context。human 版关注目标、决策、结果、风险；LLM 版关注约束、接口、代码触点、模式、反模式和来源追踪。

**Rationale:** `spec-first` 已经有 compound 和 `docs/solutions/`，不需要复制 sdd-riper 的 `archive_builder.py`。但 sdd-riper 的双视角归档很有价值，可以让同一次任务沉淀同时服务团队复盘和后续 Agent 检索。

**Downsides:** `docs/solutions/` 现在已有 YAML frontmatter 和分类规范，引入双视角时不能破坏现有 learnings researcher 的检索假设。

**Confidence:** 84%

**Complexity:** Medium

**Status:** Unexplored

### 5. 把 `Restate First / Core Goal as Loop Anchor` 融入高风险 workflow

**Description:** 对 `spec-plan`、`spec-work`、`spec-debug`、`spec-code-review` 加入轻量规则：任务开始、执行前、发现偏差、验证收尾时，必须重新对齐“当前核心目标是否变化、还差什么、下一步唯一动作是什么”。

**Rationale:** 这能直接降低上下文腐烂和范围蔓延。它比完整 RIPER 更轻，也不需要新增 CLI 机制。对 `spec-debug` 尤其有帮助，因为 debug 很容易从“定位根因”漂移成“顺手改很多相关问题”。

**Downsides:** 需要在输出风格上克制，避免让每个 workflow 都变成长篇仪式。

**Confidence:** 82%

**Complexity:** Low

**Status:** Unexplored

### 6. 强化多项目 / workspace 的边界声明

**Description:** 借鉴 sdd-riper 的 `active_project`、`active_workdir`、`change_scope=local/cross`、`Contract Interfaces`，为 `spec-first` workspace v1 / cross-repo 计划增加更明确的边界输入。它可以先出现在 `spec-plan` 的跨项目 implementation units 和 `spec-work` 的允许改动面检查中。

**Rationale:** `spec-first` 已有 workspace context 和跨 repo 规划文档，但 sdd-riper 的边界语言更直观。把它转译成 `active_repo`、`change_scope`、`contract_interfaces` 后，能提高跨项目任务的可审查性和安全性。

**Downsides:** 当前项目已经有 workspace/compiler/loader 边界，不能再造一套平行 registry。必须映射到已有 workspace contract，而不是新增第二套矩阵。

**Confidence:** 78%

**Complexity:** Medium

**Status:** Unexplored

### 7. 将 `Reload Before Act` 与 Stage-0 freshness 结合

**Description:** 当 `stage0-context` 输出 `fallback_reason: freshness_stale` 或 context level 降级时，workflow skill 应提示模型在关键动作前回读相关源文件、计划或 Stage-0 artifact，而不是继续信任旧摘要。

**Rationale:** 当前 runtime 已经能输出 `freshness_stale`，但 workflow 文本可以更明确地把它转化成模型行为：降级不阻塞，但要降低信任并补读事实。这正好吸收 sdd-riper 的 anti-decay 思路。

**Downsides:** 已有 2026-04-19 的 Top 3 决策输入硬化计划覆盖了 Stage-0 质量等级；这个 idea 应作为该计划的 skill 消费侧补充，而不是另开一条重叠主线。

**Confidence:** 76%

**Complexity:** Low

**Status:** Unexplored

## Recommended Priority

建议按以下顺序进入后续 brainstorm / plan：

1. **先做 workflow prompt contract 层增强**：Idea 1、5、7。低成本，高质量收益，最符合“轻 contract”。
2. **再做执行闭环 artifact**：Idea 2。它能把 plan、work、review、compound 串成更强闭环。
3. **再做 review 聚合视图**：Idea 3。它能提升 review 结果的决策可读性。
4. **最后做 compound/archive 双视角沉淀**：Idea 4。价值高，但要保护现有 `docs/solutions/` 检索结构。
5. **跨项目边界增强单独规划**：Idea 6。它牵涉 workspace contract，不应混入轻量 prompt 改造。

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | 直接把 `sdd-riper-one` 作为新的 spec-first workflow | 重复已有 `ideate -> brainstorm -> plan -> work -> review -> compound`，且会引入强状态机倾向 |
| 2 | 全局强制精确短语 `Plan Approved` | `spec-first` 已有更灵活的 approval/plan/work 机制；精确短语会降低多宿主易用性 |
| 3 | 复制 `archive_builder.py` 到 spec-first | 当前脚本是启发式 markdown 抽取，质量低于 `spec-compound` 应有标准 |
| 4 | 新增 `mydocs/` 产物目录 | 与当前 `docs/brainstorms`、`docs/plans`、`docs/solutions`、`.spec-first/workflows` 体系冲突 |
| 5 | 用人工 `create_codemap` 替代 CRG/Stage-0 | 当前项目已有更强的 AST/CRG 事实底座，手写 codemap 应作为人类视图而非主路径 |
| 6 | 引入 `zero spec` 通道 | 与当前 repo 的治理目标相悖，容易绕过 changelog、测试和 source-of-truth 边界 |
| 7 | 在 README 中再维护一套 skill/entrypoint 矩阵 | 违反 dual-host governance：分类源应保持在 `skills-governance.json` 等现有 contract 中 |
| 8 | 将 Review FAIL 变成 CLI 硬阻塞 | 与项目原则冲突；review 应提供高质量决策输入，最终阻断由 severity、routing、CI 和用户决策共同决定 |

## Fit With Current Roadmap

当前已有两个相关未跟踪计划：

- `docs/plans/2026-04-19-002-spec-first-optimization-roadmap.md`
- `docs/plans/2026-04-19-003-top3-decision-input-hardening-plan.md`

本 ideation 不应替代这两个计划。更合适的关系是：

- Top 3 硬化计划负责 **Stage-0 / asset consistency / doctor** 这类控制面可信度。
- 本 ideation 负责 **workflow skill 消费侧** 的轻量协作纪律。
- 两者共同目标都是提高 LLM 决策输入质量，而不是增加重编排。

## Candidate Implementation Themes

如果后续进入 `spec-brainstorm`，建议把范围拆成三个主题：

### Theme A: Lightweight Workflow Anchors

覆盖 Idea 1、5、7。

目标是统一 `Goal / Done / Checkpoint / Freshness Response` 的最小写法，只改 skill contract 和 contract tests。

### Theme B: Work Closure and Reverse Sync

覆盖 Idea 2。

目标是为 `spec-work` 增加执行闭环产物或 plan 回写规范，明确实际改动、偏差、验证、剩余风险、恢复锚点。

### Theme C: Review Decision Matrix

覆盖 Idea 3。

目标是让 `spec-code-review` 在 persona findings 之外输出三轴 verdict，提升最终决策可读性。

Archive 双视角和多项目边界建议作为后续主题，不与前三个混做。

## Session Log

- 2026-04-19: Initial ideation — 15 个候选方向生成，7 个保留，8 个拒绝；结论是吸收 sdd-riper 的轻量协作约束，而不是复制 RIPER 状态机。
