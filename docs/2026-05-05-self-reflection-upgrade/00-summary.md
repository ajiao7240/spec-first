---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/10-prompt/自我进化.md
  - docs/10-prompt/结构化项目角色契约.md
  - AGENTS.md
  - README.md
  - README.zh-CN.md
  - package.json
  - skills/
  - agents/
  - templates/
  - src/cli/contracts/
  - docs/README.md
  - docs/业界分析/
  - docs/solutions/
  - .spec-first/graph/provider-status.json
  - .spec-first/graph/graph-facts.json
  - .spec-first/audits/skill-audit/latest/
  - local references under /Users/kuang/xiaobu/
---

# Cycle 0 Self-Reflection Upgrade Summary

## Executive Summary

本轮建议进行少量能力升级，但升级形态应限制在 L1 Contract Upgrade 和少量 L2 Routing / handoff clarification。Cycle 0 没有证据支持新增 `spec-evolve`、新 command、新 agent profile、新 runtime workflow 或自动重构系统。

核心判断：

- 现有 `spec-skill-audit + spec-doc-review + spec-plan + spec-code-review + spec-compound + spec-graph-bootstrap + spec-mcp-setup` 组合足以完成本轮 report-only 自我审视。
- 现有组合不足以稳定、重复地产生“能力缺口 -> CUD -> plan handoff -> review -> compound -> next-cycle input”的统一证据链。
- 外部最佳实践没有推翻 spec-first 的轻量哲学，反而强化了“先证明缺口，再增加复杂度”的判断。
- 最大风险不是缺少一个新 workflow，而是自我进化证据散落在历史审查、外部参考、compound 文档和本轮 prompt 中，后续很容易只生成漂亮报告而没有 CUD 反馈闭环。

本轮 report-only，因为目标文档明确禁止新增 skill、command、agent、script、runtime 改造和实现落地。本轮产物只提供审视报告、能力缺口、外部实践对照、CUD、roadmap、plan/review/compound handoff 和下一轮输入。

## Follow-up Fix Status

用户要求逐项修复后，CUD-001..005 已进入 `spec-plan` handoff，并以 docs-only source contract 方式落地：

- plan handoff: `docs/plans/2026-05-05-003-docs-self-reflection-contract-plan.md`
- source contract: `docs/contracts/workflows/self-reflection-capability-upgrade.md`
- prompt link: `docs/10-prompt/自我进化.md`
- index link: `docs/README.md`
- review gate: `docs/validation/2026-05-05-self-reflection-contract-doc-review.md`
- compound record: `docs/solutions/workflow-issues/self-reflection-cud-contract-loop-2026-05-05.md`

这次 follow-up 仍然不新增 `spec-evolve`、skill、agent、script、command 或 runtime workflow。

## 本轮是否建议进行能力升级

建议升级，但不建议实现型升级。

| Decision type | Count | Meaning |
|---|---:|---|
| Accepted | 5 | 接受为后续 plan 输入，限 L1/L2，不在本轮实现 |
| Skipped | 2 | 明确不做，避免系统膨胀 |
| Deferred | 2 | 证据不足或需要 dogfood / eval 后再决定 |

## Key Capability Gaps

| Gap | Summary | Evidence strength | Candidate level |
|---|---|---|---|
| CG-001 | 自我审视报告链路已有 prompt，但缺少稳定的 source-level composition contract | Strong | L1 |
| CG-002 | 外部最佳实践与本地参考项目缺少 freshness / applicability / counter-signal intake 规范 | Medium | L1 |
| CG-003 | CUD 后续是否被 plan、review、compound 反馈，当前没有统一追踪字段 | Medium | L1/L2 |
| CG-004 | graph/provider facts 可用但在本轮已显示 stale / partial，不足以作为自我审视强证据 | Strong | L1/L2 |
| CG-005 | skill/prose 语义变更已有 fresh-source eval 规则，但没有绑定到自我升级 CUD 验证期望 | Medium | L1 |

## Key External Practices Discovered

| Source | Practice | Cycle 0 use |
|---|---|---|
| Anthropic, Building Effective AI Agents | 从简单、可组合 workflow 起步，只在必要时增加 agent complexity | 支持跳过 `spec-evolve` 和重型 runtime |
| OpenAI Codex AGENTS.md docs | repo-local instruction hierarchy and verification of loaded instruction sources | 支持 source/runtime 和 host instruction discovery 边界 |
| OpenAI Skills docs | skill 是带 `SKILL.md` 的 versioned bundle，可表达流程和约定 | 支持把自我升级作为 contract/handoff，而非必须新 command |
| OpenAI eval best practices | eval-driven development、human calibration、agent handoff accuracy | 支持将 L3 eval 作为 Deferred，而不是本轮硬上 |
| addyosmani/agent-skills | lifecycle-aligned skills and quality gates | 作为 watchlist，不复制命令集 |
| code-review-graph | graph-backed blast-radius / token reduction with known limitations | 支持 graph facts 作为 advisory / degraded evidence |
| OpenSpec / Spec Kit / GSD / Superpowers / CodeStable / pro-workflow / SDD-RIPER | artifact graph、plan handoff、verification、learning loop、本地 self-correction patterns | 作为 local_reference evidence，不覆盖 spec-first 角色契约 |

## Main Recommendation

保持当前系统的公开入口不变。下一步如果要落地升级，应交给 `spec-plan` 设计一个轻量的 self-reflection composition contract，而不是新增 `spec-evolve`。该 contract 的目标是规范报告链路、evidence intake、CUD 反馈、review expectation、compound expectation 和 30-cycle next input，而不是把自我进化做成自动运行状态机。

推荐主链：

```text
自我审视
  -> 能力缺口
  -> 能力升级决策
  -> 最佳实践吸收
  -> plan handoff
  -> review 验证
  -> compound 沉淀
  -> 下一轮自我审视
```

## Not Doing

- 不新增 `spec-evolve` command。
- 不新增 self-reflection agent profile。
- 不新增 runtime workflow。
- 不新增自动 rewrite / auto-upgrade system。
- 不把 GitHub star 数或外部流行实践直接写进 roadmap。
- 不让脚本判断 capability gap、priority、Accepted/Skipped/Deferred。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime copies。

## Residual Risks

- `.spec-first/graph/provider-status.json` 生成于 2026-05-01，当前 HEAD 已不同；GitNexus MCP list shows `spec-first` index 7 commits behind HEAD，图证据只能作为 degraded pointer。
- `.spec-first/audits/skill-audit/latest` 是单 skill 审查，不能证明 repo-wide skill health。
- 本轮真实搜索覆盖了官方文档、GitHub CLI 和本地项目，但没有运行每个外部项目的测试或完整动态验证。
- 当前 dirty state 包含本轮新增报告目录和待记录的 `CHANGELOG.md` 变更；前序 `docs/10-prompt/自我进化.md` 修复已进入当前 source commit。

## Next Self-Reflection Input

下一轮应从本目录 8 个报告继续，而不是重新从空白 prompt 开始。重点检查：

- Accepted CUD 是否被后续 `spec-plan` 接受、修改、拒绝或延后。
- review 是否验证 CUD 的 effectiveness check，而不是只检查文档格式。
- compound 是否沉淀 pattern / anti-pattern / decision log。
- 30-cycle loop 是否出现重复 gap、无效 upgrade 或 watchlist 误升级。
- graph/provider facts 是否已刷新到当前 source_commit，或者仍应作为 degraded evidence。
