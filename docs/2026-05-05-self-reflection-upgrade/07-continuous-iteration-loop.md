---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/2026-05-05-self-reflection-upgrade/00-summary.md
  - docs/2026-05-05-self-reflection-upgrade/04-capability-upgrade-decisions.md
  - docs/2026-05-05-self-reflection-upgrade/06-next-self-reflection-input.md
---

# Continuous Iteration Loop

## Loop Overview

The loop is:

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

Cycle 0 produced the baseline report set. Cycles 1-30 should be rolling evidence cycles, not automatic code changes.

## Trigger Rules

Run the next self-reflection cycle after:

- important workflow source changes;
- skill boundary changes;
- graph/provider readiness changes;
- code-review finds a systemic workflow issue;
- compound records repeated patterns;
- release touches workflow/contract/runtime governance;
- external practice gains strong relevance to an existing gap;
- a prior Accepted CUD reaches plan/review/compound outcome.

Skip a cycle when:

- no source/workflow/governance changes occurred;
- all prior CUDs are still waiting for plan/review input;
- the only new signal is external popularity with no internal gap.

## Inputs For Next Cycle

Required:

- current report directory;
- current git metadata;
- current role contract and AGENTS/CLAUDE;
- changed source files since last cycle;
- Accepted/Skipped/Deferred CUDs;
- review findings;
- compound lessons;
- updated docs/source;
- graph/provider freshness status if graph facts will be used.

Optional:

- local reference projects, only when linked to a current gap;
- GitHub/web search, only when a gap needs external calibration;
- prior sessions/Slack, only when organizational context matters.

## Outputs For Next Cycle

Each cycle outputs:

- updated capability gaps;
- updated CUDs;
- changed decisions since previous cycle;
- best-practice watchlist changes;
- roadmap changes based only on Accepted CUDs;
- review and compound feedback status;
- next-cycle input.

## CUD Feedback Tracking

Use these advisory statuses:

| Status | Meaning |
|---|---|
| `accepted_pending_plan` | Accepted by self-reflection, not yet planned |
| `planned_as_is` | spec-plan accepted the handoff |
| `planned_revised` | spec-plan changed scope or level |
| `rejected_by_plan` | spec-plan found it unnecessary or unsafe |
| `implemented_pending_review` | source changes exist, review not complete |
| `review_validated` | review confirmed effectiveness |
| `review_rejected` | review found the upgrade ineffective or risky |
| `compounded` | pattern/anti-pattern/decision log captured |
| `superseded` | later evidence replaced the CUD |

These statuses are not a central state machine. They are report vocabulary for human review.

## Review Feedback Tracking

For each Accepted CUD, record:

- expected review workflow: `doc-review`, `skill-audit`, `code-review`, `app-consistency-audit`, or none;
- whether fresh-source eval is required;
- exact evidence reviewed;
- residual risk after review;
- whether review changed the next-cycle input.

## Compound Feedback Tracking

Compound only after there is evidence:

- reviewed source change;
- repeated gap pattern;
- rejected/deferred upgrade that teaches a durable anti-pattern;
- external practice fit decision that should guide future cycles.

Do not compound:

- speculative watchlist entries;
- unreviewed CUDs;
- one-off report formatting;
- external project summaries without a spec-first lesson.

## Best-practice Watchlist Refresh

Refresh watchlist only when:

- a new current gap needs outside comparison;
- a previously deferred practice gains stronger evidence;
- an external practice changes materially;
- a local reference project provides a proven pattern relevant to an accepted gap.

Drop or demote watchlist items when:

- they remain unlinked to any gap for multiple cycles;
- they imply heavy runtime or hidden source of truth;
- they only duplicate existing spec-first abilities.

## 30-cycle Track

| Cycle range | Primary question | Expected action |
|---|---|---|
| 1-3 | Are CUD-001..005 plan-worthy? | hand to `spec-plan`, review plan output |
| 4-6 | Did review validate any implemented L1/L2 contract changes? | doc-review / skill-audit as applicable |
| 7-9 | Did compound capture real lessons? | add or refresh `docs/solutions/` only with evidence |
| 10-12 | Are graph/provider freshness labels reducing bad assumptions? | compare reports before/after graph refresh |
| 13-15 | Are external/local practices changing decisions or just adding noise? | prune watchlist |
| 16-18 | Are repeated gaps emerging? | consider whether Deferred L3 eval has enough evidence |
| 19-21 | Are CUD feedback statuses useful or ceremonial? | simplify fields if needed |
| 22-24 | Are source/runtime boundaries still clear after upgrades? | run targeted review |
| 25-27 | Did self-reflection improve developer speed/quality? | inspect work/review/compound evidence |
| 28-30 | Should self-reflection remain report-only, become a template, or be skipped until trigger? | make next macro decision |

## Stop / Skip / Defer Rules

Stop when:

- current evidence is stale and no fallback exists;
- source/runtime boundary is unclear;
- a proposed upgrade would require L3/L4 implementation without plan;
- semantic judgment is being pushed into a script.

Skip when:

- no named capability gap exists;
- existing workflows are enough;
- external practice is unlinked to a current gap;
- upgrade would only make the system bigger.

Defer when:

- evidence strength is weak;
- practice fit is plausible but unproven;
- implementation would require new skill/agent/script/runtime;
- review or compound feedback is not available yet.

## How To Prevent Capability Bloat

- Require a named capability gap before every upgrade.
- Require counter-signal for every CUD.
- Keep Accepted CUDs at the smallest viable level.
- Prefer docs/contract/routing updates over new skills.
- Require `spec-plan` before implementation.
- Require review before claiming effectiveness.
- Require compound only after evidence.
- Prune watchlist items that do not affect decisions.
