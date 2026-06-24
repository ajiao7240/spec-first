# Fresh-Source Eval: spec-prd Clarification Evidence

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
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/scripts/check-prd-artifact.js
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
    - docs/05-用户手册/22-PRD需求文档质量增强流程.md
  runtime_paths_checked: []
  changed_behavior: "spec-prd now uses write_mode and clarification_evidence to block silent final PRD shortcuts, requires chat-fallback before true headless downgrade, records design_source_inventory coverage, and makes checker finding consumption explicit before readiness handoff."
  reviewer_context: "fresh read-only Codex reviewers were dispatched for multi-agent review. First pass returned P1/P2 concerns: missing eval report, over-escaped ready-for-planning detection, thin design_source_coverage acceptance, stale manual docs, and stale changelog. The current source fixed the deterministic checker issues, strengthened read/unread design coverage findings, and synchronized the user manual. Generated runtime mirrors were not used as source."
  checks:
    structured_zero_interaction_not_ready: passed
    codex_chat_fallback_not_headless: passed
    source_resolved_no_reask: passed
    large_input_ask_owner_priority: passed
    prd_owned_nonblocking_blocks_ready: passed
    checker_finding_consumption: passed
    figma_unread_or_omitted_blocks_ready: passed
    anti_ceremony_one_question_stop_and_compact_closeout: passed
    generated_runtime_mirrors: not_used
  findings: []
  not_run_reason: null
```

## Summary

This fresh-source eval reviewed the current `spec-prd` source after the clarification-evidence refactor. The target failure mode was the KAZ market-page PRD run pattern: structured multi-document input, zero owner interaction, unresolved PRD-owned/Figma questions, and a near-ready PRD output.

The current source closes that path at three layers:

- `SKILL.md` requires the Interaction Method for every owner question, distinguishes `question_delivery=chat-fallback` from `question_delivery=true-headless-unavailable`, and adds the Pre-Write Closure Gate.
- `write_mode=ask-owner-first` stops final PRD writing when the highest-risk gap can be closed by one owner question; `checkpoint-prd` is explicitly non-final; `final-prd` requires source evidence, owner answer, or evidence-backed accepted assumption.
- `prd-readiness-lens.md` consumes `write_mode`, `clarification_evidence`, checker findings, PRD-owned owner questions, and Figma/design-source residue before allowing `ready-for-planning`.

Design-source handling is now explicit. `design-source-evidence.md` defines `design_source_inventory`, `design_sources_read`, `design_sources_unread`, and `design_source_coverage`; unread design nodes that can change UI structure, state, interaction, acceptance, or scope block readiness. `check-prd-artifact.js` reports missing declarations as script-owned advisory findings, including read/unread coverage omissions.

The anti-ceremony boundary remains intact: source-proven PRD anti-ceremony is allowed. If source/owner evidence already settles WHAT, the workflow may use `clarification_evidence=source-proven-no-ask` instead of forcing performative owner questions.

## Review Notes

Two read-only subagents reviewed the current source surface. Their first pass found no P0 issues but reported P1/P2 concerns. The fixes applied after that review:

- corrected `ready-for-planning` declaration detection so non-PRD ad-hoc ready outputs still trigger declaration findings;
- made empty `design_source_coverage:` invalid even when nearby `read_status` appears;
- added `design_sources_read_undeclared` and `design_sources_unread_undeclared` findings for design-source references;
- expanded checker fixture coverage for ready-without-frontmatter and thin design-source coverage cases;
- synchronized the user manual with `write_mode`, `clarification_evidence`, checkpoint-vs-final PRD, Figma/design-source coverage, and checker facts.
- fixed final review P2s by keeping `checkpoint-prd` as `write_mode` rather than a `readiness_outcome`, and by expanding this report's structured `checks` to the eight plan-required behavior probes.

## Evidence

- `node --check skills/spec-prd/scripts/check-prd-artifact.js`: passed.
- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand --testNamePattern='PRD artifact checker reports deterministic structure and trace facts|readiness lens uses compound packs'`: passed.
- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand`: passed, 26 tests.
- `node skills/spec-prd/scripts/run-evals.js --json`: passed, 92 cases.
- `npm run typecheck`: passed, 126 files checked.

## Runtime Boundary

Generated runtime mirrors were not used as source and were not edited. Runtime regeneration, if needed by a release owner, must be done through `spec-first init`.
