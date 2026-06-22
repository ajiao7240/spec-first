# Lineage 台账

`acquisition_id: team-standards-v2-pilot-20260623`

本台账记录 V2 pilot evidence 如何从 source facts 流转到 candidate/proposal 状态。它不创建 confirmed standards。

| 边 | 来源 | 去向 | 流转 | 决策追踪 | Source refs |
| --- | --- | --- | --- | --- | --- |
| `LINEAGE-STANDARDS-001` | `FACT-STANDARDS-001` | `CAND-STANDARDS-ACQ-001` | fact -> candidate | plan 明确写出 V2 acquisition boundary。 | `docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#u10-v2-定义获取任务包与证据质量模型` |
| `LINEAGE-STANDARDS-002` | `FACT-STANDARDS-002` | `CAND-STANDARDS-ACQ-001` | contract -> proposal | confirmed writes 需要 source-edit workflow 和 review，因此候选保持 proposal-only。 | `docs/contracts/team-standards.md#v2-acquisition-output-boundary` |
| `LINEAGE-STANDARDS-003` | `CAND-STANDARDS-ACQ-001` | `keep-advisory` | proposal -> keep-advisory | Replay samples 和 owner edit distance 尚不可用。 | `docs/standards/candidates/output-risk-profile.md` |

摘要：`CAND-STANDARDS-ACQ-001 -> proposal -> keep-advisory`。
