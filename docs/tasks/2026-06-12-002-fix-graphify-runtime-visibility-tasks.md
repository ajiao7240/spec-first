---
title: "Graphify runtime visibility fix task pack"
type: "task-pack"
status: "derived"
date: "2026-06-12"
spec_id: "2026-06-12-002-graphify-runtime-visibility"
source_plan: "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md"
source_plan_hash: "sha256:35d782dad52ca0492cc9b0def839410ef3c582808f3ace992bddc8d676c44967"
generated_by: "spec-write-tasks"
mode: "derived"
target_repo: "spec-first"
source_sections:
  - "Requirements"
  - "Scope Boundaries"
  - "Completion Criteria"
  - "Direct Evidence"
  - "Key Technical Decisions"
  - "Implementation Units"
---

# Task Pack: Graphify Runtime Visibility Fix

## Overview

This task pack compiles the source plan into five serial execution slices. The split keeps `graphify-out/graph.json` as advisory context and focuses implementation on durable runtime visibility: a cross-platform CLI resolver, setup invocation through the resolved command, host-aligned readiness facts, preservation of provider-owned runtime, user-facing guidance, and regression coverage.

The pack is intentionally serial because the same Bash, PowerShell, Node renderer, contract, and fixture files are touched by multiple units. Serial waves avoid unsafe same-wave file overlap and keep each task's done signal observable before the next layer depends on it.

## Source Summary

- **Source plan:** `docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md`
- **Task-ready branch:** `compile`. The plan has `plan_depth: deep`, six implementation units, concrete file surfaces, host/runtime ownership boundaries, and multi-platform verification requirements.
- **Consumed sections:** Requirements, Scope Boundaries, Completion Criteria, Direct Evidence, Key Technical Decisions, Implementation Units, Risks & Dependencies, Documentation / Operational Notes.
- **Scope boundaries shaping split:** Generated runtime mirrors are not task-owned files; Graphify stays optional and provider-owned; setup must not mutate user shell profiles; `provider_readiness[]` remains advisory; source/runtime repairs must happen through source and `spec-first init`, not by hand-editing `.codex/`, `.claude/`, or `.agents/skills/`.
- **Implementation-time unknowns:** Whether `provider-readiness.v2` needs machine-readable resolver fields; exact malformed `.codex/hooks.json` merge behavior; whether README changes are required beyond setup guidance.

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U1 + U2 | R1, R2, R3, R8, R9 | T001 | Bash, PowerShell, and Node resolver/setup invocation fixtures |
| U3 | R1, R4, R6, R9 | T002 | Provider readiness and doctor host-facts tests |
| U4 | R4, R5, R6, R9, R10 | T003 | Runtime preservation and init/doctor regression tests |
| U5 | R1, R5, R7, R9, R10 | T004 | Instruction/source docs checks and setup preview assertions |
| U6 | R1-R10 | T005 | Multi-platform regression matrix, task-specific fixture completion, changelog, and focused test suite |

## Task Graph

- **T001** establishes the shared resolver and removes setup's bare-command assumptions. Everything else depends on this mechanical command-resolution layer.
- **T002** tightens readiness and doctor semantics using the resolver output and durable host runtime facts from T001.
- **T003** protects provider-owned runtime during `spec-first init` and relies on T002's configured/degraded semantics.
- **T004** updates user-facing guidance only after the runtime behavior and preservation contract are clear.
- **T005** completes the cross-platform regression matrix and release-surface bookkeeping after the behavior and docs have stabilized.

## Execution Waves

- **Wave 1:** T001
- **Wave 2:** T002
- **Wave 3:** T003
- **Wave 4:** T004
- **Wave 5:** T005

## Task Pack Contract

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    {
      "wave": 1,
      "tasks": ["T001"]
    },
    {
      "wave": 2,
      "tasks": ["T002"]
    },
    {
      "wave": 3,
      "tasks": ["T003"]
    },
    {
      "wave": 4,
      "tasks": ["T004"]
    },
    {
      "wave": 5,
      "tasks": ["T005"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1+U2",
      "requirement_refs": ["R1", "R2", "R3", "R8", "R9"],
      "goal": "Add the cross-platform Graphify CLI resolver and route setup-time Graphify project install, first generation, query probe, hook install, and hook status through the resolved command instead of bare graphify.",
      "dependencies": [],
      "files": [
        "skills/spec-mcp-setup/scripts/install-helpers.sh",
        "skills/spec-mcp-setup/scripts/install-helpers.ps1",
        "skills/spec-mcp-setup/scripts/provider-readiness-renderer.cjs",
        "skills/spec-mcp-setup/SKILL.md",
        "skills/spec-mcp-setup/provider-tools.json",
        "tests/unit/dependency-readiness-baseline.test.js",
        "tests/unit/mcp-setup.sh",
        "tests/unit/mcp-setup-powershell-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md#U1-Add-a-Cross-Platform-Graphify-CLI-Resolver",
        "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md#U2-Use-Resolved-Graphify-Commands-Through-Setup",
        "skills/spec-mcp-setup/scripts/provider-readiness-renderer.cjs#resolveCommand",
        "skills/spec-mcp-setup/scripts/install-helpers.sh#install_graphify_cli",
        "skills/spec-mcp-setup/scripts/install-helpers.ps1"
      ],
      "entry_hint": "Start with existing Graphify candidate path handling in provider-readiness-renderer.cjs, then mirror the resolver semantics into Bash and PowerShell helpers before replacing setup-time bare graphify invocations.",
      "test_focus": "Off-PATH provider-standard Graphify can be invoked by setup through an absolute command while readiness still reports the manual PATH visibility action.",
      "done_signal": "Focused Bash, PowerShell, and Node fixtures cover on-PATH, provider-standard off-PATH, missing, and version-mismatch Graphify resolution, and setup Graphify operations no longer depend on parent shell PATH mutation.",
      "parallelizable": false,
      "risk_note": "A resolver-only patch that still leaves install, extract, query, or hook operations using bare graphify will reproduce the current failure.",
      "review_gate": "required",
      "review_focus": "Check shell quoting, paths with spaces, provider-standard candidate parity, no shell-profile mutation, and no upgrade of Graphify output from advisory to confirmed truth.",
      "stop_if": "The fix requires editing user shell profiles, creating global symlinks, adding a new provider state machine, or changing Graphify from optional provider to required dependency.",
      "wave": 1
    },
    {
      "task_id": "T002",
      "source_unit": "U3",
      "requirement_refs": ["R1", "R4", "R6", "R9"],
      "goal": "Tighten provider readiness and doctor semantics so configured status and decision input come from durable current-host runtime facts rather than process-local success or wrong-host setup facts.",
      "dependencies": ["T001"],
      "files": [
        "skills/spec-mcp-setup/scripts/provider-readiness-renderer.cjs",
        "skills/spec-mcp-setup/scripts/write-setup-facts.sh",
        "skills/spec-mcp-setup/scripts/write-setup-facts.ps1",
        "src/cli/helpers/setup-facts.js",
        "src/cli/commands/doctor.js",
        "docs/contracts/provider-readiness.md",
        "docs/contracts/provider-readiness.schema.json",
        "tests/unit/dependency-readiness-baseline.test.js",
        "tests/unit/mcp-setup.sh",
        "tests/unit/mcp-setup-powershell-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md#U3-Tighten-Provider-Readiness-And-Doctor-Semantics",
        "docs/contracts/provider-readiness.md",
        "src/cli/helpers/setup-facts.js",
        "src/cli/commands/doctor.js"
      ],
      "entry_hint": "Compare lifecycle.configured derivation with projectSkillConfigured and setup-facts host mismatch handling before changing any schema fields.",
      "test_focus": "Env-only configured flags and Claude-scoped facts cannot make Codex Graphify look configured; repair guidance points to a host-specific setup refresh.",
      "done_signal": "Provider readiness reports configured=false when the current-host Graphify runtime is absent, host mismatch remains decision_input_health=missing, and refreshed current-host facts are accepted without weakening provider advisory semantics.",
      "parallelizable": false,
      "risk_note": "If configured remains tied to SPEC_FIRST_PROVIDER_GRAPHIFY_CONFIGURED, verify-only and doctor can still report a setup success after runtime files disappear.",
      "review_gate": "required",
      "review_focus": "Check host alignment, env-flag downgrade semantics, provider-readiness schema compatibility, and user-visible repair wording.",
      "stop_if": "Implementation needs a new durable provider manifest or schema bump not justified by the source plan's existing provider_readiness first approach.",
      "wave": 2
    },
    {
      "task_id": "T003",
      "source_unit": "U4",
      "requirement_refs": ["R4", "R5", "R6", "R9", "R10"],
      "goal": "Preserve or truthfully degrade provider-owned Graphify runtime surfaces across spec-first init, especially Codex hooks and Graphify project skill directories.",
      "dependencies": ["T002"],
      "files": [
        "src/cli/adapters/codex.js",
        "src/cli/claude-settings.js",
        "src/cli/plugin.js",
        "src/cli/commands/init.js",
        "tests/unit/runtime-plan-contracts.test.js",
        "tests/unit/runtime-untrack.test.js",
        "tests/unit/dependency-readiness-baseline.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md#U4-Preserve-Provider-Owned-Runtime-Across-spec-first-init",
        "src/cli/adapters/codex.js",
        "src/cli/claude-settings.js",
        "src/cli/plugin.js",
        "src/cli/commands/init.js"
      ],
      "entry_hint": "Start with Codex hooks.json rendering and managed skill sync boundaries; preserve existing non-managed Graphify PreToolUse entries while updating spec-first SessionStart.",
      "test_focus": "spec-first init --codex preserves valid Graphify provider hooks/project skill runtime or readiness degrades with a repair action instead of silently claiming success.",
      "done_signal": "Runtime regeneration tests cover Graphify hook preservation, malformed hook handling or repair reporting, and provider readiness after init for configured and missing runtime cases.",
      "parallelizable": false,
      "risk_note": "Overwriting .codex/hooks.json wholesale would erase provider-owned PreToolUse hooks and recreate the post-setup invisibility bug.",
      "review_gate": "required",
      "review_focus": "Check source/runtime ownership, hook merge safety, malformed JSON behavior, and absence of hand-edits to generated runtime mirrors.",
      "stop_if": "The fix requires vendoring Graphify skill content into spec-first source or assigning provider-owned runtime files to spec-first managed assets.",
      "wave": 3
    },
    {
      "task_id": "T004",
      "source_unit": "U5",
      "requirement_refs": ["R1", "R5", "R7", "R9", "R10"],
      "goal": "Update AGENTS, CLAUDE, Runtime Setup guidance, setup preview, README, and provider-readiness docs so users and agents use resolved Graphify visibility and bounded source fallback instead of assuming bare graphify exists.",
      "dependencies": ["T001", "T002", "T003"],
      "files": [
        "AGENTS.md",
        "CLAUDE.md",
        "skills/spec-mcp-setup/SKILL.md",
        "skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs",
        "README.md",
        "README.zh-CN.md",
        "docs/contracts/provider-readiness.md",
        "tests/unit/dependency-readiness-baseline.test.js",
        "tests/unit/sync-instruction-files.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md#U5-Update-User-Facing-Guidance-And-Setup-Preview",
        "AGENTS.md#graphify",
        "CLAUDE.md#graphify",
        "skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs",
        "docs/contracts/provider-readiness.md"
      ],
      "entry_hint": "Revise source instructions first, then update setup preview and docs to distinguish command visibility, project skill runtime, artifact presence, hook status, and direct-source fallback.",
      "test_focus": "Docs and setup preview explain that graphify-out can exist while CLI/runtime visibility remains degraded, and no ordinary workflow is told to hand-edit runtime mirrors or run generation as a repair.",
      "done_signal": "AGENTS/CLAUDE guidance no longer assumes bare graphify as the only path; setup preview exposes visibility and provider-owned runtime writes; README/provider-readiness docs match the success ladder; instruction sync tests pass.",
      "parallelizable": false,
      "risk_note": "Changing runtime mirrors directly or teaching ordinary workflows to regenerate Graphify would violate the plan's source/runtime and setup ownership boundaries.",
      "review_gate": "required",
      "review_focus": "Check source-of-truth docs vs generated runtime boundary, dual-host wording, direct-source fallback language, and no overclaim that provider output is confirmed evidence.",
      "stop_if": "Guidance changes require a new public workflow entrypoint, a Runtime Setup rename, or automatic workflow-time Graphify generation.",
      "wave": 4
    },
    {
      "task_id": "T005",
      "source_unit": "U6",
      "requirement_refs": ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"],
      "goal": "Complete the multi-platform runtime visibility regression matrix, update release-surface bookkeeping, and verify the full Graphify setup visibility handoff.",
      "dependencies": ["T001", "T002", "T003", "T004"],
      "files": [
        "tests/unit/dependency-readiness-baseline.test.js",
        "tests/unit/mcp-setup.sh",
        "tests/unit/mcp-setup-powershell-contracts.test.js",
        "tests/unit/runtime-plan-contracts.test.js",
        "CHANGELOG.md"
      ],
      "context_refs": [
        "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md#U6-Add-End-to-End-Fixture-Coverage-For-Multi-Platform-Visibility",
        "docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md#Completion-Criteria",
        "tests/unit/dependency-readiness-baseline.test.js",
        "tests/unit/mcp-setup-powershell-contracts.test.js"
      ],
      "entry_hint": "Use the current observed failure as the fixture: graphify-out exists, provider-standard CLI exists off PATH, current-host skill is missing, and setup facts may be wrong-host.",
      "test_focus": "Regression coverage fails on artifact-only readiness and passes only when CLI visibility, project runtime, hooks, host facts, docs, and setup invocation are all handled honestly across Bash, PowerShell, and Node.",
      "done_signal": "Focused setup/readiness/runtime tests pass; task pack validation remains valid; CHANGELOG records the user-visible Runtime Setup fix with the developer profile author; any broader npm test or build failures are reported with exact scope.",
      "parallelizable": false,
      "risk_note": "A green test suite that only proves artifact existence would miss the original downstream-flow failure.",
      "review_gate": "required",
      "review_focus": "Check regression fixtures reproduce the original failure class, cover host mismatch, preserve provider-owned runtime, and keep Graphify optional/advisory.",
      "stop_if": "Tests can only pass by relaxing configured semantics, ignoring host mismatch, or treating generated runtime mirrors as source-owned files.",
      "wave": 5
    }
  ]
}
```

## Task Cards

### T001 - Resolver And Setup Invocation

- source_unit: U1+U2
- files: `skills/spec-mcp-setup/scripts/install-helpers.sh`, `skills/spec-mcp-setup/scripts/install-helpers.ps1`, `skills/spec-mcp-setup/scripts/provider-readiness-renderer.cjs`, `skills/spec-mcp-setup/SKILL.md`, `skills/spec-mcp-setup/provider-tools.json`, focused setup tests
- key boundary: setup may use an absolute Graphify command internally, but must still report the manual PATH visibility gap
- review_gate: required
- stop_if: the repair needs user shell profile mutation or makes Graphify required

### T002 - Readiness And Doctor Semantics

- source_unit: U3
- files: provider readiness renderer, setup facts writers, `setup-facts.js`, `doctor.js`, provider readiness contract/schema, focused tests
- key boundary: `configured` means durable current-host runtime, not process-local env success
- review_gate: required
- stop_if: the implementation needs a new durable provider state model beyond the source plan

### T003 - Provider Runtime Preservation

- source_unit: U4
- files: Codex adapter, Claude settings/runtime helpers if needed, init/plugin runtime sync logic, runtime preservation tests
- key boundary: Graphify project skill and hooks remain provider-owned runtime, not spec-first source
- review_gate: required
- stop_if: the fix requires vendoring Graphify skill content into `skills/`

### T004 - Guidance And Preview

- source_unit: U5
- files: checked-in AGENTS/CLAUDE source docs, Runtime Setup skill docs, setup preview renderer, README files, provider readiness docs, instruction sync tests
- key boundary: source docs change first; runtime mirrors refresh through `spec-first init` only during implementation verification
- review_gate: required
- stop_if: docs imply ordinary workflows should regenerate Graphify or hand-edit runtime mirrors

### T005 - Regression Matrix And Release Surface

- source_unit: U6
- files: setup/readiness/runtime tests and `CHANGELOG.md`
- key boundary: tests must reproduce the original artifact-exists/runtime-hidden failure class, not only verify artifact presence
- review_gate: required
- stop_if: green tests require weakening host mismatch or configured semantics

## Orientation Evidence

- provider: direct-repo-reads
- posture: bounded
- evidence_refs:
  - `docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md`
  - `skills/spec-write-tasks/SKILL.md`
  - `skills/spec-write-tasks/references/task-pack-schema.md`
  - `skills/spec-write-tasks/references/task-quality-guide.md`
  - `src/cli/task-pack.js`
  - `docs/tasks/2026-06-07-001-feat-tasks-split-and-chain-review-tasks.md`
- limitations:
  - The runtime `spec-write-tasks` skill was not exposed in the available skills list for this session, so this task pack was compiled from the repository source skill instructions as a fallback.
  - Graphify query through the resolved CLI was attempted as advisory orientation, but direct source reads carried the task-boundary decisions.
  - No implementation code was changed while compiling this task pack.

## Validation Notes

- This task pack derives from `docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md`.
- `source_plan_hash` was produced by `node bin/spec-first.js tasks hash docs/plans/2026-06-12-002-fix-graphify-runtime-visibility-plan.md`.
- Deterministic validation proves identity, freshness, and Task Pack Contract structure only. It does not prove semantic task quality.
- Because every task carries `review_gate: required` and the plan crosses runtime setup, provider readiness, host runtime generation, and docs, the recommended next action is task-pack document review before `$spec-work`.

## Regeneration Rules

Rebuild this task pack if the source plan, implementation units, file ownership, runtime preservation approach, provider readiness contract, verification matrix, or source plan hash changes. Reject this task pack as stale if `spec-first tasks validate` reports a source hash mismatch, and reject it as wrong-chain if `spec_id` stops matching the source plan.
