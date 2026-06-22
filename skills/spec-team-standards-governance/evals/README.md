# Team Standards Governance Evals

These fixtures are structured samples for V2 acquisition quality, not proof of LLM semantic quality. A runner or reviewer can use them to check trigger/output contract shape; real promotion still depends on source refs, owner gates, replay/retrieval evidence and diff review.

## Case Fields

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

Use `not-enough-sample` when fewer than 5 replay cases are available. Use `not-run` when the case is a fixture contract or no historical PR/review sample exists.

## Fixture Files

- `trigger-cases.json`: acquisition should-trigger, should-not-trigger, near-neighbor and boundary cases.
- `output-cases.json`: candidate, lineage, owner queue, derived artifact and source anchor output contract cases.
- `golden-samples/README.md`: optional future e2e sample notes.
