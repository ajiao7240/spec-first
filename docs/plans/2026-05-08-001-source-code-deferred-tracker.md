---
title: "tracker: doc 2 source-code review deferred findings"
type: tracker
status: backlog
date: 2026-05-08
spec_id: 2026-05-08-001-source-code-deferred-tracker
target_repo: spec-first
origin: docs/项目审查/2026-05-07-source-code-comprehensive-review.md
parent_plan: docs/plans/2026-05-07-001-feat-skill-agent-quality-governance-plan.md
---

# tracker: doc 2 source-code review deferred findings

## Summary

`docs/plans/2026-05-07-001-feat-skill-agent-quality-governance-plan.md` 只承接 `docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md`（doc 1）的 P1/P2。`docs/项目审查/2026-05-07-source-code-comprehensive-review.md`（doc 2）中识别的 source-code 层 P1 与若干治理类 finding 在父计划之外，由本 tracker 接续治理。

本 tracker 不是 plan，不直接产出 source-mod；它的职责是登记 deferred finding、reaffirm 触发条件、owner 与 due target，并在条件满足时孵化具体 plan。

## Tracked Findings

| Finding ID | Source path & section | Topic | Severity | Reaffirm trigger | Owner | Status |
|---|---|---|---|---|---|---|
| doc2-P1-1 | `docs/项目审查/2026-05-07-source-code-comprehensive-review.md#p1-1-managed-state-删除路径缺少-final-containment-guard` | `src/cli/state.js` final containment guard | P1 | 任何 `spec-first clean` / `init reset` 执行路径变更 | unassigned | open |
| doc2-P1-2 | `#p1-2-codex-legacy-cleanup-删除-agentsplugins-根目录` | `.agents/plugins` Codex marketplace cleanup ownership | P1 | 任何 `src/cli/adapters/codex.js` runtime cleanup 路径变更 | unassigned | open |
| doc2-P1-4 | `#p1-4-package-lock-版本与-package-version-漂移` | `package.json` / `package-lock.json` 版本漂移 | P1 | 下次 release 前必修 | unassigned | open |
| doc2-P1-5 | `#p1-5-spec-standards-使用错误-impact-capabilities-canonical-path` | `spec-standards` impact capabilities canonical path 漂移 | P1 | 任何 spec-standards / impact 模块改动 | unassigned | open |
| doc2-P1-6 | `#p1-6-public-workflow-helperreference-runtime-delivery-contract-不闭环` | public workflow helper / reference runtime delivery 不闭环 | P1 | 下次 `spec-first init --claude\|--codex` 验证或新增 public workflow | unassigned | open |
| doc1-FYI-1 | `docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md` Section 12 | 4 类薄契约单文件 vs 拆分 | FYI | governance contract 文件总长 > 600 行 | unassigned | open |
| doc1-FYI-3 | 同上 | competitive-intelligence agent "新增 vs 收敛" 路径复审 | FYI | 出现首个 consumer workflow | unassigned | open |
| doc1-P2-SE-3 | 同上 | researcher 调用外部 social platform 的 IP/身份隐私 | P2 advisory | 任何 researcher agent 增加新 social-platform 来源 | unassigned | open |
| doc1-FYI-2 | 同上 | Risks mitigation 加 "Verified by" | FYI | 已在 父计划 revision 2 应用，关闭 | resolved | closed |
| review-meta-1 | doc 1 / doc 2 | P-numbering 不统一 | meta | 下次跨 review 引用时 | unassigned | open |
| review-meta-2 | doc 1 / doc 2 | URL freshness 时间戳缺失 | meta | 下次跨 review 引用时 | unassigned | open |
| review-meta-3 | doc 2 | Coverage Ledger Appendix 体积大 | meta | 下次大规模 source review 时 | unassigned | open |
| review-meta-4 | doc 2 | "6 个 agent 分片" 缺 per-agent raw output | meta | 下次大规模 source review 时 | unassigned | open |
| dispatch-failure-1 | session 2026-05-07 | reviewer dispatch 失败（1m context + server panic）根因记录 | infra | reviewer 恢复后第一次 doc-review | unassigned | open |
| review-rerun-1 | session 2026-05-07 | 父计划在 fallback 模式审查，需 multi-persona cross-check | infra | reviewer dispatch 恢复 | unassigned | open |
| review-flow-improvement-1 | session 2026-05-07 | 审查流程改进（meta 短板综合） | meta | 收齐 review-meta-1..4 后孵化独立 plan | unassigned | open |

## Conventions

- `Reaffirm trigger` 是触发条件，不是截止日期；条件满足时 finding 应被孵化为正式 plan 或并入相邻 plan。
- `Status` 取值：`open` / `in-plan` / `resolved` / `wontfix`（wontfix 必须含理由）。
- 新增 finding 引用必须给 `Source path & section` 锚点；模糊引用不接受。
- tracker 只登记不实施；任何 source-mod 必须开新 plan。
- tracker 自身保持 < 150 行；超过则按主题拆分子 tracker。

## Linkage

- 父计划：`docs/plans/2026-05-07-001-feat-skill-agent-quality-governance-plan.md`（revision 2）
- 父计划 Review Plan 节要求所有 advisory / FYI / 不在范围 finding 写入本 tracker。
- 父计划 Risks 表中 "reviewer dispatch 失败" 行的 followup 指向本 tracker `dispatch-failure-1` / `review-rerun-1`。

## Open Questions

- 需要 owner 分配机制：tracker 当前所有 entry owner 为 unassigned；建议在下次 standup / planning 中按 finding 主题分组 assign。
- review-meta / review-flow-improvement 类 finding 是否需要单独的 "审查流程改进" plan？建议在收齐 4 条 meta finding 后由 owner 评估。
