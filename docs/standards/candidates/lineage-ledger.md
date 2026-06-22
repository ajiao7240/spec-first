# Lineage Ledger

`acquisition_id: team-standards-v2-pilot-20260623`

This ledger tracks how V2 pilot evidence moved from source facts to candidate/proposal status. It does not create confirmed standards.

| Edge | From | To | Transition | Decision trace | Source refs |
| --- | --- | --- | --- | --- | --- |
| `LINEAGE-STANDARDS-001` | `FACT-STANDARDS-001` | `CAND-STANDARDS-ACQ-001` | fact -> candidate | V2 acquisition boundary was explicit in the plan. | `docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#u10-v2-定义获取任务包与证据质量模型` |
| `LINEAGE-STANDARDS-002` | `FACT-STANDARDS-002` | `CAND-STANDARDS-ACQ-001` | contract -> proposal | Candidate remains proposal-only because confirmed writes require source-edit workflow and review. | `docs/contracts/team-standards.md#v2-acquisition-output-boundary` |
| `LINEAGE-STANDARDS-003` | `CAND-STANDARDS-ACQ-001` | `keep-advisory` | proposal -> keep-advisory | Replay samples and owner edit distance are not available. | `docs/standards/candidates/output-risk-profile.md` |

Summary: `CAND-STANDARDS-ACQ-001 -> proposal -> keep-advisory`.
