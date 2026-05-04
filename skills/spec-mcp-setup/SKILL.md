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
- Required Harness Runtime: required MCP servers, required graph providers, `agent-browser`, readiness ledger v2, and graph provider projection.

Project-local config and legacy residue facts do not affect `baseline_ready`. Required helper facts do affect `baseline_ready`. This workflow does not expose selectable MCP registry entries, legacy pending states, or a browser MCP server.

GitNexus `query_probe` must target the GitNexus indexed repo label, not blindly the directory basename. `write-provider-config.*` resolves the label deterministically from explicit setup facts when present, then from `.gitnexus/meta.json` `remoteUrl` basename, and only falls back to the repo directory basename. Its probe token policy should write a bounded, ordered `candidates[]` list of at most 5 source-derived candidates while preserving legacy `token` / `selected_from` fields for compatibility. Candidate ordering is cross-stack: prefer entry/workflow basenames likely to participate in flows, such as main/launch/loading/home/login/router/navigation files, controllers, handlers, services, repositories, forms, tables, pages, dashboards, and Android Activity/ViewModel classes. For controller-heavy repos where class basenames often return definitions-only, setup may extract bounded method-level source tokens from tracked workflow files and prefer flow-like method names such as step/save/add/delete/submit/validate/failure/options before controller class names. Android names are one platform signal, not the default universal front door. Low-signal lifecycle, config, type, schema, constants, display-only, advertisement/guide/dialog/adapter/bean/entity basenames should be demoted until no better source candidate exists.

## Runtime Baseline

`skills/spec-mcp-setup/mcp-tools.json` is the only machine registry for MCP servers and graph providers. Schema version is `4`. Package/version specs for every MCP and graph-provider command are sourced from this file; setup projections such as `.spec-first/config/graph-providers.json` must derive from it and must not become a second version registry.

Required MCP tools:

- `serena`
- `sequential-thinking`
- `context7`

Required graph providers:

- `gitnexus` with role `global_knowledge`
- `code-review-graph` with role `impact_context`

Graph provider does not always mean host MCP server. `gitnexus` remains a required host MCP server because downstream workflows can use live GitNexus tools for global code knowledge. `code-review-graph` is required as a CLI/provider backend for `spec-graph-bootstrap`, but its host MCP server is optional and must not be installed by default. The default `code-review-graph` access mode is `cli_artifact`: setup warms `uvx code-review-graph`, writes provider command projections, and lets graph-bootstrap compile `.spec-first/graph/*` and `.spec-first/impact/*` facts without adding `[mcp_servers."code-review-graph"]` to Claude/Codex host config. Live `code-review-graph serve` may be configured only as an explicit optional enhancement when the user wants direct MCP tools.

Required helper tooling outside `mcp-tools.json`:

- `agent-browser`
- `gh`
- `jq`
- `vhs`
- `silicon`
- `ffmpeg`
- `ast-grep`
- global `ast-grep` skill

All tools in `mcp-tools.json` must have `required=true` and a `category` of `mcp` or `graph-provider`. MCP tools must have `host_config_required=true`. Graph providers must declare whether host MCP config is required. `code-review-graph` must keep `host_config_required=false`, `provider_config.access_mode="cli_artifact"`, and `provider_config.optional_live_mcp=true` so host startup is not blocked by its optional MCP server. Required helper tooling must not be added to `mcp-tools.json`; it is managed by `install-helpers.*` and appears under readiness ledger `helper_tools`.

## What This Workflow Does

1. Runs project preflight with `check-health`.
2. Runs bounded project-local config bootstrap actions when needed.
3. Reports legacy Compound Engineering residue without deleting it automatically.
4. Checks required dependencies.
5. Installs/verifies required helper tooling.
6. Warms every required MCP/provider package and configures only host-MCP-required tools in the host MCP config.
7. Bootstraps Serena for the current repo.
8. Writes readiness ledger v2 to the host marker path.
9. Writes setup-owned project facts inside a git repo: `.spec-first/config/graph-providers.json`, `.spec-first/config/runtime-capabilities.json`, and `.spec-first/config/provider-artifacts.json`.
10. Prints a clear next-step prompt after the final status block: continue graph readiness compilation now when it is pending; when graph readiness is already ready, recommend the project standards/glue baseline workflow as the next durable setup handoff; restart Claude Code/Codex or start a new session before downstream workflows rely on newly written MCP config or live MCP probes.

Re-running setup must be idempotent and non-destructive. If Serena is already project-ready, setup should keep the existing `.serena/project.yml` and ready marker. If a Serena rebuild is needed, scripts must preserve the previous project files until the new bootstrap has succeeded and must restore them on failure.

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
- A parent workspace containing multiple independent child Git repos: the parent is advisory only. It may discover candidates and configure host-level MCP settings, but it must not write parent `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, `.spec-first/config.local*.yaml`, `.spec-first/*.local.yaml` gitignore entries, or `.serena/*`.

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
bash skills/spec-mcp-setup/scripts/install-mcp.sh --all-repos --serena-language-for project-a=typescript --serena-language-for project-b=java
bash skills/spec-mcp-setup/scripts/verify-tools.sh --all-repos
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1 -AllRepos -RefreshExample -CreateLocal -EnsureGitignore -Json
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1 -AllRepos -SerenaLanguageFor project-a=typescript,project-b=java
pwsh -File skills/spec-mcp-setup/scripts/verify-tools.ps1 -AllRepos
```

Parent-workspace default all-repos and explicit `--all-repos` reject `--repo` and single Git repo execution. They must not write parent `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, `.spec-first/providers/*`, or `.serena/*`. First-time Serena bootstrap in batch mode requires an explicit language map entry for each child that lacks existing `.serena/project.yml` language evidence. Children without language evidence are reported as `serena_language_required`; the agent should inspect that child repo and rerun with `--serena-language-for <child>=<language>[,<language>]`. A global `--serena-language` is intentionally rejected in parent-workspace batch mode so a heterogeneous workspace is not silently treated as one language.

`--repo` is workspace-scoped in this MVP. From a non-Git parent workspace it must resolve to a child Git repo inside the current workspace; escaping the workspace returns `repo-target-outside-workspace`.

Serena project language selection is semantic and belongs to the LLM, not to shell scripts. Before a first-time Serena bootstrap, inspect bounded project evidence such as build files, package manifests, and representative source files, choose supported Serena language labels, and pass them through the installer. Do not ask the user to choose a language when the evidence is clear; continue with the LLM-selected language set. Node.js, JavaScript, TypeScript, and VitePress-style repos should use Serena language `typescript`; do not pass `javascript`, `json`, or `markdown` just because manifests, config files, or docs are present.

The deterministic bootstrap must not hard-code TypeScript/Vue or any other project language, and it must not enter Serena's interactive language-selection flow. If no language values are passed for a first-time bootstrap, `activate-serena.*` fails fast with a diagnostic asking the agent to inspect project evidence and pass explicit supported languages. If the agent notices an existing `.serena/project.yml` language mismatch, it should inspect bounded project evidence, decide the intended language set, and run the safe refresh primitive instead of editing `.serena/project.yml` by hand:

If `install-mcp.*` returns Serena `reason_code=serena_language_required`, do not ask the user for a language unless local evidence is genuinely ambiguous. Inspect project evidence, choose supported Serena language labels, and immediately rerun `install-mcp.*`: use `--serena-language` / `-SerenaLanguage` for a single selected repo, or `--serena-language-for <child>=<language>[,<language>]` / `-SerenaLanguageFor` for parent-workspace batch setup.

```bash
bash skills/spec-mcp-setup/scripts/activate-serena.sh --refresh --language kotlin --language java
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/activate-serena.ps1 -Refresh -Language kotlin,java
```

For a read-only Serena project readiness check, use the explicit verify primitive. It only reads `.serena/project.yml` and the ready marker, emits JSON facts, and must not run Serena or create `.serena/`:

```bash
bash skills/spec-mcp-setup/scripts/activate-serena.sh --verify-only
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/activate-serena.ps1 -VerifyOnly
```

Refresh is intentionally non-interactive. If `--refresh` / `-Refresh` is used without explicit language values, the script may only reuse languages from the existing `.serena/project.yml`; when no existing languages are available, it must fail with a clear diagnostic and ask the agent to pass explicit languages. A non-refresh rebuild may also reuse languages from an existing `.serena/project.yml`; first-time setup without existing language facts must fail fast before invoking Serena. Do not use no-language setup as a way to ask Serena to re-decide a mismatched project.

When the LLM supplies multiple languages, the safe refresh primitive should make a deterministic best-effort attempt: try the complete language set first, then retry each supplied language individually. This lets a large Android repo continue with `java` if the `kotlin` language server fails to initialize, without the script inventing a project language.

For full setup, the agent may pass the LLM-selected language set through the installer:

```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh --serena-language kotlin --serena-language java
```

The installer also accepts a comma-separated form:

```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh --serena-languages kotlin,java
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1 -SerenaLanguage kotlin,java
```

It must not run:

- `npx -y <configured-gitnexus-package> analyze`
- `npx -y <configured-gitnexus-package> status`
- `npx -y <configured-gitnexus-package> query`
- `uvx --upgrade code-review-graph build`
- `uvx --upgrade code-review-graph status`
- the retired internal graph CLI

Graph readiness compilation is owned by `spec-graph-bootstrap`. Re-running setup must not reset an existing canonical project graph readiness summary to `not-bootstrapped` when the current provider setup remains ready.

## Project Preflight

Run project preflight before changing host MCP config:

```bash
bash skills/spec-mcp-setup/scripts/check-health
```

Machine-readable form:

```bash
bash skills/spec-mcp-setup/scripts/check-health --json
```

On Windows, run `check-health` from Git Bash or WSL; project bootstrap has a native PowerShell script.

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

Project preflight prepares setup input. Missing required helper tooling must mark Required Harness Runtime as failed. Missing local config, outdated example config, and legacy compound-engineering residue must not mark Required Harness Runtime as failed.

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

For a first-time repo bootstrap, include the LLM-selected Serena language set in the install command:

```bash
bash skills/spec-mcp-setup/scripts/install-mcp.sh --serena-language typescript
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/install-mcp.ps1 -SerenaLanguage typescript
```

Write the final readiness ledger and project setup facts:

```bash
bash skills/spec-mcp-setup/scripts/verify-tools.sh
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/verify-tools.ps1
```

`install-helpers.* --verify-only` must only detect helper facts. It must not install the CLI, run `agent-browser install`, or install the global skill. It checks `$HOME/.agent-browser/spec-first-install.json` as the marker that the default install path has completed `agent-browser install`; missing marker means `install_status=action-required`.

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

1. Install `agent-browser` CLI if missing.
2. Run `agent-browser install`.
3. Write `$HOME/.agent-browser/spec-first-install.json` after `agent-browser install` succeeds.
4. Install required helper CLIs: `gh`, `jq`, `vhs`, `silicon`, `ffmpeg`, and `ast-grep`.
5. Install the upstream/global `agent-browser` skill:

```bash
npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
```

6. Install the global `ast-grep` skill:

```bash
npx -y skills@latest add ast-grep/agent-skill -g -y
```

All package-backed setup commands must request the latest available safe version when they install or warm a tool: npm/npx packages normally use `@latest`, `uvx` tool invocations use `--upgrade`, Cargo installs use `--force` where supported, and package-manager handoff commands prefer upgrade-before-install semantics. A package may be pinned only for a documented upstream remediation window; the pin must live in `mcp-tools.json` and all setup/bootstrap projections must read that value instead of hard-coding the package spec. `--verify-only` remains read-only and never upgrades tools.

## Readiness Ledger v2

`detect-tools.*` outputs tool facts only:

- `schema_version="tool-facts.v2"`
- `tools`
- `graph_providers`
- no top-level `crg`
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

`baseline_ready` includes required MCP tools, required graph providers, and every required helper in `helper_tools`. For graph providers, host MCP readiness only gates baseline when `host_config_required=true`. `code-review-graph` can be baseline-ready with `host_config_status=not-required` as long as its dependencies are ready and its CLI provider projection is enabled. Graph providers can be baseline-ready while still having `query_ready=false`; that means the harness runtime is ready and graph readiness compilation is still required.

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
    },
    "code-review-graph": {
      "configured": true,
      "commands": {
        "bootstrap": ["uvx", "--upgrade", "code-review-graph", "build"],
        "status": ["uvx", "--upgrade", "code-review-graph", "status"],
        "query_probe": ["uvx", "--upgrade", "code-review-graph", "status", "--repo", "<repo-root>"]
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
    "does_not_run_code_review_graph_build": true,
    "graph_bootstrap_required": true
  }
}
```

GitNexus `query_probe_policy` selection must stay deterministic and source-derived. Prefer tracked source basenames that are likely to participate in execution flows: main/launch/loading/home/login/router/navigation entry files, controllers, handlers, services, repositories, forms, tables, pages, dashboards, and Android `Activity` / `Fragment` / `ViewModel` classes. For source files with workflow-like basenames, bounded method-token extraction may add stronger proof candidates before class basenames when method names look flow-bearing, for example `stepSave`, `validatePayload`, `booleanResult`, `failure`, `options`, `add`, `save`, `delete`, `create`, `cancel`, `submit`, or `update`. Treat lifecycle/config/type/schema/constants basenames as low signal, and demote display-only or weak proof basenames such as `Report`, `View`, `Screen`, `Layout`, `Modal`, `Advertise`, `Guide`, `Dialog`, `Adapter`, `Bean`, and `Entity` so they do not beat stronger flow-bearing candidates. The setup script only writes up to 5 candidates and reason codes; `spec-graph-bootstrap` enforces its own consumer-side candidate limit, performs the bounded CLI proof, and downstream LLM workflows decide how to consume degraded facts.

## Codex TOML Contract

Codex MCP sections with hyphenated names must use quoted TOML table keys:

```toml
[mcp_servers."code-review-graph"]
```

The `code-review-graph` host MCP snippet is optional documentation for explicit live-MCP opt-in, not the default setup output. `spec-mcp-setup` must not write this snippet during normal install/verify. The default install result for `code-review-graph` should report the package warmup as ready, host config as `not-required`, and provider bootstrap as enabled.

Before writing a Codex section, scripts must delete both legacy unquoted and current quoted sections for the same MCP server. `configure-host.*`, `detect-tools.*`, and `uninstall-mcp.*` must share the same TOML formatter/parser helpers.

Host MCP config files must contain only host-supported MCP server fields such as `command`, `args`, and host-specific startup timeout fields. Internal setup metadata such as selected scope belongs in script output and readiness ledgers, not in Claude/Codex MCP server entries.

Codex higher-precedence config handling is tool-specific. A higher-precedence config file that contains no section for the same MCP server must not block a valid selected-scope config. A higher-precedence section for the same MCP server is ready only when it exactly matches the expected command and args; otherwise it is `precedence-blocked`.

## Uninstall Contract

`uninstall-mcp.*` must remove registered MCP servers, including any optional `code-review-graph` MCP server if present. After uninstall it must refresh:

- host readiness ledger v2
- `.spec-first/config/graph-providers.json`

Uninstall does not delete `agent-browser`, external caches, or the project projection file.

## Success Summary

When setup finishes, the assistant's final response must restate the complete readiness status sourced from readiness ledger v2, followed by a short friendly next-step prompt. Prefer grouped status blocks rendered inside fenced code blocks instead of one wide Markdown table. The first grouped section must be an `Execution result` summary that shows `Harness runtime` and `Graph readiness` decisions, including ready and pending graph providers. Do not rely on prior command output as the only place where the status appears. Do not describe setup as fully complete when graph-provider rows still show `Query=pending`; say the Required Harness Runtime is ready and graph bootstrap is still pending. When graph bootstrap is pending, tell the user it can run now because it is deterministic CLI compilation; restart or a new session is required only before downstream workflows rely on newly written host MCP config or live MCP probes. When graph readiness is already ready, the next-step prompt must not stop at a restart caveat; recommend `/spec:standards` or `$spec-standards` as the next durable handoff to compile project standards and glue capability baseline, and tell users with an already-clear task they can describe it directly in a restarted/new session so `using-spec-first` can route by intent.

```text
Required Harness Runtime is ready; graph bootstrap is still pending.

Required Harness Runtime status (grouped):
Execution result:
| Area             | Status  | Evidence                                      | Next                     |
| ---------------- | ------- | --------------------------------------------- | ------------------------ |
| Harness runtime  | ready   | baseline_ready=true                           | n/a                      |
| Graph readiness  | pending | ready: code-review-graph; pending: gitnexus   | run spec-graph-bootstrap |

MCP servers:
| Name                | Role                     | Dependency | Host  | Project | Next |
| ------------------- | ------------------------ | ---------- | ----- | ------- | ---- |
| serena              | 符号级精确编辑和项目索引 | ready      | ready | ready   | n/a  |
| sequential-thinking | 反思式推理辅助           | ready      | ready | n/a     | n/a  |
| context7            | 当前框架和库文档         | ready      | ready | n/a     | n/a  |

Graph providers:
| Name              | Role                         | Dependency | Host         | Query   | Bootstrap | Next                     |
| ----------------- | ---------------------------- | ---------- | ------------ | ------- | --------- | ------------------------ |
| gitnexus          | 全局代码知识图谱与影响分析   | ready      | ready        | pending | required  | run spec-graph-bootstrap |
| code-review-graph | 变更影响半径与 review 上下文 | ready      | not-required | ready   | done      | n/a                      |

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
  2. graph readiness 完成后，推荐运行 /spec:standards 或 $spec-standards 编译项目规范与 glue capability baseline，给后续需求、计划、执行和审查提供可复用上下文。
  3. 重启 Claude Code/Codex 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。
```

## Reference

- Supported tools: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Machine registry: `skills/spec-mcp-setup/mcp-tools.json`
- Claude command metadata: `templates/claude/commands/spec/mcp-setup.md`
- Codex runtime loads this source skill directly; there is no separate Codex command template.
