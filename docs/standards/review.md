# Review Standards

Rules here govern project-standards review behavior. They do not replace generic review personas; they constrain only findings that claim to enforce written project standards.

### REVIEW-STANDARDS-001 Findings Must Cite Written Rules

```yaml
id: REVIEW-STANDARDS-001
trust: confirmed
lifecycle_state: active
promotion_state: none
priority: P1-required
category: review
risk_domain:
applies_to: [shared]
layer: [workflow]
capability: [team-standards]
owner: spec-first-maintainers
source_refs:
  - agents/spec-project-standards-reviewer.agent.md
  - docs/contracts/team-standards.md
  - docs/standards/index.md#owner-registry
enforcement: [review]
effective_from: 2026-06-23
migration_impact: touched-files-only
last_reviewed: 2026-06-23
```

Rule: A project-standards finding must cite both a concrete written rule ID or standards section and the changed source/diff evidence that violates it.

Rationale: Project standards review should enforce project-owned rules, not generic best practices or reviewer taste.

Exceptions: None. Generic maintainability, style or architecture advice belongs to other reviewer personas unless a confirmed standard exists.

Invalidation condition: Revisit if project-standards review is replaced by a different evidence-anchored enforcement mechanism.
