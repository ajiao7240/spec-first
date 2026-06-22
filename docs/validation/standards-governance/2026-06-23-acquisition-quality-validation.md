# 团队规范 V2 获取质量验证

```yaml
validation_id: team-standards-v2-acquisition-quality-20260623
acquisition_id: team-standards-v2-pilot-20260623
target_repo: spec-first
surface: shared
capability: team-standards
status: degraded-evidence
snapshot_id: 6202e5a0
```

## 范围

本报告验证 V2 获取质量层是否具备可复核 artifact 形状：acquisition task pack、source matrix、fact/evidence ledger、lineage、owner queue、promotion log、output risk profile、role interview notes 和 eval fixtures。

## 结果

| 检查项 | 结果 | 证据 | 局限 |
| --- | --- | --- | --- |
| Single extraction target | pass | `docs/standards/candidates/acquisition-task-pack.md` 声明 `spec-first/shared/team-standards` | 只有一个 pilot slice |
| Source anchors | pass | `docs/standards/candidates/fact-ledger.md` 记录 snapshot、path hash、file、line range 和 snippet hash | source refs 变更时必须刷新 hashes |
| Evidence quality dimensions | pass | `docs/standards/candidates/evidence-quality-ledger.md` 覆盖全部 V2 dimensions | 没有 automated score runner |
| Source matrix boundary | pass | `docs/standards/candidates/source-matrix.md` 阻止 code-only confirmed trust | 未使用 graph/code acquisition |
| Lineage | pass | `docs/standards/candidates/lineage-ledger.md` 连接 fact -> candidate -> keep-advisory | 没有 confirmed promotion edge |
| Owner queue routing | pass | `docs/standards/candidates/owner-decision-queue.md` 让普通 warning 不进入 owner queue | 没有 owner interview |
| Replay/retrieval eval | not-enough-sample | `skills/spec-team-standards-governance/evals/**` 定义 fixtures | 没有 historical PR/review replay set |
| Owner edit distance | not-run | `docs/standards/candidates/output-risk-profile.md` 记录 limitation | owner unavailable |
| Hygiene | pass | `node scripts/check-team-standards.js --all` 已通过，扫描 32 files | command result 记录在 work closeout |

## 决策

V2 source shape 已覆盖一个真实 pilot slice，但 replay samples 和 owner edit distance 不可用，因此价值验证仍是 degraded。`CAND-STANDARDS-ACQ-001` 的正确结果是 `keep-advisory`，不是 confirmed promotion。

本报告不声明 PR replay pass、retrieval pass 或 owner approval。
