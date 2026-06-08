# Provider Readiness Contract

`provider-readiness.v2` describes mechanical provider readiness and setup-owned runtime tooling metadata. It is an advisory setup fact, not workflow truth and not confirmed context.

Canonical fields are defined by `docs/contracts/provider-readiness.schema.json`:

- `readiness_status`: `fresh` / `stale` / `degraded` / `not-run` / `unknown`.
- `lifecycle`: independent boolean lifecycle flags.
- `repo_aligned`, `capabilities`, `limitations`, `source_read_required`, `fallback`, `next_actions`.
- `native_interfaces`, `first_generation`, `steady_state`, `usage_note`: provider-native interface and lifecycle ownership facts used as the canonical machine surface for Runtime Setup consumers.

Do not write semantic trust fields such as `advisory`, `evidence_candidate`, or `confirmed_context` into this contract. Workflows may promote provider output only after direct source/test/log/contract/user evidence.

## Producer And Consumer Rules

- `readiness_status` is the only provider readiness field that enters setup decision health. Lifecycle fields are display/passthrough bits that explain where setup stopped; they do not by themselves decide workflow health.
- Provider self-reported `fresh` is not trusted as deterministic freshness. Producers must map it to `unknown` unless spec-first has direct source/test/log/probe evidence.
- Provider self-reported `stale` may map to `stale`: it is conservative, keeps the existing stale warning path alive, and still requires fallback/source confirmation.
- `repo_aligned` and `limitations` explain advisory context, but they are not the decision-path substitute for stale readiness.
- Setup-side `lifecycle.fallback_used` is not the same thing as a workflow using fallback. Consumption-side fallback is recorded with `provider_untrusted` or the workflow handoff, and ordinary plan/work/review/debug must remain able to proceed from direct evidence.
- `first_generation` and `steady_state` explain ownership boundaries: Runtime Setup may install/configure/perform explicit first generation and enable bounded project-local provider refresh setup such as Graphify `graphify hook install`, while provider-native tools own steady-state refresh/use. These fields do not authorize downstream workflows to run provider generation or infer confirmed evidence. When `steady_state.hook_default=false` is used for an optional provider, read it as “no silent/baseline hook install”; it does not forbid hook install after explicit `$spec-mcp-setup` confirmation.
