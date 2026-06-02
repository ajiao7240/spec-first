---
name: spec-slack-research
description: "Search Slack for interpreted organizational context -- decisions, constraints, and discussion arcs that shape the current task. Produces a research digest with cross-cutting analysis and research-value assessment, not raw message lists. Use when searching Slack for context during planning, brainstorming, or any task where organizational knowledge matters. Trigger phrases: 'search slack for', 'what did we discuss about', 'slack context for', 'organizational context about', 'what does the team think about', 'any slack discussions on'. Differs from slack:find-discussions which returns individual message results without synthesis."
---

# spec-slack-research

Search Slack for organizational context and receive an interpreted research digest.

## Workflow Contract Summary

### When To Use

Use when planning, brainstorming, or implementation needs interpreted Slack context about organizational decisions, constraints, discussion arcs, or stakeholder history.

### When Not To Use

Do not use for generic web research, code search, direct message dumping, raw Slack result lists, or when Slack access is unavailable and no organizational context is needed.

### Inputs

Topic/question, optional Slack modifiers, workspace/search results from the Slack-capable researcher, thread context, and provenance dates/channels.

### Outputs

An interpreted Slack research digest with workspace identifier, research-value assessment, findings by topic, and cross-cutting analysis.

### Artifacts

No repo-local artifact by default; the returned digest is the workflow output and should summarize rather than paste raw Slack messages.

### Failure Modes

No topic, Slack MCP unavailable/auth expired, no relevant discussions, insufficient thread context, or privacy/sensitivity constraints.

### Workflow

Clarify the topic if needed, dispatch the Slack researcher, let it search/read/synthesize, then relay the digest or access failure without alternative scraping.

### Downstream Consumers

`spec-brainstorm`, `spec-plan`, `spec-work`, stakeholder alignment, and human decision makers needing organizational context.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

## Usage

```
spec-slack-research [topic or question]
spec-slack-research
```

## Examples

```
spec-slack-research free trial
spec-slack-research What did we say about free trial recently?
spec-slack-research free trial in #proj-reverse-trial
spec-slack-research onboarding flow after:<YYYY-MM-DD>
```

The input can be a keyword, a natural language question, or include Slack search modifiers like channel hints (`in:#channel`) and date filters (`after:YYYY-MM-DD`). The agent extracts the topic and formulates searches from whatever form the input takes.

## Execution

If no argument is provided, ask what topic to research. Use the platform's blocking question tool: `AskUserQuestion` in Claude Code (call `ToolSearch` with `select:AskUserQuestion` first if its schema isn't loaded) or `request_user_input` in Codex. Fall back to asking in plain text only when no blocking tool exists in the harness or the call errors (e.g., Codex edit modes) — not because a schema load is required. Never silently skip the question.

Dispatch `spec-slack-researcher` with the user's topic as the task prompt. Omit the `mode` parameter so the user's configured permission settings apply.

The agent handles everything from here -- Slack MCP discovery, search execution, thread reads, and synthesis. It returns a digest with:

- **Workspace identifier** so the user can verify the correct Slack instance was searched
- **Research-value assessment** (high / moderate / low / none) with justification
- **Findings organized by topic** with source channels and dates
- **Cross-cutting analysis** surfacing patterns across findings

If the agent reports that Slack is unavailable (MCP not connected or auth expired), relay the message to the user. Do not attempt alternative research methods.
