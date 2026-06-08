---
name: spec-mcp-setup
description: Install, configure, verify, and refresh required harness runtime readiness facts for spec-first workflows on Claude Code or Codex.
argument-hint: "[bare guided setup] [--check|--verify-only|--plan] [--only codegraph,graphify] [--repo <path>] [--requirement-workspace <repo-relative-path>]"
---

# Runtime Setup

`spec-mcp-setup` is the current runnable entrypoint for the Runtime Setup workflow. The target user-facing name is `spec-runtime-setup` (`/spec:runtime-setup` on Claude Code and `$spec-runtime-setup` on Codex); `/spec:mcp-setup` and `$spec-mcp-setup` remain the compatibility names until the host alias contract is implemented. Runtime Setup prepares deterministic host/runtime facts for spec-first workflows. It installs or verifies required MCP servers and helper tooling, writes setup-owned project facts, and reports concrete next actions. It does not provide code-understanding authority; downstream workflows use bounded direct source reads, `rg`, ast-grep, git diff, tests/logs, and user-provided evidence.

## Contract Summary

| Field | Contract |
| --- | --- |
| When to use | Host runtime setup, MCP setup, helper-tool readiness, missing runtime assets, or project-local setup fact refresh. |
| When not to use | Ordinary planning, implementation, review, debugging, or code impact questions that can proceed from direct source evidence. |
| Inputs | Current host, repo target, `skills/spec-mcp-setup/mcp-tools.json`, helper installer facts, host config state, git/workspace target facts, and project instructions. |
| Outputs | Readiness ledger v2, provider readiness v2 facts, setup scenario fingerprint, optional project setup facts under `.spec-first/config/`, and a grouped status block. |
| Artifacts | `.spec-first/config/tool-facts.json`, `.spec-first/config/runtime-capabilities.json`, and `.spec-first/workspace/scenario-fingerprint-setup.json` when applicable. |
| Failure modes | Missing dependencies, host config write failure, ambiguous parent workspace target, symlink escape, invalid registry schema, helper install failure, or unsupported host. |
| Downstream consumers | `using-spec-first`, plan/work/review/debug workflows, doctor/update guidance, and humans repairing setup. |

Core boundary: scripts prepare deterministic readiness facts; LLM workflows decide how to use those facts. Setup must not make semantic code-understanding judgments or require any external analysis service before ordinary work can continue.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

## Source Of Truth

`skills/spec-mcp-setup/mcp-tools.json` is the current source directory for the machine registry of baseline MCP servers plus explicit opt-in MCP capability entries. Schema version is `6`. Current required baseline tools include `sequential-thinking` and `context7`; optional MCP entries must carry `opt_in.explicit_consent_required=true` and are admitted only when the user selects them explicitly. The directory name remains `spec-mcp-setup` during the entrypoint rename to avoid a broad source/runtime path migration in the same slice.

Generated runtime mirrors under `.claude/`, `.codex/`, and `.agents/skills/` are not source. If setup prose or scripts change, update source first and use `spec-first init` only for runtime regeneration.

## Required Harness Runtime

`mcp-tools.json` owns required baseline MCP server definitions and explicit opt-in MCP capability entries. `helper-tools.json` is the single source for helper tooling readiness, baseline blocking, install safety metadata, and shell/PowerShell runner requirements. `provider-tools.json` is the source for non-MCP provider helpers installed through `install-helpers.*`. Required helper tooling outside `mcp-tools.json` is installed and verified by `install-helpers.*` and `check-health`, then recorded under `helper_tools` and `items[]` in setup facts.

Required helper tooling must not be added to `mcp-tools.json`. Current helper checks include `agent-browser` and ast-grep capability detection. Use `install-helpers.* --verify-only` for read-only verification, and use the install path only when setup explicitly needs repair. The agent-browser repair path may run `npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y`, should respect `NPM_CONFIG_REGISTRY`, and may run `agent-browser install --with-deps` when browser automation support is required.

Optional provider readiness is reported through `provider_readiness[]` (`provider-readiness.v2`). Setup may populate lifecycle display bits such as `installed`, `configured`, `indexed`, `server_reachable`, and `query_verified`, plus setup-owned runtime metadata such as `native_interfaces`, `first_generation`, `steady_state`, and `usage_note`. Downstream decision health is still driven by `readiness_status`; lifecycle and first-generation fields explain boundaries and next actions, not semantic truth. Provider self-reported `fresh` maps to `unknown`; provider self-reported `stale` may map to `stale` because it is conservative. `query_verified=true` is reserved for a real probe or explicit real-environment signal, not for package installation alone.

## Project Preflight / Local Setup

Project-local setup writes `.spec-first/config/tool-facts.json`, `.spec-first/config/runtime-capabilities.json`, and when applicable `.spec-first/workspace/scenario-fingerprint-setup.json`. Scenario fingerprint wrapper failures are warn-and-continue: report `scenario_fingerprint_setup` status and keep the rest of setup actionable instead of blocking ordinary direct-evidence workflows.

## Workflow Modes

- `--check`: inspect current dependency/runtime status only; do not write setup facts, host config, or install tools.
- `--verify-only` / `--refresh-facts`: verify readiness and refresh setup-owned facts; do not install tools or edit host config.
- `--plan`: render install/config operations and safety results; do not write setup facts, host config, or install tools.
- Bare invocation (`$spec-mcp-setup` on Codex or `/spec:mcp-setup` on Claude): primary guided setup path. Show the current CodeGraph/Graphify provider pack, workspace-local writes, host config writes, first-generation commands, and explicit non-actions; ask for one confirmation; after approval, run install-init and verification to completion. Do not ask the user to run internal scripts directly.
- `--only <ids>`: headless/subset apply path. `--only codegraph`, `--only graphify`, or `--only codegraph,graphify` is explicit opt-in and does not require a second confirmation prompt.
- `--requirement-workspace <repo-relative-path>`: optional Graphify input-scope override. Omit it for normal project-workspace setup; default input scope is the resolved project workspace.

Graphify first generation uses the controlled helper/provider route. Public setup does not ask users to set provider consent environment variables; guided confirmation or `--only graphify` is the public opt-in, and the orchestration internally applies helper consent. Direct env consent remains only an advanced/CI escape hatch for invoking `install-helpers.*` directly. Missing `--requirement-workspace` defaults to the resolved project workspace and writes artifacts under `.spec-first/workspace/providers/graphify/graphify-out`; absolute, escaping, symlink-escaping, or nonexistent explicit overrides skip first generation with a structured next action. When accepted, setup runs headless `graphify extract <workspace> --out .spec-first/workspace/providers/graphify/graphify-out --no-cluster` and targets project-level `graphify hook install` so provider-native refresh keeps the graph usable after setup. It must not run `graphify .` or start `graphify watch`; Graphify SKILL/MCP install is user-owned host convenience, while the CLI query/path/explain surface is sufficient for downstream advisory project-graph consumption.

## Guided Setup Flow

For bare `$spec-mcp-setup`, do this inside the skill:

1. Resolve the project target and render the provider plan with `setup-plan-renderer.cjs --mode guided-confirm --repo-root <resolved-project-root>`.
2. Present a compact confirmation block naming:
   - selected optional providers: `codegraph`, `graphify`;
   - workspace-local writes: `.spec-first/tools/`, `.spec-first/cache/`, `.spec-first/workspace/providers/graphify/graphify-out`, `.codegraph/`;
   - project hook writes: `.git/hooks/` for Graphify provider-native auto-refresh when Graphify is selected;
   - host-owned writes: Claude/Codex MCP config for CodeGraph when selected;
   - non-actions: no Graphify SKILL/MCP install, no `graphify .`, no `graphify watch`/long-running daemon, no generated artifact promotion to `docs/` or source truth.
3. If the user confirms, run the internal apply path with `--only codegraph,graphify` plus any `--repo`/`--folder`/`--requirement-workspace` args already supplied, then run verification/fact refresh and render the final grouped status block.
4. If the user declines, skip optional providers, still report required baseline readiness, and name `--only codegraph,graphify` as the headless follow-up if they want to apply later.

## Workflow

1. Identify the current host: current runnable entrypoints are `/spec:mcp-setup` on Claude Code and `$spec-mcp-setup` on Codex. The target renamed entrypoints are `/spec:runtime-setup` and `$spec-runtime-setup` once the alias contract lands.
2. If invoked from a parent workspace, select an explicit child repo or intentionally run setup for all supported child repos. Writes must stay within the selected target.
3. Read `mcp-tools.json`, validate schema version, and verify every required baseline tool plus explicit opt-in MCP entry has deterministic install, host-config, detection, and summary metadata.
4. Run `detect-tools.*` or `install-mcp.*` as appropriate. Warm required package-backed MCP tools, admit optional MCP entries only through explicit selection, write host config only through documented host targets, and record structured status.
5. Run `install-helpers.*` for required helper tooling and explicitly approved non-MCP provider helpers. Guided confirmation or `--only graphify` is enough public consent for Graphify; the script layer may translate that to helper env consent internally. Approved provider first generation and project-local auto-refresh setup may run only through controlled script cases or provider-native bounded CLI commands, then helper/provider readiness facts are collected. If Graphify hook install fails, report action-required readiness instead of marking the project graph ready.
6. Run `verify-tools.*` to write the readiness ledger, reconcile host pointer facts, write project setup facts, and render the grouped status block.
7. Report the status exactly enough for the user to act: ready rows need no action; action-required rows name the missing dependency/config/target step.

## Output Shape

The final setup output should contain:

- `Execution result`: `Harness runtime` status and `baseline_ready`.
- `MCP servers`: required baseline MCP tool dependency/host/project readiness, explicit opt-in MCP entries when selected or detected, and next action.
- `Helper tools`: helper install and readiness status.
- `Provider tools`: provider readiness status and lifecycle display bits when present.
- `Host configured dependencies`: configured MCP/hooks/allowlist/setup/verification command facts.
- `Install safety`: helper install source, risk, review, and mirror provenance.
- `Project setup facts`: status for `tool-facts.json` and `runtime-capabilities.json`.
- `Verification profile`: current verification profile visibility placeholder; full profile execution is v1.13 scope.
- `Next steps`: either fix action-required rows, choose an explicit child repo, or continue to the user-intent workflow.

`tool-facts.json` records setup-owned tool and helper readiness:

```json
{
  "schema_version": "tool-facts.v2",
  "tools": {},
  "helper_tools": {},
  "items": [],
  "configured_dependencies": [],
  "schema_capabilities": [
    "items",
    "configured_dependencies",
    "tool-existence",
    "provider-readiness-generic"
  ],
  "source": {
    "repo_status": "git-repo"
  }
}
```

`runtime-capabilities.json` should record direct evidence posture instead of provider capabilities:

```json
{
  "schema_version": "runtime-capabilities.v1",
  "direct_evidence": {
    "bounded_source_reads": true,
    "ripgrep": true,
    "ast_grep": true,
    "git_diff": true,
    "tests_and_logs": true
  }
}
```

## Boundaries

Setup does:

- verify Node/npm/npx and required helper dependencies;
- warm package-backed MCP servers when configured by `mcp-tools.json`;
- write host MCP config through managed/user host targets;
- write project-local setup facts;
- perform explicit provider-native first generation for approved providers when the target workspace is resolved;
- perform provider-native project-local auto-refresh setup for approved providers when available, such as Graphify `graphify hook install`;
- classify parent workspace target ambiguity and foreign residual indicators as advisory facts.

Setup does not:

- start watchers or long-running daemons;
- install Graphify SKILL/MCP host convenience layers;
- run provider first generation from `--check`, `--plan`, `--verify-only`, or invalid explicit workspace override paths;
- treat provider indexes or query probes as semantic code evidence;
- treat setup facts as semantic code evidence;
- hand-edit generated runtime mirrors as source;
- block ordinary plan/work/review/debug when direct source evidence is sufficient.

## Verification

Focused setup changes should run the narrowest relevant checks:

```bash
bash skills/spec-mcp-setup/scripts/check-health
bash -n skills/spec-mcp-setup/scripts/*.sh
npm run test:mcp-setup
node --check src/cli/commands/internal.js src/cli/helpers/scenario-fingerprint.js
```

For cross-host changes, also run `npm run typecheck`, `npm run test:unit`, `npm run test:smoke`, and `spec-first init` after source validation.
