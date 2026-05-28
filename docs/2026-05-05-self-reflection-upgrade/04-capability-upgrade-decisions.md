---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/2026-05-05-self-reflection-upgrade/01-composition-baseline.md
  - docs/2026-05-05-self-reflection-upgrade/02-capability-gaps.md
  - docs/2026-05-05-self-reflection-upgrade/03-industry-github-best-practices.md
  - docs/10-prompt/自我进化.md
---

# Capability Upgrade Decisions

## CUD Summary

This cycle accepts only lightweight upgrades:

- L1: clarify self-reflection/CUD report contract.
- L1: standardize external/local practice evidence intake.
- L1/L2: make CUD feedback traceable through plan, review, and compound.
- L1/L2: require graph/provider freshness classification in self-reflection reports.
- L1: connect fresh-source eval expectations to CUD verification.

No L3/L4 implementation is accepted in this cycle.

## Accepted CUDs

## CUD-001: Define a source-level self-reflection composition contract

### Decision

Accepted.

### Linked Capability Gap

CG-001.

### Upgrade Proposal

Create a lightweight source-level contract or runbook for self-reflection reports. It should define the report set, evidence intake, CUD fields, plan handoff, review expectation, compound feedback, and next-cycle input.

### Evidence

- `docs/10-prompt/自我进化.md` defines the full Cycle 0 report shape.
- Existing skills cover pieces but no stable composition contract.
- Anthropic agent guidance supports simple composable workflows over premature runtime complexity.

### Evidence Strength

Strong.

### Counter-signal

The current prompt is already detailed. The upgrade should avoid duplicating the whole prompt into multiple source locations.

### Why Now

The user explicitly asked for continuous self-reflection and 30-cycle self-upgrade. Without a contract, future cycles will drift.

### Why Not Existing Workflow

Existing workflows can run this manually, but they do not standardize CUD feedback and next-cycle comparison.

### Upgrade Level

L1.

### Industry / GitHub Practice Link

BP-001, BP-003, BP-008.

### Plan Handoff Target

spec-plan.

### Plan Handoff Brief

`spec-plan` should design the smallest source change that makes self-reflection reproducible. It should not create `spec-evolve`, command wiring, runtime state, CI, or scripts unless it rejects the L1-only premise with new evidence.

Validation expectation:

- `spec-doc-review` validates the contract prose.
- `spec-skill-audit` is used only if existing skill source prose changes.
- `spec-compound` captures the final pattern after at least one reviewed successful cycle.

### Effectiveness Check

- Traces to CG-001.
- Clarifies self-reflection as composition, not new workflow.
- Prevents the wrong action of adding `spec-evolve` just to make the idea feel durable.
- Future review can reject the contract if it duplicates prompt prose or creates hidden gates.

### Verification

Manual doc-review plus file completeness check for the report contract. If skill prose changes, use fresh-source eval.

### Residual Risk

Too much structure can turn the report into a pseudo-state-machine.

### Next-cycle Input

Check whether the contract reduced repeated re-discovery or created unnecessary overhead.

## CUD-002: Standardize external and local reference evidence intake

### Decision

Accepted.

### Linked Capability Gap

CG-002.

### Upgrade Proposal

Add a reusable intake shape for external and local references:

- `source_type`
- `source_url` or local path
- `freshness`
- `linked_capability_gap`
- `evidence_quality`
- `counter_signal`
- `integration_risk`
- `recommended_decision`

### Evidence

- External search returned useful but mixed-fit practices.
- Local reference projects are all dirty to varying degrees and cannot be current truth.
- `docs/README.md` already separates external-reference from source-of-truth.

### Evidence Strength

Medium.

### Counter-signal

The target prompt already provides a detailed format, so this may be satisfied by adopting report examples rather than changing workflow source.

### Why Now

The user explicitly added 10 local reference projects after the initial goal. Future cycles need to absorb these without conflating them with current source.

### Why Not Existing Workflow

`doc-review` can critique a finished report but does not standardize how external evidence is collected.

### Upgrade Level

L1.

### Industry / GitHub Practice Link

BP-002, BP-004, BP-005, BP-007, BP-009.

### Plan Handoff Target

spec-plan.

### Plan Handoff Brief

`spec-plan` should decide whether this belongs in `docs/10-prompt/自我进化.md`, a report template, or an existing docs contract. It should not add a crawler or GitHub mining script.

### Effectiveness Check

- Traces to CG-002.
- Forces external practices to pass through capability-gap fit.
- Prevents roadmap derived from star counts or local project preference.
- Review/compound can later confirm whether intake tables avoided bad upgrade decisions.

### Verification

Doc-review checks every accepted external practice has a linked gap and counter-signal.

### Residual Risk

Manual intake costs time; overly broad local reference scans can bloat context.

### Next-cycle Input

Track which external/local practices changed a decision rather than only decorating the report.

## CUD-003: Make CUD feedback traceable through plan, review, and compound

### Decision

Accepted.

### Linked Capability Gap

CG-003.

### Upgrade Proposal

Introduce advisory CUD feedback fields in self-reflection reports and plan handoff briefs:

- `linked_cud`
- `plan_decision`
- `review_expected_by`
- `compound_expected`
- `next_cycle_trigger`
- `cud_status`

### Evidence

- Current prompt requires plan handoff, review expectation, compound feedback, and next-cycle input.
- Existing docs/solutions do not standardize CUD back-links.
- Local references Superpowers, CodeStable, GSD, and CE show plan handoff and verification feedback patterns.

### Evidence Strength

Medium.

### Counter-signal

Field proliferation can become state-machine thinking. Keep fields advisory and report-local until repeated dogfood proves machine validation is needed.

### Why Now

The user requested 30 continuous iterations. Without trace fields, round 10 cannot know whether round 1's CUD was effective.

### Why Not Existing Workflow

Existing workflows can mention feedback in prose but do not require comparable CUD tracking.

### Upgrade Level

L1/L2.

### Industry / GitHub Practice Link

BP-007, BP-008.

### Plan Handoff Target

spec-plan.

### Plan Handoff Brief

`spec-plan` should design human-readable CUD feedback expectations. It should not create a central status database, gate engine, or mandatory CI.

### Effectiveness Check

- Traces to CG-003.
- Clarifies what happens after Accepted/Skipped/Deferred.
- Prevents accepted upgrades from disappearing after plan or review.
- Compound should later record whether the feedback fields helped avoid repeated gaps.

### Verification

Future report audit checks that every Accepted CUD names plan/review/compound expectations.

### Residual Risk

Reviewers may treat advisory fields as hard gates.

### Next-cycle Input

Check whether fields were filled with real evidence or boilerplate.

## CUD-004: Classify graph/provider evidence freshness in self-reflection reports

### Decision

Accepted.

### Linked Capability Gap

CG-004.

### Upgrade Proposal

Require self-reflection reports to label graph/provider evidence as:

- `current`
- `stale`
- `partial`
- `definitions-only`
- `unavailable`
- `not-used`

Each label must name fallback evidence.

### Evidence

- GitNexus index is 7 commits behind current HEAD.
- `.spec-first/graph/provider-status.json` is older than current branch and points to an older repo snapshot.
- GitNexus prose workflow queries returned no processes.

### Evidence Strength

Strong.

### Counter-signal

This may be a report consumption issue, not a graph-bootstrap implementation defect.

### Why Now

Self-reflection is about prompts, workflows, docs, and code. Graph facts are useful but can miss prose-level governance.

### Why Not Existing Workflow

`spec-graph-bootstrap` can refresh facts, but report-only Cycle 0 did not refresh runtime artifacts. The report still needs a trust label.

### Upgrade Level

L1/L2.

### Industry / GitHub Practice Link

BP-006.

### Plan Handoff Target

spec-plan.

### Plan Handoff Brief

`spec-plan` should define where this evidence trust classification belongs. It should not change provider implementation unless stale metadata remains a repeated blocker.

### Effectiveness Check

- Traces to CG-004.
- Prevents stale provider facts being treated as confirmed truth.
- Clarifies fallback to source reads.
- Review can verify the classification against actual generated_at/source_commit values.

### Verification

Manual report audit plus optional `spec-graph-bootstrap` rerun only when the next task requires current graph facts.

### Residual Risk

Manual labels can be wrong if not tied to observed command output.

### Next-cycle Input

Check whether graph/provider facts are refreshed or still degraded.

## CUD-005: Bind fresh-source eval expectations to CUD validation

### Decision

Accepted.

### Linked Capability Gap

CG-005.

### Upgrade Proposal

Every CUD that changes skill/agent/prompt/workflow prose should state whether fresh-source eval is required and why.

### Evidence

- `AGENTS.md` already requires fresh-source eval for skill/agent prose behavior.
- CUDs can currently omit that validation path.
- OpenAI eval guidance supports task-specific evaluation and human calibration.

### Evidence Strength

Medium.

### Counter-signal

Not every docs-only contract change needs fresh-source eval; requiring it everywhere would waste effort.

### Why Now

Self-upgrade work is mostly prose/workflow governance, exactly where cached skill behavior can mislead.

### Why Not Existing Workflow

The rule exists but is not part of CUD handoff.

### Upgrade Level

L1.

### Industry / GitHub Practice Link

BP-004, BP-008.

### Plan Handoff Target

spec-plan.

### Plan Handoff Brief

`spec-plan` should add a CUD validation field or review checklist item. It should keep deterministic checks separate from semantic fresh-source review.

### Effectiveness Check

- Traces to CG-005.
- Prevents false validation from current-session cached definitions.
- Review/compound can record when fresh-source eval caught a semantic issue.

### Verification

If skill/agent source changes follow, run the documented fresh-source eval checklist or record why current host policy blocks it.

### Residual Risk

Fresh-source eval can become ceremonial unless the prompt includes concrete acceptance questions.

### Next-cycle Input

Track whether any self-upgrade CUD required fresh-source eval and whether it changed the outcome.

## Skipped CUDs

## CUD-006: Add `spec-evolve`

### Decision

Skipped.

### Linked Capability Gap

None; CG-006 is a temptation with strong counter-signal.

### Upgrade Proposal

No upgrade.

### Evidence

User explicitly said not to assume `spec-evolve` must be added. Target prompt forbids new command/skill/agent/runtime in this cycle.

### Evidence Strength

Strong.

### Counter-signal

If 30 cycles show the report contract is impossible to run reliably, revisit.

### Why Now

Now is the wrong time; Cycle 0 must first test existing composition.

### Why Not Existing Workflow

Existing composition is enough for this cycle.

### Upgrade Level

L0.

### Industry / GitHub Practice Link

BP-001.

### Plan Handoff Target

none.

### Effectiveness Check

Skipping prevents command proliferation and premature runtime complexity.

### Verification

Confirm no `spec-evolve` source/runtime files were added.

### Residual Risk

Manual self-reflection remains labor-intensive.

### Next-cycle Input

Only revisit after repeated evidence that docs/handoff cannot support self-reflection.

## CUD-007: Add a new self-reflection agent profile

### Decision

Skipped.

### Linked Capability Gap

None.

### Upgrade Proposal

No new agent.

### Evidence

The prompt defines inline lenses and explicitly says not to add agent profiles by default.

### Evidence Strength

Strong.

### Counter-signal

If review later proves one lens repeatedly fails in current orchestrator, a profile can be reconsidered.

### Upgrade Level

L0.

### Plan Handoff Target

none.

### Effectiveness Check

Skipping keeps lens use inline and prevents agent collection drift.

### Verification

Confirm `agents/` was not modified.

### Next-cycle Input

Look for repeated review misses by lens, not just desire for specialization.

## CUD-008: Build L3 self-reflection eval harness now

### Decision

Deferred.

### Linked Capability Gap

CG-008.

### Upgrade Proposal

Future lightweight structural/semantic evals for CUD quality.

### Evidence

OpenAI eval best practices support agent workflow evals. Current repo has some eval directories. No repeated self-reflection failures yet.

### Evidence Strength

Medium external, weak local.

### Counter-signal

Premature evals may freeze a report format before dogfood validates it.

### Why Now

Not now.

### Why Not Existing Workflow

Manual review is sufficient for Cycle 0.

### Upgrade Level

Conditional L3.

### Industry / GitHub Practice Link

BP-004.

### Plan Handoff Target

none until revisited.

### Effectiveness Check

Deferring keeps this cycle report-only and avoids scripts making semantic judgments.

### Verification

Next cycles should track whether manual review misses repeat.

### Next-cycle Input

Reconsider after at least 3 reviewed self-reflection cycles.

## CUD-009: Adopt heavy self-correcting memory runtime

### Decision

Deferred.

### Linked Capability Gap

CG-007.

### Upgrade Proposal

No current implementation. Watch local `pro-workflow` pattern and compare against `spec-compound`.

### Evidence

Local `pro-workflow` shows self-correcting memory and wrap-up rituals. spec-first already has docs/solutions and compound.

### Evidence Strength

Weak for current spec-first need.

### Counter-signal

Hidden memory/runtime state conflicts with source-first and explicit boundaries.

### Upgrade Level

Conditional L3.

### Plan Handoff Target

none.

### Effectiveness Check

Deferring protects source-of-truth boundary.

### Verification

Only revisit after compound retrieval failures are documented.

### Next-cycle Input

Track whether `docs/solutions/` was actually used in future plan/work/review.

## No-CUD Conclusion

No-CUD is rejected for this cycle because named capability gaps exist. However, all accepted decisions are light contract/routing decisions, not implementation approvals.

## Review / Compound Feedback Expectations

For every accepted CUD:

- `spec-plan` may accept, revise, reject, defer, or request more evidence.
- `spec-doc-review` should review future docs/contract changes.
- `spec-skill-audit` should review any skill source changes.
- `spec-code-review` should review code changes only if implementation follows.
- `spec-compound` should capture a learning only after review or dogfood evidence shows a pattern worth reusing.
