# spec-first

[English](./README.md) | [简体中文](./README.zh-CN.md)

`spec-first` is a Node.js CLI and workflow asset bundle for spec-driven AI engineering on Claude Code and Codex. It installs deterministic project helpers and host-specific workflow assets, while leaving semantic planning, implementation judgment, and review decisions to the LLM.

## Current Scope

`spec-first` provides:

- CLI helpers: `doctor`, `init`, `clean`, `tasks`, version/help output, and deterministic setup checks.
- Workflow source assets under `skills/`, `agents/`, and `templates/`.
- Host-filtered runtime generation for Claude Code and Codex.
- MCP/helper readiness through `$spec-mcp-setup`.
- Plan, task-pack, work, review, setup, session, release-note, and compound workflows.

The internal CRG runtime and graph-bootstrap workflow have been removed. Current workflows rely on explicit repo context, task packs, diffs, tests, direct file reads, and optional tools supplied by the user or host.

## Install

```bash
npm install -g spec-first
spec-first doctor
spec-first init --claude -u <name> --lang zh
spec-first init --codex -u <name> --lang zh
```

Use `spec-first clean --claude` or `spec-first clean --codex` to remove managed runtime assets. Runtime copies under `.claude/`, `.codex/`, and `.agents/skills/` are generated assets; edit source files under `skills/`, `agents/`, `templates/`, and `src/cli/` instead.

## Codebase Context After CRG Removal

The internal CRG runtime has been removed. For current workflows:

- Use `$spec-plan` for design and implementation planning.
- Use `$spec-write-tasks` to compile executable task packs.
- Use `$spec-work` with direct repo reads, nearby files, task packs, diffs, and tests.
- Use `$spec-code-review` for review from diff, plan/task evidence, targeted file reads, and test results.
- Use `$spec-mcp-setup` only for MCP/helper readiness, not graph readiness.

## Main Commands

```bash
spec-first --help
spec-first --version
spec-first doctor [--json] [--claude|--codex]
spec-first init (--claude|--codex) [-u <name>] [--lang zh|en] [--dry-run]
spec-first clean (--claude|--codex) [--dry-run]
spec-first tasks hash <plan.md>
spec-first tasks validate <task-pack.md> --json
```

## Runtime Assets

| Layer | Current Contract |
|---|---|
| **Capability layer** | Bundled source assets ship with `39` skills, `51` agents and no agent support files. Runtime delivery is host-filtered by governance: the current bundle installs `18` commands + `2` standalone skills + `2` agent-facing internal skills on Claude, and `18` workflow skills + `2` standalone skills + `2` agent-facing internal skills on Codex, with `51` agents on both hosts |
| **Claude runtime** | Commands are generated under `.claude/commands/spec`, skills under `.claude/skills`, agents under `.claude/agents`, and managed state under `.claude/spec-first/state.json`. |
| **Codex runtime** | Workflow skills are generated under `.agents/skills`, agents under `.codex/agents`, and managed state under `.codex/spec-first/state.json`. |
| **Readiness** | `$spec-mcp-setup` manages MCP/helper readiness. It does not report graph readiness. |

Expected Claude init output includes:

```text
📦 Generated 18 command file(s) in .claude/commands/spec
🧩 Generated 4 skill directory(ies) in .claude/skills
🤖 Generated 51 agent file(s) in .claude/agents
```

## Workflow Entry Points

| Intent | Claude Code | Codex |
|---|---|---|
| Brainstorm requirements | `/spec:brainstorm` | `$spec-brainstorm` |
| Write or deepen a plan | `/spec:plan` | `$spec-plan` |
| Compile task pack | use installed `write-tasks` skill | `$spec-write-tasks` |
| Execute work | `/spec:work` | `$spec-work` |
| Review code | `/spec:code-review` | `$spec-code-review` |
| Review docs/plans | `/spec:doc-review` | `$spec-doc-review` |
| Setup MCP/helper tools | `/spec:mcp-setup` | `$spec-mcp-setup` |
| Capture learning | `/spec:compound` | `$spec-compound` |

## Development

```bash
npm run typecheck
npm run test:unit
npm run test:smoke
npm run test:integration
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
