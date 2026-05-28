# Scenario Capability Matrix

> Lifecycle: current. Source-of-truth for advisory workflow capability interpretation from `developer-scenario-fingerprint.v1` and `developer-scenario-fingerprint-setup.v1`.

## Purpose

The scenario capability matrix translates deterministic scenario fingerprint facts into a compact workflow posture. Scripts prepare the fingerprint and graph-target facts; LLM workflows decide whether those facts are sufficient for the current user intent, which fallback to choose, and what limitations to disclose.

This matrix is advisory. It is not a hard gate, approval state, central workflow engine, or substitute for source reads, tests, logs, reviewer judgment, or user decisions.

## Inputs

Primary evidence:

- `.spec-first/workspace/scenario-fingerprint.json` (`developer-scenario-fingerprint.v1`)
- `.spec-first/workspace/scenario-fingerprint-setup.json` (`developer-scenario-fingerprint-setup.v1`)
- `.spec-first/workspace/graph-targets.json` (`workspace-graph-targets.v1`) when build-target coverage matters
- `.spec-first/graph/graph-facts.json`, `.spec-first/graph/provider-status.json`, and `.spec-first/impact/bootstrap-impact-capabilities.json` when graph readiness matters

Required shared fields:

- `advisory: true`
- `state_class`
- `scenario_class_provisional: true`
- `complexity_dimensions.*`
- `topology.*`
- `worktree.*`
- `providers_status_refs.*`
- `freshness.*`
- `limitations[]`

## Capability Classes

Allowed values:

- `full`: normal workflow path can use graph/source/test evidence without scenario-specific restrictions.
- `bounded`: workflow can proceed, but must keep repo/file scope explicit and disclose relevant limitations.
- `partial`: workflow can proceed for covered surfaces only; uncovered repo/build/provider surfaces require direct source fallback or explicit limitation.
- `fallback-only`: graph/provider/fingerprint facts are insufficient for claims that depend on them; use bounded direct source/test/log evidence or route to setup/bootstrap.
- `blocked-action-required`: do not perform writes, autofix, commits, root-cause claims, or graph-backed review claims until the named action is completed or the user explicitly accepts degraded evidence.

## Default Matrix

| Scenario class | Capability class | Required Evidence | Fallback path | LLM decision point |
| --- | --- | --- | --- | --- |
| `clean-single-repo` | `full` | Fresh fingerprint or setup layer; `complexity_dimensions.multi_repo_workspace=false`; provider refs when graph evidence is used | Normal workflow path | Decide which graph/source/test evidence matches the user intent |
| `dirty-single-repo` | `bounded` | `worktree.dirty_paths_sample[]`, `dirty_paths_breakdown`, and `worktree_dirty_graph_affecting` | Keep diff scope explicit; disclose dirty graph-affecting paths before commit/PR/review claims | Decide whether dirty state affects the requested workflow |
| `first-time-git-repo` | `fallback-only` | Missing or setup-only fingerprint plus first-time state facts; absence of prior graph artifacts | Recommend `spec-first init` / `$spec-mcp-setup` for setup-heavy goals; use direct reads for lightweight goals | Decide whether the task can proceed without setup-owned facts |
| `multi-repo-workspace` | `bounded` | `topology.child_repo_count`, child repo paths, and workspace graph-target facts when available | Require explicit `target_repo` or per-child scope before writes/tests/commits | Decide which child repo evidence is relevant |
| `multi-repo-dirty-workspace` | `partial` | Per-child dirty facts, `worktree.dirty_child_count`, and bounded dirty samples | Proceed only for explicitly scoped clean/understood child surfaces; disclose dirty children | Decide whether dirty children are in or out of scope |
| `foreign-residual-workspace` | `blocked-action-required` | `foreign_residual_indicators[]` and, when present, `parent-artifact-quarantine.v1` | Run `spec-first clean --workspace-orphans` preview and `spec-first init`, or get explicit degraded-evidence acceptance | Decide whether any local artifact can be trusted before action |
| `non-git-folder` | `partial` | `target_kind=non-git-folder`, folder snapshot/fingerprint, and no git revision facts | Use direct file reads and non-git verification; no git diff/impact claims | Decide whether non-git evidence is sufficient for the task |
| `non-git-build-workspace` | `partial` | `complexity_dimensions.non_git_build_targets_present`, `non_git_build_modules[]`, `coverage_summary`, and `graph_coverage_class` | Use graph evidence only for covered git roots; inspect uncovered build modules directly | Decide whether build-target coverage gaps matter for the request |
| `provider-degraded` | `fallback-only` | `providers_status_refs.*`, provider status/query limitations, and `freshness.graph_facts_freshness_state` | Route to `$spec-graph-bootstrap` for graph-heavy work or fall back to bounded direct reads/tests/logs | Decide whether provider evidence is optional or required |

## High-Risk Overrides

High-risk workflows are those that can mutate source, make review/debug claims with user-visible consequences, or route commits/PR handoffs. The first version applies overrides only to:

- `spec-work`
- `spec-code-review`
- `spec-debug`

Required high-risk overrides:

| Condition | Capability class | Required Evidence | Fallback path | LLM decision point |
| --- | --- | --- | --- | --- |
| `foreign-residual-workspace` or non-empty `foreign_residual_indicators[]` | `blocked-action-required` | Setup or bootstrap fingerprint plus residual indicators/quarantine path | Stop before writes/autofix/root-cause/review claims; run `spec-first clean --workspace-orphans` preview and `spec-first init`, or get explicit degraded-evidence acceptance | Decide whether continuing would rely on untrusted local artifacts |
| `unavailable-provider` condition, represented by `provider-degraded`, `providers_status_refs.*.query_ready=false`, or missing graph facts for graph-heavy claims | `fallback-only` | Provider refs/status, graph-facts freshness, and limitations | Use bounded direct source/test/log evidence; do not claim graph-backed impact, review coverage, or root cause | Decide whether graph evidence is required for the requested claim |
| `non-git-build-workspace` with `git_alignment_broken=true` or `graph_coverage_class=partial-build-targets` | `partial` | `graph-targets.json.coverage_summary` and uncovered build module list | Scope action to covered git roots or directly inspect uncovered build modules | Decide whether uncovered build targets are in scope |

## Default Workflow Declaration

Public workflows without a high-risk override declare:

```markdown
## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none
```

This declaration means the workflow consumes the default matrix as advisory context when scenario fingerprint facts are available. It does not require the workflow to read runtime mirrors, refresh graph artifacts, or block lightweight work when direct source evidence is sufficient.

## Boundaries

- Do not collapse scenario fields into a single risk score.
- Do not let scripts decide semantic workflow suitability.
- Do not treat missing fingerprints as failure for existing users; use the `using-spec-first` old-user grace path.
- Do not update generated runtime mirrors by hand; source workflow files under `skills/` are the truth source.
- Do not expand a plan, review scope, debug target, or work target solely because a scenario fact names an adjacent repo, provider, or build module.
