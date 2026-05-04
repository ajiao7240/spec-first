---
title: Codex doc-review multi-agent dispatch boundary
date: 2026-05-05
category: workflow-issues
module: spec-doc-review
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Adapting CE-style persona reviewer workflows to Codex"
  - "A workflow owns a documented reviewer dispatch phase"
  - "Host capability and session authorization need separate treatment"
tags: [doc-review, codex, multi-agent, dispatch, workflow-boundary]
---

# Codex doc-review multi-agent dispatch boundary

## Context

`spec-doc-review` inherited the CE shape of document review: a workflow chooses persona reviewers, runs them as independent agents, then synthesizes findings. The initial local adaptation treated Codex too conservatively by implying that Codex doc-review should fall back unless the user separately said "use subagents".

That framing mixed three separate concepts:

- Codex host capability: Codex can dispatch reviewer agents through `spawn_agent`.
- Workflow invocation: invoking the current host's documented doc-review workflow can authorize that workflow-owned reviewer phase when current session rules allow it.
- Runtime restriction: a particular session may still impose stricter developer or harness rules that prohibit dispatch.

## Guidance

Do not downgrade solely because the host is Codex. Model the boundary as a dispatch capability gate:

1. If the host exposes a dispatch primitive and current session rules permit workflow-owned reviewer dispatch, run bounded persona reviewers.
2. If the user explicitly invokes the current host's doc-review workflow, treat that invocation as authorization for the documented persona-reviewer phase when session rules permit it.
3. If the current session imposes a stricter boundary, fall back to single-agent report-only review instead of calling hidden helpers or silently skipping review.
4. Keep bounded parallelism semantics from CE: queue reviewers, respect active-agent limits, and treat capacity errors as backpressure rather than reviewer failure.

The local `spec-doc-review` source now encodes this explicitly:

```markdown
- If the user explicitly invoked the current host's document-review workflow entrypoint and the current session rules permit workflow-owned reviewer dispatch, treat that workflow invocation as authorization for this documented persona-reviewer phase; do not require a second "use subagents" phrase.
- Codex supports reviewer dispatch through `spawn_agent`; do not downgrade solely because the host is Codex.
```

The fallback is still important, but it is a session-policy fallback, not a Codex-capability fallback:

```markdown
When dispatch is not allowed, set `single_agent_report_only_fallback: true` and run a read-only review in the current orchestrator.
```

## Why This Matters

If host capability and runtime authorization are conflated, the workflow loses one of CE's main quality mechanisms: independent persona review. It also creates confusing user behavior where `$spec-doc-review` appears to mean "single-agent inline review" even though the workflow contract documents persona reviewers.

The corrected contract preserves both sides:

- spec-first supports Codex multi-agent doc-review when the workflow and session permit it.
- spec-first does not violate a stricter current-session dispatch boundary.
- callers get an explicit coverage note when review degraded to report-only fallback.

## When to Apply

- When porting CE workflows that use persona subagents into spec-first.
- When writing Codex-specific workflow prose around `spawn_agent`.
- When deciding whether an explicit workflow invocation should count as authorization for workflow-owned agent phases.
- When adding fallback behavior for hosts or sessions where dispatch is unavailable.

## Examples

### Better dispatch rule

```markdown
Dispatch agents using bounded parallelism with the platform's subagent primitive.
Respect the current harness's active-subagent limit.
Treat active-agent/thread/concurrency-limit spawn errors as backpressure, not reviewer failure.
```

### Better Codex boundary

```markdown
Codex supports reviewer dispatch through `spawn_agent`; do not downgrade solely because the host is Codex.
Honor current session developer instructions if they impose a stricter dispatch authorization boundary.
```

### Verification used for this change

```bash
npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand
npm run lint:skill-entrypoints
npm run typecheck
```

## Related

- `skills/spec-doc-review/SKILL.md`
- `tests/unit/spec-doc-review-contracts.test.js`
- Upstream CE reference: `ce-doc-review` bounded persona dispatch
