<!-- spec-bootstrap -->
# spec-first Context

Generated: 2026-04-07 | spec-first bootstrap

> ⚠️ This document reflects the repository state at generation time.
> It is not automatically synchronized with subsequent code changes.

## Contents

- [Summary](00-summary.md) — project overview, tech stack, core commands, and key module responsibilities
- [Architecture](architecture/) — system overview, module map, integration boundaries
  - [system-overview.md](architecture/system-overview.md) — layered architecture strategy and key design decisions
  - [module-map.md](architecture/module-map.md) — top-level directory responsibilities by layer
  - [integration-boundaries.md](architecture/integration-boundaries.md) — external dependencies, module interfaces, platform boundaries
- [Pitfalls](pitfalls/index.md) — known high-risk areas with file locations, risk types, and mitigations
- [CLI Layer](layers/cli/index.md) — CLI entry points, command parameter formats, asset sync data flow, Platform Adapter pattern, test strategy

## Project Snapshot

- **Language:** JavaScript (Node.js, CommonJS)
- **Type:** npm CLI tool + AI workflow asset package
- **Version at generation:** 1.5.1
- **Commands:** `init`, `doctor`, `clean`
- **Platforms:** Claude Code (`.claude/`), Codex (`.codex/` + `.agents/skills/`)
- **Assets:** 42+ skills, 46 agents, 8 command templates
- **Analysis mode:** Basic (JavaScript not in ABCoder support matrix; Serena active language: bash only)
- **DB access:** not detected
