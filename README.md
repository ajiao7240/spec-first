<div align="center">

# spec-first

[![npm version](https://img.shields.io/npm/v/spec-first.svg)](https://www.npmjs.com/package/spec-first)
[![license](https://img.shields.io/npm/l/spec-first.svg)](https://github.com/sunrain520/spec-first/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/spec-first.svg)](https://github.com/sunrain520/spec-first/blob/main/package.json)
[![CI](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml/badge.svg)](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml)
[![docs](https://img.shields.io/badge/docs-spec--first.cn-0b7285.svg)](http://spec-first.cn/)

[English](https://github.com/sunrain520/spec-first/blob/main/README.md) | [简体中文](https://github.com/sunrain520/spec-first/blob/main/README.zh-CN.md)

**Spec-driven AI engineering workflows for Claude Code and Codex.**

`spec-first` turns AI coding sessions into a repeatable engineering loop: prepare the environment and code graph, shape ideas into requirements, review docs, plan implementation, compile task packs, execute/debug/optimize/polish work, audit quality, and compound learnings.

It keeps deterministic setup in scripts while leaving product judgment, implementation tradeoffs, and review decisions to the LLM.

Official site: [spec-first.cn](http://spec-first.cn/)

</div>

---

## See It In 90 Seconds

![spec-first workflow flow](https://raw.githubusercontent.com/sunrain520/spec-first/main/docs/assets/readme/spec-first-flow.svg)

```text
Open-ended improvement question
  -> $spec-ideate or /spec:ideate
  -> docs/ideation/YYYY-MM-DD-topic-ideation.md
  -> choose one rough idea
  -> $spec-brainstorm or /spec:brainstorm
  -> docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md
  -> $spec-plan or /spec:plan
  -> docs/plans/YYYY-MM-DD-NNN-topic-plan.md
  -> $spec-work or /spec:work
  -> code, tests, and verification notes
  -> $spec-code-review or /spec:code-review
  -> structured findings and residual risks
```

The point is not another prompt snippet. The point is a durable project-local workflow where each AI session leaves useful engineering context for the next one.

## A Tiny Example

Input inside your current host session:

```text
$spec-brainstorm "Improve onboarding for first-time CLI users"
```

Claude Code users can run `/spec:brainstorm "Improve onboarding for first-time CLI users"` instead.

A complete workflow chain can leave artifacts like:

```text
docs/ideation/2026-05-01-cli-onboarding-ideation.md
docs/brainstorms/2026-05-01-001-cli-onboarding-requirements.md
docs/plans/2026-05-01-001-feat-cli-onboarding-plan.md
docs/tasks/2026-05-01-001-feat-cli-onboarding-tasks.md
```

Use `ideate` first when you want the AI to generate and rank options. The first brainstorm run usually creates only the requirements brief for one chosen idea. The plan, task-pack, work, review, debug, and compound entries add their own artifacts when you choose to continue the chain.

For the detailed walkthrough, see [Chinese First Workflow Walkthrough](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/09-%E9%A6%96%E6%AC%A1%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%B5%B0%E6%9F%A5.md).

## Why spec-first?

AI coding breaks down when important decisions live only inside a chat window: the next session misses context, reviewers cannot see why a plan changed, and teams cannot reuse what worked.

`spec-first` is opinionated about the real bottleneck. The hard problem is not only how to make more agents cooperate. The hard problem is how to keep the software lifecycle itself legible: requirements, plans, tasks, diffs, reviews, failures, and learnings must survive beyond one session.

### The core difference: what gets orchestrated

| Question | Agent orchestration tools | spec-first |
|---|---|---|
| Primary unit | Agent, role, team, queue | Requirement, plan, task pack, diff, review, bug, learning |
| Main problem | How should agents coordinate? | How should software decisions stay durable and reusable? |
| State location | Session state, message bus, runtime memory | Repo-local docs, generated runtime assets, and verifiable CLI facts |
| Human role | Minimize intervention where possible | Keep engineers in the loop for scope, tradeoffs, and acceptance |
| Automation boundary | Often pushes toward more autonomous chains | Scripts prepare facts; LLMs make semantic decisions |

This is why `spec-first` gives the work a lightweight shape:

- Requirements become durable briefs instead of disappearing prompts.
- Plans and task packs turn vague intent into reviewable execution context.
- Work, review, debug, and compound workflows preserve evidence and learning.
- Scripts prepare facts and runtime assets; the LLM decides scope, tradeoffs, implementation strategy, and review evidence.
- One source asset set supports Claude Code `/spec:*` entries and Codex `$spec-*` entries without hand-maintaining generated runtime copies.

## Quickstart

Prerequisites:

- Node.js `>=20.0.0` and npm.
- Git on `PATH`; `doctor`, setup, and workflow checks read repository facts from Git.
- Claude Code or Codex installed, with one chosen as the current host.
- A terminal opened at the root of the project repo where you want to enable `spec-first`. First-time users can try a throwaway/test repo before initializing a real project.

Install and run the first health check from the native terminal for your platform.

macOS / Linux:

```bash
npm install -g spec-first
spec-first doctor
```

Windows PowerShell 7+ or Windows PowerShell 5.1:

```powershell
npm install -g spec-first
spec-first doctor
```

Windows cmd.exe:

```bat
npm install -g spec-first
spec-first doctor
```

On Win64, prefer native Windows Terminal with PowerShell 7+ or `cmd.exe` for installation and smoke checks. Windows PowerShell 5.1 is supported, but PowerShell 7+ has better UTF-8 behavior. Git Bash, MSYS2, and WSL are useful POSIX environments, but they do not replace native Windows validation because npm `.cmd` shims, `%PATH%`, quoting, and code page behavior are different.

Initialize only the host you actually use:

```bash
# Claude Code project
spec-first init --claude -u <name> --lang en

# Codex project
spec-first init --codex -u <name> --lang en
```

Run the init command for each host you actually use. For example, run only `--claude` for Claude Code-only projects, only `--codex` for Codex-only projects, or both when the same repo should support both hosts.

Restart the host or open a new session so it loads the generated runtime assets.

Host-session workflow entries are not shell commands:

```text
# In a Claude Code session
/spec:brainstorm "Improve onboarding"

# In a Codex session
$spec-brainstorm "Improve onboarding"
```

If you are not sure which workflow to use, describe the task or ask what to run next in the host session; `using-spec-first` will recommend one public entrypoint with a reason.

### Fast path vs enhanced readiness

After `doctor`, `init`, and a host restart, you can start lightweight host-session workflows before graph readiness has been compiled. This is the right fast path for docs-only changes, small bug fixes, lightweight planning or review, and first project trials:

```text
$spec-ideate / $spec-brainstorm / $spec-plan / $spec-work / $spec-code-review
/spec:ideate / /spec:brainstorm / /spec:plan / /spec:work / /spec:code-review
```

Use the setup/bootstrap path when the task depends on MCP/helper tools, graph evidence, written project guidance, or cross-module/cross-repo impact analysis. Missing or stale graph facts are degraded evidence to disclose, not a fake success state and not a hard gate for every workflow.

Graph refresh trigger nodes:

| Event or need | Default action |
|---|---|
| First setup or stale provider package projection | Run `/spec:mcp-setup` or `$spec-mcp-setup`; it refreshes setup-owned provider config, not graph indexes. |
| Need current GitNexus readiness | Run `/spec:graph-bootstrap` or `$spec-graph-bootstrap`; this is the explicit graph readiness refresh entrypoint. |
| Branch switch, pull, rebase, merge, or dirty worktree change | The next graph consumer detects stale `source_revision` / `worktree_status_hash`; it does not automatically rebuild indexes. |
| Dirty worktree after setup/init | `/spec:graph-bootstrap` / `$spec-graph-bootstrap` records dirty classification; setup-owned/non-graph metadata dirty can refresh normally, while graph-affecting dirty runs warn-and-continue and writes `dirty-advisory` rather than fresh primary evidence. |
| Lightweight docs, typo, small local bug, or first trial | Continue with limitations and bounded direct reads when graph facts are stale or unavailable. |
| Shared API/route/provider contract, core workflow, cross-module change, or high-risk review | Refresh graph readiness explicitly before claiming graph-backed impact or execution-flow evidence. |

When `$spec-plan` emits `Graph / GitNexus Evidence`, downstream workflows consume it as bounded evidence rather than a new scope authority. `$spec-work` uses it to focus source reads and test selection, then reports `graph_evidence_used`; `$spec-code-review` discloses `Graph evidence:` in Coverage and prefers native GitNexus capabilities such as `api_impact`, `shape_check`, and `tool_map` only when evidence is fresh or session-local; `$spec-debug` may record `graph_evidence` in its hypothesis ledger, but root cause still requires reproduction, source, log, or test confirmation. Stale or degraded evidence falls back to direct source reads and does not block the workflow by itself.

### Readiness ladder

`doctor` is the first health check, not the whole readiness story. Treat the three readiness layers separately:

| Layer | Run | Proves | Does not prove |
|---|---|---|---|
| CLI/runtime health | `spec-first doctor` | Node/Git/package checks, generated host runtime assets, workflow surface, and stale verification evidence. | MCP/helper setup, graph provider indexes, or `query_ready` graph facts. |
| Harness setup | `/spec:mcp-setup` or `$spec-mcp-setup` | Required MCP/helper runtime facts and setup-owned provider config artifacts. | Provider indexes are built or graph queries are ready. |
| Graph readiness | `/spec:graph-bootstrap` or `$spec-graph-bootstrap` | Canonical `.spec-first/graph/*`, `.spec-first/providers/*`, and `.spec-first/impact/*` readiness facts for downstream workflows. | That any specific graph result is semantically relevant; the LLM still decides how to use evidence. |

If `doctor` passes but a graph-heavy workflow reports missing or stale graph evidence, continue with the setup/bootstrap layers instead of treating `doctor` as a graph readiness gate.

### You are done when

The first brainstorm run produces a requirements brief such as:

```text
docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md
```

From there, continue to the current host's plan entrypoint.

## End-To-End Development Flow

Use this map to see where shell commands stop and host-session workflows begin:

```text
Terminal in your target repo
  |
  | npm install -g spec-first
  | spec-first doctor
  | spec-first init --claude -u <name> --lang en
  |   or
  | spec-first init --codex -u <name> --lang en
  v
Restart Claude Code or Codex
  |
  +-- Fast path for lightweight docs, small fixes, first trials
  |     -> /spec:ideate / $spec-ideate
  |     -> /spec:brainstorm / $spec-brainstorm
  |     -> /spec:plan / $spec-plan
  |     -> /spec:work / $spec-work
  |     -> /spec:code-review / $spec-code-review
  |
  +-- Enhanced readiness for graph-heavy or cross-module work
        -> /spec:mcp-setup       or $spec-mcp-setup
        -> /spec:graph-bootstrap or $spec-graph-bootstrap
  v
Choose the next workflow in the host session
  |
  +-- Need options, critiques, or improvement ideas
  |     -> /spec:ideate or $spec-ideate
  |     -> docs/ideation/*-ideation.md
  |
  +-- Rough product problem or feature idea
  |     -> /spec:brainstorm or $spec-brainstorm
  |     -> docs/brainstorms/*-requirements.md
  |
  +-- Settled goal, unclear implementation path
  |     -> /spec:plan or $spec-plan
  |     -> docs/plans/*-plan.md
  |
  +-- Large plan that needs deterministic task handoff
  |     -> installed standalone write-tasks skill
  |     -> docs/tasks/*-tasks.md
  |
  +-- Plan or task pack ready to execute
  |     -> /spec:work or $spec-work
  |     -> code, tests, and verification notes
  |
  +-- Mobile App change before runtime QA
  |     -> /spec:app-consistency-audit or $spec-app-consistency-audit
  |     -> .spec-first/app-audit/runs/<run-id>/
  |
  +-- Failure, bug, or confusing error
  |     -> /spec:debug or $spec-debug
  |     -> root cause, fix, and verification evidence
  v
Before merge or handoff
  |
  | /spec:code-review or $spec-code-review
  | /spec:doc-review  or $spec-doc-review
  v
After the problem is solved
  |
  | /spec:compound or $spec-compound
  v
Durable repo context for the next AI coding session
```

Not every project passes through every node. Pick the entrypoint that matches the current state, and ask the host session what to run next when the state is unclear.

## Current Engineering Loop

The flow above is the common first-run path. The full loop is broader:

```text
mcp-setup / graph-bootstrap
  -> ideate
  -> brainstorm
  -> doc-review
  -> plan
  -> write-tasks
  -> work / debug / optimize / polish
  -> code-review / app-consistency-audit
  -> compound / compound-refresh / sessions / slack-research / skill-audit
  -> back into project knowledge, docs, skills, and future workflow choices
```

Read this as an engineering loop, not a mandatory command chain. Enter at the node that matches the current state; the host guidance can recommend one public entrypoint when the next step is unclear. `write-tasks` is a standalone skill, and browser-visible polishing is currently exposed as `polish-beta`.

Use `ideate` when you want options, critiques, or surprising directions before committing to a problem frame. Use `brainstorm` when you already have a rough problem or feature and need a requirements brief with actors, flows, boundaries, and acceptance examples. Use `doc-review` when a requirements, plan, or task document already exists and needs gap-finding. Do not make `brainstorm` the default entrypoint for every unclear request.

| Need | Better entrypoint |
|---|---|
| "What should we improve?" or "give me ideas" | `ideate` |
| "I have this rough product problem; shape it" | `brainstorm` |
| "This requirements or plan document has gaps" | `doc-review` |

| Layer | Nodes | What it answers | Durable output |
|---|---|---|---|
| Capability foundation | `mcp-setup`, `graph-bootstrap` | Can the AI use the right tools, and does it have current codebase facts? | Setup reports, provider config, graph readiness facts, impact capability facts. |
| Requirement shaping | `ideate`, `brainstorm`, `doc-review` | Is the problem worth pursuing, clear enough, and free of obvious document gaps? | Ideas, requirements briefs, review findings, risks, and open questions. |
| Design and handoff | `plan`, standalone `write-tasks` skill | How should the change be built, and how can a large plan become executable work? | Implementation plans and validated task packs. |
| Engineering execution | `work`, `debug`, `optimize`, `polish` | How do we implement, fix, improve, or finish the change? | Code changes, tests, fixes, measurements, and verification notes. |
| Quality gates | `code-review`, `app-consistency-audit` | Is the result aligned with the plan, code quality expectations, and App/product consistency? | Review findings, residual risks, and run-scoped audit evidence. |
| Knowledge and evolution | `compound`, `compound-refresh`, `sessions`, `slack-research`, `skill-audit` | What should be reused, refreshed, recovered from history, learned from the team, or improved in spec-first itself? | Learnings, refreshed context, session summaries, organizational research, and skill audit findings. |

The boundary stays lightweight: scripts and CLI commands prepare facts; the LLM decides scope, tradeoffs, next workflow, implementation judgment, and review conclusions. The last layer feeds better docs, skills, and project memory back into the next loop instead of turning `spec-first` into a rigid state machine.

## Supported Development Modes

`spec-first` defines development modes by repository and project topology, not by a workflow's `mode:*` argument. The current supported modes are:

| Mode | Typical shape | `.spec-first` authority boundary | How spec-first treats it |
|---|---|---|---|
| Single repo / single project | One Git repo contains one app, SDK, CLI, or service | Current repo root | Requirements, plans, work, reviews, and graph facts are scoped to the current repo. |
| Single repo / multi module | One Git repo contains multiple apps, packages, services, or Android modules | Same repo root | Do not create one `.spec-first` per module; plans, task packs, work, and reviews split and route work by module inside the repo. Monorepo modules are not GitNexus group members. |
| Multi repo workspace | A parent directory contains multiple independent child Git repos | Each child repo's own repo root; parent workspace artifacts are advisory only | The parent workspace discovers candidates, may write advisory workspace summaries, and may use GitNexus group readiness for read-only routing; repo-local setup, graph, plan, work, and review actions must target an explicit child repo. |

```text
Single repo / single project
my-app/
  .git/
  .spec-first/
  src/

Single repo / multi module
platform/
  .git/
  .spec-first/
  apps/web/
  apps/mobile/
  packages/core/

Multi repo workspace
workspace/
  frontend/
    .git/
    .spec-first/
  backend/
    .git/
    .spec-first/
  mobile/
    .git/
    .spec-first/
```

The core contract is: `.spec-first` facts are authoritative at the **selected Git repo root**.

- In a multi-module repo, do not place separate `.spec-first` directories under each module. That splits plans, reviews, graph facts, and knowledge.
- In a multi-repo workspace, the parent directory does not own repo-local truth. Parent workspace summaries, including `.spec-first/workspace/gitnexus-readiness.json`, are advisory only; plans, task packs, setup, graph bootstrap, work, review, tests, changelog updates, and commits still carry `target_repo` or per-unit/per-task `target_repo`.
- `mode:headless`, `mode:report-only`, `mode:autofix`, `depth:deep`, and similar flags are workflow or skill runtime postures, not development-mode categories.

## What You Get

`spec-first` models AI-assisted development as a small set of durable entities and event-driven flows.

### Durable entities

| Entity | Typical location | Role |
|---|---|---|
| Ideation shortlist | `docs/ideation/` | Ranks and critiques candidate ideas before one is selected for requirement shaping. |
| Requirements brief | `docs/brainstorms/` | Captures the problem, actors, flows, constraints, and acceptance examples before implementation pressure takes over. |
| Implementation plan | `docs/plans/` | Turns a settled goal into scoped implementation units, tradeoffs, verification targets, and non-goals. |
| Task pack | `docs/tasks/` | Provides structured handoff when a plan needs deterministic task identity, dependency order, and validation. |
| App consistency audit run | `.spec-first/app-audit/runs/<run-id>/` | Captures static PRD, Figma, source, route, architecture, analytics, and i18n consistency evidence before runtime validation. |
| Review/debug evidence | Workflow output, diffs, tests, reports | Keeps code review and failure diagnosis tied to concrete evidence rather than vibes. |
| Learning | `docs/solutions/` | Compounds solved problems into reusable engineering knowledge. |

Repo-relative artifact roots:

```text
docs/
  ideation/      ranked idea candidates before requirements shaping
  brainstorms/   requirements briefs from early problem framing
  plans/         implementation plans ready for review and execution
  tasks/         derived task packs when a plan needs structured handoff
  solutions/     reusable learnings captured after solving problems
.spec-first/
  app-audit/runs/ static App consistency audit facts and reports
```

Not every workflow writes every artifact; each entrypoint writes only the artifact that fits its role.

For who creates, reads, and should edit each artifact, see [Chinese Artifact Catalog](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/10-%E4%BA%A7%E7%89%A9%E7%9B%AE%E5%BD%95.md).

## How It Works

```text
Source assets
  skills/  agents/  templates/  src/cli/
        |
        | spec-first init --claude or --codex
        v
Host runtime assets
  Claude Code: /spec:* commands
  Codex:      $spec-* skills
        |
        v
Workflow artifacts
  ideation -> brainstorms -> plans -> tasks -> work/review/debug -> learnings
```

Source-of-truth assets live in the repository. Generated runtime copies under `.claude/`, `.codex/`, and `.agents/skills/` are disposable and can be rebuilt with `spec-first init`. During init, spec-first also untracks already-indexed managed runtime paths once, preserving worktree files while preventing historical generated mirrors from creating noisy diffs. For customization, generated runtime, provider evidence, and credential boundaries, see [Source / Runtime / Provider Customization Boundary](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/source-runtime-customization-boundary.md).

Runtime shape after init:

```text
your-project/
├── docs/
│   ├── ideation/
│   ├── brainstorms/
│   ├── plans/
│   ├── tasks/
│   └── solutions/
├── .claude/          # generated when using Claude Code
├── .codex/           # generated when using Codex
├── .agents/skills/   # generated Codex-facing skills
└── AGENTS.md or CLAUDE.md
```

### Main flows

| Flow | Start here | What it stabilizes |
|---|---|---|
| Idea generation | `/spec:ideate` or `$spec-ideate` | Candidate directions, critique, ranking, and the handoff into one selected idea. |
| Problem framing | `/spec:brainstorm` or `$spec-brainstorm` | The original need, user-facing goal, boundaries, and acceptance examples for one chosen idea. |
| Implementation planning | `/spec:plan` or `$spec-plan` | Architecture choices, implementation units, verification scope, and known unknowns. |
| Work execution | `/spec:work` or `$spec-work` | Code changes, focused tests, verification notes, and scope control. |
| App consistency audit | `/spec:app-consistency-audit` or `$spec-app-consistency-audit` | PRD, Figma, source, route, KMP/Clean Architecture, analytics, i18n, and rule-pack consistency before runtime validation. |
| Quality and recovery | `/spec:code-review`, `$spec-code-review`, `/spec:debug`, `$spec-debug` | Findings, residual risks, root cause, fix, and evidence. |
| Knowledge compounding | `/spec:compound` or `$spec-compound` | Reusable lessons after a problem is solved. |

## Choose Your Path

| If you have... | Start here | Expected result |
|---|---|---|
| An open-ended improvement question or you want options | `/spec:ideate` or `$spec-ideate` | Ranked ideation artifact under `docs/ideation/` |
| A rough product problem or feature idea | `/spec:brainstorm` or `$spec-brainstorm` | Requirements brief under `docs/brainstorms/` |
| A settled goal but no implementation strategy | `/spec:plan` or `$spec-plan` | Plan under `docs/plans/` |
| A plan or task pack ready to execute | `/spec:work` or `$spec-work` | Code changes, tests, and verification notes |
| A mobile App change needs PRD/Figma/source consistency before QA | `/spec:app-consistency-audit` or `$spec-app-consistency-audit` | Static audit report and run-scoped evidence under `.spec-first/app-audit/runs/` |
| A failing test, bug, or confusing error | `/spec:debug` or `$spec-debug` | Root cause, fix, and verification evidence |
| A diff that needs confidence before merge | `/spec:code-review` or `$spec-code-review` | Structured findings and residual risks |

## Core Workflows

| I want to... | Claude Code | Codex | Expected result |
|---|---|---|---|
| Generate and rank ideas | `/spec:ideate` | `$spec-ideate` | Ideation artifact under `docs/ideation/` |
| Shape one idea into requirements | `/spec:brainstorm` | `$spec-brainstorm` | Requirements brief under `docs/brainstorms/` |
| Plan implementation | `/spec:plan` | `$spec-plan` | Plan under `docs/plans/` |
| Execute work | `/spec:work` | `$spec-work` | Code, tests, and verification notes |
| Audit App consistency | `/spec:app-consistency-audit` | `$spec-app-consistency-audit` | Static consistency report and scoped audit artifacts |
| Review code | `/spec:code-review` | `$spec-code-review` | Structured findings and residual risks |
| Debug a failure | `/spec:debug` | `$spec-debug` | Root cause, fix, and verification |

## Trust Model

`spec-first` does not ask the LLM to simulate deterministic tooling, and it does not replace LLM judgment with a rigid state machine.

The operating rule is simple: Scripts prepare, LLM decides.

- **What scripts do:** install, validate, generate, clean, hash, and report machine facts.
- **What the LLM decides:** requirements framing, scope boundaries, tradeoffs, implementation judgment, review evidence, and next steps.
- **What gets written:** repo-local docs, plans, task packs, durable review/debug summaries when explicitly routed, and managed runtime assets during init. Full-detail code-review JSON stays under the current OS temp root, for example `<os-temp>/spec-first/spec-code-review/<run-id>/`, as a temporary handoff unless a workflow writes a concise durable summary.
- **What is generated:** `.claude/`, `.codex/`, and `.agents/skills/` runtime copies.
- **What is excluded from ordinary context:** `.spec-first/audits/**` and generated mirrors such as `.claude/**`, `.codex/**`, and `.agents/skills/**`. Runtime/setup/audit workflows may read them only when explicitly needed or when the user names a precise path.
- **What context handoffs prefer:** `artifact-summary.v1` and `context-bundle.v1` style summary-plus-path packets before full artifacts or raw tool output.
- **What should be edited:** source assets under `skills/`, `agents/`, `templates/`, `src/cli/`, and docs. Rebuild runtime copies instead of hand-editing them.
- **How provider/tool facts are used:** GitNexus, browser/MCP tools, shell commands, and package managers provide evidence inputs; they do not own semantic authority. Raw provider/tool output is untrusted quoted data and must be validated, contained, escaped, capped, and classified before it enters prompts, reports, facts, or durable artifacts.
- **Where credentials belong:** provider credentials belong in environment variables, host secret managers, or provider-native stores, not in repo source, generated runtime mirrors, durable artifacts, or raw logs. Rotate them on team/provider cadence and immediately after suspected exposure.
- **What spec-first does not do:** it is not a generic agent marketplace, not a single prompt pack, and not a standalone app that works without Claude Code or Codex.

Use the installed standalone `write-tasks` skill when a plan needs a deterministic task-pack handoff before execution.

Use `spec-first clean --claude` or `spec-first clean --codex` to remove managed runtime assets.

## Use spec-first when

Use `spec-first` when:

- You already use Claude Code or Codex and want project-local workflows instead of one-off prompts.
- You want AI coding work to leave durable requirements, plans, explicitly routed review summaries, and learnings.
- You want scripts to handle deterministic setup while keeping semantic judgment with the LLM.
- You want a lightweight workflow layer that can be regenerated from source assets.

It may not fit when you only need a single prompt snippet, a generic agent marketplace, a no-host standalone app, or a team process that does not want workflow artifacts written into the repo.

## Documentation

Official site and language entrypoints:

- [spec-first.cn](http://spec-first.cn/)
- [English README](https://github.com/sunrain520/spec-first/blob/main/README.md)
- [简体中文 README](https://github.com/sunrain520/spec-first/blob/main/README.zh-CN.md)

Learn the model:

- [Chinese User Manual](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/README.md)
- [Chinese Core Concepts](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/02-%E6%A0%B8%E5%BF%83%E6%A6%82%E5%BF%B5.md)
- [Chinese Architecture Overview](https://github.com/sunrain520/spec-first/blob/main/docs/02-%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/01-%E6%95%B4%E4%BD%93%E6%9E%B6%E6%9E%84.md)
- [Source / Runtime / Provider Customization Boundary](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/source-runtime-customization-boundary.md)

Use workflows:

- [Chinese Quickstart](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/01-%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B.md)
- [Chinese First Workflow Walkthrough](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/09-%E9%A6%96%E6%AC%A1%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%B5%B0%E6%9F%A5.md)
- [Chinese Workflows and Artifacts Map](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/04-workflows-artifacts-map.md)

Develop and contribute:

- [Contributing Guide](https://github.com/sunrain520/spec-first/blob/main/CONTRIBUTING.md)
- [Security Policy](https://github.com/sunrain520/spec-first/blob/main/SECURITY.md)
- [License](https://github.com/sunrain520/spec-first/blob/main/LICENSE)
- [Chinese Development Guide](https://github.com/sunrain520/spec-first/blob/main/docs/03-%E5%AE%9E%E6%96%BD%E6%96%B9%E6%A1%88/06-%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83.md)
- [Chinese Testing Plan](https://github.com/sunrain520/spec-first/blob/main/docs/03-%E5%AE%9E%E6%96%BD%E6%96%B9%E6%A1%88/04-%E6%B5%8B%E8%AF%95%E6%96%B9%E6%A1%88.md)

Release history:

- [Chinese Release Notes](https://github.com/sunrain520/spec-first/blob/main/docs/08-%E7%89%88%E6%9C%AC%E6%9B%B4%E6%96%B0/README.md)

Detailed manuals and implementation docs are currently Chinese-first.

## Full Workflow Reference

| Intent | Claude Code | Codex |
|---|---|---|
| Setup required harness runtime | `/spec:mcp-setup` | `$spec-mcp-setup` |
| Compile graph readiness facts | `/spec:graph-bootstrap` | `$spec-graph-bootstrap` |
| Update spec-first or runtime assets | `/spec:update` | `$spec-update` |
| Search agent session history | `/spec:sessions` | `$spec-sessions` |
| Research Slack context | `/spec:slack-research` | `$spec-slack-research` |
| Audit source skills | `/spec:skill-audit` | `$spec-skill-audit` |
| Generate and evaluate ideas | `/spec:ideate` | `$spec-ideate` |
| Brainstorm requirements | `/spec:brainstorm` | `$spec-brainstorm` |
| Review docs/plans | `/spec:doc-review` | `$spec-doc-review` |
| Write or deepen a plan | `/spec:plan` | `$spec-plan` |
| Compile task pack | use installed standalone `write-tasks` skill | use installed standalone `write-tasks` skill |
| Audit App consistency | `/spec:app-consistency-audit` | `$spec-app-consistency-audit` |
| Debug a failure or bug | `/spec:debug` | `$spec-debug` |
| Execute work | `/spec:work` | `$spec-work` |
| Optimize a measurable outcome | `/spec:optimize` | `$spec-optimize` |
| Polish browser-visible UI beta | `/spec:polish-beta` | `$spec-polish-beta` |
| Review code | `/spec:code-review` | `$spec-code-review` |
| Capture learning | `/spec:compound` | `$spec-compound` |
| Refresh stale learnings | `/spec:compound-refresh` | `$spec-compound-refresh` |
| Read release notes | `/spec:release-notes` | `$spec-release-notes` |

Startup version reminders, when surfaced by the managed Claude hook or Codex top-level workflow-entry guidance, only point to the update entrypoints above. They do not install packages, refresh runtime assets, or restart the host.

## Runtime Reference

`spec-first` provides CLI helpers (`doctor`, `init`, `clean`, `tasks`, version/help output), workflow source assets, host-filtered runtime generation, and public workflow entrypoints for ideation, brainstorming, planning, task-pack handoff, work execution, App consistency audit, debugging, review, setup, update, session research, Slack research, release notes, skill audit, compounding, optimization, and browser-visible polish.

Required harness runtime setup through the current host's setup workflow covers MCP servers, graph-provider MCP servers, helper CLIs, and project setup facts.

External graph readiness compilation through the current host's graph bootstrap workflow produces canonical graph and impact readiness artifacts for downstream workflows.

Current context and graph readiness use this path:

- Use the current host's setup workflow to install and verify the required harness runtime: Sequential Thinking, Context7, GitNexus, `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`, `ast-grep`, and the global `ast-grep` skill. `agent-browser` is a non-blocking browser automation helper capability; set `SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` before setup only when browser evidence or screenshot automation is needed. Setup writes GitNexus availability/discovery facts such as `gitnexus_capability_discovery`; those are setup-inferred native capability hints from the checked-in baseline, provider pin, and setup projection, not query-ready graph evidence or live MCP proof.
- Use the current host's graph bootstrap workflow after setup reports `baseline_ready=true`. It reads setup-owned config facts, validates provider command arrays, runs transient GitNexus probes, and writes `.spec-first/graph/*`, `.spec-first/providers/*`, and `.spec-first/impact/*` readiness artifacts.
- Treat branch switch, pull, rebase, merge, dirty worktree changes, and provider fingerprint mismatch as graph freshness invalidation signals. Downstream workflows may recommend graph bootstrap, but they do not run hidden GitNexus analyze, provider repair, default hooks, watchers, or daemons.
- Use the current host's plan workflow as the first graph-readiness consumer. It reports graph status, reads setup-inferred GitNexus availability/discovery facts when present, checks staleness, and falls back to bounded direct repo reads when facts are unavailable, blocked, stale, or degraded. When no graph artifacts, no GitNexus MCP surface, and no setup-owned GitNexus projection are present, plan takes a no-graph fast path instead of spending tokens on detailed GitNexus probing. For code/architecture/API/cross-module plans with graph or GitNexus evidence available, it writes a neighboring `Graph / GitNexus Evidence` posture with `native_tool_or_resource`, `capability_status`, `evidence_grade`, `evidence_posture`, `freshness_state`, and `source_tags` so readers can see whether checked-in baseline, setup projection, live MCP tool/resource evidence, session-local inference, or source fallback shaped the plan.
- In a parent workspace with multiple child Git repos, read-only code questions can use `workspace-graph-targets.v1` and `workspace-gitnexus-readiness.v1` advisory facts to choose bounded candidate repos, prefer GitNexus-first evidence via group query when `group.status="group-ready"`, and fall back to bounded registry/per-repo fan-out when group config is missing or not evaluated. Outside the parent-workspace maintenance entries below, writes, tests, changelog updates, review autofix, and commits still require explicit `target_repo` / per-child scope.
- Dirty-advisory or stale GitNexus evidence can still orient read-only planning, but it is not fresh primary evidence. Current-source or test-backed claims must be validated with direct source reads before final claims.
- For parent-workspace maintenance, init, setup, and graph bootstrap default to all child repos when no `--repo <child>` is provided; `--repo <child>` narrows the run and `--all-repos` remains an explicit equivalent. The parent workspace may write advisory `.spec-first/workspace/*summary.json` files. The parent workspace never owns repo-local `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, or `.spec-first/providers/*` artifacts as parent-local truth.
- Use the installed standalone `write-tasks` skill for deterministic task-pack handoff, then the current host's work, code-review, and doc-review workflows with the current request, plans/task packs, diffs, targeted file reads, and tests as scope authority.
- Use the App consistency audit workflow for mobile App PRD/Figma/source alignment. It consumes local `prd:<path>` and `figma-context:<path>` inputs when available; `figma-ref:<id-or-url>` is only a reference until a host-provided Figma MCP capability materializes local JSON. Figma MCP is an optional App-audit capability, not part of the required setup baseline.

CLI reference:

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run] [--repo <child>|--all-repos]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan-path> [--json]
spec-first tasks validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]
```

Runtime asset summary:

When `init` is run from a parent workspace that contains child Git repos, it auto-detects the workspace mode, initializes each child repo, and writes only an advisory parent summary at `.spec-first/workspace/init-summary.json`. It does not write parent repo-local artifacts such as `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.codex/`, or `.agents/`. Use `--repo <child>` to initialize one child repo, or `--all-repos` to make the batch intent explicit.

The managed `.gitignore` block also ignores local graph provider artifacts such as `.gitnexus/`; `.code-review-graph/` remains ignored only as migration-window residue.

Detailed runtime capability catalog: [Runtime Capability Catalog](https://github.com/sunrain520/spec-first/blob/main/docs/catalog/runtime-capabilities.md).

| Layer | Current Contract |
|---|---|
| **Capability layer** | Bundled source assets ship with `38` skills, `51` agents and no agent support files. Runtime delivery is host-filtered by governance: the current bundle installs `19` commands + `2` standalone skills + `1` agent-facing internal skills on Claude, and `19` workflow skills + `2` standalone skills + `1` agent-facing internal skills on Codex, with `51` agents on both hosts |
| **Claude runtime** | Commands are generated under `.claude/commands/spec`, standalone and agent-facing internal skills under `.claude/skills`, command-backed workflow skill copies under `.claude/spec-first/workflows`, agents under `.claude/agents`, and managed state under `.claude/spec-first/state.json`. |
| **Codex runtime** | Workflow, standalone, and agent-facing internal skills are generated under `.agents/skills`, agents under `.codex/agents`, and managed state under `.codex/spec-first/state.json`. |
| **Readiness** | The setup workflow writes readiness ledger v2 plus setup-owned `graph-providers.json`, `runtime-capabilities.json`, and `provider-artifacts.json`; the graph bootstrap workflow consumes those facts and writes canonical graph facts, provider status, impact capabilities, and a report. |

Expected Claude init output includes:

```text
📦 Generated 19 command file(s) in .claude/commands/spec
🧩 Generated 3 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
Next steps:
  1. Restart Claude Code or open a new session so the host loads the generated /spec:* commands.
  2. For lightweight docs, small fixes, first trials, or lightweight plan/work/review, start the matching /spec:* workflow in the new session.
  3. For enhanced readiness, run /spec:mcp-setup to install and verify the required MCP/helper runtime.
  4. If /spec:mcp-setup shows graph bootstrap is still pending, run /spec:graph-bootstrap when prompted.
  5. After graph readiness is ready, choose the next workflow by user intent: brainstorm/plan/work/review/debug. Project guidance comes from AGENTS.md, CLAUDE.md, docs/contracts, direct source evidence, tests, and graph facts.
```

Expected Codex init output includes:

```text
🧩 Generated 22 skill directory(ies) in .agents/skills
🤖 Generated 51 agent file(s) in .codex/agents
Next steps:
  1. Restart Codex or open a new session so the host loads the generated $spec-* skills.
  2. For lightweight docs, small fixes, first trials, or lightweight plan/work/review, start the matching $spec-* workflow in the new session.
  3. For enhanced readiness, run $spec-mcp-setup to install and verify the required MCP/helper runtime.
  4. If $spec-mcp-setup shows graph bootstrap is still pending, run $spec-graph-bootstrap when prompted.
  5. After graph readiness is ready, choose the next workflow by user intent: brainstorm/plan/work/review/debug. Project guidance comes from AGENTS.md, CLAUDE.md, docs/contracts, direct source evidence, tests, and graph facts.
```

## Development & Contributing

```bash
npm run typecheck
npm run test:mcp-setup
npm run test:graph-bootstrap
npm run test:unit
npm run test:smoke
npm run test:integration
npm run test:ai-dev:gate
npm run test:ai-dev:benchmarks
npm run test:release
npm run test:release:website
npm run build
npm test
```

`npm run build` runs `npm pack --dry-run` and verifies the package payload shape through npm.

`npm run test:ai-dev:benchmarks` validates the advisory benchmark fixture suite contract and evidence shape across five checked-in fixtures, including recorded semantic-review evidence; it does not score LLM semantic quality or run real agents.

`npm run test:release:install` writes release package evidence under `.spec-first/ci/npm-install-matrix/` when `SPEC_FIRST_SMOKE_ARTIFACT_DIR` is set: package content manifest, tarball-installed Claude/Codex init dry-run logs, and a release artifact summary for reviewers.

`npm run test:release:website` is the maintainer release gate for the external official site. It expects `../spec-first-official-website` or `SPEC_FIRST_WEBSITE_REPO` and runs the website `content:audit` against the current package repo facts.

When changing source assets, edit `skills/`, `agents/`, `templates/`, or `src/cli/`, then regenerate runtime copies with `spec-first init --claude` or `spec-first init --codex` in a fresh host session.

For contribution and support details, see [CONTRIBUTING.md](https://github.com/sunrain520/spec-first/blob/main/CONTRIBUTING.md), [SECURITY.md](https://github.com/sunrain520/spec-first/blob/main/SECURITY.md), [LICENSE](https://github.com/sunrain520/spec-first/blob/main/LICENSE), and [GitHub Issues](https://github.com/sunrain520/spec-first/issues).
