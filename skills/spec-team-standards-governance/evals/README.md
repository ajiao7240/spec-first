# Team Standards Governance Evals

这些 fixtures 是 V2 获取质量的结构化样本，不是 LLM 语义质量证明。runner 或 reviewer 可以用它们检查 trigger/output 合同形状；真正 promotion 仍看 source refs、owner gate、replay/retrieval evidence 和 diff review。

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
