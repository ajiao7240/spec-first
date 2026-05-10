---
name: spec-doc-review
description: Review requirements, plan, or task-pack documents using persona reviewers that surface role-specific issues. When reviewer dispatch is available, run bounded parallel reviewers; when dispatch is unavailable, explicitly disabled, or unsafe, fall back to a single-agent report-only review instead of bypassing host boundaries.
argument-hint: "[mode:headless] [path/to/document.md]"
---

# Document Review

Review requirements, plan, or task-pack documents through multi-persona analysis. When the host exposes a reviewer dispatch primitive, dispatch specialized reviewer agents with bounded parallelism by default, auto-apply `safe_auto` fixes, and route remaining findings through a four-option interaction (per-finding walk-through, Auto-resolve with best judgment, Append-to-Open-Questions, Report-only) for user decision. When reviewer dispatch is unavailable, explicitly disabled by the user, or unsafe for the current runtime, run the single-agent report-only fallback described in Phase 2 so the workflow still returns review findings without violating host boundaries.

## Workflow Contract Summary

### When To Use

Use to review requirements, plans, or task packs for coherence, feasibility, scope, risk, and downstream execution readiness.

### When Not To Use

Do not use for code diff review, implementing fixes as a work run, filing issues without an explicit route, or treating a task pack as an independent source plan.

### Inputs

A requirements, plan, or task-pack document path; optional `mode:headless`; repository instructions, source-document links, document frontmatter, and review persona context.

### Outputs

Persona-reviewed findings with severity, confidence-first anchor, recommended action, applied `safe_auto` fixes when allowed, structured headless output when requested, and a terminal `Review complete` signal.

### Artifacts

The reviewed document may be edited for accepted fixes or Open Questions append entries. No repo-local JSON run artifact is promised; headless callers consume the structured text envelope and any concrete document edits.

### Failure Modes

Missing headless document path, unreadable document, dispatch unavailable/disabled/unsafe, reviewer timeout/failure, Open Questions append failure, or no actionable findings. Fall back to single-agent report-only when dispatch is not safe and surface append failures through Retry/Fall back/Convert-to-Skip handling.

### Workflow

Detect mode and document type, select reviewer personas, dispatch with bounded parallelism or fall back, synthesize findings, apply allowed fixes, then route or return the final review envelope.

### Downstream Consumers

`spec-plan`, `spec-work`, task-pack validation/rebuild decisions, human document owners, and code-review handoffs when document findings imply implementation risk.

## Invocation Boundary

`spec-doc-review` is a workflow orchestrator, not an agent type. Do not invoke it through Agent/Task/subagent primitives. Use the current host's document-review entrypoint instead; nested workflow callers execute the workflow inline in the current orchestrator. This workflow may dispatch persona agents during Phase 2, but the workflow itself is not one of those agents.

## Interactive mode rules

- **Pre-load the platform question tool before any question fires.** In Claude Code, `AskUserQuestion` is a deferred tool — its schema is not available at session start. At the start of Interactive-mode work (before the routing question, per-finding walk-through questions, bulk-preview Proceed/Cancel, and Phase 5 terminal question), call `ToolSearch` with query `select:AskUserQuestion` to load the schema. Load it once, eagerly, at the top of the Interactive flow — do not wait for the first question site. On Codex this preload is not required.
- **The numbered-list fallback applies only when the harness genuinely lacks a blocking question tool** — `ToolSearch` returns no match, the tool call explicitly fails, or the runtime mode does not expose it (e.g., Codex edit modes where `request_user_input` is unavailable). A pending schema load is not a fallback trigger; call `ToolSearch` first per the pre-load rule. In genuine-fallback cases, present options as a numbered list and wait for the user's reply — never silently skip the question. Rendering a question as narrative text because the tool feels inconvenient, because the model is in report-formatting mode, or because the instruction was buried in a long skill is a bug. A question that calls for a user decision must either fire the tool or fall back loudly.

## Phase 0: Detect Mode

Check the workflow arguments for `mode:headless`. Arguments may contain a document path, `mode:headless`, or both. Tokens starting with `mode:` are flags, not file paths — strip them from the arguments and use the remaining token (if any) as the document path for Phase 1.

If `mode:headless` is present, set **headless mode** for the rest of the workflow.

**Headless mode** changes the interaction model, not the classification boundaries. spec-doc-review still applies the same judgment about which tier each finding belongs in. The only difference is how non-safe_auto findings are delivered:

- `safe_auto` fixes are applied silently (same as interactive)
- `gated_auto`, `manual`, and FYI findings are returned as structured text for the caller to handle — no blocking-question prompts, no interactive routing
- Phase 5 returns immediately with "Review complete" (no routing question, no terminal question)

The caller receives findings with their original classifications intact and decides what to do with them.

Callers invoke headless mode by including `mode:headless` in the workflow arguments, e.g.:

```
/spec:doc-review mode:headless docs/plans/my-plan.md
$spec-doc-review mode:headless docs/plans/my-plan.md
```

If `mode:headless` is not present, the workflow runs in its default interactive mode with the routing question, walk-through, and bulk-preview behaviors documented in `references/walkthrough.md` and `references/bulk-preview.md`.

## Phase 1: Get and Analyze Document

**If a document path is provided:** Read it, then proceed.

**If no document is specified (interactive mode):** Ask which document to review, or find the most recent in `docs/brainstorms/` or `docs/plans/` using a file-search/glob tool (e.g., Glob in Claude Code).

**If no document is specified (headless mode):** Output "Review failed: headless mode requires a document path. Re-invoke the spec-doc-review workflow with: `mode:headless <path>`." without dispatching agents.

### Classify Document Type

After reading, classify the document by **content shape first**, with path/frontmatter as supporting evidence:

- **requirements** -- focuses on what to build and why; typical signals include `## Requirements`, actors, key flows, acceptance examples, problem framing, or scope boundaries without implementation units
- **plan** -- focuses on how to build it; typical signals include `## Implementation Units`, `## Key Technical Decisions`, `## System-Wide Impact`, `## Risks & Dependencies`, or implementation file/test lists
- **task-pack** -- from frontmatter `type: task-pack`, `docs/tasks/`, or a `Task Pack Contract` block; focuses on whether a derived execution input remains faithful to its source plan and is safe for `spec-work`

Path is a hint, not the source of truth: a copied plan outside `docs/plans/` is still a plan, and a task-pack with valid frontmatter is still a task-pack even if its filename is unusual. Also extract the frontmatter `origin:` value when present. Store it as `Origin`; if missing, set `Origin: none`.

For task-pack review, verify that it is derived rather than a second plan:

- it points to exactly one repo-relative `source_plan`,
- it uses `Task Pack Contract` as the machine-readable source,
- it does not add scope, acceptance criteria, non-goals, public contracts, or implementation decisions absent from the source plan,
- `files`, `context_refs`, `test_focus`, `done_signal`, `risk_note`, and `stop_if` reduce execution context without turning into micro-implementation steps,
- dependency and wave claims are plausible from file ownership and shared surfaces,
- deterministic identity/freshness issues belong to `spec-first tasks validate --json`, while semantic task quality remains reviewer judgment.

For plan documents with `Origin` set, do not routinely re-review the upstream WHAT/WHY. Review the plan's faithfulness, execution readiness, architectural choices, risk treatment, and whether it introduces new scope or strategic/architecture risks not present in the origin. Re-open WHAT/WHY only when the plan itself adds a new product claim, expands scope, or changes the origin's intent.

### Select Conditional Personas

Analyze the document content to determine which conditional personas to activate. Check for these signals:

**product-lens** -- activate when the document makes challengeable claims about what to build and why, or when the proposed work carries strategic weight beyond the immediate problem. The system's users may be end users, developers, operators, maintainers, or any other audience -- the criteria are domain-agnostic. Check for either leg:

*Leg 1 — Premise claims:* The document stakes a position on what to build or why that a knowledgeable stakeholder could reasonably challenge -- not merely describing a task or restating known requirements:
- Problem framing where the stated need is non-obvious or debatable, not self-evident from existing context
- Solution selection where alternatives plausibly exist (implicit or explicit)
- Prioritization decisions that explicitly rank what gets built vs deferred
- Goal statements that predict specific user outcomes, not just restate constraints or describe deliverables

*Leg 2 — Strategic weight:* The proposed work could affect system trajectory, user perception, or competitive positioning, even if the premise is sound:
- Changes that shape how the system is perceived or what it becomes known for
- Complexity or simplicity bets that affect adoption, onboarding, or cognitive load
- Work that opens or closes future directions (path dependencies, architectural commitments)
- Opportunity cost implications -- building this means not building something else

**design-lens** -- activate when the document contains:
- UI/UX references, frontend components, or visual design language
- User flows, wireframes, screen/page/view mentions
- Interaction descriptions (forms, buttons, navigation, modals)
- References to responsive behavior or accessibility

**security-lens** -- activate when the document contains:
- Auth/authorization mentions, login flows, session management
- API endpoints exposed to external clients
- Data handling, PII, payments, tokens, credentials, encryption
- Third-party integrations with trust boundary implications

**scope-guardian** -- activate when the document contains:
- Multiple priority tiers (P0/P1/P2, must-have/should-have/nice-to-have)
- Large requirement count (>8 distinct requirements or implementation units)
- Stretch goals, nice-to-haves, or "future work" sections
- Scope boundary language that seems misaligned with stated goals
- Goals that don't clearly connect to requirements

**adversarial** -- activate when the document contains:
- More than 5 distinct requirements or implementation units
- Explicit architectural or scope decisions with stated rationale
- High-stakes domains (auth, payments, data migrations, external integrations)
- Proposals of new abstractions, frameworks, or significant architectural patterns

## Phase 2: Announce and Dispatch Personas

### Announce the Review Team

Tell the user which personas will review and why. For conditional personas, include the justification:

```
Reviewing with:
- spec-coherence-reviewer (always-on)
- spec-feasibility-reviewer (always-on)
- spec-scope-guardian-reviewer -- plan has 12 requirements across 3 priority levels
- spec-security-lens-reviewer -- plan adds API endpoints with auth flow
```

### Build Agent List

Always include:
- `spec-coherence-reviewer`
- `spec-feasibility-reviewer`

Add activated conditional personas:
- `spec-product-lens-reviewer`
- `spec-design-lens-reviewer`
- `spec-security-lens-reviewer`
- `spec-scope-guardian-reviewer`
- `spec-adversarial-document-reviewer`

### Dispatch Capability Gate

Before dispatching any reviewer, confirm the current host exposes a dispatch primitive and the selected reviewers are part of this documented document-review phase. Dispatch capability is part of the runtime boundary, not a reviewer-selection preference.

- A direct invocation of the current host's document-review workflow entrypoint authorizes this documented persona-reviewer phase; do not ask for a second "use subagents" confirmation.
- Default doc-review posture is multi-persona reviewer dispatch. Do not interpret the absence of extra "use subagents" wording as report-only fallback; the workflow entrypoint already expresses that intent.
- If the user explicitly requested subagents, parallel agents, delegated review, or persona reviewer dispatch and the host exposes a dispatch primitive, continue with normal bounded multi-persona dispatch.
- If an active workflow or parent orchestrator explicitly delegated this doc-review workflow, continue with normal bounded multi-persona dispatch.
- If the user explicitly requests report-only/no-agents mode, the host lacks a dispatch primitive, or the current runtime cannot call it, do not call `Agent`, `Task`, `spawn_agent`, or equivalent dispatch tools.
- Codex supports reviewer dispatch through `spawn_agent`; do not downgrade solely because the host is Codex.

When dispatch is unavailable, explicitly disabled, or unsafe, set `single_agent_report_only_fallback: true` and run a read-only review in the current orchestrator:

- Treat the effective mode as report-only, even if no `mode:report-only` token was provided.
- Do not apply `safe_auto` fixes, append Open Questions, or edit the document.
- Use the selected persona list as an inline checklist, preserving the same classification boundaries where possible.
- Skip the routing question, walk-through, and bulk-preview flow.
- In Coverage, state `single-agent report-only fallback: reviewer dispatch unavailable, explicitly disabled, or unsafe`.

### Dispatch

Dispatch agents using **bounded parallelism** with the platform's subagent primitive (e.g., `Agent` in Claude Code or `spawn_agent` in Codex). Omit the `mode` parameter so the user's configured permission settings apply. Respect the current harness's active-subagent limit: queue selected reviewers, dispatch only as many as the harness accepts, and fill freed slots as reviewers complete. Treat active-agent/thread/concurrency-limit spawn errors as backpressure, not reviewer failure: leave the reviewer queued and retry after a slot frees. Record a reviewer as failed only after a successful dispatch times out/fails, or when dispatch fails for a non-capacity reason.

Each agent receives the prompt built from the subagent template included below with these variables filled:

| Variable | Value |
|----------|-------|
| `{persona_file}` | Full content of the agent's markdown file |
| `{schema}` | Content of the findings schema included below |
| `{document_type}` | "requirements", "plan", or "task-pack" from Phase 1 classification |
| `{origin}` | Frontmatter `origin:` value when present, otherwise `none` |
| `{document_path}` | Path to the document |
| `{document_content}` | Full text of the document |
| `{decision_primer}` | Cumulative prior-round decisions in the current session, or an empty `<prior-decisions>` block on round 1. See "Decision primer" below. |

Pass each agent the **full document** — do not split into sections.

### Decision Primer

Before dispatch, read `references/decision-primer.md` and build `{decision_primer}` from that contract. The primer is the only cross-round memory for the current interactive invocation: round 1 sends the empty prior-decision block, while round 2+ summarizes prior Apply / Skip / Defer / Acknowledge decisions with evidence snippets so synthesis can suppress rejected re-raises and verify applied fixes. Do not persist the primer across sessions.

**Error handling:** If an agent fails or times out, proceed with findings from agents that completed. Note the failed agent in the Coverage section. Do not block the entire review on a single agent failure.

**Dispatch limit:** Even at maximum (7 agents), use bounded parallel dispatch. These are document reviewers with bounded scope reading a single document -- parallel is safe and fast when the host allows it. If the harness cap is lower than the selected team size, queue the remainder and launch them as active reviewers complete.

## Phases 3-5: Synthesis, Presentation, and Next Action

After all dispatched agents return, read `references/synthesis-and-presentation.md` for the synthesis pipeline (validate, anchor-based gate, dedup, cross-persona agreement promotion, resolve contradictions, auto-promotion, route by three tiers with FYI subsection), `safe_auto` fix application, headless-envelope output, and the handoff to the routing question.

For the four-option routing question and per-finding walk-through (interactive mode), read `references/walkthrough.md`. For the bulk-action preview used by Auto-resolve with best judgment, Append-to-Open-Questions, and walk-through `Auto-resolve with best judgment on the rest`, read `references/bulk-preview.md`. Do not load these files before agent dispatch completes.

---

## Included References

### Subagent Template

@./references/subagent-template.md

### Findings Schema

@./references/findings-schema.json
