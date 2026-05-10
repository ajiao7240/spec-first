# Agent-Native Architecture Checklists

Use this reference when the user asks to design or review an agent-native architecture, or when another route needs a checklist-based pass before implementation. It is a reference index item, not a separate public entry surface.

## Architecture Review Checklist

When designing an agent-native system, verify these **before implementation**:

### Core Principles
- [ ] **Parity:** Every UI action has a corresponding agent capability
- [ ] **Granularity:** Tools are primitives; features are prompt-defined outcomes
- [ ] **Composability:** New features can be added via prompts alone
- [ ] **Emergent Capability:** Agent can handle open-ended requests in your domain

### Tool Design
- [ ] **Dynamic vs Static:** For external APIs where agent should have full access, use Dynamic Capability Discovery
- [ ] **CRUD Completeness:** Every entity has create, read, update, AND delete
- [ ] **Primitives not Workflows:** Tools enable capability, don't encode business logic
- [ ] **API as Validator:** Use `z.string()` inputs when the API validates, not `z.enum()`

### Files & Workspace
- [ ] **Shared Workspace:** Agent and user work in same data space
- [ ] **context.md Pattern:** Agent reads/updates context file for accumulated knowledge
- [ ] **File Organization:** Entity-scoped directories with consistent naming

### Agent Execution
- [ ] **Completion Signals:** Agent has explicit `complete_task` tool (not heuristic detection)
- [ ] **Partial Completion:** Multi-step tasks track progress for resume
- [ ] **Context Limits:** Designed for bounded context from the start

### Context Injection
- [ ] **Available Resources:** System prompt includes what exists (files, data, types)
- [ ] **Available Capabilities:** System prompt documents tools with user vocabulary
- [ ] **Dynamic Context:** Context refreshes for long sessions (or provide `refresh_context` tool)

### UI Integration
- [ ] **Agent -> UI:** Agent changes reflect in UI (shared service, file watching, or event bus)
- [ ] **No Silent Actions:** Agent writes trigger UI updates immediately
- [ ] **Capability Discovery:** Users can learn what agent can do

### Mobile (if applicable)
- [ ] **Checkpoint/Resume:** Handle iOS app suspension gracefully
- [ ] **iCloud Storage:** iCloud-first with local fallback for multi-device sync
- [ ] **Cost Awareness:** Model tier selection (Haiku/Sonnet/Opus)

**When designing architecture, explicitly address each checkbox in your plan.**

## Anti-Patterns

### Common Approaches That Aren't Fully Agent-Native

These aren't necessarily wrong; they may be appropriate for your use case. But they're worth recognizing as different from the architecture this document describes.

**Agent as router** — The agent figures out what the user wants, then calls the right function. The agent's intelligence is used to route, not to act. This can work, but you're using a fraction of what agents can do.

**Build the app, then add agent** — You build features the traditional way, then expose them to an agent. The agent can only do what your features already do. You won't get emergent capability.

**Request/response thinking** — Agent gets input, does one thing, returns output. This misses the loop: agent gets an outcome to achieve, operates until it's done, handles unexpected situations along the way.

**Defensive tool design** — You over-constrain tool inputs because you're used to defensive programming. Strict enums and validation at every layer can be safe, but they prevent the agent from doing things you didn't anticipate.

**Happy path in code, agent just executes** — Traditional software handles edge cases in code. Agent-native lets the agent handle edge cases with judgment. If your code handles all the edge cases, the agent is just a caller.

### Specific Anti-Patterns

**THE CARDINAL SIN: Agent executes your code instead of figuring things out**

```typescript
// WRONG - You wrote the workflow, agent just executes it
tool("process_feedback", async ({ message }) => {
  const category = categorize(message);
  const priority = calculatePriority(message);
  await store(message, category, priority);
  if (priority > 3) await notify();
});

// RIGHT - Agent figures out how to process feedback
tools: store_item, send_message
prompt: "Rate importance 1-5 based on actionability, store feedback, notify if >= 4"
```

**Workflow-shaped tools** — `analyze_and_organize` bundles judgment into the tool. Break it into primitives and let the agent compose them.

**Context starvation** — Agent doesn't know what resources exist in the app.

```text
User: "Write something about Catherine the Great in my feed"
Agent: "What feed? I don't understand what system you're referring to."
```

Fix: Inject available resources, capabilities, and vocabulary into system prompt.

**Orphan UI actions** — User can do something through the UI that the agent can't achieve. Fix: maintain parity.

**Silent actions** — Agent changes state but UI doesn't update. Fix: Use shared data stores with reactive binding, or file system observation.

**Heuristic completion detection** — Detecting agent completion through heuristics is fragile. Fix: Require agents to explicitly signal completion through a `complete_task` tool.

**Static tool mapping for dynamic APIs** — Building one tool per API endpoint loses flexibility.

```typescript
// WRONG - Every API type needs a hardcoded tool
tool("read_steps", ...)
tool("read_heart_rate", ...)
tool("read_sleep", ...)

// RIGHT - Dynamic capability discovery
tool("list_available_types", ...)
tool("read_health_data", { dataType: z.string() }, ...)
```

**Incomplete CRUD** — Agent can create but not update or delete. Fix: every entity needs full CRUD.

**Sandbox isolation** — Agent works in a separate data space from the user. Fix: use a shared workspace where both operate on the same files.

**Gates without reason** — Domain tool is the only way to do something, and you didn't intend to restrict access. Keep primitives available unless there's a specific reason to gate.

**Artificial capability limits** — Restricting what the agent can do out of vague safety concerns rather than specific risks. The agent should generally be able to do what users can do.

## Success Criteria

You've built an agent-native application when:

### Architecture
- [ ] The agent can achieve anything users can achieve through the UI (parity)
- [ ] Tools are atomic primitives; domain tools are shortcuts, not gates (granularity)
- [ ] New features can be added by writing new prompts (composability)
- [ ] The agent can accomplish tasks you didn't explicitly design for (emergent capability)
- [ ] Changing behavior means editing prompts, not refactoring code

### Implementation
- [ ] System prompt includes dynamic context about app state
- [ ] Every UI action has a corresponding agent tool (action parity)
- [ ] Agent tools are documented in system prompt with user vocabulary
- [ ] Agent and user work in the same data space (shared workspace)
- [ ] Agent actions are immediately reflected in the UI
- [ ] Every entity has full CRUD (Create, Read, Update, Delete)
- [ ] Agents explicitly signal completion (no heuristic detection)
- [ ] `context.md` or equivalent for accumulated knowledge

### Product
- [ ] Simple requests work immediately with no learning curve
- [ ] Power users can push the system in unexpected directions
- [ ] You're learning what users want by observing what they ask the agent to do
- [ ] Approval requirements match stakes and reversibility

### Mobile (if applicable)
- [ ] Checkpoint/resume handles app interruption
- [ ] iCloud-first storage with local fallback
- [ ] Background execution uses available time wisely
- [ ] Model tier matched to task complexity

### The Ultimate Test

Describe an outcome to the agent that's within your application's domain but that you didn't build a specific feature for.

Can it figure out how to accomplish it, operating in a loop until it succeeds?

If yes, you've built something agent-native.

If it says "I don't have a feature for that", your architecture is still too constrained.
