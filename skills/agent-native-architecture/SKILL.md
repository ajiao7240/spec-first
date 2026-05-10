---
name: agent-native-architecture
description: Build applications where agents are first-class citizens. Use this skill when designing autonomous agents, creating MCP tools, implementing self-modifying systems, or building apps where features are outcomes achieved by agents operating in a loop.
---

<why_now>
## Why Now

Software agents work reliably now. Claude Code demonstrated that an LLM with access to bash and file tools, operating in a loop until an objective is achieved, can accomplish complex multi-step tasks autonomously.

The surprising discovery: **a really good coding agent is actually a really good general-purpose agent.** The same architecture that lets Claude Code refactor a codebase can let an agent organize your files, manage your reading list, or automate your workflows.

The Claude Code SDK makes this accessible. You can build applications where features aren't code you write—they're outcomes you describe, achieved by an agent with tools, operating in a loop until the outcome is reached.

This opens up a new field: software that works the way Claude Code works, applied to categories far beyond coding.
</why_now>

<core_principles>
## Core Principles

### 1. Parity

**Whatever the user can do through the UI, the agent should be able to achieve through tools.**

This is the foundational principle. Without it, nothing else matters.

Imagine you build a notes app with a beautiful interface for creating, organizing, and tagging notes. A user asks the agent: "Create a note summarizing my meeting and tag it as urgent."

If you built UI for creating notes but no agent capability to do the same, the agent is stuck. It might apologize or ask clarifying questions, but it can't help—even though the action is trivial for a human using the interface.

**The fix:** Ensure the agent has tools (or combinations of tools) that can accomplish anything the UI can do.

This isn't about creating a 1:1 mapping of UI buttons to tools. It's about ensuring the agent can **achieve the same outcomes**. Sometimes that's a single tool (`create_note`). Sometimes it's composing primitives (`write_file` to a notes directory with proper formatting).

**The discipline:** When adding any UI capability, ask: can the agent achieve this outcome? If not, add the necessary tools or primitives.

A capability map helps:

| User Action | How Agent Achieves It |
|-------------|----------------------|
| Create a note | `write_file` to notes directory, or `create_note` tool |
| Tag a note as urgent | `update_file` metadata, or `tag_note` tool |
| Search notes | `search_files` or `search_notes` tool |
| Delete a note | `delete_file` or `delete_note` tool |

**The test:** Pick any action a user can take in your UI. Describe it to the agent. Can it accomplish the outcome?

---

### 2. Granularity

**Prefer atomic primitives. Features are outcomes achieved by an agent operating in a loop.**

A tool is a primitive capability: read a file, write a file, run a bash command, store a record, send a notification.

A **feature** is not a function you write. It's an outcome you describe in a prompt, achieved by an agent that has tools and operates in a loop until the outcome is reached.

**Less granular (limits the agent):**
```
Tool: classify_and_organize_files(files)
→ You wrote the decision logic
→ Agent executes your code
→ To change behavior, you refactor
```

**More granular (empowers the agent):**
```
Tools: read_file, write_file, move_file, list_directory, bash
Prompt: "Organize the user's downloads folder. Analyze each file,
        determine appropriate locations based on content and recency,
        and move them there."
Agent: Operates in a loop—reads files, makes judgments, moves things,
       checks results—until the folder is organized.
→ Agent makes the decisions
→ To change behavior, you edit the prompt
```

**The key shift:** The agent is pursuing an outcome with judgment, not executing a choreographed sequence. It might encounter unexpected file types, adjust its approach, or ask clarifying questions. The loop continues until the outcome is achieved.

The more atomic your tools, the more flexibly the agent can use them. If you bundle decision logic into tools, you've moved judgment back into code.

**The test:** To change how a feature behaves, do you edit prose or refactor code?

---

### 3. Composability

**With atomic tools and parity, you can create new features just by writing new prompts.**

This is the payoff of the first two principles. When your tools are atomic and the agent can do anything users can do, new features are just new prompts.

Want a "weekly review" feature that summarizes activity and suggests priorities? That's a prompt:

```
"Review files modified this week. Summarize key changes. Based on
incomplete items and approaching deadlines, suggest three priorities
for next week."
```

The agent uses `list_files`, `read_file`, and its judgment to accomplish this. You didn't write weekly-review code. You described an outcome, and the agent operates in a loop until it's achieved.

**This works for developers and users.** You can ship new features by adding prompts. Users can customize behavior by modifying prompts or creating their own. "When I say 'file this,' always move it to my Action folder and tag it urgent" becomes a user-level prompt that extends the application.

**The constraint:** This only works if tools are atomic enough to be composed in ways you didn't anticipate, and if the agent has parity with users. If tools encode too much logic, or the agent can't access key capabilities, composition breaks down.

**The test:** Can you add a new feature by writing a new prompt section, without adding new code?

---

### 4. Emergent Capability

**The agent can accomplish things you didn't explicitly design for.**

When tools are atomic, parity is maintained, and prompts are composable, users will ask the agent for things you never anticipated. And often, the agent can figure it out.

*"Cross-reference my meeting notes with my task list and tell me what I've committed to but haven't scheduled."*

You didn't build a "commitment tracker" feature. But if the agent can read notes, read tasks, and reason about them—operating in a loop until it has an answer—it can accomplish this.

**This reveals latent demand.** Instead of guessing what features users want, you observe what they're asking the agent to do. When patterns emerge, you can optimize them with domain-specific tools or dedicated prompts. But you didn't have to anticipate them—you discovered them.

**The flywheel:**
1. Build with atomic tools and parity
2. Users ask for things you didn't anticipate
3. Agent composes tools to accomplish them (or fails, revealing a gap)
4. You observe patterns in what's being requested
5. Add domain tools or prompts to make common patterns efficient
6. Repeat

This changes how you build products. You're not trying to imagine every feature upfront. You're creating a capable foundation and learning from what emerges.

**The test:** Give the agent an open-ended request relevant to your domain. Can it figure out a reasonable approach, operating in a loop until it succeeds? If it just says "I don't have a feature for that," your architecture is too constrained.

---

### 5. Improvement Over Time

**Agent-native applications get better through accumulated context and prompt refinement.**

Unlike traditional software, agent-native applications can improve without shipping code:

**Accumulated context:** The agent can maintain state across sessions—what exists, what the user has done, what worked, what didn't. A `context.md` file the agent reads and updates is layer one. More sophisticated approaches involve structured memory and learned preferences.

**Prompt refinement at multiple levels:**
- **Developer level:** You ship updated prompts that change agent behavior for all users
- **User level:** Users customize prompts for their workflow
- **Agent level:** The agent modifies its own prompts based on feedback (advanced)

**Self-modification (advanced):** Agents that can edit their own prompts or even their own code. For production use cases, consider adding safety rails—approval gates, automatic checkpoints for rollback, health checks. This is where things are heading.

The improvement mechanisms are still being discovered. Context and prompt refinement are proven. Self-modification is emerging. What's clear: the architecture supports getting better in ways traditional software doesn't.

**The test:** Does the application work better after a month of use than on day one, even without code changes?
</core_principles>

<intake>
## What aspect of agent-native architecture do you need help with?

1. **Design architecture** - Plan a new agent-native system from scratch
2. **Files & workspace** - Use files as the universal interface, shared workspace patterns
3. **Tool design** - Build primitive tools, dynamic capability discovery, CRUD completeness
4. **Domain tools** - Know when to add domain tools vs stay with primitives
5. **Execution patterns** - Completion signals, partial completion, context limits
6. **System prompts** - Define agent behavior in prompts, judgment criteria
7. **Context injection** - Inject runtime app state into agent prompts
8. **Action parity** - Ensure agents can do everything users can do
9. **Self-modification** - Enable agents to safely evolve themselves
10. **Product design** - Progressive disclosure, latent demand, approval patterns
11. **Mobile patterns** - iOS storage, background execution, checkpoint/resume
12. **Testing** - Test agent-native apps for capability and parity
13. **Refactoring** - Make existing code more agent-native

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Action |
|----------|--------|
| 1, "design", "architecture", "plan" | Read `references/architecture-patterns.md` and `references/checklists.md`, then apply the Architecture Review Checklist |
| 2, "files", "workspace", "filesystem" | Read `references/files-universal-interface.md` and `references/shared-workspace-architecture.md` |
| 3, "tool", "mcp", "primitive", "crud" | Read `references/mcp-tool-design.md` |
| 4, "domain tool", "when to add" | Read `references/from-primitives-to-domain-tools.md` |
| 5, "execution", "completion", "loop" | Read `references/agent-execution-patterns.md` |
| 6, "prompt", "system prompt", "behavior" | Read `references/system-prompt-design.md` |
| 7, "context", "inject", "runtime", "dynamic" | Read `references/dynamic-context-injection.md` |
| 8, "parity", "ui action", "capability map" | Read `references/action-parity-discipline.md` |
| 9, "self-modify", "evolve", "git" | Read `references/self-modification.md` |
| 10, "product", "progressive", "approval", "latent demand" | Read `references/product-implications.md` |
| 11, "mobile", "ios", "android", "background", "checkpoint" | Read `references/mobile-patterns.md` |
| 12, "test", "testing", "verify", "validate" | Read `references/agent-native-testing.md` |
| 13, "review", "refactor", "existing" | Read `references/refactoring-to-prompt-native.md` |

**After reading the reference, apply those patterns to the user's specific context.**
</routing>

<quick_start>
## Quick Start: Build an Agent-Native Feature

**Step 1: Define atomic tools**
```typescript
const tools = [
  tool("read_file", "Read any file", { path: z.string() }, ...),
  tool("write_file", "Write any file", { path: z.string(), content: z.string() }, ...),
  tool("list_files", "List directory", { path: z.string() }, ...),
  tool("complete_task", "Signal task completion", { summary: z.string() }, ...),
];
```

**Step 2: Write behavior in the system prompt**
```markdown
## Your Responsibilities
When asked to organize content, you should:
1. Read existing files to understand the structure
2. Analyze what organization makes sense
3. Create/move files using your tools
4. Use your judgment about layout and formatting
5. Call complete_task when you're done

You decide the structure. Make it good.
```

**Step 3: Let the agent work in a loop**
```typescript
const result = await agent.run({
  prompt: userMessage,
  tools: tools,
  systemPrompt: systemPrompt,
  // Agent loops until it calls complete_task
});
```
</quick_start>

<reference_index>
## Reference Files

All references in `references/`:

**Core Patterns:**
- `references/architecture-patterns.md` - Event-driven, unified orchestrator, agent-to-UI
- `references/files-universal-interface.md` - Why files, organization patterns, context.md
- `references/mcp-tool-design.md` - Tool design, dynamic capability discovery, CRUD
- `references/from-primitives-to-domain-tools.md` - When to add domain tools, graduating to code
- `references/agent-execution-patterns.md` - Completion signals, partial completion, context limits
- `references/system-prompt-design.md` - Features as prompts, judgment criteria

**Agent-Native Disciplines:**
- `references/dynamic-context-injection.md` - Runtime context, what to inject
- `references/action-parity-discipline.md` - Capability mapping, parity workflow
- `references/shared-workspace-architecture.md` - Shared data space, UI integration
- `references/product-implications.md` - Progressive disclosure, latent demand, approval
- `references/agent-native-testing.md` - Testing outcomes, parity tests
- `references/checklists.md` - Architecture review checklist, anti-patterns, success criteria

**Platform-Specific:**
- `references/mobile-patterns.md` - iOS storage, checkpoint/resume, cost awareness
- `references/self-modification.md` - Git-based evolution, guardrails
- `references/refactoring-to-prompt-native.md` - Migrating existing code
</reference_index>
