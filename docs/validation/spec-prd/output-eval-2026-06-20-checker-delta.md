# spec-prd Output Eval Checker Delta

```yaml
output_eval:
  schema_version: spec-prd-output-eval-record.v1
  date: 2026-06-20
  producer: spec-work
  skill: spec-prd
  execution_kind: recorded_fixture
  model_executed: false
  fixture_storage: out-of-repo
  score_source:
    - skills/spec-prd/scripts/check-prd-artifact.js
  authority_level: advisory
  reason_code: deterministic-checker-delta-smoke
```

## Purpose

This record provides the first with-skill vs baseline output-eval smoke signal for `spec-prd` without adding an in-repo `evals/output/` fixture tree.

The run used five in-memory recorded fixture pairs and scored each pair with `check-prd-artifact.js`. It proves the deterministic checker can distinguish common low-quality PRD shapes from PRD-grade outputs that follow the current `spec-prd` contract. It is not model-executed evidence and does not claim provider-backed PRD generation quality.

## Cases

| case | baseline findings | with-skill findings | delta | baseline reason codes | with-skill reason codes |
| --- | ---: | ---: | ---: | --- | --- |
| compact | 7 | 0 | 7 | core_section_missing, core_section_missing, core_section_missing, core_section_missing, core_section_missing, frontmatter_missing, requirement_without_acceptance_ref | none |
| low_quality_refine | 7 | 0 | 7 | artifact_kind_missing_or_wrong, core_section_missing, core_section_missing, core_section_missing, core_section_missing, placeholder_or_todo_present, requirement_without_acceptance_ref | none |
| feature_slice_trace | 1 | 0 | 1 | feature_slice_missing_acceptance_trace | none |
| forbidden_path | 8 | 0 | 8 | core_section_missing, core_section_missing, core_section_missing, core_section_missing, core_section_missing, forbidden_prds_path, frontmatter_missing, requirement_without_acceptance_ref | none |
| outstanding_counts | 3 | 0 | 3 | placeholder_or_todo_present, placeholder_or_todo_present, requirement_without_acceptance_ref | none |

## Summary

- Cases: 5
- Baseline findings: 26
- With-skill findings: 0
- Absolute delta: 26 fewer deterministic findings
- File-backed fixture evidence: missing evidence
- Model-executed evidence: missing evidence
- Blind A/B review: missing evidence

## Limits

This is a deterministic recorded-fixture smoke run. It does not prove that a live LLM invocation of `spec-prd` will consistently produce the with-skill variants, and it does not evaluate semantic qualities that `check-prd-artifact.js` intentionally leaves to LLM-owned readiness judgment.

The next stronger eval should run the same five shapes as live PRD-generation prompts, keep raw outputs outside the skill source tree, then record only the scorecard, execution metadata, and any reviewer adjudication here.
