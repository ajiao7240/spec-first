# gate-lens-taxonomy.v1

`gate-lens-taxonomy.v1` is the canonical naming contract for governance lens families used by task and resource advisory facts.

It is only a vocabulary. It does not run gates, schedule checks, enforce hooks, or imply blocking behavior.

## Families

- `preflight`: repository, host, setup, and mutation-boundary readiness.
- `exploration`: source discovery, current-state evidence, and context gathering.
- `planning`: plan depth, boundaries, assumptions, and artifact choice.
- `execution`: implementation-time guardrails and workflow-local observations.
- `verification`: test, validation, and evidence coverage posture.
- `review`: code/document review and residual-risk handling.
- `summary`: closeout, handoff, changelog, and user-visible advisory reporting.

## Boundary

Scripts may emit these family names as deterministic labels. Workflow LLMs decide how to interpret the labels for the current task. A lens family is not a gate executor, maturity stage, or permission boundary.
