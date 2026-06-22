# Evidence Quality Ledger

`acquisition_id: team-standards-v2-pilot-20260623`

## Candidate: CAND-STANDARDS-ACQ-001

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
why_not_confirmed: "The acquisition mechanism is validated as a pilot artifact, but replay samples and owner edit distance are not available yet."
```

| Dimension | Rating | Reason |
| --- | --- | --- |
| `source_strength` | high | Current plan and contract both define the V2 acquisition boundary. |
| `recency` | high | Source refs are from the active V1/V2 implementation window. |
| `consistency` | high | Plan, contract and skill boundaries agree that candidates are advisory until source-edit review. |
| `coverage` | medium | Covers shared/team-standards slice only; no app/backend/business surface pilot. |
| `conflict_density` | low | No conflicting source found in the scoped files. |
| `enforcement_feasibility` | medium | Structure can be checked by focused contract tests; semantic quality still needs review. |
| `owner_trace` | medium | Owner role exists as `spec-first-maintainers`; no separate owner interview was run. |
| `migration_cost` | low | Adds proposal-only docs, eval fixtures and references. |
| `risk_level` | low | Does not change confirmed standards or runtime mirrors. |
| `retrieval_value` | medium | Helps future init/audit/eval modes select V2 evidence files without scanning unrelated standards. |

## Gate Results

| Gate | Result | Next action |
| --- | --- | --- |
| Evidence | pass | `prepare-promotion-patch` only after replay/owner evidence exists |
| Actionability | warning | `refine-rule` with a real acquisition run consumer if needed |
| Abstraction | pass | `keep-advisory` |
| Conflict | pass | `keep-advisory` |
| Risk | pass | `keep-advisory` |
| Derivation | pass | `keep-advisory` |
| Anchor | pass | `keep-advisory` |
| Privacy | pass | `keep-advisory` |
