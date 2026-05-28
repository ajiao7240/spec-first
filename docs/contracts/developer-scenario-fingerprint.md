# Developer Scenario Fingerprint Contract

> Lifecycle: current. Source-of-truth for setup-time and bootstrap-time scenario fingerprint artifacts. PA-1 implements only `developer-scenario-fingerprint-setup.v1`; bootstrap merge fields are reserved for later units in `2026-05-28-002`.

## Purpose

Scenario fingerprints are deterministic advisory facts that describe the developer workspace shape before downstream workflows decide how much graph evidence is trustworthy. Scripts prepare these facts; LLM workflows decide routing, fallback, and risk posture.

Fingerprints are not gates, not approvals, and not provider internals. They stay outside `graph-facts.json` because they describe workspace/developer context, while graph facts remain child-repo/provider readiness facts.

## Setup Artifact

Path:

- `.spec-first/workspace/scenario-fingerprint-setup.json`

Schema:

- `schema_version`: fixed `developer-scenario-fingerprint-setup.v1`
- `advisory`: fixed `true`
- `layer`: fixed `setup`
- `state_class`: one provisional scenario class
- `scenario_class_provisional`: fixed `true` during M1
- `workspace_root`, `target_root`: POSIX-normalized paths
- `topology`: deterministic target and child repo facts
- `worktree`: dirty status, bounded dirty path sample, current revision hash when available
- `complexity_dimensions`: independent boolean vector; never collapse to a single score
- `providers_status_refs`: references provider readiness facts instead of copying provider internals
- `foreign_residual_indicators`: bounded evidence for stale/foreign local artifacts
- `freshness`: setup generation timestamp and source revision when available
- `tags`: derived labels for search/review ergonomics
- `limitations`: advisory caveats for downstream LLM judgment

## Provisional Scenario Classes

These labels are matrix interpretation classes, not durable classifiers:

- `clean-single-repo`
- `dirty-single-repo`
- `first-time-git-repo`
- `multi-repo-workspace`
- `multi-repo-dirty-workspace`
- `foreign-residual-workspace`
- `non-git-folder`
- `non-git-build-workspace`
- `provider-degraded`

New values require an RFC or plan update after M3 evidence review.

## Complexity Dimensions

All fields are boolean and independent:

- `multi_repo_workspace`
- `non_git_folder_target`
- `non_git_build_targets_present`
- `git_alignment_broken`
- `parent_repo_local_artifacts_present`
- `worktree_dirty_graph_affecting`
- `provider_query_degraded`

Downstream workflows choose which dimensions matter for the current user intent. No script may compute an aggregate risk score from these fields.

## Foreign Residual Rule

`foreign-residual-workspace` requires both:

- a referenced absolute path cannot be stat/read from the current machine; and
- the referenced path prefix is outside the current workspace root and current home directory.

A normal clone with missing `.spec-first/*` artifacts is `first-time-git-repo`, not `foreign-residual-workspace`.

## Cross-Platform Invariants

- All persisted path fields use POSIX separators (`/`).
- Bash and PowerShell wrappers call the Node helper instead of reimplementing JSON logic.
- Helper failures are warn-and-continue in setup; the readiness ledger records `scenario_fingerprint_setup.status="failed"` when possible.
- Existing schema versions are additive-only consumers: absence of this artifact must remain backward compatible.
