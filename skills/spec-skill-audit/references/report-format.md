# Report Format

The audit writes local run artifacts under `.spec-first/audits/skill-audit/`.

## Required Files

- `skill-source-inventory.json`: deterministic source inventory
- `skill-audit-report.json`: normalized findings with severity and evidence
- `expert-scorecard.json`: score signals, never gates
- `promise-implementation-report.json`: documented promises compared with implementation facts
- `executor-context.json`: executor source/runtime origin and drift warning context
- `skill-audit-summary.md`: human summary of P0/P1 and top risks
- `skill-improvement-plan.md`: prioritized remediation plan

## Optional Files

- `trigger-routing-report.json`
- `boundary-overlap-matrix.json`
- `security-risk-report.json`
- `eval-readiness-report.json`
- `governance-drift-report.json`
- `runtime-drift-report.json`
- `patch-preview/`

## Finding Shape

```json
{
  "id": "SKILL-AUDIT-P1-BOUNDARY-001",
  "severity": "P1",
  "category": "boundary_overlap",
  "skill_id": "spec-plan",
  "title": "Boundary overlaps task compilation",
  "signal": "overlap candidate from deterministic keyword extraction",
  "claim_type": "semantic",
  "evidence": [
    {"file": "skills/spec-plan/SKILL.md", "section": "Workflow", "excerpt": "..."}
  ],
  "counter_evidence": {
    "checked": true,
    "result": "none",
    "note": "No explicit handoff boundary was found."
  },
  "completeness": "complete",
  "decision": "accepted",
  "reason": "...",
  "recommendation": "...",
  "confidence": "high",
  "fix_mode": "patch-preview-only"
}
```

## Decision Evidence Rule

Deterministic scripts may populate signal, claim type, and evidence. LLM review decides counter-evidence, completeness, and decision for semantic findings.

Valid claim types:

- `structural`
- `behavioral`
- `relational`
- `semantic`
- `security`
- `governance`
- `runtime`

## Runtime Rule

Generated runtime paths may be reported, but patch preview must not suggest hand-editing `.claude/`, `.codex/`, or `.agents/skills/`.
