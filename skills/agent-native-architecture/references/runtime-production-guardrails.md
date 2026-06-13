# Runtime Production Guardrails

Use this reference when an agent-native design moves from prototype guidance into production behavior. It is provider-neutral: OpenAI, MCP, GitHub, LangGraph, and other provider docs are useful design pressure, but spec-first contracts should encode durable guardrail concepts instead of provider-shaped fields.

Provider notes are advisory pressure, not spec-first contract fields.

## External facts and social sources

- Treat X/Twitter, social-media discourse, provider blogs, and third-party commentary as advisory pressure until direct fetch evidence is available.
- State fetch, robots.txt, paywall, or network limitations before using recent external discourse in architecture guidance.
- Do not turn inaccessible social-media claims or provider-specific field names into spec-first contract fields.

## Workspace authority and sandbox boundaries

- Define which workspace paths, data stores, APIs, and runtime resources the agent may read or mutate.
- Separate explicit user-requested actions from unsolicited autonomy.
- Treat sandbox output as scoped evidence until source, tests, logs, or user confirmation prove it is safe to promote.
- Keep generated runtime mirrors out of the source-edit path unless a setup/update workflow explicitly owns regeneration.

## Least privilege

- Grant only the tools, credentials, network routes, and filesystem access needed for the current task class.
- Prefer narrow tool descriptions and input schemas that preserve agent judgment without opening unrelated authority.
- Make elevated authority explicit and revocable.

## Secret redaction

- Do not expose secrets, tokens, private keys, or sensitive environment values in prompts, logs, traces, or eval fixtures.
- Redact before writing artifacts or review reports.
- Verify that tool outputs intended for model context exclude credential-bearing fields.

## Network and firewall posture

- State whether the agent can reach the public internet, private services, package registries, or only allowlisted endpoints.
- Record degraded-mode behavior when network access is unavailable or blocked.
- Avoid claiming provider firewalls or sandboxes remove the need for application-level authorization.

## Approval by stakes and reversibility

- Auto-apply only low-stakes, easily reversible actions.
- Use quick confirmation for low-stakes but hard-to-reverse actions.
- Preview high-stakes reversible actions before applying.
- Require explicit approval for high-stakes hard-to-reverse actions such as sending external messages, payments, destructive data changes, or production deploys.

## Audit logs and tracing

- Record who or what requested the action, which tools ran, what changed, and what evidence proved completion.
- Keep traces useful for debugging without leaking secrets or unnecessary personal data.
- Preserve reason codes for degraded evidence, skipped verification, approval decisions, and rollback.

## Checkpoints and rollback

- Create a checkpoint before destructive, high-stakes, or self-modifying changes.
- Define the rollback path before applying changes, not after failure.
- Prefer git commits, durable snapshots, migration rollback scripts, or provider-native checkpoints when they match the system boundary.

## Completion semantics

- Give agents explicit completion signals for multi-step work.
- Do not infer completion from silence, timeout, or absence of more tool calls.
- Record partial completion and resume state when a task can be interrupted.

## Human-in-the-loop escalation

- Escalate when the action exceeds declared authority, touches ambiguous user intent, requires irreversible external side effects, or conflicts with a policy/source boundary.
- Surface the smallest decision the human must make, with preview evidence and consequences.
- Treat a missing approval primitive as degraded runtime capability, not as permission to proceed silently.

## Eval gates

- Add boundary cases for trigger routing, authority limits, approvals, failure modes, rollback, provider-neutrality, and generated-runtime confusion.
- Keep eval fixtures focused on expected behavior and forbidden drift, not a second implementation plan.
- Run fresh-source eval when skill or agent prose changes may be cached by the current host session.
