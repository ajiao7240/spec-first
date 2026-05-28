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

Resolve repo scope, validate setup facts, run provider commands without shell interpolation, capture and normalize evidence, write canonical readiness artifacts, then hand off to the downstream workflow that matches the user's task.

### Downstream Consumers

`spec-plan`, `spec-work`, `spec-debug`, `spec-code-review`, `spec-doc-review`, and humans checking graph readiness.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

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

Do not infer semantic architecture conclusions or write project-guidance baselines here. After graph readiness is compiled, downstream workflows should use the readiness facts as advisory evidence and route by user intent into planning, work, debugging, review, or documentation workflows.

## Inputs

Required setup-owned inputs:

- `.spec-first/config/runtime-capabilities.json`
- host readiness ledger v2 referenced by `runtime-capabilities.json.host_ledger_pointer.path`
- `.spec-first/config/graph-providers.json`
- `.spec-first/config/provider-artifacts.json`

Optional invocation input:

- no argument from a parent workspace: default all-child-repos maintenance action.
- `--repo <child>` / `-Repo <child>` when the current directory is a parent workspace and the user wants one child only.
- `--all-repos` / `-AllRepos` as an explicit parent-workspace maintenance action. This is equivalent to the default parent-workspace no-argument behavior. It loops over discovered child Git repos, runs the existing child-scoped bootstrap flow, writes advisory `.spec-first/workspace/graph-bootstrap-summary.json`, `.spec-first/workspace/graph-targets.json`, and script-owned `.spec-first/workspace/gitnexus-readiness.json` summaries in the parent workspace when applicable, and records dry-run parent `AGENTS.md` / `CLAUDE.md` GitNexus instruction drift as advisory evidence when at least one child GitNexus bootstrap succeeds. Parent host instruction writes remain owned by `spec-first init`.
- `--incremental` / `-Incremental` as a clean single-repo diagnostic / validation-only expert refresh mode. It delegates to provider-native incremental commands when prior clean provider status can be trusted; otherwise it falls back to full refresh. Current validation does not establish it as a correctness-backed acceleration path.
- `--full` / `--force` or `-Full` / `-Force` as explicit full refresh mode. This is also the default for single-repo and all-repos runs.

Optional read-only workspace routing input:

- `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh` / `.ps1` may be used from a parent workspace to compile advisory `workspace-graph-targets.v1` facts for read-only GitNexus-first evidence selection and Gradle build-target coverage facts. This resolver does not run providers and does not create parent repo-local graph artifacts unless explicitly invoked with `--write-summary` / `-WriteSummary`, in which case it writes only `.spec-first/workspace/graph-targets.json` as an advisory control-plane summary.

## Workflow

1. Resolve the project target. In a Git repo, bootstrap that repo. In a parent workspace, bootstrap all child repos by default unless `--repo <child>` selects one child.
2. Validate setup-owned input schemas and host readiness ledger consistency.
3. Validate provider ids, command arrays, and GitNexus query probe policy shape before running any provider command.
4. Resolve refresh mode, then run configured provider bootstrap/incremental, status, and query proof commands without shell interpolation.
5. GitNexus bootstrap 成功后可调用 spec-first source CLI 以 dry-run 检测 `AGENTS.md` / `CLAUDE.md` 中的 GitNexus host instruction block drift；这是 host prose cleanup advisory，不是 graph readiness proof，不影响 `graph_ready` / `query_ready`，只作为 `host_instruction_normalization` advisory fact 写入 provider status。实际 host instruction 文件写入由 `spec-first init` 负责。
6. Write provider raw logs, provider status, normalized envelopes, canonical graph facts, impact capability facts, and a human-readable bootstrap report.
7. For parent workspace all-repos runs, compile `workspace-gitnexus-readiness.v1` in script mode from deterministic `workspace-graph-targets.v1` only. The durable summary may include `workspace_gitnexus_readiness_pointer.reason_code=script-mode-no-mcp`, four-key `query_usability_counts`, top-level `group_reason_code`, and `group.status="not-evaluated-no-mcp-input"`; it must not contain live `list_repos` / `group_list` evidence or overlay-only query usability count keys.
8. If useful for handoff and the current session has GitNexus MCP loaded, perform one bounded live MCP probe as session-local evidence only.

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

If required inputs are missing, schemas are unsupported, `baseline_ready=false`, or `graph-providers.json.providers` contains any provider key other than `gitnexus`, fail closed with machine-readable `workflow_mode` / `reason_code` and do not run provider commands. A stale provider projection that still contains `code-review-graph` returns `reason_code=stale-provider-projection`; rerun `$spec-mcp-setup` so setup rewrites the projection before running graph-bootstrap. Host pointer drift between `runtime-capabilities.json` and the host ledger is reconciled by `spec-mcp-setup` (advisory `host_pointer_reconciliation` event); bootstrap itself only validates that a host ledger pointer exists, is readable, has `schema_version=v2`, and that `baseline_ready=true`.

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

The resolver emits `schema_version=workspace-graph-targets.v1`, top-level `git_root_topology` (`single-repo`, `multi-repo-workspace`, or `null` for blocked target-resolution), per-child compatibility `status` values such as `primary`, `degraded-fallback`, `no-source`, `dirty-uncertain`, `stale`, `setup-ready-bootstrap-required`, or `unavailable`, additive GitNexus-aware fields `refresh_eligibility`, `index_snapshot`, `query_usability`, and `working_tree_overlay`, plus Gradle P4 build-target fields `non_git_build_modules[]`, `coverage_summary`, `coverage_inference`, `coverage_reason_code`, and `graph_coverage_class`. Downstream LLM workflows use this output to choose bounded candidate repos for read-only GitNexus-first evidence and disclose build-target coverage gaps; scripts still do not decide semantic repo relevance.

Gradle build-target awareness is a deterministic fact scan only. The resolver parses static Groovy `settings.gradle` `include ':module'` directives, reports `coverage_inference=skipped` for `settings.gradle.kts`, composite builds, missing settings files, or parse failures, and never attempts to run GitNexus against non-Git module directories.

For parent workspace GitNexus group/readiness decisions, prefer the new `refresh_eligibility` / `index_snapshot` / `query_usability` fields when present and keep old `status` as a compatibility label. `dirty-source-blocked` is a refresh limitation, not proof that existing GitNexus query evidence is unusable; stale or dirty index evidence must be disclosed and verified with direct source reads before final conclusions.

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

The parent-workspace default and `--all-repos` / `-AllRepos` preserve per-child partial success, write child repo canonical artifacts only, and write parent summaries under `.spec-first/workspace/` as advisory control-plane evidence. `graph-bootstrap-summary.json` includes legacy ready/degraded/not-applicable/action-required counts plus helper-owned `query_usability_counts`, `workspace_gitnexus_readiness_pointer`, nested `group`, top-level `group_reason_code`, `fingerprint_setup_missing`, and P5-min `quality_signals.{child_count, process_results_rate, command_failed_rate, dirty_advisory_child_rate}`. These quality signals are deterministic evaluation inputs only; they do not decide workflow routing or provider readiness. `graph-targets.json` is the deterministic workspace target snapshot and now carries Gradle build-target coverage facts when static Groovy settings are present. `gitnexus-readiness.json` is script-owned and never contains live MCP `list_repos` / `group_list` results; in script mode `group.status` remains `not-evaluated-no-mcp-input`. Parent all-repos runs may also dry-run the parent `AGENTS.md` / `CLAUDE.md` GitNexus instruction normalizer after a child GitNexus bootstrap succeeds; this host prose drift check is recorded as `parent_host_instruction_normalization` and does not write parent host instruction files or create parent `.spec-first/graph/*`, `.spec-first/impact/*`, or `.spec-first/providers/*` artifacts. If drift is detected, run `spec-first init` with the target host selected from the parent workspace to refresh host instructions through the source-owned generator.

After graph facts are written, graph-bootstrap best-effort calls `spec-first internal compute-scenario-fingerprint --layer bootstrap` to merge the setup fingerprint into `.spec-first/workspace/scenario-fingerprint.json` (`developer-scenario-fingerprint.v1`). When `.spec-first/workspace/graph-targets.json` contains P4 coverage facts, the bootstrap fingerprint fills `topology.git_misaligned_build_targets`, `topology.build_target_coverage_ratio`, and `topology.graph_coverage_class`; otherwise those fields remain null with a reason code. If `.spec-first/workspace/scenario-fingerprint-setup.json` is missing, graph-bootstrap records `fingerprint_setup_missing: true`, does not synthesize the bootstrap fingerprint, and continues the provider bootstrap path.

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

Allowed minimum command shapes are GitNexus-only:

```json
{
  "gitnexus": {
    "commands": {
      "bootstrap": ["npx", "-y", "<configured-gitnexus-package>", "analyze", "--force", "--skip-agents-md", "--no-stats"],
      "incremental": ["npx", "-y", "<configured-gitnexus-package>", "analyze", "--skip-agents-md", "--no-stats"],
      "status": ["npx", "-y", "<configured-gitnexus-package>", "status"],
      "query_probe": ["npx", "-y", "<configured-gitnexus-package>", "query", "<expected-source-basename>", "--repo", "<repo-name>"]
    }
  }
}
```

The current display forms are `npx -y <configured-gitnexus-package> analyze --force --skip-agents-md --no-stats`, `npx -y <configured-gitnexus-package> analyze --skip-agents-md --no-stats`, `npx -y <configured-gitnexus-package> status`, and `npx -y <configured-gitnexus-package> query <expected-source-basename> --repo <repo-name>`; the script still executes the validated arrays from `graph-providers.json`, not these prose strings. The bootstrap script owns the safety allowlist (provider id, executable, package name, and subcommand shape); `mcp-tools.json` remains the package/version source, and `graph-providers.json` remains the projected command argv source. GitNexus analyze commands use `--skip-agents-md --no-stats` so provider indexing does not write volatile host-instruction prose; the spec-first GitNexus instruction normalizer remains the owner of stable `AGENTS.md` / `CLAUDE.md` block updates.

Reject string commands, `bash -c`, `sh -c`, and unsupported executable/package shapes. Shell metacharacters inside an array argument must not be interpreted by a shell.

After successful GitNexus bootstrap, call the spec-first CLI GitNexus instruction normalizer in **dry-run mode** (without `--write`) to detect drift between existing `AGENTS.md` / `CLAUDE.md` host blocks and the current stable template. If drift is detected, record `host_instruction_normalization.status` as `"drift-detected"` in advisory evidence; if only one marker exists, report a partial-block advisory failure and do not guess the repair. Graph bootstrap does **not** write host instruction files — that ownership belongs to `spec-first init`. The renderer lives in `src/cli/gitnexus-instruction-block.js`; the Bash/PowerShell bootstrap scripts must not duplicate the block prose. The stable block omits dynamic index counts, avoids host-specific runtime skill paths, and uses `graph-facts.json` capability checks as the single readiness entry point.

## Refresh Modes

The default refresh mode is `full` for both single-repo and all-repos runs. `--incremental` / `-Incremental` is an explicit diagnostic / validation-only expert path for clean single-repo operators after commit or merge when current query/review evidence is needed. Current validation does not establish it as a correctness-backed acceleration path.

Refresh mode behavior:

- `full`: runs GitNexus `analyze --force --skip-agents-md --no-stats`; writes `readiness_source=cold-run`.
- `incremental`: runs GitNexus `analyze --skip-agents-md --no-stats`; writes `readiness_source=incremental-update` when the incremental command form ran.
- incremental fallback success: if the incremental command fails and the fallback full refresh succeeds, writes `readiness_source=incremental-fallback-full`, `refresh_mode=incremental-fallback-full`, and `fallback_from_incremental=true`.
- incremental and fallback full both fail: writes current per-provider failure status with `refresh_mode=failed`, sets `requires_clean_full_refresh=true`, preserves previous aggregate canonical freshness artifacts when present, and returns `reason_code=incremental-and-full-failed`.
- dirty worktree with graph-affecting paths: emits a visible warning to stderr listing up to 20 graph-affecting dirty paths, then continues through GitNexus provider commands (warn-and-continue); writes `dirty_classification=graph-affecting-blocked`, `freshness_state=dirty-advisory`, `source_revision_dirty=true`, and `overall_status=ready-dirty-advisory` into canonical artifacts; if `--incremental` was requested, downgrades to full refresh and writes `refresh_mode=full-dirty-fallback`. Does not block or exit before provider commands. Legacy `dirty-source-blocked` reason code is no longer emitted; historical command results containing it are treated as dirty-uncertain by consumers.
- dirty worktree with setup-owned paths only: continues through provider commands and writes `dirty_classification=setup-owned-only` plus `dirty_paths_breakdown` into `graph-facts.v1`; `worktree_dirty=true` and `worktree_status_hash` remain the downstream freshness inputs.
- dirty worktree with only changelog metadata plus optional setup-owned paths: continues through provider commands and writes `dirty_classification=non-graph-only` plus `dirty_paths_breakdown.non_graph_metadata_count`; this is a narrow changelog exemption, not a docs-wide exemption.

If a dirty generated runtime file is still tracked in git and falls outside the setup-owned dirty contract, rerun `spec-first init` with the target host selected in that child repo first. Init owns the one-time `git rm --cached` cleanup for managed runtime paths; graph-bootstrap should not repair git index state inline.

## Dirty Classification

The setup-owned dirty source-of-truth is `docs/contracts/graph-provider-consumption.md#setup-owned-dirty-ignorev1`. The bootstrap scripts mirror that path-prefix list in Bash and PowerShell constants, and contract tests keep the sets equivalent.

Setup-owned dirty includes `.spec-first/`, `.gitnexus/`, `.code-review-graph/`, `.codex/spec-first/`, `.claude/spec-first/`, `.agents/skills/`, and only the spec-first managed blocks inside `AGENTS.md`, `CLAUDE.md`, and `.gitignore`. Non-graph metadata dirty is limited to `CHANGELOG.md` and `docs/变更日志.md`; those paths may pass the dirty gate as `non-graph-only`, but broader docs remain graph-affecting by default. Managed-block checks allow marker-adjacent blank-only separators produced by init, but fail closed for malformed, duplicate, or non-blank user-region marker changes.

Graph-affecting dirty uses warn-and-continue: provider commands run, canonical artifacts are written with `freshness_state=dirty-advisory`, and no `--allow-dirty` / `-AllowDirty` flag is needed. The legacy `dirty-source-blocked` reason code is no longer emitted; historical command results containing it are treated as dirty-uncertain by consumers. The legacy `dirty-refresh-non-canonical` reason code is compatibility-only for historical command results; new bootstrap logic does not write it.

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

GitNexus can be `reuse_eligible=true` only when the setup-projected package in `graph-providers.json` matches the bundled package/version from `skills/spec-mcp-setup/mcp-tools.json`, which records `version_policy=pinned`. If the projected package differs from the bundled package, bootstrap fails closed before running provider commands with `readiness_source=preflight-blocked`, `failure_class=provider-projection-stale`, `failed_phase=preflight`, and `reason_code=gitnexus-provider-projection-stale`. The recommended action is to rerun `spec-mcp-setup` so setup refreshes the projected provider command argv.

## Readiness Evidence

`query_ready=true` requires all three provider-specific evidence levels:

1. Build/analyze command succeeds.
2. Status command succeeds.
3. Provider-specific query-surface proof succeeds.

If analyze and status succeed but query-surface proof is missing, unsupported, or fails, write `status=query-unverified`, keep `query_ready=false`, and include diagnostics plus raw log pointers. Do not infer query readiness from analyze exit code alone. For GitNexus, Level 3 is fail-closed: each query log must not contain FTS/read-only/missing-index diagnostics, the query JSON must parse, and at least one bounded candidate probe must return either non-empty `processes` / `process_symbols` or non-empty `definitions`. `process-results` proves process graph query/context orientation. `definitions-only` proves query/context orientation only: record `result_class=definitions-only`, set `query_ready=true`, and preserve limitations that process graph, Git diff, impact evidence, and related-test evidence are unavailable. The script must not decide that a repo is a documentation library by file extensions, Git status, or `target_kind`; downstream LLM workflows decide whether definitions-only evidence matches the user's task. Normalized artifacts for definitions-only evidence must not claim `execution_flow`, `impact_radius`, or review-impact support. If `query_probe_policy.expected_hit=false` because setup found no source-derived probe candidate and the attempted query still returns no process or definitions evidence, record `status=query-not-applicable`, keep `query_ready=false`, and let the single-repo workflow report `workflow_mode=no-source` / `overall_status=not-applicable` instead of treating the child as degraded.

GitNexus candidate probing is bounded and deterministic:

- `spec-mcp-setup` may provide `query_probe_policy.candidates[]` while preserving legacy `query_probe_policy.token`.
- `spec-graph-bootstrap` may try the ordered candidate list up to its consumer-side limit, stopping at the first query-ready result (`process-results` or `definitions-only`).
- The current GitNexus consumer-side candidate limit is 5; if more candidates are provided, provider status records `query_probe_candidates_truncated=true` and `query_probe_candidate_limit=5`.
- The first GitNexus candidate writes `.spec-first/providers/gitnexus/raw/query.log`; later candidates write `query-2.log`, `query-3.log`, and so on.
- Provider status records `query_probe_attempts[]` with token, source path, reason code, exit code, result class, verification reason, and raw log.
- Normalized GitNexus envelopes include attempted query logs and `winning_query_probe_log` when a later candidate is the first process result; definitions-only query-ready evidence has no process-winning log.
- Candidate probing must not become broad search; keep it small and source-derived so scripts prepare facts and LLMs decide how to use them.
- Parent all-repos summaries count `no-source` / `not-applicable` children separately from degraded children; a README-only child repo should not make code-bearing children look degraded.

Provider commands may trigger first-use package downloads. Progress hints go to stderr, while stdout remains the final JSON result and raw provider output remains in `.spec-first/providers/<provider>/raw/*`. Parent all-repos runs also emit child start/finish progress to stderr and stamp `.spec-first/workspace/graph-bootstrap-summary.json` with a `run_id`; every `results[]` child row carries the same `parent_run_id` for log correlation.

## Live MCP Probe

The deterministic bootstrap script cannot call host MCP tools. It only proves CLI-level provider readiness and writes compiled facts. After the script finishes, the LLM should run a bounded live MCP probe when the current session exposes the relevant MCP tool and the result would clarify the final handoff.

For GitNexus specifically:

- If `gitnexus` has `status=query-unverified`, `graph_ready=true`, and `query_ready=false`, do not describe this as a live MCP failure. It means the bootstrap CLI query probe failed.
- If the current session has GitNexus MCP tools loaded, try exactly one concrete live MCP call such as `gitnexus_query`, `gitnexus_context`, or `gitnexus_impact` using the first `query_probe_attempts[]` token whose `result_class` is `process-results`; if there is no successful attempt, use the first meaningful expected-hit token from `query_probe_policy.candidates[]` / `query_probe_policy.token` or the user's concrete question. Do not loop, retry broadly, or turn live MCP probing into a gate for compiled readiness.
- Treat a successful live MCP response as session-local evidence only. Do not rewrite `.spec-first/graph/*`, do not set compiled `query_ready=true` from live MCP evidence, and do not change `graph-providers.json`.
- If live GitNexus returns `definitions` but no `processes` / `process_symbols`, classify the probe as `partial-definitions-only`, not `failed`. Definitions-only evidence can help locate files or symbols, but it is not process graph, impact, or review-impact evidence.
- If the MCP tool is unavailable or fails, state that live MCP was unavailable or failed, then continue with bounded direct repo reads, git diff, ast-grep, tests, and logs as applicable.
- If the host was just configured by `spec-mcp-setup`, remind the user that Claude Code / Codex usually needs a restart or a new session before newly written MCP servers are loaded.

When live MCP probing is attempted or would clarify an otherwise degraded GitNexus result, update the final user-facing result table with separate compiled and session-local columns. The table must preserve the canonical CLI readiness values while showing the current session's MCP evidence:

| Provider | CLI graph_ready | CLI query_ready | Probe Token | CLI Evidence | Live MCP Probe | Final Use |
|---|---:|---:|---|---|---|---|
| gitnexus | `<true/false>` | `<true/false>` | `<winning attempt or query_probe_policy token>` | `process results/definitions-only/FTS diagnostic/empty/unparseable` | `passed/partial-definitions-only/failed/unavailable/not loaded/not attempted` | `<session-local MCP guidance plus compiled readiness caveat>` |

Do not collapse `Live MCP Probe=passed` into `CLI query_ready=true`. If live MCP succeeds while compiled GitNexus `query_ready=false`, say that GitNexus MCP may be used in the current session, but downstream compiled facts still remain degraded or query-unverified.

For a multi-repo parent workspace, keep durable workspace readiness and live GitNexus workspace evidence as two layers:

1. First read `.spec-first/workspace/graph-bootstrap-summary.json`, `.spec-first/workspace/graph-targets.json`, and `.spec-first/workspace/gitnexus-readiness.json` if present. Treat these as script-owned facts.
2. If GitNexus MCP is available in the current session, call `list_repos` once and `group_list` once, sanitize the JSON payloads, then run `skills/spec-graph-bootstrap/scripts/compile-workspace-gitnexus-readiness.sh --mode skill-prose --workspace-targets .spec-first/workspace/graph-targets.json --registry-list <sanitized-list-repos.json> --group-list <sanitized-group-list.json>`.
3. Treat the classifier stdout as session-local `runtime_mcp_overlay`; it may report `group.status="group-ready"` with `recommended_query_path="group-query"`, `group.status="group-missing"` / `group-sync-required` with `recommended_query_path="bounded-registry-fanout"`, or `group.status="unavailable"` with `recommended_query_path="bounded-registry-fanout"` when registry evidence is still usable.
4. Do not write the live overlay back into `.spec-first/workspace/gitnexus-readiness.json`, `graph-bootstrap-summary.json`, child provider status, or `.spec-first/graph/*`.
5. Do not run `group_sync` automatically. If group config is missing, report bounded registry/per-repo fallback; if group config exists but registry freshness is unclear, give a preview-first next action.

## Final Response Contract

Always report the compiled artifacts first, then any session-local live MCP evidence:

1. For a single repo, summarize `workflow_mode`, `overall_status`, provider `graph_ready/query_ready`, key `reason_code`, and the canonical artifact paths.
2. For parent workspace all-repos runs, summarize `run_id`, total child count, ready/degraded/not-applicable/action-required counts, per-child status, P5-min `quality_signals`, `query_usability_counts`, `workspace_gitnexus_readiness_pointer.reason_code`, `group.status`, `group_reason_code`, and whether `fingerprint_setup_missing` blocked bootstrap fingerprint generation. Keep parent `.spec-first/workspace/graph-bootstrap-summary.json` explicitly advisory.
   - Use two separate tables: `Child refresh status` for per-child `overall_status` / `reason_code` / refresh eligibility, and `GitNexus query usability` for `query_usability_counts` / `group.status` / `recommended_query_path` / limitations.
3. If parent workspace live GitNexus MCP evidence was evaluated, show it as a separate session-local `runtime_mcp_overlay` layer with `recommended_query_path`. Do not imply the durable readiness file contains live group readiness.
4. If any GitNexus provider is `query-unverified` or the live MCP probe was attempted, include the separate compiled-vs-session table from the Live MCP Probe section.
5. If the final answer mentions rerunning with elevated permissions, network repair, cache repair, restart/new session, or degraded fallback use, tie that advice to structured `reason_code`, `failure_class`, raw log paths, or live MCP evidence.
6. If any provider status has `host_instruction_normalization.status=drift-detected` or the parent summary has `parent_host_instruction_normalization.status=drift-detected`, include this exact final-response line: `- Host instruction drift detected (advisory). Run: spec-first init to refresh AGENTS.md / CLAUDE.md GitNexus blocks.`
7. Never rewrite or imply updated compiled readiness based on a live MCP response. A live MCP response is only current-session evidence for the LLM handoff.

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
.spec-first/providers/gitnexus/normalized/impact-capabilities.json
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
.spec-first/workspace/scenario-fingerprint.json
```

These workspace summaries are advisory control-plane evidence only. They do not replace child repo canonical graph facts.

`graph-providers.json.derived_readiness` and `runtime-capabilities.json.project_graph_readiness` are setup-owned projections pointing back to canonical artifacts. They are refreshed by `spec-mcp-setup` from `.spec-first/graph/` and `.spec-first/impact/`; graph-bootstrap must not mutate setup-owned config inputs to mark readiness.

## Failure Modes

- Missing config, unsupported schemas, baseline not ready, or readiness ledger conflict: fail closed before provider commands and emit `workflow_mode` / `reason_code`.
- Parent workspace target: default to all child repos, preserve child-scoped canonical artifacts, and write only advisory parent workspace summaries. If no child repos exist, return `workspace-no-git-candidates`.
- Unsupported provider id, command shape, or unsafe query probe policy: return `unsupported-provider-command` before running provider commands.
- Provider build failure: mark that provider failed, preserve raw logs, and use fallback workflow mode only when fallback capabilities are available.
- GitNexus host instruction normalization failure: record `host_instruction_normalization` as advisory evidence only. `drift-detected`, `gitnexus-instruction-block-partial`, `gitnexus-instruction-normalizer-failed`, and `gitnexus-instruction-normalizer-timeout` must not change provider `graph_ready` / `query_ready`; they only indicate host prose cleanup needs follow-up via `spec-first init`.
- GitNexus analyze storage write/open failure: if bootstrap diagnostics show `Cannot open file ... .gitnexus/lbug ... Error 3` or the Windows path variant, return `reason_code=gitnexus-analyze-storage-write-failed`, `failure_class=provider-storage-write-failed`, preserve `analyze.log`, and first recommend refreshing setup projection to the bundled GitNexus package before rerunning bootstrap. If the current bundled package still fails, treat it as provider storage/lock/permission recovery and require explicit human-scoped repair such as archiving/removing stale `.gitnexus`; do not auto-delete provider index state.
- Stale provider projection: if `graph-providers.json.providers` contains any key other than `gitnexus`, return `workflow_mode=action-required`, `reason_code=stale-provider-projection`, and recommend rerunning `$spec-mcp-setup` before graph-bootstrap. Do not run stale provider commands.
- GitNexus projection stale or unverifiable: if the setup-projected GitNexus package differs from the bundled package in `mcp-tools.json`, return `failure_class=provider-projection-stale`, `failed_phase=preflight`, and `reason_code=gitnexus-provider-projection-stale`.
- Build/status success with query proof failure: preserve `graph_ready=true` where status verified, keep `query_ready=false`, record limitations and raw logs. If GitNexus query fails because the setup-projected `--repo` label differs from `.gitnexus/meta.json` or git remote basename, write `reason_code=gitnexus-repo-label-mismatch` with an action to rerun `spec-mcp-setup` and then `spec-graph-bootstrap`; do not mutate setup-owned `graph-providers.json`.
- GitNexus FTS/read-only/missing-index query diagnostics: preserve `query_ready=false` and write a structured `recommended_action`. If the setup-projected GitNexus package differs from the bundled `spec-mcp-setup` tool contract, write `reason_code=gitnexus-query-provider-projection-stale` and recommend rerunning `spec-mcp-setup` before `spec-graph-bootstrap`; otherwise write `reason_code=gitnexus-query-fts-readonly` and recommend repairing GitNexus index storage/permissions or clean reanalysis with a fixed provider version. Do not mark the provider ready from build/status alone.
- Definitions-only GitNexus evidence: accept it as compiled `query_ready=true` for query/context orientation, while retaining limitations that process graph, Git diff, impact evidence, and related-test evidence are unavailable. Scripts record this deterministic result class only; downstream LLM workflows decide whether it satisfies a documentation-library or file-location task.
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
