# Standards Preview

## 1. Summary

Baseline run for a single-project repository. This preview proposes project standards candidates from deterministic project shape facts, bounded evidence, and optional shared standards imports.

## 2. Detected Project Mode

`single_project_repo`

## 3. Detected Project Shape

- Type: `node_cli_ai_workflow_framework`
- Domains: `workflow`, `artifact_contracts`, `glue`, `graph`

## 4. Artifact Plan

- Generated: `project-shape.json`, `standards-plan.json`, `glue-map.json`, `standards-candidates.json`, `standards-preview.md`
- Deferred: `repo-profile.patch.yaml`
- Synthesis contract: `standards-plan.json` defines candidate shape, allowed statuses, evidence budget, writeback policy, and downstream consumers.

## 5. Evidence Quality

Evidence is bounded to source paths, graph summaries, imported documents, or explicit user input. Raw graph query dumps are not committed as standards evidence.

## 6. Glue Capability Map Summary

The project exposes graph readiness, workflow skill, CLI runtime sync, and machine-readable contract capabilities. `glue-map.json` supports reuse-first decisions only; it is not a workflow state machine.

## 7. Candidates By Status

- confirmed: 1
- observed: 1
- imported: 1
- conflict: 1
- unknown: 1

## 8. Conflicts

Conflicts: 1

- `standards.conflict.runtime-mirror`

## 9. Unknowns / Requires User Decision

Unknowns: 1

- `standards.unknown.owner`

## 10. Suggested Actions

Review candidates, resolve conflict and unknown entries, then explicitly confirm which standards should be promoted through a future `repo-profile.patch.yaml`.

## 11. Downstream Consumption

- `confirmed` candidates are hard context.
- `observed`, `imported`, and `suggested` candidates are advisory context.
- `conflict` candidates are risk context.
- `unknown` candidates are question context.
- validator fail, missing validator result, or `trust_level=degraded` means degraded/advisory only.

## 12. Writeback Status

`repo-profile.yaml` was not modified. `.spec-first/specs/repo-profile.yaml` was not modified.
