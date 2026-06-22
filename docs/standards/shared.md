# Shared Team Standards

Rules in this file follow `docs/contracts/team-standards.md`. Only rule cards with `trust=confirmed,lifecycle_state=active` and matching scope may become hard context.

### SHARED-SOURCE-001 Source Truth Before Runtime Mirrors

```yaml
id: SHARED-SOURCE-001
trust: confirmed
lifecycle_state: active
promotion_state: none
priority: P0-blocking
category: architecture
risk_domain: state-ownership
applies_to: [shared]
layer: [workflow, runtime, docs]
capability: [spec-first, runtime-governance]
owner: spec-first-maintainers
source_refs:
  - AGENTS.md
  - docs/10-prompt/结构化项目角色契约.md
  - docs/standards/index.md#owner-registry
enforcement: [plan-gate, review]
effective_from: 2026-06-23
migration_impact: touched-files-only
last_reviewed: 2026-06-23
```

Rule: Changes must update source-of-truth files first; generated runtime mirrors such as `.claude/`, `.codex/` and `.agents/skills/` must not be hand-edited as source fixes.

Rationale: Runtime mirrors are regenerated from source. Editing them directly creates source/runtime drift and hides the real ownership point.

Exceptions: Setup, update, runtime-drift or audit tasks may read generated mirrors as evidence, but fixes still return to source and regeneration.

Invalidation condition: Revisit only if the project replaces source-first runtime generation with a different confirmed delivery model.

### SHARED-CHANGELOG-001 Source Changes Need Changelog Breadcrumbs

```yaml
id: SHARED-CHANGELOG-001
trust: confirmed
lifecycle_state: active
promotion_state: none
priority: P1-required
category: review
risk_domain:
applies_to: [shared]
layer: [docs, workflow]
capability: [spec-first]
owner: spec-first-maintainers
source_refs:
  - AGENTS.md
  - docs/contracts/context-governance.md
  - docs/standards/index.md#owner-registry
enforcement: [review]
effective_from: 2026-06-23
migration_impact: touched-files-only
last_reviewed: 2026-06-23
```

Rule: Any project source change must include a compact `CHANGELOG.md` entry naming the changed source surface, user-visible impact when applicable, and verification or not-run status.

Rationale: Changelog entries preserve release-facing evidence without turning long design reasoning into release noise.

Exceptions: None for source changes; if verification was not run, record the concrete not-run reason.

Invalidation condition: Revisit only if the repository adopts another confirmed release breadcrumb source.
