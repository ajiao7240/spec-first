# Lifecycle

`trust`, `lifecycle_state` and `promotion_state` are separate.

- `confirmed` means a rule can be hard context only when active and scope-matched.
- `observed`, `suggested`, `imported` and `conflict` are advisory or blocked.
- `confirmed-draft` is reviewable proposal state, not enforcement.
- `deprecated` is retained for migration context.
- `archived` is retained for traceability and normally removed from the active index.

Deprecation requires invalidation evidence, replacement or migration note, owner status and decision trace. Do not silently delete old rules.
