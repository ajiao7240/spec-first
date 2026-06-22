# Team Standards V2 Acquisition Quality Validation

```yaml
validation_id: team-standards-v2-acquisition-quality-20260623
acquisition_id: team-standards-v2-pilot-20260623
target_repo: spec-first
surface: shared
capability: team-standards
status: degraded-evidence
snapshot_id: 4d47b125
```

## Scope

本报告验证 V2 获取质量层是否具备可复核 artifact 形状：acquisition task pack、source matrix、fact/evidence ledger、lineage、owner queue、promotion log、output risk profile、role interview notes 和 eval fixtures。

## Results

| Check | Result | Evidence | Limitation |
| --- | --- | --- | --- |
| Single extraction target | pass | `docs/standards/candidates/acquisition-task-pack.md` declares `spec-first/shared/team-standards` | only one pilot slice |
| Source anchors | pass | `docs/standards/candidates/fact-ledger.md` records snapshot, path hash, file, line range and snippet hash | hashes must be refreshed if source refs change |
| Evidence quality dimensions | pass | `docs/standards/candidates/evidence-quality-ledger.md` covers all V2 dimensions | no automated score runner |
| Source matrix boundary | pass | `docs/standards/candidates/source-matrix.md` blocks code-only confirmed trust | no graph/code acquisition used |
| Lineage | pass | `docs/standards/candidates/lineage-ledger.md` links fact -> candidate -> keep-advisory | no confirmed promotion edge |
| Owner queue routing | pass | `docs/standards/candidates/owner-decision-queue.md` keeps ordinary warnings out of owner queue | no owner interview |
| Replay/retrieval eval | not-enough-sample | `skills/spec-team-standards-governance/evals/**` defines fixtures | no historical PR/review replay set |
| Owner edit distance | not-run | `docs/standards/candidates/output-risk-profile.md` records limitation | owner unavailable |
| Hygiene | pending-command | `scripts/check-team-standards.js` covers candidates, evals and validation docs | command result recorded in work closeout |

## Decision

V2 source shape is present for one real pilot slice, but value validation remains degraded because replay samples and owner edit distance are unavailable. The correct outcome for `CAND-STANDARDS-ACQ-001` is `keep-advisory`, not confirmed promotion.

This report does not claim PR replay pass, retrieval pass or owner approval.
