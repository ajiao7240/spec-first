---
title: "Phase 1B spec-work run evidence foundation validation"
date: 2026-05-17
spec_id: 2026-05-11-002-spec-first-project-optimization-upgrade
phase: "Phase 1B"
status: passed
---

# Phase 1B spec-work run evidence foundation validation

## Scope

- Source plan: `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`
- Task pack: `docs/tasks/2026-05-17-001-feat-spec-first-optimization-phase1b-tasks.md`
- Task: T001 / U3 `spec-work durable run evidence`
- Boundary: write-side producer only. `workflow_integrated=false`; replay index and retention/prune/delete lifecycle remain deferred.

## Deterministic Validation

- `./bin/spec-first.js tasks validate docs/tasks/2026-05-17-001-feat-spec-first-optimization-phase1b-tasks.md --json` passed.
- `npm run test:jest -- tests/unit/spec-work-run-artifact-producer.test.js tests/unit/spec-work-run-artifact-contract.test.js tests/unit/runtime-capability-catalog.test.js tests/unit/runtime-contract-boundary.test.js tests/unit/changelog-format.test.js --runInBand` passed: 5 suites, 18 tests.
- `npm run test:unit` passed: 119 suites, 955 tests.
- `npm run typecheck` passed: 97 files checked.
- `node --check bin/spec-first.js` passed.
- `git diff --check` passed.

## Review / Fresh-Source Eval

- Fresh-source eval initial result: concerns. It found producer output symlink containment risk and a schema-safety concern.
- Report-only code review initial result: actionable findings. It found possible schema-invalid `plan_source` writes and unbounded `llm_asserted` prose.
- Fixes applied:
  - Output ancestor realpath containment rejects symlink escape before writing run evidence.
  - `plan_source` is validated against `explicit | inferred | missing`.
  - `llm_asserted` is restricted to known fields, with length and line caps.
  - Schema caps persisted LLM prose fields and rejects unknown `llm_asserted` fields.
  - Producer test validates the actual written artifact against the docs-side schema.
- Fresh-source re-eval final result: passed, with no findings.

## Evidence Safety

- Producer rejects generated runtime mirror refs under `.claude/`, `.codex/`, and `.agents/skills/`.
- Producer rejects provider graph artifacts under `.spec-first/graph/` and `.spec-first/providers/`.
- Producer rejects absolute paths, credential-bearing URLs, credential query params, secret-like values, raw-output fields, and oversized raw-log-like LLM prose.
- `raw_log_ref.kind` remains limited to `none | repo_relative_artifact`.
- Retention remains `lifecycle-deferred`; Phase 3 owns replay and prune/delete lifecycle.

## Runtime Impact

- Source changed; generated runtime mirrors were not hand-edited.
- Runtime catalog was regenerated from source metadata.
- The internal CLI producer is available as `spec-first internal spec-work-run-artifact write`, but `spec-work` closeout integration remains unproven and therefore `workflow_integrated=false`.
