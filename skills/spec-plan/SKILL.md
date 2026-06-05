---
name: spec-plan
description: "Create structured plans for any multi-step task -- software features, research workflows, events, study plans, or any goal that benefits from structured breakdown. Also deepen existing plans with interactive review of sub-agent findings. Use for plan creation when the user says 'plan this', 'create a plan', 'write a tech plan', 'plan the implementation', 'how should we build', 'what's the approach for', 'break this down', 'plan a trip', 'create a study plan', or when a brainstorm/requirements document is ready for planning. Use for plan deepening when the user says 'deepen the plan', 'deepen my plan', 'deepening pass', or uses 'deepen' in reference to a plan. For exploratory or ambiguous requests where the user is unsure what to do, prefer spec-brainstorm first."
argument-hint: "[optional: feature description, requirements doc path, plan path to deepen, or any task to plan]"
---

# Create Technical Plan

Use the current host/session date when dating plans and searching for recent documentation. If the date is unavailable, read it with a deterministic command; do not hard-code calendar years in this source file.

`spec-brainstorm` defines **WHAT** to build. `spec-plan` defines **HOW** to build it. `spec-work` executes the plan. A prior brainstorm is useful context but never required — `spec-plan` works from any input: a requirements doc, a bug report, a feature idea, or a rough description.

**When directly invoked, always plan.** Never classify a direct invocation as "not a planning task" and abandon the workflow. If the input is unclear, ask clarifying questions or use the planning bootstrap (Phase 0.4) to establish enough context — but always stay in the planning workflow.

For software and plan-seeking tasks, this workflow produces a durable implementation or structured plan. For non-software answer-seeking tasks routed through `references/universal-planning.md`, it uses planning as the working scaffold and answers in chat without writing a plan file by default. It does **not** implement code, run tests, or learn from execution-time results. If the answer depends on changing code and seeing what happens, that belongs in `spec-work`, not here.

## Workflow Contract Summary

### When To Use

Use when the desired outcome is clear enough to plan, when a requirements document is ready for implementation planning, or when an existing plan needs a deepening pass.

### When Not To Use

Do not use to implement code, run tests as proof, review a finished document without planning changes, resolve unclear product framing that belongs in `spec-brainstorm`, generate task-pack state, or rewrite generated runtime assets.

### Inputs

A feature/request description, requirements document path, existing plan path to deepen, bug report, rough task description, or non-software planning prompt; optional project standards, package/test context, setup/runtime facts, and nearby source evidence as planning context.

### Outputs

A durable plan document or in-place plan deepening with goals, non-goals, requirements, implementation units, file/test references, sequencing, risks, assumptions, and post-plan handoff options; for non-software answer-seeking tasks, an evidence-grounded chat answer with no plan artifact by default.

### Artifacts

Plan files under the appropriate docs location, reused source-document links, optional doc-review findings or plan-handoff outputs, and no execution-run artifact. Non-software answer-seeking tasks create no durable artifact unless the user asks to save the result.

### Failure Modes

Empty or ambiguous input requires a blocking clarification or planning bootstrap; missing/unreadable source documents are surfaced instead of silently ignored; setup/runtime facts stay advisory; implementation-dependent questions are deferred to `spec-work`.

### Workflow

Resolve source and scope, gather required repo/research context, structure the plan, run confidence/doc-review checks when required, then present the appropriate plan handoff.

### Downstream Consumers

`spec-write-tasks`, `spec-work`, `spec-doc-review`, issue creation, Proof/HITL review paths, and human implementation reviewers.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

## Context Orientation Anchor

Orient from the current user request or requirement, existing plans or task packs, already-loaded host/project instructions, `docs/contracts/`, existing brainstorms/plans/solutions, package manifests and command registries, nearby implementation files, nearby tests, direct source evidence, and git diff or changed files when applicable. Treat `AGENTS.md`, `CLAUDE.md`, and project role docs as host instruction sources that are normally already loaded by the current session, not automatic re-read targets for every planning run. Written project standards from loaded host instructions, directory-scoped equivalents, or precisely read source files may define hard project context when they apply to the planned files; docs and prior plans remain advisory unless the current source plan or user request promotes them to scope authority. Read instruction source only when `docs/contracts/context-governance.md`'s Host Instruction Reuse Policy allows it. External tools may prioritize inspection, but they do not define scope authority. The LLM still chooses the candidate change surface from explicit repo context and source-plan constraints.

Use this intake order for context economy: first read the request/requirements summary and contract metadata, then deterministic inventory or readiness facts, then current phase/task refs, then focused source-of-truth sections, and only then deeper references. Do not create a hidden reviewer facts pipeline; use bounded direct reads, `rg`, ast-grep, git diff, tests/logs, and user evidence.

When sessions, learnings, standards, or prior plans expose provenance-backed rejected/out-of-scope rationale relevant to the current scope, consume those replay refs as advisory boundary evidence before re-opening the same option. Record the source, rationale, and freshness/confidence; do not turn rejected rationale into active workflow state or a permanent blocker.

## Domain Language And Decision Ledger

When planning involves domain terminology, project-specific concepts, architectural options, or ADR-like choices, consume existing context before asking questions that repo/docs can answer: already-loaded project standards and host instructions, `docs/contracts/`, existing brainstorms/plans/solutions, and any repo-local glossary or ADR-like artifacts that actually exist. If `CONCEPTS.md` exists, treat it as repo-local advisory vocabulary for naming consistency only: it is not a PRD, ADR, workflow contract, source-of-truth override, or setup requirement. Read `AGENTS.md` / `CLAUDE.md` source only under the Host Instruction Reuse Policy, not as a default domain-context step. Do not require a fixed `CONTEXT.md`, `CONCEPTS.md`, `docs/adr/`, or glossary directory. If those artifacts are absent, record the gap as advisory context and continue with bounded source evidence.

For major planning decisions, carry a lightweight decision note in the plan or handoff: `question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason` when unresolved. Use source tags such as `confirmed`, `advisory`, `session-local`, `stale`, or `user`. Suggest creating an ADR-like artifact only when the decision is hard to reverse, would be surprising without context, and reflects a real tradeoff.

## Runtime Context Exclusion

Follow `docs/contracts/context-governance.md`: ordinary Planning context excludes `.spec-first/audits/**` and generated mirrors (`.claude/**`, `.codex/**`, `.agents/skills/**`) by default. Do not use those paths as planning source, broad repo context, or research input unless the plan explicitly targets setup/update/runtime drift/audit evidence or the user names a precise runtime path; when excluded, carry the path or reason as a limitation instead of silently scanning it.

## Cache-Friendly Context Layout

Keep role boundaries, plan quality bar, setup/readiness limits, and reference load conditions in the stable instruction prefix. Put the current request, requirement summary, repo evidence, tool summaries, project-guidance facts, `artifact-summary.v1`, and `context-bundle.v1` from `docs/contracts/context-bundle.md` in the dynamic suffix. Plan handoff should summarize goal, scope, non-goals, implementation units, verification, and open questions before asking downstream work to read the full plan.

Maintain a run-local context ledger for this workflow: paths read, reason, phase, and compact summary. Reuse loaded summaries within the same workflow run. Re-read only when exact wording is needed, the file changed, prior evidence is insufficient, or the user explicitly asks.

## Interaction Method

When asking the user a question, use the platform's blocking question tool: `AskUserQuestion` in Claude Code (call `ToolSearch` with `select:AskUserQuestion` first if its schema isn't loaded) or `request_user_input` in Codex. Fall back to numbered options in chat only when no blocking tool exists in the harness or the call errors (e.g., Codex edit modes) — not because a schema load is required. Never silently skip the question.

Ask one question at a time. Prefer a concise single-select choice when natural options exist.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty, ask the user:** "What would you like to plan? Describe the task, goal, or project you have in mind." Then wait for their response before continuing.

If the input is present but unclear or underspecified, do not abandon — ask one or two clarifying questions, or proceed to Phase 0.4's planning bootstrap to establish enough context. The goal is always to help the user plan, never to exit the workflow.

**IMPORTANT: All file references in the plan document must use repo-relative paths (e.g., `src/models/user.rb`), never absolute paths (e.g., `/Users/name/Code/project/src/models/user.rb`). This applies everywhere — implementation unit file lists, pattern references, origin document links, and prose mentions. Absolute paths break portability across machines, worktrees, and teammates.**

## Core Principles

1. **Use requirements as the source of truth** - If `spec-brainstorm` produced a requirements document, planning should build from it rather than re-inventing behavior.
2. **Decisions, not code** - Capture approach, boundaries, files, dependencies, risks, and test scenarios. Do not pre-write implementation code or shell command choreography. Pseudo-code sketches or DSL grammars that communicate high-level technical design are welcome when they help a reviewer validate direction — but they must be explicitly framed as directional guidance, not implementation specification.
3. **Research before structuring** - Explore the codebase, institutional learnings, and external guidance when warranted before finalizing the plan.
4. **Right-size the artifact** - Small work gets a compact plan. Large work gets more structure. The philosophy stays the same at every depth.
5. **Separate planning from execution discovery** - Resolve planning-time questions here. Explicitly defer execution-time unknowns to implementation.
6. **Keep the plan portable** - The plan should work as a living document, review artifact, or issue body without embedding tool-specific executor instructions.
7. **Carry execution posture lightly when it matters** - If the request, origin document, or repo context clearly implies test-first, characterization-first, or another non-default execution posture, reflect that in the plan as a lightweight signal. Do not turn the plan into step-by-step execution choreography.
8. **Honor user-named resources** - When the user names a specific resource — a CLI, MCP server, URL, file, doc link, or prior artifact — treat it as authoritative input, not a suggestion. Discover it if unknown (`command -v`, fetch, read) before assuming it's unavailable. Use it in place of generic alternatives. If it fails or doesn't exist, say so explicitly rather than silently substituting.

## Plan Quality Bar

Every plan should contain:
- A clear problem frame and scope boundary
- Concrete requirements traceability back to the request or origin document
- Repo-relative file paths for the work being proposed (never absolute paths — see Planning Rules)
- Explicit test file paths for feature-bearing implementation units
- Decisions with rationale, not just tasks
- Existing patterns or code references to follow
- Enumerated test scenarios for each feature-bearing unit, specific enough that an implementer knows exactly what to test without inventing coverage themselves
- Clear dependencies and sequencing

A plan is ready when an implementer can start confidently without needing the plan to write the code for them.

## Workflow

### Phase 0: Resume, Source, and Scope

#### 0.1 Resume Existing Plan Work When Appropriate

If the user references an existing plan file or there is an obvious recent matching plan in `docs/plans/`:
- Read it
- Confirm whether to update it in place or create a new plan
- If updating, revise only the still-relevant sections. Plans do not carry per-unit progress state — progress is derived from git by `spec-work`, so there is no progress to preserve across edits

**Deepen intent:** The word "deepen" (or "deepening") in reference to a plan is the primary trigger for the deepening fast path. When the user says "deepen the plan", "deepen my plan", "run a deepening pass", or similar, the target document is a **plan** in `docs/plans/`, not a requirements document. Use any path, keyword, or context the user provides to identify the right plan. If a path is provided, verify it is actually a plan document. If the match is not obvious, confirm with the user before proceeding.

Words like "strengthen", "confidence", "gaps", and "rigor" are NOT sufficient on their own to trigger deepening. These words appear in normal editing requests ("strengthen that section about the diagram", "there are gaps in the test scenarios") and should not cause a holistic deepening pass. Only treat them as deepening intent when the request clearly targets the plan as a whole and does not name a specific section or content area to change — and even then, prefer to confirm with the user before entering the deepening flow.

Once the plan is identified and appears complete (all major sections present, implementation units defined, `status: active`):
- If the plan lacks YAML frontmatter (non-software plans use a simple `# Title` heading with `Created:` date instead of frontmatter), route to `references/universal-planning.md` for editing or deepening instead of Phase 5.3. Non-software plans do not use the software confidence-first check.
- Otherwise, short-circuit to Phase 5.3 (Confidence-first Check and Deepening) in **interactive mode**. This avoids re-running the full planning workflow and gives the user control over which findings are integrated.

Normal editing requests (e.g., "update the test scenarios", "add a new implementation unit", "strengthen the risk section") should NOT trigger the fast path — they follow the standard resume flow.

If the plan already has a `deepened: YYYY-MM-DD` frontmatter field and there is no explicit user request to re-deepen, the fast path still applies the same confidence-gap evaluation — it does not force deepening.

#### 0.1b Classify Task Domain

If the task involves building, modifying, or architecting software (references code, repos, APIs, databases, or asks to build/modify/deploy), continue to Phase 0.2.

If the domain is genuinely ambiguous (e.g., "plan a migration" with no other context), ask the user before routing.

Otherwise, read `references/universal-planning.md` and follow that workflow instead. Skip all subsequent phases. Named tools or source links don't change this routing — they're inputs, handled per Core Principle 8.

#### 0.2 Find Upstream Requirements Document

Before asking planning questions, search `docs/brainstorms/` for files matching `*-requirements.md`.

**Relevance criteria:** A requirements document is relevant if:
- The topic semantically matches the feature description
- It was created within the last 30 days (use judgment to override if the document is clearly still relevant or clearly stale)
- It appears to cover the same user problem or scope

If multiple source documents match, ask which one to use using the platform's blocking question tool when available (see Interaction Method). Otherwise, present numbered options in chat and wait for the user's reply before proceeding.

#### 0.3 Use the Source Document as Primary Input

If a relevant requirements document exists:
1. Read it thoroughly
2. Announce that it will serve as the origin document for planning
3. Carry forward all of the following:
   - `spec_id` when the origin frontmatter contains one. Preserve it exactly in the plan frontmatter; it is the cross-artifact identity for this spec chain.
   - Problem frame
   - Actors (A-IDs), Key Flows (F-IDs), and Acceptance Examples (AE-IDs) when present — preserve these as constraints that implementation units must honor
   - Requirements and success criteria
   - Scope boundaries (including "Deferred for later" and "Outside this product's identity" subsections when present)
   - Key decisions and rationale
   - Dependencies or assumptions
   - Outstanding questions, preserving whether they are blocking or deferred
   - If the origin uses `artifact_kind: prd-requirements`, treat it as a PRD-grade requirements origin, not as a separate planning artifact class; inherit the existing `spec_id`, R/F/AE references, Scope Boundaries, Evidence And Assumptions, trace self-check summary, and any project-local `US-*` / `FEAT-*` / `NFR-*` auxiliary trace mappings instead of rebuilding identity or silently dropping trace gaps.
   - If that PRD-grade origin includes `## Feature Slices`, preserve feature IDs, requirement refs, acceptance refs, and source/evidence pointers in the plan Context, Sources, Requirements, or Implementation Units where relevant. Feature slices are PRD-origin trace, not a new planning-owned artifact class.
   - If the origin uses `document_role: split-summary`, treat it as a navigation and boundary artifact; do not default to implementation planning from it. Prefer a concrete `document_role: child-prd` source, and preserve `child_id`, `parent_spec_id`, `source_prd`, and `split_summary` trace in the plan Context / Sources.
4. Use the source document as the primary input to planning and research
5. Reference important carried-forward decisions in the plan with `(see origin: <source-path>)`
6. Do not silently omit source content — if the origin document discussed it, the plan must address it even if briefly. Before finalizing, scan each section of the origin document to verify nothing was dropped.

When planning from a PRD-grade origin, run a PRD handoff entropy check before inventing WHAT. If the plan would need to choose a canonical term, source-of-truth, domain ownership, hard decision consequence, missing slice acceptance, missing slice source, or missing slice scope that the PRD did not settle, route to PRD refine or emit an inline PRD feedback candidate instead of deciding it in the plan. Keep this as a handoff boundary only: do not run a separate grill workflow in `spec-plan`, do not copy the full `spec-prd` readiness lens or Feature Slice Pack, do not generate program slices or task packs during planning, and do not auto-write back to the PRD.

If the origin requirements document is a legacy document without `spec_id`, do not edit the origin by default. Generate a new plan-local `spec_id`, note in the plan that origin identity was not inherited, and treat the requirements-to-plan link as weak trace. If the user explicitly asks to backfill the origin requirements document, handle that as a separate scoped edit.

If no relevant requirements document exists, planning may proceed from the user's request directly.

#### 0.4 Planning Bootstrap (No Requirements Doc or Unclear Input)

If no relevant requirements document exists, or the input needs more structure:
- Assess whether the request is already clear enough for direct technical planning — if so, continue to Phase 0.5
- If the ambiguity is mainly product framing, user behavior, or scope definition, recommend `spec-brainstorm` as a suggestion — but always offer to continue planning here as well
- If the user wants to continue here (or was already explicit about wanting a plan), run the planning bootstrap below

The planning bootstrap should establish:
- Problem frame
- Intended behavior
- Scope boundaries and obvious non-goals
- Success criteria
- Blocking questions or assumptions

Keep this bootstrap brief. It exists to preserve direct-entry convenience, not to replace a full brainstorm.

If the bootstrap uncovers major unresolved product questions:
- Recommend `spec-brainstorm` again
- If the user still wants to continue, require explicit assumptions before proceeding

If the bootstrap reveals that a different workflow would serve the user better:

- **Bug-shaped prompt** (user describes broken behavior, an error message, a regression, or "doesn't work") — surface `spec-debug` as a route-out option alongside continuing with `spec-plan` when the bug surface is reachable in the current repo or at a named local repo path. Stay in `spec-plan` when the named code cannot be found locally; paper planning may be the only useful output for unreachable surfaces.

  When the bug is at another local path, announce the target before any cross-repo investigation: which path will be read and where the plan output will land. Default to the target repo for both investigation and plan writing unless the user redirects. Cross-repo target location and workflow choice are separate decisions; do not silently write a plan into the wrong repository.

  In headless mode, skip the route-out menu and continue with `spec-plan`. Auto-routing into debugging would change workflows without synchronous user authorization.

- **Clear task ready to execute** (known root cause, obvious fix, no architectural decisions) — suggest `spec-work` as a faster alternative alongside continuing with planning. The user decides.

#### 0.5 Classify Outstanding Questions Before Planning

If the origin document contains `Resolve Before Planning` or similar blocking questions:
- Review each one before proceeding
- Reclassify it into planning-owned work **only if** it is actually a technical, architectural, or research question
- Keep it as a blocker if it would change product behavior, scope, or success criteria

If true product blockers remain:
- Surface them clearly
- Ask the user, using the platform's blocking question tool when available (see Interaction Method), whether to:
  1. Resume `spec-brainstorm` to resolve them
  2. Convert them into explicit assumptions or decisions and continue
- Do not continue planning while true blockers remain unresolved

#### 0.6 Assess Plan Depth

Before classifying depth, build a compact planning-context input from the user request, origin document summary, Phase 0.4 candidate paths/modules, and any directly read source refs. When the source checkout has the helper available, run:

```bash
spec-first internal task-governance-signals \
  --source plan-declared \
  --input <planning-context.json> \
  --json
```

Use the helper's `candidate_level` and `reason_codes` as deterministic advisory facts. The helper prepares signals; the LLM still decides the final plan depth. Do not feed draft Implementation Units or `Files` lists into Phase 0.6 because they do not exist yet. The `<planning-context.json>` input shape (`request`, `origin_text`, `text`, `candidate_paths`, `paths`, `source_refs`, `target_areas`) is documented in `docs/contracts/governance/task-governance-signals.md`; an unreadable input degrades to `reason_code: planning-context-unreadable` rather than a clean lightweight result.

Classify the work into one of these plan depths:

- **Lightweight** - small, well-bounded, low ambiguity
- **Standard** - normal feature or bounded refactor with some technical decisions to document
- **Deep** - cross-cutting, strategic, high-risk, or highly ambiguous implementation work

Confirm the helper candidate or explicitly override it with a short reason, for example: "Using Standard despite candidate lightweight because the request touches a public CLI contract." If the helper is unavailable, continue with direct evidence and record `task-governance-signals unavailable` as degraded advisory evidence rather than inventing candidate facts.

If depth is unclear, ask one targeted question and then continue.

#### 0.7 Solo-Mode Scope Summary

**STOP. Before composing the synthesis, read `references/synthesis-summary.md`.** The discipline rules, prose-summary requirement, three-bucket structure, anti-pattern guidance, soft-cut behavior, self-redirect support, solo-variant content focus, and routing into plan sections all live there.

Surface a synthesis to the user after the brief Phase 0.4 bootstrap and before Phase 1 research begins. This protects against spending research and sub-agent attention on the wrong scope.

Fires only when all guards are true:
- Phase 0.2 found no upstream brainstorm doc
- Phase 0.4 stayed in `spec-plan` rather than routing to debug, work, or universal planning
- Phase 0.5 cleared without unresolved blockers
- The run is not on a Phase 0.1 fast path such as resume-normal or deepen-intent

Skip Phase 0.7 for brainstorm-sourced invocations; those use Phase 5.1.5 after research. In headless mode, compose the synthesis but do not ask for confirmation. Continue to Phase 1 research, then route inferred bets to `## Assumptions` at plan-write time.

### Phase 1: Gather Context

#### 1.1 Local Research (Always Runs)

Prepare a concise planning context summary (a paragraph or two) to pass as input to the research agents:
- If an origin document exists, summarize the problem frame, requirements, and key decisions from that document
- Otherwise use the feature description directly

Planning research agents are read-only. A direct plan workflow invocation authorizes this documented research phase when host capability exists; do not ask for a second subagent confirmation. Use the active host's agent-dispatch primitive when available (including `spawn_agent` where provided), omit permission-mode overrides, and keep dispatch bounded to the named research agents below. Do not downgrade solely because the host is Codex.

If dispatch is unavailable, explicitly disabled, or fails for a non-capacity reason, run the same research sequentially in the current agent by reading the corresponding agent profile and applying it inline as an explicit fallback. Plan generation must still complete when research dispatch is unavailable; dispatch improves latency and context separation, not correctness.

### Implementation Worker Suitability Gate

Planning may recommend later worker delegation, but it must not dispatch implementation workers or create a hidden implement/check lifecycle. A worker is suitable only when the scope is clear, the write set can be bounded, verification commands are known, no product/architecture blocker remains, and no sensitive/security-critical ambiguity is unresolved. If any condition is missing, keep the task local to `spec-work`, return to planning, or require a smaller task pack slice. Review autofix and mutation are off unless a documented workflow mode or explicit user choice authorizes them.

Dispatch these read-only research agents in parallel when available, or run the explicit sequential/inline fallback:

- `spec-repo-research-analyst` — Scope: technology, architecture, patterns. Input: `{planning context summary}`.
- `spec-learnings-researcher` — Input: `{planning context summary}`.
Collect:
- Technology stack and versions (used in section 1.2 to make sharper external research decisions)
- Architectural patterns and conventions to follow
- Implementation patterns, relevant files, modules, and tests
- Already-loaded project guidance that materially affects the plan; read `AGENTS.md` / `CLAUDE.md` source only when the Host Instruction Reuse Policy allows it, and pass only the relevant compact summary to research agents
- Institutional learnings from `docs/solutions/`

**Slack context** (opt-in) — never auto-dispatch. Route by condition:

- **Tools available + user asked**: Dispatch `spec-slack-researcher` with the planning context summary in parallel with other Phase 1.1 agents. If the origin document has a Slack context section, pass it verbatim so the researcher focuses on gaps. Include findings in consolidation.
- **Tools available + user didn't ask**: Note in output: "Slack tools detected. Ask me to search Slack for organizational context at any point, or include it in your next prompt."
- **No tools + user asked**: Note in output: "Slack context was requested but no Slack tools are available. Install and authenticate the Slack plugin to enable organizational context search."

#### 1.1a Direct Evidence Readiness

If the current cwd is a non-Git parent workspace that contains child Git repos, first resolve the intended project target. A single-repo plan must name a top-level `target_repo` using the workspace-relative child path before writing repo-specific requirements or implementation units. A cross-repo plan must name `target_repo` per implementation unit instead of implying workspace-wide write scope. If no active repo or explicit cross-repo scope is available, ask the user to choose before writing a repo-specific plan; do not let scripts or setup facts choose semantically between child repos.

For code implementation, architecture, API/routes, cross-module, or test strategy plans, collect bounded direct evidence:

- current git status and diff scope when relevant;
- file discovery with `rg --files` and targeted text search with `rg`;
- nearby source files, tests, package manifests, config, and contracts;
- ast-grep structural search when simple text search is too weak;
- test/log output supplied by the user or produced by focused commands.

In the generated plan, include a machine-testable Direct Evidence block before `Context & Research`:

```md
## Direct Evidence

- target_repo:
- source_refs:
- current_revision:
- worktree_dirty:
- discovery_methods:
- tests_or_logs:
- confidence:
- limitations:
```

Use this block to disclose what was actually read or verified. Do not claim repository-wide impact coverage from a narrow search. Do not add hidden pre-facts or external-tool evidence envelopes.

#### 1.1b Detect Execution Posture Signals

Decide whether the plan should carry a lightweight execution posture signal.

Look for signals such as:
- The user explicitly asks for TDD, test-first, or characterization-first work
- The origin document calls for test-first implementation or exploratory hardening of legacy code
- Local research shows the target area is legacy, weakly tested, or historically fragile, suggesting characterization coverage before changing behavior

When the signal is clear, carry it forward silently in the relevant implementation units.

Ask the user only if the posture would materially change sequencing or risk and cannot be responsibly inferred.

#### 1.2 Decide on External Research

Based on the origin document, user signals, and local findings, decide whether external research adds value.

**Read between the lines.** Pay attention to signals from the conversation so far:
- **User familiarity** — Are they pointing to specific files or patterns? They likely know the codebase well.
- **User intent** — Do they want speed or thoroughness? Exploration or execution?
- **Topic risk** — Security, payments, external APIs warrant more caution regardless of user signals.
- **Uncertainty level** — Is the approach clear or still open-ended?

**Leverage spec-repo-research-analyst's technology context:**

The spec-repo-research-analyst output includes a structured Technology & Infrastructure summary. Use it to make sharper external research decisions:

- If specific frameworks and versions were detected (e.g., Rails 7.2, Next.js 14, Go 1.22), pass those exact identifiers to spec-framework-docs-researcher so it fetches version-specific documentation
- If the feature touches a technology layer the scan found well-established in the repo (e.g., existing Sidekiq jobs when planning a new background job), lean toward skipping external research -- local patterns are likely sufficient
- If the feature touches a technology layer the scan found absent or thin (e.g., no existing proto files when planning a new gRPC service), lean toward external research -- there are no local patterns to follow
- If the scan detected deployment infrastructure (Docker, K8s, serverless), note it in the planning context passed to downstream agents so they can account for deployment constraints
- If the scan detected a monorepo and scoped to a specific service, pass that service's tech context to downstream research agents -- not the aggregate of all services. If the scan surfaced the workspace map without scoping, use the feature description to identify the relevant service before proceeding with research

**Always lean toward external research when:**
- The topic is high-risk: security, payments, privacy, external APIs, migrations, compliance
- The codebase lacks relevant local patterns -- fewer than 3 direct examples of the pattern this plan needs
- Local patterns exist for an adjacent domain but not the exact one -- e.g., the codebase has HTTP clients but not webhook receivers, or has background jobs but not event-driven pub/sub. Adjacent patterns suggest the team is comfortable with the technology layer but may not know domain-specific pitfalls. When this signal is present, frame the external research query around the domain gap specifically, not the general technology
- The user is exploring unfamiliar territory
- The technology scan found the relevant layer absent or thin in the codebase

**Skip external research when:**
- The codebase already shows a strong local pattern -- multiple direct examples (not adjacent-domain), recently touched, following current conventions
- The user already knows the intended shape
- Additional external context would add little practical value
- The technology scan found the relevant layer well-established with existing examples to follow

Announce the decision briefly before continuing. Examples:
- "Your codebase has solid patterns for this. Proceeding without external research."
- "This involves payment processing, so I'll research current best practices first."

#### 1.3 External Research (Conditional)

If Step 1.2 indicates external research is useful, dispatch these read-only agents in parallel when available, or run them sequentially/inline in the current agent as the explicit fallback:

- `spec-best-practices-researcher` — Input: `{planning context summary}`.
- `spec-framework-docs-researcher` — Input: `{planning context summary}`.

#### 1.4 Consolidate Research

Summarize:
- Relevant codebase patterns and file paths
- Relevant institutional learnings
- Organizational context from Slack conversations, if gathered (prior discussions, decisions, or domain knowledge relevant to the feature)
- External references and best practices, if gathered
- Related issues, PRs, or prior art
- Any constraints that should materially shape the plan

#### 1.4b Reclassify Depth When Research Reveals External Contract Surfaces

If the current classification is **Lightweight** and Phase 1 research found that the work touches any of these external contract surfaces, reclassify to **Standard**:

- Environment variables consumed by external systems, CI, or other repositories
- Exported public APIs, CLI flags, or command-line interface contracts
- CI/CD configuration files (`.github/workflows/`, `Dockerfile`, deployment scripts)
- Shared types or interfaces imported by downstream consumers
- Documentation referenced by external URLs or linked from other systems

This ensures flow analysis (Phase 1.5) runs and the confidence-first check (Phase 5.3) applies critical-section bonuses. Announce the reclassification briefly and include whether it confirms or overrides the Phase 0.6 `candidate_level`: "Reclassifying to Standard — this change touches [environment variables / exported APIs / CI config] with external consumers."

#### 1.5 Flow and Edge-Case Analysis (Conditional)

For **Standard** or **Deep** plans, or when user flow completeness is still unclear, dispatch the read-only flow analyzer when available, or run the same analysis sequentially/inline in the current agent as the explicit fallback:

- `spec-spec-flow-analyzer` — Input: `{planning context summary, research findings}`.

Use the output to:
- Identify missing edge cases, state transitions, or handoff gaps
- Tighten requirements trace or verification strategy
- Add only the flow details that materially improve the plan

### Phase 2: Resolve Planning Questions

Build a planning question list from:
- Deferred questions in the origin document
- Gaps discovered in repo or external research
- Technical decisions required to produce a useful plan

For each question, decide whether it should be:
- **Resolved during planning** - the answer is knowable from repo context, documentation, or user choice
- **Deferred to implementation** - the answer depends on code changes, runtime behavior, or execution-time discovery

Ask the user only when the answer materially affects architecture, scope, sequencing, or risk and cannot be responsibly inferred. Use the platform's blocking question tool when available (see Interaction Method).

**Do not** run tests, build the app, or probe runtime behavior in this phase. The goal is a strong plan, not partial execution.

### Phase 3: Structure the Plan

#### 3.1 Title and File Naming

- Draft a clear, searchable title using conventional format such as `feat: Add user authentication` or `fix: Prevent checkout double-submit`
- Determine the plan type: `feat`, `fix`, or `refactor`
- Build the filename following the repository convention: `docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md`
  - Create `docs/plans/` if it does not exist
  - Check existing files for today's date to determine the next sequence number (zero-padded to 3 digits, starting at 001)
  - Keep the descriptive name concise (3-5 words) and kebab-cased
  - Examples: `2026-01-15-001-feat-user-authentication-flow-plan.md`, `2026-02-03-002-fix-checkout-race-condition-plan.md`
  - Avoid: missing sequence numbers, vague names like "new-feature", invalid characters (colons, spaces)
- Set the plan frontmatter `spec_id`:
  - If the plan has an origin requirements document with `spec_id`, inherit that value exactly, even though the plan filename also contains `<type>`.
  - If the origin requirements document is legacy and lacks `spec_id`, generate a plan-local `spec_id` from the plan filename sequence and slug, and state in the Problem Frame or Context & Research that origin identity was not inherited.
  - If there is no origin document, generate a new `spec_id` from the plan filename sequence and slug.
  - Before minting a new `spec_id`, scan `docs/brainstorms/`, `docs/plans/`, and `docs/tasks/` frontmatter. If the same `spec_id` already exists and `origin` / `source_plan` links do not prove it belongs to the same spec chain, increment the local sequence or ask the user to confirm.
  - Preserve `spec_id` across ordinary edits, plan deepening, task-pack rebuilds, and work/review handoffs. For alternative implementation plans, independent delivery chains, or abandon-and-replace work from the same origin, decide whether to inherit or create a new spec chain and record the reason in the plan.

#### 3.2 Stakeholder and Impact Awareness

For **Standard** or **Deep** plans, briefly consider who is affected by this change — end users, developers, operations, other teams — and how that should shape the plan. For cross-cutting work, note affected parties in the System-Wide Impact section.

#### 3.3 Break Work into Implementation Units

Break the work into logical implementation units. Each unit should represent one meaningful change that an implementer could typically land as an atomic commit.

Good units are:
- Focused on one component, behavior, or integration seam
- Usually touching a small cluster of related files
- Ordered by dependency
- Concrete enough for execution without pre-writing code

Avoid:
- 2-5 minute micro-steps
- Units that span multiple unrelated concerns
- Units that are so vague an implementer still has to invent the plan

Each unit carries a stable plan-local **U-ID** assigned in Phase 3.5 (`U1`, `U2`, …). U-IDs survive reordering, splitting, and deletion: new units take the next unused number, gaps are fine, and existing IDs are never renumbered. This lets `spec-work` reference units unambiguously across plan edits.

#### 3.4 High-Level Technical Design (Optional)

Before detailing implementation units, decide whether an overview would help a reviewer validate the intended approach. This section communicates the *shape* of the solution — how pieces fit together — without dictating implementation.

**When to include it:**

| Work involves... | Best overview form |
|---|---|
| DSL or API surface design | Pseudo-code grammar or contract sketch |
| Multi-component integration | Mermaid sequence or component diagram |
| Data pipeline or transformation | Data flow sketch |
| State-heavy lifecycle | State diagram |
| Complex branching logic | Flowchart |
| Mode/flag combinations or multi-input behavior | Decision matrix (inputs -> outcomes) |
| Single-component with non-obvious shape | Pseudo-code sketch |

**When to skip it:**
- Well-patterned work where prose and file paths tell the whole story
- Straightforward CRUD or convention-following changes
- Lightweight plans where the approach is obvious

Choose the medium that fits the work. Do not default to pseudo-code when a diagram communicates better, and vice versa.

Frame every sketch with: *"This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce."*

Keep sketches concise — enough to validate direction, not enough to copy-paste into production.

#### 3.4b Output Structure (Optional)

For greenfield plans that create a new directory structure (new plugin, service, package, or module), include an `## Output Structure` section with a file tree showing the expected layout. This gives reviewers the overall shape before diving into per-unit details.

**When to include it:**
- The plan creates 3+ new files in a new directory hierarchy
- The directory layout itself is a meaningful design decision

**When to skip it:**
- The plan only modifies existing files
- The plan creates 1-2 files in an existing directory — the per-unit file lists are sufficient

The tree is a scope declaration showing the expected output shape. It is not a constraint — the implementer may adjust the structure if implementation reveals a better layout. The per-unit `**Files:**` sections remain authoritative for what each unit creates or modifies.

#### 3.5 Define Each Implementation Unit

Each unit's heading carries a stable U-ID prefix matching the format used for R/A/F/AE in requirements docs: `### U1. [Name]`. The U-ID is plain text in the heading and the unit name is not bolded. Number sequentially within the plan starting at U1. Do not prefix units with `- [ ]` / `- [x]` checkbox markers; the plan is a decision artifact, and execution progress is derived from git by `spec-work` rather than stored in the plan body. When reading, editing, or deepening older plans, continue to recognize legacy `- U1. **[Name]**` list-item units as valid anchors.

**Stability rule.** Once assigned, a U-ID is never renumbered. Reordering units leaves their IDs in place (e.g., U1, U3, U5 in their new order is correct; renumbering to U1, U2, U3 is not). Splitting a unit keeps the original U-ID on the original concept and assigns the next unused number to the new unit. Deletion leaves a gap; gaps are fine. This rule matters most during deepening (Phase 5.3), which is the most likely accidental-renumber vector.

For each unit, include:
- **Goal** - what this unit accomplishes
- **Requirements** - which requirements or success criteria it advances (cite R-IDs, and A/F/AE IDs when origin supplies them)
- **Dependencies** - what must exist first (cite by U-ID, e.g., "U1, U3")
- **Files** - repo-relative file paths to create, modify, or test (never absolute paths)
- **Approach** - key decisions, data flow, component boundaries, or integration notes
- **Execution note** - optional, only when the unit benefits from a non-default execution posture such as test-first or characterization-first
- **Technical design** - optional pseudo-code or diagram when the unit's approach is non-obvious and prose alone would leave it ambiguous. Frame explicitly as directional guidance, not implementation specification
- **Patterns to follow** - existing code or conventions to mirror
- **Test scenarios** - enumerate the specific test cases the implementer should write, right-sized to the unit's complexity and risk. Consider each category below and include scenarios from every category that applies to this unit. A simple config change may need one scenario; a payment flow may need a dozen. The quality signal is specificity — each scenario should name the input, action, and expected outcome so the implementer doesn't have to invent coverage. For units with no behavioral change (pure config, scaffolding, styling), use `Test expectation: none -- [reason]` instead of leaving the field blank. **AE-link convention:** when a test scenario directly enforces an origin Acceptance Example, prefix it with `Covers AE<N>.` (or `Covers F<N> / AE<N>.`). This is sparse-by-design — most test scenarios are finer-grained than AEs and do not link. Do not force AE links onto tests that only cover lower-level implementation details.
  - **Happy path behaviors** - core functionality with expected inputs and outputs
  - **Edge cases** (when the unit has meaningful boundaries) - boundary values, empty inputs, nil/null states, concurrent access
  - **Error and failure paths** (when the unit has failure modes) - invalid input, downstream service failures, timeout behavior, permission denials
  - **Integration scenarios** (when the unit crosses layers) - behaviors that mocks alone will not prove, e.g., "creating X triggers callback Y which persists Z". Include these for any unit touching callbacks, middleware, or multi-layer interactions
- **Verification** - how an implementer should know the unit is complete, expressed as outcomes rather than shell command scripts

Every feature-bearing unit should include the test file path in `**Files:**`.

Use `Execution note` sparingly. Good uses include:
- `Execution note: Start with a failing integration test for the request/response contract.`
- `Execution note: Add characterization coverage before modifying this legacy parser.`
- `Execution note: Implement new domain behavior test-first.`

Do not expand units into literal `RED/GREEN/REFACTOR` substeps.

#### 3.6 Keep Planning-Time and Implementation-Time Unknowns Separate

If something is important but not knowable yet, record it explicitly under deferred implementation notes rather than pretending to resolve it in the plan.

Examples:
- Exact method or helper names
- Final SQL or query details after touching real code
- Runtime behavior that depends on seeing actual test failures
- Refactors that may become unnecessary once implementation starts

### Phase 4: Write the Plan

**NEVER CODE during this skill.** Research, decide, and write the plan — do not start implementation.

Use one planning philosophy across all depths. Change the amount of detail, not the boundary between planning and execution.

#### 4.1 Plan Depth Guidance

**Lightweight**
- Keep the plan compact
- Usually 2-4 implementation units
- Omit optional sections that add little value

**Standard**
- Use the full core template, omitting optional sections (including High-Level Technical Design) that add no value for this particular work
- Usually 3-6 implementation units
- Include risks, deferred questions, and system-wide impact when relevant

**Deep**
- Use the full core template plus optional analysis sections where warranted
- Usually 4-8 implementation units
- Group units into phases when that improves clarity
- Include alternatives considered, documentation impacts, and deeper risk treatment when warranted

#### 4.1b Optional Deep Plan Extensions

For sufficiently large, risky, or cross-cutting work, add the sections that genuinely help:
- **Alternative Approaches Considered**
- **Success Metrics**
- **Dependencies / Prerequisites**
- **Risk Analysis & Mitigation**
- **Phased Delivery**
- **Documentation Plan**
- **Operational / Rollout Notes**
- **Future Considerations** only when they materially affect current design

Do not add these as boilerplate. Include them only when they improve execution quality or stakeholder alignment.

**Alternatives Considered — what to vary.** When this section is included, alternatives must differ on *how* the work is built: architecture, sequencing, boundaries, integration pattern, rollout strategy. Tiny implementation variants (which hash function, which serialization format) belong in Key Technical Decisions, not Alternatives. Product-shape alternatives (different actors, different core outcome, different positioning) belong in `spec-brainstorm`, not here — surface them back upstream rather than re-litigating product questions during planning.

#### 4.2 Core Plan Template

Read `skills/spec-plan/references/plan-sections.md` before writing the plan. That file defines the format-independent content contract: which sections earn their place, which metadata fields are stable, and which downstream consumers rely on markdown as the canonical artifact.

Read `skills/spec-plan/references/markdown-rendering.md` before writing the canonical markdown plan. Markdown remains the source artifact for `spec-work`, `spec-write-tasks`, `spec-doc-review`, and plan deepening. If a future run explicitly produces an HTML companion, read `skills/spec-plan/references/html-rendering.md` and treat that file as an optional sidecar only; do not replace the markdown plan without focused downstream consumer tests.

Read `skills/spec-plan/references/plan-template.md` before writing the plan. That file is the source of truth for the core plan skeleton, optional Deep extensions, current heading names, and the implementation-unit heading format. Do not reconstruct the template from memory and do not inline the full template in this skill.

Use `### U1. [Name]` heading-style implementation units for new plans. Continue to read legacy `- U1. **[Name]**` list-item units when editing or deepening older plans; do not rewrite old unit anchors unless the user asked for a format cleanup.

#### 4.3 Planning Rules

- **Horizontal rules (`---`) between top-level sections** in Standard and Deep plans, mirroring the `spec-brainstorm` requirements doc convention. Improves scannability of dense plans where many H2 sections sit close together. Omit for Lightweight plans where the whole doc fits on a single screen.
- **All file paths must be repo-relative** — never use absolute paths like `/Users/name/Code/project/src/file.ts`. Use `src/file.ts` instead. Absolute paths make plans non-portable across machines, worktrees, and teammates. When a plan targets a different repo than the document's home, state the target repo once at the top of the plan (e.g., `**Target repo:** my-other-project`) and use repo-relative paths throughout
- Prefer path plus class/component/pattern references over brittle line numbers
- Do not include implementation code — no imports, exact method signatures, or framework-specific syntax
- Pseudo-code sketches and DSL grammars are allowed in the High-Level Technical Design section and per-unit technical design fields when they communicate design direction. Frame them explicitly as directional guidance, not implementation specification
- Mermaid diagrams are encouraged when they clarify relationships or flows that prose alone would make hard to follow — ERDs for data model changes, sequence diagrams for multi-service interactions, state diagrams for lifecycle transitions, flowcharts for complex branching logic
- Do not include git commands, commit messages, or exact test command recipes
- Do not expand implementation units into micro-step `RED/GREEN/REFACTOR` instructions
- Do not pretend an execution-time question is settled just to make the plan look complete

#### 4.4 Visual Communication in Plan Documents

When the plan contains 4+ implementation units with non-linear dependencies, 3+ interacting surfaces in System-Wide Impact, 3+ behavioral modes/variants in Summary or Problem Frame, or 3+ interacting decisions in Key Technical Decisions or alternatives in Alternative Approaches, read `references/visual-communication.md` for diagram and table guidance. Legacy plans may still use `Overview`; treat it as the old Summary slot. This covers plan-structure visuals (dependency graphs, interaction diagrams, comparison tables) — not solution-design diagrams, which are covered in Section 3.4.

### Phase 5: Final Review, Write File, and Handoff

#### 5.1 Review Before Writing

Before finalizing, check:
- The plan does not invent product behavior that should have been defined in `spec-brainstorm`
- If there was no origin document, the bounded planning bootstrap established enough product clarity to plan responsibly
- Every major decision is grounded in the origin document or research
- Each implementation unit is concrete, dependency-ordered, and implementation-ready
- If test-first or characterization-first posture was explicit or strongly implied, the relevant units carry it forward with a lightweight `Execution note`
- Each feature-bearing unit has test scenarios from every applicable category (happy path, edge cases, error paths, integration) — right-sized to the unit's complexity, not padded or skimped
- Test scenarios name specific inputs, actions, and expected outcomes without becoming test code
- Feature-bearing units with blank or missing test scenarios are flagged as incomplete — feature-bearing units must have actual test scenarios, not just an annotation. The `Test expectation: none -- [reason]` annotation is only valid for non-feature-bearing units (pure config, scaffolding, styling)
- Deferred items are explicit and not hidden as fake certainty
- `spec_id` is present for software plans, is inherited from origin requirements when available, and is not changed during deepening or ordinary plan edits
- If the origin requirements document lacks `spec_id`, the plan explicitly says it uses a plan-local `spec_id` and that origin identity was not inherited
- If this plan is an alternative, independent delivery chain, or replacement for another plan from the same origin, the plan states why it inherits the existing `spec_id` or starts a new spec chain
- If a High-Level Technical Design section is included, it uses the right medium for the work, carries the non-prescriptive framing, and does not contain implementation code (no imports, exact signatures, or framework-specific syntax)
- Per-unit technical design fields, if present, are concise and directional rather than copy-paste-ready
- If the plan creates a new directory structure, would an Output Structure tree help reviewers see the overall shape?
- If Scope Boundaries lists items that are planned work for a separate PR, issue, or repo, are they under `### Deferred to Follow-Up Work` rather than mixed with true non-goals?
- U-IDs are unique within the plan and follow the stability rule — no two units share an ID; reordering or splitting did not renumber existing units; gaps from deletions are preserved
- Would a visual aid (dependency graph, interaction diagram, comparison table) help a reader grasp the plan structure faster than scanning prose alone?

If the plan originated from a requirements document, re-read that document and verify:
- The chosen approach still matches the product intent
- Scope boundaries and success criteria are preserved
- Blocking questions were either resolved, explicitly assumed, or sent back to `spec-brainstorm`
- Every section of the origin document is addressed in the plan — scan each section to confirm nothing was silently dropped
- If origin supplies A/F/AE IDs: every origin R/F/AE that *affects implementation* is referenced in Requirements, a U-ID unit, test scenarios, verification, scope boundaries, or explicitly deferred. Actors are carried forward when they affect behavior, permissions, UX, orchestration, handoff, or verification. The standard is preservation of product intent, not mandatory ID spam — irrelevant origin IDs may be omitted
- If origin was Deep-product (origin contains an `Outside this product's identity` subsection): the plan's Scope Boundaries preserves the three-way split — `Deferred for later` and `Outside this product's identity` carried verbatim from origin, `Deferred to Follow-Up Work` reserved for plan-local implementation sequencing

#### 5.1.5 Brainstorm-Sourced Scope Summary

**STOP. Before composing the synthesis, read `references/synthesis-summary.md`.** The discipline rules, prose-summary requirement, three-bucket structure, anti-pattern guidance, soft-cut behavior, self-redirect support, brainstorm-sourced content focus, doc-body reading rules, and routing into plan sections all live there.

Surface the agent's plan-time decisions to the user before Phase 5.2 commits the plan to disk. The upstream brainstorm validated WHAT to build; this phase surfaces HOW the plan will execute it, including patterns extended, files or modules touched, test scope, and deliberate exclusions.

Fires only when the plan was sourced from an upstream brainstorm requirements doc and the run is not on a Phase 0.1 fast path. Skip it in solo invocation because solo plans use Phase 0.7.

In headless mode, compose the synthesis but do not ask for confirmation. Proceed to Phase 5.2 and route inferred bets to `## Assumptions` instead of Key Technical Decisions.

#### 5.2 Write Plan File

**REQUIRED: Write the plan file to disk before presenting any options.**

Use the Write tool to save the complete plan to:

```text
docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md
```

Confirm using an absolute path so the reference is clickable in modern terminals:

```text
Plan written to <absolute path to plan>
```

**Pipeline mode:** If invoked from an automated workflow such as LFG or any `disable-model-invocation` context, skip interactive questions. Make the needed choices automatically and proceed to writing the plan.

#### 5.3 Confidence-first Check and Deepening

After writing the plan file, automatically evaluate whether the plan needs strengthening.

**Two deepening modes:**

- **Auto mode** (default during plan generation): Runs without asking the user for approval. The user sees what is being strengthened but does not need to make a decision. Sub-agent findings are synthesized directly into the plan.
- **Interactive mode** (activated by the re-deepen fast path in Phase 0.1): The user explicitly asked to deepen an existing plan. Sub-agent findings are presented individually for review before integration. The user can accept, reject, or discuss each agent's findings. Only accepted findings are synthesized into the plan.

Interactive mode exists because on-demand deepening is a different user posture — the user already has a plan they are invested in and wants to be surgical about what changes. This applies whether the plan was generated by this skill, written by hand, or produced by another tool.

`spec-doc-review` and this confidence-first check are different:
- Use the `spec-doc-review` workflow when the document needs clarity, simplification, completeness, or scope control
- This confidence-first check strengthens rationale, sequencing, risk treatment, and system-wide thinking when the plan is structurally sound but still needs stronger grounding

**Pipeline mode:** This phase always runs in auto mode in pipeline/disable-model-invocation contexts. No user interaction needed.

##### 5.3.1 Classify Plan Depth and Topic Risk

Determine the plan depth from the document:
- **Lightweight** - small, bounded, low ambiguity, usually 2-4 implementation units
- **Standard** - moderate complexity, some technical decisions, usually 3-6 units
- **Deep** - cross-cutting, high-risk, or strategically important work, usually 4-8 units or phased delivery

Build a risk profile. Treat these as high-risk signals:
- Authentication, authorization, or security-sensitive behavior
- Payments, billing, or financial flows
- Data migrations, backfills, or persistent data changes
- External APIs or third-party integrations
- Privacy, compliance, or user data handling
- Cross-interface parity or multi-surface behavior
- Significant rollout, monitoring, or operational concerns

##### 5.3.2 Gate: Decide Whether to Deepen

- **Lightweight** plans usually do not need deepening unless they are high-risk
- **Standard** plans often benefit when one or more important sections still look thin
- **Deep** or high-risk plans often benefit from a targeted second pass
- **Thin local grounding override:** If Phase 1.2 triggered external research because local patterns were thin (fewer than 3 direct examples or adjacent-domain match), always proceed to scoring regardless of how grounded the plan appears. When the plan was built on unfamiliar territory, claims about system behavior are more likely to be assumptions than verified facts. The scoring pass is cheap — if the plan is genuinely solid, scoring finds nothing and exits quickly

If the plan already appears sufficiently grounded and the thin-grounding override does not apply, report "Confidence-first check passed — no sections need strengthening", then **load `references/plan-handoff.md` now and execute 5.3.8 → 5.3.9 → 5.4 in sequence**. Document review is mandatory — do not skip it because the confidence-first check passed. The two tools catch different classes of issues.

##### 5.3.3–5.3.7 Deepening Execution

When deepening is warranted, read `references/deepening-workflow.md` for confidence-first scoring checklists, section-to-agent dispatch mapping, execution mode selection, research execution, interactive finding review, and plan synthesis instructions. Execute steps 5.3.3 through 5.3.7 from that file, then return here for 5.3.8.

##### 5.3.8–5.4 Document Review, Final Checks, and Post-Generation Options

**STOP. Load `references/plan-handoff.md` now before continuing.** It contains the full instructions for 5.3.8 (document review), 5.3.9 (final checks and cleanup), and 5.4 (post-generation handoff, including the Proof HITL flow, post-HITL re-review, and Issue Creation branching). This load is non-optional: without it, agents can render the menu, capture a selection, and stop without firing the routed action. Document review is mandatory — do not skip it even if the confidence-first check already ran.

After document review and final checks, present this menu using the platform's blocking question tool: `AskUserQuestion` in Claude Code (call `ToolSearch` with `select:AskUserQuestion` first if its schema isn't loaded) or `request_user_input` in Codex. Fall back to numbered options in chat only when no blocking tool exists in the harness or the call errors (e.g., Codex edit modes) — not because a schema load is required. Never silently skip the question.

**Question:** "Plan ready at `<absolute path to plan>`. What would you like to do next?"

**Options:**
1. **Start work** (recommended) - Begin implementing this plan in the current session using the current host's work entrypoint
2. **Compile task pack with `spec-write-tasks`** - Use the standalone skill when the plan is large, dependency-heavy, or would benefit from a derived `docs/tasks/*-tasks.md` execution input
3. **Create Issue** - Create a tracked issue from this plan in your configured issue tracker (GitHub or Linear)
4. **Open in Proof (web app) — review and comment to iterate with the agent** - Open the doc in Every's Proof editor, iterate with the agent via comments, or copy a link to share with others
5. **Done for now** - Pause; the plan file is saved and can be resumed later

Routing each selection, contextual surfacing of residual spec-doc-review findings, and the post-HITL resync logic all live in `references/plan-handoff.md` — follow it for every branch. Act on the user's selection; do not only tell the user which command to run.

**Completion check:** This skill is not complete until the post-generation menu above has been presented, the user has selected an action, and the routed action has executed or been explicitly declined. Presenting the menu and stopping at the selection is not completion.

**Pipeline mode exception:** In LFG or any `disable-model-invocation` context, skip the interactive menu and return control to the caller after the plan file is written, confidence-first check has run, and `spec-doc-review` has run in headless mode (per `references/plan-handoff.md`).
