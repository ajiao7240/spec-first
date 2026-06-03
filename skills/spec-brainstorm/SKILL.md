---
name: spec-brainstorm
description: 'Explore requirements and approaches through collaborative dialogue before writing a right-sized requirements document and planning implementation. Use for feature ideas, problem framing, when the user says ''let''s brainstorm'', or when they want to think through options before deciding what to build. Also use when a user describes a vague or ambitious feature request, asks ''what should we build'', ''help me think through X'', presents a problem with multiple valid solutions, or seems unsure about scope or direction — even if they don''t explicitly ask to brainstorm.'
argument-hint: "[feature idea or problem to explore]"
---

# Brainstorm a Feature or Improvement

Use the current host/session date when dating requirements documents. If the date is unavailable, read it with a deterministic command; do not hard-code calendar years in this source file.

Brainstorming helps answer **WHAT** to build through collaborative dialogue. It precedes the current host's plan entrypoint, which answers **HOW** to build it.

The durable output of this workflow is a **requirements document**. In other workflows this might be called a lightweight PRD or feature brief. In spec-first, keep the workflow name `brainstorm`, but make the written artifact strong enough that planning does not need to invent product behavior, scope boundaries, or success criteria.

This skill does not implement code. It explores, clarifies, and documents decisions for later planning or execution.

**IMPORTANT: All file references in generated documents must use repo-relative paths (e.g., `src/models/user.rb`), never absolute paths. Absolute paths break portability across machines, worktrees, and teammates.**

## Workflow Contract Summary

### When To Use

Use when product behavior, problem framing, user goals, success criteria, or scope boundaries are still open enough that planning would otherwise invent WHAT to build.

### When Not To Use

Do not use for settled implementation work, code debugging, document/code review, setup/update/runtime repair, or narrow factual questions that can be answered directly.

### Inputs

A feature idea, problem statement, vague improvement request, existing brainstorm document, relevant repo/product context, and user decisions gathered one question at a time.

### Outputs

A right-sized requirements document or brief alignment summary that captures user-facing behavior, goals, non-goals, risks, and planning handoff context.

### Artifacts

Requirements or brainstorm documents under `docs/brainstorms/` when durable handoff is useful. Generated runtime mirrors are not source artifacts for brainstorm output.

### Failure Modes

Missing feature description, unresolved product choice after reasonable questioning, non-software topic needing the universal flow, or a request that is already execution-ready and should route downstream.

### Workflow

Assess scope and domain, ask focused questions, synthesize options and decisions, write the durable requirements artifact when useful, then hand off to planning.

### Downstream Consumers

`spec-plan`, human product owners, document reviewers, and future work/review flows that need stable WHAT/WHY context.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

## Core Principles

1. **Assess scope first** - Match the amount of ceremony to the size and ambiguity of the work.
2. **Be a thinking partner** - Suggest alternatives, challenge assumptions, and explore what-ifs instead of only extracting requirements.
3. **Resolve product decisions here** - User-facing behavior, scope boundaries, and success criteria belong in this workflow. Detailed implementation belongs in planning.
4. **Keep implementation out of the requirements doc by default** - Do not include libraries, schemas, endpoints, file layouts, or code-level design unless the brainstorm itself is inherently about a technical or architectural change.
5. **Right-size the artifact** - Simple work gets a compact requirements document or brief alignment. Larger work gets a fuller document. Do not add ceremony that does not help planning.
6. **Apply YAGNI to carrying cost, not coding effort** - Prefer the simplest approach that delivers meaningful value. Avoid speculative complexity and hypothetical future-proofing, but low-cost polish or delight is worth including when its ongoing cost is small and easy to maintain.

## Interaction Rules

These rules apply to every brainstorm, including the universal (non-software) flow routed to `references/universal-brainstorming.md`.

1. **Ask one question at a time** - One question per turn, even when sub-questions feel related. Stacking several questions in a single message produces diluted answers; pick the single most useful one and ask it.
2. **Prefer single-select multiple choice** - Use single-select when choosing one direction, one priority, or one next step.
3. **Use multi-select rarely and intentionally** - Use it only for compatible sets such as goals, constraints, non-goals, or success criteria that can all coexist. If prioritization matters, follow up by asking which selected item is primary.
4. **Default to the platform's blocking question tool** - Use `AskUserQuestion` in Claude Code (call `ToolSearch` with `select:AskUserQuestion` first if its schema isn't loaded) or `request_user_input` in Codex. These tools include a free-text fallback (e.g., "Other" in Claude Code), so options scaffold the answer without confining it — well-chosen options surface dimensions the user may not have separated, and pick-plus-optional-note is lower activation energy than composing prose from scratch. This default holds for opening and elicitation questions too, not only narrowing. Fall back to numbered options in chat only when no blocking tool exists in the harness or the call errors (e.g., Codex edit modes) — not because a schema load is required. Never silently skip the question.
5. **Use prose only when the question is genuinely open** - Drop the blocking tool only when (a) the answer is inherently narrative ("walk me through how you got here"), (b) the question is diagnostic or introspective and presented options would leak your priors and bias the answer (e.g., "what concerns you most?" where a 4-option menu signals which axes matter), or (c) you cannot write 3-4 genuinely distinct, plausibly-correct options that cover the space without padding or strawmen. The test: if you'd be straining to fill the option slots, the question is open — use prose. Rule 1 still applies: still one question per turn.

## Output Guidance

- **Keep outputs concise** - Prefer short sections, brief bullets, and only enough detail to support the next decision.
- **Use repo-relative paths** - When referencing files, use paths relative to the repo root (e.g., `src/models/user.rb`), never absolute paths. Absolute paths make documents non-portable across machines and teammates.

## Domain Language And Decision Ledger

When the idea involves domain terminology, team-specific concepts, or ADR-like choices, consume existing context before asking questions that repo/docs can answer: already-loaded project standards and host instructions, `docs/contracts/`, existing brainstorms/plans/solutions, and any repo-local glossary or ADR-like artifacts that actually exist. If `CONCEPTS.md` exists, treat it as repo-local advisory vocabulary for naming consistency only: it is not a PRD, ADR, workflow contract, source-of-truth override, or setup requirement. Read `AGENTS.md` / `CLAUDE.md` source only under `docs/contracts/context-governance.md`'s Host Instruction Reuse Policy, not as a default domain-context step. Do not require a fixed `CONTEXT.md`, `CONCEPTS.md`, `docs/adr/`, or glossary directory. If those artifacts are absent, record the gap as advisory context and continue with the best available evidence.

For major open decisions, carry a lightweight decision note: `question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason` when unresolved. Use source tags such as `confirmed`, `advisory`, `session-local`, `stale`, or `user`. Suggest creating an ADR-like artifact only when the decision is hard to reverse, would be surprising without context, and reflects a real tradeoff.

## External-Tool Context

Use only lightweight read-only evidence as session-local pointers. Confirm important claims with direct source reads before writing them into requirements. Do not route mutation, refresh, broad impact, or maintenance operations through brainstorm by default. External-tool evidence must not expand product scope or let implementation details back-drive user-facing requirements.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty, ask the user:** "What would you like to explore? Please describe the feature, problem, or improvement you're thinking about."

Do not proceed until you have a feature description from the user.

## Execution Flow

### Phase 0: Resume, Assess, and Route

#### 0.1 Resume Existing Work When Appropriate

If the user references an existing brainstorm topic or document, or there is an obvious recent matching `*-requirements.md` file in `docs/brainstorms/`:
- Read the document
- Confirm with the user before resuming: "Found an existing requirements doc for [topic]. Should I continue from this, or start fresh?"
- If resuming, summarize the current state briefly, continue from its existing decisions and outstanding questions, and update the existing document instead of creating a duplicate

#### 0.1b Classify Task Domain

Before proceeding to Phase 0.2, classify whether this is a software task. The key question is: **does the task involve building, modifying, or architecting software?** -- not whether the task *mentions* software topics.

**Software** (continue to Phase 0.2) -- the task references code, repositories, APIs, databases, or asks to build/modify/debug/deploy software.

**Non-software brainstorming** (route to universal brainstorming) -- BOTH conditions must be true:
- None of the software signals above are present
- The task describes something the user wants to explore, decide, or think through in a non-software domain

**Neither** (respond directly, skip all brainstorming phases) -- the input is a quick-help request, error message, factual question, or single-step task that doesn't need a brainstorm.

**If non-software brainstorming is detected:** Read `references/universal-brainstorming.md` and use those facilitation principles. Skip Phases 0.2–4 below — the **Core Principles and Interaction Rules above still apply unchanged**, including one-question-per-turn and the default to the platform's blocking question tool.

#### 0.2 Assess Whether Brainstorming Is Needed

**Clear requirements indicators:**
- Specific acceptance criteria provided
- Referenced existing patterns to follow
- Described exact expected behavior
- Constrained, well-defined scope

**If requirements are already clear:**
Keep the interaction brief. Confirm understanding and present concise next-step options rather than forcing a long brainstorm. Only write a short requirements document when a durable handoff to planning or later review would be valuable. Skip Phase 1.1 and 1.2 entirely — go straight to Phase 1.3 or Phase 2.5 in announce-mode (synthesis emitted for visibility, no blocking confirmation), then to Phase 3.

#### 0.3 Assess Scope

Use the feature description plus a light repo scan to classify the work:
- **Lightweight** - small, well-bounded, low ambiguity
- **Standard** - normal feature or bounded refactor with some decisions to make
- **Deep** - cross-cutting, strategic, or highly ambiguous

If the scope is unclear, ask one targeted question to disambiguate and then proceed.

**Deep sub-mode: feature vs product.** For Deep scope, also classify whether the brainstorm must establish product shape or inherit it:

- **Deep — feature** (default): existing product shape anchors decisions. Primary actors, core outcome, positioning, and primary flows are already established in the product or repo. The brainstorm extends or refines within that shape.
- **Deep — product**: the brainstorm must establish product shape rather than inherit it. Primary actors, core outcome, positioning against adjacent products, or primary end-to-end flows are materially unresolved. Existing code lowers the odds of product-tier but does not by itself rule it out — a half-built tool with ambiguous shape is still product-tier.

Product-tier triggers additional Phase 1.2 questions and additional sections in the requirements document. Feature-tier uses the current Deep behavior unchanged.

### Phase 1: Understand the Idea

#### 1.1 Existing Context Scan

Scan the repo before substantive brainstorming. Match depth to scope:

**Lightweight** — Search for the topic, check if something similar already exists, and move on.

**Standard and Deep** — Two passes:

*Constraint Check* — Use already-loaded host/project instructions first for workflow, product, or scope constraints that affect the brainstorm. Read `AGENTS.md` / `CLAUDE.md` source only when `docs/contracts/context-governance.md`'s Host Instruction Reuse Policy allows it, such as a user-named path, missing/stale loaded context, source/runtime governance work, or a directory-scoped instruction file that may govern the topic. If a source read is needed, record the reason briefly; if loaded instructions add nothing, move on. When the topic plausibly has prior art in `docs/solutions/`, scan it for prior problem framing and decision rationale — not implementation steps; this evidence must not let implementation details back-drive user-facing requirements.

*Topic Scan* — Search for relevant terms. Read the most relevant existing artifact if one exists (brainstorm, plan, spec, skill, feature doc). Skim adjacent examples covering similar behavior.

If nothing obvious appears after a short scan, say so and continue. Two rules govern technical depth during the scan:

1. **Verify before claiming** — When the brainstorm touches checkable infrastructure (database tables, routes, config files, dependencies, model definitions), read the relevant source files to confirm what actually exists. Any claim that something is absent — a missing table, an endpoint that doesn't exist, a dependency not in the Gemfile, a config option with no current support — must be verified against the codebase first; if not verified, label it as an unverified assumption. This applies to every brainstorm regardless of topic.

2. **Defer design decisions to planning** — Implementation details like schemas, migration strategies, endpoint structure, or deployment topology belong in planning, not here — unless the brainstorm is itself about a technical or architectural decision, in which case those details are the subject of the brainstorm and should be explored.

**Slack context** (opt-in, Standard and Deep only) — never auto-dispatch. Route by condition:

- **Tools available + user asked**: Dispatch `spec-slack-researcher` with a brief summary of the brainstorm topic alongside Phase 1.1 work. Incorporate findings into constraint and context awareness.
- **Tools available + user didn't ask**: Note in output: "Slack tools detected. Ask me to search Slack for organizational context at any point, or include it in your next prompt."
- **No tools + user asked**: Note in output: "Slack context was requested but no Slack tools are available. Install and authenticate the Slack plugin to enable organizational context search."

**Codebase context** (software brainstorms only) — requirements shaping is about WHAT, not implementation proof. When a technical or architecture brainstorm needs current repo orientation, use bounded direct source reads, `rg`, ast-grep when useful, package/test facts, logs, and user-provided evidence. Confirm important claims with direct source reads before writing them into requirements. Codebase evidence must not expand product scope or let implementation details back-drive user-facing requirements.

#### 1.2 Product Pressure Test

Before generating approaches, scan the user's opening for rigor gaps. Match depth to scope.

This is agent-internal analysis, not a user-facing checklist. Read the opening, note which gaps actually exist, and raise only those as questions during Phase 1.3 — folded into the normal flow of dialogue, not fired as a pre-flight gauntlet. A fuzzy opening may earn three or four probes; a concrete, well-framed one may earn zero because no scope-appropriate gaps were found.

**Lightweight:**
- Is this solving the real user problem?
- Are we duplicating something that already covers this?
- Is there a clearly better framing with near-zero extra cost?

**Standard — scan for these gaps:**

- **Evidence gap.** The opening asserts want or need, but doesn't point to anything the would-be user has already done — time spent, money paid, workarounds built — that would make the want observable. When present, ask for the most concrete thing someone has already done about this. For engineering evolution of an existing product or system (actors and positioning already settled), this gap is N/A by default — the product's existence already answers "does anyone want this"; raise it only when the change's own value is doubtful (e.g., a knob nobody will turn).

- **Specificity gap.** The opening describes the beneficiary at a level of abstraction where the agent couldn't design without silently inventing who they are and what changes for them. When present, ask the user to name a specific person or narrow segment, and what changes for that person when this ships.

- **Counterfactual gap.** The opening doesn't make visible what users do today when this problem arises, nor what changes if nothing ships. When present, ask what the current workaround is, even if it's messy — and what it costs them. Same N/A-by-default rule for engineering-evolution brainstorms: the relevant counterfactual is the current technical behavior, not user market behavior.

- **Attachment gap.** The opening treats a particular solution shape as the thing being built, rather than the value that shape is supposed to deliver, and hasn't been examined against smaller forms that might deliver the same value. When present, ask what the smallest version that still delivers real value would look like.

Plus these synthesis questions — not gap lenses, product-judgment the agent weighs in its own reasoning:
- Is there a nearby framing that creates more user value without more carrying cost? If so, what complexity does it add?
- Given the current project state, user goal, and constraints, what is the single highest-leverage move right now: the request as framed, a reframing, one adjacent addition, a simplification, or doing nothing?

Favor moves that compound value, reduce future carrying cost, or make the product meaningfully more useful or compelling. Use the result to sharpen the conversation, not to bulldoze the user's intent.

**Deep** — Standard lenses and synthesis questions plus:
- Is this a local patch, or does it move the broader system toward where it wants to be?

**Deep — product** — Deep plus:

- **Durability gap.** The opening's value proposition rests on a current state of the world that may shift in predictable ways within the horizon the user cares about. When present, ask how the idea fares under the most plausible near-term shifts — and push past rising-tide answers every competitor could make.

- What adjacent product could we accidentally build instead, and why is that the wrong one?
- What would have to be true in the world for this to fail?

These questions force an explicit product thesis and feed the Scope Boundaries subsections ("Deferred for later" and "Outside this product's identity") and Dependencies / Assumptions in the requirements document.

#### 1.3 Collaborative Dialogue

Follow the Interaction Rules above. Use the platform's blocking question tool when available.

**Guidelines:**
- Ask what the user is already thinking before offering your own ideas. This surfaces hidden context and prevents fixation on AI-generated framings.
- Start broad (problem, users, value) then narrow (constraints, exclusions, edge cases)
- **Rigor probes fire before Phase 2 and are prose, not menus.** Narrowing is legitimate, but Phase 1 cannot end with un-probed rigor gaps. Each scope-appropriate gap from Phase 1.2 fires as a **separate** direct prose probe — one probe satisfies one gap, not multiple. Standard brainstorms scan up to four gap lenses (evidence, specificity, counterfactual, attachment); for engineering-evolution work, evidence and counterfactual are N/A by default (see 1.2), so the mandatory probes typically converge on specificity and attachment. Deep-product adds durability (five total), but only the gaps actually present in the opening must be probed. Surface those probes progressively across the conversation — interleaving with narrowing moves is fine, as long as every scope-appropriate gap that was found in Phase 1.2 has been probed in prose before Phase 2. Rigor probes map to Interaction Rule 5(b): a 4-option menu signals which kinds of evidence count and lets the user pick rather than produce. Prose forces them to produce real observation or surface their uncertainty. Examples (one per gap): *evidence — "What's the most concrete thing someone's already done about this — paid, built a workaround, quit a tool over it?"* / *specificity — "Can you name a team you've actually watched hit this, or are you reasoning?"* / *counterfactual — "What do teams do today when this breaks — who reconciles?"* / *attachment — "Before we move to shapes or approaches — what's the smallest version that would still prove the bet right, and what's excluded?"* — **attachment is the final rigor probe before Phase 2 when the attachment gap is present. Fire it regardless of whether a specific shape has emerged through narrowing; its job is to pressure-test the user's implicit framing of the product before Phase 2 inherits it** / *durability — "Under the most plausible near-term shifts, how does this bet hold?"* If the answer reveals genuine uncertainty, record it as an explicit assumption in the requirements document rather than skipping the probe.
- Clarify the problem frame, validate assumptions, and ask about success criteria
- Make requirements concrete enough that planning will not need to invent behavior
- Surface dependencies or prerequisites only when they materially affect scope
- Resolve product decisions here; leave technical implementation choices for planning
- Bring ideas, alternatives, and challenges instead of only interviewing
- **Pair decision and narrowing questions with your recommended answer** — when asking the user to pick a direction, priority, scope boundary, or next step, say what you'd choose and why before they answer. This makes your reasoning visible and lets them correct your priors instead of composing from scratch; it pairs naturally with the blocking tool's options (Rule 4). Do **not** attach a recommendation to the opening "what are you already thinking" question (it would fixate the user on an AI framing, contra the first guideline above) or to any prose-only diagnostic/introspective question or rigor probe (Rule 5 / Phase 1.2) — there a suggested answer signals which axes matter and biases the response.
- **Track open decision branches** — treat the dialogue as a decision tree and resolve dependencies in order: answer a parent decision before the children it gates. If a branch is answerable from the codebase, read it instead of asking. For Standard and Deep brainstorms, record each *material* unresolved branch in the decision ledger with a `deferred_reason` (see Domain Language And Decision Ledger above) so it survives outside working memory; Lightweight brainstorms can track branches in-conversation without ledger ceremony. The ledger holds major open decisions, not every minor sub-question.

**Exit condition:** Continue until the idea is clear OR the user explicitly wants to proceed. Before exiting, check for unresolved branches — `deferred_reason` ledger notes for Standard/Deep, or in-conversation tracking for Lightweight — and carry them into the requirements document rather than dropping them silently, following the same routing as Inferred bets in Phase 2.5: `## Key Decisions` in interactive mode, `## Assumptions` in headless mode.

### Phase 2: Explore Approaches

If multiple plausible directions remain, propose **2-3 concrete approaches** based on research and conversation. Otherwise state the recommended direction directly.

Use at least one non-obvious angle — inversion (what if we did the opposite?), constraint removal (what if X weren't a limitation?), or analogy from how another domain solves this. The first approaches that come to mind are usually variations on the same axis.

Present approaches first, then evaluate. Let the user see all options before hearing which one is recommended — leading with a recommendation before the user has seen alternatives anchors the conversation prematurely.

When useful, include one deliberately higher-upside alternative:
- Identify what adjacent addition or reframing would most increase usefulness, compounding value, or durability without disproportionate carrying cost. Present it as a challenger option alongside the baseline, not as the default. Omit it when the work is already obviously over-scoped or the baseline request is clearly the right move.

At product tier, alternatives should differ on *what* is built (product shape, actor set, positioning), not *how* it is built. Implementation-variant alternatives belong at feature tier.

For each approach, provide:
- Brief description (2-3 sentences)
- Pros and cons
- Key risks or unknowns
- When it's best suited

**Approach granularity: mechanism / product shape, not architecture.** Approach descriptions name mechanism-level distinctions and product-relevant trade-offs, not implementation specifics. Do not name column names, table names, file paths, service classes, JSON shapes, exact method names, or other code-level details unless the brainstorm itself is explicitly about a technical architecture decision. Detailed implementation belongs in `spec-plan`; leaking it into brainstorm forces planning decisions onto shallow product-context research.

After presenting all approaches, state your recommendation and explain why. Prefer simpler solutions when added complexity creates real carrying cost, but do not reject low-cost, high-value polish just because it is not strictly necessary.

If one approach is clearly best and alternatives are not meaningful, skip the menu and state the recommendation directly.

If relevant, call out whether the choice is:
- Reuse an existing pattern
- Extend an existing capability
- Build something net new

### Phase 2.5: Synthesis Summary

**STOP. Before composing the synthesis, read `references/synthesis-summary.md`.** The prose-summary requirement, internal three-bucket draft, chat-time scoping shape, anti-pattern guidance, soft-cut behavior, self-redirect support, prose-feedback rules, and routing into requirements doc sections all live there. Composing a synthesis without these rules loaded produces malformed output such as missing prose summaries, implementation-detail leakage, and proposal-pitch wording.

Surface a synthesis to the user before Phase 3 writes the requirements doc. This is the user's last low-cost opportunity to correct scope before the durable artifact lands.

Fires for **all tiers** including Lightweight. Skip Phase 2.5 entirely on the Phase 0.1b non-software route that uses `references/universal-brainstorming.md`.

**Headless mode** (pipeline / `disable-model-invocation`): compose the synthesis but do not ask for confirmation. Inferred bets route to a `## Assumptions` section in the doc so downstream review can scrutinize them as unvalidated assumptions, not confirmed decisions.

**Announce-mode (Phase 0.2 fast path):** on the "requirements already clear" fast path, Phase 2.5 fires in announce-mode: compose the internal Stated / Inferred / Out-of-scope draft, emit only the compressed Path A "What we're building" / "Proposing" shape for visibility, then end the turn. Do not write the requirements doc in the same turn as the synthesis emission. On the user's next message, proceed to Phase 3 doc-write if it is an acknowledgment, follow-up, or non-correcting input; if it corrects scope, revise and re-emit the synthesis.

### Phase 3: Capture the Requirements

Write or update a requirements document only when the conversation produced durable decisions worth preserving. Read `references/brainstorm-sections.md` for the format-independent content contract, then read `references/requirements-capture.md` for the concrete canonical markdown template and readiness gate.

Read `references/markdown-rendering.md` before writing the canonical markdown requirements document. Markdown remains the source artifact for `spec-plan`, document review, and future handoff. If a future run explicitly produces an HTML companion, read `references/html-rendering.md` and treat that file as an optional sidecar only; do not replace the markdown requirements document without focused downstream consumer tests.

For **Lightweight** brainstorms, keep the document compact. Skip document creation when the user only needs brief alignment and no durable decisions need to be preserved.

### Phase 4: Handoff

Present next-step options and execute the user's selection. Read `references/handoff.md` for the option logic, dispatch instructions, and closing summary format.
