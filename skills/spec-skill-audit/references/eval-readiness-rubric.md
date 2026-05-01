# Eval Readiness Rubric

Eval readiness means the workflow has examples that can catch routing and boundary regressions.

Recommended files:

- `evals/trigger-cases.json`
- `evals/boundary-cases.json`
- `evals/failure-cases.json`
- `evals/expected-behavior.md`

High-traffic workflows should prioritize trigger and boundary cases before adding scoring complexity.
