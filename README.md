[English](./README.md) | [简体中文](./README.zh-CN.md)

<div align="center">

<img src="./docs/assets/spec_first_workflow_animation_v6_lower_flow.gif" alt="Spec-First" width="100%" />

<h1>Spec-First</h1>

<p><strong>A workflow CLI that feeds LLM structured, provenance-backed context at every stage of the AI coding delivery loop — and governs the full path from ideation to compound learning.</strong></p>

<p>Open-source for <strong>Claude Code</strong> and <strong>Codex</strong>. Install once, govern the full delivery loop.</p>

<p>
  <a href="#quick-start"><strong>Quick Start</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#core-workflow"><strong>Workflow</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#cli-commands"><strong>CLI</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#supported-languages"><strong>Languages</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="./docs/05-用户手册/README.md"><strong>User Manual (zh)</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="https://www.npmjs.com/package/spec-first"><strong>npm</strong></a>
</p>

<p>
  <a href="https://www.npmjs.com/package/spec-first"><img src="https://img.shields.io/npm/v/spec-first?style=flat-square&color=2563eb" alt="npm version"></a>
  <a href="https://npmtrends.com/spec-first"><img src="https://img.shields.io/npm/dm/spec-first?style=flat-square&color=cb3837&label=downloads" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/sunrain520/spec-first?style=flat-square&color=16a34a" alt="license"></a>
  <a href="https://github.com/sunrain520/spec-first/stargazers"><img src="https://img.shields.io/github/stars/sunrain520/spec-first?style=flat-square&color=eab308" alt="GitHub stars"></a>
  <a href="https://github.com/sunrain520/spec-first/issues"><img src="https://img.shields.io/github/issues/sunrain520/spec-first?style=flat-square&color=e67e22" alt="GitHub issues"></a>
  <a href="https://github.com/sunrain520/spec-first/pulls"><img src="https://img.shields.io/github/issues-pr/sunrain520/spec-first?style=flat-square&color=9b59b6" alt="GitHub PRs"></a>
</p>

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

| Problem | How spec-first addresses it | Enforcement |
|---------|----------------------------|-------------|
| LLM starts from a blank-slate codebase context | `graph-bootstrap` extracts AST facts and compiles `minimal-context` with `provenance` and `confidence` signals | Host readiness gate + runtime workflow contract |
| Requirements are never made explicit | Brainstorm stage produces a requirements artifact consumed by Plan | `SKILL.md` contract |
| Plans drift from implementation | Plan artifact is a first-class Work input, and Review Stage 2b cross-checks the **Requirements Trace** against the diff | `SKILL.md` contract |
| Reviews are unstructured | **17 reviewer personas** (always-on + cross-cutting + stack-specific) plus 2 CE-specific agents, routed by `safe_auto / gated_auto / manual / advisory` | `SKILL.md` contract |
| Solved problems are not reused | Compound writes structured learnings to `docs/solutions/` with YAML frontmatter for future retrieval | `SKILL.md` contract |

**Suited for:**

- Teams moving from prompt-driven coding to governed AI engineering workflows
- Claude Code and Codex users who want one repeatable delivery system across both hosts
- Projects that need explicit specs, structured reviews, and reusable post-task learnings

**Not suited for:**

- Teams without Claude Code or Codex
- Contexts expecting zero-configuration, fully automatic code generation
- Delivery loops too short to justify multi-stage workflow overhead

## Design Philosophy

> **Light contract · Explicit boundaries · Let the LLM decide.**

Spec-First rests on a single conviction: AI coding quality is bounded by the quality of decision inputs the LLM receives, not by the weight of orchestration. Repository governance (see `CLAUDE.md` / `AGENTS.md`) explicitly forbids:

- Hard-coded state machines that replace LLM judgment with multi-state transitions
- Over-engineered gates that fuse unrelated signals into a single orchestration object
- Expanding contracts by coupling instead of by clarity

And explicitly prefers:

- Surfacing `provenance`, `freshness`, `confidence`, `fallback_reason`, and `verification_gaps` as independent, composable input facts
- Raising input quality first; reaching for more automation only when evidence demands it
- Keeping control-plane boundaries clean — repo profile, diff recommendation, verifier dispatch, gate state, workflow prose, telemetry each answer one question and do not encroach on others

Every other choice in this README is a consequence of that stance.

## How It Works

Spec-First upgrades **what the LLM receives as decision input** — it does not replace LLM judgment with a state machine.

### Two Complementary Parts

**graph-bootstrap — the foundation**

```text
Codebase → AST graph → fact extraction → minimal-context (provenance + confidence)
        → injection-index (stage-aware routing) → workflow input
```

`graph-bootstrap` turns a codebase into structured context **before** AI starts coding. It typically runs once per project, or incrementally when code changes, and its output is consumed by every downstream workflow stage.

**Main workflow — the delivery loop**

```text
Ideate → Brainstorm → Plan → Work → Review → Compound
```

This solves "how does a requirement get AI-engineered end-to-end?" Every stage has explicit input artifacts, output artifacts, and a stage-gate contract.

### Which bootstrap should I run?

| Entrypoint | When to use | Produces | Stability |
|------------|-------------|----------|-----------|
| `/spec:graph-bootstrap` · `$spec-graph-bootstrap` | You want fact-extracted, graph-informed context (Phase 0–4) | Phase 0–4 facts + `injection-index.yaml` + `minimal-context/*.json` | **Primary Stage-0 entry** |
| `/spec:compound` · `$spec-compound` | You want broader knowledge capture and reusable context synthesis | Context synthesis docs and reusable knowledge artifacts | **Complementary Stage-0 path** |

These are installed host workflow entrypoints generated by `spec-first init`, not root `spec-first` subcommands.

Stage-0 entrypoints run a **Host Readiness Gate** at startup. If MCP setup was skipped or the host was not restarted, they stop with explicit guidance rather than degrade silently.
If you still see an older bootstrap entrypoint in local runtime assets or stale documentation, migrate to `/spec:graph-bootstrap` or `/spec:compound`.

### Stage-0 Context Quality Signals

Every context artifact carries machine-readable quality metadata. Downstream `SKILL.md` contracts read these signals and adapt:

| Field | Values | Meaning |
|-------|--------|---------|
| `data_quality` | `fact-backed` · `partial` · `empty` · *(absent = legacy manifest, treated as backward-compatible)* | How much of the context comes from real code analysis |
| `provenance` | `fact-inventory` · `empty-fallback` | Whether content was compiled from extracted facts or from a skeletal default |
| `confidence` | `high` · `medium` · `low` | LLM-consumable trust signal |
| `fallback_reason` | `empty_fact_inventory` (root cause) · `minimal_context_missing` (secondary) · `workspace_child_partial_degraded` · *(other runtime-specific values)* | Explicit degradation cause when the context is not fact-backed |

When `data_quality: empty`, the evaluator downgrades to **L1** and sets `fallback_reason`. The LLM gets a clear signal: this context is skeletal, not a real analysis.

#### Evaluator levels

> **L0** — fact-backed context with real AST-derived signals; full-strength Stage-0 input.  
> **L1** — skeletal or degraded context; the evaluator has set `fallback_reason`, and downstream SKILLs should treat these signals as advisory.  
> **L2** — fixed minimal fallback; used only when `injection-index.yaml` cannot be resolved, falling back to ambient defaults (e.g. `00-summary.md`, `pitfalls/index.md`).

Downstream skills are **allowed to proceed at any level**. The evaluator exposes the level so the LLM can adjust its own confidence, not to block execution.

### Enforcement Model

| Layer | Scope | Type |
|-------|-------|------|
| CLI (`doctor` / `init` / `clean` / `stage0-context`) | Asset sync, state tracking, manifest validation, Stage-0 context emission | **Code-hard**, enforced through shell exit code |
| Host Readiness Gate + Stage-0 evaluator L0/L1/L2 | Enforced when `graph-bootstrap` / `stage0-context` runs, emitting `fallback_reason` and degraded level | **Runtime signal**, emitted by code, consumed by LLM |
| Workflow stages (`SKILL.md`) | Stage contracts, artifact naming, review classes, requirements trace | **SKILL contract**, followed by LLM |
| Context signals (`provenance` / `confidence` / `fallback_reason`) | In-artifact metadata | **SKILL contract**, consumed by LLM |

## Supported Languages

Powered by 15 vendored / pinned `tree-sitter` parsers. All 15 are installed by default — no opt-in required.

| Language | Parser | Notes |
|----------|--------|-------|
| C | `tree-sitter-c` | |
| C++ | `tree-sitter-cpp` | |
| C# | `tree-sitter-c-sharp` | |
| Go | `tree-sitter-go` | |
| Java | `tree-sitter-java` | |
| JavaScript | `tree-sitter-javascript` | CommonJS `require()` is resolved into `imports_from` edges |
| Kotlin | `tree-sitter-kotlin` | |
| Objective-C | `tree-sitter-objc` (vendored fork) | `.m` / `.mm` / heuristic `.h` routing; extracts `@interface/@implementation/@protocol` |
| PHP | `tree-sitter-php` | |
| Python | `tree-sitter-python` | |
| Ruby | `tree-sitter-ruby` | |
| Rust | `tree-sitter-rust` | |
| Scala | `tree-sitter-scala` | |
| Swift | `tree-sitter-swift` (vendored fork) | Removes the upstream `tree-sitter-cli` install-time dependency |
| TypeScript | `tree-sitter-typescript` | Covers `.ts` / `.tsx` / `.d.ts` |

iOS repositories are auto-detected (`Podfile.lock` / `.xcodeproj`) and Pod exclude paths are applied automatically.

## What You Get

| Capability | What it solves |
|------------|----------------|
| **CLI control plane** (`doctor` / `init` / `clean` / `stage0-context`) | Repeatable install, health checks, cleanup, and Stage-0 context emission — managed assets always stay traceable |
| **CRG graph engine** (`spec-first crg *`) | **Code Review Graph** — an embedded Node.js runtime over SQLite + FTS5, covering AST → symbols → resolved edges → PageRank flows → community detection → surprising-connections → god-nodes → review-context |
| **graph-bootstrap context engine** | LLM gets fact-extracted, confidence-annotated project context instead of a raw codebase |
| **Full workflow layer** | Ideate → Brainstorm → Plan → Work → Review → Compound, every stage with an explicit artifact contract |
| **17-persona Review stage** (+ 2 CE agents) | Produces structured findings routed by `safe_auto / gated_auto / manual / advisory`, not a single-pass scan |
| **Compound / knowledge capture** | Solved problems are written to `docs/solutions/` for future workflow retrieval |
| **Dual platform support** | One methodology across Claude Code (`/spec:*`) and Codex (`$spec-*`). Claude uses a `SessionStart` hook + bare-agent rewrite; Codex uses `.agents/skills/` discovery + explicit `.codex/agents/...` path rewrite |
| **Capability layer** | Bundled source assets ship with `48` skills, `57` agents, and `4` agent support files. Runtime delivery is host-filtered by governance: the current bundle installs `12` commands + `36` skills on Claude, and `35` skills on Codex, with `57` agents + `4` support files on both hosts |
| **Runtime governance** | Managed assets are tracked in `state.json` — sync, refresh, recover, and clean safely |

## Core Workflow

<p align="center">
  <img alt="Spec-First overview" src="./docs/assets/svg/spec-first-overview.svg">
</p>

### Primary stages

| Stage | Claude Code | Codex | Output Artifact | Enforcement |
|-------|-------------|-------|-----------------|-------------|
| Host Setup | `/spec:mcp-setup` → restart | `$spec-mcp-setup` → restart | Host-specific marker: `~/.claude/spec-first/host-setup.json` or `~/.codex/spec-first/host-setup.json` | **Code-hard** (bootstrap gate checks this) |
| Stage-0 graph bootstrap | `/spec:graph-bootstrap` | `$spec-graph-bootstrap` | Phase 0–4 facts + `injection-index.yaml` + `minimal-context/*.json` | Host readiness gate + runtime workflow contract |
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

These `/spec:*` and `$spec-*` surfaces are generated runtime workflow entrypoints, not root `spec-first` subcommands. The root CLI surface is documented below under [CLI Commands](#cli-commands).

## Quick Start

### Prerequisites

- Node.js `>=20`
- **Git repository** — `spec-first init` reads `git config user.name` and `graph-bootstrap` depends on `git ls-files`, so non-Git directories are not supported
- At least one of **Claude Code** or **Codex**
- Disk: roughly 60–120 MB of `node_modules` (15 tree-sitter parsers plus the `better-sqlite3` native build)

### 1. Install

```bash
npm install -g spec-first
spec-first -v
```

> **`postinstall` note:** The installer runs `bin/postinstall.js`, which prints an install confirmation card and then trims native `tree-sitter` prebuilds for platforms other than yours. This step only deletes files inside the installed `node_modules/` tree; it never touches your project files.

### 2. Check the environment

```bash
spec-first doctor
spec-first doctor --claude   # Claude-only scope
spec-first doctor --codex    # Codex-only scope
```

If `doctor` reports `legacy managed state`, run `init` again. This is the only supported upgrade path — it performs a managed hard reset before rebuilding the runtime.
`doctor --json` also exposes workflow verification evidence as structured facts: schema validity, freshness, `fallback_reason`, and `evidence_age_summary` (`oldest_*` / `newest_*` + `max_age_ms`) so downstream workflows do not need to infer evidence staleness heuristically.

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

1. `-u` flag value (when provided)
2. `~/.spec-first/.developer` (global identity)
3. `git config user.name` fallback

**Language resolution order:**

1. `--lang` flag value (when provided)
2. Existing project `.developer` profile
3. Default `zh`

#### What `init` writes

`init` is **not** a read-only operation. It mounts `spec-first` into your project by writing the following:

| Target | What gets written | Removable by `clean`? |
|--------|-------------------|-----------------------|
| `CLAUDE.md` / `AGENTS.md` | `<!-- spec-first:lang:* -->` language policy block (idempotent marker block) | ❌ Manual removal — `clean` does not strip the language policy block |
| `CLAUDE.md` / `AGENTS.md` | `using-spec-first` instruction bootstrap block | ✅ Removed by `clean` |
| `CLAUDE.md` / `AGENTS.md` | `<!-- spec-first:coding-guidelines:* -->` coding execution guidelines block | ✅ Removed by `clean` |
| `.claude/settings.json` | Managed `SessionStart` matcher entry (Claude only) | ✅ Removed by `clean` |
| `.claude/hooks/session-start` | Managed `SessionStart` hook script (Claude only) | ✅ Removed by `clean` |
| `.claude/commands/spec/**` · `.claude/skills/**` · `.claude/agents/**` (or Codex equivalents) | Managed runtime assets | ✅ Removed by `clean` |
| `.claude/spec-first/.developer` / `.codex/spec-first/.developer` | Host-specific project developer profile | ✅ Removed by `clean` |
| `.claude/spec-first/state.json` / `.codex/spec-first/state.json` | Host-specific managed asset tracking state | ✅ Removed by `clean` |
| `CHANGELOG.md` | Bootstrapped only when missing, with the managed format header and an initial init entry | ❌ User-owned after creation |

#### How to roll back

```bash
spec-first clean --claude   # or --codex
```

`init` does not overwrite an existing `CLAUDE.md` / `AGENTS.md`. On first install, spec-first appends its managed instruction blocks as a footer after any existing user content; on re-init, it only replaces the marker-delimited managed blocks it owns.

`clean` removes everything marked removable in the table above, then prints which platform's managed assets were removed. Custom assets outside the managed set are left untouched. The language policy block must still be removed manually — search for `<!-- spec-first:lang:` in `CLAUDE.md` / `AGENTS.md`.
Both `init --dry-run` and `clean --dry-run` preview file-level operations derived from the same managed operation plans used by real apply paths, which keeps preview/apply drift narrow and testable.
Current runtime delivery is host-specific by governance: Claude writes `12` command files, `36` skill directories, `57` agent files, and `4` agent support files; Codex writes `35` skill directories plus the same `57` agent files and `4` support files, with no command directory.

#### Example output

```bash
$ spec-first init --claude

🪝 Installed Claude SessionStart matcher in .claude/settings.json
📦 Generated 12 command file(s) in .claude/commands/spec
🧩 Generated 36 skill directory(ies) in .claude/skills
🤖 Generated 57 agent file(s) in .claude/agents
🧰 Generated 4 agent support file(s) in .claude/agents
🪪 Wrote project developer profile:
  📍 path: .claude/spec-first/.developer
  👤 name: yourname
  🈯 lang: zh
  ⏱ initialized_at: <ISO-8601 timestamp>
  🔖 version: <installed spec-first version>

🔁 Restart Claude Code after generation so it can pick up the new /spec:* commands.
```

> Counts and version reflect the version actually installed at run time. If `CHANGELOG.md` did not exist yet, `init` also prints `📝 Bootstrapped CHANGELOG.md`. The install log is emitted in English regardless of `--lang`; the `--lang` setting governs future Claude / Codex response language, not the installer's own output. Codex output differs by design: it does not generate `.claude/commands/spec`, and it restarts into `$spec-*` skill entrypoints instead.

### 4. First run

| Step | Claude Code | Codex |
|------|-------------|-------|
| Install MCP tools | `/spec:mcp-setup` | `$spec-mcp-setup` |
| Restart host | restart Claude Code | restart Codex |
| Build context | `/spec:graph-bootstrap` or `/spec:compound` | `$spec-graph-bootstrap` or `$spec-compound` |
| Start the workflow | `/spec:ideate` → `/spec:brainstorm` → `/spec:plan` → `/spec:work` → `/spec:review` → `/spec:compound` | `$spec-ideate` → … → `$spec-compound` |

`graph-bootstrap` runs a **Host Readiness Gate** at startup. If MCP setup was skipped or the host was not restarted, it stops with explicit guidance rather than degrade silently.

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  Entry Layer — spec-first CLI                                │
│  doctor / init / clean / stage0-context / crg <subcommand>   │
│  Enforcement: code-hard (asset sync, state, manifest,        │
│               Stage-0 emission, CRG SQLite pipeline)         │
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

Runtime assets under `.claude/`, `.codex/`, or `.agents/` are **generated outputs**, not editable source. `skills/`, `agents/`, `templates/`, and `docs/` are the source of truth.

## CLI Commands

### Managed-asset commands

| Command | Purpose | Notes |
|---------|---------|-------|
| `spec-first doctor` | Environment check | Verifies platform state, plugin manifest, and managed assets. `--claude` / `--codex` scopes to one platform. Reports `legacy managed state` when `init` is needed, and `--json` includes evidence schema/freshness plus `evidence_age_summary`. |
| `spec-first init` | Initialize the runtime | Syncs commands, skills, agents, runtime hooks, and developer metadata through managed operation plans. Also the only supported legacy upgrade entrypoint — performs a managed hard reset. See [What `init` writes](#what-init-writes) above. |
| `spec-first clean` | Remove managed assets | Removes the given platform's spec-first managed assets through the same operation-plan boundary used by `--dry-run`; does not migrate legacy state and does not strip the language policy marker block. |
| `spec-first stage0-context` | Emit Stage-0 runtime context | Called by SKILLs such as `spec-plan` / `spec-work` / `spec-review` at stage start. Accepts `--stage <plan\|work\|review>`, `--workflow <skill-name>`, `--format json`. |

### CRG graph commands (`spec-first crg <subcommand>`)

An embedded Code Review Graph runtime over SQLite + FTS5.

```bash
spec-first crg --help
spec-first crg build --repo .
spec-first crg review-context --repo . --changed <ref>
```

| Subcommand | Purpose |
|------------|---------|
| `build` | Build or incrementally refresh the graph DB from a repo |
| `stats` | Report node / edge / community counts and unresolved edges |
| `context` | Export a context bundle for a symbol or file |
| `query` | Eight structured lookups: `callers_of / callees_of / importers_of / importees_of / dependents_of / dependencies_of / tests_for / similar_to` |
| `impact` | Impact-of-change analysis for a file or symbol |
| `large-functions` | Find functions above a size threshold |
| `search` | FTS5 full-text search across symbols / files |
| `flows` | PageRank + BFS flow detection |
| `flow` / `affected-flows` | Inspect a single flow, or flows affected by a diff |
| `communities` / `community` | 3-pass community detection, plus single-community inspection |
| `architecture` | High-level architecture summary |
| `surprising-connections` | Cross-community / peripheral-to-hub surprise detector |
| `god-nodes` | High-fan-in hub detection |
| `detect-changes` | SHA-256 incremental change detection |
| `review-context` | Compose a review context bundle from a diff |
| `postprocess` | Recompute communities, flows, graph analysis, and FTS after a build or incremental refresh |

All subcommands accept `--repo=<path>`. The full list is whatever `spec-first crg --help` prints for the installed version.

## Documentation

Detailed manuals and implementation docs are currently Chinese-first.
Until English translations catch up, English readers can use [DeepWiki](https://deepwiki.com/sunrain520/spec-first) or [Ask ChatGPT](https://chatgpt.com/?q=Explain+the+project+sunrain520/spec-first+on+GitHub) as a supplementary entrypoint.

| Document | Language | Description |
|----------|----------|-------------|
| [Chinese README](./README.zh-CN.md) | zh | Full Chinese README |
| [User Manual](./docs/05-用户手册/README.md) | zh | Complete user manual index |
| [Quick Start](./docs/05-用户手册/01-快速开始.md) | zh | First-time setup walkthrough |
| [Core Concepts](./docs/05-用户手册/02-核心概念.md) | zh | Architecture and terminology |
| [Full Example](./docs/05-用户手册/03-完整示例.md) | zh | End-to-end delivery walkthrough |
| [FAQ](./docs/05-用户手册/04-常见问题.md) | zh | Troubleshooting and common issues |
| [Best Practices](./docs/05-用户手册/05-最佳实践.md) | zh | Team usage patterns |
| [Chinese Architecture Overview](./docs/02-架构设计/01-整体架构.md) | zh | System design for contributors |
| [Chinese Development Guide](./docs/03-实施方案/06-开发规范.md) | zh | Contributor standards |
| [Chinese Testing Plan](./docs/03-实施方案/04-测试方案.md) | zh | Verification and test strategy |
| [CHANGELOG](./CHANGELOG.md) | en / zh mixed | Canonical version history (machine-readable) |
| [Chinese Release Notes](./docs/08-版本更新/README.md) | zh | Narrative release notes |

## Local Development

```bash
git clone https://github.com/sunrain520/spec-first.git
cd spec-first
npm install --legacy-peer-deps
npm test
```

> `--legacy-peer-deps` is required because the vendored `tree-sitter` forks and `jest`'s peer-dependency resolution conflict under stricter resolvers. Omitting it typically fails the first `jest` run.

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

1. Fork the repository and create a feature branch from `master`.
2. Treat `master` as the only branch that accepts direct updates; `main` is an automatically synced mirror branch and should not receive direct development or commits.
3. Read [AGENTS.md](./AGENTS.md) for repository workflow conventions.
4. Run `npm install --legacy-peer-deps`, then `npm test`.
5. Open a PR with the change goal and verification details.
6. Every code / doc change must add a line to [CHANGELOG.md](./CHANGELOG.md) following the format defined at the top of that file.

Recommended reading before contributing: [AGENTS.md](./AGENTS.md) · [User Manual](./docs/05-用户手册/README.md) · [CHANGELOG](./CHANGELOG.md)

## License

[MIT](./LICENSE) © [sunrain520](https://github.com/sunrain520)
