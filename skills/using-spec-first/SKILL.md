---
name: using-spec-first
description: "Use before substantial work in a spec-first project. Decide whether to route into a public spec-first workflow before editing files, running state-changing commands, debugging, reviewing, planning, setup, update, or architecture/prompt/workflow decisions."
---

# Using Spec-First

`using-spec-first` is the standalone meta skill and entry governor for `spec-first` in this repository.

Its job is to decide whether the current request should enter a `spec-first` workflow, and if so, route it to the right workflow before the agent starts changing state.

It is not a command-backed workflow, slash command, or `$spec-*` workflow. It is exposed as a standalone meta skill so host skill discovery can load the full entry policy:

- Claude Code installs it as `.claude/skills/using-spec-first/SKILL.md` and also reads the managed block in `CLAUDE.md`; its SessionStart hook may re-inject that same bootstrap block.
- Codex installs it as `.agents/skills/using-spec-first/SKILL.md` and also reads the managed block in `AGENTS.md`.

It does **not** exist to force every task through brainstorming.

## If You Are A Subagent

If you were dispatched as a subagent or worker for a specific bounded task, do not restart workflow routing unless the parent explicitly asked you to choose a workflow. Complete the assigned task within its scope and report back.

## Core Contract

1. Before any **substantial work**, decide whether one of the public `spec-first` workflows should handle the request.
2. If a public workflow fits, route to that workflow before implementation, debugging, review, planning, setup, update, or environment-changing work.
3. If no public workflow fits, answer directly or execute normally; do not invent a workflow handoff.
4. `using-spec-first` governs **entry routing only**. Once a workflow starts, follow that workflow's own `SKILL.md`.
5. Keep deterministic checks in CLI/scripts and leave semantic routing decisions to the agent.
6. If the user explicitly invokes a workflow (`/spec:*`, `$spec-*`, or a skill name), honor that route unless it is clearly impossible or unsafe.

## What Counts as Substantial Work

Treat these as substantial work:
- modifying code, docs, config, or generated runtime assets
- starting implementation, debugging, review, planning, setup, update, bootstrap, optimization, or context-capture workflows
- running commands that change project state or depend on workflow context
- making architectural, prompt, workflow, governance, or contract decisions
- creating, refreshing, or retiring durable project knowledge

These are **not** substantial work:
- lightweight factual answers
- brief explanations with no workflow leverage
- quick questions where `spec-first` provides no meaningful routing benefit
- showing a command output or answering a narrow "where is X used?" question without edits

## Routing Rules

Use a decision tree, not a blanket "brainstorm first" rule. Pick the first strongly matching route. If multiple routes apply, choose the workflow that best matches the user's immediate intent.

## Routing Priority

When multiple routes could apply, use this priority:

1. **Explicit user route** — if the user names a workflow, use it.
2. **Safety/repair routes** — setup, update, missing runtime assets, broken host readiness.
3. **Diagnostic routes** — debug before work when the request is about a failure.
4. **Evaluation routes** — code/doc review before implementation when the user asks for review.
5. **Definition routes** — ideate/brainstorm before plan/work when the outcome is still unclear.
6. **Execution routes** — plan before work when the desired outcome is clear but the implementation path is not.
7. **Knowledge routes** — compound/compound-refresh after or around completed work.

Do not chain multiple workflows automatically unless the active workflow explicitly hands off. Route to the next best workflow and let that workflow govern its own handoff.

### Maintenance And Host Readiness

1. If the request is about environment setup, host setup, MCP setup, missing tools, or host readiness, route to:
   - Claude: `/spec:mcp-setup`
   - Codex: `$spec-mcp-setup`
2. If the request is about checking/updating spec-first, refreshing generated runtime assets, or repairing stale `/spec:*` / `$spec-*` entries, route to:
   - Claude: `/spec:update`
   - Codex: `$spec-update`
3. If the request is about diagnosing the installed spec-first environment itself, and not specifically MCP/update, route to:
   - Claude: `/spec:setup`
   - Codex: `$spec-setup`

### Research And Context

4. If the request is about retrieving past coding-agent sessions or asking what happened in prior work, route to:
   - Claude: `/spec:sessions`
   - Codex: `$spec-sessions`
5. If the request explicitly asks for Slack or organizational discussion context, route to:
   - Claude: `/spec:slack-research`
   - Codex: `$spec-slack-research`
6. If the goal is graph bootstrap, repository context generation, CRG readiness, or Stage-0 context quality, route to:
   - Claude: `/spec:graph-bootstrap`
   - Codex: `$spec-graph-bootstrap`

### Delivery Workflows

7. If there is an existing bug, failure, test failure, stack trace, or abnormal behavior to reproduce or diagnose, route to:
   - Claude: `/spec:debug`
   - Codex: `$spec-debug`
8. If the request is a code review, PR review, diff audit, or implementation-quality evaluation, route to:
   - Claude: `/spec:code-review`
   - Codex: `$spec-code-review`
9. If the request is a requirements, plan, spec, or markdown document review, route to:
   - Claude: `/spec:doc-review`
   - Codex: `$spec-doc-review`
10. If the user is asking what to build, wants ideas, or asks for options/surprising improvements without presenting their own concrete feature, route to:
   - Claude: `/spec:ideate`
   - Codex: `$spec-ideate`
11. If the user is still defining WHAT to build, the problem frame is unclear, or product decisions need to be resolved before planning, route to:
   - Claude: `/spec:brainstorm` or `/spec:ideate`
   - Codex: `$spec-brainstorm` or `$spec-ideate`
12. If the desired outcome is clear and the user needs an execution plan, route to:
   - Claude: `/spec:plan`
   - Codex: `$spec-plan`
13. If there is already a plan or the implementation task is clear enough to execute, route to:
   - Claude: `/spec:work`
   - Codex: `$spec-work`
14. If the user explicitly asks to trial beta execution with Codex delegation, route to:
   - Claude: `/spec:work-beta`
   - Codex: `$spec-work-beta`
15. If the user asks to polish a browser-visible UI and iterate with a running app, route to:
   - Claude: `/spec:polish-beta`
   - Codex: `$spec-polish-beta`

### Knowledge And Release Support

16. If the user wants to capture a recently solved problem, create a durable learning, or compound knowledge after work, route to:
   - Claude: `/spec:compound`
   - Codex: `$spec-compound`
17. If the request is to refresh, correct, merge, replace, or retire existing durable docs/learnings/pattern docs, route to:
   - Claude: `/spec:compound-refresh`
   - Codex: `$spec-compound-refresh`
18. If the user asks for PR description writing or regeneration, route to:
   - Claude: `/spec:pr-description`
   - Codex: `$spec-pr-description`
19. If the user asks what changed in recent spec-first releases, route to:
   - Claude: `/spec:release-notes`
   - Codex: `$spec-release-notes`
20. If the user asks to optimize a measurable outcome through experiments, route to:
   - Claude: `/spec:optimize`
   - Codex: `$spec-optimize`
21. If none of the above applies, do not force the request into `spec-first`.

## Hard Rules

1. `workflow-first` does **not** mean `brainstorming-first`.
2. Do **not** make `spec-brainstorm` the universal default front door.
3. Do **not** adopt the `using-superpowers` rule that “if there is a 1% chance a skill applies, you must invoke it.”
4. Do **not** turn ordinary lightweight requests into mandatory workflow traffic.
5. Do **not** describe `using-spec-first` itself as a command-backed workflow.
6. Do **not** write Codex entrypoints as `/spec:*`.
7. Do **not** write Claude workflow entrypoints as `$spec-*`.
8. Do **not** expose internal-only skills as user entrypoints. This includes `spec-session-inventory` and `spec-session-extract`.
9. Do **not** route to hidden helper skills such as git, browser, image, proof, xcode, or bug-report helpers unless a public workflow explicitly delegates to them.
10. Do **not** run `spec-first init`, `clean`, update, or other state-changing commands just because this governor matched; first route to the appropriate workflow or ask a narrow confirmation when required.

## Routing Red Flags

These thoughts mean pause and apply the routing rules before acting:

| Thought | Better move |
|---------|-------------|
| "I'll just edit the file first." | Check whether this is `work`, `debug`, `update`, or `compound-refresh`. |
| "This is just a quick architecture/prompt change." | Treat architecture, prompt, workflow, and contract changes as substantial work. |
| "I need to inspect a bunch of files before deciding." | Do a minimal fact check only; route if the request is already clearly review/debug/plan/work. |
| "The user asked for a review, but I can answer informally." | Use `code-review` or `doc-review` when the review target is concrete. |
| "The task is vague, but I can probably implement something." | Use `brainstorm` or `plan` before work. |
| "A helper skill exists, so I should expose it." | Only public workflows are user entrypoints; internal helpers stay hidden. |
| "I should run init/update now." | Route to `update` or `setup` first unless the user explicitly requested the command. |

## Host Surface

- Claude workflow entrypoints use `/spec:*`.
- Codex workflow entrypoints use `$spec-*`.
- `using-spec-first` itself is a standalone meta skill, not a `/spec:*` or `$spec-*` workflow entrypoint.
- Internal-only skills remain source/runtime support assets, not menu items.

## Injection Behavior

If this guidance has already been injected through `CLAUDE.md`, `AGENTS.md`, or Claude SessionStart:
- do not reload or invoke `using-spec-first` just to bootstrap yourself
- use the appropriate public `/spec:*` or `$spec-*` workflow entrypoint when routing is needed
- treat `skills/using-spec-first/SKILL.md` as the source-of-truth text for this routing policy
- if the installed instruction block or standalone meta skill is missing or stale, the repair path is `spec-first init --claude` or `spec-first init --codex`

## Exit Condition

If no `spec-first` workflow meaningfully applies, answer directly or perform the normal task without forcing workflow indirection.
