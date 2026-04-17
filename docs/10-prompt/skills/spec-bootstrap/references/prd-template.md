# PRD Template - spec-bootstrap Context Worker

This template defines the structure for each context domain task contract. The orchestrator fills it with project-specific content during Phase 2 and writes it to:

```text
.spec-first/workflows/bootstrap/<slug>/tasks/<task-id>/prd.md
```

Workers read only their own PRD.

---

## PRD: Build `<context-domain>` Context Docs

### Goal

Build the `<context-domain>` context documentation for the `<project-name>` project.

Produce the following files under `docs/contexts/<slug>/`:
- `<file-path-1>`
- `<file-path-2>`

These files become part of the project’s long-lived context library.

### Context

> The orchestrator fills this section with project-specific findings from Phase 1 analysis.

**Project:** `<project-name>` (`<primary-language>`)
**Framework(s):** `<frameworks>`

**Relevant findings from Phase 1 analysis:**
- `<finding-1>`
- `<finding-2>`

### Tools Available

> Fill this section based on the detected analysis mode.

**Analysis mode: [Enhanced | Basic]**

**--- Enhanced Mode (Serena available) ---**

| Tool | Purpose | Example Call |
|------|---------|-------------|
| `mcp__serena__get_symbols_overview` | File structure | `mcp__serena__get_symbols_overview({relative_path: "src/auth.ts"})` |
| `mcp__serena__find_symbol` | Locate symbol | `mcp__serena__find_symbol({name_path_pattern: "AuthService", relative_path: "src/"})` |
| `mcp__serena__search_for_pattern` | Pattern search | `mcp__serena__search_for_pattern({substring_pattern: "export class.*Service"})` |
| `mcp__serena__find_referencing_symbols` | Find references | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

Recommended workflow:
1. `get_symbols_overview`
2. `find_symbol`
3. `find_referencing_symbols`
4. `search_for_pattern`
5. `Read`

**--- Basic Mode (built-in tools only) ---**

| Tool | Purpose | Example Call |
|------|---------|-------------|
| `Read` | Read specific files | `Read({file_path: "src/auth.ts"})` |
| `Grep` | Search by pattern | `Grep({pattern: "class Auth", type: "ts"})` |
| `Glob` | Find files by name | `Glob({pattern: "src/**/*.ts"})` |

Use whichever tools are available. Prefer higher-capability tools when present.

### Files to Fill

| File | Description |
|------|-------------|
| `docs/contexts/<slug>/<file-path>` | `<what this file should contain>` |

### Important Rules

1. Only write files listed in "Files to Fill".
2. Do not modify source code.
3. No git commands.
4. No placeholder text.
5. Use Markdown with `##` and `###`.
6. If multiple files are produced, ensure `index.md` matches the files that actually exist.

### Acceptance Criteria

- [ ] All files listed in "Files to Fill" are produced and non-empty
- [ ] No placeholder tokens remain
- [ ] Each file references at least 2 real codebase artifacts
- [ ] Files use structured Markdown
- [ ] No source code was modified

