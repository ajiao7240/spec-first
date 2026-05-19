---
name: spec-graph-bootstrap
description: Compile project graph readiness facts after spec-mcp-setup has prepared the host runtime and provider configuration.
argument-hint: ""
---

# Graph Readiness Compiler

## Workflow Contract Summary

### When To Use

Use after setup baseline is ready, or when the user asks to compile, refresh, verify, or diagnose project graph-provider readiness facts for downstream workflows.

### When Not To Use

Do not use to install MCP servers, repair host config, compile standards, review code/docs, plan or implement features, or draw semantic architecture conclusions.

### Inputs

Setup-owned runtime capabilities, host readiness ledger pointer, graph provider config, provider artifact contracts, optional repo/all-repos/incremental/full flags, and current git/workspace scope.

### Outputs

Canonical graph/provider/impact readiness artifacts, bounded provider raw logs, normalized envelopes, bootstrap reports, and explicit stale/degraded reason codes.

### Artifacts

Child-local `.spec-first/graph/*`, `.spec-first/providers/*`, `.spec-first/impact/*`, and parent advisory `.spec-first/workspace/*` summaries for multi-repo maintenance.

### Failure Modes

Missing setup facts, `baseline_ready=false`, invalid provider config, provider command failure, stale fingerprint, unsafe parent workspace write, or explicit recovery action required.

### Workflow

Resolve repo scope, validate setup facts, run provider commands without shell interpolation, capture and normalize evidence, write canonical readiness artifacts, then hand off to standards or downstream work.

### Downstream Consumers

`spec-standards`, `spec-plan`, `spec-work`, `spec-debug`, `spec-code-review`, `spec-doc-review`, and humans checking graph readiness.

## Purpose

This workflow owns project graph readiness compilation. `spec-mcp-setup` installs/configures the harness runtime and writes setup-owned facts; `spec-graph-bootstrap` consumes those facts, transiently runs configured external graph-provider command arrays, captures evidence, and writes canonical project readiness artifacts.

## Refresh Ownership

`spec-graph-bootstrap` is the only default local workflow that may refresh canonical project graph readiness artifacts: child-local `.spec-first/graph/*`, `.spec-first/providers/*`, and `.spec-first/impact/*`. Its refresh work may reuse verified provider facts or run provider analyze/build/status/query-proof commands, but that side effect belongs here, not inside plan, work, debug, review, setup, startup reminder, branch switching, or reviewer subagents.

branch switch, pull, rebase, merge, dirty worktree changes, `source_revision` mismatch, `worktree_status_hash` mismatch, and provider fingerprint mismatch are freshness invalidation signals for downstream consumers. They should become stale / bootstrap-required facts or `$spec-graph-bootstrap` handoff guidance; they are not automatic provider rebuild triggers.

GitNexus repair remains preview-first. Deleting `.gitnexus`, provider raw artifacts, or canonical readiness artifacts is an explicit recovery action tied to structured reason codes, not a normal bootstrap side effect hidden behind another workflow.

## When To Use

Use this workflow after `/spec:mcp-setup` or `$spec-mcp-setup` reports `baseline_ready=true` and graph bootstrap is still pending.

Use it when the user asks to compile, refresh, verify, or diagnose project graph-provider readiness facts for downstream spec-first workflows.

## When Not To Use

Do not use this workflow to install MCP servers, repair host config, update spec-first runtime assets, review code, plan features, or infer semantic architecture conclusions. Use `spec-mcp-setup`, `spec-update`, review, planning, or work workflows for those jobs.

Do not write repo-local graph artifacts into a parent workspace. When run from a parent workspace without `--repo`, the workflow defaults to the all-child-repos maintenance path and writes only parent advisory workspace summaries plus child-local canonical artifacts.

Do not compile standards or glue baselines here. After graph readiness is compiled, `spec-standards` owns standards artifacts: no-argument parent workspace runs batch child-local `.spec-first/standards/` baselines for discovered child repos, `spec-standards --repo <child>` narrows to one child, and `spec-standards --workspace` owns parent advisory standards artifacts.

## Inputs

Required setup-owned inputs:

- `.spec-first/config/runtime-capabilities.json`
- host readiness ledger v2 referenced by `runtime-capabilities.json.host_ledger_pointer.path`
- `.spec-first/config/graph-providers.json`
- `.spec-first/config/provider-artifacts.json`

Optional invocation input:

- no argument from a parent workspace: default all-child-repos maintenance action.
- `--repo <child>` / `-Repo <child>` when the current directory is a parent workspace and the user wants one child only.
- `--all-repos` / `-AllRepos` as an explicit parent-workspace maintenance action. This is equivalent to the default parent-workspace no-argument behavior. It loops over discovered child Git repos, runs the existing child-scoped bootstrap flow, writes an advisory `.spec-first/workspace/graph-bootstrap-summary.json` summary in the parent workspace, and refreshes existing parent `AGENTS.md` / `CLAUDE.md` GitNexus instruction blocks when at least one child GitNexus bootstrap succeeds.
- `--incremental` / `-Incremental` as a clean single-repo diagnostic / validation-only expert refresh mode. It delegates to provider-native incremental commands when prior clean provider status can be trusted; otherwise it falls back to full refresh. Current validation does not establish it as a correctness-backed acceleration path.
- `--full` / `--force` or `-Full` / `-Force` as explicit full refresh mode. This is also the default for single-repo and all-repos runs.

Optional read-only workspace routing input:

- `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh` / `.ps1` may be used from a parent workspace to compile advisory `workspace-graph-targets.v1` facts for read-only GitNexus-first evidence selection. This resolver does not run providers and does not create parent repo-local graph artifacts unless explicitly invoked with `--write-summary` / `-WriteSummary`, in which case it writes only `.spec-first/workspace/graph-targets.json` as an advisory control-plane summary.

## Workflow

1. Resolve the project target. In a Git repo, bootstrap that repo. In a parent workspace, bootstrap all child repos by default unless `--repo <child>` selects one child.
2. Validate setup-owned input schemas and host readiness ledger consistency.
3. Validate provider ids, command arrays, and GitNexus query probe policy shape before running any provider command.
4. Resolve refresh mode, then run configured provider bootstrap/incremental, status, and query proof commands without shell interpolation.
5. GitNexus bootstrap 成功后可调用 spec-first source CLI 收敛 `AGENTS.md` / `CLAUDE.md` 中的 GitNexus host instruction block；这是 host prose cleanup，不是 graph readiness proof，不影响 `graph_ready` / `query_ready`，只作为 `host_instruction_normalization` advisory fact 写入 provider status。
6. Write provider raw logs, provider status, normalized envelopes, canonical graph facts, impact capability facts, and a human-readable bootstrap report.
7. If useful for handoff and the current session has GitNexus MCP loaded, perform one bounded live MCP probe as session-local evidence only.

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

If required inputs are missing, schemas are unsupported, or `baseline_ready=false`, fail closed with machine-readable `workflow_mode` / `reason_code` and do not run provider commands. Host pointer drift between `runtime-capabilities.json` and the host ledger is reconciled by `spec-mcp-setup` (advisory `host_pointer_reconciliation` event); bootstrap itself only validates that a host ledger pointer exists, is readable, has `schema_version=v2`, and that `baseline_ready=true`.

Do not read or depend on any top-level `crg` field. The retired internal CRG runtime, `src/crg/`, `graph.db`, and the retired internal graph CLI are not part of this workflow.

## Execution

Run the deterministic bootstrap script from the repo root:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
```

From a parent workspace that contains multiple independent child Git repos, running without `--repo` defaults to all child repos:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
```

Pass a selected child only when narrowing the run:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --repo project-a
```

Explicit clean single-repo incremental refresh is available for expert diagnostics and validation:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --incremental
```

Force the default full refresh explicitly:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --full
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --force
```

For read-only target discovery from a parent workspace, run the advisory resolver instead of bootstrap:

```bash
bash skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh
```

The resolver emits `schema_version=workspace-graph-targets.v1`, per-child `status` values such as `primary`, `degraded-fallback`, `no-source`, `dirty-uncertain`, `stale`, `setup-ready-bootstrap-required`, or `unavailable`, GitNexus repo/query probe pointers, setup-owned config pointers, and canonical graph artifact pointers. Downstream LLM workflows use this output to choose bounded candidate repos for read-only GitNexus-first evidence; scripts still do not decide semantic repo relevance.

If every discovered child repo is `status=no-source`, the resolver reports `reason_code=workspace-graph-targets-no-source` instead of generic degraded. That preserves the distinction between “no code-bearing graph target exists” and “a code-bearing graph target failed readiness.”

Graph facts include a `worktree_status_hash` freshness fingerprint. The resolver uses it to distinguish a dirty worktree whose status matches bootstrap time from a genuinely changed dirty worktree; missing or mismatched dirty fingerprints become `dirty-uncertain`.

On Windows:

```powershell
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1
```

PowerShell with an explicit child repo:

```powershell
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1 -Repo project-a
```

PowerShell explicit refresh modes:

```powershell
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1 -Incremental
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1 -Full
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1 -Force
```

Explicit all-repos maintenance from a parent workspace is also supported and is equivalent to the parent-workspace default:

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --all-repos
```

```powershell
pwsh -File skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1 -AllRepos
```

The parent-workspace default and `--all-repos` / `-AllRepos` preserve per-child partial success, write child repo canonical artifacts only, and write the parent summary under `.spec-first/workspace/graph-bootstrap-summary.json` as advisory control-plane evidence. They may also normalize existing parent `AGENTS.md` / `CLAUDE.md` GitNexus instruction blocks after a child GitNexus bootstrap succeeds; this host prose cleanup is recorded as `parent_host_instruction_normalization` and does not create parent `.spec-first/graph/*`, `.spec-first/impact/*`, or `.spec-first/providers/*` artifacts.

`--all-repos --incremental` / `-AllRepos -Incremental` is unsupported in this contract. The same block applies when a parent workspace would otherwise enter the default all-repos path and the operator passes only `--incremental` / `-Incremental`. Both forms exit before provider commands with `reason_code=incremental-all-repos-unsupported` and preserve child canonical artifacts. Multi-repo incremental optimization requires a separate validation plan.

PowerShell read-only target discovery:

```powershell
pwsh -File skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1
```

PowerShell parity v1 is source-contract parity in automated tests; shell behavior tests are the primary executable verification path until a Windows runner is available.

If the current directory is a non-Git parent workspace and no `--repo` / `-Repo` is provided, run the all-child-repos maintenance path. If no child Git repos are discovered, fail before provider command validation or directory creation with `workflow_mode=blocked`, `reason_code=workspace-no-git-candidates`, and a `next_action` that asks for a Git repo or child repo. Parent workspaces must not receive `.spec-first/graph/*`, `.spec-first/impact/*`, or `.spec-first/providers/*` canonical project artifacts.

This parent-workspace bootstrap rule is separate from read-only workspace graph target discovery. The resolver may list all child repos and their graph readiness without running providers; bootstrap remains child-scoped internally and uses the all-child maintenance path only to loop over explicit child-scoped invocations.

## Provider Command Safety

Provider command arrays are config-defined, but they are not arbitrary shell commands. Provider package/version selection is not owned here: `spec-mcp-setup` projects the package specs from `skills/spec-mcp-setup/mcp-tools.json` into `.spec-first/config/graph-providers.json`, and this workflow only validates and executes that projected argv.

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
      "bootstrap": ["npx", "-y", "<configured-gitnexus-package>", "analyze", "--force", "--skip-agents-md", "--no-stats"],
      "incremental": ["npx", "-y", "<configured-gitnexus-package>", "analyze", "--skip-agents-md", "--no-stats"],
      "status": ["npx", "-y", "<configured-gitnexus-package>", "status"],
      "query_probe": ["npx", "-y", "<configured-gitnexus-package>", "query", "<expected-source-basename>", "--repo", "<repo-name>"]
    }
  },
  "code-review-graph": {
    "commands": {
      "bootstrap": ["uvx", "<configured-code-review-graph-package>", "build"],
      "incremental": ["uvx", "<configured-code-review-graph-package>", "update", "--base", "__SPEC_FIRST_LAST_INDEXED_COMMIT__"],
      "status": ["uvx", "<configured-code-review-graph-package>", "status"],
      "query_probe": ["uvx", "<configured-code-review-graph-package>", "status", "--repo", "<repo-root>"]
    }
  }
}
```

The current display forms are `npx -y <configured-gitnexus-package> analyze --force --skip-agents-md --no-stats`, `npx -y <configured-gitnexus-package> analyze --skip-agents-md --no-stats`, `npx -y <configured-gitnexus-package> status`, `npx -y <configured-gitnexus-package> query <expected-source-basename> --repo <repo-name>`, `uvx <configured-code-review-graph-package> build`, `uvx <configured-code-review-graph-package> update --base <last_indexed_commit>`, and `uvx <configured-code-review-graph-package> status --repo <repo-root>`; the script still executes the validated arrays from `graph-providers.json`, not these prose strings. The bootstrap script owns the safety allowlist (provider id, executable, package name, and subcommand shape); `mcp-tools.json` remains the package/version source, and `graph-providers.json` remains the projected command argv source. GitNexus analyze commands use `--skip-agents-md --no-stats` so provider indexing does not write volatile host-instruction prose; the spec-first GitNexus instruction normalizer remains the owner of stable `AGENTS.md` / `CLAUDE.md` block updates. The projected code-review-graph incremental command must contain the literal sentinel `__SPEC_FIRST_LAST_INDEXED_COMMIT__`; the runtime replacement value comes only from trusted per-provider status.

Reject string commands, `bash -c`, `sh -c`, and unsupported executable/package shapes. Shell metacharacters inside an array argument must not be interpreted by a shell.

After successful GitNexus bootstrap, call the spec-first CLI GitNexus instruction normalizer to ensure existing `AGENTS.md` / `CLAUDE.md` files contain the stable spec-first GitNexus evidence contract. If a host instruction file exists but lacks the GitNexus block, create it; if a provider refreshed a legacy block, rewrite it; if only one marker exists, report a partial-block advisory failure and do not guess the repair. Missing host instruction files remain `init` ownership and are not created by graph bootstrap. The renderer lives in `src/cli/gitnexus-instruction-block.js`; the Bash/PowerShell bootstrap scripts must not duplicate the block prose. The stable block omits dynamic index counts, avoids hard `MUST` / `NEVER` provider rules, avoids host-specific runtime skill paths, and frames GitNexus as freshness-aware evidence rather than a replacement for source reads, tests, or workflow judgment.

## Refresh Modes

The default refresh mode is `full` for both single-repo and all-repos runs. `--incremental` / `-Incremental` is an explicit diagnostic / validation-only expert path for clean single-repo operators after commit or merge when current query/review evidence is needed. Current validation does not establish it as a correctness-backed acceleration path.

Refresh mode behavior:

- `full`: runs GitNexus `analyze --force --skip-agents-md --no-stats` and code-review-graph `build`; writes `readiness_source=cold-run`.
- `incremental`: runs GitNexus `analyze --skip-agents-md --no-stats` and code-review-graph `update --base <last_indexed_commit>`; writes `readiness_source=incremental-update` when the incremental command form ran.
- incremental fallback success: if the incremental command fails and the fallback full refresh succeeds, writes `readiness_source=incremental-fallback-full`, `refresh_mode=incremental-fallback-full`, and `fallback_from_incremental=true`.
- incremental and fallback full both fail: writes current per-provider failure status with `refresh_mode=failed`, sets `requires_clean_full_refresh=true`, preserves previous aggregate canonical freshness artifacts when present, and returns `reason_code=incremental-and-full-failed`.
- dirty worktree: exits before provider commands with `reason_code=dirty-refresh-non-canonical` and `canonical_artifacts_preserved=true`; it does not run incremental or full provider refresh.

If the dirty source is a historical generated runtime file already tracked in git, such as `.codex/spec-first/.developer` or `.claude/spec-first/.developer`, rerun `spec-first init --codex` or `spec-first init --claude` in that child repo first. Init owns the one-time `git rm --cached` cleanup for managed runtime paths; graph-bootstrap should keep treating the dirty worktree as non-canonical evidence rather than repairing it inline.

Incremental preflight only trusts `.spec-first/providers/<provider>/status.json.last_indexed_commit` when the prior status is `provider-status.v1`, `graph_ready=true`, `query_ready=true`, clean, and tied to the same source revision in `repo_snapshot` and `bootstrap_fingerprint.repo_snapshot`. Missing, invalid, untrusted, non-existent, non-ancestor, provider-projection-changed, provider-changed, spec-first-changed, or `requires_clean_full_refresh=true` bases downgrade to full with the corresponding `reason_code`.

`graph-facts.v1` does not expose refresh-mode convenience fields. Per-provider `.spec-first/providers/<provider>/status.json.refresh_mode` is the truth source, and `.spec-first/graph/provider-status.json.providers[]` may mirror it for list-oriented consumers.

## Freshness, Timing, And Reuse Facts

The bootstrap scripts emit timing facts for observability only. The final result, `.spec-first/graph/provider-status.json`, `.spec-first/graph/graph-facts.json`, each provider status file, command results, and parent all-repos summaries include `timing.started_at`, `timing.finished_at`, and `timing.duration_ms` or equivalent per-row command fields. These values help identify slow provider phases; they are not readiness gates.

Each provider status also includes `readiness_source`, `reuse_eligible`, `reuse_ineligible_reason`, and `bootstrap_fingerprint`.

`bootstrap_fingerprint.schema_version=graph-bootstrap-fingerprint.v1` captures the deterministic invalidation inputs that a future fast path can compare:

- repo snapshot: `source_revision`, `worktree_dirty`, and `worktree_status_hash`
- spec-first source facts: package version, bootstrap script hash, and `mcp-tools.json` hash
- setup projection facts: `graph-providers.json`, `runtime-capabilities.json`, and `provider-artifacts.json` hashes
- provider command facts: provider id, command hash, configured package spec, bundled package spec, and version policy

Default full refresh still runs provider commands. Explicit `--incremental` may run provider-native incremental commands instead of full commands, but `readiness_source=incremental-update` means only that the incremental command form was used; it does not prove provider internals processed only a diff. `reuse_eligible=true` only means the provider has enough deterministic freshness facts to be considered by a later explicit fast path. Downstream LLM workflows must treat it as a script-owned fact, not as proof that the current run reused cached evidence.

GitNexus and `code-review-graph` can be `reuse_eligible=true` only when the setup-projected package in `graph-providers.json` matches the bundled package/version from `skills/spec-mcp-setup/mcp-tools.json`, which records `version_policy=pinned`. If the projected package differs from the bundled package, bootstrap fails closed before running that provider's commands with `readiness_source=preflight-blocked`, `failure_class=provider-projection-stale`, and `failed_phase=preflight`. GitNexus uses `reason_code=gitnexus-provider-projection-stale`; `code-review-graph` uses `reason_code=code-review-graph-provider-projection-stale`. If `code-review-graph` package identity is floating or cannot be verified from the bundled registry, bootstrap also fails closed before provider execution with `failure_class=provider-version-unverifiable` and `reason_code=code-review-graph-provider-version-unverifiable`. The recommended action is to rerun `spec-mcp-setup` so setup refreshes the projected provider command argv.

`code-review-graph` daily graph-bootstrap uses the pinned `uvx code-review-graph@<version>` command surface. Updating it means changing the source pin in `mcp-tools.json`, rerunning setup projection, and recording the change; `@latest` / `--refresh` belong to explicit update or probe work, not the default bootstrap path. After this fix, operators may reclaim older uv tool environments manually with `uv cache clean code-review-graph`; graph-bootstrap must not run cache cleanup automatically.

## Readiness Evidence

`query_ready=true` requires all three provider-specific evidence levels:

1. Build/analyze command succeeds.
2. Status command succeeds.
3. Provider-specific query-surface proof succeeds.

If build and status succeed but query-surface proof is missing, unsupported, or fails, write `status=query-unverified`, keep `query_ready=false`, and include diagnostics plus raw log pointers. Do not infer query readiness from build exit code alone. For GitNexus, Level 3 is fail-closed: each query log must not contain FTS/read-only/missing-index diagnostics, the query JSON must parse, and at least one bounded candidate probe must return non-empty `processes` or `process_symbols`. `definitions` is useful context but is not sufficient proof that the BM25/process query surface is healthy. If all expected-hit GitNexus candidates return definitions-only evidence or otherwise fail to produce process results, preserve `graph_ready=true` where status was verified, but keep `query_ready=false`. If `query_probe_policy.expected_hit=false` because setup found no source-derived probe candidate, record `status=query-not-applicable`, keep `query_ready=false`, and let the single-repo workflow report `workflow_mode=no-source` / `overall_status=not-applicable` instead of treating the child as degraded. For `code-review-graph`, the Level 3 proof is intentionally conservative and may reuse its `status --repo` surface probe; treat it as provider readiness evidence, not semantic graph evidence.

GitNexus candidate probing is bounded and deterministic:

- `spec-mcp-setup` may provide `query_probe_policy.candidates[]` while preserving legacy `query_probe_policy.token`.
- `spec-graph-bootstrap` may try the ordered candidate list up to its consumer-side limit, stopping at the first process result.
- The current GitNexus consumer-side candidate limit is 5; if more candidates are provided, provider status records `query_probe_candidates_truncated=true` and `query_probe_candidate_limit=5`.
- The first GitNexus candidate writes `.spec-first/providers/gitnexus/raw/query.log`; later candidates write `query-2.log`, `query-3.log`, and so on.
- Provider status records `query_probe_attempts[]` with token, source path, reason code, exit code, result class, verification reason, and raw log.
- Normalized GitNexus envelopes include attempted query logs and `winning_query_probe_log` when a later candidate is the first process result.
- Candidate probing must not become broad search; keep it small and source-derived so scripts prepare facts and LLMs decide how to use them.
- Parent all-repos summaries count `no-source` / `not-applicable` children separately from degraded children; a README-only child repo should not make code-bearing children look degraded.

Provider commands may trigger first-use package downloads. Progress hints go to stderr, while stdout remains the final JSON result and raw provider output remains in `.spec-first/providers/<provider>/raw/*`. Parent all-repos runs also emit child start/finish progress to stderr and stamp `.spec-first/workspace/graph-bootstrap-summary.json` with a `run_id`; every `results[]` child row carries the same `parent_run_id` for log correlation.

## Live MCP Probe

The deterministic bootstrap script cannot call host MCP tools. It only proves CLI-level provider readiness and writes compiled facts. After the script finishes, the LLM should run a bounded live MCP probe when the current session exposes the relevant MCP tool and the result would clarify the final handoff.

For GitNexus specifically:

- If `gitnexus` has `status=query-unverified`, `graph_ready=true`, and `query_ready=false`, do not describe this as a live MCP failure. It means the bootstrap CLI query probe failed.
- If the current session has GitNexus MCP tools loaded, try exactly one concrete live MCP call such as `gitnexus_query`, `gitnexus_context`, or `gitnexus_impact` using the first `query_probe_attempts[]` token whose `result_class` is `process-results`; if there is no successful attempt, use the first meaningful expected-hit token from `query_probe_policy.candidates[]` / `query_probe_policy.token` or the user's concrete question. Do not loop, retry broadly, or turn live MCP probing into a gate for compiled readiness.
- Treat a successful live MCP response as session-local evidence only. Do not rewrite `.spec-first/graph/*`, do not set compiled `query_ready=true`, and do not change `graph-providers.json`.
- If live GitNexus returns `definitions` but no `processes` / `process_symbols`, classify the probe as `partial-definitions-only`, not `failed`. Definitions-only evidence can help locate files or symbols, but it is not proof that the BM25/process query surface is healthy.
- If the MCP tool is unavailable or fails, state that live MCP was unavailable or failed, then continue with code-review-graph and bounded direct repo reads.
- If the host was just configured by `spec-mcp-setup`, remind the user that Claude Code / Codex usually needs a restart or a new session before newly written MCP servers are loaded.

When live MCP probing is attempted or would clarify an otherwise degraded GitNexus result, update the final user-facing result table with separate compiled and session-local columns. The table must preserve the canonical CLI readiness values while showing the current session's MCP evidence:

| Provider | CLI graph_ready | CLI query_ready | Probe Token | CLI Evidence | Live MCP Probe | Final Use |
|---|---:|---:|---|---|---|---|
| code-review-graph | `<true/false>` | `<true/false>` | `n/a` | `<status/query proof summary>` | `not applicable` | `<compiled readiness guidance>` |
| gitnexus | `<true/false>` | `<true/false>` | `<winning attempt or query_probe_policy token>` | `process results/definitions-only/FTS diagnostic/empty/unparseable` | `passed/partial-definitions-only/failed/unavailable/not loaded/not attempted` | `<session-local MCP guidance plus compiled readiness caveat>` |

Do not collapse `Live MCP Probe=passed` into `CLI query_ready=true`. If live MCP succeeds while compiled GitNexus `query_ready=false`, say that GitNexus MCP may be used in the current session, but downstream compiled facts still remain degraded or query-unverified.

## Final Response Contract

Always report the compiled artifacts first, then any session-local live MCP evidence:

1. For a single repo, summarize `workflow_mode`, `overall_status`, provider `graph_ready/query_ready`, key `reason_code`, and the canonical artifact paths.
2. For parent workspace all-repos runs, summarize `run_id`, total child count, ready/degraded/not-applicable/action-required counts, and per-child status. Keep parent `.spec-first/workspace/graph-bootstrap-summary.json` explicitly advisory.
3. If any GitNexus provider is `query-unverified` or the live MCP probe was attempted, include the separate compiled-vs-session table from the Live MCP Probe section. Do not omit this table just because code-review-graph is ready.
4. If the final answer mentions rerunning with elevated permissions, network repair, cache repair, restart/new session, or degraded fallback use, tie that advice to structured `reason_code`, `failure_class`, raw log paths, or live MCP evidence.
5. Never rewrite or imply updated compiled readiness based on a live MCP response. A live MCP response is only current-session evidence for the LLM handoff.

## Outputs

Provider raw, normalized, and status artifacts live under `.spec-first/providers/<provider>/`:

```text
.spec-first/providers/gitnexus/raw/analyze.log
.spec-first/providers/gitnexus/raw/status.log
.spec-first/providers/gitnexus/raw/query.log
.spec-first/providers/gitnexus/raw/query-2.log
.spec-first/providers/gitnexus/status.json
.spec-first/providers/gitnexus/normalized/architecture-facts.json
.spec-first/providers/gitnexus/normalized/reuse-candidates.json
.spec-first/providers/code-review-graph/raw/build.log
.spec-first/providers/code-review-graph/raw/status.log
.spec-first/providers/code-review-graph/status.json
.spec-first/providers/code-review-graph/normalized/impact-capabilities.json
```

`query-2.log` and later GitNexus query logs are present only when bounded candidate probing needs more than one token. `.spec-first/providers/gitnexus/status.json` records the canonical `query_probe_attempts[]` list for all attempted candidates.

Canonical downstream artifacts live under `.spec-first/graph/` and `.spec-first/impact/`:

```text
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/graph/bootstrap-report.md
.spec-first/impact/bootstrap-impact-capabilities.json
```

Parent workspace advisory summaries live under `.spec-first/workspace/`:

```text
.spec-first/workspace/graph-bootstrap-summary.json
.spec-first/workspace/graph-targets.json
```

These workspace summaries are advisory control-plane evidence only. They do not replace child repo canonical graph facts.

`graph-providers.json.derived_readiness` and `runtime-capabilities.json.project_graph_readiness` are setup-owned projections pointing back to canonical artifacts. They are refreshed by `spec-mcp-setup` from `.spec-first/graph/` and `.spec-first/impact/`; graph-bootstrap must not mutate setup-owned config inputs to mark readiness.

## Failure Modes

- Missing config, unsupported schemas, baseline not ready, or readiness ledger conflict: fail closed before provider commands and emit `workflow_mode` / `reason_code`.
- Parent workspace target: default to all child repos, preserve child-scoped canonical artifacts, and write only advisory parent workspace summaries. If no child repos exist, return `workspace-no-git-candidates`.
- Unsupported provider id, command shape, or unsafe query probe policy: return `unsupported-provider-command` before running provider commands.
- Provider build failure: mark that provider failed, preserve raw logs, and use fallback workflow mode only when fallback capabilities are available.
- GitNexus host instruction normalization failure: record `host_instruction_normalization` as advisory evidence only. `gitnexus-instruction-block-partial`, `gitnexus-instruction-normalizer-failed`, and `gitnexus-instruction-normalizer-timeout` must not change provider `graph_ready` / `query_ready`; they only indicate host prose cleanup needs follow-up.
- GitNexus analyze storage write/open failure: if bootstrap diagnostics show `Cannot open file ... .gitnexus/lbug ... Error 3` or the Windows path variant, return `reason_code=gitnexus-analyze-storage-write-failed`, `failure_class=provider-storage-write-failed`, preserve `analyze.log`, and first recommend refreshing setup projection to the bundled GitNexus package before rerunning bootstrap. If the current bundled package still fails, treat it as provider storage/lock/permission recovery and require explicit human-scoped repair such as archiving/removing stale `.gitnexus`; do not auto-delete provider index state.
- Provider projection stale or unverifiable: if the setup-projected package differs from the bundled package in `mcp-tools.json`, return `failure_class=provider-projection-stale`, `failed_phase=preflight`, and provider-specific reason codes such as `gitnexus-provider-projection-stale` or `code-review-graph-provider-projection-stale`; if the `code-review-graph` package identity is floating or unverifiable, return `failure_class=provider-version-unverifiable` with `reason_code=code-review-graph-provider-version-unverifiable`. Do not run stale or floating CRG provider commands.
- `code-review-graph` package resolution failure: if bootstrap diagnostics show the active Python package index cannot find `code-review-graph`, return `reason_code=provider-package-not-found`, `failure_class=provider-package-resolution-failed`, and recommend unsetting `UV_INDEX_URL` / `PIP_INDEX_URL` or using an index that contains `code-review-graph`. Do not silently override the user's package-index environment.
- Build/status success with query proof failure: preserve `graph_ready=true` where status verified, keep `query_ready=false`, record limitations and raw logs. If GitNexus query fails because the setup-projected `--repo` label differs from `.gitnexus/meta.json` or git remote basename, write `reason_code=gitnexus-repo-label-mismatch` with an action to rerun `spec-mcp-setup` and then `spec-graph-bootstrap`; do not mutate setup-owned `graph-providers.json`.
- GitNexus FTS/read-only/missing-index query diagnostics: preserve `query_ready=false` and write a structured `recommended_action`. If the setup-projected GitNexus package differs from the bundled `spec-mcp-setup` tool contract, write `reason_code=gitnexus-query-provider-projection-stale` and recommend rerunning `spec-mcp-setup` before `spec-graph-bootstrap`; otherwise write `reason_code=gitnexus-query-fts-readonly` and recommend repairing GitNexus index storage/permissions or clean reanalysis with a fixed provider version. Do not mark the provider ready from build/status alone.
- Definitions-only GitNexus evidence: use it only for local symbol/file pointers; do not mark compiled query readiness true.
- Concurrent worktree write inside the bootstrap window: bootstrap samples a filtered `git status --porcelain` fingerprint before and after the critical write window. The filter excludes paths bootstrap itself writes (`.spec-first/`, `.gitnexus/`, `.code-review-graph/`, `AGENTS.md`, `CLAUDE.md`) so the check only sees external-actor changes. If the post-window fingerprint differs from the pre-window one (another agent session, IDE save, or background task wrote inside the window), bootstrap returns `workflow_mode=blocked`, `reason_code=concurrent-write-detected`, `canonical_artifacts_preserved=false`, and exits 1. The next action is to coordinate the conflicting writer (commit/abort their work, or move the work into an isolated worktree via the internal `git-worktree` skill) and rerun bootstrap; bootstrap itself does not retry, lock, or interrupt the other writer.

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
