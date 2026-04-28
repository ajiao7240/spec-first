---
name: spec-doc-review
description: Review requirements, plan, or task-pack documents using parallel persona agents that surface role-specific issues. Use when a requirements document, plan document, or derived task pack exists and the user wants to improve it.
argument-hint: "[mode:headless] [path/to/document.md]"
---

# Document Review

Review requirements, plan, or task-pack documents through multi-persona analysis. Dispatches specialized reviewer agents in parallel, auto-applies `safe_auto` fixes, and routes remaining findings through a four-option interaction (per-finding walk-through, Auto-resolve with best judgment, Append-to-Open-Questions, Report-only) for user decision.

## Invocation Boundary

`spec-doc-review` is a workflow orchestrator, not an agent type. Do not invoke it through Agent/Task/subagent primitives. Use the host workflow entrypoint instead: Claude users call `/spec:doc-review <path>`; Codex users call `$spec-doc-review <path>`; nested workflow callers execute the workflow inline in the current orchestrator. This workflow may dispatch persona agents during Phase 2, but the workflow itself is not one of those agents.

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

After reading, classify the document:
- **requirements** -- from `docs/brainstorms/`, focuses on what to build and why
- **plan** -- from `docs/plans/`, focuses on how to build it with implementation details
- **task-pack** -- from `docs/tasks/` or frontmatter `type: task-pack`, focuses on whether a derived execution input remains faithful to its source plan and is safe for `spec-work`

For task-pack review, verify that it is derived rather than a second plan:

- it points to exactly one repo-relative `source_plan`,
- it uses `Task Pack Contract` as the machine-readable source,
- it does not add scope, acceptance criteria, non-goals, public contracts, or implementation decisions absent from the source plan,
- `files`, `context_refs`, `test_focus`, `done_signal`, `risk_note`, and `stop_if` reduce execution context without turning into micro-implementation steps,
- dependency and wave claims are plausible from file ownership and shared surfaces,
- deterministic identity/freshness issues belong to `spec-first tasks validate --json`, while semantic task quality remains reviewer judgment.

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

### Dispatch

Dispatch all agents in **parallel** using the platform's subagent primitive (e.g., `Agent` in Claude Code or `spawn_agent` in Codex). Omit the `mode` parameter so the user's configured permission settings apply. Each agent receives the prompt built from the subagent template included below with these variables filled:

| Variable | Value |
|----------|-------|
| `{persona_file}` | Full content of the agent's markdown file |
| `{schema}` | Content of the findings schema included below |
| `{document_type}` | "requirements", "plan", or "task-pack" from Phase 1 classification |
| `{document_path}` | Path to the document |
| `{document_content}` | Full text of the document |
| `{decision_primer}` | Cumulative prior-round decisions in the current session, or an empty `<prior-decisions>` block on round 1. See "Decision primer" below. |

Pass each agent the **full document** — do not split into sections.

### Decision primer

On round 1 (no prior decisions), set `{decision_primer}` to:

```
<prior-decisions>
Round 1 — no prior decisions.
</prior-decisions>
```

On round 2+ (after one or more prior rounds in the current interactive session), accumulate prior-round decisions and render them as:

```
<prior-decisions>
Round 1 — applied (N entries):
- {section}: "{title}" ({reviewer}, {confidence})
  Evidence: "{evidence_snippet}"

Round 1 — rejected (M entries):
- {section}: "{title}" — Skipped because {reason}
  Evidence: "{evidence_snippet}"
- {section}: "{title}" — Deferred to Open Questions because {reason or "no reason provided"}
  Evidence: "{evidence_snippet}"
- {section}: "{title}" — Acknowledged without applying because {reason or "no suggested_fix — user acknowledged"}
  Evidence: "{evidence_snippet}"

Round 2 — applied (N entries):
...
</prior-decisions>
```

Each entry carries an `Evidence:` line because synthesis R29 (rejected-finding suppression) and R30 (fix-landed verification) both use an evidence-substring overlap check as part of their matching predicate — without the evidence snippet in the primer, the orchestrator cannot compute the `>50%` overlap test and has to fall back to fingerprint-only matching, which either re-surfaces rejected findings or suppresses too aggressively. The `{evidence_snippet}` is the first evidence quote from the finding, truncated to the first ~120 characters (preserving whole words at the boundary) and with internal quotes escaped. If a finding has multiple evidence entries, use the first one; the rest live in the run artifact and are not needed for the overlap check.

Accumulate across all rounds in the current session. Skip, Defer, and Acknowledge actions all count as "rejected" for suppression purposes — each signals the user decided the finding wasn't worth actioning this round (Acknowledge is the no-fix-guard variant: the user saw a finding with no `suggested_fix`, chose not to defer or skip explicitly, and recorded acknowledgement instead; for round-to-round suppression that is semantically equivalent to Skip). Applied findings stay on the applied list so round-N+1 personas can verify fixes landed (see R30 in `references/synthesis-and-presentation.md`).

Cross-session persistence is out of scope. A new invocation of spec-doc-review on the same document starts with a fresh round 1 and no carried primer, even if prior sessions deferred findings into the document's Open Questions section.

**Error handling:** If an agent fails or times out, proceed with findings from agents that completed. Note the failed agent in the Coverage section. Do not block the entire review on a single agent failure.

**Dispatch limit:** Even at maximum (7 agents), use parallel dispatch. These are document reviewers with bounded scope reading a single document -- parallel is safe and fast.

## Phases 3-5: Synthesis, Presentation, and Next Action

After all dispatched agents return, read `references/synthesis-and-presentation.md` for the synthesis pipeline (validate, anchor-based gate, dedup, cross-persona agreement promotion, resolve contradictions, auto-promotion, route by three tiers with FYI subsection), `safe_auto` fix application, headless-envelope output, and the handoff to the routing question.

For the four-option routing question and per-finding walk-through (interactive mode), read `references/walkthrough.md`. For the bulk-action preview used by Auto-resolve with best judgment, Append-to-Open-Questions, and walk-through `Auto-resolve with best judgment on the rest`, read `references/bulk-preview.md`. Do not load these files before agent dispatch completes.

---

## Included References

### Subagent Template

@./references/subagent-template.md

### Findings Schema

@./references/findings-schema.json
