# Artifact Handoff Map

## Artifact Boundary Judgment

The main artifact problem is not lack of Markdown output. It is inconsistent trust metadata and inconsistent consumer contracts. Strong stages already produce useful artifacts; weak stages either produce prose only or expose temporary/session artifacts as if downstream consumers could depend on them.

## Stage Map

| Stage | Consumes | Produces | Current stability | Main consumer | Gap |
| --- | --- | --- | --- | --- | --- |
| brainstorm | user idea, repo context, optional Slack context | requirements document under `docs/brainstorms/` | Medium | `spec-plan` | Needs uniform artifact header with `spec_id`, non-goals, assumptions, and evidence labels. |
| doc-review | requirements/plan/task-pack path, pre-facts | reviewed findings, edits, headless envelope | Medium-high | `spec-plan`, `spec-work`, humans | No durable JSON run artifact promised; local finding schema diverges from code/app review. |
| plan | requirements doc, repo facts, graph/standards context | plan under `docs/plans/` | Medium-high | `spec-write-tasks`, `spec-work`, doc-review | Good prose contract, but no canonical requirements-packet file. |
| write-tasks | plan path or task-pack | task-pack with Task Pack Contract | High | `spec-work` | Strongest derived artifact; should become template for `artifact-header.v1`. |
| work | plan/task-pack/current request, source files, tests | code/docs changes, summary, optional review handoff | Medium-high | `spec-code-review`, compound | Work run artifact is planned/partial, not uniformly produced. |
| debug | symptom, repro, tests/logs/source | fix, root-cause summary, optional review/compound handoff | Medium | `spec-code-review`, compound | Needs explicit bug evidence packet for reusable root-cause chain. |
| optimize/polish | optimization spec or browser-visible UI | experiment logs or UI diffs | Medium-low | code-review, compound | Long-running state exists for optimize; polish is beta and lacks artifact/write contract. |
| code-review | diff, plan/task/work artifacts, pre-facts | merged findings, safe_auto fixes, temp artifact, verdict | High | work, humans, compound | Strong local schema; needs shared `review-finding.v1`. |
| app-consistency-audit | PRD/Figma/source/diff | run-scoped audit artifacts and issue protocol | High | code-review, plan, polish | Strong but domain-specific; general evidence-packet could reuse its gates. |
| compound | solved problem, diff/session/context | docs/solutions learning | Medium | future plan/review/work | Risk of memory/session findings entering docs without a shared evidence-packet. |
| skill-audit | repo skills and optional runtime | `.spec-first` audit reports, improvement plan | High for skills, medium-low for agents | maintainers | Agent audit is mostly semantic; runtime drift support failed in this run. |
| sessions | session history query | synthesized prior-session findings | Medium | compound, planning, debugging | Outputs are prose unless caller provides schema. |

## Missing Or Weak Handoffs

| Gap | Evidence | Impact | Recommendation | Priority |
| --- | --- | --- | --- | --- |
| `review-finding.v1` not universal | Code-review has schema-like table/JSON; doc-review has separate schema; app audit has domain schema; agents vary. | Synthesis cannot be shared across review types. | Define a shared minimum finding envelope and let workflows extend it. | P0 |
| Runtime parity unverified | Runtime drift audit failed trusted-checkout validation. | Cannot prove generated mirrors match source. | Fix runtime audit path support or record degraded runtime status explicitly. | P0 |
| `artifact-header.v1` absent | Plans/task-packs/review reports use different identifiers. | Cross-stage traceability is fragile. | Add minimal header: artifact_type, spec_id, source, generated_at, run_id, trust_level. | P1 |
| work run artifact inconsistent | Work summary exists, but no stable repo-local run artifact is guaranteed. | Code review and compound lose execution evidence. | Add optional session-local run summary, not a heavy state machine. | P1 |
| compound evidence packet missing | Compound can ingest session/memory/context. | Knowledge may preserve weak assumptions. | Require fact/inference/assumption labels in generated solution docs. | P1 |
| skill-audit report-only missing | Default audit writes `.spec-first/audits/skill-audit/latest/`. | Read-only policy is semantically clear but artifact side effect is implicit. | Add `--report-only` or explicit `--output-dir` contract. | P1 |

## Consumer Map

| Producer artifact | Consumer | Required trust checks before use |
| --- | --- | --- |
| graph/provider readiness facts | `spec-plan`, `spec-code-review`, `spec-doc-review`, `spec-standards`, `spec-work` | `query_ready`, `source_revision`, dirty/fingerprint status, degraded reason. |
| task pack | `spec-work`, `spec-code-review` | source plan path/hash, task ids, acceptance criteria, validation status. |
| review findings | `spec-work`, `resolve-pr-feedback`, humans, `spec-compound` | severity, evidence, confidence, owner, verification, changelog flag. |
| app consistency artifacts | `spec-code-review`, `spec-plan`, `spec-polish-beta` | metadata/current HEAD, diff hash, worktree fingerprint, verdict scope. |
| session/history summaries | `spec-sessions`, `spec-compound`, planning/debugging workflows | source session ids or anchors, freshness, privacy boundary, fact/inference labels. |
| generated runtime assets | host runtime | must be regenerated from source; never treated as source truth. |
