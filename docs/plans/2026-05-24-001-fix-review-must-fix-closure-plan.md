---
title: "fix: 49 条 must-fix review findings 收敛修复计划"
type: fix
status: active
date: 2026-05-24
spec_id: 2026-05-24-001-review-must-fix-closure
origin: 2026-05-23-review.md
---

# fix: 49 条 must-fix review findings 收敛修复计划

## Summary

本计划针对 `2026-05-23-review.md` 中按 80/20 口径标为“必须修复”且仍未修复的 49 条 finding，聚合成 8 个实施单元。核心策略是先关闭 deterministic script facts 的 fail-open、repo/workspace artifact symlink escape、P1 PowerShell setup 入口失败和 release/package 硬阻断，再收紧 workflow evidence、task-pack、worktree destructive write 与 Codex dispatch contract。

计划只定义优化方案，不直接实现代码；后续应由 `$spec-work` 分批执行，每批先补回归测试，再做最小源码修改。

---

## Problem Frame

这些 finding 不是 49 个孤立问题，而是集中命中 spec-first 的几个 load-bearing boundary：

- script-owned facts 不能把未知 provider / workspace 状态提升为可信 truth；
- `.spec-first/**`、workflow artifact、workspace summary、session state 和 managed runtime writes 必须保持 repo/workspace containment，不能被 symlink 带到仓库外；
- task-pack 和 run artifact 是 deterministic handoff，必须拒绝 secrets、generated runtime mirrors、Git internals 和无效 repo scope；
- PowerShell setup 是 required harness runtime 的一等路径，不能在 host detection、provider projection、install summary 阶段硬失败；
- release/test chain 必须能在缺 artifact 时输出可消费 guard envelope，而不是 uncaught exception；
- Codex workflow entrypoint 不能被 skill prose 解释成 subagent / delegation / parallel work 的显式授权。

按 80/20，本计划不追求一次性清理全部 P2/P3 体验或覆盖率问题，而是优先关闭“会造成错误事实、repo 外副作用、secret/path 边界破坏、发布/安装硬失败、宿主工具契约冲突”的高杠杆问题。

---

## Requirements

- R1. Workspace / GitNexus readiness compiler 必须 fail-closed：未知枚举、缺成员归属、同名不同路径 repo、任意输出路径和默认 artifact symlink escape 都不能产出可被下游误解为 `group-ready` / primary evidence 的事实。覆盖 finding 003, 005, 008, 017, 034, 098。
- R2. setup / graph bootstrap 的 all-repos 和 summary writers 必须统一 exit policy 与 workspace containment：部分 child `action-required` 不能 exit 0，所有 `.spec-first/workspace`、`.spec-first/config`、`.gitignore` 等写入都必须拒绝 symlink escape。覆盖 finding 007, 075, 085, 086, 088, 089, 090, 091, 092, 093, 096, 099, 100。
- R3. PowerShell setup path 必须与 Bash 具备等价 contract：`Generic.List` JSON 输出不再抛错，GitNexus query probe policy 可在正常 tracked source repo 中构造，provider projection fingerprint 变化必须让 stale graph readiness 降级。覆盖 finding 020, 025, 026, 035。
- R4. Workflow evidence artifacts 必须收紧 durable boundary：context bundle、session store、spec-work run artifact、review pre-facts、workflow artifact helper 和 schema validator 都必须对路径、schema、raw transcript、secret-deny、`.git/**`、`$ref` 做确定性校验。覆盖 finding 010, 011, 012, 014, 015, 016, 019, 102, 118, 119, 120。
- R5. Task-pack deterministic handoff 必须恢复 source/runtime、secret 和 repo scope 边界：`files`、`expected_side_effects`、`execution_focus[]`、`target_repo` 和 generated runtime mirror roots 都必须被同一套 repo-relative contract 保护。覆盖 finding 107, 108, 109, 110, 147。
- R6. Managed writes 和 worktree destructive operations 必须做 realpath/lstat containment：`applyOperationPlan()`、workspace init summary、optimize worktree cleanup、git-worktree `.gitignore` 和 `--copy-env` 不能跟随 symlink 写删 repo 外路径。覆盖 finding 063, 065, 111, 112, 113。
- R7. Release/package 与 workflow permission contract 必须可安装、可审查、可解释：lockfile version 对齐，release continuity guard 缺 catalog 时输出 structured failure，发布包包含 guard runtime catalog，`$spec-doc-review` / `$spec-code-review` 不再把 workflow invocation 当作 Codex spawn authorization。覆盖 finding 045, 056, 114, 148, 150。
- R8. 每个实施单元必须有 focused tests、CHANGELOG 记录和 review ledger reconciliation；不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。

---

## Assumptions

- A1. `2026-05-23-review.md` 是本计划的 origin ledger；实现前仍需用当前源码逐条复核，因为部分文件可能已有局部修复或未提交改动。
- A2. 49 条 must-fix 可以按 shared boundary 聚合修复；不需要为每条 finding 建立单独 implementation unit。
- A3. 后续执行时保持 source-first：改 `src/cli/`、`skills/`、`docs/contracts/`、`tests/` 和 package metadata，不手改 generated runtime mirrors。
- A4. 本轮未 dispatch helper agents。原因：当前请求是计划产物，且本轮 Codex 工具契约未提供用户对 subagents / delegation / parallel agent work 的显式授权；本计划使用 direct source reads 和 stale graph evidence disclosure。

---

## Scope Boundaries

- 不修复台账中“必须修复=否”的 finding。
- 不在计划阶段实现代码、不运行 full test suite 证明行为。
- 不新增中心化规则引擎；优先复用现有 helper，如 `src/cli/helpers/secret-deny-patterns.js`、`src/contracts/schema-validator.js`、`src/verification/artifact-paths.js`，只有重复路径边界确实需要时才新增小型 shared helper。
- 不让 GitNexus、code-review-graph 或 live MCP evidence 替代源码阅读、tests 和 review ledger。
- 不静默运行 `spec-first init --codex|--claude`；如果后续 source 改动需要 runtime regeneration，应在 `$spec-work` 执行阶段显式说明。

### Deferred to Follow-Up Work

- 非 must-fix 的 Windows portability、fresh-source eval 记录、README drift、helper discoverability 等 P2/P3 补强。
- 发布前的 full `npm test`、`npm run build` 和 runtime regeneration smoke，属于实施完成后的 release validation。

---

## Graph Readiness

- target_repo: `spec-first`
- status: stale
- source_revision: `5628d728dea3544af58e5c88856f5ccac621ea1a`
- current_revision: `ee2893668630c198e53aa7ba0ebfbc85e0180f64`
- stale: true
- primary_providers: `.spec-first/graph/provider-status.json` reports `code-review-graph` and `gitnexus` query-ready for source revision `5628d728...`, but this is not primary evidence for current HEAD.
- degraded_providers: none in canonical artifact; practical posture is degraded because current HEAD is 2 commits ahead and worktree is dirty.
- fallback_capabilities: direct source reads, `rg`, focused unit tests, contract docs.
- runtime_mcp_evidence: `mcp__gitnexus__.list_repos` reports `spec-first` indexed at `5628d728...` and 2 commits behind HEAD.
- confidence: high for direct file/contract evidence; low for graph-backed impact claims.
- limitations: graph facts are dirty-advisory and stale relative to current HEAD, so implementation scope must be validated from current source and tests.

## Graph / GitNexus Evidence

- provider: GitNexus
- native_tool_or_resource: `list_repos`
- repo_scope: `spec-first`
- capability_status: available
- evidence_grade: stale
- evidence_posture: fallback
- freshness_state: stale
- source_tags: [live-mcp-tool, session-local-inference]
- source_contract_fields: `docs/contracts/graph-provider-consumption.md`, `docs/contracts/workspace-gitnexus-consumption.md`
- source_reads_required: yes; every implementation unit must read current source before editing.
- impact_on_plan: graph evidence only informs stale/fallback posture. It does not define scope or prove impact.
- capabilities_used: repository index freshness check only.
- key_findings: GitNexus index exists but is 2 commits behind current HEAD.
- limitations: no graph query/impact evidence was consumed for the 49 findings; review ledger and direct source reads remain primary inputs.

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/helpers/compile-workspace-gitnexus-readiness.js` and `tests/unit/workspace-gitnexus-readiness.test.js` — workspace readiness classifier, group status, enum normalization and artifact write contract.
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`, `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`, `skills/spec-graph-bootstrap/scripts/compile-workspace-gitnexus-readiness.sh` — graph setup all-repos, concurrent-write detection and workspace summary writers.
- `skills/spec-mcp-setup/scripts/detect-host.ps1`, `skills/spec-mcp-setup/scripts/write-provider-config.ps1`, `skills/spec-mcp-setup/scripts/install-mcp.ps1`, `skills/spec-mcp-setup/scripts/verify-tools.sh`, `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh` — PowerShell parity and setup summary/write surfaces.
- `src/cli/helpers/context-bundle.js`, `src/cli/helpers/session-store.js`, `src/cli/helpers/spec-work-run-artifact.js`, `src/cli/helpers/review-pre-facts.js`, `src/verification/artifact-paths.js`, `src/contracts/schema-validator.js` — workflow evidence and schema validation boundaries.
- `src/cli/helpers/secret-deny-patterns.js` — existing exact repo-relative and secret-deny path helper to reuse before inventing a new path grammar.
- `src/cli/task-pack.js` and `tests/unit/task-pack-command.test.js` — plan-to-work deterministic handoff.
- `src/cli/state.js`, `src/cli/commands/init.js`, `skills/spec-optimize/scripts/experiment-worktree.sh`, `skills/git-worktree/scripts/worktree-manager.sh` — managed writes and destructive worktree operations.
- `scripts/check-release-continuity.cjs`, `package.json`, `package-lock.json`, `tests/unit/release-continuity-guard.test.js` — release/package continuity.
- `skills/spec-doc-review/SKILL.md`, `skills/spec-code-review/SKILL.md`, `tests/unit/spec-doc-review-contracts.test.js`, `tests/unit/spec-code-review-contracts.test.js` — Codex dispatch permission prose and tests.

### Institutional Learnings

- `docs/contracts/source-runtime-customization-boundary.md` — source-of-truth vs generated runtime mirror boundary; provider facts are evidence, not semantic authority.
- `docs/contracts/workspace-gitnexus-consumption.md` — parent workspace GitNexus facts are advisory; `group.status` must be nested, closed, and path/member-backed.
- `docs/contracts/graph-provider-consumption.md` — setup projection, graph artifacts and live MCP are separate evidence grades; stale graph cannot become primary truth.
- `docs/contracts/workflows/review-pre-facts-extraction.md` — review pre-facts temp output must remain under OS temp run root and treat excerpts as untrusted quoted data.
- `docs/contracts/context-bundle.md` — context paths are downstream read triggers and therefore require repo containment even when the helper itself does not read files.

### External References

- None. 本计划只使用 repo-local contracts、review ledger 和 current source reads。

---

## Key Technical Decisions

| Decision | Rationale | Consequence |
| --- | --- | --- |
| 聚合为 7 个修复单元 + 1 个 ledger/validation 单元 | 49 条 finding 的根因集中在少数 contract boundaries；逐条修会重复实现 path containment、enum normalization 和 exit policy。 | 每个单元必须覆盖多个 finding，并在测试中保留 traceability。 |
| 先写 characterization tests，再改实现 | 多数 finding 是边界回归；先锁住 fail-open 行为，能避免“修 A 破 B”。 | `$spec-work` 执行时每个单元至少先补一个 failing test 或 fixture。 |
| JS 路径 contract 复用 `secret-deny-patterns`，必要时新增小 helper | `isExactRepoRelativePath()` 已处理 Windows drive、backslash、`..`、glob 等基础问题；secret-deny contract 已是 source truth。 | 避免每个 producer 写一套 regex；新 helper 只补 realpath/lstat containment，不替代 secret-deny。 |
| Shell/PowerShell containment 不强行共享跨宿主文件 | 跨 Bash/PowerShell 共享 path helper 会引入 quoting/runtime 复杂度；各脚本可实现同名小函数并用 contract tests 锁行为。 | Tests 必须同时覆盖 Bash 和 PowerShell critical cases；行为一致比代码复用更重要。 |
| Unknown enum 一律 degrade/fail-closed，不做 best-effort promotion | Provider 和 workspace facts 是 script-owned facts；未知值是 schema drift，不是 LLM 该猜的语义。 | 下游可能看到更多 `unavailable` / `partial`，但不会误用不可信 evidence。 |
| `target_repo` 是 write-scope authority，不是普通 string | Parent workspace 下写入、测试、autofix 和 commit 前都依赖该字段；必须拒绝 escape 并在 `execution_focus[]` 中保留 repo scope。 | Task-pack schema 和 compact output 都要一起改，避免 producer/consumer 漂移。 |
| Codex workflow invocation 不等于 subagent authorization | 当前宿主工具契约要求用户显式要求 subagents/delegation/parallel agent work；skill prose 不能越权解释。 | `$spec-doc-review` / `$spec-code-review` 需要默认 current-agent/report-only fallback，只有显式授权时才 dispatch。 |

---

## High-Level Technical Design

> 方向性设计，仅用于说明边界形状；实现时应遵循当前源码局部风格。

```text
Review ledger must-fix IDs
  |
  v
Boundary clusters
  |-- Workspace/readiness facts: closed enums + path-contained advisory artifacts
  |-- Setup/all-repos scripts: non-ready exit policy + symlink-safe summaries
  |-- PowerShell parity: JSON-safe arrays + projection fingerprint stale gate
  |-- Workflow evidence: schema validate + deny raw/untrusted/secret paths
  |-- Task-pack: repo-relative ownership + target_repo scoped execution_focus
  |-- Managed/worktree writes: lstat/realpath containment before write/delete
  |-- Release/dispatch: installable package + explicit Codex agent authorization
  v
Focused tests per unit
  |
  v
Review ledger reconciliation + narrow gates + CHANGELOG
```

Path safety rule of thumb:

1. Normalize user/artifact paths to exact repo-relative POSIX paths.
2. Reject absolute paths, drive paths, backslashes, `.` / `..`, empty segments, globs and control-like names.
3. Before write/delete, `lstat` every existing ancestor that can redirect the operation; reject symlink ancestors unless the contract explicitly allows following and the final realpath remains contained.
4. After `mkdir -p`, re-check the real parent and final target containment before atomic write.
5. Apply secret-deny and generated-runtime deny before durable evidence or task handoff records a path.

---

## Implementation Units

### U1. Workspace GitNexus Readiness Compiler Fail-Closed And Path Containment

**Goal:** Make `workspace-gitnexus-readiness.v1` a bounded advisory artifact again: no arbitrary output write, no symlink escape, no unknown enum promotion, no same-name/different-path repo match, and no group-ready claim without member proof.

**Requirements:** R1

**Findings:** 003, 005, 008, 017, 034, 098

**Dependencies:** None

**Files:**
- Modify: `src/cli/helpers/compile-workspace-gitnexus-readiness.js`
- Modify: `skills/spec-graph-bootstrap/scripts/compile-workspace-gitnexus-readiness.sh`
- Modify: `tests/unit/workspace-gitnexus-readiness.test.js`
- Review: `docs/contracts/workspace-gitnexus-consumption.md`

**Approach:**
- Replace unrestricted `--output` behavior with explicit bounded output modes. Default durable writes go only to `.spec-first/workspace/gitnexus-readiness.json` under the target workspace after containment checks.
- Normalize `group.status`, `refresh_eligibility`, `index_snapshot`, and `query_usability` through closed enum maps. Unknown values become degraded facts with stable reason codes.
- Require group membership evidence before `group.status="group-ready"` can emit a `query_selector`. If `group_list` lacks members, emit unavailable/not-evaluated with `group_reason_code`.
- Match workspace registry/group repos by canonical path when available. Same repo name alone is insufficient; name-only matches can at most become query-unverified with limitation.
- Ensure default artifact write rejects `.spec-first/workspace` symlink escape before and after directory creation.

**Test scenarios:**
- Error path: `--output ../../outside.json` or symlinked `.spec-first/workspace` is rejected with non-zero exit and stable reason.
- Error path: unknown `group_list.status` does not produce `group-ready`.
- Error path: unknown `refresh_eligibility` / `index_snapshot` values do not enter durable payload as raw unknown enum.
- Edge case: registry contains same repo name at a different path; compiler does not promote current child to group/registry query evidence.
- Edge case: `group_list` returns a group without members; compiler does not emit usable `@group` selector.
- Happy path: valid multi-repo workspace with path-backed members writes canonical artifact shape.

**Verification:**
- `npm run test:unit -- workspace-gitnexus-readiness`
- `npm run typecheck`

---

### U2. Setup/Graph All-Repos Exit Policy And Workspace Summary Containment

**Goal:** Align Bash and PowerShell setup/graph all-repos scripts around one deterministic policy: any partial child action-required makes the parent command fail, and every workspace/config summary write stays inside the intended repo/workspace.

**Requirements:** R2

**Findings:** 007, 075, 085, 086, 088, 089, 090, 091, 092, 093, 096, 099, 100

**Dependencies:** U1 for readiness compiler write semantics.

**Files:**
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.ps1`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.sh`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- Modify: `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1`
- Modify: `tests/unit/spec-graph-bootstrap.sh`
- Modify: `tests/unit/mcp-setup.sh`
- Modify: `tests/unit/bootstrap-providers-powershell-contracts.test.js`
- Modify: `tests/unit/mcp-setup-powershell-contracts.test.js`

**Approach:**
- Define an all-repos status-to-exit matrix: all children ready exits 0; any child `action-required` / failed setup / failed bootstrap exits 1; invalid args/workspace shape exits 2.
- Keep machine-readable summary payloads even on exit 1, so callers can inspect which child failed.
- Narrow concurrent-write exclusion in graph bootstrap: ignore only bootstrap-owned outputs, not the entire `.spec-first/` tree. `.spec-first/config/**` changes during the critical window must be detected.
- Add Bash and PowerShell functions for safe directory creation and summary writes: reject symlinked `.spec-first`, `.spec-first/workspace`, `.spec-first/config`; write temp file under the real contained directory; re-check containment after `mkdir`.
- For project config bootstrap, reject `.gitignore` symlink before `--ensure-gitignore` writes.

**Test scenarios:**
- Error path: parent `verify-tools --all-repos`, `install-mcp --all-repos`, `spec-graph-bootstrap --all-repos`, and `bootstrap-project-config --all-repos` exit 1 when any child is action-required.
- Error path: symlinked `.spec-first/workspace` rejects all all-repos summary writers.
- Error path: symlinked `.spec-first/config` rejects `write-provider-config`.
- Error path: symlinked `.gitignore` rejects `bootstrap-project-config --ensure-gitignore`.
- Edge case: graph bootstrap concurrent-write test mutates `.spec-first/config/*` during the window and is detected.
- Happy path: existing non-symlink summaries still write in the same canonical locations.

**Verification:**
- `npm run test:unit -- spec-graph-bootstrap`
- `npm run test:unit -- mcp-setup`
- Focused PowerShell contract tests on a host with PowerShell available.

---

### U3. PowerShell Setup JSON/Projection/Fingerprint Parity

**Goal:** Close the P1 Windows setup blockers and ensure PowerShell setup produces the same machine facts and stale-graph downgrade behavior as Bash.

**Requirements:** R3

**Findings:** 020, 025, 026, 035

**Dependencies:** U2 containment helpers may be touched in the same scripts, but JSON/projection logic should be separately tested.

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/detect-host.ps1`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `tests/unit/mcp-setup-powershell-contracts.test.js`
- Modify: `tests/unit/mcp-setup.sh`

**Approach:**
- Convert `Generic.List[object]` values to ordinary arrays before `ConvertTo-Json`; apply this to host detection payloads and final install `results`.
- Fix `write-provider-config.ps1` query probe policy construction for tracked source repos. PowerShell should produce the same policy fields and reason codes as Bash, or fail with a structured reason instead of throwing.
- Add projection fingerprint comparison before reporting canonical graph readiness as primary. If provider projection fingerprints differ from canonical graph artifact fingerprints, report setup/bootstrap-required or stale/degraded posture rather than primary.
- Keep `source_provenance`, `source_tags[]`, `native_tools[]`, `native_resources[]`, and mutation boundary shapes consistent with Bash.

**Test scenarios:**
- Error path: empty arrays in `detect-host.ps1` and `install-mcp.ps1` serialize to `[]` and do not throw.
- Happy path: valid tracked source repo yields GitNexus query probe policy in PowerShell.
- Error path: malformed probe candidates produce structured `reason_code`, not uncaught exception.
- Edge case: provider projection fingerprint mismatch downgrades stale graph readiness and does not advertise primary graph evidence.
- Parity: Bash and PowerShell fixtures produce equivalent JSON shapes for capability arrays and readiness projection.

**Verification:**
- `npm run test:unit -- mcp-setup-powershell-contracts`
- `npm run test:mcp-setup`

---

### U4. Workflow Evidence, Session, Context, Review Artifact, And Schema Hardening

**Goal:** Make durable workflow evidence safe to read, resume, review and compact: validate schemas on read, cap untrusted fields, deny secret/Git/runtime paths, and prevent symlinked artifact roots from escaping their intended location.

**Requirements:** R4

**Findings:** 010, 011, 012, 014, 015, 016, 019, 102, 118, 119, 120

**Dependencies:** U2 path containment decisions should be mirrored but not necessarily share shell code.

**Files:**
- Modify: `src/cli/helpers/context-bundle.js`
- Modify: `src/cli/helpers/session-store.js`
- Modify: `src/cli/commands/session.js`
- Modify: `src/cli/helpers/spec-work-run-artifact.js`
- Modify: `docs/contracts/workflows/spec-work-run-artifact.schema.json`
- Modify: `src/cli/helpers/review-pre-facts.js`
- Modify: `src/verification/artifact-paths.js`
- Modify: `src/contracts/schema-validator.js`
- Modify: `tests/unit/context-bundle-contracts.test.js`
- Modify: `tests/unit/spec-first-session-contracts.test.js`
- Modify: `tests/unit/spec-work-run-artifact-producer.test.js`
- Modify: `tests/unit/review-pre-facts-helper.test.js`
- Modify: schema validator focused tests under `tests/unit/`

**Approach:**
- `context-bundle`: validate every existing ancestor for nonexistent paths. A path under a symlinked directory must be excluded with `target_symlink_escape` even if the final file does not exist yet.
- `session-store`: validate `.spec-first/sessions` containment for register, heartbeat and unregister. Re-check before write/delete because the directory can be swapped after initial creation.
- `spec-work-run-artifact`: require `targetRepo` to be an actual Git repo; validate read-side artifacts against schema; deny extra raw transcript fields; apply secret-deny to all durable path arrays; reject `.git/**`.
- `review-pre-facts`: reject temp run root escape when existing parents are symlinks, preserving the OS temp root contract.
- `artifact-paths`: make `resolveWorkflowArtifactDir()` or its write consumers reject symlinked `.spec-first/workflows` before workflow quality artifacts are written.
- `schema-validator`: implement local `$ref` resolution for internal refs such as `#/$defs/name`, or fail closed with an unsupported keyword error. It must not silently ignore `$ref`.

**Test scenarios:**
- Error path: context bundle receives `symlink-dir/new-file.md`; it excludes the path before any consumer can read it.
- Error path: session register/heartbeat/unregister reject symlinked `.spec-first/sessions`.
- Error path: spec-work run artifact writer rejects non-Git target repo.
- Error path: read of malformed run artifact returns schema-invalid/not-readable status, not `status=read`.
- Error path: raw transcript extra fields, `.env`, private key-like paths, `.git/config`, and `.git/HEAD` are rejected from durable run evidence.
- Error path: review-pre-facts temp run root symlink escape is rejected.
- Error path: workflow artifact helper rejects symlinked `.spec-first/workflows`.
- Error path: schema with `$defs` + `$ref` enforces nested constraints; invalid nested payload fails.
- Happy path: valid existing run artifact and context bundle fixtures still pass.

**Verification:**
- `npm run test:unit -- context-bundle-contracts`
- `npm run test:unit -- spec-first-session-contracts`
- `npm run test:unit -- spec-work-run-artifact-producer`
- `npm run test:unit -- review-pre-facts-helper`
- Focused schema validator tests.

---

### U5. Task-Pack Source/Runtime, Secret-Deny, And Target Repo Scope

**Goal:** Ensure task-pack remains a deterministic handoff with explicit ownership and repo scope, not a way to smuggle secrets, generated runtime mirrors or parent workspace escapes into downstream execution.

**Requirements:** R5

**Findings:** 107, 108, 109, 110, 147

**Dependencies:** U4 secret-deny/path helper decisions should be reused.

**Files:**
- Modify: `src/cli/task-pack.js`
- Modify: `tests/unit/task-pack-command.test.js`
- Review: `src/cli/helpers/secret-deny-patterns.js`

**Approach:**
- Apply `isExactRepoRelativePath()` and `isSecretDeniedPath()` to `tasks[].files[]`, `expected_side_effects[]`, and compact `execution_focus[]` path projections.
- Treat generated runtime mirror roots and descendants as denied: `.claude`, `.claude/**`, `.codex`, `.codex/**`, `.agents/skills`, `.agents/skills/**`.
- Validate `target_repo` as a repo-relative safe path under the parent workspace, not an arbitrary string: reject absolute paths, Windows drive paths, backslashes, `..`, empty segments and control-like names.
- If `target_repo` is provided, include repo scope in every `execution_focus[]` entry or its enclosing compact summary so downstream work does not lose write scope.

**Test scenarios:**
- Error path: `expected_side_effects: [".env"]` and token/private-key-like paths are rejected.
- Error path: `tasks[].files: [".env"]` is rejected.
- Error path: `.claude`, `.codex`, `.agents/skills` roots and descendants are rejected from files and side effects.
- Error path: `target_repo: "../sibling"`, absolute path, Windows drive path and backslash path are rejected.
- Happy path: safe `target_repo` survives validation and appears in compact `execution_focus[]`.
- Regression: existing valid task-pack fixtures still pass.

**Verification:**
- `npm run test:unit -- task-pack-command`

---

### U6. Managed Runtime Writes And Worktree Destructive Operation Containment

**Goal:** Harden write/delete helpers that can mutate source/runtime or worktrees so they never follow symlinked paths outside the intended repo/worktree boundary.

**Requirements:** R6

**Findings:** 063, 065, 111, 112, 113

**Dependencies:** U2/U4 path containment choices for consistency.

**Files:**
- Modify: `src/cli/state.js`
- Modify: `src/cli/atomic-write.js` if shared write checks belong there.
- Modify: `src/cli/commands/init.js`
- Modify: `tests/unit/init-dry-run.test.js`
- Modify: `skills/spec-optimize/scripts/experiment-worktree.sh`
- Modify: `tests/unit/high-risk-execution-contracts.test.js`
- Modify: `skills/git-worktree/scripts/worktree-manager.sh`
- Add or modify focused shell contract tests for `worktree-manager.sh` if none exist.

**Approach:**
- `applyOperationPlan()`: replace text-prefix containment with realpath/lstat containment for writes, deletes and managed runtime operations; reject symlink ancestors unless the resolved target is proven contained; re-check after directory creation and before delete.
- `init` workspace summary writer: reject symlinked `.spec-first/workspace` and re-check parent containment before writing `init-summary.json`.
- `experiment-worktree.sh cleanup`: validate `spec_name` as a strict slug, compute cleanup target under `.worktrees`, reject real target outside `.worktrees`, and prefer registered worktree validation before fallback `rm -rf`.
- `worktree-manager.sh`: reject symlinked main `.gitignore` before appending; for `--copy-env`, reject symlinked new worktree `.env` and copy only to a regular file inside the new worktree.

**Test scenarios:**
- Error path: managed operation target under symlinked directory is rejected before write/delete.
- Error path: workspace init summary refuses symlinked `.spec-first/workspace`.
- Error path: `experiment-worktree.sh cleanup` rejects `spec_name` containing `../` or path separators.
- Error path: cleanup target resolving outside `.worktrees` is rejected.
- Error path: `worktree-manager.sh` refuses symlinked main `.gitignore`.
- Error path: `worktree-manager.sh --copy-env` refuses symlinked new worktree `.env`.
- Happy path: normal init/worktree flows still succeed with regular files and directories.

**Verification:**
- `npm run test:unit -- init-dry-run`
- `npm run test:unit -- high-risk-execution-contracts`
- Focused shell tests for `worktree-manager.sh`.

---

### U7. Release/Package Continuity And Codex Dispatch Permission Cleanup

**Goal:** Ensure install/release artifacts are coherent and workflow prose respects current Codex multi-agent permission boundaries.

**Requirements:** R7

**Findings:** 045, 056, 114, 148, 150

**Dependencies:** U4 schema validator may affect release guard tests if it validates runtime catalog schemas.

**Files:**
- Modify: `package-lock.json`
- Modify: `package.json`
- Modify: `scripts/check-release-continuity.cjs`
- Modify: `tests/unit/release-continuity-guard.test.js`
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/spec-doc-review-contracts.test.js`
- Modify: `tests/unit/spec-code-review-contracts.test.js`
- Consider: `README.md`, `README.zh-CN.md` only if user-visible invocation behavior changes need public docs.

**Approach:**
- Regenerate or minimally update `package-lock.json` so root package version matches `package.json`.
- Make `check-release-continuity.cjs --json` catch missing runtime capability catalog and output a stable `release-continuity-guard/v1` failure envelope with `status:"failed"` and reason code such as `runtime-capability-catalog-missing`.
- Ensure `package.json.files` includes the runtime capability catalog or source catalog path required by release continuity guard.
- Update `$spec-doc-review` and `$spec-code-review` prose: default Codex invocation does not imply subagent/delegation/parallel work authorization; multi-persona dispatch may run only when the user explicitly asks for it or the host/tool contract exposes equivalent authorization; otherwise use current-agent/report-only fallback and record degraded dispatch posture.

**Test scenarios:**
- Error path: missing runtime capability catalog under `--json` exits non-zero but prints structured JSON guard envelope.
- Happy path: packaged file list includes every file the release guard reads.
- Regression: `package-lock.json` root version equals `package.json.version`.
- Prose contract: `$spec-doc-review` and `$spec-code-review` no longer state direct invocation authorizes Codex `spawn_agent`.
- Fallback contract: both skills mention current-agent/report-only fallback when dispatch is not explicitly authorized or unavailable.

**Verification:**
- `npm run test:unit -- release-continuity-guard`
- `npm run test:unit -- spec-doc-review-contracts`
- `npm run test:unit -- spec-code-review-contracts`
- `npm run build`

---

### U8. Review Ledger Reconciliation And Focused Validation Matrix

**Goal:** Keep the review ledger and changelog truthful after implementation, without using the plan document as a substitute for proof.

**Requirements:** R8

**Findings:** all 49 tracked findings

**Dependencies:** U1-U7 complete.

**Files:**
- Modify: `2026-05-23-review.md`
- Modify: `CHANGELOG.md`
- Create or modify: focused validation notes under `docs/validation/` only if execution produces durable validation artifacts.

**Approach:**
- After each unit lands, update only the corresponding rows in `2026-05-23-review.md` from `未修复` to `已修复` or `部分修复` based on actual tests and source diffs.
- Keep the “必须修复” column stable unless implementation reveals a finding was invalid; if invalid, record the reason in the finding detail, not only the table.
- Update the summary counts after each batch or final batch.
- Add `CHANGELOG.md` entries for each source-changing batch using `.codex/spec-first/.developer` author (`leokuang`).
- Do not mark generated runtime mirrors as fixed unless regenerated through `spec-first init --codex|--claude` and explicitly validated.

**Test scenarios:**
- Ledger consistency: count of table rows by status matches summary lines.
- Traceability: every fixed finding row maps to at least one validation command or explicit not-run reason.
- Changelog: every source-changing batch has a `v1.8.2` entry and `(user-visible)` where behavior changes affect users.

**Verification:**
- Focused row-count script or `rg` checks over `2026-05-23-review.md`.
- Final narrow test commands from U1-U7.
- Optional broader gate after all units: `npm test` and `npm run build`.

---

## System-Wide Impact

- **Interaction graph:** setup/bootstrap scripts feed graph/provider readiness; task-pack feeds work execution; run artifacts feed review/closeout; release guard feeds package validation. Fail-closed changes may surface more `action-required` states to workflows.
- **Error propagation:** script failures should return stable `reason_code` and machine-readable JSON when the command already supports JSON. Symlink/path violations should be explicit user-fixable errors, not uncaught stack traces.
- **State lifecycle risks:** partial writes and stale summaries are the main risk. Every artifact writer touched by this plan should use atomic writes and post-mkdir containment checks.
- **API surface parity:** Bash and PowerShell scripts must remain contract-compatible. If one host cannot support a behavior, both should expose a comparable degraded reason.
- **Integration coverage:** unit tests prove local boundaries; smoke/integration tests still needed after all units because setup, graph bootstrap and release package paths span multiple scripts.
- **Unchanged invariants:** GitNexus stays advisory; source-of-truth remains checked-in source; generated runtime mirrors are not hand-edited; workflow invocation is not a hidden permission grant.

---

## Risks & Dependencies

| Risk | Mitigation |
| --- | --- |
| Path containment fixes accidentally break legitimate summary/artifact writes | Characterization tests for existing happy paths before symlink-negative tests; keep output locations unchanged. |
| Bash and PowerShell diverge while fixing the same contract | Add paired fixtures and compare JSON shape/exit policy for each affected all-repos/setup path. |
| `$ref` support in `schema-validator` becomes too large | Support only internal refs needed by source schemas first, or fail closed with explicit unsupported ref reason; do not implement a full external resolver. |
| Task-pack `target_repo` validation may reject existing loose task packs | Keep omitted/null behavior for single-repo packs; reject only path escapes and unsafe strings; document migration in changelog. |
| Release package file inclusion could expand npm package too broadly | Include only the catalog files actually read by `check-release-continuity.cjs`; verify with `npm pack --dry-run`. |
| Review ledger counts drift during multi-batch execution | U8 requires row-count validation after each batch and final summary reconciliation. |

---

## Delivery Sequence

| Phase | Units | Why First |
| --- | --- | --- |
| Phase 1: setup/readiness blockers | U1, U2, U3 | These produce deterministic facts consumed by multiple downstream workflows and include all P1 setup failures. |
| Phase 2: workflow handoff safety | U4, U5 | These prevent unsafe evidence/task handoffs before more agents consume the artifacts. |
| Phase 3: destructive write containment | U6 | These are high-risk writes/deletes; run after shared path policy is clear. |
| Phase 4: release and permission cleanup | U7 | Makes package/install and Codex workflow behavior coherent before final validation. |
| Phase 5: reconciliation | U8 | Only after tests and diffs prove actual closure. |

Recommended execution batches:

1. Batch A: U1 + the U2 pieces directly touching workspace summary containment for GitNexus readiness.
2. Batch B: U3 PowerShell P1 fixes and projection fingerprint stale gate.
3. Batch C: U4 run/session/context/schema hardening.
4. Batch D: U5 task-pack and U6 destructive write containment.
5. Batch E: U7 release/dispatch cleanup and U8 ledger reconciliation.

---

## Detailed Finding-To-Unit Map

| Finding | Must Fix Reason | Unit | Primary Files |
| --- | --- | --- | --- |
| 003 | arbitrary readiness `--output` write | U1 | `src/cli/helpers/compile-workspace-gitnexus-readiness.js` |
| 005 | unknown group status promoted to ready | U1 | `src/cli/helpers/compile-workspace-gitnexus-readiness.js` |
| 007 | concurrent-write detection ignores `.spec-first/config` | U2 | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1` |
| 008 | unclosed readiness enums | U1 | `src/cli/helpers/compile-workspace-gitnexus-readiness.js` |
| 010 | context bundle symlink ancestor gap | U4 | `src/cli/helpers/context-bundle.js` |
| 011 | session register containment gap | U4 | `src/cli/helpers/session-store.js` |
| 012 | run artifact accepts non-Git target repo | U4 | `src/cli/helpers/spec-work-run-artifact.js` |
| 014 | run artifact raw transcript bypass via extra fields | U4 | `src/cli/helpers/spec-work-run-artifact.js` |
| 015 | run artifact read skips schema validation | U4 | `src/cli/helpers/spec-work-run-artifact.js` |
| 016 | run artifact lacks secret-deny path contract | U4 | `src/cli/helpers/spec-work-run-artifact.js`, `src/cli/helpers/secret-deny-patterns.js` |
| 017 | workspace readiness matches same-name different-path repos | U1 | `src/cli/helpers/compile-workspace-gitnexus-readiness.js` |
| 019 | session heartbeat/unregister containment gap | U4 | `src/cli/helpers/session-store.js` |
| 020 | PowerShell provider writer query probe policy throws | U3 | `skills/spec-mcp-setup/scripts/write-provider-config.ps1` |
| 025 | PowerShell detect-host `Generic.List` JSON throws | U3 | `skills/spec-mcp-setup/scripts/detect-host.ps1` |
| 026 | PowerShell install-mcp `results` JSON throws | U3 | `skills/spec-mcp-setup/scripts/install-mcp.ps1` |
| 034 | group without members recommended as group query | U1 | `src/cli/helpers/compile-workspace-gitnexus-readiness.js` |
| 035 | provider projection fingerprint change still reports primary | U3 | `skills/spec-mcp-setup/scripts/write-provider-config.sh`, `skills/spec-mcp-setup/scripts/write-provider-config.ps1` |
| 045 | package-lock version drift | U7 | `package-lock.json` |
| 056 | `$spec-doc-review` treats entrypoint as Codex spawn authorization | U7 | `skills/spec-doc-review/SKILL.md` |
| 063 | `applyOperationPlan()` text-only containment | U6 | `src/cli/state.js` |
| 065 | workspace init summary symlink escape | U6 | `src/cli/commands/init.js` |
| 075 | provider config follows `.spec-first/config` symlink | U2 | `skills/spec-mcp-setup/scripts/write-provider-config.sh`, `skills/spec-mcp-setup/scripts/write-provider-config.ps1` |
| 085 | `verify-tools --all-repos` partial child exits 0 | U2 | `skills/spec-mcp-setup/scripts/verify-tools.sh`, `skills/spec-mcp-setup/scripts/verify-tools.ps1` |
| 086 | verify all-repos summary symlink escape | U2 | `skills/spec-mcp-setup/scripts/verify-tools.sh`, `skills/spec-mcp-setup/scripts/verify-tools.ps1` |
| 088 | graph bootstrap all-repos partial child exits 0 | U2 | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1` |
| 089 | graph bootstrap summary symlink escape | U2 | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1` |
| 090 | install-mcp all-repos partial child exits 0 | U2 | `skills/spec-mcp-setup/scripts/install-mcp.sh`, `skills/spec-mcp-setup/scripts/install-mcp.ps1` |
| 091 | install-mcp summary symlink escape | U2 | `skills/spec-mcp-setup/scripts/install-mcp.sh`, `skills/spec-mcp-setup/scripts/install-mcp.ps1` |
| 092 | project config all-repos partial child exits 0 | U2 | `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh`, `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1` |
| 093 | project config summary symlink escape | U2 | `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh`, `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1` |
| 096 | graph targets summary symlink escape | U2 | `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`, `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1` |
| 098 | default GitNexus readiness artifact symlink escape | U1 | `src/cli/helpers/compile-workspace-gitnexus-readiness.js` |
| 099 | project config bootstrap follows `.spec-first` symlink | U2 | `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh`, `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1` |
| 100 | project config `--ensure-gitignore` follows `.gitignore` symlink | U2 | `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh`, `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1` |
| 102 | run artifact allows `.git/**` | U4 | `src/cli/helpers/spec-work-run-artifact.js` |
| 107 | task-pack expected side effects accepts secret paths | U5 | `src/cli/task-pack.js` |
| 108 | task-pack files accepts secret-denied paths | U5 | `src/cli/task-pack.js` |
| 109 | task-pack execution focus loses `target_repo` scope | U5 | `src/cli/task-pack.js` |
| 110 | task-pack `target_repo` accepts escapes | U5 | `src/cli/task-pack.js` |
| 111 | optimize worktree cleanup path escape | U6 | `skills/spec-optimize/scripts/experiment-worktree.sh` |
| 112 | worktree manager follows main `.gitignore` symlink | U6 | `skills/git-worktree/scripts/worktree-manager.sh` |
| 113 | worktree manager `--copy-env` follows new `.env` symlink | U6 | `skills/git-worktree/scripts/worktree-manager.sh` |
| 114 | release continuity guard uncaught missing catalog | U7 | `scripts/check-release-continuity.cjs` |
| 118 | review-pre-facts temp root symlink escape | U4 | `src/cli/helpers/review-pre-facts.js` |
| 119 | workflow artifact helper follows `.spec-first/workflows` symlink | U4 | `src/verification/artifact-paths.js` |
| 120 | schema-validator ignores `$ref` | U4 | `src/contracts/schema-validator.js` |
| 147 | task-pack allows generated runtime mirror roots | U5 | `src/cli/task-pack.js` |
| 148 | `$spec-code-review` treats entrypoint as Codex spawn authorization | U7 | `skills/spec-code-review/SKILL.md` |
| 150 | package omits runtime capability catalog used by release guard | U7 | `package.json`, `scripts/check-release-continuity.cjs` |

---

## Validation Plan

Narrow validation should run per unit before broad gates:

- U1: `npm run test:unit -- workspace-gitnexus-readiness`
- U2: `npm run test:unit -- spec-graph-bootstrap`; `npm run test:unit -- mcp-setup`; paired PowerShell contract tests where available.
- U3: `npm run test:unit -- mcp-setup-powershell-contracts`; `npm run test:mcp-setup`
- U4: focused context/session/run-artifact/review-pre-facts/schema tests.
- U5: `npm run test:unit -- task-pack-command`
- U6: `npm run test:unit -- init-dry-run`; `npm run test:unit -- high-risk-execution-contracts`; focused worktree shell tests.
- U7: `npm run test:unit -- release-continuity-guard`; `npm run test:unit -- spec-doc-review-contracts`; `npm run test:unit -- spec-code-review-contracts`; `npm run build`
- Final: `npm run typecheck`, `npm run test:unit`, then `npm test` only after all units are merged or staged for release.

Plan-writing validation performed for this artifact:

- Direct source/contract reads only; no code behavior tests were run as proof.
- GitNexus was checked only for freshness posture and found stale relative to current HEAD.

---

## Handoff

Recommended next workflow: `$spec-work docs/plans/2026-05-24-001-fix-review-must-fix-closure-plan.md`

Execution guidance:

- Start with U1-U3 because they include all P1 failures and shared readiness/setup facts.
- Keep each batch small enough to update `2026-05-23-review.md` and `CHANGELOG.md` truthfully.
- Treat any stale GitNexus result as navigation only; source reads and focused tests own proof.
- Do not hand-edit generated runtime mirrors. If runtime refresh becomes necessary, run `spec-first init --codex|--claude` explicitly and record it.
