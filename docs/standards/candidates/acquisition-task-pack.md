# V2 获取任务包

```yaml
acquisition_id: team-standards-v2-pilot-20260623
schema_version: team-standards-acquisition-task-pack/v1
status: pilot-recorded
target_repo: spec-first
snapshot_id: 6202e5a0
extraction_target:
  surface: shared
  sub_domain: standards-governance
  capability: team-standards
project_paths:
  - docs/contracts/team-standards.md
  - docs/standards/index.md
  - docs/standards/candidates/README.md
  - skills/spec-team-standards-governance/SKILL.md
  - skills/spec-team-standards-governance/references/acquisition-quality.md
scope:
  include:
    - confirmed standards governance source
    - proposal-only candidate boundary
    - V2 acquisition evidence model
  exclude:
    - generated runtime mirrors
    - 无关 product capability specs
    - 缺少 owner input 的 multi-surface business rules
time_window:
  from: 2026-06-21
  to: 2026-06-23
evidence_sources:
  - explicit-doc
  - contract
  - skill-source
excluded_sources:
  - private PRs
  - incident logs
  - interviews without owner input
privacy_boundary:
  allowed: repo-relative source refs 和抽象工程约束
  disallowed: customer data、personal data、secrets、local absolute paths、raw private discussion
expected_candidate_types:
  - suggested-rule
  - promotion-proposal
owner_candidates:
  - spec-first-maintainers
output:
  mode: candidate-only
constraints:
  mixed_surface_policy: reject-and-split
  promotion_policy: confirmed standards 写入不在本次 scope
  runtime_policy: do-not-edit-generated-mirrors
non_goals:
  - 写入 confirmed standards
  - 恢复 spec-standards workflow
  - 在缺少 replay samples 时声明 PR replay pass
```

## Pilot 决策

本 task pack 只验证 V2 获取层的 source shape：single target、source anchors、evidence quality、lineage、owner queue、promotion log 和 replay limitation。它不把任何候选提升为 `trust=confirmed`，也不把 replay/retrieval 样本不足包装成通过。

## 产出的候选

- `CAND-STANDARDS-ACQ-001`: 每次团队规范获取必须绑定一个 extraction target，并记录 source anchors、evidence quality、privacy boundary 和 replay status。

该候选来自当前计划和合同中已经明写的 V2 获取边界；本次只保持 advisory/promotion-proposal 状态，等待后续真实 replay 或 owner review 决定是否进入 confirmed patch。
