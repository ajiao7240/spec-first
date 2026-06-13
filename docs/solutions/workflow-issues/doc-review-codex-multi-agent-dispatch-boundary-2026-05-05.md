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

`spec-doc-review` inherited the CE shape of document review: a workflow chooses persona reviewers, runs them as independent agents, then synthesizes findings.

This learning originally documented a looser Codex dispatch-admission model. That model is no longer current. Commit `fc3d43c1` on 2026-05-24 ("闭合 must-fix 批次") superseded it with the stricter boundary now encoded in `skills/using-spec-first/SKILL.md`, `skills/spec-doc-review/SKILL.md`, and the dispatch contract tests.

Use this file as historical provenance plus current corrected guidance. Do not use the superseded section below as live implementation advice.

## Guidance

Current rule:

1. Public workflow invocation authorizes the workflow to run.
2. Public workflow invocation does not automatically authorize host-level `spawn_agent`.
3. In Codex, call `spawn_agent` only when the visible user request or parent workflow handoff explicitly asks for subagents, delegated work, parallel agents, persona reviewer dispatch, or equivalent documented multi-agent authorization.
4. If dispatch capability exists but explicit authorization is absent, run the single-agent report-only fallback and record `dispatch_authorization_missing`.
5. Make the opt-in path user-visible: for multi-persona or subagent review in Codex, ask for `subagents`, `personas`, delegated review, or parallel agents in the request.

The local `spec-doc-review` source now encodes this strict boundary:

```markdown
- A direct invocation of the current host's document-review workflow entrypoint authorizes the doc-review workflow itself; it does not automatically authorize host-level subagent tools whose contract requires explicit subagent, delegation, or parallel-agent wording.
- If dispatch capability exists but explicit authorization is absent, record `dispatch_authorization_missing` and run the single-agent report-only fallback.
```

The fallback is a host-boundary fallback, not a reviewer failure:

```markdown
When dispatch is unavailable, explicitly disabled, unauthorized, or unsafe, set `single_agent_report_only_fallback: true` and run a read-only review in the current orchestrator.
```

String-based drift guards are a secondary backstop; they can miss paraphrases of the old model. This supersession note is the primary durable guardrail for future recall from `docs/solutions/`.

## Superseded Decision (Historical Only)

The superseded 2026-05-05 model treated the documented doc-review workflow phase as enough dispatch admission in Codex. Historical wording included:

```markdown
Workflow invocation: invoking the current host's documented doc-review workflow authorizes that workflow-owned reviewer phase by default; do not ask for a second "use subagents" confirmation.
If the user explicitly invokes the current host's doc-review workflow, treat that invocation as admission for the documented persona-reviewer phase; do not require another subagent confirmation.
```

That guidance was intentionally reversed by commit `fc3d43c1` on 2026-05-24. Keep it only as provenance for why older docs or memories may disagree with the current stricter contract.

## Why This Matters

If workflow admission and host-level dispatch authorization are conflated, Codex may call `spawn_agent` as an unprompted side effect. That violates the host boundary even when the document-review workflow itself is appropriate.

The corrected contract preserves both sides:

- spec-first still supports Codex multi-agent doc-review when host capability and explicit dispatch authorization are both present.
- A plain `$spec-doc-review` request still runs the document-review workflow, but defaults to single-agent report-only fallback on a gated Codex host.
- Callers get an explicit coverage note and `dispatch_authorization_missing` when review degrades because authorization is absent.

## When to Apply

- When porting CE workflows that use persona subagents into spec-first.
- When writing Codex-specific workflow prose around `spawn_agent`.
- When deciding whether an explicit workflow invocation should count as authorization for host-level agent dispatch.
- When adding fallback behavior for hosts or sessions where dispatch is unavailable.

## Examples

### Better dispatch rule

```markdown
Dispatch agents using bounded parallelism with the platform's subagent primitive.
Respect the current harness's active-subagent limit.
Treat active-agent/thread/concurrency-limit spawn errors as backpressure, not reviewer failure.
```

### Current Codex boundary

```markdown
A direct `$spec-doc-review` invocation alone is not an explicit `spawn_agent` authorization.
Fallback with `dispatch_authorization_missing` unless the request or parent handoff explicitly asks for subagents, personas, delegated review, or parallel agents.
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
