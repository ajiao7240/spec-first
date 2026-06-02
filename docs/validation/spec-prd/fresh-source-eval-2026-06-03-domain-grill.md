# spec-prd Domain Grill Fresh-Source Eval

Date: 2026-06-03

```yaml
fresh_source_eval:
  status: passed
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/evals/examples.json
    - skills/spec-plan/SKILL.md
  runtime_paths_checked: []
  changed_behavior: "spec-prd applies a bounded source-first run-local grill (Bounded Scenario Grill / Domain Grill Gate / domain-grill coverage — one mechanism) for load-bearing terminology, source/user contradictions, and material PRD decisions, asking one owner question at a time (cap 1-3) with a recommended_answer and persisting only into PRD-local sections, while spec-plan stays a thin handoff that routes unresolved WHAT/domain gaps back to PRD refine."
  reviewer_context: "fresh source snippets from current disk, dispatched read-only general-purpose reviewer with no skill invocation; ran in a Claude Code session that exposes a dispatch primitive"
  checks:
    trigger_precision: passed
    source_runtime_boundary: passed
    host_entrypoints: passed
    internal_only_boundary: passed
    deterministic_vs_semantic_boundary: passed
    field_consistency: passed
    alias_clarity: passed
    tests: passed
  findings:
    - severity: P3
      issue: "grill write_target allows four destinations (Glossary | Decision Notes | Evidence And Assumptions | Outstanding Questions) but the 7→6 field-folding note only spells out the Decision Notes case; non-Decision-Notes targets leave the agent to infer how the asking-format fields compress. Low risk: those sections have lighter, already-defined formats and the 'not a third persistent field set' line prevents drift."
      source: "skills/spec-prd/references/domain-language-and-decision-ledger.md (Bounded Scenario Grill, field-folding note)"
      recommendation: "Optional: add a half-sentence noting non-Decision-Notes targets compress into that section's existing format (no new fields)."
```

## Run Provenance

- This record supersedes an earlier `not_run` draft. The earlier draft was written in a Codex session whose subagent tool was gated to explicit user authorization, so fresh-source dispatch was unavailable there.
- The eval above was executed in a Claude Code session that exposes a dispatch primitive. A fresh read-only `general-purpose` reviewer received only the current on-disk source snippets, the intended behavior change, and the `docs/contracts/workflows/fresh-source-eval-checklist.md` review questions. The spec-prd skill itself was not invoked, per the checklist anti-pattern guard against cached definitions.

## Substitute Evidence

- `npx jest tests/unit/spec-prd-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand` passed on 2026-06-03 (30 tests).
- `npm run typecheck` passed on 2026-06-03 (103 files).
- Source/runtime boundary was checked by direct reads and by keeping edits under `skills/`, `tests/`, `docs/validation/`, `docs/plans/`, and `CHANGELOG.md`; generated runtime mirrors were not edited.
