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

Generate:

- `.spec-first/standards/project-shape.json`
- `.spec-first/standards/standards-plan.json`
- `.spec-first/standards/glue-map.json`
- `.spec-first/standards/standards-candidates.json`
- `.spec-first/standards/standards-preview.md`

Do not write `repo-profile.yaml`.

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

Baseline artifacts:

```text
.spec-first/standards/project-shape.json
.spec-first/standards/standards-plan.json
.spec-first/standards/glue-map.json
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
- `standards-plan.json`
- `glue-map.json`
- `standards-update-decision.json` for `--quick` / `--refresh`
- `graph-query-index.json` for `--deep`
- `standards-sources.json`, `import-lock.json`, and `imported-standards.json` for `--import-source`

If the script is unavailable, gather equivalent facts with bounded direct reads and mark script evidence as unavailable in the preview. Do not pretend the script ran.

For `--quick`, stop after reading `standards-update-decision.json` unless the user explicitly asks to regenerate missing preview artifacts. Report the recommendation and do not create new candidates by default.

### Phase 2: Evidence Review

Read the generated fact artifacts and the available upstream graph/readiness artifacts.

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
12. Explicit statement that `repo-profile.yaml` was not modified

### Phase 5: Optional Confirmation Handoff

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

If a remote git source cannot be fetched in the current environment, record the source descriptor and reason code in `import-lock.json`, keep imported items empty, and list a local checkout or accessible path as the next action. Do not silently treat unavailable shared standards as confirmed project policy.

## Downstream Consumption

Downstream workflows should consume standards artifacts as context inputs:

- `spec-brainstorm`: use project shape and confirmed standards to avoid off-target requirements.
- `spec-plan`: use project shape, standards candidates, and glue map to choose implementation boundaries.
- `spec-write-tasks`: use artifact and glue constraints when deriving task handoff.
- `spec-work`: follow confirmed standards and reuse-first glue map; do not treat observed candidates as hard rules.
- `spec-code-review`: use confirmed standards for project-standards findings and use observed/suggested candidates only as soft review context.
- `spec-compound-refresh`: propose candidate updates from repeated review/learning signals.

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
2. Artifact paths written.
3. Evidence quality: graph-backed, degraded, imported-only, or direct-read only.
4. Candidate counts by status.
5. Conflicts and unknowns.
6. Whether `repo-profile.yaml` was modified. Default answer must be "not modified".
7. Validation commands run.
8. Recommended next action.
