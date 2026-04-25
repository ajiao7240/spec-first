---
name: spec-update
description: |
  Check whether spec-first is up to date and whether the current host runtime
  assets need refreshing. Use when the user says "update spec-first",
  "check spec-first version", "spec-first update", "is spec-first up to date",
  "update spec-first plugin", or reports issues that might stem from stale
  spec-first plugin, CLI, or generated runtime assets. Supports Claude Code and
  Codex with host-specific update commands.
disable-model-invocation: true
---

# Check Spec-First Version And Runtime Assets

Verify the installed spec-first version and recommend the host-appropriate
update command when it is stale. Also check whether generated runtime assets
should be refreshed for the active host.

## Host model

- **Claude Code** installs spec-first as a Claude plugin. Version checks use the
  Claude plugin cache path and update via `claude plugin update`.
- **Codex** uses the `spec-first` npm CLI to generate runtime assets into the
  current project. Version checks use the installed CLI and npm registry, then
  refresh runtime assets with `spec-first init --codex`.

Do not use Claude plugin cache paths to decide Codex state. Do not use npm CLI
version facts to decide Claude marketplace cache state.

## Claude Code Pre-Resolved Context

In Claude Code, the sections below are pre-populated. Use them directly; do not
re-run them unless the output is missing or clearly malformed.

`${CLAUDE_SKILL_DIR}` is a Claude Code-documented substitution that resolves
at skill-load time. For a marketplace-cached install it looks like
`~/.claude/plugins/cache/<marketplace>/spec-first/<version>/skills/spec-update`,
so the currently-loaded version is the basename two `dirname` levels up.

The upstream version comes from `plugins/spec-first/.claude-plugin/plugin.json`
on `main` rather than the latest GitHub release tag, because the marketplace
installs plugin contents from `main` HEAD. Comparing against release tags
false-positives whenever `main` is ahead of the last tag (the normal state
between releases).

**Skill directory:**
!`echo "${CLAUDE_SKILL_DIR}"`

**Latest upstream version:**
!`version=$(gh api repos/sunrain520/spec-first/contents/plugins/spec-first/.claude-plugin/plugin.json --jq '.content | @base64d | fromjson | .version' 2>/dev/null) && [ -n "$version" ] && echo "$version" || echo '__SPEC_UPDATE_VERSION_FAILED__'`

**Currently loaded version:**
!`case "${CLAUDE_SKILL_DIR}" in */plugins/cache/*/spec-first/*/skills/spec-update) basename "$(dirname "$(dirname "${CLAUDE_SKILL_DIR}")")" ;; *) echo '__SPEC_UPDATE_NOT_MARKETPLASPEC__' ;; esac`

**Marketplace name:**
!`case "${CLAUDE_SKILL_DIR}" in */plugins/cache/*/spec-first/*/skills/spec-update) basename "$(dirname "$(dirname "$(dirname "$(dirname "${CLAUDE_SKILL_DIR}")")")")" ;; *) echo '__SPEC_UPDATE_NOT_MARKETPLASPEC__' ;; esac`

## Decision Logic

### 1. Detect the active host

Use the first matching signal:

1. If **Skill directory** is populated and looks like a Claude Code skill path,
   use the Claude Code branch.
2. If running in Codex, or if the user invoked `$spec-update`, use the Codex
   branch.
3. If the host is ambiguous, inspect the project:
   - `.codex/spec-first/state.json` or `.agents/skills/spec-update/SKILL.md`
     indicates Codex runtime.
   - `.claude/spec-first/state.json` or `.claude/commands/spec/update.md`
     indicates Claude runtime.
4. If both runtimes exist and the user did not specify one, report both host
   checks separately.

### 2. Claude Code branch

If **Latest upstream version** contains `__SPEC_UPDATE_VERSION_FAILED__`: tell
the user the upstream version could not be fetched (gh may be unavailable or
rate-limited) and stop.

If **Currently loaded version** contains `__SPEC_UPDATE_NOT_MARKETPLASPEC__`: this
session loaded the skill from outside the standard marketplace cache (typical
when using `claude --plugin-dir` for local development, or for a non-standard
install). Tell the user (substituting the actual path):

> "Skill is loaded from `{skill-directory}` — not the standard marketplace
> cache at `~/.claude/plugins/cache/`. This is normal when using
> `claude --plugin-dir` for local development. No action for this session.
> Your marketplace install (if any) is unaffected — run `/spec:update` in a
> regular Claude Code session (no `--plugin-dir`) to check that cache."

Then stop.

### 3. Compare versions

**Up to date** — `{currently loaded} == {latest upstream}`:

> "spec-first **v{version}** is installed and up to date."

**Out of date** — `{currently loaded} != {latest upstream}`:

> "spec-first is on **v{currently loaded}** but **v{latest upstream}** is available.
>
> Update with:
> ```
> claude plugin update spec-first@{marketplace-name}
> ```
> Then restart Claude Code to apply."

The `claude plugin update` command ships with Claude Code itself and updates
installed plugins to their latest version; it replaces earlier manual cache
sweep / marketplace-refresh workarounds. The marketplace name is derived from
the skill path rather than hardcoded because this plugin is distributed under
multiple marketplace names (for example, `spec-first` for
public installs per the README, or other names for internal/team marketplaces).

After any successful plugin update, tell the user to restart Claude Code, then
run:

```bash
spec-first init --claude
```

from the target project if generated runtime assets still look stale.

### 3. Codex branch

Gather these facts from the current project shell:

```bash
spec-first --version
```

Parse the current CLI version from the `Spec-First vX.Y.Z` line. If the command
is unavailable, tell the user `spec-first` is not installed or not on `PATH`,
then recommend:

```bash
npm install -g spec-first@latest
```

Next fetch the latest npm version:

```bash
npm view spec-first version --silent
```

If npm lookup fails because the network or registry is unavailable, continue
with the runtime asset check and state that the latest npm version could not be
verified.

Then check Codex runtime asset health in the current project:

```bash
spec-first doctor --codex --json
```

If the command reports that no spec-first Codex runtime is initialized, recommend
initializing it:

```bash
spec-first init --codex
```

If the CLI is older than npm latest, tell the user:

> "spec-first CLI is on **v{current}** but **v{latest}** is available.
>
> Update with:
> ```bash
> npm install -g spec-first@latest
> ```
> Then refresh Codex runtime assets in this project:
> ```bash
> spec-first init --codex
> ```
> Restart Codex so `$spec-*` entries reload."

If the CLI is current but `doctor --codex --json` reports stale or missing
runtime assets, tell the user:

> "spec-first CLI is current, but Codex runtime assets need refresh.
>
> Refresh with:
> ```bash
> spec-first init --codex
> ```
> Then restart Codex so `$spec-*` entries reload."

If both the CLI and runtime assets are current, tell the user:

> "spec-first CLI **v{version}** is installed and Codex runtime assets are up to
> date."

## Output Rules

- State which host branch was checked: Claude Code, Codex, or both.
- Separate version status from runtime asset status.
- Give one concrete next command when action is needed.
- Do not recommend `claude plugin update` in Codex.
- Do not recommend `npm install -g spec-first@latest` as the Claude plugin cache
  update path.
