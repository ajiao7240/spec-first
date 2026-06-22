# 验证与回放

V2 validation 衡量获取到的 standards 是否改善 selection 和 review quality。它本身不提升规则。

## Replay 类型

- PR replay：使用 historical PR 或 diff cases，检查 standards 是否能命中真实问题且不引入不可接受的噪音。
- Review finding replay：回放 accepted 或 rejected review findings，确认 candidate rule 是否能映射到具体 evidence。
- retrieval eval：让 plan/work/review/debug scenarios 通过 `docs/standards/index.md` 选择 rules，并比较 expected rule IDs 与 observed hits。
- noise budget：追踪 project-standards review 的 false-positive findings。
- owner edit distance：比较 proposed rule text 和 owner-edited text；edit distance 高表示需要重写或收集更多 evidence。

## 最小 case 字段

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

## 阈值

- 至少有 5 个 replay cases 后，才能声明 replay coverage。
- Retrieval expected-hit coverage 应不低于 80%。
- Project-standards false-positive rate 应保持在 15% 以下，或每 5 个 cases 最多 1 个 invalid hard finding。
- Promotion-ready owner normalized edit distance 应不高于 30%；超过 50% 必须重写。

如果 samples 缺失、owner input 不可用，或 historical PRs 无法复现，记录 `not-enough-sample` 或 `not-run`。不得把 LLM 自评作为 pass 信号。

## Promotion 边界

Replay、retrieval 和 owner-edit results 只是 promotion evidence。它们不能替代：

- `trust=confirmed,lifecycle_state=active` source writes
- owner/high-impact gates
- diff review
- focused tests
- CHANGELOG updates

Derived AI rules、review checklists、query summaries 和 handoff snippets 必须引用 standard rule IDs 或 reviewable proposal IDs。它们不能成为独立 source truth。
