# Report Format

The audit writes local run artifacts under `.spec-first/audits/skill-audit/`.

## Required Files

- `skill-source-inventory.json`: deterministic source inventory
- `reviewer-guard-coverage-report.json`: deterministic reviewer-agent guard section coverage facts
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

## Output Location And Run Set

Default outputs are local audit artifacts under `.spec-first/audits/skill-audit/latest/`. The full self-audit run may write:

- `skill-source-inventory.json`
- `reviewer-guard-coverage-report.json`
- `rule-maturity-observations.json`
- `expert-scorecard.json`
- `skill-audit-report.json`
- `trigger-routing-report.json`
- `boundary-overlap-matrix.json`
- `security-risk-report.json`
- `eval-readiness-report.json`
- `promise-implementation-report.json`
- `governance-drift-report.json`
- `runtime-drift-report.json`
- `executor-context.json`
- `skill-audit-summary.md`
- `skill-improvement-plan.md`

When the user explicitly asks for patch preview it may also write `patch-preview/summary.md` and `patch-preview/*.patch.md`.

`.spec-first/audits/` is a gitignored execution artifact directory. It is not source truth and can be deleted or regenerated.

## Context-Governance Exception

This workflow is an explicit exception to the ordinary runtime context exclusion in `docs/contracts/context-governance.md`: it may read `.spec-first/audits/skill-audit/**` for the current audit summary, scorecard, and drift evidence. For repo-wide spec-first audits it may also read `.spec-first/governance/rule-maturity.json` to write `rule-maturity-observations.json`; that artifact reports periodic governance health facts and does not trigger human review, adjudication, or promotion. Other workflows should treat `.spec-first/audits/**` and `.spec-first/governance/**` as excluded runtime artifacts unless the user names a precise path or the task is explicitly about audit/runtime/governance evidence.

## Failure Mode Reason Codes

- No source skills found: report `NO_SKILLS_FOUND`, show searched paths, suggest the expected `skills/<name>/SKILL.md` layout.
- Target is not the spec-first repo root or one local skill directory under `skills/`: stop for this version and explain that generic local skill collection audit is intentionally deferred.
- Governance validation fails: continue source inventory and structure checks, report the governance validation error as audit evidence, do not rewrite the governance file.
- Runtime directories missing: mark runtime status `not_initialized`, do not fail the audit, recommend rerunning the appropriate init command only when runtime delivery is required.
- Runtime drift detected: report drift, recommend rerunning init, do not patch generated runtime copies.
