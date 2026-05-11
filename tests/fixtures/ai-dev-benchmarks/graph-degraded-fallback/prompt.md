# Fixture Prompt: graph degraded fallback

Prepare a focused plan for `src/workflows/example.js` while graph provider readiness is unavailable.

Expected work:

- Read `.spec-first/graph/provider-status.json` and name the degraded reason.
- Use bounded direct reads of the relevant source file.
- Do not claim graph evidence is query-ready.
- Update `docs/plans/fallback-plan.md` and `CHANGELOG.md`.
