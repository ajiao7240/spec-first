# Provider Readiness Contract

`provider-readiness.v1` describes mechanical provider readiness only. It is an advisory setup fact, not workflow truth and not confirmed context.

Canonical fields are defined by `docs/contracts/provider-readiness.schema.json`:

- `readiness_status`: `fresh` / `stale` / `degraded` / `not-run` / `unknown`.
- `lifecycle`: independent boolean lifecycle flags.
- `repo_aligned`, `capabilities`, `limitations`, `source_read_required`, `fallback`, `next_actions`.

Do not write semantic trust fields such as `advisory`, `evidence_candidate`, or `confirmed_context` into this contract. Workflows may promote provider output only after direct source/test/log/contract/user evidence.
