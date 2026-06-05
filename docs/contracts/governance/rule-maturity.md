# rule-maturity.v1

`rule-maturity.v1` is a governance rule maturity record shape.

In v1.14 this contract is schema/docs-only. No `rule-maturity` internal helper is registered, no promotion state machine is implemented, and no automatic upgrade to `required-evidence` or `blocking` exists.

## Stages

- `shadow`: observed but not user-facing by default.
- `advisory`: user-facing guidance, still non-blocking.
- `required-evidence`: reserved for later maturity work.
- `blocking`: reserved for later maturity work and requires explicit human-approved evidence and rollback policy.

## Boundary

`shadow_hits` are discrete workflow observations with evidence refs. They are not daemon counters and are not proof that a rule should become blocking. v1.17 may define promotion logic; v1.14 only defines the record shape and the non-blocking boundary.
