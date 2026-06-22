# spec-prd Requirements Grill Fresh-Source Eval

```yaml
fresh_source_eval:
  schema_version: fresh-source-eval-record.v1
  producer: spec-work
  freshness: current-worktree
  authority_level: advisory
  reason_code: fresh-source-eval-not-run
  consumer: spec-prd contract tests and code-review closeout
  status: not_run
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
  runtime_paths_checked: []
  changed_behavior: "spec-prd now routes rough PRD refinement through a PRD-local Pre-PRD Clarification Loop when planning would otherwise invent WHAT; adds run-local large-input Map-Reduce guidance, P0/P1 PRD quality packs, Deep Requirements Grill closure, and Context / ADR Topology Adapter boundaries."
  reviewer_context: "not dispatched; direct source reads and focused contract tests are the current evidence path"
  checks:
    trigger_precision: not_checked
    source_runtime_boundary: not_checked
    host_entrypoints: not_checked
    internal_only_boundary: not_checked
    deterministic_vs_semantic_boundary: not_checked
    tests: passed
  findings: []
  not_run_reason: "The current Codex request did not explicitly authorize helper subagent dispatch for fresh-source semantic eval. This record therefore stays not_run and does not claim semantic eval passed; deterministic checks and direct review are recorded separately."
sample_validation:
  status: not_measured
  reason_code: no_representative_rough_prd_sample_executed
  recheck_condition: "Run a real rough PRD refine before planning and compare whether missing-WHAT feedback decreases versus the old Domain Grill-only posture."
```

## Direct Evidence

- Source reads covered the current `spec-prd` entrypoint, domain/question reference, PRD output template, readiness lens, eval examples, contract tests, and plan `docs/plans/2026-06-22-003-feat-spec-prd-requirements-grill-plan.md`.
- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand` passed on 2026-06-22: 1 suite, 18 tests.
- `npx jest tests/unit/spec-prd-contracts.test.js tests/unit/changelog-format.test.js tests/unit/plan-status-taxonomy.test.js tests/unit/eval-fixture-contracts.test.js --runInBand` passed on 2026-06-22: 4 suites, 38 tests.
- `npm run test:unit` passed on 2026-06-22: 155 suites, 1337 tests.
- The implementation keeps durable PRD output under `docs/brainstorms/*-requirements.md` with `artifact_kind: prd-requirements`.
- Pre-PRD Clarification Loop, large-input Map-Reduce, P0/P1 PRD quality packs, Deep Requirements Grill, and Context / ADR Topology Adapter are prompt/reference discipline only; no new public workflow, reference file, schema, extraction artifact, or script semantic gate was added.
- generated runtime mirrors (`.claude/`, `.codex/`, `.agents/skills/`) were not read as source and were not edited.

## Boundary Notes

- This artifact does not claim semantic eval passed.
- Contract tests can verify source contract text exists, but they are not a substitute for a dispatched fresh-source reviewer.
- If a later run receives explicit dispatch authorization, create a new dated artifact or append reviewer provenance rather than rewriting this `not_run` record as passed.
