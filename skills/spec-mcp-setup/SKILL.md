---
name: spec-mcp-setup
description: Install, configure, and verify the required harness runtime for spec-first workflows on Claude Code or Codex.
argument-hint: "[--claude|--codex] [--repo <path>] [--verify-only]"
---

# MCP Setup

`spec-mcp-setup` prepares deterministic host/runtime facts for spec-first workflows. It installs or verifies required MCP servers and helper tooling, writes setup-owned project facts, and reports concrete next actions. It does not provide code-understanding authority; downstream workflows use bounded direct source reads, `rg`, ast-grep, git diff, tests/logs, and user-provided evidence.

## Contract Summary

| Field | Contract |
| --- | --- |
| When to use | Host setup, MCP setup, helper-tool readiness, missing runtime assets, or project-local setup fact refresh. |
| When not to use | Ordinary planning, implementation, review, debugging, or code impact questions that can proceed from direct source evidence. |
| Inputs | Current host, repo target, `skills/spec-mcp-setup/mcp-tools.json`, helper installer facts, host config state, git/workspace target facts, and project instructions. |
| Outputs | Readiness ledger v2, setup scenario fingerprint, optional project setup facts under `.spec-first/config/`, and a grouped status block. |
| Artifacts | `.spec-first/config/tool-facts.json`, `.spec-first/config/runtime-capabilities.json`, and `.spec-first/workspace/scenario-fingerprint-setup.json` when applicable. |
| Failure modes | Missing dependencies, host config write failure, ambiguous parent workspace target, symlink escape, invalid registry schema, helper install failure, or unsupported host. |
| Downstream consumers | `using-spec-first`, plan/work/review/debug workflows, doctor/update guidance, and humans repairing setup. |

Core boundary: scripts prepare deterministic readiness facts; LLM workflows decide how to use those facts. Setup must not make semantic code-understanding judgments or require any external analysis service before ordinary work can continue.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

## Source Of Truth

`skills/spec-mcp-setup/mcp-tools.json` is the machine registry for required MCP servers. Schema version is `6`. Current setup registry contains required MCP tools such as `sequential-thinking` and `context7`.

Generated runtime mirrors under `.claude/`, `.codex/`, and `.agents/skills/` are not source. If setup prose or scripts change, update source first and use `spec-first init` only for runtime regeneration.

## Required Harness Runtime

`mcp-tools.json` owns required MCP server definitions only. Required helper tooling outside `mcp-tools.json` is installed and verified by `install-helpers.*` and `check-health`, then recorded under `helper_tools` in setup facts.

Required helper tooling must not be added to `mcp-tools.json`. Current helper checks include `agent-browser` and ast-grep capability detection. Use `install-helpers.* --verify-only` for read-only verification, and use the install path only when setup explicitly needs repair. The agent-browser repair path may run `npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y`, should respect `NPM_CONFIG_REGISTRY`, and may run `agent-browser install --with-deps` when browser automation support is required.

## Project Preflight / Local Setup

Project-local setup writes `.spec-first/config/tool-facts.json`, `.spec-first/config/runtime-capabilities.json`, and when applicable `.spec-first/workspace/scenario-fingerprint-setup.json`. Scenario fingerprint wrapper failures are warn-and-continue: report `scenario_fingerprint_setup` status and keep the rest of setup actionable instead of blocking ordinary direct-evidence workflows.

## Workflow

1. Identify the current host: Claude Code uses `/spec:mcp-setup`; Codex uses `$spec-mcp-setup`.
2. If invoked from a parent workspace, select an explicit child repo or intentionally run setup for all supported child repos. Writes must stay within the selected target.
3. Read `mcp-tools.json`, validate schema version, and verify every required tool has deterministic install, host-config, detection, and summary metadata.
4. Run `detect-tools.*` or `install-mcp.*` as appropriate. Warm required package-backed MCP tools, write host config only through documented host targets, and record structured status.
5. Run `install-helpers.*` for required helper tooling and collect helper readiness facts.
6. Run `verify-tools.*` to write the readiness ledger, reconcile host pointer facts, write project setup facts, and render the grouped status block.
7. Report the status exactly enough for the user to act: ready rows need no action; action-required rows name the missing dependency/config/target step.

## Output Shape

The final setup output should contain:

- `Execution result`: `Harness runtime` status and `baseline_ready`.
- `MCP servers`: required MCP tool dependency/host/project readiness and next action.
- `Helper tools`: helper install and readiness status.
- `Project setup facts`: status for `tool-facts.json` and `runtime-capabilities.json`.
- `Next steps`: either fix action-required rows, choose an explicit child repo, or continue to the user-intent workflow.

`tool-facts.json` records setup-owned tool and helper readiness:

```json
{
  "schema_version": "tool-facts.v1",
  "tools": {},
  "helper_tools": {},
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
- classify parent workspace target ambiguity and foreign residual indicators as advisory facts.

Setup does not:

- run code indexing, watchers, default hooks, or long-running daemons;
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
