<div align="center">

# spec-first

[![npm version](https://img.shields.io/npm/v/spec-first.svg)](https://www.npmjs.com/package/spec-first)
[![license](https://img.shields.io/npm/l/spec-first.svg)](https://github.com/sunrain520/spec-first/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/spec-first.svg)](https://github.com/sunrain520/spec-first/blob/main/package.json)
[![CI](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml/badge.svg)](https://github.com/sunrain520/spec-first/actions/workflows/npm-install-matrix.yml)
[![docs](https://img.shields.io/badge/docs-spec--first.cn-0b7285.svg)](http://spec-first.cn/)

[English](https://github.com/sunrain520/spec-first/blob/main/README.md) | [简体中文](https://github.com/sunrain520/spec-first/blob/main/README.zh-CN.md)

**Spec-driven AI engineering workflows for Claude Code and Codex.**

`spec-first` turns one-off AI coding chats into a reusable engineering loop: requirements, PRDs, plans, task packs, work, debugging, reviews, and learnings stay in the repository instead of disappearing into a session.

Official site: [spec-first.cn](http://spec-first.cn/)

</div>

---

## See It In 90 Seconds

![spec-first workflow flow](https://raw.githubusercontent.com/sunrain520/spec-first/main/docs/assets/readme/spec-first-flow.svg)

This is the README's maintained demo slot. Today it uses the source-controlled workflow SVG above; a future terminal animation or screenshot can replace this position without restructuring the page.

The point is not another prompt snippet or agent team. `spec-first` organizes engineering artifacts and evidence: requirement briefs, plans, task packs, diffs, reviews, failure analysis, and reusable learnings.

## A Tiny Example

In your current host session:

```text
$spec-brainstorm "Improve onboarding for first-time CLI users"
```

Claude Code users can run:

```text
/spec:brainstorm "Improve onboarding for first-time CLI users"
```

The first brainstorm run usually creates one requirements brief:

```text
docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md
```

From there, continue to the current host's plan entrypoint. A longer chain may later add `docs/plans/`, `docs/tasks/`, code/test changes, review findings, and `docs/solutions/` learnings, but not every workflow writes every artifact.

Detailed walkthrough: [Chinese First Workflow Walkthrough](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/09-%E9%A6%96%E6%AC%A1%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%B5%B0%E6%9F%A5.md). Artifact ownership: [Chinese Artifact Catalog](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/10-%E4%BA%A7%E7%89%A9%E7%9B%AE%E5%BD%95.md).

## Why spec-first?

AI coding breaks down when important decisions live only in chat: the next session lacks context, reviewers cannot see why a plan changed, and teams cannot reuse what worked.

`spec-first` keeps the software lifecycle legible:

| Question | Agent orchestration tools | spec-first |
|---|---|---|
| Primary unit | Agent, role, team, queue | Requirement, plan, task pack, diff, review, bug, learning |
| Main problem | How should agents coordinate? | How should software decisions stay durable and reusable? |
| State location | Session state, message bus, runtime memory | Repo-local docs, generated runtime assets, and verifiable CLI facts |
| Human role | Minimize intervention where possible | Keep engineers in the loop for scope, tradeoffs, and acceptance |
| Automation boundary | Often pushes toward autonomous chains | Scripts prepare facts; LLMs make semantic decisions |

What this buys you:

- Requirements become durable briefs instead of disappearing prompts.
- Plans and task packs turn vague intent into reviewable execution context.
- Work, review, debug, optimize, and compound workflows preserve evidence and learning.
- Knowledge handoffs stay summary-first, and recalled `docs/solutions/` learnings remain advisory until reconfirmed from source evidence.
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

On Win64, prefer native Windows Terminal with PowerShell 7+ or `cmd.exe` for installation and smoke checks. Windows PowerShell 5.1 is supported, but PowerShell 7+ has better UTF-8 behavior.

Initialize the host runtime you actually use:

```bash
spec-first init
```

`spec-first init` is interactive: select Claude Code and/or Codex, then confirm your developer name and language — when a global developer profile already exists, init asks once whether to reuse it instead of re-prompting for the name — preview the writes, then confirm. Use `spec-first init --codex` or `spec-first init --claude` to skip only the host selection step. Use `spec-first init -y` for scripted defaults, or combine `-y` with explicit host flags, `-u <name>`, and `--lang <zh|en>`.

Restart the host or open a new session so it loads the generated runtime assets.

Host-session workflow entries are not shell commands:

```text
# In a Claude Code session
/spec:brainstorm "Improve onboarding"

# In a Codex session
$spec-brainstorm "Improve onboarding"
```

You are done with the first pass when a requirements brief appears under `docs/brainstorms/`. If you are not sure which workflow to use, describe the task or ask what to run next in the host session; `using-spec-first` will recommend one public entrypoint with a reason.

## Workflow Entry Points

Use this single table as the public entrypoint map. Shared prose should say "current host"; concrete `/spec:*` and `$spec-*` mappings belong here and in init/runtime guidance.

| Intent | Claude Code | Codex | Expected result |
|---|---|---|---|
| Runtime setup for required harness readiness | `/spec:mcp-setup` | `$spec-mcp-setup` | Required harness runtime facts, MCP/helper readiness, and setup-owned config artifacts |
| Search agent session history | `/spec:sessions` | `$spec-sessions` | Session history answers and recovery context |
| Research Slack context | `/spec:slack-research` | `$spec-slack-research` | Organizational context digest when Slack tools are available |
| Audit source skills | `/spec:skill-audit` | `$spec-skill-audit` | Skill governance and quality findings |
| Generate and evaluate ideas | `/spec:ideate` | `$spec-ideate` | Ranked ideation artifact under `docs/ideation/` |
| Brainstorm requirements | `/spec:brainstorm` | `$spec-brainstorm` | Requirements brief under `docs/brainstorms/` |
| Write/refine brownfield PRD requirements | `/spec:prd` | `$spec-prd` | PRD-grade requirements under `docs/brainstorms/` |
| Review docs/plans | `/spec:doc-review` | `$spec-doc-review` | Document findings, gaps, and residual risks |
| Write or deepen a plan | `/spec:plan` | `$spec-plan` | Implementation plan under `docs/plans/` |
| Compile task pack | use installed standalone `write-tasks` skill | use installed standalone `write-tasks` skill | Derived task pack under `docs/tasks/` |
| Audit App consistency | `/spec:app-consistency-audit` | `$spec-app-consistency-audit` | Static App consistency report and run-scoped audit evidence |
| Debug a failure or bug | `/spec:debug` | `$spec-debug` | Root cause, fix, and verification evidence |
| Execute work | `/spec:work` | `$spec-work` | Scoped source changes, tests, and verification notes |
| Optimize a measurable outcome | `/spec:optimize` | `$spec-optimize` | Metric-driven experiment loop and retained improvements |
| Polish browser-visible UI beta | `/spec:polish-beta` | `$spec-polish-beta` | Browser-visible UI polish pass |
| Review code | `/spec:code-review` | `$spec-code-review` | Structured findings and residual risks |
| Capture learning | `/spec:compound` | `$spec-compound` | Reusable learning under `docs/solutions/` |
| Refresh stale learnings | `/spec:compound-refresh` | `$spec-compound-refresh` | Updated, merged, or retired solution docs |
| Read release notes | `/spec:release-notes` | `$spec-release-notes` | Version-specific change summary |

Use `ideate` when you want options, critiques, or surprising directions before committing to a problem frame. Use `brainstorm` when you already have a rough problem or feature and need actors, flows, boundaries, and acceptance examples. Use `prd` for existing-system increments or rough PRDs that need current-state evidence and change delta. Use `doc-review` when a requirements, plan, or task document already exists and needs gap-finding. Do not make `brainstorm` the default entrypoint for every unclear request.

To check whether spec-first and its generated runtime assets are up to date, run the `spec-first update` package CLI command in your terminal (check-only, like `npm outdated`; it never auto-upgrades). It is no longer a host workflow entrypoint.

## Operating Model

`spec-first` has two durable surfaces: repo-local workflow artifacts and generated host runtime assets.

Repo-relative artifact roots:

```text
docs/
  ideation/      ranked idea candidates before requirements shaping
  brainstorms/   requirements briefs and PRD-grade requirements
  plans/         implementation plans ready for review and execution
  tasks/         derived task packs for structured handoff
  solutions/     reusable learnings after solving problems
.spec-first/
  app-audit/runs/ static App consistency audit facts and reports
  workflows/spec-work/ structured work closeout evidence
```

Runtime shape:

```text
Source assets
  skills/  agents/  templates/  src/cli/
        |
        | spec-first init
        v
Host runtime assets
  Claude Code: /spec:* commands
  Codex:      $spec-* skills
        |
        v
Workflow artifacts
  ideation -> brainstorms -> plans -> tasks -> work/review/debug -> learnings
```

Source-of-truth assets live in the repository. Generated runtime copies under `.claude/`, `.codex/`, and `.agents/skills/` are disposable and can be rebuilt with `spec-first init`. During init, spec-first also untracks already-indexed managed runtime paths once, preserving worktree files while preventing historical generated mirrors from creating noisy diffs.

The development-mode rule is intentionally small: `.spec-first` facts are authoritative at the selected Git repo root. In a single Git repo with many modules, do not create one `.spec-first` per module. In a parent workspace with many child Git repos, parent workspace summaries are advisory only; setup, plan, work, review, tests, changelog updates, and commits still need an explicit target repo.

Detailed references:

- [Source / Runtime / Provider Customization Boundary](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/source-runtime-customization-boundary.md)
- [Runtime Capability Catalog](https://github.com/sunrain520/spec-first/blob/main/docs/catalog/runtime-capabilities.md)
- [Chinese Development Modes](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/08-%E4%B8%89%E7%A7%8D%E5%BC%80%E5%8F%91%E6%A8%A1%E5%BC%8F.md)

## Trust Model

`spec-first` does not ask the LLM to simulate deterministic tooling, and it does not replace LLM judgment with a rigid state machine.

The operating rule is simple: Scripts prepare, LLM decides.

- **What scripts do:** install, validate, generate, clean, hash, and report machine facts.
- **What the LLM decides:** requirements framing, scope boundaries, tradeoffs, implementation judgment, review evidence, and next steps.
- **What should be edited:** source assets under `skills/`, `agents/`, `templates/`, `src/cli/`, and docs. Rebuild runtime copies instead of hand-editing them.
- **What is excluded from ordinary context:** `.spec-first/audits/**` and generated mirrors such as `.claude/**`, `.codex/**`, and `.agents/skills/**`.
- **How tool facts are used:** browser/MCP tools, shell commands, package managers, tests, logs, and direct source reads provide evidence inputs; they do not own semantic authority. Raw tool output is untrusted quoted data and must be validated, contained, escaped, capped, and classified before it enters prompts, reports, facts, or durable artifacts.
- **How work verification is closed out:** `spec-first.verification.json` declares candidate checks; `verification-run-summary.v1` records actual `passed` / `failed` / `not-run` outcomes; `honest-closeout.v1` downgrades unsupported or natural-language-only claims instead of marking them verified.
- **Where credentials belong:** provider credentials belong in environment variables, host secret managers, or provider-native stores, not in repo source, generated runtime mirrors, durable artifacts, or raw logs. Rotate them on team/provider cadence and immediately after suspected exposure.
- **What spec-first does not do:** it is not a generic agent marketplace, not a single prompt pack, and not a standalone app that works without Claude Code or Codex.

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
- [Simplified Chinese README](https://github.com/sunrain520/spec-first/blob/main/README.zh-CN.md)

Learn the model:

- [Chinese User Manual](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/README.md)
- [Chinese Core Concepts](https://github.com/sunrain520/spec-first/blob/main/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/02-%E6%A0%B8%E5%BF%83%E6%A6%82%E5%BF%B5.md)
- [Chinese Architecture Overview](https://github.com/sunrain520/spec-first/blob/main/docs/02-%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/01-%E6%95%B4%E4%BD%93%E6%9E%B6%E6%9E%84.md)
- [Source / Runtime / Provider Customization Boundary](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/source-runtime-customization-boundary.md)
- [Knowledge Harness Contract](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/knowledge/knowledge-harness.md)
- [Verification Profile Contract](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/verification/verification-profile.md)
- [Verification Run Summary Contract](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/verification/verification-run-summary.md)
- [Honest Closeout Contract](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/workflows/honest-closeout.md)

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

## Runtime And CLI Reference

First-run users only need this mental model:

```text
source assets -> spec-first init -> host runtime assets -> workflow artifacts
```

Use deeper runtime details only when you need setup or workspace evidence:

- `spec-first doctor` checks CLI/runtime health. When a host is selected and setup facts exist, `doctor --json` also reports `decision_input_health` and `decision_input_health_basis` from `.spec-first/config/tool-facts.json`.
- The current host's setup workflow writes setup-owned facts for required harness tools, configured dependencies, provider readiness slots, and local runtime capabilities. Downstream workflows treat those facts as advisory setup evidence, then use direct source reads, `rg`, ast-grep, git diff, tests, logs, and user-provided artifacts for task-specific claims.
- Runtime setup modes separate side effects: `--check` is read-only, `--verify-only` / `--refresh-facts` refresh setup facts only, `--plan` previews install/config operations, and `--install` is the explicit apply path.
- Branch switches, pulls, rebases, merges, and dirty worktree changes can make prior local evidence stale. Workflows disclose those limitations instead of running hidden external-tool refresh, hooks, watchers, or daemons.

CLI reference:

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init [--claude] [--codex] [-y] [-u <name>] [--lang <zh|en>]
spec-first update [--claude|--codex] [--json]
spec-first clean (--claude|--codex) [--dry-run]
spec-first clean --workspace-orphans [--confirm]
spec-first tasks hash <plan-path> [--json]
spec-first tasks validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]
```

To inspect current runtime delivery details, use `spec-first doctor`, `spec-first init` output, `spec-first --help`, and the [Runtime Capability Catalog](https://github.com/sunrain520/spec-first/blob/main/docs/catalog/runtime-capabilities.md). The README intentionally avoids hardcoding internal skills/agents/commands counts because those drift across releases.

## Development & Contributing

```bash
npm run typecheck
npm run test:mcp-setup
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

When changing source assets, edit `skills/`, `agents/`, `templates/`, or `src/cli/`, then regenerate runtime copies with `spec-first init` and choose the target host in a fresh host session.

For contribution and support details, see [CONTRIBUTING.md](https://github.com/sunrain520/spec-first/blob/main/CONTRIBUTING.md), [SECURITY.md](https://github.com/sunrain520/spec-first/blob/main/SECURITY.md), [LICENSE](https://github.com/sunrain520/spec-first/blob/main/LICENSE), and [GitHub Issues](https://github.com/sunrain520/spec-first/issues).
