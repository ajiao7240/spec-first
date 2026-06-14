# Eval Readiness Rubric

Eval readiness means the workflow has examples that can catch routing and boundary regressions.

Readiness scoring consumes normalized cases from `skills/spec-skill-audit/scripts/eval-fixture-normalizer.js`. File names may stay descriptive, but they are not the source of truth for coverage.

Required readiness buckets:

- `trigger`: at least one structurally valid case tagged `trigger`, with non-empty `input` and `expected_outcome`.
- `boundary`: at least one structurally valid case tagged `boundary`, with non-empty `input` and either `expected_outcome`, `boundary_note`, or `forbidden_signals[]`.

Optional visible buckets:

- `failure`
- `expected`

`ready` means `trigger` and `boundary` are both present. `failure` and `expected` are reported as optional gaps in this slice; they do not block `ready`.

The report field `coverage_basis` must distinguish `declared_coverage_tags` from any temporary `legacy_filename_fallback`. `coverage_tags` are declared structural coverage, not semantic truth. Fresh-source eval, human sampling, or LLM review owns semantic quality.

High-traffic workflows should prioritize trigger and boundary cases before adding scoring complexity.
