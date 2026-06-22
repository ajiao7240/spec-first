# 团队规范治理 Evals

这些 fixtures 是 V2 获取质量的结构化样本，不是 LLM 语义质量证明。runner 或 reviewer 可以用它们检查 trigger/output 合同形状；真正 promotion 仍看 source refs、owner gate、replay/retrieval evidence 和 diff review。

## Case 字段

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

少于 5 个 replay cases 时使用 `not-enough-sample`。case 是 fixture contract，或没有 historical PR/review sample 时，使用 `not-run`。

## Fixture 文件

- `trigger-cases.json`：acquisition 的 should-trigger、should-not-trigger、near-neighbor 和 boundary cases。
- `output-cases.json`：candidate、lineage、owner queue、derived artifact 和 source anchor output contract cases。
- `golden-samples/README.md`：后续可选 e2e sample notes。
