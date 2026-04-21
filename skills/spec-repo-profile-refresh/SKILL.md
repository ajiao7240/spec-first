---
name: spec-repo-profile-refresh
description: "Refresh `.spec-first/specs/repo-profile.yaml` from repo facts. Use when repo-level seeds exist but need better semantic defaults for project intent, principles, non-negotiables, and review defaults."
argument-hint: "[preview|apply]"
---

# Repo Profile Refresh

Refresh `.spec-first/specs/repo-profile.yaml` from current repo facts.

This is a standalone skill, not a `/spec:*` workflow command.

## When To Use

Use this skill when:

- `.spec-first/specs/repo-profile.yaml` already exists, but still contains sparse or seed-level defaults
- you want better repo-level semantic scaffolding before later `spec-plan` consumption
- you want an explicit, reviewable suggestion pass instead of hiding LLM write-back inside `init`, `spec-plan`, `spec-work`, or `spec-review`

Do not use this skill to manage runtime state, workflow state, gate state, or task-specific requirements.

## Upstream Context Posture

`spec-graph-bootstrap` is recommended upstream context, not a hard prerequisite.

- if `docs/contexts/<slug>/` exists, consume it as stronger fact input
- if Stage-0 outputs do not exist, fall back to `README`, repo manifests, and the current seed
- do not block execution just because `spec-graph-bootstrap` has not run yet

## Core Contract

1. Target file is only `.spec-first/specs/repo-profile.yaml`
2. Default mode is `preview`
3. `apply` is allowed only after preview or explicit user confirmation
4. First version only updates repo-level normative scaffold fields
5. This skill does not auto-trigger from `init`, `spec-plan`, `spec-work`, or `spec-review`

## Input Priority

Read inputs in this order, using stronger facts before weaker narrative sources:

1. `.spec-first/specs/repo-profile.yaml`
2. `README.md` or `README.zh-CN.md`
3. repo manifests such as `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`
4. `docs/contexts/<slug>/00-summary.md`
5. `docs/contexts/<slug>/code-facts/public-entrypoints.md`
6. `docs/contexts/<slug>/code-facts/test-map.md`

If a file is missing, skip it and continue. Missing optional inputs do not block the skill.

## Field Policy

### Default allowed fields

Only propose updates for:

- `project_intent.summary`
- `principles`
- `non_negotiables`
- `review_defaults`

These fields are the repo-level semantic layer that deterministic seed generation cannot reliably infer.

### Default protected fields

Do not proactively rewrite these fields unless the user explicitly asks and the evidence is strong:

- `repo_id`
- `languages`
- `project_type`

### Hard boundaries

Never write any of the following into `repo-profile.yaml`:

- runtime state
- workflow state
- gate state
- verifier dispatch
- task-specific requirements
- temporary implementation notes

Keep the YAML structure stable. Do not rewrite the file into a new schema.

## Evidence Discipline

For every proposed change:

1. explain what changed
2. explain why the change is justified
3. cite the strongest supporting input source
4. preserve the current value when evidence is weak or ambiguous

If evidence is insufficient, leave the field empty or keep the existing value. Do not invent certainty.

## Modes

### `preview` (default)

- read current `repo-profile.yaml`
- inspect repo facts
- produce a suggested patch or field-by-field replacement
- explain the rationale for each suggested field
- do not write files

### `apply`

Only use `apply` when the user explicitly asks for it or confirms after seeing the preview.

When applying:

- only update the allowed fields
- preserve all other fields as-is
- keep user-authored content outside the allowed field set untouched
- prefer minimal diffs over full-file rewrites

## Suggested Output Shape

When running in `preview`, structure the response as:

1. current profile gaps
2. proposed field updates
3. rationale and evidence per field
4. explicit note that no file was written

When running in `apply`, structure the response as:

1. fields changed
2. fields intentionally left untouched
3. evidence summary
4. explicit note that `.spec-first/specs/repo-profile.yaml` was updated

## Relationship To Other Flows

- `init` creates deterministic shared seeds only
- `spec-graph-bootstrap` is the preferred upstream fact source when available, but this skill must still work without it
- `spec-plan` may consume `.spec-first/specs/repo-profile.yaml` as optional repo-level planning input
- `spec-work` does not own repo-profile maintenance
- `spec-review` may point out gaps, but does not become the repo truth maintainer
- `spec-graph-bootstrap` produces facts, not normative scaffold write-back

## Non-Goals

- automatic write-back during `init`
- hidden mutation inside planning or review
- multi-file profile systems
- dual-write sync between `docs/contexts/` and `.spec-first/specs/repo-profile.yaml`
- new `.spec-first/workflows/<...>/` scratch state for this skill

## Examples

- `spec-repo-profile-refresh`
- `spec-repo-profile-refresh preview`
- `spec-repo-profile-refresh apply`
