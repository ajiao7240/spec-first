---
title: "feat: Add npm version reminder on real command startup"
type: feat
status: active
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-npm-version-reminder-requirements.md
---

# feat: npm Version Reminder

## Overview

`spec-first` currently prints its installed version and install-time guidance, but it does not tell already-installed users when a newer npm release exists. This plan adds a small, best-effort update reminder on real command startup so users can discover upgrades without changing how the CLI behaves.

## Problem Frame

See origin doc: `docs/brainstorms/2026-04-01-npm-version-reminder-requirements.md`

Users who keep an older `spec-first` install will not naturally see that a newer package version exists. The right fix is not auto-update or hard failure. The right fix is a lightweight reminder that appears only when the CLI is actually doing work.

## Requirements Trace

- R1. Real CLI commands must check the installed version against the latest npm release *(see origin: R1)*
- R2. `--help` and `--version` must stay quiet *(see origin: R2)*
- R3. Version lookup must never block the command path beyond a short best-effort budget, and failures must not stop the command *(see origin: R3, R6)*
- R4. When outdated, the CLI must show the current and latest versions plus a concise upgrade hint *(see origin: R4)*
- R5. The reminder should appear on every real command invocation while the install is still outdated *(see origin: R5)*
- R6. Registry/network failures must be silent and non-fatal *(see origin: R6)*
- R7. The reminder applies to the real command entry points at least `init`, `doctor`, and `clean` *(see origin: R7)*
- R8. No automatic upgrade, install, or forced exit is introduced *(see origin: R8)*

## Scope Boundaries

- Does not add auto-update or one-click upgrade behavior
- Does not show reminders on help/version output
- Does not add long-lived cache state or user-level cooldown logic
- Does not change the semantics of `init`, `doctor`, or `clean`

## Context & Research

### Relevant Code and Patterns

- `src/cli/index.js` is the central command dispatcher. It already separates `--help`, `--version`, `doctor`, `init`, and `clean`, so it is the correct gate for a real-command-only reminder.
- `src/cli/commands/init.js` and `src/cli/commands/doctor.js` are representative real commands that should trigger the reminder.
- `src/cli/commands/clean.js` is the other real command path covered by the origin doc and should be included in the allowlist.
- `src/cli/commands/doctor.js` already uses non-fatal status output patterns. The reminder should follow the same philosophy, but it should be informational rather than diagnostic.
- `package.json` already contains the package `name` and current `version`; that should remain the source of truth for the local install version.
- `tests/smoke/cli.sh` already verifies CLI help/version and the main command flows. It is the best place to assert the user-visible reminder behavior.

### Institutional Learnings

- No repository learning directly covers update reminders. The main constraint is to keep bash-based smoke tests portable and avoid adding flaky network dependence.

### External References

- None required. The local CLI patterns are enough for this change.

## Key Technical Decisions

- **Centralize reminder logic in a small helper module**: keep version lookup and message formatting out of `src/cli/index.js` so the dispatcher stays simple.
- **Use a best-effort lookup with a short timeout budget**: the reminder is useful only if it does not get in the way. If the registry lookup does not finish quickly, skip it and continue.
- **Print the reminder to stderr**: this keeps stdout stable for scripts and existing tests while still making the reminder visible to users.
- **Use `package.json` as the local version source**: do not hardcode the current version or package name.
- **Avoid a new semver dependency**: add a tiny local comparator for normal npm version strings instead of growing the dependency surface.
- **Include a concrete upgrade hint**: the reminder should include a concise example such as `npm install -g spec-first@latest`.
- **Keep failures silent**: if npm is unavailable, the registry is unreachable, or the lookup times out, the CLI should proceed exactly as before.

## High-Level Technical Design

> Directional guidance only. The implementer should follow the shape below, not copy it verbatim.

```
runCli(argv)
  ├─ parse command
  ├─ if help/version -> existing path, no reminder
  ├─ if real command -> maybeShowVersionReminder()
  │    ├─ read package name/version from package.json
  │    ├─ resolve latest npm release with a short timeout budget
  │    ├─ compare current vs latest
  │    └─ if outdated, print one concise stderr reminder
  └─ dispatch init/doctor/clean as today
```

The reminder helper should be written so that tests can stub the registry lookup. That keeps unit tests offline and lets smoke tests pin an outdated/latest scenario without touching the public registry.

## Implementation Units

- [ ] **Unit 1: Add a reusable version reminder helper**

  **Goal:** Encapsulate latest-version lookup, comparison, and notice formatting in one place so the dispatcher stays small.

  **Requirements:** R1, R3, R4, R5, R6, R8

  **Dependencies:** None

  **Files:**
  - Create: `src/cli/version-reminder.js`
  - Create: `tests/unit/version-reminder.sh`

  **Approach:**
  - Export a small helper that accepts the current package name/version and a lookup function for the latest npm version.
  - Keep the public surface narrow: one function for deciding whether to notify and one function for formatting the reminder text.
  - Make the lookup path best-effort with a short timeout budget and silent fallback on error.
  - Compare normal npm semver strings locally instead of introducing a new dependency.
  - Emit reminder text in a single concise block that includes the current version, the latest version, and a simple upgrade hint.

  **Patterns to follow:**
  - `src/cli/commands/doctor.js` for concise non-fatal CLI messaging
  - `tests/unit/mcp-setup.sh` for shell-first unit-test style and explicit assertions

  **Test scenarios:**
  - Happy path: current version equals latest version, so no reminder text is produced
  - Happy path: current version is older, so the formatted reminder contains both versions and the upgrade hint
  - Edge case: lookup fails or times out, and the helper returns a silent no-op rather than an error
  - Edge case: malformed version input does not crash the helper and does not emit a false reminder

  **Verification:**
  - `tests/unit/version-reminder.sh` passes without network access
  - The helper produces stable, human-readable output for the outdated case

- [ ] **Unit 2: Wire the reminder into the real command dispatch path**

  **Goal:** Trigger the version reminder only for real commands, not for help/version output.

  **Requirements:** R1, R2, R3, R7, R8

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `src/cli/index.js`

  **Approach:**
  - Keep `--help` and `--version` on their existing fast path.
  - Add an allowlist for real commands: `doctor`, `init`, and `clean`.
  - Call the reminder helper before dispatching those commands.
  - Route reminder output to stderr and preserve the existing stdout behavior of each command.
  - Do not touch the command implementations themselves unless the wire-up exposes a concrete need later.

  **Patterns to follow:**
  - The current command split in `src/cli/index.js`
  - The existing `runCli` contract, which already returns a resolved exit code for each branch

  **Test scenarios:**
  - Happy path: `--help` does not trigger the reminder
  - Happy path: `--version` does not trigger the reminder
  - Happy path: `init`, `doctor`, and `clean` each trigger the reminder path
  - Edge case: unknown commands stay unchanged and do not accidentally invoke the reminder
  - Edge case: reminder lookup failure does not change the command exit code

  **Verification:**
  - Existing CLI behavior remains intact for help/version output
  - Real commands still complete successfully even when the reminder is skipped

- [ ] **Unit 3: Extend CLI smoke coverage for reminder visibility and fallback behavior**

  **Goal:** Prove the reminder shows up for real commands and stays out of help/version output.

  **Requirements:** R1, R2, R4, R5, R6, R7

  **Dependencies:** Unit 1 and Unit 2

  **Files:**
  - Modify: `tests/smoke/cli.sh`

  **Approach:**
  - Extend the existing CLI smoke test instead of creating a parallel harness.
  - Capture stderr for real commands so the reminder can be asserted without disturbing stdout expectations.
  - Use a test seam or injected lookup override so the smoke test does not hit the public npm registry.
  - Keep the existing help/version and init/doctor assertions, and add reminder-specific checks beside them.

  **Patterns to follow:**
  - The current structure of `tests/smoke/cli.sh`, which already covers help/version plus real command flows
  - The repository’s bash-first assertion style

  **Test scenarios:**
  - Happy path: a real command on an outdated version prints the reminder to stderr
  - Happy path: help/version output remains clean and does not include the reminder
  - Edge case: a simulated registry failure does not break `doctor`, `init`, or `clean`
  - Edge case: if the install is already current, the smoke test sees no reminder

  **Verification:**
  - `npm run test:smoke` still passes with the new reminder assertions
  - The smoke suite does not depend on external network availability

## Open Questions

### Resolved During Planning

- **Reminder timing**: use a short best-effort lookup budget before dispatching real commands, then silently skip if the registry is slow or unavailable.
- **Upgrade hint wording**: include a concise npm upgrade example in the reminder instead of leaving the user to infer the next step.

### Deferred to Implementation

- **Exact timeout value**: the implementation should pick a small budget that is fast enough to feel non-blocking, then keep it consistent across tests.

## Next Steps

→ `/spec:work` for implementation
