# Archive Index

> Lifecycle: current. This index is a reading guide for historical CRG / CE / ECC search hits. It is not an implementation contract and does not override current source files, workflow skills, CLI code, or checked-in contracts.

## Current Source Of Truth

Use these paths before relying on historical materials:

- `docs/10-prompt/结构化项目角色契约.md`
- `AGENTS.md` and `CLAUDE.md`
- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-graph-bootstrap/SKILL.md`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*`
- `src/cli/`
- `src/cli/plugin.js`
- `src/cli/contracts/dual-host-governance/**`
- `docs/contracts/**`
- `docs/05-用户手册/`
- `README.md`, `README.zh-CN.md`, and `CHANGELOG.md`

## Risky Historical Tokens

Treat search hits containing these tokens as historical by default:

- `src/crg`
- `spec-first crg`
- `graph.db`
- `better-sqlite3`
- `.claude-plugin`
- `CRG Stage-0`
- `ECC`
- `compound-engineering-plugin`

## Reading Rule

历史材料保留的价值是解释演化背景、迁移原因和已知风险,不是提供当前 runtime contract。命中旧 CRG / ECC / CE 词汇时,先确认文档顶部 lifecycle banner,再回到 current source of truth 路径复核。

## High-Hit Historical Entries

| Path | Lifecycle | Current reading boundary |
|---|---|---|
| `docs/validation/2026-04-26-spec-first-engineering-deep-audit-report.md` | historical-input | 记录 2026-04-26 CRG implementation 状态；当前 graph/provider 以 GitNexus readiness contracts 为准。 |
| `docs/spec-graph-bootstrap-flow.md` | historical-input | 旧 graph-bootstrap bridge 文档；只用于理解迁移背景。 |
| `docs/02-架构设计/04-crg-阶段0-构建流水线.md` | historical-input | 旧 `spec-first crg build` / SQLite graph 设计；不代表当前 provider 主线。 |
| `docs/项目介绍/` | historical-input | 项目介绍和旧 CRG/CE/ECC 材料；不得覆盖当前 `skills/`、`src/cli/`、`docs/contracts/`。 |
| `docs/业界分析/` | external-reference | 外部实践输入；只作启发和对照。 |
