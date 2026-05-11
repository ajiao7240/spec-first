---
title: "feat: Add init-time gitignore policy"
type: feat
status: completed
date: 2026-05-06
spec_id: 2026-05-06-001-init-gitignore-policy
---

# feat: Add init-time gitignore policy

## Summary

让 `spec-first init --claude|--codex` 在安装运行时资产时，自动为目标项目追加一个可维护的 spec-first `.gitignore` managed block。方案只覆盖可重建 runtime、本地 setup/graph/workflow facts 和 scratch，不隐藏可提交的 `AGENTS.md`、`CLAUDE.md`、`config.local.example.yaml`、`repo-profile.yaml` 或可选 standards baseline。

---

## Problem Frame

用户打包安装 `spec-first` 后，第一次运行 `init` 会生成 `.claude/`、`.codex/`、`.agents/skills/` 等 runtime mirror；后续执行 `mcp-setup`、`graph-bootstrap`、`standards` 还会生成 `.spec-first/config/`、`.spec-first/graph/`、`.spec-first/providers/`、`.spec-first/impact/`、`.spec-first/workspace/` 等本地事实。如果项目没有同步 `.gitignore`，用户会在业务仓库看到大量不应该提交的 untracked files。

当前已有用户手册参考文档说明如何手动配置 `.gitignore`，但更好的安装体验是：`init` 在写入 runtime assets 的同一 deterministic flow 中，自动追加最小安全规则，并通过 dry-run 展示。

---

## Requirements

- R1. `init` 应默认为当前目标项目写入 spec-first `.gitignore` managed block，并保持幂等。
- R2. managed block 只能忽略可重建 runtime、本地配置、graph/readiness facts、workflow execution artifacts 和 scratch/raw/cache/logs。
- R3. managed block 不得默认忽略整个 `.spec-first/`、`.claude/`、`.codex/` 或 `.agents/`。
- R4. `init --dry-run` 必须预览 `.gitignore` 写入或更新，不改变文件系统。
- R5. 单仓单项目和单仓多模块模式只写一个目标项目 `.gitignore`，不拆 module-local rules。
- R6. 多仓工作区模式不得由 `init` 静默递归修改所有 child repo；child repo 只能在 child repo 内运行 init，或由后续显式 all-repos setup 流程处理。
- R7. `.spec-first/standards/` 的 reviewable baseline 继续保留团队提交决策空间；只自动忽略 scratch/raw/cache/logs 和临时 patch 类产物。
- R8. 方案必须兼容 Claude 与 Codex 双宿主 init，同步更新文档和回归测试。

---

## Scope Boundaries

- 不改变 `spec-first init` 现有宿主 runtime asset 同步模型。
- 不引入强状态机或语义判断；`.gitignore` 内容是确定性 policy。
- 不默认递归扫描并写入所有 child repos。
- 不自动提交 `.gitignore`，只修改工作区文件，由用户正常 review/commit。
- 不把 `.spec-first/standards/` 整目录加入默认忽略规则。
- 不把 `*.tgz` 加入自动 block；这是包管理通用策略，保留在用户参考文档中作为手动建议。

### Deferred to Follow-Up Work

- 将 `spec-mcp-setup --all-repos` 的 child repo `.gitignore` 覆盖从当前 `.spec-first/*.local.yaml` 扩展为同一 managed block，需要单独处理 shell/PowerShell runtime script 与 CLI policy 共享问题。
- 如要让 `init` 从 module subdir 自动提升到 Git root，应先单独设计 project root resolution，避免 runtime 写入 cwd、`.gitignore` 写入 Git root 的错配。

---

## Graph Readiness

- target_repo: `spec-first`
- status: stale
- source_revision: `dbf9bab1a871fc7aa6c790fe26b70eda10e0e0dc`
- current_revision: `662572a45a44a26f8eb8dcfefc9ee6bc30e4ae49`
- stale: true
- primary_providers: `code-review-graph`, `gitnexus`
- degraded_providers: none reported by compiled artifact
- fallback_capabilities: bounded direct repo reads, live GitNexus MCP session evidence
- runtime_mcp_evidence: `GitNexus context(runInit)` and `GitNexus impact(runInit)` succeeded as session-local evidence
- confidence: medium
- limitations: compiled `.spec-first/graph/graph-facts.json` is stale and current worktree is dirty; live MCP evidence is not written back to graph readiness artifacts

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/commands/init.js` owns `spec-first init --claude|--codex`, dry-run output, runtime rollback backup, and operation-plan application.
- `src/cli/state.js` owns operation plan primitives such as `buildFileWriteOperation`, `mergeOperationPlans`, and `applyOperationPlan`.
- `tests/unit/init-dry-run.test.js` already validates dry-run preview and apply materialization for init.
- `tests/smoke/cli.sh` validates init behavior in fresh projects.
- `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh` 和 `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1` 当前只确保 `.spec-first/*.local.yaml` 写入 `.gitignore`。
- `docs/05-用户手册/12-gitignore参考.md` now records the user-facing ignore policy and standards baseline boundary.
- `docs/05-用户手册/08-三种开发模式.md` defines single-repo/single-project, single-repo/multi-module, and multi-repo workspace boundaries.

### Institutional Learnings

- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md` reinforces source-first repair: generated runtime mirrors should be regenerated, not hand-edited.
- `docs/solutions/workflow-issues/host-entrypoint-mapping-source-boundary-2026-04-29.md` keeps host-specific runtime behavior concentrated in init/governance layers.
- `docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md` shows init changes must preserve dual-host delivery boundaries and tests.

### External References

- External research skipped. This is a local CLI/runtime governance change with strong existing repo patterns and no unstable third-party API dependency.

---

## Key Technical Decisions

- Use a managed block instead of loose append-only lines: this makes future policy updates idempotent and reviewable.
- Keep the default block narrow: ignore spec-first runtime and local facts, but preserve durable source/artifact exceptions.
- Integrate into init's operation plan: dry-run, rollback, and summary behavior should remain one coherent write path.
- Treat multi-repo recursion as out of scope for init: modifying child repos from a parent workspace is a semantic target decision and belongs to explicit setup/all-repos flows.
- Keep `.agents/skills/` in the default block rather than `.agents/`: this avoids hiding user-authored `.agents/plugins/` or marketplace configuration.
- Add `.claude/worktrees/` and `.claude/tasks/` as host-local scratch coverage if validated by tests, because execution workflows may create them and they are not source truth.

---

## Open Questions

### Resolved During Planning

- Should `init` write `.gitignore` automatically? Yes, because init itself creates ignored runtime assets and already writes project files with dry-run visibility.
- Should `init` ignore `.spec-first/standards/` entirely? No, standards baseline artifacts may be intentionally shared.
- Should `init` recursively update child repos in a multi-repo workspace? No, this would silently mutate multiple Git repos and violate target-repo boundaries.

### Deferred to Implementation

- Exact console wording for `.gitignore` status can be chosen during implementation, but it should include `added`, `updated`, `already-current`, or `skipped`.
- Whether existing user `.gitignore` contains equivalent broader rules should be detected conservatively; exact duplicate suppression is required, semantic glob equivalence can be limited.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
flowchart TD
  Init[spec-first init --claude|--codex]
  Plan[buildInitWritePlan]
  Policy[gitignore policy helper]
  Op[operation plan]
  DryRun[--dry-run output]
  Apply[applyOperationPlan + rollback]
  Gitignore[.gitignore managed block]

  Init --> Plan
  Plan --> Policy
  Policy --> Op
  Op --> DryRun
  Op --> Apply
  Apply --> Gitignore
```

Decision matrix:

| Mode | Invocation target | `.gitignore` owner | Default behavior |
| --- | --- | --- | --- |
| 单仓单项目 | repo root | repo root `.gitignore` | write/update managed block |
| 单仓多模块 | repo root | repo root `.gitignore` | write/update once at repo root; no module-local files |
| 多仓工作区, inside child repo | child repo root | child repo `.gitignore` | write/update child repo block |
| 多仓工作区, parent is Git repo | parent repo root | parent `.gitignore` | write/update parent runtime/workspace block only |
| 多仓工作区, parent is not Git repo | parent directory | none | skip `.gitignore`, report skipped; do not create child repo changes |

---

## Implementation Units

- U1. **新增 gitignore policy helper**

**Goal:** Create a deterministic helper that can render, inspect, and update the spec-first `.gitignore` managed block.

**Requirements:** R1, R2, R3, R7

**Dependencies:** None

**Files:**
- Create: `src/cli/gitignore-policy.js`
- Create: `tests/unit/gitignore-policy.test.js`

**Approach:**
- Define a single default policy list for runtime assets, local setup facts, graph/provider/impact/workspace facts, workflow artifacts, standards scratch paths, and known host-local scratch paths.
- Render the policy between stable markers such as `# spec-first:start` and `# spec-first:end`.
- Preserve all user-authored `.gitignore` content outside the managed block.
- Replace an existing managed block when policy changes.
- Avoid duplicate insertion on repeated runs.
- Preserve final newline behavior.

**Patterns to follow:**
- `src/cli/lang-policy.js` and `src/cli/instruction-bootstrap.js` for managed-block update style.
- `src/cli/state.js` for deterministic operation planning boundaries.

**Test scenarios:**
- Happy path: empty `.gitignore` content receives exactly one spec-first managed block.
- Happy path: existing user rules before and after the block remain unchanged after update.
- Edge case: existing `.gitignore` without trailing newline gets a valid block with correct spacing.
- Edge case: existing managed block is replaced, not duplicated.
- Edge case: content that already contains one or more individual rules outside the block still receives the managed block; implementation does not attempt fragile semantic glob equivalence.
- Error path: invalid/non-string input is handled by helper-level validation or clear failure in tests.

**Verification:**
- Unit tests prove idempotence, replacement, formatting, and preservation of user content.

---

- U2. **接入 init operation plan**

**Goal:** Make `spec-first init --claude|--codex` create or update `.gitignore` through the same operation-plan path as runtime assets and metadata.

**Requirements:** R1, R4, R8

**Dependencies:** U1

**Files:**
- Modify: `src/cli/commands/init.js`
- Modify: `tests/unit/init-dry-run.test.js`
- Modify: `tests/smoke/cli.sh`

**Approach:**
- Add a `.gitignore` operation in `buildInitWritePlan`.
- Ensure `--dry-run` lists `.gitignore` when a write/update is planned.
- Ensure normal init reports a concise `.gitignore` status after applying the operation plan.
- Keep rollback backup coverage intact by relying on existing operation-plan backup behavior.
- Do not add a new user prompt; `init` already authorizes bounded runtime installation writes.

**Patterns to follow:**
- Existing `buildInitMetadataPlan` file operation creation.
- Existing dry-run output expectations in `tests/unit/init-dry-run.test.js`.

**Test scenarios:**
- Happy path: Claude init on a fresh temp project creates `.gitignore` with the managed block.
- Happy path: Codex init on a fresh temp project creates `.gitignore` with the managed block.
- Happy path: repeated init leaves only one managed block.
- Edge case: `init --dry-run` previews `.gitignore` but does not create it.
- Edge case: existing user `.gitignore` content is preserved.
- Integration: smoke init output and tree expectations tolerate the new `.gitignore` file.

**Verification:**
- Focused init unit coverage passes.
- Focused init smoke coverage passes.

---

- U3. **固定三种模式目标行为与非递归边界**

**Goal:** Make the behavior explicit and testable across single-repo, multi-module, and multi-repo workspace setups without changing unrelated project-root semantics.

**Requirements:** R5, R6

**Dependencies:** U1, U2

**Files:**
- Modify: `tests/unit/init-dry-run.test.js`
- Modify: `docs/05-用户手册/12-gitignore参考.md`
- Modify: `docs/05-用户手册/08-三种开发模式.md` if needed for cross-link clarification

**Approach:**
- In V1, use current `projectRoot = process.cwd()` semantics for init to avoid changing where runtime assets land.
- Tests should model a multi-module repo by running init at the repo root and proving only root `.gitignore` is written.
- Tests should model a child repo by running init inside the child and proving only child `.gitignore` is written.
- Tests should model a parent workspace by running init in the parent and proving no child repo `.gitignore` files are created.
- Document that users should run init at the intended project root; parent workspace setup of child repos remains the responsibility of explicit setup/all-repos flows.

**Patterns to follow:**
- `docs/05-用户手册/08-三种开发模式.md` for mode names and ownership boundaries.
- `tests/unit/mcp-setup.sh` workspace fixtures for parent/child shape inspiration.

**Test scenarios:**
- Single repo: temp repo root init writes root `.gitignore`.
- Multi-module: temp repo with `packages/app` and `packages/lib`, init at root writes only root `.gitignore`.
- Multi-repo child: temp workspace with `project-a/.git`, init from `project-a` writes `project-a/.gitignore` only.
- Multi-repo parent: temp parent containing two child Git repos, init from parent does not modify child `.gitignore` files.

**Verification:**
- Tests prove init has no silent multi-repo mutation behavior.

---

- U4. **保持 mcp-setup 兼容且不扩 scope**

**Goal:** Ensure existing `spec-mcp-setup` local config gitignore behavior remains compatible with init's broader block, without forcing shell/PowerShell scripts into a second policy source in this phase.

**Requirements:** R2, R6, R8

**Dependencies:** U1, U2

**Files:**
- Modify: `tests/unit/mcp-setup.sh`
- Modify: `tests/unit/mcp-setup-powershell-contracts.test.js` if expectations mention the exact single gitignore rule
- Modify: `skills/spec-mcp-setup/SKILL.md` only if prose needs to clarify compatibility

**Approach:**
- Keep existing `bootstrap-project-config.* --ensure-gitignore` behavior for `.spec-first/*.local.yaml` in this phase.
- Add tests or adjust assertions so a repo that already has the init managed block is treated as gitignored and does not receive duplicate local-only lines.
- Record full all-repos block adoption as follow-up to avoid duplicating policy across JS, shell, and PowerShell without a shared delivery mechanism.

**Patterns to follow:**
- Existing `tests/unit/mcp-setup.sh` assertions around `local_config_gitignore_status`.
- `skills/spec-mcp-setup/SKILL.md` source/runtime boundary for parent workspace writes.

**Test scenarios:**
- Happy path: after init managed block exists, `bootstrap-project-config.sh --ensure-gitignore` reports already ignored or otherwise does not duplicate `.spec-first/*.local.yaml`.
- Edge case: existing current behavior without init still appends `.spec-first/*.local.yaml` as today.
- Parent workspace: existing all-repos tests continue to prove child-local config creation and parent summary boundaries.

**Verification:**
- Focused mcp-setup shell/PowerShell contract coverage passes.

---

- U5. **更新用户文档与 changelog**

**Goal:** Align documentation with the new automatic behavior and keep the manual reference useful for teams that want stricter policies.

**Requirements:** R7, R8

**Dependencies:** U2, U3

**Files:**
- Modify: `docs/05-用户手册/12-gitignore参考.md`
- Modify: `docs/05-用户手册/10-产物目录.md` if needed
- Modify: `docs/05-用户手册/README.md` if the reading path changes
- Modify: `CHANGELOG.md`
- Modify: `tests/unit/user-manual-contracts.test.js`

**Approach:**
- State that init writes a default managed block.
- Keep manual strict-mode options for teams that want to ignore all standards artifacts.
- Explicitly warn that `init` does not recursively modify child repos in a multi-repo workspace.
- Add user-manual contract coverage for the new guide and auto-init behavior.
- If practical, assert the manual's recommended block contains every default policy pattern exported by the helper, while keeping the helper as the machine source of truth.

**Patterns to follow:**
- Existing user manual contract tests in `tests/unit/user-manual-contracts.test.js`.
- Changelog format at the top of `CHANGELOG.md`.

**Test scenarios:**
- Contract: user manual contains the new `init` auto gitignore behavior.
- Contract: user manual still says not to ignore whole `.spec-first/` by default.
- Contract: user manual states multi-repo child repo changes are explicit, not recursive from init.

**Verification:**
- Documentation contract tests pass.
- Diff whitespace validation reports no issues.

---

## System-Wide Impact

- **Interaction graph:** `runInit` has MEDIUM GitNexus impact: direct callers include `src/cli/index.js`, `tests/unit/init-dry-run.test.js`, `tests/unit/browser-helper-tool-contracts.test.js`, `tests/unit/runtime-hook-permissions.test.js`, `tests/unit/doctor-runtime-tools.test.js`, and `tests/unit/clean-dry-run.test.js`.
- **Error propagation:** `.gitignore` write failures should fail through existing init operation application and rollback behavior, not be silently ignored after partial runtime installation.
- **State lifecycle risks:** Repeated init must not accumulate duplicated blocks; destructive reset rollback must preserve pre-existing `.gitignore` content.
- **API surface parity:** Claude and Codex init must share the same policy; no host-specific ignore drift.
- **Integration coverage:** Unit tests must cover helper behavior; smoke tests must cover actual init materialization.
- **Unchanged invariants:** `.claude/`, `.codex/`, and `.agents/skills/` remain generated runtime mirrors; source truth remains `skills/`, `agents/`, `templates/`, `src/cli/`, and docs.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 自动写 `.gitignore` 被用户视为 silent mutation | Route through init dry-run/operation summary and use an explicit managed block. |
| 误隐藏可提交 standards baseline | Do not ignore `.spec-first/standards/` by default; only ignore scratch/raw/cache/logs and temporary patch. |
| 误伤用户 `.agents/` plugins | Ignore `.agents/skills/` only, not `.agents/`. |
| 多仓父目录递归污染 child repos | Init never recursively writes child repos; document and test this boundary. |
| JS policy 与 shell/PowerShell setup 规则漂移 | Keep mcp-setup full-block adoption deferred until a shared delivery mechanism is designed; test compatibility with init's block now. |
| Existing broad user rules make status detection hard | Require exact managed-block idempotence; treat broader semantic equivalence as optional future improvement. |

---

## Documentation / Operational Notes

- Update the gitignore manual to distinguish automatic init behavior from optional strict-mode policy.
- Release notes should mark this as user-visible because fresh installs will now dirty `.gitignore` intentionally.
- Implementation should not hand-edit generated `.claude/`, `.codex/`, or `.agents/skills/` runtime mirrors.

---

## Sources & References

- User request: plan init-time `.gitignore` write behavior across three development modes.
- Related code: `src/cli/commands/init.js`
- Related code: `src/cli/state.js`
- Related tests: `tests/unit/init-dry-run.test.js`
- Related tests: `tests/smoke/cli.sh`
- Related setup scripts: `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh`
- Related setup scripts: `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1`
- User manual: `docs/05-用户手册/12-gitignore参考.md`
- User manual: `docs/05-用户手册/08-三种开发模式.md`
- Institutional learning: `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`
- Institutional learning: `docs/solutions/workflow-issues/host-entrypoint-mapping-source-boundary-2026-04-29.md`
- GitNexus: `context(runInit)` and `impact(runInit)` session-local evidence
