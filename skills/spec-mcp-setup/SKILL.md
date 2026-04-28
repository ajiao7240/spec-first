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
- Required Harness Runtime: required MCP servers, graph-provider MCP servers, `agent-browser`, readiness ledger v2, and graph provider projection.

Project-local config and legacy residue facts do not affect `baseline_ready`. Required helper facts do affect `baseline_ready`. This workflow does not expose selectable MCP registry entries, legacy pending states, or a browser MCP server.

## Runtime Baseline

`skills/spec-mcp-setup/mcp-tools.json` is the only machine registry for MCP servers and graph-provider MCP servers. Schema version is `4`. Package/version specs for every MCP and graph-provider MCP command are sourced from this file; setup projections such as `.spec-first/config/graph-providers.json` must derive from it and must not become a second version registry.

Required MCP tools:

- `serena`
- `sequential-thinking`
- `context7`

Required graph-provider MCP tools:

- `gitnexus` with role `global_knowledge`
- `code-review-graph` with role `impact_context`

Required helper tooling outside `mcp-tools.json`:

- `agent-browser`
- `gh`
- `jq`
- `vhs`
- `silicon`
- `ffmpeg`
- `ast-grep`
- global `ast-grep` skill

All tools in `mcp-tools.json` must have `required=true` and a `category` of `mcp` or `graph-provider`. Required helper tooling must not be added to `mcp-tools.json`; it is managed by `install-helpers.*` and appears under readiness ledger `helper_tools`.

## What This Workflow Does

1. Runs project preflight with `check-health`.
2. Offers explicit project-local config bootstrap actions when needed.
3. Reports legacy Compound Engineering residue and asks before deleting `compound-engineering.local.md`.
4. Checks required dependencies.
5. Installs/verifies required helper tooling.
6. Warms and configures every required MCP server in the host MCP config.
7. Bootstraps Serena for the current repo.
8. Writes readiness ledger v2 to the host marker path.
9. Writes setup-owned project facts inside a git repo: `.spec-first/config/graph-providers.json`, `.spec-first/config/runtime-capabilities.json`, and `.spec-first/config/provider-artifacts.json`.
10. Prints a clear next-step prompt after the final status block: continue graph readiness compilation now, then restart Claude Code/Codex or start a new session before relying on the newly written MCP config in downstream workflows.

Re-running setup must be idempotent and non-destructive. If Serena is already project-ready, setup should keep the existing `.serena/project.yml` and ready marker. If a Serena rebuild is needed, scripts must preserve the previous project files until the new bootstrap has succeeded and must restore them on failure.

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

When run from an unresolved parent workspace, project rows use `workspace-target-required` and list candidate child repos. `workspace-single-candidate` is still fail-closed: it is a suggestion, not implicit write permission. Continue with an explicit child selection:

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

`--repo` is workspace-scoped in this MVP. From a non-Git parent workspace it must resolve to a child Git repo inside the current workspace; escaping the workspace returns `repo-target-outside-workspace`.

Serena project language selection is semantic. The default deterministic bootstrap must not hard-code TypeScript/Vue or any other project language; when no `--language` values are passed for a first-time bootstrap, Serena's own project creation may infer languages from the target repo. If the agent notices an existing `.serena/project.yml` language mismatch, it should inspect bounded project evidence such as build files, package manifests, and representative source files, decide the intended language set, and run the safe refresh primitive instead of editing `.serena/project.yml` by hand:

```bash
bash skills/spec-mcp-setup/scripts/activate-serena.sh --refresh --language kotlin --language java
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/activate-serena.ps1 -Refresh -Language kotlin,java
```

Refresh is intentionally non-interactive. If `--refresh` / `-Refresh` is used without explicit language values, the script may only reuse languages from the existing `.serena/project.yml`; when no existing languages are available, it must fail with a clear diagnostic and ask the agent to pass explicit languages. Do not use refresh-without-language as a way to ask Serena to re-decide a mismatched project.

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

If project-local setup actions are needed, ask the user before changing files, then run the deterministic bootstrap script with explicit flags:

```bash
bash skills/spec-mcp-setup/scripts/bootstrap-project-config.sh --refresh-example --create-local --ensure-gitignore --json
```

Windows:

```powershell
pwsh -File skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1 -RefreshExample -CreateLocal -EnsureGitignore -Json
```

Only pass `--delete-legacy-markdown` / `-DeleteLegacyMarkdown` after the user confirms deleting `compound-engineering.local.md`. Do not automatically delete `.compound-engineering/config.local.yaml`; report it as legacy residue and tell the user that spec-first now uses `.spec-first/config.local.yaml`.

Project preflight prepares setup input. Missing required helper tooling must mark Required Harness Runtime as failed. Missing local config, outdated example config, and legacy CE residue must not mark Required Harness Runtime as failed.

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

All package-backed setup commands must request the latest available safe version when they install or warm a tool: npm/npx packages normally use `@latest`, `uvx` tool invocations use `--upgrade`, Cargo installs use `--force` where supported, and package-manager handoff commands prefer upgrade-before-install semantics. A package may be pinned only for a documented upstream remediation window; the pin must live in `mcp-tools.json`. GitNexus is currently pinned there to `1.6.4-rc.21` until stable `latest` includes the query read-only FTS fix. `--verify-only` remains read-only and never upgrades tools.

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

`baseline_ready` includes required MCP tools, graph providers, and every required helper in `helper_tools`. Graph providers can be baseline-ready while still having `query_ready=false`; that means the harness runtime is ready and graph readiness compilation is still required.

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
        "bootstrap": ["npx", "-y", "<gitnexus package from mcp-tools.json>", "analyze"],
        "status": ["npx", "-y", "<gitnexus package from mcp-tools.json>", "status"],
        "query_probe": ["npx", "-y", "<gitnexus package from mcp-tools.json>", "query", "main src build README package", "--repo", "<repo-name>"]
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

## Codex TOML Contract

Codex MCP sections with hyphenated names must use quoted TOML table keys:

```toml
[mcp_servers."code-review-graph"]
```

Before writing a Codex section, scripts must delete both legacy unquoted and current quoted sections for the same MCP server. `configure-host.*`, `detect-tools.*`, and `uninstall-mcp.*` must share the same TOML formatter/parser helpers.

Host MCP config files must contain only host-supported MCP server fields such as `command`, `args`, and host-specific startup timeout fields. Internal setup metadata such as selected scope belongs in script output and readiness ledgers, not in Claude/Codex MCP server entries.

Codex higher-precedence config handling is tool-specific. A higher-precedence config file that contains no section for the same MCP server must not block a valid selected-scope config. A higher-precedence section for the same MCP server is ready only when it exactly matches the expected command and args; otherwise it is `precedence-blocked`.

## Uninstall Contract

`uninstall-mcp.*` must remove all registered MCP servers, including `gitnexus` and `code-review-graph`. After uninstall it must refresh:

- host readiness ledger v2
- `.spec-first/config/graph-providers.json`

Uninstall does not delete `agent-browser`, external caches, or the project projection file.

## Success Summary

When setup finishes, the assistant's final response must restate the complete readiness status sourced from readiness ledger v2, followed by a short friendly next-step prompt. Prefer grouped status blocks rendered inside fenced code blocks instead of one wide Markdown table. Do not rely on prior command output as the only place where the status appears. Do not describe setup as fully complete when graph-provider rows still show `Query=pending`; say the Required Harness Runtime is ready and graph bootstrap is still pending.

```text
Required Harness Runtime is ready; graph bootstrap is still pending.

Required Harness Runtime status (grouped):
MCP servers:
| Name                | Role                     | Dependency | Host  | Project | Next |
| ------------------- | ------------------------ | ---------- | ----- | ------- | ---- |
| serena              | 符号级精确编辑和项目索引 | ready      | ready | ready   | n/a  |
| sequential-thinking | 反思式推理辅助           | ready      | ready | n/a     | n/a  |
| context7            | 当前框架和库文档         | ready      | ready | n/a     | n/a  |

Graph providers:
| Name              | Role                         | Dependency | Host  | Query   | Next                     |
| ----------------- | ---------------------------- | ---------- | ----- | ------- | ------------------------ |
| gitnexus          | 全局代码知识图谱与影响分析   | ready      | ready | pending | run spec-graph-bootstrap |
| code-review-graph | 变更影响半径与 review 上下文 | ready      | ready | pending | run spec-graph-bootstrap |

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
  1. 建议先重启 Claude Code/Codex 或新开会话，让新写入的 MCP 配置被宿主加载。
  2. 然后运行 /spec:graph-bootstrap 或 $spec-graph-bootstrap 编译 graph readiness facts；如果当前 agent 判断只需调用确定性 bootstrap 脚本，也可以在本会话直接回复“继续完成”，但下游 workflow 前仍要重启或新开会话。
```

## Reference

- Supported tools: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Machine registry: `skills/spec-mcp-setup/mcp-tools.json`
- Claude command metadata: `templates/claude/commands/spec/mcp-setup.md`
