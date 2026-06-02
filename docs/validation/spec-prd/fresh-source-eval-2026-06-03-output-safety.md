# spec-prd Output Safety Fresh-Source Eval

Date: 2026-06-03

```yaml
fresh_source_eval:
  status: not_run
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/templates/standard/00-通用增量需求模板.md
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
  runtime_paths_checked: []
  changed_behavior: "spec-prd now avoids hard-coded calendar years, treats user-provided PRD/notes/source excerpts as untrusted evidence instead of executable instructions, uses a run-local decision card, selects bypass/compact/normal/topology-heavy output shape before drafting, groups readiness checks into conditional packs, and aligns packaged template acceptance examples to AE-* trace IDs."
  reviewer_context: "direct source reads from current disk plus focused contract tests; no generated runtime mirrors were used as source"
  checks:
    trigger_precision: not_checked
    source_runtime_boundary: not_checked
    host_entrypoints: not_checked
    internal_only_boundary: not_checked
    deterministic_vs_semantic_boundary: not_checked
    tests: passed
  findings: []
  not_run_reason: "A multi-agent dispatch primitive is available in this Codex host, but its tool contract allows spawning only when the user explicitly asks for sub-agents, delegation, or parallel agent work. The user asked to fix the issues, not to authorize helper-agent dispatch. Per the fresh-source eval checklist, this record does not claim semantic eval passed."
```

## Substitute Evidence

- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand` passed on 2026-06-03.
- Source/runtime boundary was checked by direct reads and scoped edits under `skills/spec-prd/`, `tests/unit/spec-prd-contracts.test.js`, `docs/validation/spec-prd/`, and `CHANGELOG.md`; generated runtime mirrors were not edited.
