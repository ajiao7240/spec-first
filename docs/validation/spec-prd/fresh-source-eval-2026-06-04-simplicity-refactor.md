# spec-prd Simplicity Refactor Fresh-Source Eval

Date: 2026-06-04

```yaml
fresh_source_eval:
  status: not_run
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/evidence-and-topology.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
    - tests/unit/spec-prd-contracts.test.js
  runtime_paths_checked: []
  changed_behavior: "spec-prd source was simplified from a multi-reference plus packaged-template structure into a smaller steel-frame structure: SKILL.md owns the decision-tree intake, evidence-and-topology.md owns current-state evidence plus topology/framing/source-of-truth boundaries, prd-output-template.md owns output shape/surface lenses/project-local overlays/embedded runtime skeleton, and prd-readiness-lens.md groups readiness into compound packs. The former intent-routing/current-state/change-topology/domain-lenses references and templates/standard tree were removed as duplicate runtime surfaces."
  reviewer_context: "direct source reads from current disk plus focused contract tests; no generated runtime mirrors were used as source"
  checks:
    trigger_precision: not_checked
    source_runtime_boundary: not_checked
    host_entrypoints: not_checked
    internal_only_boundary: not_checked
    deterministic_vs_semantic_boundary: not_checked
    tests: passed
  findings: []
  not_run_reason: "The current Codex host exposes a multi-agent dispatch tool, but its tool contract permits spawning only when the user explicitly asks for sub-agents, delegation, or parallel agent work. The user asked for a direct simplification/refactor, not helper-agent dispatch. Per the fresh-source eval checklist, this record does not claim semantic eval passed."
```

## Substitute Evidence

- Direct source reads covered the current `skills/spec-prd/` source files, deleted references/templates, contract tests, human-facing template README, glossary contract, and CHANGELOG.
- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand` passed on 2026-06-04 (15 tests).
- `npm run test:unit` passed on 2026-06-04 (127 suites, 958 tests).
- `npm run typecheck` passed on 2026-06-04 (107 files).
- `npm run lint:skill-entrypoints` passed on 2026-06-04 (173 files scanned).
- Source/runtime boundary: generated runtime mirrors (`.claude/`, `.codex/`, `.agents/skills/`) were not edited.
