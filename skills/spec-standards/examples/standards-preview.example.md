# Standards Preview

## 1. Summary

Baseline run for a single-project repository. This preview proposes project standards candidates from deterministic project shape facts and bounded evidence.

## 2. Detected Project Mode

`single_project_repo`

## 3. Detected Project Shape

- Type: `node_cli_ai_workflow_framework`
- Domains: `cli`, `skill_workflow`, `artifact_contracts`, `glue`, `graph`

## 4. Imported Shared Standards

None provided in this run.

## 5. Artifact Plan

- Generated: `project-shape.json`, `standards-plan.json`, `glue-map.json`, `standards-candidates.json`, `standards-preview.md`
- Deferred: `repo-profile.patch.yaml`
- Synthesis contract: `standards-plan.json` defines candidate shape, allowed statuses, evidence budget, writeback policy, and downstream consumers.

## 6. Graph-Backed Findings

Graph evidence is available and can support candidate synthesis.

## 7. Glue Capability Map Summary

The project exposes graph readiness, workflow skill, CLI runtime sync, and machine-readable contract capabilities.

## 8. Observed Conventions

### CLI

CLI behavior is implemented under `src/cli/` and exposed through `bin/spec-first.js`.

### Skill Workflow

Workflow behavior lives in `skills/*/SKILL.md`; Claude command templates provide metadata only.

### Artifact Contracts

Machine-readable contract truth sources live under `src/cli/contracts/**`.

## 9. Conflicts

None detected.

## 10. Unknowns / Requires User Decision

- Whether imported shared standards should be added in a later run.

## 11. Suggested Actions

Review candidates, then explicitly confirm which standards should be promoted through a future `repo-profile.patch.yaml`.

## 12. Downstream Consumption

- `spec-plan`, `spec-write-tasks`, `spec-work`, and `spec-code-review` may consume confirmed standards as hard context.
- `observed`, `suggested`, `imported`, `conflict`, and `unknown` candidates remain advisory until confirmed or resolved.

## 13. Writeback Status

`.spec-first/specs/repo-profile.yaml` was not modified.
