<div align="center">

# spec-first

[![npm version](https://img.shields.io/npm/v/spec-first.svg)](https://www.npmjs.com/package/spec-first)
[![license](https://img.shields.io/npm/l/spec-first.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/spec-first.svg)](./package.json)
[![CI](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml/badge.svg)](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml)
[![docs](https://img.shields.io/badge/docs-spec--first.cn-0b7285.svg)](http://spec-first.cn/)

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Spec-driven AI engineering workflows for Claude Code and Codex.**

`spec-first` turns AI coding sessions into a repeatable engineering loop: prepare the environment and code graph, shape ideas into requirements, review docs, plan implementation, compile task packs, execute/debug/optimize/polish work, audit quality, and compound learnings.

It keeps deterministic setup in scripts while leaving product judgment, implementation tradeoffs, and review decisions to the LLM.

Official site: [spec-first.cn](http://spec-first.cn/)

</div>

---

## See It In 90 Seconds

![spec-first workflow flow](./docs/assets/readme/spec-first-flow.svg)

```text
Loose idea
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
docs/brainstorms/2026-05-01-001-cli-onboarding-requirements.md
docs/plans/2026-05-01-001-feat-cli-onboarding-plan.md
docs/tasks/2026-05-01-001-feat-cli-onboarding-tasks.md
```

The first brainstorm run usually creates only the requirements brief. The plan, task-pack, work, review, debug, and compound entries add their own artifacts when you choose to continue the chain.

For the detailed walkthrough, see [Chinese First Workflow Walkthrough](./docs/05-用户手册/09-首次工作流走查.md).

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
- Claude Code or Codex installed, with one chosen as the current host.
- A terminal opened at the root of the project repo where you want to enable `spec-first`. First-time users can try a throwaway/test repo before initializing a real project.

Terminal commands:

```bash
npm install -g spec-first
spec-first doctor
```

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
  | /spec:mcp-setup       or $spec-mcp-setup
  | /spec:graph-bootstrap or $spec-graph-bootstrap
  v
Choose the next workflow in the host session
  |
  +-- Rough idea or product problem
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
| Single repo / multi module | One Git repo contains multiple apps, packages, services, or Android modules | Same repo root | Do not create one `.spec-first` per module; plans, task packs, work, and reviews split and route work by module inside the repo. |
| Multi repo workspace | A parent directory contains multiple independent child Git repos | Each child repo's own repo root | The parent workspace only discovers and suggests candidates; repo-local setup, graph, plan, work, and review actions must target an explicit child repo. |

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
- In a multi-repo workspace, the parent directory does not own repo-local truth. When operating on a child repo from the parent workspace, pass an explicit `--repo <child>`, and make plans or tasks carry `target_repo` or per-unit/per-task `target_repo`.
- `mode:headless`, `mode:report-only`, `mode:autofix`, `depth:deep`, and similar flags are workflow or skill runtime postures, not development-mode categories.

## What You Get

`spec-first` models AI-assisted development as a small set of durable entities and event-driven flows.

### Durable entities

| Entity | Typical location | Role |
|---|---|---|
| Requirements brief | `docs/brainstorms/` | Captures the problem, actors, flows, constraints, and acceptance examples before implementation pressure takes over. |
| Implementation plan | `docs/plans/` | Turns a settled goal into scoped implementation units, tradeoffs, verification targets, and non-goals. |
| Task pack | `docs/tasks/` | Provides structured handoff when a plan needs deterministic task identity, dependency order, and validation. |
| App consistency audit run | `.spec-first/app-audit/runs/<run-id>/` | Captures static PRD, Figma, source, route, architecture, analytics, and i18n consistency evidence before runtime validation. |
| Review/debug evidence | Workflow output, diffs, tests, reports | Keeps code review and failure diagnosis tied to concrete evidence rather than vibes. |
| Learning | `docs/solutions/` | Compounds solved problems into reusable engineering knowledge. |

Repo-relative artifact roots:

```text
docs/
  brainstorms/   requirements briefs from early problem framing
  plans/         implementation plans ready for review and execution
  tasks/         derived task packs when a plan needs structured handoff
  solutions/     reusable learnings captured after solving problems
.spec-first/
  app-audit/runs/ static App consistency audit facts and reports
```

Not every workflow writes every artifact; each entrypoint writes only the artifact that fits its role.

For who creates, reads, and should edit each artifact, see [Chinese Artifact Catalog](./docs/05-用户手册/10-产物目录.md).

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
  brainstorms -> plans -> tasks -> work/review/debug -> learnings
```

Source-of-truth assets live in the repository. Generated runtime copies under `.claude/`, `.codex/`, and `.agents/skills/` are disposable and can be rebuilt with `spec-first init`.

Runtime shape after init:

```text
your-project/
├── docs/
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
| Problem framing | `/spec:brainstorm` or `$spec-brainstorm` | The original need, user-facing goal, boundaries, and acceptance examples. |
| Implementation planning | `/spec:plan` or `$spec-plan` | Architecture choices, implementation units, verification scope, and known unknowns. |
| Work execution | `/spec:work` or `$spec-work` | Code changes, focused tests, verification notes, and scope control. |
| App consistency audit | `/spec:app-consistency-audit` or `$spec-app-consistency-audit` | PRD, Figma, source, route, KMP/Clean Architecture, analytics, i18n, and rule-pack consistency before runtime validation. |
| Quality and recovery | `/spec:code-review`, `$spec-code-review`, `/spec:debug`, `$spec-debug` | Findings, residual risks, root cause, fix, and evidence. |
| Knowledge compounding | `/spec:compound` or `$spec-compound` | Reusable lessons after a problem is solved. |

## Choose Your Path

| If you have... | Start here | Expected result |
|---|---|---|
| A rough idea or product problem | `/spec:brainstorm` or `$spec-brainstorm` | Requirements brief under `docs/brainstorms/` |
| A settled goal but no implementation strategy | `/spec:plan` or `$spec-plan` | Plan under `docs/plans/` |
| A plan or task pack ready to execute | `/spec:work` or `$spec-work` | Code changes, tests, and verification notes |
| A mobile App change needs PRD/Figma/source consistency before QA | `/spec:app-consistency-audit` or `$spec-app-consistency-audit` | Static audit report and run-scoped evidence under `.spec-first/app-audit/runs/` |
| A failing test, bug, or confusing error | `/spec:debug` or `$spec-debug` | Root cause, fix, and verification evidence |
| A diff that needs confidence before merge | `/spec:code-review` or `$spec-code-review` | Structured findings and residual risks |

## Core Workflows

| I want to... | Claude Code | Codex | Expected result |
|---|---|---|---|
| Explore an idea | `/spec:brainstorm` | `$spec-brainstorm` | Requirements brief under `docs/brainstorms/` |
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
- **What gets written:** repo-local docs, plans, task packs, review/debug artifacts, and managed runtime assets during init.
- **What is generated:** `.claude/`, `.codex/`, and `.agents/skills/` runtime copies.
- **What should be edited:** source assets under `skills/`, `agents/`, `templates/`, `src/cli/`, and docs. Rebuild runtime copies instead of hand-editing them.
- **What spec-first does not do:** it is not a generic agent marketplace, not a single prompt pack, and not a standalone app that works without Claude Code or Codex.

Use the installed standalone `write-tasks` skill when a plan needs a deterministic task-pack handoff before execution.

Use `spec-first clean --claude` or `spec-first clean --codex` to remove managed runtime assets.

## Use spec-first when

Use `spec-first` when:

- You already use Claude Code or Codex and want project-local workflows instead of one-off prompts.
- You want AI coding work to leave durable requirements, plans, review findings, and learnings.
- You want scripts to handle deterministic setup while keeping semantic judgment with the LLM.
- You want a lightweight workflow layer that can be regenerated from source assets.

It may not fit when you only need a single prompt snippet, a generic agent marketplace, a no-host standalone app, or a team process that does not want workflow artifacts written into the repo.

## Documentation

Official site and language entrypoints:

- [spec-first.cn](http://spec-first.cn/)
- [English README](./README.md)
- [简体中文 README](./README.zh-CN.md)

Learn the model:

- [Chinese User Manual](./docs/05-用户手册/README.md)
- [Chinese Core Concepts](./docs/05-用户手册/02-核心概念.md)
- [Chinese Architecture Overview](./docs/02-架构设计/01-整体架构.md)

Use workflows:

- [Chinese Quickstart](./docs/05-用户手册/01-快速开始.md)
- [Chinese First Workflow Walkthrough](./docs/05-用户手册/09-首次工作流走查.md)
- [Chinese Workflows and Artifacts Map](./docs/05-用户手册/04-workflows-artifacts-map.md)

Develop and contribute:

- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [License](./LICENSE)
- [Chinese Development Guide](./docs/03-实施方案/06-开发规范.md)
- [Chinese Testing Plan](./docs/03-实施方案/04-测试方案.md)

Release history:

- [Chinese Release Notes](./docs/08-版本更新/README.md)

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
| Execute work with Codex delegation beta | `/spec:work-beta` | `$spec-work-beta` |
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

- Use the current host's setup workflow to install and verify the required harness runtime: Serena, Sequential Thinking, Context7, GitNexus, code-review-graph, `agent-browser`, `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`, `ast-grep`, and the global `ast-grep` skill.
- Use the current host's graph bootstrap workflow after setup reports `baseline_ready=true`. It reads setup-owned config facts, validates provider command arrays, runs transient GitNexus/code-review-graph probes, and writes `.spec-first/graph/*`, `.spec-first/providers/*`, and `.spec-first/impact/*` readiness artifacts.
- Use the current host's plan workflow as the first graph-readiness consumer. It reports graph status, checks staleness, and falls back to bounded direct repo reads when facts are unavailable, blocked, stale, or degraded.
- In a parent workspace with multiple child Git repos, read-only code questions can use `workspace-graph-targets.v1` advisory facts to choose bounded candidate repos and prefer GitNexus-first evidence. Writes, tests, changelog updates, review autofix, and commits still require explicit `target_repo` / per-child scope.
- For parent-workspace maintenance, setup and graph bootstrap default to all child repos when no `--repo <child>` is provided; `--repo <child>` narrows the run and `--all-repos` remains an explicit equivalent. First-time Serena activation still needs per-child language evidence, so language-gated children report `serena_language_required` until the agent reruns setup with `--serena-language-for <child>=<language>`. The parent workspace may write advisory `.spec-first/workspace/*summary.json` files, but never owns repo-local `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, `.spec-first/providers/*`, or `.serena/*` artifacts.
- Use the installed standalone `write-tasks` skill for deterministic task-pack handoff, then the current host's work, code-review, and doc-review workflows with the current request, plans/task packs, diffs, targeted file reads, and tests as scope authority.
- Use the App consistency audit workflow for mobile App PRD/Figma/source alignment. It consumes local `prd:<path>` and `figma-context:<path>` inputs when available; `figma-ref:<id-or-url>` is only a reference until a host-provided Figma MCP capability materializes local JSON. Figma MCP is an optional App-audit capability, not part of the required setup baseline.

CLI reference:

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan-path> [--json]
spec-first tasks validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]
```

Runtime asset summary:

| Layer | Current Contract |
|---|---|
| **Capability layer** | Bundled source assets ship with `41` skills, `51` agents and no agent support files. Runtime delivery is host-filtered by governance: the current bundle installs `20` commands + `2` standalone skills + `2` agent-facing internal skills on Claude, and `20` workflow skills + `2` standalone skills + `2` agent-facing internal skills on Codex, with `51` agents on both hosts |
| **Claude runtime** | Commands are generated under `.claude/commands/spec`, standalone and agent-facing internal skills under `.claude/skills`, command-backed workflow skill copies under `.claude/spec-first/workflows`, agents under `.claude/agents`, and managed state under `.claude/spec-first/state.json`. |
| **Codex runtime** | Workflow, standalone, and agent-facing internal skills are generated under `.agents/skills`, agents under `.codex/agents`, and managed state under `.codex/spec-first/state.json`. |
| **Readiness** | The setup workflow writes readiness ledger v2 plus setup-owned `graph-providers.json`, `runtime-capabilities.json`, and `provider-artifacts.json`; the graph bootstrap workflow consumes those facts and writes canonical graph facts, provider status, impact capabilities, and a report. |

Expected Claude init output includes:

```text
📦 Generated 20 command file(s) in .claude/commands/spec
🧩 Generated 4 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
Next steps:
  1. Restart Claude Code or open a new session so the host loads the generated /spec:* commands.
  2. In the new session, run /spec:mcp-setup to install and verify the required MCP/helper runtime.
  3. If /spec:mcp-setup shows graph bootstrap is still pending, run /spec:graph-bootstrap when prompted.
```

Expected Codex init output includes:

```text
🧩 Generated 24 skill directory(ies) in .agents/skills
🤖 Generated 51 agent file(s) in .codex/agents
Next steps:
  1. Restart Codex or open a new session so the host loads the generated $spec-* skills.
  2. In the new session, run $spec-mcp-setup to install and verify the required MCP/helper runtime.
  3. If $spec-mcp-setup shows graph bootstrap is still pending, run $spec-graph-bootstrap when prompted.
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
npm run test:release
npm run build
npm test
```

`npm run build` runs `npm pack --dry-run` and verifies the package payload shape through npm.

When changing source assets, edit `skills/`, `agents/`, `templates/`, or `src/cli/`, then regenerate runtime copies with `spec-first init --claude` or `spec-first init --codex` in a fresh host session.

For contribution and support details, see [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), [LICENSE](./LICENSE), and [GitHub Issues](https://github.com/sunrain520/spec-first/issues).
