---
name: spec-write-tasks
description: "Compile a settled spec-plan into an optional derived task pack for spec-work, or validate an existing task pack before execution. Use for explicit plan-splitting/task-doc requests or high-complexity work suitability; do not use for implementation execution, unresolved scope, small low-risk plans, or remote/generic task lists. Keep plan as the single source of truth; tasks are derived and optional."
---

# `spec-write-tasks`

`spec-write-tasks` is an optional derived layer between `spec-plan` and `spec-work`.

It does not execute code; it compresses a settled plan into a task pack for `spec-work`, making dependencies, file boundaries, verification focus, and parallelization explicit.

## Workflow Contract Summary

### When To Use

Use when a settled source plan is too large or dependent for direct execution, when the user explicitly asks to split a plan into tasks, or when an existing task pack needs validation before `spec-work`.

### When Not To Use

Do not use for unresolved product or architecture scope, small changes that do not need a derived layer, remote repositories or package names, or implementation prompts that should go directly to `spec-work`.

### Inputs

A local source plan path, existing task-pack path, or task-splitting request; focused source-plan sections; repo scope facts; nearby files/tests only when needed to make execution slices accurate.

### Outputs

Either an executable derived task pack, a validated existing task-pack handoff, a skip decision, a return-to-plan handoff, or a draft-only non-executable task outline.

### Artifacts

Derived task packs under `docs/tasks/` when compilation is worthwhile. Task packs are derived execution indexes and never replace the source plan.

### Failure Modes

Missing or stale source plan hash, missing `spec_id`, wrong-chain task pack, ambiguous target repo, unverifiable hash tooling, or scope questions that belong back in `spec-plan`.

### Workflow

Classify input, verify source-plan identity and repo scope, decide compile/skip/return/draft, use bounded source orientation, write task cards and validation metadata, then return a final decision envelope.

### Downstream Consumers

`spec-work`, human reviewers checking execution readiness, and later code-review/compound workflows that consume the completed work summary.

## Purpose

Use this skill to decide whether task compilation is worthwhile, compile a task pack from a settled source plan when it is, or validate an existing task pack before execution. It preserves `spec-plan` as the single source of truth and keeps task packs as optional derived handoff artifacts.

## When To Use

- The user explicitly asks to split a plan into tasks.
- The plan is large enough that direct execution would force the executor to understand and split it at the same time.
- The plan has multiple implementation units, clear dependency chains, or clear file boundaries.
- A standalone task document would be useful as input to `spec-work`.
- A work suitability check has already found strong signals that task compilation would materially reduce execution risk or context load.
- The right next step is to decide whether task compilation is worthwhile, not to force task generation by default.

## When Not To Use

- The change is small, touches few files, and has shallow dependencies.
- One or two tasks are enough to understand the work directly.
- Sending the plan straight to `spec-work` has lower carrying cost.
- The user is still choosing product scope, architecture, acceptance criteria, or non-goals; return to `spec-plan` instead.
- The user wants implementation execution, not task-pack compilation or validation; use `spec-work`.
- The input is a remote repository, package name, marketplace skill, or generic task-listing request unrelated to a settled source plan.

When skipping, say explicitly that this is not an omission; this case does not need another derived layer.

## Core Rules

1. `spec-plan` is always the single source of truth for the technical approach.
2. A task pack is a derived artifact; it must not become a second plan.
3. A task pack may only rearrange execution slices. It must not change scope, acceptance criteria, or non-goals.
4. A task pack that can be handed to `spec-work` must include `spec_id`, verifiable `source_plan`, and `source_plan_hash` metadata so wrong-chain or stale tasks are not executed silently.
5. `spec-write-tasks` does not introduce its own lifecycle hook. Context references and review intent may appear only as `context_refs`, `entry_hint`, `test_focus`, `review_gate`, `review_focus`, or orientation evidence; `spec-work` later executes from the source plan or task-pack handoff using direct repo reads.
6. `context_refs` must point to the smallest useful section, file, test, contract, or pattern reference. They are bounded reading pointers, not scope authority; whole-plan or whole-directory refs are low-quality handoff unless paired with narrower anchors.
7. Each task should solve one clear subproblem and should usually have one primary verification target.
8. Task splitting should reflect file boundaries, dependencies, verification surfaces, and parallelization opportunities instead of restating the plan.
9. Source reads before task-pack generation must be bounded source orientation: start from the source plan, plan-indicated files, nearby tests, and only the host/project instructions or local contracts allowed by the active instruction reuse policy. Use [Task Quality Guide](references/task-quality-guide.md) for the detailed intake and evidence rules.
10. If the source plan was created from a parent workspace, it must carry a top-level `target_repo` for single-repo work or per-unit `target_repo` for cross-repo work. If repo scope is missing, return to `spec-plan`; do not invent child repo targets while deriving tasks.
11. Prefer independently verifiable vertical slices over horizontal layers when the source plan permits it. A good slice closes one behavior with implementation, verification, and any necessary docs/config evidence. Docs-only and config-only tasks should use docs contract checks, schema/help/render checks, or diff-shape checks; do not force TDD where no behavior-bearing code changes.

## Inputs

This skill accepts exactly one local work input:

- a source plan path such as `docs/plans/*-plan.md`,
- an existing task-pack path such as `docs/tasks/*-tasks.md`,
- or a bare task-splitting request that clearly identifies, or can uniquely infer, a local source plan.

It does not accept remote repositories, package names, marketplace identifiers, or implementation prompts that should go directly to `spec-work`.

## Workflow

1. Classify the input as a source plan, existing task pack, or bare task-splitting request.
2. Resolve the local source plan and stop if plan identity, repo scope, or uniqueness is missing.
3. For plan inputs, run the task-ready check and choose exactly one branch: `compile`, `skip`, `return-to-plan`, or `draft-only`.
4. For existing task packs, validate identity, freshness, structure, source-plan linkage, and workspace repo scope before treating the pack as executable.
5. Use bounded source orientation only when it improves task boundaries without changing plan scope.
6. When compiling, write task cards, waves, traceability, validation notes, and regeneration rules from source-plan anchors.
7. End every run with the final decision envelope so downstream `spec-work` can decide whether handoff is executable.

## Input Paths

First classify the input, then follow the matching path.

### 1. Plan Path

When the input is `docs/plans/*-plan.md` or another explicit plan file:

1. Read the plan, focusing on `Requirements` (or legacy `Requirements Trace`), `Scope Boundaries`, `Technical Approach`, `Implementation Units`, `Files`, `Test Scenarios`, `Verification`, and `Deferred to Implementation`.
2. Read the plan frontmatter. Executable task packs require a source plan `spec_id`. If the source plan is a legacy plan without `spec_id`, do not write an executable task pack; return to `spec-plan` to add plan frontmatter, or produce only a draft/transient task pack that is explicitly not valid `spec-work` input.
3. Decide whether a task pack will actually reduce execution risk or context load.
4. If task compilation is not worthwhile, explain why and recommend sending the plan directly to `spec-work`.
5. If task compilation is worthwhile, run the compilation flow below and write the task pack, copying `spec_id` from the source plan.

### Bounded Source Orientation

Before writing task cards, inspect code only until task boundaries are accurate enough. Use [Task Quality Guide](references/task-quality-guide.md) for the intake order, Direct Evidence handling, LSP provider rule, and orientation-evidence quality checks.

Orientation evidence is advisory. It must not turn current implementation state into new tasks, replace source-plan authority, or override the source plan. If orientation reveals missing scope, contract, acceptance, or verification decisions, return `return-to-plan` or `draft-only` instead of inventing task scope.

### 2. Existing Task-Pack Path

When the input is `docs/tasks/*-tasks.md` or a file whose frontmatter has `type: task-pack`:

1. Read the task pack frontmatter, `source_plan`, and source plan.
2. Validate `generated_by: spec-write-tasks`, `mode/status`, `spec_id`, `source_plan`, `source_plan_hash`, required task-card fields, dependency references, and repo-relative `files`.
2a. In workspace contexts, inspect `target_repo` inheritance or per-task `target_repo` values before treating the task pack as executable; current deterministic validation does not prove workspace repo scope, so missing or ambiguous repo scope is a semantic handoff failure.
3. If deterministic hash tooling is unavailable, report the task pack as unverifiable handoff. Do not normalize and continue.
4. If `source_plan_hash` does not match the current source plan, stop. Do not normalize and continue; require rebuilding from the source plan.
5. If the task pack lacks `spec_id`, report it as missing identity and not executable handoff. Do not normalize and continue.
6. If source plan and task pack both have `spec_id`, they must match. A mismatch is a wrong-chain handoff; stop and require rebuilding from the source plan.
7. If the source plan lacks `spec_id`, report identity as unverifiable weak trace. Stop for executable handoff; return to `spec-plan` to add plan frontmatter or rebuild a draft/transient task pack.
8. If the task pack lacks a verifiable hash or is marked draft/non-executable, report it as not executable handoff. Do not recommend sending it directly to `spec-work`.
9. Only normalize formatting or missing field shape when doing so does not change scope, acceptance criteria, or task semantics.

### 3. Bare Task-Splitting Request

When the input is a natural-language request such as "split this plan into tasks":

- If the request includes a clear plan path, use the Plan Path flow.
- If no path is provided, prefer the most recent `docs/plans/*-plan.md` and state that inference.
- If there is no unique plan, do not guess task scope. Ask for the plan path.

## Compilation Flow

### Task-Ready Check

Before generating a task pack, decide whether the source plan is task-ready.

It must have:

- clear scope boundaries,
- traceable requirements, acceptance refs, or equivalent source anchors,
- implementation units, story slices, or file boundaries clear enough to compile,
- actionable verification / test scenarios,
- a source plan `spec_id` when generating an executable task pack,
- no unresolved product, architecture, or contract decision that would change scope.

Use the source plan's own structure as the primary complexity evidence for the split recommendation. [Task Quality Guide](references/task-quality-guide.md) owns the detailed split-recommendation, degraded helper-signal handling, and `task-governance-signals.v1` cross-check rules.

Choose exactly one branch:

- `compile`: the plan is clear enough; generate an executable task pack.
- `skip`: the plan is small or task-pack value is low; recommend direct `spec-work`.
- `return-to-plan`: key scope, verification, architecture, or contract decisions are missing; recommend revising `spec-plan`.
- `draft-only`: a non-executable draft can help discussion, but it must not be handed to `spec-work`.

Only continue with unresolved information when it is explicitly an implementation-time unknown. Record that risk in the relevant task's `risk_note` and `stop_if`. Do not use a task pack to invent decisions the plan did not make.

### Compilation Algorithm

This is an LLM semantic analysis order, not a script state machine. It does not require each step to be persisted and it does not create workflow state.

1. Extract source anchors: list requirements, scope boundaries, implementation units, files, verification, and deferred unknowns.
2. Identify foundations: find shared schemas, contracts, adapters, fixtures, test helpers, and CLI surfaces.
3. Identify executable slices: decide whether each unit should remain one task, split into vertical story tasks, split into multiple feedback-loop tasks, or merge with a nearby unit. A single source implementation unit may produce more than one task when it contains distinct module-foundation, orchestration/integration, output/reporting, docs, or verification clusters; repeat the same `source_unit` on those tasks and narrow them with `requirement_refs`, `goal`, `files`, and `test_focus`. Avoid horizontal "all tests first, then all implementation" waves when independent vertical tracer bullets can be verified.
4. Build the dependency graph: record only real output dependencies, not preferred ordering.
5. Assign waves: avoid shared files inside a wave; executable task packs must serialize overlapping files into different waves because deterministic validation rejects same-wave file overlap.
6. Write task cards: each task must state goal, files, granular `context_refs`, test_focus, done_signal, and stop_if.
7. Run the quality pass: check traceability, scope, granularity, dependency accuracy, verification, and consumption readiness.

### Quality Pass Before Output

Before outputting a task pack, verify:

- every task traces back to a source unit, requirement, or plan section,
- every requirement is covered by at least one task unless it is a non-goal, already satisfied, or deferred,
- no task adds scope not declared in the plan,
- no task turns deferred work or non-goals into goals,
- no task is so large that it needs internal task splitting,
- no task keeps a large source implementation unit intact when it actually contains multiple independent feedback loops with separate validation surfaces,
- no task is so small that it cannot be verified independently,
- dependencies represent real dependencies rather than ordering preference,
- same-wave tasks have no unmarked file overlap,
- every task has granular `context_refs`, a concrete `test_focus`, and observable `done_signal`,
- every task has a specific `stop_if` that can prevent scope creep.

See [Task Quality Guide](references/task-quality-guide.md) for detailed quality guidance.

## Task Splitting Principles

Prefer closed user-verifiable story slices or plan implementation units, and create foundation tasks only when the source plan already requires shared artifacts. Do not mechanically convert each implementation unit into one task: large source units can fan out into multiple executable tasks when the feedback loops are independent. Use [Task Quality Guide](references/task-quality-guide.md) for split, merge, vertical slice, and verification-point heuristics.

## Outputs

This skill can produce:

- an executable task pack under `docs/tasks/YYYY-MM-DD-NNN-<type>-<slug>-tasks.md`,
- a draft or transient non-executable task pack when identity or hash requirements cannot be satisfied,
- a validation result for an existing task pack,
- a `skip`, `return-to-plan`, or `draft-only` decision without writing an executable handoff,
- and a compact final decision envelope in the assistant response.

Only an executable task pack with matching `spec_id`, verifiable `source_plan_hash`, valid machine-readable `Task Pack Contract`, and acceptable semantic review may be handed to `spec-work` as task-pack input.

## Output Requirements

Executable task packs must be written to:

`docs/tasks/YYYY-MM-DD-NNN-<type>-<slug>-tasks.md`

Only produce a non-executable draft when the user explicitly asks for temporary slicing or when the environment cannot produce a verifiable hash. In that case, mark the result as draft/non-executable and do not recommend handing it directly to `spec-work`.

The body must include:

- Overview
- Source Summary
- Traceability Matrix
- Task Graph
- Execution Waves
- Task Pack Contract
- Task Cards
- Orientation Evidence
- Validation Notes
- Regeneration Rules

The deterministic validator only proves frontmatter identity/freshness plus the `Task Pack Contract` machine-readable structure. The other body sections are LLM/human handoff quality requirements and must not be described as CLI-validated unless a future validator explicitly checks them.

When writing a task pack, read [Task Pack Schema](references/task-pack-schema.md) and use its frontmatter, task-card fields, and regeneration rules. When filling the final decision envelope, validating hash identity, or returning a high-risk review handoff, read [Execution Handoff Contract](references/execution-handoff-contract.md).

## Final Decision Envelope

Every `spec-write-tasks` run must end with the compact decision envelope defined in [Execution Handoff Contract](references/execution-handoff-contract.md). The envelope is a handoff summary for this run, not persisted workflow state.

Required posture:

- use one of `compile`, `skip`, `return-to-plan`, `draft-only`, or `validate-only`,
- include a machine-readable `reason_code`; use a Failure Modes code whenever the run stops, downgrades, or rejects a handoff,
- run `spec-first tasks validate <task-pack-path> --json` before reporting `deterministic_handoff` or `validation` fields,
- run `spec-first tasks hash <plan-path>` when computing or comparing `source_plan_hash`,
- never self-report `deterministic_handoff: true` without CLI JSON evidence,
- allow `next_action: spec-work-task-pack` only when the task pack is deterministic and semantically reviewed or generated this run.

High-risk packs should return `next_action: review-task-pack` with one concrete reason and a copy-ready current-host doc-review invocation. Do not auto-dispatch document review unless the explicit bounded continuation conditions in [Execution Handoff Contract](references/execution-handoff-contract.md) are met.

## Task Card Semantics

Executable task cards use the deterministic and quality-field split defined in [Execution Handoff Contract](references/execution-handoff-contract.md) and the field tables in [Task Pack Schema](references/task-pack-schema.md).

Key reminders:

- deterministic fields include `task_id`, `dependencies`, concrete `files`, `goal`, `test_focus`, `done_signal`, `wave`, `stop_if`, and at least one source anchor through `source_unit` or `requirement_refs`,
- quality fields such as `context_refs`, `entry_hint`, `parallelizable`, `expected_side_effects`, `risk_note`, `review_gate`, `review_focus`, `handoff_owner`, and `target_repo` reduce execution context but do not replace source-plan scope,
- `review_gate` is review intent, not lifecycle state, approval state, or validator-owned semantic risk,
- the deterministic validator checks `review_gate` structure only and does not decide which tasks semantically require review.

## Drift And Hash

Use the hash rules in [Execution Handoff Contract](references/execution-handoff-contract.md).

`spec_id` links the source plan and task pack to the same spec chain. `source_plan_hash` proves the task pack is still derived from the current source plan body. If the source plan has no `spec_id`, do not generate an executable task pack; return to `spec-plan` or produce only a draft/transient output that is not valid `spec-work` input.

## Handoff To `spec-work`

Use [Execution Handoff Contract](references/execution-handoff-contract.md). `spec-work` may consume a valid task pack, may consume small plans directly, and must reject missing-hash, stale, wrong-chain, unverifiable, or conflicting packs before implementation. A task pack improves input quality; it never replaces source reads, test discovery, or execution judgment.

## Failure Modes

- `source_plan_missing`: no local source plan can be resolved. Ask for the plan path or return to `spec-plan`.
- `ambiguous_plan`: multiple recent plans could match a bare request. Ask for the plan path instead of guessing.
- `missing_spec_id`: the source plan or task pack lacks executable identity. Return to `spec-plan` for frontmatter or produce only a draft.
- `wrong_chain`: source plan and task pack `spec_id` values mismatch. Reject the handoff and rebuild from the source plan.
- `stale_hash`: `source_plan_hash` does not match the current source plan body. Reject the handoff and rerun task compilation.
- `unverifiable_hash`: deterministic hash or validation tooling is unavailable. Do not mark the handoff executable.
- `invalid_contract`: the `Task Pack Contract` machine-readable structure is missing or rejected. Do not repair it in `spec-work`; rerun `spec-write-tasks`.
- `repo_scope_missing`: parent-workspace target repo information is missing or ambiguous. Return to `spec-plan` or regenerate the task pack with repo scope.
- `scope_gap`: source orientation reveals missing scope, architecture, contract, or verification decisions. Return `return-to-plan` or `draft-only` instead of inventing scope.

## Scope Backoff

Every generated task must include `stop_if`. Stop when execution needs undeclared core files, public APIs, config/state, new durable terms or contracts, unverifiable `done_signal`, or a conflict between real code and source-plan boundaries. Return to `spec-plan` or rerun `spec-write-tasks`; do not expand scope in place.

## Lint Boundary

A script may lint frontmatter, `source_plan`, hash format, contract JSON, task ids, dependencies, concrete repo-relative files, and same-wave file overlap. Do not let scripts judge whether task splitting is semantically good. Splitting, merging, waves, and boundaries are LLM semantic decisions.

## Do Not

- Do not write a task pack as a second plan.
- Do not write a task pack as a progress database.
- Do not turn a task pack into an approval gate or execution state machine.
- Do not include shell command choreography, commit order, or test pipeline scripts.
- Do not invent scope, acceptance criteria, or product decisions.

## Portability Boundary

`spec-write-tasks` is a reusable user-facing skill. Runtime references must be packaged skill files (`references/`, `agents/`) or optional sibling workflow skills that are distributed with the same spec-first installation. Standalone `.skill` packages must remain usable when those sibling workflow files are absent; treat `spec-plan`, `spec-work`, and `spec-doc-review` as named integration points, not as required files to read from this package. `evals/` files are maintainer-only validation fixtures; the official `.skill` packager excludes root `evals/`, so do not require user-runtime access to them while compiling tasks. Repo-local technical plans, project-role documents, historical snapshots, and project review docs are maintainer design evidence, not user-runtime references; do not list them in this skill's `References` or require users to read them while compiling tasks.

## References

- [Execution Handoff Contract](references/execution-handoff-contract.md)
- [Task Pack Schema](references/task-pack-schema.md)
- [Task Quality Guide](references/task-quality-guide.md)
