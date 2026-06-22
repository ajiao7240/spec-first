# spec-write-tasks Eval Fixture Contract

This directory stores maintainer-only LLM review fixtures. It is not an executable eval runner and not a user-runtime dependency for generic `.skill` packages. The official `.skill` packager skips root `evals/`; validate skill quality from the source repo with these fixtures, `scripts/spec-write-tasks/run-output-evals.js`, or future provider-backed evals.

## Contract

- `trigger-cases.json`, `boundary-cases.json`, `failure-cases.json`, and `expected-behavior-cases.json` provide reviewable examples only; they do not replace LLM semantic judgment.
- `yao-trigger-cases.json`, `semantic_config.json`, and `output/cases.jsonl` provide Yao-compatible smoke fixtures for trigger/output eval tooling. They are compatibility evidence only; the authoritative spec-first eval contract remains this directory's source JSON plus repo-level runners.
- `output-quality-cases.json` records file-backed output-quality review cases for judging whether a skill-guided task pack is better than a generic task split. It is not a provider-backed model eval; `deterministic_assertions` can be executed by the repo-level runner, while `objective_assertions` remain reviewer narrative.
- `expected_decision` must come from the `SKILL.md` Final Decision Envelope: `compile`, `skip`, `return-to-plan`, `draft-only`, or `validate-only`.
- `expected_failure` must come from the `SKILL.md` Failure Modes enumeration.
- Every decision declared in the Final Decision Envelope must have at least one eval case.
- Every failure declared in Failure Modes must have at least one eval case.
- Deterministic tests only check JSON shape, case id uniqueness, decision/failure enum validity, coverage, and runner contract; they do not judge semantic quality.
- Output-quality cases must declare `input_files`, `baseline_risks`, `with_skill_expectations`, `objective_assertions`, and applicable `deterministic_assertions`. Missing real files, provider telemetry, human adjudication, or model execution evidence must be labeled as `missing evidence`; do not claim output quality is fully proven.
- Repo-level scorecards are written to `docs/validation/spec-write-tasks/output_quality_scorecard.{json,md}` and must include owner/review cadence, generated_at, command, source revision, rerun command, targeted recorded-output hash, and rollback boundary. Reports are maintainer evidence, not packaged runtime dependencies.

## Review Boundary

When adding or changing cases, derive the current decision/failure enums from `SKILL.md` first, then update the fixtures. Scripts detect drift; the LLM judges whether each example represents a real trigger, boundary, failure, or expected behavior.
