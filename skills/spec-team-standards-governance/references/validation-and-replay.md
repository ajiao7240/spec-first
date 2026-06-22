# Validation And Replay

V2 validation measures whether acquired standards improve selection and review quality. It does not promote rules by itself.

## Replay Types

- PR replay: use historical PR or diff cases to check whether standards would have found real issues without adding unacceptable noise.
- Review finding replay: replay accepted or rejected review findings to see whether a candidate rule maps to concrete evidence.
- retrieval eval: ask plan/work/review/debug scenarios to select rules through `docs/standards/index.md` and compare expected rule IDs to observed hits.
- noise budget: track false-positive findings from project-standards review.
- owner edit distance: compare proposed rule text to owner-edited text; high edit distance means rewrite or collect more evidence.

## Minimum Case Fields

- `case_id`
- `case_type`
- `input_refs`
- `expected_rule_ids`
- `expected_non_hits`
- `observed_rule_ids`
- `false_positive_rule_ids`
- `false_negative_rule_ids`
- `owner_edit_distance`
- `threshold_result`: `pass`, `warning`, `fail`, `not-enough-sample`, `not-run`
- `decision`
- `limitations`
- `decision_trace`

## Thresholds

- At least 5 replay cases before claiming replay coverage.
- Retrieval expected-hit coverage should be at least 80%.
- Project-standards false-positive rate should stay at or below 15%, or at most 1 invalid hard finding per 5 cases.
- Promotion-ready owner normalized edit distance should be at or below 30%; above 50% requires rewrite.

If samples are missing, owner input is unavailable, or historical PRs are not reproducible, record `not-enough-sample` or `not-run`. Do not use LLM self-evaluation as a pass signal.

## Promotion Boundary

Replay, retrieval and owner-edit results are promotion evidence only. They do not replace:

- `trust=confirmed,lifecycle_state=active` source writes
- owner/high-impact gates
- diff review
- focused tests
- CHANGELOG updates

Derived AI rules, review checklists, query summaries and handoff snippets must cite standard rule IDs or reviewable proposal IDs. They cannot become independent source truth.
