# Owner 决策队列

`acquisition_id: team-standards-v2-pilot-20260623`

本次 pilot 没有排队 owner decision。候选 `CAND-STANDARDS-ACQ-001` 是低风险 proposal-only 机制规则，不涉及 high-impact governance、冲突或显式 owner_required。

## 队列策略

Owner queue 只接收：

- conflict-present
- high-impact governance
- explicit `owner_required`

以下情况不进入 owner queue：

- evidence warning -> `collect-more-evidence`
- actionability warning -> `refine-rule`
- abstraction warning -> `refine-rule`
- missing replay sample -> `not-enough-sample`

| 队列项 | Candidate | owner_required_reason | risk_domain | next_action |
| --- | --- | --- | --- | --- |
| none | `CAND-STANDARDS-ACQ-001` | none | none | `keep-advisory` |
