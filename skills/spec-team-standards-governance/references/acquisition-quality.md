# 获取质量

V1 只为 candidates 和 patch previews 定义 lightweight gates。

进入 `confirmed-draft` 前的 rule quality checklist：

- atomic
- actionable
- falsifiable
- scoped
- owner status present
- invalidation condition present
- migration impact stated
- 足够 review 的 examples 或 source refs

写入前 hygiene gate：

- secret scan
- PII scan
- local absolute path scan
- prompt-injection scan

Gate warning routing：

| Warning | Next action |
| --- | --- |
| evidence warning | `collect-more-evidence` |
| actionability warning | `refine-rule` |
| abstraction warning | `refine-rule` |
| derivation warning | `refine-rule` |
| risk warning | `owner-review` |
| conflict warning/fail | `resolve-conflict` or `owner-review` |
| privacy warning | `redact` |

不要提升 personal preferences、temporary workarounds、historical debt、low-frequency exceptions、unconfirmed review opinions、stale architecture remnants 或 sensitive business details。

## V2 Acquisition Task Pack

V2 acquisition runs 必须从 single-target task pack 开始。该 task pack 在 LLM 综合 candidates 前记录 deterministic scope 和 privacy facts：

- `acquisition_id`
- `target_repo`
- `extraction_target.surface`
- `extraction_target.sub_domain`
- `capability`
- `project_paths`
- `scope.include`
- `scope.exclude`
- `time_window`
- `evidence_sources`
- `excluded_sources`
- `privacy_boundary`
- `expected_candidate_types`
- `non_goals`
- `owner_candidates`
- `output.mode`
- `constraints`

Mixed-surface、mixed-domain 或 unrelated-capability input 必须在 formal promotion 前被拒绝并拆分。只有每个 batch 都有自己的 extraction target 后，一个 run 才可以与相邻 batches 共享 summary。

## V2 Evidence Quality 字段

每个 V2 candidate 都记录下列分数的理由：

- `source_strength`
- `recency`
- `consistency`
- `coverage`
- `conflict_density`
- `enforcement_feasibility`
- `owner_trace`
- `migration_cost`
- `risk_level`
- `retrieval_value`

Scores 用于解释 evidence quality；它们不能替代 authority tier、owner decision、replay results 或 diff review。

## V2 Source Anchor 字段

每个 deterministic fact 和 candidate evidence item 都应有 source anchor：

- `source_type`
- `snapshot_id`
- `path_hash`
- `file`
- `line_range`
- `snippet_hash`
- `fact_id`
- `scope`

使用 repo-relative file paths。graph/code summaries 等 provider outputs 在被当前 source、tests、docs、logs 或 config 复核前都是 `provider_untrusted`。

## V2 Quality Gates

| Gate | Pass | Warning | Fail | Warning/fail route |
| --- | --- | --- | --- | --- |
| Evidence | 多个当前 source refs 或 explicit authority | source refs 较薄 | 没有 source refs | `collect-more-evidence` |
| Actionability | rule 可由 reviewer 或 tool 测试 | action verb 含糊 | 只有 slogan | `refine-rule` |
| Abstraction | 没有 sensitive 或 one-off detail | 过度绑定实现细节 | 泄漏 sensitive detail | `refine-rule` or `redact` |
| Conflict | 无已知 conflict | 可能 overlap | 直接 conflict | `resolve-conflict` |
| Risk | low impact 或 owner available | high impact 且有 owner candidate | high impact 且 owner unresolved | `owner-review` |
| Derivation | source refs 足以支持 wording | wording 过度泛化 | invented policy | `refine-rule` or `reject` |
| Anchor | source anchor present | partial anchor | no anchor | `collect-more-evidence` |
| Privacy | `redaction_status=not-needed` 或 `redacted` | uncertain | blocked | `redact` |

Evidence/actionability/abstraction warnings 不会单独进入 owner queue。Owner queue 只处理 conflict、high-risk 或 explicit owner-required decisions。
