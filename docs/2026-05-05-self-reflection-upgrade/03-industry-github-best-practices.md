---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/2026-05-05-self-reflection-upgrade/02-capability-gaps.md
  - https://www.anthropic.com/engineering/building-effective-agents
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/api/docs/guides/tools-skills
  - https://developers.openai.com/api/docs/guides/evaluation-best-practices
  - https://github.com/agentsmd/agents.md
  - https://github.com/addyosmani/agent-skills
  - https://github.com/openai/codex
  - https://github.com/BloopAI/vibe-kanban
  - https://github.com/tirth8205/code-review-graph
  - /Users/kuang/xiaobu/everything-claude-code
  - /Users/kuang/xiaobu/spec-kit
  - /Users/kuang/xiaobu/OpenSpec
  - /Users/kuang/xiaobu/CodeStable
  - /Users/kuang/xiaobu/skills
  - /Users/kuang/xiaobu/superpowers
  - /Users/kuang/xiaobu/compound-engineering-plugin
  - /Users/kuang/xiaobu/sdd-riper
  - /Users/kuang/xiaobu/pro-workflow
  - /Users/kuang/xiaobu/get-shit-done
---

# Industry And GitHub Best Practices

## Search Scope

Covered directions:

- AI coding workflow systems
- Agent / Skill systems
- Context engineering
- Code review / quality gates
- Self-improving / self-reflection systems
- Knowledge / compound learning
- GitHub similar projects
- User-provided local reference projects

## Search Method

Methods used:

- Web/Jina fetches for official and public docs.
- `gh search repos` with broad problem-mechanism queries.
- `gh repo view` for selected repo metadata.
- Bounded local `find` / `rg` inspection of 10 user-provided local projects.
- Direct source reads for current spec-first facts.

Search limitations:

- Exact quoted GitHub searches such as `"AI coding agent workflow plan review"` returned empty; broader searches returned useful repositories.
- The Claude Skills docs URL fetched through Jina returned the Claude docs home instead of the specific skills page, so it is not used as high-quality evidence.
- External project README claims are not treated as verified runtime behavior.

## External Search Availability

External search was available.

| Channel | Status | Notes |
|---|---|---|
| Web/Jina | available | official docs and GitHub READMEs fetched |
| GitHub CLI | available | repo search and metadata worked |
| Local references | available | all 10 paths exist, all are git repos |
| GitNexus | degraded | current `spec-first` index stale 7 commits; not used as strong evidence |

## Candidate Practices

## BP-001: Simple composable workflows before autonomous agents

### Source

Anthropic, "Building Effective AI Agents": https://www.anthropic.com/engineering/building-effective-agents

### Source Type

engineering_blog / official engineering guidance

### Practice

Start with simple, composable workflows; add agentic complexity only when it demonstrably improves outcomes.

### Problem Solved

Avoids framework/runtime complexity that obscures prompts, makes debugging harder, and raises cost/latency.

### Possible Relevance to spec-first

Directly supports `Light contract + Explicit boundaries + Scripts prepare, LLM decides`.

### Linked Capability Gap

CG-001, CG-006.

### Evidence Quality

High.

### Counter-signal

Complex multi-step coding can need orchestration, but spec-first already has existing workflows.

### Integration Risk

Low if kept as decision principle; high if misused to reject all future capability upgrades.

### Decision

Accepted as decision principle; no direct implementation.

### Integration Target

CUD reasoning and plan handoff constraints.

### Verification

Review future Accepted CUDs for "why existing workflow is not enough".

## BP-002: Repo-local instruction hierarchy

### Source

OpenAI Codex AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md

### Source Type

official_docs

### Practice

Use repo-local instruction files with explicit precedence and verification of loaded instruction sources.

### Problem Solved

Prevents hidden or stale host instructions from silently controlling behavior.

### Possible Relevance to spec-first

Reinforces AGENTS/CLAUDE source vs runtime mirror boundaries.

### Linked Capability Gap

CG-004, CG-005.

### Evidence Quality

High.

### Counter-signal

Instruction hierarchy alone does not solve CUD lifecycle.

### Integration Risk

Low.

### Decision

Watchlist / accepted as supporting evidence for source/runtime boundary.

### Integration Target

None this cycle.

### Verification

Use `spec-first doctor --codex` or Codex instruction-source verification only when runtime repair is in scope.

## BP-003: Skills as versioned `SKILL.md` bundles

### Source

OpenAI Skills docs: https://developers.openai.com/api/docs/guides/tools-skills

### Source Type

official_docs

### Practice

Skills package reusable instructions and files with a `SKILL.md` manifest; they can encode processes and conventions.

### Problem Solved

Reusable procedures can be versioned and delivered without bloating every prompt.

### Possible Relevance to spec-first

Supports source skill governance, but does not mean every repeatable report needs a new skill.

### Linked Capability Gap

CG-001, CG-006.

### Evidence Quality

High.

### Counter-signal

Adding a skill increases public surface and trigger complexity.

### Integration Risk

Medium if misapplied as "new skill for every concept".

### Decision

Skipped for Cycle 0 implementation; keep as design boundary.

### Integration Target

None.

### Verification

If a future skill is proposed, run `spec-skill-audit` and fresh-source eval.

## BP-004: Eval-driven development for agent workflows

### Source

OpenAI evaluation best practices: https://developers.openai.com/api/docs/guides/evaluation-best-practices

### Source Type

official_docs

### Practice

Evaluate early and often, combine metrics with human judgment, calibrate automated scoring, and test agent handoff accuracy.

### Problem Solved

LLM workflow nondeterminism cannot be validated by ordinary deterministic tests alone.

### Possible Relevance to spec-first

Supports future CUD quality evals and review feedback loops.

### Linked Capability Gap

CG-005, CG-008.

### Evidence Quality

High external, medium local.

### Counter-signal

Current Cycle 0 does not yet prove a need for L3 eval harness.

### Integration Risk

Medium; evals can ossify prompts or become false confidence.

### Decision

Deferred.

### Integration Target

Future `spec-plan` only if repeated self-reflection failures occur.

### Verification

Require human-reviewed eval rubric and a small fixture set before automation.

## BP-005: Lifecycle-aligned skills and quality gates

### Source

GitHub repo: https://github.com/addyosmani/agent-skills

### Source Type

github_repo

### Practice

Map skills to development lifecycle stages: define, plan, build, verify, review, ship.

### Problem Solved

Clear entrypoints reduce arbitrary agent behavior.

### Possible Relevance to spec-first

spec-first already has this shape; useful as external validation, not roadmap driver.

### Linked Capability Gap

CG-001 only indirectly.

### Evidence Quality

Medium.

### Counter-signal

Command set and lifecycle surface differ from spec-first; copying would duplicate existing workflows.

### Integration Risk

Medium.

### Decision

Watchlist.

### Integration Target

None.

### Verification

Compare only when a current workflow boundary gap exists.

## BP-006: Graph-backed review with explicit limitations

### Source

GitHub repo: https://github.com/tirth8205/code-review-graph

### Source Type

github_repo

### Practice

Use code graph / blast radius to reduce context and focus reviews; document limitations and precision/recall tradeoffs.

### Problem Solved

Token waste and incomplete impact analysis.

### Possible Relevance to spec-first

spec-first already consumes GitNexus / code-review-graph as external providers.

### Linked Capability Gap

CG-004.

### Evidence Quality

Medium.

### Counter-signal

Current self-reflection mostly reviews prose/workflow docs; graph queries returned no process evidence for prose concepts.

### Integration Risk

Medium if graph facts are treated as confirmed truth.

### Decision

Accepted as degraded-evidence rule, not as new provider work.

### Integration Target

Self-reflection report trust labels.

### Verification

Reports must state graph freshness and fallback evidence.

## BP-007: Artifact graph and status checks

### Source

Local reference: `/Users/kuang/xiaobu/OpenSpec`; external repo metadata: OpenSpec docs/README.

### Source Type

local_reference / github-style project

### Practice

Use artifact status to guide propose -> specs -> design -> tasks -> apply -> verify -> archive.

### Problem Solved

Prevents implementation before required artifacts are complete.

### Possible Relevance to spec-first

Useful for CUD feedback trace, but spec-first should avoid heavy state machine semantics.

### Linked Capability Gap

CG-003.

### Evidence Quality

Medium.

### Counter-signal

OpenSpec's artifact graph could become heavier than spec-first wants.

### Integration Risk

Medium/high.

### Decision

Watchlist / partial accepted as human-readable feedback fields only.

### Integration Target

Future CUD report frontmatter/prose, not runtime engine.

### Verification

Doc-review checks whether CUD status is advisory and not a hidden gate.

## BP-008: Plan handoff and verification-before-completion

### Source

Local references: `/Users/kuang/xiaobu/superpowers`, `/Users/kuang/xiaobu/get-shit-done`, `/Users/kuang/xiaobu/CodeStable`.

### Source Type

local_reference

### Practice

Plans are handoff contracts; completion claims require verification evidence; knowledge follows acceptance.

### Problem Solved

Prevents execution-time freeform drift and false completion claims.

### Possible Relevance to spec-first

Directly matches current `spec-plan -> spec-write-tasks -> spec-work -> review -> compound`.

### Linked Capability Gap

CG-003, CG-005.

### Evidence Quality

Medium.

### Counter-signal

Some local systems use stricter gates or heavier runtime than spec-first.

### Integration Risk

Low if used as principle, high if copied as state machine.

### Decision

Accepted as review expectation principle.

### Integration Target

CUD plan handoff and verification sections.

### Verification

Review confirms every Accepted CUD names validation and compound feedback.

## BP-009: Self-correction memory

### Source

Local reference: `/Users/kuang/xiaobu/pro-workflow`.

### Source Type

local_reference

### Practice

Capture corrections into persistent memory and replay relevant learnings.

### Problem Solved

Prevents repeated mistakes across sessions.

### Possible Relevance to spec-first

Similar goal to compound knowledge.

### Linked Capability Gap

CG-007.

### Evidence Quality

Medium as local pattern, weak fit for current spec-first.

### Counter-signal

SQLite/hooks/auto-load memory would add hidden runtime state and source/runtime ambiguity.

### Integration Risk

High.

### Decision

Deferred / watchlist.

### Integration Target

None this cycle.

### Verification

Only revisit after repeated compound retrieval failures.

## GitHub Similar Project Comparison

| Project | Problem Area | Relevant Mechanism | What spec-first can learn | What not to copy | Evidence Quality | Decision |
|---|---|---|---|---|---|---|
| `openai/codex` | coding agent host | repo-local instructions via AGENTS.md | verify instruction source precedence | host implementation internals | high for Codex docs, medium for repo README | watchlist |
| `agentsmd/agents.md` | instruction format | simple open AGENTS.md format | keep AGENTS.md concise and project-local | assume all hosts share exact precedence | medium | watchlist |
| `addyosmani/agent-skills` | skill lifecycle | define/plan/build/verify/review/ship | lifecycle clarity and quality gates | duplicate command taxonomy | medium | watchlist |
| `tirth8205/code-review-graph` | graph-backed review | blast radius, token reduction, limitations | explicit graph limitations and freshness | treat graph as source truth | medium | accepted for CG-004 principle |
| `BloopAI/vibe-kanban` | multi-agent work tracking | coding agent task board | visualize task state externally | build a central runtime manager | low/medium | watchlist |
| `MrLesk/Backlog.md` | human/AI backlog | git-based markdown backlog | lightweight repo-local planning artifacts | replace spec-first plan/tasks with backlog engine | medium | watchlist |
| `langgenius/dify` | agentic workflow platform | production app/workflow orchestration | observability as product value | heavy app platform/runtime | low for spec-first fit | skipped |
| `microsoft/agent-framework` | multi-agent framework | framework-level orchestration | evaluation of handoffs | framework dependency | low/medium | watchlist |

## Local Reference Comparison

| Local project | Relevant mechanism | What spec-first can learn | What not to copy | Decision |
|---|---|---|---|---|
| `everything-claude-code` | `/evolve`, continuous learning, eval harness, many agents | self-improvement can produce useful patterns | automatic generation of evolved files without CUD | watchlist/defer |
| `spec-kit` | spec -> plan -> tasks templates and workflow gates | traceability and task dependency clarity | rigid resumable workflow state engine | watchlist |
| `OpenSpec` | artifact graph, status, verify/archive | artifact completeness checks | workflow status as central state machine | partial accepted as advisory fields |
| `CodeStable` | feature design -> impl -> accept -> learn | acceptance + compound loop | broad command family | accepted as principle |
| `skills` | small composable engineering skills | compact skills and domain setup | issue tracker state machine as default | watchlist |
| `superpowers` | writing-plans handoff, verification-before-completion | plan as execution protocol; no success without proof | subagent-first as universal default | accepted as principle |
| `compound-engineering-plugin` | plan handoff routing regression tests, compound docs | inline handoff must be testable/reviewable | CE-specific command wiring | accepted as local evidence |
| `sdd-riper` | spec as truth, phase gates, reverse sync | spec protects context and review | strict state machine as default | watchlist |
| `pro-workflow` | self-correcting memory, context optimizer | corrections should compound | SQLite/hooks hidden memory layer | deferred |
| `get-shit-done` | discuss -> plan -> execute -> verify, gap closure plans | verification gaps feed new plans | heavy `.planning/` project runtime | watchlist |

## Practices Linked To Current Capability Gaps

| Practice | Linked gap | CUD path |
|---|---|---|
| Simple composable workflows | CG-001, CG-006 | CUD-001, CUD-005 |
| Evidence intake with counter-signals | CG-002 | CUD-002 |
| Plan handoff + verification-before-completion | CG-003, CG-005 | CUD-003 |
| Graph limitations / freshness labels | CG-004 | CUD-004 |
| Eval-driven agent workflow evaluation | CG-008 | CUD-008 deferred |

## Practices Not Linked To Any Current Gap

- Full autonomous multi-agent runtime platforms.
- Visual Kanban boards as primary state.
- SQLite self-correction memory.
- Agent framework migration.
- Automatic evolved skill generation.

## What spec-first can learn

- Self-upgrade should be a feedback loop, not a one-shot audit.
- External practices need evidence quality and counter-signal fields.
- Graph facts are valuable only when freshness and limitations are explicit.
- Plan handoff should identify validation and compound paths.
- 30-cycle iteration should check whether prior CUDs changed behavior, were rejected, or caused bloat.

## What spec-first should not copy

- Heavy state machines.
- Hidden runtime memory as source truth.
- New agents for every lens before a named gap proves need.
- Command proliferation.
- Auto-rewrite/evolve behavior.
- Roadmaps derived from popularity instead of internal capability gaps.
