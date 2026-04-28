---
name: spec-graph-bootstrap
description: Compile project graph readiness facts after spec-mcp-setup has prepared the host runtime and provider configuration.
argument-hint: ""
---

# Graph Readiness Compiler

Use this workflow after `/spec:mcp-setup` or `$spec-mcp-setup` reports `baseline_ready=true`.

This workflow owns project graph readiness compilation. `spec-mcp-setup` installs/configures the harness runtime and writes setup-owned facts; `spec-graph-bootstrap` consumes those facts, transiently runs configured external graph-provider command arrays, captures evidence, and writes canonical project readiness artifacts.

## Contract

Read these setup-owned machine facts before doing any graph work:

1. `.spec-first/config/runtime-capabilities.json`
   - schema: `runtime-capabilities.v1`
   - contains `baseline_ready`, `host_ledger_pointer`, fallback runtime facts, and a derived `project_graph_readiness` summary
2. Host readiness ledger v2 referenced by `runtime-capabilities.json`
   - graph-bootstrap must follow `host_ledger_pointer.path`
   - graph-bootstrap must not guess Claude/Codex ledger paths independently
3. `.spec-first/config/graph-providers.json`
   - schema: `graph-providers.v1`
   - contains provider configuration, artifact pointers, and provider command arrays under `providers.<id>.commands`
4. `.spec-first/config/provider-artifacts.json`
   - schema: `provider-artifacts.v1`
   - contains provider raw/normalized/status path contracts and canonical graph/impact artifact paths

Allowed provider ids are:

- `gitnexus`
- `code-review-graph`

If required inputs are missing, schemas are unsupported, `baseline_ready=false`, or `runtime-capabilities.json` disagrees with the pointed host ledger, fail closed with machine-readable `workflow_mode` / `reason_code` and do not run provider commands.

Do not read or depend on any top-level `crg` field. The retired internal CRG runtime, `src/crg/`, `graph.db`, and the retired internal graph CLI are not part of this workflow.

## Execution

Run the deterministic bootstrap script from the repo root:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
```

On Windows:

```powershell
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1
```

PowerShell parity v1 is source-contract parity in automated tests; shell behavior tests are the primary executable verification path until a Windows runner is available.

## Provider Command Safety

Provider command arrays are config-defined, but they are not arbitrary shell commands.

`spec-graph-bootstrap` must:

1. Treat command definitions as arrays, never strings to eval.
2. Validate provider id against the allowlist above.
3. Validate executable and package shape against supported provider commands.
4. Execute without shell interpolation.
5. Fail closed with `reason_code=unsupported-provider-command` if command shape is unsupported.

Allowed minimum command shapes are:

```json
{
  "gitnexus": {
    "commands": {
      "bootstrap": ["npx", "-y", "gitnexus@latest", "analyze"],
      "status": ["npx", "-y", "gitnexus@latest", "status"],
      "query_probe": ["npx", "-y", "gitnexus@latest", "query", "spec-first-readiness-probe", "--repo", "<repo-name>"]
    }
  },
  "code-review-graph": {
    "commands": {
      "bootstrap": ["uvx", "--upgrade", "code-review-graph", "build"],
      "status": ["uvx", "--upgrade", "code-review-graph", "status"],
      "query_probe": ["uvx", "--upgrade", "code-review-graph", "status", "--repo", "<repo-root>"]
    }
  }
}
```

The display forms are `npx -y gitnexus@latest analyze`, `npx -y gitnexus@latest status`, `npx -y gitnexus@latest query spec-first-readiness-probe --repo <repo-name>`, `uvx --upgrade code-review-graph build`, and `uvx --upgrade code-review-graph status --repo <repo-root>`; the script still executes the validated arrays from `graph-providers.json`, not these prose strings. The bootstrap script owns the safety allowlist (provider id, executable, package name, and subcommand shape); `graph-providers.json` remains the command argv source.

Reject string commands, `bash -c`, `sh -c`, and unsupported executable/package shapes. Shell metacharacters inside an array argument must not be interpreted by a shell.

## Readiness Evidence

`query_ready=true` requires all three provider-specific evidence levels:

1. Build/analyze command succeeds.
2. Status command succeeds.
3. Provider-specific query-surface proof succeeds.

If build and status succeed but query-surface proof is missing, unsupported, or fails, write `status=query-unverified`, keep `query_ready=false`, and include diagnostics plus raw log pointers. Do not infer query readiness from build exit code alone. For `code-review-graph`, the Level 3 proof is intentionally conservative and may reuse its `status --repo` surface probe; treat it as provider readiness evidence, not semantic graph evidence.

## Outputs

Provider raw, normalized, and status artifacts live under `.spec-first/providers/<provider>/`:

```text
.spec-first/providers/gitnexus/raw/analyze.log
.spec-first/providers/gitnexus/raw/status.log
.spec-first/providers/gitnexus/raw/query.log
.spec-first/providers/gitnexus/status.json
.spec-first/providers/gitnexus/normalized/architecture-facts.json
.spec-first/providers/gitnexus/normalized/reuse-candidates.json
.spec-first/providers/code-review-graph/raw/build.log
.spec-first/providers/code-review-graph/raw/status.log
.spec-first/providers/code-review-graph/status.json
.spec-first/providers/code-review-graph/normalized/impact-capabilities.json
```

Canonical downstream artifacts live under `.spec-first/graph/` and `.spec-first/impact/`:

```text
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/graph/bootstrap-report.md
.spec-first/impact/bootstrap-impact-capabilities.json
```

`graph-providers.json.derived_readiness` and `runtime-capabilities.json.project_graph_readiness` are setup-owned projections pointing back to canonical artifacts. They are refreshed by `spec-mcp-setup` from `.spec-first/graph/` and `.spec-first/impact/`; graph-bootstrap must not mutate setup-owned config inputs to mark readiness.

## Boundaries

- Do not run the retired internal graph CLI.
- Do not run graph builds from `spec-mcp-setup`.
- Do not write readiness results back into setup-owned config inputs such as `.spec-first/config/graph-providers.json` or `.spec-first/config/runtime-capabilities.json`.
- Do not perform persistent installs: no `npm install -g`, no `uv tool install`, no shell profile edits, and no MCP host config edits.
- Do allow transient provider command execution after `spec-mcp-setup` has verified command availability and `graph-providers.json` command arrays pass safety validation.
- Do not write provider raw logs under `.spec-first/graph/raw/<provider>/`; provider projection belongs under `.spec-first/providers/<provider>/`.
- Do not generate glue contracts, context packs, task-level impact facts, review evidence, or semantic architecture/reuse/impact conclusions.
- If a provider build or probe fails, keep that provider `query_ready=false`, report limitations, retain raw logs, and let downstream workflows decide how to use fallback evidence.

## Downstream Use

`spec-plan` is the first downstream consumer in this phase. It reads `.spec-first/graph/graph-facts.json` and `.spec-first/impact/bootstrap-impact-capabilities.json` when present, reports graph readiness status, checks staleness against the current repo snapshot, and falls back to bounded direct repo reads when facts are unavailable, stale, blocked, or degraded.

The LLM still decides which evidence is relevant. Scripts only prepare and report deterministic graph readiness facts.
