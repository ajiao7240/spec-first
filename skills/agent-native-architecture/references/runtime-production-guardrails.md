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

## Dimension to workflow application index

| Guardrail dimension | Workflow application | Source refs |
| --- | --- | --- |
| External facts and social sources | `spec-plan` and `spec-code-review` treat recent provider/social claims as advisory evidence pressure, not confirmed source truth, until fetched or confirmed from direct evidence. | `docs/contracts/source-runtime-customization-boundary.md`, `skills/spec-plan/SKILL.md`, `skills/spec-code-review/SKILL.md` |
| Workspace authority and sandbox boundaries | `using-spec-first`, `spec-work`, and `spec-mcp-setup` resolve target repo scope before writes and exclude generated runtime mirrors from ordinary implementation context. | `skills/using-spec-first/SKILL.md`, `skills/spec-work/SKILL.md`, `skills/spec-mcp-setup/SKILL.md` |
| Least privilege | `spec-mcp-setup` and `spec-code-review` keep optional providers/helper dispatch explicit and degrade when runtime authority is missing. | `skills/spec-mcp-setup/SKILL.md`, `skills/spec-code-review/SKILL.md` |
| Secret redaction | `spec-code-review` and closeout helpers avoid raw secrets in evidence refs, reports, and validation artifacts. | `skills/spec-code-review/SKILL.md`, `src/cli/helpers/honest-closeout.js`, `docs/contracts/workflows/review-finding.md` |
| Network and firewall posture | `spec-mcp-setup` reports network/provider degraded-mode facts; downstream workflows keep provider facts advisory. | `skills/spec-mcp-setup/SKILL.md`, `docs/contracts/project-graph-consumption.md` |
| Approval by stakes and reversibility | `spec-work` uses preview-first setup/clean guidance and routes residual review work through explicit user choices. | `skills/spec-work/SKILL.md`, `src/cli/commands/clean.js` |
| Audit logs and tracing | `spec-work` closeout, verification summaries, and quality gates record reason codes, artifact refs, and validation status. | `skills/spec-work/SKILL.md`, `docs/contracts/workflows/spec-work-run-artifact.schema.json`, `scripts/run-ai-dev-quality-gate.js` |
| Checkpoints and rollback | `spec-work`, `git-worktree`, and release/commit workflows use git diffs, branch/worktree boundaries, and rollback-aware handoff before risky changes. | `skills/spec-work/SKILL.md`, `skills/git-worktree/SKILL.md`, `skills/git-commit-push-pr/SKILL.md` |
| Completion semantics | `spec-work` and `spec-code-review` require explicit verification/review residual status before shipping or handoff. | `skills/spec-work/SKILL.md`, `skills/spec-code-review/SKILL.md` |
| Human-in-the-loop escalation | `spec-doc-review`, `spec-code-review`, and `spec-mcp-setup` surface the smallest needed user decision when approval or dispatch primitives are missing. | `skills/spec-doc-review/SKILL.md`, `skills/spec-code-review/SKILL.md`, `skills/spec-mcp-setup/SKILL.md` |
| Eval gates | `spec-skill-audit`, fresh-source eval guidance, and AI dev quality gates test drift boundaries without turning LLM judgment into a hard release scorer. | `skills/spec-skill-audit/SKILL.md`, `docs/contracts/workflows/fresh-source-eval-checklist.md`, `scripts/run-ai-dev-quality-gate.js` |
