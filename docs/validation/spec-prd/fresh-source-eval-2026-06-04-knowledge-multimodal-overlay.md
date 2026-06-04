# spec-prd Knowledge / Multimodal / Industry-Overlay Fresh-Source Eval

Date: 2026-06-04

```yaml
fresh_source_eval:
  status: passed
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/current-state-analysis.md
    - skills/spec-prd/references/domain-lenses.md
    - skills/spec-prd/evals/examples.json
  runtime_paths_checked: []
  changed_behavior: "spec-prd now (U1) accepts extracted image/PDF/meeting-notes/chat-log material as an explicit input mode routed through the existing untrusted-content rule and never confirmed without source reads; (U3) classifies local knowledge-base / code-index / retrieval-layer hits as plain source-candidate evidence with no new evidence tag, requiring direct source/docs/tests confirmation before confirmed-source and degrading to bounded direct reads when retrieval is unavailable; and (U2) layers a question-only industry overlay (securities/credit/admin/backend) on top of the existing surface lens without asserting industry rules as confirmed truth or adding a role taxonomy."
  reviewer_context: "fresh source snippets from current disk, dispatched read-only general-purpose reviewer with no skill invocation; ran in a Claude Code session that exposes a dispatch primitive"
  checks:
    trigger_precision: passed
    source_runtime_boundary: passed
    deterministic_vs_semantic_boundary: passed
    second_enum_risk: passed
    industry_rule_invention_risk: passed
    untrusted_content_handling: passed
    tests: passed
  findings:
    - severity: P3
      issue: "The `## Input` untrusted rule originally enumerated only 'referenced PRD/notes/source excerpts'; multimodal/OCR/transcription text was reachable only via the Phase 0 cross-reference."
      source: "skills/spec-prd/SKILL.md (## Input)"
      recommendation: "Resolved during this change: the `## Input` line now names 'extracted multimodal/OCR/transcription text' so the untrusted rule is self-contained."
    - severity: P3
      issue: "`extracted-multimodal` (meeting-notes/chat-log transcript) overlaps with `markdown-reference`; precedence is unstated. Harmless — both branches converge on 'untrusted reference, confirm before treating as current-state truth'."
      source: "skills/spec-prd/SKILL.md (Run-Local Decision Card, Phase 0 bullets)"
      recommendation: "Left as-is to minimize entrypoint surface; outcome already converges."
    - severity: P3
      issue: "Industry Overlay rows for Admin and Backend partially restate the existing Admin and Backend/Java surface lenses."
      source: "skills/spec-prd/references/domain-lenses.md (Industry Overlay Triggers vs Surface Lenses)"
      recommendation: "Cosmetic; the existing 'not a separate role taxonomy' line already prevents the dangerous reading. No change required."
```

## Run Provenance

- The eval was executed in a Claude Code session that exposes a dispatch primitive. A fresh read-only `general-purpose` reviewer received only the current on-disk source snippets, the three intended behavior changes (U1 multimodal input, U3 knowledge-base candidate boundary, U2 industry overlay), and the `docs/contracts/workflows/fresh-source-eval-checklist.md` review questions. The `spec-prd` skill itself was not invoked, per the checklist anti-pattern guard against cached definitions.
- The reviewer independently re-read the snippets against current disk and confirmed they match, including the five-tag evidence enum in `current-state-analysis.md` and the `surface_lens` enum in `SKILL.md`; it found no parallel role taxonomy or second evidence enum.
- The reviewer's top P3 (self-containment of the `## Input` untrusted rule) was applied as a source fix in the same change.

## Substitute Evidence

- `npx jest tests/unit/spec-prd-contracts.test.js --runInBand` passed on 2026-06-04 (16 tests).
- `npm run typecheck` passed on 2026-06-04 (107 files).
- `npm run lint:skill-entrypoints` passed on 2026-06-04 (181 files scanned; dual-host entrypoint governance).
- Source/runtime boundary was checked by direct reads and by keeping edits under `skills/`, `tests/`, `docs/validation/`, and `CHANGELOG.md`; generated runtime mirrors (`.claude/`, `.codex/`, `.agents/skills/`) were not edited.
