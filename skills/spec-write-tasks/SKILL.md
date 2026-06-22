---
name: spec-write-tasks
description: "Compile a settled spec-plan into an optional derived task pack for spec-work, or validate an existing task pack before execution. Use when the user asks to split a plan into tasks, write task docs, or when a work suitability check concludes a task pack would materially reduce execution risk or context load. Keep plan as the single source of truth; tasks are derived and optional."
---

# `spec-write-tasks`

`spec-write-tasks` is an optional derived layer between `spec-plan` and `spec-work`.

It does not execute code. It compresses a settled plan into a task pack that is easier for `spec-work` to consume, reducing context load and making dependencies, file boundaries, verification focus, and parallelization opportunities explicit.

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
9. Source reads before task-pack generation must be bounded source orientation: start from the source plan, plan-indicated source files, and nearby tests; reuse already-loaded host/project instructions; read `AGENTS.md` / `CLAUDE.md` source only when the active host/project instruction reuse policy allows it, such as a user-named path, missing or stale loaded context, source/runtime governance work, or directory-scoped instructions that may govern changed files; read local contract docs only by precise path or section when they exist and materially improve task boundaries; optionally use LSP when available; and stop once task boundaries are accurate enough. Written project standards may become hard task constraints only when they apply to the changed files and remain consistent with the source plan. Other docs, prior plans, and external-tool facts are advisory context refs and must not become a workflow state machine or expand source-plan scope.
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

Before writing task cards, you may inspect code only until task boundaries are accurate enough.

Use this intake order for context economy: first read the plan/task summary and contract metadata, then deterministic inventory or validation facts, then current task/phase refs, then focused source-of-truth sections, and only then deeper references. Keep orientation facts compact by summarizing direct source reads, changed files, tests/logs, and limitations; do not create an external-tool facts pipeline.

Provider order:

1. Start with targeted direct repo reads of the plan-indicated files, nearby tests, directory indexes, and local patterns.
2. If direct reads are insufficient and LSP is available, use it only for bounded source orientation: symbol overview, symbol lookup, references, and local pattern search.

Orientation evidence is advisory. It must not turn the current implementation state into new tasks, replace source-plan authority, or override the source plan. If source orientation reveals missing scope, contract, acceptance, or verification decisions, return `return-to-plan` or `draft-only` instead of inventing task scope.

If the source plan contains a `## Direct Evidence` block, consume `key_findings`, `impact_on_plan`, `source_reads_required`, and limitations as advisory task-focus inputs. `impact_on_plan` may influence task ordering, `source_reads_required` may become granular `context_refs`, `stop_if`, or `test_focus`, and `key_findings` may become risk notes. These facts must not create new tasks, expand source-plan scope, replace requirement refs, or choose a repo; every task pointer still needs source-plan and direct-source confirmation.

LSP provider rule:

- Activate the target project and use LSP quick indexing only for bounded source orientation: symbol overview, symbol lookup, references, and local pattern search.
- Record the provider and limitations in orientation evidence.
- Do not let LSP references automatically expand task scope or replace source-plan authority.

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

Use the source plan's own structure as the primary complexity evidence for the split recommendation. At task-compilation time the plan already exists, so implementation-unit count, declared `Files`, dependency chains, cross-module surfaces, verification spread, and frontmatter `plan_depth` when present are higher-fidelity inputs than a fresh helper guess. Recommend `compile` when those plan facts show material execution risk or context load, such as many units, deep dependencies, broad file ownership, multi-layer verification, or `plan_depth: deep`. Recommend `skip` when the plan is small and shallow, and state that direct `spec-work` is intentional rather than an omission.

`task-governance-signals.v1` may be used only as optional cross-check evidence, not as the task-time source of truth. In `--source plan-declared` mode it is designed for pre-plan Phase 0.6, does not consume written Implementation Units, and only sees non-empty planning facts when the caller builds and passes an `--input <planning-context.json>` file. If `--input` is omitted or unreadable, the helper can fall back to empty signals and still emit a `lightweight` candidate with `collection_status=ok`; do not treat that as proof of low risk. When helper evidence is absent, stale, degraded, or weaker than the written plan structure, fall back to direct plan evidence and let the LLM record the final reason.

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
3. Identify executable slices: decide whether each unit should remain one task, split into vertical story tasks, or merge with a nearby unit. Avoid horizontal "all tests first, then all implementation" waves when independent vertical tracer bullets can be verified.
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
- no task is so small that it cannot be verified independently,
- dependencies represent real dependencies rather than ordering preference,
- same-wave tasks have no unmarked file overlap,
- every task has granular `context_refs`, a concrete `test_focus`, and observable `done_signal`,
- every task has a specific `stop_if` that can prevent scope creep.

See [Task Quality Guide](references/task-quality-guide.md) for detailed quality guidance.

## Task Splitting Principles

- Create foundation tasks only when the source plan already requires shared fixtures, schemas, contracts, CLI surfaces, or helpers that multiple later tasks truly depend on.
- Otherwise prefer closed user-verifiable story slices or plan implementation units.
- Add integration, docs, release-surface, or polish tasks last.
- Merge continuous changes in the same module.
- Merge related changes on the same test surface.
- Merge implementation and verification when they form a small closed loop.
- Split when the file set is clearly too large.
- Prefer splitting when there are independent verification points.
- Prefer splitting when tasks can run in parallel, but do not invent hidden dependencies.
- If a task cannot describe its completion signal in one sentence, it is usually too large.

Do not mechanically convert each implementation unit into one task. A unit may contain multiple independently verifiable user stories; multiple units may also share one foundation task.

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

When writing a task pack, read [Task Pack Schema](references/task-pack-schema.md) and use its frontmatter, task-card fields, and regeneration rules.

## Final Decision Envelope

Every `spec-write-tasks` run must end with a compact decision envelope. The envelope is a handoff summary for this run, not persisted workflow state:

```yaml
decision: compile | skip | return-to-plan | draft-only | validate-only
reason_code: source_plan_missing | ambiguous_plan | missing_spec_id | wrong_chain | stale_hash | unverifiable_hash | invalid_contract | repo_scope_missing | scope_gap | small_plan | task_pack_compiled | task_pack_validated | not_applicable
source_plan: docs/plans/... | null
task_pack: docs/tasks/... | null
task_pack_validity: valid | draft | stale | wrong-chain | invalid | unverifiable | not-applicable
deterministic_handoff: true | false
validity_scope: identity-freshness-structure-only
semantic_posture: generated-this-run | reviewed-existing | unchecked-existing | not-applicable
reason: <one sentence>
dispatch_authorization: authorized | missing | not_required | not_applicable
validation:
  spec_id: matched | missing | mismatch | not_checked
  source_plan_hash: matched | missing | mismatch | unavailable | not_checked
  hash_tool: available | unavailable
  source_plan_path: resolved | missing | invalid
  task_pack_contract: valid | invalid | not_checked
orientation:
  provider: direct-repo-reads | lsp | mixed | skipped
  posture: bounded | degraded | skipped-small-plan | unavailable
  evidence_refs: []
  limitations: []
next_action: spec-work-task-pack | review-task-pack | spec-work-plan | revise-plan | stop
```

Use a `Failure Modes` code as `reason_code` whenever the run stops, downgrades, or rejects a handoff. Use `small_plan`, `task_pack_compiled`, `task_pack_validated`, or `not_applicable` only when no failure mode applies. The natural-language `reason` explains the code; it must not be the only machine-readable failure signal.

Before filling `deterministic_handoff` and the `validation:` block, you must actually run the deterministic CLI and transcribe its result, not assert it from inspection. Run `spec-first tasks validate <task-pack-path> --json` (and `spec-first tasks hash <plan-path>` when computing or comparing the source plan hash), then copy `deterministic_handoff` and each `validation` field from that JSON output. If the `tasks` subcommand is not runtime-visible or returns an unknown-subcommand error, treat the run as `unverifiable_hash`, set `deterministic_handoff: false`, and downgrade to `draft-only`; never self-report `deterministic_handoff: true` or `validation` matches without the CLI JSON in hand.

`next_action: spec-work-task-pack` is allowed only when `deterministic_handoff: true` and `semantic_posture` is `generated-this-run` or `reviewed-existing`. `deterministic_handoff` proves identity, freshness, and structure only; it does not prove semantic task quality.

Use `next_action: review-task-pack` as the decisive handoff recommendation for high-risk task packs. Choose it when the pack contains `review_gate: required` tasks, touches shared contracts, public workflow prose, source/runtime boundaries, security/release/CI surfaces, or has enough tasks/dependencies that semantic drift or over-splitting would be costly. The output must include one concrete reason and a copy-ready current-host document-review invocation, such as `/spec:doc-review <task-pack-path>` for Claude or `$spec-doc-review <task-pack-path>` for Codex.

For a high-risk pack that resolves to `review-task-pack`, do not dispatch by default. Continue directly into the current host's document review without a separate confirmation step only under all of these conditions:

- the pack is executable (`deterministic_handoff: true`) and `review-task-pack` was selected by the high-risk criteria above,
- the invoking parent workflow or user explicitly authorized this single bounded continuation for the current run; a standalone skill trigger alone is not dispatch authorization,
- the current session is an interactive host that exposes the document-review entrypoint (`/spec:doc-review` on Claude, `$spec-doc-review` on Codex),
- the continuation targets exactly the doc-review of the just-written task pack; do not chain any further workflow, and do not invoke document review as an Agent/Task/subagent type.

When continuing, invoke the current-host doc-review in headless mode on the task-pack path (`/spec:doc-review mode:headless <task-pack-path>` on Claude, `$spec-doc-review mode:headless <task-pack-path>` on Codex), then report the doc-review outcome alongside this envelope. Headless keeps the continuation bounded and non-interactive: doc-review applies its own safe fixes silently and returns structured findings without firing its interactive routing or walk-through prompts inside this run.

This is bounded auto-continuation, not general workflow chaining: it covers only the single write-tasks → doc-review edge for high-risk packs, and `spec-write-tasks` still does not become an orchestrator or execution state machine. Set `dispatch_authorization: authorized` only when the explicit authorization condition is met. When any condition is not met — the pack is low-risk, `deterministic_handoff` is false, dispatch authorization is missing, no doc-review entrypoint is available, or the run is autonomous/headless — do not dispatch. Set `dispatch_authorization: missing`, `not_required`, or `not_applicable` as appropriate, surface the `review-task-pack` recommendation in the returned envelope, and let the caller decide.

## Required Task Card Semantics

Executable task cards have two layers:

1. Deterministic contract fields validated by `spec-first tasks validate`: `task_id`, `dependencies`, non-empty concrete `files`, `goal`, `test_focus`, `done_signal`, `wave`, `stop_if`, plus at least one source anchor through `source_unit` or `requirement_refs`.
2. LLM/human quality fields that should be present when they reduce execution context or make delegation staging safe: `context_refs`, `entry_hint`, `parallelizable`, `expected_side_effects`, `risk_note`, `notes`, `review_gate`, `review_focus`, `handoff_owner`, and workspace-scoped `target_repo` when applicable.

Every executable task card must express:

- `task_id`: stable identifier.
- `source_unit`: matching plan U-ID when available.
- `requirement_refs`: related requirements or acceptance refs; required when `source_unit` is absent.
- `goal`: one-sentence task goal.
- `dependencies`: prerequisite task IDs.
- `files`: non-empty concrete repo-relative POSIX file paths the task is allowed to touch.
- `test_focus`: primary verification focus.
- `done_signal`: observable completion signal.
- `stop_if`: condition that should send execution back to `spec-plan` or user confirmation.
- `wave`: execution wave.

Add these quality fields when useful, but do not imply the CLI validator proves their semantic adequacy:

- `context_refs`: specific plan sections, source files, tests, contracts, pattern docs, or research notes the executor must read. Prefer section/file/test/contract granularity. A whole-plan ref is low quality unless it is paired with narrower anchors, and a whole-directory ref is acceptable only when the source plan explicitly makes that directory the bounded surface.
- `entry_hint`: where to start reading; not a step-by-step implementation script.
- `parallelizable`: whether the task can run in parallel.
- `expected_side_effects`: optional repo-relative exact paths or bounded globs that may be touched in addition to `files`, such as lockfiles, generated fixtures, or formatter-adjacent files. Do not use `**` whole-repo globs. This is an explicit staging allowlist, not extra product scope.
- `risk_note`: main risk.
- `review_gate`: optional review intent metadata. Use `required` only for high-risk shared contracts, public workflow prose, validator/schema changes, source/runtime boundary changes, security/release/CI surfaces, or tasks that unblock multiple dependent tasks. Use `optional` for medium-risk behavior changes where review can usually merge into final shipping review. Omit it for docs-only, config-only, trivial copy edits, and low-risk single-file fixes. This is not lifecycle state, review status, or approval metadata.
- `review_focus`: concrete review concern for a mini review or final shipping review. It must not replace `test_focus`, `done_signal`, or `stop_if`.
- `target_repo`: selected child repo in parent-workspace contexts.

The deterministic validator checks `review_gate` structure only (`optional` or `required`) and does not decide which tasks semantically require review. That decision belongs to LLM/human task compilation and downstream `spec-work` judgment.

## Drift And Hash

`source_plan_hash` must be the canonical source plan body hash produced by `spec-first tasks hash <plan-path>`.

`spec_id` is copied from the source plan and is not part of freshness. It links the task pack to the same spec chain; `source_plan_hash` proves the task pack is still derived from the current source plan body.

If the source plan has no `spec_id`, do not generate an executable task pack. Return to `spec-plan` to add the plan-local identity, or produce only a `draft` / `transient` output that is not valid `spec-work` input.

Hash rules:

- Read the source plan as UTF-8 text.
- Normalize `CRLF` / `CR` to `LF`.
- If the first line is `---`, remove the complete frontmatter block; if closing frontmatter is missing, fail closed.
- Hash the remaining Markdown body exactly as canonicalized; do not extract sections or collapse whitespace in MVP.
- Frontmatter fields such as `status` and `spec_id` are not part of freshness; identity is checked separately.

A task pack that can be handed to `spec-work` must use a concrete canonical source plan body hash, for example `sha256:<64-hex>`.

If the current environment has no deterministic hash capability, do not pretend validation happened. Only produce a draft/non-executable task pack or explain that hash tooling is required first. Do not use `pending-tooling`, `unknown`, empty values, or guessed whole-file hashes as executable handoff.

## Handoff To `spec-work`

- If the task pack matches the current plan hash, `spec-work` should prefer the task pack.
- If the plan is small or the task pack has low value, `spec-work` can consume the plan directly.
- If the task pack lacks a verifiable hash, has a hash mismatch, has a `spec_id` mismatch, or conflicts with the plan, reject handoff and rebuild from the plan.

When consuming a task pack, `spec-work` must still read relevant code, discover tests, and identify execution-time facts. A task pack is a better input, not a replacement for execution judgment.

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
- `Task Pack Contract` fenced JSON block exists and parses,
- unique `task_id`,
- dependencies refer to existing tasks,
- files use concrete repo-relative paths,
- same-wave file overlap is absent or serialized.

Do not let scripts judge whether task splitting is semantically good. Splitting, merging, waves, and boundaries are LLM semantic decisions.

## Do Not

- Do not write a task pack as a second plan.
- Do not write a task pack as a progress database.
- Do not turn a task pack into an approval gate or execution state machine.
- Do not include shell command choreography, commit order, or test pipeline scripts.
- Do not invent scope, acceptance criteria, or product decisions.

## Portability Boundary

`spec-write-tasks` is a reusable user-facing skill. Runtime references must be packaged skill files (`references/`, `agents/`) or optional sibling workflow skills that are distributed with the same spec-first installation. Standalone `.skill` packages must remain usable when those sibling workflow files are absent; treat `spec-plan`, `spec-work`, and `spec-doc-review` as named integration points, not as required files to read from this package. `evals/` files are maintainer-only validation fixtures; the official `.skill` packager excludes root `evals/`, so do not require user-runtime access to them while compiling tasks. Repo-local technical plans, project-role documents, historical snapshots, and project review docs are maintainer design evidence, not user-runtime references; do not list them in this skill's `References` or require users to read them while compiling tasks.

## References

- [Task Pack Schema](references/task-pack-schema.md)
- [Task Quality Guide](references/task-quality-guide.md)
