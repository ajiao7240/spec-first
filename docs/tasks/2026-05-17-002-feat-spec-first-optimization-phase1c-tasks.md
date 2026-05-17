---
title: "feat: spec-first optimization Phase 1C task pack"
type: task-pack
status: derived
date: 2026-05-17
spec_id: 2026-05-11-002-spec-first-project-optimization-upgrade
source_plan: docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md
source_plan_hash: sha256:5f7f1cffbb1622cb01a1175658a55e9cdf50fbc4fe35312fc09bbe8230598d02
generated_by: spec-write-tasks
mode: derived
source_sections:
  - "U4. `spec-standards` next-action candidates"
  - "Phase 1 放行门槛"
  - "U11. Cross-cutting closeout checklist"
---

# feat: spec-first optimization Phase 1C task pack

## Overview

This task pack is the executable Phase 1C handoff for the source plan. It covers only U4-minimal `spec-standards` next-action candidate facts: one machine-readable artifact path, deterministic producer facts, validator coverage, example artifact, consumer fail-closed behavior, and U11 closeout.

It does not implement sorting, a single `target_entrypoint`, complex mode matrix, `blocking` policy, auto routing, freshness/rebuild policy, parent-workspace policy expansion, or Phase 2/3 work.

## Source Summary

- Source plan: `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`
- Consumed source sections: U4, Phase 1C release gate, U11 closeout checklist.
- Scope boundaries: scripts produce candidate facts only; the LLM chooses any human recommendation after reading the artifact. `next-action-candidates.json` is distinct from `standards-candidates.json` and `standards-update-decision.json`.
- Implementation-time unknowns: exact candidate derivation may stay conservative, but the artifact contract must include the plan's minimum fields and must not contain raw provider excerpts or a single recommended entrypoint.

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U4 | R6, R12; standards next-action candidate facts artifact | T001 | spec-standards contract, validation, and consumer tests |
| Phase 1C gate | unknown schema fail closed; no `target_entrypoint`; validator and consumer tests pass | T001 | targeted Jest tests |
| U11 | R17; closeout checklist | T001 | changelog, runtime impact, fresh-source eval |

## Task Graph

T001 is a single serialized task because producer, validator, example, skill prose, and consumer tests must agree on the same artifact contract.

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
      "source_unit": "U4",
      "requirement_refs": ["R6", "R12", "R17"],
      "goal": "Deliver Phase 1C spec-standards next-action-candidates facts artifact with deterministic producer fields, validator support, example coverage, and consumer fail-closed tests.",
      "dependencies": [],
      "files": [
        "skills/spec-standards/SKILL.md",
        "skills/spec-standards/scripts/prepare-baseline.js",
        "skills/spec-standards/scripts/validate-artifacts.js",
        "skills/spec-standards/examples/glue-map.example.json",
        "skills/spec-standards/examples/next-action-candidates.example.json",
        "tests/unit/spec-standards-contracts.test.js",
        "tests/unit/spec-standards-validation.test.js",
        "tests/unit/spec-standards-consumers.test.js",
        "CHANGELOG.md"
      ],
      "context_refs": [
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U4. `spec-standards` next-action candidates",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#Phase 1 放行门槛",
        "docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U11. Cross-cutting closeout checklist",
        "skills/spec-standards/SKILL.md#Artifact Contract",
        "skills/spec-standards/scripts/prepare-baseline.js",
        "skills/spec-standards/scripts/validate-artifacts.js",
        "tests/unit/spec-standards-validation.test.js",
        "tests/unit/spec-standards-consumers.test.js"
      ],
      "entry_hint": "Start by defining the artifact shape and path, then wire conservative deterministic production into prepare-baseline and validation into validate-artifacts.",
      "parallelizable": false,
      "test_focus": "Artifact production, schema/version fail-closed behavior, repo-relative evidence paths, source_fact_refs classification, no target_entrypoint, possible_entrypoints as candidate set only, consumer trust handling.",
      "done_signal": "Targeted spec-standards tests pass; baseline writes `.spec-first/standards/next-action-candidates.json`; validator accepts valid artifact and rejects unknown schema/malformed candidates/single target_entrypoint/raw provider excerpts.",
      "wave": 1,
      "review_gate": "required",
      "review_focus": "Check scripts do not choose a final workflow, artifact boundary is distinct from standards candidates/update decision, evidence paths are contained, and Phase 2 mode matrix scope did not creep in.",
      "risk_note": "The main risk is turning candidate facts into an automatic router or mixing workflow handoff facts with standards content candidates.",
      "stop_if": "A single target_entrypoint, ranking algorithm, blocking policy, mode matrix, parent workspace policy expansion, generated runtime mirror edit, or Phase 2 freshness/rebuild lifecycle becomes necessary."
    }
  ]
}
```

## Task Cards

### T001

- source_unit: U4
- requirement_refs: R6, R12, R17
- goal: Deliver the Phase 1C `spec-standards` next-action-candidates facts artifact.
- dependencies: none
- files:
  - `skills/spec-standards/SKILL.md`
  - `skills/spec-standards/scripts/prepare-baseline.js`
  - `skills/spec-standards/scripts/validate-artifacts.js`
  - `skills/spec-standards/examples/glue-map.example.json`
  - `skills/spec-standards/examples/next-action-candidates.example.json`
  - `tests/unit/spec-standards-contracts.test.js`
  - `tests/unit/spec-standards-validation.test.js`
  - `tests/unit/spec-standards-consumers.test.js`
  - `CHANGELOG.md`
- context_refs:
  - `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md#U4. spec-standards next-action candidates`
  - `skills/spec-standards/scripts/prepare-baseline.js`
  - `skills/spec-standards/scripts/validate-artifacts.js`
- entry_hint: Define the minimal facts artifact first; keep LLM recommendation outside the script.
- test_focus: Producer/validator/consumer tests for field shape, boundary, and fail-closed version behavior.
- done_signal: Artifact is produced and validated without ranking, target_entrypoint, raw provider excerpts, or auto routing.
- parallelizable: false
- review_gate: required
- review_focus: Artifact boundary, scripts-vs-LLM decision boundary, evidence containment, and no Phase 2 scope creep.
- stop_if: A router, ranking model, or mode matrix becomes necessary.
- wave: 1

## Orientation Evidence

- provider: direct-repo-reads
- posture: bounded
- evidence_refs:
  - `docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md`
  - `skills/spec-standards/SKILL.md`
  - `skills/spec-standards/scripts/prepare-baseline.js`
  - `skills/spec-standards/scripts/validate-artifacts.js`
  - `tests/unit/spec-standards-validation.test.js`
  - `tests/unit/spec-standards-consumers.test.js`
- limitations:
  - This task pack does not use graph-backed impact evidence because Phase 1C scope is directly declared by the source plan and local source files.
  - Deterministic task-pack validation checks identity, freshness, and structure only; semantic scope remains governed by the source plan.

## Validation Notes

- Source plan hash was produced with `spec-first tasks hash docs/plans/2026-05-11-002-feat-spec-first-project-optimization-upgrade-plan.md --json`.
- This task pack must pass `spec-first tasks validate docs/tasks/2026-05-17-002-feat-spec-first-optimization-phase1c-tasks.md --json`.
- Phase 1C closeout must record runtime impact and fresh-source eval because it changes workflow prose/scripts.

## Regeneration Rules

- Regenerate from the source plan if `source_plan_hash` changes.
- Regenerate if U4 changes the minimum fields, artifact path, consumer rule, or Phase 1C non-goals.
- Do not hand-edit this pack to include Phase 1D/2/3 work; derive the next phase task pack after Phase 1C closeout.
