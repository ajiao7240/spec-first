# Promotion And Conflicts

Promotion output must include:

- `gate_results`
- `confidence.signals`
- `autonomy.mode`
- `next_action`
- `outcome`
- `decision_trace`
- `source_refs`
- owner status and conflict status

Actual writes to `trust=confirmed,lifecycle_state=active`, `docs/standards/index.md`, archive records or V2 lineage/owner queue require an active source-edit workflow, diff review, changelog and focused tests.

Conflict precedence:

```text
owner/ADR/design note decision
> confirmed high-level source
> confirmed narrower scope
> explicit-authority draft
> machine-enforced evidence
> observed/suggested/imported candidate
```

Allowed exits: `superseded`, `scoped-split`, `merged`, `deferred`, `both-rejected`.

Owner queue is only for conflict, high-impact or explicit owner-required items. Evidence thinness, actionability gaps or abstraction problems route to `collect-more-evidence` or `refine-rule`, not owner review.
