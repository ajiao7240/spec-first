# PRD Template — spec-bootstrap Context Worker

This template defines the structure for each context domain task contract. The orchestrator (main Claude instance) fills this template with project-specific content during Phase 2 and writes it to:

```
.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md
```

Workers read only their own PRD. They do not read other tasks' PRDs.

---

## PRD: Build `<context-domain>` Context Docs

### Goal

Build the `<context-domain>` context documentation for the `<project-name>` project.

Produce the following files under `docs/contexts/<slug>/`:
- `<file-path-1>`
- `<file-path-2>`

These files become part of the project's long-lived context library. They are not temporary — treat them as durable documentation assets.

---

### Context

> The orchestrator fills this section with project-specific findings from Phase 1 analysis.
> Include: language/framework stack, relevant module boundaries, key patterns, architectural decisions.
> Be specific — paste actual directory names, file names, framework names, and observed patterns.

**Project:** `<project-name>` (`<primary-language>`)
**Framework(s):** `<frameworks>`
**Key modules relevant to this domain:**

```
<paste relevant directory tree or module list>
```

**Relevant findings from Phase 1 analysis:**
- `<finding-1>`
- `<finding-2>`

---

### Tools Available

> The orchestrator fills this section based on the detected analysis mode.

**Analysis mode: [Full | Enhanced | Basic]**

**Full mode — if GitNexus + ABCoder MCP are available:**
- `gitnexus_query` — query module clusters, execution flows, call graphs
- `gitnexus_context` — get architectural context for a module
- `mcp__abcoder__list_repos` → `get_repo_structure` → `get_package_structure` → `get_ast_node` — symbol-level code analysis

**Enhanced mode — if Serena MCP is available:**
- `mcp__serena__get_symbols_overview` — high-level symbol structure of a file
- `mcp__serena__find_symbol` — locate specific class/method/function
- `mcp__serena__search_for_pattern` — pattern search across the codebase
- `mcp__serena__find_referencing_symbols` — find what references a given symbol

**Basic mode — built-in tools always available:**
- `Read` — read specific files
- `Grep` — search file contents by pattern
- `Glob` — find files by name pattern

Use whichever tools are available. Prefer higher-capability tools when present.

---

### Files to Fill

You own exclusively the following files. Do not write to any other file.

| File | Description |
|------|-------------|
| `docs/contexts/<slug>/<file-path>` | `<what this file should contain>` |

**Content requirements for each file:**
- Must contain project-specific content — not placeholder text or generic descriptions
- Must reference actual file paths, class names, or patterns observed in the codebase
- Must include structured sections (## headings)
- May add sections not in this template if the project warrants them
- May skip planned sub-sections if no relevant evidence exists (note why)

---

### Important Rules

1. **File ownership is strict:** Only write files listed in "Files to Fill" above. Do not touch other context files, source code files, or task PRDs.
2. **No source code changes:** Read source code freely for analysis. Never modify it.
3. **No git commands:** Do not run `git add`, `git commit`, `git push`, or any other git command.
4. **No placeholder text:** Every section must contain real project content. Delete template sections that have no evidence.
5. **Context files are not fixed:** Adapt the template to the project. Delete inapplicable sections. Add new sections for project-specific patterns.
6. **Format:** Markdown. Use `## H2` for top-level sections, `### H3` for sub-sections. Code blocks for code examples and file paths.
7. **index.md alignment:** If you produce multiple files, ensure `index.md` links to the actual generated files.
8. **Time limit:** Complete your assigned files within 20 minutes. If analysis scope is too large, prioritize breadth (cover all major modules at summary depth) over depth (exhaustive per-file analysis).

---

### Acceptance Criteria

- [ ] All files listed in "Files to Fill" are produced and non-empty
- [ ] No file contains placeholder text like `<TODO>`, `<fill-in>`, `[TBD]`, or template section headers with no content
- [ ] Each file references at least 2 specific artifacts from the actual codebase (file paths, class names, function names, config keys)
- [ ] Files use structured Markdown (at minimum: a top-level `#` heading and two `##` sections)
- [ ] No source code was modified
- [ ] `index.md` (if produced) lists only files that were actually created

### Self-Check

Before reporting completion, verify:

- All owned files exist and are non-empty
- No placeholder tokens like `<TODO>`, `<fill-in>`, or `[TBD]` remain
- Each file references real codebase artifacts, not generic descriptions
- No source code was modified
- `index.md` links only to files that actually exist

If any check fails, fix the files first and only then report completion

---

### Technical Notes

> The orchestrator fills this section with project-specific conventions.

- **File naming conventions:** `<observed conventions>`
- **Known patterns:** `<patterns to be aware of>`
- **Anti-patterns to document:** `<if known>`
- **Framework-specific notes:** `<relevant framework quirks>`

---

*This PRD is a one-time task contract. It is not kept in sync with subsequent code changes.*

## Example — Filled PRD

> Desensitized from a real `spec-bootstrap` run. Names are anonymized, but path formats and symbol patterns are real.

### Goal

Build the `summary-context` documentation for the `<project>` project.

Produce:
- `docs/contexts/<slug>/00-summary.md`

### Context

**Project:** `<project>` (`JavaScript`)
**Framework(s):** `Node.js CLI`
**Key modules relevant to this domain:**

```text
src/cli/
  ├── commands/init.js
  ├── commands/doctor.js
  ├── plugin.js
  └── developer.js
skills/spec-bootstrap/
  ├── SKILL.md
  └── references/prd-template.md
```

**Relevant findings from Phase 1 analysis:**
- `src/cli/plugin.js` exports `syncSkills()` and `syncAgents()` for runtime asset installation
- `src/cli/adapters/base.js` defines `PlatformAdapter`, and `src/cli/adapters/claude.js` / `src/cli/adapters/codex.js` implement platform-specific behavior

### Tools Available

**Analysis mode: Enhanced**

- `mcp__serena__get_symbols_overview`
- `mcp__serena__find_symbol`
- `mcp__serena__search_for_pattern`
- `Read`
- `Grep`
- `Glob`

### Files to Fill

| File | Description |
|------|-------------|
| `docs/contexts/<slug>/00-summary.md` | Project overview, stack, and top-level structure |

### Technical Notes

- Use the repo's actual command/module names, not generic placeholders
- Reference concrete config keys or exported functions when describing the stack
- Keep the document short, specific, and durable
