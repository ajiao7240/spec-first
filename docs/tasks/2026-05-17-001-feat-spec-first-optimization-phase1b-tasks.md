---
title: "feat: spec-first optimization Phase 1B task pack"
type: task-pack
status: derived
date: 2026-05-17
spec_id: 2026-05-11-002-spec-first-project-optimization-upgrade
source_plan: docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md
source_plan_hash: sha256:5f7f1cffbb1622cb01a1175658a55e9cdf50fbc4fe35312fc09bbe8230598d02
generated_by: spec-write-tasks
mode: derived
source_sections:
  - "U3. spec-work durable run evidence"
  - "U11. Cross-cutting closeout checklist"
  - "分阶段交付"
---

# feat: spec-first optimization Phase 1B task pack

## Overview

This task pack is the executable Phase 1B handoff for the source plan. It covers only the run evidence write-side foundation: schema-aligned `spec-work` closeout producer, internal CLI boundary, producer/catalog status split, minimal resume/closeout prose, evidence safety, targeted tests, and U11 closeout.

It does not implement Phase 1C `next_action_candidates`, Phase 1D core workflow intake cleanup, Phase 2, Phase 3 replay index, retention/prune/delete lifecycle, reporting UI, or cross-workflow replay.

## Source Summary

- Source plan: `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`
- Task-ready branch: `compile`
- Consumed source sections: U3, U11, Phase 1 delivery gates, and Phase 1 deferred retention boundaries.
- Scope boundaries that shaped this split: producer write-side foundation only; `workflow_integrated` remains false unless a real workflow fixture/eval proves integration; retention lifecycle remains `lifecycle-deferred`; generated runtime mirrors remain untouched.
- Implementation-time unknowns: exact schema field names may adapt to existing schema-validator patterns, but the producer must preserve the plan's authority separation between `script_confirmed`, `llm_asserted`, and `provider_untrusted`.

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U3 | R5, R23, R25, R26; durable run evidence write-side foundation | T001 | Producer/schema tests and internal CLI tests |
| U11 | R17, R26; closeout checklist | T001 | Changelog, runtime impact, safety tests |
| Phase 1B gate | Producer available, workflow integrated split, unsafe artifact rejection | T001 | Runtime catalog and producer tests |

## Task Graph

T001 is a single serialized foundation task because the schema, producer, internal command, catalog, prose contracts, and tests must agree on one artifact contract.

## Execution Waves

- Wave 1: T001

## Task Pack Contract

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    {
      "wave": 1,
      "tasks": ["T001"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U3",
      "requirement_refs": ["R5", "R17", "R23", "R25", "R26"],
      "goal": "Deliver Phase 1B spec-work run evidence write-side producer with schema/path/security validation, internal CLI boundary, catalog producer_available/workflow_integrated split, and closeout/resume prose.",
      "dependencies": [],
      "files": [
        "skills/spec-work/SKILL.md",
        "skills/spec-work-beta/SKILL.md",
        "docs/contracts/workflows/spec-work-run-artifact.schema.json",
        "scripts/generate-runtime-capability-catalog.js",
        "docs/catalog/runtime-capabilities.md",
        "src/cli/helpers/spec-work-run-artifact.js",
        "src/cli/commands/internal.js",
        "tests/unit/spec-work-run-artifact-contract.test.js",
        "tests/unit/spec-work-run-artifact-producer.test.js",
        "tests/unit/runtime-capability-catalog.test.js",
        "tests/unit/runtime-contract-boundary.test.js",
        "tests/unit/spec-work-contracts.test.js",
        "tests/unit/spec-work-beta-contracts.test.js",
        "CHANGELOG.md"
      ],
      "context_refs": [
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U3. spec-work durable run evidence",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U11. Cross-cutting closeout checklist",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#分阶段交付",
        "docs/contracts/workflows/spec-work-run-artifact.schema.json",
        "src/cli/commands/internal.js",
        "scripts/generate-runtime-capability-catalog.js",
        "tests/unit/spec-work-run-artifact-contract.test.js",
        "tests/unit/runtime-capability-catalog.test.js"
      ],
      "entry_hint": "Start with U3 Producer Contract, then update schema status and implement the internal write command with fail-closed safety tests.",
      "parallelizable": false,
      "test_focus": "Schema validation, internal CLI output/exit codes, atomic write, path containment, secret/raw log rejection, catalog status split, and spec-work closeout prose.",
      "done_signal": "Targeted tests pass, runtime catalog is regenerated, producer writes a safe repo-relative run.json for a valid payload, unsafe payloads are rejected, and workflow_integrated remains false unless explicitly proven.",
      "wave": 1,
      "review_gate": "required",
      "review_focus": "Check evidence safety, source/runtime boundary, producer_available vs workflow_integrated split, and no Phase 3 retention/replay scope creep.",
      "risk_note": "The main risk is making producer availability look like full workflow integration or storing unsafe raw evidence.",
      "stop_if": "A replay index, prune/TTL lifecycle, external raw-log URL support, generated runtime mirror edit, or next-action candidates artifact becomes necessary."
    }
  ]
}
```

## Task Cards

### T001

- source_unit: U3
- requirement_refs: R5, R17, R23, R25, R26
- goal: Deliver the Phase 1B run evidence write-side foundation.
- dependencies: none
- files:
  - `skills/spec-work/SKILL.md`
  - `skills/spec-work-beta/SKILL.md`
  - `docs/contracts/workflows/spec-work-run-artifact.schema.json`
  - `scripts/generate-runtime-capability-catalog.js`
  - `docs/catalog/runtime-capabilities.md`
  - `src/cli/helpers/spec-work-run-artifact.js`
  - `src/cli/commands/internal.js`
  - `tests/unit/spec-work-run-artifact-contract.test.js`
  - `tests/unit/spec-work-run-artifact-producer.test.js`
  - `tests/unit/runtime-capability-catalog.test.js`
  - `tests/unit/runtime-contract-boundary.test.js`
  - `tests/unit/spec-work-contracts.test.js`
  - `tests/unit/spec-work-beta-contracts.test.js`
  - `CHANGELOG.md`
- context_refs:
  - `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U3. spec-work durable run evidence`
  - `docs/contracts/workflows/spec-work-run-artifact.schema.json`
  - `src/cli/commands/internal.js`
- entry_hint: Start with the producer API contract and schema metadata.
- test_focus: Producer, schema, catalog, and closeout prose contract tests.
- done_signal: Valid write and unsafe rejection tests pass, catalog reports producer availability without claiming workflow integration, and changelog is updated.
- parallelizable: false
- review_gate: required
- review_focus: Evidence safety, producer/catalog split, retention boundary, and source/runtime boundary.
- stop_if: Phase 3 replay/prune lifecycle or external raw-log URL support becomes necessary.
- wave: 1

## Orientation Evidence

- provider: direct-repo-reads
- posture: bounded
- evidence_refs:
  - `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`
  - `docs/contracts/workflows/spec-work-run-artifact.schema.json`
  - `src/cli/commands/internal.js`
  - `scripts/generate-runtime-capability-catalog.js`
  - `tests/unit/spec-work-run-artifact-contract.test.js`
  - `tests/unit/runtime-capability-catalog.test.js`
- limitations:
  - This task pack does not use graph-backed impact evidence because Phase 1B scope is directly declared by the source plan and local source files.
  - Deterministic task-pack validation checks identity, freshness, and structure only; semantic scope remains governed by the source plan.

## Validation Notes

- Source plan hash was produced with `spec-first tasks hash docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md --json`.
- This task pack must pass `spec-first tasks validate docs/tasks/2026-05-17-001-feat-spec-first-optimization-phase1b-tasks.md --json`.
- Phase 1B closeout must record retention lifecycle as deferred; TTL/delete owner/prune validation remains Phase 3 U3b.

## Regeneration Rules

- Regenerate from the source plan if `source_plan_hash` changes.
- Regenerate if U3 changes producer API, schema status, safety rules, or runtime catalog scope.
- Do not hand-edit this pack to include Phase 1C/1D/2/3 work; derive the next phase task pack after Phase 1B closeout.
