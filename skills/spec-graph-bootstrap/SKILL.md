---
name: spec-graph-bootstrap
description: Build external graph-provider indexes after spec-mcp-setup has prepared the host runtime and provider projection.
argument-hint: ""
---

# Graph Provider Bootstrap

Use this workflow after `/spec:mcp-setup` or `$spec-mcp-setup` reports `baseline_ready=true`.

This workflow owns project graph construction. `spec-mcp-setup` only installs/configures the harness runtime and writes `.spec-first/config/graph-providers.json`; it must not run graph builds. First-time setup writes providers with `query_ready=false`. Repeated setup may preserve `query_ready=true` when a previous bootstrap is still valid and the provider setup remains ready.

## Contract

Read these two machine facts before doing any graph work:

1. Host readiness ledger v2:
   - Claude: `~/.claude/spec-first/host-setup.json`
   - Codex: `~/.codex/spec-first/host-setup.json`
2. Project provider projection:
   - `.spec-first/config/graph-providers.json`

The ledger must have:

```json
{
  "schema_version": "v2",
  "baseline_ready": true
}
```

The provider projection must have `schema_version="graph-providers.v1"` and provider entries for:

- `gitnexus`
- `code-review-graph`

Do not read or depend on any top-level `crg` field. The retired internal CRG runtime is not part of this workflow.

## Execution

Run the deterministic bootstrap script from the repo root:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
```

On Windows:

```powershell
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1
```

The script runs only the project graph build commands owned by this workflow:

- `npx -y gitnexus@latest analyze`
- `uvx code-review-graph build`

After each provider succeeds, the script updates `.spec-first/config/graph-providers.json`:

```json
{
  "query_ready": true,
  "bootstrap_required": false,
  "next_action": ""
}
```

It also records bootstrap metadata such as `last_bootstrapped_at`. Re-running `spec-mcp-setup` must preserve these readiness facts while the provider setup remains ready.

## Boundaries

- Do not run the retired internal graph CLI.
- Do not run graph builds from `spec-mcp-setup`.
- Do not treat `.spec-first/config/graph-providers.json` as a registry; it is a project-local provider selection projection.
- If a provider build fails, keep that provider `query_ready=false`, report the failed command, and ask the user to fix the provider before downstream workflows rely on graph context.

## Downstream Use

After bootstrap succeeds, planning, work, and review workflows may query the configured graph providers as evidence. The LLM still decides which graph evidence is relevant; scripts only prepare and report deterministic graph readiness facts.
