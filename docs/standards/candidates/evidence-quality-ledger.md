# 证据质量台账

`acquisition_id: team-standards-v2-pilot-20260623`

## 候选: CAND-STANDARDS-ACQ-001

```yaml
candidate_id: CAND-STANDARDS-ACQ-001
candidate_type: promotion-proposal
authority_tier: explicit-authority
promotion_state: proposed
promotion_decision: keep-advisory
replay_status: not-enough-sample
owner: spec-first-maintainers
source_refs:
  - docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#u10-v2-定义获取任务包与证据质量模型
  - docs/contracts/team-standards.md#v2-acquisition-output-boundary
source_anchor:
  - FACT-STANDARDS-001
  - FACT-STANDARDS-002
privacy_review: checked
redaction_status: not-needed
why_not_confirmed: "获取机制只作为 pilot artifact 验证；replay samples 和 owner edit distance 尚不可用。"
```

| 维度 | 评级 | 理由 |
| --- | --- | --- |
| `source_strength` | high | 当前 plan 和 contract 都定义了 V2 acquisition boundary。 |
| `recency` | high | Source refs 来自活跃的 V1/V2 implementation window。 |
| `consistency` | high | Plan、contract 和 skill boundary 一致：source-edit review 前候选保持 advisory。 |
| `coverage` | medium | 只覆盖 `shared/team-standards` slice；没有 app/backend/business surface pilot。 |
| `conflict_density` | low | scoped files 中未发现冲突 source。 |
| `enforcement_feasibility` | medium | 结构可由 focused contract tests 检查；语义质量仍需要 review。 |
| `owner_trace` | medium | Owner role 为 `spec-first-maintainers`；未运行独立 owner interview。 |
| `migration_cost` | low | 只新增 proposal-only docs、eval fixtures 和 references。 |
| `risk_level` | low | 不修改 confirmed standards 或 runtime mirrors。 |
| `retrieval_value` | medium | 帮助后续 init/audit/eval modes 选择 V2 evidence files，避免扫描无关 standards。 |

## Gate 结果

| Gate | 结果 | 下一步 |
| --- | --- | --- |
| Evidence | pass | replay/owner evidence 存在后才执行 `prepare-promotion-patch` |
| Actionability | warning | 如有真实 acquisition run consumer，再执行 `refine-rule` |
| Abstraction | pass | `keep-advisory` |
| Conflict | pass | `keep-advisory` |
| Risk | pass | `keep-advisory` |
| Derivation | pass | `keep-advisory` |
| Anchor | pass | `keep-advisory` |
| Privacy | pass | `keep-advisory` |
