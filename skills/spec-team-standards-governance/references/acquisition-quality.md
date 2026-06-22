# Acquisition Quality

V1 only defines lightweight gates for candidates and patch previews.

Rule quality checklist before `confirmed-draft`:

- atomic
- actionable
- falsifiable
- scoped
- owner status present
- invalidation condition present
- migration impact stated
- examples or source refs sufficient for review

Pre-write hygiene gate:

- secret scan
- PII scan
- local absolute path scan
- prompt-injection scan

Gate warning routing:

| Warning | Next action |
| --- | --- |
| evidence warning | `collect-more-evidence` |
| actionability warning | `refine-rule` |
| abstraction warning | `refine-rule` |
| derivation warning | `refine-rule` |
| risk warning | `owner-review` |
| conflict warning/fail | `resolve-conflict` or `owner-review` |
| privacy warning | `redact` |

Do not promote personal preferences, temporary workarounds, historical debt, low-frequency exceptions, unconfirmed review opinions, stale architecture remnants or sensitive business details.

## V2 Acquisition Task Pack

V2 acquisition runs must start from a single-target task pack. The pack records deterministic scope and privacy facts before the LLM synthesizes candidates:

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

Mixed-surface, mixed-domain or unrelated-capability input must be rejected and split before formal promotion. A run may share a summary with adjacent batches only after each batch has its own extraction target.

## V2 Evidence Quality Fields

Every V2 candidate records the score reason for:

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

Scores explain evidence quality; they do not replace authority tier, owner decision, replay results or diff review.

## V2 Source Anchor Fields

Every deterministic fact and candidate evidence item should have a source anchor:

- `source_type`
- `snapshot_id`
- `path_hash`
- `file`
- `line_range`
- `snippet_hash`
- `fact_id`
- `scope`

Use repo-relative file paths. Provider outputs such as graph/code summaries are `provider_untrusted` until reconfirmed from current source, tests, docs, logs or config.

## V2 Quality Gates

| Gate | Pass | Warning | Fail | Warning/fail route |
| --- | --- | --- | --- | --- |
| Evidence | multiple current source refs or explicit authority | thin source refs | no source refs | `collect-more-evidence` |
| Actionability | rule is testable by reviewer or tool | vague action verb | slogan only | `refine-rule` |
| Abstraction | no sensitive or one-off detail | too implementation-specific | leaks sensitive detail | `refine-rule` or `redact` |
| Conflict | no known conflict | possible overlap | direct conflict | `resolve-conflict` |
| Risk | low impact or owner available | high impact with owner candidate | high impact and owner unresolved | `owner-review` |
| Derivation | source refs justify wording | wording over-generalizes | invented policy | `refine-rule` or `reject` |
| Anchor | source anchor present | partial anchor | no anchor | `collect-more-evidence` |
| Privacy | `redaction_status=not-needed` or `redacted` | uncertain | blocked | `redact` |

Evidence/actionability/abstraction warnings do not enter owner queue by themselves. Owner queue is for conflict, high-risk or explicit owner-required decisions.
