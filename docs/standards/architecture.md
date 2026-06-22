# Architecture Standards

Architecture standards are high-impact by default when `category=architecture` or `risk_domain` is present. They require a valid owner and cannot be promoted from code inference alone.

### ARCH-RUNTIME-001 Runtime Assets Are Delivery Outputs

```yaml
id: ARCH-RUNTIME-001
trust: confirmed
lifecycle_state: active
promotion_state: none
priority: P0-blocking
category: architecture
risk_domain: state-ownership
applies_to: [shared]
layer: [runtime, workflow]
capability: [runtime-governance]
owner: spec-first-maintainers
source_refs:
  - docs/10-prompt/结构化项目角色契约.md
  - AGENTS.md
  - docs/standards/index.md#owner-registry
enforcement: [plan-gate, review]
effective_from: 2026-06-23
migration_impact: touched-files-only
last_reviewed: 2026-06-23
```

Rule: `.claude/`, `.codex/`, `.agents/skills/` and `.spec-first/**` runtime/control-plane outputs are not architecture source truth; architecture changes must land in `skills/`, `agents/`, `templates/`, `src/cli/`, `docs/contracts/**`, `AGENTS.md`, `CLAUDE.md` or other checked-in source paths.

Rationale: Architecture claims must be reviewable in durable source and reproducible through deterministic generation or validation.

Exceptions: Runtime/setup/audit workflows may inspect runtime assets to diagnose drift or readiness; they must not patch runtime mirrors as the canonical fix.

Invalidation condition: Revisit if runtime generation is removed and generated mirrors become confirmed checked-in source.

## Suggested Templates

The following examples are intentionally not confirmed for this repo. Copy them into `docs/standards/candidates/**` as `suggested` or `observed` when a real business project has source refs and owner review:

- `ARCH-STATE-001`: backend owns final business state; clients render/cache but do not decide final state.
- `ARCH-DEPENDENCY-001`: dependency direction flows from UI/adapters toward application/domain contracts.
- `CROSS-ERROR-001`: cross-surface API, app, H5, admin and job/event flows share one documented error taxonomy and fallback contract for the same business capability.
- `DESIGN-NOTE-001`: API contracts, state ownership, permission model, event semantics or cross-surface behavior changes require a design note or ADR-like record before implementation.
