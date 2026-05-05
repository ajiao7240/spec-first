---
title: Self-reflection CUD contract loop
date: 2026-05-05
category: workflow-issues
module: self-reflection
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "A self-audit accepts capability upgrades but must avoid creating a new workflow"
  - "Accepted CUDs need to move through plan, review, and compound without becoming a state machine"
  - "External or local best practices should inform decisions without becoming source truth"
tags: [self-reflection, cud, plan-handoff, doc-review, compound]
---

# Self-reflection CUD contract loop

## Context

Cycle 0 self-reflection found real capability gaps in the self-upgrade loop, but the safe fix was not to add `spec-evolve`, a new agent, or runtime automation. The useful pattern was to turn Accepted CUDs into a light source contract, then verify and compound the result.

The source fix landed in:

- `docs/plans/2026-05-05-003-docs-self-reflection-contract-plan.md`
- `docs/contracts/workflows/self-reflection-capability-upgrade.md`
- `docs/validation/2026-05-05-self-reflection-contract-doc-review.md`

## Guidance

When self-reflection accepts upgrades, route them through this sequence:

```text
Accepted CUD
  -> spec-plan handoff
  -> source-level contract or implementation plan
  -> review evidence
  -> compound only after review or dogfood evidence
  -> next-cycle input
```

Keep the CUD fields advisory and human-readable. They should make review and next-cycle comparison easier, not become a central state machine.

Use source contracts for recurring report shape and handoff expectations. Do not create new workflow surface until repeated cycles prove the source contract is insufficient.

## Why This Matters

Without this loop, self-reflection reports can produce convincing Accepted CUDs that never reach planning, review, or knowledge reuse. The next cycle then rediscovers the same gaps and may escalate to unnecessary runtime or agent complexity.

The contract pattern preserves spec-first's core boundary:

- deterministic checks can verify files, fields, and freshness labels;
- LLM/reviewers decide whether a gap is real and whether a CUD worked;
- generated runtime mirrors remain outputs, not source truth.

## When to Apply

- Self-reflection reports accept L1/L2 contract or routing upgrades.
- A prompt-only report should become repeatable without adding a command.
- External GitHub or local reference projects suggest useful practices but also carry overreach risk.
- Review needs to know whether a CUD was validated, rejected, deferred, or still waiting for evidence.

## Examples

Better handoff:

```text
CUD-003 accepted -> plan handoff creates docs-only contract -> doc-review validates boundary -> compound captures reusable loop pattern.
```

Avoid:

```text
CUD accepted -> immediately add spec-evolve -> generated runtime patched by hand -> no review evidence -> no next-cycle feedback.
```

## Related

- `docs/contracts/workflows/self-reflection-capability-upgrade.md`
- `docs/2026-05-05-self-reflection-upgrade/04-capability-upgrade-decisions.md`
- `docs/validation/2026-05-05-self-reflection-contract-doc-review.md`
