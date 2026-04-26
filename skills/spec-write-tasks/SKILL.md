---
name: spec-write-tasks
description: "Compile a settled spec-plan into a derived task pack for spec-work, or validate an existing task pack before execution. Use when the user asks to split a plan into tasks, write task docs, hand a plan to work through tasks, or when work should accept plan/task-pack input. Keep plan as the single source of truth; tasks are derived and optional."
argument-hint: "[plan doc path, task-pack path, or task-splitting request]"
---

# `spec-write-tasks`

`spec-write-tasks` is an optional derived layer between `spec-plan` and `spec-work`.

It does not execute code. It compresses a settled plan into a task pack that is easier for `spec-work` to consume, reducing context load and making dependencies, file boundaries, verification focus, and parallelization opportunities explicit.

## When To Use

- The user explicitly asks to split a plan into tasks.
- The plan is large enough that direct execution would force the executor to understand and split it at the same time.
- The plan has multiple implementation units, clear dependency chains, or clear file boundaries.
- A standalone task document would be useful as input to `spec-work`.
- The right next step is to decide whether task compilation is worthwhile, not to force task generation by default.

## When To Skip

- The change is small, touches few files, and has shallow dependencies.
- One or two tasks are enough to understand the work directly.
- Sending the plan straight to `spec-work` has lower carrying cost.

When skipping, say explicitly that this is not an omission; this case does not need another derived layer.

## Core Rules

1. `spec-plan` is always the single source of truth for the technical approach.
2. A task pack is a derived artifact; it must not become a second plan.
3. A task pack may only rearrange execution slices. It must not change scope, acceptance criteria, or non-goals.
4. A task pack that can be handed to `spec-work` must include verifiable `source_plan` and `source_plan_hash` metadata so stale tasks are not executed silently.
5. Each task should solve one clear subproblem and should usually have one primary verification target.
6. Task splitting should reflect file boundaries, dependencies, verification surfaces, and parallelization opportunities instead of restating the plan.

## Input Paths

First classify the input, then follow the matching path.

### 1. Plan Path

When the input is `docs/plans/*-plan.md` or another explicit plan file:

1. Read the plan, focusing on `Requirements Trace`, `Scope Boundaries`, `Technical Approach`, `Implementation Units`, `Files`, `Test Scenarios`, `Verification`, and `Deferred to Implementation`.
2. Decide whether a task pack will actually reduce execution risk or context load.
3. If task compilation is not worthwhile, explain why and recommend sending the plan directly to `spec-work`.
4. If task compilation is worthwhile, run the compilation flow below and write the task pack.

### 2. Existing Task-Pack Path

When the input is `docs/tasks/*-tasks.md` or a file whose frontmatter has `type: task-pack`:

1. Read the task pack frontmatter, `source_plan`, and source plan.
2. Validate `generated_by: spec-write-tasks`, `mode/status`, `source_plan`, `source_plan_hash`, required task-card fields, dependency references, and repo-relative `files`.
3. If deterministic hash tooling is unavailable, report the task pack as unverifiable handoff. Do not normalize and continue.
4. If `source_plan_hash` does not match the current source plan, stop. Do not normalize and continue; require rebuilding from the source plan.
5. If the task pack lacks a verifiable hash or is marked draft/non-executable, report it as not executable handoff. Do not recommend sending it directly to `spec-work`.
6. Only normalize formatting or missing field shape when doing so does not change scope, acceptance criteria, or task semantics.

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
- no unresolved product, architecture, or contract decision that would change scope.

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
3. Identify executable slices: decide whether each unit should remain one task, split into story tasks, or merge with a nearby unit.
4. Build the dependency graph: record only real output dependencies, not preferred ordering.
5. Assign waves: avoid shared files inside a wave; if files overlap, serialize or mark the overlap explicitly.
6. Write task cards: each task must state goal, files, context_refs, test_focus, done_signal, and stop_if.
7. Run the quality pass: check traceability, scope, granularity, dependency accuracy, verification, and consumption readiness.

### Quality Pass Before Output

Before outputting a task pack, verify:

- every task traces back to a source unit, requirement, or plan section,
- every requirement is covered by at least one task unless it is a non-goal, already satisfied, or deferred,
- no task adds scope not declared in the plan,
- no task turns deferred work or non-goals into goals,
- no task is so large that it needs internal task splitting,
- no task is so small that it cannot be verified independently,
- dependencies represent real dependencies rather than ordering preference,
- same-wave tasks have no unmarked file overlap,
- every task has a concrete `test_focus` and observable `done_signal`,
- every task has a specific `stop_if` that can prevent scope creep.

See [Task Quality Guide](references/task-quality-guide.md) for detailed quality guidance.

## Task Splitting Principles

- Identify foundation tasks first: test fixtures, schemas, contracts, CLI surfaces, shared helpers.
- Then identify user-verifiable story slices or plan implementation units.
- Add integration, docs, release-surface, or polish tasks last.
- Merge continuous changes in the same module.
- Merge related changes on the same test surface.
- Merge implementation and verification when they form a small closed loop.
- Split when the file set is clearly too large.
- Prefer splitting when there are independent verification points.
- Prefer splitting when tasks can run in parallel, but do not invent hidden dependencies.
- If a task cannot describe its completion signal in one sentence, it is usually too large.

Do not mechanically convert each implementation unit into one task. A unit may contain multiple independently verifiable user stories; multiple units may also share one foundation task.

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
- Task Cards
- Validation Notes
- Regeneration Rules

When writing a task pack, read [Task Pack Schema](references/task-pack-schema.md) and use its frontmatter, task-card fields, and regeneration rules.

## Required Task Card Semantics

Every task card must express:

- `task_id`: stable identifier.
- `source_unit`: matching plan U-ID; use `null` when no U-ID exists and point `context_refs` to the source section.
- `requirement_refs`: related requirements or acceptance refs.
- `goal`: one-sentence task goal.
- `dependencies`: prerequisite task IDs.
- `files`: repo-relative paths the task is allowed to touch.
- `context_refs`: plan sections, code patterns, contracts, research, or references the executor must read.
- `entry_hint`: where to start reading; not a step-by-step implementation script.
- `test_focus`: primary verification focus.
- `done_signal`: observable completion signal.
- `parallelizable`: whether the task can run in parallel.
- `risk_note`: main risk.
- `stop_if`: condition that should send execution back to `spec-plan` or user confirmation.
- `wave`: execution wave.

## Drift And Hash

`source_plan_hash` should be a task-relevant hash, not a whole-file hash.

Include these plan sections in the hash input:

- `Requirements Trace`
- `Scope Boundaries`
- `Technical Approach`
- `Implementation Units`
- `Files`
- `Test Scenarios`
- `Verification`
- `Deferred to Implementation`

Exclude:

- plan frontmatter `status`,
- pure formatting changes,
- review menus,
- completed-state timestamps.

A task pack that can be handed to `spec-work` must use a concrete task-relevant `sha256` hash, for example `sha256:<64-hex>`.

If the current environment has no deterministic hash capability, do not pretend validation happened. Only produce a draft/non-executable task pack or explain that hash tooling is required first. Do not use `pending-tooling`, `unknown`, empty values, or guessed whole-file hashes as executable handoff.

## Handoff To `spec-work`

- If the task pack matches the current plan hash, `spec-work` should prefer the task pack.
- If the plan is small or the task pack has low value, `spec-work` can consume the plan directly.
- If the task pack lacks a verifiable hash, has a hash mismatch, or conflicts with the plan, reject handoff and rebuild from the plan.

When consuming a task pack, `spec-work` must still read relevant code, discover tests, and identify execution-time facts. A task pack is a better input, not a replacement for execution judgment.

## Scope Backoff

Every generated task must include `stop_if`. Common stop signals:

- the task requires modifying core files not declared by the task pack,
- the task requires a new public API, CLI command, config key, database table, or durable state file not declared by the plan,
- the task requires a new term, durable abstraction, or external contract,
- the task's `done_signal` cannot be proven by the available tests or verification path,
- execution reveals a conflict between the source plan's scope boundary and the real code.

When a stop signal triggers, return to `spec-plan` or rerun `spec-write-tasks`. Do not expand scope in place.

## Lint Boundary

A script may run deterministic lint for:

- complete frontmatter,
- `source_plan` exists,
- `source_plan_hash` format,
- unique `task_id`,
- dependencies refer to existing tasks,
- files use repo-relative paths,
- same-wave file overlap is marked or serialized.

Do not let scripts judge whether task splitting is semantically good. Splitting, merging, waves, and boundaries are LLM semantic decisions.

## Do Not

- Do not write a task pack as a second plan.
- Do not write a task pack as a progress database.
- Do not turn a task pack into an approval gate or execution state machine.
- Do not include shell command choreography, commit order, or test pipeline scripts.
- Do not invent scope, acceptance criteria, or product decisions.

## References

- [Task Pack Schema](references/task-pack-schema.md)
- [Task Quality Guide](references/task-quality-guide.md)
- [Technical Plan](../../docs/03-实施方案/2026-04-26-spec-write-tasks-技术方案.md)
- [spec-plan](../spec-plan/SKILL.md)
- [spec-work](../spec-work/SKILL.md)
- [Project Role](../../docs/10-prompt/项目角色.md)
