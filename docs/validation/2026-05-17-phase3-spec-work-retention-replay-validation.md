# Phase 3 spec-work retention/replay validation

Date: 2026-05-17
Branch: leo-2026-05-16-update
Scope: spec-first optimization upgrade Phase 3 closeout for `spec-work` run evidence replay/retention consumer.

## Completed

- Added `spec-work-run-artifact read` and `spec-work-run-artifact prune` as minimal deterministic consumers.
- Extended the run artifact schema with retention owner/expiry metadata.
- Kept `producer_available` and `workflow_integrated` boundaries intact.
- Updated `spec-work` and `spec-work-beta` prose to describe the new minimal consumer without turning the artifact into a full retention policy source.
- Added targeted tests for write, read, and prune behavior.

## Verification

- `npm run test:jest -- tests/unit/spec-work-run-artifact-contract.test.js tests/unit/spec-work-run-artifact-producer.test.js tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand`
- `npm run test:jest -- tests/unit/runtime-capability-catalog.test.js tests/unit/runtime-contract-boundary.test.js --runInBand`
- `npm run typecheck`
- `npm run lint:skill-entrypoints`
- `git diff --check`

## Fresh-source eval

Status: passed

Source paths:
- `skills/spec-work/SKILL.md`
- `skills/spec-work-beta/SKILL.md`
- `src/cli/helpers/spec-work-run-artifact.js`
- `docs/contracts/workflows/spec-work-run-artifact.schema.json`

Checks:
- trigger_precision: passed
- source_runtime_boundary: passed
- host_entrypoints: passed
- internal_only_boundary: passed
- deterministic_vs_semantic_boundary: passed
- tests: passed

## Notes

- `workflow_integrated` remains false; the workflow still needs an explicit closeout call path before that boundary can flip.
- Retention/prune is now minimally consumable, but still deterministic and source-owned; it is not a general workflow state store.
