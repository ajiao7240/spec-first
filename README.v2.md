[English · v2](./README.v2.md) | [English · v1](./README.md) | [简体中文](./README.zh-CN.md)

<div align="center">

<img src="./docs/assets/spec_first_workflow_animation_v6_lower_flow.gif" alt="Spec-First" width="100%" />

<h1>Spec-First</h1>

<p><strong>A workflow CLI that feeds LLM structured, provenance-backed context at every stage of the AI coding delivery loop — and governs the full loop from ideation to compound learning.</strong></p>

<p>Open-source for <strong>Claude Code</strong> and <strong>Codex</strong>. Install once, govern the full loop.</p>

<p>
  <a href="#quick-start"><strong>Quick Start</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#core-workflow"><strong>Workflow</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#cli-commands"><strong>CLI</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#supported-languages"><strong>Languages</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="./docs/05-用户手册/README.md"><strong>用户手册 (zh)</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="https://www.npmjs.com/package/spec-first"><strong>npm</strong></a>
</p>

<!-- Core project badges -->
<p>
  <a href="https://www.npmjs.com/package/spec-first"><img src="https://img.shields.io/npm/v/spec-first?style=flat-square&color=2563eb" alt="npm version"></a>
  <a href="https://npmtrends.com/spec-first"><img src="https://img.shields.io/npm/dm/spec-first?style=flat-square&color=cb3837&label=downloads" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/sunrain520/spec-first?style=flat-square&color=16a34a" alt="license"></a>
  <a href="https://github.com/sunrain520/spec-first/stargazers"><img src="https://img.shields.io/github/stars/sunrain520/spec-first?style=flat-square&color=eab308" alt="GitHub stars"></a>
  <a href="https://github.com/sunrain520/spec-first/issues"><img src="https://img.shields.io/github/issues/sunrain520/spec-first?style=flat-square&color=e67e22" alt="GitHub issues"></a>
  <a href="https://github.com/sunrain520/spec-first/pulls"><img src="https://img.shields.io/github/issues-pr/sunrain520/spec-first?style=flat-square&color=9b59b6" alt="GitHub PRs"></a>
</p>

<!-- External reference entries (third-party AI explorers) -->
<p>
  <sub>
    <a href="https://deepwiki.com/sunrain520/spec-first"><img src="https://img.shields.io/badge/Ask-DeepWiki-blue?style=flat-square" alt="Ask DeepWiki"></a>
    &nbsp;
    <a href="https://chatgpt.com/?q=Explain+the+project+sunrain520/spec-first+on+GitHub"><img src="https://img.shields.io/badge/Ask-ChatGPT-74aa9c?style=flat-square&logo=openai&logoColor=white" alt="Ask ChatGPT"></a>
  </sub>
</p>

</div>

## Why Spec-First

Most AI coding failures come from degraded LLM decision inputs, not weak models:

| Problem | What spec-first does | Enforcement |
|---------|---------------------|-------------|
| LLM starts from a blank-slate codebase context | `graph-bootstrap` extracts AST facts and compiles `minimal-context` with `provenance` and `confidence` signals | **code-hard gate** at bootstrap / `stage0-context` runtime |
| Requirements are never made explicit | Brainstorm stage produces a requirements artifact consumed by Plan | SKILL.md contract |
| Plans drift from implementation | Plan artifact is a first-class Work input, and Review Stage 2b cross-checks **Requirements Trace** against the diff | SKILL.md contract |
| Reviews are unstructured | **17 reviewer personas** (always-on + cross-cutting + stack-specific) plus 2 CE-specific agents, with `safe_auto / gated_auto / manual / advisory` routing | SKILL.md contract |
| Solved problems are not reused | Compound writes structured learnings to `docs/solutions/` with YAML frontmatter for future retrieval | SKILL.md contract |

**Suited for:**

- Teams moving from prompt-driven coding to governed AI engineering workflows
- Claude Code and Codex users who want one repeatable delivery system across both hosts
- Projects that need explicit specs, structured review, and reusable post-task learnings

**Not suited for:**

- Teams without Claude Code or Codex
- Contexts expecting zero-configuration, fully automatic code generation
- Delivery loops too short to justify multi-stage workflow overhead

## Design Philosophy

> **Light contract · Explicit boundaries · Let the LLM decide.**

Spec-First is built on a single conviction: AI coding quality is limited by the quality of the decision inputs the LLM receives, not by orchestration weight. The repository governance (see `CLAUDE.md` / `AGENTS.md`) explicitly forbids:

- Hard-coded state machines that replace LLM judgment with multi-state transitions
- Over-engineered gates that fuse unrelated signals into a single orchestration object
- Growing contracts by coupling rather than by clarity

And explicitly prefers:

- Surfacing facts (`provenance`, `freshness`, `confidence`, `fallback_reason`, `verification_gaps`) as independent, composable inputs
- Raising input quality first, reaching for more automation only when evidence demands it
- Keeping control-plane boundaries — repo profile, diff recommendation, verifier dispatch, gate state, workflow prose, telemetry — each answering one question and not encroaching on others

Everything else in this README is a consequence of that stance.

## How It Works

Spec-First upgrades **what LLM receives as decision input** — it does not replace LLM judgment with a state machine.

### Two Complementary Parts

**graph-bootstrap — the foundation**

```
Codebase → AST graph → fact extraction → minimal-context (provenance + confidence)
        → injection-index (stage-aware routing) → workflow input
```

`graph-bootstrap` turns a codebase into structured context **before** AI starts coding. Runs once per project (or incrementally when code changes) and produces long-lived context that all downstream workflow stages consume.

**Main workflow — the delivery loop**

```
Ideate → Brainstorm → Plan → Work → Review → Compound
```

Solves how a requirement gets AI-engineered end-to-end. Each stage has explicit input artifacts, output artifacts, and stage-gate contracts.

### Which bootstrap should I run?

| Entrypoint | When to use | Produces | Stability |
|------------|-------------|----------|-----------|
| `/spec:bootstrap` · `$spec-bootstrap` | Default; low-risk, works on any repo; no AST graph analysis | `docs/contexts/<slug>/` | **Stable** |
| `/spec:graph-bootstrap` · `$spec-graph-bootstrap` | You want fact-extracted, graph-informed context (Phase 0–4) | Phase 0–4 facts + `injection-index.yaml` + `minimal-context/*.json` | **Current evolution target** |

Both entrypoints run a **Host Readiness Gate** at startup. If MCP setup was skipped or the host was not restarted, they stop with explicit guidance instead of degrading silently.

### Stage-0 Context Quality Signals

Every context artifact carries machine-readable quality metadata. Downstream SKILL.md contracts read these signals and adapt:

| Field | Values | Meaning |
|-------|--------|---------|
| `data_quality` | `fact-backed` · `partial` · `empty` · *(absent = legacy manifest, treated as backward-compatible)* | How much of the context comes from real code analysis |
| `provenance` | `fact-inventory` · `empty-fallback` | Whether content was compiled from extracted facts or from a skeletal default |
| `confidence` | `high` · `medium` · `low` | LLM-consumable trust signal for the context |
| `fallback_reason` | `empty_fact_inventory` (root cause) · `minimal_context_missing` (secondary) · `workspace_child_partial_degraded` · *(other runtime-specific values)* | Explicit degradation cause when context is not fact-backed |

When `data_quality: empty`, the evaluator downgrades to **L1** and sets `fallback_reason` — the LLM receives an explicit signal that context is skeletal, not real analysis.

#### Evaluator levels

> **L0** — fact-backed context, real AST-derived signals, full-strength Stage-0 input.
> **L1** — skeletal / degraded context, evaluator has set `fallback_reason`, downstream SKILLs should treat signals as advisory.
> **L2** — fixed minimal fallback, only ambient defaults (e.g. `00-summary.md`, `pitfalls/index.md`) available when `injection-index.yaml` cannot be resolved.

Downstream skills are **allowed to proceed at any level** — the evaluator exposes the level so the LLM can adjust confidence, not block execution.

### Enforcement Model

| Layer | What it covers | Type |
|-------|---------------|------|
| CLI (`doctor` / `init` / `clean` / `stage0-context`) | Asset sync, state tracking, manifest validation, Stage-0 context emit | **Code-hard** — enforced in shell exit code |
| Host Readiness Gate + Stage-0 evaluator L0/L1/L2 | Enforced when `bootstrap` / `graph-bootstrap` / `stage0-context` runs; emits `fallback_reason` and degraded level | **Runtime signal** — code-emitted, LLM-consumed |
| Workflow stages (SKILL.md) | Stage contracts, artifact naming, review classes, requirements trace | **SKILL contract** — LLM-followed |
| Context signals (`provenance` / `confidence` / `fallback_reason`) | In-artifact metadata | **SKILL contract** — LLM-consumed |

## Supported Languages

Powered by 15 vendored / pinned `tree-sitter` parsers. All 15 are installed by default (no opt-in).

| Language | Parser | Notes |
|----------|--------|-------|
| C | `tree-sitter-c` | |
| C++ | `tree-sitter-cpp` | |
| C# | `tree-sitter-c-sharp` | |
| Go | `tree-sitter-go` | |
| Java | `tree-sitter-java` | |
| JavaScript | `tree-sitter-javascript` | CommonJS `require()` → `imports_from` edges |
| Kotlin | `tree-sitter-kotlin` | |
| Objective-C | `tree-sitter-objc` (vendored fork) | `.m` / `.mm` / heuristic `.h` routing; `@interface/@implementation/@protocol` extraction |
| PHP | `tree-sitter-php` | |
| Python | `tree-sitter-python` | |
| Ruby | `tree-sitter-ruby` | |
| Rust | `tree-sitter-rust` | |
| Scala | `tree-sitter-scala` | |
| Swift | `tree-sitter-swift` (vendored fork) | Upstream `tree-sitter-cli` install-time dep removed |
| TypeScript | `tree-sitter-typescript` | Covers `.ts` / `.tsx` / `.d.ts` |

iOS repositories are auto-detected (`Podfile.lock` / `.xcodeproj`) and Pod exclude paths are applied automatically.

## What You Get

| Capability | What it solves |
|-----------|---------------|
| **CLI control plane** (`doctor` / `init` / `clean` / `stage0-context`) | Repeatable install, health checks, cleanup, Stage-0 context emit — managed assets always traceable |
| **CRG graph engine** (`spec-first crg *`) | **Code Review Graph** — embedded Node.js runtime with 17 subcommands over SQLite + FTS5. AST → symbols → resolved edges → PageRank flows → community detection → surprising-connections → god-nodes → review-context |
| **graph-bootstrap context engine** | LLM gets fact-extracted, confidence-annotated project context instead of raw codebase |
| **Full workflow layer** | Ideate → Brainstorm → Plan → Work → Review → Compound with explicit artifact contracts |
| **17-persona Review stage** (+ 2 CE agents) | Structured findings with `safe_auto / gated_auto / manual / advisory` routing — not a single-pass review |
| **Compound / knowledge capture** | Solved problems written to `docs/solutions/` for future workflow retrieval |
| **Dual platform support** | One methodology across Claude Code (`/spec:*`) and Codex (`$spec-*`). Claude uses `SessionStart` hook + bare-agent rewrites; Codex uses `.agents/skills/` discovery + explicit `.codex/agents/...` path rewrites |
| **Runtime governance** | Managed assets tracked in `state.json` — sync, refresh, recover, clean safely |

## Core Workflow

<p align="center">
  <img alt="Spec-First overview" src="./docs/assets/svg/spec-first-overview.svg">
</p>

### Primary stages

| Stage | Claude Code | Codex | Output Artifact | Enforcement |
|-------|-------------|-------|----------------|-------------|
| Host Setup | `/spec:mcp-setup` → restart | `$spec-mcp-setup` → restart | `~/.claude/spec-first/host-setup.json` | **Code-hard** (bootstrap gate checks this) |
| Stage-0 (stable) | `/spec:bootstrap` | `$spec-bootstrap` | `docs/contexts/<slug>/` | **Code-hard gate** + **SKILL.md** content |
| Stage-0 (graph) | `/spec:graph-bootstrap` | `$spec-graph-bootstrap` | Phase 0–4 facts + `injection-index.yaml` + `minimal-context/*.json` | **Code-hard gate** + **SKILL.md** content |
| Ideate | `/spec:ideate` | `$spec-ideate` | `docs/ideation/*.md` | **SKILL.md** contract |
| Brainstorm | `/spec:brainstorm` | `$spec-brainstorm` | `docs/brainstorms/*.md` | **SKILL.md** contract |
| Plan | `/spec:plan` | `$spec-plan` | `docs/plans/*.md` | **SKILL.md** contract |
| Work | `/spec:work` | `$spec-work` | code + tests | **SKILL.md** contract |
| Review | `/spec:review` | `$spec-review` | structured review report | **SKILL.md** contract (17 reviewer personas + 2 CE agents) |
| Compound | `/spec:compound` | `$spec-compound` | `docs/solutions/**/*.md` | **SKILL.md** contract |

### Auxiliary stages

| Stage | Claude Code | Codex | Purpose |
|-------|-------------|-------|---------|
| Debug | `/spec:debug` | `$spec-debug` | Reproduce and diagnose an existing bug or failure |
| Update | `/spec:update` | `$spec-update` | Refresh runtime assets after `spec-first` upgrades |
| Sessions | `/spec:sessions` | `$spec-sessions` | Search and summarize prior coding agent sessions |
| Setup | `/spec:setup` | `$spec-setup` | Unified host / environment setup entrypoint |

## Quick Start

### Prerequisites

- Node.js `>=20`
- **Git repository** — `spec-first init` reads `git config user.name` and `graph-bootstrap` relies on `git ls-files` (non-git directories are not supported)
- At least one of **Claude Code** or **Codex**
- Disk: roughly 60–120 MB of `node_modules` (15 tree-sitter parsers, better-sqlite3 native build)

### 1. Install

```bash
npm install -g spec-first
spec-first -v
```

> **`postinstall` note:** The installer runs `bin/postinstall.js`, which prints an install confirmation card and then trims native `tree-sitter` prebuilds for platforms other than yours. This only deletes files inside the installed `node_modules/` tree; it does not touch any of your project files.

### 2. Check the environment

```bash
spec-first doctor
spec-first doctor --claude   # Claude-only scope
spec-first doctor --codex    # Codex-only scope
```

If `doctor` reports `legacy managed state`, run `init` again — it is the only supported upgrade path and performs a managed hard reset before rebuilding the runtime.

### 3. Initialize a project

```bash
spec-first init --claude
# or
spec-first init --codex
```

To set developer identity explicitly:

```bash
spec-first init --claude -u <name> --lang <zh|en>
spec-first init --codex -u <name> --lang <zh|en>
```

**Identity resolution order:**

1. `-u` flag value (if present)
2. `~/.spec-first/.developer` (global identity)
3. `git config user.name` fallback

**Language resolution order:**

1. `--lang` flag value (if present)
2. Existing project `.developer` profile
3. Default `zh`

#### What `init` writes

`init` is **not** read-only. It mounts `spec-first` into your project by writing the following:

| Target | What gets written | Removable by `clean`? |
|--------|-------------------|-----------------------|
| `CLAUDE.md` / `AGENTS.md` | `<!-- spec-first:lang:* -->` language policy block (idempotent marker block) | ❌ Manual removal — `clean` does not strip the language policy block |
| `CLAUDE.md` / `AGENTS.md` | `using-spec-first` instruction bootstrap block | ✅ `clean` removes this |
| `.claude/settings.json` | Managed `SessionStart` matcher hook (Claude only) | ✅ `clean` removes this |
| `.claude/commands/spec/**` · `.claude/skills/**` · `.claude/agents/**` (or Codex equivalents) | Managed runtime assets | ✅ `clean` removes these |
| `.claude/spec-first/.developer` | Project developer profile | ✅ `clean` removes this |
| `.claude/spec-first/state.json` | Managed asset tracking state | ✅ `clean` removes this |

#### How to roll back

```bash
spec-first clean --claude   # or --codex
```

`clean` removes everything in the "Removable by clean" column above, then prints which platform's managed assets were removed. Custom assets outside the managed set are left untouched. The language policy block must still be removed manually (search for `<!-- spec-first:lang:` in `CLAUDE.md` / `AGENTS.md`).

#### Example output

```bash
$ spec-first init --claude

📋 Wrote language policy to CLAUDE.md
🧭 Wrote using-spec-first bootstrap to CLAUDE.md
🪝 Installed Claude SessionStart matcher in .claude/settings.json
📦 Generated <N> command file(s) in .claude/commands/spec
🧩 Generated <N> skill directory(ies) in .claude/skills
🤖 Generated <N> agent file(s) in .claude/agents
🧰 Generated <N> agent support file(s) in .claude/agents
🪪 Wrote project developer profile:
  📍 path: .claude/spec-first/.developer
  👤 name: yourname
  🈯 lang: zh
  ⏱ initialized_at: <ISO-8601 timestamp>
  🔖 version: <installed spec-first version>

🔁 Restart Claude Code after generation so it can pick up the new /spec:* commands.
```

> Counts and version reflect whatever is installed at run time. The log is emitted in English regardless of `--lang`; the `--lang` setting affects the language policy that governs future Claude / Codex responses, not the installer's own output.

### 4. First run

| Step | Claude Code | Codex |
|------|------------|-------|
| Install MCP tools | `/spec:mcp-setup` | `$spec-mcp-setup` |
| Restart host | restart Claude Code | restart Codex |
| Build context | `/spec:bootstrap` or `/spec:graph-bootstrap` | `$spec-bootstrap` or `$spec-graph-bootstrap` |
| Start workflow | `/spec:ideate` → `/spec:brainstorm` → `/spec:plan` → `/spec:work` → `/spec:review` → `/spec:compound` | `$spec-ideate` → … → `$spec-compound` |

`bootstrap` and `graph-bootstrap` both run a **Host Readiness Gate** at startup. If MCP setup was skipped or the host was not restarted, they stop with explicit guidance instead of degrading silently.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Entry Layer — spec-first CLI                                │
│  doctor / init / clean / stage0-context / crg <subcommand>   │
│  Enforcement: code-hard (asset sync, state, manifest,        │
│               Stage-0 emit, CRG SQLite pipeline)             │
├──────────────────────────────────────────────────────────────┤
│  Context Layer — graph-bootstrap / CRG module                │
│  AST fact extraction → artifact-manifest (data_quality)      │
│  → minimal-context (provenance + confidence + fallback)      │
│  → injection-index (stage-aware routing)                     │
│  Enforcement: code-hard gate (L0/L1/L2) + SKILL.md content   │
├──────────────────────────────────────────────────────────────┤
│  Workflow Layer — skills                                     │
│  Ideate / Brainstorm / Plan / Work / Review / Compound       │
│  + Debug / Update / Sessions / Setup auxiliaries             │
│  Stage contracts, artifact conventions, review classes       │
│  Enforcement: SKILL.md contracts (LLM-followed)              │
├──────────────────────────────────────────────────────────────┤
│  Capability Layer — agents (6 categories)                    │
│  review/ (17 reviewer personas + CE agents)                  │
│  document-review/ (requirements / plan persona review)       │
│  research/ (session / doc / Feishu / web context readers)    │
│  design/ (UI / design-lens agents)                           │
│  workflow/ (bug-reproduction / lint / pr-comment-resolver)   │
│  docs/ (documentation / onboarding support)                  │
│  Enforcement: convention (LLM-dispatched)                    │
└──────────────────────────────────────────────────────────────┘
```

Runtime assets under `.claude/`, `.codex/`, or `.agents/` are **generated outputs**, not editable source. `skills/`, `agents/`, `templates/`, and `docs/` are source of truth.

## CLI Commands

### Managed-asset commands

| Command | Purpose | Notes |
|---------|---------|-------|
| `spec-first doctor` | Environment check | Verifies platform state, plugin manifest, managed assets. `--claude` / `--codex` scopes to one platform. Reports `legacy managed state` when `init` is needed. |
| `spec-first init` | Initialize runtime | Syncs commands, skills, agents, developer metadata. The only supported legacy upgrade entrypoint — performs a managed hard reset. See [What `init` writes](#what-init-writes). |
| `spec-first clean` | Remove managed assets | Removes current spec-first managed assets for the given platform; does not migrate legacy state and does not strip the language policy marker block. |
| `spec-first stage0-context` | Emit Stage-0 runtime context | Called by SKILLs (`spec-plan` / `spec-work` / `spec-review`) at stage start. Accepts `--stage <plan\|work\|review>`, `--workflow <skill-name>`, `--format json`. |

### CRG graph commands (`spec-first crg <subcommand>`)

Embedded Code Review Graph runtime over SQLite + FTS5.

```bash
spec-first crg --help
spec-first crg build --repo .
spec-first crg review-context --repo . --changed <ref>
```

| Subcommand | Purpose |
|------------|---------|
| `build` | Build / incrementally refresh the graph DB from the repo |
| `stats` | Report node / edge / community counts, unresolved edges |
| `context` | Dump context bundle for a symbol or file |
| `query` | 8 structured lookups: `callers_of / callees_of / importers_of / importees_of / dependents_of / dependencies_of / tests_for / similar_to` |
| `impact` | Impact-of-change analysis for a file or symbol |
| `large-functions` | Functions over a size threshold |
| `search` | FTS5 full-text search across symbols / files |
| `flows` | PageRank + BFS flow detection |
| `flow` / `affected-flows` | Inspect a flow / flows affected by a diff |
| `communities` / `community` | 3-pass community detection + single community inspection |
| `architecture` | High-level architecture summary |
| `surprising-connections` | Cross-community / peripheral-to-hub surprise detector |
| `god-nodes` | High-fan-in hub detection |
| `detect-changes` | SHA-256 incremental change detection |
| `review-context` | Compose a review context bundle from a diff |

All subcommands accept `--repo=<path>`. Run `spec-first crg --help` to see the full subcommand list emitted by the installed version.

## Documentation

Full documentation is currently Chinese-first. English readers can use [DeepWiki](https://deepwiki.com/sunrain520/spec-first) or the [Ask ChatGPT](https://chatgpt.com/?q=Explain+the+project+sunrain520/spec-first+on+GitHub) link as a supplementary entrypoint while English translations catch up.

| Document | Language | Description |
|----------|----------|-------------|
| [Chinese README](./README.zh-CN.md) | zh | Full Chinese README |
| [User Manual](./docs/05-用户手册/README.md) | zh | Complete user manual index |
| [Quick Start](./docs/05-用户手册/01-快速开始.md) | zh | First-time setup walkthrough |
| [Core Concepts](./docs/05-用户手册/02-核心概念.md) | zh | Architecture and terminology |
| [Full Example](./docs/05-用户手册/03-完整示例.md) | zh | End-to-end delivery walkthrough |
| [FAQ](./docs/05-用户手册/04-常见问题.md) | zh | Troubleshooting and common issues |
| [Best Practices](./docs/05-用户手册/05-最佳实践.md) | zh | Team usage patterns |
| [Architecture Overview](./docs/02-架构设计/01-整体架构.md) | zh | System design (contributors) |
| [Development Guide](./docs/03-实施方案/06-开发规范.md) | zh | Contributor standards |
| [CHANGELOG](./CHANGELOG.md) | en / zh mixed | Canonical version history (machine-readable) |
| [Release Notes Index](./docs/08-版本更新/README.md) | zh | Narrative release notes |

## Local Development

```bash
git clone https://github.com/sunrain520/spec-first.git
cd spec-first
npm install --legacy-peer-deps
npm test
```

> `--legacy-peer-deps` is required because `jest` peer-dep resolution under the vendored `tree-sitter` forks conflicts with stricter resolvers. Omitting it will fail the first `jest` run.

### Verification scripts

```bash
npm run test:unit           # shell unit tests + jest unit suite (tests/unit/*)
npm run test:smoke          # install-local + CLI smoke
npm run test:integration    # verification-gate jest + e2e shell
npm run test:e2e:crg        # CRG full-command + SQLite audit
npm run test:jest           # jest only
npm run test:crg:gate       # CRG regression gate (benchmarks/regression/*)
npm run test:ai-dev:gate    # AI Dev Quality Gate (light contract check)
npm pack                    # release tarball dry run
```

`npm test` itself runs `test:unit → test:smoke → test:integration → test:e2e:crg` in that order.

## Contributing

Issues and pull requests are welcome.

To report a bug, open an [Issue](https://github.com/sunrain520/spec-first/issues) with reproduction steps, environment details, and expected behavior.

To contribute code:

1. Fork the repository and create a feature branch from `main`
2. Read [AGENTS.md](./AGENTS.md) for repository workflow conventions
3. Run `npm install --legacy-peer-deps` then `npm test`
4. Open a PR with the change goal and verification details
5. Every code / doc change must add a line to [CHANGELOG.md](./CHANGELOG.md) per the format defined at the top of that file

Recommended reading before contributing: [AGENTS.md](./AGENTS.md) · [User Manual](./docs/05-用户手册/README.md) · [CHANGELOG](./CHANGELOG.md)

## License

[MIT](./LICENSE) © [sunrain520](https://github.com/sunrain520)
