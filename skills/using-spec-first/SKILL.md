---
name: using-spec-first
description: "Use at session entry for substantial work in this repo. Route requests into the right spec-first workflow before implementation, debugging, review, or planning. This skill governs workflow entry; it does not force brainstorming for every task."
---

# Using Spec-First

`using-spec-first` is the session-level entry governor for `spec-first` in this repository.

Its job is to decide whether the current request should enter `spec-first`, and if so, route it to the right workflow early.

It does **not** exist to force every task through brainstorming.

## Core Contract

1. Before any **substantial work**, first decide whether a `spec-first` workflow or standalone skill should handle the request.
2. If the request clearly benefits from `spec-first`, route into the correct workflow before implementation or environment-changing work.
3. If no `spec-first` workflow is a good fit, direct response or normal execution is allowed.
4. `using-spec-first` governs **workflow entry and routing**, not all downstream execution.

## What Counts as Substantial Work

Treat these as substantial work:
- modifying code, docs, config, or generated runtime assets
- starting implementation, debugging, review, planning, bootstrap, or context-capture workflows
- running commands that change project state or depend on workflow context

These are **not** substantial work:
- lightweight factual answers
- brief explanations with no workflow leverage
- quick questions where `spec-first` provides no meaningful routing benefit

## Routing Rules

Use a decision tree, not a blanket “brainstorm first” rule.

1. If the request is about environment setup, host setup, or MCP setup, route to:
   - Claude: `/spec:setup`
   - Codex: `$spec-setup`
   - Or the relevant setup standalone skill when the request is skill-scoped rather than workflow-scoped.
2. If the request is about updating or refreshing runtime assets, route to:
   - Claude: `/spec:update`
   - Codex: `$spec-update`
3. If the request is about retrieving session history or related external context, route to:
   - Claude: `/spec:sessions`
   - Codex: `$spec-sessions`
4. If there is an existing bug, failure, or abnormal behavior to reproduce or diagnose, route to:
   - Claude: `/spec:debug`
   - Codex: `$spec-debug`
5. If the request is a review, audit, or PR/document evaluation, route to:
   - Claude: `/spec:review`
   - Codex: `$spec-review`
   - Or `document-review` when the work is explicitly document-review scoped.
6. If the goal is bootstrap, graph bootstrap, or context-building, route to:
   - Claude: `/spec:bootstrap`, `/spec:graph-bootstrap`, or `/spec:compound`
   - Codex: `$spec-bootstrap`, `$spec-graph-bootstrap`, or `$spec-compound`
7. If the user is still defining WHAT to build, or scope/requirements are genuinely unclear, route to:
   - Claude: `/spec:brainstorm` or `/spec:ideate`
   - Codex: `$spec-brainstorm` or `$spec-ideate`
8. If the desired outcome is already clear and the user needs an execution plan, route to:
   - Claude: `/spec:plan`
   - Codex: `$spec-plan`
9. If there is already a plan or the implementation task is clear enough to execute, route to:
   - Claude: `/spec:work`
   - Codex: `$spec-work`
10. If none of the above applies, do not force the request into `spec-first`.

## Hard Rules

1. `workflow-first` does **not** mean `brainstorming-first`.
2. Do **not** make `spec-brainstorm` the universal default front door.
3. Do **not** adopt the `using-superpowers` rule that “if there is a 1% chance a skill applies, you must invoke it.”
4. Do **not** turn ordinary lightweight requests into mandatory workflow traffic.
5. Do **not** describe `using-spec-first` itself as a command-backed workflow.
6. Do **not** write Codex entrypoints as `/spec:*`.
7. Do **not** write Claude workflow entrypoints as `$spec-*`.

## Host Surface

- Claude workflow entrypoints use `/spec:*`
- Codex workflow entrypoints use `$spec-*`
- Standalone skills remain skill references, not slash commands

## Injection Behavior

If this skill has already been injected into the session via SessionStart or instruction bootstrap:
- do not reload this same skill file again just to bootstrap yourself
- use the Skill tool for other workflows or standalone skills as needed
- keep `skills/using-spec-first/SKILL.md` as the routing source of truth

## Exit Condition

If no `spec-first` workflow meaningfully applies, answer directly or perform the normal task without forcing workflow indirection.
