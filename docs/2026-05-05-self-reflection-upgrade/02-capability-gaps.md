---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/10-prompt/自我进化.md
  - docs/2026-05-05-self-reflection-upgrade/01-composition-baseline.md
  - skills/spec-skill-audit/SKILL.md
  - skills/spec-doc-review/SKILL.md
  - skills/spec-plan/SKILL.md
  - skills/spec-code-review/SKILL.md
  - skills/spec-compound/SKILL.md
  - .spec-first/graph/provider-status.json
  - .spec-first/audits/skill-audit/latest/skill-audit-report.json
---

# Capability Gaps

## Capability Gap Summary

Named gaps were found. They are composition and contract gaps, not evidence for a new runtime system.

| Gap | Title | Evidence strength | Decision candidate | Upgrade level |
|---|---|---|---|---|
| CG-001 | Self-reflection composition contract missing | Strong | Accepted | L1 |
| CG-002 | Best-practice intake lacks trust/applicability contract | Medium | Accepted | L1 |
| CG-003 | CUD feedback is not traceable through plan/review/compound | Medium | Accepted | L1/L2 |
| CG-004 | Graph/provider freshness is not strong enough for self-reflection decisions | Strong | Accepted | L1/L2 |
| CG-005 | Fresh-source eval is not connected to self-upgrade CUD validation | Medium | Accepted | L1 |
| CG-006 | New `spec-evolve` workflow temptation | Strong counter-signal | Skipped | L0 |
| CG-007 | Heavy self-correcting memory/runtime layer | Weak for this repo | Deferred | L3 |
| CG-008 | Skill eval suite for self-reflection decisions | Medium external evidence, weak local need | Deferred | L3 |

## CG-001: Self-reflection composition contract missing

### Evidence

- `docs/10-prompt/自我进化.md` defines a rich report-only self-reflection process and allowed output files.
- Before this run, no `docs/YYYY-MM-DD-self-reflection-upgrade/` report set existed for the current cycle.
- Existing workflows cover pieces (`skill-audit`, `doc-review`, `plan`, `compound`) but no source-level contract links them into one self-upgrade evidence chain.

### Evidence Strength

Strong.

### Current Behavior

Self-reflection is possible as a long prompt and manual report generation.

### Capability Missing

A stable, lightweight composition contract for:

```text
self-reflection -> capability gap -> CUD -> best-practice intake -> plan handoff -> review -> compound -> next cycle
```

### Why Existing Workflow Is Not Enough

Existing workflows can execute parts, but none owns the semantic synthesis of CUD effectiveness and next-cycle input. Without a contract, each future run may invent a different report shape.

### Impact

Repeated self-audits may become non-comparable, hard to review, and hard to compound.

### Upgrade Level

L1 Contract Upgrade.

### Candidate Upgrade

Ask `spec-plan` to design a source-level self-reflection composition contract under docs or existing workflow references. It must not create a command or runtime state machine by default.

### Counter-signal

The target prompt itself is already detailed enough for one-off use; a minimal docs contract may be enough.

### Decision Candidate

Accepted.

## CG-002: Best-practice intake lacks trust/applicability contract

### Evidence

- `docs/README.md` correctly labels `docs/业界分析/` as external-reference, but the self-evolution prompt requires fresh industry/GitHub discovery with per-source trust judgment.
- GitHub searches returned both relevant and irrelevant/high-star projects. Star counts did not correlate with fit.
- User added 10 local reference projects with mixed dirty state; these are valuable but not current spec-first source truth.

### Evidence Strength

Medium.

### Current Behavior

External and local practices can be cited manually, but there is no reusable intake table defining `source_type`, `freshness`, `linked_gap`, `counter_signal`, and `recommended_decision`.

### Capability Missing

A reusable evidence intake schema in prose for external and local references.

### Why Existing Workflow Is Not Enough

`doc-review` can review a document after it exists. It does not make external evidence comparable across cycles by itself.

### Impact

Popular external patterns may enter roadmap without being linked to current capability gaps.

### Upgrade Level

L1 Contract Upgrade.

### Candidate Upgrade

Adopt the intake table used in this report as the minimum expected shape for future self-reflection reports.

### Counter-signal

The prompt already contains a detailed external practice format; the need may be documentation consistency rather than new capability.

### Decision Candidate

Accepted.

## CG-003: CUD feedback is not traceable through plan/review/compound

### Evidence

- `docs/10-prompt/自我进化.md` requires CUD, plan handoff, review expectation, compound feedback, and next-cycle input.
- `docs/solutions/` exists, but current sampled solution docs do not expose a standard CUD feedback field.
- `spec-plan`, `spec-doc-review`, and `spec-compound` each have strong local contracts, but CUD-specific feedback is not a stable handoff object.

### Evidence Strength

Medium.

### Current Behavior

The LLM can describe CUD feedback expectations in prose. Future workflows may not retrieve or validate them consistently.

### Capability Missing

Trace fields and review/compound expectations for CUD lifecycle.

### Why Existing Workflow Is Not Enough

Existing workflows are generic. A CUD can be accepted, then vanish into a plan or changelog without explicit feedback to the next self-reflection cycle.

### Impact

The system may repeatedly rediscover the same gaps or accept upgrades whose effectiveness was never checked.

### Upgrade Level

L1/L2.

### Candidate Upgrade

Define advisory fields for self-reflection reports and compound handoff:

- `linked_cud`
- `review_expected_by`
- `compound_expected`
- `next_cycle_trigger`
- `cud_status: accepted | revised | rejected | deferred | superseded`

### Counter-signal

Too much schema can become a second state machine. Keep it advisory and human-readable unless repeated dogfood proves machine validation is needed.

### Decision Candidate

Accepted.

## CG-004: Graph/provider freshness is not strong enough for self-reflection decisions

### Evidence

- `.spec-first/graph/provider-status.json` generated at 2026-05-01, with nested repo snapshot commit `dbf9bab...`.
- GitNexus MCP `list_repos` reports current `spec-first` index is 7 commits behind HEAD.
- GitNexus `query` for workflow prose concepts returned no processes, so direct source reads were required.
- `.spec-first/graph/graph-facts.json` top-level metadata had `source_commit`, `branch`, `dirty_state` as null.

### Evidence Strength

Strong.

### Current Behavior

Graph facts are available but stale/partial for this run. Current workflow rules already support degraded fallback, but self-reflection needs explicit trust labeling.

### Capability Missing

Self-reflection report-level provider trust classification.

### Why Existing Workflow Is Not Enough

`spec-graph-bootstrap` can refresh facts, but report-only self-reflection must still decide how to treat stale facts when not refreshing runtime artifacts.

### Impact

A future self-audit could over-trust stale graph facts and miss docs/prose workflow gaps.

### Upgrade Level

L1/L2.

### Candidate Upgrade

Require self-reflection reports to classify graph evidence as `current`, `stale`, `partial`, `definitions-only`, `unavailable`, or `not-used`, with explicit fallback evidence.

### Counter-signal

This is a report consumption rule, not necessarily a graph provider bug.

### Decision Candidate

Accepted.

## CG-005: Fresh-source eval is not connected to self-upgrade CUD validation

### Evidence

- `AGENTS.md` already requires fresh-source eval for agent/skill prose semantic validation when behavior matters.
- The self-reflection prompt requires review expectations but does not bind specific CUDs to fresh-source eval where skill/prose changes are proposed.
- OpenAI eval best practices emphasize eval-driven development, human calibration, and agent handoff accuracy; this supports but does not force L3 eval implementation.

### Evidence Strength

Medium.

### Current Behavior

Fresh-source eval exists as a general governance rule. CUDs may mention it inconsistently.

### Capability Missing

A CUD verification expectation that says when fresh-source eval, doc-review, skill-audit, or code-review is the correct downstream validation path.

### Why Existing Workflow Is Not Enough

The rule exists, but CUD handoff may not name it. That creates weak validation coverage after Accepted upgrades.

### Impact

Skill/prose upgrades may be judged by local cached behavior or formatting tests instead of fresh source.

### Upgrade Level

L1.

### Candidate Upgrade

Add review expectation fields to CUD reports:

- `review_target`
- `fresh_source_eval_required: yes/no`
- `runtime_regeneration_required: yes/no`
- `compound_after_review: yes/no`

### Counter-signal

Do not introduce machine-enforced gates until repeated failures prove prose rules are insufficient.

### Decision Candidate

Accepted.

## CG-006: New `spec-evolve` workflow temptation

### Evidence

- User explicitly warned: "Do not assume spec-evolve must be added."
- Target prompt explicitly says the task is not to add a skill, command, agent, runtime workflow, or auto-rewrite system.
- Anthropic's agent guidance favors simple composable patterns and adding complexity only when simpler approaches fail.

### Evidence Strength

Strong counter-signal against upgrade.

### Current Behavior

No `spec-evolve` command exists in the current source.

### Capability Missing

No proven missing capability requires a new command.

### Why Existing Workflow Is Not Enough

Not applicable; existing workflow is enough for Cycle 0 report-only.

### Impact

Adding `spec-evolve` now would likely increase routing ambiguity and system surface area.

### Upgrade Level

L0 No Upgrade.

### Candidate Upgrade

None.

### Counter-signal

If 30 cycles repeatedly show agents cannot run self-reflection from docs/handoff alone, revisit as a Deferred L3/L4 question.

### Decision Candidate

Skipped.

## CG-007: Heavy self-correcting memory/runtime layer

### Evidence

- Local `pro-workflow` emphasizes SQLite-backed self-correcting memory, hooks, compact guard, and auto-loaded learnings.
- spec-first role contract rejects heavy runtime, centralized workflow engines, and multi-source truth.

### Evidence Strength

Weak for current repo; useful external/local pattern but not a proven spec-first gap.

### Current Behavior

spec-first uses `docs/solutions/`, `compound`, and session/local research instead of a required memory DB.

### Capability Missing

No current missing capability proves DB-backed memory is needed.

### Why Existing Workflow Is Not Enough

Not proven.

### Impact

If adopted prematurely, this could introduce hidden state and source/runtime ambiguity.

### Upgrade Level

Conditional L3, not this cycle.

### Candidate Upgrade

Keep as watchlist: evolution memory can remain docs/compound-first.

### Counter-signal

spec-first already has compound docs and explicit source/runtime governance.

### Decision Candidate

Deferred.

## CG-008: Skill eval suite for self-reflection decisions

### Evidence

- OpenAI eval best practices support eval-driven development for agent workflows and handoff accuracy.
- Existing `skills/spec-graph-bootstrap/evals/` and some local projects show eval/test patterns.
- No current repeated failure proves self-reflection CUD needs an L3 eval harness immediately.

### Evidence Strength

Medium external, weak local.

### Current Behavior

Manual report audit and downstream review can validate CUDs.

### Capability Missing

Potential eval fixtures for CUD quality and routing outcomes.

### Why Existing Workflow Is Not Enough

Not yet proven. This cycle can be reviewed manually.

### Impact

Without future evals, regression in CUD quality may be found late.

### Upgrade Level

Conditional L3.

### Candidate Upgrade

After several cycles, consider lightweight fixtures that test report completeness and CUD traceability. Scripts must only check structural fields; LLM/review judges semantic quality.

### Counter-signal

Premature evals can ossify prompt format and create a pseudo-state-machine.

### Decision Candidate

Deferred.
