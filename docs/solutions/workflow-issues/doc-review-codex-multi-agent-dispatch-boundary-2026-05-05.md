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
  - "Host capability and workflow-owned dispatch admission need explicit separation"
tags: [doc-review, codex, multi-agent, dispatch, workflow-boundary]
---

# Codex doc-review multi-agent dispatch boundary

## Context

`spec-doc-review` inherited the CE shape of document review: a workflow chooses persona reviewers, runs them as independent agents, then synthesizes findings. The initial local adaptation treated Codex too conservatively by implying that Codex doc-review should fall back unless the user separately said "use subagents".

That framing mixed three separate concepts:

- Codex host capability: Codex can dispatch reviewer agents through `spawn_agent`.
- Workflow invocation: invoking the current host's documented doc-review workflow authorizes that workflow-owned reviewer phase by default; do not ask for a second "use subagents" confirmation.
- Runtime capability and safety: fallback is only for missing dispatch primitives, runtime call failure, explicit no-agent/report-only user requests, or unsafe mutating conditions.

## Guidance

Do not downgrade solely because the host is Codex. Model the boundary as a dispatch capability gate:

1. If the host exposes a dispatch primitive, run bounded persona reviewers for the documented reviewer phase.
2. If the user explicitly invokes the current host's doc-review workflow, treat that invocation as admission for the documented persona-reviewer phase; do not require another subagent confirmation.
3. If dispatch is unavailable, explicitly disabled, or unsafe, fall back to single-agent report-only review instead of calling hidden helpers or silently skipping review.
4. Keep bounded parallelism semantics from CE: queue reviewers, respect active-agent limits, and treat capacity errors as backpressure rather than reviewer failure.

The local `spec-doc-review` source now encodes this explicitly:

```markdown
- A direct invocation of the current host's document-review workflow entrypoint authorizes this documented persona-reviewer phase; do not ask for a second "use subagents" confirmation.
- Codex supports reviewer dispatch through `spawn_agent`; do not downgrade solely because the host is Codex.
```

The fallback is still important, but it is a capability/safety fallback, not a Codex-capability fallback:

```markdown
When dispatch is unavailable, explicitly disabled, or unsafe, set `single_agent_report_only_fallback: true` and run a read-only review in the current orchestrator.
```

## Why This Matters

If host capability and runtime authorization are conflated, the workflow loses one of CE's main quality mechanisms: independent persona review. It also creates confusing user behavior where `$spec-doc-review` appears to mean "single-agent inline review" even though the workflow contract documents persona reviewers.

The corrected contract preserves both sides:

- spec-first supports Codex multi-agent doc-review when the host dispatch primitive exists.
- spec-first still respects explicit no-agent/report-only requests and capability/safety fallback conditions.
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
Fallback only when dispatch is unavailable, explicitly disabled, or unsafe.
```

### Verification used for this change

```bash
npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand
npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand
```

## Related

- `skills/spec-doc-review/SKILL.md`
- `tests/unit/spec-doc-review-contracts.test.js`
- Upstream CE reference: `ce-doc-review` bounded persona dispatch
