# User Next-Step Guide Mode

Use this reference when the user explicitly asks what to run next, which `spec-first` command to use, which workflow applies, or says they do not know the next step.

In repositories whose active `CLAUDE.md` / `AGENTS.md` `spec-first:lang` block sets English, use the same three fields as `Recommended entrypoint`, `Reason`, and `Next action`. The next action should be a copy-ready workflow invocation or a short continuation phrase such as "reply `continue` to run it now". Do not start the selected workflow from guide mode unless the user explicitly asks to continue with that workflow.

Use the Routing Priority and Routing Rules in `skills/using-spec-first/SKILL.md` as the source of truth. Use the exact current-host public entrypoint those rules select.

## High-Confidence Guide Cases

High-confidence guide cases may recommend without confirmation after naming the chosen route:

- clear failures, stack traces, or test failures -> debug
- clear code, PR, diff, requirements, plan, or markdown review requests -> code review or doc review based on the artifact
- clear setup, host readiness, MCP, update, or runtime repair requests -> setup or update based on the repair target
- existing plan, task pack, or implementation-ready task -> work

## Low-Confidence Guide Cases

Low-confidence cases need one narrow confirmation before routing:

- idea generation vs requirement shaping vs execution planning is unclear
- a change could be either a bug fix or a product behavior change
- the user may need a durable artifact, but it is not clear whether that artifact should be requirements, a plan, tasks, or review notes
- a workflow just finished, but its handoff context is unavailable or conflicts with the new request

## After A Workflow

When the user asks "what next?" after a workflow:

- If an active workflow has an explicit handoff, follow that workflow's handoff.
- If a brainstorm requirements document exists and implementation direction is not yet planned, recommend plan.
- If a plan or validated task pack exists and the work is implementation-ready, recommend work.
- If there is an existing diff and the user asks whether it is ready, recommend code review or doc review based on the artifact.
- After init, prefer setup/readiness guidance only when the user asks about setup/readiness, missing runtime assets, MCP setup, or a workflow is blocked by unavailable tools.
- After init, when runtime or MCP readiness is unresolved but the user has a clear lightweight docs, small-code, plan, work, or review goal, route by that goal and require the selected workflow to disclose degraded setup/MCP evidence when relevant.
