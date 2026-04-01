---
title: "feat: Repo-level language governance via init-time instruction file writes"
type: feat
status: active
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-runtime-language-governance-requirements.md
---

# feat: Repo-level Language Governance

## Overview

`spec-first init` currently resolves `lang` (zh/en) and writes it to the platform `.developer`
file but does nothing to propagate that setting to the AI assistant's instruction files
(`CLAUDE.md` for Claude, `AGENTS.md` for Codex). This means language governance depends on
whatever is already in CLAUDE.md / AGENTS.md — often nothing — leading to inconsistent
response languages across sessions.

This plan wires `lang` governance into the init flow: after writing `.developer`, init also
writes (or idempotently updates) a managed language policy block in the repo-root instruction
file, and bootstraps `CHANGELOG.md` if one does not exist.

## Problem Frame

See origin doc: `docs/brainstorms/2026-04-01-runtime-language-governance-requirements.md`

Prompts, skills, and agent profiles are English-only. When `lang=zh`, the AI should still
respond in Chinese for all natural-language output. The only reliable way to enforce this
across all sessions is to write the rule into the instruction file the platform reads on every
startup — CLAUDE.md (Claude Code) or AGENTS.md (Codex).

## Requirements Trace

- R1. `--claude` reads `lang` from `.claude/spec-first/.developer`; `--codex` reads from `.codex/spec-first/.developer` *(see origin: R1)*
- R2. Valid values: `zh`, `en`; default to `zh` on missing/invalid *(see origin: R2)*
- R2a. Priority: CLI `--lang` > global `~/.spec-first/.developer.lang` > `zh`; `--lang` also writes back to project `.developer` *(see origin: R2a; already implemented in `developer.js`)*
- R3. init writes/updates a lang policy block in the repo-root instruction file; `--lang` re-runs update the block *(see origin: R3)*
- R4. `--claude` writes `CLAUDE.md`; `--codex` writes `AGENTS.md`; create if missing, append/update if present *(see origin: R4)*
- R5. Write is idempotent via `<!-- spec-first:lang:start -->` / `<!-- spec-first:lang:end -->` markers *(see origin: R5)*
- R6. Instruction file must contain the changelog iron law: source-code changes without a matching `CHANGELOG.md` entry must be refused at the prompt layer *(see origin: R6)*
- R7. If `CHANGELOG.md` is absent, create it with a format header and a bootstrap entry; do not touch it if it already exists *(see origin: R7)*
- R8. CHANGELOG format for spec-first-bootstrapped repos uses versioned entry lines: `- vX.Y.Z YYYY-MM-DD author: summary [(user-visible)]` *(see origin: R8)*
- R9–R15. zh/en behavior rules written verbatim into the managed block *(see origin: R9–R15)*
- R16–R18. Technical identifiers always English; governance is instruction-file-only, no per-skill copies *(see origin: R16–R18)*

## Scope Boundaries

- Does not modify any existing skill or agent Markdown assets
- Does not add project-level `.developer` reading to `resolveDeveloperIdentity` (global fallback is sufficient; project-level lang is always set by a prior init run with CLI `--lang`)
- Does not change the `.developer` format or lifecycle
- Does not support languages beyond `zh` and `en`
- Lang change requires re-running `spec-first init`; no dynamic runtime injection

## Context & Research

### Relevant Code and Patterns

- `src/cli/developer.js` — `resolveDeveloperIdentity(projectRoot, options)` already resolves `lang` with priority `--lang CLI > global ~/.spec-first/.developer > 'zh'`. Returns `{ name, lang, initializedAt, version }`. Callers in `init.js` use `developer.lang` directly.
- `src/cli/commands/init.js` — after `writeDeveloperFile` and `writeState`, calls `adapter.syncRuntimeFiles()`. The new `writeLangPolicy` and `bootstrapChangelog` calls belong after `writeState` and before the console log summary.
- `src/cli/adapters/base.js` — `PlatformAdapter` base class with `syncRuntimeFiles`, `inspectRuntimeFiles`, `removeRuntimeFiles` extension points. `instructionFile` getter does not yet exist.
- `src/cli/adapters/claude.js` — `ClaudeAdapter`; `runtimeRoot = '.claude'`; `developerFile = '.claude/spec-first/.developer'`
- `src/cli/adapters/codex.js` — `CodexAdapter`; `runtimeRoot = '.codex'`; `developerFile = '.codex/spec-first/.developer'`; no instructionFile
- `tests/smoke/cli.sh` — integration test that runs `spec-first init --claude` / `--codex` in a tmpdir and asserts on generated files. New assertions for `CLAUDE.md` and `AGENTS.md` go here.
- `tests/unit/mcp-setup.sh` — unit test pattern: isolated tmpdir, bash assert helpers, inline assertions. New `tests/unit/lang-policy.sh` should follow this pattern.

### Institutional Learnings

- `docs/solutions/developer-experience/bash-portability-pitfalls-2026-04-01.md` — bash portability issues (stat flags, array expansion). Tests must use `stat -f` (macOS) with `stat -c` fallback, avoid `IFS` side-effects.

### External References

- None required — patterns are well-established in the existing codebase.

## Key Technical Decisions

- **`instructionFile` getter on adapter, not hardcoded in lang-policy.js**: Keeps the adapter as the single source of truth for platform-specific paths. `lang-policy.js` calls `adapter.instructionFile` rather than switching on `adapter.id`. *(see origin: Key Decisions — "平台各写各的指令文件")*
- **Managed block via HTML comment markers**: `<!-- spec-first:lang:start -->` / `<!-- spec-first:lang:end -->` are invisible in rendered Markdown, survive user edits to other sections, and are easy to locate with a string scan. *(see origin: R5)*
- **Separate `lang-policy.js` module, not a method on the adapter**: Writing Markdown governance content is a cross-cutting concern, not a platform-specific transform. Adapter only exposes `instructionFile`; the writing logic stays in a standalone module.
- **`bootstrapChangelog` never overwrites**: R7 is explicit — CHANGELOG.md is user-owned once created. The bootstrap call is a no-op if the file exists. *(see origin: R7)*
- **Both lang policy block and changelog iron law in the same managed section**: Reduces the number of managed sections and keeps all spec-first-owned instructions in one visible block. Governance rule (R6) is authored in the same write pass as the lang rule.
- **`developer.lang` used directly from `resolveDeveloperIdentity` output**: Avoids reading `.developer` a second time. The resolved value already reflects CLI > global > default chain. *(see origin: R2a)*

## Open Questions

### Resolved During Planning

- **Should `CLAUDE.md` also be written during `--codex` init (and vice versa)?** No. `--claude` writes `CLAUDE.md`, `--codex` writes `AGENTS.md`. No cross-platform sync. *(see origin: Resolved — "Claude 兼容层")*
- **What does the CHANGELOG bootstrap entry look like?** Format header (`# Changelog`, format description) + one entry: `- vX.Y.Z YYYY-MM-DD name: Initialize project with spec-first`. *(see origin: Resolved — "CHANGELOG 初始内容")*
- **Should R6 claim system-level enforcement?** No. Rewritten as a prompt-level iron law: AI tools should refuse to generate source-code changes when no matching `CHANGELOG.md` entry exists. *(see origin: Resolved — "changelog 约束表述")*

### Deferred to Implementation

- **Exact wording of the managed block for zh vs en**: The full text of the language policy block is an implementation detail. The plan captures the required behavior (R9–R15), not the exact prose.
- **Whether `resolveDeveloperIdentity` should also read project-level `.developer.lang` as a fallback**: Not required for this feature. The resolved `developer.lang` at init time is sufficient. Defer if a future use case requires it.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
spec-first init --claude --lang zh
  │
  ├─ resolveDeveloperIdentity()  →  { lang: 'zh', name: 'leo', ... }
  ├─ writeDeveloperFile()         [existing — writes .claude/spec-first/.developer]
  ├─ writeState()                 [existing]
  ├─ adapter.syncRuntimeFiles()   [existing — skills, agents, commands]
  │
  ├─ writeLangPolicy(projectRoot, developer, adapter)   [NEW]
  │     adapter.instructionFile  →  'CLAUDE.md'
  │     buildManagedBlock(lang)  →  policy text with lang + changelog iron law
  │     read CLAUDE.md (if exists) → find markers → replace or append
  │     write CLAUDE.md
  │
  └─ bootstrapChangelog(projectRoot, developer)         [NEW]
        if CHANGELOG.md exists → return (no-op)
        build header + versioned bootstrap entry
        write CHANGELOG.md
```

**Idempotent write logic (used in writeLangPolicy):**

```
content = read file (or '')
START = '<!-- spec-first:lang:start -->'
END   = '<!-- spec-first:lang:end -->'

if START in content:
    replace everything from START to END (inclusive) with new block
else:
    append '\n\n' + new block to content

write result back to file
```

## Implementation Units

---

- [ ] **Unit 1: Add `instructionFile` getter to adapter contracts**

**Goal:** Establish the adapter contract for the platform-specific instruction file path. Keeps lang-policy.js decoupled from platform identity checks.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/cli/adapters/base.js`
- Modify: `src/cli/adapters/claude.js`
- Modify: `src/cli/adapters/codex.js`

**Approach:**
- Add `get instructionFile()` to `PlatformAdapter` base that throws `'Not implemented: instructionFile'`
- `ClaudeAdapter.instructionFile` returns `'CLAUDE.md'`
- `CodexAdapter.instructionFile` returns `'AGENTS.md'`

**Patterns to follow:**
- Existing `developerFile`, `stateFile`, `skillsRoot` getters in `src/cli/adapters/base.js`

**Test scenarios:**
- Happy path: `claudeAdapter.instructionFile === 'CLAUDE.md'`
- Happy path: `codexAdapter.instructionFile === 'AGENTS.md'`

**Verification:**
- Both adapters return distinct non-empty strings from `instructionFile`

---

- [ ] **Unit 2: Implement `src/cli/lang-policy.js`**

**Goal:** Idempotent write of the managed language and governance policy block into the repo-root instruction file.

**Requirements:** R3, R4, R5, R6, R9–R18

**Dependencies:** Unit 1 (adapter `instructionFile`)

**Files:**
- Create: `src/cli/lang-policy.js`
- Create: `tests/unit/lang-policy.sh`

**Approach:**
- `writeLangPolicy(projectRoot, developer, adapter)`: resolves `filePath = path.join(projectRoot, adapter.instructionFile)`, builds the managed block via `buildManagedBlock(developer.lang)`, applies the idempotent write, prints a one-line summary to stdout
- `buildManagedBlock(lang)`: returns the full `<!-- spec-first:lang:start -->` ... `<!-- spec-first:lang:end -->` block. Content must cover: language directive (R9–R15), technical identifier rule (R16), changelog iron law (R6, prompt-level)
- Idempotent write: scan existing file content for `<!-- spec-first:lang:start -->`. If found, replace from START marker through END marker (inclusive). If not found, append `\n\n<block>` to existing content. If file does not exist, create it with just the block.

**Patterns to follow:**
- Atomic write pattern from `install-coordinator.sh`: write to a temp file in the same directory, then rename; avoids partial writes. Use `fs.writeFileSync` with a `.tmp` suffix and `fs.renameSync`.
- `writeDeveloperFile` in `src/cli/developer.js` for `fs.mkdirSync` + `fs.writeFileSync` sequencing.

**Test scenarios:**
- Happy path — file absent: `writeLangPolicy` creates `CLAUDE.md` with the managed block between markers
- Happy path — file absent, codex: creates `AGENTS.md` with the managed block
- Happy path — file exists, no markers: appends managed block to end of existing content; original content preserved
- Happy path — file exists with markers (zh): re-run with `lang=en` replaces block content; markers remain; user content outside block preserved
- Edge case — file exists with markers (same lang): running again produces identical content (idempotent, no duplicate accumulation)
- Edge case — file exists, markers present but `END` missing (corrupted): implementation should append a new block after the last line rather than corrupting the file; or treat as "no markers" and append
- Edge case — `projectRoot` does not exist: should fail with a clear error, not create nested dirs
- Integration — zh block must contain Chinese language directive; en block must contain English language directive

**Verification:**
- All unit tests in `tests/unit/lang-policy.sh` pass
- `CLAUDE.md` written by `--claude` init contains both START and END markers
- Running init twice produces identical `CLAUDE.md` (no duplicate block)
- User content written before the block is preserved after re-init

---

- [ ] **Unit 3: Implement `src/cli/changelog.js`**

**Goal:** Bootstrap `CHANGELOG.md` with a format header and initial entry when the file does not exist.

**Requirements:** R7, R8

**Dependencies:** None (independent of Units 1–2)

**Files:**
- Create: `src/cli/changelog.js`
- Test: `tests/unit/lang-policy.sh` (extend existing test file)

**Approach:**
- `bootstrapChangelog(projectRoot, developer)`: if `CHANGELOG.md` exists at `projectRoot`, return immediately (no-op). Otherwise create the file with:
  1. `# Changelog` heading and a one-line format description
  2. Format reference: `Entry format: - vX.Y.Z YYYY-MM-DD author: summary [(user-visible)]`
  3. One bootstrap entry: `- v<developer.version> <today> <developer.name>: Initialize project with spec-first`
- `today` = `new Date().toISOString().slice(0, 10)` (YYYY-MM-DD)

**Patterns to follow:**
- `formatDeveloperContents` in `src/cli/developer.js` for template string assembly

**Test scenarios:**
- Happy path — file absent: `bootstrapChangelog` creates `CHANGELOG.md` with header and one versioned entry containing developer name and version
- Happy path — file exists: calling `bootstrapChangelog` again leaves file content unchanged (no-op)
- Edge case — `developer.name` or `developer.version` is empty string: entry is created with empty field, function does not throw

**Verification:**
- Created `CHANGELOG.md` is valid Markdown (no broken syntax)
- One versioned entry line is present when file was absent before the call
- File content identical before and after second call when file already exists

---

- [ ] **Unit 4: Wire `writeLangPolicy` and `bootstrapChangelog` into `init.js`**

**Goal:** Call the two new functions from `init.js` at the correct point in the init flow, add console output, and handle errors gracefully.

**Requirements:** R3, R4, R7 (invocation wiring)

**Dependencies:** Units 1, 2, 3

**Files:**
- Modify: `src/cli/commands/init.js`

**Approach:**
- Import `writeLangPolicy` from `'../lang-policy'` and `bootstrapChangelog` from `'../changelog'`
- After `writeState(...)` and before the console log summary, add:
  ```
  writeLangPolicy(projectRoot, developer, adapter)
  bootstrapChangelog(projectRoot, developer)
  ```
- Add two console log lines to the existing output block:
  - `📋 Wrote language policy to <adapter.instructionFile>`
  - `📝 Bootstrapped CHANGELOG.md` (only if file was just created; skip if it already existed)
- Do not change existing console log lines or their order

**Patterns to follow:**
- Existing `writeDeveloperFile` / `writeState` call sequence in `init.js`
- Existing emoji-prefixed console log lines for consistency

**Test scenarios:**
- Integration: after `spec-first init --claude`, `CLAUDE.md` exists in projectRoot with lang block
- Integration: after `spec-first init --codex`, `AGENTS.md` exists in projectRoot with lang block
- Integration: running init twice does not duplicate the lang block

**Verification:**
- `spec-first init --claude` exits 0 and prints the `CLAUDE.md` line
- `spec-first init --codex` exits 0 and prints the `AGENTS.md` line
- No regression in existing smoke test assertions

---

- [ ] **Unit 5: Smoke test coverage**

**Goal:** Assert in the existing smoke test suite that CLAUDE.md / AGENTS.md are written correctly, lang block updates on re-init, and CHANGELOG.md is bootstrapped.

**Requirements:** R3, R4, R5, R7 (observable outcomes)

**Dependencies:** Units 1–4

**Files:**
- Modify: `tests/smoke/cli.sh`

**Approach:**
Add assertions in the existing `--claude` init section (after step 2c):

```bash
# Claude init produces CLAUDE.md with lang block
grep -q '<!-- spec-first:lang:start -->' "$TMP_DIR/CLAUDE.md"
grep -q '<!-- spec-first:lang:end -->' "$TMP_DIR/CLAUDE.md"
# Re-init with different lang updates block (no duplicate markers)
node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang en >/dev/null
marker_count=$(grep -c '<!-- spec-first:lang:start -->' "$TMP_DIR/CLAUDE.md")
[ "$marker_count" = "1" ]
grep -q 'English' "$TMP_DIR/CLAUDE.md"
# CHANGELOG.md created
test -f "$TMP_DIR/CHANGELOG.md"
grep -q 'Entry format: `- vX.Y.Z YYYY-MM-DD author: summary \[(user-visible)\]`' "$TMP_DIR/CHANGELOG.md"
grep -q -- '- v1.4.0 ' "$TMP_DIR/CHANGELOG.md"
```

Add parallel assertions in the Codex init section:

```bash
grep -q '<!-- spec-first:lang:start -->' "$TMP_DIR/AGENTS.md"
grep -q '<!-- spec-first:lang:end -->' "$TMP_DIR/AGENTS.md"
```

**Test scenarios:**
- Happy path: `CLAUDE.md` has exactly one START marker after two inits
- Happy path: `CLAUDE.md` content reflects `lang=en` after second init with `--lang en`
- Happy path: `AGENTS.md` has lang markers after `--codex` init
- Happy path: `CHANGELOG.md` present after init, contains the versioned entry format and bootstrap entry

**Verification:**
- `bash tests/smoke/cli.sh` passes end-to-end with no regressions

---

## System-Wide Impact

- **Interaction graph:** Only `init.js` is the caller. `doctor` and `clean` commands are not affected in this plan — they do not read or remove `CLAUDE.md` / `AGENTS.md`.
- **Error propagation:** If `writeLangPolicy` throws (e.g., permission error on `CLAUDE.md`), the error propagates out of `runInit` and the process exits non-zero. This is acceptable; the user's working directory is not corrupted.
- **Unchanged invariants:** The `.developer` file format, `state.json` format, skill/agent Markdown assets, and all existing CLI flags remain unchanged.
- **API surface parity:** `CLAUDE.md` and `AGENTS.md` are written only during `init`. No other command reads or updates them in this plan.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| User has a hand-written `CLAUDE.md` with content the block might visually break | Managed block is appended at end, or replaces only the marked section; user content outside markers is never touched |
| Corrupted marker state (START without END, or vice versa) | Treat as "no markers found" and append a fresh block; document this edge case in unit tests |
| `fs.renameSync` fails on cross-device tmp (unlikely for same-dir write) | Write tmp file in same directory as target; same pattern used by `install-coordinator.sh` |
| Smoke tests run in CI where `lang=en` assertion on block text is fragile if wording changes | Smoke tests check markers only; unit tests check content; wording changes only break unit tests |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-01-runtime-language-governance-requirements.md](docs/brainstorms/2026-04-01-runtime-language-governance-requirements.md)
- Related code: `src/cli/developer.js` — `resolveDeveloperIdentity`, `writeDeveloperFile`
- Related code: `src/cli/adapters/base.js` — `PlatformAdapter` extension point pattern
- Related code: `src/cli/commands/init.js` — invocation context and console log style
- Related code: `tests/smoke/cli.sh` — integration test pattern
- Related code: `tests/unit/mcp-setup.sh` — unit test bash helper pattern
- Institutional learning: `docs/solutions/developer-experience/bash-portability-pitfalls-2026-04-01.md` — bash portability in tests
