# Initialization

V1 initialization is slice-first and proposal-only.

Start with explicit sources:

1. `AGENTS.md`, `CLAUDE.md`, README/contributing docs and architecture docs.
2. Lint, formatter, typecheck, schema, CI and test configuration.
3. Current review norms only when they have source refs.

Code, graphify/codegraph, tests, incident notes and `docs/solutions/**` can generate `observed` or `suggested` candidates only. Mark provider outputs as `provider_untrusted` until reconfirmed from source/test/doc/log evidence.

Each run needs one extraction target: repo, surface, optional sub-domain, capability, include/exclude scope and output mode. Mixed-surface or unrelated-capability input must be split.
