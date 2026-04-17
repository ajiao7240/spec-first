[English](./README.md) | [简体中文](./README.zh-CN.md)

<div align="center">
<h1>Spec-First</h1>

<p><strong>Turn AI coding into a spec-driven, harness-engineered workflow.</strong></p>

<p>An open-source <strong>AI coding workflow CLI</strong> for <strong>Claude Code</strong> and <strong>Codex</strong>.</p>

<p>
  <code>Doctor → Init → Workflow</code>
  <code>npm install -g spec-first</code>
  <code>Claude Code + Codex</code>
  <code>Ideate → Brainstorm → Plan → Work → Review → Compound</code>
</p>

<p>Built for <strong>spec-driven development</strong>, <strong>harness engineering</strong>, and governed AI delivery loops.</p>

<p>
  <a href="#quick-start"><strong>Quick Start</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="#core-workflow"><strong>Workflow</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="./docs/05-用户手册/README.md"><strong>Chinese Manual</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="https://www.npmjs.com/package/spec-first"><strong>npm</strong></a>
  <span>&nbsp;•&nbsp;</span>
  <a href="http://1.15.14.36:8087/"><strong>Website</strong></a>
</p>

<p>
  <a href="https://www.npmjs.com/package/spec-first"><img src="https://img.shields.io/npm/v/spec-first?style=flat-square&color=2563eb" alt="npm version"></a>
  <a href="https://npmtrends.com/spec-first"><img src="https://img.shields.io/npm/dm/spec-first?style=flat-square&color=cb3837&label=downloads" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/sunrain520/spec-first?style=flat-square&color=16a34a" alt="license"></a>
  <a href="https://github.com/sunrain520/spec-first/stargazers"><img src="https://img.shields.io/github/stars/sunrain520/spec-first?style=flat-square&color=eab308" alt="GitHub stars"></a>
  <a href="./docs/05-用户手册/README.md"><img src="https://img.shields.io/badge/docs-Chinese%20manual-0f766e?style=flat-square" alt="Chinese manual"></a>
  <a href="https://github.com/sunrain520/spec-first/issues"><img src="https://img.shields.io/github/issues/sunrain520/spec-first?style=flat-square&color=e67e22" alt="GitHub issues"></a>
  <a href="https://github.com/sunrain520/spec-first/pulls"><img src="https://img.shields.io/github/issues-pr/sunrain520/spec-first?style=flat-square&color=9b59b6" alt="GitHub PRs"></a>
  <a href="https://deepwiki.com/sunrain520/spec-first"><img src="https://img.shields.io/badge/Ask-DeepWiki-blue?style=flat-square" alt="Ask DeepWiki"></a>
  <a href="https://chatgpt.com/?q=Explain+the+project+sunrain520/spec-first+on+GitHub"><img src="https://img.shields.io/badge/Ask-ChatGPT-74aa9c?style=flat-square&logo=openai&logoColor=white" alt="Ask ChatGPT"></a>
</p>
</div>

<p align="center">
  <img alt="Spec-First overview" src="./docs/assets/svg/spec-first-overview.svg">
</p>

## Overview

`spec-first` is an open-source `npm` CLI for **Claude Code** and **Codex**.
It packages **AI coding workflow**, **spec-driven development**, and **harness engineering** into a repeatable delivery loop with explicit artifacts, structured review, and reusable engineering knowledge.

It is designed for teams that want `requirements → plan → implementation → review → compound` instead of one-off AI chat output.

Claude continues to expose `/spec:*` workflow commands, while Codex uses `$spec-*` skill entrypoints discovered from `.agents/skills/`.

### Best For

- Teams moving from prompt-driven coding to governed AI engineering workflows
- Claude Code and Codex users who want one repeatable delivery system across both hosts
- Projects that need explicit specs, structured review, and reusable post-task learnings

Stage-0 currently has two parallel entrypoints:

- `/spec:bootstrap` or `$spec-bootstrap` is the stable default.
- `/spec:graph-bootstrap` or `$spec-graph-bootstrap` is the graph-informed Phase 0-4 entrypoint for fact extraction and context generation.

For first-time host setup, use:

- Claude Code: `spec-first init --claude` → `/spec:mcp-setup` → restart Claude Code → `/spec:bootstrap`
- Codex: `spec-first init --codex` → `$spec-mcp-setup` → restart Codex → `$spec-bootstrap`

## Quick Start

### Prerequisites

- Node.js `>=20`
- At least one of **Claude Code** or **Codex**

### 1. Install the CLI

```bash
npm install -g spec-first
spec-first -v
```

### 2. Check the environment

```bash
spec-first doctor
spec-first doctor --claude
spec-first doctor --codex
```

### 3. Initialize a project

```bash
spec-first init --claude
# or
spec-first init --codex
```

If `doctor` reports `legacy managed state`, or `clean` refuses to handle a legacy install, do not manually delete runtime directories first. Re-run the matching `init` command instead. The current upgrade policy is a hard cut:

- `init` is the only supported legacy upgrade entrypoint
- `init` performs a managed hard reset before rebuilding the runtime
- `clean` only removes the current managed asset set; it does not migrate legacy state

To set the developer identity explicitly:

```bash
spec-first init --claude -u <name> --lang <zh|en>
spec-first init --codex -u <name> --lang <zh|en>
```

Identity resolution rules:

- If `-u/--user` is omitted, Spec-First first reads the global `~/.spec-first/.developer`
- If no global profile exists, it falls back to `git config user.name`
- If `--lang` is omitted, Spec-First prefers the existing project `.developer`, then the global profile, then defaults to `zh`

### 4. Start the workflow

#### Claude Code first run

```text
# Step 1: Initialize project runtime
spec-first init --claude

# Step 2: Install MCP tools
/spec:mcp-setup

# Step 3: Restart Claude Code

# Step 4: Generate project context
/spec:bootstrap

# Optional graph-informed entrypoint
/spec:graph-bootstrap

# Continue through the workflow
/spec:ideate
/spec:brainstorm
/spec:plan
/spec:work
/spec:review
/spec:compound
```

`bootstrap` performs a Host Readiness Gate at startup. If the current host's `mcp-setup` entrypoint was skipped or the host was not restarted, it stops with explicit guidance instead of degrading silently.

#### Codex

```text
# Step 1: Initialize project runtime
spec-first init --codex

# Step 2: Install MCP tools
$spec-mcp-setup

# Step 3: Restart Codex

# Step 4: Generate project context
$spec-bootstrap

# Optional graph-informed entrypoint
$spec-graph-bootstrap

# Continue through the workflow
$spec-ideate
$spec-brainstorm
$spec-plan
$spec-work
$spec-review
$spec-compound
```

## Example Output

```bash
$ spec-first init --claude

📋 Wrote language policy to CLAUDE.md
📦 Generated 13 command file(s) in .claude/commands/spec
🧩 Generated 34 skill directory(ies) in .claude/skills
🤖 Generated 57 agent file(s) in .claude/agents
🧰 Generated 4 agent support file(s) in .claude/agents
🪪 Wrote project developer profile:
  📍 path: .claude/spec-first/.developer
  👤 name: yourname
  🈯 lang: zh
  ⏱ initialized_at: 2026-04-15T00:00:00.000Z
  🔖 version: 1.5.1

🔁 Restart Claude Code after generation so it can pick up the new /spec:* commands.
```

After init, the usual first-run paths are:

```text
Claude Code: /spec:mcp-setup → restart → /spec:bootstrap → /spec:ideate → /spec:brainstorm → /spec:plan → /spec:work → /spec:review → /spec:compound
Codex:       $spec-mcp-setup → restart → $spec-bootstrap → $spec-ideate → $spec-brainstorm → $spec-plan → $spec-work → $spec-review → $spec-compound
```

If you need the graph-informed Stage-0 path, use `/spec:graph-bootstrap` or `$spec-graph-bootstrap`. It covers Phase 0-4 fact extraction and context generation, while `bootstrap` remains the stable default.

## Why Spec-First

Most AI coding failures do not come from weak models. They come from unstable engineering boundaries:

- requirements are not made explicit
- plans drift from implementation
- reviews are unstructured
- solved problems are not turned into reusable knowledge

Spec-First focuses on the full delivery loop, not a single response:

- manage project runtime assets with `doctor / init / clean`
- provide stable entrypoints through `/spec:*` and `$spec-*`
- constrain execution with Stage-0 plus a multi-stage workflow
- improve future work through structured review and knowledge compounding

## What You Get

| Capability | Description |
|------|-------------|
| Dual platform support | Works with both Claude Code and Codex |
| CLI control plane | Manage install, health checks, and cleanup with three core commands |
| Workflow layer | Includes Stage-0, Ideate, Brainstorm, Plan, Work, Review, and Compound |
| Capability layer | Ships with `47` skills, `57` agents, and `4` agent support files |
| Runtime governance | Managed runtime assets can be synchronized, refreshed, recovered, and cleaned |
| Open documentation | Includes manuals, architecture docs, plans, and accumulated learnings |

## Core Workflow

<p align="center">
  <img src="./docs/assets/svg/spec-first-workflow.svg" alt="Spec-First workflow">
</p>

| Stage | Claude Code | Codex | Goal | Main Artifact |
|------------|-------------|-------|-----------|--------------------|
| Host Setup | `/spec:mcp-setup` → restart Claude Code | `$spec-mcp-setup` → restart Codex | Install and configure the MCP toolchain; write host readiness markers | `~/.claude/spec-first/host-setup.json` / `~/.codex/spec-first/host-setup.json` |
| Stage-0 | `/spec:bootstrap` (stable)<br>`/spec:graph-bootstrap` (graph-informed) | `$spec-bootstrap` (stable)<br>`$spec-graph-bootstrap` (graph-informed) | Build long-lived project context | `docs/contexts/<slug>/` |
| Ideate | `/spec:ideate` | `$spec-ideate` | Generate and rank candidate directions | `docs/ideation/*.md` |
| Brainstorm | `/spec:brainstorm` | `$spec-brainstorm` | Clarify requirements, narrow scope, define acceptance | `docs/brainstorms/*.md` |
| Plan | `/spec:plan` | `$spec-plan` | Build the implementation plan, break work down, identify risks | `docs/plans/*.md` |
| Work | `/spec:work` | `$spec-work` | Execute the plan and add tests/docs | code + tests |
| Review | `/spec:review` | `$spec-review` | Produce structured review findings and a quality decision | review report |
| Compound | `/spec:compound` | `$spec-compound` | Turn solved work into reusable knowledge assets | `docs/solutions/**/*.md` |

<p align="center">
  <img src="./docs/assets/svg/workflow-end-to-end.svg" alt="Spec-First end-to-end workflow">
</p>

## Architecture

<p align="center">
  <img src="./docs/assets/svg/three-layer-architecture.svg" alt="Three-layer architecture">
</p>

Spec-First is not about adding more prompt text. It is about building a stable three-layer system:

1. Entry Layer
   `spec-first` CLI checks the environment, initializes platform runtime assets, and cleans managed assets.
2. Workflow Layer
   Skills define stage boundaries, input/output contracts, and execution order.
3. Capability Layer
   Agents provide review, research, design, documentation, and specialist analysis capabilities.

The project runtime model looks like this:

<p align="center">
  <img src="./docs/assets/svg/spec-first-runtime-assets.svg" alt="Runtime assets">
</p>

## CLI Commands

| Command | Purpose | Notes |
|------|------|------|
| `spec-first doctor` | Environment check | Verifies local environment, platform state, plugin manifest, and managed assets; `--claude` and `--codex` scope checks to one platform. If a legacy managed state is found, doctor explicitly tells you to use `init` for the hard reset path. |
| `spec-first init` | Initialize runtime | Synchronizes commands, standalone skills, workflow skills, agents, agent support files, and developer metadata into the current project; also the only supported legacy upgrade entrypoint. |
| `spec-first clean` | Clean runtime | Removes the current Spec-First managed project assets while preserving unmanaged content; does not perform legacy state migration. |

For help:

```bash
spec-first --help
```

## Use Cases

- you want AI to understand the project before implementation begins
- you want `requirements → plan → implementation → review → compounding` to be a team-level workflow
- you want structured review and multi-angle quality gates on AI output
- you want solved problems to become reusable inputs for future work
- you want one methodology across Claude Code and Codex

## Open-Source Repository Model

This repository is simultaneously:

- a publishable `npm` CLI package
- a versioned source repository for workflow assets
- an open-source project evolving AI engineering methodology over time

`skills/`, `agents/`, `templates/`, and `docs/` are source-of-truth assets. Runtime copies under `.claude/`, `.codex/`, or `.agents/` are generated outputs, not editable source.

## Documentation

Detailed manuals and implementation docs are currently Chinese-first. Use [README.zh-CN](./README.zh-CN.md) and the [Chinese User Manual](./docs/05-用户手册/README.md) for full coverage.

### Suggested reading paths

- First-time users: [Chinese Quick Start](./docs/05-用户手册/01-快速开始.md) → [Chinese Core Concepts](./docs/05-用户手册/02-核心概念.md) → [Chinese Full Example](./docs/05-用户手册/03-完整示例.md)
- Troubleshooting: [Chinese FAQ](./docs/05-用户手册/04-常见问题.md) → [Chinese Best Practices](./docs/05-用户手册/05-最佳实践.md)
- Contributors: [Chinese Architecture Overview](./docs/02-架构设计/01-整体架构.md) → [Chinese Development Guide](./docs/03-实施方案/06-开发规范.md) → [Chinese Testing Plan](./docs/03-实施方案/04-测试方案.md)

### User-facing docs

- [Chinese README](./README.zh-CN.md)
- [Chinese User Manual](./docs/05-用户手册/README.md)
- [Chinese Quick Start](./docs/05-用户手册/01-快速开始.md)
- [Chinese Core Concepts](./docs/05-用户手册/02-核心概念.md)
- [Chinese Full Example](./docs/05-用户手册/03-完整示例.md)
- [Chinese FAQ](./docs/05-用户手册/04-常见问题.md)
- [Chinese Best Practices](./docs/05-用户手册/05-最佳实践.md)
- [Chinese Local Source Install Guide](./docs/05-用户手册/06-本地源码安装.md)

### Chinese design and implementation docs

- [Chinese Architecture Overview](./docs/02-架构设计/01-整体架构.md)
- [Chinese Repository Structure](./docs/02-架构设计/02-目录结构.md)
- [Chinese Agent Workflow Patterns](./docs/02-架构设计/03-agent-workflow-patterns.md)
- [Chinese Development Guide](./docs/03-实施方案/06-开发规范.md)
- [Chinese Testing Plan](./docs/03-实施方案/04-测试方案.md)
- [Chinese Release Notes](./docs/08-版本更新/README.md)

## Local Development

```bash
git clone https://github.com/sunrain520/spec-first.git
cd spec-first
npm test
```

Common verification commands:

```bash
npm run test:smoke
npm run test:integration
bash tests/unit/lang-policy.sh
bash tests/unit/mcp-setup.sh
npm pack
```

## Contributing

Issues and pull requests are welcome.

To report a bug, open an [Issue](https://github.com/sunrain520/spec-first/issues) with reproduction steps, environment details, and expected behavior.

To contribute code:

1. Fork the repository and create a feature branch from `main`
2. Read [AGENTS.md](./AGENTS.md) for repository workflow conventions
3. Run `npm test`
4. Open a PR with the change goal and verification details

Recommended reading before contributing:

- [AGENTS.md](./AGENTS.md)
- [Chinese User Manual](./docs/05-用户手册/README.md)
- [Chinese Release Notes](./docs/08-版本更新/README.md)

## License

[MIT](./LICENSE) © [sunrain520](https://github.com/sunrain520)
