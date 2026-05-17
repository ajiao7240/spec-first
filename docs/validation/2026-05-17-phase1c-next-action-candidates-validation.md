---
title: "Phase 1C next-action-candidates validation"
date: 2026-05-17
spec_id: 2026-05-11-002-spec-first-project-optimization-upgrade
phase: "1C"
status: passed
---

# Phase 1C next-action-candidates validation

## Scope

Source plan:

- `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`

Task pack:

- `docs/tasks/2026-05-17-002-feat-spec-first-optimization-phase1c-tasks.md`

Implemented scope:

- `spec-standards` now writes `.spec-first/standards/next-action-candidates.json` in non-quick baseline/refresh/deep runs.
- The artifact is workflow handoff facts only: candidate facts, reason codes, source fact refs, evidence paths, possible public entrypoints, target repo scope, authority, provenance, readiness, and redaction classification.
- The script does not write a final workflow recommendation, ranking, blocking policy, mode matrix, or single `target_entrypoint`.
- `validate-artifacts.js --next-action-candidates <path> --json` supports standalone contract validation and fails closed on unknown schema, malformed candidates, decision fields, unsafe paths, missing readable evidence artifacts, and raw provider excerpts.
- `skills/spec-standards/examples/next-action-candidates.example.json` covers missing graph readiness, workspace advisory only, absent tests, missing package scripts, stale validation, and child repo ambiguity examples.

Out of scope retained:

- Phase 2 quick/refresh mode matrix, stale/rebuild lifecycle, migration policy, and blocking classifications.
- Phase 3 replay/retention lifecycle.
- Generated runtime mirror edits under `.claude/`, `.codex/`, or `.agents/skills/`.

## Validation Commands

Passed:

```bash
./bin/spec-first.js tasks validate docs/tasks/2026-05-17-002-feat-spec-first-optimization-phase1c-tasks.md --json
node --check skills/spec-standards/scripts/prepare-baseline.js
node --check skills/spec-standards/scripts/validate-artifacts.js
npm run test:jest -- tests/unit/spec-standards-contracts.test.js tests/unit/spec-standards-validation.test.js tests/unit/spec-standards-consumers.test.js --runInBand
npm run test:jest -- tests/unit/changelog-format.test.js --runInBand
npm run typecheck
git diff --check
npm run test:unit
```

Results:

- Targeted `spec-standards` tests: 3 suites, 78 tests passed.
- Changelog format tests: 1 suite, 2 tests passed.
- Typecheck: 97 files checked.
- Unit suite: 119 suites, 966 tests passed.
- `git diff --check`: passed.

## Fresh-Source Eval

Fresh-source reviewer reviewed current disk source after implementation.

Initial findings:

- P1: validator accepted forbidden semantic decision fields such as `ranking`, `blocking_policy`, and `recommended_entrypoint`.
- P2: example coverage did not include all Phase 1C candidate kinds listed in the plan.
- P2: `evidence_paths` checked path shape but not readable artifact existence.

Fixes applied:

- Added a denylist for top-level and candidate-level decision fields: `target_entrypoint`, `recommended_entrypoint`, `workflow_recommendation`, `recommendation`, `ranking`, `rank`, `score`, `blocking_policy`, `blocking`, and `mode_matrix`.
- Added readable evidence artifact checks for `.spec-first/standards/**` evidence paths.
- Expanded the example artifact and tests to cover all required candidate kinds.

Fresh-source re-eval result:

- No findings.
- Reviewer verified validator rejection of all decision fields, missing readable evidence artifacts, example coverage, and producer facts-only behavior.

## Boundary Notes

- Source-of-truth files were edited; generated runtime mirrors were not edited.
- Graph facts are still stale for this dirty branch and were not used as graph-backed implementation evidence.
- `standards-update-decision.json` continues to own quick/refresh freshness decisions; `next-action-candidates.json` does not replace it.
- `standards-candidates.json` continues to own LLM-generated standards content candidates; `next-action-candidates.json` does not contain project standards.
