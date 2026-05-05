---
name: spec-standards
description: Compile graph-backed project standards and glue capability baseline artifacts from project facts, shared standards inputs, and observed code conventions. Use when onboarding a brownfield project, refreshing project-level standards, preparing reusable project baselines before planning/work/review, or importing team/shared engineering standards for project confirmation.
argument-hint: "[--baseline|--quick|--refresh|--deep] [--import-source <git-or-path>]"
---

# Project Standards And Glue Compiler

`spec-standards` is the Graph-backed Project Standards & Glue Compiler.

It turns implicit project conventions, team standards, graph evidence, and reuse capabilities into reviewable project baseline artifacts. It is not a rules engine, a generic best-practice generator, or an automatic `repo-profile.yaml` writer.

## Invocation Boundary

This is a public workflow orchestrator, not an agent type. Do not invoke it through Agent/Task/subagent primitives.

Use the current host's project-standards entrypoint when the user asks to compile, refresh, import, inspect, or establish project standards for downstream spec-first workflows.

## Purpose

Use this workflow to prepare a durable project baseline before or alongside `spec-brainstorm`, `spec-plan`, `spec-work`, and `spec-code-review`.

The workflow answers:

- What kind of project is this?
- Which standard domains actually apply?
- Which conventions are confirmed, imported, observed, suggested, conflicting, or unknown?
- Which existing capabilities should downstream work reuse instead of reimplementing?
- Which artifacts should downstream workflows read, and which should remain preview-only?
- Which candidate standards are hard constraints for downstream workflows, and which are only soft context?

## Non-Goals

Do not use this workflow to:

- Generate frontend/backend/API/database/mobile/admin standards by default.
- Treat observed code as confirmed team policy.
- Apply shared standards directly to a project without alignment and human confirmation.
- Write raw graph evidence, full shared standards documents, runtime state, or workflow progress into `repo-profile.yaml`.
- Replace `spec-graph-bootstrap`; graph providers remain upstream facts providers.
- Replace `spec-plan`, `spec-work`, or `spec-code-review`; those workflows consume the baseline and still make their own semantic decisions.

## Core Contract

1. **Scripts prepare facts; the LLM decides standards.** Deterministic scripts may detect project shape, artifact freshness, language hints, package managers, directory signals, and known capability entrypoints. The LLM owns semantic candidate synthesis, conflict explanation, and recommendations.
2. **Preview before writeback.** Long-lived standards must first appear in `standards-preview.md` and, when apply support exists, `repo-profile.patch.yaml`.
3. **Observed is not confirmed.** `observed`, `imported`, `suggested`, `conflict`, and `unknown` candidates must not be written to `repo-profile.yaml` as confirmed standards.
4. **Evidence before conclusion.** Every candidate needs a source type and bounded evidence path, query id, imported standards id, or explicit user input.
5. **Light contract.** Keep `repo-profile.yaml` small. Store bulky evidence, candidate lists, and glue maps under `.spec-first/standards/`.
6. **Explicit boundaries.** Shared standards repositories provide standard inputs; the target project owns project confirmation.
7. **Validate before trusted consumption.** Generated `standards-candidates.json` and `standards-preview.md` must pass artifact validation before downstream workflows treat them as a trusted standards baseline. The validator checks artifact contract only; it does not judge whether a candidate standard is semantically correct.

## Inputs

Primary inputs:

- Current user request and options.
- `AGENTS.md` / `CLAUDE.md` and directory-scoped standards files when present.
- `.spec-first/specs/repo-profile.yaml` when present.
- `.spec-first/graph/graph-facts.json`
- `.spec-first/graph/architecture-facts.json`
- `.spec-first/graph/reuse-candidates.json`
- `.spec-first/graph/bootstrap-impact-capabilities.json`
- `.spec-first/config/runtime-capabilities.json`
- `.spec-first/config/provider-artifacts.json`
- Package manifests, CI config, lint config, tests, docs, `skills/`, `agents/`, `templates/`, and CLI entrypoints.

Optional inputs:

- `--import-source <git-or-path>` for a shared standards repository or local standards directory.
- Existing `.spec-first/standards/*` artifacts for quick checks or refresh runs.

If graph artifacts are missing or stale, continue in degraded mode with direct repo facts and lower confidence. Do not fabricate graph-backed evidence.

## Supported Modes

### `--baseline`

Default mode. Prepare a first project baseline for `single_project_repo` and bounded simple repos.

Complete baseline output is split by ownership.

Script-generated deterministic artifacts:

- `.spec-first/standards/project-shape.json`
- `.spec-first/standards/standards-plan.json`
- `.spec-first/standards/glue-map.json`

LLM-generated review artifacts, created after reading the deterministic facts:

- `.spec-first/standards/standards-candidates.json`
- `.spec-first/standards/standards-preview.md`

Do not write `repo-profile.yaml`.

In parent workspaces, `--repo <child>` selects the child repo as the target repo root. Default artifacts are written under the child repo's `.spec-first/standards/`, and the parent workspace must not receive child-local standards artifacts.

### `--quick`

Read existing standards artifacts and deterministic freshness signals, then produce or update:

- `.spec-first/standards/standards-update-decision.json`

Use this for a cheap "is my standards baseline still usable?" check. Do not synthesize new standards candidates unless the decision recommends `complete-preview` and the user explicitly wants the missing review artifacts regenerated.

### `--refresh`

Refresh a bounded scope such as `--domain <name>`, `--module <path>`, or `--repo <child>`.

Generate deterministic facts plus:

- `.spec-first/standards/standards-update-decision.json`

Then refresh `standards-candidates.json` and `standards-preview.md` for the requested scope only. If no domain/module/repo selector is provided, treat the run as repo-level refresh and say so explicitly.

### `--deep`

Use larger domain budgets, a deterministic graph query plan, and optional multi-lens review when explicitly requested or required by large-project evidence.

Generate deterministic facts plus:

- `.spec-first/standards/graph-query-index.json`

Live graph/MCP query results are session-local evidence. Store only bounded summaries in candidates/preview, not raw query dumps.

### `--import-source <git-or-path>`

Import shared standards from a locked local source identity or a git source descriptor, then align them with current project facts.

Generate:

- `.spec-first/standards/standards-sources.json`
- `.spec-first/standards/import-lock.json`
- `.spec-first/standards/imported-standards.json`

Imported standards are marked `imported`, not `confirmed`, and require project alignment before they can influence `repo-profile.yaml`.

## Artifact Contract

Default artifact root:

```text
.spec-first/standards/
```

Baseline artifacts by owner:

```text
# Script-generated deterministic facts
.spec-first/standards/project-shape.json
.spec-first/standards/standards-plan.json
.spec-first/standards/glue-map.json

# LLM-generated review artifacts
.spec-first/standards/standards-candidates.json
.spec-first/standards/standards-preview.md
```

Mode-specific or optional artifacts:

```text
.spec-first/standards/standards-sources.json
.spec-first/standards/import-lock.json
.spec-first/standards/imported-standards.json
.spec-first/standards/graph-query-index.json
.spec-first/standards/repo-profile.patch.yaml
.spec-first/standards/standards-update-decision.json
.spec-first/standards/standards-drift.md
```

Runtime scratch paths must not be committed:

```text
.spec-first/standards/work/
.spec-first/standards/tmp/
.spec-first/standards/cache/
.spec-first/standards/raw/
.spec-first/standards/graph-query-raw/
```

## Status Vocabulary

Candidate statuses:

- `confirmed`: Already confirmed by the project/team or existing repo profile.
- `imported`: Imported from shared standards and awaiting project alignment/confirmation.
- `observed`: Supported by project code or graph evidence, but not confirmed as policy.
- `suggested`: LLM recommendation with weaker or indirect evidence.
- `conflict`: A shared/project standard conflicts with observed code or another standard.
- `unknown`: Evidence is insufficient.
- `deprecated`: Later-stage marker for retired standards.
- `drifted`: Later-stage marker for standards that no longer match project facts.

Only `confirmed` may be proposed for `repo-profile.yaml` writeback, and only through an explicit patch plus user confirmation.

`advisory` is not a candidate status. It is a downstream consumption mode for `observed`, `imported`, and `suggested` candidates.

## Workflow

### Phase 0: Scope And Safety

1. Identify the requested mode. Default to `--baseline`.
2. Identify target repo scope. In a parent workspace, require explicit `target_repo` / `--repo <child>` before writing child-local standards artifacts.
3. Check whether the target is already inside a public workflow or bounded subagent. Stay within the active scope.
4. Confirm the run will not hand-edit generated runtime mirrors under `.claude/`, `.codex/`, or `.agents/skills/`.

### Phase 1: Deterministic Fact Preparation

From the target repo root, run the deterministic script with the requested mode:

```bash
node skills/spec-standards/scripts/prepare-baseline.js --mode <baseline|quick|refresh|deep>
```

Use equivalent shorthand when clearer:

```bash
node skills/spec-standards/scripts/prepare-baseline.js --quick
node skills/spec-standards/scripts/prepare-baseline.js --refresh --domain <name>
node skills/spec-standards/scripts/prepare-baseline.js --deep
node skills/spec-standards/scripts/prepare-baseline.js --baseline --import-source <path>
```

The script writes deterministic facts and mode-support artifacts only:

- `project-shape.json`
- `standards-plan.json`, including the `synthesis_contract` that defines candidate fields, status vocabulary, evidence limits, writeback policy, and downstream consumers
- `glue-map.json`, including reusable capabilities and downstream consumption boundaries
- `standards-update-decision.json` for `--quick` / `--refresh`
- `graph-query-index.json` for `--deep`
- `standards-sources.json`, `import-lock.json`, and `imported-standards.json` for `--import-source`

If the script is unavailable, gather equivalent facts with bounded direct reads and mark script evidence as unavailable in the preview. Do not pretend the script ran.

For `--quick`, stop after reading `standards-update-decision.json` unless the user explicitly asks to regenerate missing preview artifacts. Report the recommendation and do not create new candidates by default.

### Phase 2: Evidence Review

Read the generated fact artifacts and the available upstream graph/readiness artifacts.

Treat `standards-plan.json` as the LLM handoff contract:

- `scope` tells whether the run is repo-local or a `workspace_child_repo` run.
- `artifacts.generate` lists durable artifacts expected by this mode.
- `synthesis_contract.candidate_required_fields` is the candidate JSON minimum shape.
- `synthesis_contract.allowed_statuses` and `allowed_source_types` define allowed vocabulary.
- `synthesis_contract.evidence_policy` sets evidence budgets and graph degradation boundaries.
- `synthesis_contract.writeback_policy` keeps `repo-profile.yaml` preview-first.
- `synthesis_contract.downstream_consumers` explains how later workflows may use confirmed vs soft candidates.

Classify evidence source types:

- `user_input`
- `repo_profile_confirmed`
- `shared_standard_imported`
- `graph_observed`
- `code_observed`
- `config_observed`
- `docs_observed`
- `llm_suggested`

When GitNexus or another graph MCP is available, use one or two targeted queries for the enabled domains only. In `--deep`, follow `graph-query-index.json` and keep query count within its budget. Treat live MCP results as session-local evidence and cite them as such; do not rewrite compiled graph readiness.

### Phase 3: Candidate Synthesis

Create `.spec-first/standards/standards-candidates.json`.

Use this top-level shape:

- `schema_version`: `spec-first.standards-candidates.v1`
- `generated_at`
- `scope`
- `source_artifacts[]`
- `candidates[]`
- `status_counts`
- `conflicts[]`
- `unknowns[]`
- `confirmation_policy`

For each candidate, include:

- stable `id`
- `domain`
- `type`
- `status`
- `confidence`
- `rule_candidate`
- `source_type`
- bounded `evidence[]`
- `suggested_action`
- `downstream_usage[]`

Status rules:

- `confirmed` candidates are hard constraints only when already confirmed by user input or repo profile evidence.
- `imported` candidates come from shared standards and are not project policy until aligned and confirmed.
- `observed` and `suggested` candidates are soft context for downstream workflows.
- `conflict` and `unknown` candidates must stay visible in preview and must not be hidden inside prose.

Do not overfit the candidate list. Prefer a small high-signal baseline over exhaustive standards.

### Phase 4: Preview Rendering

Create `.spec-first/standards/standards-preview.md` with:

1. Summary
2. Detected project mode
3. Detected project shape
4. Imported shared standards, or a clear "none provided" note
5. Artifact plan
6. Graph-backed or degraded evidence summary
7. Glue capability map summary
8. Observed conventions by enabled domain
9. Conflicts
10. Unknowns / requires user decision
11. Suggested actions
12. Downstream consumption summary
13. Explicit statement that `repo-profile.yaml` was not modified

### Phase 5: Artifact Validation

Validate the generated candidates and preview before reporting a trusted baseline:

```bash
node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json
```

Use explicit paths when the artifacts are outside the default directory:

```bash
node skills/spec-standards/scripts/validate-artifacts.js \
  --candidates .spec-first/standards/standards-candidates.json \
  --preview .spec-first/standards/standards-preview.md \
  --plan .spec-first/standards/standards-plan.json \
  --json
```

Exit code `0` means `status=pass` and `trust_level=trusted`. Exit code `4` means `status=pass` and `trust_level=degraded`, for example when fallback vocabulary was explicitly allowed; degraded pass proves the artifacts are structurally readable, not that they are a trusted standards baseline. Exit code `1` means validation fail, `2` means usage error, and `3` means internal error.

If `standards-plan.json` is missing, validation must fail unless the caller explicitly passes `--allow-fallback-vocabulary`. Do not use fallback vocabulary for trusted downstream consumption.

When confirmation evidence or patch safety input is stored outside `.spec-first/standards/`, pass `--confirmations <path>` or `--patch <path>` explicitly. These files are treated as non-LLM-authored attestation inputs; candidate ids inside `standards-candidates.json` must remain unique because downstream references and patch safety use ids as stable keys.

Artifact validation is the completion gate. If validator has not returned exit code `0`, do not report a trusted baseline or completed standards baseline; report the artifacts as generated with validation pending or failed, include the validator command, and surface the blocking `reason_code`.

Editor/IDE diagnostics, markdownlint notices, and cSpell notices are secondary to artifact validation and evidence fidelity. Fix contract-neutral formatting issues when useful, then rerun validator. Do not rewrite contract-bearing headings, tool names, paths, command names, candidate ids, or author names just to clear diagnostics. If a diagnostic conflicts with validator output or faithful evidence, preserve the artifact contract/evidence and report the diagnostic as allowlist/noise work instead of mutating the artifact.

### Phase 6: Optional Confirmation Handoff

If the user explicitly asks to apply confirmed standards, build `repo-profile.patch.yaml` first. Apply only confirmed items after explicit user confirmation.

All modes default to preview-only. Do not auto-apply.

## Shared Standards Import Boundary

Shared standards do not become project policy on import.

`--import-source` may be combined with any supported mode. In `--quick`, record source availability and lock metadata only; in `--baseline`, `--refresh`, or `--deep`, align imported items with current project facts during candidate synthesis. Imported standards still require project alignment and confirmation. Import support must:

1. Lock source identity and ref/commit when possible.
2. Preserve source path and content hash per imported item.
3. Align imported items with current project shape.
4. Mark imported items as `imported`, not `confirmed`.
5. Surface conflicts in preview.
6. Keep `imported-standards.json` marked as alignment-required and not eligible for repo-profile writeback by itself.

If a remote git source cannot be fetched in the current environment, record the source descriptor and reason code in `import-lock.json`, keep imported items empty, and list a local checkout or accessible path as the next action. Do not silently treat unavailable shared standards as confirmed project policy.

## Downstream Consumption

Downstream workflows should consume standards artifacts as context inputs:

- `spec-brainstorm`: use project shape and confirmed standards to avoid off-target requirements.
- `spec-plan`: use project shape, standards candidates, and glue map to choose implementation boundaries.
- `spec-write-tasks`: use artifact and glue constraints when deriving task handoff.
- `spec-work`: follow confirmed standards and reuse-first glue map; do not treat advisory candidates as hard rules.
- `spec-code-review`: use confirmed standards for project-standards findings and use advisory/risk/question candidates only as soft review context.
- `spec-compound-refresh`: propose candidate updates from repeated review/learning signals.

Confirmed standards are the only hard constraints.

Consumption modes:

- `confirmed` -> hard context.
- `observed`, `imported`, and `suggested` -> advisory context.
- `conflict` -> risk context that must stay visible until resolved.
- `unknown` -> question context that requires user or project evidence before hard use.
- `deprecated` and `drifted` -> risk context.
- validator fail, missing validator result, or `trust_level=degraded` -> degraded/advisory only.

`glue-map.json` supports reuse-first decisions. It is not a workflow state machine and must not override the active plan, task pack, work scope, or review judgment.

## Cost Controls

- Default mode must not run a deep scan.
- Always detect project shape before domain synthesis.
- Do not invoke a domain lens unless `standards-plan.json` enables it.
- Prefer graph artifacts and compressed summaries over raw source dumps.
- Limit evidence examples per candidate.
- Do not read every module or every standards document by default.
- Multi-agent dispatch requires `--deep` or a large-project trigger.
- Keep `repo-profile.yaml` small and human-maintainable.

## Final Response Contract

Report:

1. Mode, target repo, and whether the run was preview-only.
2. Artifact paths written, including child-repo relative paths when `--repo <child>` was used.
3. Evidence quality: graph-backed, degraded, imported-only, or direct-read only.
4. Candidate counts by status.
5. Conflicts and unknowns.
6. Whether `repo-profile.yaml` was modified. Default answer must be "not modified".
7. Validation commands run.
8. Recommended next action.
