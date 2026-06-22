# Security And Candidate Hygiene Standards

This file covers safety rules for standards candidates, derived artifacts and handoff snippets.

### SEC-CANDIDATE-001 Candidate Writes Need Hygiene Gate

```yaml
id: SEC-CANDIDATE-001
trust: confirmed
lifecycle_state: active
promotion_state: none
priority: P0-blocking
category: security
risk_domain: privacy
applies_to: [shared]
layer: [docs, workflow]
capability: [security, team-standards]
owner: security-owner
source_refs:
  - docs/contracts/team-standards.md
  - docs/standards/index.md#owner-registry
enforcement: [review, manual-owner-review]
effective_from: 2026-06-23
migration_impact: new-code-only
last_reviewed: 2026-06-23
```

Rule: Content written under `docs/standards/candidates/**`, standards-derived checklists, eval outputs or validation reports must pass secret, PII, local absolute path and prompt-injection hygiene checks before being committed.

Rationale: Candidate standards may be extracted from PRs, incidents, logs or interviews. They must not leak credentials, customer data, local machine paths or instructions that try to override higher-priority agent policy.

Exceptions: None for git-tracked source. Blocked content may be summarized in a report-only limitation until redacted.

Invalidation condition: Revisit if a deterministic sanitizer and quarantine lifecycle are introduced and documented.
