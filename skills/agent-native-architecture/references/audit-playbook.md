# Agent-Native Audit Playbook

This playbook is the full-codebase audit adapter for `agent-native-architecture`. It is not a standalone public workflow or skill entrypoint. Read it only when an upstream workflow explicitly needs a broad agent-native architecture audit.

## Adapter Contract

| Field | Contract |
|---|---|
| Owner | `agent-native-architecture` source package |
| Entry | Reference-only adapter; no public command, standalone skill, or direct runtime route |
| Mutation | Read-only analysis; no file edits, runtime regeneration, or hidden implementation |
| Dispatcher | Upstream workflow/orchestrator only, with explicit dispatch authorization for subagents |
| Fallback | Sequential current-agent audit when dispatch is unavailable, disabled, unsafe, or unauthorized |
| Evidence | Source refs required for confirmed scores; docs-only or generated-runtime-only refs degrade |

## When To Use

- A bounded upstream workflow asks for a full-codebase agent-native architecture audit.
- The task needs scored coverage across UI actions, agent tools, prompts, context injection, and shared workspace behavior.
- A single principle audit is requested, such as action parity or shared workspace.

## When Not To Use

- To audit skill source quality, workflow boundaries, eval readiness, or runtime governance. Use `spec-skill-audit` for that.
- To review an ordinary PR/diff for agent parity. Use `spec-code-review` and its `spec-agent-native-reviewer`.
- To replace `agent-native-architecture` as the canonical taxonomy.
- To run hidden implementation or mutation work. This playbook is read-only analysis guidance.

## Inputs

- A bounded app/codebase scope from an upstream workflow.
- Source refs for UI actions, agent tools, prompt construction, context injection, data stores, and UI update paths.
- Optional host dispatch capability for parallel read-only exploration.

## Outputs

- A scored audit report with each applicable lens, source-backed findings, recommendations, confidence, limitations, and next action.
- For each finding, include `finding`, `evidence/source_ref`, `taxonomy_mapping`, `score_or_status`, `recommendation`, `confidence`, `limitation`, and `recommended_next_action`.
- If the input is out of scope or evidence is missing, return `not_applicable` or `degraded` with the reason rather than inventing a score.

## Failure Modes

- Missing app/codebase scope makes scores generic and should degrade confidence.
- No agent integration means the top finding is the absence of agent-native surface; do not fabricate tool parity.
- Missing dispatch capability requires sequential current-agent audit, not failure.
- Source refs that only cover docs or generated runtime mirrors are insufficient for confirmed findings.

## Handoff

- Skill/source quality problems hand off to `spec-skill-audit`.
- PR/diff parity problems hand off to `spec-code-review`.
- Architecture planning or implementation work hands off to `spec-plan` or `spec-work`.
- Runtime/tool readiness gaps hand off to `spec-mcp-setup`.

## Audit Lenses

Use the canonical taxonomy from `skills/agent-native-architecture/SKILL.md` as the source spine. The labels below are audit-specific adapters; do not treat them as a second canonical taxonomy.

Adapter map:

- **Action Parity** maps to **Action parity**.
- **Tools as Primitives** maps to **Primitive tools**.
- **Context Injection** maps to **Context injection**.
- **Shared Workspace** maps to **Shared workspace**.
- **CRUD Completeness** maps to **Action parity** and **Primitive tools** for complete entity outcomes.
- **UI Integration** maps to **Shared workspace**.
- **Capability Discovery** maps to **Context injection** and **Prompt-native features**.
- **Prompt-Native Features** maps to **Prompt-native features**.

1. **Action Parity** - "Whatever the user can do, the agent can do"
2. **Tools as Primitives** - "Tools provide capability, not behavior"
3. **Context Injection** - "System prompt includes dynamic context about app state"
4. **Shared Workspace** - "Agent and user work in the same data space"
5. **CRUD Completeness** - "Every entity has full CRUD (Create, Read, Update, Delete)"
6. **UI Integration** - "Agent actions immediately reflected in UI"
7. **Capability Discovery** - "Users can discover what the agent can do"
8. **Prompt-Native Features** - "Features are prompts defining outcomes, not code"

## Workflow

### Step 1: Load Source Context

First, read `skills/agent-native-architecture/SKILL.md` and the relevant files under `skills/agent-native-architecture/references/`.

When the audit needs the action parity reference path, read `skills/agent-native-architecture/references/action-parity-discipline.md` directly instead of depending on a numbered intake-menu option.

### Step 2: Run Principle Audits

Launch 8 parallel read-only subagents when the host exposes a dispatch primitive and the current request explicitly authorizes subagents, delegated work, parallel agents, or persona-style dispatch. Use the platform's subagent primitive (`Agent` with `subagent_type: Explore` in Claude Code or `spawn_agent` with `agent_type: "explorer"` in Codex), one for each principle.

If dispatch is unavailable, explicitly disabled, or unsafe, or if dispatch is not authorized by the current host/request boundary, run the eight principle audits sequentially in the current agent and state that sequential fallback in the report.

Subagents are read-only explorers. They inspect code and return findings; the orchestrator owns the final scored report. Keep parallelism bounded to these eight principles and do not spawn nested agents from leaf audits.

Each audit should:

1. Enumerate relevant instances in the codebase: user actions, tools, contexts, data stores, prompts, or UI update mechanisms.
2. Check compliance against the principle and canonical taxonomy mapping.
3. Provide a specific score such as `X/Y (percentage%)` when the denominator is source-backed.
4. List specific gaps and recommendations with source refs.

## Principle Prompts

### Agent 1: Action Parity

```text
Audit for ACTION PARITY - "Whatever the user can do, the agent can do."

Tasks:
1. Enumerate all user actions in frontend/API surfaces:
   - Search for API service files, fetch calls, form handlers, button clicks, and form submissions.
   - Check routes and components for user interactions.
2. Check which have corresponding agent tools:
   - Search for agent tool definitions.
   - Map user actions to agent capabilities.
3. Score: "Agent can do X out of Y user actions."

Format:
## Action Parity Audit
### User Actions Found
| Action | Location | Agent Tool | Status |
### Score: X/Y (percentage%)
### Missing Agent Tools
### Recommendations
```

### Agent 2: Tools as Primitives

```text
Audit for TOOLS AS PRIMITIVES - "Tools provide capability, not behavior."

Tasks:
1. Find and read all agent tool files.
2. Classify each as:
   - PRIMITIVE: read, write, store, list, or another capability without business judgment.
   - WORKFLOW: encodes business logic, makes decisions, or orchestrates steps.
3. Score: "X out of Y tools are proper primitives."

Format:
## Tools as Primitives Audit
### Tool Analysis
| Tool | File | Type | Reasoning |
### Score: X/Y (percentage%)
### Problematic Tools
### Recommendations
```

### Agent 3: Context Injection

```text
Audit for CONTEXT INJECTION - "System prompt includes dynamic context about app state."

Tasks:
1. Find context injection code.
2. Read agent prompts and system messages.
3. Enumerate what is injected vs what should be:
   - Available resources.
   - User preferences/settings.
   - Recent activity.
   - Available capabilities.
   - Session history.
   - Workspace state.

Format:
## Context Injection Audit
### Context Types Analysis
| Context Type | Injected? | Location | Notes |
### Score: X/Y (percentage%)
### Missing Context
### Recommendations
```

### Agent 4: Shared Workspace

```text
Audit for SHARED WORKSPACE - "Agent and user work in the same data space"

Tasks:
1. Identify data stores, tables, models, or file roots.
2. Check whether agents read/write to the same data space as users.
3. Look for sandbox isolation anti-patterns.

Format:
## Shared Workspace Audit
### Data Store Analysis
| Data Store | User Access | Agent Access | Shared? |
### Score: X/Y (percentage%)
### Isolated Data
### Recommendations
```

### Agent 5: CRUD Completeness

```text
Audit for CRUD COMPLETENESS - "Every entity has full CRUD."

Tasks:
1. Identify app entities/models.
2. For each entity, check whether agent tools can create, read, update, and delete.
3. Score per entity and overall.

Format:
## CRUD Completeness Audit
### Entity CRUD Analysis
| Entity | Create | Read | Update | Delete | Score |
### Overall Score: X/Y entities with full CRUD (percentage%)
### Incomplete Entities
### Recommendations
```

### Agent 6: UI Integration

```text
Audit for UI INTEGRATION - "Agent actions immediately reflected in UI."

Tasks:
1. Check how agent writes or changes propagate to frontend.
2. Look for streaming updates, polling, shared state, event buses, or file watching.
3. Identify silent actions where agent changes state but UI does not update.

Format:
## UI Integration Audit
### Agent Action To UI Update Analysis
| Agent Action | UI Mechanism | Immediate? | Notes |
### Score: X/Y (percentage%)
### Silent Actions
### Recommendations
```

### Agent 7: Capability Discovery

```text
Audit for CAPABILITY DISCOVERY - "Users can discover what the agent can do."

Tasks:
1. Check for discovery mechanisms:
   - Onboarding flow showing agent capabilities.
   - Help documentation.
   - Capability hints in UI.
   - Agent self-description in responses.
   - Suggested prompts/actions.
   - Empty state guidance.
   - Slash commands such as /help or /tools.
2. Score against confirmed mechanisms.

Format:
## Capability Discovery Audit
### Discovery Mechanism Analysis
| Mechanism | Exists? | Location | Quality |
### Score: X/Y (percentage%)
### Missing Discovery
### Recommendations
```

### Agent 8: Prompt-Native Features

```text
Audit for PROMPT-NATIVE FEATURES - "Features are prompts defining outcomes, not code."

Tasks:
1. Read agent prompts.
2. Classify each feature/behavior as:
   - PROMPT: outcomes defined in natural language.
   - CODE: business logic hardcoded.
3. Check whether behavior changes require prompt edits or code changes.

Format:
## Prompt-Native Features Audit
### Feature Definition Analysis
| Feature | Defined In | Type | Notes |
### Score: X/Y (percentage%)
### Code-Defined Features
### Recommendations
```

## Summary Report Template

```markdown
## Agent-Native Architecture Review: [Project Name]

### Overall Score Summary

| Core Principle | Score | Percentage | Status |
|----------------|-------|------------|--------|
| Action Parity | X/Y | Z% | excellent/partial/needs-work |
| Tools as Primitives | X/Y | Z% | excellent/partial/needs-work |
| Context Injection | X/Y | Z% | excellent/partial/needs-work |
| Shared Workspace | X/Y | Z% | excellent/partial/needs-work |
| CRUD Completeness | X/Y | Z% | excellent/partial/needs-work |
| UI Integration | X/Y | Z% | excellent/partial/needs-work |
| Capability Discovery | X/Y | Z% | excellent/partial/needs-work |
| Prompt-Native Features | X/Y | Z% | excellent/partial/needs-work |

Overall Agent-Native Score: X%

### Top 10 Recommendations by Impact

| Priority | Action | Principle | Effort |
|----------|--------|-----------|--------|

### What's Working Well

[List top strengths.]

### Limitations

[List missing evidence, degraded checks, unavailable dispatch, or scope constraints.]
```

## Success Criteria

- All 8 principle audits complete, whether via parallel subagents or sequential current-agent fallback.
- Each applicable principle has a source-backed score or an explicit `not_applicable` / `degraded` reason.
- Summary table shows all scores and status labels.
- Top recommendations are prioritized by impact.
- Report identifies both strengths and gaps.
- The report distinguishes confirmed source evidence from advisory assumptions.

## Optional Single-Principle Audit

If the upstream task specifies a single principle, only run that principle audit and provide detailed findings for that principle.

Valid arguments:

- `action parity` or `1`
- `tools`, `primitives`, or `2`
- `context`, `injection`, or `3`
- `shared`, `workspace`, or `4`
- `crud` or `5`
- `ui`, `integration`, or `6`
- `discovery` or `7`
- `prompt`, `features`, or `8`
