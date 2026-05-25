---
name: spec-mcp-setup
description: Install, configure, and verify the required harness runtime for spec-first workflows on Claude Code or Codex.
argument-hint: ""
---

# Required Harness Runtime Setup

**Claude entry point:** `/spec:mcp-setup`
**Codex entry point:** `$spec-mcp-setup`

This workflow is the single setup entrypoint for spec-first. It has two distinct layers:

- Project Preflight / Local Setup: required developer helpers, project-local config bootstrap, and legacy Compound Engineering residue guidance.
- Required Harness Runtime: required MCP servers, required graph providers, required baseline helper tools, browser automation helper capability, readiness ledger v2, and graph provider projection.

Project-local config and legacy residue facts do not affect `baseline_ready`. Required helper facts affect `baseline_ready` when their `baseline_blocking` fact is not explicitly `false`. `agent-browser` is a browser automation helper capability: setup reports it in `helper_tools`, but missing/skipped/degraded `agent-browser` facts are non-baseline-blocking. This workflow does not expose selectable MCP registry entries, legacy pending states, or a browser MCP server.

GitNexus `query_probe` must target the GitNexus indexed repo label, not blindly the directory basename. `write-provider-config.*` resolves the label deterministically from explicit setup facts when present, then from `.gitnexus/meta.json` `remoteUrl` basename, then from git remote URL basename, and only falls back to the repo directory basename. Its probe token policy should write a bounded, ordered `candidates[]` list of at most 5 source-derived candidates while preserving legacy `token` / `selected_from` fields for compatibility. Candidate ordering is cross-stack: prefer entry/workflow basenames likely to participate in flows, such as main/launch/loading/home/login/router/navigation files, controllers, handlers, services, repositories, forms, tables, pages, dashboards, and Android Activity/ViewModel classes. For controller-heavy repos where class basenames often return definitions-only, setup may extract bounded method-level source tokens from tracked workflow files and prefer flow-like method names such as step/save/add/delete/submit/validate/failure/options before controller class names. Android names are one platform signal, not the default universal front door. Low-signal lifecycle, config, type, schema, constants, display-only, advertisement/guide/dialog/adapter/bean/entity basenames should be demoted until no better source candidate exists.

## Workflow Contract Summary

### When To Use

Use to install, verify, repair, or diagnose spec-first's required Claude Code or Codex harness runtime, helper tools, MCP servers, and setup-owned provider projections.

### When Not To Use

Do not use to compile graph readiness, make product or architecture decisions, review code/docs, update generated runtime assets as source fixes, or run provider analyze/build commands.

### Inputs

Current host, working directory, `skills/spec-mcp-setup/mcp-tools.json`, host config paths, git/workspace target facts, optional repo flags, and setup environment variables.

### Outputs

Readiness ledger facts, setup-owned config/projection artifacts, helper/tool status, grouped user-facing next actions, and handoff guidance to graph bootstrap or the user-intent workflow.

### Artifacts

Host readiness ledger v2, `.spec-first/config/*.json`, parent workspace advisory summaries, and managed `.gitignore` entries when explicitly bootstrapped.

### Failure Modes

Missing dependency, invalid workspace target, host config precedence block, warmup/configure failure, skipped non-git repo, or credential/permission failure.

### Workflow

Resolve target scope, check dependencies, configure required helpers/MCP projections, write setup-owned readiness facts, then report status and next action.

### Downstream Consumers

`spec-graph-bootstrap`, `using-spec-first`, downstream workflows reading readiness facts, and humans repairing host setup.

## Purpose

Prepare a verified, repeatable spec-first harness runtime for Claude Code or Codex without turning setup into a semantic decision engine.

The workflow should leave deterministic facts behind for downstream workflows: host MCP config status, helper tool status, project-local setup facts, graph-provider projections, readiness ledger v2, and explicit next actions. Scripts own detection, installation, config writing, and JSON facts; the LLM owns host routing, failure interpretation, and workflow handoff judgment.

## Graph Refresh Boundary

`spec-mcp-setup` owns setup projection, not graph readiness refresh. It may refresh `.spec-first/config/graph-providers.json`, `.spec-first/config/runtime-capabilities.json`, `.spec-first/config/provider-artifacts.json`, and ledger facts; it must not write canonical `.spec-first/graph/*`, `.spec-first/providers/*`, or `.spec-first/impact/*` graph readiness artifacts as a provider refresh.

When setup detects stale provider projection, stale package/version pins, provider fingerprint mismatch, or graph readiness still pending, it should mark graph bootstrap required and hand off to `$spec-graph-bootstrap` / `/spec:graph-bootstrap`. It does not run GitNexus analyze/status/query/build/index refresh, provider repair, group sync, or branch/pull/rebase-triggered refresh on behalf of downstream workflows.

Setup may write GitNexus `native_capabilities` and `gitnexus_capability_discovery` as setup-inferred availability/discovery facts. These facts are not task-level query results, not semantic evidence, and not proof of `query_ready=true`; downstream LLM workflows still decide whether a capability fits the current question and verify critical claims with canonical readiness, live MCP tool/resource evidence, direct source reads, tests, ast-grep, prior GitNexus evidence, or bounded per-repo fallback. Public `source_tags[]` use the GitNexus catalog vocabulary (`checked-in-baseline`, `provider-pin`, `setup-projection`, live MCP tags, session-local inference, and user decision); setup does not write live MCP tags because it does not call tools or resources.

## When To Use

Use this workflow when the user asks to install, repair, verify, or diagnose spec-first's required runtime surface:

- first-time spec-first setup on Claude Code or Codex;
- missing or stale required MCP servers;
- missing baseline helper tools such as `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`, or `ast-grep`, or browser automation helper issues with `agent-browser`;
- parent workspace setup across child Git repos;
- readiness ledger, graph-provider projection, or setup-owned `.spec-first/config/*.json` repair.

## When Not To Use

Do not use this workflow to:

- compile graph readiness itself; hand off to `spec-graph-bootstrap` after setup facts are ready;
- run GitNexus analyze/status/query/build/index refresh provider commands;
- choose product requirements, implementation plans, review findings, or architecture tradeoffs;
- install retired CRG host MCP snippets or provider commands;
- delete legacy local files or user-authored host config sections outside explicit uninstall/delete commands;
- patch generated runtime mirrors under `.claude/`, `.codex/`, or `.agents/skills/`.

## Inputs

Primary inputs are the current host, current working directory, `skills/spec-mcp-setup/mcp-tools.json`, host config files, project git state, and optional user-supplied target arguments:

- `--repo <child>` / `-Repo <child>` to select one child repo from a parent workspace;
- `--all-repos` / `-AllRepos` to explicitly process every child repo from a parent workspace;
- host override env vars such as `MCP_SETUP_HOST`, `MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE`, and `MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE` for deterministic tests or unusual host layouts.

## Workflow

1. Resolve the project target with `resolve-project-target.*`; in a parent workspace, default to all child repos and keep parent writes advisory-only.
2. Run project preflight with `check-health`; bootstrap project-local config only through `bootstrap-project-config.*` with explicit bounded flags.
3. Run dependency checks with `check-deps.*`; missing installer suggestions must be review-first, current-platform aware, and must not pipe remote scripts directly into an interpreter. Linux/WSL suggestions should prefer the package manager actually available on the host.
4. Install or verify required helper tooling with `install-helpers.*`; `--verify-only` remains read-only.
5. Warm required MCP/provider packages and write host MCP config only for tools whose registry entry requires host config.
6. Write readiness ledger v2 with `verify-tools.*` and setup-owned project facts with `write-provider-config.*`.
7. Report the full grouped status and hand off to `spec-graph-bootstrap` when graph readiness is still pending, or to the user-intent workflow when graph readiness is already ready.

## Outputs

Setup may write these deterministic artifacts:

- host readiness ledger v2 at the host marker path reported by `detect-host.*`;
- child-local `.spec-first/config/graph-providers.json`;
- child-local `.spec-first/config/runtime-capabilities.json`;
- child-local `.spec-first/config/provider-artifacts.json`;
- project-local `.spec-first/config.local.example.yaml`, `.spec-first/config.local.yaml`, and `.gitignore` entries when explicitly bootstrapped;
- parent advisory summaries under `.spec-first/workspace/` when running all-repos modes.
- `host_pointer_reconciliation` advisory event in the readiness ledger v2 when host marker drift is detected. The event records `from_host` / `to_host` / `from_marker_path` / `to_marker_path` / `reconciled_at` so downstream workflows can audit cross-host setup runs without taking action; the original host's marker file is left intact.

The assistant's final response must restate readiness from ledger v2 instead of relying only on command output.

## Failure Modes

- `missing_dependency`: a required package manager, runtime, or CLI dependency is missing; report the install suggestion and stop before pretending setup succeeded.
- `workspace-target-required` / `repo-target-*`: repo-local writes are blocked until a valid child Git repo is selected or all-repos mode is used.
- `precedence-blocked`: a higher-precedence Codex config contains a mismatched MCP section; report the blocking path instead of overwriting it.
- `configure_failed` / `warmup_failed`: capture stage, exit code, bounded diagnostic summary, and next action.
- `skipped-no-git-repo`: provider projections are not written outside a Git repo.
- Permission or credential failures should record the failed stage and next action; do not invent destructive escalation or silently patch generated runtime mirrors.

## Runtime Baseline

`skills/spec-mcp-setup/mcp-tools.json` is the only machine registry for MCP servers and graph providers. Schema version is `6`. Package/version specs for every MCP and graph-provider command are sourced from this file; tools that declare top-level `package` + `version` fields must expand `{{package}}` / `{{version}}` templates through the shared template helpers before warmup, host config, detection, or provider projection. The GitNexus `provider_config.native_capabilities` object is a checked-in baseline: it defines meaning, candidate `native_tools[]`, candidate read-only `native_resources[]`, mutation boundary, fallback posture, and baseline source tags. Setup projections such as `.spec-first/config/graph-providers.json` derive from this registry and must not become a second version or capability registry.

Required MCP tools:

- `sequential-thinking`
- `context7`

Required graph providers:

- `gitnexus` with role `global_knowledge` and review-impact evidence support

Graph provider does not always mean host MCP server. `gitnexus` remains a required host MCP server because downstream workflows can use live GitNexus tools for global code knowledge and review-impact evidence. Retired CRG projections or host MCP snippets are migration residue only; setup must not install, warm, or project CRG during normal install/verify.

## GitNexus-Only Upgrade Path

When upgrading a repo that still has `.spec-first/config/graph-providers.json` with a retired `code-review-graph` provider key, run `$spec-mcp-setup` / `/spec:mcp-setup` first. Setup rewrites setup-owned provider projection from the current `mcp-tools.json` registry, so the next `$spec-graph-bootstrap` / `/spec:graph-bootstrap` run sees a GitNexus-only projection. Do not hand-edit `.spec-first/config/graph-providers.json` to bypass `stale-provider-projection`; old host MCP snippets, `.code-review-graph/`, `.spec-first/providers/code-review-graph/**`, and uv cache cleanup are manual maintenance documented in `docs/05-用户手册/19-旧CRG残留手动清理指引.md`.

Required helper tooling outside `mcp-tools.json`:

- `gh`
- `jq`
- `vhs`
- `silicon`
- `ffmpeg`
- `ast-grep`
- global `ast-grep` skill

Browser automation helper capability outside `mcp-tools.json`:

- `agent-browser` CLI + upstream/global skill, installed or repaired only when `SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` is set. Without that explicit demand, setup reports `agent-browser` as `result=skipped`, `baseline_blocking=false`, and records browser demand signals for downstream judgment.

All tools in `mcp-tools.json` must have `required=true` and a `category` of `mcp` or `graph-provider`. MCP tools must have `host_config_required=true`. GitNexus is the only current graph provider entry. Required helper tooling must not be added to `mcp-tools.json`; it is managed by `install-helpers.*` and appears under readiness ledger `helper_tools`.

## What This Workflow Does

1. Runs project preflight with `check-health`.
2. Runs bounded project-local config bootstrap actions when needed.
3. Reports legacy Compound Engineering residue without deleting it automatically.
4. Checks required dependencies.
5. Installs/verifies required helper tooling.
6. Warms every required MCP/provider package and configures only host-MCP-required tools in the host MCP config.
7. Writes readiness ledger v2 to the host marker path.
8. Writes setup-owned project facts inside a git repo: `.spec-first/config/graph-providers.json`, `.spec-first/config/runtime-capabilities.json`, and `.spec-first/config/provider-artifacts.json`.
9. Prints a clear next-step prompt after the final status block: continue graph readiness compilation now when durable readiness refresh is pending; hand off to plan for Plan-stage live GitNexus evidence when the current session already exposes GitNexus MCP surfaces or after a restarted/new session loads newly written MCP config; when graph readiness is already ready, route by user intent into plan/work/review/debug or let `using-spec-first` choose the matching workflow.


## Autonomy And Permissions

An explicit `/spec:mcp-setup` or `$spec-mcp-setup` invocation is authorization to complete the required setup workflow without intermediate confirmation prompts. Do not stop to ask before running deterministic, bounded setup actions that this skill owns:

- creating or refreshing `.spec-first/config.local.example.yaml`
- creating `.spec-first/config.local.yaml` only when it does not already exist
- ensuring `.gitignore` contains `.spec-first/*.local.yaml`
- installing or verifying required helper tooling
- writing host MCP config for required host-MCP tools
- writing readiness ledgers and setup-owned `.spec-first/config/*.json` facts

If a setup command fails because the host sandbox or OS denies permission, retry through the host's approved escalation path or the script's non-interactive sudo/package-manager path without asking the user first. Do not invent destructive escalation. If escalation is unavailable, requires credentials that the harness cannot provide, or still fails, record the failed command stage, reason, and next action in the final status instead of blocking on confirmation.

Keep destructive or ambiguous actions out of the autonomous path. Do not delete `compound-engineering.local.md`, `.compound-engineering/config.local.yaml`, existing `.spec-first/config.local.yaml`, or user-authored host config sections unless the user explicitly asks for that deletion or uninstall behavior.

## Workspace Repo Targeting

Setup is target-aware for three topology modes:

- A normal Git repo: project-local facts are written under that repo.
- A monorepo with multiple modules: the Git root remains the single project boundary; modules are not separate readiness targets.
- A parent workspace containing multiple independent child Git repos: the parent is advisory only. It may discover candidates and configure host-level MCP settings, but it must not write parent `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, `.spec-first/config.local*.yaml`, or `.spec-first/*.local.yaml` gitignore entries.

Use the shared project target resolver before any repo-local writer:

```bash
bash skills/spec-mcp-setup/scripts/resolve-project-target.sh --format json
bash skills/spec-mcp-setup/scripts/resolve-project-target.sh --repo project-a --format json
```

PowerShell:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/resolve-project-target.ps1 -Format json
pwsh -File skills/spec-mcp-setup/scripts/resolve-project-target.ps1 -Repo project-a -Format json
```

When run from a parent workspace, default to all child repos instead of stopping for a repo choice. The parent remains advisory only: scripts loop through child-scoped `--repo` flows, write child-local setup artifacts, and write only advisory summaries under `.spec-first/workspace/`:

```bash
bash skills/spec-mcp-setup/scripts/bootstrap-project-config.sh --refresh-example --create-local --ensure-gitignore --json
bash skills/spec-mcp-setup/scripts/install-mcp.sh
bash skills/spec-mcp-setup/scripts/verify-tools.sh
```

Use an explicit child selection only when narrowing the setup run:

```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh --repo project-a
bash skills/spec-mcp-setup/scripts/verify-tools.sh --repo project-a
bash skills/spec-mcp-setup/scripts/bootstrap-project-config.sh --repo project-a --refresh-example --create-local --ensure-gitignore --json
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1 -Repo project-a
pwsh -File skills/spec-mcp-setup/scripts/verify-tools.ps1 -Repo project-a
pwsh -File skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1 -Repo project-a -RefreshExample -CreateLocal -EnsureGitignore -Json
```

The setup scripts also support `--all-repos` / `-AllRepos` as an explicit equivalent to the parent-workspace default:

```bash
bash skills/spec-mcp-setup/scripts/bootstrap-project-config.sh --all-repos --refresh-example --create-local --ensure-gitignore --json
bash skills/spec-mcp-setup/scripts/install-mcp.sh --all-repos
bash skills/spec-mcp-setup/scripts/verify-tools.sh --all-repos
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1 -AllRepos -RefreshExample -CreateLocal -EnsureGitignore -Json
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1 -AllRepos
pwsh -File skills/spec-mcp-setup/scripts/verify-tools.ps1 -AllRepos
```

Parent-workspace default all-repos and explicit `--all-repos` reject `--repo` and single Git repo execution. They must not write parent `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, or `.spec-first/providers/*`.

`--repo` is workspace-scoped in this MVP. From a non-Git parent workspace it must resolve to a child Git repo inside the current workspace; escaping the workspace returns `repo-target-outside-workspace`.

It must not run:

- `npx -y <configured-gitnexus-package> analyze`
- `npx -y <configured-gitnexus-package> status`
- `npx -y <configured-gitnexus-package> query`
- the retired internal graph CLI

Graph readiness compilation is owned by `spec-graph-bootstrap`. Re-running setup must not reset an existing canonical project graph readiness summary to `not-bootstrapped` when the current provider setup remains ready.

## Project Preflight

Run project preflight before changing host MCP config:

```bash
bash skills/spec-mcp-setup/scripts/check-health
```

Native PowerShell path:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/check-health.ps1
```

Machine-readable form:

```bash
bash skills/spec-mcp-setup/scripts/check-health --json
```

```powershell
pwsh -File skills/spec-mcp-setup/scripts/check-health.ps1 -Json
```

On Windows, prefer the native PowerShell script. Git Bash or WSL can run the Bash script as a compatibility fallback, but those results do not replace Win64-native PowerShell validation.

`check-health` reports:

- required helper `agent-browser`
- required developer helper tools
- required global `ast-grep` skill
- `.spec-first/config.local.yaml`
- `.spec-first/config.local.example.yaml`
- `.spec-first/*.local.yaml` gitignore coverage
- legacy `compound-engineering.local.md`
- legacy `.compound-engineering/config.local.yaml`

If project-local setup actions are needed inside the resolved target repo, run the deterministic bootstrap script with explicit flags. Do not ask for an extra confirmation; the workflow invocation already authorizes these bounded, idempotent setup writes.

```bash
bash skills/spec-mcp-setup/scripts/bootstrap-project-config.sh --refresh-example --create-local --ensure-gitignore --json
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1 -RefreshExample -CreateLocal -EnsureGitignore -Json
```

Do not pass `--delete-legacy-markdown` / `-DeleteLegacyMarkdown` during ordinary setup. Do not automatically delete `.compound-engineering/config.local.yaml`; report legacy residue and tell the user that spec-first now uses `.spec-first/config.local.yaml`.

Project preflight prepares setup input. Missing required helper tooling must mark Required Harness Runtime as failed, except Windows `agent-browser` browser runtime marker/download failures when the CLI and global skill are already ready; those are reported as non-blocking degraded helper facts so graph readiness can continue. Missing local config, outdated example config, and legacy compound-engineering residue must not mark Required Harness Runtime as failed.

## Deterministic Commands

Run dependency checks first:

```bash
bash skills/spec-mcp-setup/scripts/check-deps.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/check-deps.ps1
```

Install helper tooling:

```bash
bash skills/spec-mcp-setup/scripts/install-helpers.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-helpers.ps1
```

Install and configure required MCP servers:

```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1
```

Write the final readiness ledger and project setup facts:

```bash
bash skills/spec-mcp-setup/scripts/verify-tools.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/verify-tools.ps1
```

`install-helpers.* --verify-only` must only detect helper facts. It must not install the CLI, run `agent-browser install`, or install the global skill. It checks `$HOME/.agent-browser/spec-first-install.json` as the marker that the default install path has completed `agent-browser install`; missing marker means `install_status=action-required`. `agent-browser` missing, skipped, or degraded facts must always use `baseline_blocking=false`; this preserves setup baseline while leaving browser automation repair visible in `next_action`.

`install-helpers.*` preserves inherited npm registry, proxy, and mirror env vars through the helper install path. If you need a domestic npm source or corporate proxy, set the standard `NPM_CONFIG_REGISTRY` / `npm_config_registry` and proxy env vars before running setup; the install helpers will forward them through the sudo fallback instead of discarding them. On Linux, `agent-browser install` uses `--with-deps` so the browser runtime and system packages are installed together. By default setup does not install `agent-browser` or download browser runtime. Set `SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` before rerunning setup when browser automation is needed; then `agent-browser` browser runtime, the global `agent-browser` skill, and the global `ast-grep` skill may install in parallel, while package-manager-backed helper CLIs stay serialized to avoid lock conflicts and keep the failure surface narrow.

## Helper Output Shape

`install-helpers.*` always returns helper facts under this top-level shape:

```json
{
  "helper_tools": {
    "agent-browser": {},
    "gh": {},
    "jq": {},
    "vhs": {},
    "silicon": {},
    "ffmpeg": {},
    "ast-grep": {},
    "ast-grep-skill": {}
  }
}
```

Default helper install mode must:

1. Skip `agent-browser` install/repair unless `SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` is set; record `browser_capability_demand_signals[]` either way.
2. When explicitly required, install `agent-browser` CLI if missing.
3. When explicitly required, run `agent-browser install` on macOS/Windows or `agent-browser install --with-deps` on Linux; browser runtime failure is non-blocking on every platform.
4. Write `$HOME/.agent-browser/spec-first-install.json` only after the platform-appropriate `agent-browser install` succeeds.
5. Install required helper CLIs: `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`, and `ast-grep`.
6. When explicitly required, install the upstream/global `agent-browser` skill:

```bash
npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
```

7. Install the global `ast-grep` skill:

```bash
npx -y skills@latest add ast-grep/agent-skill -g -y
```

Package-backed setup commands normally request the latest available safe version when they install or warm a tool: npm/npx packages use `@latest`, Cargo installs use `--force` where supported, and package-manager handoff commands prefer upgrade-before-install semantics. A package may be pinned for a documented upstream remediation or stability window; the pin must live in `mcp-tools.json` and all setup/bootstrap projections must read that value instead of hard-coding the package spec. Successful MCP warmups may be cached under `$HOME/.spec-first/cache/mcp-warmup/` by host, platform, tool id, and resolved command hash; `SPEC_FIRST_WARMUP_CACHE_DIR` may override the cache root. Pinned package specs stay valid until the command hash changes, while `@latest` warmups use a bounded TTL controlled by `SPEC_FIRST_WARMUP_LATEST_TTL_SECONDS` and defaulting to 86400 seconds. `SPEC_FIRST_FORCE_WARMUP=1` or `SPEC_FIRST_DISABLE_WARMUP_CACHE=1` must force the script back to running the warmup command. `--verify-only` remains read-only and never upgrades tools.

## Readiness Ledger v2

`detect-tools.*` outputs tool facts only:

- `schema_version="tool-facts.v2"`
- `tools`
- `graph_providers`
- no top-level legacy CRG fields
- no `baseline_ready`

`verify-tools.*` merges:

- `detect-tools.*` facts
- `install-helpers.* --verify-only` facts

Then it computes one final readiness ledger:

```json
{
  "schema_version": "v2",
  "baseline_ready": true,
  "tools": {},
  "graph_providers": {},
  "helper_tools": {}
}
```

`baseline_ready` includes required MCP tools, required graph providers, and every baseline-blocking required helper in `helper_tools`. GitNexus is both the current graph provider and a required host MCP server. Graph providers can be baseline-ready while still having `query_ready=false`; that means the harness runtime is ready and graph readiness compilation is still required.

On a first setup, graph-provider facts show:

```json
{
  "configured": true,
  "enabled_for_bootstrap": true,
  "query_ready": false,
  "bootstrap_required": true
}
```

On repeated setup, reinstall, or post-upgrade verification, `write-provider-config.*` preserves existing graph-bootstrap derived readiness summaries when:

- `.spec-first/config/graph-providers.json` is schema `graph-providers.v1` for the same repo;
- the same provider is still present;
- the current dependency and host config are ready.

If a provider is missing, uninstalled, or no longer configured, setup must not preserve query readiness; it should mark the provider as requiring action or graph readiness compilation again. This keeps repeated runs idempotent without hiding real uninstall or broken-config cases.

## Project Setup Facts

`write-provider-config.*` writes project config artifacts only when running inside a git repo:

- `.spec-first/config/graph-providers.json`
- `.spec-first/config/runtime-capabilities.json`
- `.spec-first/config/provider-artifacts.json`

These files are setup-owned inputs for `spec-graph-bootstrap`. They are not canonical graph readiness artifacts.

Repeated setup must not dirty the repo by rewriting these files only to refresh `generated_at`. If semantic payloads are unchanged, `write-provider-config.*` keeps existing timestamps, leaves files unchanged, and reports `ready` instead of `written`.

When preserving an existing bootstrapped project, `write-provider-config.*` must reconstruct setup-owned readiness projections from canonical graph artifacts under `.spec-first/graph/` and `.spec-first/impact/`. It may initialize missing summaries, but it must not require `spec-graph-bootstrap` to mutate setup-owned config inputs, and it must not unconditionally reset current canonical readiness to `not-bootstrapped`.

Expected projection boundaries:

```json
{
  "schema_version": "graph-providers.v1",
  "generated_by": "spec-mcp-setup",
  "providers": {
    "gitnexus": {
      "configured": true,
      "commands": {
        "bootstrap": ["npx", "-y", "<gitnexus package from mcp-tools.json>", "analyze", "--force"],
        "status": ["npx", "-y", "<gitnexus package from mcp-tools.json>", "status"],
        "query_probe": ["npx", "-y", "<gitnexus package from mcp-tools.json>", "query", "<expected-source-basename>", "--repo", "<repo-name>"]
      },
      "query_probe_policy": {
        "expected_hit": true,
        "source": "git-ls-files-code-basename",
        "token": "<expected-source-basename>",
        "selected_from": "<tracked-source-file>",
        "candidates": [
          {
            "token": "<expected-source-basename>",
            "selected_from": "<tracked-source-file>",
            "reason_code": "entrypoint_named"
          }
        ]
      }
    }
  },
  "derived_readiness": {
    "updated_by": "spec-mcp-setup",
    "workflow_mode": "setup-ready-bootstrap-required",
    "provider_status_artifact": ".spec-first/graph/provider-status.json",
    "graph_facts_artifact": ".spec-first/graph/graph-facts.json",
    "impact_capabilities_artifact": ".spec-first/impact/bootstrap-impact-capabilities.json"
  },
  "boundaries": {
    "setup_only": true,
    "does_not_run_gitnexus_analyze": true,
    "does_not_run_provider_index_refresh": true,
    "graph_bootstrap_required": true
  }
}
```

GitNexus `query_probe_policy` selection must stay deterministic and source-derived. Prefer tracked source basenames that are likely to participate in execution flows: main/launch/loading/home/login/router/navigation entry files, controllers, handlers, services, repositories, forms, tables, pages, dashboards, and Android `Activity` / `Fragment` / `ViewModel` classes. For source files with workflow-like basenames, bounded method-token extraction may add stronger proof candidates before class basenames when method names look flow-bearing, for example `stepSave`, `validatePayload`, `booleanResult`, `failure`, `options`, `add`, `save`, `delete`, `create`, `cancel`, `submit`, or `update`. Treat lifecycle/config/type/schema/constants basenames as low signal, and demote display-only or weak proof basenames such as `Report`, `View`, `Screen`, `Layout`, `Modal`, `Advertise`, `Guide`, `Dialog`, `Adapter`, `Bean`, and `Entity` so they do not beat stronger flow-bearing candidates. The setup script only writes up to 5 candidates and reason codes; `spec-graph-bootstrap` enforces its own consumer-side candidate limit, performs the bounded CLI proof, and downstream LLM workflows decide how to consume degraded facts.

## Codex TOML Contract

Codex MCP sections with hyphenated names must use quoted TOML table keys. Before writing a Codex section, scripts must delete both legacy unquoted and current quoted sections for the same MCP server. `configure-host.*`, `detect-tools.*`, and `uninstall-mcp.*` must share the same TOML formatter/parser helpers.

Host MCP config files must contain only host-supported MCP server fields such as `command`, `args`, and host-specific startup timeout fields. Internal setup metadata such as selected scope belongs in script output and readiness ledgers, not in Claude/Codex MCP server entries.

Codex higher-precedence config handling is tool-specific. A higher-precedence config file that contains no section for the same MCP server must not block a valid selected-scope config. A higher-precedence section for the same MCP server is ready only when it exactly matches the expected command and args; otherwise it is `precedence-blocked`.

## Uninstall Contract

`uninstall-mcp.*` must remove registered MCP servers. Retired CRG is not a registered tool id; manual cleanup guidance owns any historical host config residue. After uninstall it must refresh:

- host readiness ledger v2
- `.spec-first/config/graph-providers.json`

Uninstall does not delete `agent-browser`, external caches, or the project projection file.

## Success Summary

When setup finishes, the assistant's final response must restate the complete readiness status sourced from readiness ledger v2, followed by a short friendly next-step prompt. Prefer grouped status blocks rendered inside fenced code blocks instead of one wide Markdown table. The first grouped section must be an `Execution result` summary that shows `Harness runtime` and `Graph readiness` decisions, including ready and pending graph providers. Do not rely on prior command output as the only place where the status appears. Do not describe setup as fully complete when graph-provider rows still show `Query=pending`; say the Required Harness Runtime is ready and graph bootstrap is still pending. When graph bootstrap is pending, tell the user it can run now because it is deterministic CLI compilation. Distinguish durable readiness refresh from Plan-stage live GitNexus evidence: run graph-bootstrap when current graph readiness facts are needed, and use plan when the user only needs a lightweight live GitNexus probe under a current visible MCP surface or a restarted/new session after setup wrote MCP config. Dirty worktree or stale durable readiness does not automatically make prior/session-local Plan evidence unusable. When graph readiness is already ready, the next-step prompt must not stop at a restart caveat; tell users with an already-clear task they can describe it directly in a restarted/new session so `using-spec-first` can route by intent, or choose the matching plan/work/review/debug workflow themselves.

```text
Required Harness Runtime is ready; graph bootstrap is still pending.

Required Harness Runtime status (grouped):
Execution result:
| Area             | Status  | Evidence                                      | Next                     |
| ---------------- | ------- | --------------------------------------------- | ------------------------ |
| Harness runtime  | ready   | baseline_ready=true                           | n/a                      |
| Graph readiness  | pending | pending: gitnexus                             | run spec-graph-bootstrap |

MCP servers:
| Name                | Role                     | Dependency | Host  | Project | Next |
| ------------------- | ------------------------ | ---------- | ----- | ------- | ---- |
| sequential-thinking | 反思式推理辅助           | ready      | ready | n/a     | n/a  |
| context7            | 当前框架和库文档         | ready      | ready | n/a     | n/a  |

Graph providers:
| Name              | Role                         | Dependency | Host         | Query   | Bootstrap | Next                     |
| ----------------- | ---------------------------- | ---------- | ------------ | ------- | --------- | ------------------------ |
| gitnexus          | 全局代码知识图谱与影响分析   | ready      | ready        | pending | required  | run spec-graph-bootstrap |

Helper tools:
| Name           | Type         | Result | Dependency | Install | Skill | Next |
| -------------- | ------------ | ------ | ---------- | ------- | ----- | ---- |
| agent-browser  | helper       | ready  | ready      | ready   | ready | n/a  |
| gh             | helper       | ready  | ready      | ready   | n/a   | n/a  |
| jq             | helper       | ready  | ready      | ready   | n/a   | n/a  |
| vhs            | helper       | ready  | ready      | ready   | n/a   | n/a  |
| silicon        | helper       | ready  | ready      | ready   | n/a   | n/a  |
| ffmpeg         | helper       | ready  | ready      | ready   | n/a   | n/a  |
| ast-grep       | helper       | ready  | ready      | ready   | n/a   | n/a  |
| ast-grep-skill | global-skill | ready  | ready      | ready   | ready | n/a  |

Project setup facts:
| Artifact                  | Project | Next |
| ------------------------- | ------- | ---- |
| graph-providers.json      | written | n/a  |
| runtime-capabilities.json | written | n/a  |
| provider-artifacts.json   | written | n/a  |

下一步:
  1. 现在可以运行 /spec:graph-bootstrap 或 $spec-graph-bootstrap 完成 deterministic graph readiness 编译；也可以在本会话直接回复“继续完成”，让 agent 调用 bootstrap 脚本。
  2. graph readiness 完成后，按用户意图进入 plan/work/review/debug 等下游 workflow；项目指导来自 AGENTS.md、CLAUDE.md、docs/contracts、源码、测试和 graph readiness facts。
  3. 重启 Claude Code/Codex 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。
```

## Pipeline Runtime Dependencies

The setup pipeline scripts themselves depend on a small set of host tools that are separate from per-tool `dependencies` declared in `mcp-tools.json`. `check-deps.sh` / `check-deps.ps1` run at the start of setup and fail visibly before tool-level work begins, but the required set is host-path specific:

- Unix shell path (`*.sh`) requires `node`, `npm`, `npx`, `jq`, and `python3`; `uv` / `uvx` are optional cleanup-era tools and must not block GitNexus-only setup readiness.
- Windows PowerShell 7 path (`*.ps1`) requires `node`, `npm`, and `npx`; `git` remains optional. It does not require `jq` or `python3` because JSON/TOML handling and bounded process execution are implemented with native PowerShell/.NET in the `.ps1` scripts.

Unix-only dependency details:

- `jq` — required by shell scripts for reading and projecting `mcp-tools.json`, host configs, and JSON status payloads.
- `python3` — required by shell scripts for: hashlib-backed warmup-cache hashing (`install-mcp.sh`), bounded subprocess timeout management with `start_new_session` + `os.killpg` (`install-mcp.sh`, `bootstrap-providers.sh`), and TOML section regex parsing (`lib-toml.sh`). Currently any reasonably modern `python3` (≥3.6) suffices; we do not depend on `tomllib` (3.11+).
- `node` — required by `verify-tools.sh` to invoke `render-status-block.cjs` for CJK-width-aware status table rendering. Also implied by all `npx`-based MCP installs (gitnexus, sequential-thinking, context7).

`uv` / `uvx` are not required by the current GitNexus-only setup registry. Historical CRG cleanup, if needed, is manual guidance rather than setup-owned dependency readiness.

## Reference

- Supported tools: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Machine registry: `skills/spec-mcp-setup/mcp-tools.json`
- Claude command metadata: `templates/claude/commands/spec/mcp-setup.md`
- Codex runtime loads this source skill directly; there is no separate Codex command template.
