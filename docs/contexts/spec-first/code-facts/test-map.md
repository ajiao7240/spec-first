# Test Map

## Test Files

- `tests/unit/crg-artifact-paths.test.js` (unit) -> src/crg/artifact-paths.js
  摘要：Unit coverage for artifact path helpers used by CRG commands.
- `tests/unit/crg-graph.test.js` (unit) -> src/crg/graph.js
  摘要：Unit coverage for graph persistence/query helpers.
- `tests/unit/crg-communities.test.js` (unit) -> src/crg/communities.js
  摘要：Unit coverage for community detection and related graph logic.
- `tests/unit/crg-input-convergence.test.js` (unit) -> src/crg/input-convergence.js
  摘要：Unit coverage for ignore rules and input file convergence.
- `tests/smoke/cli.sh` (smoke) -> src/cli/index.js, src/cli/commands/init.js, src/cli/commands/doctor.js
  摘要：Smoke coverage for CLI help, init, generated assets and doctor output.
- `tests/integration/e2e.sh` (integration) -> src/cli/index.js, src/cli/adapters/*
  摘要：End-to-end workflow coverage for install/bootstrap lifecycle.
- `tests/e2e/crg-all-commands.sh` (e2e) -> src/crg/cli/router.js, src/crg/commands/*
  摘要：E2E coverage for the CRG command surface.

## Coverage Gaps

- `src/cli/index.js`：CLI dispatch lacks a direct tests_for mapping in CRG and is mostly covered by smoke/integration scripts. [medium]
- `src/cli/commands/doctor.js`：Doctor command checks many environment branches but has no direct CRG tests_for evidence. [medium]
- `src/cli/commands/init.js`：Init has broad runtime side effects and is validated mainly through smoke/install scripts instead of direct unit mapping. [medium]
- `src/crg/changes.js`：Change detection logic participates in high-criticality review flows but no direct tests_for link was returned. [medium]
