---
title: High Risk Source Runtime Boundary Plan
type: plan
status: approved
spec_id: 2026-04-26-997-high-risk-review-fixture
plan_depth: deep
---

# High Risk Source Runtime Boundary Plan

## Scope Boundaries

- Change only source skill guidance and its package-local references.
- Do not hand-edit generated runtime mirrors.
- Do not run document review unless a bounded continuation is explicitly authorized.

## Implementation Units

### U1: Handoff Contract

Goal: Refine task-pack handoff rules for source/runtime boundary work.

Files:

- skills/spec-write-tasks/SKILL.md
- skills/spec-write-tasks/references/execution-handoff-contract.md

Verification:

- Contract tests prove the skill points to the handoff reference and preserves validation boundaries.

### U2: Review Handoff

Goal: Preserve high-risk review intent without silently chaining workflows.

Files:

- skills/spec-write-tasks/evals/boundary-cases.json
- tests/unit/spec-write-tasks-contracts.test.js

Verification:

- Boundary fixture expects `next_action: review-task-pack` and `dispatch_authorization: missing` unless explicitly authorized.

## Test Scenarios

- `npx jest --runTestsByPath tests/unit/spec-write-tasks-contracts.test.js --runInBand`
- High-risk handoff returns `dispatch_authorization: missing` unless a parent workflow explicitly authorizes exactly one headless doc-review continuation.
