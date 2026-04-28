# spec-first

[English](./README.md) | [简体中文](./README.zh-CN.md)

`spec-first` is a Node.js CLI and workflow asset bundle for spec-driven AI engineering on Claude Code and Codex. It installs deterministic project helpers and host-specific workflow assets, while leaving semantic planning, implementation judgment, and review decisions to the LLM.

## Current Scope

`spec-first` provides:

- CLI helpers: `doctor`, `init`, `clean`, `tasks`, version/help output, and deterministic setup checks.
- Workflow source assets under `skills/`, `agents/`, and `templates/`.
- Host-filtered runtime generation for Claude Code and Codex.
- Required harness runtime setup through the host-specific setup workflow (`/spec:mcp-setup` on Claude Code, `$spec-mcp-setup` on Codex), covering MCP servers, graph-provider MCP servers, helper CLIs, and project setup facts.
- External graph readiness compilation through the host-specific graph bootstrap workflow (`/spec:graph-bootstrap` on Claude Code, `$spec-graph-bootstrap` on Codex), producing canonical graph and impact readiness artifacts for downstream workflows.
- Public workflow entrypoints for ideation, brainstorming, planning, task-pack handoff, work execution, debugging, review, setup, update, session research, Slack research, release notes, compounding, optimization, and browser-visible polish.

Graph context is provided by external graph providers configured by the setup workflow and compiled into canonical readiness artifacts by the graph bootstrap workflow.

## Install

```bash
npm install -g spec-first
spec-first doctor
spec-first init --claude -u <name> --lang zh
spec-first init --codex -u <name> --lang zh
```

Use `spec-first clean --claude` or `spec-first clean --codex` to remove managed runtime assets. Runtime copies under `.claude/`, `.codex/`, and `.agents/skills/` are generated assets; edit source files under `skills/`, `agents/`, `templates/`, and `src/cli/` instead.

## Context And Graph Readiness

Current context and graph readiness use this path:

- Use the current host's setup workflow to install and verify the required harness runtime: Serena, Sequential Thinking, Context7, GitNexus, code-review-graph, `agent-browser`, `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`, `ast-grep`, and the global `ast-grep` skill.
- Use the current host's graph bootstrap workflow after setup reports `baseline_ready=true`. It reads setup-owned config facts, validates provider command arrays, runs transient GitNexus/code-review-graph probes, and writes `.spec-first/graph/*`, `.spec-first/providers/*`, and `.spec-first/impact/*` readiness artifacts.
- Use the current host's plan workflow as the first graph-readiness consumer. It reports graph status, checks staleness, and falls back to bounded direct repo reads when facts are unavailable, blocked, stale, or degraded.
- In a parent workspace with multiple child Git repos, pass an explicit `--repo <child>` to setup/bootstrap scripts. The parent workspace only reports candidate repos and never owns repo-local `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, or `.serena/*` artifacts.
- Use standalone `spec-write-tasks` for deterministic task-pack handoff, then the current host's work, code-review, and doc-review workflows with the current request, plans/task packs, diffs, targeted file reads, and tests as scope authority.

## Main Commands

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan-path> [--json]
spec-first tasks validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]
```

## Runtime Assets

| Layer | Current Contract |
|---|---|
| **Capability layer** | Bundled source assets ship with `39` skills, `51` agents and no agent support files. Runtime delivery is host-filtered by governance: the current bundle installs `18` commands + `2` standalone skills + `2` agent-facing internal skills on Claude, and `18` workflow skills + `2` standalone skills + `2` agent-facing internal skills on Codex, with `51` agents on both hosts |
| **Claude runtime** | Commands are generated under `.claude/commands/spec`, standalone and agent-facing internal skills under `.claude/skills`, command-backed workflow skill copies under `.claude/spec-first/workflows`, agents under `.claude/agents`, and managed state under `.claude/spec-first/state.json`. |
| **Codex runtime** | Workflow, standalone, and agent-facing internal skills are generated under `.agents/skills`, agents under `.codex/agents`, and managed state under `.codex/spec-first/state.json`. |
| **Readiness** | The setup workflow writes readiness ledger v2 plus setup-owned `graph-providers.json`, `runtime-capabilities.json`, and `provider-artifacts.json`; the graph bootstrap workflow consumes those facts and writes canonical graph facts, provider status, impact capabilities, and a report. |

Expected Claude init output includes:

```text
📦 Generated 18 command file(s) in .claude/commands/spec
🧩 Generated 4 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
下一步:
  1. 重启 Claude Code 或新开会话，让宿主加载刚生成的 /spec:* commands。
  2. 在新会话运行 /spec:mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 /spec:mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 /spec:graph-bootstrap。
```

Expected Codex init output includes:

```text
🧩 Generated 22 skill directory(ies) in .agents/skills
🤖 Generated 51 agent file(s) in .codex/agents
下一步:
  1. 重启 Codex 或新开会话，让宿主加载刚生成的 $spec-* skills。
  2. 在新会话运行 $spec-mcp-setup，安装并验证必装 MCP/helper runtime。
  3. 如果 $spec-mcp-setup 显示 graph bootstrap 仍 pending，再按提示运行 $spec-graph-bootstrap。
```

## Workflow Entry Points

| Intent | Claude Code | Codex |
|---|---|---|
| Setup required harness runtime | `/spec:mcp-setup` | `$spec-mcp-setup` |
| Compile graph readiness facts | `/spec:graph-bootstrap` | `$spec-graph-bootstrap` |
| Update spec-first or runtime assets | `/spec:update` | `$spec-update` |
| Search agent session history | `/spec:sessions` | `$spec-sessions` |
| Research Slack context | `/spec:slack-research` | `$spec-slack-research` |
| Generate and evaluate ideas | `/spec:ideate` | `$spec-ideate` |
| Brainstorm requirements | `/spec:brainstorm` | `$spec-brainstorm` |
| Review docs/plans | `/spec:doc-review` | `$spec-doc-review` |
| Write or deepen a plan | `/spec:plan` | `$spec-plan` |
| Compile task pack | use installed `write-tasks` skill | standalone `spec-write-tasks` skill |
| Debug a failure or bug | `/spec:debug` | `$spec-debug` |
| Execute work | `/spec:work` | `$spec-work` |
| Execute work with Codex delegation beta | `/spec:work-beta` | `$spec-work-beta` |
| Optimize a measurable outcome | `/spec:optimize` | `$spec-optimize` |
| Polish browser-visible UI beta | `/spec:polish-beta` | `$spec-polish-beta` |
| Review code | `/spec:code-review` | `$spec-code-review` |
| Capture learning | `/spec:compound` | `$spec-compound` |
| Refresh stale learnings | `/spec:compound-refresh` | `$spec-compound-refresh` |
| Read release notes | `/spec:release-notes` | `$spec-release-notes` |

## Development

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

## Documentation

Detailed manuals and implementation docs are currently Chinese-first.

- [Chinese Architecture Overview](./docs/02-架构设计/01-整体架构.md)
- [Chinese Development Guide](./docs/03-实施方案/06-开发规范.md)
- [Chinese Testing Plan](./docs/03-实施方案/04-测试方案.md)
- [Chinese Release Notes](./docs/08-版本更新/README.md)

## Design Boundary

`spec-first` keeps deterministic execution in scripts and semantic judgment in the LLM:

- Scripts install, validate, generate, clean, hash, and report machine facts.
- The LLM chooses scope, evaluates tradeoffs, plans implementation, performs review judgment, and decides what evidence matters.
- Source-of-truth assets live in this repository. Generated runtime assets are disposable and should be regenerated with `spec-first init`.
