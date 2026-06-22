# Adaptive Expansion

Adaptive expansion can create candidates, conflict records, audit reports and promotion proposals. It cannot change confirmed truth by itself.

Allowed outputs:

- filtered rule refs
- `suggested` candidate
- `observed` candidate
- `conflict` record
- audit report
- confirmed-draft or confirmed patch proposal when authority tier allows

Confirmed-draft remains non-enforceable until a source-edit workflow merges it as `trust=confirmed,lifecycle_state=active`.
