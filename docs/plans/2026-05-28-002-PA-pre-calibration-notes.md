---
title: "PA-pre Calibration Notes for Scenario-Adaptive Milestone"
type: calibration
status: completed
date: 2026-05-28
source_plan: docs/plans/2026-05-28-002-feat-spec-first-scenario-adaptive-milestone-plan.md
author: leokuang
---

# PA-pre Calibration Notes

## Conclusion

本轮校准支持继续采用“两层 fingerprint + 维度向量 + 外置 capability matrix”的设计,并足以作为 PA-1 setup-time fingerprint 的 **provisional freeze** 输入。当前已完成 2 个真实工作区的磁盘/既有 artifact 校验和 1 个合成 pnpm 样本;计划中的 ≥3 个真实使用场景 best-effort 拓扑调查在本地执行环境无法直接访问开发者反馈,因此记录为 limitation,不阻断 PA-1 首版实现。

因此本文件冻结的是 **v0.1 provisional** 候选集,供 PA-1 实现和审查使用;M3 证据回放后再决定是否通过 RFC 调整枚举或维度字段。

## 完成状态

已于 2026-05-29 标记为完成。本文档已经完成 scenario-adaptive milestone 的 PA-pre 校准输入职责；下方剩余 survey limitation 保留为历史证据边界和未来复核输入，不再代表本文档的待开发工作。

## Evidence Snapshot

| Sample | Kind | Evidence | Key observations |
|---|---|---|---|
| spec-first | real repo | `git rev-parse`, `find` scan, `.spec-first/graph/graph-facts.json` | single git repo; current turn dirty due docs contract repair; package-based Node CLI; generated runtime mirrors can create misleading nested `package.json` hits and must be excluded from default scan. |
| kaz-mvp | real workspace | `/Users/kuang/xiaobu/kaz-mvp/.spec-first/workspace/graph-targets.json`, `graph-bootstrap-summary.json`, `find` scan | multi-repo workspace; 6 child repos in graph-targets; all 6 query usability entries are `definitions-pointer`; parent repo-local artifacts are ignored; host instruction drift detected; 51 Gradle build/settings manifests found under depth 4. |
| pnpm synthetic | local temporary sample | `/tmp/spec-first-pnpm-calibration.NqnmFb` manifest scan | non-git pnpm workspace with root `package.json`, `pnpm-workspace.yaml`, and two package manifests; validates that npm/pnpm target awareness should remain a separate P4-npm parser rather than being guessed from root package alone. |

## Provisional Scenario Classes

These are matrix interpretation labels, not durable artifact classifiers.

| Scenario class | Trigger sketch | Notes |
|---|---|---|
| `clean-single-repo` | one git root, no graph-affecting dirty paths, provider query ready | PA-1 happy-path test target after worktree is clean. |
| `dirty-single-repo` | one git root, graph-affecting dirty paths present | Must expose dirty sample, not only counts. |
| `first-time-git-repo` | git repo with no prior `.spec-first/config|graph|providers|impact` artifacts | Must not be confused with foreign residual. |
| `multi-repo-workspace` | parent workspace with child git repos and no parent repo-local writes | kaz-mvp baseline class. |
| `multi-repo-dirty-workspace` | multi-repo workspace where one or more child repos are dirty | kaz-mvp current observed class. |
| `foreign-residual-workspace` | stale parent repo-local artifacts with stat failure and foreign path prefix mismatch | Requires AND semantics to avoid false positives on normal clones. |
| `non-git-folder` | explicit folder target with no git root | Existing graph-bootstrap non-git folder support remains query/context only. |
| `non-git-build-workspace` | build manifests imply targets outside covered git roots | Gradle first, npm/pnpm later. |
| `provider-degraded` | required provider unavailable, query-unverified, or definitions-only when task needs impact | This class is capability-oriented; do not duplicate provider internals into fingerprint. |

## Provisional `complexity_dimensions` Field Set

All fields are boolean and independent. Do not compute a single scenario score.

| Field | Owner evidence | Rationale |
|---|---|---|
| `multi_repo_workspace` | workspace graph targets / child repo discovery | Drives parent artifact boundary and all-repos routing. |
| `non_git_folder_target` | project target resolution | Required for non-git folder freshness and impact limitation disclosure. |
| `non_git_build_targets_present` | build manifest scan | Captures Gradle/pnpm modules that are not git roots. |
| `git_alignment_broken` | build target coverage vs git child coverage | Core D2 signal: graph completeness cannot equal git child coverage. |
| `parent_repo_local_artifacts_present` | parent `.spec-first/{config,graph,providers,impact}` scan | Core D1 signal: stale parent artifacts need quarantine. |
| `worktree_dirty_graph_affecting` | git status classification + bounded path sample | Core D6 signal; downstream review/commit flows need exact dirty samples. |
| `provider_query_degraded` | provider-status/query usability refs | Keeps provider state referenced, not copied into prose fields. |

## Open Calibration Decisions

- **Build manifest scan depth:** keep default depth at 4 for PA-1/P4 planning. kaz-mvp has relevant Gradle manifests at depth 4 (`feature/*/*/build.gradle`, `submodules/*/*/build.gradle.kts`), so depth 3 would undercount.
- **Gradle parser scope:** static Groovy `include` should be first-class; KTS/composite builds should return skipped reason codes in the first release.
- **pnpm/npm parser scope:** keep out of PA-1. The synthetic sample proves the field shape, but not enough to justify mixing npm parsing into the first Gradle-focused build-target release.
- **Foreign residual rule:** use stat failure AND foreign path prefix mismatch. A normal new clone with missing artifacts is `first-time-git-repo`, not `foreign-residual-workspace`.

## Remaining Survey Limitation

- Run a clean spec-first sample after current docs contract repair is committed or stashed.
- Collect best-effort topology input from at least 3 real users/projects when developer feedback is available; current local-only run cannot contact developers, so this remains an explicit limitation rather than a PA-1 blocker.
- Re-run this note against a fresh graph-bootstrap artifact after the post-commit graph facts are current.
- Review whether `v0.1 provisional` needs RFC adjustment after U3 router and M3 matrix evidence.
