# Fresh-Source Eval: spec-prd Product Expert Lens

```yaml
fresh_source_eval:
  schema_version: fresh-source-eval-record.v1
  producer: spec-work
  freshness: current-worktree
  authority_level: advisory
  reason_code: fresh-source-eval-dispatched
  consumer: spec-prd contract tests and work closeout
  status: passed
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/product-expert-lens.md
    - skills/spec-prd/references/design-source-evidence.md
    - skills/spec-prd/references/large-input-checkpoint.md
    - skills/spec-prd/references/grill-with-docs-integration.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
    - docs/05-用户手册/22-PRD需求文档质量增强流程.md
  runtime_paths_checked: []
  changed_behavior: "Product Expert Lens 成为 spec-prd 默认热路径的 canonical 产品判断层，并新增 trigger-only design-source / large-input checkpoint 分支。"
  reviewer_context: "fresh read-only Codex reviewers were dispatched with explicit user authorization for multi-agent review; reviewers read current on-disk source and did not invoke or simulate the cached spec-prd skill. Generated runtime mirrors were not used as source."
  checks:
    trigger_precision: passed
    source_runtime_boundary: passed
    host_entrypoints: passed
    internal_only_boundary: passed
    deterministic_vs_semantic_boundary: passed
    tests: passed
  findings: []
  not_run_reason: null
```

## Summary

Fresh-source review first returned `status=concerns` with one material P1: `prd-output-template.md` and `prd-readiness-lens.md` still copied the design WHAT extraction list instead of consuming `design-source-evidence.md` as the single source. That concern was fixed by changing both consumers to reference the `design-source-evidence.md` External Evidence Interface (`extracted_design_what` / `affected_PRD_write_targets`) and by adding negative contract assertions that the copied extraction list does not return.

After the fix, the current source satisfies the task intent:

- `product-expert-lens.md` is the canonical Product Expert Lens source and defines the run-local interface.
- `SKILL.md`, `grill-with-docs-integration.md`, `prd-output-template.md`, and `prd-readiness-lens.md` consume the Lens interface instead of maintaining a second product lens.
- `design-source-evidence.md` is trigger-only, provider-advisory, per-run/per-user/per-host/per-OS, and never-block.
- `large-input-checkpoint.md` is trigger-only; reduced candidates feed Product Expert Lens; PRD sections act as checkpoints; no transcript/progress schema is introduced.
- Eval fixtures include product-judgment and naming-only failure coverage.

## Evidence

- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand`: passed, 24 tests.
- `node skills/spec-prd/scripts/run-evals.js --json`: passed, 84 cases, `reason_code=eval_fixture_passed`.
- `npm run typecheck`: passed, 126 files checked.
- `npx jest tests/unit/changelog-format.test.js tests/unit/task-pack-command.test.js --runInBand`: passed, 50 tests.
- `spec-first tasks validate docs/tasks/2026-06-24-001-refactor-spec-prd-three-stage-clarity-tasks.md --json`: valid, `deterministic_handoff=true`.

## Runtime Boundary

No generated runtime mirror was hand-edited. Runtime regeneration, if needed by the release owner, must be done through `spec-first init`; it is not source evidence for this eval.
