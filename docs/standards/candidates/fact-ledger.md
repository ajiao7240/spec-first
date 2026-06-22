# 事实台账

`acquisition_id: team-standards-v2-pilot-20260623`

本 ledger 记录 V2 pilot 使用的 deterministic facts。它只保存 source anchors，不保存敏感正文。

## 事实

### FACT-STANDARDS-001

```yaml
fact_id: FACT-STANDARDS-001
fact: V2 获取产物必须包含 single-target task pack、evidence quality、source anchors、source matrix、lineage、owner queue 和 replay/eval boundary。
source_type: explicit-doc
provider_trust: source_confirmed
source_anchor:
  snapshot_id: 6202e5a0
  path_hash: sha256:1c36c33813a4b4ef28f1777670ebcee6d7a382616330297f72069b59fce9dbc0
  file: docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md
  line_range: 1715-1838
  snippet_hash: sha256:ecd39dda405508a8305c183a5f47f3f3f368bf7c85a368d91721afdb12b0b688
  scope: shared/team-standards
```

### FACT-STANDARDS-002

```yaml
fact_id: FACT-STANDARDS-002
fact: docs/standards/candidates 是 proposal-only 区，不能成为 hard project context。
source_type: contract
provider_trust: source_confirmed
source_anchor:
  snapshot_id: 6202e5a0
  path_hash: sha256:dca1272e8ca9d4e7ad93971b92757467cb0af0e9ff69b1332fc86fff9748a8ab
  file: docs/contracts/team-standards.md
  line_range: 1-320
  snippet_hash: sha256:7c1a32ea38b76237abd0e35b83f683f781f52328da0f63afe59fa2d5c3cc3b82
  scope: shared/team-standards
```

### FACT-STANDARDS-003

```yaml
fact_id: FACT-STANDARDS-003
fact: standards index 声明了 shared surface、team-standards capability 和 spec-first-maintainers owner role。
source_type: contract
provider_trust: source_confirmed
source_anchor:
  snapshot_id: 6202e5a0
  path_hash: sha256:67c362e8da168603fda585e24fec3a463f5a470428391ad7928bccb316632887
  file: docs/standards/index.md
  line_range: 1-80
  snippet_hash: sha256:96820574fb2cdb21b1a9204cbc8db520f46858e39d4e75fc177f7e2fcc3f6e82
  scope: shared/team-standards
```

### FACT-STANDARDS-004

```yaml
fact_id: FACT-STANDARDS-004
fact: standalone skill 采用 mode-specific reference loading，并且不是 public workflow。
source_type: skill-source
provider_trust: source_confirmed
source_anchor:
  snapshot_id: 6202e5a0
  path_hash: sha256:9d9de3e41b3fac7754854f1484da7371662f84e905a8ce9d193fe16e61a22c28
  file: skills/spec-team-standards-governance/SKILL.md
  line_range: 1-140
  snippet_hash: sha256:194c94ec33b4ccb13c6009bdb5ebe88b35f30a3074fb9d1d89fab40d8e80434f
  scope: shared/team-standards
```

### FACT-STANDARDS-005

```yaml
fact_id: FACT-STANDARDS-005
fact: 用户文档要求 brownfield 初始化使用单一 slice，并把 graph/code evidence 当作 advisory。
source_type: explicit-doc
provider_trust: source_confirmed
source_anchor:
  snapshot_id: 6202e5a0
  path_hash: sha256:081e0753673f6f1d0df4ffe0c1da7d163d845ae39d1b02196f25a519265520ab
  file: docs/05-用户手册/23-团队开发规范治理.md
  line_range: 1-120
  snippet_hash: sha256:ac056c0932cce6bf7bc459c87680eb928cd4d663257ec37658fb55a967d7b401
  scope: shared/team-standards
```
